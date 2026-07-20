import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  rateLimit: vi.fn(),
  requireAccess: vi.fn(),
  renewGrant: vi.fn(),
  liveFindMany: vi.fn(),
  userFindMany: vi.fn(),
  adminFindMany: vi.fn(),
  transactionGroupBy: vi.fn(),
}));

vi.mock('@/lib/rate-limit', () => ({
  rateLimit: (...args) => mocks.rateLimit(...args),
  rateLimitUnavailable: () => Response.json({ error: 'unavailable' }, { status: 503 }),
  tooManyRequests: () => Response.json({ error: 'limited' }, { status: 429 }),
}));
vi.mock('@/lib/internal-dashboard-access', () => ({
  requireInternalDashboardAccess: (...args) => mocks.requireAccess(...args),
  renewInternalDashboardGrant: (...args) => mocks.renewGrant(...args),
  internalDashboardAccessError: access => Response.json({ error: 'denied' }, {
    status: access.status,
  }),
  withInternalDashboardNoStore: response => {
    response.headers.set('Cache-Control', 'private, no-store');
    return response;
  },
}));
vi.mock('@/lib/logger', () => ({
  log: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));
vi.mock('@/lib/prisma', () => ({
  default: {
    liveSession: { findMany: (...args) => mocks.liveFindMany(...args) },
    user: { findMany: (...args) => mocks.userFindMany(...args) },
    admin: { findMany: (...args) => mocks.adminFindMany(...args) },
    transaction: { groupBy: (...args) => mocks.transactionGroupBy(...args) },
  },
}));

const { GET } = await import('@/app/api/live/route.js');

function request() {
  return new Request('https://nitro.test/api/live', {
    headers: { 'x-forwarded-for': '203.0.113.10' },
  });
}

function liveSession(index, userId, timestamp = Date.now()) {
  return {
    sessionId: `session-${index}`,
    userId,
    page: '/',
    ua: 'Browser',
    firstSeen: new Date(timestamp - 60_000),
    lastSeen: new Date(timestamp - index),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.rateLimit.mockResolvedValue({ limited: false, unavailable: false });
  mocks.requireAccess.mockResolvedValue({ ok: true, status: 200 });
  mocks.liveFindMany.mockResolvedValue([]);
  mocks.userFindMany.mockResolvedValue([]);
  mocks.adminFindMany.mockResolvedValue([]);
  mocks.transactionGroupBy.mockResolvedValue([]);
});

describe('Live capacity and aggregate reads', () => {
  it('queries identified and anonymous sessions separately with 400 slots reserved', async () => {
    const now = Date.now();
    const identified = Array.from(
      { length: 500 },
      (_, index) => liveSession(index, `identified-${index}`, now),
    );
    const anonymous = Array.from(
      { length: 100 },
      (_, index) => liveSession(index + 500, null, now + 1_000),
    );
    mocks.liveFindMany
      .mockResolvedValueOnce(identified)
      .mockResolvedValueOnce(anonymous);

    const response = await GET(request());
    const data = await response.json();
    const [identifiedQuery, anonymousQuery] = mocks.liveFindMany.mock.calls.map(call => call[0]);

    expect(response.status).toBe(200);
    expect(identifiedQuery.where.userId).toEqual({ not: null });
    expect(identifiedQuery.take).toBe(500);
    expect(anonymousQuery.where.userId).toBeNull();
    expect(anonymousQuery.take).toBe(100);
    expect(data.count).toBe(500);
    expect(data.sessions.every(session => session.user === null)).toBe(true);
    expect(data.truncated).toBe(true);
    expect(mocks.renewGrant).toHaveBeenCalledWith(
      expect.objectContaining({ ok: true }),
      response,
    );
  });

  it('loads completed deposit totals with one grouped aggregate instead of transaction rows', async () => {
    const now = Date.now();
    mocks.liveFindMany
      .mockResolvedValueOnce([liveSession(1, 'user-1', now)])
      .mockResolvedValueOnce([]);
    mocks.userFindMany.mockResolvedValue([{
      id: 'user-1',
      name: 'Customer',
      email: 'customer@example.test',
      balance: 12_500,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      signupSource: 'direct',
      orders: [],
      _count: { orders: 2 },
    }]);
    mocks.transactionGroupBy.mockResolvedValue([{
      userId: 'user-1',
      _sum: { amount: 987_600 },
    }]);

    const response = await GET(request());
    const data = await response.json();
    const userQuery = mocks.userFindMany.mock.calls[0][0];
    const aggregateQuery = mocks.transactionGroupBy.mock.calls[0][0];

    expect(response.status).toBe(200);
    expect(userQuery.select).not.toHaveProperty('transactions');
    expect(aggregateQuery).toEqual({
      by: ['userId'],
      where: {
        userId: { in: ['user-1'] },
        type: { in: ['deposit', 'admin_credit'] },
        status: 'Completed',
      },
      _sum: { amount: true },
    });
    expect(data.sessions[0].user.totalDeposited).toBe(9_876);
  });
});
