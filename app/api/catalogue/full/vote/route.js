import prisma from '@/lib/prisma';
import { log } from '@/lib/logger';
import { getCurrentUser } from '@/lib/auth';

// One vote per customer per full-list service, and only from someone who has
// ordered it. The full list carries no Nitro testing and no delivery history
// to quote, so this is the only figure on it that means anything — which is
// exactly why it has to be earned rather than clicked by anyone passing.
//
//   POST { id: 2440, vote: 'up' | 'down' }
//
// Sending the vote already held clears it, so the same thumb is the toggle.

export async function POST(req) {
  try {
    const session = await getCurrentUser();
    if (!session) return Response.json({ error: 'Not authenticated' }, { status: 401 });

    let body;
    try { body = await req.json(); } catch { return Response.json({ error: 'Invalid request' }, { status: 400 }); }
    const apiId = Number(body?.id);
    const vote = body?.vote;
    if (!Number.isInteger(apiId) || !['up', 'down'].includes(vote)) {
      return Response.json({ error: 'Invalid request' }, { status: 400 });
    }

    const map = await prisma.resellerServiceMap.findUnique({
      where: { apiId },
      select: { serviceId: true, retiredAt: true },
    });
    if (!map?.serviceId || map.retiredAt) return Response.json({ error: 'Service not available' }, { status: 400 });
    const serviceId = map.serviceId;

    const hasOrdered = await prisma.order.findFirst({ where: { userId: session.id, serviceId }, select: { id: true } });
    if (!hasOrdered) return Response.json({ error: 'Order it first, then you can rate it' }, { status: 403 });

    const value = vote === 'up' ? 1 : -1;
    const existing = await prisma.serviceVote.findUnique({
      where: { userId_serviceId: { userId: session.id, serviceId } },
      select: { id: true, value: true },
    });

    let mine = vote;
    if (existing && existing.value === value) {
      await prisma.serviceVote.delete({ where: { id: existing.id } });
      mine = null;
    } else if (existing) {
      await prisma.serviceVote.update({ where: { id: existing.id }, data: { value } });
    } else {
      await prisma.serviceVote.create({ data: { userId: session.id, serviceId, value } });
    }

    const tally = await prisma.serviceVote.groupBy({
      by: ['serviceId'], where: { serviceId }, _count: { _all: true }, _sum: { value: true },
    });
    const n = tally[0]?._count._all || 0;
    const sum = Number(tally[0]?._sum.value) || 0;

    return Response.json({ id: apiId, up: (n + sum) / 2, down: (n - sum) / 2, mine });
  } catch (err) {
    log.error('FullCatalogueVote', err);
    return Response.json({ error: 'Could not save your rating' }, { status: 500 });
  }
}
