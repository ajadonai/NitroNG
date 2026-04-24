import { log } from "@/lib/logger";
import prisma from '@/lib/prisma';
import crypto from 'crypto';

const NP_IPN_SECRET = process.env.NOWPAYMENTS_IPN_SECRET;

function verifySignature(body, signature) {
  const hmac = crypto.createHmac('sha512', NP_IPN_SECRET);
  // NowPayments sorts keys alphabetically for HMAC
  const sorted = Object.keys(body).sort().reduce((acc, k) => { acc[k] = body[k]; return acc; }, {});
  hmac.update(JSON.stringify(sorted));
  return hmac.digest('hex') === signature;
}

export async function POST(req) {
  try {
    if (!NP_IPN_SECRET) {
      log.error('NowPayments Webhook', 'NOWPAYMENTS_IPN_SECRET not set — refusing unsigned webhook');
      return Response.json({ error: 'Webhook not configured' }, { status: 503 });
    }

    const body = await req.json();
    const signature = req.headers.get('x-nowpayments-sig');

    if (!verifySignature(body, signature)) {
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

      // Credit wallet + apply coupon atomically
      const couponMatch = (tx.note || '').match(/\[coupon:([^\]]+)\]/);
      const couponId = couponMatch?.[1];

      const couponBonus = await prisma.$transaction(async (db) => {
        let bonus = 0;
        if (couponId) {
          const alreadyUsed = await db.transaction.findFirst({ where: { userId: tx.userId, type: 'bonus', note: { contains: `[cid:${couponId}]` } } });
          if (!alreadyUsed) {
            const row = await db.setting.findUnique({ where: { key: 'coupons' } });
            if (row) {
              const coupons = JSON.parse(row.value);
              const coupon = coupons.find(c => c.id === couponId && c.enabled !== false);
              if (coupon) {
                const notExpired = !coupon.expires || new Date(coupon.expires) >= new Date();
                const notMaxed = !coupon.maxUses || coupon.maxUses === 0 || (coupon.used || 0) < coupon.maxUses;
                if (notExpired && notMaxed) {
                  bonus = coupon.type === 'percent' ? Math.round(tx.amount * (coupon.value / 100)) : coupon.value * 100;
                  await db.setting.update({ where: { key: 'coupons' }, data: { value: JSON.stringify(coupons.map(c => c.id === couponId ? { ...c, used: (c.used || 0) + 1 } : c)) } });
                }
              }
            }
          }
        }
        await db.transaction.update({ where: { id: tx.id }, data: { status: 'Completed', note: tx.note + ` [paid:${actually_paid || pay_amount}]` } });
        await db.user.update({ where: { id: tx.userId }, data: { balance: { increment: tx.amount + bonus } } });
        if (bonus > 0) {
          await db.transaction.create({ data: { userId: tx.userId, type: 'bonus', amount: bonus, status: 'Completed', note: `Coupon bonus [cid:${couponId}]` } });
        }
        return bonus;
      });
      log.info('NowPayments Webhook', `✓ Credited ${tx.amount / 100} + ₦${couponBonus / 100} bonus to user ${tx.userId}`);

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
            if (refEnabled && refMinDeposit > 0 && tx.amount >= refMinDeposit) {
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
                }).catch(e => log.warn('Referral race (crypto webhook)', e.message));
              }
            }
          }
        }
      } catch (err) { log.error('Deferred referral (crypto webhook)', err.message); }
    }

    // Payment failed or expired
    if (payment_status === 'expired' || payment_status === 'failed' || payment_status === 'refunded') {
      const tx = await prisma.transaction.findFirst({
        where: { reference: order_id, method: 'crypto', status: { in: ['Pending', 'Processing'] } },
      });
      if (tx) {
        await prisma.transaction.update({
          where: { id: tx.id },
          data: { status: 'Cancelled' },
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
