import { fetchWithRetry } from '@/lib/fetch';
import { canChargeIn, chargeCurrencyForCountry, foreignChargeAmount, formatMoney, isActive } from '@/lib/currency';
import { resolveDepositRate } from '@/lib/fx-deposit';
import { log } from "@/lib/logger";
import prisma from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';
import { rateLimit, rateLimitUnavailable, tooManyRequests } from '@/lib/rate-limit';
import { parseFbCookies } from '@/lib/meta-capi';
import { isReservedDepositEffectKey } from '@/lib/deposit-finalization';
import { getApplicationUrl } from '@/lib/env';

// Methods to request from the hosted checkout, by charge currency. Names are
// Flutterwave's own option keys; a method that is not enabled on the dashboard
// is simply not shown, so this lists what we want, not what is guaranteed.
// USD and GBP are listed for the day Flutterwave enables collecting in them;
// until then canChargeIn() never lets a charge reach those rows.
const PAYMENT_OPTIONS = Object.freeze({
  NGN: 'card,banktransfer,ussd,opay',
  GHS: 'card,mobilemoneyghana',
  KES: 'card,mpesa',
  USD: 'card',
  GBP: 'card',
});
const paymentOptionsFor = (currency) => PAYMENT_OPTIONS[currency] || 'card';

async function getGatewayKeys(gatewayId) {
  // Try Settings DB first
  const setting = await prisma.setting.findUnique({ where: { key: `gateway_${gatewayId}` } });
  if (setting) {
    try {
      const data = JSON.parse(setting.value);
      if (data.fields) return data.fields;
    } catch (err) { log.warn('Gateway config parse', err.message); }
  }
  // Fallback to env vars
  if (gatewayId === 'flutterwave') return { secretKey: process.env.FLUTTERWAVE_SECRET_KEY || '', publicKey: process.env.FLUTTERWAVE_PUBLIC_KEY || '' };
  return {};
}

export async function POST(req) {
  try {
    const limit = await rateLimit(req, { maxAttempts: 10, windowMs: 60 * 1000 });
    if (limit.unavailable) return rateLimitUnavailable(undefined, limit.retryAfter);
    if (limit.limited) return tooManyRequests('Too many payment attempts. Try again in a minute.', limit.retryAfter);

    const session = await getCurrentUser();
    if (!session) return Response.json({ error: 'Not authenticated' }, { status: 401 });

    const user = await prisma.user.findUnique({ where: { id: session.id } });
    if (!user) return Response.json({ error: 'User not found' }, { status: 404 });

    const { amount, method, couponId, idempotencyKey, currency: viewing } = await req.json();
    const amountNum = Number(amount);
    const gateway = method || 'flutterwave';

    if (!idempotencyKey || typeof idempotencyKey !== 'string') {
      return Response.json({ error: 'Missing idempotency key' }, { status: 400 });
    }
    if (idempotencyKey.length > 200 || isReservedDepositEffectKey(idempotencyKey)) {
      return Response.json({ error: 'Invalid idempotency key' }, { status: 400 });
    }

    if (!amountNum || amountNum < 1000) {
      return Response.json({ error: 'Minimum deposit is ₦1,000' }, { status: 400 });
    }
    if (amountNum > 10000000) {
      return Response.json({ error: 'Maximum deposit is ₦10,000,000' }, { status: 400 });
    }

    // Idempotency: return existing session if duplicate key
    const existing = await prisma.transaction.findUnique({
      where: { userId_idempotencyKey: { userId: user.id, idempotencyKey } },
    });
    if (existing) {
      return Response.json({ authorization_url: existing.gatewayUrl, reference: existing.reference, deduplicated: true });
    }

    const keys = await getGatewayKeys(gateway);
    if (!keys.secretKey) {
      return Response.json({ error: `${gateway} is not configured. Contact admin.` }, { status: 503 });
    }

    const amountKobo = Math.round(amountNum * 100);

    // Charge in the customer's own currency: the one the site is set to when
    // that is a foreign one we can charge in (a Nigerian reading prices in
    // dollars pays dollars, by card), otherwise the one their country pays in
    // (a Ghanaian who never touched the picker still gets cedis, and with them
    // mobile money). The naira credit is amountKobo regardless; the foreign
    // figure is derived here, once, at the padded deposit rate, and stored on
    // the row so verification checks exactly what was quoted. No rate → naira
    // as before.
    const country = user.country ?? (await prisma.user.findUnique({ where: { id: user.id }, select: { country: true } }))?.country;
    const byCountry = chargeCurrencyForCountry(country);
    const picked = isActive(viewing) && viewing !== 'NGN' ? viewing : byCountry;
    // Only a currency Flutterwave collects in — dollars and pounds are display
    // units, and asking for one leaves the checkout with no method to offer.
    // An uncollectible pick falls back to the COUNTRY, never straight to naira:
    // the padded rate is only charged on a currency we denominate ourselves, so
    // dropping a Ghanaian who picks dollars into a naira charge would have let
    // the picker waive the deposit premium — their card would then convert at
    // the network's rate, not ours. Cedis stay cedis whatever the page reads in.
    const chargeCode = canChargeIn(picked) ? picked
      : canChargeIn(byCountry) ? byCountry
        : 'NGN';
    let chargeCurrency = 'NGN';
    let chargeAmount = amountNum;
    if (chargeCode !== 'NGN') {
      const fx = await resolveDepositRate().catch(() => null);
      const foreign = fx ? foreignChargeAmount(amountKobo, chargeCode, fx) : null;
      if (foreign) { chargeCurrency = chargeCode; chargeAmount = foreign; }
    }
    const reference = `NTR-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
    const origin = getApplicationUrl();

    // Create pending transaction with idempotency key
    await prisma.transaction.create({
      data: {
        userId: user.id,
        type: 'deposit',
        amount: amountKobo,
        method: gateway,
        status: 'Pending',
        reference,
        idempotencyKey,
        // As a string: Prisma turns a JS number into a Decimal from its exact
        // binary value, so 560.06 was stored as 560.059999999999945430. The
        // shortest repr is the figure we quoted.
        ...(chargeCurrency !== 'NGN' ? { providerPriceAmount: String(chargeAmount), providerPriceCurrency: chargeCurrency } : {}),
        note: `${gateway} deposit ₦${amountNum.toLocaleString()}${chargeCurrency !== 'NGN' ? ` · charged ${formatMoney(chargeAmount, chargeCurrency)}` : ''}${couponId ? ` [coupon:${couponId}]` : ''}`,
      },
    });

    const { fbp, fbc } = parseFbCookies(req.headers.get('cookie'));
    await prisma.user.update({ where: { id: user.id }, data: {
      lastIp: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || undefined,
      lastUa: req.headers.get('user-agent') || undefined,
      lastFbp: fbp || undefined, lastFbc: fbc || undefined,
    }});

    // ═══ FLUTTERWAVE ═══
    if (gateway === 'flutterwave') {
      const res = await fetchWithRetry('https://api.flutterwave.com/v3/payments', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${keys.secretKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tx_ref: reference,
          amount: chargeAmount,
          currency: chargeCurrency,
          // Which methods the hosted checkout shows. This was hardcoded to
          // 'banktransfer' — so cards enabled on the Flutterwave dashboard
          // never appeared. Omitting the field does NOT make Flutterwave show
          // the dashboard set (Trip still saw four options), so it is sent
          // explicitly, per charge currency, and each mobile-money method only
          // exists on a charge in its own currency — which is why
          // chargeCurrency above follows the customer's country. The admin
          // gateway field overrides the whole list when set.
          payment_options: keys.paymentOptions?.trim() || paymentOptionsFor(chargeCurrency),
          redirect_url: `${origin}/dashboard?verify=${reference}`,
          customer: { email: user.email, name: user.name },
          customizations: { title: 'Nitro Deposit', logo: `${origin}/icon-192.png` },
          meta: { userId: user.id },
        }),
      });
      const data = await res.json();
      if (data.status !== 'success') {
        log.error('Flutterwave Init', data.message);
        return Response.json({ error: data.message || 'Payment initialization failed' }, { status: 400 });
      }
      // Store gateway URL for idempotent replay
      await prisma.transaction.update({
        where: { reference },
        data: { gatewayUrl: data.data.link },
      });
      return Response.json({ authorization_url: data.data.link, reference });
    }

    // ═══ UNSUPPORTED GATEWAY ═══
    return Response.json({ error: `Gateway '${gateway}' is not yet supported for payments` }, { status: 400 });

  } catch (err) {
    log.error('Payments Initialize', err.message);
    return Response.json({ error: 'Failed to initialize payment' }, { status: 500 });
  }
}
