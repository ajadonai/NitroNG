import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockPrisma = {
  affiliatePayout: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    aggregate: vi.fn(),
    create: vi.fn(),
  },
  $queryRaw: vi.fn(),
  $executeRaw: vi.fn(),
  $transaction: vi.fn(),
};

const mockRequireAdmin = vi.fn();
const mockLogActivity = vi.fn();
const mockSendEmail = vi.fn();
const mockGetCrewSession = vi.fn();
const mockGetMemberEarnings = vi.fn();

vi.mock('@/lib/prisma', () => ({ default: mockPrisma }));
vi.mock('@/lib/admin', () => ({
  requireAdmin: (...args) => mockRequireAdmin(...args),
  logActivity: (...args) => mockLogActivity(...args),
  canSeeSensitive: () => true,
  maskEmail: value => value,
  maskAccountNo: value => value ? `***${String(value).slice(-4)}` : null,
}));
vi.mock('@/lib/commissions', () => ({
  getMemberEarnings: (...args) => mockGetMemberEarnings(...args),
  raiseMoneyIssue: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('@/lib/email', () => ({
  sendEmail: (...args) => mockSendEmail(...args),
  payoutCompletedEmail: vi.fn().mockReturnValue('<html>complete</html>'),
  payoutRejectedEmail: vi.fn().mockReturnValue('<html>reject</html>'),
}));
vi.mock('@/lib/crew', () => ({ getCrewSession: (...args) => mockGetCrewSession(...args) }));
vi.mock('@/lib/affiliate-settings', () => ({
  getAffiliateSettings: vi.fn().mockResolvedValue({ affiliate_min_payout: 1000 }),
}));

const { GET: adminGet, POST: adminPost } = await import('@/app/api/admin/crew/payouts/route');
const { POST: memberPost } = await import('@/app/api/pit/payouts/route');

function request(body) {
  return new Request('http://localhost/api/payouts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function sqlFor(call) {
  return [...call[0]].join('');
}

function payout(overrides = {}) {
  return {
    id: 'payout-1',
    memberId: 'crew-1',
    amount: 500000,
    status: 'processing',
    reference: null,
    bankName: 'Snapshot Bank',
    bankAccountNo: '1234567890',
    bankAccountName: 'Snapshot Recipient',
    processedAt: null,
    createdAt: new Date('2026-07-17T10:00:00Z'),
    member: {
      id: 'crew-1',
      name: 'Deleted Pit member crew-1',
      email: 'deleted-crew-1@pit.invalid',
      totalPaid: 0,
      bankName: null,
      bankAccountNo: null,
      bankAccountName: null,
      deletedAt: new Date('2026-07-17T11:00:00Z'),
    },
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireAdmin.mockResolvedValue({ admin: { name: 'Admin' }, error: null });
  mockLogActivity.mockResolvedValue(undefined);
  mockPrisma.$transaction.mockImplementation(work => work(mockPrisma));
  mockPrisma.$queryRaw.mockResolvedValue([
    {
      id: 'crew-1',
      totalPaid: 0,
      role: 'crew',
      status: 'deleted',
      deletedAt: new Date('2026-07-17T11:00:00Z'),
      bankName: null,
      bankAccountNo: null,
      bankAccountName: null,
    },
  ]);
  mockPrisma.$executeRaw.mockResolvedValue(1);
  mockPrisma.affiliatePayout.aggregate.mockResolvedValue({ _sum: { amount: 0 } });
  mockGetMemberEarnings.mockResolvedValue({ totalApproved: 1000000 });
});

describe('admin payout privacy lifecycle', () => {
  it('settles a pre-deletion payout and clears its bank snapshot atomically', async () => {
    mockPrisma.affiliatePayout.findUnique.mockResolvedValue(payout());

    const response = await adminPost(request({
      action: 'complete', payoutId: 'payout-1', reference: 'TRANSFER-123',
    }));

    expect(response.status).toBe(200);
    expect(sqlFor(mockPrisma.$executeRaw.mock.calls[0])).toContain('"bankName" = NULL');
    expect(sqlFor(mockPrisma.$executeRaw.mock.calls[0])).toContain('"bankAccountNo" = NULL');
    expect(sqlFor(mockPrisma.$executeRaw.mock.calls[0])).toContain('"bankAccountName" = NULL');
    expect(sqlFor(mockPrisma.$executeRaw.mock.calls[1])).toContain('"totalPaid" = "totalPaid"');
    expect(mockLogActivity).toHaveBeenCalledWith(
      'Admin',
      'Completed payout payout-1 for Pit member crew-1 (₦5,000)',
      'crew',
    );
    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  it('clears all bank fields in the same conditional rejection update', async () => {
    mockPrisma.affiliatePayout.findUnique.mockResolvedValue(payout({ status: 'pending' }));

    const response = await adminPost(request({ action: 'reject', payoutId: 'payout-1' }));

    expect(response.status).toBe(200);
    const sql = sqlFor(mockPrisma.$executeRaw.mock.calls[0]);
    expect(sql).toContain('"bankName" = ');
    expect(sql).toContain('"bankAccountNo" = ');
    expect(sql).toContain('"bankAccountName" = ');
    expect(sql).toContain("status IN ('pending', 'processing')");
    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  it('never displays bank data for terminal payouts or falls back to current details', async () => {
    const currentMember = {
      name: 'Active Member', email: 'active@example.test',
      bankName: 'Current Bank', bankAccountNo: '9999999999', bankAccountName: 'Current Recipient',
    };
    mockPrisma.affiliatePayout.findMany.mockResolvedValue([
      payout({
        id: 'pending', status: 'pending', member: currentMember,
        bankName: 'Pending Bank', bankAccountNo: '1111111111', bankAccountName: 'Pending Recipient',
      }),
      payout({
        id: 'completed', status: 'completed', member: currentMember,
        bankName: 'Legacy Bank', bankAccountNo: '2222222222', bankAccountName: 'Legacy Recipient',
      }),
      payout({
        id: 'rejected', status: 'rejected', member: currentMember,
        bankName: null, bankAccountNo: null, bankAccountName: null,
      }),
    ]);

    const response = await adminGet();
    const body = await response.json();

    expect(body.payouts[0]).toEqual(expect.objectContaining({
      bankName: 'Pending Bank', bankAccountNo: '1111111111', bankAccountName: 'Pending Recipient',
    }));
    expect(body.payouts[1]).toEqual(expect.objectContaining({
      bankName: null, bankAccountNo: null, bankAccountName: null,
    }));
    expect(body.payouts[2]).toEqual(expect.objectContaining({
      bankName: null, bankAccountNo: null, bankAccountName: null,
    }));
  });
});

describe('member payout snapshot race', () => {
  it('snapshots bank details from the locked member row, not the stale session', async () => {
    mockGetCrewSession.mockResolvedValue({
      id: 'crew-1', role: 'crew', totalPaid: 0,
      bankName: 'Stale Bank', bankAccountNo: '0000000000', bankAccountName: 'Stale Recipient',
    });
    mockPrisma.$queryRaw.mockResolvedValue([{
      id: 'crew-1', totalPaid: 0, role: 'crew', status: 'approved', deletedAt: null,
      bankName: 'Locked Bank', bankAccountNo: '3333333333', bankAccountName: 'Locked Recipient',
    }]);
    mockPrisma.affiliatePayout.create.mockImplementation(({ data }) => Promise.resolve({
      id: 'new-payout', status: 'pending', createdAt: new Date(), ...data,
    }));

    const response = await memberPost(request({ amount: 5000 }));

    expect(response.status).toBe(200);
    expect(mockPrisma.affiliatePayout.create).toHaveBeenCalledWith({
      data: {
        memberId: 'crew-1',
        amount: 500000,
        bankName: 'Locked Bank',
        bankAccountNo: '3333333333',
        bankAccountName: 'Locked Recipient',
      },
    });
  });
});
