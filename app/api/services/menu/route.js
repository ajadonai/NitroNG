import { log } from "@/lib/logger";
import { getCurrentUser } from '@/lib/auth';
import { getServiceCatalogue } from '@/lib/service-catalog';
import { getEligibleSpendKobo, getNitroStatus } from '@/lib/nitro-rewards';
import { getResellerTerms, getMarkupSettings, wholesaleOf } from '@/lib/reseller';

export async function GET(req) {
  try {
    const session = await getCurrentUser();
    if (!session) return Response.json({ error: 'Not authenticated' }, { status: 401 });

    const catalogue = await getServiceCatalogue();
    const platform = new URL(req.url).searchParams.get('platform');
    const groups = platform ? catalogue.groups.filter(g => g.platform === platform) : catalogue.groups;

    // Wholesale prices are applied after the cache read, not baked into it. The
    // catalogue is shared by every user and rates differ per reseller, so a
    // cached copy could only ever be right for one of them. New objects
    // throughout — mutating these would poison the cache for everyone.
    const terms = await getResellerTerms(session.id);
    let priced = groups;
    if (terms) {
      const settings = await getMarkupSettings();
      priced = groups.map(g => ({
        ...g,
        tiers: g.tiers.map(t => ({
          ...t,
          // Stored in naira here, and resellerPrice works in kobo.
          price: wholesaleOf(Math.round(t.price * 100), terms, settings) / 100,
        })),
      }));
    }

    // Loyalty is a retail incentive; wholesale replaces it rather than stacking,
    // so a reseller must not be shown a discount the charge will not honour.
    let loyaltyDiscount = 0;
    let loyaltyTierName = null;
    if (!terms) {
      try {
        const spendKobo = await getEligibleSpendKobo(session.id);
        const tier = getNitroStatus(Math.floor(spendKobo / 100));
        if (tier.discountPct > 0) {
          loyaltyDiscount = tier.discountPct;
          loyaltyTierName = tier.name;
        }
      } catch {}
    }

    return Response.json({
      groups: priced,
      platforms: catalogue.platforms,
      ...(terms ? { reseller: true, catalog: terms.catalog } : {}),
      ...(loyaltyDiscount > 0 ? { loyaltyDiscount, loyaltyTier: loyaltyTierName } : {}),
    });
  } catch (err) {
    log.error('Services Menu', err.message);
    return Response.json({ error: 'Failed to load services' }, { status: 500 });
  }
}
