import prisma from '@/lib/prisma';
import { verifyUnsubToken } from '@/lib/unsubscribe';

export async function GET(req) {
  const token = new URL(req.url).searchParams.get('token');
  if (!token) return Response.json({ error: 'Missing token' }, { status: 400 });
  const email = verifyUnsubToken(token);
  if (!email) return Response.json({ error: 'Invalid token' }, { status: 400 });
  return Response.json({ valid: true, email });
}

export async function POST(req) {
  const { token, action } = await req.json();
  if (!token) return Response.json({ error: 'Missing token' }, { status: 400 });
  const email = verifyUnsubToken(token);
  if (!email) return Response.json({ error: 'Invalid token' }, { status: 400 });

  const notifPromo = action === 'resubscribe';

  try {
    await prisma.user.update({
      where: { email },
      data: { notifPromo },
    });
  } catch {
    return Response.json({ error: 'Account not found' }, { status: 404 });
  }

  return Response.json({ success: true, subscribed: notifPromo });
}
