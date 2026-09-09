import HomeClient from '@/components/home-client';
import { resolveLandingAuthQuery } from '@/lib/landing-auth-query';
import { localeMetadata } from '@/lib/locale-metadata';

export const revalidate = 60;

export const metadata = localeMetadata({
  locale: 'ar',
  title: 'The Nitro NG | محتواك يستحق جمهورًا أكبر',
  description: 'ترويج لصنّاع المحتوى والشركات على 28 منصة. الدفع بالبطاقة أو التحويل البنكي أو العملات الرقمية، توصيل سريع، ودعم بشري على واتساب.',
});

export default async function Page({ searchParams }) {
  return <HomeClient initialAuthQuery={resolveLandingAuthQuery(await searchParams)} />;
}
