import { clearAdminCookie } from '@/lib/auth';
import { ok } from '@/lib/utils';

export async function POST() {
  await clearAdminCookie();
  return ok({ message: 'Logged out' });
}
