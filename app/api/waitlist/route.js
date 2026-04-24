import prisma from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';

export async function GET() {
  try {
    const session = await getCurrentUser();
    if (!session) return Response.json({ error: 'Not authenticated' }, { status: 401 });

    const entries = await prisma.waitlist.findMany({
      where: { userId: session.id },
      select: { feature: true, email: true },
    });

    const joined = {};
    for (const e of entries) joined[e.feature] = { email: e.email };

    return Response.json({ joined });
  } catch {
    return Response.json({ error: 'Failed to load waitlist' }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const session = await getCurrentUser();
    if (!session) return Response.json({ error: 'Not authenticated' }, { status: 401 });

    const body = await req.json();
    const feature = body.feature;
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase().slice(0, 254) : '';

    if (!feature || !email) {
      return Response.json({ error: 'Email required' }, { status: 400 });
    }

    if (!['audit', 'cleanup'].includes(feature)) {
      return Response.json({ error: 'Invalid feature' }, { status: 400 });
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
      return Response.json({ error: 'Invalid email' }, { status: 400 });
    }

    await prisma.waitlist.upsert({
      where: { userId_feature: { userId: session.id, feature } },
      create: { userId: session.id, feature, email },
      update: { email },
    });

    return Response.json({ success: true });
  } catch {
    return Response.json({ error: 'Failed to join waitlist' }, { status: 500 });
  }
}
