import prisma from '@/lib/prisma';
import { notFound } from 'next/navigation';
import SERVICE_TYPE_META from '@/lib/service-type-meta';
import ServiceTypeView from '@/components/service-type-page';
import { renderBlogContent, serializeJsonLd } from '@/lib/blog-rendering';

export const revalidate = 300;

export async function generateStaticParams() {
  return Object.keys(SERVICE_TYPE_META).map(key => {
    const [platform, type] = key.split('/');
    return { platform, type };
  });
}

export async function generateMetadata({ params }) {
  const { platform, type } = await params;
  const meta = SERVICE_TYPE_META[`${platform}/${type}`];
  if (!meta || !meta.h1) return {};

  return {
    title: meta.title,
    description: meta.metaDesc,
    alternates: { canonical: `https://nitro.ng/services/${platform}/${type}` },
    openGraph: {
      title: meta.title,
      description: meta.metaDesc,
      url: `https://nitro.ng/services/${platform}/${type}`,
      type: 'website',
    },
  };
}

async function getFilteredServices(dbPlatform, matchPrefix) {
  const groups = await prisma.serviceGroup.findMany({
    where: { enabled: true, platform: dbPlatform },
    include: {
      tiers: { where: { enabled: true }, orderBy: { sellPer1k: 'asc' } },
    },
    orderBy: { sortOrder: 'asc' },
  });

  return groups
    .filter(g => g.tiers.length > 0 && matchPrefix.some(p => g.name.startsWith(p)))
    .map(g => {
      const displayName = g.name
        .replace(new RegExp(`^${g.platform}\\s*`, 'i'), '')
        .replace(/^X\/Twitter\s*/i, '')
        .trim() || g.name;
      return {
        name: displayName,
        tiers: g.tiers.map(t => ({
          tier: t.tier,
          price: Number(t.sellPer1k) / 100,
          refill: t.refill,
          refillDays: t.refillDays,
          speed: t.speed,
        })),
      };
    });
}

export default async function ServiceTypePage({ params }) {
  const { platform, type } = await params;
  const key = `${platform}/${type}`;
  const meta = SERVICE_TYPE_META[key];
  if (!meta || !meta.h1) notFound();

  let services = [];
  try {
    services = await getFilteredServices(meta.dbPlatform, meta.matchPrefix);
  } catch {}
  if (!services.length) notFound();

  const introHtml = meta.intro ? renderBlogContent(meta.intro) : '';

  const breadcrumb = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://nitro.ng' },
      { '@type': 'ListItem', position: 2, name: 'Services', item: 'https://nitro.ng/services' },
      { '@type': 'ListItem', position: 3, name: meta.platformName, item: `https://nitro.ng/services/${platform}` },
      { '@type': 'ListItem', position: 4, name: meta.typeLabel },
    ],
  };

  const faqSchema = meta.faq?.length ? {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: meta.faq.map(({ q, a }) => ({
      '@type': 'Question',
      name: q,
      acceptedAnswer: { '@type': 'Answer', text: a },
    })),
  } : null;

  // A type page sells a family of tiers, not one SKU — "Instagram Followers"
  // covers Budget and Standard at minimum, often a Nigerian and a US variant
  // too. AggregateOffer is the shape Google documents for exactly that: one
  // Product, a price range rather than a single figure. No aggregateRating —
  // there is no honest rating to attach yet (see the shelf), and Google's own
  // Product guidelines do not require one.
  //
  // The price is per 1,000, matching what the page's own h1 and copy already
  // promise ("from around ₦X per 1,000") — schema has to agree with what a
  // visitor reads, not state a number nobody sees.
  const allPrices = services.flatMap(s => s.tiers.map(t => t.price)).filter(p => p > 0);
  const productSchema = allPrices.length ? {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: `${meta.platformName} ${meta.typeLabel}`,
    description: meta.metaDesc,
    brand: { '@type': 'Brand', name: 'The Nitro NG' },
    offers: {
      '@type': 'AggregateOffer',
      priceCurrency: 'NGN',
      lowPrice: Math.min(...allPrices).toFixed(2),
      highPrice: Math.max(...allPrices).toFixed(2),
      offerCount: allPrices.length,
      availability: 'https://schema.org/InStock',
      url: `https://nitro.ng/services/${platform}/${type}`,
    },
  } : null;

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(breadcrumb) }} />
      {productSchema && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(productSchema) }} />}
      {faqSchema && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(faqSchema) }} />}
      <ServiceTypeView
        platform={meta.platformName}
        platformSlug={platform}
        typeLabel={meta.typeLabel}
        services={services}
        introHtml={introHtml}
        copy={{ h1: meta.h1, faq: meta.faq }}
      />
    </>
  );
}
