import prisma from '@/lib/prisma';
import { log } from "@/lib/logger";
import { requireAdmin, logActivity } from '@/lib/admin';
import { sendEmail, walletCreditEmail } from '@/lib/email';
import { checkOrder, cancelOrder, refillOrder, isProviderConfigured, getProviderName } from '@/lib/smm';

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
        { batchId: { contains: search, mode: 'insensitive' } },
        { link: { contains: search, mode: 'insensitive' } },
        { user: { name: { contains: search, mode: 'insensitive' } } },
        { user: { email: { contains: search, mode: 'insensitive' } } },
      ];
    }

    let hasDripTable = true;
    const include = {
      user: { select: { name: true, email: true } },
      service: { select: { name: true, category: true, provider: true, apiId: true } },
      tier: { select: { tier: true, group: { select: { name: true, platform: true, type: true } } } },
    };
    try {
      await prisma.dripDispatch.findFirst({ take: 1 });
      include.dripDispatches = { select: { id: true, day: true, batch: true, quantity: true, status: true, apiOrderId: true, scheduledAt: true, dispatchedAt: true, completedAt: true, lastError: true }, orderBy: { scheduledAt: 'asc' } };
    } catch { hasDripTable = false; }

    const orders = await prisma.order.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include,
    });

    return Response.json({
      orders: orders.map(o => ({
        id: o.orderId || o.id,
        internalId: o.id,
        userId: o.userId,
        user: o.user?.name || 'Unknown',
        email: o.user?.email || '',
        service: o.tier?.group?.name || o.service?.name || o.serviceId,
        tier: o.tier?.tier || null,
        platform: o.tier?.group?.platform || o.service?.category || 'unknown',
        category: o.service?.category || 'unknown',
        provider: o.service?.provider || 'mtp',
        serviceApiId: o.service?.apiId || null,
        link: o.link,
        quantity: o.quantity,
        charge: o.charge / 100,
        cost: o.cost / 100,
        remains: o.remains,
        startCount: o.startCount,
        status: o.status,
        apiOrderId: o.apiOrderId,
        dripDays: o.dripDays || null,
        dripDispatches: o.dripDispatches?.length > 0 ? o.dripDispatches.map(d => ({ id: d.id, day: d.day, batch: d.batch, qty: d.quantity, status: d.status, apiOrderId: d.apiOrderId, scheduled: d.scheduledAt?.toISOString(), dispatched: d.dispatchedAt?.toISOString(), completed: d.completedAt?.toISOString(), error: d.lastError })) : null,
        batchId: o.batchId || null,
        lastError: o.lastError || null,
        retryCount: o.retryCount || 0,
        created: o.createdAt.toISOString(),
        serviceType: o.tier?.group?.type || null,
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
          data: { status: isPartial ? 'Partial' : 'Cancelled', lastError: body.note ? `admin_cancelled: ${body.note}` : 'admin_cancelled', refundedAt: new Date() },
        });
        if (claimed.count === 0) return { ok: false };

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
                  data: { status: 'Cancelled', refundedAt: new Date() },
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
                    await tx.order.update({ where: { id: order.id }, data: { status: 'Partial', refundedAt: new Date() } });
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
              await prisma.order.update({ where: { id: order.id }, data: { status: newStatus } });
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
      const { refundType, amount } = body;
      if (!refundType || !['full', 'partial'].includes(refundType)) {
        return Response.json({ error: 'Refund type must be "full" or "partial"' }, { status: 400 });
      }

      const existing = await prisma.transaction.aggregate({
        where: { userId: order.userId, type: 'refund', status: 'Completed', reference: { in: [`REF-${order.orderId}`, `ADM-REF-${order.orderId}`] } },
        _sum: { amount: true },
      });
      const alreadyRefunded = existing._sum.amount || 0;
      const maxRefundable = Math.max(0, order.charge - alreadyRefunded);

      if (maxRefundable <= 0) return Response.json({ error: 'Order already fully refunded' }, { status: 400 });

      let refundAmount;
      if (refundType === 'full') {
        refundAmount = maxRefundable;
      } else {
        refundAmount = Math.round((amount || 0) * 100);
        if (refundAmount <= 0) return Response.json({ error: 'Amount must be greater than zero' }, { status: 400 });
        if (refundAmount > maxRefundable) return Response.json({ error: `Amount exceeds maximum refundable (₦${(maxRefundable / 100).toLocaleString()})` }, { status: 400 });
      }

      await prisma.$transaction(async (tx) => {
        await tx.user.update({ where: { id: order.userId }, data: { balance: { increment: refundAmount } } });
        await tx.transaction.create({
          data: {
            userId: order.userId, type: 'refund', amount: refundAmount,
            method: 'wallet', status: 'Completed',
            reference: `ADM-REF-${order.orderId || order.id}`,
            note: `Admin refund — ${refundType}${refundType === 'partial' ? ` (₦${(refundAmount / 100).toLocaleString()})` : ''}${alreadyRefunded > 0 ? ` (₦${(alreadyRefunded / 100).toLocaleString()} previously refunded)` : ''}`,
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
      await logActivity(admin.name, `Refunded ${refundMsg} for order ${orderId} (${refundType})`, 'order');
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

    if (action === 'dispatch') {
      const { placeWithProvider } = await import('@/lib/bulk-dispatch');
      const fullOrder = await prisma.order.findFirst({
        where: { OR: [{ orderId }, { id: orderId }], deletedAt: null },
        include: { service: true, tier: { include: { group: true } } },
      });
      if (!fullOrder) return Response.json({ error: 'Order not found' }, { status: 404 });
      if (fullOrder.status === 'Cancelled') return Response.json({ error: 'Order is cancelled' }, { status: 400 });

      // For drip orders, dispatch the next pending/stuck batch
      const stuckBatch = await prisma.dripDispatch.findFirst({
        where: { orderId: fullOrder.id, status: { in: ['pending', 'dispatching', 'failed'] } },
        orderBy: { batch: 'asc' },
      });

      if (stuckBatch) {
        const { placeOrder } = await import('@/lib/smm');
        const service = fullOrder.service;
        const prov = service.provider || 'mtp';
        const apiType = (service.apiType || '').toLowerCase();
        const extra = {};
        if (fullOrder.comments) {
          if (apiType.includes('mention')) extra.usernames = fullOrder.comments;
          else if (apiType === 'poll') extra.answer_number = fullOrder.comments;
          else extra.comments = fullOrder.comments;
        }
        if (apiType === 'subscriptions') {
          const match = fullOrder.link.match(/instagram\.com\/([^/?#]+)/);
          if (match) extra.username = match[1];
          extra.min = stuckBatch.quantity;
          extra.max = stuckBatch.quantity;
        }

        const result = await placeOrder(prov, service.apiId, fullOrder.link, stuckBatch.quantity, extra);
        const batchApiId = result.order ? String(result.order) : null;
        if (!batchApiId) return Response.json({ error: 'Provider returned no order ID' }, { status: 502 });

        await prisma.dripDispatch.update({
          where: { id: stuckBatch.id },
          data: { apiOrderId: batchApiId, status: 'processing', lastError: null, dispatchedAt: new Date() },
        });
        await prisma.order.update({
          where: { id: fullOrder.id },
          data: { status: 'Processing', dripDelivered: { increment: 1 } },
        });
        await logActivity(admin.name, `Manually dispatched ${orderId} batch ${stuckBatch.batch} → ${batchApiId}`, 'order');
        return Response.json({ success: true, apiOrderId: batchApiId, batch: stuckBatch.batch, message: `Batch ${stuckBatch.batch} dispatched: ${batchApiId}` });
      }

      // Non-drip order
      if (fullOrder.apiOrderId) return Response.json({ error: 'Order already dispatched' }, { status: 400 });
      const apiOrderId = await placeWithProvider({ id: fullOrder.id, service: fullOrder.service, tier: fullOrder.tier, link: fullOrder.link, quantity: fullOrder.quantity, comments: fullOrder.comments });
      if (!apiOrderId) return Response.json({ error: 'Provider returned no order ID' }, { status: 502 });
      await logActivity(admin.name, `Manually dispatched ${orderId} → ${apiOrderId}`, 'order');
      return Response.json({ success: true, apiOrderId, status: 'Processing', message: `Dispatched: ${apiOrderId}` });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (err) {
    log.error('Admin Orders POST', err.message);
    return Response.json({ error: 'Action failed' }, { status: 500 });
  }
}
