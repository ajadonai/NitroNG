import ReviewsView from '@/components/reviews-page';

export const metadata = {
  title: 'Nitro NG Reviews: What to Expect',
  description: 'An honest account of what customers experience on Nitro. What works, what people complain about, how refills behave in practice, and our real numbers.',
  alternates: { canonical: 'https://nitro.ng/reviews' },
  openGraph: {
    title: 'Nitro NG Reviews | The Nitro NG',
    description: 'What using Nitro is actually like. Real numbers, real complaints, real refill behaviour.',
    url: 'https://nitro.ng/reviews',
    type: 'website',
  },
};

export default function ReviewsPage() {
  const breadcrumb = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://nitro.ng' },
      { '@type': 'ListItem', position: 2, name: 'Reviews' },
    ],
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumb) }} />
      <ReviewsView />
    </>
  );
}
