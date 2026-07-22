# Pit Hardening Tracker

Last updated: 30 June 2026

This document tracks the Pit member portal and admin hardening work discovered during the June 2026 audit. It is the source of truth for what has been addressed, what is currently being corrected, and what remains.

## Status legend

- `[x]` Completed and verified
- `[~]` In progress or implemented but awaiting review
- `[ ]` Not started
- `[!]` Blocked or requires a product decision

## Current implementation pass

The first pass is intentionally limited to the highest-risk financial and authorization paths:

- `[x]` Atomic and idempotent commission release implementation
- `[x]` Correct held-versus-approved commission voiding implementation
- `[x]` Strict and concurrency-safe payout state transition implementation
- `[x]` Correct current-role chief earnings calculation: direct earnings plus team-lead earnings
- `[x]` Tracking-link ownership and team-assignment authorization
- `[x]` Snapshot bank details when a payout is requested
- `[~]` Real-database concurrency verification: tests exist but were skipped in the standard run

Review outcome:

- Commission release now uses `UPDATE ... RETURNING` and credits only rows claimed by that invocation.
- Commission voiding now locks eligible rows with `SELECT ... FOR UPDATE` and reverses only their pre-update approved amounts.
- Payout requests now lock the member row and use Serializable isolation with bounded retry.
- Payout completion uses a conditional status update and applies `totalPaid` only when the transition succeeds.
- A deployable payout bank-snapshot migration now exists.
- The three database-backed concurrency tests still need to be executed with `INTEGRATION=1` against an isolated test database.

---

## 1. Financial correctness

### 1.1 Commission release

- `[x]` Make held-to-approved release atomic.
- `[x]` Make release idempotent across retries and overlapping cron executions.
- `[x]` Credit only commissions successfully claimed by the current transaction.
- `[x]` Add an integration test with an old approved commission and one newly releasable commission.
- `[x]` Add a concurrent-release integration test.
- `[~]` Run the integration tests against an isolated real PostgreSQL test database.

Acceptance criteria:

- A commission is credited exactly once.
- A failed transaction leaves both status and balances unchanged.
- Previously approved commissions are never credited again.
- Two simultaneous workers cannot both credit the same commission.

### 1.2 Commission voiding and clawbacks

- `[x]` Do not decrement earnings when voiding a held commission.
- `[x]` Reverse an approved commission exactly once.
- `[x]` Make concurrent void attempts idempotent.
- `[x]` Add a concurrent-void integration test.
- `[~]` Run the integration test against an isolated real PostgreSQL test database.
- `[ ]` Define handling for commissions voided after they have already been paid.
- `[ ]` Add an explicit debt or adjustment mechanism for paid clawbacks.
- `[ ]` Add admin visibility into void reason, actor, time, and financial effect.

Acceptance criteria:

- Held void: status changes to `voided`; credited balance does not change.
- Approved void: credited balance is reversed once.
- Paid void: the system records recoverable debt or an explicit adjustment without corrupting historical payout totals.

### 1.3 Earnings and balances

- `[x]` Count a chief's direct `marketerAmount`.
- `[x]` Count a chief's team `leadAmount`.
- `[x]` Use one shared balance calculation across dashboard and payouts.
- `[ ]` Ensure historical lead earnings remain visible after a chief is demoted.
- `[ ]` Ensure promotion or demotion never changes ownership of historical earnings.
- `[ ]` Update Telegram earnings to use the same shared calculation.
- `[ ]` Update all server-rendered initial Pit page data to use the same calculation.
- `[ ]` Add a reconciliation script comparing commission rows with cached `totalEarned` and `totalPaid`.
- `[ ]` Decide whether cached totals should remain or be replaced by a ledger-derived balance.

Acceptance criteria:

- Role changes do not hide or reclassify historical earnings.
- Dashboard, payouts, Telegram, and admin display the same totals.
- A read-only reconciliation command can explain every discrepancy.

### 1.4 Payout requests and processing

- `[x]` Enforce the payout state machine:
  - `pending -> processing | completed | rejected`
  - `processing -> completed | rejected`
  - `completed` and `rejected` are terminal
- `[x]` Rejection must release the reservation without reducing earned commission.
- `[x]` Prevent repeated completion or rejection.
- `[x]` Prevent concurrent payout requests from overdrawing a balance.
- `[x]` Prevent concurrent completion from incrementing `totalPaid` twice.
- `[x]` Snapshot bank details on the payout record.
- `[x]` Ensure admin payout views prefer the snapshot, with fallback for historical payouts.
- `[~]` Run payout concurrency behavior against an isolated real PostgreSQL test database.
- `[ ]` Require and validate a transfer reference when completing a payout.
- `[ ]` Add payout failure/retry notes and an admin-visible audit trail.
- `[ ]` Rate-limit payout requests.
- `[ ]` Notify the member when a payout is processing, completed, or rejected.

Acceptance criteria:

- All transitions are conditional database updates.
- Side effects occur only when the transition succeeds.
- Two simultaneous requests cannot reserve more than the available balance.
- Changing bank details cannot alter an existing payout destination.

---

## 2. Attribution and tracking links

### 2.1 Link authorization

- `[x]` Verify ownership before reading link logs.
- `[x]` Verify ownership before pausing, resuming, reassigning, or archiving a link.
- `[x]` Restrict assignments to the chief or their approved direct crew.
- `[ ]` Preserve management authority when a link is temporarily unassigned.
- `[ ]` Define who owns a link independently from who currently receives attribution.
- `[ ]` Add an immutable `createdByChiefId` or equivalent management-owner field.

Why this remains important:

Current authorization is based on the link's current affiliate. Reassigning or unassigning a link can accidentally change which chief is allowed to manage it.

### 2.2 Immutable referral attribution

- `[ ]` Stop link reassignment from transferring existing customers' future commissions.
- `[ ]` Freeze affiliate attribution when a user signs up.
- `[ ]` Design a safe backfill for existing users with `signupSource`.
- `[ ]` Require an explicit, audited admin migration to move historical attribution.
- `[ ]` Preserve campaign/link reporting after attribution ownership is frozen.

Acceptance criteria:

- Reassigning a campaign link affects new signups only.
- Existing customers continue crediting the affiliate who originally referred them.
- Every attribution migration records before, after, actor, reason, and time.

### 2.3 Link validity and lifecycle

- `[ ]` Validate `via` server-side during email/password signup.
- `[ ]` Validate `via` during Google signup and callback.
- `[ ]` Reject new affiliate attribution from disabled links.
- `[ ]` Reject new affiliate attribution from archived links.
- `[ ]` Archiving a link must stop new clicks and signups.
- `[ ]` Decide whether existing referred users continue generating commission after a link is paused or archived.
- `[ ]` Use one canonical maximum-link setting.
- `[ ]` Count all links controlled by a chief, including links assigned to their crew.
- `[ ]` Prevent the link cap from being bypassed through reassignment.
- `[ ]` Add database-safe slug creation to avoid check-then-create races.

### 2.4 Fraud controls

- `[ ]` Add same-IP or subnet signup-cluster signals.
- `[ ]` Add device/browser cluster signals where privacy-appropriate.
- `[ ]` Detect suspicious self-referrals beyond exact matching email.
- `[ ]` Add velocity flags for many signups or tiny qualifying orders.
- `[ ]` Surface fraud signals for admin review without automatically punishing legitimate users.
- `[ ]` Record fraud-review decisions and reviewer notes.

---

## 3. Team hierarchy and lifecycle

### 3.1 Hierarchy invariants

- `[ ]` Allow `leadId` only on members with role `crew`.
- `[ ]` Require chiefs to have `leadId = null`.
- `[ ]` Prevent self-assignment.
- `[ ]` Prevent hierarchy cycles.
- `[ ]` Clear `leadId` during promotion to chief.
- `[ ]` Require a destination chief or explicit unassigned state during demotion.
- `[ ]` Validate that assigned chiefs are approved and not deleted.
- `[ ]` Prevent assigning chiefs as ordinary crew members.

### 3.2 Suspension and deletion

- `[ ]` Define what happens to a chief's team when the chief is suspended or deleted.
- `[ ]` Require team and link reassignment before destructive chief actions.
- `[ ]` Stop allocating new lead commissions to suspended, rejected, or deleted chiefs.
- `[ ]` Preserve historical commissions and payout records after soft deletion.
- `[ ]` Ensure suspended/deleted members cannot retain active sessions or Telegram access.
- `[ ]` Add an admin preview showing affected members, links, and money before lifecycle actions.

### 3.3 Team invitations

- `[ ]` Generate `/pit/join/{token}` URLs instead of `/m/join/{token}`.
- `[ ]` Send an actual invitation email or change the UI wording from “Invite sent” to “Invite created.”
- `[ ]` Add resend, revoke, and regenerate actions.
- `[ ]` Require the expected pending/invited state when accepting an invitation.
- `[ ]` Ensure rejected, suspended, or deleted members cannot reuse an old token.
- `[ ]` Clear invite tokens during rejection and deletion.
- `[ ]` Make member activation, linked Nitro user creation, and Pit session creation transactional.
- `[ ]` Enforce a configurable team-size limit if one is required operationally.

---

## 4. Authentication and account security

- `[ ]` Rate-limit Pit login.
- `[ ]` Rate-limit Pit applications and team invitations.
- `[ ]` Require verified proof before attaching a Pit application to an existing Nitro `userId`.
- `[ ]` Remove fallback verification secrets.
- `[ ]` Hash Pit session tokens at rest.
- `[ ]` Invalidate other sessions after a password change.
- `[ ]` Add session management and remote logout.
- `[ ]` Use cryptographically secure Telegram linking codes.
- `[ ]` Make Telegram linking codes unique, single-use, and expiring.
- `[ ]` Prevent one Telegram identity from linking to multiple Pit members.
- `[ ]` Notify members of password, bank-account, and Telegram-link changes.
- `[ ]` Consider reauthentication before changing payout bank details.
- `[ ]` Apply the same validation and normalization rules used by the main Nitro auth system.

---

## 5. Settings and policy consistency

### 5.1 Canonical settings

The intended canonical keys are:

- `affiliate_enabled`
- `affiliate_starter_rate`
- `affiliate_growth_rate`
- `affiliate_pro_rate`
- `affiliate_lead_split`
- `affiliate_growth_threshold`
- `affiliate_pro_threshold`
- `affiliate_hold_days`
- `affiliate_min_payout`
- `affiliate_min_order`
- `affiliate_max_links`

Outstanding work:

- `[ ]` Replace or migrate `crew_enabled`.
- `[ ]` Replace or migrate `affiliate_max_links_chief`.
- `[ ]` Ensure the UI, API, cron jobs, and playbook use the same keys.
- `[ ]` Enforce `affiliate_enabled` in applications.
- `[ ]` Define and enforce whether disabling the program stops only new applications, new attribution, or new commissions.
- `[ ]` Validate percentage settings within `0–100`.
- `[ ]` Validate that Growth threshold is lower than Pro threshold.
- `[ ]` Validate sensible bounds for hold days, minimums, and link limits.
- `[ ]` Use identical defaults everywhere.

### 5.2 Tier policy

- `[ ]` Decide whether chiefs are permanently Pro or participate in automatic tier recalculation.
- `[ ]` If chiefs are permanently Pro, exclude them from automatic demotion.
- `[ ]` If chiefs are not permanently Pro, correct the admin UI and playbook.
- `[ ]` Ensure manual tier overrides are either durable or clearly temporary.
- `[ ]` Record tier-change history and its source: automatic, settings update, or admin override.

---

## 6. Admin security and operations

- `[ ]` Mask payout bank details for admins without sensitive-data permission.
- `[ ]` Ensure Crew-page settings use an appropriate permission rather than unexpectedly requiring global Settings access.
- `[ ]` Replace activity-log substring filtering with structured categories.
- `[ ]` Include payout, commission, link, team, tier, and settings events in Pit activity.
- `[ ]` Add commission inspection and audited adjustment tools.
- `[ ]` Add payout reconciliation and bank-snapshot views.
- `[ ]` Add orphaned-team and orphaned-link diagnostics.
- `[ ]` Add balance discrepancy reporting.
- `[ ]` Add outstanding commission and payout liability reporting.
- `[ ]` Add attributed revenue, gross profit, commission cost, and Pit ROI reporting.
- `[ ]` Add pagination and filtering for members, commissions, payouts, and activity at scale.
- `[ ]` Require confirmation text or stronger safeguards for financially destructive admin actions.

---

## 7. Member and chief experience

- `[ ]` Show a transparent balance breakdown:
  - held
  - approved
  - reserved in pending payouts
  - paid
  - voided
  - debt or adjustments
- `[ ]` Explain why and when held commissions release.
- `[ ]` Show payout destination snapshots in payout history.
- `[ ]` Give chiefs per-member signups, paying users, orders, revenue, profit, commission, and conversion rate.
- `[ ]` Add campaign-level signup and revenue metrics to tracking links.
- `[ ]` Add invite resend/revoke controls.
- `[ ]` Replace silently swallowed fetch failures with visible retryable errors.
- `[ ]` Retain existing data on screen when a refresh fails.
- `[ ]` Add useful empty, loading, stale, and permission-denied states.
- `[ ]` Align all `/m` references with `/pit`, unless redirects/aliases are intentionally supported.

---

## 8. Notifications and integrations

- `[ ]` Use the shared chief earnings calculation in Telegram `/earnings`.
- `[ ]` Send invitation emails.
- `[ ]` Send commission-created and commission-released notifications where appropriate.
- `[ ]` Send payout processing, completion, and rejection notifications.
- `[ ]` Notify chiefs when a crew member joins, is suspended, or changes tier.
- `[ ]` Ensure notification failures do not roll back financial transactions.
- `[ ]` Queue or retry important notification deliveries.
- `[ ]` Add observability for Telegram and email failures.

---

## 9. Database, migration, and reconciliation

- `[x]` Add payout bank snapshot fields to the Prisma schema.
- `[x]` Add a deployable migration for payout bank snapshot fields.
- `[ ]` Backfill snapshot fields for existing pending/processing payouts where possible.
- `[ ]` Add constraints or enums for role, member status, commission status, and payout status.
- `[ ]` Add hierarchy constraints where feasible.
- `[ ]` Add indexes required by new reconciliation and attribution queries.
- `[ ]` Build a read-only reconciliation report for:
  - approved commissions versus `totalEarned`
  - completed payouts versus `totalPaid`
  - negative or overdrawn balances
  - duplicate financial effects
  - orphaned links, teams, and attribution
- `[ ]` Require an explicit flag before any reconciliation script mutates data.
- `[ ]` Document production migration and rollback steps.

---

## 10. Test coverage

Currently added:

- `[x]` Commission release/void unit tests
- `[x]` Payout transition tests
- `[x]` Link ownership tests
- `[x]` Database-backed release/void integration test definitions
- `[~]` Execute the database-backed tests; they were skipped in the 70-test standard run

Still required:

- `[x]` Database-backed concurrent release test definition
- `[x]` Database-backed concurrent void test definition
- `[ ]` Database-backed concurrent payout request test
- `[ ]` Database-backed concurrent payout completion test
- `[ ]` Historical chief earnings after demotion test
- `[ ]` Link reassignment attribution-preservation test
- `[ ]` Disabled/archived-link signup rejection tests
- `[ ]` Rejected-invite reuse test
- `[ ]` Hierarchy cycle and self-assignment tests
- `[ ]` Program-disable behavior tests
- `[ ]` Settings-name and default-consistency tests
- `[ ]` Bank snapshot authorization and immutability tests
- `[ ]` Full Pit member journey test
- `[ ]` Full chief journey test
- `[ ]` Full admin approval-to-payout journey test

---

## Recommended implementation order

### Phase 1 — finish current money-safety pass

1. Correct atomic claiming for release and void.
2. Correct payout reservation and completion concurrency.
3. Verify chief earnings everywhere.
4. Verify link authorization after reassignment/unassignment.
5. Add the database migration and concurrency-focused tests.

### Phase 2 — attribution and hierarchy

1. Freeze referral ownership.
2. Validate affiliate links during signup.
3. Correct archive/disable behavior.
4. Enforce hierarchy invariants.
5. Correct invitation lifecycle.

### Phase 3 — auth and settings

1. Harden login, sessions, verification, Telegram linking, and bank changes.
2. Migrate canonical setting names.
3. Enforce the program switch and setting validation.
4. Resolve chief tier policy.

### Phase 4 — admin operations and UX

1. Add reconciliation and liability reporting.
2. Add fraud-review signals.
3. Add structured audit logs and operational notifications.
4. Improve team/campaign analytics and error states.

---

## Product decisions required

These should be answered before their implementation:

- `[!]` Do existing referred users continue earning commission after their original link is paused or archived?
- `[!]` Can historical customer attribution ever be transferred? If yes, who may do it and what audit trail is required?
- `[!]` Are chiefs permanently on the Pro rate?
- `[!]` What happens to a chief's team and future lead share when the chief is suspended or deleted?
- `[!]` How should already-paid commissions be clawed back after refunds or cancellations?
- `[!]` Does disabling the Pit program stop applications only, new attribution, or all new commissions?
- `[!]` Is a bank transfer reference mandatory before marking a payout completed?
- `[!]` Should invited crew members be auto-approved on joining, or require admin approval?

## Completion rule

Do not mark an item `[x]` merely because code was written or mocked tests passed. Mark it complete only after:

1. The implementation has been reviewed against the stated acceptance criteria.
2. Relevant regression tests pass.
3. The production build succeeds.
4. Any required Prisma migration exists and has a rollback plan.
5. The change does not depend on unstated product behavior.
