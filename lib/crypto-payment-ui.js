const TERMINAL_STATUSES = new Set([
  'completed',
  'cancelled',
  'failed',
  'expired',
  'refunded',
  'review',
]);

const TERMINAL_PAYMENT_STATES = new Set(['credited', 'failed', 'review']);

const DEFINITIVE_CREATION_REJECTIONS = new Set([
  400,
  401,
  403,
  404,
  405,
  409,
  413,
  415,
  422,
]);

const REVIEW_REASONS = new Set([
  'underpayment',
  'overpayment',
  'partially_paid',
  'repeated_payment',
  'wrong_asset',
  'payment_id_mismatch',
  'order_id_mismatch',
  'price_amount_mismatch',
  'price_currency_mismatch',
  'pay_amount_mismatch',
  'pay_currency_mismatch',
  'missing_actual_amount',
  'refunded_after_credit',
  'provider_terminal_after_credit',
  'provider_verified_after_refund',
  'missing_provider_payment_id',
  'missing_expected_terms',
  'creation_response_mismatch',
]);

function normalized(value) {
  return typeof value === 'string'
    ? value.trim().toLowerCase().replace(/[\s-]+/g, '_')
    : '';
}

export function cryptoPaymentAttemptFingerprint(amount, couponId) {
  const amountKobo = Math.round(Number(amount) * 100);
  const coupon = couponId == null || couponId === '' ? 'none' : String(couponId);
  return `${amountKobo}:${coupon}`;
}

export function getCryptoPaymentAttempt(cache, amount, couponId, createId) {
  const fingerprint = cryptoPaymentAttemptFingerprint(amount, couponId);
  let idempotencyKey = cache.get(fingerprint);
  if (!idempotencyKey) {
    idempotencyKey = createId();
    cache.set(fingerprint, idempotencyKey);
  }
  return { fingerprint, idempotencyKey };
}

export function releaseCryptoPaymentAttempt(cache, fingerprint) {
  cache.delete(fingerprint);
}

export function isDefinitiveCryptoCreationRejection(status) {
  return DEFINITIVE_CREATION_REJECTIONS.has(Number(status));
}

export function isCreditedCryptoPaymentResult(result) {
  return result?.success === true
    && normalized(result.status) === 'completed'
    && normalized(result.paymentState) === 'credited';
}

export function isTerminalCryptoPaymentResult(result) {
  return TERMINAL_STATUSES.has(normalized(result?.status))
    || TERMINAL_PAYMENT_STATES.has(normalized(result?.paymentState));
}

export function isCryptoPaymentReview(result) {
  const status = normalized(result?.status);
  const paymentState = normalized(result?.paymentState);
  const reason = normalized(result?.reason);

  if (status === 'review' || paymentState === 'review' || REVIEW_REASONS.has(reason)) return true;

  // Contradictory completion markers are terminal, but not safe to present as
  // credited until all three success fields agree.
  return (status === 'completed' || paymentState === 'credited')
    && !isCreditedCryptoPaymentResult(result);
}

export function creditedCryptoPaymentStatus(result, fallback = {}) {
  if (!isCreditedCryptoPaymentResult(result)) return null;
  return {
    ...result,
    type: 'success',
    success: true,
    status: 'Completed',
    transactionStatus: 'Completed',
    paymentState: 'credited',
    amount: result.amount ?? fallback.amount,
    reference: result.reference || fallback.reference,
  };
}

export function cryptoPaymentPresentation(result) {
  const status = normalized(result?.status);
  const reason = normalized(result?.reason);

  if (isCreditedCryptoPaymentResult(result)) {
    return {
      kind: 'credited',
      title: 'Payment Confirmed!',
      message: 'Your wallet has been credited.',
    };
  }

  if (isCryptoPaymentReview(result)) {
    if (reason === 'underpayment' || reason === 'partially_paid') {
      return {
        kind: 'review',
        title: 'Payment needs review',
        message: 'The amount received was lower than expected. Your wallet has not been credited automatically while we review it.',
      };
    }
    if (reason === 'overpayment') {
      return {
        kind: 'review',
        title: 'Payment needs review',
        message: 'The amount received was higher than expected. Your wallet has not been credited automatically while we verify the correct amount.',
      };
    }
    if (reason === 'repeated_payment') {
      return {
        kind: 'review',
        title: 'Repeated payment detected',
        message: 'This deposit is linked to an earlier payment. Your wallet has not been credited automatically while we verify it.',
      };
    }
    if (reason === 'wrong_asset') {
      return {
        kind: 'review',
        title: 'Different asset detected',
        message: 'The payment used a different asset or network. Your wallet has not been credited automatically while we review it.',
      };
    }
    if (reason === 'refunded_after_credit' || reason === 'provider_terminal_after_credit') {
      return {
        kind: 'review',
        title: 'Payment needs review',
        message: 'The provider reported a refund or terminal change after this payment was credited. Our team needs to review it.',
      };
    }
    return {
      kind: 'review',
      title: 'Payment needs review',
      message: 'The provider details do not fully match this deposit. Your wallet has not been credited automatically while we review it.',
    };
  }

  if (status === 'refunded' || reason === 'refunded') {
    return {
      kind: 'failed',
      title: 'Payment refunded',
      message: 'NOWPayments reports that this payment was refunded. No wallet credit was applied.',
    };
  }
  if (status === 'expired' || reason === 'provider_expired') {
    return {
      kind: 'failed',
      title: 'Payment expired',
      message: 'This payment expired before it could be completed. You can try another payment method.',
    };
  }
  if (status === 'cancelled' || reason === 'provider_cancelled') {
    return {
      kind: 'failed',
      title: 'Payment cancelled',
      message: 'This payment was cancelled before completion. No wallet credit was applied.',
    };
  }
  if (status === 'failed' || normalized(result?.paymentState) === 'failed' || reason === 'provider_failed') {
    return {
      kind: 'failed',
      title: 'Payment unsuccessful',
      message: 'The provider could not complete this payment. No wallet credit was applied.',
    };
  }

  return {
    kind: 'pending',
    title: 'Payment pending',
    message: 'We are waiting for the payment to complete.',
  };
}
