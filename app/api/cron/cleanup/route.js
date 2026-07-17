export const maxDuration = 60;

import prisma from '@/lib/prisma';
import { log } from '@/lib/logger';
import { finalizeDueAccountDeletions } from '@/lib/account-deletion';

// Cleanup cron: expires stale deposits, processes scheduled user deletions
// GET /api/cron/cleanup

export async function GET(req) {
  if (!process.env.CRON_SECRET) return Response.json({ error: 'Not configured' }, { status: 503 });
  const secret = req.headers.get('authorization')?.replace('Bearer ', '');
  if (secret !== process.env.CRON_SECRET) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Auto-expire manual deposits: 10 min if user never confirmed, 24 hrs if unprocessed by admin
    const abandonedCutoff = new Date(Date.now() - 60 * 60 * 1000);
    const unprocessedCutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const { count: expiredAbandoned } = await prisma.transaction.deleteMany({
      where: { type: 'deposit', method: 'manual', status: 'Pending', note: { contains: '[awaiting_confirmation]' }, createdAt: { lt: abandonedCutoff } },
    });
    const { count: expiredUnprocessed } = await prisma.transaction.deleteMany({
      where: { type: 'deposit', method: 'manual', status: 'Pending', note: { contains: '[user_confirmed' }, createdAt: { lt: unprocessedCutoff } },
    });
    const expiredManual = expiredAbandoned + expiredUnprocessed;
    if (expiredManual > 0) log.info('Cleanup', `Deleted ${expiredAbandoned} abandoned + ${expiredUnprocessed} unprocessed manual deposits`);

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

    return Response.json({
      permanentlyDeleted: deletionFinalization.finalized,
      deletionFinalization,
      expiredManualDeposits: expiredManual,
      clearedResetTokens: clearedTokens,
    });
  } catch (err) {
    log.error('Cleanup', err.message);
    return Response.json({ error: 'Cleanup failed' }, { status: 500 });
  }
}
