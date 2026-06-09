import prisma from '@/lib/prisma';
import { log } from "@/lib/logger";
import { requireAdmin, logActivity, canPerformAction } from '@/lib/admin';

export async function GET(req) {
  const { admin, error } = await requireAdmin('finance');
  if (error) return error;

  try {
    const url = new URL(req.url);
    const fromParam = url.searchParams.get('from');
    const toParam = url.searchParams.get('to');

    const where = {};
    if (fromParam) {
      where.createdAt = { gte: new Date(fromParam) };
      if (toParam) {
        const until = new Date(toParam);
        until.setHours(23, 59, 59, 999);
        where.createdAt.lte = until;
      }
    }

    const [topups, totals] = await Promise.all([
      prisma.providerTopup.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: 100,
      }),
      prisma.providerTopup.groupBy({
        by: ['provider'],
        where,
        _sum: { amount: true },
        _count: true,
      }),
    ]);

    const totalAmount = totals.reduce((s, t) => s + (t._sum.amount || 0), 0);

    return Response.json({
      topups: topups.map(t => ({
        id: t.id,
        provider: t.provider,
        amount: t.amount / 100,
        note: t.note,
        adminName: t.adminName,
        createdAt: t.createdAt.toISOString(),
      })),
      byProvider: totals.map(t => ({
        provider: t.provider,
        total: (t._sum.amount || 0) / 100,
        count: t._count,
      })),
      totalAmount: totalAmount / 100,
    });
  } catch (err) {
    log.error('Provider Topups GET', err.message);
    return Response.json({ error: 'Failed to load topups' }, { status: 500 });
  }
}

export async function POST(req) {
  const { admin, error } = await requireAdmin('finance', true);
  if (error) return error;

  if (!canPerformAction(admin, 'finance.topup')) {
    return Response.json({ error: 'Not authorized' }, { status: 403 });
  }

  try {
    const { provider, amount, note } = await req.json();

    if (!provider || !['mtp', 'jap', 'dao'].includes(provider)) {
      return Response.json({ error: 'Invalid provider (mtp, jap, dao)' }, { status: 400 });
    }
    const amountKobo = Math.round(Number(amount) * 100);
    if (!amountKobo || amountKobo <= 0) {
      return Response.json({ error: 'Amount must be positive' }, { status: 400 });
    }

    const providerNames = { mtp: 'MTP', jap: 'JAP', dao: 'DaoSMM' };

    const topup = await prisma.providerTopup.create({
      data: {
        provider,
        amount: amountKobo,
        note: note?.trim().slice(0, 500) || null,
        adminName: admin.name,
      },
    });

    await logActivity(admin.name, `Recorded ${providerNames[provider]} top-up: ₦${Number(amount).toLocaleString()}${note ? ` — ${note.slice(0, 100)}` : ''}`, 'finance');

    return Response.json({
      success: true,
      topup: { id: topup.id, provider, amount: amountKobo / 100, createdAt: topup.createdAt.toISOString() },
    });
  } catch (err) {
    log.error('Provider Topups POST', err.message);
    return Response.json({ error: 'Failed to record top-up' }, { status: 500 });
  }
}
