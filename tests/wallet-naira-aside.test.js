import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const locale = readFileSync(new URL('../components/locale.jsx', import.meta.url), 'utf8');
const dash = readFileSync(new URL('../components/dashboard.jsx', import.meta.url), 'utf8');
const funds = readFileSync(new URL('../components/addfunds-page.jsx', import.meta.url), 'utf8');

/**
 * The wallet balance says what it is in naira.
 *
 * formatDisplayPrice prefixes "≈" for every non-naira currency, which is the
 * honest thing to do with a price: the naira figure is the real one and the
 * conversion is an estimate of it.
 *
 * A balance is a different kind of number. It is not an estimate of anything —
 * it is the stored naira figure itself — and a customer reading only "≈ KSh
 * 29,600" cannot check it against a receipt, a transfer, or what an order just
 * cost them. So the balance carries both, and only the balance.
 */
describe('the wallet balance carries its naira', () => {
  it('offers a naira formatter that is independent of the display currency', () => {
    expect(locale).toMatch(/const fmtBase = useCallback\(\(naira, opts\) => formatMoney\(naira, BASE_CURRENCY, opts\), \[\]\);/);
    expect(locale).toMatch(/const converted = currency !== BASE_CURRENCY;/);
    // Both reach call sites, and both are in the memo's dependencies — a stale
    // `converted` would keep showing the aside after a switch back to naira.
    expect(locale).toMatch(/fmtNative, fmtBase, converted, toDisplay/);
    expect(locale).toMatch(/fmtNative, fmtBase, converted, toDisplay, toNaira, ensureRates\],/);
  });

  it('returns null when naira is already on screen, so callers need no branch', () => {
    const hook = locale.slice(locale.indexOf('export function useNairaAside()'));
    expect(hook).toMatch(/converted && fmtBase \? fmtBase\(naira, opts\) : null/);
  });

  it('shows it on every wallet balance that has room for it', () => {
    // The dashboard card and the mobile sheet row.
    expect(dash).toMatch(/useNairaAside/);
    expect([...dash.matchAll(/nairaAside\(user\?\.balance \|\| 0, \{ round: "down" \}\)/g)].length).toBeGreaterThanOrEqual(4);
    // And the Add Funds page, which is the worst place to be unable to check
    // what you hold.
    expect(funds).toMatch(/useNairaAside/);
    expect(funds).toMatch(/nairaAside\(balance, \{ round: "down" \}\)/);
  });

  it('reaches the compact pill through the label rather than crowding it', () => {
    // The desktop pill is a control with a Top up chip inside it; a second unit
    // beside the first would crowd the one thing it exists to do. The figure is
    // still reachable by hover and by screen reader.
    expect(dash).toMatch(/title=\{nairaAside\(user\?\.balance \|\| 0, \{ round: "down" \}\) \|\| undefined\}/);
    const pill = dash.slice(dash.indexOf('dash-balance-pill') - 400, dash.indexOf('dash-balance-pill') + 200);
    expect(pill, 'the spoken label should name both units').toMatch(/aria-label=\{`Balance /);
    expect(pill).toMatch(/nairaAside/);
  });

  it('rounds a held balance down wherever it appears, like the figure it echoes', () => {
    // Rounding the aside up would show more naira than the customer has, which
    // is the one direction a balance must never be wrong in.
    const asides = [...dash.matchAll(/nairaAside\([^)]*\)/g)].map(m => m[0]);
    expect(asides.length).toBeGreaterThan(0);
    for (const a of asides) expect(a, a).toMatch(/round: "down"/);
    expect(funds).not.toMatch(/nairaAside\(balance\)/);
  });
});
