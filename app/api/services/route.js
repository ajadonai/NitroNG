import { log } from "@/lib/logger";
import prisma from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';
import { getPublicServiceLabel } from '@/lib/public-service-label';

export async function GET() {
  try {
    const session = await getCurrentUser();
    if (!session) return Response.json({ error: 'Not authenticated' }, { status: 401 });

    const services = await prisma.service.findMany({
      where: { enabled: true },
      orderBy: { category: 'asc' },
      select: {
        id: true, name: true, category: true,
        sellPer1k: true, min: true, max: true,
        refill: true, avgTime: true,
      },
    });

    return Response.json({
      services: services.map(s => ({
        id: s.id,
        name: getPublicServiceLabel(s.name, s.category),
        category: s.category,
        platform: s.category.toLowerCase().replace('twitter/x', 'twitter'),
        rate: Number(s.sellPer1k) / 100,
        min: s.min,
        max: s.max,
        refill: s.refill,
        avg_time: s.avgTime,
      })),
    });
  } catch (err) {
    log.error('Services', err.message);
    return Response.json({ error: 'Failed to load services' }, { status: 500 });
  }
}
