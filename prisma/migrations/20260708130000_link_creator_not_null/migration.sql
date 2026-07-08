-- Make createdByChiefId NOT NULL (all rows already backfilled)
ALTER TABLE "acquisition_links" ALTER COLUMN "createdByChiefId" SET NOT NULL;

-- Replace ON DELETE SET NULL with ON DELETE RESTRICT
ALTER TABLE "acquisition_links" DROP CONSTRAINT "acquisition_links_createdByChiefId_fkey";
ALTER TABLE "acquisition_links" ADD CONSTRAINT "acquisition_links_createdByChiefId_fkey"
  FOREIGN KEY ("createdByChiefId") REFERENCES "crew_members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
