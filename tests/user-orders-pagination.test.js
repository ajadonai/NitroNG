import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockOrder = { findMany: vi.fn() };
const mockPrisma = { order: mockOrder };

vi.mock('@/lib/prisma', () => ({ default: mockPrisma }));
vi.mock('@/lib/logger', () => ({ log: { error: vi.fn() } }));
vi.mock('@/lib/auth', () => ({ getCurrentUser: vi.fn().mockResolvedValue({ id: 'user-1' }) }));
vi.mock('@/lib/smm', () => ({ placeOrder: vi.fn(), checkOrder: vi.fn() }));
vi.mock('@/lib/rate-limit', () => ({
  rateLimit: vi.fn(),
  rateLimitUnavailable: vi.fn(),
  tooManyRequests: vi.fn(),
}));
vi.mock('@/lib/promotions', () => ({ getActivePromotion: vi.fn(), applyPromotionDiscount: vi.fn() }));
vi.mock('@/lib/clean-link', () => ({ cleanLink: value => value }));
vi.mock('@/lib/drip-feed', () => ({ calculateIntradayDrip: vi.fn(), calculateMultiDayDrip: vi.fn(), getDripConfig: vi.fn() }));
vi.mock('@/lib/meta-capi', () => ({ sendEvent: vi.fn(), parseFbCookies: vi.fn(() => ({})) }));
vi.mock('next/headers', () => ({ headers: vi.fn() }));
vi.mock('@/lib/telegram', () => ({ tgNewOrder: vi.fn(), tgRefundAlert: vi.fn() }));
vi.mock('@/lib/commissions', () => ({ voidCommissions: vi.fn() }));
vi.mock('@/lib/bonus-credit', () => ({ deductBalance: vi.fn(), trackBonusConsumption: vi.fn(), restoreBonusForRefund: vi.fn() }));

const { GET } = await import('@/app/api/orders/route');

function request(params = {}) {
  const url = new URL('http://localhost/api/orders');
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  return new Request(url);
}

function singleRefs(count) {
  return Array.from({ length: count }, (_, index) => ({
    id: `order-${index + 1}`,
    batchId: null,
    createdAt: new Date(Date.now() - index * 1000),
  }));
}

beforeEach(() => {
  vi.clearAllMocks();
  mockOrder.findMany.mockResolvedValueOnce([]); // narrow matching-ref query
});

describe('GET /api/orders — logical pagination and search', () => {
  it('paginates logical display rows and returns total pages', async () => {
    mockOrder.findMany.mockReset();
    mockOrder.findMany
      .mockResolvedValueOnce(singleRefs(61))
      .mockResolvedValueOnce([]);

    const response = await GET(request({ page: '3', perPage: '25' }));
    const body = await response.json();

    expect(mockOrder.findMany).toHaveBeenCalledTimes(2);
    expect(mockOrder.findMany.mock.calls[0][0]).toMatchObject({
      select: { id: true, batchId: true, createdAt: true },
    });
    expect(mockOrder.findMany.mock.calls[0][0].skip).toBeUndefined();
    expect(mockOrder.findMany.mock.calls[1][0].where.OR[0].id.in).toHaveLength(11);
    expect(body).toMatchObject({ total: 61, matchingOrdersTotal: 61, page: 3, totalPages: 3 });
  });

  it('does not run a broad contains search for one character', async () => {
    await GET(request({ search: 'n' }));

    const { where } = mockOrder.findMany.mock.calls[0][0];
    expect(where.AND).toBeUndefined();
  });

  it('combines text search and attention filter with AND', async () => {
    await GET(request({ search: 'NTR-10', filter: 'attention' }));

    const { where } = mockOrder.findMany.mock.calls[0][0];
    expect(where.queuedBehind).toBeNull();
    expect(where.AND).toHaveLength(2);
    expect(where.AND.every(clause => Array.isArray(clause.OR))).toBe(true);
  });

  it('clamps page size to 100 logical rows', async () => {
    mockOrder.findMany.mockReset();
    mockOrder.findMany
      .mockResolvedValueOnce(singleRefs(120))
      .mockResolvedValueOnce([]);

    const response = await GET(request({ perPage: '1000' }));
    const body = await response.json();

    expect(mockOrder.findMany.mock.calls[1][0].where.OR[0].id.in).toHaveLength(100);
    expect(body.totalPages).toBe(2);
  });

  it('keeps every child of a batch together on one logical page', async () => {
    const batchRefs = Array.from({ length: 30 }, (_, index) => ({
      id: `batch-order-${index + 1}`,
      batchId: 'BULK-30',
      createdAt: new Date(Date.now() - index * 1000),
    }));
    const fullBatch = batchRefs.map((ref, index) => ({
      ...ref,
      orderId: `NTR-${index + 1}`,
      userId: 'user-1',
      serviceId: 'service-1',
      link: 'https://example.com/post',
      quantity: 100,
      charge: 1000,
      status: 'Pending',
      service: { name: 'Likes', category: 'instagram' },
      tier: null,
      dripDispatches: [],
    }));
    mockOrder.findMany.mockReset();
    mockOrder.findMany
      .mockResolvedValueOnce([...batchRefs, ...singleRefs(15)])
      .mockResolvedValueOnce(fullBatch);

    const response = await GET(request({ page: '1', perPage: '10' }));
    const body = await response.json();

    expect(body.total).toBe(16);
    expect(body.matchingOrdersTotal).toBe(45);
    expect(body.orders).toHaveLength(30);
    expect(new Set(body.orders.map(order => order.batchId))).toEqual(new Set(['BULK-30']));
    expect(mockOrder.findMany.mock.calls[1][0].where).toMatchObject({
      userId: 'user-1',
      deletedAt: null,
      OR: expect.arrayContaining([{ batchId: { in: ['BULK-30'] } }]),
    });
  });
});
