import { log } from "@/lib/logger";
import { getCurrentUser } from '@/lib/auth';
import { getServiceCatalogue } from '@/lib/service-catalog';
import { getEligibleSpendKobo, getNitroStatus } from '@/lib/nitro-rewards';

export async function GET(req) {
  try {
    const session = await getCurrentUser();
    if (!session) return Response.json({ error: 'Not authenticated' }, { status: 401 });

    const catalogue = await getServiceCatalogue();
    const platform = new URL(req.url).searchParams.get('platform');
    const groups = platform ? catalogue.groups.filter(g => g.platform === platform) : catalogue.groups;

    let loyaltyDiscount = 0;
    let loyaltyTierName = null;
    try {
      const spendKobo = await getEligibleSpendKobo(session.id);
      const tier = getNitroStatus(Math.floor(spendKobo / 100));
      if (tier.discountPct > 0) {
        loyaltyDiscount = tier.discountPct;
        loyaltyTierName = tier.name;
      }
    } catch {}

    return Response.json({
      groups,
      platforms: catalogue.platforms,
      ...(loyaltyDiscount > 0 ? { loyaltyDiscount, loyaltyTier: loyaltyTierName } : {}),
    });
  } catch (err) {
    log.error('Services Menu', err.message);
    return Response.json({ error: 'Failed to load services' }, { status: 500 });
  }
}
