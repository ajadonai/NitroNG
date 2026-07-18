import { createHmac, timingSafeEqual } from 'node:crypto';

const NOWPAYMENTS_URL = 'https://api.nowpayments.io/v1';
const DEFAULT_TIMEOUT_MS = 10_000;
const MAX_TIMEOUT_MS = 30_000;
const MAX_PROVIDER_ID_LENGTH = 128;
const MAX_DECIMAL_INPUT_LENGTH = 512;
const MAX_DECIMAL_EXPONENT = 1_024;
const MAX_CANONICAL_DECIMAL_LENGTH = 2_048;
const MAX_DECIMAL_PRECISION = 36;
const MAX_DECIMAL_SCALE = 18;

const TRUSTED_INITIAL_STATUSES = new Set(['waiting']);
const VERIFIED_STATUSES = new Set(['confirmed', 'finished']);
const PROVIDER_PENDING_STATUSES = new Set(['waiting', 'confirming', 'sending', 'spending']);
const PROVIDER_FAILED_STATUSES = new Set(['failed', 'expired', 'cancelled']);
const REFUNDED_STATUSES = new Set(['refunded']);
const REVIEW_STATUSES = new Set([
  'partial',
  'partially_paid',
  'underpaid',
  'under_paid',
  'overpaid',
  'over_paid',
  'repeated',
  'wrong_asset',
]);
const KNOWN_STATUSES = new Set([
  ...VERIFIED_STATUSES,
  ...PROVIDER_PENDING_STATUSES,
  ...PROVIDER_FAILED_STATUSES,
  ...REFUNDED_STATUSES,
  ...REVIEW_STATUSES,
]);

function result(state, reason, details = {}) {
  return { state, reason, ...details };
}

function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function validExactToken(value, maxLength = 64) {
  return typeof value === 'string'
    && value.length > 0
    && value.length <= maxLength
    && value === value.trim()
    && /^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(value);
}

function validReference(value) {
  return validExactToken(value, 200);
}

function validAddress(value) {
  return typeof value === 'string'
    && value.length > 0
    && value.length <= 512
    && value === value.trim()
    && !/[\u0000-\u001f\u007f]/.test(value);
}

function normalizedProviderStatus(value) {
  if (typeof value !== 'string') return null;
  const status = value.trim().toLowerCase();
  return status && /^[a-z_]+$/.test(status) ? status : null;
}

function hasParentPayment(value) {
  return value !== undefined && value !== null && value !== '';
}

function reviewReasonForProviderStatus(providerStatus) {
  if (providerStatus === 'partial' || providerStatus === 'partially_paid') return 'partially_paid';
  if (providerStatus === 'underpaid' || providerStatus === 'under_paid') return 'underpayment';
  if (providerStatus === 'overpaid' || providerStatus === 'over_paid') return 'overpayment';
  if (providerStatus === 'repeated') return 'repeated_payment';
  if (providerStatus === 'wrong_asset') return 'wrong_asset';
  return 'provider_review';
}

export function normalizeNowPaymentsProviderId(value) {
  let normalized;
  if (typeof value === 'string') {
    normalized = value.trim();
  } else if (typeof value === 'number') {
    if (!Number.isSafeInteger(value) || value < 0) return null;
    normalized = String(value);
  } else if (typeof value === 'bigint') {
    if (value < 0n) return null;
    normalized = value.toString();
  } else {
    return null;
  }

  if (
    normalized.length === 0
    || normalized.length > MAX_PROVIDER_ID_LENGTH
    || !/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(normalized)
  ) {
    return null;
  }
  return normalized;
}

function decimalLikeString(value) {
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number') {
    return Number.isFinite(value) && value >= 0 ? String(value) : null;
  }
  if (typeof value === 'bigint') return value >= 0n ? value.toString() : null;
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;

  try {
    const prototype = Object.getPrototypeOf(value);
    if (!prototype || prototype === Object.prototype) return null;
    const constructorName = String(value.constructor?.name || '');
    const tag = String(value[Symbol.toStringTag] || '');
    if (!/decimal/i.test(constructorName) && !/decimal/i.test(tag)) return null;
    if (typeof value.toString !== 'function') return null;
    const rendered = value.toString();
    return typeof rendered === 'string' ? rendered.trim() : null;
  } catch {
    return null;
  }
}

export function canonicalizeNonNegativeDecimal(value) {
  const source = decimalLikeString(value);
  if (!source || source.length > MAX_DECIMAL_INPUT_LENGTH) return null;

  const match = source.match(/^\+?(?:(\d+)(?:\.(\d*))?|\.(\d+))(?:[eE]([+-]?\d+))?$/);
  if (!match) return null;

  const integerDigits = match[1] ?? '0';
  const fractionDigits = match[1] !== undefined ? (match[2] || '') : match[3];
  const exponentText = match[4] || '0';
  if (exponentText.replace(/^[+-]?0*/, '').length > 4) return null;
  const exponent = Number(exponentText);
  if (!Number.isSafeInteger(exponent) || Math.abs(exponent) > MAX_DECIMAL_EXPONENT) return null;

  const allDigits = `${integerDigits}${fractionDigits}`;
  const decimalPosition = integerDigits.length + exponent;
  let expanded;
  if (decimalPosition <= 0) {
    expanded = `0.${'0'.repeat(-decimalPosition)}${allDigits}`;
  } else if (decimalPosition >= allDigits.length) {
    expanded = `${allDigits}${'0'.repeat(decimalPosition - allDigits.length)}`;
  } else {
    expanded = `${allDigits.slice(0, decimalPosition)}.${allDigits.slice(decimalPosition)}`;
  }
  if (expanded.length > MAX_CANONICAL_DECIMAL_LENGTH) return null;

  const [rawInteger, rawFraction = ''] = expanded.split('.');
  const canonicalInteger = rawInteger.replace(/^0+(?=\d)/, '') || '0';
  const canonicalFraction = rawFraction.replace(/0+$/, '');
  const canonicalIntegerDigits = canonicalInteger === '0' ? 0 : canonicalInteger.length;
  if (
    canonicalIntegerDigits > MAX_DECIMAL_PRECISION - MAX_DECIMAL_SCALE
    || canonicalFraction.length > MAX_DECIMAL_SCALE
    || canonicalIntegerDigits + canonicalFraction.length > MAX_DECIMAL_PRECISION
  ) {
    return null;
  }
  return canonicalFraction ? `${canonicalInteger}.${canonicalFraction}` : canonicalInteger;
}

export function compareNonNegativeDecimals(left, right) {
  const canonicalLeft = canonicalizeNonNegativeDecimal(left);
  const canonicalRight = canonicalizeNonNegativeDecimal(right);
  if (canonicalLeft === null || canonicalRight === null) return null;
  if (canonicalLeft === canonicalRight) return 0;

  const [leftInteger, leftFraction = ''] = canonicalLeft.split('.');
  const [rightInteger, rightFraction = ''] = canonicalRight.split('.');
  if (leftInteger.length !== rightInteger.length) {
    return leftInteger.length < rightInteger.length ? -1 : 1;
  }
  if (leftInteger !== rightInteger) return leftInteger < rightInteger ? -1 : 1;

  const fractionLength = Math.max(leftFraction.length, rightFraction.length);
  const paddedLeft = leftFraction.padEnd(fractionLength, '0');
  const paddedRight = rightFraction.padEnd(fractionLength, '0');
  if (paddedLeft === paddedRight) return 0;
  return paddedLeft < paddedRight ? -1 : 1;
}

export function equalNonNegativeDecimals(left, right) {
  return compareNonNegativeDecimals(left, right) === 0;
}

function creationBase(payload, providerStatus, overrides = {}) {
  return {
    providerStatus,
    paymentId: normalizeNowPaymentsProviderId(payload?.payment_id),
    reference: typeof payload?.order_id === 'string' ? payload.order_id : null,
    priceAmount: canonicalizeNonNegativeDecimal(payload?.price_amount),
    priceCurrency: typeof payload?.price_currency === 'string' ? payload.price_currency : null,
    payAmount: canonicalizeNonNegativeDecimal(payload?.pay_amount),
    payCurrency: typeof payload?.pay_currency === 'string' ? payload.pay_currency : null,
    payAddress: typeof payload?.pay_address === 'string' ? payload.pay_address : null,
    ...overrides,
  };
}

export function validateNowPaymentsCreationResponse(payload, {
  reference,
  expectedPriceAmount,
  expectedPriceCurrency,
  expectedPayCurrency,
} = {}) {
  if (!isRecord(payload)) return result('retryable', 'malformed_response');

  const expectedPrice = canonicalizeNonNegativeDecimal(expectedPriceAmount);
  if (
    !validReference(reference)
    || expectedPrice === null
    || !validExactToken(expectedPriceCurrency)
    || !validExactToken(expectedPayCurrency)
  ) {
    return result('retryable', 'invalid_expectation');
  }

  const providerStatus = normalizedProviderStatus(payload.payment_status);
  const base = creationBase(payload, providerStatus);
  if (!providerStatus) return result('retryable', 'malformed_provider_status', base);
  if (!base.paymentId) return result('retryable', 'invalid_payment_id', base);
  if (!validReference(payload.order_id)) return result('retryable', 'invalid_reference', base);
  if (payload.order_id !== reference) return result('review', 'order_id_mismatch', base);
  if (hasParentPayment(payload.parent_payment_id)) return result('review', 'repeated_payment', base);

  if (base.priceAmount === null) return result('retryable', 'malformed_price_amount', base);
  if (base.priceAmount !== expectedPrice) return result('review', 'price_amount_mismatch', base);
  if (!validExactToken(payload.price_currency)) {
    return result('retryable', 'malformed_price_currency', base);
  }
  if (payload.price_currency !== expectedPriceCurrency) {
    return result('review', 'price_currency_mismatch', base);
  }

  if (!validExactToken(payload.pay_currency)) {
    return result('retryable', 'malformed_pay_currency', base);
  }
  if (payload.pay_currency !== expectedPayCurrency) {
    return result('review', 'pay_currency_mismatch', base);
  }
  if (base.payAmount === null) return result('retryable', 'malformed_pay_amount', base);
  if (compareNonNegativeDecimals(base.payAmount, '0') !== 1) {
    return result('retryable', 'non_positive_pay_amount', base);
  }
  if (!validAddress(payload.pay_address)) return result('retryable', 'invalid_pay_address', base);

  if (!KNOWN_STATUSES.has(providerStatus)) {
    return result('retryable', 'unknown_provider_status', base);
  }
  if (!TRUSTED_INITIAL_STATUSES.has(providerStatus)) {
    return result('review', 'untrusted_initial_status', base);
  }
  return result('created', 'provider_payment_created', base);
}

function statusBase(payload, providerStatus, overrides = {}) {
  return {
    providerStatus,
    paymentId: normalizeNowPaymentsProviderId(payload?.payment_id),
    reference: typeof payload?.order_id === 'string' ? payload.order_id : null,
    priceAmount: canonicalizeNonNegativeDecimal(payload?.price_amount),
    priceCurrency: typeof payload?.price_currency === 'string' ? payload.price_currency : null,
    payAmount: canonicalizeNonNegativeDecimal(payload?.pay_amount),
    payCurrency: typeof payload?.pay_currency === 'string' ? payload.pay_currency : null,
    actuallyPaid: canonicalizeNonNegativeDecimal(payload?.actually_paid),
    legacyPayAmountAdopted: false,
    ...overrides,
  };
}

export function classifyNowPaymentsStatusResponse(payload, {
  paymentId,
  reference,
  expectedPriceAmount,
  expectedPriceCurrency,
  expectedPayAmount,
  expectedPayCurrency,
} = {}) {
  if (!isRecord(payload)) return result('retryable', 'malformed_response');

  const normalizedExpectedId = normalizeNowPaymentsProviderId(paymentId);
  const expectedPrice = canonicalizeNonNegativeDecimal(expectedPriceAmount);
  const legacyPayAmount = expectedPayAmount === null;
  const normalizedExpectedPay = legacyPayAmount
    ? null
    : canonicalizeNonNegativeDecimal(expectedPayAmount);
  if (
    !normalizedExpectedId
    || !validReference(reference)
    || expectedPrice === null
    || !validExactToken(expectedPriceCurrency)
    || (!legacyPayAmount && normalizedExpectedPay === null)
    || !validExactToken(expectedPayCurrency)
  ) {
    return result('retryable', 'invalid_expectation');
  }

  const providerStatus = normalizedProviderStatus(payload.payment_status);
  let base = statusBase(payload, providerStatus);
  if (!providerStatus) return result('retryable', 'malformed_provider_status', base);
  if (!base.paymentId) return result('retryable', 'invalid_payment_id', base);
  if (base.paymentId !== normalizedExpectedId) {
    return result('review', 'payment_id_mismatch', base);
  }
  if (!validReference(payload.order_id)) return result('retryable', 'invalid_reference', base);
  if (payload.order_id !== reference) return result('review', 'order_id_mismatch', base);
  if (hasParentPayment(payload.parent_payment_id)) return result('review', 'repeated_payment', base);

  if (base.priceAmount === null) return result('retryable', 'malformed_price_amount', base);
  if (base.priceAmount !== expectedPrice) return result('review', 'price_amount_mismatch', base);
  if (!validExactToken(payload.price_currency)) {
    return result('retryable', 'malformed_price_currency', base);
  }
  if (payload.price_currency !== expectedPriceCurrency) {
    return result('review', 'price_currency_mismatch', base);
  }
  if (!validExactToken(payload.pay_currency)) {
    return result('retryable', 'malformed_pay_currency', base);
  }
  if (payload.pay_currency !== expectedPayCurrency) {
    return result('review', 'pay_currency_mismatch', base);
  }

  if (base.payAmount === null) return result('retryable', 'malformed_pay_amount', base);
  if (compareNonNegativeDecimals(base.payAmount, '0') !== 1) {
    return result('retryable', 'non_positive_pay_amount', base);
  }
  if (!legacyPayAmount && base.payAmount !== normalizedExpectedPay) {
    return result('review', 'pay_amount_mismatch', base);
  }
  if (legacyPayAmount) {
    base = { ...base, legacyPayAmountAdopted: true };
  }

  if (!KNOWN_STATUSES.has(providerStatus)) {
    return result('retryable', 'unknown_provider_status', base);
  }
  if (VERIFIED_STATUSES.has(providerStatus)) {
    if (
      payload.actually_paid === undefined
      || payload.actually_paid === null
      || payload.actually_paid === ''
    ) {
      return result('review', 'missing_actual_amount', base);
    }
    if (base.actuallyPaid === null) {
      return result('retryable', 'malformed_actually_paid', base);
    }
    const paidComparison = compareNonNegativeDecimals(base.actuallyPaid, base.payAmount);
    if (paidComparison < 0) return result('review', 'underpayment', base);
    if (paidComparison > 0) return result('review', 'overpayment', base);
    return result('verified', 'provider_verified', base);
  }
  if (PROVIDER_PENDING_STATUSES.has(providerStatus)) {
    return result('provider_pending', 'provider_pending', base);
  }
  if (PROVIDER_FAILED_STATUSES.has(providerStatus)) {
    return result('provider_failed', 'provider_failed', base);
  }
  if (REFUNDED_STATUSES.has(providerStatus)) {
    return result('refunded', 'provider_refunded', base);
  }
  return result('review', reviewReasonForProviderStatus(providerStatus), base);
}

function boundedTimeout(value) {
  if (!Number.isFinite(value)) return DEFAULT_TIMEOUT_MS;
  return Math.min(MAX_TIMEOUT_MS, Math.max(1, Math.ceil(value)));
}

export async function fetchNowPaymentsPayment({
  paymentId,
  apiKey,
  fetchImpl = globalThis.fetch,
  timeoutMs = DEFAULT_TIMEOUT_MS,
} = {}) {
  const normalizedId = normalizeNowPaymentsProviderId(paymentId);
  if (!normalizedId) return result('retryable', 'invalid_payment_id');
  if (typeof apiKey !== 'string' || !apiKey.trim()) {
    return result('retryable', 'missing_configuration');
  }
  if (typeof fetchImpl !== 'function') return result('retryable', 'transport_unavailable');

  const controller = new AbortController();
  let timer;
  const request = (async () => {
    let response;
    try {
      response = await fetchImpl(
        `${NOWPAYMENTS_URL}/payment/${encodeURIComponent(normalizedId)}`,
        {
          method: 'GET',
          headers: { 'x-api-key': apiKey.trim() },
          signal: controller.signal,
        },
      );
    } catch (error) {
      return result(
        'retryable',
        error?.name === 'AbortError' ? 'timeout' : 'transport_error',
      );
    }

    if (!response?.ok) {
      return result('retryable', 'provider_http_error', {
        httpStatus: response?.status ?? null,
      });
    }

    let payload;
    try {
      payload = await response.json();
    } catch {
      return result('retryable', 'malformed_json');
    }
    if (!isRecord(payload)) return result('retryable', 'malformed_response');
    return { state: 'received', paymentId: normalizedId, payload };
  })();

  const timeout = new Promise(resolve => {
    timer = setTimeout(() => {
      controller.abort();
      resolve(result('retryable', 'timeout'));
    }, boundedTimeout(timeoutMs));
  });

  try {
    return await Promise.race([request, timeout]);
  } finally {
    clearTimeout(timer);
  }
}

export function sortNowPaymentsIpnPayload(value) {
  if (Array.isArray(value)) return value.map(sortNowPaymentsIpnPayload);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .map(key => [key, sortNowPaymentsIpnPayload(value[key])]),
  );
}

export function createNowPaymentsIpnSignature(body, secret) {
  if (typeof secret !== 'string' || secret.length === 0) return null;
  try {
    const serialized = JSON.stringify(sortNowPaymentsIpnPayload(body));
    if (typeof serialized !== 'string') return null;
    return createHmac('sha512', secret).update(serialized).digest('hex');
  } catch {
    return null;
  }
}

export function verifyNowPaymentsIpnSignature(body, signature, secret) {
  const expected = createNowPaymentsIpnSignature(body, secret);
  if (
    !expected
    || typeof signature !== 'string'
    || !/^[a-fA-F0-9]{128}$/.test(signature.trim())
  ) {
    return false;
  }

  const expectedBytes = Buffer.from(expected, 'hex');
  const providedBytes = Buffer.from(signature.trim(), 'hex');
  return expectedBytes.length === providedBytes.length
    && timingSafeEqual(expectedBytes, providedBytes);
}
