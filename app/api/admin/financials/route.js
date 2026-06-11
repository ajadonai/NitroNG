import prisma from '@/lib/prisma';
import { log } from "@/lib/logger";
import { requireAdmin } from '@/lib/admin';
import { watBounds } from '@/lib/format';

export async function GET(req) {
  const { admin, error } = await requireAdmin('financials');
  if (error) return error;

  try {
    const url = new URL(req.url);
    const range = url.searchParams.get('range') || '30d';
    const fromParam = url.searchParams.get('from');
    const toParam = url.searchParams.get('to');
    const platform = url.searchParams.get('platform') || 'all';
    const tier = url.searchParams.get('tier') || 'all';
    const provider = url.searchParams.get('provider') || 'all';

    const now = new Date();
    const { monthStart } = watBounds();
    let since, rangeEnd = null;
    if (fromParam) {
      since = new Date(fromParam);
      if (toParam) { rangeEnd = new Date(toParam); rangeEnd.setHours(23, 59, 59, 999); }
    } else if (range === '24h') since = new Date(now - 24 * 60 * 60 * 1000);
    else if (range === '7d') since = new Date(now - 7 * 24 * 60 * 60 * 1000);
    else if (range === '90d') since = new Date(now - 90 * 24 * 60 * 60 * 1000);
    else if (range === 'month') { since = monthStart; }
    else if (range === 'lastmonth') { const watNow = new Date(now.getTime() + 60 * 60 * 1000); since = new Date(Date.UTC(watNow.getUTCFullYear(), watNow.getUTCMonth() - 1, 1) - 60 * 60 * 1000); rangeEnd = monthStart; }
    else if (range === 'year') { const watNow = new Date(now.getTime() + 60 * 60 * 1000); since = new Date(Date.UTC(watNow.getUTCFullYear(), 0, 1) - 60 * 60 * 1000); }
    else since = new Date(now - 30 * 24 * 60 * 60 * 1000);

    // Build order filters
    const rangeEndOp = fromParam ? 'lte' : 'lt';
    const orderWhere = { deletedAt: null, status: { notIn: ['Cancelled'] }, createdAt: { gte: since, ...(rangeEnd ? { [rangeEndOp]: rangeEnd } : {}) } };
    if (platform !== 'all') orderWhere.service = { ...orderWhere.service, category: platform };
    if (tier !== 'all') orderWhere.tierName = tier.charAt(0).toUpperCase() + tier.slice(1);
    if (provider !== 'all') orderWhere.service = { ...orderWhere.service, provider: provider };

    const allOrderWhere = { ...orderWhere };
    delete allOrderWhere.status; // For status breakdown include all

    const txWhere = { createdAt: { gte: since, ...(rangeEnd ? { [rangeEndOp]: rangeEnd } : {}) } };

    const [
      ordersAgg, cancelledAgg,
      depositsAgg, refundsAgg, referralBonusAgg, couponBonusAgg, adminCreditAgg, adminGiftAgg,
      walletLiability,
      ordersByPlatform, ordersByTier,
      topSpenders,
      partialOrders,
      providerTopupAgg,
    ] = await Promise.all([
      // Revenue & cost (excluding cancelled)
      prisma.order.aggregate({ where: orderWhere, _sum: { charge: true, cost: true, campaignDiscount: true, loyaltyDiscount: true }, _count: true }),
      // Cancelled orders
      prisma.order.aggregate({ where: { ...orderWhere, status: 'Cancelled' }, _sum: { charge: true }, _count: true }),
      // Money in/out
      prisma.transaction.aggregate({ where: { ...txWhere, type: 'deposit', status: 'Completed' }, _sum: { amount: true }, _count: true }),
      prisma.transaction.aggregate({ where: { ...txWhere, type: 'refund', status: 'Completed' }, _sum: { amount: true }, _count: true }),
      prisma.transaction.aggregate({ where: { ...txWhere, type: 'bonus', status: 'Completed', note: { contains: 'referral' } }, _sum: { amount: true }, _count: true }),
      prisma.transaction.aggregate({ where: { ...txWhere, type: 'bonus', status: 'Completed', note: { contains: 'Coupon' } }, _sum: { amount: true }, _count: true }),
      prisma.transaction.aggregate({ where: { ...txWhere, type: 'admin_credit', status: 'Completed', amount: { gt: 0 } }, _sum: { amount: true }, _count: true }),
      prisma.transaction.aggregate({ where: { ...txWhere, type: 'admin_gift', status: 'Completed', amount: { gt: 0 } }, _sum: { amount: true }, _count: true }),
      // Wallet liability (all time)
      prisma.user.aggregate({ where: { status: 'Active', balance: { gt: 0 } }, _sum: { balance: true }, _count: true }),
      // By platform
      prisma.order.findMany({
        where: orderWhere,
        select: { charge: true, cost: true, quantity: true, remains: true, status: true, service: { select: { category: true } } },
      }),
      // By tier (can't groupBy relation field, so fetch and aggregate in JS)
      prisma.order.findMany({
        where: orderWhere,
        select: { charge: true, cost: true, quantity: true, remains: true, status: true, tier: { select: { tier: true } } },
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
      // Partial orders for adjustment
      prisma.order.findMany({
        where: { ...orderWhere, status: 'Partial', remains: { gt: 0 }, quantity: { gt: 0 } },
        select: { charge: true, cost: true, quantity: true, remains: true, userId: true },
      }),
      // Provider top-ups (actual cash out)
      prisma.providerTopup.aggregate({
        where: { createdAt: { gte: since, ...(rangeEnd ? { [rangeEndOp]: rangeEnd } : {}) } },
        _sum: { amount: true },
      }),
    ]);

    // Compute partial order adjustments — subtract the undelivered portion
    let partialChargeAdj = 0, partialCostAdj = 0;
    const partialSpenderAdj = {};
    for (const p of partialOrders) {
      const undeliveredRatio = p.remains / p.quantity;
      const chargeAdj = Math.round(p.charge * undeliveredRatio);
      const costAdj = Math.round((p.cost || 0) * undeliveredRatio);
      partialChargeAdj += chargeAdj;
      partialCostAdj += costAdj;
      if (p.userId) partialSpenderAdj[p.userId] = (partialSpenderAdj[p.userId] || 0) + chargeAdj;
    }

    // Resolve top spender names
    const spenderIds = topSpenders.map(s => s.userId);
    const spenderUsers = await prisma.user.findMany({
      where: { id: { in: spenderIds } },
      select: { id: true, name: true, email: true },
    });
    const userMap = {};
    spenderUsers.forEach(u => { userMap[u.id] = u; });

    // Helper: get effective charge/cost for an order (adjusts for partial delivery)
    function effectiveAmounts(o) {
      if (o.status === 'Partial' && o.remains > 0 && o.quantity > 0) {
        const ratio = (o.quantity - o.remains) / o.quantity;
        return { charge: Math.round((o.charge || 0) * ratio), cost: Math.round((o.cost || 0) * ratio) };
      }
      return { charge: o.charge || 0, cost: o.cost || 0 };
    }

    // Aggregate by platform
    const platformMap = {};
    ordersByPlatform.forEach(o => {
      const cat = o.service?.category || 'unknown';
      const name = cat.charAt(0).toUpperCase() + cat.slice(1);
      if (!platformMap[name]) platformMap[name] = { name, revenue: 0, cost: 0, orders: 0 };
      const eff = effectiveAmounts(o);
      platformMap[name].orders++;
      platformMap[name].revenue += eff.charge;
      platformMap[name].cost += eff.cost;
    });
    const byPlatform = Object.values(platformMap)
      .map(p => ({ ...p, profit: p.revenue - p.cost, margin: p.revenue > 0 ? Math.round(((p.revenue - p.cost) / p.revenue) * 100) : 0 }))
      .sort((a, b) => b.profit - a.profit);

    // By tier — aggregate from raw orders
    const tierMap = {};
    ordersByTier.forEach(o => {
      const name = o.tier?.tier || "Unknown";
      if (!tierMap[name]) tierMap[name] = { name, revenue: 0, cost: 0, orders: 0 };
      const eff = effectiveAmounts(o);
      tierMap[name].orders++;
      tierMap[name].revenue += eff.charge;
      tierMap[name].cost += eff.cost;
    });
    const byTier = Object.values(tierMap)
      .map(t => ({ ...t, profit: t.revenue - t.cost, margin: t.revenue > 0 ? Math.round(((t.revenue - t.cost) / t.revenue) * 100) : 0 }))
      .sort((a, b) => b.profit - a.profit);

    const chargeTotal = (ordersAgg._sum.charge || 0) - partialChargeAdj;
    const totalCost = (ordersAgg._sum.cost || 0) - partialCostAdj;
    const totalRefunds = refundsAgg._sum.amount || 0;
    const totalCampaignDiscounts = ordersAgg._sum.campaignDiscount || 0;
    const totalLoyaltyDiscounts = ordersAgg._sum.loyaltyDiscount || 0;
    const totalDiscounts = totalCampaignDiscounts + totalLoyaltyDiscounts;
    const grossRevenue = chargeTotal + totalDiscounts;
    const netRevenue = chargeTotal;
    const grossProfit = netRevenue - totalCost;
    const orderCount = ordersAgg._count || 0;
    const refundRate = orderCount > 0 ? Math.round(((cancelledAgg._count || 0) / (orderCount + (cancelledAgg._count || 0))) * 1000) / 10 : 0;

    const k = (v) => Math.round((v || 0) / 100); // kobo to naira

    return Response.json({
      range,
      filters: { platform, tier, provider },
      profitability: {
        grossRevenue: k(grossRevenue),
        promoDiscounts: k(totalCampaignDiscounts),
        loyaltyDiscounts: k(totalLoyaltyDiscounts),
        totalDiscounts: k(totalDiscounts),
        netRevenue: k(netRevenue),
        totalRefunds: k(totalRefunds),
        totalCost: k(totalCost),
        grossProfit: k(grossProfit),
        margin: netRevenue > 0 ? Math.round((grossProfit / netRevenue) * 1000) / 10 : 0,
        profitPerOrder: orderCount > 0 ? k(Math.round(grossProfit / orderCount)) : 0,
        orderCount, refundRate,
      },
      moneyIn: {
        deposits: k(depositsAgg._sum.amount),
        adminCredits: k(adminCreditAgg._sum.amount),
      },
      moneyOut: {
        providerCosts: k(totalCost),
        providerTopups: k(providerTopupAgg._sum.amount),
      },
      walletObligations: {
        refunds: k(totalRefunds),
        couponBonuses: k(couponBonusAgg._sum.amount),
        referralBonuses: k(referralBonusAgg._sum.amount),
        adminGifts: k(adminGiftAgg._sum.amount),
      },
      liability: {
        walletBalances: k(walletLiability._sum.balance),
        walletUsers: walletLiability._count || 0,
      },
      byPlatform: byPlatform.map(p => ({ ...p, revenue: k(p.revenue), cost: k(p.cost), profit: k(p.profit) })).slice(0, 10),
      byTier: byTier.map(t => ({ ...t, revenue: k(t.revenue), cost: k(t.cost), profit: k(t.profit) })),
      topSpenders: topSpenders.map(s => ({
        name: userMap[s.userId]?.name || 'Unknown',
        email: userMap[s.userId]?.email || '',
        spent: k((s._sum.charge || 0) - (partialSpenderAdj[s.userId] || 0)),
        orders: s._count,
      })),
    });
  } catch (err) {
    log.error('Admin Financials', err.message);
    return Response.json({ error: 'Failed to load financials' }, { status: 500 });
  }
}
