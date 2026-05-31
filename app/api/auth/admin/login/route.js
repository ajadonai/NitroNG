import prisma from '@/lib/prisma';
import { log } from "@/lib/logger";
import bcrypt from 'bcryptjs';
import { signAdminToken, setAdminCookie, hashToken, detectDevice } from '@/lib/auth';
import { ok, error } from '@/lib/utils';
import { rateLimit, tooManyRequests } from '@/lib/rate-limit';
import { sanitizeEmail } from '@/lib/validate';
import { headers } from 'next/headers';

export async function POST(req) {
  try {
    const { limited } = await rateLimit(req, { maxAttempts: 5, windowMs: 5 * 60 * 1000 });
    if (limited) return tooManyRequests('Too many login attempts. Try again in 5 minutes.');

    const body = await req.json();
    const email = sanitizeEmail(body.email);
    const password = body.password;

    if (!email || !password) {
      return error('Email and password are required');
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

    // Sign JWT and set cookie
    const token = signAdminToken(admin);
    await setAdminCookie(token, admin.role);

    // Create admin session
    const hdrs = await headers();
    const ip = hdrs.get('x-forwarded-for')?.split(',')[0]?.trim() || hdrs.get('x-real-ip') || 'unknown';
    const device = detectDevice(hdrs.get('user-agent'));
    const tHash = hashToken(token);

    await prisma.$transaction([
      prisma.adminSession.deleteMany({ where: { adminId: admin.id } }),
      prisma.adminSession.create({ data: { adminId: admin.id, tokenHash: tHash, deviceInfo: device.info, ip } }),
      prisma.admin.update({ where: { id: admin.id }, data: { lastActive: new Date() } }),
    ]);

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
