import prisma from '@/lib/prisma';
import { log } from "@/lib/logger";
import { getCurrentUser } from '@/lib/auth';
import { placeOrder, checkOrder, cancelOrder } from '@/lib/smm';
import { rateLimit, tooManyRequests } from '@/lib/rate-limit';

export async function GET(req) {
  try {
    const session = await getCurrentUser();
    if (!session) return Response.json({ error: 'Not authenticated' }, { status: 401 });

    const orders = await prisma.order.findMany({
      where: { userId: session.id, deletedAt: null },
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: { service: { select: { name: true, category: true } } },
    });

    return Response.json({
      orders: orders.map(o => ({
        id: o.orderId || o.id,
        internalId: o.id,
        service: o.service?.name || o.serviceId,
        platform: o.service?.category || 'unknown',
        link: o.link,
        quantity: o.quantity,
        charge: o.charge / 100,
        status: o.status,
        apiOrderId: o.apiOrderId,
        created: o.createdAt.toISOString(),
      })),
    });
  } catch (err) {
    log.error('Orders GET', err.message);
    return Response.json({ error: 'Failed to load orders' }, { status: 500 });
  }
}

export async function PATCH(req) {
  try {
    const session = await getCurrentUser();
    if (!session) return Response.json({ error: 'Not authenticated' }, { status: 401 });

    const { action, orderId } = await req.json();
    if (!orderId) return Response.json({ error: 'Order ID required' }, { status: 400 });

    const order = await prisma.order.findFirst({
      where: { OR: [{ orderId }, { id: orderId }], userId: session.id, deletedAt: null },
      include: { service: true, tier: { select: { sellPer1k: true } } },
    });
    if (!order) return Response.json({ error: 'Order not found' }, { status: 404 });

    if (action === 'check') {
      if (order.apiOrderId) {
        try {
          const provider = order.service?.provider || 'mtp';
          const status = await checkOrder(provider, order.apiOrderId);
          const statusMap = { 'Completed': 'Completed', 'In progress': 'Processing', 'Processing': 'Processing', 'Pending': 'Pending', 'Partial': 'Partial', 'Canceled': 'Cancelled', 'Refunded': 'Cancelled' };
          const newStatus = statusMap[status.status] || order.status;
          if (newStatus !== order.status) {
            await prisma.order.update({ where: { id: order.id }, data: { status: newStatus } });
          }
          return Response.json({ success: true, status: newStatus, remains: status.remains, startCount: status.start_count });
        } catch (e) {
          return Response.json({ success: true, status: order.status, message: e.message });
        }
      }
      return Response.json({ success: true, status: order.status });
    }

    if (action === 'cancel') {
      if (order.status === 'Completed' || order.status === 'Cancelled' || order.status === 'Partial') {
        return Response.json({ error: `Cannot cancel ${order.status.toLowerCase()} order` }, { status: 400 });
      }
      if (order.apiOrderId) {
        try { const provider = order.service?.provider || 'mtp'; await cancelOrder(provider, order.apiOrderId); } catch (e) { log.warn('Cancel Order', e.message); }
      }
      // Refund to wallet
      await prisma.$transaction([
        prisma.order.update({ where: { id: order.id }, data: { status: 'Cancelled' } }),
        prisma.user.update({ where: { id: session.id }, data: { balance: { increment: order.charge } } }),
        prisma.transaction.create({
          data: {
            userId: session.id, type: 'refund', amount: order.charge,
            method: 'wallet', status: 'Completed',
            reference: `refund-${order.orderId || order.id}-${Date.now()}`,
            note: `Refund for cancelled order ${order.orderId || order.id}`,
          },
        }),
      ]);
      return Response.json({ success: true, status: 'Cancelled', refunded: order.charge / 100 });
    }

    if (action === 'reorder') {
      // Re-place the same order with same service, link, quantity — but at CURRENT price
      if (!order.service || !order.service.enabled) {
        return Response.json({ error: 'Service no longer available' }, { status: 400 });
      }

      const usdRateSetting = await prisma.setting.findUnique({ where: { key: 'markup_usd_rate' } });
      const usdRate = Number(usdRateSetting?.value || 1600);

      // Recalculate charge from current tier/service price (not the old order's charge)
      const currentSellPer1k = order.tier?.sellPer1k || order.service.sellPer1k;
      let charge = Math.round((currentSellPer1k / 1000) * order.quantity);
      const cost = Math.round((order.service.costPer1k * usdRate / 1000) * order.quantity);

      if (!charge || charge <= 0) {
        return Response.json({ error: 'Service pricing not configured' }, { status: 400 });
      }

      // Apply loyalty discount to reorder
      let reorderLoyaltyDiscount = 0;
      try {
        const loyaltyEnabledRow = await prisma.setting.findUnique({ where: { key: 'loyalty_enabled' } });
        if (loyaltyEnabledRow?.value !== 'false') {
          const ltRow = await prisma.setting.findUnique({ where: { key: 'loyalty_tiers' } });
          if (ltRow) {
            const tiers = JSON.parse(ltRow.value);
            const spendAgg = await prisma.order.aggregate({ where: { userId: session.id, deletedAt: null }, _sum: { charge: true } });
            const totalSpend = spendAgg._sum.charge || 0;
            let userTier = tiers[0];
            for (const t2 of tiers) { if (totalSpend >= t2.threshold) userTier = t2; }
            if (userTier.discount > 0) {
              reorderLoyaltyDiscount = Math.round(charge * (userTier.discount / 100));
              charge = Math.max(1, charge - reorderLoyaltyDiscount); // floor at 1 kobo
            }
          }
        }
      } catch (err) { log.warn('Reorder loyalty discount', err.message); }

      const user = await prisma.user.findUnique({ where: { id: session.id } });
      if (user.balance < charge) {
        return Response.json({ error: 'Insufficient balance' }, { status: 400 });
      }

      const newOrderId = `ORD-${Date.now().toString(36).toUpperCase()}`;

      // Step 1: Deduct balance FIRST
      const newOrder = await prisma.$transaction(async (tx) => {
        const updated = await tx.$executeRaw`UPDATE users SET balance = balance - ${charge} WHERE id = ${session.id} AND balance >= ${charge}`;
        if (updated === 0) throw new Error('INSUFFICIENT_BALANCE');
        const created = await tx.order.create({
          data: {
            orderId: newOrderId, userId: session.id, serviceId: order.serviceId,
            tierId: order.tierId, link: order.link, quantity: order.quantity,
            charge, cost,
            status: 'Pending', apiOrderId: null,
          },
        });
        await tx.transaction.create({
          data: {
            userId: session.id, type: 'order', amount: -charge,
            method: 'wallet', status: 'Completed', reference: newOrderId,
            note: `Reorder ${newOrderId} — ${order.service.name} x${order.quantity.toLocaleString()}`,
          },
        });
        return created;
      });

      // Step 2: Place on provider AFTER balance secured
      let apiOrderId = null;
      if (order.service.apiId) {
        try {
          const provider = order.service.provider || 'mtp';
          const { calculateDripFeed } = await import('@/lib/drip-feed');
          const dripFeed = calculateDripFeed(order.service.category, order.quantity);
          const extra = {};
          if (dripFeed) { extra.runs = dripFeed.runs; extra.interval = dripFeed.interval; }
          const result = await placeOrder(provider, order.service.apiId, order.link, order.quantity, extra);
          apiOrderId = result.order ? String(result.order) : null;
          if (apiOrderId) {
            await prisma.order.update({ where: { id: newOrder.id }, data: { apiOrderId, status: 'Processing' } });
          }
        } catch (err) { log.error('Reorder', err.message); }
      }

      return Response.json({
        success: true,
        order: { id: newOrderId, service: order.service.name, quantity: order.quantity, charge: charge / 100, status: apiOrderId ? 'Processing' : 'Pending' },
      });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (err) {
    if (err.message === 'INSUFFICIENT_BALANCE') {
      return Response.json({ error: 'Insufficient balance' }, { status: 400 });
    }
    log.error('Orders PATCH', err.message);
    return Response.json({ error: 'Action failed' }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const { limited } = rateLimit(req, { maxAttempts: 10, windowMs: 60 * 1000 });
    if (limited) return tooManyRequests('Too many orders. Slow down.');

    const session = await getCurrentUser();
    if (!session) return Response.json({ error: 'Not authenticated' }, { status: 401 });

    const { tierId, serviceId, link, quantity, comments, serviceType } = await req.json();

    // Get USD→NGN rate for cost calculation
    const usdRateSetting = await prisma.setting.findUnique({ where: { key: 'markup_usd_rate' } });
    const usdRate = Number(usdRateSetting?.value || 1600);

    if (!link || !quantity) {
      return Response.json({ error: 'Link and quantity required' }, { status: 400 });
    }
    if (!tierId && !serviceId) {
      return Response.json({ error: 'Service or tier required' }, { status: 400 });
    }

    // Validate link
    const trimmedLink = link.trim();
    if (trimmedLink.length < 5 || trimmedLink.length > 500) {
      return Response.json({ error: 'Invalid link' }, { status: 400 });
    }

    // Must be a URL (http/https) or a username handle (@user)
    const isUrl = /^https?:\/\/.+\..+/.test(trimmedLink);
    const isUsername = /^@?[a-zA-Z0-9._]{1,100}$/.test(trimmedLink);
    if (!isUrl && !isUsername) {
      return Response.json({ error: 'Please enter a valid URL (https://...) or username' }, { status: 400 });
    }

    let service, tier, charge, cost, tierName;

    if (tierId) {
      // New flow: resolve service from tier
      tier = await prisma.serviceTier.findUnique({
        where: { id: tierId },
        include: { service: true, group: true },
      });
      if (!tier || !tier.enabled) {
        return Response.json({ error: 'Service tier not available' }, { status: 400 });
      }
      service = tier.service;
      if (!service || !service.enabled) {
        return Response.json({ error: 'Backing service not available' }, { status: 400 });
      }
      tierName = `${tier.group.name} (${tier.tier})`;
      // Nitro minimum order floors
      const NITRO_MINS = { followers: 100, likes: 50, views: 500, comments: 10, engagement: 50, plays: 500, reviews: 10 };
      const nitroMin = NITRO_MINS[tier.group.type?.toLowerCase()] || 50;
      const effectiveMin = Math.max(service.min, nitroMin);
      const qty = Math.floor(Number(quantity));
      if (!qty || isNaN(qty) || qty <= 0 || !Number.isFinite(qty)) {
        return Response.json({ error: 'Invalid quantity' }, { status: 400 });
      }
      if (qty < effectiveMin || qty > service.max) {
        return Response.json({ error: `Quantity must be between ${effectiveMin.toLocaleString()} and ${service.max.toLocaleString()}` }, { status: 400 });
      }
      charge = Math.round((tier.sellPer1k / 1000) * qty);
      cost = Math.round((service.costPer1k * usdRate / 1000) * qty);
    } else {
      // Legacy flow: direct serviceId
      service = await prisma.service.findUnique({ where: { id: serviceId } });
      if (!service || !service.enabled) {
        return Response.json({ error: 'Service not available' }, { status: 400 });
      }
      const qty = Math.floor(Number(quantity));
      if (!qty || isNaN(qty) || qty <= 0 || !Number.isFinite(qty)) {
        return Response.json({ error: 'Invalid quantity' }, { status: 400 });
      }
      if (qty < service.min || qty > service.max) {
        return Response.json({ error: `Quantity must be between ${service.min.toLocaleString()} and ${service.max.toLocaleString()}` }, { status: 400 });
      }
      charge = Math.round((service.sellPer1k / 1000) * qty);
      cost = Math.round((service.costPer1k * usdRate / 1000) * qty);
      tierName = service.name;
    }

    // Reject zero/negative charges (misconfigured service)
    if (!charge || charge <= 0) {
      return Response.json({ error: 'Service pricing not configured' }, { status: 400 });
    }

    // Apply loyalty discount based on total lifetime spend
    let loyaltyDiscount = 0;
    let loyaltyTierName = null;
    try {
      const loyaltyEnabledRow = await prisma.setting.findUnique({ where: { key: 'loyalty_enabled' } });
      if (loyaltyEnabledRow?.value !== 'false') {
        const ltRow = await prisma.setting.findUnique({ where: { key: 'loyalty_tiers' } });
        if (ltRow) {
          const tiers = JSON.parse(ltRow.value);
          const spendAgg = await prisma.order.aggregate({ where: { userId: session.id, deletedAt: null }, _sum: { charge: true } });
          const totalSpend = spendAgg._sum.charge || 0;
          let userTier = tiers[0];
          for (const t2 of tiers) { if (totalSpend >= t2.threshold) userTier = t2; }
          if (userTier.discount > 0) {
            loyaltyDiscount = Math.round(charge * (userTier.discount / 100));
            loyaltyTierName = userTier.name;
            charge = Math.max(1, charge - loyaltyDiscount); // floor at 1 kobo
          }
        }
      }
    } catch (err) { log.warn('Loyalty discount', err.message); }

    const qty = Math.floor(Number(quantity));

    // Generate order ID
    const orderId = `ORD-${Date.now().toString(36).toUpperCase()}`;

    // Step 1: Atomic balance deduct FIRST — before sending to provider
    const result = await prisma.$transaction(async (tx) => {
      const updated = await tx.$executeRaw`UPDATE users SET balance = balance - ${charge} WHERE id = ${session.id} AND balance >= ${charge}`;
      if (updated === 0) {
        throw new Error('INSUFFICIENT_BALANCE');
      }
      const order = await tx.order.create({
        data: {
          orderId,
          userId: session.id,
          serviceId: service.id,
          tierId: tier ? tier.id : null,
          link: trimmedLink,
          quantity: qty,
          charge,
          cost,
          status: 'Pending',
          apiOrderId: null,
        },
      });
      await tx.transaction.create({
        data: {
          userId: session.id,
          type: 'order',
          amount: -charge,
          method: 'wallet',
          status: 'Completed',
          reference: orderId,
          note: `Order ${orderId} — ${tierName} x${qty.toLocaleString()}${loyaltyDiscount > 0 ? ` (${loyaltyTierName} -₦${(loyaltyDiscount/100).toLocaleString()})` : ''}`,
        },
      });
      return order;
    });

    // Step 2: Place on provider AFTER balance is secured
    let apiOrderId = null;
    if (service.apiId) {
      try {
        const provider = service.provider || 'mtp';
        const sType = (serviceType || tier?.group?.type || "").toLowerCase();
        const sName = (tier?.group?.name || service?.name || "").toLowerCase();
        const extra = {};
        if (comments) {
          const safeComments = comments.trim().slice(0, 5000);
          if (sName.includes("mention")) extra.usernames = safeComments;
          else if (sName.includes("poll") || sName.includes("vote")) extra.answer_number = safeComments;
          else extra.comments = safeComments;
        }
        const { calculateDripFeed } = await import('@/lib/drip-feed');
        const dripFeed = calculateDripFeed(service.category, qty);
        if (dripFeed) {
          extra.runs = dripFeed.runs;
          extra.interval = dripFeed.interval;
        }
        const provResult = await placeOrder(provider, service.apiId, trimmedLink, qty, extra);
        apiOrderId = provResult.order ? String(provResult.order) : null;
        // Update order with provider ID and set to Processing
        if (apiOrderId) {
          await prisma.order.update({ where: { id: result.id }, data: { apiOrderId, status: 'Processing' } });
        }
      } catch (err) {
        log.error('Order Place', err.message);
        // Order stays Pending — can be retried or refunded via admin
      }
    }

    return Response.json({
      success: true,
      order: {
        id: orderId,
        service: tierName,
        quantity: qty,
        charge: charge / 100,
        status: apiOrderId ? 'Processing' : 'Pending',
        ...(loyaltyDiscount > 0 ? { loyaltyDiscount: loyaltyDiscount / 100, loyaltyTier: loyaltyTierName } : {}),
      },
    });
  } catch (err) {
    if (err.message === 'INSUFFICIENT_BALANCE') {
      return Response.json({ error: 'Insufficient balance' }, { status: 400 });
    }
    log.error('Orders POST', err.message);
    return Response.json({ error: 'Failed to place order' }, { status: 500 });
  }
}
