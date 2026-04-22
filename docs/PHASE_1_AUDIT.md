# Phase 1 Audit

**Started:** 2026-04-18
**Baseline commit:** 33075bb (tag v1.0)
**Status:** Complete

## Summary

| Track | P0 | P1 | P2 | P3 | Status |
|---|---|---|---|---|---|
| Tailwind migration | — | — | — | — | Complete |
| Layout shift | — | 2 fixed | — | — | Complete |
| Duplication | — | — | — | — | No findings |
| Paystack refs | — | 1 fixed | — | — | Complete |
| Stale domain | — | 1 fixed | — | — | Complete |
| Password reset session kill | 1 fixed | — | — | — | Complete |
| Payment init idempotency | — | 1 fixed | — | — | Complete (pre-existing) |
| Webhook signature bypass | — | 1 fixed | — | — | Complete (pre-existing) |
| Middleware origins | — | 1 fixed | — | — | Complete (pre-existing) |
| End-to-end order (MTP / JAP / DaoSMM) | — | — | — | — | Manual QA required |
| Notification persistence | — | — | — | — | Complete — all 8 matrix cases pass |

## Findings

| # | Severity | Track | File / Area | Summary | Status | Commit |
|---|---|---|---|---|---|---|
| 1 | P0 | Security | `app/api/auth/reset-password/route.js` | Password reset now kills all sessions via `session.deleteMany` inside `$transaction` | Fixed (pre-existing) | a24e5bb |
| 2 | P1 | Security | `app/api/payments/initialize/route.js` | Payment init accepts idempotency key; unique index on `(userId, idempotencyKey)`; duplicate returns existing session | Fixed (pre-existing) | a24e5bb |
| 3 | P1 | Security | `app/api/payments/webhook/route.js` | Flutterwave webhook returns 503 when `FLUTTERWAVE_WEBHOOK_HASH` missing in production | Fixed (pre-existing) | a24e5bb |
| 4 | P1 | Security | `app/api/payments/crypto/webhook/route.js` | NowPayments webhook returns 503 when `NOWPAYMENTS_IPN_SECRET` missing in production | Fixed (pre-existing) | a24e5bb |
| 5 | P1 | Stale domain | `middleware.js`, `.env.example`, `README.md` | `thenitro.ng` origins removed from middleware (pre-existing); README secondary domain line removed | Fixed | 851663d |
| 6 | P1 | Paystack refs | `README.md`, `.env.example`, `docs/phase3-marketers-agency.md` | All Paystack references removed except `lib/name-filter.js` (banned-brand list, intentional) | Fixed | 32a0a3d |
| 7 | P1 | Tailwind | 45 JSX files, `app/globals.css` | Full migration from inline styles to Tailwind utilities; `globals.css` reduced from 1891 to 680 lines | Fixed | 34c7a16..5b327a4 |
| 8 | P1 | Layout shift | `components/new-order.jsx` | Link validation error conditionally rendered — changed to `visibility` toggle | Fixed | uncommitted |
| 9 | P1 | Layout shift | `components/addfunds-page.jsx` | Coupon error conditionally rendered — changed to `visibility` toggle; also fixed `AmountInput` and `CouponSection` losing input focus (nested component functions → plain JSX variables) | Fixed | uncommitted |
| 10 | P1 | globals.css | `app/globals.css` | Removed dead CSS classes: `blog-header`, `blog-logo`, `blog-logo-mark`, `blog-article`, `blog-card-thumb`, `admin-root`, `adm-quick-actions`, `adm-action-btn`; removed empty rules and stale comments | Fixed | uncommitted |

## Ripgrep Proof

**Paystack references** (excluding `PHASE_1_BRIEF.md`):
- `lib/name-filter.js` — banned-brand list (intentional, per brief)

**thenitro.ng references** (excluding `PHASE_1_BRIEF.md`):
- `lib/name-filter.js` — banned-name list (intentional)
- `scripts/cleanup-seed-data.js` — real email address `thenitroNG@gmail.com` in protected list (intentional)

## Deferred

See [DEFERRED.md](DEFERRED.md) for items evaluated and intentionally skipped.
