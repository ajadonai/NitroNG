# Octane — AI Support Agent (Future Plan)

> **Status:** Vision / not started. This is a planning doc, not an approved build.
> Parked alongside the V2 roadmap. Do not begin engineering without explicit go-ahead from Adonai (Trip).

**Working name:** **Octane** (on-brand with Nitro's fuel/performance theme).
**Alternates to pick from:** Nitra · NOS · Ignite · Nova · Combust · Afterburner.
_Pick one before any public-facing build; "Octane" is the placeholder used in the demo and this doc._

---

## One-line pitch

An AI support agent for SMM panels that handles customer support and related operational tasks — built by dogfooding **Nitro's own** support first, so we have a proven, demo-ready working model before we sell it to anyone else.

---

## The problem

SMM panels live and die on support volume. The same questions repeat thousands of times:

- "Where's my order / why is it still pending?"
- "How do I deposit / which payment methods work?"
- "Why was this partial / where's my refund?"
- "Which service/tier should I buy?"
- "Is this safe for my account?"

Today this is handled by a mix of canned FAQ chat (`support-page.jsx` already has rule-based `BOT_RESPONSES`) and humans answering tickets / WhatsApp. That's slow, doesn't scale, costs operator time, and every panel owner re-solves the same thing badly.

**Insight:** support for an SMM panel is narrow, repetitive, and grounded in structured data the panel already has (order status, wallet balance, refund rules, service catalogue). That makes it an ideal surface for an AI agent — high deflection, low hallucination risk if grounded in the panel's own data.

---

## Who it serves

**Two customers, one product:**

1. **Nitro itself (customer #0 — dogfood).** Octane becomes Nitro's front-line support: answers FAQs, looks up live order/wallet status, explains refunds, and hands off to a human only when it should. This is where we prove it works and gather the real conversation transcripts that make it good.

2. **Other SMM panel owners (the product).** Once it's proven on Nitro, Octane is packaged as an embeddable/white-label support agent other panel operators drop into their own panel — grounded in *their* catalogue and order data. This is a separate revenue line from Nitro's core SMM business.

---

## Strategy: build our own first → demo → productize

The whole bet is **dogfooding as go-to-market.** We don't sell a support agent we haven't run ourselves.

```
Phase 0  Demo model (this repo)     → a working, presentable Octane to show & feel
Phase 1  Dogfood on Nitro           → wire to real order/wallet/refund data, ship to nitro.ng
Phase 2  Harden & measure           → deflection rate, CSAT, handoff quality, transcripts
Phase 3  Productize for other panels→ multi-tenant, white-label, panel-agnostic grounding
```

Each phase only starts once the previous one is real. The demo (Phase 0) exists to make the vision tangible — it is **not** the product.

---

## Phases (rough)

### Phase 0 — Demo model ✅ (built — see `/demo/octane`)
- Self-contained, branded web chat with the Octane persona.
- Seeded from Nitro's existing support knowledge so it holds a real basic support conversation.
- Purpose: something to *show*. Zero backend, launches in a browser.

### Phase 1 — Dogfood on Nitro
- Move Octane into the Next.js app as a route (e.g. `app/api/octane/route.js` + a chat surface that replaces/augments `support-page.jsx`).
- Ground answers in **real data**: live order status (provider polling), wallet balance, refund eligibility, the service catalogue. The agent should *look things up*, not guess.
- Pick a model (default to the latest Claude per project convention; see `docs/API_PROVIDERS.md` for where keys live — note: no LLM key is wired today, that's a Phase 1 task).
- Clean human-handoff into the existing ticket / WhatsApp flow.
- Guardrails: never invent order states, never promise refunds outside policy, escalate on payment disputes.

### Phase 2 — Harden & measure
- Instrument: deflection rate, containment, CSAT thumbs, handoff reasons.
- Use real transcripts to expand the knowledge base and tune tone.
- Safety review (prompt-injection from pasted links/order notes, PII handling).

### Phase 3 — Productize for other panels
- Multi-tenant: each panel brings its own catalogue + order API.
- White-label theming (Octane already uses a tokened design system).
- Pricing model TBD (per-seat? per-resolved-conversation? bundled with a panel platform?).
- This is a real product decision — gate behind validation, same discipline as V2.

---

## What Octane should and shouldn't do

**Should:**
- Answer the repetitive support questions accurately and in Nitro's voice.
- Look up grounded, account-specific facts (order/wallet/refund) once wired.
- Know when it doesn't know, and hand off cleanly to a human.

**Shouldn't (guardrails):**
- Never invent order status, balances, or delivery promises.
- Never authorize refunds/credits outside documented policy — propose, let a human/automation execute.
- Never store or echo more PII than needed.
- Treat pasted links/order text as untrusted input (prompt-injection surface).

---

## Open questions

- **Model & cost:** which Claude model, and what's the per-conversation cost at Nitro's support volume? (No LLM key wired yet.)
- **Grounding boundary:** how much account data does the agent get to read directly vs. via narrow tool calls?
- **Handoff:** does Octane create a ticket, ping WhatsApp, or both? Who owns the SLA when it escalates?
- **Scope of "related things":** the brief says "support and all related things" — does that include order placement, upsells, dunning/deposit nudges? Decide the line between *support* and *sales*.
- **Productization shape:** embeddable widget, hosted dashboard, or API? Multi-tenancy model?
- **Naming:** lock the final name (see alternates above) before anything public.

---

## Pointers

- Demo: `/demo/octane/` (open `index.html`, or `npx serve demo/octane`).
- Existing rule-based support chat to evolve from: `components/support-page.jsx`.
- Design tokens reused by the demo: `app/globals.css` (`#c47d8e`, Outfit/Cormorant/JetBrains, day/night).
- Broader product roadmap context: `docs/V2_ROADMAP.md`.
