export const INTERNAL_DASHBOARD_PATHS = new Set(['/pulse', '/live']);

export function isInternalDashboardPath(pathname) {
  if (typeof pathname !== 'string') return false;
  return INTERNAL_DASHBOARD_PATHS.has(pathname)
    || pathname.startsWith('/pulse/')
    || pathname.startsWith('/live/');
}

export function safeInternalDashboardDestination(value, fallback = '/pulse') {
  return INTERNAL_DASHBOARD_PATHS.has(value) ? value : fallback;
}
