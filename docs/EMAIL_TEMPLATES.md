# Email Templates Reference

> All transactional emails are sent via **Brevo** (formerly Sendinblue).
> Sender: `noreply@thenitro.ng` / "Nitro"

---

## Overview

| # | Email | Trigger | Recipient | Priority |
|---|-------|---------|-----------|----------|
| 1 | Email Verification | User signs up | New user | Critical |
| 2 | Password Reset | User clicks "Forgot Password" | User | Critical |
| 3 | Welcome | User verifies email | New user | Normal |
| 4 | Wallet Funded | Paystack webhook confirms deposit | User | Normal |
| 5 | Order Placed | Order submitted to provider | User | Normal |
| 6 | Order Completed | Provider confirms full delivery | User | Normal |
| 7 | Order Partial | Provider reports partial delivery | User | Normal |
| 8 | Order Cancelled | Provider rejects/fails order | User | Normal |
| 9 | Refund Issued | Wallet refund processed | User | Normal |
| 10 | Referral Bonus | Referred user makes first purchase | Referrer | Normal |
| 11 | Admin: New Ticket | User creates support ticket | Admin team | Normal |
| 12 | Admin: Order Alert | Mass order failures or provider issue | Superadmin | High |

---

## Email Details

### 1. Email Verification

**Trigger:** User completes the signup form.

**Subject:** Your Nitro verification code

**Variables:**
- `{{displayName}}` — User's chosen display name
- `{{verificationCode}}` — 6-digit numeric code

**Content summary:**
- Greeting with display name
- The 6-digit code, prominently displayed
- "This code expires in 15 minutes"
- Instruction to enter the code on the verification page
- "If you didn't create a Nitro account, ignore this email"

**Notes:**
- Code expires after 15 minutes
- Users can request a new code (rate-limited)
- Check spam reminder should be in the signup UI, not the email itself

---

### 2. Password Reset

**Trigger:** User clicks "Forgot Password" and submits their email.

**Subject:** Reset your Nitro password

**Variables:**
- `{{displayName}}` — User's display name
- `{{resetLink}}` — Time-limited URL to the password reset page

**Content summary:**
- Greeting with display name
- "We received a request to reset your password"
- CTA button: "Reset Password" → {{resetLink}}
- "This link expires in 1 hour"
- "If you didn't request this, ignore this email. Your password won't change."

**Notes:**
- Link expires after 1 hour
- Contains a signed token — do not log the full URL
- Only one active reset link at a time (requesting a new one invalidates the old)

---

### 3. Welcome

**Trigger:** User successfully verifies their email.

**Subject:** Welcome to Nitro 🚀

**Variables:**
- `{{displayName}}` — User's display name

**Content summary:**
- Welcome message
- Quick-start steps: fund wallet → browse services → place first order
- Link to the dashboard
- Link to the support page
- Social handles (@Nitro.ng, @TheNitroNG)

---

### 4. Wallet Funded

**Trigger:** Paystack webhook confirms a successful deposit.

**Subject:** Wallet funded — ₦{{amount}} added

**Variables:**
- `{{displayName}}` — User's display name
- `{{amount}}` — Amount deposited (formatted with ₦)
- `{{newBalance}}` — Updated wallet balance (formatted with ₦)
- `{{reference}}` — Paystack transaction reference

**Content summary:**
- Confirmation that funds were added
- Amount and new balance
- Transaction reference for records
- CTA: "Browse Services" → link to services page

---

### 5. Order Placed

**Trigger:** Order successfully submitted to the provider.

**Subject:** Order #{{orderId}} placed

**Variables:**
- `{{displayName}}` — User's display name
- `{{orderId}}` — Nitro order ID
- `{{serviceName}}` — Service group name + tier (e.g., "Instagram Followers — Standard")
- `{{quantity}}` — Units ordered
- `{{amount}}` — Amount charged (₦)
- `{{targetLink}}` — The target URL/username

**Content summary:**
- Confirmation with order details
- "We'll notify you when delivery is complete"
- CTA: "Track Order" → link to order detail page

---

### 6. Order Completed

**Trigger:** Provider status returns Completed.

**Subject:** Order #{{orderId}} delivered ✅

**Variables:**
- `{{displayName}}` — User's display name
- `{{orderId}}` — Nitro order ID
- `{{serviceName}}` — Service name + tier
- `{{quantity}}` — Units delivered

**Content summary:**
- "Your order has been fully delivered"
- Summary of what was delivered
- CTA: "Place another order" → services page

---

### 7. Order Partial

**Trigger:** Provider status returns Partial.

**Subject:** Order #{{orderId}} — partial delivery

**Variables:**
- `{{displayName}}` — User's display name
- `{{orderId}}` — Nitro order ID
- `{{serviceName}}` — Service name + tier
- `{{delivered}}` — Units actually delivered
- `{{ordered}}` — Units originally ordered
- `{{refundAmount}}` — Amount refunded to wallet (₦)

**Content summary:**
- "Your order was partially delivered"
- Breakdown: ordered vs delivered
- "₦{{refundAmount}} has been refunded to your wallet for the undelivered portion"
- CTA: "View order" → order detail page
- "Contact support if you have questions"

---

### 8. Order Cancelled

**Trigger:** Provider status returns Canceled or order fails before delivery.

**Subject:** Order #{{orderId}} cancelled — full refund issued

**Variables:**
- `{{displayName}}` — User's display name
- `{{orderId}}` — Nitro order ID
- `{{serviceName}}` — Service name + tier
- `{{refundAmount}}` — Amount refunded (₦)

**Content summary:**
- "Your order could not be fulfilled"
- "₦{{refundAmount}} has been refunded to your wallet"
- Apologise briefly
- CTA: "Try again" → services page
- "Contact support if this keeps happening"

---

### 9. Refund Issued

**Trigger:** Manual refund processed by an admin.

**Subject:** Refund of ₦{{amount}} issued

**Variables:**
- `{{displayName}}` — User's display name
- `{{amount}}` — Refund amount (₦)
- `{{newBalance}}` — Updated wallet balance (₦)
- `{{reason}}` — Refund reason (set by admin)

**Content summary:**
- Confirmation of refund
- Amount and new balance
- Reason (if provided)
- CTA: "View wallet" → wallet page

---

### 10. Referral Bonus

**Trigger:** A referred user makes their first purchase.

**Subject:** You earned a referral bonus! 🎉

**Variables:**
- `{{displayName}}` — Referrer's display name
- `{{bonusAmount}}` — Bonus credited (₦)
- `{{newBalance}}` — Updated wallet balance (₦)
- `{{referredName}}` — Display name of the referred user (first name only for privacy)

**Content summary:**
- "Someone you referred just made their first purchase"
- Bonus amount and new balance
- "Keep sharing your referral link to earn more"
- CTA: "View referrals" → referrals page

---

### 11. Admin: New Ticket

**Trigger:** User creates a support ticket or Nitro Bot escalates to live agent.

**Subject:** [Support] New ticket: {{subject}}

**Variables:**
- `{{subject}}` — Ticket subject
- `{{userName}}` — User who created the ticket
- `{{ticketId}}` — Ticket ID

**Recipient:** Admin notification email (admin@thenitro.ng or configured admin emails)

**Content summary:**
- New ticket notification
- User name, subject, ticket ID
- CTA: "Open ticket" → admin ticket detail page

**Notes:** This is an internal notification, not user-facing.

---

### 12. Admin: Order Alert

**Trigger:** Manually triggered or automated when mass order failures are detected.

**Subject:** [ALERT] Order failures detected

**Variables:**
- `{{failureCount}}` — Number of failed orders
- `{{timeWindow}}` — Time period of failures
- `{{affectedServices}}` — Services affected (if identifiable)

**Recipient:** Superadmin (admin@thenitro.ng)

**Content summary:**
- Alert that order failures have spiked
- Count and time window
- Affected services
- "Check provider API status and the Incident Playbook"

---

## Template Guidelines

- **Subject lines** should be concise and include key info (order ID, amount) upfront.
- **Always use ₦** for currency, never USD or NGN.
- **CTAs** should link directly to the relevant page in the user's dashboard.
- **Tone:** Direct, helpful, no corporate fluff. Match the Nitro brand voice.
- **Footer** on all emails: "Nitro — nitro.ng | @TheNitroNG | TheNitroNG@gmail.com"
- **Unsubscribe:** Transactional emails (verification, orders, refunds) don't need unsubscribe. Promotional emails do.

---

## Brevo Configuration

- **API key:** Stored in `BREVO_API_KEY` env var
- **Sender email:** `noreply@thenitro.ng`
- **Sender name:** Nitro
- **Templates:** Managed in the Brevo dashboard (app.brevo.com) or sent programmatically via the API with inline HTML
- **Rate limits:** Check your Brevo plan for daily sending limits. Free tier has a 300/day limit.

---

## Testing

When testing email flows:
- Use a real email address you control (not a disposable service — they often block transactional emails)
- Verify emails arrive in inbox, not spam
- Check that all variables are populated correctly
- Test on both mobile and desktop email clients
- Verify links point to the correct pages (especially after domain or route changes)
