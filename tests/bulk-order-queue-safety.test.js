import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  orderFindFirst: vi.fn(),
  orderFindMany: vi.fn(),
  orderCreate: vi.fn(),
  orderUpdateMany: vi.fn(),
  dripFindFirst: vi.fn(),
  dripUpdateMany: vi.fn(),
  dripCreateMany: vi.fn(),
  adminIssueCreate: vi.fn(),
  transactionCreate: vi.fn(),
  userFindUnique: vi.fn(),
  serviceTierFindUnique: vi.fn(),
  settingFindUnique: vi.fn(),
  prismaTransaction: vi.fn(),
  placeOrder: vi.fn(),
  getCurrentUser: vi.fn(),
  rateLimit: vi.fn(),
  getActivePromotion: vi.fn(),
  getDripConfig: vi.fn(),
  calculateIntradayDrip: vi.fn(),
  deductBalance: vi.fn(),
  trackBonusConsumption: vi.fn(),
  awardOrderPoints: vi.fn(),
  sendEvent: vi.fn(),
  tgNewOrder: vi.fn(),
}));

const prisma = {
  order: {
    findFirst: (...args) => mocks.orderFindFirst(...args),
    findMany: (...args) => mocks.orderFindMany(...args),
    create: (...args) => mocks.orderCreate(...args),
    updateMany: (...args) => mocks.orderUpdateMany(...args),
  },
  dripDispatch: {
    findFirst: (...args) => mocks.dripFindFirst(...args),
    updateMany: (...args) => mocks.dripUpdateMany(...args),
    createMany: (...args) => mocks.dripCreateMany(...args),
  },
  adminIssue: { create: (...args) => mocks.adminIssueCreate(...args) },
  transaction: { create: (...args) => mocks.transactionCreate(...args) },
  user: { findUnique: (...args) => mocks.userFindUnique(...args) },
  serviceTier: { findUnique: (...args) => mocks.serviceTierFindUnique(...args) },
  setting: { findUnique: (...args) => mocks.settingFindUnique(...args) },
  idempotencyKey: {
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  $transaction: (...args) => mocks.prismaTransaction(...args),
};

vi.mock('@/lib/prisma', () => ({ default: prisma }));
vi.mock('@/lib/logger', () => ({ log: { error: vi.fn(), warn: vi.fn() } }));
vi.mock('@/lib/auth', () => ({ getCurrentUser: (...args) => mocks.getCurrentUser(...args) }));
vi.mock('@/lib/smm', () => ({
  placeOrder: (...args) => mocks.placeOrder(...args),
  checkOrder: vi.fn(),
}));
vi.mock('@/lib/rate-limit', () => ({
  rateLimit: (...args) => mocks.rateLimit(...args),
  rateLimitUnavailable: vi.fn(),
  tooManyRequests: vi.fn(),
}));
vi.mock('@/lib/promotions', () => ({
  getActivePromotion: (...args) => mocks.getActivePromotion(...args),
  applyPromotionDiscount: vi.fn(() => 0),
}));
vi.mock('@/lib/email', () => ({ sendEmail: vi.fn(), batchPlacementEmail: vi.fn(() => '<html>') }));
vi.mock('@/lib/settings', () => ({ getWhatsAppChannelUrl: vi.fn() }));
vi.mock('@/lib/clean-link', () => ({ cleanLink: link => link.trim() }));
vi.mock('@/lib/drip-feed', () => ({
  calculateIntradayDrip: (...args) => mocks.calculateIntradayDrip(...args),
  getDripConfig: (...args) => mocks.getDripConfig(...args),
}));
vi.mock('@/lib/meta-capi', () => ({
  sendEvent: (...args) => mocks.sendEvent(...args),
  parseFbCookies: vi.fn(() => ({ fbp: null, fbc: null })),
}));
vi.mock('next/headers', () => ({ headers: vi.fn(async () => new Headers()) }));
vi.mock('@/lib/telegram', () => ({
  tgNewOrder: (...args) => mocks.tgNewOrder(...args),
  tgRefundAlert: vi.fn(),
}));
vi.mock('@/lib/bonus-credit', () => ({
  deductBalance: (...args) => mocks.deductBalance(...args),
  trackBonusConsumption: (...args) => mocks.trackBonusConsumption(...args),
  restoreBonusForRefund: vi.fn(),
}));
vi.mock('@/lib/nitro-rewards', () => ({
  getNitroStatus: vi.fn(() => ({ key: 'spark', name: 'Spark', discountPct: 0 })),
  getEligibleSpendKoboTx: vi.fn(async () => 0),
  computeNitroDiscount: vi.fn(() => 0),
  awardOrderPoints: (...args) => mocks.awardOrderPoints(...args),
  reverseOrderPoints: vi.fn(),
  computeRefundSplit: vi.fn(() => ({ walletRefund: 0, pointsRestore: 0 })),
  getTotalRefundedKobo: vi.fn(async () => 0),
}));
vi.mock('@/lib/provider-query-lease', () => ({ isReservedProviderQueryLeaseKey: vi.fn(() => false) }));
vi.mock('@/lib/order-offer-display', () => ({
  buildOrderOfferSnapshot: vi.fn(() => ({
    serviceNameAtPurchase: 'YouTube Subscribers',
    tierNameAtPurchase: 'Standard',
    platformAtPurchase: 'youtube',
    serviceTypeAtPurchase: 'followers',
  })),
  getOrderOfferDisplay: vi.fn(() => ({ serviceName: 'YouTube Subscribers', tierLabel: 'Standard', offerDisabled: false })),
}));

const { PATCH, POST } = await import('@/app/api/orders/bulk/route');
const originalNodeEnv = process.env.NODE_ENV;

function configureSingleOrder({ drip = false } = {}) {
  const tier = {
    id: 'tier-standard',
    tier: 'Standard',
    sellPer1k: 500_000,
    enabled: true,
    group: { enabled: true, type: 'followers', platform: 'youtube', tags: drip ? ['drip'] : [] },
    service: {
      id: 'service-8871',
      provider: 'mtp',
      apiId: 8871,
      apiType: 'Default',
      category: 'youtube',
      enabled: true,
      min: 100,
      max: 100_000,
      costPer1k: 1,
    },
  };
  mocks.serviceTierFindUnique.mockResolvedValue(tier);
  mocks.getDripConfig.mockReturnValue(drip ? { threshold: 100, intervalHours: 2 } : null);
  mocks.calculateIntradayDrip.mockReturnValue(drip ? {
    dispatches: [
      { batch: 1, quantity: 204, scheduledAt: new Date('2026-07-17T17:05:07.000Z') },
      { batch: 2, quantity: 205, scheduledAt: new Date('2026-07-17T19:05:07.000Z') },
    ],
  } : null);
  mocks.orderCreate.mockImplementation(async ({ data }) => ({
    id: 'order-new',
    createdAt: new Date('2026-07-17T17:05:07.000Z'),
    apiOrderId: null,
    ...data,
  }));
}

function postSingle() {
  return POST(new Request('http://localhost/api/orders/bulk', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      orders: [{
        tierId: 'tier-standard',
        link: 'https://youtube.com/@thewargenerals',
        quantity: 409,
      }],
    }),
  }));
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.NODE_ENV = 'test';

  mocks.orderFindFirst.mockResolvedValue(null);
  mocks.orderFindMany.mockResolvedValue([{ orderId: 'NTR-3079' }]);
  mocks.orderUpdateMany.mockResolvedValue({ count: 1 });
  mocks.dripFindFirst.mockResolvedValue({ id: 'drip-1', batch: 1, quantity: 204 });
  mocks.dripUpdateMany.mockResolvedValue({ count: 1 });
  mocks.dripCreateMany.mockResolvedValue({ count: 2 });
  mocks.adminIssueCreate.mockResolvedValue({ id: 'issue-1' });
  mocks.transactionCreate.mockResolvedValue({ id: 'tx-1' });
  mocks.userFindUnique.mockResolvedValue({ balance: 1_000_000 });
  mocks.settingFindUnique.mockResolvedValue({ value: '1600' });
  mocks.placeOrder.mockResolvedValue({ order: 4_200_000 });
  mocks.getCurrentUser.mockResolvedValue({ id: 'user-1', email: 'user@example.test' });
  mocks.rateLimit.mockResolvedValue({ unavailable: false, limited: false });
  mocks.getActivePromotion.mockResolvedValue(null);
  mocks.getDripConfig.mockReturnValue(null);
  mocks.calculateIntradayDrip.mockReturnValue(null);
  mocks.deductBalance.mockResolvedValue(undefined);
  mocks.trackBonusConsumption.mockResolvedValue(0);
  mocks.awardOrderPoints.mockResolvedValue(0);
  mocks.prismaTransaction.mockImplementation(async callback => callback(prisma));
  configureSingleOrder();
});

afterAll(() => {
  if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = originalNodeEnv;
});

describe('bulk order same-link dispatch fences', () => {
  it('stores an earlier same-link blocker and does not contact the provider', async () => {
    mocks.orderFindFirst.mockResolvedValue({ orderId: 'NTR-2890' });

    const response = await postSingle();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mocks.placeOrder).not.toHaveBeenCalled();
    expect(mocks.orderCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        orderId: 'NTR-3080',
        status: 'Pending',
        queuedBehind: 'NTR-2890',
      }),
    });
    expect(mocks.orderUpdateMany).toHaveBeenCalledWith({
      where: { id: 'order-new', status: 'Pending', apiOrderId: null, deletedAt: null },
      data: { queuedBehind: 'NTR-2890' },
    });
    expect(body).toMatchObject({
      placed: 0,
      queued: 1,
      orders: [{ id: 'NTR-3080', status: 'Pending', queued: true, queuedBehind: 'NTR-2890' }],
    });
  });

  it('classifies a provider active-order response as queued instead of failed', async () => {
    mocks.orderFindFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ orderId: 'NTR-2890' });
    mocks.placeOrder.mockRejectedValueOnce(new Error('You have active order with this link. Please wait until order being completed.'));

    const response = await postSingle();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({ placed: 0, queued: 1 });
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

  it('does not resurrect a direct order that became terminal during provider I/O', async () => {
    mocks.orderUpdateMany
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 0 });

    const response = await postSingle();

    expect(response.status).toBe(200);
    expect(mocks.adminIssueCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        type: 'ghost_dispatch',
        title: expect.stringContaining('provider accepted after local cancellation'),
      }),
    });
  });

  it('returns a rejected drip batch to the retry queue on an active-order response', async () => {
    configureSingleOrder({ drip: true });
    mocks.orderFindFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ orderId: 'NTR-2890' });
    mocks.placeOrder.mockRejectedValueOnce(new Error('You have active order with this link.'));

    const response = await postSingle();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({ placed: 0, queued: 1 });
    expect(mocks.dripUpdateMany).toHaveBeenLastCalledWith({
      where: {
        id: 'drip-1',
        status: 'dispatching',
        order: { status: 'Pending', deletedAt: null },
      },
      data: {
        status: 'pending',
        lastError: null,
        dispatchedAt: null,
        scheduledAt: expect.any(Date),
      },
    });
    expect(mocks.orderUpdateMany).toHaveBeenLastCalledWith({
      where: { id: 'order-new', status: 'Pending', apiOrderId: null, deletedAt: null },
      data: {
        queuedBehind: 'NTR-2890',
        lastError: 'provider_active_wait',
        dispatchedAt: null,
      },
    });
  });

  it('fences a drip provider result if the parent became terminal in flight', async () => {
    configureSingleOrder({ drip: true });
    mocks.dripUpdateMany
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 0 });

    const response = await postSingle();

    expect(response.status).toBe(200);
    expect(mocks.orderUpdateMany).not.toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: 'Processing' }),
    }));
    expect(mocks.adminIssueCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ type: 'ghost_dispatch' }),
    });
  });
});

describe('bulk retry and completed-batch reorder queue safety', () => {
  function batchOrder(overrides = {}) {
    return {
      id: 'source-db',
      orderId: 'NTR-2900',
      userId: 'user-1',
      serviceId: 'service-8871',
      tierId: 'tier-standard',
      batchId: 'BULK-7',
      status: 'Pending',
      apiOrderId: null,
      queuedBehind: null,
      createdAt: new Date('2026-07-17T16:00:00.000Z'),
      link: 'https://youtube.com/@thewargenerals',
      quantity: 409,
      charge: 200_000,
      comments: null,
      service: {
        id: 'service-8871', provider: 'mtp', apiId: 8871, apiType: 'Default',
        category: 'youtube', costPer1k: 1, enabled: true,
      },
      tier: {
        id: 'tier-standard', tier: 'Standard', sellPer1k: 500_000,
        group: { type: 'followers', platform: 'youtube', tags: [] },
      },
      dripDispatches: [],
      ...overrides,
    };
  }

  function patchBatch(action) {
    return PATCH(new Request('http://localhost/api/orders/bulk', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, batchId: 'BULK-7' }),
    }));
  }

  it('keeps a manual bulk retry queued behind the earlier same-link order', async () => {
    mocks.orderFindMany.mockResolvedValue([batchOrder()]);
    mocks.orderFindFirst.mockResolvedValue({ orderId: 'NTR-2890' });

    const response = await patchBatch('reorder');
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ success: true, retried: 1, placed: 0, queued: 1, failed: 0 });
    expect(mocks.placeOrder).not.toHaveBeenCalled();
    expect(mocks.orderUpdateMany).toHaveBeenCalledWith({
      where: { id: 'source-db', status: 'Pending', apiOrderId: null, deletedAt: null },
      data: { queuedBehind: 'NTR-2890' },
    });
  });

  it('stores blockers when recreating a completed batch before async dispatch starts', async () => {
    const completed = batchOrder({ status: 'Completed', apiOrderId: '4195000' });
    mocks.orderFindMany
      .mockResolvedValueOnce([completed])
      .mockResolvedValueOnce([{ batchId: 'BULK-7' }])
      .mockResolvedValueOnce([{ orderId: 'NTR-3079' }]);
    mocks.orderFindFirst.mockResolvedValue({ orderId: 'NTR-2890' });
    mocks.orderCreate.mockImplementation(async ({ data }) => ({
      id: 'order-new',
      createdAt: new Date('2026-07-17T17:05:07.000Z'),
      ...data,
    }));

    const response = await patchBatch('reorder_completed');
    await Promise.resolve();

    expect(response.status).toBe(200);
    expect(mocks.orderCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        orderId: 'NTR-3080',
        batchId: 'BULK-8',
        status: 'Pending',
        queuedBehind: 'NTR-2890',
      }),
    });
    expect(mocks.placeOrder).not.toHaveBeenCalled();
  });
});
