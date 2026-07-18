import { paymentStateFromTransactionStatus } from '@/lib/payment-state';

export const TRANSACTION_HISTORY_DAYS = 180;

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
    description: tx.note?.replace(/\[(rejected_by|approved_by|user_confirmed|awaiting_confirmation):?[^\]]*\]\s*/g, '').trim() || null,
    awaitingConfirmation: Boolean(
      tx.status === 'Pending'
      && tx.method === 'manual'
      && tx.note?.includes('[awaiting_confirmation]')
    ),
  };
}
