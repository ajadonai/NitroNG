import ContactView from '@/components/contact-page';

export const metadata = {
  title: 'Contact Nitro NG Support',
  description: 'Reach Nitro support on WhatsApp for the fastest reply, or email support@nitro.ng. Lagos based, answering every day.',
  alternates: { canonical: 'https://nitro.ng/contact' },
  openGraph: {
    title: 'Contact Nitro NG Support',
    description: 'Reach Nitro support on WhatsApp for the fastest reply, or email support@nitro.ng. Lagos based, answering every day.',
    url: 'https://nitro.ng/contact',
    type: 'website',
  },
};

export default function ContactPage() {
  const breadcrumb = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://nitro.ng' },
      { '@type': 'ListItem', position: 2, name: 'Contact' },
    ],
  };

  const localBusiness = {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    name: 'The Nitro NG',
    url: 'https://nitro.ng',
    email: 'support@nitro.ng',
    address: {
      '@type': 'PostalAddress',
      addressLocality: 'Lagos',
      addressCountry: 'NG',
    },
    openingHours: 'Mo-Su 00:00-23:59',
    areaServed: { '@type': 'Country', name: 'Nigeria' },
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumb) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(localBusiness) }} />
      <ContactView />
    </>
  );
}
