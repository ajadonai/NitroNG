import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  renewUser: vi.fn(),
  renewAdmin: vi.fn(),
  logError: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
  renewUserSession: (...args) => mocks.renewUser(...args),
  renewAdminSession: (...args) => mocks.renewAdmin(...args),
}));

vi.mock('@/lib/logger', () => ({
  log: { error: (...args) => mocks.logError(...args) },
}));

const { POST } = await import('@/app/api/auth/renew/route.js');

function request(type) {
  return new Request('https://nitro.test/api/auth/renew', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(type === undefined ? {} : { type }),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.renewUser.mockResolvedValue({ renewed: false });
  mocks.renewAdmin.mockResolvedValue({ renewed: false });
});

describe('POST /api/auth/renew', () => {
  it('keeps a validated legacy session on a non-error response', async () => {
    mocks.renewUser.mockResolvedValue({ renewed: false, legacy: true });

    const response = await POST(request('user'));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      renewed: false,
      legacy: true,
    });
  });

  it('returns 401 only when durable validation fails', async () => {
    mocks.renewAdmin.mockResolvedValue(null);

    const response = await POST(request('admin'));

    expect(response.status).toBe(401);
    expect(response.headers.get('cache-control')).toContain('no-store');
  });

  it.each([undefined, 'customer', '', null])(
    'rejects an ambiguous session mode (%s)',
    async type => {
      const response = await POST(request(type));

      expect(response.status).toBe(400);
      expect(mocks.renewUser).not.toHaveBeenCalled();
      expect(mocks.renewAdmin).not.toHaveBeenCalled();
    },
  );

  it('contains renewal failures without misreporting them as expiry', async () => {
    mocks.renewUser.mockRejectedValue(new Error('database unavailable'));

    const response = await POST(request('user'));

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({ renewed: false });
  });
});

describe('session heartbeat client behavior', () => {
  const source = readFileSync('lib/use-session-heartbeat.js', 'utf8');

  it('does not renew hidden tabs and resumes validation when visible', () => {
    expect(source).toContain("document.visibilityState === 'hidden'");
    expect(source).toContain("document.visibilityState === 'visible'");
    expect(source).toContain("renew({ force: true })");
  });

  it('prevents overlapping renewal calls and redirects only on an explicit 401', () => {
    expect(source).toContain('if (!active || inFlight) return');
    expect(source).toMatch(/if\s*\([^)]*res\.status === 401\)/);
    expect(source).not.toMatch(/if\s*\(\s*!res\.ok\s*\)/);
  });
});
