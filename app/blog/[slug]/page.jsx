import prisma from '@/lib/prisma';
import { notFound } from 'next/navigation';
import BlogPostView from '@/components/blog-post';

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const post = await prisma.blogPost.findFirst({
    where: { slug, published: true },
    select: { title: true, excerpt: true, thumbnail: true, authorName: true, createdAt: true, updatedAt: true },
  });
  if (!post) return {};

  const description = post.excerpt || post.title;
  const image = post.thumbnail ? `https://nitro.ng${post.thumbnail}` : undefined;

  return {
    title: post.title,
    description,
    alternates: { canonical: `https://nitro.ng/blog/${slug}` },
    openGraph: {
      title: post.title,
      description,
      type: 'article',
      url: `https://nitro.ng/blog/${slug}`,
      publishedTime: post.createdAt.toISOString(),
      modifiedTime: post.updatedAt.toISOString(),
      authors: [post.authorName || 'Nitro Team'],
      ...(image && { images: [{ url: image }] }),
    },
    twitter: {
      card: 'summary_large_image',
      title: post.title,
      description,
      ...(image && { images: [image] }),
    },
  };
}

export default async function BlogPostPage({ params }) {
  const { slug } = await params;
  const post = await prisma.blogPost.findFirst({
    where: { slug, published: true },
  });
  if (!post) notFound();

  // Increment views (fire-and-forget)
  prisma.blogPost.update({ where: { id: post.id }, data: { views: { increment: 1 } } }).catch(() => {});

  const articleSchema = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    description: post.excerpt || post.title,
    ...(post.thumbnail && { image: `https://nitro.ng${post.thumbnail}` }),
    datePublished: post.createdAt.toISOString(),
    dateModified: post.updatedAt.toISOString(),
    author: { "@type": "Person", name: post.authorName || "Nitro Team" },
    publisher: { "@type": "Organization", name: "Nitro", url: "https://nitro.ng" },
    mainEntityOfPage: { "@type": "WebPage", "@id": `https://nitro.ng/blog/${slug}` },
  };

  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: "https://nitro.ng" },
      { "@type": "ListItem", position: 2, name: "Blog", item: "https://nitro.ng/blog" },
      { "@type": "ListItem", position: 3, name: post.title },
    ],
  };

  // Serialize dates for client component
  const serialized = {
    ...post,
    createdAt: post.createdAt.toISOString(),
    updatedAt: post.updatedAt.toISOString(),
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />
      <BlogPostView post={serialized} />
    </>
  );
}
