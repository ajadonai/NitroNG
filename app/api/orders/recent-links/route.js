import prisma from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';

/**
 * The caller's last five distinct links on one platform, derived from their own
 * order history. Nothing new is collected: most people order for the same one
 * or two accounts over and over and were retyping the link every time.
 *
 * `platform` is the New Order platform id ("instagram", "tiktok", "twitter").
 * platformAtPurchase is a free-text snapshot with mixed casing in the wild —
 * "Instagram", "tiktok", "TikTok", "Twitter/X" — so the match is a
 * case-insensitive contains rather than an equality.
 *
 * The pinned handle rides along on the same request. It used to live in
 * localStorage, which made it per-device: somebody who pins their main account
 * on a laptop opened the same page on a phone and found nothing pinned, which
 * is the opposite of what pinning is for.
 */

/** The pin map, parsed defensively — it is a text column and may be anything. */
export function readPins(raw) {
  try {
    const v = JSON.parse(raw || '{}');
    return v && typeof v === 'object' && !Array.isArray(v) ? v : {};
  } catch { return {}; }
}
export async function GET(req) {
  const session = await getCurrentUser();
  if (!session) return Response.json({ error: 'Not authenticated' }, { status: 401 });

  const platform = new URL(req.url).searchParams.get('platform')?.trim().toLowerCase();
  if (!platform || platform.length > 40) return Response.json({ links: [] });

  const [pinRow, rows] = await Promise.all([
    prisma.user.findUnique({ where: { id: session.id }, select: { pinnedLinks: true } }),
    prisma.order.groupBy({
    by: ['link'],
    where: {
      userId: session.id,
      deletedAt: null,
      // Completed only. A Partial or a stuck Processing order is often a link
      // that was wrong in some way the provider only half-tolerated, and a
      // Cancelled one is refunded, withdrawn or rejected upstream — none of
      // them is a link worth offering again. Only a delivered order proves it.
      status: 'Completed',
      link: { not: '' },
      platformAtPurchase: { contains: platform, mode: 'insensitive' },
    },
    _count: { _all: true },
    _max: { createdAt: true },
    orderBy: { _max: { createdAt: 'desc' } },
    take: 5,
    }),
  ]);

  const pinned = readPins(pinRow?.pinnedLinks)[platform] || null;

  return Response.json(
    { links: rows.map((r) => ({ link: r.link, count: r._count._all, last: r._max.createdAt })), pinned },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}

/**
 * Pin a handle for a platform, or clear it by sending `link: null`.
 *
 * Only ever one per platform: the point of the pin is that the box fills with
 * it, and two pins cannot both fill one box. Writing the whole map back is
 * safe because it is read and written in the same request and is only ever a
 * handful of keys.
 */
export async function POST(req) {
  const session = await getCurrentUser();
  if (!session) return Response.json({ error: 'Not authenticated' }, { status: 401 });

  let body = {};
  try { body = await req.json(); } catch { return Response.json({ error: 'Bad request' }, { status: 400 }); }
  const platform = String(body.platform || '').trim().toLowerCase();
  if (!platform || platform.length > 40) return Response.json({ error: 'platform required' }, { status: 400 });

  const link = body.link == null ? null : String(body.link);
  // The box it fills is a URL box, so anything that is not one cannot be a pin.
  if (link !== null && (link.length > 500 || !/^https?:\/\//i.test(link))) {
    return Response.json({ error: 'link must be a URL' }, { status: 400 });
  }

  const row = await prisma.user.findUnique({ where: { id: session.id }, select: { pinnedLinks: true } });
  const pins = readPins(row?.pinnedLinks);
  if (link === null) delete pins[platform];
  else pins[platform] = link;

  await prisma.user.update({ where: { id: session.id }, data: { pinnedLinks: JSON.stringify(pins) } });
  return Response.json({ success: true, pinned: link });
}
