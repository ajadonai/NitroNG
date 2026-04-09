'use client';
import { useState, useEffect } from "react";

export default function BannedPage() {
  const getAuto = () => { const h = new Date().getHours(); return h >= 19 || h < 7; };
  const [dark, setDark] = useState(false);

  useEffect(() => {
    try { const s = localStorage.getItem("nitro-theme") || "auto"; if (s === "night") setDark(true); else if (s === "day") setDark(false); else setDark(getAuto()); } catch {}
  }, []);

  const t = { bg: dark ? "#080b14" : "#f4f1ed", tx: dark ? "#f5f3f0" : "#1a1917", ts: dark ? "#a09b95" : "#555250", tm: dark ? "#706c68" : "#757170", ac: "#c47d8e", cbd: dark ? "rgba(255,255,255,.06)" : "rgba(0,0,0,.06)", red: dark ? "#fca5a5" : "#dc2626" };

  return (
    <div style={{ minHeight: "100dvh", background: t.bg, fontFamily: "'Outfit',system-ui,sans-serif", display: "flex", flexDirection: "column", position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", width: 250, height: 250, borderRadius: "50%", top: "15%", right: "10%", background: dark ? "rgba(220,38,38,.04)" : "rgba(220,38,38,.02)", filter: "blur(80px)", pointerEvents: "none" }} />

      <nav style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "0 24px", height: 56, borderBottom: `1px solid ${t.cbd}`, background: dark ? "rgba(8,11,20,.8)" : "rgba(244,241,237,.8)", backdropFilter: "blur(20px)", position: "relative", zIndex: 10, flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 26, height: 26, borderRadius: 7, background: "linear-gradient(135deg,#c47d8e,#8b5e6b)", display: "flex", alignItems: "center", justifyContent: "center" }}><svg width="11" height="11" viewBox="0 0 20 20" fill="none"><path d="M4,16 L4,4 L16,16 L16,4" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/></svg></div>
          <span style={{ fontSize: 16, fontWeight: 600, color: t.tx, letterSpacing: 1.5 }}>NITRO</span>
        </div>
      </nav>

      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", position: "relative", zIndex: 1 }}>
        <div style={{ textAlign: "center", padding: 24, maxWidth: 460 }}>
          <svg width="72" height="72" viewBox="0 0 80 80" fill="none" style={{ marginBottom: 24, opacity: .5 }}>
            <path d="M40 8L12 20v20c0 16.5 12 31.2 28 36 16-4.8 28-19.5 28-36V20L40 8z" stroke={t.red} strokeWidth="2" opacity=".3" />
            <path d="M40 14L18 24v16c0 13.5 9.5 25.5 22 30 12.5-4.5 22-16.5 22-30V24L40 14z" stroke={t.red} strokeWidth="1.5" opacity=".15" />
            <line x1="30" y1="30" x2="50" y2="50" stroke={t.red} strokeWidth="3" strokeLinecap="round" opacity=".5" />
            <line x1="50" y1="30" x2="30" y2="50" stroke={t.red} strokeWidth="3" strokeLinecap="round" opacity=".5" />
          </svg>

          <h1 style={{ fontSize: "clamp(26px, 5vw, 34px)", fontWeight: 600, color: t.tx, marginBottom: 8, fontFamily: "'Cormorant Garamond',serif" }}>Account Suspended</h1>
          <p style={{ fontSize: 16, color: t.ts, lineHeight: 1.7, maxWidth: 360, margin: "0 auto 28px" }}>Your account has been suspended for violating our Terms of Service. If you believe this is a mistake, please contact our support team.</p>

          <div style={{ borderRadius: 14, padding: "16px 20px", textAlign: "left", marginBottom: 28, background: dark ? "rgba(252,165,165,.04)" : "rgba(220,38,38,.02)", borderWidth: 1, borderStyle: "solid", borderColor: dark ? "rgba(252,165,165,.1)" : "rgba(220,38,38,.06)", maxWidth: 360, margin: "0 auto 28px" }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: t.red, marginBottom: 8, textTransform: "uppercase", letterSpacing: 1 }}>What this means</div>
            <div style={{ fontSize: 15, color: t.ts, lineHeight: 1.7 }}>
              • You cannot access your dashboard or place orders<br/>
              • Your wallet balance is frozen<br/>
              • Active orders will still be delivered
            </div>
          </div>

          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <a href="mailto:info@nitro.ng" style={{ padding: "13px 28px", borderRadius: 10, fontSize: 16, fontWeight: 600, textDecoration: "none", background: "linear-gradient(135deg,#c47d8e,#8b5e6b)", color: "#fff", boxShadow: "0 4px 16px rgba(196,125,142,.25)" }}>Contact Support</a>
            <a href="/" style={{ padding: "13px 28px", borderRadius: 10, fontSize: 16, fontWeight: 600, textDecoration: "none", background: dark ? "rgba(255,255,255,.06)" : "rgba(0,0,0,.04)", color: t.tx, borderWidth: 1, borderStyle: "solid", borderColor: t.cbd }}>Go Home</a>
          </div>
        </div>
      </div>

      <footer style={{ borderTop: `1px solid ${t.cbd}`, padding: "14px 24px", display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0, position: "relative", zIndex: 10 }}>
        <span style={{ fontSize: 14, color: t.tm }}>© {new Date().getFullYear() > 2026 ? `2026–${new Date().getFullYear()}` : "2026"} Nitro</span>
        <div style={{ display: "flex", gap: 16 }}><a href="/terms" style={{ fontSize: 14, color: t.tm, textDecoration: "none" }}>Terms</a><a href="/privacy" style={{ fontSize: 14, color: t.tm, textDecoration: "none" }}>Privacy</a></div>
      </footer>
    </div>
  );
}
