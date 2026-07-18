ALTER TABLE "affiliate_commissions"
  ADD COLUMN "leadForfeitedAt" TIMESTAMP(3),
  ADD COLUMN "leadForfeitReason" TEXT;

-- Preserve the transfer destination only for obligations that still require
-- admin disposition. Fill partial legacy snapshots before erasing member data.
UPDATE "affiliate_payouts" AS payout
SET
  "bankName" = COALESCE(payout."bankName", member."bankName"),
  "bankAccountNo" = COALESCE(payout."bankAccountNo", member."bankAccountNo"),
  "bankAccountName" = COALESCE(payout."bankAccountName", member."bankAccountName")
FROM "crew_members" AS member
WHERE payout."memberId" = member.id
  AND payout.status IN ('pending', 'processing')
  AND (member."deletedAt" IS NOT NULL OR member.status = 'deleted');

-- A settled or rejected payout retains its amount, reference, status, member
-- ID and timestamps for audit, but no longer retains a bank destination.
UPDATE "affiliate_payouts"
SET "bankName" = NULL, "bankAccountNo" = NULL, "bankAccountName" = NULL
WHERE status NOT IN ('pending', 'processing');

-- A deleted member cannot receive held earnings. Direct held rows are voided;
-- if only the chief is deleted, record forfeiture of the lead share while the
-- active marketer's original amount remains releasable.
UPDATE "affiliate_commissions" AS commission
SET
  status = 'voided',
  "voidedAt" = COALESCE(member."deletedAt", CURRENT_TIMESTAMP),
  "voidReason" = 'member_deleted'
FROM "crew_members" AS member
WHERE commission."memberId" = member.id
  AND commission.status = 'held'
  AND (member."deletedAt" IS NOT NULL OR member.status = 'deleted');

UPDATE "affiliate_commissions" AS commission
SET
  "leadAmount" = 0,
  "leadForfeitedAt" = COALESCE(lead."deletedAt", CURRENT_TIMESTAMP),
  "leadForfeitReason" = 'lead_deleted'
FROM "crew_members" AS lead
WHERE commission."leadId" = lead.id
  AND commission."memberId" <> lead.id
  AND commission.status = 'held'
  AND (lead."deletedAt" IS NOT NULL OR lead.status = 'deleted');

-- Redact existing admin activity before replacing the legacy identity.
UPDATE "activity_log" AS activity
SET action = replace(
  replace(activity.action, member.name, 'Deleted Pit member'),
  member.email,
  'Deleted Pit member'
)
FROM "crew_members" AS member
WHERE activity.type = 'crew'
  AND (member."deletedAt" IS NOT NULL OR member.status = 'deleted')
  AND (position(member.name in activity.action) > 0 OR position(member.email in activity.action) > 0);

-- Pit self-service events used the member name as the actor. Scope the rewrite
-- to pit-self rows so unrelated admin identities are not changed.
UPDATE "activity_log" AS activity
SET
  "adminName" = 'Deleted Pit member ' || member.id,
  action = replace(
    replace(activity.action, member.name, 'Deleted Pit member'),
    member.email,
    'Deleted Pit member'
  )
FROM "crew_members" AS member
WHERE activity.type = 'pit-self'
  AND activity."adminName" = member.name
  AND (member."deletedAt" IS NOT NULL OR member.status = 'deleted');

-- Name-derived link labels and slugs are not financial records. Keep link IDs,
-- ownership and click/commission relations while removing their display PII.
UPDATE "acquisition_links" AS link
SET
  name = 'Deleted Pit link ' || link.id,
  slug = 'pit-deleted-' || link.id || '-' || md5('nitro-pit-link:v1:' || link.id),
  enabled = FALSE,
  "archivedAt" = COALESCE(link."archivedAt", member."deletedAt", CURRENT_TIMESTAMP)
FROM "crew_members" AS member
WHERE (member."deletedAt" IS NOT NULL OR member.status = 'deleted')
  AND link."affiliateId" = member.id;

-- A chief creator ID is retained for audit. Links assigned to another active
-- affiliate remain live; only a display name that embeds the deleted chief's
-- identity is redacted.
UPDATE "acquisition_links" AS link
SET name = replace(
  replace(link.name, member.name, 'Deleted Pit member'),
  member.email,
  'Deleted Pit member'
)
FROM "crew_members" AS member
WHERE (member."deletedAt" IS NOT NULL OR member.status = 'deleted')
  AND link."createdByChiefId" = member.id
  AND link."affiliateId" IS DISTINCT FROM member.id
  AND (position(member.name in link.name) > 0 OR position(member.email in link.name) > 0);

DELETE FROM "crew_sessions" AS session
USING "crew_members" AS member
WHERE session."memberId" = member.id
  AND (member."deletedAt" IS NOT NULL OR member.status = 'deleted');

UPDATE "crew_members" AS child
SET "leadId" = NULL
FROM "crew_members" AS deleted_lead
WHERE child."leadId" = deleted_lead.id
  AND child."deletedAt" IS NULL
  AND (deleted_lead."deletedAt" IS NOT NULL OR deleted_lead.status = 'deleted');

UPDATE "crew_members"
SET
  status = 'deleted',
  "deletedAt" = COALESCE("deletedAt", "updatedAt", "createdAt"),
  name = 'Deleted Pit member ' || id,
  email = 'deleted-' || id || '@pit.invalid',
  password = '!deleted:' || id,
  phone = NULL,
  "xHandle" = NULL,
  "telegramHandle" = NULL,
  "telegramUserId" = NULL,
  "telegramLinkCode" = NULL,
  "telegramLinkCodeExpiresAt" = NULL,
  "whyApply" = NULL,
  "bankAccountName" = NULL,
  "bankName" = NULL,
  "bankAccountNo" = NULL,
  "userId" = NULL,
  "teamName" = NULL,
  "leadId" = NULL,
  "inviteToken" = NULL,
  "inviteExpiresAt" = NULL,
  "resetToken" = NULL,
  "resetExpires" = NULL
WHERE "deletedAt" IS NOT NULL OR status = 'deleted';

-- These NOT VALID constraints protect every new/updated row immediately while
-- avoiding a deployment-blocking validation scan of unrelated legacy rows.
ALTER TABLE "crew_members"
  ADD CONSTRAINT "crew_members_deleted_identity_anonymized"
  CHECK (
    status <> 'deleted'
    OR (
      "deletedAt" IS NOT NULL
      AND name = 'Deleted Pit member ' || id
      AND email = 'deleted-' || id || '@pit.invalid'
      AND password = '!deleted:' || id
      AND phone IS NULL
      AND "xHandle" IS NULL
      AND "telegramHandle" IS NULL
      AND "telegramUserId" IS NULL
      AND "telegramLinkCode" IS NULL
      AND "telegramLinkCodeExpiresAt" IS NULL
      AND "whyApply" IS NULL
      AND "bankAccountName" IS NULL
      AND "bankName" IS NULL
      AND "bankAccountNo" IS NULL
      AND "userId" IS NULL
      AND "teamName" IS NULL
      AND "leadId" IS NULL
      AND "inviteToken" IS NULL
      AND "inviteExpiresAt" IS NULL
      AND "resetToken" IS NULL
      AND "resetExpires" IS NULL
    )
  ) NOT VALID;

ALTER TABLE "affiliate_payouts"
  ADD CONSTRAINT "affiliate_payout_terminal_bank_cleared"
  CHECK (
    status IN ('pending', 'processing')
    OR ("bankName" IS NULL AND "bankAccountNo" IS NULL AND "bankAccountName" IS NULL)
  ) NOT VALID;

ALTER TABLE "affiliate_payouts"
  ADD CONSTRAINT "affiliate_payout_status_known"
  CHECK (status IN ('pending', 'processing', 'completed', 'rejected')) NOT VALID;
