import { log } from "@/lib/logger";
import prisma from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';
import { checkOrder, isProviderConfigured } from '@/lib/smm';

export async function POST(req) {
  try {
    const session = await getCurrentUser();
    if (!session) return Response.json({ error: 'Not authenticated' }, { status: 401 });

    const { orderId } = await req.json();
    if (!orderId) return Response.json({ error: 'Order ID required' }, { status: 400 });

    const order = await prisma.order.findFirst({
      where: { OR: [{ orderId }, { id: orderId }], userId: session.id },
      include: { service: { select: { provider: true } } },
    });

    if (!order) return Response.json({ error: 'Order not found' }, { status: 404 });

    // If no external order ID, can't check with provider
    if (!order.apiOrderId) {
      return Response.json({ status: order.status, message: 'Order pending — no external tracking yet' });
    }

    // Determine provider from the backing service
    const provider = order.service?.provider || 'mtp';

    if (!isProviderConfigured(provider)) {
      return Response.json({ status: order.status, message: `${provider.toUpperCase()} API not configured` });
    }

    try {
      const providerStatus = await checkOrder(provider, order.apiOrderId);

      // Map provider status to our status (all 3 providers use the same status strings)
      const statusMap = {
        'Completed': 'Completed',
        'In progress': 'Processing',
        'Processing': 'Processing',
        'Pending': 'Pending',
        'Partial': 'Partial',
        'Canceled': 'Cancelled',
        'Refunded': 'Cancelled',
      };

      const newStatus = statusMap[providerStatus.status] || order.status;

      // Update if status changed
      if (newStatus !== order.status) {
        await prisma.order.update({
          where: { id: order.id },
          data: { status: newStatus },
        });
      }

      return Response.json({
        status: newStatus,
        remains: providerStatus.remains,
        startCount: providerStatus.start_count,
        charge: order.charge / 100,
      });
    } catch (err) {
      log.error(`Order Check ${provider.toUpperCase()}`, err.message);
      return Response.json({ status: order.status, message: 'Could not check status' });
    }
  } catch (err) {
    log.error('Orders Check', err.message);
    return Response.json({ error: 'Status check failed' }, { status: 500 });
  }
}
