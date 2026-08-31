'use client';
import { useState, useEffect } from 'react';
import { ThemeProvider, useTheme } from './shared-nav';
import SharedNav, { SharedFooter, SharedStyles } from './shared-nav';

export default function ReviewsView() {
  return <ThemeProvider><ReviewsInner /></ThemeProvider>;
}

const SECTIONS = [
  ['what-works', 'What works', 'What people tell us works'],
  ['complaints', 'What people complain about', 'What people complain about'],
  ['refills', 'How refills behave', 'How refills actually behave'],
  ['weak', 'Where we are weak', 'Where we are honestly still weak'],
];

const WORKS = [
  ['The wallet system', 'Fund once, then order without touching a payment page again. People who place a lot of small orders notice this most.'],
  ['Paying with what they already have', 'Payments run through Flutterwave, so Opay, PalmPay, Kuda, Moniepoint, any Nigerian bank card or transfer all work. Everything is in Naira. This is the most common piece of positive feedback we get, mostly from people who spent months unable to check out on foreign panels.'],
  ['WhatsApp support', 'No ticket queue. You message a real line and a person answers, usually within minutes during Lagos hours. This is the thing that most changes how people feel about us after something goes wrong.'],
  ['The catalogue being small', 'We list services in the hundreds rather than thousands, because we test services before listing them and pull the ones that degrade. Customers who came from panels with fifteen thousand listings tell us it is a relief not to be guessing which entries are dead.'],
  ['Live order tracking', 'Start count, current count, target, visible in the dashboard while the order runs.'],
];

const COMPLAINTS = [
  ['"My followers dropped."', 'This is the most common one and it is a real property of the product, not a fault we can eliminate. Some accounts in every follower service get removed when a platform runs a purge. What we can control is source quality and refills. Standard services carry refill for 30 days, Premium carries it for the life of the order, on services marked refill included. Budget carries none, which we state on the service before you buy.'],
  ['"The order is still pending."', 'Some services start within minutes. Others queue at the supplier. When an order sits longer than it should, message us with the order ID and we chase the supplier or cancel and return the value to your wallet. The honest fix on our side is better expected time estimates on each service, which we are still improving.'],
  ['"I wanted my money back in my bank account."', 'Order refunds go to your wallet so they are instant. Money you added and never spent can go back to your bank if you ask.'],
  ['"The service I wanted is not listed."', 'A direct consequence of curating. If a service is missing it is usually because it failed testing or the supplier became unreliable. Ask on WhatsApp. Sometimes we can source it, sometimes the honest answer is that we could not find a version that works.'],
];

const REFILLS = [
  ['Budget', 'What arrives is what you keep. Sensible for views, risky for followers.', 'None'],
  ['Standard', 'Drops inside 30 days on a refill included service get replaced.', '30 days'],
  ['Premium', 'Same, with no expiry window, on services marked for it.', 'Life of the order'],
];

function ReviewsInner() {
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
    [stats.orders || '—', 'Orders placed', 'and counting'],
    [stats.users || '—', 'Accounts', 'verified'],
    [stats.deliveryRate != null ? `${stats.deliveryRate}%` : '—', 'Delivered', 'of orders that were not cancelled'],
    [stats.services || '—', 'Services', stats.uniquePlatforms ? `across ${stats.uniquePlatforms} platforms` : '—'],
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
          <span style={eyebrow}>Reviews</span>
          <h1 className="serif m-0 text-[clamp(34px,4.6vw,52px)] font-semibold leading-[1.08] tracking-[-0.01em]" style={{ color: t.text, textWrap: 'balance' }}>What customers say, and what they complain about</h1>
          <p className="m-0 text-[18px] leading-[1.55] max-w-[62ch]" style={{ color: t.soft }}>No star ratings we wrote ourselves. The numbers below come out of our own system, and the complaints are the real ones.</p>
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
            <section id="what-works" className="scroll-mt-24">
              <h2 className="serif m-0 mb-2 text-[27px] font-semibold tracking-[-0.01em]" style={h2}>{SECTIONS[0][2]}</h2>
              <div className="grid grid-cols-2 gap-3 max-md:grid-cols-1">
                {WORKS.map(([title, desc]) => (
                  <div key={title} className="flex flex-col rounded-xl px-4 py-3.5" style={card}>
                    <b className="text-[14.5px] font-semibold" style={{ color: t.text }}>{title}</b>
                    <span className="text-[13px] leading-[1.45]" style={{ color: t.muted }}>{desc}</span>
                  </div>
                ))}
              </div>
            </section>

            <section id="complaints" className="scroll-mt-24">
              <h2 className="serif m-0 mb-2 text-[27px] font-semibold tracking-[-0.01em]" style={h2}>{SECTIONS[1][2]}</h2>
              <Accordion items={COMPLAINTS} t={t} card={card} />
            </section>

            <section id="refills" className="scroll-mt-24">
              <h2 className="serif m-0 mb-2 text-[27px] font-semibold tracking-[-0.01em]" style={h2}>{SECTIONS[2][2]}</h2>
              <div className="rounded-[14px] overflow-hidden" style={card}>
                {REFILLS.map(([tier, meaning, window], i) => (
                  <div key={tier} className="flex items-center justify-between gap-3 px-[18px] py-3.5" style={{ borderTop: i ? `1px solid ${t.cardBorder}` : undefined }}>
                    <span className="flex flex-col min-w-0">
                      <b className="text-[14.5px] font-semibold" style={{ color: t.text }}>{tier}</b>
                      <span className="text-[12.5px] leading-[1.45]" style={{ color: t.muted }}>{meaning}</span>
                    </span>
                    <b className="text-[14px] font-bold whitespace-nowrap" style={{ color: t.text }}>{window}</b>
                  </div>
                ))}
              </div>
            </section>

            <section id={SECTIONS[3][0]} className="scroll-mt-24">
              <h2 className="serif m-0 mb-2 text-[27px] font-semibold tracking-[-0.01em]" style={h2}>{SECTIONS[3][2]}</h2>
              <p className="text-[15.5px] leading-[1.7] m-0" style={{ color: t.soft }}>We launched recently. We do not have five years of history and we are not going to pretend otherwise.</p>
              <p className="text-[15.5px] leading-[1.7] mt-3 mb-0" style={{ color: t.soft }}>Our third-party review footprint is thin. Our catalogue is smaller than the big panels. Our delivery estimates on individual services need work. And support, while fast, is a small team, so at 3am on a Sunday you may be waiting.</p>
              <p className="text-[15.5px] leading-[1.7] mt-3 mb-0" style={{ color: t.soft }}>Do not decide from this page — we wrote it, so it is not evidence. Deposit ₦1,000, which is our minimum and deliberately low for exactly this reason, and buy one small order. Watch whether it starts, whether the tracker matches your real count, and how fast WhatsApp answers. That tells you more in an afternoon than any review page.</p>
            </section>
          </article>
        </div>

        <div className="flex items-center gap-3 rounded-[14px] px-[18px] py-4 max-md:flex-col max-md:items-stretch" style={card}>
          <span className="flex flex-col gap-0.5">
            <b className="text-[15px]" style={{ color: t.text }}>Something we got wrong?</b>
            <span className="text-[13px]" style={{ color: t.soft }}>Tell us on WhatsApp. Complaints on this page came from customers.</span>
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

const PG_CSS = `
.pg-stats{display:grid;grid-template-columns:repeat(4,1fr)}
.pg-stt{padding:12px 16px;border-left:1px solid var(--pg-line);display:flex;flex-direction:column;min-width:0}.pg-stt:first-child{border-left:0}
.pg-stt b{font-size:20px;font-weight:800;letter-spacing:-.01em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.pg-stt span{font-size:11px;font-weight:700;letter-spacing:.8px;text-transform:uppercase;margin-top:2px;white-space:nowrap}
.pg-stt i{font-style:normal;font-size:11.5px;margin-top:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
@media (max-width:767px){.pg-stats{grid-template-columns:1fr 1fr}.pg-stt:nth-child(3){border-left:0}.pg-stt:nth-child(n+3){border-top:1px solid var(--pg-line)}.pg-stt b{font-size:17px}}
`;
