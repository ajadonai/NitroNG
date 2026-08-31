'use client';
import { useEffect, useState } from 'react';
import { ThemeProvider, useTheme } from './shared-nav';
import SharedNav, { SharedFooter, SharedStyles } from './shared-nav';
import { SITE } from '../lib/site';

const WA_FALLBACK = '2347071656156';

const QUESTIONS = [
  ['"My order is still pending."', 'Some services start in minutes, others queue at the provider. Give it a couple of hours first. If it is still pending after that, message us with the order ID and we will chase it or cancel it and return the value to your wallet.'],
  ['"My followers dropped."', 'Some drop is normal on every follower service. On a Standard or Premium service, refill should replace them within a few days. If it has not, send us the order ID. Budget has no refill, which is shown on the service before you order.'],
  ['"I want a refund."', 'If an order did not start, the value goes back to your wallet as credit you can spend. Money you added and have not spent can go back to your bank — just ask us on WhatsApp.'],
  ['"Do you need my password?"', 'No. Never. We only need your public profile link or post link. If anyone claiming to be from Nitro asks for your password or a login code, it is not us. Report it to us immediately.'],
];

const INCLUDE = [
  ['Your order ID', 'If it is about an order'],
  ['The email on your account', 'So we can find you'],
  ['What you expected', 'And what happened instead'],
  ['A screenshot', 'If something looked wrong'],
];

const SECTIONS = [
  ['before-you-message', 'Before you message'],
  ['what-to-include', 'What to include'],
  ['when-we-are-around', 'When we are around'],
];

export default function ContactView() {
  return <ThemeProvider><ContactInner /></ThemeProvider>;
}

function ContactInner() {
  const { t } = useTheme();
  const [open, setOpen] = useState(QUESTIONS[0][0]);
  const [active, setActive] = useState(SECTIONS[0][0]);

  const [waNum, setWaNum] = useState(WA_FALLBACK);
  useEffect(() => {
    fetch('/api/settings').then(r => (r.ok ? r.json() : {})).then(d => {
      const n = d?.settings?.social_whatsapp_support?.replace(/\D/g, '');
      if (n) setWaNum(n);
    }).catch(() => {});
  }, []);
  const waLink = `https://wa.me/${waNum}?text=${encodeURIComponent('Hi *Nitro*, I need help')}`;

  useEffect(() => {
    const onScroll = () => {
      let cur = SECTIONS[0][0];
      for (const [id] of SECTIONS) {
        const el = document.getElementById(id);
        if (el && el.getBoundingClientRect().top <= 140) cur = id;
      }
      setActive(cur);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const eyebrow = { fontSize: 10.5, fontWeight: 700, letterSpacing: '1.6px', textTransform: 'uppercase', color: t.accent, display: 'block' };
  const card = { background: t.cardBg, border: `1px solid ${t.cardBorder}` };
  const channel = 'flex flex-col gap-1 rounded-[14px] px-[18px] py-4';

  return (
    <div className="min-h-dvh flex flex-col font-[Plus Jakarta Sans,system-ui,sans-serif] transition-[background] duration-500" style={{ background: t.bg, color: t.text }}>
      <SharedStyles />
      <SharedNav />
      <main className="flex-1 w-full max-w-[920px] mx-auto px-7 pt-11 pb-14 max-md:px-4 max-md:pt-7 max-md:pb-10 flex flex-col gap-[26px] max-md:gap-5">

        <header className="flex flex-col gap-2.5">
          <span style={eyebrow}>Contact</span>
          <h1 className="serif m-0 text-[clamp(34px,4.6vw,52px)] font-semibold leading-[1.08] tracking-[-0.01em]" style={{ color: t.text, textWrap: 'balance' }}>Talk to a person</h1>
          <p className="m-0 text-[18px] leading-[1.55] max-w-[62ch]" style={{ color: t.soft }}>WhatsApp is the fast way. Email is the written way. We answer every day, quickest between 9am and 10pm Lagos time.</p>
        </header>

        <div className="grid grid-cols-[1.3fr_1fr_1fr] gap-3 max-md:grid-cols-1">
          <div className={channel} style={{ ...card, borderColor: t.accent }}>
            <span style={eyebrow}>WhatsApp</span>
            <b className="text-[16px] font-semibold" style={{ color: t.text }}>Fastest</b>
            <span className="text-[13px] leading-[1.5] flex-1" style={{ color: t.muted }}>Our main support channel. Typical reply time is minutes during Lagos working hours, longer late at night and on Sundays. Send your order ID if your question is about a specific order.</span>
            <a href={waLink} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center justify-center rounded-[10px] px-4 py-2.5 text-[13.5px] font-semibold no-underline text-white transition-transform duration-200 hover:-translate-y-px" style={{ background: t.btnPrimary }}>Message us</a>
          </div>
          <div className={channel} style={card}>
            <span style={eyebrow}>Email</span>
            <a href={`mailto:${SITE.email.support}`} className="text-[16px] font-semibold no-underline" style={{ color: t.text }}>{SITE.email.support}</a>
            <span className="text-[13px] leading-[1.5]" style={{ color: t.muted }}>Better for anything that needs attachments, invoices or a written record. Replies usually take a few hours rather than minutes.</span>
          </div>
          <div className={channel} style={card}>
            <span style={eyebrow}>Social</span>
            <b className="text-[16px] font-semibold" style={{ color: t.text }}>@{SITE.social.instagram} · @{SITE.social.twitter}</b>
            <span className="text-[13px] leading-[1.5]" style={{ color: t.muted }}>On Instagram and X. Fine for general questions. Please do not send order details or account information over social DMs.</span>
          </div>
        </div>

        <div className="grid grid-cols-[220px_1fr] gap-9 items-start max-md:grid-cols-1 max-md:gap-[18px]">
          <aside className="sticky top-5 flex flex-col gap-0.5 max-md:hidden">
            <span style={{ ...eyebrow, marginBottom: 8 }}>On this page</span>
            {SECTIONS.map(([id, label]) => {
              const on = id === active;
              return <a key={id} href={`#${id}`} className="text-[13px] leading-[1.35] px-2.5 py-1.5 no-underline" style={{ color: on ? t.text : t.muted, borderLeft: `2px solid ${on ? t.accent : t.cardBorder}`, fontWeight: on ? 600 : 400 }}>{label}</a>;
            })}
          </aside>
          <details className="md:hidden rounded-xl px-3.5 py-2.5 text-[13px]" style={card}>
            <summary className="font-semibold cursor-pointer" style={{ color: t.text }}>On this page · {SECTIONS.length} sections</summary>
            {SECTIONS.map(([id, label]) => (
              <a key={id} href={`#${id}`} className="block py-1.5 no-underline" style={{ color: t.muted, borderTop: `1px solid ${t.cardBorder}` }}>{label}</a>
            ))}
          </details>

          <article className="flex flex-col gap-[22px] max-w-[66ch] min-w-0">

            <section id="before-you-message" className="scroll-mt-24">
              <h2 className="serif m-0 mb-2 text-[27px] font-semibold tracking-[-0.01em]" style={{ color: t.text }}>Before you message</h2>
              <p className="m-0 mb-3 text-[15.5px] leading-[1.7]" style={{ color: t.soft }}>Four things come up constantly. If yours is one of them, this is faster than waiting.</p>
              <div className="rounded-[14px] overflow-hidden" style={card}>
                {QUESTIONS.map(([q, a], i) => {
                  const isOpen = open === q;
                  return (
                    <div key={q} style={{ borderTop: i ? `1px solid ${t.cardBorder}` : undefined }}>
                      <button
                        type="button"
                        onClick={() => setOpen(isOpen ? null : q)}
                        aria-expanded={isOpen}
                        className="w-full flex justify-between items-center gap-2.5 py-3.5 px-[18px] bg-transparent border-none cursor-pointer text-left"
                      >
                        <span className="text-[15px] font-semibold transition-colors duration-200" style={{ color: isOpen ? t.accent : t.text }}>{q}</span>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={isOpen ? t.accent : t.muted} strokeWidth="2" strokeLinecap="round" className="shrink-0" aria-hidden="true">
                          <path d="M5 12h14" />
                          {!isOpen && <path d="M12 5v14" />}
                        </svg>
                      </button>
                      {isOpen && <p className="text-[14.5px] leading-[1.65] max-w-[66ch] m-0 px-[18px] pb-3.5" style={{ color: t.soft }}>{a}</p>}
                    </div>
                  );
                })}
              </div>
            </section>

            <section id="what-to-include" className="scroll-mt-24">
              <h2 className="serif m-0 mb-2 text-[27px] font-semibold tracking-[-0.01em]" style={{ color: t.text }}>What to include</h2>
              <p className="m-0 mb-3 text-[15.5px] leading-[1.7]" style={{ color: t.soft }}>You will get a faster answer with:</p>
              <div className="grid grid-cols-2 gap-3 max-md:grid-cols-1">
                {INCLUDE.map(([label, note]) => (
                  <span key={label} className="flex flex-col gap-0.5 rounded-xl px-4 py-3.5" style={card}>
                    <b className="text-[14.5px] font-semibold" style={{ color: t.text }}>{label}</b>
                    <span className="text-[13px] leading-[1.45]" style={{ color: t.muted }}>{note}</span>
                  </span>
                ))}
              </div>
            </section>

            <section id="when-we-are-around" className="scroll-mt-24">
              <h2 className="serif m-0 mb-2 text-[27px] font-semibold tracking-[-0.01em]" style={{ color: t.text }}>When we are around</h2>
              <p className="m-0 text-[15.5px] leading-[1.7]" style={{ color: t.soft }}>We answer every day. Realistically, replies are fastest between roughly 9am and 10pm West Africa Time, which is when most of our customers are active. Outside that window we still respond, just not always immediately.</p>
              <p className="m-0 mt-3 text-[15.5px] leading-[1.7]" style={{ color: t.soft }}>We are based in Lagos, Nigeria. The Nitro NG is a registered Nigerian company.</p>
            </section>

          </article>
        </div>

        <div className="flex items-center gap-3 rounded-[14px] px-[18px] py-4 max-md:flex-col max-md:items-stretch" style={card}>
          <span className="flex flex-col gap-0.5">
            <b className="text-[15px]" style={{ color: t.text }}>Ready?</b>
            <span className="text-[13px]" style={{ color: t.soft }}>Open WhatsApp and tell us what is going on.</span>
          </span>
          <a href={waLink} target="_blank" rel="noopener noreferrer" className="ml-auto max-md:ml-0 max-md:w-full inline-flex items-center justify-center rounded-[10px] px-4 py-2.5 text-[13.5px] font-semibold no-underline text-white transition-transform duration-200 hover:-translate-y-px" style={{ background: t.btnPrimary }}>Message us</a>
        </div>

      </main>
      <SharedFooter />
    </div>
  );
}
