import { clearAdminCookie, hashToken } from '@/lib/auth';
import { ok } from '@/lib/utils';
import { cookies } from 'next/headers';
import prisma from '@/lib/prisma';
import { clearInternalDashboardGrantCookie } from '@/lib/internal-dashboard-access';

export async function POST() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('nitro_admin_token')?.value;
    if (token) {
      const tHash = hashToken(token);
      await prisma.adminSession.deleteMany({ where: { tokenHash: tHash } });
    }
  } catch {}
  const cookieStore = await cookies();
  clearInternalDashboardGrantCookie(cookieStore);
  await clearAdminCookie();
  return ok({ message: 'Logged out' });
}
