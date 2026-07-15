import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockAdminIssue = {
  findFirst: vi.fn(),
  create: vi.fn().mockResolvedValue({ id: 'issue1' }),
  update: vi.fn().mockResolvedValue({ id: 'issue1' }),
};

const mockTx = {
  $queryRaw: vi.fn(),
  $executeRaw: vi.fn(),
  affiliateCommission: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    aggregate: vi.fn(),
    count: vi.fn(),
    updateMany: vi.fn(),
  },
  affiliatePayout: {
    findMany: vi.fn().mockResolvedValue([]),
    aggregate: vi.fn().mockResolvedValue({ _sum: { amount: 0 } }),
  },
  crewMember: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
};

const mockPrisma = {
  ...mockTx,
  $transaction: vi.fn(),
  adminIssue: mockAdminIssue,
  user: { findUnique: vi.fn() },
  acquisitionLink: { findUnique: vi.fn() },
  setting: { findMany: vi.fn().mockResolvedValue([]) },
};

vi.mock('@/lib/prisma', () => ({ default: mockPrisma }));
vi.mock('@/lib/logger', () => ({ log: { error: vi.fn() } }));
vi.mock('@/lib/crew-bot', () => ({ crewSignup: vi.fn(), crewFirstPurchase: vi.fn(), crewRepeatBuyer: vi.fn() }));
vi.mock('@/lib/affiliate-settings', () => ({
  getAffiliateSettings: vi.fn().mockResolvedValue({
    affiliate_enabled: 'true',
    affiliate_hold_days: 7,
    affiliate_lead_split: 20,
    affiliate_min_order: 500,
    affiliate_min_payout: 1000,
  }),
}));

const { createCommission, voidCommissions, releaseHeldCommissions, raiseMoneyIssue } = await import('@/lib/commissions');

beforeEach(() => {
  vi.clearAllMocks();
  mockPrisma.$transaction.mockImplementation(async (fn) => fn(mockTx));
});

// ──────────────────────────────────────
// raiseMoneyIssue
// ──────────────────────────────────────
describe('raiseMoneyIssue', () => {
  it('creates a new AdminIssue when none exists', async () => {
    mockAdminIssue.findFirst.mockResolvedValue(null);

    await raiseMoneyIssue('commission_failed', { orderId: 'ord1', userId: 'u1', error: 'DB down' });

    expect(mockAdminIssue.create).toHaveBeenCalledOnce();
    const call = mockAdminIssue.create.mock.calls[0][0];
    expect(call.data.type).toBe('commission_failed');
    expect(call.data.title).toBe('Commission creation failed');
    expect(call.data.metadata).toContain('ord1');
  });

  it('updates existing issue instead of creating duplicate', async () => {
    mockAdminIssue.findFirst.mockResolvedValue({ id: 'existing1' });

    await raiseMoneyIssue('commission_failed', { orderId: 'ord1', userId: 'u1', error: 'DB down' });

    expect(mockAdminIssue.create).not.toHaveBeenCalled();
    expect(mockAdminIssue.update).toHaveBeenCalledOnce();
    expect(mockAdminIssue.update.mock.calls[0][0].where.id).toBe('existing1');
  });
});

// ──────────────────────────────────────
// createCommission — failure path
// ──────────────────────────────────────
describe('createCommission failure', () => {
  it('creates AdminIssue when DB throws during commission creation', async () => {
    mockAdminIssue.findFirst.mockResolvedValue(null);
    mockPrisma.user.findUnique.mockResolvedValue({
      signupSource: 'test-link',
      email: 'buyer@test.com',
      referredByMemberId: 'member1',
      referredByLinkId: 'link1',
      createdAt: new Date('2026-07-05'),
    });
    mockTx.crewMember.findUnique.mockResolvedValue({
      id: 'member1',
      status: 'approved',
      commissionRate: 10,
      leadId: null,
      role: 'chief',
      email: 'affiliate@test.com',
    });
    mockTx.affiliateCommission.findFirst.mockResolvedValue(null);
    mockTx.affiliateCommission.create.mockRejectedValue(new Error('unique constraint violated'));

    const result = await createCommission('ord1', 'user1', 100000, 50000);

    expect(result).toBeNull();
    // Give the async raiseMoneyIssue time to fire
    await new Promise(r => setTimeout(r, 50));
    expect(mockAdminIssue.create).toHaveBeenCalled();
    const call = mockAdminIssue.create.mock.calls[0][0];
    expect(call.data.type).toBe('commission_failed');
    expect(call.data.metadata).toContain('ord1');
  });

  it('does NOT create AdminIssue on successful commission', async () => {
    mockAdminIssue.findFirst.mockResolvedValue(null);
    mockPrisma.user.findUnique.mockResolvedValue({
      signupSource: 'test-link',
      email: 'buyer@test.com',
      referredByMemberId: 'member1',
      referredByLinkId: 'link1',
      createdAt: new Date('2026-07-05'),
    });
    mockTx.crewMember.findUnique.mockResolvedValue({
      id: 'member1',
      status: 'approved',
      commissionRate: 10,
      leadId: null,
      role: 'chief',
      email: 'affiliate@test.com',
    });
    mockTx.affiliateCommission.findFirst.mockResolvedValue(null);
    mockTx.affiliateCommission.create.mockResolvedValue({ id: 'comm1' });
    mockTx.affiliateCommission.count.mockResolvedValue(1);

    const result = await createCommission('ord1', 'user1', 100000, 50000);

    expect(result).toEqual({ id: 'comm1' });
    expect(mockAdminIssue.create).not.toHaveBeenCalled();
  });
});

// ──────────────────────────────────────
// voidCommissions — failure path
// ──────────────────────────────────────
describe('voidCommissions failure', () => {
  it('creates AdminIssue when transaction throws', async () => {
    mockAdminIssue.findFirst.mockResolvedValue(null);
    mockPrisma.$transaction.mockRejectedValue(new Error('deadlock detected'));

    const count = await voidCommissions('ord1', 'order_cancelled');

    expect(count).toBe(0);
    await new Promise(r => setTimeout(r, 50));
    expect(mockAdminIssue.create).toHaveBeenCalled();
    const call = mockAdminIssue.create.mock.calls[0][0];
    expect(call.data.type).toBe('void_failed');
    expect(call.data.metadata).toContain('ord1');
  });
});

// ──────────────────────────────────────
// releaseHeldCommissions — failure path
// ──────────────────────────────────────
describe('releaseHeldCommissions failure', () => {
  it('creates AdminIssue when transaction throws', async () => {
    mockAdminIssue.findFirst.mockResolvedValue(null);
    mockPrisma.$transaction.mockRejectedValue(new Error('connection reset'));

    const count = await releaseHeldCommissions();

    expect(count).toBe(0);
    await new Promise(r => setTimeout(r, 50));
    expect(mockAdminIssue.create).toHaveBeenCalled();
    const call = mockAdminIssue.create.mock.calls[0][0];
    expect(call.data.type).toBe('release_failed');
  });
});
