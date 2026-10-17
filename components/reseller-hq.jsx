'use client';
// Reseller HQ: one page in two states.
//
// A prospect on /resellers sees what they get, the two catalogues, the API in
// one card, how to join over WhatsApp, and the honest bit. A member on the
// dashboard tab sees their key, a quick start, their catalogue, their rates and
// the questions that matter. Joining is a WhatsApp message and a switch on our
// side; the key appears here and in Settings once approved. No child panel.
import { useEffect, useState } from 'react';
import { RailSec, RailCard, RailRow, RailLink } from "./rail";
import { Bone } from "./skeleton";
import { ThemeProvider, useTheme } from './shared-nav';
import SharedNav, { SharedFooter, SharedStyles } from './shared-nav';
import { useToast } from './toast';
import { useConfirm } from './confirm-dialog';
import { copyText } from '@/lib/clipboard';
import { useMoney, useT } from "./locale";
import { msg } from "../lib/i18n";
import { WaButton } from "./wa-button";
import { OffsetIcon } from "./offset-icons";

const FALLBACK_WA = '2347071656156';
// A name draws from the offset-print set; the plain controls (copy, show,
// rotate, arrow) stay as the simple strokes they are.
const I = (d, s = 14, w = 2) => typeof d === "string"
  ? <OffsetIcon name={d} size={s} />
  : <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{d}</svg>;
const P = {
  chk: <path d="M20 6 9 17l-5-5"/>,
  key: "key",
  copy: <><rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 012-2h10"/></>,
  eye: <><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z"/><circle cx="12" cy="12" r="3"/></>,
  rot: <><path d="M21 12a9 9 0 11-3-6.7"/><path d="M21 3v6h-6"/></>,
  arrow: <path d="M5 12h14M13 6l6 6-6 6"/>,
  layers: "layers",
  globe: "globe",
  bolt: "bolt",
  chart: "bars",
  refund: "refresh",
  clock: "clockPlain",
  naira: "naira",
  book: "book",
};

const WA_TEXT = "Hi! I'd like wholesale prices on my Nitro account. Here's what my business does:";

function Styles({ dark, t }) {
  const grad = 'linear-gradient(135deg, #c47d8e, #8b5e6b)';
  const bgrad = 'linear-gradient(135deg, #60a5fa, #2563eb)';
  const blue = dark ? '#60a5fa' : '#2563eb';
  const hair = t.cardBorder;
  const panel = t.cardBg;
  const muted = t.textMuted;
  const accentSoft = dark ? 'rgba(196,125,142,.16)' : 'rgba(196,125,142,.12)';
  return (
    <style>{`
      .rhq-hero{position:relative;overflow:hidden;text-align:center;padding:36px 16px 30px}
      .rhq-glow{position:absolute;width:520px;height:520px;border-radius:50%;top:-360px;right:-140px;background:radial-gradient(circle,${accentSoft} 0%,transparent 66%);pointer-events:none}
      .rhq-pill{display:inline-flex;align-items:center;gap:6px;font-size:10.5px;font-weight:800;letter-spacing:1.4px;text-transform:uppercase;border-radius:999px;padding:4px 11px;color:#c47d8e;background:${accentSoft}}
      .rhq-h1{font-weight:800;letter-spacing:-.8px;line-height:1.15;font-size:clamp(26px,5vw,33px);margin:12px 0 8px;color:${t.text}}
      .rhq-lead{font-size:14px;line-height:1.65;color:${muted};margin:0 auto 14px;max-width:52ch}.rhq-lead b{color:${t.textSoft}}
      .rhq-checks{display:flex;flex-wrap:wrap;gap:8px 16px;justify-content:center;font-size:11.5px;color:${muted};margin-bottom:16px}.rhq-checks span{display:inline-flex;align-items:center;gap:5px}.rhq-checks svg{color:#059669}
      .rhq-btn-p{display:inline-flex;align-items:center;justify-content:center;gap:7px;font-size:13px;font-weight:800;padding:11px 18px;border-radius:11px;border:none;cursor:pointer;text-decoration:none;color:#fff;background:${grad};box-shadow:0 5px 16px rgba(196,125,142,.3);font-family:inherit;white-space:nowrap}
      .rhq-btn-p.blue{background:${bgrad};box-shadow:0 5px 16px rgba(37,99,235,.28)}.rhq-btn-p.white{background:#fff;color:#8b5e6b;box-shadow:none}.rhq-btn-p svg{width:15px;height:15px}
      .rhq-btn-g{display:inline-flex;align-items:center;justify-content:center;gap:5px;font-size:12px;font-weight:700;padding:8px 12px;border-radius:11px;border:1px solid ${hair};background:${panel};color:${t.textSoft};cursor:pointer;text-decoration:none;font-family:inherit;white-space:nowrap}
      .rhq-sec-head{display:flex;align-items:center;gap:10px;margin:24px 0 10px}.rhq-sec-label{font-size:10px;font-weight:800;letter-spacing:1.4px;text-transform:uppercase;color:${muted};white-space:nowrap}.rhq-sec-rule{flex:1;height:1px;background:${hair}}.rhq-sec-sub{font-size:10.5px;color:${muted};white-space:nowrap}
      .rhq-feats{display:grid;grid-template-columns:1fr;gap:6px}.rhq-feat{display:flex;gap:12px;padding:12px 13px;border-radius:13px;background:${panel};border:1px solid ${hair};align-items:center}.rhq-feat>span:last-child{display:flex;flex-direction:column;min-width:0}.rhq-feat h4{font-size:13px;font-weight:800;margin:0;color:${t.text}}.rhq-feat p{font-size:11.5px;color:${muted};line-height:1.55;margin:3px 0 0}
      .rhq-feat-ico{width:32px;height:32px;border-radius:10px;display:grid;place-items:center;flex-shrink:0;color:#fff;background:${bgrad}}.rhq-feat-ico.accent{background:${grad}}
      .rhq-grid2{display:grid;grid-template-columns:1fr;gap:8px}
      .rhq-cat{padding:14px;border-radius:16px;background:${panel};border:1px solid ${hair};display:flex;flex-direction:column}.rhq-cat-head{display:flex;gap:10px;align-items:flex-start}.rhq-cat-ico{width:30px;height:30px;border-radius:9px;display:grid;place-items:center;color:#fff;flex-shrink:0;background:${grad}}.rhq-cat-ico.blue{background:${bgrad}}
      .rhq-cat-title{font-size:13.5px;font-weight:800;margin:0;display:flex;align-items:center;gap:6px;flex-wrap:wrap;color:${t.text}}.rhq-cat-tag{font-size:10.5px;color:${muted};margin-top:2px}.rhq-cat-desc{font-size:11.5px;color:${muted};line-height:1.55;margin:10px 0 0}
      .rhq-cat-stats{display:flex;margin-top:12px;padding-top:10px;border-top:1px solid ${hair}}.rhq-cat-stat{flex:1;font-size:9.5px;letter-spacing:.06em;text-transform:uppercase;color:${muted};display:flex;flex-direction:column;gap:2px}.rhq-cat-stat b{font-size:12px;letter-spacing:0;text-transform:none;color:${t.text};font-weight:800}
      .rhq-badge-sm{font-size:9px;font-weight:800;letter-spacing:.8px;padding:2px 7px;border-radius:999px;background:${accentSoft};color:#c47d8e}.rhq-badge-sm.big{font-size:10.5px;padding:5px 11px;align-self:center;white-space:nowrap}
      .rhq-steps{display:grid;grid-template-columns:1fr;border:1px solid ${hair};border-radius:14px;overflow:hidden;background:${panel}}.rhq-step{padding:14px 16px;border-top:1px solid ${hair}}.rhq-step:first-child{border-top:none}.rhq-step-n{font-size:10px;font-weight:800;letter-spacing:1.4px;color:${blue}}.rhq-step h4{font-size:12.5px;font-weight:800;margin:4px 0 0;color:${t.text}}.rhq-step p{font-size:11px;color:${muted};line-height:1.6;margin:4px 0 0}
      .rhq-honest{margin-top:24px;padding:14px 16px;border-radius:14px;background:${panel};border:1px solid ${hair}}.rhq-honest p{font-size:12px;line-height:1.6;color:${t.textSoft};margin:6px 0 0}
      .rhq-closer{margin-top:24px;padding:20px;border-radius:16px;color:#fff;background:${grad};display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap}.rhq-closer h3{font-size:17px;font-weight:800;margin:0}.rhq-closer p{font-size:12px;opacity:.9;margin:4px 0 0}
      .rhq-acts{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}
      /* The hero is centred text, so its action row has to centre too. */
      .rhq-acts.ctr{justify-content:center;align-items:center}
      @media (min-width:768px){.rhq-feats{grid-template-columns:1fr 1fr}.rhq-grid2{grid-template-columns:1fr 1fr}.rhq-steps{grid-template-columns:1fr 1fr 1fr}.rhq-step{border-top:none;border-left:1px solid ${hair}}.rhq-step:first-child{border-left:none}.rhq-hero{padding:44px 24px 40px}}
    `}</style>
  );
}

const SecHead = ({ label, sub }) => <div className="rhq-sec-head"><span className="rhq-sec-label">{label}</span><span className="rhq-sec-rule" /><span className="rhq-sec-sub">{sub}</span></div>;
const Feat = ({ icon, title, body, tone }) => <div className="rhq-feat"><span className={`rhq-feat-ico ${tone || ''}`}>{I(icon, 15)}</span><span><h4>{title}</h4><p>{body}</p></span></div>;
const Steps = ({ items }) => <div className="rhq-steps">{items.map(([t, b], i) => <div key={t} className="rhq-step"><span className="rhq-step-n">{String(i + 1).padStart(2, '0')}</span><h4>{t}</h4><p>{b}</p></div>)}</div>;

function Catalogues() {
  const tr = useT();
  const Cat = ({ icon, tone, title, badge, tag, desc, stats }) => (
    <div className="rhq-cat">
      <div className="rhq-cat-head"><span className={`rhq-cat-ico ${tone}`}>{I(icon, 13)}</span><span><h3 className="rhq-cat-title">{title}{badge && <span className="rhq-badge-sm">{badge}</span>}</h3><div className="rhq-cat-tag">{tag}</div></span></div>
      <p className="rhq-cat-desc">{desc}</p>
      <div className="rhq-cat-stats">{stats.map(([l, v]) => <div key={l} className="rhq-cat-stat">{l}<b>{v}</b></div>)}</div>
    </div>
  );
  return (
    <div className="rhq-grid2">
      <Cat icon={P.globe} tone="blue" title={tr("One catalogue")} tag="Everything our providers can reach"
        desc={tr("Every service Nitro can place, on one list, each on its own refill and speed terms. The same list the site shows, the same IDs, the same prices your account pays.")}
        stats={[['Services', '7,500+'], ['Platforms', '31'], ['Settles in', 'Naira']]} />
      <Cat icon={P.layers} tone="" title={tr("One set of IDs")} tag="Stable, and yours to integrate against"
        desc={tr("A service keeps its ID for as long as we carry it. When a provider drops one it answers “Service discontinued” rather than vanishing, so your panel can tell the difference.")}
        stats={[['ID', 'Permanent'], ['Retired', 'Says so'], ['Order via', 'Site + API']]} />
    </div>
  );
}


const FAQ = [
  [msg('Which services can my key order?'), msg('All of them. Every key sees the same catalogue. There is no per-account list and nothing to be switched on. What changes once you are approved is the price, not the list. An ID we do not carry answers "Incorrect service ID"; one we used to carry answers "Service discontinued".')],
  [msg('Do API orders run gradual delivery?'), msg('No. API orders go at natural speed; you set expectations with your own customers.')],
  [msg('What happens to orders that cannot deliver?'), msg('They refund to your wallet automatically.')],
  [msg('How do I get wholesale?'), msg('Message us on WhatsApp about your business. Once approved, the same key returns wholesale rates; consistent volume earns a personal rate on top.')],
  [msg('Is there a rate limit?'), msg('Sixty requests a minute per key. Normal panel traffic never touches it.')],
];

/* ── Public: /resellers ── */
export default function ResellerHQView() {
  return <ThemeProvider><ProspectInner /></ThemeProvider>;
}

function ProspectInner() {
  const tr = useT();
  const { dark, t } = useTheme();
  const [waNum, setWaNum] = useState(FALLBACK_WA);
  useEffect(() => {
    fetch('/api/settings').then(r => r.ok ? r.json() : {}).then(d => {
      const n = (d.settings?.social_whatsapp_reseller || d.settings?.social_whatsapp_support)?.replace(/\D/g, '');
      if (n) setWaNum(n);
    }).catch(() => {});
  }, []);
  const waLink = `https://wa.me/${waNum}?text=${encodeURIComponent(WA_TEXT)}`;
  const Wa = () => <WaButton href={waLink}>{tr("Message us on WhatsApp")}</WaButton>;
  return (
    <>
      <SharedStyles />
      <Styles dark={dark} t={t} />
      <div className="min-h-dvh flex flex-col" style={{ background: t.bg, color: t.text }}>
        <SharedNav />
        <main className="flex-1 w-full max-w-[960px] mx-auto px-4 sm:px-6 pb-16">
          <div className="rhq-hero"><div className="rhq-glow" /><span className="rhq-pill">{tr("Reseller HQ")}</span><h1 className="rhq-h1">{tr("Build your business on Nitro")}</h1><p className="rhq-lead">{tr("Every account gets an")} <b>{tr("API key")}</b> {tr("and the same catalogue at retail, today. Message us on WhatsApp and we switch your account to")} <b>wholesale</b>.</p><div className="rhq-checks"><span>{I(P.chk, 12, 2.5)}{tr("Wholesale on the whole catalogue")}</span><span>{I(P.chk, 12, 2.5)}{tr("A key for every account, in Settings")}</span><span>{I(P.chk, 12, 2.5)}{tr("Everything settles in naira")}</span></div>
            {/* The docs were reachable only from inside the dashboard, so a
                visitor deciding whether to build on the API had no way to read
                it first — on the one public page whose whole job is to convince
                them to. Same treatment the member view gives it. */}
            <div className="rhq-acts ctr"><Wa /><a href="/resellers/docs" className="rhq-btn-p blue">{I(P.book, 13)} {tr("Read the API docs")}</a></div>
          </div>
          <SecHead label={tr("What you get")} sub={tr("The same shop, lower prices")} />
          <div className="rhq-feats">
            <Feat icon={P.naira} tone="accent" title={tr("Naira in, naira out")} body={tr("Opay, PalmPay, Kuda or bank transfer. No dollar cards, no FX to watch.")} />
            <Feat icon={P.layers} tone="accent" title={tr("A catalogue built for choosing")} body={tr("Quality grades, refill terms and speed on every row before you order.")} />
            <Feat icon={P.bolt} title={tr("Full speed, always")} body={tr("API orders never enter the gradual delivery queue. They hit providers at natural speed.")} />
            <Feat icon={P.chart} title={tr("Reseller rates")} body={tr("Below retail on every order, and a personal rate on top once your volume is consistent.")} />
            <Feat icon={P.refund} title={tr("Auto refunds")} body={tr("Anything we can't deliver refunds to your wallet automatically. Never out of pocket.")} />
            <Feat icon={P.clock} title={tr("Live tracking")} body={tr("Start count, remains and status on every order, pollable so your panel can show it.")} />
          </div>
          <SecHead label={tr("The catalogue")} sub={tr("One list, every key, every platform")} />
          <Catalogues full={false} waLink={waLink} />
          <SecHead label={tr("How to join")} sub={tr("Three steps, no forms")} />
          <Steps items={[['Grab your key in Settings', 'Every verified account has one. Point your panel at nitro.ng/api/v2 and order the whole catalogue at the price you already see.'], ['Message us for wholesale', 'Tell us about your business: your panel, your clients, or the volume you push. The list does not change. The same key simply starts returning lower rates.'], ['Order like you always did', 'Same order page, same wallet, same history. Only the price changes.']]} />
          <div className="rhq-honest"><span className="rhq-sec-label">{tr("The honest bit")}</span><p>{tr("Reseller pricing replaces retail perks: loyalty discounts, promo codes and Nitro Points do not stack on top. Wholesale is the deal. Full-catalogue services carry the provider's own terms, shown on every row.")}</p></div>
          <div className="rhq-closer"><div><h3>{tr("Start where you are.")}</h3><p>{tr("Your key is already in Settings. Wholesale is one message away.")}</p></div><div className="rhq-acts" style={{ marginTop: 0 }}><a href="/resellers/docs" className="rhq-btn-p white">{tr("Read the API docs")}</a><Wa /></div></div>
        </main>
        <SharedFooter />
      </div>
    </>
  );
}

/* ── Member: the dashboard tab ── */

/* The member view in the offset print (approved 17 Oct 2026, mockup "Nitro API
   and Blog"). The key is the hero: a dark card with the key in its own slot.
   The page is named what the sidebar names it, API access until wholesale is
   switched on and Reseller HQ after. Its own sheet; the prospect page above
   keeps .rhq-*. Logical properties: this sheet does not go through the RTL
   build plugin. */
const PAT_CODE = `url("data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96" fill="none" stroke="white" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M16 12c-4 0-4 3-4 6s0 6-4 6c4 0 4 3 4 6s0 6 4 6"/><path d="M58 18l-6 6 6 6M70 18l6 6-6 6M66 14l-6 20"/><path d="M22 62h12M22 68h20"/><path d="M80 60c4 0 4 3 4 6s0 6 4 6c-4 0-4 3-4 6s0 6-4 6"/></svg>')}")`;
const RK_CSS = `
.rk{display:grid;grid-template-columns:minmax(0,1fr);grid-auto-rows:max-content;align-content:start;gap:14px}
.rk-head{display:flex;align-items:flex-end;justify-content:space-between;gap:12px;flex-wrap:wrap}
.rk-key{position:relative;overflow:hidden;isolation:isolate;border-radius:20px;color:#f6eef2;padding:20px 22px;background:radial-gradient(70% 120% at 100% 0%,rgba(196,125,142,.4),transparent 62%),linear-gradient(150deg,#1f121a 0%,#2e1b26 55%,#4a2a3a 100%);box-shadow:3px 3px 0 #120a10}
.dark .rk-key{box-shadow:3px 3px 0 #3a2230}
.rk-key::before,.rk-close::before{content:"";position:absolute;inset:-96px 0 0 -96px;z-index:-1;background-image:${PAT_CODE};background-size:96px 96px;opacity:.09;animation:rkDrift 44s linear infinite}
@keyframes rkDrift{to{transform:translate(96px,96px)}}
.rk-top{display:flex;align-items:center;gap:10px}
.rk-glass{background:rgba(255,255,255,.1);box-shadow:inset 0 0 0 1px rgba(255,255,255,.2),2px 2px 0 rgba(0,0,0,.35)}
.rk-kt{width:36px;height:36px;border-radius:12px;display:grid;place-items:center;flex-shrink:0;color:#f3c5d1}
.rk-kt .ic-off{opacity:.3}
.rk-eb{font-size:10.5px;font-weight:700;letter-spacing:1.6px;text-transform:uppercase;color:rgba(246,238,242,.7)}
.rk-live{margin-inline-start:auto;display:inline-flex;align-items:center;gap:7px;font-size:12px;font-weight:650;color:#9ff0c9}
.rk-live i{width:8px;height:8px;border-radius:50%;background:#34d399;box-shadow:0 0 0 4px rgba(52,211,153,.18)}
.rk-slot{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-top:16px}
.rk-code{flex:1;min-width:0;height:48px;display:flex;align-items:center;padding-inline:16px;border-radius:13px;font-size:16px;font-weight:600;letter-spacing:.02em;color:#fff;background:rgba(0,0,0,.32);box-shadow:inset 0 0 0 1px rgba(255,255,255,.1),inset 2px 2px 0 rgba(0,0,0,.25);white-space:nowrap;overflow:hidden}
.rk-code em{font-style:normal;margin-inline:6px;letter-spacing:.1em;color:rgba(255,255,255,.4)}
.rk-cur{display:inline-block;width:9px;height:19px;margin-inline-start:6px;flex-shrink:0;background:#f3c5d1;animation:rkBlink 1.1s steps(1) infinite}
@keyframes rkBlink{50%{opacity:0}}
.rk-ka{height:40px;display:inline-flex;align-items:center;gap:7px;padding-inline:14px;border:0;border-radius:12px;font:inherit;font-size:13px;font-weight:650;color:#fff;cursor:pointer;transition:transform .15s}
.rk-ka:hover:not(:disabled){transform:translateY(-1px)}
.rk-ka:disabled{opacity:.5;cursor:default}
.rk-ka:focus-visible,.rk-chip:focus-visible{outline:2px solid #f3c5d1;outline-offset:2px}
.rk-meta{display:flex;flex-wrap:wrap;gap:8px;margin-top:14px}
.rk-chip{display:inline-flex;align-items:center;gap:8px;height:30px;padding-inline:11px;border:0;border-radius:999px;font:inherit;font-size:12px;font-weight:600;color:rgba(246,238,242,.84);background:rgba(255,255,255,.07);box-shadow:inset 0 0 0 1px rgba(255,255,255,.14)}
button.rk-chip{cursor:pointer}
.rk-chip b{font-size:12px;font-weight:600;color:#fff}
.rk-chip svg{color:rgba(246,238,242,.6)}
.rk-card{border-radius:18px;background:var(--t-card-bg);box-shadow:inset 0 0 0 1px var(--t-card-border),2px 2px 0 #efc4cf}
.dark .rk-card{box-shadow:inset 0 0 0 1px var(--t-card-border),2px 2px 0 #5e3242}
.rk-ch{display:flex;align-items:center;gap:10px;padding:14px 18px;border-bottom:1px solid var(--t-card-border)}
.rk-ch b{font-size:13.5px;font-weight:700;color:var(--t-text)}
.rk-ch small{margin-inline-start:auto;font-size:12px;color:var(--t-text-muted)}
.rk-ws{display:flex;align-items:center;gap:14px;padding:16px 18px}
.rk-ws .ic-tile{width:30px;height:30px}
.rk-ws .tx{flex:1;min-width:0}
.rk-ws .tx b{display:block;font-size:14.5px;font-weight:700;color:var(--t-text)}
.rk-ws .tx span{display:block;margin-top:3px;font-size:13px;line-height:1.5;color:var(--t-text-soft)}
.rk-stats{display:grid;grid-template-columns:repeat(4,minmax(0,1fr))}
.rk-st{display:flex;flex-direction:column;gap:3px;min-width:0;padding:14px 16px;border-inline-start:1px solid var(--t-card-border)}
.rk-st:first-child{border-inline-start:0}
.rk-st span{font-size:10px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:var(--t-text-muted)}
.rk-st b{font-size:19px;font-weight:800;letter-spacing:-.01em;color:var(--t-text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.rk-st b.ok{color:var(--t-green)}
.rk-st i{font-style:normal;font-size:11.5px;color:var(--t-text-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.rk-qs{display:grid;grid-template-columns:repeat(3,minmax(0,1fr))}
.rk-q{display:flex;flex-direction:column;gap:6px;min-width:0;padding:16px 18px 18px;border-inline-start:1px solid var(--t-card-border)}
.rk-q:first-child{border-inline-start:0}
.rk-n{width:26px;height:26px;border-radius:50%;display:grid;place-items:center;font-size:12px;font-weight:800;color:#fff;background:#c47d8e;box-shadow:1.5px 1.5px 0 #8b4a5e}
.rk-q b{margin-top:4px;font-size:14px;font-weight:700;color:var(--t-text)}
.rk-q p{margin:0;font-size:12.5px;line-height:1.5;color:var(--t-text-soft)}
.rk-snip{margin:6px 0 0;padding:9px 11px;border-radius:10px;font-size:11.5px;line-height:1.6;color:#f3e6ec;background:#241621;box-shadow:inset 0 0 0 1px rgba(255,255,255,.06);overflow-x:auto;white-space:pre}
.rk-snip .k{color:#f3a9bd}
.rk-snip .v{color:#9ff0c9}
.rk-snip .c{color:rgba(243,230,236,.45)}
.rk-acts{display:flex;flex-wrap:wrap;gap:10px}
.rk-cats{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}
.rk-cat{display:flex;flex-direction:column;gap:8px;padding:16px 18px}
.rk-chd{display:flex;align-items:center;gap:10px}
.rk-chd .ic-tile{width:30px;height:30px}
.rk-chd b{display:block;font-size:14px;font-weight:700;color:var(--t-text)}
.rk-chd small{display:block;font-size:11.5px;color:var(--t-text-muted)}
.rk-cat p{margin:0;font-size:12.5px;line-height:1.55;color:var(--t-text-soft)}
.rk-cst{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin-top:6px;padding-top:12px;border-top:1px solid var(--t-card-border)}
.rk-cst span{display:block;font-size:9.5px;font-weight:700;letter-spacing:.9px;text-transform:uppercase;color:var(--t-text-muted)}
.rk-cst b{display:block;margin-top:2px;font-size:14px;font-weight:700;color:var(--t-text)}
.rk-rate{display:flex;align-items:center;gap:12px;padding:12px 18px;border-top:1px solid var(--t-card-border);font-size:13.5px;color:var(--t-text)}
.rk-ch + .rk-rate{border-top:0}
.rk-rate .nm{flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.rk-rate s{font-size:12px;font-weight:600;color:var(--t-text-muted)}
.rk-rate b{font-size:14px;font-weight:800}
.rk-save{font-size:11px;font-weight:700;color:var(--t-green)}
.rk-fq{border-top:1px solid var(--t-card-border)}
.rk-ch + .rk-fq{border-top:0}
.rk-fq summary{display:flex;align-items:center;gap:12px;padding:13px 18px;font-size:13.5px;font-weight:650;color:var(--t-text);cursor:pointer;list-style:none}
.rk-fq summary::-webkit-details-marker{display:none}
.rk-fq summary svg{margin-inline-start:auto;flex-shrink:0;color:var(--t-text-muted);transition:transform .2s}
.rk-fq[open] summary svg{transform:rotate(180deg);color:var(--t-accent-ink)}
.rk-fq p{margin:0;padding:0 18px 14px;font-size:13px;line-height:1.6;color:var(--t-text-soft)}
.rk-close{position:relative;overflow:hidden;isolation:isolate;border-radius:20px;color:#fff;padding:20px 22px;display:flex;align-items:center;justify-content:space-between;gap:14px;flex-wrap:wrap;background:radial-gradient(70% 120% at 100% 0%,rgba(255,220,230,.4),transparent 60%),linear-gradient(150deg,#8b4a5e 0%,#b46a80 60%,#d08ea0 100%);box-shadow:3px 3px 0 #5a2a3a}
.rk-close::before{opacity:.1}
.rk-close .t b{display:block;font-size:26px;font-weight:700;line-height:1.05}
.rk-close .t span{display:block;margin-top:4px;font-size:13px;opacity:.9}
.rk-white{height:42px;display:inline-flex;align-items:center;gap:8px;padding-inline:18px;border-radius:999px;font-size:13.5px;font-weight:700;color:#3a1828;background:#fff;box-shadow:2.5px 2.5px 0 rgba(0,0,0,.35);text-decoration:none;white-space:nowrap}
.rk-gh{display:block;background:rgba(255,255,255,.12)}
.rk-skkey{border-radius:20px;padding:20px 22px;background:#2a1a24;box-shadow:3px 3px 0 #120a10}
@media (max-width:767px){
  .rk-key{padding:18px 16px}
  .rk-code{flex-basis:100%;height:46px;font-size:14px}
  .rk-ka{flex:1;justify-content:center}
  .rk-ws{flex-direction:column;align-items:stretch}
  .rk-stats{grid-template-columns:repeat(2,minmax(0,1fr))}
  .rk-st:nth-child(3){border-inline-start:0}
  .rk-st:nth-child(n+3){border-top:1px solid var(--t-card-border)}
  .rk-qs{grid-template-columns:minmax(0,1fr)}
  .rk-q{border-inline-start:0;border-top:1px solid var(--t-card-border)}
  .rk-q:first-child{border-top:0}
  .rk-cats{grid-template-columns:minmax(0,1fr)}
  .rk-ch,.rk-rate,.rk-fq summary{padding-inline:14px}
  .rk-fq p{padding-inline:14px}
  .rk-skkey{padding:18px 16px}
}
@media (prefers-reduced-motion:reduce){.rk-key::before,.rk-close::before,.rk-cur{animation:none}}
`;

const RK_CHEV = <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>;
const RK_TICK = <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5" /></svg>;

// Shaped like the page it stands in for, block for block, so nothing moves when
// the key lands.
function ResellerHQSkeleton({ dark }) {
  const gh = (w, h, r, style) => <span className="rk-gh" style={{ width: w, height: h, borderRadius: r, ...style }} />;
  return (
    <div className="rk" aria-busy="true">
      <style>{RK_CSS}</style>
      <div className="rk-head"><div><Bone dark={dark} w={150} h={30} r={8} /><Bone dark={dark} w={260} h={12} style={{ marginTop: 10 }} /></div><Bone dark={dark} w={130} h={40} r={999} /></div>
      <div className="rk-skkey">
        <div className="flex items-center gap-2.5">{gh(36, 36, 12)}{gh(110, 10, 5)}</div>
        <div className="flex flex-wrap gap-2.5 mt-4">{gh('100%', 48, 13, { flex: '1 1 260px' })}{gh(84, 40, 12)}{gh(84, 40, 12)}{gh(92, 40, 12)}</div>
        <div className="flex flex-wrap gap-2 mt-3.5">{gh(230, 30, 999)}{gh(150, 30, 999)}{gh(220, 30, 999)}</div>
      </div>
      <div className="rk-card rk-ws"><Bone dark={dark} w={30} h={30} r={10} /><span className="tx"><Bone dark={dark} w={200} h={14} /><Bone dark={dark} w="90%" h={11} style={{ marginTop: 8 }} /></span><Bone dark={dark} w={210} h={42} r={999} /></div>
      <div className="rk-card">
        <div className="rk-ch"><Bone dark={dark} w={100} h={12} /><span className="ms-auto"><Bone dark={dark} w={170} h={10} /></span></div>
        <div className="rk-qs">{[0, 1, 2].map(i => <div key={i} className="rk-q"><Bone dark={dark} w={26} h={26} r={999} /><Bone dark={dark} w="70%" h={13} style={{ marginTop: 4 }} /><Bone dark={dark} w="90%" h={10} /><Bone dark={dark} w="100%" h={52} r={10} style={{ marginTop: 6 }} /></div>)}</div>
      </div>
      <div className="rk-cats">{[0, 1].map(i => <div key={i} className="rk-card rk-cat"><div className="rk-chd"><Bone dark={dark} w={30} h={30} r={10} /><span><Bone dark={dark} w={120} h={13} /><Bone dark={dark} w={170} h={10} style={{ marginTop: 6 }} /></span></div><Bone dark={dark} w="100%" h={10} /><Bone dark={dark} w="85%" h={10} /><Bone dark={dark} w="100%" h={36} r={8} style={{ marginTop: 6 }} /></div>)}</div>
      <div className="rk-card">
        <div className="rk-ch"><Bone dark={dark} w={120} h={12} /></div>
        {[62, 54, 48].map(w => <div key={w} className="rk-rate"><span className="nm"><Bone dark={dark} w={`${w}%`} h={12} /></span><Bone dark={dark} w={64} h={13} /></div>)}
      </div>
    </div>
  );
}

export function ResellerHQDashboard({ dark, onNavigate, socialLinks }) {
  const tr = useT();
  const money = useMoney();
  const toast = useToast();
  const confirm = useConfirm();
  const [loaded, setLoaded] = useState(false);
  const [key, setKey] = useState(null);
  const [shown, setShown] = useState(false);
  const [rates, setRates] = useState([]);
  const [rotating, setRotating] = useState(false);
  const [wholesale, setWholesale] = useState(false);
  const [stats, setStats] = useState(null);
  const [platforms, setPlatforms] = useState(null);
  useEffect(() => {
    fetch('/api/reseller/key').then(r => r.ok ? r.json() : null).then(d => { if (d?.apiKey) { setKey(d.apiKey); setWholesale(!!d.wholesale); } }).catch(() => {}).finally(() => setLoaded(true));
    fetch('/api/reseller/stats').then(r => r.ok ? r.json() : null).then(d => { if (d && !d.error) setStats(d); }).catch(() => {});
    // Three real rows off the live catalogue, as a sample of what this account
    // pays. Instagram because it is the tile most resellers open first. Retail
    // comes with each row so a wholesale account sees what it actually saves.
    fetch('/api/reseller/catalogue?category=instagram').then(r => r.ok ? r.json() : null).then(d => {
      setRates((d?.services || []).slice(0, 3).map(x => ({ label: x.label, price: Number(x.price), retail: Number(x.retail) || null })));
    }).catch(() => {});
    // The live platform count, the same figure the footer reads.
    fetch('/api/site-info').then(r => r.ok ? r.json() : null).then(d => {
      const n = d?.stats?.fullPlatforms || d?.stats?.uniquePlatforms;
      if (n) setPlatforms(n);
    }).catch(() => {});
  }, []);
  const waNum = (socialLinks?.social_whatsapp_reseller || socialLinks?.social_whatsapp_support || FALLBACK_WA).replace(/\D/g, '');
  const waLink = `https://wa.me/${waNum}?text=${encodeURIComponent(WA_TEXT)}`;
  const copyKey = () => { if (!key) return; try { copyText(key); toast.success('API key copied'); } catch {} };
  const copyBase = () => { try { copyText('https://nitro.ng/api/v2'); toast.success('Base URL copied'); } catch {} };
  // The site's own confirm sheet, as every other action that cannot be undone
  // uses, in place of the browser's box.
  const rotate = async () => {
    const ask = { title: tr("Rotate your API key?"), message: tr("The old key stops working the moment the new one is issued. Update your panel straight after."), confirmLabel: tr("Rotate"), danger: true };
    const ok = confirm ? await confirm(ask) : window.confirm(ask.message);
    if (!ok) return;
    setRotating(true);
    try {
      const r = await fetch('/api/reseller/key', { method: 'POST' });
      const d = await r.json();
      if (r.ok && d.apiKey) { setKey(d.apiKey); setShown(true); toast.success('New key issued', 'Update your panel now'); }
      else toast.error(d.error || 'Could not rotate the key');
    } catch { toast.error('Network error'); }
    setRotating(false);
  };

  if (!loaded) return <ResellerHQSkeleton dark={dark} />;
  const keyShort = key ? `${key.slice(0, 8)}…${key.slice(-4)}` : 'YOUR_API_KEY';
  return (
    <div className="rk">
      <style>{RK_CSS}</style>
      <div className="rk-head">
        <div>
          <div className="serif text-[32px] max-md:text-[26px] font-semibold leading-none tracking-[-.015em] text-t-text">{wholesale ? tr("Reseller HQ") : tr("API access")}</div>
          <div className="text-[13px] mt-1.5 text-t-text-muted">{wholesale ? tr("Wholesale is on. Every call returns your rate.") : tr("Your key works on every service, at the prices you already see.")}</div>
        </div>
        {wholesale
          ? <span className="pbadge ok">{RK_TICK}{tr("Wholesale on")}</span>
          : <a href="/resellers/docs" target="_blank" rel="noopener noreferrer" className="nb sec">{I(P.book, 14)}{tr("Read the docs")}</a>}
      </div>

      {/* The key, in its own slot */}
      <div className="rk-key">
        <div className="rk-top">
          <span className="rk-kt rk-glass">{I(P.key, 17)}</span>
          <span className="rk-eb">{tr("Your API key")}</span>
          {key && <span className="rk-live"><i aria-hidden="true" />{tr("Live")}</span>}
        </div>
        <div className="rk-slot">
          <code className="rk-code m">
            {key ? (shown ? key : <>{key.slice(0, 8)}<em aria-hidden="true">{'•'.repeat(12)}</em>{key.slice(-4)}</>) : <Bone dark w={220} h={12} style={{ maxWidth: '100%' }} />}
            <span className="rk-cur" aria-hidden="true" />
          </code>
          <button type="button" className="rk-ka rk-glass" onClick={() => setShown(v => !v)} disabled={!key}>{I(P.eye, 14)}{shown ? tr("Hide") : tr("Show")}</button>
          <button type="button" className="rk-ka rk-glass" onClick={copyKey} disabled={!key}>{I(P.copy, 14)}{tr("Copy")}</button>
          <button type="button" className="rk-ka rk-glass" onClick={rotate} disabled={!key || rotating}>{I(P.rot, 14)}{rotating ? tr("Rotating…") : tr("Rotate")}</button>
        </div>
        <div className="rk-meta">
          <button type="button" className="rk-chip" onClick={copyBase} aria-label={tr("Copy the base URL")}>{tr("Base URL")} <b className="m">https://nitro.ng/api/v2</b>{I(P.copy, 12)}</button>
          <span className="rk-chip">{tr("60 requests a minute")}</span>
          <span className="rk-chip">{tr("Rotating stops the old key at once")}</span>
        </div>
      </div>

      {/* Wholesale: the ask, or the figures once it is on */}
      {wholesale ? (stats && (
        <div className="rk-card rk-stats">
          <div className="rk-st"><span>{tr("Orders")}</span><b className="m">{stats.orders.toLocaleString()}</b><i>{stats.apiOrders.toLocaleString()} {tr("through the API")}</i></div>
          <div className="rk-st"><span>{tr("Spend")}</span><b className="m">{money(stats.spend)}</b><i>{stats.windowDays} {tr("days")}</i></div>
          <div className="rk-st"><span>{tr("Saved vs retail")}</span><b className="m ok">{money(stats.saved, { round: "down" })}</b><i>{!stats.upTo ? <>{tr("Your rate:")} {stats.discount}% {tr("off")}</> : stats.discount > 0 ? <>{stats.tierName}, {tr("up to")} {stats.discount}% {tr("off")}</> : tr("Normal pricing")}</i></div>
          <div className="rk-st"><span>{tr("Wallet")}</span><b className="m">{money(stats.balance, { round: "down" })}</b><i>{tr("tops up like any account")}</i></div>
        </div>
      )) : (
        <div className="rk-card rk-ws">
          <span className="ic-tile tc" style={{ "--tc": "#1ea952" }}><OffsetIcon name="chat" size={15} /></span>
          <span className="tx"><b>{tr("Lower rates on the same key")}</b><span>{tr("Tell us about your business on WhatsApp. Once we switch your account, every services call returns wholesale and every add is charged at it. Nothing to re-map.")}</span></span>
          <WaButton href={waLink}>{tr("Message us for wholesale")}</WaButton>
        </div>
      )}

      {/* Quick start: a real sequence, each step with its request */}
      <div className="rk-card">
        <div className="rk-ch"><b>{tr("Quick start")}</b><small>{tr("Three calls and you are selling")}</small></div>
        <div className="rk-qs">
          <div className="rk-q"><span className="rk-n m">1</span><b>{tr("Add Nitro as a provider")}</b><p>{tr("Set the API URL in your panel and paste your key.")}</p><pre className="rk-snip m"><span className="k">{"url"}</span>{"  "}<span className="v">https://nitro.ng/api/v2</span>{"\n"}<span className="k">{"key"}</span>{"  "}<span className="v">{keyShort}</span></pre></div>
          <div className="rk-q"><span className="rk-n m">2</span><b>{tr("Pull the services")}</b><p>{tr("Your catalogue, your prices, our IDs.")}</p><pre className="rk-snip m"><span className="k">{"action"}</span>={<span className="v">{"services"}</span>}{"\n"}<span className="c">{tr("returns your list")}</span></pre></div>
          <div className="rk-q"><span className="rk-n m">3</span><b>{tr("Place an order")}</b><p>{tr("Then follow it with status.")}</p><pre className="rk-snip m"><span className="k">{"action"}</span>={<span className="v">{"add"}</span>}{"\n"}<span className="k">{"service"}</span>=<span className="v">3877</span>{"\n"}<span className="k">{"quantity"}</span>=<span className="v">1000</span></pre></div>
        </div>
      </div>
      <div className="rk-acts">
        <a href="/resellers/docs" target="_blank" rel="noopener noreferrer" className="nb pri">{I(P.book, 14)}{tr("Read the docs")}</a>
        <button type="button" className="nb sec" onClick={() => onNavigate?.('catalogue')}>{tr("Browse the catalogue")}</button>
      </div>

      {/* The catalogue, with the platform count read live */}
      <div className="rk-cats">
        <div className="rk-card rk-cat">
          <div className="rk-chd"><span className="ic-tile"><OffsetIcon name="globe" size={15} /></span><span><b>{tr("One catalogue")}</b><small>{tr("Everything our providers can reach")}</small></span></div>
          <p>{tr("Every service Nitro can place, on one list, each on its own refill and speed terms. The same list the site shows, the same IDs, the same prices your account pays.")}</p>
          <div className="rk-cst"><div><span>{tr("Services")}</span><b>7,500+</b></div>{platforms && <div><span>{tr("Platforms")}</span><b>{platforms}</b></div>}<div><span>{tr("Settles in")}</span><b>{tr("Naira")}</b></div></div>
        </div>
        <div className="rk-card rk-cat">
          <div className="rk-chd"><span className="ic-tile"><OffsetIcon name="layers" size={15} /></span><span><b>{tr("One set of IDs")}</b><small>{tr("Stable, and yours to integrate against")}</small></span></div>
          <p>{tr("A service keeps its ID for as long as we carry it. When a provider drops one it answers “Service discontinued” rather than vanishing, so your panel can tell the difference.")}</p>
          <div className="rk-cst"><div><span>{tr("ID")}</span><b>{tr("Permanent")}</b></div><div><span>{tr("Retired")}</span><b>{tr("Says so")}</b></div><div><span>{tr("Order via")}</span><b>{tr("Site and API")}</b></div></div>
        </div>
      </div>

      {/* Rates: retail struck through only where this account pays less */}
      {rates.length > 0 && (
        <div className="rk-card">
          <div className="rk-ch"><b>{tr("Your rates today")}</b><small>{wholesale ? tr("Per 1,000, retail struck through") : tr("Per 1,000")}</small></div>
          {rates.map(r => {
            const off = wholesale && r.retail > r.price ? Math.round((1 - r.price / r.retail) * 100) : 0;
            return (
              <div key={r.label} className="rk-rate">
                <span className="nm">{r.label}</span>
                {off > 0 && <s className="m">{money(r.retail)}</s>}
                <b className="m">{money(r.price)}</b>
                {off > 0 && <span className="rk-save">{off}% {tr("off")}</span>}
              </div>
            );
          })}
        </div>
      )}

      <div className="rk-card">
        <div className="rk-ch"><b>{tr("Questions")}</b><small>{tr("The ones that matter")}</small></div>
        {FAQ.map(([q, a], i) => <details key={q} className="rk-fq" open={i === 0}><summary>{tr(q)}{RK_CHEV}</summary><p>{tr(a)}</p></details>)}
      </div>

      <div className="rk-close">
        <div className="t"><b className="serif">{wholesale ? tr("Key's live. Go sell.") : tr("Key's live. Go build.")}</b><span>{tr("The docs cover all six actions with copy and paste examples.")}</span></div>
        <a href="/resellers/docs" target="_blank" rel="noopener noreferrer" className="rk-white">{I(P.book, 14)}{tr("Read the docs")}</a>
      </div>
    </div>
  );
}

export function ResellerHQSidebar({ onNavigate }) {
  const tr = useT();
  const facts = [['Base URL', 'https://nitro.ng/api/v2'], ['Actions', 'services, add, status, refill, balance, cancel'], ['Your key', 'At the top of this page, and in Settings'], ['Prices', 'Retail for every account, wholesale by approval']];
  return (
    <div className="rr">
      <RailSec icon="key">{tr("The API")}</RailSec>
      <RailCard>
        {facts.map(([k, v]) => <RailRow key={k} title={v} sub={k} />)}
      </RailCard>
      <RailLink href="/resellers/docs">{tr("Read the docs")}</RailLink>
      <RailLink onClick={() => onNavigate?.('catalogue')}>{tr("Open the catalogue")}</RailLink>
    </div>
  );
}
