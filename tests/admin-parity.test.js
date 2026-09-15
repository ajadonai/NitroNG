import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const admin = readFileSync(new URL('../components/admin-dashboard.jsx', import.meta.url), 'utf8');
const fin = readFileSync(new URL('../app/api/admin/financials/route.js', import.meta.url), 'utf8');
const pages = readFileSync(new URL('../components/admin-pages.jsx', import.meta.url), 'utf8');

/**
 * Admin kept its own copy of the design tokens, so a change to the customer
 * side stopped at the door.
 *
 * The line colours were strengthened because a rose border at .13 alpha
 * measures 1.20:1 against the card behind it and reads as grey. Every customer
 * surface followed, because they all resolve var(--t-card-border). Admin had
 * the same numbers written out by hand and kept the invisible version.
 */
describe('admin follows the shared design tokens', () => {
  it('reads the line colours instead of restating them', () => {
    expect(admin).toMatch(/sidebarBorder: "var\(--t-sidebar-border\)"/);
    expect(admin).toMatch(/cardBorder: "var\(--t-card-border\)"/);
    // No hand-copied alphas left to drift.
    expect(admin).not.toMatch(/rgba\(232,180,196,\.1[58]\)/);
    expect(admin).not.toMatch(/rgba\(139,74,94,\.1[36]\)/);
  });

  it('draws its shell lines at a full pixel', () => {
    // Half a pixel of any colour is a grey smudge — strengthening the token
    // does nothing for a 0.5px border.
    expect(admin).not.toMatch(/0\.5px solid \$\{t\.sidebarBorder\}/);
  });

  it('runs the same navigation strip as the customer side', () => {
    expect(admin).toMatch(/import NavProgress, \{ NAV_BAR_MIN_MS \} from "\.\/nav-progress"/);
    // Both shells — the skeleton and the loaded one.
    expect([...admin.matchAll(/<NavProgress busy=\{navBusy\} \/>/g)]).toHaveLength(2);
  });
});

/**
 * "Unknown" in the Financials tier breakdown meant two unrelated things, and
 * hid the larger one: 90 days held ₦355k of ordinary Standard and Budget
 * revenue from orders whose TIER had been deleted, sitting beside ₦4k of
 * genuine full-list orders that never had one.
 */
describe('the financials tier breakdown tells the two apart', () => {
  it('names a full-list order rather than calling it unknown', () => {
    expect(fin).toMatch(/const name = o\.tier\?\.tier \|\| o\.tierNameAtPurchase \|\| "Full list";/);
    // The snapshot is the authority: tierId goes null in BOTH cases.
    expect(fin).toMatch(/select: \{ charge: true, cost: true, quantity: true, remains: true, status: true, tierNameAtPurchase: true/);
  });

  it('can filter for them, which a relation filter cannot express', () => {
    expect(fin).toMatch(/if \(tier === 'fulllist'\)/);
    expect(fin).toMatch(/\{ tierId: null \}, \{ tierNameAtPurchase: null \}/);
    expect(pages).toMatch(/\{ value: "fulllist", label: "Full list" \}/);
  });

  it('leaves an orphaned order under the tier it was actually sold as', () => {
    // tierNameAtPurchase outranks the missing relation, so ₦355k of Standard
    // and Budget revenue stops hiding in the unknown bin.
    const line = fin.slice(fin.indexOf('const name = o.tier?.tier'));
    expect(line.slice(0, 80)).toContain('o.tierNameAtPurchase');
  });
});
