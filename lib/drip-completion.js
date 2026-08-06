import { rescheduleRemaining, getDripConfig } from '@/lib/drip-feed';
import { lockOrderSettlementAccount } from '@/lib/account-deletion';

const TERMINAL_STATES = ['Cancelled', 'Completed', 'Partial'];

export function normalizeProviderStatus(providerStatus) {
  if (!providerStatus) return null;
  const s = providerStatus.trim().toLowerCase();
  if (s === 'completed' || s === 'complete') return 'completed';
  if (s === 'partial' || s === 'partially completed') return 'partial';
  if (s === 'cancelled' || s === 'canceled' || s === 'refunded') return 'cancelled';
  if (s === 'failed' || s === 'rejected' || s === 'fail') return 'failed';
  if (s === 'processing' || s === 'in progress' || s === 'pending') return 'processing';
  return null;
}

export function computeChildDelivery(children, parentQuantity) {
  let delivered = 0;
  for (const c of children) {
    const qty = Number(c.quantity);
    const rem = c.remains != null ? Number(c.remains) : null;
    if (c.status === 'completed') {
      delivered += rem != null ? Math.max(0, qty - rem) : qty;
    } else if (['partial', 'processing', 'failed', 'cancelled', 'superseded', 'cancelling'].includes(c.status)) {
      if (rem != null) delivered += Math.max(0, qty - rem);
    }
  }
  if (parentQuantity != null) delivered = Math.min(delivered, Number(parentQuantity));
  return delivered;
}

const LEGACY_REPLACED_RE = /^replaced:#\d+$/;

export function computeDripRollup(dispatches) {
  const active = dispatches.filter(d =>
    d.status !== 'superseded' &&
    !(d.lastError && LEGACY_REPLACED_RE.test(d.lastError)),
  );

  const totalRemains = active.reduce((sum, d) => {
    if (d.remains != null) return sum + d.remains;
    if (d.status === 'completed') return sum;
    return sum + d.quantity;
  }, 0);

  const allDone = active.length > 0 &&
    active.every(d => {
      if (['completed', 'partial', 'cancelled'].includes(d.status)) return true;
      if (d.status === 'failed') {
        if (d.lastError?.startsWith('[TIMEOUT]') || d.lastError?.startsWith('[VERIFY_STALE]')) return false;
        return true;
      }
      return false;
    });

  let status = null;
  if (allDone) {
    const hasFailed = active.some(d => d.status === 'failed');
    const hasCancelled = active.some(d => d.status === 'cancelled');
    const hasPartial = active.some(d => d.status === 'partial');
    const hasCompleted = active.some(d => d.status === 'completed');
    let hasDelivery = hasCompleted || hasPartial;
    if (!hasDelivery) {
      hasDelivery = dispatches.some(d =>
        (d.status === 'superseded' || (d.lastError && LEGACY_REPLACED_RE.test(d.lastError))) &&
        d.remains != null && Number(d.remains) < Number(d.quantity),
      );
    }
    if (hasFailed || hasCancelled) {
      status = hasDelivery ? 'Partial' : 'Cancelled';
    } else {
      status = hasPartial ? 'Partial' : 'Completed';
    }
  }

  const first = dispatches.find(d => d.day === 1 && d.batch === 1) || active[0] || dispatches[0];
  const startCount = first?.startCount != null ? Number(first.startCount) : null;

  return { totalRemains, status, allDone, startCount };
}

/**
 * Reschedule pending dispatches after a child completes/partials.
 * Only call when a qualifying transition was actually persisted.
 * Enforces: first pending row >= completionAt + service interval.
 */
export async function rescheduleAfterDripCompletion(prisma, orderId, completionAt) {
  const pending = await prisma.dripDispatch.findMany({
    where: { orderId, status: 'pending' },
    orderBy: [{ day: 'asc' }, { batch: 'asc' }],
  });
  if (!pending.length) return;

  const earliest = pending[0].scheduledAt;
  const now = new Date();
  const anchor = completionAt || now;

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      dripConfig: true,
      serviceTypeAtPurchase: true,
      platformAtPurchase: true,
      tier: { select: { group: { select: { type: true, platform: true } } } },
    },
  });
  if (!order) return;

  const dripCfg = order.dripConfig || null;
  const groupType = order.serviceTypeAtPurchase || order.tier?.group?.type || '';
  const groupPlatform = (order.platformAtPurchase || order.tier?.group?.platform || '').toLowerCase();

  const cfg = getDripConfig(groupType, groupPlatform);
  const intervalMs = ((cfg?.intervalHours) || 2) * 60 * 60 * 1000;
  const minFirstSlot = new Date(anchor.getTime() + intervalMs);

  if (earliest > now && earliest >= minFirstSlot) return;

  const rescheduled = rescheduleRemaining(pending, dripCfg, groupType, groupPlatform, anchor);
  if (!rescheduled.length) return;

  const vals = [], prms = [];
  for (let i = 0; i < rescheduled.length; i++) {
    const b = i * 2;
    vals.push(`($${b+1}, $${b+2}::timestamptz)`);
    prms.push(rescheduled[i].id, rescheduled[i].scheduledAt);
  }
  await prisma.$executeRawUnsafe(
    `UPDATE "drip_dispatches" SET "scheduledAt" = v.t, "updatedAt" = NOW()
     FROM (VALUES ${vals.join(',')}) AS v(id,t)
     WHERE "drip_dispatches"."id" = v.id AND "drip_dispatches"."status" = 'pending'`,
    ...prms,
  );
}

/**
 * Apply parent rollup with terminal-state guard.
 * Never overwrites Cancelled/Completed/Partial parents.
 */
export async function applyDripRollup(prisma, orderId, dispatches, currentParentStatus) {
  if (TERMINAL_STATES.includes(currentParentStatus)) return null;

  const rollup = computeDripRollup(dispatches);

  if (rollup.allDone) {
    return prisma.$transaction(async (tx) => {
      // Read the immutable owner without locking the order, then serialize on
      // the user row before taking parent/child locks. Account deletion follows
      // the same order: user → parent orders → drip children → points ledger.
      const owner = await tx.order.findUnique({
        where: { id: orderId },
        select: { userId: true },
      });
      if (!owner || !await lockOrderSettlementAccount(tx, owner.userId)) return null;

      const parentRows = await tx.$queryRaw`
        SELECT "id", "userId", "status", "deletedAt"
        FROM "orders"
        WHERE "id" = ${orderId}
        FOR UPDATE
      `;
      const parent = parentRows[0];
      if (!parent || parent.userId !== owner.userId || TERMINAL_STATES.includes(parent.status) || parent.deletedAt) return null;

      const fresh = await tx.$queryRaw`
        SELECT "status", "quantity", "remains", "startCount", "day", "batch", "lastError"
        FROM "drip_dispatches"
        WHERE "orderId" = ${orderId}
        ORDER BY "day" ASC, "batch" ASC
        FOR UPDATE
      `;
      const live = computeDripRollup(fresh);
      if (!live.allDone) {
        const progUpd = { remains: live.totalRemains };
        if (live.startCount != null) progUpd.startCount = live.startCount;
        const p = await tx.order.updateMany({
          where: { id: orderId, status: { notIn: TERMINAL_STATES }, deletedAt: null },
          data: progUpd,
        });
        return p.count === 0 ? null : { ...progUpd, status: parent.status };
      }
      const upd = { remains: live.totalRemains, status: live.status, completedAt: new Date() };
      if (live.startCount != null) upd.startCount = live.startCount;
      const r = await tx.order.updateMany({
        where: { id: orderId, status: { notIn: TERMINAL_STATES }, deletedAt: null },
        data: upd,
      });
      if (r.count === 0) return null;
      if (upd.status === 'Completed' || upd.status === 'Partial') {
        const { awardPointsOnCompletion } = await import('@/lib/nitro-rewards');
        await awardPointsOnCompletion(orderId, tx);
      }
      return { ...upd, status: upd.status || parent.status };
    });
  }

  const upd = { remains: rollup.totalRemains };
  if (rollup.startCount != null) upd.startCount = rollup.startCount;
  const result = await prisma.order.updateMany({
    where: { id: orderId, status: { notIn: TERMINAL_STATES }, deletedAt: null },
    data: upd,
  });
  if (result.count === 0) return null;

  return { ...upd, status: upd.status || currentParentStatus };
}
