import prisma from '@/lib/prisma';
import { log } from "@/lib/logger";
import { requireAdmin } from '@/lib/admin';

export async function GET(req) {
  const { admin, error } = await requireAdmin('finance');
  if (error) return error;

  try {
    const url = new URL(req.url);
    const range = url.searchParams.get('range') || '30d';
    const fromParam = url.searchParams.get('from');
    const toParam = url.searchParams.get('to');

    const now = new Date();
    let since, until;
    if (fromParam) {
      since = new Date(fromParam);
      if (toParam) { until = new Date(toParam); until.setHours(23, 59, 59, 999); }
    } else if (range === '24h') since = new Date(now - 24 * 60 * 60 * 1000);
    else if (range === '7d') since = new Date(now - 7 * 24 * 60 * 60 * 1000);
    else if (range === '90d') since = new Date(now - 90 * 24 * 60 * 60 * 1000);
    else since = new Date(now - 30 * 24 * 60 * 60 * 1000);

    const dateFilter = { gte: since, ...(until && { lte: until }) };

    const [ordersAgg, userCount, depositAgg, adminCreditAgg, adminGiftAgg, couponBonusAgg, referralBonusAgg, refundAgg, ordersByStatus, topServices, allOrders, chartOrders, chartDeposits] = await Promise.all([
      prisma.order.aggregate({
        where: { createdAt: dateFilter, deletedAt: null, status: { notIn: ['Cancelled'] } },
        _sum: { charge: true, cost: true, campaignDiscount: true, loyaltyDiscount: true },
        _count: true,
      }),
      prisma.user.count({ where: { createdAt: dateFilter, emailVerified: true } }),
      prisma.transaction.aggregate({
        where: { type: 'deposit', status: 'Completed', createdAt: dateFilter },
        _sum: { amount: true },
        _count: true,
      }),
      prisma.transaction.aggregate({
        where: { type: 'admin_credit', status: 'Completed', createdAt: dateFilter, amount: { gt: 0 } },
        _sum: { amount: true },
      }),
      prisma.transaction.aggregate({
        where: { type: 'admin_gift', status: 'Completed', createdAt: dateFilter, amount: { gt: 0 } },
        _sum: { amount: true },
      }),
      prisma.transaction.aggregate({
        where: { type: 'bonus', status: 'Completed', createdAt: dateFilter, note: { contains: 'Coupon' } },
        _sum: { amount: true },
      }),
      prisma.transaction.aggregate({
        where: { type: 'bonus', status: 'Completed', createdAt: dateFilter, note: { contains: 'referral' } },
        _sum: { amount: true },
      }),
      prisma.transaction.aggregate({
        where: { type: 'refund', status: 'Completed', createdAt: dateFilter },
        _sum: { amount: true },
        _count: true,
      }),
      prisma.order.groupBy({
        by: ['status'],
        where: { createdAt: dateFilter, deletedAt: null },
        _count: true,
        _sum: { charge: true },
      }),
      prisma.order.groupBy({
        by: ['serviceId'],
        where: { createdAt: dateFilter, deletedAt: null, status: { notIn: ['Cancelled'] } },
        _count: true,
        _sum: { charge: true },
        orderBy: { _sum: { charge: 'desc' } },
        take: 20,
      }),
      // For platform aggregation — get orders with service category
      prisma.order.findMany({
        where: { createdAt: dateFilter, deletedAt: null, status: { notIn: ['Cancelled'] } },
        select: { charge: true, service: { select: { category: true } } },
      }),
      // Chart: daily order counts + revenue
      prisma.order.findMany({
        where: { createdAt: dateFilter, deletedAt: null },
        select: { createdAt: true, charge: true, status: true },
        orderBy: { createdAt: 'asc' },
      }),
      // Chart: daily deposits
      prisma.transaction.findMany({
        where: { type: { in: ['deposit', 'admin_credit'] }, status: 'Completed', createdAt: dateFilter },
        select: { createdAt: true, amount: true },
        orderBy: { createdAt: 'asc' },
      }),
    ]);

    // Resolve service → group names via tiers, fall back to service name
    const serviceIds = topServices.map(s => s.serviceId);
    const [tiers, services] = await Promise.all([
      prisma.serviceTier.findMany({
        where: { serviceId: { in: serviceIds } },
        select: { serviceId: true, group: { select: { name: true, platform: true } } },
      }),
      prisma.service.findMany({
        where: { id: { in: serviceIds } },
        select: { id: true, name: true, category: true },
      }),
    ]);
    const groupMap = {};
    tiers.forEach(t2 => { if (t2.serviceId && !groupMap[t2.serviceId]) groupMap[t2.serviceId] = t2.group; });
    const serviceMap = {};
    services.forEach(s => { serviceMap[s.id] = s; });

    // Aggregate by platform (only real social platforms)
    const PLATFORMS = new Set(['instagram', 'youtube', 'tiktok', 'facebook', 'twitter/x', 'telegram', 'spotify', 'twitch', 'snapchat', 'linkedin', 'threads', 'whatsapp', 'discord', 'pinterest', 'reddit']);
    const platformMap = {};
    allOrders.forEach(o => {
      const cat = (o.service?.category || '').toLowerCase();
      if (!PLATFORMS.has(cat)) return;
      const name = cat === 'twitter/x' ? 'Twitter/X' : cat.charAt(0).toUpperCase() + cat.slice(1);
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
    const totalCampaignDiscounts = (ordersAgg._sum.campaignDiscount || 0) / 100;
    const totalLoyaltyDiscounts = (ordersAgg._sum.loyaltyDiscount || 0) / 100;
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
    const totalMoneyOut = totalCost;
    const totalWalletObligations = totalRefunds + totalCouponBonuses + totalReferralBonuses + totalAdminGifts;
    const netCashFlow = totalMoneyIn - totalMoneyOut;

    // Build daily chart data
    const dayMap = {};
    const toDay = (d) => { const w = new Date(new Date(d).getTime() + 60 * 60 * 1000); return w.toISOString().slice(0, 10); };
    chartOrders.forEach(o => {
      const day = toDay(o.createdAt);
      if (!dayMap[day]) dayMap[day] = { orders: 0, revenue: 0, deposits: 0 };
      dayMap[day].orders++;
      if (o.status !== 'Cancelled') dayMap[day].revenue += (o.charge || 0) / 100;
    });
    chartDeposits.forEach(tx => {
      const day = toDay(tx.createdAt);
      if (!dayMap[day]) dayMap[day] = { orders: 0, revenue: 0, deposits: 0 };
      dayMap[day].deposits += (tx.amount || 0) / 100;
    });
    // Fill in missing days
    const chartData = [];
    const d = new Date(since);
    while (d <= now) {
      const key = toDay(d);
      chartData.push({ date: key, orders: dayMap[key]?.orders || 0, revenue: Math.round(dayMap[key]?.revenue || 0), deposits: Math.round(dayMap[key]?.deposits || 0) });
      d.setDate(d.getDate() + 1);
    }

    return Response.json({
      range,
      totalRevenue,
      totalCost,
      profit: totalRevenue - totalCost,
      totalRefunds,
      refundCount: refundAgg._count || 0,
      netRevenue: totalRevenue,
      orderCount,
      avgOrderValue: Math.round(avgOrderValue),
      conversionRate,
      newUsers: userCount,
      totalDeposits,
      totalMoneyIn,
      totalMoneyOut,
      totalWalletObligations,
      netCashFlow,
      totalCampaignDiscounts,
      totalLoyaltyDiscounts,
      depositCount: depositAgg._count || 0,
      chartData,
      byStatus: ordersByStatus.map(s => ({
        status: s.status,
        count: s._count,
        revenue: (s._sum.charge || 0) / 100,
      })),
      topPlatforms,
      topServices: (() => {
        const grouped = {};
        topServices.forEach(s => {
          const g = groupMap[s.serviceId];
          const svc = serviceMap[s.serviceId];
          const key = g ? g.name : (svc?.name || s.serviceId);
          if (!grouped[key]) grouped[key] = { name: key, category: g?.platform || svc?.category || 'unknown', orders: 0, revenue: 0 };
          grouped[key].orders += s._count;
          grouped[key].revenue += (s._sum.charge || 0) / 100;
        });
        return Object.values(grouped).sort((a, b) => b.revenue - a.revenue).slice(0, 10);
      })(),
    });
  } catch (err) {
    log.error('Admin Analytics', err.message);
    return Response.json({ error: 'Failed to load analytics' }, { status: 500 });
  }
}
