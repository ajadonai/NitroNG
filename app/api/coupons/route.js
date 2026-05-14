import prisma from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';
import { rateLimit, tooManyRequests } from '@/lib/rate-limit';

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

// POST: validate a coupon code
export async function POST(req) {
  try {
    const { limited } = await rateLimit(req, { maxAttempts: 10, windowMs: 60 * 1000 });
    if (limited) return tooManyRequests('Too many attempts. Try again in a minute.');

    const session = await getCurrentUser();
    if (!session) return Response.json({ error: 'Not authenticated' }, { status: 401 });

    const body = await req.json();
    const code = typeof body.code === 'string' ? body.code.slice(0, 50) : '';
    const amount = Number(body.amount) || 0;
    if (!code) return Response.json({ error: 'Code required' }, { status: 400 });

    const coupons = await getCoupons();
    const coupon = coupons.find(c => c.code === code.toUpperCase().trim() && c.enabled !== false);

    if (!coupon) {
      return Response.json({ error: 'Invalid or expired coupon code' }, { status: 400 });
    }

    // Check expiry
    if (coupon.expires && new Date(coupon.expires) < new Date()) {
      return Response.json({ error: 'This coupon has expired' }, { status: 400 });
    }

    // Check max uses
    if (coupon.maxUses && coupon.maxUses > 0 && (coupon.used || 0) >= coupon.maxUses) {
      return Response.json({ error: 'This coupon has reached its usage limit' }, { status: 400 });
    }

    // Check minimum deposit
    const depositAmount = Number.isFinite(amount) ? amount : 0;
    if (coupon.minOrder && depositAmount > 0 && depositAmount < coupon.minOrder * 100) {
      return Response.json({ error: `Minimum deposit of ₦${coupon.minOrder.toLocaleString()} required` }, { status: 400 });
    }

    // Cap bonus calculation at maxDeposit
    const bonusBase = coupon.maxDeposit && depositAmount > coupon.maxDeposit * 100
      ? coupon.maxDeposit * 100
      : depositAmount;

    // Check new users only
    if (coupon.newUsersOnly) {
      const pastDeposit = await prisma.transaction.findFirst({
        where: { userId: session.id, type: 'deposit', status: 'Completed' },
      });
      if (pastDeposit) {
        return Response.json({ error: 'This coupon is for new users only' }, { status: 400 });
      }
    }

    // Calculate discount (capped at maxDeposit if set)
    let discount = 0;
    if (coupon.type === 'percent') {
      discount = Math.round(bonusBase * (coupon.value / 100));
    } else {
      discount = coupon.value * 100;
    }

    return Response.json({
      valid: true,
      code: coupon.code,
      type: coupon.type,
      value: coupon.value,
      discount,
      couponId: coupon.id,
    });
  } catch (err) {
    return Response.json({ error: 'Validation failed' }, { status: 500 });
  }
}
