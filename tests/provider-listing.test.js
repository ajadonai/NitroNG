import { describe, expect, it, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({ groupBy: vi.fn() }));
vi.mock('@/lib/prisma', () => ({
  default: { service: { groupBy: (...a) => mocks.groupBy(...a) } },
}));

const { staleCutoffs, listedRecentlyWhere, isListedRecently, PROVIDER_LISTING_GRACE_MS } =
  await import('@/lib/provider-listing');

const HOUR = 60 * 60 * 1000;

beforeEach(() => {
  vi.clearAllMocks();
  // The module memoises for a minute; each test needs its own clock so the
  // cache from a previous one cannot answer for it.
  vi.setSystemTime(new Date(2026, 8, 26, 12, 0, 0));
});

describe('isListedRecently', () => {
  // Built in beforeEach, not at describe level: a describe body runs at
  // collection time, before the beforeEach above fakes the clock, so a cutoff
  // computed there sits on the real date while every `new Date()` in a test
  // body sits on the faked one. That gap is zero on the day this was written
  // and grows daily — it failed on 3 Oct, a week after. Same clock both sides.
  let cutoffs;
  beforeEach(() => {
    cutoffs = { mtp: new Date(Date.now() - 48 * HOUR), dao: new Date(Date.now() - 48 * HOUR) };
  });

  it('keeps a service the provider confirmed today', () => {
    expect(isListedRecently({ provider: 'mtp', providerListedAt: new Date() }, cutoffs)).toBe(true);
  });

  it('drops a service last confirmed before the cutoff', () => {
    const old = new Date(Date.now() - 72 * HOUR);
    expect(isListedRecently({ provider: 'mtp', providerListedAt: old }, cutoffs)).toBe(false);
  });

  it('drops a service that was never stamped at all', () => {
    expect(isListedRecently({ provider: 'mtp', providerListedAt: null }, cutoffs)).toBe(false);
  });

  it('keeps everything for a provider with no cutoff, however old the stamp', () => {
    // No cutoff means no successful sync to measure against. Hiding the
    // catalogue because our own sync is broken is the failure this prevents.
    const ancient = new Date(Date.now() - 400 * HOUR);
    expect(isListedRecently({ provider: 'dao', providerListedAt: ancient }, { dao: null })).toBe(true);
    expect(isListedRecently({ provider: 'dao', providerListedAt: ancient }, {})).toBe(true);
  });
});

describe('staleCutoffs', () => {
  it('sets each cutoff one grace period before that provider own newest stamp', async () => {
    const mtpNewest = new Date(Date.now() - 2 * HOUR);
    const daoNewest = new Date(Date.now() - 5 * HOUR);
    mocks.groupBy.mockResolvedValue([
      { provider: 'mtp', _max: { providerListedAt: mtpNewest } },
      { provider: 'dao', _max: { providerListedAt: daoNewest } },
    ]);

    const c = await staleCutoffs();
    expect(c.mtp.getTime()).toBe(mtpNewest.getTime() - PROVIDER_LISTING_GRACE_MS);
    expect(c.dao.getTime()).toBe(daoNewest.getTime() - PROVIDER_LISTING_GRACE_MS);
  });

  it('a stalled sync cannot make its own provider stale', async () => {
    // The whole point of measuring against the provider rather than the clock:
    // syncing broke a week ago, so the newest stamp is a week old, and the rows
    // stamped by that last successful run are still the freshest thing there is.
    const weekAgo = new Date(Date.now() - 168 * HOUR);
    mocks.groupBy.mockResolvedValue([{ provider: 'mtp', _max: { providerListedAt: weekAgo } }]);

    const c = await staleCutoffs();
    expect(isListedRecently({ provider: 'mtp', providerListedAt: weekAgo }, c)).toBe(true);
  });

  it('returns no cutoffs when the lookup fails, so nothing gets hidden', async () => {
    mocks.groupBy.mockRejectedValue(new Error('db down'));
    await expect(staleCutoffs()).resolves.toEqual({});
  });
});

describe('listedRecentlyWhere', () => {
  it('bounds each provider by its own cutoff', async () => {
    const newest = new Date(Date.now() - HOUR);
    mocks.groupBy.mockResolvedValue([
      { provider: 'mtp', _max: { providerListedAt: newest } },
      { provider: 'dao', _max: { providerListedAt: newest } },
    ]);

    const where = await listedRecentlyWhere();
    expect(where.OR).toHaveLength(2);
    for (const clause of where.OR) {
      expect(['mtp', 'dao']).toContain(clause.provider);
      expect(clause.providerListedAt.gte).toBeInstanceOf(Date);
    }
  });

  it('passes a provider through unfiltered when it has no cutoff', async () => {
    mocks.groupBy.mockResolvedValue([
      { provider: 'mtp', _max: { providerListedAt: new Date() } },
    ]);

    const where = await listedRecentlyWhere();
    const dao = where.OR.find(c => c.provider === 'dao');
    // dao never reported a stamp, so it carries no date bound at all — present
    // in the results, not filtered out of them.
    expect(dao).toEqual({ provider: 'dao' });
  });
});
