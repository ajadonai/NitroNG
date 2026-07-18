import { beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const mockRequireAdmin = vi.fn();
const mockLogActivity = vi.fn();
const mockCanPerformAction = vi.fn();
vi.mock('@/lib/admin', () => ({
  requireAdmin: (...args) => mockRequireAdmin(...args),
  logActivity: (...args) => mockLogActivity(...args),
  canPerformAction: (...args) => mockCanPerformAction(...args),
}));

const mockLogError = vi.fn();
vi.mock('@/lib/logger', () => ({
  log: { error: (...args) => mockLogError(...args) },
}));

vi.mock('@/lib/smm', () => ({
  getBalance: vi.fn(),
  getServices: vi.fn(),
  isProviderConfigured: vi.fn(() => false),
}));

const mockIssueFindUnique = vi.fn();
const mockIssueUpdate = vi.fn();
const mockIssueFindMany = vi.fn();
const mockIssueCount = vi.fn();
const mockSettingFindUnique = vi.fn();
const mockTxIssueFindUnique = vi.fn();
const mockTxIssueFindFirst = vi.fn();
const mockTxIssueUpdateMany = vi.fn();
const mockTxDepositFindUnique = vi.fn();
const mockTxDepositUpdateMany = vi.fn();

const mockTx = {
  adminIssue: {
    findUnique: mockTxIssueFindUnique,
    findFirst: mockTxIssueFindFirst,
    updateMany: mockTxIssueUpdateMany,
  },
  transaction: {
    findUnique: mockTxDepositFindUnique,
    updateMany: mockTxDepositUpdateMany,
  },
};

const mockPrisma = {
  adminIssue: {
    findUnique: mockIssueFindUnique,
    findMany: mockIssueFindMany,
    count: mockIssueCount,
    update: mockIssueUpdate,
  },
  setting: { findUnique: mockSettingFindUnique },
  $transaction: vi.fn(async callback => callback(mockTx)),
};
vi.mock('@/lib/prisma', () => ({ default: mockPrisma }));

const { GET, POST } = await import('@/app/api/admin/issues/route');

const REVIEW_AT = new Date('2026-07-17T08:00:00.000Z');

function makeRequest(action = 'resolve', issueId = 'issue-1') {
  return { json: async () => ({ action, issueId }) };
}

function makeMetadata(overrides = {}) {
  return JSON.stringify({
    transactionId: 'tx-1',
    reference: 'CRYPTO-REF-1',
    userId: 'user-1',
    reason: 'underpayment',
    reviewFingerprint: 'review-fingerprint-1',
    providerPaymentId: 'np-123',
    ...overrides,
  });
}

function makeIssue(overrides = {}) {
  return {
    id: 'issue-1',
    type: 'crypto_payment_review',
    title: 'Crypto payment review: underpayment',
    message: 'Review this payment',
    metadata: makeMetadata(),
    status: 'open',
    createdAt: new Date('2026-07-17T08:05:00.000Z'),
    ...overrides,
  };
}

function makeDeposit(overrides = {}) {
  return {
    id: 'tx-1',
    type: 'deposit',
    method: 'crypto',
    reference: 'CRYPTO-REF-1',
    userId: 'user-1',
    status: 'Review',
    amount: 150000,
    providerPaymentId: 'np-123',
    providerPayAmount: '1.25',
    providerPayCurrency: 'usdttrc20',
    paymentReviewFingerprint: 'review-fingerprint-1',
    paymentReviewReason: 'underpayment',
    paymentReviewAt: REVIEW_AT,
    paymentReviewResolvedAt: null,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireAdmin.mockResolvedValue({
    admin: { id: 'admin-1', name: 'Ada', role: 'owner' },
    error: null,
  });
  const issue = makeIssue();
  mockIssueFindUnique.mockResolvedValue(issue);
  mockTxIssueFindUnique.mockResolvedValue(issue);
  mockTxIssueFindFirst.mockResolvedValue(issue);
  mockTxDepositFindUnique.mockResolvedValue(makeDeposit());
  mockTxDepositUpdateMany.mockResolvedValue({ count: 1 });
  mockTxIssueUpdateMany.mockResolvedValue({ count: 1 });
  mockIssueUpdate.mockResolvedValue(issue);
  mockLogActivity.mockResolvedValue(undefined);
  mockCanPerformAction.mockReturnValue(true);
  mockIssueFindMany.mockResolvedValue([]);
  mockIssueCount.mockResolvedValue(0);
  mockSettingFindUnique.mockResolvedValue(null);
  mockPrisma.$transaction.mockImplementation(async callback => callback(mockTx));
});

describe('admin crypto payment review disposition', () => {
  it('requires write access to the issues page', async () => {
    await POST(makeRequest());
    expect(mockRequireAdmin).toHaveBeenCalledWith('issues', true);
  });

  it('atomically resolves an uncredited Review deposit as Rejected', async () => {
    const response = await POST(makeRequest('resolve'));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ success: true, detail: 'Payment review resolved' });
    expect(mockPrisma.$transaction).toHaveBeenCalledWith(
      expect.any(Function),
      { isolationLevel: 'Serializable' },
    );

    const depositWrite = mockTxDepositUpdateMany.mock.calls[0][0];
    const issueWrite = mockTxIssueUpdateMany.mock.calls[0][0];
    expect(depositWrite.data).toEqual({
      paymentReviewResolvedAt: expect.any(Date),
      status: 'Rejected',
    });
    expect(issueWrite.data).toEqual({
      status: 'resolved',
      resolvedAt: depositWrite.data.paymentReviewResolvedAt,
      resolvedBy: 'Ada',
    });
    expect(issueWrite.data.resolvedAt).toBe(depositWrite.data.paymentReviewResolvedAt);
  });

  it('preserves Completed status and changes no wallet or provider facts', async () => {
    mockTxDepositFindUnique.mockResolvedValue(makeDeposit({ status: 'Completed' }));

    const response = await POST(makeRequest('resolve'));

    expect(response.status).toBe(200);
    const depositWrite = mockTxDepositUpdateMany.mock.calls[0][0];
    expect(depositWrite.data).toEqual({ paymentReviewResolvedAt: expect.any(Date) });
    expect(depositWrite.data).not.toHaveProperty('status');
    expect(depositWrite.data).not.toHaveProperty('amount');
    expect(depositWrite.data).not.toHaveProperty('balance');
    expect(depositWrite.data).not.toHaveProperty('providerPaymentId');
    expect(depositWrite.data).not.toHaveProperty('providerPayAmount');
  });

  it('closes a new anomaly on an already Rejected payment without changing its status', async () => {
    mockTxDepositFindUnique.mockResolvedValue(makeDeposit({ status: 'Rejected' }));

    const response = await POST(makeRequest('resolve'));

    expect(response.status).toBe(200);
    const depositWrite = mockTxDepositUpdateMany.mock.calls[0][0];
    expect(depositWrite.data).toEqual({ paymentReviewResolvedAt: expect.any(Date) });
    expect(depositWrite.data).not.toHaveProperty('status');
  });

  it.each(['Pending', 'Processing', 'Failed', 'Cancelled', 'Expired', 'Refunded'])(
    'fails closed for unexpected %s transaction status',
    async (status) => {
      mockTxDepositFindUnique.mockResolvedValue(makeDeposit({ status }));

      const response = await POST(makeRequest('resolve'));

      expect(response.status).toBe(409);
      expect(mockTxDepositUpdateMany).not.toHaveBeenCalled();
      expect(mockTxIssueUpdateMany).not.toHaveBeenCalled();
    },
  );

  it('uses the same atomic disposition for ignore', async () => {
    const response = await POST(makeRequest('ignore'));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ success: true, detail: 'Payment review ignored' });
    const depositWrite = mockTxDepositUpdateMany.mock.calls[0][0];
    const issueWrite = mockTxIssueUpdateMany.mock.calls[0][0];
    expect(depositWrite.data.status).toBe('Rejected');
    expect(issueWrite.data).toEqual({
      status: 'ignored',
      resolvedAt: depositWrite.data.paymentReviewResolvedAt,
      resolvedBy: 'Ada',
    });
  });

  it.each(['transactionId', 'reference', 'userId', 'reason', 'reviewFingerprint'])(
    'fails closed when metadata is missing %s',
    async (field) => {
      const metadata = JSON.parse(makeMetadata());
      delete metadata[field];
      const issue = makeIssue({ metadata: JSON.stringify(metadata) });
      mockIssueFindUnique.mockResolvedValue(issue);
      mockTxIssueFindUnique.mockResolvedValue(issue);

      const response = await POST(makeRequest());

      expect(response.status).toBe(409);
      expect(mockTxDepositUpdateMany).not.toHaveBeenCalled();
      expect(mockTxIssueUpdateMany).not.toHaveBeenCalled();
      expect(mockLogActivity).not.toHaveBeenCalled();
    },
  );

  it('fails closed for malformed metadata', async () => {
    const issue = makeIssue({ metadata: '{not-json' });
    mockIssueFindUnique.mockResolvedValue(issue);
    mockTxIssueFindUnique.mockResolvedValue(issue);

    const response = await POST(makeRequest());

    expect(response.status).toBe(409);
    expect(mockTxDepositFindUnique).not.toHaveBeenCalled();
  });

  it.each([
    ['missing transaction', null],
    ['not a deposit', makeDeposit({ type: 'withdrawal' })],
    ['not crypto', makeDeposit({ method: 'bank' })],
    ['wrong reference', makeDeposit({ reference: 'OTHER' })],
    ['wrong user', makeDeposit({ userId: 'user-2' })],
    ['missing current reason', makeDeposit({ paymentReviewReason: null })],
    ['missing review timestamp', makeDeposit({ paymentReviewAt: null })],
    ['review already disposed', makeDeposit({ paymentReviewResolvedAt: new Date() })],
  ])('fails closed for %s', async (_label, deposit) => {
    mockTxDepositFindUnique.mockResolvedValue(deposit);

    const response = await POST(makeRequest());

    expect(response.status).toBe(409);
    expect(mockTxDepositUpdateMany).not.toHaveBeenCalled();
    expect(mockTxIssueUpdateMany).not.toHaveBeenCalled();
    expect(mockLogActivity).not.toHaveBeenCalled();
  });

  it('rejects a stale anomaly when a newer observation is open', async () => {
    mockTxDepositFindUnique.mockResolvedValue(makeDeposit({
      paymentReviewFingerprint: 'review-fingerprint-2',
      paymentReviewReason: 'repeated_payment',
    }));
    mockTxIssueFindFirst.mockResolvedValue(makeIssue({
      id: 'issue-newer',
      title: 'Crypto payment review: repeated_payment',
      metadata: makeMetadata({ reason: 'repeated_payment' }),
      createdAt: new Date('2026-07-17T08:10:00.000Z'),
    }));

    const response = await POST(makeRequest('resolve'));
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.error).toContain('newer payment observation');
    expect(mockTxDepositUpdateMany).not.toHaveBeenCalled();
    expect(mockTxIssueUpdateMany).not.toHaveBeenCalled();
  });

  it('guards both writes against concurrent status and identity changes', async () => {
    await POST(makeRequest());

    expect(mockTxDepositUpdateMany).toHaveBeenCalledWith({
      where: {
        id: 'tx-1',
        type: 'deposit',
        method: 'crypto',
        reference: 'CRYPTO-REF-1',
        userId: 'user-1',
        status: 'Review',
        paymentReviewFingerprint: 'review-fingerprint-1',
        paymentReviewReason: 'underpayment',
        paymentReviewAt: REVIEW_AT,
        paymentReviewResolvedAt: null,
      },
      data: expect.any(Object),
    });
    expect(mockTxIssueUpdateMany).toHaveBeenCalledWith({
      where: {
        type: 'crypto_payment_review',
        status: 'open',
        metadata: { contains: '\"transactionId\":\"tx-1\"' },
      },
      data: expect.any(Object),
    });
  });

  it('closes every open anomaly attached to the payment in one disposition', async () => {
    mockTxIssueUpdateMany.mockResolvedValue({ count: 3 });

    const response = await POST(makeRequest('resolve'));

    expect(response.status).toBe(200);
    expect(mockTxIssueUpdateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        type: 'crypto_payment_review',
        status: 'open',
        metadata: { contains: '\"transactionId\":\"tx-1\"' },
      },
    }));
  });

  it('returns 409 without closing the issue when the guarded deposit write loses a race', async () => {
    mockTxDepositUpdateMany.mockResolvedValue({ count: 0 });

    const response = await POST(makeRequest());

    expect(response.status).toBe(409);
    expect(mockTxIssueUpdateMany).not.toHaveBeenCalled();
    expect(mockLogActivity).not.toHaveBeenCalled();
  });

  it('keeps the existing idempotent response for an already resolved issue', async () => {
    mockIssueFindUnique.mockResolvedValue(makeIssue({ status: 'resolved' }));

    const response = await POST(makeRequest('resolve'));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ success: true, alreadyResolved: true });
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    expect(mockLogActivity).not.toHaveBeenCalled();
  });

  it('treats an ignored crypto issue as closed for either action', async () => {
    mockIssueFindUnique.mockResolvedValue(makeIssue({ status: 'ignored' }));

    const response = await POST(makeRequest('resolve'));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ success: true, alreadyResolved: true });
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    expect(mockTxDepositUpdateMany).not.toHaveBeenCalled();
  });

  it.each(['resolve', 'ignore'])(
    'requires payment approval permission before crypto %s',
    async (action) => {
      mockCanPerformAction.mockReturnValue(false);

      const response = await POST(makeRequest(action));
      const body = await response.json();

      expect(response.status).toBe(403);
      expect(body.error).toContain('Not authorized');
      expect(mockCanPerformAction).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'admin-1' }),
        'payments.approve',
      );
      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
      expect(mockTxDepositUpdateMany).not.toHaveBeenCalled();
      expect(mockLogActivity).not.toHaveBeenCalled();
    },
  );

  it('enforces payment approval permission before idempotent crypto responses', async () => {
    mockIssueFindUnique.mockResolvedValue(makeIssue({ status: 'resolved' }));
    mockCanPerformAction.mockReturnValue(false);

    const response = await POST(makeRequest('resolve'));

    expect(response.status).toBe(403);
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  it('logs admin activity only after the atomic commit succeeds', async () => {
    await POST(makeRequest('resolve'));

    expect(mockLogActivity).toHaveBeenCalledWith(
      'Ada',
      'Resolved issue: Crypto payment review: underpayment',
      'system',
    );
    expect(mockPrisma.$transaction.mock.invocationCallOrder[0])
      .toBeLessThan(mockLogActivity.mock.invocationCallOrder[0]);
  });

  it('leaves non-crypto issue handling unchanged', async () => {
    const issue = makeIssue({ type: 'order_failure' });
    mockIssueFindUnique.mockResolvedValue(issue);

    const response = await POST(makeRequest('resolve'));

    expect(response.status).toBe(200);
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    expect(mockIssueUpdate).toHaveBeenCalledWith({
      where: { id: 'issue-1' },
      data: { status: 'resolved', resolvedAt: expect.any(Date), resolvedBy: 'Ada' },
    });
  });

  it('reports crypto review disposition permission to the UI', async () => {
    mockCanPerformAction.mockReturnValue(false);

    const response = await GET({ url: 'http://localhost/api/admin/issues' });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.canResolveCryptoReviews).toBe(false);
    expect(mockCanPerformAction).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'admin-1' }),
      'payments.approve',
    );
  });

  it('keeps every open crypto review visible beyond the general 100-issue window', async () => {
    const ordinaryIssue = makeIssue({ id: 'ordinary-1', type: 'order_failure' });
    const priorityReview = makeIssue({ id: 'priority-review' });
    mockIssueFindMany
      .mockResolvedValueOnce([ordinaryIssue])
      .mockResolvedValueOnce([priorityReview]);

    const response = await GET({ url: 'http://localhost/api/admin/issues' });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mockIssueFindMany).toHaveBeenNthCalledWith(1, {
      where: {},
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    expect(mockIssueFindMany).toHaveBeenNthCalledWith(2, {
      where: { type: 'crypto_payment_review', status: 'open' },
      orderBy: { createdAt: 'desc' },
    });
    expect(body.issues.map(issue => issue.id)).toEqual([
      'priority-review',
      'ordinary-1',
    ]);
  });

  it('deduplicates an open crypto review already inside the general window', async () => {
    const review = makeIssue({ id: 'priority-review' });
    mockIssueFindMany
      .mockResolvedValueOnce([review])
      .mockResolvedValueOnce([review]);

    const response = await GET({ url: 'http://localhost/api/admin/issues' });
    const body = await response.json();

    expect(body.issues.map(issue => issue.id)).toEqual(['priority-review']);
  });
});

describe('admin crypto payment review UI wiring', () => {
  const source = fs.readFileSync(
    path.join(process.cwd(), 'components/admin-extra-pages.jsx'),
    'utf8',
  );

  it('shows open crypto reviews first, counted, highlighted, and expanded by default', () => {
    expect(source).toMatch(
      /cryptoPaymentReviews\s*=\s*issues\.filter\(i\s*=>\s*i\.type\s*===\s*"crypto_payment_review"\s*&&\s*i\.status\s*===\s*"open"\)/,
    );

    const reviewSection = source.indexOf('<IssueSection title="Crypto Payment Reviews"');
    const cronSection = source.indexOf('<IssueSection title="Cron Results"');
    expect(reviewSection).toBeGreaterThan(-1);
    expect(reviewSection).toBeLessThan(cronSection);

    const reviewMarkup = source.slice(reviewSection, cronSection);
    expect(reviewMarkup).toContain('defaultOpen={cryptoPaymentReviews.length > 0}');
    expect(reviewMarkup).toContain('count={cryptoPaymentReviews.length}');
    expect(reviewMarkup).toContain('countColor={cryptoPaymentReviews.length > 0 ? redBadge : greenBadge}');
    expect(reviewMarkup).toContain('<IssueRow key={issue.id} issue={issue}');
    expect(reviewMarkup).toContain('canAct={canResolveCryptoReviews}');
    expect(source).toContain('setCanResolveCryptoReviews(d.canResolveCryptoReviews === true)');
    expect(source).toContain('Owner review');
  });
});
