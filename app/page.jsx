import HomeClient from '@/components/home-client';
import { resolveLandingAuthQuery } from '@/lib/landing-auth-query';

export const metadata = {
  title: 'The Nitro NG | Your Content Deserves a Bigger Audience',
  description: 'Nitro helps Nigerian creators, artists, and businesses reach a wider audience. 35+ content-promotion service categories across major platforms. Naira pricing, fast results, human support.',
  alternates: { canonical: 'https://nitro.ng' },
};

export default async function Page({ searchParams }) {
  const initialAuthQuery = resolveLandingAuthQuery(await searchParams);
  return <HomeClient initialAuthQuery={initialAuthQuery} />;
}
