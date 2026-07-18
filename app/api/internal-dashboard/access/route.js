import { NextResponse } from 'next/server';
import { getCurrentAdmin } from '@/lib/auth';
import {
  canAccessInternalDashboard,
  createInternalDashboardGrant,
  INTERNAL_DASHBOARD_COOKIE,
  internalDashboardCookieOptions,
  InternalDashboardAccessUnavailableError,
  withInternalDashboardNoStore,
} from '@/lib/internal-dashboard-access';
import { safeInternalDashboardDestination } from '@/lib/internal-dashboard-path';
import {
  rateLimit,
  rateLimitUnavailable,
  tooManyRequests,
} from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

function redirectNoStore(url) {
  return withInternalDashboardNoStore(NextResponse.redirect(url, 303));
}

export async function GET(req) {
  let limit;
  try {
    limit = await rateLimit(req, { maxAttempts: 6, windowMs: 60_000 });
  } catch {
    return withInternalDashboardNoStore(rateLimitUnavailable());
  }
  if (limit.unavailable) {
    return withInternalDashboardNoStore(rateLimitUnavailable(undefined, limit.retryAfter));
  }
  if (limit.limited) {
    return withInternalDashboardNoStore(tooManyRequests(
      'Too many dashboard access attempts. Please try again shortly.',
      limit.retryAfter,
    ));
  }

  const requested = new URL(req.url).searchParams.get('next');
  const destination = safeInternalDashboardDestination(requested);
  let session;
  try {
    session = await getCurrentAdmin();
  } catch {
    return withInternalDashboardNoStore(Response.json(
      { error: 'Internal dashboard access is temporarily unavailable' },
      { status: 503 },
    ));
  }

  if (!session) {
    const loginUrl = new URL('/admin/login', req.url);
    loginUrl.searchParams.set('next', destination);
    return redirectNoStore(loginUrl);
  }

  if (!session._sessionId || !canAccessInternalDashboard(session._admin)) {
    return withInternalDashboardNoStore(Response.json({ error: 'Access denied' }, { status: 403 }));
  }

  try {
    const token = createInternalDashboardGrant({
      adminId: session.id,
      sessionId: session._sessionId,
    });
    const response = redirectNoStore(new URL(destination, req.url));
    response.cookies.set(
      INTERNAL_DASHBOARD_COOKIE,
      token,
      internalDashboardCookieOptions(),
    );
    return response;
  } catch (error) {
    if (error instanceof InternalDashboardAccessUnavailableError) {
      return withInternalDashboardNoStore(Response.json(
        { error: 'Internal dashboard access is temporarily unavailable' },
        { status: 503 },
      ));
    }
    throw error;
  }
}
