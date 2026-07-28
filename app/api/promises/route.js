import prisma from '@/lib/prisma';
import { resolvePromise, addUpdate } from '@/lib/ify/promises';

function auth(req) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const bearer = req.headers.get('authorization')?.replace('Bearer ', '');
  if (bearer === secret) return true;
  const param = new URL(req.url).searchParams.get('token');
  return param === secret;
}

export async function GET(req) {
  if (!auth(req)) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const url = new URL(req.url);
  const state = url.searchParams.get('state');
  const where = state ? { state } : { state: { not: 'resolved' } };

  const promises = await prisma.ifyPromise.findMany({
    where,
    orderBy: { dueAt: 'asc' },
    include: { updates: { orderBy: { createdAt: 'asc' } } },
  });
  return Response.json(promises);
}

export async function PATCH(req) {
  if (!auth(req)) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await req.json();
    const { id, action, author, messageSent, note, owner } = body;

    if (!id) return Response.json({ error: 'id required' }, { status: 400 });

    if (action === 'resolve') {
      const result = await resolvePromise(id, { author: author || 'admin', messageSent, note });
      return Response.json(result);
    }

    if (action === 'update') {
      const update = await addUpdate(id, { author: author || 'admin', messageSent, note });
      return Response.json(update);
    }

    if (action === 'assign') {
      const promise = await prisma.ifyPromise.update({ where: { id }, data: { owner } });
      return Response.json(promise);
    }

    return Response.json({ error: 'Unknown action. Use: resolve, update, assign' }, { status: 400 });
  } catch (e) {
    const status = e.message.includes('Cannot resolve') ? 422 : 500;
    return Response.json({ error: e.message }, { status });
  }
}
