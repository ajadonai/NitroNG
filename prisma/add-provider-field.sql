-- Add provider column to services table
ALTER TABLE "services" ADD COLUMN IF NOT EXISTS "provider" TEXT DEFAULT 'mtp';

-- Update existing services to 'mtp'
UPDATE "services" SET "provider" = 'mtp' WHERE "provider" IS NULL;

-- Drop old unique constraint on apiId alone (try multiple possible names)
ALTER TABLE "services" DROP CONSTRAINT IF EXISTS "services_apiId_key";
ALTER TABLE "services" DROP CONSTRAINT IF EXISTS "Service_apiId_key";
ALTER TABLE "services" DROP CONSTRAINT IF EXISTS "services_api_id_key";

-- Also drop any unique index on apiId
DROP INDEX IF EXISTS "services_apiId_key";
DROP INDEX IF EXISTS "Service_apiId_key";

-- Add compound unique on (apiId, provider)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'services_apiId_provider_key'
  ) THEN
    ALTER TABLE "services" ADD CONSTRAINT "services_apiId_provider_key" UNIQUE ("apiId", "provider");
  END IF;
END $$;

-- Index for provider lookups
CREATE INDEX IF NOT EXISTS "services_provider_idx" ON "services" ("provider");
