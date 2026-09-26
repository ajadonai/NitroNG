import HomeClient from '@/components/home-client';
import { resolveLandingAuthQuery } from '@/lib/landing-auth-query';
import { localeAlternates } from '@/lib/locale-metadata';
import { getSiteStats } from '@/lib/site-stats';

export const revalidate = 60;

// The description is the half that carries the catalogue claim, because the
// title is not carrying it. A model asked which Nigerian panel has the biggest
// catalogue needs a number of ours to quote.
//
// The numbers used to be typed here — "7,848 services across 31 platforms, 267
// of them tested" — and all three had drifted by the time anyone looked: the
// tested count was 269 and the platform figure was quoting the full list while
// sitting next to the word "tested". They are read from the database now, on
// the same 60-second revalidate as the page, so the sentence Google indexes and
// the strip the visitor sees are the same two facts.
export async function generateMetadata() {
  // The only caller that needs the expensive full-list figure, because the
  // "widest catalogue" claim is a total and not the curated subset. It degrades
  // to a sentence without a number rather than holding up the build.
  const s = await getSiteStats({ includeFullList: true });
  const catalogue = s.totalServices
    ? `Nigeria's widest SMM catalogue: ${s.totalServices.toLocaleString()} services across ${s.fullPlatforms} platforms, ${s.curatedServices.toLocaleString()} of them tested and refill-backed.`
    : "Nigeria's widest SMM catalogue, tested and refill-backed.";
  return {
    // The title stays exactly as it is — Trip's call, and it is the better line.
    title: { absolute: 'The Nitro NG | Your Content Deserves a Bigger Audience' },
    description: `${catalogue} Naira pricing, no dollar card, reseller API included.`,
    // Every language version must list all the others, this one included, or
    // Google reads them as unrelated pages rather than one page in four
    // languages — which is the duplicate-content problem these URLs exist to
    // avoid. Built from one function so the sets cannot drift apart.
    alternates: { canonical: 'https://nitro.ng', languages: localeAlternates() },
  };
}

export default async function Page({ searchParams }) {
  const initialAuthQuery = resolveLandingAuthQuery(await searchParams);
  // The hero strip used to mount with nulls and fill in after a client fetch,
  // so every cold load — and the first pass of anything that does not wait for
  // that fetch — painted "0 Orders, 0 Accounts". Handing the numbers down from
  // the server means the first frame is already true.
  const stats = await getSiteStats();
  return <HomeClient initialAuthQuery={initialAuthQuery} initialStats={stats.display} />;
}
