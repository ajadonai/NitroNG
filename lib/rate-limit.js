// Simple in-memory rate limiter
// For production, use Redis-backed solution
const store = new Map();

// Clean up expired entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, data] of store) {
    if (now - data.resetAt > 0) store.delete(key);
  }
}, 5 * 60 * 1000);

/**
 * Rate limit by IP + route
 * @param {Request} req
 * @param {Object} opts - { maxAttempts, windowMs }
 * @returns {{ limited: boolean, remaining: number }} 
 */
export function rateLimit(req, { maxAttempts = 10, windowMs = 60 * 1000 } = {}) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 
             req.headers.get('x-real-ip') || 
             'unknown';
  const route = new URL(req.url).pathname;
  const key = `${ip}:${route}`;
  const now = Date.now();

  let data = store.get(key);
  if (!data || now > data.resetAt) {
    data = { count: 0, resetAt: now + windowMs };
    store.set(key, data);
  }

  data.count++;

  if (data.count > maxAttempts) {
    return { limited: true, remaining: 0 };
  }

  return { limited: false, remaining: maxAttempts - data.count };
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
