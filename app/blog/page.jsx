import prisma from '@/lib/prisma';
import BlogListing from '@/components/blog-listing';

const PER_PAGE = 9;

export const metadata = {
  title: 'Blog',
  description: 'Tips, guides, and updates to help you grow your social media presence — from the Nitro team.',
  alternates: { canonical: 'https://nitro.ng/blog' },
  openGraph: {
    title: 'The Nitro NG Blog',
    description: 'Tips, guides, and updates to help you grow your social media presence — from the Nitro team.',
    url: 'https://nitro.ng/blog',
    type: 'website',
  },
};

export default async function BlogPage() {
  let serializedPosts = [];
  let categoryList = [];
  let totalPages = 0;

  try {
    const [posts, categories, total] = await Promise.all([
      prisma.blogPost.findMany({
        where: { published: true },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true, title: true, slug: true, excerpt: true, category: true,
          thumbnail: true, showInHowTo: true, authorName: true, views: true,
          createdAt: true,
        },
        skip: 0,
        take: PER_PAGE,
      }),
      prisma.blogPost.findMany({
        where: { published: true },
        select: { category: true },
        distinct: ['category'],
      }),
      prisma.blogPost.count({ where: { published: true } }),
    ]);

    serializedPosts = posts.map(p => ({ ...p, createdAt: p.createdAt.toISOString() }));
    categoryList = categories.map(c => c.category);
    totalPages = Math.ceil(total / PER_PAGE);
  } catch (err) {
    console.error('[Blog] Failed to load posts:', err.message);
  }

  const breadcrumb = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://nitro.ng' },
      { '@type': 'ListItem', position: 2, name: 'Blog', item: 'https://nitro.ng/blog' },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumb) }}
      />
      <BlogListing
        initialPosts={serializedPosts}
        initialCategories={categoryList}
        initialTotalPages={totalPages}
      />
    </>
  );
}
