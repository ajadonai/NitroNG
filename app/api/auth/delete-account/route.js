import prisma from '@/lib/prisma';
import { log } from "@/lib/logger";
import { getCurrentUser, clearUserCookie } from '@/lib/auth';
import { sendEmail, accountDeletionEmail, emailWrap, emailDataBox, emailRow } from '@/lib/email';
import { cancelOrder, isProviderConfigured } from '@/lib/smm';
import { rateLimit, tooManyRequests } from '@/lib/rate-limit';
import bcrypt from 'bcryptjs';

export async function POST(req) {
  try {
    const { limited } = await rateLimit(req, { maxAttempts: 3, windowMs: 5 * 60 * 1000 });
    if (limited) return tooManyRequests('Too many attempts. Try again in 5 minutes.');

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

    // Cancel active orders on providers (best-effort, before transaction)
    const activeOrders = await prisma.order.findMany({
      where: { userId: user.id, status: { in: ['Pending', 'Processing'] }, deletedAt: null },
      include: { service: { select: { provider: true } } },
    });
    for (const order of activeOrders) {
      const provider = order.service?.provider || 'mtp';
      if (order.apiOrderId && isProviderConfigured(provider)) {
        try { await cancelOrder(provider, order.apiOrderId); } catch (err) { log.warn('Cancel order on deletion', err.message); }
      }
    }

    // Atomic: claim active orders, refund, mark deletion, clear sessions
    const totalRefund = await prisma.$transaction(async (tx) => {
      const claimable = await tx.order.findMany({
        where: { userId: user.id, status: { in: ['Pending', 'Processing'] }, deletedAt: null },
        select: { id: true, orderId: true, charge: true },
      });
      let refund = 0;
      for (const order of claimable) {
        const claimed = await tx.order.updateMany({
          where: { id: order.id, status: { in: ['Pending', 'Processing'] } },
          data: { status: 'Cancelled' },
        });
        if (claimed.count > 0) {
          refund += order.charge;
          await tx.transaction.create({
            data: { userId: user.id, type: 'refund', amount: order.charge, status: 'Completed', reference: `REF-${order.orderId}`, note: `Refund — account deletion (order ${order.orderId})` },
          });
        }
      }
      if (refund > 0) {
        await tx.user.update({ where: { id: user.id }, data: { balance: { increment: refund } } });
      }
      await tx.user.update({
        where: { id: user.id },
        data: { status: 'PendingDeletion', deletedAt: deletionDate, deletedName: user.name, deletedEmail: user.email },
      });
      await tx.session.deleteMany({ where: { userId: user.id } });
      return refund;
    });

    // Count user stats for admin email
    const [orderCount, totalSpent, activeOrderCount] = await Promise.all([
      prisma.order.count({ where: { userId: user.id } }),
      prisma.transaction.aggregate({ where: { userId: user.id, type: 'order' }, _sum: { amount: true } }),
      prisma.order.count({ where: { userId: user.id, status: { in: ['Pending', 'Processing'] } } }),
    ]);

    // Send data dump email to accounts@nitro.ng
    const rows = emailRow('Name', user.name)
      + emailRow('Email', user.email)
      + emailRow('Balance', '₦' + (user.balance / 100).toLocaleString(), '#059669')
      + emailRow('Total Orders', orderCount)
      + emailRow('Active Orders', activeOrderCount + (activeOrderCount > 0 ? ' (cancelled + refunded)' : ''), activeOrderCount > 0 ? '#dc2626' : '#333')
      + emailRow('Refunded', '₦' + (totalRefund / 100).toLocaleString(), totalRefund > 0 ? '#dc2626' : '#333')
      + emailRow('Total Spent', '₦' + ((totalSpent._sum.amount || 0) / 100).toLocaleString())
      + emailRow('Referral Code', user.referralCode || 'None')
      + emailRow('User ID', user.id)
      + emailRow('Signed Up', user.createdAt.toLocaleDateString('en-NG'));
    const adminHtml = await emailWrap({
      label: 'Account', labelColor: '#dc2626',
      title: 'Account Deletion Requested',
      body: `
        <p class="em-t" style="font-size:15px;line-height:1.7;color:#555;margin:0 0 24px;">Scheduled for permanent deletion on ${deletionDate.toLocaleDateString('en-NG', { year: 'numeric', month: 'long', day: 'numeric' })}.</p>
        ${emailDataBox(rows, '#dc2626')}
        <p class="em-m" style="font-size:13px;color:#9a948d;text-align:center;margin:0;">To reinstate this account, update the user status back to "Active" in the admin panel before ${deletionDate.toLocaleDateString('en-NG', { year: 'numeric', month: 'long', day: 'numeric' })}.</p>
      `,
    });

    // Send to accounts@nitro.ng
    sendEmail('accounts@nitro.ng', `Account Deletion: ${user.name} (${user.email})`, adminHtml).catch(err =>
      log.error('DeleteAccount', `Admin email failed: ${err.message}`)
    );

    // Send confirmation to user
    const userHtml = await accountDeletionEmail(user.firstName || user.name, 30);

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
