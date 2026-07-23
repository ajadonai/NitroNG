import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  transactionCount: vi.fn().mockResolvedValue(0),
  transactionFindMany: vi.fn().mockResolvedValue([]),
  transactionUpdate: vi.fn().mockResolvedValue({}),
  transactionUpdateMany: vi.fn().mockResolvedValue({ count: 0 }),
  idempotencyKeyCreateMany: vi.fn().mockResolvedValue({ count: 0 }),
  idempotencyKeyFindMany: vi.fn().mockResolvedValue([]),
  idempotencyKeyDeleteMany: vi.fn().mockResolvedValue({ count: 0 }),
  reconcileFlutterwaveDeposit: vi.fn(),
  reconcileNowPaymentsDeposit: vi.fn(),
  getFlutterwaveSecretKey: vi.fn().mockResolvedValue('FLWSECK_TEST'),
  getNowPaymentsApiKey: vi.fn().mockResolvedValue('NP_TEST'),
  notifyDepositFinalized: vi.fn().mockResolvedValue(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  reportOperationalFailure: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  default: {
    transaction: {
      count: mocks.transactionCount,
      findMany: mocks.transactionFindMany,
      update: mocks.transactionUpdate,
      updateMany: mocks.transactionUpdateMany,
    },
    idempotencyKey: {
      createMany: mocks.idempotencyKeyCreateMany,
      findMany: mocks.idempotencyKeyFindMany,
      deleteMany: mocks.idempotencyKeyDeleteMany,
    },
  },
}));

vi.mock('@/lib/flutterwave-payment', () => ({
  getFlutterwaveSecretKey: mocks.getFlutterwaveSecretKey,
  reconcileFlutterwaveDeposit: mocks.reconcileFlutterwaveDeposit,
}));

vi.mock('@/lib/nowpayments-payment', () => ({
  getNowPaymentsApiKey: mocks.getNowPaymentsApiKey,
  NOWPAYMENTS_RECONCILABLE_STATUSES: ['Pending', 'Processing', 'Expired'],
  reconcileNowPaymentsDeposit: mocks.reconcileNowPaymentsDeposit,
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

vi.mock('@/lib/monitoring', () => ({
  reportOperationalFailure: mocks.reportOperationalFailure,
}));

const { recoverStalePendingPayments } = await import('@/lib/payment-recovery');

function deposit(overrides = {}) {
  return {
    id: `tx-${Math.random().toString(36).slice(2, 8)}`,
    userId: 'user-1',
    type: 'deposit',
    method: 'flutterwave',
    reference: `NTR-FLW-${Math.random().toString(36).slice(2, 8)}`,
    amount: 500_000,
    status: 'Pending',
    note: null,
    createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.transactionCount.mockResolvedValue(0);
  mocks.transactionFindMany.mockResolvedValue([]);
  mocks.transactionUpdate.mockResolvedValue({});
  mocks.transactionUpdateMany.mockResolvedValue({ count: 0 });
});

describe('24-hour sweep', () => {
  it('marks stale Pending deposits as Expired, not Cancelled', async () => {
    const now = new Date();
    await recoverStalePendingPayments({ now });

    const sweepCall = mocks.transactionUpdateMany.mock.calls.find(
      ([{ where }]) => where.status === 'Pending' && where.createdAt?.lt,
    );
    expect(sweepCall).toBeDefined();
    expect(sweepCall[0].data.status).toBe('Expired');
    expect(sweepCall[0].data.status).not.toBe('Cancelled');
  });

  it('reports the number of expired deposits in stats', async () => {
    mocks.transactionUpdateMany.mockResolvedValueOnce({ count: 5 });
    const stats = await recoverStalePendingPayments({ now: new Date() });

    expect(stats.abandoned).toBe(5);
    expect(mocks.info).toHaveBeenCalledWith(
      'Payment Recovery',
      expect.stringContaining('Expired 5'),
    );
  });
});

describe('Expired bucket coverage', () => {
  it('recovery bucket has no lower age bound for Expired deposits', async () => {
    const now = new Date();
    await recoverStalePendingPayments({ now });

    const expiredBucketCall = mocks.transactionCount.mock.calls.find(
      ([{ where }]) => where.status === 'Expired',
    );
    if (expiredBucketCall) {
      expect(expiredBucketCall[0].where.createdAt).not.toHaveProperty('gt');
    } else {
      const findCall = mocks.transactionFindMany.mock.calls.find(
        ([{ where }]) => where?.status === 'Expired',
      );
      expect(findCall).toBeDefined();
      expect(findCall[0].where.createdAt).not.toHaveProperty('gt');
    }
  });

  it('a 60-day-old Expired deposit is eligible for recovery', async () => {
    const now = new Date();
    const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
    const oldDeposit = deposit({
      id: 'tx-60d',
      status: 'Expired',
      createdAt: sixtyDaysAgo,
    });

    mocks.transactionCount.mockImplementation(async ({ where }) => {
      if (where.status === 'Expired') return 1;
      return 0;
    });
    mocks.transactionFindMany.mockImplementation(async ({ where }) => {
      if (where?.status === 'Expired') return [oldDeposit];
      return [];
    });
    mocks.reconcileFlutterwaveDeposit.mockResolvedValue({
      paymentState: 'credited',
      newlyFinalized: true,
      finalization: { finalized: true, transaction: { ...oldDeposit, status: 'Completed' } },
    });

    const stats = await recoverStalePendingPayments({ now });

    expect(mocks.reconcileFlutterwaveDeposit).toHaveBeenCalled();
    expect(stats.recovered).toBe(1);
  });
});

describe('pending-then-success recovery', () => {
  it('credits a deposit that Flutterwave confirms as successful on a later reconciliation', async () => {
    const now = new Date();
    const threeHoursAgo = new Date(now.getTime() - 3 * 60 * 60 * 1000);
    const expiredDeposit = deposit({
      id: 'tx-pending-later-success',
      status: 'Expired',
      createdAt: threeHoursAgo,
    });

    mocks.transactionCount.mockImplementation(async ({ where }) => {
      if (where.status === 'Expired') return 1;
      return 0;
    });
    mocks.transactionFindMany.mockImplementation(async ({ where }) => {
      if (where?.status === 'Expired') return [expiredDeposit];
      return [];
    });
    mocks.reconcileFlutterwaveDeposit.mockResolvedValue({
      paymentState: 'credited',
      newlyFinalized: true,
      finalization: {
        finalized: true,
        transaction: { ...expiredDeposit, status: 'Completed' },
      },
    });

    const stats = await recoverStalePendingPayments({ now });

    expect(stats.recovered).toBe(1);
    expect(mocks.notifyDepositFinalized).toHaveBeenCalledTimes(1);
  });
});

describe('gradual backoff for old deposits', () => {
  function expiredBucketMatcher(where) {
    return where.status === 'Expired' && where.AND;
  }

  function matchesBackoff(deposit, where) {
    const tiers = where.AND[0].OR;
    const fourHourTier = tiers.find(t => t.createdAt?.gt && !t.OR);
    if (fourHourTier && deposit.createdAt > fourHourTier.createdAt.gt) return true;
    for (const tier of tiers.filter(t => t.OR)) {
      const { gt, lte } = tier.createdAt || {};
      const inRange = (!gt || deposit.createdAt > gt) && (!lte || deposit.createdAt <= lte);
      if (!inRange) continue;
      const attemptNull = deposit.paymentReconciliationAttemptAt === null;
      const attemptCutoff = tier.OR.find(c => c.paymentReconciliationAttemptAt?.lt)?.paymentReconciliationAttemptAt.lt;
      if (attemptNull || (attemptCutoff && deposit.paymentReconciliationAttemptAt < attemptCutoff)) return true;
    }
    return false;
  }

  function useExpiredBackoffBuckets(deposits) {
    mocks.transactionCount.mockImplementation(async ({ where }) => {
      if (expiredBucketMatcher(where)) {
        return deposits.filter(d => matchesBackoff(d, where)).length;
      }
      return 0;
    });
    mocks.transactionFindMany.mockImplementation(async ({ where }) => {
      if (where && expiredBucketMatcher(where)) {
        return deposits.filter(d => matchesBackoff(d, where));
      }
      return [];
    });
  }

  it('does not throttle deposits within the 4-hour badge window', async () => {
    const now = new Date('2026-07-20T12:00:00.000Z');
    const d = deposit({
      id: 'tx-recent',
      status: 'Expired',
      createdAt: new Date(now.getTime() - 2 * 60 * 60 * 1000),
      paymentReconciliationAttemptAt: new Date(now.getTime() - 10 * 60 * 1000),
    });
    useExpiredBackoffBuckets([d]);
    mocks.reconcileFlutterwaveDeposit.mockResolvedValue({
      paymentState: 'retryable',
      newlyFinalized: false,
      finalization: null,
    });

    const stats = await recoverStalePendingPayments({ now });

    expect(mocks.reconcileFlutterwaveDeposit).toHaveBeenCalled();
    expect(stats.errors).toEqual([]);
  });

  it('throttles a 5-hour-old deposit with a 30-minute-old attempt (hourly tier)', async () => {
    const now = new Date('2026-07-20T12:00:00.000Z');
    const d = deposit({
      id: 'tx-5h',
      status: 'Expired',
      createdAt: new Date(now.getTime() - 5 * 60 * 60 * 1000),
      paymentReconciliationAttemptAt: new Date(now.getTime() - 30 * 60 * 1000),
    });
    useExpiredBackoffBuckets([d]);

    const stats = await recoverStalePendingPayments({ now });

    expect(mocks.reconcileFlutterwaveDeposit).not.toHaveBeenCalled();
    expect(stats.checked).toBe(0);
  });

  it('allows a 5-hour-old deposit whose attempt is older than 1 hour', async () => {
    const now = new Date('2026-07-20T12:00:00.000Z');
    const d = deposit({
      id: 'tx-5h-stale',
      status: 'Expired',
      createdAt: new Date(now.getTime() - 5 * 60 * 60 * 1000),
      paymentReconciliationAttemptAt: new Date(now.getTime() - 90 * 60 * 1000),
    });
    useExpiredBackoffBuckets([d]);
    mocks.reconcileFlutterwaveDeposit.mockResolvedValue({
      paymentState: 'retryable',
      newlyFinalized: false,
      finalization: null,
    });

    const stats = await recoverStalePendingPayments({ now });

    expect(mocks.reconcileFlutterwaveDeposit).toHaveBeenCalled();
    expect(stats.errors).toEqual([]);
  });

  it('uses 6-hour intervals for deposits older than 24 hours', async () => {
    const now = new Date('2026-07-20T12:00:00.000Z');
    const d = deposit({
      id: 'tx-3d-recent',
      status: 'Expired',
      createdAt: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000),
      paymentReconciliationAttemptAt: new Date(now.getTime() - 2 * 60 * 60 * 1000),
    });
    useExpiredBackoffBuckets([d]);

    const stats = await recoverStalePendingPayments({ now });

    expect(mocks.reconcileFlutterwaveDeposit).not.toHaveBeenCalled();
    expect(stats.checked).toBe(0);
  });

  it('allows an old deposit with no prior reconciliation attempt', async () => {
    const now = new Date('2026-07-20T12:00:00.000Z');
    const d = deposit({
      id: 'tx-old-null',
      status: 'Expired',
      createdAt: new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000),
      paymentReconciliationAttemptAt: null,
    });
    useExpiredBackoffBuckets([d]);
    mocks.reconcileFlutterwaveDeposit.mockResolvedValue({
      paymentState: 'retryable',
      newlyFinalized: false,
      finalization: null,
    });

    const stats = await recoverStalePendingPayments({ now });

    expect(mocks.reconcileFlutterwaveDeposit).toHaveBeenCalled();
    expect(stats.errors).toEqual([]);
  });
});

describe('reconciliation attempt stamping', () => {
  it('stamps paymentReconciliationAttemptAt after a provider query', async () => {
    const now = new Date('2026-07-20T12:00:00.000Z');
    const d = deposit({ status: 'Expired', createdAt: new Date(now.getTime() - 2 * 60 * 60 * 1000) });

    mocks.transactionCount.mockImplementation(async ({ where }) => {
      if (where.status === 'Expired') return 1;
      return 0;
    });
    mocks.transactionFindMany.mockImplementation(async ({ where }) => {
      if (where?.status === 'Expired') return [d];
      return [];
    });
    mocks.reconcileFlutterwaveDeposit.mockResolvedValue({
      paymentState: 'retryable',
      newlyFinalized: false,
      finalization: null,
    });

    const stats = await recoverStalePendingPayments({ now });

    expect(stats.errors).toEqual([]);
    expect(mocks.transactionUpdateMany).toHaveBeenCalledWith({
      where: { id: { in: [d.id] } },
      data: { paymentReconciliationAttemptAt: now },
    });
  });

  it('does not stamp when another worker owns the lease (verifying state)', async () => {
    const now = new Date('2026-07-20T12:00:00.000Z');
    const d = deposit({ status: 'Expired', createdAt: new Date(now.getTime() - 2 * 60 * 60 * 1000) });

    mocks.transactionCount.mockImplementation(async ({ where }) => {
      if (where.status === 'Expired') return 1;
      return 0;
    });
    mocks.transactionFindMany.mockImplementation(async ({ where }) => {
      if (where?.status === 'Expired') return [d];
      return [];
    });
    mocks.reconcileFlutterwaveDeposit.mockResolvedValue({
      paymentState: 'verifying',
      retryable: true,
      newlyFinalized: false,
      finalization: null,
    });

    const stats = await recoverStalePendingPayments({ now });

    expect(mocks.transactionUpdate).not.toHaveBeenCalled();
    expect(stats.errors).toEqual([]);
  });
});

describe('Processing sweep', () => {
  it('moves Processing deposits older than 30 days to Expired', async () => {
    const now = new Date('2026-07-20T12:00:00.000Z');
    mocks.transactionUpdateMany
      .mockResolvedValueOnce({ count: 0 })
      .mockResolvedValueOnce({ count: 3 });

    await recoverStalePendingPayments({ now });

    const sweepCalls = mocks.transactionUpdateMany.mock.calls;
    const processingSweep = sweepCalls.find(
      ([{ where }]) => where.status === 'Processing' && where.createdAt?.lt,
    );
    expect(processingSweep).toBeDefined();
    expect(processingSweep[0].data.status).toBe('Expired');
    expect(mocks.reportOperationalFailure).toHaveBeenCalledWith('stuck_payments', {
      level: 'warning',
      data: { staleProcessingSwept: 3 },
      throttleMs: 30 * 60 * 1000,
    });
  });
});

describe('exact-once crediting', () => {
  it('counts already-credited deposits separately from newly recovered ones', async () => {
    const now = new Date();
    const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);
    const d = deposit({ status: 'Expired', createdAt: twoHoursAgo });

    mocks.transactionCount.mockImplementation(async ({ where }) => {
      if (where.status === 'Expired') return 1;
      return 0;
    });
    mocks.transactionFindMany.mockImplementation(async ({ where }) => {
      if (where?.status === 'Expired') return [d];
      return [];
    });
    mocks.reconcileFlutterwaveDeposit.mockResolvedValue({
      paymentState: 'credited',
      newlyFinalized: false,
      finalization: null,
    });

    const stats = await recoverStalePendingPayments({ now });

    expect(stats.recovered).toBe(0);
    expect(stats.alreadyCredited).toBe(1);
    expect(mocks.notifyDepositFinalized).not.toHaveBeenCalled();
  });
});
