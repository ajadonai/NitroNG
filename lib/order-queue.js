const OPEN_ORDER_STATUSES = ['Pending', 'Processing', 'Dispatching', 'In progress'];
const IN_FLIGHT_DRIP_STATUSES = ['dispatching', 'processing'];
export const PROVIDER_ACTIVE_WAIT = 'provider_active_wait';

export function isActiveOrderConflict(error) {
  const message = typeof error === 'string' ? error : error?.message;
  return /active order|wait until order/i.test(message || '');
}

export async function findOpenSameLinkOrder(db, { serviceId, link, excludeOrderId = null }) {
  if (!serviceId || !link) return null;

  return db.order.findFirst({
    where: {
      serviceId,
      link,
      deletedAt: null,
      status: { in: OPEN_ORDER_STATUSES },
      ...(excludeOrderId ? { id: { not: excludeOrderId } } : {}),
    },
    select: { orderId: true },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
  });
}

export async function wouldCreateCycle(db, orderId, proposedBlockerId) {
  if (!proposedBlockerId || proposedBlockerId === orderId) return true;
  let current = proposedBlockerId;
  const visited = new Set([orderId]);
  while (current) {
    if (visited.has(current)) return true;
    visited.add(current);
    const next = await db.order.findUnique({
      where: { orderId: current },
      select: { queuedBehind: true },
    });
    current = next?.queuedBehind;
    if (visited.size > 20) return true;
  }
  return false;
}

export async function findSameLinkDispatchBlocker(db, order) {
  if (!order?.serviceId || !order?.link || !order?.id) return null;

  const earlierOrder = order.createdAt
    ? [
        { createdAt: { lt: order.createdAt } },
        { AND: [{ createdAt: order.createdAt }, { id: { lt: order.id } }] },
      ]
    : [];

  return db.order.findFirst({
    where: {
      id: { not: order.id },
      serviceId: order.serviceId,
      link: order.link,
      deletedAt: null,
      status: { in: OPEN_ORDER_STATUSES },
      OR: [
        ...earlierOrder,
        { apiOrderId: { not: null } },
        { status: 'Dispatching' },
        { dripDispatches: { some: { status: { in: IN_FLIGHT_DRIP_STATUSES } } } },
      ],
    },
    select: { orderId: true },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
  });
}
