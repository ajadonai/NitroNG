# Nitro Travel eSIM — Scope

**Status:** Scoped 17 Oct 2026 · parked · not for build until the provider approves the partner account
**Owner:** Adonai (Trip)
**Mockup:** `docs/v2/mockups/esim_internal.html` (also claude.ai/artifact/WjgVxots3pUHtL1eqxWtaC)
**Research:** "Beyond the Panel", 14 Sep 2026 (claude.ai/artifact/C5kwmu2zp9EPTuLeqYuuKr), row 4 of the adjacent-products build order

---

## What it is

Data abroad, bought in naira from the Nitro wallet before the flight, delivered as a QR code. A Nigerian flying to London or Dubai lands with no data and no way to buy a local SIM without a dollar card; this is exactly the shape of thing Nitro already sells. The prestige product of the adjacent set, not the volume one.

## Hard lines

- **Travel only, never a Nigerian line.** Every SIM in Nigeria, physical or embedded, must be registered against a NIN since 2021, and issuing local lines needs an operator or MVNO partner under NCC rules. A foreign-destination eSIM belongs to a carrier abroad and sits outside all of that. The catalogue never lists Nigeria.
- **No virtual dollar cards** to close any gap around it. A different, regulated business.

## Decisions (Trip, 17 Oct 2026)

1. **Provider: Airalo Partner API.** Trip has applied and is waiting on approval. eSIM Go is the wholesale alternative if Airalo stalls.
2. **Pricing.** Shown in naira at that day's rate, rounded to the nearest ₦100, and fixed at checkout. Markup within the usual 15 to 30 percent reseller range; the starting figure is set in the brief.
3. **Where it lives.** Under **Tools** in the sidebar and the phone's More sheet, beside Mass order and Bulk order (see the Tools entry on the shelf). Also a **card on the dashboard home**, and a **public /esim page** for search. Neither the home card nor /esim is mocked yet.
4. **Refunds.** To the wallet, only for an eSIM that was never installed, within 30 days of buying.

## The page, as mocked

- **Shop.** A dark night-flight card asks "Where are you going?" with one search and the destinations Nigerians fly to most (UK, UAE, US, Canada, Ghana, Saudi Arabia) plus regional plans (Europe). Plans are data and days, priced in naira with the price per GB, as printed tickets with one "Most picked" stamp. The receipt says what you are buying in a sentence and pays from the wallet with the shared gold button, or offers to top up the difference.
- **After paying.** A sheet with the QR, one-tap install on iPhone, iPhone and Android steps, the SM-DP+ address and activation code to copy, and a copy by email. It says the days start when the eSIM first connects at the destination, so nobody burns a plan by installing early.
- **My eSIMs.** Data used, days left, Top up, the ones not yet installed (Install, Refund), and expired ones (Buy again).
- **On the page.** How it works in three steps; check your phone first (dial `*#06#`, look for an EID; phone must be unlocked); the travel-only stamp; four questions (your Nigerian number keeps working, when the days start, top-ups, phones without eSIM).

## Before building

- An engineering brief on `docs/CLAUDE_CODE_BRIEF_TEMPLATE.md`, approved before code.
- The provider's real catalogue, networks and prices; the mockup's are examples.
- Data model: destinations, packages, orders, installs, usage and top-ups, and the provider's webhooks.
- Failure paths: the provider refuses or times out after the wallet is charged (refund, the same retry-then-refund rule orders use).
- Delivery email: copy goes to Email Copy.md first, and a call on Airalo's white-label template versus our own.
- Mock the home card and /esim.
