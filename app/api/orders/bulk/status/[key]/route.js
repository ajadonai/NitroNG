import prisma from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';

export async function GET(req, { params }) {
  try {
    const session = await getCurrentUser();
    if (!session) return Response.json({ error: 'Not authenticated' }, { status: 401 });

    const { key } = await params;
    const record = await prisma.idempotencyKey.findUnique({ where: { key } });

    if (!record || record.userId !== session.id) {
      return Response.json({ error: 'Not found' }, { status: 404 });
    }

    return Response.json({
      status: record.status,
      ...(record.batchId ? { batchId: record.batchId } : {}),
      ...(record.status === 'completed' && record.response ? { response: record.response } : {}),
    });
  } catch (err) {
    return Response.json({ error: 'Failed to check status' }, { status: 500 });
  }
}
