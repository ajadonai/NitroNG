import { ImageResponse } from 'next/og';
import prisma from '@/lib/prisma';
import { BlogOgCard, OgCard, OG_SIZE, OG_ALT, loadOgFonts } from '@/lib/og-card';

export const alt = OG_ALT;
export const size = OG_SIZE;
export const contentType = 'image/png';

export default async function OGImage({ params }) {
  const { slug } = await params;

  const post = await prisma.blogPost.findFirst({
    where: { slug, published: true },
    select: { title: true, category: true },
  });

  const fonts = await loadOgFonts();

  if (!post) {
    return new ImageResponse(<OgCard />, { ...OG_SIZE, fonts });
  }

  return new ImageResponse(
    <BlogOgCard title={post.title} category={post.category} />,
    { ...OG_SIZE, fonts },
  );
}
