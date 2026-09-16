import prisma from '@/lib/prisma';
import { log } from '@/lib/logger';
import { getCurrentUser } from '@/lib/auth';
import { getResellerTerms, getMarkupSettings, wholesaleOf, resellerFloorKobo } from '@/lib/reseller';
import { formatResellerService, dedupeCategoryLabels } from '@/lib/reseller-format';
import { FULL_WHERE } from '@/lib/full-catalogue';

// Read-only browse for granted resellers. Ordering happens on the order page or
// through the API; this page exists so a reseller can see what an ID means.
//
// The full list is served a category at a time (the accordion fetches on
// expand): 8,874 rows in one payload is over a megabyte nobody scrolls.
const SEARCH_LIMIT = 50;
// A category page: the biggest category holds 1,237 services, and a phone does
// not want 1,237 DOM rows from one tap. The accordion loads a page and offers
// the rest on demand.
const PAGE_SIZE = 120;

// Platform order for the whole catalogue: the platforms Nitro actually sells,
// biggest first (Instagram does more volume than the next five combined), then
// everything else alphabetically. A reseller should hit the money platforms
// without scrolling.
const PLATFORM_PRIORITY = ['instagram', 'tiktok', 'facebook', 'telegram', 'twitter/x', 'youtube', 'spotify', 'whatsapp', 'audiomack'];
const platformRank = (name) => {
  const i = PLATFORM_PRIORITY.indexOf(String(name || '').toLowerCase());
  return i === -1 ? PLATFORM_PRIORITY.length : i;
};
const byPlatform = (a, b) => platformRank(a) - platformRank(b) || String(a).localeCompare(String(b));

// One definition of the full list, shared with the customer-facing view at
// app/api/catalogue/full so the two can never disagree about what it holds.
const fullWhere = FULL_WHERE;

export async function GET(req) {
  try {
    const session = await getCurrentUser();
    if (!session) return Response.json({ error: 'Not authenticated' }, { status: 401 });
    const terms = await getResellerTerms(session.id);
    if (!terms) return Response.json({ error: 'Reseller access required' }, { status: 403 });

    // A one-field probe so the dashboard can decide whether to show the tab
    // without paying for a catalogue build.
    if (new URL(req.url).searchParams.get('probe')) {
      return Response.json({ reseller: true });
    }

    const settings = await getMarkupSettings();
    const usdRate = Number(settings.markup_usd_rate) || 1600;
    const url = new URL(req.url);
    const category = url.searchParams.get('category');
    const q = url.searchParams.get('q')?.trim();

    // No category and no search: just the accordion skeleton.
    //
    // Grouped by the Nitro tile, never the provider's own category. Theirs
    // carries the house style this whole layer exists to hide — 169 services
    // filed under a blue circle, 281 under "Vip", others under "Cheapest",
    // "Private" and a bold-unicode "Premium" — and /api/v2 already sends the
    // tile, so grouping the browse page any other way would have a reseller
    // reading "Vip" on the site and "instagram" in the API for one service.
    if (!category && !q) {
      const cats = await prisma.service.groupBy({
        by: ['platform'],
        where: { ...fullWhere, platform: { not: null } },
        _count: true,
      });
      cats.sort((a, b) => byPlatform(a.platform, b.platform));
      return Response.json({ categories: cats.map(c => ({ name: c.platform, count: c._count })) });
    }

    const offset = Math.max(0, Number(url.searchParams.get('offset')) || 0);
    const where = {
      ...fullWhere,
      ...(category ? { platform: category } : {}),
      ...(q ? (/^\d+$/.test(q)
        ? { resellerMap: { is: { apiId: Number(q), retiredAt: null } } }
        : { name: { contains: q, mode: 'insensitive' } }) : {}),
    };
    const services = await prisma.service.findMany({
      where,
      select: {
        name: true, category: true, platform: true, sellPer1k: true, costPer1k: true,
        min: true, max: true, refill: true, cancel: true, dripfeed: true,
        resellerMap: { select: { apiId: true, retiredAt: true } },
      },
      orderBy: [{ costPer1k: 'asc' }, { id: 'asc' }],
      skip: q ? 0 : offset,
      take: q ? SEARCH_LIMIT : PAGE_SIZE,
    });

    let hiddenStale = 0;
    const rows = [];
    for (const s of services) {
      if (!s.resellerMap || s.resellerMap.retiredAt) continue;
      const costKobo = Number(s.costPer1k) * usdRate;
      const retail = Number(s.sellPer1k);
      // The widened prices cron is still working through years of stale prices.
      // A price at or below cost is stale, not a bargain — hide it rather than
      // quote a number we would never honour.
      //
      // The same goes for one that cannot clear the reseller margin floor. Three
      // services are priced at 1.02x to 1.11x markup at RETAIL, so a walk-in
      // customer already earns us under 10% on them; the floor caps wholesale at
      // retail rather than charging a reseller more than the public price, which
      // means those rows would quote a margin we said we would never accept.
      // Hiding them is the honest answer until the retail price is fixed.
      if (!retail || retail <= costKobo) { hiddenStale++; continue; }
      const floor = resellerFloorKobo(costKobo, settings);
      if (floor !== null && retail < floor) { hiddenStale++; continue; }
      const fmt = formatResellerService(s.name, s.category);
      rows.push({
        id: s.resellerMap.apiId,
        label: fmt.label,
        attrs: fmt.attrs,
        grade: fmt.grade,
        category: s.platform,
        price: wholesaleOf(retail, terms, settings, costKobo) / 100,
        min: s.min,
        max: s.max,
        refill: s.refill,
        cancel: s.cancel,
        dripfeed: s.dripfeed,
        _raw: s.name,
      });
    }
    dedupeCategoryLabels(rows);

    // hasMore is judged on the fetched page, not a count query: one page over-
    // fetching by a hair beats a second COUNT on every expand.
    return Response.json({
      services: rows,
      ...(q ? { query: q, limit: SEARCH_LIMIT } : { offset, hasMore: services.length === PAGE_SIZE }),
      ...(hiddenStale ? { hiddenStale } : {}),
    });
  } catch (err) {
    log.error('ResellerCatalogue', err.message);
    return Response.json({ error: 'Failed to load catalogue' }, { status: 500 });
  }
}
