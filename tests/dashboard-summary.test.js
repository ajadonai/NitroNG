import { beforeEach, describe, expect, it, vi } from 'vitest';

const prisma = {
  user: { findUnique: vi.fn(), findMany: vi.fn() },
  order: { findMany: vi.fn() },
  transaction: {
    updateMany: vi.fn(),
    findMany: vi.fn(),
    groupBy: vi.fn(),
    aggregate: vi.fn(),
  },
  alert: { findMany: vi.fn() },
  setting: { findUnique: vi.fn() },
  ticket: { findMany: vi.fn() },
  $queryRaw: vi.fn(),
};

vi.mock('@/lib/prisma', () => ({ default: prisma }));
vi.mock('@/lib/auth', () => ({ getCurrentUser: vi.fn().mockResolvedValue({ id: 'user-1' }) }));
vi.mock('@/lib/logger', () => ({ log: { error: vi.fn() } }));
vi.mock('@/lib/bonus-credit', () => ({ getBonusInfo: vi.fn().mockResolvedValue(null) }));

const { GET } = await import('@/app/api/dashboard/route');

beforeEach(() => {
  vi.clearAllMocks();
  prisma.user.findUnique.mockResolvedValue({
    id: 'user-1',
    name: 'Test User',
    firstName: 'Test',
    lastName: 'User',
    phone: null,
    email: 'test@example.com',
    balance: 100000,
    referralCode: 'REF1',
    referredBy: null,
    emailVerified: true,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    orderTourCompleted: false,
    notifOrders: true,
    notifPromo: true,
    notifEmail: true,
    tosVersion: null,
    firstDepositBonusPaid: true,
    _count: { transactions: 143 },
  });
  prisma.order.findMany.mockResolvedValue([]);
  prisma.$queryRaw.mockResolvedValue([{
    total: 80,
    nonCancelled: 75,
    active: 7,
    completed: 68,
    thisWeek: 9,
    attention: 2,
    spentKobo: 2500000n,
    refundedKobo: 150000n,
    averageQuantity: 450,
    topPlatform: 'instagram',
  }]);
  prisma.transaction.updateMany.mockResolvedValue({ count: 0 });
  prisma.transaction.findMany.mockResolvedValue([]);
  prisma.transaction.groupBy.mockResolvedValue([]);
  prisma.transaction.aggregate.mockResolvedValue({ _sum: { amount: 0 } });
  prisma.user.findMany.mockResolvedValue([]);
  prisma.alert.findMany.mockResolvedValue([]);
  prisma.setting.findUnique.mockResolvedValue(null);
  prisma.ticket.findMany.mockResolvedValue([]);
});

describe('GET /api/dashboard — bounded rows with exact summaries', () => {
  it('returns exact order aggregates separately from bounded order rows', async () => {
    const response = await GET();
    const body = await response.json();

    expect(body.orders).toEqual([]);
    expect(body.ordersTotal).toBe(80);
    expect(body.orderSummary).toEqual({
      total: 80,
      active: 7,
      completed: 68,
      thisWeek: 9,
      attention: 2,
      spent: 25000,
      refunded: 1500,
      averageQuantity: 450,
      topPlatform: 'instagram',
    });
    expect(body.user.totalOrders).toBe(75);
    expect(prisma.order.findMany).toHaveBeenCalledTimes(2);
    expect(prisma.order.findMany.mock.calls[0][0].take).toBe(25);
    expect(prisma.order.findMany.mock.calls[1][0].take).toBe(5);
  });

  it('limits visible transaction rows to the 180-day window while preserving its count', async () => {
    const response = await GET();
    const body = await response.json();

    const historyQuery = prisma.transaction.findMany.mock.calls[0][0];
    expect(historyQuery.take).toBe(100);
    expect(historyQuery.where.createdAt.gte).toBeInstanceOf(Date);
    expect(body.transactionsTotal).toBe(143);
  });
});
