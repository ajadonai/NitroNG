# Database Schema Reference

> PostgreSQL on Neon (eu-west-2) | Prisma 6 ORM
> All table names are **lowercase** — always quote in raw SQL: `"users"`, `"orders"`, `"tickets"`

---

## Entity Relationship Overview

```
users
  ├── orders (one-to-many)
  ├── tickets (one-to-many)
  ├── walletTransactions (one-to-many)
  ├── sessions (one-to-many)
  ├── referrals (one-to-many, as referrer)
  └── notifications (one-to-many)

orders
  ├── user (many-to-one → users)
  └── serviceTier (many-to-one → serviceTiers)

serviceTiers
  └── serviceGroup (many-to-one → serviceGroups)

serviceGroups
  └── platform (many-to-one → platforms)

tickets
  ├── user (many-to-one → users)
  └── messages (one-to-many → ticketMessages)

coupons
  └── couponUsages (one-to-many)
```

---

## Core Tables

### users

The central table. Every customer, admin, and superadmin is a user.

| Column | Type | Notes |
|--------|------|-------|
| id | String (cuid) | Primary key |
| email | String | Unique, indexed |
| password | String | Hashed (never plain text) |
| displayName | String | User-chosen display name |
| role | Enum | `USER`, `ADMIN`, `SUPERADMIN` |
| walletBalance | Decimal | Server-authoritative. Default 0. Never negative. |
| emailVerified | Boolean | Default false. Set true after verification code confirmed. |
| suspended | Boolean | Default false. Blocks login and order placement. |
| referralCode | String | Unique code for the referral program |
| referredBy | String? | ID of the user who referred this user |
| createdAt | DateTime | Auto-set on creation |
| updatedAt | DateTime | Auto-updated |

**Indexes:** `email` (unique), `referralCode` (unique)

---

### sessions

Tracks active login sessions for device limit enforcement.

| Column | Type | Notes |
|--------|------|-------|
| id | String (cuid) | Primary key |
| userId | String | FK → users.id |
| tokenHash | String | SHA-256 hash of the JWT. Never stores plain token. |
| deviceType | Enum | `WEB`, `MOBILE` |
| createdAt | DateTime | When the session was created |
| expiresAt | DateTime | When the token expires |

**Logic:** On login, check for existing session with same `userId` + `deviceType`. If found, delete it (invalidate old session), then create new one. This enforces the 1-web + 1-mobile limit.

---

### orders

Every service order placed by a user.

| Column | Type | Notes |
|--------|------|-------|
| id | String (cuid) | Primary key |
| userId | String | FK → users.id |
| serviceTierId | String | FK → serviceTiers.id |
| targetLink | String | URL or username the service targets |
| quantity | Int | Number of units ordered |
| amount | Decimal | Amount charged to user (in ₦) |
| status | Enum | `PENDING`, `PROCESSING`, `IN_PROGRESS`, `COMPLETED`, `PARTIAL`, `CANCELLED`, `REFUNDED` |
| providerOrderId | String? | The upstream provider's order ID (set after submission) |
| providerName | String? | Which provider handled this order (e.g., "MTP") |
| startCount | Int? | Starting count reported by provider |
| remains | Int? | Undelivered units (for partial orders) |
| refundAmount | Decimal? | Amount refunded (if partial or cancelled) |
| createdAt | DateTime | |
| updatedAt | DateTime | |

**Indexes:** `userId`, `status`, `createdAt`

---

### walletTransactions

Every movement of funds in a user's wallet.

| Column | Type | Notes |
|--------|------|-------|
| id | String (cuid) | Primary key |
| userId | String | FK → users.id |
| type | Enum | `DEPOSIT`, `ORDER_DEDUCTION`, `REFUND`, `REFERRAL_BONUS`, `ADMIN_CREDIT`, `ADMIN_DEBIT` |
| amount | Decimal | Positive for credits, stored as absolute value |
| balanceAfter | Decimal | Wallet balance after this transaction |
| reference | String? | Paystack reference (for deposits) or order ID (for deductions/refunds) |
| description | String? | Human-readable description |
| createdAt | DateTime | |

**Indexes:** `userId`, `type`, `createdAt`

---

### platforms

Social media platforms supported by Nitro.

| Column | Type | Notes |
|--------|------|-------|
| id | String (cuid) | Primary key |
| name | String | e.g., "Instagram", "TikTok", "YouTube" |
| slug | String | URL-friendly: "instagram", "tiktok" |
| icon | String? | Icon identifier or URL |
| isActive | Boolean | Toggle platform visibility |
| sortOrder | Int | Display order on the services page |

---

### serviceGroups

User-facing service categories within a platform.

| Column | Type | Notes |
|--------|------|-------|
| id | String (cuid) | Primary key |
| platformId | String | FK → platforms.id |
| name | String | e.g., "Instagram Followers", "Instagram Followers — Nigeria" |
| slug | String | URL-friendly name |
| description | String? | Short description shown to users |
| isNigerian | Boolean | Whether this targets Nigerian audiences (enables green tint + flag) |
| isActive | Boolean | Toggle availability |
| sortOrder | Int | Display order within the platform |

---

### serviceTiers

Individual purchasable tiers within a service group.

| Column | Type | Notes |
|--------|------|-------|
| id | String (cuid) | Primary key |
| serviceGroupId | String | FK → serviceGroups.id |
| tier | Enum | `BUDGET`, `STANDARD`, `PREMIUM` |
| providerServiceId | Int | The upstream provider's service ID |
| providerName | String | Which provider: "MTP", "JAP", "DAOSMM" |
| providerRate | Decimal | Provider's cost per 1K units (in provider currency) |
| price | Decimal | Nitro's price to the user (in ₦, after markup) |
| minQuantity | Int | Minimum order quantity |
| maxQuantity | Int | Maximum order quantity |
| hasRefill | Boolean | Whether the provider offers refill |
| hasCancel | Boolean | Whether the order can be cancelled |
| isActive | Boolean | Toggle availability |
| description | String? | Tier-specific description |

**Indexes:** `serviceGroupId`, `providerName` + `providerServiceId`

---

### tickets

Support tickets (WhatsApp-style system).

| Column | Type | Notes |
|--------|------|-------|
| id | String (cuid) | Primary key |
| userId | String | FK → users.id |
| subject | String | Ticket subject line |
| status | Enum | `OPEN`, `IN_PROGRESS`, `AWAITING_USER`, `RESOLVED`, `CLOSED` |
| priority | Enum | `LOW`, `NORMAL`, `HIGH`, `URGENT` |
| lockedBy | String? | Admin user ID who currently has the soft lock |
| lockedAt | DateTime? | When the lock was acquired |
| lastRepliedBy | String? | Admin user ID of the last responder |
| createdAt | DateTime | |
| updatedAt | DateTime | |

**Indexes:** `userId`, `status`, `lockedBy`

**Soft lock logic:** Lock expires after 5 minutes. Heartbeat from the admin's browser resets `lockedAt`. On ticket open, check if `lockedAt` is within 5 minutes — if yes, show "locked by [admin]" banner.

---

### ticketMessages

Individual messages within a ticket thread.

| Column | Type | Notes |
|--------|------|-------|
| id | String (cuid) | Primary key |
| ticketId | String | FK → tickets.id |
| senderId | String | User or admin ID who sent the message |
| senderType | Enum | `USER`, `ADMIN`, `BOT` |
| content | String | Message text |
| isInternal | Boolean | If true, only visible to admins (internal note) |
| createdAt | DateTime | |

---

### coupons

Discount codes.

| Column | Type | Notes |
|--------|------|-------|
| id | String (cuid) | Primary key |
| code | String | Unique coupon code (e.g., "LAUNCH20") |
| discountType | Enum | `PERCENTAGE`, `FIXED` |
| discountValue | Decimal | Percentage (e.g., 20) or fixed amount in ₦ |
| minOrderAmount | Decimal? | Minimum order total to apply |
| maxUses | Int? | Total usage limit |
| usedCount | Int | Current usage count |
| expiresAt | DateTime? | Expiry date |
| isActive | Boolean | |
| createdAt | DateTime | |

**Indexes:** `code` (unique)

---

### couponUsages

Tracks which users used which coupons.

| Column | Type | Notes |
|--------|------|-------|
| id | String (cuid) | Primary key |
| couponId | String | FK → coupons.id |
| userId | String | FK → users.id |
| orderId | String | FK → orders.id |
| discountApplied | Decimal | Actual discount amount in ₦ |
| createdAt | DateTime | |

---

### referrals

Tracks referral relationships and bonus payouts.

| Column | Type | Notes |
|--------|------|-------|
| id | String (cuid) | Primary key |
| referrerId | String | FK → users.id (the person who referred) |
| referredId | String | FK → users.id (the person who was referred) |
| bonusAmount | Decimal? | Bonus paid to referrer (null until first purchase) |
| bonusPaid | Boolean | Whether the bonus has been credited |
| createdAt | DateTime | |

---

### blogPosts

Blog content managed via the admin CMS.

| Column | Type | Notes |
|--------|------|-------|
| id | String (cuid) | Primary key |
| title | String | Post title |
| slug | String | URL slug (unique) |
| content | String | Post body (HTML or markdown) |
| excerpt | String? | Short preview text |
| featuredImage | String? | Image URL |
| category | String? | Post category |
| tags | String[] | Array of tags |
| status | Enum | `DRAFT`, `PUBLISHED`, `SCHEDULED` |
| publishedAt | DateTime? | When published or scheduled to publish |
| authorId | String | FK → users.id (admin who wrote it) |
| createdAt | DateTime | |
| updatedAt | DateTime | |

**Indexes:** `slug` (unique), `status`, `publishedAt`

---

## Common Queries

**Get user with wallet balance and recent orders:**
```sql
SELECT u.id, u.email, u."displayName", u."walletBalance",
  (SELECT COUNT(*) FROM "orders" o WHERE o."userId" = u.id) as "orderCount"
FROM "users" u WHERE u.id = 'user_id';
```

**Find stuck orders (Pending > 30 min):**
```sql
SELECT * FROM "orders"
WHERE status = 'PENDING'
AND "createdAt" < NOW() - INTERVAL '30 minutes';
```

**Clear stale ticket locks:**
```sql
UPDATE "tickets"
SET "lockedBy" = NULL, "lockedAt" = NULL
WHERE "lockedAt" < NOW() - INTERVAL '10 minutes';
```

**Daily revenue:**
```sql
SELECT DATE("createdAt") as day, SUM(amount) as revenue
FROM "orders"
WHERE status IN ('COMPLETED', 'PARTIAL')
AND "createdAt" > NOW() - INTERVAL '30 days'
GROUP BY day ORDER BY day DESC;
```

---

## Notes

- All IDs use Prisma's `cuid()` generator.
- DateTime fields use UTC.
- Decimal fields use Prisma's `Decimal` type (arbitrary precision, important for financial data).
- The schema is defined in `prisma/schema.prisma`. Run `npx prisma generate` after changes.
- This reference documents the logical schema. Check `schema.prisma` for the authoritative source.
