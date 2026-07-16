import prisma from '@/lib/prisma';
import { log } from '@/lib/logger';
import { getCurrentUser } from '@/lib/auth';
import { placeOrder, checkOrder } from '@/lib/smm';
import { rateLimit, tooManyRequests } from '@/lib/rate-limit';
import { getActivePromotion, applyPromotionDiscount } from '@/lib/promotions';
import { placeWithProvider } from '@/lib/bulk-dispatch';
import { sendEmail, batchPlacementEmail } from '@/lib/email';
import { getWhatsAppChannelUrl } from '@/lib/settings';
import { cleanLink } from '@/lib/clean-link';
import { calculateIntradayDrip, getDripConfig } from '@/lib/drip-feed';
import { sendEvent, parseFbCookies } from '@/lib/meta-capi';
import { headers as getHeaders } from 'next/headers';
import { tgNewOrder, tgRefundAlert } from '@/lib/telegram';
import { deductBalance, trackBonusConsumption, restoreBonusForRefund } from '@/lib/bonus-credit';
import { getNitroStatus, getEligibleSpendKoboTx, computeNitroDiscount, awardOrderPoints, reverseOrderPoints, computeRefundSplit, getTotalRefundedKobo } from '@/lib/nitro-rewards';
import { isReservedProviderQueryLeaseKey } from '@/lib/provider-query-lease';

async function nextOrderIds(tx, count) {
  const rows = await tx.order.findMany({
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
  return Array.from({ length: count }, (_, i) => `NTR-${max + 1 + i}`);
}

async function nextBatchId() {
  const rows = await prisma.order.findMany({
    where: { batchId: { startsWith: 'BULK-' } },
    select: { batchId: true },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
  let max = 0;
  for (const r of rows) {
    const n = parseInt(r.batchId.replace(/^BULK-/, ''), 10);
    if (!isNaN(n) && n > max) max = n;
  }
  return `BULK-${max + 1}`;
}

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

const NITRO_MINS = { followers: 100, likes: 100, views: 500, comments: 10, engagement: 50, plays: 500, reviews: 10 };

async function dispatchBatch(createdOrders, userId, batchId, totalCharge) {
  let placed = 0;
  let consecutiveFails = 0;
  for (const o of createdOrders) {
    if (consecutiveFails >= 5) break;
    try {
      if (o.hasDrip) {
        const first = await prisma.dripDispatch.findFirst({ where: { orderId: o.dbId, day: 1, batch: 1 } });
        if (!first) continue;
        await prisma.order.update({ where: { id: o.dbId }, data: { status: 'Processing', dispatchedAt: new Date() } }).catch(() => {});
        await prisma.dripDispatch.update({ where: { id: first.id }, data: { status: 'dispatching', dispatchedAt: new Date() } });
        const provider = o.service.provider || 'mtp';
        const extra = {};
        if (o.comments) {
          const at = (o.service.apiType || '').toLowerCase();
          if (at === 'seo') extra.keywords = o.comments;
          else if (at.includes('mention')) extra.usernames = o.comments;
          else if (at === 'poll') extra.answer_number = o.comments;
          else extra.comments = o.comments;
        }
        const result = await Promise.race([
          placeOrder(provider, o.service.apiId, o.link, first.quantity, extra),
          new Promise((_, reject) => setTimeout(() => reject(new Error('dispatch_timeout')), 10000)),
        ]);
        const batchApiId = result.order ? String(result.order) : null;
        if (batchApiId) {
          await prisma.dripDispatch.update({ where: { id: first.id }, data: { apiOrderId: batchApiId, status: 'processing' } });
          await prisma.order.update({ where: { id: o.dbId }, data: { dripDelivered: 1 } }).catch(() => {});
          placed++; consecutiveFails = 0;
        } else {
          await prisma.dripDispatch.update({ where: { id: first.id }, data: { status: 'pending', dispatchedAt: null } }).catch(() => {});
          consecutiveFails++;
        }
      } else {
        await prisma.order.update({ where: { id: o.dbId }, data: { dispatchedAt: new Date() } }).catch(() => {});
        const apiOrderId = await Promise.race([
          placeWithProvider({ id: o.dbId, service: o.service, tier: o.tier, link: o.link, quantity: o.qty, comments: o.comments }),
          new Promise((_, reject) => setTimeout(() => reject(new Error('dispatch_timeout')), 10000)),
        ]);
        if (apiOrderId) { placed++; consecutiveFails = 0; }
        else {
          await prisma.order.update({ where: { id: o.dbId }, data: { lastError: 'dispatch_no_response' } }).catch(() => {});
          consecutiveFails++;
        }
      }
    } catch (err) {
      log.error('Bulk dispatch', `${o.orderId}: ${err.message}`);
      const isTimeout = /timed?\s?out|dispatch_timeout|ETIMEDOUT|ECONNABORTED|ECONNRESET|retries failed/i.test(err.message);
      if (o.hasDrip) {
        await prisma.dripDispatch.updateMany({ where: { orderId: o.dbId, day: 1, batch: 1, status: 'dispatching' }, data: { status: isTimeout ? 'failed' : 'pending', lastError: (isTimeout ? '[TIMEOUT] ' : '') + err.message.slice(0, 500), dispatchedAt: isTimeout ? undefined : null } }).catch(() => {});
      }
      await prisma.order.update({ where: { id: o.dbId }, data: { lastError: (isTimeout ? '[TIMEOUT] ' : '') + err.message.slice(0, 500), retryCount: { increment: 1 }, ...(isTimeout && !o.hasDrip ? { status: 'Dispatching' } : {}) } }).catch(() => {});
      consecutiveFails++;
    }
    await new Promise(r => setTimeout(r, 300));
  }
  // Email
  try {
    const u = await prisma.user.findUnique({ where: { id: userId }, select: { email: true, name: true, notifEmail: true, notifOrders: true } });
    if (u?.email && u.notifEmail !== false && u.notifOrders !== false) {
      const waChannelUrl = await getWhatsAppChannelUrl();
      const html = batchPlacementEmail(u.name, batchId, createdOrders.length, placed, createdOrders.length - placed, totalCharge / 100, { waChannelUrl });
      await sendEmail(u.email, `Bulk Order — ${createdOrders.length} orders placed`, html).catch(e => log.warn('Batch email', e.message));
    }
  } catch {}
}

export async function GET(req) {
  try {
    const session = await getCurrentUser();
    if (!session) return Response.json({ error: 'Not authenticated' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const batchId = searchParams.get('batchId');

    if (batchId) {
      const orders = await prisma.order.findMany({
        where: { batchId, userId: session.id, deletedAt: null },
        include: { service: { select: { name: true, category: true } } },
        orderBy: { createdAt: 'asc' },
      });
      if (orders.length === 0) return Response.json({ error: 'Batch not found' }, { status: 404 });
      return Response.json({
        batchId,
        orders: orders.map(o => ({ id: o.orderId, link: o.link, quantity: o.quantity, charge: o.charge / 100, status: o.status, service: o.service?.name, created: o.createdAt.toISOString() })),
        summary: {
          total: orders.length,
          completed: orders.filter(o => o.status === 'Completed').length,
          processing: orders.filter(o => ['Processing', 'In progress'].includes(o.status)).length,
          pending: orders.filter(o => o.status === 'Pending').length,
          failed: orders.filter(o => ['Cancelled', 'Partial'].includes(o.status)).length,
          totalCharge: orders.reduce((s, o) => s + o.charge, 0) / 100,
        },
      });
    }

    // List all batches for user
    const batchOrders = await prisma.order.findMany({
      where: { userId: session.id, batchId: { not: null }, deletedAt: null },
      select: { batchId: true, status: true, charge: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });

    const batchMap = new Map();
    for (const o of batchOrders) {
      if (!batchMap.has(o.batchId)) batchMap.set(o.batchId, { batchId: o.batchId, createdAt: o.createdAt, total: 0, completed: 0, pending: 0, failed: 0, totalCharge: 0 });
      const b = batchMap.get(o.batchId);
      b.total++;
      b.totalCharge += o.charge;
      if (o.status === 'Completed') b.completed++;
      else if (['Cancelled', 'Partial'].includes(o.status)) b.failed++;
      else b.pending++;
    }

    const batches = [...batchMap.values()].map(b => ({ ...b, totalCharge: b.totalCharge / 100, createdAt: b.createdAt.toISOString() }));
    return Response.json({ batches });
  } catch (err) {
    log.error('Bulk orders GET', err.message);
    return Response.json({ error: 'Failed to load batches' }, { status: 500 });
  }
}

function validateLink(link) {
  const v = link.trim();
  if (v.length < 5 || v.length > 500) return false;
  if (v.includes("://") || /^https?:?$/i.test(v)) return /^https?:\/\/[^\s/]+\.[^\s/]+/.test(v);
  return /^@?[a-zA-Z0-9._]{1,100}$/.test(v);
}

export async function PATCH(req) {
  try {
    const session = await getCurrentUser();
    if (!session) return Response.json({ error: 'Not authenticated' }, { status: 401 });

    const { action, batchId } = await req.json();
    if (!batchId) return Response.json({ error: 'batchId required' }, { status: 400 });

    const batchOrders = await prisma.order.findMany({
      where: { batchId, userId: session.id, deletedAt: null },
      include: { service: { select: { provider: true, apiId: true, name: true, category: true, costPer1k: true } }, tier: { include: { group: true } } },
    });
    if (batchOrders.length === 0) return Response.json({ error: 'Batch not found' }, { status: 404 });

    if (action === 'cancel') {
      const result = await prisma.$transaction(async (tx) => {
        const cancellable = await tx.order.findMany({
          where: { batchId, userId: session.id, status: { in: ['Pending', 'Processing'] }, apiOrderId: null, deletedAt: null },
          select: { id: true, charge: true, orderId: true, nitroPointsRedeemedKobo: true },
        });
        if (cancellable.length === 0) return { cancelled: 0, refunded: 0 };
        await tx.order.updateMany({
          where: { id: { in: cancellable.map(o => o.id) } },
          data: { status: 'Cancelled', lastError: 'user_cancelled', refundedAt: new Date() },
        });
        let totalWalletRefund = 0;
        for (const o of cancellable) {
          await restoreBonusForRefund(tx, o.id);
          await reverseOrderPoints(tx, { orderDbId: o.id, refundAmountKobo: o.charge });
          const walletPart = o.charge - (o.nitroPointsRedeemedKobo || 0);
          if (walletPart > 0) {
            await tx.transaction.create({
              data: { userId: session.id, type: 'refund', amount: walletPart, method: 'wallet', status: 'Completed', reference: `REF-${o.orderId}`, note: `Refund for cancelled order ${o.orderId}` },
            });
            totalWalletRefund += walletPart;
          }
        }
        if (totalWalletRefund > 0) {
          await tx.$executeRaw`UPDATE users SET balance = balance + ${totalWalletRefund} WHERE id = ${session.id}`;
        }
        return { cancelled: cancellable.length, refunded: totalWalletRefund / 100 };
      });
      if (result.cancelled === 0) return Response.json({ error: 'No cancellable orders — all have been sent to providers' }, { status: 400 });
      tgRefundAlert({ orderId: batchId, amount: result.refunded * 100, charge: result.refunded * 100, qty: result.cancelled, status: 'Cancelled', reason: 'user_cancelled (bulk)', source: 'user' });
      return Response.json({ success: true, ...result });
    }

    if (action === 'check') {
      const checkable = batchOrders.filter(o => o.apiOrderId && !['Completed', 'Cancelled'].includes(o.status));
      if (checkable.length === 0) return Response.json({ success: true, updated: 0 });

      let updated = 0;
      for (const order of checkable) {
        try {
          const result = await checkOrder(order.service?.provider || 'mtp', order.apiOrderId);
          const providerStatus = (result.status || '').toLowerCase();
          let newStatus = null;
          if (['completed', 'complete'].includes(providerStatus)) newStatus = 'Completed';
          else if (['partial', 'partially completed'].includes(providerStatus)) newStatus = 'Partial';
          else if (['cancelled', 'canceled', 'refunded'].includes(providerStatus)) newStatus = 'Cancelled';
          else if (['in progress', 'inprogress', 'processing'].includes(providerStatus)) newStatus = 'Processing';

          if (!newStatus || newStatus === order.status) continue;
          await prisma.order.update({ where: { id: order.id }, data: { status: newStatus } });
          updated++;

          if (newStatus === 'Cancelled') {
            await prisma.$transaction(async (tx) => {
              const alreadyRefunded = await getTotalRefundedKobo(tx, { orderId: order.orderId, orderDbId: order.id, userId: session.id });
              const cappedRefund = Math.max(0, order.charge - alreadyRefunded);
              if (cappedRefund <= 0) return;
              const { walletRefund } = computeRefundSplit(order.charge, order.nitroPointsRedeemedKobo, cappedRefund);
              if (walletRefund > 0) {
                await tx.$executeRaw`UPDATE users SET balance = balance + ${walletRefund} WHERE id = ${session.id}`;
                await tx.transaction.create({
                  data: { userId: session.id, type: 'refund', amount: walletRefund, method: 'wallet', status: 'Completed', reference: `REF-${order.orderId}`, note: `Auto-refund cancelled ${order.orderId}` },
                });
              }
              await reverseOrderPoints(tx, { orderDbId: order.id, refundAmountKobo: cappedRefund });
            });
          }

          if (newStatus === 'Partial' && result.remains) {
            const remains = Number(result.remains) || 0;
            if (remains > 0 && order.charge > 0 && order.quantity > 0) {
              const refundAmount = Math.round((remains / order.quantity) * order.charge);
              if (refundAmount > 0) {
                await prisma.$transaction(async (tx) => {
                  const alreadyRefunded = await getTotalRefundedKobo(tx, { orderId: order.orderId, orderDbId: order.id, userId: session.id });
                  const cappedRefund = Math.max(0, refundAmount - alreadyRefunded);
                  if (cappedRefund <= 0) return;
                  const { walletRefund: partialWalletRefund } = computeRefundSplit(order.charge, order.nitroPointsRedeemedKobo, cappedRefund);
                  if (partialWalletRefund > 0) {
                    await tx.$executeRaw`UPDATE users SET balance = balance + ${partialWalletRefund} WHERE id = ${session.id}`;
                    await tx.transaction.create({
                      data: { userId: session.id, type: 'refund', amount: partialWalletRefund, method: 'wallet', status: 'Completed', reference: `REF-${order.orderId}`, note: `Partial refund ${order.orderId}` },
                    });
                  }
                  await reverseOrderPoints(tx, { orderDbId: order.id, refundAmountKobo: cappedRefund });
                });
              }
            }
          }
        } catch (err) {
          log.warn(`Bulk check ${order.orderId}`, err.message);
        }
        await new Promise(r => setTimeout(r, 200));
      }

      return Response.json({ success: true, checked: checkable.length, updated });
    }

    if (action === 'reorder') {
      const retryable = batchOrders.filter(o => o.status === 'Pending' && !o.apiOrderId);
      if (retryable.length === 0) return Response.json({ error: 'No pending orders to retry' }, { status: 400 });

      let retried = 0, placed = 0, consecutiveFails = 0;
      for (const order of retryable) {
        if (consecutiveFails >= 5) break;
        try {
          await prisma.order.update({ where: { id: order.id }, data: { dispatchedAt: new Date() } }).catch(() => {});
          const apiOrderId = await placeWithProvider({ id: order.id, service: order.service, tier: order.tier, link: order.link, quantity: order.quantity, comments: order.comments });
          retried++;
          if (apiOrderId) { placed++; consecutiveFails = 0; }
          else {
            await prisma.order.update({ where: { id: order.id }, data: { lastError: 'dispatch_no_response' } }).catch(() => {});
            consecutiveFails++;
          }
        } catch (err) {
          log.error('Bulk reorder', `${order.orderId}: ${err.message}`);
          const isTimeout = /timed?\s?out|dispatch_timeout|ETIMEDOUT|ECONNABORTED|ECONNRESET|retries failed/i.test(err.message);
          await prisma.order.update({ where: { id: order.id }, data: { lastError: (isTimeout ? '[TIMEOUT] ' : '') + err.message.slice(0, 500), retryCount: { increment: 1 }, ...(isTimeout ? { status: 'Dispatching' } : {}) } }).catch(() => {});
          consecutiveFails++;
        }
        await new Promise(r => setTimeout(r, 300));
      }

      return Response.json({ success: true, retried, placed, failed: retried - placed });
    }

    if (action === 'reorder_completed') {
      const completed = batchOrders.filter(o => o.status === 'Completed');
      if (completed.length === 0) return Response.json({ error: 'No completed orders to reorder' }, { status: 400 });

      const usdRateSetting = await prisma.setting.findUnique({ where: { key: 'markup_usd_rate' } });
      const usdRate = Number(usdRateSetting?.value || 1600);

      const orderData = completed.map(o => {
        const charge = Math.round((Number(o.tier.sellPer1k) / 1000) * o.quantity / 100) * 100;
        const cost = Math.round((Number(o.service.costPer1k) * usdRate / 1000) * o.quantity / 100) * 100;
        return { original: o, charge: Math.max(100, charge), cost };
      });
      const totalCharge = orderData.reduce((s, d) => s + d.charge, 0);

      const newBatchId = await nextBatchId();

      const result = await prisma.$transaction(async (tx) => {
        await deductBalance(tx, session.id, totalCharge);

        const ids = await nextOrderIds(tx, orderData.length);
        const createdOrders = [];
        for (let i = 0; i < orderData.length; i++) {
          const d = orderData[i];
          const o = d.original;
          const orderId = ids[i];
          const created = await tx.order.create({
            data: { orderId, userId: session.id, serviceId: o.serviceId, tierId: o.tierId, batchId: newBatchId, link: o.link, quantity: o.quantity, charge: d.charge, cost: d.cost, comments: o.comments, status: 'Pending' },
          });
          await trackBonusConsumption(tx, session.id, created.id, d.charge);
          createdOrders.push({ dbId: created.id, orderId, service: o.service, tier: o.tier, link: o.link, qty: o.quantity, comments: o.comments });
        }

        await tx.transaction.create({
          data: { userId: session.id, type: 'order', amount: -totalCharge, method: 'wallet', status: 'Completed', reference: newBatchId, note: `Reorder from ${batchId} — ${orderData.length} orders` },
        });

        return { createdOrders, totalCharge };
      });

      for (const o of result.createdOrders) {
        const tierName = o.tier?.group?.name ? `${o.tier.group.name} — ${o.tier.tier}` : o.service?.name || 'Unknown';
        tgNewOrder(o.orderId, tierName, o.qty, o.charge || 0, session.email, o.link, o.service?.category);
      }

      dispatchBatch(result.createdOrders, session.id, newBatchId, result.totalCharge).catch(e => log.error('Reorder dispatch', e.message));

      const newBalance = (await prisma.user.findUnique({ where: { id: session.id }, select: { balance: true } }))?.balance || 0;
      return Response.json({ success: true, placed: completed.length, totalCharge: totalCharge / 100, newBalance: newBalance / 100, newBatchId });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (err) {
    if (err.message === 'INSUFFICIENT_BALANCE') {
      return Response.json({ error: 'Insufficient balance', needed: (err.needed || 0) / 100 }, { status: 400 });
    }
    log.error('Bulk orders PATCH', err.message);
    return Response.json({ error: 'Action failed' }, { status: 500 });
  }
}

export async function POST(req) {
  let idempotencyKey = null;
  try {
    const { limited } = await rateLimit(req, { maxAttempts: 3, windowMs: 60 * 1000 });
    if (limited) return tooManyRequests('Too many bulk orders. Slow down.');

    const session = await getCurrentUser();
    if (!session) return Response.json({ error: 'Not authenticated' }, { status: 401 });

    let orders;
    ({ orders, idempotencyKey } = await req.json());

    // Idempotency guard
    if (idempotencyKey) {
      if (isReservedProviderQueryLeaseKey(idempotencyKey)) {
        return Response.json({ error: 'Invalid idempotency key' }, { status: 400 });
      }
      const existing = await prisma.idempotencyKey.findUnique({ where: { key: idempotencyKey } });
      if (existing) {
        if (existing.userId !== session.id) {
          log.warn('Idempotency key mismatch', `key=${idempotencyKey} owner=${existing.userId} requester=${session.id}`);
          return Response.json({ error: 'Invalid idempotency key' }, { status: 400 });
        }
        if (existing.status === 'completed' && existing.response) {
          return Response.json(existing.response);
        }
        if (existing.status === 'processing') {
          return Response.json({ error: 'still_processing' }, { status: 409 });
        }
        // status === 'failed' → fall through to retry
        await prisma.idempotencyKey.update({ where: { key: idempotencyKey }, data: { status: 'processing' } });
      } else {
        await prisma.idempotencyKey.create({
          data: { key: idempotencyKey, userId: session.id, status: 'processing', expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) },
        });
      }
    }
    if (!Array.isArray(orders) || orders.length < 1 || orders.length > 50) {
      return Response.json({ error: 'Cart must contain 1–50 items' }, { status: 400 });
    }

    const usdRateSetting = await prisma.setting.findUnique({ where: { key: 'markup_usd_rate' } });
    const usdRate = Number(usdRateSetting?.value || 1600);

    // Resolve and validate each row
    const resolved = [];
    const seen = new Set();
    const driftRows = [];

    for (let i = 0; i < orders.length; i++) {
      const row = orders[i];
      if (!row.tierId || !row.link || !row.quantity) {
        return Response.json({ error: `Row ${i + 1}: tier, link, and quantity required` }, { status: 400 });
      }

      const trimmedLink = cleanLink(row.link);
      if (!validateLink(trimmedLink)) {
        return Response.json({ error: `Row ${i + 1}: invalid link` }, { status: 400 });
      }

      const dupKey = `${row.tierId}:${trimmedLink}`;
      if (seen.has(dupKey)) {
        return Response.json({ error: `Row ${i + 1}: duplicate (same link + same tier)` }, { status: 400 });
      }
      seen.add(dupKey);

      const tier = await prisma.serviceTier.findUnique({
        where: { id: row.tierId },
        include: { service: true, group: true },
      });
      if (!tier || !tier.enabled) {
        return Response.json({ error: `Row ${i + 1}: service tier not available` }, { status: 400 });
      }
      const service = tier.service;
      if (!service || !service.enabled) {
        return Response.json({ error: `Row ${i + 1}: backing service not available` }, { status: 400 });
      }

      const nitroMin = NITRO_MINS[tier.group.type?.toLowerCase()] || 50;
      const effectiveMin = Math.max(service.min, nitroMin);
      const qty = Math.floor(Number(row.quantity));
      if (!qty || isNaN(qty) || qty <= 0 || !Number.isFinite(qty)) {
        return Response.json({ error: `Row ${i + 1}: invalid quantity` }, { status: 400 });
      }
      if (qty < effectiveMin || qty > service.max) {
        return Response.json({ error: `Row ${i + 1}: quantity must be between ${effectiveMin.toLocaleString()} and ${service.max.toLocaleString()}` }, { status: 400 });
      }

      const serverPrice = Number(tier.sellPer1k);
      const clientPrice = row.expectedPrice ? row.expectedPrice * 100 : null;
      if (clientPrice && serverPrice > clientPrice && (serverPrice - clientPrice) / clientPrice > 0.05) {
        driftRows.push({
          row: i + 1,
          tierId: tier.id,
          service: tier.group?.name || service.name,
          tier: tier.tier,
          clientPrice,
          serverPrice,
          expectedPrice: clientPrice / 100,
          currentPrice: serverPrice / 100,
        });
      }

      const charge = Math.round((serverPrice / 1000) * qty / 100) * 100;
      const cost = Math.round((Number(service.costPer1k) * usdRate / 1000) * qty / 100) * 100;
      if (!charge || charge <= 0) {
        return Response.json({ error: `Row ${i + 1}: service pricing not configured` }, { status: 400 });
      }

      const tierName = `${tier.group.name} (${tier.tier})`;
      const comments = row.comments?.trim().slice(0, 5000) || null;

      const at = (service.apiType || '').toLowerCase();
      if ((at.includes('custom comment') || at.includes('comment replies') || at.includes('mention') || at === 'poll' || at === 'seo') && !comments) {
        return Response.json({ error: `Row ${i + 1}: this service requires ${at === 'seo' ? 'keywords' : at.includes('mention') ? 'usernames' : at === 'poll' ? 'an answer selection' : 'comments'}` }, { status: 400 });
      }
      if ((at.includes('custom comment') || at.includes('comment replies')) && comments) {
        const lineCount = comments.split('\n').filter(l => l.trim()).length;
        const minLines = Math.max(service.min, 10);
        if (lineCount < minLines) {
          return Response.json({ error: `Row ${i + 1}: please provide at least ${minLines} unique comments (one per line). You entered ${lineCount}.` }, { status: 400 });
        }
      }

      const bulkGroupType = (tier.group?.type || '').toLowerCase();
      const bulkPlatform = (service.category || '').toLowerCase();
      const bulkDripCfg = getDripConfig(bulkGroupType, bulkPlatform);
      const dripSchedule = process.env.NODE_ENV !== 'development' && tier.group?.tags?.includes('drip') && bulkDripCfg && qty >= bulkDripCfg.threshold ? calculateIntradayDrip(qty, service.min || 50, new Date(), bulkGroupType, bulkPlatform) : null;
      resolved.push({ tier, service, link: trimmedLink, qty, charge, cost, tierName, comments, dripSchedule });
    }

    if (driftRows.length > 0) {
      return Response.json({ error: 'price_drift', rows: driftRows }, { status: 409 });
    }

    // Single-item cart → treat as a regular single order (no batch)
    const isSingleOrder = resolved.length === 1;
    const batchId = isSingleOrder ? null : await nextBatchId();

    const result = await prisma.$transaction(async (tx) => {
      // Nitro Status discount — computed inside transaction for concurrency safety
      let nitroTier = null;
      try {
        const spendKobo = await getEligibleSpendKoboTx(tx, session.id);
        nitroTier = getNitroStatus(Math.floor(spendKobo / 100));
      } catch (err) { log.warn('Bulk Nitro Status discount', err.message); }

      // Check for active promotion
      let activePromo = null;
      let promoType = null;
      try { const ap = await getActivePromotion(); if (ap) { activePromo = ap.promotion; promoType = ap.type; } } catch {}

      // Apply Nitro Status + promotion discounts and compute total
      const orderData = resolved.map(r => {
        const discount = computeNitroDiscount(r.charge, nitroTier);
        let afterLoyalty = discount > 0 ? Math.max(100, Math.round((r.charge - discount) / 100) * 100) : r.charge;
        const promoDiscount = activePromo ? applyPromotionDiscount(afterLoyalty, activePromo, activePromo.maxDiscountPerOrder) : 0;
        const finalCharge = Math.max(100, Math.round((afterLoyalty - promoDiscount) / 100) * 100);
        return { ...r, discount, promoDiscount, finalCharge };
      });

      const totalCharge = orderData.reduce((sum, o) => sum + o.finalCharge, 0);

      // Atomic balance deduction
      try {
        await deductBalance(tx, session.id, totalCharge);
      } catch (e) {
        if (e.message === 'INSUFFICIENT_BALANCE') {
          const user = await tx.user.findUnique({ where: { id: session.id }, select: { balance: true } });
          e.needed = Math.max(0, totalCharge - (user?.balance || 0));
        }
        throw e;
      }

      const ids = await nextOrderIds(tx, orderData.length);
      const createdOrders = [];
      for (let i = 0; i < orderData.length; i++) {
        const o = orderData[i];
        const orderId = ids[i];
        const order = await tx.order.create({
          data: {
            orderId,
            userId: session.id,
            serviceId: o.service.id,
            tierId: o.tier.id,
            batchId,
            link: o.link,
            quantity: o.qty,
            charge: o.finalCharge,
            cost: o.cost,
            comments: o.comments,
            loyaltyDiscount: o.discount,
            nitroStatusAtPurchase: nitroTier?.key || null,
            campaignDiscount: o.promoDiscount,
            campaignPercent: activePromo ? activePromo.discountPercent : null,
            platformCampaignId: promoType === 'platform' ? activePromo.id : null,
            recurringCampaignId: promoType === 'recurring' ? activePromo.id : null,
            status: 'Pending',
            ...(o.dripSchedule ? { dripDays: 1 } : {}),
          },
        });
        const bulkBonusUsed = await trackBonusConsumption(tx, session.id, order.id, o.finalCharge);
        if (nitroTier) {
          const bulkEligibleCharge = o.finalCharge - bulkBonusUsed;
          await awardOrderPoints(tx, { userId: session.id, orderId, orderDbId: order.id, chargeKobo: bulkEligibleCharge, tier: nitroTier });
        }
        if (o.dripSchedule) {
          await tx.dripDispatch.createMany({
            data: o.dripSchedule.dispatches.map(d => ({
              orderId: order.id,
              day: 1,
              batch: d.batch,
              quantity: d.quantity,
              scheduledAt: d.scheduledAt,
            })),
          });
        }
        createdOrders.push({ dbId: order.id, orderId, ...o, hasDrip: !!o.dripSchedule });
      }

      const txRef = batchId || ids[0];
      await tx.transaction.create({
        data: {
          userId: session.id,
          type: 'order',
          amount: -totalCharge,
          method: 'wallet',
          status: 'Completed',
          reference: txRef,
          note: isSingleOrder
            ? `Order ${ids[0]} — ${orderData[0].tierName} x${orderData[0].qty.toLocaleString()}${nitroTier && nitroTier.discountPct > 0 ? ` (${nitroTier.name} -${nitroTier.discountPct}%)` : ''}${activePromo ? ` (Promo -${activePromo.discountPercent}%)` : ''}`
            : `Bulk ${batchId} — ${orderData.length} orders${nitroTier && nitroTier.discountPct > 0 ? ` (${nitroTier.name} -${nitroTier.discountPct}%)` : ''}${activePromo ? ` (Promo -${activePromo.discountPercent}%)` : ''}${idempotencyKey ? ` [${idempotencyKey}]` : ''}`,
        },
      });

      return { createdOrders, totalCharge, nitroTier };
    });

    const orderResults = result.createdOrders.map(o => ({ id: o.orderId, link: o.link, status: 'Pending', service: o.tierName }));
    const newBalance = (await prisma.user.findUnique({ where: { id: session.id }, select: { balance: true } }))?.balance || 0;

    // Single-order: dispatch directly before response; batch dispatches fire-and-forget after
    if (isSingleOrder) {
      const o = result.createdOrders[0];
      const isDev = process.env.NODE_ENV === 'development';
      if (isDev) {
        await prisma.order.update({ where: { id: o.dbId }, data: { apiOrderId: `DEV-${Date.now()}`, status: 'Processing' } });
        orderResults[0].status = 'Processing';
      } else if (o.service.apiId) {
        const provider = o.service.provider || 'mtp';
        const extra = {};
        if (o.comments) {
          const at = (o.service.apiType || '').toLowerCase();
          if (at === 'seo') extra.keywords = o.comments;
          else if (at.includes('mention')) extra.usernames = o.comments;
          else if (at === 'poll') extra.answer_number = o.comments;
          else extra.comments = o.comments;
        }
        if (o.hasDrip) {
          await prisma.order.update({ where: { id: o.dbId }, data: { status: 'Processing', dispatchedAt: new Date() } });
          orderResults[0].status = 'Processing';
          const first = await prisma.dripDispatch.findFirst({ where: { orderId: o.dbId, day: 1, batch: 1 } });
          if (first) {
            try {
              await prisma.dripDispatch.update({ where: { id: first.id }, data: { status: 'dispatching', dispatchedAt: new Date() } });
              const provResult = await placeOrder(provider, o.service.apiId, o.link, first.quantity, extra);
              const batchApiId = provResult.order ? String(provResult.order) : null;
              if (batchApiId) {
                await prisma.dripDispatch.update({ where: { id: first.id }, data: { apiOrderId: batchApiId, status: 'processing' } });
                await prisma.order.update({ where: { id: o.dbId }, data: { dripDelivered: 1 } });
              } else {
                await prisma.dripDispatch.update({ where: { id: first.id }, data: { status: 'pending', dispatchedAt: null } });
              }
            } catch (err) {
              log.error('Drip batch 1', err.message);
              const bIsTimeout = /timed?\s?out|dispatch_timeout|ETIMEDOUT|ECONNABORTED|ECONNRESET|retries failed/i.test(err.message);
              await prisma.dripDispatch.update({ where: { id: first.id }, data: { status: bIsTimeout ? 'failed' : 'pending', lastError: (bIsTimeout ? '[TIMEOUT] ' : '') + err.message.slice(0, 450), dispatchedAt: bIsTimeout ? undefined : null } }).catch(() => {});
            }
          }
        } else {
          try {
            await prisma.order.update({ where: { id: o.dbId }, data: { dispatchedAt: new Date() } });
            const provResult = await placeOrder(provider, o.service.apiId, o.link, o.qty, extra);
            const apiOrderId = provResult.order ? String(provResult.order) : null;
            if (apiOrderId) {
              await prisma.order.update({ where: { id: o.dbId }, data: { apiOrderId, status: 'Processing' } });
              orderResults[0].status = 'Processing';
            }
          } catch (err) {
            log.error('Order dispatch', err.message);
            const bIsTimeout2 = /timed?\s?out|dispatch_timeout|ETIMEDOUT|ECONNABORTED|ECONNRESET|retries failed/i.test(err.message);
            await prisma.order.update({ where: { id: o.dbId }, data: { lastError: (bIsTimeout2 ? '[TIMEOUT] ' : '') + err.message.slice(0, 450), ...(bIsTimeout2 ? { status: 'Dispatching' } : {}) } }).catch(() => {});
          }
        }
      }
    }

    const eventId = batchId ? `purchase_${batchId}` : `purchase_${result.createdOrders[0]?.orderId || Date.now()}`;
    const hdrs = await getHeaders();
    const { fbp, fbc } = parseFbCookies(hdrs.get('cookie'));
    sendEvent('Purchase', {
      eventId,
      email: session.email,
      externalId: session.id,
      clientIp: hdrs.get('x-forwarded-for')?.split(',')[0]?.trim() || hdrs.get('x-real-ip'),
      userAgent: hdrs.get('user-agent'),
      fbp, fbc,
      sourceUrl: hdrs.get('referer'),
      customData: { value: result.totalCharge / 100, currency: 'NGN' },
    });

    for (const o of result.createdOrders) {
      tgNewOrder(o.orderId, o.tierName, o.qty, o.finalCharge || o.charge, session.email, o.link, o.service?.category);
    }

    const responseBody = {
      success: true,
      eventId,
      batchId,
      total: result.createdOrders.length,
      placed: isSingleOrder && orderResults[0]?.status === 'Processing' ? 1 : 0,
      failed: 0,
      totalCharge: result.totalCharge / 100,
      newBalance: newBalance / 100,
      ...(result.nitroTier && result.nitroTier.discountPct > 0 ? { loyaltyDiscount: result.nitroTier.discountPct, loyaltyTier: result.nitroTier.name } : {}),
      orders: orderResults,
    };

    if (idempotencyKey) {
      await prisma.idempotencyKey.update({
        where: { key: idempotencyKey },
        data: { status: 'completed', batchId, response: responseBody },
      }).catch(e => log.warn('Idempotency update', e.message));
    }

    if (!isSingleOrder) {
      dispatchBatch(result.createdOrders, session.id, batchId, result.totalCharge).catch(e => log.error('Batch dispatch', e.message));
    }

    return Response.json(responseBody);
  } catch (err) {
    if (idempotencyKey && err.message !== 'INSUFFICIENT_BALANCE') {
      await prisma.idempotencyKey.update({
        where: { key: idempotencyKey },
        data: { status: 'failed' },
      }).catch(() => {});
    }
    if (err.message === 'INSUFFICIENT_BALANCE') {
      return Response.json({ error: 'Insufficient balance', needed: (err.needed || 0) / 100 }, { status: 400 });
    }
    log.error('Bulk orders POST', err.message);
    return Response.json({ error: 'Failed to place bulk order' }, { status: 500 });
  }
}
