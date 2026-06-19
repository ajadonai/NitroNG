import HomeClient from '@/components/home-client';

export const metadata = {
  title: 'The Nitro NG | Your Content Deserves a Bigger Audience',
  description: 'Nitro helps Nigerian creators, artists, and businesses reach a wider audience. Premium content promotion across 35+ platforms. Naira pricing, fast results, human support.',
  alternates: { canonical: 'https://nitro.ng' },
};

export default function Page() {
  return <HomeClient />;
}
