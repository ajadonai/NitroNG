# Outreach volume and the Backlog touch

How daily outreach volume is decided, and why the Backlog touch exists.
Current as of 19 Aug 2026.

## The daily budget

Volume is a single shared budget, not a per-touch quota.

| Constant | Value | Meaning |
| --- | --- | --- |
| `DAILY_BUDGET` | 200 | Total contacts handed to staff per day |
| `BATCH_SIZE` | 30 | Cap for each of the four priority touches |
| `MAX_RUN` | 90 | Ceiling on a single run |

All three live in `app/api/cron/outreach-lists/route.js`.

The four priority touches — First Call, Winback, Follow-up, Final Nudge — take
up to `BATCH_SIZE` each, so at most 120. **Backlog runs last and claims whatever
they left unspent.** It counts what has already been stamped today and takes the
remainder, capped by `MAX_RUN`.

This is the whole point of the design. Under fixed per-touch quotas, a day with
only 15 new signups threw away the other 15 First Call slots while thousands sat
untouched in Backlog. Now that spare capacity drains old leads instead.

`MAX_RUN` exists because `tgOutreach` sleeps 3s per contact for Telegram's
per-group rate limit. At 90 contacts that is 270s against a `maxDuration` of 300.
Do not raise it without also raising `maxDuration`.

Two Backlog runs are scheduled precisely because one cannot exceed `MAX_RUN`.
Together they can absorb the full remainder of a 200 budget.

## Schedule

Staff work **Tue–Sat, 09:00–18:00 WAT**, with a break from 13:00–14:00. Vercel
crons are UTC, and WAT is UTC+1, so every schedule below reads one hour earlier
in `vercel.json`.

| WAT | Touch | UTC |
| --- | --- | --- |
| 07:00 | Recycle (no cards sent) | `0 6 * * 2-6` |
| 09:00 | First Call | `0 8 * * 2-6` |
| 10:00 | Winback | `0 9 * * 2-6` |
| 11:00 | Follow-up | `0 10 * * 2-6` |
| 12:00 | Final Nudge | `0 11 * * 2-6` |
| 14:00 | Backlog #1 | `0 13 * * 2-6` |
| 16:00 | Backlog #2 | `0 15 * * 2-6` |

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
One caller sustains ~150/day. The 200 figure assumes some headroom from calls
that fail fast.

Raising `BATCH_SIZE` shifts the mix toward the priority touches and away from
Backlog; it does not change the total. Raising `MAX_RUN` above 90 risks a
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
