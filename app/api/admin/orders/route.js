import prisma from '@/lib/prisma';
import { log } from "@/lib/logger";
import { requireAdmin, logActivity, canSeeSensitive, canPerformAction, maskEmail, maskPhone } from '@/lib/admin';
import { sendEmail, walletCreditEmail } from '@/lib/email';
import { checkOrder, cancelOrder, refillOrder, isProviderConfigured, getProviderName } from '@/lib/smm';
import { voidCommissions } from '@/lib/commissions';
import { cleanLink } from '@/lib/clean-link';
import { tgRefundAlert } from '@/lib/telegram';
import { reverseOrderPoints, computeRefundSplit, getTotalRefundedKobo } from '@/lib/nitro-rewards';
import { buildOrderOfferSnapshot, getOrderOfferDisplay } from '@/lib/order-offer-display';
import { findOpenSameLinkOrder, findSameLinkDispatchBlocker, isActiveOrderConflict, PROVIDER_ACTIVE_WAIT } from '@/lib/order-queue';
import { lockOrderSettlementAccount, ORDER_SETTLEMENT_ACCOUNT_STATUSES } from '@/lib/account-deletion';
import { enqueueMetaEvent, scheduleQueuedMetaEventDelivery } from '@/lib/meta-capi';

function triggerPurchaseDelivery(eventId) {
  scheduleQueuedMetaEventDelivery(eventId);
}

async function renewAdminCancellationLease(orderId, userId) {
  return prisma.$transaction(async (tx) => {
    if (!await lockOrderSettlementAccount(tx, userId)) return false;
    const renewed = await tx.order.updateMany({
      where: { id: orderId, userId, status: 'Cancelling', deletedAt: null },
      data: { updatedAt: new Date() },
    });
    return renewed.count === 1;
  });
}

async function nextOrderId(tx) {
  const rows = await (tx || prisma).order.findMany({
    where: { OR: [{ orderId: { startsWith: 'NTR-' } }, { orderId: { startsWith: 'ORD-' } }] },
    select: { orderId: true },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
  let max = 0;
  for (const r of rows) {
    const n = parseInt(r.orderId.replace(/^(NTR|ORD)-/, ''), 10);
    if (!isNaN(n) && n > max) max = n;
  }
  return `NTR-${max + 1}`;
}

export async function GET(req) {
  const { admin, error } = await requireAdmin('orders');
  if (error) return error;

  try {
    const url = new URL(req.url);
    const batchId = url.searchParams.get('batchId')?.trim();
    const rawSearch = url.searchParams.get('search')?.trim();
    const search = rawSearch && rawSearch.length >= 2 ? rawSearch : null;
    const page = Math.max(1, parseInt(url.searchParams.get('page')) || 1);
    const perPage = Math.min(100, Math.max(10, parseInt(url.searchParams.get('perPage')) || 50));
    const filter = url.searchParams.get('filter') || 'all';

    const searchCondition = search ? {
      OR: [
        { orderId: { contains: search, mode: 'insensitive' } },
        { apiOrderId: { contains: search, mode: 'insensitive' } },
        { batchId: { contains: search, mode: 'insensitive' } },
        { link: { contains: search, mode: 'insensitive' } },
        { user: { name: { contains: search, mode: 'insensitive' } } },
        { user: { email: { contains: search, mode: 'insensitive' } } },
        { parentOrderId: { contains: search, mode: 'insensitive' } },
      ],
    } : null;

    const include = {
      user: { select: { name: true, email: true, phone: true, resellerProfile: { select: { enabled: true } } } },
      service: { select: { name: true, category: true, provider: true, apiId: true, costPer1k: true, enabled: true } },
      tier: { select: { tier: true, sellPer1k: true, enabled: true, serviceId: true, group: { select: { name: true, platform: true, type: true, enabled: true } }, service: { select: { apiId: true, costPer1k: true } } } },
      dripDispatches: { select: { id: true, day: true, batch: true, quantity: true, status: true, apiOrderId: true, scheduledAt: true, dispatchedAt: true, completedAt: true, lastError: true }, orderBy: { scheduledAt: 'asc' } },
    };
    if (search && searchCondition.OR) searchCondition.OR.push({ dripDispatches: { some: { apiOrderId: { contains: search, mode: 'insensitive' } } } });

    let orders, total, counts;

    if (batchId) {
      orders = await prisma.order.findMany({
        where: { batchId, deletedAt: null },
        orderBy: { createdAt: 'desc' },
        include,
      });
      total = orders.length;
      counts = {};
    } else {
      const filterCondition = (() => {
        if (filter === 'queued') return { queuedBehind: { not: null } };
        if (filter === 'needs_dispatch') {
          const nd = { queuedBehind: null, status: { in: ['Pending', 'Processing', 'Dispatching'] } };
          nd.OR = [{ apiOrderId: null, dripDispatches: { none: {} } }, { dripDispatches: { some: { status: 'failed' } } }];
          return nd;
        }
        if (filter && filter !== 'all') return { status: filter };
        return null;
      })();

      const baseWhere = { deletedAt: null };
      const where = { ...baseWhere };
      const andClauses = [];
      if (searchCondition) andClauses.push(searchCondition);
      if (filterCondition) andClauses.push(filterCondition);
      if (andClauses.length) where.AND = andClauses;

      const countsWhere = searchCondition ? { ...baseWhere, AND: [searchCondition] } : baseWhere;

      const ndWhere = { queuedBehind: null, status: { in: ['Pending', 'Processing', 'Dispatching'] } };
      ndWhere.OR = [{ apiOrderId: null, dripDispatches: { none: {} } }, { dripDispatches: { some: { status: 'failed' } } }];

      let statusGroups, queuedCount, needsDispatchCount;
      // Keep this frequently-polled endpoint to one pool slot per request.
      // Parallel Prisma calls can otherwise reserve several connections at once
      // and starve concurrent Vercel invocations before any SQL is executed.
      [orders, statusGroups, queuedCount, needsDispatchCount] = await prisma.$transaction([
        prisma.order.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          include,
          take: perPage,
          skip: (page - 1) * perPage,
        }),
        prisma.order.groupBy({ by: ['status'], where: countsWhere, _count: true }),
        prisma.order.count({ where: { ...countsWhere, queuedBehind: { not: null } } }),
        prisma.order.count({ where: searchCondition ? { ...countsWhere, AND: [...(countsWhere.AND || []), ndWhere] } : { ...baseWhere, ...ndWhere } }),
      ]);

      counts = { all: 0, needs_dispatch: needsDispatchCount, queued: queuedCount };
      for (const g of statusGroups) { counts[g.status] = g._count; counts.all += g._count; }
      if (filter === 'queued') total = queuedCount;
      else if (filter === 'needs_dispatch') total = needsDispatchCount;
      else if (filter && filter !== 'all') total = counts[filter] || 0;
      else total = counts.all;
    }

    const orderIds = orders.map(o => o.orderId).filter(Boolean);
    const refundTotals = orderIds.length > 0
      ? await prisma.transaction.groupBy({ by: ['reference'], where: { type: 'refund', status: 'Completed', reference: { in: orderIds.flatMap(id => [`REF-${id}`, `ADM-REF-${id}`]) } }, _sum: { amount: true } })
      : [];
    const refundMap = {};
    for (const r of refundTotals) {
      const oid = r.reference.replace(/^(ADM-)?REF-/, '');
      refundMap[oid] = (refundMap[oid] || 0) + (r._sum.amount || 0);
    }

    const sensitive = canSeeSensitive(admin);

    const redispatchedIds = orders.filter(o => o.redispatchedAt).map(o => o.orderId);
    let childMap = {};
    if (redispatchedIds.length > 0) {
      const children = await prisma.order.findMany({
        where: { parentOrderId: { in: redispatchedIds }, deletedAt: null },
        select: { parentOrderId: true, orderId: true },
      });
      for (const c of children) childMap[c.parentOrderId] = c.orderId;
    }

    return Response.json({
      total,
      counts,
      orders: orders.map(o => {
        const offer = getOrderOfferDisplay(o);
        return {
        id: o.orderId || o.id,
        internalId: o.id,
        userId: o.userId,
        user: o.user?.name || 'Unknown',
        isReseller: !!o.user?.resellerProfile?.enabled,
        source: o.source || 'web',
        email: sensitive ? (o.user?.email || '') : maskEmail(o.user?.email),
        phone: sensitive ? (o.user?.phone || null) : maskPhone(o.user?.phone),
        service: offer.serviceName,
        tier: offer.tierLabel,
        tierLabel: offer.tierLabel,
        offerDisabled: offer.offerDisabled,
        platform: offer.platform,
        category: o.service?.category || 'unknown',
        ...(sensitive ? { provider: o.service?.provider || 'mtp', serviceApiId: o.service?.apiId || null } : {}),
        link: o.link,
        quantity: o.quantity,
        charge: o.charge / 100,
        ...(sensitive ? { cost: o.cost / 100 } : {}),
        remains: o.remains,
        startCount: o.startCount,
        status: o.status,
        ...(sensitive ? { apiOrderId: o.apiOrderId } : {}),
        dripDays: o.dripDays || null,
        dripConfig: o.dripConfig || null,
        dripEndAt: o.dripDispatches?.filter(d => !['completed', 'partial', 'failed'].includes(d.status)).sort((a, b) => b.scheduledAt - a.scheduledAt)[0]?.scheduledAt?.toISOString() || null,
        dripDispatches: o.dripDispatches?.length > 0 ? o.dripDispatches.map(d => ({ id: d.id, day: d.day, batch: d.batch, qty: d.quantity, remains: d.remains, status: d.status, apiOrderId: d.apiOrderId, scheduled: d.scheduledAt?.toISOString(), dispatched: d.dispatchedAt?.toISOString(), completed: d.completedAt?.toISOString(), error: d.lastError })) : null,
        batchId: o.batchId || null,
        lastError: o.lastError || null,
        queuedBehind: o.queuedBehind || null,
        retryCount: o.retryCount || 0,
        created: o.createdAt.toISOString(),
        serviceType: offer.serviceType,
        refundedAt: o.refundedAt?.toISOString() || null,
        redispatchedAt: o.redispatchedAt?.toISOString() || null,
        refillRequestedAt: o.refillRequestedAt?.toISOString() || null,
        parentOrderId: o.parentOrderId || null,
        childOrderId: childMap[o.orderId] || null,
        refundedTotal: (() => {
          const raw = refundMap[o.orderId] || 0;
          return o.redispatchedAt ? Math.max(0, raw - o.charge) / 100 : raw / 100;
        })(),
        tierServiceApiId: o.tier?.service?.apiId || null,
        tierCurrentPrice: o.tier?.sellPer1k ? Math.round(Number(o.tier.sellPer1k) * o.quantity / 1000) / 100 : null,
        comments: o.comments || null,
        };
      }),
    });
  } catch (err) {
    log.error('Admin Orders', err.message);
    const poolTimedOut = err?.code === 'P2024'
      || /timed out fetching a new connection from the connection pool/i.test(err?.message || '');
    return Response.json(
      { error: poolTimedOut ? 'Orders are temporarily busy. Please retry.' : 'Failed to load orders' },
      {
        status: poolTimedOut ? 503 : 500,
        ...(poolTimedOut ? { headers: { 'Retry-After': '3' } } : {}),
      },
    );
  }
}

export async function POST(req) {
  const { admin, error } = await requireAdmin('orders', true);
  if (error) return error;

  try {
    const body = await req.json();
    const { action, orderId } = body;

    if (!orderId) return Response.json({ error: 'Order ID required' }, { status: 400 });

    const order = await prisma.order.findFirst({
      where: { OR: [{ orderId }, { id: orderId }], deletedAt: null },
      include: { service: { select: { provider: true, min: true } } },
    });
    if (!order) return Response.json({ error: 'Order not found' }, { status: 404 });

    const provider = order.service?.provider || 'mtp';
    const providerLabel = getProviderName(provider);

    const actionKey = { cancel: 'orders.cancel', refill: 'orders.refill', reset_refill: 'orders.reset_refill', check: 'orders.check', refund: 'orders.refund', retry: 'orders.retry', update_link: 'orders.update_link', dispatch: 'orders.dispatch', redispatch: 'orders.redispatch', reset_drip: 'orders.reset_drip' }[action];
    if (actionKey && !canPerformAction(admin, actionKey)) {
      return Response.json({ error: 'You do not have permission for this action' }, { status: 403 });
    }

    if (action === 'cancel') {
      // Phase 1: claim cancellation — blocks dispatch/reset/sync on children
      const phase1 = await prisma.$transaction(async (tx) => {
        const settlementAccount = await lockOrderSettlementAccount(tx, order.userId);
        if (!settlementAccount) {
          return { ok: false, reason: 'This account is pending deletion; active orders are closed without refunds' };
        }

        const freshRows = await tx.$queryRaw`
          SELECT "id", "orderId", "userId", "status", "quantity", "remains", "charge", "nitroPointsRedeemedKobo", "apiOrderId", "deletedAt"
          FROM "orders"
          WHERE "id" = ${order.id}
          FOR UPDATE
        `;
        const fresh = freshRows[0];
        if (!fresh || ['Cancelled', 'Completed', 'Partial'].includes(fresh.status) || fresh.deletedAt) {
          return { ok: false };
        }

        const children = await tx.$queryRaw`
          SELECT "id", "status", "quantity", "remains", "apiOrderId"
          FROM "drip_dispatches"
          WHERE "orderId" = ${order.id}
          FOR UPDATE
        `;

        if (children.some(c => c.status === 'verifying')) {
          return { ok: false, reason: 'A batch is being verified with the provider — try again shortly' };
        }

        const childProviderIds = [];
        for (const c of children) {
          if (c.apiOrderId && !['completed', 'partial', 'cancelled', 'superseded'].includes(c.status)) {
            childProviderIds.push(String(c.apiOrderId));
          }
        }

        // This durable claim is the cancellation operation's linearization
        // point. Account deletion checks it under the same user lock and asks
        // the customer to retry instead of committing while provider I/O is
        // still authorized.
        if (fresh.status !== 'Cancelling') {
          const claimed = await tx.order.updateMany({
            where: { id: order.id, status: fresh.status, deletedAt: null },
            data: { status: 'Cancelling' },
          });
          if (claimed.count !== 1) return { ok: false };
        }
        if (children.length > 0) {
          await tx.dripDispatch.updateMany({
            where: { orderId: order.id, status: { notIn: ['completed', 'partial', 'cancelled', 'superseded'] } },
            data: { status: 'cancelling' },
          });
        }

        return { ok: true, fresh, childProviderIds, hasDrip: children.length > 0 };
      });

      if (!phase1.ok) return Response.json({ error: phase1.reason || 'Order is already terminal or deleted' }, { status: 409 });

      // Provider side effects happen only after the account and order claim
      // succeeds. A deletion-state account never reaches the provider.
      if (phase1.fresh.apiOrderId && isProviderConfigured(provider)) {
        try {
          if (await renewAdminCancellationLease(order.id, order.userId)) {
            await cancelOrder(provider, phase1.fresh.apiOrderId);
          }
        } catch (e) { log.warn(`Admin Cancel ${providerLabel}`, e.message); }
      }

      // Cancel child provider orders and re-query remains (awaited, before refund)
      const confirmedRemains = new Map();
      if (phase1.childProviderIds.length > 0 && isProviderConfigured(provider)) {
        for (const provId of phase1.childProviderIds) {
          if (!await renewAdminCancellationLease(order.id, order.userId)) break;
          try { await cancelOrder(provider, provId); } catch (e) { log.warn(`Admin drip cancel ${providerLabel} ${provId}`, e.message); }
          try {
            const s = await checkOrder(provider, provId);
            if (s.remains != null) confirmedRemains.set(provId, Number(s.remains));
          } catch {}
        }
      }

      // Phase 2: compute delivery from confirmed state, commit terminal + refund
      const result = await prisma.$transaction(async (tx) => {
        const settlementAccount = await lockOrderSettlementAccount(tx, order.userId);
        if (!settlementAccount) {
          return { ok: false, reason: 'This account is pending deletion; active orders are closed without refunds' };
        }

        const freshRows = await tx.$queryRaw`
          SELECT "id", "orderId", "userId", "status", "quantity", "remains", "charge", "nitroPointsRedeemedKobo", "deletedAt"
          FROM "orders"
          WHERE "id" = ${order.id}
          FOR UPDATE
        `;
        const fresh = freshRows[0];
        if (!fresh || ['Cancelled', 'Completed', 'Partial'].includes(fresh.status) || fresh.deletedAt) {
          return { ok: false };
        }

        const children = await tx.$queryRaw`
          SELECT "id", "status", "quantity", "remains", "apiOrderId"
          FROM "drip_dispatches"
          WHERE "orderId" = ${order.id}
          FOR UPDATE
        `;

        for (const c of children) {
          const provId = c.apiOrderId ? String(c.apiOrderId) : null;
          if (provId && confirmedRemains.has(provId) && confirmedRemains.get(provId) !== Number(c.remains ?? -1)) {
            await tx.$executeRaw`UPDATE "drip_dispatches" SET "remains" = ${confirmedRemains.get(provId)} WHERE "id" = ${c.id}`;
            c.remains = BigInt(confirmedRemains.get(provId));
          }
        }

        const { computeChildDelivery } = await import('@/lib/drip-completion');
        let delivered;
        if (children.length > 0) {
          delivered = computeChildDelivery(children, Number(fresh.quantity));
        } else {
          delivered = fresh.remains != null && fresh.quantity > 0 ? Math.max(0, Number(fresh.quantity) - Number(fresh.remains)) : 0;
        }

        if (delivered >= Number(fresh.quantity)) {
          await tx.order.updateMany({
            where: { id: order.id, status: { notIn: ['Cancelled', 'Completed', 'Partial'] }, deletedAt: null },
            data: { status: 'Completed', remains: 0, completedAt: new Date(), queuedBehind: null },
          });
          if (children.length > 0) {
            await tx.dripDispatch.updateMany({
              where: { orderId: order.id, status: { notIn: ['completed', 'partial', 'superseded'] } },
              data: { status: 'completed', completedAt: new Date() },
            });
          }
          const { awardPointsOnCompletion } = await import('@/lib/nitro-rewards');
          await awardPointsOnCompletion(order.id, tx);
          return { ok: true, fullyDelivered: true, delivered, quantity: Number(fresh.quantity) };
        }

        const isPartial = delivered > 0;
        const actualRemains = Number(fresh.quantity) - delivered;
        const maxRefund = isPartial ? Math.floor((actualRemains / Number(fresh.quantity)) * Number(fresh.charge) / 100) * 100 : Number(fresh.charge);

        await tx.order.updateMany({
          where: { id: order.id, status: { notIn: ['Cancelled', 'Completed', 'Partial'] }, deletedAt: null },
          data: { status: isPartial ? 'Partial' : 'Cancelled', remains: actualRemains, queuedBehind: null, lastError: body.note ? `admin_cancelled: ${body.note}` : 'admin_cancelled', refundedAt: new Date() },
        });

        await tx.dripDispatch.updateMany({
          where: { orderId: order.id, status: { notIn: ['completed', 'partial', 'superseded'] } },
          data: { status: 'cancelled', completedAt: new Date() },
        });

        let refundAmount = 0;
        if (maxRefund > 0) {
          const alreadyRefunded = await getTotalRefundedKobo(tx, { orderId: fresh.orderId, orderDbId: order.id, userId: fresh.userId });
          refundAmount = Math.max(0, maxRefund - alreadyRefunded);

          if (refundAmount > 0) {
            const { walletRefund } = computeRefundSplit(Number(fresh.charge), Number(fresh.nitroPointsRedeemedKobo || 0), refundAmount);
            if (walletRefund > 0) {
              await tx.user.update({ where: { id: fresh.userId }, data: { balance: { increment: walletRefund } } });
              await tx.transaction.create({
                data: {
                  userId: fresh.userId, type: 'refund', amount: walletRefund,
                  method: 'wallet', status: 'Completed',
                  reference: `ADM-REF-${fresh.orderId || order.id}`,
                  note: `Refund — order cancelled by admin${isPartial ? ` (${delivered}/${fresh.quantity} delivered)` : ''}${alreadyRefunded > 0 ? ` (₦${(alreadyRefunded / 100).toLocaleString()} already refunded)` : ''}`,
                },
              });
            }
            await reverseOrderPoints(tx, { orderDbId: order.id, refundAmountKobo: refundAmount });
          }
        }
        const split = refundAmount > 0 ? computeRefundSplit(Number(fresh.charge), Number(fresh.nitroPointsRedeemedKobo || 0), refundAmount) : { walletRefund: 0, pointsRestore: 0 };
        return { ok: true, isPartial, delivered, quantity: Number(fresh.quantity), remains: actualRemains, refundAmount, walletRefund: split.walletRefund, pointsRestore: split.pointsRestore };
      });

      if (!result.ok) return Response.json({ error: result.reason || 'Order is already terminal or deleted' }, { status: 409 });

      if (result.fullyDelivered) {
        await logActivity(admin.name, `Cancel rejected for ${orderId}: fully delivered (${result.delivered}/${result.quantity}), finalized as Completed`, 'order');
        return Response.json({
          success: true,
          status: 'Completed',
          message: `Order already fully delivered (${result.delivered}/${result.quantity}) — finalized as Completed, no refund`,
        });
      }

      if (result.refundAmount > 0) {
        tgRefundAlert({ orderId: order.orderId, amount: result.refundAmount, charge: order.charge, qty: result.quantity, remains: result.remains, status: result.isPartial ? 'Partial' : 'Cancelled', reason: 'admin_cancelled', source: admin.name });
      }
      voidCommissions(order.id, 'admin_cancelled').catch(() => {});

      if (result.refundAmount > 0) {
        try {
          const user = await prisma.user.findUnique({ where: { id: order.userId }, select: { email: true, name: true, notifEmail: true, notifOrders: true } });
          if (user?.email && user.notifEmail !== false && user.notifOrders !== false) {
            const walletNaira = result.walletRefund / 100;
            const pointsNaira = result.pointsRestore / 100;
            const html = walletCreditEmail(user.name || 'there', walletNaira, null, { kind: 'refund', orderRef: `#${order.orderId}`, failReason: 'Order cancelled', pointsRestored: pointsNaira });
            const subject = pointsNaira > 0
              ? `₦${walletNaira.toLocaleString()} refunded + ${pointsNaira.toLocaleString()} points restored`
              : `₦${walletNaira.toLocaleString()} refunded to your Nitro wallet`;
            sendEmail(user.email, subject, html).catch(() => {});
          }
        } catch {}
      }

      let refundMsg = '';
      if (result.refundAmount > 0) {
        const wN = result.walletRefund / 100;
        const pN = result.pointsRestore / 100;
        refundMsg = pN > 0 ? ` — ₦${wN.toLocaleString()} wallet + ${pN.toLocaleString()} pts restored` : ` — ₦${wN.toLocaleString()} refunded`;
      }
      const noteMsg = body.note ? ` — ${body.note}` : '';
      await logActivity(admin.name, `Cancelled order ${orderId} (${providerLabel})${refundMsg}${noteMsg}`, 'order');
      return Response.json({ success: true, status: result.isPartial ? 'Partial' : 'Cancelled', message: result.refundAmount > 0 ? `Order cancelled${refundMsg}` : 'Order cancelled' });
    }

    if (action === 'refill') {
      if (order.apiOrderId && isProviderConfigured(provider)) {
        try {
          await refillOrder(provider, order.apiOrderId);
        } catch (e) { log.warn(`Admin Refill ${providerLabel}`, e.message); }
      }
      await prisma.order.update({ where: { id: order.id }, data: { refillRequestedAt: new Date(), refillHandledAt: new Date() } });
      await logActivity(admin.name, `Requested refill for ${orderId} (${providerLabel})`, 'order');
      return Response.json({ success: true, message: 'Refill requested' });
    }

    if (action === 'reset_refill') {
      await prisma.order.update({ where: { id: order.id }, data: { refillRequestedAt: null, refillHandledAt: null } });
      await logActivity(admin.name, `Reset refill for ${orderId}`, 'order');
      return Response.json({ success: true, message: 'Refill reset — user can request again' });
    }

    if (action === 'check') {
      if (order.status === 'Cancelling') {
        return Response.json({ success: true, status: 'Cancelling', message: 'Cancellation is being finalized' });
      }
      if (order.apiOrderId && isProviderConfigured(provider)) {
        try {
          const status = await checkOrder(provider, order.apiOrderId);
          const statusMap = { 'Completed': 'Completed', 'In progress': 'Processing', 'Processing': 'Processing', 'Pending': 'Pending', 'Partial': 'Partial', 'Canceled': 'Cancelled', 'Refunded': 'Cancelled' };
          const terminal = ['Completed', 'Partial', 'Cancelled', 'Cancelling'].includes(order.status);
          const newStatus = terminal ? order.status : (statusMap[status.status] || order.status);
          const liveRemains = status.remains != null ? Number(status.remains) : null;
          const liveStartCount = status.start_count != null ? Number(status.start_count) : null;
          const remainsUpdate = {};
          if (!terminal && liveRemains != null && liveRemains !== order.remains) remainsUpdate.remains = liveRemains;
          if (liveStartCount != null && !order.startCount) remainsUpdate.startCount = liveStartCount;
          if (Object.keys(remainsUpdate).length > 0) {
            await prisma.order.updateMany({
              where: {
                id: order.id,
                status: order.status,
                apiOrderId: order.apiOrderId,
                deletedAt: null,
                user: { status: { in: ORDER_SETTLEMENT_ACCOUNT_STATUSES }, deletedAt: null, anonymizedAt: null },
              },
              data: remainsUpdate,
            });
          }
          if (newStatus !== order.status) {
            if (newStatus === 'Cancelled' && order.protected) {
              return Response.json({ success: true, status: order.status, remains: liveRemains, message: `Provider says cancelled but order is protected — use explicit Cancel to override` });
            }
            if (newStatus === 'Cancelled' && order.status !== 'Cancelled' && order.charge > 0) {
              const transitioned = await prisma.$transaction(async (tx) => {
                const settlementAccount = await lockOrderSettlementAccount(tx, order.userId);
                if (!settlementAccount) return false;
                const claimed = await tx.order.updateMany({
                  where: {
                    id: order.id,
                    status: order.status,
                    apiOrderId: order.apiOrderId,
                    deletedAt: null,
                  },
                  data: { status: 'Cancelled', queuedBehind: null, refundedAt: new Date() },
                });
                if (claimed.count === 0) return false;
                const alreadyRefunded = await getTotalRefundedKobo(tx, { orderId: order.orderId, orderDbId: order.id, userId: order.userId });
                const refundAmount = Math.max(0, order.charge - alreadyRefunded);
                if (refundAmount > 0) {
                  const { walletRefund } = computeRefundSplit(order.charge, order.nitroPointsRedeemedKobo, refundAmount);
                  if (walletRefund > 0) {
                    await tx.$executeRaw`UPDATE users SET balance = balance + ${walletRefund} WHERE id = ${order.userId}`;
                    await tx.transaction.create({
                      data: {
                        userId: order.userId, type: 'refund', amount: walletRefund,
                        method: 'wallet', status: 'Completed',
                        reference: `REF-${order.orderId}`,
                        note: `Refund — order cancelled by provider${alreadyRefunded > 0 ? ` (₦${(alreadyRefunded / 100).toLocaleString()} already refunded)` : ''}`,
                      },
                    });
                  }
                  await reverseOrderPoints(tx, { orderDbId: order.id, refundAmountKobo: refundAmount });
                }
                return true;
              });
              if (!transitioned) {
                const current = await prisma.order.findUnique({ where: { id: order.id }, select: { status: true, remains: true, startCount: true } });
                return Response.json({ success: true, status: current?.status || order.status, remains: current?.remains ?? liveRemains, startCount: current?.startCount ?? liveStartCount, message: 'Order state changed before settlement; no refund was issued' });
              }
            } else if (newStatus === 'Partial' && status.remains) {
              const remains = Number(status.remains) || 0;
              if (remains > 0 && order.charge > 0 && order.quantity > 0) {
                const refundAmount = Math.round((remains / order.quantity) * order.charge / 100) * 100;
                if (refundAmount > 0) {
                  const transitioned = await prisma.$transaction(async (tx) => {
                    const settlementAccount = await lockOrderSettlementAccount(tx, order.userId);
                    if (!settlementAccount) return false;
                    const claimed = await tx.order.updateMany({
                      where: {
                        id: order.id,
                        status: order.status,
                        apiOrderId: order.apiOrderId,
                        deletedAt: null,
                      },
                      data: { status: 'Partial', queuedBehind: null, refundedAt: new Date() },
                    });
                    if (claimed.count !== 1) return false;
                    const alreadyRefunded = await getTotalRefundedKobo(tx, { orderId: order.orderId, orderDbId: order.id, userId: order.userId });
                    const cappedRefund = Math.max(0, refundAmount - alreadyRefunded);
                    if (cappedRefund <= 0) return true;
                    const { walletRefund } = computeRefundSplit(order.charge, order.nitroPointsRedeemedKobo, cappedRefund);
                    if (walletRefund > 0) {
                      await tx.$executeRaw`UPDATE users SET balance = balance + ${walletRefund} WHERE id = ${order.userId}`;
                      await tx.transaction.create({
                        data: {
                          userId: order.userId, type: 'refund', amount: walletRefund,
                          method: 'wallet', status: 'Completed',
                          reference: `REF-${order.orderId}`,
                          note: `Partial refund for ${order.orderId} (${remains} undelivered)`,
                        },
                      });
                    }
                    await reverseOrderPoints(tx, { orderDbId: order.id, refundAmountKobo: cappedRefund });
                    return true;
                  });
                  if (!transitioned) {
                    const current = await prisma.order.findUnique({ where: { id: order.id }, select: { status: true, remains: true, startCount: true } });
                    return Response.json({ success: true, status: current?.status || order.status, remains: current?.remains ?? liveRemains, startCount: current?.startCount ?? liveStartCount, message: 'Order state changed before settlement; no refund was issued' });
                  }
                }
              }
            } else {
              const transitioned = await prisma.order.updateMany({
                where: {
                  id: order.id,
                  status: order.status,
                  apiOrderId: order.apiOrderId,
                  deletedAt: null,
                  user: { status: { in: ORDER_SETTLEMENT_ACCOUNT_STATUSES }, deletedAt: null, anonymizedAt: null },
                },
                data: { status: newStatus, queuedBehind: null },
              });
              if (transitioned.count !== 1) {
                const current = await prisma.order.findUnique({ where: { id: order.id }, select: { status: true, remains: true, startCount: true } });
                return Response.json({ success: true, status: current?.status || order.status, remains: current?.remains ?? liveRemains, startCount: current?.startCount ?? liveStartCount, message: 'Order state changed before settlement' });
              }
            }
          }
          await logActivity(admin.name, `Checked order ${orderId} via ${providerLabel}: ${newStatus}`, 'order');
          return Response.json({ success: true, status: newStatus, remains: status.remains, startCount: status.start_count });
        } catch (e) {
          return Response.json({ success: true, status: order.status, message: e.message });
        }
      }
      // Drip order — sync each dispatch with provider, then rollup parent
      const dispatches = await prisma.dripDispatch.findMany({
        where: { orderId: order.id, apiOrderId: { not: null }, status: { notIn: ['completed', 'partial', 'cancelled', 'superseded', 'verifying', 'cancelling'] } },
        select: { id: true, apiOrderId: true, quantity: true, status: true, startCount: true },
      });
      if (dispatches.length === 0) return Response.json({ success: true, status: order.status, message: `No ${providerLabel} tracking` });
      const { normalizeProviderStatus } = await import('@/lib/drip-completion');
      const { randomUUID } = await import('node:crypto');
      for (const d of dispatches) {
        let verifyToken = null;
        try {
          let casStatus = d.status;
          if (d.status === 'failed') {
            verifyToken = `[VERIFY] ${randomUUID()}`;
            const claimed = await prisma.$transaction(async (tx) => {
              const pRows = await tx.$queryRaw`SELECT "id", "status", "deletedAt" FROM "orders" WHERE "id" = ${order.id} FOR UPDATE`;
              const p = pRows[0];
              if (!p || !['Pending', 'Processing'].includes(p.status) || p.deletedAt) return false;
              const r = await tx.dripDispatch.updateMany({ where: { id: d.id, status: 'failed', apiOrderId: d.apiOrderId }, data: { status: 'verifying', lastError: verifyToken } });
              return r.count > 0;
            });
            if (!claimed) continue;
            casStatus = 'verifying';
          }

          const s = await checkOrder(provider, d.apiOrderId);
          const newSt = normalizeProviderStatus(s.status) || d.status;
          const upd = {};
          if (newSt !== casStatus) upd.status = newSt;
          if (s.remains != null) upd.remains = Number(s.remains);
          if (s.start_count != null && !d.startCount) upd.startCount = Number(s.start_count);
          if (['completed', 'partial', 'cancelled', 'failed'].includes(newSt) && newSt !== d.status) upd.completedAt = new Date();
          if (Object.keys(upd).length === 0) continue;
          if (upd.status === 'failed') upd.lastError = null;
          const qualifies = ['completed', 'partial'].includes(newSt) && !['completed', 'partial'].includes(d.status);
          const whereClause = verifyToken
            ? { id: d.id, status: 'verifying', lastError: verifyToken, apiOrderId: d.apiOrderId }
            : { id: d.id, status: casStatus, apiOrderId: d.apiOrderId };
          await prisma.$transaction(async (tx) => {
            const pRows = await tx.$queryRaw`SELECT "id", "status", "deletedAt" FROM "orders" WHERE "id" = ${order.id} FOR UPDATE`;
            const p = pRows[0];
            if (!p || !['Pending', 'Processing'].includes(p.status) || p.deletedAt) return;
            const r = await tx.dripDispatch.updateMany({ where: whereClause, data: upd });
            if (qualifies && r.count === 1) {
              const { rescheduleAfterDripCompletion } = await import('@/lib/drip-completion');
              await rescheduleAfterDripCompletion(tx, order.id, upd.completedAt);
            }
          });
        } catch {
          // Leave as verifying — cron stale handler will reconcile
        }
      }
      const { applyDripRollup } = await import('@/lib/drip-completion');
      const allDispatches = await prisma.dripDispatch.findMany({ where: { orderId: order.id }, select: { status: true, remains: true, quantity: true, startCount: true, day: true, batch: true, lastError: true }, orderBy: [{ day: 'asc' }, { batch: 'asc' }] });
      const rollupResult = await applyDripRollup(prisma, order.id, allDispatches, order.status);
      const effectiveStatus = rollupResult?.status || order.status;
      await logActivity(admin.name, `Synced drip order ${orderId}: ${effectiveStatus}`, 'order');
      return Response.json({ success: true, status: effectiveStatus, remains: rollupResult?.remains ?? order.remains });
    }

    if (action === 'refund') {
      const { percent } = body;
      if (!percent || ![25, 50, 100].includes(percent)) {
        return Response.json({ error: 'Percent must be 25, 50, or 100' }, { status: 400 });
      }

      const label = percent === 100 ? 'full' : `${percent}%`;

      const settlement = await prisma.$transaction(async (tx) => {
        const settlementAccount = await lockOrderSettlementAccount(tx, order.userId);
        if (!settlementAccount) {
          return { ok: false, status: 409, error: 'This account is pending deletion and cannot receive refunds' };
        }

        // Recompute under the user lock so concurrent admin refunds cannot both
        // spend the same refundable remainder.
        const alreadyRefunded = await getTotalRefundedKobo(tx, { orderId: order.orderId, orderDbId: order.id, userId: order.userId });
        const maxRefundable = Math.max(0, order.charge - alreadyRefunded);
        if (maxRefundable <= 0) return { ok: false, status: 400, error: 'Order already fully refunded' };

        let refundAmount = percent === 100
          ? maxRefundable
          : Math.round(maxRefundable * percent / 100);
        refundAmount = Math.min(refundAmount, maxRefundable);
        if (refundAmount <= 0) return { ok: false, status: 400, error: 'Nothing left to refund' };

        const { walletRefund, pointsRestore } = computeRefundSplit(order.charge, order.nitroPointsRedeemedKobo, refundAmount);
        if (walletRefund > 0) {
          await tx.user.update({ where: { id: order.userId }, data: { balance: { increment: walletRefund } } });
          await tx.transaction.create({
            data: {
              userId: order.userId, type: 'refund', amount: walletRefund,
              method: 'wallet', status: 'Completed',
              reference: `ADM-REF-${order.orderId || order.id}`,
              note: `Admin refund — ${label} (₦${(walletRefund / 100).toLocaleString()})${alreadyRefunded > 0 ? ` · ₦${(alreadyRefunded / 100).toLocaleString()} previously refunded` : ''}`,
            },
          });
        }
        await tx.order.update({ where: { id: order.id }, data: { refundedAt: new Date() } });
        await reverseOrderPoints(tx, { orderDbId: order.id, refundAmountKobo: refundAmount });
        return { ok: true, refundAmount, walletRefund, pointsRestore };
      });
      if (!settlement.ok) return Response.json({ error: settlement.error }, { status: settlement.status });

      const { refundAmount, walletRefund: rWallet, pointsRestore: rPoints } = settlement;
      try {
        const user = await prisma.user.findUnique({ where: { id: order.userId }, select: { email: true, name: true, notifEmail: true, notifOrders: true } });
        if (user?.email && user.notifEmail !== false && user.notifOrders !== false) {
          const wN = rWallet / 100;
          const pN = rPoints / 100;
          const html = walletCreditEmail(user.name || 'there', wN, null, { kind: 'refund', orderRef: `#${order.orderId}`, failReason: percent === 100 ? 'Order cancelled' : 'Partial delivery', pointsRestored: pN });
          const subject = pN > 0
            ? `₦${wN.toLocaleString()} refunded + ${pN.toLocaleString()} points restored`
            : `₦${wN.toLocaleString()} refunded to your Nitro wallet`;
          sendEmail(user.email, subject, html).catch(() => {});
        }
      } catch {}

      const refundMsg = rPoints > 0
        ? `₦${(rWallet / 100).toLocaleString()} wallet + ${(rPoints / 100).toLocaleString()} pts`
        : `₦${(refundAmount / 100).toLocaleString()}`;
      tgRefundAlert({ orderId: order.orderId, amount: refundAmount, charge: order.charge, qty: order.quantity, remains: order.remains, status: percent === 100 ? 'Cancelled' : 'Partial', reason: `admin (${label})`, source: admin.name });
      await logActivity(admin.name, `Refunded ${refundMsg} for order ${orderId} (${label})`, 'order');
      return Response.json({ success: true, message: `${refundMsg} refunded to customer` });
    }

    if (action === 'retry') {
      const order = await prisma.order.findFirst({ where: { orderId, deletedAt: null } });
      if (!order) return Response.json({ error: 'Order not found' }, { status: 404 });
      if (order.apiOrderId) return Response.json({ error: 'Order already dispatched' }, { status: 400 });
      if (order.status === 'Cancelling') return Response.json({ error: 'Order cancellation is still in progress' }, { status: 409 });
      const retryableStatuses = ['Pending', 'Processing', 'Dispatching', 'Failed'];
      if (!retryableStatuses.includes(order.status)) return Response.json({ error: `Cannot retry a ${order.status.toLowerCase()} order` }, { status: 400 });
      const reset = await prisma.$transaction(async (tx) => {
        if (!await lockOrderSettlementAccount(tx, order.userId)) return null;
        return tx.order.updateMany({
          where: { id: order.id, userId: order.userId, status: order.status, apiOrderId: null, deletedAt: null },
          data: { status: 'Pending', retryCount: 0, lastError: null },
        });
      });
      if (!reset) return Response.json({ error: 'This account is pending deletion and cannot retry orders' }, { status: 409 });
      if (reset.count === 0) return Response.json({ error: 'Order state changed before retry' }, { status: 409 });
      await logActivity(admin.name, `Reset order ${orderId} for retry`, 'order');
      return Response.json({ success: true });
    }

    if (action === 'update_link') {
      const { link: newLink } = body;
      if (!newLink || !newLink.trim()) return Response.json({ error: 'Link is required' }, { status: 400 });
      const order = await prisma.order.findFirst({ where: { orderId, deletedAt: null } });
      if (!order) return Response.json({ error: 'Order not found' }, { status: 404 });
      if (order.apiOrderId) return Response.json({ error: 'Cannot change link — order already sent to provider' }, { status: 400 });
      if (order.status === 'Cancelled') return Response.json({ error: 'Order is cancelled' }, { status: 400 });
      const cleaned = cleanLink(newLink.trim());
      await prisma.order.update({ where: { id: order.id }, data: { link: cleaned } });
      await logActivity(admin.name, `Updated link for ${orderId}`, 'order');
      return Response.json({ success: true, link: cleaned });
    }

    if (action === 'dispatch') {
      const { placeWithProvider } = await import('@/lib/bulk-dispatch');
      const fullOrder = await prisma.order.findFirst({
        where: { OR: [{ orderId }, { id: orderId }], deletedAt: null },
        include: { service: true, tier: { include: { group: true } } },
      });
      if (!fullOrder) return Response.json({ error: 'Order not found' }, { status: 404 });
      if (fullOrder.status === 'Cancelling') return Response.json({ error: 'Order cancellation is still in progress' }, { status: 409 });
      if (!['Pending', 'Processing', 'Dispatching'].includes(fullOrder.status)) return Response.json({ error: `Cannot dispatch a ${fullOrder.status.toLowerCase()} order` }, { status: 400 });
      if (fullOrder.apiOrderId) return Response.json({ error: 'Order already dispatched' }, { status: 400 });

      const dispatchBlocker = await findSameLinkDispatchBlocker(prisma, fullOrder);
      if (dispatchBlocker) {
        const queued = await prisma.$transaction(async (tx) => {
          if (!await lockOrderSettlementAccount(tx, fullOrder.userId)) return null;
          return tx.order.updateMany({
            where: {
              id: fullOrder.id,
              userId: fullOrder.userId,
              status: { in: ['Pending', 'Processing', 'Dispatching'] },
              apiOrderId: null,
              deletedAt: null,
            },
            data: {
              status: fullOrder.dripDelivered > 0 ? 'Processing' : 'Pending',
              queuedBehind: dispatchBlocker.orderId,
            },
          });
        });
        if (!queued) return Response.json({ error: 'This account is pending deletion and cannot dispatch orders' }, { status: 409 });
        if (queued.count === 0) return Response.json({ error: 'Order state changed before it could be queued' }, { status: 409 });
        await logActivity(admin.name, `Kept ${orderId} queued behind ${dispatchBlocker.orderId}`, 'order');
        return Response.json({
          success: true,
          queued: true,
          queuedBehind: dispatchBlocker.orderId,
          message: `Order remains queued behind ${dispatchBlocker.orderId}`,
        });
      }

      // Check if this is a drip order before releasing a stale queue pointer.
      // Direct orders clear that pointer inside their dispatch CAS below, avoiding
      // a Pending/unfenced window in which the stale-order reaper could claim it.
      const hasDrip = await prisma.dripDispatch.findFirst({ where: { orderId: fullOrder.id }, select: { id: true } });

      // Drip parents are excluded from the direct stale-order reaper, so their
      // stale pointer can be cleared before the child-batch claim. The claim still
      // requires queuedBehind=null and an active parent.
      if (hasDrip && fullOrder.queuedBehind) {
        const released = await prisma.$transaction(async (tx) => {
          if (!await lockOrderSettlementAccount(tx, fullOrder.userId)) return null;
          return tx.order.updateMany({
            where: {
              id: fullOrder.id,
              userId: fullOrder.userId,
              status: { in: ['Pending', 'Processing'] },
              apiOrderId: null,
              queuedBehind: fullOrder.queuedBehind,
              deletedAt: null,
            },
            data: { queuedBehind: null },
          });
        });
        if (!released) return Response.json({ error: 'This account is pending deletion and cannot dispatch orders' }, { status: 409 });
        if (released.count === 0) return Response.json({ error: 'Order state changed before dispatch' }, { status: 409 });
      }

      if (hasDrip) {
        // Find the earliest failed/pending batch (ordered by day then batch)
        const candidate = await prisma.dripDispatch.findFirst({
          where: { orderId: fullOrder.id, status: { in: ['pending', 'failed'] } },
          orderBy: [{ day: 'asc' }, { batch: 'asc' }, { scheduledAt: 'asc' }],
        });
        if (!candidate) return Response.json({ error: 'No pending or failed batch to dispatch' }, { status: 400 });

        if (candidate.status === 'failed' && (candidate.lastError?.startsWith('[TIMEOUT]') || candidate.lastError?.startsWith('[VERIFY_STALE]'))) {
          const why = candidate.lastError.startsWith('[TIMEOUT]')
            ? `${fullOrder.provider || 'The provider'} never replied when we sent batch ${candidate.batch}`
            : `We lost track of batch ${candidate.batch} while checking it with ${fullOrder.provider || 'the provider'}`;
          return Response.json({
            error: `${why}, so we cannot tell whether they received it. Dispatching again risks sending it twice and paying twice. `
              + `Search your ${fullOrder.provider || 'provider'} dashboard for this order: if it is running, leave it alone. `
              + `If it is not there, use Reset.`,
          }, { status: 409 });
        }

        // Lock parent then claim child — serializes with finalizer and reset
        const claimOk = await prisma.$transaction(async (tx) => {
          if (!await lockOrderSettlementAccount(tx, fullOrder.userId)) return false;
          const parentRows = await tx.$queryRaw`
            SELECT "id", "status", "deletedAt", "queuedBehind"
            FROM "orders"
            WHERE "id" = ${fullOrder.id}
            FOR UPDATE
          `;
          const p = parentRows[0];
          if (!p || !['Pending', 'Processing'].includes(p.status) || p.deletedAt || p.queuedBehind) return false;
          const inFlight = await tx.dripDispatch.count({
            where: { orderId: fullOrder.id, id: { not: candidate.id }, status: { in: ['dispatching', 'processing', 'verifying', 'cancelling'] } },
          });
          if (inFlight > 0) return false;
          const r = await tx.dripDispatch.updateMany({
            where: { id: candidate.id, status: candidate.status },
            data: { status: 'dispatching', dispatchedAt: new Date() },
          });
          return r.count > 0;
        });
        if (!claimOk) return Response.json({ error: 'Batch is queued, the order is no longer active, or another batch is in flight' }, { status: 409 });

        try {
          // Window enforcement: defer dispatch if outside delivery window
          const orderCfg = fullOrder.dripConfig;
          if (orderCfg?.window) {
            const { isInWindow, snapToWindow } = await import('@/lib/drip-feed');
            const cfgTz = orderCfg.timezone || null;
            if (!isInWindow(new Date(), orderCfg.window, cfgTz)) {
              const nextSlot = snapToWindow(new Date(), orderCfg.window, cfgTz);
              await prisma.dripDispatch.updateMany({
                where: { id: candidate.id, status: 'dispatching' },
                data: { status: 'pending', dispatchedAt: null, scheduledAt: nextSlot },
              });
              return Response.json({ success: true, delayed: true, message: `Outside delivery window. Next slot: ${nextSlot.toISOString()}` });
            }
          }
          const { placeOrder } = await import('@/lib/smm');
          const service = fullOrder.service;
          const prov = service.provider || 'mtp';
          const apiType = (service.apiType || '').toLowerCase();
          const extra = {};
          if (fullOrder.comments) {
            if (apiType === 'seo') extra.keywords = fullOrder.comments;
            else if (apiType.includes('mention')) extra.usernames = fullOrder.comments;
            else if (apiType === 'poll') extra.answer_number = fullOrder.comments;
            else {
              const { sliceCommentsForBatch } = await import('@/lib/drip-feed');
              const allDispatches = await prisma.dripDispatch.findMany({
                where: { orderId: fullOrder.id },
                select: { day: true, batch: true, quantity: true, status: true, lastError: true, remains: true },
                orderBy: [{ day: 'asc' }, { batch: 'asc' }],
              });
              extra.comments = sliceCommentsForBatch(fullOrder.comments, candidate.quantity, allDispatches, candidate);
            }
          }
          if (apiType === 'subscriptions') {
            const match = fullOrder.link.match(/instagram\.com\/([^/?#]+)/);
            if (match) extra.username = match[1];
            extra.min = candidate.quantity;
            extra.max = candidate.quantity;
          }

          const result = await placeOrder(prov, service.apiId, fullOrder.link, candidate.quantity, extra);
          const batchApiId = result.order ? String(result.order) : null;
          if (!batchApiId) {
            await prisma.dripDispatch.updateMany({
              where: {
                id: candidate.id,
                status: 'dispatching',
                order: { status: { in: ['Pending', 'Processing'] }, queuedBehind: null, deletedAt: null },
              },
              data: { status: 'failed', lastError: 'Provider returned no order ID' },
            });
            return Response.json({ error: 'Provider returned no order ID' }, { status: 502 });
          }

          const recorded = await prisma.dripDispatch.updateMany({
            where: {
              id: candidate.id,
              status: 'dispatching',
              order: { status: { in: ['Pending', 'Processing'] }, queuedBehind: null, deletedAt: null },
            },
            data: { apiOrderId: batchApiId, status: 'processing', lastError: null },
          });
          if (recorded.count === 0) {
            prisma.adminIssue.create({
              data: {
                type: 'ghost_dispatch',
                title: `${orderId} batch ${candidate.batch}: provider accepted after local cancellation`,
                message: `Provider order ${batchApiId} was created after the local order became terminal. Verify provider state before taking action.`,
                metadata: JSON.stringify({ orderId, batch: candidate.batch, providerOrderId: batchApiId, link: fullOrder.link }),
              },
            }).catch(() => {});
            return Response.json({ error: `Provider accepted ${batchApiId}, but the local order state changed. Verify it before taking action.` }, { status: 409 });
          }
          await prisma.order.updateMany({
            where: { id: fullOrder.id, status: { in: ['Pending', 'Processing'] }, deletedAt: null },
            data: { status: 'Processing', dripDelivered: { increment: 1 }, queuedBehind: null, lastError: null },
          });
          await logActivity(admin.name, `Manually dispatched ${orderId} day ${candidate.day} batch ${candidate.batch} → ${batchApiId}`, 'order');
          return Response.json({ success: true, apiOrderId: batchApiId, batch: candidate.batch, day: candidate.day, message: `Day ${candidate.day} batch ${candidate.batch} dispatched: ${batchApiId}` });
        } catch (err) {
          if (isActiveOrderConflict(err)) {
            const currentBlocker = await findSameLinkDispatchBlocker(prisma, fullOrder);
            const reset = await prisma.dripDispatch.updateMany({
              where: {
                id: candidate.id,
                status: 'dispatching',
                order: { status: { in: ['Pending', 'Processing'] }, queuedBehind: null, deletedAt: null },
              },
              data: { status: 'pending', lastError: null, dispatchedAt: null, scheduledAt: await (async () => {
                const raw = new Date(Date.now() + 30 * 60 * 1000);
                const oCfg = fullOrder.dripConfig;
                if (!oCfg?.window) return raw;
                const { snapToWindow: sw } = await import('@/lib/drip-feed');
                return sw(raw, oCfg.window, oCfg.timezone || null);
              })() },
            });
            if (reset.count === 0) return Response.json({ error: 'Order state changed while dispatching' }, { status: 409 });
            await prisma.order.updateMany({
              where: { id: fullOrder.id, status: { in: ['Pending', 'Processing'] }, deletedAt: null },
              data: {
                status: fullOrder.dripDelivered > 0 ? 'Processing' : 'Pending',
                queuedBehind: currentBlocker?.orderId || null,
              },
            });
            return Response.json({
              success: true,
              queued: true,
              queuedBehind: currentBlocker?.orderId || null,
              message: currentBlocker
                ? `Order remains queued behind ${currentBlocker.orderId}`
                : 'Provider still has an active order for this link. This batch will retry later.',
            });
          }
          await prisma.dripDispatch.updateMany({
            where: {
              id: candidate.id,
              status: 'dispatching',
              order: { status: { in: ['Pending', 'Processing'] }, queuedBehind: null, deletedAt: null },
            },
            data: { status: 'failed', lastError: err.message.slice(0, 500) },
          });
          return Response.json({ error: `Dispatch failed: ${err.message}` }, { status: 502 });
        }
      }

      // Non-drip order — atomic claim to prevent race with cron or another admin
      const claimed = await prisma.$transaction(async (tx) => {
        if (!await lockOrderSettlementAccount(tx, fullOrder.userId)) return null;
        return tx.order.updateMany({
          where: {
            id: fullOrder.id,
            userId: fullOrder.userId,
            apiOrderId: null,
            queuedBehind: fullOrder.queuedBehind || null,
            deletedAt: null,
            OR: [
              { status: 'Pending' },
              { status: 'Dispatching', dispatchedAt: { lte: new Date(Date.now() - 5 * 60 * 1000) } },
            ],
          },
          data: { status: 'Dispatching', dispatchedAt: new Date(), queuedBehind: null },
        });
      });
      if (!claimed) return Response.json({ error: 'This account is pending deletion and cannot dispatch orders' }, { status: 409 });
      if (claimed.count === 0) return Response.json({ error: 'Order was claimed by another process or is still in flight' }, { status: 409 });
      try {
        const apiOrderId = await placeWithProvider({ id: fullOrder.id, service: fullOrder.service, tier: fullOrder.tier, link: fullOrder.link, quantity: fullOrder.quantity, comments: fullOrder.comments, trafficConfig: fullOrder.trafficConfig });
        if (!apiOrderId) {
          await prisma.order.updateMany({ where: { id: fullOrder.id, status: 'Dispatching', apiOrderId: null }, data: { status: 'Pending', dispatchedAt: null } });
          return Response.json({ error: 'Provider returned no order ID' }, { status: 502 });
        }
        const authoritative = await prisma.order.findUnique({
          where: { id: fullOrder.id },
          select: { status: true, apiOrderId: true, deletedAt: true },
        });
        if (authoritative?.status !== 'Processing' || authoritative.apiOrderId !== String(apiOrderId) || authoritative.deletedAt) {
          return Response.json({ error: `Provider accepted ${apiOrderId}, but the local order state changed. Verify it before taking action.` }, { status: 409 });
        }
        await logActivity(admin.name, `Manually dispatched ${orderId} → ${apiOrderId}`, 'order');
        return Response.json({ success: true, apiOrderId, status: 'Processing', message: `Dispatched: ${apiOrderId}` });
      } catch (err) {
        if (isActiveOrderConflict(err)) {
          const currentBlocker = await findSameLinkDispatchBlocker(prisma, fullOrder);
          await prisma.order.updateMany({
            where: { id: fullOrder.id, status: 'Dispatching', apiOrderId: null },
            data: { status: 'Pending', dispatchedAt: null, lastError: PROVIDER_ACTIVE_WAIT, queuedBehind: currentBlocker?.orderId || null, retryCount: 0 },
          });
          return Response.json({
            success: true,
            queued: true,
            queuedBehind: currentBlocker?.orderId || null,
            message: currentBlocker
              ? `Order remains queued behind ${currentBlocker.orderId}`
              : 'Provider still has an active order for this link. The order will retry later.',
          });
        }
        const isTimeout = /timed?\s?out|ETIMEDOUT|ECONNABORTED|ECONNRESET|socket hang up|retries failed/i.test(err.message);
        await prisma.order.updateMany({ where: { id: fullOrder.id, status: 'Dispatching', apiOrderId: null }, data: { status: isTimeout ? 'Dispatching' : 'Pending', dispatchedAt: isTimeout ? undefined : null, lastError: (isTimeout ? '[TIMEOUT] ' : '') + err.message.slice(0, 450) } });
        return Response.json({ error: `Dispatch failed: ${err.message}` }, { status: 502 });
      }
    }

    if (action === 'redispatch') {
      const { link: newLink } = body;
      const fullOrder = await prisma.order.findFirst({
        where: { OR: [{ orderId }, { id: orderId }], deletedAt: null },
        include: { service: true, tier: { include: { service: true, group: true } }, user: { select: { id: true, email: true, phone: true, balance: true } }, dripDispatches: true },
      });
      if (!fullOrder) return Response.json({ error: 'Order not found' }, { status: 404 });
      if (fullOrder.status !== 'Cancelled') return Response.json({ error: 'Only cancelled orders can be re-dispatched' }, { status: 400 });
      if (fullOrder.redispatchedAt) return Response.json({ error: 'Order already redispatched' }, { status: 400 });

      const link = cleanLink((newLink || '').trim() || fullOrder.link);
      if (!link) return Response.json({ error: 'No link provided' }, { status: 400 });

      let service = fullOrder.service;
      const tierService = fullOrder.tier?.service;
      let serviceSwapped = false;
      if (tierService && tierService.id !== service.id) {
        service = tierService;
        serviceSwapped = true;
      }

      const hasDrip = fullOrder.dripDispatches?.length > 0;
      let delivered = 0;
      if (hasDrip) {
        for (const d of fullOrder.dripDispatches) {
          if (d.status === 'completed' || d.status === 'partial') {
            delivered += d.quantity - (d.remains || 0);
          }
        }
      } else if (fullOrder.remains != null) {
        delivered = fullOrder.quantity - fullOrder.remains;
      }
      const remainingQty = fullOrder.quantity - delivered;
      if (remainingQty <= 0) return Response.json({ error: 'No remaining quantity to redispatch' }, { status: 400 });

      const providerMin = service.min || 50;
      if (remainingQty < providerMin) {
        return Response.json({ error: `Remaining quantity (${remainingQty}) is below the provider minimum (${providerMin}). Cannot redispatch.` }, { status: 400 });
      }

      const initialBlocker = await findOpenSameLinkOrder(prisma, {
        serviceId: service.id,
        link,
        excludeOrderId: fullOrder.id,
      });

      const expectedCharge = Math.round(fullOrder.charge * remainingQty / fullOrder.quantity);
      const totalRefunded = await getTotalRefundedKobo(prisma, { orderId: fullOrder.orderId, orderDbId: fullOrder.id, userId: fullOrder.userId });
      const heldFromOriginal = Math.max(0, fullOrder.charge - totalRefunded);
      let newCharge = Math.max(0, expectedCharge - heldFromOriginal);
      if (newCharge > 0 && fullOrder.user.balance < newCharge) {
        return Response.json({ error: `Insufficient balance (has ₦${(fullOrder.user.balance / 100).toLocaleString()}, needs ₦${(newCharge / 100).toLocaleString()})` }, { status: 400 });
      }

      const usdRateSetting = await prisma.setting.findUnique({ where: { key: 'markup_usd_rate' } });
      const usdRate = Number(usdRateSetting?.value || 1600);
      const newCost = Math.round((Number(service.costPer1k) * usdRate / 1000) * remainingQty / 100) * 100;

      let dripSchedule = null;
      let redispatchDripConfig = null;
      let redispatchDripDays = null;
      if (hasDrip) {
        const providerMin = service.min || 50;
        const groupType = fullOrder.tier?.group?.type || '';
        const platform = (fullOrder.service?.category || '').toLowerCase();
        if (fullOrder.dripDays && fullOrder.dripDays > 1) {
          const proportionalDays = Math.max(2, Math.round(fullOrder.dripDays * remainingQty / fullOrder.quantity));
          const { calculateMultiDayDrip } = await import('@/lib/drip-feed');
          const parentConfig = fullOrder.dripConfig || null;
          const childConfig = parentConfig ? { ...parentConfig, startAt: undefined, pauseDay: undefined } : null;
          if (remainingQty < providerMin) {
            await logActivity(admin.name, `Redispatch blocked: ${orderId} remainder (${remainingQty}) is below provider minimum (${providerMin})`, 'order');
            return Response.json({ error: `Remaining quantity (${remainingQty}) is below the provider minimum (${providerMin}). Cannot redispatch.` }, { status: 400 });
          }
          const safeChildConfig = childConfig || { version: 1 };
          dripSchedule = calculateMultiDayDrip(remainingQty, proportionalDays, providerMin, new Date(), groupType, platform, safeChildConfig);
          if (dripSchedule?.dispatches) {
            const invalid = dripSchedule.dispatches.find(d => d.quantity < providerMin || d.quantity <= 0);
            if (invalid) {
              return Response.json({ error: `Redispatch would create a sub-minimum batch (${invalid.quantity} < ${providerMin}). Adjust quantity or days.` }, { status: 400 });
            }
          }
          redispatchDripConfig = safeChildConfig;
          redispatchDripDays = dripSchedule ? Math.max(...dripSchedule.dispatches.map(d => d.day)) : 1;
        } else {
          const { calculateIntradayDrip, validateIntradayDuration } = await import('@/lib/drip-feed');
          const intraday = calculateIntradayDrip(remainingQty, providerMin, new Date(), groupType, platform);
          if (intraday) {
            const durationErr = validateIntradayDuration(intraday.dispatches);
            if (durationErr) return Response.json({ error: durationErr }, { status: 400 });
            dripSchedule = { dispatches: intraday.dispatches.map(d => ({ ...d, day: 1 })) };
          }
        }
      }

      const newId = await nextOrderId();
      const childOfferSnapshot = buildOrderOfferSnapshot({
        tier: fullOrder.tier,
        service,
        sourceOrder: fullOrder,
      });
      let newOrder;
      try {
        newOrder = await prisma.$transaction(async (tx) => {
          if (!await lockOrderSettlementAccount(tx, fullOrder.userId)) {
            const unavailable = new Error('Account is pending deletion');
            unavailable.code = 'ACCOUNT_UNAVAILABLE';
            throw unavailable;
          }

          // A refund and redispatch both own the user row, so recompute the
          // charge only after taking that lock instead of using the stale
          // amount observed before this transaction.
          const lockedRefunded = await getTotalRefundedKobo(tx, { orderId: fullOrder.orderId, orderDbId: fullOrder.id, userId: fullOrder.userId });
          const lockedHeld = Math.max(0, fullOrder.charge - lockedRefunded);
          newCharge = Math.max(0, expectedCharge - lockedHeld);

          const parentClaim = await tx.order.updateMany({
            where: { id: fullOrder.id, status: 'Cancelled', redispatchedAt: null },
            data: { redispatchedAt: new Date() },
          });
          if (parentClaim.count === 0) {
            const conflict = new Error('Order already redispatched');
            conflict.code = 'REDISPATCH_CONFLICT';
            throw conflict;
          }
          if (newCharge > 0) {
            const debited = await tx.$executeRaw`
              UPDATE users SET balance = balance - ${newCharge}
              WHERE id = ${fullOrder.user.id}
                AND status IN ('Active', 'Suspended')
                AND "deletedAt" IS NULL
                AND "anonymizedAt" IS NULL
                AND balance >= ${newCharge}
            `;
            if (Number(debited) !== 1) {
              const insufficient = new Error('Insufficient balance');
              insufficient.code = 'INSUFFICIENT_BALANCE';
              throw insufficient;
            }
          }
          const child = await tx.order.create({
            data: {
              orderId: newId, userId: fullOrder.userId, serviceId: service.id, tierId: fullOrder.tierId,
              link, quantity: remainingQty, charge: newCharge, cost: newCost, status: 'Pending',
              parentOrderId: fullOrder.orderId,
              comments: (fullOrder.comments && delivered > 0)
                ? (() => { const cl = fullOrder.comments.split('\n').filter(l => l.trim()); return cl.length > delivered ? cl.slice(delivered).join('\n') : fullOrder.comments; })()
                : fullOrder.comments,
              ...childOfferSnapshot,
              ...(initialBlocker ? { queuedBehind: initialBlocker.orderId } : {}),
              ...(dripSchedule ? { dripDays: redispatchDripDays || 1, ...(redispatchDripConfig ? { dripConfig: redispatchDripConfig } : {}) } : {}),
            },
          });
          if (newCharge > 0) {
            await tx.transaction.create({
              data: {
                userId: fullOrder.userId, type: 'order', amount: -newCharge,
                method: 'wallet', status: 'Completed', reference: newId,
                note: `Re-dispatch ${fullOrder.orderId} → ${newId} (${remainingQty} qty)`,
              },
            });
            await enqueueMetaEvent(tx, 'Purchase', {
              eventId: `purchase_${newId}`,
              eventTime: child.createdAt,
              email: fullOrder.user.email,
              phone: fullOrder.user.phone,
              externalId: fullOrder.userId,
              sourceUrl: req.headers.get('referer') || req.url,
              customData: { value: newCharge / 100, currency: 'NGN' },
            });
          }
          if (dripSchedule) {
            await tx.dripDispatch.createMany({
              data: dripSchedule.dispatches.map(d => ({
                orderId: child.id, day: d.day || 1, batch: d.batch, quantity: d.quantity, scheduledAt: d.scheduledAt,
              })),
            });
          }
          return child;
        });
      } catch (err) {
        if (err.code === 'REDISPATCH_CONFLICT') {
          return Response.json({ error: 'Order already redispatched' }, { status: 409 });
        }
        if (err.code === 'INSUFFICIENT_BALANCE') {
          return Response.json({ error: 'Insufficient balance' }, { status: 409 });
        }
        if (err.code === 'ACCOUNT_UNAVAILABLE') {
          return Response.json({ error: 'This account is pending deletion and cannot receive redispatched orders' }, { status: 409 });
        }
        throw err;
      }

      if (newCharge > 0) triggerPurchaseDelivery(`purchase_${newId}`);

      const { placeOrder } = await import('@/lib/smm');
      const prov = service.provider || 'mtp';
      const apiType = (service.apiType || '').toLowerCase();
      const extra = {};
      if (fullOrder.comments) {
        if (apiType === 'seo') extra.keywords = fullOrder.comments;
        else if (apiType.includes('mention')) extra.usernames = fullOrder.comments;
        else if (apiType === 'poll') extra.answer_number = fullOrder.comments;
        else extra.comments = fullOrder.comments;
      }
      if (apiType === 'subscriptions') {
        const match = link.match(/instagram\.com\/([^/?#]+)/);
        if (match) extra.username = match[1];
      }
      const swapNote = serviceSwapped ? ` (service ${fullOrder.service.apiId}→${service.apiId})` : '';

      const currentBlocker = await findSameLinkDispatchBlocker(prisma, newOrder);
      if (currentBlocker) {
        await prisma.order.updateMany({
          where: { id: newOrder.id, status: 'Pending', apiOrderId: null },
          data: { status: 'Pending', queuedBehind: currentBlocker.orderId },
        });
        await logActivity(admin.name, `Redispatched ${orderId} → ${newId} (${remainingQty} qty)${swapNote} — queued behind ${currentBlocker.orderId}`, 'order');
        return Response.json({
          success: true,
          queued: true,
          queuedBehind: currentBlocker.orderId,
          newOrderId: newId,
          message: `Created ${newId} for ${remainingQty} remaining — queued behind ${currentBlocker.orderId}`,
        });
      }
      await prisma.order.updateMany({ where: { id: newOrder.id, status: 'Pending', apiOrderId: null }, data: { queuedBehind: null } });

      if (dripSchedule) {
        const first = await prisma.dripDispatch.findFirst({
          where: { orderId: newOrder.id, status: 'pending' },
          orderBy: [{ day: 'asc' }, { batch: 'asc' }],
        });
        if (first && first.scheduledAt > new Date()) {
          await logActivity(admin.name, `Redispatched ${orderId} → ${newId} (${remainingQty} qty)${swapNote} — first batch scheduled for ${first.scheduledAt.toISOString()}`, 'order');
          return Response.json({ success: true, newOrderId: newId, message: `Created ${newId} for ${remainingQty} remaining — first batch scheduled for later` });
        }
        if (first) {
          try {
            const batchExtra = { ...extra };
            if (apiType === 'subscriptions') { batchExtra.min = first.quantity; batchExtra.max = first.quantity; }
            const batchClaim = await prisma.dripDispatch.updateMany({
              where: {
                id: first.id,
                status: 'pending',
                order: { status: 'Pending', deletedAt: null, queuedBehind: null },
              },
              data: { status: 'dispatching', dispatchedAt: new Date() },
            });
            if (batchClaim.count === 0) {
              return Response.json({ success: true, newOrderId: newId, message: `Created ${newId}; dispatch was picked up by another worker` });
            }
            const result = await placeOrder(prov, service.apiId, link, first.quantity, batchExtra);
            const batchApiId = result.order ? String(result.order) : null;
            if (batchApiId) {
              const recorded = await prisma.dripDispatch.updateMany({
                where: {
                  id: first.id,
                  status: 'dispatching',
                  order: { status: 'Pending', deletedAt: null },
                },
                data: { apiOrderId: batchApiId, status: 'processing' },
              });
              if (recorded.count === 0) {
                prisma.adminIssue.create({
                  data: {
                    type: 'ghost_dispatch',
                    title: `${newId} batch 1: provider accepted after local cancellation`,
                    message: `Provider order ${batchApiId} was created after the local order became terminal. Verify provider state before taking action.`,
                    metadata: JSON.stringify({ orderId: newId, batch: 1, providerOrderId: batchApiId, link }),
                  },
                }).catch(() => {});
                return Response.json({ error: `Provider accepted ${batchApiId}, but ${newId} changed state. Verify it before taking action.` }, { status: 409 });
              }
              await prisma.order.updateMany({ where: { id: newOrder.id, status: 'Pending', deletedAt: null }, data: { status: 'Processing', dripDelivered: 1, queuedBehind: null } });
            } else {
              await prisma.dripDispatch.updateMany({ where: { id: first.id, status: 'dispatching' }, data: { status: 'pending', dispatchedAt: null } });
            }
            await logActivity(admin.name, `Redispatched ${orderId} → ${newId} (${remainingQty} qty)${swapNote}`, 'order');
            return Response.json({ success: true, newOrderId: newId, message: batchApiId ? `Created ${newId} for ${remainingQty} remaining — batch 1 dispatched` : `Created ${newId} for ${remainingQty} remaining — batch 1 remains pending` });
          } catch (err) {
            if (isActiveOrderConflict(err)) {
              const blocker = await findSameLinkDispatchBlocker(prisma, newOrder);
              const reset = await prisma.dripDispatch.updateMany({
                where: {
                  id: first.id,
                  status: 'dispatching',
                  order: { status: 'Pending', deletedAt: null },
                },
                data: { status: 'pending', lastError: null, dispatchedAt: null, scheduledAt: await (async () => {
                  const raw = new Date(Date.now() + 30 * 60 * 1000);
                  if (redispatchDripConfig?.window) {
                    const { snapToWindow: snap } = await import('@/lib/drip-feed');
                    return snap(raw, redispatchDripConfig.window, redispatchDripConfig.timezone || null);
                  }
                  return raw;
                })() },
              });
              if (reset.count === 0) return Response.json({ error: `${newId} changed state while dispatching` }, { status: 409 });
              await prisma.order.updateMany({
                where: { id: newOrder.id, status: 'Pending', deletedAt: null },
                data: { status: 'Pending', queuedBehind: blocker?.orderId || null },
              });
              await logActivity(admin.name, `Redispatched ${orderId} → ${newId} (${remainingQty} qty)${swapNote} — queued${blocker ? ` behind ${blocker.orderId}` : ''}`, 'order');
              return Response.json({
                success: true,
                queued: true,
                queuedBehind: blocker?.orderId || null,
                newOrderId: newId,
                message: blocker
                  ? `Created ${newId} for ${remainingQty} remaining — queued behind ${blocker.orderId}`
                  : `Created ${newId} for ${remainingQty} remaining — provider is busy, retry scheduled`,
              });
            }
            await prisma.dripDispatch.updateMany({ where: { id: first.id, status: 'dispatching', order: { status: 'Pending', deletedAt: null } }, data: { status: 'failed', lastError: err.message.slice(0, 500) } });
            await logActivity(admin.name, `Redispatched ${orderId} → ${newId} (${remainingQty} qty)${swapNote} — batch 1 needs review`, 'order');
            return Response.json({ success: true, newOrderId: newId, message: `Created ${newId} for ${remainingQty} remaining — first batch needs review` });
          }
        }
      }

      const directProviderMin = service.min || 50;
      if (remainingQty < directProviderMin) {
        await logActivity(admin.name, `Redispatched ${orderId} → ${newId} (${remainingQty} qty)${swapNote} — held: below provider minimum (${directProviderMin})`, 'order');
        return Response.json({ success: true, newOrderId: newId, message: `Created ${newId} for ${remainingQty} remaining — held (below provider minimum ${directProviderMin})` });
      }

      const directClaim = await prisma.order.updateMany({
        where: { id: newOrder.id, status: 'Pending', apiOrderId: null, queuedBehind: null },
        data: { status: 'Dispatching', dispatchedAt: new Date() },
      });
      if (directClaim.count === 0) {
        return Response.json({ success: true, newOrderId: newId, message: `Created ${newId}; dispatch was picked up by another worker` });
      }
      try {
        if (apiType === 'subscriptions') { extra.min = remainingQty; extra.max = remainingQty; }
        const result = await placeOrder(prov, service.apiId, link, remainingQty, extra);
        const apiOrderId = result.order ? String(result.order) : null;
        const recorded = await prisma.order.updateMany({
          where: { id: newOrder.id, status: 'Dispatching', apiOrderId: null, deletedAt: null },
          data: apiOrderId
            ? { apiOrderId, status: 'Processing', dispatchedAt: new Date(), queuedBehind: null, lastError: null }
            : { status: 'Pending', dispatchedAt: null },
        });
        if (apiOrderId && recorded.count === 0) {
          prisma.adminIssue.create({
            data: {
              type: 'ghost_dispatch',
              title: `${newId}: provider accepted after local cancellation`,
              message: `Provider order ${apiOrderId} was created after the local order became terminal. Verify provider state before taking action.`,
              metadata: JSON.stringify({ orderId: newId, providerOrderId: apiOrderId, link }),
            },
          }).catch(() => {});
          return Response.json({ error: `Provider accepted ${apiOrderId}, but ${newId} changed state. Verify it before taking action.` }, { status: 409 });
        }
        await logActivity(admin.name, `Redispatched ${orderId} → ${newId} (${remainingQty} qty)${swapNote} → ${apiOrderId || 'no ID'}`, 'order');
        return Response.json({ success: true, newOrderId: newId, apiOrderId, message: `Created ${newId} for ${remainingQty} remaining: ${apiOrderId || 'pending'}` });
      } catch (err) {
        if (isActiveOrderConflict(err)) {
          const blocker = await findSameLinkDispatchBlocker(prisma, newOrder);
          await prisma.order.updateMany({ where: { id: newOrder.id, status: 'Dispatching', apiOrderId: null }, data: { status: 'Pending', dispatchedAt: null, lastError: PROVIDER_ACTIVE_WAIT, queuedBehind: blocker?.orderId || null } });
          await logActivity(admin.name, `Redispatched ${orderId} → ${newId} (${remainingQty} qty)${swapNote} — queued${blocker ? ` behind ${blocker.orderId}` : ''}`, 'order');
          return Response.json({ success: true, queued: true, queuedBehind: blocker?.orderId || null, newOrderId: newId, message: blocker ? `Created ${newId} — queued behind ${blocker.orderId}` : `Created ${newId} — provider is busy, retry scheduled` });
        }
        const isTimeout = /timed?\s?out|ETIMEDOUT|ECONNABORTED|ECONNRESET|socket hang up|retries failed/i.test(err.message);
        await prisma.order.updateMany({ where: { id: newOrder.id, status: 'Dispatching', apiOrderId: null }, data: { status: isTimeout ? 'Dispatching' : 'Pending', dispatchedAt: isTimeout ? undefined : null, lastError: (isTimeout ? '[TIMEOUT] ' : '') + err.message.slice(0, 450) } });
        await logActivity(admin.name, `Redispatched ${orderId} → ${newId} (${remainingQty} qty)${swapNote} — provider error`, 'order');
        return Response.json({ success: true, newOrderId: newId, message: isTimeout ? `Created ${newId} — dispatch is ambiguous and needs review` : `Created ${newId} — provider error, will retry` });
      }
    }

    // A timed-out batch blocks both Dispatch and Reset, because we genuinely
    // cannot tell whether the provider took it. Only a human looking at the
    // provider dashboard can settle that, and until now there was no way to
    // record having done so — the batch stayed stuck forever.
    //
    // Deliberately not inferred from a missing apiOrderId: a timeout means the
    // request went out and no reply came back, so the provider may well have
    // accepted it and we simply never received the id. Absence proves nothing.
    if (action === 'reconcile_drip') {
      const { dispatchId } = body;
      if (!dispatchId) return Response.json({ error: 'Dispatch ID required' }, { status: 400 });

      const dispatch = await prisma.dripDispatch.findUnique({ where: { id: dispatchId } });
      if (!dispatch) return Response.json({ error: 'Dispatch not found' }, { status: 404 });
      if (dispatch.orderId !== order.id) return Response.json({ error: 'Batch does not belong to this order' }, { status: 400 });

      const err = String(dispatch.lastError || '');
      if (!err.startsWith('[TIMEOUT]') && !err.startsWith('[VERIFY_STALE]')) {
        return Response.json({ error: 'This batch is not stuck — nothing to reconcile' }, { status: 400 });
      }

      const stamp = `[RECONCILED] ${admin.name} confirmed absent at provider, ${new Date().toISOString().slice(0, 16)}`;
      await prisma.dripDispatch.update({ where: { id: dispatchId }, data: { lastError: stamp } });
      await logActivity(admin.name, `Reconciled drip batch ${dispatch.batch} on ${order.orderId} — confirmed not at provider`, 'order');
      return Response.json({ success: true, message: `Batch ${dispatch.batch} cleared. You can now Reset or Dispatch it.` });
    }

    if (action === 'reset_drip') {
      const { dispatchId, quantity } = body;
      if (!dispatchId) return Response.json({ error: 'Dispatch ID required' }, { status: 400 });
      const qty = parseInt(quantity, 10);
      if (!qty || qty < 1) return Response.json({ error: 'Quantity must be at least 1' }, { status: 400 });

      const dispatch = await prisma.dripDispatch.findUnique({ where: { id: dispatchId } });
      if (!dispatch) return Response.json({ error: 'Dispatch not found' }, { status: 404 });
      if (!['failed', 'partial'].includes(dispatch.status)) return Response.json({ error: 'Only failed or partial batches can be reset' }, { status: 400 });

      const providerMin = order.service?.min || 50;

      const resetResult = await prisma.$transaction(async (tx) => {
        const parentRows = await tx.$queryRaw`
          SELECT "id", "orderId", "status", "deletedAt"
          FROM "orders"
          WHERE "id" = ${dispatch.orderId}
          FOR UPDATE
        `;
        const parentOrder = parentRows[0];
        if (!parentOrder) return { error: 'Parent order not found', code: 404 };
        if (['Cancelled', 'Completed', 'Partial', 'Cancelling'].includes(parentOrder.status) || parentOrder.deletedAt) {
          return { error: 'Parent order is no longer active', code: 400 };
        }

        const sourceRows = await tx.$queryRaw`
          SELECT "id", "status", "quantity", "remains", "batch", "lastError"
          FROM "drip_dispatches"
          WHERE "id" = ${dispatch.id}
          FOR UPDATE
        `;
        const source = sourceRows[0];
        if (!source || !['failed', 'partial'].includes(source.status)) {
          return { error: 'Source batch is no longer eligible for reset', code: 400 };
        }

        if (source.status === 'partial' && source.remains == null) {
          return { error: 'Source batch has unknown delivery — sync with provider first', code: 400 };
        }

        const srcError = source.lastError ? String(source.lastError) : '';
        if (srcError.startsWith('[TIMEOUT]') || srcError.startsWith('[VERIFY_STALE]')) {
          return {
            error: `Batch ${source.batch} timed out, so we cannot tell whether the provider received it. `
              + `Resetting now risks sending it twice. Search the provider dashboard for this order first. `
              + `If it is genuinely not there, a developer needs to clear the flag before Reset will work \u{2014} `
              + `there is no button for that yet.`,
            code: 400,
          };
        }

        const undelivered = source.remains != null ? Number(source.remains) : Number(source.quantity);
        if (qty !== undelivered) {
          return { error: `Reset quantity must equal the undelivered amount (${undelivered}). Partial resets are not supported.`, code: 400 };
        }
        if (undelivered < providerMin) {
          return { error: `Undelivered quantity (${undelivered}) is below provider minimum (${providerMin})`, code: 400 };
        }

        const lastBatch = await tx.dripDispatch.findFirst({
          where: { orderId: dispatch.orderId },
          orderBy: [{ day: 'desc' }, { batch: 'desc' }],
          select: { day: true, batch: true, scheduledAt: true },
        });

        const newDay = lastBatch ? lastBatch.day : 1;
        const newBatch = lastBatch ? lastBatch.batch + 1 : 1;
        const scheduleAfter = lastBatch?.scheduledAt || new Date();
        const scheduledAt = new Date(Math.max(scheduleAfter.getTime() + 60000, Date.now() + 60000));

        // Supersede source BEFORE creating replacement — if CAS fails, no orphan
        const claimed = await tx.dripDispatch.updateMany({
          where: { id: source.id, status: source.status },
          data: { status: 'superseded', lastError: `replaced:#${newBatch}` },
        });
        if (claimed.count === 0) return { error: 'Source batch changed during reset', code: 409 };

        await tx.dripDispatch.create({
          data: {
            orderId: dispatch.orderId,
            day: newDay,
            batch: newBatch,
            quantity: undelivered,
            scheduledAt,
          },
        });

        return { success: true, displayId: parentOrder.orderId, newBatch, safeQty: undelivered };
      });

      if (resetResult.error) return Response.json({ error: resetResult.error }, { status: resetResult.code });

      await logActivity(admin.name, `Reset drip batch #${dispatch.batch} on ${resetResult.displayId}: created new batch #${resetResult.newBatch} (${resetResult.safeQty} qty)`, 'order');
      return Response.json({ success: true, message: `New batch #${resetResult.newBatch} created with ${resetResult.safeQty} qty, scheduled after existing batches` });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (err) {
    log.error('Admin Orders POST', err.message);
    return Response.json({ error: 'Action failed' }, { status: 500 });
  }
}
