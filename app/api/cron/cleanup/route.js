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

    return Response.json({
      deleted: toDelete.length,
      emails: toDelete.map(u => u.email),
    });
  } catch (err) {
    log.error('Cleanup', err.message);
    return Response.json({ error: 'Cleanup failed' }, { status: 500 });
  }
}
