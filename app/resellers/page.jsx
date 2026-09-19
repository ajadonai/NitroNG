import ResellerHQView from '@/components/reseller-hq';

export const metadata = {
  title: 'Reseller Pricing | Wholesale SMM Rates in Naira',
  description: 'Run a panel or buy in volume? Get wholesale prices on every Nitro service, paid in naira — no dollar cards, no FX. Message us on WhatsApp to get set up.',
  robots: { index: true, follow: true },
  alternates: { canonical: 'https://nitro.ng/resellers' },
  openGraph: {
    title: 'Nitro Reseller Pricing | Wholesale Rates in Naira',
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
      // The last item may omit `item` per the spec, and Google accepts it — but
      // it also renders the trail from what it is given, so naming the URL
      // removes the one thing a validator can be uncertain about.
      { '@type': 'ListItem', position: 2, name: 'Resellers', item: 'https://nitro.ng/resellers' },
    ],
  };
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumb) }} />
      <ResellerHQView />
    </>
  );
}
