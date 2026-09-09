import HomeClient from '@/components/home-client';
import { resolveLandingAuthQuery } from '@/lib/landing-auth-query';
import { localeMetadata } from '@/lib/locale-metadata';

export const revalidate = 60;

/* The same landing page as `/`, rendered in French by the provider in
   app/layout.jsx, which reads the locale from the header proxy.js sets.
   The title and description are the two strings a searcher actually reads in
   the results, so they are written here rather than translated at runtime. */
export const metadata = localeMetadata({
  locale: 'fr',
  title: 'The Nitro NG | Votre contenu mérite un public plus large',
  description: "Promotion pour créateurs et entreprises sur 28 plateformes. Paiement par carte, virement ou crypto, livraison rapide et assistance humaine sur WhatsApp.",
});

export default async function Page({ searchParams }) {
  return <HomeClient initialAuthQuery={resolveLandingAuthQuery(await searchParams)} />;
}
