import prisma from '@/lib/prisma';
import { log } from "@/lib/logger";
import { requireAdmin, logActivity } from '@/lib/admin';

export async function POST() {
  const { admin, error } = await requireAdmin('settings', true);
  if (error) return error;

  try {
    // Delete inactive users older than 30 days with no orders/transactions and zero balance
    const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const stale = await prisma.user.findMany({
      where: {
        createdAt: { lt: cutoff },
        balance: 0,
      },
      select: { id: true, email: true, _count: { select: { orders: true, transactions: true } } },
    });

    const toDelete = stale.filter(u => u._count.orders === 0 && u._count.transactions === 0);

    if (toDelete.length > 0) {
      // Delete sessions first, then users
      await prisma.session.deleteMany({ where: { userId: { in: toDelete.map(u => u.id) } } });
      await prisma.user.deleteMany({ where: { id: { in: toDelete.map(u => u.id) } } });
    }

    await logActivity(admin.name, `Cleaned up ${toDelete.length} stale inactive accounts`, 'settings');

    return Response.json({
      success: true,
      deleted: toDelete.length,
      checked: stale.length,
      message: `Deleted ${toDelete.length} inactive accounts older than 30 days`,
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
      where: { createdAt: { lt: cutoff }, balance: 0 },
    });

    return Response.json({ staleCount });
  } catch (err) {
    log.error('Cleanup GET', err.message);
    return Response.json({ error: 'Failed' }, { status: 500 });
  }
}
