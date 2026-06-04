import prisma from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';
import { refillOrder } from '@/lib/smm';
import { log } from '@/lib/logger';

export async function POST(req) {
  const session = await getCurrentUser();
  if (!session?.id) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { orderId } = await req.json();
  if (!orderId) return Response.json({ error: 'Missing orderId' }, { status: 400 });

  const order = await prisma.order.findFirst({
    where: { orderId, userId: session.id, deletedAt: null },
    include: {
      service: { select: { provider: true } },
      tier: { select: { refill: true, refillDays: true } },
    },
  });

  if (!order) return Response.json({ error: 'Order not found' }, { status: 404 });
  if (order.status !== 'Completed') return Response.json({ error: 'Only completed orders can be refilled' }, { status: 400 });
  if (!order.apiOrderId) return Response.json({ error: 'Order has no provider reference' }, { status: 400 });
  if (!order.tier?.refill) return Response.json({ error: 'This service does not support refills' }, { status: 400 });

  const refillDays = order.tier.refillDays || 30;
  const completedAt = order.completedAt || order.updatedAt;
  const expiresAt = new Date(completedAt.getTime() + refillDays * 24 * 60 * 60 * 1000);

  if (new Date() > expiresAt) {
    return Response.json({ error: 'Refill is no longer available for this order. Please contact support if you need help.' }, { status: 400 });
  }

  const provider = order.service?.provider || 'mtp';

  try {
    const result = await refillOrder(provider, order.apiOrderId);
    if (result?.error) {
      log.warn(`User refill ${order.orderId}`, result.error);
      return Response.json({ error: result.error }, { status: 400 });
    }

    log.info('User refill', `${session.email} requested refill for ${order.orderId}`);
    return Response.json({ success: true, message: 'Refill requested — delivery will begin shortly' });
  } catch (err) {
    log.warn(`User refill ${order.orderId}`, err.message);
    return Response.json({ error: 'Failed to request refill. Please try again or contact support.' }, { status: 500 });
  }
}
