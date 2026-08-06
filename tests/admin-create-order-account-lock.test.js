import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  logActivity: vi.fn(),
  userFindUnique: vi.fn(),
  settingFindUnique: vi.fn(),
  tierFindMany: vi.fn(),
  tierFindUnique: vi.fn(),
  outerOrderFindMany: vi.fn(),
  txOrderFindMany: vi.fn(),
  txOrderCreate: vi.fn(),
  txDripCreateMany: vi.fn(),
  txLedgerCreate: vi.fn(),
  txExecuteRaw: vi.fn(),
  lockOrderSettlementAccount: vi.fn(),
  findOpenSameLinkOrder: vi.fn(),
  getEligibleSpendKoboTx: vi.fn(),
  tgNewOrder: vi.fn(),
  enqueueMetaEvent: vi.fn(),
  scheduleQueuedMetaEventDelivery: vi.fn(),
  validateDripConfig: vi.fn(),
  calculateMultiDayDrip: vi.fn(),
  checkDripFeasibility: vi.fn(),
}));

const tx = {
  order: {
    findMany: (...args) => mocks.txOrderFindMany(...args),
    create: (...args) => mocks.txOrderCreate(...args),
  },
  dripDispatch: { createMany: (...args) => mocks.txDripCreateMany(...args) },
  transaction: { create: (...args) => mocks.txLedgerCreate(...args) },
  $executeRaw: (...args) => mocks.txExecuteRaw(...args),
};

const prisma = {
  user: { findUnique: (...args) => mocks.userFindUnique(...args) },
  setting: { findUnique: (...args) => mocks.settingFindUnique(...args) },
  serviceTier: {
    findMany: (...args) => mocks.tierFindMany(...args),
    findUnique: (...args) => mocks.tierFindUnique(...args),
  },
  order: { findMany: (...args) => mocks.outerOrderFindMany(...args) },
  $transaction: vi.fn(work => work(tx)),
};

vi.mock('@/lib/prisma', () => ({ default: prisma }));
vi.mock('@/lib/logger', () => ({
  log: { error: vi.fn(), warn: vi.fn() },
}));
vi.mock('@/lib/admin', () => ({
  requireAdmin: (...args) => mocks.requireAdmin(...args),
  logActivity: (...args) => mocks.logActivity(...args),
}));
vi.mock('@/lib/clean-link', () => ({ cleanLink: value => value }));
vi.mock('@/lib/drip-feed', () => ({
  validateDripConfig: (...args) => mocks.validateDripConfig(...args),
  calculateIntradayDrip: vi.fn(() => null),
  calculateMultiDayDrip: (...args) => mocks.calculateMultiDayDrip(...args),
  getDripConfig: vi.fn(() => null),
  checkDripFeasibility: (...args) => mocks.checkDripFeasibility(...args),
  validateIntradayDuration: vi.fn(),
}));
vi.mock('@/lib/order-offer-display', () => ({
  buildOrderOfferSnapshot: () => ({
    serviceNameAtPurchase: 'Instagram Followers',
    tierNameAtPurchase: 'Budget',
    platformAtPurchase: 'Instagram',
    serviceTypeAtPurchase: 'followers',
  }),
}));
vi.mock('@/lib/order-queue', () => ({
  findOpenSameLinkOrder: (...args) => mocks.findOpenSameLinkOrder(...args),
}));
vi.mock('@/lib/telegram', () => ({
  tgNewOrder: (...args) => mocks.tgNewOrder(...args),
}));
vi.mock('@/lib/nitro-rewards', () => ({
  getNitroStatus: vi.fn(() => null),
  getEligibleSpendKoboTx: (...args) => mocks.getEligibleSpendKoboTx(...args),
}));
vi.mock('@/lib/account-deletion', () => ({
  lockOrderSettlementAccount: (...args) => mocks.lockOrderSettlementAccount(...args),
}));
vi.mock('@/lib/meta-capi', () => ({
  enqueueMetaEvent: (...args) => mocks.enqueueMetaEvent(...args),
  scheduleQueuedMetaEventDelivery: (...args) => mocks.scheduleQueuedMetaEventDelivery(...args),
}));

const { POST } = await import('@/app/api/admin/orders/create/route.js');

const user = {
  id: 'user-1',
  name: 'Deleting Customer',
  email: 'customer@example.test',
  balance: 5_000_000,
};

const tier = {
  id: 'tier-budget',
  tier: 'Budget',
  serviceId: 'service-1',
  enabled: true,
  min: 100,
  max: 50_000,
  sellPer1k: 100_000,
  service: {
    id: 'service-1',
    enabled: true,
    min: 100,
    max: 50_000,
    costPer1k: 1,
  },
  group: {
    name: 'Instagram Followers',
    platform: 'instagram',
    type: 'followers',
    enabled: true,
    tags: [],
  },
};

function request(body) {
  return new Request('https://nitro.test/api/admin/orders/create', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  prisma.$transaction.mockReset().mockImplementation(work => work(tx));
  mocks.requireAdmin.mockResolvedValue({ admin: { name: 'Soludo' }, error: null });
  mocks.userFindUnique.mockResolvedValue(user);
  mocks.settingFindUnique.mockResolvedValue({ value: '1600' });
  mocks.tierFindMany.mockResolvedValue([tier]);
  mocks.tierFindUnique.mockResolvedValue(tier);
  mocks.outerOrderFindMany.mockResolvedValue([]);
  mocks.txOrderFindMany.mockResolvedValue([]);
  mocks.findOpenSameLinkOrder.mockResolvedValue(null);
  mocks.getEligibleSpendKoboTx.mockResolvedValue(0);
  mocks.lockOrderSettlementAccount.mockResolvedValue(null);
  mocks.txOrderCreate.mockResolvedValue({ id: 'order-db-1', createdAt: new Date('2026-08-06T08:00:00.000Z') });
  mocks.txDripCreateMany.mockResolvedValue({ count: 3 });
  mocks.txLedgerCreate.mockResolvedValue({ id: 'ledger-1' });
  mocks.txExecuteRaw.mockResolvedValue(1);
  mocks.tgNewOrder.mockResolvedValue(undefined);
  mocks.logActivity.mockResolvedValue(undefined);
  mocks.validateDripConfig.mockReturnValue({ ok: true, config: { version: 1 } });
  mocks.checkDripFeasibility.mockReturnValue({ feasible: true });
  mocks.calculateMultiDayDrip.mockReturnValue({
    dispatches: [
      { day: 1, batch: 1, quantity: 400, scheduledAt: new Date('2026-08-06T08:00:00.000Z') },
      { day: 2, batch: 1, quantity: 300, scheduledAt: new Date('2026-08-07T08:00:00.000Z') },
      { day: 3, batch: 1, quantity: 300, scheduledAt: new Date('2026-08-08T08:00:00.000Z') },
    ],
  });
});

function expectNoOrderOrDebit() {
  expect(mocks.txExecuteRaw).not.toHaveBeenCalled();
  expect(mocks.txOrderCreate).not.toHaveBeenCalled();
  expect(mocks.txDripCreateMany).not.toHaveBeenCalled();
  expect(mocks.txLedgerCreate).not.toHaveBeenCalled();
  expect(mocks.tgNewOrder).not.toHaveBeenCalled();
}

describe('admin order creation account lifecycle guard', () => {
  it('rejects a charged bulk batch before debiting or creating any order', async () => {
    const response = await POST(request({
      mode: 'bulk',
      userId: user.id,
      charge: true,
      items: [{ tierId: tier.id, quantity: 1_000, links: ['https://instagram.com/p/bulk'] }],
    }));

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      error: 'This account is pending deletion and cannot receive new orders',
    });
    expect(mocks.lockOrderSettlementAccount).toHaveBeenCalledWith(tx, user.id);
    expectNoOrderOrDebit();
  });

  it('rejects a charged single order before debiting or creating it', async () => {
    const response = await POST(request({
      mode: 'single',
      userId: user.id,
      charge: true,
      tierId: tier.id,
      quantity: 1_000,
      link: 'https://instagram.com/p/single-charged',
    }));

    expect(response.status).toBe(409);
    expect(mocks.lockOrderSettlementAccount).toHaveBeenCalledWith(tx, user.id);
    expectNoOrderOrDebit();
  });

  it('also rejects a free single order instead of bypassing the account guard', async () => {
    const response = await POST(request({
      mode: 'single',
      userId: user.id,
      charge: false,
      tierId: tier.id,
      quantity: 1_000,
      link: 'https://instagram.com/p/single-free',
    }));

    expect(response.status).toBe(409);
    expect(mocks.lockOrderSettlementAccount).toHaveBeenCalledWith(tx, user.id);
    expectNoOrderOrDebit();
  });
});

describe('admin order creation success responses', () => {
  beforeEach(() => {
    mocks.lockOrderSettlementAccount.mockResolvedValue({ id: user.id, status: 'Active' });
  });

  it.each([
    ['single', {
      mode: 'single',
      userId: user.id,
      charge: true,
      tierId: tier.id,
      quantity: 1_000,
      link: 'https://instagram.com/p/single-success',
    }],
    ['drip', {
      mode: 'drip',
      userId: user.id,
      charge: true,
      tierId: tier.id,
      quantity: 1_000,
      link: 'https://instagram.com/p/drip-success',
      dripDays: 3,
    }],
  ])('returns 200 for a committed %s order when Telegram returns a promise', async (mode, body) => {
    const response = await POST(request(body));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      success: true,
      orderIds: ['NTR-1'],
    });
    expect(mocks.txOrderCreate).toHaveBeenCalledTimes(1);
    expect(mocks.tgNewOrder).toHaveBeenCalledTimes(1);
    expect(mocks.enqueueMetaEvent).toHaveBeenCalledWith(
      tx,
      'Purchase',
      expect.objectContaining({ eventId: 'purchase_NTR-1' }),
    );
    expect(mocks.scheduleQueuedMetaEventDelivery).toHaveBeenCalledWith('purchase_NTR-1');
    expect(prisma.$transaction.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.tgNewOrder.mock.invocationCallOrder[0],
    );
    if (mode === 'drip') expect(mocks.txDripCreateMany).toHaveBeenCalledTimes(1);
    else expect(mocks.txDripCreateMany).not.toHaveBeenCalled();
  });

  it('returns 200 for a committed bulk batch when Telegram returns a promise', async () => {
    const response = await POST(request({
      mode: 'bulk',
      userId: user.id,
      charge: true,
      items: [{ tierId: tier.id, quantity: 1_000, links: ['https://instagram.com/p/bulk-success'] }],
    }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      success: true,
      batchId: 'BULK-1',
      count: 1,
      orderIds: ['NTR-1'],
    });
    expect(mocks.txOrderCreate).toHaveBeenCalledTimes(1);
    expect(mocks.tgNewOrder).toHaveBeenCalledTimes(1);
    expect(mocks.enqueueMetaEvent).toHaveBeenCalledWith(
      tx,
      'Purchase',
      expect.objectContaining({ eventId: 'purchase_BULK-1' }),
    );
    expect(mocks.scheduleQueuedMetaEventDelivery).toHaveBeenCalledWith('purchase_BULK-1');
    expect(prisma.$transaction.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.tgNewOrder.mock.invocationCallOrder[0],
    );
  });

  it('does not enqueue a Purchase for an explicitly free admin order', async () => {
    const response = await POST(request({
      mode: 'single',
      userId: user.id,
      charge: false,
      tierId: tier.id,
      quantity: 1_000,
      link: 'https://instagram.com/p/single-free-success',
    }));

    expect(response.status).toBe(200);
    expect(mocks.enqueueMetaEvent).not.toHaveBeenCalled();
    expect(mocks.scheduleQueuedMetaEventDelivery).not.toHaveBeenCalled();
  });

  it('does not enqueue a Purchase for an explicitly free admin bulk batch', async () => {
    const response = await POST(request({
      mode: 'bulk',
      userId: user.id,
      charge: false,
      items: [{
        tierId: tier.id,
        quantity: 1_000,
        links: [
          'https://instagram.com/p/bulk-free-one',
          'https://instagram.com/p/bulk-free-two',
        ],
      }],
    }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      batchId: 'BULK-1',
      count: 2,
    });
    expect(mocks.txOrderCreate).toHaveBeenCalledTimes(2);
    expect(mocks.txLedgerCreate).not.toHaveBeenCalled();
    expect(mocks.enqueueMetaEvent).not.toHaveBeenCalled();
    expect(mocks.scheduleQueuedMetaEventDelivery).not.toHaveBeenCalled();
  });
});
