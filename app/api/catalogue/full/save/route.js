import prisma from '@/lib/prisma';
import { log } from '@/lib/logger';
import { getCurrentUser } from '@/lib/auth';

// Keep a full-list service, or let it go.
//
//   POST { id: 3624, on: true | false }
//
// Unlike a vote this is not earned. A vote is a claim other customers read, so
// it takes an order to make one; keeping something is private, costs nobody
// anything, and is most useful precisely for the service you have not bought
// yet — which is the whole reason browsing 934 rows needs it.
//
// The fence is the same as the list's: a service nobody can reach should not be
// keepable, or the saved list fills with rows that no longer exist.

export async function POST(req) {
  try {
    const session = await getCurrentUser();
    if (!session) return Response.json({ error: 'Not authenticated' }, { status: 401 });

    let body;
    try { body = await req.json(); } catch { return Response.json({ error: 'Invalid request' }, { status: 400 }); }
    const apiId = Number(body?.id);
    const on = body?.on;
    if (!Number.isInteger(apiId) || typeof on !== 'boolean') {
      return Response.json({ error: 'Invalid request' }, { status: 400 });
    }

    const map = await prisma.resellerServiceMap.findUnique({
      where: { apiId },
      select: { serviceId: true, retiredAt: true },
    });
    if (!map?.serviceId || map.retiredAt) return Response.json({ error: 'Service not available' }, { status: 400 });
    const serviceId = map.serviceId;

    if (on) {
      // Saving twice is saving once, not an error.
      await prisma.serviceFavourite.upsert({
        where: { userId_serviceId: { userId: session.id, serviceId } },
        create: { userId: session.id, serviceId },
        update: {},
      });
    } else {
      await prisma.serviceFavourite.deleteMany({ where: { userId: session.id, serviceId } });
    }

    return Response.json({ id: apiId, saved: on });
  } catch (err) {
    log.error('FullCatalogueSave', err);
    return Response.json({ error: 'Could not save that' }, { status: 500 });
  }
}
