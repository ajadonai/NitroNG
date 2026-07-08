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
  $transaction: vi.fn(async (fnOrOps) => {
    if (typeof fnOrOps === 'function') return fnOrOps(mockPrisma);
    return Promise.all(fnOrOps);
  }),
};

vi.mock('@/lib/prisma', () => ({ default: mockPrisma }));
vi.mock('@/lib/logger', () => ({ log: { error: vi.fn() } }));
vi.mock('@/lib/crew-bot', () => ({ kickFromGroup: vi.fn() }));
vi.mock('@/lib/email', () => ({ sendEmail: vi.fn(), pitRejectionEmail: vi.fn() }));

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
  mockPrisma.$transaction.mockImplementation(async (fnOrOps) => {
    if (typeof fnOrOps === 'function') return fnOrOps(mockPrisma);
    return Promise.all(fnOrOps);
  });
});

// ──────────────────────────────────────
// Promote to chief
// ──────────────────────────────────────
describe('promote-chief', () => {
  it('clears leadId when promoting to chief', async () => {
    mockPrisma.setting.findUnique.mockResolvedValue({ value: '50' });
    mockCrewMember.update.mockResolvedValue({});
    mockCrewMember.findUnique.mockResolvedValue({ name: 'Test Crew' });

    await POST(makeReq({ action: 'promote-chief', memberId: 'crew1', teamName: 'New Team' }));

    const updateCall = mockCrewMember.update.mock.calls[0][0];
    expect(updateCall.data.role).toBe('chief');
    expect(updateCall.data.leadId).toBeNull();
  });
});

// ──────────────────────────────────────
// Demote to crew
// ──────────────────────────────────────
describe('demote-crew', () => {
  it('runs unassignment and role change in an interactive transaction', async () => {
    mockCrewMember.updateMany.mockResolvedValue({ count: 2 });
    mockCrewMember.update.mockResolvedValue({ name: 'Ex Chief' });
    mockCrewMember.findUnique.mockResolvedValue({ name: 'Ex Chief' });

    const res = await POST(makeReq({ action: 'demote-crew', memberId: 'chief1' }));
    const body = await res.json();

    expect(mockPrisma.$transaction).toHaveBeenCalledWith(expect.any(Function));
    expect(body.ok).toBe(true);
    expect(body.unassignedCrew).toBe(2);

    const updateCall = mockCrewMember.update.mock.calls[0][0];
    expect(updateCall.data.role).toBe('crew');
    expect(updateCall.data.teamName).toBeNull();
  });

  it('reports actual updateMany count, not pre-query length', async () => {
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
    expect(mockCrewMember.update).toHaveBeenCalledWith({
      where: { id: 'crew1' },
      data: { leadId: 'chief1' },
    });
  });
});
