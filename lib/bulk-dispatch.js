import prisma from '@/lib/prisma';
import { log } from '@/lib/logger';
import { placeOrder } from '@/lib/smm';

export async function placeWithProvider(order) {
  const service = order.service;
  if (!service?.apiId) return null;

  if (process.env.NODE_ENV === 'development') {
    const fakeId = `DEV-${Date.now()}`;
    await prisma.order.updateMany({
      where: { id: order.id, status: 'Dispatching', apiOrderId: null, deletedAt: null },
      data: { apiOrderId: fakeId, status: 'Processing', dispatchedAt: new Date() },
    });
    return fakeId;
  }

  const provider = service.provider || 'mtp';
  const apiType = (service.apiType || '').toLowerCase();
  const extra = {};

  if (order.comments) {
    if (apiType === 'seo') extra.keywords = order.comments;
    else if (apiType.includes('mention')) extra.usernames = order.comments;
    else if (apiType === 'poll') extra.answer_number = order.comments;
    else extra.comments = order.comments;
  }

  // Subscriptions services use username + min/max instead of quantity
  if (apiType === 'subscriptions') {
    const match = order.link.match(/instagram\.com\/([^/?#]+)/);
    if (match) extra.username = match[1];
    extra.min = order.quantity;
    extra.max = order.quantity;
  }

  const result = await placeOrder(provider, service.apiId, order.link, order.quantity, extra);
  const apiOrderId = result.order ? String(result.order) : null;

  if (apiOrderId) {
    const recorded = await prisma.order.updateMany({
      where: { id: order.id, status: 'Dispatching', apiOrderId: null, deletedAt: null },
      data: { apiOrderId, status: 'Processing', dispatchedAt: new Date(), lastError: null },
    });
    if (recorded.count === 0) {
      log.warn('Provider dispatch fence', `Provider accepted ${apiOrderId} after local order ${order.id} became terminal`);
      prisma.adminIssue.create({
        data: {
          type: 'ghost_dispatch',
          title: `Provider order ${apiOrderId} accepted after local cancellation`,
          message: `The provider accepted an order after its local state became terminal. Verify the provider order before taking further action.`,
          metadata: JSON.stringify({ orderDbId: order.id, providerOrderId: apiOrderId, link: order.link }),
        },
      }).catch(() => {});
    }
  }

  return apiOrderId;
}
