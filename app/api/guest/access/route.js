import { guestCheckoutLive, signedInAdmin } from '@/lib/guest-checkout';

export const dynamic = 'force-dynamic';

/**
 * GET /api/guest/access — whether this visitor may see guest checkout before it
 * is switched on for everyone: yes for a signed-in admin, so staff can test it
 * on the live site. The landing page asks only while the setting is off. The
 * admin check comes first because it costs nothing without an admin cookie.
 */
export async function GET() {
  const staff = await signedInAdmin();
  const open = staff || process.env.NODE_ENV !== 'production' || await guestCheckoutLive();
  return Response.json({ open, staff }, { headers: { 'Cache-Control': 'no-store' } });
}
