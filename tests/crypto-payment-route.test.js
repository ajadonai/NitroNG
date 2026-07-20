import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  rateLimit: vi.fn(),
  getNowPaymentsCreationApiKey: vi.fn(),
  reconcileNowPaymentsDeposit: vi.fn(),
  recordNowPaymentsReview: vi.fn(),
  notifyDepositFinalized: vi.fn(),
  parseFbCookies: vi.fn(() => ({})),
  settingFindUnique: vi.fn(),
  userFindUnique: vi.fn(),
  userUpdate: vi.fn(),
  transactionFindUnique: vi.fn(),
  transactionFindFirst: vi.fn(),
  transactionCreate: vi.fn(),
  transactionUpdate: vi.fn(),
  transactionUpdateMany: vi.fn(),
  fetch: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
  getApplicationUrl: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({ getCurrentUser: mocks.getCurrentUser }));
vi.mock('@/lib/rate-limit', () => ({ rateLimit: mocks.rateLimit }));
vi.mock('@/lib/meta-capi', () => ({ parseFbCookies: mocks.parseFbCookies }));
vi.mock('@/lib/logger', () => ({
  log: { warn: mocks.warn, error: mocks.error, info: mocks.info },
}));
vi.mock('@/lib/prisma', () => ({
  default: {
    setting: { findUnique: mocks.settingFindUnique },
    user: { findUnique: mocks.userFindUnique, update: mocks.userUpdate },
    transaction: {
      findUnique: mocks.transactionFindUnique,
      findFirst: mocks.transactionFindFirst,
      create: mocks.transactionCreate,
      update: mocks.transactionUpdate,
      updateMany: mocks.transactionUpdateMany,
    },
  },
}));
vi.mock('@/lib/deposit-finalization', () => ({
  isReservedDepositEffectKey: value => typeof value === 'string' && value.startsWith('payment:'),
}));
vi.mock('@/lib/provider-query-lease', () => ({
  isReservedProviderQueryLeaseKey: value => (
    typeof value === 'string' && value.startsWith('payment:provider-query:')
  ),
}));
vi.mock('@/lib/nowpayments-payment', () => ({
  getNowPaymentsCreationApiKey: mocks.getNowPaymentsCreationApiKey,
  reconcileNowPaymentsDeposit: mocks.reconcileNowPaymentsDeposit,
  recordNowPaymentsReview: mocks.recordNowPaymentsReview,
}));
vi.mock('@/lib/deposit-notifications', () => ({
  notifyDepositFinalized: mocks.notifyDepositFinalized,
}));
vi.mock('@/lib/env', () => ({
  getApplicationUrl: mocks.getApplicationUrl,
}));

vi.stubGlobal('fetch', mocks.fetch);

const { DELETE, GET, POST } = await import('@/app/api/payments/crypto/route');

const USER_ID = 'user-crypto-1';
const IDEMPOTENCY_KEY = 'customer-attempt-1';
const REFERENCE = 'NTR-CRYPTO-TEST-1';
const PAYMENT_ID = '900719925474099312345';

function request(method, body, search = '') {
  return new Request(`https://nitro.ng/api/payments/crypto${search}`, {
    method,
    headers: { 'Content-Type': 'application/json', cookie: 'test=1' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

function pendingTransaction(overrides = {}) {
  return {
    id: 'deposit-1',
    userId: USER_ID,
    type: 'deposit',
    method: 'crypto',
    amount: 5_000_000,
    status: 'Pending',
    reference: REFERENCE,
    idempotencyKey: IDEMPOTENCY_KEY,
    note: 'Crypto deposit',
    providerPaymentId: null,
    providerPriceAmount: '31.25',
    providerPriceCurrency: 'usd',
    providerPayAmount: null,
    providerPayCurrency: 'usdttrc20',
    providerPayAddress: null,
    paymentReviewReason: null,
    paymentReviewResolvedAt: null,
    ...overrides,
  };
}

function providerCreation(overrides = {}) {
  return {
    payment_id: PAYMENT_ID,
    payment_status: 'waiting',
    order_id: REFERENCE,
    parent_payment_id: null,
    price_amount: '31.25',
    price_currency: 'usd',
    pay_amount: '30.125',
    pay_currency: 'usdttrc20',
    pay_address: 'TMwFHYXLJaRUPeW6421aqXL4ZEzPRFGkGT',
    expiration_estimate_date: '2026-07-17T02:00:00Z',
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getCurrentUser.mockResolvedValue({ id: USER_ID });
  mocks.rateLimit.mockResolvedValue({ limited: false });
  mocks.getNowPaymentsCreationApiKey.mockResolvedValue('np-key');
  mocks.settingFindUnique.mockResolvedValue({ value: '1600' });
  mocks.userFindUnique.mockResolvedValue({
    id: USER_ID,
    email: 'user@example.test',
    name: 'Crypto User',
  });
  mocks.userUpdate.mockResolvedValue({ id: USER_ID });
  mocks.transactionFindUnique.mockResolvedValue(null);
  mocks.transactionFindFirst.mockResolvedValue(null);
  mocks.transactionUpdateMany.mockResolvedValue({ count: 1 });
  mocks.notifyDepositFinalized.mockResolvedValue({ attempted: 1, failed: [] });
  mocks.getApplicationUrl.mockReturnValue('https://nitro.example');
});

describe('POST /api/payments/crypto', () => {
  it('returns a retryable 503 before database or provider work when protection is unavailable', async () => {
    mocks.rateLimit.mockResolvedValueOnce({
      limited: true,
      unavailable: true,
      remaining: 0,
      retryAfter: 9,
    });

    const response = await POST(request('POST', {
      amount: 50_000,
      idempotencyKey: IDEMPOTENCY_KEY,
    }));
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(response.headers.get('retry-after')).toBe('9');
    expect(body).toMatchObject({
      success: false,
      paymentState: 'retryable',
      retryable: true,
      unavailable: true,
    });
    expect(mocks.userFindUnique).not.toHaveBeenCalled();
    expect(mocks.transactionCreate).not.toHaveBeenCalled();
    expect(mocks.fetch).not.toHaveBeenCalled();
  });

  it('blocks new invoices when the crypto gateway is disabled', async () => {
    mocks.getNowPaymentsCreationApiKey.mockResolvedValue('');

    const response = await POST(request('POST', {
      amount: 50_000,
      idempotencyKey: IDEMPOTENCY_KEY,
    }));
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body.error).toBe('Crypto payments are not available');
    expect(mocks.transactionCreate).not.toHaveBeenCalled();
    expect(mocks.fetch).not.toHaveBeenCalled();
  });

  it('validates the callback origin before creating a durable Pending attempt', async () => {
    mocks.getApplicationUrl.mockImplementationOnce(() => {
      throw new Error('NEXT_PUBLIC_APP_URL is invalid');
    });

    const response = await POST(request('POST', {
      amount: 50_000,
      idempotencyKey: IDEMPOTENCY_KEY,
    }));

    expect(response.status).toBe(503);
    expect(mocks.transactionCreate).not.toHaveBeenCalled();
    expect(mocks.fetch).not.toHaveBeenCalled();
  });

  it('persists exact expected terms before making one provider POST', async () => {
    const order = [];
    let created;
    let stored;
    mocks.transactionCreate.mockImplementation(async ({ data }) => {
      order.push('local-create');
      created = { ...pendingTransaction(), ...data, id: 'deposit-1' };
      stored = created;
      return created;
    });
    mocks.fetch.mockImplementation(async (_url, options) => {
      order.push('provider-post');
      const providerRequest = JSON.parse(options.body);
      return Response.json(providerCreation({
        order_id: providerRequest.order_id,
        price_amount: providerRequest.price_amount,
      }));
    });
    mocks.transactionUpdateMany.mockImplementation(async ({ data }) => {
      stored = { ...stored, ...data };
      return { count: 1 };
    });
    mocks.transactionFindUnique.mockImplementation(async ({ where }) => (
      where.userId_idempotencyKey ? null : stored
    ));

    const response = await POST(request('POST', {
      amount: 50_000,
      idempotencyKey: IDEMPOTENCY_KEY,
    }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(order).toEqual(['local-create', 'provider-post']);
    expect(mocks.fetch).toHaveBeenCalledTimes(1);
    expect(mocks.transactionCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: USER_ID,
        type: 'deposit',
        method: 'crypto',
        amount: 5_000_000,
        status: 'Pending',
        idempotencyKey: IDEMPOTENCY_KEY,
        providerPriceAmount: '31.25',
        providerPriceCurrency: 'usd',
        providerPayCurrency: 'usdttrc20',
      }),
    });
    expect(body).toMatchObject({
      paymentId: PAYMENT_ID,
      payAddress: 'TMwFHYXLJaRUPeW6421aqXL4ZEzPRFGkGT',
      payAmount: '30.125',
      reference: created.reference,
      status: 'Pending',
    });
  });

  it('does not retry an ambiguous provider failure or delete its durable row', async () => {
    const created = pendingTransaction();
    mocks.transactionCreate.mockResolvedValue(created);
    mocks.fetch.mockResolvedValue(Response.json(
      { message: 'temporary provider failure' },
      { status: 503 },
    ));

    const response = await POST(request('POST', {
      amount: 50_000,
      idempotencyKey: IDEMPOTENCY_KEY,
    }));
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body).toMatchObject({
      paymentState: 'retryable',
      retryable: true,
      reference: REFERENCE,
      reason: 'provider_http_error',
    });
    expect(mocks.fetch).toHaveBeenCalledTimes(1);
    expect(mocks.transactionCreate).toHaveBeenCalledTimes(1);
    expect(mocks.transactionUpdateMany).not.toHaveBeenCalled();
  });

  it('replays stored instructions for a duplicate key without another provider call', async () => {
    mocks.transactionFindUnique.mockResolvedValue(pendingTransaction({
      providerPaymentId: PAYMENT_ID,
      providerPayAmount: '30.125',
      providerPayAddress: 'TStoredAddress',
    }));

    const response = await POST(request('POST', {
      amount: 50_000,
      idempotencyKey: IDEMPOTENCY_KEY,
    }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      deduplicated: true,
      paymentId: PAYMENT_ID,
      payAddress: 'TStoredAddress',
      reference: REFERENCE,
    });
    expect(mocks.transactionCreate).not.toHaveBeenCalled();
    expect(mocks.fetch).not.toHaveBeenCalled();
  });

  it.each([
    ['a different amount', pendingTransaction(), { amount: 60_000 }],
    [
      'a different coupon',
      pendingTransaction({ note: 'Crypto deposit [coupon:coupon-one]' }),
      { amount: 50_000, couponId: 'coupon-two' },
    ],
  ])('rejects reuse of a key for %s', async (_label, existing, requestPatch) => {
    mocks.transactionFindUnique.mockResolvedValue(existing);

    const response = await POST(request('POST', {
      amount: 50_000,
      idempotencyKey: IDEMPOTENCY_KEY,
      ...requestPatch,
    }));

    expect(response.status).toBe(409);
    expect(mocks.fetch).not.toHaveBeenCalled();
    expect(mocks.transactionCreate).not.toHaveBeenCalled();
  });

  it('replays instructions when an old review marker has already been resolved', async () => {
    mocks.transactionFindUnique.mockResolvedValue(pendingTransaction({
      providerPaymentId: PAYMENT_ID,
      providerPayAmount: '30.125',
      providerPayAddress: 'TStoredAddress',
      paymentReviewReason: 'old_review',
      paymentReviewResolvedAt: new Date('2026-07-16T00:00:00Z'),
    }));

    const response = await POST(request('POST', {
      amount: 50_000,
      idempotencyKey: IDEMPOTENCY_KEY,
    }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      deduplicated: true,
      payAddress: 'TStoredAddress',
      status: 'Pending',
    });
  });

  it('replays a manually rejected attempt as terminal instead of retryable', async () => {
    mocks.transactionFindUnique.mockResolvedValue(pendingTransaction({
      status: 'Rejected',
      paymentReviewReason: 'underpayment',
      paymentReviewResolvedAt: new Date('2026-07-17T00:00:00Z'),
    }));

    const response = await POST(request('POST', {
      amount: 50_000,
      idempotencyKey: IDEMPOTENCY_KEY,
    }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      paymentState: 'failed',
      status: 'Rejected',
      retryable: false,
      deduplicated: true,
    });
    expect(mocks.fetch).not.toHaveBeenCalled();
    expect(mocks.transactionCreate).not.toHaveBeenCalled();
  });

  it('puts a creation response with an already-bound provider ID into durable review', async () => {
    let created;
    mocks.transactionCreate.mockImplementation(async ({ data }) => {
      created = { ...pendingTransaction(), ...data, id: 'deposit-1' };
      return created;
    });
    mocks.fetch.mockImplementation(async (_url, options) => {
      const providerRequest = JSON.parse(options.body);
      return Response.json(providerCreation({
        order_id: providerRequest.order_id,
        price_amount: providerRequest.price_amount,
      }));
    });
    mocks.transactionUpdateMany
      .mockRejectedValueOnce({ code: 'P2002' })
      .mockResolvedValue({ count: 1 });
    mocks.transactionFindUnique.mockImplementation(async ({ where }) => (
      where.userId_idempotencyKey ? null : created
    ));
    mocks.recordNowPaymentsReview.mockImplementation(async ({ transaction, reason }) => ({
      ...transaction,
      status: 'Review',
      paymentReviewReason: reason,
      paymentReviewResolvedAt: null,
    }));

    const response = await POST(request('POST', {
      amount: 50_000,
      idempotencyKey: IDEMPOTENCY_KEY,
    }));
    const body = await response.json();

    expect(response.status).toBe(422);
    expect(body).toMatchObject({
      paymentState: 'review',
      status: 'Review',
      reason: 'provider_payment_id_reused',
    });
    expect(mocks.recordNowPaymentsReview).toHaveBeenCalledWith(expect.objectContaining({
      reason: 'provider_payment_id_reused',
    }));
    expect(mocks.transactionUpdate).not.toHaveBeenCalled();
  });

  it('does not overwrite a different provider ID concurrently adopted on the same row', async () => {
    let created;
    mocks.transactionCreate.mockImplementation(async ({ data }) => {
      created = { ...pendingTransaction(), ...data, id: 'deposit-1' };
      return created;
    });
    mocks.fetch.mockImplementation(async (_url, options) => {
      const providerRequest = JSON.parse(options.body);
      return Response.json(providerCreation({
        order_id: providerRequest.order_id,
        price_amount: providerRequest.price_amount,
      }));
    });

    mocks.transactionUpdateMany.mockResolvedValueOnce({ count: 0 });
    mocks.transactionFindUnique.mockImplementation(async ({ where }) => (
      where.userId_idempotencyKey
        ? null
        : {
            ...created,
            providerPaymentId: 'different-provider-payment',
            providerPayAmount: '44.5',
            providerPayAddress: 'TDifferentInvoiceAddress',
          }
    ));
    mocks.recordNowPaymentsReview.mockImplementation(async ({ transaction, reason }) => ({
      ...transaction,
      status: 'Review',
      paymentReviewReason: reason,
      paymentReviewResolvedAt: null,
    }));

    const response = await POST(request('POST', {
      amount: 50_000,
      idempotencyKey: IDEMPOTENCY_KEY,
    }));
    const body = await response.json();

    expect(response.status).toBe(422);
    expect(body).toMatchObject({
      paymentState: 'review',
      reason: 'provider_payment_id_reused',
    });
    expect(mocks.transactionUpdateMany).toHaveBeenCalledTimes(1);
    expect(mocks.transactionUpdateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        id: 'deposit-1',
        OR: [
          { providerPaymentId: null },
          { providerPaymentId: PAYMENT_ID },
        ],
      },
      data: expect.objectContaining({
        providerPaymentId: PAYMENT_ID,
        providerPayAmount: '30.125',
        providerPayAddress: 'TMwFHYXLJaRUPeW6421aqXL4ZEzPRFGkGT',
      }),
    }));
    expect(mocks.transactionUpdate).not.toHaveBeenCalled();
    expect(mocks.recordNowPaymentsReview).toHaveBeenCalledWith(expect.objectContaining({
      transaction: expect.objectContaining({
        providerPaymentId: 'different-provider-payment',
        providerPayAmount: '44.5',
        providerPayAddress: 'TDifferentInvoiceAddress',
      }),
      reason: 'provider_payment_id_reused',
    }));
  });

  it('keeps a malformed creation response as a durable manual-review record', async () => {
    let created;
    mocks.transactionCreate.mockImplementation(async ({ data }) => {
      created = { ...pendingTransaction(), ...data, id: 'deposit-1' };
      return created;
    });
    mocks.fetch.mockResolvedValue(Response.json({
      payment_status: 'waiting',
      order_id: REFERENCE,
      price_amount: '31.25',
      price_currency: 'usd',
      pay_amount: '30.125',
      pay_currency: 'usdttrc20',
      pay_address: 'TUnknownPayment',
    }));
    mocks.recordNowPaymentsReview.mockImplementation(async ({ transaction, reason }) => ({
      ...transaction,
      status: 'Review',
      paymentReviewReason: reason,
      paymentReviewResolvedAt: null,
    }));

    const response = await POST(request('POST', {
      amount: 50_000,
      idempotencyKey: IDEMPOTENCY_KEY,
    }));
    const body = await response.json();

    expect(response.status).toBe(422);
    expect(body).toMatchObject({
      paymentState: 'review',
      status: 'Review',
      reason: 'creation_response_mismatch',
    });
    expect(mocks.fetch).toHaveBeenCalledTimes(1);
    expect(mocks.recordNowPaymentsReview).toHaveBeenCalledWith(expect.objectContaining({
      reason: 'creation_response_mismatch',
      details: expect.objectContaining({ validationReason: 'invalid_payment_id' }),
    }));
  });

  it('rejects the internal payment namespace before any provider or transaction work', async () => {
    const response = await POST(request('POST', {
      amount: 50_000,
      idempotencyKey: 'payment:provider-query:nowpayments:deposit-1',
    }));

    expect(response.status).toBe(400);
    expect(mocks.transactionFindUnique).not.toHaveBeenCalled();
    expect(mocks.transactionCreate).not.toHaveBeenCalled();
    expect(mocks.fetch).not.toHaveBeenCalled();
  });
});

describe('GET /api/payments/crypto', () => {
  it('scopes reconciliation to the authenticated user and notifies only a new finalization', async () => {
    const transaction = pendingTransaction({ status: 'Completed' });
    const finalization = { finalized: true, transaction };
    mocks.reconcileNowPaymentsDeposit.mockResolvedValue({
      success: true,
      paymentState: 'credited',
      transactionStatus: 'Completed',
      retryable: false,
      transaction,
      finalization,
      newlyFinalized: true,
      reason: 'finalized',
      message: 'Payment successful',
      providerStatus: 'finished',
    });

    const response = await GET(request('GET', undefined, `?reference=${REFERENCE}`));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      success: true,
      paymentState: 'credited',
      status: 'Completed',
      reference: REFERENCE,
    });
    expect(mocks.reconcileNowPaymentsDeposit).toHaveBeenCalledWith({
      reference: REFERENCE,
      userId: USER_ID,
    });
    expect(mocks.notifyDepositFinalized).toHaveBeenCalledTimes(1);
  });

  it('does not replay notifications for an already-completed payment', async () => {
    const transaction = pendingTransaction({ status: 'Completed' });
    mocks.reconcileNowPaymentsDeposit.mockResolvedValue({
      success: true,
      paymentState: 'credited',
      transactionStatus: 'Completed',
      retryable: false,
      transaction,
      finalization: null,
      newlyFinalized: false,
      reason: 'already_completed',
      message: 'Already credited',
    });

    const response = await GET(request('GET', undefined, `?reference=${REFERENCE}`));

    expect(response.status).toBe(200);
    expect(mocks.notifyDepositFinalized).not.toHaveBeenCalled();
  });

  it('returns the deliberate post-credit refund path as manual review, not a retry error', async () => {
    const transaction = pendingTransaction({
      status: 'Completed',
      paymentReviewReason: 'refunded_after_credit',
      paymentReviewResolvedAt: null,
    });
    mocks.reconcileNowPaymentsDeposit.mockResolvedValue({
      success: false,
      paymentState: 'review',
      transactionStatus: 'Completed',
      retryable: false,
      transaction,
      finalization: null,
      newlyFinalized: false,
      reason: 'refunded_after_credit',
      message: 'This payment was refunded and is awaiting account review.',
      providerStatus: 'refunded',
    });

    const response = await GET(request('GET', undefined, `?reference=${REFERENCE}`));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      success: false,
      paymentState: 'review',
      status: 'Completed',
      reason: 'refunded_after_credit',
    });
    expect(body.reason).not.toBe('inconsistent_financial_state');
    expect(mocks.notifyDepositFinalized).not.toHaveBeenCalled();
  });
});

describe('DELETE /api/payments/crypto', () => {
  it('marks a pending owned deposit Cancelled without deleting its evidence', async () => {
    mocks.transactionFindFirst.mockResolvedValue(pendingTransaction());
    mocks.transactionFindUnique.mockResolvedValue(pendingTransaction({ status: 'Cancelled' }));

    const response = await DELETE(request('DELETE', { reference: REFERENCE }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      success: true,
      status: 'Cancelled',
      reference: REFERENCE,
    });
    expect(mocks.transactionUpdateMany).toHaveBeenCalledWith({
      where: expect.objectContaining({
        id: 'deposit-1',
        type: 'deposit',
        method: 'crypto',
        status: { in: ['Pending', 'Processing'] },
      }),
      data: { status: 'Cancelled' },
    });
  });

  it('returns credited state if reconciliation completes during cancellation', async () => {
    mocks.transactionFindFirst.mockResolvedValue(pendingTransaction());
    mocks.transactionFindUnique.mockResolvedValue(pendingTransaction({ status: 'Completed' }));

    const response = await DELETE(request('DELETE', { reference: REFERENCE }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      success: true,
      paymentState: 'credited',
      status: 'Completed',
      reference: REFERENCE,
    });
  });
});
