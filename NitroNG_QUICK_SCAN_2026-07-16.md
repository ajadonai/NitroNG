# Nitro quick scan — 16 July 2026

## Bottom line

Nitro has a solid base: the production build completes, 435 tests pass, the configured database is currently up to date, and the production dependency audit is clean.

The main risks are concentrated in four places:

1. destructive cleanup and seed routines;
2. payment finalisation and recovery;
3. public content and internal dashboard access;
4. deployment, test, and monitoring gaps.

The first six findings below should be handled before adding more product work. Older dispatch and Pit findings already covered by the existing review notes are not repeated here.

## Fix first

### 1. The daily cron can delete legitimate customer accounts

**Priority: Critical**

`app/api/cron/daily/route.js:22-40` selects every account older than 30 days with a zero balance, then hard-deletes anyone with no orders. It does not require the account to be unverified, abandoned, inactive, or already marked for deletion. `vercel.json:8` runs this route every day.

The admin cleanup route has the same broad rule at `app/api/admin/cleanup/route.js:10-27`.

**Why it matters:** A real customer who signs up, verifies their account, but waits more than 30 days before funding or ordering can lose the account without notice.

**Change:** Never automatically hard-delete an active account. Restrict cleanup to an explicit deletion state or tightly defined unverified signups, include recent login/session and related-record checks, notify the user, and use a grace-period soft delete before anonymisation.

### 2. The documented setup can wipe the live database

**Priority: Critical**

`docs/DEPLOYMENT.md:58-63` says local development uses the same Neon database and then tells the developer to run `prisma/seed.js`.

`prisma/seed.js:9-20` unconditionally deletes users, admins, orders, transactions, tickets, services, settings, blog posts, and other data. It then creates known admin credentials at `prisma/seed.js:22-33` and prints those credentials at `prisma/seed.js:806-810`.

**Why it matters:** One copied setup command with the production connection string can cause irreversible data loss and create a known superadmin password.

**Change:** Give local, test, staging, and production separate databases. Add a hard production-host/database-name refusal to every destructive script, require an explicit confirmation phrase, and remove fixed credentials. Split safe reference-data seeding from disposable demo data.

### 3. Blog posts can run stored JavaScript in a reader's browser

**Priority: Critical**

`lib/markdown.js:4-6` returns content unchanged when it begins with an HTML tag. `components/blog-post.jsx:97` sanitises only in the browser; during server rendering it places the raw result into `dangerouslySetInnerHTML`. `next.config.mjs:17` also allows inline script execution.

**Why it matters:** A malicious or compromised blog editor can publish code that runs for every reader. If an owner or customer reads the post while logged in, that code can make same-origin requests using their session.

**Change:** Convert and sanitise blog content on the server with one allowlist used everywhere. Prefer storing Markdown and rejecting raw HTML. Add stored-XSS tests, then move the content security policy from `unsafe-inline` to nonces or hashes.

### 4. Payment verification can strand a paid deposit and report it as credited

**Priority: High**

`app/api/payments/verify/route.js:26-30` changes a transaction from `Pending` to `Processing` before calling Flutterwave. A missing key, timeout, bad response, or thrown error can leave it in `Processing` without crediting the wallet.

On the next attempt, `app/api/payments/verify/route.js:32-39` treats `Processing` as “Already credited,” although the actual wallet credit happens later at `app/api/payments/verify/route.js:87-123`.

The same route turns any non-success response into `Failed` at `app/api/payments/verify/route.js:75-80`. A later successful webhook cannot recover it because `app/api/payments/webhook/route.js:37-45` only claims `Pending` or `Expired` transactions, while the recovery cron only scans `Pending` transactions at `app/api/cron/payments/route.js:94-99`.

**Why it matters:** A customer can pay successfully, see a success message, and still have no wallet credit. Recovery may then require manual database work.

**Change:** Use a recoverable leased claim with timestamps and attempt IDs. Only return “credited” for `Completed`. Treat provider-pending and transport errors as retryable, and add a reconciliation job for stale `Processing` payments.

### 5. Crypto payments trust the status but not the money received

**Priority: High**

The customer polling path credits the requested Naira amount when NOWPayments says `finished` or `confirmed`, without comparing the provider's `actually_paid`, asset, payment ID, or expected value (`app/api/payments/crypto/route.js:164-207`).

The webhook receives `payment_id`, `pay_amount`, and `actually_paid` but does not validate them before crediting the stored requested amount (`app/api/payments/crypto/webhook/route.js:33-93`). The cron has the same problem and appears to query NOWPayments with Nitro's reference instead of the stored NOWPayments payment ID (`app/api/cron/payments/route.js:117-139`).

NOWPayments explicitly recommends checking the actual amount, currency, and parent payment because a `Finished` payment can differ from the expected amount under payment-cover, repeated-deposit, or wrong-asset settings: [NOWPayments help](https://nowpayments.io/help) and [official API documentation](https://documenter.getpostman.com/view/7907941/2s93JusNJt).

A later `refunded` crypto event also leaves an already completed wallet credit untouched because `app/api/payments/crypto/webhook/route.js:140-151` only updates `Pending` or `Processing` transactions.

**Why it matters:** Nitro can over-credit a wallet, fail to recover a real payment, or keep spendable credit after the provider refunds the underlying payment.

**Change:** Store typed provider payment fields instead of hiding the provider ID in a note. Validate provider ID, expected asset, expected fiat value, actual paid value, and an explicit tolerance before fulfilment. Add an atomic reversal or debt/manual-review path for refunds and chargebacks.

### 6. Deposit finalisation is copied across routes and the copies disagree

**Priority: High**

The same financial operation is separately implemented in the Flutterwave webhook, manual verify route, crypto webhook, crypto polling route, cron recovery, admin approval, and Telegram approval.

The copies already behave differently:

- the crypto webhook honours `coupon.maxDeposit`, while crypto polling and cron recovery do not (`app/api/payments/crypto/webhook/route.js:79-80`, `app/api/payments/crypto/route.js:192`, `app/api/cron/payments/route.js:65`);
- the crypto webhook applies the welcome bonus, while polling and recovery do not;
- recovery omits referral handling and some tracking/notification work;
- a text note is used as the referral payment marker, but there is no unique database claim, so concurrent first-deposit paths can double-pay;
- settings read with `Number(value) || 50000` turn an intentional zero into a ₦500 default.

**Why it matters:** The first route to win a race decides how much money and which bonuses the customer receives.

**Change:** Build one transactional `finalizeDeposit()` service with an idempotent database claim, one ledger contract, and explicit side-effect jobs. Every webhook, poll, recovery, admin, and bot path should call it. Add concurrency tests against an isolated PostgreSQL database.

## Important follow-ups

### 7. Pulse and Live expose sensitive data behind a long-lived URL key

**Priority: High**

`app/pulse/page.jsx:16-32` and `app/live/page.jsx:16-32` read a bearer key from the URL. The key is then sent on every poll by `components/pulse-dashboard.jsx:510` and `components/live-dashboard.jsx:315`.

The APIs return names, emails, balances, deposits, recent orders, and admin identity data (`app/api/pulse/route.js` and `app/api/live/route.js:29-85`). A URL key can leak through history, copied links, logs, monitoring, and screenshots.

**Change:** Require an owner session and a specific permission. If share links are still needed, exchange a short-lived, one-use token for an HttpOnly cookie and return `Cache-Control: no-store`. Remove all long-lived secrets from URLs.

### 8. Production rate limiting silently weakens when Redis is missing or down

**Priority: High**

`lib/rate-limit.js:13-15` only warns when Redis is missing. `lib/rate-limit.js:57-64` falls back to a per-instance memory map on configuration or Redis errors.

That fallback is not a reliable security limit on serverless infrastructure because each instance has separate counters and restarts clear them.

**Change:** Require both Upstash values in production. For authentication, payment, and order endpoints, return an explicit degraded response or use a platform-level backup limiter rather than silently weakening protection. Expose Redis readiness and alert on failure.

### 9. “Permanent deletion” keeps personal data and can keep paying a deleted referrer

**Priority: High**

The deletion request stores the original name and email in `deletedName` and `deletedEmail` (`app/api/auth/delete-account/route.js:72-75`). The 30-day cleanup leaves those fields plus first/last name, IP, user agent, and Facebook tracking values in place (`app/api/cron/daily/route.js:45-67`). Admins can later restore the original identity at `app/api/admin/users/route.js:257-272`.

The cleanup also tries to clear referrals using the deleted user's ID, but `referredBy` stores the referral code, not the user ID. Compare `app/api/cron/daily/route.js:55` with `app/api/auth/signup/route.js:82-88`. Later deposits can therefore still credit a deleted referrer.

**Change:** Define which accounting fields must be retained and genuinely anonymise everything else after the grace period. Clear the referral by referral code, block payouts to non-active referrers, remove the post-deletion reinstate path, and add a deletion-completeness test.

### 10. Public trust numbers do not match their labels

**Priority: High business risk**

`app/api/site-info/route.js:20-35` adds 20,000 to the order total, adds 20 to “processing right now,” and forces the delivery rate to at least 90%, even when the real rate is lower. Tests explicitly lock that behaviour in at `tests/site-info.test.js:22-24,38-45`.

The same route counts enabled service groups and labels the result as “platforms” (`app/api/site-info/route.js:12-17,69`), so the homepage can show roughly 185 platforms when the catalogue actually has about 29.

**Change:** Show real, clearly defined numbers. If 20,000 represents verified legacy history, label it as historical and document the source. Count distinct platforms. Never label a padded number as “right now.”

### 11. Affiliate traffic can receive a server/client hydration mismatch

**Priority: High**

`components/landing-page.jsx:44-60` reads `window.location.search` during render and chooses signup for `?via=` traffic. The server cannot see `window`, so it renders login while the browser's first render chooses a different signup subtree at `components/landing-page.jsx:261-269`.

**Change:** Parse the affiliate parameter in the server page and pass a prop, or keep the first client render deterministic and switch modes after mount. Add a browser test for `/\?via=...`.

### 12. Public heartbeat traffic is an unnecessary database write surface

**Priority: Medium**

`app/layout.jsx:210` mounts Heartbeat on every route. Every visible visitor tab writes immediately and every 30 seconds (`components/heartbeat.jsx:8-41`). `app/api/heartbeat/route.js:5-22` accepts an arbitrary session ID and page with no rate limit or length limits.

Stale rows are only removed when the protected Live dashboard is polled (`app/api/live/route.js:21-27`), not by the cleanup cron.

**Change:** Limit heartbeat tracking to the pages that need it, validate and cap the fields, rate-limit it, sample public traffic, and move stale-row deletion into a scheduled cleanup.

### 13. Deployment configuration and documentation have drifted

**Priority: Medium**

`docs/DEPLOYMENT.md:33-53` still documents Paystack, `BREVO_SENDER_*`, and `NEXT_PUBLIC_BASE_URL`. Runtime code uses Flutterwave, `SENDER_EMAIL`/`SENDER_NAME`, and `NEXT_PUBLIC_APP_URL`.

If the app URL is absent, password reset links fall back to localhost (`app/api/auth/forgot-password/route.js:39-40` and `app/api/pit/auth/forgot-password/route.js:33-34`). `lib/env.js:8-26` does not require the public URL, Redis, webhook secrets, Sentry, or the IP hash salt in production. `.env.example` also omits `DIRECT_URL`, although the Prisma schema requires it.

**Change:** Use one validated environment schema as the source for startup checks, `.env.example`, and deployment documentation. Production-critical settings should fail startup, not quietly degrade.

### 14. Deployments are not gated on migrations

**Priority: Medium**

Main auto-deploys to Vercel, but the build only runs `next build`; `prisma migrate deploy` is a separate manual script (`docs/DEPLOYMENT.md:81-94,125-130` and `package.json:10-13`).

The configured database is up to date today with 24 migrations, but `prisma/migrations/20260705120000_add_signup_ip_index/migration.sql` is currently untracked. A fresh checkout cannot reproduce every applied change.

**Change:** Commit every migration before dependent code, run a serialized migration job before promoting the app, and add migration status, schema validation, backup, and rollback checks to CI.

### 15. Accessibility breaks on important forms and destructive dialogs

**Priority: Medium**

`components/confirm-dialog.jsx:42-56` has no dialog role, labelled title/description, focus trap, initial focus, background inertness, or focus restoration. The homepage auth controls at `components/landing-page.jsx:265-269` are not real forms and their visible labels are not associated with inputs.

The “Remember me” controls also do nothing: the client never sends the value and the cookie always lasts seven days (`components/auth-modal.jsx:609-623`, `components/landing-page.jsx:267`, `lib/auth.js:38-43,79-87`).

**Change:** Use a tested dialog primitive or native `<dialog>`, convert auth flows to proper forms, add labelled fields and live error regions, and either implement the remember-me behaviour or remove the control.

### 16. Lint, integration, and browser checks are not protecting main

**Priority: Medium**

The working tree contains an untracked CI workflow, so it does not protect the repository yet. The proposed workflow tests and builds but does not lint, check migrations, measure coverage, or run database integration tests.

`eslint.config.mjs` does not use the Next, React Hooks, or accessibility rules. A full lint also scans `.next`, producing thousands of generated-file errors, while `scripts/seed-blog.cjs:394-395` contains a real syntax error that the production build never sees.

Vitest is Node-only with no coverage thresholds (`vitest.config.js:3-10`). The real-database commission tests are opt-in, and there is no browser end-to-end suite.

**Change:** Commit CI, add correct lint ignores and the official Next/React rules, check all script syntax, validate Prisma migrations, run isolated PostgreSQL concurrency tests, enforce coverage on money/auth code, and add browser smoke tests for signup, reset, deposit, order/refund, and admin approval.

## Upgrades worth making

### Next few days

1. Disable the broad account cleanup and dangerous seed path until guards are in place.
2. Close the blog XSS path and add a regression test.
3. Centralise deposit finalisation and repair the payment state machine.
4. Reconcile existing `Processing`, `Failed`, refunded, and crypto payment records before changing the workflow.
5. Replace Pulse/Live URL keys with owner authentication.

### Next two weeks

1. Create separate database environments and a migration-before-deploy gate.
2. Make Redis and all payment/webhook secrets mandatory in production.
3. Add payment concurrency and reconciliation tests against isolated PostgreSQL.
4. Add a small Playwright suite for the five money/auth journeys listed above.
5. Replace padded homepage numbers with real metrics.
6. Adopt an accessible dialog/form foundation.
7. Wire `onRequestError` to Sentry; `instrumentation.js:51-55` currently only logs it. Add central log redaction for emails, IPs, and financial details.

### Ongoing cleanup

1. Split the largest files by feature. Current hotspots include `components/admin-extra-pages.jsx` (2,380 lines), `components/new-order.jsx` (1,859), `components/admin-pages.jsx` (1,639), `components/dashboard.jsx` (1,493), and `app/api/orders/route.js` (1,001).
2. Replace duplicated money and permission rules with small server-only services and typed input schemas.
3. Remove query-string cron secrets and accept `Authorization` headers only.
4. Remove the no-op service worker or give it a tested offline/update strategy.
5. Patch current dependencies in a low-risk batch: Next 16.2.10, React 19.2.7, Sentry 10.65.0, DOMPurify 3.4.12, and related patch releases are available. Treat Prisma 7, ESLint 10, and `cookie` 2 as separate planned upgrades.
6. Pin the Node version in `package.json`, CI, and an `.nvmrc` file.

## Quick health check

| Area | Rating | Reason |
|---|---:|---|
| Money and arithmetic | Weak | Kobo integers and atomic deductions are good, but payment paths disagree on amounts, bonuses, and recovery. |
| Monitoring and audit trail | Moderate | Sentry, structured logging, Telegram alerts, and admin activity logs exist; request capture, redaction, and recovery alerts are incomplete. |
| Authentication and access | Moderate | JWT/session handling and admin role checks are generally sound; URL-key dashboards and degraded rate limiting weaken the boundary. |
| Complexity | Weak | Several 1,000–2,400-line files and copied financial workflows make review and safe changes difficult. |
| Operational control | Moderate | Central control is expected for this service, but destructive scripts and sensitive money actions need stronger safeguards and separation. |
| Documentation | Weak | There is useful documentation, but deployment and environment instructions are stale enough to cause outages or data loss. |
| Concurrency and ordering | Weak | Order work has useful hardening, but deposit claims, referral bonuses, and recovery still have race-dependent outcomes. |
| Raw SQL and external calls | Moderate | Most raw SQL is parameterised and balance updates are atomic; remaining unsafe composition and provider calls need tighter shared wrappers. |
| Testing | Moderate | 435 tests pass, but critical payment, cleanup, browser, and real-database concurrency paths are not covered. |

**Overall snapshot: 1.6 / 4.0.** The platform is functional and has several strong foundations, but money movement and destructive operations need another hardening pass.

## What is already working well

- User and admin JWT secrets fail closed in production.
- Session tokens are hashed in the database and can be revoked.
- Cookies are HttpOnly, Secure in production, and SameSite protected.
- Main wallet deductions use conditional atomic SQL, which prevents overspending.
- Most admin routes use the central role and sensitive-data helpers.
- Payment webhooks reject missing signature secrets rather than accepting unsigned requests.
- Pit payout code uses row locks, serialisable transactions, and retries.
- Security headers cover HSTS, framing, MIME sniffing, referrers, and permissions.
- The application build completes and the current unit suite is fast and green.

## Checks run

- `npm test`: 34 test files passed, 1 skipped; 435 tests passed, 3 skipped.
- `npm run build`: passed; 161 static pages generated.
- `npm audit --omit=dev`: 0 production vulnerabilities.
- `npx prisma migrate status`: configured database up to date; 24 migrations found.
- Scoped ESLint: no source errors, but the current configuration produces hundreds of low-value warnings and is not a usable CI gate.
- Current working changes were left untouched; this review only adds this note.
