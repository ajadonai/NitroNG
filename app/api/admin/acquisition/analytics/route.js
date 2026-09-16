/**
 * What one tracking link did, over a window that means what it says.
 *
 * The seven faults this answers are written up in the 15 Sep review; the window
 * arithmetic and the reasons behind it live in lib/report-window. The
 * short version is that every figure here now comes from one window, every
 * chart slot is emitted whether or not anything happened in it, and days are
 * cut in Lagos rather than UTC.
 *
 * Lifetime totals are not gone — they are on their own labelled strip, where 57
 * signups and ₦89,541 are plainly all-time instead of silently sitting in a
 * 30-day row and producing a 142.5% conversion rate.
 */
import prisma from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { log } from '@/lib/logger';
import { requireAdmin } from '@/lib/admin';
import { windowFor, fill, isRange, RANGES, LAGOS } from '@/lib/report-window';

export const maxDuration = 60;

/**
 * `date_trunc` in Lagos, back as a UTC instant.
 *
 * The column is a plain timestamp, so it is read as UTC, shifted into Lagos,
 * truncated there, then shifted back — which is what makes a "day" run midnight
 * to midnight in Lagos instead of 1am to 1am.
 */
const lagosBucket = (unit, col) => Prisma.sql`
  (date_trunc(${unit}, ${col} AT TIME ZONE 'UTC' AT TIME ZONE ${LAGOS}) AT TIME ZONE ${LAGOS}) AT TIME ZONE 'UTC'`;

export async function GET(req) {
  const { error } = await requireAdmin('acquisition');
  if (error) return error;

  try {
    const url = new URL(req.url);
    const linkId = url.searchParams.get('linkId');
    const rangeParam = url.searchParams.get('range') || '7d';
    const range = isRange(rangeParam) ? rangeParam : '7d';

    const link = linkId
      ? await prisma.acquisitionLink.findUnique({ where: { id: linkId }, select: { slug: true, createdAt: true } })
      : null;
    const slug = link?.slug || null;

    // The first click, on every range and not only on "all". It anchors two
    // things that have to agree: where the All-time chart begins, and the date
    // the lifetime strip counts from. Resolving it only for "all" made "Since"
    // mean the link's creation date on four ranges and its first click on the
    // fifth, which is the same class of quiet mismatch this whole route is
    // being rewritten to remove. One indexed query either way.
    const firstClick = await prisma.linkClick.findFirst({
      where: linkId ? { linkId } : {},
      orderBy: { createdAt: 'asc' },
      select: { createdAt: true },
    });
    const firstAt = firstClick?.createdAt || link?.createdAt || null;

    const win = windowFor(range, { firstAt });
    const since = win.start;
    const until = win.end;
    const inWindow = { createdAt: { gte: since, lt: until }, ...(linkId ? { linkId } : {}) };
    const bucketUnit = win.bucket;

    const clickWhere = linkId
      ? Prisma.sql`"linkId" = ${linkId} AND "createdAt" >= ${since} AND "createdAt" < ${until}`
      : Prisma.sql`"createdAt" >= ${since} AND "createdAt" < ${until}`;

    const [
      totalClicks, uniqueRaw,
      deviceBreakdown, countryBreakdown, cityBreakdown,
      browserBreakdown, osBreakdown, referrerBreakdown,
      clickSeries, signupSeries,
      periodSignups, periodMoney,
      lifetimeClicks, lifetimeSignups, lifetimeMoney,
    ] = await Promise.all([
      prisma.linkClick.count({ where: inWindow }),

      prisma.$queryRaw`SELECT COUNT(DISTINCT "ipHash")::int AS cnt FROM link_clicks WHERE ${clickWhere}`,

      prisma.linkClick.groupBy({ by: ['deviceType'], where: inWindow, _count: true, orderBy: { _count: { deviceType: 'desc' } } }),
      prisma.linkClick.groupBy({ by: ['country'], where: { ...inWindow, country: { not: null } }, _count: true, orderBy: { _count: { country: 'desc' } }, take: 10 }),
      prisma.linkClick.groupBy({ by: ['city'], where: { ...inWindow, city: { not: null } }, _count: true, orderBy: { _count: { city: 'desc' } }, take: 10 }),
      prisma.linkClick.groupBy({ by: ['browser'], where: { ...inWindow, browser: { not: null } }, _count: true, orderBy: { _count: { browser: 'desc' } }, take: 8 }),
      prisma.linkClick.groupBy({ by: ['os'], where: { ...inWindow, os: { not: null } }, _count: true, orderBy: { _count: { os: 'desc' } }, take: 8 }),
      prisma.linkClick.groupBy({ by: ['referrer'], where: { ...inWindow, referrer: { not: null } }, _count: true, orderBy: { _count: { referrer: 'desc' } }, take: 8 }),

      // Both series are bucketed the same way onto the same instants, so slot N
      // is the same date in each — the overlay used to be a second chart with
      // its own length, where bar 4 of one was not bar 4 of the other.
      prisma.$queryRaw`
        SELECT ${lagosBucket(bucketUnit, Prisma.sql`"createdAt"`)} AS bucket, COUNT(*)::int AS clicks
        FROM link_clicks WHERE ${clickWhere} GROUP BY 1 ORDER BY 1`,

      slug
        ? prisma.$queryRaw`
            SELECT ${lagosBucket(bucketUnit, Prisma.sql`"createdAt"`)} AS bucket, COUNT(*)::int AS signups
            FROM users WHERE "signupSource" = ${slug} AND "deletedAt" IS NULL
              AND "createdAt" >= ${since} AND "createdAt" < ${until} GROUP BY 1 ORDER BY 1`
        : Promise.resolve([]),

      slug
        ? prisma.user.count({ where: { signupSource: slug, deletedAt: null, createdAt: { gte: since, lt: until } } })
        : Promise.resolve(0),

      slug
        ? prisma.$queryRaw`
            SELECT COUNT(o.id)::int AS orders, COALESCE(SUM(o.charge),0)::bigint AS revenue, COALESCE(SUM(o.cost),0)::bigint AS cost
            FROM orders o JOIN users u ON o."userId" = u.id
            WHERE u."signupSource" = ${slug} AND u."deletedAt" IS NULL AND o."deletedAt" IS NULL
              AND o.status NOT IN ('Cancelled') AND o."createdAt" >= ${since} AND o."createdAt" < ${until}`
        : Promise.resolve([{ orders: 0, revenue: 0n, cost: 0n }]),

      // ── the all-time strip ──
      prisma.linkClick.count({ where: linkId ? { linkId } : {} }),
      slug ? prisma.user.count({ where: { signupSource: slug, deletedAt: null } }) : Promise.resolve(0),
      slug
        ? prisma.$queryRaw`
            SELECT COUNT(o.id)::int AS orders, COALESCE(SUM(o.charge),0)::bigint AS revenue
            FROM orders o JOIN users u ON o."userId" = u.id
            WHERE u."signupSource" = ${slug} AND u."deletedAt" IS NULL AND o."deletedAt" IS NULL
              AND o.status NOT IN ('Cancelled')`
        : Promise.resolve([{ orders: 0, revenue: 0n }]),
    ]);

    const money = (v) => Number(v || 0) / 100;
    const p = periodMoney[0] || { orders: 0, revenue: 0n, cost: 0n };
    const life = lifetimeMoney[0] || { orders: 0, revenue: 0n };

    // One map per bucket instant, then one pass to emit every slot.
    const signupByBucket = new Map(signupSeries.map(r => [new Date(r.bucket).getTime(), Number(r.signups)]));
    const timeline = fill(win, clickSeries, ['clicks']).map(slot => ({
      ...slot,
      signups: signupByBucket.get(new Date(slot.at).getTime()) || 0,
    }));

    return Response.json({
      range,
      bucket: win.bucket,
      label: RANGES[range].label,
      windowStart: win.start.toISOString(),
      windowEnd: win.end.toISOString(),
      slots: win.slots,

      totalClicks,
      uniqueClicks: uniqueRaw[0]?.cnt || 0,
      periodSignups,
      periodOrders: Number(p.orders),
      periodRevenue: money(p.revenue),
      periodProfit: money(Number(p.revenue) - Number(p.cost)),

      // Plainly labelled, so nothing on the card row is secretly all-time.
      lifetime: {
        clicks: lifetimeClicks,
        signups: lifetimeSignups,
        orders: Number(life.orders),
        revenue: money(life.revenue),
        since: firstAt ? new Date(firstAt).toISOString() : null,
      },

      timeline,
      devices: Object.fromEntries(deviceBreakdown.map(d => [d.deviceType, d._count])),
      countries: countryBreakdown.map(c => ({ code: c.country, clicks: c._count })),
      cities: cityBreakdown.map(c => ({ name: c.city, clicks: c._count })),
      browsers: browserBreakdown.map(b => ({ name: b.browser, clicks: b._count })),
      os: osBreakdown.map(o => ({ name: o.os, clicks: o._count })),
      referrers: referrerBreakdown.map(r => ({ source: r.referrer, clicks: r._count })),
    });
  } catch (err) {
    log.error('Acquisition Analytics', err.message);
    return Response.json({ error: 'Failed to load analytics' }, { status: 500 });
  }
}
