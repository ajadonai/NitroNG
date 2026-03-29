'use client';
import { ThemeProvider, useTheme } from "./shared-nav";

function NotFoundInner() {
  const { dark, toggleTheme, t } = useTheme();

  const c = { bg: t.bg, tx: t.text, ts: t.soft, tm: t.muted, ac: t.accent, cbd: t.surfaceBrd };

  return (
    <div style={{ minHeight: "100dvh", background: c.bg, fontFamily: "'Outfit',system-ui,sans-serif", display: "flex", flexDirection: "column", position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", width: 300, height: 300, borderRadius: "50%", top: "-10%", left: "-5%", background: dark ? "rgba(196,125,142,.06)" : "rgba(196,125,142,.04)", filter: "blur(80px)", pointerEvents: "none" }} />
      <div style={{ position: "absolute", width: 200, height: 200, borderRadius: "50%", bottom: "-5%", right: "-5%", background: dark ? "rgba(100,120,200,.04)" : "rgba(100,120,200,.03)", filter: "blur(60px)", pointerEvents: "none" }} />
      <nav style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 24px", height: 56, borderBottom: `1px solid ${c.cbd}`, background: dark ? "rgba(8,11,20,.8)" : "rgba(244,241,237,.8)", backdropFilter: "blur(20px)", position: "relative", zIndex: 10, flexShrink: 0 }}>
        <a href="/" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none" }}>
          <div style={{ width: 26, height: 26, borderRadius: 7, background: "linear-gradient(135deg,#c47d8e,#8b5e6b)", display: "flex", alignItems: "center", justifyContent: "center" }}><svg width="11" height="11" viewBox="0 0 20 20" fill="none"><path d="M4,16 L4,4 L16,16 L16,4" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/></svg></div>
          <span style={{ fontSize: 15, fontWeight: 700, color: c.tx, letterSpacing: 1.5 }}>NITRO</span>
        </a>
        <button onClick={toggleTheme} style={{ width: 44, height: 24, borderRadius: 12, background: dark ? "rgba(99,102,241,.25)" : "rgba(0,0,0,.06)", borderWidth: 1, borderStyle: "solid", borderColor: dark ? "rgba(99,102,241,.2)" : "rgba(0,0,0,.08)", position: "relative" }}>
          <div style={{ width: 18, height: 18, borderRadius: "50%", background: dark ? "#1e1b4b" : "#fff", position: "absolute", top: 2, left: dark ? 23 : 3, transition: "left .4s cubic-bezier(.4,0,.2,1)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: dark ? "0 0 6px rgba(99,102,241,.3)" : "0 1px 4px rgba(0,0,0,.15)" }}>
            {dark ? <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#a5b4fc" strokeWidth="2"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/></svg> : <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2"><circle cx="12" cy="12" r="5"/></svg>}
          </div>
        </button>
      </nav>
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", position: "relative", zIndex: 1 }}>
        <div style={{ textAlign: "center", padding: 24, maxWidth: 460 }}>
          <div className="m" style={{ fontSize: "clamp(100px, 20vw, 140px)", fontWeight: 700, color: c.ac, lineHeight: 1, marginBottom: 16, opacity: .15, letterSpacing: -4, fontFamily: "'JetBrains Mono',monospace" }}>404</div>
          <svg width="64" height="64" viewBox="0 0 64 64" fill="none" style={{ marginBottom: 24, opacity: .5 }}><circle cx="32" cy="32" r="24" stroke={c.ac} strokeWidth="1.5" opacity=".3"/><circle cx="32" cy="32" r="16" stroke={c.ac} strokeWidth="1.5" opacity=".2"/><line x1="32" y1="8" x2="32" y2="14" stroke={c.ac} strokeWidth="1.5" opacity=".3" strokeLinecap="round"/><line x1="32" y1="50" x2="32" y2="56" stroke={c.ac} strokeWidth="1.5" opacity=".3" strokeLinecap="round"/><line x1="8" y1="32" x2="14" y2="32" stroke={c.ac} strokeWidth="1.5" opacity=".3" strokeLinecap="round"/><line x1="50" y1="32" x2="56" y2="32" stroke={c.ac} strokeWidth="1.5" opacity=".3" strokeLinecap="round"/><path d="M32 22l4 10-10 4 4-10z" stroke={c.ac} strokeWidth="1.5" opacity=".4" strokeLinejoin="round"/><circle cx="32" cy="32" r="2" fill={c.ac} opacity=".4"/></svg>
          <h1 style={{ fontSize: "clamp(28px, 5vw, 38px)", fontWeight: 600, color: c.tx, marginBottom: 8, fontFamily: "'Cormorant Garamond',serif" }}>Lost in the void</h1>
          <p style={{ fontSize: 15, color: c.ts, lineHeight: 1.7, maxWidth: 360, margin: "0 auto 36px" }}>The page you're looking for doesn't exist or has been moved. Let's get you back on track.</p>
          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <a href="/" style={{ padding: "13px 32px", borderRadius: 10, background: "linear-gradient(135deg,#c47d8e,#8b5e6b)", color: "#fff", fontSize: 15, fontWeight: 600, textDecoration: "none", boxShadow: "0 4px 16px rgba(196,125,142,.25)" }}>Go Home</a>
            <a href="/dashboard" style={{ padding: "13px 32px", borderRadius: 10, background: dark ? "rgba(255,255,255,.06)" : "rgba(0,0,0,.04)", color: c.tx, fontSize: 15, fontWeight: 600, textDecoration: "none", borderWidth: 1, borderStyle: "solid", borderColor: c.cbd }}>Dashboard</a>
          </div>
          <div style={{ marginTop: 32, fontSize: 14, color: c.tm }}>Think this is an error? <a href="/dashboard" style={{ color: c.ac, fontWeight: 500, textDecoration: "none" }}>Contact support</a></div>
        </div>
      </div>
      <footer style={{ borderTop: `1px solid ${c.cbd}`, padding: "14px 24px", display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0, position: "relative", zIndex: 10 }}>
        <span style={{ fontSize: 13, color: c.tm }}>© 2026 Nitro</span>
        <div style={{ display: "flex", gap: 16 }}><a href="/terms" style={{ fontSize: 13, color: c.tm, textDecoration: "none" }}>Terms</a><a href="/privacy" style={{ fontSize: 13, color: c.tm, textDecoration: "none" }}>Privacy</a></div>
      </footer>
    </div>
  );
}

export default function NotFound() {
  return <ThemeProvider><NotFoundInner /></ThemeProvider>;
}
