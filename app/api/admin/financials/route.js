import prisma from '@/lib/prisma';
import { log } from "@/lib/logger";
import { requireAdmin, canSeeSensitive, maskEmail } from '@/lib/admin';
import { watBounds } from '@/lib/format';
import { getOrderOfferDisplay } from '@/lib/order-offer-display';

const ALL_SECTIONS = ['wallet', 'orders', 'points', 'provider', 'affiliate', 'liabilities'];

function csvEscape(value) {
  const s = value == null ? '' : String(value);
  return `"${s.replace(/"/g, '""')}"`;
}

function csvBlock(title, columns, rows) {
  const lines = [`"=== ${title.toUpperCase()} ==="`, columns.map(c => csvEscape(c)).join(',')];
  for (const row of rows) lines.push(columns.map(c => csvEscape(row[c] ?? '')).join(','));
  return lines.join('\n');
}

function isoDate(date) {
  if (!date) return '';
  try { return new Date(date).toISOString(); } catch { return ''; }
}

function n(kobo) {
  return ((Number(kobo) || 0) / 100).toFixed(2);
}

function applyOrderFilters(where, { platform, tier, provider }) {
  if (platform !== 'all') where.service = { ...(where.service || {}), category: platform };
  if (provider !== 'all') where.service = { ...(where.service || {}), provider };
  if (tier !== 'all') where.tier = { is: { tier: tier.charAt(0).toUpperCase() + tier.slice(1) } };
  return where;
}

async function buildFinanceCsvReport({ dateCond, txWhere, filters, range, sections }) {
  const has = (s) => sections.includes(s);
  const orderDateWhere = dateCond ? { createdAt: dateCond } : {};
  const orderWhere = applyOrderFilters({ deletedAt: null, ...orderDateWhere }, filters);
  const commissionRangeWhere = dateCond
    ? { OR: [{ createdAt: dateCond }, { voidedAt: dateCond }] }
    : {};
  const payoutRangeWhere = dateCond
    ? { OR: [{ createdAt: dateCond }, { processedAt: dateCond }] }
    : {};

  const [
    transactions,
    orders,
    pointRows,
    providerTopups,
    commissions,
    payouts,
    walletLiability,
    pointsLiability,
    commissionLiability,
    pendingPayouts,
  ] = await Promise.all([
    has('wallet') ? prisma.transaction.findMany({
      where: txWhere,
      include: { user: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: 'asc' },
    }) : [],
    has('orders') ? prisma.order.findMany({
      where: orderWhere,
      include: {
        user: { select: { id: true, name: true, email: true } },
        service: { select: { name: true, category: true, provider: true, enabled: true } },
        tier: { select: { tier: true, enabled: true, serviceId: true, group: { select: { name: true, platform: true, type: true, enabled: true } } } },
        creditUsages: { select: { amount: true } },
      },
      orderBy: { createdAt: 'asc' },
    }) : [],
    has('points') ? prisma.nitroPointLedger.findMany({
      where: dateCond ? { createdAt: dateCond } : {},
      include: {
        user: { select: { id: true, name: true, email: true } },
        order: { select: { orderId: true } },
        createdByAdmin: { select: { name: true } },
      },
      orderBy: { createdAt: 'asc' },
    }) : [],
    has('provider') ? prisma.providerTopup.findMany({
      where: dateCond ? { createdAt: dateCond } : {},
      orderBy: { createdAt: 'asc' },
    }) : [],
    has('affiliate') ? prisma.affiliateCommission.findMany({
      where: commissionRangeWhere,
      include: {
        order: { select: { orderId: true } },
        member: { select: { id: true, name: true, email: true } },
        lead: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: 'asc' },
    }) : [],
    has('affiliate') ? prisma.affiliatePayout.findMany({
      where: payoutRangeWhere,
      include: { member: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: 'asc' },
    }) : [],
    has('liabilities') ? prisma.user.aggregate({
      where: { status: 'Active', balance: { gt: 0 } },
      _sum: { balance: true },
      _count: true,
    }) : { _sum: { balance: 0 }, _count: 0 },
    has('liabilities') ? prisma.nitroPointLedger.aggregate({ _sum: { pointsKobo: true } }) : { _sum: { pointsKobo: 0 } },
    has('liabilities') ? prisma.affiliateCommission.aggregate({
      where: { status: { in: ['held', 'approved'] } },
      _sum: { marketerAmount: true, leadAmount: true },
      _count: true,
    }) : { _sum: { marketerAmount: 0, leadAmount: 0 }, _count: 0 },
    has('liabilities') ? prisma.affiliatePayout.aggregate({
      where: { status: { in: ['pending', 'processing'] } },
      _sum: { amount: true },
      _count: true,
    }) : { _sum: { amount: 0 }, _count: 0 },
  ]);

  const blocks = [];
  const meta = `Nitro Finance Report | ${range} | Platform: ${filters.platform} | Tier: ${filters.tier} | Provider: ${filters.provider} | Generated: ${new Date().toISOString()}`;
  blocks.push(csvEscape(meta));

  // ── Wallet ──
  if (has('wallet') && transactions.length) {
    const cols = ['date', 'type', 'status', 'user', 'email', 'reference', 'description', 'amount_naira', 'cash_in_naira'];
    const rows = transactions.map(tx => {
      const amount = tx.amount || 0;
      const type = tx.type || 'transaction';
      const isDeposit = type === 'deposit';
      const isOrder = type === 'order';
      const isRefund = type === 'refund';
      return {
        date: isoDate(tx.createdAt),
        type,
        status: tx.status,
        user: tx.user?.name || '',
        email: tx.user?.email || '',
        reference: isOrder || isRefund ? (tx.reference || tx.id) : (tx.reference || tx.id),
        description: tx.note || `${type} transaction`,
        amount_naira: n(amount),
        cash_in_naira: isDeposit && tx.status === 'Completed' ? n(amount) : '',
      };
    });
    blocks.push('', csvBlock('Wallet Transactions', cols, rows));
    const totalIn = transactions.filter(t => t.type === 'deposit' && t.status === 'Completed').reduce((s, t) => s + (t.amount || 0), 0);
    const totalOut = transactions.filter(t => ['order', 'bonus_expired'].includes(t.type) && t.status === 'Completed').reduce((s, t) => s + Math.abs(t.amount || 0), 0);
    blocks.push(`"Total cash in: ${n(totalIn)} | Total wallet debits: ${n(totalOut)} | ${transactions.length} transactions"`);
  }

  // ── Orders ──
  if (has('orders') && orders.length) {
    const cols = ['date', 'orderId', 'status', 'user', 'platform', 'service', 'tier', 'provider', 'revenue_naira', 'cost_naira', 'profit_naira', 'status_discount_naira', 'campaign_discount_naira', 'points_redeemed_naira', 'bonus_used_naira'];
    const rows = orders.map(order => {
      const offer = getOrderOfferDisplay(order);
      const isCancelled = order.status === 'Cancelled';
      const bonusUsed = order.creditUsages.reduce((s, u) => s + (u.amount || 0), 0);
      const rev = isCancelled ? 0 : (order.charge || 0);
      const cost = isCancelled ? 0 : (order.cost || 0);
      return {
        date: isoDate(order.createdAt),
        orderId: order.orderId,
        status: order.status,
        user: order.user?.name || '',
        platform: offer.platform,
        service: offer.serviceName,
        tier: offer.tierLabel || '',
        provider: order.service?.provider || '',
        revenue_naira: n(rev),
        cost_naira: n(cost),
        profit_naira: n(rev - cost),
        status_discount_naira: isCancelled ? '' : n(order.loyaltyDiscount || 0),
        campaign_discount_naira: isCancelled ? '' : n(order.campaignDiscount || 0),
        points_redeemed_naira: isCancelled ? '' : n(order.nitroPointsRedeemedKobo || 0),
        bonus_used_naira: isCancelled || !bonusUsed ? '' : n(bonusUsed),
      };
    });
    blocks.push('', csvBlock('Orders', cols, rows));
    const totalRev = orders.reduce((s, o) => s + (o.status === 'Cancelled' ? 0 : (o.charge || 0)), 0);
    const totalCost = orders.reduce((s, o) => s + (o.status === 'Cancelled' ? 0 : (o.cost || 0)), 0);
    blocks.push(`"Total revenue: ${n(totalRev)} | Total cost: ${n(totalCost)} | Profit: ${n(totalRev - totalCost)} | ${orders.length} orders"`);
  }

  // ── Nitro Points ──
  if (has('points') && pointRows.length) {
    const cols = ['date', 'type', 'user', 'email', 'orderId', 'description', 'points_naira', 'status_at_event'];
    const rows = pointRows.map(p => ({
      date: isoDate(p.createdAt),
      type: p.type,
      user: p.user?.name || '',
      email: p.user?.email || '',
      orderId: p.order?.orderId || '',
      description: p.reason || (p.createdByAdmin?.name ? `Admin: ${p.createdByAdmin.name}` : ''),
      points_naira: n(p.pointsKobo || 0),
      status_at_event: p.statusAtEvent || '',
    }));
    blocks.push('', csvBlock('Nitro Points Ledger', cols, rows));
    const totalPts = pointRows.reduce((s, p) => s + (p.pointsKobo || 0), 0);
    blocks.push(`"Net points movement: ${n(totalPts)} | ${pointRows.length} entries"`);
  }

  // ── Provider Cash ──
  if (has('provider') && providerTopups.length) {
    const cols = ['date', 'provider', 'description', 'amount_naira'];
    const rows = providerTopups.map(t => ({
      date: isoDate(t.createdAt),
      provider: t.provider,
      description: `${t.note || 'Top-up'}${t.adminName ? ` (${t.adminName})` : ''}`,
      amount_naira: n(t.amount || 0),
    }));
    blocks.push('', csvBlock('Provider Top-ups', cols, rows));
    const total = providerTopups.reduce((s, t) => s + (t.amount || 0), 0);
    blocks.push(`"Total provider cash out: ${n(total)} | ${providerTopups.length} top-ups"`);
  }

  // ── Affiliate ──
  if (has('affiliate') && (commissions.length || payouts.length)) {
    if (commissions.length) {
      const cols = ['date', 'event', 'status', 'member', 'member_email', 'orderId', 'marketer_naira', 'lead_naira', 'total_naira'];
      const rows = [];
      for (const c of commissions) {
        const total = (c.marketerAmount || 0) + (c.leadAmount || 0);
        const createdInRange = !dateCond || (c.createdAt && (!dateCond.gte || c.createdAt >= dateCond.gte) && (!dateCond.lte || c.createdAt <= dateCond.lte) && (!dateCond.lt || c.createdAt < dateCond.lt));
        const voidedInRange = c.voidedAt && (!dateCond || ((!dateCond.gte || c.voidedAt >= dateCond.gte) && (!dateCond.lte || c.voidedAt <= dateCond.lte) && (!dateCond.lt || c.voidedAt < dateCond.lt)));
        if (createdInRange) rows.push({ date: isoDate(c.createdAt), event: 'earned', status: c.status, member: c.member?.name || '', member_email: c.member?.email || '', orderId: c.order?.orderId || '', marketer_naira: n(c.marketerAmount || 0), lead_naira: c.leadId ? n(c.leadAmount || 0) : '', total_naira: n(total) });
        if (voidedInRange) rows.push({ date: isoDate(c.voidedAt), event: 'voided', status: c.status, member: c.member?.name || '', member_email: c.member?.email || '', orderId: c.order?.orderId || '', marketer_naira: '', lead_naira: '', total_naira: n(-total) });
      }
      blocks.push('', csvBlock('Affiliate Commissions', cols, rows));
    }
    if (payouts.length) {
      const cols = ['date', 'status', 'member', 'email', 'reference', 'amount_naira'];
      const rows = payouts.map(p => ({
        date: isoDate(p.processedAt || p.createdAt),
        status: p.status,
        member: p.member?.name || '',
        email: p.member?.email || '',
        reference: p.reference || p.id,
        amount_naira: n(p.amount || 0),
      }));
      blocks.push('', csvBlock('Affiliate Payouts', cols, rows));
    }
  }

  // ── Liabilities snapshot ──
  if (has('liabilities')) {
    const cols = ['liability', 'count', 'amount_naira'];
    const rows = [
      { liability: 'User wallet balances', count: walletLiability._count || 0, amount_naira: n(walletLiability._sum.balance || 0) },
      { liability: 'Outstanding Nitro Points', count: '', amount_naira: n(pointsLiability._sum.pointsKobo || 0) },
      { liability: 'Unpaid affiliate commissions (held/approved)', count: commissionLiability._count || 0, amount_naira: n((commissionLiability._sum.marketerAmount || 0) + (commissionLiability._sum.leadAmount || 0)) },
      { liability: 'Pending/processing affiliate payouts', count: pendingPayouts._count || 0, amount_naira: n(pendingPayouts._sum.amount || 0) },
    ];
    blocks.push('', csvBlock('Ending Liability Snapshot', cols, rows));
  }

  return blocks.join('\n');
}

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
    } else if (range === 'all') { since = null; }
    else if (range === '24h') since = new Date(now - 24 * 60 * 60 * 1000);
    else if (range === '7d') since = new Date(now - 7 * 24 * 60 * 60 * 1000);
    else if (range === '90d') since = new Date(now - 90 * 24 * 60 * 60 * 1000);
    else if (range === 'month') { since = monthStart; }
    else if (range === 'lastmonth') { const watNow = new Date(now.getTime() + 60 * 60 * 1000); since = new Date(Date.UTC(watNow.getUTCFullYear(), watNow.getUTCMonth() - 1, 1) - 60 * 60 * 1000); rangeEnd = monthStart; }
    else if (range === 'year') { const watNow = new Date(now.getTime() + 60 * 60 * 1000); since = new Date(Date.UTC(watNow.getUTCFullYear(), 0, 1) - 60 * 60 * 1000); }
    else since = new Date(now - 30 * 24 * 60 * 60 * 1000);

    // Build order filters
    const rangeEndOp = fromParam ? 'lte' : 'lt';
    const dateCond = since ? { gte: since, ...(rangeEnd ? { [rangeEndOp]: rangeEnd } : {}) } : undefined;
    const orderWhere = applyOrderFilters(
      { deletedAt: null, status: { notIn: ['Cancelled'] }, ...(dateCond && { createdAt: dateCond }) },
      { platform, tier, provider },
    );

    const allOrderWhere = { ...orderWhere };
    delete allOrderWhere.status; // For status breakdown include all

    const txWhere = dateCond ? { createdAt: dateCond } : {};

    if (url.searchParams.get('export') === 'csv') {
      if (!canSeeSensitive(admin)) {
        return Response.json({ error: 'Full finance export is restricted to owner and superadmin' }, { status: 403 });
      }
      const secParam = url.searchParams.get('sections');
      const sections = secParam ? secParam.split(',').filter(s => ALL_SECTIONS.includes(s)) : ALL_SECTIONS;
      const csv = await buildFinanceCsvReport({
        dateCond,
        txWhere,
        range,
        filters: { platform, tier, provider },
        sections,
      });
      const stamp = new Date().toISOString().slice(0, 10);
      return new Response(csv, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="nitro-finance-report-${stamp}.csv"`,
          'Cache-Control': 'no-store',
        },
      });
    }

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
        where: dateCond ? { createdAt: dateCond } : {},
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
      .map(p => ({ ...p, profit: p.revenue - p.cost, margin: p.cost > 0 ? Math.round(((p.revenue - p.cost) / p.cost) * 100) : 0 }))
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
      .map(t => ({ ...t, profit: t.revenue - t.cost, margin: t.cost > 0 ? Math.round(((t.revenue - t.cost) / t.cost) * 100) : 0 }))
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

    const sensitive = canSeeSensitive(admin);

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
        ...(sensitive ? {
          totalCost: k(totalCost),
          grossProfit: k(grossProfit),
          margin: totalCost > 0 ? Math.round((grossProfit / totalCost) * 1000) / 10 : 0,
          profitPerOrder: orderCount > 0 ? k(Math.round(grossProfit / orderCount)) : 0,
        } : {}),
        orderCount, refundRate,
      },
      moneyIn: {
        deposits: k(depositsAgg._sum.amount),
        adminCredits: k(adminCreditAgg._sum.amount),
      },
      ...(sensitive ? {
        moneyOut: {
          providerCosts: k(totalCost),
          providerTopups: k(providerTopupAgg._sum.amount),
        },
      } : {}),
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
      byPlatform: byPlatform.map(p => ({ name: p.name, revenue: k(p.revenue), orders: p.orders, ...(sensitive ? { cost: k(p.cost), profit: k(p.profit), margin: p.margin } : {}) })).slice(0, 10),
      byTier: byTier.map(t => ({ name: t.name, revenue: k(t.revenue), orders: t.orders, ...(sensitive ? { cost: k(t.cost), profit: k(t.profit), margin: t.margin } : {}) })),
      topSpenders: topSpenders.map(s => {
        return {
          name: userMap[s.userId]?.name || 'Unknown',
          email: sensitive ? (userMap[s.userId]?.email || '') : maskEmail(userMap[s.userId]?.email),
          spent: k((s._sum.charge || 0) - (partialSpenderAdj[s.userId] || 0)),
          orders: s._count,
        };
      }),
    });
  } catch (err) {
    log.error('Admin Financials', err.message);
    return Response.json({ error: 'Failed to load financials' }, { status: 500 });
  }
}
