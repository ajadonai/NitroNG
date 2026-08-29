import prisma from '@/lib/prisma';
import { log } from "@/lib/logger";
import { requireAdmin } from '@/lib/admin';
import { getOrderOfferDisplay } from '@/lib/order-offer-display';

export async function GET() {
  const { error } = await requireAdmin('orders');
  if (error) return error;

  try {
    const orders = await prisma.order.findMany({
      // Pending means asked for and not yet sent by an admin.
      where: { refillRequestedAt: { not: null }, refillHandledAt: null, deletedAt: null },
      orderBy: { refillRequestedAt: 'desc' },
      include: {
        user: { select: { name: true, email: true } },
        service: { select: { name: true, category: true } },
        // getOrderOfferDisplay prefers the at-purchase snapshot, then the public
        // group name, and only falls back to the raw provider string.
        tier: { select: { tier: true, group: { select: { name: true, platform: true } } } },
      },
    });

    return Response.json({
      refills: orders.map(o => {
        const display = getOrderOfferDisplay(o);
        return {
        id: o.id,
        orderId: o.orderId,
        userName: o.user?.name || 'Unknown',
        userEmail: o.user?.email || '',
        // Was o.service.name — the provider's raw internal string, which is what
        // customers were being shown on this page.
        serviceName: display.serviceName,
        tierLabel: display.tierLabel || null,
        serviceCategory: display.platform || o.service?.category || 'unknown',
        status: o.status,
        quantity: o.quantity,
        link: o.link,
        refillRequestedAt: o.refillRequestedAt?.toISOString() || null,
        createdAt: o.createdAt.toISOString(),
        apiOrderId: o.apiOrderId || null,
        };
      }),
    });
  } catch (err) {
    log.error('Admin Refills', err.message);
    return Response.json({ error: 'Failed to load refills' }, { status: 500 });
  }
}
