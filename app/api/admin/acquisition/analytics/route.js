import prisma from '@/lib/prisma';
import { log } from '@/lib/logger';
import { requireAdmin } from '@/lib/admin';

export async function GET(req) {
  const { error } = await requireAdmin('acquisition');
  if (error) return error;

  try {
    const url = new URL(req.url);
    const linkId = url.searchParams.get('linkId');
    const range = url.searchParams.get('range') || '7d';

    // "All" is one of the three buttons the panel actually shows, and it was
    // missing from this map — so `rangeMs['all']` was undefined, the `||` fell
    // through to a week, and the All view served seven days of clicks under an
    // All heading. On alabi-ad that printed 2,384 clicks where the true figure
    // is 30,664, and ₦352,109 of revenue against ₦4,180,578.
    const rangeMs = { '24h': 86400000, '7d': 604800000, '30d': 2592000000 };
    const since = range === 'all' ? new Date(0) : new Date(Date.now() - (rangeMs[range] || rangeMs['7d']));
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
      periodSignups,
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

      // Signups inside the window, so the row describes one period.
      //
      // The card was reading the link list's all-time total against this
      // route's windowed clicks — 3,465 signups over 2,384 clicks, printed as
      // "145.3% conversion". A conversion above 100% is not a rounding
      // problem, it is two different questions sharing a percentage sign.
      slug
        ? prisma.user.count({ where: { signupSource: slug, deletedAt: null, createdAt: { gte: since } } })
        : Promise.resolve(0),

      // Revenue + orders for this link
      slug
        ? prisma.$queryRaw`
            SELECT COUNT(o.id)::int AS orders, COALESCE(SUM(o.charge),0)::bigint AS revenue, COALESCE(SUM(o.cost),0)::bigint AS cost
            FROM orders o JOIN users u ON o."userId" = u.id
            WHERE u."signupSource" = ${slug} AND u."deletedAt" IS NULL AND o."deletedAt" IS NULL AND o.status NOT IN ('Cancelled') AND o."createdAt" >= ${since}
          `
        : Promise.resolve([{ orders: 0, revenue: 0, cost: 0 }]),
    ]);

    // bigint keeps the sum from overflowing in Postgres; Number keeps it
    // JSON-serialisable on the way out. ₦4.18m of kobo is 418,057,800 — well
    // inside a double, and nowhere near the 32-bit int the cast used to use.
    const raw = revenueStats[0] || { orders: 0, revenue: 0, cost: 0 };
    const rev = { orders: Number(raw.orders), revenue: Number(raw.revenue), cost: Number(raw.cost) };

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
      periodSignups,
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
