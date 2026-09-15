import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { MONEY_IN, WALLET_FUNDING } from '../lib/ledger.js';

const pulse = readFileSync(new URL('../app/api/pulse/route.js', import.meta.url), 'utf8');

/**
 * "Money in" and "who has a balance" are two questions, and Pulse was answering
 * the first with the constant built for the second.
 *
 * WALLET_FUNDING includes admin_gift on purpose — a customer an admin has
 * already credited is not waiting to be activated, so the nudges and the
 * ad-activation sequence must see it. Reused for a revenue figure it counted
 * money we GAVE AWAY as money that arrived, and every gift made the day look
 * better than it was.
 */
describe('money in is money that arrived', () => {
  it('excludes gifts, which are a payout and are reported as one', () => {
    expect(MONEY_IN).not.toContain('admin_gift');
    expect(WALLET_FUNDING).toContain('admin_gift');
    // Pulse already buckets gifts under payouts month-to-date.
    expect(pulse).toMatch(/WHEN type = 'admin_gift' THEN 'gifts'/);
  });

  it('keeps admin credits, because most of them are real money', () => {
    // Staff credit a wallet by hand when somebody pays by bank transfer or
    // underpays and is topped up. ₦31,500 of Sep 2026's ₦36,601 was money
    // customers had genuinely sent. Dropping it would trade an overstatement
    // for a bigger understatement.
    expect(MONEY_IN).toContain('admin_credit');
    expect(MONEY_IN).toContain('deposit');
  });

  it('is used for every figure that claims to be revenue', () => {
    // today, yesterday, month, and the 30-day chart.
    expect([...pulse.matchAll(/type: \{ in: MONEY_IN \}/g)].length).toBeGreaterThanOrEqual(4);
  });

  it('covers the Money in FEED too, not only the figure', () => {
    // This was got wrong once. The recent-funding list was left on
    // WALLET_FUNDING on the reasoning that it answers "whose wallet went up" —
    // but it renders under the heading "Money in", with a "+" on every row, and
    // it feeds the today count beside that heading. So a gift stayed visible,
    // by name, in the one panel it had just been taken out of.
    expect(pulse).not.toMatch(/type: \{ in: WALLET_FUNDING \}/);
    expect([...pulse.matchAll(/type: \{ in: MONEY_IN \}/g)]).toHaveLength(5);
  });

  it('keeps the two lists from drifting into the same thing', () => {
    expect(WALLET_FUNDING.length).toBeGreaterThan(MONEY_IN.length);
    for (const t of MONEY_IN) expect(WALLET_FUNDING).toContain(t);
  });
});
