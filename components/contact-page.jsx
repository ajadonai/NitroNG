'use client';
import { useState, useEffect } from 'react';
import { ThemeProvider, useTheme } from './shared-nav';
import SharedNav, { SharedFooter, SharedStyles } from './shared-nav';
import { ProductScreenshot } from './product-screenshot';

export default function ContactView() {
  return <ThemeProvider><ContactInner /></ThemeProvider>;
}

function ContactInner() {
  const { dark, t } = useTheme();
  const accent = "#c47d8e";
  const border = dark ? "rgba(255,255,255,.12)" : "rgba(0,0,0,.08)";
  const cardBg = dark ? "rgba(255,255,255,.05)" : "#fff";

  const [waLink, setWaLink] = useState(null);
  useEffect(() => {
    fetch('/api/settings').then(r => r.json()).then(d => {
      const num = d?.social_whatsapp_support;
      if (num) setWaLink(`https://wa.me/${num.replace(/\D/g, '')}`);
    }).catch(() => {});
  }, []);

  return (
    <>
      <SharedStyles />
      <div className="min-h-dvh flex flex-col font-[Plus Jakarta Sans,system-ui,sans-serif]" style={{ background: t.bg }}>
        <SharedNav />

        <div className="text-center pt-14 pb-10 max-md:pt-10 max-md:pb-8 px-6">
          <span className="text-xs font-semibold tracking-[2px] uppercase block mb-3" style={{ color: accent }}>Contact</span>
          <h1 className="text-[clamp(26px,5vw,40px)] font-semibold mb-4 leading-tight" style={{ color: t.text }}>
            Contact us
          </h1>
          <p className="text-[15px] leading-relaxed max-w-[480px] mx-auto" style={{ color: t.textSoft }}>
            The fastest way to reach us is WhatsApp. It is not a bot and it is not a ticket queue. You message a real line and a person answers.
          </p>
        </div>

        <main className="flex-1 px-6 pb-20 max-w-[700px] mx-auto w-full">

          {/* Order failure diagram */}
          <div className="mb-10 max-w-[480px] mx-auto">
            <ProductScreenshot src="/images/nitro-order-refund-wallet-credit-nigeria.webp" alt="What happens when a Nitro order does not deliver, with value returned to your wallet as credit" dark={dark} />
          </div>

          {/* Primary contact */}
          {waLink && (
            <div className="rounded-2xl p-8 max-md:p-6 mb-8 text-center" style={{ background: dark ? "rgba(37,211,102,.06)" : "rgba(37,211,102,.04)", border: `1px solid ${dark ? "rgba(37,211,102,.18)" : "rgba(37,211,102,.12)"}` }}>
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ background: dark ? "rgba(37,211,102,.12)" : "rgba(37,211,102,.08)" }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="#25d366"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
              </div>
              <h2 className="text-xl font-semibold mb-2" style={{ color: t.text }}>WhatsApp (fastest)</h2>
              <p className="text-[13px] mb-5 max-w-[400px] mx-auto" style={{ color: t.textSoft }}>Our main support channel. Typical reply time is minutes during Lagos working hours, longer late at night and on Sundays. Send your order ID if your question is about a specific order.</p>
              <a href={waLink} className="inline-flex items-center gap-2 py-3 px-7 rounded-xl text-white text-[13px] font-semibold no-underline transition-[transform,box-shadow] duration-200 hover:-translate-y-px" style={{ background: "#25d366" }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                Message us on WhatsApp
              </a>
            </div>
          )}

          {/* Other channels */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-10">
            <div className="rounded-xl p-5" style={{ background: cardBg, border: `1px solid ${border}` }}>
              <div className="text-[13px] font-semibold tracking-[1px] uppercase mb-2" style={{ color: accent }}>Email</div>
              <a href="mailto:support@nitro.ng" className="text-[15px] font-medium no-underline" style={{ color: t.text }}>support@nitro.ng</a>
              <p className="text-[11px] mt-1" style={{ color: t.textMuted }}>Better for anything that needs attachments, invoices or a written record. Replies usually take a few hours rather than minutes.</p>
            </div>
            <div className="rounded-xl p-5" style={{ background: cardBg, border: `1px solid ${border}` }}>
              <div className="text-[13px] font-semibold tracking-[1px] uppercase mb-2" style={{ color: accent }}>Social</div>
              <div className="text-[15px] font-medium" style={{ color: t.text }}>@TheNitroNG</div>
              <p className="text-[11px] mt-1" style={{ color: t.textMuted }}>On Instagram and X. Fine for general questions. Please do not send order details or account information over social DMs.</p>
            </div>
          </div>

          {/* When we're around */}
          <div className="rounded-xl p-5 mb-10" style={{ background: dark ? "rgba(196,125,142,.06)" : "rgba(196,125,142,.04)", border: `1px solid ${dark ? "rgba(196,125,142,.14)" : "rgba(196,125,142,.1)"}` }}>
            <h2 className="text-[13px] font-semibold mb-2" style={{ color: t.text }}>When we are around</h2>
            <div className="text-[13px] leading-[1.65]" style={{ color: t.textSoft }}>
              <p>We answer every day. Realistically, replies are fastest between roughly 9am and 10pm West Africa Time, which is when most of our customers are active. Outside that window we still respond, just not always immediately.</p>
              <p className="mt-2">We are based in Lagos, Nigeria. The Nitro NG is a registered Nigerian company.</p>
            </div>
          </div>

          {/* Payment methods screenshot */}
          <div className="mb-10 max-w-[480px] mx-auto">
            <ProductScreenshot src="/images/nitro-fund-wallet-bank-transfer-card-nigeria.webp" alt="Funding a Nitro wallet in Naira by bank transfer, card, USSD or crypto" dark={dark} />
          </div>

          {/* Before you contact us */}
          <section className="mb-10">
            <h2 className="text-lg font-semibold mb-5" style={{ color: t.text }}>Before you message us</h2>
            <p className="text-[13px] mb-4 leading-[1.6]" style={{ color: t.textSoft }}>Four things come up constantly. If yours is one of them, this will be faster than waiting for a reply.</p>
            <div className="flex flex-col gap-3">
              {[
                ['"My order is still pending."', 'Some services start in minutes, others queue at the supplier. Give it a couple of hours first. If it is still pending after that, message us with the order ID and we will chase it or cancel it and return the value to your wallet.'],
                ['"My followers dropped."', 'Some drop is normal on every follower service. If you bought a Standard or Premium service that is marked refill included, refill should trigger on its own within a few days. If it has not, send us the order ID. If you bought Budget, there is no refill on that tier, which is shown on the service before you order.'],
                ['"I want a refund."', 'If an order did not start, the value goes back to your Nitro wallet as credit you can spend on another service. We do not refund to bank accounts or cards. The full policy is on our refund page.'],
                ['"Do you need my password?"', 'No. Never. We only need your public profile link or post link. If anyone claiming to be from Nitro asks for your password or a login code, it is not us. Report it to us immediately.'],
              ].map(([q, a]) => (
                <div key={q} className="rounded-xl p-5" style={{ background: cardBg, border: `1px solid ${border}` }}>
                  <div className="text-[13px] font-semibold mb-1.5" style={{ color: t.text }}>{q}</div>
                  <div className="text-[13px] leading-[1.65]" style={{ color: t.textMuted }}>{a}</div>
                </div>
              ))}
            </div>
          </section>

          {/* What to include */}
          <div className="rounded-xl p-5 mb-10" style={{ background: cardBg, border: `1px solid ${border}` }}>
            <h2 className="text-[13px] font-semibold mb-2" style={{ color: t.text }}>What to include when you message</h2>
            <div className="text-[13px] leading-[1.65]" style={{ color: t.textMuted }}>
              <p>You will get a faster answer if you send:</p>
              <ul className="list-disc pl-5 mt-2 space-y-1">
                <li>Your order ID, if it is about an order</li>
                <li>The email on your Nitro account</li>
                <li>A screenshot, if something looks wrong</li>
              </ul>
              <p className="mt-2">That is usually enough for us to resolve it in one message instead of five.</p>
            </div>
          </div>

        </main>
        <SharedFooter />
      </div>
    </>
  );
}
