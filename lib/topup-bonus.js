import { log } from './logger.js';

// Monthly top-up ladder: fixed prizes that unlock the moment a customer's
// completed deposits for the Lagos calendar month cross a rung. Prizes are
// calibrated so the cumulative payout matches 5% / 7% / 10% of the rung.
// Ships dark: topup_bonus_enabled defaults to false.
export const DEFAULT_RUNGS = [
  { min: 3_000_000, prize: 150_000 }, // cross ₦30,000  → ₦1,500   (5% cumulative)
  { min: 6_000_000, prize: 270_000 }, // cross ₦60,000  → +₦2,700  (7% cumulative)
  { min: 10_000_000, prize: 580_000 }, // cross ₦100,000 → +₦5,800 (10% cumulative)
];

const SETTING_KEYS = ['topup_bonus_enabled', 'topup_bonus_rungs', 'topup_bonus_expiry_days'];

// Lagos is UTC+1 with no DST, so month boundaries are a fixed offset.
const LAGOS_OFFSET_MS = 3_600_000;

export function lagosMonth(now = new Date()) {
  const shifted = new Date(now.getTime() + LAGOS_OFFSET_MS);
  const y = shifted.getUTCFullYear();
  const m = shifted.getUTCMonth();
  return {
    key: `${y}-${String(m + 1).padStart(2, '0')}`,
    start: new Date(Date.UTC(y, m, 1) - LAGOS_OFFSET_MS),
    end: new Date(Date.UTC(y, m + 1, 1) - LAGOS_OFFSET_MS),
    name: new Date(Date.UTC(y, m, 1)).toLocaleString('en-NG', { month: 'long', timeZone: 'UTC' }),
  };
}

export function crossedRungs(total, rungs) {
  return rungs.filter(r => total >= r.min);
}

function rungKey(monthKey, rung) {
  return `topup:${monthKey}:r${rung.min}`;
}

// `settingRows` lets a caller that already loaded the settings (the dashboard
// batches its lookups into one narrow query) pass them in instead of querying.
export async function topupBonusSettings(db, settingRows) {
  const rows = settingRows ?? await db.setting.findMany({ where: { key: { in: SETTING_KEYS } } });
  const map = Object.fromEntries(rows.filter(r => SETTING_KEYS.includes(r.key)).map(r => [r.key, r.value]));
  let rungs = DEFAULT_RUNGS;
  if (map.topup_bonus_rungs) {
    try {
      const parsed = JSON.parse(map.topup_bonus_rungs);
      const valid = Array.isArray(parsed) && parsed.length > 0 && parsed.every(r =>
        Number.isSafeInteger(r?.min) && r.min > 0 && Number.isSafeInteger(r?.prize) && r.prize > 0);
      if (valid) rungs = [...parsed].sort((a, b) => a.min - b.min);
      else log.warn('TopupBonus', 'Ignoring invalid topup_bonus_rungs setting');
    } catch {
      log.warn('TopupBonus', 'Ignoring unparseable topup_bonus_rungs setting');
    }
  }
  return {
    enabled: map.topup_bonus_enabled === 'true',
    rungs,
    expiryDays: parseInt(map.topup_bonus_expiry_days, 10) || 30,
  };
}

// The month's counted total is always summed live from completed deposit
// rows — no counter to drift. The customer's first-ever completed deposit
// never counts: the welcome bonus owns that one.
export async function countedMonthTotal(db, userId, month) {
  const first = await db.transaction.findFirst({
    where: { userId, type: 'deposit', status: 'Completed' },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    select: { id: true },
  });
  const agg = await db.transaction.aggregate({
    where: {
      userId,
      type: 'deposit',
      status: 'Completed',
      createdAt: { gte: month.start, lt: month.end },
      ...(first ? { id: { not: first.id } } : {}),
    },
    _sum: { amount: true },
  });
  return agg._sum.amount || 0;
}

/**
 * Award any rungs newly crossed by this month's total. Called inside
 * finalizeDeposit's serializable transaction, after the deposit is credited,
 * so the just-completed deposit is in the sum and the wallet row is already
 * locked. One award per user per month per rung, enforced by the
 * @@unique([userId, idempotencyKey]) constraint on transactions — a P2002
 * from a concurrent finalization aborts the attempt and finalizeDeposit's
 * retry loop re-runs it cleanly.
 */
export async function applyTopupBonus(db, userId, { now = new Date() } = {}) {
  const none = { amount: 0, unlocked: [] };
  const cfg = await topupBonusSettings(db);
  if (!cfg.enabled) return none;
  const reseller = await db.resellerProfile.findUnique({ where: { userId }, select: { id: true } });
  if (reseller) return none;

  const month = lagosMonth(now);
  const total = await countedMonthTotal(db, userId, month);
  const crossed = crossedRungs(total, cfg.rungs);
  if (crossed.length === 0) return none;

  const keys = crossed.map(r => rungKey(month.key, r));
  const existing = await db.transaction.findMany({
    where: { userId, idempotencyKey: { in: keys } },
    select: { idempotencyKey: true },
  });
  const paid = new Set(existing.map(t => t.idempotencyKey));
  const expiresAt = new Date(now.getTime() + cfg.expiryDays * 86_400_000);

  let amount = 0;
  const unlocked = [];
  for (const rung of crossed) {
    const key = rungKey(month.key, rung);
    if (paid.has(key)) continue;
    await db.user.update({ where: { id: userId }, data: { balance: { increment: rung.prize } } });
    await db.bonusCredit.create({
      data: { userId, source: 'topup_month', amountGranted: rung.prize, amountRemaining: rung.prize, expiresAt },
    });
    await db.transaction.create({
      data: {
        userId,
        type: 'bonus',
        amount: rung.prize,
        status: 'Completed',
        idempotencyKey: key,
        note: `Top-up bonus: crossed ₦${(rung.min / 100).toLocaleString()} in ${month.name} (expires ${expiresAt.toISOString().slice(0, 10)})`,
      },
    });
    amount += rung.prize;
    unlocked.push(rung);
  }
  return { amount, unlocked };
}

/**
 * Progress payload for the wallet card. Null means "no card": the flag is
 * off or the account is a reseller (they have the discount track instead).
 */
export async function getTopupProgress(db, userId, { now = new Date(), settingRows } = {}) {
  const cfg = await topupBonusSettings(db, settingRows);
  if (!cfg.enabled) return null;
  const reseller = await db.resellerProfile.findUnique({ where: { userId }, select: { id: true } });
  if (reseller) return null;

  const month = lagosMonth(now);
  const total = await countedMonthTotal(db, userId, month);
  const paidRows = await db.transaction.findMany({
    where: { userId, idempotencyKey: { in: cfg.rungs.map(r => rungKey(month.key, r)) } },
    select: { idempotencyKey: true, amount: true },
  });
  const paid = new Set(paidRows.map(t => t.idempotencyKey));
  const next = cfg.rungs.find(r => total < r.min) || null;
  return {
    month: month.name,
    total,
    max: cfg.rungs[cfg.rungs.length - 1].min,
    rungs: cfg.rungs.map(r => ({ min: r.min, prize: r.prize, unlocked: paid.has(rungKey(month.key, r)) })),
    unlockedAmount: paidRows.reduce((sum, t) => sum + t.amount, 0),
    next: next ? { min: next.min, prize: next.prize, toGo: next.min - total } : null,
  };
}
