'use client';
import { useEffect, useMemo, useState } from 'react';
import { useTheme } from './shared-nav';
import SharedNav, { SharedFooter, SharedStyles } from './shared-nav';
import { SITE } from '../lib/site';

const slug = s => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

// "August 29, 2026" -> "29 August 2026"; anything else is shown as given.
const showDate = d => { const m = /^([A-Za-z]+) (\d{1,2}), (\d{4})$/.exec(d || ''); return m ? `${m[2]} ${m[1]} ${m[3]}` : d; };

function withEmail(text, email, color) {
  if (!email || !text.includes(email)) return text;
  const [before, ...rest] = text.split(email);
  return <>{before}<a href={`mailto:${email}`} style={{ color }}>{email}</a>{rest.join(email)}</>;
}

export function LegalLayout({ label, title, date, summary = [], sections = [], related = [], action = 'back' }) {
  const { t } = useTheme();
  const email = SITE.email.general;
  const items = useMemo(() => sections.map(([h, body]) => ({ id: slug(h), title: h, body })), [sections]);
  const minutes = useMemo(() => {
    const words = sections.reduce((n, [h, body]) => n + `${h} ${body}`.trim().split(/\s+/).length, 0);
    return Math.max(1, Math.round(words / 200));
  }, [sections]);

  const [active, setActive] = useState(items[0]?.id);
  useEffect(() => {
    const onScroll = () => {
      let cur = items[0]?.id;
      for (const { id } of items) {
        const el = document.getElementById(id);
        if (el && el.getBoundingClientRect().top <= 140) cur = id;
      }
      setActive(cur);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [items]);

  const [waLink, setWaLink] = useState(null);
  useEffect(() => {
    fetch('/api/settings').then(r => r.ok ? r.json() : {}).then(d => {
      const num = d?.settings?.social_whatsapp_support;
      if (num) setWaLink(`https://wa.me/${num.replace(/\D/g, '')}`);
    }).catch(() => {});
  }, []);

  const eyebrow = { fontSize: 10.5, fontWeight: 700, letterSpacing: '1.6px', textTransform: 'uppercase', color: t.accent, display: 'block' };
  const card = { background: t.cardBg, border: `1px solid ${t.cardBorder}` };

  return (
    <div className="min-h-dvh flex flex-col font-[Plus Jakarta Sans,system-ui,sans-serif] transition-[background] duration-500" style={{ background: t.bg, color: t.text }}>
      <SharedStyles />
      <SharedNav action={action} />
      <div className="flex-1 w-full max-w-[920px] mx-auto px-7 pt-11 pb-14 max-md:px-4 max-md:pt-7 max-md:pb-10 flex flex-col gap-[26px] max-md:gap-5">

        <header className="flex flex-col gap-2.5">
          <span style={eyebrow}>{label}</span>
          <h1 className="serif m-0 text-[clamp(34px,4.6vw,52px)] font-semibold leading-[1.08] tracking-[-0.01em]" style={{ color: t.text, textWrap: 'balance' }}>{title}</h1>
          <p className="m-0 text-[13.5px]" style={{ color: t.muted }}>Updated {showDate(date)} · about {minutes} {minutes === 1 ? 'minute' : 'minutes'} to read</p>
        </header>

        {summary.length > 0 && (
          <div className="rounded-xl px-[18px] py-3.5" style={{ ...card, background: "rgba(196,125,142,.08)" }}>
            <span style={eyebrow}>In plain words</span>
            <ul className="mt-2 mb-0 pl-[18px] text-[14.5px] leading-[1.6] list-disc" style={{ color: t.text }}>
              {summary.map((s, i) => <li key={i} className="my-[3px]">{s}</li>)}
            </ul>
          </div>
        )}

        <div className="grid grid-cols-[220px_1fr] gap-9 items-start max-md:grid-cols-1 max-md:gap-[18px]">
          <aside className="sticky top-5 flex flex-col gap-0.5 max-md:hidden">
            <span style={{ ...eyebrow, marginBottom: 8 }}>On this page</span>
            {items.map(({ id, title: h }) => {
              const on = id === active;
              return (
                <a key={id} href={`#${id}`} className="text-[13px] leading-[1.35] px-2.5 py-1.5 no-underline" style={{ color: on ? t.text : t.muted, borderLeft: `2px solid ${on ? t.accent : t.cardBorder}`, fontWeight: on ? 600 : 400 }}>{h}</a>
              );
            })}
          </aside>
          <details className="md:hidden rounded-xl px-3.5 py-2.5 text-[13px]" style={card}>
            <summary className="font-semibold cursor-pointer" style={{ color: t.text }}>On this page · {items.length} {items.length === 1 ? 'section' : 'sections'}</summary>
            {items.map(({ id, title: h }) => (
              <a key={id} href={`#${id}`} className="block py-1.5 no-underline" style={{ color: t.muted, borderTop: `1px solid ${t.cardBorder}` }}>{h}</a>
            ))}
          </details>

          <article className="flex flex-col gap-[22px] max-w-[66ch]">
            {items.map(({ id, title: h, body }) => (
              <section key={id} id={id} className="scroll-mt-24">
                <h2 className="serif m-0 mb-2 text-[27px] font-semibold tracking-[-0.01em]" style={{ color: t.text }}>{h}</h2>
                <p className="m-0 text-[15.5px] leading-[1.7]" style={{ color: t.soft }}>{withEmail(body, email, t.accent)}</p>
              </section>
            ))}
          </article>
        </div>

        {related.length > 0 && (
          <div>
            <span style={{ ...eyebrow, marginBottom: 10 }}>Related</span>
            <div className="grid grid-cols-3 gap-3 max-md:grid-cols-1">
              {related.map(({ title: h, desc, href }) => (
                <a key={href} href={href} className="flex flex-col gap-1 rounded-xl px-4 py-3.5 no-underline transition-transform duration-200 hover:-translate-y-px" style={card}>
                  <b className="text-[14px] leading-[1.35]" style={{ color: t.text }}>{h}</b>
                  <span className="text-[12px]" style={{ color: t.muted }}>{desc}</span>
                </a>
              ))}
            </div>
          </div>
        )}

        <div className="flex items-center gap-3 rounded-[14px] px-[18px] py-4 max-md:flex-col max-md:items-stretch" style={card}>
          <span className="flex flex-col gap-0.5">
            <b className="text-[15px]" style={{ color: t.text }}>A question about this?</b>
            <span className="text-[13px]" style={{ color: t.soft }}>Message us on WhatsApp, we usually answer in minutes.</span>
          </span>
          <a href={waLink || '/contact'} target={waLink ? '_blank' : undefined} rel={waLink ? 'noopener noreferrer' : undefined} className="ml-auto max-md:ml-0 max-md:w-full inline-flex items-center justify-center rounded-[10px] px-4 py-2.5 text-[13.5px] font-semibold no-underline text-white transition-transform duration-200 hover:-translate-y-px" style={{ background: t.btnPrimary }}>WhatsApp us</a>
        </div>
      </div>
      <SharedFooter />
    </div>
  );
}

export default LegalLayout;
