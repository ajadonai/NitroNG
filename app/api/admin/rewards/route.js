import prisma from '@/lib/prisma';
import { requireAdmin, logActivity } from '@/lib/admin';
import { getPointsBalanceKoboTx, pointsFromKoboExact } from '@/lib/nitro-rewards';

export async function GET(req) {
  const { admin, error } = await requireAdmin('rewards');
  if (error) return error;

  const url = new URL(req.url);

  // Summary view — global rewards metrics
  if (url.searchParams.get('view') === 'summary') {
    const from = url.searchParams.get('from') || '';
    const to = url.searchParams.get('to') || '';
    if (from && isNaN(Date.parse(from))) return Response.json({ error: 'Invalid from date' }, { status: 400 });
    if (to && isNaN(Date.parse(to))) return Response.json({ error: 'Invalid to date' }, { status: 400 });

    const dateWhere = {};
    if (from || to) {
      dateWhere.createdAt = {};
      if (from) dateWhere.createdAt.gte = new Date(from);
      if (to) { const end = new Date(to); end.setDate(end.getDate() + 1); dateWhere.createdAt.lte = end; }
    }

    const orderWhere = {
      deletedAt: null,
      status: { notIn: ['Cancelled'] },
      ...(dateWhere.createdAt ? { createdAt: dateWhere.createdAt } : {}),
    };

    const [totals, liability, orderRewards] = await Promise.all([
      prisma.nitroPointLedger.groupBy({
        by: ['type'],
        where: dateWhere,
        _sum: { pointsKobo: true },
        _count: true,
      }),
      prisma.nitroPointLedger.aggregate({
        _sum: { pointsKobo: true },
      }),
      prisma.order.aggregate({
        where: orderWhere,
        _sum: {
          loyaltyDiscount: true,
          campaignDiscount: true,
          nitroPointsRedeemedKobo: true,
        },
        _count: true,
      }),
    ]);

    const byType = {};
    for (const r of totals) {
      byType[r.type] = { kobo: r._sum.pointsKobo || 0, count: r._count };
    }

    const byTypeKobo = (type) => byType[type]?.kobo || 0;
    const statusDiscountKobo = orderRewards._sum.loyaltyDiscount || 0;
    const campaignDiscountKobo = orderRewards._sum.campaignDiscount || 0;
    const pointsRedeemedAtCheckoutKobo = orderRewards._sum.nitroPointsRedeemedKobo || 0;
    const earnedKobo = byTypeKobo('earned_order');
    const redeemedKobo = Math.abs(byTypeKobo('redeemed_order'));
    const reversedKobo = Math.abs(byTypeKobo('reversed_refund'));
    const restoredKobo = byTypeKobo('restored_refund');
    const manualCreditKobo = byTypeKobo('manual_credit');
    const manualDebitKobo = Math.abs(byTypeKobo('manual_debit'));
    const openingBalanceKobo = byTypeKobo('opening_balance');
    const netLiabilityChangeKobo = Object.values(byType).reduce((sum, row) => sum + (row.kobo || 0), 0);

    return Response.json({
      liability: { kobo: liability._sum.pointsKobo || 0, points: pointsFromKoboExact(liability._sum.pointsKobo || 0) },
      byType,
      cost: {
        orderCount: orderRewards._count || 0,
        checkoutReductions: {
          statusDiscountKobo,
          campaignDiscountKobo,
          pointsRedeemedKobo: pointsRedeemedAtCheckoutKobo,
          totalKobo: statusDiscountKobo + campaignDiscountKobo + pointsRedeemedAtCheckoutKobo,
        },
        pointsMovement: {
          earnedKobo,
          redeemedKobo,
          reversedKobo,
          restoredKobo,
          manualCreditKobo,
          manualDebitKobo,
          openingBalanceKobo,
          liabilityIncreaseKobo: earnedKobo + restoredKobo + manualCreditKobo + openingBalanceKobo,
          liabilityDecreaseKobo: redeemedKobo + reversedKobo + manualDebitKobo,
          netLiabilityChangeKobo,
        },
        accrualRewardCost: {
          kobo: statusDiscountKobo + campaignDiscountKobo + earnedKobo + manualCreditKobo + openingBalanceKobo,
          statusDiscountKobo,
          campaignDiscountKobo,
          pointsIssuedKobo: earnedKobo + manualCreditKobo + openingBalanceKobo,
        },
      },
      dateFiltered: !!(from || to),
    });
  }

  const page = Math.max(1, Number(url.searchParams.get('page')) || 1);
  const perPage = Math.min(Math.max(1, Number(url.searchParams.get('perPage')) || 25), 100);
  const userId = url.searchParams.get('userId')?.trim() || '';
  const type = url.searchParams.get('type')?.trim() || '';
  const search = url.searchParams.get('search')?.trim() || '';
  const from = url.searchParams.get('from') || '';
  const to = url.searchParams.get('to') || '';

  if (from && isNaN(Date.parse(from))) return Response.json({ error: 'Invalid from date' }, { status: 400 });
  if (to && isNaN(Date.parse(to))) return Response.json({ error: 'Invalid to date' }, { status: 400 });

  const where = {};

  if (userId) where.userId = userId;

  if (type) where.type = type;

  if (search) {
    where.OR = [
      { order: { orderId: { contains: search, mode: 'insensitive' } } },
      { reason: { contains: search, mode: 'insensitive' } },
      { user: { name: { contains: search, mode: 'insensitive' } } },
      { user: { email: { contains: search, mode: 'insensitive' } } },
    ];
  }

  if (from || to) {
    where.createdAt = {};
    if (from) where.createdAt.gte = new Date(from);
    if (to) {
      const end = new Date(to);
      end.setDate(end.getDate() + 1);
      where.createdAt.lte = end;
    }
  }

  const [entries, total] = await Promise.all([
    prisma.nitroPointLedger.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * perPage,
      take: perPage,
      include: {
        user: { select: { id: true, name: true, email: true } },
        order: { select: { orderId: true } },
        createdByAdmin: { select: { id: true, name: true } },
      },
    }),
    prisma.nitroPointLedger.count({ where }),
  ]);

  const rows = entries.map(e => ({
    id: e.id,
    userId: e.userId,
    userName: e.user?.name || null,
    userEmail: e.user?.email || null,
    type: e.type,
    points: pointsFromKoboExact(e.pointsKobo),
    pointsKobo: e.pointsKobo,
    orderRef: e.order?.orderId || null,
    reason: e.reason || null,
    adminName: e.createdByAdmin?.name || null,
    createdAt: e.createdAt,
  }));

  return Response.json({ entries: rows, total, page, perPage, totalPages: Math.ceil(total / perPage) });
}

const ALLOWED_TYPES = ['manual_credit', 'manual_debit'];
const MAX_POINTS = 10_000_000;
const MAX_RETRIES = 3;

export async function POST(req) {
  const { admin, error } = await requireAdmin('rewards', true);
  if (error) return error;

  if (!['owner', 'superadmin'].includes(admin.role)) {
    return Response.json({ error: 'Only owner/superadmin can adjust points' }, { status: 403 });
  }

  const body = await req.json();
  const { userId, type, points, reason } = body;

  if (!userId) return Response.json({ error: 'User ID required' }, { status: 400 });
  if (!ALLOWED_TYPES.includes(type)) return Response.json({ error: 'Type must be manual_credit or manual_debit' }, { status: 400 });
  if (!points || typeof points !== 'number' || points <= 0 || !Number.isInteger(points)) {
    return Response.json({ error: 'Points must be a positive integer' }, { status: 400 });
  }
  if (points > MAX_POINTS) return Response.json({ error: `Points cannot exceed ${MAX_POINTS.toLocaleString()}` }, { status: 400 });
  if (!reason || !reason.trim()) return Response.json({ error: 'Reason is required' }, { status: 400 });

  const pointsKobo = points * 100;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const result = await prisma.$transaction(async (tx) => {
        const user = await tx.user.findUnique({ where: { id: userId }, select: { id: true, name: true, status: true } });
        if (!user) return { error: 'User not found', status: 404 };
        if (['PendingDeletion', 'Deleted'].includes(user.status)) {
          return { error: 'Accounts awaiting or past deletion cannot receive points adjustments', status: 409 };
        }

        if (type === 'manual_debit') {
          const balance = await getPointsBalanceKoboTx(tx, userId);
          if (pointsKobo > balance) {
            return { error: `Cannot debit ${points} pts — user only has ${pointsFromKoboExact(balance)} pts`, status: 400 };
          }
        }

        const entry = await tx.nitroPointLedger.create({
          data: {
            userId,
            type,
            pointsKobo: type === 'manual_debit' ? -pointsKobo : pointsKobo,
            reason: reason.trim(),
            createdByAdminId: admin.id,
          },
        });

        const newBalance = await getPointsBalanceKoboTx(tx, userId);
        return { user, entry, newBalance };
      }, { isolationLevel: 'Serializable' });

      if (result.error) {
        return Response.json({ error: result.error }, { status: result.status });
      }

      const action = type === 'manual_credit'
        ? `Credited ${points} pts to ${result.user.name || userId}: ${reason.trim()}`
        : `Debited ${points} pts from ${result.user.name || userId}: ${reason.trim()}`;
      logActivity(admin.name, action, 'reward').catch(() => {});

      return Response.json({
        success: true,
        entry: { id: result.entry.id, type: result.entry.type, points: pointsFromKoboExact(result.entry.pointsKobo), reason: result.entry.reason },
        newBalance: pointsFromKoboExact(result.newBalance),
      });
    } catch (e) {
      if (e.code === 'P2034' && attempt < MAX_RETRIES - 1) continue;
      throw e;
    }
  }
}
