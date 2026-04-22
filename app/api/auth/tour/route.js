import prisma from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';

export async function POST(req) {
  try {
    const user = await getCurrentUser();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { tour } = await req.json();

    if (tour === 'nav') {
      await prisma.user.update({ where: { id: user.id }, data: { tourCompleted: true } });
      return Response.json({ success: true });
    }

    if (tour === 'order') {
      await prisma.user.update({ where: { id: user.id }, data: { orderTourCompleted: true } });
      return Response.json({ success: true });
    }

    return Response.json({ error: 'Invalid tour type' }, { status: 400 });
  } catch (err) {
    return Response.json({ error: 'Server error' }, { status: 500 });
  }
}
