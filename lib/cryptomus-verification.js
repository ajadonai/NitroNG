import crypto from 'crypto';
import {
  canonicalizeNonNegativeDecimal,
  compareDecimalToScaled,
  compareNonNegativeDecimals,
} from '@/lib/decimal-amounts';


/**
 * Cryptomus request signing and webhook verification.
 *
 * One scheme covers both directions: md5(base64(json_body) + API_KEY). There is
 * no separate webhook secret the way NOWPayments had an IPN secret, so the
 * payment API key is the only credential, and leaking it would let anyone forge
 * a "paid" callback into our wallet crediting path. It is never logged here and
 * never returned in an error.
 *
 * Verified against the live API on 12 Oct 2026 before any of this was wired in:
 * a signed call to /v1/payment/services returned 102 services, and invoices
 * created in both NGN and USD were accepted. We invoice in USD: see the pricing
 * note in app/api/payments/crypto/route.js for why that is not interchangeable.
 */

export const CRYPTOMUS_API_BASE = 'https://api.cryptomus.com';

/**
 * How far over the invoice a payment may land and still credit itself.
 *
 * Cryptomus reports *any* overpayment as `paid_over`, down to a single cent,
 * and its merchant-side payment accuracy setting only forgives the short side.
 * Without a tolerance here, a customer who rounds $17.31 up to $18, or pays
 * from a wallet that will not send an exact figure, waits in the admin approval
 * queue despite having sent more than we asked for. That is the common case,
 * and it was turning an instant deposit method into a manual one.
 *
 * Only dust is auto-credited. A genuinely large overpayment still needs a
 * person, because someone who sent double wants it refunded rather than
 * silently kept as wallet credit.
 *
 * As two integers rather than 1.05, so the comparison never touches a float.
 */
const OVERPAYMENT_TOLERANCE_NUMERATOR = 105;
const OVERPAYMENT_TOLERANCE_DENOMINATOR = 100;

/**
 * The signature covers the exact JSON string that is transmitted, not a
 * re-serialisation of it. Signing a different string than the one sent is the
 * classic way this breaks: key ordering or whitespace differs, the hash differs,
 * and Cryptomus rejects every request with no indication of why.
 */
export function cryptomusSign(bodyString, apiKey) {
  if (typeof bodyString !== 'string') throw new Error('Cryptomus sign requires the exact body string');
  if (!apiKey) throw new Error('Cryptomus API key is required to sign');
  return crypto.createHash('md5').update(Buffer.from(bodyString).toString('base64') + apiKey).digest('hex');
}

/**
 * An empty body still signs, as md5(base64('') + key). Their docs call this out
 * explicitly, and endpoints like /v1/payment/services take no parameters.
 */
export function cryptomusEmptySign(apiKey) {
  return cryptomusSign('{}', apiKey);
}

/**
 * Verify an inbound webhook.
 *
 * The sign is carried inside the payload it signs, so it has to come out before
 * the hash is recomputed. Comparison is constant time: a byte-by-byte early
 * return leaks how much of a forged signature was correct, which is enough to
 * recover a valid one over many attempts against an endpoint that, by design,
 * anyone on the internet can reach.
 */
export function verifyCryptomusWebhook(payload, apiKey) {
  if (!payload || typeof payload !== 'object') return false;
  if (!apiKey) return false;

  const received = payload.sign;
  if (typeof received !== 'string' || received.length === 0) return false;

  const { sign, ...rest } = payload;
  const expected = cryptomusSign(JSON.stringify(rest), apiKey);

  const a = Buffer.from(expected, 'utf8');
  const b = Buffer.from(received, 'utf8');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

/**
 * Cryptomus payment statuses, mapped onto the states this codebase already
 * uses. The mapping deliberately mirrors what NOWPayments did for the cases
 * that exist in both, so switching providers does not quietly change what
 * happens to a customer's money.
 *
 * Over and underpayment both go to review rather than auto-crediting, which is
 * the behaviour that was already here. `locked` has no NOWPayments equivalent:
 * it is Cryptomus holding funds for their own AML check, and it is treated as
 * review because the money is neither lost nor available.
 */
export const CRYPTOMUS_STATUS_MAP = Object.freeze({
  paid: { state: 'credited', terminal: true },
  paid_over: { state: 'review', reason: 'overpayment', terminal: true },
  wrong_amount: { state: 'review', reason: 'underpayment', terminal: true },
  wrong_amount_waiting: { state: 'review', reason: 'underpayment', terminal: false },

  process: { state: 'provider_pending', terminal: false },
  check: { state: 'provider_pending', terminal: false },
  confirm_check: { state: 'provider_pending', terminal: false },

  cancel: { state: 'failed', reason: 'cancelled', terminal: true },
  fail: { state: 'failed', reason: 'failed', terminal: true },
  system_fail: { state: 'failed', reason: 'system_fail', terminal: true },

  locked: { state: 'review', reason: 'locked', terminal: false },

  // Refunds get their own state rather than collapsing into review. The
  // orchestration treats them differently depending on whether the wallet was
  // already credited: a refund before crediting is simply terminal, while a
  // refund after crediting means money left on both sides and needs manual
  // recovery. Flattening the two loses that distinction.
  refund_process: { state: 'refunded', reason: 'refunded', terminal: false },
  refund_paid: { state: 'refunded', reason: 'refunded', terminal: true },
  refund_fail: { state: 'refunded', reason: 'refunded', terminal: true },
});

/**
 * An unmapped status is treated as pending rather than failed. Cryptomus can
 * add statuses without warning, and the cost of the two mistakes is not
 * symmetric: holding a payment that actually succeeded is recoverable by the
 * reconciliation cron, while failing one that is still in flight tells a
 * customer their money is gone while it is still moving.
 */
export function classifyCryptomusStatus(status) {
  const key = String(status || '').toLowerCase();
  const hit = CRYPTOMUS_STATUS_MAP[key];
  if (hit) return { ...hit, providerStatus: key, known: true };
  return { state: 'provider_pending', terminal: false, providerStatus: key, known: false };
}

// ── Provider adapter ────────────────────────────────────────────
// Everything below mirrors the defensive posture of the NOWPayments module it
// replaces. The orchestration in lib/crypto-deposit.js credits real wallets
// from whatever these functions return, so each one fails closed.

const DEFAULT_TIMEOUT_MS = 15_000;
const MAX_TIMEOUT_MS = 30_000;
const MAX_UUID_LENGTH = 64;
const MAX_REFERENCE_LENGTH = 100; // Cryptomus caps order_id at 100 chars

function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function classification(state, reason, details = {}) {
  return { state, reason, ...details };
}

/**
 * Cryptomus identifies an invoice by a UUID it mints. Unlike NOWPayments'
 * numeric payment id, this is the only provider side handle, so it is held to
 * a strict shape rather than accepted as any string.
 */
export function normalizeCryptomusProviderId(value) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > MAX_UUID_LENGTH) return null;
  return /^[0-9a-fA-F-]{8,64}$/.test(trimmed) ? trimmed.toLowerCase() : null;
}

function validReference(value) {
  return typeof value === 'string'
    && value.length > 0
    && value.length <= MAX_REFERENCE_LENGTH;
}

function normalizedStatus(value) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim().toLowerCase();
  return trimmed || null;
}

/**
 * The fields we care about, pulled out of a Cryptomus payload once so every
 * branch below reasons over the same normalised view.
 *
 * `status` and `payment_status` carry the same vocabulary; Cryptomus populates
 * `payment_status` on invoice reads and `status` on webhooks, so either is
 * accepted and whichever is present wins.
 */
function payloadBase(payload) {
  return {
    providerStatus: normalizedStatus(payload?.payment_status) || normalizedStatus(payload?.status),
    uuid: normalizeCryptomusProviderId(payload?.uuid),
    reference: typeof payload?.order_id === 'string' ? payload.order_id : null,
    invoiceAmount: canonicalizeNonNegativeDecimal(payload?.amount),
    invoiceCurrency: normalizedStatus(payload?.currency),
    paymentAmount: canonicalizeNonNegativeDecimal(payload?.payment_amount),
    merchantAmount: canonicalizeNonNegativeDecimal(payload?.merchant_amount),
    payerAmount: canonicalizeNonNegativeDecimal(payload?.payer_amount),
    payerCurrency: normalizedStatus(payload?.payer_currency),
    txid: typeof payload?.txid === 'string' ? payload.txid : null,
    isFinal: payload?.is_final === true,

    // Canonical aliases. The deposit orchestration and the Transaction columns
    // predate Cryptomus and speak price/pay/actuallyPaid, so the adapter answers
    // in that vocabulary too rather than making the shared code learn a second
    // provider's field names.
    //   price*  = what we invoiced, in USD
    //   pay*    = what the customer sends, in whichever coin they chose
    //   actuallyPaid = what actually landed
    priceAmount: canonicalizeNonNegativeDecimal(payload?.amount),
    priceCurrency: normalizedStatus(payload?.currency),
    payAmount: canonicalizeNonNegativeDecimal(payload?.payer_amount),
    payCurrency: normalizedStatus(payload?.payer_currency),
    actuallyPaid: canonicalizeNonNegativeDecimal(payload?.payment_amount),
  };
}

/**
 * Validate the response to invoice creation before anything is stored against
 * the transaction.
 *
 * A creation response we cannot trust is treated as ambiguous rather than
 * failed, because Cryptomus may have created the invoice even if we cannot read
 * the reply. Marking it failed would let the customer create a second invoice
 * and pay the wrong one.
 */
export function validateCryptomusCreationResponse(payload, { reference, expectedAmount, expectedCurrency } = {}) {
  if (!isRecord(payload)) return classification('ambiguous', 'malformed_response');
  if (Number(payload.state) !== 0) {
    return classification('rejected', 'provider_rejected', { providerMessage: payload.message ?? null });
  }

  const result = payload.result;
  if (!isRecord(result)) return classification('ambiguous', 'malformed_result');

  const base = payloadBase(result);
  if (!base.uuid) return classification('ambiguous', 'invalid_uuid', base);
  if (!validReference(base.reference)) return classification('ambiguous', 'invalid_reference', base);
  if (reference && base.reference !== reference) {
    return classification('review', 'reference_mismatch', base);
  }

  // The invoiced amount is the figure the wallet is eventually credited for, so
  // a mismatch here is never accepted quietly.
  const expected = canonicalizeNonNegativeDecimal(expectedAmount);
  if (expected !== null) {
    if (base.invoiceAmount === null) return classification('ambiguous', 'malformed_amount', base);
    if (base.invoiceAmount !== expected) return classification('review', 'amount_mismatch', base);
  }
  if (expectedCurrency && base.invoiceCurrency !== String(expectedCurrency).toLowerCase()) {
    return classification('review', 'currency_mismatch', base);
  }

  if (typeof result.url !== 'string' || !result.url.startsWith('https://')) {
    return classification('ambiguous', 'missing_payment_url', base);
  }

  return classification('created', 'provider_created', { ...base, url: result.url, addressQrCode: result.address_qr_code ?? null, expiredAt: result.expired_at ?? null });
}

/**
 * Classify a payment read, from either a webhook body or /v1/payment/info.
 *
 * Cryptomus decides the over and underpayment question itself and reports the
 * verdict in the status, which is less work than NOWPayments where we compared
 * amounts ourselves. What is still ours to check is that the invoice we are
 * reading is the one we expect: the right order, the right uuid, the right
 * amount in the right currency. Without those checks a payment for ₦500 could
 * be matched against a ₦50,000 deposit.
 */
export function classifyCryptomusStatusResponse(payload, { uuid, reference, expectedAmount, expectedCurrency } = {}) {
  if (!isRecord(payload)) return classification('retryable', 'malformed_response');

  const base = payloadBase(payload);
  if (!base.providerStatus) return classification('retryable', 'malformed_provider_status', base);

  if (!validReference(reference)) return classification('retryable', 'invalid_expectation', base);
  if (!validReference(base.reference)) return classification('retryable', 'invalid_reference', base);
  if (base.reference !== reference) return classification('review', 'order_id_mismatch', base);

  // uuid is only compared when we already hold one. On the first read after a
  // creation we may legitimately not, and adopting it then is correct.
  const expectedUuid = normalizeCryptomusProviderId(uuid);
  if (expectedUuid) {
    if (!base.uuid) return classification('retryable', 'invalid_uuid', base);
    if (base.uuid !== expectedUuid) return classification('review', 'payment_id_mismatch', base);
  }

  const expected = canonicalizeNonNegativeDecimal(expectedAmount);
  if (expected !== null) {
    if (base.invoiceAmount === null) return classification('retryable', 'malformed_amount', base);
    if (base.invoiceAmount !== expected) return classification('review', 'amount_mismatch', base);
  }
  if (expectedCurrency && base.invoiceCurrency && base.invoiceCurrency !== String(expectedCurrency).toLowerCase()) {
    return classification('review', 'currency_mismatch', base);
  }

  const mapped = classifyCryptomusStatus(base.providerStatus);

  // An unmapped status is retryable rather than failed, so a status Cryptomus
  // adds later makes the reconciliation cron look again instead of telling a
  // customer their money is gone while it is still moving.
  if (!mapped.known) return classification('retryable', 'unknown_provider_status', base);

  if (mapped.state === 'credited') {
    // Guard the one case the status alone does not cover: "paid" with nothing
    // actually recorded as received.
    if (base.paymentAmount !== null && compareNonNegativeDecimals(base.paymentAmount, '0') !== 1) {
      return classification('review', 'non_positive_payment_amount', base);
    }
    return classification('verified', 'provider_verified', base);
  }
  if (mapped.state === 'provider_pending') return classification('provider_pending', 'provider_pending', base);
  if (mapped.state === 'failed') return classification('provider_failed', mapped.reason || 'provider_failed', base);
  if (mapped.state === 'refunded') return classification('refunded', 'provider_refunded', base);

  // A dust overpayment credits itself. See OVERPAYMENT_TOLERANCE_NUMERATOR.
  //
  // Both figures are already in the payer's own coin — payerAmount is what
  // Cryptomus asked them to send, paymentAmount is what arrived — so the ratio
  // involves no exchange rate and cannot be thrown off by a stale one.
  //
  // Every uncertain path falls through to review on purpose. A missing field, a
  // zero request, an unparseable amount, or those two fields not meaning what
  // this reads them to mean all land back in the approval queue, which is where
  // this case sits today. Being wrong here must cost a manual check and can
  // never cost a wrong credit: the amount credited is the naira on the
  // transaction row and is never computed from these numbers.
  if (mapped.reason === 'overpayment') {
    const requested = base.payerAmount;
    const landed = base.paymentAmount;
    // Every comparison is checked against its exact expected value rather than
    // with a relational operator, because these helpers return null for input
    // they cannot parse and `null <= 0` is true. A loose `<= 0` here would turn
    // "I could not read this amount" into "credit it".
    const ceiling = requested !== null && landed !== null
      ? compareDecimalToScaled(
        landed,
        requested,
        OVERPAYMENT_TOLERANCE_NUMERATOR,
        OVERPAYMENT_TOLERANCE_DENOMINATOR,
      )
      : null;
    const atLeastRequested = requested !== null && landed !== null
      ? compareNonNegativeDecimals(landed, requested)
      : null;
    if (
      compareNonNegativeDecimals(requested, '0') === 1
      && (atLeastRequested === 0 || atLeastRequested === 1)
      && (ceiling === -1 || ceiling === 0)
    ) {
      return classification('verified', 'provider_verified_overpaid_dust', base);
    }
  }

  return classification('review', mapped.reason || 'provider_review', base);
}

function boundedTimeout(value) {
  if (!Number.isFinite(value)) return DEFAULT_TIMEOUT_MS;
  return Math.min(MAX_TIMEOUT_MS, Math.max(1, Math.ceil(value)));
}

/**
 * Read a payment back from Cryptomus.
 *
 * Looks up by our own order_id rather than their uuid wherever possible.
 * Cryptomus gives order_id precedence when both are sent, and it is the
 * identifier we control, which removes the whole class of "we never stored the
 * provider id so we cannot reconcile" problems the previous integration needed
 * legacy note parsing to work around.
 */
export async function fetchCryptomusPayment({
  reference,
  uuid,
  merchantId,
  apiKey,
  fetchImpl = globalThis.fetch,
  timeoutMs,
} = {}) {
  if (typeof fetchImpl !== 'function') return { state: 'retryable', reason: 'transport_unavailable' };
  if (!merchantId || !apiKey) return { state: 'retryable', reason: 'missing_credentials' };

  const query = {};
  if (validReference(reference)) query.order_id = reference;
  const normalizedUuid = normalizeCryptomusProviderId(uuid);
  if (normalizedUuid) query.uuid = normalizedUuid;
  if (!query.order_id && !query.uuid) return { state: 'retryable', reason: 'missing_identifier' };

  const body = JSON.stringify(query);
  const controller = new AbortController();
  let timer;

  const request = (async () => {
    try {
      const response = await fetchImpl(`${CRYPTOMUS_API_BASE}/v1/payment/info`, {
        method: 'POST',
        headers: {
          merchant: merchantId,
          sign: cryptomusSign(body, apiKey),
          'Content-Type': 'application/json',
        },
        body,
        signal: controller.signal,
      });

      let parsed = null;
      try {
        parsed = await response.json();
      } catch {
        return { state: 'retryable', reason: 'malformed_json' };
      }

      if (!response.ok) {
        return { state: 'retryable', reason: 'provider_http_error', httpStatus: response.status, payload: parsed };
      }
      if (!isRecord(parsed) || Number(parsed.state) !== 0) {
        // state 1 with "not found" means this invoice does not exist on their
        // side at all, which is a real answer rather than a transport problem.
        const message = String(parsed?.message || '').toLowerCase();
        if (message.includes('not found')) return { state: 'not_found', reason: 'provider_not_found', payload: parsed };
        return { state: 'retryable', reason: 'provider_error', payload: parsed };
      }
      return { state: 'received', payload: parsed.result };
    } catch (error) {
      return {
        state: 'retryable',
        reason: error?.name === 'AbortError' ? 'timeout' : 'transport_error',
      };
    }
  })();

  // Raced rather than relying on the abort signal alone. A fetch that ignores
  // AbortSignal would otherwise hang this call forever while holding the
  // provider query lease, which blocks every later attempt on the same deposit.
  const timeout = new Promise(resolve => {
    timer = setTimeout(() => {
      controller.abort();
      resolve({ state: 'retryable', reason: 'timeout' });
    }, boundedTimeout(timeoutMs));
  });

  try {
    return await Promise.race([request, timeout]);
  } finally {
    clearTimeout(timer);
  }
}
