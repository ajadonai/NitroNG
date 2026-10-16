import prisma from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';
import { refillOrder } from '@/lib/smm';
import { log } from '@/lib/logger';
import { canRequestRefill, refillPromiseDays } from '@/lib/refill-promise';
import { getOrderOfferDisplay } from '@/lib/order-offer-display';
import { tgFlush, tgRefillRequest } from '@/lib/telegram';

export async function POST(req) {
  const session = await getCurrentUser();
  if (!session?.id) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  let body;
  try { body = await req.json(); } catch { return Response.json({ error: 'Invalid request body' }, { status: 400 }); }
  return refillOrderForSession(session, body?.orderId);
}

/**
 * A customer asks for a refill on one of their completed orders; shared with
 * the reseller API.
 *
 * Who may ask follows the tier name they bought (lib/refill-promise): Standard
 * for thirty days, Premium for life, Budget never. That is the Nitro promise,
 * and Nitro honours it whatever the provider offers. So a request is accepted
 * on the promise alone. Where the provider does offer a refill it is sent to
 * them straight away; where it does not, or they refuse it, an admin does it by
 * hand. Every request reaches Telegram either way, saying which it is, because
 * the by-hand ones used to arrive nowhere.
 */
export async function refillOrderForSession(session, orderId) {
  if (!orderId) return Response.json({ error: 'Missing orderId' }, { status: 400 });

  const order = await prisma.order.findFirst({
    where: { orderId, userId: session.id, deletedAt: null },
    include: {
      service: { select: { provider: true, name: true, category: true } },
      tier: { select: { tier: true, refill: true, group: { select: { name: true, platform: true, type: true } } } },
    },
  });

  if (!order) return Response.json({ error: 'Order not found' }, { status: 404 });
  if (order.status !== 'Completed') return Response.json({ error: 'Only completed orders can be refilled' }, { status: 400 });

  const offer = getOrderOfferDisplay(order);
  const completedAt = order.completedAt || order.updatedAt;
  if (!canRequestRefill({ status: order.status, completedAt, tierName: offer.tierLabel })) {
    return refillPromiseDays(offer.tierLabel) === 0
      ? Response.json({ error: 'This order has no refill.' }, { status: 400 })
      : Response.json({ error: 'The refill window for this order has closed. Message us on WhatsApp if you need help.' }, { status: 400 });
  }

  // One request at a time, until an admin resets it (admin orders: reset_refill).
  if (order.refillRequestedAt) {
    return Response.json({ error: 'A refill is already in progress for this order.' }, { status: 400 });
  }

  // Pass it straight to the provider when they offer a refill on this service.
  // A refusal is not the customer's problem: the promise still stands, so the
  // request is recorded and an admin picks it up from Telegram.
  let sentToProvider = false;
  let providerError = null;
  if (order.tier?.refill && order.apiOrderId) {
    try {
      await refillOrder(order.service?.provider || 'mtp', order.apiOrderId);
      sentToProvider = true;
    } catch (err) {
      providerError = err.message || 'unknown error';
      // "Refill already…" means the provider is already on it.
      if (/Refill already/i.test(providerError)) { sentToProvider = true; providerError = null; }
      else log.warn(`User refill ${order.orderId}`, providerError);
    }
  }

  await prisma.order.update({ where: { id: order.id }, data: { refillRequestedAt: new Date(), refillHandledAt: null } });
  log.info('User refill', `${session.email} requested refill for ${order.orderId} (${sentToProvider ? 'sent to provider' : 'manual'})`);
  tgRefillRequest({
    orderId: order.orderId,
    user: session.name || session.email,
    service: offer.serviceName,
    tier: offer.tierLabel,
    qty: order.quantity,
    link: order.link,
    sentToProvider,
    providerError,
  });
  // Before returning, or the platform can end the request before Telegram hears.
  await tgFlush();

  return Response.json({ success: true, message: 'Refill requested. We’ll top it up shortly.' });
}
