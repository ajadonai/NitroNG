import { createHash } from 'node:crypto';
import prisma from '@/lib/prisma';
import { log } from '@/lib/logger';
import { finalizeDeposit } from '@/lib/deposit-finalization';
import {
  canonicalizeNonNegativeDecimal,
  classifyNowPaymentsStatusResponse,
  fetchNowPaymentsPayment,
  normalizeNowPaymentsProviderId,
} from '@/lib/nowpayments-verification';
import {
  acquireProviderQueryLease,
  releaseProviderQueryLease,
  renewProviderQueryLease,
} from '@/lib/provider-query-lease';
import {
  isRetryablePaymentState,
  PAYMENT_STATES,
  paymentStateFromTransactionStatus,
} from '@/lib/payment-state';

const DEFAULT_PROVIDER_TIMEOUT_MS = 15_000;
const PROVIDER_LEASE_BUFFER_MS = 15_000;
const MIN_PROVIDER_LEASE_MS = 30_000;
const RESULT_APPLICATION_LEASE_MS = 45_000;
const REVIEW_ISSUE_TYPE = 'crypto_payment_review';

export const NOWPAYMENTS_FINALIZABLE_STATUSES = Object.freeze([
  'Pending',
  'Processing',
  'Expired',
  'Failed',
  'Cancelled',
]);

export const NOWPAYMENTS_RECONCILABLE_STATUSES = Object.freeze([
  ...NOWPAYMENTS_FINALIZABLE_STATUSES,
  'Review',
  'Rejected',
  'Refunded',
]);

const TRUSTED_REVIEW_REASONS = new Set([
  'underpayment',
  'overpayment',
  'partially_paid',
  'missing_actual_amount',
]);

function cleanAuditValue(value) {
  return String(value ?? '')
    .replace(/[\[\]\r\n]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function isUniqueConstraintError(error) {
  return error?.code === 'P2002';
}

export function legacyNowPaymentsPaymentId(note) {
  return normalizeNowPaymentsProviderId(
    String(note || '').match(/\[np:([^\]\s]+)\]/)?.[1],
  );
}

export function legacyNowPaymentsPriceAmount(note) {
  return canonicalizeNonNegativeDecimal(
    String(note || '').match(/\(\$([0-9]+(?:\.[0-9]+)?) USDT\)/)?.[1],
  );
}

function hasOpenPaymentReview(transaction) {
  return Boolean(
    transaction?.paymentReviewReason
    && !transaction?.paymentReviewResolvedAt,
  );
}

function stateForTransaction(transaction) {
  if (hasOpenPaymentReview(transaction)) return PAYMENT_STATES.REVIEW;
  return paymentStateFromTransactionStatus(transaction?.status);
}

function messageForState(paymentState, reason) {
  if (paymentState === PAYMENT_STATES.CREDITED) return 'Payment successful';
  if (paymentState === PAYMENT_STATES.VERIFYING) return 'Payment verification is already in progress';
  if (paymentState === PAYMENT_STATES.PROVIDER_PENDING) return 'NOWPayments has not confirmed this payment yet';
  if (paymentState === PAYMENT_STATES.RETRYABLE) return 'Payment verification is temporarily unavailable. Please try again.';
  if (paymentState === PAYMENT_STATES.REVIEW) {
    if (reason === 'underpayment' || reason === 'partially_paid') {
      return 'A partial payment was detected and is awaiting manual review.';
    }
    if (reason === 'overpayment') {
      return 'An overpayment was detected and is awaiting manual review.';
    }
    if (reason === 'refunded_after_credit' || reason === 'refunded') {
      return 'This payment was refunded and is awaiting account review.';
    }
    return 'This payment needs manual review before it can be credited.';
  }
  if (reason === 'refunded') return 'This payment was refunded';
  return 'Payment was not completed';
}

function outcomeForTransaction(transaction, overrides = {}) {
  if (!transaction) {
    return {
      success: false,
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

  const preservesUnprocessedObservation = [
    PAYMENT_STATES.VERIFYING,
    PAYMENT_STATES.RETRYABLE,
  ].includes(overrides.paymentState);
  const manuallyClosed = transaction.status === 'Rejected'
    && !hasOpenPaymentReview(transaction)
    && !preservesUnprocessedObservation;
  const reviewOverrideWasAlreadyClosed = overrides.paymentState === PAYMENT_STATES.REVIEW
    && !hasOpenPaymentReview(transaction);
  const effectiveOverrides = manuallyClosed
    ? {
      ...overrides,
      paymentState: PAYMENT_STATES.FAILED,
      retryable: false,
      reason: 'manual_review_closed',
      message: 'This payment review was closed without automatic wallet credit.',
    }
    : reviewOverrideWasAlreadyClosed
      ? { ...overrides, paymentState: stateForTransaction(transaction) }
      : overrides;
  const paymentState = effectiveOverrides.paymentState || stateForTransaction(transaction);
  const reason = effectiveOverrides.reason ?? transaction.paymentReviewReason ?? null;
  const success = paymentState === PAYMENT_STATES.CREDITED
    && transaction.status === 'Completed'
    && !hasOpenPaymentReview(transaction);

  return {
    success,
    paymentState,
    transactionStatus: transaction.status,
    retryable: isRetryablePaymentState(paymentState),
    transaction,
    finalization: null,
    newlyFinalized: false,
    reason,
    message: messageForState(paymentState, reason),
    ...effectiveOverrides,
  };
}

async function authoritativeTransaction(id) {
  return prisma.transaction.findUnique({ where: { id } });
}

async function markReconciliationAttempt(transaction, now) {
  return prisma.transaction.update({
    where: { id: transaction.id },
    data: { paymentReconciliationAttemptAt: now },
  });
}

async function findCryptoDeposit({ transaction, reference, providerPaymentId, userId }) {
  if (transaction) return transaction;

  if (reference) {
    return prisma.transaction.findFirst({
      where: {
        reference,
        type: 'deposit',
        method: 'crypto',
        ...(userId ? { userId } : {}),
      },
    });
  }

  const normalizedPaymentId = normalizeNowPaymentsProviderId(providerPaymentId);
  if (!normalizedPaymentId) return null;
  return prisma.transaction.findFirst({
    where: {
      providerPaymentId: normalizedPaymentId,
      type: 'deposit',
      method: 'crypto',
      ...(userId ? { userId } : {}),
    },
  });
}

export function nowPaymentsExpectedTerms(transaction, observedPaymentId) {
  const durablePaymentId = normalizeNowPaymentsProviderId(transaction?.providerPaymentId);
  const legacyPaymentId = legacyNowPaymentsPaymentId(transaction?.note);
  const storedPaymentId = durablePaymentId || legacyPaymentId;
  const observed = normalizeNowPaymentsProviderId(observedPaymentId);
  const priceAmount = canonicalizeNonNegativeDecimal(transaction?.providerPriceAmount)
    || legacyNowPaymentsPriceAmount(transaction?.note);
  const payAmount = canonicalizeNonNegativeDecimal(transaction?.providerPayAmount);

  return {
    storedPaymentId,
    queryPaymentId: observed || storedPaymentId,
    paymentId: storedPaymentId || observed,
    reference: transaction?.reference || null,
    expectedPriceAmount: priceAmount,
    expectedPriceCurrency: String(
      transaction?.providerPriceCurrency || (priceAmount ? 'usd' : ''),
    ).trim().toLowerCase() || null,
    expectedPayAmount: payAmount,
    expectedPayCurrency: String(
      transaction?.providerPayCurrency || (storedPaymentId || observed ? 'usdttrc20' : ''),
    ).trim().toLowerCase() || null,
    adoptsObservedPaymentId: !durablePaymentId && Boolean(observed || storedPaymentId),
  };
}

export async function getNowPaymentsApiKey() {
  const setting = await prisma.setting.findUnique({ where: { key: 'gateway_crypto' } });
  if (setting) {
    try {
      const parsed = JSON.parse(setting.value);
      const apiKey = parsed?.fields?.apiKey;
      if (typeof apiKey === 'string' && apiKey.trim()) return apiKey.trim();
    } catch (error) {
      log.warn('NOWPayments Config', `Invalid gateway setting: ${error.message}`);
    }
  }
  return process.env.NOWPAYMENTS_API_KEY?.trim() || '';
}

export async function getNowPaymentsCreationApiKey() {
  const setting = await prisma.setting.findUnique({ where: { key: 'gateway_crypto' } });
  if (!setting) return '';

  try {
    const parsed = JSON.parse(setting.value);
    if (parsed?.enabled !== true) return '';
    const configuredKey = parsed?.fields?.apiKey;
    if (typeof configuredKey === 'string' && configuredKey.trim()) {
      return configuredKey.trim();
    }
    return process.env.NOWPAYMENTS_API_KEY?.trim() || '';
  } catch (error) {
    log.warn('NOWPayments Config', `Invalid gateway setting: ${error.message}`);
    return '';
  }
}

function reviewFingerprint(transaction, reason, details) {
  const observation = {
    transactionId: transaction.id,
    reason,
    observedPaymentId: normalizeNowPaymentsProviderId(
      details?.observedPaymentId
      || details?.providerPaymentId
      || transaction.providerPaymentId
      || legacyNowPaymentsPaymentId(transaction.note),
    ),
    providerStatus: cleanAuditValue(details?.providerStatus).toLowerCase() || null,
    observedReference: cleanAuditValue(details?.observedReference) || null,
    priceAmount: canonicalizeNonNegativeDecimal(details?.priceAmount),
    priceCurrency: cleanAuditValue(details?.priceCurrency).toLowerCase() || null,
    payAmount: canonicalizeNonNegativeDecimal(details?.payAmount),
    payCurrency: cleanAuditValue(details?.payCurrency).toLowerCase() || null,
    actuallyPaid: canonicalizeNonNegativeDecimal(
      details?.actuallyPaid ?? details?.providerActuallyPaid,
    ),
    validationReason: cleanAuditValue(details?.validationReason) || null,
  };
  return createHash('sha256').update(JSON.stringify(observation)).digest('hex');
}

function reviewMetadata(transaction, reason, details, fingerprint) {
  return JSON.stringify({
    ...details,
    transactionId: transaction.id,
    reference: transaction.reference,
    userId: transaction.userId,
    providerPaymentId: transaction.providerPaymentId
      || legacyNowPaymentsPaymentId(transaction.note)
      || normalizeNowPaymentsProviderId(details?.providerPaymentId)
      || normalizeNowPaymentsProviderId(details?.observedPaymentId),
    reason,
    reviewFingerprint: fingerprint,
  }, (_key, value) => (typeof value === 'bigint' ? value.toString() : value));
}

function reviewMessage(transaction, reason, details) {
  const expected = details?.expectedPayAmount || transaction.providerPayAmount;
  const actual = details?.actuallyPaid || details?.providerActuallyPaid;
  const amounts = expected || actual
    ? ` Expected ${expected ?? 'unknown'} ${transaction.providerPayCurrency || 'crypto'}; received ${actual ?? 'unknown'}.`
    : '';
  const completed = transaction.status === 'Completed'
    ? ' The wallet was already credited; manual recovery is required.'
    : ' No wallet credit was applied.';
  return `Crypto payment ${transaction.reference || transaction.id} requires review (${reason}).${amounts}${completed}`;
}

export async function recordNowPaymentsReview({
  transaction,
  reason,
  details = {},
  now = new Date(),
} = {}) {
  if (!transaction?.id || !reason) {
    throw new TypeError('Transaction and review reason are required');
  }

  const safeReason = cleanAuditValue(reason) || 'unspecified';
  const title = `Crypto payment review: ${safeReason}`;

  return prisma.$transaction(async db => {
    let current = await db.transaction.findUnique({ where: { id: transaction.id } });
    if (!current || current.type !== 'deposit' || current.method !== 'crypto') {
      throw new Error('Crypto deposit no longer exists');
    }

    const fingerprint = reviewFingerprint(current, safeReason, details);
    const fingerprintNeedle = `\"reviewFingerprint\":\"${fingerprint}\"`;
    const existingObservation = await db.adminIssue.findFirst({
      where: {
        type: REVIEW_ISSUE_TYPE,
        metadata: { contains: fingerprintNeedle },
      },
    });
    if (existingObservation) {
      return current;
    }

    const reviewFields = {
      paymentReviewFingerprint: fingerprint,
      paymentReviewReason: safeReason,
      paymentReviewAt: now,
      paymentReviewResolvedAt: null,
    };

    const changed = await db.transaction.updateMany({
      where: {
        id: current.id,
        type: 'deposit',
        method: 'crypto',
        status: current.status,
        paymentReviewFingerprint: current.paymentReviewFingerprint,
        paymentReviewReason: current.paymentReviewReason,
        paymentReviewAt: current.paymentReviewAt,
        paymentReviewResolvedAt: current.paymentReviewResolvedAt,
      },
      data: {
        ...(['Completed', 'Rejected'].includes(current.status) ? {} : { status: 'Review' }),
        ...reviewFields,
      },
    });
    if (changed.count !== 1) {
      const latest = await db.transaction.findUnique({ where: { id: transaction.id } });
      const racedObservation = await db.adminIssue.findFirst({
        where: {
          type: REVIEW_ISSUE_TYPE,
          metadata: { contains: fingerprintNeedle },
        },
      });
      if (latest && racedObservation) {
        return latest;
      }
      throw new Error('Crypto deposit changed while its payment review was being recorded');
    }
    current = await db.transaction.findUnique({ where: { id: transaction.id } });
    if (!current) throw new Error('Crypto deposit no longer exists');
    const metadata = reviewMetadata(current, safeReason, details, fingerprint);
    const message = reviewMessage(current, safeReason, details);

    await db.adminIssue.create({
      data: {
        type: REVIEW_ISSUE_TYPE,
        title,
        message,
        metadata,
      },
    });

    return current;
  }, { isolationLevel: 'Serializable' });
}

function trustedObservation(classification) {
  return classification?.state === 'verified'
    || classification?.state === 'provider_pending'
    || classification?.state === 'provider_failed'
    || classification?.state === 'refunded'
    || (
      classification?.state === 'review'
      && TRUSTED_REVIEW_REASONS.has(classification.reason)
    );
}

async function recordProviderObservation(transaction, classification, terms, now) {
  // A syntactically valid, authoritative provider response is still useful
  // reconciliation evidence even when one of its financial facts mismatches.
  // Record when it was checked, but only adopt provider values from response
  // classes whose identity and expected terms passed validation.
  if (!classification || classification.state === 'retryable') return transaction;

  const data = {
    providerLastVerifiedAt: now,
  };
  if (classification.providerStatus) {
    data.providerPaymentStatus = classification.providerStatus;
  }

  if (!trustedObservation(classification)) {
    return prisma.transaction.update({
      where: { id: transaction.id },
      data,
    });
  }

  // Pending responses often omit actually_paid. Do not erase a previously
  // observed amount while refreshing the provider status.
  if (classification.actuallyPaid !== null && classification.actuallyPaid !== undefined) {
    data.providerActuallyPaid = classification.actuallyPaid;
  }

  if (!transaction.providerPaymentId && classification.paymentId === terms.paymentId) {
    data.providerPaymentId = classification.paymentId;
  }
  if (!transaction.providerPriceAmount && classification.priceAmount) {
    data.providerPriceAmount = classification.priceAmount;
  }
  if (!transaction.providerPriceCurrency && classification.priceCurrency) {
    data.providerPriceCurrency = classification.priceCurrency;
  }
  if (!transaction.providerPayAmount && classification.payAmount) {
    data.providerPayAmount = classification.payAmount;
  }
  if (!transaction.providerPayCurrency && classification.payCurrency) {
    data.providerPayCurrency = classification.payCurrency;
  }

  return prisma.transaction.update({
    where: { id: transaction.id },
    data,
  });
}

async function transitionUncredited(transaction, status) {
  const changed = await prisma.transaction.updateMany({
    where: {
      id: transaction.id,
      type: 'deposit',
      method: 'crypto',
      status: { in: NOWPAYMENTS_RECONCILABLE_STATUSES },
    },
    data: { status },
  });
  if (changed.count === 0) return authoritativeTransaction(transaction.id);
  return authoritativeTransaction(transaction.id);
}

function reviewDetails(classification, terms) {
  return {
    providerStatus: classification.providerStatus,
    observedPaymentId: classification.paymentId,
    expectedPaymentId: terms.paymentId,
    observedReference: classification.reference,
    expectedReference: terms.reference,
    priceAmount: classification.priceAmount,
    expectedPriceAmount: terms.expectedPriceAmount,
    priceCurrency: classification.priceCurrency,
    expectedPriceCurrency: terms.expectedPriceCurrency,
    payAmount: classification.payAmount,
    expectedPayAmount: terms.expectedPayAmount || classification.payAmount,
    payCurrency: classification.payCurrency,
    expectedPayCurrency: terms.expectedPayCurrency,
    actuallyPaid: classification.actuallyPaid,
  };
}

export async function reconcileNowPaymentsDeposit({
  transaction,
  reference,
  providerPaymentId,
  userId,
  apiKey,
  fetchImpl,
  timeoutMs,
  recoveredBy,
  auditCompleted = false,
  auditRejected = false,
  now = new Date(),
} = {}) {
  let deposit = await findCryptoDeposit({
    transaction,
    reference,
    providerPaymentId,
    userId,
  });
  if (
    !deposit
    || deposit.type !== 'deposit'
    || deposit.method !== 'crypto'
    || (userId && deposit.userId !== userId)
  ) {
    return outcomeForTransaction(null);
  }

  deposit = await authoritativeTransaction(deposit.id);
  if (
    !deposit
    || deposit.type !== 'deposit'
    || deposit.method !== 'crypto'
    || (userId && deposit.userId !== userId)
  ) {
    return outcomeForTransaction(null);
  }

  if (deposit.status === 'Rejected' && !providerPaymentId && !auditRejected) {
    return outcomeForTransaction(deposit);
  }

  if (deposit.status === 'Completed' && !auditCompleted && !providerPaymentId) {
    return outcomeForTransaction(deposit, {
      reason: hasOpenPaymentReview(deposit) ? deposit.paymentReviewReason : 'already_completed',
    });
  }

  let terms = nowPaymentsExpectedTerms(deposit, providerPaymentId);
  if (!terms.queryPaymentId) {
    deposit = await markReconciliationAttempt(deposit, now);
    const reviewed = await recordNowPaymentsReview({
      transaction: deposit,
      reason: 'missing_provider_payment_id',
      now,
    });
    return outcomeForTransaction(reviewed, { paymentState: PAYMENT_STATES.REVIEW });
  }
  if (
    !terms.reference
    || !terms.expectedPriceAmount
    || !terms.expectedPriceCurrency
    || !terms.expectedPayCurrency
  ) {
    deposit = await markReconciliationAttempt(deposit, now);
    const reviewed = await recordNowPaymentsReview({
      transaction: deposit,
      reason: 'missing_expected_terms',
      details: { providerPaymentId: terms.queryPaymentId },
      now,
    });
    return outcomeForTransaction(reviewed, { paymentState: PAYMENT_STATES.REVIEW });
  }

  if (terms.adoptsObservedPaymentId) {
    const alreadyBound = await prisma.transaction.findFirst({
      where: {
        id: { not: deposit.id },
        method: 'crypto',
        providerPaymentId: terms.queryPaymentId,
      },
    });
    if (alreadyBound) {
      deposit = await markReconciliationAttempt(deposit, now);
      const reviewed = await recordNowPaymentsReview({
        transaction: deposit,
        reason: 'provider_payment_id_reused',
        details: {
          providerPaymentId: terms.queryPaymentId,
          existingTransactionId: alreadyBound.id,
        },
        now,
      });
      return outcomeForTransaction(reviewed, { paymentState: PAYMENT_STATES.REVIEW });
    }
  }

  const effectiveTimeoutMs = Number.isFinite(timeoutMs)
    ? Math.max(1, timeoutMs)
    : DEFAULT_PROVIDER_TIMEOUT_MS;
  const lease = await acquireProviderQueryLease({
    provider: 'nowpayments',
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
    if (providerPaymentId) {
      // A callback-supplied provider ID may identify a repeated child payment
      // that is not recoverable by querying the stored parent later. Keep the
      // callback retrying until this exact observation obtains the lease.
      return outcomeForTransaction(current, {
        paymentState: PAYMENT_STATES.VERIFYING,
        retryable: true,
        reason: 'verification_in_progress',
        message: messageForState(PAYMENT_STATES.VERIFYING),
      });
    }
    if (current.status === 'Completed' || hasOpenPaymentReview(current)) {
      return outcomeForTransaction(current);
    }
    return outcomeForTransaction(current, {
      paymentState: PAYMENT_STATES.VERIFYING,
      retryable: true,
      reason: 'verification_in_progress',
      message: messageForState(PAYMENT_STATES.VERIFYING),
    });
  }

  try {
    const currentBeforeQuery = await authoritativeTransaction(deposit.id);
    if (!currentBeforeQuery) return outcomeForTransaction(null);
    deposit = currentBeforeQuery;
    if (deposit.status === 'Rejected' && !providerPaymentId && !auditRejected) {
      return outcomeForTransaction(deposit);
    }
    if (deposit.status === 'Completed' && !auditCompleted && !providerPaymentId) {
      return outcomeForTransaction(deposit, { reason: 'already_completed' });
    }

    deposit = await markReconciliationAttempt(deposit, now);

    const resolvedApiKey = apiKey === undefined ? await getNowPaymentsApiKey() : apiKey;
    const providerResult = await fetchNowPaymentsPayment({
      paymentId: terms.queryPaymentId,
      apiKey: resolvedApiKey,
      fetchImpl,
      timeoutMs: effectiveTimeoutMs,
    });

    const ownsResult = await renewProviderQueryLease(lease, {
      leaseMs: RESULT_APPLICATION_LEASE_MS,
    });
    if (!ownsResult) {
      const current = await authoritativeTransaction(deposit.id);
      if (providerPaymentId) {
        return outcomeForTransaction(current, {
          paymentState: current ? PAYMENT_STATES.VERIFYING : PAYMENT_STATES.FAILED,
          retryable: Boolean(current),
          reason: current ? 'verification_lease_lost' : 'not_found',
          message: current
            ? messageForState(PAYMENT_STATES.VERIFYING)
            : 'Transaction not found',
        });
      }
      return outcomeForTransaction(current, {
        paymentState: current ? stateForTransaction(current) : PAYMENT_STATES.FAILED,
        reason: current ? 'verification_lease_lost' : 'not_found',
      });
    }

    if (providerResult.state !== 'received') {
      return outcomeForTransaction(await authoritativeTransaction(deposit.id), {
        paymentState: PAYMENT_STATES.RETRYABLE,
        retryable: true,
        reason: providerResult.reason,
        httpStatus: providerResult.httpStatus,
        message: messageForState(PAYMENT_STATES.RETRYABLE, providerResult.reason),
      });
    }

    // Creation response handling and webhook reconciliation can overlap. Bind
    // provider identity and quoted terms first-write-wins: re-read after the
    // network call and classify against the latest durable values so a stale
    // worker can never overwrite or validate a different provider payment.
    const currentBeforeApply = await authoritativeTransaction(deposit.id);
    if (!currentBeforeApply) return outcomeForTransaction(null);
    deposit = currentBeforeApply;
    if (deposit.status === 'Rejected' && !providerPaymentId && !auditRejected) {
      return outcomeForTransaction(deposit);
    }
    terms = nowPaymentsExpectedTerms(deposit, providerPaymentId);

    const classification = classifyNowPaymentsStatusResponse(providerResult.payload, {
      reference: terms.reference,
      paymentId: terms.paymentId,
      expectedPriceAmount: terms.expectedPriceAmount,
      expectedPriceCurrency: terms.expectedPriceCurrency,
      expectedPayAmount: terms.expectedPayAmount,
      expectedPayCurrency: terms.expectedPayCurrency,
    });

    try {
      deposit = await recordProviderObservation(deposit, classification, terms, now);
    } catch (error) {
      if (!isUniqueConstraintError(error)) throw error;
      const current = await authoritativeTransaction(deposit.id);
      const reviewed = await recordNowPaymentsReview({
        transaction: current || deposit,
        reason: 'provider_payment_id_reused',
        details: {
          ...reviewDetails(classification, terms),
          providerPaymentId: terms.queryPaymentId,
        },
        now,
      });
      return outcomeForTransaction(reviewed, {
        paymentState: PAYMENT_STATES.REVIEW,
        retryable: false,
        providerStatus: classification.providerStatus,
      });
    }

    if (classification.state === 'retryable') {
      return outcomeForTransaction(deposit, {
        paymentState: PAYMENT_STATES.RETRYABLE,
        retryable: true,
        reason: classification.reason,
        providerStatus: classification.providerStatus,
        message: messageForState(PAYMENT_STATES.RETRYABLE, classification.reason),
      });
    }

    if (classification.state === 'review') {
      const reviewed = await recordNowPaymentsReview({
        transaction: deposit,
        reason: classification.reason || 'provider_integrity_mismatch',
        details: reviewDetails(classification, terms),
        now,
      });
      return outcomeForTransaction(reviewed, {
        paymentState: PAYMENT_STATES.REVIEW,
        retryable: false,
        providerStatus: classification.providerStatus,
      });
    }

    if (classification.state === 'refunded') {
      if (deposit.status === 'Completed') {
        const reviewed = await recordNowPaymentsReview({
          transaction: deposit,
          reason: 'refunded_after_credit',
          details: reviewDetails(classification, terms),
          now,
        });
        return outcomeForTransaction(reviewed, {
          paymentState: PAYMENT_STATES.REVIEW,
          retryable: false,
          providerStatus: classification.providerStatus,
        });
      }
      if (deposit.status === 'Rejected') {
        if (hasOpenPaymentReview(deposit)) {
          const reviewed = await recordNowPaymentsReview({
            transaction: deposit,
            reason: 'provider_refunded_during_review',
            details: reviewDetails(classification, terms),
            now,
          });
          return outcomeForTransaction(reviewed, {
            paymentState: PAYMENT_STATES.REVIEW,
            retryable: false,
            providerStatus: classification.providerStatus,
          });
        }
        return outcomeForTransaction(deposit, {
          providerStatus: classification.providerStatus,
        });
      }

      if (hasOpenPaymentReview(deposit)) {
        const reviewed = await recordNowPaymentsReview({
          transaction: deposit,
          reason: 'provider_refunded_during_review',
          details: reviewDetails(classification, terms),
          now,
        });
        return outcomeForTransaction(reviewed, {
          paymentState: PAYMENT_STATES.REVIEW,
          retryable: false,
          providerStatus: classification.providerStatus,
        });
      }
      const current = await transitionUncredited(deposit, 'Refunded');
      return outcomeForTransaction(current, {
        paymentState: PAYMENT_STATES.FAILED,
        retryable: false,
        reason: 'refunded',
        providerStatus: classification.providerStatus,
        message: messageForState(PAYMENT_STATES.FAILED, 'refunded'),
      });
    }

    if (classification.state === 'provider_failed') {
      if (deposit.status === 'Completed') {
        const reviewed = await recordNowPaymentsReview({
          transaction: deposit,
          reason: 'provider_terminal_after_credit',
          details: reviewDetails(classification, terms),
          now,
        });
        return outcomeForTransaction(reviewed, {
          paymentState: PAYMENT_STATES.REVIEW,
          retryable: false,
          providerStatus: classification.providerStatus,
        });
      }
      if (hasOpenPaymentReview(deposit)) {
        const reviewed = await recordNowPaymentsReview({
          transaction: deposit,
          reason: 'provider_terminal_during_review',
          details: reviewDetails(classification, terms),
          now,
        });
        return outcomeForTransaction(reviewed, {
          paymentState: PAYMENT_STATES.REVIEW,
          retryable: false,
          providerStatus: classification.providerStatus,
        });
      }
      if (deposit.status === 'Rejected') {
        return outcomeForTransaction(deposit, {
          providerStatus: classification.providerStatus,
        });
      }

      const terminalStatus = classification.providerStatus === 'expired'
        ? 'Expired'
        : classification.providerStatus === 'cancelled'
          ? 'Cancelled'
          : 'Failed';
      const current = await transitionUncredited(deposit, terminalStatus);
      return outcomeForTransaction(current, {
        reason: classification.reason,
        providerStatus: classification.providerStatus,
      });
    }

    if (classification.state === 'provider_pending') {
      let current = deposit;
      if (!['Cancelled', 'Refunded', 'Review', 'Rejected'].includes(deposit.status)) {
        current = await transitionUncredited(deposit, 'Pending');
      }
      return outcomeForTransaction(current, {
        reason: 'provider_pending',
        providerStatus: classification.providerStatus,
      });
    }

    if (hasOpenPaymentReview(deposit)) {
      // Every provider-integrity review is a manual decision. A later exact
      // response may add evidence, but it must never silently erase an
      // underpayment, overpayment, repeated-payment, identity, asset, refund,
      // or other anomaly and credit the wallet.
      const alreadyVerifiedReview = [
        'provider_verified_after_refund',
        'provider_verified_after_rejection',
        'provider_verified_during_review',
      ].includes(deposit.paymentReviewReason);
      const reviewed = await recordNowPaymentsReview({
        transaction: deposit,
        reason: alreadyVerifiedReview
          ? deposit.paymentReviewReason
          : 'provider_verified_during_review',
        details: reviewDetails(classification, terms),
        now,
      });
      return outcomeForTransaction(reviewed, {
        paymentState: PAYMENT_STATES.REVIEW,
        providerStatus: classification.providerStatus,
      });
    }

    if (deposit.status === 'Completed') {
      return outcomeForTransaction(deposit, {
        reason: 'already_completed',
        providerStatus: classification.providerStatus,
      });
    }

    if (deposit.status === 'Refunded') {
      const reviewed = await recordNowPaymentsReview({
        transaction: deposit,
        reason: 'provider_verified_after_refund',
        details: reviewDetails(classification, terms),
        now,
      });
      return outcomeForTransaction(reviewed, {
        paymentState: PAYMENT_STATES.REVIEW,
        retryable: false,
        providerStatus: classification.providerStatus,
      });
    }

    if (deposit.status === 'Rejected') {
      const reviewed = await recordNowPaymentsReview({
        transaction: deposit,
        reason: 'provider_verified_after_rejection',
        details: reviewDetails(classification, terms),
        now,
      });
      return outcomeForTransaction(reviewed, {
        paymentState: PAYMENT_STATES.REVIEW,
        retryable: false,
        providerStatus: classification.providerStatus,
      });
    }

    try {
      const finalization = await finalizeDeposit({
        transactionId: deposit.id,
        userId: deposit.userId,
        paidAmountKobo: deposit.amount,
        claimableStatuses: NOWPAYMENTS_FINALIZABLE_STATUSES,
        recoveredBy,
        providerPaidAmount: classification.actuallyPaid,
      });
      let current = finalization.transaction || await authoritativeTransaction(deposit.id);
      const completed = current?.status === 'Completed';
      const newlyFinalized = Boolean(finalization.finalized && completed);
      return outcomeForTransaction(current, {
        finalization,
        newlyFinalized,
        reason: finalization.reason,
        providerStatus: classification.providerStatus,
        message: completed
          ? (newlyFinalized ? 'Payment successful' : 'Already credited')
          : messageForState(stateForTransaction(current), finalization.reason),
      });
    } catch (error) {
      log.error('NOWPayments Finalization', error.message);
      return outcomeForTransaction(await authoritativeTransaction(deposit.id), {
        paymentState: PAYMENT_STATES.RETRYABLE,
        retryable: true,
        reason: 'finalization_retryable',
        message: messageForState(PAYMENT_STATES.RETRYABLE, 'finalization_retryable'),
      });
    }
  } finally {
    try {
      await releaseProviderQueryLease(lease);
    } catch (error) {
      log.warn('NOWPayments Verification Lease', error.message);
    }
  }
}
