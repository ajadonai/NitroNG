import prisma from '@/lib/prisma';
import { log } from "@/lib/logger";
import { requireAdmin } from '@/lib/admin';

export async function GET(req) {
  const { admin, error } = await requireAdmin('finance');
  if (error) return error;

  try {
    const url = new URL(req.url);
    const range = url.searchParams.get('range') || '30d';

    const now = new Date();
    let since;
    if (range === '24h') since = new Date(now - 24 * 60 * 60 * 1000);
    else if (range === '7d') since = new Date(now - 7 * 24 * 60 * 60 * 1000);
    else if (range === '90d') since = new Date(now - 90 * 24 * 60 * 60 * 1000);
    else since = new Date(now - 30 * 24 * 60 * 60 * 1000);

    const [ordersAgg, userCount, depositAgg, adminCreditAgg, adminGiftAgg, couponBonusAgg, referralBonusAgg, refundAgg, ordersByStatus, topServices, allOrders] = await Promise.all([
      prisma.order.aggregate({
        where: { createdAt: { gte: since }, deletedAt: null, status: { notIn: ['Cancelled'] } },
        _sum: { charge: true, cost: true },
        _count: true,
      }),
      prisma.user.count({ where: { createdAt: { gte: since }, emailVerified: true } }),
      prisma.transaction.aggregate({
        where: { type: 'deposit', status: 'Completed', createdAt: { gte: since } },
        _sum: { amount: true },
        _count: true,
      }),
      prisma.transaction.aggregate({
        where: { type: 'admin_credit', status: 'Completed', createdAt: { gte: since }, amount: { gt: 0 } },
        _sum: { amount: true },
      }),
      prisma.transaction.aggregate({
        where: { type: 'admin_gift', status: 'Completed', createdAt: { gte: since }, amount: { gt: 0 } },
        _sum: { amount: true },
      }),
      prisma.transaction.aggregate({
        where: { type: 'bonus', status: 'Completed', createdAt: { gte: since }, note: { contains: 'Coupon' } },
        _sum: { amount: true },
      }),
      prisma.transaction.aggregate({
        where: { type: 'bonus', status: 'Completed', createdAt: { gte: since }, note: { contains: 'referral' } },
        _sum: { amount: true },
      }),
      prisma.transaction.aggregate({
        where: { type: 'refund', status: 'Completed', createdAt: { gte: since } },
        _sum: { amount: true },
        _count: true,
      }),
      prisma.order.groupBy({
        by: ['status'],
        where: { createdAt: { gte: since }, deletedAt: null },
        _count: true,
        _sum: { charge: true },
      }),
      prisma.order.groupBy({
        by: ['serviceId'],
        where: { createdAt: { gte: since }, deletedAt: null, status: { notIn: ['Cancelled'] } },
        _count: true,
        _sum: { charge: true },
        orderBy: { _count: { serviceId: 'desc' } },
        take: 10,
      }),
      // For platform aggregation — get orders with service category
      prisma.order.findMany({
        where: { createdAt: { gte: since }, deletedAt: null, status: { notIn: ['Cancelled'] } },
        select: { charge: true, service: { select: { category: true } } },
      }),
    ]);

    // Resolve service names
    const serviceIds = topServices.map(s => s.serviceId);
    const serviceNames = await prisma.service.findMany({
      where: { id: { in: serviceIds } },
      select: { id: true, name: true, category: true },
    });
    const nameMap = {};
    serviceNames.forEach(s => { nameMap[s.id] = s; });

    // Aggregate by platform
    const platformMap = {};
    allOrders.forEach(o => {
      const cat = o.service?.category || 'unknown';
      const name = cat.charAt(0).toUpperCase() + cat.slice(1);
      if (!platformMap[name]) platformMap[name] = { name, orders: 0, revenue: 0 };
      platformMap[name].orders++;
      platformMap[name].revenue += (o.charge || 0) / 100;
    });
    const topPlatforms = Object.values(platformMap)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5)
      .map(p => ({ ...p, revenue: Math.round(p.revenue) }));

    const totalRevenue = (ordersAgg._sum.charge || 0) / 100;
    const totalCost = (ordersAgg._sum.cost || 0) / 100;
    const orderCount = ordersAgg._count || 0;
    const avgOrderValue = orderCount > 0 ? totalRevenue / orderCount : 0;
    const completedCount = ordersByStatus.find(s => s.status === 'Completed')?._count || 0;
    const cancelledCount = ordersByStatus.find(s => s.status === 'Cancelled')?._count || 0;
    const conversionRate = orderCount > 0 ? Math.round((completedCount / orderCount) * 100) : 0;

    const totalRefunds = (refundAgg._sum.amount || 0) / 100;
    const totalDeposits = (depositAgg._sum.amount || 0) / 100;
    const totalAdminCredits = (adminCreditAgg._sum.amount || 0) / 100;
    const totalAdminGifts = (adminGiftAgg._sum.amount || 0) / 100;
    const totalCouponBonuses = (couponBonusAgg._sum.amount || 0) / 100;
    const totalReferralBonuses = (referralBonusAgg._sum.amount || 0) / 100;
    const totalMoneyIn = totalDeposits + totalAdminCredits;
    const totalMoneyOut = totalCost + totalRefunds + totalCouponBonuses + totalReferralBonuses + totalAdminGifts;
    const netCashFlow = totalMoneyIn - totalMoneyOut;

    return Response.json({
      range,
      totalRevenue,
      totalCost,
      profit: totalRevenue - totalCost,
      totalRefunds,
      refundCount: refundAgg._count || 0,
      netRevenue: totalRevenue - totalRefunds,
      orderCount,
      avgOrderValue: Math.round(avgOrderValue),
      conversionRate,
      newUsers: userCount,
      totalDeposits,
      totalMoneyIn,
      totalMoneyOut,
      netCashFlow,
      depositCount: depositAgg._count || 0,
      byStatus: ordersByStatus.map(s => ({
        status: s.status,
        count: s._count,
        revenue: (s._sum.charge || 0) / 100,
      })),
      topPlatforms,
      topServices: topServices.map(s => ({
        name: nameMap[s.serviceId]?.name || s.serviceId,
        category: nameMap[s.serviceId]?.category || 'unknown',
        orders: s._count,
        revenue: (s._sum.charge || 0) / 100,
      })),
    });
  } catch (err) {
    log.error('Admin Analytics', err.message);
    return Response.json({ error: 'Failed to load analytics' }, { status: 500 });
  }
}
