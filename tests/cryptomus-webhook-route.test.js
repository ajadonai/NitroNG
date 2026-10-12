import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cryptomusSign } from '@/lib/cryptomus-verification';

const API_KEY = 'cryptomus-webhook-key';

const mocks = vi.hoisted(() => ({
  reconcileCryptoDeposit: vi.fn(),
  getCryptomusCredentials: vi.fn(),
  notifyDepositFinalized: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
  reportOperationalFailure: vi.fn(),
}));

vi.mock('@/lib/crypto-deposit', () => ({
  reconcileCryptoDeposit: mocks.reconcileCryptoDeposit,
  getCryptomusCredentials: mocks.getCryptomusCredentials,
}));
vi.mock('@/lib/deposit-notifications', () => ({
  notifyDepositFinalized: mocks.notifyDepositFinalized,
}));
vi.mock('@/lib/logger', () => ({
  log: { warn: mocks.warn, error: mocks.error, info: mocks.info },
}));
vi.mock('@/lib/monitoring', () => ({
  reportOperationalFailure: mocks.reportOperationalFailure,
}));

const { POST } = await import('@/app/api/payments/crypto/webhook/route');

const REFERENCE = 'NTR-CRYPTO-WEBHOOK-1';
const PAYMENT_ID = '940c4d31-70fb-4bf3-856b-5eb12a490af4';

function callbackBody(overrides = {}) {
  return {
    uuid: PAYMENT_ID,
    status: 'paid',
    order_id: REFERENCE,
    amount: '20000.00',
    currency: 'NGN',
    payment_amount: '12.5',
    ...overrides,
  };
}

function signedRequest(body, key = API_KEY, signature) {
  // The signature travels inside the payload it covers, so it is appended
  // after signing rather than attached as a header.
  const signed = { ...body, sign: signature ?? cryptomusSign(JSON.stringify(body), key) };
  return new Request('https://nitro.ng/api/payments/crypto/webhook', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(signed),
  });
}

function outcome(overrides = {}) {
  return {
    success: false,
    paymentState: 'provider_pending',
    transactionStatus: 'Pending',
    retryable: false,
    transaction: {
      id: 'deposit-1',
      reference: REFERENCE,
      status: 'Pending',
    },
    finalization: null,
    newlyFinalized: false,
    reason: 'provider_pending',
    message: 'The payment provider has not confirmed this payment yet',
    providerStatus: 'confirming',
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getCryptomusCredentials.mockResolvedValue({
    merchantId: 'webhook-merchant', apiKey: API_KEY, ready: true,
  });
  mocks.reconcileCryptoDeposit.mockResolvedValue(outcome());
  mocks.notifyDepositFinalized.mockResolvedValue({ attempted: 1, failed: [] });
});

describe('POST /api/payments/crypto/webhook', () => {
  it('verifies the in-body signature and treats callback facts only as a reconciliation trigger', async () => {
    const body = callbackBody({ nested: { z: 1, a: { y: 2, b: 3 } } });

    const response = await POST(signedRequest(body));

    expect(response.status).toBe(200);
    expect(mocks.reconcileCryptoDeposit).toHaveBeenCalledWith({
      reference: REFERENCE,
      providerPaymentId: PAYMENT_ID,
      timeoutMs: 2_200,
      auditCompleted: true,
      recoveredBy: 'webhook',
    });
    expect(mocks.reconcileCryptoDeposit.mock.calls[0][0]).not.toHaveProperty('actuallyPaid');
    expect(mocks.notifyDepositFinalized).not.toHaveBeenCalled();
  });

  it('reads rotated gateway credentials at request time', async () => {
    const first = await POST(signedRequest(callbackBody()));

    // Rotating the gateway key must take effect on the next callback without a
    // redeploy, so credentials are resolved per request rather than cached.
    const rotated = 'cryptomus-webhook-key-two';
    mocks.getCryptomusCredentials.mockResolvedValue({
      merchantId: 'webhook-merchant', apiKey: rotated, ready: true,
    });
    const second = await POST(signedRequest(callbackBody({ status: 'check' }), rotated));

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(mocks.reconcileCryptoDeposit).toHaveBeenCalledTimes(2);
  });

  it('returns a retryable 5xx when the authoritative provider query is retryable', async () => {
    mocks.reconcileCryptoDeposit.mockResolvedValue(outcome({
      paymentState: 'retryable',
      retryable: true,
      reason: 'timeout',
      message: 'Payment verification is temporarily unavailable',
    }));

    const response = await POST(signedRequest(callbackBody()));

    expect(response.status).toBe(503);
    expect(response.headers.get('retry-after')).toBe('15');
    expect(await response.json()).toMatchObject({ ok: false, retryable: true });
    expect(mocks.reportOperationalFailure).toHaveBeenCalledWith(
      'webhook_processing_failed',
      {
        level: 'warning',
        data: { provider: 'cryptomus', reason: 'timeout' },
        dedupeKey: 'webhook_processing_failed:cryptomus',
      },
    );
  });

  it('notifies only when reconciliation newly finalizes the deposit', async () => {
    const finalization = { finalized: true, transaction: { id: 'deposit-1' } };
    mocks.reconcileCryptoDeposit.mockResolvedValue(outcome({
      success: true,
      paymentState: 'credited',
      transactionStatus: 'Completed',
      transaction: {
        id: 'deposit-1',
        reference: REFERENCE,
        status: 'Completed',
        paymentReviewReason: null,
        paymentReviewResolvedAt: null,
      },
      newlyFinalized: true,
      finalization,
      reason: 'finalized',
      providerStatus: 'finished',
    }));

    const response = await POST(signedRequest(callbackBody()));

    expect(response.status).toBe(200);
    expect(mocks.notifyDepositFinalized).toHaveBeenCalledWith(finalization, { channel: 'Crypto' });
  });

  it('rejects an invalid signature before reconciliation', async () => {
    const response = await POST(signedRequest(
      callbackBody(),
      '0'.repeat(128),
    ));

    expect(response.status).toBe(403);
    expect(mocks.reconcileCryptoDeposit).not.toHaveBeenCalled();
  });

  it('reports unexpected webhook processing failures', async () => {
    const failure = new Error('provider request failed');
    mocks.reconcileCryptoDeposit.mockRejectedValue(failure);

    const response = await POST(signedRequest(callbackBody()));

    expect(response.status).toBe(500);
    expect(mocks.reportOperationalFailure).toHaveBeenCalledWith(
      'webhook_processing_failed',
      {
        error: failure,
        data: { provider: 'cryptomus' },
        dedupeKey: 'webhook_processing_failed:cryptomus',
      },
    );
  });
});
