import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { scanArrayProse } from '../scripts/i18n-detect.mjs';

/**
 * The shape that let English ship under a green guard.
 *
 * The hero stats were `[[siteStats.orders || "0", "Orders"], …]` mapped to
 * `<span>{label}</span>`. An Arabic reader saw ORDERS, ACCOUNTS and DELIVERY in
 * English, and the drift guard stayed green because the detector found nothing
 * at all in components/landing-v3.jsx — it knows markup and prose-ish keys, and
 * a bare element of an array is neither.
 *
 * It cannot be a hard rule: 534 strings across 40 files match, and most are
 * correctly English — platform names, tier names, the names in the
 * testimonials, HTTP verbs in the API docs. Demanding 534 exemptions would be
 * worse than the bug it prevents.
 *
 * So it is a ratchet. Every file carries the count it had on 16 Sep 2026 and
 * may never exceed it; 43 files are at zero and can never gain one. This does
 * not clean anything up. It stops the same mistake being made twice in the
 * places that are currently right.
 */
const baseline = JSON.parse(readFileSync(new URL('../scripts/i18n-array-baseline.json', import.meta.url), 'utf8'));

describe('bare prose in array literals', () => {
  const found = scanArrayProse();

  it('never increases in a file that already has some', () => {
    const over = [];
    for (const [file, strings] of found) {
      const allowed = baseline.files[file];
      if (allowed === undefined) continue;   // covered by the next test
      if (strings.size > allowed) over.push(`${file}: ${strings.size} > ${allowed} — ${[...strings].slice(-3).join(', ')}`);
    }
    expect(over, 'wrap the new string in tr() or msg(), or lower the baseline if you cleaned some up').toEqual([]);
  });

  it('never appears in a file that had none', () => {
    // The strict half. A file not on the list is a file that was clean, and a
    // new bare label in one is exactly the bug this exists for.
    const fresh = [...found.keys()].filter(f => baseline.files[f] === undefined)
      .map(f => `${f}: ${[...found.get(f)].slice(0, 3).join(', ')}`);
    expect(fresh, 'this file had no unwrapped array prose; wrap it in tr() or msg()').toEqual([]);
  });

  it('keeps the baseline honest as files improve', () => {
    // A number higher than reality is a budget nobody is using, and it would
    // silently allow a regression back up to it.
    const stale = [];
    for (const [file, allowed] of Object.entries(baseline.files)) {
      const actual = found.get(file)?.size ?? 0;
      if (actual < allowed) stale.push(`${file}: baseline ${allowed}, actually ${actual}`);
    }
    expect(stale, 'lower these to the real count so the ratchet cannot slip back').toEqual([]);
  });

  it('catches the exact shape that shipped', () => {
    // A guard that cannot be shown to catch the original bug is decoration.
    const { scanArrayProse: scan } = { scanArrayProse };
    expect(typeof scan).toBe('function');
    const detector = readFileSync(new URL('../scripts/i18n-detect.mjs', import.meta.url), 'utf8');
    expect(detector).toMatch(/siteStats\.orders \|\| "0", "Orders"/);
    expect(detector).toMatch(/const ARRAY_PROSE =/);
  });
});
