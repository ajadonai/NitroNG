# Outreach volume and the Backlog touch

How daily outreach volume is decided, and why the Backlog touch exists.
Current as of 19 Aug 2026.

## The daily budget

Volume is a single shared budget, not a per-touch quota.

| Constant | Value | Meaning |
| --- | --- | --- |
| `DAILY_BUDGET` | 150 | Total contacts handed to staff per day |
| `TOUCH_CAP` | see below | Per-touch ceiling |
| `MAX_RUN` | 90 | Ceiling on a single run |

All three live in `app/api/cron/outreach-lists/route.js`. `TOUCH_CAP` is:

| Touch | Cap |
| --- | --- |
| First Call | 50 |
| Follow-up | 35 |
| Final Nudge | 30 |
| Winback | 20 |

The caps sum to 135, which **must** stay below `DAILY_BUDGET`: only Backlog is
budget-aware, so an over-subscribed set of caps overspends the day and leaves
Backlog nothing. **Backlog runs last and claims whatever they left unspent** —
never less than 15, and considerably more on a day when Winback is empty or
Final Nudge is thin. It counts what has already been stamped
today and takes the remainder, capped by `MAX_RUN`.

The caps taper deliberately. The sequence is a pipeline: call 50 new people today
and those same 50 need a follow-up three days later, then a final nudge four days
after that. Capping a downstream touch below the one feeding it guarantees a queue
that only grows, so each step sits just below its predecessor, matching attrition
as people deposit, opt out or turn out to be wrong numbers.

First Call is highest because it is the only touch with an expiry. Miss the 1–4
day window and the lead leaves First Call permanently. Since Backlog is precisely
the accumulation of everyone who missed that window, headroom here is the only
thing that stops Backlog growing. It also cannot run away with the budget: its
pool is bounded by whoever signed up in a four-day window, which at ~80 signups a
day and roughly a third eligible is ~28.

This is the whole point of the design. Under fixed per-touch quotas, a day with
only 15 new signups threw away the other 15 First Call slots while thousands sat
untouched in Backlog. Now that spare capacity drains old leads instead.

`MAX_RUN` exists because `tgOutreach` sleeps 3s per contact for Telegram's
per-group rate limit. At 90 contacts that is 270s against a `maxDuration` of 300.
Do not raise it without also raising `maxDuration`.

Two Backlog runs are scheduled precisely because one cannot exceed `MAX_RUN`.
Together they can absorb the full remainder of the budget.

## Schedule

Staff work **Tue–Sat, 09:00–18:00 WAT**, with a break from 13:00–14:00. Vercel
crons are UTC, and WAT is UTC+1, so every schedule below reads one hour earlier
in `vercel.json`.

| WAT | Touch | UTC |
| --- | --- | --- |
| 07:00 | Recycle (no cards sent) | `0 6 * * 2-6` |
| 09:00 | First Call | `0 8 * * 2-6` |
| 11:00 | Winback | `0 10 * * 2-6` |
| 12:00 | Follow-up | `0 11 * * 2-6` |
| 14:00 | Final Nudge | `0 13 * * 2-6` |
| 15:00 | Backlog #1 | `0 14 * * 2-6` |
| 16:00 | Backlog #2 | `0 15 * * 2-6` |

Winback sits at 11:00 WAT because the `daily` cron grants its credits at 09:00
UTC and the list is only eligible once they exist. Built any earlier it sees an
empty pool — which is exactly what happened on 19 Aug, when both ran at 09:00
UTC and the credits landed 60 seconds after the list went out.

Nothing fires between 13:00 and 14:00 WAT. The priority touches sit in the
morning block so both Backlog runs see the full picture of what was spent.

Tue–Sat, not Mon–Fri: Friday signups would otherwise wait until Monday. Sunday
and Monday are the days off.

## What Backlog is for

Two jobs, one permanent and one temporary.

**Weekend catch-up (permanent).** Saturday and Sunday signups have no touch of
their own, so Backlog picks them up first. This never goes away.

**Old lead drain (temporary).** Roughly 2,900 users who signed up before
16 Aug 2026 and were never contacted. `BACKLOG_CUTOFF` in the route defines that
boundary. Weekend signups always take priority; old leads fill what is left.

**Do not remove the Backlog cron when the old leads run out.** The weekend job is
permanent, and Backlog is also where the budget's spare capacity goes. Without it
that capacity is simply lost.

## Adjusting volume

Change `DAILY_BUDGET`. That is the only number that sets total daily load.

Sizing is throughput-based: about 2.7 minutes per contact blended across answered
and unanswered calls, against roughly 7 working hours once the break is removed.
One caller sustains ~150/day, which is where the budget sits. Headline
throughput reads higher than that, but only because unreachable numbers clear in
seconds — those are not conversations, so do not size the budget off them.

Raising a `TOUCH_CAP` entry shifts the mix toward that touch and away from
Backlog; it does not change the total. Keep the caps summing below
`DAILY_BUDGET`. Raising `MAX_RUN` above 90 risks a
timeout — see above.

## Recycling unworked contacts

A contact is stamped *before* its card is sent, so a run that dies partway cannot
message anyone twice. The cost is that a card nobody ever worked is
indistinguishable from one that was: the stamp records that it was handed out,
not that anything happened.

`app/api/cron/outreach-recycle` gives each of those exactly one more chance. A
stamp older than `GRACE_DAYS` with no outcome recorded against it is marked
`expired` and cleared, returning the contact to the pool. The `expired` row is
what prevents a second recycle — the query only picks up contacts with no row at
all.

Released First Call contacts land in **Backlog**, not First Call, because by then
they fail the 1–4 day signup window. That is intended: they are weeks old, and
Backlog is exactly "never successfully reached, any age."

It runs at 07:00 WAT, before the first drop, so released contacts are available
the same day.
