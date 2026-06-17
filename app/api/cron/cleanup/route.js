export const maxDuration = 60;

import prisma from '@/lib/prisma';
import { log } from '@/lib/logger';

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

    // ═══ PERMANENT DELETION — users past their 30-day deletion window ═══
    const pendingUsers = await prisma.user.findMany({
      where: {
        status: 'PendingDeletion',
        deletedAt: { lt: new Date() }, // past the scheduled date
      },
      select: { id: true, email: true, deletedEmail: true, deletedName: true },
    });

    let permDeleted = 0;
    for (const pu of pendingUsers) {
      try {
        const uid = pu.id;
        // Clear referral chain — users referred by this person keep their accounts
        await prisma.user.updateMany({ where: { referredBy: uid }, data: { referredBy: null } });
        await prisma.$transaction([
          prisma.ticketReply.deleteMany({ where: { ticket: { userId: uid } } }),
          prisma.ticket.deleteMany({ where: { userId: uid } }),
          prisma.idempotencyKey.deleteMany({ where: { userId: uid } }),
          prisma.videoWatch.deleteMany({ where: { userId: uid } }),
          prisma.gameReward.deleteMany({ where: { userId: uid } }),
          prisma.gameScore.deleteMany({ where: { userId: uid } }),
          prisma.gameSession.deleteMany({ where: { userId: uid } }),
          prisma.waitlist.deleteMany({ where: { userId: uid } }),
          prisma.session.deleteMany({ where: { userId: uid } }),
          // Soft-delete orders — preserve for financial audit trail
          prisma.order.updateMany({ where: { userId: uid }, data: { deletedAt: new Date() } }),
          // Keep transactions for accounting records, anonymize user reference
          prisma.user.update({ where: { id: uid }, data: {
            status: 'Deleted',
            name: 'Deleted User',
            email: `deleted_${uid}@nitro.ng`,
            password: '',
            balance: 0,
            emailVerified: false,
            verifyToken: null,
            resetToken: null,
            phone: null,
          } }),
        ]);
        permDeleted++;
        log.info('Cleanup', `Permanently deleted user ${pu.deletedEmail || pu.email} (${uid})`);
      } catch (e) {
        log.error('Cleanup', `Failed to permanently delete user ${pu.id}: ${e.message}`);
      }
    }

    return Response.json({
      permanentlyDeleted: permDeleted,
      expiredManualDeposits: expiredManual,
      clearedResetTokens: clearedTokens,
    });
  } catch (err) {
    log.error('Cleanup', err.message);
    return Response.json({ error: 'Cleanup failed' }, { status: 500 });
  }
}
