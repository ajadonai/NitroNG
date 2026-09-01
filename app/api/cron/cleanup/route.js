export const maxDuration = 60;

import prisma from '@/lib/prisma';
import { log } from '@/lib/logger';
import { reportOperationalFailure } from '@/lib/monitoring';
import { finalizeDueAccountDeletions } from '@/lib/account-deletion';
import { MANUAL_UNCONFIRMED_TTL_MS } from '@/lib/transaction-history';

// Cleanup cron: expires stale deposits, processes scheduled user deletions
// GET /api/cron/cleanup

export async function GET(req) {
  if (!process.env.CRON_SECRET) return Response.json({ error: 'Not configured' }, { status: 503 });
  const secret = req.headers.get('authorization')?.replace('Bearer ', '');
  if (secret !== process.env.CRON_SECRET) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Retire stale manual deposits after a day. These are records of money a
    // customer may well have sent, so they are marked, never deleted: a deleted
    // row leaves support nothing to match a payment against, and took the
    // customer's "I've sent it" button with it.
    const abandonedCutoff = new Date(Date.now() - MANUAL_UNCONFIRMED_TTL_MS);
    const { count: expiredAbandoned } = await prisma.transaction.updateMany({
      where: { type: 'deposit', method: 'manual', status: 'Pending', note: { contains: '[awaiting_confirmation]' }, createdAt: { lt: abandonedCutoff } },
      data: { status: 'Expired' },
    });
    // A customer who pressed "I've sent it" and is still waiting a day later is
    // an admin backlog, not litter: leave it Pending and visible on Payments.
    const stillWaiting = await prisma.transaction.count({
      where: { type: 'deposit', method: 'manual', status: 'Pending', note: { contains: '[user_confirmed' }, createdAt: { lt: abandonedCutoff } },
    });
    if (expiredAbandoned > 0) log.info('Cleanup', `Expired ${expiredAbandoned} unconfirmed manual deposits`);
    if (stillWaiting > 0) log.warn('Cleanup', `${stillWaiting} confirmed manual deposits still unprocessed after 24h`);
    const expiredManual = expiredAbandoned;

    // Clear expired password reset tokens
    const { count: clearedTokens } = await prisma.user.updateMany({
      where: { resetToken: { not: null }, resetExpires: { lt: new Date() } },
      data: { resetToken: null, resetExpires: null },
    });
    if (clearedTokens > 0) log.info('Cleanup', `Cleared ${clearedTokens} expired reset tokens`);

    // Keep each invocation bounded; the shared finalizer owns the irreversible
    // anonymisation policy and rechecks eligibility inside its transaction.
    const deletionFinalization = await finalizeDueAccountDeletions(prisma, new Date(), { limit: 100 });
    if (deletionFinalization.finalized > 0 || deletionFinalization.failed > 0) {
      log.info('Cleanup', `Finalized ${deletionFinalization.finalized} account deletions; ${deletionFinalization.failed} failed`);
    }
    if (deletionFinalization.failed > 0) {
      reportOperationalFailure('cleanup_failed', {
        data: { job: 'account_cleanup', failed: deletionFinalization.failed },
        dedupeKey: 'cleanup_failed:account_cleanup',
      });
    }

    return Response.json({
      permanentlyDeleted: deletionFinalization.finalized,
      deletionFinalization,
      expiredManualDeposits: expiredManual,
      clearedResetTokens: clearedTokens,
    });
  } catch (err) {
    log.error('Cleanup', err.message);
    reportOperationalFailure('cleanup_failed', {
      error: err,
      data: { job: 'account_cleanup' },
      dedupeKey: 'cleanup_failed:account_cleanup',
    });
    return Response.json({ error: 'Cleanup failed' }, { status: 500 });
  }
}
