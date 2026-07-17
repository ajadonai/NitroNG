# Nitro flaw remediation plan

**Created:** 16 July 2026
**Purpose:** Preserve the flaw-fixing order and give each implementation pass a bounded scope. Upgrade work is deliberately excluded until these flaws are handled.

## Starting position

- Production build passes.
- 486 tests pass and 3 are skipped after the Phase 1 correction pass.
- Production dependency audit reports no known vulnerabilities.
- The configured database currently has 24 migrations and reports as up to date.
- The repository already contains unrelated working changes. Preserve them and do not clean, reset, or overwrite them.

## Working rules

1. Complete one phase at a time.
2. Keep each active phase unstaged and uncommitted until the user approves a consolidation checkpoint. Phases 1–3 form the first approved checkpoint before Phase 4 begins.
3. Add regression tests with every fix.
4. Run targeted tests, the full test suite, the production build, and scoped linting before closing a phase.
5. Do not deploy as part of a remediation phase unless deployment is requested separately.
6. Do not run destructive seed or cleanup routines against a shared or production database.
7. Do not mix unrelated refactoring into security or payment fixes.
8. Record changed files, tests run, remaining risks, and deliberately deferred work at the end of each phase.

## Phase order

| Phase | Scope | Flaws covered | Status |
|---|---|---|---|
| 1 | Critical containment | 1, 2, 3, 27 | Included in Phase 1–3 consolidation |
| 2 | Payment foundation | 7, 8, 28 | Included in Phase 1–3 consolidation |
| 3 | Flutterwave reliability | 4 | Approved; included in Phase 1–3 consolidation |
| 4 | Crypto payment integrity | 5, 6 | Included in Phase 4–5 consolidation; independently approved |
| 5 | Internal dashboard protection | 9, 10, 16, 17 | Included in consolidation; user review pending |
| 6 | Privacy and account deletion | 11, 12 | Not started |
| 7 | Public UI correctness | 13, 14, 15, 23, 24, 25 | Not started |
| 8 | Deployment safety | 18, 19, 20, 21, 22 | Not started |
| 9 | Quality and monitoring | 26, 29, 30 | Not started |
| 10 | Maintainability | 31 | Not started |

Payment work stays split across Phases 2–4. Each payment phase needs a focused review because mistakes directly affect customer balances.

## Flaw index

1. Daily and admin cleanup can delete legitimate customer accounts.
2. The documented setup and seed routine can wipe a shared or live database.
3. Blog content has a stored JavaScript injection path during server rendering.
4. Flutterwave verification can strand deposits in `Processing` and incorrectly report them as credited.
5. Crypto deposits do not fully validate the received amount, asset, currency, or provider payment ID.
6. Crypto refunds do not reliably reverse an already completed wallet credit.
7. Deposit finalisation is duplicated across webhooks, polling, cron, admin, and recovery routes, and the copies disagree.
8. Referral rewards can be paid twice during concurrent requests.
9. Pulse and Live dashboards expose long-lived access keys in URLs.
10. Production rate limiting silently weakens to per-instance memory when Redis is missing or unavailable.
11. Permanent deletion retains personal information instead of fully anonymising it.
12. Deleted referrers can remain linked and may continue receiving rewards.
13. Homepage order and activity statistics are artificially increased.
14. Some public statistics do not match their labels.
15. Affiliate query handling can make the server and browser render different authentication screens.
16. The public heartbeat endpoint creates frequent, weakly controlled database writes.
17. Heartbeat cleanup depends on someone opening the Live dashboard.
18. Deployment documentation refers to obsolete providers and environment variables.
19. Missing application URL configuration can produce localhost links in production messages.
20. Important production environment variables are not validated consistently.
21. Deployments are not gated on required database migrations.
22. A migration and CI workflow are currently untracked and could be omitted from deployment.
23. Important authentication inputs lack complete form and label semantics.
24. The `Remember me` option is displayed but does not change session behaviour.
25. Destructive confirmation dialogs lack complete keyboard and focus handling.
26. Full linting scans generated output and produces too much noise to protect the main branch.
27. The seed script contains a parsing error hidden by the lint noise.
28. Critical payment timeout, retry, duplicate callback, refund, and concurrency paths lack integration coverage.
29. Critical customer journeys lack browser-level regression coverage.
30. Some server request errors are logged but not forwarded to Sentry.
31. Several application files are too large to review and change safely.

## Phase 1 — Critical containment

### Scope

1. Fix the daily cron and admin cleanup routes so they cannot delete legitimate customers.
2. Protect `prisma/seed.js` from running against production or a shared live database.
3. Remove fixed seed credentials and stop printing passwords.
4. Sanitize blog content on the server before it reaches `dangerouslySetInnerHTML`.
5. Remove the raw HTML passthrough in the blog renderer.
6. Fix the parsing error in the seed script.

### Main files to inspect

- `app/api/cron/daily/route.js`
- `app/api/admin/cleanup/route.js`
- `docs/DEPLOYMENT.md`
- `prisma/seed.js`
- `lib/markdown.js`
- `components/blog-post.jsx`
- `next.config.mjs`

### Required tests

- A verified customer older than 30 days with no orders or balance is retained.
- Accounts with recent activity or related records are retained.
- Only an explicitly defined disposable-account state can qualify for automatic cleanup.
- The seed script refuses production or shared-live configuration before issuing a delete query.
- Missing or ambiguous environment configuration causes the seed script to fail closed.
- Malicious scripts, event handlers, unsafe URLs, and dangerous HTML are removed during server rendering.
- Safe Markdown and approved formatting still render correctly.

### Completion criteria

- No legitimate customer can be selected by age, zero balance, and order count alone.
- The seed routine cannot reach destructive queries in production.
- No known password is created or printed by the seed routine.
- Blog HTML is safe in the initial server response, not only after browser hydration.
- Targeted tests, full tests, build, and scoped linting pass.

### Phase 1 handoff

> Work on Phase 1 only: critical containment.
>
> Fix the daily cron and admin cleanup routes so they cannot delete legitimate customer accounts. Verified, active, recently used, or otherwise legitimate accounts must never qualify merely because they are older than 30 days with no balance or orders. Prefer disabling automatic hard deletion when account intent is unclear.
>
> Protect `prisma/seed.js` from running against production or a shared live database. It must fail closed before deleting anything. Remove fixed admin credentials and do not print passwords. Fix the parsing error in the seed script.
>
> Fix blog stored-XSS by sanitising content on the server before it reaches `dangerouslySetInnerHTML`. Remove the raw HTML passthrough and use one allowlist for server and browser rendering.
>
> Preserve existing uncommitted work. Do not run the seed script, write to the production database, deploy, or perform unrelated refactoring. Add the regression tests listed in this plan. Run targeted tests, the full test suite, the production build, and scoped linting. Report changed files, tests run, remaining risks, and deliberately deferred work.
>
> Leave every change unstaged and uncommitted for the final combined flaw-remediation commit.

## Phase 2 — Payment foundation

### Scope

- Capture the current behaviour of every deposit entry point with regression tests.
- Create one transaction-safe deposit-finalisation service.
- Make wallet credit, transaction completion, coupon use, welcome bonus, referral reward, and notification behaviour consistent.
- Add database-backed uniqueness for wallet credits, referral rewards, coupons, and bonuses where appropriate.
- Route webhooks, polling, cron, admin recovery, and Telegram recovery through the shared service.

### Completion criteria

- A deposit can be finalised only once, including under concurrent requests.
- All entry points produce the same financial result.
- Failed notifications cannot roll back or duplicate a successful wallet credit.
- Existing payment behaviour is covered before provider-specific changes begin.

### Phase 2 implementation record

**Status:** Fixed locally on 16 July 2026 and included in the user-approved Phase 1–3 consolidation checkpoint.

The seven live deposit completion paths now use `lib/deposit-finalization.js`:

- Flutterwave webhook
- authenticated Flutterwave verification
- NOWPayments webhook
- authenticated crypto polling
- payment recovery cron
- admin manual approval
- Telegram manual approval

The cron route now delegates to `lib/payment-recovery.js` instead of maintaining a second copy of the credit logic.

Financial invariants now enforced:

1. The existing deposit row is the principal-credit claim. A conditional status update and the wallet increment happen inside the same serializable database transaction, so only one caller can win.
2. Deposit completion, principal credit, coupon credit/use count, welcome credit, and qualifying referral credits commit or roll back together.
3. Coupon, welcome, referrer, and invitee ledger rows carry deterministic `Transaction.idempotencyKey` values. The existing database unique constraint on `(userId, idempotencyKey)` is the final duplicate guard. Legacy note markers are still recognised.
4. Coupon JSON is locked before its durable per-user usage check. The finaliser consistently enforces enabled, expiry, max-use, minimum-deposit, maximum-deposit, and new-user-only rules.
5. Notification work begins only after the financial transaction commits and only for the winning caller. Meta CAPI, Telegram, deposit email, referral email, and withheld-bonus alerts share that post-commit boundary; failures are contained.
6. Every finaliser rechecks that it is operating on a deposit and that the supplied kobo amount exactly matches the stored expected amount.

Implementation assumptions recorded for later payment phases:

- All wallet and bonus amounts are safe integer kobo values.
- A payment reference identifies one deposit transaction.
- PostgreSQL row locks and serializable interactive transactions are available.
- The `coupons` setting remains the canonical coupon document.
- Referral thresholds and rewards remain stored in kobo, and `referredBy` continues to resolve through `User.referralCode`.
- Provider-specific authenticity and payment-detail validation happens before the shared finaliser. Phase 3 and Phase 4 still own gaps in those checks.

Files added:

- `lib/deposit-finalization.js`
- `lib/deposit-notifications.js`
- `tests/deposit-entrypoints.test.js`
- `tests/deposit-finalization-properties.test.js`
- `tests/deposit-finalization.test.js`
- `tests/deposit-notifications.test.js`
- `tests/payment-initialize-safety.test.js`

Existing files changed for Phase 2:

- `app/api/payments/initialize/route.js`
- `app/api/payments/webhook/route.js`
- `app/api/payments/verify/route.js`
- `app/api/payments/crypto/webhook/route.js`
- `app/api/payments/crypto/route.js`
- `app/api/cron/payments/route.js`
- `app/api/admin/payments/route.js`
- `app/api/telegram/webhook/route.js`
- `lib/payment-recovery.js`
- `lib/welcome-bonus.js`
- `lib/telegram.js`

Verification completed:

- Focused payment tests: passed.
- Full Vitest suite: 516 passed, 3 skipped.
- Production build: passed.
- Prisma schema validation: passed.
- Migration status: 24 migrations found; database schema up to date.
- Production dependency audit: 0 known vulnerabilities.
- Scoped ESLint: 0 errors. Four pre-existing unused-variable warnings remain in the large Telegram webhook route.
- `git diff --check`: passed.

Deliberately deferred risks:

- Phase 3 still owns Flutterwave verification leases, retryable transport failures, stranded `Processing` states, and the incorrect `Processing`/`Already credited` response.
- Phase 4 still owns crypto amount, asset, currency, provider-payment-ID, underpayment/overpayment, refund, and reordered-callback validation. The recovery helper still uses the legacy crypto identifier behaviour until that phase.
- Notifications are post-commit and at-most-once per winning request, but there is no durable outbox. A process crash after commit and before notification dispatch can lose a notification without affecting money.
- A dedicated immutable payment-effect table would be cleaner long-term. Phase 2 uses the existing durable transaction uniqueness constraint to avoid introducing a payment migration while the repository's wider migration history still needs the Phase 8 reconciliation pass.

## Phase 3 — Flutterwave reliability

### Scope

- Replace the unsafe `Pending` to `Processing` claim with a recoverable verification lease or equivalent design.
- Distinguish credited, verifying, provider-pending, failed, and retryable transport states.
- Never return `Already credited` unless wallet credit and transaction completion are confirmed.
- Add reconciliation for stale verification attempts.

### Completion criteria

- Timeouts and provider errors remain retryable.
- A later valid webhook can recover an interrupted verification.
- Concurrent verification, webhook, and cron attempts credit the wallet once.
- Customer-facing status always matches the stored financial result.

### Phase 3 implementation record

**Status:** Fixed, independently reviewed, and approved with no corrections. Included in the user-approved Phase 1–3 consolidation checkpoint created before Phase 4.

Reliability invariants now enforced:

1. Every Flutterwave result is classified as credited, verifying, provider-pending, failed, or retryable. Provider transport failures, timeouts, malformed responses, unknown statuses, and untrusted pending/terminal identities remain retryable.
2. A successful payment is accepted only when Flutterwave reports `successful` and the reference, `NGN` currency, and exact kobo amount match the stored deposit.
3. Provider queries use short-lived, cross-instance leases in the existing `idempotency_keys` table. Unique insert/CAS takeover, owner tokens, expiry, renewal fencing, and token-guarded release prevent duplicate provider traffic and safely recover crashed workers without holding a database transaction across network I/O.
4. The public verification route is rate-limited per authenticated account. The reserved internal lease-key namespace is rejected by the public bulk-order idempotency input.
5. The shared Phase 2 finaliser remains the only wallet-credit path. `Already credited` is returned only when the reconciler state, durable status, and returned transaction all confirm `Completed`.
6. Authoritative database rereads after provider I/O prevent a stale Pending response from hiding a concurrent manual or webhook completion. `Completed` is excluded from every provider status transition.
7. Legacy false `Failed`, `Cancelled`, and `Processing` deposits can recover after a later trusted provider result. Retryable failures move them to `Expired`; a valid later webhook, customer retry, or cron pass can still complete them.
8. The five-minute recovery cron uses separate quotas for Pending, Processing, Expired, and crypto work; four-way concurrency; eight-second provider timeouts; and deterministic rotating windows with a newest-row reservation. This keeps the run inside its 60-second budget while ensuring a stable backlog is eventually covered.
9. Legacy null-method deposits are normalised consistently as Flutterwave in reconciliation, transaction history, and the dashboard. Uncredited deposits no longer receive a green amount prefix or a success toast.
10. Payment notices are scoped to the current user, expire after 15 minutes, clear on logout, and are consumed after a successful toast. Redirect verification and Add Funds recovery no longer query the same reference simultaneously.
11. Header parsing, attribution, logging metadata, and notification delivery are post-commit best effort and cannot turn a completed wallet credit into a retryable API response.

Files added:

- `lib/flutterwave-payment.js`
- `lib/flutterwave-verification.js`
- `lib/payment-state.js`
- `lib/provider-query-lease.js`
- `tests/flutterwave-entrypoints.test.js`
- `tests/flutterwave-reconciliation.test.js`
- `tests/flutterwave-verification.test.js`
- `tests/payment-ui-state.test.js`
- `tests/payment-verify-route.test.js`
- `tests/payment-webhook-route.test.js`
- `tests/provider-query-lease.test.js`

Existing files used or changed for Phase 3:

- `app/api/payments/verify/route.js`
- `app/api/payments/webhook/route.js`
- `app/api/cron/payments/route.js`
- `app/api/orders/bulk/route.js`
- `lib/payment-recovery.js`
- `lib/transaction-history.js`
- `components/dashboard.jsx`
- `components/addfunds-page.jsx`
- `tests/transaction-history.test.js`

Verification completed:

- Focused Phase 3 tests: 80 passed.
- Full Vitest suite: 592 passed, 3 skipped.
- Production build: passed.
- Prisma schema validation: passed.
- Migration status: 24 migrations found; database schema up to date.
- Production dependency audit: 0 known vulnerabilities.
- Scoped ESLint: 0 errors. Fifty-seven pre-existing unused-code warnings remain in the large dashboard components.
- `git diff --check`: passed.

Deliberately deferred:

- Phase 4 still owns NOWPayments amount, asset, currency, provider-payment-ID, refund, and reordered-callback integrity. The crypto recovery branch was only bounded by a timeout and kept otherwise unchanged.
- Phase 5 still owns reliable production rate limiting when Redis is absent or unavailable.
- Deposit notifications remain post-commit but do not have a durable outbox; a process crash can lose a notification without affecting the wallet credit.
- The temporary mixed `da87cfd` boundary was replaced during the approved consolidation. A local recovery branch preserves it until the consolidated checkpoint is accepted.

## Phase 4 — Crypto payment integrity

### Scope

- Persist and verify the provider payment ID.
- Compare expected and actual amount, asset, currency, and payment relationship before crediting.
- Define explicit handling for underpayment, overpayment, wrong asset, repeated deposits, and late confirmation.
- Implement safe refund and chargeback reversal or a clearly controlled manual-review state.
- Ensure polling, webhook, and cron use the same validation and finalisation rules.

### Completion criteria

- A provider status alone cannot credit a wallet.
- The credited amount is traceable to a validated provider payment.
- Refunds cannot leave unearned funds available without an alert or controlled recovery action.
- Duplicate or reordered provider callbacks are safe.

### Phase 4 implementation record

**Status:** Fixed locally on 17 July 2026, independently reviewed, and approved with no remaining crypto-payment flaws. Deliberately left unstaged and uncommitted for the next user-approved consolidation checkpoint.

Financial and provider invariants now enforced:

1. A NOWPayments status can never credit a wallet by itself. The shared verifier requires the exact provider payment ID, Nitro order reference, USD price, price currency, quoted crypto amount, crypto asset, and authoritative `actually_paid` amount before the Phase 2 finaliser can run.
2. Provider monetary values use exact canonical decimals with the database storing `DECIMAL(36,18)`. Unsafe numbers, malformed values, missing terminal amounts, underpayments, overpayments, partial payments, wrong assets, repeated child payments, and every identity or quote mismatch are rejected from automatic credit.
3. The signed webhook is only a trigger. It validates NOWPayments' recursively sorted HMAC-SHA512 signature, then performs a fresh bounded provider query through the same reconciler used by authenticated polling and cron recovery. Callback amounts are never trusted.
4. Provider queries use the Phase 3 cross-instance lease and renew-before-apply ownership fence. A callback carrying a distinct provider ID remains retryable when the lease is held, lost, or the provider times out, so a repeated child payment cannot be acknowledged before that exact observation is processed.
5. One durable local transaction is created before the single provider invoice request. Creation is user-idempotent, ambiguous failures preserve the row for safe replay, provider facts bind first-write-wins, and disabling Crypto blocks only new invoices while existing payments continue to reconcile.
6. The Phase 2 finaliser remains the only wallet-credit path. `Review` and `Rejected` are not claimable statuses. Late exact confirmations after a manual rejection open a new review and never silently credit the wallet.
7. Every material anomaly or later provider transition has a stable SHA-256 observation fingerprint. Exact duplicates are idempotent; distinct child payments and later verified, refund, or terminal evidence remain separate admin observations instead of overwriting one another.
8. The transaction stores the current review fingerprint. Admin disposition requires that exact generation and guards the atomic write with it, so a stale admin screen receives `409` and reloads instead of dismissing newer unseen evidence. One current disposition closes all observations already shown for that payment.
9. Refund-before-credit is terminal and uncredited. Refund or terminal regression after credit preserves the completed wallet transaction and opens a high-priority manual recovery review; no unsafe automatic balance debit is attempted.
10. Recovery uses separate bounded queues for ordinary unsettled payments, reviewed/rejected payments, and recent completed-payment audits. Persisted reconciliation-attempt timestamps plus null-first least-recently-attempted ordering prevent permanent provider errors or cooldown-changing membership from starving other rows.
11. Legacy note-based provider IDs remain recoverable. Ambiguous duplicates are left unbound by the migration, included in reconciliation, and sent to review rather than aborting the unique index or binding one provider payment to two deposits.
12. Customer status and history now distinguish provider-pending, retryable, review, refunded, rejected, and credited states. Polling stops only on true terminal outcomes, and success UI requires a durably completed transaction with no open review.

Files added:

- `lib/crypto-payment-ui.js`
- `lib/nowpayments-payment.js`
- `lib/nowpayments-verification.js`
- `prisma/migrations/20260717010000_add_payment_provider_audit_fields/migration.sql`
- `prisma/migrations/20260717010100_add_payment_provider_unique_index/migration.sql`
- `prisma/migrations/20260717010200_add_payment_provider_reconcile_index/migration.sql`
- `prisma/migrations/20260717010300_add_payment_review_index/migration.sql`
- `tests/admin-crypto-payment-review.test.js`
- `tests/crypto-payment-route.test.js`
- `tests/crypto-payment-ui.test.js`
- `tests/nowpayments-reconciliation.test.js`
- `tests/nowpayments-schema.test.js`
- `tests/nowpayments-verification.test.js`
- `tests/nowpayments-webhook-route.test.js`

Existing Phase 4 files changed:

- `app/api/admin/issues/route.js`
- `app/api/cron/payments/route.js`
- `app/api/payments/crypto/route.js`
- `app/api/payments/crypto/webhook/route.js`
- `components/addfunds-page.jsx`
- `components/admin-extra-pages.jsx`
- `lib/payment-recovery.js`
- `lib/payment-state.js`
- `lib/transaction-history.js`
- `package.json`
- `package-lock.json`
- `prisma/schema.prisma`
- payment entry-point, recovery, history, and webhook regression tests

Verification completed:

- Focused Phase 4 suite: 318 passed.
- Independent correction review: approved with no remaining Phase 4 flaws.
- Production build: passed.
- Prisma format, schema validation, and client generation: passed.
- Migration status: 28 migrations found; the four Phase 4 migrations are pending and were not applied.
- Production dependency audit: 0 known vulnerabilities.
- Scoped ESLint: 0 errors. Thirty-one existing unused-code warnings remain in the two large shared UI components.
- `git diff --check`: passed.
- Whole-repository Vitest run: 865 passed and 3 skipped; one separate dashboard-summary test currently fails because concurrently authored Nitro Status work added another order query without updating its test. The 318-test Phase 4 boundary is green.

Deliberately deferred:

- Phase 5 still owns fail-closed production rate limiting when Redis is absent or unavailable.
- Phase 8 still owns required production URL/environment validation and deployment gating on pending migrations.
- Refund-after-credit and other post-credit anomalies intentionally require an owner/superadmin recovery decision; Phase 4 does not guess at an automatic wallet debit policy.
- Deposit notifications remain post-commit without a durable outbox. A crash can lose a notification but cannot change or duplicate the financial result.
- The four Phase 4 migrations must be reviewed and applied before this code can be deployed. The three transaction indexes are split into separate `CONCURRENTLY` migrations so their builds do not block live payment writes.

## Phase 5 — Internal dashboard protection

### Scope

- Replace long-lived Pulse and Live URL keys with authenticated, short-lived access.
- Prevent secrets from appearing in URLs, browser history, copied links, or request logs.
- Require reliable production rate limiting for sensitive routes.
- Validate and limit heartbeat session and page values.
- Reduce heartbeat write frequency and move cleanup to a scheduled task.

### Completion criteria

- Dashboard access is revocable and expires.
- Redis failure does not silently remove important production protection.
- Heartbeat traffic is bounded, rate-limited, and cleaned without dashboard activity.

### Phase 5 implementation record

**Status:** Fixed locally on 17 July 2026, corrected after two independent review passes, and ready for the combined Phase 4–5 review. All work remains unstaged and uncommitted.

Internal dashboard access:

1. The long-lived `pulse_secret_key` URL credential is retired. Pulse and Live now use a 15-minute, HttpOnly, Secure-in-production, SameSite Strict child grant tied to a live database-backed admin session.
2. Only active owners and superadmins can mint or use the grant. Logout, account switching, deactivation, session deletion, and owner-driven password resets revoke it through the parent session lifecycle.
3. Admin login locks and rechecks the password/status row before creating a session, preventing an old-password login from racing a password reset and recreating access after revocation.
4. Pulse and Live APIs authenticate before sensitive queries, return private no-store responses, clear browser state after either authentication or authorization loss, and never place credentials in URLs, props, browser history, copied links, analytics payloads, or request logs.
5. The legacy setting is hidden immediately and deleted by migration `20260717020000_retire_pulse_secret_key`.

Reliable rate limiting:

1. Upstash counters now use one atomic Lua increment/expiry operation with a 1.5-second request timeout and accurate retry timing.
2. Production fails closed with an explicit retryable `503` when Redis configuration is missing, incomplete, cannot initialise, times out, or errors. The per-instance memory fallback remains development/test only.
3. Every existing rate-limited API entry point handles unavailable protection before the ordinary `429` branch and forwards the calculated `Retry-After` value.

Heartbeat and Live traffic:

1. The browser no longer controls the database session ID. The server issues a signed seven-day presence cookie and derives separate database IDs for anonymous, user, and admin activity. A separate 30-per-hour admission budget limits new presence creation.
2. Requests require same-origin JSON, stream bodies through a real 1KB read ceiling, canonicalise and bound page/agent values, and are globally rate-limited before parsing.
3. One monotonic PostgreSQL upsert coalesces unchanged writes for 45 seconds and rejects delayed observations that would move page, identity, or `lastSeen` backward.
4. The client heartbeat interval is 60 seconds and the 150-second active window tolerates one missed beat. Live responses are read-only and capped at the 500 most recently seen sessions.
5. Anonymous rows expire after six hours. Identified rows remain for 31 days so Phase 1's 30-day stale-signup activity guard stays safe. Cleanup runs independently every 15 minutes and rechecks at most 1,000 indexed candidates per invocation.
6. Migrations `20260717020100_ensure_live_sessions` and `20260717020200_add_live_session_user_seen_index` make fresh installs deployable and add concurrent cleanup/activity indexes without blocking live heartbeat writes.

Main implementation areas:

- `lib/internal-dashboard-access.js`, `lib/internal-dashboard-path.js`, and `app/api/internal-dashboard/access/route.js`
- Pulse/Live pages, APIs, clients, admin login/logout/session lifecycle, settings filtering, and global analytics suppression
- `lib/rate-limit.js` and all existing rate-limited authentication, order, coupon, payment, and PIT entry points
- `lib/heartbeat.js`, `lib/heartbeat-presence.js`, the heartbeat API/client, the dedicated cleanup cron, Live API, Prisma schema/migrations, and Vercel cron configuration
- Focused internal-dashboard, rate-limit, heartbeat, migration, cleanup, payment-compatibility, and admin-session regression tests

Verification completed:

- Focused Phase 5 suite: 189 passed.
- Phase 4 regression boundary after Phase 5: 348 passed.
- Whole repository after the Nitro Status correction: 982 passed and 3 skipped.
- Production build: passed.
- Prisma format, schema validation, and client generation: passed.
- Migration status: 31 migrations found; all four Phase 4 and all three Phase 5 migrations are pending and were not applied.
- Production dependency audit: 0 known vulnerabilities.
- Scoped ESLint: 0 errors; existing unused-code warnings remain.
- `git diff --check`: passed. Nothing is staged.

Deployment requirements and deliberate deferrals:

- Upstash Redis and the JWT secrets must be valid in production. The optional `INTERNAL_DASHBOARD_SECRET` and `HEARTBEAT_SECRET` provide domain-separated keys and otherwise fall back to the corresponding admin/user JWT secrets.
- The seven Phase 4–5 migrations must be reviewed and applied before deploying this code.
- Browser-level journey coverage remains Phase 9 work. No production request, cleanup, migration, deployment, staging, or commit action was performed in Phase 5.

## Phase 6 — Privacy and account deletion

### Scope

- Define what must be erased, anonymised, retained for legal reasons, or retained for financial audit.
- Remove or anonymise names, emails, IP addresses, device data, Facebook data, and other personal fields correctly.
- Repair referral unlinking so it compares the correct identifiers.
- Prevent deleted or ineligible referrers from receiving later rewards.

### Completion criteria

- A permanent deletion test proves personal fields are removed or irreversibly anonymised.
- Required financial records remain auditable without retaining unnecessary personal data.
- Deleted users cannot receive new referral rewards.

## Phase 7 — Public UI correctness

### Scope

- Remove artificial additions and forced minimums from public statistics.
- Rename every statistic to match the data it actually represents.
- Make affiliate query handling produce the same initial server and browser render.
- Convert authentication areas into proper forms with connected labels and keyboard submission.
- Implement `Remember me` correctly or remove it.
- Add proper dialog roles, accessible names, focus trapping, escape handling, and focus restoration.

### Completion criteria

- Public claims are calculated from real, correctly labelled data.
- Affiliate links do not produce hydration warnings or visible screen switching.
- Authentication and destructive dialogs work with keyboard and screen-reader navigation.

## Phase 8 — Deployment safety

### Scope

- Update deployment documentation to match Flutterwave and current environment names.
- Require the production application URL and prevent localhost links in production.
- Validate Redis, webhook secrets, monitoring configuration, IP hashing salt, database URLs, and other required production settings.
- Gate deployment on migration status and application build success.
- Review the untracked migration and CI workflow, then include or reject them intentionally.

### Completion criteria

- A production build fails early when required configuration is absent.
- Deployment cannot proceed while required migrations are missing or failed.
- The documented setup cannot accidentally target production.
- Every migration and workflow needed for deployment is tracked deliberately.

## Phase 9 — Quality and monitoring

### Scope

- Exclude `.next` and other generated output from linting.
- Reduce or fix noisy rules until linting can be used as a required CI check.
- Add browser tests for signup, login, deposits, orders, password reset, and important admin actions.
- Forward server request errors to Sentry with appropriate filtering and redaction.
- Add actionable alerts for stuck payments, failed webhooks, Redis outages, cleanup failures, and migration failures.

### Completion criteria

- Linting reports application problems instead of generated-file noise.
- Critical customer journeys run in CI.
- Operational failures reach monitoring without exposing secrets or unnecessary personal data.

## Phase 10 — Maintainability

### Scope

- Split the largest components and routes by feature and responsibility.
- Keep money and permission logic in tested server-only services.
- Introduce typed request validation at API boundaries.
- Refactor only after earlier phases have established regression coverage.

### Initial hotspots

- `components/admin-extra-pages.jsx`
- `components/new-order.jsx`
- `components/admin-pages.jsx`
- `components/dashboard.jsx`
- `app/api/orders/route.js`

### Completion criteria

- Large files have clear feature boundaries and smaller reviewable units.
- Financial and permission rules are not duplicated in UI components or route handlers.
- Existing behaviour remains protected by regression and browser tests.

## Progress log

Add a dated entry after each phase with:

- commits or pull request;
- files changed;
- tests and checks run;
- production or migration actions still required;
- risks accepted or deferred;
- next phase approved to start.

### 16 July 2026 — Phase 1 correction pass

- Status: fixed locally and deliberately left unstaged and uncommitted. `HEAD` remains `64ff3ba`.
- Cleanup: narrowed deletion to expired legacy verification signups with no recent activity or related records; selection and final recheck now run in one serializable transaction.
- Seed safety: replaced provider-name blocking with a fail-closed local/test allowlist, per-command destructive confirmation, explicit local credentials, pure safety tests, and corrected deployment guidance.
- Blog security: added one server render path that selects Markdown or legacy HTML, sanitises the final HTML, and safely serialises JSON-LD.
- Rewards review corrections: preserved exact signed ledger/history values and removed the behaviorally incorrect test mock.
- Parser repair: removed the malformed duplicate tail from `scripts/seed-blog.cjs`.
- Verification: 166 focused tests passed; full suite passed with 486 tests and 3 intentional skips; changed-file ESLint passed; production build passed; `npm audit --omit=dev` found 0 vulnerabilities; both seed scripts passed syntax checks; `git diff --check` passed.
- Safety: no seed, cleanup, database write, deployment, staging, or commit was performed.
- Deferred: live-database cleanup execution and browser automation were intentionally not run. Phase 2 remains pending.

### 16 July 2026 — External repository state change

- While Phase 3 work was active, `HEAD` moved from `64ff3ba` to `da87cfd` through a commit authored outside this Codex pass: `Phase 1 corrections, Phase 2 deposit finalization, sidebar redesign`.
- The commit included Phase 1, Phase 2, sidebar work, and some tracked preliminary Phase 3 edits, but it did not include the new Phase 3 modules and tests that those tracked edits depend on.
- Codex did not create that commit. On 17 July, the user approved replacing its mixed boundary with one coherent Phase 1–3 consolidation before starting Phase 4.

### 16 July 2026 — Phase 3 Flutterwave reliability

- Status: implementation complete and verified in the coherent working tree.
- Verification: 80 focused tests passed; full suite passed with 592 tests and 3 intentional skips; production build passed; Prisma validation and migration status passed; production audit found 0 vulnerabilities; scoped lint had 0 errors; `git diff --check` passed.
- Safety: no payment, seed, cleanup, migration, deployment, staging, or commit action was performed.
- Next: Phase 4 crypto payment integrity, after the user approves starting it.

### 17 July 2026 — Phase 1–3 consolidation checkpoint

- Remote `main` was verified at `e7434ff`; the six later commits were local-only.
- A recovery branch, `backup/pre-phase4-consolidation-20260717`, preserves the temporary `da87cfd` history.
- The six local commits and approved Phase 3 working changes were flattened into one coherent checkpoint while preserving the existing sidebar redesign and its final polish.
- Unrelated untracked reviews, scripts, skills, migrations, demos, and planning material were deliberately excluded.
- This checkpoint establishes the clean remediation boundary for Phase 4.

### 17 July 2026 — Phase 4 crypto payment integrity

- Status: implementation complete, independently reviewed, and approved with no remaining Phase 4 flaws.
- Verification: 318 focused tests passed; production build passed; Prisma format, validation, and generation passed; production dependency audit found 0 vulnerabilities; scoped lint had 0 errors; `git diff --check` passed.
- Migration safety: four Phase 4 migrations are pending and unapplied. Provider/review indexes are built in separate concurrent migrations to protect live transaction writes.
- Whole-tree note: 865 tests passed and 3 were skipped. One unrelated dashboard-summary test fails against concurrently authored Nitro Status changes in the shared worktree; Phase 4 tests are green and those files were not modified by this phase.
- Safety: no production payment, balance adjustment, migration application, deployment, staging, or commit was performed.
- Next: consolidate only when the user approves, then begin Phase 5 from a deliberate clean boundary.

### 17 July 2026 — Phase 5 internal dashboard protection

- Status: implementation and review corrections complete; included in the user-approved consolidation before the user's later Phase 5 review.
- Access: replaced URL bearer keys with revocable 15-minute admin-session grants and closed logout, account-switch, password-reset, and concurrent-login revocation gaps.
- Rate limiting: production now fails closed when distributed Redis protection is unavailable; all existing callers return explicit retryable responses with accurate timing.
- Heartbeat: moved identity issuance to a signed server cookie, bounded new-row admission/body/page/write/read/cleanup volume, preserved the stale-signup safety marker across logout, and scheduled independent batched cleanup.
- Verification: 189 focused Phase 5 tests and the 348-test Phase 4 boundary passed; build, Prisma checks, dependency audit, scoped lint, and diff checks passed. After the Nitro Status correction, the full suite has 982 passes and 3 skips.
- Migration safety: all seven Phase 4–5 migrations remain pending and unapplied.
- Safety: no database write, cleanup, migration application, deployment, staging, or commit was performed.

### 17 July 2026 — Phase 4–5 and Nitro Status consolidation

- The user approved one consolidated commit before completing the later Phase 5 review.
- Nitro Status now has one canonical dashboard rewards source and one database-side eligible-spend batch for leaderboard badges. The bounded dashboard query guard is green again.
- The previously untracked CI workflow and applied signup-IP migration are intentionally included so a fresh checkout does not omit them. The seven new Phase 4–5 migrations remain pending and unapplied.
- Verification: 101 focused Nitro Status tests passed; the full repository passed with 982 tests and 3 intentional skips; the production build and `git diff --check` passed.
- Deployment remains separate. No migration, production request, balance adjustment, cleanup, or deployment was run during consolidation.
- Phase 5 is committed for continuity but still awaits the user's planned review.
