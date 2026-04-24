import { clearUserCookie, hashToken } from '@/lib/auth';
import { ok } from '@/lib/utils';
import { cookies } from 'next/headers';
import prisma from '@/lib/prisma';
import { log } from '@/lib/logger';

export async function POST() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('nitro_token')?.value;
    if (token) {
      const tHash = hashToken(token);
      await prisma.session.deleteMany({ where: { tokenHash: tHash } });
    }
  } catch (err) { log.warn('Logout session cleanup', err.message); }
  await clearUserCookie();
  return ok({ message: 'Logged out' });
}
