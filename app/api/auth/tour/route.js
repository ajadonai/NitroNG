import { prisma } from '@/lib/prisma';
import { getUserPayload } from '@/lib/auth';

export async function POST(req) {
  try {
    const payload = await getUserPayload(req);
    if (!payload) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { tour } = await req.json();

    if (tour === 'nav') {
      await prisma.user.update({ where: { id: payload.id }, data: { tourCompleted: true } });
      return Response.json({ success: true });
    }

    if (tour === 'order') {
      await prisma.user.update({ where: { id: payload.id }, data: { orderTourCompleted: true } });
      return Response.json({ success: true });
    }

    return Response.json({ error: 'Invalid tour type' }, { status: 400 });
  } catch (err) {
    return Response.json({ error: 'Server error' }, { status: 500 });
  }
}
