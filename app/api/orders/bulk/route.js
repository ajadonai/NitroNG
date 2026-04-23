import prisma from '@/lib/prisma';
import { log } from '@/lib/logger';
import { getCurrentUser } from '@/lib/auth';
import { placeOrder } from '@/lib/smm';
import { rateLimit, tooManyRequests } from '@/lib/rate-limit';

const NITRO_MINS = { followers: 100, likes: 50, views: 500, comments: 10, engagement: 50, plays: 500, reviews: 10 };

function validateLink(link) {
  const v = link.trim();
  if (v.length < 5 || v.length > 500) return false;
  if (v.includes("://") || /^https?:?$/i.test(v)) return /^https?:\/\/[^\s/]+\.[^\s/]+/.test(v);
  return /^@?[a-zA-Z0-9._]{1,100}$/.test(v);
}

export async function POST(req) {
  try {
    const { limited } = rateLimit(req, { maxAttempts: 3, windowMs: 60 * 1000 });
    if (limited) return tooManyRequests('Too many bulk orders. Slow down.');

    const session = await getCurrentUser();
    if (!session) return Response.json({ error: 'Not authenticated' }, { status: 401 });

    const { orders, idempotencyKey } = await req.json();

    // Idempotency: if we've seen this key before, return the previous result
    if (idempotencyKey) {
      const existing = await prisma.transaction.findFirst({
        where: { userId: session.id, reference: { startsWith: 'BULK-' }, note: { contains: idempotencyKey } },
        orderBy: { createdAt: 'desc' },
      });
      if (existing) {
        const prevOrders = await prisma.order.findMany({ where: { batchId: existing.reference } });
        return Response.json({
          success: true, batchId: existing.reference, total: prevOrders.length,
          placed: prevOrders.filter(o => o.apiOrderId).length,
          failed: prevOrders.filter(o => !o.apiOrderId).length,
          totalCharge: Math.abs(existing.amount) / 100,
          orders: prevOrders.map(o => ({ id: o.orderId, link: o.link, status: o.status })),
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

      const charge = Math.round((tier.sellPer1k / 1000) * qty);
      const cost = Math.round((service.costPer1k * usdRate / 1000) * qty);
      if (!charge || charge <= 0) {
        return Response.json({ error: `Row ${i + 1}: service pricing not configured` }, { status: 400 });
      }

      const tierName = `${tier.group.name} (${tier.tier})`;
      const comments = row.comments?.trim().slice(0, 5000) || null;

      resolved.push({ tier, service, link: trimmedLink, qty, charge, cost, tierName, comments });
    }

    // Atomic transaction: loyalty discount + balance deduction + order creation
    const batchId = `BULK-${Date.now().toString(36).toUpperCase()}`;

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

      // Create all orders
      const createdOrders = [];
      for (const o of orderData) {
        const orderId = `ORD-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 5).toUpperCase()}`;
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

    // Provider calls — after transaction commits, with staggering + circuit breaker
    let placed = 0;
    let consecutiveFails = 0;
    const orderResults = [];

    for (const o of result.createdOrders) {
      if (consecutiveFails >= 5) {
        orderResults.push({ id: o.orderId, link: o.link, status: 'Pending', service: o.tierName });
        continue;
      }

      if (o.service.apiId) {
        try {
          const provider = o.service.provider || 'mtp';
          const sName = (o.tier.group?.name || o.service.name || '').toLowerCase();
          const extra = {};
          if (o.comments) {
            if (sName.includes('mention')) extra.usernames = o.comments;
            else if (sName.includes('poll') || sName.includes('vote')) extra.answer_number = o.comments;
            else extra.comments = o.comments;
          }
          const { calculateDripFeed } = await import('@/lib/drip-feed');
          const dripFeed = calculateDripFeed(o.service.category, o.qty);
          if (dripFeed) { extra.runs = dripFeed.runs; extra.interval = dripFeed.interval; }

          const provResult = await placeOrder(provider, o.service.apiId, o.link, o.qty, extra);
          const apiOrderId = provResult.order ? String(provResult.order) : null;
          if (apiOrderId) {
            await prisma.order.update({ where: { id: o.dbId }, data: { apiOrderId, status: 'Processing' } });
            placed++;
            consecutiveFails = 0;
            orderResults.push({ id: o.orderId, link: o.link, status: 'Processing', service: o.tierName });
          } else {
            consecutiveFails++;
            orderResults.push({ id: o.orderId, link: o.link, status: 'Pending', service: o.tierName });
          }
        } catch (err) {
          log.error('Bulk order place', `${o.orderId}: ${err.message}`);
          consecutiveFails++;
          orderResults.push({ id: o.orderId, link: o.link, status: 'Pending', service: o.tierName });
        }
      } else {
        orderResults.push({ id: o.orderId, link: o.link, status: 'Pending', service: o.tierName });
      }

      // Stagger provider calls
      if (o !== result.createdOrders[result.createdOrders.length - 1]) {
        await new Promise(r => setTimeout(r, 500));
      }
    }

    return Response.json({
      success: true,
      batchId,
      total: result.createdOrders.length,
      placed,
      failed: result.createdOrders.length - placed,
      totalCharge: result.totalCharge / 100,
      ...(result.loyaltyPercent > 0 ? { loyaltyDiscount: result.loyaltyPercent, loyaltyTier: result.loyaltyTierName } : {}),
      orders: orderResults,
    });
  } catch (err) {
    if (err.message === 'INSUFFICIENT_BALANCE') {
      return Response.json({ error: 'Insufficient balance', needed: (err.needed || 0) / 100 }, { status: 400 });
    }
    log.error('Bulk orders POST', err.message);
    return Response.json({ error: 'Failed to place bulk order' }, { status: 500 });
  }
}
