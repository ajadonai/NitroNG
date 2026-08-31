import prisma from '@/lib/prisma';
import { requireAdmin } from '@/lib/admin';

export async function GET(req) {
  const { error } = await requireAdmin('services');
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const days = Math.min(Math.max(parseInt(searchParams.get('days'), 10) || 7, 1), 90);
  const since = new Date(Date.now() - days * 86400000);

  const [rows, total, pinned] = await Promise.all([
    prisma.priceChange.findMany({
      where: { createdAt: { gte: since } },
      orderBy: { createdAt: 'desc' },
      take: 800,
    }),
    prisma.priceChange.count({ where: { createdAt: { gte: since } } }),
    prisma.serviceTier.count({ where: { pricePinned: true, enabled: true } }),
  ]);

  const changes = rows.map(r => ({
    id: r.id,
    tierId: r.tierId,
    groupName: r.groupName,
    platform: r.platform,
    tier: r.tier,
    provider: r.provider,
    oldSell: Number(r.oldSell),
    newSell: Number(r.newSell),
    oldCost: r.oldCost != null ? Number(r.oldCost) : null,
    newCost: r.newCost != null ? Number(r.newCost) : null,
    usdRate: r.usdRate,
    source: r.source,
    actor: r.actor,
    runId: r.runId,
    createdAt: r.createdAt,
  }));

  return Response.json({ changes, total, pinned, days });
}
