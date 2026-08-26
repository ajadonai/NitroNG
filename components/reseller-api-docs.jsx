'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { ThemeProvider, useTheme } from './shared-nav';
import SharedNav, { SharedFooter, SharedStyles } from './shared-nav';
import { useToast } from './toast';
import { copyText } from '@/lib/clipboard';

export default function ResellerApiDocsView() {
  return <ThemeProvider><ApiDocsInner /></ThemeProvider>;
}

export function ResellerApiDocsDashboard({ dark, t, onNavigate }) {
  return <ApiDocsInner dark={dark} t={t} embedded onNavigate={onNavigate} />;
}

export function ResellerApiDocsSidebar({ dark, t }) {
  return (
    <div className="flex flex-col gap-0">
      <div className="rad-sb-head text-t-text-muted" style={{ background: dark ? 'rgba(96,165,250,.12)' : 'rgba(37,99,235,.08)' }}>Quick reference</div>
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
      <div className="rad-sb-head mt-2 text-t-text-muted" style={{ background: dark ? 'rgba(96,165,250,.12)' : 'rgba(37,99,235,.08)' }}>Endpoints</div>
      {['services', 'add', 'status', 'refill', 'balance', 'cancel'].map(action => (
        <div key={action} className="rad-sb-item" style={{ background: dark ? 'rgba(255,255,255,.07)' : 'rgba(0,0,0,.02)' }}>
          <div className="text-sm font-mono font-semibold text-t-text">{action}</div>
        </div>
      ))}
    </div>
  );
}

const SECTIONS = [
  { id: 'start', nav: 'Getting started', group: 'Basics' },
  { id: 'auth', nav: 'Authentication', group: 'Basics' },
  { id: 'catalogs', nav: 'Catalogs & rates', group: 'Basics' },
  { id: 'services', nav: 'services', group: 'Endpoints', isMethod: true },
  { id: 'add', nav: 'add', group: 'Endpoints', isMethod: true },
  { id: 'status', nav: 'status', group: 'Endpoints', isMethod: true },
  { id: 'refill', nav: 'refill', group: 'Endpoints', isMethod: true },
  { id: 'balance', nav: 'balance', group: 'Endpoints', isMethod: true },
  { id: 'cancel', nav: 'cancel', group: 'Endpoints', isMethod: true },
  { id: 'errors', nav: 'Errors', group: 'Reference' },
  { id: 'limits', nav: 'Limits', group: 'Reference' },
];

const ERRORS = [
  ['Invalid API key', "The key is wrong, or was rotated. The current one is in Settings."],
  ['Incorrect service ID', 'The service isn\'t in your current catalog. Re-sync services.'],
  ['Not enough funds', 'Wallet can\'t cover the charge. Nothing was queued. Top up and resend.'],
  ['Quantity out of range', 'Outside the service min and max. Check the service entry.'],
  ['Invalid link', 'The target URL or username failed validation.'],
  ['Order not found', 'No order with that ID on your account.'],
];

function curlCode(params) {
  return `# POST · application/x-www-form-urlencoded\ncurl -X POST https://nitro.ng/api/v2 \\\n` +
    params.map(([k, v], i) => `  -d ${k}=${v}${i < params.length - 1 ? ' \\' : ''}`).join('\n');
}
function phpCode(params) {
  return `$ch = curl_init("https://nitro.ng/api/v2");\ncurl_setopt($ch, CURLOPT_POST, true);\ncurl_setopt($ch, CURLOPT_RETURNTRANSFER, true);\ncurl_setopt($ch, CURLOPT_POSTFIELDS, http_build_query([\n` +
    params.map(([k, v]) => `  "${k}" => "${v}",`).join('\n') +
    `\n]));\n$res = json_decode(curl_exec($ch), true);`;
}
function pyCode(params) {
  return `import requests\n\nres = requests.post("https://nitro.ng/api/v2", data={\n` +
    params.map(([k, v]) => `  "${k}": "${v}",`).join('\n') +
    `\n}).json()`;
}

function CodeBlock({ params, lang, setLang, onCopy }) {
  const code = lang === 'curl' ? curlCode(params) : lang === 'php' ? phpCode(params) : pyCode(params);
  return (
    <div className="rad-codewrap">
      <div className="rad-codehead">
        <div className="rad-langtabs">
          {[['curl', 'cURL'], ['php', 'PHP'], ['python', 'Python']].map(([id, label]) => (
            <button key={id} onClick={() => setLang(id)} className={lang === id ? 'on' : ''}>{label}</button>
          ))}
        </div>
        <button className="rad-copybtn" onClick={() => onCopy(code)}>Copy</button>
      </div>
      <pre className="rad-code-pre">{code}</pre>
    </div>
  );
}

function ResponseBlock({ json }) {
  return (
    <>
      <div className="rad-rlab">Response</div>
      <div className="rad-resp"><pre className="rad-resp-pre">{json}</pre></div>
    </>
  );
}

function ParamTable({ rows }) {
  return (
    <div className="rad-ptable">
      <table>
        <thead><tr><th>Parameter</th><th>Description</th></tr></thead>
        <tbody>
          {rows.map(([param, required, desc]) => (
            <tr key={param}>
              <td className="rad-param-name">
                {param}
                <span className={required ? 'rad-req' : 'rad-opt'}>{required ? 'REQUIRED' : 'OPTIONAL'}</span>
              </td>
              <td dangerouslySetInnerHTML={{ __html: desc }} />
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Callout({ variant, children }) {
  return (
    <div className={`rad-callout ${variant}`}>
      <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <circle cx={12} cy={12} r={10} /><line x1={12} y1={16} x2={12} y2={12} /><line x1={12} y1={8} x2={12.01} y2={8} />
      </svg>
      <span>{children}</span>
    </div>
  );
}

function ApiDocsInner({ dark: darkProp, t: tProp, embedded, onNavigate } = {}) {
  const theme = useTheme();
  const dark = darkProp ?? theme.dark;
  const t = tProp ?? theme.t;

  const [lang, setLang] = useState('curl');
  const [activeSec, setActiveSec] = useState('start');
  const [stats, setStats] = useState(null);
  const docRef = useRef(null);
  const toast = useToast();

  useEffect(() => {
    fetch('/api/site-info').then(r => r.json()).then(d => { if (d?.stats) setStats(d.stats); }).catch(() => {});
  }, []);

  const curatedCount = stats?.services || 0;

  const copyText = useCallback((text) => {
    try { copyText(text); } catch {}
    toast?.success('Copied', text.length > 44 ? text.slice(0, 44) + '...' : text, { duration: 2000 });
  }, [toast]);

  useEffect(() => {
    const doc = docRef.current;
    if (!doc) return;
    const observer = new IntersectionObserver(entries => {
      for (const e of entries) {
        if (e.isIntersecting) { setActiveSec(e.target.id); break; }
      }
    }, { rootMargin: '-80px 0px -60% 0px', threshold: 0 });
    SECTIONS.forEach(s => {
      const el = doc.querySelector(`#${s.id}`);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, []);

  const accent = '#c47d8e';
  const blue = dark ? '#60a5fa' : '#2563eb';
  const muted = dark ? '#8a8580' : '#757170';
  const soft = dark ? '#c9c5c0' : '#4a4744';
  const border = dark ? 'rgba(255,255,255,.16)' : 'rgba(0,0,0,.12)';
  const hair = dark ? 'rgba(255,255,255,.09)' : 'rgba(0,0,0,.08)';
  const panel = dark ? '#131728' : '#fff';
  const track = dark ? 'rgba(255,255,255,.07)' : 'rgba(0,0,0,.05)';
  const code = dark ? '#0d101d' : '#faf8f5';
  const blueSoft2 = dark ? 'rgba(96,165,250,.2)' : 'rgba(37,99,235,.15)';
  const accentSoft = dark ? 'rgba(196,125,142,.12)' : 'rgba(196,125,142,.08)';
  const accentSoft2 = dark ? 'rgba(196,125,142,.22)' : 'rgba(196,125,142,.16)';
  const blueSoft = dark ? 'rgba(96,165,250,.1)' : 'rgba(37,99,235,.08)';
  const red = dark ? '#fca5a5' : '#dc2626';
  const grad = 'linear-gradient(135deg, #c47d8e, #8b5e6b)';
  const shadow = dark ? '0 14px 40px rgba(0,0,0,.45)' : '0 14px 40px rgba(28,27,25,.1)';

  return (
    <>
      {!embedded && <SharedStyles />}
      <style>{`
        .rad-sb-head{font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:1.5px;margin-bottom:8px;padding:6px 10px;border-radius:8px}
        .rad-sb-item{padding:10px 12px;border-radius:8px;margin-bottom:6px}
        .rad-frame{max-width:1180px;margin:18px auto 40px;border:1px solid ${border};border-radius:18px;overflow:hidden;box-shadow:${shadow};background:${dark ? '#090c15' : '#f0ede8'}}
        .rad-topbar{display:flex;align-items:center;justify-content:space-between;padding:13px 22px;border-bottom:1px solid ${hair};background:${dark ? 'rgba(14,17,34,.95)' : 'rgba(240,237,232,.97)'}}
        .rad-wm{font-size:20px;font-weight:800;color:${accent};letter-spacing:-.5px}
        .rad-wm span{color:${muted};font-weight:600;font-size:13px;letter-spacing:0;margin-left:10px}
        .rad-docgrid{display:grid;grid-template-columns:230px 1fr;min-height:700px}
        .rad-toc{border-right:1px solid ${hair};background:${dark ? 'rgba(14,17,34,.95)' : 'rgba(240,237,232,.97)'};padding:18px 12px;position:sticky;top:0;align-self:start;max-height:100vh;overflow-y:auto}
        .rad-toc-label{font-size:9.5px;font-weight:800;letter-spacing:1.3px;text-transform:uppercase;color:${muted};padding:0 10px;margin:14px 0 6px}
        .rad-toc-label:first-child{margin-top:0}
        .rad-toc a{display:flex;align-items:center;gap:8px;padding:7px 10px;border-radius:9px;font-size:12.5px;font-weight:500;color:${muted};text-decoration:none;transition:.12s;cursor:pointer}
        .rad-toc a:hover{color:${t.text};background:${track}}
        .rad-toc a.on{background:${blueSoft2};color:${blue};font-weight:700}
        .rad-mth-badge{font-size:8.5px;font-weight:800;padding:2px 6px;border-radius:5px;background:${blueSoft2};color:${blue};margin-left:auto}
        .rad-doc{min-width:0;padding:30px 36px 50px}
        .rad-eyebrow{display:inline-flex;font-size:10px;font-weight:800;letter-spacing:1.4px;text-transform:uppercase;color:${blue};background:${blueSoft2};border-radius:99px;padding:5px 12px}
        .rad-hero-title{font-size:28px;font-weight:800;letter-spacing:-.6px;margin-top:12px;color:${t.text}}
        .rad-hero-desc{font-size:13.5px;color:${muted};line-height:1.7;max-width:640px;margin-top:8px}
        .rad-basecard{display:flex;gap:0;border:1px solid ${hair};border-radius:13px;overflow:hidden;margin-top:16px;background:${panel};flex-wrap:wrap}
        .rad-basecard>div{padding:13px 18px;border-right:1px solid ${hair};flex:1;min-width:150px}
        .rad-basecard>div:last-child{border-right:none}
        .rad-basecard .bl{font-size:9.5px;font-weight:800;letter-spacing:1px;text-transform:uppercase;color:${muted}}
        .rad-basecard .bv{font-size:13px;font-weight:700;margin-top:3px;color:${t.text}}
        .rad-sec{margin-top:36px;scroll-margin-top:80px}
        .rad-sec h2{font-size:19px;font-weight:800;letter-spacing:-.3px;display:flex;align-items:center;gap:10px;flex-wrap:wrap;color:${t.text}}
        .rad-sec h2 .mth{font-size:9.5px;font-weight:800;padding:3px 9px;border-radius:6px;background:${blueSoft2};color:${blue}}
        .rad-desc{font-size:13px;color:${muted};line-height:1.7;margin-top:7px;max-width:640px}
        .rad-desc code{font-size:12px;background:${track};padding:1px 6px;border-radius:5px;font-family:'JetBrains Mono',ui-monospace,monospace}
        .rad-ptable{border:1px solid ${hair};border-radius:12px;overflow:hidden;margin-top:14px;background:${panel}}
        .rad-ptable table{width:100%;border-collapse:collapse;font-size:12.5px}
        .rad-ptable th{text-align:left;padding:10px 14px;font-size:9.5px;font-weight:800;letter-spacing:1px;text-transform:uppercase;color:${muted};border-bottom:1px solid ${hair}}
        .rad-ptable td{padding:10px 14px;border-bottom:1px solid ${hair};color:${soft};vertical-align:top;line-height:1.55}
        .rad-ptable tr:last-child td{border-bottom:none}
        .rad-param-name{font-family:'JetBrains Mono',ui-monospace,monospace;font-size:12px;font-weight:600;color:${t.text};white-space:nowrap}
        .rad-req{font-size:8.5px;font-weight:800;letter-spacing:.5px;padding:2px 6px;border-radius:5px;background:${accentSoft2};color:${accent};margin-left:7px;vertical-align:1px}
        .rad-opt{font-size:8.5px;font-weight:800;letter-spacing:.5px;padding:2px 6px;border-radius:5px;background:${track};color:${muted};margin-left:7px;vertical-align:1px}
        .rad-codewrap{margin-top:14px;border:1px solid ${hair};border-radius:13px;overflow:hidden;background:${code}}
        .rad-codehead{display:flex;align-items:center;justify-content:space-between;padding:8px 10px;border-bottom:1px solid ${hair};background:${panel}}
        .rad-langtabs{display:flex;gap:3px}
        .rad-langtabs button{font-size:11px;font-weight:700;padding:5px 12px;border-radius:8px;color:${muted};transition:.12s;background:none;border:none;cursor:pointer;font-family:inherit}
        .rad-langtabs button.on{background:${blueSoft2};color:${blue}}
        .rad-langtabs button:hover:not(.on){color:${t.text}}
        .rad-copybtn{font-size:10.5px;font-weight:700;padding:5px 12px;border-radius:8px;background:${track};color:${muted};border:1px solid ${hair};cursor:pointer;font-family:inherit}
        .rad-copybtn:hover{color:${accent}}
        .rad-code-pre{padding:14px 16px;font-family:'JetBrains Mono',ui-monospace,monospace;font-size:11.5px;line-height:1.75;overflow-x:auto;color:${soft};margin:0;white-space:pre-wrap;word-break:break-all}
        .rad-rlab{font-size:9.5px;font-weight:800;letter-spacing:1px;text-transform:uppercase;color:${muted};margin:14px 0 0}
        .rad-resp{margin-top:8px;border:1px solid ${hair};border-radius:13px;background:${code};overflow:hidden}
        .rad-resp-pre{padding:13px 16px;font-family:'JetBrains Mono',ui-monospace,monospace;font-size:11.5px;line-height:1.7;overflow-x:auto;color:${soft};margin:0;white-space:pre-wrap;word-break:break-all}
        .rad-callout{display:flex;gap:11px;padding:13px 15px;border-radius:12px;margin-top:14px;font-size:12.5px;line-height:1.65;border:1px solid}
        .rad-callout.blue{background:${blueSoft};border-color:${blueSoft2};color:${soft}}
        .rad-callout.rose{background:${accentSoft};border-color:${accentSoft2};color:${soft}}
        .rad-callout b{color:${t.text}}
        .rad-callout svg{flex-shrink:0;margin-top:2px}
        .rad-callout.blue svg{color:${blue}}
        .rad-callout.rose svg{color:${accent}}
        .rad-errtable td:first-child{color:${red};font-weight:600}
        .rad-foot{margin-top:40px;padding:20px 22px;border-radius:15px;background:${grad};color:#fff;display:flex;justify-content:space-between;align-items:center;gap:14px;flex-wrap:wrap}
        .rad-foot h3{font-size:15.5px;font-weight:800}
        .rad-foot p{font-size:12px;opacity:.9;margin-top:3px}
        .rad-foot-btn{background:#fff;color:#8b5e6b;font-size:12.5px;font-weight:800;padding:10px 16px;border-radius:10px;border:none;cursor:pointer;font-family:inherit}
        .rad-pill-link{font-size:12px;font-weight:700;padding:8px 14px;border-radius:10px;border:1px solid ${border};color:${soft};background:none;cursor:pointer;font-family:inherit;text-decoration:none}
        .rad-pill-link.primary{background:linear-gradient(135deg,#60a5fa,#2563eb);color:#fff;border:none}
        @media(max-width:860px){
          .rad-docgrid{grid-template-columns:1fr}
          .rad-toc{position:static;border-right:none;border-bottom:1px solid ${hair};display:flex;gap:4px;overflow-x:auto;padding:10px 12px;max-height:none}
          .rad-toc-label{display:none}
          .rad-toc a{white-space:nowrap;font-size:11.5px;flex-shrink:0}
          .rad-mth-badge{display:none}
          .rad-doc{padding:22px 16px 36px}
          .rad-hero-title{font-size:22px}
          .rad-basecard>div{min-width:100%;border-right:none;border-bottom:1px solid ${hair}}
          .rad-basecard>div:last-child{border-bottom:none}
        }
      `}</style>

      <div className={embedded ? '' : 'min-h-dvh flex flex-col'} style={embedded ? {} : { background: t.bg }}>
        {!embedded && <SharedNav />}

        <div className={embedded ? '' : 'px-4 sm:px-6 flex-1'}>
          <div className="rad-frame">
            <div className="rad-topbar">
              <span className="rad-wm">nitro<span>API documentation</span></span>
              <div className="flex gap-2.5 items-center">
                <button className="rad-pill-link" onClick={() => onNavigate ? onNavigate('lab') : null}>Reseller HQ</button>
                <button className="rad-pill-link primary" onClick={() => onNavigate ? onNavigate('overview') : null}>Dashboard</button>
              </div>
            </div>

            <div className="rad-docgrid">
              {/* TOC sidebar */}
              <nav className="rad-toc">
                {(() => {
                  let lastGroup = '';
                  return SECTIONS.map(s => {
                    const els = [];
                    if (s.group !== lastGroup) {
                      els.push(<div key={`g-${s.group}`} className="rad-toc-label">{s.group}</div>);
                      lastGroup = s.group;
                    }
                    els.push(
                      <a key={s.id} href={`#${s.id}`} className={activeSec === s.id ? 'on' : ''} onClick={() => setActiveSec(s.id)}>
                        {s.nav}
                        {s.isMethod && <span className="rad-mth-badge">POST</span>}
                      </a>
                    );
                    return els;
                  });
                })()}
              </nav>

              {/* Main doc content */}
              <div className="rad-doc" ref={docRef}>
                {/* Hero */}
                <div>
                  <span className="rad-eyebrow">API v2</span>
                  <h1 className="rad-hero-title">The Nitro API</h1>
                  <p className="rad-hero-desc">One endpoint, six actions, the standard format every SMM panel speaks. Point your panel or code at the base URL below with your key, and orders flow at reseller rates with full natural delivery speed.</p>
                  <div className="rad-basecard">
                    <div><div className="bl">Base URL</div><div className="bv" style={{ fontFamily: "'JetBrains Mono',ui-monospace,monospace" }}>https://nitro.ng/api/v2</div></div>
                    <div><div className="bl">Method</div><div className="bv">POST · form-encoded</div></div>
                    <div><div className="bl">Response</div><div className="bv">JSON</div></div>
                    <div><div className="bl">Currency</div><div className="bv">NGN, from your wallet</div></div>
                  </div>
                </div>

                {/* Getting started */}
                <div className="rad-sec" id="start">
                  <h2>Getting started</h2>
                  <div className="rad-desc">Every request is a <code>POST</code> to the base URL with your <code>key</code> and an <code>action</code>. Running ready-made panel software? Paste the base URL and your key into its provider settings, hit sync, and skip straight to setting your margins. Building custom? The six actions below are everything.</div>
                  <CodeBlock params={[['key', 'YOUR_API_KEY'], ['action', 'balance']]} lang={lang} setLang={setLang} onCopy={copyText} />
                  <ResponseBlock json={'{"balance": "124500.00", "currency": "NGN"}'} />
                </div>

                {/* Authentication */}
                <div className="rad-sec" id="auth">
                  <h2>Authentication</h2>
                  <div className="rad-desc">Your key is in <b style={{ color: t.text }}>Settings</b> on every verified account; wholesale rates arrive by approval. It identifies your account, applies your reseller rates, and charges your Nitro wallet. Keep it server-side and never in client code or public repos. Regenerating from the Lab kills the old key immediately.</div>
                  <Callout variant="rose"><b>Orders are never delayed by gradual delivery.</b> API orders run at full natural provider speed. Keep your wallet funded ahead of your sales and fulfilment starts the moment an order lands.</Callout>
                </div>

                {/* Catalogs */}
                <div className="rad-sec" id="catalogs">
                  <h2>Catalogs &amp; rates</h2>
                  <div className="rad-desc">Your key serves the catalogue on your account, curated by default and the full list on request: <b style={{ color: t.text }}>Nitro Curated</b> ({curatedCount ? `${curatedCount} tested` : 'tested'} services in Budget, Standard and Premium tiers) or the <b style={{ color: t.text }}>Full Catalogue</b> (thousands of raw provider services). The <code>services</code> action always returns your current list at your current reseller rates. Rates improve automatically as your monthly volume climbs the ladder.</div>
                </div>

                {/* services */}
                <div className="rad-sec" id="services">
                  <h2><span className="mth">POST</span> services</h2>
                  <div className="rad-desc">Returns your service list with live pricing. Sync this into your panel, then set your own margins on top.</div>
                  <ParamTable rows={[
                    ['key', true, 'Your API key'],
                    ['action', true, '<code>services</code>'],
                  ]} />
                  <CodeBlock params={[['key', 'YOUR_API_KEY'], ['action', 'services']]} lang={lang} setLang={setLang} onCopy={copyText} />
                  <ResponseBlock json={`[
  {
    "service": 3877,
    "name": "Instagram Followers · Standard",
    "category": "Instagram",
    "rate": "2720.00",
    "min": 100,
    "max": 50000,
    "refill": true,
    "cancel": true,
    "type": "Default",
    "description": ""
  },
  {
    "service": 4310,
    "name": "Discord Members (Offline) · Standard",
    "category": "Discord",
    "rate": "3900.00",
    "min": 100,
    "max": 10000,
    "refill": false,
    "cancel": false,
    "type": "Default",
    "description": "Members join your server but appear offline. Your server invite link must be set to never expire. Required setup before ordering: 1. Add the bot to your server: https://nowon.tools 2. Set verification level to None or Low ..."
  }
]`} />
                  <Callout variant="blue"><b>Read <code>description</code> before you sell a service.</b> It carries what the buyer must do first: the Discord bot setup, which link to paste, the traffic-targeting and comment parameters. Show it on your order page. <code>type</code> is the standard panel type (<code>Default</code>, <code>Custom Comments</code>, <code>SEO</code>, <code>Package</code>) so your panel asks for the right extra fields.</Callout>
                </div>

                {/* add */}
                <div className="rad-sec" id="add">
                  <h2><span className="mth">POST</span> add</h2>
                  <div className="rad-desc">Places an order. The charge is <code>rate × quantity ÷ 1000</code>, deducted from your wallet at your reseller rate.</div>
                  <ParamTable rows={[
                    ['key', true, 'Your API key'],
                    ['action', true, '<code>add</code>'],
                    ['service', true, 'Service ID from <code>services</code>'],
                    ['link', true, 'Target URL or username'],
                    ['quantity', true, 'Amount, within the service min and max'],
                    ['comments', false, 'Comment services (<code>type</code> Custom Comments): one comment per line; quantity is the number of lines'],
                    ['usernames', false, 'Mention services: usernames, one per line'],
                    ['keywords', false, 'SEO services: search terms, one per line'],
                    ['country', false, 'Traffic services: 2-letter country code, <code>WW</code> for worldwide, or a continent (<code>AFR</code>, <code>ASI</code>, <code>EUR</code>, <code>NAM</code>, <code>SAM</code>, <code>MEA</code>)'],
                    ['device', false, 'Traffic services: <code>all</code>, <code>mobile</code> or <code>desktop</code>. Defaults to all'],
                    ['keyword', false, 'Traffic services: search term the visits appear to come from. Leave out for direct visits'],
                    ['referrer', false, 'Traffic services: referring site the visits appear to come from. Leave out for direct visits'],
                  ]} />
                  <CodeBlock params={[['key', 'YOUR_API_KEY'], ['action', 'add'], ['service', '3877'], ['link', 'https://instagram.com/client'], ['quantity', '1000']]} lang={lang} setLang={setLang} onCopy={copyText} />
                  <ResponseBlock json={'{"order": 4211}'} />
                  <Callout variant="blue"><b>Insufficient balance?</b> The order is rejected with an error, nothing is queued and nothing is charged. Top up and resend.</Callout>
                </div>

                {/* status */}
                <div className="rad-sec" id="status">
                  <h2><span className="mth">POST</span> status</h2>
                  <div className="rad-desc">Order state, start count and remains. Pass one order ID, or up to 100 comma-separated IDs to poll in bulk. Statuses: <code>Pending</code>, <code>In progress</code>, <code>Completed</code>, <code>Partial</code>, <code>Canceled</code>, <code>Refunded</code>.</div>
                  <ParamTable rows={[
                    ['key', true, 'Your API key'],
                    ['action', true, '<code>status</code>'],
                    ['order', true, 'Order ID'],
                    ['orders', false, 'Up to 100 IDs, comma separated, instead of <code>order</code>'],
                  ]} />
                  <CodeBlock params={[['key', 'YOUR_API_KEY'], ['action', 'status'], ['order', '4211']]} lang={lang} setLang={setLang} onCopy={copyText} />
                  <ResponseBlock json={`{
  "charge": "2720.00",
  "start_count": "1200",
  "status": "In progress",
  "remains": "450",
  "currency": "NGN"
}`} />
                </div>

                {/* refill */}
                <div className="rad-sec" id="refill">
                  <h2><span className="mth">POST</span> refill</h2>
                  <div className="rad-desc">Triggers a refill on an eligible order (services with <code>refill: true</code>). Free within the service refill window.</div>
                  <ParamTable rows={[
                    ['key', true, 'Your API key'],
                    ['action', true, '<code>refill</code>'],
                    ['order', true, 'Order ID to refill'],
                  ]} />
                  <CodeBlock params={[['key', 'YOUR_API_KEY'], ['action', 'refill'], ['order', '4211']]} lang={lang} setLang={setLang} onCopy={copyText} />
                  <ResponseBlock json={'{"refill": "1"}'} />
                </div>

                {/* balance */}
                <div className="rad-sec" id="balance">
                  <h2><span className="mth">POST</span> balance</h2>
                  <div className="rad-desc">Your current wallet balance. Poll it to gate spend in your own panel before accepting customer orders.</div>
                  <ParamTable rows={[
                    ['key', true, 'Your API key'],
                    ['action', true, '<code>balance</code>'],
                  ]} />
                  <CodeBlock params={[['key', 'YOUR_API_KEY'], ['action', 'balance']]} lang={lang} setLang={setLang} onCopy={copyText} />
                  <ResponseBlock json={'{"balance": "124500.00", "currency": "NGN"}'} />
                </div>

                {/* cancel */}
                <div className="rad-sec" id="cancel">
                  <h2><span className="mth">POST</span> cancel</h2>
                  <div className="rad-desc">Requests cancellation on eligible orders (services with <code>cancel: true</code>) that haven&apos;t completed. Cancelled remains refund to your wallet automatically.</div>
                  <ParamTable rows={[
                    ['key', true, 'Your API key'],
                    ['action', true, '<code>cancel</code>'],
                    ['orders', true, 'Up to 100 IDs, comma separated'],
                  ]} />
                  <CodeBlock params={[['key', 'YOUR_API_KEY'], ['action', 'cancel'], ['orders', '4211,4212']]} lang={lang} setLang={setLang} onCopy={copyText} />
                  <ResponseBlock json={`[
  {"order": 4211, "cancel": 1},
  {"order": 4212, "cancel": {"error": "Order already completed"}}
]`} />
                </div>

                {/* Errors */}
                <div className="rad-sec" id="errors">
                  <h2>Errors</h2>
                  <div className="rad-desc">Errors come back as JSON with an <code>error</code> field and a 200 status, the SMM panel convention your software already expects.</div>
                  <div className="rad-ptable rad-errtable">
                    <table>
                      <thead><tr><th>Error</th><th>Meaning</th></tr></thead>
                      <tbody>
                        {ERRORS.map(([err, meaning]) => (
                          <tr key={err}>
                            <td className="rad-param-name">{err}</td>
                            <td>{meaning}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <ResponseBlock json={'{"error": "Not enough funds"}'} />
                </div>

                {/* Limits */}
                <div className="rad-sec" id="limits">
                  <h2>Limits</h2>
                  <div className="rad-desc">Generous and boring, the way limits should be: up to <b style={{ color: t.text }}>300 requests per minute</b> per key. Normal panel traffic never touches this. Poll <code>status</code> in bulk with the <code>orders</code> parameter instead of one call per order, and cache <code>services</code> for a few minutes rather than fetching per pageview.</div>
                  <Callout variant="blue"><b>Need more?</b> Scale-tier resellers can request higher limits. Message us on WhatsApp from your dashboard.</Callout>
                </div>

                {/* Footer CTA */}
                <div className="rad-foot">
                  <div>
                    <h3>Key not generated yet?</h3>
                    <p>Your key is already in Settings. Message support for wholesale; once approved, the same key returns lower rates.</p>
                  </div>
                  <button className="rad-foot-btn" onClick={() => onNavigate ? onNavigate('lab') : null}>Open Reseller HQ</button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {!embedded && <SharedFooter />}
      </div>

    </>
  );
}
