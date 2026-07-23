import { describe, it, expect, vi } from 'vitest';
import fc from 'fast-check';
import { Redis } from '@upstash/redis';
import {
  accountRateLimitKey,
  createRateLimiter,
  rateLimitUnavailable,
  tooManyRequests,
} from '@/lib/rate-limit';

function mockReq(ip = '127.0.0.1', path = '/api/test') {
  return {
    url: `http://localhost:3000${path}`,
    headers: new Headers({ 'x-forwarded-for': ip }),
  };
}

function silentLogger() {
  return { error: vi.fn() };
}

describe('accountRateLimitKey', () => {
  it('normalizes equivalent identifiers without exposing them in the key', () => {
    const first = accountRateLimitKey('  Person@Example.Test ', 'user-login');
    const second = accountRateLimitKey('person@example.test', 'user-login');

    expect(first).toBe(second);
    expect(first).toMatch(/^rl:acct:user-login:[a-f0-9]{64}$/);
    expect(first).not.toContain('person');
    expect(first).not.toContain('example');
  });

  it('domain-separates keys for different login surfaces', () => {
    expect(accountRateLimitKey('person@example.test', 'user-login'))
      .not.toBe(accountRateLimitKey('person@example.test', 'admin-login'));
  });

  it.each([
    ['', 'user-login'],
    ['   ', 'user-login'],
    ['person@example.test', 'Admin Login'],
    ['person@example.test', '../login'],
  ])('rejects invalid key inputs', (identifier, scope) => {
    expect(() => accountRateLimitKey(identifier, scope)).toThrow(TypeError);
  });
});

describe('createRateLimiter memory mode', () => {
  it('allows exactly N requests and blocks N + 1 for every positive threshold', async () => {
    await fc.assert(fc.asyncProperty(
      fc.integer({ min: 1, max: 25 }),
      async maxAttempts => {
        const limit = createRateLimiter({
          env: { NODE_ENV: 'test' },
          now: () => 1_000,
          logger: silentLogger(),
        });
        const req = mockReq('10.0.0.1', `/api/threshold-${maxAttempts}`);

        for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
          const result = await limit(req, { maxAttempts, windowMs: 60_000 });
          expect(result).toMatchObject({
            limited: false,
            unavailable: false,
            remaining: maxAttempts - attempt,
            resetAt: 61_000,
            retryAfter: 60,
          });
        }

        await expect(limit(req, { maxAttempts, windowMs: 60_000 })).resolves.toMatchObject({
          limited: true,
          unavailable: false,
          remaining: 0,
          resetAt: 61_000,
          retryAfter: 60,
        });
      },
    ), { numRuns: 40 });
  });

  it('tracks different IPs and routes independently', async () => {
    const limit = createRateLimiter({ env: { NODE_ENV: 'development' }, logger: silentLogger() });
    const reqA = mockReq('10.0.0.2', '/api/route-a');
    const reqB = mockReq('10.0.0.2', '/api/route-b');
    const reqC = mockReq('10.0.0.3', '/api/route-a');

    await limit(reqA, { maxAttempts: 1 });

    await expect(limit(reqA, { maxAttempts: 1 })).resolves.toMatchObject({ limited: true });
    await expect(limit(reqB, { maxAttempts: 1 })).resolves.toMatchObject({ limited: false });
    await expect(limit(reqC, { maxAttempts: 1 })).resolves.toMatchObject({ limited: false });
  });

  it('reports reset and retry values from an injected clock', async () => {
    let current = 10_000;
    const limit = createRateLimiter({
      env: { NODE_ENV: 'test' },
      now: () => current,
      logger: silentLogger(),
    });
    const req = mockReq('10.0.0.4', '/api/reset');

    const first = await limit(req, { maxAttempts: 1, windowMs: 1_500 });
    expect(first).toMatchObject({ resetAt: 11_500, retryAfter: 2, limited: false });

    current = 11_000;
    const blocked = await limit(req, { maxAttempts: 1, windowMs: 1_500 });
    expect(blocked).toMatchObject({ resetAt: 11_500, retryAfter: 1, limited: true });

    current = 11_500;
    const reset = await limit(req, { maxAttempts: 1, windowMs: 1_500 });
    expect(reset).toMatchObject({ resetAt: 13_000, retryAfter: 2, limited: false });
  });
});

describe('createRateLimiter Redis mode', () => {
  it('uses one atomic eval with the key and millisecond window', async () => {
    const redis = { eval: vi.fn().mockResolvedValue([3, 4_501]) };
    const limit = createRateLimiter({
      redis,
      env: { NODE_ENV: 'production' },
      now: () => 20_000,
      logger: silentLogger(),
    });
    const req = mockReq();

    const result = await limit(req, {
      maxAttempts: 3,
      windowMs: 60_000,
      key: 'rl:test:atomic',
    });

    expect(redis.eval).toHaveBeenCalledTimes(1);
    expect(redis.eval).toHaveBeenCalledWith(
      expect.stringContaining("redis.call('INCR', KEYS[1])"),
      ['rl:test:atomic'],
      ['60000'],
    );
    expect(redis.eval.mock.calls[0][0]).toContain("redis.call('PEXPIRE', KEYS[1], ARGV[1])");
    expect(result).toEqual({
      limited: false,
      unavailable: false,
      remaining: 0,
      resetAt: 24_501,
      retryAfter: 5,
    });
  });

  it('blocks only after the Redis count exceeds the threshold', async () => {
    const redis = { eval: vi.fn()
      .mockResolvedValueOnce([2, 2_000])
      .mockResolvedValueOnce([3, 1_900]) };
    const limit = createRateLimiter({
      redis,
      env: { NODE_ENV: 'production' },
      now: () => 5_000,
      logger: silentLogger(),
    });
    const options = { maxAttempts: 2, windowMs: 2_000, key: 'rl:test:threshold' };

    await expect(limit(mockReq(), options)).resolves.toMatchObject({
      limited: false,
      remaining: 0,
    });
    await expect(limit(mockReq(), options)).resolves.toMatchObject({
      limited: true,
      remaining: 0,
    });
  });

  it('constructs the default client only when both credentials exist', async () => {
    const redis = { eval: vi.fn().mockResolvedValue([1, 60_000]) };
    const redisFactory = vi.fn(() => redis);
    const limit = createRateLimiter({
      env: {
        NODE_ENV: 'production',
        UPSTASH_REDIS_REST_URL: 'https://redis.example.test',
        UPSTASH_REDIS_REST_TOKEN: 'secret-token',
      },
      redisFactory,
      now: () => 0,
      logger: silentLogger(),
    });

    await limit(mockReq(), { key: 'rl:test:configured' });

    expect(redisFactory).toHaveBeenCalledTimes(1);
    expect(redisFactory).toHaveBeenCalledWith(expect.objectContaining({
      url: 'https://redis.example.test',
      token: 'secret-token',
      retry: { retries: 0 },
      signal: expect.any(Function),
    }));
  });

  it('configures the installed Upstash requester for exactly one HTTP attempt', async () => {
    let capturedConfig;
    const redisFactory = vi.fn(config => {
      capturedConfig = config;
      return { eval: vi.fn().mockResolvedValue([1, 60_000]) };
    });
    const limit = createRateLimiter({
      env: {
        NODE_ENV: 'production',
        UPSTASH_REDIS_REST_URL: 'https://redis.example.test',
        UPSTASH_REDIS_REST_TOKEN: 'secret-token',
      },
      redisFactory,
      logger: silentLogger(),
    });
    await limit(mockReq(), { key: 'rl:test:request-count' });

    const fetch = vi.fn().mockRejectedValue(new Error('network unavailable'));
    vi.stubGlobal('fetch', fetch);
    try {
      const client = new Redis(capturedConfig);
      await expect(client.eval('return 1', [], [])).rejects.toThrow('network unavailable');
      expect(fetch).toHaveBeenCalledTimes(1);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

describe('fail-closed production behavior', () => {
  it.each([
    ['both missing', {}],
    ['URL only', { UPSTASH_REDIS_REST_URL: 'https://redis.example.test' }],
    ['token only', { UPSTASH_REDIS_REST_TOKEN: 'secret-token' }],
    ['blank token', {
      UPSTASH_REDIS_REST_URL: 'https://redis.example.test',
      UPSTASH_REDIS_REST_TOKEN: '   ',
    }],
  ])('returns unavailable and never touches memory when %s', async (_label, config) => {
    const memoryStore = new Map();
    const redisFactory = vi.fn();
    const limit = createRateLimiter({
      env: { NODE_ENV: 'production', ...config },
      memoryStore,
      redisFactory,
      now: () => 0,
      logger: silentLogger(),
    });

    const result = await limit(mockReq(), { maxAttempts: 3 });

    expect(result).toEqual({
      limited: true,
      unavailable: true,
      remaining: 0,
      resetAt: null,
      retryAfter: 5,
    });
    expect(memoryStore.size).toBe(0);
    expect(redisFactory).not.toHaveBeenCalled();
  });

  it('never falls back to memory when Redis throws in production', async () => {
    const memoryStore = new Map();
    const logger = silentLogger();
    const monitor = vi.fn();
    const redis = { eval: vi.fn().mockRejectedValue(new Error('redis down')) };
    const limit = createRateLimiter({
      redis,
      env: { NODE_ENV: 'production' },
      memoryStore,
      now: () => 0,
      logger,
      monitor,
    });

    const result = await limit(mockReq(), { maxAttempts: 3 });

    expect(result).toMatchObject({ limited: true, unavailable: true, retryAfter: 5 });
    expect(memoryStore.size).toBe(0);
    expect(logger.error).toHaveBeenCalledWith(
      '[RateLimit] Distributed rate limiting unavailable',
      { reason: 'redis_request_failed' },
    );
    expect(monitor).toHaveBeenCalledWith('redis_unavailable', {
      data: { reason: 'redis_request_failed' },
      dedupeKey: 'redis_unavailable:redis_request_failed',
      throttleMs: 5 * 60 * 1000,
    });
  });

  it('never logs raw Redis errors, keys, credentials, or account identifiers', async () => {
    const logger = silentLogger();
    const sensitiveMessage = [
      'token=secret-token',
      'key=rl:acct:user-login:person@example.test',
      'command=["INCR","person@example.test"]',
    ].join(' ');
    const redis = { eval: vi.fn().mockRejectedValue(new Error(sensitiveMessage)) };
    const limit = createRateLimiter({
      redis,
      env: { NODE_ENV: 'production' },
      now: () => 0,
      logger,
    });

    await expect(limit(mockReq(), {
      key: accountRateLimitKey('person@example.test', 'user-login'),
    })).resolves.toMatchObject({ unavailable: true });

    const logged = JSON.stringify(logger.error.mock.calls);
    expect(logged).toContain('redis_request_failed');
    expect(logged).not.toContain('secret-token');
    expect(logged).not.toContain('person@example.test');
    expect(logged).not.toContain('command');
  });

  it('returns unavailable when default Redis client construction fails', async () => {
    const memoryStore = new Map();
    const limit = createRateLimiter({
      env: {
        NODE_ENV: 'production',
        UPSTASH_REDIS_REST_URL: 'https://redis.example.test',
        UPSTASH_REDIS_REST_TOKEN: 'secret-token',
      },
      memoryStore,
      redisFactory: () => { throw new Error('invalid Redis config'); },
      now: () => 0,
      logger: silentLogger(),
    });

    await expect(limit(mockReq())).resolves.toMatchObject({
      limited: true,
      unavailable: true,
    });
    expect(memoryStore.size).toBe(0);
  });

  it('uses memory after a Redis failure outside production', async () => {
    const memoryStore = new Map();
    const monitor = vi.fn();
    const redis = { eval: vi.fn().mockRejectedValue(new Error('redis down')) };
    const limit = createRateLimiter({
      redis,
      env: { NODE_ENV: 'development' },
      memoryStore,
      now: () => 1_000,
      logger: silentLogger(),
      monitor,
    });

    const result = await limit(mockReq(), { maxAttempts: 2, windowMs: 5_000 });

    expect(result).toEqual({
      limited: false,
      unavailable: false,
      remaining: 1,
      resetAt: 6_000,
      retryAfter: 5,
    });
    expect(memoryStore.size).toBe(1);
    expect(monitor).not.toHaveBeenCalled();
  });
});

describe('rate-limit responses', () => {
  it('keeps the historical 429 defaults', async () => {
    const res = tooManyRequests();
    expect(res.status).toBe(429);
    expect(res.headers.get('Retry-After')).toBe('60');
    await expect(res.json()).resolves.toEqual({
      error: 'Too many requests. Please try again later.',
    });
  });

  it('keeps the historical one-message 429 call compatible', async () => {
    const res = tooManyRequests('Slow down');
    expect(res.status).toBe(429);
    expect(res.headers.get('Retry-After')).toBe('60');
    await expect(res.json()).resolves.toEqual({ error: 'Slow down' });
  });

  it('accepts an accurate retry duration for 429 responses', async () => {
    const res = tooManyRequests('Slow down', 301);
    expect(res.status).toBe(429);
    expect(res.headers.get('Retry-After')).toBe('301');
    await expect(res.json()).resolves.toEqual({ error: 'Slow down' });
  });

  it('returns an explicit retryable 503 when protection is unavailable', async () => {
    const res = rateLimitUnavailable('Try shortly', 7);
    expect(res.status).toBe(503);
    expect(res.headers.get('Retry-After')).toBe('7');
    await expect(res.json()).resolves.toEqual({
      error: 'Try shortly',
      unavailable: true,
      retryable: true,
    });
  });
});
