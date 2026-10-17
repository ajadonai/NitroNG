import { describe, it, expect, vi } from 'vitest';

vi.mock('@/lib/prisma', () => ({ default: {} }));

const { verdicts } = await import('@/lib/service-lookup');

/**
 * The admin lookup says why a customer cannot see or order a service (17 Oct
 * 2026). Its reasons must be the full list's and the API's own rules, so the
 * answer an admin reads is the reason the customer is not seeing it.
 */
const base = {
  provider: 'mtp', providerListedAt: new Date('2026-10-17T01:00:00Z'), costPer1k: 241, sellPer1k: 1110200,
  blacklisted: false, min: 10, max: 1000000, platform: 'facebook', name: 'Facebook Custom Comments', category: 'Facebook',
  _count: { tiers: 0 },
};
const map = { apiId: 10358, retiredAt: null };
const cutoffs = { mtp: new Date('2026-10-16T00:00:00Z') };

describe('the service lookup verdicts', () => {
  it('finds nothing wrong with a row a customer can see and order', () => {
    expect(verdicts(base, map, cutoffs, 1529)).toEqual({ fullList: [], api: [] });
  });

  it('names a section heading for what it is: sold per item', () => {
    const v = verdicts({ ...base, min: 1, max: 1, costPer1k: 105555545, sellPer1k: 330455092000 }, map, cutoffs, 1529);
    expect(v.api).toEqual(['Sold per item, so a per-1,000 price would mislead']);
  });

  it('says a tiered service sells as the tier, and does not warn about its unused price', () => {
    const v = verdicts({ ...base, sellPer1k: 1, _count: { tiers: 1 } }, map, cutoffs, 1529);
    expect(v.api).toEqual(['Attached to a curated tier, so it sells there instead']);
  });

  it('dates a listing the provider has stopped confirming', () => {
    const v = verdicts({ ...base, providerListedAt: new Date('2026-10-01T00:00:00Z') }, map, cutoffs, 1529);
    expect(v.api).toEqual(['Not confirmed by the provider since 2026-10-01']);
  });

  it('puts a retired ID and a blacklist first-hand in the reasons', () => {
    const v = verdicts({ ...base, blacklisted: true }, { ...map, retiredAt: new Date() }, cutoffs, 1529);
    expect(v.api).toContain('Retired: the ID now answers "Service discontinued"');
    expect(v.api).toContain('Blacklisted');
  });

  it('flags a stale price the prices job has not reached', () => {
    const v = verdicts({ ...base, sellPer1k: 3000 }, map, cutoffs, 1529);
    expect(v.api).toEqual(['Price at or below cost until the prices job reaches it']);
  });
});
