import { redirect } from 'next/navigation';

export const metadata = {
  title: 'Services',
  description: 'Browse all social media growth services on Nitro. Instagram followers, TikTok likes, YouTube subscribers, and more across 35+ platforms with Naira pricing.',
  alternates: { canonical: 'https://nitro.ng/pricing' },
};

export default function ServicesPage() {
  redirect('/pricing');
}
