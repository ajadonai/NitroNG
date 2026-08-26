'use client';
import { useState, useEffect } from 'react';
import { ThemeProvider, useTheme } from './shared-nav';
import SharedNav, { SharedFooter, SharedStyles } from './shared-nav';

// Public pitch for the reseller programme. Deliberately simple: what you get,
// how to join (WhatsApp — there is no application form by design), who it fits.
export default function ResellersLandingView() {
  return <ThemeProvider><ResellersInner /></ThemeProvider>;
}

const FALLBACK_WA = '2347071656156';

function ResellersInner() {
  const { dark, t } = useTheme();
  const accent = '#c47d8e';
  const border = dark ? 'rgba(255,255,255,.12)' : 'rgba(0,0,0,.08)';
  const cardBg = dark ? 'rgba(255,255,255,.05)' : '#fff';
  const subtleBg = dark ? 'rgba(196,125,142,.06)' : 'rgba(196,125,142,.04)';

  const [waNum, setWaNum] = useState(FALLBACK_WA);
  useEffect(() => {
    fetch('/api/settings').then(r => r.ok ? r.json() : {}).then(d => {
      const n = d.settings?.social_whatsapp_support?.replace(/\D/g, '');
      if (n) setWaNum(n);
    }).catch(() => {});
  }, []);

  const waLink = `https://wa.me/${waNum}?text=${encodeURIComponent("Hi! I'd like to become a Nitro reseller. Here's what my business does:")}`;

  const WaButton = ({ label = 'Message us on WhatsApp' }) => (
    <a href={waLink} target="_blank" rel="noopener noreferrer"
      aria-label={`${label} (opens WhatsApp in a new tab)`}
      className="inline-flex items-center gap-2 px-7 py-3 rounded-full text-[13px] font-semibold text-white no-underline transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#c47d8e]/50"
      style={{ background: accent }}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M17.5 14.4c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.96-.94 1.16-.17.2-.35.22-.65.07-.3-.15-1.26-.46-2.4-1.48-.88-.79-1.48-1.76-1.65-2.06-.17-.3-.02-.46.13-.61.14-.13.3-.35.45-.52.15-.18.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.62-.92-2.22-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.8.37-.27.3-1.04 1.02-1.04 2.5 0 1.47 1.07 2.9 1.22 3.1.15.2 2.1 3.2 5.1 4.49.71.3 1.27.49 1.7.63.72.23 1.37.2 1.88.12.58-.09 1.76-.72 2-1.42.25-.7.25-1.3.18-1.42-.08-.13-.28-.2-.58-.35zM12.05 21.8h-.01a9.87 9.87 0 01-5.03-1.38l-.36-.21-3.74.98 1-3.65-.24-.37a9.85 9.85 0 01-1.51-5.26c0-5.45 4.44-9.88 9.9-9.88a9.83 9.83 0 016.99 2.9 9.82 9.82 0 012.9 7c0 5.45-4.45 9.87-9.9 9.87zm8.42-18.3A11.8 11.8 0 0012.04 0C5.5 0 .16 5.34.16 11.9c0 2.1.55 4.15 1.6 5.95L.07 24l6.3-1.65a11.9 11.9 0 005.67 1.45c6.56 0 11.9-5.34 11.9-11.9 0-3.18-1.24-6.16-3.47-8.4z"/></svg>
      {label}
    </a>
  );

  const perks = [
    { title: 'Wholesale on everything', body: 'One reseller rate across the whole catalogue — the same services, the same wallet, lower prices on every order.' },
    { title: 'Naira in, naira out', body: 'Fund with Opay, PalmPay, Kuda or bank transfer. No dollar cards, no FX rates to watch, no foreign minimums.' },
    { title: 'A catalogue built for choosing', body: 'Thousands of services with quality grades, refill terms and speed shown before you order — plus a curated list backed by Nitro’s own guarantees.' },
    { title: 'Rates that grow with you', body: 'Wholesale is the floor, not the ceiling. Consistent volume earns a personal rate on top of the standard discount.' },
  ];

  const steps = [
    { n: '1', title: 'Message us on WhatsApp', body: 'Tell us about your business — your panel, your clients, or the volume you push. Two sentences is enough.' },
    { n: '2', title: 'We switch your account on', body: 'No forms, no waiting list. Once we set you up, your existing Nitro account simply starts seeing wholesale prices.' },
    { n: '3', title: 'Order like you always did', body: 'Same order page, same wallet, same history. The only thing that changes is what you pay.' },
  ];

  const fits = [
    { title: 'Panel owners', body: 'You run your own storefront and need a supplier that settles in naira.' },
    { title: 'Managers & agencies', body: 'You order for many clients’ accounts every week and the margin matters.' },
    { title: 'Bulk buyers', body: 'No storefront, just serious monthly volume that deserves better than retail.' },
  ];

  return (
    <>
      <SharedStyles />
      <div className="min-h-dvh flex flex-col font-[Plus_Jakarta_Sans,system-ui,sans-serif]" style={{ background: t.bg }}>
        <SharedNav />

        {/* Hero */}
        <div className="text-center pt-14 pb-12 max-md:pt-10 max-md:pb-9 px-6">
          <span className="text-xs font-semibold tracking-[2px] uppercase block mb-3" style={{ color: accent }}>For Resellers</span>
          <h1 className="text-[clamp(26px,5vw,40px)] font-semibold mb-4 leading-tight max-w-[620px] mx-auto" style={{ color: t.text, fontFamily: "'Cormorant Garamond',serif" }}>
            Wholesale prices for people who sell
          </h1>
          <p className="text-[15px] leading-relaxed max-w-[540px] mx-auto mb-7" style={{ color: t.textSoft }}>
            Run a panel, manage clients, or push real volume? Buy everything Nitro sells at reseller rates —
            paid in naira, delivered like always, with the margin left for you.
          </p>
          <WaButton />
        </div>

        <main className="flex-1 px-6 pb-20 max-w-[860px] mx-auto w-full">

          {/* What you get */}
          <section className="mb-14 max-md:mb-10">
            <h2 className="text-[22px] font-semibold mb-5 max-md:text-[18px]" style={{ color: t.text, fontFamily: "'Cormorant Garamond',serif" }}>What you get</h2>
            <div className="grid grid-cols-2 max-md:grid-cols-1 gap-4">
              {perks.map(p => (
                <div key={p.title} className="rounded-2xl p-5" style={{ background: cardBg, border: `1px solid ${border}` }}>
                  <div className="text-[15px] font-semibold mb-1.5" style={{ color: t.text }}>{p.title}</div>
                  <div className="text-[13px] leading-relaxed" style={{ color: t.textSoft }}>{p.body}</div>
                </div>
              ))}
            </div>
          </section>

          {/* How it works */}
          <section className="mb-14 max-md:mb-10">
            <h2 className="text-[22px] font-semibold mb-5 max-md:text-[18px]" style={{ color: t.text, fontFamily: "'Cormorant Garamond',serif" }}>How it works</h2>
            <div className="flex flex-col gap-3">
              {steps.map(s => (
                <div key={s.n} className="flex items-start gap-4 rounded-2xl p-5" style={{ background: subtleBg, border: `1px solid ${border}` }}>
                  <span className="w-8 h-8 rounded-full flex items-center justify-center text-[13px] font-bold flex-shrink-0" style={{ background: accent, color: '#fff' }}>{s.n}</span>
                  <div>
                    <div className="text-[15px] font-semibold mb-1" style={{ color: t.text }}>{s.title}</div>
                    <div className="text-[13px] leading-relaxed" style={{ color: t.textSoft }}>{s.body}</div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Who it's for */}
          <section className="mb-14 max-md:mb-10">
            <h2 className="text-[22px] font-semibold mb-5 max-md:text-[18px]" style={{ color: t.text, fontFamily: "'Cormorant Garamond',serif" }}>Built for</h2>
            <div className="grid grid-cols-3 max-md:grid-cols-1 gap-4">
              {fits.map(f => (
                <div key={f.title} className="rounded-2xl p-5" style={{ background: cardBg, border: `1px solid ${border}` }}>
                  <div className="text-[13px] font-semibold mb-1.5" style={{ color: accent }}>{f.title}</div>
                  <div className="text-[13px] leading-relaxed" style={{ color: t.textSoft }}>{f.body}</div>
                </div>
              ))}
            </div>
          </section>

          {/* The honest part */}
          <section className="mb-14 max-md:mb-10 rounded-2xl p-6 max-md:p-5" style={{ background: cardBg, border: `1px solid ${border}` }}>
            <h2 className="text-[18px] font-semibold mb-2" style={{ color: t.text, fontFamily: "'Cormorant Garamond',serif" }}>The honest bit</h2>
            <p className="text-[13px] leading-relaxed mb-2" style={{ color: t.textSoft }}>
              Our curated list carries Nitro&rsquo;s own guarantees — refills and support like any retail order.
              The wider catalogue is bigger and cheaper, and carries each service&rsquo;s own terms instead: refill
              and cancellation exactly as shown on the service, nothing more. We show you which is which before you order.
            </p>
            <p className="text-[13px] leading-relaxed" style={{ color: t.textSoft }}>
              Reseller pricing replaces retail perks — loyalty discounts and promo codes don&rsquo;t stack on top. Wholesale is the deal.
            </p>
          </section>

          {/* Final CTA */}
          <section className="text-center rounded-2xl py-10 px-6" style={{ background: subtleBg, border: `1px solid ${border}` }}>
            <h2 className="text-[clamp(20px,4vw,28px)] font-semibold mb-3" style={{ color: t.text, fontFamily: "'Cormorant Garamond',serif" }}>
              Two sentences about your business. That&rsquo;s the application.
            </h2>
            <p className="text-[13px] mb-6 max-w-[440px] mx-auto" style={{ color: t.textSoft }}>
              Message our support, tell us what you sell and roughly how much you move, and we&rsquo;ll take it from there.
            </p>
            <WaButton label="Become a reseller" />
          </section>
        </main>

        <SharedFooter />
      </div>
    </>
  );
}
