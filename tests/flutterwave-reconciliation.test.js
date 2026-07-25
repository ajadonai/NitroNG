import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  transactionFindUnique: vi.fn(),
  transactionUpdate: vi.fn(),
  transactionUpdateMany: vi.fn(),
  idempotencyCreate: vi.fn(),
  idempotencyUpdateMany: vi.fn(),
  idempotencyDeleteMany: vi.fn(),
  finalizeDeposit: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  default: {
    transaction: {
      findUnique: mocks.transactionFindUnique,
      update: mocks.transactionUpdate,
      updateMany: mocks.transactionUpdateMany,
    },
    idempotencyKey: {
      create: mocks.idempotencyCreate,
      updateMany: mocks.idempotencyUpdateMany,
      deleteMany: mocks.idempotencyDeleteMany,
    },
  },
}));

vi.mock('@/lib/deposit-finalization', () => ({
  finalizeDeposit: mocks.finalizeDeposit,
}));

vi.mock('@/lib/logger', () => ({
  log: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: mocks.warn,
    error: mocks.error,
  },
}));

const { reconcileFlutterwaveDeposit } = await import('@/lib/flutterwave-payment');

const CLAIMABLE_STATUSES = ['Pending', 'Processing', 'Expired', 'Failed', 'Cancelled'];

let storedTransaction;
let storedLease;

function transaction(overrides = {}) {
  return {
    id: 'tx-1',
    userId: 'user-1',
    type: 'deposit',
    method: 'flutterwave',
    reference: 'NTR-FLW-1',
    amount: 500_000,
    status: 'Pending',
    note: 'Flutterwave deposit',
    createdAt: new Date(),
    ...overrides,
  };
}

function useStoredTransaction(row) {
  storedTransaction = { ...row };
  mocks.transactionFindUnique.mockImplementation(async () => ({ ...storedTransaction }));
  mocks.transactionUpdate.mockImplementation(async ({ data }) => {
    storedTransaction = { ...storedTransaction, ...data };
    return { ...storedTransaction };
  });
  mocks.transactionUpdateMany.mockImplementation(async ({ where, data }) => {
    const allowed = where?.status?.in || (where?.status ? [where.status] : null);
    if (allowed && !allowed.includes(storedTransaction.status)) return { count: 0 };
    storedTransaction = { ...storedTransaction, ...data };
    return { count: 1 };
  });
  return storedTransaction;
}

function uniqueConstraintError() {
  return Object.assign(new Error('Unique constraint failed'), { code: 'P2002' });
}

function useStoredLease() {
  storedLease = null;
  mocks.idempotencyCreate.mockImplementation(async ({ data }) => {
    if (storedLease) throw uniqueConstraintError();
    storedLease = { ...data };
    return { ...storedLease };
  });
  mocks.idempotencyUpdateMany.mockImplementation(async ({ where, data }) => {
    if (!storedLease || storedLease.key !== where.key) return { count: 0 };
    if (where.batchId && storedLease.batchId !== where.batchId) return { count: 0 };
    if (where.status && storedLease.status !== where.status) return { count: 0 };
    if (where.expiresAt?.lte && storedLease.expiresAt > where.expiresAt.lte) return { count: 0 };
    if (where.expiresAt?.gt && storedLease.expiresAt <= where.expiresAt.gt) return { count: 0 };
    storedLease = { ...storedLease, ...data };
    return { count: 1 };
  });
  mocks.idempotencyDeleteMany.mockImplementation(async ({ where }) => {
    if (
      !storedLease
      || storedLease.key !== where.key
      || storedLease.batchId !== where.batchId
      || storedLease.status !== where.status
    ) {
      return { count: 0 };
    }
    storedLease = null;
    return { count: 1 };
  });
}

function flutterwaveResponse(providerStatus, overrides = {}) {
  const data = {
    status: 'success',
    data: {
      status: providerStatus,
      tx_ref: storedTransaction.reference,
      amount: storedTransaction.amount / 100,
      currency: 'NGN',
      ...overrides,
    },
  };
  return vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: vi.fn().mockResolvedValue(data),
  });
}

function statusWrites() {
  return [
    ...mocks.transactionUpdate.mock.calls,
    ...mocks.transactionUpdateMany.mock.calls,
  ].map(([query]) => query?.data?.status).filter(Boolean);
}

function expectResult(result, expected) {
  expect(result).toEqual(expect.objectContaining({
    paymentState: expected.paymentState,
    transactionStatus: expected.transactionStatus,
    retryable: expected.retryable,
    newlyFinalized: expected.newlyFinalized,
    transaction: expect.objectContaining({
      id: storedTransaction.id,
      status: expected.transactionStatus,
    }),
  }));
}

async function reconcile(row, fetchImpl, overrides = {}) {
  useStoredTransaction(row);
  return reconcileFlutterwaveDeposit({
    transaction: { ...storedTransaction },
    secretKey: 'FLWSECK_TEST',
    fetchImpl,
    timeoutMs: 25,
    recoveredBy: 'test-recovery',
    ...overrides,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  storedTransaction = transaction();
  useStoredLease();
});

describe('reconcileFlutterwaveDeposit', () => {
  it('short-circuits a genuinely Completed deposit without calling Flutterwave or the finalizer', async () => {
    const fetchImpl = vi.fn();
    const result = await reconcile(transaction({ status: 'Completed' }), fetchImpl);

    expectResult(result, {
      paymentState: 'credited',
      transactionStatus: 'Completed',
      retryable: false,
      newlyFinalized: false,
    });
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(mocks.finalizeDeposit).not.toHaveBeenCalled();
    expect(mocks.transactionUpdate).not.toHaveBeenCalled();
    expect(mocks.transactionUpdateMany).not.toHaveBeenCalled();
    expect(mocks.idempotencyCreate).not.toHaveBeenCalled();
  });

  it('replaces a stale Pending caller snapshot with the authoritative Completed row', async () => {
    const staleSnapshot = transaction({ status: 'Pending' });
    useStoredTransaction(transaction({ status: 'Completed' }));
    const fetchImpl = vi.fn();

    const result = await reconcileFlutterwaveDeposit({
      transaction: staleSnapshot,
      secretKey: 'FLWSECK_TEST',
      fetchImpl,
      timeoutMs: 25,
    });

    expectResult(result, {
      paymentState: 'credited',
      transactionStatus: 'Completed',
      retryable: false,
      newlyFinalized: false,
    });
    expect(result.reason).toBe('already_completed');
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(mocks.idempotencyCreate).not.toHaveBeenCalled();
    expect(mocks.finalizeDeposit).not.toHaveBeenCalled();
  });

  it('allows only one concurrent request for a deposit to query Flutterwave', async () => {
    useStoredTransaction(transaction({ status: 'Pending' }));
    let resolveProvider;
    const fetchImpl = vi.fn().mockImplementation(() => new Promise(resolve => {
      resolveProvider = resolve;
    }));

    const first = reconcileFlutterwaveDeposit({
      transaction: { ...storedTransaction },
      secretKey: 'FLWSECK_TEST',
      fetchImpl,
      timeoutMs: 1_000,
    });
    await vi.waitFor(() => expect(fetchImpl).toHaveBeenCalledTimes(1));

    const second = await reconcileFlutterwaveDeposit({
      transaction: { ...storedTransaction },
      secretKey: 'FLWSECK_TEST',
      fetchImpl,
      timeoutMs: 1_000,
    });

    expect(second).toEqual(expect.objectContaining({
      paymentState: 'verifying',
      transactionStatus: 'Pending',
      retryable: true,
      reason: 'verification_in_progress',
    }));
    expect(fetchImpl).toHaveBeenCalledTimes(1);

    resolveProvider({
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue({
        status: 'success',
        data: {
          status: 'pending',
          tx_ref: storedTransaction.reference,
          amount: storedTransaction.amount / 100,
          currency: 'NGN',
        },
      }),
    });
    const firstResult = await first;
    expect(firstResult.paymentState).toBe('provider_pending');
    expect(mocks.idempotencyDeleteMany).toHaveBeenCalledTimes(1);
  });

  it('returns an authoritative manual completion that interleaves with provider I/O', async () => {
    useStoredTransaction(transaction({ status: 'Pending' }));
    let resolveProvider;
    const fetchImpl = vi.fn().mockImplementation(() => new Promise(resolve => {
      resolveProvider = resolve;
    }));

    const reconciliation = reconcileFlutterwaveDeposit({
      transaction: { ...storedTransaction },
      secretKey: 'FLWSECK_TEST',
      fetchImpl,
      timeoutMs: 1_000,
    });
    await vi.waitFor(() => expect(fetchImpl).toHaveBeenCalledTimes(1));

    // Admin/manual finalization does not share the provider query lease.
    storedTransaction = { ...storedTransaction, status: 'Completed' };
    resolveProvider({
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue({
        status: 'success',
        data: {
          status: 'pending',
          tx_ref: storedTransaction.reference,
          amount: storedTransaction.amount / 100,
          currency: 'NGN',
        },
      }),
    });

    const result = await reconciliation;
    expectResult(result, {
      paymentState: 'credited',
      transactionStatus: 'Completed',
      retryable: false,
      newlyFinalized: false,
    });
    expect(mocks.transactionUpdateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        id: 'tx-1',
        status: { in: expect.arrayContaining(['Pending', 'Processing', 'Expired', 'Failed', 'Cancelled']) },
      }),
      data: { status: 'Pending' },
    }));
    const guardedStatuses = mocks.transactionUpdateMany.mock.calls.at(-1)[0].where.status.in;
    expect(guardedStatuses).not.toContain('Completed');
    expect(storedTransaction.status).toBe('Completed');
    expect(mocks.finalizeDeposit).not.toHaveBeenCalled();
  });

  it('discards a late provider result after lease ownership has changed', async () => {
    useStoredTransaction(transaction({ status: 'Pending' }));
    let resolveProvider;
    const fetchImpl = vi.fn().mockImplementation(() => new Promise(resolve => {
      resolveProvider = resolve;
    }));

    const reconciliation = reconcileFlutterwaveDeposit({
      transaction: { ...storedTransaction },
      secretKey: 'FLWSECK_TEST',
      fetchImpl,
      timeoutMs: 1_000,
    });
    await vi.waitFor(() => expect(fetchImpl).toHaveBeenCalledTimes(1));

    storedLease = { ...storedLease, batchId: 'successor-worker' };
    resolveProvider({
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue({
        status: 'success',
        data: {
          status: 'successful',
          tx_ref: storedTransaction.reference,
          amount: storedTransaction.amount / 100,
          currency: 'NGN',
        },
      }),
    });

    const result = await reconciliation;
    expect(result).toEqual(expect.objectContaining({
      paymentState: 'provider_pending',
      transactionStatus: 'Pending',
      reason: 'verification_lease_lost',
      newlyFinalized: false,
    }));
    expect(mocks.transactionUpdateMany).not.toHaveBeenCalled();
    expect(mocks.finalizeDeposit).not.toHaveBeenCalled();
    expect(storedLease.batchId).toBe('successor-worker');
  });

  it.each(['Pending', 'Processing', 'Failed', 'Cancelled'])(
    'turns a retryable transport failure from %s into Expired without finalizing',
    async initialStatus => {
      const transportError = Object.assign(new Error('Flutterwave request timed out'), { name: 'AbortError' });
      const fetchImpl = vi.fn().mockRejectedValue(transportError);

      const result = await reconcile(transaction({ status: initialStatus }), fetchImpl);

      expectResult(result, {
        paymentState: 'retryable',
        transactionStatus: 'Expired',
        retryable: true,
        newlyFinalized: false,
      });
      expect(statusWrites()).toContain('Expired');
      expect(mocks.finalizeDeposit).not.toHaveBeenCalled();
    },
  );

  it.each(['Pending', 'Processing', 'Failed', 'Cancelled'])(
    'records a provider-pending result as Pending when reconciliation starts from %s',
    async initialStatus => {
      useStoredTransaction(transaction({ status: initialStatus }));
      const fetchImpl = flutterwaveResponse('pending');

      const result = await reconcileFlutterwaveDeposit({
        transaction: { ...storedTransaction },
        secretKey: 'FLWSECK_TEST',
        fetchImpl,
        timeoutMs: 25,
        recoveredBy: 'test-recovery',
      });

      expectResult(result, {
        paymentState: 'provider_pending',
        transactionStatus: 'Pending',
        retryable: true,
        newlyFinalized: false,
      });
      if (initialStatus !== 'Pending') expect(statusWrites()).toContain('Pending');
      expect(mocks.finalizeDeposit).not.toHaveBeenCalled();
    },
  );

  it('expires an abandoned deposit when provider confirms pending after one hour', async () => {
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
    useStoredTransaction(transaction({ status: 'Pending', createdAt: twoHoursAgo }));
    const fetchImpl = flutterwaveResponse('pending');

    const result = await reconcileFlutterwaveDeposit({
      transaction: { ...storedTransaction },
      secretKey: 'FLWSECK_TEST',
      fetchImpl,
      timeoutMs: 25,
    });

    expectResult(result, {
      paymentState: 'retryable',
      transactionStatus: 'Expired',
      retryable: true,
      newlyFinalized: false,
    });
    expect(result.reason).toBe('abandoned');
    expect(statusWrites()).toContain('Expired');
    expect(statusWrites()).not.toContain('Cancelled');
    expect(mocks.finalizeDeposit).not.toHaveBeenCalled();
  });

  it('credits a deposit that was expired-as-abandoned but later completed at Flutterwave', async () => {
    const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000);
    const completed = transaction({ status: 'Completed' });
    mocks.finalizeDeposit.mockResolvedValue({
      finalized: true,
      reason: 'completed',
      transaction: completed,
      depositAmount: completed.amount,
    });
    useStoredTransaction(transaction({ status: 'Expired', createdAt: threeHoursAgo }));
    const fetchImpl = flutterwaveResponse('successful');

    const result = await reconcileFlutterwaveDeposit({
      transaction: { ...storedTransaction },
      secretKey: 'FLWSECK_TEST',
      fetchImpl,
      timeoutMs: 25,
      recoveredBy: 'cron',
    });

    expectResult(result, {
      paymentState: 'credited',
      transactionStatus: 'Completed',
      retryable: false,
      newlyFinalized: true,
    });
    expect(mocks.finalizeDeposit).toHaveBeenCalledTimes(1);
  });

  it('records an explicit Flutterwave failure as Failed and does not finalize', async () => {
    useStoredTransaction(transaction({ status: 'Processing' }));
    const result = await reconcileFlutterwaveDeposit({
      transaction: { ...storedTransaction },
      secretKey: 'FLWSECK_TEST',
      fetchImpl: flutterwaveResponse('failed'),
      timeoutMs: 25,
      recoveredBy: 'test-recovery',
    });

    expectResult(result, {
      paymentState: 'failed',
      transactionStatus: 'Failed',
      retryable: false,
      newlyFinalized: false,
    });
    expect(statusWrites()).toContain('Failed');
    expect(mocks.finalizeDeposit).not.toHaveBeenCalled();
  });

  it('passes every recoverable legacy status to the finalizer after exact provider verification', async () => {
    const completed = transaction({ status: 'Completed' });
    mocks.finalizeDeposit.mockResolvedValue({
      finalized: true,
      reason: 'completed',
      transaction: completed,
      depositAmount: completed.amount,
    });
    useStoredTransaction(transaction({ status: 'Processing' }));

    const result = await reconcileFlutterwaveDeposit({
      transaction: { ...storedTransaction },
      secretKey: 'FLWSECK_TEST',
      fetchImpl: flutterwaveResponse('successful'),
      timeoutMs: 25,
      recoveredBy: 'cron',
    });

    expect(mocks.finalizeDeposit).toHaveBeenCalledTimes(1);
    const finalizerInput = mocks.finalizeDeposit.mock.calls[0][0];
    expect(finalizerInput).toEqual(expect.objectContaining({
      paidAmountKobo: 500_000,
      recoveredBy: 'cron',
      claimableStatuses: expect.arrayContaining(CLAIMABLE_STATUSES),
    }));
    expect(finalizerInput.transactionId === 'tx-1' || finalizerInput.reference === 'NTR-FLW-1').toBe(true);
    expectResult(result, {
      paymentState: 'credited',
      transactionStatus: 'Completed',
      retryable: false,
      newlyFinalized: true,
    });
    expect(result.finalization).toEqual(expect.objectContaining({ finalized: true }));
  });

  it('maps finalizer already_completed to credited only when the returned transaction is actually Completed', async () => {
    const completed = transaction({ status: 'Completed' });
    mocks.finalizeDeposit.mockResolvedValue({
      finalized: false,
      reason: 'already_completed',
      transaction: completed,
    });
    useStoredTransaction(transaction({ status: 'Expired' }));

    const result = await reconcileFlutterwaveDeposit({
      transaction: { ...storedTransaction },
      secretKey: 'FLWSECK_TEST',
      fetchImpl: flutterwaveResponse('successful'),
      timeoutMs: 25,
      recoveredBy: 'dashboard',
    });

    expectResult(result, {
      paymentState: 'credited',
      transactionStatus: 'Completed',
      retryable: false,
      newlyFinalized: false,
    });
    expect(result.finalization).toEqual(expect.objectContaining({
      finalized: false,
      reason: 'already_completed',
    }));
  });

  it.each([
    ['already_completed', false],
    ['completed', true],
  ])(
    'never reports credited when a %s finalizer race resolves to a non-Completed row',
    async (reason, finalized) => {
      const stillProcessing = transaction({ status: 'Processing' });
      mocks.finalizeDeposit.mockResolvedValue({
        finalized,
        reason,
        transaction: stillProcessing,
      });
      useStoredTransaction(transaction({ status: 'Processing' }));

      const result = await reconcileFlutterwaveDeposit({
        transaction: { ...storedTransaction },
        secretKey: 'FLWSECK_TEST',
        fetchImpl: flutterwaveResponse('successful'),
        timeoutMs: 25,
        recoveredBy: 'race-test',
      });

      expect(result.paymentState).toBe('verifying');
      expect(result.paymentState).not.toBe('credited');
      expect(result.transactionStatus).toBe('Processing');
      expect(result.transaction.status).toBe('Processing');
      expect(result.retryable).toBe(true);
      expect(result.newlyFinalized).toBe(false);
    },
  );

  it('does not report credited when a status-update/finalizer race resolves to Failed', async () => {
    const failed = transaction({ status: 'Failed' });
    mocks.finalizeDeposit.mockResolvedValue({
      finalized: false,
      reason: 'not_claimable',
      transaction: failed,
    });
    useStoredTransaction(transaction({ status: 'Pending' }));

    const result = await reconcileFlutterwaveDeposit({
      transaction: { ...storedTransaction },
      secretKey: 'FLWSECK_TEST',
      fetchImpl: flutterwaveResponse('successful'),
      timeoutMs: 25,
      recoveredBy: 'race-test',
    });

    expect(result.paymentState).toBe('failed');
    expect(result.paymentState).not.toBe('credited');
    expect(result.transactionStatus).toBe('Failed');
    expect(result.transaction.status).toBe('Failed');
    expect(result.retryable).toBe(false);
    expect(result.newlyFinalized).toBe(false);
  });
});

describe('Flutterwave recovery query wiring', () => {
  it('selects fair Pending, Expired and Processing buckets with bounded provider calls', () => {
    const source = readFileSync(new URL('../lib/payment-recovery.js', import.meta.url), 'utf8');

    expect(source).toMatch(/import\s*\{[^}]*\breconcileFlutterwaveDeposit\b[^}]*\}\s*from\s*['"][^'"]*flutterwave-payment[^'"]*['"]/s);
    expect(source).toMatch(/\breconcileFlutterwaveDeposit\s*\(/);
    expect(source).toMatch(/method\s*:\s*['"]flutterwave['"]/);
    expect(source).toMatch(/RECOVERY_CONCURRENCY\s*=\s*4/);
    expect(source).toMatch(/RECOVERY_PROVIDER_TIMEOUT_MS\s*=\s*8_000/);
    expect(source).toMatch(/RECOVERY_ROTATION_SLOT_MS\s*=\s*5\s*\*\s*60\s*\*\s*1000/);
    expect(source).toMatch(/rotatingSkip\s*=\s*1\s*\+/);
    expect(source).toMatch(/createdAt\s*:\s*['"]desc['"]/);
    for (const status of ['Pending', 'Expired', 'Processing']) {
      expect(source).toMatch(new RegExp(`status\\s*:\\s*['"]${status}['"]`));
    }
  });
});
