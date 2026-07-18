import prisma from '@/lib/prisma';
import { log } from "@/lib/logger";
import bcrypt from 'bcryptjs';
import { signAdminToken, setAdminCookie, hashToken, detectDevice } from '@/lib/auth';
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
    const previousTokenHash = previousToken ? hashToken(previousToken) : null;

    // Sign first so the durable session can be created while the admin row is
    // locked. The cookie is not exposed until that transaction succeeds.
    const token = signAdminToken(admin);
    const hdrs = await headers();
    const ip = hdrs.get('x-forwarded-for')?.split(',')[0]?.trim() || hdrs.get('x-real-ip') || 'unknown';
    const device = detectDevice(hdrs.get('user-agent'));
    const tHash = hashToken(token);

    const sessionCreated = await prisma.$transaction(async tx => {
      const rows = await tx.$queryRaw`
        SELECT "password", "status"
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

      // Account switching must revoke the browser's previous durable session in
      // the same transaction that creates its replacement. This also revokes
      // every short-lived internal-dashboard grant bound to the old session.
      if (previousTokenHash) {
        await tx.adminSession.deleteMany({
          where: { tokenHash: previousTokenHash },
        });
      }

      await tx.adminSession.create({
        data: {
          adminId: admin.id,
          tokenHash: tHash,
          deviceType: device.type,
          deviceInfo: device.info,
          ip,
        },
      });
      await tx.admin.update({
        where: { id: admin.id },
        data: { lastActive: new Date() },
      });
      return true;
    }, { isolationLevel: 'Serializable' });

    if (!sessionCreated) {
      return error('Credentials changed during login. Please try again.', 401);
    }

    // A browser may switch directly from one admin account to another. Never
    // let the previous account's short-lived dashboard grant cross that boundary.
    clearInternalDashboardGrantCookie(cookieStore);
    await setAdminCookie(token, admin.role);

    return ok({
      admin: {
        id: admin.id,
        name: admin.name,
        email: admin.email,
        role: admin.role,
      },
    });

  } catch (err) {
    log.error('ADMIN LOGIN', err);
    return error('Something went wrong', 500);
  }
}
