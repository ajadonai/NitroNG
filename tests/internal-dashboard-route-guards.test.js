import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  rateLimit: vi.fn(),
  requireAccess: vi.fn(),
  userCount: vi.fn(),
  liveSessions: vi.fn(),
}));

vi.mock('@/lib/rate-limit', () => ({
  rateLimit: (...args) => mocks.rateLimit(...args),
  rateLimitUnavailable: (_message, retryAfter = 5) => Response.json(
    { error: 'unavailable' },
    { status: 503, headers: { 'Retry-After': String(retryAfter) } },
  ),
  tooManyRequests: (_message, retryAfter = 60) => Response.json(
    { error: 'limited' },
    { status: 429, headers: { 'Retry-After': String(retryAfter) } },
  ),
}));

vi.mock('@/lib/internal-dashboard-access', () => ({
  requireInternalDashboardAccess: (...args) => mocks.requireAccess(...args),
  internalDashboardAccessError: access => Response.json(
    { error: 'denied' },
    { status: access.status, headers: { 'Cache-Control': 'private, no-store' } },
  ),
  withInternalDashboardNoStore: response => {
    response.headers.set('Cache-Control', 'private, no-store');
    return response;
  },
}));

vi.mock('@/lib/heartbeat', () => ({ HEARTBEAT_ACTIVE_WINDOW_MS: 90_000 }));
vi.mock('@/lib/logger', () => ({ log: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }));
vi.mock('@/lib/prisma', () => ({
  default: {
    user: { count: (...args) => mocks.userCount(...args) },
    liveSession: { findMany: (...args) => mocks.liveSessions(...args) },
  },
}));

const { GET: getPulse } = await import('@/app/api/pulse/route');
const { GET: getLive } = await import('@/app/api/live/route');

function request(path) {
  return new Request(`http://localhost${path}`, {
    headers: { 'x-forwarded-for': '127.0.0.10' },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.rateLimit.mockResolvedValue({
    limited: false,
    unavailable: false,
    remaining: 5,
    retryAfter: 60,
  });
  mocks.requireAccess.mockResolvedValue({ ok: false, status: 401, reason: 'missing' });
});

describe('internal dashboard API guards', () => {
  it.each([
    ['Pulse', getPulse, '/api/pulse'],
    ['Live', getLive, '/api/live'],
  ])('%s denies before any dashboard data query', async (_name, handler, path) => {
    const response = await handler(request(path));
    expect(response.status).toBe(401);
    expect(response.headers.get('Cache-Control')).toContain('no-store');
    expect(mocks.userCount).not.toHaveBeenCalled();
    expect(mocks.liveSessions).not.toHaveBeenCalled();
  });

  it.each([
    ['Pulse', getPulse, '/api/pulse'],
    ['Live', getLive, '/api/live'],
  ])('%s fails closed before auth when the reliable limiter is unavailable', async (_name, handler, path) => {
    mocks.rateLimit.mockResolvedValue({
      limited: true,
      unavailable: true,
      remaining: 0,
      retryAfter: 5,
    });
    const response = await handler(request(path));
    expect(response.status).toBe(503);
    expect(response.headers.get('Retry-After')).toBe('5');
    expect(response.headers.get('Cache-Control')).toContain('no-store');
    expect(mocks.requireAccess).not.toHaveBeenCalled();
    expect(mocks.userCount).not.toHaveBeenCalled();
    expect(mocks.liveSessions).not.toHaveBeenCalled();
  });

  it.each([
    ['Pulse', getPulse, '/api/pulse'],
    ['Live', getLive, '/api/live'],
  ])('%s converts an unexpected limiter throw into a no-store 503', async (_name, handler, path) => {
    mocks.rateLimit.mockRejectedValue(new Error('redis exploded'));
    const response = await handler(request(path));
    expect(response.status).toBe(503);
    expect(response.headers.get('Cache-Control')).toContain('no-store');
    expect(mocks.requireAccess).not.toHaveBeenCalled();
    expect(mocks.userCount).not.toHaveBeenCalled();
    expect(mocks.liveSessions).not.toHaveBeenCalled();
  });

  it('returns a no-store 500 when the authorized Live data query fails', async () => {
    mocks.requireAccess.mockResolvedValue({ ok: true, status: 200 });
    mocks.liveSessions.mockRejectedValue(new Error('database unavailable'));
    const response = await getLive(request('/api/live'));
    expect(response.status).toBe(500);
    expect(response.headers.get('Cache-Control')).toContain('no-store');
  });
});
