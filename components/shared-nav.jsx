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
    muted: dark ? "#8a8580" : "#757170",
    accent: "#c47d8e",
    grad: "linear-gradient(135deg,#c47d8e,#a3586b)",
    green: dark ? "#6ee7b7" : "#059669",
    red: dark ? "#fca5a5" : "#dc2626",
    // Surfaces
    surface: dark ? "rgba(255,255,255,.07)" : "rgba(255,255,255,.6)",
    surfaceBrd: dark ? "rgba(255,255,255,.12)" : "rgba(0,0,0,.1)",
    surfaceBorder: dark ? "rgba(255,255,255,.18)" : "rgba(0,0,0,.18)",
    // Sidebar
    sidebarBg: dark ? "rgba(14,17,34,.95)" : "rgba(240,237,232,.95)",
    // Inputs
    inputBg: dark ? "#131728" : "#fff",
    inputBorder: dark ? "rgba(255,255,255,.18)" : "rgba(0,0,0,.18)",
    // Buttons
    btnPrimary: "linear-gradient(135deg,#c47d8e,#a3586b)",
    overlay: dark ? "rgba(0,0,0,.6)" : "rgba(0,0,0,.3)",
    // Hero-specific
    heroBg: dark ? "#090c15" : "linear-gradient(135deg,#c47d8e 0%,#a3586b 50%,#8b4a5e 100%)",
    heroText: dark ? "#f5f3f0" : "#fff",
    heroSoft: dark ? "#a09b95" : "rgba(255,255,255,.85)",
    heroMuted: dark ? "#8a8580" : "rgba(255,255,255,.55)",
    heroGlass: dark ? "rgba(255,255,255,.07)" : "rgba(255,255,255,.16)",
    heroGlassBrd: dark ? "rgba(255,255,255,.09)" : "rgba(255,255,255,.2)",
    heroAccentBadge: dark ? "rgba(196,125,142,.12)" : "rgba(255,255,255,.15)",
    // Aliases
    textSoft: dark ? "#a09b95" : "#555250",
    textMuted: dark ? "#8a8580" : "#757170",
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
          <svg width="11" height="12" viewBox="0 0 1601 1785" fill="#fff"><path d="M1600.82 160.089V1313c-.85 53.13-10.35 104.17-27.19 151.74-48.19 136.54-156.38 244.73-292.92 292.92-50.12 17.76-103.94 27.34-160.08 27.34 0 0-79.39 0-160.01-27.34-85.1-28.88-155.38-85.49-208.28-141.55-72.59-76.84-112.13-179.09-112.13-284.74V1023.4v-3.08-12.9c.08-1.39.08-2.7.08-4.17 0-1.39 0-2.7-.08-4.09-2.08-84.64-69.97-153.06-154.53-155.84-1.85-.08-3.71-.15-5.48-.15-1.78 0-3.71.08-5.48.15-84.56 2.78-152.44 71.2-154.61 155.84-.08 1.39-.08 2.7-.08 4.09 0 1.47 0 2.78.08 4.17v534.87c0 88.42-71.67 160.09-160.09 160.09-44.17 0-84.25-17.92-113.21-46.88C17.92 1626.84 0 1586.76 0 1542.59V995.288c.927-53.132 10.426-104.178 27.261-151.672C75.45 707.003 183.643 598.81 320.179 550.621c50.119-17.685 103.946-27.338 160.089-27.338 0 0 79.388 0 160.012 27.338 85.103 28.882 155.379 85.489 208.278 141.555 72.593 76.84 112.132 179.087 112.132 284.732v307.972l-.077.92v12.89c-.077 1.39-.077 2.78-.077 4.17 0 1.39 0 2.7.077 4.17 2.085 84.64 69.967 152.99 154.527 155.84 1.86 0 3.71 0 5.49 0 1.77 0 3.7 0 5.48 0 84.56-2.85 152.44-71.2 154.6-155.84V160.089C1280.71 71.666 1352.38 0 1440.8 0c44.18 0 84.18 17.916 113.14 46.876 28.96 28.96 46.88 69.04 46.88 113.213z"/></svg>
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
  const { t, dark } = useTheme();
  const [sl, setSl] = useState({});
  useEffect(() => { fetch("/api/settings").then(r => r.ok ? r.json() : {}).then(d => setSl(d.settings || {})).catch(() => {}); }, []);

  const xHandle = (sl.social_twitter || "TheNitroNG").replace(/^(https?:\/\/)?(www\.)?(x\.com|twitter\.com)\/?/i, "").replace(/^@/, "").replace(/\/$/, "");
  const igHandle = (sl.social_instagram || "Nitro.ng").replace(/^(https?:\/\/)?(www\.)?(instagram\.com)\/?/i, "").replace(/^@/, "").replace(/\/$/, "");
  const waNum = sl.social_whatsapp_support ? sl.social_whatsapp_support.replace(/\D/g, "") : null;
  const tgHandle = sl.social_telegram_support ? sl.social_telegram_support.replace(/^(https?:\/\/)?(t\.me\/)?@?/, "") : null;

  const socialBtn = "w-9 h-9 rounded-[10px] flex items-center justify-center no-underline transition-all duration-200 hover:-translate-y-0.5 hover:shadow-sm";

  return (
    <footer className="relative px-6 pt-14 pb-20">
      {/* Accent gradient divider */}
      <div className="absolute top-0 left-0 right-0 h-px" style={{ background: `linear-gradient(90deg, transparent, ${t.accent}40, transparent)` }} />

      <div className="max-w-[900px] mx-auto">
        {/* Top: brand + socials + links */}
        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_auto] gap-10 md:gap-16 mb-10">

          {/* Brand column */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-[9px] flex items-center justify-center" style={{ background: t.grad }}>
                <svg width="11" height="12" viewBox="0 0 1601 1785" fill="#fff"><path d="M1600.82 160.089V1313c-.85 53.13-10.35 104.17-27.19 151.74-48.19 136.54-156.38 244.73-292.92 292.92-50.12 17.76-103.94 27.34-160.08 27.34 0 0-79.39 0-160.01-27.34-85.1-28.88-155.38-85.49-208.28-141.55-72.59-76.84-112.13-179.09-112.13-284.74V1023.4v-3.08-12.9c.08-1.39.08-2.7.08-4.17 0-1.39 0-2.7-.08-4.09-2.08-84.64-69.97-153.06-154.53-155.84-1.85-.08-3.71-.15-5.48-.15-1.78 0-3.71.08-5.48.15-84.56 2.78-152.44 71.2-154.61 155.84-.08 1.39-.08 2.7-.08 4.09 0 1.47 0 2.78.08 4.17v534.87c0 88.42-71.67 160.09-160.09 160.09-44.17 0-84.25-17.92-113.21-46.88C17.92 1626.84 0 1586.76 0 1542.59V995.288c.927-53.132 10.426-104.178 27.261-151.672C75.45 707.003 183.643 598.81 320.179 550.621c50.119-17.685 103.946-27.338 160.089-27.338 0 0 79.388 0 160.012 27.338 85.103 28.882 155.379 85.489 208.278 141.555 72.593 76.84 112.132 179.087 112.132 284.732v307.972l-.077.92v12.89c-.077 1.39-.077 2.78-.077 4.17 0 1.39 0 2.7.077 4.17 2.085 84.64 69.967 152.99 154.527 155.84 1.86 0 3.71 0 5.49 0 1.77 0 3.7 0 5.48 0 84.56-2.85 152.44-71.2 154.6-155.84V160.089C1280.71 71.666 1352.38 0 1440.8 0c44.18 0 84.18 17.916 113.14 46.876 28.96 28.96 46.88 69.04 46.88 113.213z"/></svg>
              </div>
              <span className="text-sm font-bold tracking-[2px] uppercase" style={{ color: t.text }}>NITRO</span>
            </div>
            <p className="text-[13px] leading-relaxed max-w-[260px]" style={{ color: t.muted }}>Your growth, simplified. Built for Nigerian creators and businesses.</p>
          </div>

          {/* Links column */}
          <div className="flex flex-col gap-2.5">
            <span className="text-[11px] font-semibold tracking-[1.5px] uppercase mb-1" style={{ color: t.accent }}>Company</span>
            {[["Blog", "/blog"], ["FAQ", "/faq"], ["Terms", "/terms"], ["Privacy", "/privacy"], ["Refund", "/refund"], ["Cookie", "/cookie"]].map(([l, h]) => (
              <a key={l} href={h} className="text-[13px] no-underline transition-colors duration-150 hover:opacity-80" style={{ color: t.text }}>{l}</a>
            ))}
          </div>

          {/* Social column */}
          <div className="flex flex-col gap-2.5">
            <span className="text-[11px] font-semibold tracking-[1.5px] uppercase mb-1" style={{ color: t.accent }}>Connect</span>
            <div className="flex items-center gap-2">
              <a href={`https://x.com/${xHandle}`} target="_blank" rel="noopener noreferrer" aria-label="X" className={socialBtn} style={{ background: dark ? "rgba(255,255,255,.12)" : "rgba(0,0,0,.06)", border: `1px solid ${dark ? "rgba(255,255,255,.18)" : "rgba(0,0,0,.12)"}`, color: dark ? "rgba(255,255,255,.7)" : "rgba(0,0,0,.55)" }}><svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg></a>
              <a href={`https://instagram.com/${igHandle}`} target="_blank" rel="noopener noreferrer" aria-label="Instagram" className={socialBtn} style={{ background: dark ? "rgba(225,48,108,.14)" : "rgba(225,48,108,.07)", border: `1px solid ${dark ? "rgba(225,48,108,.25)" : "rgba(225,48,108,.18)"}` }}><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#E1306C" strokeWidth="1.5" strokeLinecap="round"><rect x="2" y="2" width="20" height="20" rx="5"/><path d="M16 11.37A4 4 0 1112.63 8 4 4 0 0116 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/></svg></a>
              {waNum && <a href={`https://wa.me/${waNum}`} target="_blank" rel="noopener noreferrer" aria-label="WhatsApp" className={socialBtn} style={{ background: dark ? "rgba(37,211,102,.14)" : "rgba(37,211,102,.07)", border: `1px solid ${dark ? "rgba(37,211,102,.25)" : "rgba(37,211,102,.18)"}` }}><svg width="13" height="13" viewBox="0 0 24 24" fill="#25d366"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg></a>}
              {tgHandle && <a href={`https://t.me/${tgHandle}`} target="_blank" rel="noopener noreferrer" aria-label="Telegram" className={socialBtn} style={{ background: dark ? "rgba(0,136,204,.14)" : "rgba(0,136,204,.07)", border: `1px solid ${dark ? "rgba(0,136,204,.25)" : "rgba(0,136,204,.18)"}` }}><svg width="13" height="13" viewBox="0 0 24 24" fill="#0088cc"><path d="M11.944 0A12 12 0 000 12a12 12 0 0012 12 12 12 0 0012-12A12 12 0 0012 0a12 12 0 00-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 01.171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.479.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/></svg></a>}
            </div>
            <a href="mailto:support@nitro.ng" className="text-[13px] no-underline transition-colors duration-150" style={{ color: t.accent }}>support@nitro.ng</a>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="pt-6 flex justify-between items-center flex-wrap gap-3" style={{ borderTop: `1px solid ${dark ? "rgba(255,255,255,.12)" : "rgba(0,0,0,.1)"}` }}>
          <span className="text-[12px]" style={{ color: t.soft }}>© {new Date().getFullYear() > 2026 ? `2026–${new Date().getFullYear()}` : "2026"} The Nitro NG. All rights reserved. RC 9514845</span>
          <span className="text-[12px]" style={{ color: t.muted }}>Made in Nigeria 🇳🇬</span>
        </div>
      </div>
    </footer>
  );
}

// ── Shared Styles (legacy — resets now in globals.css @layer base) ──
export function SharedStyles() {
  return null;
}
