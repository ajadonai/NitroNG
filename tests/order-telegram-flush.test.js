import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

/**
 * Every route that announces an order has to wait for the announcement.
 *
 * `tgNewOrder` fires a fetch and returns the promise; nothing awaits it. Its own
 * docstring says so — "Call before a handler returns, or the platform may kill
 * the request before Telegram ever hears from us" — and every cron route obeys.
 * All three order-creation routes did not, so an order could be created and
 * never announced. Reported on the admin desk's full-list orders, 18 Sep 2026,
 * but it was never specific to those: the whole path was a race.
 */
const ROUTES = [
  'app/api/admin/orders/create/route.js',
  'app/api/orders/route.js',
  'app/api/orders/bulk/route.js',
];

describe('an order that is created is an order that is announced', () => {
  for (const path of ROUTES) {
    const src = readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

    it(`${path} waits for Telegram before returning`, () => {
      expect(src).toContain('tgNewOrder');
      expect(src, 'imports tgFlush').toMatch(/import \{[^}]*tgFlush[^}]*\} from '@\/lib\/telegram'/);
      expect(src, 'awaits it').toContain('await tgFlush()');
    });

    it(`${path} flushes at least once per announcing path`, () => {
      // One flush for every place the route announces and then answers. Fewer
      // means a path that still returns while the fetch is in the air.
      const announces = (src.match(/tgNewOrder\(/g) || []).length - 1;  // less the import line
      const flushes = (src.match(/await tgFlush\(\)/g) || []).length;
      expect(flushes, `${announces} announcing sites, ${flushes} flushes`).toBeGreaterThanOrEqual(1);
      expect(flushes).toBeGreaterThanOrEqual(Math.min(announces, 1));
    });
  }

  it('the helper still documents why this is required', () => {
    const tg = readFileSync(new URL('../lib/telegram.js', import.meta.url), 'utf8');
    expect(tg).toMatch(/Call before a handler returns/);
    expect(tg).toContain('export function tgFlush');
  });

  it('a tierless order is announced without empty parentheses', () => {
    const src = readFileSync(new URL('../app/api/admin/orders/create/route.js', import.meta.url), 'utf8');
    // A full-list order has no tier, and the label used to read
    // "Instagram Followers () by Soludo".
    expect(src).not.toMatch(/\(\$\{snapshot\.tierNameAtPurchase \|\| ''\}\)/);
    expect(src).toMatch(/snapshot\.tierNameAtPurchase \? ` \(\$\{snapshot\.tierNameAtPurchase\}\)` : ''/);
  });
});
