import prisma from '@/lib/prisma';
import { log } from "@/lib/logger";
import { requireAdmin, getAdminPages } from '@/lib/admin';

export async function GET() {
  const { admin, error } = await requireAdmin('overview');
  if (error) return error;

  try {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const yesterdayStart = new Date(todayStart);
    yesterdayStart.setDate(yesterdayStart.getDate() - 1);

    // All counts + aggregates in parallel
    const [
      userCount, orderCount, processingCount,
      revenueAgg, costAgg, depositsAgg,
      todayOrders, todayRevenueAgg, todayUsers, todayDepositsAgg,
      yesterdayRevenueAgg, yesterdayDepositsAgg,
      recentOrders, recentUsers, openTickets, activityLogs,
    ] = await Promise.all([
      prisma.user.count({ where: { emailVerified: true } }),
      prisma.order.count({ where: { deletedAt: null } }),
      prisma.order.count({ where: { status: 'Processing', deletedAt: null } }),
      prisma.order.aggregate({ where: { deletedAt: null, status: { notIn: ['Cancelled'] } }, _sum: { charge: true } }),
      prisma.order.aggregate({ where: { deletedAt: null, status: { notIn: ['Cancelled'] } }, _sum: { cost: true } }),
      prisma.transaction.aggregate({ where: { type: 'deposit', status: 'Completed' }, _sum: { amount: true } }),
      // Today
      prisma.order.count({ where: { createdAt: { gte: todayStart }, deletedAt: null } }),
      prisma.order.aggregate({ where: { createdAt: { gte: todayStart }, deletedAt: null, status: { notIn: ['Cancelled'] } }, _sum: { charge: true } }),
      prisma.user.count({ where: { createdAt: { gte: todayStart }, emailVerified: true } }),
      prisma.transaction.aggregate({ where: { type: 'deposit', status: 'Completed', createdAt: { gte: todayStart } }, _sum: { amount: true } }),
      // Yesterday (for % change)
      prisma.order.aggregate({ where: { createdAt: { gte: yesterdayStart, lt: todayStart }, deletedAt: null, status: { notIn: ['Cancelled'] } }, _sum: { charge: true } }),
      prisma.transaction.aggregate({ where: { type: 'deposit', status: 'Completed', createdAt: { gte: yesterdayStart, lt: todayStart } }, _sum: { amount: true } }),
      // Recent orders (last 5)
      prisma.order.findMany({
        where: { deletedAt: null },
        orderBy: { createdAt: 'desc' },
        take: 5,
        include: { user: { select: { name: true, email: true } }, service: { select: { name: true, category: true } } },
      }),
      // Recent users (last 5)
      prisma.user.findMany({
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: { id: true, name: true, email: true, createdAt: true, _count: { select: { orders: true } } },
      }),
      // Open tickets (last 4)
      prisma.ticket.findMany({
        where: { status: 'Open' },
        orderBy: { createdAt: 'desc' },
        take: 4,
        include: { user: { select: { name: true, email: true } } },
      }),
      // Recent activity (last 8)
      prisma.activityLog.findMany({
        orderBy: { createdAt: 'desc' },
        take: 8,
      }),
    ]);

    const todayRevenue = (todayRevenueAgg._sum.charge || 0) / 100;
    const yesterdayRevenue = (yesterdayRevenueAgg._sum.charge || 0) / 100;
    const todayDeposits = (todayDepositsAgg._sum.amount || 0) / 100;
    const yesterdayDeposits = (yesterdayDepositsAgg._sum.amount || 0) / 100;

    const pctChange = (today, yesterday) => {
      if (yesterday === 0) return today > 0 ? 100 : 0;
      return Math.round(((today - yesterday) / yesterday) * 100);
    };

    return Response.json({
      admin: { name: admin.name, role: admin.role, email: admin.email, themePreference: admin.themePreference || 'auto', pages: getAdminPages(admin) },
      revenue: todayRevenue,
      users: userCount,
      orders: orderCount,
      processing: processingCount,
      deposits: todayDeposits,
      ordersToday: todayOrders,
      newUsersToday: todayUsers,
      revenueChange: pctChange(todayRevenue, yesterdayRevenue),
      depositsChange: pctChange(todayDeposits, yesterdayDeposits),
      totalRevenue: (revenueAgg._sum.charge || 0) / 100,
      totalCost: (costAgg._sum.cost || 0) / 100,
      totalProfit: ((revenueAgg._sum.charge || 0) - (costAgg._sum.cost || 0)) / 100,
      totalDeposits: (depositsAgg._sum.amount || 0) / 100,
      openTickets: openTickets.map(tk => ({
        id: tk.id,
        subject: tk.subject,
        user: tk.user?.name || tk.user?.email || 'Unknown',
        created: tk.createdAt.toISOString(),
      })),
      recentOrders: recentOrders.map(o => ({
        id: o.orderId || o.id,
        service: o.service?.name || o.serviceId,
        platform: o.service?.category || 'unknown',
        user: o.user?.name || o.user?.email || 'Unknown',
        charge: (o.charge || 0) / 100,
        status: o.status,
        created: o.createdAt.toISOString(),
      })),
      recentUsers: recentUsers.map(u => ({
        id: u.id,
        name: u.name,
        email: u.email,
        orders: u._count.orders,
        created: u.createdAt.toISOString(),
      })),
      activity: activityLogs.map(a => ({
        action: a.action,
        detail: a.adminName,
        type: a.type,
        time: a.createdAt.toISOString(),
      })),
    });
  } catch (err) {
    log.error('Admin Overview', err.message);
    return Response.json({ error: 'Failed to load overview' }, { status: 500 });
  }
}
