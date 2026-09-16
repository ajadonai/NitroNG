import { log } from "@/lib/logger";
import { getCurrentUser } from '@/lib/auth';
import { getServiceCatalogue } from '@/lib/service-catalog';
import { getEligibleSpendKobo, getNitroStatus } from '@/lib/nitro-rewards';
import { getResellerTerms, getMarkupSettings, wholesaleOf, costKoboPer1k } from '@/lib/reseller';
import prisma from '@/lib/prisma';

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
      // Costs are fetched here rather than cached on the catalogue, because the
      // catalogue is one shared object served to every customer and provider
      // cost is the last thing that should ride along in it. One query, keyed
      // by the serviceIds already on the tiers, and it only runs for resellers.
      const ids = [...new Set(groups.flatMap(g => g.tiers.map(t => t.serviceId).filter(Boolean)))];
      const costRows = ids.length
        ? await prisma.service.findMany({ where: { id: { in: ids } }, select: { id: true, costPer1k: true } })
        : [];
      const costOf = new Map(costRows.map(r => [r.id, costKoboPer1k(r.costPer1k, settings)]));
      priced = groups.map(g => ({
        ...g,
        tiers: g.tiers.map(t => ({
          ...t,
          // Stored in naira here, and resellerPrice works in kobo.
          price: wholesaleOf(Math.round(t.price * 100), terms, settings, costOf.get(t.serviceId) ?? null) / 100,
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
      ...(terms ? { reseller: true } : {}),
      ...(loyaltyDiscount > 0 ? { loyaltyDiscount, loyaltyTier: loyaltyTierName } : {}),
    });
  } catch (err) {
    log.error('Services Menu', err.message);
    return Response.json({ error: 'Failed to load services' }, { status: 500 });
  }
}
