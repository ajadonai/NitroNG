import prisma from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';
import { ok, error } from '@/lib/utils';

const FIELDS = { wallet: 'firstSeenWalletAt', new_order: 'firstSeenNewOrderAt' };

/** Records the first time a user opens a surface. Later calls are no-ops. */
export async function POST(req) {
  try {
    const session = await getCurrentUser();
    if (!session) return error('Not authenticated', 401);
    const { surface } = await req.json().catch(() => ({}));
    const field = FIELDS[surface];
    if (!field) return error('Unknown surface', 400);
    await prisma.user.updateMany({ where: { id: session.id, [field]: null }, data: { [field]: new Date() } });
    return ok({});
  } catch (e) {
    return error('Request failed', 500);
  }
}
