# Ify Actions Spec

**Status:** Parked — do not build until Trip gives explicit go-ahead
**Depends on:** Ify v1 (FAQ + outreach) running stable in production
**Owner:** Adonai (Trip)
**Created:** July 2026

---

## What this is

Ify v1 is FAQ-only — she answers general questions and escalates everything else to a human. This spec covers the next phase: giving Ify the ability to take real actions on a user's account via WhatsApp.

No new APIs, no new payment flows. Every action below is a conversational wrapper around existing backend functions.

---

## Phone → User Identity

### Primary number (on Nitro account)
- Permanent access, never expires, never gets wiped.
- Matched via the `phone` field on the `users` table.

### Secondary number
- Max **1** at a time per user.
- Expires after **7 days** — user must re-verify to renew.
- Linking a new secondary **replaces** the old one (not additive).
- Stored as two fields on the user: `secondaryPhone`, `secondaryPhoneExpiresAt`.

### Unknown/unverified numbers
- FAQ-only mode. No account actions.
- Ify offers to verify: "What email did you sign up with?"
- Lookup email → send OTP to that email → user reads it back → phone linked as secondary.

### Rules
- Primary number: full access, permanent.
- Secondary number: full access, 7-day TTL, max 1.
- Unverified number: FAQ only, can initiate verification.

---

## Actions (in build order)

### 1. check_balance
**Trigger:** "What's my balance?" / "How much do I have?"
**Logic:** Query `users.balance` by userId. Return formatted Naira amount.
**Risk:** None (read-only).

### 2. check_order
**Trigger:** "Where's my order?" / "Check order #XYZ" / "My last order"
**Logic:** Query `orders` table by userId, optionally by order ID. Return status, quantity delivered vs ordered, service name.
**Edge case:** User says "my order" with multiple recent orders → list the last 3, ask which one.
**Risk:** None (read-only).

### 3. check_payment
**Trigger:** "I just paid" / "Did my deposit go through?" / "I transferred ₦5,000"
**Logic:** Query recent `transactions` (type=deposit) by userId.
- Completed in last 30 min → "₦X landed, balance is now ₦Y"
- Pending → "I see it, it's being processed"
- Not found → "I don't see a payment yet. Did you use card, crypto, or bank transfer?"
**Manual transfers:** Always escalate. "I see your pending transfer, a team member will confirm it shortly." Ify cannot verify manual bank transfers — that always requires a human.
**Risk:** None (read-only).

### 4. request_refill
**Trigger:** "My followers dropped" / "Can I get a refill on order #XYZ?"
**Logic:** Look up the order → check if `refill` is true on the service tier → call the provider API refill endpoint (same as admin refill button).
**Confirmation:** "I'll request a refill on your order for [service]. This is free. Go ahead?" → wait for "yes".
**Edge case:** Order doesn't have refill → "This service doesn't include free refill. Want me to connect you with support?"
**Risk:** Low (free operation, no money moves).

### 5. place_order
**Trigger:** "I want to order" / "Get me 1000 Instagram followers"
**Logic:** Multi-step conversation:
1. Which platform? (skip if already stated)
2. Which service? (show available options with prices)
3. Paste your link
4. Choose tier + quantity
5. Confirm: "1,000 IG Followers (Standard) for ₦X from your wallet (balance: ₦Y). Confirm?"
6. User says "yes" → deduct wallet → place via DAO/MTP API
**Confirmation required:** Always. No silent charges. Ify summarizes the full order and waits for explicit "yes" before executing.
**Insufficient balance:** "You need ₦X but your balance is ₦Y. Want to add funds first?" → link to deposit page.
**Risk:** High (money moves). This is the last action to build. Get 1–4 stable first.

---

## Design Principles

### Confirmation before money moves
Any action that touches the wallet requires an explicit "yes" after a clear summary. No shortcuts, no assumed consent.

### Escalation over guessing
If Ify is unsure about anything account-specific, she escalates. Wrong information about someone's money is worse than a slow human response.

### Manual transfers are always human
No exceptions. Ify cannot confirm bank transfers — she can acknowledge the pending state and escalate.

### Action handlers are small
Each action is a single file in `lib/ify/actions/` that imports from existing libs (`lib/prisma.js`, `lib/smm-api.js`, etc.). No new APIs needed.

---

## Infrastructure Needed

- Two new columns on `users`: `secondaryPhone` (String?), `secondaryPhoneExpiresAt` (DateTime?)
- OTP generation + email send for phone verification (reuse existing email infra)
- New `action` values in the brain's action list (one per capability above)
- Handler files in `lib/ify/actions/` — one per action

---

## What this does NOT cover

- In-app chat widget (support is WhatsApp-only)
- Payment processing changes (existing flows stay as-is)
- Admin-side Ify management UI (not needed yet)
- Productizing Ify for other panel owners (see Octane plan in V2_ROADMAP.md)
