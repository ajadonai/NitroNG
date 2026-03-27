import prisma from '@/lib/prisma';
import { getCurrentUser, clearUserCookie } from '@/lib/auth';

export async function POST() {
  try {
    const payload = await getCurrentUser();
    if (!payload) return Response.json({ error: 'Not authenticated' }, { status: 401 });

    const user = await prisma.user.findUnique({ where: { id: payload.id } });
    if (!user) return Response.json({ error: 'User not found' }, { status: 404 });

    // Soft delete — anonymize personal data but keep orders/transactions for records
    // Orders and transactions reference userId, which stays — but the user row is anonymized
    const anonymizedEmail = `deleted_${user.id}@nitro.ng`;
    const anonymizedName = `Deleted User`;

    await prisma.user.update({
      where: { id: user.id },
      data: {
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
    });

    // Clear session cookie
    await clearUserCookie();

    return Response.json({ success: true, message: 'Account deleted' });
  } catch (err) {
    console.error('[Delete Account]', err.message);
    return Response.json({ error: 'Failed to delete account' }, { status: 500 });
  }
}
