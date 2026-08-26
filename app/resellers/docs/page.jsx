import ResellerApiDocsView from '@/components/reseller-api-docs';

export const metadata = {
  title: 'Reseller API Documentation | Nitro NG',
  description: 'POST https://nitro.ng/api/v2 in the standard SMM-panel format: services, add, status, refill, balance, cancel. Your key is in Settings once your account is approved.',
  robots: { index: true, follow: true },
  alternates: { canonical: 'https://nitro.ng/resellers/docs' },
};

export default function ResellerDocsPage() {
  return <ResellerApiDocsView />;
}
