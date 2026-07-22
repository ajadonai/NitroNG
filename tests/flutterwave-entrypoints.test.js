import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  transactionFindUnique: vi.fn(),
  transactionCount: vi.fn(),
  transactionFindMany: vi.fn(),
  transactionUpdate: vi.fn(),
  transactionUpdateMany: vi.fn(),
  getFlutterwaveSecretKey: vi.fn(),
  reconcileFlutterwaveDeposit: vi.fn(),
  getNowPaymentsApiKey: vi.fn(),
  reconcileNowPaymentsDeposit: vi.fn(),
  finalizeDeposit: vi.fn(),
  notifyDepositFinalized: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  fetch: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  default: {
    transaction: {
      findUnique: mocks.transactionFindUnique,
      count: mocks.transactionCount,
      findMany: mocks.transactionFindMany,
      update: mocks.transactionUpdate,
      updateMany: mocks.transactionUpdateMany,
    },
  },
}));

vi.mock('@/lib/flutterwave-payment', () => ({
  getFlutterwaveSecretKey: mocks.getFlutterwaveSecretKey,
  reconcileFlutterwaveDeposit: mocks.reconcileFlutterwaveDeposit,
}));

vi.mock('@/lib/nowpayments-payment', () => ({
  getNowPaymentsApiKey: mocks.getNowPaymentsApiKey,
  NOWPAYMENTS_RECONCILABLE_STATUSES: [
    'Pending', 'Processing', 'Expired', 'Failed', 'Cancelled', 'Review', 'Rejected', 'Refunded',
  ],
  reconcileNowPaymentsDeposit: mocks.reconcileNowPaymentsDeposit,
}));

vi.mock('@/lib/deposit-finalization', () => ({
  finalizeDeposit: mocks.finalizeDeposit,
}));

vi.mock('@/lib/deposit-notifications', () => ({
  notifyDepositFinalized: mocks.notifyDepositFinalized,
}));

vi.mock('@/lib/logger', () => ({
  log: {
    info: mocks.info,
    warn: mocks.warn,
    error: mocks.error,
  },
}));

vi.stubGlobal('fetch', mocks.fetch);

const { POST: webhookPost } = await import('@/app/api/payments/webhook/route');
const { recoverStalePendingPayments } = await import('@/lib/payment-recovery');

function deposit(status = 'Pending', overrides = {}) {
  return {
    id: `tx-${status.toLowerCase()}`,
    userId: 'user-1',
    type: 'deposit',
    method: 'flutterwave',
    reference: `NTR-${status.toUpperCase()}`,
    amount: 500_000,
    status,
    note: 'Flutterwave deposit',
    createdAt: new Date('2026-07-16T10:00:00.000Z'),
    ...overrides,
  };
}

function useRecoveryBuckets({
  pending = [],
  processing = [],
  expired = [],
  crypto = [],
  cryptoReviewed = [],
  cryptoCompleted = [],
} = {}) {
  const rowsFor = where => {
    if (where.method === 'crypto') {
      if (where.status === 'Completed') return cryptoCompleted;
      if (
        Array.isArray(where.status?.in)
        && where.status.in.length === 2
        && where.status.in.includes('Rejected')
      ) return cryptoReviewed;
      return crypto;
    }
    if (where.status === 'Pending') return pending;
    if (where.status === 'Processing') return processing;
    if (where.status === 'Expired') return expired;
    return [];
  };
  mocks.transactionCount.mockImplementation(async ({ where }) => rowsFor(where).length);
  mocks.transactionFindMany.mockImplementation(async ({ where, skip = 0, take }) => {
    const rows = rowsFor(where);
    return rows.slice(skip, take === undefined ? undefined : skip + take);
  });
}

function webhookRequest({ signature = 'webhook-hash', event = 'charge.completed', data = {} } = {}) {
  return new Request('http://localhost/api/payments/webhook', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'verif-hash': signature,
    },
    body: JSON.stringify({
      event,
      data: {
        tx_ref: 'NTR-PENDING',
        status: 'successful',
        amount: 1,
        ...data,
      },
    }),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv('FLUTTERWAVE_WEBHOOK_HASH', 'webhook-hash');
  vi.stubEnv('NOWPAYMENTS_API_KEY', 'nowpayments-key');
  mocks.transactionCount.mockResolvedValue(0);
  mocks.transactionFindMany.mockResolvedValue([]);
  mocks.getFlutterwaveSecretKey.mockResolvedValue('flw-secret');
  mocks.getNowPaymentsApiKey.mockResolvedValue('nowpayments-key');
  mocks.transactionUpdate.mockResolvedValue({});
  mocks.transactionUpdateMany.mockResolvedValue({ count: 0 });
  mocks.notifyDepositFinalized.mockResolvedValue({ attempted: 1, failed: [] });
});

afterAll(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('POST /api/payments/webhook', () => {
  it('rejects an invalid v3 verif-hash before reading a transaction', async () => {
    const response = await webhookPost(webhookRequest({ signature: 'wrong-hash' }));

    expect(response.status).toBe(401);
    expect(mocks.transactionFindUnique).not.toHaveBeenCalled();
    expect(mocks.reconcileFlutterwaveDeposit).not.toHaveBeenCalled();
  });

  it('reconciles a signed charge.completed without preclaiming Processing or trusting callback amount', async () => {
    const transaction = deposit('Processing');
    const finalization = {
      finalized: true,
      transaction: { ...transaction, status: 'Completed' },
      depositAmount: transaction.amount,
    };
    mocks.transactionFindUnique.mockResolvedValue(transaction);
    mocks.reconcileFlutterwaveDeposit.mockResolvedValue({
      paymentState: 'credited',
      transactionStatus: 'Completed',
      retryable: false,
      transaction: finalization.transaction,
      finalization,
      newlyFinalized: true,
    });

    const response = await webhookPost(webhookRequest({
      data: { tx_ref: transaction.reference, amount: 0.01 },
    }));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ received: true });
    expect(mocks.transactionUpdateMany).not.toHaveBeenCalled();
    expect(mocks.reconcileFlutterwaveDeposit).toHaveBeenCalledWith({
      transaction,
      secretKey: 'flw-secret',
      recoveredBy: 'webhook',
    });
    expect(mocks.notifyDepositFinalized).toHaveBeenCalledTimes(1);
    expect(mocks.notifyDepositFinalized).toHaveBeenCalledWith(finalization, { channel: 'Flutterwave' });
  });

  it('does not notify for an already-completed reconciliation result', async () => {
    const transaction = deposit('Completed');
    mocks.transactionFindUnique.mockResolvedValue(transaction);
    mocks.reconcileFlutterwaveDeposit.mockResolvedValue({
      paymentState: 'credited',
      transactionStatus: 'Completed',
      retryable: false,
      transaction,
      finalization: null,
      newlyFinalized: false,
    });

    const response = await webhookPost(webhookRequest({ data: { tx_ref: transaction.reference } }));

    expect(response.status).toBe(200);
    expect(mocks.notifyDepositFinalized).not.toHaveBeenCalled();
  });

  it('acknowledges a signed callback safely when reconciliation throws', async () => {
    const transaction = deposit('Expired');
    mocks.transactionFindUnique.mockResolvedValue(transaction);
    mocks.reconcileFlutterwaveDeposit.mockRejectedValue(new Error('provider unavailable'));

    const response = await webhookPost(webhookRequest({ data: { tx_ref: transaction.reference } }));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ received: true });
    expect(mocks.notifyDepositFinalized).not.toHaveBeenCalled();
  });

  it('reconciles with an empty key so missing configuration cannot strand Processing', async () => {
    const transaction = deposit('Processing');
    mocks.transactionFindUnique.mockResolvedValue(transaction);
    mocks.getFlutterwaveSecretKey.mockResolvedValue('');
    mocks.reconcileFlutterwaveDeposit.mockResolvedValue({
      paymentState: 'retryable',
      transactionStatus: 'Expired',
      retryable: true,
      transaction: { ...transaction, status: 'Expired' },
      finalization: null,
      newlyFinalized: false,
    });

    const response = await webhookPost(webhookRequest({ data: { tx_ref: transaction.reference } }));

    expect(response.status).toBe(200);
    expect(mocks.reconcileFlutterwaveDeposit).toHaveBeenCalledWith({
      transaction,
      secretKey: '',
      recoveredBy: 'webhook',
    });
    expect(mocks.notifyDepositFinalized).not.toHaveBeenCalled();
  });
});

describe('recoverStalePendingPayments', () => {
  it('delegates legacy Processing with an empty key instead of leaving it stranded', async () => {
    const processing = deposit('Processing');
    useRecoveryBuckets({ processing: [processing] });
    mocks.getFlutterwaveSecretKey.mockResolvedValue('');
    mocks.reconcileFlutterwaveDeposit.mockResolvedValue({
      paymentState: 'retryable',
      transactionStatus: 'Expired',
      retryable: true,
      transaction: { ...processing, status: 'Expired' },
      finalization: null,
      newlyFinalized: false,
    });

    const stats = await recoverStalePendingPayments();

    expect(mocks.reconcileFlutterwaveDeposit).toHaveBeenCalledWith({
      transaction: processing,
      secretKey: '',
      recoveredBy: 'cron',
      timeoutMs: 8_000,
    });
    expect(stats).toMatchObject({ checked: 1, retryable: 1, recovered: 0 });
  });

  it('delegates every provider bucket through its shared reconciler', async () => {
    const flutterwaveRows = [deposit('Pending'), deposit('Expired'), deposit('Processing')];
    const crypto = deposit('Pending', {
      id: 'tx-crypto',
      method: 'crypto',
      reference: 'CRYPTO-1',
      note: 'Crypto deposit',
    });
    useRecoveryBuckets({
      pending: [flutterwaveRows[0]],
      processing: [flutterwaveRows[2]],
      expired: [flutterwaveRows[1]],
      crypto: [crypto],
    });
    mocks.reconcileFlutterwaveDeposit.mockImplementation(async ({ transaction }) => {
      if (transaction.status === 'Pending') {
        return {
          paymentState: 'credited',
          transactionStatus: 'Completed',
          retryable: false,
          transaction: { ...transaction, status: 'Completed' },
          finalization: { finalized: true, transaction: { ...transaction, status: 'Completed' } },
          newlyFinalized: true,
        };
      }
      if (transaction.status === 'Processing') {
        return {
          paymentState: 'retryable',
          transactionStatus: 'Expired',
          retryable: true,
          transaction: { ...transaction, status: 'Expired' },
          finalization: null,
          newlyFinalized: false,
        };
      }
      return {
        paymentState: 'provider_pending',
        transactionStatus: 'Pending',
        retryable: true,
        transaction: { ...transaction, status: 'Pending' },
        finalization: null,
        newlyFinalized: false,
      };
    });
    mocks.reconcileNowPaymentsDeposit.mockResolvedValue({
      paymentState: 'review',
      transactionStatus: 'Review',
      retryable: false,
      transaction: { ...crypto, status: 'Review' },
      finalization: null,
      newlyFinalized: false,
    });

    const stats = await recoverStalePendingPayments();

    const queries = mocks.transactionFindMany.mock.calls.map(([query]) => query);
    const flutterwavePending = queries.find(query => (
      query.where.status === 'Pending' && Array.isArray(query.where.OR)
    ));
    const flutterwaveProcessing = queries.find(query => query.where.status === 'Processing');
    const flutterwaveExpired = queries.find(query => query.where.status === 'Expired');
    const cryptoUnsettled = queries.find(query => (
      query.where.method === 'crypto'
      && Array.isArray(query.where.status?.in)
      && Array.isArray(query.where.status?.notIn)
    ));
    const cryptoReviewedAudit = queries.find(query => (
      query.where.method === 'crypto'
      && query.where.status?.in?.length === 2
      && query.where.status.in.includes('Rejected')
    ));
    const cryptoCompletedAudit = queries.find(query => (
      query.where.method === 'crypto' && query.where.status === 'Completed'
    ));
    expect(queries).toHaveLength(6);
    expect(flutterwavePending.take).toBe(4);
    expect(flutterwaveProcessing.take).toBe(3);
    expect(flutterwaveExpired.take).toBe(5);
    expect(cryptoUnsettled.take).toBe(3);
    expect(cryptoReviewedAudit.take).toBe(1);
    for (const query of [
      flutterwavePending,
      flutterwaveProcessing,
      flutterwaveExpired,
      cryptoUnsettled,
    ]) {
      expect(query.orderBy).toEqual([
        { createdAt: 'desc' },
        { id: 'desc' },
      ]);
    }
    expect(flutterwavePending.where.OR).toEqual(expect.arrayContaining([
      { method: 'flutterwave' },
      { method: null },
    ]));
    expect(flutterwavePending.where.createdAt.lt).toEqual(flutterwaveExpired.where.createdAt.lt);
    expect(flutterwaveProcessing.where.createdAt.lt.getTime())
      .toBeGreaterThan(flutterwavePending.where.createdAt.lt.getTime());
    expect(cryptoUnsettled.where.createdAt.lt).toEqual(flutterwaveExpired.where.createdAt.lt);
    expect(flutterwaveExpired.where.createdAt).not.toHaveProperty('gt');
    expect(cryptoUnsettled.where.status).toEqual({
      in: expect.arrayContaining(['Pending', 'Review', 'Rejected']),
      notIn: ['Review', 'Rejected'],
    });
    expect(cryptoReviewedAudit.where.AND).toEqual([
      {
        OR: [
          { providerPaymentId: { not: null } },
          { note: { contains: '[np:' } },
        ],
      },
      {
        OR: [
          { paymentReconciliationAttemptAt: null },
          { paymentReconciliationAttemptAt: { lt: expect.any(Date) } },
        ],
      },
    ]);
    expect(cryptoReviewedAudit.orderBy).toEqual([
      {
        paymentReconciliationAttemptAt: {
          sort: 'asc',
          nulls: 'first',
        },
      },
      { createdAt: 'asc' },
      { id: 'asc' },
    ]);
    expect(cryptoCompletedAudit.where.AND).toEqual([
      {
        OR: [
          { providerPaymentId: { not: null } },
          { note: { contains: '[np:' } },
        ],
      },
      {
        OR: [
          { paymentReconciliationAttemptAt: null },
          { paymentReconciliationAttemptAt: { lt: expect.any(Date) } },
        ],
      },
    ]);
    expect(flutterwaveExpired.where.createdAt).not.toHaveProperty('gt');
    expect(flutterwaveExpired.where.AND).toEqual([{
      OR: [
        { createdAt: { gt: expect.any(Date) } },
        {
          createdAt: { gt: expect.any(Date), lte: expect.any(Date) },
          OR: [
            { paymentReconciliationAttemptAt: null },
            { paymentReconciliationAttemptAt: { lt: expect.any(Date) } },
          ],
        },
        {
          createdAt: { lte: expect.any(Date) },
          OR: [
            { paymentReconciliationAttemptAt: null },
            { paymentReconciliationAttemptAt: { lt: expect.any(Date) } },
          ],
        },
      ],
    }]);
    expect(flutterwavePending.where.createdAt.gt).toBeInstanceOf(Date);
    expect(mocks.reconcileFlutterwaveDeposit).toHaveBeenCalledTimes(3);
    for (const transaction of flutterwaveRows) {
      expect(mocks.reconcileFlutterwaveDeposit).toHaveBeenCalledWith({
        transaction,
        secretKey: 'flw-secret',
        recoveredBy: 'cron',
        timeoutMs: 8_000,
      });
    }
    expect(mocks.notifyDepositFinalized).toHaveBeenCalledTimes(1);
    expect(mocks.reconcileNowPaymentsDeposit).toHaveBeenCalledWith({
      transaction: crypto,
      apiKey: 'nowpayments-key',
      recoveredBy: 'cron',
      timeoutMs: 8_000,
      auditCompleted: false,
      now: expect.any(Date),
    });
    expect(stats).toMatchObject({
      checked: 4,
      recovered: 1,
      pending: 1,
      retryable: 1,
      review: 1,
      expired: 0,
    });
  });

  it('limits provider concurrency and passes a timeout with a full fair queue', async () => {
    const pending = Array.from({ length: 4 }, (_, index) => deposit('Pending', {
      id: `pending-${index}`,
      reference: `NTR-PENDING-${index}`,
    }));
    const processing = Array.from({ length: 3 }, (_, index) => deposit('Processing', {
      id: `processing-${index}`,
      reference: `NTR-PROCESSING-${index}`,
    }));
    const expired = Array.from({ length: 3 }, (_, index) => deposit('Expired', {
      id: `expired-${index}`,
      reference: `NTR-EXPIRED-${index}`,
    }));
    useRecoveryBuckets({ pending, processing, expired });

    let inFlight = 0;
    let maxInFlight = 0;
    mocks.reconcileFlutterwaveDeposit.mockImplementation(async ({ transaction }) => {
      inFlight++;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise(resolve => setTimeout(resolve, 2));
      inFlight--;
      return {
        paymentState: 'retryable',
        transactionStatus: 'Expired',
        retryable: true,
        transaction: { ...transaction, status: 'Expired' },
        finalization: null,
        newlyFinalized: false,
      };
    });

    const stats = await recoverStalePendingPayments();

    expect(stats).toMatchObject({ checked: 10, retryable: 10 });
    expect(maxInFlight).toBe(4);
    expect(mocks.reconcileFlutterwaveDeposit).toHaveBeenCalledTimes(10);
    for (const [input] of mocks.reconcileFlutterwaveDeposit.mock.calls) {
      expect(input.timeoutMs).toBe(8_000);
    }
  });

  it('audits recent completed crypto deposits without re-crediting them', async () => {
    const completed = deposit('Completed', {
      id: 'crypto-completed',
      method: 'crypto',
      reference: 'CRYPTO-COMPLETED',
      providerPaymentId: 'np-completed',
    });
    useRecoveryBuckets({ cryptoCompleted: [completed] });
    mocks.reconcileNowPaymentsDeposit.mockResolvedValue({
      paymentState: 'review',
      transactionStatus: 'Completed',
      reason: 'refunded_after_credit',
      retryable: false,
      transaction: {
        ...completed,
        paymentReviewReason: 'refunded_after_credit',
      },
      finalization: null,
      newlyFinalized: false,
    });

    const now = new Date('2026-07-17T12:00:00.000Z');
    const stats = await recoverStalePendingPayments({ now });

    const completedQuery = mocks.transactionFindMany.mock.calls
      .map(([query]) => query)
      .find(query => query.where.method === 'crypto' && query.where.status === 'Completed');
    expect(completedQuery).toEqual(expect.objectContaining({
      take: 1,
      orderBy: [
        {
          paymentReconciliationAttemptAt: {
            sort: 'asc',
            nulls: 'first',
          },
        },
        { createdAt: 'asc' },
        { id: 'asc' },
      ],
    }));

    expect(mocks.reconcileNowPaymentsDeposit).toHaveBeenCalledWith({
      transaction: completed,
      apiKey: 'nowpayments-key',
      recoveredBy: 'cron',
      timeoutMs: 8_000,
      auditCompleted: true,
      now,
    });
    expect(mocks.notifyDepositFinalized).not.toHaveBeenCalled();
    expect(stats).toMatchObject({ checked: 1, audited: 1, review: 1, recovered: 0 });
  });

  it('audits a provider-bound Rejected payment without making it finalizable', async () => {
    const rejected = deposit('Rejected', {
      id: 'crypto-rejected',
      method: 'crypto',
      reference: 'CRYPTO-REJECTED',
      providerPaymentId: 'np-rejected',
      paymentReviewReason: 'underpayment',
      paymentReviewResolvedAt: new Date('2026-07-17T05:00:00.000Z'),
      paymentReconciliationAttemptAt: null,
    });
    useRecoveryBuckets({ cryptoReviewed: [rejected] });
    mocks.reconcileNowPaymentsDeposit.mockResolvedValue({
      paymentState: 'review',
      transactionStatus: 'Rejected',
      reason: 'provider_verified_after_rejection',
      retryable: false,
      transaction: {
        ...rejected,
        paymentReviewResolvedAt: null,
      },
      finalization: null,
      newlyFinalized: false,
    });

    const now = new Date('2026-07-17T12:00:00.000Z');
    const stats = await recoverStalePendingPayments({ now });

    expect(mocks.reconcileNowPaymentsDeposit).toHaveBeenCalledWith({
      transaction: rejected,
      apiKey: 'nowpayments-key',
      recoveredBy: 'cron',
      timeoutMs: 8_000,
      auditCompleted: false,
      auditRejected: true,
      now,
    });
    expect(stats).toMatchObject({ checked: 1, reviewAudited: 1, review: 1 });
    expect(mocks.notifyDepositFinalized).not.toHaveBeenCalled();
  });

  it('audits a changing Review/Rejected backlog by least recent attempt', async () => {
    const reviewed = Array.from({ length: 203 }, (_, index) => deposit(
      index % 2 === 0 ? 'Review' : 'Rejected',
      {
        id: `crypto-reviewed-${String(index).padStart(3, '0')}`,
        method: 'crypto',
        reference: `CRYPTO-REVIEWED-${index}`,
        providerPaymentId: `np-reviewed-${index}`,
        paymentReconciliationAttemptAt: null,
      },
    ));
    mocks.transactionCount.mockResolvedValue(0);
    mocks.transactionFindMany.mockImplementation(async ({ where, take }) => {
      if (
        where.method !== 'crypto'
        || !Array.isArray(where.status?.in)
        || where.status.in.length !== 2
      ) return [];
      const cutoff = where.AND[1].OR[1].paymentReconciliationAttemptAt.lt;
      const eligible = reviewed
        .filter(transaction => (
          transaction.paymentReconciliationAttemptAt === null
          || transaction.paymentReconciliationAttemptAt < cutoff
        ))
        .sort((left, right) => {
          if (left.paymentReconciliationAttemptAt === null) return -1;
          if (right.paymentReconciliationAttemptAt === null) return 1;
          const attemptOrder = left.paymentReconciliationAttemptAt
            - right.paymentReconciliationAttemptAt;
          return attemptOrder || left.id.localeCompare(right.id);
        });
      return eligible.slice(0, take);
    });
    mocks.reconcileNowPaymentsDeposit.mockImplementation(async ({ transaction, now }) => {
      transaction.paymentReconciliationAttemptAt = now;
      return {
        paymentState: 'review',
        transactionStatus: transaction.status,
        reason: transaction.paymentReviewReason,
        retryable: false,
        transaction,
        finalization: null,
        newlyFinalized: false,
      };
    });

    const audited = new Set();
    for (let slot = 0; slot < reviewed.length; slot++) {
      mocks.reconcileNowPaymentsDeposit.mockClear();
      const now = new Date(Date.UTC(2026, 6, 17) + (slot * 5 * 60 * 1000));
      await recoverStalePendingPayments({ now });
      audited.add(mocks.reconcileNowPaymentsDeposit.mock.calls[0][0].transaction.id);
    }

    expect(audited.size).toBe(reviewed.length);
  });

  it('audits a changing completed backlog by least recent attempt without starvation', async () => {
    const completed = Array.from({ length: 145 }, (_, index) => deposit('Completed', {
      id: `crypto-completed-${index}`,
      method: 'crypto',
      reference: `CRYPTO-COMPLETED-${index}`,
      providerPaymentId: `np-completed-${index}`,
      paymentReconciliationAttemptAt: null,
    }));
    mocks.transactionCount.mockResolvedValue(0);
    mocks.transactionFindMany.mockImplementation(async ({ where, take }) => {
      if (where.method !== 'crypto' || where.status !== 'Completed') return [];
      const cutoff = where.AND[1].OR[1].paymentReconciliationAttemptAt.lt;
      const eligible = completed
        .filter(transaction => (
          transaction.paymentReconciliationAttemptAt === null
          || transaction.paymentReconciliationAttemptAt < cutoff
        ))
        .sort((left, right) => {
          if (left.paymentReconciliationAttemptAt === null) return -1;
          if (right.paymentReconciliationAttemptAt === null) return 1;
          const attemptOrder = left.paymentReconciliationAttemptAt
            - right.paymentReconciliationAttemptAt;
          return attemptOrder || left.id.localeCompare(right.id);
        });
      return eligible.slice(0, take);
    });
    mocks.reconcileNowPaymentsDeposit.mockImplementation(async ({ transaction, now }) => {
      transaction.paymentReconciliationAttemptAt = now;
      return {
      paymentState: 'retryable',
      transactionStatus: 'Completed',
      reason: 'provider_http_error',
      retryable: true,
      transaction,
      finalization: null,
      newlyFinalized: false,
      };
    });

    const audited = new Set();
    for (let slot = 0; slot < completed.length; slot++) {
      mocks.reconcileNowPaymentsDeposit.mockClear();
      const now = new Date(Date.UTC(2026, 6, 17) + (slot * 5 * 60 * 1000));
      await recoverStalePendingPayments({ now });
      audited.add(mocks.reconcileNowPaymentsDeposit.mock.calls[0][0].transaction.id);
    }

    expect(audited.size).toBe(completed.length);
  });

  it('rotates through every eligible row across successive five-minute slots', async () => {
    const pending = Array.from({ length: 10 }, (_, index) => deposit('Pending', {
      id: `rotating-${index}`,
      reference: `NTR-ROTATING-${index}`,
    }));
    useRecoveryBuckets({ pending });
    mocks.reconcileFlutterwaveDeposit.mockImplementation(async ({ transaction }) => ({
      paymentState: 'retryable',
      transactionStatus: 'Expired',
      retryable: true,
      transaction: { ...transaction, status: 'Expired' },
      finalization: null,
      newlyFinalized: false,
    }));

    const windows = [];
    for (let slot = 0; slot < 3; slot++) {
      mocks.reconcileFlutterwaveDeposit.mockClear();
      const stats = await recoverStalePendingPayments({
        now: new Date(slot * 5 * 60 * 1000),
      });
      expect(stats.checked).toBe(4);
      windows.push(mocks.reconcileFlutterwaveDeposit.mock.calls.map(
        ([input]) => input.transaction.reference,
      ));
    }

    expect(windows).toEqual([
      ['NTR-ROTATING-0', 'NTR-ROTATING-1', 'NTR-ROTATING-2', 'NTR-ROTATING-3'],
      ['NTR-ROTATING-0', 'NTR-ROTATING-4', 'NTR-ROTATING-5', 'NTR-ROTATING-6'],
      ['NTR-ROTATING-0', 'NTR-ROTATING-7', 'NTR-ROTATING-8', 'NTR-ROTATING-9'],
    ]);
    expect(new Set(windows.flat())).toEqual(new Set(pending.map(tx => tx.reference)));

    const rotatingSkips = mocks.transactionFindMany.mock.calls
      .map(([query]) => query)
      .filter(query => query.where.status === 'Pending' && query.skip)
      .map(query => query.skip);
    expect(rotatingSkips).toEqual([1, 4, 7]);
  });
});
