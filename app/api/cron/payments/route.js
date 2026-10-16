export const maxDuration = 60;

import prisma from '@/lib/prisma';
import { log } from '@/lib/logger';
import { reportOperationalFailure } from '@/lib/monitoring';
import { recoverStalePendingPayments } from '@/lib/payment-recovery';
import { sweepGuestCheckouts } from '@/lib/guest-checkout';
import { guestAccountId } from '@/lib/guest-account';
import { getBalance, isProviderConfigured, PROVIDER_IDS, getProviderName } from '@/lib/smm';
import { tgProviderBalance, tgFlush } from '@/lib/telegram';

export async function GET(req) {
  if (!process.env.CRON_SECRET) return Response.json({ error: 'Not configured' }, { status: 503 });
  const secret = req.headers.get('authorization')?.replace('Bearer ', '');
  if (secret !== process.env.CRON_SECRET) {
    await tgFlush();
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const stats = await recoverStalePendingPayments();
    // Guest checkout (docs/v2/guest_checkout_brief.md): place any paid order a
    // crash left unplaced, close quotes nobody paid for, and say so if the
    // shared guest wallet is ever not ₦0, which means a pass-through broke.
    let guest = null;
    try {
      guest = await sweepGuestCheckouts();
      const guestId = await guestAccountId();
      const wallet = guestId ? await prisma.user.findUnique({ where: { id: guestId }, select: { balance: true } }) : null;
      if (wallet && wallet.balance !== 0) {
        reportOperationalFailure('guest_wallet_not_zero', { data: { balanceKobo: wallet.balance }, dedupeKey: 'guest_wallet_not_zero' });
      }
    } catch (err) {
      log.warn('Guest sweep', err.message);
    }

    let balanceAlert = false;
    try {
      const LOW_BALANCE_USD = 10;
      const ALERT_COOLDOWN_MS = 4 * 60 * 60 * 1000;
      const configured = PROVIDER_IDS.filter(isProviderConfigured);
      const balances = {};
      const alerts = [];
      for (const pid of configured) {
        try {
          const data = await getBalance(pid);
          const balance = parseFloat(data.balance) || 0;
          balances[pid] = { balance, currency: data.currency || 'USD' };
          if (balance < LOW_BALANCE_USD) alerts.push({ provider: getProviderName(pid), balance, threshold: LOW_BALANCE_USD });
        } catch (err) {
          balances[pid] = { status: 'error', message: err.message };
        }
      }
      await prisma.setting.upsert({
        where: { key: 'provider_balances' },
        update: { value: JSON.stringify({ ...balances, checkedAt: new Date().toISOString() }) },
        create: { key: 'provider_balances', value: JSON.stringify({ ...balances, checkedAt: new Date().toISOString() }) },
      }).catch(() => {});
      if (alerts.length > 0) {
        const lastAlert = await prisma.setting.findUnique({ where: { key: 'last_balance_alert_tg' } }).catch(() => null);
        const lastAlertTime = lastAlert?.value ? new Date(lastAlert.value).getTime() : 0;
        if (!lastAlertTime || Date.now() - lastAlertTime > ALERT_COOLDOWN_MS) {
          tgProviderBalance(alerts);
          balanceAlert = true;
          await prisma.setting.upsert({
            where: { key: 'last_balance_alert_tg' },
            update: { value: new Date().toISOString() },
            create: { key: 'last_balance_alert_tg', value: new Date().toISOString() },
          }).catch(() => {});
        }
      }
    } catch (err) {
      log.warn('Balance check', err.message);
    }

    await tgFlush();

    return Response.json({
      guest,
      checked: stats.checked,
      recovered: stats.recovered,
      alreadyCredited: stats.alreadyCredited,
      pending: stats.pending,
      verifying: stats.verifying,
      retryable: stats.retryable,
      retryableStuck: stats.retryableStuck,
      failed: stats.failed,
      review: stats.review,
      refunded: stats.refunded,
      audited: stats.audited,
      expired: stats.expired,
      errors: stats.errors.length ? stats.errors : undefined,
      balanceAlert: balanceAlert || undefined,
    });
  } catch (err) {
    log.error('Payment Recovery', err.message);
    reportOperationalFailure('payment_recovery_failed', {
      error: err,
      data: { job: 'payments_cron' },
    });
    await tgFlush();
    return Response.json({ error: 'Recovery failed' }, { status: 500 });
  }
}
