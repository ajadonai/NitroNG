import { redirect } from 'next/navigation';

export const metadata = {
  title: 'Services | 190+ Social Media Growth Services in Nigeria',
  description: 'Browse 190+ social media growth services on Nigeria\'s fastest platform. Grow Instagram, TikTok, YouTube, and more. Instant delivery, Naira pricing, cleanest dashboard.',
  alternates: { canonical: 'https://nitro.ng/pricing' },
};

export default function ServicesPage() {
  redirect('/pricing');
}
