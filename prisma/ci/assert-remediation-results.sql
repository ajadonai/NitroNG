-- Fail the disposable CI migration replay if a live-data remediation branch did
-- not produce the expected result.

DO $assert$
BEGIN
  IF EXISTS (SELECT 1 FROM "settings" WHERE "key" = 'pulse_secret_key') THEN
    RAISE EXCEPTION 'pulse secret was not retired';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM "transactions"
    WHERE "id" = 'ci-tx-crypto-unique'
      AND "providerPaymentId" = '123456789'
      AND "providerPriceAmount" = 12.34
      AND "providerPriceCurrency" = 'usd'
      AND "providerPayCurrency" = 'usdttrc20'
  ) THEN
    RAISE EXCEPTION 'unique legacy crypto data was not backfilled';
  END IF;
  IF EXISTS (
    SELECT 1 FROM "transactions"
    WHERE "id" IN ('ci-tx-crypto-duplicate-a', 'ci-tx-crypto-duplicate-b')
      AND "providerPaymentId" IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'ambiguous provider IDs were backfilled';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM "transactions"
    WHERE "id" = 'ci-tx-crypto-wide-price'
      AND "providerPaymentId" = '333333333'
      AND "providerPriceAmount" IS NULL
  ) THEN
    RAISE EXCEPTION 'wide legacy crypto price was not bounded';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM "orders"
    WHERE "id" = 'ci-order-linked'
      AND "serviceNameAtPurchase" = 'Instagram Followers'
      AND "tierNameAtPurchase" = 'Budget'
      AND "platformAtPurchase" = 'instagram'
      AND "serviceTypeAtPurchase" = 'followers'
  ) THEN
    RAISE EXCEPTION 'linked order snapshot was not backfilled';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM "orders"
    WHERE "id" = 'ci-order-note'
      AND "tierNameAtPurchase" = 'Budget'
      AND "serviceNameAtPurchase" IS NULL
  ) THEN
    RAISE EXCEPTION 'recognized note tier was not recovered safely';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM "affiliate_payouts"
    WHERE "id" = 'ci-payout-pending'
      AND "bankName" = 'CI Bank'
      AND "bankAccountNo" = '0000000001'
      AND "bankAccountName" = 'Deleted Marketer'
  ) THEN
    RAISE EXCEPTION 'pending payout snapshot was not preserved';
  END IF;
  IF EXISTS (
    SELECT 1 FROM "affiliate_payouts"
    WHERE "id" = 'ci-payout-completed'
      AND ("bankName" IS NOT NULL OR "bankAccountNo" IS NOT NULL OR "bankAccountName" IS NOT NULL)
  ) THEN
    RAISE EXCEPTION 'terminal payout bank data was not removed';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM "affiliate_commissions"
    WHERE "id" = 'ci-commission-direct'
      AND "status" = 'voided'
      AND "voidReason" = 'member_deleted'
      AND "voidedAt" IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'deleted member commission was not voided';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM "affiliate_commissions"
    WHERE "id" = 'ci-commission-lead'
      AND "status" = 'held'
      AND "leadAmount" = 0
      AND "leadForfeitReason" = 'lead_deleted'
      AND "leadForfeitedAt" IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'deleted lead share was not forfeited';
  END IF;

  IF EXISTS (SELECT 1 FROM "crew_sessions" WHERE "id" = 'ci-crew-session') THEN
    RAISE EXCEPTION 'deleted crew session survived';
  END IF;
  IF EXISTS (SELECT 1 FROM "crew_members" WHERE "id" = 'ci-crew-active' AND "leadId" IS NOT NULL) THEN
    RAISE EXCEPTION 'active child retained a deleted lead';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM "crew_members"
    WHERE "id" = 'ci-crew-deleted'
      AND "status" = 'deleted'
      AND "name" = 'Deleted Pit member ci-crew-deleted'
      AND "email" = 'deleted-ci-crew-deleted@pit.invalid'
      AND "phone" IS NULL
      AND "bankAccountNo" IS NULL
  ) THEN
    RAISE EXCEPTION 'deleted crew identity was not anonymized';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM "acquisition_links"
    WHERE "id" = 'ci-link-owned'
      AND "enabled" = FALSE
      AND "name" = 'Deleted Pit link ci-link-owned'
      AND "archivedAt" IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'deleted member link was not retired';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM "acquisition_links"
    WHERE "id" = 'ci-link-chief-created'
      AND "affiliateId" = 'ci-crew-active'
      AND "enabled" = TRUE
      AND "name" = 'Deleted Pit member campaign'
  ) THEN
    RAISE EXCEPTION 'deleted chief display identity was not redacted';
  END IF;

  IF EXISTS (
    SELECT 1 FROM "activity_log"
    WHERE "id" IN ('ci-activity-crew', 'ci-activity-pit')
      AND ("action" LIKE '%Deleted Chief%' OR "action" LIKE '%Deleted Marketer%' OR "action" LIKE '%@ci.invalid%')
  ) THEN
    RAISE EXCEPTION 'deleted crew identity survived in activity text';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM "activity_log"
    WHERE "id" = 'ci-activity-pit' AND "adminName" = 'Deleted Pit member ci-chief-deleted'
  ) THEN
    RAISE EXCEPTION 'pit-self actor was not anonymized';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM "live_sessions" WHERE "sessionId" = 'ci-live-session') THEN
    RAISE EXCEPTION 'existing live session was not preserved';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname IN (
      'users_deleted_balance_zero',
      'users_deleted_identity_anonymized',
      'crew_members_deleted_identity_anonymized',
      'affiliate_payout_terminal_bank_cleared',
      'affiliate_payout_status_known'
    )
    HAVING COUNT(*) = 5 AND BOOL_AND(convalidated = FALSE)
  ) THEN
    RAISE EXCEPTION 'privacy constraints are missing or unexpectedly validated';
  END IF;

  BEGIN
    UPDATE "users" SET "name" = 'Still Personal' WHERE "id" = 'ci-user-legacy-deleted';
    RAISE EXCEPTION 'deleted-user constraint accepted a stale identity write';
  EXCEPTION WHEN check_violation THEN
    NULL;
  END;
END
$assert$;
