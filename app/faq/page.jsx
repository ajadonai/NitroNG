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
    { "@type": "Question", name: "Isn't this just buying fake followers?", acceptedAnswer: { "@type": "Answer", text: "Social proof is a marketing tool. Every brand invests in visibility — billboards, sponsored posts, PR placements. Nitro accelerates the same organic signals that help real content get discovered. The engagement is a starting push, not a replacement for good content." }},
    { "@type": "Question", name: "Is this ethical?", acceptedAnswer: { "@type": "Answer", text: "We provide promotion services, the same way ad platforms do. We don't hack accounts, fake reviews, or misrepresent products. What you promote and how you represent it is your responsibility as a creator or business." }},
    { "@type": "Question", name: "Can I get in trouble with the platform?", acceptedAnswer: { "@type": "Answer", text: "We deliver engagement gradually to match natural growth patterns. That said, no provider anywhere can guarantee zero risk — platforms update their detection systems regularly. Start small, space out your orders, and keep posting quality content." }},
    { "@type": "Question", name: "How fast are results?", acceptedAnswer: { "@type": "Answer", text: "Orders are typically delivered within 0 to 6 hours. In some cases, delivery may take up to 24 hours depending on provider load. We are unable to act on delivery speed requests within the first 6 hours of order placement." }},
    { "@type": "Question", name: "What's the minimum to get started?", acceptedAnswer: { "@type": "Answer", text: "You can start with as little as ₦500. Flexible budgets, no minimums per campaign." }},
    { "@type": "Question", name: "How much do services cost?", acceptedAnswer: { "@type": "Answer", text: "Prices start as low as ₦20/1,000 for TikTok likes and ₦87/1,000 for Instagram followers. YouTube views start from ₦16/1,000, X followers from ₦109/1,000, and Facebook likes from ₦620/1,000. Every service has Budget, Standard, and Premium tiers. Budget is cheapest, Premium costs more but has higher quality and refill coverage. Check the pricing page for full details." }},
    { "@type": "Question", name: "What payment methods do you accept?", acceptedAnswer: { "@type": "Answer", text: "We accept bank transfers, debit/credit cards, and cryptocurrency. All payments are processed instantly so you can start ordering right away." }},
    { "@type": "Question", name: "What happens if my order doesn't deliver?", acceptedAnswer: { "@type": "Answer", text: "If an order fails or partially delivers, we'll either refund your wallet or automatically refill the difference at no extra cost. Our support team is available 24/7." }},
    { "@type": "Question", name: "Do you offer refills?", acceptedAnswer: { "@type": "Answer", text: "Yes. Many of our services include automatic refills. If you lose followers or engagement within the refill period (typically 30 days, depending on the service), we'll top them back up for free." }},
    { "@type": "Question", name: "Which platforms do you support?", acceptedAnswer: { "@type": "Answer", text: "We support Instagram, TikTok, YouTube, Twitter/X, Facebook, Telegram, Spotify, Snapchat, LinkedIn, Pinterest, Twitch, Discord, and more. 35+ platforms in total." }},
    { "@type": "Question", name: "Can I use Nitro for my clients?", acceptedAnswer: { "@type": "Answer", text: "Absolutely. Many digital marketers and agencies use Nitro to manage growth for multiple clients. Our API and bulk pricing make it easy to scale." }},
    { "@type": "Question", name: "How does the referral program work?", acceptedAnswer: { "@type": "Answer", text: "Share your unique referral code with friends. When they sign up and make their first deposit, both of you earn a bonus credited to your wallets." }},
    { "@type": "Question", name: "Is there an API?", acceptedAnswer: { "@type": "Answer", text: "Yes. Once you create an account, you can generate an API key from your settings page and integrate Nitro into your own tools or workflows." }},
    { "@type": "Question", name: "Can I get a cash refund to my bank account?", acceptedAnswer: { "@type": "Answer", text: "Refunds are credited to your Nitro wallet balance, not directly to your bank account or card. This lets us process refunds instantly, no waiting days for bank reversals. Your wallet balance can be used for any future order." }},
    { "@type": "Question", name: "Are the followers and engagement from real people?", acceptedAnswer: { "@type": "Answer", text: "Yes — we deliver engagement from real, active accounts. They're there to boost your social proof and visibility. To keep the momentum going, pair our services with consistent, quality content so the algorithm keeps pushing your posts to new audiences." }},
    { "@type": "Question", name: "How can I get the most out of Nitro?", acceptedAnswer: { "@type": "Answer", text: "Start with followers to build your base, then use likes and views on each new post to boost it in the algorithm. Post 3–4 times a week, use trending sounds and hashtags, engage with others in your niche, and post when your audience is most active. The combination of our services and your content strategy is what drives real, lasting growth." }},
    { "@type": "Question", name: "How do I contact support?", acceptedAnswer: { "@type": "Answer", text: "You can reach us anytime on WhatsApp. We typically respond within minutes." }},
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
