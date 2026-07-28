import { ImageResponse } from 'next/og';
import prisma from '@/lib/prisma';
import { OgCard, OG_SIZE, loadOgFonts } from '@/lib/og-card';

export const alt = 'The Nitro NG — growth services';
export const size = OG_SIZE;
export const contentType = 'image/png';

const PLATFORM_MAP = {
  instagram: { name: 'Instagram', db: 'Instagram' },
  tiktok:    { name: 'TikTok',    db: 'tiktok' },
  youtube:   { name: 'YouTube',   db: 'YouTube' },
  x:         { name: 'X',         db: 'Twitter/X' },
  facebook:  { name: 'Facebook',  db: 'Facebook' },
  telegram:  { name: 'Telegram',  db: 'Telegram' },
  spotify:   { name: 'Spotify',   db: 'Spotify' },
  snapchat:  { name: 'Snapchat',  db: 'Snapchat' },
  linkedin:  { name: 'LinkedIn',  db: 'LinkedIn' },
  twitch:    { name: 'Twitch',    db: 'Twitch' },
  discord:   { name: 'Discord',   db: 'Discord' },
};

export default async function OGImage({ params }) {
  const { platform } = await params;
  const p = PLATFORM_MAP[platform];
  if (!p) return new Response(null, { status: 404 });

  let price = '';
  try {
    const cheapest = await prisma.tier.findFirst({
      where: { enabled: true, serviceGroup: { enabled: true, platform: p.db } },
      orderBy: { sellPer1k: 'asc' },
    });
    if (cheapest) {
      const naira = Math.round(Number(cheapest.sellPer1k) / 100);
      price = naira >= 100000
        ? `From ₦${Math.round(naira / 1000).toLocaleString()} per unit`
        : `From ₦${naira.toLocaleString()} per 1,000`;
    }
  } catch {}

  return new ImageResponse(
    <OgCard platform={p.name} price={price} />,
    { ...OG_SIZE, fonts: await loadOgFonts() },
  );
}
