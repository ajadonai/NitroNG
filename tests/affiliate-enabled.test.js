import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Shared mocks ──
const mockPrisma = {
  setting: { findMany: vi.fn(), findUnique: vi.fn(), upsert: vi.fn() },
  crewMember: { findUnique: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn() },
  user: { findUnique: vi.fn(), create: vi.fn() },
  acquisitionLink: { findUnique: vi.fn(), findMany: vi.fn(), count: vi.fn(), create: vi.fn(), update: vi.fn() },
  affiliateCommission: { findFirst: vi.fn(), count: vi.fn(), create: vi.fn() },
  linkLog: { create: vi.fn().mockResolvedValue({}) },
  $transaction: vi.fn(),
};

const mockTx = {
  setting: { findMany: vi.fn() },
  acquisitionLink: { count: vi.fn(), create: vi.fn() },
};

vi.mock('@/lib/prisma', () => ({ default: mockPrisma }));
vi.mock('@/lib/logger', () => ({ log: { error: vi.fn(), info: vi.fn() } }));
vi.mock('@/lib/rate-limit', () => ({
  rateLimit: vi.fn().mockResolvedValue({ limited: false }),
  rateLimitUnavailable: (msg) => Response.json({ error: msg }, { status: 503 }),
  tooManyRequests: (msg) => Response.json({ error: msg }, { status: 429 }),
}));
vi.mock('@/lib/crew-bot', () => ({
  crewSignup: vi.fn(),
  crewFirstPurchase: vi.fn(),
  crewRepeatBuyer: vi.fn(),
}));

const mockGetCrewSession = vi.fn();
vi.mock('@/lib/crew', () => ({
  getCrewSession: (...a) => mockGetCrewSession(...a),
  hashToken: vi.fn(),
}));
vi.mock('@/lib/link-ownership', () => ({
  getTeamIds: vi.fn(),
  verifyLinkOwnership: vi.fn(),
}));
vi.mock('@/lib/validate', () => ({
  validateEmail: () => true,
  validatePassword: () => true,
  validateName: () => true,
  validatePhone: () => true,
  sanitizeEmail: (e) => e.toLowerCase(),
  isDisposableEmail: () => false,
}));

const { POST: applyPost } = await import('@/app/api/pit/auth/apply/route');
const { createCommission } = await import('@/lib/commissions');
const { POST: linksPost } = await import('@/app/api/pit/links/route');

beforeEach(() => {
  vi.clearAllMocks();
  mockPrisma.$transaction.mockImplementation(async (fn) => fn(mockTx));
});

// ──────────────────────────────────────
// Apply route
// ──────────────────────────────────────
describe('apply: affiliate_enabled', () => {
  function makeReq(body) {
    return new Request('http://localhost/api/pit/auth/apply', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  }

  it('blocks applications when disabled', async () => {
    mockPrisma.setting.findMany.mockResolvedValue([{ key: 'affiliate_enabled', value: 'false' }]);
    const res = await applyPost(makeReq({ name: 'Test User', email: 'test@test.com', password: 'password123' }));
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toMatch(/not accepting/);
  });

  it('allows applications when enabled', async () => {
    mockPrisma.setting.findMany.mockResolvedValue([{ key: 'affiliate_enabled', value: 'true' }]);
    mockPrisma.crewMember.findUnique.mockResolvedValue(null);
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'user1', name: 'Test', phone: null });
    mockPrisma.crewMember.create.mockResolvedValue({ id: 'new' });
    const res = await applyPost(makeReq({ name: 'Test User', email: 'valid@example.com', password: 'password123' }));
    const body = await res.json();
    expect(body.ok).toBe(true);
  });
});

// ──────────────────────────────────────
// Commission creation
// ──────────────────────────────────────
describe('createCommission: affiliate_enabled', () => {
  it('returns null when disabled', async () => {
    mockPrisma.setting.findMany.mockResolvedValue([{ key: 'affiliate_enabled', value: 'false' }]);
    const result = await createCommission('order1', 'user1', 50000, 30000);
    expect(result).toBeNull();
    expect(mockPrisma.user.findUnique).not.toHaveBeenCalled();
  });

  it('proceeds when enabled (returns null for no user, but hits the user lookup)', async () => {
    mockPrisma.setting.findMany.mockImplementation(({ where }) => {
      const keys = where.key.in;
      const rows = [];
      if (keys.includes('affiliate_enabled')) rows.push({ key: 'affiliate_enabled', value: 'true' });
      if (keys.includes('affiliate_hold_days')) rows.push({ key: 'affiliate_hold_days', value: '7' });
      if (keys.includes('affiliate_lead_split')) rows.push({ key: 'affiliate_lead_split', value: '40' });
      if (keys.includes('affiliate_min_order')) rows.push({ key: 'affiliate_min_order', value: '1000' });
      return Promise.resolve(rows);
    });
    mockPrisma.user.findUnique.mockResolvedValue(null);
    const result = await createCommission('order1', 'user1', 200000, 100000);
    expect(result).toBeNull();
    expect(mockPrisma.user.findUnique).toHaveBeenCalled();
  });
});

// ──────────────────────────────────────
// Link creation
// ──────────────────────────────────────
describe('link POST: affiliate_enabled', () => {
  function makeReq(body) {
    return new Request('http://localhost/api/pit/links', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  }

  beforeEach(() => {
    mockGetCrewSession.mockResolvedValue({ id: 'chief1', role: 'chief', name: 'Boss' });
  });

  it('blocks link creation when disabled', async () => {
    mockPrisma.setting.findMany.mockResolvedValue([{ key: 'affiliate_enabled', value: 'false' }]);
    const res = await linksPost(makeReq({ name: 'New Link' }));
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toMatch(/paused/);
  });

  it('allows link creation when enabled', async () => {
    mockPrisma.setting.findMany.mockResolvedValue([{ key: 'affiliate_enabled', value: 'true' }]);
    mockTx.setting.findMany.mockResolvedValue([{ key: 'affiliate_max_links', value: '10' }]);
    mockTx.acquisitionLink.count.mockResolvedValue(0);
    mockTx.acquisitionLink.create.mockResolvedValue({
      id: 'new', name: 'Test', slug: 'test', enabled: true, createdByChiefId: 'chief1', createdAt: new Date(),
    });
    const res = await linksPost(makeReq({ name: 'Test Link' }));
    const body = await res.json();
    expect(body.link).toBeDefined();
  });
});
