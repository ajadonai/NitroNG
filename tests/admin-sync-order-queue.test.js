import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  logActivity: vi.fn(),
  orderFindMany: vi.fn(),
  orderFindFirst: vi.fn(),
  orderFindUnique: vi.fn(),
  orderUpdateMany: vi.fn(),
  dripFindMany: vi.fn(),
  placeWithProvider: vi.fn(),
  checkOrder: vi.fn(),
  reverseOrderPoints: vi.fn(),
  getTotalRefundedKobo: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  default: {
    order: {
      findMany: (...args) => mocks.orderFindMany(...args),
      findFirst: (...args) => mocks.orderFindFirst(...args),
      findUnique: (...args) => mocks.orderFindUnique(...args),
      updateMany: (...args) => mocks.orderUpdateMany(...args),
    },
    dripDispatch: {
      findMany: (...args) => mocks.dripFindMany(...args),
    },
    $transaction: vi.fn(),
  },
}));
vi.mock('@/lib/logger', () => ({ log: { error: vi.fn(), warn: vi.fn() } }));
vi.mock('@/lib/admin', () => ({
  requireAdmin: (...args) => mocks.requireAdmin(...args),
  logActivity: (...args) => mocks.logActivity(...args),
}));
vi.mock('@/lib/smm', () => ({
  getServices: vi.fn(),
  getBalance: vi.fn(),
  isProviderConfigured: () => true,
  getProviderName: value => value,
  checkOrder: (...args) => mocks.checkOrder(...args),
}));
vi.mock('@/lib/bulk-dispatch', () => ({
  placeWithProvider: (...args) => mocks.placeWithProvider(...args),
}));
vi.mock('@/lib/markup', () => ({ calculateTierPrice: vi.fn() }));
vi.mock('@/lib/service-catalog', () => ({ invalidateServiceCatalogue: vi.fn() }));
vi.mock('@/lib/nitro-rewards', () => ({
  reverseOrderPoints: (...args) => mocks.reverseOrderPoints(...args),
  computeRefundSplit: amount => ({ walletRefund: amount, pointsRestore: 0 }),
  getTotalRefundedKobo: (...args) => mocks.getTotalRefundedKobo(...args),
}));

const { POST } = await import('@/app/api/admin/sync/route');

function request() {
  return new Request('https://nitro.test/api/admin/sync', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ action: 'sync-orders' }),
  });
}

function directOrder(overrides = {}) {
  return {
    id: 'order-new',
    orderId: 'NTR-3080',
    userId: 'user-1',
    serviceId: 'service-8871',
    link: 'https://youtube.com/@thewargenerals',
    quantity: 409,
    comments: null,
    charge: 1_945_900,
    status: 'Pending',
    apiOrderId: null,
    queuedBehind: null,
    retryCount: 0,
    lastError: null,
    dripDays: null,
    createdAt: new Date('2026-07-17T17:05:07Z'),
    service: { id: 'service-8871', provider: 'mtp', apiId: 8871, apiType: 'Default' },
    tier: { group: { type: 'followers' } },
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  for (const mock of Object.values(mocks)) mock.mockReset();
  mocks.requireAdmin.mockResolvedValue({ admin: { name: 'Soludo' }, error: null });
  mocks.logActivity.mockResolvedValue(undefined);
  mocks.orderFindMany.mockResolvedValue([]);
  mocks.orderFindFirst.mockResolvedValue(null);
  mocks.orderFindUnique.mockResolvedValue(null);
  mocks.orderUpdateMany.mockResolvedValue({ count: 1 });
  mocks.getTotalRefundedKobo.mockResolvedValue(0);
});

describe('admin sync-orders — direct-order ownership', () => {
  it('excludes every order with drip metadata or drip dispatch rows', async () => {
    const response = await POST(request());

    expect(response.status).toBe(200);
    expect(mocks.orderFindMany).toHaveBeenCalledTimes(2);
    expect(mocks.orderFindMany.mock.calls[0][0].where).toMatchObject({
      apiOrderId: { not: null },
      dripDays: null,
      dripDispatches: { none: {} },
    });
    expect(mocks.orderFindMany.mock.calls[1][0].where).toMatchObject({
      status: 'Pending',
      apiOrderId: null,
      dripDays: null,
      dripDispatches: { none: {} },
      OR: expect.arrayContaining([
        { queuedBehind: { not: null } },
        { lastError: 'provider_active_wait' },
      ]),
    });
    expect(mocks.dripFindMany).not.toHaveBeenCalled();
  });

  it('keeps an order behind the earlier same-link blocker without provider I/O', async () => {
    const order = directOrder({ queuedBehind: 'NTR-2890' });
    mocks.orderFindMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([order]);
    mocks.orderFindFirst.mockResolvedValueOnce({ orderId: 'NTR-2890' });

    const response = await POST(request());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.queued).toBe(1);
    expect(mocks.placeWithProvider).not.toHaveBeenCalled();
    expect(mocks.orderUpdateMany).toHaveBeenCalledWith({
      where: {
        id: 'order-new',
        status: 'Pending',
        apiOrderId: null,
        deletedAt: null,
        dripDays: null,
        dripDispatches: { none: {} },
        queuedBehind: 'NTR-2890',
      },
      data: { queuedBehind: 'NTR-2890', lastError: 'provider_active_wait' },
    });
  });

  it('does not call the provider when the atomic dispatch claim loses a race', async () => {
    const order = directOrder({ queuedBehind: 'NTR-2890' });
    mocks.orderFindMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([order]);
    mocks.orderFindFirst.mockResolvedValueOnce(null);
    mocks.orderUpdateMany.mockResolvedValueOnce({ count: 0 });

    await POST(request());

    expect(mocks.orderUpdateMany).toHaveBeenCalledWith({
      where: {
        id: 'order-new',
        status: 'Pending',
        apiOrderId: null,
        deletedAt: null,
        dripDays: null,
        dripDispatches: { none: {} },
        queuedBehind: 'NTR-2890',
      },
      data: { status: 'Dispatching', dispatchedAt: expect.any(Date), queuedBehind: null },
    });
    expect(mocks.placeWithProvider).not.toHaveBeenCalled();
  });

  it('converts a provider active-order rejection back into queued state', async () => {
    const order = directOrder();
    mocks.orderFindMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([order]);
    mocks.orderFindFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ orderId: 'NTR-2890' });
    mocks.orderUpdateMany
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 1 });
    mocks.placeWithProvider.mockRejectedValueOnce(new Error(
      'You have active order with this link. Please wait until order being completed.',
    ));

    const response = await POST(request());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({ queued: 1, errors: 0, dispatched: 0 });
    expect(mocks.orderUpdateMany).toHaveBeenLastCalledWith({
      where: { id: 'order-new', status: 'Dispatching', apiOrderId: null, deletedAt: null },
      data: {
        status: 'Pending',
        dispatchedAt: null,
        queuedBehind: 'NTR-2890',
        lastError: 'provider_active_wait',
        retryCount: 0,
      },
    });
  });

  it('does not report or rewrite a provider dispatch accepted after local cancellation', async () => {
    const order = directOrder();
    mocks.orderFindMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([order]);
    mocks.orderFindFirst.mockResolvedValueOnce(null);
    mocks.orderUpdateMany.mockResolvedValueOnce({ count: 1 });
    mocks.placeWithProvider.mockResolvedValueOnce('4199999');
    mocks.orderFindUnique.mockResolvedValueOnce({
      status: 'Cancelled', apiOrderId: null, deletedAt: null,
    });

    const response = await POST(request());
    const body = await response.json();

    expect(body).toMatchObject({ dispatched: 0, errors: 1 });
    expect(mocks.orderUpdateMany).toHaveBeenCalledTimes(1);
    expect(mocks.orderUpdateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: 'Dispatching' }),
    }));
  });

  it('does not revive an order whose status changed while provider status was checked', async () => {
    const active = directOrder({
      status: 'Processing',
      apiOrderId: '4195217',
      remains: 159,
      startCount: 391,
      protected: false,
    });
    mocks.orderFindMany
      .mockResolvedValueOnce([active])
      .mockResolvedValueOnce([]);
    mocks.checkOrder.mockResolvedValueOnce({ status: 'Completed', remains: 0, start_count: 391 });
    mocks.orderUpdateMany.mockResolvedValueOnce({ count: 0 });

    const response = await POST(request());
    const body = await response.json();

    expect(body).toMatchObject({ checked: 1, updated: 0, refunded: 0 });
    expect(mocks.orderUpdateMany).toHaveBeenCalledWith({
      where: {
        id: 'order-new',
        status: 'Processing',
        apiOrderId: '4195217',
        deletedAt: null,
      },
      data: { status: 'Completed', remains: 0 },
    });
    expect(mocks.getTotalRefundedKobo).not.toHaveBeenCalled();
    expect(mocks.placeWithProvider).not.toHaveBeenCalled();
  });
});
