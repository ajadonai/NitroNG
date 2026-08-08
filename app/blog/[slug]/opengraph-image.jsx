import { ImageResponse } from 'next/og';
import { readFile } from 'fs/promises';
import { join } from 'path';
import prisma from '@/lib/prisma';
import { BlogOgCard, OgCard, OG_SIZE, OG_ALT, loadOgFonts } from '@/lib/og-card';

export const alt = OG_ALT;
export const size = OG_SIZE;
export const contentType = 'image/png';

const MIME = { webp: 'image/webp', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png' };

export default async function OGImage({ params }) {
  const { slug } = await params;

  const post = await prisma.blogPost.findFirst({
    where: { slug, published: true },
    select: { title: true, category: true, thumbnail: true },
  });

  if (post?.thumbnail) {
    try {
      const buf = await readFile(join(process.cwd(), 'public', post.thumbnail));
      const ext = post.thumbnail.split('.').pop()?.toLowerCase();
      return new Response(buf, {
        headers: { 'Content-Type': MIME[ext] || 'image/png', 'Cache-Control': 'public, max-age=86400' },
      });
    } catch {}
  }

  const fonts = await loadOgFonts();

  if (!post) {
    return new ImageResponse(<OgCard />, { ...OG_SIZE, fonts });
  }

  return new ImageResponse(
    <BlogOgCard title={post.title} category={post.category} />,
    { ...OG_SIZE, fonts },
  );
}
