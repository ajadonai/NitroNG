import prisma from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';
import { getResellerTerms } from '@/lib/reseller';

const WINDOW_DAYS = 30;
const naira = (kobo) => Math.round(Number(kobo || 0) / 100);

/** The caller's own month for the Reseller HQ facts row: orders, spend, the
 * wholesale saving against retail at their rate, and the wallet. */
export async function GET() {
  const session = await getCurrentUser();
  if (!session) return Response.json({ error: 'Not authenticated' }, { status: 401 });

  const since = new Date(Date.now() - WINDOW_DAYS * 86400000);
  const where = { userId: session.id, createdAt: { gte: since }, deletedAt: null, status: { not: 'Cancelled' } };
  const [agg, apiOrders, user, resellerTerms, rateSetting] = await Promise.all([
    prisma.order.aggregate({ where, _count: true, _sum: { charge: true } }),
    prisma.order.count({ where: { ...where, source: 'api' } }),
    prisma.user.findUnique({ where: { id: session.id }, select: { balance: true } }),
    getResellerTerms(session.id),
    prisma.setting.findUnique({ where: { key: 'markup_reseller_discount' } }),
  ]);

  const wholesale = !!resellerTerms;
  const discount = wholesale ? (resellerTerms.discountPct ?? (Number(rateSetting?.value) || 20)) : 0;
  const spend = naira(agg._sum.charge);
  // What the same orders would have cost at retail, minus what they paid.
  const saved = wholesale && discount > 0 && discount < 100 ? Math.round(spend * discount / (100 - discount)) : 0;

  return Response.json({
    windowDays: WINDOW_DAYS,
    orders: agg._count,
    apiOrders,
    spend,
    saved,
    discount,
    balance: naira(user?.balance),
    wholesale,
  });
}
