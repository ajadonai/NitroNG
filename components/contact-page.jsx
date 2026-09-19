'use client';
import { useEffect, useState } from 'react';
import { useT } from "./locale";
import { ThemeProvider, useTheme } from './shared-nav';
import SharedNav, { SharedFooter, SharedStyles } from './shared-nav';
import { SITE } from '../lib/site';
import { WaButton } from './wa-button';

const WA_FALLBACK = '2347071656156';

const QUESTIONS = [
  ['"My order is still pending."', 'Some services start in minutes, others queue at the provider. Give it a couple of hours first. If it is still pending after that, message us with the order ID and we will chase it or cancel it and return the value to your wallet.'],
  ['"My followers dropped."', 'Some drop is normal on every follower service. On a Standard or Premium service, refill should replace them within a few days. If it has not, send us the order ID. Budget has no refill, which is shown on the service before you order.'],
  ['"I want a refund."', 'If an order did not start, the value goes back to your wallet as credit you can spend right away. Wallet money is credit for Nitro services rather than a balance we pay back out — if a payment went wrong, message us on WhatsApp and we will sort it.'],
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
  const tr = useT();
  const { t } = useTheme();
  const [open, setOpen] = useState(QUESTIONS[0][0]);
  const [active, setActive] = useState(SECTIONS[0][0]);

  const [waNum, setWaNum] = useState(WA_FALLBACK);
  // TikTok has no entry in lib/site — it is set in Admin → Settings like the
  // others the footer reads, so this reads the same place and falls back to
  // the constants when a setting is blank.
  const [sl, setSl] = useState({});
  useEffect(() => {
    fetch('/api/settings').then(r => (r.ok ? r.json() : {})).then(d => {
      setSl(d?.settings || {});
      const n = d?.settings?.social_whatsapp_support?.replace(/\D/g, '');
      if (n) setWaNum(n);
    }).catch(() => {});
  }, []);
  const handle = (raw, strip, fallback) =>
    (raw ? String(raw).replace(strip, '').replace(/^@/, '').replace(/\/$/, '') : fallback) || fallback;
  const ig = handle(sl.social_instagram, /^(https?:\/\/)?(www\.)?(instagram\.com)\/?/i, SITE.social.instagram);
  const tw = handle(sl.social_twitter, /^(https?:\/\/)?(www\.)?(x\.com|twitter\.com)\/?/i, SITE.social.twitter);
  const tk = sl.social_tiktok ? handle(sl.social_tiktok, /^(https?:\/\/)?(www\.)?(tiktok\.com\/@?)?/i, '') : null;
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

  const eyebrow = { fontSize: 10.5, fontWeight: 700, letterSpacing: '1.6px', textTransform: 'uppercase', color: "var(--t-accent-ink)", display: 'block' };
  const card = { background: t.cardBg, border: `1px solid ${t.cardBorder}` };
  const channel = 'flex flex-col gap-1 rounded-[14px] px-[18px] py-4';

  return (
    <div className="min-h-dvh flex flex-col font-[Plus Jakarta Sans,system-ui,sans-serif] transition-[background] duration-500" style={{ background: t.bg, color: t.text }}>
      <SharedStyles />
      <SharedNav />
      <main className="flex-1 w-full max-w-[920px] mx-auto px-7 pt-11 pb-14 max-md:px-4 max-md:pt-7 max-md:pb-10 flex flex-col gap-[26px] max-md:gap-5">

        <header className="flex flex-col gap-2.5">
          <span style={eyebrow}>{tr("Contact")}</span>
          <h1 className="serif m-0 text-[clamp(34px,4.6vw,52px)] font-semibold leading-[1.08] tracking-[-0.01em]" style={{ color: t.text, textWrap: 'balance' }}>{tr("Talk to a person")}</h1>
          <p className="m-0 text-[18px] leading-[1.55] max-w-[62ch]" style={{ color: t.soft }}>{tr("WhatsApp is the fast way. Email is the written way. We answer every day, quickest between 9am and 10pm Lagos time.")}</p>
        </header>

        {/* Two channels, then the social row underneath. Each card says what
            it is *for* — "Fastest" only means something beside the others. */}
        <div className="grid grid-cols-2 gap-3 max-md:grid-cols-1">
          <div className={channel} style={{ ...card, borderColor: t.accent }}>
            <span style={eyebrow}>WhatsApp</span>
            <b className="text-[16px] font-semibold" style={{ color: t.text }}>{tr("Fastest way to reach us")}</b>
            <span className="text-[13px] leading-[1.5] flex-1" style={{ color: t.muted }}>{tr("Minutes during Lagos working hours, longer late at night and on Sundays. Send your order ID if your question is about a specific order.")}</span>
            {/* The brand green with dark ink, not the accent pink — the one
                colour on this page that does not say WhatsApp. */}
            <WaButton href={waLink} className="mt-2 w-full">{tr("Message us on WhatsApp")}</WaButton>
          </div>
          <div className={channel} style={card}>
            <span style={eyebrow}>Email</span>
            <b className="text-[16px] font-semibold" style={{ color: t.text }}>{tr("For anything with a paper trail")}</b>
            <span className="text-[13px] leading-[1.5] flex-1" style={{ color: t.muted }}>{tr("Attachments, invoices, a written record. Replies usually take a few hours rather than minutes.")}</span>
            {/* A button shaped like the WhatsApp one, so the two channels read
                as two choices rather than one offer and one afterthought. */}
            <a href={`mailto:${SITE.email.support}`}
              className="mt-2 inline-flex items-center justify-center gap-2 h-[34px] w-full rounded-[10px] border border-solid px-4 text-[13.5px] font-bold no-underline transition-transform duration-200 hover:-translate-y-px"
              style={{ borderColor: t.accent, color: "var(--t-accent-ink)" }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-10 6L2 7"/></svg>
              {SITE.email.support}
            </a>
          </div>
        </div>

        {/* The handles were plain text in a bold tag with nowhere to go, and
            the separator between them read as part of one handle. */}
        <div className={channel} style={card}>
          <span style={eyebrow}>{tr("Social")}</span>
          <b className="text-[16px] font-semibold" style={{ color: t.text }}>{tr("Follow, or say hello")}</b>
          <span className="text-[13px] leading-[1.5]" style={{ color: t.muted }}>{tr("General questions only. Never send order details, account information or payment details to a social account.")}</span>
          <div className="flex gap-2 flex-wrap mt-2">
            {[
              [`https://instagram.com/${ig}`, 'Instagram', `@${ig}`, "M12 2.2c3.2 0 3.6 0 4.9.1 1.2.1 1.8.2 2.2.4.6.2 1 .5 1.4.9.4.4.7.8.9 1.4.2.4.4 1 .4 2.2.1 1.3.1 1.7.1 4.9s0 3.6-.1 4.9c-.1 1.2-.2 1.8-.4 2.2-.2.6-.5 1-.9 1.4-.4.4-.8.7-1.4.9-.4.2-1 .4-2.2.4-1.3.1-1.7.1-4.9.1s-3.6 0-4.9-.1c-1.2-.1-1.8-.2-2.2-.4-.6-.2-1-.5-1.4-.9-.4-.4-.7-.8-.9-1.4-.2-.4-.4-1-.4-2.2C2.2 15.6 2.2 15.2 2.2 12s0-3.6.1-4.9c.1-1.2.2-1.8.4-2.2.2-.6.5-1 .9-1.4.4-.4.8-.7 1.4-.9.4-.2 1-.4 2.2-.4C8.4 2.2 8.8 2.2 12 2.2zm0 5.8a4 4 0 100 8 4 4 0 000-8zm0 6.6a2.6 2.6 0 110-5.2 2.6 2.6 0 010 5.2zm5.1-6.8a.94.94 0 11-1.9 0 .94.94 0 011.9 0z"],
              [`https://x.com/${tw}`, 'X', `@${tw}`, "M18.9 1.2h3.7l-8.1 9.2 9.5 12.5h-7.4l-5.8-7.6-6.7 7.6H.4l8.6-9.8L0 1.2h7.6l5.2 6.9 6.1-6.9zm-1.3 19.5h2L6.5 3.2H4.4l13.2 17.5z"],
              ...(tk ? [[`https://tiktok.com/@${tk}`, 'TikTok', `@${tk}`, "M16.6 5.8a4.3 4.3 0 01-1-2.6h-3v11.6a2.5 2.5 0 11-1.8-2.4V9.3a5.5 5.5 0 103.5 5.1V8.8a7.2 7.2 0 004.2 1.4V7.2a4.3 4.3 0 01-1.9-1.4z"]] : []),
            ].map(([href, label, text, d]) => (
              <a key={label} href={href} target="_blank" rel="noopener noreferrer" aria-label={label}
                className="inline-flex items-center gap-2 h-[34px] rounded-[10px] border border-solid px-3 text-[13px] font-semibold no-underline transition-transform duration-200 hover:-translate-y-px"
                style={{ borderColor: t.cardBorder, color: t.text, background: t.bg }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d={d} /></svg>
                {text}
              </a>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-[220px_1fr] gap-9 items-start max-md:grid-cols-1 max-md:gap-[18px]">
          <aside className="sticky top-5 flex flex-col gap-0.5 max-md:hidden">
            <span style={{ ...eyebrow, marginBottom: 8 }}>{tr("On this page")}</span>
            {SECTIONS.map(([id, label]) => {
              const on = id === active;
              return <a key={id} href={`#${id}`} className="text-[13px] leading-[1.35] px-2.5 py-1.5 no-underline" style={{ color: on ? t.text : t.muted, borderLeft: `2px solid ${on ? t.accent : t.cardBorder}`, fontWeight: on ? 600 : 400 }}>{label}</a>;
            })}
          </aside>
          <details className="md:hidden rounded-xl px-3.5 py-2.5 text-[13px]" style={card}>
            <summary className="font-semibold cursor-pointer" style={{ color: t.text }}>{tr("On this page ·")} {SECTIONS.length} sections</summary>
            {SECTIONS.map(([id, label]) => (
              <a key={id} href={`#${id}`} className="block py-1.5 no-underline" style={{ color: t.muted, borderTop: `1px solid ${t.cardBorder}` }}>{label}</a>
            ))}
          </details>

          <article className="flex flex-col gap-[22px] max-w-[66ch] min-w-0">

            <section id="before-you-message" className="scroll-mt-24">
              <h2 className="serif m-0 mb-2 text-[27px] font-semibold tracking-[-0.01em]" style={{ color: t.text }}>{tr("Before you message")}</h2>
              <p className="m-0 mb-3 text-[15.5px] leading-[1.7]" style={{ color: t.soft }}>{tr("Four things come up constantly. If yours is one of them, this is faster than waiting.")}</p>
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
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={isOpen ? t.accent : t.muted} strokeWidth="2" strokeLinecap="round" className="dir-flip shrink-0" aria-hidden="true">
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
              <h2 className="serif m-0 mb-2 text-[27px] font-semibold tracking-[-0.01em]" style={{ color: t.text }}>{tr("What to include")}</h2>
              <p className="m-0 mb-3 text-[15.5px] leading-[1.7]" style={{ color: t.soft }}>{tr("You will get a faster answer with:")}</p>
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
              <h2 className="serif m-0 mb-2 text-[27px] font-semibold tracking-[-0.01em]" style={{ color: t.text }}>{tr("When we are around")}</h2>
              <p className="m-0 text-[15.5px] leading-[1.7]" style={{ color: t.soft }}>{tr("We answer every day. Realistically, replies are fastest between roughly 9am and 10pm West Africa Time, which is when most of our customers are active. Outside that window we still respond, just not always immediately.")}</p>
              <p className="m-0 mt-3 text-[15.5px] leading-[1.7]" style={{ color: t.soft }}>{tr("We are based in Lagos, Nigeria. The Nitro NG is a registered Nigerian company.")}</p>
            </section>

          </article>
        </div>

        <div className="flex items-center gap-3 rounded-[14px] px-[18px] py-4 max-md:flex-col max-md:items-stretch" style={card}>
          <span className="flex flex-col gap-0.5">
            <b className="text-[15px]" style={{ color: t.text }}>{tr("Ready?")}</b>
            <span className="text-[13px]" style={{ color: t.soft }}>{tr("Open WhatsApp and tell us what is going on.")}</span>
          </span>
          <a href={waLink} target="_blank" rel="noopener noreferrer" className="ml-auto max-md:ml-0 max-md:w-full inline-flex items-center justify-center rounded-[10px] px-4 py-2.5 text-[13.5px] font-semibold no-underline text-white transition-transform duration-200 hover:-translate-y-px" style={{ background: t.btnPrimary }}>{tr("Message us")}</a>
        </div>

      </main>
      <SharedFooter />
    </div>
  );
}
