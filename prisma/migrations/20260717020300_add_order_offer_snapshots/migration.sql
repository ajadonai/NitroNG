-- AlterTable
ALTER TABLE "orders"
ADD COLUMN "serviceNameAtPurchase" TEXT,
ADD COLUMN "tierNameAtPurchase" TEXT,
ADD COLUMN "platformAtPurchase" TEXT,
ADD COLUMN "serviceTypeAtPurchase" TEXT;

-- Backfill currently linked catalogue offers. Orders whose tier relationship was
-- already removed remain NULL so application fallbacks can handle them safely.
UPDATE "orders" AS o
SET
  "serviceNameAtPurchase" = sg."name",
  "tierNameAtPurchase" = st."tier",
  "platformAtPurchase" = sg."platform",
  "serviceTypeAtPurchase" = sg."type"
FROM "service_tiers" AS st
JOIN "service_groups" AS sg ON sg."id" = st."groupId"
WHERE o."tierId" = st."id";

-- Best-effort recovery for older single orders whose tier row was already
-- deleted. Only accept labels that still exist in the catalogue, preventing a
-- provider's parenthesised metadata from being mistaken for a public tier.
WITH note_tiers AS (
  SELECT
    o."id" AS "orderId",
    BTRIM(SUBSTRING(t."note" FROM '\(([^()]*)\)[[:space:]]+x[0-9,]+')) AS "tierName"
  FROM "orders" AS o
  JOIN "transactions" AS t ON t."reference" = o."orderId"
  WHERE o."tierNameAtPurchase" IS NULL
    AND t."type" = 'order'
    AND t."status" = 'Completed'
), recognized_tiers AS (
  SELECT DISTINCT nt."orderId", nt."tierName"
  FROM note_tiers AS nt
  WHERE nt."tierName" IS NOT NULL
    AND LENGTH(nt."tierName") BETWEEN 1 AND 60
    AND EXISTS (
      SELECT 1
      FROM "service_tiers" AS st
      WHERE LOWER(BTRIM(st."tier")) = LOWER(nt."tierName")
    )
)
UPDATE "orders" AS o
SET "tierNameAtPurchase" = rt."tierName"
FROM recognized_tiers AS rt
WHERE o."id" = rt."orderId";
