import prisma from '@/lib/prisma';
import { log } from '@/lib/logger';
import { checkOrder } from '@/lib/smm';

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

    log.info('Cron orders', `Checked ${stats.checked}, updated ${stats.updated}, refunded ${stats.refunded}, errors ${stats.errors}`);
    return Response.json({ success: true, ...stats });

  } catch (err) {
    log.error('Cron orders', err.message);
    return Response.json({ error: err.message, ...stats }, { status: 500 });
  }
}

async function refundOrder(order, amount = null) {
  const refundAmount = amount || order.charge;
  if (!refundAmount || refundAmount <= 0) return;

  // Get user email for notification
  let userEmail = null;
  try {
    const user = await prisma.user.findUnique({ where: { id: order.userId }, select: { email: true, name: true } });
    userEmail = user?.email;
  } catch {}

  await prisma.$transaction(async (tx) => {
    // Credit user balance
    await tx.$executeRaw`UPDATE users SET balance = balance + ${refundAmount} WHERE id = ${order.userId}`;

    // Create refund transaction
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

  // Send refund email notification
  if (userEmail && process.env.BREVO_API_KEY) {
    try {
      const isPartial = amount && amount !== order.charge;
      const nairaAmount = (refundAmount / 100).toLocaleString();
      await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: { 'api-key': process.env.BREVO_API_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sender: { name: 'Nitro', email: 'noreply@nitro.ng' },
          to: [{ email: userEmail }],
          subject: isPartial ? `Partial Refund — ₦${nairaAmount} returned to your wallet` : `Order Refund — ₦${nairaAmount} returned to your wallet`,
          htmlContent: `
            <div style="font-family:system-ui,sans-serif;max-width:480px;margin:0 auto;padding:24px">
              <div style="text-align:center;margin-bottom:20px">
                <div style="display:inline-block;width:40px;height:40px;border-radius:10px;background:linear-gradient(135deg,#c47d8e,#8b5e6b);color:#fff;font-size:22px;font-weight:700;line-height:40px">N</div>
              </div>
              <h2 style="font-size:18px;font-weight:600;color:#1a1a1a;margin:0 0 8px;text-align:center">${isPartial ? 'Partial Refund Processed' : 'Order Refund Processed'}</h2>
              <p style="font-size:14px;color:#666;text-align:center;margin:0 0 20px">Your wallet has been credited.</p>
              <div style="background:#f8f8f8;border-radius:12px;padding:16px;margin-bottom:20px">
                <div style="display:flex;justify-content:space-between;padding:6px 0;font-size:13px"><span style="color:#888">Order</span><span style="color:#333;font-weight:500">${order.orderId}</span></div>
                <div style="display:flex;justify-content:space-between;padding:6px 0;font-size:13px"><span style="color:#888">Refund amount</span><span style="color:#22c55e;font-weight:600">₦${nairaAmount}</span></div>
                <div style="display:flex;justify-content:space-between;padding:6px 0;font-size:13px"><span style="color:#888">Status</span><span style="color:#333;font-weight:500">${isPartial ? 'Partial delivery' : 'Cancelled'}</span></div>
              </div>
              <p style="font-size:13px;color:#888;text-align:center">The refund has been automatically credited to your Nitro wallet. No action needed.</p>
              <div style="text-align:center;margin-top:20px">
                <a href="https://nitro.ng/dashboard" style="display:inline-block;padding:10px 24px;background:#c47d8e;color:#fff;border-radius:8px;text-decoration:none;font-size:13px;font-weight:500">View Dashboard</a>
              </div>
              <p style="font-size:11px;color:#bbb;text-align:center;margin-top:24px">Nitro — nitro.ng</p>
            </div>
          `,
        }),
      });
    } catch (emailErr) {
      log.warn(`Refund email ${order.orderId}`, emailErr.message);
    }
  }
}
