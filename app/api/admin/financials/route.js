import prisma from '@/lib/prisma';
import { log } from "@/lib/logger";
import { requireAdmin, canSeeSensitive, maskEmail } from '@/lib/admin';
import { watBounds } from '@/lib/format';

const KOBO_TO_NAIRA_COLUMNS = {
  cashInKobo: 'cashInNaira',
  cashOutKobo: 'cashOutNaira',
  walletDeltaKobo: 'walletDeltaNaira',
  orderRevenueKobo: 'orderRevenueNaira',
  providerCostKobo: 'providerCostNaira',
  statusDiscountKobo: 'statusDiscountNaira',
  campaignDiscountKobo: 'campaignDiscountNaira',
  pointsDeltaKobo: 'pointsDeltaNaira',
  pointsRedeemedKobo: 'pointsRedeemedNaira',
  bonusCreditDeltaKobo: 'bonusCreditDeltaNaira',
  affiliateDeltaKobo: 'affiliateDeltaNaira',
};

const REPORT_COLUMNS = [
  'section',
  'date',
  'eventType',
  'status',
  'reference',
  'userId',
  'userName',
  'userEmail',
  'orderId',
  'description',
  'count',
  'cashInKobo',
  'cashInNaira',
  'cashOutKobo',
  'cashOutNaira',
  'walletDeltaKobo',
  'walletDeltaNaira',
  'orderRevenueKobo',
  'orderRevenueNaira',
  'providerCostKobo',
  'providerCostNaira',
  'statusDiscountKobo',
  'statusDiscountNaira',
  'campaignDiscountKobo',
  'campaignDiscountNaira',
  'pointsDeltaKobo',
  'pointsDeltaNaira',
  'pointsRedeemedKobo',
  'pointsRedeemedNaira',
  'bonusCreditDeltaKobo',
  'bonusCreditDeltaNaira',
  'affiliateDeltaKobo',
  'affiliateDeltaNaira',
  'nairaValue',
];

function csvEscape(value) {
  const s = value == null ? '' : String(value);
  return `"${s.replace(/"/g, '""')}"`;
}

function csvFromRows(rows) {
  return [
    REPORT_COLUMNS.join(','),
    ...rows.map((row) => REPORT_COLUMNS.map((col) => csvEscape(row[col] ?? '')).join(',')),
  ].join('\n');
}

function isoDate(date) {
  if (!date) return '';
  try { return new Date(date).toISOString(); } catch { return ''; }
}

function naira(kobo) {
  return ((Number(kobo) || 0) / 100).toFixed(2);
}

function reportRow(row) {
  const numericFields = [
    'count',
    ...Object.keys(KOBO_TO_NAIRA_COLUMNS),
  ];
  const out = Object.fromEntries(REPORT_COLUMNS.map((c) => [c, '']));
  Object.assign(out, row);
  for (const field of numericFields) out[field] = Number(out[field] || 0);
  for (const [koboColumn, nairaColumn] of Object.entries(KOBO_TO_NAIRA_COLUMNS)) {
    out[nairaColumn] = row[nairaColumn] ?? naira(out[koboColumn]);
  }
  const main =
    out.cashInKobo ||
    out.cashOutKobo ||
    out.walletDeltaKobo ||
    out.orderRevenueKobo ||
    out.providerCostKobo ||
    out.statusDiscountKobo ||
    out.campaignDiscountKobo ||
    out.pointsDeltaKobo ||
    out.pointsRedeemedKobo ||
    out.bonusCreditDeltaKobo ||
    out.affiliateDeltaKobo ||
    0;
  out.nairaValue = row.nairaValue ?? naira(main);
  return out;
}

function sumRows(rows, key) {
  return rows.reduce((sum, row) => sum + Number(row[key] || 0), 0);
}

function applyOrderFilters(where, { platform, tier, provider }) {
  if (platform !== 'all') where.service = { ...(where.service || {}), category: platform };
  if (provider !== 'all') where.service = { ...(where.service || {}), provider };
  if (tier !== 'all') where.tier = { is: { tier: tier.charAt(0).toUpperCase() + tier.slice(1) } };
  return where;
}

async function buildFinanceCsvReport({ dateCond, txWhere, filters, range }) {
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
    prisma.transaction.findMany({
      where: txWhere,
      include: { user: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.order.findMany({
      where: orderWhere,
      include: {
        user: { select: { id: true, name: true, email: true } },
        service: { select: { name: true, category: true, provider: true } },
        tier: { select: { tier: true } },
        creditUsages: { select: { amount: true } },
      },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.nitroPointLedger.findMany({
      where: dateCond ? { createdAt: dateCond } : {},
      include: {
        user: { select: { id: true, name: true, email: true } },
        order: { select: { orderId: true } },
        createdByAdmin: { select: { name: true } },
      },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.providerTopup.findMany({
      where: dateCond ? { createdAt: dateCond } : {},
      orderBy: { createdAt: 'asc' },
    }),
    prisma.affiliateCommission.findMany({
      where: commissionRangeWhere,
      include: {
        order: { select: { orderId: true } },
        member: { select: { id: true, name: true, email: true } },
        lead: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.affiliatePayout.findMany({
      where: payoutRangeWhere,
      include: { member: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.user.aggregate({
      where: { status: 'Active', balance: { gt: 0 } },
      _sum: { balance: true },
      _count: true,
    }),
    prisma.nitroPointLedger.aggregate({ _sum: { pointsKobo: true } }),
    prisma.affiliateCommission.aggregate({
      where: { status: { in: ['held', 'approved'] } },
      _sum: { marketerAmount: true, leadAmount: true },
      _count: true,
    }),
    prisma.affiliatePayout.aggregate({
      where: { status: { in: ['pending', 'processing'] } },
      _sum: { amount: true },
      _count: true,
    }),
  ]);

  const rows = [];
  const add = (row) => rows.push(reportRow(row));

  add({
    section: 'metadata',
    eventType: 'report_scope',
    description: `Finance report. Range=${range}; Platform=${filters.platform}; Tier=${filters.tier}; Provider=${filters.provider}`,
  });

  for (const tx of transactions) {
    const amount = tx.amount || 0;
    const type = tx.type || 'transaction';
    const isDeposit = type === 'deposit';
    const isOrder = type === 'order';
    const isRefund = type === 'refund';
    const walletDelta = ['deposit', 'refund', 'bonus', 'bonus_expired', 'referral', 'admin_credit', 'admin_gift', 'order'].includes(type)
      ? amount
      : 0;
    add({
      section: 'wallet_transactions',
      date: isoDate(tx.createdAt),
      eventType: type,
      status: tx.status,
      reference: tx.reference || tx.id,
      userId: tx.userId,
      userName: tx.user?.name || '',
      userEmail: tx.user?.email || '',
      orderId: isOrder || isRefund ? (tx.reference || '') : '',
      description: tx.note || `${type} transaction`,
      count: 1,
      cashInKobo: isDeposit && tx.status === 'Completed' ? amount : 0,
      walletDeltaKobo: tx.status === 'Completed' ? walletDelta : 0,
    });
  }

  for (const order of orders) {
    const isCancelled = order.status === 'Cancelled';
    const bonusUsed = order.creditUsages.reduce((sum, usage) => sum + (usage.amount || 0), 0);
    const grossBeforeDiscount = (order.charge || 0) + (order.loyaltyDiscount || 0) + (order.campaignDiscount || 0);
    add({
      section: 'orders',
      date: isoDate(order.createdAt),
      eventType: 'order_created',
      status: order.status,
      reference: order.batchId || order.orderId,
      userId: order.userId,
      userName: order.user?.name || '',
      userEmail: order.user?.email || '',
      orderId: order.orderId,
      description: `${order.service?.category || 'service'} / ${order.service?.name || 'Unknown'} / ${order.tier?.tier || 'Untiered'} / gross before discount ₦${naira(grossBeforeDiscount)}`,
      count: 1,
      orderRevenueKobo: isCancelled ? 0 : (order.charge || 0),
      providerCostKobo: isCancelled ? 0 : (order.cost || 0),
      statusDiscountKobo: isCancelled ? 0 : (order.loyaltyDiscount || 0),
      campaignDiscountKobo: isCancelled ? 0 : (order.campaignDiscount || 0),
      pointsRedeemedKobo: isCancelled ? 0 : (order.nitroPointsRedeemedKobo || 0),
      bonusCreditDeltaKobo: isCancelled || !bonusUsed ? 0 : -bonusUsed,
    });
  }

  for (const p of pointRows) {
    add({
      section: 'nitro_points',
      date: isoDate(p.createdAt),
      eventType: p.type,
      status: p.statusAtEvent || '',
      reference: p.dedupeKey || p.id,
      userId: p.userId,
      userName: p.user?.name || '',
      userEmail: p.user?.email || '',
      orderId: p.order?.orderId || '',
      description: p.reason || (p.createdByAdmin?.name ? `Admin adjustment by ${p.createdByAdmin.name}` : 'Nitro Points ledger event'),
      count: 1,
      pointsDeltaKobo: p.pointsKobo || 0,
    });
  }

  for (const topup of providerTopups) {
    add({
      section: 'provider_cash',
      date: isoDate(topup.createdAt),
      eventType: 'provider_topup',
      status: 'Completed',
      reference: topup.id,
      description: `${topup.provider}${topup.note ? ` — ${topup.note}` : ''}${topup.adminName ? ` (${topup.adminName})` : ''}`,
      count: 1,
      cashOutKobo: topup.amount || 0,
    });
  }

  for (const c of commissions) {
    const total = (c.marketerAmount || 0) + (c.leadAmount || 0);
    const createdInRange = !dateCond || (c.createdAt && (!dateCond.gte || c.createdAt >= dateCond.gte) && (!dateCond.lte || c.createdAt <= dateCond.lte) && (!dateCond.lt || c.createdAt < dateCond.lt));
    const voidedInRange = c.voidedAt && (!dateCond || ((!dateCond.gte || c.voidedAt >= dateCond.gte) && (!dateCond.lte || c.voidedAt <= dateCond.lte) && (!dateCond.lt || c.voidedAt < dateCond.lt)));
    if (createdInRange) {
      add({
        section: 'affiliate_commissions',
        date: isoDate(c.createdAt),
        eventType: 'commission_created',
        status: c.status,
        reference: c.id,
        userId: c.memberId,
        userName: c.member?.name || '',
        userEmail: c.member?.email || '',
        orderId: c.order?.orderId || '',
        description: `Marketer ₦${naira(c.marketerAmount)}${c.leadId ? `, lead ₦${naira(c.leadAmount)}` : ''}`,
        count: 1,
        affiliateDeltaKobo: total,
      });
    }
    if (voidedInRange) {
      add({
        section: 'affiliate_commissions',
        date: isoDate(c.voidedAt),
        eventType: 'commission_voided',
        status: c.status,
        reference: c.id,
        userId: c.memberId,
        userName: c.member?.name || '',
        userEmail: c.member?.email || '',
        orderId: c.order?.orderId || '',
        description: c.voidReason || 'Commission voided',
        count: 1,
        affiliateDeltaKobo: -total,
      });
    }
  }

  for (const p of payouts) {
    const completed = p.status === 'completed';
    add({
      section: 'affiliate_payouts',
      date: isoDate(p.processedAt || p.createdAt),
      eventType: completed ? 'payout_completed' : `payout_${p.status}`,
      status: p.status,
      reference: p.reference || p.id,
      userId: p.memberId,
      userName: p.member?.name || '',
      userEmail: p.member?.email || '',
      description: completed ? 'Affiliate payout paid out' : 'Affiliate payout state change',
      count: 1,
      cashOutKobo: completed ? (p.amount || 0) : 0,
      affiliateDeltaKobo: completed ? -(p.amount || 0) : 0,
    });
  }

  const summaryRows = [
    ['total_cash_in', 'cashInKobo'],
    ['total_cash_out', 'cashOutKobo'],
    ['net_wallet_movement', 'walletDeltaKobo'],
    ['order_revenue', 'orderRevenueKobo'],
    ['provider_cost', 'providerCostKobo'],
    ['status_discounts', 'statusDiscountKobo'],
    ['campaign_discounts', 'campaignDiscountKobo'],
    ['points_liability_movement', 'pointsDeltaKobo'],
    ['points_redeemed_at_checkout', 'pointsRedeemedKobo'],
    ['bonus_credit_consumed', 'bonusCreditDeltaKobo'],
    ['affiliate_liability_movement', 'affiliateDeltaKobo'],
  ];
  rows.unshift(...summaryRows.map(([label, key]) => reportRow({
    section: 'summary',
    eventType: label,
    description: `Sum of ${key} for detailed rows in this export`,
    [key]: sumRows(rows, key),
  })));

  rows.unshift(reportRow({
    section: 'ending_liability_snapshot',
    eventType: 'affiliate_pending_payouts',
    count: pendingPayouts._count || 0,
    description: 'Pending/processing affiliate payouts as of report generation',
    affiliateDeltaKobo: pendingPayouts._sum.amount || 0,
  }));
  rows.unshift(reportRow({
    section: 'ending_liability_snapshot',
    eventType: 'affiliate_commissions_unpaid',
    count: commissionLiability._count || 0,
    description: 'Held/approved affiliate commissions as of report generation',
    affiliateDeltaKobo: (commissionLiability._sum.marketerAmount || 0) + (commissionLiability._sum.leadAmount || 0),
  }));
  rows.unshift(reportRow({
    section: 'ending_liability_snapshot',
    eventType: 'points_outstanding',
    description: 'Outstanding Nitro Points liability as of report generation',
    pointsDeltaKobo: pointsLiability._sum.pointsKobo || 0,
  }));
  rows.unshift(reportRow({
    section: 'ending_liability_snapshot',
    eventType: 'wallet_balances',
    count: walletLiability._count || 0,
    description: 'Active user wallet balances as of report generation',
    walletDeltaKobo: walletLiability._sum.balance || 0,
  }));

  return csvFromRows(rows);
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
      const csv = await buildFinanceCsvReport({
        dateCond,
        txWhere,
        range,
        filters: { platform, tier, provider },
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
