import { Prisma } from '@prisma/client';
import prisma from '@/lib/prisma';
import { log } from '@/lib/logger';
import { requireAdmin } from '@/lib/admin';
import { buildAll } from '@/lib/full-catalogue';
import { getMarkupSettings } from '@/lib/reseller';

export const dynamic = 'force-dynamic';

/**
 * The full list, for the admin order desk.
 *
 * Admins could only place orders off the 325 curated tiers, so anything a
 * customer bought from the wider list could not be placed on their behalf —
 * the one case where support most needs to.
 *
 * Search rather than the customer route's per-platform dump: that one answers
 * "show me everything on this tile" for a person browsing, and prices every row
 * at the *caller's* own reseller terms, which for an admin would be their
 * discount rather than the customer's price. This answers "find the one I mean"
 * and always quotes retail, which is what the create route then charges.
 *
 * Rows still come out of `buildAll`, so a service's label, type, minimum and
 * drip eligibility are the same here as on the list the customer ordered from.
 */
const LIMIT = 25;

// The same fence as lib/full-catalogue FULL_WHERE and the customer route:
// mtp or dao, still listed upstream, carrying a real cost, not already curated.
// `enabled` is deliberately absent — on a full-list row it records whether
// Nitro curated the service, not whether it can be sold.
const searchSql = (term, apiId) => Prisma.sql`
  SELECT s.id, s.name, s.category, s.platform,
         s."sellPer1k"::text AS "sellPer1k", s."costPer1k"::text AS "costPer1k",
         s.min, s.max, s.refill, s.dripfeed, s."apiType", m."apiId"
  FROM services s
  JOIN reseller_service_map m ON m."serviceId" = s.id AND m."retiredAt" IS NULL
  WHERE s.provider IN ('mtp', 'dao')
    AND s."providerListedAt" IS NOT NULL
    AND s."costPer1k" > 0
    AND NOT EXISTS (SELECT 1 FROM service_tiers t WHERE t."serviceId" = s.id)
    AND s.max > 20
    AND NOT (s.min = s.max AND s.max <= 1000)
    AND (${apiId}::int IS NOT NULL AND m."apiId" = ${apiId}::int OR s.name ILIKE ${'%' + term + '%'})
  ORDER BY s."sellPer1k" ASC
  LIMIT 200`;

export async function GET(req) {
  const { error } = await requireAdmin('orders');
  if (error) return error;

  try {
    const url = new URL(req.url);
    const q = (url.searchParams.get('q') || '').trim();
    if (q.length < 2) return Response.json({ services: [] });

    const apiId = /^\d+$/.test(q) ? Number(q) : null;
    const settings = await getMarkupSettings();
    const usdRate = Number(settings.markup_usd_rate) || 1600;

    const rows = await prisma.$queryRaw(searchSql(q, apiId));
    const built = buildAll(
      rows.map(r => ({ ...r, resellerMap: { apiId: r.apiId, retiredAt: null } })),
      { usdRate },
    );

    // buildAll files by tile; the desk wants one ranked list.
    const all = [...built.byPlatform.values()].flat();
    const needle = q.toLowerCase();
    all.sort((a, b) => {
      const ax = a.label.toLowerCase().startsWith(needle) ? 0 : 1;
      const bx = b.label.toLowerCase().startsWith(needle) ? 0 : 1;
      return ax - bx || a.price - b.price;
    });

    return Response.json({
      services: all.slice(0, LIMIT).map(r => ({
        id: r.id, label: r.label, platform: r.platform, type: r.type,
        price: r.price, min: r.min, max: r.max,
        refill: r.refill, refillLabel: r.refillLabel,
        drip: r.drip, apiType: r.apiType, attrs: r.attrs,
      })),
    });
  } catch (e) {
    log.error('Admin full list', e.message);
    return Response.json({ error: 'Could not search the full list' }, { status: 500 });
  }
}
