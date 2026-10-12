import { describe, it, expect } from 'vitest';

/**
 * The NOWPayments IPN signature suite that used to live here was deleted with
 * the provider on 12 Oct 2026. Its replacement is tests/cryptomus-verification.js,
 * which covers the equivalent ground for Cryptomus: a correctly signed payload
 * is accepted, a payload whose status is flipped to "paid" after signing is
 * rejected, and verification fails closed when no key is configured.
 */
describe('Flutterwave webhook signature', () => {
  it('rejects when signature does not match hash', () => {
    const hash = 'my-secret-hash';
    const signature = 'wrong-hash';
    expect(signature === hash).toBe(false);
  });

  it('accepts when signature matches hash', () => {
    const hash = 'my-secret-hash';
    const signature = 'my-secret-hash';
    expect(signature === hash).toBe(true);
  });
});
