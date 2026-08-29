'use client';
// Reseller HQ: one page in two states.
//
// A prospect on /resellers sees what they get, the two catalogues, the API in
// one card, how to join over WhatsApp, and the honest bit. A member on the
// dashboard tab sees their key, a quick start, their catalogue, their rates and
// the questions that matter. Joining is a WhatsApp message and a switch on our
// side; the key appears here and in Settings once approved. No child panel.
import { useEffect, useState } from 'react';
import { Bone } from "./skeleton";
import { ThemeProvider, useTheme } from './shared-nav';
import SharedNav, { SharedFooter, SharedStyles } from './shared-nav';
import { useToast } from './toast';
import { copyText } from '@/lib/clipboard';

const FALLBACK_WA = '2347071656156';
const WA_ICON = <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M17.5 14.4c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.96-.94 1.16-.17.2-.35.22-.65.07-.3-.15-1.26-.46-2.4-1.48-.88-.79-1.48-1.76-1.65-2.06-.17-.3-.02-.46.13-.61.14-.13.3-.35.45-.52.15-.18.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.62-.92-2.22-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.8.37-.27.3-1.04 1.02-1.04 2.5 0 1.47 1.07 2.9 1.22 3.1.15.2 2.1 3.2 5.1 4.49.71.3 1.27.49 1.7.63.72.23 1.37.2 1.88.12.58-.09 1.76-.72 2-1.42.25-.7.25-1.3.18-1.42-.08-.13-.28-.2-.58-.35zM12.05 21.8h-.01a9.87 9.87 0 01-5.03-1.38l-.36-.21-3.74.98 1-3.65-.24-.37a9.85 9.85 0 01-1.51-5.26c0-5.45 4.44-9.88 9.9-9.88a9.83 9.83 0 016.99 2.9 9.82 9.82 0 012.9 7c0 5.45-4.45 9.87-9.9 9.87z"/></svg>;
const I = (d, s = 14, w = 2) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{d}</svg>;
const P = {
  chk: <path d="M20 6 9 17l-5-5"/>,
  key: <path d="m21 2-2 2m-7.6 7.6a5.5 5.5 0 11-7.8 7.8 5.5 5.5 0 017.8-7.8zm0 0L19 3l2 2-3 3"/>,
  copy: <><rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 012-2h10"/></>,
  eye: <><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z"/><circle cx="12" cy="12" r="3"/></>,
  rot: <><path d="M21 12a9 9 0 11-3-6.7"/><path d="M21 3v6h-6"/></>,
  arrow: <path d="M5 12h14M13 6l6 6-6 6"/>,
  layers: <path d="M12 2 2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>,
  globe: <><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15 15 0 014 10 15 15 0 01-4 10 15 15 0 01-4-10 15 15 0 014-10z"/></>,
  bolt: <path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z"/>,
  chart: <path d="M18 20V10M12 20V4M6 20v-6"/>,
  refund: <path d="M3 12a9 9 0 109-9 9.75 9.75 0 00-6.74 2.74L3 8M3 3v5h5"/>,
  clock: <><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></>,
  naira: <path d="M6 20V4l12 16V4M3 10h18M3 14h18"/>,
  book: <path d="M4 19.5A2.5 2.5 0 016.5 17H20M4 19.5A2.5 2.5 0 006.5 22H20V2H6.5A2.5 2.5 0 004 4.5z"/>,
};

const WA_TEXT = "Hi! I'd like wholesale prices on my Nitro account. Here's what my business does:";
const WA_FULL = "Hi! I'm a Nitro reseller and I'd like the full catalogue on my account.";

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
      .rhq-btn-p.blue{background:${bgrad};box-shadow:0 5px 16px rgba(37,99,235,.28)}.rhq-btn-p.wa{background:#25d366;box-shadow:0 5px 16px rgba(37,211,102,.3)}.rhq-btn-p.white{background:#fff;color:#8b5e6b;box-shadow:none}.rhq-btn-p svg{width:15px;height:15px}
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
      .rhq-phead{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;padding:2px 0 14px;border-bottom:1px solid ${hair}}.rhq-phead p{margin:0;font-size:13px;color:${muted}}
      .rhq-keystrip{display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding:12px 0;border-bottom:1px solid ${hair}}
      .rhq-kicon{width:28px;height:28px;border-radius:8px;background:${bgrad};color:#fff;display:grid;place-items:center;flex-shrink:0}.rhq-klabel{font-size:10px;font-weight:800;letter-spacing:1.4px;text-transform:uppercase;color:${muted}}
      .rhq-keystrip code{font-family:'JetBrains Mono',ui-monospace,monospace;font-size:12px;padding:7px 10px;border-radius:9px;background:${dark ? 'rgba(255,255,255,.07)' : 'rgba(0,0,0,.05)'};color:${t.text};flex:1;min-width:0;white-space:normal;word-break:break-all;line-height:1.5}.rhq-kb{display:flex;gap:6px;flex-wrap:wrap}
      @media (max-width:768px){.rhq-keystrip code{flex-basis:100%}.rhq-keystrip .rhq-kb{flex-basis:100%}}
      .rhq-kmeta{font-size:11px;color:${muted};padding:10px 0 2px;display:flex;flex-wrap:wrap;gap:4px 10px}.rhq-kmeta b{color:${t.text}}
      .rhq-acts{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}
      .rhq-rates{border:1px solid ${hair};border-radius:14px;overflow:hidden;background:${panel}}.rhq-rate{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:11px 14px;border-top:1px solid ${hair};font-size:12.5px;color:${t.text}}.rhq-rate:first-child{border-top:none}.rhq-rate b{font-family:'JetBrains Mono',ui-monospace,monospace;font-weight:700;white-space:nowrap}.rhq-rate s{color:${muted};font-weight:500;margin-right:8px;font-size:11px}
      .rhq-faq{border:1px solid ${hair};border-radius:14px;overflow:hidden;background:${panel}}.rhq-faq-item{border-top:1px solid ${hair}}.rhq-faq-item:first-child{border-top:none}.rhq-faq-btn{padding:13px 16px;font-size:12.5px;font-weight:700;display:flex;justify-content:space-between;align-items:center;gap:10px;cursor:pointer;list-style:none;color:${t.text}}.rhq-faq-btn::-webkit-details-marker{display:none}.rhq-faq-chev{color:${muted};transform:rotate(90deg);transition:.2s;flex-shrink:0}details[open] .rhq-faq-chev{transform:rotate(-90deg)}.rhq-faq-ans{padding:0 16px 13px;font-size:12px;color:${muted};line-height:1.65}
      @media (min-width:768px){.rhq-feats{grid-template-columns:1fr 1fr}.rhq-grid2{grid-template-columns:1fr 1fr}.rhq-steps{grid-template-columns:1fr 1fr 1fr}.rhq-step{border-top:none;border-left:1px solid ${hair}}.rhq-step:first-child{border-left:none}.rhq-hero{padding:44px 24px 40px}}
    `}</style>
  );
}

const SecHead = ({ label, sub }) => <div className="rhq-sec-head"><span className="rhq-sec-label">{label}</span><span className="rhq-sec-rule" /><span className="rhq-sec-sub">{sub}</span></div>;
const Feat = ({ icon, title, body, tone }) => <div className="rhq-feat"><span className={`rhq-feat-ico ${tone || ''}`}>{I(icon, 15)}</span><span><h4>{title}</h4><p>{body}</p></span></div>;
const Steps = ({ items }) => <div className="rhq-steps">{items.map(([t, b], i) => <div key={t} className="rhq-step"><span className="rhq-step-n">{String(i + 1).padStart(2, '0')}</span><h4>{t}</h4><p>{b}</p></div>)}</div>;
const Faq = ({ items }) => <div className="rhq-faq">{items.map(([q, a]) => <details key={q} className="rhq-faq-item"><summary className="rhq-faq-btn">{q}<span className="rhq-faq-chev">{I(P.arrow, 12)}</span></summary><div className="rhq-faq-ans">{a}</div></details>)}</div>;

function Catalogues({ full, waLink }) {
  const Cat = ({ icon, tone, title, badge, tag, desc, stats }) => (
    <div className="rhq-cat">
      <div className="rhq-cat-head"><span className={`rhq-cat-ico ${tone}`}>{I(icon, 13)}</span><span><h3 className="rhq-cat-title">{title}{badge && <span className="rhq-badge-sm">{badge}</span>}</h3><div className="rhq-cat-tag">{tag}</div></span></div>
      <p className="rhq-cat-desc">{desc}</p>
      <div className="rhq-cat-stats">{stats.map(([l, v]) => <div key={l} className="rhq-cat-stat">{l}<b>{v}</b></div>)}</div>
    </div>
  );
  return (
    <div className="rhq-grid2">
      <Cat icon={P.layers} tone="" title="Nitro Curated" badge={full ? null : 'DEFAULT'} tag="The catalogue we stake our name on" desc="Hand-picked, stress-tested services in Budget, Standard and Premium tiers. Refill-backed where it counts. Order from New Order or the API." stats={[['Services', '227'], ['Refill', 'Guaranteed'], ['Order via', 'Site + API']]} />
      <Cat icon={P.globe} tone="blue" title="Full Catalogue" badge={full ? 'ON' : null} tag="Everything our providers can reach" desc={full ? 'Thousands of services across every platform, at wholesale, each on its own refill and cancel terms. API only. On your account now.' : 'Thousands of services across every platform, at wholesale, each on its own refill and cancel terms. API only. On request: message support and we switch you.'} stats={[['Services', '9,400+'], ['Refill', 'Per service'], ['Order via', 'API']]} />
    </div>
  );
}

const FAQ = [
  ['Which services can my key order?', 'Whatever your account sees: the curated tiers, at retail or at wholesale once approved, or the full list once we switch you. An ID outside your catalogue answers "Incorrect service ID".'],
  ['Do API orders run gradual delivery?', 'No. API orders go at natural speed; you set expectations with your own customers.'],
  ['What happens to orders that cannot deliver?', 'They refund to your wallet automatically.'],
  ['How do I get wholesale?', 'Message us on WhatsApp about your business. Once approved, the same key returns wholesale rates; consistent volume earns a personal rate on top.'],
  ['Is there a rate limit?', 'Sixty requests a minute per key. Normal panel traffic never touches it.'],
];

/* ── Public: /resellers ── */
export default function ResellerHQView() {
  return <ThemeProvider><ProspectInner /></ThemeProvider>;
}

function ProspectInner() {
  const { dark, t } = useTheme();
  const [waNum, setWaNum] = useState(FALLBACK_WA);
  useEffect(() => {
    fetch('/api/settings').then(r => r.ok ? r.json() : {}).then(d => {
      const n = d.settings?.social_whatsapp_support?.replace(/\D/g, '');
      if (n) setWaNum(n);
    }).catch(() => {});
  }, []);
  const waLink = `https://wa.me/${waNum}?text=${encodeURIComponent(WA_TEXT)}`;
  const Wa = () => <a href={waLink} target="_blank" rel="noopener noreferrer" className="rhq-btn-p wa">{WA_ICON}Message us on WhatsApp</a>;
  return (
    <>
      <SharedStyles />
      <Styles dark={dark} t={t} />
      <div className="min-h-dvh flex flex-col" style={{ background: t.bg, color: t.text }}>
        <SharedNav />
        <main className="flex-1 w-full max-w-[960px] mx-auto px-4 sm:px-6 pb-16">
          <div className="rhq-hero"><div className="rhq-glow" /><span className="rhq-pill">Reseller HQ</span><h1 className="rhq-h1">Build your business on Nitro</h1><p className="rhq-lead">Every account gets an <b>API key</b> and the same catalogue at retail, today. Message us on WhatsApp and we switch your account to <b>wholesale</b>.</p><div className="rhq-checks"><span>{I(P.chk, 12, 2.5)}Wholesale on the whole catalogue</span><span>{I(P.chk, 12, 2.5)}A key for every account, in Settings</span><span>{I(P.chk, 12, 2.5)}Everything settles in naira</span></div><Wa /></div>
          <SecHead label="What you get" sub="The same shop, lower prices" />
          <div className="rhq-feats">
            <Feat icon={P.naira} tone="accent" title="Naira in, naira out" body="Opay, PalmPay, Kuda or bank transfer. No dollar cards, no FX to watch." />
            <Feat icon={P.layers} tone="accent" title="A catalogue built for choosing" body="Quality grades, refill terms and speed on every row before you order." />
            <Feat icon={P.bolt} title="Full speed, always" body="API orders never enter the gradual delivery queue. They hit providers at natural speed." />
            <Feat icon={P.chart} title="Reseller rates" body="Below retail on every order, and a personal rate on top once your volume is consistent." />
            <Feat icon={P.refund} title="Auto refunds" body="Anything we can't deliver refunds to your wallet automatically. Never out of pocket." />
            <Feat icon={P.clock} title="Live tracking" body="Start count, remains and status on every order, pollable so your panel can show it." />
          </div>
          <SecHead label="Catalogues" sub="Curated by default, full on request" />
          <Catalogues full={false} waLink={waLink} />
          <SecHead label="How to join" sub="Three steps, no forms" />
          <Steps items={[['Grab your key in Settings', 'Every verified account has one. Point your panel at nitro.ng/api/v2 and order the curated list at the price you already see.'], ['Message us for wholesale', 'Tell us about your business: your panel, your clients, or the volume you push. We switch your account, and the same key starts returning lower rates.'], ['Order like you always did', 'Same order page, same wallet, same history. Only the price changes.']]} />
          <div className="rhq-honest"><span className="rhq-sec-label">The honest bit</span><p>Reseller pricing replaces retail perks: loyalty discounts, promo codes and Nitro Points do not stack on top. Wholesale is the deal. Full-catalogue services carry the provider's own terms, shown on every row.</p></div>
          <div className="rhq-closer"><div><h3>Start where you are.</h3><p>Your key is already in Settings. Wholesale is one message away.</p></div><Wa /></div>
        </main>
        <SharedFooter />
      </div>
    </>
  );
}

/* ── Member: the dashboard tab ── */
export function ResellerHQDashboard({ dark, t, onNavigate, socialLinks }) {
  const toast = useToast();
  const [key, setKey] = useState(null);
  const [catalog, setCatalog] = useState('curated');
  const [shown, setShown] = useState(false);
  const [rates, setRates] = useState([]);
  const [rotating, setRotating] = useState(false);
  const [wholesale, setWholesale] = useState(false);
  useEffect(() => {
    fetch('/api/reseller/key').then(r => r.ok ? r.json() : null).then(d => { if (d?.apiKey) { setKey(d.apiKey); setCatalog(d.catalog || 'curated'); setWholesale(!!d.wholesale); } }).catch(() => {});
    fetch('/api/reseller/catalogue?view=curated').then(r => r.ok ? r.json() : null).then(d => {
      const rows = [];
      for (const g of d?.groups || []) for (const tier of g.tiers || []) if (rows.length < 3 && tier.retail && tier.price && tier.retail > tier.price) rows.push([`${g.name} · ${tier.tier}`, tier.retail, tier.price]);
      setRates(rows);
    }).catch(() => {});
  }, []);
  const waNum = (socialLinks?.social_whatsapp_support || FALLBACK_WA).replace(/\D/g, '');
  const waLink = `https://wa.me/${waNum}?text=${encodeURIComponent(wholesale ? WA_FULL : WA_TEXT)}`;
  const masked = key ? `${key.slice(0, 8)}${'•'.repeat(12)}${key.slice(-4)}` : '';
  const copyKey = () => { if (!key) return; try { copyText(key); toast.success('API key copied'); } catch {} };
  const rotate = async () => {
    if (!window.confirm('Rotate your API key? The old key stops working the moment the new one is issued.')) return;
    setRotating(true);
    try {
      const r = await fetch('/api/reseller/key', { method: 'POST' });
      const d = await r.json();
      if (r.ok && d.apiKey) { setKey(d.apiKey); setShown(true); toast.success('New key issued', 'Update your panel now'); }
      else toast.error(d.error || 'Could not rotate the key');
    } catch { toast.error('Network error'); }
    setRotating(false);
  };
  const full = catalog === 'full';
  return (
    <div>
      <Styles dark={dark} t={t} />
      <div className="rhq-phead"><div><span className="rhq-pill">Reseller HQ</span><h1 className="rhq-h1" style={{ fontSize: 22, margin: '8px 0 2px' }}>{wholesale ? 'Wholesale is on.' : 'Your API is ready.'}</h1><p>{wholesale ? 'Everything you need, in one place.' : 'Retail prices today. Wholesale is one message away.'}</p></div><span className="rhq-badge-sm big">{wholesale ? (full ? 'FULL CATALOGUE' : 'WHOLESALE') : 'RETAIL'}</span></div>
      <div className="rhq-keystrip">
        <span className="rhq-kicon">{I(P.key, 14)}</span><span className="rhq-klabel">API key</span>
        <code className="m">{key ? (shown ? key : masked) : <Bone dark={dark} w={220} h={12} style={{ display: "inline-block", verticalAlign: "middle", maxWidth: "100%" }} />}</code>
        <span className="rhq-kb">
          <button type="button" className="rhq-btn-g" onClick={() => setShown(v => !v)} disabled={!key}>{I(P.eye, 12)} {shown ? 'Hide' : 'Show'}</button>
          <button type="button" className="rhq-btn-g" onClick={copyKey} disabled={!key}>{I(P.copy, 12)} Copy</button>
          <button type="button" className="rhq-btn-g" onClick={rotate} disabled={!key || rotating}>{I(P.rot, 12)} {rotating ? 'Rotating…' : 'Rotate'}</button>
        </span>
      </div>
      <div className="rhq-kmeta"><span>Base URL <b className="m">https://nitro.ng/api/v2</b></span><span>60 requests a minute</span><span>Rotating stops the old key at once</span></div>
      <SecHead label="Quick start" sub="Three calls and you are selling" />
      <Steps items={[['Add Nitro as a provider', 'Set the API URL to nitro.ng/api/v2 in your panel and paste your key.'], ['Pull the services', 'Your panel calls services and gets your catalogue, your prices, our IDs.'], ['Place an order', 'add with a service ID, link and quantity. Track it with status.']]} />
      <div className="rhq-acts"><a href="/resellers/docs" target="_blank" rel="noopener noreferrer" className="rhq-btn-p blue">{I(P.book, 13)} Read the docs</a><button type="button" className="rhq-btn-g" onClick={() => onNavigate?.('catalogue')}>Browse the catalogue</button></div>
      {!wholesale && <>
        <SecHead label="Wholesale" sub="By approval, one message" />
        <div className="rhq-feat"><span className="rhq-feat-ico accent">{I(P.chart, 15)}</span><span><h4>Lower rates on the same key</h4><p>Tell us about your business on WhatsApp. Once we switch your account, every services call returns wholesale and every add is charged at it. Nothing to re-map.</p></span></div>
        <div className="rhq-acts"><a href={waLink} target="_blank" rel="noopener noreferrer" className="rhq-btn-p wa">{WA_ICON}Message us for wholesale</a></div>
      </>}
      <SecHead label="Your catalogue" sub={full ? 'Curated and the full list' : wholesale ? 'Curated today, full on request' : 'Curated, at retail'} />
      <Catalogues full={full} waLink={waLink} />
      {wholesale && !full && <div className="rhq-acts"><a href={waLink} target="_blank" rel="noopener noreferrer" className="rhq-btn-g" style={{ color: dark ? '#4ade80' : '#16a34a' }}>{WA_ICON} Ask for the full list</a></div>}
      {rates.length > 0 && <>
        <SecHead label="Your rates today" sub="Per 1,000 · retail struck through" />
        <div className="rhq-rates">{rates.map(([name, retail, price]) => <div key={name} className="rhq-rate"><span>{name}</span><b><s>₦{Number(retail).toLocaleString()}</s>₦{Number(price).toLocaleString()}</b></div>)}</div>
      </>}
      <SecHead label="Questions" sub="The ones that matter" />
      <Faq items={FAQ} />
      <div className="rhq-closer"><div><h3>{wholesale ? "Key's live. Go sell." : "Key's live. Go build."}</h3><p>Docs cover all six actions with copy-paste examples.</p></div><a href="/resellers/docs" target="_blank" rel="noopener noreferrer" className="rhq-btn-p white">Read the docs</a></div>
    </div>
  );
}

export function ResellerHQSidebar({ dark, t, onNavigate }) {
  return (
    <div className="flex flex-col gap-0">
      <div className="text-[11px] font-semibold uppercase tracking-[1.5px] mb-2 py-1.5 px-2.5 rounded-lg text-t-text-muted" style={{ background: dark ? 'rgba(196,125,142,.1)' : 'rgba(196,125,142,.08)' }}>Quick reference</div>
      {[['Base URL', 'https://nitro.ng/api/v2'], ['Actions', 'services · add · status · refill · balance · cancel'], ['Your key', 'At the top of this page, and in Settings'], ['Prices', 'Retail for every account, wholesale by approval']].map(([k, v]) => (
        <div key={k} className="py-2.5 px-2.5 rounded-lg mb-1.5" style={{ background: t.cardBg }}>
          <div className="text-[11px] uppercase tracking-[.5px] mb-0.5 text-t-text-muted">{k}</div>
          <div className="text-[13px] font-medium break-words text-t-text">{v}</div>
        </div>
      ))}
      <a href="/resellers/docs" target="_blank" rel="noopener noreferrer" className="mt-1 py-2 px-2.5 rounded-lg text-[13px] font-semibold no-underline text-center text-accent" style={{ background: dark ? 'rgba(196,125,142,.12)' : 'rgba(196,125,142,.08)' }}>Open the API docs</a>
      <button type="button" onClick={() => onNavigate?.('catalogue')} className="mt-1.5 py-2 px-2.5 rounded-lg text-[13px] font-semibold border-none cursor-pointer text-t-text-soft" style={{ background: t.cardBg }}>Browse the catalogue</button>
    </div>
  );
}
