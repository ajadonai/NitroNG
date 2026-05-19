import prisma from '@/lib/prisma';

const DAY_MAP = { 0: 'SUNDAY', 1: 'MONDAY', 2: 'TUESDAY', 3: 'WEDNESDAY', 4: 'THURSDAY', 5: 'FRIDAY', 6: 'SATURDAY' };

export async function getActivePromotion() {
  const now = new Date();

  const [seasonal, recurring] = await Promise.all([
    prisma.platformCampaign.findMany({
      where: { status: 'ACTIVE', startAt: { lte: now }, endAt: { gte: now } },
      orderBy: { priority: 'desc' },
      take: 1,
    }),
    prisma.recurringCampaign.findMany({
      where: { active: true },
    }),
  ]);

  const best = seasonal[0] || null;

  let bestRecurring = null;
  if (recurring.length > 0) {
    const nowLocal = new Date(now.toLocaleString('en-US', { timeZone: 'Africa/Lagos' }));
    const dayName = DAY_MAP[nowLocal.getDay()];
    const hhmm = `${String(nowLocal.getHours()).padStart(2, '0')}:${String(nowLocal.getMinutes()).padStart(2, '0')}`;

    for (const rc of recurring) {
      if (rc.dayOfWeek !== dayName) continue;
      if (hhmm < rc.startTimeLocal || hhmm > rc.endTimeLocal) continue;
      if (rc.effectiveFrom && now < rc.effectiveFrom) continue;
      if (rc.effectiveUntil && now > rc.effectiveUntil) continue;
      if (!bestRecurring || rc.priority > bestRecurring.priority) bestRecurring = rc;
    }
  }

  // Seasonal beats recurring
  if (best) return { type: 'platform', promotion: best };
  if (bestRecurring) return { type: 'recurring', promotion: bestRecurring };
  return null;
}

export function applyPromotionDiscount(charge, promotion, maxDiscountPerOrder) {
  let discount = Math.round(charge * (promotion.discountPercent / 100));
  if (maxDiscountPerOrder && discount > maxDiscountPerOrder) {
    discount = maxDiscountPerOrder;
  }
  return Math.max(0, discount);
}
