import { msg } from "./i18n";
import { log } from './logger.js';
import { tgBonusWithheld } from '@/lib/telegram';

// One ladder for every customer, in naira, whatever currency they read or pay
// in. Per-currency ladders were built and taken out again on 8 Sep 2026: they
// needed keying (to the rail, then to the country), a rate lookup at credit
// time, and a fairness argument per currency, and none of it bought anything
// the deposit rate does not already do. A foreign customer sees these figures
// converted — the numbers are not round, and that is fine; the rule is.
// Halved on 1 Sep 2026 to test how much of the ladder's pull was the money
// itself, restored on 14 Sep because the test answered it. In the two weeks at
// half rates, first deposits under ₦2,500 went 28.6% → 36.6% and the ₦1,000
// minimum 17.5% → 27.9%, while the median held at ₦2,500. The shift landed on
// 1 Sep, before the ad audience widened on the 6th, so the ladder caused it.
// Seven-day value per first depositor fell ₦5,588 → ₦4,438 with repeat
// behaviour flat (1.34 → 1.36 deposits), so nobody came back to make it up:
// ₦401 of face value saved per depositor against ₦726 of gross profit lost.
const TIERS = [
  { min: 1000000, bonus: 300000 }, // ₦10,000+ → ₦3,000 (30%)
  { min:  500000, bonus: 120000 }, // ₦5,000+  → ₦1,200 (24%)
  { min:  250000, bonus:  50000 }, // ₦2,500+  → ₦500   (20%)
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
  { amount: 2500,  bonus: 500 },
  { amount: 5000,  bonus: 1200, tag: msg('Best value') },
  { amount: 10000, bonus: 3000 },
];

function bonusForNaira(naira) {
  if (naira >= 10000) return 3000;
  if (naira >= 5000) return 1200;
  if (naira >= 2500) return 500;
  return 0;
}

// The headline number in the marketing copy ("up to ₦3,000 free"), derived
// rather than typed, so the ladder and the copy can never disagree — and so it
// can be run through the currency formatter instead of being a naira string.
const MAX_BONUS_NAIRA = BONUS_PRESETS[BONUS_PRESETS.length - 1].bonus;

function nextBonusTier(naira) {
  if (naira < 2500) return { min: 2500, bonus: 500 };
  if (naira < 5000) return { min: 5000, bonus: 1200 };
  if (naira < 10000) return { min: 10000, bonus: 3000 };
  return null;
}

export { TIERS, bonusForAmount, BONUS_PRESETS, bonusForNaira, nextBonusTier, MAX_BONUS_NAIRA };
