import prisma from '@/lib/prisma';
import { log } from "@/lib/logger";
import { requireAdmin } from '@/lib/admin';

export async function GET(req) {
  const { admin, error } = await requireAdmin('financials');
  if (error) return error;

  try {
    const url = new URL(req.url);
    const range = url.searchParams.get('range') || '30d';
    const platform = url.searchParams.get('platform') || 'all';
    const tier = url.searchParams.get('tier') || 'all';
    const provider = url.searchParams.get('provider') || 'all';

    const now = new Date();
    let since;
    if (range === '24h') since = new Date(now - 24 * 60 * 60 * 1000);
    else if (range === '7d') since = new Date(now - 7 * 24 * 60 * 60 * 1000);
    else if (range === '90d') since = new Date(now - 90 * 24 * 60 * 60 * 1000);
    else if (range === 'month') { since = new Date(now.getFullYear(), now.getMonth(), 1); }
    else if (range === 'lastmonth') { since = new Date(now.getFullYear(), now.getMonth() - 1, 1); }
    else if (range === 'year') { since = new Date(now.getFullYear(), 0, 1); }
    else since = new Date(now - 30 * 24 * 60 * 60 * 1000);

    let rangeEnd = null;
    if (range === 'lastmonth') { rangeEnd = new Date(now.getFullYear(), now.getMonth(), 1); }

    // Build order filters
    const orderWhere = { deletedAt: null, status: { notIn: ['Cancelled'] }, createdAt: { gte: since, ...(rangeEnd ? { lt: rangeEnd } : {}) } };
    if (platform !== 'all') orderWhere.service = { ...orderWhere.service, category: platform };
    if (tier !== 'all') orderWhere.tierName = tier.charAt(0).toUpperCase() + tier.slice(1);
    if (provider !== 'all') orderWhere.service = { ...orderWhere.service, provider: provider };

    const allOrderWhere = { ...orderWhere };
    delete allOrderWhere.status; // For status breakdown include all

    const txWhere = { createdAt: { gte: since, ...(rangeEnd ? { lt: rangeEnd } : {}) } };

    const [
      ordersAgg, cancelledAgg,
      depositsAgg, refundsAgg, referralBonusAgg, couponBonusAgg, adminCreditAgg,
      walletLiability,
      ordersByPlatform, ordersByTier,
      topSpenders,
    ] = await Promise.all([
      // Revenue & cost (excluding cancelled)
      prisma.order.aggregate({ where: orderWhere, _sum: { charge: true, cost: true }, _count: true }),
      // Cancelled orders
      prisma.order.aggregate({ where: { ...orderWhere, status: 'Cancelled' }, _sum: { charge: true }, _count: true }),
      // Money in
      prisma.transaction.aggregate({ where: { ...txWhere, type: 'deposit', status: 'Completed' }, _sum: { amount: true }, _count: true }),
      prisma.transaction.aggregate({ where: { ...txWhere, type: 'refund', status: 'Completed' }, _sum: { amount: true }, _count: true }),
      prisma.transaction.aggregate({ where: { ...txWhere, type: 'bonus', status: 'Completed', note: { contains: 'referral' } }, _sum: { amount: true }, _count: true }),
      prisma.transaction.aggregate({ where: { ...txWhere, type: 'bonus', status: 'Completed', note: { contains: 'Coupon' } }, _sum: { amount: true }, _count: true }),
      prisma.transaction.aggregate({ where: { ...txWhere, type: 'admin_credit', status: 'Completed', amount: { gt: 0 } }, _sum: { amount: true }, _count: true }),
      // Wallet liability (all time)
      prisma.user.aggregate({ where: { status: 'Active', balance: { gt: 0 } }, _sum: { balance: true }, _count: true }),
      // By platform
      prisma.order.findMany({
        where: orderWhere,
        select: { charge: true, cost: true, service: { select: { category: true } } },
      }),
      // By tier
      prisma.order.groupBy({
        by: ['tierName'],
        where: orderWhere,
        _sum: { charge: true, cost: true },
        _count: true,
      }),
      // Top spenders
      prisma.order.groupBy({
        by: ['userId'],
        where: orderWhere,
        _sum: { charge: true },
        _count: true,
        orderBy: { _sum: { charge: 'desc' } },
        take: 10,
      }),
    ]);

    // Resolve top spender names
    const spenderIds = topSpenders.map(s => s.userId);
    const spenderUsers = await prisma.user.findMany({
      where: { id: { in: spenderIds } },
      select: { id: true, name: true, email: true },
    });
    const userMap = {};
    spenderUsers.forEach(u => { userMap[u.id] = u; });

    // Aggregate by platform
    const platformMap = {};
    ordersByPlatform.forEach(o => {
      const cat = o.service?.category || 'unknown';
      const name = cat.charAt(0).toUpperCase() + cat.slice(1);
      if (!platformMap[name]) platformMap[name] = { name, revenue: 0, cost: 0, orders: 0 };
      platformMap[name].orders++;
      platformMap[name].revenue += o.charge || 0;
      platformMap[name].cost += o.cost || 0;
    });
    const byPlatform = Object.values(platformMap)
      .map(p => ({ ...p, profit: p.revenue - p.cost, margin: p.revenue > 0 ? Math.round(((p.revenue - p.cost) / p.revenue) * 100) : 0 }))
      .sort((a, b) => b.profit - a.profit);

    // By tier
    const byTier = ordersByTier
      .filter(t => t.tierName)
      .map(t => ({
        name: t.tierName,
        revenue: t._sum.charge || 0,
        cost: t._sum.cost || 0,
        profit: (t._sum.charge || 0) - (t._sum.cost || 0),
        orders: t._count,
        margin: (t._sum.charge || 0) > 0 ? Math.round((((t._sum.charge || 0) - (t._sum.cost || 0)) / (t._sum.charge || 0)) * 100) : 0,
      }))
      .sort((a, b) => b.profit - a.profit);

    const grossRevenue = ordersAgg._sum.charge || 0;
    const totalCost = ordersAgg._sum.cost || 0;
    const totalRefunds = refundsAgg._sum.amount || 0;
    const netRevenue = grossRevenue - totalRefunds;
    const grossProfit = netRevenue - totalCost;
    const orderCount = ordersAgg._count || 0;
    const refundRate = orderCount > 0 ? Math.round(((cancelledAgg._count || 0) / (orderCount + (cancelledAgg._count || 0))) * 1000) / 10 : 0;

    return Response.json({
      range,
      filters: { platform, tier, provider },
      profitability: {
        grossRevenue, totalRefunds, netRevenue, totalCost, grossProfit,
        margin: netRevenue > 0 ? Math.round((grossProfit / netRevenue) * 1000) / 10 : 0,
        profitPerOrder: orderCount > 0 ? Math.round(grossProfit / orderCount) : 0,
        orderCount, refundRate,
      },
      moneyIn: {
        deposits: depositsAgg._sum.amount || 0,
        couponBonuses: couponBonusAgg._sum.amount || 0,
        adminCredits: adminCreditAgg._sum.amount || 0,
        referralBonuses: referralBonusAgg._sum.amount || 0,
      },
      moneyOut: {
        providerCosts: totalCost,
        refunds: totalRefunds,
        referralBonuses: referralBonusAgg._sum.amount || 0,
      },
      liability: {
        walletBalances: walletLiability._sum.balance || 0,
        walletUsers: walletLiability._count || 0,
      },
      byPlatform: byPlatform.slice(0, 10),
      byTier,
      topSpenders: topSpenders.map(s => ({
        name: userMap[s.userId]?.name || 'Unknown',
        email: userMap[s.userId]?.email || '',
        spent: s._sum.charge || 0,
        orders: s._count,
      })),
    });
  } catch (err) {
    log.error('Admin Financials', err.message);
    return Response.json({ error: 'Failed to load financials', detail: err.message }, { status: 500 });
  }
}
