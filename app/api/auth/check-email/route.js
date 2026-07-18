import prisma from '@/lib/prisma';
import { rateLimit, rateLimitUnavailable, tooManyRequests } from '@/lib/rate-limit';

export async function POST(req) {
  try {
    const limit = await rateLimit(req, { maxAttempts: 20, windowMs: 60 * 1000 });
    if (limit.unavailable) return rateLimitUnavailable(undefined, limit.retryAfter);
    if (limit.limited) return tooManyRequests('Too many requests.', limit.retryAfter);

    const { email } = await req.json();
    if (!email || typeof email !== 'string' || email.length < 5 || email.length > 254 || !email.includes('@')) return Response.json({ available: true });

    const existing = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
      select: { id: true },
    });

    const available = !existing;

    return Response.json({ available });
  } catch {
    return Response.json({ available: true }); // Don't block signup on check failure
  }
}
