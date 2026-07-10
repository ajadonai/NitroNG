import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Unit: email template functions return strings, not promises ──

describe('email template return types', () => {
  it('walletCreditEmail returns a string', async () => {
    const { walletCreditEmail } = await import('@/lib/email');
    const result = walletCreditEmail('Adonai', 5000, 'Balance credited');
    expect(typeof result).toBe('string');
    expect(result).toContain('<!DOCTYPE html');
    expect(result).toContain('5,000');
  });

  it('leaderboardRewardEmail returns a string', async () => {
    const { leaderboardRewardEmail } = await import('@/lib/email');
    const result = leaderboardRewardEmail('Adonai', 10000);
    expect(typeof result).toBe('string');
    expect(result).toContain('<!DOCTYPE html');
    expect(result).toContain('leaderboard');
  });
});

// ── Integration: credit API returns 200, not 500 ──

const mockUser = { id: 'u1', name: 'Test', email: 'test@x.com', balance: 500000, notifEmail: true, status: 'Active' };
const mockAdmin = { id: 'adm1', name: 'Admin', role: 'owner', status: 'Active', customPages: null, customActions: null };

const mockPrisma = {
  user: { findUnique: vi.fn(), update: vi.fn() },
  transaction: { create: vi.fn() },
  activityLog: { create: vi.fn().mockResolvedValue({}) },
  $transaction: vi.fn(),
};
vi.mock('@/lib/prisma', () => ({ default: mockPrisma }));
vi.mock('@/lib/logger', () => ({ log: { error: vi.fn() } }));

const mockSendEmail = vi.fn().mockResolvedValue({});
vi.mock('@/lib/email', async (importOriginal) => {
  const orig = await importOriginal();
  return { ...orig, sendEmail: (...a) => mockSendEmail(...a) };
});

vi.mock('@/lib/admin', () => ({
  requireAdmin: vi.fn().mockResolvedValue({ admin: mockAdmin, error: null }),
  logActivity: vi.fn().mockResolvedValue(undefined),
  canPerformAction: vi.fn().mockReturnValue(true),
  canSeeSensitive: vi.fn().mockReturnValue(true),
  maskEmail: vi.fn(e => e),
  maskPhone: vi.fn(p => p),
}));

describe('POST /api/admin/users — credit action', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.user.findUnique.mockResolvedValue(mockUser);
    mockPrisma.$transaction.mockResolvedValue([{}, {}]);
  });

  it('returns 200 when user has email notifications enabled', async () => {
    const { POST } = await import('@/app/api/admin/users/route');
    const req = new Request('http://localhost/api/admin/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'credit', userId: 'u1', amount: 1000, subtype: 'credit' }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(mockSendEmail).toHaveBeenCalledTimes(1);
  });

  it('returns 200 for gift subtype', async () => {
    const { POST } = await import('@/app/api/admin/users/route');
    const req = new Request('http://localhost/api/admin/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'credit', userId: 'u1', amount: 500, subtype: 'gift' }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  it('returns 200 when user has email disabled (no email sent)', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ ...mockUser, notifEmail: false });

    const { POST } = await import('@/app/api/admin/users/route');
    const req = new Request('http://localhost/api/admin/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'credit', userId: 'u1', amount: 1000, subtype: 'credit' }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(mockSendEmail).not.toHaveBeenCalled();
  });
});
