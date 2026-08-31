'use client';
import { useState, useEffect } from 'react';
import { ThemeProvider, useTheme } from './shared-nav';
import SharedNav, { SharedFooter, SharedStyles } from './shared-nav';

export default function LagosView() {
  return <ThemeProvider><LagosInner /></ThemeProvider>;
}

const SECTIONS = [
  ['why-lagos', 'Why being Lagos-based matters', 'Why being Lagos-based matters'],
  ['what-local-means', 'What being local means', 'What being local means for you'],
  ['popular-in-lagos', 'Popular in Lagos', 'Popular in Lagos'],
  ['questions', 'Questions', 'Questions people in Lagos ask'],
];

const LAGOS_FAQ = [
  ['Is there an office I can visit?', 'No. Nitro is online only, so there is no walk-in office. Everything is handled on WhatsApp and by email. That is normal for this kind of business.'],
  ['Do you only deliver in Lagos?', 'No. We serve customers all over Nigeria and beyond. Being in Lagos means our team and our support hours are on Lagos time; the services work wherever you and your audience are.'],
  ['Can I pay with my Nigerian bank?', 'Yes. Bank transfer from any Nigerian bank, plus Opay, PalmPay, Kuda, Moniepoint and VBank, cards, USSD and crypto. All in naira.'],
  ['What are your hours?', 'The platform runs all day and night; orders process around the clock. Support is fastest between 9am and 10pm West Africa Time, seven days a week.'],
];

const READ_MORE = [
  ['/pricing', 'Pricing', 'Every price, all 28 platforms'],
  ['/quality', 'Service quality', 'How we keep drop rates low'],
  ['/contact', 'Contact', 'WhatsApp, email and hours'],
];

const WHY = [
  'Most SMM panels that show up in Nigerian search results are not Nigerian. They are international services with a Nigeria landing page, priced in dollars or with an exchange rate baked in. When something goes wrong, support is in a different timezone and may not understand how Opay or bank transfer works.',
  'Nitro is different because we are actually here. The team is in Lagos. The business operates on West Africa Time. When you message support at 2 PM on a Tuesday, you are talking to someone who is also at 2 PM on a Tuesday, not someone working a night shift in another country.',
  'That sounds like a small thing until you need it.',
];

const LOCAL = [
  ['Naira pricing, no conversion', 'Every service is priced in Naira. When you deposit ₦5,000, you get ₦5,000 in your wallet. No dollar conversion, no exchange rate markup, no surprises on your bank statement.'],
  ['Your bank, your wallet', 'Pay by bank transfer from any Nigerian bank, debit or credit card, USSD, or wallets like Opay, PalmPay, Kuda, Moniepoint and VBank. All through Flutterwave. Crypto is also accepted.'],
  ['WhatsApp support in your timezone', 'Our support line is on WhatsApp. Response is fastest between 9 AM and 10 PM WAT, seven days a week. You are not waiting for a ticket system to route you to someone in another country.'],
  ['₦1,000 minimum deposit', 'You do not need to convert dollars or meet a high minimum. Deposit ₦1,000 and you can start ordering. First deposit of ₦2,500 or more earns up to ₦3,000 in free promotion credit.'],
  ['Services across 28 platforms', 'Instagram, TikTok, YouTube, Facebook, X, Telegram, Spotify, Audiomack, Boomplay, and 19 more. Music promotion for Nigerian artists on local platforms is something most international panels do not offer.'],
];

const POPULAR = [
  ['Instagram Followers', '₦3,818', '/services/instagram/followers'],
  ['Instagram Likes', '₦1,663', '/services/instagram/likes'],
  ['Instagram Views', '₦315', '/services/instagram/views'],
  ['TikTok Followers', '₦14,089', '/services/tiktok/followers'],
  ['TikTok Views', '₦472', '/services/tiktok/views'],
  ['YouTube Subscribers', '₦37,610', '/services/youtube/subscribers'],
  ['Facebook Page Followers', '₦1,549', '/services/facebook/followers'],
  ['X Followers', '₦5,409', '/services/x/followers'],
  ['Spotify Plays', '₦1,193', '/services/spotify/plays'],
  ['Audiomack Plays', '₦1,491', '/services/spotify'],
];

function LagosInner() {
  const { t } = useTheme();

  const [stats, setStats] = useState(null);
  useEffect(() => {
    fetch('/api/site-info').then(r => r.json()).then(d => setStats(d.stats)).catch(() => {});
  }, []);

  const [waLink, setWaLink] = useState(null);
  useEffect(() => {
    fetch('/api/settings').then(r => r.ok ? r.json() : {}).then(d => {
      const num = d?.settings?.social_whatsapp_support;
      if (num) setWaLink(`https://wa.me/${num.replace(/\D/g, '')}`);
    }).catch(() => {});
  }, []);

  const [active, setActive] = useState(SECTIONS[0][0]);
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

  // Rendered only once the live figures land, so the row never flashes four dashes.
  const facts = stats ? [
    [stats.orders || '—', 'Orders', 'placed on Nitro'],
    [stats.users || '—', 'Accounts', 'mostly Nigerian'],
    ['₦1,000', 'Minimum deposit', 'no dollar conversion'],
    [stats.uniquePlatforms || '—', 'Platforms', stats.services ? `${stats.services} services` : '—'],
  ] : [];

  const eyebrow = { fontSize: 10.5, fontWeight: 700, letterSpacing: '1.6px', textTransform: 'uppercase', color: t.accent, display: 'block' };
  const card = { background: t.cardBg, border: `1px solid ${t.cardBorder}` };
  const h2 = { color: t.text };

  return (
    <div className="min-h-dvh flex flex-col font-[Plus Jakarta Sans,system-ui,sans-serif] transition-[background] duration-500" style={{ background: t.bg, color: t.text, '--pg-line': t.cardBorder }}>
      <style>{PG_CSS}</style>
      <SharedStyles />
      <SharedNav />
      <div className="flex-1 w-full max-w-[920px] mx-auto px-7 pt-11 pb-14 max-md:px-4 max-md:pt-7 max-md:pb-10 flex flex-col gap-[26px] max-md:gap-5">

        <header className="flex flex-col gap-2.5">
          <span style={eyebrow}>Lagos</span>
          <h1 className="serif m-0 text-[clamp(34px,4.6vw,52px)] font-semibold leading-[1.08] tracking-[-0.01em]" style={{ color: t.text, textWrap: 'balance' }}>An SMM panel that is actually in Lagos</h1>
          <p className="m-0 text-[18px] leading-[1.55] max-w-[62ch]" style={{ color: t.soft }}>The team is here. The business runs on West Africa Time. When you message at 2pm on a Tuesday, someone is awake.</p>
        </header>

        {facts.length > 0 && (
          <div className="pg-stats rounded-[14px]" style={card}>
            {facts.map(([value, label, sub]) => (
              <div key={label} className="pg-stt">
                <b className="m" style={{ color: t.text }}>{value}</b>
                <span style={{ color: t.muted }}>{label}</span>
                <i style={{ color: t.muted }}>{sub}</i>
              </div>
            ))}
          </div>
        )}

        <div className="grid grid-cols-[220px_1fr] gap-9 items-start max-md:grid-cols-1 max-md:gap-[18px]">
          <aside className="sticky top-5 flex flex-col gap-0.5 max-md:hidden">
            <span style={{ ...eyebrow, marginBottom: 8 }}>On this page</span>
            {SECTIONS.map(([id, short]) => {
              const on = id === active;
              return (
                <a key={id} href={`#${id}`} className="text-[13px] leading-[1.35] px-2.5 py-1.5 no-underline" style={{ color: on ? t.text : t.muted, borderLeft: `2px solid ${on ? t.accent : t.cardBorder}`, fontWeight: on ? 600 : 400 }}>{short}</a>
              );
            })}
          </aside>
          <details className="md:hidden rounded-xl px-3.5 py-2.5 text-[13px]" style={card}>
            <summary className="font-semibold cursor-pointer" style={{ color: t.text }}>On this page · {SECTIONS.length} sections</summary>
            {SECTIONS.map(([id, short]) => (
              <a key={id} href={`#${id}`} className="block py-1.5 no-underline" style={{ color: t.muted, borderTop: `1px solid ${t.cardBorder}` }}>{short}</a>
            ))}
          </details>

          <article className="flex flex-col gap-[22px] max-w-[66ch] min-w-0">
            <section id="why-lagos" className="scroll-mt-24">
              <h2 className="serif m-0 mb-2 text-[27px] font-semibold tracking-[-0.01em]" style={h2}>{SECTIONS[0][2]}</h2>
              {WHY.map((p, i) => (
                <p key={i} className={`m-0 text-[15.5px] leading-[1.7]${i < WHY.length - 1 ? ' mb-3' : ''}`} style={{ color: t.soft }}>{p}</p>
              ))}
            </section>

            <section id="what-local-means" className="scroll-mt-24">
              <h2 className="serif m-0 mb-2 text-[27px] font-semibold tracking-[-0.01em]" style={h2}>{SECTIONS[1][2]}</h2>
              <div className="grid grid-cols-2 gap-3 max-md:grid-cols-1">
                {LOCAL.map(([title, desc]) => (
                  <div key={title} className="flex flex-col rounded-xl px-4 py-3.5" style={card}>
                    <b className="text-[14.5px] font-semibold" style={{ color: t.text }}>{title}</b>
                    <span className="text-[13px] leading-[1.45]" style={{ color: t.muted }}>{desc}</span>
                  </div>
                ))}
              </div>
            </section>

            <section id="popular-in-lagos" className="scroll-mt-24">
              <h2 className="serif m-0 mb-2 text-[27px] font-semibold tracking-[-0.01em]" style={h2}>{SECTIONS[2][2]}</h2>
              <div className="rounded-[14px] overflow-hidden" style={card}>
                {POPULAR.map(([service, price, href], i) => (
                  <a key={service} href={href} className="flex items-center justify-between gap-3 px-[18px] py-3.5 no-underline" style={{ borderTop: i ? `1px solid ${t.cardBorder}` : undefined }}>
                    <span className="flex flex-col min-w-0">
                      <b className="text-[14.5px] font-semibold" style={{ color: t.text }}>{service}</b>
                      <span className="text-[12.5px] leading-[1.45]" style={{ color: t.muted }}>per 1,000</span>
                    </span>
                    <b className="m text-[14px] font-bold whitespace-nowrap" style={{ color: t.text }}>from {price}</b>
                  </a>
                ))}
              </div>
            </section>

            <section id={SECTIONS[3][0]} className="scroll-mt-24">
              <h2 className="serif m-0 mb-2 text-[27px] font-semibold tracking-[-0.01em]" style={h2}>{SECTIONS[3][2]}</h2>
              <Accordion items={LAGOS_FAQ} t={t} card={card} />
            </section>

            <div>
              <span className="block text-[10.5px] font-bold tracking-[1.6px] uppercase mb-2.5" style={{ color: t.accent }}>Read next</span>
              <div className="grid grid-cols-3 max-md:grid-cols-1 gap-3">
                {READ_MORE.map(([href, title, desc]) => (
                  <a key={href} href={href} className="flex flex-col gap-1 px-4 py-3.5 rounded-xl no-underline" style={card}>
                    <b className="text-[14px] leading-[1.35] font-semibold" style={{ color: t.text }}>{title}</b>
                    <i className="not-italic text-[12px]" style={{ color: t.muted }}>{desc}</i>
                  </a>
                ))}
              </div>
            </div>
          </article>
        </div>

        <div className="flex items-center gap-3 rounded-[14px] px-[18px] py-4 max-md:flex-col max-md:items-stretch" style={card}>
          <span className="flex flex-col gap-0.5">
            <b className="text-[15px]" style={{ color: t.text }}>Based in Lagos too?</b>
            <span className="text-[13px]" style={{ color: t.soft }}>Message us on WhatsApp — same city, same hours.</span>
          </span>
          <a href={waLink || '/contact'} target={waLink ? '_blank' : undefined} rel={waLink ? 'noopener noreferrer' : undefined} className="ml-auto max-md:ml-0 max-md:w-full inline-flex items-center justify-center rounded-[10px] px-4 py-2.5 text-[13.5px] font-semibold no-underline text-white transition-transform duration-200 hover:-translate-y-px" style={{ background: t.btnPrimary }}>WhatsApp us</a>
        </div>
      </div>
      <SharedFooter />
    </div>
  );
}

const PG_CSS = `
.pg-stats{display:grid;grid-template-columns:repeat(4,1fr)}
.pg-stt{padding:12px 16px;border-left:1px solid var(--pg-line);display:flex;flex-direction:column;min-width:0}.pg-stt:first-child{border-left:0}
.pg-stt b{font-size:20px;font-weight:800;letter-spacing:-.01em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.pg-stt span{font-size:11px;font-weight:700;letter-spacing:.8px;text-transform:uppercase;margin-top:2px;white-space:nowrap}
.pg-stt i{font-style:normal;font-size:11.5px;margin-top:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
@media (max-width:767px){.pg-stats{grid-template-columns:1fr 1fr}.pg-stt:nth-child(3){border-left:0}.pg-stt:nth-child(n+3){border-top:1px solid var(--pg-line)}.pg-stt b{font-size:17px}}
`;

function Accordion({ items, t, card }) {
  const [open, setOpen] = useState(0);
  return (
    <div className="rounded-[14px] overflow-hidden" style={card}>
      {items.map(([q, a], i) => (
        <div key={q} style={{ borderTop: i ? `1px solid ${t.cardBorder}` : undefined }}>
          <button type="button" onClick={() => setOpen(open === i ? -1 : i)} aria-expanded={open === i} className="w-full flex items-center justify-between gap-2.5 px-[18px] py-3.5 border-0 bg-transparent cursor-pointer text-left">
            <b className="text-[15px] font-semibold" style={{ color: open === i ? t.accent : t.text }}>{q}</b>
            <span className="text-[18px] leading-none shrink-0" style={{ color: t.muted }}>{open === i ? '−' : '+'}</span>
          </button>
          {open === i && <p className="m-0 px-[18px] pb-3.5 text-[14.5px] leading-[1.65]" style={{ color: t.soft }}>{a}</p>}
        </div>
      ))}
    </div>
  );
}
