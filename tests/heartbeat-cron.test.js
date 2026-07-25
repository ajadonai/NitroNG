import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  count: vi.fn(),
  findMany: vi.fn(),
  deleteMany: vi.fn(),
  logInfo: vi.fn(),
  logError: vi.fn(),
  reportOperationalFailure: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  default: {
    liveSession: {
      count: (...args) => mocks.count(...args),
      findMany: (...args) => mocks.findMany(...args),
      deleteMany: (...args) => mocks.deleteMany(...args),
    },
  },
}));
vi.mock('@/lib/logger', () => ({
  log: {
    info: (...args) => mocks.logInfo(...args),
    error: (...args) => mocks.logError(...args),
  },
}));
vi.mock('@/lib/monitoring', () => ({
  reportOperationalFailure: (...args) => mocks.reportOperationalFailure(...args),
}));

const { GET } = await import('@/app/api/cron/heartbeat/route.js');
const originalCronSecret = process.env.CRON_SECRET;

function request({ authorization, querySecret } = {}) {
  const suffix = querySecret ? `?secret=${encodeURIComponent(querySecret)}` : '';
  return {
    url: `https://nitro.test/api/cron/heartbeat${suffix}`,
    headers: new Headers(authorization ? { authorization } : {}),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.CRON_SECRET = 'cron-secret';
  mocks.count.mockResolvedValue(0);
  mocks.findMany.mockResolvedValue([]);
  mocks.deleteMany.mockResolvedValue({ count: 0 });
});

afterAll(() => {
  if (originalCronSecret === undefined) delete process.env.CRON_SECRET;
  else process.env.CRON_SECRET = originalCronSecret;
});

describe('scheduled heartbeat cleanup', () => {
  it('fails closed when cron authentication is not configured', async () => {
    delete process.env.CRON_SECRET;
    const response = await GET(request({ authorization: 'Bearer cron-secret' }));
    expect(response.status).toBe(503);
    expect(mocks.findMany).not.toHaveBeenCalled();
    expect(mocks.deleteMany).not.toHaveBeenCalled();
  });

  it('requires the exact header secret and ignores URL query secrets', async () => {
    const queryOnly = await GET(request({ querySecret: 'cron-secret' }));
    const malformed = await GET(request({ authorization: 'cron-secret' }));
    expect(queryOnly.status).toBe(401);
    expect(malformed.status).toBe(401);
    expect(mocks.findMany).not.toHaveBeenCalled();
    expect(mocks.deleteMany).not.toHaveBeenCalled();
  });

  it('deletes one bounded batch with separate anonymous and identified cutoffs', async () => {
    mocks.findMany.mockResolvedValue(
      Array.from({ length: 7 }, (_, index) => ({ sessionId: `stale-${index}` })),
    );
    mocks.deleteMany.mockResolvedValue({ count: 7 });
    const response = await GET(request({ authorization: 'Bearer cron-secret' }));
    const data = await response.json();
    const findQuery = mocks.findMany.mock.calls[0][0];
    const deleteQuery = mocks.deleteMany.mock.calls[0][0];

    expect(response.status).toBe(200);
    expect(data.checked).toBe(7);
    expect(data.deleted).toBe(7);
    expect(data.hasMore).toBe(false);
    expect(data.batchSize).toBe(1_000);
    expect(data.retentionDays).toBe(31);
    expect(data.anonymousRetentionHours).toBe(6);
    expect(findQuery.take).toBe(1_000);
    expect(findQuery.orderBy).toEqual({ lastSeen: 'asc' });
    expect(findQuery.where.OR[0]).toMatchObject({ userId: null });
    expect(findQuery.where.OR[1]).toMatchObject({ userId: { not: null } });
    expect(deleteQuery.where.sessionId.in).toHaveLength(7);
    expect(deleteQuery.where.OR).toEqual(findQuery.where.OR);
    expect(mocks.logInfo).toHaveBeenCalledWith(
      'Heartbeat Cleanup',
      'Deleted 7 expired heartbeat sessions',
    );
  });

  it('uses the larger bounded cleanup batch when the stale backlog is high', async () => {
    mocks.count.mockResolvedValue(2_501);

    const response = await GET(request({ authorization: 'Bearer cron-secret' }));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(mocks.findMany.mock.calls[0][0].take).toBe(5_000);
    expect(data.batchSize).toBe(5_000);
    expect(data.backlogEstimate).toBe(2_501);
  });

  it('contains database failures and leaves them observable', async () => {
    mocks.findMany.mockRejectedValue(new Error('database unavailable'));
    const response = await GET(request({ authorization: 'Bearer cron-secret' }));
    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({ error: 'Heartbeat cleanup failed' });
    expect(mocks.logError).toHaveBeenCalledWith('Heartbeat Cleanup', 'database unavailable');
    expect(mocks.reportOperationalFailure).toHaveBeenCalledWith('cleanup_failed', {
      error: expect.objectContaining({ message: 'database unavailable' }),
      data: { job: 'heartbeat_cleanup' },
      dedupeKey: 'cleanup_failed:heartbeat_cleanup',
    });
  });
});
