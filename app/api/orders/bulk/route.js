import prisma from '@/lib/prisma';
import { log } from '@/lib/logger';
import { getCurrentUser } from '@/lib/auth';
import { checkOrder, cancelOrder } from '@/lib/smm';
import { rateLimit, tooManyRequests } from '@/lib/rate-limit';
import { placeWithProvider } from '@/lib/bulk-dispatch';
import { sendEmail, batchPlacementEmail } from '@/lib/email';

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

const NITRO_MINS = { followers: 100, likes: 50, views: 500, comments: 10, engagement: 50, plays: 500, reviews: 10 };

async function dispatchBatch(createdOrders, userId, batchId, totalCharge) {
  let placed = 0;
  let consecutiveFails = 0;
  for (const o of createdOrders) {
    if (consecutiveFails >= 5) break;
    try {
      const apiOrderId = await Promise.race([
        placeWithProvider({ id: o.dbId, service: o.service, tier: o.tier, link: o.link, quantity: o.qty, comments: o.comments }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('dispatch_timeout')), 10000)),
      ]);
      if (apiOrderId) { placed++; consecutiveFails = 0; }
    } catch (err) {
      log.error('Bulk dispatch', `${o.orderId}: ${err.message}`);
      await prisma.order.update({ where: { id: o.dbId }, data: { lastError: err.message.slice(0, 500), retryCount: { increment: 1 } } }).catch(() => {});
      consecutiveFails++;
    }
    await new Promise(r => setTimeout(r, 300));
  }
  // Email
  try {
    const u = await prisma.user.findUnique({ where: { id: userId }, select: { email: true, name: true, notifEmail: true, notifOrders: true } });
    if (u?.email && u.notifEmail !== false && u.notifOrders !== false) {
      const html = batchPlacementEmail(u.name, batchId, createdOrders.length, placed, createdOrders.length - placed, totalCharge / 100);
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
      const cancellable = batchOrders.filter(o => ['Pending', 'Processing', 'In progress'].includes(o.status));
      if (cancellable.length === 0) return Response.json({ error: 'No cancellable orders in batch' }, { status: 400 });

      for (const o of cancellable) {
        if (o.apiOrderId) {
          try { await cancelOrder(o.service?.provider || 'mtp', o.apiOrderId); } catch (e) { log.warn('Bulk cancel', e.message); }
        }
      }

      const result = await prisma.$transaction(async (tx) => {
        // Snapshot what's actually cancellable inside the transaction
        const actualCancellable = await tx.order.findMany({
          where: { batchId, userId: session.id, status: { in: ['Pending', 'Processing', 'In progress'] } },
          select: { id: true, charge: true },
        });
        if (actualCancellable.length === 0) return { cancelled: 0, refunded: 0 };
        await tx.order.updateMany({
          where: { id: { in: actualCancellable.map(o => o.id) } },
          data: { status: 'Cancelled', refundedAt: new Date() },
        });
        const refundAmount = actualCancellable.reduce((s, o) => s + o.charge, 0);
        await tx.$executeRaw`UPDATE users SET balance = balance + ${refundAmount} WHERE id = ${session.id}`;
        await tx.transaction.create({
          data: { userId: session.id, type: 'refund', amount: refundAmount, method: 'wallet', status: 'Completed', reference: `REF-${batchId}`, note: `Bulk cancel ${batchId} — ${actualCancellable.length} orders` },
        });
        return { cancelled: actualCancellable.length, refunded: refundAmount / 100 };
      });

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
            const alreadyRefunded = await prisma.transaction.findFirst({ where: { userId: session.id, type: 'refund', reference: `REF-${order.orderId}` } });
            if (!alreadyRefunded) {
              await prisma.$transaction(async (tx) => {
                const exists = await tx.transaction.findFirst({ where: { userId: session.id, type: 'refund', reference: `REF-${order.orderId}` } });
                if (exists) return;
                await tx.$executeRaw`UPDATE users SET balance = balance + ${order.charge} WHERE id = ${session.id}`;
                await tx.transaction.create({
                  data: { userId: session.id, type: 'refund', amount: order.charge, method: 'wallet', status: 'Completed', reference: `REF-${order.orderId}`, note: `Auto-refund cancelled ${order.orderId}` },
                });
              });
            }
          }

          if (newStatus === 'Partial' && result.remains) {
            const remains = Number(result.remains) || 0;
            if (remains > 0 && order.charge > 0 && order.quantity > 0) {
              const alreadyRefunded = await prisma.transaction.findFirst({ where: { userId: session.id, type: 'refund', reference: `REF-${order.orderId}` } });
              if (!alreadyRefunded) {
                const refundAmount = Math.round((remains / order.quantity) * order.charge);
                if (refundAmount > 0) {
                  await prisma.$transaction(async (tx) => {
                    const exists = await tx.transaction.findFirst({ where: { userId: session.id, type: 'refund', reference: `REF-${order.orderId}` } });
                    if (exists) return;
                    await tx.$executeRaw`UPDATE users SET balance = balance + ${refundAmount} WHERE id = ${session.id}`;
                    await tx.transaction.create({
                      data: { userId: session.id, type: 'refund', amount: refundAmount, method: 'wallet', status: 'Completed', reference: `REF-${order.orderId}`, note: `Partial refund ${order.orderId}` },
                    });
                  });
                }
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
          const apiOrderId = await placeWithProvider({ id: order.id, service: order.service, tier: order.tier, link: order.link, quantity: order.quantity, comments: order.comments });
          retried++;
          if (apiOrderId) { placed++; consecutiveFails = 0; }
        } catch (err) {
          log.error('Bulk reorder', `${order.orderId}: ${err.message}`);
          await prisma.order.update({ where: { id: order.id }, data: { lastError: err.message.slice(0, 500), retryCount: { increment: 1 } } }).catch(() => {});
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
        const charge = Math.round((o.tier.sellPer1k / 1000) * o.quantity);
        const cost = Math.round((o.service.costPer1k * usdRate / 1000) * o.quantity);
        return { original: o, charge: Math.max(1, charge), cost };
      });
      const totalCharge = orderData.reduce((s, d) => s + d.charge, 0);

      const newBatchId = await nextBatchId();

      const result = await prisma.$transaction(async (tx) => {
        const updated = await tx.$executeRaw`UPDATE users SET balance = balance - ${totalCharge} WHERE id = ${session.id} AND balance >= ${totalCharge}`;
        if (updated === 0) {
          const user = await tx.user.findUnique({ where: { id: session.id }, select: { balance: true } });
          const err = new Error('INSUFFICIENT_BALANCE');
          err.needed = Math.max(0, totalCharge - (user?.balance || 0));
          throw err;
        }

        const ids = await nextOrderIds(tx, orderData.length);
        const createdOrders = [];
        for (let i = 0; i < orderData.length; i++) {
          const d = orderData[i];
          const o = d.original;
          const orderId = ids[i];
          const created = await tx.order.create({
            data: { orderId, userId: session.id, serviceId: o.serviceId, tierId: o.tierId, batchId: newBatchId, link: o.link, quantity: o.quantity, charge: d.charge, cost: d.cost, comments: o.comments, status: 'Pending' },
          });
          createdOrders.push({ dbId: created.id, orderId, service: o.service, tier: o.tier, link: o.link, qty: o.quantity, comments: o.comments });
        }

        await tx.transaction.create({
          data: { userId: session.id, type: 'order', amount: -totalCharge, method: 'wallet', status: 'Completed', reference: newBatchId, note: `Reorder from ${batchId} — ${orderData.length} orders` },
        });

        return { createdOrders, totalCharge };
      });

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

      const trimmedLink = row.link.trim();
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

      const clientPrice = row.expectedPrice ? row.expectedPrice * 100 : null;
      if (clientPrice && tier.sellPer1k > clientPrice && (tier.sellPer1k - clientPrice) / clientPrice > 0.05) {
        driftRows.push({ row: i + 1, clientPrice, serverPrice: tier.sellPer1k });
      }

      const charge = Math.round((tier.sellPer1k / 1000) * qty);
      const cost = Math.round((service.costPer1k * usdRate / 1000) * qty);
      if (!charge || charge <= 0) {
        return Response.json({ error: `Row ${i + 1}: service pricing not configured` }, { status: 400 });
      }

      const tierName = `${tier.group.name} (${tier.tier})`;
      const comments = row.comments?.trim().slice(0, 5000) || null;

      resolved.push({ tier, service, link: trimmedLink, qty, charge, cost, tierName, comments });
    }

    if (driftRows.length > 0) {
      return Response.json({ error: 'price_drift', rows: driftRows }, { status: 409 });
    }

    // Atomic transaction: loyalty discount + balance deduction + order creation
    const batchId = await nextBatchId();

    const result = await prisma.$transaction(async (tx) => {
      // Loyalty discount — computed inside transaction for concurrency safety
      let loyaltyPercent = 0;
      let loyaltyTierName = null;
      try {
        const loyaltyEnabledRow = await tx.setting.findUnique({ where: { key: 'loyalty_enabled' } });
        if (loyaltyEnabledRow?.value !== 'false') {
          const ltRow = await tx.setting.findUnique({ where: { key: 'loyalty_tiers' } });
          if (ltRow) {
            const tiers = JSON.parse(ltRow.value);
            const spendAgg = await tx.order.aggregate({ where: { userId: session.id, deletedAt: null }, _sum: { charge: true } });
            const totalSpend = spendAgg._sum.charge || 0;
            let userTier = tiers[0];
            for (const t of tiers) { if (totalSpend >= t.threshold) userTier = t; }
            if (userTier.discount > 0) {
              loyaltyPercent = userTier.discount;
              loyaltyTierName = userTier.name;
            }
          }
        }
      } catch (err) { log.warn('Bulk loyalty discount', err.message); }

      // Apply discount and compute total
      const orderData = resolved.map(r => {
        const discount = loyaltyPercent > 0 ? Math.round(r.charge * (loyaltyPercent / 100)) : 0;
        const finalCharge = Math.max(1, r.charge - discount);
        return { ...r, discount, finalCharge };
      });

      const totalCharge = orderData.reduce((sum, o) => sum + o.finalCharge, 0);

      // Atomic balance deduction
      const updated = await tx.$executeRaw`UPDATE users SET balance = balance - ${totalCharge} WHERE id = ${session.id} AND balance >= ${totalCharge}`;
      if (updated === 0) {
        const user = await tx.user.findUnique({ where: { id: session.id }, select: { balance: true } });
        const deficit = totalCharge - (user?.balance || 0);
        const err = new Error('INSUFFICIENT_BALANCE');
        err.needed = Math.max(0, deficit);
        throw err;
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
            status: 'Pending',
          },
        });
        createdOrders.push({ dbId: order.id, orderId, ...o });
      }

      // Single transaction record for the batch
      await tx.transaction.create({
        data: {
          userId: session.id,
          type: 'order',
          amount: -totalCharge,
          method: 'wallet',
          status: 'Completed',
          reference: batchId,
          note: `Bulk ${batchId} — ${orderData.length} orders${loyaltyPercent > 0 ? ` (${loyaltyTierName} -${loyaltyPercent}%)` : ''}${idempotencyKey ? ` [${idempotencyKey}]` : ''}`,
        },
      });

      return { createdOrders, totalCharge, loyaltyPercent, loyaltyTierName };
    });

    const orderResults = result.createdOrders.map(o => ({ id: o.orderId, link: o.link, status: 'Pending', service: o.tierName }));
    const newBalance = (await prisma.user.findUnique({ where: { id: session.id }, select: { balance: true } }))?.balance || 0;

    const responseBody = {
      success: true,
      batchId,
      total: result.createdOrders.length,
      placed: 0,
      failed: 0,
      totalCharge: result.totalCharge / 100,
      newBalance: newBalance / 100,
      ...(result.loyaltyPercent > 0 ? { loyaltyDiscount: result.loyaltyPercent, loyaltyTier: result.loyaltyTierName } : {}),
      orders: orderResults,
    };

    if (idempotencyKey) {
      await prisma.idempotencyKey.update({
        where: { key: idempotencyKey },
        data: { status: 'completed', batchId, response: responseBody },
      }).catch(e => log.warn('Idempotency update', e.message));
    }

    // Fire-and-forget: dispatch to providers + send email (non-blocking)
    dispatchBatch(result.createdOrders, session.id, batchId, result.totalCharge).catch(e => log.error('Batch dispatch', e.message));

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
