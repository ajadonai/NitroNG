import AboutView from '@/components/about-page';

export const metadata = {
  title: 'About The Nitro NG | Nigeria\'s Fastest Social Media Growth Platform',
  description: 'The Nitro NG is a registered Nigerian company (RC 9514845) building the fastest social media growth platform in Nigeria with the cleanest dashboard. Lagos based, Naira native, used by creators and businesses across the country.',
  alternates: { canonical: 'https://nitro.ng/about' },
  openGraph: {
    title: 'About | The Nitro NG',
    description: 'A registered Nigerian company helping creators grow their social media. Lagos-based, Naira-native.',
    url: 'https://nitro.ng/about',
    type: 'website',
  },
};

export default function AboutPage() {
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
      <AboutView />
    </>
  );
}
