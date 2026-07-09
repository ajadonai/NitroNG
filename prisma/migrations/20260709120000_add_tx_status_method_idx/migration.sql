-- CreateIndex
CREATE INDEX CONCURRENTLY "transactions_type_status_method_createdAt_idx" ON "transactions"("type", "status", "method", "createdAt");
