import prisma from '@/lib/prisma';
import { log } from "@/lib/logger";

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const howto = searchParams.get('howto') === 'true';
    const category = searchParams.get('category');
    const slug = searchParams.get('slug');

    // Single post by slug
    if (slug) {
      const post = await prisma.blogPost.findFirst({
        where: { slug, published: true },
      });
      if (!post) return Response.json({ error: 'Post not found' }, { status: 404 });

      // Increment views
      await prisma.blogPost.update({ where: { id: post.id }, data: { views: { increment: 1 } } });

      return Response.json({
        post: {
          ...post,
          createdAt: post.createdAt.toISOString(),
          updatedAt: post.updatedAt.toISOString(),
        },
      });
    }

    // List posts
    const where = { published: true };
    if (howto) where.showInHowTo = true;
    if (category) where.category = category;

    const posts = await prisma.blogPost.findMany({
      where,
      orderBy: howto ? { sortOrder: 'asc' } : { createdAt: 'desc' },
      select: {
        id: true, title: true, slug: true, excerpt: true, category: true,
        thumbnail: true, showInHowTo: true, authorName: true, views: true,
        createdAt: true,
      },
    });

    // Get categories for filter
    const categories = await prisma.blogPost.findMany({
      where: { published: true },
      select: { category: true },
      distinct: ['category'],
    });

    return Response.json({
      posts: posts.map(p => ({ ...p, createdAt: p.createdAt.toISOString() })),
      categories: categories.map(c => c.category),
    });
  } catch (err) {
    log.error('Blog GET', err.message);
    return Response.json({ error: 'Failed to load posts' }, { status: 500 });
  }
}
