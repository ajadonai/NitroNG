'use client';
import { useState, useEffect, useRef } from 'react';
import { useT } from "./locale";
import { msg } from "../lib/i18n";
import { ThemeProvider, useTheme } from './shared-nav';
import SharedNav, { SharedFooter, SharedStyles } from './shared-nav';
import { copyText as copyToClipboard } from '@/lib/clipboard';
import { WaButton } from "./wa-button";
import { Emph } from "./ui-primitives";

export default function ResellerApiDocsView() {
  return <ThemeProvider><ApiDocsInner /></ThemeProvider>;
}

export function ResellerApiDocsDashboard({ dark, t, onNavigate }) {
  return <ApiDocsInner dark={dark} t={t} embedded onNavigate={onNavigate} />;
}

export function ResellerApiDocsSidebar({ dark }) {
  const tr = useT();
  return (
    <div className="flex flex-col gap-0">
      <div className="rad-sb-head text-t-text-muted" style={{ background: dark ? 'rgba(96,165,250,.12)' : 'rgba(37,99,235,.08)' }}>{tr("Quick reference")}</div>
      {[
        ['Base URL', 'https://nitro.ng/api/v2'],
        ['Method', 'POST · form-encoded'],
        ['Auth', 'key parameter on every request'],
      ].map(([title, desc]) => (
        <div key={title} className="rad-sb-item" style={{ background: dark ? 'rgba(255,255,255,.07)' : 'rgba(0,0,0,.02)' }}>
          <div className="text-sm font-medium mb-0.5 text-t-text">{title}</div>
          <div className="text-xs text-t-text-muted font-mono">{desc}</div>
        </div>
      ))}
      <div className="rad-sb-head mt-2 text-t-text-muted" style={{ background: dark ? 'rgba(96,165,250,.12)' : 'rgba(37,99,235,.08)' }}>{tr("Endpoints")}</div>
      {['services', 'add', 'status', 'refill', 'balance', 'cancel'].map(action => (
        <div key={action} className="rad-sb-item" style={{ background: dark ? 'rgba(255,255,255,.07)' : 'rgba(0,0,0,.02)' }}>
          <div className="text-sm font-mono font-semibold text-t-text">{action}</div>
        </div>
      ))}
    </div>
  );
}

const BASE = 'https://nitro.ng/api/v2';
// The same number and opening line the Resellers page sends a wholesale
// enquiry to (components/reseller-hq.jsx), so both doors reach one desk.
const FALLBACK_WA = '2347071656156';
const WA_TEXT = "Hi! I'd like wholesale prices on my Nitro account. Here's what my business does:";

/*
 * Every fact on this page was checked against app/api/v2/route.js on
 * 17 Oct 2026, and the page used to get several of them wrong: it promised 300
 * calls a minute (the limiter allows 60), showed order IDs as numbers (they
 * are text, NTR-…), listed four error messages the API never sends, a
 * Refunded status it never returns and a Package type the catalogue no longer
 * carries. When the route changes, this page changes with it.
 */
const TOC = [
  { group: msg("Getting started"), items: [['quick', msg("Quick start")], ['key', msg("Your key")], ['prices', msg("Prices")]] },
  { group: msg("Actions"), code: true, items: [['services', msg("the catalogue")], ['add', msg("place an order")], ['status', msg("track orders")], ['refill', msg("top a drop back up")], ['balance', msg("your wallet")], ['cancel', msg("stop an order")]] },
  { group: msg("Reference"), items: [['errors', msg("Errors")], ['limits', msg("Limits and retries")]] },
];

/** A translated sentence with `code` and *bold* kept inside it, so it stays one string for the translator. */
function Rich({ children }) {
  if (typeof children !== 'string') return children;
  return children.split('`').map((part, i) => (i % 2 ? <code key={i}>{part}</code> : <Emph key={i}>{part}</Emph>));
}

/* ── code, drawn as text with coloured spans; nothing is injected as HTML ── */
const K = (s) => <span className="k">{s}</span>;
const S = (s) => <span className="s">{s}</span>;
const N = (s) => <span className="n">{s}</span>;

function requestCode(lang, params) {
  const last = params.length - 1;
  if (lang === 'php') return [
    <>$ch = curl_init({S(`"${BASE}"`)});</>,
    <>curl_setopt($ch, CURLOPT_RETURNTRANSFER, {N('true')});</>,
    <>curl_setopt($ch, CURLOPT_POSTFIELDS, http_build_query([</>,
    ...params.map(([k, v]) => <>{'  '}{K(`"${k}"`)}{' => '}{S(`"${v}"`)},</>),
    <>]));</>,
    <>$res = json_decode(curl_exec($ch), {N('true')});</>,
  ];
  if (lang === 'python') return [
    <><span className="p">import</span> requests</>,
    <>{''}</>,
    <>res = requests.post({S(`"${BASE}"`)}, data={'{'}</>,
    ...params.map(([k, v]) => <>{'  '}{K(`"${k}"`)}: {S(`"${v}"`)},</>),
    <>{'}'}).json()</>,
  ];
  return [
    <span className="c"># POST, form-encoded</span>,
    <>curl {BASE} \</>,
    ...params.map(([k, v], i) => <>{'  '}-d {K(k)}={S(v)}{i < last ? ' \\' : ''}</>),
  ];
}
function requestText(lang, params) {
  if (lang === 'php') return `$ch = curl_init("${BASE}");\ncurl_setopt($ch, CURLOPT_RETURNTRANSFER, true);\ncurl_setopt($ch, CURLOPT_POSTFIELDS, http_build_query([\n${params.map(([k, v]) => `  "${k}" => "${v}",`).join('\n')}\n]));\n$res = json_decode(curl_exec($ch), true);`;
  if (lang === 'python') return `import requests\n\nres = requests.post("${BASE}", data={\n${params.map(([k, v]) => `  "${k}": "${v}",`).join('\n')}\n}).json()`;
  return `curl ${BASE} \\\n${params.map(([k, v], i) => `  -d ${k}=${v}${i < params.length - 1 ? ' \\' : ''}`).join('\n')}`;
}
const JSON_TOKEN = /("(?:\\.|[^"\\])*")(\s*:)?|\b(?:true|false|null)\b|-?\b\d+(?:\.\d+)?\b/g;
function jsonCode(src) {
  const out = [];
  let at = 0;
  for (const m of src.matchAll(JSON_TOKEN)) {
    if (m.index > at) out.push(src.slice(at, m.index));
    if (m[1]) out.push(m[2] ? <span key={m.index}>{K(m[1])}{m[2]}</span> : <span key={m.index} className="s">{m[1]}</span>);
    else out.push(<span key={m.index} className="n">{m[0]}</span>);
    at = m.index + m[0].length;
  }
  out.push(src.slice(at));
  return out;
}

/**
 * Copies a code sample or the base URL. These are developer copies, an edge
 * case with their own control (Trip, 17 Oct 2026); a value somebody quotes back
 * to us, like an order number, uses CopyChip instead. It says so itself rather than relying on a toast:
 * standalone at /resellers/docs there is no ToastProvider above this, so a
 * toast no-opped and a working copy looked like a dead button.
 */
function CopyButton({ text }) {
  const tr = useT();
  const [done, setDone] = useState(false);
  useEffect(() => {
    if (!done) return undefined;
    const id = setTimeout(() => setDone(false), 1600);
    return () => clearTimeout(id);
  }, [done]);
  return (
    <button type="button" className={'ad-copy' + (done ? ' done' : '')} onClick={() => { copyToClipboard(text); setDone(true); }}>
      {done ? tr("Copied") : tr("Copy")}
    </button>
  );
}

function Term({ params, res, lang, setLang, label }) {
  const tr = useT();
  return (
    <div className="ad-term">
      <div className="ad-th">
        <span className="ad-lab">{label || tr("Example request")}</span>
        <span className="ad-langs" role="group" aria-label={tr("Language")}>
          {[['curl', 'cURL'], ['php', 'PHP'], ['python', 'Python']].map(([id, name]) => (
            <button key={id} type="button" aria-pressed={lang === id} onClick={() => setLang(id)}>{name}</button>
          ))}
        </span>
        <CopyButton text={requestText(lang, params)} />
      </div>
      <pre>{requestCode(lang, params).map((line, i) => <span key={i} className="ad-ln">{line}{'\n'}</span>)}</pre>
      <div className="ad-res">
        <div className="ad-th"><span className="ad-lab">{tr("Answer")}</span></div>
        <pre>{jsonCode(res)}</pre>
      </div>
    </div>
  );
}

function Params({ rows }) {
  const tr = useT();
  return (
    <div className="ad-rows">
      {rows.map((r, i) => r.group
        ? <div key={i} className="ad-grp">{tr(r.group)}</div>
        : (
          <div key={i} className="ad-row">
            <div className="ad-nm">
              <span className="ad-names">{r.name.split(' ').map(n => <code key={n}>{n}</code>)}</span>
              {r.req !== undefined && <span className={r.req ? 'ad-req' : 'ad-opt'}>{r.req ? tr("Required") : tr("Optional")}</span>}
            </div>
            <div className="ad-ds"><Rich>{tr(r.desc)}</Rich></div>
          </div>
        ))}
    </div>
  );
}

function Note({ icon, ok, children }) {
  return <div className={'ad-note' + (ok ? ' ok' : '')}><i aria-hidden="true">{icon}</i><span>{children}</span></div>;
}

const ICON = {
  screen: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="14" rx="2" /><path d="M8 21h8M12 18v3" /></svg>,
  key: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="8" cy="15" r="4" /><path d="m10.8 12.2 9.2-9.2M17 6l3 3M14 9l2 2" /></svg>,
  sync: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 1 1-3-6.7L21 8" /><path d="M21 3v5h-5" /></svg>,
  tick: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>,
  wallet: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="6" width="18" height="13" rx="2" /><path d="M3 10h18M16 15h2" /></svg>,
  list: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 6h16M4 12h16M4 18h10" /></svg>,
  plus: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v18M3 12h18" /></svg>,
};

const SAMPLE_ID = 'NTR-1792260812345';
const SAMPLE_ID_2 = 'NTR-1792260899001';
const RES = {
  balance: '{"balance": "124500.00", "currency": "NGN"}',
  sync: `[
  {
    "service": 3879,
    "name": "Instagram Worldwide Followers — 30-day refill, Instant, Worldwide",
    "type": "Default",
    "category": "instagram",
    "rate": "9306.00",
    "min": 100,
    "max": 5000000,
    "refill": true,
    "cancel": true,
    "description": ""
  }
]`,
  services: `[
  {
    "service": 1923,
    "name": "Instagram Worldwide Video Views — No refill, Instant, Worldwide",
    "type": "Subscriptions",
    "category": "instagram",
    "rate": "205.00",
    "min": 100,
    "max": 10000000,
    "refill": false,
    "cancel": true,
    "description": "Auto service: it subscribes to an account and delivers to the posts it makes from now on, so \`link\` must be the profile or channel, not a link to one post. Quantity is the amount delivered per post."
  }
]`,
  add: `{"order": "${SAMPLE_ID}"}`,
  status: `{
  "${SAMPLE_ID}": {
    "charge": "23265.00",
    "start_count": "1200",
    "status": "In progress",
    "remains": "450",
    "currency": "NGN"
  },
  "${SAMPLE_ID_2}": {"error": "Incorrect order ID"}
}`,
  refill: '{"refill": "1"}',
  cancel: [
    '[',
    '  {"order": "' + SAMPLE_ID + '", "cancel": 1},',
    '  {"order": "' + SAMPLE_ID_2 + '", "cancel": {"error": "This order is already processing and cannot be cancelled. Please contact support if you need help."}}',
    ']',
  ].join('\n'),
};

// The API's own messages, word for word, so a reseller can search this page for the string their panel logged.
const ERRORS = [
  ['Invalid API key', 401, msg("Check the key. It may have been rotated, or the account's email is not verified yet.")],
  ['Incorrect action', 200, msg("Use one of `services`, `add`, `status`, `refill`, `balance` or `cancel`.")],
  ['Incorrect service ID', 200, msg("That ID is not in the catalogue. Sync `services`.")],
  ['Service discontinued', 200, msg("The service has been retired. Sync and move your listing to another one.")],
  ['Service not available', 200, msg("It cannot be ordered right now. Sync again later; it may come back.")],
  ['Incorrect quantity', 200, msg("Send a whole number above zero.")],
  ['Quantity must be between 100 and 5,000,000', 200, msg("Outside the service's `min` and `max`. The message carries the real numbers.")],
  ['Incorrect link', 200, msg("The link is missing or longer than 2,000 characters.")],
  ['This service needs a profile link, not a post link. Example: …', 200, msg("Wrong kind of link for the service. The message shows the right shape.")],
  ['Insufficient balance', 200, msg("Top up. Nothing was queued and nothing was charged.")],
  ['Incorrect order ID', 200, msg("No order with that ID on your account.")],
  ['Too many requests. Slow down.', 429, msg("Wait the number of seconds in the `Retry-After` header, then carry on.")],
];

const DOC_CSS = `
.rad-sb-head{font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:1.5px;margin-bottom:8px;padding:6px 10px;border-radius:8px}
.rad-sb-item{padding:10px 12px;border-radius:8px;margin-bottom:6px}
.ad{--ad-print:#efc4cf;--ad-field:#f6f0eb;--ad-tint:rgba(196,125,142,.1);--ad-warn:#b45309;--ad-sh:#120a10;--ad-top:76px;color:var(--t-text)}
.dark .ad{--ad-print:#6b3a4a;--ad-field:rgba(255,255,255,.05);--ad-tint:rgba(196,125,142,.16);--ad-warn:#fcd34d;--ad-sh:#3a2230}
.ad.embedded{--ad-top:16px}
.ad code{font-family:'JetBrains Mono',ui-monospace,monospace}
.ad-in{max-width:1180px;margin:0 auto;padding-inline:24px}
.ad-head{padding-block:44px 40px;border-bottom:1px solid var(--t-card-border);background:radial-gradient(60% 90% at 100% 0%,rgba(196,125,142,.13),transparent 62%)}
.ad-hero{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:40px;align-items:center}
.ad-eb{display:inline-flex;align-items:center;gap:8px;font-size:11.5px;font-weight:700;letter-spacing:1.6px;text-transform:uppercase;color:var(--t-accent-ink)}
.ad-eb::before{content:"";width:8px;height:8px;border-radius:2px;background:#c47d8e;box-shadow:1.5px 1.5px 0 var(--ad-print)}
.ad-h1{margin:12px 0 0;font-size:clamp(34px,4.4vw,50px);font-weight:700;letter-spacing:-1.5px;line-height:1.04;text-wrap:balance;color:var(--t-text)}
.ad-h1 em{font-family:'Cormorant Garamond',Georgia,serif;font-style:italic;font-weight:600;letter-spacing:-.4px;color:var(--t-accent-ink)}
.ad-lead{margin:14px 0 0;max-width:56ch;font-size:16px;line-height:1.65;color:var(--t-text-soft)}
.ad-acts{display:flex;flex-wrap:wrap;gap:10px;margin-top:22px}
.ad-spec{margin-top:18px;border-radius:18px;background:var(--t-card-bg);box-shadow:inset 0 0 0 1px var(--t-card-border),4px 4px 0 var(--ad-print);overflow:hidden}
.ad-url{display:flex;align-items:center;gap:12px;padding:14px 16px;border-bottom:1px solid var(--t-card-border)}
.ad-url div{flex:1;min-width:0}
.ad-url code{display:block;font-size:15px;font-weight:700;color:var(--t-text);overflow-wrap:anywhere}
.ad-sg{display:grid;grid-template-columns:repeat(3,minmax(0,1fr))}
.ad-sg div{padding:12px 16px;border-top:1px solid var(--t-card-border);border-inline-start:1px solid var(--t-card-border)}
.ad-sg div:nth-child(3n+1){border-inline-start:0}
.ad-sg div:nth-child(-n+3){border-top:0}
.ad-sl{display:block;font-size:10px;font-weight:700;letter-spacing:1.3px;text-transform:uppercase;color:var(--t-text-muted)}
.ad-sg b{display:block;margin-top:2px;font-size:13.5px;font-weight:700;color:var(--t-text)}
.ad-copy{flex-shrink:0;height:30px;padding-inline:11px;border:0;border-radius:8px;font:inherit;font-size:12px;font-weight:700;color:var(--t-accent-ink);background:var(--ad-tint);box-shadow:inset 0 0 0 1px rgba(196,125,142,.35);cursor:pointer}
.ad-copy.done{color:var(--t-green);background:color-mix(in srgb,var(--t-green) 10%,transparent);box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--t-green) 35%,transparent)}
.ad-term{position:relative;border-radius:18px;color:#f6eef2;background:radial-gradient(70% 120% at 100% 0%,rgba(196,125,142,.38),transparent 62%),linear-gradient(150deg,#1f121a 0%,#2e1b26 55%,#4a2a3a 100%);box-shadow:4px 4px 0 var(--ad-sh);overflow:hidden;direction:ltr;text-align:left}
.ad-th{display:flex;align-items:center;gap:8px;padding:9px 10px 9px 14px;border-bottom:1px solid rgba(255,255,255,.1)}
.ad-lab{font-size:10.5px;font-weight:700;letter-spacing:1.3px;text-transform:uppercase;color:rgba(246,238,242,.6)}
.ad-langs{display:flex;gap:2px;margin-inline-start:auto}
.ad-langs button{height:26px;padding-inline:10px;border:0;border-radius:7px;font:inherit;font-size:11.5px;font-weight:700;color:rgba(246,238,242,.62);background:none;cursor:pointer}
.ad-langs button[aria-pressed="true"]{color:#fff;background:rgba(255,255,255,.12);box-shadow:inset 0 0 0 1px rgba(255,255,255,.18)}
.ad-term .ad-copy{height:26px;font-size:11.5px;color:#f3c5d1;background:rgba(255,255,255,.08);box-shadow:inset 0 0 0 1px rgba(255,255,255,.16)}
.ad-term .ad-copy.done{color:#9ff0c9;background:rgba(159,240,201,.12);box-shadow:inset 0 0 0 1px rgba(159,240,201,.35)}
.ad-term pre{margin:0;padding:14px 16px 16px;font:500 12.5px/1.72 'JetBrains Mono',ui-monospace,monospace;white-space:pre;overflow-x:auto;tab-size:2}
.ad-res{border-top:1px solid rgba(255,255,255,.1);background:rgba(0,0,0,.22)}
.ad-res .ad-th{border-bottom:0;padding-bottom:0}
.ad-res pre{padding-top:8px}
.ad-term .k{color:#f3a9bd}.ad-term .s{color:#9ff0c9}.ad-term .n{color:#fcd38d}.ad-term .c{color:rgba(246,238,242,.45)}.ad-term .p{color:rgba(246,238,242,.7)}
.ad-live{display:inline-flex;align-items:center;gap:6px;margin-inline-start:auto;font-size:11px;font-weight:700;color:#9ff0c9}
.ad-live i{width:7px;height:7px;border-radius:50%;background:#34d399;box-shadow:0 0 0 3px rgba(52,211,153,.2)}
.ad-docs{display:grid;grid-template-columns:208px minmax(0,1fr);gap:40px;padding-block:34px 60px}
.ad-toc{position:sticky;top:var(--ad-top);align-self:start;max-height:calc(100vh - var(--ad-top) - 16px);overflow-y:auto;padding-bottom:12px}
.ad-toc h4{margin:18px 0 6px;padding-inline:10px;font-size:10.5px;font-weight:800;letter-spacing:1.4px;text-transform:uppercase;color:var(--t-text-muted)}
.ad-toc>div:first-child h4{margin-top:0}
.ad-toc a{display:flex;align-items:baseline;gap:8px;padding:7px 10px;border-radius:10px;font-size:13.5px;font-weight:600;color:var(--t-text-soft);text-decoration:none}
.ad-toc a:hover{color:var(--t-text);background:var(--ad-field)}
.ad-toc a.on{color:var(--t-accent-ink);background:var(--t-card-bg);box-shadow:inset 0 0 0 1px rgba(196,125,142,.45),2px 2px 0 var(--ad-print)}
.ad-toc a code{font-size:13px;font-weight:700}
.ad-toc a small{margin-inline-start:auto;font-size:11px;font-weight:500;color:var(--t-text-muted);text-align:end}
.ad-sec{scroll-margin-top:calc(var(--ad-top) + 8px);padding-block:30px;border-top:1px solid var(--t-card-border)}
.ad-sec:first-child{padding-top:0;border-top:0}
.ad-dh{display:flex;align-items:baseline;gap:12px;flex-wrap:wrap}
.ad-h2{margin:0;font-size:24px;font-weight:750;letter-spacing:-.5px;line-height:1.2;color:var(--t-text)}
.ad-h2 code{font-size:23px;font-weight:700;letter-spacing:-.5px}
.ad-act{display:inline-flex;align-items:center;height:24px;padding-inline:9px;border-radius:7px;font:700 11.5px 'JetBrains Mono',ui-monospace,monospace;color:var(--t-accent-ink);background:var(--ad-tint);box-shadow:inset 0 0 0 1px rgba(196,125,142,.3),1.5px 1.5px 0 var(--ad-print)}
.ad-what{margin:6px 0 0;font-size:16px;color:var(--t-text-soft);max-width:62ch}
.ad-split{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,440px);gap:28px;margin-top:18px;align-items:start}
.ad-split>.ad-term{position:sticky;top:var(--ad-top)}
.ad-prose p{margin:0 0 12px;max-width:62ch;color:var(--t-text-soft);line-height:1.7}
.ad-prose b{color:var(--t-text)}
.ad-prose code,.ad-note code,.ad-tbl code,.ad-steps code{font-size:12.5px;font-weight:600;padding:2px 6px;border-radius:6px;color:var(--t-text);background:var(--ad-field);box-shadow:inset 0 0 0 1px var(--t-card-border);white-space:nowrap}
.ad-h3{margin:22px 0 10px;font-size:11.5px;font-weight:800;letter-spacing:1.3px;text-transform:uppercase;color:var(--t-text-muted)}
.ad-steps{list-style:none;margin:0 0 14px;padding:0;display:grid;gap:10px;max-width:62ch}
.ad-steps li{display:grid;grid-template-columns:28px minmax(0,1fr);gap:12px;align-items:start}
.ad-no{width:28px;height:28px;border-radius:50%;display:grid;place-items:center;font-size:12.5px;font-weight:800;color:#fff;background:#96626f;box-shadow:1.5px 1.5px 0 #6b3a4a}
.ad-steps b{display:block;font-size:15px;font-weight:700;color:var(--t-text)}
.ad-steps div span{display:block;font-size:14px;color:var(--t-text-soft);line-height:1.6}
.ad-rows{border-radius:14px;background:var(--t-card-bg);box-shadow:inset 0 0 0 1px var(--t-card-border);overflow:hidden}
.ad-row{display:grid;grid-template-columns:minmax(118px,auto) minmax(0,1fr);gap:4px 16px;padding:11px 14px;border-top:1px solid var(--t-card-border)}
.ad-row:first-child{border-top:0}
.ad-nm{display:flex;flex-direction:column;align-items:flex-start;gap:5px}
.ad-names{display:flex;flex-direction:column;gap:2px}
.ad-nm code{font-size:13px;font-weight:700;color:var(--t-text)}
.ad-ds{font-size:13.5px;line-height:1.6;color:var(--t-text-soft)}
.ad-ds code{font-size:12px;font-weight:600;padding:1px 5px;border-radius:5px;color:var(--t-text);background:var(--ad-field)}
.ad-req,.ad-opt{display:inline-flex;align-items:center;height:18px;padding-inline:6px;border-radius:5px;font-size:10px;font-weight:800;letter-spacing:.4px;text-transform:uppercase}
.ad-req{color:var(--t-accent-ink);background:var(--ad-tint);box-shadow:inset 0 0 0 1px rgba(196,125,142,.35)}
.ad-opt{color:var(--t-text-muted);box-shadow:inset 0 0 0 1px var(--t-card-border)}
.ad-grp{padding:8px 14px 7px;font-size:10.5px;font-weight:800;letter-spacing:1.2px;text-transform:uppercase;color:var(--t-text-muted);background:var(--ad-field);border-top:1px solid var(--t-card-border)}
.ad-note{display:flex;gap:12px;margin:14px 0 0;padding:13px 15px;border-radius:13px;font-size:14px;line-height:1.6;color:var(--t-text-soft);background:var(--t-card-bg);box-shadow:inset 0 0 0 1px var(--t-card-border),2px 2px 0 var(--ad-print);max-width:62ch}
.ad-note i{flex-shrink:0;width:26px;height:26px;border-radius:8px;display:grid;place-items:center;color:var(--t-accent-ink);background:var(--ad-tint);box-shadow:1.5px 1.5px 0 var(--ad-print)}
.ad-note i svg{width:14px;height:14px}
.ad-note.ok i{color:var(--t-green);background:color-mix(in srgb,var(--t-green) 11%,transparent);box-shadow:1.5px 1.5px 0 color-mix(in srgb,var(--t-green) 30%,transparent)}
.ad-sum{display:flex;align-items:center;flex-wrap:wrap;gap:8px 10px;margin:4px 0 14px;padding:14px 16px;border-radius:14px;background:var(--ad-field);box-shadow:inset 0 0 0 1px var(--t-card-border);font-size:14px;color:var(--t-text-soft);max-width:62ch;direction:ltr}
.ad-sum b{font-weight:700;color:var(--t-text);font-variant-numeric:tabular-nums}
.ad-sum i{font-style:normal;font-weight:800;color:var(--t-accent-ink)}
.ad-sum .tot{padding:3px 8px;border-radius:7px;color:#0b2016;background:#9ff0c9;font-weight:800}
.ad-stat{display:flex;flex-wrap:wrap;gap:8px;margin:0 0 14px}
.ad-st{display:inline-flex;align-items:center;gap:7px;height:30px;padding-inline:11px;border-radius:9px;font-size:13px;font-weight:650;color:var(--t-text);background:var(--t-card-bg);box-shadow:inset 0 0 0 1px var(--t-card-border)}
.ad-st i{width:8px;height:8px;border-radius:50%;background:var(--c)}
.ad-tbl{overflow-x:auto;margin-top:18px;border-radius:14px;background:var(--t-card-bg);box-shadow:inset 0 0 0 1px var(--t-card-border)}
.ad-tbl table{width:100%;border-collapse:collapse;font-size:13.5px;min-width:600px}
.ad-tbl th{padding:10px 14px;text-align:start;font-size:10.5px;font-weight:800;letter-spacing:1.2px;text-transform:uppercase;color:var(--t-text-muted);border-bottom:1px solid var(--t-card-border)}
.ad-tbl td{padding:11px 14px;vertical-align:top;color:var(--t-text-soft);line-height:1.55;border-top:1px solid var(--t-card-border)}
.ad-tbl tr:first-child td{border-top:0}
.ad-tbl td.e{font:700 12.5px 'JetBrains Mono',ui-monospace,monospace;color:var(--t-text);min-width:200px}
.ad-tbl td.h{font:700 12px 'JetBrains Mono',ui-monospace,monospace;white-space:nowrap;color:var(--t-green)}
.ad-tbl td.h.warn{color:var(--ad-warn)}
.ad-close{position:relative;overflow:hidden;display:flex;align-items:center;justify-content:space-between;gap:20px;flex-wrap:wrap;margin-top:40px;padding:28px 30px;border-radius:22px;color:#fff;background:radial-gradient(70% 120% at 100% 0%,rgba(255,220,230,.4),transparent 60%),linear-gradient(150deg,#8b4a5e 0%,#b46a80 60%,#d08ea0 100%);box-shadow:5px 5px 0 #5a2a3a}
.ad-close b{display:block;font-family:'Cormorant Garamond',Georgia,serif;font-size:34px;font-weight:600;line-height:1.05}
.ad-close span{display:block;margin-top:6px;font-size:14.5px;opacity:.92;max-width:52ch}
.ad-close .ad-acts{margin-top:0}
.ad-close .nb.sec{color:#8b4a5e;background:#fff;border-color:#fff}
@media (max-width:1100px){.ad-split{grid-template-columns:minmax(0,1fr)}.ad-split>.ad-term{position:static}}
@media (max-width:900px){
  .ad-hero{grid-template-columns:minmax(0,1fr);gap:26px}
  .ad-docs{grid-template-columns:minmax(0,1fr);gap:0;padding-top:0}
  .ad-toc{top:calc(var(--ad-top) - 20px);z-index:10;display:flex;gap:6px;max-height:none;overflow-x:auto;overflow-y:hidden;margin-inline:-24px;padding:10px 24px;background:color-mix(in srgb,var(--t-bg) 94%,transparent);backdrop-filter:blur(10px);border-bottom:1px solid var(--t-card-border);scrollbar-width:none}
  .ad-toc::-webkit-scrollbar{display:none}
  .ad-toc h4{display:none}
  .ad-toc a{flex-shrink:0;padding:6px 11px;font-size:13px;white-space:nowrap;box-shadow:inset 0 0 0 1px var(--t-card-border);background:var(--t-card-bg)}
  .ad-toc a small{display:none}
  .ad-sec{scroll-margin-top:calc(var(--ad-top) + 44px)}
  .ad-sec:first-child{padding-top:26px}
}
@media (max-width:640px){.ad-in{padding-inline:16px}.ad-toc{margin-inline:-16px;padding-inline:16px}}
@media (max-width:560px){
  .ad-sg{grid-template-columns:repeat(2,minmax(0,1fr))}
  .ad-sg div{border-inline-start:1px solid var(--t-card-border)!important;border-top:1px solid var(--t-card-border)!important}
  .ad-sg div:nth-child(2n+1){border-inline-start:0!important}
  .ad-sg div:nth-child(-n+2){border-top:0!important}
  .ad-row{grid-template-columns:minmax(0,1fr)}
  .ad-nm{flex-direction:row;align-items:center}
  .ad-names{flex-direction:row;gap:6px}
  .ad-h2{font-size:21px}.ad-h2 code{font-size:20px}
  .ad-close{padding:24px 22px}.ad-close b{font-size:28px}
}
`;

function ApiDocsInner({ t: tProp, embedded, onNavigate } = {}) {
  const tr = useT();
  const theme = useTheme();
  const t = tProp ?? theme.t;

  const [lang, setLang] = useState('curl');
  const [active, setActive] = useState('quick');
  const [waNum, setWaNum] = useState(FALLBACK_WA);
  const [signedIn, setSignedIn] = useState(!!embedded);
  const docRef = useRef(null);

  useEffect(() => {
    fetch('/api/settings').then(r => r.ok ? r.json() : {}).then(d => {
      const n = (d.settings?.social_whatsapp_reseller || d.settings?.social_whatsapp_support)?.replace(/\D/g, '');
      if (n) setWaNum(n);
    }).catch(() => {});
    if (embedded) return;
    fetch('/api/auth/signed-in', { cache: 'no-store' }).then(r => r.ok ? r.json() : null).then(d => setSignedIn(!!d?.signedIn)).catch(() => {});
  }, [embedded]);

  // Contents follow the reader: the last section whose top has passed the
  // header. Listening in the capture phase catches the dashboard's own
  // scrolling element as well as the window on the public page.
  useEffect(() => {
    const doc = docRef.current;
    if (!doc) return undefined;
    let raf = 0;
    const spy = () => {
      raf = 0;
      const secs = [...doc.querySelectorAll('.ad-sec')];
      if (!secs.length) return;
      // A section counts as the one being read once its top is a third of the way up the screen.
      const line = Math.min(window.innerHeight * 0.35, 300);
      let cur = secs[0].id;
      for (const s of secs) if (s.getBoundingClientRect().top <= line) cur = s.id;
      const last = secs[secs.length - 1].getBoundingClientRect();
      if (last.bottom <= window.innerHeight + 4) cur = secs[secs.length - 1].id;
      setActive(cur);
    };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(spy); };
    document.addEventListener('scroll', onScroll, { capture: true, passive: true });
    return () => { document.removeEventListener('scroll', onScroll, { capture: true }); if (raf) cancelAnimationFrame(raf); };
  }, []);

  // On a phone the contents are a strip of chips; keep the chosen one in view.
  useEffect(() => {
    const a = docRef.current?.querySelector(`.ad-toc a[href="#${active}"]`);
    const strip = a?.parentElement;
    if (strip && getComputedStyle(strip).display === 'flex' && strip.scrollWidth > strip.clientWidth) {
      strip.scrollTo({ left: a.offsetLeft - 16, behavior: 'smooth' });
    }
  }, [active]);

  const waLink = `https://wa.me/${waNum}?text=${encodeURIComponent(WA_TEXT)}`;
  const go = (cls) => embedded
    ? <button type="button" className={cls} onClick={() => onNavigate?.('lab')}>{tr("Open API access")}</button>
    : signedIn
      ? <a className={cls} href="/dashboard?page=lab">{tr("Open API access")}</a>
      : <a className={cls} href="/signup">{tr("Create a free account")}</a>;
  const term = (params, res, label) => <Term params={params} res={res} lang={lang} setLang={setLang} label={label} />;
  const K_ = ['key', 'YOUR_API_KEY'];

  return (
    <>
      {!embedded && <SharedStyles />}
      <style>{DOC_CSS}</style>
      <div className={'ad' + (embedded ? ' embedded' : ' min-h-dvh flex flex-col')} style={embedded ? undefined : { background: t.bg }} ref={docRef}>
        {!embedded && <SharedNav />}
        <main className={embedded ? '' : 'flex-1 w-full'}>
          {/* ━━━ What it is, the address, and a first call that works ━━━ */}
          <div className="ad-head">
            <div className="ad-in ad-hero">
              <div>
                <span className="ad-eb">{tr("API v2 for resellers and developers")}</span>
                <h1 className="ad-h1">{tr("The Nitro API.")} <em>{tr("One address, six actions.")}</em></h1>
                <p className="ad-lead">{tr("The format every SMM panel already speaks. Point your panel or your code at the address below with your key, and every order is placed, priced and charged exactly as it would be on the site.")}</p>
                <div className="ad-acts">
                  {go('nb pri lg')}
                  <WaButton href={waLink} size="lg">{tr("Message us for wholesale")}</WaButton>
                </div>
              </div>
              <div>
                <div className="ad-term">
                  <div className="ad-th"><span className="ad-lab">{tr("Your first call")}</span><span className="ad-live"><i />{"200 OK"}</span></div>
                  <pre>{requestCode('curl', [K_, ['action', 'balance']]).slice(1).map((line, i) => <span key={i} className="ad-ln">{line}{'\n'}</span>)}</pre>
                  <div className="ad-res"><div className="ad-th"><span className="ad-lab">{tr("Answer")}</span></div><pre>{jsonCode(RES.balance)}</pre></div>
                </div>
                <div className="ad-spec">
                  <div className="ad-url"><div><span className="ad-sl">{tr("Base URL")}</span><code>{BASE}</code></div><CopyButton text={BASE} /></div>
                  <div className="ad-sg">
                    <div><span className="ad-sl">{tr("Method")}</span><b><code>{"POST"}</code></b></div>
                    <div><span className="ad-sl">{tr("Body")}</span><b>{tr("Form or JSON")}</b></div>
                    <div><span className="ad-sl">{tr("Your key")}</span><b><Rich>{tr("`key` on every call")}</Rich></b></div>
                    <div><span className="ad-sl">{tr("Answers")}</span><b>{"JSON"}</b></div>
                    <div><span className="ad-sl">{tr("Money")}</span><b>{tr("Naira, from your wallet")}</b></div>
                    <div><span className="ad-sl">{tr("Limit")}</span><b>{tr("60 calls a minute")}</b></div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="ad-in ad-docs">
            <nav className="ad-toc" aria-label={tr("On this page")}>
              {TOC.map(g => (
                <div key={g.group} style={{ display: 'contents' }}>
                  <h4>{tr(g.group)}</h4>
                  {g.items.map(([id, label]) => (
                    <a key={id} href={`#${id}`} className={active === id ? 'on' : ''} onClick={() => setActive(id)}>
                      {g.code ? <><code>{id}</code><small>{tr(label)}</small></> : tr(label)}
                    </a>
                  ))}
                </div>
              ))}
            </nav>

            <div>
              <section className="ad-sec" id="quick">
                <h2 className="ad-h2">{tr("Quick start")}</h2>
                <p className="ad-what">{tr("Three steps from nothing to a placed order.")}</p>
                <div className="ad-split">
                  <div className="ad-prose">
                    <ol className="ad-steps">
                      <li><span className="ad-no">1</span><div><b>{tr("Copy your key")}</b><span>{tr("Every verified account has one, in Settings and on the API access page.")}</span></div></li>
                      <li><span className="ad-no">2</span><div><b><Rich>{tr("Call `balance`")}</Rich></b><span>{tr("If your wallet comes back, the key works.")}</span></div></li>
                      <li><span className="ad-no">3</span><div><b><Rich>{tr("Sync `services`, then `add`")}</Rich></b><span>{tr("Pick a service from the list and order it with a link and a quantity.")}</span></div></li>
                    </ol>
                    <Note icon={ICON.screen}><Rich>{tr("*Running panel software?* Add Nitro as a provider: paste the base URL and your key into its provider settings and press sync. You can skip the rest of this page and go straight to setting your prices.")}</Rich></Note>
                  </div>
                  {term([K_, ['action', 'services']], RES.sync, tr("Sync the catalogue"))}
                </div>
              </section>

              <section className="ad-sec" id="key">
                <h2 className="ad-h2">{tr("Your key")}</h2>
                <p className="ad-what">{tr("One key per account. It is who you are on every call.")}</p>
                <div className="ad-prose" style={{ marginTop: 16 }}>
                  <p><Rich>{tr("Your key identifies your account, prices every call at your rate and charges your Nitro wallet. Find it in *Settings* or on the *API access* page, and send it as `key` with every request.")}</Rich></p>
                  <p>{tr("Keep it on your server. Never put it in an app, a web page or a public repository, because anyone holding it can spend your wallet.")}</p>
                  <p><Rich>{tr("To replace it, press *Rotate* on the API access page. The old key stops working the moment the new one is issued, so update your panel straight after.")}</Rich></p>
                  <Note icon={ICON.key}><Rich>{tr("A wrong key, a rotated key or an account whose email is not verified gets *HTTP 401* with `Invalid API key`. Every other answer, errors included, comes back as HTTP 200.")}</Rich></Note>
                </div>
              </section>

              <section className="ad-sec" id="prices">
                <h2 className="ad-h2">{tr("Prices")}</h2>
                <p className="ad-what">{tr("Naira per 1,000, at your rate, taken from your wallet when the order is placed.")}</p>
                <div className="ad-prose" style={{ marginTop: 16 }}>
                  <div className="ad-sum" aria-label={tr("Worked example")}>
                    <span><b>{"₦9,306.00"}</b> {tr("rate")}</span><i>×</i><span><b>{"2,500"}</b> {tr("quantity")}</span><i>÷</i><b>{"1,000"}</b><i>=</i><b className="tot">{"₦23,265.00"}</b>
                  </div>
                  <p><Rich>{tr("Every account starts on *retail*, the same prices you see on the site. Message us on WhatsApp about your business and we switch your account to *wholesale*: the same key, the same calls, lower rates. Consistent volume earns a personal rate on top.")}</Rich></p>
                  <p><Rich>{tr("The `rate` in `services` is always what your account pays today, so you never have to work out a discount yourself.")}</Rich></p>
                </div>
              </section>

              <section className="ad-sec" id="services">
                <div className="ad-dh"><h2 className="ad-h2"><code>{"services"}</code></h2><span className="ad-act">{"action=services"}</span></div>
                <p className="ad-what">{tr("The whole catalogue at your rate.")}</p>
                <div className="ad-split">
                  <div className="ad-prose">
                    <p>{tr("Returns every service you can order: the same list as the Full list on the site, with the same numbers. Every key sees the same services under the same IDs, so a service number your customer quotes is one we can look up.")}</p>
                    <h3 className="ad-h3">{tr("Each service")}</h3>
                    <Params rows={[
                      { name: 'service', desc: msg("The ID you order with. It is the number shown on the site's Full list.") },
                      { name: 'name', desc: msg("What it is, with its refill, speed and audience.") },
                      { name: 'category', desc: msg("The platform, in lower case: `instagram`, `tiktok`, `youtube`, `webtraffic` and so on.") },
                      { name: 'rate', desc: msg("Naira per 1,000, at your rate.") },
                      { name: 'min max', desc: msg("The smallest and largest quantity one order can be.") },
                      { name: 'refill', desc: msg("`true` if you can call `refill` on it.") },
                      { name: 'cancel', desc: msg("`true` if you can call `cancel` on it.") },
                      { name: 'type', desc: msg("`Default`, `Custom Comments`, `SEO` or `Subscriptions`. Tells your panel which extra fields to ask for.") },
                      { name: 'description', desc: msg("What the buyer has to do first, or how the link must look. Empty when there is nothing to say. Show it on your order page.") },
                    ]} />
                    <Note icon={ICON.sync}><Rich>{tr("*Sync it every few minutes, not on every page view.* Prices and availability move. A service that leaves the list answers `Service discontinued` or `Service not available` if you order it.")}</Rich></Note>
                  </div>
                  {term([K_, ['action', 'services']], RES.services)}
                </div>
              </section>

              <section className="ad-sec" id="add">
                <div className="ad-dh"><h2 className="ad-h2"><code>{"add"}</code></h2><span className="ad-act">{"action=add"}</span></div>
                <p className="ad-what">{tr("Places an order and charges your wallet.")}</p>
                <div className="ad-split">
                  <div className="ad-prose">
                    <Params rows={[
                      { name: 'service', req: true, desc: msg("The ID from `services`.") },
                      { name: 'link', req: true, desc: msg("The profile, post, video or username. Some services want a profile and some a post; `description` says which.") },
                      { name: 'quantity', req: true, desc: msg("A whole number between the service's `min` and `max`.") },
                      { group: msg("Only for some services") },
                      { name: 'comments', req: false, desc: msg("`Custom Comments`: one comment per line. The quantity is the number of lines.") },
                      { name: 'usernames', req: false, desc: msg("Mentions: one username per line.") },
                      { name: 'keywords', req: false, desc: msg("`SEO`: one search term per line.") },
                      { name: 'answer_number', req: false, desc: msg("Poll votes: which answer the votes go to.") },
                      { name: 'country', req: false, desc: msg("Website traffic: a 2-letter country code, `WW` for worldwide, or a continent (`AFR`, `ASI`, `EUR`, `NAM`, `SAM`, `MEA`).") },
                      { name: 'device', req: false, desc: msg("Website traffic: `all`, `mobile` or `desktop`. All if you leave it out.") },
                      { name: 'keyword referrer', req: false, desc: msg("Website traffic: the search term or the site the visits appear to come from. Leave both out for direct visits.") },
                    ]} />
                    <Note ok icon={ICON.tick}><Rich>{tr("*Safe to retry.* Send the same service, link and quantity again within 60 seconds and you get back the order already placed, not a second one. A timeout never costs you twice.")}</Rich></Note>
                    <Note icon={ICON.wallet}><Rich>{tr("*Wallet too low?* You get `Insufficient balance`, nothing is queued and nothing is charged. Top up and send it again.")}</Rich></Note>
                  </div>
                  {term([K_, ['action', 'add'], ['service', '3879'], ['link', 'https://instagram.com/yourclient'], ['quantity', '2500']], RES.add)}
                </div>
              </section>

              <section className="ad-sec" id="status">
                <div className="ad-dh"><h2 className="ad-h2"><code>{"status"}</code></h2><span className="ad-act">{"action=status"}</span></div>
                <p className="ad-what">{tr("Where an order is, how many it started from, and what is left.")}</p>
                <div className="ad-split">
                  <div className="ad-prose">
                    <Params rows={[
                      { name: 'order', req: true, desc: msg("One order ID.") },
                      { name: 'orders', req: false, desc: msg("Up to 100 IDs, comma separated, instead of `order`. You get one answer per ID.") },
                    ]} />
                    <h3 className="ad-h3">{tr("Statuses")}</h3>
                    {/* The API's own words: a panel matches on these, so they stay English. */}
                    <div className="ad-stat">
                      {[["Pending", '#a8a29e'], ["In progress", '#60a5fa'], ["Completed", '#34d399'], ["Partial", '#f5b04a'], ["Canceled", '#f87171']].map(([s, c]) => (
                        <span key={s} className="ad-st" style={{ '--c': c }}><i />{s}</span>
                      ))}
                    </div>
                    <p><Rich>{tr("`start_count` is where the count stood when delivery began, and `remains` is how many are still to come. `charge` is what the order cost you.")}</Rich></p>
                    <Note icon={ICON.list}><Rich>{tr("*Polling a lot of orders?* Use `orders` with up to 100 IDs. One call instead of a hundred keeps you well inside the limit.")}</Rich></Note>
                  </div>
                  {term([K_, ['action', 'status'], ['orders', `${SAMPLE_ID},${SAMPLE_ID_2}`]], RES.status)}
                </div>
              </section>

              <section className="ad-sec" id="refill">
                <div className="ad-dh"><h2 className="ad-h2"><code>{"refill"}</code></h2><span className="ad-act">{"action=refill"}</span></div>
                <p className="ad-what">{tr("Asks for a drop to be topped back up.")}</p>
                <div className="ad-split">
                  <div className="ad-prose">
                    <Params rows={[{ name: 'order', req: true, desc: msg("The order to refill. Its service must have `refill: true`.") }]} />
                    <p style={{ marginTop: 14 }}>{tr("Refills are free inside the service's refill window. If the order cannot be refilled, the answer says why.")}</p>
                  </div>
                  {term([K_, ['action', 'refill'], ['order', SAMPLE_ID]], RES.refill)}
                </div>
              </section>

              <section className="ad-sec" id="balance">
                <div className="ad-dh"><h2 className="ad-h2"><code>{"balance"}</code></h2><span className="ad-act">{"action=balance"}</span></div>
                <p className="ad-what">{tr("What is in your wallet right now.")}</p>
                <div className="ad-split">
                  <div className="ad-prose">
                    <p>{tr("No extra parameters. Check it before you accept a customer's order on your own panel, so you never sell what your wallet cannot cover.")}</p>
                  </div>
                  {term([K_, ['action', 'balance']], RES.balance)}
                </div>
              </section>

              <section className="ad-sec" id="cancel">
                <div className="ad-dh"><h2 className="ad-h2"><code>{"cancel"}</code></h2><span className="ad-act">{"action=cancel"}</span></div>
                <p className="ad-what">{tr("Stops orders that have not started, and refunds them.")}</p>
                <div className="ad-split">
                  <div className="ad-prose">
                    <Params rows={[{ name: 'orders', req: true, desc: msg("Up to 100 IDs, comma separated. `order` works for one.") }]} />
                    <p style={{ marginTop: 14 }}><Rich>{tr("Only services with `cancel: true`, and only before work begins. A cancelled order goes back to your wallet in full. Each ID gets its own answer, so one that cannot be cancelled never blocks the rest.")}</Rich></p>
                  </div>
                  {term([K_, ['action', 'cancel'], ['orders', `${SAMPLE_ID},${SAMPLE_ID_2}`]], RES.cancel)}
                </div>
              </section>

              <section className="ad-sec" id="errors">
                <h2 className="ad-h2">{tr("Errors")}</h2>
                <p className="ad-what"><Rich>{tr("Every error is JSON with an `error` field, the convention panel software already reads.")}</Rich></p>
                <div className="ad-tbl">
                  <table>
                    <thead><tr><th>{tr("Error")}</th><th>{"HTTP"}</th><th>{tr("What to do")}</th></tr></thead>
                    <tbody>
                      {ERRORS.map(([e, code, fix]) => (
                        <tr key={e}><td className="e">{e}</td><td className={'h' + (code === 200 ? '' : ' warn')}>{code}</td><td><Rich>{tr(fix)}</Rich></td></tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>

              <section className="ad-sec" id="limits">
                <h2 className="ad-h2">{tr("Limits and retries")}</h2>
                <p className="ad-what">{tr("Room for any real panel, as long as it polls sensibly.")}</p>
                <div className="ad-prose" style={{ marginTop: 16 }}>
                  <p><Rich>{tr("*60 calls a minute per key.* Past that you get HTTP 429 and a `Retry-After` header. Poll `status` with `orders` rather than one call per order, and sync `services` every few minutes rather than on every page view.")}</Rich></p>
                  <p><Rich>{tr("*Order IDs are text*, like `NTR-1792260812345`. Store them as text, not numbers.")}</Rich></p>
                  <p><Rich>{tr("Retrying `add` is *safe for 60 seconds*: the same service, link and quantity returns the order already placed.")}</Rich></p>
                  <Note icon={ICON.plus}><Rich>{tr("*Need more than 60 a minute?* Message us on WhatsApp with what you are running and we will look at it with you.")}</Rich></Note>
                </div>
                <div className="ad-close">
                  <div>
                    <b>{tr("Start where you are.")}</b>
                    <span>{signedIn ? tr("Your key is already in Settings. Wholesale is one message away.") : tr("Make a free account and your key is waiting in Settings. Wholesale is one message away.")}</span>
                  </div>
                  <div className="ad-acts">
                    {go('nb sec lg')}
                    <WaButton href={waLink} size="lg">{tr("Message us for wholesale")}</WaButton>
                  </div>
                </div>
              </section>
            </div>
          </div>
        </main>
        {!embedded && <SharedFooter />}
      </div>
    </>
  );
}
