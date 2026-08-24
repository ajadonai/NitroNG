import ResellersLandingView from '@/components/resellers-landing';

export const metadata = {
  title: 'Reseller Pricing — Wholesale SMM Rates in Naira | Nitro NG',
  description: 'Run a panel or buy in volume? Get wholesale prices on every Nitro service, paid in naira — no dollar cards, no FX. Message us on WhatsApp to get set up.',
  robots: { index: true, follow: true },
  alternates: { canonical: 'https://nitro.ng/resellers' },
  openGraph: {
    title: 'Nitro Reseller Pricing — Wholesale Rates in Naira',
    description: 'Wholesale prices on every service for panel owners, agencies and bulk buyers. Message us on WhatsApp to get set up.',
    url: 'https://nitro.ng/resellers',
    type: 'website',
  },
};

export default function ResellersPage() {
  const breadcrumb = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://nitro.ng' },
      { '@type': 'ListItem', position: 2, name: 'Resellers' },
    ],
  };
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumb) }} />
      <ResellersLandingView />
    </>
  );
}
