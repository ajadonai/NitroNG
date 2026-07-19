import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = path => readFileSync(path, 'utf8');

describe('internal dashboard entrypoint boundaries', () => {
  const pulsePage = source('app/pulse/page.jsx');
  const livePage = source('app/live/page.jsx');
  const pulseApi = source('app/api/pulse/route.js');
  const liveApi = source('app/api/live/route.js');
  const pulseClient = source('components/pulse-dashboard.jsx');
  const liveClient = source('components/live-dashboard.jsx');

  it('contains no legacy URL-key authentication or client-side bearer prop', () => {
    const retiredEntrypoints = [pulsePage, livePage, pulseApi, liveApi, pulseClient, liveClient];
    for (const text of retiredEntrypoints) {
      expect(text).not.toContain('pulse_secret_key');
      expect(text).not.toContain('timingSafeEqual');
      expect(text).not.toContain('secretKey');
      expect(text).not.toMatch(/[?&]key=/);
      expect(text).not.toMatch(/searchParams(?:\.get)?\(['"]key/);
    }
    expect(pulseClient).toContain("fetch('/api/pulse', { cache: 'no-store' })");
    expect(liveClient).toContain("fetch('/api/live', { cache: 'no-store' })");
  });

  it('uses the shared grant validator before any sensitive dashboard query', () => {
    const pulseAuth = pulseApi.indexOf('requireInternalDashboardAccess()');
    const pulseData = pulseApi.indexOf('watBounds()');
    const liveAuth = liveApi.indexOf('requireInternalDashboardAccess()');
    const liveData = liveApi.indexOf('prisma.liveSession.findMany');
    expect(pulseApi.indexOf('rateLimit(req')).toBeGreaterThan(-1);
    expect(liveApi.indexOf('rateLimit(req')).toBeGreaterThan(-1);
    expect(pulseAuth).toBeGreaterThan(-1);
    expect(liveAuth).toBeGreaterThan(-1);
    expect(pulseAuth).toBeLessThan(pulseData);
    expect(liveAuth).toBeLessThan(liveData);
  });

  it('returns explicit no-store responses and keeps Live reads read-only', () => {
    expect(pulseApi).toContain('withInternalDashboardNoStore(Response.json');
    expect(liveApi).toContain('withInternalDashboardNoStore(Response.json');
    expect(liveApi).not.toContain('liveSession.deleteMany');
    expect(liveApi).toContain('HEARTBEAT_ACTIVE_WINDOW_MS');
    expect(liveApi).toContain('take: LIVE_SESSION_RESULT_LIMIT');
    expect(liveApi).toContain('const LIVE_SESSION_RESULT_LIMIT = 500');
  });

  it('clears sensitive state and re-enters the clean page when access is revoked', () => {
    expect(pulseClient).toContain("res.status === 401 || res.status === 403");
    expect(pulseClient).toContain('setData(null)');
    expect(pulseClient).toContain("window.location.replace('/api/internal-dashboard/access?next=/pulse')");
    expect(liveClient).toContain("res.status === 401 || res.status === 403");
    expect(liveClient).toContain('setSessions([])');
    expect(liveClient).toContain('setCount(0)');
    expect(liveClient).toContain("window.location.replace('/api/internal-dashboard/access?next=/live')");
  });

  it('leaves enough pre-auth Live budget for multiple legitimate tabs on one IP', () => {
    expect(liveApi).toContain('maxAttempts: 120');
  });
});

describe('internal dashboard leakage retirement', () => {
  it('suppresses internal routes in every global analytics surface', () => {
    for (const path of [
      'components/capi-tracker.jsx',
      'components/analytics-scripts.jsx',
      'components/cookie-banner.jsx',
    ]) {
      const text = source(path);
      expect(text).toContain('isInternalDashboardPath');
    }
    const capi = source('components/capi-tracker.jsx');
    expect(capi.indexOf('isInternalDashboardPath(window.location.pathname)')).toBeLessThan(
      capi.indexOf("fetch('/api/capi/track'"),
    );
  });

  it('omits and deletes the legacy setting', () => {
    const settings = source('app/api/admin/settings/route.js');
    const migration = source('prisma/migrations/20260717020000_retire_pulse_secret_key/migration.sql');
    expect(settings).toContain("if (r.key === 'pulse_secret_key') return");
    expect(migration).toContain("DELETE FROM \"settings\" WHERE \"key\" = 'pulse_secret_key'");
  });

  it('registers the permission and clears the child grant on admin logout', () => {
    expect(source('lib/admin.js')).toContain("'internalDashboards.view': ['owner', 'superadmin']");
    const logout = source('app/api/auth/admin/logout/route.js');
    expect(logout).toContain('clearInternalDashboardGrantCookie');
    expect(logout.indexOf('await prisma.adminSession.deleteMany'))
      .toBeLessThan(logout.indexOf('clearInternalDashboardGrantCookie(cookieStore)'));
    expect(logout).toContain("return error('Unable to log out. Please try again.', 503)");
    const dashboard = source('components/admin-dashboard.jsx');
    expect(dashboard.indexOf('if (!res.ok)'))
      .toBeLessThan(dashboard.indexOf('window.location.replace("/admin/login?logout=1")'));
  });

  it('clears inherited grants on account switches and revokes sessions on password reset', () => {
    const login = source('app/api/auth/admin/login/route.js');
    const team = source('app/api/admin/team/route.js');
    expect(login).toContain('clearInternalDashboardGrantCookie(cookieStore)');
    expect(login.indexOf('clearInternalDashboardGrantCookie(cookieStore)'))
      .toBeLessThan(login.indexOf('await setAdminCookie(token, admin.role, { remember })'));
    expect(login).toContain('FOR UPDATE');
    expect(login.indexOf('FOR UPDATE')).toBeLessThan(login.indexOf('tx.adminSession.create'));
    expect(login.indexOf('tx.adminSession.deleteMany'))
      .toBeLessThan(login.indexOf('tx.adminSession.create'));
    expect(login.indexOf('prisma.$transaction(async tx =>'))
      .toBeLessThan(login.indexOf('clearInternalDashboardGrantCookie(cookieStore)'));
    const resetPassword = team.slice(team.indexOf("if (action === 'resetPassword')"));
    expect(resetPassword).toContain('prisma.$transaction([');
    expect(resetPassword).toContain('prisma.adminSession.deleteMany({ where: { adminId } })');
    expect(resetPassword).toContain("{ isolationLevel: 'Serializable' }");
  });

  it('allows only strict Pulse or Live post-login redirects', () => {
    const login = source('components/admin-login.jsx');
    expect(login).toContain("safeInternalDashboardDestination(requested, '/admin')");
    expect(login).not.toMatch(/window\.location\.href\s*=\s*requested/);
  });
});
