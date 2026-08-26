'use client';
import { useState, useEffect, useRef } from "react";
import { ThemeProvider, useTheme } from "./shared-nav";

const MARK = "M4.8 44.98 L4.8 26.8 A9.61 9.61 0 0 1 24.02 26.8 L24.02 39.15 A9.6 9.6 0 0 0 43.22 39.15 L43.22 6.82";

function MaintenanceInner() {
  const { dark, loaded } = useTheme();
  const [msg, setMsg] = useState("Planned maintenance is running right now. Orders already in flight keep delivering, balances are safe, and we'll be back before you miss us.");
  const [eta, setEta] = useState("~1 hour");
  const [until, setUntil] = useState(null);
  const [now, setNow] = useState(Date.now());
  const [sl, setSl] = useState({});
  const startRef = useRef(Date.now());

  useEffect(() => {
    fetch("/api/settings").then(r => r.json()).then(d => setSl(d.settings || {})).catch(() => {});
  }, []);

  useEffect(() => {
    const check = () => {
      fetch("/api/maintenance-check").then(r => r.json()).then(d => {
        if (!d.maintenance) { window.location.replace("/"); return; }
        if (d.message) setMsg(d.message);
        if (d.eta) setEta(d.eta);
        if (d.until && Number(d.until) > Date.now()) setUntil(Number(d.until));
      }).catch(() => {});
    };
    check();
    const iv = setInterval(check, 15000);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => {
    if (!until) return;
    const iv = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(iv);
  }, [until]);

  const bg = dark ? "#080b14" : "#f4f1ed";
  const border = dark ? "rgba(255,255,255,.1)" : "rgba(0,0,0,.08)";
  const hair = dark ? "rgba(255,255,255,.09)" : "rgba(0,0,0,.08)";
  const card = dark ? "rgba(255,255,255,.06)" : "rgba(255,255,255,.6)";
  const track = dark ? "rgba(255,255,255,.07)" : "rgba(0,0,0,.05)";
  const muted = dark ? "rgba(255,255,255,.34)" : "rgba(0,0,0,.34)";
  const soft = dark ? "rgba(255,255,255,.58)" : "rgba(0,0,0,.5)";
  const text = dark ? "#f0ede8" : "#1c1b19";
  const amber = dark ? "#e0a458" : "#d97706";
  const amberSoft = dark ? "rgba(224,164,88,.14)" : "rgba(217,119,6,.12)";
  const green = dark ? "#6ee7b7" : "#059669";

  if (!loaded) return <div style={{ minHeight: "100dvh", background: bg }} />;

  let big = eta, pct = null;
  if (until) {
    const left = Math.max(0, until - now);
    const mm = String(Math.floor(left / 60000)).padStart(2, "0");
    const ss = String(Math.floor((left % 60000) / 1000)).padStart(2, "0");
    big = left === 0 ? "00:00" : mm + ":" + ss;
    const total = Math.max(1, until - startRef.current);
    pct = Math.min(100, Math.round(((now - startRef.current) / total) * 100));
  }

  const waNum = (sl.social_whatsapp_support || "2347071656156").replace(/\D/g, "") || "2347071656156";

  return (
    <div className="min-h-dvh flex flex-col relative overflow-hidden" style={{ background: bg, fontFamily: "'Plus Jakarta Sans',system-ui,sans-serif" }}>
      <style>{`
        .mx-glow1{position:absolute;width:640px;height:640px;border-radius:9999px;top:-380px;left:50%;pointer-events:none;animation:mxAmb1 26s ease-in-out infinite alternate}
        .mx-glow2{position:absolute;width:420px;height:420px;border-radius:9999px;bottom:-300px;right:-140px;pointer-events:none;animation:mxAmb2 30s ease-in-out infinite alternate}
        @keyframes mxAmb1{from{transform:translateX(-50%)}to{transform:translateX(-50%) translateY(22px)}}
        @keyframes mxAmb2{from{transform:none}to{transform:translate(-18px,-16px)}}
        .mx-grain{position:absolute;inset:0;pointer-events:none;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")}
        .mx-rise{opacity:0;transform:translateY(10px);animation:mxRise .55s cubic-bezier(.2,.7,.3,1) forwards}
        @keyframes mxRise{to{opacity:1;transform:none}}
        .mx-markbox{position:relative;width:104px;height:104px;margin:0 auto}
        .mx-markbox svg{position:absolute;inset:0;width:100%;height:100%}
        .mx-mk{fill:none;stroke-width:9;stroke-linecap:round;stroke-linejoin:round}
        .mx-lead{stroke:#c47d8e;stroke-dasharray:220;stroke-dashoffset:220;animation:mxDraw 1.1s cubic-bezier(.6,0,.3,1) .15s forwards}
        .mx-echo{opacity:0;animation:mxEchoIn .8s ease 1s forwards,mxBreathe 2.6s ease-in-out 2s infinite}
        .mx-e1{stroke:#e05252;animation-delay:1s,2s}
        .mx-e2{stroke:#34a97b;animation-delay:1.12s,2.4s}
        .mx-e3{stroke:#ecc94b;animation-delay:1.24s,2.8s}
        @keyframes mxDraw{to{stroke-dashoffset:0}}
        @keyframes mxEchoIn{to{opacity:.16}}
        @keyframes mxBreathe{0%,100%{opacity:.12}50%{opacity:.34}}
        .mx-h1{font-family:'Cormorant Garamond',serif;font-size:clamp(28px,5vw,40px);font-weight:500;letter-spacing:0;line-height:1.2;margin-top:20px}
        .mx-steps{display:flex;align-items:center;justify-content:center;gap:10px;margin-top:22px;flex-wrap:wrap}
        .mx-s{display:inline-flex;align-items:center;gap:6px;font-size:11px;font-weight:700}
        .mx-pd{width:7px;height:7px;border-radius:9999px;background:currentColor;flex-shrink:0}
        .mx-act .mx-pd{animation:mxPulse 1.6s ease-in-out infinite}
        @keyframes mxPulse{0%,100%{box-shadow:0 0 0 0 rgba(217,119,6,.14)}50%{box-shadow:0 0 0 5px rgba(217,119,6,.14)}}
        .mx-sheen{position:absolute;top:0;bottom:0;width:34%;background:linear-gradient(90deg,transparent,rgba(255,255,255,.5),transparent);animation:mxSheen 2.2s ease-in-out infinite}
        @keyframes mxSheen{0%{left:-34%}100%{left:100%}}
        .mx-ctas{display:flex;gap:10px;justify-content:center;margin-top:26px;flex-wrap:wrap}
        @media(max-width:1024px){.mx-markbox{width:92px;height:92px}}
        @media(max-width:768px){.mx-markbox{width:82px;height:82px}}
        @media(max-width:480px){.mx-markbox{width:66px;height:66px}.mx-ctas{flex-direction:column;align-items:stretch}.mx-ctas a,.mx-ctas button{justify-content:center}.mx-steps{gap:7px}.mx-conn{display:none}}
        @media(prefers-reduced-motion:reduce){.mx-lead{animation:none;stroke-dashoffset:0}.mx-echo{animation:none;opacity:.2}.mx-rise{animation:none;opacity:1;transform:none}.mx-glow1,.mx-glow2{animation:none}.mx-sheen{animation:none;opacity:0}.mx-act .mx-pd{animation:none}}
      `}</style>

      <div className="mx-glow1" style={{ background: "radial-gradient(circle, rgba(196,125,142,.14) 0%, transparent 65%)" }} />
      <div className="mx-glow2" style={{ background: `radial-gradient(circle, ${dark ? "rgba(224,164,88,.08)" : "rgba(224,164,88,.07)"} 0%, transparent 65%)` }} />
      <div className="mx-grain" style={{ opacity: dark ? 0.07 : 0.045 }} />

      {/* Nav */}
      <nav className="flex items-center justify-center px-6 h-[52px] backdrop-blur-[20px] relative z-10 shrink-0" style={{ borderBottom: `0.5px solid ${border}`, background: dark ? "rgba(8,11,20,.6)" : "rgba(244,241,237,.7)" }}>
        <div className="flex items-center gap-2">
          <div className="w-[22px] h-[22px] rounded-md flex items-center justify-center" style={{ background: "linear-gradient(135deg,#c47d8e,#8b5e6b)" }}>
            <svg width="8" height="9" viewBox="0 0 1601 1785" fill="#fff"><path d="M1600.82 160.089V1313c-.85 53.13-10.35 104.17-27.19 151.74-48.19 136.54-156.38 244.73-292.92 292.92-50.12 17.76-103.94 27.34-160.08 27.34 0 0-79.39 0-160.01-27.34-85.1-28.88-155.38-85.49-208.28-141.55-72.59-76.84-112.13-179.09-112.13-284.74V1023.4v-3.08-12.9c.08-1.39.08-2.7.08-4.17 0-1.39 0-2.7-.08-4.09-2.08-84.64-69.97-153.06-154.53-155.84-1.85-.08-3.71-.15-5.48-.15-1.78 0-3.71.08-5.48.15-84.56 2.78-152.44 71.2-154.61 155.84-.08 1.39-.08 2.7-.08 4.09 0 1.47 0 2.78.08 4.17v534.87c0 88.42-71.67 160.09-160.09 160.09-44.17 0-84.25-17.92-113.21-46.88C17.92 1626.84 0 1586.76 0 1542.59V995.288c.927-53.132 10.426-104.178 27.261-151.672C75.45 707.003 183.643 598.81 320.179 550.621c50.119-17.685 103.946-27.338 160.089-27.338 0 0 79.388 0 160.012 27.338 85.103 28.882 155.379 85.489 208.278 141.555 72.593 76.84 112.132 179.087 112.132 284.732v307.972l-.077.92v12.89c-.077 1.39-.077 2.78-.077 4.17 0 1.39 0 2.7.077 4.17 2.085 84.64 69.967 152.99 154.527 155.84 1.86 0 3.71 0 5.49 0 1.77 0 3.7 0 5.48 0 84.56-2.85 152.44-71.2 154.6-155.84V160.089C1280.71 71.666 1352.38 0 1440.8 0c44.18 0 84.18 17.916 113.14 46.876 28.96 28.96 46.88 69.04 46.88 113.213z"/></svg>
          </div>
          <span className="text-sm font-semibold tracking-[2px]" style={{ color: text }}>NITRO</span>
        </div>
      </nav>

      {/* Main */}
      <div className="flex-1 flex items-center justify-center relative z-[1] px-5 py-12">
        <div className="text-center w-full max-w-[560px] relative">

          <div className="mx-rise inline-flex text-[11px] font-bold tracking-[2.6px]" style={{ color: amber, fontFamily: "'JetBrains Mono',monospace" }}>SCHEDULED MAINTENANCE</div>

          <div className="mt-5">
            <div className="mx-markbox" role="img" aria-label="Nitro">
              <svg viewBox="-1 0 50 54" aria-hidden="true"><path className="mx-mk mx-echo mx-e3" d={MARK} /></svg>
              <svg viewBox="-1 0 50 54" aria-hidden="true"><path className="mx-mk mx-echo mx-e2" d={MARK} /></svg>
              <svg viewBox="-1 0 50 54" aria-hidden="true"><path className="mx-mk mx-echo mx-e1" d={MARK} /></svg>
              <svg viewBox="-1 0 50 54" aria-hidden="true"><path className="mx-mk mx-lead" d={MARK} /></svg>
            </div>
            <div className="mx-auto mt-3 rounded-[50%]" style={{ width: 150, height: 18, background: `radial-gradient(ellipse at center, ${dark ? "rgba(0,0,0,.55)" : "rgba(0,0,0,.16)"}, transparent 68%)`, filter: "blur(2px)" }} />
          </div>

          <h1 className="mx-h1 mx-rise" style={{ color: text, animationDelay: ".2s" }}>Quick tune-up.</h1>

          <p className="mx-rise text-[13px] leading-[1.7] mx-auto mt-2.5" style={{ color: soft, maxWidth: 440, animationDelay: ".28s" }}>{msg}</p>

          <div className="mx-steps mx-rise" style={{ animationDelay: ".36s" }}>
            <span className="mx-s" style={{ color: green }}><span className="mx-pd" />Backup complete</span>
            <span className="mx-conn" style={{ width: 22, height: 1, background: hair }} />
            <span className="mx-s mx-act" style={{ color: amber }}><span className="mx-pd" />Upgrading now</span>
            <span className="mx-conn" style={{ width: 22, height: 1, background: hair }} />
            <span className="mx-s" style={{ color: muted }}><span className="mx-pd" />Final checks</span>
          </div>

          <div className="mx-rise" style={{ animationDelay: ".44s" }}>
            <div className="inline-flex flex-col items-center gap-1 mt-6 rounded-2xl py-4 px-[30px]" style={{ background: card, border: `1px solid ${hair}` }}>
              <span className="text-[11px] font-extrabold uppercase" style={{ color: muted, letterSpacing: "1.6px" }}>Back in about</span>
              <span className="font-extrabold" style={{ color: text, fontFamily: "'JetBrains Mono',monospace", fontSize: until ? 38 : 30, letterSpacing: "-1px", fontVariantNumeric: "tabular-nums", lineHeight: 1.2 }}>{big}</span>
              <div className="relative overflow-hidden rounded-full mt-2" style={{ width: 224, height: 5, background: track }}>
                {pct !== null && <span className="absolute left-0 top-0 bottom-0 rounded-full transition-[width] duration-1000 ease-linear" style={{ width: `${pct}%`, background: "linear-gradient(135deg,#c47d8e,#8b5e6b)" }} />}
                <span className="mx-sheen" />
              </div>
            </div>
          </div>

          <div className="mx-ctas mx-rise" style={{ animationDelay: ".52s" }}>
            <a href={`https://wa.me/${waNum}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-[7px] text-[13px] font-bold py-[11px] px-[18px] rounded-[11px] no-underline transition-transform duration-150 hover:-translate-y-px" style={{ color: dark ? "#25d366" : "#1e9e50", background: "rgba(37,211,102,.12)", border: "1px solid rgba(37,211,102,.4)" }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
              Updates on WhatsApp
            </a>
            <button onClick={() => window.location.reload()} className="inline-flex items-center gap-2 text-[13px] font-bold py-[11px] px-[18px] rounded-[11px] cursor-pointer transition-transform duration-150 hover:-translate-y-px" style={{ color: soft, background: card, border: `1px solid ${border}` }}>Try again</button>
          </div>

          <div className="mx-rise flex items-center justify-center gap-2 mt-[22px]" style={{ animationDelay: ".6s" }}>
            <span className="text-xs mr-1" style={{ color: muted }}>Stay updated</span>
            <a href={`https://x.com/${(sl.social_twitter || "TheNitroNG").replace(/^(https?:\/\/)?(www\.)?(x\.com|twitter\.com)\/?/i, "").replace(/^@/, "").replace(/\/$/, "")}`} target="_blank" rel="noopener noreferrer" aria-label="X (Twitter)" className="w-9 h-9 rounded-[10px] flex items-center justify-center no-underline transition-transform duration-200 hover:-translate-y-0.5" style={{ background: card, border: `0.5px solid ${border}` }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill={soft}><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
            </a>
            <a href={`https://instagram.com/${(sl.social_instagram || "Nitro.ng").replace(/^(https?:\/\/)?(www\.)?(instagram\.com)\/?/i, "").replace(/^@/, "").replace(/\/$/, "")}`} target="_blank" rel="noopener noreferrer" aria-label="Instagram" className="w-9 h-9 rounded-[10px] flex items-center justify-center no-underline transition-transform duration-200 hover:-translate-y-0.5" style={{ background: dark ? "rgba(196,125,142,.08)" : "rgba(196,125,142,.08)", border: `0.5px solid ${dark ? "rgba(196,125,142,.18)" : "rgba(196,125,142,.14)"}` }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#c47d8e" strokeWidth="2" strokeLinecap="round"><rect x="2" y="2" width="20" height="20" rx="5"/><path d="M16 11.37A4 4 0 1112.63 8 4 4 0 0116 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/></svg>
            </a>
          </div>

          <div className="mx-rise text-[11px] mt-4" style={{ color: muted, animationDelay: ".68s" }}>This page checks every 15 seconds and brings you back automatically.</div>

          <div className="mx-rise flex items-center justify-center gap-[7px] mt-7 text-[11px]" style={{ color: muted, animationDelay: ".76s" }}>
            <span className="w-[7px] h-[7px] rounded-full shrink-0" style={{ background: amber, boxShadow: `0 0 0 3px ${amberSoft}` }} />
            Planned maintenance. Orders in flight are unaffected.
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Maintenance() {
  return <ThemeProvider><MaintenanceInner /></ThemeProvider>;
}
