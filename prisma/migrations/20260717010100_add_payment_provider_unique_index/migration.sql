-- Build separately and concurrently so live payment writes are not blocked by
-- an index scan of the transactions table.
CREATE UNIQUE INDEX CONCURRENTLY "transactions_method_provider_payment_id_key"
  ON "transactions"("method", "providerPaymentId");
