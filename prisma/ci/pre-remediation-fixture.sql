-- Synthetic pre-remediation rows used only by the disposable CI database.
-- These exercise data-changing migrations without copying production data.

INSERT INTO "settings" ("key", "value", "updatedAt")
VALUES ('pulse_secret_key', 'ci-retired-secret', CURRENT_TIMESTAMP)
ON CONFLICT ("key") DO UPDATE SET "value" = EXCLUDED."value";

INSERT INTO "users" (
  "id", "email", "password", "name", "referralCode", "balance", "status",
  "createdAt", "updatedAt"
) VALUES
  ('ci-user-active', 'active@ci.invalid', 'ci-password', 'CI Active', 'ci-active-ref', 0, 'Active', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('ci-user-legacy-deleted', 'legacy-deleted@ci.invalid', 'legacy-password', 'Legacy Deleted', 'ci-legacy-ref', 100, 'Deleted', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

INSERT INTO "services" (
  "id", "apiId", "name", "category", "provider", "costPer1k", "sellPer1k",
  "createdAt", "updatedAt"
) VALUES (
  'ci-service', 990001, 'Provider Raw Followers', 'Instagram Followers', 'mtp',
  100, 200, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
);

INSERT INTO "service_groups" (
  "id", "name", "platform", "type", "createdAt", "updatedAt"
) VALUES (
  'ci-group', 'Instagram Followers', 'instagram', 'followers', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
);

INSERT INTO "service_tiers" (
  "id", "groupId", "serviceId", "tier", "sellPer1k", "createdAt", "updatedAt"
) VALUES (
  'ci-tier', 'ci-group', 'ci-service', 'Budget', 200, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
);

INSERT INTO "orders" (
  "id", "orderId", "userId", "serviceId", "tierId", "link", "quantity",
  "charge", "cost", "status", "createdAt", "updatedAt"
) VALUES
  ('ci-order-linked', 'NTR-CI-LINKED', 'ci-user-active', 'ci-service', 'ci-tier', 'https://example.test/linked', 100, 20, 10, 'Completed', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('ci-order-note', 'NTR-CI-NOTE', 'ci-user-active', 'ci-service', NULL, 'https://example.test/note', 100, 20, 10, 'Completed', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

INSERT INTO "transactions" (
  "id", "userId", "type", "amount", "method", "reference", "status", "note", "createdAt"
) VALUES
  ('ci-tx-order-note', 'ci-user-active', 'order', -20, NULL, 'NTR-CI-NOTE', 'Completed', 'Instagram Followers (Budget) x100', CURRENT_TIMESTAMP),
  ('ci-tx-crypto-unique', 'ci-user-active', 'deposit', 2000, 'crypto', 'CI-CRYPTO-UNIQUE', 'Pending', 'Crypto deposit ($12.34 USDT) [np:123456789]', CURRENT_TIMESTAMP),
  ('ci-tx-crypto-duplicate-a', 'ci-user-active', 'deposit', 2000, 'crypto', 'CI-CRYPTO-DUP-A', 'Pending', 'Crypto deposit ($13 USDT) [np:222222222]', CURRENT_TIMESTAMP),
  ('ci-tx-crypto-duplicate-b', 'ci-user-active', 'deposit', 2000, 'crypto', 'CI-CRYPTO-DUP-B', 'Pending', 'Crypto deposit ($13 USDT) [np:222222222]', CURRENT_TIMESTAMP),
  ('ci-tx-crypto-wide-price', 'ci-user-active', 'deposit', 2000, 'crypto', 'CI-CRYPTO-WIDE', 'Pending', 'Crypto deposit ($1234567890123456789 USDT) [np:333333333]', CURRENT_TIMESTAMP);

INSERT INTO "crew_members" (
  "id", "role", "status", "name", "email", "password", "phone", "xHandle",
  "telegramHandle", "whyApply", "bankAccountName", "bankName", "bankAccountNo",
  "teamName", "deletedAt", "createdAt", "updatedAt"
) VALUES
  ('ci-crew-deleted', 'crew', 'approved', 'Deleted Marketer', 'deleted-marketer@ci.invalid', 'crew-password', '+2348000000001', '@deleted', '@deleted_telegram', 'Historical PII', 'Deleted Marketer', 'CI Bank', '0000000001', 'Deleted Team', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('ci-chief-deleted', 'chief', 'deleted', 'Deleted Chief', 'deleted-chief@ci.invalid', 'chief-password', '+2348000000002', '@chief', '@chief_telegram', 'Historical chief PII', 'Deleted Chief', 'CI Bank', '0000000002', 'Chief Team', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('ci-crew-active', 'crew', 'approved', 'Active Marketer', 'active-marketer@ci.invalid', 'active-password', NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'Active Team', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

UPDATE "crew_members" SET "leadId" = 'ci-chief-deleted' WHERE "id" = 'ci-crew-active';

INSERT INTO "acquisition_links" (
  "id", "name", "slug", "enabled", "affiliateId", "createdByChiefId", "createdAt", "updatedAt"
) VALUES
  ('ci-link-owned', 'Deleted Marketer personal link', 'ci-deleted-owned', TRUE, 'ci-crew-deleted', 'ci-crew-deleted', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('ci-link-chief-created', 'Deleted Chief campaign', 'ci-chief-created', TRUE, 'ci-crew-active', 'ci-chief-deleted', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

INSERT INTO "crew_sessions" ("id", "memberId", "token", "expiresAt", "createdAt")
VALUES ('ci-crew-session', 'ci-crew-deleted', 'ci-session-token', CURRENT_TIMESTAMP + INTERVAL '1 day', CURRENT_TIMESTAMP);

INSERT INTO "affiliate_commissions" (
  "id", "orderId", "linkId", "memberId", "leadId", "orderCharge", "orderCost",
  "commissionRate", "leadSplit", "leadAmount", "marketerAmount", "status",
  "releasesAt", "createdAt"
) VALUES
  ('ci-commission-direct', 'ci-order-linked', 'ci-link-owned', 'ci-crew-deleted', 'ci-crew-deleted', 20, 10, 30, 20, 1, 2, 'held', CURRENT_TIMESTAMP + INTERVAL '7 days', CURRENT_TIMESTAMP),
  ('ci-commission-lead', 'ci-order-note', 'ci-link-chief-created', 'ci-crew-active', 'ci-chief-deleted', 20, 10, 30, 20, 1, 2, 'held', CURRENT_TIMESTAMP + INTERVAL '7 days', CURRENT_TIMESTAMP);

INSERT INTO "affiliate_payouts" (
  "id", "memberId", "amount", "status", "bankName", "bankAccountNo",
  "bankAccountName", "createdAt"
) VALUES
  ('ci-payout-pending', 'ci-crew-deleted', 1000, 'pending', NULL, NULL, NULL, CURRENT_TIMESTAMP),
  ('ci-payout-completed', 'ci-crew-deleted', 2000, 'completed', 'Old Bank', '9999999999', 'Deleted Marketer', CURRENT_TIMESTAMP);

INSERT INTO "activity_log" ("id", "adminName", "action", "type", "createdAt")
VALUES
  ('ci-activity-crew', 'Admin', 'Reviewed Deleted Marketer deleted-marketer@ci.invalid', 'crew', CURRENT_TIMESTAMP),
  ('ci-activity-pit', 'Deleted Chief', 'Deleted Chief updated deleted-chief@ci.invalid', 'pit-self', CURRENT_TIMESTAMP);

INSERT INTO "live_sessions" ("sessionId", "userId", "page", "ua", "lastSeen", "firstSeen")
VALUES ('ci-live-session', 'ci-user-active', '/dashboard', 'CI browser', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
