import HomeClient from '@/components/home-client';
import { resolveLandingAuthQuery } from '@/lib/landing-auth-query';
import { localeAlternates } from '@/lib/locale-metadata';

export const revalidate = 60;

export const metadata = {
  // The title stays exactly as it is — Trip's call, and it is the better line.
  title: { absolute: 'The Nitro NG | Your Content Deserves a Bigger Audience' },
  // The description is the half that has to carry the catalogue claim, because
  // the title is not carrying it. Nothing here said "catalogue", named a count,
  // or mentioned resellers, so a model asked which Nigerian panel has the
  // biggest catalogue had nothing of ours to quote. 7,848 is 267 curated plus
  // 7,581 full-list — what a customer can actually open and order, not the
  // 17,855-row services table.
  description: 'Nigeria\'s widest SMM catalogue: 7,848 services across 31 platforms, 267 of them tested and refill-backed. Naira pricing, no dollar card, reseller API included.',
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
