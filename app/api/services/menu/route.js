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
              select: { id: true, apiId: true, name: true, min: true, max: true, refill: true, avgTime: true },
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

    return Response.json({
      groups: groups.map(g => ({
        id: g.id,
        name: g.name,
        platform: g.platform,
        type: g.type,
        nigerian: g.nigerian,
        tiers: g.tiers.filter(t => t.service || t.serviceId).map(t => ({
          id: t.id,
          tier: t.tier,
          price: t.sellPer1k / 100,
          min: t.service?.min || 100,
          max: t.service?.max || 100000,
          refill: t.refill,
          speed: t.speed,
          serviceId: t.serviceId,
        })),
      })).filter(g => g.tiers.length > 0),
      platforms: platforms.map(p => p.platform),
    });
  } catch (err) {
    console.error('[Services Menu]', err.message);
    return Response.json({ error: 'Failed to load services' }, { status: 500 });
  }
}
