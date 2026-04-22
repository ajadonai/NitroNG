'use client';
import { useState, useEffect, useRef } from "react";
import { ThemeProvider, useTheme } from "./shared-nav";

function NotFoundInner() {
  const { dark, toggleTheme, t, loaded } = useTheme();
  const [pulse, setPulse] = useState(0);
  const [sl, setSl] = useState({});

  // Fetch social links
  useEffect(() => {
    fetch("/api/settings").then(r => r.json()).then(d => setSl(d.settings || {})).catch(() => {});
  }, []);

  // Orb rotation
  useEffect(() => {
    let frame;
    const tick = () => { setPulse(p => (p + 0.4) % 360); frame = requestAnimationFrame(tick); };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);

  const bg = dark ? "#080b14" : "#f4f1ed";
  const border = dark ? "rgba(255,255,255,.06)" : "rgba(0,0,0,.06)";
  const muted = dark ? "rgba(255,255,255,.3)" : "rgba(0,0,0,.3)";
  const soft = dark ? "rgba(255,255,255,.5)" : "rgba(0,0,0,.5)";
  const text = dark ? "#f0ede8" : "#1c1b19";
  const accent = "#c47d8e";
  const green = "#25d366";
  const telegram = "#0088cc";

  if (!loaded) return <div style={{ minHeight: "100dvh", background: bg }} />;

  return (
    <div className="min-h-dvh flex flex-col relative overflow-hidden" style={{ background: bg, fontFamily: "'Outfit',system-ui,sans-serif" }}>

      {/* Background effects */}
      <div className="absolute inset-0 pointer-events-none" style={{ opacity: dark ? 0.5 : 0.3 }}>
        <div className="absolute rounded-full blur-[60px]" style={{ width: "55%", height: "55%", top: "-12%", left: "-8%", background: "radial-gradient(ellipse, rgba(196,125,142,.07) 0%, transparent 70%)" }} />
        <div className="absolute rounded-full blur-[60px]" style={{ width: "40%", height: "40%", bottom: "-8%", right: "-8%", background: "radial-gradient(ellipse, rgba(100,120,200,.04) 0%, transparent 70%)" }} />
      </div>

      {/* Grid */}
      <div className="absolute inset-0 pointer-events-none" style={{ opacity: dark ? 0.025 : 0.035, backgroundImage: "linear-gradient(rgba(128,128,128,.15) 1px, transparent 1px), linear-gradient(90deg, rgba(128,128,128,.15) 1px, transparent 1px)", backgroundSize: "40px 40px" }} />

      {/* Nav */}
      <nav className="flex items-center justify-between px-6 h-[52px] backdrop-blur-[20px] relative z-10 shrink-0" style={{ borderBottom: `0.5px solid ${border}`, background: dark ? "rgba(8,11,20,.6)" : "rgba(244,241,237,.7)" }}>
        <a href="/" className="flex items-center gap-2 no-underline">
          <div className="w-6 h-6 rounded-md flex items-center justify-center" style={{ background: "linear-gradient(135deg,#c47d8e,#8b5e6b)", boxShadow: "0 2px 8px rgba(196,125,142,.25)" }}><svg width="10" height="10" viewBox="0 0 20 20" fill="none"><path d="M4,16 L4,4 L16,16 L16,4" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg></div>
          <span className="text-[15px] font-semibold tracking-[2px]" style={{ color: text }}>NITRO</span>
        </a>
        <button onClick={toggleTheme} className="w-10 h-[22px] rounded-[11px] relative" style={{ background: dark ? "rgba(99,102,241,.2)" : "rgba(0,0,0,.06)", border: `0.5px solid ${dark ? "rgba(99,102,241,.15)" : "rgba(0,0,0,.08)"}` }}>
          <div className="w-4 h-4 rounded-full absolute flex items-center justify-center transition-[left] duration-400 ease-[cubic-bezier(.4,0,.2,1)]" style={{ background: dark ? "#1e1b4b" : "#fff", top: 2.5, left: dark ? 20.5 : 2.5, boxShadow: dark ? "none" : "0 1px 4px rgba(0,0,0,.15)" }}>
            {dark ? <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#a5b4fc" strokeWidth="2"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/></svg> : <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2"><circle cx="12" cy="12" r="5"/></svg>}
          </div>
        </button>
      </nav>

      {/* Main */}
      <div className="flex-1 flex items-center justify-center relative z-[1] p-5">

        {/* Ghost 404 */}
        <div className="absolute pointer-events-none select-none font-semibold leading-[.85] -tracking-[6px]" style={{ top: "50%", left: "50%", transform: "translate(-50%,-58%)", fontSize: "clamp(120px, 25vw, 180px)", color: dark ? "rgba(196,125,142,.06)" : "rgba(196,125,142,.08)", fontFamily: "'JetBrains Mono',monospace" }}>404</div>

        <div className="text-center max-w-[480px] relative z-[1]">

          {/* Compass orb */}
          <div className="relative w-20 h-20 mx-auto mb-5">
            <div className="absolute inset-0 rounded-full" style={{ border: `1.5px solid ${dark ? "rgba(196,125,142,.12)" : "rgba(196,125,142,.18)"}`, transform: `rotate(${pulse}deg)` }}>
              <div className="absolute w-1 h-1 rounded-full -top-0.5 left-1/2 -translate-x-1/2" style={{ background: accent, boxShadow: `0 0 6px ${accent}` }} />
            </div>
            <div className="absolute inset-3.5 rounded-full" style={{ border: `1px solid ${dark ? "rgba(224,164,88,.08)" : "rgba(224,164,88,.12)"}`, transform: `rotate(${-pulse * 0.7}deg)` }}>
              <div className="absolute w-[3px] h-[3px] rounded-full -bottom-px left-1/2 -translate-x-1/2" style={{ background: dark ? "#e0a458" : "#d97706" }} />
            </div>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-7 h-7 rounded-full flex items-center justify-center" style={{ background: `radial-gradient(circle, ${dark ? "rgba(196,125,142,.12)" : "rgba(196,125,142,.08)"} 0%, transparent 70%)` }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={accent} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/></svg>
              </div>
            </div>
          </div>

          {/* Heading */}
          <h1 className="font-light mb-2.5 italic leading-[1.15]" style={{ fontSize: "clamp(28px, 6vw, 42px)", color: text, fontFamily: "'Cormorant Garamond',serif" }}>Lost in the void</h1>

          {/* Body */}
          <p className="text-[15px] leading-[1.7] max-w-[340px] mx-auto mb-7 font-normal" style={{ color: soft }}>This page doesn't exist, or it wandered off. Let's get you somewhere useful.</p>

          {/* Buttons */}
          <div className="flex gap-2.5 justify-center flex-wrap mb-7">
            <a href="/" className="py-3 px-[30px] rounded-[10px] text-[15px] font-semibold no-underline" style={{ background: "linear-gradient(135deg,#c47d8e,#8b5e6b)", color: "#fff" }}>Go home</a>
            <a href="/dashboard" className="py-3 px-[30px] rounded-[10px] text-[15px] font-semibold no-underline" style={{ background: dark ? "rgba(255,255,255,.04)" : "rgba(0,0,0,.03)", color: text, border: `0.5px solid ${border}` }}>Dashboard</a>
          </div>

          {/* Socials */}
          <div className="flex items-center justify-center gap-2 mb-4">
            <span className="text-xs mr-1" style={{ color: muted }}>Find us</span>
            <a href={`https://x.com/${sl.social_twitter || "TheNitroNG"}`} target="_blank" rel="noopener noreferrer" aria-label="X (Twitter)" className="w-9 h-9 rounded-[10px] flex items-center justify-center no-underline" style={{ background: dark ? "rgba(255,255,255,.03)" : "rgba(0,0,0,.03)", border: `0.5px solid ${border}` }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill={soft}><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
            </a>
            {sl.social_whatsapp ? (
              <a href={sl.social_whatsapp} target="_blank" rel="noopener noreferrer" aria-label="WhatsApp" className="w-9 h-9 rounded-[10px] flex items-center justify-center no-underline" style={{ background: dark ? "rgba(37,211,102,.04)" : "rgba(37,211,102,.04)", border: `0.5px solid ${dark ? "rgba(37,211,102,.1)" : "rgba(37,211,102,.08)"}` }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill={green}><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
              </a>
            ) : null}
            <a href={`https://instagram.com/${sl.social_instagram || "Nitro.ng"}`} target="_blank" rel="noopener noreferrer" aria-label="Instagram" className="w-9 h-9 rounded-[10px] flex items-center justify-center no-underline" style={{ background: dark ? "rgba(196,125,142,.04)" : "rgba(196,125,142,.04)", border: `0.5px solid ${dark ? "rgba(196,125,142,.1)" : "rgba(196,125,142,.08)"}` }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={accent} strokeWidth="2" strokeLinecap="round"><rect x="2" y="2" width="20" height="20" rx="5"/><path d="M16 11.37A4 4 0 1112.63 8 4 4 0 0116 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/></svg>
            </a>
            {sl.social_telegram ? (
              <a href={sl.social_telegram} target="_blank" rel="noopener noreferrer" aria-label="Telegram" className="w-9 h-9 rounded-[10px] flex items-center justify-center no-underline" style={{ background: dark ? "rgba(0,136,204,.04)" : "rgba(0,136,204,.04)", border: `0.5px solid ${dark ? "rgba(0,136,204,.1)" : "rgba(0,136,204,.08)"}` }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill={telegram}><path d="M11.944 0A12 12 0 000 12a12 12 0 0012 12 12 12 0 0012-12A12 12 0 0012 0a12 12 0 00-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 01.171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.479.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/></svg>
              </a>
            ) : null}
          </div>

          {/* Contact support */}
          <div className="text-sm" style={{ color: muted }}>Think this is wrong? <a href="/dashboard" className="font-medium no-underline" style={{ color: accent }}>Contact support</a></div>
        </div>
      </div>

      {/* Footer */}
      <footer className="py-3.5 px-6 flex justify-between items-center shrink-0 relative z-10" style={{ borderTop: `0.5px solid ${border}` }}>
        <span className="text-xs" style={{ color: muted }}>© {new Date().getFullYear() > 2026 ? `2026–${new Date().getFullYear()}` : "2026"} Nitro</span>
        <div className="flex gap-3.5"><a href="/terms" className="text-xs no-underline" style={{ color: muted }}>Terms</a><a href="/privacy" className="text-xs no-underline" style={{ color: muted }}>Privacy</a></div>
      </footer>
    </div>
  );
}

export default function NotFound() {
  return <ThemeProvider><NotFoundInner /></ThemeProvider>;
}
