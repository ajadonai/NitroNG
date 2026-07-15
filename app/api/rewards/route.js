import { getCurrentUser } from '@/lib/auth';
import { ok, error } from '@/lib/utils';
import { getRewardsPayload } from '@/lib/nitro-rewards';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return error('Unauthorized', 401);

  const rewards = await getRewardsPayload(user.id);
  return ok(rewards);
}
