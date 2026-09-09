import HomeClient from '@/components/home-client';
import { resolveLandingAuthQuery } from '@/lib/landing-auth-query';
import { localeMetadata } from '@/lib/locale-metadata';

export const revalidate = 60;

export const metadata = localeMetadata({
  locale: 'sw',
  title: 'The Nitro NG | Maudhui yako yanastahili hadhira kubwa zaidi',
  description: 'Ukuzaji wa maudhui kwa waundaji na biashara kwenye majukwaa 28. Lipa kwa kadi, uhamisho wa benki au crypto, uwasilishaji wa haraka na msaada wa kweli kwenye WhatsApp.',
});

export default async function Page({ searchParams }) {
  return <HomeClient initialAuthQuery={resolveLandingAuthQuery(await searchParams)} />;
}
