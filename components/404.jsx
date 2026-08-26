'use client';
import { useState, useMemo } from "react";
import { usePathname } from "next/navigation";
import { ThemeProvider, useTheme, ThemeToggle } from "./shared-nav";

const MARK = "M4.8 44.98 L4.8 26.8 A9.61 9.61 0 0 1 24.02 26.8 L24.02 39.15 A9.6 9.6 0 0 0 43.22 39.15 L43.22 6.82";
const ROUTES = ["dashboard","about","blog","changelog","contact","faq","help","lagos","live","login","pricing","privacy","pulse","quality","refund","reseller","reviews","services","signup","terms"];

function lev(a, b) {
  const m = a.length, n = b.length;
  if (!m) return n; if (!n) return m;
  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[n];
}

function NotFoundInner() {
  const { dark, toggleTheme, loaded } = useTheme();
  const pathname = usePathname() || "/";
  const [replay, setReplay] = useState(0);
  const [copied, setCopied] = useState(false);

  const suggestion = useMemo(() => {
    const seg = (pathname || "").split("/").filter(Boolean)[0] || "";
    if (!seg || seg.length < 3) return null;
    let best = null, bd = 9;
    for (const r of ROUTES) {
      const d = lev(seg.toLowerCase(), r);
      if (d < bd) { bd = d; best = r; }
    }
    return best && bd > 0 && bd <= 2 ? "/" + best : null;
  }, [pathname]);

  const bg = dark ? "#080b14" : "#f4f1ed";
  const border = dark ? "rgba(255,255,255,.1)" : "rgba(0,0,0,.08)";
  const hair = dark ? "rgba(255,255,255,.09)" : "rgba(0,0,0,.08)";
  const card = dark ? "rgba(255,255,255,.06)" : "rgba(255,255,255,.6)";
  const muted = dark ? "rgba(255,255,255,.34)" : "rgba(0,0,0,.34)";
  const soft = dark ? "rgba(255,255,255,.58)" : "rgba(0,0,0,.5)";
  const text = dark ? "#f0ede8" : "#1c1b19";
  const accent = "#c47d8e";
  const green = dark ? "#6ee7b7" : "#059669";
  const greenSoft = dark ? "rgba(110,231,183,.14)" : "rgba(5,150,105,.12)";
  const halo = dark ? "rgba(196,125,142,.14)" : "rgba(196,125,142,.16)";

  if (!loaded) return <div style={{ minHeight: "100dvh", background: bg }} />;

  const copyLink = () => {
    try { navigator.clipboard.writeText("https://nitro.ng" + pathname); } catch (e) {}
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const glyph = (cls, key) => (
    <svg key={key} viewBox="-1 0 50 54" aria-hidden="true"><path className={cls} d={MARK} /></svg>
  );

  return (
    <div className="min-h-dvh flex flex-col relative overflow-hidden" style={{ background: bg, fontFamily: "'Plus Jakarta Sans',system-ui,sans-serif" }}>
      <style>{`
        .nf-glow1{position:absolute;width:640px;height:640px;border-radius:9999px;top:-380px;left:50%;pointer-events:none;animation:nfAmb1 26s ease-in-out infinite alternate}
        .nf-glow2{position:absolute;width:420px;height:420px;border-radius:9999px;bottom:-300px;right:-140px;pointer-events:none;animation:nfAmb2 30s ease-in-out infinite alternate}
        @keyframes nfAmb1{from{transform:translateX(-50%)}to{transform:translateX(-50%) translateY(22px)}}
        @keyframes nfAmb2{from{transform:none}to{transform:translate(-18px,-16px)}}
        .nf-grain{position:absolute;inset:0;pointer-events:none;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")}
        .nf-rise{opacity:0;transform:translateY(10px);animation:nfRise .55s cubic-bezier(.2,.7,.3,1) forwards}
        @keyframes nfRise{to{opacity:1;transform:none}}
        .nf-lockup{display:flex;align-items:center;justify-content:center;gap:6px;user-select:none;position:relative}
        .nf-four{font-family:'JetBrains Mono',monospace;font-weight:800;font-size:128px;line-height:1;letter-spacing:-6px}
        .nf-markbox{position:relative;width:118px;height:118px;margin:0 10px;cursor:pointer}
        .nf-markbox svg{position:absolute;inset:0;width:100%;height:100%}
        .nf-mk{fill:none;stroke-width:9;stroke-linecap:round;stroke-linejoin:round}
        .nf-lead{stroke:#c47d8e;stroke-dasharray:220;stroke-dashoffset:220;animation:nfDraw 1.1s cubic-bezier(.6,0,.3,1) .15s forwards}
        .nf-echo{opacity:0;animation:nfEchoIn .8s ease 1s forwards,nfDrift 6s ease-in-out 1.8s infinite alternate}
        .nf-e1{stroke:#e05252;--dx:-5px;--dy:3px;animation-delay:1s,1.8s}
        .nf-e2{stroke:#34a97b;--dx:4px;--dy:-4px;animation-delay:1.12s,2.1s}
        .nf-e3{stroke:#ecc94b;--dx:-3px;--dy:-5px;animation-delay:1.24s,2.4s}
        @keyframes nfDraw{to{stroke-dashoffset:0}}
        @keyframes nfEchoIn{to{opacity:.16}}
        @keyframes nfDrift{from{transform:translate(0,0)}to{transform:translate(var(--dx),var(--dy))}}
        .nf-h1{font-family:'Cormorant Garamond',serif;font-size:clamp(26px,5vw,38px);font-weight:500;font-style:italic;letter-spacing:0;line-height:1.2;margin-top:28px}
        .nf-ctas{display:flex;gap:10px;justify-content:center;margin-top:26px;flex-wrap:wrap}
        @media(max-width:1024px){.nf-four{font-size:104px;letter-spacing:-5px}.nf-markbox{width:96px;height:96px}}
        @media(max-width:768px){.nf-four{font-size:88px;letter-spacing:-4px}.nf-markbox{width:82px;height:82px;margin:0 6px}.nf-h1{margin-top:24px}}
        @media(max-width:480px){.nf-four{font-size:64px;letter-spacing:-3px}.nf-markbox{width:60px;height:60px;margin:0 4px}.nf-h1{margin-top:20px}.nf-ctas{flex-direction:column;align-items:stretch}.nf-ctas a{justify-content:center}}
        @media(prefers-reduced-motion:reduce){.nf-lead{animation:none;stroke-dashoffset:0}.nf-echo{animation:none;opacity:.16}.nf-rise{animation:none;opacity:1;transform:none}.nf-glow1,.nf-glow2{animation:none}}
      `}</style>

      <div className="nf-glow1" style={{ background: `radial-gradient(circle, ${dark ? "rgba(196,125,142,.14)" : "rgba(196,125,142,.14)"} 0%, transparent 65%)` }} />
      <div className="nf-glow2" style={{ background: `radial-gradient(circle, ${dark ? "rgba(196,125,142,.08)" : "rgba(196,125,142,.07)"} 0%, transparent 65%)` }} />
      <div className="nf-grain" style={{ opacity: dark ? 0.07 : 0.045 }} />

      {/* Nav */}
      <nav className="flex items-center justify-between px-6 h-[52px] relative z-10 shrink-0 backdrop-blur-sm" style={{ borderBottom: `0.5px solid ${border}`, background: dark ? "rgba(8,11,20,.5)" : "rgba(244,241,237,.5)" }}>
        <a href="/" className="flex items-center gap-2 no-underline">
          <div className="w-6 h-6 rounded-md flex items-center justify-center" style={{ background: "linear-gradient(135deg,#c47d8e,#8b5e6b)" }}>
            <svg width="9" height="10" viewBox="0 0 1601 1785" fill="#fff"><path d="M1600.82 160.089V1313c-.85 53.13-10.35 104.17-27.19 151.74-48.19 136.54-156.38 244.73-292.92 292.92-50.12 17.76-103.94 27.34-160.08 27.34 0 0-79.39 0-160.01-27.34-85.1-28.88-155.38-85.49-208.28-141.55-72.59-76.84-112.13-179.09-112.13-284.74V1023.4v-3.08-12.9c.08-1.39.08-2.7.08-4.17 0-1.39 0-2.7-.08-4.09-2.08-84.64-69.97-153.06-154.53-155.84-1.85-.08-3.71-.15-5.48-.15-1.78 0-3.71.08-5.48.15-84.56 2.78-152.44 71.2-154.61 155.84-.08 1.39-.08 2.7-.08 4.09 0 1.47 0 2.78.08 4.17v534.87c0 88.42-71.67 160.09-160.09 160.09-44.17 0-84.25-17.92-113.21-46.88C17.92 1626.84 0 1586.76 0 1542.59V995.288c.927-53.132 10.426-104.178 27.261-151.672C75.45 707.003 183.643 598.81 320.179 550.621c50.119-17.685 103.946-27.338 160.089-27.338 0 0 79.388 0 160.012 27.338 85.103 28.882 155.379 85.489 208.278 141.555 72.593 76.84 112.132 179.087 112.132 284.732v307.972l-.077.92v12.89c-.077 1.39-.077 2.78-.077 4.17 0 1.39 0 2.7.077 4.17 2.085 84.64 69.967 152.99 154.527 155.84 1.86 0 3.71 0 5.49 0 1.77 0 3.7 0 5.48 0 84.56-2.85 152.44-71.2 154.6-155.84V160.089C1280.71 71.666 1352.38 0 1440.8 0c44.18 0 84.18 17.916 113.14 46.876 28.96 28.96 46.88 69.04 46.88 113.213z"/></svg>
          </div>
          <span className="text-[15px] font-semibold tracking-[2px]" style={{ color: text }}>NITRO</span>
        </a>
        <ThemeToggle dark={dark} onToggle={toggleTheme} />
      </nav>

      {/* Main */}
      <div className="flex-1 flex items-center justify-center relative z-[1] px-5 py-12">
        <div className="text-center w-full max-w-[560px] relative">

          <div className="nf-lockup">
            <div className="absolute" style={{ inset: "-50px -70px", background: `radial-gradient(circle, ${halo} 0%, transparent 68%)`, filter: "blur(10px)", zIndex: -1 }} />
            <span className="nf-four" style={{ color: text }}>4</span>
            <div className="nf-markbox" role="img" aria-label="0" title="" onClick={() => setReplay(r => r + 1)}>
              {glyph("nf-mk nf-echo nf-e3", `${replay}-3`)}
              {glyph("nf-mk nf-echo nf-e2", `${replay}-2`)}
              {glyph("nf-mk nf-echo nf-e1", `${replay}-1`)}
              {glyph("nf-mk nf-lead", `${replay}-l`)}
            </div>
            <span className="nf-four" style={{ color: text }}>4</span>
          </div>

          <h1 className="nf-h1 nf-rise" style={{ color: text, animationDelay: ".2s" }}>This page doesn&#39;t exist.</h1>

          <p className="nf-rise text-[13px] leading-[1.7] mx-auto mt-2.5" style={{ color: soft, maxWidth: 420, animationDelay: ".28s" }}>
            The link may be broken, or the page may have moved. Your account, orders and wallet are exactly where you left them.
          </p>

          <div className="nf-rise" style={{ animationDelay: ".36s" }}>
            <div className="inline-flex items-center gap-2 mt-[18px] rounded-full py-[7px] px-[14px] max-w-full" style={{ background: card, border: `1px solid ${hair}` }}>
              <span className="shrink-0 font-extrabold text-[11px]" style={{ color: accent }}>&#10005;</span>
              <span className="text-[11px] overflow-hidden text-ellipsis whitespace-nowrap" style={{ color: soft, fontFamily: "'JetBrains Mono',monospace" }}>nitro.ng{pathname}</span>
              <button onClick={copyLink} aria-label="Copy link" className="shrink-0 flex transition-colors duration-150" style={{ color: copied ? green : muted }}>
                {copied
                  ? <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                  : <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>}
              </button>
            </div>
          </div>

          {suggestion && (
            <div className="nf-rise" style={{ animationDelay: ".44s" }}>
              <a href={suggestion} className="inline-flex items-center gap-[7px] mt-3 rounded-full py-[7px] px-[15px] text-[11px] font-bold no-underline transition-transform duration-150 hover:-translate-y-px" style={{ color: accent, background: dark ? "rgba(196,125,142,.12)" : "rgba(196,125,142,.08)", border: `1px solid ${dark ? "rgba(196,125,142,.22)" : "rgba(196,125,142,.16)"}` }}>
                Did you mean <span style={{ fontFamily: "'JetBrains Mono',monospace" }}>{suggestion}</span>?
              </a>
            </div>
          )}

          <div className="nf-ctas nf-rise" style={{ animationDelay: ".52s" }}>
            <a href="/dashboard" className="inline-flex items-center gap-2 text-[13px] font-extrabold py-3 px-[22px] rounded-[11px] no-underline text-white transition-transform duration-150 hover:-translate-y-px" style={{ background: "linear-gradient(135deg,#c47d8e,#8b5e6b)", boxShadow: "0 5px 16px rgba(196,125,142,.28)" }}>Back to dashboard</a>
            <a href="/" className="inline-flex items-center gap-2 text-[13px] font-bold py-[11px] px-[18px] rounded-[11px] no-underline transition-transform duration-150 hover:-translate-y-px" style={{ color: soft, background: card, border: `1px solid ${border}` }}>Go home</a>
          </div>

          <div className="nf-rise flex gap-[18px] justify-center mt-[22px] text-[11px] flex-wrap" style={{ animationDelay: ".6s" }}>
            <a href="/services" className="inline-flex items-center gap-1.5 font-semibold no-underline" style={{ color: muted }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
              Services
            </a>
            <a href="/pricing" className="inline-flex items-center gap-1.5 font-semibold no-underline" style={{ color: muted }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>
              Pricing
            </a>
            <a href="https://wa.me/2347071656156?text=Hi%20Nitro%2C%20I%20need%20help" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 font-semibold no-underline" style={{ color: dark ? "#25d366" : "#1e9e50" }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
              Chat support
            </a>
          </div>

          <div className="nf-rise flex items-center justify-center gap-[7px] mt-8 text-[11px]" style={{ color: muted, animationDelay: ".7s" }}>
            <span className="w-[7px] h-[7px] rounded-full shrink-0" style={{ background: green, boxShadow: `0 0 0 3px ${greenSoft}` }} />
            All systems normal. Nothing else is affected.
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="py-3.5 px-6 flex justify-between items-center shrink-0 relative z-10" style={{ borderTop: `0.5px solid ${border}` }}>
        <span className="text-xs" style={{ color: muted }}>&copy; {new Date().getFullYear() > 2026 ? `2026–${new Date().getFullYear()}` : "2026"} Nitro</span>
        <div className="flex gap-3.5"><a href="/terms" className="text-xs no-underline" style={{ color: muted }}>Terms</a><a href="/privacy" className="text-xs no-underline" style={{ color: muted }}>Privacy</a></div>
      </footer>
    </div>
  );
}

export default function NotFound() {
  return <ThemeProvider><NotFoundInner /></ThemeProvider>;
}
