import prisma from '@/lib/prisma';
import { ok } from '@/lib/utils';
import { getSiteStats } from '@/lib/site-stats';

export const revalidate = 300;

export async function GET() {
  try {
    // Every number here comes from lib/site-stats so this route and the pages
    // that server-render the same figures cannot drift apart. The promo and
    // the alerts are this route's own business and stay here.
    // This route is the one place that pays for the full-list count: it is ISR
    // on a five-minute revalidate, so the work lands on a background refresh,
    // and the landing page's below-fold prints the figure.
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

    return ok({ stats: stats.display, promo, alerts });
  } catch {
    // Null rather than "0": the landing page renders a missing figure away and
    // prints a zero, and a zero next to "15,000 orders" elsewhere on the site
    // is the contradiction a visitor actually notices.
    return ok({ stats: { users: null, orders: null }, promo: null, alerts: [] });
  }
}
