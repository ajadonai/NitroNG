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

    // Atomically claim the pending transaction — only one of verify/webhook can win
    const claimed = await prisma.transaction.updateMany({
      where: { reference, userId: session.id, status: 'Pending' },
      data: { status: 'Processing' },
    });

    if (claimed.count === 0) {
      // Check if it was already completed (by webhook)
      const completed = await prisma.transaction.findFirst({
        where: { reference, userId: session.id, status: { in: ['Completed', 'Processing'] } },
      });
      if (completed) {
        return Response.json({ success: true, message: 'Already credited', amount: completed.amount / 100 });
      }
      return Response.json({ error: 'Transaction not found' }, { status: 404 });
    }

    const existing = await prisma.transaction.findFirst({
      where: { reference, userId: session.id, status: 'Processing' },
    });

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
    let couponUpdateData = null; // defer usage increment until after credit succeeds
    const couponMatch = (existing.note || '').match(/\[coupon:([^\]]+)\]/);
    if (couponMatch) {
      try {
        const couponId = couponMatch[1];
        // Check if this user already used this coupon
        const alreadyUsed = await prisma.transaction.findFirst({
          where: { userId: session.id, type: 'bonus', note: { contains: `[cid:${couponId}]` } },
        });
        if (!alreadyUsed) {
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
                couponLabel = `Coupon ${coupon.code}: ${coupon.type === 'percent' ? `${coupon.value}%` : `₦${coupon.value}`} bonus [cid:${couponId}]`;
                // Prepare update but don't execute yet
                couponUpdateData = JSON.stringify(coupons.map(c => c.id === couponId ? { ...c, used: (c.used || 0) + 1 } : c));
              }
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

    // Increment coupon usage AFTER credit succeeds — if credit failed,
    // the coupon use isn't burned
    if (couponUpdateData) {
      try {
        await prisma.setting.update({ where: { key: 'coupons' }, data: { value: couponUpdateData } });
      } catch {}
    }

    console.log(`[${gateway}] ₦${paidAmount / 100} + ₦${couponBonus / 100} bonus credited to user ${session.id} (ref: ${reference})`);

    // Check for deferred referral bonus (if ref_min_deposit is set)
    try {
      const user = await prisma.user.findUnique({ where: { id: session.id }, select: { referredBy: true, name: true } });
      if (user?.referredBy) {
        // Check if referral bonus was already paid
        const alreadyPaid = await prisma.transaction.findFirst({ where: { userId: session.id, type: 'referral' } });
        if (!alreadyPaid) {
          const refSettings = await prisma.setting.findMany({ where: { key: { in: ['ref_referrer_bonus', 'ref_invitee_bonus', 'ref_enabled', 'ref_min_deposit'] } } });
          const rs = {};
          refSettings.forEach(s => { rs[s.key] = s.value; });
          const refEnabled = rs.ref_enabled === 'true' || rs.ref_enabled === undefined;
          const refMinDeposit = Number(rs.ref_min_deposit) || 0;
          if (refEnabled && refMinDeposit > 0 && paidAmount >= refMinDeposit) {
            const referrer = await prisma.user.findUnique({ where: { referralCode: user.referredBy } });
            if (referrer) {
              const referrerBonus = Number(rs.ref_referrer_bonus) || 50000;
              const inviteeBonus = Number(rs.ref_invitee_bonus) || 50000;
              const ops = [
                prisma.user.update({ where: { id: referrer.id }, data: { balance: { increment: referrerBonus } } }),
                prisma.transaction.create({ data: { userId: referrer.id, type: 'referral', amount: referrerBonus, note: `Referral bonus: ${user.name} deposited` } }),
              ];
              if (inviteeBonus > 0) {
                ops.push(
                  prisma.user.update({ where: { id: session.id }, data: { balance: { increment: inviteeBonus } } }),
                  prisma.transaction.create({ data: { userId: session.id, type: 'referral', amount: inviteeBonus, note: 'Referral welcome bonus' } }),
                );
              }
              await prisma.$transaction(ops);
              console.log(`[Referral] Deferred bonus paid: referrer ${referrer.id}, invitee ${session.id}`);
            }
          }
        }
      }
    } catch (err) { log.error('Deferred referral', err.message); }

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
