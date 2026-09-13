import FAQ from '@/components/faq';
import { FAQ_GROUPS } from '@/lib/faq-data';

export const revalidate = 300;

export const metadata = {
  title: 'FAQ | Frequently Asked Questions',
  description: 'Got questions about Nitro? Find answers about orders, payments, delivery times, refunds, and supported platforms.',
  alternates: { canonical: 'https://nitro.ng/faq' },
};

export default async function FAQPage() {

  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQ_GROUPS.flatMap(([, qs]) => qs.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } }))),
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />
      <FAQ />
    </>
  );
}
