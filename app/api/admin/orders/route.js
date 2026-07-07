import prisma from '@/lib/prisma';
import { log } from "@/lib/logger";
import { requireAdmin, logActivity, canSeeSensitive, maskEmail, maskPhone } from '@/lib/admin';
import { sendEmail, walletCreditEmail } from '@/lib/email';
import { checkOrder, cancelOrder, refillOrder, isProviderConfigured, getProviderName } from '@/lib/smm';
import { voidCommissions } from '@/lib/commissions';
import { cleanLink } from '@/lib/clean-link';

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
    const search = url.searchParams.get('search')?.trim();

    const where = { deletedAt: null };
    if (search) {
      where.OR = [
        { orderId: { contains: search, mode: 'insensitive' } },
        { apiOrderId: { contains: search, mode: 'insensitive' } },
        { batchId: { contains: search, mode: 'insensitive' } },
        { link: { contains: search, mode: 'insensitive' } },
        { user: { name: { contains: search, mode: 'insensitive' } } },
        { user: { email: { contains: search, mode: 'insensitive' } } },
        { parentOrderId: { contains: search, mode: 'insensitive' } },
      ];
    }

    let hasDripTable = true;
    const include = {
      user: { select: { name: true, email: true, phone: true } },
      service: { select: { name: true, category: true, provider: true, apiId: true, costPer1k: true } },
      tier: { select: { tier: true, sellPer1k: true, group: { select: { name: true, platform: true, type: true } }, service: { select: { apiId: true, costPer1k: true } } } },
    };
    try {
      await prisma.dripDispatch.findFirst({ take: 1 });
      include.dripDispatches = { select: { id: true, day: true, batch: true, quantity: true, status: true, apiOrderId: true, scheduledAt: true, dispatchedAt: true, completedAt: true, lastError: true }, orderBy: { scheduledAt: 'asc' } };
      if (search && where.OR) where.OR.push({ dripDispatches: { some: { apiOrderId: { contains: search, mode: 'insensitive' } } } });
    } catch { hasDripTable = false; }

    const orders = await prisma.order.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include,
    });

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
      orders: orders.map(o => ({
        id: o.orderId || o.id,
        internalId: o.id,
        userId: o.userId,
        user: o.user?.name || 'Unknown',
        email: sensitive ? (o.user?.email || '') : maskEmail(o.user?.email),
        phone: sensitive ? (o.user?.phone || null) : maskPhone(o.user?.phone),
        service: o.tier?.group?.name || o.service?.name || o.serviceId,
        tier: o.tier?.tier || null,
        platform: o.tier?.group?.platform || o.service?.category || 'unknown',
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
        serviceType: o.tier?.group?.type || null,
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
      })),
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
      const maxRefund = isPartial ? Math.round((order.remains / order.quantity) * order.charge / 100) * 100 : order.charge;

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
          const existing = await tx.transaction.aggregate({
            where: { userId: order.userId, type: 'refund', status: 'Completed', reference: { in: [`REF-${order.orderId}`, `ADM-REF-${order.orderId}`] } },
            _sum: { amount: true },
          });
          const alreadyRefunded = existing._sum.amount || 0;
          refundAmount = Math.max(0, maxRefund - alreadyRefunded);

          if (refundAmount > 0) {
            await tx.user.update({ where: { id: order.userId }, data: { balance: { increment: refundAmount } } });
            await tx.transaction.create({
              data: {
                userId: order.userId, type: 'refund', amount: refundAmount,
                method: 'wallet', status: 'Completed',
                reference: `ADM-REF-${order.orderId || order.id}`,
                note: `Refund — order cancelled by admin${isPartial ? ` (${delivered}/${order.quantity} delivered)` : ''}${alreadyRefunded > 0 ? ` (₦${(alreadyRefunded / 100).toLocaleString()} already refunded)` : ''}`,
              },
            });
          }
        }
        return { ok: true, refundAmount };
      });
      if (!result.ok) return Response.json({ error: 'Order already cancelled' }, { status: 409 });

      voidCommissions(order.id, 'admin_cancelled').catch(() => {});

      if (result.refundAmount > 0) {
        try {
          const user = await prisma.user.findUnique({ where: { id: order.userId }, select: { email: true, name: true, notifEmail: true, notifOrders: true } });
          if (user?.email && user.notifEmail !== false && user.notifOrders !== false) {
            const amount = result.refundAmount / 100;
            walletCreditEmail(user.name || 'there', amount, 'Order cancelled — refund processed').then(html => sendEmail(user.email, `₦${amount.toLocaleString()} refunded to your Nitro wallet`, html)).catch(() => {});
          }
        } catch {}
      }

      const refundMsg = result.refundAmount > 0 ? ` — ₦${(result.refundAmount / 100).toLocaleString()} refunded` : '';
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
                const existing = await tx.transaction.aggregate({
                  where: { userId: order.userId, type: 'refund', status: 'Completed', reference: { in: [`REF-${order.orderId}`, `ADM-REF-${order.orderId}`] } },
                  _sum: { amount: true },
                });
                const alreadyRefunded = existing._sum.amount || 0;
                const refundAmount = Math.max(0, order.charge - alreadyRefunded);
                if (refundAmount > 0) {
                  await tx.$executeRaw`UPDATE users SET balance = balance + ${refundAmount} WHERE id = ${order.userId}`;
                  await tx.transaction.create({
                    data: {
                      userId: order.userId, type: 'refund', amount: refundAmount,
                      method: 'wallet', status: 'Completed',
                      reference: `REF-${order.orderId}`,
                      note: `Refund — order cancelled by provider${alreadyRefunded > 0 ? ` (₦${(alreadyRefunded / 100).toLocaleString()} already refunded)` : ''}`,
                    },
                  });
                }
              });
            } else if (newStatus === 'Partial' && status.remains) {
              const remains = Number(status.remains) || 0;
              if (remains > 0 && order.charge > 0 && order.quantity > 0) {
                const refundAmount = Math.round((remains / order.quantity) * order.charge / 100) * 100;
                if (refundAmount > 0) {
                  await prisma.$transaction(async (tx) => {
                    await tx.order.update({ where: { id: order.id }, data: { status: 'Partial', queuedBehind: null, refundedAt: new Date() } });
                    const existing = await tx.transaction.aggregate({
                      where: { userId: order.userId, type: 'refund', status: 'Completed', reference: { in: [`REF-${order.orderId}`, `ADM-REF-${order.orderId}`] } },
                      _sum: { amount: true },
                    });
                    if ((existing._sum.amount || 0) > 0) return;
                    await tx.$executeRaw`UPDATE users SET balance = balance + ${refundAmount} WHERE id = ${order.userId}`;
                    await tx.transaction.create({
                      data: {
                        userId: order.userId, type: 'refund', amount: refundAmount,
                        method: 'wallet', status: 'Completed',
                        reference: `REF-${order.orderId}`,
                        note: `Partial refund for ${order.orderId} (${remains} undelivered)`,
                      },
                    });
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

      const refRefs = order.redispatchedAt
        ? [`ADM-REF-${order.orderId}`]
        : [`REF-${order.orderId}`, `ADM-REF-${order.orderId}`];
      const existing = await prisma.transaction.aggregate({
        where: { userId: order.userId, type: 'refund', status: 'Completed', reference: { in: refRefs } },
        _sum: { amount: true },
      });
      const alreadyRefunded = existing._sum.amount || 0;
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
        await tx.user.update({ where: { id: order.userId }, data: { balance: { increment: refundAmount } } });
        await tx.transaction.create({
          data: {
            userId: order.userId, type: 'refund', amount: refundAmount,
            method: 'wallet', status: 'Completed',
            reference: `ADM-REF-${order.orderId || order.id}`,
            note: `Admin refund — ${label} (₦${(refundAmount / 100).toLocaleString()})${alreadyRefunded > 0 ? ` · ₦${(alreadyRefunded / 100).toLocaleString()} previously refunded` : ''}`,
          },
        });
        await tx.order.update({ where: { id: order.id }, data: { refundedAt: new Date() } });
      });

      try {
        const user = await prisma.user.findUnique({ where: { id: order.userId }, select: { email: true, name: true, notifEmail: true, notifOrders: true } });
        if (user?.email && user.notifEmail !== false && user.notifOrders !== false) {
          const amt = refundAmount / 100;
          walletCreditEmail(user.name || 'there', amt, 'Refund processed for your order').then(html => sendEmail(user.email, `₦${amt.toLocaleString()} refunded to your Nitro wallet`, html)).catch(() => {});
        }
      } catch {}

      const refundMsg = `₦${(refundAmount / 100).toLocaleString()}`;
      await logActivity(admin.name, `Refunded ${refundMsg} for order ${orderId} (${label})`, 'order');
      return Response.json({ success: true, message: `${refundMsg} refunded to customer` });
    }

    if (action === 'retry') {
      const order = await prisma.order.findFirst({ where: { orderId, deletedAt: null } });
      if (!order) return Response.json({ error: 'Order not found' }, { status: 404 });
      if (order.apiOrderId) return Response.json({ error: 'Order already dispatched' }, { status: 400 });
      if (order.status === 'Cancelled') return Response.json({ error: 'Order is cancelled' }, { status: 400 });
      await prisma.order.update({ where: { id: order.id }, data: { status: 'Pending', retryCount: 0, lastError: null } });
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
      if (fullOrder.status === 'Cancelled') return Response.json({ error: 'Order is cancelled' }, { status: 400 });

      // Check if this is a drip order
      const hasDrip = await prisma.dripDispatch.findFirst({ where: { orderId: fullOrder.id }, select: { id: true } });

      if (hasDrip) {
        // Find the earliest failed/pending batch (ordered by day then batch)
        const candidate = await prisma.dripDispatch.findFirst({
          where: { orderId: fullOrder.id, status: { in: ['pending', 'failed'] } },
          orderBy: [{ day: 'asc' }, { batch: 'asc' }, { scheduledAt: 'asc' }],
        });
        if (!candidate) return Response.json({ error: 'No pending or failed batch to dispatch' }, { status: 400 });

        // Atomic claim — prevent race with cron or another admin
        const claimed = await prisma.dripDispatch.updateMany({
          where: { id: candidate.id, status: candidate.status },
          data: { status: 'dispatching', dispatchedAt: new Date() },
        });
        if (claimed.count === 0) return Response.json({ error: 'Batch was claimed by another process' }, { status: 409 });

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
            await prisma.dripDispatch.update({ where: { id: candidate.id }, data: { status: 'failed', lastError: 'Provider returned no order ID' } });
            return Response.json({ error: 'Provider returned no order ID' }, { status: 502 });
          }

          await prisma.dripDispatch.update({
            where: { id: candidate.id },
            data: { apiOrderId: batchApiId, status: 'processing', lastError: null },
          });
          await prisma.order.update({
            where: { id: fullOrder.id },
            data: { status: 'Processing', dripDelivered: { increment: 1 }, lastError: null },
          });
          await logActivity(admin.name, `Manually dispatched ${orderId} day ${candidate.day} batch ${candidate.batch} → ${batchApiId}`, 'order');
          return Response.json({ success: true, apiOrderId: batchApiId, batch: candidate.batch, day: candidate.day, message: `Day ${candidate.day} batch ${candidate.batch} dispatched: ${batchApiId}` });
        } catch (err) {
          await prisma.dripDispatch.update({ where: { id: candidate.id }, data: { status: 'failed', lastError: err.message.slice(0, 500) } });
          return Response.json({ error: `Dispatch failed: ${err.message}` }, { status: 502 });
        }
      }

      // Non-drip order — atomic claim to prevent race with cron or another admin
      if (fullOrder.apiOrderId) return Response.json({ error: 'Order already dispatched' }, { status: 400 });
      const claimed = await prisma.order.updateMany({
        where: {
          id: fullOrder.id, apiOrderId: null,
          OR: [
            { status: 'Pending' },
            { status: 'Dispatching', dispatchedAt: { lte: new Date(Date.now() - 5 * 60 * 1000) } },
          ],
        },
        data: { status: 'Dispatching', dispatchedAt: new Date() },
      });
      if (claimed.count === 0) return Response.json({ error: 'Order was claimed by another process or is still in flight' }, { status: 409 });
      try {
        const apiOrderId = await placeWithProvider({ id: fullOrder.id, service: fullOrder.service, tier: fullOrder.tier, link: fullOrder.link, quantity: fullOrder.quantity, comments: fullOrder.comments });
        if (!apiOrderId) {
          await prisma.order.update({ where: { id: fullOrder.id }, data: { status: 'Pending', dispatchedAt: null } });
          return Response.json({ error: 'Provider returned no order ID' }, { status: 502 });
        }
        await logActivity(admin.name, `Manually dispatched ${orderId} → ${apiOrderId}`, 'order');
        return Response.json({ success: true, apiOrderId, status: 'Processing', message: `Dispatched: ${apiOrderId}` });
      } catch (err) {
        const isTimeout = /timed?\s?out|ETIMEDOUT|ECONNABORTED|ECONNRESET|socket hang up|retries failed/i.test(err.message);
        await prisma.order.update({ where: { id: fullOrder.id }, data: { status: isTimeout ? 'Dispatching' : 'Pending', dispatchedAt: isTimeout ? undefined : null, lastError: (isTimeout ? '[TIMEOUT] ' : '') + err.message.slice(0, 450) } });
        return Response.json({ error: `Dispatch failed: ${err.message}` }, { status: 502 });
      }
    }

    if (action === 'redispatch') {
      const { link: newLink } = body;
      const fullOrder = await prisma.order.findFirst({
        where: { OR: [{ orderId }, { id: orderId }], deletedAt: null },
        include: { service: true, tier: { include: { service: true, group: true } }, user: { select: { id: true } }, dripDispatches: true },
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
      const newOrder = await prisma.$transaction(async (tx) => {
        await tx.order.update({ where: { id: fullOrder.id }, data: { redispatchedAt: new Date() } });
        const child = await tx.order.create({
          data: {
            orderId: newId, userId: fullOrder.userId, serviceId: service.id, tierId: fullOrder.tierId,
            link, quantity: remainingQty, charge: 0, cost: newCost, status: 'Processing',
            parentOrderId: fullOrder.orderId, comments: fullOrder.comments,
            ...(dripSchedule ? { dripDays: fullOrder.dripDays || 1 } : {}),
          },
        });
        if (dripSchedule) {
          await tx.dripDispatch.createMany({
            data: dripSchedule.dispatches.map(d => ({
              orderId: child.id, day: d.day || 1, batch: d.batch, quantity: d.quantity, scheduledAt: d.scheduledAt,
            })),
          });
        }
        return child;
      });

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

      if (dripSchedule) {
        const first = await prisma.dripDispatch.findFirst({
          where: { orderId: newOrder.id, status: 'pending' },
          orderBy: [{ day: 'asc' }, { batch: 'asc' }],
        });
        if (first) {
          try {
            const batchExtra = { ...extra };
            if (apiType === 'subscriptions') { batchExtra.min = first.quantity; batchExtra.max = first.quantity; }
            await prisma.dripDispatch.update({ where: { id: first.id }, data: { status: 'dispatching', dispatchedAt: new Date() } });
            const result = await placeOrder(prov, service.apiId, link, first.quantity, batchExtra);
            const batchApiId = result.order ? String(result.order) : null;
            if (batchApiId) {
              await prisma.dripDispatch.update({ where: { id: first.id }, data: { apiOrderId: batchApiId, status: 'processing' } });
              await prisma.order.update({ where: { id: newOrder.id }, data: { dripDelivered: 1 } });
            } else {
              await prisma.dripDispatch.update({ where: { id: first.id }, data: { status: 'pending', dispatchedAt: null } });
            }
            await logActivity(admin.name, `Redispatched ${orderId} → ${newId} (${remainingQty} qty)${swapNote}`, 'order');
            return Response.json({ success: true, newOrderId: newId, message: `Created ${newId} for ${remainingQty} remaining — batch 1 dispatched` });
          } catch (err) {
            await prisma.dripDispatch.update({ where: { id: first.id }, data: { status: 'failed', lastError: err.message.slice(0, 500) } });
            await logActivity(admin.name, `Redispatched ${orderId} → ${newId} (${remainingQty} qty)${swapNote} — batch 1 failed`, 'order');
            return Response.json({ success: true, newOrderId: newId, message: `Created ${newId} for ${remainingQty} remaining — first batch failed, cron will retry` });
          }
        }
      }

      try {
        if (apiType === 'subscriptions') { extra.min = remainingQty; extra.max = remainingQty; }
        const result = await placeOrder(prov, service.apiId, link, remainingQty, extra);
        const apiOrderId = result.order ? String(result.order) : null;
        if (apiOrderId) await prisma.order.update({ where: { id: newOrder.id }, data: { apiOrderId, dispatchedAt: new Date() } });
        await logActivity(admin.name, `Redispatched ${orderId} → ${newId} (${remainingQty} qty)${swapNote} → ${apiOrderId || 'no ID'}`, 'order');
        return Response.json({ success: true, newOrderId: newId, apiOrderId, message: `Created ${newId} for ${remainingQty} remaining: ${apiOrderId || 'pending'}` });
      } catch (err) {
        await prisma.order.update({ where: { id: newOrder.id }, data: { status: 'Pending', lastError: err.message.slice(0, 500) } });
        await logActivity(admin.name, `Redispatched ${orderId} → ${newId} (${remainingQty} qty)${swapNote} — provider error`, 'order');
        return Response.json({ success: true, newOrderId: newId, message: `Created ${newId} for ${remainingQty} remaining — provider error, will retry` });
      }
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (err) {
    log.error('Admin Orders POST', err.message);
    return Response.json({ error: 'Action failed' }, { status: 500 });
  }
}
