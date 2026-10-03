import { sendEvent, parseFbCookies } from '@/lib/meta-capi';
import { parseTikTokCookies, trackTikTokEvent } from '@/lib/tiktok-events';
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

  const clientIp = hdrs.get('x-forwarded-for')?.split(',')[0]?.trim() || hdrs.get('x-real-ip');
  const userAgent = hdrs.get('user-agent');

  sendEvent(event_name, {
    eventId: event_id,
    email,
    externalId,
    clientIp,
    userAgent,
    fbp, fbc,
    sourceUrl: source_url,
    customData: custom_data && Object.keys(custom_data).length ? custom_data : undefined,
  });

  // TikTok gets the same event under the same id, so the pair deduplicates.
  // PageView is excluded: the browser reports it through ttq.page(), which
  // carries no event_id, so a server twin could not be matched and would
  // simply double the count. Not critical — the pixel covers these.
  if (event_name !== 'PageView') {
    const { ttclid, ttp } = parseTikTokCookies(hdrs.get('cookie'));
    trackTikTokEvent(event_name, {
      eventId: event_id,
      email,
      externalId,
      clientIp,
      userAgent,
      ttclid, ttp,
      sourceUrl: source_url,
      properties: custom_data && Object.keys(custom_data).length ? custom_data : undefined,
    });
  }

  return Response.json({ ok: true });
}
