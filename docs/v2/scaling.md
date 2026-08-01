# Scaling prep: 3.6k to 5k users

Audit date: July 2026. Current user count ~3,600.

## 1. Connection pool — `connection_limit=10` (critical)

15 cron jobs share 10 pooled connections with user traffic. Three crons fire every 5 minutes simultaneously. At 5k users with more concurrent requests, connection contention will cause query queuing and cron timeouts.

**Fix:** Bump `connection_limit` in `DATABASE_URL` to 20-25. Neon paid plan supports it. One env var change, no code change.

**Where:** `.env` — the `DATABASE_URL` query string parameter.

## 2. Drip cron frequency — every 20 min (high)

Current schedule: `:05, :25, :45` (3x/hour). Due batch limit is `take: 200`, so max throughput is 600 dispatches/hour. As drip order volume grows, batches pile up waiting for the next tick, causing delivery lag.

**Fix:** Increase to every 10 min: `5,15,25,35,45,55 * * * *`. Doubles throughput with no code change.

**Where:** `vercel.json` — the `/api/cron/drip` schedule.

## 3. Orders cron batch ceiling (medium)

Checks `take: 200` active orders every 5 min. Each order requires a provider API call (200-500ms). 200 orders can take 40-100s, which is near or past the 60s `maxDuration`. If execution consistently hits 60s, the queue won't clear.

**Fix:** Monitor execution time first. If hitting the ceiling, reduce `take` and rely on 5-min cadence, or split into parallel provider batches.

**Where:** `app/api/cron/orders/route.js`

## 4. No statement timeouts on heavy crons (medium)

Only `cohort-stats` sets a PostgreSQL statement timeout. If orders or drip cron hits a slow query (table scan, lock wait), it holds a connection for the full 60s, starving other jobs.

**Fix:** Add `SET LOCAL statement_timeout = '50s'` inside transactional queries in the orders and drip cron routes.

**Where:** `app/api/cron/orders/route.js`, `app/api/cron/drip/route.js`

## 5. No Prisma pool observability (low)

Prisma inherits `connection_limit=10` from the URL with no logging. Pool exhaustion shows up as opaque timeouts.

**Fix:** Add `log: ['warn']` to the PrismaClient constructor in production so pool warnings surface before outages.

**Where:** `lib/prisma.js`

## Current cron inventory

| Route | Schedule | Batch limit | maxDuration |
|---|---|---|---|
| `/api/cron/orders` | `*/5 * * * *` | 200 | 60 |
| `/api/cron/payments` | `*/5 * * * *` | 4 concurrency | 60 |
| `/api/cron/promotions` | `*/5 * * * *` | -- | 60 |
| `/api/cron/drip` | `5,25,45 * * * *` | 200 | 60 |
| `/api/cron/heartbeat` | `*/15 * * * *` | 1,000 | 30 |
| `/api/cron/balance` | `*/30 * * * *` | -- | 60 |
| `/api/cron/daily` | `0 9 * * *` | 50 | 60 |
| `/api/cron/refill` | `0 6 * * *` | 100 | 60 |
| `/api/cron/cleanup` | `0 3 * * *` | 100 | 60 |
| `/api/cron/digest` | `0 5,11,17 * * *` | -- | 60 |
| `/api/cron/digest-eod` | `59 22 * * *` | -- | 60 |
| `/api/cron/fx` | `0 */6 * * *` | -- | 60 |
| `/api/cron/prices` | `0 */6 * * *` | 50 | 60 |
| `/api/cron/sync-services` | `0,30 1-4 * * 0,3` | 200 | 60 |
| `/api/cron/cohort-stats` | `0 1 * * *` | -- | 60 |

## Priority order

1. Bump connection_limit to 20-25 (5-minute fix, biggest impact)
2. Increase drip cron to every 10 min (vercel.json change)
3. Monitor orders cron execution time
4. Add statement timeouts to orders + drip crons
5. Add Prisma pool warning logs
