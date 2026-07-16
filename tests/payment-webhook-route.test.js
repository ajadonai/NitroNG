import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getFlutterwaveSecretKey: vi.fn(),
  reconcileFlutterwaveDeposit: vi.fn(),
  notifyDepositFinalized: vi.fn(),
  transactionFindUnique: vi.fn(),
  transactionFindFirst: vi.fn(),
  transactionUpdateMany: vi.fn(),
  transactionUpdate: vi.fn(),
  finalizeDeposit: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
}));

vi.mock('@/lib/flutterwave-payment', () => ({
  getFlutterwaveSecretKey: mocks.getFlutterwaveSecretKey,
  reconcileFlutterwaveDeposit: mocks.reconcileFlutterwaveDeposit,
}));
vi.mock('@/lib/deposit-notifications', () => ({
  notifyDepositFinalized: mocks.notifyDepositFinalized,
}));
vi.mock('@/lib/prisma', () => ({
  default: {
    transaction: {
      findUnique: mocks.transactionFindUnique,
      findFirst: mocks.transactionFindFirst,
      updateMany: mocks.transactionUpdateMany,
      update: mocks.transactionUpdate,
    },
  },
}));
vi.mock('@/lib/deposit-finalization', () => ({
  finalizeDeposit: mocks.finalizeDeposit,
}));
vi.mock('@/lib/logger', () => ({
  log: {
    debug: vi.fn(),
    info: mocks.info,
    warn: mocks.warn,
    error: mocks.error,
  },
}));

const { POST } = await import('@/app/api/payments/webhook/route');

const HASH = 'phase-three-webhook-hash';
const REFERENCE = 'NTR-WEBHOOK-PHASE3';

function transaction(status = 'Pending') {
  return {
    id: 'deposit-1',
    userId: 'user-1',
    type: 'deposit',
    method: 'flutterwave',
    reference: REFERENCE,
    amount: 500_000,
    status,
    note: 'Flutterwave deposit',
    createdAt: new Date('2026-07-16T10:00:00.000Z'),
  };
}

function webhookRequest({
  hash = HASH,
  event = 'charge.completed',
  providerStatus = 'successful',
} = {}) {
  const headers = new Headers({ 'content-type': 'application/json' });
  if (hash !== null) headers.set('verif-hash', hash);
  return new Request('http://localhost/api/payments/webhook', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      event,
      data: {
        id: 12345,
        tx_ref: REFERENCE,
        amount: 5_000,
        currency: 'NGN',
        status: providerStatus,
      },
    }),
  });
}

function finalization(overrides = {}) {
  return {
    finalized: true,
    depositAmount: 500_000,
    couponBonus: 0,
    welcomeBonus: 0,
    totalUserCredit: 500_000,
    transaction: transaction('Completed'),
    user: {
      id: 'user-1',
      name: 'Test User',
      email: 'user@example.test',
      balance: 500_000,
    },
    ...overrides,
  };
}

function outcome(paymentState, transactionStatus, overrides = {}) {
  return {
    paymentState,
    transactionStatus,
    retryable: ['verifying', 'provider_pending', 'retryable'].includes(paymentState),
    newlyFinalized: false,
    transaction: transaction(transactionStatus),
    finalization: null,
    ...overrides,
  };
}

async function responseBody(response) {
  return response.json();
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv('FLUTTERWAVE_WEBHOOK_HASH', HASH);
  vi.stubEnv('FLUTTERWAVE_SECRET_KEY', 'FLWSECK_TEST');
  mocks.getFlutterwaveSecretKey.mockResolvedValue('FLWSECK_TEST');
  mocks.notifyDepositFinalized.mockResolvedValue({ attempted: 1, failed: [] });
  mocks.transactionUpdateMany.mockResolvedValue({ count: 0 });

  const row = transaction();
  mocks.transactionFindUnique.mockResolvedValue(row);
  mocks.transactionFindFirst.mockResolvedValue(row);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('POST /api/payments/webhook — Flutterwave reliability', () => {
  it('refuses all Flutterwave callbacks when the webhook hash is missing', async () => {
    vi.stubEnv('FLUTTERWAVE_WEBHOOK_HASH', '');

    const response = await POST(webhookRequest());

    expect(response.status).toBe(503);
    expect(await responseBody(response)).toEqual({ error: 'Webhook not configured' });
    expect(mocks.reconcileFlutterwaveDeposit).not.toHaveBeenCalled();
    expect(mocks.notifyDepositFinalized).not.toHaveBeenCalled();
  });

  it('rejects an invalid verif-hash before looking up or reconciling a deposit', async () => {
    const response = await POST(webhookRequest({ hash: 'wrong-hash' }));

    expect(response.status).toBe(401);
    expect(await responseBody(response)).toEqual({ error: 'Invalid signature' });
    expect(mocks.transactionFindUnique).not.toHaveBeenCalled();
    expect(mocks.transactionFindFirst).not.toHaveBeenCalled();
    expect(mocks.reconcileFlutterwaveDeposit).not.toHaveBeenCalled();
    expect(mocks.notifyDepositFinalized).not.toHaveBeenCalled();
  });

  it.each(['Processing', 'Failed'])(
    'delegates a successful callback for a legacy %s deposit without preclaiming it as Processing',
    async status => {
      const row = transaction(status);
      mocks.transactionFindUnique.mockResolvedValue(row);
      mocks.transactionFindFirst.mockResolvedValue(row);
      mocks.reconcileFlutterwaveDeposit.mockResolvedValue(outcome('credited', 'Completed', {
        transaction: transaction('Completed'),
        reason: 'already_completed',
      }));

      const response = await POST(webhookRequest());

      expect(response.status).toBe(200);
      expect(await responseBody(response)).toMatchObject({ received: true });
      expect(mocks.reconcileFlutterwaveDeposit).toHaveBeenCalledTimes(1);
      expect(mocks.reconcileFlutterwaveDeposit).toHaveBeenCalledWith(expect.objectContaining({
        transaction: expect.objectContaining({
          id: row.id,
          reference: REFERENCE,
          status,
        }),
      }));
      expect(mocks.transactionUpdateMany).not.toHaveBeenCalled();
      expect(mocks.transactionUpdate).not.toHaveBeenCalled();
      expect(mocks.finalizeDeposit).not.toHaveBeenCalled();
    },
  );

  it('notifies only when this callback newly finalizes the deposit', async () => {
    const committed = finalization();
    mocks.reconcileFlutterwaveDeposit.mockResolvedValue(outcome('credited', 'Completed', {
      newlyFinalized: true,
      transaction: committed.transaction,
      finalization: committed,
      reason: 'completed',
    }));

    const response = await POST(webhookRequest());

    expect(response.status).toBe(200);
    expect(await responseBody(response)).toMatchObject({ received: true });
    expect(mocks.notifyDepositFinalized).toHaveBeenCalledTimes(1);
    expect(mocks.notifyDepositFinalized).toHaveBeenCalledWith(
      committed,
      expect.objectContaining({ channel: 'Flutterwave' }),
    );
  });

  it('does not notify again when reconciliation finds an already-completed deposit', async () => {
    const completed = transaction('Completed');
    mocks.transactionFindUnique.mockResolvedValue(completed);
    mocks.transactionFindFirst.mockResolvedValue(completed);
    mocks.reconcileFlutterwaveDeposit.mockResolvedValue(outcome('credited', 'Completed', {
      transaction: completed,
      reason: 'already_completed',
      newlyFinalized: false,
    }));

    const response = await POST(webhookRequest());

    expect(response.status).toBe(200);
    expect(await responseBody(response)).toMatchObject({ received: true });
    expect(mocks.reconcileFlutterwaveDeposit).toHaveBeenCalledTimes(1);
    expect(mocks.notifyDepositFinalized).not.toHaveBeenCalled();
  });

  it('acknowledges a retryable provider result without reporting or notifying a false credit', async () => {
    mocks.reconcileFlutterwaveDeposit.mockResolvedValue(outcome('retryable', 'Expired', {
      retryable: true,
      message: 'Flutterwave could not be reached',
    }));

    const response = await POST(webhookRequest());
    const body = await responseBody(response);

    expect(response.status).toBe(200);
    expect(body).toMatchObject({ received: true });
    expect(body.success).not.toBe(true);
    expect(body.paymentState).not.toBe('credited');
    expect(mocks.reconcileFlutterwaveDeposit).toHaveBeenCalledTimes(1);
    expect(mocks.notifyDepositFinalized).not.toHaveBeenCalled();
  });
});
