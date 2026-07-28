import prisma from '@/lib/prisma';
import HelpListing from '@/components/help-listing';

export const revalidate = 300;

export const metadata = {
  title: 'Help Centre',
  description: 'Guides on placing orders, adding funds, understanding tiers, tracking orders and more. Everything you need to use Nitro.',
  alternates: { canonical: 'https://nitro.ng/help' },
  openGraph: {
    title: 'Help Centre | The Nitro NG',
    description: 'Guides on placing orders, adding funds, understanding tiers, tracking orders and more.',
    url: 'https://nitro.ng/help',
    type: 'website',
  },
};

export default async function HelpPage() {
  let articles = [];
  try {
    const posts = await prisma.blogPost.findMany({
      where: { published: true, category: 'Help' },
      orderBy: { sortOrder: 'asc' },
      select: { title: true, slug: true, excerpt: true },
    });
    articles = posts;
  } catch {}

  const breadcrumb = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://nitro.ng' },
      { '@type': 'ListItem', position: 2, name: 'Help' },
    ],
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumb) }} />
      <HelpListing articles={articles} />
    </>
  );
}
