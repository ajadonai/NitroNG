import ResellerView from '@/components/reseller-page';

export const metadata = {
  title: 'Reseller Programme — The Pit | Nitro NG',
  description: 'Earn commission on every order from people you refer to Nitro. Start at 30% of profit, scale to 50%. Apply to The Pit and start earning today.',
  robots: { index: true, follow: true },
  alternates: { canonical: 'https://nitro.ng/pit' },
  openGraph: {
    title: 'The Pit — Nitro Reseller Programme',
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
