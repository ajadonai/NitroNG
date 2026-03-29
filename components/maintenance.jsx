'use client';
import { useState, useEffect } from "react";
import { ThemeProvider, useTheme } from "./shared-nav";

function MaintenanceInner() {
  const { dark, t } = useTheme();
  const [dots, setDots] = useState(0);
  const [msg, setMsg] = useState("We're upgrading our systems to serve you better. This won't take long — grab a coffee and check back soon.");
  const [eta, setEta] = useState("~1 hour");

  useEffect(() => {
    fetch("/api/maintenance-check").then(r => r.json()).then(d => { if (!d.maintenance) { window.location.replace("/"); return; } if (d.message) setMsg(d.message); if (d.eta) setEta(d.eta); }).catch(() => {});
  }, []);
  useEffect(() => { const iv = setInterval(() => setDots(d => (d + 1) % 4), 500); return () => clearInterval(iv); }, []);

  const c = { bg: t.bg, tx: t.text, ts: t.soft, tm: t.muted, ac: t.accent, cbd: t.surfaceBrd, amber: dark ? "#e0a458" : "#d97706" };

  return (
    <div style={{ minHeight: "100dvh", background: c.bg, fontFamily: "'Outfit',system-ui,sans-serif", display: "flex", flexDirection: "column", position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", width: 300, height: 300, borderRadius: "50%", top: "10%", left: "-10%", background: dark ? "rgba(224,164,88,.04)" : "rgba(224,164,88,.03)", filter: "blur(80px)", pointerEvents: "none" }} />
      <div style={{ position: "absolute", width: 200, height: 200, borderRadius: "50%", bottom: "10%", right: "-5%", background: dark ? "rgba(196,125,142,.04)" : "rgba(196,125,142,.03)", filter: "blur(60px)", pointerEvents: "none" }} />

      <nav style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "0 24px", height: 56, borderBottom: `1px solid ${c.cbd}`, background: dark ? "rgba(8,11,20,.8)" : "rgba(244,241,237,.8)", backdropFilter: "blur(20px)", position: "relative", zIndex: 10, flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 26, height: 26, borderRadius: 7, background: "linear-gradient(135deg,#c47d8e,#8b5e6b)", display: "flex", alignItems: "center", justifyContent: "center" }}><svg width="11" height="11" viewBox="0 0 20 20" fill="none"><path d="M4,16 L4,4 L16,16 L16,4" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/></svg></div>
          <span style={{ fontSize: 15, fontWeight: 700, color: c.tx, letterSpacing: 1.5 }}>NITRO</span>
        </div>
      </nav>

      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", position: "relative", zIndex: 1 }}>
        <div style={{ textAlign: "center", padding: 24, maxWidth: 480 }}>
          <svg width="80" height="80" viewBox="0 0 96 96" fill="none" style={{ marginBottom: 28, opacity: .6 }}>
            <circle cx="48" cy="48" r="20" stroke={c.amber} strokeWidth="2" opacity=".3" />
            <circle cx="48" cy="48" r="12" stroke={c.amber} strokeWidth="2" opacity=".2" />
            <circle cx="48" cy="48" r="4" fill={c.amber} opacity=".3" />
            {[0, 45, 90, 135, 180, 225, 270, 315].map(deg => (
              <line key={deg} x1="48" y1="24" x2="48" y2="18" stroke={c.amber} strokeWidth="3" opacity=".25" strokeLinecap="round" transform={`rotate(${deg} 48 48)`} />
            ))}
            <path d="M62 34l12-12 4 4-12 12" stroke={c.amber} strokeWidth="2" opacity=".35" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M30 62l-8 8 4 4 8-8" stroke={c.amber} strokeWidth="2" opacity=".35" strokeLinecap="round" strokeLinejoin="round" />
          </svg>

          <h1 style={{ fontSize: "clamp(28px, 5vw, 36px)", fontWeight: 600, color: c.tx, marginBottom: 8, fontFamily: "'Cormorant Garamond',serif" }}>We'll be right back</h1>
          <p style={{ fontSize: 15, color: c.ts, lineHeight: 1.7, maxWidth: 380, margin: "0 auto 24px" }}>{msg}</p>

          <div style={{ display: "inline-flex", alignItems: "center", gap: 10, padding: "10px 20px", borderRadius: 12, background: dark ? "rgba(224,164,88,.08)" : "rgba(224,164,88,.04)", borderWidth: 1, borderStyle: "solid", borderColor: dark ? "rgba(224,164,88,.15)" : "rgba(224,164,88,.08)" }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={c.amber} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
            <span className="m" style={{ fontSize: 13, fontWeight: 600, color: c.amber, fontFamily: "'JetBrains Mono',monospace" }}>Estimated: {eta}</span>
          </div>

          <div style={{ marginTop: 28, display: "flex", justifyContent: "center", gap: 6 }}>
            {[0, 1, 2].map(i => (<div key={i} style={{ width: 8, height: 8, borderRadius: "50%", background: i <= dots ? c.amber : (dark ? "rgba(255,255,255,.08)" : "rgba(0,0,0,.06)"), transition: "background .3s ease" }} />))}
          </div>

          <div style={{ marginTop: 32, fontSize: 14, color: c.tm }}>Follow updates on <a href="https://x.com/TheNitroNG" style={{ color: c.ac, fontWeight: 500, textDecoration: "none" }}>X @TheNitroNG</a> or <a href="#" style={{ color: "#25d366", fontWeight: 500, textDecoration: "none" }}>WhatsApp</a></div>
        </div>
      </div>

      <footer style={{ borderTop: `1px solid ${c.cbd}`, padding: "14px 24px", display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0, position: "relative", zIndex: 10 }}>
        <span style={{ fontSize: 13, color: c.tm }}>© 2026 Nitro</span>
        <div style={{ display: "flex", gap: 16 }}><a href="/terms" style={{ fontSize: 13, color: c.tm, textDecoration: "none" }}>Terms</a><a href="/privacy" style={{ fontSize: 13, color: c.tm, textDecoration: "none" }}>Privacy</a></div>
      </footer>
    </div>
  );
}

export default function Maintenance() {
  return <ThemeProvider><MaintenanceInner /></ThemeProvider>;
}
