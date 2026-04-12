import { log } from "@/lib/logger";
import prisma from '@/lib/prisma';
import crypto from 'crypto';

const NP_IPN_SECRET = process.env.NOWPAYMENTS_IPN_SECRET;

function verifySignature(body, signature) {
  if (!NP_IPN_SECRET) return true; // Skip verification if no secret set
  const hmac = crypto.createHmac('sha512', NP_IPN_SECRET);
  // NowPayments sorts keys alphabetically for HMAC
  const sorted = Object.keys(body).sort().reduce((acc, k) => { acc[k] = body[k]; return acc; }, {});
  hmac.update(JSON.stringify(sorted));
  return hmac.digest('hex') === signature;
}

export async function POST(req) {
  try {
    const body = await req.json();
    const signature = req.headers.get('x-nowpayments-sig');

    // Verify signature
    if (NP_IPN_SECRET && !verifySignature(body, signature)) {
      log.warn('NowPayments Webhook', 'Invalid signature');
      return Response.json({ error: 'Invalid signature' }, { status: 403 });
    }

    const { payment_status, order_id, payment_id, pay_amount, actually_paid } = body;

    if (!order_id) {
      return Response.json({ error: 'Missing order_id' }, { status: 400 });
    }

    log.info('NowPayments Webhook', `${order_id} → ${payment_status} (paid: ${actually_paid})`);

    // Payment confirmed
    if (payment_status === 'finished' || payment_status === 'confirmed') {
      // Atomically claim the pending transaction — prevents double credit on webhook retries
      const claimed = await prisma.transaction.updateMany({
        where: { reference: order_id, method: 'crypto', status: 'Pending' },
        data: { status: 'Processing' },
      });

      if (claimed.count === 0) {
        log.info('NowPayments Webhook', `No pending tx for ${order_id} (already claimed or missing)`);
        return Response.json({ ok: true });
      }

      const tx = await prisma.transaction.findFirst({
        where: { reference: order_id, method: 'crypto', status: 'Processing' },
      });

      if (!tx) {
        return Response.json({ ok: true });
      }

      await prisma.$transaction(async (db) => {
        await db.transaction.update({
          where: { id: tx.id },
          data: { status: 'Completed', note: tx.note + ` [paid:${actually_paid || pay_amount}]` },
        });
        await db.user.update({
          where: { id: tx.userId },
          data: { balance: { increment: tx.amount } },
        });
      });
      log.info('NowPayments Webhook', `✓ Credited ${tx.amount / 100} to user ${tx.userId}`);
    }

    // Payment failed or expired
    if (payment_status === 'expired' || payment_status === 'failed' || payment_status === 'refunded') {
      const tx = await prisma.transaction.findFirst({
        where: { reference: order_id, method: 'crypto', status: { in: ['Pending', 'Processing'] } },
      });
      if (tx) {
        await prisma.transaction.update({
          where: { id: tx.id },
          data: { status: 'Canceled' },
        });
      }
      log.info('NowPayments Webhook', `✗ ${payment_status}: ${order_id}`);
    }

    return Response.json({ ok: true });

  } catch (err) {
    log.error('NowPayments Webhook', err.message);
    return Response.json({ ok: true }); // Always 200 so NP doesn't retry forever
  }
}
