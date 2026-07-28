import prisma from '@/lib/prisma';

export async function POST(req) {
  const { slug } = await req.json();
  if (!slug || typeof slug !== 'string') return new Response(null, { status: 400 });

  await prisma.blogPost.updateMany({
    where: { slug, published: true },
    data: { views: { increment: 1 } },
  });

  return new Response(null, { status: 204 });
}
