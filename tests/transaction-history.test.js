import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockTransaction = {
  findMany: vi.fn(),
  count: vi.fn(),
  groupBy: vi.fn(),
};

vi.mock('@/lib/prisma', () => ({ default: { transaction: mockTransaction } }));
vi.mock('@/lib/auth', () => ({ getCurrentUser: vi.fn().mockResolvedValue({ id: 'user-1' }) }));
vi.mock('@/lib/logger', () => ({ log: { error: vi.fn() } }));

const { GET } = await import('@/app/api/transactions/route');

function request(params = {}) {
  const url = new URL('http://localhost/api/transactions');
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  return new Request(url);
}

beforeEach(() => {
  vi.clearAllMocks();
  mockTransaction.findMany.mockResolvedValue([]);
  mockTransaction.count.mockResolvedValue(0);
  mockTransaction.groupBy.mockResolvedValue([]);
});

describe('GET /api/transactions — 180-day history boundary', () => {
  it('never queries transactions older than 180 days', async () => {
    const before = Date.now();
    await GET(request());
    const after = Date.now();

    const cutoff = mockTransaction.findMany.mock.calls[0][0].where.createdAt.gte.getTime();
    const oneHundredEightyDays = 180 * 24 * 60 * 60 * 1000;
    expect(cutoff).toBeGreaterThanOrEqual(before - oneHundredEightyDays);
    expect(cutoff).toBeLessThanOrEqual(after - oneHundredEightyDays);
    expect(mockTransaction.count.mock.calls[0][0].where.createdAt.gte.getTime()).toBe(cutoff);
  });

  it('does not allow an older requested start date to widen the boundary', async () => {
    await GET(request({ start: '2020-01-01T00:00:00.000Z' }));

    const cutoff = mockTransaction.findMany.mock.calls[0][0].where.createdAt.gte;
    expect(cutoff.getFullYear()).toBeGreaterThan(2020);
  });

  it('paginates and filters within the allowed window', async () => {
    mockTransaction.count.mockResolvedValue(26);
    mockTransaction.groupBy.mockResolvedValue([{ type: 'deposit' }, { type: 'refund' }]);

    const response = await GET(request({ page: '2', perPage: '25', type: 'refund' }));
    const body = await response.json();
    const query = mockTransaction.findMany.mock.calls[0][0];

    expect(query).toMatchObject({ skip: 25, take: 25 });
    expect(query.where.type).toBe('refund');
    expect(body).toMatchObject({
      total: 26,
      page: 2,
      totalPages: 2,
      types: ['deposit', 'refund'],
      historyDays: 180,
    });
  });

  it('serializes only the selected page', async () => {
    mockTransaction.findMany.mockResolvedValue([{
      id: 'tx-1',
      type: 'deposit',
      reference: 'DEP-1',
      amount: 250000,
      status: 'Completed',
      method: 'bank',
      note: 'Wallet top-up',
      createdAt: new Date('2026-07-01T12:00:00.000Z'),
    }]);

    const response = await GET(request());
    const body = await response.json();

    expect(body.transactions[0]).toMatchObject({
      id: 'tx-1',
      amount: 2500,
      date: '2026-07-01T12:00:00.000Z',
    });
  });

  it('serializes the customer-facing payment state for every durable Flutterwave status', async () => {
    const cases = [
      ['Completed', 'credited'],
      ['Processing', 'verifying'],
      ['Pending', 'provider_pending'],
      ['Expired', 'retryable'],
      ['Failed', 'failed'],
      ['Cancelled', 'failed'],
    ];
    mockTransaction.findMany.mockResolvedValue(cases.map(([status], index) => ({
      id: `flutterwave-${index}`,
      userId: 'user-1',
      type: 'deposit',
      reference: `NTR-FLW-${index}`,
      amount: 500_000,
      status,
      method: 'flutterwave',
      note: 'Flutterwave deposit',
      createdAt: new Date(`2026-07-${String(index + 1).padStart(2, '0')}T12:00:00.000Z`),
    })));

    const response = await GET(request());
    const body = await response.json();

    expect(body.transactions).toHaveLength(cases.length);
    for (const [index, [transactionStatus, paymentState]] of cases.entries()) {
      expect(body.transactions[index], transactionStatus).toMatchObject({
        status: transactionStatus,
        method: 'flutterwave',
        paymentState,
      });
    }
  });

  it('normalizes legacy null-method deposits as Flutterwave transactions', async () => {
    mockTransaction.findMany.mockResolvedValue([{
      id: 'legacy-flutterwave',
      userId: 'user-1',
      type: 'deposit',
      reference: 'NTR-LEGACY-FLW',
      amount: 500_000,
      status: 'Processing',
      method: null,
      note: 'Legacy Flutterwave deposit',
      createdAt: new Date('2026-07-10T12:00:00.000Z'),
    }]);

    const response = await GET(request());
    const body = await response.json();

    expect(body.transactions[0]).toMatchObject({
      method: 'flutterwave',
      status: 'Processing',
      paymentState: 'verifying',
    });
  });
});
