-- AlterTable: snapshot bank details onto payout at request time
ALTER TABLE "affiliate_payouts" ADD COLUMN IF NOT EXISTS "bankName" TEXT;
ALTER TABLE "affiliate_payouts" ADD COLUMN IF NOT EXISTS "bankAccountNo" TEXT;
ALTER TABLE "affiliate_payouts" ADD COLUMN IF NOT EXISTS "bankAccountName" TEXT;

-- Backfill existing payouts from their member's current bank details
UPDATE "affiliate_payouts" p
SET
  "bankName" = m."bankName",
  "bankAccountNo" = m."bankAccountNo",
  "bankAccountName" = m."bankAccountName"
FROM "crew_members" m
WHERE p."memberId" = m.id
  AND p."bankName" IS NULL;
