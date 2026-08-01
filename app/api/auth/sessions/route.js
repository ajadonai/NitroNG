import prisma from '@/lib/prisma';
import { log } from "@/lib/logger";
import { getCurrentUser } from '@/lib/auth';

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return Response.json({ error: 'Not authenticated' }, { status: 401 });

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
        current: s.id === user._sessionId,
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

    const session = await prisma.session.findFirst({
      where: { id: sessionId, userId: user.id },
    });
    if (!session) return Response.json({ error: 'Session not found' }, { status: 404 });

    if (session.id === user._sessionId) {
      return Response.json({ error: 'Use logout to end current session' }, { status: 400 });
    }

    await prisma.session.delete({ where: { id: sessionId } });

    return Response.json({ success: true });
  } catch (err) {
    log.error('Sessions DELETE', err.message);
    return Response.json({ error: 'Failed to revoke session' }, { status: 500 });
  }
}
