export const maxDuration = 60;

import prisma from '@/lib/prisma';
import { log } from '@/lib/logger';
import { placeOrder, checkOrder } from '@/lib/smm';
import { tgDripTimeout } from '@/lib/telegram';
import { isInWindow, snapToWindow } from '@/lib/drip-feed';
import { computeDripRollup, normalizeProviderStatus, applyDripRollup } from '@/lib/drip-completion';
import { findSameLinkDispatchBlocker, isActiveOrderConflict, wouldCreateCycle } from '@/lib/order-queue';
import { getBearerToken } from '@/lib/bearer-token';

// Drip dispatch cron — runs twice per hour (:05 and :35)
// 1. Dispatches pending drip batches that are due (scheduledAt <= now)
// 2. Syncs status of dispatched batches with provider
// 3. Rolls up order status when all dispatches complete
// GET /api/cron/drip

export async function GET(req) {
  if (!process.env.CRON_SECRET) return Response.json({ error: 'Not configured' }, { status: 503 });
  const secret = getBearerToken(req);
  if (secret !== process.env.CRON_SECRET) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const stats = { dispatched: 0, dispatchFailed: 0, synced: 0, completed: 0, rolledUp: 0 };
  const t0 = Date.now();

  try {
    await prisma.$executeRaw`SET statement_timeout = '50s'`;

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
      const transitioned = await prisma.dripDispatch.updateMany({
        where: {
          id: dispatch.id,
          status: 'dispatching',
          apiOrderId: null,
          order: { status: { in: ['Pending', 'Processing'] }, deletedAt: null },
        },
        data: { status: 'failed', lastError: '[TIMEOUT] Provider response lost — check provider dashboard before re-dispatching' },
      });
      if (transitioned.count === 0) continue;
      prisma.adminIssue.create({
        data: { type: 'ghost_dispatch', title: `${order.orderId} batch ${dispatch.batch}: timed out — needs manual check`, message: `Dispatch timed out. The provider may or may not have created this order. Check provider dashboard before dispatching again.\nLink: ${order.link}`, metadata: JSON.stringify({ orderId: order.orderId, batch: dispatch.batch, day: dispatch.day, link: order.link }) },
      }).catch(() => {});
      tgDripTimeout(order.orderId, dispatch.batch, null, dispatch.apiOrderId, order.service?.provider);
      log.warn('Drip timeout', `${order.orderId} batch ${dispatch.batch}: marked failed after timeout`);
      stats.stuckFailed++;
    }

    // ═══ 1.25. REVERT STALE VERIFYING DISPATCHES ═══
    const staleVerifying = await prisma.dripDispatch.updateMany({
      where: { status: 'verifying', updatedAt: { lte: new Date(Date.now() - 10 * 60 * 1000) } },
      data: { status: 'failed', lastError: '[VERIFY_STALE] Provider check timed out — reconcile before retrying' },
    });
    if (staleVerifying.count > 0) stats.staleVerifyingReverted = staleVerifying.count;

    // ═══ 1.3. FLAG STALE CANCELLING DISPATCHES ═══
    const staleCancelling = await prisma.dripDispatch.findMany({
      where: { status: 'cancelling', updatedAt: { lte: new Date(Date.now() - 15 * 60 * 1000) } },
      select: { id: true, orderId: true },
      take: 20,
    });
    for (const sc of staleCancelling) {
      prisma.adminIssue.create({
        data: { type: 'stale_cancelling', title: `Drip dispatch ${sc.id}: cancellation stalled`, message: 'Admin cancellation did not complete — retry from the admin panel.' },
      }).catch(() => {});
    }
    if (staleCancelling.length > 0) stats.staleCancellingFlagged = staleCancelling.length;

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
        apiOrderId: null,
        scheduledAt: { lte: new Date() },
        order: {
          status: { in: ['Pending', 'Processing'] },
          deletedAt: null,
          queuedBehind: null,
          dripDispatches: {
            none: { status: { in: ['dispatching', 'processing', 'verifying', 'cancelling'] } },
          },
        },
      },
      include: {
        order: { include: { service: true } },
      },
      take: 200,
      orderBy: { scheduledAt: 'asc' },
    });

    for (const dispatch of due) {
      const order = dispatch.order;
      if (!order || order.deletedAt) continue;

      // Re-resolve the queue on every attempt. Earlier queued orders retain FIFO,
      // while an in-flight direct or drip order blocks dispatch even if this row's
      // queuedBehind pointer is stale or missing.
      const blocker = await findSameLinkDispatchBlocker(prisma, order);
      if (blocker && !(await wouldCreateCycle(prisma, order.orderId, blocker.orderId))) {
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

      const inFlight = await prisma.dripDispatch.findFirst({
        where: { orderId: dispatch.orderId, status: { in: ['dispatching', 'processing', 'verifying', 'cancelling'] } },
      });
      if (inFlight) continue;

      // Atomic claim to prevent double dispatch
      const claimed = await prisma.dripDispatch.updateMany({
        where: {
          id: dispatch.id,
          status: 'pending',
          apiOrderId: null,
          order: { status: { in: ['Pending', 'Processing'] }, deletedAt: null, queuedBehind: null },
        },
        data: { status: 'dispatching', dispatchedAt: new Date() },
      });
      if (claimed.count === 0) continue;

      try {
        // Window enforcement: if outside delivery window, push to next slot
        const orderCfg = order.dripConfig;
        if (orderCfg?.window) {
          const cfgTz = orderCfg.timezone || null;
          if (!isInWindow(new Date(), orderCfg.window, cfgTz)) {
            const nextSlot = snapToWindow(new Date(), orderCfg.window, cfgTz);
            await prisma.dripDispatch.updateMany({
              where: { id: dispatch.id, status: 'dispatching' },
              data: { status: 'pending', dispatchedAt: null, scheduledAt: nextSlot },
            });
            continue;
          }
        }

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
            ? { status: 'pending', lastError: null, dispatchedAt: null, scheduledAt: (() => {
                const raw = new Date(Date.now() + 30 * 60 * 1000);
                const oCfg = order.dripConfig;
                return oCfg?.window ? snapToWindow(raw, oCfg.window, oCfg.timezone || null) : raw;
              })() }
            : { status: 'failed', lastError: msg.slice(0, 450) },
        });

        if (retryable && transitioned.count > 0) {
          const currentBlocker = await findSameLinkDispatchBlocker(prisma, order);
          const safeBlocker = currentBlocker && !(await wouldCreateCycle(prisma, order.orderId, currentBlocker.orderId))
            ? currentBlocker.orderId : null;
          await prisma.order.updateMany({
            where: { id: order.id, status: { in: ['Pending', 'Processing'] }, deletedAt: null },
            data: {
              status: order.dripDelivered > 0 ? 'Processing' : 'Pending',
              queuedBehind: safeBlocker,
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
        order: { include: { service: true, tier: { select: { group: { select: { type: true, platform: true } } } } } },
      },
      take: 50,
      orderBy: { dispatchedAt: 'asc' },
    });

    for (const dispatch of processing) {
      try {
        const provider = dispatch.order.service?.provider || 'mtp';
        const providerStatus = await checkOrder(provider, dispatch.apiOrderId);

        const newStatus = normalizeProviderStatus(providerStatus.status);
        const liveRemains = providerStatus.remains != null ? Number(providerStatus.remains) : null;
        const liveStartCount = providerStatus.start_count != null ? Number(providerStatus.start_count) : null;

        if (!newStatus || newStatus === 'processing') {
          if (liveRemains != null && liveRemains !== dispatch.remains) {
            const progUpd = await prisma.dripDispatch.updateMany({
              where: {
                id: dispatch.id,
                status: 'processing',
                apiOrderId: dispatch.apiOrderId,
                order: { status: { in: ['Pending', 'Processing'] }, deletedAt: null },
              },
              data: { remains: liveRemains, ...(liveStartCount != null && dispatch.startCount == null ? { startCount: liveStartCount } : {}) },
            });
            if (progUpd.count > 0) stats.synced++;
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

        const completionAt = ['completed', 'partial'].includes(newStatus) ? new Date() : undefined;
        if (['completed', 'partial'].includes(newStatus)) {
          const { rescheduleAfterDripCompletion } = await import('@/lib/drip-completion');
          await prisma.$transaction(async (tx) => {
            const r = await tx.dripDispatch.updateMany({
              where: { id: dispatch.id, status: dispatch.status, apiOrderId: dispatch.apiOrderId, order: { status: { in: ['Pending', 'Processing'] }, deletedAt: null } },
              data: { status: newStatus, remains: liveRemains ?? undefined, startCount: liveStartCount ?? undefined, completedAt: completionAt, lastError: null },
            });
            if (r.count === 1) await rescheduleAfterDripCompletion(tx, dispatch.orderId, completionAt);
          });
        } else {
          await prisma.dripDispatch.updateMany({
            where: { id: dispatch.id, status: dispatch.status, apiOrderId: dispatch.apiOrderId, order: { status: { in: ['Pending', 'Processing'] }, deletedAt: null } },
            data: { status: newStatus, remains: liveRemains ?? undefined, startCount: liveStartCount ?? undefined, completedAt: completionAt, lastError: null },
          });
        }
        stats.synced++;
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
        dripDispatches: { select: { status: true, quantity: true, remains: true, startCount: true, day: true, batch: true, lastError: true }, orderBy: { scheduledAt: 'asc' } },
      },
      take: 50,
    });

    const progressRows = [];
    for (const order of dripOrders) {
      if (!order.dripDispatches.length) continue;
      const rollup = computeDripRollup(order.dripDispatches);
      if (rollup.allDone) {
        try {
          const result = await applyDripRollup(prisma, order.id, order.dripDispatches, order.status);
          if (result) stats.rolledUp = (stats.rolledUp || 0) + 1;
        } catch (err) {
          log.warn('Drip rollup', `order ${order.id}: ${err.message}`);
        }
      } else {
        const sc = (rollup.startCount != null && order.startCount == null) ? rollup.startCount : null;
        progressRows.push({ id: order.id, remains: rollup.totalRemains, sc });
      }
    }
    if (progressRows.length) {
      const vals = [], prms = [];
      for (let i = 0; i < progressRows.length; i++) {
        const b = i * 3;
        const r = progressRows[i];
        vals.push(`($${b+1}, $${b+2}::int, $${b+3}::int)`);
        prms.push(r.id, r.remains, r.sc);
      }
      await prisma.$executeRawUnsafe(
        `UPDATE "orders" SET "remains" = v.r, "startCount" = COALESCE(v.sc, "orders"."startCount"), "updatedAt" = NOW() FROM (VALUES ${vals.join(',')}) AS v(id, r, sc) WHERE "orders"."id" = v.id AND "orders"."status" NOT IN ('Cancelled', 'Completed', 'Partial') AND "orders"."deletedAt" IS NULL`,
        ...prms,
      );
    }
  } catch (err) {
    log.error('Drip cron', err.message);
    return Response.json({ error: err.message, stats }, { status: 500 });
  }

  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  if (elapsed > 50) log.warn('Drip cron', `Approaching maxDuration: ${elapsed}s`);
  log.info('Drip cron', `${elapsed}s — dispatched ${stats.dispatched}, synced ${stats.synced}, rolledUp ${stats.rolledUp}`);
  return Response.json({ ok: true, stats });
}
