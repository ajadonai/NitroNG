'use client';
import { useState, useEffect } from "react";
import { ThemeProvider, useTheme } from "./shared-nav";

function MaintenanceInner() {
  const { dark, t, loaded } = useTheme();
  const [dots, setDots] = useState(0);
  const [msg, setMsg] = useState("We're performing scheduled upgrades. Everything will be back shortly.");
  const [eta, setEta] = useState("~1 hour");
  const [pulse, setPulse] = useState(0);
  const [sl, setSl] = useState({});
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    fetch("/api/settings").then(r => r.json()).then(d => setSl(d.settings || {})).catch(() => {});
  }, []);

  useEffect(() => {
    const check = () => {
      fetch("/api/maintenance-check").then(r => r.json()).then(d => {
        if (!d.maintenance) { window.location.replace("/"); return; }
        if (d.message) setMsg(d.message);
        if (d.eta) setEta(d.eta);
      }).catch(() => {});
    };
    check();
    const iv = setInterval(check, 15000);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => { const iv = setInterval(() => setDots(d => (d + 1) % 4), 600); return () => clearInterval(iv); }, []);

  useEffect(() => {
    let frame;
    const tick = () => { setPulse(p => (p + 0.5) % 360); frame = requestAnimationFrame(tick); };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    const iv = setInterval(() => setProgress(p => p >= 92 ? 15 : p + (Math.random() * 3 + 0.5)), 800);
    return () => clearInterval(iv);
  }, []);

  const amber = dark ? "#e0a458" : "#d97706";
  const bg = dark ? "#080b14" : "#f4f1ed";
  const border = dark ? "rgba(255,255,255,.12)" : "rgba(0,0,0,.12)";
  const cardGlass = dark ? "rgba(255,255,255,.03)" : "rgba(255,255,255,.55)";
  const muted = dark ? "rgba(255,255,255,.3)" : "rgba(0,0,0,.3)";
  const soft = dark ? "rgba(255,255,255,.5)" : "rgba(0,0,0,.5)";
  const text = dark ? "#f0ede8" : "#1c1b19";
  const accent = "#c47d8e";
  const green = "#25d366";

  if (!loaded) return <div style={{ minHeight: "100dvh", background: bg }} />;

  const gears = [
    { size: 48, x: "12%", y: "18%", speed: 20, dir: 1, opacity: dark ? 0.04 : 0.05 },
    { size: 32, x: "82%", y: "24%", speed: 15, dir: -1, opacity: dark ? 0.035 : 0.045 },
    { size: 40, x: "75%", y: "72%", speed: 25, dir: 1, opacity: dark ? 0.03 : 0.04 },
    { size: 24, x: "18%", y: "78%", speed: 12, dir: -1, opacity: dark ? 0.035 : 0.045 },
    { size: 28, x: "50%", y: "88%", speed: 18, dir: 1, opacity: dark ? 0.025 : 0.035 },
  ];

  const particles = Array.from({ length: 10 }, (_, i) => ({
    size: 2 + (i % 3),
    x: 5 + (i * 9.7) % 90,
    delay: i * 1.5,
    dur: 14 + (i % 4) * 3,
    opacity: 0.12 + (i % 3) * 0.08,
  }));

  return (
    <div className="min-h-dvh flex flex-col relative overflow-hidden" style={{ background: bg, fontFamily: "'Outfit',system-ui,sans-serif" }}>
      <style>{`
        @keyframes mt-float { 0%,100% { transform: translateY(100vh) scale(0); opacity: 0; } 10% { opacity: 1; } 90% { opacity: 1; } 100% { transform: translateY(-10vh) scale(1); opacity: 0; } }
        @keyframes mt-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes mt-shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }
        @keyframes mt-breathe { 0%,100% { transform: scale(1); opacity: .6; } 50% { transform: scale(1.12); opacity: 1; } }
      `}</style>

      {/* Background blurs */}
      <div className="absolute inset-0 pointer-events-none" style={{ opacity: dark ? 0.5 : 0.3 }}>
        <div className="absolute rounded-full blur-[80px]" style={{ width: "60%", height: "60%", top: "-15%", left: "-10%", background: "radial-gradient(ellipse, rgba(196,125,142,.08) 0%, transparent 70%)" }} />
        <div className="absolute rounded-full blur-[80px]" style={{ width: "50%", height: "50%", bottom: "-10%", right: "-10%", background: "radial-gradient(ellipse, rgba(224,164,88,.06) 0%, transparent 70%)" }} />
        <div className="absolute rounded-full blur-[60px] -translate-x-1/2" style={{ width: "30%", height: "30%", top: "40%", left: "50%", background: "radial-gradient(ellipse, rgba(139,94,107,.05) 0%, transparent 70%)" }} />
      </div>

      {/* Grid */}
      <div className="absolute inset-0 pointer-events-none" style={{ opacity: dark ? 0.03 : 0.04, backgroundImage: "linear-gradient(rgba(128,128,128,.15) 1px, transparent 1px), linear-gradient(90deg, rgba(128,128,128,.15) 1px, transparent 1px)", backgroundSize: "40px 40px" }} />

      {/* Floating gears */}
      <div className="absolute inset-0 pointer-events-none">
        {gears.map((g, i) => (
          <svg key={i} className="absolute" width={g.size} height={g.size} viewBox="0 0 24 24" fill="none" stroke={accent} strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" style={{ left: g.x, top: g.y, opacity: g.opacity, animation: `mt-spin ${g.speed}s linear infinite`, animationDirection: g.dir < 0 ? "reverse" : "normal" }}>
            <circle cx="12" cy="12" r="3"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>
          </svg>
        ))}
      </div>

      {/* Floating particles */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {particles.map((p, i) => (
          <div key={i} className="absolute rounded-full" style={{ width: p.size, height: p.size, left: `${p.x}%`, bottom: "-10px", background: i % 2 === 0 ? amber : accent, opacity: p.opacity, animation: `mt-float ${p.dur}s ${p.delay}s linear infinite` }} />
        ))}
      </div>

      {/* Nav */}
      <nav className="flex items-center justify-center px-6 h-[52px] backdrop-blur-[20px] relative z-10 shrink-0" style={{ borderBottom: `0.5px solid ${border}`, background: dark ? "rgba(8,11,20,.6)" : "rgba(244,241,237,.7)" }}>
        <div className="flex items-center gap-2">
          <div className="w-[22px] h-[22px] rounded-md flex items-center justify-center" style={{ background: "linear-gradient(135deg,#c47d8e,#8b5e6b)" }}>
            <svg width="9" height="9" viewBox="0 0 20 20" fill="none"><path d="M4,16 L4,4 L16,16 L16,4" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </div>
          <span className="text-sm font-semibold tracking-[2px]" style={{ color: text }}>NITRO</span>
        </div>
      </nav>

      {/* Main */}
      <div className="flex-1 flex items-center justify-center relative z-[1] p-5">

        {/* Glass card */}
        <div className="text-center max-w-[500px] w-full py-10 px-8 rounded-3xl relative" style={{ background: cardGlass, border: `1px solid ${border}`, backdropFilter: "blur(16px)", boxShadow: dark ? "0 8px 40px rgba(0,0,0,.4)" : "0 8px 40px rgba(0,0,0,.06)" }}>

          {/* Animated orb */}
          <div className="relative w-[100px] h-[100px] mx-auto mb-7">
            <div className="absolute inset-0 rounded-full" style={{ border: `1.5px solid ${dark ? "rgba(196,125,142,.24)" : "rgba(196,125,142,.28)"}`, transform: `rotate(${pulse}deg)` }}>
              <div className="absolute w-1.5 h-1.5 rounded-full -top-[3px] left-1/2 -translate-x-1/2" style={{ background: accent, boxShadow: `0 0 8px ${accent}` }} />
            </div>
            <div className="absolute inset-4 rounded-full" style={{ border: `1px solid ${dark ? "rgba(224,164,88,.18)" : "rgba(224,164,88,.24)"}`, transform: `rotate(${-pulse * 0.7}deg)` }}>
              <div className="absolute w-1 h-1 rounded-full -bottom-0.5 left-1/2 -translate-x-1/2" style={{ background: amber }} />
            </div>
            <div className="absolute inset-[30px] rounded-full" style={{ border: `0.5px dashed ${dark ? "rgba(224,164,88,.1)" : "rgba(224,164,88,.14)"}`, transform: `rotate(${pulse * 1.3}deg)` }} />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: `radial-gradient(circle, ${dark ? "rgba(196,125,142,.15)" : "rgba(196,125,142,.1)"} 0%, transparent 70%)`, animation: "mt-breathe 3s ease-in-out infinite" }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={accent} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z"/></svg>
              </div>
            </div>
          </div>

          {/* Status badge */}
          <div className="inline-flex items-center gap-1.5 py-[5px] px-3.5 rounded-[20px] mb-4" style={{ background: dark ? "rgba(224,164,88,.12)" : "rgba(224,164,88,.08)", border: `1px solid ${dark ? "rgba(224,164,88,.19)" : "rgba(224,164,88,.18)"}` }}>
            <div className="w-1.5 h-1.5 rounded-full" style={{ background: amber, boxShadow: `0 0 8px ${amber}`, animation: "mt-breathe 2s ease-in-out infinite" }} />
            <span className="text-[11px] font-semibold tracking-[1.2px] uppercase" style={{ color: amber }}>Maintenance in progress</span>
          </div>

          {/* Heading */}
          <h1 className="font-light mb-2.5 leading-[1.2]" style={{ fontSize: "clamp(28px, 5vw, 40px)", color: text, fontFamily: "'Cormorant Garamond',serif" }}>We'll be right back</h1>

          {/* Message */}
          <p className="text-[15px] leading-[1.75] max-w-[380px] mx-auto mb-6 font-normal" style={{ color: soft }}>{msg}</p>

          {/* Progress bar */}
          <div className="max-w-[280px] mx-auto mb-2 rounded-full overflow-hidden h-[5px]" style={{ background: dark ? "rgba(255,255,255,.06)" : "rgba(0,0,0,.06)" }}>
            <div className="h-full rounded-full transition-[width] duration-700 ease-out" style={{ width: `${progress}%`, background: `linear-gradient(90deg, ${accent}, ${amber})`, backgroundSize: "200% 100%", animation: "mt-shimmer 2s linear infinite" }} />
          </div>
          <div className="text-[11px] font-medium mb-6" style={{ color: muted }}>Upgrading systems{".".repeat(dots)}</div>

          {/* ETA chip */}
          <div className="inline-flex items-center gap-2 py-[9px] px-[18px] rounded-xl mb-7" style={{ background: dark ? "rgba(255,255,255,.04)" : "rgba(0,0,0,.03)", border: `1px solid ${border}` }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={amber} strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            <span className="text-[13px] font-semibold" style={{ color: amber }}>Estimated: {eta}</span>
          </div>

          {/* Social */}
          <div className="flex items-center justify-center gap-2">
            <span className="text-xs mr-1" style={{ color: muted }}>Stay updated</span>
            <a href={`https://x.com/${sl.social_twitter || "TheNitroNG"}`} target="_blank" rel="noopener noreferrer" aria-label="X (Twitter)" className="w-9 h-9 rounded-[10px] flex items-center justify-center no-underline transition-transform duration-200 hover:-translate-y-0.5" style={{ background: dark ? "rgba(255,255,255,.06)" : "rgba(0,0,0,.06)", border: `0.5px solid ${border}` }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill={soft}><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
            </a>
            {sl.social_whatsapp && <a href={sl.social_whatsapp} target="_blank" rel="noopener noreferrer" aria-label="WhatsApp" className="w-9 h-9 rounded-[10px] flex items-center justify-center no-underline transition-transform duration-200 hover:-translate-y-0.5" style={{ background: dark ? "rgba(37,211,102,.08)" : "rgba(37,211,102,.08)", border: `0.5px solid ${dark ? "rgba(37,211,102,.18)" : "rgba(37,211,102,.14)"}` }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill={green}><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
            </a>}
            <a href={`https://instagram.com/${sl.social_instagram || "Nitro.ng"}`} target="_blank" rel="noopener noreferrer" aria-label="Instagram" className="w-9 h-9 rounded-[10px] flex items-center justify-center no-underline transition-transform duration-200 hover:-translate-y-0.5" style={{ background: dark ? "rgba(196,125,142,.08)" : "rgba(196,125,142,.08)", border: `0.5px solid ${dark ? "rgba(196,125,142,.18)" : "rgba(196,125,142,.14)"}` }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={accent} strokeWidth="2" strokeLinecap="round"><rect x="2" y="2" width="20" height="20" rx="5"/><path d="M16 11.37A4 4 0 1112.63 8 4 4 0 0116 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/></svg>
            </a>
            {sl.social_telegram && <a href={sl.social_telegram} target="_blank" rel="noopener noreferrer" aria-label="Telegram" className="w-9 h-9 rounded-[10px] flex items-center justify-center no-underline transition-transform duration-200 hover:-translate-y-0.5" style={{ background: dark ? "rgba(0,136,204,.08)" : "rgba(0,136,204,.08)", border: `0.5px solid ${dark ? "rgba(0,136,204,.18)" : "rgba(0,136,204,.14)"}` }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="#0088cc"><path d="M11.944 0A12 12 0 000 12a12 12 0 0012 12 12 12 0 0012-12A12 12 0 0012 0a12 12 0 00-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 01.171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.479.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/></svg>
            </a>}
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="py-3.5 px-6 flex justify-between items-center shrink-0 relative z-10" style={{ borderTop: `0.5px solid ${border}` }}>
        <span className="text-xs" style={{ color: muted }}>&copy; 2026 Nitro</span>
        <div className="flex gap-3.5">
          <a href="/terms" className="text-xs no-underline" style={{ color: muted }}>Terms</a>
          <a href="/privacy" className="text-xs no-underline" style={{ color: muted }}>Privacy</a>
        </div>
      </footer>
    </div>
  );
}

export default function Maintenance() {
  return <ThemeProvider><MaintenanceInner /></ThemeProvider>;
}
