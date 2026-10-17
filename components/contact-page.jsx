'use client';
import { useEffect, useState } from 'react';
import { useT } from "./locale";
import { ThemeProvider, useTheme } from './shared-nav';
import SharedNav, { SharedFooter, SharedStyles } from './shared-nav';
import { SITE } from '../lib/site';
import { WaButton, WhatsAppGlyph } from './wa-button';
import { OffsetIcon } from "./offset-icons";

const WA_FALLBACK = '2347071656156';

const CHECK = <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>;
const MAIL = (size) => <OffsetIcon name="mail" size={size} />;

const SOCIAL_PATHS = {
  Instagram: "M12 2.2c3.2 0 3.6 0 4.9.1 1.2.1 1.8.2 2.2.4.6.2 1 .5 1.4.9.4.4.7.8.9 1.4.2.4.4 1 .4 2.2.1 1.3.1 1.7.1 4.9s0 3.6-.1 4.9c-.1 1.2-.2 1.8-.4 2.2-.2.6-.5 1-.9 1.4-.4.4-.8.7-1.4.9-.4.2-1 .4-2.2.4-1.3.1-1.7.1-4.9.1s-3.6 0-4.9-.1c-1.2-.1-1.8-.2-2.2-.4-.6-.2-1-.5-1.4-.9-.4-.4-.7-.8-.9-1.4-.2-.4-.4-1-.4-2.2C2.2 15.6 2.2 15.2 2.2 12s0-3.6.1-4.9c.1-1.2.2-1.8.4-2.2.2-.6.5-1 .9-1.4.4-.4.8-.7 1.4-.9.4-.2 1-.4 2.2-.4C8.4 2.2 8.8 2.2 12 2.2zm0 5.8a4 4 0 100 8 4 4 0 000-8zm0 6.6a2.6 2.6 0 110-5.2 2.6 2.6 0 010 5.2zm5.1-6.8a.94.94 0 11-1.9 0 .94.94 0 011.9 0z",
  X: "M18.9 1.2h3.7l-8.1 9.2 9.5 12.5h-7.4l-5.8-7.6-6.7 7.6H.4l8.6-9.8L0 1.2h7.6l5.2 6.9 6.1-6.9zm-1.3 19.5h2L6.5 3.2H4.4l13.2 17.5z",
  TikTok: "M16.6 5.8a4.3 4.3 0 01-1-2.6h-3v11.6a2.5 2.5 0 11-1.8-2.4V9.3a5.5 5.5 0 103.5 5.1V8.8a7.2 7.2 0 004.2 1.4V7.2a4.3 4.3 0 01-1.9-1.4z",
};

export default function ContactView() {
  return <ThemeProvider><ContactInner /></ThemeProvider>;
}

/* The page reads in one order: how to reach us, what to have ready, the
   questions that come up most, then who we are. It used to say the hours three
   times, carry three WhatsApp buttons in two colours, and put every block in a
   card of the same weight, which is what made it read as disorganised. */
function Styles() {
  return <style>{`
    .cx{--cx-hair:rgba(139,74,94,.14);--cx-wa-tint:rgba(37,211,102,.13);--cx-wa-glyph:#128c4a}
    .dark .cx{--cx-hair:rgba(232,180,196,.11);--cx-wa-tint:rgba(37,211,102,.14);--cx-wa-glyph:#4ade80}
    .cx-main{width:100%;max-width:768px;margin:0 auto;padding:52px 24px 64px;display:flex;flex-direction:column;gap:44px}
    .cx-eb{font-size:10.5px;font-weight:700;letter-spacing:1.6px;text-transform:uppercase;color:var(--t-accent-ink)}
    .cx-head{display:flex;flex-direction:column;gap:10px}
    .cx-head h1{margin:0;font-size:clamp(38px,5vw,54px);font-weight:600;line-height:1.04;letter-spacing:-.01em;color:var(--t-text);text-wrap:balance}
    .cx-head p{margin:0;font-size:17.5px;line-height:1.55;color:var(--t-soft);max-width:52ch}
    .cx-hours{display:flex;align-items:flex-start;gap:8px;font-size:13px;color:var(--t-muted);margin-top:4px}
    .cx-hours svg{color:var(--t-accent-ink);flex-shrink:0;margin-top:2px}

    .cx-panel{background:var(--t-card-bg);border:1px solid var(--t-card-border);border-radius:16px;overflow:hidden;display:grid;grid-template-columns:1fr 1fr}
    .cx-chan{padding:22px 22px 20px;display:flex;flex-direction:column;gap:6px;min-width:0}
    .cx-chan + .cx-chan{border-inline-start:1px solid var(--cx-hair)}
    .cx-top{display:flex;align-items:center;gap:10px;margin-bottom:6px}
    .cx-tile{width:34px;height:34px;border-radius:10px;display:grid;place-items:center;flex-shrink:0}
    .cx-tile.wa{background:var(--cx-wa-tint);color:var(--cx-wa-glyph)}
    .cx-tile.wa svg{width:18px;height:18px}
    .cx-tile.em{background:var(--t-accent-light);color:var(--t-accent-ink)}
    .cx-top b{font-size:17px;font-weight:600;color:var(--t-text)}
    .cx-tag{margin-inline-start:auto;font-size:10.5px;font-weight:700;letter-spacing:.5px;text-transform:uppercase;color:var(--t-green);background:var(--cx-wa-tint);padding:3px 8px;border-radius:999px}
    .cx-for{font-size:14.5px;font-weight:500;color:var(--t-text)}
    .cx-when{font-size:13px;line-height:1.45;color:var(--t-muted);margin-bottom:14px}
    .cx-chan .wa-btn,.cx-mail{margin-top:auto;width:100%}
    .cx-mail{display:inline-flex;align-items:center;justify-content:center;gap:8px;height:44px;border-radius:12px;border:1px solid var(--t-card-border);color:var(--t-accent-ink);font-size:14px;font-weight:700;text-decoration:none;transition:transform .2s}
    .cx-mail:hover{transform:translateY(-1px)}
    .cx-mail:focus-visible,.cx-chip:focus-visible{outline:2px solid var(--t-accent);outline-offset:2px}

    .cx-prep{grid-column:1/-1;border-top:1px solid var(--cx-hair);background:var(--t-accent-light);padding:16px 22px 18px}
    .cx-prep > span{display:block;font-size:10.5px;font-weight:700;letter-spacing:1.4px;text-transform:uppercase;color:var(--t-muted);margin-bottom:12px}
    .cx-prep ul{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px}
    .cx-prep li{display:grid;grid-template-columns:16px 1fr;gap:8px;align-items:start}
    .cx-prep li svg{color:var(--t-accent-ink);margin-top:2px}
    .cx-prep b{display:block;font-size:13.5px;font-weight:600;line-height:1.3;color:var(--t-text)}
    .cx-prep small{display:block;font-size:12px;line-height:1.35;color:var(--t-muted);margin-top:2px}

    .cx-sec{display:flex;flex-direction:column;gap:6px}
    .cx-sec h2{margin:0;font-size:30px;font-weight:600;line-height:1.1;letter-spacing:-.01em;color:var(--t-text)}
    .cx-sec > p{margin:0 0 12px;font-size:15px;line-height:1.6;color:var(--t-soft)}
    .cx-faq{background:var(--t-card-bg);border:1px solid var(--t-card-border);border-radius:14px;overflow:hidden}
    .cx-q + .cx-q{border-top:1px solid var(--cx-hair)}
    .cx-q button{width:100%;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:15px 18px;background:transparent;border:none;cursor:pointer;text-align:start;font:inherit;font-size:15px;font-weight:600;color:var(--t-text)}
    .cx-q button:focus-visible{outline:2px solid var(--t-accent);outline-offset:-2px}
    .cx-q button svg{color:var(--t-muted);flex-shrink:0;transition:transform .2s}
    .cx-q.open button{color:var(--t-accent-ink)}
    .cx-q.open button svg{transform:rotate(45deg);color:var(--t-accent-ink)}
    .cx-q p{margin:0;padding:0 18px 16px;font-size:14.5px;line-height:1.65;color:var(--t-soft);max-width:64ch}

    .cx-facts{border-top:1px solid var(--cx-hair);padding-top:22px;display:grid;grid-template-columns:1fr 1fr auto;gap:20px 28px;align-items:start}
    .cx-fact > span{display:block;font-size:10.5px;font-weight:700;letter-spacing:1.4px;text-transform:uppercase;color:var(--t-muted);margin-bottom:5px}
    .cx-fact b{font-size:14.5px;font-weight:500;color:var(--t-text)}
    .cx-rc{display:block;margin-top:2px;font-family:'JetBrains Mono',ui-monospace,monospace;font-size:12px;color:var(--t-muted)}
    .cx-chips{display:flex;gap:6px;flex-wrap:wrap}
    .cx-chip{display:inline-flex;align-items:center;gap:6px;height:30px;padding:0 10px;border-radius:9px;border:1px solid var(--t-card-border);background:var(--t-card-bg);color:var(--t-text);font-size:12.5px;font-weight:600;text-decoration:none}
    .cx-safe{grid-column:1/-1;display:flex;gap:8px;align-items:flex-start;font-size:12.5px;line-height:1.5;color:var(--t-muted);margin-top:-4px}
    .cx-safe svg{flex-shrink:0;margin-top:2px;color:var(--t-accent-ink)}

    @media (max-width:767px){
      .cx-main{padding:30px 16px 40px;gap:34px}
      .cx-head p{font-size:16px}
      .cx-panel{grid-template-columns:1fr}
      .cx-chan + .cx-chan{border-inline-start:none;border-top:1px solid var(--cx-hair)}
      .cx-chan{padding:18px 16px}
      .cx-prep{padding:14px 16px 16px}
      .cx-prep ul{grid-template-columns:1fr 1fr;gap:14px 12px}
      .cx-sec h2{font-size:26px}
      .cx-q button{padding:14px 16px}
      .cx-q p{padding:0 16px 14px}
      .cx-facts{grid-template-columns:1fr 1fr}
      .cx-follow{grid-column:1/-1}
    }
    @media (prefers-reduced-motion:reduce){.cx-mail,.cx-q button svg{transition:none}}
  `}</style>;
}

function ContactInner() {
  const tr = useT();
  const { t } = useTheme();

  // Built here rather than at module level so every string goes through tr().
  // They used to sit in module arrays and render raw, which left the
  // questions in English on every locale.
  const questions = [
    [tr("My order is still pending"), tr("Some services start in minutes, others queue at the provider. Give it a couple of hours first. If it is still pending after that, message us with the order ID and we will chase it or cancel it and return the value to your wallet.")],
    [tr("My followers dropped"), tr("Some drop is normal on every follower service. On a Standard or Premium service, refill should replace them within a few days. If it has not, send us the order ID. Budget has no refill, which is shown on the service before you order.")],
    [tr("I want a refund"), tr("If an order did not start, the value goes back to your wallet as credit you can spend right away. Wallet money is credit for Nitro services rather than a balance we pay back out. If a payment went wrong, message us on WhatsApp and we will sort it.")],
    [tr("Do you need my password?"), tr("No. Never. We only need your public profile link or post link. If anyone claiming to be from Nitro asks for your password or a login code, it is not us. Report it to us immediately.")],
  ];
  const ready = [
    [tr("Your order ID"), tr("If it is about an order")],
    [tr("Your account email"), tr("So we can find you")],
    [tr("What you expected"), tr("And what happened instead")],
    [tr("A screenshot"), tr("If something looked wrong")],
  ];
  const [open, setOpen] = useState(0);

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
  const socials = [
    ['Instagram', `https://instagram.com/${ig}`, ig],
    ['X', `https://x.com/${tw}`, tw],
    ...(tk ? [['TikTok', `https://tiktok.com/@${tk}`, tk]] : []),
  ];

  return (
    <div className="cx min-h-dvh flex flex-col transition-[background] duration-500" style={{ background: t.bg, color: t.text }}>
      <SharedStyles />
      <Styles />
      <SharedNav />
      <main className="cx-main flex-1">

        <header className="cx-head">
          <span className="cx-eb">{tr("Contact")}</span>
          <h1 className="serif">{tr("Talk to a person")}</h1>
          <p>{tr("WhatsApp is the fast way. Email is the written way.")}</p>
          <span className="cx-hours">
            <OffsetIcon name="clockPlain" size={15} />
            {tr("We answer every day, quickest between 9am and 10pm Lagos time.")}
          </span>
        </header>

        {/* Both channels in one object, buttons level, so they read as two
            choices. What to have ready sits under the buttons, where it is
            needed, rather than in a section of its own further down. */}
        <div className="cx-panel">
          <div className="cx-chan">
            <div className="cx-top">
              <span className="cx-tile wa">{WhatsAppGlyph}</span>
              <b>WhatsApp</b>
              <span className="cx-tag">{tr("Fastest")}</span>
            </div>
            <span className="cx-for">{tr("Orders, refunds, anything urgent")}</span>
            <span className="cx-when">{tr("Minutes in the day, longer late at night and on Sundays")}</span>
            <WaButton href={waLink} size="lg">{tr("Message us on WhatsApp")}</WaButton>
          </div>
          <div className="cx-chan">
            <div className="cx-top">
              <span className="cx-tile em">{MAIL(17)}</span>
              <b>{tr("Email")}</b>
            </div>
            <span className="cx-for">{tr("Invoices, attachments, a written record")}</span>
            <span className="cx-when">{tr("Usually a few hours rather than minutes")}</span>
            <a href={`mailto:${SITE.email.support}`} className="cx-mail">{MAIL(15)}{SITE.email.support}</a>
          </div>
          <div className="cx-prep">
            <span>{tr("Have these ready")}</span>
            <ul>
              {ready.map(([label, note]) => (
                <li key={label}>{CHECK}<span><b>{label}</b><small>{note}</small></span></li>
              ))}
            </ul>
          </div>
        </div>

        <section className="cx-sec">
          <h2 className="serif">{tr("Before you message")}</h2>
          <p>{tr("Four things come up constantly. If yours is one of them, this is faster than waiting.")}</p>
          <div className="cx-faq">
            {questions.map(([q, a], i) => {
              const isOpen = open === i;
              return (
                <div key={i} className={`cx-q${isOpen ? ' open' : ''}`}>
                  <button type="button" onClick={() => setOpen(isOpen ? null : i)} aria-expanded={isOpen}>
                    {q}
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
                  </button>
                  {isOpen && <p>{a}</p>}
                </div>
              );
            })}
          </div>
        </section>

        <footer className="cx-facts">
          <div className="cx-fact"><span>{tr("Based in")}</span><b>{tr("Lagos, Nigeria")}</b></div>
          <div className="cx-fact"><span>{tr("Company")}</span><b>The Nitro NG</b><span className="cx-rc">RC 9514845</span></div>
          <div className="cx-fact cx-follow"><span>{tr("Follow")}</span>
            <div className="cx-chips">
              {socials.map(([label, href, name]) => (
                <a key={label} href={href} target="_blank" rel="noopener noreferrer" aria-label={label} className="cx-chip">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d={SOCIAL_PATHS[label]} /></svg>
                  {name}
                </a>
              ))}
            </div>
          </div>
          <span className="cx-safe">
            <OffsetIcon name="shield" size={14} />
            {tr("Social accounts are for general questions. Never send order, account or payment details there.")}
          </span>
        </footer>

      </main>
      <SharedFooter />
    </div>
  );
}

