export const PAYMENT_STATES = Object.freeze({
  CREDITED: 'credited',
  VERIFYING: 'verifying',
  PROVIDER_PENDING: 'provider_pending',
  RETRYABLE: 'retryable',
  REVIEW: 'review',
  FAILED: 'failed',
});

export function paymentStateFromTransactionStatus(status) {
  switch (status) {
    case 'Completed':
      return PAYMENT_STATES.CREDITED;
    case 'Processing':
      return PAYMENT_STATES.VERIFYING;
    case 'Pending':
      return PAYMENT_STATES.PROVIDER_PENDING;
    case 'Expired':
      return PAYMENT_STATES.RETRYABLE;
    case 'Review':
      return PAYMENT_STATES.REVIEW;
    case 'Failed':
    case 'Cancelled':
    case 'Refunded':
    case 'Rejected':
      return PAYMENT_STATES.FAILED;
    default:
      return PAYMENT_STATES.RETRYABLE;
  }
}

export function isCreditedPaymentResult(result) {
  return result?.success === true
    && result.paymentState === PAYMENT_STATES.CREDITED
    && result.transactionStatus === 'Completed';
}

export function isRetryablePaymentState(paymentState) {
  return paymentState === PAYMENT_STATES.VERIFYING
    || paymentState === PAYMENT_STATES.PROVIDER_PENDING
    || paymentState === PAYMENT_STATES.RETRYABLE;
}
