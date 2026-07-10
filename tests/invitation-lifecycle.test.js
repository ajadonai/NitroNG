import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Prisma mock ──
const mockPrisma = {
  crewMember: {
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    delete: vi.fn(),
    deleteMany: vi.fn(),
  },
  user: { findUnique: vi.fn(), create: vi.fn() },
  crewSession: { create: vi.fn() },
  $transaction: vi.fn(),
};

vi.mock('@/lib/prisma', () => ({ default: mockPrisma }));
vi.mock('@/lib/logger', () => ({ log: { error: vi.fn() } }));
vi.mock('bcryptjs', () => ({ default: { hash: vi.fn().mockResolvedValue('$hashed') } }));
vi.mock('next/headers', () => ({
  cookies: vi.fn().mockResolvedValue({ set: vi.fn() }),
}));

const mockGetCrewSession = vi.fn();
vi.mock('@/lib/crew', () => ({ getCrewSession: (...a) => mockGetCrewSession(...a) }));

const CHIEF = { id: 'chief1', role: 'chief', name: 'Boss' };

const { GET: joinGET, POST: joinPOST } = await import('@/app/api/pit/auth/join/route');
const { POST: teamPOST, PATCH: teamPATCH, DELETE: teamDELETE } = await import('@/app/api/pit/team/route');

function makeJoinReq(params) {
  return new Request(`http://localhost/api/pit/auth/join?${new URLSearchParams(params)}`, { method: 'GET' });
}

function makeJoinPost(body) {
  return new Request('http://localhost/api/pit/auth/join', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function makeTeamReq(method, body) {
  return new Request('http://localhost/api/pit/team', {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const VALID_MEMBER = {
  id: 'm1', inviteToken: 'tok', status: 'pending', deletedAt: null,
  email: 'test@t.com', name: 'Test', phone: null, userId: null,
  inviteExpiresAt: new Date(Date.now() + 86400000),
};

beforeEach(() => {
  vi.clearAllMocks();
  mockGetCrewSession.mockResolvedValue(CHIEF);
  mockPrisma.$transaction.mockImplementation(async (fn) => fn(mockPrisma));
  mockPrisma.crewMember.updateMany.mockResolvedValue({ count: 1 });
  mockPrisma.crewMember.deleteMany.mockResolvedValue({ count: 1 });
});

// ──────────────────────────────────────
// URL correctness
// ──────────────────────────────────────
describe('invite URL', () => {
  it('generates /pit/join/ URLs, not /m/join/', async () => {
    mockPrisma.crewMember.findUnique.mockResolvedValue(null);
    mockPrisma.crewMember.create.mockResolvedValue({ id: 'new1', name: 'Test', email: 'test@t.com' });

    const res = await teamPOST(makeTeamReq('POST', { name: 'Test', email: 'test@t.com' }));
    const body = await res.json();

    expect(body.invited.inviteUrl).toContain('/pit/join/');
    expect(body.invited.inviteUrl).not.toContain('/m/join/');
  });
});

// ──────────────────────────────────────
// Rejected/suspended/deleted token blocking
// ──────────────────────────────────────
describe('rejected token blocking', () => {
  it('GET blocks rejected members', async () => {
    mockPrisma.crewMember.findUnique.mockResolvedValue({
      inviteToken: 'tok', status: 'rejected', deletedAt: null,
      inviteExpiresAt: new Date(Date.now() + 86400000),
    });

    const res = await joinGET(makeJoinReq({ token: 'tok' }));
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toMatch(/revoked/i);
  });

  it('POST blocks rejected members inside transaction', async () => {
    mockPrisma.crewMember.findUnique.mockResolvedValue({
      inviteToken: 'tok', status: 'rejected', deletedAt: null,
    });

    const res = await joinPOST(makeJoinPost({ token: 'tok', password: 'abc123' }));
    expect(res.status).toBe(403);
  });

  it('GET blocks suspended members', async () => {
    mockPrisma.crewMember.findUnique.mockResolvedValue({
      inviteToken: 'tok', status: 'suspended', deletedAt: null,
    });

    const res = await joinGET(makeJoinReq({ token: 'tok' }));
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toMatch(/suspended/i);
  });

  it('GET blocks soft-deleted members', async () => {
    mockPrisma.crewMember.findUnique.mockResolvedValue({
      inviteToken: 'tok', status: 'pending', deletedAt: new Date(),
    });

    const res = await joinGET(makeJoinReq({ token: 'tok' }));
    expect(res.status).toBe(404);
  });

  it('POST blocks soft-deleted members inside transaction', async () => {
    mockPrisma.crewMember.findUnique.mockResolvedValue({
      inviteToken: 'tok', status: 'pending', deletedAt: new Date(),
    });

    const res = await joinPOST(makeJoinPost({ token: 'tok', password: 'abc123' }));
    expect(res.status).toBe(404);
  });
});

// ──────────────────────────────────────
// Expired token handling
// ──────────────────────────────────────
describe('expired token', () => {
  it('GET returns 410 with helpful message', async () => {
    mockPrisma.crewMember.findUnique.mockResolvedValue({
      inviteToken: 'tok', status: 'pending', deletedAt: null,
      inviteExpiresAt: new Date(Date.now() - 86400000),
    });

    const res = await joinGET(makeJoinReq({ token: 'tok' }));
    expect(res.status).toBe(410);
    const body = await res.json();
    expect(body.error).toMatch(/resend/i);
  });

  it('POST clears expired token outside the transaction', async () => {
    mockPrisma.crewMember.findUnique.mockResolvedValue({
      id: 'm1', inviteToken: 'expired-tok', status: 'pending', deletedAt: null,
      inviteExpiresAt: new Date(Date.now() - 86400000),
    });

    const res = await joinPOST(makeJoinPost({ token: 'expired-tok', password: 'abc123' }));
    expect(res.status).toBe(410);

    expect(mockPrisma.crewMember.updateMany).toHaveBeenCalledWith({
      where: { inviteToken: 'expired-tok' },
      data: { inviteToken: null, inviteExpiresAt: null },
    });
  });

  it('expired cleanup does not clear a regenerated token', async () => {
    mockPrisma.crewMember.findUnique.mockResolvedValue({
      id: 'm1', inviteToken: 'old-tok', status: 'pending', deletedAt: null,
      inviteExpiresAt: new Date(Date.now() - 86400000),
    });

    await joinPOST(makeJoinPost({ token: 'old-tok', password: 'abc123' }));

    const cleanupCall = mockPrisma.crewMember.updateMany.mock.calls[0][0];
    expect(cleanupCall.where.inviteToken).toBe('old-tok');
  });
});

// ──────────────────────────────────────
// Transactional join with Serializable isolation
// ──────────────────────────────────────
describe('transactional join', () => {
  it('validates and writes inside a Serializable transaction', async () => {
    mockPrisma.crewMember.findUnique.mockResolvedValue(VALID_MEMBER);
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'user1' });
    mockPrisma.crewMember.update.mockResolvedValue({});
    mockPrisma.crewSession.create.mockResolvedValue({});

    const res = await joinPOST(makeJoinPost({ token: 'tok', password: 'abc123' }));
    const body = await res.json();

    expect(body.ok).toBe(true);
    expect(mockPrisma.$transaction).toHaveBeenCalledWith(
      expect.any(Function),
      { isolationLevel: 'Serializable' },
    );
  });

  it('creates user inside transaction when none exists', async () => {
    mockPrisma.crewMember.findUnique.mockResolvedValue(VALID_MEMBER);
    mockPrisma.user.findUnique.mockResolvedValue(null);
    mockPrisma.user.create.mockResolvedValue({ id: 'user-new' });
    mockPrisma.crewMember.update.mockResolvedValue({});
    mockPrisma.crewSession.create.mockResolvedValue({});

    await joinPOST(makeJoinPost({ token: 'tok', password: 'abc123' }));

    expect(mockPrisma.user.create).toHaveBeenCalled();
    const updateCall = mockPrisma.crewMember.update.mock.calls[0][0];
    expect(updateCall.data.userId).toBe('user-new');
    expect(updateCall.data.inviteToken).toBeNull();
  });

  it('token lookup happens inside the transaction', async () => {
    let findCalledInsideTx = false;
    mockPrisma.$transaction.mockImplementation(async (fn) => {
      findCalledInsideTx = false;
      mockPrisma.crewMember.findUnique.mockImplementation(async () => {
        findCalledInsideTx = true;
        return VALID_MEMBER;
      });
      return fn(mockPrisma);
    });
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'u1' });
    mockPrisma.crewMember.update.mockResolvedValue({});
    mockPrisma.crewSession.create.mockResolvedValue({});

    await joinPOST(makeJoinPost({ token: 'tok', password: 'abc123' }));

    expect(findCalledInsideTx).toBe(true);
  });
});

// ──────────────────────────────────────
// P2034 retry on join
// ──────────────────────────────────────
describe('P2034 retry on join', () => {
  it('retries on P2034 then succeeds', async () => {
    const p2034 = Object.assign(new Error('Write conflict'), { code: 'P2034' });
    let calls = 0;
    mockPrisma.$transaction.mockImplementation(async (fn) => {
      calls++;
      if (calls === 1) throw p2034;
      return fn(mockPrisma);
    });
    mockPrisma.crewMember.findUnique.mockResolvedValue(VALID_MEMBER);
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'u1' });
    mockPrisma.crewMember.update.mockResolvedValue({});
    mockPrisma.crewSession.create.mockResolvedValue({});

    const res = await joinPOST(makeJoinPost({ token: 'tok', password: 'abc123' }));
    expect((await res.json()).ok).toBe(true);
    expect(calls).toBe(2);
  });

  it('gives up after max retries', async () => {
    const p2034 = Object.assign(new Error('Write conflict'), { code: 'P2034' });
    mockPrisma.$transaction.mockRejectedValue(p2034);

    const res = await joinPOST(makeJoinPost({ token: 'tok', password: 'abc123' }));
    expect(res.status).toBe(500);
  });
});

// ──────────────────────────────────────
// Resend (PATCH) — guarded writes
// ──────────────────────────────────────
describe('resend invite', () => {
  it('regenerates token for pending member', async () => {
    mockPrisma.crewMember.findUnique.mockResolvedValue({
      id: 'crew1', name: 'Test', leadId: 'chief1', status: 'pending', deletedAt: null,
    });

    const res = await teamPATCH(makeTeamReq('PATCH', { memberId: 'crew1' }));
    const body = await res.json();

    expect(body.ok).toBe(true);
    expect(body.inviteUrl).toContain('/pit/join/');
    const updateCall = mockPrisma.crewMember.updateMany.mock.calls[0][0];
    expect(updateCall.where).toMatchObject({ id: 'crew1', status: 'pending', deletedAt: null });
    expect(updateCall.data.inviteToken).toBeTruthy();
    expect(updateCall.data.inviteExpiresAt).toBeInstanceOf(Date);
  });

  it('returns 409 when member was approved concurrently', async () => {
    mockPrisma.crewMember.findUnique.mockResolvedValue({
      id: 'crew1', name: 'Test', leadId: 'chief1', status: 'pending', deletedAt: null,
    });
    mockPrisma.crewMember.updateMany.mockResolvedValue({ count: 0 });

    const res = await teamPATCH(makeTeamReq('PATCH', { memberId: 'crew1' }));
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toMatch(/no longer pending/i);
  });

  it('rejects resend for approved members', async () => {
    mockPrisma.crewMember.findUnique.mockResolvedValue({
      id: 'crew1', name: 'Test', leadId: 'chief1', status: 'approved', deletedAt: null,
    });

    const res = await teamPATCH(makeTeamReq('PATCH', { memberId: 'crew1' }));
    expect(res.status).toBe(400);
  });

  it('rejects resend for other chief members', async () => {
    mockPrisma.crewMember.findUnique.mockResolvedValue({
      id: 'crew1', name: 'Test', leadId: 'chief2', status: 'pending', deletedAt: null,
    });

    const res = await teamPATCH(makeTeamReq('PATCH', { memberId: 'crew1' }));
    expect(res.status).toBe(404);
  });

  it('rejects resend for deleted members', async () => {
    mockPrisma.crewMember.findUnique.mockResolvedValue({
      id: 'crew1', name: 'Test', leadId: 'chief1', status: 'pending', deletedAt: new Date(),
    });

    const res = await teamPATCH(makeTeamReq('PATCH', { memberId: 'crew1' }));
    expect(res.status).toBe(410);
  });
});

// ──────────────────────────────────────
// Revoke (DELETE) — guarded writes
// ──────────────────────────────────────
describe('revoke invite', () => {
  it('deletes pending member with status guard', async () => {
    mockPrisma.crewMember.findUnique.mockResolvedValue({
      id: 'crew1', name: 'Test', leadId: 'chief1', status: 'pending',
    });

    const res = await teamDELETE(makeTeamReq('DELETE', { memberId: 'crew1' }));
    const body = await res.json();

    expect(body.ok).toBe(true);
    expect(mockPrisma.crewMember.deleteMany).toHaveBeenCalledWith({
      where: { id: 'crew1', status: 'pending' },
    });
  });

  it('returns 409 when member was approved concurrently', async () => {
    mockPrisma.crewMember.findUnique.mockResolvedValue({
      id: 'crew1', name: 'Test', leadId: 'chief1', status: 'pending',
    });
    mockPrisma.crewMember.deleteMany.mockResolvedValue({ count: 0 });

    const res = await teamDELETE(makeTeamReq('DELETE', { memberId: 'crew1' }));
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toMatch(/no longer pending/i);
  });

  it('rejects revoke for approved members', async () => {
    mockPrisma.crewMember.findUnique.mockResolvedValue({
      id: 'crew1', name: 'Test', leadId: 'chief1', status: 'approved',
    });

    const res = await teamDELETE(makeTeamReq('DELETE', { memberId: 'crew1' }));
    expect(res.status).toBe(400);
  });

  it('rejects revoke for other chief members', async () => {
    mockPrisma.crewMember.findUnique.mockResolvedValue({
      id: 'crew1', name: 'Test', leadId: 'chief2', status: 'pending',
    });

    const res = await teamDELETE(makeTeamReq('DELETE', { memberId: 'crew1' }));
    expect(res.status).toBe(404);
  });
});
