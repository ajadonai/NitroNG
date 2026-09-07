import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import fc from 'fast-check';
import { calculateCreateOrderPricing } from '@/lib/order-create-input.server';
import { calculateOrderPrice } from '@/lib/order-form-core';

/**
 * The single-order form must display exactly what the endpoint will charge.
 *
 * It did not: the form used Math.round while the endpoint uses Math.ceil, so on
 * roughly a third of quantity/price combinations the screen quoted ₦1 less than
 * the real charge. A customer holding exactly the quoted amount was refused with
 * "Insufficient balance" for an order the page said they could afford — reported
 * live, reproduced as Instagram Followers 🇳🇬 Budget × 100 quoting ₦1,774
 * against a ₦1,775 charge.
 */

// The real function the order form quotes from — not a copy of it, so this
// cannot pass while the form itself drifts.
const displayedNaira = (pricePer1kNaira, qty) =>
  calculateOrderPrice({ quantity: qty, tier: { pricePer1k: pricePer1kNaira } }).price;

const chargedNaira = (sellPer1kKobo, qty) => {
  const pricing = calculateCreateOrderPricing({
    tier: null,
    service: { min: 1, max: 1_000_000, sellPer1k: sellPer1kKobo, costPer1k: 1 },
    quantity: qty,
    usdRate: 1,
  });
  if (!pricing.ok) return null;
  return pricing.value.chargeKobo / 100;
};

describe('single-order price display parity', () => {
  it('quotes exactly what the endpoint charges, across the price/quantity space', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 5_000_000 }), // sellPer1k in kobo
        fc.integer({ min: 1, max: 100_000 }),   // quantity
        (sellPer1kKobo, qty) => {
          // The menu API hands the browser naira: kobo / 100.
          const shown = displayedNaira(sellPer1kKobo / 100, qty);
          expect(shown).toBe(chargedNaira(sellPer1kKobo, qty));
        },
      ),
      { numRuns: 2000 },
    );
  });

  it('quotes the reported case at the charged price, not a naira under', () => {
    // Instagram Followers 🇳🇬 Budget × 100 — the order that was refused.
    const sellPer1kKobo = 1_774_500;
    expect(chargedNaira(sellPer1kKobo, 100)).toBe(1775);
    expect(displayedNaira(sellPer1kKobo / 100, 100)).toBe(1775);
  });

  it('prices bulk rows identically to single orders', () => {
    // Bulk used to round while single ceiled, so the same service and quantity
    // cost ₦1 more as a single order than in a cart. Both ceil now.
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 5_000_000 }),
        fc.integer({ min: 1, max: 100_000 }),
        (sellPer1kKobo, qty) => {
          const bulkServerKobo = Math.ceil(sellPer1kKobo * qty / 100_000) * 100;
          const bulkCartNaira = Math.ceil(Math.round((sellPer1kKobo / 100) * 100) * qty / 100_000);
          expect(bulkCartNaira).toBe(bulkServerKobo / 100);
          expect(bulkCartNaira).toBe(chargedNaira(sellPer1kKobo, qty));
        },
      ),
      { numRuns: 2000 },
    );
  });

  it('keeps every bulk charge path on ceil, and leaves refund proration alone', () => {
    const bulk = fs.readFileSync(
      path.join(process.cwd(), 'app/api/orders/bulk/route.js'),
      'utf8',
    );
    // Charge and cost, both the reorder path and the main row path.
    expect(bulk).toContain('const charge = Math.ceil(serverPrice * qty / 100_000) * 100;');
    expect(bulk).toContain('const charge = Math.ceil(Number(o.tier.sellPer1k) * o.quantity / 100_000) * 100;');
    expect(bulk).not.toMatch(/const charge = Math\.round\(/);
    expect(bulk).not.toMatch(/const cost = Math\.round\(/);
    // Discounts re-round up, matching the single-order route.
    expect(bulk).not.toMatch(/Math\.max\(100, Math\.round\(/);
    // A partial-delivery refund is money owed back, so it stays on round —
    // ceiling it would quietly change what customers are repaid.
    expect(bulk).toContain('Math.round((liveRemains / order.quantity) * order.charge)');
  });

  it('still uses Math.ceil in the bulk cart', () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), 'components/new-order.jsx'),
      'utf8',
    );
    const start = source.split('\n').findIndex(l => l.includes('function getRowPrice('));
    expect(start, 'getRowPrice moved or was renamed').toBeGreaterThan(-1);
    const body = source.split('\n').slice(start, start + 8).join('\n');
    expect(body).toContain('Math.ceil');
  });

  it('quotes admin-created orders at the admin endpoint\'s charge', () => {
    // The admin create-order screen did no rounding at all and let fN() round to
    // nearest at display time, while its endpoint ceils — the same fault as the
    // customer form, in a third place. This is the helper as written there.
    const adminQuote = (per1kNaira, q) => Math.ceil(Math.round(per1kNaira * 100) * q / 100_000);
    const adminCharge = (per1kKobo, q) => Math.ceil(per1kKobo * q / 100_000) * 100 / 100;
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 5_000_000 }),
        fc.integer({ min: 1, max: 100_000 }),
        (sellPer1kKobo, qty) => {
          expect(adminQuote(sellPer1kKobo / 100, qty)).toBe(adminCharge(sellPer1kKobo, qty));
          // and admin must charge what the customer route would charge
          expect(adminCharge(sellPer1kKobo, qty)).toBe(chargedNaira(sellPer1kKobo, qty));
        },
      ),
      { numRuns: 2000 },
    );
  });

  it('still uses Math.ceil in the order form', () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), 'components/new-order.jsx'),
      'utf8',
    );
    const lines = source.split('\n');
    const start = lines.findIndex(l => l.includes('const price = selTier'));
    expect(start, 'the single-order price line moved or was renamed').toBeGreaterThan(-1);
    // The expression spans a few lines; read to the end of the statement.
    const expression = lines.slice(start, start + 4).join('\n');
    // Math.round here is the bug this file exists to prevent.
    expect(expression).toContain('Math.ceil');
    expect(expression).not.toContain('Math.round((Number(qty)');
  });
});
