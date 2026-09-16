// Who is on wholesale pricing, and at what rate.
//
// Wholesale REPLACES retail discounts rather than stacking with them. Loyalty and
// promotions are retail-side incentives; letting them compound on a wholesale rate
// is the one realistic route to selling below cost, and it would not announce
// itself — it would just show up as thinner margin months later.
import prisma from '@/lib/prisma';
import { resellerPrice, costKoboPer1k, resellerFloorKobo, bandLabelFor } from '@/lib/markup';
import { bandCapsFrom, ladderLive, pctForBand, resolveRate } from '@/lib/reseller-tiers';

/**
 * The caller's wholesale terms, or null if they are a normal retail customer.
 * Revoked profiles return null, so pricing reverts on their next order.
 */
export async function getResellerTerms(userId) {
  if (!userId) return null;
  try {
    const profile = await prisma.resellerProfile.findUnique({
      where: { userId },
      select: {
        enabled: true, discountPct: true,
        tierMode: true, tier: true, pinnedTier: true, seatForLife: true,
      },
    });
    if (!profile || !profile.enabled) return null;
    return profile;
  } catch {
    // Fail to RETAIL, never to a discount, and never by taking the order path
    // down. A reseller charged full price complains within the hour; a lookup
    // that throws would block every order, and one that failed open would give
    // wholesale to everyone silently.
    return null;
  }
}

/**
 * Everything the reseller price path reads: the markup settings and the ladder.
 *
 * Both prefixes, because `wholesaleOf` asks whether the ladder is live and what
 * the band caps are, and those keys are `reseller_*`. Fetching only `markup_*`
 * meant `ladderLive()` saw undefined and quietly answered no — the ladder would
 * have been switched on in Admin and changed nothing, which is a bug that looks
 * exactly like "the setting did not save".
 */
export async function getMarkupSettings() {
  const out = {};
  try {
    const rows = await prisma.setting.findMany({
      where: { OR: [{ key: { startsWith: 'markup_' } }, { key: { startsWith: 'reseller_' } }] },
    });
    rows.forEach(r => { out[r.key] = r.value; });
  } catch {
    // resellerPrice falls back to its built-in default rate when settings are
    // missing, which is the conservative direction.
  }
  return out;
}

/**
 * Wholesale price for one retail price, in kobo. Returns the retail price
 * unchanged when there are no terms, so callers can apply it unconditionally.
 *
 * `costPer1k` is the provider cost in USD cents, straight off the service row,
 * and it is what lets the margin floor apply — a flat discount off retail is
 * not a flat margin, because retail is not a flat markup. Pass it. Every
 * caller has the row the price came from, and
 * `tests/markup-reseller.test.js` asserts that none of them forget.
 *
 * Omitting it is not a soft failure: on the Ultra band a 30% rate leaves 4.8%
 * margin and 33.3% sells at cost, so a call site without a cost is a call site
 * that can sell below it.
 */
export function wholesaleOf(retailKobo, terms, settings, costKobo = null) {
  if (!terms) return retailKobo;

  // Before the ladder is switched on, terms.discountPct is the whole story and
  // this behaves exactly as it did. After, the rate comes from the tier and the
  // band cap comes from the service's own cost band — so the same reseller pays
  // 30% on a cheap service and 22% on the dearest, which is the point.
  if (!ladderLive(settings)) {
    return resellerPrice(retailKobo, settings, terms.discountPct, costKobo);
  }

  const { pct } = resolveRate(terms, settings);
  const band = bandLabelFor(costKobo, settings);
  const capped = pctForBand(pct, band, bandCapsFrom(settings));

  // A reseller on no rung pays retail. Passing 0 as an override rather than
  // returning early keeps one path through the pricing, so the rounding and the
  // floor behave the same for everybody.
  return resellerPrice(retailKobo, settings, capped, costKobo);
}

/** The per-1k kobo cost a catalogue row should hand to `wholesaleOf`. */
export { costKoboPer1k, resellerFloorKobo };
