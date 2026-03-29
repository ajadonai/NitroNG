import prisma from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';
import { placeOrder } from '@/lib/mtp';

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
