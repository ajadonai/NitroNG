import prisma from '@/lib/prisma';
import { log } from "@/lib/logger";
import { getCurrentUser, clearUserCookie } from '@/lib/auth';
import { sendEmail, accountDeletionEmail } from '@/lib/email';
import { cancelOrder, isProviderConfigured } from '@/lib/smm';
import bcrypt from 'bcryptjs';

export async function POST(req) {
  try {
    const payload = await getCurrentUser();
    if (!payload) return Response.json({ error: 'Not authenticated' }, { status: 401 });

    const { password } = await req.json().catch(() => ({}));

    const user = await prisma.user.findUnique({ where: { id: payload.id } });
    if (!user) return Response.json({ error: 'User not found' }, { status: 404 });

    if (!password) return Response.json({ error: 'Password required to delete account' }, { status: 400 });
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return Response.json({ error: 'Incorrect password' }, { status: 400 });

    if (user.status === 'PendingDeletion') {
      return Response.json({ error: 'Account is already scheduled for deletion' }, { status: 400 });
    }

    const deletionDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

    // Cancel active orders and refund wallet
    const activeOrders = await prisma.order.findMany({
      where: { userId: user.id, status: { in: ['Pending', 'Processing'] } },
      include: { service: { select: { provider: true } } },
    });

    const refundOps = [];
    let totalRefund = 0;
    for (const order of activeOrders) {
      const provider = order.service?.provider || 'mtp';
      if (order.apiOrderId && isProviderConfigured(provider)) {
        try { await cancelOrder(provider, order.apiOrderId); } catch {}
      }
      refundOps.push(prisma.order.update({ where: { id: order.id }, data: { status: 'Cancelled' } }));
      refundOps.push(prisma.transaction.create({
        data: { userId: user.id, type: 'refund', amount: order.charge, status: 'Completed', note: `Refund — account deletion (order ${order.orderId})` },
      }));
      totalRefund += order.charge;
    }

    // Mark account for pending deletion + refund active orders
    await prisma.$transaction([
      ...refundOps,
      ...(totalRefund > 0 ? [prisma.user.update({ where: { id: user.id }, data: { balance: { increment: totalRefund } } })] : []),
      prisma.user.update({
        where: { id: user.id },
        data: {
          status: 'PendingDeletion',
          deletedAt: deletionDate,
          deletedName: user.name,
          deletedEmail: user.email,
        },
      }),
      // Invalidate all sessions
      prisma.session.deleteMany({ where: { userId: user.id } }),
    ]);

    // Count user stats for admin email
    const [orderCount, totalSpent, activeOrderCount] = await Promise.all([
      prisma.order.count({ where: { userId: user.id } }),
      prisma.transaction.aggregate({ where: { userId: user.id, type: 'order' }, _sum: { amount: true } }),
      prisma.order.count({ where: { userId: user.id, status: { in: ['Pending', 'Processing'] } } }),
    ]);

    // Send data dump email to accounts@nitro.ng
    const adminHtml = `
      <div style="font-family: 'Helvetica Neue', Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 40px 20px;">
        <table width="48" height="48" cellpadding="0" cellspacing="0" border="0" style="margin: 0 auto 24px;">
          <tr><td align="center" valign="middle" width="48" height="48" style="border-radius: 14px; background-color: #c47d8e; font-size: 22px; font-weight: 700; color: #ffffff; font-family: Arial, sans-serif;">N</td></tr>
        </table>
        <h1 style="font-size: 20px; font-weight: 600; color: #1a1a1a; text-align: center; margin-bottom: 4px;">Account Deletion Requested</h1>
        <p style="font-size: 14px; color: #999; text-align: center; margin-bottom: 24px;">Scheduled for permanent deletion on ${deletionDate.toLocaleDateString('en-NG', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
        <div style="background: #f5f3f0; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
          <table style="width: 100%; font-size: 14px; border-collapse: collapse;">
            <tr><td style="color: #999; padding: 6px 0;">Name</td><td style="text-align: right; padding: 6px 0; font-weight: 600; color: #1a1a1a;">${user.name}</td></tr>
            <tr><td style="color: #999; padding: 6px 0;">Email</td><td style="text-align: right; padding: 6px 0; font-weight: 600; color: #1a1a1a;">${user.email}</td></tr>
            <tr><td style="color: #999; padding: 6px 0;">Balance</td><td style="text-align: right; padding: 6px 0; font-weight: 600; color: #059669;">₦${(user.balance / 100).toLocaleString()}</td></tr>
            <tr><td style="color: #999; padding: 6px 0;">Total Orders</td><td style="text-align: right; padding: 6px 0; font-weight: 600; color: #1a1a1a;">${orderCount}</td></tr>
            <tr><td style="color: #999; padding: 6px 0;">Active Orders</td><td style="text-align: right; padding: 6px 0; font-weight: 600; color: ${activeOrderCount > 0 ? '#dc2626' : '#1a1a1a'};">${activeOrderCount}${activeOrderCount > 0 ? ' (cancelled + refunded)' : ''}</td></tr>
            <tr><td style="color: #999; padding: 6px 0;">Refunded</td><td style="text-align: right; padding: 6px 0; font-weight: 600; color: ${totalRefund > 0 ? '#dc2626' : '#1a1a1a'};">₦${(totalRefund / 100).toLocaleString()}</td></tr>
            <tr><td style="color: #999; padding: 6px 0;">Total Spent</td><td style="text-align: right; padding: 6px 0; font-weight: 600; color: #1a1a1a;">₦${((totalSpent._sum.amount || 0) / 100).toLocaleString()}</td></tr>
            <tr><td style="color: #999; padding: 6px 0;">Referral Code</td><td style="text-align: right; padding: 6px 0; font-family: monospace; font-size: 12px; color: #666;">${user.referralCode || 'None'}</td></tr>
            <tr><td style="color: #999; padding: 6px 0;">User ID</td><td style="text-align: right; padding: 6px 0; font-family: monospace; font-size: 12px; color: #666;">${user.id}</td></tr>
            <tr><td style="color: #999; padding: 6px 0;">Signed Up</td><td style="text-align: right; padding: 6px 0; color: #1a1a1a;">${user.createdAt.toLocaleDateString('en-NG')}</td></tr>
          </table>
        </div>
        <p style="font-size: 13px; color: #999; text-align: center;">To reinstate this account, update the user status back to "Active" in the admin panel before ${deletionDate.toLocaleDateString('en-NG', { year: 'numeric', month: 'long', day: 'numeric' })}.</p>
        <div style="margin-top: 30px; padding-top: 16px; border-top: 1px solid #eee; text-align: center;">
          <p style="font-size: 12px; color: #bbb;">Nitro — Account Management</p>
        </div>
      </div>
    `;

    // Send to accounts@nitro.ng
    sendEmail('accounts@nitro.ng', `Account Deletion: ${user.name} (${user.email})`, adminHtml).catch(err =>
      log.error('DeleteAccount', `Admin email failed: ${err.message}`)
    );

    // Send confirmation to user
    const userHtml = accountDeletionEmail(user.firstName || user.name, 30);

    sendEmail(user.email, 'Your Nitro account is scheduled for deletion', userHtml).catch(err =>
      log.error('DeleteAccount', `User email failed: ${err.message}`)
    );

    // Clear session cookie
    await clearUserCookie();

    return Response.json({ success: true, message: 'Account scheduled for deletion in 30 days' });
  } catch (err) {
    log.error('Delete Account', err.message);
    return Response.json({ error: 'Failed to delete account' }, { status: 500 });
  }
}
