import { log } from './logger.js';
import { tgBonusWithheld } from '@/lib/telegram';

// Halved on 1 Sep 2026 to test how much of the ladder's pull is the money
// itself. The previous rungs — ₦3,000 / ₦1,200 / ₦500 — are recorded in
// docs/BACKLOG.md under "Deposit bonus ladder cut" along with how to put them
// back; revert there, not from memory.
const TIERS = [
  { min: 1000000, bonus: 150000 }, // ₦10,000+ → ₦1,500 (15%)
  { min:  500000, bonus:  60000 }, // ₦5,000+  → ₦600   (12%)
  { min:  250000, bonus:  25000 }, // ₦2,500+  → ₦250   (10%)
];

function bonusForAmount(kobo) {
  for (const t of TIERS) {
    if (kobo >= t.min) return t.bonus;
  }
  return 0;
}

async function getIpGuardConfig(db) {
  const rows = await db.setting.findMany({
    where: { key: { in: ['welcome_bonus_ip_cap', 'welcome_bonus_ip_window_days'] } },
  });
  const map = {};
  rows.forEach(r => { map[r.key] = r.value; });
  return {
    cap: parseInt(map.welcome_bonus_ip_cap, 10) || 2,
    windowDays: parseInt(map.welcome_bonus_ip_window_days, 10) || 60,
  };
}

export async function applyWelcomeBonusDetailed(db, userId, depositAmount, {
  now = new Date(),
  idempotencyKey = 'payment:welcome:first',
} = {}) {
  const user = await db.user.findUnique({ where: { id: userId }, select: { firstDepositBonusPaid: true, referredBy: true, signupIp: true, name: true, email: true } });
  if (!user || user.firstDepositBonusPaid) return { amount: 0, withheld: null };
  const claimed = await db.user.updateMany({ where: { id: userId, firstDepositBonusPaid: false }, data: { firstDepositBonusPaid: true } });
  if (claimed.count === 0) return { amount: 0, withheld: null };
  const bonus = bonusForAmount(depositAmount);
  if (bonus === 0) return { amount: 0, withheld: null };
  const priorCompleted = await db.transaction.count({ where: { userId, type: 'deposit', status: 'Completed' } });
  if (priorCompleted > 1) return { amount: 0, withheld: null };

  if (!user.signupIp || user.signupIp === 'unknown') {
    log.debug?.('WelcomeBonus', `No IP for user ${userId}, paying normally`);
  } else {
    const { cap, windowDays } = await getIpGuardConfig(db);
    const windowStart = new Date(now.getTime() - windowDays * 86400000);
    const priorClaims = await db.user.count({
      where: {
        signupIp: user.signupIp,
        firstDepositBonusPaid: true,
        id: { not: userId },
        createdAt: { gte: windowStart },
      },
    });
    if (priorClaims >= cap) {
      log.warn('WelcomeBonus', `IP cap hit: ${user.name || 'Unknown'} (${user.email || userId}), ip ${user.signupIp}, ${priorClaims} prior claims in ${windowDays}d. Deposit ₦${depositAmount / 100}, bonus ₦${bonus / 100} withheld`);
      return {
        amount: 0,
        withheld: {
          name: user.name,
          email: user.email,
          ip: user.signupIp,
          priorClaims,
          windowDays,
          depositAmount,
          bonus,
        },
      };
    }
  }

  await db.user.update({ where: { id: userId }, data: { balance: { increment: bonus } } });
  await db.transaction.create({ data: { userId, type: 'bonus', amount: bonus, status: 'Completed', idempotencyKey, note: `Welcome bonus: ₦${bonus / 100} on first deposit` } });
  return { amount: bonus, withheld: null };
}

export async function applyWelcomeBonus(db, userId, depositAmount, options) {
  const result = await applyWelcomeBonusDetailed(db, userId, depositAmount, options);
  if (result.withheld) {
    const { name, email, ip, priorClaims, windowDays, depositAmount: deposit, bonus } = result.withheld;
    tgBonusWithheld(name, email, ip, priorClaims, windowDays, deposit, bonus);
  }
  return result.amount;
}

const BONUS_PRESETS = [
  { amount: 2500,  bonus: 250 },
  { amount: 5000,  bonus: 600, tag: 'Best value' },
  { amount: 10000, bonus: 1500 },
];

function bonusForNaira(naira) {
  if (naira >= 10000) return 1500;
  if (naira >= 5000) return 600;
  if (naira >= 2500) return 250;
  return 0;
}

function nextBonusTier(naira) {
  if (naira < 2500) return { min: 2500, bonus: 250 };
  if (naira < 5000) return { min: 5000, bonus: 600 };
  if (naira < 10000) return { min: 10000, bonus: 1500 };
  return null;
}

export { TIERS, bonusForAmount, BONUS_PRESETS, bonusForNaira, nextBonusTier };
