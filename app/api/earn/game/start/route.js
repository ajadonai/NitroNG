import { getCurrentUser } from '@/lib/auth';
import prisma from '@/lib/prisma';
import crypto from 'crypto';

export async function POST() {
  const session = await getCurrentUser();
  if (!session) return Response.json({ error: 'Not authenticated' }, { status: 401 });

  // Expire any active sessions for this user
  await prisma.gameSession.updateMany({
    where: { userId: session.id, status: 'active' },
    data: { status: 'expired' },
  });

  const seed = crypto.randomBytes(16).toString('hex');
  const game = await prisma.gameSession.create({
    data: { userId: session.id, seed },
  });

  return Response.json({ sessionId: game.id, seed });
}
