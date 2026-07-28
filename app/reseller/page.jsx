import ResellerView from '@/components/reseller-page';

export const metadata = {
  title: 'Reseller Programme — The Pit | Nitro NG',
  description: 'Earn commission on every order from people you refer to Nitro. Start at 30% of profit, scale to 50%. Apply to The Pit and start earning today.',
  alternates: { canonical: 'https://nitro.ng/reseller' },
  openGraph: {
    title: 'The Pit — Nitro Reseller Programme',
    description: 'Earn 30-50% commission on referred orders. No upfront cost, no inventory. Apply today.',
    url: 'https://nitro.ng/reseller',
    type: 'website',
  },
};

export default function ResellerPage() {
  const breadcrumb = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://nitro.ng' },
      { '@type': 'ListItem', position: 2, name: 'Reseller Programme' },
    ],
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumb) }} />
      <ResellerView />
    </>
  );
}
