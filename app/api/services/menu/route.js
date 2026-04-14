import { log } from "@/lib/logger";
import prisma from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';

export async function GET(req) {
  try {
    const session = await getCurrentUser();
    if (!session) return Response.json({ error: 'Not authenticated' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const platform = searchParams.get('platform');

    const where = { enabled: true };
    if (platform) where.platform = platform;

    const groups = await prisma.serviceGroup.findMany({
      where,
      orderBy: { sortOrder: 'asc' },
      include: {
        tiers: {
          where: { enabled: true },
          orderBy: { sortOrder: 'asc' },
          include: {
            service: {
              select: { id: true, apiId: true, name: true, min: true, max: true, refill: true, avgTime: true, provider: true },
            },
          },
        },
      },
    });

    // Get unique platforms for filter
    const platforms = await prisma.serviceGroup.findMany({
      where: { enabled: true },
      select: { platform: true },
      distinct: ['platform'],
      orderBy: { platform: 'asc' },
    });

    // Nitro minimum order floors (overrides provider min if lower)
    const NITRO_MINS = {
      followers: 100,
      likes: 50,
      views: 500,
      comments: 10,
      engagement: 50,   // shares, saves, retweets, reposts
      plays: 500,        // music streams — same as views
      reviews: 10,       // same as comments
    };
    const DEFAULT_MIN = 50;

    // Get user's loyalty discount
    let loyaltyDiscount = 0;
    let loyaltyTierName = null;
    try {
      const loyaltyEnabledRow = await prisma.setting.findUnique({ where: { key: 'loyalty_enabled' } });
      if (loyaltyEnabledRow?.value !== 'false') {
        const ltRow = await prisma.setting.findUnique({ where: { key: 'loyalty_tiers' } });
        if (ltRow) {
          const tiers = JSON.parse(ltRow.value);
          const spendAgg = await prisma.order.aggregate({ where: { userId: session.id, deletedAt: null }, _sum: { charge: true } });
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
      groups: groups.map(g => {
        const nitroMin = NITRO_MINS[g.type?.toLowerCase()] || DEFAULT_MIN;
        return {
          id: g.id,
          name: g.name,
          platform: g.platform,
          type: g.type,
          nigerian: g.nigerian,
          tiers: g.tiers.filter(t => t.service || t.serviceId).map(t => ({
            id: t.id,
            tier: t.tier,
            price: t.sellPer1k / 100,
            min: Math.max(t.service?.min || 100, nitroMin),
            max: t.service?.max || 100000,
            refill: t.refill,
            speed: t.speed,
            serviceId: t.serviceId,
            provider: t.service?.provider || 'mtp',
          })),
        };
      }).filter(g => g.tiers.length > 0),
      platforms: platforms.map(p => p.platform),
      ...(loyaltyDiscount > 0 ? { loyaltyDiscount, loyaltyTier: loyaltyTierName } : {}),
    });
  } catch (err) {
    log.error('Services Menu', err.message);
    return Response.json({ error: 'Failed to load services' }, { status: 500 });
  }
}
