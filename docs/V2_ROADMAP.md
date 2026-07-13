# Nitro v2 Product Roadmap

**Status:** Parked · do not implement until explicit go-ahead from Adonai (Trip)
**Planning starts:** After Phase 1 ships and panel is generating revenue (estimated 60–90 days post-launch)
**Owner:** Adonai (Trip)
**Last updated:** May 2026

---

## Why this doc exists

This document captures all v2 product decisions, design work, and architectural sketches made in pre-launch planning. It exists so:

- Future-Adonai doesn't re-litigate settled decisions or forget why they were made
- Claude Code instances know the v2 scope but also know not to start building until told
- New team members or contributors can get up to speed quickly
- When v2 planning becomes real, the team starts with momentum instead of a blank page

Nothing in this doc should be implemented without an explicit go-ahead. Pricing, architecture, copy, all marked as starting hypotheses unless flagged otherwise.

---

## V2 in one paragraph

After the panel ships and earns its keep, Nitro becomes a creator platform with three connected products: the **Panel** (existing — buy Naira-priced growth services), **Audit** (read-only social media analytics, free with paid tier), and **Cleanup** (device-side bulk unfollow tool for Instagram/TikTok/X). Audit is the visitor acquisition wedge — public, real-data audits drive cold traffic to signup. Cleanup is the second hook that expands the audience beyond panel buyers. A single subscription tier (Nitro Pro) bundles full Audit with Cleanup credits, creating commercial cohesion across the product family. Same wallet, same brand, same login.

---

## Product 1: Audit

### What it is

Read-only social media account analytics. Visitor pastes any public Instagram, TikTok, or X handle. Within 30 seconds, they get a structured report: health score, engagement metrics, growth charts, top posts, audience signals.

Free tier shows enough to be useful (account header, health score, 2 of 4 metrics, 1 of 3 top posts, 30-day chart). Paid tier (Nitro Pro) unlocks audience demographics, posting heatmap, competitor tracking, full historical charts, PDF export.

### Who it's for

- **Primary:** Nigerian creators (musicians, comedians, fashion, food) who want to understand their account performance but can't afford or trust Western tools like Hootsuite or HypeAuditor
- **Secondary:** Nigerian agencies and Pit Crew members preparing pitches and competitive research
- **Tertiary:** Existing Nitro panel users wanting to measure the impact of orders they place

### Why this works as a wedge

Free, real-data audit at a public URL (`/audit`) is genuinely useful and creates several acquisition mechanics:

- **SEO funnel:** "Free Instagram audit Nigeria" type queries land directly on the audit page
- **Word-of-mouth:** Users share their audit results, drives organic traffic
- **Cross-product flywheel:** Every audit naturally surfaces Cleanup opportunities ("you have 847 ghost followings") and panel opportunities ("boost your worst-performing post"), tying Audit to the rest of Nitro
- **Brand repositioning:** "Nitro is a panel" stops being the only mental model — it becomes "Nitro is a creator platform"

### Tier structure (starting hypothesis — validate before launch)

**Free (visitor or signed-up user):**
- Account header (avatar, handle, follower/following/posts counts)
- Health score (0–100 with descriptor) and contributing factors
- 2 of 4 metric cards visible (engagement rate, growth %)
- 30-day follower chart
- Top 3 posts (visitor sees only #1 fully; signed-up free user sees all 3)
- Cross-product CTAs to panel and Cleanup

**Nitro Pro (₦5,000/mo — starting price):**
- Everything above, fully unlocked
- 12-month historical data
- Audience location breakdown
- Posting time heatmap
- Competitor tracking (5 accounts)
- PDF export for client pitches
- Priority data refresh (every 6 hours instead of daily)
- **Bundled: ₦8,000/mo of Cleanup credits included** — see Bundle section

**Agency tier (deferred to v2.1 or later):**
- Multi-account management
- White-label PDF exports
- Unlimited tracked accounts
- API access (maybe)

### Key product decisions

| Decision | What was chosen | Why |
|---|---|---|
| Entry point | "Audit any handle" search (Shape B) — your account is just one input | Stronger acquisition wedge than "audit my account only." Auditing competitors, prospects, or self all use the same flow. |
| Health score format | 0–100 number with descriptor ("87 · Healthy") | Most scannable. Letter grades feel academic, five-star feels gimmicky, no score loses the executive-summary moment. |
| Pro-locked sections | Blurred content with "Unlock" overlay | Maximum tease without giving away value. Greying out is less effective. Hiding entirely defeats the upsell. |
| Connected accounts | Quick-tap shortcuts above the search field | Serves both "audit my own account" and "audit any account" use cases without picking one. |
| Demo strategy for visitors | Real audit with real data, three-tier visibility (full / partial / locked) | Sample-data demos don't convert. Personalized real results create the dopamine hit that drives signup. |

### Data infrastructure

**Third-party data provider.** Evaluate when planning starts. Candidates as of April 2026:
- **Apify** — broad scraping infrastructure, pay-per-call, mature
- **Phyllo** — creator-focused API, structured data, more expensive but cleaner
- **RapidAPI Instagram providers** — many options, variable quality
- **ScrapingDog / Bright Data** — heavier-weight scraping infrastructure

Decision deferred. Pick based on cost-per-audit, data quality for Nigerian accounts specifically, and reliability of the provider's pipeline.

**No in-house scraping.** Instagram has sued scrapers. Use third-party providers as a buffer.

**Caching layer essential.** Audits are expensive (per-call API cost). Cache results for 24–48 hours per handle. Re-audit affordance lets users force a refresh.

### Cross-product CTAs

Each Audit report surfaces opportunities to use other Nitro products. The CTAs are anchored to specific data, not generic upsells:

- **Cleanup CTA** — appears when audit finds significant ghost/inactive followings. "Clean up 847 ghost followings to boost this score." Estimated lift: +N health points.
- **Panel CTA** — appears when engagement on a specific post is below the user's average. "Boost this post — engagement is below your average."

This pattern ties Audit to the rest of Nitro without feeling like an ad. The data tells a story; the CTA is the natural next action.

---

## Product 2: Cleanup

### What it is

Device-side bulk unfollow tool. Users connect their Instagram, TikTok, or X account separately. Cleanup audits their following list, categorizes it (non-followers / inactive / ghost engagers / worth keeping), and unfollows their selected accounts at human-realistic pace over hours or days.

### Who it's for

- **Primary:** Mid-tier Nigerian creators with bloated following lists (2,000+ accounts followed, half of which are inactive or non-reciprocating)
- **Secondary:** Business accounts pruning years of accumulated follows of customers, prospects, vendors
- **Tertiary:** Users recovering from past follow-for-follow campaigns

### Architecture (sketch — not implementation)

**Device-side execution.** Critical architectural decision. Nitro never stores credentials or session tokens. The unfollow actions happen on the user's own device — either via:

- A mobile app (Android first, iOS later) wrapped around their Instagram/TikTok session
- A browser extension that operates on their authenticated tab
- A combination of both, depending on platform

The Nitro server provides the *intelligence* (which accounts to suggest unfollowing, in what order, at what rate). The actions happen client-side. This means:

- No credentials ever stored at Nitro
- Account bans can't be pinned on Nitro's infrastructure
- Compliance simpler (we never possessed the credentials)
- Implementation is harder than a server-side approach but the legal/ethical position is much cleaner

**Pacing engine.** Unfollow at human-realistic speed — 80/day with randomized timing, breaks between sessions. Mimics natural usage patterns. A complete cleanup of 800 accounts takes 2–3 weeks of background activity.

**Pause-if-flagged guard.** If the platform issues an action block, verification prompt, or login challenge, automatically pause cleanup. Resume only after the user logs back in successfully. Promised on the marketing page; non-negotiable in implementation.

### Smart presets (locked in)

User-facing one-tap cleanup recipes. Reduces decision paralysis on a list of 800+ accounts.

- **Quick cleanup** — non-followers + inactive 1yr+ (safest, fastest)
- **Deep clean** — everything Nitro suggests except whitelist
- **Just ghosts** — only ghost engagers
- **Mass-follow recovery** — for users coming back from follow-for-follow sprees

### Pricing model (starting hypothesis)

**Per-cleanup tiers (one-time):**
- ₦3,000 — clean up to 500 accounts
- ₦7,000 — clean up to 1,500 accounts
- ₦15,000 — clean up to 5,000 accounts (typical for old or business accounts)

**Free tier:**
- First 50 unfollows on signup. Cold acquisition wedge — lets users experience cleanup before paying.

**Bundled with Nitro Pro:**
- Pro subscribers get ₦8,000/mo of Cleanup credits included (~1,500 unfollows monthly)
- Heavy users top up beyond included credits at standard per-cleanup prices
- Maintains sane unit economics (per-action cost is real, not infinite)

### Key product decisions

| Decision | What was chosen | Why |
|---|---|---|
| Platforms supported | Instagram, TikTok, X — three independent connections | Each is a clear use case with clear demand. Each connects separately on user's device. Don't dilute launch trying to support 6 platforms. |
| Connection flow | Inline connect prompt within the platform tab (Option A from chat planning) | Keeps user on the same page. No modal redirect. Each platform's connection flow is scoped within its tab. |
| Whitelist persistence | Persistent across cleanups; visible as dashed green badges in the audit list | Users dread accidentally unfollowing family/favorites. Persistent whitelist is the trust feature. |
| Re-audit affordance | "Last audited 2d ago · Re-scan" link below page subtitle | Audits go stale daily. Without re-scan, users would distrust the data. |
| Cross-platform whitelist sync | **Skipped for v2** | Too magic — users would be confused why TikTok suddenly knows their Instagram whitelist. Defer to later if validated. |

### Pre-build risks worth flagging

- **Account bans are the catastrophic risk.** Even with rate limiting, some accounts will get action-blocked. Users blame Nitro. Mitigation: aggressive education up front, clear terms, the pause-if-flagged guarantee.
- **Platform updates can break the tool.** Instagram, TikTok, X all change their apps. The cleanup mechanism needs maintenance. Architectural choice (mobile vs extension) affects resilience.
- **Trust gap on credentials.** Even with device-side execution, users may not understand they aren't giving credentials to Nitro. Need clear technical explanations, video walkthroughs, possibly open-source the unfollow engine.

---

## Visitor acquisition flow

### Public audit page

Two public routes available without authentication:

- `/audit` — the Audit public landing page. Visitor pastes any handle, gets a real audit. No signup required to start.
- `/cleanup-demo` — the Cleanup public demo. Sample-data only because Cleanup needs a connected session to do anything real, and connection requires signup.

These pages drop the dashboard sidebar and use a public top nav (brand left, Audit / Cleanup / Pricing links middle, Log in / Sign up right).

### Three-tier visibility on the public audit

Critical conversion mechanic. Same audit page, three levels of content:

- **Tier 1 — Fully visible (the hook).** Account header, full health score with descriptor, three contributing factors. The most shareable, most rewarding moment of the audit. Visitor walks away with this even if they don't sign up.
- **Tier 2 — Partially visible (the tease).** Metric grid: 2 metrics shown, 2 blurred with "Sign up to see" overlay. Top posts: #1 visible, #2 and #3 blurred with the same overlay.
- **Tier 3 — Hidden (the gate).** Followers chart, audience locations, posting heatmap, competitor comparison — all blurred with full-section unlock overlays. Each overlay has specific value framing ("See where the followers really are") plus signup CTA, plus a small "free 50 cleanup unfollows on signup" sweetener.

Plus one **hard signup hook** as a purple gradient banner between sections, with a single high-contrast CTA.

### Signup unlock modal

Triggered by any "Sign up" CTA on the audit page.

- Banner header with gradient matching the signup hook design
- Pre-filled handle reference: "We'll save your audit of @temsbaby" — reinforces that signup unlocks something specific to them
- Three benefits listed (full audits, free cleanup credits, Naira pricing) — not generic SaaS bullets
- Google OAuth above email/password (when wired)
- Single-step minimum-friction form
- "Already have an account · Log in" foot link

### Cleanup demo page

Different from Audit — cleanup needs credentials to do anything, so the demo uses sample data:

- Yellow demo banner at top: "Demo mode · this isn't your account"
- Pre-populated with `@demo_creator` and 2,847 sample followings
- All summary cards, presets, account list interactive
- Action bar at bottom shows demo price + "Sign up to run on your account"
- First 50 unfollows on signup mentioned as the carrot

---

## Bundle & pricing model

### Hybrid Pro structure (locked in)

After much debate about whether Cleanup should be bundled into Audit Pro or sold separately, the chosen approach is hybrid:

**Pro includes Audit features (unlimited) AND a monthly Cleanup credit allowance.** Specifically:

- Full Audit — all metrics, full history, audience demographics, posting heatmap, competitor tracking, PDF export
- ₦8,000/mo of Cleanup credits included (≈ 1,500 unfollows monthly)
- Heavy Cleanup users top up beyond included credits at per-cleanup prices

### Why hybrid, not full bundle or fully separate

**Full bundle problems:**
- Cleanup has real per-action costs. "Unlimited cleanup" with a fixed subscription breaks unit economics for heavy users.
- Cleanup-only buyers (users who want their following list cleaned but don't care about analytics) get pushed into a subscription they don't want.

**Fully separate problems:**
- Pricing story is fragmented ("Audit Pro ₦5K + Cleanup credits ₦4K + maybe more")
- Loses the cross-sell flywheel — users buying one product don't think about the other

**Hybrid wins because:**
- Pro users feel they get Cleanup "free" up to a useful amount (premium positioning)
- Heavy Cleanup users still pay for what they consume (sane economics)
- Cleanup-only buyers can still purchase per-cleanup credits without subscribing
- Free first-50-unfollows still works as the cold acquisition wedge
- Three buyer types all served: free tier, cleanup-only, Pro subscriber

### How the bundle is communicated

The Audit results page surfaces the bundle in three subtle, additive places (chosen over a dedicated card to avoid competing with audit data):

1. **Header tier pill** — interactive on Free tier, opens a popover listing the full Pro bundle with single CTA. Discoverable for the curious without being pushy.
2. **Pro unlock overlays** — each blurred section's CTA has a small purple line: "Pro also includes ₦8,000/mo Cleanup credits."
3. **Cross-product Cleanup CTA** — when the audit recommends cleanup, the CTA mentions the bundle: "₦4,500 from wallet · or included with Nitro Pro."

### Pricing as starting hypothesis

Every price in this document is a starting hypothesis. Actual pricing should be validated via:
- Direct survey of existing users
- A/B testing on real signup flows
- Comparison against what Nigerian creators currently spend on Western tools
- Unit economics review against actual API and infrastructure costs

Don't lock in pricing during architecture design. Pricing is a launch decision.

---

## Architecture sketch

This is intentionally high-level. Implementation details belong in engineering briefs written closer to build time.

### Routes

**Public (no auth):**
- `GET /audit` — Audit landing page with search field
- `GET /audit/:handle/:platform` — Audit results for visitor (auto-runs audit on load, three-tier visibility)
- `GET /cleanup-demo` — Cleanup demo with sample data

**Authenticated (dashboard):**
- `GET /audit` — full Audit surface with connected accounts
- `GET /audit/:handle/:platform` — full audit results, no visitor restrictions
- `GET /cleanup` — Cleanup main surface with platform tabs
- `GET /cleanup/connect/:platform` — connection flow for that platform

### Database additions (sketch)

New models needed (Prisma 6 syntax, exact schemas decided at build time):

- `AuditedAccount` — handle, platform, owner (nullable for visitor audits), data snapshot, expiresAt, healthScore, etc.
- `Subscription` — userId, tier, status, billingCycle, expiresAt, includedCreditsRemaining
- `CleanupConnection` — userId, platform, status (connected/disconnected), connectedAt, lastAuditAt
- `CleanupSession` — userId, platform, selectedAccountIds, status, paceConfig, completedAt, etc.
- `Whitelist` — userId, platform, accountHandle (composite unique). Persistent whitelist storage.

### External service dependencies

- **Audit data provider** — Apify or Phyllo or RapidAPI (decide at build time)
- **Subscription billing** — wallet-based, recurring deduction. Reuse existing Flutterwave/wallet infrastructure.
- **Mobile app or extension** — for Cleanup's device-side execution. Decide architecture at build time.
- **PDF generation** — for Pro export. Possibly Puppeteer or a service like DocRaptor.

### Code organization

Following existing Nitro patterns:
- New components under `components/audit/` and `components/cleanup/`
- New API routes under `app/api/audit/` and `app/api/cleanup/`
- Shared visitor components under `components/public/` (public top nav, signup modal)
- Shared SVG icon sprite — extend existing icon system, don't fragment

### Bundle size impact

Both products code-split as separate routes in Next.js. Estimated impact:
- `/audit` route: ~80 KB gzipped (charts, audit logic)
- `/cleanup` route: ~50 KB gzipped (list rendering, connection orchestration)
- `/audit` and `/cleanup-demo` (public): ~70 KB gzipped (subset of full audit)
- Shared SVG sprite addition: ~5 KB to common chunks

**Critical:** existing routes (landing, dashboard, new order, orders) must remain unaffected. Lighthouse scores on those pages should not regress.

---

## Pre-launch validation

Before any v2 engineering work begins, run these cheap experiments:

### Experiment 1 — Demand survey (cost: free, time: 1 week)

Survey 100 existing Nitro users via WhatsApp, email, or in-app prompt. Two questions:

1. "Would you pay ₦5,000/month for analytics on your Instagram account?"
2. "Would you pay ₦3,000–₦7,000 once to clean up old, inactive accounts you follow?"

If 30%+ say yes to either, real demand exists.

### Experiment 2 — Fake door test (cost: minimal, time: 2 weeks)

Add "Free account audit" and "Cleanup" buttons on the Nitro landing page. Each click captures email and shows "We'll email you when this is ready."

Volume of email signups over two weeks is the demand signal. If under 50 signups, demand isn't there.

### Experiment 3 — Manual MVP for Cleanup (cost: time-only, optional)

Offer cleanup manually to 10 existing users. Charge ₦3,000. Walk them through unfollowing on their own phone in chunks over a week. Measure willingness to pay and friction.

### Experiment 4 — Audit prototype (cost: API budget, time: 2 weeks)

Wire one provider (Apify or similar) for Instagram only. Build the bare-minimum audit page — engagement rate, follower count, recent post performance. Charge nothing. Measure return rate, share rate, completion rate.

If experiments 1–4 collectively show interest, v2 becomes a real candidate. If not, this stays parked or scope shrinks to one product instead of two.

---

## File inventory

All v2 design and product artifacts live in the following locations:

### In this repo

- `/docs/V2_ROADMAP.md` — this document
- `/docs/v2/audit_one_pager.md` — original product brief for Audit (covers framing, audience, why-now, business model, risks)
- `/docs/v2/cleanup_one_pager.md` — original product brief for Cleanup
- `/docs/v2/mockups/audit_internal.html` — internal Audit surface mockup (4 states: search, scan, free audit, Pro audit)
- `/docs/v2/mockups/cleanup_internal.html` — internal Cleanup surface mockup (5 states: connect, IG audit, TikTok inline-connect, low balance, cleanup running)
- `/docs/v2/mockups/visitor_flow.html` — visitor acquisition flow (4 states: Audit public landing, Audit results, Cleanup demo, signup modal)

The mockups are downloadable HTML files that render fully interactive prototypes. They include breakpoint toggles (sm/md/lg/xl), light/dark theme switches, and clickable state transitions. Use them as design reference — visual language, copy, layout decisions all baked in.

### How mockups should be used

Mockups are reference, not source of truth for production. When v2 engineering starts:

- Use mockups for visual language, layout patterns, copy tone
- Re-evaluate every design decision against current Nitro patterns at build time
- Don't blindly copy CSS — production should use Tailwind matching the rest of the app
- Mockup SVG icons are placeholders; production uses the standard Nitro icon system
- Sample data in mockups is illustrative; real data comes from the audit data provider

---

## Open questions

These need answers before v2 build starts:

1. **Audit data provider** — Apify, Phyllo, RapidAPI, or other? Decide based on cost-per-audit, Nigerian account quality, and pipeline reliability.
2. **Cleanup architecture** — Native mobile app, browser extension, PWA, or combination? Affects every other technical decision.
3. **Cleanup platform priority** — All three at launch (IG, TT, X), or stagger? IG has highest demand but hardest detection.
4. **Subscription billing** — Wallet-based recurring deduction handled in-app, or external billing system? Wallet-based is simpler if user keeps balance.
5. **Pricing validation** — Run actual user research before locking ₦5,000/mo Pro and ₦8,000/mo Cleanup credit allowance.
6. **Audit data refresh cadence for free vs Pro** — How often does free tier refresh? Daily probably, but verify cost.
7. **PDF export** — In-house generation or third-party service? Affects Pro feature complexity.
8. **Agency tier** — Build at v2.0 or defer to v2.1? Recommended: defer.
9. **Marketing channels** — SEO is the obvious play, but what supports it? WhatsApp groups, Twitter, Instagram Reels, influencer seeding all open.
10. **Compete with the panel** — does Pro give panel discounts, or stay separate? Recommended: stay separate; panel is variable cost per order, doesn't fit subscription.

---

## Product 3: Earn (Gamification & Rewards)

*Added May 2026*

### What it is

Dashboard engagement feature with two revenue-sharing mechanics: a monthly 2048 game competition with progressive prize pool, and video ad rewards (watch-to-earn). Users earn wallet credit by playing and watching — lowers the barrier to placing orders since earned credit offsets costs.

### 2048 Game

- Playable 4x4 grid in dashboard (arrow keys + swipe)
- Anti-cheat via seeded replay: server generates seed, client records moves, server replays to verify score
- Monthly leaderboard with progressive prize pool (base ₦20,000, grows with player count, caps at ₦100,000)
- Top 5 split: 40/25/17/11/7 — all configurable from admin
- Past winners list visible to all users

### Video Rewards

- Watch 30-second rewarded video ads, earn ₦15/watch (50/50 revenue split with ad network)
- Daily cap (default 5 watches/day), configurable from admin
- Placeholder UI until AdMob/AdSense SDK integrated — backend routes functional

### Key decisions

- Anti-cheat is server-validated replay, not client-trust
- Prize pool is progressive (more players = bigger pool) to incentivize participation
- Video rewards deferred until ad network configured — UI shows "Coming soon"
- Monthly payout is admin-triggered initially, automated later

### Status

Detailed implementation plan exists. Build order: schema → game engine → API → game UI → earn page → dashboard integration → admin section → video API.

---

## Product 4: AI-Powered Support

*Added May 2026 · expanded June 2026 → see [`docs/OCTANE_PLAN.md`](./OCTANE_PLAN.md) + working demo at `/demo/octane`*

> **"Octane"** is the working name for this agent. The fuller plan (`docs/OCTANE_PLAN.md`) reframes
> it as a two-customer play: dogfood it as Nitro's own support first, then productize it as an
> SMM-facing support agent other panel owners can deploy. A runnable, branded demo model lives at
> `/demo/octane/index.html`. The section below remains the original framing.

### What it is

AI chatbot integrated into the support ticket system. Handles common questions (order status, delivery times, refund policy, how-to) automatically. Escalates to human support when it can't resolve or when the user asks.

### Why

Support volume will grow with users. Most questions are repetitive (where's my order, how do I add funds, why is my order pending). AI can resolve 60-70% of tickets instantly, reducing response time and support load.

### Key decisions (to be made at build time)

- Which LLM provider (Claude API, OpenAI, or other)
- Knowledge base: FAQ content + order data + service catalog
- Escalation triggers: user frustration detection, account-specific issues, refund requests above threshold
- Whether to surface AI responses inline in the existing chat widget or as a separate "Ask Nitro" interface

---

## Product 5: AI-Powered Blog Comments

*Added May 2026*

### What it is

AI-generated contextual comments on blog posts to create social proof and engagement signals. Comments appear as real user discussions — questions, tips, experiences — seeded by AI but moderated by admin.

### Why

Blog posts with zero comments look dead. Genuine comment sections take months to build organically. AI-seeded comments bootstrap the appearance of an active community, which improves time-on-page, SEO signals, and visitor trust.

### Key decisions (to be made at build time)

- Comment generation approach: fully AI, AI-drafted + admin-approved, or hybrid
- Persona variety: different usernames, writing styles, Nigerian English patterns
- Whether to also allow real user comments alongside AI ones
- Moderation workflow in admin panel

---

## Product 7: Affiliate Portal

*Added June 2026 · Updated June 2026 with locked-in decisions*

### What it is

Affiliate marketing portal at `nitro.ng/m/`. Three-tier hierarchy: Super Admin (Trip) → Crew Chiefs → Pit Crew. Pit Crew members earn recurring commission on every order from users they recruit — forever, not just the first order.

**Agency/Reseller is explicitly out of scope.** That's a different product (wholesale pricing, bulk ordering, white-label reports). This is pure affiliate marketing — recruit users, earn commission.

### Two roles

- **Crew Chief** — Approved by Trip. Creates and assigns tracking links, recruits and manages Pit Crew members, sees full team performance, earns 40% of commission pot.
- **Pit Crew** — Invited by a Crew Chief. Runs outreach using assigned link, sees own stats only, earns 60% of commission pot.

### Commission tiers

| Tier | Threshold | Commission pot |
|---|---|---|
| Starter | 0–29 active referred users | 5% |
| Growth | 30–99 | 7% |
| Pro | 100+ | 10% |

**"Active" = placed at least 1 completed order in the last 30 days.** Tiers recalculate daily via cron. Tiers go up AND down — if referred users go dormant, the Pit Crew member's tier drops. This is intentional: Pit Crew members must keep their recruits ordering.

Pot splits 40% Crew Chief / 60% Pit Crew (configurable by admin). If a Crew Chief uses a link themselves (no Pit Crew member assigned), they get 100%. Commission frozen at creation — rate changes don't rewrite history.

### Commission rules (locked in)

- **Partial orders:** Commission proportional to delivered amount, not full charge. Pit Crew members see "Partial — commission adjusted" on their dashboard.
- **Drip orders:** Commission fires when the parent order hits Completed — based on final delivered figures, not per-batch.
- **Bonus credit:** No commission on welcome bonus or coupon bonus credit. Commission calculated on real ₦ the user paid only (`order.charge - bonusPortionUsed`).
- **Cancelled orders:** Commission voided if order is cancelled during 7-day hold. Already-released commissions are not clawed back.
- **Existing `?via=` links:** Admin-created tracking links (no `affiliateId`) never generate commission. The commission cron checks `affiliateId IS NOT NULL` before creating any commission row.

### Fraud prevention (locked in)

- Self-referral: block by email match AND IP/device fingerprint (not email-only)
- Same-IP cluster: flag >5 signups from same /24 IP range via same Pit Crew member in 24h
- Minimum order value: skip commission on orders below ₦1,000
- 7-day hold on all commissions before they become payable
- Refund clawback: auto-void held commissions on cancelled orders
- Admin override: Trip can void any commission at any time

### Payouts (v1 = manual)

Manual bank transfer by admin. UI shows payout request form + history. Auto-payout toggle exists in UI but labeled "Coming soon" — automated Flutterwave payouts deferred until the affiliate program proves itself.

### Signup info collected

**Crew Chief application:** Full name, email, phone (WhatsApp), X handle, "Why do you want to be an affiliate?" (short text), bank details (account name, bank, account number).

**Pit Crew (invited by Crew Chief):** Full name, email, phone, X handle, bank details.

### Dashboard caching & notifications

- `/m/` dashboard data cached, refreshed every 5 minutes
- Commission emails batched as daily digest, not per-order
- Real-time bell notifications for: application approved, commission earned (daily batch), payout processed

### Portal routes

| Route | Crew Chief | Pit Crew |
|---|---|---|
| `/m/` | Dashboard + stats + tier progress | Dashboard + stats + tier progress |
| `/m/links` | Create/assign tracking links (max 5) | Read-only: sees assigned link |
| `/m/team` | Invite Pit Crew members, view team performance | N/A |
| `/m/commissions` | Full commission history with filters | Own commissions only |
| `/m/payouts` | Request payout + history | Request payout + history |
| `/m/settings` | Bank details, password, X handle | Bank details, password, X handle |

### Full spec

Playbook with DM scripts, team ops, commission math, and 15-section engineering integration spec (Appendix A) at `/docs/AFFILIATE_PLAYBOOK.md`. Legacy architecture sketch at `/docs/phase3-affiliates.md`.

### Status

✅ **Built.** Schema, portal UI, admin controls, commission engine, cron jobs, and fraud prevention all implemented. Pending launch — awaiting Trip's go-ahead to open to Crew Chiefs.

---

## Engineering: TypeScript Migration

*Added May 2026*

### What it is

Migrate the entire codebase from JavaScript (.jsx/.js) to TypeScript (.tsx/.ts). Add proper types for Prisma models, API routes, component props, and shared utilities.

### Why

Codebase is growing. TypeScript catches bugs at compile time, improves IDE experience, and makes refactoring safer — especially important as V2 adds significant new surface area.

### Approach (to be decided at build time)

- Incremental migration (rename files one-by-one) vs. big-bang conversion
- Start with API routes and lib/ (most value from types), then components
- Add strict mode gradually — start with basic types, tighten over time
- Prisma already generates types; leverage those as the foundation

---

## Platform Campaigns | Seasonal & Recurring Discounts

*Added May 2026*

### The idea

Create predictable, recurring discount events that train users to come back on a schedule — not because they got a promo code, but because they know Nitro has a rhythm. Inspired by ABC's "TGIT" (Thank God It's Thursday) campaign that turned a specific night into appointment television. Same psychology applied to a growth platform: make certain days or periods mean something.

### Why this matters

Right now, users only return to Nitro when they have a specific order to place. There's no reason to check in on a Tuesday vs. a Friday. Campaigns create a heartbeat — users learn that certain days are cheaper, certain seasons have bigger deals, and Nitro rewards consistency. This drives:

- **Higher return frequency** — users check in on campaign days even if they weren't planning to order
- **Wallet pre-loading** — users fund wallets in advance to be ready for discount windows
- **Word of mouth** — "Nitro does 15% off every Tuesday" is a shareable fact, unlike a one-time promo code
- **Seasonal spikes** — aligned with cultural moments (Detty December, back-to-school, election season, Ramadan, new year)

### Two formats that work together

**1. Weekly ritual — "Turbo Tuesday" (working name)**

Every Tuesday, all services are 10-15% off. No code needed. The discount applies automatically at checkout if the order is placed on a Tuesday (WAT timezone). Users see a banner on the dashboard: "It's Turbo Tuesday — all services 10% off today."

Why this works:
- Low enough discount (10-15%) to be sustainable every week without destroying margins
- Frequent enough to become a habit — users associate Tuesday with Nitro
- Zero friction — no code to remember, no minimum spend, just order on Tuesday
- Creates urgency without being aggressive — "if I wait till Tuesday I save 10%"

**2. Seasonal campaigns — platform-wide events**

Bigger discounts (20-25%) during cultural or calendar moments, running for a defined period (1 day to 2 weeks). These feel like events, not just discounts. Examples:

| Campaign | Period | Discount | Rationale |
|----------|--------|----------|-----------|
| **New Year New Numbers** | Jan 1-7 | 20% | Everyone's setting goals, fresh start energy |
| **Valentine's Boost** | Feb 13-14 | 15% | Brands running Valentine's campaigns need reach |
| **Ramadan Growth** | During Ramadan | 15% | Content consumption spikes during Ramadan in Nigeria |
| **Summer of Growth** | June 1-14 | 20% | Aligned with global "summer push" for creators |
| **Independence Day** | Oct 1 | 25% (1 day) | National pride moment, Nigerian-first platform |
| **Detty December** | Dec 20-31 | 20% | Biggest social media period in Nigeria, everyone is posting |
| **Black Friday** | Last Friday of Nov | 25% (1 day) | Users already expect deals on this day |
| **Anniversary Sale** | Nitro's launch date | 25% | Celebrates the platform's birthday with users |

These campaigns are announced in advance via email blast, dashboard banner, WhatsApp, and social media. Users know they're coming and plan around them.

### How it works (no codes)

The key UX decision: **no promo codes for platform campaigns.** The discount applies automatically.

Technical approach:
- New `PlatformCampaign` model (or stored in Settings): name, discount percentage, start datetime, end datetime, active flag
- At checkout, the system checks if an active campaign exists. If yes, the discount is applied to the order total and shown as a line item: "Turbo Tuesday: -10%" or "Detty December: -20%"
- Admin can create, edit, activate, and deactivate campaigns from the admin panel
- For recurring weekly events (Turbo Tuesday), a settings flag like `earn_turbo_tuesday_enabled` + `earn_turbo_tuesday_discount` controls it
- Campaigns stack with existing coupon codes? **No.** One discount per order — campaign OR coupon, whichever is better for the user. This keeps margins predictable.

### What users see

**Dashboard banner** (when a campaign is active):
A colored banner at the top of the dashboard: "It's Turbo Tuesday — all services 10% off today" or "Detty December Sale — 20% off everything until Dec 31."

**Checkout line item:**
```
IG Followers (1,000)     ₦2,500
Turbo Tuesday (-10%)      -₦250
                         ───────
Total                    ₦2,250
```

**Pre-campaign teaser** (1-2 days before a seasonal campaign):
Dashboard card or notification: "Detty December starts in 2 days — fund your wallet now."

### Admin controls

- Create/edit/delete campaigns with name, discount %, start/end dates
- Toggle recurring weekly events on/off
- Set discount cap per order (optional — e.g. max ₦5,000 discount per order to protect margins on bulk orders)
- View campaign performance: orders during campaign, total discount given, revenue comparison vs. non-campaign days
- Kill switch: instantly deactivate any campaign if margins are getting hit

### What to validate before building

- **Margin math**: Run the numbers on 10% weekly + 20% seasonal. Does the increased volume offset the discount? Start with Turbo Tuesday only at 10% for one month and measure.
- **User behavior**: Do users actually shift their ordering to Tuesdays, or do they just get a discount on orders they would have placed anyway? Track order distribution by day of week before and after.
- **Stacking policy**: Confirm that campaign discounts don't stack with coupon codes. One or the other, whichever benefits the user more.
- **Name**: "Turbo Tuesday" is a working name. Could also be "Nitro Nights" (evening discounts), "First Friday" (monthly instead of weekly), etc. Test what resonates.

### What this is NOT

- Not a loyalty/points program (that's separate if we ever build it)
- Not a referral incentive (referral bonuses are separate)
- Not personalized pricing (everyone gets the same campaign discount)
- Not a loss leader strategy — discounts should be sustainable at scale

---

## ~~Product 6: Milestone Rewards~~ → Replaced by Nitro Status + Points

*Removed July 2026.* The milestone cashback concept was superseded by the Nitro Status + Points system (shipped July 2026), which combines status tiers (Spark → Legend) with points earning/redemption. See `lib/nitro-rewards.js` for the canonical implementation.

---

## Feature: Nitro Points Gamification Layer

*Added July 2026*

Nitro Status + Points is now the baseline rewards system. A future V2 layer should make points feel more alive without permanently raising the cashback cost on every order.

The idea: users earn extra Nitro Points through specific behaviours, time-boxed campaigns, and lightweight achievements. This should sit on top of normal order earning, not replace it.

Examples:

- First order of the week: 2x or 3x points.
- Weekend order boost: 2x points for selected windows.
- Bulk order milestone: bonus points after crossing a spend/quantity threshold.
- Streaks: place orders in 2–4 consecutive weeks and earn bonus points.
- Tasks/bounties: complete brand-building actions and earn Nitro Points or wallet credit.
- Reactivation: return after 30+ days and earn boosted points on the next order.
- Status challenge: “Spend ₦X more this month to unlock Y bonus points.”

Why this matters:

- A flat 1%–2% earn rate is financially safe but can feel slow.
- Gamified boosts create the feeling of progress without changing the permanent liability curve.
- Time-boxed campaigns let Nitro test what moves repeat spend before making anything evergreen.

Guardrails:

- Keep base earn rates conservative.
- Use bounded campaigns/multipliers before any permanent earn-rate increase.
- Cap campaign liability per user and per campaign.
- Snapshot multiplier/rate at order time.
- Do not award points on refunded, bonus-funded, or points-funded value.
- Show users clear expiry/eligibility rules before they act.
- Finance must be able to report campaign-issued points separately from normal earned points.

---

## Feature: Drip Feed Ordering

*Added June 2026*

### What it is

Gradual delivery of large orders over multiple days. Instead of dumping 5,000 followers at once (which looks suspicious and triggers platform detection), drip feed splits the order into daily sub-orders delivered over 2–7 days. Produces more natural-looking growth.

### Design decisions (locked in)

| Decision | What was chosen | Why |
|---|---|---|
| Minimum quantity | 500 | Below this, dripping is pointless — too few to split meaningfully |
| Maximum duration | 7 days | Longer than a week creates support headaches ("where are my followers?") |
| Order model | Parent-child | One parent order tracks the overall drip; child sub-orders are dispatched daily to the provider. Each child has its own status and provider tracking. |
| Quantity distribution | Even split across days, remainder on day 1 | Simplest to implement and explain. 5,000 over 5 days = 1,000/day. |
| Pricing | Same as regular order (no drip surcharge) | Drip feed is a delivery preference, not a premium feature |

### How it works

1. User selects service, enters quantity (≥500), toggles "Drip feed" on
2. User picks duration (2–7 days) via slider or dropdown
3. Order is created as a parent order with `dripDays` and `dripQuantity` fields
4. A cron job runs daily, finds parent drip orders that need their next child dispatched, creates the child order, and sends it to the provider
5. Parent order status reflects overall progress (Pending → Processing → Partial → Completed)
6. If a child order fails, the parent pauses and admin is alerted

### Admin UI

- Orders list shows drip parents with an expandable row — click to see child sub-orders with individual statuses
- Each child shows: day number, quantity, provider order ID, status, timestamps
- Admin can pause/resume a drip parent, which stops/restarts child dispatching
- Dashboard drip orders card shows active drips and completion %

### Mockup

Interactive drip feed mockup at `/app/mockup/page.jsx` — demonstrates the parent-child UI and admin controls.

### Status

✅ **Shipped.** Drip feed is live in production. Parent-child order model, multi-day and intraday drip, cron-based batch dispatch, admin UI with expandable child rows all implemented.

---

## ~~Feature: Loyalty Points Program~~ → Replaced by Nitro Status + Points

*Removed July 2026.* This concept was superseded by the Nitro Status + Points system (shipped July 2026). Status tiers replace account ranks, points earning is tier-based (0.5%–2%), and redemption is live. See `lib/nitro-rewards.js`.

---

## Product 8: Bounties (Tasks for Credits)

*Added June 2026*

### What it is

Users complete real-world tasks that increase Nitro's visibility and brand presence across platforms. In return, they earn wallet credit. Tasks are things like leaving a Google review, posting on Trustpilot, writing a Reddit post, making a tweet, creating a YouTube video, or sharing Nitro on their story. Each completed bounty pays a fixed credit reward after admin verification.

### Why

Nitro needs organic visibility beyond paid ads. User-generated reviews, social mentions, and platform posts create compounding SEO and trust signals that ads cannot buy. Google reviews improve local search ranking. Trustpilot builds credibility for new visitors. Reddit and Twitter posts generate backlinks and social proof. YouTube videos create evergreen discovery. Paying users to do this is cheaper than equivalent ad spend and produces more authentic content.

### How it works

1. Admin creates bounty types in the admin panel (e.g. "Google Review", "Tweet about Nitro", "YouTube Review Video")
2. Each bounty type has: title, description, instructions, reward amount, verification method, max claims per user, active/inactive toggle
3. User visits the Bounties page in the dashboard, sees available bounties
4. User claims a bounty, completes the task, submits proof (screenshot URL or link to the post)
5. Admin reviews submissions, approves or rejects
6. On approval, reward is credited to the user's wallet as bonus credit (non-withdrawable, spend-only)

### Bounty types (starting set)

| Bounty | Reward (hypothesis) | Verification | Notes |
|--------|---------------------|--------------|-------|
| Google Review (5-star) | ₦500 | Admin reviews screenshot | One-time per user |
| Trustpilot Review | ₦500 | Admin checks Trustpilot page | One-time per user |
| Tweet about Nitro | ₦200 | Link to tweet, admin checks it's live | Repeatable monthly |
| Instagram Story mention | ₦150 | Screenshot of live story | Repeatable weekly |
| Reddit post (relevant sub) | ₦300 | Link to post, admin checks | One-time per sub |
| YouTube video review | ₦1,000-₦2,000 | Link to video, min 60s | One-time per user, higher reward for quality |
| TikTok video mention | ₦300 | Link to video | Repeatable monthly |
| Blog post / article | ₦1,000 | Link to published post | One-time per user |

Reward amounts are starting hypotheses. Adjust based on actual ROI of each channel.

### Key decisions

| Decision | What was chosen | Why |
|---|---|---|
| Reward type | Bonus credit (non-withdrawable) | Users must spend rewards on Nitro services, driving orders. Prevents gaming for cash extraction. |
| Verification | Manual admin review (v1) | Automated verification is fragile (deleted posts, fake screenshots). Start manual, automate later if volume justifies. |
| Repeatability | Per-bounty config | Some tasks make sense once (Google review), others monthly (tweets). Admin sets per bounty type. |
| Where it lives | Dashboard tab, same level as Services/Orders | Visible but not intrusive. Users discover it organically. |

### Fraud prevention

- One Google/Trustpilot review per user (deduplicate by user ID)
- Admin can reject low-effort or fake submissions
- Minimum account age before bounties are available (e.g. 7 days, configurable)
- Rate limit: max N bounty submissions per day per user
- Admin can ban a user from bounties without banning their account

### Admin UI

- Bounty type management: CRUD for bounty types with reward, instructions, verification notes, max claims
- Submission queue: pending submissions with proof links, approve/reject buttons, notes field
- Stats: total rewards paid, submissions by type, approval rate
- Toggle: enable/disable entire bounties feature

### Status

Concept defined. Not yet built. Awaiting go-ahead.

---

## Feature: Changelog (What's New)

Public-facing release notes page visible to logged-in users. Simple list of entries (date + short description) showing platform updates, new features, and fixes. Stored in the database with an admin UI to create/edit entries — no deploys needed to publish updates. Could live as a dashboard tab or standalone page. Keep it lightweight: no comments, no reactions, just a chronological feed.

---

## Things we're explicitly NOT doing

To save future-us from re-litigating bad ideas:

- ✗ **Mass follow as a feature.** Different business, different risk profile, different infrastructure. Not in Nitro.
- ✗ **Mass unfollow of audience (someone else's followers).** Crosses from "cleanup" into harm. Different ethics.
- ✗ **Block-and-unfollow.** Same problem.
- ✗ **"Find followers who recently unfollowed you" stalking features.** Tools like FollowMeter built businesses on this and it's grim. Don't go there.
- ✗ **Auto-cleanup running forever in the background.** Sounds good but creates support nightmares (users forget it's running, get confused when followings drop). Make it explicit per-session.
- ✗ **Cross-platform whitelist sync.** Too magic for v2. Defer until validated as needed.
- ✗ **Compare mode (audit two accounts side-by-side).** Pro feature, mock later, defer for v2.0.
- ✗ **Agency white-label.** Defer to v2.1 or v3.
- ✗ **Storing user social account credentials at Nitro.** Architectural non-starter for legal and trust reasons.
- ✗ **Using fabricated social proof stats on the public audit page** ("47,000 audits run!" when launching). Replace with testimonials, partner logos, or real numbers when they exist.
- ✗ **Bundle pricing decided in design phase.** Validate before launch.

---

## User Profile Enrichment

*Added June 2026*

### What it is

Collect more info from Nitro users beyond name + email. Priority fields: WhatsApp number, Instagram/TikTok/X handles, business type (creator/brand/agency/personal). Enables better support (WhatsApp outreach), personalized recommendations, and richer data for the affiliate system (know what kind of users affiliates are recruiting).

### When to collect

- **Progressive, not at signup.** Don't add friction to registration. Collect via a one-time "Complete your profile" prompt on the dashboard after first order or first deposit. Dismissible but reappears once per session until filled.
- **WhatsApp number** is highest priority — unlocks direct support and campaign notifications.

### Status

Not yet built — add to v2 engineering queue.

---

## Product 7: WhatsApp Automation (activation + support)

*Added June 2026*

### What it is

Programmatic WhatsApp messaging via the WhatsApp Business API (Meta Cloud API or a BSP like Twilio/Infobip). Two use cases:

1. **Activation drip** — mirror the email activation sequence (Day 1/3/6 for ad signups who haven't deposited) on WhatsApp for users who have a phone number on file. Higher open rates than email, catches users where they already are.
2. **Transactional notifications** — order completion, deposit confirmation, refund alerts via WhatsApp as an opt-in channel alongside email.

### Prerequisites

- WhatsApp Business API account (requires Meta Business verification)
- Pre-approved message templates for each outbound message (Meta reviews, 1-2 day turnaround)
- Per-conversation cost (~$0.02-0.04 per message, varies by BSP)
- User phone numbers collected (see Product 6: User Profile Enrichment above)

### Why it's v2

The email activation sequence ships first to validate whether the 3-touch cadence moves the ad-cohort deposit rate. If it works via email, WhatsApp adds a higher-engagement channel on top. If it doesn't, the problem is the message, not the medium.

### Status

Not yet built. Ship email activation first, measure for 1-2 weeks, then evaluate.

---

## When to revisit this doc

Revisit when any of these become true:

- Phase 1 has shipped and Nitro panel is generating revenue (60–90 days post-launch likely)
- Existing users start asking for analytics or cleanup features unprompted
- A competitor launches something similar in the Nigerian market and forces the timing
- Adonai (Trip) decides v2 planning starts

Until any of those, this doc is reference material, not a build target.

---

## Doc maintenance

When updating this document:

- Mark new sections with the date of the change
- If a decision changes, note the old decision and why it changed
- Don't delete deferred items — they're useful as evidence of considered-and-rejected ideas
- Keep the "Things we're NOT doing" list as a compounding guardrail
