import prisma from '@/lib/prisma';
import { requireAdmin } from '@/lib/admin';

export async function GET() {
  const { admin, error } = await requireAdmin('overview');
  if (error) return error;

  try {
    // Total counts
    const [userCount, orderCount, ticketOpenCount] = await Promise.all([
      prisma.user.count(),
      prisma.order.count({ where: { deletedAt: null } }),
      prisma.ticket.count({ where: { status: 'Open' } }),
    ]);

    // Revenue + cost
    const revenueAgg = await prisma.order.aggregate({
      where: { deletedAt: null },
      _sum: { charge: true, cost: true },
    });
    const revenue = revenueAgg._sum.charge || 0;
    const cost = revenueAgg._sum.cost || 0;

    // Today's stats
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [todayOrders, todayRevenue, todayUsers] = await Promise.all([
      prisma.order.count({ where: { createdAt: { gte: todayStart } } }),
      prisma.order.aggregate({
        where: { createdAt: { gte: todayStart } },
        _sum: { charge: true },
      }),
      prisma.user.count({ where: { createdAt: { gte: todayStart } } }),
    ]);

    // Deposits total
    const depositsAgg = await prisma.transaction.aggregate({
      where: { type: 'deposit', status: 'Completed' },
      _sum: { amount: true },
    });

    return Response.json({
      users: userCount,
      orders: orderCount,
      openTickets: ticketOpenCount,
      revenue: revenue / 100,
      cost: cost / 100,
      profit: (revenue - cost) / 100,
      deposits: (depositsAgg._sum.amount || 0) / 100,
      today: {
        orders: todayOrders,
        revenue: (todayRevenue._sum.charge || 0) / 100,
        users: todayUsers,
      },
    });
  } catch (err) {
    console.error('[Admin Overview]', err.message);
    return Response.json({ error: 'Failed to load overview' }, { status: 500 });
  }
}
