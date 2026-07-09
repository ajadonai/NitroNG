CREATE INDEX IF NOT EXISTS "transactions_userId_createdAt_idx"
ON "transactions" ("userId", "createdAt");
