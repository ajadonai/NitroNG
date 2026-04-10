import prisma from '@/lib/prisma';
import { log } from "@/lib/logger";
import { getCurrentUser, clearUserCookie } from '@/lib/auth';

export async function POST() {
  try {
    const payload = await getCurrentUser();
    if (!payload) return Response.json({ error: 'Not authenticated' }, { status: 401 });

    const user = await prisma.user.findUnique({ where: { id: payload.id } });
    if (!user) return Response.json({ error: 'User not found' }, { status: 404 });

    // Soft delete — anonymize public data but preserve originals for admin
    const anonymizedEmail = `deleted_${user.id}@nitro.ng`;
    const anonymizedName = `Deleted User`;

    await prisma.$transaction([
      prisma.user.update({
        where: { id: user.id },
        data: {
          deletedName: user.name,
          deletedEmail: user.email,
          deletedAt: new Date(),
          name: anonymizedName,
          email: anonymizedEmail,
          password: '', // Can't login anymore
          emailVerified: false,
          referralCode: `DEL-${user.id.slice(0, 8)}`,
          referredBy: null,
          status: 'Deleted',
          verifyToken: null,
          resetToken: null,
        },
      }),
      // Kill all active sessions so other devices can't access the account
      prisma.session.deleteMany({ where: { userId: user.id } }),
    ]);

    // Clear session cookie
    await clearUserCookie();

    return Response.json({ success: true, message: 'Account deleted' });
  } catch (err) {
    log.error('Delete Account', err.message);
    return Response.json({ error: 'Failed to delete account' }, { status: 500 });
  }
}
