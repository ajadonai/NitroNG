import { createHash } from 'node:crypto';
import prisma from '@/lib/prisma';
import { log } from '@/lib/logger';
import { finalizeDeposit } from '@/lib/deposit-finalization';
import { canonicalizeNonNegativeDecimal } from '@/lib/decimal-amounts';
import {
  classifyCryptomusStatusResponse,
  fetchCryptomusPayment,
  normalizeCryptomusProviderId,
} from '@/lib/cryptomus-verification';
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

export const CRYPTO_FINALIZABLE_STATUSES = Object.freeze([
  'Pending',
  'Processing',
  'Expired',
  'Failed',
  'Cancelled',
]);

export const CRYPTO_RECONCILABLE_STATUSES = Object.freeze([
  ...CRYPTO_FINALIZABLE_STATUSES,
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
  if (paymentState === PAYMENT_STATES.PROVIDER_PENDING) return 'The payment provider has not confirmed this payment yet';
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

  const normalizedPaymentId = normalizeCryptomusProviderId(providerPaymentId);
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

/**
 * What we expect a provider read to agree with.
 *
 * Cryptomus accepts lookup by our own `order_id`, and gives it precedence over
 * its own uuid when both are supplied. That makes the reference the anchor,
 * which is a real improvement on the previous provider: there is no longer a
 * state where we hold a deposit we cannot reconcile because the provider's id
 * was never stored. The uuid is still compared when we have one, to catch a
 * response that answers about a different invoice.
 *
 * The expected amount and currency are read off the row rather than recomputed,
 * which matters because invoices are priced in USD at the deposit rate: that
 * rate can move between creating the invoice and reconciling it, and the figure
 * to hold the provider to is the one it was actually given.
 */
export function cryptoExpectedTerms(transaction, observedPaymentId) {
  const durableUuid = normalizeCryptomusProviderId(transaction?.providerPaymentId);
  const observed = normalizeCryptomusProviderId(observedPaymentId);
  const reference = transaction?.reference || null;
  const expectedAmount = canonicalizeNonNegativeDecimal(transaction?.providerPriceAmount);

  return {
    storedPaymentId: durableUuid,
    queryPaymentId: observed || durableUuid,
    paymentId: durableUuid || observed,
    reference,
    // The reference is what we query by, so a missing one is the only truly
    // unreconcilable case left.
    queryReference: reference,
    expectedAmount,
    // No guess if the row never recorded one. A currency we did not write down
    // is a currency we cannot verify the provider against, and inventing one
    // here would either wave through a mismatch or manufacture one.
    expectedCurrency: String(transaction?.providerPriceCurrency || '').trim().toLowerCase() || null,
    adoptsObservedPaymentId: !durableUuid && Boolean(observed),
  };
}

/**
 * Cryptomus needs two values, not one: the merchant uuid identifies the account
 * and the payment API key signs every request. Either missing means nothing can
 * be signed, so they travel together and callers check `.ready`.
 *
 * The admin gateway setting wins over the environment, which is what lets the
 * gateway be reconfigured without a deploy.
 */
function credentialsFromSetting(parsed) {
  const merchantId = parsed?.fields?.merchantId;
  const apiKey = parsed?.fields?.apiKey;
  return {
    merchantId: typeof merchantId === 'string' ? merchantId.trim() : '',
    apiKey: typeof apiKey === 'string' ? apiKey.trim() : '',
  };
}

function credentialsFromEnv() {
  return {
    merchantId: process.env.CRYPTOMUS_MERCHANT_ID?.trim() || '',
    apiKey: process.env.CRYPTOMUS_API_KEY?.trim() || '',
  };
}

function withReady(creds) {
  return { ...creds, ready: Boolean(creds.merchantId && creds.apiKey) };
}

/**
 * Credentials for reading payments back. Deliberately ignores the gateway's
 * enabled flag: switching crypto off must stop new invoices without stranding
 * deposits already in flight, which still need reconciling.
 */
export async function getCryptomusCredentials() {
  const setting = await prisma.setting.findUnique({ where: { key: 'gateway_crypto' } });
  if (setting) {
    try {
      const fromSetting = credentialsFromSetting(JSON.parse(setting.value));
      if (fromSetting.merchantId && fromSetting.apiKey) return withReady(fromSetting);
    } catch (error) {
      log.warn('Cryptomus Config', `Invalid gateway setting: ${error.message}`);
    }
  }
  return withReady(credentialsFromEnv());
}

/**
 * Credentials for creating a new invoice. Returns nothing when the gateway is
 * absent or switched off, which is the single control that stops new crypto
 * deposits being offered.
 */
export async function getCryptomusCreationCredentials() {
  const setting = await prisma.setting.findUnique({ where: { key: 'gateway_crypto' } });
  if (!setting) return withReady({ merchantId: '', apiKey: '' });

  try {
    const parsed = JSON.parse(setting.value);
    if (parsed?.enabled !== true) return withReady({ merchantId: '', apiKey: '' });
    const fromSetting = credentialsFromSetting(parsed);
    if (fromSetting.merchantId && fromSetting.apiKey) return withReady(fromSetting);
    return withReady(credentialsFromEnv());
  } catch (error) {
    log.warn('Cryptomus Config', `Invalid gateway setting: ${error.message}`);
    return withReady({ merchantId: '', apiKey: '' });
  }
}

function reviewFingerprint(transaction, reason, details) {
  const observation = {
    transactionId: transaction.id,
    reason,
    observedPaymentId: normalizeCryptomusProviderId(
      details?.observedPaymentId
      || details?.providerPaymentId
      || transaction.providerPaymentId
      || transaction.providerPaymentId,
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
      || normalizeCryptomusProviderId(details?.providerPaymentId)
      || normalizeCryptomusProviderId(details?.observedPaymentId),
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

export async function recordCryptoPaymentReview({
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
      status: { in: CRYPTO_RECONCILABLE_STATUSES },
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
    expectedPriceAmount: terms.expectedAmount,
    priceCurrency: classification.priceCurrency,
    expectedPriceCurrency: terms.expectedCurrency,
    payAmount: classification.payAmount,
    // Observed rather than expected: the coin is the customer's choice at pay
    // time, so there is nothing to have expected.
    expectedPayAmount: classification.payAmount,
    payCurrency: classification.payCurrency,
    expectedPayCurrency: classification.payCurrency,
    actuallyPaid: classification.actuallyPaid,
  };
}

export async function reconcileCryptoDeposit({
  transaction,
  reference,
  providerPaymentId,
  userId,
  // Cryptomus needs a merchant id alongside the key, so this carries both.
  // Left undefined it resolves itself from the gateway settings.
  credentials: injectedCredentials,
  fetchImpl,
  timeoutMs,
  recoveredBy,
  auditCompleted = false,
  auditRejected = false,
  now = new Date(),
  deferLeaseRelease = false,
  preAcquiredLease,
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

  let terms = cryptoExpectedTerms(deposit, providerPaymentId);
  // Cryptomus can be queried by our own order_id, so a missing provider uuid is
  // no longer fatal: the previous provider could only be queried by its own id,
  // which is why a deposit that lost it had to go to manual review. A missing
  // reference is the one remaining unreconcilable case, since there is then
  // nothing to ask about.
  if (!terms.queryReference && !terms.queryPaymentId) {
    deposit = await markReconciliationAttempt(deposit, now);
    const reviewed = await recordCryptoPaymentReview({
      transaction: deposit,
      reason: 'missing_payment_identifier',
      now,
    });
    return outcomeForTransaction(reviewed, { paymentState: PAYMENT_STATES.REVIEW });
  }
  // Deliberately does not require a pay currency. Cryptomus lets the customer
  // pick their coin on the payment page, so it is unknown until they pay, and
  // demanding it here would send every deposit to manual review. The reference
  // and the invoiced amount and currency are what actually have to be known.
  if (
    !terms.reference
    || !terms.expectedAmount
    || !terms.expectedCurrency
  ) {
    deposit = await markReconciliationAttempt(deposit, now);
    const reviewed = await recordCryptoPaymentReview({
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
      const reviewed = await recordCryptoPaymentReview({
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
  const lease = preAcquiredLease || await acquireProviderQueryLease({
    provider: 'cryptomus',
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

  let result;
  try {
    const currentBeforeQuery = await authoritativeTransaction(deposit.id);
    if (!currentBeforeQuery) { result = outcomeForTransaction(null); return result; }
    deposit = currentBeforeQuery;
    if (deposit.status === 'Rejected' && !providerPaymentId && !auditRejected) {
      result = outcomeForTransaction(deposit); return result;
    }
    if (deposit.status === 'Completed' && !auditCompleted && !providerPaymentId) {
      result = outcomeForTransaction(deposit, { reason: 'already_completed' }); return result;
    }

    deposit = await markReconciliationAttempt(deposit, now);

    // Credentials are resolved per attempt rather than cached, so rotating the
    // gateway in admin settings takes effect on the next reconciliation instead
    // of at the next deploy.
    const credentials = injectedCredentials === undefined
      ? await getCryptomusCredentials()
      : injectedCredentials;
    const providerResult = await fetchCryptomusPayment({
      reference: terms.queryReference,
      uuid: terms.queryPaymentId,
      merchantId: credentials?.merchantId,
      apiKey: credentials?.apiKey,
      fetchImpl,
      timeoutMs: effectiveTimeoutMs,
    });

    const ownsResult = await renewProviderQueryLease(lease, {
      leaseMs: RESULT_APPLICATION_LEASE_MS,
    });
    if (!ownsResult) {
      const current = await authoritativeTransaction(deposit.id);
      if (providerPaymentId) {
        result = outcomeForTransaction(current, {
          paymentState: current ? PAYMENT_STATES.VERIFYING : PAYMENT_STATES.FAILED,
          retryable: Boolean(current),
          reason: current ? 'verification_lease_lost' : 'not_found',
          message: current
            ? messageForState(PAYMENT_STATES.VERIFYING)
            : 'Transaction not found',
        });
        return result;
      }
      result = outcomeForTransaction(current, {
        paymentState: current ? stateForTransaction(current) : PAYMENT_STATES.FAILED,
        reason: current ? 'verification_lease_lost' : 'not_found',
      });
      return result;
    }

    if (providerResult.state !== 'received') {
      result = outcomeForTransaction(await authoritativeTransaction(deposit.id), {
        paymentState: PAYMENT_STATES.RETRYABLE,
        retryable: true,
        reason: providerResult.reason,
        httpStatus: providerResult.httpStatus,
        message: messageForState(PAYMENT_STATES.RETRYABLE, providerResult.reason),
      });
      return result;
    }

    // Creation response handling and webhook reconciliation can overlap. Bind
    // provider identity and quoted terms first-write-wins: re-read after the
    // network call and classify against the latest durable values so a stale
    // worker can never overwrite or validate a different provider payment.
    const currentBeforeApply = await authoritativeTransaction(deposit.id);
    if (!currentBeforeApply) { result = outcomeForTransaction(null); return result; }
    deposit = currentBeforeApply;
    if (deposit.status === 'Rejected' && !providerPaymentId && !auditRejected) {
      result = outcomeForTransaction(deposit);
      return result;
    }
    terms = cryptoExpectedTerms(deposit, providerPaymentId);

    const classification = classifyCryptomusStatusResponse(providerResult.payload, {
      reference: terms.reference,
      uuid: terms.paymentId,
      expectedAmount: terms.expectedAmount,
      expectedCurrency: terms.expectedCurrency,
    });

    try {
      deposit = await recordProviderObservation(deposit, classification, terms, now);
    } catch (error) {
      if (!isUniqueConstraintError(error)) throw error;
      const current = await authoritativeTransaction(deposit.id);
      const reviewed = await recordCryptoPaymentReview({
        transaction: current || deposit,
        reason: 'provider_payment_id_reused',
        details: {
          ...reviewDetails(classification, terms),
          providerPaymentId: terms.queryPaymentId,
        },
        now,
      });
      result = outcomeForTransaction(reviewed, {
        paymentState: PAYMENT_STATES.REVIEW,
        retryable: false,
        providerStatus: classification.providerStatus,
      });
      return result;
    }

    if (classification.state === 'retryable') {
      result = outcomeForTransaction(deposit, {
        paymentState: PAYMENT_STATES.RETRYABLE,
        retryable: true,
        reason: classification.reason,
        providerStatus: classification.providerStatus,
        message: messageForState(PAYMENT_STATES.RETRYABLE, classification.reason),
      });
      return result;
    }

    if (classification.state === 'review') {
      const reviewed = await recordCryptoPaymentReview({
        transaction: deposit,
        reason: classification.reason || 'provider_integrity_mismatch',
        details: reviewDetails(classification, terms),
        now,
      });
      result = outcomeForTransaction(reviewed, {
        paymentState: PAYMENT_STATES.REVIEW,
        retryable: false,
        providerStatus: classification.providerStatus,
      });
      return result;
    }

    if (classification.state === 'refunded') {
      if (deposit.status === 'Completed') {
        const reviewed = await recordCryptoPaymentReview({
          transaction: deposit,
          reason: 'refunded_after_credit',
          details: reviewDetails(classification, terms),
          now,
        });
        result = outcomeForTransaction(reviewed, {
          paymentState: PAYMENT_STATES.REVIEW,
          retryable: false,
          providerStatus: classification.providerStatus,
        });
        return result;
      }
      if (deposit.status === 'Rejected') {
        if (hasOpenPaymentReview(deposit)) {
          const reviewed = await recordCryptoPaymentReview({
            transaction: deposit,
            reason: 'provider_refunded_during_review',
            details: reviewDetails(classification, terms),
            now,
          });
          result = outcomeForTransaction(reviewed, {
            paymentState: PAYMENT_STATES.REVIEW,
            retryable: false,
            providerStatus: classification.providerStatus,
          });
          return result;
        }
        result = outcomeForTransaction(deposit, {
          providerStatus: classification.providerStatus,
        });
        return result;
      }

      if (hasOpenPaymentReview(deposit)) {
        const reviewed = await recordCryptoPaymentReview({
          transaction: deposit,
          reason: 'provider_refunded_during_review',
          details: reviewDetails(classification, terms),
          now,
        });
        result = outcomeForTransaction(reviewed, {
          paymentState: PAYMENT_STATES.REVIEW,
          retryable: false,
          providerStatus: classification.providerStatus,
        });
        return result;
      }
      const current = await transitionUncredited(deposit, 'Refunded');
      result = outcomeForTransaction(current, {
        paymentState: PAYMENT_STATES.FAILED,
        retryable: false,
        reason: 'refunded',
        providerStatus: classification.providerStatus,
        message: messageForState(PAYMENT_STATES.FAILED, 'refunded'),
      });
      return result;
    }

    if (classification.state === 'provider_failed') {
      if (deposit.status === 'Completed') {
        const reviewed = await recordCryptoPaymentReview({
          transaction: deposit,
          reason: 'provider_terminal_after_credit',
          details: reviewDetails(classification, terms),
          now,
        });
        result = outcomeForTransaction(reviewed, {
          paymentState: PAYMENT_STATES.REVIEW,
          retryable: false,
          providerStatus: classification.providerStatus,
        });
        return result;
      }
      if (hasOpenPaymentReview(deposit)) {
        const reviewed = await recordCryptoPaymentReview({
          transaction: deposit,
          reason: 'provider_terminal_during_review',
          details: reviewDetails(classification, terms),
          now,
        });
        result = outcomeForTransaction(reviewed, {
          paymentState: PAYMENT_STATES.REVIEW,
          retryable: false,
          providerStatus: classification.providerStatus,
        });
        return result;
      }
      if (deposit.status === 'Rejected') {
        result = outcomeForTransaction(deposit, {
          providerStatus: classification.providerStatus,
        });
        return result;
      }

      // Cryptomus vocabulary: `cancel` is the customer walking away or the
      // invoice lapsing, which is materially different from `fail` and
      // `system_fail` and is surfaced to the customer differently.
      const terminalStatus = classification.providerStatus === 'cancel'
        ? 'Cancelled'
        : 'Failed';
      const current = await transitionUncredited(deposit, terminalStatus);
      result = outcomeForTransaction(current, {
        reason: classification.reason,
        providerStatus: classification.providerStatus,
      });
      return result;
    }

    if (classification.state === 'provider_pending') {
      let current = deposit;
      if (!['Cancelled', 'Refunded', 'Review', 'Rejected'].includes(deposit.status)) {
        current = await transitionUncredited(deposit, 'Pending');
      }
      result = outcomeForTransaction(current, {
        reason: 'provider_pending',
        providerStatus: classification.providerStatus,
      });
      return result;
    }

    if (hasOpenPaymentReview(deposit)) {
      // Every provider-integrity review is a manual decision. A later exact
      // response may add evidence, but it must never silently erase an
      // underpayment, overpayment, repeated-payment, identity, asset, refund,
      // or other anomaly and credit the wallet.
      const alreadyVerifiedReview = [
        'account_deleted',
        'provider_verified_after_refund',
        'provider_verified_after_rejection',
        'provider_verified_during_review',
      ].includes(deposit.paymentReviewReason);
      const reviewed = await recordCryptoPaymentReview({
        transaction: deposit,
        reason: alreadyVerifiedReview
          ? deposit.paymentReviewReason
          : 'provider_verified_during_review',
        details: reviewDetails(classification, terms),
        now,
      });
      result = outcomeForTransaction(reviewed, {
        paymentState: PAYMENT_STATES.REVIEW,
        providerStatus: classification.providerStatus,
      });
      return result;
    }

    if (deposit.status === 'Completed') {
      result = outcomeForTransaction(deposit, {
        reason: 'already_completed',
        providerStatus: classification.providerStatus,
      });
      return result;
    }

    if (deposit.status === 'Refunded') {
      const reviewed = await recordCryptoPaymentReview({
        transaction: deposit,
        reason: 'provider_verified_after_refund',
        details: reviewDetails(classification, terms),
        now,
      });
      result = outcomeForTransaction(reviewed, {
        paymentState: PAYMENT_STATES.REVIEW,
        retryable: false,
        providerStatus: classification.providerStatus,
      });
      return result;
    }

    if (deposit.status === 'Rejected') {
      const reviewed = await recordCryptoPaymentReview({
        transaction: deposit,
        reason: 'provider_verified_after_rejection',
        details: reviewDetails(classification, terms),
        now,
      });
      result = outcomeForTransaction(reviewed, {
        paymentState: PAYMENT_STATES.REVIEW,
        retryable: false,
        providerStatus: classification.providerStatus,
      });
      return result;
    }

    try {
      const finalization = await finalizeDeposit({
        transactionId: deposit.id,
        userId: deposit.userId,
        paidAmountKobo: deposit.amount,
        claimableStatuses: CRYPTO_FINALIZABLE_STATUSES,
        recoveredBy,
        providerPaidAmount: classification.actuallyPaid,
      });
      let current = finalization.transaction || await authoritativeTransaction(deposit.id);
      const completed = current?.status === 'Completed';
      const newlyFinalized = Boolean(finalization.finalized && completed);
      result = outcomeForTransaction(current, {
        finalization,
        newlyFinalized,
        reason: finalization.reason,
        providerStatus: classification.providerStatus,
        message: completed
          ? (newlyFinalized ? 'Payment successful' : 'Already credited')
          : messageForState(stateForTransaction(current), finalization.reason),
      });
      return result;
    } catch (error) {
      log.error('Cryptomus Finalization', error.message);
      result = outcomeForTransaction(await authoritativeTransaction(deposit.id), {
        paymentState: PAYMENT_STATES.RETRYABLE,
        retryable: true,
        reason: 'finalization_retryable',
        message: messageForState(PAYMENT_STATES.RETRYABLE, 'finalization_retryable'),
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
        log.warn('Crypto Verification Lease', error.message);
      }
    }
  }
}
