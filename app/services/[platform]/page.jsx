import prisma from '@/lib/prisma';
import { notFound } from 'next/navigation';
import PricingView from '@/components/pricing-page';

export const revalidate = 300;

const PLATFORM_META = {
  instagram: { name: 'Instagram', kw: 'buy Instagram followers Nigeria', desc: 'followers, likes, views, comments, story views, saves, and reels engagement' },
  tiktok: { name: 'TikTok', kw: 'buy TikTok followers Nigeria', desc: 'followers, likes, views, shares, comments, and livestream viewers' },
  youtube: { name: 'YouTube', kw: 'buy YouTube subscribers Nigeria', desc: 'subscribers, views, watch hours, likes, and comments' },
  x: { name: 'X', kw: 'buy X Twitter followers Nigeria', desc: 'followers, likes, retweets, views, and bookmarks' },
  facebook: { name: 'Facebook', kw: 'buy Facebook page likes Nigeria', desc: 'page likes, post likes, followers, views, and group members' },
  telegram: { name: 'Telegram', kw: 'buy Telegram members Nigeria', desc: 'channel members, group members, post views, and reactions' },
  spotify: { name: 'Spotify', kw: 'buy Spotify plays Nigeria', desc: 'plays, followers, monthly listeners, and playlist adds' },
  snapchat: { name: 'Snapchat', kw: 'buy Snapchat followers', desc: 'followers, story views, and engagement' },
  linkedin: { name: 'LinkedIn', kw: 'buy LinkedIn followers Nigeria', desc: 'followers, connections, post likes, and endorsements' },
  pinterest: { name: 'Pinterest', kw: 'buy Pinterest followers', desc: 'followers, repins, and board engagement' },
  twitch: { name: 'Twitch', kw: 'buy Twitch followers', desc: 'followers, viewers, and chat engagement' },
  discord: { name: 'Discord', kw: 'buy Discord members', desc: 'server members and online users' },
};

export async function generateMetadata({ params }) {
  const { platform } = await params;
  const meta = PLATFORM_META[platform];
  if (!meta) return {};

  return {
    title: `${meta.name} Growth Services`,
    description: `Grow your ${meta.name} with ${meta.desc}. Naira pricing, instant delivery, refill guarantees. Trusted by Nigerian creators and businesses.`,
    alternates: { canonical: `https://nitro.ng/services/${platform}` },
    openGraph: {
      title: `${meta.name} Growth Services | The Nitro NG`,
      description: `${meta.kw}. ${meta.desc}. Naira pricing, instant delivery.`,
      url: `https://nitro.ng/services/${platform}`,
      type: 'website',
    },
  };
}

async function getPlatformData(platformName) {
  const groups = await prisma.serviceGroup.findMany({
    where: { enabled: true, platform: platformName },
    include: {
      tiers: {
        where: { enabled: true },
        orderBy: { sellPer1k: 'asc' },
      },
    },
    orderBy: { sortOrder: 'asc' },
  });

  if (!groups.length) return null;

  const services = [];
  for (const g of groups) {
    if (!g.tiers.length) continue;
    const type = g.name.replace(new RegExp(`^${platformName}\\s*`, 'i'), '').trim() || g.type || g.name;
    if (!services.find(s => s.type === type)) {
      services.push({
        type,
        minPrice: g.tiers[0].sellPer1k / 100,
        maxPrice: g.tiers[g.tiers.length - 1].sellPer1k / 100,
        tiers: g.tiers.length,
        refill: g.tiers.some(t => t.refill),
      });
    }
  }

  return [{ platform: platformName, services }];
}

export default async function PlatformPage({ params }) {
  const { platform } = await params;
  const meta = PLATFORM_META[platform];
  if (!meta) notFound();

  let platforms = [];
  try { platforms = await getPlatformData(meta.name) || []; } catch {}
  if (!platforms.length) notFound();

  const breadcrumb = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://nitro.ng' },
      { '@type': 'ListItem', position: 2, name: 'Services', item: 'https://nitro.ng/services' },
      { '@type': 'ListItem', position: 3, name: meta.name },
    ],
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumb) }} />
      <PricingView platforms={platforms} />
    </>
  );
}
