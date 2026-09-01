import { paymentStateFromTransactionStatus } from '@/lib/payment-state';

export const TRANSACTION_HISTORY_DAYS = 180;

// How long a started bank transfer waits for the customer to press "I've sent
// it". A bank queue, a failed first attempt, or simply finishing the transfer
// later all take longer than the half hour this used to allow — and the row
// disappearing is worse than it lingering, because the money is already gone.
export const MANUAL_UNCONFIRMED_TTL_MS = 24 * 60 * 60 * 1000;

export function transactionHistoryCutoff(now = Date.now()) {
  return new Date(now - TRANSACTION_HISTORY_DAYS * 24 * 60 * 60 * 1000);
}

export function serializeTransaction(tx) {
  // Older Flutterwave deposits predate the `method` field. The payment
  // reconciler deliberately treats those null-method deposits as Flutterwave,
  // so the customer-facing history must use the same classification.
  const isFlutterwaveDeposit = tx.type === 'deposit'
    && (tx.method === 'flutterwave' || tx.method == null);
  const hasOpenPaymentReview = tx.type === 'deposit'
    && Boolean(tx.paymentReviewReason)
    && !tx.paymentReviewResolvedAt;

  return {
    id: tx.id,
    type: tx.type,
    reference: tx.reference || null,
    amount: tx.amount / 100,
    status: tx.status,
    ...(hasOpenPaymentReview
      ? { paymentState: 'review' }
      : isFlutterwaveDeposit
        ? { paymentState: paymentStateFromTransactionStatus(tx.status) }
        : {}),
    method: isFlutterwaveDeposit ? 'flutterwave' : (tx.method || tx.type),
    date: tx.createdAt.toISOString(),
    description: tx.type === 'refund'
      ? null
      : tx.note?.replace(/\s*\[[^\]]+\]\s*/g, ' ').replace(/\s+/g, ' ').trim() || null,
    awaitingConfirmation: Boolean(
      tx.status === 'Pending'
      && tx.method === 'manual'
      && tx.note?.includes('[awaiting_confirmation]')
    ),
  };
}
