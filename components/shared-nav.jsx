'use client';
import { useState, useEffect, useCallback, createContext, useContext } from "react";

// ── Theme context ──
const ThemeCtx = createContext();

export function useTheme() {
  return useContext(ThemeCtx);
}

export function ThemeProvider({ children }) {
  const getAuto = () => { const h = new Date().getHours(); return h >= 7 && h < 18 ? false : true; };
  const [dark, setDark] = useState(getAuto);
  const [manual, setManual] = useState(false);
  const [loaded, setLoaded] = useState(false);

  // Load saved preference on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem("nitro-theme");
      if (saved === "dark") { setDark(true); setManual(true); }
      else if (saved === "light") { setDark(false); setManual(true); }
    } catch {}
    setLoaded(true);
  }, []);

  // Auto-update if not manual
  useEffect(() => {
    if (manual) return;
    const iv = setInterval(() => setDark(getAuto()), 60000);
    return () => clearInterval(iv);
  }, [manual]);

  const toggleTheme = useCallback(() => {
    setManual(true);
    setDark(d => {
      const next = !d;
      try { localStorage.setItem("nitro-theme", next ? "dark" : "light"); } catch {}
      return next;
    });
  }, []);

  const t = {
    bg: dark ? "#090c15" : "#f0ede8",
    text: dark ? "#eae7e2" : "#1c1b19",
    soft: dark ? "#a8a4a0" : "#5c5955",
    muted: dark ? "#6d6965" : "#a09c97",
    accent: "#c47d8e",
    grad: "linear-gradient(135deg,#c47d8e,#a3586b)",
    green: dark ? "#6ee7b7" : "#059669",
    red: dark ? "#fca5a5" : "#dc2626",
    surface: dark ? "rgba(15,19,35,.55)" : "rgba(255,255,255,.5)",
    surfaceBrd: dark ? "rgba(255,255,255,.07)" : "rgba(0,0,0,.05)",
    inputBg: dark ? "#0d1020" : "#fff",
    inputBorder: dark ? "rgba(255,255,255,.08)" : "rgba(0,0,0,.1)",
    btnPrimary: "linear-gradient(135deg,#c47d8e,#a3586b)",
    overlay: dark ? "rgba(0,0,0,.6)" : "rgba(0,0,0,.3)",
    accentLight: dark ? "rgba(196,125,142,.12)" : "rgba(196,125,142,.08)",
    // Hero-specific
    heroBg: dark ? "#090c15" : "linear-gradient(135deg,#c47d8e 0%,#a3586b 50%,#8b4a5e 100%)",
    heroText: dark ? "#eae7e2" : "#fff",
    heroSoft: dark ? "#a8a4a0" : "rgba(255,255,255,.85)",
    heroMuted: dark ? "#6d6965" : "rgba(255,255,255,.55)",
    heroGlass: dark ? "rgba(255,255,255,.04)" : "rgba(255,255,255,.12)",
    heroGlassBrd: dark ? "rgba(255,255,255,.06)" : "rgba(255,255,255,.2)",
    heroAccentBadge: dark ? "rgba(196,125,142,.08)" : "rgba(255,255,255,.15)",
    textSoft: dark ? "#a8a4a0" : "#5c5955",
    textMuted: dark ? "#6d6965" : "#a09c97",
    surfaceBorder: dark ? "rgba(255,255,255,.07)" : "rgba(0,0,0,.05)",
  };

  return <ThemeCtx.Provider value={{ dark, toggleTheme, t, loaded }}>{children}</ThemeCtx.Provider>;
}

// ── Shared Nav ──
// action prop: "back" | "login" | "logout" | null
export default function SharedNav({ action = "back" }) {
  const { dark, toggleTheme, t } = useTheme();

  const handleLogout = async () => {
    try { await fetch("/api/auth/logout", { method: "POST" }); } catch {}
    window.location.href = "/";
  };

  return (
    <nav style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 24px", height: 56, background: dark ? "rgba(9,12,21,.9)" : "rgba(240,237,232,.9)", backdropFilter: "blur(16px)", borderBottom: `1px solid ${t.surfaceBrd}`, flexShrink: 0, position: "sticky", top: 0, zIndex: 50 }}>
      <a href="/" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none" }}>
        <div style={{ width: 28, height: 28, borderRadius: 7, background: t.grad, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <svg width="12" height="12" viewBox="0 0 20 20" fill="none"><path d="M4,16 L4,4 L16,16 L16,4" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </div>
        <span style={{ fontSize: 16, fontWeight: 700, color: t.text, letterSpacing: 1.5 }}>NITRO</span>
      </a>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <button onClick={toggleTheme} style={{ width: 44, height: 24, borderRadius: 12, background: dark ? "#c47d8e" : "rgba(0,0,0,0.08)", position: "relative", transition: "all .3s", flexShrink: 0, border: "none", cursor: "pointer" }}>
          <div style={{ width: 18, height: 18, borderRadius: "50%", background: "#fff", position: "absolute", top: 3, left: dark ? 23 : 3, transition: "left .3s cubic-bezier(.2,.8,.2,1)", boxShadow: "0 1px 4px rgba(0,0,0,.2)" }} />
        </button>
        {action === "back" && (
          <a href="/" style={{ fontSize: 13, fontWeight: 550, color: t.soft, display: "flex", alignItems: "center", gap: 4, textDecoration: "none" }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={t.muted} strokeWidth="2" strokeLinecap="round"><polyline points="15 18 9 12 15 6" /></svg>
            Back
          </a>
        )}
        {action === "login" && (
          <a href="/?login=1" style={{ fontSize: 13, fontWeight: 550, color: t.soft, display: "flex", alignItems: "center", gap: 4, textDecoration: "none" }}>
            Log In
          </a>
        )}
        {action === "logout" && (
          <button onClick={handleLogout} style={{ fontSize: 13, fontWeight: 550, color: t.soft, display: "flex", alignItems: "center", gap: 4, background: "none", cursor: "pointer" }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={t.muted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
            Log Out
          </button>
        )}
      </div>
    </nav>
  );
}

// ── Shared Footer ──
export function SharedFooter() {
  const { t } = useTheme();
  return (
    <footer style={{ borderTop: `1px solid ${t.surfaceBrd}`, padding: "20px 24px 80px" }}>
      <div style={{ maxWidth: 780, margin: "0 auto", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
        <span style={{ fontSize: 12, color: t.muted }}>© 2026 Nitro. All rights reserved.</span>
        <div style={{ display: "flex", gap: 16 }}>
          {[["Terms", "/terms"], ["Privacy", "/privacy"], ["Refund", "/refund"], ["Cookie", "/cookie"]].map(([l, h]) => (
            <a key={l} href={h} style={{ fontSize: 11, color: t.muted, textDecoration: "none" }}>{l}</a>
          ))}
        </div>
      </div>
    </footer>
  );
}

// ── Shared Fonts Style ──
export function SharedStyles() {
  return (
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;450;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;600;700&family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;1,300;1,400&display=swap');
      *{box-sizing:border-box;margin:0;padding:0}
      button,a{cursor:pointer;font-family:inherit;border:none;text-decoration:none}
      .serif{font-family:'Cormorant Garamond',serif}
      .m{font-family:'JetBrains Mono',monospace}
    `}</style>
  );
}
