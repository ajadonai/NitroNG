ALTER TABLE "users" ADD COLUMN "anonymizedAt" TIMESTAMP(3);

-- Existing legacy Deleted rows are cleaned by the Phase 6 finalizer, so avoid
-- making deployment depend on their current balance. PostgreSQL still enforces
-- a NOT VALID constraint for every new or updated row immediately.
ALTER TABLE "users"
  ADD CONSTRAINT "users_deleted_balance_zero"
  CHECK (
    "balance" = 0
    OR ("status" <> 'Deleted' AND "anonymizedAt" IS NULL)
  ) NOT VALID;

-- Permanent deletion is an identity tombstone, not only a status flag. Keep
-- the constraint NOT VALID so legacy Deleted rows can be cleaned by the shared
-- finalizer after deployment, while rejecting every new stale write that would
-- put personal data back onto an anonymized account.
ALTER TABLE "users"
  ADD CONSTRAINT "users_deleted_identity_anonymized"
  CHECK (
    "status" <> 'Deleted'
    OR (
      "anonymizedAt" IS NOT NULL
      AND "deletedName" IS NULL
      AND "deletedEmail" IS NULL
      AND name = 'Deleted User'
      AND email LIKE 'deleted-%@accounts.invalid'
      AND password LIKE '!deleted:%'
      AND "firstName" IS NULL
      AND "lastName" IS NULL
      AND phone IS NULL
      AND "referralCode" LIKE 'deleted-%.invalid'
      AND "referredBy" IS NULL
      AND "emailVerified" = FALSE
      AND "verifyToken" IS NULL
      AND "verifyExpires" IS NULL
      AND "resetToken" IS NULL
      AND "resetExpires" IS NULL
      AND "apiKey" IS NULL
      AND "notifClearedAt" IS NULL
      AND "notifReadAllAt" IS NULL
      AND "notifReadIds" IS NULL
      AND "signupSource" IS NULL
      AND "signupIp" IS NULL
      AND "lastIp" IS NULL
      AND "lastUa" IS NULL
      AND "lastFbp" IS NULL
      AND "lastFbc" IS NULL
      AND "referredByMemberId" IS NULL
      AND "referredByLinkId" IS NULL
    )
  ) NOT VALID;
