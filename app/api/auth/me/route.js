import prisma from '@/lib/prisma';
import { log } from "@/lib/logger";
import { getCurrentUser } from '@/lib/auth';
import { ok, error } from '@/lib/utils';

export async function GET() {
  try {
    const session = await getCurrentUser();
    if (!session) return error('Not authenticated', 401);

    const user = await prisma.user.findUnique({
      where: { id: session.id },
      select: {
        id: true,
        name: true,
        firstName: true,
        lastName: true,
        phone: true,
        email: true,
        balance: true,
        referralCode: true,
        emailVerified: true,
        notifOrders: true,
        notifPromo: true,
        notifEmail: true,
        notifClearedAt: true,
        notifReadIds: true,
        status: true,
        createdAt: true,
      },
    });

    if (!user) return error('User not found', 404);
    if (user.status === 'Suspended') return error('Account suspended', 403);

    return ok({ user });
  } catch (err) {
    log.error('ME', err);
    return error('Something went wrong', 500);
  }
}
