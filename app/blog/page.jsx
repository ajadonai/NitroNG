import prisma from '@/lib/prisma';
import BlogListing from '@/components/blog-listing';
import { getLiveValues, injectLiveValues } from '@/lib/blog-values';

export const revalidate = 300;

const PER_PAGE = 9;

export const metadata = {
  title: 'Blog | Social Media Growth Tips from The Nitro NG',
  description: 'Tips, guides, and strategies to grow your social media presence in Nigeria. From the team behind Nigeria\'s fastest social media growth platform.',
  alternates: { canonical: 'https://nitro.ng/blog' },
  openGraph: {
    title: 'The Nitro NG Blog',
    description: 'Tips, guides, and updates to help you grow your social media presence. From the Nitro team.',
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

    const liveValues = await getLiveValues();
    serializedPosts = posts.map(p => ({
      ...p,
      excerpt: p.excerpt ? injectLiveValues(p.excerpt, liveValues) : p.excerpt,
      createdAt: p.createdAt.toISOString(),
    }));
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
