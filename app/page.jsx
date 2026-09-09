import HomeClient from '@/components/home-client';
import { resolveLandingAuthQuery } from '@/lib/landing-auth-query';
import { localeAlternates } from '@/lib/locale-metadata';

export const revalidate = 60;

export const metadata = {
  title: { absolute: 'The Nitro NG | Your Content Deserves a Bigger Audience' },
  description: 'Promotion for Nigerian creators and businesses across 28 platforms. Naira pricing, no dollar conversion, fast delivery and human support on WhatsApp.',
  // Every language version must list all the others, this one included, or
  // Google reads them as unrelated pages rather than one page in four
  // languages — which is the duplicate-content problem these URLs exist to
  // avoid. Built from one function so the sets cannot drift apart.
  alternates: { canonical: 'https://nitro.ng', languages: localeAlternates() },
};

export default async function Page({ searchParams }) {
  const initialAuthQuery = resolveLandingAuthQuery(await searchParams);
  return <HomeClient initialAuthQuery={initialAuthQuery} />;
}
