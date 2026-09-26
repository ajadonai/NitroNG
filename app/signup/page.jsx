// Dedicated /signup route for SEO sitelinks
// Redirects to the homepage signup modal until a standalone signup page is built
import { redirect } from 'next/navigation';
import { getSiteStats } from '@/lib/site-stats';

// Said "140+ service types across 28 platforms". Neither number was ours: the
// tested catalogue is 269 services across 27 platforms. Read from
// lib/site-stats, like every other page that quotes the catalogue.
export async function generateMetadata() {
  const s = await getSiteStats();
  const catalogue = s.curatedServices
    ? `Naira pricing, fast delivery, and ${s.curatedServices.toLocaleString()} tested services across ${s.curatedPlatforms} platforms.`
    : 'Naira pricing, fast delivery, and a tested catalogue.';
  return {
    title: 'Create Account',
    description: `Create your free Nitro account and start growing your social media presence in minutes. ${catalogue}`,
    alternates: { canonical: '/signup' },
  };
}

export default function SignupPage() {
  redirect('/?signup=1');
}
