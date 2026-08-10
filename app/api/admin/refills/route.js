import prisma from '@/lib/prisma';
import { log } from "@/lib/logger";
import { requireAdmin } from '@/lib/admin';

export async function GET() {
  const { error } = await requireAdmin('orders');
  if (error) return error;

  try {
    const orders = await prisma.order.findMany({
      where: { refillRequestedAt: { not: null }, deletedAt: null },
      orderBy: { refillRequestedAt: 'desc' },
      include: {
        user: { select: { name: true, email: true } },
        service: { select: { name: true, category: true } },
      },
    });

    return Response.json({
      refills: orders.map(o => ({
        id: o.id,
        orderId: o.orderId,
        userName: o.user?.name || 'Unknown',
        userEmail: o.user?.email || '',
        serviceName: o.service?.name || 'Unknown',
        serviceCategory: o.service?.category || 'unknown',
        status: o.status,
        quantity: o.quantity,
        link: o.link,
        refillRequestedAt: o.refillRequestedAt?.toISOString() || null,
        createdAt: o.createdAt.toISOString(),
        apiOrderId: o.apiOrderId || null,
      })),
    });
  } catch (err) {
    log.error('Admin Refills', err.message);
    return Response.json({ error: 'Failed to load refills' }, { status: 500 });
  }
}
