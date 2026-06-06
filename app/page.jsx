import HomeClient from '@/components/home-client';

export const metadata = {
  title: 'The Nitro NG | Grow Your Socials Faster',
  description: 'Nigeria\'s fastest social media growth platform with the cleanest dashboard. Grow Instagram, TikTok, YouTube, X, and 35+ platforms. Instant delivery, Naira pricing, automatic refunds.',
  alternates: { canonical: 'https://nitro.ng' },
};

export default function Page() {
  return <HomeClient />;
}
