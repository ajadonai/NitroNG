# Nitro Cleanup — Product One-Pager

**Status:** Concept · v2 candidate · not for build  
**Owner:** Adonai (Trip)  
**Last updated:** April 2026

---

## What it is

A tool that helps creators clean up their *following list* — bulk unfollow accounts that are inactive, never followed back, never engage with their content, or no longer relevant. The user picks rules ("show me everyone I follow who hasn't posted in 6 months"), reviews the suggested list, and executes the cleanup.

The product is action-on-own-account, not action-on-audience. Nitro never touches anyone else's account. The user is operating on what *their* account follows, not what their followers see.

---

## Who it's for

**Primary:** Mid-tier Nigerian creators with bloated following lists. Someone who's been on Instagram since 2017 follows 2,500 accounts, half of which are dormant or never reciprocated. They want to bring the list down to the people who actually matter to them — for vanity ratio reasons, for cleaner feed quality, for general digital hygiene.

**Secondary:** Business accounts that followed customers, prospects, partners, or vendors over years and want to prune. Same use case in B2B framing.

**Tertiary:** Users who got swept up in mass-follow campaigns at some point — followed 1,000 accounts in a "follow-for-follow" sprint, never followed back, now want the cleanup.

---

## Why now

**The follow:follower ratio matters more than it used to.** Instagram and TikTok algorithms increasingly favor accounts that have a healthy ratio. Following 5,000 accounts when you have 2,000 followers reads as "this account is desperate or spammy" to the algorithm. Cleanup is genuinely useful for organic growth, not just vanity.

**Existing tools are weak.** Cleaner for Instagram, Crowdfire, Followers Track — these exist but are mostly Western, mostly subscription-priced in USD, and don't speak to Nigerian creators. Many were built years ago and feel dated. The market is sleepy enough that a polished, Naira-priced, Nigerian-context tool would stand out immediately.

**Mobile-first execution is now feasible.** A lightweight progressive web app or Capacitor-wrapped mobile app can do the unfollow actions on the user's own device, never touching credentials at the Nitro server level. This is the architecture that minimizes risk and was harder to ship five years ago.

---

## The mechanic

The hard part of this product is doing the actions safely without storing credentials or getting users banned. The architecture that works:

**Device-side execution.** Nitro Cleanup is a tool the user runs on their own device — either a mobile app or a browser extension. The user logs into Instagram in the app/extension. Nitro provides the *intelligence* (which accounts to suggest unfollowing, in what order, at what rate) but the *actions* happen client-side.

**Rate limiting and pacing.** Instagram detects mass-unfollow as easily as mass-follow. The tool unfollows at human-realistic pace — 30-60 unfollows per session, randomized timing, breaks between sessions. A complete cleanup of 800 accounts takes 2-3 weeks of background activity, not 2 hours.

**Review-before-execute.** User sees the proposed unfollow list, can whitelist exceptions, can adjust rules. Nothing happens until they explicitly approve.

This means the product is technically more like Crowdfire's old architecture than like Nitro's current panel architecture. Different infrastructure, different ops, different risk profile.

---

## The wedge

The natural entry point is from Audit (if Audit ships first). "Your account is following 2,847 accounts. 847 of them haven't posted in 6+ months. Clean them up for ₦X." One-click discovery, clear value prop, immediate pricing.

Without Audit, the wedge is harder. The cleanup product alone would need to acquire users via search ("Instagram unfollow tool Nigeria") or via the existing Nitro panel cross-sell. Both are viable but slower than the analytics-driven discovery path.

---

## Business model

**One-time cleanup credits.**
- ₦3,000 — clean up to 500 accounts
- ₦7,000 — clean up to 1,500 accounts  
- ₦15,000 — clean up to 5,000 accounts (typical for old or business accounts)

**Subscription tier (₦2,500/month):**
- Ongoing cleanup keeps the following list healthy automatically
- Weekly suggestions of new accounts to unfollow
- Whitelist management
- Analytics on follow ratio over time

**No free tier on this one.** Unlike Audit, every cleanup action has a real per-action cost (device API calls, server-side rule processing, support burden if something goes wrong). Pricing should reflect that. A free trial — first 50 unfollows free — works as an acquisition tool without absorbing unbounded cost.

---

## The moat

**Trust is the moat.** Cleanup is a sensitive operation. Users are giving the tool the ability to act on their account. The brand they trust matters more than the feature set. Nitro, if it's earned credibility on the panel side first, has a brand premium that a generic cleanup tool from nowhere doesn't.

**Localization matters less here than for Audit.** Cleanup logic is pretty universal — non-followers are non-followers anywhere. But pricing, support, payment methods, and language all benefit from being Nigerian-native.

**Integration with the panel and Audit creates pull.** If users come for analytics, see the cleanup recommendation, run the cleanup, then notice they could also boost their next post via the panel — that's a three-product flow under one wallet. Hard to replicate.

---

## What success looks like in 12 months

- 5,000–15,000 paying cleanup customers (one-time + subscribers combined)
- Strong word-of-mouth — cleanup is the kind of result users post about ("cleaned my following list with @nitrong, my feed is unrecognizable")
- Cross-pollination with the panel — measurable percentage of cleanup users becoming panel customers and vice versa
- Possibly: a viral moment when a Nigerian creator posts before/after numbers

---

## Real risks

**Account bans are the catastrophic risk.** Even with rate limiting and human-realistic pacing, some users will get action-blocked or temporarily banned. They will blame Nitro. Support volume could be heavy. Mitigation: aggressive education up front ("we pace this slowly to protect your account, but Instagram has the final say"), clear terms, possibly a "we'll pause if Instagram flags your account" guarantee.

**Instagram updates that break the tool.** Instagram changes its app or API and the cleanup mechanism stops working. This has happened to every cleanup tool ever built. Mitigation: pick an architecture (mobile app or extension) that's resilient to most changes, accept that occasional outages will happen, communicate honestly when they do.

**Credential anxiety.** Even though the device-side architecture means Nitro never sees passwords, users may not understand or believe that. The trust gap is real. Mitigation: clear technical explanations, video walkthroughs showing what happens locally, possibly open-sourcing the unfollow engine to prove no credential exfiltration.

**Different ops infrastructure.** This product needs a mobile app or browser extension, ongoing maintenance for those distribution channels, and customer support for issues that don't exist on the panel side. It's not "another Nitro feature" — it's effectively a second product with a related brand.

---

## Open questions for v2 planning

1. Mobile app or browser extension? (Mobile reaches more Nigerian users; extension is faster to ship and update. Possibly both, eventually.)
2. Native or PWA / Capacitor? (PWA-style is faster but Instagram detection is harder to manage. Native gives more control.)
3. iOS or Android first? (Android first for Nigerian audience.)
4. Standalone brand or under Nitro? (Suggests: under Nitro for trust transfer, but a distinct product surface — `cleanup.nitro.ng` or a separate app.)
5. How much does this lean on Audit? (If Audit ships first and provides the discovery wedge, Cleanup is much easier. If Cleanup ships standalone, marketing is harder.)
6. What's the support model when accounts get action-blocked? (Critical to figure out before launch — a single bad refund policy here can drain margin fast.)

---

## What I'd test before committing

**Cheap experiment:** survey 100 existing Nitro users via WhatsApp or email. "Would you pay ₦5,000 to clean up old, inactive accounts you follow on Instagram?" Direct question, direct answer. If 30%+ say yes, real demand exists.

**Slightly more expensive:** build a fake landing page — "Clean up your Instagram following list. Coming soon to Nitro." Run minimal Instagram or Twitter ads to it for two weeks, capture emails. CPA on the email signup tells you what acquisition would actually cost.

**Most expensive but most accurate:** ship a manual version. User pays ₦3,000, sends Nitro support a list of accounts they want unfollowed via the official Instagram app on their own phone, support staff guides them through unfollowing manually in chunks over a week. Ugly, slow, doesn't scale — but proves out willingness to pay before any technical investment.

If demand validates, decide on architecture. If not, this stays parked.

---

## Bottom line

Cleanup is a smaller, riskier, more operationally complex product than Audit. But it addresses real demand that no Nigerian competitor serves well, and it expands Nitro's audience to creators who'd never buy followers but would happily pay to manage their own account.

Best case: Cleanup ships after Audit, leverages Audit' discovery flow, and becomes the second leg of a three-leg stool (Panel + Audit + Cleanup) that defines Nitro as "the Nigerian creator platform" rather than "another SMM panel."

Worst case: it's an operations sinkhole that costs more in support than it earns. The risk profile justifies caution.

Park it. Validate demand cheaply over the next quarter. Revisit when Phase 1 is generating revenue and v2 planning has actual budget behind it.
