# Octane — Nitro Support Agent (Demo)

A lightweight, **working** prototype of Nitro's own AI support agent — built to dogfood the
[Octane plan](../../docs/OCTANE_PLAN.md) and have something real to demo.

> **Octane** is the working name (on-brand with Nitro's fuel/performance theme).
> Alternates under consideration: Nitra · NOS · Ignite · Nova. Final name TBD.

## What it is

A self-contained, branded web chat. You can hold a basic Nitro support conversation right now —
ask about orders, deposits, refunds, delivery/refills, pricing, platforms, referrals, account safety,
or ask to talk to a human. It uses Nitro's real design tokens (`#c47d8e`, Outfit/Cormorant, day/night
theme) and is seeded from the actual support knowledge in `components/support-page.jsx`.

It's a **demo model, not the product** — the brain is an offline keyword-intent engine, so there's
**no backend and no API key required.**

## Run it

Easiest (zero install) — just open the file:

```bash
open demo/octane/index.html        # macOS
```

Or serve it (nicer URL, identical result):

```bash
npx serve demo/octane              # then visit the printed localhost URL
# or:  python3 -m http.server -d demo/octane 8080
```

## Try saying

- "where's my order?" → "what do the statuses mean?"
- "how do I deposit" / "minimum deposit?"
- "my order is stuck, it's been hours"
- "I want a refund"
- "is this safe for my account?"
- "talk to a human"

Click the suggestion chips to keep the conversation moving, or type freely. Toggle day/night with the
**☾ / ☀** button.

## How it works

`index.html` is fully standalone (HTML + CSS + JS, no dependencies). The `KB` object holds Octane's
answers; a small keyword-scoring matcher (`match()`) routes each message to the best topic and falls
back gracefully (offering a human handoff) when it's unsure.

## Becoming real (Phase 1)

This demo is deliberately decoupled. To productionize inside the Next.js app:

1. Add `app/api/octane/route.js` backed by a real model (default to the latest Claude per project
   convention; no LLM key is wired today — that's a Phase 1 task).
2. **Ground** answers in live data — order status, wallet balance, refund eligibility, the service
   catalogue — via narrow tool calls, so Octane *looks things up* instead of guessing.
3. Reuse this chat UI as a React surface (it already matches the design system) and wire the
   human-handoff into the existing ticket / WhatsApp flow.

See [`docs/OCTANE_PLAN.md`](../../docs/OCTANE_PLAN.md) for the full roadmap and open questions.
