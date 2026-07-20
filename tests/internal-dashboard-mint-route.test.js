import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getCurrentAdmin: vi.fn(),
  rateLimit: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
  getCurrentAdmin: (...args) => mocks.getCurrentAdmin(...args),
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

const { GET } = await import('@/app/api/internal-dashboard/access/route');

function request(next = '/pulse') {
  return new Request(`https://nitro.ng/api/internal-dashboard/access?next=${encodeURIComponent(next)}`, {
    headers: { 'x-forwarded-for': '127.0.0.20' },
  });
}

function currentAdmin(overrides = {}) {
  return {
    id: 'admin-1',
    _sessionId: 'session-1',
    _admin: {
      id: 'admin-1',
      name: 'Owner',
      email: 'owner@example.test',
      role: 'owner',
      status: 'Active',
      customActions: null,
      ...overrides,
    },
  };
}

beforeEach(() => {
  vi.stubEnv('NODE_ENV', 'production');
  vi.stubEnv('JWT_ADMIN_SECRET', 'production-admin-secret-for-tests');
  mocks.rateLimit.mockResolvedValue({
    limited: false,
    unavailable: false,
    remaining: 5,
    retryAfter: 60,
  });
  mocks.getCurrentAdmin.mockResolvedValue(currentAdmin());
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

describe('internal dashboard grant mint route', () => {
  it('sets a production-safe 15-minute child cookie and redirects to a clean path', async () => {
    const response = await GET(request('/live'));
    expect(response.status).toBe(303);
    expect(response.headers.get('location')).toBe('https://nitro.ng/live');
    expect(response.headers.get('Cache-Control')).toContain('no-store');
    const cookie = response.headers.get('set-cookie');
    expect(cookie).toContain('nitro_internal_dashboard_access=');
    expect(cookie).toContain('Max-Age=28800');
    expect(cookie).toContain('Path=/');
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('Secure');
    expect(cookie).toContain('SameSite=strict');
    expect(cookie).not.toContain('pulse_secret_key');
  });

  it('sends an unauthenticated request to login with only a strict safe destination', async () => {
    mocks.getCurrentAdmin.mockResolvedValue(null);
    const response = await GET(request('https://evil.example/steal'));
    expect(response.status).toBe(303);
    expect(response.headers.get('location')).toBe('https://nitro.ng/admin/login?next=%2Fpulse');
    expect(response.headers.get('set-cookie')).toBeNull();
  });

  it('rejects a current but unauthorized role', async () => {
    mocks.getCurrentAdmin.mockResolvedValue(currentAdmin({ role: 'support' }));
    const response = await GET(request('/pulse'));
    expect(response.status).toBe(403);
    expect(response.headers.get('set-cookie')).toBeNull();
    expect(response.headers.get('Cache-Control')).toContain('no-store');
  });

  it('returns 503 without reading auth when reliable rate limiting is unavailable', async () => {
    mocks.rateLimit.mockResolvedValue({
      limited: true,
      unavailable: true,
      remaining: 0,
      retryAfter: 5,
    });
    const response = await GET(request('/pulse'));
    expect(response.status).toBe(503);
    expect(response.headers.get('Retry-After')).toBe('5');
    expect(mocks.getCurrentAdmin).not.toHaveBeenCalled();
  });

  it('converts an unexpected limiter throw into a no-store 503 before auth', async () => {
    mocks.rateLimit.mockRejectedValue(new Error('redis exploded'));
    const response = await GET(request('/pulse'));
    expect(response.status).toBe(503);
    expect(response.headers.get('Cache-Control')).toContain('no-store');
    expect(mocks.getCurrentAdmin).not.toHaveBeenCalled();
  });

  it('returns a no-store 503 when the parent admin session cannot be checked', async () => {
    mocks.getCurrentAdmin.mockRejectedValue(new Error('database unavailable'));
    const response = await GET(request('/pulse'));
    expect(response.status).toBe(503);
    expect(response.headers.get('Cache-Control')).toContain('no-store');
    expect(response.headers.get('set-cookie')).toBeNull();
  });
});
