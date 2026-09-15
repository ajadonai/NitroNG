import prisma from '@/lib/prisma';
import { requireAdmin } from '@/lib/admin';

export async function GET(req) {
  // Only `error` is wanted. `admin` was here to check ticket locks — whether a
  // reply or a stale ticket belonged to the admin polling — and both went with
  // the ticket system on 14 Sep 2026.
  const { error } = await requireAdmin('overview');
  if (error) return error;

  const url = new URL(req.url);
  const since = url.searchParams.get('since');
  if (!since) return Response.json({ events: [] });

  const sinceDate = new Date(since);
  if (isNaN(sinceDate.getTime())) return Response.json({ events: [] });

  const largeDepositSetting = await prisma.setting.findUnique({ where: { key: 'admin_large_deposit_threshold' } });
  const largeThreshold = largeDepositSetting ? Number(largeDepositSetting.value) : 5000000;

  const [newDeposits, pendingManual, priceAlertSetting] = await Promise.all([
    prisma.transaction.findMany({
      where: { type: 'deposit', status: 'Completed', createdAt: { gt: sinceDate } },
      select: { id: true, amount: true, createdAt: true, user: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
      take: 10,
    }),
    prisma.transaction.findMany({
      where: { type: 'deposit', status: 'Pending', method: 'manual', createdAt: { gt: sinceDate }, NOT: { note: { contains: '[awaiting_confirmation]' } } },
      select: { id: true, amount: true, createdAt: true, user: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
      take: 10,
    }),
    prisma.setting.findUnique({ where: { key: 'price_alerts' } }),
  ]);

  const events = [];

  for (const d of newDeposits) {
    const type = d.amount >= largeThreshold ? 'large_deposit' : 'deposit';
    events.push({ type, id: d.id, amount: d.amount, user: d.user?.name || 'User', at: d.createdAt.toISOString() });
  }

  for (const d of pendingManual) {
    events.push({ type: 'pending_deposit', id: d.id, amount: d.amount, user: d.user?.name || 'User', at: d.createdAt.toISOString() });
  }

  if (priceAlertSetting?.value) {
    try {
      const pa = JSON.parse(priceAlertSetting.value);
      if (pa.losers?.length > 0 && pa.checkedAt && new Date(pa.checkedAt) > sinceDate) {
        events.push({ type: 'price_alert', id: 'price_alert', count: pa.losers.length, at: pa.checkedAt });
      }
    } catch {}
  }

  events.sort((a, b) => new Date(b.at) - new Date(a.at));

  return Response.json({ events });
}
