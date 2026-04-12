-- Add provider column to services table
ALTER TABLE "services" ADD COLUMN IF NOT EXISTS "provider" TEXT DEFAULT 'mtp';

-- Update existing services to 'mtp' (they were all from MTP)
UPDATE "services" SET "provider" = 'mtp' WHERE "provider" IS NULL;

-- Drop old unique constraint on apiId alone
ALTER TABLE "services" DROP CONSTRAINT IF EXISTS "services_apiId_key";

-- Add compound unique on (apiId, provider)
-- This allows different providers to have the same apiId number
ALTER TABLE "services" ADD CONSTRAINT "services_apiId_provider_key" UNIQUE ("apiId", "provider");

-- Index for provider lookups
CREATE INDEX IF NOT EXISTS "services_provider_idx" ON "services" ("provider");
