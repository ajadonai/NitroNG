import prisma from '@/lib/prisma';
import { getCurrentAdmin } from '@/lib/auth';
import { ok, error } from '@/lib/utils';

export async function GET() {
  try {
    const session = await getCurrentAdmin();
    if (!session) return error('Not authenticated', 401);

    const admin = await prisma.admin.findUnique({
      where: { id: session.id },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true,
        lastActive: true,
      },
    });

    if (!admin) return error('Admin not found', 404);
    if (admin.status === 'Inactive') return error('Account inactive', 403);

    return ok({ admin });
  } catch (err) {
    console.error('[ADMIN ME]', err);
    return error('Something went wrong', 500);
  }
}
