import { timingSafeEqual } from 'crypto';
import prisma from '@/lib/prisma';
import { log } from '@/lib/logger';
import { watBounds } from '@/lib/format';

async function validateKey(req) {
  const key = new URL(req.url).searchParams.get('key');
  if (!key) return false;
  const row = await prisma.setting.findUnique({ where: { key: 'pulse_secret_key' } });
  if (!row?.value) return false;
  try {
    const a = Buffer.from(key);
    const b = Buffer.from(row.value);
    return a.length === b.length && timingSafeEqual(a, b);
  } catch { return false; }
}

export async function GET(req) {
  if (!(await validateKey(req))) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { now, todayStart, yesterdayStart, monthStart } = watBounds();
    const thirtyDaysAgo = new Date(now - 30 * 24 * 60 * 60 * 1000);

    const [
      totalUsers, newUsersToday,
      todayRevenueAgg, todayOrderCount, todayDepositsAgg,
      yesterdayRevenueAgg, yesterdayDepositsAgg, yesterdayOrderCount,
      processingCount,
      monthRevenueAgg, monthOrderCount, monthDepositsAgg, monthNewUsers,
      monthCostAgg,
      todayCostAgg, yesterdayCostAgg,
      ordersByStatus,
      allOrdersForPlatforms,
      chartOrders, chartDeposits, chartUsers,
      recentOrders, recentDeposits,
      monthOrdererIds,
      monthRepeatResult,
      idleUsers,
      payoutRows,
      recentPayouts,
      partialToday, partialYesterday, partialMonth,
      welcomeBonusResult,
      monthDepositorsResult,
    ] = await Promise.all([
      prisma.user.count({ where: { emailVerified: true } }),
      prisma.user.count({ where: { createdAt: { gte: todayStart }, emailVerified: true } }),
      prisma.order.aggregate({ where: { createdAt: { gte: todayStart }, deletedAt: null, status: { notIn: ['Cancelled'] } }, _sum: { charge: true } }),
      prisma.order.count({ where: { createdAt: { gte: todayStart }, deletedAt: null } }),
      prisma.transaction.aggregate({ where: { type: { in: ['deposit', 'admin_credit'] }, status: 'Completed', createdAt: { gte: todayStart } }, _sum: { amount: true } }),
      prisma.order.aggregate({ where: { createdAt: { gte: yesterdayStart, lt: todayStart }, deletedAt: null, status: { notIn: ['Cancelled'] } }, _sum: { charge: true } }),
      prisma.transaction.aggregate({ where: { type: { in: ['deposit', 'admin_credit'] }, status: 'Completed', createdAt: { gte: yesterdayStart, lt: todayStart } }, _sum: { amount: true } }),
      prisma.order.count({ where: { createdAt: { gte: yesterdayStart, lt: todayStart }, deletedAt: null } }),
      prisma.order.count({ where: { status: 'Processing', deletedAt: null } }),
      prisma.order.aggregate({ where: { createdAt: { gte: monthStart }, deletedAt: null, status: { notIn: ['Cancelled'] } }, _sum: { charge: true } }),
      prisma.order.count({ where: { createdAt: { gte: monthStart }, deletedAt: null } }),
      prisma.transaction.aggregate({ where: { type: { in: ['deposit', 'admin_credit'] }, status: 'Completed', createdAt: { gte: monthStart } }, _sum: { amount: true } }),
      prisma.user.count({ where: { createdAt: { gte: monthStart }, emailVerified: true } }),
      prisma.order.aggregate({ where: { createdAt: { gte: monthStart }, deletedAt: null, status: { notIn: ['Cancelled'] } }, _sum: { cost: true } }),
      prisma.order.aggregate({ where: { createdAt: { gte: todayStart }, deletedAt: null, status: { notIn: ['Cancelled'] } }, _sum: { cost: true } }),
      prisma.order.aggregate({ where: { createdAt: { gte: yesterdayStart, lt: todayStart }, deletedAt: null, status: { notIn: ['Cancelled'] } }, _sum: { cost: true } }),
      prisma.order.groupBy({ by: ['status'], where: { createdAt: { gte: thirtyDaysAgo }, deletedAt: null }, _count: true }),
      prisma.order.findMany({
        where: { createdAt: { gte: thirtyDaysAgo }, deletedAt: null, status: { notIn: ['Cancelled'] } },
        select: { charge: true, status: true, quantity: true, remains: true, service: { select: { category: true } } },
      }),
      prisma.order.findMany({
        where: { createdAt: { gte: thirtyDaysAgo }, deletedAt: null },
        select: { createdAt: true, charge: true, cost: true, status: true, quantity: true, remains: true },
        orderBy: { createdAt: 'asc' },
      }),
      prisma.transaction.findMany({
        where: { type: { in: ['deposit', 'admin_credit'] }, status: 'Completed', createdAt: { gte: thirtyDaysAgo } },
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
          service: { select: { name: true, category: true } },
          tier: { select: { tier: true, group: { select: { name: true } } } },
        },
      }),
      prisma.transaction.findMany({
        where: { type: { in: ['deposit', 'admin_credit'] }, status: 'Completed' },
        orderBy: { createdAt: 'desc' },
        take: 15,
        include: { user: { select: { name: true, email: true } } },
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
        WHERE type IN ('deposit', 'admin_credit') AND status = 'Completed' AND "createdAt" >= ${monthStart}
      `,
    ]);

    const pctChange = (today, yesterday) => {
      if (yesterday === 0) return today > 0 ? null : 0;
      return Math.round(((today - yesterday) / yesterday) * 100);
    };

    // Partial adjustment helper
    const partialAdj = (orders) => {
      let charge = 0, cost = 0;
      for (const p of orders) {
        const ratio = p.remains / p.quantity;
        charge += Math.round(p.charge * ratio);
        cost += Math.round((p.cost || 0) * ratio);
      }
      return { charge, cost };
    };
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
    const PLATFORMS = new Set(['instagram', 'youtube', 'tiktok', 'facebook', 'twitter/x', 'telegram', 'spotify', 'twitch', 'snapchat', 'linkedin', 'threads', 'whatsapp', 'discord', 'pinterest', 'reddit']);
    const platformMap = {};
    allOrdersForPlatforms.forEach(o => {
      const cat = (o.service?.category || '').toLowerCase();
      if (!PLATFORMS.has(cat)) return;
      const name = cat === 'twitter/x' ? 'Twitter/X' : cat.charAt(0).toUpperCase() + cat.slice(1);
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
      if (o.status !== 'Cancelled') {
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

    return Response.json({
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
      profitChange: pctChange(
        todayRevenue - ((todayCostAgg._sum.cost || 0) - adjToday.cost) / 100,
        yesterdayRevenue - ((yesterdayCostAgg._sum.cost || 0) - adjYesterday.cost) / 100
      ),
      monthRevenue: ((monthRevenueAgg._sum.charge || 0) - adjMonth.charge) / 100,
      monthCost: ((monthCostAgg._sum.cost || 0) - adjMonth.cost) / 100,
      monthProfit: (((monthRevenueAgg._sum.charge || 0) - adjMonth.charge) - ((monthCostAgg._sum.cost || 0) - adjMonth.cost)) / 100,
      monthOrders: monthOrderCount,
      monthDeposits: (monthDepositsAgg._sum.amount || 0) / 100,
      monthNewUsers,
      monthActiveUsers: monthOrdererIds.length,
      monthRepeatUsers: monthRepeatResult[0]?.count || 0,
      idleUsersWithBalance: idleUsers,
      chartData,
      topPlatforms,
      byStatus: ordersByStatus.map(s => ({ status: s.status, count: s._count })),
      recentOrders: recentOrders.map(o => ({
        id: o.orderId || o.id,
        service: o.tier?.group?.name || o.service?.name || o.serviceId,
        platform: o.service?.category || 'unknown',
        user: o.user?.name || o.user?.email || 'Unknown',
        charge: (o.charge || 0) / 100,
        status: o.status,
        cancelReason: o.status === 'Cancelled' ? (o.lastError || null) : null,
        created: o.createdAt.toISOString(),
      })),
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
      generatedAt: now.toISOString(),
    });
  } catch (err) {
    log.error('Pulse API', err.message);
    return Response.json({ error: 'Failed to load pulse data' }, { status: 500 });
  }
}
