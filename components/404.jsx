'use client';
import { useState, useEffect, useRef } from "react";
import { ThemeProvider, useTheme } from "./shared-nav";

function NotFoundInner() {
  const { dark, toggleTheme, t, loaded } = useTheme();
  const [pulse, setPulse] = useState(0);

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
    <div style={{ minHeight: "100dvh", background: bg, fontFamily: "'Outfit',system-ui,sans-serif", display: "flex", flexDirection: "column", position: "relative", overflow: "hidden" }}>

      {/* Background effects */}
      <div style={{ position: "absolute", inset: 0, pointerEvents: "none", opacity: dark ? 0.5 : 0.3 }}>
        <div style={{ position: "absolute", width: "55%", height: "55%", top: "-12%", left: "-8%", borderRadius: "50%", background: "radial-gradient(ellipse, rgba(196,125,142,.07) 0%, transparent 70%)", filter: "blur(60px)" }} />
        <div style={{ position: "absolute", width: "40%", height: "40%", bottom: "-8%", right: "-8%", borderRadius: "50%", background: "radial-gradient(ellipse, rgba(100,120,200,.04) 0%, transparent 70%)", filter: "blur(60px)" }} />
      </div>

      {/* Grid */}
      <div style={{ position: "absolute", inset: 0, pointerEvents: "none", opacity: dark ? 0.025 : 0.035, backgroundImage: "linear-gradient(rgba(128,128,128,.15) 1px, transparent 1px), linear-gradient(90deg, rgba(128,128,128,.15) 1px, transparent 1px)", backgroundSize: "40px 40px" }} />

      {/* Nav */}
      <nav style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 24px", height: 52, borderBottom: `0.5px solid ${border}`, background: dark ? "rgba(8,11,20,.6)" : "rgba(244,241,237,.7)", backdropFilter: "blur(20px)", position: "relative", zIndex: 10, flexShrink: 0 }}>
        <a href="/" style={{ display: "flex", alignItems: "center", gap: 8, textDecoration: "none" }}>
          <div style={{ width: 24, height: 24, borderRadius: 6, background: "linear-gradient(135deg,#c47d8e,#8b5e6b)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 2px 8px rgba(196,125,142,.25)" }}><svg width="10" height="10" viewBox="0 0 20 20" fill="none"><path d="M4,16 L4,4 L16,16 L16,4" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg></div>
          <span style={{ fontSize: 14, fontWeight: 700, color: text, letterSpacing: 2 }}>NITRO</span>
        </a>
        <button onClick={toggleTheme} style={{ width: 40, height: 22, borderRadius: 11, background: dark ? "rgba(99,102,241,.2)" : "rgba(0,0,0,.06)", border: `0.5px solid ${dark ? "rgba(99,102,241,.15)" : "rgba(0,0,0,.08)"}`, position: "relative" }}>
          <div style={{ width: 16, height: 16, borderRadius: "50%", background: dark ? "#1e1b4b" : "#fff", position: "absolute", top: 2.5, left: dark ? 20.5 : 2.5, transition: "left .4s cubic-bezier(.4,0,.2,1)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: dark ? "none" : "0 1px 4px rgba(0,0,0,.15)" }}>
            {dark ? <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#a5b4fc" strokeWidth="2"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/></svg> : <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2"><circle cx="12" cy="12" r="5"/></svg>}
          </div>
        </button>
      </nav>

      {/* Main */}
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", position: "relative", zIndex: 1, padding: 20 }}>

        {/* Ghost 404 */}
        <div className="m" style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-58%)", fontSize: "clamp(120px, 25vw, 180px)", fontWeight: 700, color: dark ? "rgba(196,125,142,.06)" : "rgba(196,125,142,.08)", lineHeight: .85, letterSpacing: -6, pointerEvents: "none", userSelect: "none", fontFamily: "'JetBrains Mono',monospace" }}>404</div>

        <div style={{ textAlign: "center", maxWidth: 480, position: "relative", zIndex: 1 }}>

          {/* Compass orb */}
          <div style={{ position: "relative", width: 80, height: 80, margin: "0 auto 20px" }}>
            <div style={{ position: "absolute", inset: 0, borderRadius: "50%", border: `1.5px solid ${dark ? "rgba(196,125,142,.12)" : "rgba(196,125,142,.18)"}`, transform: `rotate(${pulse}deg)` }}>
              <div style={{ position: "absolute", width: 4, height: 4, borderRadius: "50%", background: accent, top: -2, left: "50%", transform: "translateX(-50%)", boxShadow: `0 0 6px ${accent}` }} />
            </div>
            <div style={{ position: "absolute", inset: 14, borderRadius: "50%", border: `1px solid ${dark ? "rgba(224,164,88,.08)" : "rgba(224,164,88,.12)"}`, transform: `rotate(${-pulse * 0.7}deg)` }}>
              <div style={{ position: "absolute", width: 3, height: 3, borderRadius: "50%", background: dark ? "#e0a458" : "#d97706", bottom: -1.5, left: "50%", transform: "translateX(-50%)" }} />
            </div>
            <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <div style={{ width: 28, height: 28, borderRadius: "50%", background: `radial-gradient(circle, ${dark ? "rgba(196,125,142,.12)" : "rgba(196,125,142,.08)"} 0%, transparent 70%)`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={accent} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/></svg>
              </div>
            </div>
          </div>

          {/* Heading */}
          <h1 style={{ fontSize: "clamp(28px, 6vw, 42px)", fontWeight: 300, color: text, marginBottom: 10, fontFamily: "'Cormorant Garamond',serif", fontStyle: "italic", lineHeight: 1.15 }}>Lost in the void</h1>

          {/* Body */}
          <p style={{ fontSize: 14, color: soft, lineHeight: 1.7, maxWidth: 340, margin: "0 auto 28px", fontWeight: 350 }}>This page doesn't exist, or it wandered off. Let's get you somewhere useful.</p>

          {/* Buttons */}
          <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap", marginBottom: 28 }}>
            <a href="/" style={{ padding: "12px 30px", borderRadius: 10, background: "linear-gradient(135deg,#c47d8e,#8b5e6b)", color: "#fff", fontSize: 14, fontWeight: 600, textDecoration: "none" }}>Go home</a>
            <a href="/dashboard" style={{ padding: "12px 30px", borderRadius: 10, background: dark ? "rgba(255,255,255,.04)" : "rgba(0,0,0,.03)", color: text, fontSize: 14, fontWeight: 600, textDecoration: "none", border: `0.5px solid ${border}` }}>Dashboard</a>
          </div>

          {/* Socials */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 16 }}>
            <span style={{ fontSize: 11, color: muted, marginRight: 4 }}>Find us</span>
            <a href="https://x.com/TheNitroNG" target="_blank" rel="noopener" style={{ width: 36, height: 36, borderRadius: 10, background: dark ? "rgba(255,255,255,.03)" : "rgba(0,0,0,.03)", border: `0.5px solid ${border}`, display: "flex", alignItems: "center", justifyContent: "center", textDecoration: "none" }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill={soft}><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
            </a>
            <a href="#" style={{ width: 36, height: 36, borderRadius: 10, background: dark ? "rgba(37,211,102,.04)" : "rgba(37,211,102,.04)", border: `0.5px solid ${dark ? "rgba(37,211,102,.1)" : "rgba(37,211,102,.08)"}`, display: "flex", alignItems: "center", justifyContent: "center", textDecoration: "none" }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill={green}><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
            </a>
            <a href="https://instagram.com/Nitro.ng" target="_blank" rel="noopener" style={{ width: 36, height: 36, borderRadius: 10, background: dark ? "rgba(196,125,142,.04)" : "rgba(196,125,142,.04)", border: `0.5px solid ${dark ? "rgba(196,125,142,.1)" : "rgba(196,125,142,.08)"}`, display: "flex", alignItems: "center", justifyContent: "center", textDecoration: "none" }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={accent} strokeWidth="2" strokeLinecap="round"><rect x="2" y="2" width="20" height="20" rx="5"/><path d="M16 11.37A4 4 0 1112.63 8 4 4 0 0116 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/></svg>
            </a>
            <a href="#" style={{ width: 36, height: 36, borderRadius: 10, background: dark ? "rgba(0,136,204,.04)" : "rgba(0,136,204,.04)", border: `0.5px solid ${dark ? "rgba(0,136,204,.1)" : "rgba(0,136,204,.08)"}`, display: "flex", alignItems: "center", justifyContent: "center", textDecoration: "none" }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill={telegram}><path d="M11.944 0A12 12 0 000 12a12 12 0 0012 12 12 12 0 0012-12A12 12 0 0012 0a12 12 0 00-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 01.171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.479.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/></svg>
            </a>
          </div>

          {/* Contact support */}
          <div style={{ fontSize: 13, color: muted }}>Think this is wrong? <a href="/dashboard" style={{ color: accent, fontWeight: 500, textDecoration: "none" }}>Contact support</a></div>
        </div>
      </div>

      {/* Footer */}
      <footer style={{ borderTop: `0.5px solid ${border}`, padding: "14px 24px", display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0, position: "relative", zIndex: 10 }}>
        <span style={{ fontSize: 11, color: muted }}>© {new Date().getFullYear() > 2026 ? `2026–${new Date().getFullYear()}` : "2026"} Nitro</span>
        <div style={{ display: "flex", gap: 14 }}><a href="/terms" style={{ fontSize: 11, color: muted, textDecoration: "none" }}>Terms</a><a href="/privacy" style={{ fontSize: 11, color: muted, textDecoration: "none" }}>Privacy</a></div>
      </footer>
    </div>
  );
}

export default function NotFound() {
  return <ThemeProvider><NotFoundInner /></ThemeProvider>;
}
