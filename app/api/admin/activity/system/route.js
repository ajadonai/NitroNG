import prisma from '@/lib/prisma';
import { log } from '@/lib/logger';
import { requireAdmin } from '@/lib/admin';

export async function GET() {
  const { error } = await requireAdmin('activity');
  if (error) return error;

  try {
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const [failedOrders, partialOrders, refundTxs] = await Promise.all([
      prisma.order.findMany({
        where: { lastError: { not: null }, updatedAt: { gte: since } },
        select: {
          orderId: true, status: true, lastError: true, retryCount: true,
          batchId: true, dispatchedAt: true, updatedAt: true, createdAt: true,
          service: { select: { name: true, provider: true } },
          user: { select: { name: true, email: true } },
        },
        orderBy: { updatedAt: 'desc' },
        take: 200,
      }),
      prisma.order.findMany({
        where: { status: 'Partial', updatedAt: { gte: since } },
        select: {
          orderId: true, quantity: true, remains: true, charge: true,
          batchId: true, updatedAt: true,
          service: { select: { name: true } },
          user: { select: { name: true } },
        },
        orderBy: { updatedAt: 'desc' },
        take: 100,
      }),
      prisma.transaction.findMany({
        where: { type: 'refund', status: 'Completed', createdAt: { gte: since } },
        select: {
          id: true, amount: true, reference: true, note: true, createdAt: true,
          user: { select: { name: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 100,
      }),
    ]);

    const events = [];

    const batchErrors = {};
    for (const o of failedOrders) {
      if (o.batchId) {
        if (!batchErrors[o.batchId]) batchErrors[o.batchId] = [];
        batchErrors[o.batchId].push(o);
      } else {
        events.push({
          id: `err-${o.orderId}`,
          type: 'dispatch_error',
          severity: o.retryCount >= 3 ? 'high' : 'medium',
          title: `Dispatch failed: ${o.orderId}`,
          detail: o.lastError,
          meta: {
            orderId: o.orderId, status: o.status,
            retries: o.retryCount, service: o.service?.name,
            provider: o.service?.provider || 'mtp', user: o.user?.name,
          },
          time: (o.updatedAt || o.createdAt).toISOString(),
        });
      }
    }
    for (const [batchId, orders] of Object.entries(batchErrors)) {
      const maxRetries = Math.max(...orders.map(o => o.retryCount));
      const latest = orders.reduce((a, b) => new Date(b.updatedAt || b.createdAt) > new Date(a.updatedAt || a.createdAt) ? b : a);
      events.push({
        id: `err-batch-${batchId}`,
        type: 'dispatch_error',
        severity: maxRetries >= 3 ? 'high' : 'medium',
        title: `Dispatch failed: ${batchId} (${orders.length} orders)`,
        detail: orders[0].lastError,
        meta: {
          batchId, orderCount: orders.length, status: latest.status,
          retries: maxRetries, service: orders.map(o => o.service?.name).filter(Boolean)[0],
          provider: orders[0].service?.provider || 'mtp', user: orders[0].user?.name,
        },
        time: (latest.updatedAt || latest.createdAt).toISOString(),
      });
    }

    for (const o of partialOrders) {
      if (failedOrders.some(f => f.orderId === o.orderId)) continue;
      events.push({
        id: `partial-${o.orderId}`,
        type: 'partial_delivery',
        severity: 'medium',
        title: `Partial delivery: ${o.orderId}`,
        detail: `${o.remains ?? '?'} of ${o.quantity} remaining`,
        meta: {
          orderId: o.orderId, batchId: o.batchId,
          service: o.service?.name, user: o.user?.name,
          delivered: o.quantity - (o.remains || 0), total: o.quantity,
        },
        time: o.updatedAt.toISOString(),
      });
    }

    for (const tx of refundTxs) {
      events.push({
        id: `refund-${tx.id}`,
        type: 'refund',
        severity: 'low',
        title: `Refund: ${tx.note || tx.reference || 'Order refund'}`,
        detail: `₦${(tx.amount / 100).toLocaleString()} refunded to ${tx.user?.name || 'user'}`,
        meta: { reference: tx.reference, user: tx.user?.name, amount: tx.amount / 100 },
        time: tx.createdAt.toISOString(),
      });
    }

    events.sort((a, b) => new Date(b.time) - new Date(a.time));

    const counts = {
      dispatch_error: events.filter(e => e.type === 'dispatch_error').length,
      partial_delivery: events.filter(e => e.type === 'partial_delivery').length,
      refund: events.filter(e => e.type === 'refund').length,
    };

    return Response.json({ events: events.slice(0, 300), counts, total: events.length });
  } catch (err) {
    log.error('System Logs', err.message);
    return Response.json({ error: 'Failed to load system logs' }, { status: 500 });
  }
}
