# CLAUDE.md

Behavioral guidelines to reduce common LLM coding mistakes. Merge with project-specific instructions as needed.

## ⛔ DRIP PUSH CHECKLIST

When pushing the drip changes, **restore these items that were removed in commit `0ec7316`** to avoid breaking the build:

1. **`components/admin-dashboard.jsx`** — re-add:
   - Dynamic import: `const AdminCreateOrderPage = dynamic(() => import("./admin-create-order-page").then(m => m.AdminCreateOrderPage), { ssr: false });`
   - Nav entry: `{ id: "create-order", label: "Create Order", icon: ... }` in the Operations section
   - Route case: `case "create-order": return <AdminCreateOrderPage dark={dark} t={t} />;`
   - Sidebar branch: `active === "create-order" ? <div id="create-order-sidebar" ... /> :` before the leaderboard ternary
2. **`components/admin-extra-pages.jsx`** — re-add at the end: `export { AdminCreateOrderPage } from "./admin-create-order-page";`
3. **`tests/user-orders-pagination.test.js`** — re-add the 2 `POST /api/orders — request boundary` tests (malformed JSON + typed-invalid body)
4. **Push `components/admin-create-order-page.jsx`** and **`tests/admin-create-order-module.test.js`** alongside the above

## ⛔ HARD GATE: Tasks page

Before building or shipping ANYTHING related to the Tasks page, task rewards, or the tasks launch email: **read `docs/TASKS_LAUNCH_GATE.md` and ask Trip the questions in it first.** The launch email already promises users specific numbers; do not ship task amounts Trip has not confirmed in that conversation.

## ⛔ Support tickets moved to WhatsApp — DO NOT TOUCH

Customer support is handled entirely through WhatsApp — there is no in-app ticket system. The admin `tickets` page, `SupportPage`, `admin-tickets.jsx`, and all ticket-related API routes exist only as legacy read-only views of old data. **Do not** build, fix, improve, refactor, or redesign any ticket-related code: no ticket sidebar widgets, no ticket notifications, no ticket status flows, no new ticket creation UI, no polling fixes, no cleanup of ticket polling intervals, no "while we're here" improvements. Leave ticket code exactly as-is — it will be removed entirely in a future cleanup pass. If a task mentions tickets, clarify with Trip first — the answer is almost certainly "that's handled on WhatsApp now."

## ⛔ PROTECTED — never modify without flagging

The nightly cohort check depends on these. If any edit, refactor, dependency change, or deploy config change touches them (directly or indirectly), **STOP** and tell Adonai explicitly before proceeding, and restate what must stay true:

- `public/robots.txt` — `Allow: /api/cron/cohort-stats` must stay above `Disallow: /api/`
- the `/api/cron/cohort-stats` route (reader + 1 AM writer + self-heal + robots smoke check) — must return fresh JSON to token-bearing requests (both `?token=` and `Authorization: Bearer`), no-store on CDN
- `tests/robots-txt-guardrail.test.js` — the CI test that fails the build if robots.txt is wrong — never delete or skip

Never "clean up", regenerate, or simplify robots.txt as a side effect of another task.

**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

## 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

---

**These guidelines are working if:** fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, and clarifying questions come before implementation rather than after mistakes.

---

## Weekly changelog reminder

At the start of each session, if it has been 7+ days since the last changelog entry was added, remind Adonai: "It has been a while since the last changelog entry. Want to add any updates from this week?" The changelog is managed via the admin panel (Admin > Marketing > Changelog) or the API at `/api/changelog`. Entries should be user-facing only, written in plain language a Nigerian user would understand. No technical jargon, no internal/admin changes.

---

## V2 Roadmap (active)

Phase 1 has shipped. We are now in V2. V2 products: **Audit** (account analytics), **Cleanup** (bulk unfollow tool), **Earn** (2048 game + video rewards), **AI Support** (chatbot — note: tickets moved to WhatsApp, so scope may shift), **AI Comments** (blog social proof), a visitor acquisition flow, a **Reseller API**, and a **TypeScript migration**.

### Where v2 docs live

- `/docs/V2_ROADMAP.md` — the comprehensive v2 plan. Read this first if any v2 question comes up. Covers product strategy, tier structure, architecture sketch, pre-launch validation experiments, and explicit "don't do" list.
- `/docs/v2/audit_one_pager.md` — Audit product framing and business case
- `/docs/v2/cleanup_one_pager.md` — Cleanup product framing and business case
- `/docs/v2/mockups/audit_internal.html` — fully interactive Audit mockup, 4 states
- `/docs/v2/mockups/cleanup_internal.html` — fully interactive Cleanup mockup, 5 states (includes per-platform connection flows)
- `/docs/v2/mockups/visitor_flow.html` — public audit + Cleanup demo + signup modal, 4 views

### How to handle v2 work

V2 is the current phase — no need to gate on "has Phase 1 shipped." When Trip asks for a v2 feature:
1. Check `/docs/V2_ROADMAP.md` for existing design decisions and constraints
2. Write a proper engineering brief following the brief template at `/docs/CLAUDE_CODE_BRIEF_TEMPLATE.md` if the feature is large
3. Get the brief approved before writing code
4. For smaller tasks within an already-approved product, proceed directly

### What v2 must not do

`V2_ROADMAP.md` has an explicit "Things we're NOT doing" section. Most important entries:

- Never store user social account credentials at Nitro
- No mass-follow product (different business, not in Nitro)
- No "stalking" features (who unfollowed me, etc.)
- Cleanup is device-side execution only — Nitro provides intelligence, not actions
- Pricing in V2_ROADMAP.md is starting hypothesis, not validated — don't lock in pricing during architecture work

If a v2 task seems to violate any of these, push back before implementing. The constraints exist for legal, ethical, or business reasons that aren't always obvious from a single task description.

### Bundle structure (locked in)

Nitro Pro = Audit features + ₦8,000/mo Cleanup credits included. Heavy Cleanup users top up. Cleanup-only buyers pay per cleanup without subscribing. Three buyer types served simultaneously. Don't propose changes to this structure without strong reason — it's the result of significant deliberation.

### Visual design language

Both v2 products use the existing Nitro design system: Outfit + Cormorant + JetBrains fonts, `#c47d8e` accent, light/dark themes via `nitro-theme` localStorage. Mockups demonstrate the SVG icon vocabulary (single sprite, used via `<use href="#i-..."/>`). When v2 builds, extend the existing icon sprite — don't fragment.

Cross-product consistency matters: Cleanup's "cart bar" pattern, Audit's "metric grid" pattern, the platform tabs (IG/TT/X) at the top of each product's main surface, the wallet integration, the Pro tier badge with popover — all chosen to make Audit and Cleanup feel like siblings, not separate products.

## Launch day checklist

Tasks to complete on or before launch day:

### Infrastructure

- [x] Upgrade Vercel to Pro plan
- [x] Set `maxDuration = 60` on all cron routes
- [x] Upgrade Neon to paid plan
- [x] Reactivate cron jobs (Vercel cron schedules — include `promotions` every 5 min)

### Deferred fixes (completed)

- [x] Wire user notification preferences to order/email paths — fixed: admin refund + leaderboard reward emails now check `notifOrders`
- [x] LCP optimisation — admin dashboard now receives `initialData` from server (skips skeleton). User dashboard already had this.

## Providers

Three upstream SMM providers supply the catalogue:

| Key | Name | Services | Orders to date | Status |
|---|---|---|---|---|
| `mtp` | MoreThanPanel | 4,839 | 6,050 | primary |
| `dao` | DaoSMM | 6,224 | 1,045 | secondary |
| `jap` | Just Another Panel | 5,981 | 22 | barely used, being dropped |

`jap` was never adopted properly but 14 curated tiers still point at it, so it
cannot simply be deleted. Retire those tiers before removing the provider.

**Never expose provider names or their raw service names to resellers or users.**
Provider service names carry a recognisable house style (emoji, pipe-delimited
speed and refill fields) that identifies the source on sight.

## Git conventions

All commits and deploys are authored as `Trip <devbyadonai@gmail.com>`. Set `git config user.name "Trip"` and `git config user.email "devbyadonai@gmail.com"` before committing. **Do not** add `Co-Authored-By` trailers or any other attribution — `devbyadonai@gmail.com` is the sole contributor on every commit.

### Commit versioning

Commit messages use a semantic prefix that reflects the significance of the change:

- **`v2:`** — version-level changes (new product phase, major architectural shift)
- **`v2.1:`** — milestones (a product launches, a major feature ships to users)
- **`v2.1.1:`** — casual fixes (bug fixes, polish, plumbing, admin UX tweaks, refactors)

The milestone counter increments on each milestone (`v2.1`, `v2.2`, `v2.3`, …). The patch counter increments within the current milestone (`v2.1.1`, `v2.1.2`, …) and resets when a new milestone ships. When deciding which prefix to use, ask: "Does this change what users can do?" If yes, it's at least a milestone. If no, it's a casual fix.
