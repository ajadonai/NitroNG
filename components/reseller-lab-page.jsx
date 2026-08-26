'use client';
import { useState, useCallback } from 'react';
import { ThemeProvider, useTheme } from './shared-nav';
import SharedNav, { SharedFooter, SharedStyles } from './shared-nav';

export default function ResellerLabView() {
  return <ThemeProvider><ResellerHQInner /></ThemeProvider>;
}

export function ResellerLabDashboard({ dark, t }) {
  return <ResellerHQInner dark={dark} t={t} embedded />;
}

export function ResellerLabSidebar({ dark, t }) {
  return (
    <div className="flex flex-col gap-0">
      <div className="rhq-sb-head text-t-text-muted" style={{ background: dark ? 'rgba(196,125,142,.12)' : 'rgba(196,125,142,.08)' }}>Two products</div>
      {[
        ['API Access', 'Free — plug into your existing panel', dark ? '#60a5fa' : '#2563eb'],
        ['Your Own Panel', '₦30k–₦50k/mo — white-label storefront', '#c47d8e'],
      ].map(([title, desc, color]) => (
        <div key={title} className="rhq-sb-item" style={{ background: dark ? 'rgba(255,255,255,.07)' : 'rgba(0,0,0,.02)' }}>
          <div className="text-sm font-medium mb-0.5" style={{ color }}>{title}</div>
          <div className="text-xs text-t-text-muted">{desc}</div>
        </div>
      ))}
      <div className="rhq-sb-head mt-2 text-t-text-muted" style={{ background: dark ? 'rgba(196,125,142,.12)' : 'rgba(196,125,142,.08)' }}>Quick links</div>
      {[['API documentation', '/lab/docs'], ['Volume ladder', 'Rates improve as you grow'], ['Panel setup', 'Live within 48 hours']].map(([title, desc]) => (
        <div key={title} className="rhq-sb-item" style={{ background: dark ? 'rgba(255,255,255,.07)' : 'rgba(0,0,0,.02)' }}>
          <div className="text-sm font-medium mb-0.5 text-t-text">{title}</div>
          <div className="text-xs text-t-text-muted">{desc}</div>
        </div>
      ))}
    </div>
  );
}

const N = n => '₦' + Math.round(n).toLocaleString('en-US');
const PANEL_STARTER = 30000;
const PANEL_PRO = 50000;
const EARN_COST = 2720;
const MOCK_KEY = 'ntr_live_4x9kq2mvt8p1zc6ba8f7c640';

const SAMPLE_RATES = [
  ['Instagram Followers — Standard', 4200, 2720],
  ['TikTok Views', 850, 520],
  ['YouTube Subscribers', 9800, 7150],
];

const API_FEATURES = [
  ['M13 2L3 14h9l-1 8 10-12h-9l1-8', 'Full speed, always', 'API orders never enter the gradual delivery queue. They hit providers at natural speed, and your customers see movement in minutes.'],
  ['M18 20V10M12 20V4M6 20v-6', 'Reseller rates', 'Priced below retail on every API order, and they improve automatically as your monthly volume climbs. No renegotiation.'],
  ['M3 12a9 9 0 109-9 9.75 9.75 0 00-6.74 2.74L3 8M3 3v5h5', 'Auto refunds', "Anything we can't deliver refunds to your wallet automatically. You're never out of pocket on a failed order."],
  ['M12 2a10 10 0 100 20 10 10 0 000-20zM12 6v6l4 2', 'Live tracking', 'Start count, remains and status on every order, pollable so your panel can show your customers real progress.'],
];

const PANEL_FEATURES = [
  ['M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2zM9 22V12h6v10', 'Your storefront', 'Free yourbrand.nitro.ng, or connect a domain you already own by pointing its nameservers at us. Live within 48 hours.', ''],
  ['M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z', 'True white-label', 'Your name, logo, colors and domain everywhere. Nitro never appears anywhere your customers can see.', ''],
  ['M12 1v22M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6', 'Your pricing', 'Set any markup over your reseller rates, per service. The gap between their price and fulfilment cost is yours.', ''],
  ['M12 2.69l5.66 5.66a8 8 0 11-11.31 0z', 'Gradual delivery engine', "Nitro's slow, natural-looking delivery, available on your storefront when you switch it on. Most panels can't offer this.", 'PRO'],
  ['M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 7a4 4 0 100 .01M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75', 'Customer accounts', 'Registrations, balances and order history for your users, managed by our system under your brand.', ''],
  ['M12 2a10 10 0 100 20 10 10 0 000-20zM10 8l6 4-6 4V8z', 'Automated fulfilment', 'Orders placed on your panel route straight to our engine and providers. No manual forwarding, ever.', ''],
  ['M2 5h20a2 2 0 012 2v10a2 2 0 01-2 2H2a2 2 0 01-2-2V7a2 2 0 012-2zM2 10h20', 'You get paid directly', 'Your bank account and crypto address sit on your top-up page. Customer money goes straight to you, never through us.', ''],
  ['M20 12v10H4V12M2 7h20v5H2zM12 22V7M12 7H7.5a2.5 2.5 0 010-5C11 2 12 7 12 7zM12 7h4.5a2.5 2.5 0 000-5C13 2 12 7 12 7z', 'Launch kit', 'A promo pack and setup guide the day you go live: launch posts, pricing templates, how to land your first customers.', ''],
];

const API_FAQ = [
  ['Do I need to apply or get approved?', 'No. Generate a key on this page and it works immediately, with reseller rates applied from the first order.'],
  ['How do I connect my panel?', 'Point your panel\'s provider settings at https://nitro.ng/api/v2 with your key. It speaks the standard service / link / quantity format, so ready-made panels connect with zero custom code.'],
  ['Which services can my key order?', 'Whichever list you pick above: the curated tiers or the full provider list. Switch anytime; the services call always returns your current list.'],
  ['Why do API orders never run gradual delivery?', "Gradual delivery is a retail safety feature. As a reseller you manage your own customers' expectations, so your orders go at full natural speed. If you want gradual delivery as a product, that's what the child panel offers."],
  ["What happens to orders that can't deliver?", "They refund to your wallet automatically. You're never out of pocket on a failed order."],
  ['How do my rates improve?', 'Your monthly fulfilment spend sets your tier on the volume ladder. Tiers upgrade automatically and apply to every order after.'],
  ['Is there a rate limit?', 'Generous ones, built to keep the engine healthy. Normal panel traffic never touches them.'],
  ['Can I run the API and a child panel together?', 'Yes. One wallet, one volume ladder, two revenue streams.'],
];

const PANEL_FAQ = [
  ['Do I need technical knowledge?', 'No. You pick a domain and set your prices from a simple dashboard. Hosting, delivery, providers and maintenance are all on us.'],
  ['How long until my panel is live?', 'Usually within 48 hours of starting. Own domains go live as soon as your nameserver change propagates, which can add up to 24 hours.'],
  ['Can I use my own domain?', 'Yes. Buy any domain from any registrar, point its nameservers to ns1.nitro.ng and ns2.nitro.ng, and we white-label everything on it. Or take the free subdomain and skip DNS entirely.'],
  ['Will my customers know Nitro is behind it?', 'No. Your storefront carries your name, logo, colors, domain and prices. Nitro appears nowhere your customers look.'],
  ['How do my customers pay me?', "Directly. Your own bank account and crypto address go on your storefront's top-up page. You approve deposits from your panel admin, your customer's balance updates, and the money sits in your bank. It never routes through Nitro."],
  ['So how does Nitro get paid?', `Two ways only: your monthly plan (${N(PANEL_STARTER)} Starter or ${N(PANEL_PRO)} Pro), and fulfilment at reseller rates drawn from your Nitro wallet when your customers' orders run. We never touch or hold your customers' money.`],
  ["What if my wallet can't cover a renewal?", "Your panel pauses. Nothing is deleted and your customers' data stays put. Top up and it's back instantly. You can also downgrade from Pro to Starter anytime."],
  ['Can my customers get gradual delivery?', "On the Pro plan, yes. Nitro's gradual delivery engine is a Pro-exclusive feature on your storefront, a selling point most panels can't match. Starter plans run full speed only."],
  ['Why not build my own panel from scratch?', "Software, providers, payments, uptime and support are months of work before your first sale. Here you're selling in 48 hours and the engine is ours to maintain."],
  ["Can I get a refund?", "Month one refunds to your wallet in full if we haven't started your build. Once your panel is live, months already charged aren't refunded, but you can cancel renewal anytime."],
];

const COMPARE_ROWS = [
  ['Best for', 'You already run a panel, bot or shop', 'You want a panel without building one'],
  ['Entry cost', 'Free, just generate a key', `From ${N(PANEL_STARTER)}/mo — two tiers, cancel anytime`],
  ['Your customers buy on', 'Your existing panel or app', 'Your own domain or free yourbrand.nitro.ng'],
  ['Delivery', 'Full speed, always. Never gradual', 'Full speed on Starter, gradual delivery on Pro'],
  ['You handle', 'Your own software and support', 'Pricing and marketing. We run the rest'],
  ['Money flow', 'Your wallet funds fulfilment', 'Customers pay you directly; your wallet only funds fulfilment'],
];

const CURRENCIES = [
  'NGN — Nigerian naira', 'USD — US dollar', 'GHS — Ghanaian cedi',
  'KES — Kenyan shilling', 'ZAR — South African rand', 'XOF — CFA franc',
  'EGP — Egyptian pound', 'TZS — Tanzanian shilling', 'UGX — Ugandan shilling',
  'GBP — Pound sterling', 'EUR — Euro', 'INR — Indian rupee',
];

function Ico({ d, size = 15, sw = 2 }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round"><path d={d} /></svg>;
}
function Chk() {
  return <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>;
}
function Chevron() {
  return <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9" /></svg>;
}
function Arrow() {
  return <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></svg>;
}

function Disclosure({ id, num, label, color, summary, children, border, openId, setOpenId }) {
  const open = openId === id;
  return (
    <div className="rhq-disc" style={{ border: `1px solid ${border}`, borderRadius: 14, overflow: 'hidden', marginTop: 14 }}>
      <button onClick={() => setOpenId(open ? null : id)} className="rhq-disc-btn" style={{ color }}>
        <span className="rhq-disc-label"><i style={{ color }}>{num}</i> · {label}</span>
        <span className="rhq-disc-right">
          {!open && summary && <span className="rhq-disc-sum">{summary}</span>}
          <span className="rhq-faq-chev" style={{ transform: open ? 'rotate(180deg)' : 'none', color: open ? color : 'var(--rhq-muted)' }}><Chevron /></span>
        </span>
      </button>
      {open && <div className="rhq-disc-body">{children}</div>}
    </div>
  );
}

function FaqBlock({ items, accentVar }) {
  const [openIdx, setOpenIdx] = useState(null);
  return (
    <div className="rhq-faq">
      {items.map(([q, a], i) => (
        <div key={i} className={i < items.length - 1 ? 'rhq-faq-item' : ''}>
          <button onClick={() => setOpenIdx(openIdx === i ? null : i)} className="rhq-faq-btn">
            {q}
            <span className="rhq-faq-chev" style={{ transform: openIdx === i ? 'rotate(180deg)' : 'none', color: openIdx === i ? accentVar : 'var(--rhq-muted)' }}>
              <Chevron />
            </span>
          </button>
          {openIdx === i && <div className="rhq-faq-ans" dangerouslySetInnerHTML={{ __html: a }} />}
        </div>
      ))}
    </div>
  );
}

function ResellerHQInner({ dark: darkProp, t: tProp, embedded } = {}) {
  const theme = useTheme();
  const dark = darkProp ?? theme.dark;
  const t = tProp ?? theme.t;

  const [prod, setProd] = useState('api');
  const [hasKey, setHasKey] = useState(false);
  const [keyShown, setKeyShown] = useState(false);
  const [markup, setMarkup] = useState(30);
  const [catalog, setCatalog] = useState('curated');
  const [buildMode, setBuildMode] = useState('std');
  const [showModal, setShowModal] = useState(false);
  const [domainMode, setDomainMode] = useState('sub');
  const [subValue, setSubValue] = useState('');
  const [toast, setToast] = useState(null);

  const showToast = useCallback((title, detail) => {
    setToast({ title, detail });
    setTimeout(() => setToast(null), 3400);
  }, []);

  const generateKey = () => {
    setHasKey(true);
    setKeyShown(true);
    setProd('api');
    showToast('API key generated', 'Copy it now, reseller rates are live');
  };

  const accent = '#c47d8e';
  const blue = dark ? '#60a5fa' : '#2563eb';
  const green = dark ? '#6ee7b7' : '#059669';
  const border = dark ? 'rgba(255,255,255,.12)' : 'rgba(0,0,0,.08)';
  const hair = dark ? 'rgba(255,255,255,.09)' : 'rgba(0,0,0,.08)';
  const card = dark ? 'rgba(255,255,255,.07)' : 'rgba(255,255,255,.85)';
  const panel = dark ? '#131728' : '#fff';
  const muted = dark ? '#8a8580' : '#757170';
  const soft = dark ? '#c9c5c0' : '#4a4744';
  const track = dark ? 'rgba(255,255,255,.07)' : 'rgba(0,0,0,.05)';
  const accentSoft = dark ? 'rgba(196,125,142,.12)' : 'rgba(196,125,142,.08)';
  const accentSoft2 = dark ? 'rgba(196,125,142,.22)' : 'rgba(196,125,142,.16)';
  const blueSoft = dark ? 'rgba(96,165,250,.1)' : 'rgba(37,99,235,.08)';
  const blueSoft2 = dark ? 'rgba(96,165,250,.2)' : 'rgba(37,99,235,.15)';
  const greenSoft = dark ? 'rgba(110,231,183,.12)' : 'rgba(5,150,105,.1)';
  const code = dark ? '#0d101d' : '#faf8f5';
  const grad = 'linear-gradient(135deg, #c47d8e, #8b5e6b)';
  const bgrad = 'linear-gradient(135deg, #60a5fa, #2563eb)';
  const shadow = dark ? '0 14px 40px rgba(0,0,0,.45)' : '0 14px 40px rgba(28,27,25,.1)';

  const cssVars = {
    '--rhq-bg': t.bg, '--rhq-text': t.text, '--rhq-soft': soft, '--rhq-muted': muted,
    '--rhq-card': card, '--rhq-panel': panel, '--rhq-border': border, '--rhq-hair': hair,
    '--rhq-track': track, '--rhq-accent': accent, '--rhq-accent-soft': accentSoft,
    '--rhq-accent-soft2': accentSoft2, '--rhq-blue': blue, '--rhq-blue-soft': blueSoft,
    '--rhq-blue-soft2': blueSoft2, '--rhq-green': green, '--rhq-green-soft': greenSoft,
    '--rhq-code': code, '--rhq-grad': grad, '--rhq-bgrad': bgrad, '--rhq-shadow': shadow,
  };

  const colors = { blue, green, muted, soft, border, hair, card, panel, accent, accentSoft, accentSoft2, blueSoft, blueSoft2, greenSoft, track, code, bgrad, grad, shadow };

  return (
    <>
      {!embedded && <SharedStyles />}
      <style>{`
        .rhq-sb-head{font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:1.5px;margin-bottom:8px;padding:6px 10px;border-radius:8px}
        .rhq-sb-item{padding:10px 12px;border-radius:8px;margin-bottom:6px}
        .rhq-pcard{transition:.18s;background:var(--rhq-panel);border-radius:18px;padding:22px;text-align:left;position:relative;overflow:hidden;cursor:pointer}
        .rhq-pcard:hover{transform:translateY(-3px)}
        .rhq-pcard::before{content:"";position:absolute;inset:0 0 auto 0;height:4px}
        .rhq-pcard.api::before{background:${bgrad}}
        .rhq-pcard.panel::before{background:${grad}}
        .rhq-btn-p{font-size:13px;font-weight:800;padding:11px 20px;border-radius:11px;border:none;cursor:pointer;transition:.15s}
        .rhq-btn-p:hover{transform:translateY(-1px)}
        .rhq-btn-g{font-size:12px;font-weight:700;padding:8px 13px;border-radius:11px;cursor:pointer;transition:.15s}
        .rhq-btn-g:hover{color:var(--rhq-text);transform:translateY(-1px)}
        .rhq-faq{border:1px solid var(--rhq-hair);border-radius:14px;overflow:hidden;background:var(--rhq-panel)}
        .rhq-faq-item{border-bottom:1px solid var(--rhq-hair)}
        .rhq-faq-btn{width:100%;text-align:left;padding:13px 16px;font-size:12.5px;font-weight:700;display:flex;justify-content:space-between;align-items:center;gap:10px;background:none;border:none;cursor:pointer;color:var(--rhq-text)}
        .rhq-faq-chev{transition:.2s;flex-shrink:0}
        .rhq-faq-ans{padding:0 16px 13px;font-size:12px;color:var(--rhq-muted);line-height:1.65;max-width:640px}
        .rhq-disc{background:var(--rhq-panel)}
        .rhq-disc-btn{width:100%;display:flex;justify-content:space-between;align-items:center;gap:12px;padding:12px 16px;background:none;border:none;cursor:pointer}
        .rhq-disc-btn:hover{background:var(--rhq-track)}
        .rhq-disc-label{font-size:10px;font-weight:800;letter-spacing:1.4px;text-transform:uppercase;color:var(--rhq-muted);white-space:nowrap;flex-shrink:0}
        .rhq-disc-label i{font-style:normal}
        .rhq-disc-right{display:flex;align-items:center;gap-8px;margin-left:auto;flex-shrink:0}
        .rhq-disc-sum{font-size:10px;font-weight:700;color:var(--rhq-muted);white-space:nowrap;margin-right:8px;padding:3px 10px;border-radius:99px;background:var(--rhq-track);letter-spacing:.3px}
        .rhq-disc-body{padding:10px 20px 20px}
        .rhq-sec{font-size:10px;font-weight:800;letter-spacing:1.4px;text-transform:uppercase;color:var(--rhq-muted);margin:26px 0 12px}
        .rhq-sec i{font-style:normal}
        .rhq-feat{display:flex;gap:12px;padding:13px 14px;border-radius:13px;background:var(--rhq-panel);border:1px solid var(--rhq-hair);align-items:center}
        .rhq-feat h4{font-size:13px;font-weight:800;color:var(--rhq-text)}
        .rhq-feat p{font-size:11.5px;color:var(--rhq-muted);line-height:1.6;margin-top:3px}
        .rhq-feat-ico{width:32px;height:32px;border-radius:10px;display:flex;align-items:center;justify-content:center;flex-shrink:0}
        .rhq-step{padding:16px;border-right:1px solid var(--rhq-hair)}
        .rhq-step:last-child{border-right:none}
        .rhq-step h4{font-size:12.5px;font-weight:800;color:var(--rhq-text)}
        .rhq-step p{font-size:11px;color:var(--rhq-muted);line-height:1.6;margin-top:4px}
        .rhq-lad{padding:13px 14px;border-radius:12px;border:1px solid var(--rhq-hair);background:var(--rhq-panel)}
        .rhq-lad p{font-size:11px;color:var(--rhq-muted);line-height:1.55;margin-top:3px}
        .rhq-phead{padding:22px 24px;display:flex;justify-content:space-between;align-items:center;gap:14px;flex-wrap:wrap;border-bottom:1px solid var(--rhq-hair)}
        .rhq-keystrip{padding:14px 24px;border-bottom:1px solid var(--rhq-hair);display:flex;gap:10px;align-items:center;flex-wrap:wrap}
        .rhq-keyfield{flex:1;min-width:200px;border-radius:10px;padding:9px 12px;font-size:12px;letter-spacing:.4px}
        .rhq-pill{font-size:10.5px;font-weight:700;padding:4px 10px;border-radius:99px}
        .rhq-cmp-head{display:grid;grid-template-columns:128px 1fr 1fr;gap:0 14px;padding:13px 16px;font-size:11px;font-weight:800}
        .rhq-cmp-row{display:grid;grid-template-columns:128px 1fr 1fr;gap:2px 14px;padding:11px 16px;font-size:12px;line-height:1.55}
        .rhq-cmp-tag{display:none;font-size:8.5px;font-weight:800;letter-spacing:.8px;margin-bottom:3px}
        .rhq-cmp-lab{font-weight:800;text-transform:uppercase;font-size:10px;letter-spacing:.7px;padding-top:2px;color:var(--rhq-muted)}
        .rhq-modal-overlay{position:fixed;inset:0;background:rgba(0,0,0,.5);backdrop-filter:blur(3px);display:flex;align-items:center;justify-content:center;z-index:80;padding:16px}
        .rhq-modal{width:430px;max-width:94vw;max-height:86vh;overflow-y:auto;border-radius:16px;padding:22px}
        .rhq-fl{font-size:9.5px;font-weight:800;letter-spacing:1px;text-transform:uppercase;display:block;margin:11px 0 5px}
        .rhq-fin{width:100%;border-radius:9px;padding:10px 12px;font-size:12.5px;outline:none}
        .rhq-toast{position:fixed;right:18px;bottom:18px;z-index:90;animation:rhqToastIn .25s ease}
        .rhq-toast-inner{width:300px;border-radius:12px;padding:11px 13px}
        .rhq-pcard.active{border-width:1.5px;box-shadow:var(--rhq-shadow);background:var(--rhq-panel)}
        .rhq-pcard:not(.active){background:var(--rhq-card)}
        .rhq-pcard.active.api{border-color:var(--rhq-blue)}
        .rhq-pcard.active.panel{border-color:var(--rhq-accent)}
        .rhq-pcard:not(.active){border-color:var(--rhq-border)}
        .rhq-pcard-num{font-size:10px;font-weight:800;letter-spacing:1.6px}
        .rhq-pcard-title{font-size:20px;font-weight:800;letter-spacing:-.3px;color:var(--rhq-text);margin-top:10px}
        .rhq-pcard-desc{font-size:12.5px;line-height:1.65;color:var(--rhq-muted);margin-top:8px;min-height:60px}
        .rhq-pcard-facts{display:flex;margin-top:16px;padding-top:14px;border-top:1px solid var(--rhq-hair)}
        .rhq-pcard-fact{flex:1;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.4px;color:var(--rhq-muted)}
        .rhq-pcard-fact b{display:block;font-size:14px;font-weight:800;text-transform:none;letter-spacing:0;color:var(--rhq-text);margin-top:2px}
        .rhq-pcard-cta{margin-top:16px;font-size:12px;font-weight:800;display:inline-flex;align-items:center;gap:6px}
        .rhq-sec-head{display:flex;align-items:center;gap:10px;margin-bottom:12px}
        .rhq-sec-label{font-size:10px;font-weight:800;letter-spacing:1.2px;text-transform:uppercase;color:var(--rhq-accent)}
        .rhq-sec-rule{flex:1;height:1px;background:var(--rhq-hair)}
        .rhq-sec-sub{font-size:11px;color:var(--rhq-muted)}
        .rhq-cat{border-radius:13px;padding:16px;background:var(--rhq-card);border:.5px solid var(--rhq-border)}
        .rhq-cat-head{display:flex;align-items:center;gap:10px}
        .rhq-cat-ico{width:32px;height:32px;border-radius:9px;display:flex;align-items:center;justify-content:center;color:#fff;flex-shrink:0}
        .rhq-cat-title{font-size:13.5px;font-weight:800;color:var(--rhq-text);display:flex;align-items:center;gap:8px}
        .rhq-cat-tag{font-size:10.5px;font-weight:600;color:var(--rhq-muted);margin-top:1px}
        .rhq-cat-desc{font-size:11px;line-height:1.6;color:var(--rhq-muted);margin-top:10px}
        .rhq-cat-stats{display:flex;margin-top:12px;padding-top:10px;border-top:1px solid var(--rhq-hair)}
        .rhq-cat-stat{flex:1;font-size:9.5px;font-weight:700;text-transform:uppercase;letter-spacing:.4px;color:var(--rhq-muted)}
        .rhq-cat-stat b{display:block;font-size:12.5px;font-weight:800;text-transform:none;letter-spacing:0;color:var(--rhq-text);margin-top:2px}
        .rhq-switch{display:flex;overflow:hidden;border-top-left-radius:18px;border-top-right-radius:18px;background:var(--rhq-card);border:1px solid var(--rhq-border);border-bottom:none}
        .rhq-switch-btn{flex:1;padding:14px 10px;font-size:13px;font-weight:700;display:flex;align-items:center;justify-content:center;gap:8px;transition:background .15s;border:none;cursor:pointer;background:none}
        .rhq-switch-btn.active.api{background:var(--rhq-bgrad);color:#fff}
        .rhq-switch-btn.active.panel{background:var(--rhq-grad);color:#fff}
        .rhq-switch-btn:not(.active){color:var(--rhq-muted)}
        .rhq-switch-dot{width:7px;height:7px;border-radius:50%}
        .rhq-switch-btn.active .rhq-switch-dot{background:#fff}
        .rhq-switch-btn:not(.active) .rhq-switch-dot{background:currentColor;opacity:.4}
        .rhq-cmp-wrap{border-radius:13px;overflow:hidden;border:1px solid var(--rhq-hair);background:var(--rhq-panel)}
        .rhq-cmp-foot{text-align:center;margin-top:10px;font-size:11px;color:var(--rhq-muted)}
        .rhq-badge-sm{font-size:9px;font-weight:800;padding:2px 6px;border-radius:99px;background:var(--rhq-accent-soft2);color:var(--rhq-accent)}
        .rhq-badge-active{font-size:9.5px;font-weight:800;padding:2px 8px;border-radius:99px;margin-left:8px;background:var(--rhq-green-soft);color:var(--rhq-green)}
        .rhq-reassure{display:flex;gap:16px;flex-wrap:wrap;justify-content:center;margin-top:14px;font-size:11.5px;color:var(--rhq-muted)}
        @keyframes rhqToastIn{from{opacity:0;transform:translateX(14px)}to{opacity:1;transform:none}}
        @media(max-width:860px){
          .rhq-grid2{grid-template-columns:1fr!important}
          .rhq-feats{grid-template-columns:1fr!important}
          .rhq-steps{grid-template-columns:1fr!important}
          .rhq-step{border-right:none;border-bottom:1px solid var(--rhq-hair)}
          .rhq-step:last-child{border-bottom:none}
          .rhq-ladder{grid-template-columns:1fr!important}
          .rhq-pick{grid-template-columns:1fr!important}
          .rhq-build{grid-template-columns:1fr!important}
          .rhq-bmenu{flex-direction:row!important;border-right:none!important;border-bottom:1px solid var(--rhq-hair)!important}
          .rhq-bopt{border-bottom:none!important;border-right:1px solid var(--rhq-hair)!important}
          .rhq-bopt:last-child{border-right:none!important}
          .rhq-hero h1{font-size:23px!important}
          .rhq-disc{margin-top:10px!important}
          .rhq-disc-sum{display:none!important}
          .rhq-cmp-head{display:none!important}
          .rhq-cmp-row{grid-template-columns:1fr 1fr!important;padding:0!important;gap:0!important;border-bottom:none!important}
          .rhq-cmp-row+.rhq-cmp-row{margin-top:2px}
          .rhq-cmp-lab{grid-column:1/-1!important;padding:12px 16px 6px!important;border-radius:0!important;background:var(--rhq-track)!important;font-size:11.5px!important;letter-spacing:1px!important}
          .rhq-cmp-val{padding:6px 16px 14px!important;font-size:12.5px!important}
          .rhq-cmp-tag{display:block!important}
          .rhq-phead{flex-direction:column;align-items:flex-start!important}
          .rhq-earn{grid-template-columns:1fr!important}
          .rhq-sec-sub{display:none!important}
          .rhq-pcard h3{font-size:17px!important}
          .rhq-pcard-desc{font-size:11.5px!important;min-height:0!important}
        }
      `}</style>
      <div className={embedded ? '' : 'min-h-dvh flex flex-col'} style={{ ...cssVars, ...(embedded ? {} : { background: t.bg }) }}>
        {!embedded && <SharedNav />}

        {/* Hero — public page only */}
        {embedded ? null : (
          <div className="rhq-hero relative overflow-hidden text-center" style={{ padding: '48px 24px 56px' }}>
            <div className="absolute pointer-events-none" style={{ width: 560, height: 560, borderRadius: 99, top: -360, right: -140, background: `radial-gradient(circle, ${accentSoft2} 0%, transparent 66%)` }} />
            <div className="relative max-w-[700px] mx-auto">
              <span className="inline-flex items-center gap-1.5 text-[11px] font-extrabold tracking-[1.4px] uppercase rounded-full py-1 px-3" style={{ color: accent, background: accentSoft2 }}>Reseller HQ</span>
              <h1 className="font-extrabold mt-3.5 leading-[1.15]" style={{ fontSize: 'clamp(26px, 5vw, 33px)', letterSpacing: '-.8px', color: t.text }}>Build your business on Nitro</h1>
              <p className="text-[15px] leading-[1.7] max-w-[640px] mx-auto mt-2.5" style={{ color: muted }}>
                Two products, one wallet. Plug our <b style={{ color: soft }}>API</b> into a panel you already run, or launch a <b style={{ color: soft }}>ready-made panel</b> on Nitro's system with your brand on the door. Reseller pricing on both.
              </p>
              <div className="flex gap-4 flex-wrap mt-4 justify-center" style={{ fontSize: 11, color: muted }}>
                {['API access is free, no application', 'Panel unlocks instantly with wallet balance', 'Everything settles in Naira'].map(txt => (
                  <span key={txt} className="inline-flex items-center gap-1.5"><span style={{ color: green }}><Chk /></span>{txt}</span>
                ))}
              </div>
            </div>
          </div>
        )}

        <main className={embedded ? 'pb-8' : 'flex-1 px-4 sm:px-6 pb-20 max-w-[960px] mx-auto w-full'}>

          {/* Product Pick Cards — primary decision point */}
          <div className="rhq-pick grid grid-cols-2 gap-4 relative z-[5]" style={{ marginTop: embedded ? 0 : -32 }}>
            {[
              { id: 'api', num: 'PRODUCT 01 · FOR PANEL OWNERS', title: 'API Access', desc: "You already have a panel, a bot, or a script. Point it at Nitro and fulfil through us at reseller rates. Full natural speed, never queued behind gradual delivery.", facts: [['Entry', 'Free'], ['Setup', 'Instant key'], ['Delivery', 'Full speed']], active: hasKey },
              { id: 'panel', num: 'PRODUCT 02 · FOR NEW OWNERS', title: 'Your Own Panel', desc: "No panel? Start one. A white-label storefront on Nitro's engine: your own domain or a free subdomain, your prices, your customers. We build it, we fulfil it, you sell.", facts: [['Entry', 'From ₦30k/mo'], ['Setup', 'We build it'], ['Delivery', 'Gradual on Pro']], active: false },
            ].map(p => (
              <button key={p.id} className={`rhq-pcard ${p.id} ${prod === p.id ? 'active' : ''}`} onClick={() => setProd(p.id)}>
                <div className="rhq-pcard-num" style={{ color: `var(--rhq-${p.id === 'api' ? 'blue' : 'accent'})` }}>
                  {p.num}
                  {p.active && <span className="rhq-badge-active">● ACTIVE</span>}
                </div>
                <h3 className="rhq-pcard-title">{p.title}</h3>
                <div className="rhq-pcard-desc">{p.desc}</div>
                <div className="rhq-pcard-facts">
                  {p.facts.map(([l, v]) => (
                    <div key={l} className="rhq-pcard-fact">{l}<b>{v}</b></div>
                  ))}
                </div>
                <span className="rhq-pcard-cta" style={{ color: `var(--rhq-${p.id === 'api' ? 'blue' : 'accent'})` }}>
                  Explore {p.id === 'api' ? 'API access' : 'your panel'} <Arrow />
                </span>
              </button>
            ))}
          </div>

          {/* Reassurance strip — below cards */}
          <div className="rhq-reassure">
            {['API access is free, no application', 'Panel unlocks instantly with wallet balance', 'Everything settles in Naira'].map(txt => (
              <span key={txt} className="inline-flex items-center gap-1.5">
                <span style={{ color: 'var(--rhq-green)' }}><Chk /></span>{txt}
              </span>
            ))}
          </div>

          {/* Product Detail — secondary, the deep-dive after picking */}
          <section className="mt-8">
            <div className="rhq-switch">
              {[['api', '01 · API Access'], ['panel', '02 · Your Own Panel']].map(([id, label]) => (
                <button key={id} onClick={() => setProd(id)} className={`rhq-switch-btn ${id} ${prod === id ? 'active' : ''}`}>
                  <span className="rhq-switch-dot" />
                  {label}
                </button>
              ))}
            </div>

            {prod === 'api' ? (
              <ApiBlock hasKey={hasKey} keyShown={keyShown} setKeyShown={setKeyShown} catalog={catalog} setCatalog={setCatalog} buildMode={buildMode} setBuildMode={setBuildMode} generateKey={generateKey} showToast={showToast} dark={dark} t={t} colors={colors} />
            ) : (
              <PanelBlock markup={markup} setMarkup={setMarkup} showModal={() => setShowModal(true)} showToast={showToast} dark={dark} t={t} colors={colors} />
            )}
          </section>

          {/* Catalogs — supporting info, quieter */}
          <section className="mt-8">
            <div className="rhq-sec-head">
              <span className="rhq-sec-label">Catalogs</span>
              <span className="rhq-sec-rule" />
              <span className="rhq-sec-sub">Both products sell from the same list</span>
            </div>
            <div className="rhq-grid2 grid grid-cols-2 gap-3">
              {[
                { title: 'Nitro Curated', badge: 'DEFAULT', tagline: 'The catalog we stake our name on', desc: 'Hand-picked, stress-tested services sorted into Budget, Standard and Premium tiers. Refill-backed where it counts.', stats: [['Services', '~140'], ['Structure', '3 tiers'], ['Refill', '30d / life']], color: 'var(--rhq-grad)' },
                { title: 'Full Catalogue', badge: null, tagline: 'Everything our providers can reach', desc: 'The raw list across every connected provider: thousands of services, every platform, every niche.', stats: [['Services', '3,400+'], ['Platforms', '35+'], ['Providers', '3']], color: 'var(--rhq-bgrad)' },
              ].map(c => (
                <div key={c.title} className="rhq-cat">
                  <div className="rhq-cat-head">
                    <div className="rhq-cat-ico" style={{ background: c.color }}>
                      <Ico d={c.badge ? 'M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5' : 'M12 2a10 10 0 100 20 10 10 0 000-20zM2 12h20M12 2a15 15 0 014 10 15 15 0 01-4 10 15 15 0 01-4-10 15 15 0 014-10z'} size={13} />
                    </div>
                    <div>
                      <h3 className="rhq-cat-title">
                        {c.title}
                        {c.badge && <span className="rhq-badge-sm">{c.badge}</span>}
                      </h3>
                      <div className="rhq-cat-tag">{c.tagline}</div>
                    </div>
                  </div>
                  <p className="rhq-cat-desc">{c.desc}</p>
                  <div className="rhq-cat-stats">
                    {c.stats.map(([l, v]) => (
                      <div key={l} className="rhq-cat-stat">{l}<b>{v}</b></div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Compare — supporting info, quieter */}
          <section className="mt-8">
            <div className="rhq-sec-head">
              <span className="rhq-sec-label">Side by side</span>
              <span className="rhq-sec-rule" />
            </div>
            <div className="rhq-cmp-wrap">
              <div className="rhq-cmp-head" style={{ borderBottom: `1px solid var(--rhq-hair)` }}>
                <span /><span style={{ color: 'var(--rhq-blue)' }}>API ACCESS</span><span style={{ color: 'var(--rhq-accent)' }}>YOUR PANEL</span>
              </div>
              {COMPARE_ROWS.map(([label, api, panelVal], i) => (
                <div className="rhq-cmp-row" key={i} style={{ borderBottom: i < COMPARE_ROWS.length - 1 ? '1px solid var(--rhq-hair)' : 'none', color: 'var(--rhq-soft)' }}>
                  <span className="rhq-cmp-lab">{label}</span>
                  <span className="rhq-cmp-val"><span className="rhq-cmp-tag" style={{ color: 'var(--rhq-blue)' }}>API ACCESS</span>{api}</span>
                  <span className="rhq-cmp-val"><span className="rhq-cmp-tag" style={{ color: 'var(--rhq-accent)' }}>YOUR PANEL</span>{panelVal}</span>
                </div>
              ))}
            </div>
            <div className="rhq-cmp-foot">Running both? One wallet, one volume ladder, two revenue streams.</div>
          </section>

          {/* Closer CTA */}
          <div className="mt-9 p-6 rounded-2xl text-white flex justify-between items-center gap-4 flex-wrap" style={{ background: grad }}>
            <div>
              <h3 className="text-[18px] font-extrabold">{hasKey ? "Key's live. Go sell." : 'Start where you are.'}</h3>
              <p className="text-xs opacity-90 mt-1">{hasKey ? 'Docs cover all six endpoints with copy-paste examples.' : "Got a panel? Grab a key. Don't? Fund the wallet and we'll build yours."}</p>
            </div>
            <div className="flex gap-2">
              {hasKey ? (
                <>
                  <button className="rhq-btn-p" onClick={() => showToast('Opening API documentation')} style={{ background: '#fff', color: '#8b5e6b' }}>Read the docs</button>
                  <button className="rhq-btn-p" onClick={() => setProd('panel')} style={{ background: 'rgba(255,255,255,.18)', color: '#fff' }}>See the panel</button>
                </>
              ) : (
                <>
                  <button className="rhq-btn-p" onClick={generateKey} style={{ background: '#fff', color: '#8b5e6b' }}>Generate free API key</button>
                  <button className="rhq-btn-p" onClick={() => setProd('panel')} style={{ background: 'rgba(255,255,255,.18)', color: '#fff' }}>See the panel</button>
                </>
              )}
            </div>
          </div>
        </main>

        {!embedded && <SharedFooter />}
      </div>

      {/* Toast */}
      {toast && (
        <div className="rhq-toast">
          <div className="rhq-toast-inner" style={{ background: panel, border: `1px solid ${accentSoft2}`, borderLeft: `3px solid ${accent}`, boxShadow: shadow }}>
            <div className="text-xs font-bold" style={{ color: t.text }}>{toast.title}</div>
            {toast.detail && <div className="text-[11px] mt-0.5 m break-all" style={{ color: muted }}>{toast.detail}</div>}
          </div>
        </div>
      )}

      {/* Setup Modal */}
      {showModal && (
        <div onClick={e => { if (e.target === e.currentTarget) setShowModal(false); }} className="rhq-modal-overlay">
          <div className="rhq-modal" style={{ background: panel, border: `1px solid ${border}`, boxShadow: shadow }}>
            <h3 className="text-base font-extrabold mb-1.5" style={{ color: t.text }}>Set up your panel</h3>
            <p className="text-xs leading-[1.6] mb-3" style={{ color: muted }}>From {N(PANEL_STARTER)}/month (Starter) or {N(PANEL_PRO)}/month (Pro with gradual delivery). Auto-charged from your wallet. Usually live within 48 hours.</p>
            <div className="flex gap-1.5 mb-1">
              {[['sub', 'Free subdomain'], ['own', 'My own domain']].map(([m, l]) => (
                <button key={m} onClick={() => setDomainMode(m)} className="flex-1 py-2 px-2 rounded-[9px] text-[11px] font-bold" style={{ border: `1px solid ${domainMode === m ? accent : border}`, color: domainMode === m ? accent : muted, background: domainMode === m ? accentSoft : 'none' }}>{l}</button>
              ))}
            </div>
            {domainMode === 'sub' ? (
              <>
                <label className="rhq-fl" style={{ color: muted }}>Choose your subdomain</label>
                <input value={subValue} onChange={e => setSubValue(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))} placeholder="yourbrand" className="rhq-fin m" style={{ background: code, border: `1px solid ${border}`, color: t.text }} />
                <div className="text-[11px] mt-1" style={{ color: muted }}>Your storefront: <span className="m">{subValue || 'yourbrand'}.nitro.ng</span></div>
              </>
            ) : (
              <>
                <label className="rhq-fl" style={{ color: muted }}>Your domain</label>
                <input placeholder="yourbrand.com" className="rhq-fin m" style={{ background: code, border: `1px solid ${border}`, color: t.text }} />
                <div className="mt-2 p-2.5 rounded-[9px] text-[11px] leading-[1.7]" style={{ background: accentSoft, border: `1px dashed ${accentSoft2}`, color: soft }}>
                  Point your domain's nameservers to <b className="m">ns1.nitro.ng</b> and <b className="m">ns2.nitro.ng</b>. We handle SSL and everything else.
                </div>
              </>
            )}
            <label className="rhq-fl" style={{ color: muted }}>Storefront currency</label>
            <select className="rhq-fin" style={{ background: code, border: `1px solid ${border}`, color: t.text }}>{CURRENCIES.map(c => <option key={c}>{c}</option>)}</select>
            <div className="text-[11px] mt-1" style={{ color: muted }}>What your customers see and pay in. Your Nitro wallet stays in Naira.</div>
            <label className="rhq-fl" style={{ color: muted }}>Admin username</label>
            <input placeholder="bella_admin" className="rhq-fin" style={{ background: code, border: `1px solid ${border}`, color: t.text }} />
            <div className="grid grid-cols-2 gap-2">
              <div><label className="rhq-fl" style={{ color: muted }}>Admin password</label><input type="password" className="rhq-fin" style={{ background: code, border: `1px solid ${border}`, color: t.text }} /></div>
              <div><label className="rhq-fl" style={{ color: muted }}>Confirm</label><input type="password" className="rhq-fin" style={{ background: code, border: `1px solid ${border}`, color: t.text }} /></div>
            </div>
            <div className="flex gap-2 justify-end mt-3.5">
              <button onClick={() => setShowModal(false)} className="rhq-btn-g" style={{ border: `1px solid ${border}`, color: soft, background: card }}>Cancel</button>
              <button onClick={() => { setShowModal(false); showToast('Panel started', 'Build underway, live within 48 hours'); }} className="rhq-btn-p" style={{ background: grad, color: '#fff', boxShadow: '0 5px 16px rgba(196,125,142,.28)' }}>Start build</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function ApiBlock({ hasKey, keyShown, setKeyShown, catalog, setCatalog, buildMode, setBuildMode, generateKey, showToast, dark, t, colors }) {
  const { blue, green, muted, soft, border, hair, card, panel, accentSoft2, blueSoft, blueSoft2, greenSoft, track, code, bgrad, shadow } = colors;
  const masked = '•••••••••••••••' + MOCK_KEY.slice(-8);
  const [openId, setOpenId] = useState(null);

  return (
    <div className="rounded-b-[18px] overflow-hidden" style={{ border: `1px solid ${border}`, background: card }}>
      <div className="rhq-phead" style={{ background: `linear-gradient(135deg, ${blueSoft} 0%, transparent 55%)` }}>
        <div>
          {hasKey ? (
            <span className="text-[11px] font-extrabold py-1.5 px-3 rounded-full" style={{ background: greenSoft, color: green }}>● KEY ACTIVE</span>
          ) : (
            <>
              <div className="text-[28px] font-extrabold m" style={{ letterSpacing: '-.5px', color: blue }}>Free</div>
              <div className="text-[11px] mt-0.5" style={{ color: muted }}>no application · instant key</div>
            </>
          )}
        </div>
        <div className="text-xs text-right max-w-[400px] leading-[1.6]" style={{ color: muted }}>For the reseller who already has somewhere to sell</div>
      </div>

      <div className="rhq-keystrip" style={{ background: blueSoft }}>
        <span className="text-[11px] font-extrabold tracking-[1.2px] shrink-0" style={{ color: blue }}>YOUR API KEY</span>
        {hasKey ? (
          <>
            <div className="rhq-keyfield m" style={{ background: code, border: `1px solid ${border}`, color: soft }}>{keyShown ? MOCK_KEY : masked}</div>
            <div className="flex gap-2 flex-wrap ml-auto">
              <button onClick={() => setKeyShown(!keyShown)} className="rhq-btn-g" style={{ border: `1px solid ${border}`, color: soft, background: card }}>{keyShown ? 'Hide' : 'Reveal'}</button>
              <button onClick={() => showToast('API key copied', MOCK_KEY)} className="rhq-btn-g" style={{ border: `1px solid ${border}`, color: soft, background: card }}>Copy</button>
              <button onClick={() => showToast('Opening API documentation')} className="rhq-btn-g" style={{ border: `1px solid ${border}`, color: soft, background: card }}>API docs</button>
              <button onClick={() => showToast('Key regenerated', 'Old key is now dead')} className="rhq-btn-g" style={{ border: `1px solid ${border}`, color: dark ? '#fca5a5' : '#dc2626', background: card }}>Regenerate</button>
            </div>
          </>
        ) : (
          <>
            <span className="flex-1 min-w-[190px] text-xs" style={{ color: muted }}>None yet. Access is free and instant, no application.</span>
            <div className="flex gap-2 flex-wrap ml-auto">
              <button onClick={generateKey} className="rhq-btn-p" style={{ background: bgrad, color: '#fff', boxShadow: '0 5px 16px rgba(37,99,235,.25)' }}>Generate API key</button>
              <button onClick={() => showToast('Opening API documentation')} className="rhq-btn-g" style={{ border: `1px solid ${border}`, color: soft, background: card }}>API docs</button>
            </div>
          </>
        )}
      </div>

      <div className="px-4 pt-3 pb-5">
        <Disclosure id="a1" num="01" label="What you get" color={blue} summary="4 features" border={hair} openId={openId} setOpenId={setOpenId}>
          <div className="rhq-feats grid grid-cols-2 gap-2.5">
            {API_FEATURES.map(([path, title, desc]) => (
              <div key={title} className="rhq-feat">
                <div className="rhq-feat-ico" style={{ background: blueSoft2, color: blue }}><Ico d={path} /></div>
                <div><h4>{title}</h4><p>{desc}</p></div>
              </div>
            ))}
          </div>
        </Disclosure>

        <Disclosure id="a2" num="02" label="Your rates" color={blue} summary="Pricing + volume ladder" border={hair} openId={openId} setOpenId={setOpenId}>
          <div className="flex justify-between items-center gap-2.5 flex-wrap mb-2.5">
            <span className="text-xs" style={{ color: muted }}>Your key serves the list you pick here. Switch anytime.</span>
            <div className="flex gap-1 rounded-[10px] p-0.5" style={{ background: track }}>
              {[['curated', 'Curated tiers'], ['full', 'Full providers']].map(([id, label]) => (
                <button key={id} onClick={() => setCatalog(id)} className="text-[11px] font-extrabold py-1.5 px-3 rounded-lg" style={{ color: catalog === id ? blue : muted, background: catalog === id ? panel : 'none', boxShadow: catalog === id ? '0 1px 3px rgba(0,0,0,.1)' : 'none' }}>{label}</button>
              ))}
            </div>
          </div>
          <div className="rounded-[14px] overflow-hidden" style={{ border: `1px solid ${hair}`, background: panel }}>
            <div className="grid grid-cols-[1fr_auto_auto] gap-3.5 px-4 py-2.5 text-[11px] font-extrabold uppercase tracking-[1px]" style={{ color: muted, borderBottom: `1px solid ${hair}` }}>
              <span>Sample services · per 1,000</span><span>Retail</span><span className="text-right">Your rate</span>
            </div>
            {SAMPLE_RATES.map(([name, retail, reseller]) => (
              <div key={name} className="grid grid-cols-[1fr_auto_auto] gap-3.5 px-4 py-2.5 items-center text-xs" style={{ color: soft, borderBottom: `1px solid ${hair}` }}>
                <span>{name}</span>
                <span className="text-xs m text-right line-through" style={{ color: muted }}>{N(retail)}</span>
                <span className="text-[13px] font-extrabold m text-right min-w-[86px]" style={{ color: blue }}>{N(reseller)}</span>
              </div>
            ))}
            <div className="px-4 py-2.5 text-[11px]" style={{ color: muted }}>
              {catalog === 'curated' ? 'Plus the rest of the curated list, ~140 tiered services.' : 'Plus 3,400+ raw provider services across 35+ platforms.'} Pull live prices with <code className="text-[11px] py-px px-1 rounded" style={{ background: track }}>services</code>
            </div>
          </div>
          <div className="rhq-ladder grid grid-cols-3 gap-2.5 mt-3">
            {[
              ['STARTER', 'Under ₦250k / month', 'Base reseller rates, already below retail on every service.'],
              ['GROWTH', '₦250k – ₦1m / month', 'A deeper discount unlocks automatically. No renegotiation.'],
              ['SCALE', '₦1m+ / month', 'Our best rates, plus priority support.'],
            ].map(([name, threshold, desc]) => (
              <div key={name} className="rhq-lad">
                <span className="text-[11px] font-extrabold tracking-[1.2px]" style={{ color: blue }}>{name}</span>
                <b className="block text-[13px] font-extrabold mt-1" style={{ color: t.text }}>{threshold}</b>
                <p>{desc}</p>
              </div>
            ))}
          </div>
        </Disclosure>

        <Disclosure id="a3" num="03" label="Setup guide" color={blue} summary="Panels or custom code" border={hair} openId={openId} setOpenId={setOpenId}>
          <div className="rhq-build grid overflow-hidden rounded-[14px]" style={{ gridTemplateColumns: '236px 1fr', border: `1px solid ${hair}`, background: panel }}>
            <div className="rhq-bmenu flex flex-col" style={{ borderRight: `1px solid ${hair}` }}>
              {[
                ['std', 'Standard panels & scripts', "Ready-made panel software already speaks our language. Paste two values and you're live."],
                ['custom', 'Building your own', 'Custom bot or dashboard? Six endpoints cover ordering, status, refills and balance.'],
              ].map(([id, title, desc]) => (
                <button key={id} className="rhq-bopt text-left p-4 flex-1" style={{ borderBottom: `1px solid ${hair}`, background: buildMode === id ? blueSoft : 'none' }} onClick={() => setBuildMode(id)}>
                  <h5 className="text-xs font-extrabold flex items-center gap-2" style={{ color: buildMode === id ? blue : t.text }}>
                    <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: buildMode === id ? blue : muted, opacity: buildMode === id ? 1 : .35 }} />{title}
                  </h5>
                  <p className="text-[11px] leading-[1.55] mt-1" style={{ color: muted }}>{desc}</p>
                </button>
              ))}
            </div>
            <div className="p-4 min-w-0">
              {buildMode === 'std' ? (
                <>
                  <div className="text-[11px] font-extrabold tracking-[1px] uppercase mb-2.5" style={{ color: muted }}>Your panel's provider settings. That's the whole setup</div>
                  {[['API URL', 'https://nitro.ng/api/v2'], ['API Key', hasKey ? MOCK_KEY : 'ntr_live_ · · ·  generate yours above'], ['Then', 'Hit "sync services", set your margins, done.']].map(([label, value]) => (
                    <div key={label} className="flex items-center gap-2.5 rounded-[10px] px-3 py-2.5 mb-2" style={{ background: code, border: `1px solid ${hair}` }}>
                      <span className="w-16 shrink-0 text-[11px] font-extrabold tracking-[.8px] uppercase" style={{ color: label === 'Then' ? green : muted }}>{label}</span>
                      <span className={`text-[11px] overflow-hidden text-ellipsis whitespace-nowrap ${label !== 'Then' ? 'm' : ''}`} style={{ color: soft }}>{value}</span>
                    </div>
                  ))}
                  <div className="flex gap-1.5 flex-wrap mt-3">
                    {['service / link / quantity', 'same fields every panel uses', 'zero custom code'].map(s => (
                      <span key={s} className="rhq-pill" style={{ background: track, color: soft }}>{s}</span>
                    ))}
                  </div>
                </>
              ) : (
                <>
                  <div className="text-[11px] font-extrabold tracking-[1px] uppercase mb-2.5" style={{ color: muted }}>Same key, full toolset</div>
                  <div className="rounded-[11px] p-3 text-[11px] leading-[1.75] overflow-x-auto relative m" style={{ background: code, border: `1px solid ${hair}`, color: soft }}>
                    <button onClick={() => showToast('Example copied')} className="absolute top-2 right-2 text-[11px] font-bold py-1 px-2.5 rounded-[7px]" style={{ background: track, color: muted, border: `1px solid ${hair}` }}>Copy</button>
                    <pre className="m-0 whitespace-pre-wrap">
                      <span style={{ color: muted }}># place an order</span>{'\n'}
                      curl -X POST https://nitro.ng/api/v2 \{'\n'}
                      {'  '}-d <span style={{ color: blue }}>key</span>={hasKey ? 'YOUR_KEY' : 'ntr_live_…'} \{'\n'}
                      {'  '}-d <span style={{ color: blue }}>action</span>=add \{'\n'}
                      {'  '}-d <span style={{ color: blue }}>service</span>=3877 \{'\n'}
                      {'  '}-d <span style={{ color: blue }}>link</span>=https://instagram.com/client \{'\n'}
                      {'  '}-d <span style={{ color: blue }}>quantity</span>=1000{'\n'}
                      <span style={{ color: muted }}># =&gt; {'{"order": 4211}'}</span>
                    </pre>
                  </div>
                  <div className="flex gap-1.5 flex-wrap mt-3">
                    {['services', 'add', 'status', 'refill', 'balance', 'cancel'].map(s => (
                      <span key={s} className="rhq-pill" style={{ background: track, color: soft }}>{s}</span>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </Disclosure>

        <Disclosure id="a4" num="04" label="Live in four steps" color={blue} summary="Key → prices → orders → scale" border={hair} openId={openId} setOpenId={setOpenId}>
          <div className="flex flex-col gap-0">
            {[
              ['Generate your key', 'One click, right here. No application, every Nitro account qualifies.'],
              ['Fetch services & prices', 'Pull the catalog with your reseller rates, set your margins on top.'],
              ['Place orders', 'From your panel, bot or code. Orders charge your Nitro wallet.'],
              ['Track & scale', 'Poll status live. Volume climbs, rates improve automatically.'],
            ].map(([title, desc], i) => (
              <div key={i} className="flex gap-3 items-start py-2.5" style={{ borderBottom: i < 3 ? `1px solid ${hair}` : 'none' }}>
                <span className="text-[11px] font-extrabold shrink-0 w-5 text-center mt-px" style={{ color: blue }}>{i + 1}</span>
                <div>
                  <div className="text-[13px] font-extrabold" style={{ color: t.text }}>{title}</div>
                  <div className="text-[11px] leading-[1.6] mt-0.5" style={{ color: muted }}>{desc}</div>
                </div>
              </div>
            ))}
          </div>
        </Disclosure>

        <Disclosure id="a5" num="05" label="FAQ" color={blue} summary={`${API_FAQ.length} questions`} border={hair} openId={openId} setOpenId={setOpenId}>
          <FaqBlock items={API_FAQ} accentVar={blue} />
        </Disclosure>
      </div>
    </div>
  );
}

function PanelBlock({ markup, setMarkup, showModal, showToast, dark, t, colors }) {
  const { green, muted, soft, border, hair, card, panel, accent, accentSoft, accentSoft2, greenSoft, track, code, grad, shadow } = colors;
  const [openId, setOpenId] = useState(null);
  const [tier, setTier] = useState('starter');
  const tierPrice = tier === 'pro' ? PANEL_PRO : PANEL_STARTER;

  return (
    <div className="rounded-b-[18px] overflow-hidden" style={{ border: `1px solid ${border}`, background: card }}>
      <div className="rhq-phead" style={{ background: `linear-gradient(135deg, ${accentSoft} 0%, transparent 55%)` }}>
        <div>
          <div className="text-[11px] mt-0.5" style={{ color: muted }}>A white-label storefront on Nitro's system, with your name on it</div>
        </div>
      </div>

      {/* Tier picker */}
      <div className="grid grid-cols-2 gap-3 px-5 py-4" style={{ borderBottom: `1px solid ${hair}` }}>
        {[
          { id: 'starter', name: 'Starter', price: PANEL_STARTER, features: ['Free subdomain', 'White-label storefront', 'Full speed delivery', 'Your pricing & customers'] },
          { id: 'pro', name: 'Pro', price: PANEL_PRO, features: ['Own domain or subdomain', 'Everything in Starter', 'Gradual delivery engine', 'Priority support'] },
        ].map(p => (
          <button key={p.id} onClick={() => setTier(p.id)} className="text-left rounded-[13px] p-4 transition-all duration-150" style={{ border: `1.5px solid ${tier === p.id ? accent : hair}`, background: tier === p.id ? accentSoft : 'none' }}>
            <div className="flex items-center justify-between gap-2 mb-2">
              <span className="text-[11px] font-extrabold tracking-[1.2px] uppercase" style={{ color: tier === p.id ? accent : muted }}>{p.name}</span>
              {p.id === 'pro' && <span className="text-[11px] font-extrabold py-0.5 px-2 rounded-full" style={{ background: accentSoft2, color: accent }}>+ GRADUAL</span>}
            </div>
            <div className="text-[22px] font-extrabold m" style={{ color: tier === p.id ? accent : t.text, letterSpacing: '-.3px' }}>
              {N(p.price)}<span className="text-[11px] font-bold" style={{ color: muted }}>/mo</span>
            </div>
            <div className="flex flex-col gap-1 mt-2.5">
              {p.features.map(f => (
                <div key={f} className="flex items-center gap-1.5 text-[11px]" style={{ color: soft }}>
                  <span style={{ color: tier === p.id ? accent : green }}><Chk /></span>{f}
                </div>
              ))}
            </div>
          </button>
        ))}
      </div>

      <div className="px-4 pt-3 pb-5">
        <Disclosure id="p1" num="01" label="What you get" color={accent} summary="8 features" border={hair} openId={openId} setOpenId={setOpenId}>
          <div className="rhq-feats grid grid-cols-2 gap-2.5">
            {PANEL_FEATURES.map(([path, title, desc, badge]) => (
              <div key={title} className="rhq-feat">
                <div className="rhq-feat-ico" style={{ background: accentSoft2, color: accent }}><Ico d={path} /></div>
                <div>
                  <h4>
                    {title}
                    {badge && <span className="text-[11px] font-extrabold tracking-[.6px] py-0.5 px-1.5 rounded-full ml-1.5" style={{ background: accentSoft2, color: accent }}>{badge}</span>}
                  </h4>
                  <p>{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </Disclosure>

        <Disclosure id="p2" num="02" label="What you'd earn" color={accent} summary="Earnings calculator" border={hair} openId={openId} setOpenId={setOpenId}>
          <div className="rounded-[14px] p-4" style={{ border: `1px solid ${hair}`, background: panel }}>
            <div className="flex justify-between items-center gap-2.5 flex-wrap text-xs" style={{ color: muted }}>
              <span>Example: <b style={{ color: t.text }}>Instagram Followers</b> · fulfilment <b className="m" style={{ color: t.text }}>{N(EARN_COST)}</b>/1k</span>
              <span className="rounded-full py-1 px-3 font-extrabold text-[11px] whitespace-nowrap" style={{ background: accentSoft2, color: accent }}>Markup <b className="m">{markup}%</b></span>
            </div>
            <input type="range" min={10} max={100} step={5} value={markup} onChange={e => setMarkup(Number(e.target.value))} className="w-full mt-3" style={{ accentColor: accent }} />
            <div className="flex justify-between text-[11px] mt-0.5" style={{ color: muted }}><span>10%</span><span>100%</span></div>
            <div className="rhq-earn grid grid-cols-3 gap-2.5 mt-3">
              {[
                ['Customer pays / 1k', N(EARN_COST * (1 + markup / 100)), t.text],
                ['Fulfilment / 1k', N(EARN_COST), muted],
                ['You keep / 1k', N(EARN_COST * markup / 100), green],
              ].map(([label, value, color]) => (
                <div key={label} className="rounded-[11px] p-3" style={{ background: card, border: `1px solid ${hair}` }}>
                  <div className="text-[11px] font-extrabold tracking-[.8px] uppercase" style={{ color: muted }}>{label}</div>
                  <div className="text-base font-extrabold mt-0.5 m" style={{ color }}>{value}</div>
                </div>
              ))}
            </div>
            <div className="text-[11px] mt-2.5" style={{ color: muted }}>Markup is per service, set by you, changeable anytime. Customer pays you in your bank; fulfilment draws from your wallet.</div>
          </div>
        </Disclosure>

        <Disclosure id="p3" num="03" label="How it starts" color={accent} summary="Fund → setup → build → sell" border={hair} openId={openId} setOpenId={setOpenId}>
          <div className="flex flex-col gap-0">
            {[
              ['Pick your plan', `Starter at ${N(PANEL_STARTER)}/mo or Pro at ${N(PANEL_PRO)}/mo with gradual delivery. Charged from your wallet.`],
              ['Set up your panel', 'Domain (yours or a free subdomain), storefront currency and your admin login. One form.'],
              ['We build it', 'Live within 48 hours. Own domains follow once your nameservers propagate.'],
              ['Set prices & sell', 'Choose your markup, switch on gradual delivery if you want it, open the doors.'],
            ].map(([title, desc], i) => (
              <div key={i} className="flex gap-3 items-start py-2.5" style={{ borderBottom: i < 3 ? `1px solid ${hair}` : 'none' }}>
                <span className="text-[11px] font-extrabold shrink-0 w-5 text-center mt-px" style={{ color: accent }}>{i + 1}</span>
                <div>
                  <div className="text-[13px] font-extrabold" style={{ color: t.text }}>{title}</div>
                  <div className="text-[11px] leading-[1.6] mt-0.5" style={{ color: muted }}>{desc}</div>
                </div>
              </div>
            ))}
          </div>
        </Disclosure>

        <Disclosure id="p4" num="04" label="Questions, answered" color={accent} summary={`${PANEL_FAQ.length} questions`} border={hair} openId={openId} setOpenId={setOpenId}>
          <FaqBlock items={PANEL_FAQ} accentVar={accent} />
        </Disclosure>

        <div className="mt-5 flex gap-2.5 flex-wrap items-center">
          <button onClick={showModal} className="rhq-btn-p" style={{ background: grad, color: '#fff', boxShadow: '0 5px 16px rgba(196,125,142,.28)' }}>Start my panel now</button>
          <a href="https://wa.me/2347071656156" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-xs font-bold py-2.5 px-4 rounded-[11px] no-underline" style={{ border: '1px solid rgba(37,211,102,.4)', color: dark ? '#25d366' : '#1e9e50', background: 'rgba(37,211,102,.12)' }}>
            <svg width={15} height={15} viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.52.149-.174.198-.298.297-.497.1-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" /></svg>
            Ask a question first
          </a>
        </div>
        <div className="text-[11px] mt-2.5" style={{ color: muted }}>Renews monthly from your wallet. If a renewal can't be covered, your panel pauses, never deleted, until you top up.</div>
      </div>
    </div>
  );
}

function SecLabel({ num, label, color }) {
  return <div className="rhq-sec"><i style={{ color }}>{num}</i> · {label}</div>;
}
