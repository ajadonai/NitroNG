'use client';
import { useState, useEffect, useRef } from "react";
import { ThemeProvider, useTheme } from "./shared-nav";

function MaintenanceInner() {
  const { dark, t, loaded } = useTheme();
  const [dots, setDots] = useState(0);
  const [msg, setMsg] = useState("We're performing scheduled upgrades. Everything will be back shortly.");
  const [eta, setEta] = useState("~1 hour");
  const [pulse, setPulse] = useState(0);
  const [sl, setSl] = useState({});
  const animRef = useRef(null);

  // Fetch social links
  useEffect(() => {
    fetch("/api/settings").then(r => r.json()).then(d => setSl(d.settings || {})).catch(() => {});
  }, []);

  // Check maintenance status — redirect when back online
  useEffect(() => {
    const check = () => {
      fetch("/api/maintenance-check").then(r => r.json()).then(d => {
        if (!d.maintenance) { window.location.replace("/"); return; }
        if (d.message) setMsg(d.message);
        if (d.eta) setEta(d.eta);
      }).catch(() => {});
    };
    check();
    const iv = setInterval(check, 15000); // Poll every 15s
    return () => clearInterval(iv);
  }, []);

  // Dot animation
  useEffect(() => { const iv = setInterval(() => setDots(d => (d + 1) % 4), 600); return () => clearInterval(iv); }, []);

  // Orb rotation
  useEffect(() => {
    let frame;
    const tick = () => { setPulse(p => (p + 0.5) % 360); frame = requestAnimationFrame(tick); };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);

  const amber = dark ? "#e0a458" : "#d97706";
  const bg = dark ? "#080b14" : "#f4f1ed";
  const border = dark ? "rgba(255,255,255,.06)" : "rgba(0,0,0,.06)";
  const cardGlass = dark ? "rgba(255,255,255,.03)" : "rgba(255,255,255,.6)";
  const muted = dark ? "rgba(255,255,255,.3)" : "rgba(0,0,0,.3)";
  const soft = dark ? "rgba(255,255,255,.5)" : "rgba(0,0,0,.5)";
  const text = dark ? "#f0ede8" : "#1c1b19";
  const accent = "#c47d8e";
  const green = "#25d366";

  // Don't render until theme loads (prevents flash)
  if (!loaded) return <div style={{ minHeight: "100dvh", background: bg }} />;

  return (
    <div style={{ minHeight: "100dvh", background: bg, fontFamily: "'Outfit',system-ui,sans-serif", display: "flex", flexDirection: "column", position: "relative", overflow: "hidden" }}>

      {/* Background effects */}
      <div style={{ position: "absolute", inset: 0, pointerEvents: "none", opacity: dark ? 0.5 : 0.3 }}>
        <div style={{ position: "absolute", width: "60%", height: "60%", top: "-15%", left: "-10%", borderRadius: "50%", background: `radial-gradient(ellipse, rgba(196,125,142,.08) 0%, transparent 70%)`, filter: "blur(60px)" }} />
        <div style={{ position: "absolute", width: "50%", height: "50%", bottom: "-10%", right: "-10%", borderRadius: "50%", background: `radial-gradient(ellipse, rgba(224,164,88,.06) 0%, transparent 70%)`, filter: "blur(60px)" }} />
        <div style={{ position: "absolute", width: "30%", height: "30%", top: "40%", left: "50%", borderRadius: "50%", background: `radial-gradient(ellipse, rgba(139,94,107,.05) 0%, transparent 70%)`, filter: "blur(40px)", transform: "translateX(-50%)" }} />
      </div>

      {/* Subtle grid */}
      <div style={{ position: "absolute", inset: 0, pointerEvents: "none", opacity: dark ? 0.03 : 0.04, backgroundImage: "linear-gradient(rgba(128,128,128,.15) 1px, transparent 1px), linear-gradient(90deg, rgba(128,128,128,.15) 1px, transparent 1px)", backgroundSize: "40px 40px" }} />

      {/* Nav */}
      <nav style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "0 24px", height: 52, borderBottom: `0.5px solid ${border}`, background: dark ? "rgba(8,11,20,.6)" : "rgba(244,241,237,.7)", backdropFilter: "blur(20px)", position: "relative", zIndex: 10, flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 22, height: 22, borderRadius: 6, background: "linear-gradient(135deg,#c47d8e,#8b5e6b)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="9" height="9" viewBox="0 0 20 20" fill="none"><path d="M4,16 L4,4 L16,16 L16,4" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </div>
          <span style={{ fontSize: 14, fontWeight: 600, color: text, letterSpacing: 2 }}>NITRO</span>
        </div>
      </nav>

      {/* Main */}
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", position: "relative", zIndex: 1, padding: 20 }}>
        <div style={{ textAlign: "center", maxWidth: 480 }}>

          {/* Animated orb */}
          <div style={{ position: "relative", width: 90, height: 90, margin: "0 auto 24px" }}>
            {/* Outer ring */}
            <div style={{ position: "absolute", inset: 0, borderRadius: "50%", border: `1.5px solid ${dark ? "rgba(196,125,142,.15)" : "rgba(196,125,142,.2)"}`, transform: `rotate(${pulse}deg)` }}>
              <div style={{ position: "absolute", top: -2, left: "50%", width: 4, height: 4, borderRadius: "50%", background: accent, transform: "translateX(-50%)", boxShadow: `0 0 6px ${accent}` }} />
            </div>
            {/* Inner ring */}
            <div style={{ position: "absolute", inset: 14, borderRadius: "50%", border: `1px solid ${dark ? "rgba(224,164,88,.1)" : "rgba(224,164,88,.15)"}`, transform: `rotate(${-pulse * 0.7}deg)` }}>
              <div style={{ position: "absolute", bottom: -2, left: "50%", width: 3, height: 3, borderRadius: "50%", background: amber, transform: "translateX(-50%)" }} />
            </div>
            {/* Center */}
            <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <div style={{ width: 32, height: 32, borderRadius: "50%", background: `radial-gradient(circle, ${dark ? "rgba(196,125,142,.15)" : "rgba(196,125,142,.1)"} 0%, transparent 70%)`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={accent} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z"/></svg>
              </div>
            </div>
          </div>

          {/* Status badge */}
          <div style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "5px 14px", borderRadius: 20, background: dark ? "rgba(224,164,88,.06)" : "rgba(224,164,88,.04)", border: `1px solid ${dark ? "rgba(224,164,88,.12)" : "rgba(224,164,88,.1)"}`, marginBottom: 16 }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: amber, boxShadow: `0 0 8px ${amber}` }} />
            <span style={{ fontSize: 11, fontWeight: 600, color: amber, letterSpacing: 1.2, textTransform: "uppercase" }}>Maintenance in progress</span>
          </div>

          {/* Heading */}
          <h1 style={{ fontSize: "clamp(26px, 5vw, 38px)", fontWeight: 300, color: text, marginBottom: 8, fontFamily: "'Cormorant Garamond',serif", lineHeight: 1.2 }}>We'll be right back</h1>

          {/* Message */}
          <p style={{ fontSize: 15, color: soft, lineHeight: 1.7, maxWidth: 380, margin: "0 auto 20px", fontWeight: 400 }}>{msg}</p>

          {/* ETA chip */}
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "9px 18px", borderRadius: 10, background: cardGlass, border: `1px solid ${border}`, marginBottom: 24 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={amber} strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            <span style={{ fontSize: 13, fontWeight: 600, color: amber }}>Estimated: {eta}</span>
          </div>

          {/* Dots */}
          <div style={{ display: "flex", justifyContent: "center", gap: 5, marginBottom: 28 }}>
            {[0, 1, 2].map(i => (
              <div key={i} style={{ width: 5, height: 5, borderRadius: "50%", background: i <= dots ? accent : (dark ? "rgba(255,255,255,.06)" : "rgba(0,0,0,.06)"), transition: "background .4s ease", boxShadow: i <= dots ? `0 0 6px ${accent}40` : "none" }} />
            ))}
          </div>

          {/* Social — icon-only buttons */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
            <span style={{ fontSize: 12, color: muted, marginRight: 4 }}>Stay updated</span>
            {/* X */}
            <a href={`https://x.com/${sl.social_twitter || "TheNitroNG"}`} target="_blank" rel="noopener" style={{ width: 36, height: 36, borderRadius: 10, background: dark ? "rgba(255,255,255,.03)" : "rgba(0,0,0,.03)", border: `0.5px solid ${border}`, display: "flex", alignItems: "center", justifyContent: "center", textDecoration: "none" }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill={soft}><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
            </a>
            {/* WhatsApp */}
            {sl.social_whatsapp ? (<a href={sl.social_whatsapp} target="_blank" rel="noopener" style={{ width: 36, height: 36, borderRadius: 10, background: dark ? "rgba(37,211,102,.04)" : "rgba(37,211,102,.04)", border: `0.5px solid ${dark ? "rgba(37,211,102,.1)" : "rgba(37,211,102,.08)"}`, display: "flex", alignItems: "center", justifyContent: "center", textDecoration: "none" }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill={green}><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
            </a>
            ) : null}
            {/* Instagram */}
            <a href={`https://instagram.com/${sl.social_instagram || "Nitro.ng"}`} target="_blank" rel="noopener" style={{ width: 36, height: 36, borderRadius: 10, background: dark ? "rgba(196,125,142,.04)" : "rgba(196,125,142,.04)", border: `0.5px solid ${dark ? "rgba(196,125,142,.1)" : "rgba(196,125,142,.08)"}`, display: "flex", alignItems: "center", justifyContent: "center", textDecoration: "none" }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={accent} strokeWidth="2" strokeLinecap="round"><rect x="2" y="2" width="20" height="20" rx="5"/><path d="M16 11.37A4 4 0 1112.63 8 4 4 0 0116 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/></svg>
            </a>
            {/* Telegram */}
            {sl.social_telegram ? (<a href={sl.social_telegram} target="_blank" rel="noopener" style={{ width: 36, height: 36, borderRadius: 10, background: dark ? "rgba(0,136,204,.04)" : "rgba(0,136,204,.04)", border: `0.5px solid ${dark ? "rgba(0,136,204,.1)" : "rgba(0,136,204,.08)"}`, display: "flex", alignItems: "center", justifyContent: "center", textDecoration: "none" }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="#0088cc"><path d="M11.944 0A12 12 0 000 12a12 12 0 0012 12 12 12 0 0012-12A12 12 0 0012 0a12 12 0 00-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 01.171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.479.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/></svg>
            </a>
            ) : null}
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer style={{ borderTop: `0.5px solid ${border}`, padding: "14px 24px", display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0, position: "relative", zIndex: 10 }}>
        <span style={{ fontSize: 12, color: muted }}>© 2026 Nitro</span>
        <div style={{ display: "flex", gap: 14 }}>
          <a href="/terms" style={{ fontSize: 12, color: muted, textDecoration: "none" }}>Terms</a>
          <a href="/privacy" style={{ fontSize: 12, color: muted, textDecoration: "none" }}>Privacy</a>
        </div>
      </footer>
    </div>
  );
}

export default function Maintenance() {
  return <ThemeProvider><MaintenanceInner /></ThemeProvider>;
}
