import { rateLimit, rateLimitUnavailable, tooManyRequests } from '@/lib/rate-limit';
import { guestCheckoutOpen, startGuestPayment } from '@/lib/guest-checkout';

/**
 * POST /api/guest/pay — take a quoted order to Flutterwave, or place it at
 * once when a guest code's credit covers all of it.
 */
export async function POST(req) {
  if (!await guestCheckoutOpen()) return Response.json({ error: 'Not available' }, { status: 404 });
  const limit = await rateLimit(req, { maxAttempts: 5, windowMs: 10 * 60 * 1000 });
  if (limit.unavailable) return rateLimitUnavailable(undefined, limit.retryAfter);
  if (limit.limited) return tooManyRequests('Too many payment attempts. Try again in a few minutes.', limit.retryAfter);

  let body;
  try { body = await req.json(); } catch { return Response.json({ error: 'Invalid request body' }, { status: 400 }); }
  if (typeof body?.checkoutId !== 'string') return Response.json({ error: 'Start the order again' }, { status: 400 });
  const result = await startGuestPayment({ checkoutId: body.checkoutId, email: body.email, creditCode: body.creditCode, currency: body.currency });
  if (!result.ok) return Response.json({ error: result.error }, { status: result.status || 400 });
  return Response.json({ code: result.code, authorizationUrl: result.authorizationUrl || null, placed: !!result.placed });
}
