import { describe, expect, it } from 'vitest';
import {
  DEFAULT_TIERS, tiersFrom, bandCapsFrom, tierForSpend, pctForBand,
  resolveRate, evaluate, hasSeat,
} from '@/lib/reseller-tiers';

/**
 * The ladder's rules, pinned where they can be read.
 *
 * Trip set every number here on 17 Sep. The ones that are judgement rather than
 * arithmetic — Starter at ₦100k, one month and not two, the seat holding the
 * bottom rung only — are the ones most likely to be "simplified" by somebody
 * later, so each has a test saying what it costs to get wrong.
 */
const S = {};                                   // defaults
const M = (over) => ({ ...S, ...over });
const T = (id) => DEFAULT_TIERS.find(t => t.id === id);
const spend = (rolling, lifetime = rolling) => ({ rolling, lifetime });

describe('the rungs', () => {
  it('starts at ₦100,000, which is the price of admission', () => {
    // Below it a reseller is not a small reseller, they are a retail customer
    // with a badge — and a Wholesale reseller has to be worth 1.87 retail
    // customers before the discount pays for itself at all.
    expect(T('T1').threshold).toBe(10000000);
    expect(tierForSpend(DEFAULT_TIERS, 9999999)).toBeNull();
    expect(tierForSpend(DEFAULT_TIERS, 10000000).id).toBe('T1');
  });

  it('climbs on rolling spend, and never skips a reseller past what they earned', () => {
    for (const [kobo, id] of [[10000000, 'T1'], [25000000, 'T2'], [50000000, 'T3'], [100000000, 'T4'], [200000000, 'T5'], [999900000000, 'T5']]) {
      expect(tierForSpend(DEFAULT_TIERS, kobo)?.id, String(kobo)).toBe(id);
    }
  });

  it('falls back to the drawn ladder rather than to no ladder', () => {
    // An empty ladder would put every reseller on retail — a pricing change
    // arriving through a JSON parse error.
    expect(tiersFrom({ reseller_tiers: 'not json' })).toEqual(DEFAULT_TIERS);
    expect(tiersFrom({ reseller_tiers: '[]' })).toEqual(DEFAULT_TIERS);
    expect(tiersFrom({}).length).toBe(5);
  });

  it('sorts a ladder given out of order', () => {
    const t = tiersFrom({ reseller_tiers: JSON.stringify([{ id: 'B', threshold: 200, pct: 20 }, { id: 'A', threshold: 100, pct: 10 }]) });
    expect(t.map(x => x.id)).toEqual(['A', 'B']);
  });
});

describe('the band caps', () => {
  it('binds every tier, not only the top', () => {
    // Cap only the top and the ladder inverts: Scale on 25% pays LESS than
    // Wholesale held at 22%, so climbing a rung puts a reseller's prices up.
    expect(pctForBand(25, 'Ultra', { Ultra: 22 })).toBe(22);
    expect(pctForBand(30, 'Ultra', { Ultra: 22 })).toBe(22);
    expect(pctForBand(10, 'Ultra', { Ultra: 22 })).toBe(10);
  });

  it('leaves an uncapped band alone', () => {
    expect(pctForBand(30, 'Micro', { Ultra: 22 })).toBe(30);
    expect(pctForBand(30, null, { Ultra: 22 })).toBe(30);
  });

  it('treats a blank cap as no cap, never as zero', () => {
    // Zero would put every tier on retail for that band, silently.
    expect(bandCapsFrom({ reseller_band_caps: '{"Ultra":""}' }).Ultra).toBeUndefined();
    expect(bandCapsFrom({ reseller_band_caps: '{"Ultra":null}' }).Ultra).toBeUndefined();
    expect(bandCapsFrom({ reseller_band_caps: '{"Ultra":0}' }).Ultra).toBe(0);
  });
});

describe('the rate a profile pays', () => {
  it('follows the ladder on auto', () => {
    expect(resolveRate({ tierMode: 'auto', tier: 'T5' }, S)).toMatchObject({ pct: 30, tierName: 'Wholesale' });
  });

  it('charges retail, not the global rate, for somebody below the ladder', () => {
    // Dropping out has to cost something, or it costs nothing.
    expect(resolveRate({ tierMode: 'auto', tier: null }, S).pct).toBe(0);
  });

  it('honours a pin over the ladder', () => {
    expect(resolveRate({ tierMode: 'pinned', pinnedTier: 'T3', tier: 'T1' }, S)).toMatchObject({ pct: 20, mode: 'pinned' });
  });

  it('falls back to the ladder when a pin names a tier that no longer exists', () => {
    // Trip deletes a rung; nobody should silently keep its rate.
    expect(resolveRate({ tierMode: 'pinned', pinnedTier: 'T9', tier: 'T1' }, S)).toMatchObject({ mode: 'auto', pct: 10 });
  });

  it('honours a custom rate, and ignores a half-finished one', () => {
    expect(resolveRate({ tierMode: 'custom', discountPct: 18, tier: 'T1' }, S).pct).toBe(18);
    expect(resolveRate({ tierMode: 'custom', discountPct: null, tier: 'T1' }, S)).toMatchObject({ mode: 'auto', pct: 10 });
  });
});

describe('the nightly evaluation', () => {
  const now = new Date('2026-11-15T09:00:00Z');
  const past = { firstMonthEndsAt: new Date('2026-11-01T00:00:00Z') };

  it('promotes the moment a threshold is crossed', () => {
    const r = evaluate({ tierMode: 'auto', tier: 'T1', ...past }, spend(25000000), S, now);
    expect(r).toMatchObject({ tier: 'T2', changed: true, reason: 'promoted' });
  });

  it('does not demote on any night but month end', () => {
    const p = { tierMode: 'auto', tier: 'T3', ...past };
    expect(evaluate(p, spend(1000000), S, now)).toMatchObject({ changed: false });
    expect(evaluate(p, spend(1000000), S, now, { monthEnd: true })).toMatchObject({ tier: null, changed: true, reason: 'dropped' });
  });

  it('leaves a reseller alone inside their first full month', () => {
    // Granted on the 17th, judged at the end of the following month. Three days
    // of trading is not a verdict.
    const p = { tierMode: 'auto', tier: 'T1', firstMonthEndsAt: new Date('2026-12-01T00:00:00Z') };
    expect(evaluate(p, spend(0), S, now, { monthEnd: true })).toMatchObject({ changed: false });
  });

  it('demotes a rung at a time rather than to the floor', () => {
    const p = { tierMode: 'auto', tier: 'T5', ...past };
    expect(evaluate(p, spend(50000000), S, now, { monthEnd: true })).toMatchObject({ tier: 'T3', reason: 'demoted' });
  });

  it('puts somebody below the first rung on normal pricing', () => {
    const p = { tierMode: 'auto', tier: 'T1', ...past };
    expect(evaluate(p, spend(5000000), S, now, { monthEnd: true })).toMatchObject({ tier: null, reason: 'dropped' });
  });

  it('brings them back the night they clear it again', () => {
    const p = { tierMode: 'auto', tier: null, ...past };
    expect(evaluate(p, spend(10000000), S, now)).toMatchObject({ tier: 'T1', reason: 'restored' });
  });

  it('never drops a seat holder below the bottom rung', () => {
    // Earned once on lifetime spend, kept for good.
    const p = { tierMode: 'auto', tier: 'T1', seatForLife: true, ...past };
    expect(evaluate(p, spend(0, 0), S, now, { monthEnd: true })).toMatchObject({ changed: false, tier: 'T1' });
  });

  it('holds the seat at the bottom rung and not at the tier they had', () => {
    // A dormant reseller on 10% of very little is cheap. On Wholesale's 30% it
    // would not be.
    const p = { tierMode: 'auto', tier: 'T5', seatForLife: true, ...past };
    expect(evaluate(p, spend(0, 0), S, now, { monthEnd: true })).toMatchObject({ tier: 'T1', reason: 'demoted' });
  });

  it('latches the seat the moment lifetime spend passes it', () => {
    expect(hasSeat(100000000, S)).toBe(true);
    expect(hasSeat(99999999, S)).toBe(false);
    expect(evaluate({ tierMode: 'auto', tier: 'T1', ...past }, spend(0, 100000000), S, now).earnsSeat).toBe(true);
  });

  it('leaves a pinned or custom profile where the admin put it', () => {
    for (const mode of ['pinned', 'custom']) {
      expect(evaluate({ tierMode: mode, tier: 'T4', ...past }, spend(0), S, now, { monthEnd: true }), mode).toMatchObject({ changed: false });
    }
  });

  it('still notices a pinned reseller earning their seat', () => {
    const r = evaluate({ tierMode: 'pinned', tier: 'T3', ...past }, spend(0, 200000000), S, now);
    expect(r.earnsSeat).toBe(true);
  });
});
