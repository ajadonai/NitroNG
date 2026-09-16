import prisma from '@/lib/prisma';
import { log } from '@/lib/logger';
import { finalizeDeposit } from '@/lib/deposit-finalization';
import { verifyFlutterwaveTransaction } from '@/lib/flutterwave-verification';
import { reportOperationalFailure } from '@/lib/monitoring';
import {
  acquireProviderQueryLease,
  releaseProviderQueryLease,
  renewProviderQueryLease,
} from '@/lib/provider-query-lease';
import {
  isCreditedPaymentResult,
  isRetryablePaymentState,
  PAYMENT_STATES,
  paymentStateFromTransactionStatus,
} from '@/lib/payment-state';

const UNSETTLED_STATUSES = ['Pending', 'Processing', 'Expired'];
const DEFAULT_PROVIDER_TIMEOUT_MS = 15_000;
const PROVIDER_LEASE_BUFFER_MS = 15_000;
const MIN_PROVIDER_LEASE_MS = 30_000;
const RESULT_APPLICATION_LEASE_MS = 45_000;
export const FLUTTERWAVE_FINALIZABLE_STATUSES = [
  ...UNSETTLED_STATUSES,
  'Failed',
  'Cancelled',
];

export { isCreditedPaymentResult };

function messageForPaymentState(paymentState, reason) {
  if (paymentState === PAYMENT_STATES.CREDITED) return 'Already credited';
  if (paymentState === PAYMENT_STATES.VERIFYING) return 'Verification is still in progress';
  if (paymentState === PAYMENT_STATES.PROVIDER_PENDING) return 'Flutterwave has not confirmed this payment yet';
  if (paymentState === PAYMENT_STATES.RETRYABLE) {
    // A checkout the customer closed is not an outage. Telling them "Flutterwave
    // could not be reached" when they pressed back is how a site looks broken
    // to someone who was about to pay.
    if (reason === 'abandoned') return 'This payment was not completed and nothing was charged. Try again whenever you are ready.';
    return reason === 'missing_configuration'
      ? 'Payment verification is temporarily unavailable. Please try again.'
      : 'Flutterwave could not be reached. Please try again.';
  }
  if (paymentState === PAYMENT_STATES.REVIEW) {
    return 'We received a payment that does not match this deposit. Support is checking it and will credit what arrived.';
  }
  return 'Payment verification failed';
}

// A successful payment whose figures are not the ones we quoted: a bank
// transfer that arrived short, a foreign amount the rail rounded, a currency
// we did not ask for. Money moved, so it is neither abandonment nor a decline.
const MISMATCH_REASONS = new Set(['amount_mismatch', 'currency_mismatch', 'reference_mismatch']);

function outcomeForTransaction(transaction, overrides = {}) {
  if (!transaction) {
    return {
      paymentState: PAYMENT_STATES.FAILED,
      transactionStatus: null,
      retryable: false,
      transaction: null,
      finalization: null,
      newlyFinalized: false,
      reason: 'not_found',
      message: 'Transaction not found',
      ...overrides,
    };
  }

  const paymentState = paymentStateFromTransactionStatus(transaction.status);
  return {
    paymentState,
    transactionStatus: transaction.status,
    retryable: isRetryablePaymentState(paymentState),
    transaction,
    finalization: null,
    newlyFinalized: false,
    reason: null,
    message: messageForPaymentState(paymentState),
    ...overrides,
  };
}

function failureNote(note, reason) {
  const marker = `[flutterwave_verification:${reason || 'failed'}]`;
  if (note?.includes(marker)) return note;
  return [note, marker].filter(Boolean).join(' ');
}

/**
 * What the provider actually said, kept on the row.
 *
 * A mismatch went to Sentry carrying both figures and to the database carrying
 * only a reason code, so the one number an admin needs in order to act —
 * what arrived — lived in an alert and nowhere else. An admin looking at the
 * row could see that something was wrong and not what.
 *
 * Written as a note marker rather than a column because the note is already
 * how this table carries structured facts: the payments page parses
 * `[user_confirmed:…]`, `[approved_by:…]` and `[rejected_by:…]` out of it
 * today. Same convention, no migration, and the evidence travels with the row.
 *
 * Only figures the verifier genuinely observed are written. A currency
 * mismatch has no naira figure, so none is invented — the surface asks a human
 * for that one instead of guessing a rate.
 */
function evidenceNote(note, verification) {
  const bits = [];
  if (Number.isSafeInteger(verification?.paidAmountKobo)) bits.push(`paid=${verification.paidAmountKobo}`);
  if (Number.isSafeInteger(verification?.expectedAmountKobo)) bits.push(`expected=${verification.expectedAmountKobo}`);
  if (verification?.providerCurrency) bits.push(`gotcur=${String(verification.providerCurrency).slice(0, 8)}`);
  if (verification?.expectedCurrency) bits.push(`wantcur=${String(verification.expectedCurrency).slice(0, 8)}`);
  if (verification?.providerReference) bits.push(`gotref=${String(verification.providerReference).slice(0, 48)}`);
  if (verification?.underpaid === true) bits.push('underpaid');
  if (!bits.length) return note;
  const marker = `[flutterwave_paid:${bits.join(',')}]`;
  if (note?.includes(marker)) return note;
  return [note, marker].filter(Boolean).join(' ');
}

async function latestTransaction(id, fallback) {
  return prisma.transaction.findUnique({ where: { id } }).catch(() => fallback);
}

async function authoritativeTransaction(id) {
  return prisma.transaction.findUnique({ where: { id } });
}

async function transitionUnsettled(transaction, status, { reason, includeFailureNote = false, stampProviderResponse = false, evidence = null } = {}) {
  // Provider I/O can overlap an admin/manual finalization, which does not use
  // this provider-query lease. Never return the pre-I/O snapshot merely because
  // it already had the desired status.
  const authoritative = await authoritativeTransaction(transaction.id);
  if (!authoritative) return transaction;
  transaction = authoritative;
  if (transaction.status === status && !includeFailureNote) return transaction;

  const noteWithReason = includeFailureNote ? failureNote(transaction.note, reason) : transaction.note;
  const noteWithEvidence = evidence ? evidenceNote(noteWithReason, evidence) : noteWithReason;
  const data = {
    status,
    ...(noteWithEvidence !== transaction.note ? { note: noteWithEvidence } : {}),
    // Stamped whenever a transition applies a real provider verdict, so the
    // gap between creation and the verdict is measurable from the row — it
    // was not, when the provider_not_found diagnosis needed it.
    ...(stampProviderResponse ? { providerLastVerifiedAt: new Date() } : {}),
    ...(status === 'Review' ? { paymentReviewReason: reason || 'mismatch', paymentReviewAt: new Date() } : {}),
  };
  const changed = await prisma.transaction.updateMany({
    where: {
      id: transaction.id,
      type: 'deposit',
      // Phase 3 must be able to recover legacy false Failed/Cancelled rows.
      // Completed is deliberately excluded, so a concurrent credit remains
      // terminal and cannot be overwritten by a later provider response.
      status: { in: FLUTTERWAVE_FINALIZABLE_STATUSES },
    },
    data,
  });

  return changed.count > 0 ? { ...transaction, ...data } : transaction;
}

async function findFlutterwaveDeposit({ transaction, reference, userId }) {
  if (transaction) return transaction;
  if (!reference) return null;

  return prisma.transaction.findFirst({
    where: {
      reference,
      type: 'deposit',
      ...(userId ? { userId } : {}),
      OR: [{ method: 'flutterwave' }, { method: null }],
    },
  });
}

export async function getFlutterwaveSecretKey() {
  const setting = await prisma.setting.findUnique({ where: { key: 'gateway_flutterwave' } });
  if (setting) {
    try {
      const parsed = JSON.parse(setting.value);
      const secretKey = parsed?.fields?.secretKey;
      if (typeof secretKey === 'string' && secretKey.trim()) return secretKey.trim();
    } catch (error) {
      log.warn('Flutterwave Config', `Invalid gateway setting: ${error.message}`);
    }
  }
  return process.env.FLUTTERWAVE_SECRET_KEY?.trim() || '';
}

export async function reconcileFlutterwaveDeposit({
  transaction,
  reference,
  userId,
  secretKey,
  recoveredBy,
  fetchImpl,
  timeoutMs,
  deferLeaseRelease = false,
  preAcquiredLease,
} = {}) {
  let deposit = await findFlutterwaveDeposit({ transaction, reference, userId });
  if (
    !deposit
    || deposit.type !== 'deposit'
    || (userId && deposit.userId !== userId)
    || (deposit.method && deposit.method !== 'flutterwave')
  ) {
    return outcomeForTransaction(null);
  }

  // Callers may pass a transaction selected before a competing webhook or
  // verifier completed it. When a pre-acquired lease is provided (cron path),
  // the post-lease freshness check below covers this; skip the extra round-trip.
  if (!preAcquiredLease) {
    deposit = await authoritativeTransaction(deposit.id);
    if (
      !deposit
      || deposit.type !== 'deposit'
      || (userId && deposit.userId !== userId)
      || (deposit.method && deposit.method !== 'flutterwave')
    ) {
      return outcomeForTransaction(null);
    }
  }

  if (deposit.status === 'Completed') {
    return outcomeForTransaction(deposit, { reason: 'already_completed' });
  }

  const effectiveTimeoutMs = Number.isFinite(timeoutMs)
    ? Math.max(1, timeoutMs)
    : DEFAULT_PROVIDER_TIMEOUT_MS;
  const lease = preAcquiredLease || await acquireProviderQueryLease({
    provider: 'flutterwave',
    resourceId: deposit.id,
    userId: deposit.userId,
    leaseMs: Math.max(
      MIN_PROVIDER_LEASE_MS,
      effectiveTimeoutMs + PROVIDER_LEASE_BUFFER_MS,
    ),
  });

  if (!lease.acquired) {
    const current = await authoritativeTransaction(deposit.id);
    if (!current) return outcomeForTransaction(null);
    if (current.status === 'Completed') {
      return outcomeForTransaction(current, { reason: 'already_completed' });
    }
    return outcomeForTransaction(current, {
      paymentState: PAYMENT_STATES.VERIFYING,
      retryable: true,
      reason: 'verification_in_progress',
      message: messageForPaymentState(PAYMENT_STATES.VERIFYING),
    });
  }

  let result;
  try {
    // Re-read after acquiring the lease as well: completion can interleave
    // between the first authoritative read and lease acquisition.
    const currentBeforeQuery = await authoritativeTransaction(deposit.id);
    if (!currentBeforeQuery) { result = outcomeForTransaction(null); return result; }
    deposit = currentBeforeQuery;
    if (deposit.status === 'Completed') {
      result = outcomeForTransaction(deposit, { reason: 'already_completed' });
      return result;
    }

    const resolvedSecretKey = secretKey === undefined
      ? await getFlutterwaveSecretKey()
      : secretKey;
    const verification = await verifyFlutterwaveTransaction({
      reference: deposit.reference,
      // A foreign-currency charge (International Nitro step 3) is verified
      // against the quote stored at initialise — the cedi/shilling figure and
      // its currency — while deposit.amount stays the naira to credit.
      expectedAmountKobo: (deposit.providerPriceCurrency && deposit.providerPriceCurrency !== 'NGN')
        ? Math.round(Number(deposit.providerPriceAmount) * 100)
        : deposit.amount,
      expectedCurrency: deposit.providerPriceCurrency || 'NGN',
      secretKey: resolvedSecretKey,
      fetchImpl,
      timeoutMs: effectiveTimeoutMs,
    });

    // A request that outlived its lease must not apply a stale provider
    // response after another worker has taken over. Renewal is an atomic
    // ownership fence and covers the short status/finalization step below.
    const ownsResult = await renewProviderQueryLease(lease, {
      leaseMs: RESULT_APPLICATION_LEASE_MS,
    });
    if (!ownsResult) {
      const current = await authoritativeTransaction(deposit.id);
      result = outcomeForTransaction(current, {
        reason: current ? 'verification_lease_lost' : 'not_found',
      });
      return result;
    }

    if (verification.state === 'provider_pending') {
      const ageMs = Date.now() - new Date(deposit.createdAt).getTime();
      if (ageMs > 60 * 60 * 1000) {
        const current = await transitionUnsettled(deposit, 'Expired', {
          reason: 'abandoned',
          includeFailureNote: true,
          stampProviderResponse: true,
        });
        result = outcomeForTransaction(current, {
          reason: 'abandoned',
          providerStatus: verification.providerStatus,
          message: 'Payment not yet confirmed by provider',
        });
        return result;
      }
      const current = await transitionUnsettled(deposit, 'Pending');
      result = outcomeForTransaction(current, {
        reason: 'provider_pending',
        providerStatus: verification.providerStatus,
        message: messageForPaymentState(paymentStateFromTransactionStatus(current.status), 'provider_pending'),
      });
      return result;
    }

    if (verification.state === 'retryable') {
      const current = await transitionUnsettled(deposit, 'Expired');
      const paymentState = paymentStateFromTransactionStatus(current.status);
      result = outcomeForTransaction(current, {
        reason: verification.reason,
        httpStatus: verification.httpStatus,
        message: messageForPaymentState(paymentState, verification.reason),
      });
      return result;
    }

    if (verification.state === 'failed') {
      // provider_not_found is not a failure — it is Flutterwave saying no
      // transaction with this tx_ref exists, which means the customer never
      // finished checkout. For a month that verdict was written as Failed and
      // the dashboard read a 40% failure rate that was really 0.9%: 526 of 533
      // "failures" were this, half of them followed by the same person
      // completing the same deposit within the hour. Abandonment now lands as
      // Expired (still webhook-recoverable, like every non-Completed status);
      // Failed is reserved for a decline the provider actually issued.
      if (verification.reason === 'provider_not_found') {
        const current = await transitionUnsettled(deposit, 'Expired', {
          reason: 'abandoned',
          includeFailureNote: true,
          stampProviderResponse: true,
        });
        result = outcomeForTransaction(current, {
          reason: 'abandoned',
          httpStatus: verification.httpStatus,
          message: messageForPaymentState(paymentStateFromTransactionStatus(current.status), 'abandoned'),
        });
        return result;
      }
      // A mismatch used to be written as Failed, which buried it: the sweep
      // re-verified the row to the same verdict every pass and nobody was
      // told, while the payment sat in our Flutterwave balance uncredited.
      // It goes to Review — outside every sweep bucket, so it is read once —
      // and raises an alert carrying both figures, for a human to credit what
      // actually arrived from the users drawer.
      if (MISMATCH_REASONS.has(verification.reason)) {
        const current = await transitionUnsettled(deposit, 'Review', {
          reason: verification.reason,
          includeFailureNote: true,
          stampProviderResponse: true,
          // The figures the alert already carried, kept where a human can act
          // on them without opening Sentry.
          evidence: verification,
        });
        reportOperationalFailure('deposit_paid_mismatch', {
          level: 'error',
          data: {
            reference: deposit.reference,
            reason: verification.reason,
            expectedAmountKobo: verification.expectedAmountKobo ?? null,
            paidAmountKobo: verification.paidAmountKobo ?? null,
            expectedCurrency: verification.expectedCurrency ?? null,
            providerCurrency: verification.providerCurrency ?? null,
            underpaid: verification.underpaid === true,
          },
          dedupeKey: `deposit_paid_mismatch:${String(deposit.reference || deposit.id).toLowerCase()}`,
          throttleMs: 24 * 60 * 60 * 1000,
        });
        result = outcomeForTransaction(current, {
          reason: verification.reason,
          paidAmountKobo: verification.paidAmountKobo,
          expectedAmountKobo: verification.expectedAmountKobo,
          message: messageForPaymentState(PAYMENT_STATES.REVIEW, verification.reason),
        });
        return result;
      }
      const current = await transitionUnsettled(deposit, 'Failed', {
        reason: verification.reason,
        includeFailureNote: true,
        stampProviderResponse: true,
      });
      const paymentState = paymentStateFromTransactionStatus(current.status);
      result = outcomeForTransaction(current, {
        reason: verification.reason,
        paidAmountKobo: verification.paidAmountKobo,
        expectedAmountKobo: verification.expectedAmountKobo,
        message: messageForPaymentState(paymentState, verification.reason),
      });
      return result;
    }

    try {
      const finalization = await finalizeDeposit({
        transactionId: deposit.id,
        userId: deposit.userId,
        // Credit the naira fixed at initialise, never the foreign minor units
        // the provider reports. For a naira charge the two are the same
        // number — verification has already refused any amount mismatch.
        paidAmountKobo: deposit.amount,
        claimableStatuses: FLUTTERWAVE_FINALIZABLE_STATUSES,
        recoveredBy,
      });
      const current = finalization.transaction || await latestTransaction(deposit.id, deposit);
      const completed = current?.status === 'Completed';
      if (completed && verification.providerTransactionId != null) {
        // The classifier has always returned Flutterwave's numeric id; until
        // now it was dropped on the floor, which is why the provider_not_found
        // diagnosis had no provider-side identifier to discriminate on.
        await prisma.transaction.updateMany({
          where: { id: deposit.id, providerPaymentId: null },
          data: {
            providerPaymentId: String(verification.providerTransactionId),
            providerLastVerifiedAt: new Date(),
          },
        }).catch((error) => log.warn('Flutterwave Verification', `provider id stamp failed: ${error.message}`));
      }
      const newlyFinalized = Boolean(finalization.finalized && completed);

      result = outcomeForTransaction(current, {
        finalization,
        newlyFinalized,
        reason: finalization.reason,
        message: completed
          ? (newlyFinalized ? 'Payment successful' : 'Already credited')
          : messageForPaymentState(paymentStateFromTransactionStatus(current?.status), finalization.reason),
      });
      return result;
    } catch (error) {
      log.error('Flutterwave Finalization', error.message);
      const current = await transitionUnsettled(deposit, 'Expired');
      const paymentState = paymentStateFromTransactionStatus(current.status);
      result = outcomeForTransaction(current, {
        reason: 'finalization_retryable',
        message: messageForPaymentState(paymentState, 'finalization_retryable'),
      });
      return result;
    }
  } finally {
    if (deferLeaseRelease) {
      if (result) result._lease = lease;
    } else {
      try {
        await releaseProviderQueryLease(lease);
      } catch (error) {
        log.warn('Flutterwave Verification Lease', error.message);
      }
    }
  }
}
