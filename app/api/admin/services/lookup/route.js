import { log } from '@/lib/logger';
import { requireAdmin, canSeeSensitive } from '@/lib/admin';
import { lookupService } from '@/lib/service-lookup';

// Everything about one service, from the number a customer quotes. The logic
// and the reasons it gives live in lib/service-lookup.js; this is the door.
//   ?q=301    the customer's number        ?q=p5603    the provider's own
export async function GET(req) {
  const { admin, error } = await requireAdmin('services');
  if (error) return error;
  try {
    const { status, body } = await lookupService(new URL(req.url).searchParams.get('q'), { sensitive: canSeeSensitive(admin) });
    return Response.json(body, { status });
  } catch (err) {
    log.error('Service lookup', err.message);
    return Response.json({ error: 'Lookup failed' }, { status: 500 });
  }
}
