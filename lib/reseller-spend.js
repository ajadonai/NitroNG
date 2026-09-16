// What a reseller has actually spent, in the money the ladder is measured in.
//
// **Retail-equivalent**, always: what the orders would have cost at the site
// price, not the discounted charge that was taken. Counting the charge would
// mean a promoted reseller measures slower the better it does — earn 30% off
// and your spend drops 30%, so the rung you just climbed is harder to hold than
// it was to reach. That is a rule which looks fine on the day it ships and
// strands somebody three months later.
//
// Orders record the retail figure they were discounted from (`retailCharge`),
// so nothing has to be reconstructed. A null there means the charge already was
// retail — every non-reseller order, and every order placed before the ladder.
//
import prisma from '@/lib/prisma';
import { LAGOS } from '@/lib/report-window';

/** +1h all year; Nigeria has no DST. */
const LAGOS_OFFSET_MS = 60 * 60 * 1000;

/** The rolling window every threshold is judged over. */
export const ROLLING_DAYS = 30;

/**
 * Retail-equivalent spend per reseller over a window, plus lifetime.
 *
 * One query for both rather than two passes: the lifetime figure decides the
 * permanent seat and the rolling figure decides the rung, and a night where
 * those two disagree about which orders exist is a night somebody is demoted
 * and awarded a seat in the same breath.
 *
 * `deletedAt` and cancelled orders are excluded on both. A cancelled order was
 * refunded, and counting refunded money toward a discount threshold is how a
 * reseller buys a rung and gives the money back.
 */
export async function spendFor(userIds, { now = new Date() } = {}) {
  const out = new Map(userIds.map(id => [id, { rolling: 0, lifetime: 0 }]));
  if (!userIds.length) return out;

  const since = new Date(now.getTime() - ROLLING_DAYS * 86400000);
  const rows = await prisma.$queryRaw`
    SELECT o."userId",
           COALESCE(SUM(CASE WHEN o."createdAt" >= ${since}
                             THEN COALESCE(o."retailCharge", o.charge) ELSE 0 END), 0)::bigint AS rolling,
           COALESCE(SUM(COALESCE(o."retailCharge", o.charge)), 0)::bigint AS lifetime
    FROM orders o
    WHERE o."userId" = ANY(${userIds})
      AND o."deletedAt" IS NULL
      AND o.status NOT IN ('Cancelled')
    GROUP BY o."userId"`;

  for (const r of rows) {
    out.set(r.userId, { rolling: Number(r.rolling), lifetime: Number(r.lifetime) });
  }
  return out;
}

/**
 * Lagos calendar parts for an instant, read from Intl rather than derived.
 *
 * `new Date(d.toLocaleString('en-US', { timeZone }))` looks like it does this
 * and does not: it formats in Lagos, then reparses the result in the server's
 * zone, so the answer is right only where the two agree. It shipped here first
 * and made isMonthEnd say no on 30 September.
 */
function lagosParts(at) {
  const p = new Intl.DateTimeFormat('en-US', {
    timeZone: LAGOS, year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(at).reduce((o, x) => (o[x.type] = x.value, o), {});
  return { year: +p.year, month: +p.month, day: +p.day };
}

/**
 * When a newly granted reseller is first judged: the end of their first FULL
 * Lagos calendar month.
 *
 * Granted on the 17th, the rest of that month is not a month — so the clock is
 * the whole of the following one, and the first assessment is its last day.
 * Granted on the 1st it is the same rule and simply feels less generous, which
 * is the price of a rule a reseller can repeat back without a calendar.
 *
 * Returns the exclusive instant the window closes: 00:00 Lagos on the 1st after.
 */
export function firstMonthEnd(grantedAt = new Date()) {
  const { year, month } = lagosParts(grantedAt);
  // month is 1-12; +2 months as a 1-based index is the 1st after the next full one.
  return new Date(Date.UTC(year, month + 1, 1) - LAGOS_OFFSET_MS);
}

/** Is `at` inside the last Lagos day of its calendar month? Demotions land here. */
export function isMonthEnd(at = new Date()) {
  const today = lagosParts(at);
  const tomorrow = lagosParts(new Date(at.getTime() + 86400000));
  return today.month !== tomorrow.month;
}
