import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockDripDispatch = { findMany: vi.fn(), findFirst: vi.fn(), update: vi.fn(), updateMany: vi.fn() };
const mockOrder = { findMany: vi.fn(), update: vi.fn() };
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

function makeReq(secret = 'test-secret') {
  return {
    url: `http://localhost/api/cron/drip?secret=${secret}`,
    headers: new Map([['authorization', `Bearer ${secret}`]]),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.CRON_SECRET = 'test-secret';

  // Default: no stale/stuck/due/processing dispatches, no drip orders
  mockDripDispatch.updateMany.mockResolvedValue({ count: 0 });
  mockDripDispatch.findMany.mockResolvedValue([]);
  mockOrder.findMany.mockResolvedValue([]);
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
    // In-loop guard finds an in-flight batch (race condition)
    mockDripDispatch.findFirst.mockResolvedValueOnce({ id: 'other-batch', status: 'processing' });
    mockOrder.findMany.mockResolvedValue([]);

    const { GET } = await import('@/app/api/cron/drip/route');
    const res = await GET(makeReq());
    const body = await res.json();

    expect(body.stats.dispatched).toBe(0);
    expect(placeOrder).not.toHaveBeenCalled();
    expect(mockDripDispatch.findFirst).toHaveBeenCalledWith({
      where: { orderId: 'ord-race', status: { in: ['dispatching', 'processing'] } },
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
