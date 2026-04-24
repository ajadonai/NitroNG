import prisma from '@/lib/prisma';
import { log } from '@/lib/logger';
import { checkOrder } from '@/lib/smm';
import { sendEmail, emailWrap, batchCompletionEmail } from '@/lib/email';
import { placeWithProvider } from '@/lib/bulk-dispatch';

// Polls provider APIs for order status updates
// Auto-refunds failed/cancelled orders
// Runs every 10 minutes via Vercel Cron
// GET /api/cron/orders

export async function GET(req) {
  const secret = req.headers.get('authorization')?.replace('Bearer ', '');
  if (secret !== process.env.CRON_SECRET) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const stats = { checked: 0, updated: 0, refunded: 0, errors: 0 };

  try {
    // Get all active orders (Processing or Pending with apiOrderId)
    const activeOrders = await prisma.order.findMany({
      where: {
        status: { in: ['Processing', 'Pending', 'In progress'] },
        apiOrderId: { not: null },
        deletedAt: null,
      },
      include: { service: { select: { provider: true } } },
      take: 200, // batch limit
      orderBy: { createdAt: 'asc' }, // oldest first
    });

    if (activeOrders.length === 0) {
      return Response.json({ success: true, message: 'No active orders to check', ...stats });
    }

    // Group orders by provider for efficient batch checking
    const byProvider = {};
    for (const order of activeOrders) {
      const provider = order.service?.provider || 'mtp';
      if (!byProvider[provider]) byProvider[provider] = [];
      byProvider[provider].push(order);
    }

    for (const [provider, orders] of Object.entries(byProvider)) {
      // Check orders one by one (most providers don't support reliable bulk status)
      for (const order of orders) {
        try {
          stats.checked++;
          const result = await checkOrder(provider, order.apiOrderId);

          // Normalize status from provider
          const providerStatus = (result.status || '').toLowerCase();
          let newStatus = null;

          if (['completed', 'complete'].includes(providerStatus)) {
            newStatus = 'Completed';
          } else if (['partial', 'partially completed'].includes(providerStatus)) {
            newStatus = 'Partial';
          } else if (['cancelled', 'canceled', 'refunded'].includes(providerStatus)) {
            newStatus = 'Cancelled';
          } else if (['in progress', 'inprogress', 'processing'].includes(providerStatus)) {
            newStatus = 'Processing';
          }

          // Skip if no change or unknown status
          if (!newStatus || newStatus === order.status) continue;

          // Update order status
          await prisma.order.update({
            where: { id: order.id },
            data: { status: newStatus },
          });
          stats.updated++;

          // Auto-refund cancelled orders
          if (newStatus === 'Cancelled') {
            await refundOrder(order);
            stats.refunded++;
          }

          // Partial refund for partial orders
          if (newStatus === 'Partial' && result.remains) {
            const remains = Number(result.remains) || 0;
            if (remains > 0 && order.charge > 0 && order.quantity > 0) {
              const refundAmount = Math.round((remains / order.quantity) * order.charge);
              if (refundAmount > 0) {
                await refundOrder(order, refundAmount);
                stats.refunded++;
              }
            }
          }

        } catch (err) {
          stats.errors++;
          log.warn(`Cron order check ${order.orderId}`, err.message);
        }

        // Small delay between API calls to avoid rate limiting
        await new Promise(r => setTimeout(r, 200));
      }
    }

    // Check if any batches just completed (all orders terminal)
    if (stats.updated > 0) {
      try {
        const updatedBatchIds = [...new Set(activeOrders.filter(o => o.batchId).map(o => o.batchId))];
        for (const bid of updatedBatchIds) {
          const remaining = await prisma.order.count({ where: { batchId: bid, status: { notIn: ['Completed', 'Cancelled', 'Partial'] }, deletedAt: null } });
          if (remaining === 0) {
            const batchOrders = await prisma.order.findMany({ where: { batchId: bid, deletedAt: null }, select: { status: true, charge: true, userId: true } });
            const userId = batchOrders[0]?.userId;
            if (userId) {
              const completed = batchOrders.filter(o => o.status === 'Completed').length;
              const partial = batchOrders.filter(o => o.status === 'Partial').length;
              const cancelled = batchOrders.filter(o => o.status === 'Cancelled').length;
              const refunded = batchOrders.filter(o => o.status === 'Cancelled').reduce((s, o) => s + o.charge, 0) / 100;
              const u = await prisma.user.findUnique({ where: { id: userId }, select: { email: true, name: true, notifEmail: true, notifOrders: true } });
              if (u?.email && u.notifEmail !== false && u.notifOrders !== false) {
                const html = batchCompletionEmail(u.name, bid, completed, partial, cancelled, refunded);
                sendEmail(u.email, `Batch ${bid} — all orders complete`, html).catch(e => log.warn('Batch completion email', e.message));
              }
            }
          }
        }
      } catch (e) { log.warn('Batch completion check', e.message); }
    }

    // Retry pending batch orders that failed to dispatch
    stats.retried = 0;
    stats.retryPlaced = 0;
    try {
      const retryable = await prisma.order.findMany({
        where: {
          status: 'Pending', apiOrderId: null, batchId: { not: null },
          retryCount: { lt: 5 },
          createdAt: { gt: new Date(Date.now() - 24 * 60 * 60 * 1000) },
        },
        include: { service: true, tier: { include: { group: true } } },
        take: 50, orderBy: { createdAt: 'asc' },
      });

      for (const order of retryable) {
        const claimed = await prisma.order.updateMany({
          where: { id: order.id, status: 'Pending', apiOrderId: null },
          data: { status: 'Dispatching' },
        });
        if (claimed.count === 0) continue;

        try {
          const apiOrderId = await placeWithProvider({ id: order.id, service: order.service, tier: order.tier, link: order.link, quantity: order.quantity, comments: order.comments });
          stats.retried++;
          if (apiOrderId) {
            stats.retryPlaced++;
          } else {
            await prisma.order.update({ where: { id: order.id }, data: { status: 'Pending', retryCount: { increment: 1 } } });
          }
        } catch (err) {
          await prisma.order.update({ where: { id: order.id }, data: { status: 'Pending', retryCount: { increment: 1 }, lastError: err.message.slice(0, 500) } });
          log.warn(`Cron retry ${order.orderId}`, err.message);
        }
        await new Promise(r => setTimeout(r, 300));
      }
    } catch (e) { log.warn('Cron retry loop', e.message); }

    // Auto-refund permanently failed orders
    stats.autoRefunded = 0;
    try {
      const stale = await prisma.order.findMany({
        where: {
          status: { in: ['Pending', 'Dispatching'] }, apiOrderId: null, deletedAt: null,
          OR: [
            { retryCount: { gte: 5 }, createdAt: { lt: new Date(Date.now() - 6 * 60 * 60 * 1000) } },
            { createdAt: { lt: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
          ],
        },
        take: 100,
      });

      for (const order of stale) {
        try {
          await prisma.$transaction(async (tx) => {
            const claimed = await tx.order.updateMany({
              where: { id: order.id, status: { in: ['Pending', 'Dispatching'] }, apiOrderId: null },
              data: { status: 'Cancelled', refundedAt: new Date() },
            });
            if (claimed.count === 0) return;
            await tx.$executeRaw`UPDATE users SET balance = balance + ${order.charge} WHERE id = ${order.userId}`;
            await tx.transaction.create({
              data: { userId: order.userId, type: 'refund', amount: order.charge, method: 'wallet', status: 'Completed', reference: `REF-${order.orderId}`, note: `Auto-refund: failed to dispatch ${order.orderId}` },
            });
          });
          stats.autoRefunded++;
          if (order.charge >= 5000) await refundOrder(order, null, true);
        } catch (err) {
          log.warn(`Auto-refund ${order.orderId}`, err.message);
        }
      }
    } catch (e) { log.warn('Auto-refund loop', e.message); }

    // Clean up expired idempotency keys
    try {
      const { count } = await prisma.idempotencyKey.deleteMany({ where: { expiresAt: { lt: new Date() } } });
      if (count > 0) stats.expiredKeys = count;
    } catch (e) { log.warn('Idempotency cleanup', e.message); }

    log.info('Cron orders', `Checked ${stats.checked}, updated ${stats.updated}, refunded ${stats.refunded}, retried ${stats.retried}, autoRefunded ${stats.autoRefunded}`);
    return Response.json({ success: true, ...stats });

  } catch (err) {
    log.error('Cron orders', err.message);
    return Response.json({ error: err.message, ...stats }, { status: 500 });
  }
}

async function refundOrder(order, amount = null, emailOnly = false) {
  const refundAmount = amount || order.charge;
  if (!refundAmount || refundAmount <= 0) return;

  let user = null;
  try {
    user = await prisma.user.findUnique({ where: { id: order.userId }, select: { email: true, name: true, notifEmail: true, notifOrders: true } });
  } catch {}

  if (!emailOnly) {
    await prisma.$transaction(async (tx) => {
      const exists = await tx.transaction.findFirst({ where: { userId: order.userId, type: 'refund', reference: `REF-${order.orderId}` } });
      if (exists) return;
      await tx.$executeRaw`UPDATE users SET balance = balance + ${refundAmount} WHERE id = ${order.userId}`;
      await tx.transaction.create({
        data: {
          userId: order.userId,
          type: 'refund',
          amount: refundAmount,
          method: 'wallet',
          status: 'Completed',
          reference: `REF-${order.orderId}`,
          note: amount
            ? `Partial refund for ${order.orderId} (${amount === order.charge ? 'full' : 'partial'})`
            : `Auto-refund for cancelled order ${order.orderId}`,
        },
      });
    });
  }

  // Send refund email notification
  if (user?.email && user.notifEmail !== false && user.notifOrders !== false) {
    try {
      const isPartial = amount && amount !== order.charge;
      const nairaAmount = (refundAmount / 100).toLocaleString();
      const subject = isPartial ? `Partial Refund — ₦${nairaAmount} returned to your wallet` : `Order Refund — ₦${nairaAmount} returned to your wallet`;
      const html = emailWrap({
        label: isPartial ? 'Partial Refund' : 'Refund',
        labelBg: 'rgba(34,197,94,.1)',
        labelColor: '#22c55e',
        title: isPartial ? 'Partial Refund Processed' : 'Order Refund Processed',
        body: `
          <p style="font-size:14px;color:#666;margin:0 0 20px;">Your wallet has been credited.</p>
          <div style="background:#f8f8f8;border-radius:12px;padding:16px;margin-bottom:20px;">
            <div style="display:flex;justify-content:space-between;padding:6px 0;font-size:13px;"><span style="color:#888;">Order</span><span style="color:#333;font-weight:500;">${order.orderId}</span></div>
            <div style="display:flex;justify-content:space-between;padding:6px 0;font-size:13px;"><span style="color:#888;">Refund amount</span><span style="color:#22c55e;font-weight:600;">₦${nairaAmount}</span></div>
            <div style="display:flex;justify-content:space-between;padding:6px 0;font-size:13px;"><span style="color:#888;">Status</span><span style="color:#333;font-weight:500;">${isPartial ? 'Partial delivery' : 'Cancelled'}</span></div>
          </div>
          <p style="font-size:13px;color:#888;margin:0 0 20px;">The refund has been automatically credited to your Nitro wallet. No action needed.</p>
          <div style="text-align:center;">
            <a href="https://nitro.ng/dashboard" style="display:inline-block;padding:10px 24px;background:#c47d8e;color:#fff;border-radius:8px;text-decoration:none;font-size:13px;font-weight:500;">View Dashboard</a>
          </div>`,
      });
      sendEmail(user.email, subject, html).catch(err => log.warn(`Refund email ${order.orderId}`, err.message));
    } catch (emailErr) {
      log.warn(`Refund email ${order.orderId}`, emailErr.message);
    }
  }
}
