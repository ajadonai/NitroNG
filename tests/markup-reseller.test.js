import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { resellerPrice, calculateTierPrice, DEFAULT_RESELLER_DISCOUNT, resellerFloorKobo, effectiveResellerPct, costKoboPer1k } from '@/lib/markup';

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

/**
 * The margin floor — Trip's rule, 17 Sep 2026: "our worst case scenario should
 * be margin of 10% at 30% tier."
 *
 * A flat discount off retail is not a flat margin, because retail is not a flat
 * markup. The live brackets run 10x at the cheap end down to 1.5x on Ultra, so
 * the same 30% that leaves 85.7% on a Micro service leaves 4.8% on an Ultra
 * one, and 33.3% there sells at exactly what we paid.
 *
 * So the tier rate became a ceiling on the discount rather than a promise about
 * it, and the promise moved to margin: price >= cost / (1 - floor).
 */
describe('the reseller margin floor', () => {
  const S = { markup_usd_rate: '1529', markup_reseller_discount: '30' };
  const per1k = (costCents, mult) => ({
    cost: costKoboPer1k(costCents, S),
    retail: Math.round(costKoboPer1k(costCents, S) * mult),
  });
  const marginOf = (price, cost) => (1 - cost / price) * 100;

  it('holds the thinnest band at exactly the floor', () => {
    // Ultra at Budget tier: 1.5x total markup, the worst case in production.
    const { cost, retail } = per1k(20000, 1.5);
    const price = resellerPrice(retail, S, 30, cost);
    expect(marginOf(price, cost)).toBeGreaterThanOrEqual(10);
    expect(marginOf(price, cost)).toBeCloseTo(10, 1);
  });

  it('leaves a 30% rate alone where 30% is affordable', () => {
    // Micro is 10x, so 30% leaves 85.7% and the floor never comes near it.
    const { cost, retail } = per1k(10, 10);
    expect(resellerPrice(retail, S, 30, cost)).toBe(resellerPrice(retail, S, 30, null));
  });

  it('reports the rate a service can actually carry', () => {
    // So a badge can say "30%, 25.9% on the thinnest" rather than printing a
    // number that does not match what gets charged.
    const thin = per1k(20000, 1.5);
    expect(effectiveResellerPct(thin.retail, thin.cost, S, 30)).toBeCloseTo(25.9, 1);
    const cheap = per1k(10, 10);
    expect(effectiveResellerPct(cheap.retail, cheap.cost, S, 30)).toBe(30);
  });

  it('never sells below cost however high the rate goes', () => {
    // The rate box has always accepted anything under 100%, so 40% could be
    // typed in and saved. With the floor in the price path it simply stops
    // biting at the point it would start costing money.
    const { cost, retail } = per1k(20000, 1.5);
    for (const pct of [35, 50, 80, 99]) {
      expect(marginOf(resellerPrice(retail, S, pct, cost), cost), `${pct}%`).toBeGreaterThanOrEqual(10);
    }
  });

  it('measures cost on the same basis as the price beside it', () => {
    // A per-1k floor compared against a 250-unit charge would clamp every small
    // order up to the price of a thousand.
    const { cost, retail } = per1k(20000, 1.5);
    const qty = 250;
    const orderCost = Math.round(cost * qty / 1000);
    const orderRetail = Math.round(retail * qty / 1000);
    const price = resellerPrice(orderRetail, S, 30, orderCost);
    expect(marginOf(price, orderCost)).toBeCloseTo(10, 1);
    expect(price).toBeLessThan(retail);
  });

  it('never charges a reseller more than retail', () => {
    // A service already priced under its own floor is a retail pricing problem,
    // and charging wholesale above walk-in would be a strange way to fix it.
    const cost = costKoboPer1k(20000, S);
    const retail = Math.round(cost * 1.02);
    expect(resellerPrice(retail, S, 30, cost)).toBeLessThanOrEqual(retail);
  });

  it('keeps the old behaviour when there is no cost to measure', () => {
    const { retail } = per1k(20000, 1.5);
    expect(resellerPrice(retail, S, 30, null)).toBe(resellerPrice(retail, S, 30));
    expect(resellerFloorKobo(0, S)).toBeNull();
    expect(resellerFloorKobo(null, S)).toBeNull();
  });

  it('is configurable, and refuses a floor that has no finite price', () => {
    const { cost, retail } = per1k(20000, 1.5);
    const at20 = resellerPrice(retail, { ...S, markup_reseller_margin_floor: '20' }, 30, cost);
    expect(marginOf(at20, cost)).toBeCloseTo(20, 1);
    // 100% margin has no price that satisfies it; fall back rather than diverge.
    const silly = resellerPrice(retail, { ...S, markup_reseller_margin_floor: '100' }, 30, cost);
    expect(marginOf(silly, cost)).toBeCloseTo(10, 1);
  });
});

/**
 * Every call site has to pass a cost, or it is a call site that can sell below
 * the floor. This is the ratchet that says so.
 */
describe('every wholesale price is measured against a cost', () => {
  // A real argument count: walk the call with a paren depth so nested calls
  // like Math.round(t.price * 100) and costKoboPer1k(x, s) do not truncate the
  // match or have their commas counted as separators.
  const argsOf = (src, at) => {
    let depth = 0, args = 1, i = at;
    for (; i < src.length; i++) {
      const c = src[i];
      if (c === '(') depth++;
      else if (c === ')') { depth--; if (depth === 0) break; }
      else if (c === ',' && depth === 1) args++;
    }
    return args;
  };

  it('passes a cost at every call site', () => {
    const files = [
      'app/api/v2/route.js', 'app/api/reseller/catalogue/route.js',
      'app/api/services/route.js', 'app/api/services/menu/route.js',
      'app/api/catalogue/full/route.js', 'app/api/orders/route.js',
      'app/api/orders/bulk/route.js',
    ];
    const bare = [];
    for (const f of files) {
      const src = fs.readFileSync(path.join(process.cwd(), f), 'utf8');
      for (const m of src.matchAll(/wholesaleOf\(/g)) {
        const open = m.index + 'wholesaleOf'.length;
        if (argsOf(src, open) < 4) bare.push(`${f}: ${src.slice(m.index, m.index + 70)}`);
      }
    }
    expect(bare, `wholesaleOf without a cost can sell below the floor:\n${bare.join('\n')}`).toEqual([]);
  });

  it('counts arguments rather than commas', () => {
    // The first version of the check used a regex and reported four false
    // positives, because a nested call's commas and parens broke it.
    expect(argsOf('wholesaleOf(a, b, c)', 11)).toBe(3);
    expect(argsOf('wholesaleOf(Math.round(x * 100), t, s, f(y, z))', 11)).toBe(4);
  });

  it('keeps provider cost out of the shared catalogue cache', () => {
    // The catalogue is one object served to every customer. Costs for the
    // reseller branch are fetched separately, on purpose.
    const cat = fs.readFileSync(path.join(process.cwd(), 'lib/service-catalog.js'), 'utf8');
    expect(cat, 'cost must not ride along in the cached catalogue').not.toMatch(/costPer1k/);
    const menu = fs.readFileSync(path.join(process.cwd(), 'app/api/services/menu/route.js'), 'utf8');
    expect(menu).toMatch(/select: \{ id: true, costPer1k: true \}/);
  });
});
