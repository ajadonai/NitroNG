import { rateLimit, rateLimitUnavailable, tooManyRequests } from '@/lib/rate-limit';
import { parseFbCookies } from '@/lib/meta-capi';
import { guestCheckoutOpen, quoteGuestOrder } from '@/lib/guest-checkout';

/**
 * POST /api/guest/quote — price an order and hold it for 30 minutes, before
 * anybody pays (docs/v2/guest_checkout_brief.md). Every check the order route
 * makes runs here first, so a link that cannot be ordered is refused now.
 */
export async function POST(req) {
  if (!await guestCheckoutOpen()) return Response.json({ error: 'Not available' }, { status: 404 });
  const limit = await rateLimit(req, { maxAttempts: 20, windowMs: 60 * 1000 });
  if (limit.unavailable) return rateLimitUnavailable(undefined, limit.retryAfter);
  if (limit.limited) return tooManyRequests('Too many tries. Wait a minute.', limit.retryAfter);

  let body;
  try { body = await req.json(); } catch { return Response.json({ error: 'Invalid request body' }, { status: 400 }); }
  const { fbp, fbc } = parseFbCookies(req.headers.get('cookie'));
  const result = await quoteGuestOrder(
    { tierId: body?.tierId, link: body?.link, quantity: body?.quantity, comments: body?.comments },
    {
      ip: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip'),
      ua: req.headers.get('user-agent'),
      fbp, fbc,
    },
  );
  if (!result.ok) return Response.json({ error: result.error }, { status: result.status || 400 });
  const { checkout } = result;
  return Response.json({ checkoutId: checkout.id, priceKobo: checkout.priceKobo, quantity: checkout.quantity, expiresAt: checkout.expiresAt.toISOString() });
}
