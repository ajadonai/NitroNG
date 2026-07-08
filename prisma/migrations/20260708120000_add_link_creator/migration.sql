-- Add createdByChiefId to acquisition_links
ALTER TABLE "acquisition_links" ADD COLUMN "createdByChiefId" TEXT;

-- Backfill: if affiliate is a chief, they created it; if crew, their lead created it
UPDATE "acquisition_links" al
SET "createdByChiefId" = CASE
  WHEN cm.role = 'chief' THEN cm.id
  ELSE cm."leadId"
END
FROM "crew_members" cm
WHERE al."affiliateId" = cm.id
  AND al."createdByChiefId" IS NULL;

-- Index for ownership lookups
CREATE INDEX "acquisition_links_createdByChiefId_idx" ON "acquisition_links"("createdByChiefId");

-- FK constraint
ALTER TABLE "acquisition_links" ADD CONSTRAINT "acquisition_links_createdByChiefId_fkey"
  FOREIGN KEY ("createdByChiefId") REFERENCES "crew_members"("id") ON DELETE SET NULL ON UPDATE CASCADE;
