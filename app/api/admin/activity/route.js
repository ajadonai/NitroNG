import prisma from '@/lib/prisma';
import { log } from "@/lib/logger";
import { requireAdmin } from '@/lib/admin';

export async function GET() {
  const { admin, error } = await requireAdmin('activity');
  if (error) return error;

  try {
    // Support/finance see only their own activity
    const where = ['support', 'finance'].includes(admin.role)
      ? { adminName: admin.name }
      : {};

    const logs = await prisma.activityLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 500,
    });

    return Response.json({
      activity: logs.map(l => ({
        id: l.id,
        admin: l.adminName,
        action: l.action,
        type: l.type,
        time: l.createdAt.toISOString(),
      })),
    });
  } catch (err) {
    log.error('Admin Activity', err.message);
    return Response.json({ error: 'Failed to load activity' }, { status: 500 });
  }
}
