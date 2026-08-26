import crypto from 'crypto';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  logInfo: vi.fn(),
  logWarn: vi.fn(),
  logError: vi.fn(),
  reportOperationalFailure: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({ default: {} }));
vi.mock('@/lib/logger', () => ({
  log: {
    info: (...args) => mocks.logInfo(...args),
    warn: (...args) => mocks.logWarn(...args),
    error: (...args) => mocks.logError(...args),
  },
}));
vi.mock('@/lib/monitoring', () => ({
  reportOperationalFailure: (...args) => mocks.reportOperationalFailure(...args),
}));

const {
  buildMetaEvent,
  cancelQueuedMetaEvent,
  checkMetaPurchaseHealth,
  deliverQueuedMetaEvent,
  enqueueMetaEvent,
  scheduleQueuedMetaEventDelivery,
  sendEvent,
  sendPreparedMetaEvent,
} = await import('@/lib/meta-capi.js');

const originalToken = process.env.META_CAPI_TOKEN;

function queued(overrides = {}) {
  return {
    id: 'outbox-1',
    eventId: 'purchase_NTR-1',
    eventName: 'Purchase',
    payload: buildMetaEvent('Purchase', {
      eventId: 'purchase_NTR-1',
      eventTime: 1_722_345_678,
      email: 'buyer@example.test',
      customData: { value: 100, currency: 'NGN' },
    }),
    payloadHash: 'payload-hash',
    testEventCode: 'TEST123',
    status: 'pending',
    attempts: 0,
    sentAt: null,
    firstError: null,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.META_CAPI_TOKEN = 'test-token';
  mocks.reportOperationalFailure.mockReturnValue(true);
});

afterAll(() => {
  if (originalToken === undefined) delete process.env.META_CAPI_TOKEN;
  else process.env.META_CAPI_TOKEN = originalToken;
});

describe('Meta CAPI strict transport', () => {
  it('builds a deterministic event with normalized hashed fields and immutable event_time', () => {
    const event = buildMetaEvent('Purchase', {
      eventId: 'purchase_NTR-9',
      eventTime: new Date('2026-07-25T12:00:00.000Z'),
      email: ' BUYER@Example.Test ',
      phone: '+234 806 608 8463',
      externalId: 'user-9',
      sourceUrl: 'https://nitro.ng/new-order?token=must-not-persist#checkout',
      customData: { value: 42, currency: 'NGN' },
    });

    expect(event).toMatchObject({
      event_name: 'Purchase',
      event_time: 1_784_980_800,
      event_id: 'purchase_NTR-9',
      action_source: 'website',
      event_source_url: 'https://nitro.ng/new-order',
      custom_data: { value: 42, currency: 'NGN' },
    });
    expect(event.user_data.em).toEqual([
      crypto.createHash('sha256').update('buyer@example.test').digest('hex'),
    ]);
    expect(event.user_data.ph).toEqual([
      crypto.createHash('sha256').update('2348066088463').digest('hex'),
    ]);
  });

  it('uses test_event_code and accepts only a positive Meta acknowledgement', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ events_received: 1, fbtrace_id: 'trace-1' }),
    });
    const event = queued().payload;

    await expect(sendPreparedMetaEvent(event, { testEventCode: 'TEST123', fetchImpl }))
      .resolves.toMatchObject({ ok: true, eventsReceived: 1 });
    const body = JSON.parse(fetchImpl.mock.calls[0][1].body);
    expect(body).toEqual({ data: [event], test_event_code: 'TEST123' });
  });

  it.each([
    [{ ok: false, status: 400, json: async () => ({ error: { message: 'invalid event', code: 100 } }) }, 'invalid event'],
    [{ ok: true, status: 200, json: async () => ({ events_received: 0 }) }, 'acknowledged zero events'],
  ])('rejects HTTP, Graph, and zero-received responses', async (response, message) => {
    await expect(sendPreparedMetaEvent(queued().payload, {
      testEventCode: 'TEST123',
      fetchImpl: vi.fn().mockResolvedValue(response),
    })).rejects.toThrow(message);
  });

  it('turns a timeout into a loud structured failure for legacy direct callers', async () => {
    const fetchImpl = vi.fn((url, { signal }) => new Promise((resolve, reject) => {
      signal.addEventListener('abort', () => {
        const error = new Error('aborted');
        error.name = 'AbortError';
        reject(error);
      });
    }));
    const result = await sendEvent('PageView', {
      eventId: 'test_pageview_timeout',
      testEventCode: 'TEST123',
    }, { fetchImpl, timeoutMs: 5, retryDelayMs: 0 });

    expect(result).toMatchObject({ ok: false, error: { code: 'timeout' } });
    // One retry, then a warning in the log: Meta's weather is not a page.
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(mocks.logWarn).toHaveBeenCalledWith(
      'MetaCAPI',
      expect.stringContaining('timed out after 5ms'),
    );
    expect(mocks.reportOperationalFailure).not.toHaveBeenCalled();
  });

  it('a network failure is retried once and then logged, not paged', async () => {
    const fetchImpl = vi.fn(() => Promise.reject(Object.assign(new TypeError('fetch failed'), { cause: { code: 'ECONNRESET' } })));
    const result = await sendEvent('PageView', { eventId: 'test_pageview_network' }, { fetchImpl, retryDelayMs: 0 });
    expect(result).toMatchObject({ ok: false, error: { code: 'network' } });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(mocks.reportOperationalFailure).not.toHaveBeenCalled();
  });

  it('a graph error is not retried and still pages', async () => {
    const fetchImpl = vi.fn(() => Promise.resolve({ ok: false, status: 400, json: async () => ({ error: { message: 'Invalid parameter', code: 100 } }) }));
    const result = await sendEvent('PageView', { eventId: 'test_pageview_graph' }, { fetchImpl, retryDelayMs: 0 });
    expect(result).toMatchObject({ ok: false, error: { code: 100 } });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(mocks.reportOperationalFailure).toHaveBeenCalledWith(
      'meta_capi_delivery_failed',
      expect.objectContaining({ dedupeKey: 'meta_capi_delivery_failed:pageview' }),
    );
  });
});

describe('Meta CAPI durable outbox', () => {
  it('enqueues the final normalized payload without mutating a duplicate event_id', async () => {
    const upsert = vi.fn().mockImplementation(async ({ create }) => ({ id: 'outbox-1', ...create }));
    const db = { metaCapiEvent: { upsert } };
    const event = await enqueueMetaEvent(db, 'Purchase', {
      eventId: 'purchase_NTR-2',
      eventTime: 1_753_444_800,
      email: 'buyer@example.test',
      sourceUrl: 'https://nitro.ng/orders?session=private#done',
      testEventCode: 'TEST123',
    });

    expect(upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { eventId: 'purchase_NTR-2' },
      update: { eventId: 'purchase_NTR-2' },
    }));
    expect(event.payload.event_time).toBe(1_753_444_800);
    expect(event.payload.user_data.em[0]).toHaveLength(64);
    expect(event.payloadHash).toHaveLength(64);
    expect(event.payload.event_source_url).toBe('https://nitro.ng/orders');
  });

  it('defers cron eligibility and rejects an event_id reused for a different payload', async () => {
    const notBefore = new Date('2026-08-06T12:02:00.000Z');
    const mismatched = { id: 'outbox-1', eventId: 'purchase_NTR-2', eventName: 'Purchase', payloadHash: 'different' };
    const upsert = vi.fn().mockResolvedValue(mismatched);
    const db = { metaCapiEvent: { upsert } };

    await expect(enqueueMetaEvent(db, 'Purchase', {
      eventId: 'purchase_NTR-2',
      eventTime: 1_753_444_800,
      email: 'buyer@example.test',
      notBefore,
    })).rejects.toThrow('event_id collision');
    expect(upsert.mock.calls[0][0].create.nextAttemptAt).toEqual(notBefore);
  });

  it('claims with a lease and marks a positive acknowledgement sent', async () => {
    const row = queued();
    const updateMany = vi.fn()
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 1 });
    const db = {
      metaCapiEvent: {
        findUnique: vi.fn().mockResolvedValue(row),
        updateMany,
      },
    };
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ events_received: 1 }),
    });

    const result = await deliverQueuedMetaEvent(row.eventId, {
      db,
      fetchImpl,
      now: new Date('2026-08-06T12:00:00.000Z'),
    });

    expect(result).toMatchObject({ ok: true, status: 'sent' });
    expect(updateMany.mock.calls[1][0]).toMatchObject({
      where: { id: row.id, status: 'sending', sentAt: null },
      data: { status: 'sent', attempts: { increment: 1 }, lastError: null, payload: {} },
    });
  });

  it('fences a failed attempt and schedules a durable retry', async () => {
    const row = queued({ attempts: 1 });
    const updateMany = vi.fn()
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 1 });
    const db = {
      metaCapiEvent: {
        findUnique: vi.fn().mockResolvedValue(row),
        updateMany,
      },
    };
    const now = new Date('2026-08-06T12:00:00.000Z');
    const result = await deliverQueuedMetaEvent(row.eventId, {
      db,
      now,
      fetchImpl: vi.fn().mockResolvedValue({
        ok: false,
        status: 503,
        json: async () => ({ error: { message: 'provider unavailable' } }),
      }),
    });

    expect(result).toMatchObject({ ok: false, status: 'retry_scheduled' });
    expect(updateMany.mock.calls[1][0].data).toMatchObject({
      status: 'failed',
      attempts: { increment: 1 },
      leaseToken: null,
      firstError: expect.any(String),
    });
    expect(result.nextAttemptAt.getTime()).toBe(now.getTime() + 5 * 60_000);
    expect(mocks.reportOperationalFailure).toHaveBeenCalledWith(
      'meta_capi_delivery_failed',
      expect.objectContaining({ dedupeKey: 'meta_capi_delivery_failed:purchase' }),
    );
  });

  it('takes over an expired lease but rejects a stale owner at the final fence', async () => {
    const now = new Date('2026-08-06T12:00:00.000Z');
    const row = queued({
      status: 'sending',
      leaseToken: 'crashed-owner',
      leaseExpiresAt: new Date('2026-08-06T11:59:00.000Z'),
    });
    const updateMany = vi.fn()
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 0 });
    const db = {
      metaCapiEvent: {
        findUnique: vi.fn().mockResolvedValue(row),
        updateMany,
      },
    };
    const result = await deliverQueuedMetaEvent(row.eventId, {
      db,
      now,
      fetchImpl: vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ events_received: 1 }),
      }),
    });

    expect(result).toEqual({ ok: false, status: 'lease_lost' });
    expect(updateMany.mock.calls[0][0].where.OR).toContainEqual({
      status: 'sending',
      leaseExpiresAt: { lt: now },
    });
    const claimedToken = updateMany.mock.calls[0][0].data.leaseToken;
    expect(updateMany.mock.calls[1][0].where.leaseToken).toBe(claimedToken);
    expect(claimedToken).not.toBe('crashed-owner');
  });

  it('expires a seven-day-old unsent row before network delivery and clears its payload', async () => {
    const now = new Date('2026-08-06T12:00:00.000Z');
    const row = queued({ createdAt: new Date('2026-07-30T12:00:00.000Z') });
    const updateMany = vi.fn().mockResolvedValue({ count: 1 });
    const db = {
      metaCapiEvent: {
        findUnique: vi.fn().mockResolvedValue(row),
        updateMany,
      },
    };
    const fetchImpl = vi.fn();
    const monitor = vi.fn();

    const result = await deliverQueuedMetaEvent(row.eventId, { db, now, fetchImpl, monitor });

    expect(result).toEqual({ ok: false, status: 'expired' });
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ id: row.id, sentAt: null }),
      data: expect.objectContaining({
        status: 'expired',
        payload: {},
        leaseToken: null,
        leaseExpiresAt: null,
      }),
    }));
    expect(monitor).toHaveBeenCalledWith('meta_capi_events_expired', expect.objectContaining({
      data: { count: 1, maxAgeDays: 7 },
    }));
    expect(mocks.logError).toHaveBeenCalledWith('MetaCAPI', 'Expired 1 undelivered event after 7 days');
  });

  it('activates a deferred row only when post-commit delivery is scheduled', async () => {
    const row = queued();
    const updateMany = vi.fn()
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 1 });
    const db = {
      metaCapiEvent: {
        findUnique: vi.fn().mockResolvedValue(row),
        updateMany,
      },
    };
    const now = new Date('2026-08-06T12:00:00.000Z');
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ events_received: 1 }),
    });

    scheduleQueuedMetaEventDelivery(row.eventId, { db, now, fetchImpl });
    await vi.waitFor(() => expect(updateMany).toHaveBeenCalledTimes(3));
    expect(updateMany.mock.calls[0][0]).toEqual({
      where: { eventId: row.eventId, sentAt: null, status: { in: ['pending', 'failed'] } },
      data: { nextAttemptAt: now },
    });
    expect(fetchImpl).toHaveBeenCalledOnce();
  });

  it('never turns an immediate-delivery setup failure into a post-commit route error', async () => {
    const db = {
      metaCapiEvent: {
        updateMany: vi.fn(() => { throw new Error('generated client is stale'); }),
      },
    };
    expect(() => scheduleQueuedMetaEventDelivery('purchase_NTR-setup', { db })).not.toThrow();
    await vi.waitFor(() => expect(mocks.reportOperationalFailure).toHaveBeenCalledWith(
      'meta_capi_delivery_failed',
      expect.objectContaining({ dedupeKey: 'meta_capi_delivery_failed:immediate' }),
    ));
  });

  it('cancels only an unsent event using the deterministic event_id', async () => {
    const updateMany = vi.fn().mockResolvedValue({ count: 1 });
    const result = await cancelQueuedMetaEvent({ metaCapiEvent: { updateMany } }, 'purchase_NTR-3', 'provider rejected');
    expect(result).toEqual({ cancelled: true });
    expect(updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { eventId: 'purchase_NTR-3', sentAt: null, status: { not: 'cancelled' } },
      data: expect.objectContaining({ status: 'cancelled', leaseToken: null, payload: {} }),
    }));
  });
});

describe('Meta CAPI Purchase health guard', () => {
  const now = new Date('2026-08-06T12:00:00.000Z');

  function healthDb({ orders, rows, oldest = new Date('2026-08-04T00:00:00.000Z'), state = null }) {
    return {
      order: { findMany: vi.fn().mockResolvedValue(orders) },
      metaCapiEvent: {
        findFirst: vi.fn().mockResolvedValue(oldest ? { createdAt: oldest } : null),
        findMany: vi.fn().mockResolvedValue(rows),
      },
      setting: {
        findUnique: vi.fn().mockResolvedValue(state ? { value: JSON.stringify(state) } : null),
        upsert: vi.fn().mockResolvedValue({}),
      },
    };
  }

  function orders(count) {
    return Array.from({ length: count }, (_, index) => ({ orderId: `NTR-${index + 1}`, batchId: null }));
  }

  function rows(count, { sent = count, status = 'sent' } = {}) {
    return Array.from({ length: count }, (_, index) => ({
      eventId: `purchase_NTR-${index + 1}`,
      status: index < sent ? status : 'failed',
      sentAt: index < sent ? new Date('2026-08-06T10:00:00.000Z') : null,
    }));
  }

  it('detects missing enqueue calls independently from successful delivery', async () => {
    const db = healthDb({ orders: orders(10), rows: rows(8) });
    const monitor = vi.fn().mockReturnValue(true);
    const health = await checkMetaPurchaseHealth({ db, now, monitor });

    expect(health).toMatchObject({
      status: 'unhealthy',
      expected: 10,
      enqueued: 8,
      enqueueCoverageRatio: 0.8,
      deliveryExpected: 8,
      sent: 8,
      deliveryRatio: 1,
      alerted: true,
    });
    expect(monitor).toHaveBeenCalledWith('meta_capi_purchase_volume_low', expect.objectContaining({
      data: expect.objectContaining({ enqueueCoverageRatio: 0.8, deliveryRatio: 1 }),
    }));
  });

  it('detects delivery degradation when enqueue coverage is complete', async () => {
    const db = healthDb({ orders: orders(10), rows: rows(10, { sent: 8 }) });
    const health = await checkMetaPurchaseHealth({ db, now, monitor: vi.fn().mockReturnValue(true) });
    expect(health).toMatchObject({
      enqueueCoverageRatio: 1,
      deliveryExpected: 10,
      sent: 8,
      deliveryRatio: 0.8,
      status: 'unhealthy',
    });
  });

  it('deduplicates batch orders and counts cancelled rows only for enqueue coverage', async () => {
    const db = healthDb({
      orders: [
        { orderId: 'NTR-1', batchId: 'BAT-1' },
        { orderId: 'NTR-2', batchId: 'BAT-1' },
        { orderId: 'NTR-3', batchId: null },
        { orderId: 'NTR-4', batchId: null },
      ],
      rows: [
        { eventId: 'purchase_BAT-1', status: 'sent', sentAt: new Date() },
        { eventId: 'purchase_NTR-3', status: 'cancelled', sentAt: null },
        { eventId: 'purchase_NTR-4', status: 'failed', sentAt: null },
      ],
    });
    const health = await checkMetaPurchaseHealth({ db, now, monitor: vi.fn().mockReturnValue(true) });
    expect(health).toMatchObject({
      expected: 3,
      enqueued: 3,
      enqueueCoverageRatio: 1,
      deliveryExpected: 2,
      sent: 1,
      deliveryRatio: 0.5,
    });
    expect(db.metaCapiEvent.findMany.mock.calls[0][0].where.eventId.in).toEqual([
      'purchase_BAT-1', 'purchase_NTR-3', 'purchase_NTR-4',
    ]);
  });

  it('passes at the exact 90 percent delivery threshold', async () => {
    const db = healthDb({ orders: orders(10), rows: rows(10, { sent: 9 }) });
    const monitor = vi.fn();
    const health = await checkMetaPurchaseHealth({ db, now, monitor });
    expect(health).toMatchObject({
      status: 'healthy',
      enqueueCoverageRatio: 1,
      deliveryRatio: 0.9,
      alerted: false,
    });
    expect(monitor).not.toHaveBeenCalled();
  });

  it('passes at the exact 90 percent enqueue-coverage threshold', async () => {
    const db = healthDb({ orders: orders(10), rows: rows(9) });
    const monitor = vi.fn();
    const health = await checkMetaPurchaseHealth({ db, now, monitor });
    expect(health).toMatchObject({
      status: 'healthy',
      enqueueCoverageRatio: 0.9,
      deliveryRatio: 1,
      alerted: false,
    });
    expect(monitor).not.toHaveBeenCalled();
  });

  it('warms up without alerting until the outbox has a full mature window', async () => {
    const db = healthDb({
      orders: orders(10),
      rows: rows(1),
      oldest: new Date('2026-08-06T10:00:00.000Z'),
    });
    const monitor = vi.fn();
    const health = await checkMetaPurchaseHealth({ db, now, monitor });
    expect(health).toMatchObject({ status: 'warming_up', enqueueCoverageRatio: 0.1 });
    expect(monitor).not.toHaveBeenCalled();
    const persisted = JSON.parse(db.setting.upsert.mock.calls[0][0].update.value);
    expect(persisted.monitoringSince).toBe('2026-08-06T10:00:00.000Z');
  });
});
