import ResellerApiDocsView from '@/components/reseller-api-docs';

export const metadata = {
  title: 'Reseller API Documentation',
  description: 'POST https://nitro.ng/api/v2 in the standard SMM-panel format: services, add, status, refill, balance, cancel. Every verified account has a key in Settings; wholesale by approval.',
  robots: { index: true, follow: true },
  alternates: { canonical: 'https://nitro.ng/resellers/docs' },
};

export default function ResellerDocsPage() {
  // Three levels, which is the point: a one-level page gives Google nothing to
  // draw but the bare URL, while Home › Resellers › API Documentation is an
  // actual hierarchy and renders as the trail. It also tells Google these two
  // pages belong together, so the docs page lends its relevance to /resellers
  // instead of competing with it.
  const breadcrumb = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://nitro.ng' },
      { '@type': 'ListItem', position: 2, name: 'Resellers', item: 'https://nitro.ng/resellers' },
      { '@type': 'ListItem', position: 3, name: 'API Documentation', item: 'https://nitro.ng/resellers/docs' },
    ],
  };
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumb) }} />
      <ResellerApiDocsView />
    </>
  );
}
