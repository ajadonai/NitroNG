# Security Architecture

Last verified against codebase: July 2026.

---

## Authentication

### JWT Tokens

Nitro uses two independent JWT token flows with separate secrets.

| Token Type | Secret | Expiry | Cookie |
|-----------|--------|--------|--------|
| User | `JWT_SECRET` | 7 days | `nitro_token` |
| Admin | `JWT_ADMIN_SECRET` | 7 days | `nitro_admin_token` |
| Superadmin | `JWT_ADMIN_SECRET` | 14 days | `nitro_admin_token` |

Both secrets are required in production — the app crashes at startup if either is missing (`lib/auth.js:5-7`).

### Token Handling

- Tokens are set as **httpOnly, secure (production), sameSite=lax** cookies
- Plain-text tokens are **hashed with SHA-256** before storage in the `Session` / `AdminSession` tables
- On each request, `getCurrentUser()` / `getCurrentAdmin()` validates the JWT signature, looks up the token hash in the DB, and checks account status (Deleted/Suspended/PendingDeletion are rejected)
- Invalid tokens are immediately cleared from the cookie jar

### Device Session Management

Each account supports **1 web + 1 mobile session** simultaneously. Logging in on a new device of the same type terminates the existing session of that type. Device type is inferred from User-Agent at login (`lib/auth.js:detectDevice`).

---

## Route Protection

**There is no global Next.js middleware.** Route protection is per-handler:

- **User routes** call `getCurrentUser()` from `lib/auth.js` and return 401 if null
- **Admin routes** call `requireAdmin(page, requireWrite?)` from `lib/admin.js`, which calls `getCurrentAdmin()` then checks role-based page/action permissions

> **Every new admin API route must call `requireAdmin()`.** There is no structural middleware guarantee — an unprotected route is an open route.

### Role-Based Access Control

| Role | View Access | Write Access | Special Actions |
|------|------------|-------------|-----------------|
| owner | All pages | All pages | All restricted actions |
| superadmin | All pages | All pages | All restricted actions |
| admin | 21 pages | 17 pages | `users.ban` |
| support | overview, tickets, users, orders | tickets, orders | — |
| finance | overview, orders, finance, payments, users, crew | orders | — |

Restricted actions (e.g. `team.delete`, `payments.configure`, `users.adjustBalance`, `maintenance.toggle`) are gated by role in `lib/admin.js:RESTRICTED_ACTIONS`. Per-admin overrides are possible via `customPages` and `customActions` JSON fields on the Admin model.

---

## Payment Security

### Payment Gateways

Nitro never handles card numbers or bank credentials directly. All payment processing goes through third-party gateways:

| Gateway | Type | Webhook Verification |
|---------|------|---------------------|
| Flutterwave | Cards, bank transfer, mobile money | `verif-hash` header compared to `FLUTTERWAVE_WEBHOOK_HASH` |
| NOWPayments | USDT (TRC-20/ERC-20) | HMAC-SHA512 of sorted JSON body, verified against `NOWPAYMENTS_IPN_SECRET` |
| Monnify | Auto-confirmed bank transfer | Gateway-managed |
| Korapay | Cards, bank transfer | Gateway-managed |
| Manual | User bank transfer | Admin-approved |

Gateway credentials are stored in the `Setting` table as JSON (`gateway_<id>` keys) and can be configured by superadmins without code changes.

### Webhook Signature Verification

- **Flutterwave** (`app/api/payments/webhook/route.js`): Direct comparison of `verif-hash` header against env secret. Returns 503 if secret is not configured, 401 on mismatch.
- **NOWPayments** (`app/api/payments/crypto/webhook/route.js`): HMAC-SHA512 computed over alphabetically-sorted JSON body keys, compared against `x-nowpayments-sig` header. Returns 503 if secret is missing, 403 on mismatch.

Both webhooks refuse to process if their respective secrets are not set — they fail closed, not open.

### Wallet System

- All orders deduct from the internal wallet — no direct card-to-order payments
- Balance is server-authoritative — enforced by atomic SQL: `UPDATE users SET balance = balance - $charge WHERE id = $id AND balance >= $charge`
- Negative balances are impossible
- Refunds credit the wallet, not the original payment method

### Idempotency

Payment initialization requires a client-provided `idempotencyKey`. The `Transaction` table enforces a `@@unique([userId, idempotencyKey])` constraint (`prisma/schema.prisma`). Duplicate keys return the existing transaction's gateway URL instead of creating a new one.

Webhook double-credit is prevented by atomic claim: `updateMany({ where: { reference, status: 'Pending' } })` — only one concurrent webhook can flip a transaction to Completed.

---

## CSRF & Origin Protection

CSRF protection relies on the **combination of httpOnly/sameSite cookies and CORS headers**:

- Cookies are `sameSite: lax`, preventing cross-origin POST requests from sending credentials
- API routes return `Access-Control-Allow-Origin` restricted to `nitro.ng` (production) or `localhost` (dev), configured in `next.config.mjs`
- `X-Frame-Options: DENY` and `Content-Security-Policy: frame-ancestors 'none'` prevent clickjacking

Note: `lib/csrf.js` and `proxy.js` contain origin-check logic but are **not imported anywhere** — they are dead code. The active protection comes from cookie attributes and CORS headers above.

---

## Rate Limiting

Rate limiting uses **Upstash Redis** in production with an **in-memory Map fallback** for development (`lib/rate-limit.js`). Keys are `rl:{ip}:{pathname}`. Rate-limited requests get HTTP 429 with `Retry-After: 60`.

### Rate-Limited Routes

| Route | Max Attempts | Window |
|-------|-------------|--------|
| Login | 10 | 1 min |
| Admin login | 5 | 5 min |
| Signup | 5 | 1 min |
| Forgot password | 5 | 15 min |
| Reset password | 5 | 5 min |
| Change password | 5 | 5 min |
| Delete account | 3 | 5 min |
| Check email | 20 | 1 min |
| API key generation | 5 | 5 min |
| Payment initialization | 10 | 1 min |
| Manual payment claim | 5 | 1 min |
| Order submission | 10 | 1 min |
| Bulk orders | 5 | 1 min |
| Coupon validation | 10 | 1 min |

Crew (Pit) auth routes are also rate-limited with similar windows.

---

## Password Security

- Passwords are hashed with **bcryptjs at cost factor 12** (2^12 = 4,096 iterations)
- Minimum length: 6 characters, maximum: 128
- Plain-text passwords are never stored or logged
- Password reset uses a signed JWT with short expiry, delivered via Brevo email

---

## Input Validation

`lib/validate.js` provides:

- **Email**: regex validation + disposable domain blocklist (~9,500 domains) + common typo detection (e.g. `gnail.com` → suggests `gmail.com`)
- **Password**: 6-128 character length check
- **Phone**: 10-15 digits after stripping non-numeric characters
- **Name**: 2-100 characters, letters/spaces/hyphens/apostrophes/periods only + name blacklist
- **Sanitization**: HTML tag stripping, trimming, length caps
- **HTML escaping**: `& < > " '` entity encoding

---

## Welcome Bonus IP Guard

`lib/welcome-bonus.js` prevents multi-account farming of the first-deposit bonus:

1. After the atomic `firstDepositBonusPaid` claim succeeds, the user's `signupIp` is checked
2. If `signupIp` is null or `'unknown'`, the bonus is paid normally
3. Otherwise, count other users with the same `signupIp` where `firstDepositBonusPaid = true` within the configured time window
4. If count >= cap: bonus is **withheld** (claim stays consumed), an admin `Alert` is created with type `welcome_bonus_ip_flag`, and `0` is returned
5. The deposit itself is never blocked — only the bonus credit

Configuration via `Setting` rows (defaults if unset):
- `welcome_bonus_ip_cap`: max bonus claims per IP (default: 2)
- `welcome_bonus_ip_window_days`: lookback window in days (default: 60)

Database index on `User.signupIp` supports the count query.

---

## Security Headers

Configured in `next.config.mjs`:

- **Content-Security-Policy**: restricts script-src, connect-src, frame-src to known domains; blocks `unsafe-eval` in production
- **X-Frame-Options**: `DENY`
- **X-Content-Type-Options**: `nosniff`
- **Referrer-Policy**: `strict-origin-when-cross-origin`
- **Permissions-Policy**: camera, microphone, geolocation disabled
- **Strict-Transport-Security**: 1 year with includeSubDomains
- **CORS**: API routes restricted to `nitro.ng` origin in production

---

## Data Protection

### In Transit

- All traffic encrypted via HTTPS/TLS (enforced by Vercel + HSTS header)
- Database connections require SSL (`?sslmode=require`)
- All provider API calls (Flutterwave, NOWPayments, MTP, DaoSMM, Brevo) over HTTPS

### At Rest

- Database hosted on Neon (PostgreSQL) with encryption at rest (Neon-managed)
- Passwords: bcrypt-hashed (irreversible)
- Session tokens: SHA-256-hashed before storage
- JWT secrets: environment variables, never committed to source

### Data Shared with Third Parties

| Third Party | Data Shared | Data NOT Shared |
|------------|-------------|-----------------|
| Flutterwave | Transaction amounts, references, user email | Passwords, wallet balance, order details |
| NOWPayments | Transaction amounts, crypto addresses | User identity, email |
| Monnify / Korapay | Transaction amounts, references | Passwords, order details |
| Brevo | User email, name | Passwords, wallet balance, orders |
| SMM providers (MTP, DaoSMM) | Target URL, quantity | User identity, email, payment info |

---

## Fraud Prevention

- **Welcome bonus IP guard** caps bonus claims per IP with admin alerts
- **Referral self-referral detection**: flags when referrer and referee share the same `signupIp`
- **Wallet-based system** naturally limits exposure — users can only spend deposited funds
- **Atomic balance deduction** prevents race-condition overspend
- **Admin account suspension** immediately invalidates all sessions
- **Rate limiting** on auth, payment, and order endpoints

---

## Cookie Consent

Non-essential cookies (Meta Pixel) are gated behind opt-in consent per GAID 2025 Art. 19. The Meta Pixel script only loads after the user clicks "Accept" in the cookie banner. Server-side CAPI events (first-party, contract basis) continue regardless of consent status. Users can revoke consent via "Cookie Settings" in the footer.

---

## Monitoring

- **Sentry** for error tracking and performance monitoring
- **Structured logger** (`lib/logger.js`) outputs JSON in production
- **WatchTower** Telegram bot for real-time alerts (revenue, orders, users, system, timeouts)
- **UptimeRobot** for uptime monitoring (public status page)
- **Admin activity log** tracks all admin actions with timestamps and actor identity
