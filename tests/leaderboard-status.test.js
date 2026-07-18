import { beforeEach, describe, expect, it, vi } from 'vitest';

const prisma = {
  $queryRaw: vi.fn(),
  order: {
    groupBy: vi.fn(),
    count: vi.fn(),
  },
  user: { findMany: vi.fn() },
  setting: { findUnique: vi.fn() },
};

const getCurrentUser = vi.fn();

vi.mock('@/lib/prisma', () => ({ default: prisma }));
vi.mock('@/lib/auth', () => ({ getCurrentUser }));
vi.mock('@/lib/format', () => ({
  watBounds: () => ({ monthStart: new Date('2026-07-01T00:00:00.000Z') }),
}));

const { GET } = await import('@/app/api/leaderboard/route');

beforeEach(() => {
  vi.clearAllMocks();
  getCurrentUser.mockResolvedValue({ id: 'you' });

  prisma.order.groupBy
    .mockResolvedValueOnce([
      { userId: 'you', _count: { id: 8 } },
      { userId: 'spender', _count: { id: 7 } },
    ])
    .mockResolvedValueOnce([
      { userId: 'active', _count: { id: 10 } },
      { userId: 'you', _count: { id: 9 } },
    ]);

  prisma.user.findMany
    .mockResolvedValueOnce([
      { id: 'you', name: 'Current User', firstName: 'Current', lastName: 'User' },
      { id: 'spender', name: 'Top Spender', firstName: 'Top', lastName: 'Spender' },
    ])
    .mockResolvedValueOnce([]) // referral rows
    .mockResolvedValueOnce([]) // referrer profiles
    .mockResolvedValueOnce([
      { id: 'active', name: 'Active User', firstName: 'Active', lastName: 'User' },
      { id: 'you', name: 'Current User', firstName: 'Current', lastName: 'User' },
    ]);

  prisma.$queryRaw.mockResolvedValue([
    { userId: 'you', eligibleSpendKobo: 10000000n },
    { userId: 'spender', eligibleSpendKobo: 50000000n },
    { userId: 'active', eligibleSpendKobo: 200000000n },
  ]);
  prisma.order.count.mockResolvedValue(12);
  prisma.setting.findUnique.mockResolvedValue(null);
});

describe('GET /api/leaderboard — canonical Nitro Status', () => {
  it('uses one deduplicated eligible-spend batch for every displayed badge', async () => {
    const response = await GET(new Request('http://localhost/api/leaderboard?period=month'));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.spenders.map(row => [row.name, row.badge])).toEqual([
      ['Current U.', 'Pulse'],
      ['Top S.', 'Boost'],
    ]);
    expect(body.active.map(row => [row.name, row.badge])).toEqual([
      ['Active U.', 'Surge'],
      ['Current U.', 'Pulse'],
    ]);
    expect(body.yourBadge).toMatchObject({
      name: 'Pulse',
      color: '#60a5fa',
      totalOrders: 12,
      nextTier: { name: 'Boost', color: '#a78bfa' },
    });

    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
    expect(prisma.$queryRaw.mock.calls[0][1]).toEqual(['you', 'spender', 'active']);
    expect(prisma.order.groupBy).toHaveBeenCalledTimes(2);
    expect(prisma.order.count).toHaveBeenCalledWith({
      where: { userId: 'you', deletedAt: null, status: { not: 'Cancelled' } },
    });
  });

  it('defaults a displayed user with no eligible spend row to Spark', async () => {
    prisma.$queryRaw.mockResolvedValue([
      { userId: 'you', eligibleSpendKobo: 10000000n },
      { userId: 'spender', eligibleSpendKobo: 50000000n },
    ]);

    const response = await GET(new Request('http://localhost/api/leaderboard?period=month'));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.active[0]).toMatchObject({ name: 'Active U.', badge: 'Spark', badgeColor: '#9ca3af' });
  });

  it('does no leaderboard work for an unauthenticated request', async () => {
    getCurrentUser.mockResolvedValue(null);

    const response = await GET(new Request('http://localhost/api/leaderboard'));

    expect(response.status).toBe(401);
    expect(prisma.order.groupBy).not.toHaveBeenCalled();
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
  });
});
