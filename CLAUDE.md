# CLAUDE.md

Behavioral guidelines to reduce common LLM coding mistakes. Merge with project-specific instructions as needed.

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

## V2 Roadmap (parked — do not build)

Two products are designed and documented for v2: **Audit** (account analytics) and **Cleanup** (bulk unfollow tool). A visitor acquisition flow with a public `/audit` page is also part of v2. None of this should be built until Adonai (Trip) gives explicit go-ahead.

### Where v2 docs live

- `/docs/V2_ROADMAP.md` — the comprehensive v2 plan. Read this first if any v2 question comes up. Covers product strategy, tier structure, architecture sketch, pre-launch validation experiments, and explicit "don't do" list.
- `/docs/v2/audit_one_pager.md` — Audit product framing and business case
- `/docs/v2/cleanup_one_pager.md` — Cleanup product framing and business case
- `/docs/v2/mockups/audit_internal.html` — fully interactive Audit mockup, 4 states
- `/docs/v2/mockups/cleanup_internal.html` — fully interactive Cleanup mockup, 5 states (includes per-platform connection flows)
- `/docs/v2/mockups/visitor_flow.html` — public audit + Cleanup demo + signup modal, 4 views

### How to handle v2 questions during Phase 1 work

If Adonai mentions v2 features during Phase 1 engineering work, **do not start implementing**. Acknowledge the request, point to `/docs/V2_ROADMAP.md`, and ask whether this is a planning discussion or an implementation request.

If Adonai explicitly asks to start v2 work, the path is:
1. Confirm Phase 1 has shipped and is stable
2. Confirm pre-launch validation experiments (in V2_ROADMAP.md) have been run
3. Pick one product to start with (likely Audit as the wedge)
4. Write a proper engineering brief following the brief template at `/docs/CLAUDE_CODE_BRIEF_TEMPLATE.md`
5. Get the brief approved before any code is written

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
