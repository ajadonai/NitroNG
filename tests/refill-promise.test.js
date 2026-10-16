import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { canRequestRefill, refillPromiseDays } from '../lib/refill-promise.js';

const source = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const DAY = 24 * 60 * 60 * 1000;
const now = Date.UTC(2026, 9, 16, 12);
const done = days => new Date(now - days * DAY).toISOString();

describe('the refill promise follows the tier name', () => {
  it('maps the ladder to its promise', () => {
    expect(refillPromiseDays('Budget')).toBe(0);
    expect(refillPromiseDays('Standard')).toBe(30);
    expect(refillPromiseDays('Premium')).toBe(Infinity);
  });

  it('promises nothing off the ladder', () => {
    for (const name of ['Option A', '', null, undefined, 'premium', 'Gold'])
      expect(refillPromiseDays(name)).toBe(0);
  });

  it('never lets Budget ask, however recent', () => {
    expect(canRequestRefill({ status: 'Completed', completedAt: done(1), tierName: 'Budget' }, now)).toBe(false);
  });

  it('gives Standard thirty days from completion', () => {
    expect(canRequestRefill({ status: 'Completed', completedAt: done(29), tierName: 'Standard' }, now)).toBe(true);
    expect(canRequestRefill({ status: 'Completed', completedAt: done(31), tierName: 'Standard' }, now)).toBe(false);
  });

  it('gives Premium a refill for life', () => {
    expect(canRequestRefill({ status: 'Completed', completedAt: done(900), tierName: 'Premium' }, now)).toBe(true);
  });

  it('only once the order is completed', () => {
    for (const status of ['Pending', 'Processing', 'Partial', 'Cancelled'])
      expect(canRequestRefill({ status, completedAt: done(1), tierName: 'Premium' }, now)).toBe(false);
    expect(canRequestRefill({ status: 'Completed', completedAt: null, tierName: 'Premium' }, now)).toBe(false);
  });

  it('is the rule the refill route and the orders list both use', () => {
    // Both used to read ServiceTier.refill / refillDays, the upstream data.
    const route = source('app/api/orders/refill/route.js');
    const orders = source('app/api/orders/route.js');
    const page = source('components/orders-page.jsx');
    expect(route).toContain('canRequestRefill(');
    // The provider's flag may still decide whether to pass the refill on to
    // them, but never whether the customer may ask.
    expect(route).not.toContain('if (!order.tier?.refill)');
    expect(route).not.toContain('order.tier.refillDays');
    expect(orders).toContain('canRequestRefill(');
    expect(page).toContain('o.canRefill');
    expect(page).not.toContain('o.refillDays');
  });
});
