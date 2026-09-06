export const INTERNAL_DASHBOARD_PATHS = new Set(['/pulse', '/live']);

// Staff surfaces where no third-party script may run: analytics, the Meta
// pixel and CAPI PageViews, and session recording. /admin belongs here — those
// screens render customer names, balances and payment details, so recording
// them ships customer PII to a vendor, and pixel hits from staff pollute the
// ad data. It is deliberately NOT added to INTERNAL_DASHBOARD_PATHS above:
// that Set is also the redirect allowlist for internal-dashboard access, and
// widening it would let /admin become a valid redirect destination.
export function isInternalDashboardPath(pathname) {
  if (typeof pathname !== 'string') return false;
  return INTERNAL_DASHBOARD_PATHS.has(pathname)
    || pathname.startsWith('/pulse/')
    || pathname.startsWith('/live/')
    || pathname === '/admin'
    || pathname.startsWith('/admin/');
}

export function safeInternalDashboardDestination(value, fallback = '/pulse') {
  return INTERNAL_DASHBOARD_PATHS.has(value) ? value : fallback;
}
