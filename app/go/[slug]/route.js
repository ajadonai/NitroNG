import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import crypto from 'crypto';
import prisma from '@/lib/prisma';
import { log } from '@/lib/logger';
import { getIpHashSalt } from '@/lib/env';

function hashIp(ip) {
  return crypto.createHash('sha256').update(ip + getIpHashSalt()).digest('hex');
}

function parseReferrer(ref) {
  if (!ref) return 'Direct';
  try {
    const host = new URL(ref).hostname.toLowerCase();
    if (host.includes('instagram')) return 'Instagram';
    if (host.includes('twitter') || host.includes('x.com')) return 'Twitter / X';
    if (host.includes('facebook') || host.includes('fb.com')) return 'Facebook';
    if (host.includes('whatsapp') || host.includes('wa.me')) return 'WhatsApp';
    if (host.includes('tiktok')) return 'TikTok';
    if (host.includes('youtube')) return 'YouTube';
    if (host.includes('google')) return 'Google';
    if (host.includes('t.me') || host.includes('telegram')) return 'Telegram';
    if (host.includes('linkedin')) return 'LinkedIn';
    if (host.includes('reddit')) return 'Reddit';
    if (host.includes('snapchat')) return 'Snapchat';
    if (host.includes('threads')) return 'Threads';
    return host;
  } catch { return 'Direct'; }
}

export async function GET(req, { params }) {
  const { slug } = await params;

  let link;
  try {
    link = await prisma.acquisitionLink.findUnique({ where: { slug } });
  } catch (err) {
    log.error('GoRedirect', `DB lookup failed: ${err.message}`);
  }

  if (!link || !link.enabled || link.archivedAt) {
    return NextResponse.redirect(new URL('/', req.url), 302);
  }

  try {
    const hdrs = await headers();
    const ip = hdrs.get('x-forwarded-for')?.split(',')[0]?.trim() || hdrs.get('x-real-ip') || 'unknown';
    const ua = hdrs.get('user-agent') || '';
    const referer = hdrs.get('referer') || '';

    const country = hdrs.get('x-vercel-ip-country') || null;
    const city = hdrs.get('x-vercel-ip-city') ? decodeURIComponent(hdrs.get('x-vercel-ip-city')) : null;

    const UAParser = (await import('ua-parser-js')).UAParser;
    const parser = new UAParser(ua);
    const device = parser.getDevice();
    const browserInfo = parser.getBrowser();
    const osInfo = parser.getOS();

    let deviceType = 'desktop';
    if (device.type === 'mobile') deviceType = 'mobile';
    else if (device.type === 'tablet') deviceType = 'tablet';

    const uaLower = ua.toLowerCase();
    const browser = uaLower.includes('instagram') ? 'Instagram'
      : uaLower.includes('fbav') ? 'Facebook'
      : uaLower.includes('tiktok') ? 'TikTok'
      : browserInfo.name || 'Other';

    await prisma.linkClick.create({
      data: {
        linkId: link.id,
        ipHash: hashIp(ip),
        deviceType,
        os: osInfo.name || null,
        browser,
        country,
        city,
        referrer: parseReferrer(referer),
      },
    });
  } catch (err) {
    log.error('GoRedirect', `Click logging error: ${err.message}`);
  }

  return NextResponse.redirect(new URL(`/?via=${slug}`, req.url), 302);
}
