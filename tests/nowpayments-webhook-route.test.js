import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createNowPaymentsIpnSignature } from '@/lib/nowpayments-verification';

const mocks = vi.hoisted(() => ({
  reconcileNowPaymentsDeposit: vi.fn(),
  notifyDepositFinalized: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
}));

vi.mock('@/lib/nowpayments-payment', () => ({
  reconcileNowPaymentsDeposit: mocks.reconcileNowPaymentsDeposit,
}));
vi.mock('@/lib/deposit-notifications', () => ({
  notifyDepositFinalized: mocks.notifyDepositFinalized,
}));
vi.mock('@/lib/logger', () => ({
  log: { warn: mocks.warn, error: mocks.error, info: mocks.info },
}));

const { POST } = await import('@/app/api/payments/crypto/webhook/route');

const REFERENCE = 'NTR-CRYPTO-WEBHOOK-1';
const PAYMENT_ID = '900719925474099312345';

function callbackBody(overrides = {}) {
  return {
    payment_id: PAYMENT_ID,
    payment_status: 'finished',
    order_id: REFERENCE,
    actually_paid: '999999',
    ...overrides,
  };
}

function signedRequest(body, secret, signature = createNowPaymentsIpnSignature(body, secret)) {
  return new Request('https://nitro.ng/api/payments/crypto/webhook', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-nowpayments-sig': signature,
    },
    body: JSON.stringify(body),
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
    message: 'NOWPayments has not confirmed this payment yet',
    providerStatus: 'confirming',
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.NOWPAYMENTS_IPN_SECRET = 'webhook-secret-one';
  mocks.reconcileNowPaymentsDeposit.mockResolvedValue(outcome());
  mocks.notifyDepositFinalized.mockResolvedValue({ attempted: 1, failed: [] });
});

afterEach(() => {
  delete process.env.NOWPAYMENTS_IPN_SECRET;
});

describe('POST /api/payments/crypto/webhook', () => {
  it('uses recursive HMAC validation and treats callback facts only as a reconciliation trigger', async () => {
    const body = callbackBody({ nested: { z: 1, a: { y: 2, b: 3 } } });

    const response = await POST(signedRequest(body, 'webhook-secret-one'));

    expect(response.status).toBe(200);
    expect(mocks.reconcileNowPaymentsDeposit).toHaveBeenCalledWith({
      reference: REFERENCE,
      providerPaymentId: PAYMENT_ID,
      timeoutMs: 2_200,
      auditCompleted: true,
      recoveredBy: 'webhook',
    });
    expect(mocks.reconcileNowPaymentsDeposit.mock.calls[0][0]).not.toHaveProperty('actuallyPaid');
    expect(mocks.notifyDepositFinalized).not.toHaveBeenCalled();
  });

  it('reads a rotated IPN secret at request time', async () => {
    const firstBody = callbackBody();
    const first = await POST(signedRequest(firstBody, 'webhook-secret-one'));

    process.env.NOWPAYMENTS_IPN_SECRET = 'webhook-secret-two';
    const secondBody = callbackBody({ payment_status: 'confirming' });
    const second = await POST(signedRequest(secondBody, 'webhook-secret-two'));

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(mocks.reconcileNowPaymentsDeposit).toHaveBeenCalledTimes(2);
  });

  it('returns a retryable 5xx when the authoritative provider query is retryable', async () => {
    mocks.reconcileNowPaymentsDeposit.mockResolvedValue(outcome({
      paymentState: 'retryable',
      retryable: true,
      reason: 'timeout',
      message: 'Payment verification is temporarily unavailable',
    }));

    const response = await POST(signedRequest(callbackBody(), 'webhook-secret-one'));

    expect(response.status).toBe(503);
    expect(response.headers.get('retry-after')).toBe('15');
    expect(await response.json()).toMatchObject({ ok: false, retryable: true });
  });

  it('notifies only when reconciliation newly finalizes the deposit', async () => {
    const finalization = { finalized: true, transaction: { id: 'deposit-1' } };
    mocks.reconcileNowPaymentsDeposit.mockResolvedValue(outcome({
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

    const response = await POST(signedRequest(callbackBody(), 'webhook-secret-one'));

    expect(response.status).toBe(200);
    expect(mocks.notifyDepositFinalized).toHaveBeenCalledWith(finalization, { channel: 'Crypto' });
  });

  it('rejects an invalid signature before reconciliation', async () => {
    const response = await POST(signedRequest(
      callbackBody(),
      'webhook-secret-one',
      '0'.repeat(128),
    ));

    expect(response.status).toBe(403);
    expect(mocks.reconcileNowPaymentsDeposit).not.toHaveBeenCalled();
  });
});
