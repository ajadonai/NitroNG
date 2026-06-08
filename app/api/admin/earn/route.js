import prisma from '@/lib/prisma';
import { log } from '@/lib/logger';
import { requireAdmin, logActivity } from '@/lib/admin';

export async function GET(req) {
  const { admin, error } = await requireAdmin('leaderboard');
  if (error) return error;

  try {
    const url = new URL(req.url);
    const monthKey = url.searchParams.get('month') || getCurrentMonthKey();

    const scores = await prisma.$queryRaw`
      SELECT gs.score, gs.moves, gs.duration, gs."createdAt", u.name, u.email, u.id as "userId",
             ROW_NUMBER() OVER (ORDER BY gs.score DESC) as rank
      FROM game_scores gs
      JOIN users u ON u.id = gs."userId"
      WHERE gs."monthKey" = ${monthKey}
        AND gs.verified = true
        AND gs.id = (
          SELECT id FROM game_scores g2
          WHERE g2."userId" = gs."userId" AND g2."monthKey" = ${monthKey} AND g2.verified = true
          ORDER BY g2.score DESC LIMIT 1
        )
      ORDER BY gs.score DESC
      LIMIT 100
    `;

    const rewards = await prisma.gameReward.findMany({
      where: { monthKey },
      orderBy: { rank: 'asc' },
      include: { user: { select: { name: true, email: true } } },
    });

    const videoStats = await prisma.videoWatch.aggregate({
      where: {
        createdAt: {
          gte: new Date(monthKey + '-01'),
          lt: new Date(new Date(monthKey + '-01').setMonth(new Date(monthKey + '-01').getMonth() + 1)),
        },
      },
      _count: true,
      _sum: { earned: true, revenue: true },
    });

    const settings = {};
    const rows = await prisma.setting.findMany({
      where: { key: { startsWith: 'earn_' } },
    });
    rows.forEach(r => { settings[r.key] = r.value; });

    return Response.json({
      monthKey,
      leaderboard: scores.map(r => ({
        name: r.name,
        email: r.email,
        score: r.score,
        moves: r.moves,
        duration: r.duration,
        rank: Number(r.rank),
        userId: r.userId,
      })),
      rewards: rewards.map(r => ({
        rank: r.rank,
        name: r.user.name,
        email: r.user.email,
        score: r.score,
        amount: r.amount,
        credited: r.credited,
      })),
      videoStats: {
        totalWatches: videoStats._count,
        totalEarned: videoStats._sum.earned || 0,
        totalRevenue: videoStats._sum.revenue || 0,
      },
      settings,
    });
  } catch (err) {
    log.error('Admin Earn GET', err.message);
    return Response.json({ error: 'Failed to load earn data' }, { status: 500 });
  }
}

export async function POST(req) {
  const { admin, error } = await requireAdmin('leaderboard', true);
  if (error) return error;

  try {
    const { action, ...params } = await req.json();

    if (action === 'process_rewards') {
      const { monthKey } = params;
      if (!monthKey) return Response.json({ error: 'monthKey required' }, { status: 400 });

      const existing = await prisma.gameReward.findFirst({ where: { monthKey } });
      if (existing) return Response.json({ error: 'Rewards already processed for this month' }, { status: 400 });

      const amountsSetting = await prisma.setting.findUnique({ where: { key: 'earn_game_reward_amounts' } });
      const amounts = amountsSetting ? JSON.parse(amountsSetting.value) : [500000, 300000, 150000, 100000, 50000];

      const topScores = await prisma.$queryRaw`
        SELECT gs.score, u.id as "userId", u.name
        FROM game_scores gs
        JOIN users u ON u.id = gs."userId"
        WHERE gs."monthKey" = ${monthKey} AND gs.verified = true
          AND gs.id = (
            SELECT id FROM game_scores g2
            WHERE g2."userId" = gs."userId" AND g2."monthKey" = ${monthKey} AND g2.verified = true
            ORDER BY g2.score DESC LIMIT 1
          )
        ORDER BY gs.score DESC
        LIMIT 5
      `;

      if (topScores.length === 0) {
        return Response.json({ error: 'No scores for this month' }, { status: 400 });
      }

      const ops = [];
      for (let i = 0; i < topScores.length && i < amounts.length; i++) {
        const s = topScores[i];
        const amount = amounts[i];
        ops.push(
          prisma.gameReward.create({
            data: { userId: s.userId, monthKey, rank: i + 1, score: s.score, amount, credited: true },
          }),
          prisma.user.update({
            where: { id: s.userId },
            data: { balance: { increment: amount } },
          }),
          prisma.transaction.create({
            data: {
              userId: s.userId,
              type: 'game_reward',
              amount,
              status: 'Completed',
              note: `2048 rank #${i + 1} — ${new Date(monthKey + '-01').toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`,
            },
          })
        );
      }
      await prisma.$transaction(ops);
      await logActivity(admin, `Processed game rewards for ${monthKey} — ${topScores.length} winners`, 'earn');
      return Response.json({ ok: true, winners: topScores.length });
    }

    if (action === 'update_settings') {
      const { settings } = params;
      if (!settings || typeof settings !== 'object') return Response.json({ error: 'settings required' }, { status: 400 });

      const allowed = ['earn_game_enabled', 'earn_game_reward_amounts', 'earn_video_enabled', 'earn_video_reward_per_watch', 'earn_video_daily_cap'];
      const ops = [];
      for (const [key, value] of Object.entries(settings)) {
        if (!allowed.includes(key)) continue;
        ops.push(prisma.setting.upsert({
          where: { key },
          create: { key, value: String(value) },
          update: { value: String(value) },
        }));
      }
      await prisma.$transaction(ops);
      await logActivity(admin, 'Updated earn settings', 'earn');
      return Response.json({ ok: true });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (err) {
    log.error('Admin Earn POST', err.message);
    return Response.json({ error: 'Failed to process action' }, { status: 500 });
  }
}

function getCurrentMonthKey() {
  const now = new Date();
  const watNow = new Date(now.getTime() + 60 * 60 * 1000);
  return `${watNow.getUTCFullYear()}-${String(watNow.getUTCMonth() + 1).padStart(2, '0')}`;
}
