import AdminDashboard from '@/components/admin-dashboard';
import { GET as getOverview } from '@/app/api/admin/overview/route';

export const metadata = {
  title: 'Admin',
};

export default async function AdminPage() {
  let initialData = null;
  try {
    const res = await getOverview();
    if (res.ok) initialData = await res.json();
  } catch {}
  return <AdminDashboard initialData={initialData} />;
}
