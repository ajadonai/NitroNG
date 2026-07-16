import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  getFlutterwaveSecretKey: vi.fn(),
  reconcileFlutterwaveDeposit: vi.fn(),
  notifyDepositFinalized: vi.fn(),
  parseFbCookies: vi.fn(() => ({})),
  headers: vi.fn(),
  rateLimit: vi.fn(),
  settingFindUnique: vi.fn(),
  transactionUpdateMany: vi.fn(),
  transactionFindFirst: vi.fn(),
  transactionUpdate: vi.fn(),
  finalizeDeposit: vi.fn(),
  fetch: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({ getCurrentUser: mocks.getCurrentUser }));
vi.mock('@/lib/flutterwave-payment', () => ({
  getFlutterwaveSecretKey: mocks.getFlutterwaveSecretKey,
  reconcileFlutterwaveDeposit: mocks.reconcileFlutterwaveDeposit,
  isCreditedPaymentResult: (result) => (
    result?.paymentState === 'credited'
    && result?.transactionStatus === 'Completed'
  ),
}));
vi.mock('@/lib/deposit-notifications', () => ({
  notifyDepositFinalized: mocks.notifyDepositFinalized,
}));
vi.mock('@/lib/meta-capi', () => ({ parseFbCookies: mocks.parseFbCookies }));
vi.mock('@/lib/rate-limit', () => ({ rateLimit: mocks.rateLimit }));
vi.mock('@/lib/logger', () => ({
  log: { warn: mocks.warn, error: mocks.error, info: mocks.info },
}));
vi.mock('next/headers', () => ({
  headers: mocks.headers,
}));

// Legacy dependencies remain mocked while the route is moved behind the shared
// Flutterwave reconciler. These mocks also ensure a regression cannot reach a
// real provider or database from this contract test.
vi.mock('@/lib/prisma', () => ({
  default: {
    setting: { findUnique: mocks.settingFindUnique },
    transaction: {
      updateMany: mocks.transactionUpdateMany,
      findFirst: mocks.transactionFindFirst,
      update: mocks.transactionUpdate,
    },
  },
}));
vi.mock('@/lib/deposit-finalization', () => ({
  finalizeDeposit: mocks.finalizeDeposit,
}));

vi.stubGlobal('fetch', mocks.fetch);

const { POST } = await import('@/app/api/payments/verify/route');

const REFERENCE = 'NTR-PHASE-THREE';
const USER_ID = 'user-1';

function request(body = { reference: REFERENCE }) {
  return {
    json: vi.fn(async () => body),
  };
}

function transaction(status = 'Completed') {
  return {
    id: 'deposit-1',
    userId: USER_ID,
    type: 'deposit',
    method: 'flutterwave',
    reference: REFERENCE,
    amount: 500_000,
    status,
  };
}

function finalization(overrides = {}) {
  return {
    finalized: true,
    depositAmount: 500_000,
    couponBonus: 50_000,
    welcomeBonus: 120_000,
    totalUserCredit: 670_000,
    transaction: transaction('Completed'),
    user: {
      id: USER_ID,
      name: 'Test User',
      email: 'user@example.test',
      balance: 670_000,
    },
    ...overrides,
  };
}

function outcome(paymentState, transactionStatus, overrides = {}) {
  return {
    paymentState,
    transactionStatus,
    retryable: ['verifying', 'provider_pending', 'retryable'].includes(paymentState),
    transaction: transaction(transactionStatus),
    finalization: null,
    newlyFinalized: false,
    message: 'Payment status updated',
    ...overrides,
  };
}

async function bodyOf(response) {
  return response.json();
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getCurrentUser.mockResolvedValue({ id: USER_ID });
  mocks.getFlutterwaveSecretKey.mockResolvedValue('flw-secret');
  mocks.notifyDepositFinalized.mockResolvedValue({ attempted: 1, failed: [] });
  mocks.rateLimit.mockResolvedValue({ limited: false, remaining: 11 });
  mocks.headers.mockResolvedValue(new Headers({
    cookie: 'test=1',
    'user-agent': 'Vitest',
    'x-forwarded-for': '203.0.113.1',
  }));
});

describe('POST /api/payments/verify response contract', () => {
  it('rejects an unauthenticated request before reconciliation', async () => {
    mocks.getCurrentUser.mockResolvedValue(null);

    const response = await POST(request());

    expect(response.status).toBe(401);
    expect(await bodyOf(response)).toEqual({ error: 'Not authenticated' });
    expect(mocks.reconcileFlutterwaveDeposit).not.toHaveBeenCalled();
  });

  it('rejects a missing reference before reconciliation', async () => {
    const response = await POST(request({}));

    expect(response.status).toBe(400);
    expect(await bodyOf(response)).toEqual({ error: 'Reference required' });
    expect(mocks.reconcileFlutterwaveDeposit).not.toHaveBeenCalled();
  });

  it('rate-limits provider verification per authenticated account', async () => {
    mocks.rateLimit.mockResolvedValueOnce({ limited: true, remaining: 0 });

    const response = await POST(request());
    const body = await bodyOf(response);

    expect(response.status).toBe(429);
    expect(response.headers.get('retry-after')).toBe('60');
    expect(body).toMatchObject({
      success: false,
      paymentState: 'retryable',
      retryable: true,
    });
    expect(mocks.rateLimit).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      maxAttempts: 12,
      key: `rl:payment-verify:${USER_ID}`,
    }));
    expect(mocks.reconcileFlutterwaveDeposit).not.toHaveBeenCalled();
  });

  it('returns Already credited only when semantic and stored states both confirm completion', async () => {
    mocks.reconcileFlutterwaveDeposit.mockResolvedValue(outcome('credited', 'Completed', {
      reason: 'already_completed',
      message: 'Already credited',
    }));

    const response = await POST(request());
    const body = await bodyOf(response);

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      success: true,
      paymentState: 'credited',
      transactionStatus: 'Completed',
      message: 'Already credited',
      amount: 5_000,
    });
    expect(mocks.reconcileFlutterwaveDeposit).toHaveBeenCalledWith(expect.objectContaining({
      reference: REFERENCE,
      userId: USER_ID,
    }));
    expect(mocks.notifyDepositFinalized).not.toHaveBeenCalled();
  });

  it.each([
    ['credited', 'Processing'],
    ['verifying', 'Completed'],
  ])('never credits a contradictory %s/%s result', async (paymentState, transactionStatus) => {
    mocks.reconcileFlutterwaveDeposit.mockResolvedValue(outcome(paymentState, transactionStatus, {
      reason: 'inconsistent_financial_state',
      message: 'Verification is still in progress',
    }));

    const response = await POST(request());
    const body = await bodyOf(response);

    expect(response.status).not.toBe(200);
    expect(body.success).toBe(false);
    expect(body.message).not.toBe('Already credited');
    expect(mocks.notifyDepositFinalized).not.toHaveBeenCalled();
  });

  it('never credits when the returned transaction object is not actually Completed', async () => {
    mocks.reconcileFlutterwaveDeposit.mockResolvedValue(outcome('credited', 'Completed', {
      transaction: transaction('Processing'),
      reason: 'inconsistent_financial_state',
      message: 'Payment status could not be confirmed',
    }));

    const response = await POST(request());
    const body = await bodyOf(response);

    expect(response.status).not.toBe(200);
    expect(body.success).toBe(false);
    expect(body.message).not.toBe('Already credited');
    expect(mocks.notifyDepositFinalized).not.toHaveBeenCalled();
  });

  it.each([
    {
      paymentState: 'verifying',
      transactionStatus: 'Processing',
      responseStatus: 202,
      message: 'Verification is already in progress',
    },
    {
      paymentState: 'provider_pending',
      transactionStatus: 'Pending',
      responseStatus: 202,
      message: 'Flutterwave has not confirmed this payment yet',
    },
    {
      paymentState: 'retryable',
      transactionStatus: 'Pending',
      responseStatus: 503,
      message: 'Flutterwave could not be reached. Please try again.',
    },
    {
      paymentState: 'failed',
      transactionStatus: 'Failed',
      responseStatus: 422,
      message: 'Payment verification failed',
    },
  ])('maps $paymentState to a non-crediting HTTP response', async ({
    paymentState, transactionStatus, responseStatus, message,
  }) => {
    mocks.reconcileFlutterwaveDeposit.mockResolvedValue(outcome(paymentState, transactionStatus, {
      message,
      retryable: paymentState !== 'failed',
    }));

    const response = await POST(request());
    const body = await bodyOf(response);

    expect(response.status).toBe(responseStatus);
    expect(body).toMatchObject({
      success: false,
      paymentState,
      transactionStatus,
      retryable: paymentState !== 'failed',
      message,
    });
    expect(mocks.notifyDepositFinalized).not.toHaveBeenCalled();
  });

  it('notifies only for the request that newly finalizes the deposit', async () => {
    const committed = finalization();
    mocks.reconcileFlutterwaveDeposit.mockResolvedValue(outcome('credited', 'Completed', {
      newlyFinalized: true,
      finalization: committed,
      message: 'Payment successful',
    }));

    const response = await POST(request());
    const body = await bodyOf(response);

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      success: true,
      paymentState: 'credited',
      transactionStatus: 'Completed',
      amount: 5_000,
      bonus: 500,
      welcomeBonus: 1_200,
      total: 6_700,
    });
    expect(mocks.notifyDepositFinalized).toHaveBeenCalledTimes(1);
    expect(mocks.notifyDepositFinalized).toHaveBeenCalledWith(
      committed,
      expect.objectContaining({ channel: 'Flutterwave' }),
    );
  });

  it('still reports the committed credit when notification metadata fails', async () => {
    mocks.reconcileFlutterwaveDeposit.mockResolvedValue(outcome('credited', 'Completed', {
      newlyFinalized: true,
      finalization: finalization(),
      message: 'Payment successful',
    }));
    mocks.headers.mockRejectedValueOnce(new Error('headers unavailable'));

    const response = await POST(request());
    const body = await bodyOf(response);

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      success: true,
      paymentState: 'credited',
      transactionStatus: 'Completed',
    });
    expect(mocks.warn).toHaveBeenCalledWith(
      'Payments Verify notifications',
      'headers unavailable',
    );
    expect(mocks.notifyDepositFinalized).not.toHaveBeenCalled();
  });
});
