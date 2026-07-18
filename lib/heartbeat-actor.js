import {
  hashToken,
  verifyAdminToken,
  verifyUserToken,
} from '@/lib/auth';
import { isInternalDashboardPath } from '@/lib/internal-dashboard-path';

function isAdminPage(page) {
  return page === '/admin'
    || page?.startsWith('/admin/')
    || isInternalDashboardPath(page);
}

async function resolveUserActor(db, token, verifyToken) {
  if (!token) return null;
  const payload = verifyToken(token);
  if (!payload?.id) return null;

  const session = await db.session.findUnique({
    where: { tokenHash: hashToken(token) },
    select: {
      userId: true,
      user: { select: { id: true, status: true } },
    },
  });
  if (session?.userId !== payload.id
    || session.user?.id !== payload.id
    || session.user.status !== 'Active') {
    return null;
  }

  return {
    kind: 'user',
    id: payload.id,
    identityScope: `user:${payload.id}`,
  };
}

async function resolveAdminActor(db, token, verifyToken) {
  if (!token) return null;
  const payload = verifyToken(token);
  if (!payload?.id) return null;

  const session = await db.adminSession.findUnique({
    where: { tokenHash: hashToken(token) },
    select: {
      adminId: true,
      admin: { select: { id: true, status: true } },
    },
  });
  if (session?.adminId !== payload.id
    || session.admin?.id !== payload.id
    || session.admin.status !== 'Active') {
    return null;
  }

  return {
    kind: 'admin',
    id: payload.id,
    identityScope: `admin:${payload.id}`,
  };
}

// A signed JWT alone is not an active identity. Heartbeats are attributed only
// after the backing session and current account status are checked. Internal
// admin pages intentionally ignore a coexisting user cookie so an admin tab is
// never shown in Live as the customer who happens to be signed in in that
// browser.
export async function resolveHeartbeatActor(db, {
  page,
  userToken,
  adminToken,
  verifyUser = verifyUserToken,
  verifyAdmin = verifyAdminToken,
} = {}) {
  if (isAdminPage(page)) {
    return resolveAdminActor(db, adminToken, verifyAdmin);
  }

  const user = await resolveUserActor(db, userToken, verifyUser);
  if (user) return user;
  return resolveAdminActor(db, adminToken, verifyAdmin);
}

