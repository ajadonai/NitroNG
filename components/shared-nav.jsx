'use client';
import { useState, useEffect, useCallback, useMemo, createContext, useContext } from "react";

// ── Theme context ──
const ThemeCtx = createContext();

export function useTheme() {
  return useContext(ThemeCtx);
}

const getAuto = () => { const h = new Date().getHours(), m = new Date().getMinutes(); if (h >= 19 || h < 6) return true; if (h === 6 && m < 30) return true; if (h === 18 && m >= 30) return true; return false; };

export function ThemeProvider({ children, storageKey = "nitro-theme" }) {
  const [dark, setDark] = useState(false);
  const [themeMode, setThemeMode] = useState("auto"); // "auto" | "night" | "day"
  const [loaded, setLoaded] = useState(false);

  // Load saved preference on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved === "night") { setDark(true); setThemeMode("night"); }
      else if (saved === "day") { setDark(false); setThemeMode("day"); }
      else { setDark(getAuto()); setThemeMode("auto"); }
    } catch { setDark(getAuto()); }
    setLoaded(true);
  }, [storageKey]);

  // Sync dark class on <html> for Tailwind dark: variants
  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
  }, [dark]);

  // Auto-update if in auto mode
  useEffect(() => {
    if (themeMode !== "auto") return;
    const iv = setInterval(() => setDark(getAuto()), 60000);
    return () => clearInterval(iv);
  }, [themeMode]);

  const toggleTheme = useCallback(() => {
    const goingDark = !dark;
    const apply = () => {
      setDark(d => {
        const next = !d;
        const mode = next ? "night" : "day";
        setThemeMode(mode);
        try { localStorage.setItem(storageKey, mode); } catch {}
        return next;
      });
    };

    if (!document.startViewTransition) { apply(); return; }

    const wash = document.createElement("div");
    wash.style.cssText = `position:fixed;inset:0;z-index:99999;pointer-events:none;opacity:0;background:${goingDark ? "radial-gradient(ellipse at 50% 30%,rgba(30,27,75,.45),rgba(9,12,21,.3))" : "radial-gradient(ellipse at 50% 30%,rgba(251,191,36,.18),rgba(245,158,11,.08))"};transition:opacity 400ms ease;`;
    document.body.appendChild(wash);
    requestAnimationFrame(() => { wash.style.opacity = "1"; });

    setTimeout(() => {
      const transition = document.startViewTransition(apply);
      transition.ready.then(() => {
        document.documentElement.animate(
          { opacity: [0, 1] },
          { duration: 700, easing: "ease-in-out", pseudoElement: "::view-transition-new(root)" }
        );
      }).catch(() => {});

      setTimeout(() => {
        wash.style.opacity = "0";
        setTimeout(() => wash.remove(), 450);
      }, 350);
    }, 250);
  }, [storageKey, dark]);

  const t = useMemo(() => ({
    // Core
    bg: dark ? "#090c15" : "#f0ede8",
    text: dark ? "#f5f3f0" : "#1c1b19",
    soft: dark ? "#a09b95" : "#555250",
    muted: dark ? "#706c68" : "#757170",
    accent: "#c47d8e",
    grad: "linear-gradient(135deg,#c47d8e,#a3586b)",
    green: dark ? "#6ee7b7" : "#059669",
    red: dark ? "#fca5a5" : "#dc2626",
    // Surfaces
    surface: dark ? "rgba(15,19,35,.55)" : "rgba(255,255,255,.5)",
    surfaceBrd: dark ? "rgba(255,255,255,.08)" : "rgba(0,0,0,.1)",
    surfaceBorder: dark ? "rgba(255,255,255,.14)" : "rgba(0,0,0,.18)",
    // Sidebar
    sidebarBg: dark ? "rgba(9,12,21,.95)" : "rgba(240,237,232,.95)",
    // Inputs
    inputBg: dark ? "#0d1020" : "#fff",
    inputBorder: dark ? "rgba(255,255,255,.14)" : "rgba(0,0,0,.18)",
    // Buttons
    btnPrimary: "linear-gradient(135deg,#c47d8e,#a3586b)",
    overlay: dark ? "rgba(0,0,0,.6)" : "rgba(0,0,0,.3)",
    // Hero-specific
    heroBg: dark ? "#090c15" : "linear-gradient(135deg,#c47d8e 0%,#a3586b 50%,#8b4a5e 100%)",
    heroText: dark ? "#f5f3f0" : "#fff",
    heroSoft: dark ? "#a09b95" : "rgba(255,255,255,.85)",
    heroMuted: dark ? "#706c68" : "rgba(255,255,255,.55)",
    heroGlass: dark ? "rgba(255,255,255,.04)" : "rgba(255,255,255,.12)",
    heroGlassBrd: dark ? "rgba(255,255,255,.06)" : "rgba(255,255,255,.2)",
    heroAccentBadge: dark ? "rgba(196,125,142,.08)" : "rgba(255,255,255,.15)",
    // Aliases
    textSoft: dark ? "#a09b95" : "#555250",
    textMuted: dark ? "#706c68" : "#757170",
    accentLight: dark ? "rgba(196,125,142,.12)" : "rgba(196,125,142,.08)",
  }), [dark]);

  return <ThemeCtx.Provider value={{ dark, setDark, toggleTheme, t, loaded, themeMode, setThemeMode }}>{children}</ThemeCtx.Provider>;
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
    <nav
      className="flex items-center justify-between px-6 h-14 backdrop-blur-[16px] shrink-0 sticky top-0 z-50"
      style={{ background: dark ? "rgba(9,12,21,.9)" : "rgba(240,237,232,.9)", borderBottom: `1px solid ${t.surfaceBrd}` }}
    >
      <a href="/" className="flex items-center gap-2.5">
        <div className="w-7 h-7 rounded-[7px] flex items-center justify-center" style={{ background: t.grad }}>
          <svg width="12" height="12" viewBox="0 0 20 20" fill="none"><path d="M4,16 L4,4 L16,16 L16,4" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </div>
        <span className="text-base font-semibold tracking-[1.5px]" style={{ color: t.text }}>NITRO</span>
      </a>
      <div className="flex items-center gap-3">
        <button
          onClick={toggleTheme}
          className="w-11 h-6 rounded-xl relative transition-all duration-300 shrink-0"
          style={{ background: dark ? "#c47d8e" : "rgba(0,0,0,0.08)" }}
        >
          <div
            className="w-[18px] h-[18px] rounded-full bg-white absolute top-[3px] shadow-[0_1px_4px_rgba(0,0,0,.2)]"
            style={{ left: dark ? 23 : 3, transition: "left .3s cubic-bezier(.2,.8,.2,1)" }}
          />
        </button>
        {action === "back" && (
          <a href="/" className="text-sm font-medium flex items-center gap-1" style={{ color: t.soft }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={t.muted} strokeWidth="2" strokeLinecap="round"><polyline points="15 18 9 12 15 6" /></svg>
            Back
          </a>
        )}
        {action === "login" && (
          <a href="/?login=1" className="text-sm font-medium flex items-center gap-1" style={{ color: t.soft }}>
            Log In
          </a>
        )}
        {action === "logout" && (
          <button onClick={handleLogout} className="text-sm font-medium flex items-center gap-1 bg-transparent" style={{ color: t.soft }}>
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
    <footer className="pt-5 px-6 pb-20" style={{ borderTop: `1px solid ${t.surfaceBrd}` }}>
      <div className="max-w-[780px] mx-auto flex justify-between items-center flex-wrap gap-3">
        <span className="text-[13px]" style={{ color: t.muted }}>© {new Date().getFullYear() > 2026 ? `2026–${new Date().getFullYear()}` : "2026"} Nitro. All rights reserved.</span>
        <div className="flex gap-4">
          {[["Terms", "/terms"], ["Privacy", "/privacy"], ["Refund", "/refund"], ["Cookie", "/cookie"]].map(([l, h]) => (
            <a key={l} href={h} className="text-xs" style={{ color: t.muted }}>{l}</a>
          ))}
        </div>
      </div>
    </footer>
  );
}

// ── Shared Styles (legacy — resets now in globals.css @layer base) ──
export function SharedStyles() {
  return null;
}
