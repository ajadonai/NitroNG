import { trackDeposit } from './meta-capi.js';
import { tgBonusWithheld, tgPayment } from './telegram.js';
import { referralBonusEmail, sendEmail, walletCreditEmail } from './email.js';
import { getWhatsAppChannelUrl } from './settings.js';
import { log } from './logger.js';

function channelFor(result, override) {
  if (override) return override;
  const method = String(result.transaction?.method || '').toLowerCase();
  if (method === 'crypto') return 'Crypto';
  if (method === 'manual') return 'Manual';
  if (method === 'flutterwave') return 'Flutterwave';
  return result.transaction?.method || 'Deposit';
}

export async function notifyDepositFinalized(result, {
  channel,
  approvedBy,
  clientIp,
  userAgent,
  fbp,
  fbc,
  sourceUrl,
} = {}) {
  if (!result?.finalized) return { attempted: 0, failed: [], skipped: true };

  const user = result.user || {};
  const reference = result.transaction?.reference;
  const method = channelFor(result, channel);
  const bonusTotal = (result.couponBonus || 0) + (result.welcomeBonus || 0) + (result.inviteeBonus || 0);
  const tasks = [];

  tasks.push({
    name: 'meta',
    run: () => trackDeposit({
      email: user.email,
      phone: user.phone,
      userId: user.id || result.transaction?.userId,
      reference,
      amountKobo: result.depositAmount,
      clientIp: clientIp || user.lastIp,
      userAgent: userAgent || user.lastUa,
      fbp: fbp || user.lastFbp,
      fbc: fbc || user.lastFbc,
      sourceUrl,
    }),
  });

  tasks.push({
    name: 'telegram',
    run: async () => tgPayment(
      user.name || user.email || 'Unknown',
      result.depositAmount,
      bonusTotal,
      method,
      approvedBy,
    ),
  });

  if (user.email) {
    tasks.push({
      name: 'deposit-email',
      run: async () => {
        const amountNaira = result.depositAmount / 100;
        const waChannelUrl = await getWhatsAppChannelUrl();
        const html = walletCreditEmail(user.name || 'there', amountNaira, null, {
          kind: 'deposit',
          bonus: (result.welcomeBonus || 0) / 100,
          newBalance: (user.balance || 0) / 100,
          method,
          waChannelUrl,
        });
        return sendEmail(
          user.email,
          `₦${amountNaira.toLocaleString()} is in your wallet`,
          html,
          `Your deposit of ₦${amountNaira.toLocaleString()} landed and is ready to spend. Place an order: https://nitro.ng/dashboard`,
        );
      },
    });
  }

  if (result.referralPaid && result.referrer?.email && result.referrerBonus > 0) {
    tasks.push({
      name: 'referral-email',
      run: () => {
        const amountNaira = result.referrerBonus / 100;
        return sendEmail(
          result.referrer.email,
          `You received ₦${amountNaira.toLocaleString()} on Nitro!`,
          referralBonusEmail(result.referrer.name || 'there', amountNaira),
          `Someone you referred just made their first deposit. ₦${amountNaira.toLocaleString()} landed in your wallet: https://nitro.ng/dashboard`,
        );
      },
    });
  }

  if (result.welcomeWithheld) {
    tasks.push({
      name: 'welcome-withheld',
      run: async () => {
        const withheld = result.welcomeWithheld;
        return tgBonusWithheld(
          withheld.name,
          withheld.email,
          withheld.ip,
          withheld.priorClaims,
          withheld.windowDays,
          withheld.depositAmount,
          withheld.bonus,
        );
      },
    });
  }

  const settled = await Promise.allSettled(tasks.map(task => Promise.resolve().then(task.run)));
  const failed = [];
  settled.forEach((outcome, index) => {
    if (outcome.status !== 'rejected') return;
    const name = tasks[index].name;
    failed.push(name);
    log.warn('Deposit Notification', `${name} failed for ${reference || 'unknown reference'}: ${outcome.reason?.message || outcome.reason}`);
  });

  return { attempted: tasks.length, failed, skipped: false };
}
