import prisma from '@/lib/prisma';
import { log } from '@/lib/logger';
import { requireAdmin } from '@/lib/admin';

/**
 * Where deposits actually stop, split by the one thing that was missing.
 *
 * Deliberately NOT under /api/cron/cohort-stats. That path is protected — its
 * robots.txt allowance and its token behaviour are load-bearing for the nightly
 * check — and a new subroute there would be changing a protected surface to
 * answer an unrelated question. This is an admin read behind requireAdmin.
 *
 * Four buckets, and the two middle ones are the entire point:
 *
 *   funded           finished and credited
 *   left_at_gateway  handed off, never came back — a pricing, trust or method
 *                    question, and a product decision
 *   never_arrived    initiated with no handoff recorded — the tab closed before
 *                    the gateway page loaded, which is a slow or broken handoff
 *                    and ours to fix in a day
 *   failed           the provider actually declined, which is 0.9% of the whole
 *                    and was never the problem
 *
 * Rows created before the beacon shipped carry no handoff and would all read as
 * never_arrived, so `since` defaults to the day it went in rather than quietly
 * mixing them. Read a fortnight before changing anything: the ₦3.25M of "failed
 * attempts" quoted on 11 Sep turned out to be abandonment rather than failure,
 * which is exactly the mistake that reading first avoids.
 */
const BEACON_LIVE = '2026-09-16T00:00:00Z';

export async function GET(req) {
  const { error } = await requireAdmin('payments');
  if (error) return error;

  try {
    const url = new URL(req.url);
    const since = new Date(url.searchParams.get('since') || BEACON_LIVE);
    const where = { type: 'deposit', method: { notIn: ['manual', 'crypto'] }, createdAt: { gte: since } };

    const [total, funded, handedOff, fundedWithHandoff, failed] = await Promise.all([
      prisma.transaction.count({ where }),
      prisma.transaction.count({ where: { ...where, status: 'Completed' } }),
      prisma.transaction.count({ where: { ...where, gatewayHandoffAt: { not: null } } }),
      prisma.transaction.count({ where: { ...where, status: 'Completed', gatewayHandoffAt: { not: null } } }),
      prisma.transaction.count({ where: { ...where, status: 'Failed' } }),
    ]);

    const leftAtGateway = Math.max(0, handedOff - fundedWithHandoff);
    const neverArrived = Math.max(0, total - handedOff - (funded - fundedWithHandoff));
    const pct = (n) => (total ? Math.round((n / total) * 1000) / 10 : 0);

    return Response.json({
      since: since.toISOString(),
      beaconLiveFrom: BEACON_LIVE,
      total,
      funded: { count: funded, pct: pct(funded) },
      left_at_gateway: { count: leftAtGateway, pct: pct(leftAtGateway) },
      never_arrived: { count: neverArrived, pct: pct(neverArrived) },
      failed: { count: failed, pct: pct(failed) },
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    log.error('Checkout funnel', err.message);
    return Response.json({ error: 'Failed to load funnel' }, { status: 500 });
  }
}
