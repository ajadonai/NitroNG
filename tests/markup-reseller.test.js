import { describe, expect, it } from 'vitest';
import { resellerPrice, calculateTierPrice, DEFAULT_RESELLER_DISCOUNT } from '@/lib/markup';

const S = { markup_reseller_discount: '20' };

describe('resellerPrice', () => {
  it('takes the configured percentage off the finished price', () => {
    expect(resellerPrice(10000, S)).toBe(8000);
    expect(resellerPrice(10000, { markup_reseller_discount: '30' })).toBe(7000);
  });

  it('rounds up to a whole naira, matching retail pricing', () => {
    // 3333 kobo less 20% is 2666.4 — never a fraction of a naira.
    expect(resellerPrice(3333, S) % 100).toBe(0);
  });

  it('falls back to the default when the setting is missing', () => {
    expect(resellerPrice(10000, {})).toBe(10000 * (1 - DEFAULT_RESELLER_DISCOUNT / 100));
  });

  // A bad value here would hand the catalogue away, so it is ignored rather
  // than trusted.
  it('ignores a nonsensical discount instead of applying it', () => {
    for (const bad of ['150', '-10', 'abc', '100', '', '   ', null, undefined]) {
      expect(resellerPrice(10000, { markup_reseller_discount: bad })).toBe(8000);
    }
  });

  it('lets a per-reseller rate override the global one', () => {
    expect(resellerPrice(10000, S, 35)).toBe(6500);
    // A rewarded reseller can beat the global rate; the global one still applies
    // to everyone whose override is unset.
    expect(resellerPrice(10000, S, null)).toBe(8000);
    expect(resellerPrice(10000, S, undefined)).toBe(8000);
  });

  it('ignores a nonsensical override and falls back rather than failing open', () => {
    for (const bad of [150, -5, 100, 'abc', '']) {
      expect(resellerPrice(10000, S, bad)).toBe(8000);
    }
  });

  // 0 is a real choice — a reseller on retail pricing — so it must not be
  // mistaken for "unset" by a truthiness check.
  it('treats a zero override as no discount, not as unset', () => {
    expect(resellerPrice(10000, S, 0)).toBe(10000);
  });

  it('returns zero for a missing or invalid price', () => {
    expect(resellerPrice(0, S)).toBe(0);
    expect(resellerPrice(null, S)).toBe(0);
  });
});

describe('reseller pricing against real markup settings', () => {
  const settings = {
    markup_usd_rate: '1551',
    markup_margin_floor: '50',
    markup_floor_ceiling: '7000',
    markup_ng_bonus: '10',
    markup_tier_multipliers: '{"Budget":1,"Standard":1.3,"Premium":1.6}',
    markup_brackets: '[{"min":0,"max":20,"multiplier":10},{"min":20,"max":200,"multiplier":5},'
      + '{"min":200,"max":1000,"multiplier":3.65},{"min":1000,"max":5000,"multiplier":2.25},'
      + '{"min":5000,"max":20000,"multiplier":1.9},{"min":20000,"max":999999999,"multiplier":1.5}]',
    markup_reseller_discount: '20',
  };

  // The whole reason for discounting the finished price rather than the markup:
  // it can only ever remove 20% of the price, so cost can never be approached.
  it('never prices below cost, across the cost range', () => {
    for (const costCents of [1, 12, 173, 1950, 5449, 20000, 100000]) {
      const cost = Math.round(costCents * Number(settings.markup_usd_rate));
      const price = resellerPrice(calculateTierPrice(costCents, 'Budget', settings), settings);
      expect(price).toBeGreaterThan(cost);
    }
  });

  it('keeps the tier structure for curated services', () => {
    const budget = resellerPrice(calculateTierPrice(1950, 'Budget', settings), settings);
    const premium = resellerPrice(calculateTierPrice(1950, 'Premium', settings), settings);
    expect(premium).toBeGreaterThan(budget);
  });
});
