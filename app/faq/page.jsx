import FAQ from '@/components/faq';

export const metadata = {
  title: 'FAQ — Frequently Asked Questions',
  description: 'Got questions about Nitro? Find answers about orders, payments, delivery times, refunds, and supported platforms.',
  alternates: { canonical: 'https://nitro.ng/faq' },
};

const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    { "@type": "Question", name: "What is Nitro?", acceptedAnswer: { "@type": "Answer", text: "Nitro is Nigeria's fastest SMM panel. We help creators, businesses, and marketers grow their social media presence with real followers, likes, views, and engagement across all major platforms." }},
    { "@type": "Question", name: "Is Nitro safe to use?", acceptedAnswer: { "@type": "Answer", text: "Yes. We use secure payment gateways and deliver engagement from real accounts. Your social media accounts are never at risk — we only need your public profile link, never your password." }},
    { "@type": "Question", name: "How fast is delivery?", acceptedAnswer: { "@type": "Answer", text: "Most orders start processing within seconds of payment. Depending on the service, full delivery typically completes within minutes to a few hours." }},
    { "@type": "Question", name: "What's the minimum deposit?", acceptedAnswer: { "@type": "Answer", text: "You can start with as little as ₦500. There's no minimum per order — once your wallet is funded, you can place orders of any size." }},
    { "@type": "Question", name: "What payment methods do you accept?", acceptedAnswer: { "@type": "Answer", text: "We accept bank transfers, debit/credit cards, and cryptocurrency. All payments are processed instantly so you can start ordering right away." }},
    { "@type": "Question", name: "What happens if my order doesn't deliver?", acceptedAnswer: { "@type": "Answer", text: "If an order fails or partially delivers, we'll either refund your wallet or automatically refill the difference at no extra cost. Our support team is available 24/7." }},
    { "@type": "Question", name: "Do you offer refills?", acceptedAnswer: { "@type": "Answer", text: "Yes. Many of our services include automatic refills. If you lose followers or engagement within the refill period, we'll top them back up for free." }},
    { "@type": "Question", name: "Which platforms do you support?", acceptedAnswer: { "@type": "Answer", text: "We support Instagram, TikTok, YouTube, Twitter/X, Facebook, Telegram, Spotify, Snapchat, LinkedIn, Pinterest, Twitch, Discord, and more — 35+ platforms in total." }},
    { "@type": "Question", name: "Can I use Nitro for my clients?", acceptedAnswer: { "@type": "Answer", text: "Absolutely. Many digital marketers and agencies use Nitro to manage growth for multiple clients. Our API and bulk pricing make it easy to scale." }},
    { "@type": "Question", name: "How does the referral program work?", acceptedAnswer: { "@type": "Answer", text: "Share your unique referral code with friends. When they sign up and make their first deposit, both of you earn a bonus credited to your wallets." }},
    { "@type": "Question", name: "Is there an API?", acceptedAnswer: { "@type": "Answer", text: "Yes. Once you create an account, you can generate an API key from your settings page and integrate Nitro into your own tools or workflows." }},
    { "@type": "Question", name: "How do I contact support?", acceptedAnswer: { "@type": "Answer", text: "You can reach us 24/7 via the in-app support chat or WhatsApp. We typically respond within minutes." }},
  ],
};

export default function FAQPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />
      <FAQ />
    </>
  );
}
