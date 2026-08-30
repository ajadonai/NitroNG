'use client';
import { ThemeProvider } from './shared-nav';
import { LegalLayout } from './legal-layout';
import { SITE } from "../lib/site";

export default function Terms(){
  return <ThemeProvider><TermsInner/></ThemeProvider>;
}

function TermsInner(){
  const sections=[
    ["Acceptance of terms","By creating an account on Nitro (\"the Platform\"), you agree to be bound by these Terms of Service. If you do not agree to these terms, you may not use our services. We reserve the right to update these terms at any time, and continued use of the Platform constitutes acceptance of any modifications."],
    ["Description of services","Nitro is a social media marketing (SMM) platform that provides digital marketing services including but not limited to social media engagement, followers, views, likes, and related promotional services across various platforms. We act as an intermediary between you and third-party service providers. We do not guarantee specific outcomes, and delivery times are estimates only."],
    ["Account registration","You must provide accurate and complete information when creating an account. You are responsible for maintaining the confidentiality of your login credentials and for all activity under your account. You must be at least 18 years of age to use this Platform. We reserve the right to suspend or terminate accounts that violate these terms, provide false information, or engage in fraudulent activity."],
    ["Payments, wallet and refunds","All payments are processed in Nigerian Naira (₦) through our supported payment gateways. Money you add to your wallet is used to pay for orders on Nitro. If you have not spent it, you can ask us to refund your unused wallet balance, and we can return it to your bank or leave it in your wallet, whichever you prefer. When an order is undelivered or cancelled, the refund is credited to your Nitro wallet, not to your original payment method, unless otherwise required by law. We reserve the right to modify service pricing at any time without prior notice."],
    ["Service delivery and guarantees","Delivery times are estimates and may vary based on demand, provider availability, and platform conditions. Services marked with \"refill\" include automatic replenishment within the stated period if engagement drops. We do not guarantee that services will not be removed by the target social media platform. We are not responsible for account suspensions, bans, or penalties imposed by third-party social media platforms as a result of using our services."],
    ["Data collection and usage","By using Nitro, you acknowledge and consent to our collection and use of data generated through your interaction with the Platform. This includes account information, transaction history, order data, usage patterns, device information, and communication records. We use this data to operate and improve our services, personalize your experience, process transactions, and for internal business purposes including research, analytics, and service optimization."],
    ["Prohibited uses","You agree not to use the Platform for any illegal activity or to violate any applicable law, to distribute malware, spam, or harmful content, to attempt to gain unauthorized access to our systems, to resell our services without authorization, to abuse our referral program through fraudulent means, or to engage in any activity that could damage the Platform's reputation or operations."],
    ["Intellectual property","All content, branding, design, and technology on Nitro is the property of Nitro and is protected by applicable intellectual property laws. You may not copy, reproduce, or distribute any part of the Platform without our express written consent."],
    ["Limitation of liability","Nitro is provided \"as is\" without warranties of any kind. We shall not be liable for any indirect, incidental, special, or consequential damages arising from your use of the Platform. Our total liability for any claim shall not exceed the amount you paid to us in the 30 days preceding the claim."],
    ["Termination","We may suspend or terminate your account at our sole discretion, with or without cause, and with or without notice. Upon termination, your right to use the Platform ceases immediately. Wallet balances on terminated accounts due to terms violations are forfeited."],
    ["Governing law","These Terms shall be governed by and construed in accordance with the laws of the Federal Republic of Nigeria. Any disputes shall be resolved through the courts of Lagos State, Nigeria."],
    ["Company identity","The Platform is operated by The Nitro Nigeria Limited (RC 9514845), a private company registered in Lagos, Nigeria."],
    ["Contact",`For questions about these Terms, contact us at ${SITE.email.general}`],
  ];
  const summary=[
    "You must be 18 and give real details.",
    "Unspent wallet money can go back to your bank on request; order refunds go to your wallet.",
    "We deliver through providers, so times are estimates.",
  ];
  const related=[
    {title:"Privacy policy",desc:"What we keep and why",href:"/privacy"},
    {title:"Refund policy",desc:"When money comes back",href:"/refund"},
    {title:"Cookie policy",desc:"What the site remembers",href:"/cookie"},
  ];
  return <LegalLayout label="Legal" title="Terms of service" date="August 29, 2026" summary={summary} sections={sections} related={related} action="back"/>;
}
