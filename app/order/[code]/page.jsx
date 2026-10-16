import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { normalizeGuestCode } from '@/lib/guest-code';
import { guestCheckoutOpen, guestLookupLimit, guestOrderView } from '@/lib/guest-checkout';
import { rateLimit } from '@/lib/rate-limit';
import { getPublicSettings } from '@/lib/settings';
import { getCurrentUser } from '@/lib/auth';
import GuestOrderPage from '@/components/guest-order-page';
import { ORDER_PREVIEWS, previewOrder } from '@/lib/guest-order-previews';

export const dynamic = 'force-dynamic';

// noindex by meta tag, never robots.txt: that file is PROTECTED (CLAUDE.md).
// The tab is named by the code, which reads the same in every language.
export async function generateMetadata({ params }) {
  const { code } = await params;
  return { title: normalizeGuestCode(code) || 'Nitro', robots: { index: false, follow: false } };
}

/**
 * /order/CODE — a guest's order, opened by its guest code
 * (docs/v2/guest_checkout_brief.md). Where Flutterwave sends a visitor back
 * to, with ?verify=REF, and where the receipt and the track pop-up point.
 */
export default async function OrderPage({ params, searchParams }) {
  if (!await guestCheckoutOpen()) notFound();
  const [{ code: raw }, query, h] = await Promise.all([params, searchParams, headers()]);
  const code = normalizeGuestCode(raw);
  const settings = await getPublicSettings().catch(() => ({}));
  const supportWhatsApp = settings.social_whatsapp_support || '';

  const limit = await rateLimit({ headers: h }, guestLookupLimit(h));
  if (limit.limited) return <GuestOrderPage state="limited" supportWhatsApp={supportWhatsApp} />;
  // Local development only: any well-formed code with ?preview=delivering and
  // the rest shows that state on a real page, with no order behind it.
  const dev = process.env.NODE_ENV !== 'production';
  const preview = dev && code ? previewOrder(code, query?.preview) : null;
  const view = preview || (code ? await guestOrderView(code) : null);
  if (!view) return <GuestOrderPage state="missing" supportWhatsApp={supportWhatsApp} />;

  const verify = typeof query?.verify === 'string' ? query.verify : null;
  return (
    <>
      <GuestOrderPage initial={view} verify={!preview && !!verify} preview={!!preview} supportWhatsApp={supportWhatsApp} signedIn={!!(await getCurrentUser().catch(() => null))} />
      {dev && (
        <nav style={{ position: 'fixed', insetInline: 0, bottom: 0, zIndex: 99, display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'center', padding: '8px 12px calc(8px + env(safe-area-inset-bottom, 0px))', background: '#1a1917', font: '600 12px system-ui' }}>
          {['pay', ...Object.keys(ORDER_PREVIEWS)].map(k => <a key={k} href={`?preview=${k}`} style={{ color: '#fff', padding: '4px 8px', borderRadius: 6, background: (query?.preview || 'pay') === k ? '#c47d8e' : 'rgba(255,255,255,.12)', textDecoration: 'none' }}>{k}</a>)}
        </nav>
      )}
    </>
  );
}
