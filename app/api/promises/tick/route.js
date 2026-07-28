export const maxDuration = 60;

import { tick } from '@/lib/ify/promises';
import { syncSheet } from '@/lib/ify/sheet-sync';
import { log } from '@/lib/logger';

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
    const stats = await tick();
    await syncSheet().catch((e) => log.warn('Ify', `Sheet sync failed: ${e.message}`));
    return Response.json({ ok: true, ...stats });
  } catch (e) {
    log.error('Ify', `Promise tick failed: ${e.message}`);
    return Response.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(req) {
  return GET(req);
}
