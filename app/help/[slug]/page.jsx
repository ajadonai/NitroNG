import prisma from '@/lib/prisma';
import { notFound } from 'next/navigation';
import BlogPostView from '@/components/blog-post';
import { getLiveValues, injectLiveValues } from '@/lib/blog-values';
import { renderBlogContent, serializeJsonLd } from '@/lib/blog-rendering';

const HELP_TITLE_OVERRIDES = {
  'how-to-find-the-right-link': 'How to Copy Your Social Media Link for Orders',
  'getting-started-first-order': 'Getting Started: Your First Order in 60 Seconds',
};

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const post = await prisma.blogPost.findFirst({
    where: { slug, published: true, category: 'Help' },
    select: { title: true, excerpt: true },
  });
  if (!post) return {};

  return {
    title: HELP_TITLE_OVERRIDES[slug] || post.title,
    description: post.excerpt || post.title,
    alternates: { canonical: `https://nitro.ng/help/${slug}` },
    openGraph: {
      title: post.title,
      description: post.excerpt || post.title,
      type: 'article',
      url: `https://nitro.ng/help/${slug}`,
    },
  };
}

export default async function HelpArticlePage({ params }) {
  const { slug } = await params;
  const [post, liveValues] = await Promise.all([
    prisma.blogPost.findFirst({ where: { slug, published: true, category: 'Help' } }),
    getLiveValues(),
  ]);
  if (!post) notFound();

  post.content = renderBlogContent(injectLiveValues(post.content, liveValues));

  const breadcrumb = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://nitro.ng' },
      { '@type': 'ListItem', position: 2, name: 'Help', item: 'https://nitro.ng/help' },
      { '@type': 'ListItem', position: 3, name: post.title },
    ],
  };

  const serialized = {
    ...post,
    createdAt: post.createdAt.toISOString(),
    updatedAt: post.updatedAt.toISOString(),
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(breadcrumb) }} />
      <BlogPostView post={serialized} backHref="/help" backLabel="Help" />
    </>
  );
}
