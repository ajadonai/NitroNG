import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

/**
 * Wallet money is credit for Nitro services and is not paid back to a bank
 * account. That promise was removed on 7 Sep 2026 (policy dated the same day)
 * because it cannot be kept once signup accepts five countries: a customer in
 * London has no Nigerian bank to receive a naira refund, and the only foreign
 * payment rail is USDT.
 *
 * It had drifted into five files, which is how it survived being "removed"
 * once already. This fails if any of them offers it again.
 */
const SURFACES = [
  'components/refund.jsx',
  'components/terms.jsx',
  'components/contact-page.jsx',
  'components/reviews-page.jsx',
  'lib/faq-data.js',
];

// Crew commission payouts genuinely do go to a bank — that is a different
// promise to a different person, and these files do not carry it.
const OFFERS_A_BANK_REFUND = [
  /back to your bank/i,
  /send it back to your bank/i,
  /refund(?:ed)? (?:it |them )?to your bank/i,
  /go back to your bank/i,
];

describe('refund policy: wallet money is credit, not a bank refund', () => {
  for (const file of SURFACES) {
    it(`${file} does not offer to refund wallet money to a bank`, () => {
      const src = readFileSync(file, 'utf8');
      for (const pattern of OFFERS_A_BANK_REFUND) {
        expect(src, `${file} matched ${pattern}`).not.toMatch(pattern);
      }
    });
  }

  it('the refund policy carries the date it changed', () => {
    expect(readFileSync('components/refund.jsx', 'utf8')).toContain('date="September 7, 2026"');
  });

  it('the FAQ answers the bank-refund question with a clear no', () => {
    const faq = readFileSync('lib/faq-data.js', 'utf8');
    const idx = faq.indexOf('Can I get a cash refund to my bank account?');
    expect(idx, 'the question should still be asked — people search for it').toBeGreaterThan(-1);
    expect(faq.slice(idx, idx + 200)).toMatch(/"No\./);
  });
});
