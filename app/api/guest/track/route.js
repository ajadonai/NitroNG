import { rateLimit, rateLimitUnavailable, tooManyRequests } from '@/lib/rate-limit';
import { normalizeGuestCode } from '@/lib/guest-code';
import { guestCheckoutOpen, guestLookupLimit, guestOrderView } from '@/lib/guest-checkout';

/**
 * GET /api/guest/track?code= — the order behind a guest code, for the order
 * page and the "Already ordered?" pop-up. Rate-limited per IP, on one budget
 * shared with the order page itself (GUEST_LOOKUP_LIMIT): a code with credit
 * on it is worth money, and the limit on top of the 500-billion-code space
 * makes guessing one hopeless.
 */
export async function GET(req) {
  if (!await guestCheckoutOpen()) return Response.json({ error: 'Not available' }, { status: 404 });
  const limit = await rateLimit(req, guestLookupLimit(req.headers));
  if (limit.unavailable) return rateLimitUnavailable(undefined, limit.retryAfter);
  if (limit.limited) return tooManyRequests('Too many lookups. Try again in a few minutes.', limit.retryAfter);

  const code = normalizeGuestCode(new URL(req.url).searchParams.get('code'));
  if (!code) return Response.json({ error: 'That guest code is not right. Check it and try again.' }, { status: 400 });
  const view = await guestOrderView(code);
  if (!view) return Response.json({ error: 'No order has that guest code. Check it and try again.' }, { status: 404 });
  return Response.json({ order: view }, { headers: { 'Cache-Control': 'no-store' } });
}
