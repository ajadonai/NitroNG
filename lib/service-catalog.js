import { revalidateTag, unstable_cache } from 'next/cache';
import prisma from '@/lib/prisma';
import { effectiveOrderMinimum } from '@/lib/order-minimums';

export const getServiceCatalogue = unstable_cache(async () => {
  const [groups, platforms] = await Promise.all([
    prisma.serviceGroup.findMany({
      where: { enabled: true },
      orderBy: { sortOrder: 'asc' },
      include: {
        tiers: {
          where: { enabled: true },
          orderBy: { sortOrder: 'asc' },
          include: {
            service: {
              select: { id: true, apiId: true, name: true, min: true, max: true, refill: true, dripfeed: true, avgTime: true, apiType: true },
            },
          },
        },
      },
    }),
    prisma.serviceGroup.findMany({
      where: { enabled: true },
      select: { platform: true },
      distinct: ['platform'],
      orderBy: { platform: 'asc' },
    }),
  ]);

  return {
    groups: groups.map(g => {
      return {
        id: g.id,
        name: g.name,
        platform: g.platform,
        type: g.type,
        nigerian: g.nigerian,
        ...(g.description ? { description: g.description } : {}),
        tiers: g.tiers.filter(t => t.service || t.serviceId).map(t => ({
          id: t.id,
          tier: t.tier,
          price: Number(t.sellPer1k) / 100,
          min: effectiveOrderMinimum(g.type, t.service?.min, t.service?.max),
          max: t.service?.max || 100000,
          refill: t.refill,
          speed: t.speed,
          serviceId: t.serviceId,
          apiType: t.service?.apiType || 'Default',
          customComments: t.customComments,
          trafficTargeting: t.trafficTargeting,
          tags: g.tags || [],
        })),
      };
    }).filter(g => g.tiers.length > 0),
    platforms: platforms.map(p => p.platform),
  };
}, ['service-catalog-v1'], { revalidate: 60, tags: ['service-catalog'] });

export function invalidateServiceCatalogue() {
  try {
    revalidateTag('service-catalog');
  } catch {
    // The 60-second TTL remains the fallback if cache invalidation is unavailable.
  }
}
