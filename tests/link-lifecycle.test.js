import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Prisma mock ──
const mockTx = {
  setting: { findUnique: vi.fn(), findMany: vi.fn() },
  acquisitionLink: { count: vi.fn(), create: vi.fn() },
  $queryRaw: vi.fn(),
};

const mockPrisma = {
  acquisitionLink: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    count: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  crewMember: { findMany: vi.fn(), findUnique: vi.fn() },
  setting: { findUnique: vi.fn(), findMany: vi.fn() },
  linkLog: { create: vi.fn().mockResolvedValue({}) },
  $transaction: vi.fn(async (fn) => fn(mockTx)),
};

vi.mock('@/lib/prisma', () => ({ default: mockPrisma }));
vi.mock('@/lib/logger', () => ({ log: { error: vi.fn() } }));

const mockGetCrewSession = vi.fn();
vi.mock('@/lib/crew', () => ({ getCrewSession: (...a) => mockGetCrewSession(...a) }));

const CHIEF = { id: 'chief1', role: 'chief', name: 'Boss' };

const { GET, POST, PATCH, DELETE } = await import('@/app/api/pit/links/route');
const { verifyLinkOwnership } = await import('@/lib/link-ownership');

function makeReq(body) {
  return new Request('http://localhost/api/pit/links', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function makeDeleteReq(body) {
  return new Request('http://localhost/api/pit/links', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function makePatchReq(body) {
  return new Request('http://localhost/api/pit/links', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function makeGetReq(params = '') {
  return new Request(`http://localhost/api/pit/links${params ? '?' + params : ''}`, { method: 'GET' });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetCrewSession.mockResolvedValue(CHIEF);
  mockPrisma.crewMember.findMany.mockResolvedValue([]);
  mockPrisma.setting.findMany.mockResolvedValue([{ key: 'affiliate_enabled', value: 'true' }]);
  mockPrisma.$transaction.mockImplementation(async (fn) => fn(mockTx));
  mockTx.$queryRaw.mockResolvedValue([{ id: 'chief1' }]);
});

// ──────────────────────────────────────
// Link limit enforcement
// ──────────────────────────────────────
describe('POST link limit', () => {
  it('blocks creation when team is at limit', async () => {
    mockTx.setting.findMany.mockResolvedValue([{ key: 'affiliate_max_links', value: '3' }]);
    mockTx.acquisitionLink.count.mockResolvedValue(3);

    const res = await POST(makeReq({ name: 'New Link' }));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toMatch(/Maximum 3/);
    expect(mockTx.acquisitionLink.create).not.toHaveBeenCalled();
  });

  it('counts by createdByChiefId not affiliateId', async () => {
    mockTx.setting.findMany.mockResolvedValue([{ key: 'affiliate_max_links', value: '5' }]);
    mockTx.acquisitionLink.count.mockResolvedValue(2);
    mockTx.acquisitionLink.create.mockResolvedValue({
      id: 'new', name: 'Test', slug: 'test', enabled: true, createdByChiefId: 'chief1', createdAt: new Date(),
    });

    await POST(makeReq({ name: 'Test Link' }));

    const countCall = mockTx.acquisitionLink.count.mock.calls[0][0];
    expect(countCall.where.createdByChiefId).toBe('chief1');
    expect(countCall.where.affiliateId).toBeUndefined();
  });

  it('defaults to 5 when setting is missing', async () => {
    mockTx.setting.findMany.mockResolvedValue([]);
    mockTx.acquisitionLink.count.mockResolvedValue(5);

    const res = await POST(makeReq({ name: 'Over Limit' }));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toMatch(/Maximum 5/);
  });

  it('limit check and create run inside a serializable transaction', async () => {
    mockTx.setting.findMany.mockResolvedValue([{ key: 'affiliate_max_links', value: '10' }]);
    mockTx.acquisitionLink.count.mockResolvedValue(1);
    mockTx.acquisitionLink.create.mockResolvedValue({
      id: 'new', name: 'Test', slug: 'test', enabled: true, createdByChiefId: 'chief1', createdAt: new Date(),
    });

    await POST(makeReq({ name: 'Test' }));

    expect(mockPrisma.$transaction).toHaveBeenCalledWith(
      expect.any(Function),
      { isolationLevel: 'Serializable' },
    );
  });

  it('sets createdByChiefId to the creating chief', async () => {
    mockTx.setting.findMany.mockResolvedValue([{ key: 'affiliate_max_links', value: '10' }]);
    mockTx.acquisitionLink.count.mockResolvedValue(0);
    mockTx.acquisitionLink.create.mockResolvedValue({
      id: 'new', name: 'Test', slug: 'test', enabled: true, createdByChiefId: 'chief1', createdAt: new Date(),
    });

    await POST(makeReq({ name: 'Ownership Test' }));

    const createCall = mockTx.acquisitionLink.create.mock.calls[0][0];
    expect(createCall.data.createdByChiefId).toBe('chief1');
  });

  it('creates nothing when deletion wins the final actor lock', async () => {
    mockTx.$queryRaw.mockResolvedValue([]);

    const res = await POST(makeReq({ name: 'Too Late' }));

    expect(res.status).toBe(409);
    expect(mockTx.acquisitionLink.create).not.toHaveBeenCalled();
    const lockSql = [...mockTx.$queryRaw.mock.calls[0][0]].join('');
    expect(lockSql).toContain("status = 'approved'");
    expect(lockSql).toContain('"deletedAt" IS NULL');
    expect(lockSql).toContain('FOR UPDATE');
  });
});

// ──────────────────────────────────────
// Slug race condition
// ──────────────────────────────────────
describe('POST slug uniqueness', () => {
  it('returns 409 on duplicate slug (P2002)', async () => {
    mockTx.setting.findMany.mockResolvedValue([{ key: 'affiliate_max_links', value: '10' }]);
    mockTx.acquisitionLink.count.mockResolvedValue(0);
    const p2002 = new Error('Unique constraint failed');
    p2002.code = 'P2002';
    mockTx.acquisitionLink.create.mockRejectedValue(p2002);

    const res = await POST(makeReq({ name: 'Duplicate' }));
    const body = await res.json();

    expect(res.status).toBe(409);
    expect(body.error).toMatch(/slug.*taken/i);
  });

  it('re-throws non-P2002 errors', async () => {
    mockTx.setting.findMany.mockResolvedValue([{ key: 'affiliate_max_links', value: '10' }]);
    mockTx.acquisitionLink.count.mockResolvedValue(0);
    mockTx.acquisitionLink.create.mockRejectedValue(new Error('DB down'));

    const res = await POST(makeReq({ name: 'Fail' }));
    expect(res.status).toBe(500);
  });
});

// ──────────────────────────────────────
// Archive sets enabled=false
// ──────────────────────────────────────
describe('DELETE archive', () => {
  it('sets both archivedAt and enabled=false', async () => {
    mockPrisma.acquisitionLink.findUnique.mockResolvedValue({ id: 'link1', affiliateId: 'chief1', createdByChiefId: 'chief1' });
    mockPrisma.acquisitionLink.update.mockResolvedValue({});

    const res = await DELETE(makeDeleteReq({ id: 'link1' }));
    const body = await res.json();

    expect(body.ok).toBe(true);
    const updateCall = mockPrisma.acquisitionLink.update.mock.calls[0][0];
    expect(updateCall.data.enabled).toBe(false);
    expect(updateCall.data.archivedAt).toBeInstanceOf(Date);
  });
});

// ──────────────────────────────────────
// Setting key alignment
// ──────────────────────────────────────
describe('P2034 serialization retry', () => {
  it('retries on P2034 then succeeds', async () => {
    const p2034 = new Error('Write conflict');
    p2034.code = 'P2034';
    let callCount = 0;
    mockPrisma.$transaction.mockImplementation(async (fn, opts) => {
      callCount++;
      if (callCount === 1) throw p2034;
      return fn(mockTx);
    });
    mockTx.setting.findMany.mockResolvedValue([{ key: 'affiliate_max_links', value: '10' }]);
    mockTx.acquisitionLink.count.mockResolvedValue(0);
    mockTx.acquisitionLink.create.mockResolvedValue({
      id: 'retry-ok', name: 'Retry', slug: 'retry', enabled: true, createdByChiefId: 'chief1', createdAt: new Date(),
    });

    const res = await POST(makeReq({ name: 'Retry Link' }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.link.id).toBe('retry-ok');
    expect(callCount).toBe(2);
  });

  it('retries on P2034 then hits cap', async () => {
    const p2034 = new Error('Write conflict');
    p2034.code = 'P2034';
    let callCount = 0;
    mockPrisma.$transaction.mockImplementation(async (fn, opts) => {
      callCount++;
      if (callCount === 1) throw p2034;
      return fn(mockTx);
    });
    mockTx.setting.findMany.mockResolvedValue([{ key: 'affiliate_max_links', value: '3' }]);
    mockTx.acquisitionLink.count.mockResolvedValue(3);

    const res = await POST(makeReq({ name: 'Cap After Retry' }));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toMatch(/Maximum 3/);
  });

  it('gives up after max retries on P2034', async () => {
    const p2034 = new Error('Write conflict');
    p2034.code = 'P2034';
    mockPrisma.$transaction.mockRejectedValue(p2034);

    const res = await POST(makeReq({ name: 'Exhaust Retries' }));
    expect(res.status).toBe(500);
  });
});

describe('setting key', () => {
  it('reads affiliate_max_links (not affiliate_max_links_chief)', async () => {
    mockTx.setting.findMany.mockResolvedValue([{ key: 'affiliate_max_links', value: '10' }]);
    mockTx.acquisitionLink.count.mockResolvedValue(0);
    mockTx.acquisitionLink.create.mockResolvedValue({
      id: 'x', name: 'X', slug: 'x', enabled: true, createdAt: new Date(),
    });

    await POST(makeReq({ name: 'Key Test' }));

    expect(mockTx.setting.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { key: { in: ['affiliate_max_links'] } } })
    );
  });
});

// ──────────────────────────────────────
// Immutable ownership after reassignment
// ──────────────────────────────────────
describe('ownership after reassignment', () => {
  it('verifyLinkOwnership uses createdByChiefId, not affiliateId', async () => {
    mockPrisma.acquisitionLink.findUnique.mockResolvedValue({
      id: 'link1', affiliateId: 'crew1', createdByChiefId: 'chief1',
    });

    const result = await verifyLinkOwnership('link1', 'chief1');
    expect(result).not.toBeNull();
    expect(result.id).toBe('link1');
  });

  it('denies ownership to a different chief even if affiliateId matches', async () => {
    mockPrisma.acquisitionLink.findUnique.mockResolvedValue({
      id: 'link1', affiliateId: 'chief2', createdByChiefId: 'chief1',
    });

    const result = await verifyLinkOwnership('link1', 'chief2');
    expect(result).toBeNull();
  });

  it('chief retains ownership after link is unassigned', async () => {
    mockPrisma.acquisitionLink.findUnique.mockResolvedValue({
      id: 'link1', affiliateId: null, createdByChiefId: 'chief1',
    });

    const result = await verifyLinkOwnership('link1', 'chief1');
    expect(result).not.toBeNull();
  });

  it('DELETE succeeds on unassigned link owned by chief', async () => {
    mockPrisma.acquisitionLink.findUnique.mockResolvedValue({
      id: 'link1', affiliateId: null, createdByChiefId: 'chief1',
    });
    mockPrisma.acquisitionLink.update.mockResolvedValue({});

    const res = await DELETE(makeDeleteReq({ id: 'link1' }));
    const body = await res.json();
    expect(body.ok).toBe(true);
  });

  it('PATCH succeeds on reassigned link owned by chief', async () => {
    mockPrisma.acquisitionLink.findUnique.mockResolvedValue({
      id: 'link1', affiliateId: 'crew1', createdByChiefId: 'chief1',
      affiliate: { name: 'Crew One' },
    });
    mockPrisma.acquisitionLink.update.mockResolvedValue({});

    const res = await PATCH(makePatchReq({ id: 'link1', enabled: false }));
    const body = await res.json();
    expect(body.ok).toBe(true);
  });
});

// ──────────────────────────────────────
// GET listing uses createdByChiefId
// ──────────────────────────────────────
describe('GET listing', () => {
  it('filters by createdByChiefId not affiliateId team set', async () => {
    mockPrisma.crewMember.findMany.mockResolvedValue([{ id: 'crew1', name: 'C1' }]);
    mockPrisma.acquisitionLink.findMany.mockResolvedValue([]);

    await GET(makeGetReq());

    const findCall = mockPrisma.acquisitionLink.findMany.mock.calls[0][0];
    expect(findCall.where.createdByChiefId).toBe('chief1');
    expect(findCall.where.affiliateId).toBeUndefined();
  });

  it('shows unassigned links to their creator', async () => {
    mockPrisma.crewMember.findMany.mockResolvedValue([]);
    mockPrisma.acquisitionLink.findMany.mockResolvedValue([
      { id: 'link1', name: 'Unassigned', slug: 'un', enabled: true, affiliateId: null, affiliate: null, createdAt: new Date(), _count: { clicks: 0, commissions: 0 } },
    ]);

    const res = await GET(makeGetReq());
    const body = await res.json();
    expect(body.links).toHaveLength(1);
    expect(body.links[0].affiliateId).toBeNull();
  });

  it('cap counts unassigned links via createdByChiefId', async () => {
    mockTx.setting.findMany.mockResolvedValue([{ key: 'affiliate_max_links', value: '2' }]);
    mockTx.acquisitionLink.count.mockResolvedValue(2);

    const res = await POST(makeReq({ name: 'Over Cap' }));
    const body = await res.json();

    expect(res.status).toBe(400);
    const countCall = mockTx.acquisitionLink.count.mock.calls[0][0];
    expect(countCall.where.createdByChiefId).toBe('chief1');
  });
});
