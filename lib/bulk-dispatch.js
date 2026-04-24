import prisma from '@/lib/prisma';
import { log } from '@/lib/logger';
import { placeOrder } from '@/lib/smm';
import { calculateDripFeed } from '@/lib/drip-feed';

export async function placeWithProvider(order) {
  const service = order.service;
  if (!service?.apiId) return null;

  const provider = service.provider || 'mtp';
  const sName = (order.tier?.group?.name || service.name || '').toLowerCase();
  const extra = {};

  if (order.comments) {
    if (sName.includes('mention')) extra.usernames = order.comments;
    else if (sName.includes('poll') || sName.includes('vote')) extra.answer_number = order.comments;
    else extra.comments = order.comments;
  }

  const dripFeed = calculateDripFeed(service.category, order.quantity);
  if (dripFeed) { extra.runs = dripFeed.runs; extra.interval = dripFeed.interval; }

  const result = await placeOrder(provider, service.apiId, order.link, order.quantity, extra);
  const apiOrderId = result.order ? String(result.order) : null;

  if (apiOrderId) {
    await prisma.order.update({
      where: { id: order.id },
      data: { apiOrderId, status: 'Processing', dispatchedAt: new Date() },
    });
  }

  return apiOrderId;
}
