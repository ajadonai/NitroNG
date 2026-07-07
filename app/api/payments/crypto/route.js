import { fetchWithRetry } from '@/lib/fetch';
import { log } from "@/lib/logger";
import prisma from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';
import { trackDeposit, parseFbCookies } from '@/lib/meta-capi';

const NP_KEY = process.env.NOWPAYMENTS_API_KEY;
const NP_URL = 'https://api.nowpayments.io/v1';
const FALLBACK_RATE = 1600;

async function getNgnToUsd() {
  try {
    const setting = await prisma.setting.findUnique({ where: { key: 'markup_usd_rate' } });
    return Number(setting?.value) || FALLBACK_RATE;
  } catch {
    return FALLBACK_RATE;
  }
}

// POST — create crypto payment
export async function POST(req) {
  try {
    const session = await getCurrentUser();
    if (!session) return Response.json({ error: 'Not authenticated' }, { status: 401 });

    const user = await prisma.user.findUnique({ where: { id: session.id } });
    if (!user) return Response.json({ error: 'User not found' }, { status: 404 });

    if (!NP_KEY) return Response.json({ error: 'Crypto payments not configured' }, { status: 503 });

    const { amount, couponId } = await req.json();
    const amountNgn = Number(amount);

    if (!amountNgn || amountNgn < 500) {
      return Response.json({ error: 'Minimum deposit is ₦500' }, { status: 400 });
    }

    // Convert NGN to USD
    const rate = await getNgnToUsd();
    const amountUsd = amountNgn / rate;

    if (amountUsd < 11) {
      return Response.json({ error: `Minimum for crypto is ~₦${Math.ceil(11 * rate).toLocaleString()} ($11 USD)` }, { status: 400 });
    }

    // Idempotency — if user already has a pending crypto tx for the same amount, return it
    const amountKobo = Math.round(amountNgn * 100);
    const existing = await prisma.transaction.findFirst({
      where: { userId: user.id, method: 'crypto', status: 'Pending', amount: amountKobo },
      orderBy: { createdAt: 'desc' },
    });
    if (existing) {
      const npMatch = existing.note?.match(/\[np:(\d+)\]/);
      if (npMatch && NP_KEY) {
        try {
          const npRes = await fetch(`${NP_URL}/payment/${npMatch[1]}`, { headers: { 'x-api-key': NP_KEY } });
          const npData = await npRes.json();
          if (npData.pay_address && npData.payment_status === 'waiting') {
            return Response.json({
              paymentId: npData.payment_id,
              payAddress: npData.pay_address,
              payAmount: npData.pay_amount,
              payCurrency: 'USDT (TRC-20)',
              amountUsd: Math.round(amountUsd * 100) / 100,
              amountNgn,
              reference: existing.reference,
              expiresAt: npData.expiration_estimate_date || null,
            });
          }
        } catch (err) { log.warn('NowPayments status reuse', err.message); }
      }
    }

    const reference = `NTR-CRYPTO-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

    // Create NowPayments invoice
    const npRes = await fetchWithRetry(`${NP_URL}/payment`, {
      method: 'POST',
      headers: {
        'x-api-key': NP_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        price_amount: Math.round(amountUsd * 100) / 100,
        price_currency: 'usd',
        pay_currency: 'usdttrc20',
        order_id: reference,
        order_description: `Nitro deposit ₦${amountNgn.toLocaleString()} by ${user.email}`,
        ipn_callback_url: `${process.env.NEXT_PUBLIC_APP_URL || 'https://nitro.ng'}/api/payments/crypto/webhook`,
      }),
    });

    const npData = await npRes.json();

    if (!npData.payment_id || !npData.pay_address) {
      log.error('NowPayments Create', JSON.stringify(npData));
      return Response.json({ error: npData.message || 'Failed to create crypto payment' }, { status: 400 });
    }

    // Create pending transaction
    await prisma.transaction.create({
      data: {
        userId: user.id,
        type: 'deposit',
        amount: amountKobo,
        method: 'crypto',
        status: 'Pending',
        reference,
        note: `Crypto deposit ₦${amountNgn.toLocaleString()} ($${amountUsd.toFixed(2)} USDT)${couponId ? ` [coupon:${couponId}]` : ''} [np:${npData.payment_id}]`,
      },
    });

    const { fbp, fbc } = parseFbCookies(req.headers.get('cookie'));
    await prisma.user.update({ where: { id: user.id }, data: {
      lastIp: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || undefined,
      lastUa: req.headers.get('user-agent') || undefined,
      lastFbp: fbp || undefined, lastFbc: fbc || undefined,
    }});

    return Response.json({
      paymentId: npData.payment_id,
      payAddress: npData.pay_address,
      payAmount: npData.pay_amount,
      payCurrency: 'USDT (TRC-20)',
      amountUsd: Math.round(amountUsd * 100) / 100,
      amountNgn: amountNgn,
      reference,
      expiresAt: npData.expiration_estimate_date || null,
    });

  } catch (err) {
    log.error('Crypto Payment Create', err.message);
    return Response.json({ error: 'Failed to create crypto payment' }, { status: 500 });
  }
}

// GET — check payment status
export async function GET(req) {
  try {
    const session = await getCurrentUser();
    if (!session) return Response.json({ error: 'Not authenticated' }, { status: 401 });

    const url = new URL(req.url);
    const reference = url.searchParams.get('reference');
    if (!reference) return Response.json({ error: 'Reference required' }, { status: 400 });

    const tx = await prisma.transaction.findFirst({
      where: { reference, userId: session.id },
    });
    if (!tx) return Response.json({ error: 'Transaction not found' }, { status: 404 });

    // Extract NowPayments ID from note
    const npMatch = tx.note?.match(/\[np:(\d+)\]/);
    if (!npMatch || !NP_KEY) {
      return Response.json({ status: tx.status, reference });
    }

    // Check status with NowPayments
    const npRes = await fetch(`${NP_URL}/payment/${npMatch[1]}`, {
      headers: { 'x-api-key': NP_KEY },
    });
    const npData = await npRes.json();

    const npStatus = npData.payment_status;

    // Update our transaction if NowPayments confirms — atomic claim prevents double-credit
    if ((npStatus === 'finished' || npStatus === 'confirmed') && tx.status === 'Pending') {
      const couponMatch = (tx.note || '').match(/\[coupon:([^\]]+)\]/);
      const couponId = couponMatch?.[1];

      const credited = await prisma.$transaction(async (db) => {
        const claimed = await db.transaction.updateMany({
          where: { id: tx.id, status: 'Pending' },
          data: { status: 'Completed' },
        });
        if (claimed.count === 0) return false;

        let bonus = 0;
        if (couponId) {
          const alreadyUsed = await db.transaction.findFirst({
            where: { userId: tx.userId, type: 'bonus', note: { contains: `[cid:${couponId}]` } },
          });
          if (!alreadyUsed) {
            const [row] = await db.$queryRaw`SELECT value FROM settings WHERE key = 'coupons' FOR UPDATE`;
            if (row) {
              const coupons = JSON.parse(row.value);
              const coupon = coupons.find(c => c.id === couponId && c.enabled !== false);
              if (coupon) {
                const notExpired = !coupon.expires || new Date(coupon.expires) >= new Date();
                const notMaxed = !coupon.maxUses || coupon.maxUses === 0 || (coupon.used || 0) < coupon.maxUses;
                if (notExpired && notMaxed) {
                  bonus = coupon.type === 'percent' ? Math.round(tx.amount * (coupon.value / 100)) : coupon.value * 100;
                  await db.setting.update({
                    where: { key: 'coupons' },
                    data: { value: JSON.stringify(coupons.map(c => c.id === couponId ? { ...c, used: (c.used || 0) + 1 } : c)) },
                  });
                }
              }
            }
          }
        }

        await db.user.update({ where: { id: tx.userId }, data: { balance: { increment: tx.amount + bonus } } });
        if (bonus > 0) {
          await db.transaction.create({ data: { userId: tx.userId, type: 'bonus', amount: bonus, status: 'Completed', note: `Coupon bonus [cid:${couponId}]` } });
        }
        return true;
      });

      if (!credited) {
        return Response.json({ status: 'Completed', reference });
      }

      try {
        const u = await prisma.user.findUnique({ where: { id: tx.userId }, select: { email: true, phone: true, lastIp: true, lastUa: true, lastFbp: true, lastFbc: true } });
        if (u) await trackDeposit({ email: u.email, phone: u.phone, userId: tx.userId, reference, amountKobo: tx.amount, clientIp: u.lastIp, userAgent: u.lastUa, fbp: u.lastFbp, fbc: u.lastFbc });
      } catch {}

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
              const sameIp = referrer?.signupIp && user.signupIp
                && referrer.signupIp !== 'unknown' && referrer.signupIp === user.signupIp;
              if (sameIp) log.warn('Referral', `Self-referral suspected: ${tx.userId} → ${referrer.id} (same IP ${user.signupIp})`);
              if (referrer && !sameIp) {
                const referrerBonus = Number(rs.ref_referrer_bonus) || 50000;
                const inviteeBonus = Number(rs.ref_invitee_bonus) || 50000;
                try {
                  await prisma.$transaction(async (db) => {
                    const exists = await db.transaction.findFirst({ where: { userId: tx.userId, type: 'referral', note: { contains: markerNote } } });
                    if (exists) return;
                    await db.user.update({ where: { id: referrer.id }, data: { balance: { increment: referrerBonus } } });
                    await db.transaction.create({ data: { userId: referrer.id, type: 'referral', amount: referrerBonus, note: `Referral bonus: ${user.name} deposited` } });
                    if (inviteeBonus > 0) {
                      await db.user.update({ where: { id: tx.userId }, data: { balance: { increment: inviteeBonus } } });
                    }
                    await db.transaction.create({ data: { userId: tx.userId, type: 'referral', amount: inviteeBonus, note: `Referral welcome bonus ${markerNote}` } });
                  });
                  log.info('Referral', `Deferred bonus paid on crypto confirm for ${tx.userId}`);
                } catch (txErr) { log.warn('Referral race', txErr.message); }
              }
            }
          }
        }
      } catch (err) { log.error('Deferred referral (crypto)', err.message); }

      return Response.json({ status: 'Completed', reference });
    }

    if (npStatus === 'expired' || npStatus === 'failed') {
      await prisma.transaction.delete({ where: { id: tx.id } });
      return Response.json({ status: 'Cancelled', reference });
    }

    return Response.json({
      status: npStatus === 'waiting' ? 'Pending' : npStatus === 'confirming' ? 'Confirming' : tx.status,
      reference,
      npStatus,
    });

  } catch (err) {
    log.error('Crypto Payment Check', err.message);
    return Response.json({ error: 'Failed to check status' }, { status: 500 });
  }
}

// DELETE — user cancels before paying
export async function DELETE(req) {
  try {
    const session = await getCurrentUser();
    if (!session) return Response.json({ error: 'Not authenticated' }, { status: 401 });

    const { reference } = await req.json();
    if (!reference) return Response.json({ error: 'Reference required' }, { status: 400 });

    const tx = await prisma.transaction.findFirst({
      where: { reference, userId: session.id, method: 'crypto', status: 'Pending' },
    });
    if (!tx) return Response.json({ error: 'Transaction not found' }, { status: 404 });

    await prisma.transaction.delete({ where: { id: tx.id } });
    return Response.json({ success: true });
  } catch (err) {
    log.error('Crypto Payment Cancel', err.message);
    return Response.json({ error: 'Failed to cancel' }, { status: 500 });
  }
}
