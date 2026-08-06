import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  orderFindMany: vi.fn(),
  orderFindFirst: vi.fn(),
  orderUpdateMany: vi.fn(),
  orderUpdate: vi.fn(),
  orderCount: vi.fn(),
  accountQueryRaw: vi.fn(),
  executeRaw: vi.fn(),
  transactionCreate: vi.fn(),
  transaction: vi.fn(),
  queryRawUnsafe: vi.fn(),
  idempotencyDeleteMany: vi.fn(),
  tgRefund: vi.fn(),
  tgRefundAlert: vi.fn(),
  voidCommissions: vi.fn(),
  refundEmail: vi.fn(),
  placeWithProvider: vi.fn(),
  checkOrder: vi.fn(),
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
    $queryRawUnsafe: (...args) => mocks.queryRawUnsafe(...args),
  },
}));
vi.mock('@/lib/logger', () => ({ log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
vi.mock('@/lib/smm', () => ({ checkOrder: (...args) => mocks.checkOrder(...args) }));
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

const { ORDER_SETTLEMENT_ACCOUNT_STATUSES } = await import('@/lib/account-deletion');
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
  mocks.accountQueryRaw.mockResolvedValue([{
    id: 'active-user',
    status: 'Active',
    deletedAt: null,
    anonymizedAt: null,
  }]);
  mocks.executeRaw.mockResolvedValue(1);
  mocks.transactionCreate.mockResolvedValue({ id: 'refund-transaction' });
  mocks.orderCount.mockResolvedValue(0);
  mocks.idempotencyDeleteMany.mockResolvedValue({ count: 0 });
  mocks.queryRawUnsafe.mockResolvedValue([]);
  mocks.transaction.mockImplementation(async callback => callback({
    order: { updateMany: mocks.orderUpdateMany },
    transaction: { create: mocks.transactionCreate },
    $queryRaw: mocks.accountQueryRaw,
    $executeRaw: mocks.executeRaw,
  }));
  global.fetch = vi.fn().mockResolvedValue(new Response('{}'));
});

afterAll(() => {
  if (originalSecret === undefined) delete process.env.CRON_SECRET;
  else process.env.CRON_SECRET = originalSecret;
  global.fetch = originalFetch;
});

describe('orders cron — queued and drip safety', () => {
  it('allows suspended accounts to settle while deletion states remain excluded', () => {
    expect(ORDER_SETTLEMENT_ACCOUNT_STATUSES).toEqual(['Active', 'Suspended']);
    expect(ORDER_SETTLEMENT_ACCOUNT_STATUSES).not.toContain('PendingDeletion');
    expect(ORDER_SETTLEMENT_ACCOUNT_STATUSES).not.toContain('Deleted');
  });

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
      user: {
        status: { in: ORDER_SETTLEMENT_ACCOUNT_STATUSES },
        deletedAt: null,
        anonymizedAt: null,
      },
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

    const settlementUserWhere = {
      status: { in: ORDER_SETTLEMENT_ACCOUNT_STATUSES },
      deletedAt: null,
      anonymizedAt: null,
    };
    const activeProviderOrders = calls.find(query => query.where?.apiOrderId?.not === null);
    const recoverySweep = calls.find(query => query.where?.refundedAt === null);
    expect(activeProviderOrders?.where.user).toEqual(settlementUserWhere);
    expect(recoverySweep?.where.user).toEqual(settlementUserWhere);
  });

  it('keeps provider progress and completion updates enabled for suspended accounts', async () => {
    const baseOrder = {
      userId: 'suspended-user',
      status: 'Processing',
      remains: 100,
      startCount: null,
      service: { provider: 'mtp', category: 'Instagram' },
      tier: null,
      batchId: null,
      charge: 10_000,
      cost: 5_000,
      quantity: 100,
    };
    mocks.orderFindMany.mockResolvedValueOnce([
      { ...baseOrder, id: 'progress-order', orderId: 'NTR-PROGRESS', apiOrderId: 'provider-1' },
      { ...baseOrder, id: 'completed-order', orderId: 'NTR-COMPLETED', apiOrderId: 'provider-2' },
    ]);
    mocks.checkOrder
      .mockResolvedValueOnce({ status: 'unknown', remains: 60 })
      .mockResolvedValueOnce({ status: 'Completed', remains: 0 });
    mocks.orderUpdateMany.mockResolvedValue({ count: 1 });

    const response = await GET(request());

    expect(response.status).toBe(200);
    const settlementUserWhere = {
      status: { in: ORDER_SETTLEMENT_ACCOUNT_STATUSES },
      deletedAt: null,
      anonymizedAt: null,
    };
    expect(mocks.orderUpdateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ id: 'progress-order', user: settlementUserWhere }),
      data: expect.objectContaining({ remains: 60 }),
    }));
    expect(mocks.orderUpdateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ id: 'completed-order', user: settlementUserWhere }),
      data: expect.objectContaining({ status: 'Completed' }),
    }));
  });

  it('auto-refunds a suspended account after an undispatched order exhausts retries', async () => {
    const staleCandidate = {
      id: 'suspended-order', orderId: 'NTR-SUSPENDED', userId: 'suspended-user',
      status: 'Pending', apiOrderId: null, queuedBehind: null, dripDays: null,
      charge: 100_000, nitroPointsRedeemedKobo: 0, retryCount: 5,
      createdAt: new Date('2026-07-16T08:00:00Z'),
      updatedAt: new Date('2026-07-17T08:00:00Z'),
    };
    mocks.orderFindMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([staleCandidate])
      .mockResolvedValueOnce([]);
    mocks.orderUpdateMany.mockResolvedValue({ count: 1 });
    mocks.accountQueryRaw.mockResolvedValueOnce([{
      id: 'suspended-user',
      status: 'Suspended',
      deletedAt: null,
      anonymizedAt: null,
    }]);

    const response = await GET(request());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.autoRefunded).toBe(1);
    expect(mocks.accountQueryRaw).toHaveBeenCalledTimes(1);
    expect(mocks.accountQueryRaw.mock.calls[0][1]).toBe('suspended-user');
    expect(mocks.executeRaw).toHaveBeenCalledTimes(1);
    expect(mocks.transactionCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'suspended-user',
        type: 'refund',
        amount: 100_000,
        reference: 'REF-NTR-SUSPENDED',
      }),
    });
    expect(mocks.tgRefund).toHaveBeenCalledWith('NTR-SUSPENDED', 100_000, 'dispatch_failed');
    expect(mocks.tgRefundAlert).toHaveBeenCalledTimes(1);
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
        user: {
          status: { in: ORDER_SETTLEMENT_ACCOUNT_STATUSES },
          deletedAt: null,
          anonymizedAt: null,
        },
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

  it.each([
    {
      label: 'pending deletion',
      account: { id: 'deleted-user', status: 'PendingDeletion', deletedAt: new Date('2026-08-12T08:00:00Z'), anonymizedAt: null },
    },
    {
      label: 'deleted status',
      account: { id: 'deleted-user', status: 'Deleted', deletedAt: new Date('2026-08-05T08:00:00Z'), anonymizedAt: null },
    },
    {
      label: 'anonymized account',
      account: { id: 'deleted-user', status: 'Active', deletedAt: null, anonymizedAt: new Date('2026-08-05T08:00:00Z') },
    },
  ])('does not terminalize or refund after a $label account wins the user lock', async ({ account }) => {
    const staleCandidate = {
      id: 'deleted-order', orderId: 'NTR-DELETED', userId: 'deleted-user',
      status: 'Pending', apiOrderId: null, queuedBehind: null, dripDays: null,
      charge: 100_000, nitroPointsRedeemedKobo: 0, retryCount: 5,
      createdAt: new Date('2026-07-16T08:00:00Z'),
      updatedAt: new Date('2026-07-17T08:00:00Z'),
    };
    mocks.orderFindMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([staleCandidate])
      .mockResolvedValueOnce([]);
    mocks.accountQueryRaw.mockResolvedValueOnce([account]);

    const response = await GET(request());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.autoRefunded).toBe(0);
    expect(mocks.accountQueryRaw).toHaveBeenCalledTimes(1);
    expect(mocks.accountQueryRaw.mock.calls[0][1]).toBe('deleted-user');
    const deletionUnsafeWrites = mocks.orderUpdateMany.mock.calls
      .map(([query]) => query)
      .filter(query => query.where?.id === 'deleted-order');
    expect(deletionUnsafeWrites).toHaveLength(0);
    expect(mocks.executeRaw).not.toHaveBeenCalled();
    expect(mocks.transactionCreate).not.toHaveBeenCalled();
    expect(mocks.tgRefund).not.toHaveBeenCalled();
    expect(mocks.tgRefundAlert).not.toHaveBeenCalled();
  });

  it('returns a raced provider active-order rejection to the queue instead of stranding it as Dispatching', async () => {
    const candidate = {
      id: 'order-child', orderId: 'NTR-3080', serviceId: 'service-8871',
      link: 'https://youtube.com/@thewargenerals', status: 'Pending', apiOrderId: null,
      queuedBehind: null, dripDays: null, retryCount: 0, dispatchedAt: null,
      createdAt: new Date('2026-07-17T17:05:07Z'),
      updatedAt: new Date('2026-07-28T08:00:00Z'),
      comments: null,
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
    mocks.queryRawUnsafe
      .mockResolvedValueOnce([]) // preloaded same-link blockers
      .mockResolvedValueOnce([{ id: 'order-child' }]); // atomic retry claim
    mocks.orderFindFirst.mockResolvedValueOnce({ orderId: 'NTR-2890' });
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

  it('preloads FIFO blockers once for the retry batch instead of querying per order', async () => {
    const createdAt = new Date('2026-07-28T08:00:00Z');
    const first = {
      id: 'order-first', orderId: 'NTR-FIRST', serviceId: 'service-1',
      link: 'https://x.com/nitro/status/1', status: 'Pending', apiOrderId: null,
      queuedBehind: null, dripDays: null, retryCount: 0, dispatchedAt: null,
      createdAt, updatedAt: createdAt, comments: null,
      service: { id: 'service-1', provider: 'mtp', apiId: 101 },
      tier: null,
    };
    const second = {
      ...first,
      id: 'order-second',
      orderId: 'NTR-SECOND',
      createdAt: new Date(createdAt.getTime() + 1000),
    };
    mocks.orderFindMany
      .mockResolvedValueOnce([]) // active provider orders
      .mockResolvedValueOnce([first, second]) // recent direct retries
      .mockResolvedValueOnce([]) // queued direct retries
      .mockResolvedValueOnce([]) // provider-active waits
      .mockResolvedValueOnce([]) // stale refund candidates
      .mockResolvedValueOnce([]); // unrefunded terminal orders
    mocks.queryRawUnsafe
      .mockResolvedValueOnce([
        { candidateId: 'order-second', blockerOrderId: 'NTR-FIRST' },
      ]) // one blocker preload
      .mockResolvedValueOnce([]); // first order loses its live atomic claim

    const response = await GET(request());

    expect(response.status).toBe(200);
    const blockerQueries = mocks.queryRawUnsafe.mock.calls
      .filter(([sql]) => sql.includes('WITH candidates'));
    expect(blockerQueries).toHaveLength(1);
    expect(blockerQueries[0][0]).toContain('JOIN LATERAL');
    expect(blockerQueries[0].slice(1)).toEqual([
      'order-first', 'service-1', 'https://x.com/nitro/status/1', first.createdAt,
      'order-second', 'service-1', 'https://x.com/nitro/status/1', second.createdAt,
    ]);
    const claimQueries = mocks.queryRawUnsafe.mock.calls
      .filter(([sql]) => sql.startsWith('UPDATE orders AS candidate'));
    expect(claimQueries).toHaveLength(1);
    expect(claimQueries[0][0]).toContain('AND NOT EXISTS (');
    expect(mocks.orderFindFirst).not.toHaveBeenCalled();
    expect(mocks.placeWithProvider).not.toHaveBeenCalled();
    expect(mocks.orderUpdateMany).toHaveBeenCalledWith({
      where: {
        id: 'order-first',
        status: 'Pending',
        apiOrderId: null,
        deletedAt: null,
        dripDays: null,
        dripDispatches: { none: {} },
        queuedBehind: null,
        updatedAt: first.updatedAt,
      },
      data: { lastError: 'provider_active_wait' },
    });
    expect(mocks.orderUpdateMany).toHaveBeenCalledWith({
      where: {
        id: 'order-second',
        status: 'Pending',
        apiOrderId: null,
        deletedAt: null,
        dripDays: null,
        dripDispatches: { none: {} },
        queuedBehind: null,
        updatedAt: second.updatedAt,
      },
      data: { queuedBehind: 'NTR-FIRST' },
    });
  });
});
