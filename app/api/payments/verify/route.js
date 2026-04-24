import prisma from '@/lib/prisma';
import { log } from "@/lib/logger";
import { getCurrentUser } from '@/lib/auth';

async function getGatewayKeys(gatewayId) {
  const setting = await prisma.setting.findUnique({ where: { key: `gateway_${gatewayId}` } });
  if (setting) {
    try { const data = JSON.parse(setting.value); if (data.fields) return data.fields; } catch {}
  }
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

    const gateway = existing.method || 'flutterwave';
    const keys = await getGatewayKeys(gateway);

    if (!keys.secretKey) {
      return Response.json({ error: 'Payment gateway not configured' }, { status: 503 });
    }

    let verified = false;
    let paidAmount = existing.amount; // fallback

    // ═══ FLUTTERWAVE VERIFY ═══
    if (gateway === 'flutterwave') {
      // Flutterwave verifies by tx_ref
      const res = await fetch(`https://api.flutterwave.com/v3/transactions/verify_by_reference?tx_ref=${encodeURIComponent(reference)}`, {
        headers: { 'Authorization': `Bearer ${keys.secretKey}` },
      });
      const data = await res.json();
      if (data.status === 'success' && data.data.status === 'successful') {
        paidAmount = Math.round(data.data.amount * 100); // convert to kobo
        if (paidAmount !== existing.amount) {
          log.warn('Payments Verify', `Amount mismatch: expected ${existing.amount}, got ${paidAmount} (ref: ${reference})`);
          await prisma.transaction.update({ where: { id: existing.id }, data: { status: 'Failed', note: `Amount mismatch: paid ${paidAmount}, expected ${existing.amount}` } });
          return Response.json({ error: 'Amount mismatch' }, { status: 400 });
        }
        verified = true;
      }
    }

    if (!verified) {
      await prisma.transaction.update({
        where: { id: existing.id },
        data: { status: 'Failed', note: `Payment verification failed via ${gateway}` },
      });
      return Response.json({ error: 'Payment not successful' }, { status: 400 });
    }

    // Credit wallet + apply coupon atomically
    const couponMatch = (existing.note || '').match(/\[coupon:([^\]]+)\]/);
    const couponId = couponMatch?.[1];

    const result = await prisma.$transaction(async (tx) => {
      let couponBonus = 0;
      let couponLabel = '';

      if (couponId) {
        // Check inside transaction — prevents race where two requests both pass the check
        const alreadyUsed = await tx.transaction.findFirst({
          where: { userId: session.id, type: 'bonus', note: { contains: `[cid:${couponId}]` } },
        });
        if (!alreadyUsed) {
          const row = await tx.setting.findUnique({ where: { key: 'coupons' } });
          if (row) {
            const coupons = JSON.parse(row.value);
            const coupon = coupons.find(c => c.id === couponId && c.enabled !== false);
            if (coupon) {
              const notExpired = !coupon.expires || new Date(coupon.expires) >= new Date();
              const notMaxed = !coupon.maxUses || coupon.maxUses === 0 || (coupon.used || 0) < coupon.maxUses;
              if (notExpired && notMaxed) {
                couponBonus = coupon.type === 'percent' ? Math.round(paidAmount * (coupon.value / 100)) : coupon.value * 100;
                couponLabel = `Coupon ${coupon.code}: ${coupon.type === 'percent' ? `${coupon.value}%` : `₦${coupon.value}`} bonus [cid:${couponId}]`;
                await tx.setting.update({ where: { key: 'coupons' }, data: { value: JSON.stringify(coupons.map(c => c.id === couponId ? { ...c, used: (c.used || 0) + 1 } : c)) } });
              }
            }
          }
        }
      }

      const totalCredit = paidAmount + couponBonus;
      await tx.user.update({ where: { id: session.id }, data: { balance: { increment: totalCredit } } });
      await tx.transaction.update({ where: { id: existing.id }, data: { status: 'Completed', amount: paidAmount, note: existing.note?.replace(/\[coupon:[^\]]+\]/, '').trim() || undefined } });
      if (couponBonus > 0) {
        await tx.transaction.create({ data: { userId: session.id, type: 'bonus', amount: couponBonus, status: 'Completed', note: couponLabel } });
      }
      return { couponBonus, totalCredit };
    });

    const { couponBonus, totalCredit } = result;

    log.info('Payments Verify', `₦${paidAmount / 100} + ₦${couponBonus / 100} bonus credited (ref: ${reference})`);

    // Check for deferred referral bonus (if ref_min_deposit is set)
    try {
      const user = await prisma.user.findUnique({ where: { id: session.id }, select: { referredBy: true, name: true, signupIp: true } });
      if (user?.referredBy) {
        const markerNote = `[ref-marker:${session.id}]`;
        const alreadyPaid = await prisma.transaction.findFirst({ where: { userId: session.id, type: 'referral', note: { contains: markerNote } } });
        if (!alreadyPaid) {
          const refSettings = await prisma.setting.findMany({ where: { key: { in: ['ref_referrer_bonus', 'ref_invitee_bonus', 'ref_enabled', 'ref_min_deposit'] } } });
          const rs = {};
          refSettings.forEach(s => { rs[s.key] = s.value; });
          const refEnabled = rs.ref_enabled === 'true' || rs.ref_enabled === undefined;
          const refMinDeposit = Number(rs.ref_min_deposit) || 0;
          if (refEnabled && refMinDeposit > 0 && paidAmount >= refMinDeposit) {
            const referrer = await prisma.user.findUnique({ where: { referralCode: user.referredBy } });
            // Self-referral guard
            const sameIp = referrer?.signupIp && user.signupIp
              && referrer.signupIp !== 'unknown' && referrer.signupIp === user.signupIp;
            if (sameIp) { log.warn('Referral', `Self-referral suspected: ${session.id} → ${referrer.id} (same IP ${user.signupIp})`); }
            if (referrer && !sameIp) {
              const referrerBonus = Number(rs.ref_referrer_bonus) || 50000;
              const inviteeBonus = Number(rs.ref_invitee_bonus) || 50000;
              try {
                // Atomic: create invitee marker first — if this fails due to race, the whole $transaction rolls back
                await prisma.$transaction(async (tx) => {
                  // Double-check inside transaction
                  const exists = await tx.transaction.findFirst({ where: { userId: session.id, type: 'referral', note: { contains: markerNote } } });
                  if (exists) return; // another request already paid it
                  await tx.user.update({ where: { id: referrer.id }, data: { balance: { increment: referrerBonus } } });
                  await tx.transaction.create({ data: { userId: referrer.id, type: 'referral', amount: referrerBonus, note: `Referral bonus: ${user.name} deposited` } });
                  if (inviteeBonus > 0) {
                    await tx.user.update({ where: { id: session.id }, data: { balance: { increment: inviteeBonus } } });
                  }
                  // Create marker transaction — the note pattern prevents duplicates on re-check
                  await tx.transaction.create({ data: { userId: session.id, type: 'referral', amount: inviteeBonus, note: `Referral welcome bonus ${markerNote}` } });
                });
                log.info('Referral', `Deferred bonus paid (ref: ${reference})`);
              } catch (txErr) {
                // If the transaction failed, likely another request won the race — that's fine
                log.warn('Referral race', txErr.message);
              }
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
