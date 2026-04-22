# Nitro — Phase 1 Engineering Brief for Claude Code

**Author:** Adonai (Trip)
**Project:** Nitro — Premium Nigerian SMM Panel
**Domain:** nitro.ng
**Repo:** `github.com/ajadonai/NitroNG`
**Baseline commit:** `33075bb` / tag `v1.0` (Nitro v1.0 — pre-Phase 1 baseline)
**Phase:** 1 — Pre-Launch Hardening, Styling Migration, and Cleanup

---

## TL;DR

Nitro is a Next.js 16 / React 19 / Prisma 6 / Postgres (Neon) SMM reseller panel on Vercel. It sells MTP-wholesaled services to Nigerian creators in Naira via Flutterwave (cards), NOWPayments (crypto), and manual bank transfer. Paystack was stripped in sweep 3; ALATPay, KoraPay, Monnify have admin UI but aren't wired (Phase 3).

**Phase 1 does seven things:**

1. **Migrate styling to Tailwind.** The repo currently mixes plain CSS (`app/globals.css`) with inline styles. Move to Tailwind utilities with the default `sm / md / lg / xl` breakpoints. Keep inline only for theme-dependent dynamic values. Delete what Tailwind replaces in `globals.css`.
2. **Close 4 real security gaps** found by audit against the baseline commit:
   - Password reset does not invalidate existing sessions (P0).
   - Payment init has no idempotency — double-click creates two gateway sessions (P1).
   - Webhook signature verification silently skips when the secret env var is missing (P1 — harden, don't rebuild).
   - Stale `thenitro.ng` origins still whitelisted in `middleware.js` (P1).
3. **Scrub remaining Paystack references** from `README.md` and `.env.example`. Leave the one in `lib/name-filter.js` — it's the banned-brand list.
4. **Eliminate layout shift** on dynamic UI (errors, validation, spinners, strength meters).
5. **Run a real end-to-end order test** on Flutterwave, NOWPayments, and Manual with evidence. MTP, JAP, and DaoSMM are all routed and tested — the test covers payment → dispatch → status on every live path.
6. **Verify notification preferences persist** across the matrix in §16.

**Guiding principle: better, but not slower.** If a change improves clarity, consistency, or correctness without costing runtime or bundle size, take it. If it trades performance for elegance, don't.

**Hard rules:** Tailwind first, minimal `globals.css`, no inline unless theme-dependent; all money is integer kobo; all timestamps UTC; atomic claims on every money-touching path; brace-balance-check before commit; no unrequested refactors; Paystack stays removed; no parallel sessions pushing to `main`.

Exit criteria in §25. Everything Phase 1 refuses to do is in §24.

---

## 0. How to Use This Document

If the codebase contradicts this document, the document wins and the codebase gets fixed. If a decision isn't covered here, stop and ask before acting.

---

## 1. Mission

Nitro is a premium Nigerian social media marketing panel for creators, artists, and businesses. It resells upstream SMM services (MTP primary, with JAP and DaoSMM also routed for gap-filler and Nigerian-specialist services) in Naira. Nitro competes on UI/UX quality and Nigerian-specific positioning — not price.

Nitro is an SMM panel. It is not a bank, not a regulated financial institution, not a marketplace. Right-size engineering accordingly: no KYC, no AML, no formal SLO contracts. Do the things that matter for payments and user trust; skip the things that matter only for regulated finance.

---

## 2. Session Start Checklist

Before any Phase 1 work:

1. Read this document in full.
2. `git log -5 --oneline` — confirm baseline is `33075bb` (tag `v1.0`) or descendant.
3. `git status` — clean working tree.
4. Verify Node matches Vercel's LTS.
5. Open `/docs/PHASE_1_AUDIT.md`; create from §14 template if missing.
6. State which Phase 1 objective you're advancing and which exit-criteria checkbox it satisfies.

---

## 3. Phase 1 Scope

### 3.1 In Scope

1. **Tailwind migration.** See §9.
2. **Security gap closure.** See §8.
3. **Paystack reference scrub.** `README.md`, `.env.example`, inline comments.
4. **Stale domain scrub.** Replace `thenitro.ng` with `nitro.ng` everywhere (middleware, env example, docs).
5. **Layout-shift elimination.** See §11.
6. **End-to-end order test.** See §15.
7. **Notification persistence verification.** See §16.
8. **`/docs/PHASE_1_AUDIT.md`** produced and complete.

### 3.2 Out of Scope (tracked in §24)

- Budget sub-brand (Phase 3)
- ALATPay / KoraPay / Monnify wiring (Phase 3)
- Marketer account type and dashboard (Phase 3)
- TypeScript migration, CI/CD, automated tests (Phase 3)
- Ticket assignment system (Phase 3)
- Any new user-facing feature

If you want to build one of these mid-audit, stop and file it under Deferred in `/docs/PHASE_1_AUDIT.md`.

---

## 4. Issue Severity Tiers

- **P0** — ship-stopper. Examples: auth bypass, payment double-charge, data leak, unsigned webhook accepted, password reset that leaves sessions alive. P0 pauses other Phase 1 work until fixed.
- **P1** — Phase 1 must-fix. Examples: missing idempotency on payment init, Tailwind migration drift, layout shift on checkout/auth, missing rate limit on an auth route, stale domain in middleware.
- **P2** — Phase 1 nice-to-have. Low-impact inline styles, copy polish, minor layout shift on rare states. Fix if time allows.
- **P3** — defer to Phase 2+. File in `/docs/DEFERRED.md` with one-line justification and target phase.

---

## 5. Tech Stack

### 5.1 Runtime & Framework

- **Next.js 16** (App Router)
- **React 19**
- **Prisma 6**
- **Node.js** — Vercel's current LTS
- **ESM** (`"type": "module"` in package.json)
- **JavaScript** (TypeScript is Phase 3)

### 5.2 Styling Stack — Post-Migration

- **Tailwind CSS** with default breakpoints. See §9.
- **`app/globals.css`** retained only for: CSS variables (theme tokens), global resets, and styles Tailwind genuinely can't express.
- **No plain CSS classes** for anything Tailwind can do.
- **No inline styles** except theme-dependent dynamic values (§9.3).

### 5.3 Observability

- **Sentry** wired via `@sentry/nextjs` (`sentry.client.config.mjs`, `sentry.edge.config.mjs`, `sentry.server.config.mjs`, `instrumentation.js`). Do not disable.
- **Structured logging** through `lib/logger.js`. `console.*` banned in production paths.
- **PII boundary** — log IDs, never contents. No full emails, phones, tokens, card data, order notes, or request bodies in logs.

### 5.4 Hosting

- **Frontend** — Vercel, auto-deploy from `main`.
- **Workers / queues** — Railway, Phase 3.
- **Env vars** — Vercel env config. No `.env` in the repo beyond `.env.example`.

**Vercel plan note:** if the project is still on Hobby, confirm commercial-use compliance against current Vercel TOS before launch. If non-compliant, upgrade. This is a 10-minute check, not a rebuild.

### 5.5 External Services (current)

| Service | Role | Status |
|---|---|---|
| **Flutterwave** | Primary card gateway | Active — `/api/payments/initialize`, `/api/payments/verify`, `/api/payments/webhook` |
| **NOWPayments** | Crypto | Active — `/api/payments/crypto/*` |
| **Manual bank transfer** | Wema and other banks | Active — `/api/payments/manual/*` |
| ALATPay / KoraPay / Monnify | Admin UI exists | Not wired — Phase 3 |
| **MTP (MoreThanPanel)** | Primary SMM provider — 4,405 services | Active |
| **JAP (JustAnotherPanel)** | Gap-filler provider | Active — routed via `lib/smm.js` |
| **DaoSMM** | Nigerian-specialist provider | Active — routed via `lib/smm.js` |
| **Brevo** | Transactional email | Active, sender `noreply@nitro.ng` |
| **Neon** | Postgres | Active, `eu-west-2` |

Paystack is out. Every remaining reference in `README.md` or `.env.example` is stale.

---

## 6. Storage & Data

### 6.1 Primary Store — PostgreSQL (Neon)

- Prisma is the only access layer. `prisma/schema.prisma` is the source of truth.
- Schema changes go through migrations; no `ALTER TABLE`.
- Seed / cleanup scripts run locally against Neon.

### 6.2 Time and Money

- **Timestamps are UTC** in the database (Prisma default). Client renders in `Africa/Lagos`. Verified at baseline.
- **Money is integer kobo** in the DB (`User.balance`, `Transaction.amount`, `Order.charge`, `Order.cost`, service `costPer1k` — all `Int`). Gateway integrations receive Naira (divide by 100 at the edge). Display formats ₦ at render time. No floats for money. Verified at baseline.

### 6.3 Key-Value Config — `Setting` Table

Runtime-editable config (gateway keys, alerts, pricing brackets, maintenance mode) lives in `Setting` as key-value JSON.

- Gateway keys: `gateway_{id}`. Env vars are fallback.
- Document every key in `/docs/SETTINGS.md`: purpose, JSON shape, default, who can write.
- Writes go through a typed helper, not raw `prisma.setting.upsert`.
- Cache in memory; invalidate on write. No settings reads inside hot paths.

### 6.4 Client Storage

- Theme: `localStorage` key `nitro-theme`, values `night | day`. See §19.
- Session tokens: HTTP-only cookies, SHA-256 hashed server-side.
- Nothing else writes to `localStorage` / `sessionStorage` directly.

### 6.5 Sessions

- 1 web + 1 mobile per user (tablets count as mobile — see §21).
- Expiry: user 7 days, admin 3 days, superadmin 90 days.
- **Password reset must kill all sessions on all devices.** It currently does not — see §8.1. This is the Phase 1 P0.

---

## 7. Architecture

### 7.1 Nitro Is One App

Shared state, shared styles, shared behavior. One theme system, one nav, one auth, one toast, one modal, one loading screen. Find the centralized module and extend it — don't fork. Duplicates found during audit get consolidated.

### 7.2 Directory Layout

```
/
├── app/                  # Next.js App Router
│   ├── (auth)/           # login, signup, verify, reset
│   ├── (dashboard)/      # user pages
│   ├── admin/            # admin panel
│   ├── api/              # API routes
│   ├── blog/             # blog
│   └── globals.css       # theme tokens + minimal resets (post-migration)
├── components/           # shared React components
├── lib/                  # server utils, provider adapters, prisma, auth, logger, rate-limit
├── prisma/               # schema, migrations, seeds
├── public/               # static assets
├── scripts/              # one-off local scripts (seed, cleanup, audit, setting backups)
└── docs/                 # project documentation
```

### 7.3 API Conventions

- Every route validates session + role at the top.
- Every route validates input before touching the DB.
- Consistent JSON shape: `{ ok, data? }` or `{ error }` with appropriate HTTP status.
- User-facing errors follow §12 (Nigerian English, no tech leakage).

### 7.4 Payments

- `/api/payments/initialize` — dispatches to selected gateway (currently Flutterwave). **Must accept an idempotency key** — see §8.2.
- `/api/payments/verify` — verifies return-URL.
- `/api/payments/webhook` and `/api/payments/crypto/webhook` — async. **Both verify signatures today but bypass if the secret env is missing** — fix in §8.3.

### 7.5 Provider Dispatch

Every service has a `provider` field. Dispatch routes by that field. Hardcoded `import … from '@/lib/mtp'` outside the adapter itself is banned — previous bug.

### 7.6 Pricing Engine

Structurally guarantees Budget < Standard < Premium.

- **Tier multipliers:** Budget 1.0×, Standard 1.15×, Premium 1.35×.
- **Wholesale cost brackets:** ₦0–20 × 3.5, ₦20–200 × 2.5, ₦200–1K × 2, ₦1–5K × 1.7, ₦5–20K × 1.5, ₦20K+ × 1.35.
- **Minimum orders:** Followers 100, Likes 50, Views 500, Comments 10, Engagement 50, Subscribers 100.

Don't "simplify" this in Phase 1.

---

## 8. Security Gaps to Close in Phase 1

Four concrete gaps identified against the baseline commit. All fit the "better, not slower" rule — they're correctness fixes with negligible runtime cost.

### 8.1 Password Reset Does Not Kill Sessions (P0)

Current `app/api/auth/reset-password/route.js` updates the password but leaves existing sessions alive. That makes reset security theater.

**Fix:** inside the same `$transaction` that updates the password, call `prisma.session.deleteMany({ where: { userId: user.id } })`. After the reset, the user re-authenticates on every device.

Verify via the test matrix in §16 (case: toggle → reset → existing session should be logged out on both devices).

### 8.2 Payment Init Has No Idempotency (P1)

`/api/payments/initialize` accepts `{ amount, method, couponId }`. A user double-clicking Pay creates two Flutterwave sessions, two `Transaction` rows, and a user experience that ranges from confusing to charged-twice.

**Fix:**

- Client generates a UUIDv4 `idempotencyKey` per attempt and sends it in the request body.
- Server persists `idempotencyKey` on the `Transaction` row with a unique index on `(userId, idempotencyKey)`.
- On duplicate, return the existing `authorization_url` instead of creating a new session.
- Add the column via a migration; backfill existing rows with `gen_random_uuid()` to satisfy the unique index.

### 8.3 Webhook Signature Bypass (P1)

Both `app/api/payments/webhook/route.js` (Flutterwave) and `app/api/payments/crypto/webhook/route.js` (NOWPayments) verify signatures **only if the secret env var is set**. In production, missing secret = accept any request.

**Fix:**

- If `process.env.NODE_ENV === 'production'` and the webhook secret is unset, **refuse to start the route** (return 503 + Sentry alert).
- If the secret is set but the header is missing or mismatched, reject with 401 as today.
- Never silently accept an unsigned webhook in production.

### 8.4 Stale `thenitro.ng` in Middleware (P1)

`middleware.js` line 18 still whitelists `https://thenitro.ng` and `https://www.thenitro.ng` as allowed CSRF origins. `.env.example` still sets `BREVO_SENDER_EMAIL=noreply@thenitro.ng`.

**Fix:**

- `middleware.js` — drop the two `thenitro.ng` entries; keep `nitro.ng` and `www.nitro.ng`.
- `.env.example` — set `BREVO_SENDER_EMAIL=noreply@nitro.ng`.
- Ripgrep for any other `thenitro` reference and fix in the same commit.

### 8.5 Rate Limiting — Already Present, Consider Tightening

Rate limits exist via `lib/rate-limit.js`. Current values at baseline:

- Login: 10 / minute per IP
- Signup: 5 / minute per IP
- Others vary

Phase 1 does **not** rework the rate limiter. If a specific route is missing a limiter, add one at the route's current window profile. If the product decision is to tighten auth limits (e.g. to 5 / 10 minutes), that's a Phase 2 call — file as P3.

### 8.6 Secrets Handling — Minimum Viable

This is an SMM panel, not a regulated institution. Minimum viable:

- Document who has Vercel env access in `/docs/SECRETS.md` — keep it short.
- Rotate gateway secrets if any team member leaves or a key is suspected leaked. No formal quarterly calendar required.
- Never commit secrets. `trufflehog` scan before any force push (force push is banned anyway — see §22).

---

## 9. Tailwind Migration

This is the largest Phase 1 workstream. Done correctly, it makes the codebase simpler, smaller (Tailwind JIT ships only used classes), and more maintainable. Done incorrectly, it's a regression vector.

### 9.1 Install and Configure

- Install **Tailwind CSS v4** (or latest stable matching the Next.js 16 + App Router combo).
- Breakpoints are Tailwind defaults — **do not override**:
  - `sm:` 640px — larger phones, small tablets
  - `md:` 768px — tablets
  - `lg:` 1024px — small laptops
  - `xl:` 1280px — desktops
- Register theme tokens as CSS variables in `app/globals.css` and expose them to Tailwind via the v4 `@theme` directive (or `tailwind.config.js` theme extension if staying on v3). Token list:
  - `--color-accent: #c47d8e`
  - `--color-bg-dark: #080b14`
  - `--color-bg-dark-alt: #0f1322`
  - `--color-bg-light: #f4f1ed`
  - `--color-bg-light-alt: #e6e3dc`
  - Derived text/border/muted tokens as needed.
- Fonts stay self-hosted via `@fontsource/*`. Expose `font-outfit`, `font-serif` (Cormorant), and `font-mono` (JetBrains) as Tailwind font-family utilities.

### 9.2 Migration Rule

- If Tailwind can express a style → it goes in `className`.
- If Tailwind can't express it (complex keyframes, container queries not yet supported, highly bespoke selectors) → keep it in `globals.css`, minimal.
- If it's theme-dependent and changes with `dark` state at runtime → keep as inline `style` or use Tailwind's `dark:` utility with the `class` strategy driven by the existing theme toggle.

### 9.3 Inline Styles — What Stays, What Goes

**Remove** any inline style that:

- Sets static layout (`display`, `flex`, `gap`, `grid`, `padding`, `margin`, `width`, `height`, `maxWidth`, `minHeight`).
- Sets static typography (`fontSize`, `fontWeight`, `lineHeight`, `letterSpacing`).
- Sets static borders, shadows, or radii.

**Keep** inline when:

- The value is theme-dependent and comes from a runtime theme object (`style={{ color: t.text }}`) — but prefer migrating these to Tailwind's `dark:` utility where possible.
- The value is genuinely dynamic at runtime (`style={{ transform: \`translateX(${offset}px)\` }}`).
- The value is a one-off numeric animation target not expressible as a utility.

### 9.4 Breakpoint Migration

Current `globals.css` uses `767px` and `1199px` cutoffs. Migrate to Tailwind defaults:

- `max-width: 767px` → Tailwind: base (mobile-first), override at `sm:` or `md:` for larger
- `max-width: 1199px` → Tailwind: `lg:` and `xl:` for anything desktop-specific
- Mobile-first always — base classes target mobile, `sm:` / `md:` / `lg:` / `xl:` layer desktop behavior

### 9.5 Migration Order

Migrate by page group to keep each PR reviewable:

1. `app/(auth)/*` — 4 pages. Small, high-leverage, zero ambiguity.
2. `components/` — shared chrome (nav, sidebar, modals, toasts). High reuse; do next.
3. `app/(dashboard)/*` — user-facing main surface.
4. `app/admin/*` — admin panel.
5. `app/blog/*` — low-traffic, migrate last.
6. Landing page — migrate in isolation; design-sensitive.

Each group:

- Create a backup branch: `backup/pre-tailwind-<group>-<YYYYMMDD>`.
- Migrate in the branch.
- Visual-diff against production screenshots at sm / md / lg / xl.
- Run brace-balance on every changed `.jsx`.
- Merge to `main` only when the group is fully converted.

### 9.6 "Better, Not Slower"

After each group merges:

- Run `npm run build` and record the route-level JS sizes.
- Record the route-level CSS size.
- If total shipped bytes grow, stop and investigate. Tailwind JIT should reduce CSS, not grow it.
- If LCP / CLS / INP numbers regress on Lighthouse, roll back that group.

---

## 10. Code Standards

### 10.1 Styling (post-migration)

- **Tailwind utilities in `className`.**
- **`globals.css`** holds only theme tokens, resets, and what Tailwind can't express.
- **Inline `style`** only for theme-dependent dynamic values or runtime-computed transforms.
- Never hand-write CSS that duplicates a Tailwind utility.

### 10.2 Pre-Reserve Layout Space

Every dynamic UI element reserves its space. Error banners, validation messages, password strength indicators, inline spinners, toast docks, empty-state placeholders.

Pattern: fixed `min-height` wrapper; toggle `visibility` / `opacity`, never `display`. Never conditional-render an element that occupies vertical space in a form.

### 10.3 Atomic Operations

Money, balance, inventory, claims → atomic.

- DB check-then-act is banned. Use `UPDATE … WHERE guard_condition` inside `$transaction`.
- Webhooks use the claim pattern: `updateMany({ where: { status: 'Pending', … }, data: { status: 'Processing' } })`; proceed only if `count === 1`.
- Referral bonuses use a marker row with a unique index.

**Failure path when `count !== 1`:**

1. Log via `lib/logger.js` — payment ID, expected status `Pending`, actual status (re-fetch), gateway event ID.
2. Return **HTTP 200** to the gateway with `{ received: true, deduplicated: true }` so it stops retrying.
3. No user-facing notification.

### 10.4 Brace Balance Check

Before any JSX commit:

```bash
node -e "const c=require('fs').readFileSync('FILE','utf8');let b=0,p=0,s=0;for(const ch of c){if(ch==='{')b++;if(ch==='}')b--;if(ch==='(')p++;if(ch===')')p--;if(ch==='[')s++;if(ch===']')s--;}console.log(b===0&&p===0&&s===0?'OK':'FAIL b:'+b+' p:'+p+' s:'+s)"
```

Zero across `{ } ( ) [ ]`. No exceptions.

### 10.5 Better, Not Slower

If a change makes the code clearer, smaller, more consistent, or more correct **without** increasing bundle size, LCP, CLS, or INP — take it.

If a change trades runtime performance for code elegance — don't. Measure before and after on any refactor touching a rendered surface.

Practical examples:

- Migrating inline styles to Tailwind: usually **faster** (smaller CSS, better gzip). Do it.
- Extracting a reusable component: usually neutral. Do it if it improves clarity.
- Adding a runtime formatting library for dates when `Intl.DateTimeFormat` suffices: **slower, larger bundle.** Don't.
- Switching a sync path to async for no reason: **slower perceived.** Don't.

### 10.6 Fix Properly, First Time

Right fix now > quick fix now + rework later, unless deferral is explicitly documented.

### 10.7 Don't Make Unrequested Changes

Revert only what was asked. Fix only what was asked. Surface refactor ideas in the audit doc; don't take them.

### 10.8 Pending Lists Stay Accurate

Done = done. Don't pad.

---

## 11. Audit Tracks

### 11.1 Tailwind Migration Audit

- Detection of what's left: `rg "style=\{\{" -t jsx -t js components/ app/` and `rg "className" components/ app/ | rg -v "class:"` for anything not yet using Tailwind utilities.
- Per-file table in `/docs/PHASE_1_AUDIT.md`: `file`, `inline_before`, `inline_after`, `classes_migrated`, `globals_css_lines_removed`.

### 11.2 Layout-Shift Audit

- Chrome DevTools → Performance → record; trigger dynamic state.
- Target **CLS < 0.05** (premium = no shift, stricter than the default 0.1).
- Screenshot before/after for each finding.
- Pages at minimum: landing, signup, login, forgot-password, reset-password, dashboard, new-order, add-funds, orders list, admin login, admin payments.

### 11.3 Duplication Audit

Ripgrep keywords, enumerate, consolidate:

```
rg "useState.*theme|useState.*dark" components/ app/
rg "localStorage\.(get|set)Item" components/ app/
rg "toast|notify" components/ app/
```

Any siloed implementation of a shared system (theme, nav, auth, toast, modal, loading) is a finding.

### 11.4 Paystack Reference Audit

```
rg -i "paystack" .
```

Every hit is removed except `lib/name-filter.js` (intentional) and historical `/docs/CHANGELOG.md` entries.

### 11.5 Stale Domain Audit

```
rg "thenitro" .
```

All hits get replaced with `nitro.ng`.

### 11.6 Hardcoded Provider Import Audit

```
rg "from ['\"]@?/?lib/mtp['\"]" app/ components/ lib/
```

Any hit outside `lib/mtp` itself is a P1 finding.

---

## 12. Nigerian English Voice

Tone: direct, calm, competent. Someone telling you what happened, not apologizing for it.

Rules:

- No exclamation marks in error or status copy.
- No "Oops!", "Whoops!", "Uh oh!".
- No emoji in error copy.
- No technical error names leaked to users (`TokenExpiredError`, Prisma codes, HTTP statuses).

Examples:

- ✅ "Your account couldn't be verified. Try again or contact support."
- ❌ "Account verification failed: TokenExpiredError"
- ✅ "Payment didn't go through. Your card wasn't charged."
- ❌ "Payment processing exception: gateway timeout"
- ✅ "We couldn't reach the provider. Your order is saved and will retry automatically."
- ❌ "Error 502: Upstream provider returned non-2xx."
- ✅ "Too many requests. Try again in 45 seconds."
- ❌ "Rate limit exceeded."

---

## 13. Design System

| Token | Value |
|---|---|
| Accent | `#c47d8e` |
| Dark bg | `#080b14` · alt `#0f1322` |
| Light bg | `#f4f1ed` · alt `#e6e3dc` |
| UI font | Outfit |
| Serif accent | Cormorant Garamond |
| Mono | JetBrains Mono (coupons, API keys, order IDs only) |

Breakpoints: Tailwind defaults (sm 640, md 768, lg 1024, xl 1280). See §9.1.

Premium positioning. Rose accent is subtle. No loud gradients, no apology-theater copy, no mass-panel aesthetics.

Tier colors: Budget amber, Standard blue, Premium purple. Nigerian-specific services: green tint + flag.

---

## 14. Audit Document Template

Paste into `/docs/PHASE_1_AUDIT.md` at session start:

```
# Phase 1 Audit

**Started:** YYYY-MM-DD
**Baseline commit:** 33075bb (tag v1.0)
**Status:** In progress | Complete

## Summary

| Track | P0 | P1 | P2 | P3 | Status |
|---|---|---|---|---|---|
| Tailwind migration | | | | | |
| Layout shift | | | | | |
| Duplication | | | | | |
| Paystack refs | | | | | |
| Stale domain | | | | | |
| Password reset session kill | | | | | |
| Payment init idempotency | | | | | |
| Webhook signature bypass | | | | | |
| Middleware origins | | | | | |
| End-to-end order (MTP / JAP / DaoSMM) | | | | | |
| Notification persistence | | | | | |

## Findings

| # | Severity | Track | File / Area | Summary | Evidence | Status | Commit |
|---|---|---|---|---|---|---|---|

## Deferred

| # | Track | Summary | Justification | Phase |
|---|---|---|---|---|
```

---

## 15. End-to-End Order Test

Run the full flow on **Flutterwave**, **NOWPayments**, and **Manual**, and — since all three SMM providers are routed — include at least one service from each of **MTP**, **JAP**, and **DaoSMM** across the runs. Every step gets screenshot or log evidence in `/docs/evidence/phase-1/order-e2e/<payment>/<provider>/<step>.*`.

Assertions:

1. **Signup** — User row created; verification email arrives within 60s; token works; `emailVerified = true`.
2. **Login** — session cookie set; session row created; device type detected.
3. **Service selection** — catalog loads; price computed per §7.6; minimum-order guard enforced.
4. **Payment init** — `/api/payments/initialize` returns session URL; Transaction row has `idempotencyKey` (post-§8.2); double-click returns same session.
5. **Payment completion** — gateway returns success; webhook arrives; signature verifies (secret set); Transaction `Pending → Processing` exactly once via atomic claim (observable in logs).
6. **Provider dispatch** — MTP returns a provider order ID, stored on Order; status `Processing`.
7. **Status sync** — Order transitions to `Completed` via the sync mechanism (document which one in `/docs/API_PROVIDERS.md`).
8. **Notification** — completion email arrives; in-app notification appears; both respect user preferences.

---

## 16. Notification Persistence Test Matrix

| # | Client | Action | Expected |
|---|---|---|---|
| 1 | Web Chrome | Toggle setting → reload | Persists |
| 2 | Web Chrome | Toggle → close tab → reopen | Persists |
| 3 | Web Chrome | Toggle → switch theme → reload | Persists (theme toggle must not clobber prefs) |
| 4 | Mobile Safari | Toggle → background → resume | Persists |
| 5 | Web Chrome | Toggle → log out → log back in | Persists |
| 6 | Web Chrome | Toggle on web → log in on Android | Android reflects same state |
| 7 | Web Chrome | Toggle web → simultaneously toggle mobile | Last write wins; no lost update |
| 8 | Any | Password reset → new session | Prefs still intact (reset must not wipe prefs) |

Any fail is P1.

---

## 17. Performance Budget

"Premium" is measurable.

- **LCP** < 2.0s on 4G
- **CLS** < 0.05
- **INP** < 200ms
- **Initial JS** < 180 KB gzipped per route
- **Fonts** — self-hosted `woff2`, `font-display: swap`

Phase 1 measures these on every audited page and records the numbers in `/docs/PHASE_1_AUDIT.md`. If a page regresses from the baseline during the Tailwind migration, that group rolls back (§9.5). Actual perf improvements beyond "don't regress" are Phase 2.

---

## 18. Order Status Sync Mechanism

Phase 1 documents the current mechanism in `/docs/API_PROVIDERS.md`:

- Polling, webhook, or both?
- Where does it live (cron / on-demand / worker)?
- Cadence — if polling and Vercel Hobby cron is daily-only, that's a P1 finding and an upgrade trigger.
- Failure mode — MTP down for 6h / 24h behavior; when is the user notified?
- Status mapping — MTP status strings → Nitro Order status (Processing / In Progress / Completed / Partial / Cancelled).

---

## 19. Theme Auto-Detect

- `localStorage` key `nitro-theme`, values `night | day`.
- First-visit fallback: **19:00–06:00 = night**, otherwise **day**.
- Timezone `Africa/Lagos` via `Intl.DateTimeFormat().resolvedOptions().timeZone`. Fallback if unavailable: `night`.
- SSR: render `night` by default, hydrate to stored/detected. No FOUC.

---

## 20. Email Delivery Failure Handling

Verification email failures cannot be black holes.

1. Brevo error → retry once with exponential backoff (1s, abort).
2. Still failing → log to Sentry; surface to support inbox.
3. User sees: "We're having trouble sending the email. Use the resend button below or contact support@nitro.ng." with a working Resend button.

**DNS check — Phase 1 deliverable:** confirm SPF, DKIM, DMARC for `nitro.ng` are set up for Brevo. 10 minutes now, disaster avoided later.

---

## 21. Session Device Detection

- UA-based at session creation; `deviceType` stored on session row.
- Library/regex documented in `/docs/SECURITY.md`.
- iPad in desktop mode → still mobile (rule wins over header).
- Mobile "Request Desktop Site" → still mobile.
- Third-device login: oldest session of same device class is killed (FIFO). User sees: "You've been logged out on your other [web/mobile] device."

---

## 22. Production Safeguards

- `db:reset` or destructive query: requires `PRODUCTION_OVERRIDE=1` + Neon snapshot ID pasted into confirmation prompt.
- `Setting` writes affecting a live gateway: prior backup to `scripts/setting-backups/{YYYYMMDD}-{key}.json`.
- Prisma migration: reviewed against existing data; run against a Neon branch first.
- Force push to `main`: banned.
- Force push to backup branches: banned.
- Backup branch retention: 30 days minimum, never deleted in Phase 1.

---

## 23. Workflow

### 24.1 Mockup Before Implementation

For any UI change: preview artifact at sm / md / lg / xl → surface for review → explicit approval ("yes build it", "continue", "ship it") → build.

No unsolicited UI changes. Silence is not approval.

### 24.2 Git Pattern

```
node -e "<brace check>"
git add -A
git commit -m "chore(phase-1): <imperative description>"
git push origin main
```

Prefixes: `feat`, `fix`, `chore`, `refactor`, `docs`, `style` (CSS only). Phase 1 commits scope `(phase-1)`.

### 24.3 Backup Branch Naming

`backup/pre-{action}-{YYYYMMDD}`, pushed immediately on creation. Retained 30 days minimum.

### 24.4 No Parallel Sessions on Main

Do not run multiple simultaneous agents pushing to `main`. Use branches and explicit coordination if parallel work is needed.

---

## 24. Acknowledged but Deferred

Evaluated, intentionally not in Phase 1. Filed in `/docs/DEFERRED.md`.

| Item | Phase | Reason |
|---|---|---|
| Order cancellation by user | 2 | Same — document, don't spec |
| Wholesale price drift handling | 2 | No auto-refresh policy today |
| Service catalog sync cadence | 2 | 4,405 services; refresh formalization needed |
| Admin audit log table | 2 | 90-day superadmin sessions with no trail; worth doing soon |
| NDPR — data export / deletion / correction | 2 | Nigerian data subject rights; UI not urgent, policy is |
| Fraud + chargeback handling | 2 | Flutterwave dispute flow coverage enough for launch; formalize later |
| Email deliverability monitoring (bounce rate) | 2 | Phase 1 confirms DNS; ongoing monitoring is Phase 2 |
| Database backup restore cadence | 2 | Phase 1 confirms one successful test restore |
| TypeScript migration | 3 | Large, risky, post-launch |
| CI/CD + automated tests | 3 | Post-launch foundation |
| Railway workers / queues | 3 | Needed when async dispatch demands it |
| Budget sub-brand | 3 | Pricing + UI spin-off |
| Marketer account type | 3 | Full dashboard + attribution system |
| Ticket assignment system | 3 | Post-launch support scaling |
| Admin custom pages grant write access | 2 | Permissions model refinement; low exposure with small team |
| Manual deposit coupon bypass | 2 | Admin-mediated path skips coupon validation; tighten post-launch |
| Crypto deposit coupon not applied | Payment | Bonus stored but never credited; fix when crypto flow finalized |
| Unsupported gateway creates pending records | Payment | Only if unconfigured gateway enabled; fix when providers confirmed |
| WhatsApp manual payment confirmation | Payment | User clicks button → opens WhatsApp with receipt; admin confirms and credits |
| Bulk order page | Payment | Multi-account orders: users add multiple links, each with its own service, tier, and quantity; single checkout. Competitive differentiator |

**Not on this list (intentionally not in any phase):** KYC, AML, formal SLO contracts, formal DR RTO/RPO, third-party status page service. An SMM panel at this scale doesn't need them.

---

## 25. Phase 1 Exit Criteria

- [ ] Tailwind migration complete across `(auth)`, `components`, `(dashboard)`, `admin`, `blog`, and landing. `globals.css` reduced to tokens + resets + what Tailwind can't express. No bundle-size regression per route.
- [ ] Password reset kills all sessions on all devices. Verified via test matrix.
- [ ] Payment init accepts an idempotency key; unique index live; double-click test passes on Flutterwave.
- [ ] Webhook signature verification is mandatory in production — missing secret returns 503 + Sentry alert.
- [ ] `thenitro.ng` removed from `middleware.js`, `.env.example`, and all docs. Ripgrep proof in audit.
- [ ] Paystack references removed outside `lib/name-filter.js` and `/docs/CHANGELOG.md`. Ripgrep proof.
- [ ] Zero layout-shift instances in audited pages; CLS < 0.05 on each.
- [ ] End-to-end order test passes on Flutterwave, NOWPayments, and Manual — with at least one order placed through MTP, one through JAP, and one through DaoSMM. Evidence filed per payment / provider.
- [ ] Notification preferences pass all 8 matrix cases.
- [ ] Order status sync mechanism documented with status mapping table and failure-mode plan.
- [ ] DNS records (SPF, DKIM, DMARC) for `nitro.ng` verified with Brevo.
- [ ] Vercel plan confirmed compliant with commercial-use TOS.
- [ ] `/docs/PHASE_1_AUDIT.md` complete: every track, every finding, every commit.
- [ ] `/docs/DEFERRED.md` populated.
- [ ] `/docs/CHANGELOG.md` updated with a Phase 1 entry.

When every box is checked, open PR titled **`Phase 1: Pre-Launch Hardening + Tailwind Migration`** and request review before merging.

---

## 26. Reference

- **Repo:** `github.com/ajadonai/NitroNG`
- **Domain:** `nitro.ng`
- **Database:** Neon PostgreSQL, `eu-west-2`
- **Frontend:** Vercel
- **Email sender:** `noreply@nitro.ng` (Brevo)
- **Support:** `support@nitro.ng`
- **Admin:** `admin@nitro.ng`
- **Payments (active):** Flutterwave, NOWPayments, Manual bank transfer
- **SMM providers (all active, routed via `lib/smm.js`):** MTP, JAP, DaoSMM
- **Socials:** Instagram `@Nitro.ng` / `@TheNitroNg`, X `@TheNitroNG`
- **Docs:** `/docs/` — PROJECT_OVERVIEW, DEPLOYMENT, API_PROVIDERS, SERVICES, SECURITY, DATABASE_SCHEMA, EMAIL_TEMPLATES, CHANGELOG. Phase 1 adds: SETTINGS, SECRETS, PAYMENTS, RUNBOOKS, DEFERRED, PHASE_1_AUDIT.

---

*Brief authored for Adonai (Trip) — Nitro founder and developer.*
