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

    const [
      totalClicks,
      uniqueRaw,
      deviceBreakdown,
      countryBreakdown,
      browserBreakdown,
      referrerBreakdown,
      timelineRaw,
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
        by: ['browser'], where: { ...where, browser: { not: null } }, _count: true,
        orderBy: { _count: { browser: 'desc' } }, take: 8,
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
    ]);

    return Response.json({
      totalClicks,
      uniqueClicks: uniqueRaw[0]?.cnt || 0,
      devices: Object.fromEntries(deviceBreakdown.map(d => [d.deviceType, d._count])),
      countries: countryBreakdown.map(c => ({ code: c.country, clicks: c._count })),
      browsers: browserBreakdown.map(b => ({ name: b.browser, clicks: b._count })),
      referrers: referrerBreakdown.map(r => ({ source: r.referrer, clicks: r._count })),
      timeline: timelineRaw,
      range,
    });
  } catch (err) {
    log.error('Acquisition Analytics', err.message);
    return Response.json({ error: 'Failed to load analytics' }, { status: 500 });
  }
}
