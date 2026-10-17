import ResellerView from '@/components/reseller-page';

export const metadata = {
  // "Affiliate", not "Reseller": the wholesale page at /resellers is "Reseller
  // Pricing", and two reseller-titled pages read to Google as one topic, which
  // is how it came to pick another canonical for this one (Search Console).
  title: 'Affiliate Programme | The Pit',
  description: 'Nitro\'s affiliate programme: share your link and earn commission on every order from people you refer. Start at 30% of profit, scale to 50%. No upfront cost.',
  robots: { index: true, follow: true },
  alternates: { canonical: 'https://nitro.ng/pit' },
  openGraph: {
    title: 'The Pit | Nitro Affiliate Programme',
    description: 'Earn 30-50% commission on referred orders. No upfront cost, no inventory. Apply today.',
    url: 'https://nitro.ng/pit',
    type: 'website',
  },
};

export default function PitPage() {
  const breadcrumb = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://nitro.ng' },
      { '@type': 'ListItem', position: 2, name: 'The Pit' },
    ],
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumb) }} />
      <ResellerView />
    </>
  );
}
