import { createHmac } from 'node:crypto';
import { Prisma } from '@prisma/client';
import fc from 'fast-check';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  canonicalizeNonNegativeDecimal,
  classifyNowPaymentsStatusResponse,
  compareNonNegativeDecimals,
  createNowPaymentsIpnSignature,
  equalNonNegativeDecimals,
  fetchNowPaymentsPayment,
  normalizeNowPaymentsProviderId,
  sortNowPaymentsIpnPayload,
  validateNowPaymentsCreationResponse,
  verifyNowPaymentsIpnSignature,
} from '@/lib/nowpayments-verification';

const REFERENCE = 'NTR-CRYPTO-TEST-1';
const PAYMENT_ID = '900719925474099312345';

function creationExpected(overrides = {}) {
  return {
    reference: REFERENCE,
    expectedPriceAmount: '11.00',
    expectedPriceCurrency: 'usd',
    expectedPayCurrency: 'usdttrc20',
    ...overrides,
  };
}

function creationPayload(overrides = {}) {
  return {
    payment_id: PAYMENT_ID,
    payment_status: 'waiting',
    order_id: REFERENCE,
    parent_payment_id: null,
    price_amount: '11.0',
    price_currency: 'usd',
    pay_amount: '10.5000',
    pay_currency: 'usdttrc20',
    pay_address: 'TMwFHYXLJaRUPeW6421aqXL4ZEzPRFGkGT',
    ...overrides,
  };
}

function statusExpected(overrides = {}) {
  return {
    paymentId: PAYMENT_ID,
    reference: REFERENCE,
    expectedPriceAmount: '11.00',
    expectedPriceCurrency: 'usd',
    expectedPayAmount: '10.5000',
    expectedPayCurrency: 'usdttrc20',
    ...overrides,
  };
}

function statusPayload(overrides = {}) {
  return {
    payment_id: PAYMENT_ID,
    payment_status: 'waiting',
    order_id: REFERENCE,
    parent_payment_id: null,
    price_amount: '11.0',
    price_currency: 'usd',
    pay_amount: '10.50',
    pay_currency: 'usdttrc20',
    actually_paid: '0',
    ...overrides,
  };
}

function scaledDecimal(coefficient, scale) {
  const digits = coefficient.toString().padStart(scale + 1, '0');
  if (scale === 0) return digits;
  return `${digits.slice(0, -scale)}.${digits.slice(-scale)}`;
}

function reverseKeysRecursively(value) {
  if (Array.isArray(value)) return value.map(reverseKeysRecursively);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.keys(value).reverse().map(key => [key, reverseKeysRecursively(value[key])]),
  );
}

afterEach(() => {
  vi.useRealTimers();
});

describe('opaque provider ID normalization', () => {
  it.each([
    ['000123', '000123'],
    ['payment_ID-9.x', 'payment_ID-9.x'],
    [123, '123'],
    [123n, '123'],
    ['  abc-123  ', 'abc-123'],
  ])('normalizes %s without numeric coercion', (input, expected) => {
    expect(normalizeNowPaymentsProviderId(input)).toBe(expected);
  });

  it.each([
    '', '   ', -1, 1.5, Number.MAX_SAFE_INTEGER + 1, NaN, Infinity,
    'id/child', 'id?query', 'id#fragment', [], {}, { toString: () => '123' },
  ])('rejects an unsafe provider ID: %s', input => {
    expect(normalizeNowPaymentsProviderId(input)).toBeNull();
  });
});

describe('exact nonnegative decimal contract', () => {
  it.each([
    ['0', '0'],
    ['000.000', '0'],
    ['00123.45000', '123.45'],
    ['.5', '0.5'],
    ['1.', '1'],
    ['1e3', '1000'],
    ['1.25e-3', '0.00125'],
    [12.5, '12.5'],
    [12n, '12'],
  ])('canonicalizes %s to %s', (input, expected) => {
    expect(canonicalizeNonNegativeDecimal(input)).toBe(expected);
  });

  it('accepts Decimal-like values through validated toString output', () => {
    class PrismaDecimalLike {
      toString() { return '00042.5000'; }
    }
    expect(canonicalizeNonNegativeDecimal(new PrismaDecimalLike())).toBe('42.5');
    expect(canonicalizeNonNegativeDecimal(new Prisma.Decimal('123.4500'))).toBe('123.45');
  });

  it('enforces the Decimal(36,18) persistence boundary after canonicalization', () => {
    expect(canonicalizeNonNegativeDecimal(
      '999999999999999999.999999999999999999',
    )).toBe('999999999999999999.999999999999999999');
    expect(canonicalizeNonNegativeDecimal('1000000000000000000')).toBeNull();
    expect(canonicalizeNonNegativeDecimal('0.1234567890123456789')).toBeNull();
    expect(canonicalizeNonNegativeDecimal('0001.2000000000000000000000')).toBe('1.2');
  });

  it.each([
    -1, '-0.1', NaN, Infinity, '', ' ', '.', '+', '1.2.3', 'NaN', 'Infinity',
    '1e9999', [], ['1.2'], {}, { toString: () => '1.2' }, new Number(1.2),
  ])('rejects an invalid decimal: %s', input => {
    expect(canonicalizeNonNegativeDecimal(input)).toBeNull();
  });

  it('does not apply binary-float tolerance', () => {
    expect(equalNonNegativeDecimals('0.30000000000000004', '0.3')).toBe(false);
    expect(compareNonNegativeDecimals('0.30000000000000004', '0.3')).toBe(1);
    expect(equalNonNegativeDecimals(0.1 + 0.2, '0.3')).toBe(false);
  });

  it('returns null comparison for invalid operands', () => {
    expect(compareNonNegativeDecimals('-1', '0')).toBeNull();
    expect(equalNonNegativeDecimals('-1', '-1')).toBe(false);
  });

  it('property: leading/trailing zero representations canonicalize equally and idempotently', () => {
    fc.assert(fc.property(
      fc.bigInt({ min: 0n, max: (10n ** 18n) - 1n }),
      fc.integer({ min: 0, max: 18 }),
      fc.integer({ min: 0, max: 8 }),
      fc.integer({ min: 0, max: 8 }),
      (coefficient, scale, leadingZeros, trailingZeros) => {
        const base = scaledDecimal(coefficient, scale);
        const variant = scale > 0
          ? `${'0'.repeat(leadingZeros)}${base}${'0'.repeat(trailingZeros)}`
          : `${'0'.repeat(leadingZeros)}${base}.${'0'.repeat(trailingZeros + 1)}`;
        const canonical = canonicalizeNonNegativeDecimal(base);
        expect(canonicalizeNonNegativeDecimal(variant)).toBe(canonical);
        expect(canonicalizeNonNegativeDecimal(canonical)).toBe(canonical);
      },
    ), { numRuns: 250 });
  });

  it('property: comparison agrees with BigInt order at a shared decimal scale', () => {
    fc.assert(fc.property(
      fc.bigInt({ min: 0n, max: (10n ** 18n) - 1n }),
      fc.bigInt({ min: 0n, max: (10n ** 18n) - 1n }),
      fc.integer({ min: 0, max: 18 }),
      (left, right, scale) => {
        const actual = compareNonNegativeDecimals(
          scaledDecimal(left, scale),
          scaledDecimal(right, scale),
        );
        const expected = left === right ? 0 : left < right ? -1 : 1;
        expect(actual).toBe(expected);
      },
    ), { numRuns: 250 });
  });

  it('property: canonical values beyond Decimal(36,18) integer/scale bounds are rejected', () => {
    fc.assert(fc.property(fc.integer({ min: 19, max: 80 }), digitCount => {
      expect(canonicalizeNonNegativeDecimal('1'.repeat(digitCount))).toBeNull();
      expect(canonicalizeNonNegativeDecimal(`0.${'1'.repeat(digitCount)}`)).toBeNull();
    }), { numRuns: 100 });
  });
});

describe('NOWPayments creation response contract', () => {
  it('accepts a response bound to the exact reference and payment terms', () => {
    expect(validateNowPaymentsCreationResponse(
      creationPayload(),
      creationExpected(),
    )).toEqual(expect.objectContaining({
      state: 'created',
      reason: 'provider_payment_created',
      paymentId: PAYMENT_ID,
      reference: REFERENCE,
      providerStatus: 'waiting',
      priceAmount: '11',
      priceCurrency: 'usd',
      payAmount: '10.5',
      payCurrency: 'usdttrc20',
      payAddress: 'TMwFHYXLJaRUPeW6421aqXL4ZEzPRFGkGT',
    }));
  });

  it.each([
    ['order_id_mismatch', { order_id: 'OTHER' }, {}],
    ['price_amount_mismatch', { price_amount: '11.0000000000000001' }, {}],
    ['price_currency_mismatch', { price_currency: 'ngn' }, {}],
    ['pay_currency_mismatch', { pay_currency: 'usdterc20' }, {}],
    ['repeated_payment', { parent_payment_id: 'parent-1' }, {}],
  ])('sends a valid identity/term mismatch to review: %s', (reason, payloadPatch, expectedPatch) => {
    expect(validateNowPaymentsCreationResponse(
      creationPayload(payloadPatch),
      creationExpected(expectedPatch),
    )).toEqual(expect.objectContaining({ state: 'review', reason }));
  });

  it.each([
    ['invalid_payment_id', { payment_id: '../123' }],
    ['invalid_pay_address', { pay_address: '' }],
    ['malformed_price_amount', { price_amount: 'eleven' }],
    ['malformed_pay_amount', { pay_amount: [] }],
    ['non_positive_pay_amount', { pay_amount: '0.000' }],
    ['malformed_price_currency', { price_currency: null }],
    ['malformed_pay_currency', { pay_currency: {} }],
    ['malformed_provider_status', { payment_status: null }],
    ['unknown_provider_status', { payment_status: 'mystery' }],
  ])('classifies malformed/unknown creation data as retryable: %s', (reason, patch) => {
    expect(validateNowPaymentsCreationResponse(
      creationPayload(patch),
      creationExpected(),
    )).toEqual(expect.objectContaining({ state: 'retryable', reason }));
  });

  it.each(['confirming', 'finished', 'failed', 'refunded', 'partially_paid']) (
    'sends a known but non-initial status to review: %s', providerStatus => {
      expect(validateNowPaymentsCreationResponse(
        creationPayload({ payment_status: providerStatus }),
        creationExpected(),
      )).toEqual(expect.objectContaining({
        state: 'review',
        reason: 'untrusted_initial_status',
        providerStatus,
      }));
    },
  );

  it('fails retryably when local expectations are malformed', () => {
    expect(validateNowPaymentsCreationResponse(
      creationPayload(),
      creationExpected({ expectedPriceAmount: '-1' }),
    )).toEqual(expect.objectContaining({ state: 'retryable', reason: 'invalid_expectation' }));
  });
});

describe('NOWPayments status response classification', () => {
  it.each(['confirmed', 'finished'])(
    'verifies exact successful status %s', providerStatus => {
      expect(classifyNowPaymentsStatusResponse(
        statusPayload({ payment_status: providerStatus, actually_paid: '10.500000' }),
        statusExpected(),
      )).toEqual(expect.objectContaining({
        state: 'verified',
        reason: 'provider_verified',
        providerStatus,
        actuallyPaid: '10.5',
        payAmount: '10.5',
        legacyPayAmountAdopted: false,
      }));
    },
  );

  it.each(['waiting', 'confirming', 'sending', 'spending'])(
    'maps %s to provider_pending', providerStatus => {
      expect(classifyNowPaymentsStatusResponse(
        statusPayload({ payment_status: providerStatus }),
        statusExpected(),
      )).toEqual(expect.objectContaining({
        state: 'provider_pending',
        reason: 'provider_pending',
        providerStatus,
      }));
    },
  );

  it.each(['failed', 'expired', 'cancelled'])(
    'maps %s to provider_failed', providerStatus => {
      expect(classifyNowPaymentsStatusResponse(
        statusPayload({ payment_status: providerStatus }),
        statusExpected(),
      )).toEqual(expect.objectContaining({
        state: 'provider_failed',
        reason: 'provider_failed',
        providerStatus,
      }));
    },
  );

  it('distinguishes refunded from provider failure', () => {
    expect(classifyNowPaymentsStatusResponse(
      statusPayload({ payment_status: 'refunded' }),
      statusExpected(),
    )).toEqual(expect.objectContaining({
      state: 'refunded',
      reason: 'provider_refunded',
      providerStatus: 'refunded',
    }));
  });

  it.each([
    ['partially_paid', 'partially_paid'],
    ['underpaid', 'underpayment'],
    ['overpaid', 'overpayment'],
    ['repeated', 'repeated_payment'],
    ['wrong_asset', 'wrong_asset'],
  ])(
    'sends provider review status %s to review as %s', (providerStatus, reason) => {
      expect(classifyNowPaymentsStatusResponse(
        statusPayload({ payment_status: providerStatus }),
        statusExpected(),
      )).toEqual(expect.objectContaining({
        state: 'review',
        reason,
        providerStatus,
      }));
    },
  );

  it.each([
    ['payment_id_mismatch', { payment_id: 'different' }],
    ['order_id_mismatch', { order_id: 'OTHER' }],
    ['repeated_payment', { parent_payment_id: 'parent-1' }],
    ['price_amount_mismatch', { price_amount: '11.01' }],
    ['price_currency_mismatch', { price_currency: 'ngn' }],
    ['pay_amount_mismatch', { pay_amount: '10.500000000000001' }],
    ['pay_currency_mismatch', { pay_currency: 'usdterc20' }],
  ])('sends identity/term mismatch to review: %s', (reason, patch) => {
    expect(classifyNowPaymentsStatusResponse(
      statusPayload(patch),
      statusExpected(),
    )).toEqual(expect.objectContaining({ state: 'review', reason }));
  });

  it('distinguishes underpayment and overpayment on a nominally successful status', () => {
    expect(classifyNowPaymentsStatusResponse(
      statusPayload({ payment_status: 'finished', actually_paid: '10.499999999999999' }),
      statusExpected(),
    )).toEqual(expect.objectContaining({ state: 'review', reason: 'underpayment' }));
    expect(classifyNowPaymentsStatusResponse(
      statusPayload({ payment_status: 'confirmed', actually_paid: '10.500000000000001' }),
      statusExpected(),
    )).toEqual(expect.objectContaining({ state: 'review', reason: 'overpayment' }));
  });

  it('adopts a legacy pay amount only after all other identity and term checks pass', () => {
    const adopted = classifyNowPaymentsStatusResponse(
      statusPayload({ payment_status: 'finished', pay_amount: '12.34500', actually_paid: '12.345' }),
      statusExpected({ expectedPayAmount: null }),
    );
    expect(adopted).toEqual(expect.objectContaining({
      state: 'verified',
      payAmount: '12.345',
      actuallyPaid: '12.345',
      legacyPayAmountAdopted: true,
    }));

    expect(classifyNowPaymentsStatusResponse(
      statusPayload({
        payment_status: 'finished',
        price_currency: 'ngn',
        pay_amount: '12.345',
        actually_paid: '12.345',
      }),
      statusExpected({ expectedPayAmount: null }),
    )).toEqual(expect.objectContaining({
      state: 'review',
      reason: 'price_currency_mismatch',
      legacyPayAmountAdopted: false,
    }));
  });

  it.each([
    ['malformed_response', null],
    ['invalid_payment_id', statusPayload({ payment_id: [] })],
    ['malformed_provider_status', statusPayload({ payment_status: null })],
    ['malformed_price_amount', statusPayload({ price_amount: {} })],
    ['malformed_pay_amount', statusPayload({ pay_amount: 'ten' })],
    ['non_positive_pay_amount', statusPayload({ pay_amount: '0' })],
    ['unknown_provider_status', statusPayload({ payment_status: 'mystery' })],
    ['malformed_actually_paid', statusPayload({ payment_status: 'finished', actually_paid: 'not-a-decimal' })],
  ])('classifies malformed/unknown status data as retryable: %s', (reason, payload) => {
    expect(classifyNowPaymentsStatusResponse(
      payload,
      statusExpected(),
    )).toEqual(expect.objectContaining({ state: 'retryable', reason }));
  });

  it.each([undefined, null, ''])(
    'sends a terminal success with missing actual amount to review: %s', actuallyPaid => {
      const payload = statusPayload({ payment_status: 'finished', actually_paid: actuallyPaid });
      if (actuallyPaid === undefined) delete payload.actually_paid;
      expect(classifyNowPaymentsStatusResponse(payload, statusExpected())).toEqual(
        expect.objectContaining({ state: 'review', reason: 'missing_actual_amount' }),
      );
    },
  );
});

describe('bounded NOWPayments GET wrapper', () => {
  it('queries the normalized opaque payment ID with API authentication', async () => {
    const payload = statusPayload();
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue(payload),
    });

    await expect(fetchNowPaymentsPayment({
      paymentId: PAYMENT_ID,
      apiKey: 'np-key',
      fetchImpl,
      timeoutMs: 1_000,
    })).resolves.toEqual({ state: 'received', paymentId: PAYMENT_ID, payload });
    expect(fetchImpl).toHaveBeenCalledWith(
      `https://api.nowpayments.io/v1/payment/${PAYMENT_ID}`,
      expect.objectContaining({
        method: 'GET',
        headers: { 'x-api-key': 'np-key' },
        signal: expect.any(AbortSignal),
      }),
    );
  });

  it.each([
    [{ paymentId: '../bad', apiKey: 'key', fetchImpl: vi.fn() }, 'invalid_payment_id'],
    [{ paymentId: PAYMENT_ID, apiKey: '', fetchImpl: vi.fn() }, 'missing_configuration'],
    [{ paymentId: PAYMENT_ID, apiKey: 'key', fetchImpl: null }, 'transport_unavailable'],
  ])('rejects local wrapper precondition as retryable: %s', async (options, reason) => {
    await expect(fetchNowPaymentsPayment(options)).resolves.toEqual(expect.objectContaining({
      state: 'retryable', reason,
    }));
  });

  it('classifies transport, HTTP, and malformed responses as retryable', async () => {
    await expect(fetchNowPaymentsPayment({
      paymentId: PAYMENT_ID,
      apiKey: 'key',
      fetchImpl: vi.fn().mockRejectedValue(new Error('offline')),
    })).resolves.toEqual(expect.objectContaining({ state: 'retryable', reason: 'transport_error' }));

    await expect(fetchNowPaymentsPayment({
      paymentId: PAYMENT_ID,
      apiKey: 'key',
      fetchImpl: vi.fn().mockResolvedValue({ ok: false, status: 503 }),
    })).resolves.toEqual(expect.objectContaining({
      state: 'retryable', reason: 'provider_http_error', httpStatus: 503,
    }));

    await expect(fetchNowPaymentsPayment({
      paymentId: PAYMENT_ID,
      apiKey: 'key',
      fetchImpl: vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: vi.fn().mockRejectedValue(new SyntaxError('bad json')),
      }),
    })).resolves.toEqual(expect.objectContaining({ state: 'retryable', reason: 'malformed_json' }));
  });

  it('returns on its bounded timeout even when an injected fetch ignores abort', async () => {
    vi.useFakeTimers();
    const resultPromise = fetchNowPaymentsPayment({
      paymentId: PAYMENT_ID,
      apiKey: 'key',
      fetchImpl: vi.fn(() => new Promise(() => {})),
      timeoutMs: 10,
    });
    await vi.advanceTimersByTimeAsync(11);
    await expect(resultPromise).resolves.toEqual(expect.objectContaining({
      state: 'retryable', reason: 'timeout',
    }));
  });
});

describe('recursive NOWPayments IPN signing', () => {
  it('sorts nested object keys while preserving array order', () => {
    expect(sortNowPaymentsIpnPayload({
      z: { b: 2, a: 1 },
      a: [{ d: 4, c: 3 }, 2, 1],
    })).toEqual({
      a: [{ c: 3, d: 4 }, 2, 1],
      z: { a: 1, b: 2 },
    });
  });

  it('creates HMAC-SHA512 and verifies it in constant-time-compatible form', () => {
    const body = { payment_status: 'finished', nested: { z: 1, a: 2 }, order_id: REFERENCE };
    const secret = 'ipn-secret';
    const sorted = { nested: { a: 2, z: 1 }, order_id: REFERENCE, payment_status: 'finished' };
    const expected = createHmac('sha512', secret).update(JSON.stringify(sorted)).digest('hex');

    expect(createNowPaymentsIpnSignature(body, secret)).toBe(expected);
    expect(verifyNowPaymentsIpnSignature(body, expected, secret)).toBe(true);
    expect(verifyNowPaymentsIpnSignature(body, `${expected.slice(0, -1)}0`, secret)).toBe(false);
    expect(verifyNowPaymentsIpnSignature(body, 'not-hex', secret)).toBe(false);
    expect(verifyNowPaymentsIpnSignature(body, expected, '')).toBe(false);
  });

  it('property: signature is invariant to recursive object key insertion order', () => {
    fc.assert(fc.property(fc.jsonValue(), value => {
      const original = {
        z: value,
        order_id: REFERENCE,
        a: { z: value, a: [value, { z: 1, a: 2 }] },
      };
      const reordered = reverseKeysRecursively(original);
      expect(createNowPaymentsIpnSignature(original, 'property-secret'))
        .toBe(createNowPaymentsIpnSignature(reordered, 'property-secret'));
    }), { numRuns: 250 });
  });
});
