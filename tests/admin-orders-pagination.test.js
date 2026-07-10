import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockOrder = {
  findMany: vi.fn(),
  count: vi.fn(),
  groupBy: vi.fn(),
  findFirst: vi.fn(),
};
const mockDripDispatch = { findFirst: vi.fn() };
const mockTransaction = { groupBy: vi.fn() };
const mockSetting = { findUnique: vi.fn() };

const mockPrisma = {
  order: mockOrder,
  dripDispatch: mockDripDispatch,
  transaction: mockTransaction,
  setting: mockSetting,
};

vi.mock('@/lib/prisma', () => ({ default: mockPrisma }));
vi.mock('@/lib/logger', () => ({ log: { error: vi.fn() } }));
vi.mock('@/lib/email', () => ({ sendEmail: vi.fn(), walletCreditEmail: vi.fn() }));
vi.mock('@/lib/smm', () => ({ checkOrder: vi.fn(), cancelOrder: vi.fn(), refillOrder: vi.fn(), isProviderConfigured: () => false, getProviderName: () => 'mtp' }));
vi.mock('@/lib/commissions', () => ({ voidCommissions: vi.fn() }));
vi.mock('@/lib/clean-link', () => ({ cleanLink: (l) => l }));
vi.mock('@/lib/telegram', () => ({ tgRefundAlert: vi.fn() }));

const mockRequireAdmin = vi.fn();
vi.mock('@/lib/admin', () => ({
  requireAdmin: (...a) => mockRequireAdmin(...a),
  logActivity: vi.fn(),
  canSeeSensitive: () => true,
  maskEmail: (e) => e,
  maskPhone: (p) => p,
}));

const { GET } = await import('@/app/api/admin/orders/route');

function makeReq(params = {}) {
  const url = new URL('http://localhost/api/admin/orders');
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return new Request(url, { method: 'GET' });
}

function fakeOrder(overrides = {}) {
  return {
    id: overrides.id || 'cuid1',
    orderId: overrides.orderId || 'NTR-100',
    userId: 'user1',
    status: 'Pending',
    charge: 50000,
    cost: 20000,
    quantity: 1000,
    remains: null,
    startCount: null,
    link: 'https://example.com',
    apiOrderId: null,
    batchId: null,
    lastError: null,
    queuedBehind: null,
    retryCount: 0,
    dripDays: null,
    parentOrderId: null,
    redispatchedAt: null,
    refundedAt: null,
    deletedAt: null,
    serviceId: 's1',
    createdAt: new Date(),
    user: { name: 'Test User', email: 'test@t.com', phone: null },
    service: { name: 'IG Followers', category: 'instagram', provider: 'mtp', apiId: '100', costPer1k: 200 },
    tier: null,
    dripDispatches: [],
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireAdmin.mockResolvedValue({ admin: { name: 'Admin', permissions: ['orders'] }, error: null });
  mockDripDispatch.findFirst.mockResolvedValue(null);
  mockTransaction.groupBy.mockResolvedValue([]);
  mockSetting.findUnique.mockResolvedValue({ value: '1600' });
});

describe('GET /api/admin/orders — pagination', () => {
  it('returns total count alongside paginated orders', async () => {
    const page1 = [fakeOrder({ orderId: 'NTR-1' }), fakeOrder({ orderId: 'NTR-2' })];
    mockOrder.findMany.mockResolvedValue(page1);
    mockOrder.count.mockResolvedValue(50);
    mockOrder.groupBy.mockResolvedValue([{ status: 'Pending', _count: 50 }]);

    const res = await GET(makeReq({ page: '1', perPage: '10' }));
    const body = await res.json();

    expect(body.total).toBe(50);
    expect(body.orders).toHaveLength(2);
  });

  it('passes take and skip to findMany', async () => {
    mockOrder.findMany.mockResolvedValue([]);
    mockOrder.count.mockResolvedValue(0);
    mockOrder.groupBy.mockResolvedValue([]);

    await GET(makeReq({ page: '3', perPage: '25' }));

    const call = mockOrder.findMany.mock.calls[0][0];
    expect(call.take).toBe(25);
    expect(call.skip).toBe(50);
  });

  it('clamps perPage to 10–100 range', async () => {
    mockOrder.findMany.mockResolvedValue([]);
    mockOrder.count.mockResolvedValue(0);
    mockOrder.groupBy.mockResolvedValue([]);

    await GET(makeReq({ perPage: '5' }));
    expect(mockOrder.findMany.mock.calls[0][0].take).toBe(10);

    vi.clearAllMocks();
    mockRequireAdmin.mockResolvedValue({ admin: { name: 'Admin', permissions: ['orders'] }, error: null });
    mockDripDispatch.findFirst.mockResolvedValue(null);
    mockTransaction.groupBy.mockResolvedValue([]);
    mockSetting.findUnique.mockResolvedValue({ value: '1600' });

    await GET(makeReq({ perPage: '500' }));
    expect(mockOrder.findMany.mock.calls[0][0].take).toBe(100);
  });

  it('clamps page to minimum 1', async () => {
    mockOrder.findMany.mockResolvedValue([]);
    mockOrder.count.mockResolvedValue(0);
    mockOrder.groupBy.mockResolvedValue([]);

    await GET(makeReq({ page: '-5' }));
    expect(mockOrder.findMany.mock.calls[0][0].skip).toBe(0);
  });

  it('returns filter counts unaffected by current filter', async () => {
    mockOrder.findMany.mockResolvedValue([fakeOrder({ status: 'Pending' })]);
    mockOrder.count.mockResolvedValue(1);
    mockOrder.groupBy.mockResolvedValue([
      { status: 'Pending', _count: 10 },
      { status: 'Completed', _count: 30 },
    ]);

    const res = await GET(makeReq({ filter: 'Pending' }));
    const body = await res.json();

    expect(body.counts.Pending).toBe(10);
    expect(body.counts.Completed).toBe(30);
    expect(body.counts.all).toBe(40);
  });

  it('applies search to both paginated query and count query', async () => {
    mockOrder.findMany.mockResolvedValue([]);
    mockOrder.count.mockResolvedValue(0);
    mockOrder.groupBy.mockResolvedValue([]);

    await GET(makeReq({ search: 'NTR-42' }));

    const findCall = mockOrder.findMany.mock.calls[0][0];
    expect(findCall.where.AND).toBeDefined();
    expect(findCall.where.AND.some(c => c.OR)).toBe(true);

    const countCall = mockOrder.count.mock.calls[0][0];
    expect(countCall.where.AND || countCall.where.OR).toBeDefined();
  });

  it('combines search and filter without conflict', async () => {
    mockOrder.findMany.mockResolvedValue([]);
    mockOrder.count.mockResolvedValue(0);
    mockOrder.groupBy.mockResolvedValue([]);

    await GET(makeReq({ search: 'test', filter: 'Pending' }));

    const findCall = mockOrder.findMany.mock.calls[0][0];
    expect(findCall.where.AND).toHaveLength(2);
    const hasSearch = findCall.where.AND.some(c => c.OR);
    const hasFilter = findCall.where.AND.some(c => c.status);
    expect(hasSearch).toBe(true);
    expect(hasFilter).toBe(true);
  });

  it('defaults to page 1 and perPage 50 when not specified', async () => {
    mockOrder.findMany.mockResolvedValue([]);
    mockOrder.count.mockResolvedValue(0);
    mockOrder.groupBy.mockResolvedValue([]);

    await GET(makeReq());

    const call = mockOrder.findMany.mock.calls[0][0];
    expect(call.take).toBe(50);
    expect(call.skip).toBe(0);
  });
});

describe('GET /api/admin/orders — batchId', () => {
  it('returns all orders for a batch without pagination', async () => {
    const batch = Array.from({ length: 15 }, (_, i) => fakeOrder({ id: `b${i}`, orderId: `NTR-${i}`, batchId: 'BATCH-1' }));
    mockOrder.findMany.mockResolvedValue(batch);

    const res = await GET(makeReq({ batchId: 'BATCH-1' }));
    const body = await res.json();

    expect(body.orders).toHaveLength(15);
    expect(body.total).toBe(15);
    const findCall = mockOrder.findMany.mock.calls[0][0];
    expect(findCall.where.batchId).toBe('BATCH-1');
    expect(findCall.take).toBeUndefined();
    expect(findCall.skip).toBeUndefined();
  });

  it('skips count and groupBy queries for batchId requests', async () => {
    mockOrder.findMany.mockResolvedValue([]);

    await GET(makeReq({ batchId: 'BATCH-X' }));

    expect(mockOrder.count).not.toHaveBeenCalled();
    expect(mockOrder.groupBy).not.toHaveBeenCalled();
  });
});
