import { beforeEach, describe, expect, it, vi } from 'vitest';

const prisma = {
  order: { findMany: vi.fn() },
  transaction: { aggregate: vi.fn() },
  orderCreditUsage: { aggregate: vi.fn() },
  nitroPointLedger: { aggregate: vi.fn(), findMany: vi.fn() },
};

vi.mock('@/lib/prisma', () => ({ default: prisma }));
vi.mock('@/lib/logger', () => ({ log: { error: vi.fn() } }));

const getCurrentUser = vi.fn();
vi.mock('@/lib/auth', () => ({ getCurrentUser }));

const { GET } = await import('@/app/api/rewards/route');

beforeEach(() => {
  vi.clearAllMocks();
  prisma.order.findMany.mockResolvedValue([{ id: 'db-mock', orderId: 'NTR-MOCK', charge: 75000000 }]);
  prisma.transaction.aggregate.mockResolvedValue({ _sum: { amount: 0 } });
  prisma.orderCreditUsage.aggregate.mockResolvedValue({ _sum: { amount: 0 } });
  prisma.nitroPointLedger.aggregate.mockResolvedValue({ _sum: { pointsKobo: 845000 } });
  prisma.nitroPointLedger.findMany.mockResolvedValue([]);
});

describe('GET /api/rewards', () => {
  it('returns 401 when not authenticated', async () => {
    getCurrentUser.mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it('returns rewards payload when authenticated', async () => {
    getCurrentUser.mockResolvedValue({ id: 'user-1' });
    const res = await GET();
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.status.key).toBe('boost');
    expect(data.points.balance).toBe(8450);
    expect(data.points.redeemable).toBe(true);
    expect(data.history).toEqual([]);
  });
});
