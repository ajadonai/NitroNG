const OPEN_ORDER_STATUSES = ['Pending', 'Processing', 'Dispatching', 'In progress'];
const IN_FLIGHT_DRIP_STATUSES = ['dispatching', 'processing', 'verifying', 'cancelling'];
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

/**
 * Resolve FIFO blockers for a bounded retry set with one database query.
 * The lateral subquery returns at most one blocker per candidate, so the
 * result size is bounded by the retry set rather than all matching orders.
 */
export async function findSameLinkDispatchBlockers(db, orders) {
  const candidates = [...new Map(
    (orders || [])
      .filter(order => order?.id && order?.serviceId && order?.link)
      .map(order => [order.id, order]),
  ).values()];
  if (candidates.length === 0) return new Map();

  const values = [];
  const params = [];
  for (let index = 0; index < candidates.length; index++) {
    const base = index * 4;
    const order = candidates[index];
    values.push(`($${base + 1}::text, $${base + 2}::text, $${base + 3}::text, $${base + 4}::timestamp(3))`);
    params.push(order.id, order.serviceId, order.link, order.createdAt || null);
  }

  const rows = await db.$queryRawUnsafe(
    `WITH candidates(id, service_id, link, created_at) AS (
       VALUES ${values.join(',')}
     )
     SELECT c.id AS "candidateId", blocker."orderId" AS "blockerOrderId"
     FROM candidates c
     JOIN LATERAL (
       SELECT o."orderId"
       FROM orders o
       WHERE o.id <> c.id
         AND o."serviceId" = c.service_id
         AND o.link = c.link
         AND o."deletedAt" IS NULL
         AND o.status IN ('Pending', 'Processing', 'Dispatching', 'In progress')
         AND (
           (
             c.created_at IS NOT NULL
             AND (
               o."createdAt" < c.created_at
               OR (o."createdAt" = c.created_at AND o.id < c.id)
             )
           )
           OR o."apiOrderId" IS NOT NULL
           OR o.status = 'Dispatching'
           OR EXISTS (
             SELECT 1
             FROM drip_dispatches d
             WHERE d."orderId" = o.id
               AND d.status IN ('dispatching', 'processing', 'verifying', 'cancelling')
           )
         )
       ORDER BY o."createdAt" ASC, o.id ASC
       LIMIT 1
     ) blocker ON TRUE`,
    ...params,
  );

  return new Map(rows.map(row => [
    row.candidateId,
    { orderId: row.blockerOrderId },
  ]));
}

/**
 * Atomically claim a retry candidate only if its observed queue state is
 * unchanged and no same-link FIFO/provider blocker exists at write time.
 */
export async function claimSameLinkRetryOrder(db, order, claimedAt = new Date()) {
  if (!order?.id || !order?.updatedAt) return false;

  const rows = await db.$queryRawUnsafe(
    `UPDATE orders AS candidate
     SET status = 'Dispatching',
         "dispatchedAt" = $2::timestamp(3),
         "queuedBehind" = NULL,
         "updatedAt" = NOW()
     WHERE candidate.id = $1::text
       AND candidate.status = 'Pending'
       AND candidate."apiOrderId" IS NULL
       AND candidate."dripDays" IS NULL
       AND candidate."deletedAt" IS NULL
       AND candidate."queuedBehind" IS NOT DISTINCT FROM $3::text
       AND candidate."updatedAt" = $4::timestamp(3)
       AND NOT EXISTS (
         SELECT 1
         FROM drip_dispatches own_dispatch
         WHERE own_dispatch."orderId" = candidate.id
       )
       AND NOT EXISTS (
         SELECT 1
         FROM orders blocker
         WHERE blocker.id <> candidate.id
           AND blocker."serviceId" = candidate."serviceId"
           AND blocker.link = candidate.link
           AND blocker."deletedAt" IS NULL
           AND blocker.status IN ('Pending', 'Processing', 'Dispatching', 'In progress')
           AND (
             blocker."createdAt" < candidate."createdAt"
             OR (
               blocker."createdAt" = candidate."createdAt"
               AND blocker.id < candidate.id
             )
             OR blocker."apiOrderId" IS NOT NULL
             OR blocker.status = 'Dispatching'
             OR EXISTS (
               SELECT 1
               FROM drip_dispatches in_flight
               WHERE in_flight."orderId" = blocker.id
                 AND in_flight.status IN ('dispatching', 'processing', 'verifying', 'cancelling')
             )
           )
       )
     RETURNING candidate.id`,
    order.id,
    claimedAt,
    order.queuedBehind || null,
    order.updatedAt,
  );

  return rows.length === 1;
}
