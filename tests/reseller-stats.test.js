import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The Reseller HQ facts row: the rate a reseller is told they pay, and what it
 * saved them.
 *
 * Once the ladder is on, a rung's rate is a ceiling — the band caps hold the
 * dearest services back — so the row must say "up to", and the saving must be
 * the one the orders recorded rather than spend multiplied out at the rung.
 */
const mockPrisma = vi.hoisted(() => ({
  order: { aggregate: vi.fn(), count: vi.fn() },
  user: { findUnique: vi.fn() },
}));
const terms = vi.hoisted(() => ({ value: null, settings: {} }));

vi.mock('@/lib/prisma', () => ({ default: mockPrisma }));
vi.mock('@/lib/auth', () => ({ getCurrentUser: vi.fn().mockResolvedValue({ id: 'u1' }) }));
vi.mock('@/lib/reseller', () => ({
  getResellerTerms: vi.fn(async () => terms.value),
  getMarkupSettings: vi.fn(async () => terms.settings),
}));

const { GET } = await import('@/app/api/reseller/stats/route');

beforeEach(() => {
  // All orders: ₦70,000 charged. The discounted ones: ₦70,000 charged against
  // ₦95,000 at retail, so ₦25,000 saved. At a flat 30% the same spend would
  // claim ₦30,000, which is the overstatement a band cap creates.
  mockPrisma.order.aggregate.mockImplementation(async ({ where }) => (
    where.retailCharge
      ? { _sum: { charge: 7000000, retailCharge: 9500000 } }
      : { _count: 12, _sum: { charge: 7000000 } }
  ));
  mockPrisma.order.count.mockResolvedValue(9);
  mockPrisma.user.findUnique.mockResolvedValue({ balance: 500000 });
});

describe('GET /api/reseller/stats', () => {
  it('says "up to" the rung while the ladder is live', async () => {
    terms.value = { enabled: true, tierMode: 'auto', tier: 'T5', discountPct: null };
    terms.settings = { reseller_tiers_live: 'true', markup_reseller_discount: '20' };
    const body = await (await GET()).json();
    expect(body).toMatchObject({ wholesale: true, upTo: true, tierName: 'Wholesale', discount: 30 });
    expect(body.saved).toBe(25000);
  });

  it('keeps the profile rate and no "up to" while the ladder is off', async () => {
    terms.value = { enabled: true, tierMode: 'auto', tier: 'T5', discountPct: 15 };
    terms.settings = { markup_reseller_discount: '20' };
    const body = await (await GET()).json();
    expect(body).toMatchObject({ wholesale: true, upTo: false, tierName: null, discount: 15 });
  });

  it('falls back to the global rate for a profile with none of its own', async () => {
    terms.value = { enabled: true, discountPct: null };
    terms.settings = { markup_reseller_discount: '20' };
    expect((await (await GET()).json()).discount).toBe(20);
  });

  it('shows a reseller below the first rung as paying nothing off', async () => {
    terms.value = { enabled: true, tierMode: 'auto', tier: null, discountPct: null };
    terms.settings = { reseller_tiers_live: 'true' };
    const body = await (await GET()).json();
    expect(body).toMatchObject({ upTo: true, discount: 0, tierName: null });
  });

  it('claims no saving for a retail account', async () => {
    terms.value = null;
    terms.settings = { reseller_tiers_live: 'true' };
    const body = await (await GET()).json();
    expect(body).toMatchObject({ wholesale: false, upTo: false, discount: 0, saved: 0 });
  });
});
