import { log } from '@/lib/logger';
// CSRF protection via Origin header verification

const ALLOWED_ORIGINS = [
  'https://nitro.ng',
  'https://www.nitro.ng',
  'http://localhost:3000',
  'http://localhost:3001',
];

/**
 * Verify the request Origin header matches allowed origins.
 * Returns null if OK, or a Response if blocked.
 * 
 * @param {Request} req
 * @returns {Response|null}
 */
export function csrfCheck(req) {
  // Only check state-changing methods
  const method = req.method?.toUpperCase();
  if (!method || method === 'GET' || method === 'HEAD' || method === 'OPTIONS') return null;

  const origin = req.headers.get('origin');
  const referer = req.headers.get('referer');

  // Allow requests with no origin (same-origin requests, server-to-server, mobile apps)
  if (!origin && !referer) return null;

  // Check origin
  if (origin) {
    if (ALLOWED_ORIGINS.some(o => origin === o || origin.startsWith(o))) return null;
    // In production, also allow the configured app URL
    const appUrl = process.env.NEXT_PUBLIC_APP_URL;
    if (appUrl && origin.startsWith(appUrl)) return null;
    
    log.warn(`[CSRF] Blocked request from origin: ${origin}`);
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Fallback: check referer
  if (referer) {
    if (ALLOWED_ORIGINS.some(o => referer.startsWith(o))) return null;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL;
    if (appUrl && referer.startsWith(appUrl)) return null;
  }

  // No matching origin or referer — block
  log.warn(`[CSRF] Blocked request — no matching origin/referer`);
  return Response.json({ error: 'Forbidden' }, { status: 403 });
}
