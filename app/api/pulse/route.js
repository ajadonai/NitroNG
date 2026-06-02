import { timingSafeEqual } from 'crypto';
import prisma from '@/lib/prisma';
import { log } from '@/lib/logger';

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
    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);

    const yesterdayStart = new Date(todayStart);
    yesterdayStart.setDate(yesterdayStart.getDate() - 1);

    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const thirtyDaysAgo = new Date(now - 30 * 24 * 60 * 60 * 1000);

    const [
      totalUsers, newUsersToday,
      todayRevenueAgg, todayOrderCount, todayDepositsAgg,
      yesterdayRevenueAgg, yesterdayDepositsAgg, yesterdayOrderCount,
      processingCount,
      monthRevenueAgg, monthOrderCount, monthDepositsAgg, monthNewUsers,
      ordersByStatus,
      allOrdersForPlatforms,
      chartOrders, chartDeposits, chartUsers,
      recentOrders,
    ] = await Promise.all([
      prisma.user.count({ where: { emailVerified: true } }),
      prisma.user.count({ where: { createdAt: { gte: todayStart }, emailVerified: true } }),
      prisma.order.aggregate({ where: { createdAt: { gte: todayStart }, deletedAt: null, status: { notIn: ['Cancelled'] } }, _sum: { charge: true } }),
      prisma.order.count({ where: { createdAt: { gte: todayStart }, deletedAt: null } }),
      prisma.transaction.aggregate({ where: { type: 'deposit', status: 'Completed', createdAt: { gte: todayStart } }, _sum: { amount: true } }),
      prisma.order.aggregate({ where: { createdAt: { gte: yesterdayStart, lt: todayStart }, deletedAt: null, status: { notIn: ['Cancelled'] } }, _sum: { charge: true } }),
      prisma.transaction.aggregate({ where: { type: 'deposit', status: 'Completed', createdAt: { gte: yesterdayStart, lt: todayStart } }, _sum: { amount: true } }),
      prisma.order.count({ where: { createdAt: { gte: yesterdayStart, lt: todayStart }, deletedAt: null } }),
      prisma.order.count({ where: { status: 'Processing', deletedAt: null } }),
      prisma.order.aggregate({ where: { createdAt: { gte: monthStart }, deletedAt: null, status: { notIn: ['Cancelled'] } }, _sum: { charge: true } }),
      prisma.order.count({ where: { createdAt: { gte: monthStart }, deletedAt: null } }),
      prisma.transaction.aggregate({ where: { type: 'deposit', status: 'Completed', createdAt: { gte: monthStart } }, _sum: { amount: true } }),
      prisma.user.count({ where: { createdAt: { gte: monthStart }, emailVerified: true } }),
      prisma.order.groupBy({ by: ['status'], where: { createdAt: { gte: thirtyDaysAgo }, deletedAt: null }, _count: true }),
      prisma.order.findMany({
        where: { createdAt: { gte: thirtyDaysAgo }, deletedAt: null, status: { notIn: ['Cancelled'] } },
        select: { charge: true, service: { select: { category: true } } },
      }),
      prisma.order.findMany({
        where: { createdAt: { gte: thirtyDaysAgo }, deletedAt: null },
        select: { createdAt: true, charge: true, status: true },
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
        take: 12,
        include: {
          user: { select: { name: true, email: true } },
          service: { select: { name: true, category: true } },
          tier: { select: { tier: true, group: { select: { name: true } } } },
        },
      }),
    ]);

    const pctChange = (today, yesterday) => {
      if (yesterday === 0) return today > 0 ? 100 : 0;
      return Math.round(((today - yesterday) / yesterday) * 100);
    };

    const todayRevenue = (todayRevenueAgg._sum.charge || 0) / 100;
    const yesterdayRevenue = (yesterdayRevenueAgg._sum.charge || 0) / 100;
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
      platformMap[name].revenue += (o.charge || 0) / 100;
    });
    const topPlatforms = Object.values(platformMap)
      .sort((a, b) => b.orders - a.orders)
      .slice(0, 5)
      .map(p => ({ ...p, revenue: Math.round(p.revenue) }));

    // Chart data — 30 days
    const toDay = (d) => new Date(d).toISOString().slice(0, 10);
    const dayMap = {};
    chartOrders.forEach(o => {
      const day = toDay(o.createdAt);
      if (!dayMap[day]) dayMap[day] = { orders: 0, revenue: 0, deposits: 0, newUsers: 0 };
      dayMap[day].orders++;
      if (o.status !== 'Cancelled') dayMap[day].revenue += (o.charge || 0) / 100;
    });
    chartDeposits.forEach(tx => {
      const day = toDay(tx.createdAt);
      if (!dayMap[day]) dayMap[day] = { orders: 0, revenue: 0, deposits: 0, newUsers: 0 };
      dayMap[day].deposits += (tx.amount || 0) / 100;
    });
    chartUsers.forEach(u => {
      const day = toDay(u.createdAt);
      if (!dayMap[day]) dayMap[day] = { orders: 0, revenue: 0, deposits: 0, newUsers: 0 };
      dayMap[day].newUsers++;
    });

    const chartData = [];
    const d = new Date(thirtyDaysAgo);
    while (d <= now) {
      const key = d.toISOString().slice(0, 10);
      chartData.push({
        date: key,
        orders: dayMap[key]?.orders || 0,
        revenue: Math.round(dayMap[key]?.revenue || 0),
        deposits: Math.round(dayMap[key]?.deposits || 0),
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
      monthRevenue: (monthRevenueAgg._sum.charge || 0) / 100,
      monthOrders: monthOrderCount,
      monthDeposits: (monthDepositsAgg._sum.amount || 0) / 100,
      monthNewUsers,
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
        created: o.createdAt.toISOString(),
      })),
      generatedAt: now.toISOString(),
    });
  } catch (err) {
    log.error('Pulse API', err.message);
    return Response.json({ error: 'Failed to load pulse data' }, { status: 500 });
  }
}
