import prisma from '@/lib/prisma';
import { verifyUserToken, verifyAdminToken } from '@/lib/auth';
import { cookies } from 'next/headers';

export async function POST(req) {
  try {
    const { sid, page } = await req.json();
    if (!sid || !page) return Response.json({ ok: false }, { status: 400 });

    const cookieStore = await cookies();
    const token = cookieStore.get('nitro_token')?.value;
    const adminToken = cookieStore.get('nitro_admin_token')?.value;
    const payload = (token ? verifyUserToken(token) : null)
      || (adminToken ? verifyAdminToken(adminToken) : null);

    const ua = req.headers.get('user-agent') || null;

    await prisma.liveSession.upsert({
      where: { sessionId: sid },
      update: { page, lastSeen: new Date(), ...(payload ? { userId: payload.id } : {}) },
      create: { sessionId: sid, page, ua, userId: payload?.id || null },
    });

    return Response.json({ ok: true });
  } catch {
    return Response.json({ ok: false }, { status: 500 });
  }
}
