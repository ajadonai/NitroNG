import prisma from '@/lib/prisma';
import QualityView from '@/components/quality-page';

export const revalidate = 300;

export const metadata = {
  title: 'Low Drop Rate SMM Panel | Tested Services',
  description: 'We test every service before listing it, so drop rates stay low. Refill covered tiers, honest delivery rates, Naira pricing.',
  alternates: { canonical: 'https://nitro.ng/quality' },
  openGraph: {
    title: 'Low Drop Rate SMM Panel | Nitro',
    description: 'Every service tested. Low drop rates. Automatic refill. The SMM panel Nigerian creators trust for quality that sticks.',
    url: 'https://nitro.ng/quality',
    type: 'website',
  },
};

export default async function QualityPage() {
  let serviceCount = 0, platformCount = 0;
  try {
    const [groups, platforms] = await Promise.all([
      prisma.serviceGroup.count({ where: { enabled: true, tiers: { some: { enabled: true } } } }),
      prisma.serviceGroup.findMany({ where: { enabled: true, tiers: { some: { enabled: true } } }, select: { platform: true }, distinct: ['platform'] }),
    ]);
    serviceCount = groups;
    platformCount = platforms.length;
  } catch {}

  const breadcrumb = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://nitro.ng' },
      { '@type': 'ListItem', position: 2, name: 'Service Quality' },
    ],
  };

  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
      { '@type': 'Question', name: 'What is a "drop" in SMM?', acceptedAnswer: { '@type': 'Answer', text: 'A drop is when followers, likes, or views you received through a promotion service disappear after some time. This usually happens because the accounts providing the engagement get flagged or removed by the platform.' }},
      { '@type': 'Question', name: 'Can any panel guarantee zero drops?', acceptedAnswer: { '@type': 'Answer', text: 'No — anyone who claims 0% drop rate is not being honest. Social platforms constantly remove suspicious accounts. The difference is how a panel handles it: low drop rates from careful curation, plus automatic refill when drops do happen.' }},
      { '@type': 'Question', name: 'How is Nitro different from other SMM panels?', acceptedAnswer: { '@type': 'Answer', text: 'Most panels list every service their providers offer without testing. Nitro curates — we test services internally, monitor delivery quality, and remove underperforming providers. You only see services that have passed our quality checks.' }},
      { '@type': 'Question', name: 'Do I need to track my own drop rates?', acceptedAnswer: { '@type': 'Answer', text: 'No. If you use a Standard or Premium tier service, refills happen automatically when we detect drops. You don\'t need to open a ticket or contact support — the system handles it.' }},
      { '@type': 'Question', name: 'What platforms does Nitro support?', acceptedAnswer: { '@type': 'Answer', text: `Instagram, TikTok, YouTube, X (Twitter), Facebook, Telegram, Spotify, Snapchat, LinkedIn, Twitch, Discord, and more — ${serviceCount || '35'}+ service categories across ${platformCount || '10'}+ platforms.` }},
    ],
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumb) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />
      <QualityView serviceCount={serviceCount} platformCount={platformCount} />
    </>
  );
}
