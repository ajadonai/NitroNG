import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Prisma mock ──
const mockTx = {
  setting: { findUnique: vi.fn() },
  acquisitionLink: { count: vi.fn(), create: vi.fn() },
};

const mockPrisma = {
  acquisitionLink: {
    findUnique: vi.fn(),
    count: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  crewMember: { findMany: vi.fn(), findUnique: vi.fn() },
  setting: { findUnique: vi.fn() },
  linkLog: { create: vi.fn().mockResolvedValue({}) },
  $transaction: vi.fn(async (fn) => fn(mockTx)),
};

vi.mock('@/lib/prisma', () => ({ default: mockPrisma }));
vi.mock('@/lib/logger', () => ({ log: { error: vi.fn() } }));

const mockGetCrewSession = vi.fn();
vi.mock('@/lib/crew', () => ({ getCrewSession: (...a) => mockGetCrewSession(...a) }));

const CHIEF = { id: 'chief1', role: 'chief', name: 'Boss' };

const { POST, DELETE } = await import('@/app/api/pit/links/route');

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

beforeEach(() => {
  vi.clearAllMocks();
  mockGetCrewSession.mockResolvedValue(CHIEF);
  mockPrisma.crewMember.findMany.mockResolvedValue([]);
  mockPrisma.$transaction.mockImplementation(async (fn) => fn(mockTx));
});

// ──────────────────────────────────────
// Link limit enforcement
// ──────────────────────────────────────
describe('POST link limit', () => {
  it('blocks creation when team is at limit', async () => {
    mockTx.setting.findUnique.mockResolvedValue({ value: '3' });
    mockTx.acquisitionLink.count.mockResolvedValue(3);

    const res = await POST(makeReq({ name: 'New Link' }));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toMatch(/Maximum 3/);
    expect(mockTx.acquisitionLink.create).not.toHaveBeenCalled();
  });

  it('counts team links not just chief links', async () => {
    mockPrisma.crewMember.findMany.mockResolvedValue([{ id: 'crew1' }, { id: 'crew2' }]);
    mockTx.setting.findUnique.mockResolvedValue({ value: '5' });
    mockTx.acquisitionLink.count.mockResolvedValue(2);
    mockTx.acquisitionLink.create.mockResolvedValue({
      id: 'new', name: 'Test', slug: 'test', enabled: true, createdByChiefId: 'chief1', createdAt: new Date(),
    });

    await POST(makeReq({ name: 'Test Link' }));

    const countCall = mockTx.acquisitionLink.count.mock.calls[0][0];
    expect(countCall.where.affiliateId.in).toEqual(
      expect.arrayContaining(['chief1', 'crew1', 'crew2'])
    );
  });

  it('defaults to 5 when setting is missing', async () => {
    mockTx.setting.findUnique.mockResolvedValue(null);
    mockTx.acquisitionLink.count.mockResolvedValue(5);

    const res = await POST(makeReq({ name: 'Over Limit' }));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toMatch(/Maximum 5/);
  });

  it('limit check and create run inside a serializable transaction', async () => {
    mockTx.setting.findUnique.mockResolvedValue({ value: '10' });
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
    mockTx.setting.findUnique.mockResolvedValue({ value: '10' });
    mockTx.acquisitionLink.count.mockResolvedValue(0);
    mockTx.acquisitionLink.create.mockResolvedValue({
      id: 'new', name: 'Test', slug: 'test', enabled: true, createdByChiefId: 'chief1', createdAt: new Date(),
    });

    await POST(makeReq({ name: 'Ownership Test' }));

    const createCall = mockTx.acquisitionLink.create.mock.calls[0][0];
    expect(createCall.data.createdByChiefId).toBe('chief1');
  });
});

// ──────────────────────────────────────
// Slug race condition
// ──────────────────────────────────────
describe('POST slug uniqueness', () => {
  it('returns 409 on duplicate slug (P2002)', async () => {
    mockTx.setting.findUnique.mockResolvedValue({ value: '10' });
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
    mockTx.setting.findUnique.mockResolvedValue({ value: '10' });
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
    mockTx.setting.findUnique.mockResolvedValue({ value: '10' });
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
    mockTx.setting.findUnique.mockResolvedValue({ value: '3' });
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
    mockTx.setting.findUnique.mockResolvedValue({ value: '10' });
    mockTx.acquisitionLink.count.mockResolvedValue(0);
    mockTx.acquisitionLink.create.mockResolvedValue({
      id: 'x', name: 'X', slug: 'x', enabled: true, createdAt: new Date(),
    });

    await POST(makeReq({ name: 'Key Test' }));

    expect(mockTx.setting.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { key: 'affiliate_max_links' } })
    );
  });
});
