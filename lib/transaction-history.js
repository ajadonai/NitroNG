export const TRANSACTION_HISTORY_DAYS = 180;

export function transactionHistoryCutoff(now = Date.now()) {
  return new Date(now - TRANSACTION_HISTORY_DAYS * 24 * 60 * 60 * 1000);
}

export function serializeTransaction(tx) {
  return {
    id: tx.id,
    type: tx.type,
    reference: tx.reference || null,
    amount: tx.amount / 100,
    status: tx.status,
    method: tx.method || tx.type,
    date: tx.createdAt.toISOString(),
    description: tx.note?.replace(/\[(rejected_by|approved_by|user_confirmed|awaiting_confirmation):?[^\]]*\]\s*/g, '').trim() || null,
    awaitingConfirmation: Boolean(
      tx.status === 'Pending'
      && tx.method === 'manual'
      && tx.note?.includes('[awaiting_confirmation]')
    ),
  };
}
