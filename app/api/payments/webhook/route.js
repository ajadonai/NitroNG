import prisma from '@/lib/prisma';
import { log } from "@/lib/logger";
import crypto from 'crypto';

const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET_KEY;

export async function POST(req) {
  try {
    if (!PAYSTACK_SECRET) {
      return Response.json({ error: 'Not configured' }, { status: 503 });
    }

    // Verify webhook signature
    const body = await req.text();
    const signature = req.headers.get('x-paystack-signature');
    const hash = crypto.createHmac('sha512', PAYSTACK_SECRET).update(body).digest('hex');

    if (hash !== signature) {
      console.warn('[Webhook] Invalid signature');
      return Response.json({ error: 'Invalid signature' }, { status: 401 });
    }

    const event = JSON.parse(body);

    if (event.event === 'charge.success') {
      const { reference, amount, customer } = event.data;

      // Find pending transaction
      const tx = await prisma.transaction.findFirst({
        where: { reference, status: 'Pending' },
      });

      if (!tx) {
        console.log(`[Webhook] No pending tx for ref: ${reference}`);
        return Response.json({ received: true });
      }

      // Credit user wallet + mark complete
      await prisma.$transaction([
        prisma.user.update({
          where: { id: tx.userId },
          data: { balance: { increment: amount } },
        }),
        prisma.transaction.update({
          where: { id: tx.id },
          data: { status: 'Completed', amount },
        }),
      ]);

      console.log(`[Webhook] ₦${amount / 100} credited to user ${tx.userId} (ref: ${reference})`);
    }

    return Response.json({ received: true });
  } catch (err) {
    log.error('Webhook', err.message);
    return Response.json({ received: true }); // Always 200 for webhooks
  }
}
