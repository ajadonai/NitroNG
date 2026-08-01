import prisma from '@/lib/prisma';
import { log } from "@/lib/logger";
import bcrypt from 'bcryptjs';
import {
  createSessionId,
  detectDevice,
  hashToken,
  setAdminCookie,
  signAdminToken,
  verifyAdminToken,
} from '@/lib/auth';
import { ok, error } from '@/lib/utils';
import {
  accountRateLimitKey,
  rateLimit,
  rateLimitUnavailable,
  tooManyRequests,
} from '@/lib/rate-limit';
import { sanitizeEmail } from '@/lib/validate';
import { cookies, headers } from 'next/headers';
import { clearInternalDashboardGrantCookie } from '@/lib/internal-dashboard-access';

export async function POST(req) {
  try {
    const limit = await rateLimit(req, { maxAttempts: 5, windowMs: 5 * 60 * 1000 });
    if (limit.unavailable) return rateLimitUnavailable(undefined, limit.retryAfter);
    if (limit.limited) return tooManyRequests('Too many login attempts. Try again in 5 minutes.', limit.retryAfter);

    const body = await req.json();
    const email = sanitizeEmail(body.email);
    const password = body.password;
    const remember = body.remember === true;

    if (!email || !password) {
      return error('Email and password are required');
    }

    const accountLimit = await rateLimit(req, {
      maxAttempts: 8,
      windowMs: 15 * 60 * 1000,
      key: accountRateLimitKey(email, 'admin-login'),
    });
    if (accountLimit.unavailable) {
      return rateLimitUnavailable(undefined, accountLimit.retryAfter);
    }
    if (accountLimit.limited) {
      return tooManyRequests(
        'Too many login attempts for this account. Try again in 15 minutes.',
        accountLimit.retryAfter,
      );
    }

    const admin = await prisma.admin.findUnique({
      where: { email },
    });

    if (!admin) {
      return error('Invalid credentials. Contact the super admin if you need access.', 401);
    }

    if (admin.status === 'Inactive') {
      return error('Your admin account is inactive.', 403);
    }

    const valid = await bcrypt.compare(password, admin.password);
    if (!valid) {
      return error('Invalid credentials. Contact the super admin if you need access.', 401);
    }

    const cookieStore = await cookies();
    const previousToken = cookieStore.get('nitro_admin_token')?.value;
    const previousPayload = previousToken ? verifyAdminToken(previousToken) : null;
    const previousTokenHash = previousToken ? hashToken(previousToken) : null;

    const hdrs = await headers();
    const ip = hdrs.get('x-forwarded-for')?.split(',')[0]?.trim() || hdrs.get('x-real-ip') || 'unknown';
    const device = detectDevice(hdrs.get('user-agent'));

    const sid = createSessionId();

    const sessionResult = await prisma.$transaction(async tx => {
      const rows = await tx.$queryRaw`
        SELECT "id", "name", "email", "role", "password", "status"
        FROM "admins"
        WHERE "id" = ${admin.id}
        FOR UPDATE
      `;
      const lockedAdmin = rows[0];
      if (!lockedAdmin
        || lockedAdmin.status !== 'Active'
        || lockedAdmin.password !== admin.password) {
        return false;
      }

      if (previousPayload?.sid) {
        await tx.adminSession.deleteMany({
          where: {
            id: previousPayload.sid,
            adminId: previousPayload.id,
          },
        });
      } else if (previousTokenHash) {
        await tx.adminSession.deleteMany({ where: { tokenHash: previousTokenHash } });
      }

      const lockedIdentity = {
        id: lockedAdmin.id,
        name: lockedAdmin.name,
        email: lockedAdmin.email,
        role: lockedAdmin.role,
      };
      const token = signAdminToken(lockedIdentity, { remember, sid });
      const tokenHash = hashToken(token);
      await tx.adminSession.create({
        data: {
          id: sid,
          adminId: lockedIdentity.id,
          tokenHash,
          remember,
          deviceType: device.type,
          deviceInfo: device.info,
          ip,
        },
      });
      await tx.admin.update({
        where: { id: admin.id },
        data: { lastActive: new Date() },
      });
      return { admin: lockedIdentity, token };
    }, { isolationLevel: 'Serializable' });

    if (!sessionResult) {
      return error('Credentials changed during login. Please try again.', 401);
    }

    clearInternalDashboardGrantCookie(cookieStore);
    await setAdminCookie(sessionResult.token, sessionResult.admin.role, { remember });

    return ok({
      admin: sessionResult.admin,
    });

  } catch (err) {
    log.error('ADMIN LOGIN', err);
    return error('Something went wrong', 500);
  }
}
