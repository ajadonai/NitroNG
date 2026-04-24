import prisma from '@/lib/prisma';
import { log } from "@/lib/logger";
import { requireAdmin } from '@/lib/admin';

export async function GET(req) {
  const { admin, error } = await requireAdmin('activity');
  if (error) return error;

  try {
    const url = new URL(req.url);
    const cursor = url.searchParams.get('cursor');
    const limit = Math.min(Number(url.searchParams.get('limit')) || 100, 500);

    const where = ['support', 'finance'].includes(admin.role)
      ? { adminName: admin.name }
      : {};

    const logs = await prisma.activityLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });

    const hasMore = logs.length > limit;
    const items = hasMore ? logs.slice(0, limit) : logs;
    const nextCursor = hasMore ? items[items.length - 1].id : null;

    return Response.json({
      activity: items.map(l => ({
        id: l.id,
        admin: l.adminName,
        action: l.action,
        type: l.type,
        time: l.createdAt.toISOString(),
      })),
      nextCursor,
      hasMore,
    });
  } catch (err) {
    log.error('Admin Activity', err.message);
    return Response.json({ error: 'Failed to load activity' }, { status: 500 });
  }
}
