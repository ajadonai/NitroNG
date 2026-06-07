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

    const orders = await prisma.order.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 300,
      include: {
        user: { select: { name: true, email: true } },
        service: { select: { name: true, category: true, provider: true, apiId: true } },
        tier: { select: { tier: true, group: { select: { name: true, platform: true } } } },
      },
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
        batchId: o.batchId || null,
        lastError: o.lastError || null,
        retryCount: o.retryCount || 0,
        created: o.createdAt.toISOString(),
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
    const { action, orderId } = await req.json();

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
          data: { status: isPartial ? 'Partial' : 'Cancelled', lastError: 'admin_cancelled', refundedAt: new Date() },
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
      await logActivity(admin.name, `Cancelled order ${orderId} (${providerLabel})${refundMsg}`, 'order');
      return Response.json({ success: true, message: result.refundAmount > 0 ? `Order cancelled${refundMsg}` : 'Order cancelled' });
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
      return Response.json({ success: true, status: order.status, message: `No ${providerLabel} tracking` });
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

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (err) {
    log.error('Admin Orders POST', err.message);
    return Response.json({ error: 'Action failed' }, { status: 500 });
  }
}
