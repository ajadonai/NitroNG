import { log } from './logger.js';
import { tgBonusWithheld } from '@/lib/telegram';
import { resolveDepositRate } from './fx-deposit.js';

// Halved on 1 Sep 2026 to test how much of the ladder's pull is the money
// itself. The previous rungs — ₦3,000 / ₦1,200 / ₦500 — are recorded in
// docs/SHELF.md under "Deposit bonus ladder cut" along with how to put them
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

/**
 * The dollar ladder — the same shape as the naira one, in dollars.
 *
 * A bracket you enter, and one fixed bonus for the whole bracket: $2 opens the
 * 10% bracket and everything up to $4.99 sits in it, exactly as ₦2,500 does at
 * home. The entry points are round dollars rather than the naira thresholds
 * converted, because $1.64 is not an offer anybody makes. Cents, so no float
 * touches a bonus.
 *
 * Trip chose these over a $5/$10/$25 ladder: whatever the top bracket pays
 * becomes the cap on free money for a first deposit, and $10 → $1.50 caps it at
 * about ₦2,294 against naira's ₦1,500. A $25 → $3.75 rung would have capped it
 * near ₦5,700 — 3.8x — which the 15% deposit premium was meant to fund, and
 * that premium is currently switched off (fx_premium_live).
 */
const USD_TIERS = [
  { min: 1000, bonus: 150 }, // $10+ → $1.50 (15%)
  { min:  500, bonus:  60 }, // $5+  → $0.60 (12%)
  { min:  200, bonus:  20 }, // $2+  → $0.20 (10%)
];

function bonusForUsdCents(cents) {
  for (const t of USD_TIERS) {
    if (cents >= t.min) return t.bonus;
  }
  return 0;
}

/**
 * Kobo credited, plus the rail it arrived on → the bonus in kobo.
 *
 * The ladder is chosen by the currency the customer PAID in, never the one they
 * were reading the site in. If the switcher picked it, flipping the toggle
 * before depositing would be worth real money — under a richer dollar ladder a
 * naira customer could collect several thousand naira extra for one click — and
 * the whole display-currency design rests on the opposite promise.
 *
 * The dollars are recovered from the kobo by the same deposit rate that
 * credited them: cents = kobo / rate is the exact inverse of naira = dollars ×
 * rate, so no extra figure has to be carried down the payment chain to get
 * here. If the rate cannot be resolved it falls back to the naira ladder rather
 * than paying nothing.
 */
async function bonusKoboForDeposit(depositKobo, paymentCurrency = 'NGN') {
  if (paymentCurrency !== 'USD') return bonusForAmount(depositKobo);
  let depositRate = null;
  try { ({ depositRate } = await resolveDepositRate()); } catch { /* falls through */ }
  if (!Number.isFinite(depositRate) || depositRate <= 0) return bonusForAmount(depositKobo);
  const cents = Math.floor(depositKobo / depositRate);
  return Math.round(bonusForUsdCents(cents) * depositRate);
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
  paymentCurrency = 'NGN',
} = {}) {
  const user = await db.user.findUnique({ where: { id: userId }, select: { firstDepositBonusPaid: true, referredBy: true, signupIp: true, name: true, email: true } });
  if (!user || user.firstDepositBonusPaid) return { amount: 0, withheld: null };
  const claimed = await db.user.updateMany({ where: { id: userId, firstDepositBonusPaid: false }, data: { firstDepositBonusPaid: true } });
  if (claimed.count === 0) return { amount: 0, withheld: null };
  const bonus = await bonusKoboForDeposit(depositAmount, paymentCurrency);
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

// The dollar ladder as cards, derived from USD_TIERS so the offer on screen and
// the offer paid at credit time cannot drift apart. Dollars, not cents.
const USD_BONUS_PRESETS = [...USD_TIERS]
  .reverse()
  .map((t, i) => ({ amount: t.min / 100, bonus: t.bonus / 100, ...(i === 1 ? { tag: 'Best value' } : {}) }));

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

// The headline number in the marketing copy ("up to ₦1,500 free"), derived
// rather than typed, so the ladder and the copy can never disagree — and so it
// can be run through the currency formatter instead of being a naira string.
const MAX_BONUS_NAIRA = BONUS_PRESETS[BONUS_PRESETS.length - 1].bonus;

function nextBonusTier(naira) {
  if (naira < 2500) return { min: 2500, bonus: 250 };
  if (naira < 5000) return { min: 5000, bonus: 600 };
  if (naira < 10000) return { min: 10000, bonus: 1500 };
  return null;
}

export { TIERS, USD_TIERS, USD_BONUS_PRESETS, bonusForAmount, bonusForUsdCents, bonusKoboForDeposit, BONUS_PRESETS, bonusForNaira, nextBonusTier, MAX_BONUS_NAIRA };
