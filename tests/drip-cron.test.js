import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockDripDispatch = { findMany: vi.fn(), findFirst: vi.fn(), update: vi.fn(), updateMany: vi.fn() };
const mockOrder = { findMany: vi.fn(), findFirst: vi.fn(), findUnique: vi.fn(), update: vi.fn(), updateMany: vi.fn() };
const mockAdminIssue = { create: vi.fn().mockReturnValue({ catch: () => {} }) };
const mockExecuteRawUnsafe = vi.fn();
const mockQueryRaw = vi.fn();

const mockPrisma = {
  dripDispatch: mockDripDispatch,
  order: mockOrder,
  adminIssue: mockAdminIssue,
  $executeRawUnsafe: mockExecuteRawUnsafe,
  $queryRaw: mockQueryRaw,
  $transaction: vi.fn(async (cb) => cb(mockPrisma)),
};

vi.mock('@/lib/prisma', () => ({ default: mockPrisma }));
vi.mock('@/lib/logger', () => ({ log: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }));
vi.mock('@/lib/smm', () => ({ placeOrder: vi.fn(), checkOrder: vi.fn(), checkOrders: vi.fn() }));
vi.mock('@/lib/telegram', () => ({ tgDripTimeout: vi.fn() }));
vi.mock('@/lib/drip-feed', async () => {
  const actual = await vi.importActual('@/lib/drip-feed');
  return { ...actual, getDripConfig: () => ({ intervalHours: 2 }) };
});
vi.mock('@/lib/nitro-rewards', () => ({ awardPointsOnCompletion: vi.fn().mockResolvedValue(0) }));

function makeReq(secret = 'test-secret') {
  return {
    url: `http://localhost/api/cron/drip?secret=${secret}`,
    headers: new Map([['authorization', `Bearer ${secret}`]]),
  };
}

beforeEach(async () => {
  vi.clearAllMocks();
  for (const mock of Object.values(mockDripDispatch)) mock.mockReset();
  for (const mock of Object.values(mockOrder)) mock.mockReset();
  mockAdminIssue.create.mockReset().mockReturnValue({ catch: () => {} });
  mockExecuteRawUnsafe.mockReset();
  mockQueryRaw.mockReset().mockResolvedValue([]);
  const { placeOrder, checkOrder, checkOrders } = await import('@/lib/smm');
  placeOrder.mockReset();
  checkOrder.mockReset();
  checkOrders.mockReset();
  const { awardPointsOnCompletion } = await import('@/lib/nitro-rewards');
  awardPointsOnCompletion.mockReset().mockResolvedValue(0);
  process.env.CRON_SECRET = 'test-secret';

  // Default: no stale/stuck/due/processing dispatches, no drip orders
  mockDripDispatch.updateMany.mockResolvedValue({ count: 0 });
  mockDripDispatch.findMany.mockResolvedValue([]);
  mockOrder.findMany.mockResolvedValue([]);
  mockOrder.findFirst.mockResolvedValue(null);
  mockOrder.findUnique.mockResolvedValue({ queuedBehind: null });
  mockOrder.updateMany.mockResolvedValue({ count: 1 });
  mockExecuteRawUnsafe.mockResolvedValue(0);
});

describe('drip cron — section 2 in-flight filter', () => {
  it('excludes dispatches whose order has an in-flight batch from the due query', async () => {
    mockDripDispatch.findMany
      .mockResolvedValueOnce([]) // section 1: stuck dispatching
      .mockResolvedValueOnce([]) // section 1.3: stale cancelling
      .mockResolvedValueOnce([]) // section 2: due dispatches (none returned)
      .mockResolvedValueOnce([]); // section 3: processing
    mockOrder.findMany
      .mockResolvedValueOnce([]) // section 1.5: queued orders to release
      .mockResolvedValue([]);    // section 4: rollup

    const { GET } = await import('@/app/api/cron/drip/route');
    await GET(makeReq());

    const dueCall = mockDripDispatch.findMany.mock.calls[2];
    expect(dueCall).toBeDefined();
    const where = dueCall[0].where;

    expect(where.status).toBe('pending');
    expect(where.apiOrderId).toBeNull();
    expect(where.scheduledAt).toEqual({ lte: expect.any(Date) });
    expect(where.order).toEqual({
      status: { in: ['Pending', 'Processing'] },
      deletedAt: null,
      queuedBehind: null,
      dripDispatches: {
        none: { status: { in: ['dispatching', 'processing', 'verifying', 'cancelling'] } },
      },
    });
  });

  it('still runs in-loop in-flight guard as a race safety net', async () => {
    const { placeOrder } = await import('@/lib/smm');

    const fakeDispatch = {
      id: 'disp-race', orderId: 'ord-race', batch: 1, quantity: 100,
      scheduledAt: new Date(Date.now() - 60000),
      order: { id: 'ord-race', orderId: 'ORD-RACE', status: 'Processing', deletedAt: null, comments: null, link: 'http://example.com', service: { provider: 'mtp', apiId: 123, apiType: 'Default' } },
    };

    mockDripDispatch.findMany
      .mockResolvedValueOnce([])            // section 1
      .mockResolvedValueOnce([])            // section 1.3: stale cancelling
      .mockResolvedValueOnce([fakeDispatch]) // section 2: dispatch passed DB filter
      .mockResolvedValueOnce([]);            // section 3
    mockOrder.findFirst.mockResolvedValueOnce(null);
    mockDripDispatch.findFirst
      .mockResolvedValueOnce({ id: 'disp-race' })
      .mockResolvedValueOnce({ id: 'other-batch', status: 'processing' });
    mockOrder.findMany.mockResolvedValue([]);

    const { GET } = await import('@/app/api/cron/drip/route');
    const res = await GET(makeReq());
    const body = await res.json();

    expect(body.stats.dispatched).toBe(0);
    expect(placeOrder).not.toHaveBeenCalled();
    expect(mockDripDispatch.findFirst).toHaveBeenLastCalledWith({
      where: { orderId: 'ord-race', status: { in: ['dispatching', 'processing', 'verifying', 'cancelling'] } },
    });
  });
});

describe('drip cron — same-link queue safety', () => {
  function dueDispatch(overrides = {}) {
    return {
      id: 'disp-queued', orderId: 'order-queued', day: 1, batch: 1, quantity: 204,
      status: 'pending', scheduledAt: new Date(Date.now() - 60_000),
      order: {
        id: 'order-queued', orderId: 'NTR-2913', serviceId: 'service-8871',
        link: 'https://youtube.com/@thewargenerals', status: 'Pending',
        queuedBehind: 'NTR-2890', dripDelivered: 0, createdAt: new Date('2026-07-16T10:44:58Z'),
        deletedAt: null, comments: null,
        service: { provider: 'mtp', apiId: 8871, apiType: 'Default' },
        ...overrides,
      },
    };
  }

  function setupDue(dispatch) {
    mockDripDispatch.findMany
      .mockResolvedValueOnce([])           // section 1: stuck dispatching
      .mockResolvedValueOnce([])           // section 1.3: stale cancelling
      .mockResolvedValueOnce([dispatch])   // section 2: due dispatches
      .mockResolvedValueOnce([]);          // section 3: processing
    mockOrder.findMany.mockResolvedValue([]);
  }

  it('keeps a due drip batch queued while an earlier same-link order is active', async () => {
    const { placeOrder } = await import('@/lib/smm');
    setupDue(dueDispatch());
    mockOrder.findFirst.mockResolvedValueOnce({ orderId: 'NTR-2890' });

    const { GET } = await import('@/app/api/cron/drip/route');
    const res = await GET(makeReq());

    expect(res.status).toBe(200);
    expect(placeOrder).not.toHaveBeenCalled();
    expect(mockOrder.update).not.toHaveBeenCalled();
    expect(mockOrder.updateMany).not.toHaveBeenCalled();
    expect(mockDripDispatch.updateMany).toHaveBeenCalledTimes(2); // stale-expiry + stale-verifying sweeps
  });

  it('turns a provider active-order response back into a pending queued batch', async () => {
    const { placeOrder } = await import('@/lib/smm');
    const { tgDripTimeout } = await import('@/lib/telegram');
    setupDue(dueDispatch({ queuedBehind: null }));
    mockOrder.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ orderId: 'NTR-2890' });
    mockDripDispatch.findFirst
      .mockResolvedValueOnce({ id: 'disp-queued' })
      .mockResolvedValueOnce(null);
    mockDripDispatch.updateMany
      .mockResolvedValueOnce({ count: 0 })  // section 0 stale-expiry
      .mockResolvedValueOnce({ count: 0 })  // section 1.25 stale-verifying
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 1 });
    placeOrder.mockRejectedValueOnce(new Error('You have active order with this link. Please wait until order being completed.'));

    const { GET } = await import('@/app/api/cron/drip/route');
    const res = await GET(makeReq());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.stats.dispatchFailed).toBe(1);
    expect(mockDripDispatch.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'disp-queued',
        status: 'dispatching',
        order: { status: { in: ['Pending', 'Processing'] }, deletedAt: null },
      },
      data: {
        status: 'pending',
        lastError: null,
        dispatchedAt: null,
        scheduledAt: expect.any(Date),
      },
    });
    expect(mockOrder.updateMany).toHaveBeenCalledWith({
      where: { id: 'order-queued', status: { in: ['Pending', 'Processing'] }, deletedAt: null },
      data: { status: 'Pending', queuedBehind: 'NTR-2890' },
    });
    expect(mockAdminIssue.create).not.toHaveBeenCalled();
    expect(tgDripTimeout).not.toHaveBeenCalled();
  });

  it('clears queuedBehind once the delayed batch is accepted', async () => {
    const { placeOrder } = await import('@/lib/smm');
    setupDue(dueDispatch());
    mockOrder.findFirst.mockResolvedValueOnce(null);
    mockDripDispatch.findFirst
      .mockResolvedValueOnce({ id: 'disp-queued' })
      .mockResolvedValueOnce(null);
    mockDripDispatch.updateMany
      .mockResolvedValueOnce({ count: 0 })  // section 0 stale-expiry
      .mockResolvedValueOnce({ count: 0 })  // section 1.25 stale-verifying
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 1 });
    placeOrder.mockResolvedValueOnce({ order: 4199999 });

    const { GET } = await import('@/app/api/cron/drip/route');
    const res = await GET(makeReq());

    expect(res.status).toBe(200);
    expect(mockOrder.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'order-queued',
        status: { in: ['Pending', 'Processing'] },
        deletedAt: null,
        queuedBehind: 'NTR-2890',
      },
      data: { queuedBehind: null },
    });
    expect(mockOrder.updateMany).toHaveBeenCalledWith({
      where: { id: 'order-queued', status: { in: ['Pending', 'Processing'] }, deletedAt: null },
      data: { dripDelivered: { increment: 1 }, status: 'Processing', queuedBehind: null },
    });
  });

  it('does not resurrect a parent cancelled while the provider request was in flight', async () => {
    const { placeOrder } = await import('@/lib/smm');
    setupDue(dueDispatch({ queuedBehind: null }));
    mockOrder.findFirst.mockResolvedValueOnce(null);
    mockDripDispatch.findFirst
      .mockResolvedValueOnce({ id: 'disp-queued' })
      .mockResolvedValueOnce(null);
    mockDripDispatch.updateMany
      .mockResolvedValueOnce({ count: 0 })  // section 0 stale-expiry
      .mockResolvedValueOnce({ count: 0 })  // section 1.25 stale-verifying
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 0 });
    placeOrder.mockResolvedValueOnce({ order: 4200000 });

    const { GET } = await import('@/app/api/cron/drip/route');
    const res = await GET(makeReq());

    expect(res.status).toBe(200);
    expect(mockOrder.updateMany).not.toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: 'Processing' }),
    }));
    expect(mockAdminIssue.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        type: 'ghost_dispatch',
        title: expect.stringContaining('provider accepted after local cancellation'),
      }),
    });
  });
});

describe('drip cron — section 3 reschedule (set-based UPDATE)', () => {
  it('reschedules pending dispatches with a single UPDATE FROM VALUES', async () => {
    const { checkOrder } = await import('@/lib/smm');

    mockDripDispatch.findMany
      .mockResolvedValueOnce([]) // stuck dispatching (section 1)
      .mockResolvedValueOnce([]) // section 1.3: stale cancelling
      .mockResolvedValueOnce([]) // due dispatches (section 2)
      .mockResolvedValueOnce([ // processing dispatches (section 3)
        {
          id: 'disp-1', apiOrderId: 'api-1', status: 'processing', quantity: 100, remains: 100,
          dispatchedAt: new Date(), orderId: 'ord-1', startCount: null, lastError: null,
          order: { id: 'ord-1', orderId: 'ORD-1', service: { provider: 'mtp', name: 'IG Followers', category: 'instagram' } },
        },
      ]);

    checkOrder.mockResolvedValue({ status: 'Completed', remains: 0, start_count: 500 });

    mockDripDispatch.updateMany
      .mockResolvedValueOnce({ count: 0 })  // section 0 stale-expiry
      .mockResolvedValueOnce({ count: 0 })  // section 1.25 stale-verifying
      .mockResolvedValueOnce({ count: 1 }); // section 3 CAS transition

    // After sync completes, pending dispatches to reschedule
    mockDripDispatch.findMany
      .mockResolvedValueOnce([ // pending dispatches after completion
        { id: 'disp-2', batch: 2, scheduledAt: new Date(Date.now() - 1000) },
        { id: 'disp-3', batch: 3, scheduledAt: new Date(Date.now() - 500) },
      ]);

    // Section 4: no drip orders
    mockOrder.findMany.mockResolvedValue([]);

    const { GET } = await import('@/app/api/cron/drip/route');
    const res = await GET(makeReq());
    const body = await res.json();

    expect(body.ok).toBe(true);
    expect(mockExecuteRawUnsafe).toHaveBeenCalledTimes(1);

    const [sql, ...params] = mockExecuteRawUnsafe.mock.calls[0];
    expect(sql).toContain('UPDATE "drip_dispatches"');
    expect(sql).toContain('"updatedAt" = NOW()');
    expect(sql).toContain('FROM (VALUES');
    expect(sql).toContain('AS v(id,t)');
    expect(params).toHaveLength(4); // 2 dispatches × 2 params
    expect(params[0]).toBe('disp-2');
    expect(params[1]).toBeInstanceOf(Date);
    expect(params[2]).toBe('disp-3');
    expect(params[3]).toBeInstanceOf(Date);
    // Second dispatch should be scheduled later than first
    expect(params[3].getTime()).toBeGreaterThan(params[1].getTime());
  });
});

describe('drip cron — batched processing sync', () => {
  it('uses one provider request and one fenced progress update for multiple dispatches', async () => {
    const { checkOrder, checkOrders } = await import('@/lib/smm');
    const processing = [
      {
        id: 'disp-batch-1', apiOrderId: 'api-batch-1', status: 'processing',
        quantity: 100, remains: 100, startCount: null, dispatchedAt: new Date(),
        orderId: 'ord-batch-1', lastError: null,
        order: { id: 'ord-batch-1', orderId: 'NTR-B1', service: { provider: 'mtp' } },
      },
      {
        id: 'disp-batch-2', apiOrderId: 'api-batch-2', status: 'processing',
        quantity: 200, remains: 200, startCount: null, dispatchedAt: new Date(),
        orderId: 'ord-batch-2', lastError: null,
        order: { id: 'ord-batch-2', orderId: 'NTR-B2', service: { provider: 'mtp' } },
      },
    ];
    mockDripDispatch.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce(processing);
    mockOrder.findMany.mockResolvedValue([]);
    checkOrders.mockResolvedValueOnce({
      'api-batch-1': { status: 'Processing', remains: 80, start_count: 1000 },
      'api-batch-2': { status: 'Processing', remains: 150, start_count: 2000 },
    });
    mockExecuteRawUnsafe.mockResolvedValueOnce(2);

    const { GET } = await import('@/app/api/cron/drip/route');
    const response = await GET(makeReq());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(checkOrders).toHaveBeenCalledTimes(1);
    expect(checkOrders).toHaveBeenCalledWith('mtp', ['api-batch-1', 'api-batch-2']);
    expect(checkOrder).not.toHaveBeenCalled();
    expect(body.stats.synced).toBe(2);

    const processingQuery = mockDripDispatch.findMany.mock.calls[3][0];
    expect(processingQuery.where.order).toEqual({
      status: { in: ['Pending', 'Processing'] },
      deletedAt: null,
    });

    const [sql, ...params] = mockExecuteRawUnsafe.mock.calls[0];
    expect(sql).toContain('UPDATE "drip_dispatches" AS d');
    expect(sql).toContain("d.status = 'processing'");
    expect(sql).toContain('d."apiOrderId" = v.api_order_id');
    expect(sql).toContain("o.status IN ('Pending', 'Processing')");
    expect(sql).toContain('o."deletedAt" IS NULL');
    expect(params).toEqual([
      'disp-batch-1', 'api-batch-1', 100, 80, 1000,
      'disp-batch-2', 'api-batch-2', 200, 150, 2000,
    ]);
  });

  it('persists a new start count even when provider remains is unchanged', async () => {
    const { checkOrder } = await import('@/lib/smm');
    mockDripDispatch.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          id: 'disp-start', apiOrderId: 'api-start', status: 'processing',
          quantity: 100, remains: 75, startCount: null, dispatchedAt: new Date(),
          orderId: 'ord-start', lastError: null,
          order: { id: 'ord-start', orderId: 'NTR-START', service: { provider: 'mtp' } },
        },
      ]);
    mockOrder.findMany.mockResolvedValue([]);
    checkOrder.mockResolvedValueOnce({
      status: 'Processing',
      remains: 75,
      start_count: 987,
    });
    mockExecuteRawUnsafe.mockResolvedValueOnce(1);

    const { GET } = await import('@/app/api/cron/drip/route');
    const response = await GET(makeReq());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.stats.synced).toBe(1);
    const [, ...params] = mockExecuteRawUnsafe.mock.calls[0];
    expect(params).toEqual(['disp-start', 'api-start', 75, null, 987]);
    expect(mockExecuteRawUnsafe.mock.calls[0][0]).toContain(
      'd."remains" IS NOT DISTINCT FROM v.observed_remains',
    );
  });

  it('isolates malformed provider counts instead of rejecting valid rows in the batch', async () => {
    const { checkOrders } = await import('@/lib/smm');
    mockDripDispatch.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          id: 'disp-valid', apiOrderId: 'api-valid', status: 'processing',
          quantity: 100, remains: 100, startCount: null, dispatchedAt: new Date(),
          orderId: 'ord-valid', lastError: null,
          order: { id: 'ord-valid', orderId: 'NTR-VALID', service: { provider: 'mtp' } },
        },
        {
          id: 'disp-invalid', apiOrderId: 'api-invalid', status: 'processing',
          quantity: 100, remains: 100, startCount: null, dispatchedAt: new Date(),
          orderId: 'ord-invalid', lastError: null,
          order: { id: 'ord-invalid', orderId: 'NTR-INVALID', service: { provider: 'mtp' } },
        },
      ]);
    mockOrder.findMany.mockResolvedValue([]);
    checkOrders.mockResolvedValueOnce({
      'api-valid': { status: 'Processing', remains: 80, start_count: 500 },
      'api-invalid': { status: 'Processing', remains: 'N/A', start_count: 1.5 },
    });
    mockExecuteRawUnsafe.mockResolvedValueOnce(1);

    const { GET } = await import('@/app/api/cron/drip/route');
    const response = await GET(makeReq());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.stats.synced).toBe(1);
    expect(mockExecuteRawUnsafe).toHaveBeenCalledTimes(1);
    const [, ...params] = mockExecuteRawUnsafe.mock.calls[0];
    expect(params).toEqual(['disp-valid', 'api-valid', 100, 80, 500]);
  });

  it('isolates a failed provider group while applying another provider response', async () => {
    const { checkOrder } = await import('@/lib/smm');
    mockDripDispatch.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          id: 'disp-mtp', apiOrderId: 'api-mtp', status: 'processing',
          quantity: 100, remains: 100, startCount: null, dispatchedAt: new Date(),
          orderId: 'ord-mtp', lastError: null,
          order: { id: 'ord-mtp', orderId: 'NTR-MTP', service: { provider: 'mtp' } },
        },
        {
          id: 'disp-jap', apiOrderId: 'api-jap', status: 'processing',
          quantity: 100, remains: 100, startCount: null, dispatchedAt: new Date(),
          orderId: 'ord-jap', lastError: null,
          order: { id: 'ord-jap', orderId: 'NTR-JAP', service: { provider: 'jap' } },
        },
      ]);
    mockOrder.findMany.mockResolvedValue([]);
    checkOrder.mockImplementation((provider) => provider === 'mtp'
      ? Promise.reject(new Error('MTP unavailable'))
      : Promise.resolve({ status: 'Processing', remains: 70 }));
    mockExecuteRawUnsafe.mockResolvedValueOnce(1);

    const { GET } = await import('@/app/api/cron/drip/route');
    const response = await GET(makeReq());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.stats.synced).toBe(1);
    expect(checkOrder).toHaveBeenCalledTimes(2);
    const [, ...params] = mockExecuteRawUnsafe.mock.calls[0];
    expect(params).toEqual(['disp-jap', 'api-jap', 100, 70, null]);
  });
});

describe('drip cron — section 4 rollup', () => {
  function setupEmpty() {
    // Sections 0-3 produce nothing
    mockDripDispatch.findMany.mockResolvedValue([]);
  }

  it('rolls up all-done orders via transactional applyDripRollup', async () => {
    setupEmpty();
    const dispatches = [
      { status: 'completed', quantity: 100, remains: 0, startCount: 500, day: 1, batch: 1 },
      { status: 'completed', quantity: 100, remains: 0, startCount: null, day: 1, batch: 2 },
    ];
    mockOrder.findMany.mockResolvedValue([{ id: 'ord-1', startCount: null, dripDispatches: dispatches }]);
    mockQueryRaw
      .mockResolvedValueOnce([{ id: 'ord-1', status: 'Processing', deletedAt: null }])
      .mockResolvedValueOnce(dispatches);

    const { GET } = await import('@/app/api/cron/drip/route');
    const res = await GET(makeReq());
    const body = await res.json();

    expect(body.ok).toBe(true);
    expect(body.stats.rolledUp).toBe(1);
    expect(mockExecuteRawUnsafe).not.toHaveBeenCalled();
    expect(mockOrder.updateMany).toHaveBeenCalledWith({
      where: { id: 'ord-1', status: { notIn: ['Cancelled', 'Completed', 'Partial'] }, deletedAt: null },
      data: { remains: 0, status: 'Completed', completedAt: expect.any(Date), startCount: 500 },
    });
  });

  it('uses null status for in-progress orders (preserves existing via COALESCE)', async () => {
    setupEmpty();

    mockOrder.findMany.mockResolvedValue([
      {
        id: 'ord-2', remains: 100, startCount: null,
        dripDispatches: [
          { status: 'completed', quantity: 100, remains: 0, startCount: 500, day: 1, batch: 1 },
          { status: 'processing', quantity: 100, remains: 60, startCount: null, day: 1, batch: 2 },
        ],
      },
    ]);

    const { GET } = await import('@/app/api/cron/drip/route');
    const res = await GET(makeReq());
    const body = await res.json();

    expect(body.stats.rolledUp).toBe(0);
    expect(mockExecuteRawUnsafe).toHaveBeenCalledTimes(1);
    const [sql, ...params] = mockExecuteRawUnsafe.mock.calls[0];
    expect(sql).toContain('"orders"."remains" IS NOT DISTINCT FROM v.observed_r');
    expect(sql).toContain('"orders"."startCount" IS NULL');
    expect(params[0]).toBe('ord-2');
    expect(params[1]).toBe(100); // observed remains
    expect(params[2]).toBe(60); // next remains
    expect(params[3]).toBe(500); // startCount
  });

  it('sets Partial status when mix of completed and failed', async () => {
    setupEmpty();
    const dispatches = [
      { status: 'completed', quantity: 100, remains: 0, startCount: 200, day: 1, batch: 1 },
      { status: 'failed', quantity: 100, remains: 100, startCount: null, day: 1, batch: 2 },
    ];
    mockOrder.findMany.mockResolvedValue([{ id: 'ord-3', startCount: 100, dripDispatches: dispatches }]);
    mockQueryRaw
      .mockResolvedValueOnce([{ id: 'ord-3', status: 'Processing', deletedAt: null }])
      .mockResolvedValueOnce(dispatches);

    const { GET } = await import('@/app/api/cron/drip/route');
    const res = await GET(makeReq());
    const body = await res.json();

    expect(body.stats.rolledUp).toBe(1);
    expect(mockExecuteRawUnsafe).not.toHaveBeenCalled();
    expect(mockOrder.updateMany).toHaveBeenCalledWith({
      where: { id: 'ord-3', status: { notIn: ['Cancelled', 'Completed', 'Partial'] }, deletedAt: null },
      data: { remains: 100, status: 'Partial', completedAt: expect.any(Date), startCount: 200 },
    });
  });

  it('sets Cancelled when all dispatches failed', async () => {
    setupEmpty();
    const dispatches = [
      { status: 'failed', quantity: 100, remains: 100, startCount: null, day: 1, batch: 1 },
      { status: 'failed', quantity: 100, remains: 100, startCount: null, day: 1, batch: 2 },
    ];
    mockOrder.findMany.mockResolvedValue([{ id: 'ord-4', startCount: null, dripDispatches: dispatches }]);
    mockQueryRaw
      .mockResolvedValueOnce([{ id: 'ord-4', status: 'Processing', deletedAt: null }])
      .mockResolvedValueOnce(dispatches);

    const { GET } = await import('@/app/api/cron/drip/route');
    const res = await GET(makeReq());
    const body = await res.json();

    expect(body.stats.rolledUp).toBe(1);
    expect(mockExecuteRawUnsafe).not.toHaveBeenCalled();
    expect(mockOrder.updateMany).toHaveBeenCalledWith({
      where: { id: 'ord-4', status: { notIn: ['Cancelled', 'Completed', 'Partial'] }, deletedAt: null },
      data: { remains: 200, status: 'Cancelled', completedAt: expect.any(Date) },
    });
  });

  it('batches multiple orders into one UPDATE', async () => {
    setupEmpty();
    const ordADispatches = [{ status: 'completed', quantity: 50, remains: 0, startCount: 10, day: 1, batch: 1 }];
    mockOrder.findMany.mockResolvedValue([
      { id: 'ord-a', startCount: null, dripDispatches: ordADispatches },
      {
        id: 'ord-b', remains: 200, startCount: null,
        dripDispatches: [
          { status: 'completed', quantity: 200, remains: 0, startCount: null, day: 1, batch: 1 },
          { status: 'processing', quantity: 200, remains: 150, startCount: null, day: 1, batch: 2 },
        ],
      },
    ]);
    mockQueryRaw
      .mockResolvedValueOnce([{ id: 'ord-a', status: 'Processing', deletedAt: null }])
      .mockResolvedValueOnce(ordADispatches);

    const { GET } = await import('@/app/api/cron/drip/route');
    const res = await GET(makeReq());
    const body = await res.json();

    expect(mockExecuteRawUnsafe).toHaveBeenCalledTimes(1);
    const [, ...params] = mockExecuteRawUnsafe.mock.calls[0];
    expect(params).toHaveLength(4); // 1 progress order × 4 params
    expect(params[0]).toBe('ord-b');
    expect(params[1]).toBe(200); // observed remains
    expect(params[2]).toBe(150); // next remains
    expect(body.stats.rolledUp).toBe(1); // only ord-a
  });

  it('skips raw query when no orders need rollup', async () => {
    setupEmpty();
    mockOrder.findMany.mockResolvedValue([]);

    const { GET } = await import('@/app/api/cron/drip/route');
    const res = await GET(makeReq());
    const body = await res.json();

    expect(body.stats.rolledUp).toBe(0);
    expect(mockExecuteRawUnsafe).not.toHaveBeenCalled();
  });

  it('does not count rolledUp if the transaction throws', async () => {
    setupEmpty();
    const dispatches = [{ status: 'completed', quantity: 100, remains: 0, startCount: null, day: 1, batch: 1 }];
    mockOrder.findMany.mockResolvedValue([{ id: 'ord-x', startCount: null, dripDispatches: dispatches }]);
    mockQueryRaw
      .mockResolvedValueOnce([{ id: 'ord-x', status: 'Processing', deletedAt: null }])
      .mockResolvedValueOnce(dispatches);
    mockOrder.updateMany.mockRejectedValueOnce(new Error('db gone'));

    const { GET } = await import('@/app/api/cron/drip/route');
    const res = await GET(makeReq());
    const body = await res.json();

    expect(body.ok).toBe(true);
    expect(body.stats.rolledUp).toBe(0);
  });
});

describe('drip cron — section 4 rollup awards points', () => {
  function setupEmpty() {
    mockDripDispatch.findMany.mockResolvedValue([]);
  }

  it('calls awardPointsOnCompletion for Partial parent orders', async () => {
    setupEmpty();
    const { awardPointsOnCompletion } = await import('@/lib/nitro-rewards');
    const dispatches = [
      { status: 'completed', quantity: 500, remains: 0, startCount: 100, day: 1, batch: 1 },
      { status: 'failed', quantity: 500, remains: 500, startCount: null, day: 1, batch: 2 },
    ];
    mockOrder.findMany.mockResolvedValue([{ id: 'ord-partial', startCount: null, dripDispatches: dispatches }]);
    mockQueryRaw
      .mockResolvedValueOnce([{ id: 'ord-partial', status: 'Processing', deletedAt: null }])
      .mockResolvedValueOnce(dispatches);

    const { GET } = await import('@/app/api/cron/drip/route');
    const res = await GET(makeReq());
    const body = await res.json();

    expect(body.stats.rolledUp).toBe(1);
    expect(awardPointsOnCompletion).toHaveBeenCalledWith('ord-partial', mockPrisma);
  });

  it('calls awardPointsOnCompletion for Completed parent orders', async () => {
    setupEmpty();
    const { awardPointsOnCompletion } = await import('@/lib/nitro-rewards');
    const dispatches = [
      { status: 'completed', quantity: 500, remains: 0, startCount: 100, day: 1, batch: 1 },
      { status: 'completed', quantity: 500, remains: 0, startCount: null, day: 1, batch: 2 },
    ];
    mockOrder.findMany.mockResolvedValue([{ id: 'ord-done', startCount: null, dripDispatches: dispatches }]);
    mockQueryRaw
      .mockResolvedValueOnce([{ id: 'ord-done', status: 'Processing', deletedAt: null }])
      .mockResolvedValueOnce(dispatches);

    const { GET } = await import('@/app/api/cron/drip/route');
    const res = await GET(makeReq());
    const body = await res.json();

    expect(body.stats.rolledUp).toBe(1);
    expect(awardPointsOnCompletion).toHaveBeenCalledWith('ord-done', mockPrisma);
  });

  it('does not call awardPointsOnCompletion for Cancelled parent orders', async () => {
    setupEmpty();
    const { awardPointsOnCompletion } = await import('@/lib/nitro-rewards');
    const dispatches = [
      { status: 'failed', quantity: 500, remains: 500, startCount: null, day: 1, batch: 1 },
      { status: 'failed', quantity: 500, remains: 500, startCount: null, day: 1, batch: 2 },
    ];
    mockOrder.findMany.mockResolvedValue([{ id: 'ord-cancel', startCount: null, dripDispatches: dispatches }]);
    mockQueryRaw
      .mockResolvedValueOnce([{ id: 'ord-cancel', status: 'Processing', deletedAt: null }])
      .mockResolvedValueOnce(dispatches);

    const { GET } = await import('@/app/api/cron/drip/route');
    const res = await GET(makeReq());
    const body = await res.json();

    expect(body.stats.rolledUp).toBe(1);
    expect(awardPointsOnCompletion).not.toHaveBeenCalled();
  });
});

describe('drip cron — CAS fencing', () => {
  it('skips reschedule when CAS fails (lost race)', async () => {
    const { checkOrder } = await import('@/lib/smm');

    mockDripDispatch.findMany
      .mockResolvedValueOnce([]) // stuck dispatching
      .mockResolvedValueOnce([]) // due dispatches
      .mockResolvedValueOnce([ // processing dispatches
        {
          id: 'disp-cas', apiOrderId: 'api-cas', status: 'processing', quantity: 100, remains: 100,
          dispatchedAt: new Date(), orderId: 'ord-cas', startCount: null, lastError: null,
          order: { id: 'ord-cas', orderId: 'ORD-CAS', service: { provider: 'mtp', name: 'IG Followers', category: 'instagram' } },
        },
      ]);

    checkOrder.mockResolvedValue({ status: 'Completed', remains: 0, start_count: 500 });

    // CAS fails — another worker already transitioned this dispatch
    mockDripDispatch.updateMany
      .mockResolvedValueOnce({ count: 0 })  // section 0 stale-expiry
      .mockResolvedValueOnce({ count: 0 }); // section 3 CAS — lost race

    mockOrder.findMany.mockResolvedValue([]);

    const { GET } = await import('@/app/api/cron/drip/route');
    const res = await GET(makeReq());
    const body = await res.json();

    expect(body.ok).toBe(true);
    expect(body.stats.synced).toBe(0);
    // No reschedule SQL should have been emitted since CAS returned count: 0
    expect(mockExecuteRawUnsafe).not.toHaveBeenCalled();
  });

  it('uses observed status in CAS predicate', async () => {
    const { checkOrder } = await import('@/lib/smm');

    mockDripDispatch.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]) // section 1.3: stale cancelling
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          id: 'disp-obs', apiOrderId: 'api-obs', status: 'processing', quantity: 100, remains: 100,
          dispatchedAt: new Date(), orderId: 'ord-obs', startCount: null, lastError: null,
          order: { id: 'ord-obs', orderId: 'ORD-OBS', service: { provider: 'mtp', name: 'IG Followers', category: 'instagram' } },
        },
      ]);

    checkOrder.mockResolvedValue({ status: 'Partial', remains: 30, start_count: 100 });

    mockDripDispatch.updateMany
      .mockResolvedValueOnce({ count: 0 })  // section 0
      .mockResolvedValueOnce({ count: 0 })  // section 1.25 stale-verifying
      .mockResolvedValueOnce({ count: 1 }); // section 3 CAS

    mockDripDispatch.findMany
      .mockResolvedValueOnce([]); // no pending dispatches to reschedule

    mockOrder.findMany.mockResolvedValue([]);

    const { GET } = await import('@/app/api/cron/drip/route');
    await GET(makeReq());

    // Verify CAS used the observed 'processing' status
    const casCall = mockDripDispatch.updateMany.mock.calls.find(
      c => c[0]?.where?.id === 'disp-obs'
    );
    expect(casCall).toBeDefined();
    expect(casCall[0].where.status).toBe('processing');
    expect(casCall[0].data.status).toBe('partial');
  });
});
