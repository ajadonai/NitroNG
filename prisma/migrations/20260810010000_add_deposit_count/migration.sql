-- AlterTable
ALTER TABLE "users" ADD COLUMN "depositCount" INTEGER NOT NULL DEFAULT 0;

-- Backfill from existing completed deposits
UPDATE "users" u
SET "depositCount" = sub.cnt
FROM (
  SELECT "userId", COUNT(*)::int AS cnt
  FROM "transactions"
  WHERE "type" = 'deposit' AND "status" = 'Completed'
  GROUP BY "userId"
) sub
WHERE u."id" = sub."userId";
