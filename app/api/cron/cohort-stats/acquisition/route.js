export const maxDuration = 30;

import prisma from '@/lib/prisma';
import { log } from '@/lib/logger';
import { getBearerToken } from '@/lib/bearer-token';
import { watBounds } from '@/lib/format';

/**
 * The acquisition denominator, read straight from the rows.
 *
 * The 9am ads check has no database access, so to answer "what does one new
 * customer cost" it multiplied Meta's attributed order count by a hand-derived
 * factor — 1.16, then 1.47, then 1.05 — and each was wrong in its own direction
 * because each estimated a number the database already knew. This returns the
 * number: first-ever orders per Lagos day, signups per Lagos day, and the
 * signup→buyer rate by signup week, for any range.
 *
 *   GET /api/cron/cohort-stats/acquisition?since=YYYY-MM-DD&until=YYYY-MM-DD
 *       [&token=ANALYTICS_READ_TOKEN] [&pretty]
 *
 * It lives UNDER the protected cohort-stats path on purpose: robots.txt allows
 * that prefix, so the scheduled task's fetcher may read it, and neither
 * robots.txt nor the cohort route itself is touched. Auth is the same as the
 * cohort reader: ANALYTICS_READ_TOKEN as Bearer or query, or CRON_SECRET as
 * Bearer only.
 *
 * Definitions, because getting them wrong has cost money before:
 *  - new_customers on a day = users whose FIRST order in all of history falls on
 *    that Lagos day, any status. Not first order in the window — that inflates
 *    the count and flatters acquisition cost.
 *  - signups on a day = accounts created that Lagos day and not since deleted,
 *    the cohort route's own definition.
 *  - cohorts are signup weeks (Monday start, Lagos). A 7- or 30-day rate is
 *    right-censored until the whole week has aged that long; matured_7d /
 *    matured_30d say which figures are final.
 *  - scope is the whole account. Spend from a single ad set must not be
 *    divided by these; that mix produced a ₦2,150 estimate against a real
 *    ₦1,780 on 13 Sep 2026.
 */

const NO_CACHE = {
  'Cache-Control': 'no-store, no-cache, must-revalidate',
  'CDN-Cache-Control': 'no-store',
  'Vercel-CDN-Cache-Control': 'no-store',
};
const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_SPAN_DAYS = 400;
const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

function isAuthorised(req) {
  const bearer = getBearerToken(req);
  const query = new URL(req.url).searchParams.get('token') || null;
  const read = process.env.ANALYTICS_READ_TOKEN;
  const cron = process.env.CRON_SECRET;
  if (read && (bearer === read || query === read)) return true;
  if (cron && bearer === cron) return true;
  return false;
}

/** A YYYY-MM-DD string as the UTC-midnight Date the SQL casts to that date. */
function dayToDate(day) {
  if (!ISO_DAY.test(day)) return null;
  const d = new Date(`${day}T00:00:00Z`);
  return Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === day ? d : null;
}
const dateToDay = (d) => d.toISOString().slice(0, 10);

export async function GET(req) {
  if (!isAuthorised(req)) return Response.json({ error: 'Unauthorized' }, { status: 401, headers: NO_CACHE });

  const params = new URL(req.url).searchParams;
  // Default: the last 30 Lagos days, today included.
  const lagosToday = new Date(watBounds().todayStart.getTime() + 60 * 60 * 1000);
  const until = params.get('until') ? dayToDate(params.get('until')) : dayToDate(dateToDay(lagosToday));
  const since = params.get('since') ? dayToDate(params.get('since')) : (until && new Date(until.getTime() - 29 * DAY_MS));
  if (!since || !until) return Response.json({ error: 'since and until must be YYYY-MM-DD' }, { status: 400, headers: NO_CACHE });
  if (since > until) return Response.json({ error: 'since must not be after until' }, { status: 400, headers: NO_CACHE });
  if ((until - since) / DAY_MS > MAX_SPAN_DAYS) return Response.json({ error: `range must be ${MAX_SPAN_DAYS} days or fewer` }, { status: 400, headers: NO_CACHE });

  try {
    const days = await prisma.$queryRaw`
      WITH days AS (
        SELECT generate_series(${since}::date, ${until}::date, interval '1 day')::date AS d
      ),
      firsts AS (
        SELECT (MIN(o."createdAt") + interval '1 hour')::date AS d
        FROM orders o
        WHERE o."deletedAt" IS NULL
        GROUP BY o."userId"
      ),
      new_customers AS (SELECT d, COUNT(*)::int AS n FROM firsts GROUP BY d),
      signups AS (
        SELECT (u."createdAt" + interval '1 hour')::date AS d, COUNT(*)::int AS n
        FROM users u
        WHERE u."deletedAt" IS NULL
          AND u."createdAt" >= ${since}::date - interval '1 day'
          AND u."createdAt" <  ${until}::date + interval '2 days'
        GROUP BY 1
      )
      SELECT to_char(days.d, 'YYYY-MM-DD') AS day,
             COALESCE(new_customers.n, 0)::int AS new_customers,
             COALESCE(signups.n, 0)::int AS signups
      FROM days
      LEFT JOIN new_customers ON new_customers.d = days.d
      LEFT JOIN signups ON signups.d = days.d
      ORDER BY days.d
    `;

    const cohorts = await prisma.$queryRaw`
      WITH u AS (
        SELECT id, "createdAt" + interval '1 hour' AS su
        FROM users
        WHERE "deletedAt" IS NULL
          AND "createdAt" + interval '1 hour' >= date_trunc('week', ${since}::date::timestamp)
          AND "createdAt" + interval '1 hour' <  ${until}::date + interval '1 day'
      ),
      f AS (
        SELECT "userId", MIN("createdAt") + interval '1 hour' AS fo
        FROM orders WHERE "deletedAt" IS NULL GROUP BY "userId"
      )
      SELECT to_char(date_trunc('week', u.su), 'YYYY-MM-DD') AS week_start,
             COUNT(*)::int AS signups,
             SUM(CASE WHEN f.fo < u.su + interval '7 days'  THEN 1 ELSE 0 END)::int AS bought_7d,
             SUM(CASE WHEN f.fo < u.su + interval '30 days' THEN 1 ELSE 0 END)::int AS bought_30d,
             BOOL_AND(u.su + interval '7 days'  <= now() + interval '1 hour') AS matured_7d,
             BOOL_AND(u.su + interval '30 days' <= now() + interval '1 hour') AS matured_30d
      FROM u LEFT JOIN f ON f."userId" = u.id
      GROUP BY 1 ORDER BY 1
    `;

    const pct = (n, d) => (d > 0 ? Math.round((n / d) * 1000) / 10 : null);
    const body = {
      generatedAt: new Date().toISOString(),
      scope: 'account',
      since: dateToDay(since),
      until: dateToDay(until),
      definitions: {
        new_customers: 'users whose first order in all of history fell on that Lagos day, any status',
        signups: 'accounts created that Lagos day and not since deleted',
        cohorts: 'signup weeks, Monday start, Lagos; a rate is final only when matured_* is true',
        scope: 'whole account — do not divide a single ad set’s spend by these',
      },
      days: days.map((r) => ({ day: r.day, new_customers: r.new_customers, signups: r.signups, ad_spend_attributable: null })),
      cohorts: cohorts.map((c) => ({
        week_start: c.week_start,
        signups: c.signups,
        bought_7d: c.bought_7d,
        rate_7d: pct(c.bought_7d, c.signups),
        matured_7d: c.matured_7d === true,
        bought_30d: c.bought_30d,
        rate_30d: pct(c.bought_30d, c.signups),
        matured_30d: c.matured_30d === true,
      })),
    };
    const json = params.has('pretty') ? JSON.stringify(body, null, 2) : JSON.stringify(body);
    return new Response(json, { status: 200, headers: { 'Content-Type': 'application/json', ...NO_CACHE } });
  } catch (err) {
    log.error('Acquisition Stats', err.message);
    return Response.json({ error: 'Query failed' }, { status: 500, headers: NO_CACHE });
  }
}
