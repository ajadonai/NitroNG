import prisma from '@/lib/prisma';
import { log } from '@/lib/logger';

// Auto-delete unverified users older than 7 days
// Call via Vercel Cron or external scheduler: GET /api/cron/cleanup
// Protect with CRON_SECRET env var

export async function GET(req) {
  const secret = req.headers.get('authorization')?.replace('Bearer ', '');
  if (secret !== process.env.CRON_SECRET) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // 7 days ago

    // Find unverified users older than 7 days with no orders
    const stale = await prisma.user.findMany({
      where: {
        emailVerified: false,
        createdAt: { lt: cutoff },
      },
      select: { id: true, email: true, createdAt: true, _count: { select: { orders: true } } },
    });

    // Only delete users with zero orders (safety check)
    const toDelete = stale.filter(u => u._count.orders === 0);

    if (toDelete.length === 0) {
      log.info('Cleanup', 'No stale unverified users to delete');
      return Response.json({ deleted: 0 });
    }

    const ids = toDelete.map(u => u.id);

    // Delete related records first, then users
    await prisma.$transaction([
      prisma.transaction.deleteMany({ where: { userId: { in: ids } } }),
      prisma.session.deleteMany({ where: { userId: { in: ids } } }),
      prisma.user.deleteMany({ where: { id: { in: ids } } }),
    ]);

    log.info('Cleanup', `Deleted ${toDelete.length} unverified users older than 7 days`);

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
      deleted: toDelete.length,
      permanentlyDeleted: permDeleted,
      emails: toDelete.map(u => u.email),
    });
  } catch (err) {
    log.error('Cleanup', err.message);
    return Response.json({ error: 'Cleanup failed' }, { status: 500 });
  }
}
