import { Redis } from '@upstash/redis';

let redis;
try {
  if (process.env.UPSTASH_REDIS_REST_URL) {
    redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });
  }
} catch {}

// In-memory fallback for local dev when Redis is not configured
const memStore = new Map();
setInterval(() => {
  const now = Date.now();
  for (const [key, data] of memStore) {
    if (now > data.resetAt) memStore.delete(key);
  }
}, 5 * 60 * 1000).unref?.();

async function redisRateLimit(key, maxAttempts, windowSec) {
  const count = await redis.incr(key);
  if (count === 1) await redis.expire(key, windowSec);
  return { limited: count > maxAttempts, remaining: Math.max(0, maxAttempts - count) };
}

function memRateLimit(key, maxAttempts, windowMs) {
  const now = Date.now();
  let data = memStore.get(key);
  if (!data || now > data.resetAt) {
    data = { count: 0, resetAt: now + windowMs };
    memStore.set(key, data);
  }
  data.count++;
  if (data.count > maxAttempts) return { limited: true, remaining: 0 };
  return { limited: false, remaining: maxAttempts - data.count };
}

/**
 * Rate limit by IP + route.
 * Uses Upstash Redis in production, in-memory Map in dev.
 */
export async function rateLimit(req, { maxAttempts = 10, windowMs = 60 * 1000 } = {}) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
             req.headers.get('x-real-ip') ||
             'unknown';
  const route = new URL(req.url).pathname;
  const key = `rl:${ip}:${route}`;
  const windowSec = Math.ceil(windowMs / 1000);

  if (redis) {
    try {
      return await redisRateLimit(key, maxAttempts, windowSec);
    } catch {
      return memRateLimit(key, maxAttempts, windowMs);
    }
  }
  return memRateLimit(key, maxAttempts, windowMs);
}

/**
 * Returns a 429 Response
 */
export function tooManyRequests(message = 'Too many requests. Please try again later.') {
  return Response.json(
    { error: message },
    { status: 429, headers: { 'Retry-After': '60' } }
  );
}
