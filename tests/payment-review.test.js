import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { REVIEW_REASONS, readReviewEvidence, creditableKobo, describeReview } from '@/lib/payment-review';

/**
 * Deposits that succeeded at the bank but not at the quote.
 *
 * A Flutterwave payment whose figures do not match parks as `Review` and raises
 * `deposit_paid_mismatch` in Sentry. That alert was the only place it appeared:
 * Admin → Payments lists manual and crypto, so the row rendered nowhere and the
 * money sat in our Flutterwave balance uncredited until somebody read Sentry.
 *
 * None of these existed when the surface was built, which is why every rule
 * here is pinned rather than trusted to the first real one to arrive.
 */
const route = readFileSync(new URL('../app/api/admin/payments/route.js', import.meta.url), 'utf8');
const page = readFileSync(new URL('../components/admin-pages.jsx', import.meta.url), 'utf8');
const fw = readFileSync(new URL('../lib/flutterwave-payment.js', import.meta.url), 'utf8');

describe('the figure that may be credited', () => {
  it('is what arrived, never what was quoted', () => {
    // ₦24,850 against a ₦25,000 quote credits ₦24,850. Offering the quote as a
    // convenience hands out ₦150 of nothing every time somebody is in a hurry.
    const tx = { amount: 2500000, paymentReviewReason: 'amount_mismatch', note: '[flutterwave_paid:paid=2485000,expected=2500000,underpaid]' };
    const d = describeReview(tx);
    expect(d.quotedKobo).toBe(2500000);
    expect(d.paidKobo).toBe(2485000);
    expect(d.shortKobo).toBe(15000);
    expect(d.creditableKobo).toBe(2485000);
    expect(d.underpaid).toBe(true);
  });

  it('refuses to guess a naira figure for a currency we do not quote', () => {
    // Nitro holds no rate for the currencies this can arrive in, and inventing
    // one to credit a wallet is how somebody ends up short in a direction
    // nobody notices.
    expect(REVIEW_REASONS.currency_mismatch.autoCreditable).toBe(false);
    const d = describeReview({ amount: 4000000, paymentReviewReason: 'currency_mismatch', note: '[flutterwave_paid:gotcur=GHS,wantcur=NGN]' });
    expect(d.creditableKobo).toBeNull();
    expect(d.gotCurrency).toBe('GHS');
    expect(d.wantCurrency).toBe('NGN');
  });

  it('offers nothing when the evidence is missing', () => {
    // Rows that parked before the evidence was recorded have no paid figure at
    // all. A null is the honest answer; a fallback to the quote is not.
    expect(creditableKobo('amount_mismatch', null)).toBeNull();
    expect(creditableKobo('amount_mismatch', { paidKobo: 0 })).toBeNull();
    expect(describeReview({ amount: 1000, paymentReviewReason: 'amount_mismatch', note: null }).creditableKobo).toBeNull();
  });

  it('flags the shape a double charge takes', () => {
    // A matching amount with a different reference is what two settlements look
    // like when only one matched. Crediting without opening the dashboard
    // credits the same money twice.
    const d = describeReview({ amount: 1000000, paymentReviewReason: 'reference_mismatch', note: '[flutterwave_paid:paid=1000000,gotref=FLW-REF-99201]' });
    expect(d.checkDashboard).toBe(true);
    expect(d.gotReference).toBe('FLW-REF-99201');
    expect(page).toMatch(/what a double charge looks like/);
  });
});

describe('the evidence on the row', () => {
  it('is written where this table already keeps structured facts', () => {
    // The payments page already parses [user_confirmed:…], [approved_by:…] and
    // [rejected_by:…] out of the note. Same convention, no migration.
    expect(fw).toMatch(/\[flutterwave_paid:\$\{bits\.join\(','\)\}\]/);
    expect(fw).toMatch(/evidence: verification,/);
  });

  it('records only figures the verifier actually observed', () => {
    expect(readReviewEvidence('[flutterwave_paid:paid=100,expected=200]')).toMatchObject({ paidKobo: 100, expectedKobo: 200 });
    expect(readReviewEvidence('nothing here')).toBeNull();
    // A malformed number is dropped rather than becoming NaN on a money row.
    expect(readReviewEvidence('[flutterwave_paid:paid=abc]')).not.toHaveProperty('paidKobo');
  });
});

describe('crediting a review', () => {
  it('never credits more than was quoted', () => {
    expect(route).toMatch(/if \(kobo > tx\.amount\) \{/);
    expect(route).toMatch(/Credit what arrived, not more/);
  });

  it('claims the review before the money moves', () => {
    // The opposite order credits twice on a race: both admins pass the status
    // check, both call finalizeDeposit, and only then does one lose the stamp.
    const block = route.slice(route.indexOf("action === 'credit_review'"), route.indexOf("if (!gatewayId)"));
    expect(block.indexOf('paymentReviewResolvedAt: new Date()')).toBeLessThan(block.indexOf('finalizeDeposit'));
    expect(block).toMatch(/claimed\.count !== 1/);
    expect(block).toMatch(/This review was resolved by someone else/);
  });

  it('hands the review back if the credit does not land', () => {
    // Otherwise the row closes uncredited and disappears from the only surface
    // that would have shown it.
    expect(route).toMatch(/data: \{ paymentReviewResolvedAt: null \}/);
  });

  it('credits through the shared path, with the amount stated', () => {
    expect(route).toMatch(/paidAmountKobo: kobo,/);
    expect(route).toMatch(/claimableStatuses: \['Review'\]/);
  });

  it('requires the approve permission, not merely access to the page', () => {
    expect(route).toMatch(/canPerformAction\(admin, 'payments\.approve'\)/);
  });

  it('records what was credited against what was quoted', () => {
    expect(route).toMatch(/Credited \$\{'\\u20A6'\}\$\{\(kobo \/ 100\)\.toLocaleString\(\)\} for \$\{tx\.reference\}/);
    expect(route).toMatch(/quoted \$\{'\\u20A6'\}/);
  });
});

describe('where it appears', () => {
  it('sits above the filters, since a status filter could hide it', () => {
    expect(page).toMatch(/\{reviews\.length > 0 && \(/);
    expect(page.indexOf('pm-review')).toBeLessThan(page.indexOf('className="pm-bar"'));
  });

  it('lists every method, not the two this page otherwise shows', () => {
    // The whole fault was that Flutterwave rows had nowhere to appear.
    expect(route).toMatch(/where: \{ type: 'deposit', status: 'Review', paymentReviewResolvedAt: null \}/);
  });

  it('names the figure on the button rather than saying approve', () => {
    // "Approve" would be a guess about which of the three numbers it meant.
    expect(page).toMatch(/Credit \{fN\(r\.creditableKobo \/ 100\)\}/);
  });

  it('shows the count only when there is one', () => {
    expect(page).toMatch(/\{!!facts\.review && <div className="pm-stt bad">/);
  });
});
