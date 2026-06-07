import FAQ from '@/components/faq';

export const metadata = {
  title: 'FAQ | Frequently Asked Questions',
  description: 'Got questions about Nitro? Find answers about orders, payments, delivery times, refunds, and supported platforms.',
  alternates: { canonical: 'https://nitro.ng/faq' },
};

const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    { "@type": "Question", name: "What is Nitro?", acceptedAnswer: { "@type": "Answer", text: "Nitro is a digital marketing platform built for Nigerian creators, businesses, and agencies. We help you promote your content and reach wider audiences across 35+ social media platforms. Everything is in Naira." }},
    { "@type": "Question", name: "Why choose Nitro?", acceptedAnswer: { "@type": "Answer", text: "Nitro was built specifically for the Nigerian market. Our dashboard is designed for speed and clarity — manage your campaigns from one clean interface. Naira pricing with no USD conversion, 3 quality tiers, and 24/7 support." }},
    { "@type": "Question", name: "Is Nitro safe to use?", acceptedAnswer: { "@type": "Answer", text: "Yes. We use secure payment gateways and industry-standard practices. Your social media accounts are never at risk. We only need your public profile link, never your password." }},
    { "@type": "Question", name: "How does it work?", acceptedAnswer: { "@type": "Answer", text: "Sign up, fund your wallet, choose a promotion service, and enter your profile or post link. Results start appearing within minutes. Track everything from your dashboard." }},
    { "@type": "Question", name: "Is my account safe?", acceptedAnswer: { "@type": "Answer", text: "Absolutely. We never ask for your password or log into your account. All we need is your public profile or post link." }},
    { "@type": "Question", name: "How fast are results?", acceptedAnswer: { "@type": "Answer", text: "Most campaigns start within seconds. Depending on the service, full results typically appear within minutes to a few hours." }},
    { "@type": "Question", name: "What's the minimum to get started?", acceptedAnswer: { "@type": "Answer", text: "You can start with as little as ₦500. Flexible budgets, no minimums per campaign." }},
    { "@type": "Question", name: "How much do services cost?", acceptedAnswer: { "@type": "Answer", text: "Prices start as low as ₦20/1,000 for TikTok likes and ₦87/1,000 for Instagram followers. YouTube views start from ₦16/1,000, X followers from ₦109/1,000, and Facebook likes from ₦620/1,000. Every service has Budget, Standard, and Premium tiers. Budget is cheapest, Premium costs more but has higher quality and refill guarantees. Check the pricing page for full details." }},
    { "@type": "Question", name: "What payment methods do you accept?", acceptedAnswer: { "@type": "Answer", text: "We accept bank transfers, debit/credit cards, and cryptocurrency. All payments are processed instantly so you can start ordering right away." }},
    { "@type": "Question", name: "What happens if my order doesn't deliver?", acceptedAnswer: { "@type": "Answer", text: "If an order fails or partially delivers, we'll either refund your wallet or automatically refill the difference at no extra cost. Our support team is available 24/7." }},
    { "@type": "Question", name: "Do you offer refills?", acceptedAnswer: { "@type": "Answer", text: "Yes. Many of our services include automatic refills. If you lose followers or engagement within the refill period (typically 30 days, depending on the service), we'll top them back up for free." }},
    { "@type": "Question", name: "Which platforms do you support?", acceptedAnswer: { "@type": "Answer", text: "We support Instagram, TikTok, YouTube, Twitter/X, Facebook, Telegram, Spotify, Snapchat, LinkedIn, Pinterest, Twitch, Discord, and more. 35+ platforms in total." }},
    { "@type": "Question", name: "Can I use Nitro for my clients?", acceptedAnswer: { "@type": "Answer", text: "Absolutely. Many digital marketers and agencies use Nitro to manage growth for multiple clients. Our API and bulk pricing make it easy to scale." }},
    { "@type": "Question", name: "How does the referral program work?", acceptedAnswer: { "@type": "Answer", text: "Share your unique referral code with friends. When they sign up and make their first deposit, both of you earn a bonus credited to your wallets." }},
    { "@type": "Question", name: "Is there an API?", acceptedAnswer: { "@type": "Answer", text: "Yes. Once you create an account, you can generate an API key from your settings page and integrate Nitro into your own tools or workflows." }},
    { "@type": "Question", name: "Can I get a cash refund to my bank account?", acceptedAnswer: { "@type": "Answer", text: "Refunds are credited to your Nitro wallet balance, not directly to your bank account or card. This lets us process refunds instantly, no waiting days for bank reversals. Your wallet balance can be used for any future order." }},
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
