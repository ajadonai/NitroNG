import prisma from '@/lib/prisma';
import { log } from '@/lib/logger';
import { finalizeDeposit } from '@/lib/deposit-finalization';
import { verifyFlutterwaveTransaction } from '@/lib/flutterwave-verification';
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
    return reason === 'missing_configuration'
      ? 'Payment verification is temporarily unavailable. Please try again.'
      : 'Flutterwave could not be reached. Please try again.';
  }
  return 'Payment verification failed';
}

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

async function latestTransaction(id, fallback) {
  return prisma.transaction.findUnique({ where: { id } }).catch(() => fallback);
}

async function authoritativeTransaction(id) {
  return prisma.transaction.findUnique({ where: { id } });
}

async function transitionUnsettled(transaction, status, { reason, includeFailureNote = false } = {}) {
  // Provider I/O can overlap an admin/manual finalization, which does not use
  // this provider-query lease. Never return the pre-I/O snapshot merely because
  // it already had the desired status.
  const authoritative = await authoritativeTransaction(transaction.id);
  if (!authoritative) return transaction;
  transaction = authoritative;
  if (transaction.status === status && !includeFailureNote) return transaction;

  const data = {
    status,
    ...(includeFailureNote ? { note: failureNote(transaction.note, reason) } : {}),
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

  const fallback = changed.count > 0 ? { ...transaction, ...data } : transaction;
  return authoritativeTransaction(transaction.id).then(current => current || fallback);
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
  // verifier completed it. Always replace that snapshot with the current row
  // before deciding whether provider I/O is necessary.
  deposit = await authoritativeTransaction(deposit.id);
  if (
    !deposit
    || deposit.type !== 'deposit'
    || (userId && deposit.userId !== userId)
    || (deposit.method && deposit.method !== 'flutterwave')
  ) {
    return outcomeForTransaction(null);
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
      expectedAmountKobo: deposit.amount,
      expectedCurrency: 'NGN',
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
      const current = await transitionUnsettled(deposit, 'Failed', {
        reason: verification.reason,
        includeFailureNote: true,
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
        paidAmountKobo: verification.paidAmountKobo,
        claimableStatuses: FLUTTERWAVE_FINALIZABLE_STATUSES,
        recoveredBy,
      });
      const current = finalization.transaction || await latestTransaction(deposit.id, deposit);
      const completed = current?.status === 'Completed';
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
