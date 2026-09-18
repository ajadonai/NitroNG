import prisma from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { log } from '@/lib/logger';
import { getCurrentUser } from '@/lib/auth';
import { getResellerTerms, getMarkupSettings, wholesaleOf, costKoboPer1k } from '@/lib/reseller';
import { isKnownPlatform, buildAll } from '@/lib/full-catalogue';

// The customer-facing full list, one platform at a time.
//
// New Order has two versions now: the curated tiers Nitro tests every week,
// and this — every listed, priced provider service for the platform, at the
// provider's own terms. Same fence as the reseller catalogue (FULL_WHERE),
// same labelling (Nitro's, never the provider's), same stale-price guard.
// Retail price for everyone; a reseller's terms apply if they have them, so
// the two lists never quote a reseller two different numbers.
//
//   ?platform=instagram          → the whole platform, cheapest first, with its
//                                  type counts and whatever customers have voted.
//   ?platform=instagram&counts=1 → the same numbers and nothing else, for the
//                                  version selector, which has to say how many
//                                  are over there before anyone taps it. Shares
//                                  the cache with the full read, so the rows are
//                                  built once either way.
//
// The whole platform comes back in one response — 599 rows for Instagram, 725
// for the largest — because every interaction the page offers (type, sort,
// refill-only, search, show-more) then costs nothing. Paging this would be
// four round trips to redraw a list the client already holds. The cost is one
// cached query: the raw rows are fetched and labelled once per platform per
// five minutes, and only the price is recomputed per request, since a reseller
// pays wholesale on the same list.

const CACHE_TTL = 5 * 60 * 1000;
const cache = new Map(); // platform → { at, built }

/**
 * One platform's fenced rows, flat.
 *
 * Two measurements shaped this. Postgres plans and executes the fence in 14ms,
 * so the database was never the cost: it was moving and mapping rows. Prisma
 * building 9,820 objects each with a nested resellerMap measured 4,231ms
 * against 1,658ms for the same rows raw and flat, and asking for one platform
 * instead of all of them took that to 221ms — 694 rows and 183KB rather than
 * 8,838 and 2.3MB.
 *
 * Filtering by platform in SQL is only possible because Service.platform
 * exists, and it exists only for this. It is a cache of platformOf, written on
 * every sync; buildAll prefers it and falls back to computing from the name, so
 * a row is always grouped under the same value it was filtered by.
 *
 * Nothing is interpolated except a platform already checked against the tile
 * list, and it goes through a parameter regardless. `::text` on the two BigInt
 * columns because a BigInt cannot be JSON-serialised and `Number()` reads
 * either form, so buildAll needs no change.
 *
 * The size clauses mirror isPerItemPackage and are an optimisation only —
 * buildAll still applies the real rule to everything that arrives, so a drift
 * between them costs bandwidth and can never change what a customer sees.
 */
const sqlFor = (platform) => Prisma.sql`
  SELECT s.id, s.name, s.category, s.platform,
         s."sellPer1k"::text AS "sellPer1k", s."costPer1k"::text AS "costPer1k",
         s.min, s.max, s.refill, s.dripfeed, s."apiType", m."apiId"
  FROM services s
  JOIN reseller_service_map m ON m."serviceId" = s.id AND m."retiredAt" IS NULL
  WHERE s.platform = ${platform}
    AND s.provider IN ('mtp', 'dao')
    AND s."providerListedAt" IS NOT NULL
    AND s."costPer1k" > 0
    AND NOT EXISTS (SELECT 1 FROM service_tiers t WHERE t."serviceId" = s.id)
    AND s.max > 20
    AND NOT (s.min = s.max AND s.max <= 1000)`;

// buildAll reads the mapping as a relation, which is the shape its fixtures use
// and the shape the reseller route would pass. One object literal per row is
// microseconds; it was never the nested object that cost, it was Prisma's
// deserialisation building them.
const nest = (r) => ({ ...r, resellerMap: { apiId: r.apiId, retiredAt: null } });

async function catalogue(platform, usdRate) {
  const hit = cache.get(platform);
  if (hit && Date.now() - hit.at < CACHE_TTL) return hit.built;
  const rows = await prisma.$queryRaw(sqlFor(platform));
  const built = buildAll(rows.map(nest), { usdRate });
  cache.set(platform, { at: Date.now(), built });
  return built;
}

export async function GET(req) {
  try {
    const session = await getCurrentUser();
    if (!session) return Response.json({ error: 'Not authenticated' }, { status: 401 });

    const url = new URL(req.url);
    const platform = url.searchParams.get('platform')?.trim().toLowerCase();
    if (!isKnownPlatform(platform)) return Response.json({ error: 'Unknown platform' }, { status: 400 });

    const [settings, terms] = await Promise.all([getMarkupSettings(), getResellerTerms(session.id)]);
    const usdRate = Number(settings.markup_usd_rate) || 1600;
    const built = await catalogue(platform, usdRate);
    const rows = built.byPlatform.get(platform) || [];
    const counts = built.counts.get(platform) || { all: 0 };

    if (url.searchParams.get('counts')) {
      return Response.json({ platform, total: rows.length, counts },
        { headers: { 'Cache-Control': 'private, max-age=300' } });
    }

    if (rows.length === 0) {
      return Response.json({ platform, total: 0, counts: { all: 0 }, services: [] }, { headers: { 'Cache-Control': 'no-store' } });
    }

    const serviceIds = rows.map(r => r.serviceId);
    const [tally, mine, ordered] = await Promise.all([
      prisma.serviceVote.groupBy({ by: ['serviceId'], where: { serviceId: { in: serviceIds } }, _count: { _all: true }, _sum: { value: true } }),
      prisma.serviceVote.findMany({ where: { userId: session.id, serviceId: { in: serviceIds } }, select: { serviceId: true, value: true } }),
      // Every service this customer has ever ordered. Bounded by their own
      // order count, not the catalogue, and it is what earns them a vote.
      prisma.order.findMany({ where: { userId: session.id }, select: { serviceId: true }, distinct: ['serviceId'] }),
    ]);

    // up + down = count, up - down = sum.
    const votes = new Map(tally.map(v => {
      const n = v._count._all, sum = Number(v._sum.value) || 0;
      return [v.serviceId, { up: (n + sum) / 2, down: (n - sum) / 2 }];
    }));
    const myVote = new Map(mine.map(v => [v.serviceId, v.value > 0 ? 'up' : 'down']));
    const canVote = new Set(ordered.map(o => o.serviceId));

    // Per row, because the margin floor is per service: the same rate is worth
    // 30% on a cheap one and 25.9% on the thinnest. costPer1k comes off the row
    // and is never returned in the response.
    const priceOf = terms
      ? (naira, costPer1k) => wholesaleOf(Math.round(naira * 100), terms, settings, costKoboPer1k(costPer1k, settings)) / 100
      : (naira) => naira;
    const services = rows.map(r => {
      const v = votes.get(r.serviceId);
      return {
        id: r.id, label: r.label, attrs: r.attrs, type: r.type,
        price: Math.round(priceOf(r.price, r.costPer1k)),
        min: r.min, max: r.max, unlimited: r.unlimited,
        refill: r.refill, refillLabel: r.refillLabel, drip: r.drip, dripfeed: r.dripfeed, apiType: r.apiType,
        up: v?.up || 0, down: v?.down || 0,
        ...(myVote.has(r.serviceId) ? { mine: myVote.get(r.serviceId) } : {}),
        ...(canVote.has(r.serviceId) ? { ordered: true } : {}),
      };
    });

    return Response.json({
      platform,
      total: services.length,
      counts,
      services,
      ...(terms ? { wholesale: true } : {}),
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    log.error('FullCatalogue', err);
    return Response.json({ error: 'Could not load the catalogue' }, { status: 500 });
  }
}
