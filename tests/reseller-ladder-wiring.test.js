import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resellerPrice, costKoboPer1k, bandLabelFor } from '@/lib/markup';

/**
 * The ladder, where it meets the rest of the app.
 *
 * lib/reseller-tiers is pure and tested on its own. These are the joins — the
 * price path, the cron, the admin action — and each one here is a place where a
 * wrong wire would be invisible until somebody was charged the wrong money.
 */
const reseller = readFileSync(new URL('../lib/reseller.js', import.meta.url), 'utf8');
const cron = readFileSync(new URL('../app/api/cron/reseller-tiers/route.js', import.meta.url), 'utf8');
const adminApi = readFileSync(new URL('../app/api/admin/resellers/route.js', import.meta.url), 'utf8');
const orders = readFileSync(new URL('../app/api/orders/route.js', import.meta.url), 'utf8');
const bulk = readFileSync(new URL('../app/api/orders/bulk/route.js', import.meta.url), 'utf8');
const vercel = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'));
const allowlist = readFileSync(new URL('../app/api/admin/settings/route.js', import.meta.url), 'utf8');

const S = {
  markup_usd_rate: '1529',
  markup_brackets: JSON.stringify([
    { min: 0, max: 20, multiplier: 10, label: 'Micro' },
    { min: 20, max: 200, multiplier: 5, label: 'Low' },
    { min: 200, max: 1000, multiplier: 3.65, label: 'Mid' },
    { min: 1000, max: 5000, multiplier: 2.25, label: 'High' },
    { min: 5000, max: 20000, multiplier: 1.9, label: 'Premium' },
    { min: 20000, max: 999999999, multiplier: 1.5, label: 'Ultra' },
  ]),
};

describe('the band cap in the price path', () => {
  it('finds a service band from the same brackets that priced it', () => {
    // A second copy of this lookup would drift the first time a bracket edge moves.
    expect(bandLabelFor(costKoboPer1k(20000, S), S)).toBe('Ultra');
    // 100 US cents is ₦1,529 per 1k, which is High — not Mid. Worth writing
    // the conversion down: the services table stores cents and the brackets
    // are naira, and that is exactly where a band lookup goes wrong.
    expect(bandLabelFor(costKoboPer1k(100, S), S)).toBe('High');
    expect(bandLabelFor(costKoboPer1k(20, S), S)).toBe('Mid');
    expect(bandLabelFor(0, S)).toBeNull();
  });

  it('charges the cap, not the tier rate, where the cap is lower', () => {
    const cost = costKoboPer1k(20000, S), retail = Math.round(cost * 1.5);
    const capped = resellerPrice(retail, S, 30, cost, 22);
    const uncapped = resellerPrice(retail, S, 30, cost, null);
    expect(capped).toBeGreaterThan(uncapped);
    expect((1 - cost / capped) * 100).toBeCloseTo(14.5, 1);
  });

  it('keeps the floor underneath a cap set too high', () => {
    // The cap is the intent; the floor is the backstop for a cap set wrong or a
    // bracket edited after the fact. Both apply.
    const cost = costKoboPer1k(20000, S), retail = Math.round(cost * 1.5);
    const price = resellerPrice(retail, S, 30, cost, 90);
    expect((1 - cost / price) * 100).toBeGreaterThanOrEqual(10);
  });

  it('ignores a cap on a band that has none', () => {
    const cost = costKoboPer1k(20, S), retail = Math.round(cost * 3.65);
    expect(resellerPrice(retail, S, 30, cost, null)).toBe(resellerPrice(retail, S, 30, cost));
  });
});

describe('what the price path was given to work with', () => {
  it('reads both settings prefixes, or the ladder can never be live', () => {
    // getMarkupSettings fetching only markup_* meant ladderLive() saw undefined
    // and quietly answered no — a bug that looks exactly like "the setting did
    // not save".
    expect(reseller).toMatch(/startsWith: 'markup_'/);
    expect(reseller).toMatch(/startsWith: 'reseller_'/);
  });

  it('leaves pricing untouched until the ladder is switched on', () => {
    expect(reseller).toMatch(/if \(!ladderLive\(settings\)\) \{/);
    expect(reseller).toMatch(/return resellerPrice\(retailKobo, settings, terms\.discountPct, costKobo\);/);
  });

  it('carries the tier and the mode on terms, not just a number', () => {
    // A price path that cannot see the pin eventually disagrees with the page
    // showing the pin.
    for (const f of ['tierMode: true', 'tier: true', 'pinnedTier: true']) expect(reseller, f).toContain(f);
  });
});

describe('the retail figure the ladder measures', () => {
  it('is captured on both single-order paths before wholesale moves it', () => {
    expect(orders).toMatch(/const retailBefore = charge;/);
    expect((orders.match(/retailBefore/g) || []).length).toBeGreaterThanOrEqual(4);
    expect(orders).toMatch(/retailCharge: reorderRetailCharge/);
    expect(orders).toMatch(/\.\.\.\(retailCharge \? \{ retailCharge \} : \{\}\),/);
  });

  it('is captured on the bulk path too', () => {
    expect(bulk).toMatch(/retailCharge: finalCharge < r\.charge \? r\.charge : null/);
  });

  it('is only recorded when wholesale actually moved the price', () => {
    // On a retail order `charge` already is retail, and a column repeating it
    // would be a second place for the two to disagree.
    expect(orders).toMatch(/if \(charge < retailBefore\)/);
  });
});

describe('the nightly evaluation', () => {
  it('is registered as a cron', () => {
    expect(vercel.crons.some(c => c.path === '/api/cron/reseller-tiers')).toBe(true);
  });

  it('refuses an unauthenticated call', () => {
    expect(cron).toMatch(/if \(!secret \|\| \(token !== secret && auth !== `Bearer \$\{secret\}`\)\)/);
  });

  it('does nothing at all while the ladder is off', () => {
    expect(cron).toMatch(/if \(!ladderLive\(settings\)\) return Response\.json\(\{ ok: true, live: false \}\);/);
  });

  it('only demotes on a month end', () => {
    expect(cron).toMatch(/const monthEnd = isMonthEnd\(now\);/);
    expect(cron).toMatch(/evaluate\(withClock, s, settings, now, \{ monthEnd \}\)/);
  });

  it('writes an event for every move, with the spend that caused it', () => {
    // The rolling window has moved by the time anybody reads the row.
    expect(cron).toMatch(/resellerTierEvent\.create/);
    expect(cron).toMatch(/spendKobo: Math\.round\(s\.rolling\)/);
  });

  it('gives a pre-ladder profile a first-month clock from its approval', () => {
    expect(cron).toMatch(/if \(!p\.firstMonthEndsAt\) data\.firstMonthEndsAt = firstMonthEnd\(p\.approvedAt \|\| now\);/);
  });
});

describe('the admin control', () => {
  it('offers exactly the three modes', () => {
    expect(adminApi).toMatch(/\['auto', 'pinned', 'custom'\]\.includes\(mode\)/);
  });

  it('refuses a pin to a tier that does not exist', () => {
    expect(adminApi).toMatch(/if \(!t\) return Response\.json\(\{ error: 'Unknown tier' \}/);
  });

  it('leaves the ladder resuming from the pinned rung, not from nothing', () => {
    // Otherwise unpinning drops a reseller off the bottom until the next night.
    expect(adminApi).toMatch(/data\.tier = t\.id;/);
  });

  it('records who did it', () => {
    expect(adminApi).toMatch(/actor: admin\.name/);
  });

  it('exposes the resolved rate, so the drawer cannot print one the checkout disagrees with', () => {
    expect(adminApi).toMatch(/rate: resolveRate\(p, settings\)/);
  });
});

describe('the settings', () => {
  it('allows every key the ladder reads, and no others by accident', () => {
    for (const k of ['reseller_tiers', 'reseller_band_caps', 'reseller_seat_lifetime', 'markup_reseller_margin_floor', 'reseller_tiers_live']) {
      expect(allowlist, k).toContain(`'${k}'`);
    }
  });

  it('spells the floor key the way lib/markup reads it', () => {
    // markup.js reads markup_reseller_margin_floor; an allowlist for
    // reseller_margin_floor would save a setting nothing ever consults.
    expect(allowlist).not.toMatch(/'reseller_margin_floor'/);
  });
});
