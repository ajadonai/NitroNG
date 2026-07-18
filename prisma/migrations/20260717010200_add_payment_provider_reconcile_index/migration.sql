-- Build separately and concurrently so live payment writes remain available.
CREATE INDEX CONCURRENTLY "transactions_provider_reconcile_idx"
  ON "transactions"("method", "providerPaymentStatus", "paymentReconciliationAttemptAt");
