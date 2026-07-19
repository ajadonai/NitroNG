export const maxDuration = 60;

import prisma from '@/lib/prisma';
import { log } from '@/lib/logger';
import { checkOrder } from '@/lib/smm';
import { sendEmail, walletCreditEmail, batchCompletionEmail } from '@/lib/email';
import { placeWithProvider } from '@/lib/bulk-dispatch';
import { tgRefund, tgOrderCancelled, tgRefundAlert } from '@/lib/telegram';
import { createCommission, voidCommissions } from '@/lib/commissions';
import { reverseOrderPoints, computeRefundSplit, getTotalRefundedKobo, awardPointsOnCompletion } from '@/lib/nitro-rewards';
import { findSameLinkDispatchBlocker, isActiveOrderConflict, PROVIDER_ACTIVE_WAIT } from '@/lib/order-queue';
import { getApplicationUrl } from '@/lib/env';
import { getBearerToken } from '@/lib/bearer-token';

// Polls provider APIs for order status updates
// Auto-refunds failed/cancelled orders
// Runs every 10 minutes via Vercel Cron
// GET /api/cron/orders

export async function GET(req) {
  if (!process.env.CRON_SECRET) return Response.json({ error: 'Not configured' }, { status: 503 });
  const secret = getBearerToken(req);
  if (secret !== process.env.CRON_SECRET) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const stats = { checked: 0, updated: 0, refunded: 0, errors: 0 };

  try {
    // Get all active orders (Processing or Pending with apiOrderId)
    const activeOrders = await prisma.order.findMany({
      where: {
        status: { in: ['Processing', 'Pending', 'In progress'] },
        apiOrderId: { not: null },
        deletedAt: null,
      },
      include: { service: { select: { provider: true, category: true } }, tier: { select: { group: { select: { type: true } } } } },
      take: 200, // batch limit
      orderBy: { createdAt: 'asc' }, // oldest first
    });

    // Group orders by provider for efficient batch checking
    const byProvider = {};
    for (const order of activeOrders) {
      const provider = order.service?.provider || 'mtp';
      if (!byProvider[provider]) byProvider[provider] = [];
      byProvider[provider].push(order);
    }

    for (const [provider, orders] of Object.entries(byProvider)) {
      if (!orders.length) continue;
      // Check orders one by one (most providers don't support reliable bulk status)
      for (const order of orders) {
        try {
          stats.checked++;
          const result = await checkOrder(provider, order.apiOrderId);

          // Normalize status from provider
          const providerStatus = (result.status || '').toLowerCase();
          let newStatus = null;

          if (['completed', 'complete', 'done', 'finished', 'success'].includes(providerStatus)) {
            newStatus = 'Completed';
          } else if (['partial', 'partially completed', 'partially_completed'].includes(providerStatus)) {
            newStatus = 'Partial';
          } else if (['cancelled', 'canceled', 'refunded', 'cancelled/refunded', 'fail', 'failed', 'error'].includes(providerStatus)) {
            newStatus = 'Cancelled';
          } else if (['in progress', 'inprogress', 'in_progress', 'processing', 'pending', 'queued', 'running', 'active'].includes(providerStatus)) {
            newStatus = 'Processing';
          } else if (providerStatus) {
            log.warn(`Unknown provider status`, `Order ${order.orderId}: "${result.status}" from ${provider}`);
          }

          const liveRemains = result.remains != null ? Number(result.remains) : null;
          const liveStartCount = result.start_count != null ? Number(result.start_count) : null;

          if (!newStatus && liveRemains != null && liveRemains !== order.remains) {
            await prisma.order.update({ where: { id: order.id }, data: { remains: liveRemains, ...(liveStartCount != null && !order.startCount ? { startCount: liveStartCount } : {}) } });
            continue;
          }

          if (!newStatus || newStatus === order.status) continue;

          let providerError = result.error || result.reason || null;

          // When provider gives no reason, try to diagnose from the order data
          if (!providerError && newStatus === 'Cancelled') {
            const groupType = (order.tier?.group?.type || '').toLowerCase();
            const platform = (order.service?.category || '').toLowerCase();
            const link = (order.link || '').toLowerCase();
            const isUrl = /^https?:\/\//.test(link);

            const postPatterns = {
              instagram: /\/(p|reel|reels|tv|stories)\//i,
              tiktok: /\/(video|photo|v)\//i,
              'twitter/x': /\/status\//i,
              youtube: /\/(watch|shorts|live)\b|youtu\.be\//i,
              facebook: /\/(posts|videos|watch|reel|photo|story)\b/i,
              threads: /\/post\//i,
            };
            const shortPostDomains = { tiktok: /^(vt|vm)\.tiktok\.com$/i, 'twitter/x': /^t\.co$/i, facebook: /^(fb\.watch|fb\.me)$/i, instagram: /^ig\.me$/i };
            let linkHost; try { linkHost = new URL(link).hostname; } catch { linkHost = ''; }
            const isShortPost = Object.entries(shortPostDomains).some(([p, re]) => platform.includes(p) && re.test(linkHost));
            const isPostLink = isUrl && (isShortPost || Object.entries(postPatterns).some(([p, re]) => platform.includes(p) && re.test(link)));
            const needsPost = ['likes', 'views', 'comments', 'engagement', 'plays'].includes(groupType);
            const needsProfile = groupType === 'followers';
            const platformMatch = Object.keys(postPatterns).some(p => platform.includes(p));

            if (isUrl && platformMatch && !link.includes(platform.replace('twitter/x', 'x.com').replace('twitter/x', 'twitter'))) {
              providerError = 'wrong_platform_link';
            } else if (!isUrl && needsPost) {
              providerError = 'needs_post_link';
            } else if (needsPost && !isPostLink && isUrl && platformMatch) {
              providerError = 'needs_post_link';
            } else if (needsProfile && isPostLink) {
              providerError = 'needs_profile_link';
            }
          }

          if (newStatus === 'Cancelled' && order.protected) {
            log.warn('Protected order', `Skipping auto-cancel for ${order.orderId} (provider said cancelled)`);
            continue;
          }

          if (newStatus === 'Cancelled') {
            // Atomic: status update + refund in one transaction so neither can succeed alone
            const { safeRefund: cancelledRefund } = await prisma.$transaction(async (tx) => {
              await tx.order.update({
                where: { id: order.id },
                data: {
                  status: 'Cancelled',
                  queuedBehind: null,
                  ...(liveRemains != null ? { remains: liveRemains } : {}),
                  ...(liveStartCount != null && !order.startCount ? { startCount: liveStartCount } : {}),
                  ...(providerError ? { lastError: String(providerError).slice(0, 500) } : {}),
                  refundedAt: new Date(),
                },
              });
              const alreadyRefunded = await getTotalRefundedKobo(tx, { orderId: order.orderId, orderDbId: order.id, userId: order.userId });
              const safeRefund = Math.max(0, order.charge - alreadyRefunded);
              if (safeRefund > 0) {
                const { walletRefund } = computeRefundSplit(order.charge, order.nitroPointsRedeemedKobo, safeRefund);
                if (walletRefund > 0) {
                  await tx.$executeRaw`UPDATE users SET balance = balance + ${walletRefund} WHERE id = ${order.userId}`;
                  await tx.transaction.create({
                    data: { userId: order.userId, type: 'refund', amount: walletRefund, method: 'wallet', status: 'Completed', reference: `REF-${order.orderId}`, note: `Auto-refund for cancelled order ${order.orderId}` },
                  });
                }
                await reverseOrderPoints(tx, { orderDbId: order.id, refundAmountKobo: safeRefund });
              }
              return { safeRefund };
            });
            stats.updated++;
            voidCommissions(order.id, 'order_cancelled').catch(() => {});
            if (cancelledRefund > 0) {
              stats.refunded++;
              tgOrderCancelled(order.orderId, cancelledRefund, providerError || 'provider_cancelled');
              tgRefundAlert({ orderId: order.orderId, amount: cancelledRefund, charge: order.charge, qty: order.quantity, remains: order.remains, status: 'Cancelled', reason: providerError || 'provider_cancelled', service: order.service?.category, source: 'auto' });
              refundOrder(order, cancelledRefund, true, 'Order cancelled').catch(() => {});
            }
          } else if (newStatus === 'Partial' && result.remains) {
            const remains = Number(result.remains) || 0;
            const refundAmount = remains > 0 && order.charge > 0 && order.quantity > 0
              ? Math.floor((remains / order.quantity) * order.charge / 100) * 100 : 0;
            // Atomic: status update + partial refund
            const { safeRefund: partialRefund } = await prisma.$transaction(async (tx) => {
              await tx.order.update({
                where: { id: order.id },
                data: {
                  status: 'Partial',
                  queuedBehind: null,
                  remains: liveRemains,
                  ...(liveStartCount != null && !order.startCount ? { startCount: liveStartCount } : {}),
                  ...(refundAmount > 0 ? { refundedAt: new Date() } : {}),
                },
              });
              await awardPointsOnCompletion(order.id, tx);
              let safeRefund = 0;
              if (refundAmount > 0) {
                const alreadyRefunded = await getTotalRefundedKobo(tx, { orderId: order.orderId, orderDbId: order.id, userId: order.userId });
                safeRefund = Math.max(0, refundAmount - alreadyRefunded);
                if (safeRefund > 0) {
                  const { walletRefund } = computeRefundSplit(order.charge, order.nitroPointsRedeemedKobo, safeRefund);
                  if (walletRefund > 0) {
                    await tx.$executeRaw`UPDATE users SET balance = balance + ${walletRefund} WHERE id = ${order.userId}`;
                    await tx.transaction.create({
                      data: { userId: order.userId, type: 'refund', amount: walletRefund, method: 'wallet', status: 'Completed', reference: `REF-${order.orderId}`, note: `Partial refund for ${order.orderId}` },
                    });
                  }
                  await reverseOrderPoints(tx, { orderDbId: order.id, refundAmountKobo: safeRefund });
                }
              }
              return { safeRefund };
            });
            stats.updated++;
            if (partialRefund > 0) {
              stats.refunded++;
              tgRefundAlert({ orderId: order.orderId, amount: partialRefund, charge: order.charge, qty: order.quantity, remains: Number(result.remains) || 0, status: 'Partial', service: order.service?.category, source: 'auto' });
              refundOrder(order, partialRefund, true, 'Partial delivery').catch(() => {});
            }
            const delivered = order.quantity - (Number(result.remains) || 0);
            if (delivered > 0) {
              const partialCharge = Math.round((delivered / order.quantity) * order.charge);
              const partialCost = Math.round((delivered / order.quantity) * order.cost);
              createCommission(order.id, order.userId, partialCharge, partialCost).catch(() => {});
            }
          } else {
            await prisma.order.update({
              where: { id: order.id },
              data: {
                status: newStatus,
                ...(newStatus === 'Completed' ? { completedAt: new Date(), queuedBehind: null } : {}),
                ...(liveRemains != null ? { remains: liveRemains } : {}),
                ...(liveStartCount != null && !order.startCount ? { startCount: liveStartCount } : {}),
              },
            });
            stats.updated++;
            if (newStatus === 'Completed') {
              createCommission(order.id, order.userId, order.charge, order.cost).catch(() => {});
              await awardPointsOnCompletion(order.id).catch(() => {});
            }
          }

        } catch (err) {
          stats.errors++;
          log.warn(`Cron order check ${order.orderId}`, err.message);
        }

        // Small delay between API calls to avoid rate limiting
        await new Promise(r => setTimeout(r, 200));
      }
    }

    // Check if any batches just completed (all orders terminal)
    if (stats.updated > 0) {
      try {
        const updatedBatchIds = [...new Set(activeOrders.filter(o => o.batchId).map(o => o.batchId))];
        for (const bid of updatedBatchIds) {
          const remaining = await prisma.order.count({ where: { batchId: bid, status: { notIn: ['Completed', 'Cancelled', 'Partial'] }, deletedAt: null } });
          if (remaining === 0) {
            const batchOrders = await prisma.order.findMany({ where: { batchId: bid, deletedAt: null }, select: { status: true, charge: true, userId: true } });
            const userId = batchOrders[0]?.userId;
            if (userId) {
              const completed = batchOrders.filter(o => o.status === 'Completed').length;
              const partial = batchOrders.filter(o => o.status === 'Partial').length;
              const cancelled = batchOrders.filter(o => o.status === 'Cancelled').length;
              const refunded = batchOrders.filter(o => o.status === 'Cancelled').reduce((s, o) => s + o.charge, 0) / 100;
              const u = await prisma.user.findUnique({ where: { id: userId }, select: { email: true, name: true, notifEmail: true, notifOrders: true } });
              if (u?.email && u.notifEmail !== false && u.notifOrders !== false) {
                const html = await batchCompletionEmail(u.name, bid, completed, partial, cancelled, refunded);
                sendEmail(u.email, `Batch ${bid} — all orders complete`, html).catch(e => log.warn('Batch completion email', e.message));
              }
            }
          }
        }
      } catch (e) { log.warn('Batch completion check', e.message); }
    }

    // Retry pending orders that failed to dispatch or are queued behind duplicates
    stats.retried = 0;
    stats.retryPlaced = 0;
    try {
      const directRetryBase = {
        status: 'Pending', apiOrderId: null, dripDays: null, deletedAt: null,
        dripDispatches: { none: {} },
        OR: [
          { dispatchedAt: null },
          { dispatchedAt: { lt: new Date(Date.now() - 15 * 60 * 1000) } },
        ],
      };
      const retryInclude = { service: true, tier: { include: { group: true } } };
      const [recentRetryable, queuedRetryable, providerWaitingRetryable] = await Promise.all([
        prisma.order.findMany({
          where: {
            ...directRetryBase,
            retryCount: { lt: 5 },
            queuedBehind: null,
            createdAt: { gt: new Date(Date.now() - 24 * 60 * 60 * 1000) },
          },
          include: retryInclude,
          take: 50, orderBy: { createdAt: 'asc' },
        }),
        prisma.order.findMany({
          where: { ...directRetryBase, queuedBehind: { not: null } },
          include: retryInclude,
          take: 50, orderBy: { createdAt: 'asc' },
        }),
        prisma.order.findMany({
          where: { ...directRetryBase, lastError: PROVIDER_ACTIVE_WAIT },
          include: retryInclude,
          take: 50, orderBy: { createdAt: 'asc' },
        }),
      ]);
      const retryable = [...new Map(
        [...recentRetryable, ...queuedRetryable, ...providerWaitingRetryable].map(order => [order.id, order]),
      ).values()].sort((a, b) => a.createdAt - b.createdAt).slice(0, 50);

      for (const order of retryable) {
        // Preserve FIFO across direct and drip orders for the same service/link.
        const blocking = await findSameLinkDispatchBlocker(prisma, order);
        if (blocking) {
          if (order.queuedBehind !== blocking.orderId) {
            await prisma.order.updateMany({
              where: { id: order.id, status: 'Pending', apiOrderId: null },
              data: { queuedBehind: blocking.orderId },
            }).catch(() => {});
          }
          continue;
        }

        const claimed = await prisma.order.updateMany({
          where: {
            id: order.id,
            status: 'Pending',
            apiOrderId: null,
            dripDays: null,
            dripDispatches: { none: {} },
            queuedBehind: order.queuedBehind || null,
          },
          data: { status: 'Dispatching', dispatchedAt: new Date(), queuedBehind: null },
        });
        if (claimed.count === 0) continue;

        try {
          const apiOrderId = await placeWithProvider({ id: order.id, service: order.service, tier: order.tier, link: order.link, quantity: order.quantity, comments: order.comments });
          stats.retried++;
          if (apiOrderId) {
            stats.retryPlaced++;
          } else {
            await prisma.order.updateMany({
              where: { id: order.id, status: 'Dispatching', apiOrderId: null },
              data: { status: 'Pending', retryCount: { increment: 1 } },
            });
          }
        } catch (err) {
          if (isActiveOrderConflict(err)) {
            const currentBlocker = await findSameLinkDispatchBlocker(prisma, order);
            await prisma.order.updateMany({
              where: { id: order.id, status: 'Dispatching', apiOrderId: null },
              data: { status: 'Pending', dispatchedAt: null, queuedBehind: currentBlocker?.orderId || null, lastError: PROVIDER_ACTIVE_WAIT, retryCount: 0 },
            });
            continue;
          }
          const isDuplicate = /duplicate/i.test(err.message);
          const hadTimeout = (order.lastError || '').startsWith('[TIMEOUT]');

          if (isDuplicate && hadTimeout) {
            await prisma.order.updateMany({
              where: { id: order.id, status: 'Dispatching', apiOrderId: null },
              data: { status: 'Pending', retryCount: 5, lastError: '[DUPLICATE] Provider has this order from a previous timed-out dispatch — check provider dashboard' },
            });
            prisma.adminIssue.create({
              data: { type: 'order_failure', title: `Order ${order.orderId} may be duplicated on provider`, message: `Retry after timeout got "duplicate" from ${(order.service?.provider || 'mtp').toUpperCase()}. The original timed-out dispatch likely went through. Check provider dashboard and link the order ID manually.`, metadata: JSON.stringify({ orderId: order.orderId, serviceApiId: order.service?.apiId, provider: order.service?.provider || 'mtp', link: order.link }) },
            }).catch(() => {});
            log.warn(`Cron retry ${order.orderId}`, `Duplicate after timeout — flagged for admin review`);
          } else {
            await prisma.order.updateMany({
              where: { id: order.id, status: 'Dispatching', apiOrderId: null },
              data: {
                status: 'Dispatching',
                retryCount: { increment: 1 },
                lastError: err.message.slice(0, 500),
              },
            });
            log.warn(`Cron retry ${order.orderId}`, `Failed — held as Dispatching for manual check`);
            {
              if (/incorrect service|invalid service/i.test(err.message)) {
                const svc = order.service;
                prisma.adminIssue.findFirst({
                  where: { type: 'order_failure', status: 'open' },
                }).then(existing => {
                  const pid = svc.provider || 'mtp';
                  const entry = { serviceId: svc.id, name: svc.name, apiId: svc.apiId, provider: pid, orderId: order.orderId };
                  if (existing) {
                    let prev = [];
                    try { const m = JSON.parse(existing.metadata); prev = m.services || []; } catch {}
                    if (!prev.some(s => s.serviceId === svc.id)) prev.push(entry);
                    return prisma.adminIssue.update({
                      where: { id: existing.id },
                      data: {
                        title: `${prev.length} service${prev.length > 1 ? 's' : ''} rejected by provider`,
                        message: prev.map(s => `${s.name} (${(s.provider || 'mtp').toUpperCase()} #${s.apiId})`).join('\n'),
                        metadata: JSON.stringify({ count: prev.length, services: prev }),
                        createdAt: new Date(),
                      },
                    });
                  }
                  return prisma.adminIssue.create({
                    data: {
                      type: 'order_failure',
                      title: `1 service rejected by provider`,
                      message: `${svc.name} (${pid.toUpperCase()} #${svc.apiId})`,
                      metadata: JSON.stringify({ count: 1, services: [entry] }),
                    },
                  });
                }).catch(() => {});
              }
            }
          }
        }
        await new Promise(r => setTimeout(r, 300));
      }
    } catch (e) { log.warn('Cron retry loop', e.message); }

    // Auto-refund permanently failed orders
    stats.autoRefunded = 0;
    try {
      const exhaustedRetryCutoff = new Date(Date.now() - 6 * 60 * 60 * 1000);
      const absoluteStaleCutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const stale = await prisma.order.findMany({
        where: {
          status: 'Pending', apiOrderId: null, deletedAt: null,
          queuedBehind: null,
          dripDays: null,
          dripDispatches: { none: {} },
          AND: [
            {
              OR: [
                { retryCount: { gte: 5 }, createdAt: { lt: exhaustedRetryCutoff } },
                { createdAt: { lt: absoluteStaleCutoff } },
              ],
            },
            {
              OR: [
                { lastError: null },
                { lastError: { not: PROVIDER_ACTIVE_WAIT } },
              ],
            },
          ],
        },
        take: 100,
      });

      for (const order of stale) {
        try {
          const claimed = await prisma.$transaction(async (tx) => {
            const claimed = await tx.order.updateMany({
              where: {
                id: order.id,
                status: 'Pending',
                apiOrderId: null,
                deletedAt: null,
                queuedBehind: null,
                dripDays: null,
                dripDispatches: { none: {} },
                // Any admin retry or concurrent edit advances @updatedAt and
                // invalidates this stale snapshot before money can move.
                updatedAt: order.updatedAt,
                AND: [
                  {
                    OR: [
                      { retryCount: { gte: 5 }, createdAt: { lt: exhaustedRetryCutoff } },
                      { createdAt: { lt: absoluteStaleCutoff } },
                    ],
                  },
                  {
                    OR: [
                      { lastError: null },
                      { lastError: { not: PROVIDER_ACTIVE_WAIT } },
                    ],
                  },
                ],
              },
              data: { status: 'Cancelled', lastError: 'dispatch_failed', refundedAt: new Date() },
            });
            if (claimed.count === 0) return false;
            const { walletRefund } = computeRefundSplit(order.charge, order.nitroPointsRedeemedKobo, order.charge);
            if (walletRefund > 0) {
              await tx.$executeRaw`UPDATE users SET balance = balance + ${walletRefund} WHERE id = ${order.userId}`;
              await tx.transaction.create({
                data: { userId: order.userId, type: 'refund', amount: walletRefund, method: 'wallet', status: 'Completed', reference: `REF-${order.orderId}`, note: `Auto-refund: failed to dispatch ${order.orderId}` },
              });
            }
            await reverseOrderPoints(tx, { orderDbId: order.id, refundAmountKobo: order.charge });
            return true;
          });
          if (!claimed) continue;
          stats.autoRefunded++;
          tgRefund(order.orderId, order.charge, 'dispatch_failed');
          tgRefundAlert({ orderId: order.orderId, amount: order.charge, charge: order.charge, qty: order.quantity, status: 'Cancelled', reason: 'dispatch_failed', source: 'auto' });
          voidCommissions(order.id, 'dispatch_failed').catch(() => {});
          if (order.charge >= 5000) await refundOrder(order, order.charge, true, 'Order cancelled');
        } catch (err) {
          log.warn(`Auto-refund ${order.orderId}`, err.message);
        }
      }
    } catch (e) { log.warn('Auto-refund loop', e.message); }

    // Safety net: catch any cancelled/partial orders that slipped through without a refund
    stats.recovered = 0;
    try {
      const unrefunded = await prisma.order.findMany({
        where: {
          status: { in: ['Cancelled', 'Partial'] },
          deletedAt: null,
          refundedAt: null,
          charge: { gt: 0 },
          createdAt: { gt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
        },
        take: 50,
      });
      for (const order of unrefunded) {
        try {
          let refundAmount;
          if (order.status === 'Partial') {
            const remains = order.remains || 0;
            refundAmount = remains > 0 && order.quantity > 0
              ? Math.floor((remains / order.quantity) * order.charge / 100) * 100
              : 0;
          } else {
            refundAmount = order.charge;
          }
          if (refundAmount <= 0) {
            await prisma.order.update({ where: { id: order.id }, data: { refundedAt: new Date() } });
            continue;
          }
          const { safeRefund: recoveredRefund } = await prisma.$transaction(async (tx) => {
            const alreadyRefunded = await getTotalRefundedKobo(tx, { orderId: order.orderId, orderDbId: order.id, userId: order.userId });
            const safeRefund = Math.max(0, refundAmount - alreadyRefunded);
            if (safeRefund <= 0) {
              await tx.order.update({ where: { id: order.id }, data: { refundedAt: new Date() } });
              return { safeRefund: 0 };
            }
            const { walletRefund } = computeRefundSplit(order.charge, order.nitroPointsRedeemedKobo, safeRefund);
            if (walletRefund > 0) {
              await tx.$executeRaw`UPDATE users SET balance = balance + ${walletRefund} WHERE id = ${order.userId}`;
              await tx.transaction.create({
                data: { userId: order.userId, type: 'refund', amount: walletRefund, method: 'wallet', status: 'Completed', reference: `REF-${order.orderId}`, note: `Recovered refund for ${order.orderId}` },
              });
            }
            await reverseOrderPoints(tx, { orderDbId: order.id, refundAmountKobo: safeRefund });
            await tx.order.update({ where: { id: order.id }, data: { refundedAt: new Date() } });
            return { safeRefund };
          });
          if (recoveredRefund > 0) {
            stats.recovered++;
            log.warn(`Recovered refund ${order.orderId}`, `₦${(recoveredRefund / 100).toLocaleString()} credited`);
            tgRefundAlert({ orderId: order.orderId, amount: recoveredRefund, charge: order.charge, qty: order.quantity, remains: order.remains, status: order.status, reason: 'recovered', source: 'auto' });
            refundOrder(order, recoveredRefund, true, order.status === 'Partial' ? 'Partial delivery' : 'Order cancelled').catch(() => {});
          }
        } catch (err) {
          log.warn(`Recovery refund ${order.orderId}`, err.message);
        }
      }
    } catch (e) { log.warn('Refund recovery sweep', e.message); }

    // Clear stale queuedBehind on terminal orders (safety net)
    try {
      const { count } = await prisma.order.updateMany({
        where: { queuedBehind: { not: null }, status: { in: ['Completed', 'Cancelled', 'Partial'] } },
        data: { queuedBehind: null },
      });
      if (count > 0) stats.queueCleaned = count;
    } catch (e) { log.warn('Queue cleanup', e.message); }

    // Clean up expired idempotency keys
    try {
      const { count } = await prisma.idempotencyKey.deleteMany({ where: { expiresAt: { lt: new Date() } } });
      if (count > 0) stats.expiredKeys = count;
    } catch (e) { log.warn('Idempotency cleanup', e.message); }

    log.info('Cron orders', `Checked ${stats.checked}, updated ${stats.updated}, refunded ${stats.refunded}, retried ${stats.retried}, autoRefunded ${stats.autoRefunded}, recovered ${stats.recovered}`);

    // Fallback: also trigger drip cron (idempotent) in case its dedicated schedule missed
    fetch(`${getApplicationUrl()}/api/cron/drip`, {
      headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` },
    }).catch(() => {});

    return Response.json({ success: true, ...stats });

  } catch (err) {
    log.error('Cron orders', err.message);
    return Response.json({ error: err.message, ...stats }, { status: 500 });
  }
}

async function refundOrder(order, amount = null, emailOnly = false, failReason = null) {
  const refundAmount = amount || order.charge;
  if (!refundAmount || refundAmount <= 0) return;
  const reason = failReason || (order.status === 'Partial' ? 'Partial delivery' : 'Order cancelled');

  let user = null;
  try {
    user = await prisma.user.findUnique({ where: { id: order.userId }, select: { email: true, name: true, notifEmail: true, notifOrders: true } });
  } catch {}

  if (!emailOnly) {
    await prisma.$transaction(async (tx) => {
      const alreadyRefunded = await getTotalRefundedKobo(tx, { orderId: order.orderId, orderDbId: order.id, userId: order.userId });
      const safeRefund = Math.max(0, (amount || order.charge) - alreadyRefunded);
      if (safeRefund <= 0) return;
      const { walletRefund } = computeRefundSplit(order.charge, order.nitroPointsRedeemedKobo, safeRefund);
      if (walletRefund > 0) {
        await tx.$executeRaw`UPDATE users SET balance = balance + ${walletRefund} WHERE id = ${order.userId}`;
        await tx.transaction.create({
          data: {
            userId: order.userId,
            type: 'refund',
            amount: walletRefund,
            method: 'wallet',
            status: 'Completed',
            reference: `REF-${order.orderId}`,
            note: `${reason} – ${order.orderId}${alreadyRefunded > 0 ? ` (₦${(alreadyRefunded / 100).toLocaleString()} prior)` : ''}`,
          },
        });
      }
      await reverseOrderPoints(tx, { orderDbId: order.id, refundAmountKobo: safeRefund });
    });
  }

  if (user?.email && user.notifEmail !== false && user.notifOrders !== false) {
    try {
      const { walletRefund: eWallet, pointsRestore: ePoints } = computeRefundSplit(order.charge, order.nitroPointsRedeemedKobo, refundAmount);
      const wN = eWallet / 100;
      const pN = ePoints / 100;
      const subject = pN > 0
        ? `₦${wN.toLocaleString()} refunded + ${pN.toLocaleString()} points restored`
        : `₦${wN.toLocaleString()} refunded to your Nitro wallet`;
      const html = walletCreditEmail(user.name || 'there', wN, null, {
        kind: 'refund',
        orderRef: `#${order.orderId}`,
        failReason: reason,
        pointsRestored: pN,
      });
      sendEmail(user.email, subject, html).catch(err => log.warn(`Refund email ${order.orderId}`, err.message));
    } catch (emailErr) {
      log.warn(`Refund email ${order.orderId}`, emailErr.message);
    }
  }
}
