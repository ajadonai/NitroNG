import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockRequireAdmin = vi.fn();
const mockLogActivity = vi.fn();
vi.mock('@/lib/admin', () => ({
  requireAdmin: (...args) => mockRequireAdmin(...args),
  logActivity: (...args) => mockLogActivity(...args),
}));

const mockFindMany = vi.fn();
const mockCount = vi.fn();
const mockCreate = vi.fn();
const mockUserFindUnique = vi.fn();

const mockTx = {
  user: { findUnique: mockUserFindUnique },
  nitroPointLedger: { create: mockCreate },
};

const mockGroupBy = vi.fn();
const mockLedgerAggregate = vi.fn();
const mockOrderAggregate = vi.fn();
const mockPrisma = {
  nitroPointLedger: { findMany: mockFindMany, count: mockCount, groupBy: mockGroupBy, aggregate: mockLedgerAggregate },
  order: { aggregate: mockOrderAggregate },
  $transaction: vi.fn(async (fn, _opts) => fn(mockTx)),
};
vi.mock('@/lib/prisma', () => ({ default: mockPrisma }));

const mockGetBalanceTx = vi.fn();
vi.mock('@/lib/nitro-rewards', () => ({
  getPointsBalanceKoboTx: (...args) => mockGetBalanceTx(...args),
}));

const { GET, POST } = await import('@/app/api/admin/rewards/route');

function makeReq(params = {}) {
  const url = new URL('http://localhost/api/admin/rewards');
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return { url: url.toString() };
}

function makePostReq(body) {
  return { json: async () => body };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireAdmin.mockResolvedValue({ admin: { id: 'adm1', name: 'Admin', role: 'admin' }, error: null });
  mockFindMany.mockResolvedValue([]);
  mockCount.mockResolvedValue(0);
  mockUserFindUnique.mockResolvedValue({ id: 'u1', name: 'Test User' });
  mockGetBalanceTx.mockResolvedValue(500000);
  mockCreate.mockResolvedValue({ id: 'led1', type: 'manual_credit', pointsKobo: 10000, reason: 'test' });
  mockLogActivity.mockResolvedValue(undefined);
  mockGroupBy.mockResolvedValue([]);
  mockLedgerAggregate.mockResolvedValue({ _sum: { pointsKobo: 0 } });
  mockOrderAggregate.mockResolvedValue({
    _sum: { loyaltyDiscount: 0, campaignDiscount: 0, nitroPointsRedeemedKobo: 0 },
    _count: 0,
  });
});

describe('GET /api/admin/rewards', () => {
  it('blocks unauthenticated requests', async () => {
    const errResp = Response.json({ error: 'Unauthorized' }, { status: 401 });
    mockRequireAdmin.mockResolvedValue({ admin: null, error: errResp });
    const res = await GET(makeReq());
    expect(res.status).toBe(401);
  });

  it('requires rewards page access', async () => {
    await GET(makeReq());
    expect(mockRequireAdmin).toHaveBeenCalledWith('rewards');
  });

  it('clamps perPage to 100', async () => {
    await GET(makeReq({ perPage: '999' }));
    const call = mockFindMany.mock.calls[0][0];
    expect(call.take).toBe(100);
  });

  it('returns 400 for invalid from date', async () => {
    const res = await GET(makeReq({ from: 'banana' }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain('Invalid');
  });

  it('returns 400 for invalid to date', async () => {
    const res = await GET(makeReq({ to: 'not-a-date' }));
    expect(res.status).toBe(400);
  });

  it('filters by type', async () => {
    await GET(makeReq({ type: 'earned_order' }));
    const call = mockFindMany.mock.calls[0][0];
    expect(call.where.type).toBe('earned_order');
  });

  it('filters by userId', async () => {
    await GET(makeReq({ userId: 'u123' }));
    const call = mockFindMany.mock.calls[0][0];
    expect(call.where.userId).toBe('u123');
  });

  it('filters by search across user/order/reason', async () => {
    await GET(makeReq({ search: 'NTR-1234' }));
    const call = mockFindMany.mock.calls[0][0];
    expect(call.where.OR).toBeDefined();
    expect(call.where.OR.length).toBe(4);
  });

  it('filters by date range', async () => {
    await GET(makeReq({ from: '2026-01-01', to: '2026-01-31' }));
    const call = mockFindMany.mock.calls[0][0];
    expect(call.where.createdAt.gte).toEqual(new Date('2026-01-01'));
    expect(call.where.createdAt.lte).toBeDefined();
  });

  it('paginates correctly', async () => {
    await GET(makeReq({ page: '3', perPage: '10' }));
    const call = mockFindMany.mock.calls[0][0];
    expect(call.skip).toBe(20);
    expect(call.take).toBe(10);
  });

  it('returns shaped response', async () => {
    mockFindMany.mockResolvedValue([{
      id: 'led1', userId: 'u1', type: 'earned_order', pointsKobo: 5000,
      reason: null, createdAt: new Date('2026-06-01'),
      user: { id: 'u1', name: 'Test User', email: 'test@x.com' },
      order: { orderId: 'NTR-100' },
      createdByAdmin: null,
    }]);
    mockCount.mockResolvedValue(1);

    const res = await GET(makeReq());
    const data = await res.json();

    expect(data.entries).toHaveLength(1);
    expect(data.entries[0]).toEqual({
      id: 'led1',
      userId: 'u1',
      userName: 'Test User',
      userEmail: 'test@x.com',
      type: 'earned_order',
      points: 50,
      pointsKobo: 5000,
      orderRef: 'NTR-100',
      reason: null,
      adminName: null,
      createdAt: expect.any(String),
    });
    expect(data.total).toBe(1);
    expect(data.totalPages).toBe(1);
  });
});

describe('POST /api/admin/rewards', () => {
  it('blocks unauthenticated requests', async () => {
    const errResp = Response.json({ error: 'Unauthorized' }, { status: 401 });
    mockRequireAdmin.mockResolvedValue({ admin: null, error: errResp });
    const res = await POST(makePostReq({ userId: 'u1', type: 'manual_credit', points: 100, reason: 'test' }));
    expect(res.status).toBe(401);
  });

  it('requires write permission on rewards', async () => {
    await POST(makePostReq({ userId: 'u1', type: 'manual_credit', points: 100, reason: 'test' }));
    expect(mockRequireAdmin).toHaveBeenCalledWith('rewards', true);
  });

  it('blocks non-owner/superadmin roles', async () => {
    mockRequireAdmin.mockResolvedValue({ admin: { id: 'adm1', name: 'Support', role: 'support' }, error: null });
    const res = await POST(makePostReq({ userId: 'u1', type: 'manual_credit', points: 100, reason: 'test' }));
    expect(res.status).toBe(403);
  });

  it('requires userId', async () => {
    mockRequireAdmin.mockResolvedValue({ admin: { id: 'adm1', name: 'Owner', role: 'owner' }, error: null });
    const res = await POST(makePostReq({ type: 'manual_credit', points: 100, reason: 'test' }));
    expect(res.status).toBe(400);
  });

  it('rejects invalid type', async () => {
    mockRequireAdmin.mockResolvedValue({ admin: { id: 'adm1', name: 'Owner', role: 'owner' }, error: null });
    const res = await POST(makePostReq({ userId: 'u1', type: 'earned_order', points: 100, reason: 'test' }));
    expect(res.status).toBe(400);
  });

  it('rejects zero or negative points', async () => {
    mockRequireAdmin.mockResolvedValue({ admin: { id: 'adm1', name: 'Owner', role: 'owner' }, error: null });
    const res = await POST(makePostReq({ userId: 'u1', type: 'manual_credit', points: 0, reason: 'test' }));
    expect(res.status).toBe(400);
  });

  it('rejects missing reason', async () => {
    mockRequireAdmin.mockResolvedValue({ admin: { id: 'adm1', name: 'Owner', role: 'owner' }, error: null });
    const res = await POST(makePostReq({ userId: 'u1', type: 'manual_credit', points: 100, reason: '' }));
    expect(res.status).toBe(400);
  });

  it('returns 404 for nonexistent user', async () => {
    mockRequireAdmin.mockResolvedValue({ admin: { id: 'adm1', name: 'Owner', role: 'owner' }, error: null });
    mockUserFindUnique.mockResolvedValue(null);
    const res = await POST(makePostReq({ userId: 'bad', type: 'manual_credit', points: 100, reason: 'test' }));
    expect(res.status).toBe(404);
  });

  it('caps debit at current balance', async () => {
    mockRequireAdmin.mockResolvedValue({ admin: { id: 'adm1', name: 'Owner', role: 'owner' }, error: null });
    mockGetBalanceTx.mockResolvedValue(5000); // 50 pts
    const res = await POST(makePostReq({ userId: 'u1', type: 'manual_debit', points: 100, reason: 'test' }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain('50');
  });

  it('creates ledger entry for credit', async () => {
    mockRequireAdmin.mockResolvedValue({ admin: { id: 'adm1', name: 'Owner', role: 'owner' }, error: null });
    mockCreate.mockResolvedValue({ id: 'new1', type: 'manual_credit', pointsKobo: 10000, reason: 'bonus' });
    mockGetBalanceTx.mockResolvedValue(510000);
    const res = await POST(makePostReq({ userId: 'u1', type: 'manual_credit', points: 100, reason: 'bonus' }));
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.entry.points).toBe(100);
    expect(mockCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'u1', type: 'manual_credit', pointsKobo: 10000, reason: 'bonus', createdByAdminId: 'adm1',
      }),
    });
  });

  it('creates ledger entry for debit with negative pointsKobo', async () => {
    mockRequireAdmin.mockResolvedValue({ admin: { id: 'adm1', name: 'Owner', role: 'owner' }, error: null });
    mockGetBalanceTx.mockResolvedValue(50000); // 500 pts
    mockCreate.mockResolvedValue({ id: 'new2', type: 'manual_debit', pointsKobo: -5000, reason: 'penalty' });
    const res = await POST(makePostReq({ userId: 'u1', type: 'manual_debit', points: 50, reason: 'penalty' }));
    expect(res.status).toBe(200);
    expect(mockCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'u1', type: 'manual_debit', pointsKobo: -5000, reason: 'penalty', createdByAdminId: 'adm1',
      }),
    });
  });

  it('logs activity', async () => {
    mockRequireAdmin.mockResolvedValue({ admin: { id: 'adm1', name: 'Owner', role: 'owner' }, error: null });
    await POST(makePostReq({ userId: 'u1', type: 'manual_credit', points: 100, reason: 'bonus' }));
    expect(mockLogActivity).toHaveBeenCalledWith('Owner', expect.stringContaining('Credited 100 pts'), 'reward');
  });

  it('uses Serializable isolation level', async () => {
    mockRequireAdmin.mockResolvedValue({ admin: { id: 'adm1', name: 'Owner', role: 'owner' }, error: null });
    await POST(makePostReq({ userId: 'u1', type: 'manual_credit', points: 100, reason: 'test' }));
    expect(mockPrisma.$transaction).toHaveBeenCalledWith(expect.any(Function), { isolationLevel: 'Serializable' });
  });

  it('retries on P2034 serialization conflict', async () => {
    mockRequireAdmin.mockResolvedValue({ admin: { id: 'adm1', name: 'Owner', role: 'owner' }, error: null });
    const p2034 = new Error('Serialization conflict'); p2034.code = 'P2034';
    mockPrisma.$transaction
      .mockRejectedValueOnce(p2034)
      .mockImplementationOnce(async (fn) => fn(mockTx));
    const res = await POST(makePostReq({ userId: 'u1', type: 'manual_credit', points: 100, reason: 'test' }));
    expect(res.status).toBe(200);
    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(2);
  });

  it('rejects points exceeding upper bound', async () => {
    mockRequireAdmin.mockResolvedValue({ admin: { id: 'adm1', name: 'Owner', role: 'owner' }, error: null });
    const res = await POST(makePostReq({ userId: 'u1', type: 'manual_credit', points: 20_000_000, reason: 'test' }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain('10,000,000');
  });
});

describe('GET /api/admin/rewards?view=summary', () => {
  it('returns liability and byType', async () => {
    mockGroupBy.mockResolvedValue([
      { type: 'earned_order', _sum: { pointsKobo: 100000 }, _count: 10 },
      { type: 'redeemed_order', _sum: { pointsKobo: -30000 }, _count: 3 },
      { type: 'manual_credit', _sum: { pointsKobo: 20000 }, _count: 1 },
    ]);
    mockLedgerAggregate.mockResolvedValue({ _sum: { pointsKobo: 70000 } });
    mockOrderAggregate.mockResolvedValue({
      _sum: { loyaltyDiscount: 12000, campaignDiscount: 8000, nitroPointsRedeemedKobo: 30000 },
      _count: 4,
    });

    const res = await GET(makeReq({ view: 'summary' }));
    const data = await res.json();

    expect(data.liability).toEqual({ kobo: 70000, points: 700 });
    expect(data.byType.earned_order).toEqual({ kobo: 100000, count: 10 });
    expect(data.byType.redeemed_order).toEqual({ kobo: -30000, count: 3 });
    expect(data.cost.checkoutReductions).toEqual({
      statusDiscountKobo: 12000,
      campaignDiscountKobo: 8000,
      pointsRedeemedKobo: 30000,
      totalKobo: 50000,
    });
    expect(data.cost.pointsMovement).toMatchObject({
      earnedKobo: 100000,
      redeemedKobo: 30000,
      manualCreditKobo: 20000,
      liabilityIncreaseKobo: 120000,
      liabilityDecreaseKobo: 30000,
      netLiabilityChangeKobo: 90000,
    });
    expect(data.cost.accrualRewardCost).toEqual({
      kobo: 140000,
      statusDiscountKobo: 12000,
      campaignDiscountKobo: 8000,
      pointsIssuedKobo: 120000,
    });
    expect(data.dateFiltered).toBe(false);
  });

  it('passes date filter to groupBy', async () => {
    await GET(makeReq({ view: 'summary', from: '2026-06-01', to: '2026-06-30' }));
    const call = mockGroupBy.mock.calls[0][0];
    expect(call.where.createdAt.gte).toEqual(new Date('2026-06-01'));
    expect(call.where.createdAt.lte).toBeDefined();
    const orderCall = mockOrderAggregate.mock.calls[0][0];
    expect(orderCall.where.createdAt.gte).toEqual(new Date('2026-06-01'));
    expect(orderCall.where.createdAt.lte).toBeDefined();
  });

  it('liability is always unfiltered', async () => {
    await GET(makeReq({ view: 'summary', from: '2026-06-01' }));
    const aggCall = mockLedgerAggregate.mock.calls[0][0];
    expect(aggCall).toEqual({ _sum: { pointsKobo: true } });
  });

  it('returns 400 for invalid date', async () => {
    const res = await GET(makeReq({ view: 'summary', from: 'nope' }));
    expect(res.status).toBe(400);
  });
});
