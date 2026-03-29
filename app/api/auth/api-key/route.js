import prisma from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';
import crypto from 'crypto';

function generateApiKey() {
  return 'ntro_sk_' + crypto.randomBytes(24).toString('hex');
}

export async function GET() {
  try {
    const session = await getCurrentUser();
    if (!session) return Response.json({ error: 'Not authenticated' }, { status: 401 });

    const user = await prisma.user.findUnique({
      where: { id: session.id },
      select: { apiKey: true },
    });

    return Response.json({ apiKey: user?.apiKey || null });
  } catch (err) {
    console.error('[API Key GET]', err.message);
    return Response.json({ error: 'Failed to get API key' }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const session = await getCurrentUser();
    if (!session) return Response.json({ error: 'Not authenticated' }, { status: 401 });

    const { action } = await req.json();

    if (action === 'generate' || action === 'regenerate') {
      const apiKey = generateApiKey();
      await prisma.user.update({
        where: { id: session.id },
        data: { apiKey },
      });
      return Response.json({ success: true, apiKey });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (err) {
    console.error('[API Key POST]', err.message);
    return Response.json({ error: 'Failed to manage API key' }, { status: 500 });
  }
}
