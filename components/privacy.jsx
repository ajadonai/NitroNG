'use client';
import { ThemeProvider } from './shared-nav';
import { LegalLayout } from './legal-layout';
import { SITE } from "../lib/site";

export default function Privacy(){
  return <ThemeProvider><PrivacyInner/></ThemeProvider>;
}

function PrivacyInner(){
  const sections=[
    ["Who we are",`Nitro is operated by The Nitro Nigeria Limited (RC 9514845), a private company registered in Nigeria with registered address at 1111 Block A, Emcel Gardens, Orchid Road, Lagos, Lagos State, Nigeria. The Nitro Nigeria Limited is the data controller for personal data processed on this Platform. Contact for privacy matters: ${SITE.email.general}.`],
    ["Information we collect","When you use Nitro, we collect information you provide directly, such as your name, email address, phone number, and payment details during registration and transactions. We also automatically collect technical data including your IP address, browser type, device information, operating system, referring URLs, pages viewed, time spent on pages, click patterns, and interaction data. Additionally, we collect transaction data including order history, wallet activity, payment records, and service usage metrics."],
    ["How we use your information","We use the information we collect to provide, operate, and maintain our services, process your transactions and deliver ordered services, communicate with you about your account, orders, and support requests, improve and personalize your experience on the Platform, conduct research, analytics, and data analysis to enhance our services, detect, prevent, and address fraud, abuse, and security issues, comply with legal obligations and enforce our terms, and send you updates and relevant communications about our services."],
    ["Data sharing and disclosure","We may share your information with third-party payment processors (Flutterwave, NOWPayments, Monnify, Korapay) to facilitate transactions, with API service providers to fulfill your orders (only the minimum data required, such as target URLs), with analytics and infrastructure providers that help us operate the Platform, and with law enforcement or regulatory authorities when required by law. We do not sell your personal contact information to third-party advertisers. We may share aggregated, anonymized data with partners for commercial purposes."],
    ["Cookies and tracking","We use cookies and similar technologies to keep you logged in and maintain your session, remember your preferences such as theme settings, analyze usage patterns and improve the Platform, and ensure security and prevent fraud. Non-essential cookies and tracking technologies (such as advertising pixels) are used only with your consent, which you can give or withdraw via the cookie banner or your browser settings. Disabling certain cookies may affect Platform functionality."],
    ["Data retention","We retain your personal data for as long as your account is active or as needed to provide services. Transaction records and order history are retained for a minimum of 5 years for legal and accounting purposes. After account deletion, we may retain anonymized and aggregated data indefinitely for analytics. Backup copies may persist in our systems for a reasonable period after deletion."],
    ["Data security","We implement industry-standard security measures including encryption of data in transit and at rest, secure payment processing through certified payment gateways, regular security audits and monitoring, and access controls limiting employee access to personal data. While we strive to protect your information, no method of electronic transmission or storage is 100% secure. In the event of a personal data breach likely to pose a high risk to your rights, we will notify the NDPC within 72 hours and inform affected users as required by the NDPA."],
    ["Your rights",`Under the Nigeria Data Protection Act 2023 (NDPA) you have the right to access the personal data we hold about you, correct inaccurate data, request deletion (subject to legal retention requirements), withdraw consent at any time, object to certain processing, and receive a copy of your data in a portable format. To exercise these rights, contact us at ${SITE.email.general}; we respond within 30 days. You also have the right to lodge a complaint with the Nigeria Data Protection Commission (ndpc.gov.ng).`],
    ["Legal basis and governing law","We process your personal data in line with the Nigeria Data Protection Act 2023 (NDPA) and directives of the Nigeria Data Protection Commission (NDPC). Our legal bases are: performance of our contract with you (accounts, orders, wallet, support), legal obligation (transaction records, fraud prevention), your consent (marketing communications, non-essential cookies), and legitimate interests (platform security and improvement). This policy is governed by the laws of the Federal Republic of Nigeria."],
    ["Children's privacy","Nitro is not intended for users under 18 years of age. We do not knowingly collect personal information from minors. If we learn that we have collected data from a user under 18, we will delete that information promptly."],
    ["International data","Your data may be processed and stored in Nigeria and other countries where our service providers operate. By using the Platform, you consent to the transfer of your information to these locations."],
    ["Third-party links","The Platform may contain links to third-party websites and social media platforms. We are not responsible for the privacy practices or content of these external sites."],
    ["Changes to this policy","We may update this Privacy Policy from time to time. Material changes will be communicated through the Platform or via email. Continued use of the Platform after changes constitutes acceptance of the updated policy."],
    ["Contact us",`For privacy-related questions or requests, contact us at ${SITE.email.general}`],
  ];
  const summary=[
    "We keep what running your account needs: name, email, orders, payments.",
    "We never ask for or store a social media password.",
    "Ask us and we delete your account and its data.",
  ];
  const related=[
    {title:"Terms of service",desc:"The rules of the service",href:"/terms"},
    {title:"Refund policy",desc:"When money comes back",href:"/refund"},
    {title:"Cookie policy",desc:"What the site remembers",href:"/cookie"},
  ];
  return <LegalLayout label="Legal" title="Privacy policy" date="July 5, 2026" summary={summary} sections={sections} related={related}/>;
}
