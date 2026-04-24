import { describe, it, expect } from 'vitest';
import { rateLimit, tooManyRequests } from '@/lib/rate-limit';

function mockReq(ip = '127.0.0.1', path = '/api/test') {
  return {
    url: `http://localhost:3000${path}`,
    headers: new Headers({ 'x-forwarded-for': ip }),
  };
}

describe('rateLimit (in-memory fallback)', () => {
  it('allows requests under the limit', async () => {
    const req = mockReq('10.0.0.1', '/api/rate-test-1');
    const result = await rateLimit(req, { maxAttempts: 3, windowMs: 60000 });
    expect(result.limited).toBe(false);
    expect(result.remaining).toBe(2);
  });

  it('blocks after exceeding limit', async () => {
    const req = mockReq('10.0.0.2', '/api/rate-test-2');
    for (let i = 0; i < 3; i++) {
      await rateLimit(req, { maxAttempts: 3, windowMs: 60000 });
    }
    const result = await rateLimit(req, { maxAttempts: 3, windowMs: 60000 });
    expect(result.limited).toBe(true);
    expect(result.remaining).toBe(0);
  });

  it('tracks different IPs separately', async () => {
    const req1 = mockReq('10.0.0.3', '/api/rate-test-3');
    const req2 = mockReq('10.0.0.4', '/api/rate-test-3');
    for (let i = 0; i < 5; i++) {
      await rateLimit(req1, { maxAttempts: 5, windowMs: 60000 });
    }
    const blocked = await rateLimit(req1, { maxAttempts: 5, windowMs: 60000 });
    const allowed = await rateLimit(req2, { maxAttempts: 5, windowMs: 60000 });
    expect(blocked.limited).toBe(true);
    expect(allowed.limited).toBe(false);
  });

  it('tracks different routes separately', async () => {
    const reqA = mockReq('10.0.0.5', '/api/route-a');
    const reqB = mockReq('10.0.0.5', '/api/route-b');
    for (let i = 0; i < 2; i++) {
      await rateLimit(reqA, { maxAttempts: 2, windowMs: 60000 });
    }
    const blockedA = await rateLimit(reqA, { maxAttempts: 2, windowMs: 60000 });
    const allowedB = await rateLimit(reqB, { maxAttempts: 2, windowMs: 60000 });
    expect(blockedA.limited).toBe(true);
    expect(allowedB.limited).toBe(false);
  });
});

describe('tooManyRequests', () => {
  it('returns 429 with Retry-After header', () => {
    const res = tooManyRequests();
    expect(res.status).toBe(429);
    expect(res.headers.get('Retry-After')).toBe('60');
  });

  it('includes custom message', async () => {
    const res = tooManyRequests('Slow down');
    const body = await res.json();
    expect(body.error).toBe('Slow down');
  });
});
