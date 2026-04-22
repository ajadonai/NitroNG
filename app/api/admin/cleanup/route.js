import prisma from '@/lib/prisma';
import { log } from "@/lib/logger";
import { requireAdmin, logActivity } from '@/lib/admin';

export async function POST() {
  const { admin, error } = await requireAdmin('settings', true);
  if (error) return error;

  try {
    // Delete unverified users older than 7 days who have no orders/transactions
    const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const stale = await prisma.user.findMany({
      where: {
        emailVerified: false,
        createdAt: { lt: cutoff },
      },
      select: { id: true, email: true, _count: { select: { orders: true, transactions: true } } },
    });

    // Only delete users with zero orders and zero transactions
    const toDelete = stale.filter(u => u._count.orders === 0 && u._count.transactions === 0);

    if (toDelete.length > 0) {
      // Delete sessions first, then users
      await prisma.session.deleteMany({ where: { userId: { in: toDelete.map(u => u.id) } } });
      await prisma.user.deleteMany({ where: { id: { in: toDelete.map(u => u.id) } } });
    }

    await logActivity(admin.name, `Cleaned up ${toDelete.length} stale unverified signups`, 'settings');

    return Response.json({
      success: true,
      deleted: toDelete.length,
      checked: stale.length,
      message: `Deleted ${toDelete.length} unverified accounts older than 7 days`,
    });
  } catch (err) {
    log.error('Cleanup', err.message);
    return Response.json({ error: 'Cleanup failed' }, { status: 500 });
  }
}

// GET — show count of stale unverified signups
export async function GET() {
  const { admin, error } = await requireAdmin('settings');
  if (error) return error;

  try {
    const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const staleCount = await prisma.user.count({
      where: { emailVerified: false, createdAt: { lt: cutoff } },
    });

    const unverifiedTotal = await prisma.user.count({
      where: { emailVerified: false },
    });

    return Response.json({ staleCount, unverifiedTotal });
  } catch (err) {
    log.error('Cleanup GET', err.message);
    return Response.json({ error: 'Failed' }, { status: 500 });
  }
}
