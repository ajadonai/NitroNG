import prisma from '@/lib/prisma';
import { log } from "@/lib/logger";
import { requireAdmin, logActivity, canSeeSensitive, maskEmail, maskPhone } from '@/lib/admin';
import { sendEmail, walletCreditEmail } from '@/lib/email';
import { checkOrder, cancelOrder, refillOrder, isProviderConfigured, getProviderName } from '@/lib/smm';
import { voidCommissions } from '@/lib/commissions';
import { cleanLink } from '@/lib/clean-link';
import { tgRefundAlert } from '@/lib/telegram';
import { reverseOrderPoints, computeRefundSplit, getTotalRefundedKobo } from '@/lib/nitro-rewards';
import { buildOrderOfferSnapshot, getOrderOfferDisplay } from '@/lib/order-offer-display';
import { findOpenSameLinkOrder, findSameLinkDispatchBlocker, isActiveOrderConflict, PROVIDER_ACTIVE_WAIT } from '@/lib/order-queue';

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
      user: { select: { name: true, email: true, phone: true } },
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
      [orders, total, statusGroups, queuedCount, needsDispatchCount] = await Promise.all([
        prisma.order.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          include,
          take: perPage,
          skip: (page - 1) * perPage,
        }),
        prisma.order.count({ where }),
        prisma.order.groupBy({ by: ['status'], where: countsWhere, _count: true }),
        prisma.order.count({ where: { ...countsWhere, queuedBehind: { not: null } } }),
        prisma.order.count({ where: searchCondition ? { ...countsWhere, AND: [...(countsWhere.AND || []), ndWhere] } : { ...baseWhere, ...ndWhere } }),
      ]);

      counts = { all: 0, needs_dispatch: needsDispatchCount, queued: queuedCount };
      for (const g of statusGroups) { counts[g.status] = g._count; counts.all += g._count; }
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
    const usdRateSetting = await prisma.setting.findUnique({ where: { key: 'markup_usd_rate' } });
    const usdRate = Number(usdRateSetting?.value || 1600);

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
        email: sensitive ? (o.user?.email || '') : maskEmail(o.user?.email),
        phone: sensitive ? (o.user?.phone || null) : maskPhone(o.user?.phone),
        service: offer.serviceName,
        tier: offer.tierLabel,
        tierLabel: offer.tierLabel,
        offerDisabled: offer.offerDisabled,
        platform: offer.platform,
        category: o.service?.category || 'unknown',
        provider: o.service?.provider || 'mtp',
        serviceApiId: o.service?.apiId || null,
        link: o.link,
        quantity: o.quantity,
        charge: o.charge / 100,
        ...(sensitive ? { cost: o.cost / 100 } : {}),
        remains: o.remains,
        startCount: o.startCount,
        status: o.status,
        apiOrderId: o.apiOrderId,
        dripDays: o.dripDays || null,
        dripEndAt: o.dripDispatches?.filter(d => !['completed', 'partial', 'failed'].includes(d.status)).sort((a, b) => b.scheduledAt - a.scheduledAt)[0]?.scheduledAt?.toISOString() || null,
        dripDispatches: o.dripDispatches?.length > 0 ? o.dripDispatches.map(d => ({ id: d.id, day: d.day, batch: d.batch, qty: d.quantity, status: d.status, apiOrderId: d.apiOrderId, scheduled: d.scheduledAt?.toISOString(), dispatched: d.dispatchedAt?.toISOString(), completed: d.completedAt?.toISOString(), error: d.lastError })) : null,
        batchId: o.batchId || null,
        lastError: o.lastError || null,
        queuedBehind: o.queuedBehind || null,
        retryCount: o.retryCount || 0,
        created: o.createdAt.toISOString(),
        serviceType: offer.serviceType,
        refundedAt: o.refundedAt?.toISOString() || null,
        redispatchedAt: o.redispatchedAt?.toISOString() || null,
        parentOrderId: o.parentOrderId || null,
        childOrderId: childMap[o.orderId] || null,
        refundedTotal: (() => {
          const raw = refundMap[o.orderId] || 0;
          return o.redispatchedAt ? Math.max(0, raw - o.charge) / 100 : raw / 100;
        })(),
        tierServiceApiId: o.tier?.service?.apiId || null,
        tierCurrentPrice: o.tier?.sellPer1k ? Math.round(Number(o.tier.sellPer1k) * o.quantity / 1000) / 100 : null,
        };
      }),
    });
  } catch (err) {
    log.error('Admin Orders', err.message);
    return Response.json({ error: 'Failed to load orders' }, { status: 500 });
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
      include: { service: { select: { provider: true } } },
    });
    if (!order) return Response.json({ error: 'Order not found' }, { status: 404 });

    const provider = order.service?.provider || 'mtp';
    const providerLabel = getProviderName(provider);

    if (action === 'cancel') {
      if (order.apiOrderId && isProviderConfigured(provider)) {
        try {
          await cancelOrder(provider, order.apiOrderId);
        } catch (e) { log.warn(`Admin Cancel ${providerLabel}`, e.message); }
      }

      const delivered = order.remains != null && order.quantity > 0 ? Math.max(0, order.quantity - order.remains) : 0;
      const isPartial = delivered > 0 && delivered < order.quantity;
      const maxRefund = isPartial ? Math.floor((order.remains / order.quantity) * order.charge / 100) * 100 : order.charge;

      const result = await prisma.$transaction(async (tx) => {
        const claimed = await tx.order.updateMany({
          where: { id: order.id, status: { not: 'Cancelled' } },
          data: { status: isPartial ? 'Partial' : 'Cancelled', queuedBehind: null, lastError: body.note ? `admin_cancelled: ${body.note}` : 'admin_cancelled', refundedAt: new Date() },
        });
        if (claimed.count === 0) return { ok: false };

        await tx.dripDispatch.updateMany({
          where: { orderId: order.id, status: { notIn: ['completed', 'partial'] } },
          data: { status: 'cancelled', completedAt: new Date() },
        });

        let refundAmount = 0;
        if (maxRefund > 0) {
          const alreadyRefunded = await getTotalRefundedKobo(tx, { orderId: order.orderId, orderDbId: order.id, userId: order.userId });
          refundAmount = Math.max(0, maxRefund - alreadyRefunded);

          if (refundAmount > 0) {
            const { walletRefund } = computeRefundSplit(order.charge, order.nitroPointsRedeemedKobo, refundAmount);
            if (walletRefund > 0) {
              await tx.user.update({ where: { id: order.userId }, data: { balance: { increment: walletRefund } } });
              await tx.transaction.create({
                data: {
                  userId: order.userId, type: 'refund', amount: walletRefund,
                  method: 'wallet', status: 'Completed',
                  reference: `ADM-REF-${order.orderId || order.id}`,
                  note: `Refund — order cancelled by admin${isPartial ? ` (${delivered}/${order.quantity} delivered)` : ''}${alreadyRefunded > 0 ? ` (₦${(alreadyRefunded / 100).toLocaleString()} already refunded)` : ''}`,
                },
              });
            }
            await reverseOrderPoints(tx, { orderDbId: order.id, refundAmountKobo: refundAmount });
          }
        }
        const split = refundAmount > 0 ? computeRefundSplit(order.charge, order.nitroPointsRedeemedKobo, refundAmount) : { walletRefund: 0, pointsRestore: 0 };
        return { ok: true, refundAmount, walletRefund: split.walletRefund, pointsRestore: split.pointsRestore };
      });
      if (!result.ok) return Response.json({ error: 'Order already cancelled' }, { status: 409 });

      if (result.refundAmount > 0) {
        tgRefundAlert({ orderId: order.orderId, amount: result.refundAmount, charge: order.charge, qty: order.quantity, remains: order.remains, status: isPartial ? 'Partial' : 'Cancelled', reason: 'admin_cancelled', source: admin.name });
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
      return Response.json({ success: true, status: isPartial ? 'Partial' : 'Cancelled', message: result.refundAmount > 0 ? `Order cancelled${refundMsg}` : 'Order cancelled' });
    }

    if (action === 'refill') {
      if (order.apiOrderId && isProviderConfigured(provider)) {
        try {
          await refillOrder(provider, order.apiOrderId);
        } catch (e) { log.warn(`Admin Refill ${providerLabel}`, e.message); }
      }
      await logActivity(admin.name, `Requested refill for ${orderId} (${providerLabel})`, 'order');
      return Response.json({ success: true, message: 'Refill requested' });
    }

    if (action === 'check') {
      if (order.apiOrderId && isProviderConfigured(provider)) {
        try {
          const status = await checkOrder(provider, order.apiOrderId);
          const statusMap = { 'Completed': 'Completed', 'In progress': 'Processing', 'Processing': 'Processing', 'Pending': 'Pending', 'Partial': 'Partial', 'Canceled': 'Cancelled', 'Refunded': 'Cancelled' };
          const terminal = ['Partial', 'Cancelled'].includes(order.status);
          const newStatus = terminal ? order.status : (statusMap[status.status] || order.status);
          const liveRemains = status.remains != null ? Number(status.remains) : null;
          const liveStartCount = status.start_count != null ? Number(status.start_count) : null;
          const remainsUpdate = {};
          if (!terminal && liveRemains != null && liveRemains !== order.remains) remainsUpdate.remains = liveRemains;
          if (liveStartCount != null && !order.startCount) remainsUpdate.startCount = liveStartCount;
          if (Object.keys(remainsUpdate).length > 0) {
            await prisma.order.update({ where: { id: order.id }, data: remainsUpdate });
          }
          if (newStatus !== order.status) {
            if (newStatus === 'Cancelled' && order.protected) {
              return Response.json({ success: true, status: order.status, remains: liveRemains, message: `Provider says cancelled but order is protected — use explicit Cancel to override` });
            }
            if (newStatus === 'Cancelled' && order.status !== 'Cancelled' && order.charge > 0) {
              await prisma.$transaction(async (tx) => {
                const claimed = await tx.order.updateMany({
                  where: { id: order.id, status: { not: 'Cancelled' } },
                  data: { status: 'Cancelled', queuedBehind: null, refundedAt: new Date() },
                });
                if (claimed.count === 0) return;
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
              });
            } else if (newStatus === 'Partial' && status.remains) {
              const remains = Number(status.remains) || 0;
              if (remains > 0 && order.charge > 0 && order.quantity > 0) {
                const refundAmount = Math.round((remains / order.quantity) * order.charge / 100) * 100;
                if (refundAmount > 0) {
                  await prisma.$transaction(async (tx) => {
                    await tx.order.update({ where: { id: order.id }, data: { status: 'Partial', queuedBehind: null, refundedAt: new Date() } });
                    const alreadyRefunded = await getTotalRefundedKobo(tx, { orderId: order.orderId, orderDbId: order.id, userId: order.userId });
                    const cappedRefund = Math.max(0, refundAmount - alreadyRefunded);
                    if (cappedRefund <= 0) return;
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
                  });
                }
              }
            } else {
              await prisma.order.update({ where: { id: order.id }, data: { status: newStatus, queuedBehind: null } });
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
        where: { orderId: order.id, apiOrderId: { not: null }, status: { notIn: ['completed', 'partial', 'cancelled'] } },
        select: { id: true, apiOrderId: true, quantity: true, status: true, startCount: true },
      });
      if (dispatches.length === 0) return Response.json({ success: true, status: order.status, message: `No ${providerLabel} tracking` });
      for (const d of dispatches) {
        try {
          const s = await checkOrder(provider, d.apiOrderId);
          const sMap = { 'Completed': 'completed', 'In progress': 'processing', 'Processing': 'processing', 'Pending': 'pending', 'Partial': 'partial', 'Canceled': 'cancelled', 'Refunded': 'cancelled' };
          const newSt = sMap[s.status] || d.status;
          const upd = {};
          if (newSt !== d.status) upd.status = newSt;
          if (s.remains != null) upd.remains = Number(s.remains);
          if (s.start_count != null && !d.startCount) upd.startCount = Number(s.start_count);
          if (['completed', 'partial', 'cancelled'].includes(newSt)) upd.completedAt = new Date();
          if (Object.keys(upd).length > 0) await prisma.dripDispatch.update({ where: { id: d.id }, data: upd });
        } catch {}
      }
      const allDispatches = await prisma.dripDispatch.findMany({ where: { orderId: order.id }, select: { status: true, remains: true, quantity: true, startCount: true }, orderBy: [{ day: 'asc' }, { batch: 'asc' }] });
      const allDone = allDispatches.length > 0 && allDispatches.every(d => ['completed', 'partial', 'cancelled'].includes(d.status));
      const totalRemains = allDispatches.reduce((s, d) => s + (d.remains ?? d.quantity), 0);
      const parentUpd = { remains: totalRemains };
      if (allDone) {
        parentUpd.status = totalRemains > 0 ? 'Partial' : 'Completed';
        parentUpd.completedAt = new Date();
      }
      const first = allDispatches[0];
      if (first?.startCount != null && !order.startCount) parentUpd.startCount = first.startCount;
      await prisma.order.update({ where: { id: order.id }, data: parentUpd });
      await logActivity(admin.name, `Synced drip order ${orderId}: ${parentUpd.status || order.status}`, 'order');
      return Response.json({ success: true, status: parentUpd.status || order.status, remains: totalRemains });
    }

    if (action === 'refund') {
      const { percent } = body;
      if (!percent || ![25, 50, 100].includes(percent)) {
        return Response.json({ error: 'Percent must be 25, 50, or 100' }, { status: 400 });
      }

      const alreadyRefunded = await getTotalRefundedKobo(prisma, { orderId: order.orderId, orderDbId: order.id, userId: order.userId });
      const maxRefundable = Math.max(0, order.charge - alreadyRefunded);

      if (maxRefundable <= 0) return Response.json({ error: 'Order already fully refunded' }, { status: 400 });

      let refundAmount;
      if (percent === 100) {
        refundAmount = maxRefundable;
      } else {
        refundAmount = Math.round(maxRefundable * percent / 100);
        if (refundAmount > maxRefundable) refundAmount = maxRefundable;
      }
      if (refundAmount <= 0) return Response.json({ error: 'Nothing left to refund' }, { status: 400 });

      const label = percent === 100 ? 'full' : `${percent}%`;

      await prisma.$transaction(async (tx) => {
        const { walletRefund } = computeRefundSplit(order.charge, order.nitroPointsRedeemedKobo, refundAmount);
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
      });

      const { walletRefund: rWallet, pointsRestore: rPoints } = computeRefundSplit(order.charge, order.nitroPointsRedeemedKobo, refundAmount);
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
      if (['Cancelled', 'Completed', 'Partial'].includes(order.status)) return Response.json({ error: `Cannot retry a ${order.status.toLowerCase()} order` }, { status: 400 });
      const reset = await prisma.order.updateMany({
        where: { id: order.id, status: order.status, apiOrderId: null, deletedAt: null },
        data: { status: 'Pending', retryCount: 0, lastError: null },
      });
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
      if (['Cancelled', 'Completed', 'Partial'].includes(fullOrder.status)) return Response.json({ error: `Cannot dispatch a ${fullOrder.status.toLowerCase()} order` }, { status: 400 });
      if (fullOrder.apiOrderId) return Response.json({ error: 'Order already dispatched' }, { status: 400 });

      const dispatchBlocker = await findSameLinkDispatchBlocker(prisma, fullOrder);
      if (dispatchBlocker) {
        const queued = await prisma.order.updateMany({
          where: { id: fullOrder.id, status: { notIn: ['Cancelled', 'Partial', 'Completed'] }, apiOrderId: null },
          data: {
            status: fullOrder.dripDelivered > 0 ? 'Processing' : 'Pending',
            queuedBehind: dispatchBlocker.orderId,
          },
        });
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
        const released = await prisma.order.updateMany({
          where: {
            id: fullOrder.id,
            status: { in: ['Pending', 'Processing'] },
            apiOrderId: null,
            queuedBehind: fullOrder.queuedBehind,
            deletedAt: null,
          },
          data: { queuedBehind: null },
        });
        if (released.count === 0) return Response.json({ error: 'Order state changed before dispatch' }, { status: 409 });
      }

      if (hasDrip) {
        // Find the earliest failed/pending batch (ordered by day then batch)
        const candidate = await prisma.dripDispatch.findFirst({
          where: { orderId: fullOrder.id, status: { in: ['pending', 'failed'] } },
          orderBy: [{ day: 'asc' }, { batch: 'asc' }, { scheduledAt: 'asc' }],
        });
        if (!candidate) return Response.json({ error: 'No pending or failed batch to dispatch' }, { status: 400 });

        // Atomic claim — prevent race with cron or another admin
        const claimed = await prisma.dripDispatch.updateMany({
          where: {
            id: candidate.id,
            status: candidate.status,
            order: {
              status: { in: ['Pending', 'Processing'] },
              queuedBehind: null,
              deletedAt: null,
              dripDispatches: {
                none: {
                  id: { not: candidate.id },
                  status: { in: ['dispatching', 'processing'] },
                },
              },
            },
          },
          data: { status: 'dispatching', dispatchedAt: new Date() },
        });
        if (claimed.count === 0) return Response.json({ error: 'Batch is queued, the order is no longer active, or another batch is in flight' }, { status: 409 });

        try {
          const { placeOrder } = await import('@/lib/smm');
          const service = fullOrder.service;
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
              data: { status: 'pending', lastError: null, dispatchedAt: null, scheduledAt: new Date(Date.now() + 30 * 60 * 1000) },
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
      const claimed = await prisma.order.updateMany({
        where: {
          id: fullOrder.id,
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
      if (claimed.count === 0) return Response.json({ error: 'Order was claimed by another process or is still in flight' }, { status: 409 });
      try {
        const apiOrderId = await placeWithProvider({ id: fullOrder.id, service: fullOrder.service, tier: fullOrder.tier, link: fullOrder.link, quantity: fullOrder.quantity, comments: fullOrder.comments });
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
        include: { service: true, tier: { include: { service: true, group: true } }, user: { select: { id: true, balance: true } }, dripDispatches: true },
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

      const initialBlocker = await findOpenSameLinkOrder(prisma, {
        serviceId: service.id,
        link,
        excludeOrderId: fullOrder.id,
      });

      const expectedCharge = Math.round(fullOrder.charge * remainingQty / fullOrder.quantity);
      const totalRefunded = await getTotalRefundedKobo(prisma, { orderId: fullOrder.orderId, orderDbId: fullOrder.id, userId: fullOrder.userId });
      const heldFromOriginal = Math.max(0, fullOrder.charge - totalRefunded);
      const newCharge = Math.max(0, expectedCharge - heldFromOriginal);
      if (newCharge > 0 && fullOrder.user.balance < newCharge) {
        return Response.json({ error: `Insufficient balance (has ₦${(fullOrder.user.balance / 100).toLocaleString()}, needs ₦${(newCharge / 100).toLocaleString()})` }, { status: 400 });
      }

      const usdRateSetting = await prisma.setting.findUnique({ where: { key: 'markup_usd_rate' } });
      const usdRate = Number(usdRateSetting?.value || 1600);
      const newCost = Math.round((Number(service.costPer1k) * usdRate / 1000) * remainingQty / 100) * 100;

      let dripSchedule = null;
      if (hasDrip) {
        const providerMin = service.min || 50;
        const groupType = fullOrder.tier?.group?.type || '';
        const platform = (fullOrder.service?.category || '').toLowerCase();
        if (fullOrder.dripDays && fullOrder.dripDays > 1) {
          const proportionalDays = Math.max(1, Math.round(fullOrder.dripDays * remainingQty / fullOrder.quantity));
          const { calculateMultiDayDrip } = await import('@/lib/drip-feed');
          dripSchedule = calculateMultiDayDrip(remainingQty, proportionalDays, providerMin, new Date(), groupType, platform);
        } else {
          const { calculateIntradayDrip } = await import('@/lib/drip-feed');
          const intraday = calculateIntradayDrip(remainingQty, providerMin, new Date(), groupType, platform);
          if (intraday) dripSchedule = { dispatches: intraday.dispatches.map(d => ({ ...d, day: 1 })) };
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
            const debited = await tx.$executeRaw`UPDATE users SET balance = balance - ${newCharge} WHERE id = ${fullOrder.user.id} AND balance >= ${newCharge}`;
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
              parentOrderId: fullOrder.orderId, comments: fullOrder.comments,
              ...childOfferSnapshot,
              ...(initialBlocker ? { queuedBehind: initialBlocker.orderId } : {}),
              ...(dripSchedule ? { dripDays: fullOrder.dripDays || 1 } : {}),
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
        throw err;
      }

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
                data: { status: 'pending', lastError: null, dispatchedAt: null, scheduledAt: new Date(Date.now() + 30 * 60 * 1000) },
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

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (err) {
    log.error('Admin Orders POST', err.message);
    return Response.json({ error: 'Action failed' }, { status: 500 });
  }
}
