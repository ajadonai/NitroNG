import prisma from '@/lib/prisma';
import { publicOrderCount } from '@/lib/public-counts';
import AboutView from '@/components/about-page';

export const revalidate = 3600;

export const metadata = {
  title: 'About | Nigerian Digital Marketing Company',
  description: 'The Nitro NG is a registered Nigerian company, RC 9514845, Lagos based and Naira native. Here is who we are and how we operate.',
  alternates: { canonical: 'https://nitro.ng/about' },
  openGraph: {
    title: 'About | The Nitro NG',
    description: 'A registered Nigerian company helping creators grow their social media. Lagos-based, Naira-native.',
    url: 'https://nitro.ng/about',
    type: 'website',
  },
};

export default async function AboutPage() {
  let stats = null;
  try {
    const [customers, orders, services, platforms, first] = await Promise.all([
      prisma.user.count({ where: { emailVerified: true } }),
      prisma.order.count({ where: { deletedAt: null } }),
      prisma.serviceGroup.count({ where: { enabled: true } }),
      prisma.serviceGroup.findMany({ where: { enabled: true }, select: { platform: true }, distinct: ['platform'] }),
      prisma.order.findFirst({ where: { deletedAt: null }, orderBy: { createdAt: 'asc' }, select: { createdAt: true } }),
    ]);
    stats = { customers, orders: publicOrderCount(orders), services, platforms: platforms.length, since: first ? first.createdAt.toISOString() : null };
  } catch (err) {
    console.error('[About] Failed to load stats:', err.message);
  }

  const breadcrumb = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://nitro.ng' },
      { '@type': 'ListItem', position: 2, name: 'About' },
    ],
  };

  const localBusiness = {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    name: 'The Nitro NG',
    description: 'Social media growth platform for Nigerian creators and businesses.',
    url: 'https://nitro.ng',
    logo: 'https://nitro.ng/icon-512.png',
    address: {
      '@type': 'PostalAddress',
      addressLocality: 'Lagos',
      addressCountry: 'NG',
    },
    geo: {
      '@type': 'GeoCoordinates',
      latitude: '6.5244',
      longitude: '3.3792',
    },
    contactPoint: {
      '@type': 'ContactPoint',
      contactType: 'customer support',
      email: 'support@nitro.ng',
      availableLanguage: 'English',
    },
    sameAs: [
      'https://instagram.com/Nitro.ng',
      'https://instagram.com/TheNitroNg',
      'https://twitter.com/TheNitroNG',
    ],
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumb) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(localBusiness) }} />
      <AboutView stats={stats} />
    </>
  );
}
