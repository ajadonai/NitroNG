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
  queryRaw: vi.fn(),
  executeRaw: vi.fn(),
  placeOrder: vi.fn(),
  checkOrder: vi.fn(),
  getCurrentUser: vi.fn(),
  lockOrderSettlementAccount: vi.fn(),
  rateLimit: vi.fn(),
  getActivePromotion: vi.fn(),
  getDripConfig: vi.fn(),
  calculateIntradayDrip: vi.fn(),
  deductBalance: vi.fn(),
  trackBonusConsumption: vi.fn(),
  awardOrderPoints: vi.fn(),
  reverseOrderPoints: vi.fn(),
  computeRefundSplit: vi.fn(),
  getTotalRefundedKobo: vi.fn(),
  enqueueMetaEvent: vi.fn(),
  scheduleQueuedMetaEventDelivery: vi.fn(),
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
  $queryRaw: (...args) => mocks.queryRaw(...args),
  $executeRaw: (...args) => mocks.executeRaw(...args),
};

vi.mock('@/lib/prisma', () => ({ default: prisma }));
vi.mock('@/lib/logger', () => ({ log: { error: vi.fn(), warn: vi.fn() } }));
vi.mock('@/lib/auth', () => ({ getCurrentUser: (...args) => mocks.getCurrentUser(...args) }));
vi.mock('@/lib/smm', () => ({
  placeOrder: (...args) => mocks.placeOrder(...args),
  checkOrder: (...args) => mocks.checkOrder(...args),
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
  validateIntradayDuration: () => null,
}));
vi.mock('@/lib/meta-capi', () => ({
  enqueueMetaEvent: (...args) => mocks.enqueueMetaEvent(...args),
  parseFbCookies: vi.fn(() => ({ fbp: null, fbc: null })),
  scheduleQueuedMetaEventDelivery: (...args) => mocks.scheduleQueuedMetaEventDelivery(...args),
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
  reverseOrderPoints: (...args) => mocks.reverseOrderPoints(...args),
  computeRefundSplit: (...args) => mocks.computeRefundSplit(...args),
  getTotalRefundedKobo: (...args) => mocks.getTotalRefundedKobo(...args),
}));
vi.mock('@/lib/account-deletion', () => ({
  lockOrderSettlementAccount: (...args) => mocks.lockOrderSettlementAccount(...args),
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
  mocks.checkOrder.mockResolvedValue({ status: 'Processing', remains: 409 });
  mocks.getCurrentUser.mockResolvedValue({ id: 'user-1', email: 'user@example.test' });
  mocks.lockOrderSettlementAccount.mockResolvedValue({ id: 'user-1', status: 'Active' });
  mocks.rateLimit.mockResolvedValue({ unavailable: false, limited: false });
  mocks.getActivePromotion.mockResolvedValue(null);
  mocks.getDripConfig.mockReturnValue(null);
  mocks.calculateIntradayDrip.mockReturnValue(null);
  mocks.deductBalance.mockResolvedValue(undefined);
  mocks.trackBonusConsumption.mockResolvedValue(0);
  mocks.awardOrderPoints.mockResolvedValue(0);
  mocks.reverseOrderPoints.mockResolvedValue(0);
  mocks.computeRefundSplit.mockReturnValue({ walletRefund: 0, pointsRestore: 0 });
  mocks.getTotalRefundedKobo.mockResolvedValue(0);
  mocks.executeRaw.mockResolvedValue(1);
  mocks.prismaTransaction.mockImplementation(async callback => callback(prisma));
  mocks.queryRaw.mockResolvedValue([{ id: 'order-new', status: 'Pending', deletedAt: null, queuedBehind: null, apiOrderId: null }]);
  configureSingleOrder();
});

afterAll(() => {
  if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = originalNodeEnv;
});

describe('bulk order same-link dispatch fences', () => {
  it('enqueues exactly one batch Purchase for a multi-item cart', async () => {
    mocks.orderFindMany
      .mockResolvedValueOnce([{ batchId: 'BULK-7' }])
      .mockResolvedValueOnce([{ orderId: 'NTR-3079' }]);
    let createIndex = 0;
    mocks.orderCreate.mockImplementation(async ({ data }) => ({
      id: `order-new-${++createIndex}`,
      createdAt: new Date('2026-07-17T17:05:07.000Z'),
      apiOrderId: null,
      ...data,
    }));

    const response = await POST(new Request('http://localhost/api/orders/bulk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        orders: [
          { tierId: 'tier-standard', link: 'https://youtube.com/watch?v=first', quantity: 409 },
          { tierId: 'tier-standard', link: 'https://youtube.com/watch?v=second', quantity: 409 },
        ],
      }),
    }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      success: true,
      eventId: 'purchase_BULK-8',
      batchId: 'BULK-8',
      total: 2,
    });
    expect(mocks.orderCreate).toHaveBeenCalledTimes(2);
    expect(mocks.enqueueMetaEvent).toHaveBeenCalledTimes(1);
    expect(mocks.enqueueMetaEvent).toHaveBeenCalledWith(
      prisma,
      'Purchase',
      expect.objectContaining({ eventId: 'purchase_BULK-8' }),
    );
    expect(mocks.scheduleQueuedMetaEventDelivery).toHaveBeenCalledTimes(1);
    expect(mocks.scheduleQueuedMetaEventDelivery).toHaveBeenCalledWith('purchase_BULK-8');
  });

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
      eventId: 'purchase_NTR-3080',
      placed: 0,
      queued: 1,
      orders: [{ id: 'NTR-3080', status: 'Pending', queued: true, queuedBehind: 'NTR-2890' }],
    });
    expect(mocks.enqueueMetaEvent).toHaveBeenCalledWith(
      prisma,
      'Purchase',
      expect.objectContaining({ eventId: 'purchase_NTR-3080' }),
    );
    expect(mocks.scheduleQueuedMetaEventDelivery).toHaveBeenCalledWith('purchase_NTR-3080');
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
    expect(mocks.enqueueMetaEvent).toHaveBeenCalledWith(
      prisma,
      'Purchase',
      expect.objectContaining({ eventId: 'purchase_BULK-8' }),
    );
    expect(mocks.scheduleQueuedMetaEventDelivery).toHaveBeenCalledWith('purchase_BULK-8');
  });

  it('does not transition or refund a provider-cancelled order after account deletion starts', async () => {
    mocks.orderFindMany.mockResolvedValue([batchOrder({
      status: 'Processing',
      apiOrderId: 'provider-2900',
      charge: 200_000,
      nitroPointsRedeemedKobo: 0,
    })]);
    mocks.checkOrder.mockResolvedValue({ status: 'Cancelled', remains: 409 });
    // The shared lock returns null for PendingDeletion, Deleted, and
    // anonymized accounts. The provider response must then be observational
    // only: no local transition and no money movement.
    mocks.lockOrderSettlementAccount.mockResolvedValue(null);

    const response = await patchBatch('check');
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ success: true, checked: 1, updated: 0 });
    expect(mocks.lockOrderSettlementAccount).toHaveBeenCalledWith(prisma, 'user-1');
    expect(mocks.orderUpdateMany).not.toHaveBeenCalled();
    expect(mocks.getTotalRefundedKobo).not.toHaveBeenCalled();
    expect(mocks.executeRaw).not.toHaveBeenCalled();
    expect(mocks.transactionCreate).not.toHaveBeenCalled();
    expect(mocks.reverseOrderPoints).not.toHaveBeenCalled();
  });

  it('does not query or mutate a cancelling order while its cancellation lease is active', async () => {
    mocks.orderFindMany.mockResolvedValue([batchOrder({
      status: 'Cancelling',
      apiOrderId: 'provider-2900',
      charge: 200_000,
    })]);

    const response = await patchBatch('check');

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ success: true, updated: 0 });
    expect(mocks.checkOrder).not.toHaveBeenCalled();
    expect(mocks.prismaTransaction).not.toHaveBeenCalled();
    expect(mocks.orderUpdateMany).not.toHaveBeenCalled();
    expect(mocks.executeRaw).not.toHaveBeenCalled();
    expect(mocks.transactionCreate).not.toHaveBeenCalled();
    expect(mocks.reverseOrderPoints).not.toHaveBeenCalled();
  });

  it('uses an observed-state CAS and creates no refund when another writer wins the race', async () => {
    const observed = batchOrder({
      status: 'Processing',
      apiOrderId: 'provider-2900',
      charge: 200_000,
      nitroPointsRedeemedKobo: 0,
    });
    mocks.orderFindMany.mockResolvedValue([observed]);
    mocks.checkOrder.mockResolvedValue({ status: 'Cancelled', remains: 409 });
    mocks.orderUpdateMany.mockResolvedValueOnce({ count: 0 });

    const response = await patchBatch('check');
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ success: true, checked: 1, updated: 0 });
    expect(mocks.prismaTransaction).toHaveBeenCalledTimes(1);
    expect(mocks.orderUpdateMany).toHaveBeenCalledWith({
      where: {
        id: 'source-db',
        userId: 'user-1',
        status: 'Processing',
        apiOrderId: 'provider-2900',
        deletedAt: null,
      },
      data: {
        status: 'Cancelled',
        remains: 409,
        refundedAt: expect.any(Date),
      },
    });
    expect(mocks.getTotalRefundedKobo).not.toHaveBeenCalled();
    expect(mocks.executeRaw).not.toHaveBeenCalled();
    expect(mocks.transactionCreate).not.toHaveBeenCalled();
    expect(mocks.reverseOrderPoints).not.toHaveBeenCalled();
  });
});
