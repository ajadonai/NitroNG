import prisma from '@/lib/prisma';
import { log } from '@/lib/logger';
import { getCurrentUser } from '@/lib/auth';

// What this customer has bought before, and what they have kept.
//
// Its own endpoint because none of it can live in the shared menu:
// /api/services/menu is cached across every user, so nothing per-person may go
// in it.
//
//   services  { [apiId]: { times } }  the full list, by the public ID the row shows
//   saved     [apiId]                 kept services
//
// The full list only. Nitro picks carried this briefly and should not have:
// nineteen services fit on one screen, so "find it again" is not a problem
// there, and a marker on every card the most active customers use made the list
// busier for exactly the people it was meant to help.
//
// The count and not the date, for the same reason — "last week" does not change
// what anybody orders. It needs no new table either: the orders have been there
// all along, nobody had asked them this.

export async function GET() {
  try {
    const session = await getCurrentUser();
    if (!session) return Response.json({ error: 'Not authenticated' }, { status: 401 });

    const [byService, saved] = await Promise.all([
      prisma.order.groupBy({
        by: ['serviceId'],
        where: { userId: session.id, deletedAt: null, tierId: null },
        _count: { _all: true },
      }),
      prisma.serviceFavourite.findMany({
        where: { userId: session.id },
        select: { service: { select: { resellerMap: { select: { apiId: true } } } } },
      }),
    ]);

    // Full-list orders name their service directly. The public ID is what the
    // row shows, so that is the key the client can match on.
    const services = {};
    if (byService.length) {
      const maps = await prisma.resellerServiceMap.findMany({
        where: { serviceId: { in: byService.map(s => s.serviceId) } },
        select: { apiId: true, serviceId: true },
      });
      const apiOf = new Map(maps.map(m => [m.serviceId, m.apiId]));
      for (const row of byService) {
        const apiId = apiOf.get(row.serviceId);
        if (apiId) services[apiId] = { times: row._count._all };
      }
    }

    return Response.json({
      services,
      saved: saved.map(f => f.service?.resellerMap?.apiId).filter(Boolean),
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    log.error('OrdersMine', err);
    return Response.json({ error: 'Could not load your history' }, { status: 500 });
  }
}
