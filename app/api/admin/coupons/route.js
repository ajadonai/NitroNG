import prisma from '@/lib/prisma';
import { log } from "@/lib/logger";
import { requireAdmin, logActivity } from '@/lib/admin';

// Coupons are stored in the Setting table as JSON under key 'coupons'
// This is a simple approach until we add a dedicated Coupon model

async function getCoupons() {
  try {
    const row = await prisma.setting.findUnique({ where: { key: 'coupons' } });
    return row ? JSON.parse(row.value) : [];
  } catch { return []; }
}

async function saveCoupons(coupons) {
  await prisma.setting.upsert({
    where: { key: 'coupons' },
    update: { value: JSON.stringify(coupons) },
    create: { key: 'coupons', value: JSON.stringify(coupons) },
  });
}

export async function GET() {
  const { admin, error } = await requireAdmin('coupons');
  if (error) return error;

  try {
    const coupons = await getCoupons();
    return Response.json({ coupons });
  } catch (err) {
    log.error('Admin Coupons', err.message);
    return Response.json({ error: 'Failed to load coupons' }, { status: 500 });
  }
}

export async function POST(req) {
  const { admin, error } = await requireAdmin('coupons', true);
  if (error) return error;

  try {
    const body = await req.json();
    const { action } = body;
    let coupons = await getCoupons();

    if (action === 'create') {
      const { code, type, value, minOrder, maxUses, expires } = body;
      if (!code?.trim()) return Response.json({ error: 'Code required' }, { status: 400 });
      const numValue = Number(value) || 0;
      if (numValue <= 0) return Response.json({ error: 'Value must be greater than 0' }, { status: 400 });
      if (type === 'percent' && numValue > 100) return Response.json({ error: 'Percent bonus cannot exceed 100%' }, { status: 400 });
      if (coupons.find(c => c.code === code.toUpperCase())) {
        return Response.json({ error: 'Code already exists' }, { status: 400 });
      }
      coupons.push({
        id: Date.now().toString(),
        code: code.toUpperCase().trim(),
        type: type || 'percent',
        value: numValue,
        minOrder: Number(minOrder) || 0,
        maxUses: Number(maxUses) || 100,
        used: 0,
        expires: expires || null,
        enabled: true,
        created: new Date().toISOString(),
      });
      await saveCoupons(coupons);
      await logActivity(admin.name, `Created coupon ${code.toUpperCase()}`, 'coupon');
      return Response.json({ success: true });
    }

    if (action === 'toggle') {
      const { id } = body;
      coupons = coupons.map(c => c.id === id ? { ...c, enabled: !c.enabled } : c);
      await saveCoupons(coupons);
      return Response.json({ success: true });
    }

    if (action === 'delete') {
      const { id } = body;
      const coupon = coupons.find(c => c.id === id);
      coupons = coupons.filter(c => c.id !== id);
      await saveCoupons(coupons);
      if (coupon) await logActivity(admin.name, `Deleted coupon ${coupon.code}`, 'coupon');
      return Response.json({ success: true });
    }

    if (action === 'update') {
      const { id, ...data } = body;
      coupons = coupons.map(c => c.id === id ? { ...c, ...data, action: undefined } : c);
      await saveCoupons(coupons);
      await logActivity(admin.name, `Updated coupon`, 'coupon');
      return Response.json({ success: true });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (err) {
    log.error('Admin Coupons POST', err.message);
    return Response.json({ error: 'Action failed' }, { status: 500 });
  }
}
