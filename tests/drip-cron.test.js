import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockDripDispatch = { findMany: vi.fn(), findFirst: vi.fn(), update: vi.fn(), updateMany: vi.fn() };
const mockOrder = { findMany: vi.fn(), findFirst: vi.fn(), update: vi.fn(), updateMany: vi.fn() };
const mockAdminIssue = { create: vi.fn().mockReturnValue({ catch: () => {} }) };
const mockExecuteRawUnsafe = vi.fn();

const mockPrisma = {
  dripDispatch: mockDripDispatch,
  order: mockOrder,
  adminIssue: mockAdminIssue,
  $executeRawUnsafe: mockExecuteRawUnsafe,
};

vi.mock('@/lib/prisma', () => ({ default: mockPrisma }));
vi.mock('@/lib/logger', () => ({ log: { error: vi.fn(), warn: vi.fn() } }));
vi.mock('@/lib/smm', () => ({ placeOrder: vi.fn(), checkOrder: vi.fn() }));
vi.mock('@/lib/telegram', () => ({ tgDripTimeout: vi.fn() }));
vi.mock('@/lib/drip-feed', () => ({ getDripConfig: () => ({ intervalHours: 2 }) }));
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
  const { placeOrder, checkOrder } = await import('@/lib/smm');
  placeOrder.mockReset();
  checkOrder.mockReset();
  const { awardPointsOnCompletion } = await import('@/lib/nitro-rewards');
  awardPointsOnCompletion.mockReset().mockResolvedValue(0);
  process.env.CRON_SECRET = 'test-secret';

  // Default: no stale/stuck/due/processing dispatches, no drip orders
  mockDripDispatch.updateMany.mockResolvedValue({ count: 0 });
  mockDripDispatch.findMany.mockResolvedValue([]);
  mockOrder.findMany.mockResolvedValue([]);
  mockOrder.findFirst.mockResolvedValue(null);
  mockOrder.updateMany.mockResolvedValue({ count: 1 });
  mockExecuteRawUnsafe.mockResolvedValue(0);
});

describe('drip cron — section 2 in-flight filter', () => {
  it('excludes dispatches whose order has an in-flight batch from the due query', async () => {
    // Section 0: no expired
    // Section 1: no stuck dispatching
    mockDripDispatch.findMany
      .mockResolvedValueOnce([]) // section 1: stuck dispatching
      .mockResolvedValueOnce([]) // section 2: due dispatches (none returned)
      .mockResolvedValueOnce([]); // section 3: processing
    mockOrder.findMany.mockResolvedValue([]); // section 4: rollup

    const { GET } = await import('@/app/api/cron/drip/route');
    await GET(makeReq());

    // The second findMany call is section 2 (due dispatches)
    const dueCall = mockDripDispatch.findMany.mock.calls[1];
    expect(dueCall).toBeDefined();
    const where = dueCall[0].where;

    expect(where.status).toBe('pending');
    expect(where.scheduledAt).toEqual({ lte: expect.any(Date) });
    expect(where.order).toEqual({
      dripDispatches: {
        none: { status: { in: ['dispatching', 'processing'] } },
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
      where: { orderId: 'ord-race', status: { in: ['dispatching', 'processing'] } },
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
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([dispatch])
      .mockResolvedValueOnce([]);
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
    expect(mockDripDispatch.updateMany).toHaveBeenCalledTimes(1); // stale-expiry sweep only
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
      .mockResolvedValueOnce({ count: 0 })
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
      .mockResolvedValueOnce({ count: 0 })
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
      .mockResolvedValueOnce({ count: 0 })
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

    // Section 0-2: nothing
    mockDripDispatch.findMany
      .mockResolvedValueOnce([]) // stuck dispatching (section 1)
      .mockResolvedValueOnce([]) // due dispatches (section 2)
      .mockResolvedValueOnce([ // processing dispatches (section 3)
        {
          id: 'disp-1', apiOrderId: 'api-1', status: 'processing', quantity: 100, remains: 100,
          dispatchedAt: new Date(), orderId: 'ord-1', startCount: null, lastError: null,
          order: { id: 'ord-1', orderId: 'ORD-1', service: { provider: 'mtp', name: 'IG Followers', category: 'instagram' } },
        },
      ]);

    checkOrder.mockResolvedValue({ status: 'Completed', remains: 0, start_count: 500 });

    mockDripDispatch.update.mockResolvedValue({});

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

describe('drip cron — section 4 rollup (set-based UPDATE)', () => {
  function setupEmpty() {
    // Sections 0-3 produce nothing
    mockDripDispatch.findMany.mockResolvedValue([]);
  }

  it('rolls up all-done orders with a single UPDATE FROM VALUES', async () => {
    setupEmpty();

    mockOrder.findMany.mockResolvedValue([
      {
        id: 'ord-1', startCount: null,
        dripDispatches: [
          { status: 'completed', quantity: 100, remains: 0, startCount: 500, day: 1, batch: 1 },
          { status: 'completed', quantity: 100, remains: 0, startCount: null, day: 1, batch: 2 },
        ],
      },
    ]);

    const { GET } = await import('@/app/api/cron/drip/route');
    const res = await GET(makeReq());
    const body = await res.json();

    expect(body.ok).toBe(true);
    expect(body.stats.rolledUp).toBe(1);
    expect(mockExecuteRawUnsafe).toHaveBeenCalledTimes(1);

    const [sql, ...params] = mockExecuteRawUnsafe.mock.calls[0];
    expect(sql).toContain('UPDATE "orders"');
    expect(sql).toContain('COALESCE(v.s, "orders"."status")');
    expect(sql).toContain('COALESCE(v.sc, "orders"."startCount")');
    // params: id, status, remains, startCount
    expect(params[0]).toBe('ord-1');
    expect(params[1]).toBe('Completed');
    expect(params[2]).toBe(0); // totalRemains
    expect(params[3]).toBe(500); // first dispatch's startCount
  });

  it('uses null status for in-progress orders (preserves existing via COALESCE)', async () => {
    setupEmpty();

    mockOrder.findMany.mockResolvedValue([
      {
        id: 'ord-2', startCount: null,
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
    const [, ...params] = mockExecuteRawUnsafe.mock.calls[0];
    expect(params[0]).toBe('ord-2');
    expect(params[1]).toBeNull(); // no status change
    expect(params[2]).toBe(60); // remains from processing dispatch
    expect(params[3]).toBe(500); // startCount still flows
  });

  it('sets Partial status when mix of completed and failed', async () => {
    setupEmpty();

    mockOrder.findMany.mockResolvedValue([
      {
        id: 'ord-3', startCount: 100,
        dripDispatches: [
          { status: 'completed', quantity: 100, remains: 0, startCount: 200, day: 1, batch: 1 },
          { status: 'failed', quantity: 100, remains: 100, startCount: null, day: 1, batch: 2 },
        ],
      },
    ]);

    const { GET } = await import('@/app/api/cron/drip/route');
    const res = await GET(makeReq());
    const body = await res.json();

    expect(body.stats.rolledUp).toBe(1);
    const [, ...params] = mockExecuteRawUnsafe.mock.calls[0];
    expect(params[1]).toBe('Partial');
    expect(params[2]).toBe(100); // 0 + 100
    expect(params[3]).toBeNull(); // order already has startCount, so null
  });

  it('sets Cancelled when all dispatches failed', async () => {
    setupEmpty();

    mockOrder.findMany.mockResolvedValue([
      {
        id: 'ord-4', startCount: null,
        dripDispatches: [
          { status: 'failed', quantity: 100, remains: 100, startCount: null, day: 1, batch: 1 },
          { status: 'failed', quantity: 100, remains: 100, startCount: null, day: 1, batch: 2 },
        ],
      },
    ]);

    const { GET } = await import('@/app/api/cron/drip/route');
    const res = await GET(makeReq());
    const body = await res.json();

    expect(body.stats.rolledUp).toBe(1);
    const [, ...params] = mockExecuteRawUnsafe.mock.calls[0];
    expect(params[1]).toBe('Cancelled');
    expect(params[2]).toBe(200);
  });

  it('batches multiple orders into one UPDATE', async () => {
    setupEmpty();

    mockOrder.findMany.mockResolvedValue([
      {
        id: 'ord-a', startCount: null,
        dripDispatches: [
          { status: 'completed', quantity: 50, remains: 0, startCount: 10, day: 1, batch: 1 },
        ],
      },
      {
        id: 'ord-b', startCount: null,
        dripDispatches: [
          { status: 'completed', quantity: 200, remains: 0, startCount: null, day: 1, batch: 1 },
          { status: 'processing', quantity: 200, remains: 150, startCount: null, day: 1, batch: 2 },
        ],
      },
    ]);

    const { GET } = await import('@/app/api/cron/drip/route');
    const res = await GET(makeReq());
    const body = await res.json();

    expect(mockExecuteRawUnsafe).toHaveBeenCalledTimes(1);
    const [sql, ...params] = mockExecuteRawUnsafe.mock.calls[0];
    expect(params).toHaveLength(8); // 2 orders × 4 params
    // ord-a: done
    expect(params[0]).toBe('ord-a');
    expect(params[1]).toBe('Completed');
    // ord-b: in-progress
    expect(params[4]).toBe('ord-b');
    expect(params[5]).toBeNull();
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

  it('does not count rolledUp if the raw query throws', async () => {
    setupEmpty();

    mockOrder.findMany.mockResolvedValue([
      {
        id: 'ord-x', startCount: null,
        dripDispatches: [
          { status: 'completed', quantity: 100, remains: 0, startCount: null, day: 1, batch: 1 },
        ],
      },
    ]);
    mockExecuteRawUnsafe.mockRejectedValue(new Error('db gone'));

    const { GET } = await import('@/app/api/cron/drip/route');
    const res = await GET(makeReq());
    const body = await res.json();

    expect(res.status).toBe(500);
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

    mockOrder.findMany.mockResolvedValue([
      {
        id: 'ord-partial', startCount: null,
        dripDispatches: [
          { status: 'completed', quantity: 500, remains: 0, startCount: 100, day: 1, batch: 1 },
          { status: 'failed', quantity: 500, remains: 500, startCount: null, day: 1, batch: 2 },
        ],
      },
    ]);

    const { GET } = await import('@/app/api/cron/drip/route');
    const res = await GET(makeReq());
    const body = await res.json();

    expect(body.stats.rolledUp).toBe(1);
    const [, status] = mockExecuteRawUnsafe.mock.calls[0].slice(1);
    expect(status).toBe('Partial');
    expect(awardPointsOnCompletion).toHaveBeenCalledWith('ord-partial');
  });

  it('calls awardPointsOnCompletion for Completed parent orders', async () => {
    setupEmpty();
    const { awardPointsOnCompletion } = await import('@/lib/nitro-rewards');

    mockOrder.findMany.mockResolvedValue([
      {
        id: 'ord-done', startCount: null,
        dripDispatches: [
          { status: 'completed', quantity: 500, remains: 0, startCount: 100, day: 1, batch: 1 },
          { status: 'completed', quantity: 500, remains: 0, startCount: null, day: 1, batch: 2 },
        ],
      },
    ]);

    const { GET } = await import('@/app/api/cron/drip/route');
    const res = await GET(makeReq());
    const body = await res.json();

    expect(body.stats.rolledUp).toBe(1);
    expect(awardPointsOnCompletion).toHaveBeenCalledWith('ord-done');
  });

  it('does not call awardPointsOnCompletion for Cancelled parent orders', async () => {
    setupEmpty();
    const { awardPointsOnCompletion } = await import('@/lib/nitro-rewards');

    mockOrder.findMany.mockResolvedValue([
      {
        id: 'ord-cancel', startCount: null,
        dripDispatches: [
          { status: 'failed', quantity: 500, remains: 500, startCount: null, day: 1, batch: 1 },
          { status: 'failed', quantity: 500, remains: 500, startCount: null, day: 1, batch: 2 },
        ],
      },
    ]);

    const { GET } = await import('@/app/api/cron/drip/route');
    const res = await GET(makeReq());
    const body = await res.json();

    expect(body.stats.rolledUp).toBe(1);
    expect(awardPointsOnCompletion).not.toHaveBeenCalled();
  });
});
