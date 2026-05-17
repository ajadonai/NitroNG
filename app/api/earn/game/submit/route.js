import { getCurrentUser } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { replayGame } from '@/lib/game-engine';

export async function POST(req) {
  const session = await getCurrentUser();
  if (!session) return Response.json({ error: 'Not authenticated' }, { status: 401 });

  const { sessionId, score, moves, duration } = await req.json();
  if (!sessionId || typeof score !== 'number' || !moves || typeof duration !== 'number') {
    return Response.json({ error: 'Missing fields' }, { status: 400 });
  }

  const game = await prisma.gameSession.findUnique({ where: { id: sessionId } });
  if (!game || game.userId !== session.id || game.status !== 'active') {
    return Response.json({ error: 'Invalid game session' }, { status: 400 });
  }

  const replay = replayGame(game.seed, moves);
  if (!replay.valid) {
    return Response.json({ error: 'Score validation failed', reason: replay.reason }, { status: 400 });
  }
  if (replay.score !== score) {
    return Response.json({ error: 'Score mismatch' }, { status: 400 });
  }

  const now = new Date();
  const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const [savedScore] = await prisma.$transaction([
    prisma.gameScore.create({
      data: {
        userId: session.id,
        sessionId,
        score: replay.score,
        moves: replay.moveCount,
        duration,
        monthKey,
        verified: true,
      },
    }),
    prisma.gameSession.update({
      where: { id: sessionId },
      data: { status: 'completed' },
    }),
  ]);

  return Response.json({ ok: true, score: savedScore.score, verified: true });
}
