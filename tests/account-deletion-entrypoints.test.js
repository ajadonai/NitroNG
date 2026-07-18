import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';

const mockRequireAdmin = vi.fn();
const mockLogActivity = vi.fn();
const mockCanPerformAction = vi.fn();
const mockReinstate = vi.fn();

const mockPrisma = {
  user: {
    count: vi.fn(),
    groupBy: vi.fn(),
    findMany: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  transaction: { findMany: vi.fn(), create: vi.fn() },
  order: { count: vi.fn() },
  activityLog: { create: vi.fn() },
  $transaction: vi.fn(),
};

vi.mock('@/lib/prisma', () => ({ default: mockPrisma }));
vi.mock('@/lib/logger', () => ({ log: { error: vi.fn(), info: vi.fn() } }));
vi.mock('@/lib/admin', () => ({
  requireAdmin: (...args) => mockRequireAdmin(...args),
  logActivity: (...args) => mockLogActivity(...args),
  canPerformAction: (...args) => mockCanPerformAction(...args),
  canSeeSensitive: vi.fn(() => true),
  maskEmail: vi.fn(value => value),
  maskPhone: vi.fn(value => value),
}));
vi.mock('@/lib/account-deletion', () => ({
  reinstatePendingAccountDeletion: (...args) => mockReinstate(...args),
}));
vi.mock('@/lib/email', () => ({
  sendEmail: vi.fn(),
  walletCreditEmail: vi.fn(() => '<html></html>'),
}));
vi.mock('@/lib/nitro-rewards', () => ({
  getRewardsPayload: vi.fn(),
  getPointsTotals: vi.fn(),
  getPointsHistory: vi.fn(),
}));

const { GET, POST } = await import('@/app/api/admin/users/route');

function adminRequest(action, userId = 'user-1') {
  return new Request('http://localhost/api/admin/users', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ action, userId }),
  });
}

function user(overrides = {}) {
  return {
    id: 'user-1',
    name: 'Ada User',
    email: 'ada@example.test',
    status: 'Active',
    deletedAt: null,
    deletedName: null,
    deletedEmail: null,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireAdmin.mockResolvedValue({
    admin: { id: 'admin-1', name: 'Owner', role: 'owner' },
    error: null,
  });
  mockCanPerformAction.mockReturnValue(true);
  mockLogActivity.mockResolvedValue(undefined);
  mockPrisma.user.update.mockResolvedValue({});
  mockReinstate.mockResolvedValue({
    reinstated: true,
    user: { id: 'user-1', name: 'Ada User', email: 'ada@example.test' },
  });
});

describe('Phase 6 account-deletion entrypoints', () => {
  it('routes both cleanup jobs through the same bounded finalizer', () => {
    for (const path of ['app/api/cron/cleanup/route.js', 'app/api/cron/daily/route.js']) {
      const source = readFileSync(path, 'utf8');
      expect(source).toContain("import { finalizeDueAccountDeletions } from '@/lib/account-deletion'");
      expect(source).toMatch(/finalizeDueAccountDeletions\(prisma, new Date\(\), \{ limit: 100 \}\)/);
      expect(source).not.toContain('prisma.ticketReply.deleteMany');
      expect(source).not.toContain("data: { status: 'Deleted'");
    }
  });

  it('serializes a deletion request against in-flight order placement', () => {
    const deletion = readFileSync('app/api/auth/delete-account/route.js', 'utf8');
    const orders = readFileSync('app/api/orders/route.js', 'utf8');
    const balance = readFileSync('lib/bonus-credit.js', 'utf8');

    expect(deletion).toMatch(/SELECT id, status FROM users WHERE id = \$\{user\.id\} FOR UPDATE/);
    expect(balance).toContain("status = 'Active'");
    expect(balance).toContain('"anonymizedAt" IS NULL');
    expect(orders).toContain('await deductBalance(tx, session.id, walletCharge)');
    expect(orders).not.toContain('if (walletCharge > 0)');
  });

  it('keeps deletion-state mutations out of the admin UI and rewards API', () => {
    const source = readFileSync('components/admin-users.jsx', 'utf8');
    expect(source).toContain("const isMutationLocked = (u) => ['PendingDeletion', 'Deleted'].includes(u.status)");
    expect(source).toContain('hidden: isMutationLocked(menuUser)');
    expect(source).toContain('!isMutationLocked(drawerUser)');
    expect(source).toContain('drawerUser.canReinstate');

    const rewardsSource = readFileSync('app/api/admin/rewards/route.js', 'utf8');
    expect(rewardsSource).toContain("['PendingDeletion', 'Deleted'].includes(user.status)");
  });
});

describe('admin account state transitions', () => {
  it('activates suspended users only', async () => {
    mockPrisma.user.findUnique.mockResolvedValueOnce(user({ status: 'Active' }));
    const rejected = await POST(adminRequest('activate'));
    expect(rejected.status).toBe(409);
    expect(mockPrisma.user.update).not.toHaveBeenCalled();

    mockPrisma.user.findUnique.mockResolvedValueOnce(user({ status: 'Suspended' }));
    const accepted = await POST(adminRequest('activate'));
    expect(accepted.status).toBe(200);
    expect(mockPrisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: { status: 'Active' },
    });
  });

  it('never restores a permanently deleted account', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(user({ status: 'Deleted' }));
    const response = await POST(adminRequest('reinstate'));
    expect(response.status).toBe(409);
    expect(mockReinstate).not.toHaveBeenCalled();
    expect(mockPrisma.user.update).not.toHaveBeenCalled();
  });

  it('rejects restoration once the grace period has expired', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(user({
      status: 'PendingDeletion',
      deletedAt: new Date('2000-01-01T00:00:00.000Z'),
      deletedName: 'Ada User',
      deletedEmail: 'ada@example.test',
    }));
    const response = await POST(adminRequest('reinstate'));
    expect(response.status).toBe(409);
    expect(mockReinstate).not.toHaveBeenCalled();
  });

  it('locks pending-deletion accounts against every mutation except reinstatement', async () => {
    for (const deletedAt of [
      new Date('2999-01-01T00:00:00.000Z'),
      new Date('2000-01-01T00:00:00.000Z'),
    ]) {
      mockPrisma.user.findUnique.mockResolvedValueOnce(user({ status: 'PendingDeletion', deletedAt }));
      const response = await POST(adminRequest('credit'));
      expect(response.status).toBe(409);
    }
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    expect(mockPrisma.user.update).not.toHaveBeenCalled();
    expect(mockReinstate).not.toHaveBeenCalled();
  });

  it('delegates an eligible restoration to the CAS-protected helper', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(user({
      status: 'PendingDeletion',
      deletedAt: new Date('2999-01-01T00:00:00.000Z'),
      deletedName: 'Ada User',
      deletedEmail: 'ada@example.test',
    }));
    const response = await POST(adminRequest('reinstate'));
    expect(response.status).toBe(200);
    expect(mockReinstate).toHaveBeenCalledWith(mockPrisma, 'user-1');
    expect(mockPrisma.user.update).not.toHaveBeenCalled();
  });

  it('fails closed when the account changes before restoration completes', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(user({
      status: 'PendingDeletion',
      deletedAt: new Date('2999-01-01T00:00:00.000Z'),
    }));
    mockReinstate.mockResolvedValue({ reinstated: false, reason: 'state_changed' });
    const response = await POST(adminRequest('reinstate'));
    expect(response.status).toBe(409);
    expect(mockLogActivity).not.toHaveBeenCalled();
  });

  it('returns canReinstate only inside the pending-deletion grace period', async () => {
    const joined = new Date('2026-01-01T00:00:00.000Z');
    mockPrisma.user.count.mockResolvedValue(4);
    mockPrisma.user.groupBy.mockResolvedValue([
      { status: 'PendingDeletion', _count: { _all: 2 } },
      { status: 'Deleted', _count: { _all: 1 } },
      { status: 'Suspended', _count: { _all: 1 } },
    ]);
    mockPrisma.user.findMany.mockResolvedValue([
      user({ id: 'future', status: 'PendingDeletion', deletedAt: new Date('2999-01-01T00:00:00.000Z'), createdAt: joined, emailVerified: true, balance: 0, referralCode: null, phone: null, _count: { orders: 0 } }),
      user({ id: 'expired', status: 'PendingDeletion', deletedAt: new Date('2000-01-01T00:00:00.000Z'), createdAt: joined, emailVerified: true, balance: 0, referralCode: null, phone: null, _count: { orders: 0 } }),
      user({ id: 'deleted', status: 'Deleted', deletedAt: new Date('2000-01-01T00:00:00.000Z'), createdAt: joined, emailVerified: false, balance: 0, referralCode: null, phone: null, _count: { orders: 0 } }),
      user({ id: 'suspended', status: 'Suspended', createdAt: joined, emailVerified: true, balance: 0, referralCode: null, phone: null, _count: { orders: 0 } }),
    ]);

    const response = await GET(new Request('http://localhost/api/admin/users'));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.users.map(({ id, canReinstate }) => ({ id, canReinstate }))).toEqual([
      { id: 'future', canReinstate: true },
      { id: 'expired', canReinstate: false },
      { id: 'deleted', canReinstate: false },
      { id: 'suspended', canReinstate: false },
    ]);
  });
});
