import prisma from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';

export async function POST(req) {
  const session = await getCurrentUser();
  if (!session) return Response.json({ error: 'Not authenticated' }, { status: 401 });

  const { version } = await req.json();
  if (!version) return Response.json({ error: 'Version required' }, { status: 400 });

  await prisma.user.update({
    where: { id: session.id },
    data: { tosAcceptedAt: new Date(), tosVersion: version },
  });

  return Response.json({ success: true });
}
