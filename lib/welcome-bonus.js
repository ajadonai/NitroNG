import { log } from './logger.js';
import { tgBonusWithheld } from '@/lib/telegram';

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
 * The foreign ladders — the naira brackets' shape, in other currencies.
 *
 * A bracket you enter, and one fixed bonus for the whole bracket: $2 opens the
 * 10% bracket and everything to $4.99 sits in it, exactly as ₦2,500 does at
 * home. Entry points are round numbers of their own currency, not the naira
 * thresholds converted, because $1.64 and ₵18.59 are not offers anybody makes.
 *
 * Held in HUNDREDTHS of the currency unit — cents, pesewas — so no float ever
 * touches a bonus. (The shilling is quoted whole, but hundredths still divide
 * cleanly, and keeping one convention beats four.)
 *
 * Every rung opens on 10 / 12 / 15%, matching naira. The entry points are then
 * chosen so the TOP bonus — which is the cap on free money for a first deposit,
 * however large — stays near the naira cap of ₦1,500 rather than far above it:
 * 1.5x in dollars, 1.7x in pounds, 1.4x in cedi, 1.2x in shillings. Rounder,
 * bigger ladders (a $25 rung, say) push that past 3x, and the thing that would
 * fund a foreign bonus that rich is the 15% deposit premium, which is off.
 */
const BONUS_LADDERS = {
  USD: [{ min: 1000, bonus: 150 }, { min:  500, bonus:  60 }, { min:  200, bonus:  20 }],
  GBP: [{ min:  800, bonus: 120 }, { min:  400, bonus:  48 }, { min:  200, bonus:  20 }],
  GHS: [{ min: 10000, bonus: 1500 }, { min: 5000, bonus: 600 }, { min: 2500, bonus: 250 }],
  KES: [{ min: 100000, bonus: 15000 }, { min: 50000, bonus: 6000 }, { min: 25000, bonus: 2500 }],
};

const USD_TIERS = BONUS_LADDERS.USD;

function bonusForUsdCents(cents) {
  for (const t of BONUS_LADDERS.USD) {
    if (cents >= t.min) return t.bonus;
  }
  return 0;
}

/**
 * Kobo credited, plus the rail it arrived on → the bonus in kobo.
 *
 * The ladder is chosen by the currency the customer PAID in, never the one they
 * were reading the site in. If the switcher picked it, flipping the toggle
 * before depositing would be worth real money, and the whole display-currency
 * design rests on the opposite promise.
 *
 * `nairaPerUnit` is how many naira one unit of that currency credits — the same
 * rate the deposit was credited at — so the customer's own figure comes back
 * out of the kobo exactly: hundredths = kobo / nairaPerUnit is the inverse of
 * naira = units × nairaPerUnit. Nothing extra has to be carried down the
 * payment chain to get here.
 *
 * The rate is PASSED IN rather than looked up. This module is imported by the
 * dashboard and the wallet for its tier tables, so reaching for settings from
 * here drags Prisma into the browser bundle — which it did, and the dashboard
 * stopped loading. Resolving belongs on the server side that already has a
 * database: deposit-finalization.js. A rate that cannot be resolved falls back
 * to the naira ladder rather than paying nothing.
 */
function bonusKoboForDeposit(depositKobo, paymentCurrency = 'NGN', nairaPerUnit = null) {
  const ladder = BONUS_LADDERS[paymentCurrency];
  const rate = Number(nairaPerUnit);
  if (!ladder || !Number.isFinite(rate) || rate <= 0) return bonusForAmount(depositKobo);
  const hundredths = Math.floor(depositKobo / rate);
  for (const t of ladder) {
    if (hundredths >= t.min) return Math.round(t.bonus * rate);
  }
  return 0;
}

/** The ladder as cards, in whole currency units. Derived from the tier table so
 *  the offer on screen and the offer paid at credit time cannot drift apart. */
function bonusPresetsFor(code) {
  const ladder = BONUS_LADDERS[code];
  if (!ladder) return null;
  return [...ladder].reverse().map((t, i) => ({
    amount: t.min / 100,
    bonus: t.bonus / 100,
    ...(i === 1 ? { tag: 'Best value' } : {}),
  }));
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
  nairaPerUnit = null,
} = {}) {
  const user = await db.user.findUnique({ where: { id: userId }, select: { firstDepositBonusPaid: true, referredBy: true, signupIp: true, name: true, email: true } });
  if (!user || user.firstDepositBonusPaid) return { amount: 0, withheld: null };
  const claimed = await db.user.updateMany({ where: { id: userId, firstDepositBonusPaid: false }, data: { firstDepositBonusPaid: true } });
  if (claimed.count === 0) return { amount: 0, withheld: null };
  const bonus = bonusKoboForDeposit(depositAmount, paymentCurrency, nairaPerUnit);
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

export { TIERS, USD_TIERS, BONUS_LADDERS, bonusPresetsFor, bonusForAmount, bonusForUsdCents, bonusKoboForDeposit, BONUS_PRESETS, bonusForNaira, nextBonusTier, MAX_BONUS_NAIRA };
