import prisma from '@/lib/prisma';
import { log } from "@/lib/logger";
import { getCurrentAdmin } from '@/lib/auth';
import { ok, error } from '@/lib/utils';

export async function GET() {
  try {
    const session = await getCurrentAdmin();
    if (!session) return error('Not authenticated', 401);

    const full = session._admin || await prisma.admin.findUnique({ where: { id: session.id } });

    if (!full) return error('Admin not found', 404);
    if (full.status === 'Inactive') return error('Account inactive', 403);

    return ok({ admin: { id: full.id, name: full.name, email: full.email, role: full.role, status: full.status, lastActive: full.lastActive } });
  } catch (err) {
    log.error('ADMIN ME', err);
    return error('Something went wrong', 500);
  }
}
