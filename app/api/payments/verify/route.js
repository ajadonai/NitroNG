import prisma from '@/lib/prisma';
import { log } from "@/lib/logger";
import { getCurrentUser } from '@/lib/auth';

async function getGatewayKeys(gatewayId) {
  const setting = await prisma.setting.findUnique({ where: { key: `gateway_${gatewayId}` } });
  if (setting) {
    try { const data = JSON.parse(setting.value); if (data.fields) return data.fields; } catch {}
  }
  if (gatewayId === 'paystack') return { secretKey: process.env.PAYSTACK_SECRET_KEY || '' };
  if (gatewayId === 'flutterwave') return { secretKey: process.env.FLUTTERWAVE_SECRET_KEY || '' };
  return {};
}

export async function POST(req) {
  try {
    const session = await getCurrentUser();
    if (!session) return Response.json({ error: 'Not authenticated' }, { status: 401 });

    const { reference } = await req.json();
    if (!reference) return Response.json({ error: 'Reference required' }, { status: 400 });

    const existing = await prisma.transaction.findFirst({
      where: { reference, userId: session.id },
    });

    if (!existing) return Response.json({ error: 'Transaction not found' }, { status: 404 });
    if (existing.status === 'Completed') {
      return Response.json({ success: true, message: 'Already credited', amount: existing.amount / 100 });
    }

    const gateway = existing.method || 'paystack';
    const keys = await getGatewayKeys(gateway);

    if (!keys.secretKey) {
      return Response.json({ error: 'Payment gateway not configured' }, { status: 503 });
    }

    let verified = false;
    let paidAmount = existing.amount; // fallback

    // ═══ PAYSTACK VERIFY ═══
    if (gateway === 'paystack') {
      const res = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
        headers: { 'Authorization': `Bearer ${keys.secretKey}` },
      });
      const data = await res.json();
      if (data.status && data.data.status === 'success') {
        verified = true;
        paidAmount = data.data.amount; // kobo
      }
    }

    // ═══ FLUTTERWAVE VERIFY ═══
    if (gateway === 'flutterwave') {
      // Flutterwave verifies by tx_ref
      const res = await fetch(`https://api.flutterwave.com/v3/transactions/verify_by_reference?tx_ref=${encodeURIComponent(reference)}`, {
        headers: { 'Authorization': `Bearer ${keys.secretKey}` },
      });
      const data = await res.json();
      if (data.status === 'success' && data.data.status === 'successful') {
        verified = true;
        paidAmount = Math.round(data.data.amount * 100); // convert to kobo
      }
    }

    if (!verified) {
      await prisma.transaction.update({
        where: { id: existing.id },
        data: { status: 'Failed', note: `Payment verification failed via ${gateway}` },
      });
      return Response.json({ error: 'Payment not successful' }, { status: 400 });
    }

    // Check for coupon bonus
    let couponBonus = 0;
    let couponLabel = '';
    const couponMatch = (existing.note || '').match(/\[coupon:([^\]]+)\]/);
    if (couponMatch) {
      try {
        const couponId = couponMatch[1];
        const row = await prisma.setting.findUnique({ where: { key: 'coupons' } });
        if (row) {
          const coupons = JSON.parse(row.value);
          const coupon = coupons.find(c => c.id === couponId && c.enabled !== false);
          if (coupon) {
            // Check still valid
            const notExpired = !coupon.expires || new Date(coupon.expires) >= new Date();
            const notMaxed = !coupon.maxUses || coupon.maxUses === 0 || (coupon.used || 0) < coupon.maxUses;
            if (notExpired && notMaxed) {
              if (coupon.type === 'percent') {
                couponBonus = Math.round(paidAmount * (coupon.value / 100));
              } else {
                couponBonus = coupon.value * 100; // fixed naira to kobo
              }
              couponLabel = `Coupon ${coupon.code}: ${coupon.type === 'percent' ? `${coupon.value}%` : `₦${coupon.value}`} bonus`;
              // Increment usage
              const updated = coupons.map(c => c.id === couponId ? { ...c, used: (c.used || 0) + 1 } : c);
              await prisma.setting.update({ where: { key: 'coupons' }, data: { value: JSON.stringify(updated) } });
            }
          }
        }
      } catch (err) { log.error('Coupon bonus', err.message); }
    }

    const totalCredit = paidAmount + couponBonus;

    // Credit user wallet + mark complete
    const ops = [
      prisma.user.update({
        where: { id: session.id },
        data: { balance: { increment: totalCredit } },
      }),
      prisma.transaction.update({
        where: { id: existing.id },
        data: { status: 'Completed', amount: paidAmount, note: existing.note?.replace(/\[coupon:[^\]]+\]/, '').trim() || undefined },
      }),
    ];

    // If coupon bonus, create a separate bonus transaction
    if (couponBonus > 0) {
      ops.push(prisma.transaction.create({
        data: { userId: session.id, type: 'bonus', amount: couponBonus, status: 'Completed', note: couponLabel },
      }));
    }

    await prisma.$transaction(ops);

    console.log(`[${gateway}] ₦${paidAmount / 100} + ₦${couponBonus / 100} bonus credited to user ${session.id} (ref: ${reference})`);

    return Response.json({
      success: true,
      message: couponBonus > 0 ? `Payment successful! ₦${couponBonus / 100} bonus applied.` : 'Payment successful',
      amount: paidAmount / 100,
      bonus: couponBonus / 100,
      total: totalCredit / 100,
    });
  } catch (err) {
    log.error('Payments Verify', err.message);
    return Response.json({ error: 'Verification failed' }, { status: 500 });
  }
}
