import prisma from '@/lib/prisma';
import { log } from '@/lib/logger';
import { placeOrder } from '@/lib/smm';

export async function placeWithProvider(order) {
  const service = order.service;
  if (!service?.apiId) return null;

  if (process.env.NODE_ENV === 'development') {
    const fakeId = `DEV-${Date.now()}`;
    await prisma.order.update({ where: { id: order.id }, data: { apiOrderId: fakeId, status: 'Processing', dispatchedAt: new Date() } });
    return fakeId;
  }

  const provider = service.provider || 'mtp';
  const apiType = (service.apiType || '').toLowerCase();
  const extra = {};

  if (order.comments) {
    if (apiType.includes('mention')) extra.usernames = order.comments;
    else if (apiType === 'poll') extra.answer_number = order.comments;
    else extra.comments = order.comments;
  }

  // Subscriptions services expect a username param extracted from the profile URL
  if (apiType === 'subscriptions') {
    const match = order.link.match(/instagram\.com\/([^/?#]+)/);
    if (match) extra.username = match[1];
  }

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
