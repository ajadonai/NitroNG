import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const bulk = readFileSync(new URL('../components/new-order.jsx', import.meta.url), 'utf8');
const single = readFileSync(new URL('../components/order-form.jsx', import.meta.url), 'utf8');

/**
 * Saved handles, in both order forms.
 *
 * Both read the same route, show the same collapsed "Saved handles (N)" line,
 * page three at a time and put the pinned handle first. Bulk could SHOW that a
 * handle was pinned and offered no way to pin one — its chip was a single fill
 * button where the single form's is a fill button plus a toggle — so anybody
 * working mostly in bulk had to open a single order to choose a default they
 * could already see starred.
 *
 * The one difference that stays is auto-fill, and it stays on purpose: see the
 * last test.
 */
describe('saved handles reach the bulk form', () => {
  const cart = bulk.slice(bulk.indexOf('// Saved handles for bulk rows'));

  it('reads the same source as the single form', () => {
    expect(cart).toMatch(/\/api\/orders\/recent-links\?platform=/);
    expect(single).toMatch(/\/api\/orders\/recent-links\?platform=/);
  });

  it('can set a pin, not only read one', () => {
    expect(cart).toMatch(/const togglePin = \(p, url\) =>/);
    expect(cart).toMatch(/onClick=\{\(\) => togglePin\(row\.platform, r\.link\)\}/);
    // Same toggle-off-when-repeated rule the single form has.
    expect(cart).toMatch(/const next = pinnedFor\(p\) === url \? null : url;/);
    expect(single).toMatch(/const next = pinned === url \? null : url;/);
  });

  it('keeps the pin visible across a reload, and on screen without one', () => {
    // localStorage does not re-render, so state holds the session's choice and
    // the stored value answers for any platform not touched yet.
    expect(cart).toMatch(/localStorage\.setItem\(`nitro-pin:\$\{p\}`, next\)/);
    expect(cart).toMatch(/localStorage\.removeItem\(`nitro-pin:\$\{p\}`\)/);
    expect(cart).toMatch(/if \(p in pins\) return pins\[p\];/);
  });

  it('shows the star as a control rather than as a prefix on the label', () => {
    expect(cart).toMatch(/\{isPin \? "★" : "☆"\}/);
    expect(cart).not.toMatch(/\{isPin \? "★ " : ""\}/);
    expect(cart).toMatch(/aria-pressed=\{isPin\}/);
  });

  it('still never auto-fills in bulk, which is the one difference kept', () => {
    // A cart often spans several accounts. A pin that filled every new row
    // would be wrong for exactly those carts — ten rows to clear nine.
    expect(single).toMatch(/useEffect\(\(\) => \{ if \(pinned && !link\) validateLink\(pinned\); \}, \[pinned\]\);/);
    expect(cart).not.toMatch(/if \(pinned.*\) *validateLink/);
    expect(cart).toMatch(/never auto-fill in bulk/);
  });
});
