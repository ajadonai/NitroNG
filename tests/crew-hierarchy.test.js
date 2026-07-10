import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockCrewMember = {
  findUnique: vi.fn(),
  findMany: vi.fn(),
  update: vi.fn(),
  updateMany: vi.fn(),
};

const mockPrisma = {
  crewMember: mockCrewMember,
  setting: { findUnique: vi.fn(), findMany: vi.fn() },
  acquisitionLink: { findFirst: vi.fn(), findUnique: vi.fn(), create: vi.fn() },
  activityLog: { create: vi.fn().mockResolvedValue({}) },
  $transaction: vi.fn(),
};

vi.mock('@/lib/prisma', () => ({ default: mockPrisma }));
vi.mock('@/lib/logger', () => ({ log: { error: vi.fn() } }));
vi.mock('@/lib/crew-bot', () => ({ kickFromGroup: vi.fn() }));
vi.mock('@/lib/email', () => ({ sendEmail: vi.fn().mockResolvedValue(undefined), pitRejectionEmail: vi.fn().mockReturnValue('<html>rejected</html>') }));

const mockRequireAdmin = vi.fn();
const mockLogActivity = vi.fn().mockResolvedValue(undefined);
vi.mock('@/lib/admin', () => ({
  requireAdmin: (...a) => mockRequireAdmin(...a),
  logActivity: (...a) => mockLogActivity(...a),
  canSeeSensitive: () => true,
  maskEmail: (e) => e,
  maskPhone: (p) => p,
}));

const { POST } = await import('@/app/api/admin/crew/route');

function makeReq(body) {
  return new Request('http://localhost/api/admin/crew', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireAdmin.mockResolvedValue({ admin: { name: 'Admin', email: 'admin@test.com' }, error: null });
  mockPrisma.$transaction.mockImplementation(async (fn) => fn(mockPrisma));
});

// ──────────────────────────────────────
// Promote to chief
// ──────────────────────────────────────
describe('promote-chief', () => {
  it('clears leadId inside a Serializable transaction', async () => {
    mockPrisma.setting.findMany.mockResolvedValue([{ key: 'affiliate_pro_rate', value: '50' }]);
    mockCrewMember.update.mockResolvedValue({ name: 'Test Crew' });

    await POST(makeReq({ action: 'promote-chief', memberId: 'crew1', teamName: 'New Team' }));

    expect(mockPrisma.$transaction).toHaveBeenCalledWith(
      expect.any(Function),
      { isolationLevel: 'Serializable' },
    );
    const updateCall = mockCrewMember.update.mock.calls[0][0];
    expect(updateCall.data.role).toBe('chief');
    expect(updateCall.data.leadId).toBeNull();
  });
});

// ──────────────────────────────────────
// Demote to crew
// ──────────────────────────────────────
describe('demote-crew', () => {
  it('runs in a Serializable transaction', async () => {
    mockCrewMember.updateMany.mockResolvedValue({ count: 2 });
    mockCrewMember.update.mockResolvedValue({ name: 'Ex Chief' });
    mockCrewMember.findUnique.mockResolvedValue({ name: 'Ex Chief' });

    const res = await POST(makeReq({ action: 'demote-crew', memberId: 'chief1' }));
    const body = await res.json();

    expect(mockPrisma.$transaction).toHaveBeenCalledWith(
      expect.any(Function),
      { isolationLevel: 'Serializable' },
    );
    expect(body.ok).toBe(true);
    expect(body.unassignedCrew).toBe(2);
  });

  it('reports actual updateMany count', async () => {
    mockCrewMember.updateMany.mockResolvedValue({ count: 3 });
    mockCrewMember.update.mockResolvedValue({ name: 'Chief' });
    mockCrewMember.findUnique.mockResolvedValue({ name: 'Chief' });

    const res = await POST(makeReq({ action: 'demote-crew', memberId: 'chief1' }));
    const body = await res.json();

    expect(body.unassignedCrew).toBe(3);
  });

  it('reports zero when no orphans exist', async () => {
    mockCrewMember.updateMany.mockResolvedValue({ count: 0 });
    mockCrewMember.update.mockResolvedValue({ name: 'Solo Chief' });
    mockCrewMember.findUnique.mockResolvedValue({ name: 'Solo Chief' });

    const res = await POST(makeReq({ action: 'demote-crew', memberId: 'chief1' }));
    const body = await res.json();

    expect(body.unassignedCrew).toBe(0);
  });
});

// ──────────────────────────────────────
// Assign/move team
// ──────────────────────────────────────
describe('assign-team', () => {
  it('rejects self-assignment', async () => {
    const res = await POST(makeReq({ action: 'assign-team', memberId: 'chief1', chiefId: 'chief1' }));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toMatch(/themselves/);
  });

  it('rejects assigning a chief to a team', async () => {
    mockCrewMember.findUnique
      .mockResolvedValueOnce({ name: 'Dest Chief', role: 'chief', status: 'approved', deletedAt: null })
      .mockResolvedValueOnce({ name: 'Source Chief', role: 'chief' });

    const res = await POST(makeReq({ action: 'assign-team', memberId: 'chief2', chiefId: 'chief1' }));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toMatch(/Chiefs cannot/);
  });

  it('rejects non-chief as destination', async () => {
    mockCrewMember.findUnique
      .mockResolvedValueOnce({ name: 'Just Crew', role: 'crew', status: 'approved', deletedAt: null })
      .mockResolvedValueOnce({ name: 'Member', role: 'crew' });

    const res = await POST(makeReq({ action: 'assign-team', memberId: 'crew1', chiefId: 'crew2' }));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toMatch(/must be a chief/);
  });

  it('rejects suspended chief as destination', async () => {
    mockCrewMember.findUnique
      .mockResolvedValueOnce({ name: 'Suspended Chief', role: 'chief', status: 'suspended', deletedAt: null })
      .mockResolvedValueOnce({ name: 'Member', role: 'crew' });

    const res = await POST(makeReq({ action: 'assign-team', memberId: 'crew1', chiefId: 'chief-sus' }));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toMatch(/not active/);
  });

  it('rejects soft-deleted chief as destination', async () => {
    mockCrewMember.findUnique
      .mockResolvedValueOnce({ name: 'Deleted Chief', role: 'chief', status: 'approved', deletedAt: new Date() })
      .mockResolvedValueOnce({ name: 'Member', role: 'crew' });

    const res = await POST(makeReq({ action: 'assign-team', memberId: 'crew1', chiefId: 'chief-del' }));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toMatch(/not active/);
  });

  it('returns 404 when source member does not exist', async () => {
    mockCrewMember.findUnique
      .mockResolvedValueOnce({ name: 'Good Chief', role: 'chief', status: 'approved', deletedAt: null })
      .mockResolvedValueOnce(null);

    const res = await POST(makeReq({ action: 'assign-team', memberId: 'ghost', chiefId: 'chief1' }));
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.error).toMatch(/not found/i);
  });

  it('validates and writes inside a Serializable transaction', async () => {
    mockCrewMember.findUnique
      .mockResolvedValueOnce({ name: 'Good Chief', role: 'chief', status: 'approved', deletedAt: null })
      .mockResolvedValueOnce({ name: 'Crew Member', role: 'crew' });
    mockCrewMember.update.mockResolvedValue({});

    const res = await POST(makeReq({ action: 'assign-team', memberId: 'crew1', chiefId: 'chief1' }));
    const body = await res.json();

    expect(body.ok).toBe(true);
    expect(mockPrisma.$transaction).toHaveBeenCalledWith(
      expect.any(Function),
      { isolationLevel: 'Serializable' },
    );
  });
});

// ──────────────────────────────────────
// P2034 retry across all hierarchy ops
// ──────────────────────────────────────
describe('P2034 retry', () => {
  it('retries promote-chief on P2034', async () => {
    const p2034 = Object.assign(new Error('Write conflict'), { code: 'P2034' });
    let calls = 0;
    mockPrisma.$transaction.mockImplementation(async (fn) => {
      calls++;
      if (calls === 1) throw p2034;
      return fn(mockPrisma);
    });
    mockPrisma.setting.findMany.mockResolvedValue([{ key: 'affiliate_pro_rate', value: '50' }]);
    mockCrewMember.update.mockResolvedValue({ name: 'Retry Chief' });

    const res = await POST(makeReq({ action: 'promote-chief', memberId: 'crew1' }));
    const body = await res.json();

    expect(body.ok).toBe(true);
    expect(calls).toBe(2);
  });

  it('retries demote-crew on P2034', async () => {
    const p2034 = Object.assign(new Error('Write conflict'), { code: 'P2034' });
    let calls = 0;
    mockPrisma.$transaction.mockImplementation(async (fn) => {
      calls++;
      if (calls === 1) throw p2034;
      return fn(mockPrisma);
    });
    mockCrewMember.updateMany.mockResolvedValue({ count: 1 });
    mockCrewMember.update.mockResolvedValue({ name: 'Retry Demote' });
    mockCrewMember.findUnique.mockResolvedValue({ name: 'Retry Demote' });

    const res = await POST(makeReq({ action: 'demote-crew', memberId: 'chief1' }));
    const body = await res.json();

    expect(body.ok).toBe(true);
    expect(calls).toBe(2);
  });

  it('retries assign-team on P2034', async () => {
    const p2034 = Object.assign(new Error('Write conflict'), { code: 'P2034' });
    let calls = 0;
    mockPrisma.$transaction.mockImplementation(async (fn) => {
      calls++;
      if (calls === 1) throw p2034;
      return fn(mockPrisma);
    });
    mockCrewMember.findUnique
      .mockResolvedValueOnce({ name: 'Chief', role: 'chief', status: 'approved', deletedAt: null })
      .mockResolvedValueOnce({ name: 'Crew', role: 'crew' });
    mockCrewMember.update.mockResolvedValue({});

    const res = await POST(makeReq({ action: 'assign-team', memberId: 'crew1', chiefId: 'chief1' }));
    const body = await res.json();

    expect(body.ok).toBe(true);
    expect(calls).toBe(2);
  });

  it('gives up after max retries', async () => {
    const p2034 = Object.assign(new Error('Write conflict'), { code: 'P2034' });
    mockPrisma.$transaction.mockRejectedValue(p2034);

    const res = await POST(makeReq({ action: 'promote-chief', memberId: 'crew1' }));
    expect(res.status).toBe(500);
  });
});

// ──────────────────────────────────────
// Admin reject — guarded write
// ──────────────────────────────────────
describe('admin reject', () => {
  it('guards with status: pending to prevent overwriting concurrent join', async () => {
    mockCrewMember.findUnique.mockResolvedValue({ name: 'Test', email: 'test@t.com', telegramUserId: null });
    mockCrewMember.updateMany.mockResolvedValue({ count: 1 });

    const res = await POST(makeReq({ action: 'reject', memberId: 'crew1' }));
    const body = await res.json();

    expect(body.ok).toBe(true);
    expect(mockCrewMember.updateMany).toHaveBeenCalledWith({
      where: { id: 'crew1', status: 'pending' },
      data: { status: 'rejected', inviteToken: null, inviteExpiresAt: null },
    });
  });

  it('returns 409 when member was approved concurrently', async () => {
    mockCrewMember.findUnique.mockResolvedValue({ name: 'Test', email: 'test@t.com', telegramUserId: null });
    mockCrewMember.updateMany.mockResolvedValue({ count: 0 });

    const res = await POST(makeReq({ action: 'reject', memberId: 'crew1' }));
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toMatch(/no longer pending/i);
  });
});
