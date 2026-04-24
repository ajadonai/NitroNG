import { fetchWithRetry } from '@/lib/fetch';
import { log } from "@/lib/logger";
import prisma from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';

const NP_KEY = process.env.NOWPAYMENTS_API_KEY;
const NP_URL = 'https://api.nowpayments.io/v1';
const NGN_TO_USD = 1600; // fallback rate — we'll fetch live rate

async function getNgnToUsd() {
  try {
    const res = await fetch('https://api.nowpayments.io/v1/estimate?amount=1&currency_from=usd&currency_to=usdttrc20', {
      headers: { 'x-api-key': NP_KEY },
    });
    // We just need a rough NGN→USD rate. Use a fixed rate for now.
    // In production, integrate a forex API or admin-configurable rate.
    return NGN_TO_USD;
  } catch (err) {
    log.warn('NGN→USD rate fetch', err.message);
    return NGN_TO_USD;
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
      const credited = await prisma.$transaction(async (db) => {
        const claimed = await db.transaction.updateMany({
          where: { id: tx.id, status: 'Pending' },
          data: { status: 'Completed' },
        });
        if (claimed.count === 0) return false;
        await db.user.update({ where: { id: tx.userId }, data: { balance: { increment: tx.amount } } });
        return true;
      });
      if (!credited) {
        return Response.json({ status: 'Completed', reference });
      }
      return Response.json({ status: 'Completed', reference });
    }

    if (npStatus === 'expired' || npStatus === 'failed') {
      await prisma.transaction.update({ where: { id: tx.id }, data: { status: 'Cancelled' } });
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
