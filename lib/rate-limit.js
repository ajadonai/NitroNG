import { Redis } from '@upstash/redis';

const DEFAULT_MAX_ATTEMPTS = 10;
const DEFAULT_WINDOW_MS = 60 * 1000;
const DEFAULT_UNAVAILABLE_RETRY_SECONDS = 5;
const MEMORY_SWEEP_INTERVAL_MS = 5 * 60 * 1000;
const REDIS_TIMEOUT_MS = 1500;

// One Redis operation owns both the increment and the expiry. The PTTL repair
// also gives legacy counters that lost their expiry a bounded lifetime.
const REDIS_RATE_LIMIT_SCRIPT = `
local count = redis.call('INCR', KEYS[1])
local ttl = redis.call('PTTL', KEYS[1])
if count == 1 or ttl < 0 then
  redis.call('PEXPIRE', KEYS[1], ARGV[1])
  ttl = tonumber(ARGV[1])
end
return { count, ttl }
`;

function hasValue(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function normalizePositiveInteger(value, fallback, name) {
  const candidate = value === undefined ? fallback : Number(value);
  if (!Number.isFinite(candidate) || candidate <= 0) {
    throw new TypeError(`${name} must be a positive number`);
  }
  return Math.ceil(candidate);
}

function retrySeconds(value, fallback) {
  const candidate = Number(value);
  return Number.isFinite(candidate) && candidate > 0
    ? Math.ceil(candidate)
    : fallback;
}

function clientKey(req, customKey) {
  if (customKey) return customKey;
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || req.headers.get('x-real-ip')?.trim()
    || 'unknown';
  const route = new URL(req.url).pathname;
  return `rl:${ip}:${route}`;
}

function availableResult({ count, maxAttempts, resetAt, retryAfter }) {
  return {
    limited: count > maxAttempts,
    unavailable: false,
    remaining: Math.max(0, maxAttempts - count),
    resetAt,
    retryAfter,
  };
}

function unavailableResult(retryAfter = DEFAULT_UNAVAILABLE_RETRY_SECONDS) {
  return {
    limited: true,
    unavailable: true,
    remaining: 0,
    resetAt: null,
    retryAfter,
  };
}

function defaultRedisFactory(config) {
  return new Redis(config);
}

function redisConfig(env) {
  const url = env.UPSTASH_REDIS_REST_URL;
  const token = env.UPSTASH_REDIS_REST_TOKEN;
  if (!hasValue(url) || !hasValue(token)) return null;

  const signal = typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function'
    ? () => AbortSignal.timeout(REDIS_TIMEOUT_MS)
    : undefined;

  return {
    url,
    token,
    retry: false,
    ...(signal ? { signal } : {}),
  };
}

/**
 * Build an isolated limiter with injectable infrastructure for deterministic
 * tests. Production never uses the memory store when Redis is unavailable.
 */
export function createRateLimiter({
  redis: injectedRedis,
  env = process.env,
  now = Date.now,
  logger = console,
  memoryStore = new Map(),
  redisFactory = defaultRedisFactory,
  unavailableRetryAfter = DEFAULT_UNAVAILABLE_RETRY_SECONDS,
} = {}) {
  const production = env.NODE_ENV === 'production';
  const hasInjectedRedis = injectedRedis !== undefined;
  const configuredRedis = redisConfig(env);
  let redis = hasInjectedRedis ? injectedRedis : null;
  let redisConfigurationAvailable = hasInjectedRedis ? Boolean(injectedRedis) : Boolean(configuredRedis);
  let nextMemorySweepAt = 0;
  let lastUnavailableLogAt = null;
  const unavailableRetrySeconds = retrySeconds(
    unavailableRetryAfter,
    DEFAULT_UNAVAILABLE_RETRY_SECONDS,
  );

  const reportUnavailable = (reason, error) => {
    const current = now();
    if (lastUnavailableLogAt !== null && current - lastUnavailableLogAt < 60_000) return;
    lastUnavailableLogAt = current;
    try {
      logger.error?.('[RateLimit] Distributed rate limiting unavailable', {
        reason,
        ...(error?.message ? { error: error.message } : {}),
      });
    } catch {}
  };

  if (!hasInjectedRedis && configuredRedis) {
    try {
      redis = redisFactory(configuredRedis);
      redisConfigurationAvailable = Boolean(redis);
    } catch (error) {
      redis = null;
      redisConfigurationAvailable = false;
      reportUnavailable('redis_client_initialization_failed', error);
    }
  }

  if (production && !redisConfigurationAvailable) {
    reportUnavailable('redis_configuration_missing_or_incomplete');
  }

  const sweepMemory = current => {
    if (current < nextMemorySweepAt) return;
    for (const [key, data] of memoryStore) {
      if (current >= data.resetAt) memoryStore.delete(key);
    }
    nextMemorySweepAt = current + MEMORY_SWEEP_INTERVAL_MS;
  };

  const memoryRateLimit = (key, maxAttempts, windowMs) => {
    const current = now();
    sweepMemory(current);
    let data = memoryStore.get(key);
    if (!data || current >= data.resetAt) {
      data = { count: 0, resetAt: current + windowMs };
      memoryStore.set(key, data);
    }
    data.count += 1;
    return availableResult({
      count: data.count,
      maxAttempts,
      resetAt: data.resetAt,
      retryAfter: Math.max(1, Math.ceil((data.resetAt - current) / 1000)),
    });
  };

  const redisRateLimit = async (key, maxAttempts, windowMs) => {
    const raw = await redis.eval(REDIS_RATE_LIMIT_SCRIPT, [key], [String(windowMs)]);
    if (!Array.isArray(raw) || raw.length < 2) {
      throw new Error('Redis returned an invalid rate-limit result');
    }

    const count = Number(raw[0]);
    const ttlMs = Number(raw[1]);
    if (!Number.isFinite(count) || count < 1 || !Number.isFinite(ttlMs) || ttlMs < 0) {
      throw new Error('Redis returned invalid rate-limit values');
    }

    const current = now();
    return availableResult({
      count,
      maxAttempts,
      resetAt: current + ttlMs,
      retryAfter: Math.max(1, Math.ceil(ttlMs / 1000)),
    });
  };

  return async function configuredRateLimit(
    req,
    {
      maxAttempts = DEFAULT_MAX_ATTEMPTS,
      windowMs = DEFAULT_WINDOW_MS,
      key: customKey,
    } = {},
  ) {
    const normalizedMaxAttempts = normalizePositiveInteger(
      maxAttempts,
      DEFAULT_MAX_ATTEMPTS,
      'maxAttempts',
    );
    const normalizedWindowMs = normalizePositiveInteger(windowMs, DEFAULT_WINDOW_MS, 'windowMs');
    const key = clientKey(req, customKey);

    if (!redisConfigurationAvailable || !redis) {
      if (production) return unavailableResult(unavailableRetrySeconds);
      return memoryRateLimit(key, normalizedMaxAttempts, normalizedWindowMs);
    }

    try {
      return await redisRateLimit(key, normalizedMaxAttempts, normalizedWindowMs);
    } catch (error) {
      reportUnavailable('redis_request_failed', error);
      if (production) return unavailableResult(unavailableRetrySeconds);
      return memoryRateLimit(key, normalizedMaxAttempts, normalizedWindowMs);
    }
  };
}

const defaultRateLimit = createRateLimiter();

/**
 * Rate limit by IP + route unless a custom key is supplied.
 */
export function rateLimit(req, options) {
  return defaultRateLimit(req, options);
}

/**
 * Returns a 429 response. The optional retry value preserves the historical
 * one-argument API while allowing callers to report the real window.
 */
export function tooManyRequests(
  message = 'Too many requests. Please try again later.',
  retryAfter = 60,
) {
  const seconds = retrySeconds(retryAfter, 60);
  return Response.json(
    { error: message },
    { status: 429, headers: { 'Retry-After': String(seconds) } },
  );
}

/**
 * Returns an explicit degraded response when reliable protection is absent.
 */
export function rateLimitUnavailable(
  message = 'Request protection is temporarily unavailable. Please try again shortly.',
  retryAfter = DEFAULT_UNAVAILABLE_RETRY_SECONDS,
) {
  const seconds = retrySeconds(retryAfter, DEFAULT_UNAVAILABLE_RETRY_SECONDS);
  return Response.json(
    { error: message, unavailable: true, retryable: true },
    { status: 503, headers: { 'Retry-After': String(seconds) } },
  );
}
