# Ify Promises — Open Commitments Queue

Tracks every follow-up promise made to a customer via WhatsApp. A promise cannot
be silently closed — resolution requires a customer-facing message, and "still
chasing" closures automatically spawn a successor promise.

## How promises are created

### Automatic (by Ify)

When Ify replies to a customer, the outgoing message is passed to the LLM for
promise detection. If the reply contains a follow-up commitment ("I'll check and
get back to you"), an `ify_promises` row is created with the appropriate category
and due time.

### On escalation

Every escalation to a human automatically creates a promise with
`category=escalation` and a 2-hour acknowledgment window. This ensures no
handoff is silently dropped.

## States

```
open → due_soon → overdue → escalated
                ↘ resolved
```

- **open** — promise created, not yet near due
- **due_soon** — within 30 minutes of dueAt (crew notified via Telegram)
- **overdue** — past dueAt (crew notified again)
- **escalated** — overdue > 1 hour with no update (admin/supervisor notified)
- **resolved** — customer-facing update sent, issue closed or successor created

## Due windows (defaults)

| Category | Window |
|---|---|
| order_status | 1 hour |
| provider_chase | End of day |
| refill | End of day |
| payment | End of day |
| refund_routing | End of day |
| escalation | 2 hours (acknowledge) |
| other | 4 hours |

Night rule: anything due between 22:00–09:00 Lagos time pushes to 09:00.

## Resolving a promise

```
PATCH /api/promises?token=CRON_SECRET
{
  "id": "promise_id",
  "action": "resolve",
  "author": "Agent Name",
  "messageSent": "Hi Chioma, your order is now complete — 1,000 followers delivered.",
  "note": "Confirmed with provider, order fully delivered."
}
```

**Core rule:** `messageSent` is required (or a prior update must have one). The
API returns 422 if no customer-facing message exists.

If the resolution message implies continuation ("still chasing, will update
again"), a successor promise is created automatically with a fresh dueAt.

## Adding an update (without resolving)

```
PATCH /api/promises?token=CRON_SECRET
{
  "id": "promise_id",
  "action": "update",
  "author": "Agent Name",
  "messageSent": "Still waiting on the provider, will have an answer within 2 hours.",
  "note": "Provider ticket #4521 opened."
}
```

## Assigning an owner

```
PATCH /api/promises?token=CRON_SECRET
{
  "id": "promise_id",
  "action": "assign",
  "owner": "Agent Name"
}
```

## Listing promises

```
GET /api/promises?token=CRON_SECRET          # all non-resolved
GET /api/promises?token=CRON_SECRET&state=overdue  # filter by state
```

## Tick (scheduled job)

```
GET /api/promises/tick?token=CRON_SECRET
```

Runs every 15 minutes via an external scheduler (QStash, cron-job.org, or GitHub
Actions). On each tick:

1. Flips `open` → `due_soon` (30 min before dueAt)
2. Flips `due_soon`/`open` → `overdue` (past dueAt)
3. Flips `overdue` → `escalated` (1 hour past with no update)
4. Sends Telegram notifications for each state transition
5. Sends a daily digest at 09:00 Lagos time
6. Refreshes the Google Sheet mirror

## Metrics

```
GET /api/promises/metrics?token=CRON_SECRET
```

Returns 30-day stats: kept on time rate, average time to first update, overdue
count by owner, promises by category.

## Google Sheet mirror

Read-only mirror refreshed on each tick. Two tabs:

- **Active** — all non-resolved promises ordered by dueAt
- **Resolved** — last 30 days of resolved promises

Set up:
1. Create a Google Cloud service account
2. Share a Google Sheet with the service account email
3. Set `IFY_PROMISE_SHEET_ID` to the spreadsheet ID
4. Set `IFY_PROMISE_SHEET_SA_KEY` to the base64-encoded service account JSON

Apply conditional formatting manually: overdue rows red, due_soon rows amber.

## Env vars

| Variable | Required | Default | Description |
|---|---|---|---|
| `IFY_PROMISES_ENABLED` | No | `true` | Kill switch |
| `IFY_PROMISE_SOON_MIN` | No | `30` | Minutes before due to flip to due_soon |
| `IFY_PROMISE_ESC_MIN` | No | `60` | Minutes overdue before escalating |
| `IFY_PROMISE_SHEET_ID` | No | — | Google Sheet spreadsheet ID |
| `IFY_PROMISE_SHEET_SA_KEY` | No | — | Base64 service account JSON |

## Seed data

```bash
node scripts/seed-promises.mjs
```

Creates 6 realistic promises across all states for development.
