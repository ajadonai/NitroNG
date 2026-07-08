import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockPrisma = {
  crewMember: { findUnique: vi.fn(), findMany: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
  setting: { findUnique: vi.fn(), findMany: vi.fn() },
  acquisitionLink: { findFirst: vi.fn(), findUnique: vi.fn(), create: vi.fn() },
  activityLog: { create: vi.fn().mockResolvedValue({}) },
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
});

// ──────────────────────────────────────
// Promote to chief
// ──────────────────────────────────────
describe('promote-chief', () => {
  it('clears leadId when promoting to chief', async () => {
    mockPrisma.setting.findUnique.mockResolvedValue({ value: '50' });
    mockPrisma.crewMember.update.mockResolvedValue({});
    mockPrisma.crewMember.findUnique.mockResolvedValue({ name: 'Test Crew' });

    await POST(makeReq({ action: 'promote-chief', memberId: 'crew1', teamName: 'New Team' }));

    const updateCall = mockPrisma.crewMember.update.mock.calls[0][0];
    expect(updateCall.data.role).toBe('chief');
    expect(updateCall.data.leadId).toBeNull();
  });
});

// ──────────────────────────────────────
// Demote to crew
// ──────────────────────────────────────
describe('demote-crew', () => {
  it('clears teamName when demoting', async () => {
    mockPrisma.crewMember.findMany.mockResolvedValue([]);
    mockPrisma.crewMember.update.mockResolvedValue({});
    mockPrisma.crewMember.findUnique.mockResolvedValue({ name: 'Ex Chief' });

    await POST(makeReq({ action: 'demote-crew', memberId: 'chief1' }));

    const updateCall = mockPrisma.crewMember.update.mock.calls[0][0];
    expect(updateCall.data.teamName).toBeNull();
    expect(updateCall.data.role).toBe('crew');
  });

  it('unassigns orphaned crew members', async () => {
    mockPrisma.crewMember.findMany.mockResolvedValue([{ id: 'c1' }, { id: 'c2' }]);
    mockPrisma.crewMember.updateMany.mockResolvedValue({ count: 2 });
    mockPrisma.crewMember.update.mockResolvedValue({});
    mockPrisma.crewMember.findUnique.mockResolvedValue({ name: 'Ex Chief' });

    const res = await POST(makeReq({ action: 'demote-crew', memberId: 'chief1' }));
    const body = await res.json();

    expect(mockPrisma.crewMember.updateMany).toHaveBeenCalledWith({
      where: { leadId: 'chief1' },
      data: { leadId: null },
    });
    expect(body.unassignedCrew).toBe(2);
  });

  it('reports zero when no orphans exist', async () => {
    mockPrisma.crewMember.findMany.mockResolvedValue([]);
    mockPrisma.crewMember.update.mockResolvedValue({});
    mockPrisma.crewMember.findUnique.mockResolvedValue({ name: 'Solo Chief' });

    const res = await POST(makeReq({ action: 'demote-crew', memberId: 'chief1' }));
    const body = await res.json();

    expect(mockPrisma.crewMember.updateMany).not.toHaveBeenCalled();
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
    mockPrisma.crewMember.findUnique
      .mockResolvedValueOnce({ name: 'Dest Chief', role: 'chief', status: 'approved' })
      .mockResolvedValueOnce({ name: 'Source Chief', role: 'chief' });

    const res = await POST(makeReq({ action: 'assign-team', memberId: 'chief2', chiefId: 'chief1' }));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toMatch(/Chiefs cannot/);
  });

  it('rejects non-chief as destination', async () => {
    mockPrisma.crewMember.findUnique
      .mockResolvedValueOnce({ name: 'Just Crew', role: 'crew', status: 'approved' })
      .mockResolvedValueOnce({ name: 'Member', role: 'crew' });

    const res = await POST(makeReq({ action: 'assign-team', memberId: 'crew1', chiefId: 'crew2' }));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toMatch(/must be a chief/);
  });

  it('rejects suspended chief as destination', async () => {
    mockPrisma.crewMember.findUnique
      .mockResolvedValueOnce({ name: 'Suspended Chief', role: 'chief', status: 'suspended' })
      .mockResolvedValueOnce({ name: 'Member', role: 'crew' });

    const res = await POST(makeReq({ action: 'assign-team', memberId: 'crew1', chiefId: 'chief-sus' }));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toMatch(/not active/);
  });

  it('allows valid crew-to-chief assignment', async () => {
    mockPrisma.crewMember.findUnique
      .mockResolvedValueOnce({ name: 'Good Chief', role: 'chief', status: 'approved' })
      .mockResolvedValueOnce({ name: 'Crew Member', role: 'crew' });
    mockPrisma.crewMember.update.mockResolvedValue({});

    const res = await POST(makeReq({ action: 'assign-team', memberId: 'crew1', chiefId: 'chief1' }));
    const body = await res.json();

    expect(body.ok).toBe(true);
    expect(mockPrisma.crewMember.update).toHaveBeenCalledWith({
      where: { id: 'crew1' },
      data: { leadId: 'chief1' },
    });
  });
});
