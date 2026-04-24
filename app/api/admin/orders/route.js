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
    const cursor = url.searchParams.get('cursor');
    const limit = Math.min(Number(url.searchParams.get('limit')) || 50, 200);

    const orders = await prisma.order.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: 'desc' },
      take: limit + 1, // fetch one extra to detect if there are more
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      include: {
        user: { select: { name: true, email: true } },
        service: { select: { name: true, category: true, provider: true } },
        tier: { select: { tier: true, group: { select: { name: true, platform: true } } } },
      },
    });

    const hasMore = orders.length > limit;
    const items = hasMore ? orders.slice(0, limit) : orders;
    const nextCursor = hasMore ? items[items.length - 1].id : null;

    return Response.json({
      orders: items.map(o => ({
        id: o.orderId || o.id,
        internalId: o.id,
        user: o.user?.name || 'Unknown',
        email: o.user?.email || '',
        service: o.tier?.group?.name || o.service?.name || o.serviceId,
        tier: o.tier?.tier || null,
        platform: o.tier?.group?.platform || o.service?.category || 'unknown',
        category: o.service?.category || 'unknown',
        provider: o.service?.provider || 'mtp',
        link: o.link,
        quantity: o.quantity,
        charge: o.charge / 100,
        cost: o.cost / 100,
        status: o.status,
        apiOrderId: o.apiOrderId,
        batchId: o.batchId || null,
        created: o.createdAt.toISOString(),
      })),
      nextCursor,
      hasMore,
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

      const cancelled = await prisma.$transaction(async (tx) => {
        const claimed = await tx.order.updateMany({
          where: { id: order.id, status: { not: 'Cancelled' } },
          data: { status: 'Cancelled' },
        });
        if (claimed.count === 0) return false;
        if (order.charge > 0) {
          await tx.user.update({ where: { id: order.userId }, data: { balance: { increment: order.charge } } });
          await tx.transaction.create({
            data: {
              userId: order.userId, type: 'refund', amount: order.charge,
              method: 'wallet', status: 'Completed',
              reference: `ADM-REF-${order.orderId || order.id}`,
              note: `Refund — order cancelled by admin`,
            },
          });
        }
        return true;
      });
      if (!cancelled) return Response.json({ error: 'Order already cancelled' }, { status: 409 });

      if (order.charge > 0) {
        try {
          const user = await prisma.user.findUnique({ where: { id: order.userId }, select: { email: true, name: true, notifEmail: true } });
          if (user?.email && user.notifEmail !== false) {
            const amount = order.charge / 100;
            walletCreditEmail(user.name || 'there', amount, 'Order cancelled — refund processed').then(html => sendEmail(user.email, `₦${amount.toLocaleString()} refunded to your Nitro wallet`, html)).catch(() => {});
          }
        } catch {}
      }

      await logActivity(admin.name, `Cancelled order ${orderId} (${providerLabel})${order.charge > 0 ? ` — ₦${(order.charge / 100).toLocaleString()} refunded` : ''}`, 'order');
      return Response.json({ success: true, message: order.charge > 0 ? `Order cancelled — ₦${(order.charge / 100).toLocaleString()} refunded` : 'Order cancelled' });
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
          const newStatus = statusMap[status.status] || order.status;
          if (newStatus !== order.status) {
            if (newStatus === 'Cancelled' && order.status !== 'Cancelled' && order.charge > 0) {
              await prisma.$transaction(async (tx) => {
                const claimed = await tx.order.updateMany({
                  where: { id: order.id, status: { not: 'Cancelled' } },
                  data: { status: 'Cancelled' },
                });
                if (claimed.count === 0) return;
                await tx.$executeRaw`UPDATE users SET balance = balance + ${order.charge} WHERE id = ${order.userId}`;
                const exists = await tx.transaction.findFirst({ where: { userId: order.userId, type: 'refund', reference: `REF-${order.orderId}` } });
                if (!exists) {
                  await tx.transaction.create({
                    data: {
                      userId: order.userId, type: 'refund', amount: order.charge,
                      method: 'wallet', status: 'Completed',
                      reference: `REF-${order.orderId}`,
                      note: `Refund — order cancelled by provider`,
                    },
                  });
                }
              });
            } else if (newStatus === 'Partial' && status.remains) {
              const remains = Number(status.remains) || 0;
              if (remains > 0 && order.charge > 0 && order.quantity > 0) {
                const refundAmount = Math.round((remains / order.quantity) * order.charge);
                if (refundAmount > 0) {
                  await prisma.$transaction(async (tx) => {
                    await tx.order.update({ where: { id: order.id }, data: { status: 'Partial' } });
                    const exists = await tx.transaction.findFirst({ where: { userId: order.userId, type: 'refund', reference: `REF-${order.orderId}` } });
                    if (!exists) {
                      await tx.$executeRaw`UPDATE users SET balance = balance + ${refundAmount} WHERE id = ${order.userId}`;
                      await tx.transaction.create({
                        data: {
                          userId: order.userId, type: 'refund', amount: refundAmount,
                          method: 'wallet', status: 'Completed',
                          reference: `REF-${order.orderId}`,
                          note: `Partial refund for ${order.orderId} (${remains} undelivered)`,
                        },
                      });
                    }
                  });
                }
              }
            } else {
              await prisma.order.update({ where: { id: order.id }, data: { status: newStatus } });
            }
          }
          await logActivity(admin.name, `Checked order ${orderId} via ${providerLabel}: ${newStatus}`, 'order');
          return Response.json({ success: true, status: newStatus, remains: status.remains });
        } catch (e) {
          return Response.json({ success: true, status: order.status, message: e.message });
        }
      }
      return Response.json({ success: true, status: order.status, message: `No ${providerLabel} tracking` });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (err) {
    log.error('Admin Orders POST', err.message);
    return Response.json({ error: 'Action failed' }, { status: 500 });
  }
}
