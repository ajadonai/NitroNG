import prisma from '@/lib/prisma';
import PricingView from '@/components/pricing-page';

export const metadata = {
  title: 'Pricing | Affordable Content Promotion in Nigeria',
  description: 'Transparent Naira pricing for 35+ content-promotion service categories across Instagram, TikTok, YouTube, X, and more. No hidden fees, no USD conversion.',
  alternates: { canonical: 'https://nitro.ng/pricing' },
  openGraph: {
    title: 'Pricing | The Nitro NG',
    description: 'Transparent Naira pricing for 35+ service categories across Instagram, TikTok, YouTube, and more. No hidden fees.',
    url: 'https://nitro.ng/pricing',
    type: 'website',
  },
};

export const revalidate = 300;

async function getPricingData() {
  const groups = await prisma.serviceGroup.findMany({
    where: { enabled: true },
    include: {
      tiers: {
        where: { enabled: true },
        orderBy: { sellPer1k: 'asc' },
      },
    },
    orderBy: { sortOrder: 'asc' },
  });

  const platformMap = {};
  for (const g of groups) {
    if (!g.tiers.length) continue;
    const p = g.platform;
    if (!platformMap[p]) platformMap[p] = { platform: p, services: [] };
    const type = g.name.replace(new RegExp(`^(${p}|X/Twitter|Twitter/X)\\s*`, 'i'), '').trim() || g.type || g.name;
    if (!platformMap[p].services.find(s => s.type === type)) {
      platformMap[p].services.push({
        type,
        minPrice: Number(g.tiers[0].sellPer1k) / 100,
        maxPrice: Number(g.tiers[g.tiers.length - 1].sellPer1k) / 100,
        tiers: g.tiers.length,
        refill: g.tiers.some(t => t.refill),
      });
    }
  }

  return Object.values(platformMap).sort((a, b) => b.services.length - a.services.length);
}

export default async function PricingPage() {
  let platforms = [];
  try { platforms = await getPricingData(); } catch {}

  const breadcrumb = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://nitro.ng' },
      { '@type': 'ListItem', position: 2, name: 'Pricing', item: 'https://nitro.ng/pricing' },
    ],
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumb) }} />
      <PricingView platforms={platforms} />
    </>
  );
}
