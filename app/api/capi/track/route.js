import { sendEvent, parseFbCookies } from '@/lib/meta-capi';
import { getCurrentUser } from '@/lib/auth';

const ALLOWED = new Set(['PageView', 'ViewContent']);

export async function POST(req) {
  const { event_name, event_id, custom_data, source_url } = await req.json();
  if (!event_name || !event_id || !ALLOWED.has(event_name)) {
    return Response.json({ error: 'Bad request' }, { status: 400 });
  }

  const hdrs = req.headers;
  const { fbp, fbc } = parseFbCookies(hdrs.get('cookie'));

  let email, externalId;
  try {
    const user = await getCurrentUser();
    if (user) { email = user.email; externalId = user.id; }
  } catch {}

  sendEvent(event_name, {
    eventId: event_id,
    email,
    externalId,
    clientIp: hdrs.get('x-forwarded-for')?.split(',')[0]?.trim() || hdrs.get('x-real-ip'),
    userAgent: hdrs.get('user-agent'),
    fbp, fbc,
    sourceUrl: source_url,
    customData: custom_data && Object.keys(custom_data).length ? custom_data : undefined,
  });

  return Response.json({ ok: true });
}
