import prisma from '@/lib/prisma';
import { log } from "@/lib/logger";
import { requireAdmin, logActivity } from '@/lib/admin';

export async function GET() {
  const { admin, error } = await requireAdmin('blog');
  if (error) return error;

  try {
    const posts = await prisma.blogPost.findMany({
      orderBy: { createdAt: 'desc' },
    });

    return Response.json({
      posts: posts.map(p => ({
        ...p,
        createdAt: p.createdAt.toISOString(),
        updatedAt: p.updatedAt.toISOString(),
      })),
    });
  } catch (err) {
    log.error('Admin Blog GET', err.message);
    return Response.json({ error: 'Failed to load posts' }, { status: 500 });
  }
}

export async function POST(req) {
  const { admin, error } = await requireAdmin('blog', true);
  if (error) return error;

  try {
    const { action, postId, title, slug, excerpt, content, category, thumbnail, published, showInHowTo, sortOrder } = await req.json();

    if (action === 'create') {
      if (!title?.trim() || !content) return Response.json({ error: 'Title and content required' }, { status: 400 });

      const postSlug = slug || title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80);

      // Check slug uniqueness
      const existing = await prisma.blogPost.findUnique({ where: { slug: postSlug } });
      if (existing) return Response.json({ error: 'A post with this slug already exists' }, { status: 400 });

      const maxSort = await prisma.blogPost.aggregate({ _max: { sortOrder: true } });

      const post = await prisma.blogPost.create({
        data: {
          title: title.trim(),
          slug: postSlug,
          excerpt: excerpt?.trim() || null,
          content,
          category: category || 'Tutorials',
          thumbnail: thumbnail?.trim() || null,
          published: !!published,
          showInHowTo: !!showInHowTo,
          sortOrder: sortOrder || (maxSort._max.sortOrder || 0) + 1,
          authorName: admin.name,
        },
      });

      await logActivity(admin.name, `Created blog post: "${title}"`, 'blog');
      return Response.json({ success: true, post });
    }

    if (action === 'update') {
      if (!postId) return Response.json({ error: 'Post ID required' }, { status: 400 });

      const data = {};
      if (title !== undefined) data.title = title.trim();
      if (slug !== undefined) {
        const newSlug = slug.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
        const existing = await prisma.blogPost.findFirst({ where: { slug: newSlug, NOT: { id: postId } } });
        if (existing) return Response.json({ error: 'Slug already in use' }, { status: 400 });
        data.slug = newSlug;
      }
      if (excerpt !== undefined) data.excerpt = excerpt?.trim() || null;
      if (content !== undefined) data.content = content;
      if (category !== undefined) data.category = category;
      if (thumbnail !== undefined) data.thumbnail = thumbnail?.trim() || null;
      if (published !== undefined) data.published = !!published;
      if (showInHowTo !== undefined) data.showInHowTo = !!showInHowTo;
      if (sortOrder !== undefined) data.sortOrder = Number(sortOrder);

      const post = await prisma.blogPost.update({ where: { id: postId }, data });
      await logActivity(admin.name, `Updated blog post: "${post.title}"`, 'blog');
      return Response.json({ success: true, post });
    }

    if (action === 'delete') {
      if (!postId) return Response.json({ error: 'Post ID required' }, { status: 400 });
      const post = await prisma.blogPost.findUnique({ where: { id: postId } });
      if (!post) return Response.json({ error: 'Post not found' }, { status: 404 });

      await prisma.blogPost.delete({ where: { id: postId } });
      await logActivity(admin.name, `Deleted blog post: "${post.title}"`, 'blog');
      return Response.json({ success: true });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (err) {
    log.error('Admin Blog POST', err.message);
    return Response.json({ error: 'Action failed' }, { status: 500 });
  }
}
