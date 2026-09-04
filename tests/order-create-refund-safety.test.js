import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  rateLimit: vi.fn(),
  placeOrder: vi.fn(),
  checkOrder: vi.fn(),
  lockOrderSettlementAccount: vi.fn(),
  orderFindFirst: vi.fn(),
  orderFindUnique: vi.fn(),
  orderFindMany: vi.fn(),
  orderCount: vi.fn(),
  orderCreate: vi.fn(),
  orderUpdateMany: vi.fn(),
  serviceTierFindUnique: vi.fn(),
  settingFindUnique: vi.fn(),
  dripFindFirst: vi.fn(),
  dripCreateMany: vi.fn(),
  dripUpdateMany: vi.fn(),
  transactionCreate: vi.fn(),
  adminIssueFindFirst: vi.fn(),
  adminIssueCreate: vi.fn(),
  adminIssueUpdate: vi.fn(),
  prismaTransaction: vi.fn(),
  executeRaw: vi.fn(),
  deductBalance: vi.fn(),
  trackBonusConsumption: vi.fn(),
  reverseOrderPoints: vi.fn(),
  getTotalRefundedKobo: vi.fn(),
  computeRefundSplit: vi.fn(),
  getDripConfig: vi.fn(),
  calculateMultiDayDrip: vi.fn(),
  checkDripFeasibility: vi.fn(),
  cancelQueuedMetaEvent: vi.fn(),
  enqueueMetaEvent: vi.fn(),
  scheduleQueuedMetaEventDelivery: vi.fn(),
}));

const prisma = {
  order: {
    findFirst: (...args) => mocks.orderFindFirst(...args),
    findUnique: (...args) => mocks.orderFindUnique(...args),
    findMany: (...args) => mocks.orderFindMany(...args),
    count: (...args) => mocks.orderCount(...args),
    create: (...args) => mocks.orderCreate(...args),
    updateMany: (...args) => mocks.orderUpdateMany(...args),
  },
  serviceTier: { findUnique: (...args) => mocks.serviceTierFindUnique(...args) },
  setting: { findUnique: (...args) => mocks.settingFindUnique(...args) },
  dripDispatch: {
    findFirst: (...args) => mocks.dripFindFirst(...args),
    createMany: (...args) => mocks.dripCreateMany(...args),
    updateMany: (...args) => mocks.dripUpdateMany(...args),
  },
  transaction: { create: (...args) => mocks.transactionCreate(...args) },
  adminIssue: {
    findFirst: (...args) => mocks.adminIssueFindFirst(...args),
    create: (...args) => mocks.adminIssueCreate(...args),
    update: (...args) => mocks.adminIssueUpdate(...args),
  },
  nitroPointLedger: { create: vi.fn() },
  user: { findUnique: vi.fn() },
  $transaction: (...args) => mocks.prismaTransaction(...args),
  $executeRaw: (...args) => mocks.executeRaw(...args),
};

vi.mock('@/lib/prisma', () => ({ default: prisma }));
vi.mock('@/lib/logger', () => ({ log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));
vi.mock('@/lib/auth', () => ({ getCurrentUser: (...args) => mocks.getCurrentUser(...args) }));
vi.mock('@/lib/rate-limit', () => ({
  rateLimit: (...args) => mocks.rateLimit(...args),
  rateLimitUnavailable: vi.fn(),
  tooManyRequests: vi.fn(),
}));
vi.mock('@/lib/smm', () => ({
  placeOrder: (...args) => mocks.placeOrder(...args),
  checkOrder: (...args) => mocks.checkOrder(...args),
  isProviderConfigured: vi.fn(() => true),
}));
vi.mock('@/lib/account-deletion', () => ({
  ORDER_SETTLEMENT_ACCOUNT_STATUSES: Object.freeze(['Active', 'Suspended']),
  lockOrderSettlementAccount: (...args) => mocks.lockOrderSettlementAccount(...args),
}));
vi.mock('@/lib/promotions', () => ({
  getActivePromotion: vi.fn(async () => null),
  applyPromotionDiscount: vi.fn(() => 0),
}));
vi.mock('@/lib/drip-feed', () => ({
  getDripConfig: (...args) => mocks.getDripConfig(...args),
  calculateIntradayDrip: vi.fn(() => null),
  calculateMultiDayDrip: (...args) => mocks.calculateMultiDayDrip(...args),
  checkDripFeasibility: (...args) => mocks.checkDripFeasibility(...args),
  validateIntradayDuration: vi.fn(() => null),
  sliceCommentsForBatch: vi.fn(value => value),
}));
vi.mock('@/lib/order-create-input.server', () => ({
  parseCreateOrderInput: vi.fn(body => ({
    ok: true,
    value: {
      tierId: body.tierId,
      serviceId: undefined,
      link: body.link,
      quantity: body.quantity,
      comments: undefined,
      rawDripDays: body.dripDays,
      confirmDuplicate: true,
      redeemPoints: false,
      isUrl: true,
    },
  })),
  calculateCreateOrderPricing: vi.fn(() => ({
    ok: true,
    value: {
      qty: 1_000,
      chargeKobo: 200_000,
      costKobo: 100_000,
      offerSnapshot: {
        serviceNameAtPurchase: 'Instagram Likes',
        tierNameAtPurchase: 'Budget',
        platformAtPurchase: 'instagram',
        serviceTypeAtPurchase: 'likes',
      },
      tierName: 'Instagram Likes (Budget)',
    },
  })),
  validateCreateOrderOfferInput: vi.fn(() => ({
    ok: true,
    value: { apiType: 'default', needsUsernames: false, needsAnswer: false, needsKeywords: false },
  })),
}));
vi.mock('@/lib/nitro-rewards', () => ({
  getNitroStatus: vi.fn(() => ({ key: 'spark', name: 'Spark', discountPct: 0 })),
  getEligibleSpendKoboTx: vi.fn(async () => 0),
  computeNitroDiscount: vi.fn(() => 0),
  awardOrderPoints: vi.fn(),
  reverseOrderPoints: (...args) => mocks.reverseOrderPoints(...args),
  getPointsBalanceKoboTx: vi.fn(async () => 0),
  computeRefundSplit: (...args) => mocks.computeRefundSplit(...args),
  getTotalRefundedKobo: (...args) => mocks.getTotalRefundedKobo(...args),
  MIN_REDEEM_POINTS: 1_000,
}));
vi.mock('@/lib/order-queue', () => ({
  findOpenSameLinkOrder: vi.fn(async () => null),
  findSameLinkDispatchBlocker: vi.fn(async () => null),
  isActiveOrderConflict: vi.fn(() => false),
  PROVIDER_ACTIVE_WAIT: 'provider_active_wait',
}));
vi.mock('@/lib/order-offer-display', () => ({
  buildOrderOfferSnapshot: vi.fn(() => ({})),
  getOrderOfferDisplay: vi.fn(() => ({ serviceName: 'Instagram Likes', tierLabel: 'Budget' })),
}));
vi.mock('@/lib/bonus-credit', () => ({
  deductBalance: (...args) => mocks.deductBalance(...args),
  trackBonusConsumption: (...args) => mocks.trackBonusConsumption(...args),
  restoreBonusForRefund: vi.fn(),
}));
vi.mock('@/lib/meta-capi', () => ({
  loadStoredCapiIdentity: vi.fn(async () => ({})),
  persistFbTouch: vi.fn(async () => {}),
  cancelQueuedMetaEvent: (...args) => mocks.cancelQueuedMetaEvent(...args),
  enqueueMetaEvent: (...args) => mocks.enqueueMetaEvent(...args),
  parseFbCookies: vi.fn(() => ({})),
  scheduleQueuedMetaEventDelivery: (...args) => mocks.scheduleQueuedMetaEventDelivery(...args),
}));
vi.mock('next/headers', () => ({ headers: vi.fn(async () => new Headers()) }));
vi.mock('@/lib/telegram', () => ({
  tgNewOrder: vi.fn(),
  tgOutreachAlert: vi.fn(),
  tgRefundAlert: vi.fn(),
}));
vi.mock('@/lib/ify/outreach', () => ({ sendOutreach: vi.fn() }));
vi.mock('@/lib/commissions', () => ({ voidCommissions: vi.fn() }));
vi.mock('@/lib/order-history', () => ({ buildOrderDisplayGroups: vi.fn(() => []) }));

const { PATCH: patchCustomerOrder, POST: createOrder } = await import('@/app/api/orders/route');
const { POST: checkCustomerOrder } = await import('@/app/api/orders/check/route');

const tier = {
  id: 'tier-budget',
  tier: 'Budget',
  sellPer1k: 200_000,
  enabled: true,
  group: {
    enabled: true,
    type: 'likes',
    platform: 'instagram',
    tags: ['drip'],
  },
  service: {
    id: 'service-likes',
    enabled: true,
    provider: 'mtp',
    apiId: 1234,
    apiType: 'Default',
    category: 'instagram',
    min: 100,
    max: 100_000,
    costPer1k: 50,
  },
};

function createRequest({ drip = false } = {}) {
  return new Request('http://localhost/api/orders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      tierId: tier.id,
      link: 'https://instagram.com/p/safety-test',
      quantity: 1_000,
      confirmDuplicate: true,
      ...(drip ? { dripDays: 2 } : {}),
    }),
  });
}

function cancelledOrderWrites() {
  return mocks.orderUpdateMany.mock.calls.filter(([input]) => input?.data?.status === 'Cancelled');
}

function refundLedgerWrites() {
  return mocks.transactionCreate.mock.calls.filter(([input]) => input?.data?.type === 'refund');
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getCurrentUser.mockResolvedValue({ id: 'user-1', email: 'customer@example.test' });
  mocks.rateLimit.mockResolvedValue({ unavailable: false, limited: false });
  mocks.settingFindUnique.mockResolvedValue({ value: '1600' });
  mocks.orderFindFirst.mockResolvedValue(null);
  mocks.orderFindUnique.mockResolvedValue({ status: 'Completed' });
  mocks.orderFindMany.mockResolvedValue([{ orderId: 'NTR-4999' }]);
  mocks.orderCount.mockResolvedValue(2);
  mocks.orderCreate.mockImplementation(async ({ data }) => ({
    id: 'order-db-5000',
    createdAt: new Date('2026-08-05T08:00:00.000Z'),
    ...data,
  }));
  mocks.orderUpdateMany.mockResolvedValue({ count: 1 });
  mocks.serviceTierFindUnique.mockResolvedValue(tier);
  mocks.dripCreateMany.mockResolvedValue({ count: 2 });
  mocks.dripFindFirst.mockResolvedValue({ id: 'drip-1', day: 1, batch: 1, quantity: 500 });
  mocks.dripUpdateMany.mockResolvedValue({ count: 1 });
  mocks.transactionCreate.mockResolvedValue({ id: 'transaction-1' });
  mocks.adminIssueFindFirst.mockResolvedValue(null);
  mocks.adminIssueCreate.mockResolvedValue({ id: 'issue-1' });
  mocks.adminIssueUpdate.mockResolvedValue({ id: 'issue-1' });
  mocks.prismaTransaction.mockImplementation(async callback => callback(prisma));
  mocks.executeRaw.mockResolvedValue(1);
  mocks.deductBalance.mockResolvedValue(undefined);
  mocks.trackBonusConsumption.mockResolvedValue(0);
  mocks.reverseOrderPoints.mockResolvedValue(0);
  mocks.getTotalRefundedKobo.mockResolvedValue(0);
  mocks.computeRefundSplit.mockReturnValue({ walletRefund: 200_000, pointsRestore: 0 });
  mocks.getDripConfig.mockReturnValue(null);
  mocks.checkDripFeasibility.mockReturnValue({ feasible: true });
  mocks.calculateMultiDayDrip.mockReturnValue({
    dispatches: [
      { day: 1, batch: 1, quantity: 500, scheduledAt: new Date('2026-08-05T08:00:00.000Z') },
      { day: 2, batch: 1, quantity: 500, scheduledAt: new Date('2026-08-06T08:00:00.000Z') },
    ],
  });
  mocks.lockOrderSettlementAccount.mockResolvedValue({ id: 'user-1', status: 'Active' });
  mocks.placeOrder.mockRejectedValue(new Error('incorrect service'));
});

describe('new-order permanent-rejection refund fencing', () => {
  it.each([
    ['direct', false],
    ['drip', true],
  ])('does not cancel or refund a %s order after account deletion owns the user lock', async (_label, drip) => {
    mocks.lockOrderSettlementAccount.mockResolvedValue(null);

    const response = await createOrder(createRequest({ drip }));

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: 'Order state changed before the refund could be issued.' });
    expect(mocks.lockOrderSettlementAccount).toHaveBeenCalledWith(prisma, 'user-1');
    expect(cancelledOrderWrites()).toHaveLength(0);
    expect(mocks.executeRaw).not.toHaveBeenCalled();
    expect(refundLedgerWrites()).toHaveLength(0);
    expect(mocks.reverseOrderPoints).not.toHaveBeenCalled();
  });

  it.each([
    ['direct', false, 'Dispatching'],
    ['drip', true, 'Pending'],
  ])('does not refund a %s order when the observed-state cancellation CAS loses', async (_label, drip, observedStatus) => {
    mocks.orderUpdateMany.mockImplementation(async input => ({
      count: input?.data?.status === 'Cancelled' ? 0 : 1,
    }));

    const response = await createOrder(createRequest({ drip }));

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: 'Order state changed before the refund could be issued.' });
    expect(cancelledOrderWrites()).toEqual([[
      expect.objectContaining({
        where: expect.objectContaining({
          id: 'order-db-5000',
          userId: 'user-1',
          status: observedStatus,
          apiOrderId: null,
          deletedAt: null,
        }),
      }),
    ]]);
    expect(mocks.executeRaw).not.toHaveBeenCalled();
    expect(refundLedgerWrites()).toHaveLength(0);
    expect(mocks.reverseOrderPoints).not.toHaveBeenCalled();
  });

  it('retains the successful direct permanent-rejection refund path', async () => {
    const response = await createOrder(createRequest());

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: 'This service is temporarily unavailable. You have been refunded.' });
    expect(cancelledOrderWrites()).toHaveLength(1);
    expect(mocks.executeRaw).toHaveBeenCalledTimes(1);
    expect(refundLedgerWrites()).toEqual([[
      expect.objectContaining({
        data: expect.objectContaining({
          userId: 'user-1',
          type: 'refund',
          amount: 200_000,
          reference: 'REF-NTR-5000',
        }),
      }),
    ]]);
    expect(mocks.reverseOrderPoints).toHaveBeenCalledWith(prisma, {
      orderDbId: 'order-db-5000',
      refundAmountKobo: 200_000,
    });
    expect(mocks.enqueueMetaEvent).toHaveBeenCalledWith(
      prisma,
      'Purchase',
      expect.objectContaining({ eventId: 'purchase_NTR-5000' }),
    );
    expect(mocks.cancelQueuedMetaEvent).toHaveBeenCalledWith(
      prisma,
      'purchase_NTR-5000',
      'provider_rejected_and_fully_refunded',
    );
    expect(mocks.scheduleQueuedMetaEventDelivery).not.toHaveBeenCalled();
  });

  it('cancels the deferred Purchase when a drip order is permanently rejected and refunded', async () => {
    const response = await createOrder(createRequest({ drip: true }));

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      error: 'This service is temporarily unavailable. You have been refunded.',
    });
    expect(mocks.enqueueMetaEvent).toHaveBeenCalledWith(
      prisma,
      'Purchase',
      expect.objectContaining({ eventId: 'purchase_NTR-5000', notBefore: expect.any(Date) }),
    );
    expect(mocks.cancelQueuedMetaEvent).toHaveBeenCalledWith(
      prisma,
      'purchase_NTR-5000',
      'provider_rejected_and_fully_refunded',
    );
    expect(mocks.scheduleQueuedMetaEventDelivery).not.toHaveBeenCalled();
  });

  it('schedules the durable Purchase only after the provider path succeeds', async () => {
    mocks.placeOrder.mockResolvedValue({ order: 'provider-5000' });

    const response = await createOrder(createRequest());

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      eventId: 'purchase_NTR-5000',
    });
    expect(mocks.enqueueMetaEvent).toHaveBeenCalledWith(
      prisma,
      'Purchase',
      expect.objectContaining({
        eventId: 'purchase_NTR-5000',
        eventTime: new Date('2026-08-05T08:00:00.000Z'),
        notBefore: expect.any(Date),
      }),
    );
    expect(mocks.cancelQueuedMetaEvent).not.toHaveBeenCalled();
    expect(mocks.scheduleQueuedMetaEventDelivery).toHaveBeenCalledWith('purchase_NTR-5000');
  });
});

describe('customer reorder Purchase outbox', () => {
  it('enqueues and schedules one deterministic Purchase for a charged reorder', async () => {
    mocks.orderFindFirst.mockResolvedValue({
      id: 'original-db-1',
      orderId: 'NTR-4000',
      userId: 'user-1',
      serviceId: tier.service.id,
      tierId: tier.id,
      link: 'https://instagram.com/p/reorder-test',
      quantity: 1_000,
      charge: 200_000,
      comments: null,
      status: 'Completed',
      service: tier.service,
      tier,
    });
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      email: 'customer@example.test',
      phone: '+2348000000000',
      balance: 5_000_000,
    });
    mocks.placeOrder.mockResolvedValue({ order: 'provider-reorder-1' });

    const response = await patchCustomerOrder(new Request('http://localhost/api/orders', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'reorder', orderId: 'NTR-4000' }),
    }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      order: { id: 'NTR-5000' },
    });
    expect(mocks.enqueueMetaEvent).toHaveBeenCalledTimes(1);
    expect(mocks.enqueueMetaEvent).toHaveBeenCalledWith(
      prisma,
      'Purchase',
      expect.objectContaining({
        eventId: 'purchase_NTR-5000',
        eventTime: new Date('2026-08-05T08:00:00.000Z'),
        customData: { value: 2_000, currency: 'NGN' },
      }),
    );
    expect(mocks.scheduleQueuedMetaEventDelivery).toHaveBeenCalledTimes(1);
    expect(mocks.scheduleQueuedMetaEventDelivery).toHaveBeenCalledWith('purchase_NTR-5000');
  });
});

describe('customer provider-check account-deletion fencing', () => {
  it('does not query or mutate a Cancelling order through the PATCH check path', async () => {
    mocks.orderFindFirst.mockResolvedValue({
      id: 'order-db-5000',
      orderId: 'NTR-5000',
      userId: 'user-1',
      apiOrderId: 'provider-5000',
      status: 'Cancelling',
      service: { provider: 'mtp' },
      tier: null,
    });

    const response = await patchCustomerOrder(new Request('http://localhost/api/orders', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'check', orderId: 'NTR-5000' }),
    }));

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ status: 'Cancelling' });
    expect(mocks.checkOrder).not.toHaveBeenCalled();
    expect(mocks.lockOrderSettlementAccount).not.toHaveBeenCalled();
    expect(mocks.orderUpdateMany).not.toHaveBeenCalled();
  });

  it('does not query or mutate a Cancelling order through the dedicated check endpoint', async () => {
    mocks.orderFindFirst.mockResolvedValue({
      id: 'order-db-5000',
      orderId: 'NTR-5000',
      userId: 'user-1',
      apiOrderId: 'provider-5000',
      status: 'Cancelling',
      charge: 200_000,
      service: { provider: 'mtp' },
    });

    const response = await checkCustomerOrder(new Request('http://localhost/api/orders/check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId: 'NTR-5000' }),
    }));

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ status: 'Cancelling' });
    expect(mocks.checkOrder).not.toHaveBeenCalled();
    expect(mocks.lockOrderSettlementAccount).not.toHaveBeenCalled();
    expect(mocks.orderUpdateMany).not.toHaveBeenCalled();
  });

  it.each([
    ['Canceled', undefined],
    ['Partial', 400],
  ])('returns the authoritative sealed status instead of stale provider %s', async (providerStatus, remains) => {
    mocks.orderFindFirst.mockResolvedValue({
      id: 'order-db-5000',
      orderId: 'NTR-5000',
      userId: 'user-1',
      apiOrderId: 'provider-5000',
      status: 'Processing',
      charge: 200_000,
      quantity: 1_000,
      nitroPointsRedeemedKobo: 0,
      protected: false,
      service: { provider: 'mtp' },
    });
    mocks.checkOrder.mockResolvedValue({ status: providerStatus, remains, start_count: 10 });
    mocks.lockOrderSettlementAccount.mockResolvedValue(null);
    mocks.orderFindUnique.mockResolvedValue({ status: 'Completed' });

    const response = await checkCustomerOrder(new Request('http://localhost/api/orders/check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId: 'NTR-5000' }),
    }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.status).toBe('Completed');
    expect(cancelledOrderWrites()).toHaveLength(0);
    expect(mocks.executeRaw).not.toHaveBeenCalled();
    expect(refundLedgerWrites()).toHaveLength(0);
    expect(mocks.reverseOrderPoints).not.toHaveBeenCalled();
  });

  it('fences the duplicate PATCH check path when deletion wins before persistence', async () => {
    mocks.orderFindFirst.mockResolvedValue({
      id: 'order-db-5000',
      orderId: 'NTR-5000',
      userId: 'user-1',
      apiOrderId: 'provider-5000',
      status: 'Processing',
      remains: 1_000,
      startCount: null,
      service: { provider: 'mtp' },
      tier: null,
    });
    mocks.checkOrder.mockResolvedValue({ status: 'Canceled', remains: 1_000, start_count: 10 });
    mocks.lockOrderSettlementAccount.mockResolvedValue(null);
    mocks.orderFindUnique.mockResolvedValue({ status: 'Completed' });

    const response = await patchCustomerOrder(new Request('http://localhost/api/orders', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'check', orderId: 'NTR-5000' }),
    }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.status).toBe('Completed');
    expect(mocks.lockOrderSettlementAccount).toHaveBeenCalledWith(prisma, 'user-1');
    expect(cancelledOrderWrites()).toHaveLength(0);
    expect(mocks.executeRaw).not.toHaveBeenCalled();
    expect(refundLedgerWrites()).toHaveLength(0);
    expect(mocks.reverseOrderPoints).not.toHaveBeenCalled();
  });
});
