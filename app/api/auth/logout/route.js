import { clearUserCookie, verifyUserToken, hashToken } from '@/lib/auth';
import { error, ok } from '@/lib/utils';
import { cookies } from 'next/headers';
import prisma from '@/lib/prisma';
import { log } from '@/lib/logger';

export async function POST() {
  const cookieStore = await cookies();
  const token = cookieStore.get('nitro_token')?.value;

  try {
    if (token) {
      const payload = verifyUserToken(token);
      if (payload?.sid) {
        await prisma.session.deleteMany({ where: { id: payload.sid } });
      } else {
        const tHash = hashToken(token);
        await prisma.session.deleteMany({ where: { tokenHash: tHash } });
      }
    }
  } catch {
    log.error('USER LOGOUT', 'Durable session revocation failed');
    return error('Unable to log out. Please try again.', 503);
  }

  await clearUserCookie();
  return ok({ message: 'Logged out' });
}
