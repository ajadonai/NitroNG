# Nitro v2 Product Roadmap

**Status:** Parked · do not implement until explicit go-ahead from Adonai (Trip)
**Planning starts:** After Phase 1 ships and panel is generating revenue (estimated 60–90 days post-launch)
**Owner:** Adonai (Trip)
**Last updated:** April 2026

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
- **Secondary:** Nigerian agencies and marketers preparing pitches and competitive research
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
