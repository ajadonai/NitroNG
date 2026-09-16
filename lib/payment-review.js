/**
 * Deposits that succeeded at the bank but not at the quote.
 *
 * A Flutterwave payment whose figures are not the ones we asked for — a bank
 * transfer that arrived short, a foreign amount the rail rounded, a currency we
 * did not quote, a reference that came back different — parks as `Review` and
 * raises `deposit_paid_mismatch` in Sentry. Before this, that alert was the
 * only place it appeared: Admin → Payments lists manual and crypto deposits, so
 * the row rendered nowhere and the money sat in our Flutterwave balance,
 * uncredited, until somebody happened to read Sentry.
 *
 * Zero of these existed when the surface was built, which is the right time to
 * build one. The three shapes below are exactly what
 * `lib/flutterwave-verification` can produce; nothing here is speculative.
 */

/** What each reason means in words, and whether an amount can be credited automatically. */
export const REVIEW_REASONS = {
  amount_mismatch: {
    title: 'The amount did not match',
    /** The paid figure is observed, so it can be offered as a one-tap credit. */
    autoCreditable: true,
  },
  currency_mismatch: {
    title: 'Paid in a currency we did not quote',
    // No naira figure exists to credit. Nitro holds no rate for the currencies
    // this can arrive in, and guessing one to credit a wallet is how somebody
    // ends up out of pocket in a direction nobody notices.
    autoCreditable: false,
  },
  reference_mismatch: {
    title: 'The reference came back different',
    // The amount is usually right, but this is also the shape a double charge
    // takes: the customer paid twice, one settlement matched and one did not.
    // Creditable, with the warning attached.
    autoCreditable: true,
  },
  mismatch: { title: 'The payment did not match the quote', autoCreditable: false },
};

/**
 * Figures the verifier observed, read back off the note.
 *
 * The note is where this table already keeps structured facts — the payments
 * page parses `[user_confirmed:…]`, `[approved_by:…]` and `[rejected_by:…]`
 * out of it — so the evidence is written the same way rather than earning a
 * column of its own.
 *
 * Absent for any row that parked before the evidence was recorded, which is
 * why every caller has to cope with nulls rather than assume a number.
 */
export function readReviewEvidence(note) {
  const m = String(note || '').match(/\[flutterwave_paid:([^\]]*)\]/);
  if (!m) return null;
  const out = { underpaid: false };
  for (const bit of m[1].split(',')) {
    const [k, v] = bit.split('=');
    if (k === 'underpaid') { out.underpaid = true; continue; }
    if (v === undefined) continue;
    if (k === 'paid') out.paidKobo = Number(v);
    else if (k === 'expected') out.expectedKobo = Number(v);
    else if (k === 'gotcur') out.gotCurrency = v;
    else if (k === 'wantcur') out.wantCurrency = v;
    else if (k === 'gotref') out.gotReference = v;
  }
  if (!Number.isSafeInteger(out.paidKobo)) delete out.paidKobo;
  if (!Number.isSafeInteger(out.expectedKobo)) delete out.expectedKobo;
  return out;
}

/**
 * The one figure that may be credited, in kobo, or null when a human must say.
 *
 * Always what arrived and never what was quoted. If ₦24,850 landed against a
 * ₦25,000 quote then ₦24,850 is the only honest number, and offering the quote
 * as a convenience is how ₦150 of nothing gets handed out every time somebody
 * is in a hurry.
 */
export function creditableKobo(reason, evidence) {
  const spec = REVIEW_REASONS[reason];
  if (!spec?.autoCreditable) return null;
  const paid = evidence?.paidKobo;
  return Number.isSafeInteger(paid) && paid > 0 ? paid : null;
}

/** A row the admin surface can render without knowing how any of this works. */
export function describeReview(tx) {
  const reason = tx.paymentReviewReason || 'mismatch';
  const spec = REVIEW_REASONS[reason] || REVIEW_REASONS.mismatch;
  const evidence = readReviewEvidence(tx.note);
  const credit = creditableKobo(reason, evidence);
  return {
    reason,
    title: spec.title,
    quotedKobo: tx.amount,
    paidKobo: evidence?.paidKobo ?? null,
    shortKobo: Number.isSafeInteger(evidence?.paidKobo) ? tx.amount - evidence.paidKobo : null,
    gotCurrency: evidence?.gotCurrency || null,
    wantCurrency: evidence?.wantCurrency || null,
    gotReference: evidence?.gotReference || null,
    underpaid: evidence?.underpaid === true,
    creditableKobo: credit,
    // The reference shape is the one that can hide a double charge, so the
    // warning rides on the row rather than on somebody's memory.
    checkDashboard: reason === 'reference_mismatch',
  };
}
