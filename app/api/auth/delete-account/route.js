import prisma from '@/lib/prisma';
import { log } from "@/lib/logger";
import { getCurrentUser, clearUserCookie } from '@/lib/auth';
import { cancelOrder, isProviderConfigured } from '@/lib/smm';
import bcrypt from 'bcryptjs';

export async function POST(req) {
  try {
    const payload = await getCurrentUser();
    if (!payload) return Response.json({ error: 'Not authenticated' }, { status: 401 });

    const { password } = await req.json().catch(() => ({}));

    const user = await prisma.user.findUnique({ where: { id: payload.id } });
    if (!user) return Response.json({ error: 'User not found' }, { status: 404 });

    // Require password confirmation
    if (!password) return Response.json({ error: 'Password required to delete account' }, { status: 400 });
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return Response.json({ error: 'Incorrect password' }, { status: 400 });

    // Cancel active orders and refund
    const activeOrders = await prisma.order.findMany({
      where: { userId: user.id, status: { in: ['Pending', 'Processing'] } },
      include: { service: { select: { provider: true } } },
    });

    const refundOps = [];
    let totalRefund = 0;
    for (const order of activeOrders) {
      // Try to cancel on the correct provider (best effort, don't block deletion)
      const provider = order.service?.provider || 'mtp';
      if (order.apiOrderId && isProviderConfigured(provider)) {
        try { await cancelOrder(provider, order.apiOrderId); } catch {}
      }
      refundOps.push(prisma.order.update({ where: { id: order.id }, data: { status: 'Cancelled' } }));
      refundOps.push(prisma.transaction.create({
        data: { userId: user.id, type: 'refund', amount: order.charge, status: 'Completed', note: `Refund — account deleted (order ${order.orderId})` },
      }));
      totalRefund += order.charge;
    }

    // Soft delete — anonymize public data but preserve originals for admin
    const anonymizedEmail = `deleted_${user.id}@nitro.ng`;
    const anonymizedName = `Deleted User`;
    const finalBalance = user.balance + totalRefund;

    await prisma.$transaction([
      ...refundOps,
      // Zero out balance — record remaining balance as a transaction for audit
      ...(finalBalance > 0 ? [prisma.transaction.create({
        data: { userId: user.id, type: 'admin_credit', amount: -finalBalance, status: 'Completed', note: `Balance cleared on account deletion (was ₦${(finalBalance / 100).toLocaleString()})` },
      })] : []),
      prisma.user.update({
        where: { id: user.id },
        data: {
          deletedName: user.name,
          deletedEmail: user.email,
          deletedAt: new Date(),
          name: anonymizedName,
          email: anonymizedEmail,
          password: '',
          balance: 0,
          emailVerified: false,
          referralCode: `DEL-${user.id.slice(0, 8)}`,
          referredBy: null,
          status: 'Deleted',
          verifyToken: null,
          resetToken: null,
        },
      }),
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
