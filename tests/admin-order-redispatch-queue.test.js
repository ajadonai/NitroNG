import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  logActivity: vi.fn(),
  orderFindFirst: vi.fn(),
  orderFindMany: vi.fn(),
  orderUpdate: vi.fn(),
  orderUpdateMany: vi.fn(),
  orderCreate: vi.fn(),
  dripFindFirst: vi.fn(),
  dripUpdate: vi.fn(),
  dripUpdateMany: vi.fn(),
  dripCount: vi.fn(),
  dripCreateMany: vi.fn(),
  ledgerCreate: vi.fn(),
  executeRaw: vi.fn(),
  queryRaw: vi.fn(),
  placeOrder: vi.fn(),
  placeWithProvider: vi.fn(),
  checkOrder: vi.fn(),
  lockOrderSettlementAccount: vi.fn(),
  enqueueMetaEvent: vi.fn(),
  scheduleQueuedMetaEventDelivery: vi.fn(),
  getTotalRefundedKobo: vi.fn(),
}));

const tx = {
  order: {
    updateMany: (...args) => mocks.orderUpdateMany(...args),
    create: (...args) => mocks.orderCreate(...args),
  },
  dripDispatch: {
    createMany: (...args) => mocks.dripCreateMany(...args),
    updateMany: (...args) => mocks.dripUpdateMany(...args),
    count: (...args) => mocks.dripCount(...args),
  },
  transaction: { create: (...args) => mocks.ledgerCreate(...args) },
  $executeRaw: (...args) => mocks.executeRaw(...args),
  $queryRaw: (...args) => mocks.queryRaw(...args),
};

vi.mock('@/lib/prisma', () => ({
  default: {
    order: {
      findFirst: (...args) => mocks.orderFindFirst(...args),
      findMany: (...args) => mocks.orderFindMany(...args),
      update: (...args) => mocks.orderUpdate(...args),
      updateMany: (...args) => mocks.orderUpdateMany(...args),
    },
    dripDispatch: {
      findFirst: (...args) => mocks.dripFindFirst(...args),
      update: (...args) => mocks.dripUpdate(...args),
      updateMany: (...args) => mocks.dripUpdateMany(...args),
    },
    setting: { findUnique: vi.fn().mockResolvedValue({ value: '1600' }) },
    $transaction: callback => callback(tx),
  },
}));
vi.mock('@/lib/logger', () => ({ log: { error: vi.fn(), warn: vi.fn() } }));
vi.mock('@/lib/admin', () => ({
  requireAdmin: (...args) => mocks.requireAdmin(...args),
  logActivity: (...args) => mocks.logActivity(...args),
  canSeeSensitive: () => true,
  // The route gained this guard after the suite was written. Without it every
  // case threw on import and returned 500, masking what was actually being
  // tested. These tests are about queue safety, not permissions, so it allows.
  canPerformAction: () => true,
  maskEmail: value => value,
  maskPhone: value => value,
}));
vi.mock('@/lib/email', () => ({ sendEmail: vi.fn(), walletCreditEmail: vi.fn() }));
vi.mock('@/lib/smm', () => ({
  placeOrder: (...args) => mocks.placeOrder(...args),
  checkOrder: (...args) => mocks.checkOrder(...args),
  cancelOrder: vi.fn(), refillOrder: vi.fn(),
  isProviderConfigured: () => false,
  getProviderName: () => 'MoreThanPanel',
}));
vi.mock('@/lib/bulk-dispatch', () => ({
  placeWithProvider: (...args) => mocks.placeWithProvider(...args),
}));
vi.mock('@/lib/commissions', () => ({ voidCommissions: vi.fn() }));
vi.mock('@/lib/clean-link', () => ({ cleanLink: value => value }));
vi.mock('@/lib/account-deletion', () => ({
  ORDER_SETTLEMENT_ACCOUNT_STATUSES: ['Active', 'Suspended'],
  lockOrderSettlementAccount: (...args) => mocks.lockOrderSettlementAccount(...args),
}));
vi.mock('@/lib/meta-capi', () => ({
  loadStoredCapiIdentity: vi.fn(async () => ({})),
  persistFbTouch: vi.fn(async () => {}),
  enqueueMetaEvent: (...args) => mocks.enqueueMetaEvent(...args),
  scheduleQueuedMetaEventDelivery: (...args) => mocks.scheduleQueuedMetaEventDelivery(...args),
}));
vi.mock('@/lib/telegram', () => ({ tgRefundAlert: vi.fn() }));
vi.mock('@/lib/nitro-rewards', () => ({
  reverseOrderPoints: vi.fn(),
  computeRefundSplit: charge => ({ walletRefund: charge, pointsRestore: 0 }),
  getTotalRefundedKobo: (...args) => mocks.getTotalRefundedKobo(...args),
}));
vi.mock('@/lib/order-offer-display', () => ({
  buildOrderOfferSnapshot: () => ({
    serviceNameAtPurchase: 'YouTube Subscribers',
    tierNameAtPurchase: 'Standard',
    platformAtPurchase: 'YouTube',
    serviceTypeAtPurchase: 'followers',
  }),
  getOrderOfferDisplay: () => ({ serviceName: 'YouTube Subscribers', tierLabel: 'Standard', platform: 'YouTube' }),
}));
vi.mock('@/lib/drip-feed', () => ({
  calculateMultiDayDrip: vi.fn(),
  calculateIntradayDrip: () => ({
    dispatches: [
      { batch: 1, quantity: 204, scheduledAt: new Date('2026-07-17T17:05:00Z') },
      { batch: 2, quantity: 205, scheduledAt: new Date('2026-07-17T19:05:00Z') },
    ],
  }),
  validateIntradayDuration: () => null,
}));

const { POST } = await import('@/app/api/admin/orders/route');

function parentOrder() {
  const service = {
    id: 'service-8871', provider: 'mtp', apiId: 8871, apiType: 'Default',
    min: 50, costPer1k: 1.525, category: 'youtube', name: 'Provider raw name',
  };
  return {
    id: 'parent-db-id', orderId: 'NTR-2913', userId: 'user-1', tierId: 'tier-standard',
    serviceId: service.id, service, link: 'https://youtube.com/@thewargenerals',
    quantity: 409, charge: 1_945_900, cost: 997_900, status: 'Cancelled',
    apiOrderId: null, remains: null, comments: null, dripDays: 1, redispatchedAt: null,
    user: { id: 'user-1', balance: 5_000_000 },
    tier: { id: 'tier-standard', service: null, group: { type: 'followers' } },
    dripDispatches: [
      { status: 'pending', quantity: 204, remains: null },
      { status: 'pending', quantity: 205, remains: null },
    ],
  };
}

function request() {
  return new Request('https://nitro.test/api/admin/orders', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ action: 'redispatch', orderId: 'NTR-2913' }),
  });
}

function dispatchRequest() {
  return new Request('https://nitro.test/api/admin/orders', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ action: 'dispatch', orderId: 'NTR-3080' }),
  });
}

function retryRequest() {
  return new Request('https://nitro.test/api/admin/orders', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ action: 'retry', orderId: 'NTR-3080' }),
  });
}

function checkRequest() {
  return new Request('https://nitro.test/api/admin/orders', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ action: 'check', orderId: 'NTR-2913' }),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  for (const mock of Object.values(mocks)) mock.mockReset();
  mocks.requireAdmin.mockResolvedValue({ admin: { name: 'Soludo' }, error: null });
  mocks.orderFindMany.mockResolvedValue([{ orderId: 'NTR-3079' }]);
  mocks.orderUpdateMany.mockResolvedValue({ count: 1 });
  mocks.executeRaw.mockResolvedValue(1);
  mocks.ledgerCreate.mockResolvedValue({});
  mocks.dripCreateMany.mockResolvedValue({ count: 2 });
  mocks.orderUpdate.mockResolvedValue({});
  mocks.queryRaw.mockResolvedValue([{ id: 'child-db-id', status: 'Processing', deletedAt: null, queuedBehind: null }]);
  mocks.dripCount.mockResolvedValue(0);
  mocks.orderCreate.mockImplementation(({ data }) => ({
    id: 'child-db-id', createdAt: new Date('2026-07-17T17:05:07Z'), ...data,
  }));
  mocks.lockOrderSettlementAccount.mockResolvedValue({ id: 'user-1', status: 'Active' });
  mocks.getTotalRefundedKobo.mockResolvedValue(1_945_900);
});

describe('admin redispatch — same-link queue safety', () => {
  it('keeps a cancelling order immutable while its cancellation lease is being finalized', async () => {
    mocks.orderFindFirst.mockResolvedValueOnce({
      ...parentOrder(),
      status: 'Cancelling',
      apiOrderId: 'provider-2913',
    });

    const response = await POST(checkRequest());

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      success: true,
      status: 'Cancelling',
      message: 'Cancellation is being finalized',
    });
    expect(mocks.checkOrder).not.toHaveBeenCalled();
    expect(mocks.orderUpdateMany).not.toHaveBeenCalled();
    expect(mocks.executeRaw).not.toHaveBeenCalled();
    expect(mocks.ledgerCreate).not.toHaveBeenCalled();
  });

  it('refuses to manually dispatch a terminal drip parent', async () => {
    const terminal = {
      ...parentOrder(),
      id: 'completed-db-id',
      orderId: 'NTR-3000',
      status: 'Completed',
      apiOrderId: null,
    };
    mocks.orderFindFirst
      .mockResolvedValueOnce({ ...terminal, service: { provider: 'mtp' } })
      .mockResolvedValueOnce(terminal);

    const response = await POST(dispatchRequest());

    expect(response.status).toBe(400);
    expect(mocks.dripUpdateMany).not.toHaveBeenCalled();
    expect(mocks.placeOrder).not.toHaveBeenCalled();
  });

  it('rejects retry while cancellation owns the parent lease', async () => {
    const cancelling = {
      ...parentOrder(),
      id: 'cancelling-db-id',
      orderId: 'NTR-3080',
      status: 'Cancelling',
      apiOrderId: null,
    };
    mocks.orderFindFirst
      .mockResolvedValueOnce({ ...cancelling, service: { provider: 'mtp' } })
      .mockResolvedValueOnce(cancelling);

    const response = await POST(retryRequest());

    expect(response.status).toBe(409);
    expect(mocks.orderUpdateMany).not.toHaveBeenCalled();
    expect(mocks.dripUpdateMany).not.toHaveBeenCalled();
    expect(mocks.placeOrder).not.toHaveBeenCalled();
    expect(mocks.placeWithProvider).not.toHaveBeenCalled();
  });

  it('rejects retry before reopening an order when the account is unavailable', async () => {
    const pending = {
      ...parentOrder(),
      id: 'pending-db-id',
      orderId: 'NTR-3080',
      status: 'Pending',
      apiOrderId: null,
    };
    mocks.orderFindFirst
      .mockResolvedValueOnce({ ...pending, service: { provider: 'mtp' } })
      .mockResolvedValueOnce(pending);
    mocks.lockOrderSettlementAccount.mockResolvedValue(null);

    const response = await POST(retryRequest());

    expect(response.status).toBe(409);
    expect(mocks.lockOrderSettlementAccount).toHaveBeenCalledWith(tx, 'user-1');
    expect(mocks.orderUpdateMany).not.toHaveBeenCalled();
    expect(mocks.dripUpdateMany).not.toHaveBeenCalled();
    expect(mocks.placeOrder).not.toHaveBeenCalled();
    expect(mocks.placeWithProvider).not.toHaveBeenCalled();
  });

  it('rejects dispatch while cancellation owns the parent lease', async () => {
    const cancelling = {
      ...parentOrder(),
      id: 'cancelling-db-id',
      orderId: 'NTR-3080',
      status: 'Cancelling',
      apiOrderId: null,
    };
    mocks.orderFindFirst
      .mockResolvedValueOnce({ ...cancelling, service: { provider: 'mtp' } })
      .mockResolvedValueOnce(cancelling);

    const response = await POST(dispatchRequest());

    expect(response.status).toBe(409);
    expect(mocks.orderUpdateMany).not.toHaveBeenCalled();
    expect(mocks.dripUpdateMany).not.toHaveBeenCalled();
    expect(mocks.placeOrder).not.toHaveBeenCalled();
    expect(mocks.placeWithProvider).not.toHaveBeenCalled();
  });

  it('rejects dispatch before queue or provider work when the account is unavailable', async () => {
    const pending = {
      ...parentOrder(),
      id: 'pending-db-id',
      orderId: 'NTR-3080',
      status: 'Pending',
      apiOrderId: null,
      queuedBehind: null,
    };
    mocks.orderFindFirst
      .mockResolvedValueOnce({ ...pending, service: { provider: 'mtp' } })
      .mockResolvedValueOnce(pending);
    mocks.lockOrderSettlementAccount.mockResolvedValue(null);

    const response = await POST(dispatchRequest());

    expect(response.status).toBe(409);
    expect(mocks.lockOrderSettlementAccount).toHaveBeenCalledWith(tx, 'user-1');
    expect(mocks.orderUpdateMany).not.toHaveBeenCalled();
    expect(mocks.dripUpdateMany).not.toHaveBeenCalled();
    expect(mocks.placeOrder).not.toHaveBeenCalled();
    expect(mocks.placeWithProvider).not.toHaveBeenCalled();
  });

  it('prevents manual dispatch from bypassing an active same-link queue', async () => {
    const fullOrder = {
      ...parentOrder(),
      id: 'child-db-id',
      orderId: 'NTR-3080',
      status: 'Pending',
      createdAt: new Date('2026-07-17T17:05:07Z'),
      dripDelivered: 0,
    };
    mocks.orderFindFirst
      .mockResolvedValueOnce({ ...fullOrder, service: { provider: 'mtp' } })
      .mockResolvedValueOnce(fullOrder)
      .mockResolvedValueOnce({ orderId: 'NTR-2890' });

    const response = await POST(dispatchRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({ success: true, queued: true, queuedBehind: 'NTR-2890' });
    expect(mocks.orderUpdateMany).toHaveBeenCalledWith({
      where: {
        id: 'child-db-id',
        userId: 'user-1',
        status: { in: ['Pending', 'Processing', 'Dispatching'] },
        apiOrderId: null,
        deletedAt: null,
      },
      data: { status: 'Pending', queuedBehind: 'NTR-2890' },
    });
    expect(mocks.dripFindFirst).not.toHaveBeenCalled();
    expect(mocks.placeOrder).not.toHaveBeenCalled();
  });

  it('fences a manual drip claim on the parent queue and sibling batch state', async () => {
    const fullOrder = {
      ...parentOrder(),
      id: 'child-db-id',
      orderId: 'NTR-3080',
      status: 'Processing',
      createdAt: new Date('2026-07-17T17:05:07Z'),
      queuedBehind: null,
      dripDelivered: 1,
    };
    const candidate = {
      id: 'dispatch-2', orderId: 'child-db-id', day: 1, batch: 2,
      quantity: 205, status: 'pending', scheduledAt: new Date('2026-07-17T19:05:00Z'),
    };
    mocks.orderFindFirst
      .mockResolvedValueOnce({ ...fullOrder, service: { provider: 'mtp' } })
      .mockResolvedValueOnce(fullOrder)
      .mockResolvedValueOnce(null);
    mocks.dripFindFirst
      .mockResolvedValueOnce({ id: 'dispatch-1' })
      .mockResolvedValueOnce(candidate);
    mocks.dripUpdateMany.mockResolvedValueOnce({ count: 0 });

    const response = await POST(dispatchRequest());

    expect(response.status).toBe(409);
    expect(mocks.dripUpdateMany).toHaveBeenCalledWith({
      where: { id: 'dispatch-2', status: 'pending' },
      data: { status: 'dispatching', dispatchedAt: expect.any(Date) },
    });
    expect(mocks.placeOrder).not.toHaveBeenCalled();
  });

  it('creates a queued child and performs no provider I/O while the earlier order is active', async () => {
    const parent = parentOrder();
    mocks.orderFindFirst
      .mockResolvedValueOnce({ ...parent, service: { provider: 'mtp' } })
      .mockResolvedValueOnce(parent)
      .mockResolvedValueOnce({ orderId: 'NTR-2890' })
      .mockResolvedValueOnce({ orderId: 'NTR-2890' });

    const response = await POST(request());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      success: true,
      queued: true,
      queuedBehind: 'NTR-2890',
      newOrderId: 'NTR-3080',
    });
    expect(mocks.orderUpdateMany).toHaveBeenCalledWith({
      where: { id: 'parent-db-id', status: 'Cancelled', redispatchedAt: null },
      data: { redispatchedAt: expect.any(Date) },
    });
    expect(mocks.orderCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        orderId: 'NTR-3080',
        parentOrderId: 'NTR-2913',
        status: 'Pending',
        queuedBehind: 'NTR-2890',
      }),
    });
    expect(mocks.dripCreateMany).toHaveBeenCalled();
    expect(mocks.placeOrder).not.toHaveBeenCalled();
    expect(mocks.dripUpdate).not.toHaveBeenCalled();
    expect(mocks.enqueueMetaEvent).toHaveBeenCalledWith(
      tx,
      'Purchase',
      expect.objectContaining({ eventId: 'purchase_NTR-3080' }),
    );
    expect(mocks.scheduleQueuedMetaEventDelivery).toHaveBeenCalledWith('purchase_NTR-3080');
    expect(mocks.logActivity).toHaveBeenCalledWith(
      'Soludo',
      expect.stringContaining('queued behind NTR-2890'),
      'order',
    );
  });

  it('does not enqueue a Purchase when original held funds fully cover the redispatch', async () => {
    const parent = parentOrder();
    mocks.getTotalRefundedKobo.mockResolvedValue(0);
    mocks.orderFindFirst
      .mockResolvedValueOnce({ ...parent, service: { provider: 'mtp' } })
      .mockResolvedValueOnce(parent)
      .mockResolvedValueOnce({ orderId: 'NTR-2890' })
      .mockResolvedValueOnce({ orderId: 'NTR-2890' });

    const response = await POST(request());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      success: true,
      queued: true,
      newOrderId: 'NTR-3080',
    });
    expect(mocks.orderCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        orderId: 'NTR-3080',
        charge: 0,
      }),
    });
    expect(mocks.executeRaw).not.toHaveBeenCalled();
    expect(mocks.ledgerCreate).not.toHaveBeenCalled();
    expect(mocks.enqueueMetaEvent).not.toHaveBeenCalled();
    expect(mocks.scheduleQueuedMetaEventDelivery).not.toHaveBeenCalled();
  });

  it('allows only one concurrent redispatch to claim the cancelled parent', async () => {
    const parent = parentOrder();
    mocks.orderFindFirst
      .mockResolvedValueOnce({ ...parent, service: { provider: 'mtp' } })
      .mockResolvedValueOnce(parent)
      .mockResolvedValueOnce({ orderId: 'NTR-2890' });
    mocks.orderUpdateMany.mockResolvedValueOnce({ count: 0 });

    const response = await POST(request());

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({ error: 'Order already redispatched' });
    expect(mocks.orderCreate).not.toHaveBeenCalled();
    expect(mocks.executeRaw).not.toHaveBeenCalled();
    expect(mocks.placeOrder).not.toHaveBeenCalled();
  });

  it('does not create a child if the wallet debit loses a balance race', async () => {
    const parent = parentOrder();
    mocks.orderFindFirst
      .mockResolvedValueOnce({ ...parent, service: { provider: 'mtp' } })
      .mockResolvedValueOnce(parent)
      .mockResolvedValueOnce({ orderId: 'NTR-2890' });
    mocks.executeRaw.mockResolvedValueOnce(0);

    const response = await POST(request());

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({ error: 'Insufficient balance' });
    expect(mocks.orderCreate).not.toHaveBeenCalled();
    expect(mocks.ledgerCreate).not.toHaveBeenCalled();
    expect(mocks.placeOrder).not.toHaveBeenCalled();
  });

  it('rejects redispatch before claiming, debiting, or creating when the account is unavailable', async () => {
    const parent = parentOrder();
    mocks.orderFindFirst
      .mockResolvedValueOnce({ ...parent, service: { provider: 'mtp' } })
      .mockResolvedValueOnce(parent)
      .mockResolvedValueOnce({ orderId: 'NTR-2890' });
    mocks.lockOrderSettlementAccount.mockResolvedValue(null);

    const response = await POST(request());

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      error: 'This account is pending deletion and cannot receive redispatched orders',
    });
    expect(mocks.lockOrderSettlementAccount).toHaveBeenCalledWith(tx, 'user-1');
    expect(mocks.orderUpdateMany).not.toHaveBeenCalled();
    expect(mocks.executeRaw).not.toHaveBeenCalled();
    expect(mocks.orderCreate).not.toHaveBeenCalled();
    expect(mocks.ledgerCreate).not.toHaveBeenCalled();
    expect(mocks.dripCreateMany).not.toHaveBeenCalled();
    expect(mocks.placeOrder).not.toHaveBeenCalled();
  });
});
