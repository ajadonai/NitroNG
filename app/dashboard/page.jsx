import Dashboard from '@/components/dashboard';
import { GET as getDashboard } from '@/app/api/dashboard/route';
import { GET as getRewards } from '@/app/api/rewards/route';

export const metadata = {
  title: { absolute: 'The Nitro NG' },
  description: 'Manage your orders, fund your wallet, and track your social media growth on Nitro.',
  robots: { index: false, follow: false },
};

export default async function DashboardPage() {
  let initialData = null;
  try {
    const [dashboardResult, rewardsResult] = await Promise.allSettled([
      getDashboard(),
      getRewards(),
    ]);
    if (dashboardResult.status === 'fulfilled' && dashboardResult.value.ok) {
      initialData = await dashboardResult.value.json();
      if (rewardsResult.status === 'fulfilled' && rewardsResult.value.ok) {
        initialData.rewards = await rewardsResult.value.json();
      }
    }
  } catch {}
  return <Dashboard initialData={initialData} />;
}
