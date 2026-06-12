import prisma from '@/lib/prisma';
import { log } from '@/lib/logger';
import { requireAdmin } from '@/lib/admin';

export async function GET(req) {
  const { admin, error } = await requireAdmin('acquisition');
  if (error) return error;

  try {
    const url = new URL(req.url);
    const linkId = url.searchParams.get('linkId');
    const range = url.searchParams.get('range') || '7d';

    const rangeMs = { '24h': 86400000, '7d': 604800000, '30d': 2592000000 };
    const since = new Date(Date.now() - (rangeMs[range] || rangeMs['7d']));
    const where = { createdAt: { gte: since }, ...(linkId ? { linkId } : {}) };

    const slug = linkId
      ? (await prisma.acquisitionLink.findUnique({ where: { id: linkId }, select: { slug: true } }))?.slug
      : null;

    const [
      totalClicks,
      uniqueRaw,
      deviceBreakdown,
      countryBreakdown,
      cityBreakdown,
      browserBreakdown,
      osBreakdown,
      referrerBreakdown,
      timelineRaw,
      signupTimelineRaw,
      revenueStats,
    ] = await Promise.all([
      prisma.linkClick.count({ where }),

      linkId
        ? prisma.$queryRaw`SELECT COUNT(DISTINCT "ipHash")::int AS cnt FROM link_clicks WHERE "linkId" = ${linkId} AND "createdAt" >= ${since}`
        : prisma.$queryRaw`SELECT COUNT(DISTINCT "ipHash")::int AS cnt FROM link_clicks WHERE "createdAt" >= ${since}`,

      prisma.linkClick.groupBy({
        by: ['deviceType'], where, _count: true,
        orderBy: { _count: { deviceType: 'desc' } },
      }),

      prisma.linkClick.groupBy({
        by: ['country'], where: { ...where, country: { not: null } }, _count: true,
        orderBy: { _count: { country: 'desc' } }, take: 10,
      }),

      prisma.linkClick.groupBy({
        by: ['city'], where: { ...where, city: { not: null } }, _count: true,
        orderBy: { _count: { city: 'desc' } }, take: 10,
      }),

      prisma.linkClick.groupBy({
        by: ['browser'], where: { ...where, browser: { not: null } }, _count: true,
        orderBy: { _count: { browser: 'desc' } }, take: 8,
      }),

      prisma.linkClick.groupBy({
        by: ['os'], where: { ...where, os: { not: null } }, _count: true,
        orderBy: { _count: { os: 'desc' } }, take: 8,
      }),

      prisma.linkClick.groupBy({
        by: ['referrer'], where: { ...where, referrer: { not: null } }, _count: true,
        orderBy: { _count: { referrer: 'desc' } }, take: 8,
      }),

      range === '24h'
        ? (linkId
          ? prisma.$queryRaw`SELECT EXTRACT(HOUR FROM "createdAt")::int AS bucket, COUNT(*)::int AS clicks FROM link_clicks WHERE "linkId" = ${linkId} AND "createdAt" >= ${since} GROUP BY bucket ORDER BY bucket`
          : prisma.$queryRaw`SELECT EXTRACT(HOUR FROM "createdAt")::int AS bucket, COUNT(*)::int AS clicks FROM link_clicks WHERE "createdAt" >= ${since} GROUP BY bucket ORDER BY bucket`)
        : (linkId
          ? prisma.$queryRaw`SELECT DATE("createdAt") AS bucket, COUNT(*)::int AS clicks FROM link_clicks WHERE "linkId" = ${linkId} AND "createdAt" >= ${since} GROUP BY bucket ORDER BY bucket`
          : prisma.$queryRaw`SELECT DATE("createdAt") AS bucket, COUNT(*)::int AS clicks FROM link_clicks WHERE "createdAt" >= ${since} GROUP BY bucket ORDER BY bucket`),

      // Signup timeline for this link's slug
      slug
        ? (range === '24h'
          ? prisma.$queryRaw`SELECT EXTRACT(HOUR FROM "createdAt")::int AS bucket, COUNT(*)::int AS signups FROM users WHERE "signupSource" = ${slug} AND "deletedAt" IS NULL AND "createdAt" >= ${since} GROUP BY bucket ORDER BY bucket`
          : prisma.$queryRaw`SELECT DATE("createdAt") AS bucket, COUNT(*)::int AS signups FROM users WHERE "signupSource" = ${slug} AND "deletedAt" IS NULL AND "createdAt" >= ${since} GROUP BY bucket ORDER BY bucket`)
        : Promise.resolve([]),

      // Revenue + orders for this link
      slug
        ? prisma.$queryRaw`
            SELECT COUNT(o.id)::int AS orders, COALESCE(SUM(o.charge),0)::int AS revenue, COALESCE(SUM(o.cost),0)::int AS cost
            FROM orders o JOIN users u ON o."userId" = u.id
            WHERE u."signupSource" = ${slug} AND u."deletedAt" IS NULL AND o."deletedAt" IS NULL AND o.status NOT IN ('Cancelled') AND o."createdAt" >= ${since}
          `
        : Promise.resolve([{ orders: 0, revenue: 0, cost: 0 }]),
    ]);

    const rev = revenueStats[0] || { orders: 0, revenue: 0, cost: 0 };

    return Response.json({
      totalClicks,
      uniqueClicks: uniqueRaw[0]?.cnt || 0,
      devices: Object.fromEntries(deviceBreakdown.map(d => [d.deviceType, d._count])),
      countries: countryBreakdown.map(c => ({ code: c.country, clicks: c._count })),
      cities: cityBreakdown.map(c => ({ name: c.city, clicks: c._count })),
      browsers: browserBreakdown.map(b => ({ name: b.browser, clicks: b._count })),
      os: osBreakdown.map(o => ({ name: o.os, clicks: o._count })),
      referrers: referrerBreakdown.map(r => ({ source: r.referrer, clicks: r._count })),
      timeline: timelineRaw,
      signupTimeline: signupTimelineRaw,
      periodRevenue: rev.revenue / 100,
      periodOrders: rev.orders,
      periodProfit: (rev.revenue - rev.cost) / 100,
      range,
    });
  } catch (err) {
    log.error('Acquisition Analytics', err.message);
    return Response.json({ error: 'Failed to load analytics' }, { status: 500 });
  }
}
