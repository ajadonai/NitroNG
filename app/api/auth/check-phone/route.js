import prisma from '@/lib/prisma';
import { rateLimit, rateLimitUnavailable, tooManyRequests } from '@/lib/rate-limit';

export async function POST(req) {
  try {
    const limit = await rateLimit(req, { maxAttempts: 20, windowMs: 60 * 1000 });
    if (limit.unavailable) return rateLimitUnavailable(undefined, limit.retryAfter);
    if (limit.limited) return tooManyRequests('Too many requests.', limit.retryAfter);

    const { phone } = await req.json();
    if (!phone || typeof phone !== 'string') return Response.json({ available: true });

    const cleaned = phone.replace(/\D/g, '').replace(/^234/, '').replace(/^0+/, '');
    if (!/^[789]\d{9}$/.test(cleaned)) return Response.json({ available: true });

    const normalized = `+234${cleaned}`;
    const existing = await prisma.user.findUnique({
      where: { phone: normalized },
      select: { id: true },
    });

    return Response.json({ available: !existing });
  } catch {
    return Response.json({ available: true });
  }
}
