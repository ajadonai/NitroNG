import prisma from '@/lib/prisma';
import ServicesOverview from '@/components/services-page';

export const metadata = {
  title: 'Services',
  description: 'Browse all social media growth services on Nitro. Instagram followers, TikTok likes, YouTube subscribers, and more across 35+ platforms with Naira pricing.',
  alternates: { canonical: 'https://nitro.ng/services' },
  openGraph: {
    title: 'Services | The Nitro NG',
    description: 'Instagram followers, TikTok likes, YouTube subscribers, and more. 35+ platforms, Naira pricing, instant delivery.',
    url: 'https://nitro.ng/services',
    type: 'website',
  },
};

export const revalidate = 300;

async function getServicesData() {
  const groups = await prisma.serviceGroup.findMany({
    where: { enabled: true },
    include: {
      tiers: {
        where: { enabled: true },
        orderBy: { sellPer1k: 'asc' },
        take: 1,
      },
    },
    orderBy: { sortOrder: 'asc' },
  });

  const platformMap = {};
  for (const g of groups) {
    if (!g.tiers.length) continue;
    const p = g.platform;
    if (!platformMap[p]) platformMap[p] = { platform: p, serviceTypes: [], minPrice: Infinity };
    const type = g.name.replace(new RegExp(`^${p}\\s*`, 'i'), '').trim() || g.type || g.name;
    const price = g.tiers[0].sellPer1k / 100;
    if (!platformMap[p].serviceTypes.includes(type)) platformMap[p].serviceTypes.push(type);
    if (price < platformMap[p].minPrice) platformMap[p].minPrice = price;
  }

  return Object.values(platformMap).sort((a, b) => b.serviceTypes.length - a.serviceTypes.length);
}

export default async function ServicesPage() {
  let platforms = [];
  try { platforms = await getServicesData(); } catch {}

  const breadcrumb = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://nitro.ng' },
      { '@type': 'ListItem', position: 2, name: 'Services', item: 'https://nitro.ng/services' },
    ],
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumb) }} />
      <ServicesOverview platforms={platforms} />
    </>
  );
}
