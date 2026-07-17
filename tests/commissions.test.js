import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock prisma before importing commissions
const mockTx = {
  $queryRaw: vi.fn(),
  $executeRaw: vi.fn(),
  affiliateCommission: {
    findMany: vi.fn(),
    updateMany: vi.fn(),
    aggregate: vi.fn(),
  },
  affiliatePayout: {
    findMany: vi.fn().mockResolvedValue([]),
  },
  crewMember: {
    update: vi.fn(),
  },
};

const mockPrisma = {
  ...mockTx,
  $transaction: vi.fn(),
  affiliateCommission: {
    ...mockTx.affiliateCommission,
  },
};

vi.mock('@/lib/prisma', () => ({ default: mockPrisma }));
vi.mock('@/lib/logger', () => ({ log: { error: vi.fn() } }));
vi.mock('@/lib/crew-bot', () => ({ crewSignup: vi.fn(), crewFirstPurchase: vi.fn(), crewRepeatBuyer: vi.fn() }));

const { voidCommissions, releaseHeldCommissions, getMemberEarnings } = await import('@/lib/commissions');

beforeEach(() => {
  vi.clearAllMocks();
  // Default: $transaction executes the callback with mockTx
  mockPrisma.$transaction.mockImplementation(async (fn) => fn(mockTx));
});

// ──────────────────────────────────────
// voidCommissions
// ──────────────────────────────────────
describe('voidCommissions', () => {
  it('does not decrement totalEarned for held commissions', async () => {
    mockTx.$queryRaw.mockResolvedValue([
      { id: 'c1', memberId: 'm1', leadId: 'l1', marketerAmount: 500, leadAmount: 200, status: 'held' },
    ]);
    mockTx.$executeRaw.mockResolvedValue(1);

    await voidCommissions('order1', 'test');

    // First $executeRaw is the UPDATE to voided. No further calls for totalEarned.
    expect(mockTx.$executeRaw).toHaveBeenCalledTimes(1);
  });

  it('decrements totalEarned exactly once for approved commissions', async () => {
    mockTx.$queryRaw.mockResolvedValue([
      { id: 'c1', memberId: 'm1', leadId: 'l1', marketerAmount: 500, leadAmount: 200, status: 'approved' },
    ]);
    mockTx.$executeRaw.mockResolvedValue(1);

    await voidCommissions('order1', 'test');

    // 1 UPDATE to voided + 1 decrement for m1 + 1 decrement for l1 = 3
    expect(mockTx.$executeRaw).toHaveBeenCalledTimes(3);
  });

  it('is idempotent — second void on same order returns 0', async () => {
    mockTx.$queryRaw.mockResolvedValue([]); // no held/approved rows found

    const count = await voidCommissions('order1', 'test');

    expect(count).toBe(0);
    expect(mockTx.$executeRaw).not.toHaveBeenCalled();
  });

  it('handles mixed held + approved: only decrements for approved', async () => {
    mockTx.$queryRaw.mockResolvedValue([
      { id: 'c1', memberId: 'm1', leadId: null, marketerAmount: 300, leadAmount: 0, status: 'held' },
      { id: 'c2', memberId: 'm1', leadId: 'l1', marketerAmount: 500, leadAmount: 200, status: 'approved' },
    ]);
    mockTx.$executeRaw.mockResolvedValue(1);

    const count = await voidCommissions('order1', 'test');

    expect(count).toBe(2);
    // 1 UPDATE to voided + 1 decrement m1 (500, not 800) + 1 decrement l1 (200) = 3
    expect(mockTx.$executeRaw).toHaveBeenCalledTimes(3);
  });

  it('uses SELECT FOR UPDATE to lock rows against concurrent voids', async () => {
    mockTx.$queryRaw.mockResolvedValue([
      { id: 'c1', memberId: 'm1', leadId: null, marketerAmount: 300, leadAmount: 0, status: 'approved' },
    ]);
    mockTx.$executeRaw.mockResolvedValue(1);

    await voidCommissions('order1', 'test');

    // Tagged template: first arg is TemplateStringsArray, join to check full SQL
    const fullSql = [...mockTx.$queryRaw.mock.calls[0][0]].join('');
    expect(fullSql).toContain('FOR UPDATE');
  });
});

// ──────────────────────────────────────
// releaseHeldCommissions
// ──────────────────────────────────────
describe('releaseHeldCommissions', () => {
  it('uses UPDATE ... RETURNING to claim only rows this invocation transitions', async () => {
    mockTx.$queryRaw.mockResolvedValue([
      { id: 'c1', memberId: 'm1', leadId: null, marketerAmount: 500, leadAmount: 0 },
    ]);
    mockTx.$executeRaw.mockResolvedValue(1);

    const count = await releaseHeldCommissions();

    expect(count).toBe(1);
    // Tagged template: first arg is TemplateStringsArray, join to check full SQL
    const fullSql = [...mockTx.$queryRaw.mock.calls[0][0]].join('');
    expect(fullSql).toContain('RETURNING');
    expect(fullSql).toContain("status = 'approved'");
    expect(fullSql).toContain("status = 'held'");
    expect(fullSql).toContain('member."deletedAt" IS NULL');
    expect(fullSql).toContain('lead."deletedAt" IS NULL');
    expect(fullSql).toContain('commission."leadAmount" = 0');
    expect(fullSql).toContain('commission."leadForfeitedAt" IS NOT NULL');
    const creditSql = [...mockTx.$executeRaw.mock.calls[0][0]].join('');
    expect(creditSql).toContain("status = 'approved'");
    expect(creditSql).toContain('"deletedAt" IS NULL');
  });

  it('releases the active marketer share after a deleted lead share is forfeited', async () => {
    mockTx.$queryRaw.mockResolvedValue([
      { id: 'c1', memberId: 'm1', leadId: 'deleted-lead', marketerAmount: 500, leadAmount: 0 },
    ]);
    mockTx.$executeRaw.mockResolvedValue(1);

    const count = await releaseHeldCommissions();

    expect(count).toBe(1);
    expect(mockTx.$executeRaw).toHaveBeenCalledTimes(1);
    const creditSql = [...mockTx.$executeRaw.mock.calls[0][0]].join('');
    expect(creditSql).toContain('WHERE id = ');
  });

  it('rolls back the release when final member eligibility is lost', async () => {
    mockTx.$queryRaw.mockResolvedValue([
      { id: 'c1', memberId: 'm1', leadId: null, marketerAmount: 500, leadAmount: 0 },
    ]);
    mockTx.$executeRaw.mockResolvedValue(0);

    const count = await releaseHeldCommissions();

    expect(count).toBe(0);
    expect(mockTx.$executeRaw).toHaveBeenCalledTimes(1);
    const creditSql = [...mockTx.$executeRaw.mock.calls[0][0]].join('');
    expect(creditSql).toContain("status = 'approved'");
    expect(creditSql).toContain('"deletedAt" IS NULL');
  });

  it('does not re-credit older approved commissions', async () => {
    // If there are 5 old approved commissions and 1 newly releasable held one,
    // only the 1 held one is returned by UPDATE ... RETURNING (it had status='held').
    // The 5 old ones are already 'approved' so they don't match WHERE status='held'.
    mockTx.$queryRaw.mockResolvedValue([
      { id: 'new1', memberId: 'm1', leadId: null, marketerAmount: 100, leadAmount: 0 },
    ]);
    mockTx.$executeRaw.mockResolvedValue(1);

    const count = await releaseHeldCommissions();

    expect(count).toBe(1);
    // Only 1 increment of 100, not re-crediting historical commissions
    expect(mockTx.$executeRaw).toHaveBeenCalledTimes(1);
  });

  it('aggregates multiple commissions for the same member into one increment', async () => {
    mockTx.$queryRaw.mockResolvedValue([
      { id: 'c1', memberId: 'm1', leadId: null, marketerAmount: 500, leadAmount: 0 },
      { id: 'c2', memberId: 'm1', leadId: null, marketerAmount: 300, leadAmount: 0 },
    ]);
    mockTx.$executeRaw.mockResolvedValue(1);

    await releaseHeldCommissions();

    // 1 increment for m1 with aggregated amount (800)
    expect(mockTx.$executeRaw).toHaveBeenCalledTimes(1);
  });

  it('returns 0 when no commissions are ready for release', async () => {
    mockTx.$queryRaw.mockResolvedValue([]);

    const count = await releaseHeldCommissions();

    expect(count).toBe(0);
    expect(mockTx.$executeRaw).not.toHaveBeenCalled();
  });

  it('runs entirely inside a transaction', async () => {
    mockTx.$queryRaw.mockResolvedValue([]);
    await releaseHeldCommissions();
    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
  });
});

// ──────────────────────────────────────
// getMemberEarnings
// ──────────────────────────────────────
describe('getMemberEarnings', () => {
  it('calculates crew earnings as marketerAmount plus any historical leadAmount', async () => {
    mockPrisma.affiliateCommission.aggregate
      .mockResolvedValueOnce({ _sum: { marketerAmount: 1000 } })
      .mockResolvedValueOnce({ _sum: { leadAmount: null } });

    const result = await getMemberEarnings('m1', 'crew');

    expect(result.directEarned).toBe(1000);
    expect(result.teamEarned).toBe(0);
    expect(result.totalApproved).toBe(1000);
  });

  it('calculates chief earnings as direct + team', async () => {
    mockPrisma.affiliateCommission.aggregate
      .mockResolvedValueOnce({ _sum: { marketerAmount: 1000 } })
      .mockResolvedValueOnce({ _sum: { leadAmount: 500 } });

    const result = await getMemberEarnings('chief1', 'chief');

    expect(result.directEarned).toBe(1000);
    expect(result.teamEarned).toBe(500);
    expect(result.totalApproved).toBe(1500);
  });

  it('chief direct + team earnings are both included in totalApproved (withdrawable)', async () => {
    mockPrisma.affiliateCommission.aggregate
      .mockResolvedValueOnce({ _sum: { marketerAmount: 2000 } })
      .mockResolvedValueOnce({ _sum: { leadAmount: 3000 } });

    const result = await getMemberEarnings('chief1', 'chief');

    // Both are withdrawable
    expect(result.totalApproved).toBe(5000);
  });

  it('handles null sums (zero earnings)', async () => {
    mockPrisma.affiliateCommission.aggregate
      .mockResolvedValueOnce({ _sum: { marketerAmount: null } })
      .mockResolvedValueOnce({ _sum: { leadAmount: null } });

    const result = await getMemberEarnings('chief1', 'chief');

    expect(result.directEarned).toBe(0);
    expect(result.teamEarned).toBe(0);
    expect(result.totalApproved).toBe(0);
  });
});

// ──────────────────────────────────────
// voidCommissions — payout auto-rejection
// ──────────────────────────────────────
describe('voidCommissions payout reconciliation', () => {
  it('auto-rejects pending payouts that exceed post-void available balance', async () => {
    // Member has 1000 approved, pending payout of 1000. Voiding sets approved to 0.
    mockTx.$queryRaw
      .mockResolvedValueOnce([
        { id: 'c1', memberId: 'm1', leadId: null, marketerAmount: 1000, leadAmount: 0, status: 'approved' },
      ])
      .mockResolvedValueOnce([{ totalPaid: 0, role: 'crew' }]);

    mockTx.$executeRaw.mockResolvedValue(1);

    mockTx.affiliatePayout.findMany.mockResolvedValueOnce([
      { id: 'p1', amount: 1000, createdAt: new Date() },
    ]);

    // Post-void: no approved commissions left
    mockTx.affiliateCommission.aggregate
      .mockResolvedValueOnce({ _sum: { marketerAmount: 0 } })
      .mockResolvedValueOnce({ _sum: { leadAmount: 0 } });

    const count = await voidCommissions('order1', 'test');

    expect(count).toBe(1);
    // 1 void UPDATE + 1 totalEarned decrement + 1 payout rejection = 3
    expect(mockTx.$executeRaw).toHaveBeenCalledTimes(3);
    const rejectionSql = [...mockTx.$executeRaw.mock.calls[2][0]].join('');
    expect(rejectionSql).toContain('"bankName" = NULL');
    expect(rejectionSql).toContain('"bankAccountNo" = NULL');
    expect(rejectionSql).toContain('"bankAccountName" = NULL');
  });

  it('keeps payouts that are still covered after void', async () => {
    // Member has 2000 approved across two commissions, 1000 pending payout.
    // Voiding one (1000) leaves 1000 approved — payout of 1000 still fits.
    mockTx.$queryRaw
      .mockResolvedValueOnce([
        { id: 'c1', memberId: 'm1', leadId: null, marketerAmount: 1000, leadAmount: 0, status: 'approved' },
      ])
      .mockResolvedValueOnce([{ totalPaid: 0, role: 'crew' }]);

    mockTx.$executeRaw.mockResolvedValue(1);

    mockTx.affiliatePayout.findMany.mockResolvedValueOnce([
      { id: 'p1', amount: 1000, createdAt: new Date() },
    ]);

    // Post-void: 1000 still approved from other commission
    mockTx.affiliateCommission.aggregate
      .mockResolvedValueOnce({ _sum: { marketerAmount: 1000 } })
      .mockResolvedValueOnce({ _sum: { leadAmount: 0 } });

    await voidCommissions('order1', 'test');

    // 1 void UPDATE + 1 totalEarned decrement = 2 (no payout rejection)
    expect(mockTx.$executeRaw).toHaveBeenCalledTimes(2);
  });
});
