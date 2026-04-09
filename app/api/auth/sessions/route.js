import prisma from '@/lib/prisma';
import { log } from "@/lib/logger";
import { getCurrentUser, hashToken } from '@/lib/auth';
import { cookies } from 'next/headers';

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return Response.json({ error: 'Not authenticated' }, { status: 401 });

    const cookieStore = await cookies();
    const currentToken = cookieStore.get('nitro_token')?.value;
    const currentHash = currentToken ? hashToken(currentToken) : null;

    const sessions = await prisma.session.findMany({
      where: { userId: user.id },
      orderBy: { lastActive: 'desc' },
    });

    return Response.json({
      sessions: sessions.map(s => ({
        id: s.id,
        deviceType: s.deviceType,
        deviceInfo: s.deviceInfo,
        ip: s.ip,
        lastActive: s.lastActive.toISOString(),
        created: s.createdAt.toISOString(),
        current: s.tokenHash === currentHash,
      })),
    });
  } catch (err) {
    log.error('Sessions GET', err.message);
    return Response.json({ error: 'Failed to load sessions' }, { status: 500 });
  }
}

export async function DELETE(req) {
  try {
    const user = await getCurrentUser();
    if (!user) return Response.json({ error: 'Not authenticated' }, { status: 401 });

    const { sessionId } = await req.json();
    if (!sessionId) return Response.json({ error: 'Session ID required' }, { status: 400 });

    // Only delete own sessions
    const session = await prisma.session.findFirst({
      where: { id: sessionId, userId: user.id },
    });
    if (!session) return Response.json({ error: 'Session not found' }, { status: 404 });

    // Don't allow revoking current session (use logout instead)
    const cookieStore = await cookies();
    const currentToken = cookieStore.get('nitro_token')?.value;
    if (currentToken && hashToken(currentToken) === session.tokenHash) {
      return Response.json({ error: 'Use logout to end current session' }, { status: 400 });
    }

    await prisma.session.delete({ where: { id: sessionId } });

    return Response.json({ success: true });
  } catch (err) {
    log.error('Sessions DELETE', err.message);
    return Response.json({ error: 'Failed to revoke session' }, { status: 500 });
  }
}
