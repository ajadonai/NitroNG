import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/logger', () => ({ log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));

// Mock prisma before importing the module
const mockPrisma = {
  order: { findMany: vi.fn() },
  transaction: { aggregate: vi.fn() },
  nitroPointLedger: { aggregate: vi.fn(), findMany: vi.fn() },
};
vi.mock('@/lib/prisma', () => ({ default: mockPrisma }));

const {
  getNitroStatus,
  getStatusTiers,
  getEligibleSpendKobo,
  getPointsBalanceKobo,
  getRewardsPayload,
  STATUS_TIERS,
  MIN_REDEEM_POINTS,
} = await import('@/lib/nitro-rewards');

beforeEach(() => {
  vi.clearAllMocks();
});

// ── Tier calculation ──

describe('getNitroStatus', () => {
  it('returns Spark for zero spend', () => {
    expect(getNitroStatus(0).key).toBe('spark');
  });

  it('returns Spark just below Pulse threshold', () => {
    expect(getNitroStatus(399999).key).toBe('spark');
  });

  it('returns Pulse at exact boundary', () => {
    expect(getNitroStatus(400000).key).toBe('pulse');
  });

  it('returns Boost at 1.5m', () => {
    expect(getNitroStatus(1500000).key).toBe('boost');
  });

  it('returns Surge at 7.5m', () => {
    expect(getNitroStatus(7500000).key).toBe('surge');
  });

  it('returns Apex at 37.5m', () => {
    expect(getNitroStatus(37500000).key).toBe('apex');
  });

  it('returns Legend at 75m', () => {
    expect(getNitroStatus(75000000).key).toBe('legend');
  });

  it('returns Legend for very high spend', () => {
    expect(getNitroStatus(500000000).key).toBe('legend');
  });

  it('returns correct discount and earn rate for each tier', () => {
    expect(getNitroStatus(0).discountPct).toBe(0);
    expect(getNitroStatus(0).pointEarnPct).toBe(0.5);
    expect(getNitroStatus(400000).discountPct).toBe(0.5);
    expect(getNitroStatus(400000).pointEarnPct).toBe(1);
    expect(getNitroStatus(75000000).discountPct).toBe(4);
    expect(getNitroStatus(75000000).pointEarnPct).toBe(2);
  });
});

describe('getStatusTiers', () => {
  it('returns 6 tiers', () => {
    expect(getStatusTiers()).toHaveLength(6);
  });

  it('tiers are sorted by min ascending', () => {
    const tiers = getStatusTiers();
    for (let i = 1; i < tiers.length; i++) {
      expect(tiers[i].min).toBeGreaterThan(tiers[i - 1].min);
    }
  });
});

// ── Eligible spend ──

describe('getEligibleSpendKobo', () => {
  it('sums completed and partial orders minus scoped refunds', async () => {
    mockPrisma.order.findMany.mockResolvedValue([
      { orderId: 'NTR-1', charge: 600000 },
      { orderId: 'NTR-2', charge: 400000 },
    ]);
    mockPrisma.transaction.aggregate.mockResolvedValue({ _sum: { amount: 200000 } });

    const result = await getEligibleSpendKobo('user1');
    expect(result).toBe(800000);

    expect(mockPrisma.transaction.aggregate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          reference: { in: ['REF-NTR-1', 'ADM-REF-NTR-1', 'REF-NTR-2', 'ADM-REF-NTR-2'] },
        }),
      }),
    );
  });

  it('returns 0 when no orders exist', async () => {
    mockPrisma.order.findMany.mockResolvedValue([]);

    expect(await getEligibleSpendKobo('user1')).toBe(0);
    expect(mockPrisma.transaction.aggregate).not.toHaveBeenCalled();
  });

  it('clamps to 0 when refunds exceed charges', async () => {
    mockPrisma.order.findMany.mockResolvedValue([{ orderId: 'NTR-1', charge: 50000 }]);
    mockPrisma.transaction.aggregate.mockResolvedValue({ _sum: { amount: 100000 } });

    expect(await getEligibleSpendKobo('user1')).toBe(0);
  });

  it('handles partial refund — only refunded value subtracted', async () => {
    mockPrisma.order.findMany.mockResolvedValue([{ orderId: 'NTR-1', charge: 500000 }]);
    mockPrisma.transaction.aggregate.mockResolvedValue({ _sum: { amount: 150000 } });

    expect(await getEligibleSpendKobo('user1')).toBe(350000);
  });

  it('cancelled order refund does not reduce eligible spend', async () => {
    // Only the completed order is returned by findMany (cancelled is excluded by the query)
    // So the cancelled order's refund reference won't be in the refs list
    mockPrisma.order.findMany.mockResolvedValue([
      { orderId: 'NTR-1', charge: 1000000 },
      // NTR-2 is cancelled — NOT returned by the Completed+Partial query
    ]);
    // Only refunds scoped to eligible order refs are counted
    // The cancelled order's refund (REF-NTR-2) is never queried
    mockPrisma.transaction.aggregate.mockResolvedValue({ _sum: { amount: 0 } });

    expect(await getEligibleSpendKobo('user1')).toBe(1000000);
  });
});

// ── Points balance ──

describe('getPointsBalanceKobo', () => {
  it('returns ledger sum', async () => {
    mockPrisma.nitroPointLedger.aggregate.mockResolvedValue({ _sum: { pointsKobo: 845000 } });

    expect(await getPointsBalanceKobo('user1')).toBe(845000);
  });

  it('returns 0 for empty ledger', async () => {
    mockPrisma.nitroPointLedger.aggregate.mockResolvedValue({ _sum: { pointsKobo: null } });

    expect(await getPointsBalanceKobo('user1')).toBe(0);
  });

  it('handles negative balance', async () => {
    mockPrisma.nitroPointLedger.aggregate.mockResolvedValue({ _sum: { pointsKobo: -5000 } });

    expect(await getPointsBalanceKobo('user1')).toBe(-5000);
  });
});

// ── Rewards payload ──

describe('getRewardsPayload', () => {
  function setupMocks({ chargeKobo = 0, refundKobo = 0, balanceKobo = 0, history = [] } = {}) {
    mockPrisma.order.findMany.mockResolvedValue(
      chargeKobo ? [{ orderId: 'NTR-MOCK', charge: chargeKobo }] : [],
    );
    mockPrisma.transaction.aggregate.mockResolvedValue({ _sum: { amount: refundKobo || null } });
    mockPrisma.nitroPointLedger.aggregate.mockResolvedValue({ _sum: { pointsKobo: balanceKobo || null } });
    mockPrisma.nitroPointLedger.findMany.mockResolvedValue(history);
  }

  it('returns correct shape for new user', async () => {
    setupMocks();
    const r = await getRewardsPayload('user1');

    expect(r.status.key).toBe('spark');
    expect(r.status.name).toBe('Spark');
    expect(r.status.eligibleSpend).toBe(0);
    expect(r.status.discountPct).toBe(0);
    expect(r.status.pointEarnPct).toBe(0.5);
    expect(r.status.nextName).toBe('Pulse');
    expect(r.status.nextMin).toBe(400000);
    expect(r.status.remainingToNext).toBe(400000);
    expect(r.status.progressPct).toBe(0);

    expect(r.points.balance).toBe(0);
    expect(r.points.valueNaira).toBe(0);
    expect(r.points.minRedeem).toBe(5000);
    expect(r.points.redeemable).toBe(false);
    expect(r.points.neededToRedeem).toBe(5000);

    expect(r.history).toEqual([]);
  });

  it('returns correct tier for Boost user', async () => {
    // 2,430,000 naira = 243,000,000 kobo
    setupMocks({ chargeKobo: 243000000 });
    const r = await getRewardsPayload('user1');

    expect(r.status.key).toBe('boost');
    expect(r.status.eligibleSpend).toBe(2430000);
    expect(r.status.nextName).toBe('Surge');
    expect(r.status.remainingToNext).toBe(5070000);
    expect(r.status.discountPct).toBe(1);
    expect(r.status.pointEarnPct).toBe(1.25);
  });

  it('shows redeemable when balance >= 5000 points', async () => {
    // 8450 points = 845000 pointsKobo
    setupMocks({ balanceKobo: 845000 });
    const r = await getRewardsPayload('user1');

    expect(r.points.balance).toBe(8450);
    expect(r.points.redeemable).toBe(true);
    expect(r.points.neededToRedeem).toBe(0);
  });

  it('shows not redeemable when balance < 5000 points', async () => {
    // 3200 points = 320000 pointsKobo
    setupMocks({ balanceKobo: 320000 });
    const r = await getRewardsPayload('user1');

    expect(r.points.balance).toBe(3200);
    expect(r.points.redeemable).toBe(false);
    expect(r.points.neededToRedeem).toBe(1800);
  });

  it('shows 100% progress for Legend tier', async () => {
    // 100m naira = 10,000,000,000 kobo
    setupMocks({ chargeKobo: 10000000000 });
    const r = await getRewardsPayload('user1');

    expect(r.status.key).toBe('legend');
    expect(r.status.nextName).toBe(null);
    expect(r.status.progressPct).toBe(100);
    expect(r.status.remainingToNext).toBe(0);
  });

  it('formats history entries correctly', async () => {
    setupMocks({
      history: [
        { type: 'earned_order', pointsKobo: 12500, order: { orderId: 'NTR-2475' }, orderId: 'abc', reason: null },
        { type: 'redeemed_order', pointsKobo: -500000, order: { orderId: 'NTR-2480' }, orderId: 'def', reason: null },
        { type: 'manual_credit', pointsKobo: 10000, order: null, orderId: null, reason: 'Goodwill' },
      ],
    });
    const r = await getRewardsPayload('user1');

    expect(r.history[0]).toEqual({ kind: 'earned', label: 'Earned', ref: '#NTR-2475', refType: 'order', pts: 125 });
    expect(r.history[1]).toEqual({ kind: 'spent', label: 'Spent', ref: '#NTR-2480', refType: 'order', pts: -5000 });
    expect(r.history[2]).toEqual({ kind: 'earned', label: 'Credit', ref: 'Goodwill', refType: 'admin', pts: 100 });
  });
});
