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
  getCryptomusCreationCredentials,
  reconcileCryptoDeposit,
} = await import('@/lib/crypto-deposit');

const PAYMENT_ID = '940c4d31-70fb-4bf3-856b-5eb12a490af4';
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
    note: 'Crypto deposit ₦20,000',
    providerPaymentId: PAYMENT_ID,
    providerPriceAmount: '20000',
    providerPriceCurrency: 'ngn',
    providerPayAmount: '12.5',
    providerPayCurrency: 'usdt',
    providerPayAddress: 'TMwFHYXLJaRUPeW6421aqXL4ZEzPRFGkGT',
    providerPaymentStatus: 'check',
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
    uuid: PAYMENT_ID,
    payment_status: 'paid',
    order_id: REFERENCE,
    amount: '20000.00',
    currency: 'NGN',
    payer_amount: '12.500000',
    payer_currency: 'usdt',
    payment_amount: '12.5',
    merchant_amount: '12.25',
    is_final: true,
    ...overrides,
  };
}

function providerFetch(payload) {
  return vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: vi.fn().mockResolvedValue({ state: 0, result: payload }),
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
  const result = await reconcileCryptoDeposit({
    transaction: cloneStored(),
    credentials: { merchantId: 'test-merchant', apiKey: 'cryptomus-test-key', ready: true },
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

describe('getCryptomusCreationCredentials', () => {
  it('returns a key only when the persisted crypto gateway is enabled', async () => {
    mocks.settingFindUnique.mockResolvedValue({
      value: JSON.stringify({ enabled: true, fields: { merchantId: ' configured-merchant ', apiKey: ' configured-key ' } }),
    });

    await expect(getCryptomusCreationCredentials()).resolves.toEqual(
      expect.objectContaining({ merchantId: 'configured-merchant', apiKey: 'configured-key', ready: true }),
    );
  });

  it('does not let an environment key bypass a disabled gateway', async () => {
    vi.stubEnv('NOWPAYMENTS_API_KEY', 'environment-key');
    mocks.settingFindUnique.mockResolvedValue({
      value: JSON.stringify({ enabled: false, fields: { merchantId: 'configured-merchant', apiKey: 'configured-key' } }),
    });

    await expect(getCryptomusCreationCredentials()).resolves.toEqual(
      expect.objectContaining({ merchantId: '', apiKey: '', ready: false }),
    );
  });
});

describe('reconcileCryptoDeposit', () => {
  it('credits an exact confirmation once and short-circuits later non-audit checks', async () => {
    installInMemoryPrisma(transaction());
    const fetchImpl = providerFetch(providerPayload());

    const first = await reconcileCryptoDeposit({
      transaction: cloneStored(),
      credentials: { merchantId: 'test-merchant', apiKey: 'cryptomus-test-key', ready: true },
      fetchImpl,
      timeoutMs: 50,
      recoveredBy: 'dashboard',
      now: NOW,
    });
    const second = await reconcileCryptoDeposit({
      transaction: cloneStored(),
      credentials: { merchantId: 'test-merchant', apiKey: 'cryptomus-test-key', ready: true },
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
      providerPaidAmount: '12.5',
      recoveredBy: 'dashboard',
      claimableStatuses: expect.arrayContaining([
        'Pending', 'Processing', 'Expired', 'Failed', 'Cancelled',
      ]),
    }));
    expect(mocks.finalizeDeposit.mock.calls[0][0].claimableStatuses).not.toContain('Review');
  });

  // Cryptomus decides the over and underpayment question itself and reports it
  // in the status, so the amount comparison cases the previous provider needed
  // are gone. What remains ours to police is that the invoice being read is the
  // one we expect: right order, right uuid, right amount, right currency.
  it.each([
    ['underpayment', { payment_status: 'wrong_amount' }],
    ['overpayment', { payment_status: 'paid_over', payment_amount: '25' }],
    ['payment_id_mismatch', { uuid: '00000000-0000-4000-8000-000000000999' }],
    ['order_id_mismatch', { order_id: 'NTR-OTHER' }],
    ['amount_mismatch', { amount: '12' }],
    ['currency_mismatch', { currency: 'USD' }],
    ['locked', { payment_status: 'locked' }],
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

    if (['underpayment', 'overpayment'].includes(reason)) {
      expect(storedTransaction).toEqual(expect.objectContaining({
        providerPaymentStatus: patch.payment_status,
        providerActuallyPaid: patch.payment_amount || '12.5',
        providerLastVerifiedAt: NOW,
      }));
    }
  });

  // Overpaying by dust is the ordinary way a crypto payment arrives: the
  // customer rounds up, or pays from a wallet that will not send an exact
  // figure, and Cryptomus reports paid_over for a single cent. Holding those
  // for approval is what stopped crypto from being instant the way card and
  // transfer are.
  it('credits a dust overpayment without a human, at the invoiced naira amount', async () => {
    const { result } = await reconcile(transaction(), providerPayload({
      payment_status: 'paid_over',
      payer_amount: '12.500000',
      payment_amount: '12.75',
    }));

    expect(result).toEqual(expect.objectContaining({
      success: true,
      paymentState: 'credited',
      transactionStatus: 'Completed',
    }));
    expect(storedTransaction).toEqual(expect.objectContaining({
      status: 'Completed',
      paymentReviewReason: null,
    }));
    expect(adminIssues).toHaveLength(0);
    // The surplus does not inflate the credit. What is credited is the naira
    // the invoice was for, never a figure derived from the coin that arrived.
    expect(mocks.finalizeDeposit).toHaveBeenCalledTimes(1);
    expect(mocks.finalizeDeposit.mock.calls[0][0]).toEqual(expect.objectContaining({
      transactionId: storedTransaction.id,
    }));
  });

  it('keeps a provider-pending payment uncredited and records the observation', async () => {
    const { result } = await reconcile(
      transaction({ status: 'Processing' }),
      providerPayload({ payment_status: 'check', payment_amount: '0', is_final: false }),
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
      providerPaymentStatus: 'check',
      providerActuallyPaid: '0',
      providerLastVerifiedAt: NOW,
    }));
  });

  it.each([
    ['cancel', 'Cancelled', 'cancelled'],
    ['fail', 'Failed', 'failed'],
    ['system_fail', 'Failed', 'system_fail'],
  ])('preserves the row and records provider terminal status %s', async (providerStatus, status, expectedReason) => {
    const { result } = await reconcile(
      transaction({ status: 'Processing' }),
      providerPayload({ payment_status: providerStatus, payment_amount: '0' }),
    );

    expect(result).toEqual(expect.objectContaining({
      success: false,
      paymentState: 'failed',
      transactionStatus: status,
      reason: expectedReason,
      newlyFinalized: false,
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
      providerPayload({ payment_status: 'refund_paid' }),
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
    expect(storedTransaction.providerPaymentStatus).toBe('refund_paid');
  });

  it('preserves a credited balance on refund and opens a durable admin review', async () => {
    const completed = transaction({ status: 'Completed' });
    const { result, fetchImpl } = await reconcile(
      completed,
      providerPayload({ payment_status: 'refund_paid' }),
      { auditCompleted: true },
    );

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(mocks.finalizeDeposit).not.toHaveBeenCalled();
    expect(storedTransaction).toEqual(expect.objectContaining({
      status: 'Completed',
      paymentReviewReason: 'refunded_after_credit',
      paymentReviewAt: NOW,
      paymentReviewResolvedAt: null,
      providerPaymentStatus: 'refund_paid',
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
      providerPaymentStatus: 'refund_paid',
      providerActuallyPaid: '12.5',
    }));
    const fetchImpl = providerFetch(providerPayload());

    const first = await reconcileCryptoDeposit({
      transaction: cloneStored(),
      credentials: { merchantId: 'test-merchant', apiKey: 'cryptomus-test-key', ready: true },
      fetchImpl,
      timeoutMs: 50,
      now: NOW,
    });
    const second = await reconcileCryptoDeposit({
      transaction: cloneStored(),
      credentials: { merchantId: 'test-merchant', apiKey: 'cryptomus-test-key', ready: true },
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
      actuallyPaid: '12.5',
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

    const result = await reconcileCryptoDeposit({
      transaction: cloneStored(),
      credentials: { merchantId: 'test-merchant', apiKey: 'cryptomus-test-key', ready: true },
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

  it('preserves the account-deleted review reason on later provider verification', async () => {
    const { result } = await reconcile(
      transaction({
        status: 'Review',
        paymentReviewReason: 'account_deleted',
        paymentReviewAt: new Date('2026-07-17T00:30:00.000Z'),
        paymentReviewResolvedAt: null,
      }),
      providerPayload(),
    );

    expect(result).toEqual(expect.objectContaining({
      success: false,
      paymentState: 'review',
      transactionStatus: 'Review',
      reason: 'account_deleted',
    }));
    expect(mocks.finalizeDeposit).not.toHaveBeenCalled();
    expect(storedTransaction.paymentReviewReason).toBe('account_deleted');
    expect(storedTransaction.paymentReviewResolvedAt).toBeNull();
    expect(adminIssues).toHaveLength(1);
    expect(JSON.parse(adminIssues[0].metadata).reason).toBe('account_deleted');
  });

  it.each(['Cancelled', 'Expired', 'Failed'])(
    'recovers a late exact confirmation from %s',
    async initialStatus => {
      installInMemoryPrisma(transaction({ status: initialStatus }));

      const result = await reconcileCryptoDeposit({
        transaction: cloneStored(),
        credentials: { merchantId: 'test-merchant', apiKey: 'cryptomus-test-key', ready: true },
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

  it.each(['underpayment', 'overpayment', 'payment_id_mismatch'])(
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

      const result = await reconcileCryptoDeposit({
        transaction: cloneStored(),
        credentials: { merchantId: 'test-merchant', apiKey: 'cryptomus-test-key', ready: true },
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
        actuallyPaid: '12.5',
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

    const result = await reconcileCryptoDeposit({
      transaction: cloneStored(),
      credentials: { merchantId: 'test-merchant', apiKey: 'cryptomus-test-key', ready: true },
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
    const underpayment = providerPayload({ payment_status: 'wrong_amount' });

    await reconcileCryptoDeposit({
      transaction: cloneStored(),
      credentials: { merchantId: 'test-merchant', apiKey: 'cryptomus-test-key', ready: true },
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

    const result = await reconcileCryptoDeposit({
      transaction: cloneStored(),
      providerPaymentId: PAYMENT_ID,
      credentials: { merchantId: 'test-merchant', apiKey: 'cryptomus-test-key', ready: true },
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
    await reconcileCryptoDeposit({
      transaction: cloneStored(),
      credentials: { merchantId: 'test-merchant', apiKey: 'cryptomus-test-key', ready: true },
      fetchImpl: providerFetch(providerPayload({
        payment_status: 'wrong_amount',
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
      credentials: { merchantId: 'test-merchant', apiKey: 'cryptomus-test-key', ready: true },
      fetchImpl: providerFetch(providerPayload()),
      timeoutMs: 50,
      now: NOW,
    };
    const first = await reconcileCryptoDeposit(exactInput);
    const second = await reconcileCryptoDeposit({
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
    ['refund_paid', 'provider_refunded_during_review'],
    ['fail', 'provider_terminal_during_review'],
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

    const result = await reconcileCryptoDeposit({
      transaction: cloneStored(),
      credentials: { merchantId: 'test-merchant', apiKey: 'cryptomus-test-key', ready: true },
      fetchImpl: providerFetch(providerPayload({
        payment_status: providerStatus,
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

    const result = await reconcileCryptoDeposit({
      transaction: cloneStored(),
      providerPaymentId: childId,
      credentials: { merchantId: 'test-merchant', apiKey: 'cryptomus-test-key', ready: true },
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

    const result = await reconcileCryptoDeposit({
      transaction: cloneStored(),
      providerPaymentId: PAYMENT_ID,
      credentials: { merchantId: 'test-merchant', apiKey: 'cryptomus-test-key', ready: true },
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
      payment_status: 'refund_paid',
      payment_amount: '12.5',
    });

    await reconcileCryptoDeposit({
      transaction: cloneStored(),
      credentials: { merchantId: 'test-merchant', apiKey: 'cryptomus-test-key', ready: true },
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

    const result = await reconcileCryptoDeposit({
      transaction: cloneStored(),
      credentials: { merchantId: 'test-merchant', apiKey: 'cryptomus-test-key', ready: true },
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

    it('does not query, lease, or finalize a Completed payment without an audit request', async () => {
    installInMemoryPrisma(transaction({ status: 'Completed' }));
    const fetchImpl = vi.fn();

    const result = await reconcileCryptoDeposit({
      transaction: cloneStored(),
      credentials: { merchantId: 'test-merchant', apiKey: 'cryptomus-test-key', ready: true },
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

    const result = await reconcileCryptoDeposit({
      transaction: cloneStored(),
      credentials: { merchantId: 'test-merchant', apiKey: 'cryptomus-test-key', ready: true },
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
      note: 'Crypto deposit ₦20,000',
    }));
    const fetchImpl = vi.fn().mockImplementation(async () => {
      storedTransaction = {
        ...storedTransaction,
        providerPaymentId: '11111111-2222-4333-8444-555555555555',
      };
      return {
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue({ state: 0, result: providerPayload() }),
      };
    });

    const result = await reconcileCryptoDeposit({
      transaction: cloneStored(),
      providerPaymentId: PAYMENT_ID,
      credentials: { merchantId: 'test-merchant', apiKey: 'cryptomus-test-key', ready: true },
      fetchImpl,
      timeoutMs: 50,
      now: NOW,
    });

    expect(result).toEqual(expect.objectContaining({
      success: false,
      paymentState: 'review',
      reason: 'payment_id_mismatch',
    }));
    expect(storedTransaction.providerPaymentId).toBe('11111111-2222-4333-8444-555555555555');
    expect(mocks.finalizeDeposit).not.toHaveBeenCalled();
  });

  it('rejects adoption of a provider payment ID already bound to another transaction', async () => {
    installInMemoryPrisma(transaction({
      providerPaymentId: null,
      note: 'Crypto deposit ₦20,000',
    }));
    otherTransactions.push(transaction({
      id: 'tx-crypto-other',
      reference: 'NTR-CRYPTO-OTHER',
      providerPaymentId: PAYMENT_ID,
    }));

    const result = await reconcileCryptoDeposit({
      transaction: cloneStored(),
      providerPaymentId: PAYMENT_ID,
      credentials: { merchantId: 'test-merchant', apiKey: 'cryptomus-test-key', ready: true },
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

      it.each([
    [
      'missing_payment_identifier',
      { providerPaymentId: null, reference: null },
    ],
    [
      'missing_expected_terms',
      {
        providerPriceAmount: null,
        providerPriceCurrency: null,
      },
    ],
  ])('sends %s to review before querying the provider', async (reason, patch) => {
    installInMemoryPrisma(transaction(patch));
    const fetchImpl = vi.fn();

    const result = await reconcileCryptoDeposit({
      transaction: cloneStored(),
      credentials: { merchantId: 'test-merchant', apiKey: 'cryptomus-test-key', ready: true },
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

      const result = await reconcileCryptoDeposit({
        transaction: cloneStored(),
        credentials: { merchantId: 'test-merchant', apiKey: 'cryptomus-test-key', ready: true },
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
