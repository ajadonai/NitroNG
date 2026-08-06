import { log } from "@/lib/logger";
import prisma from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';
import { checkOrder, isProviderConfigured } from '@/lib/smm';
import { tgRefundAlert } from '@/lib/telegram';
import { reverseOrderPoints, computeRefundSplit, getTotalRefundedKobo } from '@/lib/nitro-rewards';
import { lockOrderSettlementAccount, ORDER_SETTLEMENT_ACCOUNT_STATUSES } from '@/lib/account-deletion';

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

    if (order.status === 'Cancelling') {
      return Response.json({ status: 'Cancelling', message: 'Cancellation is being finalized', charge: order.charge / 100 });
    }

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

      const terminal = ['Completed', 'Partial', 'Cancelled', 'Cancelling'].includes(order.status);
      const newStatus = terminal ? order.status : (statusMap[providerStatus.status] || order.status);
      let effectiveStatus = newStatus;

      // Always persist delivery progress from provider (unless terminal)
      const progressData = {
        ...(!terminal && providerStatus.remains != null && { remains: Number(providerStatus.remains) }),
      };
      if (newStatus === order.status && Object.keys(progressData).length > 0) {
        await prisma.order.updateMany({
          where: {
            id: order.id,
            userId: session.id,
            status: order.status,
            apiOrderId: order.apiOrderId,
            deletedAt: null,
            user: { status: { in: ORDER_SETTLEMENT_ACCOUNT_STATUSES }, deletedAt: null, anonymizedAt: null },
          },
          data: progressData,
        });
      }

      // Update if status changed
      if (newStatus !== order.status) {
        if (newStatus === 'Cancelled' && order.protected) {
          return Response.json({ status: order.status, remains: providerStatus.remains, startCount: providerStatus.start_count, charge: order.charge / 100 });
        }
        if (newStatus === 'Cancelled' && order.status !== 'Cancelled' && order.charge > 0) {
          const cancellation = await prisma.$transaction(async (tx) => {
            if (!await lockOrderSettlementAccount(tx, session.id)) return { transitioned: false, refundAmount: 0 };
            const claimed = await tx.order.updateMany({
              where: {
                id: order.id,
                userId: session.id,
                status: order.status,
                apiOrderId: order.apiOrderId,
                deletedAt: null,
              },
              data: { status: 'Cancelled', refundedAt: new Date() },
            });
            if (claimed.count === 0) return { transitioned: false, refundAmount: 0 };
            const alreadyRefunded = await getTotalRefundedKobo(tx, { orderId: order.orderId, orderDbId: order.id, userId: session.id });
            const refundAmount = Math.max(0, order.charge - alreadyRefunded);
            if (refundAmount > 0) {
              const { walletRefund } = computeRefundSplit(order.charge, order.nitroPointsRedeemedKobo, refundAmount);
              if (walletRefund > 0) {
                await tx.$executeRaw`UPDATE users SET balance = balance + ${walletRefund} WHERE id = ${session.id}`;
                await tx.transaction.create({
                  data: {
                    userId: session.id, type: 'refund', amount: walletRefund,
                    method: 'wallet', status: 'Completed',
                    reference: `REF-${order.orderId}`,
                    note: `Refund for cancelled order ${order.orderId}${alreadyRefunded > 0 ? ` (₦${(alreadyRefunded / 100).toLocaleString()} already refunded)` : ''}`,
                  },
                });
              }
              await reverseOrderPoints(tx, { orderDbId: order.id, refundAmountKobo: refundAmount });
            }
            return { transitioned: true, refundAmount };
          });
          if (cancellation.transitioned && cancellation.refundAmount > 0) {
            tgRefundAlert({ orderId: order.orderId, amount: cancellation.refundAmount, charge: order.charge, qty: order.quantity, status: 'Cancelled', reason: 'provider_cancelled', source: 'check' });
          } else if (!cancellation.transitioned) {
            const current = await prisma.order.findUnique({ where: { id: order.id }, select: { status: true } });
            effectiveStatus = current?.status || order.status;
          }
        } else if (newStatus === 'Partial' && providerStatus.remains) {
          const remains = Number(providerStatus.remains) || 0;
          if (remains > 0 && order.charge > 0 && order.quantity > 0) {
            const refundAmount = Math.round((remains / order.quantity) * order.charge / 100) * 100;
            if (refundAmount > 0) {
              const partial = await prisma.$transaction(async (tx) => {
                if (!await lockOrderSettlementAccount(tx, session.id)) return { transitioned: false, refundAmount: 0 };
                const claimed = await tx.order.updateMany({
                  where: {
                    id: order.id,
                    userId: session.id,
                    status: order.status,
                    apiOrderId: order.apiOrderId,
                    deletedAt: null,
                  },
                  data: { status: 'Partial', remains, refundedAt: new Date() },
                });
                if (claimed.count !== 1) return { transitioned: false, refundAmount: 0 };
                const alreadyRefunded = await getTotalRefundedKobo(tx, { orderId: order.orderId, orderDbId: order.id, userId: session.id });
                const cappedRefund = Math.max(0, refundAmount - alreadyRefunded);
                if (cappedRefund <= 0) return { transitioned: true, refundAmount: 0 };
                const { walletRefund } = computeRefundSplit(order.charge, order.nitroPointsRedeemedKobo, cappedRefund);
                if (walletRefund > 0) {
                  await tx.$executeRaw`UPDATE users SET balance = balance + ${walletRefund} WHERE id = ${session.id}`;
                  await tx.transaction.create({
                    data: {
                      userId: session.id, type: 'refund', amount: walletRefund,
                      method: 'wallet', status: 'Completed',
                      reference: `REF-${order.orderId}`,
                      note: `Partial refund for ${order.orderId} (${remains} undelivered)`,
                    },
                  });
                }
                await reverseOrderPoints(tx, { orderDbId: order.id, refundAmountKobo: cappedRefund });
                return { transitioned: true, refundAmount: cappedRefund };
              });
              if (partial.transitioned && partial.refundAmount > 0) {
                tgRefundAlert({ orderId: order.orderId, amount: partial.refundAmount, charge: order.charge, qty: order.quantity, remains, status: 'Partial', reason: 'provider_partial', source: 'check' });
              } else if (!partial.transitioned) {
                const current = await prisma.order.findUnique({ where: { id: order.id }, select: { status: true } });
                effectiveStatus = current?.status || order.status;
              }
            }
          }
        } else {
          const transitioned = await prisma.order.updateMany({
            where: {
              id: order.id,
              userId: session.id,
              status: order.status,
              apiOrderId: order.apiOrderId,
              deletedAt: null,
              user: { status: { in: ORDER_SETTLEMENT_ACCOUNT_STATUSES }, deletedAt: null, anonymizedAt: null },
            },
            data: {
              status: newStatus,
              ...(providerStatus.remains != null && { remains: Number(providerStatus.remains) }),
            },
          });
          if (transitioned.count !== 1) {
            const current = await prisma.order.findUnique({ where: { id: order.id }, select: { status: true } });
            effectiveStatus = current?.status || order.status;
          }
        }
      }

      return Response.json({
        status: effectiveStatus,
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
