'use client';
import { useState, useEffect, useCallback, useMemo, createContext, useContext } from "react";
import { useDataSaver } from "./use-data-saver";
import { NitroWordmark } from "./nitro-logo";
import { PublicNavSheet, PUBLIC_LINKS } from "./public-nav-sheet";
import { SWITCHER_LIVE, useT } from "./locale";
import { CurrencySwitcher, LanguageSwitcher } from "./locale-switcher";
import { usePathname } from "next/navigation";
import { WaButton } from "./wa-button";

// ── Theme context ──
const ThemeCtx = createContext();

/** The theme switch, the same everywhere: a tiny sky. Sun and clouds by day;
    the knob slides across, the sun rotates away and a cratered moon rises
    under twinkling stars. Styled by .nitro-sky in globals.css. */
export function ThemeToggle({ dark, onToggle, size = "md", className = "" }) {
  const tr = useT();
  return (
    <button type="button" onClick={onToggle} role="switch" aria-checked={dark} aria-label={dark ? tr("Switch to light mode") : tr("Switch to dark mode")}
      className={`nitro-sky${dark ? " night" : ""}${size === "lg" ? " lg" : ""} ${className}`}>
      <span className="sky-d" aria-hidden="true" /><span className="sky-n" aria-hidden="true" />
      <span className="cl c1" aria-hidden="true" /><span className="cl c2" aria-hidden="true" />
      <span className="st s1" aria-hidden="true" /><span className="st s2" aria-hidden="true" /><span className="st s3" aria-hidden="true" /><span className="st s4" aria-hidden="true" />
      <span className="knob" aria-hidden="true">
        <span className="sun" />
        <span className="moon"><i className="m1" /><i className="m2" /><i className="m3" /></span>
      </span>
    </button>
  );
}

/**
 * The three-mode theme control — the same sky as ThemeToggle, with a third
 * stop.
 *
 * It used to be three grey glyphs on a plain capsule, sitting six pixels from a
 * working sky in the same menu. Now it is that sky: the gradient runs day on
 * the left to night on the right, clouds sit over the day end and stars over
 * the night end, and the knob is the sun or the moon depending on where it has
 * stopped.
 *
 * Day, Auto, Night — in that order, because it is the order the sky is painted
 * in. Auto lands in the middle, which is exactly where the gradient turns, and
 * its knob is drawn half sun and half moon: the horizon, which is what auto
 * means and what no icon ever managed to say.
 *
 * Styled by .theme-sky in globals.css. `mode` is themeMode; `onMode(id)`
 * applies it.
 */
const TP_LABEL = { day: "Light", auto: "Auto", night: "Dark" };
export function ThemePill({ mode = "auto", onMode, className = "" }) {
  const tr = useT();
  return (
    <div role="group" aria-label={tr("Theme")} className={`theme-sky ${className}`} data-m={mode}>
      <span className="ts-d" aria-hidden="true" /><span className="ts-n" aria-hidden="true" />
      <span className="cl c1" aria-hidden="true" /><span className="cl c2" aria-hidden="true" />
      <span className="st s1" aria-hidden="true" /><span className="st s2" aria-hidden="true" /><span className="st s3" aria-hidden="true" />
      <span className="knob" aria-hidden="true"><span className="sun" /><span className="moon" /></span>
      {["day", "auto", "night"].map(id => (
        <button key={id} type="button" onClick={() => onMode?.(id)} aria-pressed={mode === id}
          aria-label={tr(TP_LABEL[id])} title={tr(TP_LABEL[id])} className={`ts-seg ts-${id}`} />
      ))}
    </div>
  );
}

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
    const apply = () => {
      setDark(d => {
        const next = !d;
        const mode = next ? "night" : "day";
        setThemeMode(mode);
        try { localStorage.setItem(storageKey, mode); } catch {}
        return next;
      });
    };

    // A single view-transition crossfade of the whole page: it fires on the
    // click (no staged delay) and finishes fast, so day and night dissolve into
    // one another instead of stepping. Timing lives in .nitro-vt in globals.css.
    const reduce = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (!document.startViewTransition || reduce) { apply(); return; }
    // A skipped or interrupted transition rejects these promises. Nothing is
    // broken when that happens (the theme still applied), but an unhandled
    // rejection would reach Sentry, so both are swallowed deliberately.
    const transition = document.startViewTransition(apply);
    transition.ready?.catch(() => {});
    transition.finished?.catch(() => {});
    transition.updateCallbackDone?.catch(() => {});
  }, [storageKey]);

  const t = useMemo(() => ({
    bg: "var(--t-bg)",
    text: "var(--t-text)",
    soft: "var(--t-soft)",
    muted: "var(--t-muted)",
    accent: "var(--t-accent)",
    // The accent when it has to be READ — prices, links, counters. The fill
    // pink sits at 2.5:1 on cream, below the 4.5 floor for text; this is the
    // rose-700 that clears it. In dark mode the two coincide.
    accentInk: "var(--t-accent-ink)",
    grad: "var(--t-grad)",
    green: "var(--t-green)",
    red: "var(--t-red)",
    surface: "var(--t-surface)",
    surfaceBrd: "var(--t-surface-brd)",
    surfaceBorder: "var(--t-surface-border)",
    sidebarBg: "var(--t-sidebar-bg)",
    inputBg: "var(--t-input-bg)",
    inputBorder: "var(--t-input-border)",
    btnPrimary: "var(--t-btn-primary)",
    overlay: "var(--t-overlay)",
    heroBg: "var(--t-hero-bg)",
    heroText: "var(--t-hero-text)",
    heroSoft: "var(--t-hero-soft)",
    heroMuted: "var(--t-hero-muted)",
    heroGlass: "var(--t-hero-glass)",
    heroGlassBrd: "var(--t-hero-glass-brd)",
    heroAccentBadge: "var(--t-hero-accent-badge)",
    textSoft: "var(--t-text-soft)",
    textMuted: "var(--t-text-muted)",
    accentLight: "var(--t-accent-light)",
    cardBg: "var(--t-card-bg)",
    cardBorder: "var(--t-card-border)",
    navActive: "var(--t-nav-active)",
    sidebarBorder: "var(--t-sidebar-border)",
  }), []);

  // LocaleProvider used to be nested here. It now sits in app/layout.jsx so it
  // also covers the chrome mounted at the root — a second one here would give
  // those components their own state, and the picker would stop reaching them.
  // Stamps <html data-saver> on a constrained connection. Called here because
  // this provider wraps every page, public and signed-in alike — the ambient
  // layer it renders below is the main thing the stamp turns off, and somebody
  // on 3g meets the landing page before they ever meet a dashboard.
  useDataSaver();

  return (
    <ThemeCtx.Provider value={{ dark, setDark, toggleTheme, t, loaded, themeMode, setThemeMode }}>
      {children}
      {/* The atmosphere: aurora + grain over every page (see .nitro-atmo in globals.css). */}
      <div aria-hidden="true" className="nitro-atmo" />
    </ThemeCtx.Provider>
  );
}

// ── Shared Nav ──
// action prop: "back" | "login" | "logout" | null
export default function SharedNav({ action = "back" }) {
  const tr = useT();
  const { dark, toggleTheme, t } = useTheme();
  const pathname = usePathname();
  const [navOpen, setNavOpen] = useState(false);

  const handleLogout = async () => {
    let res;
    try {
      res = await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      window.alert(tr("Unable to log out. Check your connection and try again."));
      return;
    }
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      window.alert(data.error ? tr(data.error) : tr("Unable to log out. Please try again."));
      return;
    }
    window.location.href = "/";
  };

  return (<>
    <nav
      className="flex items-center justify-between px-6 h-14 backdrop-blur-[16px] shrink-0 sticky top-0 z-50"
      style={{ background: dark ? "rgba(14,9,22,.9)" : "rgba(240,237,232,.9)", borderBottom: `1px solid ${t.surfaceBrd}` }}
    >
      <a href="/" className="flex items-center">
        <span className="nitro-mark md:hidden w-[34px] h-[34px] flex items-center justify-center" style={{ background: t.grad }}><svg width="13" height="14" viewBox="0 0 1601 1785" fill="#fff"><path d="M1600.82 160.089V1313c-.85 53.13-10.35 104.17-27.19 151.74-48.19 136.54-156.38 244.73-292.92 292.92-50.12 17.76-103.94 27.34-160.08 27.34 0 0-79.39 0-160.01-27.34-85.1-28.88-155.38-85.49-208.28-141.55-72.59-76.84-112.13-179.09-112.13-284.74V1023.4v-3.08-12.9c.08-1.39.08-2.7.08-4.17 0-1.39 0-2.7-.08-4.09-2.08-84.64-69.97-153.06-154.53-155.84-1.85-.08-3.71-.15-5.48-.15-1.78 0-3.71.08-5.48.15-84.56 2.78-152.44 71.2-154.61 155.84-.08 1.39-.08 2.7-.08 4.09 0 1.47 0 2.78.08 4.17v534.87c0 88.42-71.67 160.09-160.09 160.09-44.17 0-84.25-17.92-113.21-46.88C17.92 1626.84 0 1586.76 0 1542.59V995.288c.927-53.132 10.426-104.178 27.261-151.672C75.45 707.003 183.643 598.81 320.179 550.621c50.119-17.685 103.946-27.338 160.089-27.338 0 0 79.388 0 160.012 27.338 85.103 28.882 155.379 85.489 208.278 141.555 72.593 76.84 112.132 179.087 112.132 284.732v307.972l-.077.92v12.89c-.077 1.39-.077 2.78-.077 4.17 0 1.39 0 2.7.077 4.17 2.085 84.64 69.967 152.99 154.527 155.84 1.86 0 3.71 0 5.49 0 1.77 0 3.7 0 5.48 0 84.56-2.85 152.44-71.2 154.6-155.84V160.089C1280.71 71.666 1352.38 0 1440.8 0c44.18 0 84.18 17.916 113.14 46.876 28.96 28.96 46.88 69.04 46.88 113.213z"/></svg></span>
        <span className="nitro-mark max-md:hidden h-7 px-3 flex items-center justify-center" style={{ background: "linear-gradient(135deg,#c47d8e,#8b5e6b)" }}><NitroWordmark height={12} color="#fff" /></span>
      </a>
      <nav aria-label={tr("Primary")} className="max-desktop:hidden flex items-center gap-1">
        {PUBLIC_LINKS.map(l => <a key={l.href} href={l.href} aria-current={pathname === l.href || (l.href !== "/" && pathname?.startsWith(l.href + "/")) ? "page" : undefined} className="pub-link text-sm font-medium py-1.5 px-3 rounded-lg no-underline" style={{ color: t.soft }}>{l.label}</a>)}
      </nav>
      <div className="flex items-center gap-3">
        {/* The page action comes first because it is not always there: with the
            variable item on the inside, the constant set — currency, language,
            theme, menu — stays anchored to the edge whether or not it appears. */}
        {action === "back" && (
          <a href="/" className="text-sm font-medium flex items-center gap-1" style={{ color: t.soft }}>
            <svg className="dir-flip" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={t.muted} strokeWidth="2" strokeLinecap="round"><polyline points="15 18 9 12 15 6" /></svg>
            {tr("Back")}
          </a>
        )}
        {action === "login" && (
          <a href="/?login=1" className="text-sm font-medium flex items-center gap-1" style={{ color: t.soft }}>
            {tr("Log In")}
          </a>
        )}
        {action === "logout" && (
          <button onClick={handleLogout} className="text-sm font-medium flex items-center gap-1 bg-transparent" style={{ color: t.soft }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={t.muted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
            {tr("Log Out")}
          </button>
        )}
        {/* Local only until the currency switch is finished — see SWITCHER_LIVE
            in components/locale.jsx. A production build drops both. */}
        {SWITCHER_LIVE && <CurrencySwitcher />}
        {SWITCHER_LIVE && <LanguageSwitcher />}
        <ThemeToggle dark={dark} onToggle={toggleTheme} />
        {/* The menu is the outermost control, where a thumb expects it. */}
        <button type="button" onClick={() => setNavOpen(true)} aria-label={tr("Open menu")} aria-expanded={navOpen} className="nav-burger desktop:hidden"><span className="nb-bar" aria-hidden="true" /><span className="nb-bar" aria-hidden="true" /><span className="nb-bar" aria-hidden="true" /></button>
      </div>
    </nav>
    <PublicNavSheet open={navOpen} onClose={() => setNavOpen(false)} dark={dark} toggleTheme={toggleTheme} />
  </>);
}

// ── Shared Footer ──
export function SharedFooter() {
  const tr = useT();
  const { dark } = useTheme();
  const [sl, setSl] = useState({});
  const [platformCount, setPlatformCount] = useState(0);
  useEffect(() => {
    fetch("/api/settings").then(r => r.ok ? r.json() : {}).then(d => setSl(d.settings || {})).catch(() => {});
    fetch("/api/site-info").then(r => r.ok ? r.json() : {}).then(d => setPlatformCount(d.stats?.platforms || 0)).catch(() => {});
  }, []);

  const xHandle = (sl.social_twitter || "TheNitroNG").replace(/^(https?:\/\/)?(www\.)?(x\.com|twitter\.com)\/?/i, "").replace(/^@/, "").replace(/\/$/, "");
  const igHandle = (sl.social_instagram || "Nitro.ng").replace(/^(https?:\/\/)?(www\.)?(instagram\.com)\/?/i, "").replace(/^@/, "").replace(/\/$/, "");
  const tkHandle = sl.social_tiktok ? sl.social_tiktok.replace(/^(https?:\/\/)?(www\.)?(tiktok\.com\/@?)?/i, "").replace(/^@/, "").replace(/\/$/, "") : null;
  const waNum = sl.social_whatsapp_support ? sl.social_whatsapp_support.replace(/\D/g, "") : null;


  const WA_PATH = "M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z";
  const soc = (href, label, d) => (
    <a key={label} href={href} target="_blank" rel="noopener noreferrer" aria-label={label} className="lv3-ft-soc">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d={d} /></svg>
    </a>
  );

  return (
    <footer className="lv3-ft" style={{ background: dark ? "#050710" : "#2a1a22" }}>
      <div className="lv3-grain" />
      <div className="absolute rounded-full pointer-events-none" style={{ width: 520, height: 400, top: "-40%", left: "18%", background: "rgba(196,125,142,.14)", filter: "blur(110px)" }} />
      <div className="lv3-ft-ghost" aria-hidden="true">NITRO</div>
      <div className="lv3-ft-in">

        <div className="lv3-ft-cols">
          <div className="lv3-ft-brand">
            <span className="nitro-mark h-[30px] px-3 inline-flex items-center justify-center"
              style={{ background: "linear-gradient(135deg,#c47d8e,#8b5e6b)" }}>
              <NitroWordmark height={13} color="#fff" />
            </span>
            <p>{tr("We handle the numbers so you can handle the content.")} {platformCount ? `${platformCount}+` : "28+"} {tr("platforms, naira pricing, fast delivery.")}</p>
            <a className="lv3-ft-status" href="https://stats.uptimerobot.com/PvHE3u4psX" target="_blank" rel="noopener noreferrer"><i />{tr("All systems live")}</a>
            <div className="flex gap-2 mt-[18px]">
              {soc(`https://x.com/${xHandle}`, "X (Twitter)", "M18.9 1.2h3.7l-8.1 9.2 9.5 12.5h-7.4l-5.8-7.6-6.7 7.6H.4l8.6-9.8L0 1.2h7.6l5.2 6.9 6.1-6.9zm-1.3 19.5h2L6.5 3.2H4.4l13.2 17.5z")}
              {soc(`https://instagram.com/${igHandle}`, "Instagram", "M12 2.2c3.2 0 3.6 0 4.9.1 1.2.1 1.8.2 2.2.4.6.2 1 .5 1.4.9.4.4.7.8.9 1.4.2.4.4 1 .4 2.2.1 1.3.1 1.7.1 4.9s0 3.6-.1 4.9c-.1 1.2-.2 1.8-.4 2.2-.2.6-.5 1-.9 1.4-.4.4-.8.7-1.4.9-.4.2-1 .4-2.2.4-1.3.1-1.7.1-4.9.1s-3.6 0-4.9-.1c-1.2-.1-1.8-.2-2.2-.4-.6-.2-1-.5-1.4-.9-.4-.4-.7-.8-.9-1.4-.2-.4-.4-1-.4-2.2C2.2 15.6 2.2 15.2 2.2 12s0-3.6.1-4.9c.1-1.2.2-1.8.4-2.2.2-.6.5-1 .9-1.4.4-.4.8-.7 1.4-.9.4-.2 1-.4 2.2-.4C8.4 2.2 8.8 2.2 12 2.2zm0 5.8a4 4 0 100 8 4 4 0 000-8zm0 6.6a2.6 2.6 0 110-5.2 2.6 2.6 0 010 5.2zm5.1-6.8a.94.94 0 11-1.9 0 .94.94 0 011.9 0z")}
              {tkHandle && soc(`https://tiktok.com/@${tkHandle}`, "TikTok", "M16.6 5.8a4.3 4.3 0 01-1-2.6h-3v11.6a2.5 2.5 0 11-1.8-2.4V9.3a5.5 5.5 0 103.5 5.1V8.8a7.2 7.2 0 004.2 1.4V7.2a4.3 4.3 0 01-1.9-1.4z")}
              {waNum && soc(`https://wa.me/${waNum}`, "WhatsApp", WA_PATH)}
            </div>
          </div>

          <div>
            <div className="lv3-ft-h4">{tr("Product")}</div>
            {[[tr("Pricing"), "/pricing"], [tr("Services"), "/services"], [tr("Quality"), "/quality"], [tr("Reviews"), "/reviews"], [tr("Resellers"), "/resellers"], [tr("The Pit"), "/pit"], [tr("Blog"), "/blog"], [tr("What's New"), "/changelog"]].map(([l, h]) => (
              <a key={l} href={h} className="lv3-ft-l">{l}</a>
            ))}
          </div>

          <div>
            <div className="lv3-ft-h4">{tr("Company")}</div>
            {[[tr("About"), "/about"], [tr("Help"), "/help"], [tr("FAQ"), "/faq"], [tr("Contact"), "/contact"], [tr("Terms"), "/terms"], [tr("Privacy"), "/privacy"], [tr("Refund"), "/refund"], [tr("Cookies"), "/cookie"]].map(([l, h]) => (
              <a key={l} href={h} className="lv3-ft-l">{l}</a>
            ))}
            <button onClick={() => window.dispatchEvent(new CustomEvent('nitro-cookie-settings'))} className="lv3-ft-l">{tr("Cookie settings")}</button>
          </div>

          <div className="lv3-ft-contact">
            <div className="lv3-ft-h4">{tr("Get in touch")}</div>
            <a href="mailto:support@nitro.ng" className="lv3-ft-l">support@nitro.ng</a>
            {waNum && <a href={`https://wa.me/${waNum}`} target="_blank" rel="noopener noreferrer" className="lv3-ft-l">{tr("WhatsApp support")}</a>}
            <a href="https://stats.uptimerobot.com/PvHE3u4psX" target="_blank" rel="noopener noreferrer" className="lv3-ft-l">{tr("Status page")}</a>
          </div>
        </div>

        <div className="lv3-ft-base">
          <span className="m">© {new Date().getFullYear() > 2025 ? `2025–${new Date().getFullYear()}` : "2025"} The Nitro NG · RC 9514845</span>
          <span>{tr("Built in Lagos 🇳🇬")}</span>
        </div>
      </div>

      {/* Floating WhatsApp button */}
      {waNum && (
        <WaButton
          href={`https://wa.me/${waNum}`}
          size="round"
          label={tr("Chat on WhatsApp")}
          className="fixed bottom-6 right-6 max-md:bottom-5 max-md:right-4 z-[90]"
        />
      )}
    </footer>
  );
}

// ── Shared Styles (legacy — resets now in globals.css @layer base) ──
export function SharedStyles() {
  return null;
}
