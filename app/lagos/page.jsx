import LagosView from '@/components/lagos-page';

export const metadata = {
  title: 'SMM Panel in Lagos, Nigeria | Nitro NG',
  description: 'A Lagos based SMM panel. Pay in Naira by bank transfer, card or wallet, with WhatsApp support during Lagos hours.',
  alternates: { canonical: 'https://nitro.ng/lagos' },
  openGraph: {
    title: 'SMM Panel in Lagos, Nigeria | Nitro NG',
    description: 'Lagos-based SMM panel with Naira pricing, Nigerian bank support and WhatsApp customer service.',
    url: 'https://nitro.ng/lagos',
    type: 'website',
  },
};

export default function LagosPage() {
  const localBusiness = {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    name: 'The Nitro NG',
    url: 'https://nitro.ng',
    description: 'Social media marketing panel based in Lagos, Nigeria. Naira pricing, Nigerian bank payments, WhatsApp support.',
    email: 'support@nitro.ng',
    address: {
      '@type': 'PostalAddress',
      addressLocality: 'Lagos',
      addressRegion: 'Lagos State',
      addressCountry: 'NG',
    },
    openingHoursSpecification: {
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
      opens: '09:00',
      closes: '22:00',
    },
    sameAs: [
      'https://instagram.com/TheNitroNG',
      'https://x.com/TheNitroNG',
    ],
    currenciesAccepted: 'NGN',
    paymentAccepted: 'Bank Transfer, Debit Card, Credit Card, USSD, Cryptocurrency',
  };

  const breadcrumb = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://nitro.ng' },
      { '@type': 'ListItem', position: 2, name: 'Lagos' },
    ],
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(localBusiness) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumb) }} />
      <LagosView />
    </>
  );
}
