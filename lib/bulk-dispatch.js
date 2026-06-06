import prisma from '@/lib/prisma';
import { log } from '@/lib/logger';
import { placeOrder } from '@/lib/smm';
import { calculateDripFeed } from '@/lib/drip-feed';

export async function placeWithProvider(order) {
  const service = order.service;
  if (!service?.apiId) return null;

  if (process.env.NODE_ENV === 'development') {
    const fakeId = `DEV-${Date.now()}`;
    await prisma.order.update({ where: { id: order.id }, data: { apiOrderId: fakeId, status: 'Processing', dispatchedAt: new Date() } });
    return fakeId;
  }

  const provider = service.provider || 'mtp';
  const sName = (order.tier?.group?.name || service.name || '').toLowerCase();
  const extra = {};

  if (order.comments) {
    if (sName.includes('mention')) extra.usernames = order.comments;
    else if (sName.includes('poll') || sName.includes('vote')) extra.answer_number = order.comments;
    else extra.comments = order.comments;
  }

  let orderQty = order.quantity;

  if (service.dripfeed) {
    const dripFeed = calculateDripFeed(service.category, order.quantity);
    if (dripFeed) {
      orderQty = Math.ceil(order.quantity / dripFeed.runs);
      extra.runs = dripFeed.runs;
      extra.interval = dripFeed.interval;
    }
  }

  const result = await placeOrder(provider, service.apiId, order.link, orderQty, extra);
  const apiOrderId = result.order ? String(result.order) : null;

  if (apiOrderId) {
    await prisma.order.update({
      where: { id: order.id },
      data: { apiOrderId, status: 'Processing', dispatchedAt: new Date() },
    });
  }

  return apiOrderId;
}
