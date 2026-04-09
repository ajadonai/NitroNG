import { log } from "@/lib/logger";
import prisma from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';
import { checkOrder } from '@/lib/mtp';

export async function POST(req) {
  try {
    const session = await getCurrentUser();
    if (!session) return Response.json({ error: 'Not authenticated' }, { status: 401 });

    const { orderId } = await req.json();
    if (!orderId) return Response.json({ error: 'Order ID required' }, { status: 400 });

    const order = await prisma.order.findFirst({
      where: { OR: [{ orderId }, { id: orderId }], userId: session.id },
    });

    if (!order) return Response.json({ error: 'Order not found' }, { status: 404 });

    // If no MTP order ID, can't check externally
    if (!order.apiOrderId) {
      return Response.json({ status: order.status, message: 'Order pending — no external tracking yet' });
    }

    // Check with MTP
    if (!process.env.MTP_API_KEY) {
      return Response.json({ status: order.status, message: 'API not configured' });
    }

    try {
      const mtpStatus = await checkOrder(order.apiOrderId);

      // Map MTP status to our status
      const statusMap = {
        'Completed': 'Completed',
        'In progress': 'Processing',
        'Processing': 'Processing',
        'Pending': 'Pending',
        'Partial': 'Partial',
        'Canceled': 'Canceled',
        'Refunded': 'Canceled',
      };

      const newStatus = statusMap[mtpStatus.status] || order.status;

      // Update if status changed
      if (newStatus !== order.status) {
        await prisma.order.update({
          where: { id: order.id },
          data: { status: newStatus },
        });
      }

      return Response.json({
        status: newStatus,
        remains: mtpStatus.remains,
        startCount: mtpStatus.start_count,
        charge: order.charge / 100,
      });
    } catch (err) {
      log.error('Order Check MTP', err.message);
      return Response.json({ status: order.status, message: 'Could not check status' });
    }
  } catch (err) {
    log.error('Orders Check', err.message);
    return Response.json({ error: 'Status check failed' }, { status: 500 });
  }
}
