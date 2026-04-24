import prisma from '@/lib/prisma';
import { log } from '@/lib/logger';

async function getGatewayKeys(gatewayId) {
  const setting = await prisma.setting.findUnique({ where: { key: `gateway_${gatewayId}` } });
  if (setting) {
    try { const data = JSON.parse(setting.value); if (data.fields) return data.fields; } catch {}
  }
  if (gatewayId === 'flutterwave') return { secretKey: process.env.FLUTTERWAVE_SECRET_KEY || '' };
  return {};
}

async function verifyFlutterwave(reference, secretKey) {
  const res = await fetch(
    `https://api.flutterwave.com/v3/transactions/verify_by_reference?tx_ref=${encodeURIComponent(reference)}`,
    { headers: { Authorization: `Bearer ${secretKey}` } }
  );
  const data = await res.json();
  if (data.status === 'success' && data.data.status === 'successful') {
    return { paid: true, amount: Math.round(data.data.amount * 100) };
  }
  if (data.data?.status === 'failed') return { paid: false, failed: true };
  return { paid: false };
}

async function verifyNowPayments(reference) {
  const apiKey = process.env.NOWPAYMENTS_API_KEY;
  if (!apiKey) return { paid: false };
  const res = await fetch(`https://api.nowpayments.io/v1/payment/${reference}`, {
    headers: { 'x-api-key': apiKey },
  });
  if (!res.ok) return { paid: false };
  const data = await res.json();
  if (data.payment_status === 'finished' || data.payment_status === 'confirmed') {
    return { paid: true, actuallyPaid: data.actually_paid };
  }
  if (data.payment_status === 'expired' || data.payment_status === 'failed') {
    return { paid: false, failed: true };
  }
  return { paid: false };
}

async function creditTransaction(tx, paidAmount) {
  const couponMatch = (tx.note || '').match(/\[coupon:([^\]]+)\]/);
  const couponId = couponMatch?.[1];

  await prisma.$transaction(async (db) => {
    let bonus = 0;
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
              bonus = coupon.type === 'percent' ? Math.round(paidAmount * (coupon.value / 100)) : coupon.value * 100;
              await db.setting.update({
                where: { key: 'coupons' },
                data: { value: JSON.stringify(coupons.map(c => c.id === couponId ? { ...c, used: (c.used || 0) + 1 } : c)) },
              });
            }
          }
        }
      }
    }
    await db.transaction.update({ where: { id: tx.id }, data: { status: 'Completed', amount: paidAmount, note: (tx.note || '') + ' [recovered-by-cron]' } });
    await db.user.update({ where: { id: tx.userId }, data: { balance: { increment: paidAmount + bonus } } });
    if (bonus > 0) {
      await db.transaction.create({ data: { userId: tx.userId, type: 'bonus', amount: bonus, status: 'Completed', note: `Coupon bonus [cid:${couponId}]` } });
    }
  });
}

export async function GET(req) {
  const secret = req.headers.get('authorization')?.replace('Bearer ', '');
  if (secret !== process.env.CRON_SECRET) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const fifteenMinAgo = new Date(Date.now() - 15 * 60 * 1000);
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const staleTxns = await prisma.transaction.findMany({
      where: {
        type: 'deposit',
        status: 'Pending',
        createdAt: { gt: twentyFourHoursAgo, lt: fifteenMinAgo },
      },
      take: 50,
      orderBy: { createdAt: 'asc' },
    });

    if (staleTxns.length === 0) {
      return Response.json({ recovered: 0, expired: 0 });
    }

    let recovered = 0;
    let expired = 0;
    const errors = [];

    for (const tx of staleTxns) {
      try {
        const gateway = tx.method || 'flutterwave';
        let result;

        if (gateway === 'crypto') {
          result = await verifyNowPayments(tx.reference);
        } else {
          const keys = await getGatewayKeys(gateway);
          if (!keys.secretKey) { continue; }
          result = await verifyFlutterwave(tx.reference, keys.secretKey);
        }

        if (result.paid) {
          const claimed = await prisma.transaction.updateMany({
            where: { id: tx.id, status: 'Pending' },
            data: { status: 'Processing' },
          });
          if (claimed.count === 0) continue;

          const amount = result.amount || tx.amount;
          if (gateway !== 'crypto' && amount !== tx.amount) {
            await prisma.transaction.update({ where: { id: tx.id }, data: { status: 'Failed', note: `Amount mismatch: paid ${amount}, expected ${tx.amount} [cron-recovery]` } });
            log.warn('Payment Recovery', `Amount mismatch for ${tx.reference}`);
            continue;
          }

          await creditTransaction(tx, amount);
          recovered++;
          log.info('Payment Recovery', `Recovered ₦${amount / 100} for ${tx.reference}`);
        } else if (result.failed) {
          await prisma.transaction.update({ where: { id: tx.id }, data: { status: 'Cancelled', note: (tx.note || '') + ' [expired-by-cron]' } });
          expired++;
        }
      } catch (err) {
        errors.push(`${tx.reference}: ${err.message}`);
        log.error('Payment Recovery', `Failed to recover ${tx.reference}: ${err.message}`);
      }
    }

    log.info('Payment Recovery', `Checked ${staleTxns.length}: ${recovered} recovered, ${expired} expired`);
    return Response.json({ checked: staleTxns.length, recovered, expired, errors: errors.length ? errors : undefined });
  } catch (err) {
    log.error('Payment Recovery', err.message);
    return Response.json({ error: 'Recovery failed' }, { status: 500 });
  }
}
