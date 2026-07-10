import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockPrisma = {
  setting: { findMany: vi.fn(), upsert: vi.fn().mockResolvedValue({}) },
  crewMember: { updateMany: vi.fn().mockResolvedValue({ count: 0 }) },
  $transaction: vi.fn(async (ops) => ops),
};

vi.mock('@/lib/prisma', () => ({ default: mockPrisma }));
vi.mock('@/lib/logger', () => ({ log: { error: vi.fn() } }));

const mockRequireAdmin = vi.fn();
const mockLogActivity = vi.fn().mockResolvedValue(undefined);
vi.mock('@/lib/admin', () => ({
  requireAdmin: (...a) => mockRequireAdmin(...a),
  logActivity: (...a) => mockLogActivity(...a),
  canPerformAction: () => true,
  canSeeSensitive: () => true,
}));

const { POST } = await import('@/app/api/admin/settings/route');

function makeReq(body) {
  return new Request('http://localhost/api/admin/settings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireAdmin.mockResolvedValue({ admin: { name: 'Admin', email: 'admin@test.com' }, error: null });
});

describe('affiliate setting validation', () => {
  it('accepts valid affiliate settings', async () => {
    const res = await POST(makeReq({
      settings: {
        affiliate_starter_rate: '30',
        affiliate_growth_rate: '40',
        affiliate_pro_rate: '50',
        affiliate_lead_split: '40',
        affiliate_growth_threshold: '30',
        affiliate_pro_threshold: '100',
        affiliate_hold_days: '7',
        affiliate_min_payout: '5000',
        affiliate_min_order: '1000',
        affiliate_max_links: '5',
      },
    }));
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  it('rejects non-numeric value', async () => {
    const res = await POST(makeReq({
      settings: { affiliate_starter_rate: 'banana' },
    }));
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.error).toMatch(/affiliate_starter_rate.*must be a number/);
  });

  it('rejects rate above 100', async () => {
    const res = await POST(makeReq({
      settings: { affiliate_pro_rate: '150' },
    }));
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.error).toMatch(/affiliate_pro_rate.*between 0 and 100/);
  });

  it('rejects negative rate', async () => {
    const res = await POST(makeReq({
      settings: { affiliate_lead_split: '-5' },
    }));
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.error).toMatch(/affiliate_lead_split.*between 0 and 100/);
  });

  it('rejects max_links below 1', async () => {
    const res = await POST(makeReq({
      settings: { affiliate_max_links: '0' },
    }));
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.error).toMatch(/affiliate_max_links.*between 1 and 100/);
  });

  it('rejects hold_days above 365', async () => {
    const res = await POST(makeReq({
      settings: { affiliate_hold_days: '999' },
    }));
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.error).toMatch(/affiliate_hold_days.*between 0 and 365/);
  });

  it('rejects growth_threshold >= pro_threshold', async () => {
    const res = await POST(makeReq({
      settings: {
        affiliate_growth_threshold: '100',
        affiliate_pro_threshold: '50',
      },
    }));
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.error).toMatch(/growth_threshold must be less than.*pro_threshold/);
  });

  it('reports multiple errors at once', async () => {
    const res = await POST(makeReq({
      settings: {
        affiliate_starter_rate: 'abc',
        affiliate_hold_days: '-1',
      },
    }));
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.error).toMatch(/affiliate_starter_rate/);
    expect(body.error).toMatch(/affiliate_hold_days/);
  });

  it('accepts boundary values (0 and max)', async () => {
    const res = await POST(makeReq({
      settings: {
        affiliate_starter_rate: '0',
        affiliate_pro_rate: '100',
        affiliate_hold_days: '0',
        affiliate_min_payout: '0',
        affiliate_max_links: '1',
      },
    }));
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  it('does not validate non-affiliate string settings', async () => {
    const res = await POST(makeReq({
      settings: {
        social_instagram: 'https://instagram.com/test',
        maintenance: 'false',
      },
    }));
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  it('allows affiliate_enabled and crew_telegram_group_link without numeric validation', async () => {
    const res = await POST(makeReq({
      settings: {
        affiliate_enabled: 'false',
        crew_telegram_group_link: 'https://t.me/somecrew',
      },
    }));
    const body = await res.json();
    expect(body.success).toBe(true);
  });
});
