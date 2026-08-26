# Reseller API — engineering brief

Status: approved and built — v2.3, commit `34177d29` (26 Aug 2026). The
"Out of scope for v1" list below is the follow-up backlog.

## What it is

`POST https://nitro.ng/api/v2`, form-encoded, the SMM-panel API convention every
reseller panel already speaks. The public docs page (`reseller-api-docs.jsx`)
has promised this contract for weeks; nothing answers at that URL yet, and
`ResellerServiceMap` has zero rows, so no service has a reseller ID to order by.

## Contract (as already documented)

| action | params | returns |
| --- | --- | --- |
| `services` | `key` | `[{ service, name, category, rate, min, max, refill, cancel }]` |
| `add` | `key, service, link, quantity` | `{ order }` |
| `status` | `key, order` | `{ charge, start_count, status, remains, currency }` |
| `status` (multi) | `key, orders=1,2,3` | `{ "1": {…}, "2": {…} }` |
| `refill` | `key, order` | `{ refill }` |
| `balance` | `key` | `{ balance, currency }` |
| `cancel` | `key, orders=1,2` | `[{ order, cancel }]` |

Errors follow the convention: HTTP 200 with `{ "error": "message" }`, so
third-party panels parse them. Auth failures are the exception: 401.

Status strings: `Pending`, `In progress`, `Completed`, `Partial`, `Canceled`,
`Processing` — mapped from Nitro's order statuses, never Nitro's internal words.
Money is NGN as a decimal string with two places; `rate` is per 1,000.

## Design decisions

**Auth.** `User.apiKey`: every verified account holds a key (minted on first
read in Settings, rotatable). Wholesale is a property of the account, not the
key: `getResellerTerms` returns null for retail accounts and `wholesaleOf`
returns retail untouched, so approval simply lowers the rates the same key
sees. Key in the body, never the query string. Unknown or unverified: 401.

**IDs.** `ResellerServiceMap.apiId` is the only ID a reseller ever sees. Minting:
a one-off backfill mints an ID for every service and tier a reseller can see
today; from then on the sync-services cron mints for anything it lists for
the first time, so a new service has its ID before any reseller can see it. Retired rows answer `{ error: "Service discontinued" }`, not 404.
Provider IDs and provider names never appear — the house rule.

**Pricing.** `wholesaleOf(retail, terms, settings)` — the same number the
catalogue shows. The API is a second door to the same shop, not a second shop.

**Curated vs full.** The key decides, not the URL. `getResellerTerms` already
returns `catalog: "curated" | "full"`; `services` returns exactly what that
reseller sees in their catalogue — curated tiers (priced on the tier) or the
full list (priced on the service). The map holds both shapes (`tierId` for
curated, `serviceId` for full), so one backfill mints both. An `add` with an ID
outside the key's catalogue answers `Incorrect service ID`, the error the docs
already list. Flipping a reseller to full in Reseller HQ changes nothing for
the API: the same key's next `services` call returns more, every curated ID
they already wired keeps answering. Flipping back makes the full-list IDs
unorderable for that key; order history and `status` still work. The
visibility check lives in the shared order function, so the web catalogue and
the API can never disagree.

**Placing an order.** The web route's `POST /api/orders` does validation,
pricing, atomic balance debit, order creation and provider placement in ~400
inline lines. Extract that into `lib/order-create.server.js` with one function,
`createOrderForUser({ userId, tierId | serviceId, link, quantity, source })`,
and have both routes call it. The API passes `source: "api"` so admin can filter.
No new order logic; one path, two doors.

**Rate limit.** Per key, 60 requests a minute via the existing Upstash limiter,
fail-open as elsewhere. `add` is additionally protected by the balance debit
being atomic, as it is on the web.

**Status.** Reads the order as the customer Orders page does; `remains` from the
last provider sync; `start_count` as stored. No provider call on read — the
existing cron keeps orders fresh.

## Out of scope for v1

Drip-feed and multi-day parameters, comment and mention services (they need
free text the API convention has no field for), webhooks, per-key IP allowlists.
Each is a clean follow-up once the base contract is live.

## Tests

- Contract tests for every action: happy path, unknown key, unknown service,
  discontinued service, insufficient balance, quantity out of range.
- One test that the web route and the API route place identical orders through
  the shared function.
- The existing `order-offer-snapshot` suite must stay green — `source` is a new
  field on the order, nothing else changes shape.

## Rollout

1. Backfill IDs (a script, reviewed, run once against production).
2. Ship the route behind the docs page's existing "Base URL".
3. Trip issues keys to the first two resellers who asked; watch admin orders
   for `source: api` for a week before announcing.

## Risks

- **A wrong ID is forever.** The map is append-only by design; the backfill
  script gets a dry run and a count check before it writes.
- **Panels retry.** `add` must be idempotent per (key, service, link, quantity)
  within a short window, or a flaky panel places the same order three times.
  The API answers a retry inside sixty seconds (same key, service, link and
  quantity) with the order it already placed, and never places again.
