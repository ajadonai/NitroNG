import prisma from '@/lib/prisma';
import { rateLimit, rateLimitUnavailable, tooManyRequests } from '@/lib/rate-limit';
import { validatePhone, isSupportedCountry, DEFAULT_COUNTRY } from '@/lib/phone-countries';

export async function POST(req) {
  try {
    const limit = await rateLimit(req, { maxAttempts: 20, windowMs: 60 * 1000 });
    if (limit.unavailable) return rateLimitUnavailable(undefined, limit.retryAfter);
    if (limit.limited) return tooManyRequests('Too many requests.', limit.retryAfter);

    const { phone, country } = await req.json();
    if (!phone || typeof phone !== 'string') return Response.json({ available: true });

    // An unparseable number is reported available: the signup route is what
    // actually rejects it, and saying "taken" here would be a lie that blocks
    // someone mid-typing. Must use the same validator as signup, or a number
    // could pass one and fail the other.
    const cc = isSupportedCountry(country) ? country : DEFAULT_COUNTRY;
    const checked = validatePhone(cc, phone);
    if (!checked.ok) return Response.json({ available: true });

    const existing = await prisma.user.findUnique({
      where: { phone: checked.e164 },
      select: { id: true },
    });

    return Response.json({ available: !existing });
  } catch {
    return Response.json({ available: true });
  }
}
