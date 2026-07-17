import { redirect } from 'next/navigation';
import PulseDashboard from '@/components/pulse-dashboard';
import { getCurrentAdmin } from '@/lib/auth';
import {
  canAccessInternalDashboard,
  requireInternalDashboardAccess,
} from '@/lib/internal-dashboard-access';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function AccessMessage({ unavailable = false }) {
  return (
    <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#080b14', fontFamily: "'Plus Jakarta Sans',system-ui,sans-serif" }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 48, marginBottom: 16, opacity: 0.3 }}>🔒</div>
        <h1 style={{ color: '#f5f3f0', fontSize: 24, fontWeight: 600, margin: '0 0 8px' }}>
          {unavailable ? 'Temporarily Unavailable' : 'Access Denied'}
        </h1>
        <p style={{ color: '#8a8580', fontSize: 14 }}>
          {unavailable ? 'Secure dashboard access could not be verified.' : 'Your admin account does not have access to Pulse.'}
        </p>
      </div>
    </div>
  );
}

export default async function PulsePage() {
  let access;
  try {
    access = await requireInternalDashboardAccess();
  } catch {
    return <AccessMessage unavailable />;
  }
  if (access.ok) return <PulseDashboard />;
  if (access.status === 503) return <AccessMessage unavailable />;
  if (access.status === 403) return <AccessMessage />;
  let adminSession;
  try {
    adminSession = await getCurrentAdmin({ clearInvalidCookie: false });
  } catch {
    return <AccessMessage unavailable />;
  }
  if (!adminSession) redirect('/admin/login?next=%2Fpulse');
  if (!canAccessInternalDashboard(adminSession._admin)) return <AccessMessage />;
  redirect('/api/internal-dashboard/access?next=%2Fpulse');
}
