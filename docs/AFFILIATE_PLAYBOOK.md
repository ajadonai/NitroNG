# Nitro — Affiliate Operations Playbook v2.0

> **NITRO.NG** · Affiliate Operations Playbook
> Cold outreach • Team hierarchy • Commission system
> Version 2.0 · May 2026 · Confidential Internal Document — Do Not Distribute

> **Note for Claude Code:** This is the source-of-truth spec for the affiliate operations system. It defines the business model (team hierarchy, commission split, fraud rules) and the full engineering integration checklist (Appendix A). Build only what is approved — use the Implementation Roadmap (§12) and Appendix A as the build order.

---

## 0. Locked-In Decisions (June 2026)

All blockers resolved. These decisions override anything contradictory elsewhere in this doc.

| # | Decision |
|---|---|
| 1 | Naming: roles are **Crew Chief** (team lead) and **Pit Crew** (affiliate). Prisma model: `CrewMember`. Internal tables (`AffiliateCommission`, `AcquisitionLink`, `?via=` slugs) unchanged. |
| 2 | Agency/Reseller is OUT of scope — this is affiliate marketing only |
| 3 | "Active referred user" = placed at least 1 completed order in the last 30 days |
| 4 | Tiers recalculate daily via cron (30-day rolling window). Tiers go up AND down |
| 5 | Partial orders: commission proportional to delivered amount only |
| 6 | Drip orders: commission fires when parent order hits Completed (final figures) |
| 7 | No commission on bonus credit (welcome bonus, coupon bonus) — real ₦ only |
| 8 | Payout v1 is manual bank transfer. Auto-payout UI exists but labeled "Coming soon" |
| 9 | Crew Chief signup collects: full name, email, phone (WhatsApp), X handle, "why?", bank details |
| 10 | Affiliate invite collects: full name, email, phone, X handle, bank details |
| 11 | `?via=` links coexist: admin links (no `affiliateId`) never generate commission |
| 12 | Self-referral fraud check uses email + IP + device fingerprint (not email-only) |
| 13 | Dashboard data cached (5-min refresh). Commission emails batched as daily digest |
| 14 | X Premium renewal stays manual — affiliates remind admin |
| 15 | 4 display types (desktop/tablet/mobile/small) for all portal pages |
| 16 | Referral system coexists: user can have both `referredBy` (one-time bonus) and `signupSource` (ongoing affiliate commission) |

---

## 1. Overview

Nitro is a social media growth and engagement service. This playbook covers the full affiliate operations system: how we structure the team, find leads, run outreach, attribute sales, and pay commissions.

Version 2.0 replaces the flat "admin + workers" model with a real three-tier hierarchy and a dedicated affiliate portal at `nitro.ng/m/`, separate from the user-facing site.

### Core Model

Identify accounts that would benefit from follower and engagement growth, reach out by cold DM on X (Twitter) and Instagram, convert them to paying customers on nitro.ng — then keep earning commission on every order they place, forever.

### Target Segments

- **Businesses & Brands** — small-to-mid businesses selling products/services online
- **Crypto & Web3** — token projects, NFT creators, Web3 builders
- **Skit Makers & Comedians** — content creators in the 1k–50k range
- **Influencers** — lifestyle, fashion, food, niche creators
- **Musicians & Artists** — acts promoting releases on Audiomack, Spotify, Boomplay

---

## 2. Team Hierarchy

Nitro operates a strict three-tier marketing organization. Each tier has its own permissions, its own view, and its own portal access.

| Tier | Who | What they do |
| --- | --- | --- |
| **Super Admin** | Trip (founder) | Approves Crew Chiefs, sets commission rates, processes payouts, sees every team's performance side-by-side |
| **Crew Chief** | Independent operators approved by Trip | Create and assign tracking links, invite and manage their own Pit Crew members, see their team's full performance, request their own payouts |
| **Pit Crew** | Recruited and managed by a Crew Chief | Use the link assigned to them, run outreach, see only their own stats, request their own payouts |

### Org Chart

```
Super Admin (Trip) — existing admin panel
├── Crew Chief A (/m/ portal)
│   ├── Pit Crew 1
│   ├── Pit Crew 2
│   └── Pit Crew 3
├── Crew Chief B (/m/ portal)
│   ├── Pit Crew 4
│   └── Pit Crew 5
└── Crew Chief C (/m/ portal)
    └── Pit Crew 6
```

> **Key rule:** Pit Crew members cannot create tracking links. Only Crew Chiefs can. Pit Crew members use the link their lead assigns them.

### Responsibilities

**Super Admin (Trip)**

- Approve / suspend Crew Chiefs
- Configure global commission rates, tier thresholds, hold period, minimum payout
- Review payout requests and process bank transfers
- Monitor every team's performance side-by-side
- Review fraud flags (self-referral, IP clusters, refund clawbacks)

**Crew Chief**

- Recruit, vet and onboard Pit Crew members
- Create tracking links (up to the per-lead cap)
- Assign each link to a specific Pit Crew member (or keep one for self)
- Monitor team output — DMs sent, signups, conversions, revenue
- Hold Pit Crew members accountable to daily targets
- Pay their own workers/Pit Crew members out of their commission — Nitro does not manage this

**Pit Crew**

- Run outreach using the link assigned by their lead
- Hit daily DM targets
- Submit daily reports to their lead
- Track own earnings in the /m/ portal
- Request payouts when above the minimum threshold

---

## 3. Affiliate Portal Architecture

The affiliate portal lives at `nitro.ng/m/`. It is a separate auth domain — like the admin panel is separate from the user-facing site. Pit Crew members have their own accounts, login, and dashboard. They share the same database with the user side for attribution and commission tracking but never touch user-facing screens.

### Attribution Flow

1. Crew Chief creates a tracking link → stored as an `AcquisitionLink` with `affiliateId` set
2. Prospect signs up via `nitro.ng/?via=slug` → `user.signupSource = slug`
3. When the user's order is marked **Completed** by the order cron, the system looks up `signupSource`, finds the link, finds the assigned Pit Crew member
4. A `AffiliateCommission` row is created in **held** status with a 7-day release timer
5. After 7 days with no refund, status flips to **approved** and becomes payable

### Portal Routes

| Route | Purpose |
| --- | --- |
| `/m/login` | Login + Crew Chief signup (signup only enabled if `affiliate_enabled = true`) |
| `/m/` | Dashboard — stats, tier progress, recent activity |
| `/m/links` | Tracking links (Crew Chief only — create, assign, enable/disable) |
| `/m/team` | Crew Chief only — invite Pit Crew members, view team performance |
| `/m/commissions` | Full commission history with status filters |
| `/m/payouts` | Request payout + payout history |
| `/m/settings` | Bank details, password |

### What Each Portal Shows

**Crew Chief view**

- Team table: each Pit Crew member's signups, orders, commission, status
- Links management: create, assign to a team member or self, enable/disable
- Team totals + per-Pit Crew member breakdown
- Own commission + payout requests

**Pit Crew view**

- Own stats only (signups, orders, commission)
- Assigned link(s) — read-only, copy button
- Own payout history and requests

**Super Admin view (existing admin panel)**

- All Crew Chiefs in one table — status, team size, total earned, available balance
- Drill into any team to see its Pit Crew members and commission breakdown
- Payout queue across all teams
- Commission rates, thresholds, hold period, on/off toggle
- Fraud flags (self-referral, IP cluster, refund clawback)

---

## 4. Commission & Tiers

Commission is paid on **every completed order** from a referred user, **forever** — not just the first one. This is what makes the model worth scaling: a Crew Chief's book of business compounds.

### Commission Tiers

These rates are the **total commission pot** for each completed order — Nitro keeps the rest. The pot is then split between the Crew Chief and the Pit Crew (see next section).

| Tier | Threshold (active referred users) | Total pot | Example: customer spends ₦10,000 |
| --- | --- | --- | --- |
| **Starter** | 0–29 | 5% | Pot = ₦500 |
| **Growth** | 30–99 | 7% | Pot = ₦700 |
| **Pro** | 100+ | 10% | Pot = ₦1,000 |

> Tier promotion is automatic. On each new commission the system counts the Pit Crew member's distinct active referred users; if the count crosses a threshold, tier and rate update. Future commissions use the new rate.

### Commission Split (Lead ↔ Pit Crew)

Trip controls every layer of the split from admin settings. The Crew Chief does not get to change it — this locks the maths in place so payouts are always deterministic.

| Setting | Default | Meaning |
| --- | --- | --- |
| Total commission % | 5 / 7 / 10 | Tier-based, set per tier |
| Crew Chief's cut of pot | 40% | Lead's slice of whatever the pot is |
| Pit Crew's cut of pot | 60% | Remainder of the pot, derived automatically |

**Formulas:**

```
leadAmount     = orderCharge × commissionRate × leadSplit / 10000
marketerAmount = orderCharge × commissionRate × (100 − leadSplit) / 10000
```

**Worked Example**

| Bucket | Calculation |
| --- | --- |
| Order total | ₦10,000 |
| Nitro keeps (90%) | ₦9,000 |
| Total commission pot (10%, Pro tier) | ₦1,000 |
| Crew Chief (40% of pot) | ₦400 |
| Pit Crew (60% of pot) | ₦600 |

> If a Crew Chief runs a link themselves with no Pit Crew member assigned, they receive the full 100% of the pot. The split only kicks in when a link is attributed to one of the lead's Pit Crew members.

**Frozen at Creation**

Both `leadAmount` and `marketerAmount` are written into the commission row at the moment it's created. Changing tier rates or split percentages later does **not** retroactively rewrite historical commissions — past payouts stay deterministic.

### Operating Numbers

| Setting | Default |
| --- | --- |
| Hold period before a commission becomes payable | 7 days |
| Minimum order value to earn commission | ₦1,000 |
| Minimum payout request | ₦5,000 |
| Max tracking links per Crew Chief | 5 |
| Growth-tier threshold | 30 active referred users |
| Pro-tier threshold | 100 active referred users |
| Crew Chief split of the pot | 40% |
| Pit Crew split of the pot | 60% (derived) |
| X Premium cost per Pit Crew member (paid by Nitro) | ~₦5,500 / month |

### Unit Economics

Nitro's average gross margin is ~46% over provider cost. On a ₦10,000 order Nitro keeps ~₦3,150 gross margin. Paying out a 5–10% commission pot leaves ₦2,150–₦2,650 in margin — still healthy.

Pit Crew members cost ₦0 in commission until they produce revenue. The one fixed cost Nitro carries is X Premium per active Pit Crew member.

### Per-Member Breakeven (X Premium)

Because Nitro pays X Premium for every active Pit Crew member, each Pit Crew member needs to generate enough attributed revenue to cover that fixed cost before they become net-positive for Nitro.

| Tier | Pot rate | Attributed revenue needed to cover ₦5,500/mo Premium |
| --- | --- | --- |
| Starter | 5% | ₦110,000 / month |
| Growth | 7% | ₦78,500 / month |
| Pro | 10% | ₦55,000 / month |

> Use this as the threshold for keeping a Pit Crew member's Premium active. If they stay below breakeven for two consecutive months, pause the subscription and reassign their link.

### Projected Earnings (with 40/60 split)

| Scenario (Growth tier, 7% pot) | Crew Chief (40%) | Pit Crew (60%) |
| --- | --- | --- |
| 50 referred users × ₦15k/mo = ₦750k attributed | ₦21,000 | ₦31,500 |
| 100 referred users × ₦15k/mo = ₦1.5M attributed | ₦42,000 | ₦63,000 |
| Pro tier, 200 referred × ₦15k = ₦3M attributed (10% pot) | ₦120,000 | ₦180,000 |

### Worker Pay Model

Workers — the people running the DMs on a Pit Crew member's behalf — are paid by the Pit Crew member (or by the Crew Chief, if the lead is operating directly), out of their share of the pot. Nitro does not manage that relationship.

Suggested anchor: **₦200–₦500 per converted signup**. The /m/ portal only ever shows each individual their own slice; whatever they hand to a worker is off-book.

---

## 5. Attribution, Holds & Fraud Prevention

Attribution is automatic via tracking links. Every sale is traceable to a Pit Crew member, a campaign, and a platform.

### Tracking Link Format

```
nitro.ng/?via=affiliate-slug
```

Crew Chiefs create campaign-specific variants:

```
nitro.ng/?via=ig-business-owners
nitro.ng/?via=tiktok-dms
nitro.ng/?via=x-crypto-march
```

Zero-friction (no promo code entry), automatic tracking, and per-link analytics for every campaign.

### Fraud Prevention Rules

| Check | When | How |
| --- | --- | --- |
| Self-referral | Commission creation | Skip if ordering user's email matches the Pit Crew member's email |
| Same-IP cluster | Admin dashboard flag | >5 signups from same /24 IP range via same Pit Crew member in 24h |
| Tiny orders | Commission creation | Skip if order < ₦1,000 (the configured minimum) |
| Hold period | Always | 7-day hold before any commission becomes payable |
| Refund clawback | Order cancel/refund | Auto-void commission for cancelled orders |
| Admin override | Anytime | Trip can void any held or approved commission |

---

## 6. Platform Strategy

| Platform | Cold DM Possible? | Priority |
| --- | --- | --- |
| **X (Twitter)** | Yes — Premium accounts can DM anyone | HIGH |
| **Instagram** | Limited — goes to message requests folder | MEDIUM |
| **TikTok** | No — requires mutual follow. Use as lead source only | LOW (source only) |

**X (Twitter) — Primary**

- X Premium accounts can DM any user regardless of follow status
- Lower spam-flag risk on premium accounts
- Higher DM delivery and open rates than Instagram
- Target: 50–80 DMs per account per day

**Instagram — Secondary**

- Cold DMs go to the message-requests folder — lower open rate
- Like + comment on target's posts 24–48hrs before DMing to warm up
- Use ManyChat for comment-to-DM automation
- Keep volume under 50 DMs/day per account to avoid throttling

**TikTok — Lead Source Only**

- TikTok restricts DMs to mutual followers — do not use for cold outreach
- Use TikTok to identify creators and skit makers, then find their X or IG handle
- Apify TikTok Scraper pulls profiles + linked handles from hashtag searches

---

## 7. Lead Finding & Targeting

### X (Twitter) Search Queries

| Segment | Keywords |
| --- | --- |
| Businesses | "DM to order" "buy now" "shop now" "we sell" "new business" |
| Crypto | "web3" "NFT" "gem alert" "token" "crypto Nigeria" "100x" |
| Skit Makers | "comedian" "skit maker" "content creator" Nigeria |
| Influencers | "collab" "PR" "influencer" "brand ambassador" |
| Musicians | "new music" "streaming now" "Audiomack" "out now" "new single" |

### Instagram Hashtags

| Segment | Hashtags |
| --- | --- |
| Businesses | #nigeriansmallbusiness #lagosvendor #abujavendor #shopnaija |
| Crypto | #cryptonigeria #web3africa #nftafrica |
| Skit Makers | #naijaskit #nigeriancomedian #skitmaker |
| Influencers | #nigeriainfluencer #lagosinfluencer |
| Musicians | #naijamusicartist #afrobeats #nigerianartist |

### Qualification Filter

| Filter | Criteria | Action |
| --- | --- | --- |
| Follower count | 500 – 100,000 | Keep |
| Activity | Active in last 30 days | Keep |
| Engagement rate | Low relative to follower count | Keep — they need us |
| Account type | Business / creator / brand identity | Keep |
| Follower count | Over 500k | Remove |
| Account type | Private / personal with no brand | Remove |
| Engagement rate | Already high | Remove — doesn't need us |

### Automation Tools

- **Phantombuster** — scrape followers of competitor accounts on X and IG hashtag scraping
- **Apify** — keyword/hashtag scraping across X, IG, TikTok
- **TweetHunter** — keyword search + filter by follower count
- **IGLeads.io** — IG hashtag and competitor-follower scraping

---

## 8. DM Scripts by Segment

All scripts follow the same structure: **Hook + Relevance + Soft CTA**. Never open with a direct pitch. Ask a question or make an observation first.

**Businesses & Brands**

> Hey [Name], love what you're building with [Brand]. One thing that accelerates reach fast is social proof — more followers and engagement signal credibility to new customers. We do exactly that at nitro.ng. Interested in a quick breakdown?

**Crypto & Web3**

> Ser, a strong project needs a strong presence. If your X following and engagement don't match your vision, we can fix that fast. Check nitro.ng — we help Web3 accounts grow their numbers quickly.

**Skit Makers & Comedians**

> Your content is fire but the algorithm won't push what it doesn't see moving. We help creators like you get the numbers that make brands take notice. nitro.ng — want details?

**Influencers**

> Hey [Name]! Brands look at follower count AND engagement rate before collab decisions. We help influencers hit those numbers fast. Would love to share how nitro.ng can help you land bigger deals.

**Musicians & Artists**

> Your sound deserves more ears. A lot of A&Rs and playlist curators look at your socials before anything else. We help artists build that presence fast — nitro.ng. Want to know more?

### Follow-Up Sequence

| Touch | Timing | Message style |
| --- | --- | --- |
| DM 1 (Opener) | Day 0 | Hook + relevance + soft CTA |
| DM 2 (Follow-up) | Day 2 — no reply | Add value — stat, case study, or new angle |
| DM 3 (Final) | Day 5 — still no reply | Short, low-pressure close or walk away |

---

## 9. Account Setup & Safety

### Worker Account Bios

Accounts should not look like sales bots. Suggested bio styles:

- "Helping brands and creators grow their digital presence | Growth strategist | nitro.ng"
- "Social growth consultant | I help businesses get the numbers that open doors"
- "Digital growth partner | Connecting great content to bigger audiences | nitro.ng"

### X Premium — Nitro Pays

X Premium is a Nitro expense, not a Pit Crew member expense. Every active Pit Crew member runs on a Premium account because that's what unlocks the DM volume the system depends on (DM anyone without a follow, higher daily caps, fewer throttles, checkmark credibility).

**Two Ownership Modes**

| Mode | How it works |
| --- | --- |
| **Nitro-owned account** | Nitro buys + holds the X account. Pit Crew logs in to operate it. If they leave, Nitro keeps the account and reassigns. Best for new/unproven Pit Crew members. |
| **Pit Crew's personal account, Nitro-subscribed** | Pit Crew uses their own @handle; Nitro pays the Premium sub on their behalf. Less account-management overhead. Risk: if they leave we've paid the sub. Best for proven Pit Crew members/leads. |

**Tracked on the Pit Crew Record**

- `xAccountType` — "nitro-owned" | "personal"
- `xHandle` — @handle they're running
- `xPremiumPaidUntil` — when the current sub expires (drives renewal queue in admin)

> Admin panel surfaces a renewal queue — accounts whose `xPremiumPaidUntil` is within 7 days — so subs never lapse silently. If a Pit Crew member drops below breakeven for two months running, pause renewal.

### Account Hygiene

- Each Pit Crew member should have a different profile photo, bio, and posting style — accounts must not look like a sales-bot fleet
- Each operator works from their own device and IP — never share a network
- Warm up every new account for 1–2 weeks (posting, liking, retweeting) before starting DM outreach
- Stagger Premium activations — not all on the same day
- Rotate DM scripts every 2–3 weeks to avoid pattern detection

### Onboarding Checklist (Crew Chief)

Before assigning a tracking link to a Pit Crew member, the Crew Chief must confirm in the /m/ invite flow:

- [ ] X account ready (handle + login passed to ops, or personal handle confirmed)
- [ ] X Premium active — Nitro processed the sub, `xPremiumPaidUntil` set
- [ ] Account warmed up ≥ 7 days
- [ ] Bank details + payout name on file
- [ ] Has read this playbook

---

## 10. Daily Pipeline

### Per-Member Day

| Time | Activity | Target |
| --- | --- | --- |
| 9:00 AM | Check /m/ dashboard for overnight conversions | — |
| 9:30 – 12:00 | DM session 1 — warm leads + follow-ups | 30 DMs |
| 12:00 – 1:00 | Content creation (testimonials, before/after) | 1–2 posts |
| 2:00 – 5:00 | DM session 2 — new prospects | 40 DMs |
| 5:00 – 5:30 | Log day, note which links/platforms converted | — |

> Target: 70 DMs/day → 5–7 signups → 3–4 paying users → ₦30k–₦40k attributed revenue/day. At Growth tier that's ₦2,100–₦2,800/day in commission per Pit Crew member.

### Daily Reporting Sheet (to Crew Chief)

| Field | Example |
| --- | --- |
| Date | 2026-05-29 |
| Platform | X / Instagram |
| Target handle | @username |
| Target segment | Musician / Brand / Crypto |
| DM sent | Yes |
| Reply received | Yes / No |
| Lead quality | Hot / Warm / Cold |
| Outcome | Converted / Following up / Dead |

---

## 11. Tools Stack

| Tool | Purpose | Platform |
| --- | --- | --- |
| Nitro /m/ portal | Commission, links, payouts, team management | Internal |
| Phantombuster | Scrape followers, hashtags, engagers | X + IG |
| IGLeads.io | Hashtag + competitor-follower scraping | Instagram |
| Apify | Broad scraping across platforms | X + IG + TikTok |
| TweetHunter | Keyword search + outreach on X | X |
| Hootsuite Business | Multi-account team management | X + IG |
| Iconosquare | Deep per-account analytics | X + IG |
| ManyChat | Comment-to-DM automation | Instagram |
| WhatsApp | Closing warm leads who prefer messaging | Closing channel |

---

## 12. Implementation Roadmap

| # | Action item | Owner |
| --- | --- | --- |
| 1 | Ship CrewMember schema (`CrewMember`, `AffiliateCommission`, `AffiliatePayout`) + `affiliateId` on `AcquisitionLink` | Dev |
| 2 | Build /m/ auth (cookie, JWT, login, signup) mirroring admin pattern | Dev |
| 3 | Build /m/ dashboard, links, team, commissions, payouts, settings | Dev |
| 4 | Hook commission creation into order-completion cron + refund clawback | Dev |
| 5 | Add Pit Crew members page to admin panel (Crew Chief approval, payout queue, settings) | Dev |
| 6 | Approve first wave of Crew Chiefs, hand them this playbook | Trip |
| 7 | Crew Chiefs recruit and onboard their Pit Crew members | Crew Chiefs |
| 8 | Begin outreach — 50–80 DMs/day per Pit Crew member with daily reporting | Pit Crew members |
| 9 | Review first 2 weeks: which segment, platform, and script converts best | Trip |
| 10 | Scale top-performing channel — add more leads + Pit Crew members | Trip |

### Account Safety Reminders

- Never run all worker accounts on the same network or device
- Warm up accounts 1–2 weeks before starting DM outreach
- Stagger X Premium activations — not all on the same day
- Advise clients to order follower boosts in gradual batches, not sudden spikes
- Rotate DM scripts every 2–3 weeks to avoid pattern detection

---

# Appendix A — System Integration Spec

Every touchpoint where the affiliate system feeds into existing Nitro infrastructure. Use this as the engineering checklist when shipping the portal.

## A.1 · Finance · `/api/admin/financials`

Commission payouts are a new "money out" category. Add to the existing `walletObligations` block:

- `walletObligations.marketerCommissions` — sum of all paid `AffiliateCommission` amounts

Add a new **Pit Crew ROI** section to the finance response:

- `totalCommissionsPaid` — sum of paid `AffiliateCommission` (`leadAmount` + `marketerAmount`)
- `totalXPremiumCost` — active Pit Crew members × ₦5,500 (or manual tracking)
- `totalAttributedRevenue` — `order.charge` where `user.signupSource` → Pit Crew member link
- `totalAttributedProfit` — attributed revenue minus attributed provider cost
- `netROI` — `attributedProfit − commissionsPaid − xPremiumCost`
- `costPerAcquisition` — `(commissions + xPremium) / distinct referred users`

**UI:** render a new "Pit Crew Costs" card in the Wallet Obligations grid in `components/admin-pages.jsx`.

## A.2 · Admin Overview · `/api/admin/overview`

Add to the dashboard stats response:

| Field | Meaning |
| --- | --- |
| `activeLeads` | Crew Chiefs with status = approved |
| `activeMarketers` | Pit Crew members with status = approved |
| `pendingApplications` | Leads with status = pending (sidebar badge) |
| `pendingPayouts` | `AffiliatePayout` with status = pending (sidebar badge) |
| `attributedSignupsToday` | Users via Pit Crew member link created today |
| `attributedRevenueToday` | Pit Crew-attributed orders completed today |

`pendingApplications` and `pendingPayouts` surface as sidebar badge counts — same pattern as `unreadTicketCount` and `pendingManualCount`.

## A.3 · Activity Log · `logActivity`

New activity type: `affiliate`. Events to log:

- Approved Crew Chief {name}
- Suspended Crew Chief {name}
- Rejected Pit Crew application {name}
- Processed ₦X payout to {name}
- Voided commission on order {orderId}
- Updated affiliate commission rates

Add to the activity filter map in admin dashboard: `affiliates → ['affiliate']`

## A.4 · Email Notifications · `lib/email.js`

| Email | Recipient | Trigger | Template pattern |
| --- | --- | --- | --- |
| Application received | Crew Chief | Signup at /m/ | `emailWrap` — "We're reviewing your application" |
| Application approved | Crew Chief | Admin approves | `emailWrap` — "You're in! Log in to your dashboard" |
| Application rejected / suspended | Crew Chief | Admin action | `emailWrap` — "Your application status" |
| Commission earned | Pit Crew / Lead | Order completes (cron) | `walletCreditEmail` — "₦X commission earned" |
| Payout processed | Pit Crew / Lead | Admin processes payout | `walletCreditEmail` — "₦X sent to your bank" |
| New application alert | Admin (Trip) | Crew Chief signs up | Inline via admin notification poll |

> Commission-earned emails must be **batched** — never one per order. Daily digest, or on-demand pull from the /m/ dashboard.

## A.5 · Admin Notification Poll · `/api/admin/notifications/poll`

Add new event types:

```js
{ type: 'affiliate_application', id: member.id, name: member.name, at: member.createdAt }
{ type: 'payout_request', id: payout.id, amount: payout.amount / 100, member: member.name, at: payout.createdAt }
```

Surface as real-time bell notifications — same pattern as tickets and deposits.

## A.6 · Cron Jobs

**`cron/orders` — order → Completed (≈ line 82)**

- Look up ordering user's `signupSource`
- Find `AcquisitionLink` with that slug where `affiliateId` is set
- Load Pit Crew member — if approved, create `AffiliateCommission`
- Split: `leadAmount` + `marketerAmount` using admin-configured split %
- If Pit Crew member IS the lead (self-assigned link), take the full pot

**`cron/orders` — order → Cancelled / refunded (≈ line 86)**

- Find `AffiliateCommission` for this `orderId` where status IN ('held', 'approved')
- Set status = 'voided' and decrement `member.totalEarned`

**`cron/daily` — commission release**

```sql
UPDATE affiliate_commissions
SET status = 'approved'
WHERE status = 'held' AND releasesAt <= NOW()
```

**`cron/daily` — auto-tier promotion**

- For each approved Pit Crew member, count distinct referred users via their links
- If count ≥ `pro_threshold` → upgrade tier + commissionRate
- Else if count ≥ `growth_threshold` → upgrade tier + commissionRate

**`cron/cleanup` — protect referred users**

Do NOT delete users whose `signupSource` matches any Pit Crew member link — they represent revenue attribution. Add a skip-check before purging.

## A.7 · Transaction Types

Pit Crew commissions are NOT user transactions (Pit Crew members aren't users). They live in `AffiliateCommission` and `AffiliatePayout` — no changes to the `Transaction` model.

If later we let Pit Crew members spend commission as Nitro wallet credit, introduce a `marketerWalletCredit` transaction type then. For now, payouts are bank transfers only — keep them separate.

## A.8 · Settings API · `/api/admin/settings`

Add to `ALLOWED_KEYS`:

```
affiliate_enabled
affiliate_starter_rate
affiliate_growth_rate
affiliate_pro_rate
affiliate_lead_split
affiliate_growth_threshold
affiliate_pro_threshold
affiliate_hold_days
affiliate_min_payout
affiliate_min_order
affiliate_max_links
```

## A.9 · Acquisition Links · `/api/admin/acquisition`

- Add `affiliateId` column — show which Pit Crew member owns each link
- Filter: admin sees all links; Pit Crew member-created links show a badge
- Stats unchanged — aggregation by `signupSource` already works
- Admin can still create non-affiliate links (`affiliateId = null`) for their own campaigns

## A.10 · Referral System Interaction

Both systems coexist and never conflict:

| Field | System | What it does |
| --- | --- | --- |
| `user.referredBy` | Referral | One-time ₦500/₦500 bonus on first deposit |
| `user.signupSource` | Pit Crew | Ongoing commission on every completed order |

A user can carry both — signed up via a Pit Crew member link and entered a friend's referral code. The referral bonus fires once; the Pit Crew member commission fires forever. No changes to the referral system.

## A.11 · Admin Permissions · `lib/admin.js`

- `ROLE_PAGES` — add `'affiliates'` to admin
- `affiliates.manage` → owner, superadmin
- `affiliates.payout` → owner
- `affiliates.void` → owner, superadmin

## A.12 · Admin Sidebar / Nav

Add an "Affiliates" nav item with a badge showing `pendingApplications + pendingPayouts`. Position it under the Marketing section near Acquisition and Rewards.

## A.13 · Orders — Attribution Visibility

In the admin orders list and order detail, show whether the ordering user was Pit Crew member-referred:

If `user.signupSource` → affiliate link → display a small "Via {memberName}" badge on the order row. Lets you eyeball which orders are generating commission.

## A.14 · Users — Attribution Visibility

In the admin users list, surface acquisition source:

- If `signupSource` → affiliate link: show "Via {memberName}"
- Else if `signupSource`: show "Via {linkName}" (admin tracking link)
- Else if `referredBy`: show "Ref: {referrerName}"

## A.15 · Promotion / Campaign Interaction

Users referred by Pit Crew members participate normally in all reward systems: platform campaigns, recurring campaigns, loyalty, leaderboard, milestones.

> Commission is calculated on `order.charge` (the amount actually paid after discounts). Promotions reduce the commission base — which is correct. Pit Crew members shouldn't earn on money the user didn't spend.

## Data Flow (End to End)

**User signs up via `nitro.ng/?via=lead-campaign-1`**

- `user.signupSource = "lead-campaign-1"`
- `AcquisitionLink` (slug: lead-campaign-1, affiliateId: affiliate_X)
- CrewMember X (role: member, leadId: lead_Y)
- Lead Y (role: chief)

**Order completes (cron):**

- Lookup `user.signupSource` → find Pit Crew member
- Create `AffiliateCommission`
  - `marketerAmount = charge × rate × (100 − leadSplit) / 10000`
  - `leadAmount = charge × rate × leadSplit / 10000`
- `member.totalEarned += total`
- `chief.totalEarned += leadAmount`

**Release after `hold_days`** → status flips `held` → `approved`.

**Lead / Pit Crew requests payout:**

- `AffiliatePayout` created (status: pending)
- Admin notified (bell + badge)
- Admin processes bank transfer
- `payout.status = completed`
- `member.totalPaid += amount`
- Email sent to Pit Crew member
- Activity logged

---

## 13. Team Competition

Teams are organic: each Crew Chief's squad (the Chief + their Pit Crew members) is a team. Competition runs on a weekly cycle with monthly rollups.

### Scoring

All competition metrics are **counts only** — no naira figures are ever shown in the group or leaderboard.

| Metric | What counts |
| --- | --- |
| Referral orders | Completed orders from users attributed to any team member |
| New signups | Users who registered via any team member's link |
| First purchases | Referred users who place their first-ever order |
| Repeat buyers | Referred users who place their 5th, 10th, 20th order |

### Competition Cycle

| Period | What happens |
| --- | --- |
| **Weekly** | Scoreboard resets every Monday 00:00 WAT. End-of-week winner announced Sunday night. |
| **Monthly** | Monthly champion = team with most weekly wins that month. Tiebreaker: total referral order count. |

### Lead Changes

Tracked in real time. When Team B overtakes Team A's weekly order count, a lead-change alert fires in the group. Alerts are throttled to max 1 per hour per team pair to avoid spam.

### Team Bonuses

Winning teams receive a bonus at the end of each competition period. Bonus structure is configured by Trip in admin settings and can change per period.

| Setting | Default | Notes |
| --- | --- | --- |
| `competition_weekly_bonus` | TBD | Bonus pool for the weekly winning team |
| `competition_monthly_bonus` | TBD | Bonus pool for the monthly champion team |
| `competition_bonus_split` | `equal` | How the pool is divided: `equal` (split evenly among team members) or `weighted` (proportional to each member's contribution) |
| `competition_enabled` | `true` | Master toggle |

Bonus is credited to each qualifying member's affiliate balance as a `bonus` commission entry (separate from order commissions, still subject to minimum payout threshold).

**MVP Bonus:** An individual MVP bonus can optionally be awarded to the top-performing individual across all teams each week. Configured via `competition_mvp_bonus` (default: off).

---

## 14. Telegram Crew Bot

A dedicated Telegram bot for the crew group. Group-based, transparent activity feed, competitive energy. No money figures — counts and names only.

### Bot Requirements

- Separate bot from the admin notification bot (different token, different group)
- Each crew member links their Telegram user ID to their `/m/` account (settings page or onboarding)
- Bot posts automated messages to specific group topics
- Slash commands respond privately via DM (bot must have been /started by the user first)

### Group Topics (5)

**Topic 1: Activity Feed** (automated, high volume)
- New signup from a crew member's referral: "A referral from **@Member** just signed up"
- Referral's first purchase: "A referral from **@Member** just made their first purchase"
- Repeat buyer milestones: "A referral from **@Member** just placed their 10th order"
- Lead change alerts: "**Team [ChiefName]** just took the lead this week — 34 orders vs **Team [ChiefName]**'s 31"

**Topic 2: Leaderboard** (automated, scheduled)
- Daily morning recap (9:00 WAT): yesterday's order counts per team, current weekly standings, top 3 individuals
- Weekly scoreboard (Sunday 22:00 WAT): final team rankings, individual top 5, total crew impact (order count + signup count)
- Monthly wrap-up (1st of month): winning team, MVPs, all-time records broken

**Topic 3: Wins** (automated, low volume)
- Weekly team winner announcement
- MVP of the week (per team + overall)
- First blood: first referral conversion of the day
- Streak callouts: "**@Member** has had referral orders every day for 7 days straight"
- Milestone callouts: "**@Member** just hit 50 total referral orders"
- Monthly champion announcement
- Bonus/reward payout confirmations

**Topic 4: Announcements** (admin-only, manual)
- New challenges or sprint competitions
- Bonus structure changes
- New crew member welcome: "Welcome **@NewMember** to **Team [ChiefName]**"
- Rule changes, platform updates
- X Premium renewal reminders

**Topic 5: General** (open chat)
- Crew discussion, tips, strategy, banter
- No bot posts here

### Slash Commands

All commands check the sender's Telegram ID against linked crew accounts. If sent in the group, the bot replies "Check your DMs" in the group and sends the full response privately.

| Command | Response (DM) |
| --- | --- |
| `/mystats` | Your signups, conversions, current streak, rank this week, all-time rank |
| `/team` | Your team's current standing vs other teams (order count, signup count, rank) |
| `/top` | This week's full leaderboard — all teams ranked with individual top 3 per team |
| `/link` | Your assigned referral link(s), ready to copy |
| `/start` | Initial bot greeting + instructions (required before bot can DM the user) |

### Integration Points

- **Commission cron** (`cron/orders`): when an order completes and generates commission, also fire the Activity Feed notification via the crew bot
- **Crew member model**: add `telegramUserId` field to `CrewMember` schema for DM delivery
- **Admin settings**: `crew_bot_token`, `crew_group_id`, topic IDs stored as settings
- **Webhook route**: separate route at `/api/telegram/crew-webhook` for the crew bot, handles slash commands

### What Is Never Shown in the Group

- Order amounts, charges, or revenue figures
- Commission amounts or earnings
- User emails, full names, or personal details
- Service types or links ordered
- Provider information

---

## A.16 · Crew Bot — System Integration

### Schema Addition

```
CrewMember {
  ...existing fields
  telegramUserId  String?  // linked TG user ID for DM delivery
}
```

### Settings Keys

```
crew_bot_token
crew_bot_group_id
crew_bot_topic_activity     // topic ID for Activity Feed
crew_bot_topic_leaderboard  // topic ID for Leaderboard
crew_bot_topic_wins         // topic ID for Wins
crew_bot_topic_announcements // topic ID for Announcements
competition_enabled
competition_weekly_bonus
competition_monthly_bonus
competition_bonus_split
competition_mvp_bonus
```

### Cron Jobs

**`cron/crew-digest` — daily morning recap (9:00 WAT)**
- Query yesterday's referral orders and signups per team
- Post leaderboard to the Leaderboard topic

**`cron/crew-weekly` — weekly wrap-up (Sunday 22:00 WAT)**
- Final weekly standings, winner announcement
- Credit bonus to winning team members
- Reset weekly counters
- Post to Wins + Leaderboard topics

**`cron/crew-monthly` — monthly wrap-up (1st of month)**
- Monthly champion, MVPs, records
- Credit monthly bonus
- Post to Wins + Leaderboard topics

### Webhook Route

`/api/telegram/crew-webhook` — handles:
- Slash commands from group or DM
- Validates sender's `telegramUserId` against `CrewMember` records
- Group commands: reply "Check your DMs" in group, send full response via `sendMessage` to user's chat ID

---

*NITRO.NG · Confidential Internal Document · Do Not Distribute*
