import prisma from '@/lib/prisma';
import { rateLimit, rateLimitUnavailable, tooManyRequests } from '@/lib/rate-limit';
import { normalizeGuestCode } from '@/lib/guest-code';
import { guestCheckoutOpen } from '@/lib/guest-checkout';
import { refillOrderForSession } from '@/app/api/orders/refill/route';

/**
 * POST /api/guest/refill { code } — the refill button on a guest's order page
 * (decided 16 Oct 2026). The same route a signed-in customer uses, on behalf of
 * the account the order sits on, so the tier promise, the one-at-a-time rule
 * and the Telegram alert are all exactly the same.
 */
export async function POST(req) {
  if (!await guestCheckoutOpen()) return Response.json({ error: 'Not available' }, { status: 404 });
  const limit = await rateLimit(req, { maxAttempts: 5, windowMs: 10 * 60 * 1000 });
  if (limit.unavailable) return rateLimitUnavailable(undefined, limit.retryAfter);
  if (limit.limited) return tooManyRequests('Too many tries. Try again in a few minutes.', limit.retryAfter);

  let body;
  try { body = await req.json(); } catch { return Response.json({ error: 'Invalid request body' }, { status: 400 }); }
  const code = normalizeGuestCode(body?.code);
  if (!code) return Response.json({ error: 'That guest code is not right.' }, { status: 400 });
  const checkout = await prisma.guestCheckout.findUnique({ where: { code }, include: { order: { select: { orderId: true, userId: true } } } });
  if (!checkout?.order) return Response.json({ error: 'No order has that guest code.' }, { status: 404 });
  // The order's own account, not the checkout's: signing up later moves the
  // order to the new account.
  return refillOrderForSession({ id: checkout.order.userId, email: `guest ${code}`, name: `Guest ${code}` }, checkout.order.orderId);
}
