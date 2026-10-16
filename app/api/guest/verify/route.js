import { log } from '@/lib/logger';
import prisma from '@/lib/prisma';
import { rateLimit, rateLimitUnavailable, tooManyRequests } from '@/lib/rate-limit';
import { normalizeGuestCode } from '@/lib/guest-code';
import { guestCheckoutOpen, guestOrderView } from '@/lib/guest-checkout';
import { getFlutterwaveSecretKey, reconcileFlutterwaveDeposit } from '@/lib/flutterwave-payment';
import { notifyDepositFinalized } from '@/lib/deposit-notifications';

/**
 * POST /api/guest/verify { code } — a visitor arriving back from Flutterwave.
 * Asks Flutterwave about the payment once, through the same reconciler the
 * webhook uses, so "Order placed" shows the moment it is true rather than
 * when the webhook happens to land. Placement itself happens inside
 * finalizeDeposit, whichever of them gets there first.
 */
export async function POST(req) {
  if (!await guestCheckoutOpen()) return Response.json({ error: 'Not available' }, { status: 404 });
  const limit = await rateLimit(req, { maxAttempts: 20, windowMs: 10 * 60 * 1000 });
  if (limit.unavailable) return rateLimitUnavailable(undefined, limit.retryAfter);
  if (limit.limited) return tooManyRequests('Too many checks. Try again in a few minutes.', limit.retryAfter);

  let body;
  try { body = await req.json(); } catch { return Response.json({ error: 'Invalid request body' }, { status: 400 }); }
  const code = normalizeGuestCode(body?.code);
  if (!code) return Response.json({ error: 'That guest code is not right.' }, { status: 400 });

  const checkout = await prisma.guestCheckout.findUnique({ where: { code }, include: { transaction: true } });
  if (!checkout) return Response.json({ error: 'No order has that guest code.' }, { status: 404 });
  if (checkout.transaction && checkout.transaction.status !== 'Completed') {
    try {
      const result = await reconcileFlutterwaveDeposit({ transaction: checkout.transaction, secretKey: (await getFlutterwaveSecretKey()) || '', recoveredBy: 'guest_verify' });
      if (result.newlyFinalized && result.finalization) await notifyDepositFinalized(result.finalization, { channel: 'Flutterwave' }).catch(() => {});
    } catch (err) {
      log.warn('Guest verify', `${code}: ${err.message}`);
    }
  }
  return Response.json({ order: await guestOrderView(code) }, { headers: { 'Cache-Control': 'no-store' } });
}
