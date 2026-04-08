import prisma from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';
import { placeOrder, checkOrder, cancelOrder } from '@/lib/mtp';

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
    console.error('[Orders GET]', err.message);
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
      include: { service: true },
    });
    if (!order) return Response.json({ error: 'Order not found' }, { status: 404 });

    if (action === 'check') {
      if (order.apiOrderId && process.env.MTP_API_KEY) {
        try {
          const status = await checkOrder(order.apiOrderId);
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
      if (order.status === 'Completed' || order.status === 'Cancelled' || order.status === 'Canceled' || order.status === 'Partial') {
        return Response.json({ error: `Cannot cancel ${order.status.toLowerCase()} order` }, { status: 400 });
      }
      if (order.apiOrderId && process.env.MTP_API_KEY) {
        try { await cancelOrder(order.apiOrderId); } catch (e) { console.warn('[User Cancel MTP]', e.message); }
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
      // Re-place the same order with same service, link, quantity
      if (!order.service || !order.service.enabled) {
        return Response.json({ error: 'Service no longer available' }, { status: 400 });
      }
      const user = await prisma.user.findUnique({ where: { id: session.id } });
      if (user.balance < order.charge) {
        return Response.json({ error: 'Insufficient balance' }, { status: 400 });
      }

      const newOrderId = `ORD-${Date.now().toString(36).toUpperCase()}`;
      let apiOrderId = null;
      if (order.service.apiId && process.env.MTP_API_KEY) {
        try {
          const mtpResult = await placeOrder(order.service.apiId, order.link, order.quantity);
          apiOrderId = mtpResult.order ? String(mtpResult.order) : null;
        } catch (err) { console.error('[Reorder MTP]', err.message); }
      }

      const [newOrder] = await prisma.$transaction([
        prisma.order.create({
          data: {
            orderId: newOrderId, userId: session.id, serviceId: order.serviceId,
            tierId: order.tierId, link: order.link, quantity: order.quantity,
            charge: order.charge, cost: order.cost,
            status: apiOrderId ? 'Processing' : 'Pending', apiOrderId,
          },
        }),
        prisma.user.update({ where: { id: session.id }, data: { balance: { decrement: order.charge } } }),
        prisma.transaction.create({
          data: {
            userId: session.id, type: 'order', amount: -order.charge,
            method: 'wallet', status: 'Completed', reference: newOrderId,
            note: `Reorder ${newOrderId} — ${order.service.name} x${order.quantity.toLocaleString()}`,
          },
        }),
      ]);

      return Response.json({
        success: true,
        order: { id: newOrderId, service: order.service.name, quantity: order.quantity, charge: order.charge / 100, status: newOrder.status },
      });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (err) {
    console.error('[Orders PATCH]', err.message);
    return Response.json({ error: 'Action failed' }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const session = await getCurrentUser();
    if (!session) return Response.json({ error: 'Not authenticated' }, { status: 401 });

    const { tierId, serviceId, link, quantity } = await req.json();

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
      const qty = Number(quantity);
      if (qty < service.min || qty > service.max) {
        return Response.json({ error: `Quantity must be between ${service.min.toLocaleString()} and ${service.max.toLocaleString()}` }, { status: 400 });
      }
      charge = Math.round((tier.sellPer1k / 1000) * qty);
      cost = Math.round((service.costPer1k / 1000) * qty);
    } else {
      // Legacy flow: direct serviceId
      service = await prisma.service.findUnique({ where: { id: serviceId } });
      if (!service || !service.enabled) {
        return Response.json({ error: 'Service not available' }, { status: 400 });
      }
      const qty = Number(quantity);
      if (qty < service.min || qty > service.max) {
        return Response.json({ error: `Quantity must be between ${service.min.toLocaleString()} and ${service.max.toLocaleString()}` }, { status: 400 });
      }
      charge = Math.round((service.sellPer1k / 1000) * qty);
      cost = Math.round((service.costPer1k / 1000) * qty);
      tierName = service.name;
    }

    const qty = Number(quantity);

    // Check balance
    const user = await prisma.user.findUnique({ where: { id: session.id } });
    if (!user) return Response.json({ error: 'User not found' }, { status: 404 });
    if (user.balance < charge) {
      return Response.json({ error: 'Insufficient balance' }, { status: 400 });
    }

    // Generate order ID
    const orderId = `ORD-${Date.now().toString(36).toUpperCase()}`;

    // Place order on MTP (if apiId exists)
    let apiOrderId = null;
    if (service.apiId && process.env.MTP_API_KEY) {
      try {
        const mtpResult = await placeOrder(service.apiId, trimmedLink, qty);
        apiOrderId = mtpResult.order ? String(mtpResult.order) : null;
      } catch (err) {
        console.error('[Order MTP]', err.message);
      }
    }

    // Deduct balance + create order + create transaction in one atomic operation
    const [order] = await prisma.$transaction([
      prisma.order.create({
        data: {
          orderId,
          userId: user.id,
          serviceId: service.id,
          tierId: tier ? tier.id : null,
          link: trimmedLink,
          quantity: qty,
          charge,
          cost,
          status: apiOrderId ? 'Processing' : 'Pending',
          apiOrderId,
        },
      }),
      prisma.user.update({
        where: { id: user.id },
        data: { balance: { decrement: charge } },
      }),
      prisma.transaction.create({
        data: {
          userId: user.id,
          type: 'order',
          amount: -charge,
          method: 'wallet',
          status: 'Completed',
          reference: orderId,
          note: `Order ${orderId} — ${tierName} x${qty.toLocaleString()}`,
        },
      }),
    ]);

    return Response.json({
      success: true,
      order: {
        id: orderId,
        service: tierName,
        quantity: qty,
        charge: charge / 100,
        status: order.status,
      },
    });
  } catch (err) {
    console.error('[Orders POST]', err.message);
    return Response.json({ error: 'Failed to place order' }, { status: 500 });
  }
}
