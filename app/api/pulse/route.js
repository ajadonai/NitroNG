import prisma from '@/lib/prisma';
import { refundReasonText } from '@/lib/refund-reasons';
import { log } from '@/lib/logger';
import { watBounds } from '@/lib/format';
import { getOrderOfferDisplay } from '@/lib/order-offer-display';
import {
  internalDashboardAccessError,
  renewInternalDashboardGrant,
  requireInternalDashboardAccess,
  withInternalDashboardNoStore,
} from '@/lib/internal-dashboard-access';
import {
  rateLimit,
  rateLimitUnavailable,
  tooManyRequests,
} from '@/lib/rate-limit';
import { getRevenue } from '@/lib/revenue';
import { DEAD_ORDER_STATES, MONEY_IN, partialAdjustment as partialAdj } from '@/lib/ledger';

export const dynamic = 'force-dynamic';

export async function GET(req) {
  let limit;
  try {
    limit = await rateLimit(req, { maxAttempts: 8, windowMs: 60_000 });
  } catch {
    return withInternalDashboardNoStore(rateLimitUnavailable());
  }
  if (limit.unavailable) {
    return withInternalDashboardNoStore(rateLimitUnavailable(undefined, limit.retryAfter));
  }
  if (limit.limited) {
    return withInternalDashboardNoStore(tooManyRequests(
      'Too many Pulse requests. Please try again shortly.',
      limit.retryAfter,
    ));
  }

  let access;
  try {
    access = await requireInternalDashboardAccess();
  } catch (err) {
    log.error('Pulse Access', err.message);
    return withInternalDashboardNoStore(Response.json(
      { error: 'Internal dashboard access is temporarily unavailable' },
      { status: 503 },
    ));
  }
  if (!access.ok) return internalDashboardAccessError(access);

  try {
    const { now, todayStart, yesterdayStart, monthStart } = watBounds();
    const thirtyDaysAgo = new Date(now - 30 * 24 * 60 * 60 * 1000);

    const [
      totalUsers, newUsersToday,
      todayRevenueAgg, todayOrderCount, todayDepositsAgg,
      yesterdayRevenueAgg, yesterdayDepositsAgg, yesterdayOrderCount,
      processingCount,
      monthRevenueAgg, monthOrderCount, monthDepositsAgg, monthNewUsers,
      todayCostAgg, yesterdayCostAgg,
      ordersByStatus,
      allOrdersForPlatforms,
      chartOrders, chartDeposits, chartUsers,
      recentOrders, recentDeposits,
      recentRefunds,
      monthOrdererIds,
      monthRepeatResult,
      idleUsers,
      payoutRows,
      recentPayouts,
      partialToday, partialYesterday, partialMonth,
      welcomeBonusResult,
      monthDepositorsResult,
      refundsTodayAgg,
    ] = await Promise.all([
      prisma.user.count({ where: { status: { not: 'Deleted' } } }),
      prisma.user.count({ where: { createdAt: { gte: todayStart }, status: { not: 'Deleted' } } }),
      prisma.order.aggregate({ where: { createdAt: { gte: todayStart }, deletedAt: null, status: { notIn: DEAD_ORDER_STATES } }, _sum: { charge: true } }),
      prisma.order.count({ where: { createdAt: { gte: todayStart }, deletedAt: null } }),
      prisma.transaction.aggregate({ where: { type: { in: MONEY_IN }, status: 'Completed', createdAt: { gte: todayStart } }, _sum: { amount: true } }),
      prisma.order.aggregate({ where: { createdAt: { gte: yesterdayStart, lt: todayStart }, deletedAt: null, status: { notIn: DEAD_ORDER_STATES } }, _sum: { charge: true } }),
      prisma.transaction.aggregate({ where: { type: { in: MONEY_IN }, status: 'Completed', createdAt: { gte: yesterdayStart, lt: todayStart } }, _sum: { amount: true } }),
      prisma.order.count({ where: { createdAt: { gte: yesterdayStart, lt: todayStart }, deletedAt: null } }),
      prisma.order.count({ where: { status: 'Processing', deletedAt: null } }),
      prisma.order.aggregate({ where: { createdAt: { gte: monthStart }, deletedAt: null, status: { notIn: DEAD_ORDER_STATES } }, _sum: { charge: true } }),
      prisma.order.count({ where: { createdAt: { gte: monthStart }, deletedAt: null } }),
      prisma.transaction.aggregate({ where: { type: { in: MONEY_IN }, status: 'Completed', createdAt: { gte: monthStart } }, _sum: { amount: true } }),
      prisma.user.count({ where: { createdAt: { gte: monthStart }, emailVerified: true } }),
      prisma.order.aggregate({ where: { createdAt: { gte: todayStart }, deletedAt: null, status: { notIn: DEAD_ORDER_STATES } }, _sum: { cost: true } }),
      prisma.order.aggregate({ where: { createdAt: { gte: yesterdayStart, lt: todayStart }, deletedAt: null, status: { notIn: DEAD_ORDER_STATES } }, _sum: { cost: true } }),
      prisma.order.groupBy({ by: ['status'], where: { createdAt: { gte: thirtyDaysAgo }, deletedAt: null }, _count: true }),
      prisma.order.findMany({
        where: { createdAt: { gte: thirtyDaysAgo }, deletedAt: null, status: { notIn: DEAD_ORDER_STATES } },
        select: { charge: true, status: true, quantity: true, remains: true, platformAtPurchase: true, service: { select: { category: true } } },
      }),
      prisma.order.findMany({
        where: { createdAt: { gte: thirtyDaysAgo }, deletedAt: null },
        select: { createdAt: true, charge: true, cost: true, status: true, quantity: true, remains: true },
        orderBy: { createdAt: 'asc' },
      }),
      prisma.transaction.findMany({
        where: { type: { in: MONEY_IN }, status: 'Completed', createdAt: { gte: thirtyDaysAgo } },
        select: { createdAt: true, amount: true },
        orderBy: { createdAt: 'asc' },
      }),
      prisma.user.findMany({
        where: { createdAt: { gte: thirtyDaysAgo }, emailVerified: true },
        select: { createdAt: true },
        orderBy: { createdAt: 'asc' },
      }),
      prisma.order.findMany({
        where: { deletedAt: null },
        orderBy: { createdAt: 'desc' },
        take: 15,
        include: {
          user: { select: { name: true, email: true } },
          service: { select: { name: true, category: true, enabled: true } },
          tier: {
            select: {
              tier: true,
              enabled: true,
              serviceId: true,
              group: { select: { name: true, platform: true, type: true, enabled: true } },
            },
          },
        },
      }),
      // The Money in feed, and it is rendered under exactly that heading with a
      // "+" against each row — so it takes MONEY_IN like the totals above it.
      // Leaving it on WALLET_FUNDING put every gift in the list even after the
      // figure stopped counting them, which is the more visible half of the
      // same mistake: one gift, sitting in Money in, named.
      prisma.transaction.findMany({
        where: { type: { in: MONEY_IN }, status: 'Completed' },
        orderBy: { createdAt: 'desc' },
        take: 15,
        include: { user: { select: { name: true, email: true } } },
      }),
      prisma.order.findMany({
        where: { refundedAt: { not: null }, deletedAt: null },
        orderBy: { refundedAt: 'desc' },
        take: 15,
        include: {
          user: { select: { name: true, email: true } },
          service: { select: { name: true, category: true, enabled: true } },
          tier: {
            select: {
              tier: true,
              enabled: true,
              serviceId: true,
              group: { select: { name: true, platform: true, type: true, enabled: true } },
            },
          },
        },
      }),
      prisma.order.findMany({
        where: { createdAt: { gte: monthStart }, deletedAt: null },
        select: { userId: true },
        distinct: ['userId'],
      }),
      prisma.$queryRaw`
        SELECT COUNT(DISTINCT o."userId")::int AS count
        FROM orders o
        WHERE o."createdAt" >= ${monthStart} AND o."deletedAt" IS NULL
          AND EXISTS (
            SELECT 1 FROM orders p
            WHERE p."userId" = o."userId" AND p."createdAt" < ${monthStart} AND p."deletedAt" IS NULL
          )
      `,
      prisma.user.count({
        where: { emailVerified: true, balance: { gt: 0 }, orders: { none: { createdAt: { gte: thirtyDaysAgo }, deletedAt: null } } },
      }),
      // Payouts: month-to-date (single query instead of 6)
      prisma.$queryRaw`
        SELECT
          CASE
            WHEN type = 'bonus' AND note ILIKE '%Coupon%' THEN 'coupons'
            WHEN type = 'bonus' AND note ILIKE '%Leaderboard%' THEN 'leaderboard'
            WHEN type = 'admin_gift' THEN 'gifts'
            WHEN type = 'referral' THEN 'referrals'
            WHEN type = 'game_reward' THEN 'gameRewards'
            WHEN type = 'video_reward' THEN 'videoRewards'
          END AS category,
          COALESCE(SUM(amount), 0)::int AS total
        FROM transactions
        WHERE status = 'Completed' AND "createdAt" >= ${monthStart}
          AND (type IN ('admin_gift', 'referral', 'game_reward', 'video_reward')
            OR (type = 'bonus' AND (note ILIKE '%Coupon%' OR note ILIKE '%Leaderboard%')))
        GROUP BY category
      `,
      // Recent payouts feed
      prisma.transaction.findMany({
        where: { type: { in: ['admin_gift', 'referral', 'bonus', 'game_reward', 'video_reward'] }, status: 'Completed' },
        orderBy: { createdAt: 'desc' },
        take: 10,
        include: { user: { select: { name: true, email: true } } },
      }),
      // Partial order adjustments
      prisma.order.findMany({ where: { createdAt: { gte: todayStart }, deletedAt: null, status: 'Partial', remains: { gt: 0 }, quantity: { gt: 0 } }, select: { charge: true, cost: true, quantity: true, remains: true } }),
      prisma.order.findMany({ where: { createdAt: { gte: yesterdayStart, lt: todayStart }, deletedAt: null, status: 'Partial', remains: { gt: 0 }, quantity: { gt: 0 } }, select: { charge: true, cost: true, quantity: true, remains: true } }),
      prisma.order.findMany({ where: { createdAt: { gte: monthStart }, deletedAt: null, status: 'Partial', remains: { gt: 0 }, quantity: { gt: 0 } }, select: { charge: true, cost: true, quantity: true, remains: true } }),
      prisma.$queryRaw`
        SELECT COUNT(*)::int AS count, COALESCE(SUM(amount), 0)::int AS total
        FROM transactions
        WHERE status = 'Completed' AND "createdAt" >= ${monthStart}
          AND type = 'bonus' AND note ILIKE '%Welcome bonus%'
      `,
      prisma.$queryRaw`
        SELECT COUNT(DISTINCT "userId")::int AS count
        FROM transactions
        WHERE type IN ('deposit', 'admin_credit', 'admin_gift') AND status = 'Completed' AND "createdAt" >= ${monthStart}
      `,
      // The Refunds header counts today, as Money in does, rather than summing
      // whichever fifteen rows happen to be listed.
      prisma.transaction.aggregate({ where: { type: 'refund', status: 'Completed', createdAt: { gte: todayStart } }, _sum: { amount: true }, _count: true }),
    ]);

    const pctChange = (today, yesterday) => {
      if (yesterday === 0) return today > 0 ? null : 0;
      return Math.round(((today - yesterday) / yesterday) * 100);
    };

    // Partial adjustment helper
    const effCharge = (o) => {
      if (o.status === 'Partial' && o.remains > 0 && o.quantity > 0)
        return Math.round(o.charge * (o.quantity - o.remains) / o.quantity);
      return o.charge || 0;
    };
    const effCost = (o) => {
      if (o.status === 'Partial' && o.remains > 0 && o.quantity > 0)
        return Math.round((o.cost || 0) * (o.quantity - o.remains) / o.quantity);
      return o.cost || 0;
    };
    const adjToday = partialAdj(partialToday);
    const adjYesterday = partialAdj(partialYesterday);
    const adjMonth = partialAdj(partialMonth);

    const todayRevenue = ((todayRevenueAgg._sum.charge || 0) - adjToday.charge) / 100;
    const yesterdayRevenue = ((yesterdayRevenueAgg._sum.charge || 0) - adjYesterday.charge) / 100;
    const todayDeposits = (todayDepositsAgg._sum.amount || 0) / 100;
    const yesterdayDeposits = (yesterdayDepositsAgg._sum.amount || 0) / 100;

    // Platform aggregation (only real social platforms)
    const PLATFORM_NAME = { twitter: 'Twitter/X', 'twitter/x': 'Twitter/X', tiktok: 'TikTok', youtube: 'YouTube', linkedin: 'LinkedIn', whatsapp: 'WhatsApp', soundcloud: 'SoundCloud' };
    const PLATFORMS = new Set(['twitter', 'instagram', 'youtube', 'tiktok', 'facebook', 'twitter/x', 'telegram', 'spotify', 'twitch', 'snapchat', 'linkedin', 'threads', 'whatsapp', 'discord', 'pinterest', 'reddit']);
    const platformMap = {};
    allOrdersForPlatforms.forEach(o => {
      const cat = (o.platformAtPurchase || o.service?.category || '').toLowerCase();
      if (!PLATFORMS.has(cat)) return;
      // Orders store 'twitter', which the set used to miss, so X never counted.
      const name = PLATFORM_NAME[cat] || cat.charAt(0).toUpperCase() + cat.slice(1);
      if (!platformMap[name]) platformMap[name] = { name, orders: 0, revenue: 0 };
      platformMap[name].orders++;
      platformMap[name].revenue += effCharge(o) / 100;
    });
    const topPlatforms = Object.values(platformMap)
      .sort((a, b) => b.orders - a.orders)
      .slice(0, 5)
      .map(p => ({ ...p, revenue: Math.round(p.revenue) }));

    // Chart data — 30 days (bucket by WAT date, not UTC)
    const toDay = (d) => { const w = new Date(new Date(d).getTime() + 60 * 60 * 1000); return w.toISOString().slice(0, 10); };
    const dayMap = {};
    chartOrders.forEach(o => {
      const day = toDay(o.createdAt);
      if (!dayMap[day]) dayMap[day] = { orders: 0, revenue: 0, profit: 0, depositsKobo: 0, newUsers: 0 };
      dayMap[day].orders++;
      if (!DEAD_ORDER_STATES.includes(o.status)) {
        dayMap[day].revenue += effCharge(o) / 100;
        dayMap[day].profit += (effCharge(o) - effCost(o)) / 100;
      }
    });
    chartDeposits.forEach(tx => {
      const day = toDay(tx.createdAt);
      if (!dayMap[day]) dayMap[day] = { orders: 0, revenue: 0, profit: 0, depositsKobo: 0, newUsers: 0 };
      dayMap[day].depositsKobo += (tx.amount || 0);
    });
    chartUsers.forEach(u => {
      const day = toDay(u.createdAt);
      if (!dayMap[day]) dayMap[day] = { orders: 0, revenue: 0, profit: 0, depositsKobo: 0, newUsers: 0 };
      dayMap[day].newUsers++;
    });

    // Today, hour by hour in WAT, midnight to now: the lines under Pulse's figures.
    const toHour = (d) => new Date(new Date(d).getTime() + 60 * 60 * 1000).getUTCHours();
    const nowHour = toHour(now);
    const todayHours = Array.from({ length: nowHour + 1 }, (_, hour) => ({ hour, orders: 0, revenue: 0, profit: 0, deposits: 0, newUsers: 0 }));
    const inToday = (d) => new Date(d) >= todayStart;
    chartOrders.forEach(o => {
      if (!inToday(o.createdAt)) return;
      const h = todayHours[Math.min(toHour(o.createdAt), nowHour)];
      h.orders++;
      if (!DEAD_ORDER_STATES.includes(o.status)) { h.revenue += effCharge(o) / 100; h.profit += (effCharge(o) - effCost(o)) / 100; }
    });
    chartDeposits.forEach(tx => { if (inToday(tx.createdAt)) todayHours[Math.min(toHour(tx.createdAt), nowHour)].deposits += (tx.amount || 0) / 100; });
    chartUsers.forEach(u => { if (inToday(u.createdAt)) todayHours[Math.min(toHour(u.createdAt), nowHour)].newUsers++; });
    todayHours.forEach(h => { h.revenue = Math.round(h.revenue); h.profit = Math.round(h.profit); h.deposits = Math.round(h.deposits); });
    const newUsersYesterday = await prisma.user.count({ where: { createdAt: { gte: yesterdayStart, lt: todayStart } } });

    const todayKey = toDay(now);
    const chartData = [];
    const d = new Date(thirtyDaysAgo);
    while (d <= now) {
      const key = toDay(d);
      chartData.push({
        date: key,
        orders: dayMap[key]?.orders || 0,
        revenue: Math.round(dayMap[key]?.revenue || 0),
        profit: Math.round(dayMap[key]?.profit || 0),
        deposits: key === todayKey ? todayDeposits : Math.round((dayMap[key]?.depositsKobo || 0) / 100),
        newUsers: dayMap[key]?.newUsers || 0,
      });
      d.setDate(d.getDate() + 1);
    }

    // Refunds are the biggest leak in the book and were never on the screen.
    const monthRefundAgg = await prisma.transaction.aggregate({
      where: { type: 'refund', status: 'Completed', createdAt: { gte: monthStart } },
      _sum: { amount: true }, _count: true,
    });

    const monthRevenueNet = await getRevenue({ from: monthStart });

    // ── The upgraded screen (17 Oct 2026) ──────────────────────────────────
    // Pace: yesterday hour by hour, and yesterday up to this time of day, so a
    // half day is compared with a half day. Built from the 30-day arrays above,
    // with the same partial and dead-order rules as today's figures.
    const yCut = new Date(now.getTime() - 86400000);
    const yesterdayHours = Array.from({ length: 24 }, () => 0);
    const ySoFar = { revenue: 0, profit: 0, orders: 0, deposits: 0 };
    chartOrders.forEach(o => {
      const t = new Date(o.createdAt);
      if (t < yesterdayStart || t >= todayStart) return;
      const live = !DEAD_ORDER_STATES.includes(o.status);
      if (live) yesterdayHours[toHour(t)] += effCharge(o) / 100;
      if (t < yCut) { ySoFar.orders++; if (live) { ySoFar.revenue += effCharge(o) / 100; ySoFar.profit += (effCharge(o) - effCost(o)) / 100; } }
    });
    chartDeposits.forEach(tx => { const t = new Date(tx.createdAt); if (t >= yesterdayStart && t < yCut) ySoFar.deposits += (tx.amount || 0) / 100; });

    const lagosNow = new Date(now.getTime() + 3600e3);
    const lmStart = new Date(Date.UTC(lagosNow.getUTCFullYear(), lagosNow.getUTCMonth() - 1, 1) - 3600e3);
    // The same point in last month, clamped when last month was shorter.
    const lmCut = new Date(Math.min(lmStart.getTime() + (now - monthStart), monthStart.getTime()));

    const [newUsersYesterdaySoFar, runningRows, waitingTransfers, refillsWaiting, balancesSetting, todayOrders, recentSignups, lmToDate, lmFull, lmOrders, lmDeposits, lmNewUsers] = await Promise.all([
      prisma.user.count({ where: { createdAt: { gte: yesterdayStart, lt: yCut }, status: { not: 'Deleted' } } }),
      prisma.order.findMany({ where: { status: { in: ['Pending', 'Dispatching', 'Processing'] }, deletedAt: null }, select: { orderId: true, status: true, createdAt: true, dripDays: true } }),
      // A transfer the customer says they sent: what the Approve button in Telegram is for.
      prisma.transaction.aggregate({ where: { type: 'deposit', method: 'manual', status: 'Pending', note: { contains: '[user_confirmed' } }, _count: true, _sum: { amount: true } }),
      prisma.order.count({ where: { refillRequestedAt: { not: null }, refillHandledAt: null, deletedAt: null } }),
      prisma.setting.findUnique({ where: { key: 'provider_balances' } }),
      prisma.order.findMany({
        where: { createdAt: { gte: todayStart }, deletedAt: null },
        include: {
          service: { select: { name: true, category: true, enabled: true } },
          tier: { select: { tier: true, enabled: true, serviceId: true, group: { select: { name: true, platform: true, type: true, enabled: true } } } },
        },
      }),
      prisma.user.findMany({ where: { createdAt: { gte: todayStart }, status: { not: 'Deleted' } }, orderBy: { createdAt: 'desc' }, take: 10, select: { id: true, name: true, email: true, createdAt: true, referredBy: true } }),
      getRevenue({ from: lmStart, to: lmCut }),
      getRevenue({ from: lmStart, to: monthStart }),
      prisma.order.count({ where: { createdAt: { gte: lmStart, lt: lmCut }, deletedAt: null } }),
      prisma.transaction.aggregate({ where: { type: { in: MONEY_IN }, status: 'Completed', createdAt: { gte: lmStart, lt: lmCut } }, _sum: { amount: true } }),
      prisma.user.count({ where: { createdAt: { gte: lmStart, lt: lmCut }, emailVerified: true } }),
    ]);

    // Still running. Drip orders run for days on purpose, so they are counted
    // apart and kept out of the ages, or every one would read as stuck.
    const running = { pending: 0, processing: 0, drip: 0, ages: [0, 0, 0, 0], oldest: null };
    for (const o of runningRows) {
      if (o.status === 'Processing') running.processing++; else running.pending++;
      if (o.dripDays) { running.drip++; continue; }
      const mins = Math.max(0, Math.round((now - o.createdAt) / 60000));
      running.ages[mins < 60 ? 0 : mins < 180 ? 1 : mins < 360 ? 2 : 3]++;
      if (!running.oldest || mins > running.oldest.minutes) running.oldest = { id: o.orderId, minutes: mins };
    }

    // The lowest supplier balance from the daily check, without naming whose.
    let lowestBalance = null;
    try {
      const b = JSON.parse(balancesSetting?.value || '{}');
      const vals = Object.values(b).map(v => v?.balance).filter(v => typeof v === 'number');
      if (vals.length) lowestBalance = { usd: Math.min(...vals), checkedAt: b.checkedAt || null };
    } catch {}

    // Selling today, by the name the customer bought.
    const sold = {}, platToday = {};
    for (const o of todayOrders) {
      const offer = getOrderOfferDisplay(o);
      const key = offer.serviceName;
      if (!sold[key]) sold[key] = { name: key, platform: offer.platform, orders: 0, revenue: 0 };
      sold[key].orders++;
      if (!DEAD_ORDER_STATES.includes(o.status)) sold[key].revenue += effCharge(o) / 100;
      const pk = String(offer.platform || '').toLowerCase();
      const pn = PLATFORM_NAME[pk] || (pk ? pk.charAt(0).toUpperCase() + pk.slice(1) : 'Other');
      platToday[pn] = (platToday[pn] || 0) + 1;
    }
    const sellingToday = Object.values(sold).sort((a, b) => b.orders - a.orders || b.revenue - a.revenue).slice(0, 6).map(r => ({ ...r, revenue: Math.round(r.revenue) }));
    const platformsToday = Object.entries(platToday).map(([name, orders]) => ({ name, orders })).sort((a, b) => b.orders - a.orders);

    const res = withInternalDashboardNoStore(Response.json({
      totalUsers,
      newUsersToday,
      revenueToday: todayRevenue,
      ordersToday: todayOrderCount,
      depositsToday: todayDeposits,
      processing: processingCount,
      revenueChange: pctChange(todayRevenue, yesterdayRevenue),
      depositsChange: pctChange(todayDeposits, yesterdayDeposits),
      ordersChange: pctChange(todayOrderCount, yesterdayOrderCount),
      profitToday: todayRevenue - ((todayCostAgg._sum.cost || 0) - adjToday.cost) / 100,
      costToday: ((todayCostAgg._sum.cost || 0) - adjToday.cost) / 100,
      profitChange: pctChange(
        todayRevenue - ((todayCostAgg._sum.cost || 0) - adjToday.cost) / 100,
        yesterdayRevenue - ((yesterdayCostAgg._sum.cost || 0) - adjYesterday.cost) / 100
      ),
      monthRevenue: ((monthRevenueAgg._sum.charge || 0) - adjMonth.charge) / 100,
      // Cost and profit stopped at the raw aggregate, which is what /stats on
      // Telegram caught: it goes through getRevenue() and counts costWasted —
      // money already spent on orders that died after the provider had them —
      // which this never did. monthNetRevenue a few lines down had already
      // moved to getRevenue(); cost and profit were the half of that move
      // that never finished, so the two surfaces disagreed by exactly the
      // month's wasted spend.
      monthCost: monthRevenueNet.cost + monthRevenueNet.costWasted,
      monthProfit: monthRevenueNet.net - monthRevenueNet.cost - monthRevenueNet.costWasted,
      monthOrders: monthOrderCount,
      monthDeposits: (monthDepositsAgg._sum.amount || 0) / 100,
      monthNewUsers,
      monthActiveUsers: monthOrdererIds.length,
      monthRepeatUsers: monthRepeatResult[0]?.count || 0,
      idleUsersWithBalance: idleUsers,
      chartData,
      todayHours,
      nowHour,
      newUsersYesterday,
      topPlatforms,
      byStatus: ordersByStatus.map(s => ({ status: s.status, count: s._count })),
      recentOrders: recentOrders.map(o => {
        const offer = getOrderOfferDisplay(o);
        return {
          id: o.orderId || o.id,
          service: offer.serviceName,
          tier: offer.tierLabel,
          platform: offer.platform,
          user: o.user?.name || o.user?.email || 'Unknown',
          charge: (o.charge || 0) / 100,
          status: o.status,
          cancelReason: o.status === 'Cancelled' ? refundReasonText(o.lastError) : null,
          // API orders get a badge on the Live list.
          source: o.source === 'api' ? 'api' : null,
          created: o.createdAt.toISOString(),
        };
      }),
      recentRefunds: await (async () => {
        const refOrderIds = recentRefunds.map(o => o.orderId || o.id);
        const refTotals = refOrderIds.length > 0
          ? await prisma.transaction.groupBy({ by: ['reference'], where: { type: 'refund', status: 'Completed', reference: { in: refOrderIds.flatMap(id => [`REF-${id}`, `ADM-REF-${id}`]) } }, _sum: { amount: true } })
          : [];
        const refMap = {};
        for (const r of refTotals) { const oid = r.reference.replace(/^(ADM-)?REF-/, ''); refMap[oid] = (refMap[oid] || 0) + (r._sum.amount || 0); }
        return recentRefunds.map(o => {
          const oid = o.orderId || o.id;
          const offer = getOrderOfferDisplay(o);
          return {
            id: oid,
            service: offer.serviceName,
            tier: offer.tierLabel,
            platform: offer.platform,
            user: o.user?.name || o.user?.email || 'Unknown',
            charge: (o.charge || 0) / 100,
            refunded: (refMap[oid] || 0) / 100,
            status: o.status,
            quantity: o.quantity,
            remains: o.remains || 0,
            reason: refundReasonText(o.lastError),
            refundedAt: o.refundedAt.toISOString(),
          };
        });
      })(),
      recentDeposits: recentDeposits.map(tx => ({
        id: tx.id,
        user: tx.user?.name || tx.user?.email || 'Unknown',
        amount: (tx.amount || 0) / 100,
        method: tx.method || 'wallet',
        created: tx.createdAt.toISOString(),
      })),
      monthPayouts: (() => {
        const pm = Object.fromEntries((payoutRows || []).map(r => [r.category, Number(r.total) / 100]));
        return { gifts: pm.gifts || 0, referrals: pm.referrals || 0, coupons: pm.coupons || 0, leaderboard: pm.leaderboard || 0, gameRewards: pm.gameRewards || 0, videoRewards: pm.videoRewards || 0 };
      })(),
      recentPayouts: recentPayouts.map(tx => ({
        id: tx.id,
        type: tx.type === 'bonus' ? ((tx.note || '').includes('Leaderboard') ? 'leaderboard' : 'coupon') : tx.type,
        amount: (tx.amount || 0) / 100,
        note: tx.note || '',
        reference: tx.reference || '',
        created: tx.createdAt.toISOString(),
      })),
      welcomeBonus: { count: welcomeBonusResult[0]?.count || 0, total: (welcomeBonusResult[0]?.total || 0) / 100 },
      monthDepositors: monthDepositorsResult[0]?.count || 0,
      monthRefunds: monthRevenueNet.refunds,
      refundsToday: { count: refundsTodayAgg._count || 0, total: (refundsTodayAgg._sum.amount || 0) / 100 },
      monthGrossRevenue: monthRevenueNet.gross,
      monthNetRevenue: monthRevenueNet.net,
      monthNetMargin: monthRevenueNet.netMargin,
      monthRefundCount: monthRefundAgg._count || 0,
      nowMinute: lagosNow.getUTCMinutes(),
      pace: {
        yesterdayHours: yesterdayHours.map(v => Math.round(v)),
        yesterdayTotal: yesterdayRevenue,
        soFar: { revenue: Math.round(ySoFar.revenue), profit: Math.round(ySoFar.profit), orders: ySoFar.orders, deposits: Math.round(ySoFar.deposits), newUsers: newUsersYesterdaySoFar },
      },
      running,
      attention: {
        transfers: { count: waitingTransfers._count || 0, total: (waitingTransfers._sum.amount || 0) / 100 },
        refills: refillsWaiting,
        balance: lowestBalance,
      },
      sellingToday,
      platformsToday,
      recentSignups: recentSignups.map(u => ({ id: u.id, user: u.name || u.email || 'Unknown', referredBy: u.referredBy || null, created: u.createdAt.toISOString() })),
      lastMonth: {
        start: lmStart.toISOString(),
        revenueToDate: lmToDate.net,
        revenueFull: lmFull.net,
        profitToDate: lmToDate.net - lmToDate.cost - lmToDate.costWasted,
        ordersToDate: lmOrders,
        depositsToDate: (lmDeposits._sum.amount || 0) / 100,
        newUsersToDate: lmNewUsers,
      },
      generatedAt: now.toISOString(),
    }));
    renewInternalDashboardGrant(access, res);
    return res;
  } catch (err) {
    log.error('Pulse API', err.message);
    return withInternalDashboardNoStore(Response.json({ error: 'Failed to load pulse data' }, { status: 500 }));
  }
}
