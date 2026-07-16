import { describe, expect, it, vi } from 'vitest';
import {
  PAYMENT_STATES,
  isCreditedPaymentResult,
  paymentStateFromTransactionStatus,
} from '@/lib/payment-state';
import {
  classifyFlutterwaveResponse,
  verifyFlutterwaveTransaction,
} from '@/lib/flutterwave-verification';

const REFERENCE = 'NTR-PHASE3-ONE';
const EXPECTED_AMOUNT_KOBO = 500_025;
const EXPECTED_CURRENCY = 'NGN';

function successfulPayload(overrides = {}) {
  return {
    status: 'success',
    data: {
      id: 12345,
      tx_ref: REFERENCE,
      amount: EXPECTED_AMOUNT_KOBO / 100,
      currency: EXPECTED_CURRENCY,
      status: 'successful',
      ...overrides,
    },
  };
}

function classify(payload, overrides = {}) {
  return classifyFlutterwaveResponse(payload, {
    reference: REFERENCE,
    expectedAmountKobo: EXPECTED_AMOUNT_KOBO,
    expectedCurrency: EXPECTED_CURRENCY,
    ...overrides,
  });
}

function jsonResponse(payload, init = {}) {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { 'content-type': 'application/json' },
    ...init,
  });
}

describe('durable payment state', () => {
  it('uses stable customer-facing state names', () => {
    expect(PAYMENT_STATES).toMatchObject({
      CREDITED: 'credited',
      VERIFYING: 'verifying',
      PROVIDER_PENDING: 'provider_pending',
      RETRYABLE: 'retryable',
      FAILED: 'failed',
    });
  });

  it('maps every durable transaction status without treating uncredited rows as credited', () => {
    const cases = [
      ['Completed', PAYMENT_STATES.CREDITED],
      ['Processing', PAYMENT_STATES.VERIFYING],
      ['Pending', PAYMENT_STATES.PROVIDER_PENDING],
      ['Expired', PAYMENT_STATES.RETRYABLE],
      ['Failed', PAYMENT_STATES.FAILED],
      ['Cancelled', PAYMENT_STATES.FAILED],
    ];

    for (const [transactionStatus, expectedState] of cases) {
      expect(
        paymentStateFromTransactionStatus(transactionStatus),
        transactionStatus,
      ).toBe(expectedState);
    }
  });

  it('recognises credit only when success, payment state, and durable status all confirm it', () => {
    const credited = {
      success: true,
      paymentState: PAYMENT_STATES.CREDITED,
      transactionStatus: 'Completed',
    };

    expect(isCreditedPaymentResult(credited)).toBe(true);

    const notCredited = [
      null,
      undefined,
      {},
      { ...credited, success: false },
      { ...credited, success: 1 },
      { ...credited, paymentState: PAYMENT_STATES.VERIFYING },
      { ...credited, paymentState: PAYMENT_STATES.PROVIDER_PENDING },
      { ...credited, paymentState: PAYMENT_STATES.RETRYABLE },
      { ...credited, paymentState: PAYMENT_STATES.FAILED },
      { ...credited, transactionStatus: 'Processing' },
      { ...credited, transactionStatus: 'Pending' },
      { ...credited, transactionStatus: 'Expired' },
      { ...credited, transactionStatus: 'Failed' },
      { ...credited, transactionStatus: 'Cancelled' },
      { success: true, paymentState: PAYMENT_STATES.CREDITED },
      { success: true, transactionStatus: 'Completed' },
      { paymentState: PAYMENT_STATES.CREDITED, transactionStatus: 'Completed' },
    ];

    for (const payload of notCredited) {
      expect(isCreditedPaymentResult(payload), JSON.stringify(payload)).toBe(false);
    }
  });
});

describe('classifyFlutterwaveResponse', () => {
  it('verifies only an exact successful payment and preserves its kobo amount', () => {
    const cases = [
      ['NTR-ROUND-ONE', 100_001, 1000.01],
      ['NTR-ROUND-TWO', 199_999, 1999.99],
      ['NTR-ROUND-THREE', 250_050, 2500.5],
      ['NTR-ROUND-FOUR', 10_000_000, 100000],
    ];

    for (const [reference, expectedAmountKobo, providerAmount] of cases) {
      const result = classifyFlutterwaveResponse({
        status: 'success',
        data: {
          tx_ref: reference,
          amount: providerAmount,
          currency: EXPECTED_CURRENCY,
          status: 'successful',
        },
      }, {
        reference,
        expectedAmountKobo,
        expectedCurrency: EXPECTED_CURRENCY,
      });

      expect(result, reference).toMatchObject({
        state: 'verified',
        paidAmountKobo: expectedAmountKobo,
      });
    }
  });

  it('classifies provider pending and processing statuses as provider-pending', () => {
    for (const providerStatus of ['pending', 'processing']) {
      expect(classify(successfulPayload({ status: providerStatus })), providerStatus).toMatchObject({
        state: 'provider_pending',
        providerStatus,
      });
    }
  });

  it('keeps pending statuses retryable when provider identity is missing or contradictory', () => {
    const untrustedPendingPayloads = [
      successfulPayload({ status: 'pending', tx_ref: undefined }),
      successfulPayload({ status: 'pending', tx_ref: `${REFERENCE}-OTHER` }),
      successfulPayload({ status: 'processing', currency: undefined }),
      successfulPayload({ status: 'processing', currency: 'USD' }),
    ];

    for (const payload of untrustedPendingPayloads) {
      expect(classify(payload), JSON.stringify(payload.data)).toMatchObject({ state: 'retryable' });
    }
  });

  it('classifies provider failed and cancelled statuses as failed', () => {
    for (const providerStatus of ['failed', 'cancelled']) {
      expect(classify(successfulPayload({ status: providerStatus })), providerStatus).toMatchObject({
        state: 'failed',
        providerStatus,
      });
    }
  });

  it('keeps terminal statuses retryable when provider identity fields are missing or contradictory', () => {
    const untrustedTerminalPayloads = [
      successfulPayload({ status: 'failed', tx_ref: undefined }),
      successfulPayload({ status: 'failed', tx_ref: `${REFERENCE}-OTHER` }),
      successfulPayload({ status: 'cancelled', currency: undefined }),
      successfulPayload({ status: 'cancelled', currency: 'USD' }),
    ];

    for (const payload of untrustedTerminalPayloads) {
      expect(classify(payload), JSON.stringify(payload.data)).toMatchObject({ state: 'retryable' });
    }
  });

  it('fails closed when a successful payment has mismatched financial identity', () => {
    const mismatches = [
      successfulPayload({ tx_ref: `${REFERENCE}-OTHER` }),
      successfulPayload({ currency: 'USD' }),
      successfulPayload({ currency: 'ngn' }),
      successfulPayload({ amount: (EXPECTED_AMOUNT_KOBO - 1) / 100 }),
      successfulPayload({ amount: (EXPECTED_AMOUNT_KOBO + 1) / 100 }),
    ];

    for (const payload of mismatches) {
      expect(classify(payload), JSON.stringify(payload.data)).toMatchObject({ state: 'failed' });
    }
  });

  it('keeps outer provider errors, unknown statuses, and malformed payloads retryable', () => {
    const retryablePayloads = [
      { status: 'error', message: 'Provider unavailable' },
      successfulPayload({ status: 'unknown' }),
      null,
      undefined,
      '',
      {},
      { status: 'success' },
      { status: 'success', data: null },
      { status: 'success', data: {} },
      successfulPayload({ amount: [EXPECTED_AMOUNT_KOBO / 100] }),
      successfulPayload({ amount: String(EXPECTED_AMOUNT_KOBO / 100) }),
      successfulPayload({ amount: { value: EXPECTED_AMOUNT_KOBO / 100 } }),
    ];

    for (const payload of retryablePayloads) {
      expect(classify(payload), JSON.stringify(payload)).toMatchObject({ state: 'retryable' });
    }
  });
});

describe('verifyFlutterwaveTransaction', () => {
  const options = {
    reference: REFERENCE,
    expectedAmountKobo: EXPECTED_AMOUNT_KOBO,
    secretKey: 'FLWSECK_TEST',
    timeoutMs: 100,
  };

  it('verifies by encoded reference with bearer authentication', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(successfulPayload()));

    const result = await verifyFlutterwaveTransaction({ ...options, fetchImpl });

    expect(result).toMatchObject({ state: 'verified', paidAmountKobo: EXPECTED_AMOUNT_KOBO });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, requestOptions] = fetchImpl.mock.calls[0];
    expect(url).toBe(`https://api.flutterwave.com/v3/transactions/verify_by_reference?tx_ref=${encodeURIComponent(REFERENCE)}`);
    expect(requestOptions).toMatchObject({
      headers: { Authorization: `Bearer ${options.secretKey}` },
    });
    expect(requestOptions.signal).toBeInstanceOf(AbortSignal);
  });

  it('keeps outer provider errors retryable even when HTTP succeeds', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({
      status: 'error',
      message: 'Temporary provider error',
    }));

    await expect(verifyFlutterwaveTransaction({ ...options, fetchImpl })).resolves.toMatchObject({
      state: 'retryable',
    });
  });

  it('keeps every non-successful HTTP response retryable', async () => {
    for (const status of [400, 401, 429, 500, 503]) {
      const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(successfulPayload(), { status }));

      await expect(
        verifyFlutterwaveTransaction({ ...options, fetchImpl }),
        String(status),
      ).resolves.toMatchObject({ state: 'retryable' });
    }
  });

  it('keeps malformed provider JSON retryable', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response('{not-json', {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }));

    await expect(verifyFlutterwaveTransaction({ ...options, fetchImpl })).resolves.toMatchObject({
      state: 'retryable',
    });
  });

  it('keeps thrown transport failures retryable', async () => {
    const failures = [
      new TypeError('fetch failed'),
      Object.assign(new Error('request aborted'), { name: 'AbortError' }),
      new Error('socket reset'),
    ];

    for (const failure of failures) {
      const fetchImpl = vi.fn().mockRejectedValue(failure);
      await expect(
        verifyFlutterwaveTransaction({ ...options, fetchImpl }),
        failure.message,
      ).resolves.toMatchObject({ state: 'retryable' });
    }
  });

  it('aborts a provider request that exceeds the verification timeout', async () => {
    const fetchImpl = vi.fn((_url, { signal }) => new Promise((resolve, reject) => {
      const safetyTimer = setTimeout(() => resolve(jsonResponse(successfulPayload())), 75);
      signal?.addEventListener('abort', () => {
        clearTimeout(safetyTimer);
        reject(Object.assign(new Error('request aborted'), { name: 'AbortError' }));
      }, { once: true });
    }));

    await expect(verifyFlutterwaveTransaction({
      ...options,
      fetchImpl,
      timeoutMs: 5,
    })).resolves.toMatchObject({ state: 'retryable' });
  });
});
