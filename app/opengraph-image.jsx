import { ImageResponse } from 'next/og';
import { OgCard, OG_SIZE, OG_ALT, loadOgFonts } from '@/lib/og-card';

export const alt = OG_ALT;
export const size = OG_SIZE;
export const contentType = 'image/png';

export default async function OGImage() {
  return new ImageResponse(<OgCard />, { ...OG_SIZE, fonts: await loadOgFonts() });
}
