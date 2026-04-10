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

      // Check for coupon bonus
      let couponBonus = 0;
      const couponMatch = (tx.note || '').match(/\[coupon:([^\]]+)\]/);
      if (couponMatch) {
        try {
          const couponId = couponMatch[1];
          const row = await prisma.setting.findUnique({ where: { key: 'coupons' } });
          if (row) {
            const coupons = JSON.parse(row.value);
            const coupon = coupons.find(c => c.id === couponId && c.enabled !== false);
            if (coupon) {
              const notExpired = !coupon.expires || new Date(coupon.expires) >= new Date();
              const notMaxed = !coupon.maxUses || coupon.maxUses === 0 || (coupon.used || 0) < coupon.maxUses;
              if (notExpired && notMaxed) {
                couponBonus = coupon.type === 'percent' ? Math.round(amount * (coupon.value / 100)) : coupon.value * 100;
                const updated = coupons.map(c => c.id === couponId ? { ...c, used: (c.used || 0) + 1 } : c);
                await prisma.setting.update({ where: { key: 'coupons' }, data: { value: JSON.stringify(updated) } });
              }
            }
          }
        } catch {}
      }

      const totalCredit = amount + couponBonus;

      // Credit user wallet + mark complete
      const ops = [
        prisma.user.update({
          where: { id: tx.userId },
          data: { balance: { increment: totalCredit } },
        }),
        prisma.transaction.update({
          where: { id: tx.id },
          data: { status: 'Completed', amount },
        }),
      ];
      if (couponBonus > 0) {
        ops.push(prisma.transaction.create({
          data: { userId: tx.userId, type: 'bonus', amount: couponBonus, status: 'Completed', note: `Coupon bonus on deposit ₦${amount / 100}` },
        }));
      }
      await prisma.$transaction(ops);

      console.log(`[Webhook] ₦${amount / 100} + ₦${couponBonus / 100} bonus credited to user ${tx.userId} (ref: ${reference})`);
    }

    return Response.json({ received: true });
  } catch (err) {
    log.error('Webhook', err.message);
    return Response.json({ received: true }); // Always 200 for webhooks
  }
}
