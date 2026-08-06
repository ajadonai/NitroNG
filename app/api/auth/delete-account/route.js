import prisma from '@/lib/prisma';
import { log } from "@/lib/logger";
import { getCurrentUser, clearUserCookie } from '@/lib/auth';
import { sendEmail, accountDeletionEmail, emailWrap, emailDataBox, emailRow } from '@/lib/email';
import {
  completeActiveOrdersForAccountDeletion,
  isOrderCancellationLeaseActive,
  isOrderSettlementAccountEligible,
  lockOrderSettlementAccount,
  withAccountDeletionRetry,
} from '@/lib/account-deletion';
import { rateLimit, rateLimitUnavailable, tooManyRequests } from '@/lib/rate-limit';
import bcrypt from 'bcryptjs';
import { tgUserDeletionRequested } from '@/lib/telegram';

export async function POST(req) {
  try {
    const limit = await rateLimit(req, { maxAttempts: 3, windowMs: 5 * 60 * 1000 });
    if (limit.unavailable) return rateLimitUnavailable(undefined, limit.retryAfter);
    if (limit.limited) return tooManyRequests('Too many attempts. Try again in 5 minutes.', limit.retryAfter);

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

    const completedAt = new Date();
    const deletionDate = new Date(completedAt.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days

    // Atomic: close active orders without refund, mark deletion, clear sessions
    const closedWork = await withAccountDeletionRetry(prisma, async (tx) => {
      // Serialize deletion against order placement. Order creation acquires the
      // same user-row lock through deductBalance, so a request that won first is
      // visible below and a request that lost can no longer spend afterward.
      const lockedUser = await lockOrderSettlementAccount(tx, user.id);
      if (!isOrderSettlementAccountEligible(lockedUser)) {
        throw new Error('ACCOUNT_STATE_CHANGED');
      }

      // A provider cancellation that already claimed the parent is the earlier
      // operation. Do not commit deletion while that worker still owns the
      // right to call the provider; the customer can retry once it settles.
      const cancellationInProgress = await tx.order.findFirst({
        where: { userId: user.id, status: 'Cancelling', deletedAt: null },
        select: { id: true, updatedAt: true },
        orderBy: { updatedAt: 'desc' },
      });
      if (isOrderCancellationLeaseActive(cancellationInProgress, new Date())) {
        return { orders: 0, dispatches: 0, cancellationInProgress: true };
      }

      const completed = await completeActiveOrdersForAccountDeletion(tx, user.id, completedAt);
      await tx.user.update({
        where: { id: user.id },
        data: { status: 'PendingDeletion', deletedAt: deletionDate, deletedName: user.name, deletedEmail: user.email },
      });
      await tx.session.deleteMany({ where: { userId: user.id } });
      return completed;
    });
    if (closedWork.cancellationInProgress) {
      return Response.json({ error: 'An order cancellation is in progress. Please try deleting your account again shortly.' }, { status: 409 });
    }

    // Count user stats for admin email
    const [orderCount, totalSpent] = await Promise.all([
      prisma.order.count({ where: { userId: user.id } }),
      prisma.transaction.aggregate({ where: { userId: user.id, type: 'order' }, _sum: { amount: true } }),
    ]);

    // Keep the internal deletion notice useful without creating another copy
    // of the customer's contact details outside the account record.
    const rows = emailRow('User ID', user.id)
      + emailRow('Balance', '₦' + (user.balance / 100).toLocaleString(), '#059669')
      + emailRow('Total Orders', orderCount)
      + emailRow('Active Orders', closedWork.orders + (closedWork.orders > 0 ? ' (completed, no refund)' : ''), closedWork.orders > 0 ? '#dc2626' : '#333')
      + emailRow('Total Spent', '₦' + ((totalSpent._sum.amount || 0) / 100).toLocaleString())
      + emailRow('Signed Up', user.createdAt.toLocaleDateString('en-NG'));
    const adminHtml = await emailWrap({
      label: 'Account', labelColor: '#dc2626',
      title: 'Account Deletion Requested',
      body: `
        <p class="em-t" style="font-size:15px;line-height:1.7;color:#555;margin:0 0 24px;">Scheduled for permanent deletion on ${deletionDate.toLocaleDateString('en-NG', { year: 'numeric', month: 'long', day: 'numeric' })}.</p>
        ${emailDataBox(rows, '#dc2626')}
        <p class="em-m" style="font-size:13px;color:#9a948d;text-align:center;margin:0 0 12px;">After the deadline, required financial records remain linked only to the internal user ID; customer contact details are removed.</p>
        <p class="em-m" style="font-size:13px;color:#9a948d;text-align:center;margin:0;">The Restore action is available in admin only before ${deletionDate.toLocaleDateString('en-NG', { year: 'numeric', month: 'long', day: 'numeric' })}. After that deadline, the account cannot be restored.</p>
      `,
    });

    // Send to accounts@nitro.ng
    sendEmail('accounts@nitro.ng', `Account deletion requested: ${user.id}`, adminHtml).catch(err =>
      log.error('DeleteAccount', `Admin email failed: ${err.message}`)
    );

    // Send confirmation to user
    const userHtml = await accountDeletionEmail(user.firstName || user.name, 30);

    sendEmail(user.email, 'Your Nitro account is scheduled for deletion', userHtml).catch(err =>
      log.error('DeleteAccount', `User email failed: ${err.message}`)
    );

    tgUserDeletionRequested(user.id, orderCount, totalSpent._sum.amount || 0);

    // Clear session cookie
    await clearUserCookie();

    return Response.json({ success: true, message: 'Account scheduled for deletion in 30 days' });
  } catch (err) {
    log.error('Delete Account', err.message);
    return Response.json({ error: 'Failed to delete account' }, { status: 500 });
  }
}
