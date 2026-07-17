-- Build separately and concurrently so live payment writes remain available.
CREATE INDEX CONCURRENTLY "transactions_payment_review_idx"
  ON "transactions"("paymentReviewResolvedAt", "paymentReviewAt");
