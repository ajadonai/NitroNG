import { describe, expect, it, vi } from 'vitest';
import { hashToken } from '@/lib/auth';
import { resolveHeartbeatActor } from '@/lib/heartbeat-actor';

function db({ userSession = null, adminSession = null } = {}) {
  return {
    session: { findUnique: vi.fn().mockResolvedValue(userSession) },
    adminSession: { findUnique: vi.fn().mockResolvedValue(adminSession) },
  };
}

const validUserSession = {
  userId: 'user-1',
  user: { id: 'user-1', status: 'Active' },
};
const validAdminSession = {
  adminId: 'admin-1',
  admin: { id: 'admin-1', status: 'Active' },
};

describe('heartbeat actor resolution', () => {
  it('requires a live backing user session with the same active account', async () => {
    const database = db({ userSession: validUserSession });
    const verifyUser = vi.fn().mockReturnValue({ id: 'user-1', type: 'user' });

    await expect(resolveHeartbeatActor(database, {
      page: '/dashboard',
      userToken: 'user-token',
      verifyUser,
    })).resolves.toEqual({
      kind: 'user',
      id: 'user-1',
      identityScope: 'user:user-1',
    });
    expect(database.session.findUnique).toHaveBeenCalledWith({
      where: { tokenHash: hashToken('user-token') },
      select: {
        userId: true,
        user: { select: { id: true, status: true } },
      },
    });

    for (const userSession of [
      null,
      { ...validUserSession, userId: 'different-user' },
      { ...validUserSession, user: { id: 'user-1', status: 'Suspended' } },
      { ...validUserSession, user: { id: 'user-1', status: 'PendingDeletion' } },
    ]) {
      await expect(resolveHeartbeatActor(db({ userSession }), {
        page: '/dashboard',
        userToken: 'user-token',
        verifyUser,
      })).resolves.toBeNull();
    }
  });

  it('falls back to a live admin session on non-admin pages when no user is valid', async () => {
    const database = db({ adminSession: validAdminSession });
    const verifyUser = vi.fn().mockReturnValue({ id: 'user-1' });
    const verifyAdmin = vi.fn().mockReturnValue({ id: 'admin-1' });

    await expect(resolveHeartbeatActor(database, {
      page: '/',
      userToken: 'revoked-user-token',
      adminToken: 'admin-token',
      verifyUser,
      verifyAdmin,
    })).resolves.toEqual({
      kind: 'admin',
      id: 'admin-1',
      identityScope: 'admin:admin-1',
    });
    expect(database.session.findUnique).toHaveBeenCalledOnce();
    expect(database.adminSession.findUnique).toHaveBeenCalledOnce();
  });

  it('prefers only the active admin session on admin and internal dashboard paths', async () => {
    for (const page of ['/admin', '/admin/orders', '/pulse', '/live']) {
      const database = db({
        userSession: validUserSession,
        adminSession: validAdminSession,
      });
      const verifyUser = vi.fn().mockReturnValue({ id: 'user-1' });
      const verifyAdmin = vi.fn().mockReturnValue({ id: 'admin-1' });

      await expect(resolveHeartbeatActor(database, {
        page,
        userToken: 'user-token',
        adminToken: 'admin-token',
        verifyUser,
        verifyAdmin,
      })).resolves.toMatchObject({ kind: 'admin', id: 'admin-1' });
      expect(verifyUser).not.toHaveBeenCalled();
      expect(database.session.findUnique).not.toHaveBeenCalled();
    }
  });

  it('does not relabel an internal admin page as a user when admin access is revoked', async () => {
    const database = db({ userSession: validUserSession, adminSession: null });
    const verifyUser = vi.fn().mockReturnValue({ id: 'user-1' });
    const verifyAdmin = vi.fn().mockReturnValue({ id: 'admin-1' });

    await expect(resolveHeartbeatActor(database, {
      page: '/live',
      userToken: 'user-token',
      adminToken: 'revoked-admin-token',
      verifyUser,
      verifyAdmin,
    })).resolves.toBeNull();
    expect(verifyUser).not.toHaveBeenCalled();
    expect(database.session.findUnique).not.toHaveBeenCalled();
  });

  it('rejects inactive or mismatched admin rows', async () => {
    const verifyAdmin = vi.fn().mockReturnValue({ id: 'admin-1' });
    for (const adminSession of [
      null,
      { ...validAdminSession, adminId: 'admin-2' },
      { ...validAdminSession, admin: { id: 'admin-1', status: 'Inactive' } },
    ]) {
      await expect(resolveHeartbeatActor(db({ adminSession }), {
        page: '/admin',
        adminToken: 'admin-token',
        verifyAdmin,
      })).resolves.toBeNull();
    }
  });
});

