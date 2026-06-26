import { timingSafeEqual } from 'crypto';
import prisma from '@/lib/prisma';

async function validateKey(req) {
  const key = new URL(req.url).searchParams.get('key');
  if (!key) return false;
  const row = await prisma.setting.findUnique({ where: { key: 'pulse_secret_key' } });
  if (!row?.value) return false;
  try {
    const a = Buffer.from(key);
    const b = Buffer.from(row.value);
    return a.length === b.length && timingSafeEqual(a, b);
  } catch { return false; }
}

export async function GET(req) {
  if (!(await validateKey(req))) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const cutoff = new Date(Date.now() - 15_000);
  const stale = new Date(Date.now() - 5 * 60_000);

  const [sessions] = await Promise.all([
    prisma.liveSession.findMany({ where: { lastSeen: { gte: cutoff } }, orderBy: { lastSeen: 'desc' } }),
    prisma.liveSession.deleteMany({ where: { lastSeen: { lt: stale } } }),
  ]);

  const userIds = sessions.map(s => s.userId).filter(Boolean);
  const users = userIds.length
    ? await prisma.user.findMany({
        where: { id: { in: userIds } },
        select: {
          id: true, name: true, email: true, balance: true, createdAt: true,
          orders: { orderBy: { createdAt: 'desc' }, take: 1, select: { createdAt: true }, where: { deletedAt: null } },
          _count: { select: { orders: { where: { deletedAt: null } } } },
        },
      })
    : [];
  const userMap = Object.fromEntries(users.map(u => [u.id, u]));

  const result = sessions.map(s => {
    const u = s.userId ? userMap[s.userId] : null;
    return {
      sessionId: s.sessionId,
      page: s.page,
      firstSeen: s.firstSeen.toISOString(),
      lastSeen: s.lastSeen.toISOString(),
      ua: s.ua,
      user: u ? {
        name: u.name,
        email: u.email,
        balance: u.balance / 100,
        orderCount: u._count.orders,
        lastOrder: u.orders[0]?.createdAt?.toISOString() || null,
        joined: u.createdAt.toISOString(),
      } : null,
    };
  });

  return Response.json({ sessions: result, count: result.length, ts: Date.now() });
}
