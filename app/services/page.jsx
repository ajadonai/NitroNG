import { redirect } from 'next/navigation';

export const metadata = {
  title: 'Services | 190+ Growth Services on Nigeria\'s Fastest SMM Panel',
  description: 'Browse 190+ social media growth services on Nigeria\'s fastest SMM panel. Instagram followers, TikTok likes, YouTube subscribers, and more. Instant delivery, Naira pricing, cleanest dashboard.',
  alternates: { canonical: 'https://nitro.ng/pricing' },
};

export default function ServicesPage() {
  redirect('/pricing');
}
