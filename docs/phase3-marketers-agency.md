# Marketers & Agency Panel — Phase 3 Planning

**Domain:** marketers.nitro.ng  
**Status:** Phase 3 (post-launch)  
**Last updated:** April 2026

---

## Overview

Two distinct roles share the same panel at `marketers.nitro.ng`, with different feature sets unlocked based on tier:

1. **Marketer** — Outbound sales reps who find and recruit new Nitro customers
2. **Agency/Reseller** — Businesses that buy services at wholesale to resell to their own clients

---

## Role 1: Marketer (Outbound Sales)

### What they do
- Cold DMs, emails, pitch to influencers, musicians, artists, brands, crypto lords
- Tell prospects to sign up on Nitro
- Earn recurring commission on every order their recruited clients place
- Can also resell services at discounted rates

### Panel features

**My Clients**
- List of users they've recruited (linked via unique marketer signup URL)
- Each client shows: name, signup date, total lifetime spend, last order date
- Sort/filter by spend, activity, signup date

**Earnings Dashboard**
- Ongoing % commission on client orders (e.g. 5-10%, configurable per marketer)
- Different from referral system: referrals = one-time bonus, marketer = recurring commission forever
- Breakdown: this month, last month, all time
- Per-client earnings breakdown

**Payouts**
- Withdraw commissions to bank account or keep as Nitro wallet credit
- Minimum payout threshold (e.g. ₦10,000)
- Payout history with status tracking

**Outreach Tools**
- Custom signup URL: `nitro.ng/ref/marketer-code`
- Trackable links with UTM parameters
- Landing page templates they can customize and share
- QR code generator for their signup link
- Pre-written DM/email templates for different niches (musicians, brands, influencers)

**Performance Analytics**
- Conversion rate (link clicks → signups → first order)
- Top clients by spend
- Monthly trends (new signups, total client spend, commission earned)
- Leaderboard ranking vs other marketers

**Reseller Access**
- Can also place orders at discounted wholesale rates
- Acts as both recruiter and reseller

### Commission structure (suggested)
| Monthly client volume | Commission rate |
|----------------------|----------------|
| ₦0 – ₦100K         | 5%             |
| ₦100K – ₦500K      | 7%             |
| ₦500K – ₦1M        | 8%             |
| ₦1M+               | 10%            |

---

## Role 2: Agency/Reseller (Child Panel)

### What they do
- Buy Nitro services at wholesale prices
- Resell to their own clients at their own markup
- Manage multiple client accounts from one dashboard

### Panel features

**Multi-Client Management**
- Create client profiles within their panel
- Tag orders by client name
- Per-client order history and spend tracking
- "Client A: 5 orders this month, ₦45K spent"

**Bulk Ordering**
- Place 10+ orders at once for different links/accounts
- CSV upload: link, service, quantity per row
- Batch status tracking

**Wholesale Pricing**
- Tiered discounts based on monthly volume
- Lower prices than retail users
- Custom pricing agreements for high-volume agencies

| Monthly spend    | Discount off retail |
|-----------------|-------------------|
| ₦0 – ₦200K     | 10%               |
| ₦200K – ₦1M    | 15%               |
| ₦1M – ₦5M      | 20%               |
| ₦5M+           | Custom            |

**Profit Tracking**
- Dashboard shows: what they charge clients vs what they pay Nitro
- Profit margin per client, per service
- Monthly P&L overview

**White-Label Reports**
- Generate branded PDF reports for clients
- Shows "services delivered" without mentioning Nitro
- Customizable logo, company name, colors
- Exportable as PDF or shareable link

**API Access (optional, later)**
- Direct API for agencies that want to integrate ordering into their own tools
- Same MTP-style API format they're used to

---

## Architecture

### Unified codebase
- Same Next.js app, same database, same backend
- `marketers.nitro.ng` subdomain handled via Next.js middleware
- Routes to a different layout component (like admin panel)
- No separate deployment

### User model changes
```
User {
  ...existing fields
  role        String   @default("user")  // "user" | "marketer" | "agency" | "admin"
  marketerId  String?  // links recruited users to their marketer
  commissionRate Float? // marketer's commission percentage
  wholesaleDiscount Float? // agency's discount percentage
}
```

### New models needed
```
MarketingCommission {
  id          String
  marketerId  String   // the marketer who earns
  clientId    String   // the user who placed the order
  orderId     String   // the order that triggered commission
  amount      Int      // commission amount in kobo
  status      String   // "pending" | "paid"
  createdAt   DateTime
}

MarketingPayout {
  id          String
  marketerId  String
  amount      Int
  method      String   // "bank" | "wallet"
  status      String   // "pending" | "processing" | "completed"
  bankDetails Json?
  createdAt   DateTime
}

AgencyClient {
  id          String
  agencyId    String   // the agency user
  name        String
  label       String?  // custom tag
  createdAt   DateTime
}
```

### Middleware routing
```javascript
// middleware.js addition
if (hostname === 'marketers.nitro.ng') {
  // Check if user has marketer/agency role
  // Route to /marketer-dashboard layout
}
```

---

## Admin controls

### Marketer management (admin panel)
- Approve/reject marketer applications
- Set commission rate per marketer
- View all marketers with their client counts and earnings
- Adjust commission rates
- Process payout requests

### Agency management
- Set wholesale discount per agency
- Monitor order volumes
- Flag suspicious activity (e.g. self-referral abuse)

---

## Rollout plan

### Phase 3a: Marketer MVP
1. Marketer role + signup flow
2. Custom referral link with marketer tracking
3. Recurring commission calculation (cron job)
4. Basic marketer dashboard: clients, earnings, link
5. Admin: approve marketers, set rates

### Phase 3b: Agency features
1. Agency role + wholesale pricing
2. Multi-client management
3. Bulk ordering
4. Profit tracking dashboard

### Phase 3c: Advanced
1. Payout system (bank transfers)
2. White-label reports
3. Outreach templates
4. API access for agencies
5. Marketer leaderboard

---

## Revenue impact

- **Marketers** = free sales team. They only cost commission (5-10%), which comes from orders that wouldn't exist without them
- **Agencies** = high-volume recurring revenue. Lower margin per order but significantly higher volume
- **Both** drive organic growth without ad spend

---

## Dependencies

- Custom domain active (nitro.ng)
- Middleware subdomain routing (already proven with admin.nitro.ng pattern)
- Bank payout integration (Flutterwave payouts API or manual)
- Cron job infrastructure for commission calculation (Railway workers)

---

## Notes

- Marketer ≠ referral. Referrals are one-time bonuses for casual users. Marketers are structured sales partners with recurring commissions.
- Both roles can coexist: a marketer who recruits enough volume can upgrade to agency tier for wholesale pricing.
- Anti-abuse: marketers cannot recruit themselves or existing users. Commission only on genuinely new signups that place orders.

---

## Also Deferred to Phase 3

### API Management Page
- Admin API page with test/sync for all providers (MTP, JAP, DaoSMM)
- Multi-provider routing (JAP for Audiomack/Boomplay/Apple Music/WhatsApp, DaoSMM for Nigerian-specific)
- Test + Sync buttons for each provider (currently only MTP has them)
- Fix env var naming: DAOSMM_API_KEY, JAP_API_KEY
- Provider URLs: JAP = justanotherpanel.com/api/v2, DaoSMM = daosmm.com/api/v2
