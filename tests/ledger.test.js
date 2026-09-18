import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { DEAD_ORDER_STATES, WALLET_FUNDING } from '@/lib/ledger';
import { DEAD_STATES } from '@/lib/revenue';

// One definition each, read everywhere. Before 13 Sep 2026, 39 places excluded
// only Cancelled while lib/revenue.js also excluded Failed and Rejected, and
// "money in" was deposits+credits in 20 places, deposits alone in 13, and
// deposits+credits+gifts in one.

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (p.endsWith('.js')) out.push(p);
  }
  return out;
}
const root = new URL('..', import.meta.url).pathname;
const sources = () => [...walk(join(root, 'app')), ...walk(join(root, 'lib'))]
  // Protected — the nightly cohort check depends on it, and it speaks SQL.
  .filter(p => !p.includes('/cron/cohort-stats/'));

describe('the ledger definitions', () => {
  it('name the dead order states once, and revenue reads the same list', () => {
    expect(DEAD_ORDER_STATES).toEqual(['Cancelled', 'Failed', 'Rejected']);
    expect(DEAD_STATES).toBe(DEAD_ORDER_STATES);
  });

  it('name wallet funding as every route value arrives by', () => {
    expect(WALLET_FUNDING).toEqual(['deposit', 'admin_credit', 'admin_gift']);
  });

  it('are not spelled out again anywhere in app/ or lib/', () => {
    const offenders = [];
    for (const file of sources()) {
      const src = readFileSync(file, 'utf8');
      for (const literal of ["notIn: ['Cancelled']", "status: { not: 'Cancelled' }", "in: ['deposit', 'admin_credit'"]) {
        if (src.includes(literal)) offenders.push(`${file.replace(root, '')}: ${literal}`);
      }
    }
    expect(offenders, 'import DEAD_ORDER_STATES / WALLET_FUNDING from lib/ledger.js instead').toEqual([]);
  });
});

describe('activity means any live order', () => {
  const daily = readFileSync(join(root, 'app/api/cron/daily/route.js'), 'utf8');

  it('the win-back reset counts Partial and Processing orders, not Completed alone', () => {
    expect(daily).toContain(`orders.status NOT IN ('Cancelled', 'Failed', 'Rejected')`);
    expect(daily).not.toContain("orders.status = 'Completed'");
  });

  it('the win-back selection reads the shared dead list', () => {
    expect(daily).toContain('some: { status: { notIn: DEAD_ORDER_STATES }, deletedAt: null }');
    expect(daily).not.toContain("some: { status: 'Completed', deletedAt: null }");
  });

  it('ad activation and the outreach pool treat an admin credit as funded', () => {
    expect(daily).toContain("transactions: { none: { type: { in: WALLET_FUNDING }, status: 'Completed' } }");
    const pool = readFileSync(join(root, 'lib/outreach-pool.js'), 'utf8');
    expect(pool).toContain("transactions: { none: { type: { in: WALLET_FUNDING }, status: 'Completed' } }");
  });
});

describe('an admin-placed order is marked and is not a web conversion', () => {
  const create = readFileSync(join(root, 'app/api/admin/orders/create/route.js'), 'utf8');
  const orders = readFileSync(join(root, 'app/api/admin/orders/route.js'), 'utf8');

  it('carries source admin on both create paths', () => {
    expect(create.match(/source: 'admin'/g)).toHaveLength(2);
  });

  it('sends no Meta Purchase from the admin create or re-dispatch paths', () => {
    expect(create).not.toContain('enqueueMetaEvent');
    expect(orders).not.toContain('enqueueMetaEvent');
  });

  it('fires the first-order hook from every path that creates orders', () => {
    for (const file of ['app/api/admin/orders/create/route.js', 'app/api/orders/route.js', 'app/api/orders/bulk/route.js']) {
      const src = readFileSync(join(root, file), 'utf8');
      expect(src, file).toContain("from '@/lib/first-order'");
      expect(src, file).toContain('checkFirstOrder(');
    }
  });
});

/**
 * A gift is not money in — everywhere, not just on Pulse.
 *
 * v2.5.44 took `admin_gift` out of the Money in figure and its feed. Only Pulse
 * was moved to MONEY_IN; the Telegram digest, the bot's stats, the admin
 * overview, the deposits chart and the per-customer deposit total all kept
 * reading WALLET_FUNDING, so every gift still made those days look better than
 * they were. One ₦5,000 gift in the 30 days to 18 Sep 2026 was doing it.
 *
 * The two lists answer different questions and both are right for one of them:
 * MONEY_IN is "what the business took in"; WALLET_FUNDING is "has this account
 * ever been funded", which is what the nudges and the outreach pool ask.
 */
describe('a gift never counts as money in', () => {
  const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

  const REPORTS_MONEY = [
    'app/api/pulse/route.js',
    'app/api/cron/digest/route.js',
    'app/api/telegram/webhook/route.js',
    'app/api/admin/overview/route.js',
    'app/api/admin/analytics/route.js',
    'app/api/live/route.js',
  ];
  // These ask whether an account was ever funded, where a gift counts.
  const ASKS_IF_FUNDED = [
    'app/api/cron/daily/route.js',
    'lib/outreach-pool.js',
  ];

  for (const p of REPORTS_MONEY) {
    it(`${p} sums MONEY_IN, not WALLET_FUNDING`, () => {
      const src = read(p);
      expect(src).toContain('MONEY_IN');
      // Allowed in prose explaining the distinction, never in a query.
      const inQuery = /type:\s*\{\s*in:\s*WALLET_FUNDING\s*\}/.test(src);
      expect(inQuery, `${p} still aggregates WALLET_FUNDING`).toBe(false);
    });
  }

  for (const p of ASKS_IF_FUNDED) {
    it(`${p} keeps WALLET_FUNDING, because a gift does fund an account`, () => {
      expect(read(p)).toMatch(/type:\s*\{\s*in:\s*WALLET_FUNDING\s*\}/);
    });
  }

  it('the two lists differ by exactly the gift', () => {
    const src = read('lib/ledger.js');
    expect(src).toMatch(/WALLET_FUNDING = Object\.freeze\(\['deposit', 'admin_credit', 'admin_gift'\]\)/);
    expect(src).toMatch(/MONEY_IN = Object\.freeze\(\['deposit', 'admin_credit'\]\)/);
  });
});
