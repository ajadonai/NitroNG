import Dashboard from '@/components/dashboard';

export const metadata = {
  title: 'Dashboard',
  description: 'Manage your orders, fund your wallet, and track your social media growth on Nitro.',
  robots: { index: false, follow: false },
};

export default function DashboardPage() {
  return <Dashboard />;
}
