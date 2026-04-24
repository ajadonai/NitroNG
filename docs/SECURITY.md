# Security Architecture

---

## Authentication

### JWT Structure

Nitro uses custom JWT authentication with separate token flows for users and admins.

| Token Type | Expiry | Usage |
|-----------|--------|-------|
| User | 7 days | Standard user sessions |
| Admin | 3 days | Admin panel access |
| Superadmin | 90 days | Superadmin panel access |

Tokens are signed with separate secrets:
- `JWT_SECRET` — user tokens
- `JWT_ADMIN_SECRET` — admin and superadmin tokens

### Token Handling

- Tokens are **hashed with SHA-256** before storage
- Plain-text tokens are never persisted server-side
- Token validation happens in Next.js middleware for route protection
- Expired tokens are rejected at the middleware level — no silent refresh

### Device Session Management

Each account supports **1 web session + 1 mobile session** simultaneously.

- Logging in on a new web device terminates the existing web session
- Logging in on a new mobile device terminates the existing mobile session
- Web and mobile sessions are independent — having both active is fine
- Session type is determined at login based on the User-Agent

---

## Password Security

- Passwords are **hashed with industry-standard algorithms** before storage
- Plain-text passwords are never stored or logged
- Minimum password requirements enforced at registration and change
- Password strength indicator on the registration form (space pre-reserved — no layout shift)

### Password Reset Flow

1. User requests reset → Brevo sends a time-limited reset link
2. Link contains a signed token with expiry
3. User sets new password → old sessions are not automatically invalidated (by design — user stays logged in on current devices)

---

## Role-Based Access Control

### Roles

| Role | Scope |
|------|-------|
| **User** | Dashboard, wallet, orders, services, support, referrals, blog, settings |
| **Admin** | Everything above + admin panel (orders, users, services, tickets, blog CMS, coupons) |
| **Superadmin** | Everything above + admin management, pricing brackets, env config, Paystack settings, audit logs |

### Route Protection

Next.js middleware checks the JWT on every request to protected routes:

- `/dashboard/*` — requires valid user token
- `/admin/*` — requires valid admin/superadmin token
- `/api/admin/*` — requires valid admin/superadmin token in Authorization header
- Public routes (`/`, `/login`, `/signup`, `/blog/*`) — no auth required

### API Route Protection

All API routes that modify data validate the token from the request headers. Admin API routes additionally verify the admin role claim in the JWT payload.

---

## Payment Security

### Paystack Integration

- Nitro **never handles card numbers, bank details, or PINs directly**
- All payment processing happens through Paystack's hosted checkout
- Paystack webhook delivers payment confirmations to `/api/paystack/webhook`
- Webhook signature verification ensures requests come from Paystack (using `PAYSTACK_SECRET_KEY`)
- Wallet credits only happen after webhook verification — not on client-side redirect

### Wallet System

- All order payments deduct from the internal wallet — no direct-to-order card payments
- Wallet balance is server-authoritative — the client displays it but cannot modify it
- Negative balances are impossible (server validates before deduction)
- Refunds credit the wallet, not the original payment method

---

## Data Protection

### In Transit

- All traffic encrypted via **HTTPS/TLS** (enforced by Vercel)
- Database connections require SSL (`?sslmode=require`)
- Provider API calls made over HTTPS

### At Rest

- Database hosted on Neon with encryption at rest (Neon-managed)
- Passwords hashed — not encrypted (one-way, not reversible)
- JWT tokens hashed with SHA-256 before storage

### Data Shared with Third Parties

| Third Party | Data Shared | Data NOT Shared |
|------------|-------------|-----------------|
| Paystack | Transaction amounts, references | User email (only for Paystack receipts) |
| Brevo | User email address | Passwords, wallet balance, orders |
| SMM Providers | Target URL/username, quantity | User account details, email, payments |

---

## Session Security

### Token Storage

Tokens are stored in the browser — the exact storage mechanism depends on the client implementation. The server validates tokens on every protected request regardless of client-side storage.

### Session Invalidation

Sessions are invalidated when:
- The token expires (7 days user, 3 days admin, 90 days superadmin)
- A new login on the same device type pushes out the old session
- `JWT_SECRET` or `JWT_ADMIN_SECRET` is rotated (invalidates ALL sessions of that type)
- An admin suspends the user account

### Concurrent Session Handling

The 1-web + 1-mobile limit is enforced server-side. When a new session is created:
1. Server checks for existing sessions of the same device type
2. If one exists, it's invalidated (token hash removed from DB)
3. New token hash is stored
4. Old device's next request fails token validation → redirected to login

---

## Admin Panel Security

- Separate JWT secret (`JWT_ADMIN_SECRET`) from user tokens
- Shorter session expiry (3 days vs 7 days for users)
- Role verification on every admin API route
- Support ticket soft locking prevents multi-admin conflicts
- Admin activity is tracked (who replied, who locked, when)

---

## Fraud Prevention

- New account monitoring — unusual patterns flagged in admin panel
- Order velocity limits (planned — not yet implemented)
- Paystack chargeback/dispute monitoring via Paystack dashboard
- Admin ability to suspend accounts immediately
- Wallet-based system naturally limits exposure (user can only spend what they've deposited)

---

## Security Checklist

- [x] JWT with SHA-256 token hashing
- [x] Separate user/admin secrets
- [x] Device session limits (1 web + 1 mobile)
- [x] Password hashing (never plain text)
- [x] HTTPS everywhere
- [x] Paystack webhook signature verification
- [x] Server-side wallet balance enforcement
- [x] Role-based route protection
- [x] Email verification on signup
- [ ] Rate limiting on auth endpoints (planned)
- [ ] IP-based suspicious activity detection (planned)
- [ ] Automated session cleanup for expired tokens (planned)
- [ ] Two-factor authentication (future consideration)
