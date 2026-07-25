import { log } from './logger.js';
import { tgBonusWithheld } from '@/lib/telegram';

const TIERS = [
  { min: 1000000, bonus: 300000 }, // ₦10,000+ → ₦3,000
  { min:  500000, bonus: 120000 }, // ₦5,000+  → ₦1,200
  { min:  250000, bonus:  50000 }, // ₦2,500+  → ₦500
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
  if (user.referredBy) return { amount: 0, withheld: null };

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
  { amount: 5000,  bonus: 1200, tag: 'Best value' },
  { amount: 10000, bonus: 3000 },
];

function bonusForNaira(naira) {
  if (naira >= 10000) return 3000;
  if (naira >= 5000) return 1200;
  if (naira >= 2500) return 500;
  return 0;
}

function nextBonusTier(naira) {
  if (naira < 2500) return { min: 2500, bonus: 500 };
  if (naira < 5000) return { min: 5000, bonus: 1200 };
  if (naira < 10000) return { min: 10000, bonus: 3000 };
  return null;
}

export { TIERS, bonusForAmount, BONUS_PRESETS, bonusForNaira, nextBonusTier };
