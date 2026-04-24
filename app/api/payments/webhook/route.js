import prisma from '@/lib/prisma';
import { log } from "@/lib/logger";

export async function POST(req) {
  try {
    const secretKey = process.env.FLUTTERWAVE_SECRET_KEY;
    if (!secretKey) {
      return Response.json({ error: 'Not configured' }, { status: 503 });
    }

    // Verify Flutterwave webhook signature
    const body = await req.text();
    const signature = req.headers.get('verif-hash');
    const hash = process.env.FLUTTERWAVE_WEBHOOK_HASH;

    if (!hash) {
      log.error('Webhook', 'FLUTTERWAVE_WEBHOOK_HASH not set — refusing unsigned webhook');
      return Response.json({ error: 'Webhook not configured' }, { status: 503 });
    }

    if (signature !== hash) {
      log.warn('Webhook', 'Invalid Flutterwave signature');
      return Response.json({ error: 'Invalid signature' }, { status: 401 });
    }

    const event = JSON.parse(body);

    if (event.event === 'charge.completed' && event.data?.status === 'successful') {
      const { tx_ref: reference, amount } = event.data;
      const amountKobo = Math.round(amount * 100);

      // Atomically claim the pending transaction
      const claimed = await prisma.transaction.updateMany({
        where: { reference, status: 'Pending' },
        data: { status: 'Processing' },
      });

      if (claimed.count === 0) {
        log.info('Webhook', `No pending tx for ref: ${reference} (already claimed or missing)`);
        return Response.json({ received: true });
      }

      const tx = await prisma.transaction.findFirst({
        where: { reference, status: 'Processing' },
      });

      if (!tx) {
        return Response.json({ received: true });
      }

      if (amountKobo !== tx.amount) {
        log.warn('Webhook', `Amount mismatch: expected ${tx.amount}, got ${amountKobo} (ref: ${reference})`);
        await prisma.transaction.update({ where: { id: tx.id }, data: { status: 'Failed', note: `Amount mismatch: paid ${amountKobo}, expected ${tx.amount}` } });
        return Response.json({ received: true });
      }

      // Credit wallet + apply coupon atomically
      const couponMatch = (tx.note || '').match(/\[coupon:([^\]]+)\]/);
      const couponId = couponMatch?.[1];

      const couponBonus = await prisma.$transaction(async (db) => {
        let bonus = 0;
        let bonusLabel = '';

        if (couponId) {
          const alreadyUsed = await db.transaction.findFirst({
            where: { userId: tx.userId, type: 'bonus', note: { contains: `[cid:${couponId}]` } },
          });
          if (!alreadyUsed) {
            const row = await db.setting.findUnique({ where: { key: 'coupons' } });
            if (row) {
              const coupons = JSON.parse(row.value);
              const coupon = coupons.find(c => c.id === couponId && c.enabled !== false);
              if (coupon) {
                const notExpired = !coupon.expires || new Date(coupon.expires) >= new Date();
                const notMaxed = !coupon.maxUses || coupon.maxUses === 0 || (coupon.used || 0) < coupon.maxUses;
                if (notExpired && notMaxed) {
                  bonus = coupon.type === 'percent' ? Math.round(amountKobo * (coupon.value / 100)) : coupon.value * 100;
                  bonusLabel = `Coupon ${coupon.code}: bonus [cid:${couponId}]`;
                  await db.setting.update({ where: { key: 'coupons' }, data: { value: JSON.stringify(coupons.map(c => c.id === couponId ? { ...c, used: (c.used || 0) + 1 } : c)) } });
                }
              }
            }
          }
        }

        await db.user.update({ where: { id: tx.userId }, data: { balance: { increment: amountKobo + bonus } } });
        await db.transaction.update({ where: { id: tx.id }, data: { status: 'Completed', amount: amountKobo } });
        if (bonus > 0) {
          await db.transaction.create({ data: { userId: tx.userId, type: 'bonus', amount: bonus, status: 'Completed', note: bonusLabel } });
        }
        return bonus;
      });

      log.info('Webhook', `₦${amountKobo / 100} + ₦${couponBonus / 100} bonus credited (ref: ${reference})`);

      // Deferred referral bonus
      try {
        const user = await prisma.user.findUnique({ where: { id: tx.userId }, select: { referredBy: true, name: true, signupIp: true } });
        if (user?.referredBy) {
          const markerNote = `[ref-marker:${tx.userId}]`;
          const alreadyPaid = await prisma.transaction.findFirst({ where: { userId: tx.userId, type: 'referral', note: { contains: markerNote } } });
          if (!alreadyPaid) {
            const refSettings = await prisma.setting.findMany({ where: { key: { in: ['ref_referrer_bonus', 'ref_invitee_bonus', 'ref_enabled', 'ref_min_deposit'] } } });
            const rs = {};
            refSettings.forEach(s => { rs[s.key] = s.value; });
            const refEnabled = rs.ref_enabled === 'true' || rs.ref_enabled === undefined;
            const refMinDeposit = Number(rs.ref_min_deposit) || 0;
            if (refEnabled && refMinDeposit > 0 && amountKobo >= refMinDeposit) {
              const referrer = await prisma.user.findUnique({ where: { referralCode: user.referredBy } });
              const sameIp = referrer?.signupIp && user.signupIp && referrer.signupIp !== 'unknown' && referrer.signupIp === user.signupIp;
              if (referrer && !sameIp) {
                const referrerBonus = Number(rs.ref_referrer_bonus) || 50000;
                const inviteeBonus = Number(rs.ref_invitee_bonus) || 50000;
                await prisma.$transaction(async (db) => {
                  const exists = await db.transaction.findFirst({ where: { userId: tx.userId, type: 'referral', note: { contains: markerNote } } });
                  if (exists) return;
                  await db.user.update({ where: { id: referrer.id }, data: { balance: { increment: referrerBonus } } });
                  await db.transaction.create({ data: { userId: referrer.id, type: 'referral', amount: referrerBonus, note: `Referral bonus: ${user.name} deposited` } });
                  if (inviteeBonus > 0) {
                    await db.user.update({ where: { id: tx.userId }, data: { balance: { increment: inviteeBonus } } });
                  }
                  await db.transaction.create({ data: { userId: tx.userId, type: 'referral', amount: inviteeBonus, note: `Referral welcome bonus ${markerNote}` } });
                }).catch(e => log.warn('Referral race (webhook)', e.message));
              }
            }
          }
        }
      } catch (err) { log.error('Deferred referral (webhook)', err.message); }
    }

    return Response.json({ received: true });
  } catch (err) {
    log.error('Webhook', err.message);
    return Response.json({ received: true });
  }
}
