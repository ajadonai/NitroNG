// How big the full list actually is, for the one place that says so out loud.
//
// The landing page claims a number. The only honest number to claim is what a
// customer can open and order — not `services.count()`, which is the whole
// 17,855-row import, and not the count of reseller IDs either, because that
// includes rows the customer list never shows. Between the fence and the
// storefront, buildAll drops per-item packages, rows priced at or below cost,
// exact duplicates, and anything with no platform tile. On 16 Sep that is
// 8,835 rows in and 7,581 out.
//
// So this runs the real buildAll rather than approximating it in SQL. A second
// copy of those rules is exactly the drift that would let the landing page and
// the list it links to disagree about the same catalogue.
//
// The cost is one flat query of ~8,800 slim rows. It is cached here for ten
// minutes, and /api/site-info is itself an ISR route on a five-minute
// revalidate, so the work lands on a background refresh and never on somebody
// waiting for the page.
import { Prisma } from '@prisma/client';
import prisma from '@/lib/prisma';
import { buildAll, isKnownPlatform } from '@/lib/full-catalogue';

const TTL_MS = 10 * 60 * 1000;
let cache = null;

// The same fence app/api/catalogue/full uses, without the platform clause so
// one pass covers every tile. The size clauses mirror isPerItemPackage and are
// an optimisation only — buildAll still applies the real rule to whatever
// arrives, so a drift between them costs bandwidth and cannot change the count.
const SQL = Prisma.sql`
  SELECT s.id, s.name, s.category, s.platform,
         s."sellPer1k"::text AS "sellPer1k", s."costPer1k"::text AS "costPer1k",
         s.min, s.max, s.refill, s.dripfeed, s."apiType", m."apiId"
  FROM services s
  JOIN reseller_service_map m ON m."serviceId" = s.id AND m."retiredAt" IS NULL
  WHERE s.platform IS NOT NULL
    AND s.provider IN ('mtp', 'dao')
    AND s."providerListedAt" IS NOT NULL
    AND s."costPer1k" > 0
    AND NOT EXISTS (SELECT 1 FROM service_tiers t WHERE t."serviceId" = s.id)
    AND s.max > 20
    AND NOT (s.min = s.max AND s.max <= 1000)`;

/**
 * `{ services, platforms }` — orderable full-list rows, and how many tiles
 * carry at least one. Returns zeros rather than throwing: a landing page that
 * cannot reach the database should fall back to its own copy, not 500.
 */
export async function fullListSize(usdRate) {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.value;
  try {
    const rows = await prisma.$queryRaw(SQL);
    const built = buildAll(
      rows.filter(r => isKnownPlatform(r.platform))
        .map(r => ({ ...r, resellerMap: { apiId: r.apiId, retiredAt: null } })),
      { usdRate },
    );
    let services = 0, platforms = 0;
    for (const [, list] of built.byPlatform) {
      if (!list.length) continue;
      services += list.length;
      platforms++;
    }
    cache = { at: Date.now(), value: { services, platforms } };
    return cache.value;
  } catch {
    return cache?.value || { services: 0, platforms: 0 };
  }
}
