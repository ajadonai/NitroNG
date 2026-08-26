import prisma from '@/lib/prisma';
import { log } from '@/lib/logger';
import { getCurrentUser } from '@/lib/auth';
import { getResellerTerms, getMarkupSettings, wholesaleOf } from '@/lib/reseller';
import { getServiceCatalogue } from '@/lib/service-catalog';
import { formatResellerService, dedupeCategoryLabels } from '@/lib/reseller-format';

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

const fullWhere = {
  provider: { in: ['mtp', 'dao'] },
  providerListedAt: { not: null },
  costPer1k: { gt: 0 },
  tiers: { none: {} },
  resellerMap: { isNot: null },
};

export async function GET(req) {
  try {
    const session = await getCurrentUser();
    if (!session) return Response.json({ error: 'Not authenticated' }, { status: 401 });
    const terms = await getResellerTerms(session.id);
    if (!terms) return Response.json({ error: 'Reseller access required' }, { status: 403 });

    // A one-field probe so the dashboard can decide whether to show the tab
    // without paying for a catalogue build.
    if (new URL(req.url).searchParams.get('probe')) {
      return Response.json({ reseller: true, catalog: terms.catalog });
    }

    const settings = await getMarkupSettings();
    const usdRate = Number(settings.markup_usd_rate) || 1600;
    const url = new URL(req.url);
    const view = url.searchParams.get('view') || 'curated';
    const category = url.searchParams.get('category');
    const q = url.searchParams.get('q')?.trim();

    if (view === 'full' && terms.catalog !== 'full') {
      return Response.json({ error: 'Your account is on the curated catalogue' }, { status: 403 });
    }

    if (view === 'curated') {
      const catalogue = await getServiceCatalogue();
      // Reseller IDs ride along so the page can show what to put in an API call.
      const maps = await prisma.resellerServiceMap.findMany({
        where: { tierId: { not: null }, retiredAt: null },
        select: { apiId: true, tierId: true },
      });
      const idByTier = Object.fromEntries(maps.map(m => [m.tierId, m.apiId]));
      const groups = [...catalogue.groups].sort((a, b) => byPlatform(a.platform, b.platform) || a.name.localeCompare(b.name)).map(g => ({
        name: g.name,
        platform: g.platform,
        tiers: g.tiers.map(t => ({
          apiId: idByTier[t.id] || null,
          tier: t.tier,
          price: wholesaleOf(Math.round(t.price * 100), terms, settings) / 100,
          retail: t.price,
          min: t.min,
          max: t.max,
          refill: t.refill,
          speed: t.speed,
        })),
      }));
      return Response.json({ view, catalog: terms.catalog, groups });
    }

    // Full list. No category and no search: just the accordion skeleton.
    if (!category && !q) {
      const cats = await prisma.service.groupBy({
        by: ['category'],
        where: fullWhere,
        _count: true,
      });
      cats.sort((a, b) => byPlatform(a.category, b.category));
      return Response.json({ view, catalog: terms.catalog, categories: cats.map(c => ({ name: c.category, count: c._count })) });
    }

    const offset = Math.max(0, Number(url.searchParams.get('offset')) || 0);
    const where = {
      ...fullWhere,
      ...(category ? { category } : {}),
      ...(q ? (/^\d+$/.test(q)
        ? { resellerMap: { is: { apiId: Number(q), retiredAt: null } } }
        : { name: { contains: q, mode: 'insensitive' } }) : {}),
    };
    const services = await prisma.service.findMany({
      where,
      select: {
        name: true, category: true, sellPer1k: true, costPer1k: true,
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
      if (!retail || retail <= costKobo) { hiddenStale++; continue; }
      const fmt = formatResellerService(s.name, s.category);
      rows.push({
        id: s.resellerMap.apiId,
        label: fmt.label,
        attrs: fmt.attrs,
        grade: fmt.grade,
        category: s.category,
        price: wholesaleOf(retail, terms, settings) / 100,
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
      view, catalog: terms.catalog, services: rows,
      ...(q ? { query: q, limit: SEARCH_LIMIT } : { offset, hasMore: services.length === PAGE_SIZE }),
      ...(hiddenStale ? { hiddenStale } : {}),
    });
  } catch (err) {
    log.error('ResellerCatalogue', err.message);
    return Response.json({ error: 'Failed to load catalogue' }, { status: 500 });
  }
}
