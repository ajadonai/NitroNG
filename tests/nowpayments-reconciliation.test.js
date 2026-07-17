import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  transactionFindUnique: vi.fn(),
  transactionFindFirst: vi.fn(),
  transactionUpdate: vi.fn(),
  transactionUpdateMany: vi.fn(),
  settingFindUnique: vi.fn(),
  adminIssueFindFirst: vi.fn(),
  adminIssueCreate: vi.fn(),
  adminIssueUpdate: vi.fn(),
  adminIssueUpdateMany: vi.fn(),
  prismaTransaction: vi.fn(),
  finalizeDeposit: vi.fn(),
  acquireLease: vi.fn(),
  renewLease: vi.fn(),
  releaseLease: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  default: {
    transaction: {
      findUnique: mocks.transactionFindUnique,
      findFirst: mocks.transactionFindFirst,
      update: mocks.transactionUpdate,
      updateMany: mocks.transactionUpdateMany,
    },
    adminIssue: {
      findFirst: mocks.adminIssueFindFirst,
      create: mocks.adminIssueCreate,
      update: mocks.adminIssueUpdate,
      updateMany: mocks.adminIssueUpdateMany,
    },
    setting: {
      findUnique: mocks.settingFindUnique,
    },
    $transaction: mocks.prismaTransaction,
  },
}));

vi.mock('@/lib/deposit-finalization', () => ({
  finalizeDeposit: mocks.finalizeDeposit,
}));

vi.mock('@/lib/provider-query-lease', () => ({
  acquireProviderQueryLease: mocks.acquireLease,
  renewProviderQueryLease: mocks.renewLease,
  releaseProviderQueryLease: mocks.releaseLease,
}));

vi.mock('@/lib/logger', () => ({
  log: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: mocks.warn,
    error: mocks.error,
  },
}));

const {
  getNowPaymentsCreationApiKey,
  reconcileNowPaymentsDeposit,
} = await import('@/lib/nowpayments-payment');

const PAYMENT_ID = '900719925474099312345';
const REFERENCE = 'NTR-CRYPTO-TEST-1';
const NOW = new Date('2026-07-17T01:00:00.000Z');

let storedTransaction;
let otherTransactions;
let adminIssues;

function transaction(overrides = {}) {
  return {
    id: 'tx-crypto-1',
    userId: 'user-1',
    type: 'deposit',
    method: 'crypto',
    reference: REFERENCE,
    idempotencyKey: 'crypto-create-1',
    amount: 500_000,
    status: 'Pending',
    note: `Crypto deposit [np:${PAYMENT_ID}] ($11 USDT)`,
    providerPaymentId: PAYMENT_ID,
    providerPriceAmount: '11',
    providerPriceCurrency: 'usd',
    providerPayAmount: '10.5',
    providerPayCurrency: 'usdttrc20',
    providerPayAddress: 'TMwFHYXLJaRUPeW6421aqXL4ZEzPRFGkGT',
    providerPaymentStatus: 'waiting',
    providerActuallyPaid: null,
    providerLastVerifiedAt: null,
    paymentReconciliationAttemptAt: null,
    paymentReviewFingerprint: null,
    paymentReviewReason: null,
    paymentReviewAt: null,
    paymentReviewResolvedAt: null,
    createdAt: new Date('2026-07-17T00:00:00.000Z'),
    ...overrides,
  };
}

function providerPayload(overrides = {}) {
  return {
    payment_id: PAYMENT_ID,
    payment_status: 'confirmed',
    order_id: REFERENCE,
    parent_payment_id: null,
    price_amount: '11.0000',
    price_currency: 'usd',
    pay_amount: '10.500000',
    pay_currency: 'usdttrc20',
    actually_paid: '10.5',
    ...overrides,
  };
}

function providerFetch(payload) {
  return vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: vi.fn().mockResolvedValue(payload),
  });
}

function scalarMatches(value, condition) {
  if (condition === undefined) return true;
  if (condition === null || typeof condition !== 'object' || condition instanceof Date) {
    return value === condition;
  }
  if ('in' in condition && !condition.in.includes(value)) return false;
  if ('not' in condition && value === condition.not) return false;
  return true;
}

function transactionMatches(row, where = {}) {
  if (!row) return false;
  return [
    'id',
    'userId',
    'type',
    'method',
    'reference',
    'providerPaymentId',
    'status',
    'paymentReviewFingerprint',
    'paymentReviewReason',
    'paymentReviewAt',
    'paymentReviewResolvedAt',
  ]
    .every(key => scalarMatches(row[key], where[key]));
}

function issueMatches(issue, where = {}) {
  if (!issue) return false;
  if (!scalarMatches(issue.type, where.type)) return false;
  if (!scalarMatches(issue.status, where.status)) return false;
  if (where.metadata?.contains && !String(issue.metadata).includes(where.metadata.contains)) {
    return false;
  }
  return true;
}

function cloneStored() {
  return storedTransaction ? { ...storedTransaction } : null;
}

function installInMemoryPrisma(row) {
  storedTransaction = { ...row };
  otherTransactions = [];
  adminIssues = [];

  mocks.transactionFindUnique.mockImplementation(async ({ where }) => (
    where.id === storedTransaction?.id ? cloneStored() : null
  ));
  mocks.transactionFindFirst.mockImplementation(async ({ where }) => {
    if (transactionMatches(storedTransaction, where)) return cloneStored();
    const found = otherTransactions.find(candidate => transactionMatches(candidate, where));
    return found ? { ...found } : null;
  });
  mocks.transactionUpdate.mockImplementation(async ({ where, data }) => {
    if (where.id !== storedTransaction?.id) throw new Error('Transaction not found');
    storedTransaction = { ...storedTransaction, ...data };
    return cloneStored();
  });
  mocks.transactionUpdateMany.mockImplementation(async ({ where, data }) => {
    if (!transactionMatches(storedTransaction, where)) return { count: 0 };
    if (
      where.paymentReviewReason?.not === null
      && storedTransaction.paymentReviewReason === null
    ) {
      return { count: 0 };
    }
    if (
      where.paymentReviewResolvedAt === null
      && storedTransaction.paymentReviewResolvedAt !== null
    ) {
      return { count: 0 };
    }
    storedTransaction = { ...storedTransaction, ...data };
    return { count: 1 };
  });

  mocks.adminIssueFindFirst.mockImplementation(async ({ where }) => {
    const found = adminIssues.find(issue => issueMatches(issue, where));
    return found ? { ...found } : null;
  });
  mocks.adminIssueCreate.mockImplementation(async ({ data }) => {
    const issue = {
      id: `issue-${adminIssues.length + 1}`,
      status: 'open',
      createdAt: NOW,
      resolvedAt: null,
      resolvedBy: null,
      ...data,
    };
    adminIssues.push(issue);
    return { ...issue };
  });
  mocks.adminIssueUpdate.mockImplementation(async ({ where, data }) => {
    const index = adminIssues.findIndex(issue => issue.id === where.id);
    if (index === -1) throw new Error('Admin issue not found');
    adminIssues[index] = { ...adminIssues[index], ...data };
    return { ...adminIssues[index] };
  });
  mocks.adminIssueUpdateMany.mockImplementation(async ({ where, data }) => {
    let count = 0;
    adminIssues = adminIssues.map(issue => {
      if (!issueMatches(issue, where)) return issue;
      count += 1;
      return { ...issue, ...data };
    });
    return { count };
  });

  const db = {
    transaction: {
      findUnique: mocks.transactionFindUnique,
      findFirst: mocks.transactionFindFirst,
      update: mocks.transactionUpdate,
      updateMany: mocks.transactionUpdateMany,
    },
    adminIssue: {
      findFirst: mocks.adminIssueFindFirst,
      create: mocks.adminIssueCreate,
      update: mocks.adminIssueUpdate,
      updateMany: mocks.adminIssueUpdateMany,
    },
  };
  mocks.prismaTransaction.mockImplementation(async callback => callback(db));

  mocks.finalizeDeposit.mockImplementation(async ({ transactionId }) => {
    if (transactionId !== storedTransaction.id) {
      return { finalized: false, reason: 'not_found', transaction: null };
    }
    storedTransaction = { ...storedTransaction, status: 'Completed' };
    return {
      finalized: true,
      reason: 'completed',
      transaction: cloneStored(),
      depositAmount: storedTransaction.amount,
    };
  });
}

async function reconcile(row, payload, overrides = {}) {
  installInMemoryPrisma(row);
  const fetchImpl = providerFetch(payload);
  const result = await reconcileNowPaymentsDeposit({
    transaction: cloneStored(),
    apiKey: 'nowpayments-test-key',
    fetchImpl,
    timeoutMs: 50,
    recoveredBy: 'test',
    now: NOW,
    ...overrides,
  });
  return { result, fetchImpl };
}

function expectNoCredit() {
  expect(mocks.finalizeDeposit).not.toHaveBeenCalled();
  expect(storedTransaction.status).not.toBe('Completed');
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.acquireLease.mockResolvedValue({
    acquired: true,
    key: 'payment:provider-query:nowpayments:tx-crypto-1',
    token: 'lease-owner',
    expiresAt: new Date('2026-07-17T01:01:00.000Z'),
  });
  mocks.renewLease.mockResolvedValue(true);
  mocks.releaseLease.mockResolvedValue(true);
  mocks.settingFindUnique.mockResolvedValue(null);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('getNowPaymentsCreationApiKey', () => {
  it('returns a key only when the persisted crypto gateway is enabled', async () => {
    mocks.settingFindUnique.mockResolvedValue({
      value: JSON.stringify({ enabled: true, fields: { apiKey: ' configured-key ' } }),
    });

    await expect(getNowPaymentsCreationApiKey()).resolves.toBe('configured-key');
  });

  it('does not let an environment key bypass a disabled gateway', async () => {
    vi.stubEnv('NOWPAYMENTS_API_KEY', 'environment-key');
    mocks.settingFindUnique.mockResolvedValue({
      value: JSON.stringify({ enabled: false, fields: { apiKey: 'configured-key' } }),
    });

    await expect(getNowPaymentsCreationApiKey()).resolves.toBe('');
  });
});

describe('reconcileNowPaymentsDeposit', () => {
  it('credits an exact confirmation once and short-circuits later non-audit checks', async () => {
    installInMemoryPrisma(transaction());
    const fetchImpl = providerFetch(providerPayload());

    const first = await reconcileNowPaymentsDeposit({
      transaction: cloneStored(),
      apiKey: 'nowpayments-test-key',
      fetchImpl,
      timeoutMs: 50,
      recoveredBy: 'dashboard',
      now: NOW,
    });
    const second = await reconcileNowPaymentsDeposit({
      transaction: cloneStored(),
      apiKey: 'nowpayments-test-key',
      fetchImpl,
      timeoutMs: 50,
      recoveredBy: 'dashboard',
      now: NOW,
    });

    expect(first).toEqual(expect.objectContaining({
      success: true,
      paymentState: 'credited',
      transactionStatus: 'Completed',
      newlyFinalized: true,
    }));
    expect(second).toEqual(expect.objectContaining({
      success: true,
      paymentState: 'credited',
      transactionStatus: 'Completed',
      newlyFinalized: false,
      reason: 'already_completed',
    }));
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(mocks.finalizeDeposit).toHaveBeenCalledTimes(1);
    expect(mocks.finalizeDeposit).toHaveBeenCalledWith(expect.objectContaining({
      transactionId: storedTransaction.id,
      userId: storedTransaction.userId,
      paidAmountKobo: 500_000,
      providerPaidAmount: '10.5',
      recoveredBy: 'dashboard',
      claimableStatuses: expect.arrayContaining([
        'Pending', 'Processing', 'Expired', 'Failed', 'Cancelled',
      ]),
    }));
    expect(mocks.finalizeDeposit.mock.calls[0][0].claimableStatuses).not.toContain('Review');
  });

  it.each([
    ['underpayment', { payment_status: 'finished', actually_paid: '10.499999' }],
    ['overpayment', { payment_status: 'confirmed', actually_paid: '10.500001' }],
    ['partially_paid', { payment_status: 'partially_paid', actually_paid: '5' }],
    ['payment_id_mismatch', { payment_id: 'different-provider-payment' }],
    ['order_id_mismatch', { order_id: 'NTR-OTHER' }],
    ['price_amount_mismatch', { price_amount: '12' }],
    ['price_currency_mismatch', { price_currency: 'eur' }],
    ['pay_amount_mismatch', { pay_amount: '10.6', actually_paid: '10.6' }],
    ['pay_currency_mismatch', { pay_currency: 'usdtbsc' }],
    ['missing_actual_amount', { actually_paid: undefined }],
    ['repeated_payment', { parent_payment_id: 'parent-payment-1' }],
    ['wrong_asset', { payment_status: 'wrong_asset' }],
  ])('sends %s to durable review without crediting', async (reason, patch) => {
    const { result } = await reconcile(transaction(), providerPayload(patch));

    expect(result).toEqual(expect.objectContaining({
      success: false,
      paymentState: 'review',
      transactionStatus: 'Review',
      retryable: false,
      newlyFinalized: false,
      reason,
    }));
    expectNoCredit();
    expect(storedTransaction).toEqual(expect.objectContaining({
      status: 'Review',
      paymentReviewReason: reason,
      paymentReviewAt: NOW,
      paymentReviewResolvedAt: null,
    }));
    expect(adminIssues).toHaveLength(1);
    expect(adminIssues[0]).toEqual(expect.objectContaining({
      type: 'crypto_payment_review',
      status: 'open',
      title: `Crypto payment review: ${reason}`,
    }));
    expect(JSON.parse(adminIssues[0].metadata)).toEqual(expect.objectContaining({
      transactionId: storedTransaction.id,
      reference: REFERENCE,
      reason,
    }));

    if (['underpayment', 'overpayment', 'partially_paid'].includes(reason)) {
      expect(storedTransaction).toEqual(expect.objectContaining({
        providerPaymentStatus: patch.payment_status,
        providerActuallyPaid: patch.actually_paid,
        providerLastVerifiedAt: NOW,
      }));
    }
  });

  it('keeps a provider-pending payment uncredited and records the observation', async () => {
    const { result } = await reconcile(
      transaction({ status: 'Processing' }),
      providerPayload({ payment_status: 'confirming', actually_paid: '0' }),
    );

    expect(result).toEqual(expect.objectContaining({
      success: false,
      paymentState: 'provider_pending',
      transactionStatus: 'Pending',
      retryable: true,
      newlyFinalized: false,
      reason: 'provider_pending',
    }));
    expectNoCredit();
    expect(storedTransaction).toEqual(expect.objectContaining({
      providerPaymentStatus: 'confirming',
      providerActuallyPaid: '0',
      providerLastVerifiedAt: NOW,
    }));
  });

  it.each([
    ['expired', 'Expired'],
    ['failed', 'Failed'],
    ['cancelled', 'Cancelled'],
  ])('preserves the row and records provider terminal status %s', async (providerStatus, status) => {
    const { result } = await reconcile(
      transaction({ status: 'Processing' }),
      providerPayload({ payment_status: providerStatus, actually_paid: '0' }),
    );

    expect(result).toEqual(expect.objectContaining({
      success: false,
      paymentState: status === 'Expired' ? 'retryable' : 'failed',
      transactionStatus: status,
      newlyFinalized: false,
      reason: 'provider_failed',
    }));
    expectNoCredit();
    expect(storedTransaction).toEqual(expect.objectContaining({
      id: 'tx-crypto-1',
      status,
      providerPaymentStatus: providerStatus,
    }));
  });

  it('records a refund before credit as terminal and never finalizes', async () => {
    const { result } = await reconcile(
      transaction(),
      providerPayload({ payment_status: 'refunded', actually_paid: '10.5' }),
    );

    expect(result).toEqual(expect.objectContaining({
      success: false,
      paymentState: 'failed',
      transactionStatus: 'Refunded',
      retryable: false,
      newlyFinalized: false,
      reason: 'refunded',
    }));
    expectNoCredit();
    expect(storedTransaction.providerPaymentStatus).toBe('refunded');
  });

  it('preserves a credited balance on refund and opens a durable admin review', async () => {
    const completed = transaction({ status: 'Completed' });
    const { result, fetchImpl } = await reconcile(
      completed,
      providerPayload({ payment_status: 'refunded', actually_paid: '10.5' }),
      { auditCompleted: true },
    );

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(mocks.finalizeDeposit).not.toHaveBeenCalled();
    expect(storedTransaction).toEqual(expect.objectContaining({
      status: 'Completed',
      paymentReviewReason: 'refunded_after_credit',
      paymentReviewAt: NOW,
      paymentReviewResolvedAt: null,
      providerPaymentStatus: 'refunded',
    }));
    expect(result).toEqual(expect.objectContaining({
      success: false,
      paymentState: 'review',
      transactionStatus: 'Completed',
      retryable: false,
      newlyFinalized: false,
      reason: 'refunded_after_credit',
    }));
    expect(adminIssues).toHaveLength(1);
    expect(adminIssues[0]).toEqual(expect.objectContaining({
      type: 'crypto_payment_review',
      status: 'open',
    }));
    expect(adminIssues[0].message).toContain('wallet was already credited');
  });

  it('requires manual review when a refunded payment later reports verified', async () => {
    installInMemoryPrisma(transaction({
      status: 'Refunded',
      providerPaymentStatus: 'refunded',
      providerActuallyPaid: '10.5',
    }));
    const fetchImpl = providerFetch(providerPayload());

    const first = await reconcileNowPaymentsDeposit({
      transaction: cloneStored(),
      apiKey: 'nowpayments-test-key',
      fetchImpl,
      timeoutMs: 50,
      now: NOW,
    });
    const second = await reconcileNowPaymentsDeposit({
      transaction: cloneStored(),
      apiKey: 'nowpayments-test-key',
      fetchImpl,
      timeoutMs: 50,
      now: NOW,
    });

    expect(first).toEqual(expect.objectContaining({
      paymentState: 'review',
      transactionStatus: 'Review',
      reason: 'provider_verified_after_refund',
    }));
    expect(second).toEqual(expect.objectContaining({
      paymentState: 'review',
      transactionStatus: 'Review',
      reason: 'provider_verified_after_refund',
    }));
    expect(mocks.finalizeDeposit).not.toHaveBeenCalled();
    expect(adminIssues).toHaveLength(1);
    expect(adminIssues[0].status).toBe('open');
    expect(JSON.parse(adminIssues[0].metadata)).toEqual(expect.objectContaining({
      reason: 'provider_verified_after_refund',
      actuallyPaid: '10.5',
    }));
  });

  it('never auto-resolves a post-credit refund review on a later verified response', async () => {
    installInMemoryPrisma(transaction({
      status: 'Completed',
      paymentReviewReason: 'refunded_after_credit',
      paymentReviewAt: new Date('2026-07-17T00:30:00.000Z'),
      paymentReviewResolvedAt: null,
    }));
    adminIssues.push({
      id: 'issue-refund',
      type: 'crypto_payment_review',
      status: 'open',
      metadata: JSON.stringify({ transactionId: storedTransaction.id }),
      resolvedAt: null,
      resolvedBy: null,
    });

    const result = await reconcileNowPaymentsDeposit({
      transaction: cloneStored(),
      apiKey: 'nowpayments-test-key',
      fetchImpl: providerFetch(providerPayload()),
      timeoutMs: 50,
      auditCompleted: true,
      now: NOW,
    });

    expect(result).toEqual(expect.objectContaining({
      paymentState: 'review',
      transactionStatus: 'Completed',
      reason: 'provider_verified_during_review',
    }));
    expect(mocks.finalizeDeposit).not.toHaveBeenCalled();
    expect(adminIssues[0].status).toBe('open');
    expect(adminIssues).toHaveLength(2);
    expect(JSON.parse(adminIssues[1].metadata).reason)
      .toBe('provider_verified_during_review');
    expect(storedTransaction.paymentReviewResolvedAt).toBeNull();
  });

  it.each(['Cancelled', 'Expired', 'Failed'])(
    'recovers a late exact confirmation from %s',
    async initialStatus => {
      installInMemoryPrisma(transaction({ status: initialStatus }));

      const result = await reconcileNowPaymentsDeposit({
        transaction: cloneStored(),
        apiKey: 'nowpayments-test-key',
        fetchImpl: providerFetch(providerPayload()),
        timeoutMs: 50,
        recoveredBy: 'cron',
        now: NOW,
      });

      expect(result).toEqual(expect.objectContaining({
        success: true,
        paymentState: 'credited',
        transactionStatus: 'Completed',
        newlyFinalized: true,
      }));
      expect(mocks.finalizeDeposit).toHaveBeenCalledTimes(1);
      expect(storedTransaction.status).toBe('Completed');
    },
  );

  it.each(['underpayment', 'repeated_payment', 'wrong_asset', 'payment_id_mismatch'])(
    'records a later exact response during an open %s review without auto-credit',
    async reason => {
      installInMemoryPrisma(transaction({
        status: 'Review',
        paymentReviewReason: reason,
        paymentReviewAt: new Date('2026-07-17T00:30:00.000Z'),
        paymentReviewResolvedAt: null,
      }));
      adminIssues.push({
        id: `issue-${reason}`,
        type: 'crypto_payment_review',
        status: 'open',
        metadata: JSON.stringify({ transactionId: storedTransaction.id }),
        resolvedAt: null,
        resolvedBy: null,
      });

      const result = await reconcileNowPaymentsDeposit({
        transaction: cloneStored(),
        apiKey: 'nowpayments-test-key',
        fetchImpl: providerFetch(providerPayload()),
        timeoutMs: 50,
        recoveredBy: 'cron',
        now: NOW,
      });

      expect(result).toEqual(expect.objectContaining({
        success: false,
        paymentState: 'review',
        transactionStatus: 'Review',
        newlyFinalized: false,
        reason: 'provider_verified_during_review',
      }));
      expect(mocks.finalizeDeposit).not.toHaveBeenCalled();
      expect(storedTransaction.paymentReviewResolvedAt).toBeNull();
      expect(adminIssues[0].status).toBe('open');
      expect(adminIssues).toHaveLength(2);
      expect(JSON.parse(adminIssues[1].metadata)).toEqual(expect.objectContaining({
        reason: 'provider_verified_during_review',
        actuallyPaid: '10.5',
      }));
    },
  );

  it('keeps a manually rejected review final without provider I/O or credit', async () => {
    installInMemoryPrisma(transaction({
      status: 'Rejected',
      paymentReviewReason: 'underpayment',
      paymentReviewAt: new Date('2026-07-17T00:30:00.000Z'),
      paymentReviewResolvedAt: new Date('2026-07-17T00:45:00.000Z'),
    }));
    const fetchImpl = vi.fn();

    const result = await reconcileNowPaymentsDeposit({
      transaction: cloneStored(),
      apiKey: 'nowpayments-test-key',
      fetchImpl,
      timeoutMs: 50,
      now: NOW,
    });

    expect(result).toEqual(expect.objectContaining({
      success: false,
      paymentState: 'failed',
      transactionStatus: 'Rejected',
      retryable: false,
      reason: 'manual_review_closed',
    }));
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(mocks.acquireLease).not.toHaveBeenCalled();
    expect(mocks.finalizeDeposit).not.toHaveBeenCalled();
  });

  it('does not reopen or credit the same anomaly after manual rejection', async () => {
    installInMemoryPrisma(transaction());
    const underpayment = providerPayload({
      payment_status: 'finished',
      actually_paid: '10',
    });

    await reconcileNowPaymentsDeposit({
      transaction: cloneStored(),
      apiKey: 'nowpayments-test-key',
      fetchImpl: providerFetch(underpayment),
      timeoutMs: 50,
      now: NOW,
    });
    expect(adminIssues).toHaveLength(1);
    const closedAt = new Date('2026-07-17T00:45:00.000Z');
    storedTransaction = {
      ...storedTransaction,
      status: 'Rejected',
      paymentReviewResolvedAt: closedAt,
    };
    adminIssues[0] = {
      ...adminIssues[0],
      status: 'resolved',
      resolvedAt: closedAt,
      resolvedBy: 'Ada',
    };

    const result = await reconcileNowPaymentsDeposit({
      transaction: cloneStored(),
      providerPaymentId: PAYMENT_ID,
      apiKey: 'nowpayments-test-key',
      fetchImpl: providerFetch(underpayment),
      timeoutMs: 50,
      now: NOW,
    });

    expect(result).toEqual(expect.objectContaining({
      success: false,
      paymentState: 'failed',
      transactionStatus: 'Rejected',
      retryable: false,
      reason: 'manual_review_closed',
    }));
    expect(storedTransaction.status).toBe('Rejected');
    expect(storedTransaction.paymentReviewResolvedAt).toEqual(closedAt);
    expect(adminIssues).toHaveLength(1);
    expect(adminIssues[0].status).toBe('resolved');
    expect(mocks.finalizeDeposit).not.toHaveBeenCalled();
  });

  it('opens new evidence instead of auto-crediting an exact payment after rejection', async () => {
    installInMemoryPrisma(transaction());
    await reconcileNowPaymentsDeposit({
      transaction: cloneStored(),
      apiKey: 'nowpayments-test-key',
      fetchImpl: providerFetch(providerPayload({
        payment_status: 'partially_paid',
        actually_paid: '5',
      })),
      timeoutMs: 50,
      now: NOW,
    });
    const closedAt = new Date('2026-07-17T00:45:00.000Z');
    storedTransaction = {
      ...storedTransaction,
      status: 'Rejected',
      paymentReviewResolvedAt: closedAt,
    };
    adminIssues[0] = {
      ...adminIssues[0],
      status: 'resolved',
      resolvedAt: closedAt,
      resolvedBy: 'Ada',
    };

    const exactInput = {
      transaction: cloneStored(),
      providerPaymentId: PAYMENT_ID,
      apiKey: 'nowpayments-test-key',
      fetchImpl: providerFetch(providerPayload()),
      timeoutMs: 50,
      now: NOW,
    };
    const first = await reconcileNowPaymentsDeposit(exactInput);
    const second = await reconcileNowPaymentsDeposit({
      ...exactInput,
      transaction: cloneStored(),
      fetchImpl: providerFetch(providerPayload()),
    });

    expect(first).toEqual(expect.objectContaining({
      success: false,
      paymentState: 'review',
      transactionStatus: 'Rejected',
      retryable: false,
      reason: 'provider_verified_after_rejection',
    }));
    expect(second).toEqual(expect.objectContaining({
      paymentState: 'review',
      reason: 'provider_verified_after_rejection',
    }));
    expect(storedTransaction.status).toBe('Rejected');
    expect(adminIssues).toHaveLength(2);
    expect(JSON.parse(adminIssues[1].metadata).reason)
      .toBe('provider_verified_after_rejection');
    expect(mocks.finalizeDeposit).not.toHaveBeenCalled();
  });

  it.each([
    ['refunded', 'provider_refunded_during_review'],
    ['failed', 'provider_terminal_during_review'],
  ])('records a material %s transition during review', async (providerStatus, reason) => {
    installInMemoryPrisma(transaction({
      status: 'Review',
      paymentReviewReason: 'underpayment',
      paymentReviewAt: new Date('2026-07-17T00:30:00.000Z'),
      paymentReviewResolvedAt: null,
    }));
    adminIssues.push({
      id: 'issue-original',
      type: 'crypto_payment_review',
      status: 'open',
      metadata: JSON.stringify({ transactionId: storedTransaction.id }),
      resolvedAt: null,
      resolvedBy: null,
    });

    const result = await reconcileNowPaymentsDeposit({
      transaction: cloneStored(),
      apiKey: 'nowpayments-test-key',
      fetchImpl: providerFetch(providerPayload({
        payment_status: providerStatus,
        actually_paid: providerStatus === 'refunded' ? '10.5' : '10',
      })),
      timeoutMs: 50,
      now: NOW,
    });

    expect(result).toEqual(expect.objectContaining({
      success: false,
      paymentState: 'review',
      transactionStatus: 'Review',
      retryable: false,
      reason,
    }));
    expect(adminIssues).toHaveLength(2);
    expect(JSON.parse(adminIssues[1].metadata)).toEqual(expect.objectContaining({
      reason,
      providerStatus,
    }));
    expect(mocks.finalizeDeposit).not.toHaveBeenCalled();
  });

  it.each([
    { label: 'lease held', acquired: false, initialStatus: 'Completed' },
    { label: 'lease lost', acquired: true, initialStatus: 'Completed' },
    { label: 'lease held', acquired: false, initialStatus: 'Review' },
    { label: 'lease lost', acquired: true, initialStatus: 'Review' },
    { label: 'lease held', acquired: false, initialStatus: 'Rejected' },
    { label: 'lease lost', acquired: true, initialStatus: 'Rejected' },
  ])('keeps a distinct callback retryable for $initialStatus when its $label', async ({
    acquired,
    initialStatus,
  }) => {
    const reviewFields = initialStatus === 'Completed'
      ? {}
      : {
        paymentReviewFingerprint: 'closed-review-fingerprint',
        paymentReviewReason: 'underpayment',
        paymentReviewAt: new Date('2026-07-17T00:30:00.000Z'),
        paymentReviewResolvedAt: initialStatus === 'Rejected'
          ? new Date('2026-07-17T00:45:00.000Z')
          : null,
      };
    installInMemoryPrisma(transaction({ status: initialStatus, ...reviewFields }));
    if (acquired) mocks.renewLease.mockResolvedValue(false);
    else mocks.acquireLease.mockResolvedValue({ acquired: false });
    const childId = 'child-payment-lease-test';
    const fetchImpl = providerFetch(providerPayload({
      payment_id: childId,
      parent_payment_id: PAYMENT_ID,
    }));

    const result = await reconcileNowPaymentsDeposit({
      transaction: cloneStored(),
      providerPaymentId: childId,
      apiKey: 'nowpayments-test-key',
      fetchImpl,
      timeoutMs: 50,
      auditCompleted: initialStatus === 'Completed',
      now: NOW,
    });

    expect(result).toEqual(expect.objectContaining({
      success: false,
      paymentState: 'verifying',
      transactionStatus: initialStatus,
      retryable: true,
      reason: acquired ? 'verification_lease_lost' : 'verification_in_progress',
    }));
    expect(fetchImpl).toHaveBeenCalledTimes(acquired ? 1 : 0);
    expect(adminIssues).toHaveLength(0);
    expect(mocks.finalizeDeposit).not.toHaveBeenCalled();
  });

  it('keeps a rejected callback retryable through a provider timeout', async () => {
    installInMemoryPrisma(transaction({
      status: 'Rejected',
      paymentReviewReason: 'underpayment',
      paymentReviewAt: new Date('2026-07-17T00:30:00.000Z'),
      paymentReviewResolvedAt: new Date('2026-07-17T00:45:00.000Z'),
    }));
    const fetchImpl = vi.fn(() => new Promise(() => {}));

    const result = await reconcileNowPaymentsDeposit({
      transaction: cloneStored(),
      providerPaymentId: PAYMENT_ID,
      apiKey: 'nowpayments-test-key',
      fetchImpl,
      timeoutMs: 5,
      now: NOW,
    });

    expect(result).toEqual(expect.objectContaining({
      success: false,
      paymentState: 'retryable',
      transactionStatus: 'Rejected',
      retryable: true,
      reason: 'timeout',
    }));
    expect(mocks.finalizeDeposit).not.toHaveBeenCalled();
  });

  it('does not reopen the same post-credit refund after an admin closes it', async () => {
    installInMemoryPrisma(transaction({ status: 'Completed' }));
    const refunded = providerPayload({
      payment_status: 'refunded',
      actually_paid: '10.5',
    });

    await reconcileNowPaymentsDeposit({
      transaction: cloneStored(),
      apiKey: 'nowpayments-test-key',
      fetchImpl: providerFetch(refunded),
      timeoutMs: 50,
      auditCompleted: true,
      now: NOW,
    });
    expect(adminIssues).toHaveLength(1);
    const closedAt = new Date('2026-07-17T00:45:00.000Z');
    storedTransaction = {
      ...storedTransaction,
      paymentReviewResolvedAt: closedAt,
    };
    adminIssues[0] = {
      ...adminIssues[0],
      status: 'resolved',
      resolvedAt: closedAt,
      resolvedBy: 'Ada',
    };

    const result = await reconcileNowPaymentsDeposit({
      transaction: cloneStored(),
      apiKey: 'nowpayments-test-key',
      fetchImpl: providerFetch(refunded),
      timeoutMs: 50,
      auditCompleted: true,
      now: NOW,
    });

    expect(result).toEqual(expect.objectContaining({
      success: true,
      paymentState: 'credited',
      transactionStatus: 'Completed',
      retryable: false,
    }));
    expect(storedTransaction.paymentReviewResolvedAt).toEqual(closedAt);
    expect(adminIssues).toHaveLength(1);
    expect(adminIssues[0].status).toBe('resolved');
    expect(mocks.finalizeDeposit).not.toHaveBeenCalled();
  });

  it('keeps distinct repeated child payments as separate review observations', async () => {
    installInMemoryPrisma(transaction());
    const reconcileChild = childId => reconcileNowPaymentsDeposit({
      transaction: cloneStored(),
      providerPaymentId: childId,
      apiKey: 'nowpayments-test-key',
      fetchImpl: providerFetch(providerPayload({
        payment_id: childId,
        parent_payment_id: PAYMENT_ID,
      })),
      timeoutMs: 50,
      now: NOW,
    });

    await reconcileChild('child-payment-a');
    await reconcileChild('child-payment-b');
    await reconcileChild('child-payment-b');

    expect(adminIssues).toHaveLength(2);
    const observations = adminIssues.map(issue => JSON.parse(issue.metadata));
    expect(observations.map(item => item.observedPaymentId)).toEqual([
      'child-payment-a',
      'child-payment-b',
    ]);
    expect(new Set(observations.map(item => item.reviewFingerprint)).size).toBe(2);
    expect(adminIssues.every(issue => issue.status === 'open')).toBe(true);
    expect(mocks.finalizeDeposit).not.toHaveBeenCalled();

    const closedAt = new Date('2026-07-17T00:45:00.000Z');
    storedTransaction = {
      ...storedTransaction,
      status: 'Rejected',
      paymentReviewResolvedAt: closedAt,
    };
    adminIssues = adminIssues.map(issue => ({
      ...issue,
      status: 'resolved',
      resolvedAt: closedAt,
      resolvedBy: 'Ada',
    }));

    const newObservation = await reconcileChild('child-payment-c');

    expect(newObservation).toEqual(expect.objectContaining({
      success: false,
      paymentState: 'review',
      transactionStatus: 'Rejected',
      retryable: false,
      reason: 'payment_id_mismatch',
    }));
    expect(adminIssues).toHaveLength(3);
    expect(JSON.parse(adminIssues[2].metadata).observedPaymentId).toBe('child-payment-c');
    expect(adminIssues[2].status).toBe('open');
    expect(storedTransaction).toEqual(expect.objectContaining({
      status: 'Rejected',
      paymentReviewReason: 'payment_id_mismatch',
      paymentReviewResolvedAt: null,
    }));
    expect(mocks.finalizeDeposit).not.toHaveBeenCalled();
  });

  it('does not query, lease, or finalize a Completed payment without an audit request', async () => {
    installInMemoryPrisma(transaction({ status: 'Completed' }));
    const fetchImpl = vi.fn();

    const result = await reconcileNowPaymentsDeposit({
      transaction: cloneStored(),
      apiKey: 'nowpayments-test-key',
      fetchImpl,
      now: NOW,
    });

    expect(result).toEqual(expect.objectContaining({
      success: true,
      paymentState: 'credited',
      transactionStatus: 'Completed',
      newlyFinalized: false,
      reason: 'already_completed',
    }));
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(mocks.acquireLease).not.toHaveBeenCalled();
    expect(mocks.finalizeDeposit).not.toHaveBeenCalled();
  });

  it('cannot apply a provider result after losing the ownership lease', async () => {
    installInMemoryPrisma(transaction());
    mocks.renewLease.mockResolvedValue(false);
    const original = cloneStored();

    const result = await reconcileNowPaymentsDeposit({
      transaction: cloneStored(),
      apiKey: 'nowpayments-test-key',
      fetchImpl: providerFetch(providerPayload()),
      timeoutMs: 50,
      now: NOW,
    });

    expect(result).toEqual(expect.objectContaining({
      success: false,
      paymentState: 'provider_pending',
      transactionStatus: 'Pending',
      newlyFinalized: false,
      reason: 'verification_lease_lost',
    }));
    expect(mocks.finalizeDeposit).not.toHaveBeenCalled();
    expect(storedTransaction).toEqual({
      ...original,
      paymentReconciliationAttemptAt: NOW,
    });
    expect(mocks.transactionUpdate).toHaveBeenCalledWith({
      where: { id: original.id },
      data: { paymentReconciliationAttemptAt: NOW },
    });
  });

  it('cannot overwrite a different provider ID bound while its query was in flight', async () => {
    installInMemoryPrisma(transaction({
      providerPaymentId: null,
      note: 'Crypto deposit ($11 USDT)',
    }));
    const fetchImpl = vi.fn().mockImplementation(async () => {
      storedTransaction = {
        ...storedTransaction,
        providerPaymentId: 'newer-provider-payment',
      };
      return {
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue(providerPayload()),
      };
    });

    const result = await reconcileNowPaymentsDeposit({
      transaction: cloneStored(),
      providerPaymentId: PAYMENT_ID,
      apiKey: 'nowpayments-test-key',
      fetchImpl,
      timeoutMs: 50,
      now: NOW,
    });

    expect(result).toEqual(expect.objectContaining({
      success: false,
      paymentState: 'review',
      reason: 'payment_id_mismatch',
    }));
    expect(storedTransaction.providerPaymentId).toBe('newer-provider-payment');
    expect(mocks.finalizeDeposit).not.toHaveBeenCalled();
  });

  it('rejects adoption of a provider payment ID already bound to another transaction', async () => {
    installInMemoryPrisma(transaction({
      providerPaymentId: null,
      note: 'Crypto deposit ($11 USDT)',
    }));
    otherTransactions.push(transaction({
      id: 'tx-crypto-other',
      reference: 'NTR-CRYPTO-OTHER',
      providerPaymentId: PAYMENT_ID,
    }));

    const result = await reconcileNowPaymentsDeposit({
      transaction: cloneStored(),
      providerPaymentId: PAYMENT_ID,
      apiKey: 'nowpayments-test-key',
      fetchImpl: vi.fn(),
      now: NOW,
    });

    expect(result).toEqual(expect.objectContaining({
      success: false,
      paymentState: 'review',
      transactionStatus: 'Review',
      reason: 'provider_payment_id_reused',
    }));
    expectNoCredit();
    expect(mocks.acquireLease).not.toHaveBeenCalled();
    expect(adminIssues).toHaveLength(1);
    expect(JSON.parse(adminIssues[0].metadata)).toEqual(expect.objectContaining({
      providerPaymentId: PAYMENT_ID,
      existingTransactionId: 'tx-crypto-other',
    }));
  });

  it('sends an ambiguous legacy note ID to review instead of skipping or rebinding it', async () => {
    installInMemoryPrisma(transaction({
      providerPaymentId: null,
      note: `Legacy crypto deposit [np:${PAYMENT_ID}] ($11 USDT)`,
    }));
    otherTransactions.push(transaction({
      id: 'tx-crypto-already-bound',
      reference: 'NTR-CRYPTO-BOUND',
      providerPaymentId: PAYMENT_ID,
    }));

    const result = await reconcileNowPaymentsDeposit({
      transaction: cloneStored(),
      apiKey: 'nowpayments-test-key',
      fetchImpl: vi.fn(),
      now: NOW,
    });

    expect(result).toEqual(expect.objectContaining({
      success: false,
      paymentState: 'review',
      transactionStatus: 'Review',
      reason: 'provider_payment_id_reused',
    }));
    expect(mocks.acquireLease).not.toHaveBeenCalled();
    expect(mocks.finalizeDeposit).not.toHaveBeenCalled();
    expect(adminIssues).toHaveLength(1);
  });

  it('turns a concurrent legacy provider-ID bind collision into review', async () => {
    installInMemoryPrisma(transaction({
      providerPaymentId: null,
      note: `Legacy crypto deposit [np:${PAYMENT_ID}] ($11 USDT)`,
    }));
    mocks.transactionUpdate
      .mockImplementationOnce(async ({ where, data }) => {
        if (where.id !== storedTransaction.id) throw new Error('Transaction not found');
        storedTransaction = { ...storedTransaction, ...data };
        return cloneStored();
      })
      .mockRejectedValueOnce({ code: 'P2002' });

    const result = await reconcileNowPaymentsDeposit({
      transaction: cloneStored(),
      apiKey: 'nowpayments-test-key',
      fetchImpl: providerFetch(providerPayload()),
      timeoutMs: 50,
      now: NOW,
    });

    expect(result).toEqual(expect.objectContaining({
      success: false,
      paymentState: 'review',
      transactionStatus: 'Review',
      retryable: false,
      reason: 'provider_payment_id_reused',
    }));
    expect(mocks.finalizeDeposit).not.toHaveBeenCalled();
    expect(adminIssues).toHaveLength(1);
  });

  it.each([
    [
      'missing_provider_payment_id',
      { providerPaymentId: null, note: 'Crypto deposit ($11 USDT)' },
    ],
    [
      'missing_expected_terms',
      {
        providerPriceAmount: null,
        providerPriceCurrency: null,
        note: `Crypto deposit [np:${PAYMENT_ID}]`,
      },
    ],
  ])('sends %s to review before querying the provider', async (reason, patch) => {
    installInMemoryPrisma(transaction(patch));
    const fetchImpl = vi.fn();

    const result = await reconcileNowPaymentsDeposit({
      transaction: cloneStored(),
      apiKey: 'nowpayments-test-key',
      fetchImpl,
      now: NOW,
    });

    expect(result).toEqual(expect.objectContaining({
      success: false,
      paymentState: 'review',
      transactionStatus: 'Review',
      reason,
    }));
    expectNoCredit();
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(mocks.acquireLease).not.toHaveBeenCalled();
    expect(adminIssues).toHaveLength(1);
  });

  it.each([
    ['already_completed', false],
    ['completed', true],
  ])(
    'never reports credited when a %s finalizer race returns a non-Completed row',
    async (reason, finalized) => {
      installInMemoryPrisma(transaction({ status: 'Processing' }));
      mocks.finalizeDeposit.mockImplementation(async () => ({
        finalized,
        reason,
        transaction: cloneStored(),
      }));

      const result = await reconcileNowPaymentsDeposit({
        transaction: cloneStored(),
        apiKey: 'nowpayments-test-key',
        fetchImpl: providerFetch(providerPayload()),
        timeoutMs: 50,
        now: NOW,
      });

      expect(result).toEqual(expect.objectContaining({
        success: false,
        paymentState: 'verifying',
        transactionStatus: 'Processing',
        newlyFinalized: false,
        reason,
      }));
      expect(result.success).toBe(false);
    },
  );
});
