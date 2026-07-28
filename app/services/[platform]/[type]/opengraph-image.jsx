import { ImageResponse } from 'next/og';
import prisma from '@/lib/prisma';
import SERVICE_TYPE_META from '@/lib/service-type-meta';
import { OgCard, OG_SIZE, loadOgFonts } from '@/lib/og-card';

export const alt = 'The Nitro NG — growth services';
export const size = OG_SIZE;
export const contentType = 'image/png';

export default async function OGImage({ params }) {
  const { platform, type } = await params;
  const meta = SERVICE_TYPE_META[`${platform}/${type}`];
  if (!meta) return new Response(null, { status: 404 });

  let price = '';
  try {
    const groups = await prisma.serviceGroup.findMany({
      where: { enabled: true, platform: meta.dbPlatform },
      include: { tiers: { where: { enabled: true }, orderBy: { sellPer1k: 'asc' }, take: 1 } },
    });
    const matching = groups.filter(g => g.tiers.length > 0 && meta.matchPrefix.some(p => g.name.startsWith(p)));
    if (matching.length) {
      const cheapest = matching.reduce((min, g) => {
        const v = Number(g.tiers[0].sellPer1k);
        return v < min ? v : min;
      }, Infinity);
      const naira = Math.round(cheapest / 100);
      price = naira >= 100000
        ? `From ₦${Math.round(naira / 1000).toLocaleString()} per unit`
        : `From ₦${naira.toLocaleString()} per 1,000`;
    }
  } catch {}

  return new ImageResponse(
    <OgCard platform={meta.platformName} service={meta.typeLabel} price={price} />,
    { ...OG_SIZE, fonts: await loadOgFonts() },
  );
}
