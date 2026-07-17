import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  orderFindMany: vi.fn(),
  orderFindFirst: vi.fn(),
  orderUpdateMany: vi.fn(),
  orderUpdate: vi.fn(),
  orderCount: vi.fn(),
  transaction: vi.fn(),
  idempotencyDeleteMany: vi.fn(),
  tgRefund: vi.fn(),
  tgRefundAlert: vi.fn(),
  voidCommissions: vi.fn(),
  refundEmail: vi.fn(),
  placeWithProvider: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  default: {
    order: {
      findMany: (...args) => mocks.orderFindMany(...args),
      findFirst: (...args) => mocks.orderFindFirst(...args),
      updateMany: (...args) => mocks.orderUpdateMany(...args),
      update: (...args) => mocks.orderUpdate(...args),
      count: (...args) => mocks.orderCount(...args),
    },
    idempotencyKey: { deleteMany: (...args) => mocks.idempotencyDeleteMany(...args) },
    $transaction: (...args) => mocks.transaction(...args),
  },
}));
vi.mock('@/lib/logger', () => ({ log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
vi.mock('@/lib/smm', () => ({ checkOrder: vi.fn() }));
vi.mock('@/lib/email', () => ({
  sendEmail: (...args) => mocks.refundEmail(...args),
  walletCreditEmail: vi.fn(),
  batchCompletionEmail: vi.fn(),
}));
vi.mock('@/lib/bulk-dispatch', () => ({ placeWithProvider: (...args) => mocks.placeWithProvider(...args) }));
vi.mock('@/lib/telegram', () => ({
  tgRefund: (...args) => mocks.tgRefund(...args),
  tgOrderCancelled: vi.fn(),
  tgRefundAlert: (...args) => mocks.tgRefundAlert(...args),
}));
vi.mock('@/lib/commissions', () => ({
  createCommission: vi.fn(),
  voidCommissions: (...args) => mocks.voidCommissions(...args),
}));
vi.mock('@/lib/nitro-rewards', () => ({
  reverseOrderPoints: vi.fn(),
  computeRefundSplit: (charge) => ({ walletRefund: charge, pointsRestore: 0 }),
  getTotalRefundedKobo: vi.fn().mockResolvedValue(0),
  awardPointsOnCompletion: vi.fn(),
}));

const { GET } = await import('@/app/api/cron/orders/route');
const originalSecret = process.env.CRON_SECRET;
const originalFetch = global.fetch;

function request() {
  return {
    url: 'https://nitro.test/api/cron/orders',
    headers: new Headers({ authorization: 'Bearer cron-secret' }),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  for (const mock of Object.values(mocks)) mock.mockReset();
  process.env.CRON_SECRET = 'cron-secret';
  mocks.orderFindMany.mockResolvedValue([]);
  mocks.orderFindFirst.mockResolvedValue(null);
  mocks.orderUpdateMany.mockResolvedValue({ count: 0 });
  mocks.orderCount.mockResolvedValue(0);
  mocks.idempotencyDeleteMany.mockResolvedValue({ count: 0 });
  mocks.transaction.mockImplementation(async callback => callback({
    order: { updateMany: mocks.orderUpdateMany },
  }));
  global.fetch = vi.fn().mockResolvedValue(new Response('{}'));
});

afterAll(() => {
  if (originalSecret === undefined) delete process.env.CRON_SECRET;
  else process.env.CRON_SECRET = originalSecret;
  global.fetch = originalFetch;
});

describe('orders cron — queued and drip safety', () => {
  it('keeps queued orders retryable at any age and limits stale refunds to unqueued direct orders', async () => {
    const response = await GET(request());
    expect(response.status).toBe(200);

    const calls = mocks.orderFindMany.mock.calls.map(([query]) => query);
    const queuedRetry = calls.find(query => query.where?.queuedBehind?.not === null);
    expect(queuedRetry).toBeDefined();
    expect(queuedRetry.where.createdAt).toBeUndefined();
    expect(queuedRetry.where.dripDays).toBeNull();
    expect(queuedRetry.where.dripDispatches).toEqual({ none: {} });

    const stale = calls.find(query => query.where?.AND?.some?.(group => group.OR?.some?.(arm => arm.retryCount?.gte === 5)));
    expect(stale).toBeDefined();
    expect(stale.where).toMatchObject({
      status: 'Pending',
      apiOrderId: null,
      deletedAt: null,
      queuedBehind: null,
      dripDays: null,
      dripDispatches: { none: {} },
    });
    const ageWindow = stale.where.AND.find(group => group.OR?.some?.(arm => arm.retryCount?.gte === 5));
    expect(ageWindow.OR).toEqual([
      { retryCount: { gte: 5 }, createdAt: { lt: expect.any(Date) } },
      { createdAt: { lt: expect.any(Date) } },
    ]);
    expect(stale.where.AND).toContainEqual({
      OR: [{ lastError: null }, { lastError: { not: 'provider_active_wait' } }],
    });
  });

  it('does not refund or notify when an admin retry changes the stale-order snapshot', async () => {
    const staleUpdatedAt = new Date('2026-07-17T08:00:00Z');
    const staleCandidate = {
      id: 'order-race', orderId: 'NTR-RACE', userId: 'user-1',
      status: 'Pending', apiOrderId: null, queuedBehind: null, dripDays: null,
      charge: 100_000, nitroPointsRedeemedKobo: 0, retryCount: 5,
      createdAt: new Date('2026-07-16T08:00:00Z'), updatedAt: staleUpdatedAt,
    };
    mocks.orderFindMany
      .mockResolvedValueOnce([]) // active provider orders
      .mockResolvedValueOnce([]) // recent direct retries
      .mockResolvedValueOnce([]) // queued direct retries
      .mockResolvedValueOnce([]) // provider-active waits
      .mockResolvedValueOnce([staleCandidate]) // stale refund candidates
      .mockResolvedValueOnce([]); // unrefunded terminal orders
    mocks.orderUpdateMany.mockResolvedValue({ count: 0 });

    const response = await GET(request());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.autoRefunded).toBe(0);
    expect(mocks.orderUpdateMany).toHaveBeenCalledWith({
      where: {
        id: 'order-race',
        status: 'Pending',
        apiOrderId: null,
        deletedAt: null,
        queuedBehind: null,
        dripDays: null,
        dripDispatches: { none: {} },
        updatedAt: staleUpdatedAt,
        AND: [
          {
            OR: [
              { retryCount: { gte: 5 }, createdAt: { lt: expect.any(Date) } },
              { createdAt: { lt: expect.any(Date) } },
            ],
          },
          { OR: [{ lastError: null }, { lastError: { not: 'provider_active_wait' } }] },
        ],
      },
      data: { status: 'Cancelled', lastError: 'dispatch_failed', refundedAt: expect.any(Date) },
    });
    expect(mocks.tgRefund).not.toHaveBeenCalled();
    expect(mocks.tgRefundAlert).not.toHaveBeenCalled();
    expect(mocks.voidCommissions).not.toHaveBeenCalled();
    expect(mocks.refundEmail).not.toHaveBeenCalled();
  });

  it('returns a raced provider active-order rejection to the queue instead of stranding it as Dispatching', async () => {
    const candidate = {
      id: 'order-child', orderId: 'NTR-3080', serviceId: 'service-8871',
      link: 'https://youtube.com/@thewargenerals', status: 'Pending', apiOrderId: null,
      queuedBehind: null, dripDays: null, retryCount: 0, dispatchedAt: null,
      createdAt: new Date('2026-07-17T17:05:07Z'), comments: null,
      service: { id: 'service-8871', provider: 'mtp', apiId: 8871 },
      tier: null,
    };
    mocks.orderFindMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([candidate])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);
    mocks.orderFindFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ orderId: 'NTR-2890' });
    mocks.orderUpdateMany
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValue({ count: 0 });
    mocks.placeWithProvider.mockRejectedValueOnce(new Error('You have active order with this link.'));

    const response = await GET(request());

    expect(response.status).toBe(200);
    expect(mocks.orderUpdateMany).toHaveBeenCalledWith({
      where: { id: 'order-child', status: 'Dispatching', apiOrderId: null },
      data: {
        status: 'Pending',
        dispatchedAt: null,
        queuedBehind: 'NTR-2890',
        lastError: 'provider_active_wait',
        retryCount: 0,
      },
    });
  });
});
