import { fetchWithRetry } from '@/lib/fetch';
import { log } from "@/lib/logger";
import prisma from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';

async function getGatewayKeys(gatewayId) {
  // Try Settings DB first
  const setting = await prisma.setting.findUnique({ where: { key: `gateway_${gatewayId}` } });
  if (setting) {
    try {
      const data = JSON.parse(setting.value);
      if (data.fields) return data.fields;
    } catch {}
  }
  // Fallback to env vars
  if (gatewayId === 'flutterwave') return { secretKey: process.env.FLUTTERWAVE_SECRET_KEY || '', publicKey: process.env.FLUTTERWAVE_PUBLIC_KEY || '' };
  return {};
}

export async function POST(req) {
  try {
    const session = await getCurrentUser();
    if (!session) return Response.json({ error: 'Not authenticated' }, { status: 401 });

    const user = await prisma.user.findUnique({ where: { id: session.id } });
    if (!user) return Response.json({ error: 'User not found' }, { status: 404 });

    const { amount, method, couponId } = await req.json();
    const amountNum = Number(amount);
    const gateway = method || 'flutterwave';

    if (!amountNum || amountNum < 500) {
      return Response.json({ error: 'Minimum deposit is ₦500' }, { status: 400 });
    }
    if (amountNum > 10000000) {
      return Response.json({ error: 'Maximum deposit is ₦10,000,000' }, { status: 400 });
    }

    const keys = await getGatewayKeys(gateway);
    if (!keys.secretKey) {
      return Response.json({ error: `${gateway} is not configured. Contact admin.` }, { status: 503 });
    }

    const amountKobo = Math.round(amountNum * 100);
    const reference = `NTR-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
    const origin = process.env.NEXT_PUBLIC_APP_URL || 'https://nitro.ng';

    // Create pending transaction
    await prisma.transaction.create({
      data: {
        userId: user.id,
        type: 'deposit',
        amount: amountKobo,
        method: gateway,
        status: 'Pending',
        reference,
        note: `${gateway} deposit ₦${amountNum.toLocaleString()}${couponId ? ` [coupon:${couponId}]` : ''}`,
      },
    });

    // ═══ FLUTTERWAVE ═══
    if (gateway === 'flutterwave') {
      const res = await fetchWithRetry('https://api.flutterwave.com/v3/payments', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${keys.secretKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tx_ref: reference,
          amount: amountNum,
          currency: 'NGN',
          redirect_url: `${origin}/dashboard?verify=${reference}`,
          customer: { email: user.email, name: user.name },
          customizations: { title: 'Nitro Deposit', logo: `${origin}/icon.png` },
          meta: { userId: user.id },
        }),
      });
      const data = await res.json();
      if (data.status !== 'success') {
        log.error('Flutterwave Init', data.message);
        return Response.json({ error: data.message || 'Payment initialization failed' }, { status: 400 });
      }
      return Response.json({ authorization_url: data.data.link, reference });
    }

    // ═══ CRYPTO (NowPayments — USDT TRC-20) ═══
    if (gateway === 'crypto') {
      const npKey = process.env.NOWPAYMENTS_API_KEY;
      if (!npKey) return Response.json({ error: 'Crypto payments not configured' }, { status: 503 });

      // Convert NGN to USD (use a rough rate, NowPayments handles exact crypto conversion)
      const ngnToUsd = amountNum / 1600; // approximate rate
      if (ngnToUsd < 11) return Response.json({ error: 'Minimum crypto deposit is ~₦17,600 ($11 USD)' }, { status: 400 });

      const res = await fetchWithRetry('https://api.nowpayments.io/v1/payment', {
        method: 'POST',
        headers: { 'x-api-key': npKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          price_amount: Math.round(ngnToUsd * 100) / 100,
          price_currency: 'usd',
          pay_currency: 'usdttrc20',
          order_id: reference,
          order_description: `Nitro deposit ₦${amountNum.toLocaleString()}`,
          ipn_callback_url: `${origin}/api/payments/nowpayments-webhook`,
          is_fixed_rate: true,
          is_fee_paid_by_user: true,
        }),
      });
      const data = await res.json();
      if (!data.pay_address) {
        log.error('NowPayments Init', JSON.stringify(data));
        return Response.json({ error: data.message || 'Failed to create crypto payment' }, { status: 400 });
      }

      // Update transaction with NowPayments payment ID
      await prisma.transaction.update({
        where: { reference },
        data: { note: `crypto deposit ₦${amountNum.toLocaleString()} | NP:${data.payment_id} | $${ngnToUsd.toFixed(2)}` },
      });

      return Response.json({
        type: 'crypto',
        reference,
        payAddress: data.pay_address,
        payAmount: data.pay_amount,
        payCurrency: 'USDT (TRC-20)',
        paymentId: data.payment_id,
        expiresAt: data.expiration_estimate_date || null,
        priceUsd: Math.round(ngnToUsd * 100) / 100,
      });
    }

    // ═══ UNSUPPORTED GATEWAY ═══
    return Response.json({ error: `Gateway '${gateway}' is not yet supported for payments` }, { status: 400 });

  } catch (err) {
    log.error('Payments Initialize', err.message);
    return Response.json({ error: 'Failed to initialize payment' }, { status: 500 });
  }
}
