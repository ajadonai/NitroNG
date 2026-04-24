import Dashboard from '@/components/dashboard';
import { GET as getDashboard } from '@/app/api/dashboard/route';

export const metadata = {
  title: { absolute: 'The Nitro NG' },
  description: 'Manage your orders, fund your wallet, and track your social media growth on Nitro.',
  robots: { index: false, follow: false },
};

export default async function DashboardPage() {
  let initialData = null;
  try {
    const res = await getDashboard();
    if (res.ok) initialData = await res.json();
  } catch {}
  return <Dashboard initialData={initialData} />;
}
