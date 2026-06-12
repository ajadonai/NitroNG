export const maxDuration = 60;

import prisma from '@/lib/prisma';
import { log } from '@/lib/logger';
import { placeOrder, checkOrder } from '@/lib/smm';

// Drip dispatch cron — runs twice per hour (:05 and :35)
// 1. Dispatches pending drip batches that are due (scheduledAt <= now)
// 2. Syncs status of dispatched batches with provider
// 3. Rolls up order status when all dispatches complete
// GET /api/cron/drip

export async function GET(req) {
  if (!process.env.CRON_SECRET) return Response.json({ error: 'Not configured' }, { status: 503 });
  const secret = req.headers.get('authorization')?.replace('Bearer ', '') || new URL(req.url).searchParams.get('secret');
  if (secret !== process.env.CRON_SECRET) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const stats = { dispatched: 0, dispatchFailed: 0, synced: 0, completed: 0, rolledUp: 0 };

  try {
    // ═══ 0. EXPIRE STALE DISPATCHES (pending 24h+ past schedule with errors) ═══
    const expired = await prisma.dripDispatch.updateMany({
      where: {
        status: 'pending',
        lastError: { not: null },
        scheduledAt: { lte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      },
      data: { status: 'failed' },
    });
    if (expired.count > 0) stats.expired = expired.count;

    // ═══ 1. DISPATCH DUE BATCHES ═══
    const due = await prisma.dripDispatch.findMany({
      where: {
        status: 'pending',
        scheduledAt: { lte: new Date() },
      },
      include: {
        order: { include: { service: true } },
      },
      take: 30,
      orderBy: { scheduledAt: 'asc' },
    });

    for (const dispatch of due) {
      const order = dispatch.order;
      if (!order || order.status === 'Cancelled' || order.deletedAt) continue;

      // Skip if another batch for this order is already in flight
      const inFlight = await prisma.dripDispatch.findFirst({
        where: { orderId: dispatch.orderId, status: { in: ['dispatching', 'processing'] } },
      });
      if (inFlight) continue;

      // Atomic claim to prevent double dispatch
      const claimed = await prisma.dripDispatch.updateMany({
        where: { id: dispatch.id, status: 'pending' },
        data: { status: 'dispatching', dispatchedAt: new Date() },
      });
      if (claimed.count === 0) continue;

      try {
        const service = order.service;
        const provider = service.provider || 'mtp';
        const apiType = (service.apiType || '').toLowerCase();
        const extra = {};

        if (order.comments) {
          if (apiType.includes('mention')) extra.usernames = order.comments;
          else if (apiType === 'poll') extra.answer_number = order.comments;
          else extra.comments = order.comments;
        }

        const result = await placeOrder(provider, service.apiId, order.link, dispatch.quantity, extra);
        const apiOrderId = result.order ? String(result.order) : null;

        if (apiOrderId) {
          await prisma.dripDispatch.update({
            where: { id: dispatch.id },
            data: { apiOrderId, status: 'processing' },
          });
          await prisma.order.update({
            where: { id: order.id },
            data: { dripDelivered: { increment: 1 }, status: 'Processing' },
          });
          stats.dispatched++;
        } else {
          await prisma.dripDispatch.update({
            where: { id: dispatch.id },
            data: { status: 'pending', lastError: 'no_order_id', dispatchedAt: null },
          });
          stats.dispatchFailed++;
        }
      } catch (err) {
        log.error('Drip dispatch', `${order.orderId} batch ${dispatch.batch}: ${err.message}`);
        await prisma.dripDispatch.update({
          where: { id: dispatch.id },
          data: { status: 'pending', lastError: err.message.slice(0, 500), dispatchedAt: null },
        });
        stats.dispatchFailed++;
      }
    }

    // ═══ 2. SYNC DISPATCHED BATCHES ═══
    const processing = await prisma.dripDispatch.findMany({
      where: {
        status: 'processing',
        apiOrderId: { not: null },
      },
      include: {
        order: { include: { service: true } },
      },
      take: 50,
      orderBy: { dispatchedAt: 'asc' },
    });

    for (const dispatch of processing) {
      try {
        const provider = dispatch.order.service?.provider || 'mtp';
        const providerStatus = await checkOrder(provider, dispatch.apiOrderId);

        const newStatus = normalizeStatus(providerStatus.status);
        if (!newStatus || newStatus === 'processing') continue;

        await prisma.dripDispatch.update({
          where: { id: dispatch.id },
          data: {
            status: newStatus,
            remains: providerStatus.remains != null ? Number(providerStatus.remains) : undefined,
            startCount: providerStatus.start_count != null ? Number(providerStatus.start_count) : undefined,
            completedAt: ['completed', 'partial'].includes(newStatus) ? new Date() : undefined,
          },
        });
        stats.synced++;
      } catch (err) {
        log.warn('Drip sync', `dispatch ${dispatch.id}: ${err.message}`);
      }
    }

    // ═══ 3. ROLL UP PROGRESS + STATUS ═══
    const dripOrders = await prisma.order.findMany({
      where: {
        dripDays: { not: null },
        status: { in: ['Pending', 'Processing'] },
        deletedAt: null,
      },
      include: {
        dripDispatches: { select: { status: true, quantity: true, remains: true } },
      },
      take: 50,
    });

    for (const order of dripOrders) {
      if (!order.dripDispatches.length) continue;

      const all = order.dripDispatches;

      // Aggregate remains: dispatched ones use their remains, unsent ones count full quantity
      const totalRemains = all.reduce((sum, d) => {
        if (d.remains != null) return sum + d.remains;
        if (['completed'].includes(d.status)) return sum;
        return sum + d.quantity;
      }, 0);

      const allDone = all.every(d => ['completed', 'partial', 'failed'].includes(d.status));

      if (allDone) {
        const hasPartial = all.some(d => d.status === 'partial');
        const hasFailed = all.some(d => d.status === 'failed');
        const newStatus = hasFailed ? 'Partial' : hasPartial ? 'Partial' : 'Completed';

        await prisma.order.update({
          where: { id: order.id },
          data: { status: newStatus, remains: totalRemains, completedAt: new Date() },
        });
        stats.rolledUp++;
      } else {
        // Update remains for live progress even while still in progress
        await prisma.order.update({
          where: { id: order.id },
          data: { remains: totalRemains },
        });
      }
    }
  } catch (err) {
    log.error('Drip cron', err.message);
    return Response.json({ error: err.message, stats }, { status: 500 });
  }

  return Response.json({ ok: true, stats });
}

function normalizeStatus(providerStatus) {
  if (!providerStatus) return null;
  const s = providerStatus.toLowerCase();
  if (s === 'completed') return 'completed';
  if (s === 'partial') return 'partial';
  if (['cancelled', 'canceled', 'refunded', 'failed', 'rejected'].includes(s)) return 'failed';
  if (['processing', 'in progress', 'pending'].includes(s)) return 'processing';
  return null;
}
