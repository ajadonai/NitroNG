import { getMetrics } from '@/lib/ify/promises';

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

  try {
    const metrics = await getMetrics();
    return Response.json(metrics);
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
