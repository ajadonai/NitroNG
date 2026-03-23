import prisma from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { signAdminToken, setAdminCookie } from '@/lib/auth';
import { ok, error } from '@/lib/utils';

export async function POST(req) {
  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return error('Email and password are required');
    }

    const admin = await prisma.admin.findUnique({
      where: { email: email.toLowerCase().trim() },
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

    // Update last active
    await prisma.admin.update({
      where: { id: admin.id },
      data: { lastActive: new Date() },
    });

    // Sign JWT and set cookie
    const token = signAdminToken(admin);
    await setAdminCookie(token);

    return ok({
      admin: {
        id: admin.id,
        name: admin.name,
        email: admin.email,
        role: admin.role,
      },
    });

  } catch (err) {
    console.error('[ADMIN LOGIN]', err);
    return error('Something went wrong', 500);
  }
}
