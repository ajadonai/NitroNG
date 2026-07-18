export const maxDuration = 60;

import prisma from '@/lib/prisma';
import { log } from '@/lib/logger';
import { placeOrder, checkOrder } from '@/lib/smm';
import { tgDripTimeout } from '@/lib/telegram';
import { getDripConfig } from '@/lib/drip-feed';
import { awardPointsOnCompletion } from '@/lib/nitro-rewards';
import { findSameLinkDispatchBlocker, isActiveOrderConflict } from '@/lib/order-queue';

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

    // ═══ 1. FAIL STALE DISPATCHING BATCHES (stuck >5 min — ambiguous timeout) ═══
    stats.stuckFailed = 0;
    const stuckDispatching = await prisma.dripDispatch.findMany({
      where: {
        status: 'dispatching',
        dispatchedAt: { lte: new Date(Date.now() - 5 * 60 * 1000) },
      },
      include: { order: { include: { service: true } } },
      take: 10,
      orderBy: { dispatchedAt: 'asc' },
    });

    for (const dispatch of stuckDispatching) {
      const order = dispatch.order;
      if (!order) continue;
      await prisma.dripDispatch.update({
        where: { id: dispatch.id },
        data: { status: 'failed', lastError: '[TIMEOUT] Provider response lost — check provider dashboard before re-dispatching' },
      });
      prisma.adminIssue.create({
        data: { type: 'ghost_dispatch', title: `${order.orderId} batch ${dispatch.batch}: timed out — needs manual check`, message: `Dispatch timed out. The provider may or may not have created this order. Check provider dashboard before dispatching again.\nLink: ${order.link}`, metadata: JSON.stringify({ orderId: order.orderId, batch: dispatch.batch, day: dispatch.day, link: order.link }) },
      }).catch(() => {});
      tgDripTimeout(order.orderId, dispatch.batch, null, dispatch.apiOrderId, order.service?.provider);
      log.warn('Drip timeout', `${order.orderId} batch ${dispatch.batch}: marked failed after timeout`);
      stats.stuckFailed++;
    }

    // ═══ 1.5. RELEASE STALE QUEUES ═══
    // Clear queuedBehind on drip orders whose blocker is no longer active
    const queued = await prisma.order.findMany({
      where: {
        queuedBehind: { not: null },
        status: { in: ['Pending', 'Processing'] },
        deletedAt: null,
        dripDispatches: { some: { status: 'pending' } },
      },
      select: { id: true, queuedBehind: true },
      take: 200,
    });
    if (queued.length) {
      const blockerIds = [...new Set(queued.map(o => o.queuedBehind))];
      const activeBlockers = new Set(
        (await prisma.order.findMany({
          where: { orderId: { in: blockerIds }, status: { in: ['Pending', 'Processing', 'Dispatching', 'In progress'] }, deletedAt: null },
          select: { orderId: true },
        })).map(o => o.orderId),
      );
      const toRelease = queued.filter(o => !activeBlockers.has(o.queuedBehind)).map(o => o.id);
      if (toRelease.length) {
        await prisma.order.updateMany({ where: { id: { in: toRelease } }, data: { queuedBehind: null } });
        stats.queueReleased = toRelease.length;
      }
    }

    // ═══ 2. DISPATCH DUE BATCHES ═══
    const due = await prisma.dripDispatch.findMany({
      where: {
        status: 'pending',
        scheduledAt: { lte: new Date() },
        order: {
          status: { in: ['Pending', 'Processing'] },
          deletedAt: null,
          queuedBehind: null,
          dripDispatches: {
            none: { status: { in: ['dispatching', 'processing'] } },
          },
        },
      },
      include: {
        order: { include: { service: true } },
      },
      take: 50,
      orderBy: { scheduledAt: 'asc' },
    });

    for (const dispatch of due) {
      const order = dispatch.order;
      if (!order || order.deletedAt) continue;

      // Re-resolve the queue on every attempt. Earlier queued orders retain FIFO,
      // while an in-flight direct or drip order blocks dispatch even if this row's
      // queuedBehind pointer is stale or missing.
      const blocker = await findSameLinkDispatchBlocker(prisma, order);
      if (blocker) {
        if (order.queuedBehind !== blocker.orderId) {
          await prisma.order.updateMany({
            where: { id: order.id, status: { in: ['Pending', 'Processing'] }, deletedAt: null },
            data: { queuedBehind: blocker.orderId },
          });
        }
        continue;
      }

      const earliestPending = await prisma.dripDispatch.findFirst({
        where: { orderId: dispatch.orderId, status: 'pending' },
        select: { id: true },
        orderBy: [{ day: 'asc' }, { batch: 'asc' }, { scheduledAt: 'asc' }],
      });
      if (!earliestPending || earliestPending.id !== dispatch.id) continue;

      const released = await prisma.order.updateMany({
        where: {
          id: order.id,
          status: { in: ['Pending', 'Processing'] },
          deletedAt: null,
          queuedBehind: order.queuedBehind || null,
        },
        data: { queuedBehind: null },
      });
      if (released.count === 0) continue;

      // Skip if another batch for this order is already in flight
      const inFlight = await prisma.dripDispatch.findFirst({
        where: { orderId: dispatch.orderId, status: { in: ['dispatching', 'processing'] } },
      });
      if (inFlight) continue;

      // Atomic claim to prevent double dispatch
      const claimed = await prisma.dripDispatch.updateMany({
        where: {
          id: dispatch.id,
          status: 'pending',
          order: { status: { in: ['Pending', 'Processing'] }, deletedAt: null, queuedBehind: null },
        },
        data: { status: 'dispatching', dispatchedAt: new Date() },
      });
      if (claimed.count === 0) continue;

      try {
        const service = order.service;
        const provider = service.provider || 'mtp';
        const apiType = (service.apiType || '').toLowerCase();
        const extra = {};

        if (order.comments) {
          if (apiType === 'seo') extra.keywords = order.comments;
          else if (apiType.includes('mention')) extra.usernames = order.comments;
          else if (apiType === 'poll') extra.answer_number = order.comments;
          else extra.comments = order.comments;
        }

        if (apiType === 'subscriptions') {
          const match = order.link.match(/instagram\.com\/([^/?#]+)/);
          if (match) extra.username = match[1];
          extra.min = dispatch.quantity;
          extra.max = dispatch.quantity;
        }

        const result = await placeOrder(provider, service.apiId, order.link, dispatch.quantity, extra);
        const apiOrderId = result.order ? String(result.order) : null;

        if (apiOrderId) {
          const recorded = await prisma.dripDispatch.updateMany({
            where: {
              id: dispatch.id,
              status: 'dispatching',
              order: { status: { in: ['Pending', 'Processing'] }, deletedAt: null },
            },
            data: { apiOrderId, status: 'processing' },
          });
          if (recorded.count === 0) {
            log.warn('Drip dispatch fence', `${order.orderId} batch ${dispatch.batch}: provider accepted ${apiOrderId} after local state changed`);
            prisma.adminIssue.create({
              data: {
                type: 'ghost_dispatch',
                title: `${order.orderId} batch ${dispatch.batch}: provider accepted after local cancellation`,
                message: `Provider order ${apiOrderId} was created after the local order became terminal. Verify provider state before taking action.`,
                metadata: JSON.stringify({ orderId: order.orderId, batch: dispatch.batch, providerOrderId: apiOrderId, link: order.link }),
              },
            }).catch(() => {});
            continue;
          }
          await prisma.order.updateMany({
            where: { id: order.id, status: { in: ['Pending', 'Processing'] }, deletedAt: null },
            data: { dripDelivered: { increment: 1 }, status: 'Processing', queuedBehind: null },
          });
          stats.dispatched++;
        } else {
          await prisma.dripDispatch.updateMany({
            where: {
              id: dispatch.id,
              status: 'dispatching',
              order: { status: { in: ['Pending', 'Processing'] }, deletedAt: null },
            },
            data: { status: 'failed', lastError: 'no_order_id' },
          });
          stats.dispatchFailed++;
        }
      } catch (err) {
        const msg = err.message || '';
        const retryable = isActiveOrderConflict(err);

        log.error('Drip dispatch', `${order.orderId} batch ${dispatch.batch}: ${msg}${retryable ? ' (will retry)' : ''}`);
        const transitioned = await prisma.dripDispatch.updateMany({
          where: {
            id: dispatch.id,
            status: 'dispatching',
            order: { status: { in: ['Pending', 'Processing'] }, deletedAt: null },
          },
          data: retryable
            ? { status: 'pending', lastError: null, dispatchedAt: null, scheduledAt: new Date(Date.now() + 30 * 60 * 1000) }
            : { status: 'failed', lastError: msg.slice(0, 450) },
        });

        if (retryable && transitioned.count > 0) {
          const currentBlocker = await findSameLinkDispatchBlocker(prisma, order);
          await prisma.order.updateMany({
            where: { id: order.id, status: { in: ['Pending', 'Processing'] }, deletedAt: null },
            data: {
              status: order.dripDelivered > 0 ? 'Processing' : 'Pending',
              queuedBehind: currentBlocker?.orderId || null,
            },
          });
        }

        if (!retryable && transitioned.count > 0) {
          prisma.adminIssue.create({
            data: { type: 'ghost_dispatch', title: `${order.orderId} batch ${dispatch.batch}: dispatch failed`, message: `Provider request failed. Check provider dashboard before re-dispatching.\nLink: ${order.link}\nError: ${msg.slice(0, 200)}`, metadata: JSON.stringify({ orderId: order.orderId, batch: dispatch.batch, day: dispatch.day, link: order.link }) },
          }).catch(() => {});
          tgDripTimeout(order.orderId, dispatch.batch, null, dispatch.apiOrderId, order.service?.provider);
        }
        stats.dispatchFailed++;
      }
    }

    // ═══ 3. SYNC DISPATCHED BATCHES ═══
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
        const liveRemains = providerStatus.remains != null ? Number(providerStatus.remains) : null;
        const liveStartCount = providerStatus.start_count != null ? Number(providerStatus.start_count) : null;

        if (!newStatus || newStatus === 'processing') {
          if (liveRemains != null && liveRemains !== dispatch.remains) {
            await prisma.dripDispatch.update({
              where: { id: dispatch.id },
              data: { remains: liveRemains, ...(liveStartCount != null && dispatch.startCount == null ? { startCount: liveStartCount } : {}) },
            });
            stats.synced++;
          }
          // Alert if batch has been processing 6+ hours with no delivery
          const ageHours = dispatch.dispatchedAt ? (Date.now() - dispatch.dispatchedAt.getTime()) / 3600000 : 0;
          if (ageHours >= 6 && (liveRemains == null || liveRemains === dispatch.quantity)) {
            const order = dispatch.order;
            const already = dispatch.lastError === '[STALE]';
            if (!already) {
              await prisma.dripDispatch.update({ where: { id: dispatch.id }, data: { lastError: '[STALE]' } });
              tgDripTimeout(order.orderId, dispatch.batch, `Stalled ${Math.round(ageHours)}h on provider — no delivery. Check provider dashboard.`, dispatch.apiOrderId, order.service?.provider);
              stats.staleAlerted = (stats.staleAlerted || 0) + 1;
            }
          }
          continue;
        }

        await prisma.dripDispatch.update({
          where: { id: dispatch.id },
          data: {
            status: newStatus,
            remains: liveRemains ?? undefined,
            startCount: liveStartCount ?? undefined,
            completedAt: ['completed', 'partial'].includes(newStatus) ? new Date() : undefined,
            lastError: null,
          },
        });
        stats.synced++;

        if (['completed', 'partial'].includes(newStatus)) {
          const pending = await prisma.dripDispatch.findMany({
            where: { orderId: dispatch.orderId, status: 'pending' },
            orderBy: { batch: 'asc' },
          });
          const nextBatch = pending[0];
          if (nextBatch && nextBatch.scheduledAt <= new Date()) {
            const svcName = (dispatch.order.service?.name || '').toLowerCase();
            const svcType = ['follower', 'view', 'like', 'comment', 'play', 'engagement', 'review']
              .find(t => svcName.includes(t));
            const svcPlatform = (dispatch.order.service?.category || '').toLowerCase();
            const config = getDripConfig(svcType ? svcType + 's' : '', svcPlatform);
            const intervalMs = (config?.intervalHours || 2) * 60 * 60 * 1000;
            const now = Date.now();

            if (pending.length > 0) {
              const vals = [], prms = [];
              for (let i = 0; i < pending.length; i++) {
                const b = i * 2;
                vals.push(`($${b+1}, $${b+2}::timestamptz)`);
                prms.push(pending[i].id, new Date(now + (i + 1) * intervalMs));
              }
              await prisma.$executeRawUnsafe(`UPDATE "drip_dispatches" SET "scheduledAt" = v.t, "updatedAt" = NOW() FROM (VALUES ${vals.join(',')}) AS v(id,t) WHERE "drip_dispatches"."id" = v.id`, ...prms);
            }
          }
        }
      } catch (err) {
        log.warn('Drip sync', `dispatch ${dispatch.id}: ${err.message}`);
      }
    }

    // ═══ 4. ROLL UP PROGRESS + STATUS ═══
    const dripOrders = await prisma.order.findMany({
      where: {
        dripDispatches: { some: {} },
        status: { in: ['Pending', 'Processing'] },
        deletedAt: null,
      },
      include: {
        dripDispatches: { select: { status: true, quantity: true, remains: true, startCount: true, day: true, batch: true }, orderBy: { scheduledAt: 'asc' } },
      },
      take: 50,
    });

    const rollupRows = [];
    let doneCount = 0;
    for (const order of dripOrders) {
      if (!order.dripDispatches.length) continue;

      const all = order.dripDispatches;

      const totalRemains = all.reduce((sum, d) => {
        if (d.remains != null) return sum + d.remains;
        if (['completed'].includes(d.status)) return sum;
        return sum + d.quantity;
      }, 0);

      const firstDispatch = all.find(d => d.day === 1 && d.batch === 1) || all[0];
      const firstStartCount = firstDispatch?.startCount != null ? firstDispatch.startCount : undefined;
      const sc = (firstStartCount !== undefined && order.startCount == null) ? Number(firstStartCount) : null;

      const hasFailed = all.some(d => d.status === 'failed');
      const allDone = all.every(d => ['completed', 'partial', 'failed'].includes(d.status));

      if (allDone) {
        const hasPartial = all.some(d => d.status === 'partial');
        const hasCompleted = all.some(d => d.status === 'completed');
        const newStatus = hasFailed ? (hasCompleted || hasPartial ? 'Partial' : 'Cancelled') : (hasPartial ? 'Partial' : 'Completed');
        rollupRows.push({ id: order.id, status: newStatus, remains: totalRemains, sc });
        doneCount++;
      } else {
        rollupRows.push({ id: order.id, status: null, remains: totalRemains, sc });
      }
    }
    if (rollupRows.length) {
      const vals = [], prms = [];
      for (let i = 0; i < rollupRows.length; i++) {
        const b = i * 4;
        const r = rollupRows[i];
        vals.push(`($${b+1}, $${b+2}, $${b+3}::int, $${b+4}::int)`);
        prms.push(r.id, r.status, r.remains, r.sc);
      }
      await prisma.$executeRawUnsafe(
        `UPDATE "orders" SET "status" = COALESCE(v.s, "orders"."status"), "remains" = v.r, "completedAt" = CASE WHEN v.s IS NOT NULL THEN NOW() ELSE "orders"."completedAt" END, "startCount" = COALESCE(v.sc, "orders"."startCount"), "updatedAt" = NOW() FROM (VALUES ${vals.join(',')}) AS v(id, s, r, sc) WHERE "orders"."id" = v.id`,
        ...prms,
      );
      stats.rolledUp = doneCount;
      for (const r of rollupRows) {
        if (r.status === 'Completed' || r.status === 'Partial') {
          await awardPointsOnCompletion(r.id).catch(() => {});
        }
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
