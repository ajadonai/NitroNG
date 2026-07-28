import prisma from '@/lib/prisma';
import { notFound } from 'next/navigation';
import BlogPostView from '@/components/blog-post';
import BlogCategoryView from '@/components/blog-category-page';
import { getLiveValues, injectLiveValues } from '@/lib/blog-values';
import { renderBlogContent, serializeJsonLd } from '@/lib/blog-rendering';
import BLOG_CATEGORIES, { getTopicsForSlug } from '@/lib/blog-categories';

export const revalidate = 3600;

export async function generateStaticParams() {
  const posts = await prisma.blogPost.findMany({
    where: { published: true, NOT: { category: 'Help' } },
    select: { slug: true },
  });
  const slugs = posts.map(p => ({ slug: p.slug }));
  for (const key of Object.keys(BLOG_CATEGORIES)) {
    slugs.push({ slug: key });
  }
  return slugs;
}

const META_TITLE_OVERRIDES = {
  'youtube-monetization-nigeria-requirements': 'YouTube Monetization in Nigeria: Requirements',
  'ugc-creator-work-nigeria': 'UGC Creator Work: Getting Paid for Content',
  'smm-panel-api-nigeria': 'SMM Panel API: What It Is and How It Works',
  'where-nigerian-artists-should-promote-music': 'Where Nigerian Artists Should Promote Music',
  'selling-to-diaspora-audience-nigerian-creator': 'Selling to a Diaspora Audience as a Creator',
  'what-nigerian-brands-pay-influencers': 'What Nigerian Brands Actually Pay Influencers',
  'social-media-promotion-small-business-nigeria': 'Social Media Promotion for Nigerian Businesses',
  'smm-panel-opay-palmpay-kuda-bank-transfer': 'SMM Panels That Accept Opay and PalmPay',
  'tracking-parameters-in-social-media-links': 'Remove Tracking Parameters From Social Links',
  'smm-for-nigerian-musicians-first-5000': 'SMM for Nigerian Musicians: Your First ₦5,000',
  'platforms-that-pay-nigerian-creators': 'Platforms That Pay Nigerian Creators, Ranked',
  'nigerian-vs-international-smm-panels': 'Nigerian vs International SMM Panels',
  'make-money-tiktok-nigeria-without-creator-fund': 'Make Money on TikTok in Nigeria Without the Fund',
  'instagram-monetization-nigeria': 'Instagram Monetization in Nigeria: Every Route',
  'how-smm-refills-work-and-what-they-do-not-cover': 'How Refills Work on SMM Panels',
  'how-nigerian-musicians-get-paid': 'How Nigerian Musicians Get Paid on Streaming',
  'service-tiers-explained': 'Service Tiers Explained: Budget vs Standard',
  'followers-needed-brand-deals-nigeria': 'How Many Followers for Brand Deals in Nigeria?',
  'how-to-buy-telegram-members-nigeria': 'How to Buy Telegram Members in Nigeria',
  'cost-to-grow-nigerian-instagram-page-2026': 'Cost to Grow a Nigerian Instagram Page in 2026',
  'cheapest-smm-panel-nigeria-price-filter': 'Cheapest SMM Panel in Nigeria: Beyond Price',
  'what-is-smm-panel-beginners-guide': "What Is an SMM Panel? Beginner's Guide",
  'does-facebook-business-page-work-nigeria': 'Does a Facebook Business Page Work in Nigeria?',
  'does-linkedin-work-for-nigerian-professionals': 'Does LinkedIn Work for Nigerian Professionals?',
  'how-to-test-an-smm-panel-before-you-commit': 'How to Test an SMM Panel Before You Commit',
  'how-nigerian-creators-get-paid-from-abroad': 'How Nigerian Creators Get Paid from Abroad',
  'smm-panel-scams-nigeria-red-flags': 'SMM Panel Scams in Nigeria: Red Flags',
  'best-smm-panel-nigeria': 'Best SMM Panel in Nigeria: What to Look For',
};

function metaTitleFor(slug, dbTitle) {
  if (META_TITLE_OVERRIDES[slug]) return META_TITLE_OVERRIDES[slug];
  let t = dbTitle;
  if (t.length <= 50) return t;
  t = t.replace(/ for Nigerian Users$/, '');
  if (t.length <= 50) return t;
  t = t.replace(/\s*\([^)]+\)$/, '');
  if (t.length <= 50) return t;
  const q = t.indexOf('? ');
  if (q > 0 && q + 1 <= 50) return t.slice(0, q + 1);
  return t;
}

export async function generateMetadata({ params }) {
  const { slug } = await params;

  const cat = BLOG_CATEGORIES[slug];
  if (cat) {
    return {
      title: cat.h1,
      description: cat.metaDesc,
      alternates: { canonical: `https://nitro.ng/blog/${slug}` },
      openGraph: { title: cat.h1, description: cat.metaDesc, url: `https://nitro.ng/blog/${slug}`, type: 'website' },
    };
  }

  const post = await prisma.blogPost.findFirst({
    where: { slug, published: true },
    select: { title: true, excerpt: true, authorName: true, createdAt: true, updatedAt: true },
  });
  if (!post) return {};

  const description = post.excerpt || post.title;

  return {
    title: metaTitleFor(slug, post.title),
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
    },
    twitter: {
      card: 'summary_large_image',
      title: post.title,
      description,
    },
  };
}


export default async function BlogSlugPage({ params }) {
  const { slug } = await params;

  const cat = BLOG_CATEGORIES[slug];
  if (cat) return renderCategory(slug, cat);

  return renderPost(slug);
}


async function renderCategory(slug, cat) {
  const allPosts = await prisma.blogPost.findMany({
    where: { published: true, NOT: { category: 'Help' } },
    select: { id: true, title: true, slug: true, excerpt: true, category: true, thumbnail: true, authorName: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
  });

  const posts = allPosts
    .filter(p => cat.match(p.slug))
    .map(p => ({ ...p, createdAt: p.createdAt.toISOString() }));

  if (!posts.length) notFound();

  const otherCategories = Object.entries(BLOG_CATEGORIES)
    .filter(([k]) => k !== slug)
    .map(([k, v]) => ({ slug: k, label: v.label }));

  const breadcrumb = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://nitro.ng' },
      { '@type': 'ListItem', position: 2, name: 'Blog', item: 'https://nitro.ng/blog' },
      { '@type': 'ListItem', position: 3, name: cat.label },
    ],
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(breadcrumb) }} />
      <BlogCategoryView
        slug={slug}
        label={cat.label}
        h1={cat.h1}
        intro={cat.intro}
        posts={posts}
        otherCategories={otherCategories}
      />
    </>
  );
}


async function renderPost(slug) {
  const [post, liveValues] = await Promise.all([
    prisma.blogPost.findFirst({ where: { slug, published: true } }),
    getLiveValues(),
  ]);
  if (!post) notFound();

  post.content = renderBlogContent(injectLiveValues(post.content, liveValues));

  // Related posts: find posts sharing the same topics
  const topics = getTopicsForSlug(slug);
  let related = [];
  if (topics.length) {
    const allPosts = await prisma.blogPost.findMany({
      where: { published: true, NOT: [{ category: 'Help' }, { slug }] },
      select: { title: true, slug: true, excerpt: true, category: true, thumbnail: true, authorName: true, createdAt: true },
      orderBy: { views: 'desc' },
    });
    const seen = new Set();
    for (const p of allPosts) {
      if (seen.has(p.slug)) continue;
      const pTopics = getTopicsForSlug(p.slug);
      if (pTopics.some(t => topics.includes(t))) {
        seen.add(p.slug);
        related.push({ ...p, createdAt: p.createdAt.toISOString() });
      }
      if (related.length >= 4) break;
    }
  }

  const articleSchema = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    description: post.excerpt || post.title,
    ...(post.thumbnail && { image: `https://nitro.ng${post.thumbnail}` }),
    datePublished: post.createdAt.toISOString(),
    dateModified: post.updatedAt.toISOString(),
    author: { "@type": "Person", name: post.authorName || "Nitro Team" },
    publisher: { "@type": "Organization", name: "The Nitro NG", url: "https://nitro.ng" },
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

  const serialized = {
    ...post,
    createdAt: post.createdAt.toISOString(),
    updatedAt: post.updatedAt.toISOString(),
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(articleSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(breadcrumbSchema) }} />
      <BlogPostView post={serialized} related={related} />
    </>
  );
}
