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
