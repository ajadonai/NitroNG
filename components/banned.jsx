'use client';
import { useState, useEffect } from "react";

export default function BannedPage() {
  const getAuto = () => { const h = new Date().getHours(); return h >= 19 || h < 7; };
  const [dark, setDark] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    try { const s = localStorage.getItem("nitro-theme") || "auto"; if (s === "night") setDark(true); else if (s === "day") setDark(false); else setDark(getAuto()); } catch {}
    setTimeout(() => setMounted(true), 50);
  }, []);

  const t = {
    bg: dark ? "#080b14" : "#f4f1ed",
    tx: dark ? "#f5f3f0" : "#1a1917",
    ts: dark ? "#a09b95" : "#555250",
    tm: dark ? "#706c68" : "#757170",
    ac: "#c47d8e",
    cbd: dark ? "rgba(255,255,255,.06)" : "rgba(0,0,0,.06)",
    red: dark ? "#fca5a5" : "#dc2626",
    redSoft: dark ? "rgba(252,165,165,.08)" : "rgba(220,38,38,.03)",
    redBorder: dark ? "rgba(252,165,165,.12)" : "rgba(220,38,38,.08)",
  };

  return (
    <div style={{ minHeight: "100dvh", background: t.bg, fontFamily: "'Outfit',system-ui,sans-serif", display: "flex", flexDirection: "column", position: "relative", overflow: "hidden" }}>

      {/* Ambient glow */}
      <div style={{ position: "absolute", width: 400, height: 400, borderRadius: "50%", top: "10%", right: "-5%", background: dark ? "rgba(220,38,38,.03)" : "rgba(220,38,38,.015)", filter: "blur(100px)", pointerEvents: "none" }} />
      <div style={{ position: "absolute", width: 300, height: 300, borderRadius: "50%", bottom: "5%", left: "-5%", background: dark ? "rgba(196,125,142,.03)" : "rgba(196,125,142,.015)", filter: "blur(80px)", pointerEvents: "none" }} />

      {/* Nav */}
      <nav style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "0 24px", height: 56, borderBottom: `1px solid ${t.cbd}`, background: dark ? "rgba(8,11,20,.8)" : "rgba(244,241,237,.8)", backdropFilter: "blur(20px)", position: "relative", zIndex: 10, flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 26, height: 26, borderRadius: 7, background: "linear-gradient(135deg,#c47d8e,#8b5e6b)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="11" height="11" viewBox="0 0 20 20" fill="none"><path d="M4,16 L4,4 L16,16 L16,4" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </div>
          <span style={{ fontSize: 16, fontWeight: 600, color: t.tx, letterSpacing: 1.5 }}>NITRO</span>
        </div>
      </nav>

      {/* Main */}
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", position: "relative", zIndex: 1 }}>
        <div style={{ textAlign: "center", padding: 24, maxWidth: 480, opacity: mounted ? 1 : 0, transform: mounted ? "translateY(0)" : "translateY(12px)", transition: "opacity .5s ease, transform .5s ease" }}>

          {/* Icon — lock with pulse ring */}
          <div style={{ position: "relative", width: 88, height: 88, margin: "0 auto 28px" }}>
            <div style={{ position: "absolute", inset: 0, borderRadius: "50%", border: `2px solid ${t.redBorder}`, animation: "banned-pulse 2.5s ease-in-out infinite" }} />
            <div style={{ width: 88, height: 88, borderRadius: "50%", background: t.redSoft, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke={t.red} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                <path d="M7 11V7a5 5 0 0110 0v4"/>
                <circle cx="12" cy="16" r="1"/>
              </svg>
            </div>
          </div>

          <h1 style={{ fontSize: "clamp(28px, 5vw, 38px)", fontWeight: 700, color: t.tx, marginBottom: 10, fontFamily: "'Cormorant Garamond',serif", lineHeight: 1.1 }}>
            Account Suspended
          </h1>
          <p style={{ fontSize: 16, color: t.ts, lineHeight: 1.7, maxWidth: 380, margin: "0 auto 32px" }}>
            Your account has been suspended for violating our Terms of Service. If you believe this was a mistake, reach out to our support team.
          </p>

          {/* Info card */}
          <div style={{ borderRadius: 16, padding: "20px 24px", textAlign: "left", background: t.redSoft, border: `1px solid ${t.redBorder}`, maxWidth: 380, margin: "0 auto 32px" }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: t.red, marginBottom: 14, textTransform: "uppercase", letterSpacing: 1.5 }}>What this means</div>
            {[
              ["Dashboard and services are inaccessible", <svg key="1" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={t.red} strokeWidth="1.5" strokeLinecap="round"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="9" y1="9" x2="15" y2="15"/><line x1="15" y1="9" x2="9" y2="15"/></svg>],
              ["Your wallet balance is frozen", <svg key="2" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={t.red} strokeWidth="1.5" strokeLinecap="round"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>],
              ["Active orders will still complete delivery", <svg key="3" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={dark ? "#6ee7b7" : "#059669"} strokeWidth="1.5" strokeLinecap="round"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>],
            ].map(([text, icon], i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 0", borderTop: i > 0 ? `1px solid ${dark ? "rgba(252,165,165,.06)" : "rgba(220,38,38,.04)"}` : "none" }}>
                <div style={{ flexShrink: 0, width: 28, height: 28, borderRadius: 8, background: dark ? "rgba(255,255,255,.03)" : "rgba(0,0,0,.02)", display: "flex", alignItems: "center", justifyContent: "center" }}>{icon}</div>
                <span style={{ fontSize: 14, color: t.ts, lineHeight: 1.4 }}>{text}</span>
              </div>
            ))}
          </div>

          {/* Actions */}
          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <a href="mailto:TheNitroNG@gmail.com" style={{ padding: "14px 32px", borderRadius: 12, fontSize: 15, fontWeight: 600, textDecoration: "none", background: "linear-gradient(135deg,#c47d8e,#8b5e6b)", color: "#fff", boxShadow: "0 4px 20px rgba(196,125,142,.3)", display: "flex", alignItems: "center", gap: 8 }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="2" y="4" width="20" height="16" rx="2"/><polyline points="22,6 12,13 2,6"/></svg>
              Contact Support
            </a>
            <a href="/" style={{ padding: "14px 32px", borderRadius: 12, fontSize: 15, fontWeight: 600, textDecoration: "none", background: dark ? "rgba(255,255,255,.05)" : "rgba(0,0,0,.03)", color: t.ts, border: `1px solid ${t.cbd}` }}>
              Back to Home
            </a>
          </div>

          <p style={{ fontSize: 13, color: t.tm, marginTop: 24, lineHeight: 1.5 }}>
            Think this is an error? Email us at <a href="mailto:TheNitroNG@gmail.com" style={{ color: t.ac, textDecoration: "none" }}>TheNitroNG@gmail.com</a> with your account email and we'll review it within 24 hours.
          </p>
        </div>
      </div>

      {/* Footer */}
      <footer style={{ borderTop: `1px solid ${t.cbd}`, padding: "14px 24px", display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0, position: "relative", zIndex: 10 }}>
        <span style={{ fontSize: 14, color: t.tm }}>© {new Date().getFullYear() > 2026 ? `2026–${new Date().getFullYear()}` : "2026"} Nitro</span>
        <div style={{ display: "flex", gap: 16 }}>
          <a href="/terms" style={{ fontSize: 14, color: t.tm, textDecoration: "none" }}>Terms</a>
          <a href="/privacy" style={{ fontSize: 14, color: t.tm, textDecoration: "none" }}>Privacy</a>
        </div>
      </footer>

      <style>{`
        @keyframes banned-pulse {
          0%, 100% { transform: scale(1); opacity: .6; }
          50% { transform: scale(1.15); opacity: 0; }
        }
      `}</style>
    </div>
  );
}
