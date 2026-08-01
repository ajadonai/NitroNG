import { readFileSync } from 'node:fs';
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
  $transaction: vi.fn(queries => Promise.all(queries)),
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
    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
    expect(mockPrisma.$transaction.mock.calls[0][0]).toHaveLength(4);
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
    expect(body.total).toBe(10);
  });

  it.each([
    ['queued', 7],
    ['needs_dispatch', 3],
  ])('derives the %s total from the existing filter counts', async (filter, expected) => {
    mockOrder.findMany.mockResolvedValue([]);
    mockOrder.groupBy.mockResolvedValue([
      { status: 'Pending', _count: 40 },
    ]);
    mockOrder.count
      .mockResolvedValueOnce(7)
      .mockResolvedValueOnce(3);

    const res = await GET(makeReq({ filter }));
    const body = await res.json();

    expect(body.total).toBe(expected);
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

  it('returns a retryable 503 when Prisma cannot acquire a pool connection', async () => {
    mockOrder.findMany.mockResolvedValue([]);
    mockOrder.groupBy.mockResolvedValue([]);
    mockOrder.count.mockResolvedValue(0);
    mockPrisma.$transaction.mockRejectedValueOnce(
      Object.assign(new Error('Timed out fetching a new connection from the connection pool'), {
        code: 'P2024',
      }),
    );

    const res = await GET(makeReq());
    const body = await res.json();

    expect(res.status).toBe(503);
    expect(res.headers.get('retry-after')).toBe('3');
    expect(body.error).toContain('temporarily busy');
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
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });
});

describe('admin orders pool-pressure controls', () => {
  it('does not poll from hidden tabs or overlap a request already in flight', () => {
    const source = readFileSync('components/admin-orders.jsx', 'utf8');

    expect(source).toContain('document.visibilityState !== "visible" || abortRef.current');
    expect(source).toContain('{ background: true }');
    expect(source).toContain('if (abortRef.current === controller) abortRef.current = null');
    expect(source).toContain('if (!r.ok) throw new Error');
  });

  it('does not run the expensive overview poll from the orders page or hidden tabs', () => {
    const source = readFileSync('components/admin-dashboard.jsx', 'utf8');

    expect(source).toContain("if (initialData) applyThemePreference(initialData)");
    expect(source).toContain("else load()");
    expect(source).toContain("document.visibilityState !== 'visible' || inFlight");
    expect(source).toContain("if (active === 'overview')");
    expect(source).toContain('}, [redirecting, active]);');
  });
});
