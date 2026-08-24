import { describe, expect, it, vi, beforeEach } from 'vitest';

const db = { resellerProfile: { findUnique: vi.fn() }, setting: { findMany: vi.fn() } };
vi.mock('@/lib/prisma', () => ({ default: db }));

const { getResellerTerms, getMarkupSettings, wholesaleOf } = await import('@/lib/reseller');

beforeEach(() => {
  db.resellerProfile.findUnique.mockReset();
  db.setting.findMany.mockReset();
  db.setting.findMany.mockResolvedValue([{ key: 'markup_reseller_discount', value: '20' }]);
});

describe('getResellerTerms', () => {
  it('returns terms for an enabled profile', async () => {
    db.resellerProfile.findUnique.mockResolvedValue({ enabled: true, catalog: 'full', discountPct: 35 });
    expect(await getResellerTerms('u1')).toEqual({ catalog: 'full', discountPct: 35 });
  });

  // Revoking disables rather than deletes, so the row still exists.
  it('treats a revoked profile as a retail customer', async () => {
    db.resellerProfile.findUnique.mockResolvedValue({ enabled: false, catalog: 'curated', discountPct: null });
    expect(await getResellerTerms('u1')).toBeNull();
  });

  it('returns null for someone with no profile', async () => {
    db.resellerProfile.findUnique.mockResolvedValue(null);
    expect(await getResellerTerms('u1')).toBeNull();
  });

  // Money code must never fail open on a discount. A lookup that throws has to
  // charge retail, not hand out wholesale and not take the order path down.
  it('falls back to retail when the lookup fails', async () => {
    db.resellerProfile.findUnique.mockRejectedValue(new Error('db down'));
    expect(await getResellerTerms('u1')).toBeNull();
  });

  it('does not query at all without a user', async () => {
    expect(await getResellerTerms(null)).toBeNull();
    expect(db.resellerProfile.findUnique).not.toHaveBeenCalled();
  });
});

describe('wholesaleOf', () => {
  const settings = { markup_reseller_discount: '20' };

  it('leaves a retail customer’s price untouched', () => {
    expect(wholesaleOf(10000, null, settings)).toBe(10000);
  });

  it('applies the global rate when the reseller has none of their own', () => {
    expect(wholesaleOf(10000, { discountPct: null }, settings)).toBe(8000);
  });

  it('prefers the reseller’s own rate', () => {
    expect(wholesaleOf(10000, { discountPct: 40 }, settings)).toBe(6000);
  });
});

describe('getMarkupSettings', () => {
  it('returns an empty object rather than throwing when settings are unreadable', async () => {
    db.setting.findMany.mockRejectedValue(new Error('db down'));
    expect(await getMarkupSettings()).toEqual({});
  });
});
