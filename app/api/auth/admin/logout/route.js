import { clearAdminCookie, hashToken } from '@/lib/auth';
import { error, ok } from '@/lib/utils';
import { cookies } from 'next/headers';
import prisma from '@/lib/prisma';
import { clearInternalDashboardGrantCookie } from '@/lib/internal-dashboard-access';
import { log } from '@/lib/logger';

export async function POST() {
  const cookieStore = await cookies();
  const token = cookieStore.get('nitro_admin_token')?.value;

  try {
    if (token) {
      const tHash = hashToken(token);
      await prisma.adminSession.deleteMany({ where: { tokenHash: tHash } });
    }
  } catch {
    // Keep both credentials intact so the browser can retry durable revocation.
    log.error('ADMIN LOGOUT', 'Durable session revocation failed');
    return error('Unable to log out. Please try again.', 503);
  }

  clearInternalDashboardGrantCookie(cookieStore);
  await clearAdminCookie();
  return ok({ message: 'Logged out' });
}
