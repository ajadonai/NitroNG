import prisma from '@/lib/prisma';
import { log } from "@/lib/logger";
import { requireAdmin, logActivity, canPerformAction } from '@/lib/admin';

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
  const { admin, error } = await requireAdmin('users', true);
  if (error) return error;

  try {
    const { action, userId, amount } = await req.json();

    if (!userId) return Response.json({ error: 'User ID required' }, { status: 400 });

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return Response.json({ error: 'User not found' }, { status: 404 });

    if (action === 'credit') {
      if (!canPerformAction(admin, 'users.adjustBalance')) return Response.json({ error: 'Not authorized to adjust balances' }, { status: 403 });
      const amountKobo = Math.round(Number(amount) * 100);
      if (!amountKobo || amountKobo <= 0) return Response.json({ error: 'Invalid amount' }, { status: 400 });

      await prisma.$transaction([
        prisma.user.update({
          where: { id: userId },
          data: { balance: { increment: amountKobo } },
        }),
        prisma.transaction.create({
          data: {
            userId,
            type: 'admin_credit',
            amount: amountKobo,
            method: 'admin',
            status: 'Completed',
            note: `Credited by ${admin.name}`,
          },
        }),
      ]);

      await logActivity(admin.name, `Credited ₦${Number(amount).toLocaleString()} to ${user.name}`, 'user');
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

    if (action === 'transactions') {
      const transactions = await prisma.transaction.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 200,
        select: { id: true, type: true, amount: true, status: true, method: true, reference: true, note: true, createdAt: true },
      });
      return Response.json({ transactions });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (err) {
    log.error('Admin Users POST', err.message);
    return Response.json({ error: 'Action failed' }, { status: 500 });
  }
}
