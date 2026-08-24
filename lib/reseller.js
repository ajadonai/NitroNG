// Who is on wholesale pricing, and at what rate.
//
// Wholesale REPLACES retail discounts rather than stacking with them. Loyalty and
// promotions are retail-side incentives; letting them compound on a wholesale rate
// is the one realistic route to selling below cost, and it would not announce
// itself — it would just show up as thinner margin months later.
import prisma from '@/lib/prisma';
import { resellerPrice } from '@/lib/markup';

/**
 * The caller's wholesale terms, or null if they are a normal retail customer.
 * Revoked profiles return null, so pricing reverts on their next order.
 */
export async function getResellerTerms(userId) {
  if (!userId) return null;
  try {
    const profile = await prisma.resellerProfile.findUnique({
      where: { userId },
      select: { enabled: true, catalog: true, discountPct: true },
    });
    if (!profile || !profile.enabled) return null;
    return { catalog: profile.catalog, discountPct: profile.discountPct };
  } catch {
    // Fail to RETAIL, never to a discount, and never by taking the order path
    // down. A reseller charged full price complains within the hour; a lookup
    // that throws would block every order, and one that failed open would give
    // wholesale to everyone silently.
    return null;
  }
}

/** Markup settings, which resellerPrice needs for the global rate. */
export async function getMarkupSettings() {
  const out = {};
  try {
    const rows = await prisma.setting.findMany({ where: { key: { startsWith: 'markup_' } } });
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
 */
export function wholesaleOf(retailKobo, terms, settings) {
  if (!terms) return retailKobo;
  return resellerPrice(retailKobo, settings, terms.discountPct);
}
