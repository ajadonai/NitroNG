import { randomUUID } from 'node:crypto';
import prisma from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';
import { log } from '@/lib/logger';
import { parseFbCookies } from '@/lib/meta-capi';
import { rateLimit } from '@/lib/rate-limit';
import { isReservedDepositEffectKey } from '@/lib/deposit-finalization';
import { notifyDepositFinalized } from '@/lib/deposit-notifications';
import { isReservedProviderQueryLeaseKey } from '@/lib/provider-query-lease';
import {
  getNowPaymentsCreationApiKey,
  recordNowPaymentsReview,
  reconcileNowPaymentsDeposit,
} from '@/lib/nowpayments-payment';
import {
  canonicalizeNonNegativeDecimal,
  compareNonNegativeDecimals,
  normalizeNowPaymentsProviderId,
  validateNowPaymentsCreationResponse,
} from '@/lib/nowpayments-verification';
import { paymentStateFromTransactionStatus } from '@/lib/payment-state';

const NOWPAYMENTS_URL = 'https://api.nowpayments.io/v1';
const PROVIDER_TIMEOUT_MS = 15_000;
const FALLBACK_NGN_PER_USD = '1600';
const MIN_AMOUNT_KOBO = 100_000;
const MAX_AMOUNT_KOBO = 1_000_000_000;
const MIN_USD_CENTS = 1_100;
const PRICE_CURRENCY = 'usd';
const PAY_CURRENCY = 'usdttrc20';

function isUniqueConstraintError(error) {
  return error?.code === 'P2002';
}

function normalizeAmountKobo(value) {
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  if (typeof value === 'number' && !Number.isFinite(value)) return null;

  const source = String(value).trim();
  const match = source.match(/^(0|[1-9]\d*)(?:\.(\d{1,2}))?$/);
  if (!match) return null;

  const whole = BigInt(match[1]);
  const fraction = BigInt((match[2] || '').padEnd(2, '0') || '0');
  const kobo = (whole * 100n) + fraction;
  if (kobo > BigInt(Number.MAX_SAFE_INTEGER)) return null;
  return Number(kobo);
}

function canonicalRate(value) {
  const rate = canonicalizeNonNegativeDecimal(value);
  return rate
    && compareNonNegativeDecimals(rate, '1') >= 0
    && compareNonNegativeDecimals(rate, '1000000000') <= 0
    ? rate
    : FALLBACK_NGN_PER_USD;
}

function roundedUsdCents(amountKobo, rate) {
  const [integer, fraction = ''] = rate.split('.');
  const scale = 10n ** BigInt(fraction.length);
  const divisor = BigInt(`${integer}${fraction}`);
  const numerator = BigInt(amountKobo) * scale;
  const cents = (numerator + (divisor / 2n)) / divisor;
  if (cents > BigInt(Number.MAX_SAFE_INTEGER)) return null;
  return Number(cents);
}

function usdAmountFromCents(cents) {
  return `${Math.floor(cents / 100)}.${String(cents % 100).padStart(2, '0')}`;
}

function displayDecimal(value) {
  return canonicalizeNonNegativeDecimal(value) || null;
}

function paymentStateFor(transaction) {
  if (hasOpenReview(transaction)) return 'review';
  return paymentStateFromTransactionStatus(transaction?.status);
}

function hasOpenReview(transaction) {
  return Boolean(
    transaction?.paymentReviewReason
    && !transaction?.paymentReviewResolvedAt,
  );
}

function couponIdFromNote(note) {
  return String(note || '').match(/\[coupon:([^\]\s]+)\]/)?.[1] || null;
}

function instructionResponse(transaction, { deduplicated = false, expiresAt = null } = {}) {
  return {
    success: false,
    paymentState: paymentStateFor(transaction) || 'provider_pending',
    status: transaction.status,
    transactionStatus: transaction.status,
    retryable: false,
    paymentId: transaction.providerPaymentId,
    payAddress: transaction.providerPayAddress,
    payAmount: displayDecimal(transaction.providerPayAmount),
    payCurrency: 'USDT (TRC-20)',
    payCurrencyCode: transaction.providerPayCurrency || PAY_CURRENCY,
    amountUsd: Number(displayDecimal(transaction.providerPriceAmount)),
    amountNgn: transaction.amount / 100,
    amount: transaction.amount / 100,
    reference: transaction.reference,
    expiresAt,
    deduplicated,
  };
}

function terminalReplayResponse(transaction) {
  const paymentState = paymentStateFor(transaction);
  const credited = paymentState === 'credited' && transaction.status === 'Completed';
  const openReviewReason = hasOpenReview(transaction)
    ? transaction.paymentReviewReason
    : null;
  return {
    success: credited,
    paymentState,
    status: transaction.status,
    transactionStatus: transaction.status,
    retryable: false,
    reason: openReviewReason || (credited ? 'already_completed' : 'creation_not_available'),
    message: credited
      ? 'Already credited'
      : openReviewReason
        ? 'This payment needs manual review.'
        : 'This payment attempt is no longer available.',
    error: credited ? undefined : 'This payment attempt is no longer available.',
    amount: transaction.amount / 100,
    amountNgn: transaction.amount / 100,
    reference: transaction.reference,
    deduplicated: true,
  };
}

function ambiguousCreationResponse(transaction, reason = 'provider_creation_unknown') {
  const message = 'Payment creation could not be confirmed. Retry with the same payment attempt.';
  return {
    success: false,
    paymentState: 'retryable',
    status: transaction.status,
    transactionStatus: transaction.status,
    retryable: true,
    reason,
    message,
    error: message,
    amount: transaction.amount / 100,
    amountNgn: transaction.amount / 100,
    reference: transaction.reference,
    deduplicated: true,
  };
}

function rejectedCreationResponse(transaction, reason = 'provider_rejected_creation') {
  const message = 'NOWPayments rejected this payment attempt. Please start a new one.';
  return {
    ...terminalReplayResponse(transaction),
    success: false,
    paymentState: 'failed',
    status: transaction.status,
    transactionStatus: transaction.status,
    reason,
    message,
    error: message,
  };
}

function replayExistingPayment(transaction, { amountKobo, couponId } = {}) {
  if (
    transaction.type !== 'deposit'
    || transaction.method !== 'crypto'
  ) {
    return Response.json({ error: 'Idempotency key is already in use' }, { status: 409 });
  }

  if (
    transaction.amount !== amountKobo
    || couponIdFromNote(transaction.note) !== couponId
  ) {
    return Response.json({
      error: 'Idempotency key does not match this payment request',
    }, { status: 409 });
  }

  if (
    transaction.providerPaymentId
    && transaction.providerPayAddress
    && transaction.providerPayAmount
    && !hasOpenReview(transaction)
    && ['Pending', 'Processing'].includes(transaction.status)
  ) {
    return Response.json(instructionResponse(transaction, { deduplicated: true }));
  }

  if (
    transaction.status === 'Completed'
    || transaction.status === 'Review'
    || hasOpenReview(transaction)
    || ['Cancelled', 'Expired', 'Failed', 'Refunded', 'Rejected'].includes(transaction.status)
  ) {
    return Response.json(terminalReplayResponse(transaction));
  }

  return Response.json(
    ambiguousCreationResponse(transaction),
    { status: 503, headers: { 'Retry-After': '15' } },
  );
}

async function getNgnPerUsdRate() {
  try {
    const setting = await prisma.setting.findUnique({ where: { key: 'markup_usd_rate' } });
    return canonicalRate(setting?.value);
  } catch {
    return FALLBACK_NGN_PER_USD;
  }
}

function paymentReference() {
  return `NTR-CRYPTO-${Date.now().toString(36).toUpperCase()}-${randomUUID().slice(0, 8).toUpperCase()}`;
}

function callbackOrigin(value) {
  try {
    const url = new URL(value || 'https://nitro.ng');
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
      return 'https://nitro.ng';
    }
    return url.origin;
  } catch {
    return 'https://nitro.ng';
  }
}

function normalizedCouponId(value) {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string') return null;
  const couponId = value.trim();
  return couponId.length <= 100 && /^[A-Za-z0-9_-]+$/.test(couponId)
    ? couponId
    : null;
}

async function postNowPaymentsInvoice({ apiKey, payload, fetchImpl = globalThis.fetch }) {
  if (typeof fetchImpl !== 'function') {
    return { state: 'retryable', reason: 'transport_unavailable' };
  }

  const controller = new AbortController();
  let timer;
  const request = (async () => {
    try {
      const response = await fetchImpl(`${NOWPAYMENTS_URL}/payment`, {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      let responseBody = null;
      try {
        responseBody = await response.json();
      } catch {
        if (response.ok) return { state: 'retryable', reason: 'malformed_json' };
      }

      if (!response.ok) {
        return {
          state: 'retryable',
          reason: 'provider_http_error',
          httpStatus: response.status,
          payload: responseBody,
        };
      }
      return { state: 'received', payload: responseBody };
    } catch (error) {
      return {
        state: 'retryable',
        reason: error?.name === 'AbortError' ? 'timeout' : 'transport_error',
      };
    }
  })();

  const timeout = new Promise(resolve => {
    timer = setTimeout(() => {
      controller.abort();
      resolve({ state: 'retryable', reason: 'timeout' });
    }, PROVIDER_TIMEOUT_MS);
  });

  try {
    // Invoice creation is deliberately attempted once. A timeout is ambiguous:
    // the provider may have accepted the request even if the response was lost.
    return await Promise.race([request, timeout]);
  } finally {
    clearTimeout(timer);
  }
}

async function bestEffortAttribution(req, userId) {
  try {
    const { fbp, fbc } = parseFbCookies(req.headers.get('cookie'));
    await prisma.user.update({
      where: { id: userId },
      data: {
        lastIp: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
          || req.headers.get('x-real-ip')
          || undefined,
        lastUa: req.headers.get('user-agent') || undefined,
        lastFbp: fbp || undefined,
        lastFbc: fbc || undefined,
      },
    });
  } catch (error) {
    log.warn('Crypto Payment Attribution', error.message);
  }
}

async function bindCreationObservation(transaction, validation, expectedPriceAmount, now) {
  const sameReference = validation.reference === transaction.reference;
  const safePaymentId = sameReference
    ? normalizeNowPaymentsProviderId(validation.paymentId)
    : null;
  const payAmount = displayDecimal(validation.payAmount);
  const data = {};

  if (safePaymentId) {
    data.providerPaymentId = safePaymentId;
  }
  if (safePaymentId && validation.priceAmount === displayDecimal(expectedPriceAmount)) {
    data.providerPriceAmount = validation.priceAmount;
  }
  if (safePaymentId && validation.priceCurrency === PRICE_CURRENCY) {
    data.providerPriceCurrency = PRICE_CURRENCY;
  }
  if (safePaymentId && payAmount && compareNonNegativeDecimals(payAmount, '0') === 1) {
    data.providerPayAmount = payAmount;
  }
  if (safePaymentId && validation.payCurrency === PAY_CURRENCY) {
    data.providerPayCurrency = PAY_CURRENCY;
  }
  if (validation.state === 'created') {
    data.providerPayAddress = validation.payAddress;
  }

  let bound = transaction;
  let bindingConflict = false;
  try {
    if (Object.keys(data).length > 0) {
      const boundIdentity = await prisma.transaction.updateMany({
        where: {
          id: transaction.id,
          OR: [
            { providerPaymentId: null },
            { providerPaymentId: safePaymentId },
          ],
        },
        data,
      });
      bindingConflict = boundIdentity.count === 0;
    }
  } catch (error) {
    if (!isUniqueConstraintError(error)) throw error;
    bindingConflict = true;
  }

  // A callback/status query can overtake the creation response. Only record
  // the initial `waiting` observation while no newer provider query exists.
  if (safePaymentId && !bindingConflict) {
    await prisma.transaction.updateMany({
      where: {
        id: transaction.id,
        providerPaymentId: safePaymentId,
        providerLastVerifiedAt: null,
      },
      data: {
        providerPaymentStatus: validation.providerStatus || null,
        providerLastVerifiedAt: now,
      },
    });
  }

  if (safePaymentId) {
    bound = await prisma.transaction.findUnique({ where: { id: transaction.id } });
    if (!bound) throw new Error('Crypto payment transaction disappeared during provider binding');
    if (normalizeNowPaymentsProviderId(bound.providerPaymentId) !== safePaymentId) {
      bindingConflict = true;
    }
  }

  return { transaction: bound, bindingConflict };
}

function creationReviewDetails(validation, expectedPriceAmount) {
  return {
    providerStatus: validation.providerStatus,
    observedPaymentId: validation.paymentId,
    observedReference: validation.reference,
    expectedPriceAmount,
    priceAmount: validation.priceAmount,
    expectedPriceCurrency: PRICE_CURRENCY,
    priceCurrency: validation.priceCurrency,
    payAmount: validation.payAmount,
    expectedPayCurrency: PAY_CURRENCY,
    payCurrency: validation.payCurrency,
  };
}

async function rateLimitForUser(req, userId, action, maxAttempts) {
  return rateLimit(req, {
    maxAttempts,
    windowMs: 60 * 1000,
    key: `rl:crypto-payment:${action}:${userId}`,
  });
}

function rateLimitedResponse(
  message = 'Too many payment attempts. Please wait a minute and try again.',
  retryAfter = 60,
) {
  return Response.json({
    success: false,
    paymentState: 'retryable',
    retryable: true,
    message,
    error: message,
  }, { status: 429, headers: { 'Retry-After': String(retryAfter) } });
}

function rateLimitUnavailableResponse(
  message = 'Payment request protection is temporarily unavailable. Please try again shortly.',
  retryAfter = 5,
) {
  return Response.json({
    success: false,
    paymentState: 'retryable',
    retryable: true,
    unavailable: true,
    message,
    error: message,
  }, { status: 503, headers: { 'Retry-After': String(retryAfter) } });
}

// POST — create one durable, idempotent crypto payment attempt.
export async function POST(req) {
  try {
    const session = await getCurrentUser();
    if (!session) return Response.json({ error: 'Not authenticated' }, { status: 401 });

    const limit = await rateLimitForUser(req, session.id, 'create', 10);
    if (limit.unavailable) return rateLimitUnavailableResponse(undefined, limit.retryAfter);
    if (limit.limited) return rateLimitedResponse(undefined, limit.retryAfter);

    const user = await prisma.user.findUnique({ where: { id: session.id } });
    if (!user) return Response.json({ error: 'User not found' }, { status: 404 });

    let body;
    try {
      body = await req.json();
    } catch {
      return Response.json({ error: 'Invalid request' }, { status: 400 });
    }

    const idempotencyKey = typeof body?.idempotencyKey === 'string'
      ? body.idempotencyKey.trim()
      : '';
    if (!idempotencyKey) {
      return Response.json({ error: 'Missing idempotency key' }, { status: 400 });
    }
    if (
      idempotencyKey.length > 200
      || isReservedDepositEffectKey(idempotencyKey)
      || isReservedProviderQueryLeaseKey(idempotencyKey)
    ) {
      return Response.json({ error: 'Invalid idempotency key' }, { status: 400 });
    }

    const amountKobo = normalizeAmountKobo(body?.amount);
    if (amountKobo === null || amountKobo < MIN_AMOUNT_KOBO) {
      return Response.json({ error: 'Minimum deposit is ₦1,000' }, { status: 400 });
    }
    if (amountKobo > MAX_AMOUNT_KOBO) {
      return Response.json({ error: 'Maximum deposit is ₦10,000,000' }, { status: 400 });
    }

    const couponId = normalizedCouponId(body?.couponId);
    if (body?.couponId != null && body.couponId !== '' && !couponId) {
      return Response.json({ error: 'Invalid coupon' }, { status: 400 });
    }

    const existing = await prisma.transaction.findUnique({
      where: { userId_idempotencyKey: { userId: user.id, idempotencyKey } },
    });
    if (existing) return replayExistingPayment(existing, { amountKobo, couponId });

    // Disabling the gateway blocks only new invoice creation. Existing rows
    // still replay above and GET/webhook/cron reconciliation remains active so
    // payments already sent cannot be stranded by an operational toggle.
    const apiKey = await getNowPaymentsCreationApiKey();
    if (!apiKey) {
      return Response.json({ error: 'Crypto payments are not available' }, { status: 503 });
    }

    const ngnPerUsd = await getNgnPerUsdRate();
    const usdCents = roundedUsdCents(amountKobo, ngnPerUsd);
    if (usdCents === null || usdCents < MIN_USD_CENTS) {
      const minimumNgn = Math.ceil((MIN_USD_CENTS / 100) * Number(ngnPerUsd));
      return Response.json({
        error: `Minimum for crypto is ~₦${minimumNgn.toLocaleString()} ($11 USD)`,
      }, { status: 400 });
    }

    const expectedPriceAmount = usdAmountFromCents(usdCents);
    const reference = paymentReference();
    const amountNgn = amountKobo / 100;
    const note = [
      `Crypto deposit ₦${amountNgn.toLocaleString()} ($${expectedPriceAmount} USD)`,
      couponId ? `[coupon:${couponId}]` : '',
    ].filter(Boolean).join(' ');

    let transaction;
    try {
      transaction = await prisma.transaction.create({
        data: {
          userId: user.id,
          type: 'deposit',
          amount: amountKobo,
          method: 'crypto',
          status: 'Pending',
          reference,
          idempotencyKey,
          note,
          providerPriceAmount: expectedPriceAmount,
          providerPriceCurrency: PRICE_CURRENCY,
          providerPayCurrency: PAY_CURRENCY,
        },
      });
    } catch (error) {
      if (!isUniqueConstraintError(error)) throw error;
      const raced = await prisma.transaction.findUnique({
        where: { userId_idempotencyKey: { userId: user.id, idempotencyKey } },
      });
      if (raced) return replayExistingPayment(raced, { amountKobo, couponId });
      throw error;
    }

    const origin = callbackOrigin(process.env.NEXT_PUBLIC_APP_URL);
    const providerResult = await postNowPaymentsInvoice({
      apiKey,
      payload: {
        price_amount: Number(expectedPriceAmount),
        price_currency: PRICE_CURRENCY,
        pay_currency: PAY_CURRENCY,
        order_id: reference,
        order_description: `Nitro deposit ${reference}`,
        ipn_callback_url: `${origin}/api/payments/crypto/webhook`,
      },
    });

    if (providerResult.state !== 'received') {
      const definitiveProviderRejection = Number.isInteger(providerResult.httpStatus)
        && providerResult.httpStatus >= 400
        && providerResult.httpStatus < 500
        && providerResult.httpStatus !== 408
        && providerResult.httpStatus !== 429;
      if (definitiveProviderRejection) {
        const failed = await prisma.transaction.updateMany({
          where: { id: transaction.id, status: 'Pending' },
          data: { status: 'Failed' },
        });
        transaction = failed.count > 0
          ? { ...transaction, status: 'Failed' }
          : await prisma.transaction.findUnique({ where: { id: transaction.id } }) || transaction;
      }
      log.warn('Crypto Payment Create', `${reference}: ${providerResult.reason}`);
      if (definitiveProviderRejection) {
        if (transaction.status !== 'Failed') {
          return Response.json(terminalReplayResponse(transaction));
        }
        return Response.json(
          rejectedCreationResponse(transaction, 'provider_rejected_creation'),
          { status: 422 },
        );
      }
      return Response.json(
        ambiguousCreationResponse(transaction, providerResult.reason),
        { status: 503, headers: { 'Retry-After': '15' } },
      );
    }

    const validation = validateNowPaymentsCreationResponse(providerResult.payload, {
      reference,
      expectedPriceAmount,
      expectedPriceCurrency: PRICE_CURRENCY,
      expectedPayCurrency: PAY_CURRENCY,
    });
    const observedAt = new Date();
    const binding = await bindCreationObservation(
      transaction,
      validation,
      expectedPriceAmount,
      observedAt,
    );
    const bound = binding.transaction;

    if (binding.bindingConflict) {
      const reviewed = await recordNowPaymentsReview({
        transaction: bound,
        reason: 'provider_payment_id_reused',
        details: creationReviewDetails(validation, expectedPriceAmount),
        now: observedAt,
      });
      return Response.json(terminalReplayResponse(reviewed), { status: 422 });
    }

    if (validation.state === 'review') {
      const reviewed = await recordNowPaymentsReview({
        transaction: bound,
        reason: validation.reason || 'creation_response_mismatch',
        details: creationReviewDetails(validation, expectedPriceAmount),
        now: observedAt,
      });
      return Response.json(terminalReplayResponse(reviewed), { status: 422 });
    }

    if (
      validation.state === 'created'
      && (
        hasOpenReview(bound)
        || ['Completed', 'Review', 'Cancelled', 'Expired', 'Failed', 'Refunded', 'Rejected'].includes(bound.status)
      )
    ) {
      return Response.json(terminalReplayResponse(bound));
    }

    if (validation.state !== 'created' || !bound.providerPaymentId) {
      if (!bound.providerPaymentId) {
        const reviewed = await recordNowPaymentsReview({
          transaction: bound,
          reason: 'creation_response_mismatch',
          details: {
            ...creationReviewDetails(validation, expectedPriceAmount),
            validationReason: validation.reason,
          },
          now: observedAt,
        });
        return Response.json(terminalReplayResponse(reviewed), { status: 422 });
      }
      log.warn('Crypto Payment Create', `${reference}: ${validation.reason}`);
      return Response.json(
        ambiguousCreationResponse(bound, validation.reason),
        { status: 503, headers: { 'Retry-After': '15' } },
      );
    }

    await bestEffortAttribution(req, user.id);
    return Response.json(instructionResponse(bound, {
      expiresAt: providerResult.payload?.expiration_estimate_date || null,
    }));
  } catch (error) {
    log.error('Crypto Payment Create', error.message);
    return Response.json({
      success: false,
      paymentState: 'retryable',
      retryable: true,
      message: 'Failed to create crypto payment',
      error: 'Failed to create crypto payment',
    }, { status: 503 });
  }
}

function statusResponse(outcome) {
  const transaction = outcome.transaction;
  const claimsCredit = outcome.paymentState === 'credited'
    || outcome.transactionStatus === 'Completed';
  const confirmedCredit = outcome.success === true
    && outcome.paymentState === 'credited'
    && outcome.transactionStatus === 'Completed'
    && transaction?.status === 'Completed'
    && !hasOpenReview(transaction);
  const completedReview = outcome.paymentState === 'review'
    && outcome.transactionStatus === 'Completed'
    && transaction?.status === 'Completed'
    && hasOpenReview(transaction);
  const inconsistentCredit = claimsCredit && !confirmedCredit && !completedReview;
  if (inconsistentCredit) {
    return Response.json({
      success: false,
      paymentState: 'retryable',
      status: transaction?.status || null,
      transactionStatus: transaction?.status || null,
      retryable: true,
      reason: 'inconsistent_financial_state',
      message: 'Payment status could not be confirmed. Please try again.',
      error: 'Payment status could not be confirmed. Please try again.',
      reference: transaction?.reference || null,
    }, { status: 503 });
  }

  const body = {
    success: confirmedCredit,
    paymentState: outcome.paymentState,
    status: outcome.transactionStatus,
    transactionStatus: outcome.transactionStatus,
    retryable: Boolean(outcome.retryable),
    reason: outcome.reason || null,
    message: outcome.message,
    reference: transaction?.reference || null,
    npStatus: outcome.providerStatus || transaction?.providerPaymentStatus || null,
    amount: transaction ? transaction.amount / 100 : null,
  };

  if (outcome.reason === 'not_found') {
    return Response.json({ ...body, error: outcome.message }, { status: 404 });
  }
  if (outcome.paymentState === 'retryable') {
    return Response.json({ ...body, error: outcome.message }, { status: 503 });
  }
  if (outcome.paymentState === 'verifying' || outcome.paymentState === 'provider_pending') {
    return Response.json(body, { status: 202 });
  }
  return Response.json(body);
}

function isConfirmedCreditedOutcome(outcome) {
  return outcome?.success === true
    && outcome?.paymentState === 'credited'
    && outcome?.transactionStatus === 'Completed'
    && outcome?.transaction?.status === 'Completed'
    && !hasOpenReview(outcome.transaction);
}

// GET — reconcile through an authoritative provider query, scoped to the user.
export async function GET(req) {
  try {
    const session = await getCurrentUser();
    if (!session) return Response.json({ error: 'Not authenticated' }, { status: 401 });

    const limit = await rateLimitForUser(req, session.id, 'verify', 12);
    if (limit.unavailable) return rateLimitUnavailableResponse(undefined, limit.retryAfter);
    if (limit.limited) {
      return rateLimitedResponse(
        'Too many verification attempts. Please wait a minute and try again.',
        limit.retryAfter,
      );
    }

    const reference = new URL(req.url).searchParams.get('reference')?.trim();
    if (!reference) return Response.json({ error: 'Reference required' }, { status: 400 });

    const outcome = await reconcileNowPaymentsDeposit({
      reference,
      userId: session.id,
    });

    if (
      outcome.newlyFinalized
      && outcome.finalization
      && isConfirmedCreditedOutcome(outcome)
    ) {
      try {
        const { fbp, fbc } = parseFbCookies(req.headers.get('cookie'));
        await notifyDepositFinalized(outcome.finalization, {
          channel: 'Crypto',
          clientIp: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
            || req.headers.get('x-real-ip'),
          userAgent: req.headers.get('user-agent'),
          fbp,
          fbc,
          sourceUrl: req.headers.get('referer'),
        });
      } catch (notifyError) {
        log.warn('Crypto Payment Check', `Deposit notification failed: ${notifyError.message}`);
      }
    }

    return statusResponse(outcome);
  } catch (error) {
    log.error('Crypto Payment Check', error.message);
    return Response.json({
      success: false,
      paymentState: 'retryable',
      retryable: true,
      message: 'Payment verification is temporarily unavailable. Please try again.',
      error: 'Payment verification is temporarily unavailable. Please try again.',
    }, { status: 503 });
  }
}

// DELETE — cancel the UI attempt without deleting provider/audit evidence.
export async function DELETE(req) {
  try {
    const session = await getCurrentUser();
    if (!session) return Response.json({ error: 'Not authenticated' }, { status: 401 });

    const limit = await rateLimitForUser(req, session.id, 'cancel', 12);
    if (limit.unavailable) return rateLimitUnavailableResponse(undefined, limit.retryAfter);
    if (limit.limited) {
      return rateLimitedResponse(
        'Too many cancellation attempts. Please try again in a minute.',
        limit.retryAfter,
      );
    }

    let body;
    try {
      body = await req.json();
    } catch {
      return Response.json({ error: 'Invalid request' }, { status: 400 });
    }
    const reference = typeof body?.reference === 'string' ? body.reference.trim() : '';
    if (!reference) return Response.json({ error: 'Reference required' }, { status: 400 });

    let transaction = await prisma.transaction.findFirst({
      where: {
        reference,
        userId: session.id,
        type: 'deposit',
        method: 'crypto',
      },
    });
    if (!transaction) return Response.json({ error: 'Transaction not found' }, { status: 404 });

    if (transaction.status === 'Completed') {
      return Response.json(terminalReplayResponse(transaction), { status: 409 });
    }
    if (transaction.status === 'Review' || hasOpenReview(transaction)) {
      return Response.json(terminalReplayResponse(transaction));
    }

    await prisma.transaction.updateMany({
      where: {
        id: transaction.id,
        type: 'deposit',
        method: 'crypto',
        status: { in: ['Pending', 'Processing'] },
      },
      data: { status: 'Cancelled' },
    });
    transaction = await prisma.transaction.findUnique({ where: { id: transaction.id } });

    if (!transaction) {
      return Response.json({ error: 'Transaction not found' }, { status: 404 });
    }
    if (transaction.status === 'Completed') {
      return Response.json(terminalReplayResponse(transaction));
    }
    if (transaction.status !== 'Cancelled') {
      return Response.json(terminalReplayResponse(transaction));
    }

    return Response.json({
      success: true,
      paymentState: paymentStateFor(transaction),
      status: transaction.status,
      transactionStatus: transaction.status,
      retryable: false,
      reference: transaction.reference,
    });
  } catch (error) {
    log.error('Crypto Payment Cancel', error.message);
    return Response.json({ error: 'Failed to cancel' }, { status: 500 });
  }
}
