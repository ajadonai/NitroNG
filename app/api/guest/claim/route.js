import { getCurrentUser } from '@/lib/auth';
import { rateLimit, rateLimitUnavailable, tooManyRequests } from '@/lib/rate-limit';
import { claimGuestCode } from '@/lib/guest-checkout';

/**
 * POST /api/guest/claim { code } — a signed-in customer moves a guest order
 * into their account with its guest code: the order, and any credit left on
 * the code into their wallet. The code is the proof; only the buyer holds it.
 * Not gated on guest_checkout_enabled: a code bought while it was open must
 * stay claimable whatever the setting says later.
 */
export async function POST(req) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: 'Log in to add an order to your account.' }, { status: 401 });
  const limit = await rateLimit(req, { maxAttempts: 10, windowMs: 10 * 60 * 1000 });
  if (limit.unavailable) return rateLimitUnavailable(undefined, limit.retryAfter);
  if (limit.limited) return tooManyRequests('Too many tries. Try again in a few minutes.', limit.retryAfter);

  let body;
  try { body = await req.json(); } catch { return Response.json({ error: 'Invalid request body' }, { status: 400 }); }
  const result = await claimGuestCode(user.id, body?.code);
  if (!result.ok) return Response.json({ error: result.error }, { status: result.status || 400 });
  return Response.json({ claimed: result.value });
}
