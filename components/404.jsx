'use client';
import { useState, useEffect } from "react";
import { ThemeProvider, useTheme } from "./shared-nav";

function NotFoundInner() {
  const { dark, toggleTheme, t, loaded } = useTheme();
  const [hover, setHover] = useState(null);

  const bg = dark ? "#080b14" : "#f4f1ed";
  const border = dark ? "rgba(255,255,255,.1)" : "rgba(0,0,0,.08)";
  const muted = dark ? "rgba(255,255,255,.3)" : "rgba(0,0,0,.3)";
  const soft = dark ? "rgba(255,255,255,.55)" : "rgba(0,0,0,.45)";
  const text = dark ? "#f0ede8" : "#1c1b19";
  const accent = "#c47d8e";

  if (!loaded) return <div style={{ minHeight: "100dvh", background: bg }} />;

  const links = [
    { href: "/", label: "Home", sub: "Back to the start", icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>, grad: "linear-gradient(135deg,#c47d8e,#8b5e6b)" },
    { href: "/new-order", label: "New Order", sub: "Place a new order", icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={dark ? "#6ee7b7" : "#059669"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>, grad: dark ? "rgba(110,231,183,.1)" : "rgba(5,150,105,.08)" },
    { href: "/support", label: "Support", sub: "Get help from us", icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={dark ? "#60a5fa" : "#2563eb"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>, grad: dark ? "rgba(96,165,250,.1)" : "rgba(37,99,235,.08)" },
  ];

  return (
    <div className="min-h-dvh flex flex-col relative overflow-hidden" style={{ background: bg, fontFamily: "'Outfit',system-ui,sans-serif" }}>
      <style>{`
        @keyframes nf-drift { 0% { transform: translate(0,0) scale(1); } 33% { transform: translate(30px,-20px) scale(1.1); } 66% { transform: translate(-20px,15px) scale(0.95); } 100% { transform: translate(0,0) scale(1); } }
        @keyframes nf-shimmer { 0% { background-position: -200% center; } 100% { background-position: 200% center; } }
        @keyframes nf-fade-up { 0% { opacity: 0; transform: translateY(16px); } 100% { opacity: 1; transform: translateY(0); } }
        .nf-link:hover { transform: translateX(4px); }
      `}</style>

      {/* Ambient blobs */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute rounded-full blur-[120px]" style={{ width: "55%", height: "55%", top: "5%", left: "-5%", background: `radial-gradient(ellipse, ${dark ? "rgba(196,125,142,.1)" : "rgba(196,125,142,.08)"} 0%, transparent 70%)`, animation: "nf-drift 20s ease-in-out infinite" }} />
        <div className="absolute rounded-full blur-[100px]" style={{ width: "45%", height: "45%", bottom: "0%", right: "-5%", background: `radial-gradient(ellipse, ${dark ? "rgba(99,102,241,.06)" : "rgba(99,102,241,.04)"} 0%, transparent 70%)`, animation: "nf-drift 25s ease-in-out infinite reverse" }} />
        <div className="absolute rounded-full blur-[80px]" style={{ width: "30%", height: "30%", top: "40%", right: "20%", background: `radial-gradient(ellipse, ${dark ? "rgba(224,164,88,.04)" : "rgba(224,164,88,.03)"} 0%, transparent 70%)`, animation: "nf-drift 18s ease-in-out 3s infinite" }} />
      </div>

      {/* Nav */}
      <nav className="flex items-center justify-between px-6 h-[52px] relative z-10 shrink-0 backdrop-blur-sm" style={{ borderBottom: `0.5px solid ${border}`, background: dark ? "rgba(8,11,20,.5)" : "rgba(244,241,237,.5)" }}>
        <a href="/" className="flex items-center gap-2 no-underline">
          <div className="w-6 h-6 rounded-md flex items-center justify-center" style={{ background: "linear-gradient(135deg,#c47d8e,#8b5e6b)" }}>
            <svg width="9" height="10" viewBox="0 0 1601 1785" fill="#fff"><path d="M1600.82 160.089V1313c-.85 53.13-10.35 104.17-27.19 151.74-48.19 136.54-156.38 244.73-292.92 292.92-50.12 17.76-103.94 27.34-160.08 27.34 0 0-79.39 0-160.01-27.34-85.1-28.88-155.38-85.49-208.28-141.55-72.59-76.84-112.13-179.09-112.13-284.74V1023.4v-3.08-12.9c.08-1.39.08-2.7.08-4.17 0-1.39 0-2.7-.08-4.09-2.08-84.64-69.97-153.06-154.53-155.84-1.85-.08-3.71-.15-5.48-.15-1.78 0-3.71.08-5.48.15-84.56 2.78-152.44 71.2-154.61 155.84-.08 1.39-.08 2.7-.08 4.09 0 1.47 0 2.78.08 4.17v534.87c0 88.42-71.67 160.09-160.09 160.09-44.17 0-84.25-17.92-113.21-46.88C17.92 1626.84 0 1586.76 0 1542.59V995.288c.927-53.132 10.426-104.178 27.261-151.672C75.45 707.003 183.643 598.81 320.179 550.621c50.119-17.685 103.946-27.338 160.089-27.338 0 0 79.388 0 160.012 27.338 85.103 28.882 155.379 85.489 208.278 141.555 72.593 76.84 112.132 179.087 112.132 284.732v307.972l-.077.92v12.89c-.077 1.39-.077 2.78-.077 4.17 0 1.39 0 2.7.077 4.17 2.085 84.64 69.967 152.99 154.527 155.84 1.86 0 3.71 0 5.49 0 1.77 0 3.7 0 5.48 0 84.56-2.85 152.44-71.2 154.6-155.84V160.089C1280.71 71.666 1352.38 0 1440.8 0c44.18 0 84.18 17.916 113.14 46.876 28.96 28.96 46.88 69.04 46.88 113.213z"/></svg>
          </div>
          <span className="text-[15px] font-semibold tracking-[2px]" style={{ color: text }}>NITRO</span>
        </a>
        <button onClick={toggleTheme} className="w-10 h-[22px] rounded-[11px] relative cursor-pointer" style={{ background: dark ? "rgba(99,102,241,.28)" : "rgba(0,0,0,.12)", border: `0.5px solid ${dark ? "rgba(99,102,241,.24)" : "rgba(0,0,0,.14)"}` }}>
          <div className="w-4 h-4 rounded-full absolute flex items-center justify-center transition-[left] duration-400 ease-[cubic-bezier(.4,0,.2,1)]" style={{ background: dark ? "#1e1b4b" : "#fff", top: 2.5, left: dark ? 20.5 : 2.5, boxShadow: dark ? "none" : "0 1px 4px rgba(0,0,0,.15)" }}>
            {dark ? <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#a5b4fc" strokeWidth="2"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/></svg> : <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2"><circle cx="12" cy="12" r="5"/></svg>}
          </div>
        </button>
      </nav>

      {/* Main */}
      <div className="flex-1 flex items-center justify-center relative z-[1] px-5 py-10">
        <div className="text-center w-full max-w-[420px]" style={{ animation: "nf-fade-up .6s ease-out" }}>

          {/* Ghost Nitro logo behind 404 */}
          <div className="relative mb-2">
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none" style={{ opacity: dark ? 0.03 : 0.04 }}>
              <svg width="160" height="178" viewBox="0 0 1601 1785" fill={text}><path d="M1600.82 160.089V1313c-.85 53.13-10.35 104.17-27.19 151.74-48.19 136.54-156.38 244.73-292.92 292.92-50.12 17.76-103.94 27.34-160.08 27.34 0 0-79.39 0-160.01-27.34-85.1-28.88-155.38-85.49-208.28-141.55-72.59-76.84-112.13-179.09-112.13-284.74V1023.4v-3.08-12.9c.08-1.39.08-2.7.08-4.17 0-1.39 0-2.7-.08-4.09-2.08-84.64-69.97-153.06-154.53-155.84-1.85-.08-3.71-.15-5.48-.15-1.78 0-3.71.08-5.48.15-84.56 2.78-152.44 71.2-154.61 155.84-.08 1.39-.08 2.7-.08 4.09 0 1.47 0 2.78.08 4.17v534.87c0 88.42-71.67 160.09-160.09 160.09-44.17 0-84.25-17.92-113.21-46.88C17.92 1626.84 0 1586.76 0 1542.59V995.288c.927-53.132 10.426-104.178 27.261-151.672C75.45 707.003 183.643 598.81 320.179 550.621c50.119-17.685 103.946-27.338 160.089-27.338 0 0 79.388 0 160.012 27.338 85.103 28.882 155.379 85.489 208.278 141.555 72.593 76.84 112.132 179.087 112.132 284.732v307.972l-.077.92v12.89c-.077 1.39-.077 2.78-.077 4.17 0 1.39 0 2.7.077 4.17 2.085 84.64 69.967 152.99 154.527 155.84 1.86 0 3.71 0 5.49 0 1.77 0 3.7 0 5.48 0 84.56-2.85 152.44-71.2 154.6-155.84V160.089C1280.71 71.666 1352.38 0 1440.8 0c44.18 0 84.18 17.916 113.14 46.876 28.96 28.96 46.88 69.04 46.88 113.213z"/></svg>
            </div>

            {/* 404 with shimmer */}
            <div className="relative inline-block select-none" style={{ fontSize: "clamp(90px, 22vw, 140px)", fontFamily: "'JetBrains Mono',monospace", fontWeight: 800, lineHeight: 1, letterSpacing: "-6px" }}>
              <span style={{ color: dark ? "rgba(196,125,142,.08)" : "rgba(196,125,142,.1)" }}>4</span>
              <span className="relative" style={{
                background: `linear-gradient(90deg, ${accent}, ${dark ? "#e0a458" : "#d97706"}, ${accent})`,
                backgroundSize: "200% 100%",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                animation: "nf-shimmer 4s ease-in-out infinite",
              }}>0</span>
              <span style={{ color: dark ? "rgba(196,125,142,.08)" : "rgba(196,125,142,.1)" }}>4</span>
            </div>
          </div>

          {/* Heading */}
          <h1 className="font-light mb-2.5 italic leading-[1.2]" style={{ fontSize: "clamp(24px, 5vw, 36px)", color: text, fontFamily: "'Cormorant Garamond',serif" }}>
            Wrong turn
          </h1>

          {/* Body */}
          <p className="text-[14px] leading-[1.7] mx-auto mb-8" style={{ color: soft, maxWidth: 320 }}>
            This page doesn&#39;t exist anymore, or the link is broken. Pick a destination below.
          </p>

          {/* Glass card with links */}
          <div className="rounded-2xl p-1.5 mb-8 mx-auto max-w-[320px]" style={{
            background: dark ? "rgba(255,255,255,.04)" : "rgba(255,255,255,.55)",
            border: `1px solid ${dark ? "rgba(255,255,255,.08)" : "rgba(0,0,0,.06)"}`,
            backdropFilter: "blur(20px)",
            boxShadow: dark ? "0 8px 32px rgba(0,0,0,.3)" : "0 8px 32px rgba(0,0,0,.06)",
          }}>
            {links.map((l, i) => (
              <a
                key={l.href}
                href={l.href}
                className="nf-link flex items-center gap-3 py-3 px-3.5 rounded-xl no-underline transition-all duration-200"
                style={{
                  background: hover === i ? (dark ? "rgba(255,255,255,.06)" : "rgba(0,0,0,.03)") : "transparent",
                }}
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
              >
                <div className="w-9 h-9 rounded-[10px] flex items-center justify-center shrink-0" style={{ background: l.grad }}>
                  {l.icon}
                </div>
                <div className="flex-1 text-left min-w-0">
                  <div className="text-[13px] font-semibold" style={{ color: text }}>{l.label}</div>
                  <div className="text-[11px]" style={{ color: muted }}>{l.sub}</div>
                </div>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={hover === i ? accent : muted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 transition-colors duration-200"><polyline points="9 18 15 12 9 6"/></svg>
              </a>
            ))}
          </div>

          {/* Powered by Nitro badge */}
          <div className="inline-flex items-center gap-1.5 py-1.5 px-3 rounded-full" style={{ background: dark ? "rgba(196,125,142,.06)" : "rgba(196,125,142,.04)", border: `1px solid ${dark ? "rgba(196,125,142,.1)" : "rgba(196,125,142,.08)"}` }}>
            <div className="w-3.5 h-3.5 rounded-[3px] flex items-center justify-center" style={{ background: "linear-gradient(135deg,#c47d8e,#8b5e6b)" }}>
              <svg width="5" height="6" viewBox="0 0 1601 1785" fill="#fff"><path d="M1600.82 160.089V1313c-.85 53.13-10.35 104.17-27.19 151.74-48.19 136.54-156.38 244.73-292.92 292.92-50.12 17.76-103.94 27.34-160.08 27.34 0 0-79.39 0-160.01-27.34-85.1-28.88-155.38-85.49-208.28-141.55-72.59-76.84-112.13-179.09-112.13-284.74V1023.4v-3.08-12.9c.08-1.39.08-2.7.08-4.17 0-1.39 0-2.7-.08-4.09-2.08-84.64-69.97-153.06-154.53-155.84-1.85-.08-3.71-.15-5.48-.15-1.78 0-3.71.08-5.48.15-84.56 2.78-152.44 71.2-154.61 155.84-.08 1.39-.08 2.7-.08 4.09 0 1.47 0 2.78.08 4.17v534.87c0 88.42-71.67 160.09-160.09 160.09-44.17 0-84.25-17.92-113.21-46.88C17.92 1626.84 0 1586.76 0 1542.59V995.288c.927-53.132 10.426-104.178 27.261-151.672C75.45 707.003 183.643 598.81 320.179 550.621c50.119-17.685 103.946-27.338 160.089-27.338 0 0 79.388 0 160.012 27.338 85.103 28.882 155.379 85.489 208.278 141.555 72.593 76.84 112.132 179.087 112.132 284.732v307.972l-.077.92v12.89c-.077 1.39-.077 2.78-.077 4.17 0 1.39 0 2.7.077 4.17 2.085 84.64 69.967 152.99 154.527 155.84 1.86 0 3.71 0 5.49 0 1.77 0 3.7 0 5.48 0 84.56-2.85 152.44-71.2 154.6-155.84V160.089C1280.71 71.666 1352.38 0 1440.8 0c44.18 0 84.18 17.916 113.14 46.876 28.96 28.96 46.88 69.04 46.88 113.213z"/></svg>
            </div>
            <span className="text-[10px] font-medium tracking-[.5px]" style={{ color: muted }}>nitro.ng</span>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="py-3.5 px-6 flex justify-between items-center shrink-0 relative z-10" style={{ borderTop: `0.5px solid ${border}` }}>
        <span className="text-xs" style={{ color: muted }}>&copy; {new Date().getFullYear() > 2026 ? `2026–${new Date().getFullYear()}` : "2026"} Nitro</span>
        <div className="flex gap-3.5"><a href="/terms" className="text-xs no-underline" style={{ color: muted }}>Terms</a><a href="/privacy" className="text-xs no-underline" style={{ color: muted }}>Privacy</a></div>
      </footer>
    </div>
  );
}

export default function NotFound() {
  return <ThemeProvider><NotFoundInner /></ThemeProvider>;
}
