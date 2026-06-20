import { redirect } from 'next/navigation';

export const metadata = {
  title: 'Services | 190+ Content Promotion Services in Nigeria',
  description: 'Browse 190+ promotion services for Instagram, TikTok, YouTube, and more. Naira pricing, fast results, cleanest dashboard.',
  alternates: { canonical: 'https://nitro.ng/pricing' },
};

export default function ServicesPage() {
  redirect('/pricing');
}
