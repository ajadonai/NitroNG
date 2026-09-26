import prisma from '@/lib/prisma';
import ServicesHubView from '@/components/services-hub-page';
import { getSiteStats } from '@/lib/site-stats';

export const revalidate = 3600;

// The counts were typed here as "29 platforms, 150+ service types" and both
// were wrong — 27 platforms carry a tested tier, and there are 269 of them.
// Read from lib/site-stats so this page and the homepage quote one catalogue.
export async function generateMetadata() {
  const s = await getSiteStats();
  const lead = s.curatedServices
    ? `${s.curatedServices.toLocaleString()} tested services across ${s.curatedPlatforms} platforms, priced in Naira.`
    : 'Tested growth services priced in Naira.';
  return {
    title: 'Social Media Growth Services in Nigeria',
    description: `${lead} Instagram, TikTok, YouTube, X, Facebook, Telegram, Spotify and more. Fund your wallet from ₦1,000.`,
    alternates: { canonical: 'https://nitro.ng/services' },
    openGraph: {
      title: 'Social Media Growth Services in Nigeria',
      description: `${lead} Instagram, TikTok, YouTube, X, Facebook, Telegram, Spotify and more.`,
      url: 'https://nitro.ng/services',
      type: 'website',
    },
  };
}

const PLATFORM_ORDER = [
  { slug: 'instagram', name: 'Instagram', group: 'social' },
  { slug: 'tiktok', name: 'TikTok', dbPlatform: 'tiktok', group: 'social' },
  { slug: 'youtube', name: 'YouTube', group: 'social' },
  { slug: 'x', name: 'X (Twitter)', dbPlatform: 'Twitter/X', group: 'social' },
  { slug: 'facebook', name: 'Facebook', group: 'social' },
  { slug: 'telegram', name: 'Telegram', group: 'social' },
  { slug: 'snapchat', name: 'Snapchat', group: 'social' },
  { slug: 'linkedin', name: 'LinkedIn', group: 'social' },
  { slug: 'twitch', name: 'Twitch', group: 'social' },
  { slug: 'discord', name: 'Discord', group: 'social' },
  { slug: 'spotify', name: 'Spotify', group: 'music' },
];

export default async function ServicesPage() {
  let platforms = [];

  try {
    const groups = await prisma.serviceGroup.findMany({
      where: { enabled: true },
      select: {
        platform: true,
        tiers: { where: { enabled: true }, select: { sellPer1k: true } },
      },
    });

    const stats = {};
    for (const g of groups) {
      const p = g.platform;
      if (!stats[p]) stats[p] = { serviceCount: 0, minPrice: Infinity };
      for (const t of g.tiers) {
        stats[p].serviceCount++;
        const rate = Number(t.sellPer1k);
        if (rate > 0 && rate < stats[p].minPrice) stats[p].minPrice = rate;
      }
    }

    platforms = PLATFORM_ORDER
      .map(p => {
        const s = stats[p.dbPlatform || p.name];
        if (!s || s.serviceCount === 0) return null;
        return {
          slug: p.slug,
          name: p.name,
          group: p.group,
          serviceCount: s.serviceCount,
          fromPrice: Math.ceil(s.minPrice / 100),
        };
      })
      .filter(Boolean);
  } catch {}

  return <ServicesHubView platforms={platforms} />;
}
