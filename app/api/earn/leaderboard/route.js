import { getCurrentUser } from '@/lib/auth';
import prisma from '@/lib/prisma';

export async function GET(req) {
  const session = await getCurrentUser();
  if (!session) return Response.json({ error: 'Not authenticated' }, { status: 401 });

  const now = new Date();
  const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  // Best score per user this month, ranked
  const topScores = await prisma.$queryRaw`
    SELECT gs.score, gs."createdAt", u.name, u.id as "userId",
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
    LIMIT 20
  `;

  // User's personal best this month
  const userBest = await prisma.gameScore.findFirst({
    where: { userId: session.id, monthKey, verified: true },
    orderBy: { score: 'desc' },
  });

  // User's rank
  let userRank = null;
  if (userBest) {
    const higher = await prisma.$queryRaw`
      SELECT COUNT(DISTINCT "userId") as count
      FROM game_scores
      WHERE "monthKey" = ${monthKey} AND verified = true AND score > ${userBest.score}
    `;
    userRank = Number(higher[0].count) + 1;
  }

  // Past winners (rewarded months)
  const pastWinners = await prisma.gameReward.findMany({
    where: { credited: true },
    orderBy: [{ monthKey: 'desc' }, { rank: 'asc' }],
    take: 25,
    include: { user: { select: { name: true } } },
  });

  return Response.json({
    monthKey,
    leaderboard: topScores.map(r => ({
      name: r.name,
      score: r.score,
      rank: Number(r.rank),
      isYou: r.userId === session.id,
    })),
    userBest: userBest?.score || null,
    userRank,
    pastWinners: pastWinners.map(w => ({
      monthKey: w.monthKey,
      rank: w.rank,
      name: w.user.name,
      score: w.score,
      amount: w.amount,
    })),
  });
}
