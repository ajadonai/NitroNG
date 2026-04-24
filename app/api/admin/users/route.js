import prisma from '@/lib/prisma';
import { log } from "@/lib/logger";
import { requireAdmin, logActivity, canPerformAction } from '@/lib/admin';
import { sendEmail, walletCreditEmail } from '@/lib/email';

export async function GET(req) {
  const { admin, error } = await requireAdmin('users');
  if (error) return error;

  try {
    const url = new URL(req.url);
    const cursor = url.searchParams.get('cursor');
    const limit = Math.min(Number(url.searchParams.get('limit')) || 50, 200);

    const users = await prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      select: {
        id: true, name: true, firstName: true, lastName: true, phone: true,
        email: true, balance: true, status: true,
        emailVerified: true, referralCode: true, createdAt: true,
        deletedAt: true, deletedName: true, deletedEmail: true,
        _count: { select: { orders: true } },
      },
    });

    const hasMore = users.length > limit;
    const items = hasMore ? users.slice(0, limit) : users;
    const nextCursor = hasMore ? items[items.length - 1].id : null;

    return Response.json({
      users: items.map(u => ({
        id: u.id,
        name: u.name,
        firstName: u.firstName,
        lastName: u.lastName,
        phone: u.phone,
        email: u.email,
        balance: u.balance / 100,
        verified: u.emailVerified,
        orders: u._count.orders,
        status: u.status,
        refCode: u.referralCode,
        joined: u.createdAt.toISOString(),
        deletedAt: u.deletedAt?.toISOString() || null,
        deletedName: u.deletedName || null,
        deletedEmail: u.deletedEmail || null,
      })),
      nextCursor,
      hasMore,
    });
  } catch (err) {
    log.error('Admin Users', err.message);
    return Response.json({ error: 'Failed to load users' }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const body = await req.json();
    const { action, userId, amount, subtype } = body;

    if (!userId) return Response.json({ error: 'User ID required' }, { status: 400 });

    // Transactions is read-only — doesn't need write permission
    if (action === 'transactions') {
      const { admin, error } = await requireAdmin('users');
      if (error) return error;
      const transactions = await prisma.transaction.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 200,
        select: { id: true, type: true, amount: true, status: true, method: true, reference: true, note: true, createdAt: true },
      });
      return Response.json({ transactions });
    }

    // All other actions require write permission
    const { admin, error } = await requireAdmin('users', true);
    if (error) return error;

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return Response.json({ error: 'User not found' }, { status: 404 });

    if (action === 'credit') {
      if (!canPerformAction(admin, 'users.adjustBalance')) return Response.json({ error: 'Not authorized to adjust balances' }, { status: 403 });
      const amountKobo = Math.round(Number(amount) * 100);
      if (!amountKobo || amountKobo <= 0) return Response.json({ error: 'Invalid amount' }, { status: 400 });
      const isGift = subtype === 'gift';
      const txType = isGift ? 'admin_gift' : 'admin_credit';
      const label = isGift ? 'Gifted' : 'Credited';

      await prisma.$transaction([
        prisma.user.update({
          where: { id: userId },
          data: { balance: { increment: amountKobo } },
        }),
        prisma.transaction.create({
          data: {
            userId,
            type: txType,
            amount: amountKobo,
            method: 'admin',
            status: 'Completed',
            note: `${label} by Nitro Team`,
          },
        }),
      ]);

      await logActivity(admin.name, `${label} ₦${Number(amount).toLocaleString()} to ${user.name}`, 'user');

      // Email notification
      if (user.email && user.notifEmail !== false) {
        const reason = isGift ? 'You received a gift!' : 'Balance credited';
        walletCreditEmail(user.name, Number(amount), reason).then(html => sendEmail(user.email, `₦${Number(amount).toLocaleString()} credited to your Nitro wallet`, html)).catch(() => {});
      }

      return Response.json({ success: true, message: `₦${Number(amount).toLocaleString()} credited to ${user.name}` });
    }

    if (action === 'suspend') {
      if (!canPerformAction(admin, 'users.ban')) return Response.json({ error: 'Not authorized to suspend users' }, { status: 403 });
      await prisma.user.update({ where: { id: userId }, data: { status: 'Suspended' } });
      await logActivity(admin.name, `Suspended user ${user.name}`, 'user');
      return Response.json({ success: true, message: `${user.name} suspended` });
    }

    if (action === 'activate') {
      await prisma.user.update({ where: { id: userId }, data: { status: 'Active' } });
      await logActivity(admin.name, `Activated user ${user.name}`, 'user');
      return Response.json({ success: true, message: `${user.name} activated` });
    }

    if (action === 'reinstate') {
      const originalName = user.deletedName || user.name;
      const originalEmail = user.deletedEmail || user.email;
      await prisma.user.update({
        where: { id: userId },
        data: {
          status: 'Active',
          name: originalName,
          email: originalEmail,
          deletedAt: null,
          deletedName: null,
          deletedEmail: null,
        },
      });
      await logActivity(admin.name, `Reinstated user ${originalName} (${originalEmail})`, 'user');
      return Response.json({ success: true, message: `${originalName} reinstated` });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (err) {
    log.error('Admin Users POST', err.message);
    return Response.json({ error: 'Action failed' }, { status: 500 });
  }
}
