import prisma from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';
import { ok, error } from '@/lib/utils';

/**
 * The moment a deposit was handed to the gateway.
 *
 * 60.0% of deposit initiations end funded. Netting the 58% who finish within
 * seven days, true leakage is about 16.6% — roughly ₦20k a day of deposits and
 * ₦13k of gross profit. Worth working, and impossible to work blind: the rows
 * say "initiated" and "finished" and nothing in between, so somebody who closed
 * the tab before the gateway page loaded is indistinguishable from somebody who
 * saw it and walked away.
 *
 * Those are different problems. The first is a slow or broken handoff and ours
 * to fix; the second is a pricing, trust or method question. One timestamp
 * separates them.
 *
 * Instrument, then read a fortnight, then change the flow. Redesigning a
 * checkout on a guess about where people leave moves the problem rather than
 * fixing it — and the ₦3.25M of "failed attempts" quoted on 11 Sep turned out
 * to be abandonment, not failure, which is exactly the mistake reading first
 * avoids. Real payment failure is 0.9%.
 *
 * Called through `navigator.sendBeacon`, so it has to answer a POST whose body
 * arrives as text rather than JSON and whose response nobody waits for.
 */
export async function POST(req) {
  try {
    const session = await getCurrentUser();
    if (!session) return error('Not authenticated', 401);

    // sendBeacon sends a Blob; the content type is whatever it was given.
    let body = {};
    try { body = JSON.parse(await req.text()); } catch { return error('Bad request', 400); }

    const reference = typeof body.reference === 'string' ? body.reference.slice(0, 120) : '';
    if (!reference) return error('reference required', 400);

    // Scoped to the caller's own row, and only ever set once: a retried beacon
    // must not move a timestamp that already recorded the real handoff.
    await prisma.transaction.updateMany({
      where: { reference, userId: session.id, type: 'deposit', gatewayHandoffAt: null },
      data: { gatewayHandoffAt: new Date() },
    });

    return ok({});
  } catch {
    return error('Request failed', 500);
  }
}
