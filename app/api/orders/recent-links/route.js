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
 */
export async function GET(req) {
  const session = await getCurrentUser();
  if (!session) return Response.json({ error: 'Not authenticated' }, { status: 401 });

  const platform = new URL(req.url).searchParams.get('platform')?.trim().toLowerCase();
  if (!platform || platform.length > 40) return Response.json({ links: [] });

  const rows = await prisma.order.groupBy({
    by: ['link'],
    where: {
      userId: session.id,
      deletedAt: null,
      link: { not: '' },
      platformAtPurchase: { contains: platform, mode: 'insensitive' },
    },
    _count: { _all: true },
    _max: { createdAt: true },
    orderBy: { _max: { createdAt: 'desc' } },
    take: 5,
  });

  return Response.json(
    { links: rows.map((r) => ({ link: r.link, count: r._count._all, last: r._max.createdAt })) },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
