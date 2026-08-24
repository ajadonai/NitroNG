-- Audit trail for wholesale pricing grants. All three are nullable: existing
-- rows predate the admin approval flow and have no approver to record.
ALTER TABLE "reseller_profiles" ADD COLUMN     "approvedAt" TIMESTAMP(3),
ADD COLUMN     "approvedBy" TEXT,
ADD COLUMN     "notes" TEXT;
