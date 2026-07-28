import HomeClient from '@/components/home-client';
import { resolveLandingAuthQuery } from '@/lib/landing-auth-query';

export const revalidate = 60;

export const metadata = {
  title: { absolute: 'The Nitro NG | Your Content Deserves a Bigger Audience' },
  description: 'Promotion for Nigerian creators and businesses across 28 platforms. Naira pricing, no dollar conversion, fast delivery and human support on WhatsApp.',
  alternates: { canonical: 'https://nitro.ng' },
};

export default async function Page({ searchParams }) {
  const initialAuthQuery = resolveLandingAuthQuery(await searchParams);
  return <HomeClient initialAuthQuery={initialAuthQuery} />;
}
