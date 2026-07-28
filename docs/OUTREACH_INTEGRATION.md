# Outreach Integration — how the bot and the triggers fit together

This is the seam between two pieces of work:

- **Claude Code owns** the triggers, the daily cron, the real-time deposit/order hooks, and the
  message copy (`OUTREACH_MESSAGES` in `lib/telegram.js`) + the `outreach*SentAt` columns.
- **This kit owns** the WhatsApp connector and the AI reply layer (`lib/ify/*`).

They meet at **one function**.

## The one call the triggers make

```js
import { sendOutreach } from '@/lib/ify/outreach';

// day1 / day3 / day7 / firstDeposit / firstOrder / winback
await sendOutreach({ user, trigger: 'day1', extra });
```

`sendOutreach` sends the approved template, stamps the tracking column (for cron triggers), opens the
AI-handled window, and logs it. When the user replies, the existing webhook (`/api/ify/webhook`)
routes them to the bot as the same persona — and if a human takes over, the bot stays out (see below).

So the triggers should **replace the `wa.me/?text=` step** with a call to `sendOutreach`. Everything
about *when* to fire and *who* to fire at stays exactly as Claude Code built it.

## Template variables — order matters

Business-initiated WhatsApp messages must use **pre-approved templates**. Register these in Meta with
copy that mirrors `OUTREACH_MESSAGES`, using `{{1}}`, `{{2}}`… in this order:

| Trigger | Template name (config) | `{{1}}` | `{{2}}` | `{{3}}` |
|---|---|---|---|---|
| day1 | `nitro_day1_nudge` | first name | — | — |
| day3 | `nitro_day3_howto` | first name | — | — |
| day7 | `nitro_day7_last` | first name | — | — |
| firstDeposit | `nitro_first_deposit` | first name | deposit amount | bonus |
| firstOrder | `nitro_first_order` | first name | service name | — |
| winback | `nitro_winback` | first name | promo credit | — |

Template names are overridable via env (`IFY_TPL_*`). Match these names when you create them, or set
the env to whatever you named them.

## ⚠️ Compliance & ban-risk — read before enabling the nudges

- **first_deposit / first_order** are transactional — defensible as **utility** templates, low risk.
- **day1 / day3 / day7 / winback** are promotional — they must be **marketing** templates, and
  WhatsApp expects the user to have **opted in** to marketing on WhatsApp. Blasting marketing to
  people who only gave a phone at signup is the fastest way to get the number **flagged or banned**.
  - Get a clear WhatsApp opt-in at signup, or keep Day1/3/7 on **email** and use WhatsApp only for
    the transactional ones.
  - Marketing templates also cost more per send (≈₦92 vs ≈₦11 for utility).
- Start with the allowlist (`IFY_ALLOWLIST`) and only your own numbers until templates are approved
  and the opt-in question is settled.

## AI ↔ human handoff (so the AI never talks over a person)

- On escalation, the chat is set to **`human` mode** for 12h (`IFY_HUMAN_TTL`); the bot ignores
  inbound while a person handles it.
- A fresh outbound (`sendOutreach`) resets it to **`ai` mode**.
- The bot also suggests a human automatically after **`IFY_MAX_AI_TURNS`** (default 3) unresolved
  replies (the spec's "2–3 back-and-forth" rule).
- To hand back to the bot manually, clear the `ify:mode:<phone>` key (a small admin command/button
  can do this later).

## Answers to the three open questions

1. **Which WhatsApp API?** Meta **Cloud API direct** — no BSP markup, and it's what we're already
   setting up. (A BSP like 360dialog only earns its keep at high volume or for a shared team inbox.)
2. **Which number to send from?** A **dedicated new number** for the bot — not your main support
   line, since a number on the Cloud API can't also be used in the WhatsApp Business app.
3. **Template approval?** Yes, required for all six. Submit them in Meta's WhatsApp Manager with the
   variable order above; approval is usually quick for utility, stricter for marketing.

## Persona note

The strategy docs name the bot **Ify**; the live templates are signed **Ify**. Pick one and set
`IFY_PERSONA` — the reply layer uses it everywhere. The internal code namespace stays `lib/ify/`
regardless (customers never see it).

## Reconcile before go-live (in `knowledge.js`)

- Minimum order price: spec "from ₦1,000" vs Source of Truth "orders from ₦50–100, min deposit ₦500".
- Platform count: spec "25+" vs Source of Truth "30 platforms / 190 services".
- Refill: spec "Standard & Premium" vs Source of Truth "Premium auto-refill".
