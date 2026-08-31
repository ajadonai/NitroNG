'use client';
import { useState, useEffect } from 'react';
import { ThemeProvider, useTheme } from './shared-nav';
import SharedNav, { SharedFooter, SharedStyles } from './shared-nav';

export default function QualityView({ serviceCount, platformCount }) {
  return <ThemeProvider><QualityInner serviceCount={serviceCount} platformCount={platformCount} /></ThemeProvider>;
}

const SECTIONS = [
  ['why-drops', 'Why drop rates are high', 'Why most panels have high drop rates'],
  ['how-we-keep-drops-low', 'How we keep them low', 'How we keep drops low'],
  ['three-tiers', 'Three tiers', 'Three tiers of protection'],
  ['questions', 'Questions', 'Common questions'],
];

const WHY = [
  '"Drops" happen when followers, likes, or views disappear after delivery. On most SMM panels, this is common because they list services from dozens of providers without testing them. You place an order, the numbers go up, and a week later half of it is gone.',
  "The root cause is simple: most panels are resellers with no quality control. They connect to a provider API, list everything available, and let customers sort through the mess. When a service starts dropping, they don't notice — you do.",
  "The result? You spend hours testing services yourself, wasting money on bad ones, and still never knowing which provider is reliable this week. It's a guessing game.",
  'Nigerian creators and businesses waste real money on this cycle. At Nitro, we decided to solve it at the source instead of passing the problem to you.',
];

const PRACTICES = [
  ['We test before you see it', 'Every service is tested internally before it goes live. If it drops heavily in testing, it never reaches customers.'],
  ['We monitor after delivery', 'We track delivery quality across providers. When a service starts underperforming, we change provider or take it offline.'],
  ['We limit our catalogue', 'Hundreds of services that work, not thousands that might. A smaller, curated list beats a massive unreliable one.'],
  ['We pick providers carefully', 'A shortlist of vetted providers. Not the cheapest — the most consistent.'],
  ['We offer refill protection', 'No service is drop-proof, so Standard and Premium top dropped numbers back up at no cost.'],
  ['We respond when things go wrong', 'Notice unusual drops and WhatsApp support investigates. A real person, not a ticket system.'],
];

const TIERS = [
  ['Budget', 'No refill', 'Lowest price, no refill. Good for testing or one-time boosts where you just need the initial push.'],
  ['Standard', '30 days', '30-day refill guarantee. If numbers drop within 30 days, we top them back up automatically. Best balance of price and reliability.'],
  ['Premium', 'Life of the order', 'Lifetime refill. Numbers drop at any point — we refill them, no questions asked. For accounts where every follower counts.'],
];

function QualityInner({ serviceCount, platformCount }) {
  const { t } = useTheme();

  const faq = [
    ['What is a "drop" in SMM?', 'A drop is when followers, likes, or views you received through a promotion service disappear after some time. This usually happens because the accounts providing the engagement get flagged or removed by the platform.'],
    ['Can any panel guarantee zero drops?', 'No — anyone who claims 0% drop rate is not being honest. Social platforms constantly remove suspicious accounts. The difference is how a panel handles it: low drop rates from careful curation, plus automatic refill when drops do happen.'],
    ['How is Nitro different from other SMM panels?', 'Most panels list every service their providers offer without testing. Nitro curates — we test services internally, monitor delivery quality, and remove underperforming providers. You only see services that have passed our quality checks.'],
    ['Do I need to track my own drop rates?', "No. If you use a Standard or Premium tier service, refills happen automatically when we detect drops. You don't need to open a ticket or contact support — the system handles it."],
    ['What platforms does Nitro support?', `Instagram, TikTok, YouTube, X (Twitter), Facebook, Telegram, Spotify, Snapchat, LinkedIn, Twitch, Discord, and more — ${serviceCount || '35'}+ service categories across ${platformCount || '10'}+ platforms.`],
  ];

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

  const eyebrow = { fontSize: 10.5, fontWeight: 700, letterSpacing: '1.6px', textTransform: 'uppercase', color: t.accent, display: 'block' };
  const card = { background: t.cardBg, border: `1px solid ${t.cardBorder}` };
  const h2 = { color: t.text };

  return (
    <div className="min-h-dvh flex flex-col font-[Plus Jakarta Sans,system-ui,sans-serif] transition-[background] duration-500" style={{ background: t.bg, color: t.text }}>
      <SharedStyles />
      <SharedNav action="login" />
      <div className="flex-1 w-full max-w-[920px] mx-auto px-7 pt-11 pb-14 max-md:px-4 max-md:pt-7 max-md:pb-10 flex flex-col gap-[26px] max-md:gap-5">

        <header className="flex flex-col gap-2.5">
          <span style={eyebrow}>Service quality</span>
          <h1 className="serif m-0 text-[clamp(34px,4.6vw,52px)] font-semibold leading-[1.08] tracking-[-0.01em]" style={{ color: t.text, textWrap: 'balance' }}>Every service, tested before you see it</h1>
          <p className="m-0 text-[18px] leading-[1.55] max-w-[62ch]" style={{ color: t.soft }}>Drop rates are the thing nobody wants to talk about. Here is what we do about them, and what we cannot promise.</p>
        </header>

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
            <section id="why-drops" className="scroll-mt-24">
              <h2 className="serif m-0 mb-2 text-[27px] font-semibold tracking-[-0.01em]" style={h2}>{SECTIONS[0][2]}</h2>
              {WHY.map((p, i) => (
                <p key={i} className={`m-0 text-[15.5px] leading-[1.7]${i < WHY.length - 1 ? ' mb-3' : ''}`} style={{ color: t.soft }}>{p}</p>
              ))}
            </section>

            <section id="how-we-keep-drops-low" className="scroll-mt-24">
              <h2 className="serif m-0 mb-2 text-[27px] font-semibold tracking-[-0.01em]" style={h2}>{SECTIONS[1][2]}</h2>
              <div className="grid grid-cols-2 gap-3 max-md:grid-cols-1">
                {PRACTICES.map(([title, desc]) => (
                  <div key={title} className="flex flex-col rounded-xl px-4 py-3.5" style={card}>
                    <b className="text-[14.5px] font-semibold" style={{ color: t.text }}>{title}</b>
                    <span className="text-[13px] leading-[1.45]" style={{ color: t.muted }}>{desc}</span>
                  </div>
                ))}
              </div>
            </section>

            <section id="three-tiers" className="scroll-mt-24">
              <h2 className="serif m-0 mb-2 text-[27px] font-semibold tracking-[-0.01em]" style={h2}>{SECTIONS[2][2]}</h2>
              <div className="grid grid-cols-3 gap-3 max-md:grid-cols-1">
                {TIERS.map(([tier, window, desc]) => (
                  <div key={tier} className="flex flex-col gap-[3px] rounded-xl px-4 py-3.5" style={{ background: t.cardBg, border: `1px solid ${tier === 'Standard' ? t.accent : t.cardBorder}` }}>
                    <span style={{ ...eyebrow, letterSpacing: '1.2px' }}>{tier}</span>
                    <b className="text-[15px] font-semibold" style={{ color: t.text }}>{window}</b>
                    <span className="text-[12.5px] leading-[1.45]" style={{ color: t.muted }}>{desc}</span>
                  </div>
                ))}
              </div>
            </section>

            <section id="questions" className="scroll-mt-24">
              <h2 className="serif m-0 mb-2 text-[27px] font-semibold tracking-[-0.01em]" style={h2}>{SECTIONS[3][2]}</h2>
              <Accordion items={faq} t={t} card={card} />
            </section>
          </article>
        </div>

        <div className="flex items-center gap-3 rounded-[14px] px-[18px] py-4 max-md:flex-col max-md:items-stretch" style={card}>
          <span className="flex flex-col gap-0.5">
            <b className="text-[15px]" style={{ color: t.text }}>Seeing drops on an order?</b>
            <span className="text-[13px]" style={{ color: t.soft }}>Send the order ID on WhatsApp and we will look at it.</span>
          </span>
          <a href={waLink || '/contact'} target={waLink ? '_blank' : undefined} rel={waLink ? 'noopener noreferrer' : undefined} className="ml-auto max-md:ml-0 max-md:w-full inline-flex items-center justify-center rounded-[10px] px-4 py-2.5 text-[13.5px] font-semibold no-underline text-white transition-transform duration-200 hover:-translate-y-px" style={{ background: t.btnPrimary }}>WhatsApp us</a>
        </div>
      </div>
      <SharedFooter />
    </div>
  );
}

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
