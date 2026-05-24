import { getActivePromotion } from '@/lib/promotions';
import { getCurrentUser } from '@/lib/auth';

export async function GET() {
  try {
    const session = await getCurrentUser();
    if (!session) return Response.json({ error: 'Not authenticated' }, { status: 401 });

    const result = await getActivePromotion();
    if (!result) return Response.json({ active: false });

    const { promotion } = result;
    return Response.json({
      active: true,
      discountPercent: promotion.discountPercent,
      bannerCopy: promotion.bannerCopy,
      bannerColor: promotion.bannerColor,
      lineItemLabel: promotion.lineItemLabel,
      maxDiscountPerOrder: promotion.maxDiscountPerOrder,
    });
  } catch {
    return Response.json({ active: false });
  }
}
