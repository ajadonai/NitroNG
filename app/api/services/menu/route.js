import { log } from "@/lib/logger";
import prisma from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';
import { getServiceCatalogue } from '@/lib/service-catalog';

export async function GET(req) {
  try {
    const session = await getCurrentUser();
    if (!session) return Response.json({ error: 'Not authenticated' }, { status: 401 });

    const catalogue = await getServiceCatalogue();
    const platform = new URL(req.url).searchParams.get('platform');
    const groups = platform ? catalogue.groups.filter(g => g.platform === platform) : catalogue.groups;

    // Get user's loyalty discount
    let loyaltyDiscount = 0;
    let loyaltyTierName = null;
    try {
      const [settings, spendAgg] = await Promise.all([
        prisma.setting.findMany({ where: { key: { in: ['loyalty_enabled', 'loyalty_tiers'] } }, select: { key: true, value: true } }),
        prisma.order.aggregate({ where: { userId: session.id, deletedAt: null, status: { not: 'Cancelled' } }, _sum: { charge: true } }),
      ]);
      const settingMap = Object.fromEntries(settings.map(s => [s.key, s.value]));
      const loyaltyEnabledRow = settingMap.loyalty_enabled;
      if (loyaltyEnabledRow !== 'false') {
        const ltRow = settingMap.loyalty_tiers;
        if (ltRow) {
          const tiers = JSON.parse(ltRow);
          const totalSpend = spendAgg._sum.charge || 0;
          let userTier = tiers[0];
          for (const t2 of tiers) { if (totalSpend >= t2.threshold) userTier = t2; }
          if (userTier.discount > 0) {
            loyaltyDiscount = userTier.discount;
            loyaltyTierName = userTier.name;
          }
        }
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
