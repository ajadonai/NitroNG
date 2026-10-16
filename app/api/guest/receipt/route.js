import prisma from '@/lib/prisma';
import { rateLimit, rateLimitUnavailable, tooManyRequests } from '@/lib/rate-limit';
import { normalizeGuestCode } from '@/lib/guest-code';
import { isGuestAccountEmail } from '@/lib/guest-account';
import { guestCheckoutOpen, maskEmail, sendGuestReceipt } from '@/lib/guest-checkout';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/**
 * POST /api/guest/receipt { code, email } — "Want a receipt?" on the receipt
 * card, for a guest who skipped the email at checkout. Sends the receipt for a
 * placed order and keeps the address on the checkout if it had none. Limited
 * per IP and per code, so a code cannot be used to send mail to strangers.
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
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase().slice(0, 254) : '';
  if (!EMAIL_RE.test(email) || isGuestAccountEmail(email)) return Response.json({ error: 'Please enter a valid email' }, { status: 400 });

  const checkout = await prisma.guestCheckout.findUnique({ where: { code }, select: { id: true, email: true, orderId: true } });
  if (!checkout?.orderId) return Response.json({ error: 'No order has that guest code.' }, { status: 404 });
  const perCode = await rateLimit(req, { key: `rl:guest-receipt:${code}`, maxAttempts: 3, windowMs: 60 * 60 * 1000 });
  if (perCode.unavailable) return rateLimitUnavailable(undefined, perCode.retryAfter);
  if (perCode.limited) return tooManyRequests('That receipt has been sent a few times already. Try again later.', perCode.retryAfter);

  if (!checkout.email) await prisma.guestCheckout.update({ where: { id: checkout.id }, data: { email } });
  const { sent } = await sendGuestReceipt(checkout.id, email);
  if (!sent) return Response.json({ error: 'Could not send the receipt. Try again.' }, { status: 502 });
  return Response.json({ sent: true, to: maskEmail(email) });
}
