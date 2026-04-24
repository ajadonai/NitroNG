import prisma from '@/lib/prisma';
import { requireAdmin } from '@/lib/admin';

export async function GET() {
  const { error } = await requireAdmin();
  if (error) return error;

  try {
    const alerts = await prisma.alert.findMany({
      where: {
        active: true,
        deletedAt: null,
        target: { in: ['everyone', 'admin'] },
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      orderBy: { createdAt: 'desc' },
      take: 3,
    });

    return Response.json({
      alerts: alerts.map(a => ({ id: a.id, message: a.message, type: a.type })),
    });
  } catch {
    return Response.json({ alerts: [] });
  }
}
