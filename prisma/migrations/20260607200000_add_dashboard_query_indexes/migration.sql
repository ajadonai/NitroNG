CREATE INDEX "orders_userId_deletedAt_status_idx" ON "orders"("userId", "deletedAt", "status");
CREATE INDEX "transactions_userId_type_idx" ON "transactions"("userId", "type");
CREATE INDEX "transactions_type_status_createdAt_idx" ON "transactions"("type", "status", "createdAt");
