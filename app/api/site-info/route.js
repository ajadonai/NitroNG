import prisma from '@/lib/prisma';
import { getSiteStats } from '@/lib/site-stats';

// ── Why this is dynamic and not ISR ──
// It was `export const revalidate = 300`, which made the build classify it as
// "○ Static — prerendered as static content, Revalidate 5m, Expire 1y". Two
// consequences, and together they are why the order counter visibly lagged
// reality by a couple of hundred orders rather than by five minutes:
//
//   1. The response was baked into the build. Every region began serving the
//      figures as they were at build time, so a fresh deploy started life
//      already showing whatever was true when the deploy was cut.
//   2. Expire was a year. Stale-while-revalidate means a request is answered
//      from the stale entry and the refresh happens behind it, per edge region
//      and only where there is traffic. A region could sit on an old count for
//      as long as it liked, and nothing forced it forward.
//
// So the counter did not creep from 13K+ to 14K+ at 14,001. It crept when some
// region got round to refreshing, which is why it looked like it needed 14,200
// or 14,300 first.
//
// Dynamic with an explicit sixty-second CDN window instead: never baked into a
// build, never a year stale, and the counts behind it are four indexed queries.
// The one expensive figure, the full-list size, carries its own ten-minute
// memo and an eight-second budget, so the work does not land on a reader.
export const dynamic = 'force-dynamic';

const CACHE_HEADER = 'public, s-maxage=60, stale-while-revalidate=120';

/** Same JSON `ok()` would send, plus the CDN window this route wants. */
const json = (data) =>
  Response.json(data, { status: 200, headers: { 'Cache-Control': CACHE_HEADER } });

export async function GET() {
  try {
    // Every number here comes from lib/site-stats so this route and the pages
    // that server-render the same figures cannot drift apart. The promo and
    // the alerts are this route's own business and stay here.
    //
    // This is the one caller that pays for the full-list count, because the
    // landing page's below-fold prints it.
    const stats = await getSiteStats({ includeFullList: true });

    let promo = null;
    try {
      const settings = await prisma.setting.findMany();
      const s = {};
      settings.forEach(x => { s[x.key] = x.value; });
      if (s.promoEnabled === 'true' && s.promoMessage) {
        promo = { message: s.promoMessage, type: s.promoType || 'info' };
      }
    } catch {}

    let alerts = [];
    try {
      alerts = (await prisma.alert.findMany({
        where: {
          active: true,
          deletedAt: null,
          target: { in: ['everyone', 'landing'] },
          OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
        },
        orderBy: { createdAt: 'desc' },
        take: 3,
      })).map(a => ({
        id: a.id, message: a.message, type: a.type,
        ...(a.actionLabel && a.actionHref ? { action: { label: a.actionLabel, href: a.actionHref } } : {}),
      }));
    } catch {}

    return json({ stats: stats.display, promo, alerts });
  } catch {
    // Null rather than "0": the landing page renders a missing figure away and
    // prints a zero, and a zero next to "15,000 orders" elsewhere on the site
    // is the contradiction a visitor actually notices.
    return json({ stats: { users: null, orders: null }, promo: null, alerts: [] });
  }
}
