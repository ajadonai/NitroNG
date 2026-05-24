import { timingSafeEqual } from 'crypto';
import prisma from '@/lib/prisma';
import PulseDashboard from '@/components/pulse-dashboard';

async function isValidKey(key) {
  if (!key) return false;
  const row = await prisma.setting.findUnique({ where: { key: 'pulse_secret_key' } });
  if (!row?.value) return false;
  try {
    const a = Buffer.from(key);
    const b = Buffer.from(row.value);
    return a.length === b.length && timingSafeEqual(a, b);
  } catch { return false; }
}

export default async function PulsePage({ searchParams }) {
  const params = await searchParams;
  const key = params?.key;

  if (!(await isValidKey(key))) {
    return (
      <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#080b14', fontFamily: "'Plus Jakarta Sans',system-ui,sans-serif" }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 16, opacity: 0.3 }}>🔒</div>
          <h1 style={{ color: '#f5f3f0', fontSize: 24, fontWeight: 600, margin: '0 0 8px' }}>Access Denied</h1>
          <p style={{ color: '#8a8580', fontSize: 14 }}>Invalid or missing access key.</p>
        </div>
      </div>
    );
  }

  return <PulseDashboard secretKey={key} />;
}
