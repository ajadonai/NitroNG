import prisma from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';
import { getResellerTerms, getMarkupSettings } from '@/lib/reseller';
import { ladderLive, resolveRate } from '@/lib/reseller-tiers';
import { DEAD_ORDER_STATES } from '@/lib/ledger';
import { koboToNaira as naira } from '@/lib/money';

const WINDOW_DAYS = 30;


/** The caller's own month for the Reseller HQ facts row: orders, spend, the
 * wholesale saving against retail at their rate, and the wallet. */
export async function GET() {
  const session = await getCurrentUser();
  if (!session) return Response.json({ error: 'Not authenticated' }, { status: 401 });

  const since = new Date(Date.now() - WINDOW_DAYS * 86400000);
  const where = { userId: session.id, createdAt: { gte: since }, deletedAt: null, status: { notIn: DEAD_ORDER_STATES } };
  const [agg, discounted, apiOrders, user, resellerTerms, settings] = await Promise.all([
    prisma.order.aggregate({ where, _count: true, _sum: { charge: true } }),
    prisma.order.aggregate({ where: { ...where, retailCharge: { not: null } }, _sum: { charge: true, retailCharge: true } }),
    prisma.order.count({ where: { ...where, source: 'api' } }),
    prisma.user.findUnique({ where: { id: session.id }, select: { balance: true } }),
    getResellerTerms(session.id),
    getMarkupSettings(),
  ]);

  const wholesale = !!resellerTerms;
  // On the ladder the rung's rate is a ceiling: band caps hold the dearest
  // services back, so a Wholesale reseller pays 30% off most of the catalogue
  // and 22% off Ultra. The row says "up to" for that reason.
  const live = wholesale && ladderLive(settings);
  const rate = live ? resolveRate(resellerTerms, settings) : null;
  const discount = !wholesale ? 0 : rate ? rate.pct : (resellerTerms.discountPct ?? (Number(settings.markup_reseller_discount) || 20));
  const spend = naira(agg._sum.charge);
  // What the same orders would have cost at retail, minus what they paid. Each
  // discounted order records the retail figure it came down from, so this is
  // the saving that happened rather than one estimated at a flat rate, which a
  // band cap would make an overstatement.
  const saved = wholesale ? Math.max(0, naira((discounted._sum.retailCharge || 0) - (discounted._sum.charge || 0))) : 0;

  return Response.json({
    windowDays: WINDOW_DAYS,
    orders: agg._count,
    apiOrders,
    spend,
    saved,
    discount,
    upTo: live,
    tierName: rate?.tierName ?? null,
    balance: naira(user?.balance),
    wholesale,
  });
}
