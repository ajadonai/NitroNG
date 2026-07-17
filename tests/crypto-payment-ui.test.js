import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import {
  creditedCryptoPaymentStatus,
  cryptoPaymentAttemptFingerprint,
  cryptoPaymentPresentation,
  getCryptoPaymentAttempt,
  isCreditedCryptoPaymentResult,
  isCryptoPaymentReview,
  isDefinitiveCryptoCreationRejection,
  isTerminalCryptoPaymentResult,
  releaseCryptoPaymentAttempt,
} from '@/lib/crypto-payment-ui';

describe('crypto payment attempt idempotency', () => {
  it('keeps one key for ambiguous retries of the same amount and coupon', () => {
    const cache = new Map();
    const createId = vi.fn()
      .mockReturnValueOnce('crypto-key-1')
      .mockReturnValueOnce('crypto-key-2');

    const first = getCryptoPaymentAttempt(cache, 5_000, 'coupon-1', createId);
    const retry = getCryptoPaymentAttempt(cache, 5_000, 'coupon-1', createId);

    expect(retry).toEqual(first);
    expect(createId).toHaveBeenCalledTimes(1);

    releaseCryptoPaymentAttempt(cache, first.fingerprint);
    expect(getCryptoPaymentAttempt(cache, 5_000, 'coupon-1', createId).idempotencyKey)
      .toBe('crypto-key-2');
  });

  it('separates attempts by exact amount and coupon', () => {
    expect(cryptoPaymentAttemptFingerprint(5_000, 'coupon-1'))
      .not.toBe(cryptoPaymentAttemptFingerprint(5_001, 'coupon-1'));
    expect(cryptoPaymentAttemptFingerprint(5_000, 'coupon-1'))
      .not.toBe(cryptoPaymentAttemptFingerprint(5_000, 'coupon-2'));
  });

  it('keeps the same key for conflict, rate-limit and server responses', () => {
    expect(isDefinitiveCryptoCreationRejection(400)).toBe(true);
    expect(isDefinitiveCryptoCreationRejection(422)).toBe(true);
    expect(isDefinitiveCryptoCreationRejection(409)).toBe(true);
    expect(isDefinitiveCryptoCreationRejection(429)).toBe(false);
    expect(isDefinitiveCryptoCreationRejection(500)).toBe(false);
  });
});

describe('crypto payment terminal states', () => {
  it.each(['Completed', 'Cancelled', 'Failed', 'Expired', 'Refunded', 'Review'])(
    'stops polling for %s',
    status => expect(isTerminalCryptoPaymentResult({ status })).toBe(true),
  );

  it.each(['credited', 'failed', 'review'])(
    'stops polling for the %s payment state',
    paymentState => expect(isTerminalCryptoPaymentResult({ status: 'Pending', paymentState })).toBe(true),
  );

  it('continues polling for pending provider states', () => {
    expect(isTerminalCryptoPaymentResult({ status: 'Confirming', paymentState: 'provider_pending' }))
      .toBe(false);
  });
});

describe('crypto payment credit and review presentation', () => {
  const credited = {
    status: 'Completed',
    paymentState: 'credited',
    success: true,
    amount: 5_000,
    reference: 'NTR-CRYPTO-1',
  };

  it('constructs the strict shared payment-status object for a real credit', () => {
    expect(isCreditedCryptoPaymentResult(credited)).toBe(true);
    expect(creditedCryptoPaymentStatus(credited)).toMatchObject({
      type: 'success',
      success: true,
      paymentState: 'credited',
      transactionStatus: 'Completed',
      amount: 5_000,
      reference: 'NTR-CRYPTO-1',
    });
  });

  it('does not turn contradictory completion fields into wallet credit', () => {
    const contradictory = { ...credited, success: false };
    expect(creditedCryptoPaymentStatus(contradictory)).toBeNull();
    expect(isCryptoPaymentReview(contradictory)).toBe(true);
    expect(cryptoPaymentPresentation(contradictory).kind).toBe('review');
  });

  it.each([
    ['underpayment', 'lower than expected'],
    ['overpayment', 'higher than expected'],
    ['partially_paid', 'lower than expected'],
    ['repeated_payment', 'linked to an earlier payment'],
    ['wrong_asset', 'different asset or network'],
    ['refunded_after_credit', 'refund or terminal change'],
    ['payment_id_mismatch', 'do not fully match'],
  ])('renders %s as manual review', (reason, copy) => {
    const presentation = cryptoPaymentPresentation({
      status: 'Review',
      paymentState: 'review',
      reason,
    });
    expect(presentation.kind).toBe('review');
    expect(presentation.message).toContain(copy);
  });

  it('keeps an ordinary provider refund in the terminal non-credit state', () => {
    expect(cryptoPaymentPresentation({
      status: 'Refunded',
      paymentState: 'failed',
      reason: 'refunded',
    })).toMatchObject({ kind: 'failed', title: 'Payment refunded' });
  });

  it.each([
    ['Expired', 'provider_expired', 'Payment expired'],
    ['Cancelled', 'provider_cancelled', 'Payment cancelled'],
    ['Failed', 'provider_failed', 'Payment unsuccessful'],
  ])('renders terminal %s without implying wallet credit', (status, reason, title) => {
    expect(cryptoPaymentPresentation({ status, paymentState: 'failed', reason }))
      .toMatchObject({ kind: 'failed', title });
  });
});

describe('crypto payment component wiring', () => {
  it('sends the stable key and never uses the old success string shortcut', () => {
    const source = readFileSync(new URL('../components/addfunds-page.jsx', import.meta.url), 'utf8');

    expect(source).toContain('idempotencyKey: attempt.idempotencyKey');
    expect(source).toContain('isTerminalCryptoPaymentResult(pollResult)');
    expect(source).toContain('creditedCryptoPaymentStatus(normalizedResult');
    expect(source).not.toMatch(/setPaymentStatus\s*\(\s*["']success["']\s*\)/);
  });
});
