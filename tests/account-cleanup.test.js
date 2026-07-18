import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  cleanupStaleSignups,
  staleSignupCutoff,
  staleSignupWhere,
  STALE_SIGNUP_DAYS,
} from '@/lib/stale-signup-cleanup';

const mockRequireAdmin = vi.fn();
const mockLogActivity = vi.fn();
vi.mock('@/lib/admin', () => ({
  requireAdmin: (...args) => mockRequireAdmin(...args),
  logActivity: (...args) => mockLogActivity(...args),
}));
vi.mock('@/lib/logger', () => ({
  log: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));

const mockCandidateFindMany = vi.fn();
const mockUserDeleteMany = vi.fn();
const mockIdempotencyFindMany = vi.fn();
const mockLiveSessionFindMany = vi.fn();
const mockSessionDeleteMany = vi.fn();
const mockUserCount = vi.fn();

const mockTx = {
  user: { findMany: mockCandidateFindMany, deleteMany: mockUserDeleteMany },
  idempotencyKey: { findMany: mockIdempotencyFindMany },
  liveSession: { findMany: mockLiveSessionFindMany },
  session: { deleteMany: mockSessionDeleteMany },
};

const mockPrisma = {
  user: { count: mockUserCount },
  session: { deleteMany: mockSessionDeleteMany },
  $transaction: vi.fn(async (fn, _options) => fn(mockTx)),
};
vi.mock('@/lib/prisma', () => ({ default: mockPrisma }));

const { GET: adminGet, POST: adminPost } = await import('@/app/api/admin/cleanup/route.js');

function candidate(id = 'u1', referralCode = 'NTR-ONE') {
  return { id, referralCode };
}

function queueCandidates(users) {
  mockCandidateFindMany
    .mockResolvedValueOnce(users)
    .mockResolvedValueOnce([]); // No candidate has referred another user.
}

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireAdmin.mockResolvedValue({
    admin: { id: 'admin-1', name: 'Owner' },
    error: null,
  });
  mockLogActivity.mockResolvedValue(undefined);
  mockCandidateFindMany.mockResolvedValue([]);
  mockUserDeleteMany.mockResolvedValue({ count: 0 });
  mockIdempotencyFindMany.mockResolvedValue([]);
  mockLiveSessionFindMany.mockResolvedValue([]);
  mockUserCount.mockResolvedValue(0);
});

describe('stale signup eligibility', () => {
  it('uses a 30-day cutoff', () => {
    const now = new Date('2026-07-16T12:00:00.000Z');
    expect(STALE_SIGNUP_DAYS).toBe(30);
    expect(staleSignupCutoff(now)).toEqual(new Date('2026-06-16T12:00:00.000Z'));
  });

  it('retains verified, changed, and recently active accounts', () => {
    const cutoff = new Date('2026-06-16T12:00:00.000Z');
    const where = staleSignupWhere(cutoff);

    expect(where.emailVerified).toBe(false);
    expect(where.status).toBe('Active');
    expect(where.deletedAt).toBeNull();
    expect(where.createdAt).toEqual({ lt: cutoff });
    expect(where.updatedAt).toEqual({ lt: cutoff });
    expect(where.verifyToken).toEqual({ not: null });
    expect(where.verifyExpires).toEqual({ lt: cutoff });
    expect(where.apiKey).toBeNull();
    expect(where.resetToken).toBeNull();
    expect(where.tourCompleted).toBe(false);
    expect(where.orderTourCompleted).toBe(false);
    expect(where.notifClearedAt).toBeNull();
    expect(where.notifReadAllAt).toBeNull();
    expect(where.notifReadIds).toBeNull();
    expect(where.sessions).toEqual({
      none: {
        OR: [
          { lastActive: { gte: cutoff } },
          { createdAt: { gte: cutoff } },
        ],
      },
    });
  });

  it('requires every business-related record set to be empty', () => {
    const where = staleSignupWhere(new Date('2026-06-16T12:00:00.000Z'));
    const collectionRelations = [
      'orders',
      'transactions',
      'tickets',
      'waitlist',
      'gameSessions',
      'gameScores',
      'gameRewards',
      'videoWatches',
      'bonusCredits',
      'taskSubmissions',
      'nitroPointLedger',
    ];

    for (const relation of collectionRelations) {
      expect(where[relation], relation).toEqual({ none: {} });
    }
    expect(where.crewMember).toEqual({ is: null });
  });

  it('deletes through one serializable transaction and relies on session cascade', async () => {
    queueCandidates([candidate()]);
    mockUserDeleteMany.mockResolvedValue({ count: 1 });

    const result = await cleanupStaleSignups(mockPrisma, new Date('2026-07-16T12:00:00.000Z'));

    expect(result).toEqual({ checked: 1, deleted: 1 });
    expect(mockPrisma.$transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: 'Serializable',
    });
    expect(mockSessionDeleteMany).not.toHaveBeenCalled();
  });

  it('retains accounts with idempotency activity, a recent heartbeat, or referred users', async () => {
    const users = [candidate('u1', 'NTR-ONE'), candidate('u2', 'NTR-TWO'), candidate('u3', 'NTR-THREE')];
    mockCandidateFindMany
      .mockResolvedValueOnce(users)
      .mockResolvedValueOnce([{ referredBy: 'NTR-THREE' }]);
    mockIdempotencyFindMany.mockResolvedValue([{ userId: 'u1' }]);
    mockLiveSessionFindMany.mockResolvedValue([{ userId: 'u2' }]);

    const result = await cleanupStaleSignups(mockPrisma, new Date('2026-07-16T12:00:00.000Z'));

    expect(result).toEqual({ checked: 3, deleted: 0 });
    expect(mockUserDeleteMany).not.toHaveBeenCalled();
  });

  it('rechecks verification, status, activity, and related records at deletion time', async () => {
    queueCandidates([candidate()]);
    // Simulates the user being verified or becoming active after selection.
    mockUserDeleteMany.mockResolvedValue({ count: 0 });

    const result = await cleanupStaleSignups(mockPrisma, new Date('2026-07-16T12:00:00.000Z'));
    const finalWhere = mockUserDeleteMany.mock.calls[0][0].where;

    expect(result).toEqual({ checked: 1, deleted: 0 });
    expect(finalWhere.id).toEqual({ in: ['u1'] });
    expect(finalWhere.emailVerified).toBe(false);
    expect(finalWhere.status).toBe('Active');
    expect(finalWhere.updatedAt).toBeDefined();
    expect(finalWhere.sessions).toBeDefined();
    expect(finalWhere.orders).toEqual({ none: {} });
    expect(finalWhere.transactions).toEqual({ none: {} });
  });
});

describe('admin stale-signup cleanup API', () => {
  it('returns the 30-day cleanup contract', async () => {
    mockUserCount.mockResolvedValueOnce(2).mockResolvedValueOnce(7);

    const response = await adminGet();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({ staleCount: 2, unverifiedTotal: 7, cutoffDays: 30 });
    expect(mockRequireAdmin).toHaveBeenCalledWith('settings');
  });

  it('reports the exact number deleted by the final atomic recheck', async () => {
    queueCandidates([candidate()]);
    mockUserDeleteMany.mockResolvedValue({ count: 1 });

    const response = await adminPost();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.deleted).toBe(1);
    expect(data.checked).toBe(1);
    expect(data.cutoffDays).toBe(30);
    expect(data.message).toContain('older than 30 days');
    expect(mockRequireAdmin).toHaveBeenCalledWith('settings', true);
    expect(mockSessionDeleteMany).not.toHaveBeenCalled();
  });

  it('never deletes sessions when the user deletion fails', async () => {
    queueCandidates([candidate()]);
    mockUserDeleteMany.mockRejectedValue(new Error('related record added'));

    const response = await adminPost();

    expect(response.status).toBe(500);
    expect(mockSessionDeleteMany).not.toHaveBeenCalled();
    expect(mockLogActivity).not.toHaveBeenCalled();
  });
});
