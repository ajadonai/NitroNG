import prisma from '@/lib/prisma';
import { log } from "@/lib/logger";

const PER_PAGE = 9;

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const howto = searchParams.get('howto') === 'true';
    const category = searchParams.get('category');
    const slug = searchParams.get('slug');
    const page = Math.max(1, parseInt(searchParams.get('page')) || 1);

    // Single post by slug
    if (slug) {
      const post = await prisma.blogPost.findFirst({
        where: { slug, published: true },
      });
      if (!post) return Response.json({ error: 'Post not found' }, { status: 404 });

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
    const search = searchParams.get('search');
    const where = { published: true };
    if (howto) where.showInHowTo = true;
    if (category) where.category = category;
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { excerpt: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [posts, total] = await Promise.all([
      prisma.blogPost.findMany({
        where,
        orderBy: howto ? { sortOrder: 'asc' } : { createdAt: 'desc' },
        select: {
          id: true, title: true, slug: true, excerpt: true, category: true,
          thumbnail: true, showInHowTo: true, authorName: true, views: true,
          createdAt: true,
        },
        skip: (page - 1) * PER_PAGE,
        take: PER_PAGE,
      }),
      prisma.blogPost.count({ where }),
    ]);

    const categories = await prisma.blogPost.findMany({
      where: { published: true },
      select: { category: true },
      distinct: ['category'],
    });

    return Response.json({
      posts: posts.map(p => ({ ...p, createdAt: p.createdAt.toISOString() })),
      categories: categories.map(c => c.category),
      page,
      totalPages: Math.ceil(total / PER_PAGE),
      total,
    });
  } catch (err) {
    log.error('Blog GET', err.message);
    return Response.json({ error: 'Failed to load posts' }, { status: 500 });
  }
}
