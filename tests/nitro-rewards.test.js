import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/logger', () => ({ log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));

// Mock prisma before importing the module
const mockPrisma = {
  order: { findMany: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
  transaction: { aggregate: vi.fn() },
  orderCreditUsage: { aggregate: vi.fn() },
  nitroPointLedger: { aggregate: vi.fn(), findMany: vi.fn(), groupBy: vi.fn(), create: vi.fn() },
};
vi.mock('@/lib/prisma', () => ({ default: mockPrisma }));

const {
  getNitroStatus,
  getStatusTiers,
  getEligibleSpendKobo,
  getPointsBalanceKobo,
  getPointsBalanceKoboTx,
  getRewardsPayload,
  computeNitroDiscount,
  computePointsEarnedKobo,
  awardOrderPoints,
  reverseOrderPoints,
  awardPointsOnCompletion,
  computeRefundSplit,
  getTotalRefundedKobo,
  getPointsTotals,
  pointsFromKobo,
  pointsFromKoboExact,
  STATUS_TIERS,
  MIN_REDEEM_POINTS,
} = await import('@/lib/nitro-rewards');

beforeEach(() => {
  vi.clearAllMocks();
  mockPrisma.orderCreditUsage.aggregate.mockResolvedValue({ _sum: { amount: 0 } });
});

// ── Tier calculation ──

describe('getNitroStatus', () => {
  it('returns Spark for zero spend', () => {
    expect(getNitroStatus(0).key).toBe('spark');
  });

  it('returns Spark just below Pulse threshold', () => {
    expect(getNitroStatus(99999).key).toBe('spark');
  });

  it('returns Pulse at exact boundary', () => {
    expect(getNitroStatus(100000).key).toBe('pulse');
  });

  it('returns Boost at 500k', () => {
    expect(getNitroStatus(500000).key).toBe('boost');
  });

  it('returns Surge at 2m', () => {
    expect(getNitroStatus(2000000).key).toBe('surge');
  });

  it('returns Apex at 7.5m', () => {
    expect(getNitroStatus(7500000).key).toBe('apex');
  });

  it('returns Legend at 15m', () => {
    expect(getNitroStatus(15000000).key).toBe('legend');
  });

  it('returns Legend for very high spend', () => {
    expect(getNitroStatus(500000000).key).toBe('legend');
  });

  it('returns correct discount and earn rate for each tier', () => {
    expect(getNitroStatus(0).discountPct).toBe(0);
    expect(getNitroStatus(0).pointEarnPct).toBe(0.5);
    expect(getNitroStatus(100000).discountPct).toBe(0.5);
    expect(getNitroStatus(100000).pointEarnPct).toBe(1);
    expect(getNitroStatus(15000000).discountPct).toBe(4);
    expect(getNitroStatus(15000000).pointEarnPct).toBe(2);
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
      { id: 'db-1', orderId: 'NTR-1', charge: 600000 },
      { id: 'db-2', orderId: 'NTR-2', charge: 400000 },
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
    mockPrisma.order.findMany.mockResolvedValue([{ id: 'db-1', orderId: 'NTR-1', charge: 50000 }]);
    mockPrisma.transaction.aggregate.mockResolvedValue({ _sum: { amount: 100000 } });

    expect(await getEligibleSpendKobo('user1')).toBe(0);
  });

  it('handles partial refund — only refunded value subtracted', async () => {
    mockPrisma.order.findMany.mockResolvedValue([{ id: 'db-1', orderId: 'NTR-1', charge: 500000 }]);
    mockPrisma.transaction.aggregate.mockResolvedValue({ _sum: { amount: 150000 } });

    expect(await getEligibleSpendKobo('user1')).toBe(350000);
  });

  it('cancelled order refund does not reduce eligible spend', async () => {
    mockPrisma.order.findMany.mockResolvedValue([
      { id: 'db-1', orderId: 'NTR-1', charge: 1000000 },
    ]);
    mockPrisma.transaction.aggregate.mockResolvedValue({ _sum: { amount: 0 } });

    expect(await getEligibleSpendKobo('user1')).toBe(1000000);
  });

  it('subtracts bonus credit usage from eligible spend', async () => {
    mockPrisma.order.findMany.mockResolvedValue([
      { id: 'db-1', orderId: 'NTR-1', charge: 1000000 },
    ]);
    mockPrisma.transaction.aggregate.mockResolvedValue({ _sum: { amount: 0 } });
    mockPrisma.orderCreditUsage.aggregate.mockResolvedValue({ _sum: { amount: 300000 } });

    expect(await getEligibleSpendKobo('user1')).toBe(700000);
  });

  it('order fully paid by bonus has zero eligible spend', async () => {
    mockPrisma.order.findMany.mockResolvedValue([
      { id: 'db-1', orderId: 'NTR-1', charge: 500000 },
    ]);
    mockPrisma.transaction.aggregate.mockResolvedValue({ _sum: { amount: 0 } });
    mockPrisma.orderCreditUsage.aggregate.mockResolvedValue({ _sum: { amount: 500000 } });

    expect(await getEligibleSpendKobo('user1')).toBe(0);
  });

  it('cancelled order bonus usage does not reduce spend (cancelled orders excluded by query)', async () => {
    // Only completed orders are returned; cancelled orders and their bonus usage are not queried
    mockPrisma.order.findMany.mockResolvedValue([
      { id: 'db-1', orderId: 'NTR-1', charge: 800000 },
    ]);
    mockPrisma.transaction.aggregate.mockResolvedValue({ _sum: { amount: 0 } });
    // Only bonus usage for db-1 is aggregated; cancelled order's db ID isn't in the list
    mockPrisma.orderCreditUsage.aggregate.mockResolvedValue({ _sum: { amount: 0 } });

    expect(await getEligibleSpendKobo('user1')).toBe(800000);
    expect(mockPrisma.orderCreditUsage.aggregate).toHaveBeenCalledWith(
      expect.objectContaining({ where: { orderId: { in: ['db-1'] } } }),
    );
  });

  it('subtracts redeemed points from eligible spend', async () => {
    mockPrisma.order.findMany.mockResolvedValue([
      { id: 'db-1', orderId: 'NTR-1', charge: 1000000, nitroPointsRedeemedKobo: 500000 },
    ]);
    mockPrisma.transaction.aggregate.mockResolvedValue({ _sum: { amount: 0 } });

    expect(await getEligibleSpendKobo('user1')).toBe(500000);
  });

  it('subtracts both bonus and redeemed points from eligible spend', async () => {
    mockPrisma.order.findMany.mockResolvedValue([
      { id: 'db-1', orderId: 'NTR-1', charge: 1000000, nitroPointsRedeemedKobo: 300000 },
    ]);
    mockPrisma.transaction.aggregate.mockResolvedValue({ _sum: { amount: 0 } });
    mockPrisma.orderCreditUsage.aggregate.mockResolvedValue({ _sum: { amount: 200000 } });

    expect(await getEligibleSpendKobo('user1')).toBe(500000);
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
  function setupMocks({ chargeKobo = 0, refundKobo = 0, bonusKobo = 0, balanceKobo = 0, history = [] } = {}) {
    mockPrisma.order.findMany.mockResolvedValue(
      chargeKobo ? [{ id: 'db-mock', orderId: 'NTR-MOCK', charge: chargeKobo }] : [],
    );
    mockPrisma.orderCreditUsage.aggregate.mockResolvedValue({ _sum: { amount: bonusKobo || null } });
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
    expect(r.status.nextMin).toBe(100000);
    expect(r.status.remainingToNext).toBe(100000);
    expect(r.status.progressPct).toBe(0);

    expect(r.points.balance).toBe(0);
    expect(r.points.valueNaira).toBe(0);
    expect(r.points.minRedeem).toBe(2000);
    expect(r.points.redeemable).toBe(false);
    expect(r.points.neededToRedeem).toBe(2000);

    expect(r.history).toEqual([]);
  });

  it('returns correct tier for Boost user', async () => {
    // 750,000 naira = 75,000,000 kobo
    setupMocks({ chargeKobo: 75000000 });
    const r = await getRewardsPayload('user1');

    expect(r.status.key).toBe('boost');
    expect(r.status.eligibleSpend).toBe(750000);
    expect(r.status.nextName).toBe('Surge');
    expect(r.status.remainingToNext).toBe(1250000);
    expect(r.status.discountPct).toBe(1);
    expect(r.status.pointEarnPct).toBe(1.25);
  });

  it('shows redeemable when balance >= 2000 points', async () => {
    // 3200 points = 320000 pointsKobo
    setupMocks({ balanceKobo: 320000 });
    const r = await getRewardsPayload('user1');

    expect(r.points.balance).toBe(3200);
    expect(r.points.redeemable).toBe(true);
    expect(r.points.neededToRedeem).toBe(0);
  });

  it('floors fractional points in the balance', async () => {
    setupMocks({ balanceKobo: 11112 });
    const r = await getRewardsPayload('user1');

    expect(r.points.balance).toBe(111);
    expect(r.points.valueNaira).toBe(111);
    expect(r.points.redeemable).toBe(false);
    expect(r.points.neededToRedeem).toBe(1889);
  });

  it('shows not redeemable when balance < 2000 points', async () => {
    // 1200 points = 120000 pointsKobo
    setupMocks({ balanceKobo: 120000 });
    const r = await getRewardsPayload('user1');

    expect(r.points.balance).toBe(1200);
    expect(r.points.redeemable).toBe(false);
    expect(r.points.neededToRedeem).toBe(800);
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

  it('preserves exact signed points in history entries', async () => {
    setupMocks({
      history: [
        { type: 'earned_order', pointsKobo: 149, order: { orderId: 'NTR-2862' }, orderId: 'abc', reason: null },
        { type: 'manual_debit', pointsKobo: -6540, order: { orderId: 'NTR-2860' }, orderId: 'def', reason: 'Correction' },
        { type: 'manual_credit', pointsKobo: 60, order: null, orderId: null, reason: 'Small credit' },
        { type: 'manual_debit', pointsKobo: -60, order: null, orderId: null, reason: 'Small correction' },
      ],
    });
    const r = await getRewardsPayload('user1');

    expect(r.history[0].pts).toBe(1.49);
    expect(r.history[1].pts).toBe(-65.4);
    expect(r.history[2].pts).toBe(0.6);
    expect(r.history[3].pts).toBe(-0.6);
  });
});

describe('pointsFromKobo', () => {
  it('truncates kobo to whole display points without exaggerating signed values', () => {
    expect(pointsFromKobo(149)).toBe(1);
    expect(pointsFromKobo(6540)).toBe(65);
    expect(pointsFromKobo(5000)).toBe(50);
    expect(pointsFromKobo(99)).toBe(0);
    expect(pointsFromKobo(-99)).toBe(0);
    expect(pointsFromKobo(-6540)).toBe(-65);
    expect(pointsFromKobo(0)).toBe(0);
  });

  it('preserves two-decimal precision for ledger and finance displays', () => {
    expect(pointsFromKoboExact(149)).toBe(1.49);
    expect(pointsFromKoboExact(60)).toBe(0.6);
    expect(pointsFromKoboExact(-60)).toBe(-0.6);
    expect(pointsFromKoboExact(-6540)).toBe(-65.4);
  });
});

// ── Phase 2: Discount + earning helpers ──

describe('computeNitroDiscount', () => {
  it('returns 0 for Spark tier (0% discount)', () => {
    const spark = getNitroStatus(0);
    expect(computeNitroDiscount(500000, spark)).toBe(0);
  });

  it('computes correct discount for Pulse (0.5%)', () => {
    const pulse = getNitroStatus(100000);
    expect(computeNitroDiscount(1000000, pulse)).toBe(5000);
  });

  it('computes correct discount for Legend (4%)', () => {
    const legend = getNitroStatus(15000000);
    expect(computeNitroDiscount(1000000, legend)).toBe(40000);
  });

  it('returns 0 when tier is null', () => {
    expect(computeNitroDiscount(500000, null)).toBe(0);
  });

  it('rounds to nearest integer', () => {
    const pulse = getNitroStatus(100000);
    expect(computeNitroDiscount(333333, pulse)).toBe(Math.round(333333 * 0.005));
  });
});

describe('computePointsEarnedKobo', () => {
  it('earns 0.5% for Spark tier', () => {
    const spark = getNitroStatus(0);
    expect(computePointsEarnedKobo(1000000, spark)).toBe(5000);
  });

  it('earns 1% for Pulse tier', () => {
    const pulse = getNitroStatus(100000);
    expect(computePointsEarnedKobo(1000000, pulse)).toBe(10000);
  });

  it('earns 2% for Legend tier', () => {
    const legend = getNitroStatus(15000000);
    expect(computePointsEarnedKobo(1000000, legend)).toBe(20000);
  });

  it('floors the result', () => {
    const spark = getNitroStatus(0);
    expect(computePointsEarnedKobo(999, spark)).toBe(Math.floor(999 * 0.5 / 100));
  });

  it('returns 0 for zero charge', () => {
    const pulse = getNitroStatus(100000);
    expect(computePointsEarnedKobo(0, pulse)).toBe(0);
  });

  it('returns 0 when tier is null', () => {
    expect(computePointsEarnedKobo(1000000, null)).toBe(0);
  });
});

describe('awardOrderPoints', () => {
  const mockTx = {
    nitroPointLedger: { create: vi.fn() },
    order: { update: vi.fn() },
  };

  beforeEach(() => {
    mockTx.nitroPointLedger.create.mockReset();
    mockTx.order.update.mockReset();
  });

  it('creates ledger entry and updates order', async () => {
    const tier = getNitroStatus(100000); // Pulse, 1%
    const result = await awardOrderPoints(mockTx, {
      userId: 'u1', orderId: 'NTR-100', orderDbId: 'db-1', chargeKobo: 500000, tier,
    });

    expect(result).toBe(5000); // 500000 * 1% = 5000
    expect(mockTx.nitroPointLedger.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'u1',
        type: 'earned_order',
        pointsKobo: 5000,
        dedupeKey: 'earned_order:db-1',
        orderId: 'db-1',
        statusAtEvent: 'pulse',
        pointRateAtEvent: 1,
      }),
    });
    expect(mockTx.order.update).toHaveBeenCalledWith({
      where: { id: 'db-1' },
      data: { nitroPointsEarnedKobo: 5000 },
    });
  });

  it('returns 0 and skips writes for Spark with tiny charge', () => {
    const spark = getNitroStatus(0); // 0.5%
    const result = awardOrderPoints(mockTx, {
      userId: 'u1', orderId: 'NTR-101', orderDbId: 'db-2', chargeKobo: 100, tier: spark,
    });
    return result.then(r => {
      expect(r).toBe(0);
      expect(mockTx.nitroPointLedger.create).not.toHaveBeenCalled();
    });
  });

  it('order fully paid by bonus earns 0 points', async () => {
    const pulse = getNitroStatus(100000);
    const result = await awardOrderPoints(mockTx, {
      userId: 'u1', orderId: 'NTR-102', orderDbId: 'db-3', chargeKobo: 0, tier: pulse,
    });
    expect(result).toBe(0);
    expect(mockTx.nitroPointLedger.create).not.toHaveBeenCalled();
  });

  it('order partly paid by bonus earns points only on cash-funded part', async () => {
    const pulse = getNitroStatus(100000); // 1% earn
    // charge was 500000 but 200000 was bonus, so eligibleCharge = 300000
    const result = await awardOrderPoints(mockTx, {
      userId: 'u1', orderId: 'NTR-103', orderDbId: 'db-4', chargeKobo: 300000, tier: pulse,
    });
    expect(result).toBe(3000); // 300000 * 1% = 3000
    expect(mockTx.nitroPointLedger.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        pointsKobo: 3000,
        eligibleSpendKobo: 300000,
      }),
    });
  });
});

// ── Phase 3: Refund reversal ──

describe('reverseOrderPoints', () => {
  const mockTx = {
    order: { findUnique: vi.fn() },
    nitroPointLedger: { aggregate: vi.fn(), create: vi.fn() },
  };

  beforeEach(() => {
    mockTx.order.findUnique.mockReset();
    mockTx.nitroPointLedger.aggregate.mockReset();
    mockTx.nitroPointLedger.create.mockReset();
    mockTx.nitroPointLedger.aggregate.mockResolvedValue({ _sum: { pointsKobo: 0 } });
  });

  it('reverses full earned points on full refund', async () => {
    mockTx.order.findUnique.mockResolvedValue({
      charge: 500000, nitroPointsEarnedKobo: 5000, userId: 'u1', nitroStatusAtPurchase: 'pulse',
    });
    const result = await reverseOrderPoints(mockTx, { orderDbId: 'db-1', refundAmountKobo: 500000 });
    expect(result).toBe(5000);
    expect(mockTx.nitroPointLedger.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'u1',
        type: 'reversed_refund',
        pointsKobo: -5000,
        orderId: 'db-1',
        statusAtEvent: 'pulse',
      }),
    });
  });

  it('reverses proportionally on partial refund', async () => {
    mockTx.order.findUnique.mockResolvedValue({
      charge: 1000000, nitroPointsEarnedKobo: 10000, userId: 'u1', nitroStatusAtPurchase: 'boost',
    });
    const result = await reverseOrderPoints(mockTx, { orderDbId: 'db-2', refundAmountKobo: 400000 });
    expect(result).toBe(4000); // floor(10000 * 400000/1000000)
  });

  it('caps reversal at remaining unreversed amount', async () => {
    mockTx.order.findUnique.mockResolvedValue({
      charge: 1000000, nitroPointsEarnedKobo: 10000, userId: 'u1', nitroStatusAtPurchase: 'boost',
    });
    // Already reversed 7000 of 10000
    mockTx.nitroPointLedger.aggregate.mockResolvedValue({ _sum: { pointsKobo: -7000 } });
    const result = await reverseOrderPoints(mockTx, { orderDbId: 'db-3', refundAmountKobo: 500000 });
    // Proportional would be 5000, but only 3000 left
    expect(result).toBe(3000);
  });

  it('returns 0 when order earned no points', async () => {
    mockTx.order.findUnique.mockResolvedValue({
      charge: 500000, nitroPointsEarnedKobo: 0, userId: 'u1', nitroStatusAtPurchase: 'spark',
    });
    const result = await reverseOrderPoints(mockTx, { orderDbId: 'db-4', refundAmountKobo: 500000 });
    expect(result).toBe(0);
    expect(mockTx.nitroPointLedger.create).not.toHaveBeenCalled();
  });

  it('returns 0 when already fully reversed', async () => {
    mockTx.order.findUnique.mockResolvedValue({
      charge: 500000, nitroPointsEarnedKobo: 5000, userId: 'u1', nitroStatusAtPurchase: 'pulse',
    });
    mockTx.nitroPointLedger.aggregate.mockResolvedValue({ _sum: { pointsKobo: -5000 } });
    const result = await reverseOrderPoints(mockTx, { orderDbId: 'db-5', refundAmountKobo: 500000 });
    expect(result).toBe(0);
    expect(mockTx.nitroPointLedger.create).not.toHaveBeenCalled();
  });

  it('returns 0 when refund amount is 0', async () => {
    const result = await reverseOrderPoints(mockTx, { orderDbId: 'db-6', refundAmountKobo: 0 });
    expect(result).toBe(0);
    expect(mockTx.order.findUnique).not.toHaveBeenCalled();
  });

  it('allows negative balance after reversal (plan requirement)', async () => {
    mockTx.order.findUnique.mockResolvedValue({
      charge: 500000, nitroPointsEarnedKobo: 5000, userId: 'u1', nitroStatusAtPurchase: 'pulse',
    });
    const result = await reverseOrderPoints(mockTx, { orderDbId: 'db-7', refundAmountKobo: 500000 });
    expect(result).toBe(5000);
    expect(mockTx.nitroPointLedger.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ pointsKobo: -5000 }),
    });
  });

  it('reverses points on drip order provider rejection (regression)', async () => {
    // Drip order placed, batch-1 dispatch throws "incorrect service", full auto-refund fires
    mockTx.order.findUnique.mockResolvedValue({
      charge: 800000, nitroPointsEarnedKobo: 4000, userId: 'u1', nitroStatusAtPurchase: 'pulse',
    });
    const result = await reverseOrderPoints(mockTx, { orderDbId: 'db-drip', refundAmountKobo: 800000 });
    expect(result).toBe(4000);
    expect(mockTx.nitroPointLedger.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        type: 'reversed_refund',
        pointsKobo: -4000,
        orderId: 'db-drip',
      }),
    });
  });
});

// ── Phase 4: Redemption helpers ──

describe('getPointsBalanceKoboTx', () => {
  it('returns balance from transaction-scoped aggregate', async () => {
    const mockTx = {
      nitroPointLedger: { aggregate: vi.fn().mockResolvedValue({ _sum: { pointsKobo: 750000 } }) },
    };
    const result = await getPointsBalanceKoboTx(mockTx, 'u1');
    expect(result).toBe(750000);
    expect(mockTx.nitroPointLedger.aggregate).toHaveBeenCalledWith({
      where: { userId: 'u1' },
      _sum: { pointsKobo: true },
    });
  });

  it('returns 0 when no ledger entries', async () => {
    const mockTx = {
      nitroPointLedger: { aggregate: vi.fn().mockResolvedValue({ _sum: { pointsKobo: null } }) },
    };
    const result = await getPointsBalanceKoboTx(mockTx, 'u1');
    expect(result).toBe(0);
  });
});

describe('computeRefundSplit', () => {
  it('returns full charge as wallet refund when no points redeemed', () => {
    const { walletRefund, pointsRestore } = computeRefundSplit(500000, 0, 500000);
    expect(walletRefund).toBe(500000);
    expect(pointsRestore).toBe(0);
  });

  it('splits full refund between wallet and points', () => {
    const { walletRefund, pointsRestore } = computeRefundSplit(1000000, 500000, 1000000);
    expect(walletRefund).toBe(500000);
    expect(pointsRestore).toBe(500000);
  });

  it('splits partial refund proportionally', () => {
    // Order: 1000000 charge, 400000 redeemed. 50% refund.
    const { walletRefund, pointsRestore } = computeRefundSplit(1000000, 400000, 500000);
    // walletPaid = 600000, fraction = 0.5 → walletRefund = 300000
    expect(walletRefund).toBe(300000);
    // pointsRestore = floor(400000 * 0.5) = 200000
    expect(pointsRestore).toBe(200000);
  });

  it('returns zeros when charge is 0', () => {
    const { walletRefund, pointsRestore } = computeRefundSplit(0, 0, 0);
    expect(walletRefund).toBe(0);
    expect(pointsRestore).toBe(0);
  });

  it('handles fully points-funded order refund', () => {
    const { walletRefund, pointsRestore } = computeRefundSplit(500000, 500000, 500000);
    expect(walletRefund).toBe(0);
    expect(pointsRestore).toBe(500000);
  });

  it('floors fractional amounts', () => {
    // charge=333333, redeemed=100000, refund=166666 (50% ish)
    const { walletRefund, pointsRestore } = computeRefundSplit(333333, 100000, 166666);
    expect(walletRefund).toBe(Math.floor(233333 * 166666 / 333333));
    expect(pointsRestore).toBe(Math.floor(100000 * 166666 / 333333));
  });
});

describe('reverseOrderPoints — point restoration', () => {
  const mockTx = {
    order: { findUnique: vi.fn() },
    nitroPointLedger: { aggregate: vi.fn(), create: vi.fn() },
  };

  beforeEach(() => {
    mockTx.order.findUnique.mockReset();
    mockTx.nitroPointLedger.aggregate.mockReset();
    mockTx.nitroPointLedger.create.mockReset();
    mockTx.nitroPointLedger.aggregate.mockResolvedValue({ _sum: { pointsKobo: 0 } });
  });

  it('restores redeemed points on full refund', async () => {
    mockTx.order.findUnique.mockResolvedValue({
      charge: 1000000, nitroPointsEarnedKobo: 5000, nitroPointsRedeemedKobo: 500000,
      userId: 'u1', nitroStatusAtPurchase: 'pulse',
    });
    await reverseOrderPoints(mockTx, { orderDbId: 'db-r1', refundAmountKobo: 1000000 });
    const calls = mockTx.nitroPointLedger.create.mock.calls;
    expect(calls).toHaveLength(2);
    expect(calls[0][0].data).toEqual(expect.objectContaining({ type: 'reversed_refund', pointsKobo: -5000 }));
    expect(calls[1][0].data).toEqual(expect.objectContaining({ type: 'restored_refund', pointsKobo: 500000, orderId: 'db-r1' }));
  });

  it('restores proportionally on partial refund', async () => {
    mockTx.order.findUnique.mockResolvedValue({
      charge: 1000000, nitroPointsEarnedKobo: 10000, nitroPointsRedeemedKobo: 400000,
      userId: 'u1', nitroStatusAtPurchase: 'boost',
    });
    await reverseOrderPoints(mockTx, { orderDbId: 'db-r2', refundAmountKobo: 500000 });
    const calls = mockTx.nitroPointLedger.create.mock.calls;
    expect(calls).toHaveLength(2);
    expect(calls[1][0].data.type).toBe('restored_refund');
    expect(calls[1][0].data.pointsKobo).toBe(200000); // floor(400000 * 500000/1000000)
  });

  it('caps restoration at unrestored amount', async () => {
    mockTx.order.findUnique.mockResolvedValue({
      charge: 1000000, nitroPointsEarnedKobo: 0, nitroPointsRedeemedKobo: 400000,
      userId: 'u1', nitroStatusAtPurchase: 'pulse',
    });
    // No reversed_refund aggregate (earned=0), only restored_refund aggregate
    mockTx.nitroPointLedger.aggregate
      .mockResolvedValueOnce({ _sum: { pointsKobo: 300000 } });
    await reverseOrderPoints(mockTx, { orderDbId: 'db-r3', refundAmountKobo: 500000 });
    const calls = mockTx.nitroPointLedger.create.mock.calls;
    expect(calls).toHaveLength(1);
    expect(calls[0][0].data.pointsKobo).toBe(100000); // capped: 400000 - 300000 = 100000
  });

  it('skips restoration when order had no points redeemed', async () => {
    mockTx.order.findUnique.mockResolvedValue({
      charge: 500000, nitroPointsEarnedKobo: 2500, nitroPointsRedeemedKobo: 0,
      userId: 'u1', nitroStatusAtPurchase: 'spark',
    });
    await reverseOrderPoints(mockTx, { orderDbId: 'db-r4', refundAmountKobo: 500000 });
    const calls = mockTx.nitroPointLedger.create.mock.calls;
    expect(calls).toHaveLength(1);
    expect(calls[0][0].data.type).toBe('reversed_refund');
  });

  it('skips restoration when already fully restored', async () => {
    mockTx.order.findUnique.mockResolvedValue({
      charge: 500000, nitroPointsEarnedKobo: 0, nitroPointsRedeemedKobo: 500000,
      userId: 'u1', nitroStatusAtPurchase: 'pulse',
    });
    // No reversed_refund aggregate (earned=0), only restored_refund aggregate
    mockTx.nitroPointLedger.aggregate
      .mockResolvedValueOnce({ _sum: { pointsKobo: 500000 } });
    await reverseOrderPoints(mockTx, { orderDbId: 'db-r5', refundAmountKobo: 500000 });
    expect(mockTx.nitroPointLedger.create).not.toHaveBeenCalled();
  });
});

describe('getTotalRefundedKobo', () => {
  it('sums wallet refund transactions and restored points', async () => {
    const mockTx = {
      transaction: { aggregate: vi.fn().mockResolvedValue({ _sum: { amount: 250000 } }) },
      nitroPointLedger: { aggregate: vi.fn().mockResolvedValue({ _sum: { pointsKobo: 200000 } }) },
    };
    const result = await getTotalRefundedKobo(mockTx, { orderId: 'NTR-1', orderDbId: 'db-1', userId: 'u1' });
    expect(result).toBe(450000);
    expect(mockTx.transaction.aggregate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          reference: { in: ['REF-NTR-1', 'ADM-REF-NTR-1'] },
        }),
      }),
    );
    expect(mockTx.nitroPointLedger.aggregate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { orderId: 'db-1', type: 'restored_refund' },
      }),
    );
  });

  it('returns 0 when no refunds exist', async () => {
    const mockTx = {
      transaction: { aggregate: vi.fn().mockResolvedValue({ _sum: { amount: null } }) },
      nitroPointLedger: { aggregate: vi.fn().mockResolvedValue({ _sum: { pointsKobo: null } }) },
    };
    const result = await getTotalRefundedKobo(mockTx, { orderId: 'NTR-2', orderDbId: 'db-2', userId: 'u1' });
    expect(result).toBe(0);
  });

  it('handles wallet-only refund (no points restored)', async () => {
    const mockTx = {
      transaction: { aggregate: vi.fn().mockResolvedValue({ _sum: { amount: 500000 } }) },
      nitroPointLedger: { aggregate: vi.fn().mockResolvedValue({ _sum: { pointsKobo: 0 } }) },
    };
    const result = await getTotalRefundedKobo(mockTx, { orderId: 'NTR-3', orderDbId: 'db-3', userId: 'u1' });
    expect(result).toBe(500000);
  });
});

describe('reverseOrderPoints — partial then cancelled (bulk check regression)', () => {
  const mockTx = {
    order: { findUnique: vi.fn() },
    nitroPointLedger: { aggregate: vi.fn(), create: vi.fn() },
  };

  beforeEach(() => {
    mockTx.order.findUnique.mockReset();
    mockTx.nitroPointLedger.aggregate.mockReset();
    mockTx.nitroPointLedger.create.mockReset();
  });

  it('restores remaining redeemed points after prior partial refund', async () => {
    // Order: charge=1000000, earned=5000, redeemed=500000
    // First refund (partial 50%) already reversed 2500 earned and restored 250000 redeemed
    // Second refund (remaining 50%) should reverse remaining 2500 and restore remaining 250000
    mockTx.order.findUnique.mockResolvedValue({
      charge: 1000000, nitroPointsEarnedKobo: 5000, nitroPointsRedeemedKobo: 500000,
      userId: 'u1', nitroStatusAtPurchase: 'pulse',
    });
    mockTx.nitroPointLedger.aggregate
      .mockResolvedValueOnce({ _sum: { pointsKobo: -2500 } })   // already reversed earned
      .mockResolvedValueOnce({ _sum: { pointsKobo: 250000 } }); // already restored redeemed

    await reverseOrderPoints(mockTx, { orderDbId: 'db-bulk', refundAmountKobo: 500000 });

    const calls = mockTx.nitroPointLedger.create.mock.calls;
    expect(calls).toHaveLength(2);
    // Reverses remaining earned: floor(5000 * 500000/1000000) = 2500, capped at 5000-2500 = 2500
    expect(calls[0][0].data).toEqual(expect.objectContaining({ type: 'reversed_refund', pointsKobo: -2500 }));
    // Restores remaining redeemed: floor(500000 * 500000/1000000) = 250000, capped at 500000-250000 = 250000
    expect(calls[1][0].data).toEqual(expect.objectContaining({ type: 'restored_refund', pointsKobo: 250000 }));
  });
});

describe('getPointsTotals', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns totals grouped by type', async () => {
    mockPrisma.nitroPointLedger.groupBy.mockResolvedValue([
      { type: 'earned_order', _sum: { pointsKobo: 50000 }, _count: 5 },
      { type: 'redeemed_order', _sum: { pointsKobo: -20000 }, _count: 2 },
      { type: 'reversed_refund', _sum: { pointsKobo: -5000 }, _count: 1 },
    ]);
    const totals = await getPointsTotals('u1');
    expect(totals.earned_order).toEqual({ kobo: 50000, count: 5 });
    expect(totals.redeemed_order).toEqual({ kobo: -20000, count: 2 });
    expect(totals.reversed_refund).toEqual({ kobo: -5000, count: 1 });
    expect(totals.manual_credit).toBeUndefined();
  });

  it('returns empty object when no ledger entries', async () => {
    mockPrisma.nitroPointLedger.groupBy.mockResolvedValue([]);
    const totals = await getPointsTotals('u1');
    expect(totals).toEqual({});
  });

  it('handles null sum as 0', async () => {
    mockPrisma.nitroPointLedger.groupBy.mockResolvedValue([
      { type: 'earned_order', _sum: { pointsKobo: null }, _count: 0 },
    ]);
    const totals = await getPointsTotals('u1');
    expect(totals.earned_order).toEqual({ kobo: 0, count: 0 });
  });
});

// ── awardPointsOnCompletion — partial-aware ──

describe('awardPointsOnCompletion', () => {
  beforeEach(() => {
    mockPrisma.order.findUnique.mockReset();
    mockPrisma.nitroPointLedger.create.mockReset();
  });

  function mockOrder(overrides) {
    mockPrisma.order.findUnique.mockResolvedValue({
      id: 'db-1', orderId: 'NTR-100', userId: 'u1',
      charge: 1000000, quantity: 1000, remains: 0, status: 'Completed',
      nitroPointsEarnedKobo: 0, nitroPointsRedeemedKobo: 0,
      nitroStatusAtPurchase: 'pulse',
      creditUsages: [],
      ...overrides,
    });
  }

  it('awards full eligible charge for Completed order', async () => {
    mockOrder({ status: 'Completed', remains: 0 });
    // Pulse tier = 1% earn rate
    const pts = await awardPointsOnCompletion('db-1');
    expect(pts).toBe(10000); // 1000000 * 1%
    expect(mockPrisma.nitroPointLedger.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        type: 'earned_order',
        pointsKobo: 10000,
        dedupeKey: 'earned_order:db-1',
      }),
    });
  });

  it('awards only delivered ratio for Partial order', async () => {
    // charge ₦10,000 (1000000 kobo), qty 1000, remains 400 → 600 delivered
    mockOrder({ status: 'Partial', quantity: 1000, remains: 400 });
    const pts = await awardPointsOnCompletion('db-1');
    // baseEligible = 1000000, deliveredRatio = 600/1000
    // eligibleCharge = floor(1000000 * 600/1000) = 600000
    // points = floor(600000 * 1%) = 6000
    expect(pts).toBe(6000);
  });

  it('subtracts redeemed points and bonus before applying delivered ratio', async () => {
    // charge 1000000, redeemed 200000, bonus 100000 → base = 700000
    // qty 1000, remains 300 → delivered 700/1000
    // eligible = floor(700000 * 700/1000) = 490000
    // points = floor(490000 * 1%) = 4900
    mockOrder({
      status: 'Partial', quantity: 1000, remains: 300,
      nitroPointsRedeemedKobo: 200000,
      creditUsages: [{ amount: 100000 }],
    });
    const pts = await awardPointsOnCompletion('db-1');
    expect(pts).toBe(4900);
  });

  it('returns 0 for Cancelled order', async () => {
    mockOrder({ status: 'Cancelled' });
    const pts = await awardPointsOnCompletion('db-1');
    expect(pts).toBe(0);
    expect(mockPrisma.nitroPointLedger.create).not.toHaveBeenCalled();
  });

  it('returns 0 for Pending order', async () => {
    mockOrder({ status: 'Pending' });
    const pts = await awardPointsOnCompletion('db-1');
    expect(pts).toBe(0);
    expect(mockPrisma.nitroPointLedger.create).not.toHaveBeenCalled();
  });

  it('returns 0 and skips duplicate when nitroPointsEarnedKobo > 0', async () => {
    mockOrder({ status: 'Completed', nitroPointsEarnedKobo: 5000 });
    const pts = await awardPointsOnCompletion('db-1');
    expect(pts).toBe(0);
    expect(mockPrisma.nitroPointLedger.create).not.toHaveBeenCalled();
  });

  it('returns 0 when nitroStatusAtPurchase is missing', async () => {
    mockOrder({ status: 'Completed', nitroStatusAtPurchase: null });
    const pts = await awardPointsOnCompletion('db-1');
    expect(pts).toBe(0);
    expect(mockPrisma.nitroPointLedger.create).not.toHaveBeenCalled();
  });

  it('returns 0 when order not found', async () => {
    mockPrisma.order.findUnique.mockResolvedValue(null);
    const pts = await awardPointsOnCompletion('db-nonexist');
    expect(pts).toBe(0);
  });
});
