import { renewUserSession, renewAdminSession } from '@/lib/auth';
import { log } from '@/lib/logger';

function json(body, status = 200) {
  return Response.json(body, {
    status,
    headers: {
      'Cache-Control': 'private, no-store, max-age=0',
      'CDN-Cache-Control': 'no-store',
      'Vercel-CDN-Cache-Control': 'no-store',
    },
  });
}

export async function POST(req) {
  try {
    const { type } = await req.json().catch(() => ({}));
    if (type !== 'user' && type !== 'admin') {
      return json({ renewed: false, error: 'Valid session type required' }, 400);
    }

    if (type === 'admin') {
      const result = await renewAdminSession();
      if (!result) return json({ renewed: false, expired: true }, 401);
      return json(result);
    }

    const result = await renewUserSession();
    if (!result) return json({ renewed: false, expired: true }, 401);
    return json(result);
  } catch (err) {
    log.error('Session renew', err.message);
    return json({ renewed: false }, 500);
  }
}
