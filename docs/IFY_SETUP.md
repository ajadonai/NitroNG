# Ify — Setup Runbook (Lean v1)

Ify is Nitro's WhatsApp customer-support bot. This lean version **answers support questions**
grounded in your real policies and **hands off to a human** for anything account-specific, money-related,
or off-script. No orders, refills, or payments — that's a later phase.

> ⚠️ **Refresh the code first.** Your `NitroNG` snapshot was last refreshed **15 June 2026**. Before wiring
> this in, pull the latest in your **Nitro Code** chat so file paths, the `User`/`Ticket` models, and
> `lib/telegram.js` match your live app. This kit was written against the June snapshot.

---

## 0. What you're installing

A thin webhook + a small `lib/ify/` module. One cheap LLM call per message. Reuses what you already run:
Postgres/Prisma, Upstash Redis, Telegram alerts, and (later) your tickets UI.

**Cost:** inbound WhatsApp support is free (Meta's 24h service window); you only pay LLM tokens,
~US$0.002–0.005 per conversation. See `Nitro Ify Costing & Tools.md`.

---

## 0.5 Before you start — what actually gates go-live

**⏳ Business verification takes ~3–10 business days.** Start it today; it's the long pole. Meta requires a
verified business — upload your **CAC certificate** and **CAC status report** (in `Legal Docs/`).

**⚠️ Decide the phone number FIRST — this is the one that bites.**
A number already registered on the WhatsApp app or WhatsApp Business app **cannot** be used on the Cloud API
unless you delete it from that app first. If you migrate your current support line, **your team can no longer
reply from the WhatsApp Business app** — which breaks the human-takeover flow in this version.

Recommended for the test:
- Use a **new dedicated number** for Ify. Keep the existing support line human-only.
- For the first smoke test, use Meta's **free test number** — instant, no verification, but limited to
  **5 allowlisted recipients**. That fits the soft-launch plan exactly.
- Registering a number also needs a **display name** and a **two-step verification PIN**.

**Access token:** production requires a **permanent token** via a **System User**
(Business Settings → System users → assign the app + WhatsApp account → Generate token).
The temporary token expires in ~24h — fine for a first poke, not for the test.

**How a human replies during the test:** the Telegram escalation alert includes a `wa.me` link — a teammate
taps it and replies from your main support line. The customer sees a reply from a different number: a small
seam, acceptable for a test. A shared agent inbox is the clean long-term fix.

## 0.6 Order of operations

**Track A — Meta (start now; this is the blocker)**
1. Meta Business Manager → **business verification** (CAC docs).
2. Create a Business-type Meta App → add the **WhatsApp** product.
3. Pick + register the number (display name + 2-step PIN).
4. Create a **System User** → assign app + WhatsApp account → generate the **permanent token**.
5. Note the **App Secret** and **Phone Number ID**.

**Track B — Code (in parallel, ~1 hour)**
6. Refresh the `NitroNG` clone, copy the files in (§1), add the Prisma model + migrate (§2).
7. Get an LLM API key and set a billing cap.
8. Set env vars in Vercel with **`IFY_ENABLED=false`** so nothing fires early.

**Track C — Connect (once A + B are done)**
9. Deploy — the webhook URL must be live *before* Meta can verify it.
10. In Meta: set the callback URL + verify token → **Verify and Save** → subscribe to **`messages`**.
11. Set `IFY_ALLOWLIST` to your own number, flip `IFY_ENABLED=true`, and run the tests in §6.
12. Happy? Clear the allowlist to go wide.

---

## 1. Copy the files in

Drop these into `Development/NitroNG/` at the matching paths:

```
lib/ify/config.js
lib/ify/whatsapp.js
lib/ify/identity.js
lib/ify/store.js
lib/ify/knowledge.js
lib/ify/prompt.js
lib/ify/brain.js
lib/ify/escalate.js
lib/ify/handle.js
app/api/ify/webhook/route.js
```

They use your existing aliases (`@/lib/prisma`, `@/lib/logger`) and libraries — no new npm packages required.

---

## 2. Add the database table

Paste the model from `prisma/ify-models.prisma` into `prisma/schema.prisma`, then:

```bash
npx prisma migrate dev --name ify_messages   # or: npx prisma db push
```

This adds `ify_messages` (the log of every exchange). Nothing else in your schema changes.

---

## 3. Set environment variables

Copy what you need from `.env.ify.example` into `.env` and your Vercel project.
Ify reuses your existing `DATABASE_URL`, `UPSTASH_REDIS_REST_URL/TOKEN`, `TG_BOT_TOKEN`, `TG_CHAT_ID`.

New ones you must set: `WHATSAPP_*`, `OPENAI_API_KEY`, and (recommended) `IFY_ALLOWLIST` for the test.

---

## 4. Meta / WhatsApp Cloud API setup

1. In **developers.facebook.com** → your Business app → add the **WhatsApp** product.
2. **API Setup:** note the **Phone number ID** → `WHATSAPP_PHONE_NUMBER_ID`. Use a test number to start,
   or register your real support line.
3. **Access token:** create a **System User** with a permanent token (Business Settings → Users → System users),
   grant it the WhatsApp asset → `WHATSAPP_TOKEN`. (The temporary 24h token works for a first test.)
4. **App secret:** App → Settings → Basic → **App Secret** → `WHATSAPP_APP_SECRET`.
5. **Configure the webhook:**
   - Callback URL: `https://nitro.ng/api/ify/webhook`
   - Verify token: the same random string you set as `WHATSAPP_VERIFY_TOKEN`.
   - Click **Verify and Save** (this hits the `GET` handler).
   - **Subscribe** the webhook to the **`messages`** field.

---

## 5. Deploy

Deploy to Vercel as usual. Confirm the route is live:

```bash
curl "https://nitro.ng/api/ify/webhook?hub.mode=subscribe&hub.verify_token=YOUR_VERIFY_TOKEN&hub.challenge=1234"
# → 1234
```

---

## 6. Test safely (soft launch)

1. Set `IFY_ALLOWLIST` to **your own number(s)** — only they get replies; everyone else is ignored.
2. Message the WhatsApp number and try:
   - "How do I place an order?" → should **answer**.
   - "What's the difference between Budget and Premium?" → should **answer**.
   - "Where is my order?" / "My deposit didn't show" → should **escalate** (you get a Telegram ping; the customer is told a teammate will reply).
3. Watch: the **Telegram** alerts, the **`ify_messages`** table (every exchange, with `action`), and Sentry.
4. Tune `lib/ify/knowledge.js` and `lib/ify/prompt.js` until the answers and the escalate-line feel right.

When happy: **clear `IFY_ALLOWLIST`** to go wide.

---

## 7. Running it day-to-day

- **Kill switch:** set `IFY_ENABLED=false` to mute instantly (no code change).
- **Human takeover:** on escalation Ify pings Telegram, opens a ticket (for known users), tells the
  customer a teammate will reply, and **goes quiet on that chat for 30 min** (`IFY_HANDOFF_PAUSE`) so it
  doesn't talk over you. Reply to the customer from your WhatsApp as normal. The pause auto-expires.
- **Non-users:** answered up to `IFY_RL_NONUSER`/day, then ignored — protects your API bill.

---

## 8. Guardrails (built in)

- Answers **only** from the knowledge base; unknown/unsure → escalate.
- Never says "guaranteed"; never invents policy or numbers.
- **Takes no actions** — no orders, refills, deposits, refunds, or account changes.
- Never asks for passwords/OTP.
- Signature-verified inbound; de-duped; rate-limited; kill-switchable.

---

## 9. What's next (not in v1)

Order-status lookups, refills/speed-ups, deposit verification, and the money guardrails — plus
email+password login and the transaction-PIN / email-OTP step-up — are Phase 2+. See
`Nitro Ify Architecture.md`. Ship this, watch `ify_messages` to learn what people actually ask,
and let that shape what we automate next.
