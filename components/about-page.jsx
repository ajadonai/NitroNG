'use client';
import { useEffect, useState } from 'react';
import { ThemeProvider, useTheme } from './shared-nav';
import SharedNav, { SharedFooter, SharedStyles } from './shared-nav';

export default function AboutView({ stats }) {
  return <ThemeProvider><AboutInner stats={stats} /></ThemeProvider>;
}

const SECTIONS = [
  ['what-we-do', 'What we do'],
  ['why-nitro-exists', 'Why Nitro exists'],
  ['how-we-are-different', 'How we are different'],
  ['company-details', 'Company details'],
];

const DIFFERENT = [
  ['Naira-native', 'No dollar conversion. No exchange rate surprises. Every price you see is in Naira.'],
  ['Never need your password', 'We only use your public profile link. Your accounts stay under your control.'],
  ['Real support', 'Reach us on WhatsApp anytime. We respond in minutes, not "2-3 business days."'],
  ['Multiple quality tiers', 'Budget (no refill), Standard (30-day refill), and Premium (lifetime refill). You choose the quality and price point that fits.'],
];

const DETAILS = [
  ['Registered name', 'The Nitro Nigeria Limited'],
  ['RC number', '9514845', true],
  ['Location', 'Lagos, Nigeria'],
  ['Founded', '2025'],
  ['Contact', 'support@nitro.ng'],
];

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const num = n => (typeof n === 'number' ? n.toLocaleString('en-US') : '—');

function AboutInner({ stats }) {
  const { t } = useTheme();

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

  const since = stats?.since ? new Date(stats.since) : null;
  const facts = [
    [num(stats?.customers), 'Customers', 'verified accounts'],
    [num(stats?.orders), 'Orders placed', since ? `since ${MONTHS[since.getUTCMonth()]} ${since.getUTCFullYear()}` : 'and counting', true],
    [num(stats?.platforms), 'Platforms', typeof stats?.services === 'number' ? `${stats.services} services` : '—'],
    ['RC 9514845', 'Registered', 'The Nitro Nigeria Limited'],
  ];

  const eyebrow = { fontSize: 10.5, fontWeight: 700, letterSpacing: '1.6px', textTransform: 'uppercase', color: t.accent, display: 'block' };
  const card = { background: t.cardBg, border: `1px solid ${t.cardBorder}` };
  const h2 = { color: t.text };

  return (
    <div className="min-h-dvh flex flex-col font-[Plus Jakarta Sans,system-ui,sans-serif] transition-[background] duration-500" style={{ background: t.bg, color: t.text, '--ab-line': t.cardBorder }}>
      <style>{AB_CSS}</style>
      <SharedStyles />
      <SharedNav />
      <div className="flex-1 w-full max-w-[920px] mx-auto px-7 pt-11 pb-14 max-md:px-4 max-md:pt-7 max-md:pb-10 flex flex-col gap-[26px] max-md:gap-5">

        <header className="flex flex-col gap-2.5">
          <span style={eyebrow}>About</span>
          <h1 className="serif m-0 text-[clamp(34px,4.6vw,52px)] font-semibold leading-[1.08] tracking-[-0.01em]" style={{ color: t.text, textWrap: 'balance' }}>Built in Lagos, for Nigeria</h1>
          <p className="m-0 text-[18px] leading-[1.55] max-w-[62ch]" style={{ color: t.soft }}>Nitro is a content promotion platform for Nigerian creators, businesses and marketers. Naira prices, Nigerian banks, real people on WhatsApp.</p>
        </header>

        <div className="ab-stats rounded-[14px]" style={card}>
          {facts.map(([value, label, sub]) => (
            <div key={label} className="ab-stt">
              <b className="m" style={{ color: t.text }}>{value}</b>
              <span style={{ color: t.muted }}>{label}</span>
              <i style={{ color: t.muted }}>{sub}</i>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-[220px_1fr] gap-9 items-start max-md:grid-cols-1 max-md:gap-[18px]">
          <aside className="sticky top-5 flex flex-col gap-0.5 max-md:hidden">
            <span style={{ ...eyebrow, marginBottom: 8 }}>On this page</span>
            {SECTIONS.map(([id, h]) => {
              const on = id === active;
              return (
                <a key={id} href={`#${id}`} className="text-[13px] leading-[1.35] px-2.5 py-1.5 no-underline" style={{ color: on ? t.text : t.muted, borderLeft: `2px solid ${on ? t.accent : t.cardBorder}`, fontWeight: on ? 600 : 400 }}>{h}</a>
              );
            })}
          </aside>
          <details className="md:hidden rounded-xl px-3.5 py-2.5 text-[13px]" style={card}>
            <summary className="font-semibold cursor-pointer" style={{ color: t.text }}>On this page · {SECTIONS.length} sections</summary>
            {SECTIONS.map(([id, h]) => (
              <a key={id} href={`#${id}`} className="block py-1.5 no-underline" style={{ color: t.muted, borderTop: `1px solid ${t.cardBorder}` }}>{h}</a>
            ))}
          </details>

          <article className="flex flex-col gap-[22px] max-w-[66ch] min-w-0">
            <section id="what-we-do" className="scroll-mt-24">
              <h2 className="serif m-0 mb-2 text-[27px] font-semibold tracking-[-0.01em]" style={h2}>What we do</h2>
              <p className="m-0 mb-3 text-[15.5px] leading-[1.7]" style={{ color: t.soft }}>
                We make social media growth simple. Whether you're a creator trying to hit your first 10,000 followers, a business building credibility online, or a marketer managing multiple brands — Nitro handles the numbers so you can focus on your content.
              </p>
              <p className="m-0 text-[15.5px] leading-[1.7]" style={{ color: t.soft }}>
                We offer 140+ service types across 28 platforms including Instagram, TikTok, YouTube, X, Facebook, Telegram, and Spotify. Every service is priced in Naira with no dollar conversion, no hidden fees, and no password required — just your public profile link.
              </p>
            </section>

            <section id="why-nitro-exists" className="scroll-mt-24">
              <h2 className="serif m-0 mb-2 text-[27px] font-semibold tracking-[-0.01em]" style={h2}>Why Nitro exists</h2>
              <p className="m-0 mb-3 text-[15.5px] leading-[1.7]" style={{ color: t.soft }}>
                Most SMM panels are built for a global audience — dollar pricing, international payment gateways that reject Nigerian cards, and support teams in different time zones. We built Nitro because Nigerian creators and businesses deserve a growth tool that works for them.
              </p>
              <p className="m-0 text-[15.5px] leading-[1.7]" style={{ color: t.soft }}>
                That means Naira pricing from day one. Bank transfers, Flutterwave, and crypto for payments. Support that responds in minutes, not days. And a clean, modern dashboard that doesn't feel like it was built in 2015.
              </p>
            </section>

            <section id="how-we-are-different" className="scroll-mt-24">
              <h2 className="serif m-0 mb-2 text-[27px] font-semibold tracking-[-0.01em]" style={h2}>How we are different</h2>
              <div className="grid grid-cols-2 gap-3 max-md:grid-cols-1">
                {DIFFERENT.map(([title, desc]) => (
                  <div key={title} className="flex flex-col rounded-xl px-4 py-3.5" style={card}>
                    <b className="text-[14.5px] font-semibold" style={{ color: t.text }}>{title}</b>
                    <span className="text-[13px] leading-[1.45]" style={{ color: t.muted }}>{desc}</span>
                  </div>
                ))}
              </div>
            </section>

            <section id="company-details" className="scroll-mt-24">
              <h2 className="serif m-0 mb-2 text-[27px] font-semibold tracking-[-0.01em]" style={h2}>Company details</h2>
              <div className="rounded-[14px] overflow-hidden" style={card}>
                {DETAILS.map(([label, value, mono], i) => (
                  <div key={label} className="flex items-center justify-between gap-2.5 px-[18px] py-3.5" style={{ borderTop: i ? `1px solid ${t.cardBorder}` : undefined }}>
                    <span className="text-[14px]" style={{ color: t.muted }}>{label}</span>
                    <b className={`text-[15px] font-semibold text-right${mono ? ' m' : ''}`} style={{ color: t.text }}>{value}</b>
                  </div>
                ))}
              </div>
            </section>
          </article>
        </div>

        <div className="flex items-center gap-3 rounded-[14px] px-[18px] py-4 max-md:flex-col max-md:items-stretch" style={card}>
          <span className="flex flex-col gap-0.5">
            <b className="text-[15px]" style={{ color: t.text }}>Ready to grow your socials?</b>
            <span className="text-[13px]" style={{ color: t.soft }}>Join the thousands of Nigerian creators already on Nitro.</span>
          </span>
          <a href="/signup" className="ml-auto max-md:ml-0 max-md:w-full inline-flex items-center justify-center rounded-[10px] px-4 py-2.5 text-[13.5px] font-semibold no-underline text-white transition-transform duration-200 hover:-translate-y-px" style={{ background: t.btnPrimary }}>Create a free account</a>
        </div>
      </div>
      <SharedFooter />
    </div>
  );
}

const AB_CSS = `
.ab-stats{display:grid;grid-template-columns:repeat(4,1fr)}
.ab-stt{padding:12px 16px;border-left:1px solid var(--ab-line);display:flex;flex-direction:column;min-width:0}.ab-stt:first-child{border-left:0}
.ab-stt b{font-size:20px;font-weight:800;letter-spacing:-.01em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ab-stt span{font-size:11px;font-weight:700;letter-spacing:.8px;text-transform:uppercase;margin-top:2px;white-space:nowrap}
.ab-stt i{font-style:normal;font-size:11.5px;margin-top:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
@media (max-width:767px){.ab-stats{grid-template-columns:1fr 1fr}.ab-stt:nth-child(3){border-left:0}.ab-stt:nth-child(n+3){border-top:1px solid var(--ab-line)}.ab-stt b{font-size:17px}}
`;
