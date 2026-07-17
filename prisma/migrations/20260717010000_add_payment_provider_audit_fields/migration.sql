-- Add durable provider facts and manual-review lifecycle fields to payments.
ALTER TABLE "transactions"
  ADD COLUMN "providerPaymentId" TEXT,
  ADD COLUMN "providerPriceAmount" DECIMAL(36,18),
  ADD COLUMN "providerPriceCurrency" TEXT,
  ADD COLUMN "providerPayAmount" DECIMAL(36,18),
  ADD COLUMN "providerPayCurrency" TEXT,
  ADD COLUMN "providerPayAddress" TEXT,
  ADD COLUMN "providerPaymentStatus" TEXT,
  ADD COLUMN "providerActuallyPaid" DECIMAL(36,18),
  ADD COLUMN "providerLastVerifiedAt" TIMESTAMP(3),
  ADD COLUMN "paymentReconciliationAttemptAt" TIMESTAMP(3),
  ADD COLUMN "paymentReviewFingerprint" TEXT,
  ADD COLUMN "paymentReviewReason" TEXT,
  ADD COLUMN "paymentReviewAt" TIMESTAMP(3),
  ADD COLUMN "paymentReviewResolvedAt" TIMESTAMP(3);

-- Legacy crypto notes have the form:
--   Crypto deposit ... ($12.34 USDT) ... [np:123456789]
-- Preserve the USD figure as the provider price, not as the crypto pay amount.
WITH parsed_legacy_crypto AS (
  SELECT
    "id",
    substring("note" FROM '\[np:([0-9]+)\]') AS provider_payment_id,
    substring("note" FROM '\(\$([0-9]+[.]?[0-9]*) USDT\)') AS provider_price_amount
  FROM "transactions"
  WHERE "type" = 'deposit'
    AND "method" = 'crypto'
    AND "note" ~ '\[np:[0-9]+\]'
),
legacy_crypto AS (
  -- If historical/manual data attached one provider ID to multiple deposits,
  -- its ownership is ambiguous. Leave all of those IDs null so the unique
  -- index can be created and reconciliation can send them to manual review.
  SELECT parsed.*
  FROM parsed_legacy_crypto AS parsed
  JOIN (
    SELECT provider_payment_id
    FROM parsed_legacy_crypto
    WHERE provider_payment_id IS NOT NULL
    GROUP BY provider_payment_id
    HAVING COUNT(*) = 1
  ) AS unambiguous
    ON unambiguous.provider_payment_id = parsed.provider_payment_id
)
UPDATE "transactions" AS t
SET
  "providerPaymentId" = legacy_crypto.provider_payment_id,
  "providerPriceAmount" = CASE
    -- NUMERIC(36,18) has at most 18 integer and 18 fractional digits.
    WHEN legacy_crypto.provider_price_amount !~ '^[0-9]{1,18}([.][0-9]{1,18})?$' THEN NULL
    ELSE legacy_crypto.provider_price_amount::DECIMAL(36,18)
  END,
  "providerPriceCurrency" = 'usd',
  "providerPayCurrency" = 'usdttrc20'
FROM legacy_crypto
WHERE t."id" = legacy_crypto."id"
  AND legacy_crypto.provider_payment_id IS NOT NULL;
