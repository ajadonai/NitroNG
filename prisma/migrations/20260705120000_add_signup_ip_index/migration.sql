-- CreateIndex
CREATE INDEX CONCURRENTLY IF NOT EXISTS "users_signupIp_idx" ON "users"("signupIp");
