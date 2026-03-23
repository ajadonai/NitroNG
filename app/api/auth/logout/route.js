import { clearUserCookie } from '@/lib/auth';
import { ok } from '@/lib/utils';

export async function POST() {
  await clearUserCookie();
  return ok({ message: 'Logged out' });
}
