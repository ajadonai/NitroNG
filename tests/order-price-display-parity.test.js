import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import fc from 'fast-check';
import { calculateCreateOrderPricing } from '@/lib/order-create-input.server';

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

// The formula as it appears in components/new-order.jsx, kept in lockstep with
// the source assertion below.
const displayedNaira = (pricePer1kNaira, qty) =>
  Math.ceil((Math.round(pricePer1kNaira * 100) / 1000) * qty / 100);

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
