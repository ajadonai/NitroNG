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
    tm: dark ? "#8a8580" : "#757170",
    ac: "#c47d8e",
    cbd: dark ? "rgba(255,255,255,.09)" : "rgba(0,0,0,.06)",
    red: dark ? "#fca5a5" : "#dc2626",
    redSoft: dark ? "rgba(252,165,165,.08)" : "rgba(220,38,38,.03)",
    redBorder: dark ? "rgba(252,165,165,.19)" : "rgba(220,38,38,.14)",
  };

  return (
    <div className="min-h-dvh flex flex-col relative overflow-hidden" style={{ background: t.bg, fontFamily: "'Plus Jakarta Sans',system-ui,sans-serif" }}>

      {/* Ambient glow */}
      <div className="absolute w-[400px] h-[400px] rounded-full blur-[100px] pointer-events-none" style={{ top: "10%", right: "-5%", background: dark ? "rgba(220,38,38,.03)" : "rgba(220,38,38,.015)" }} />
      <div className="absolute w-[300px] h-[300px] rounded-full blur-[80px] pointer-events-none" style={{ bottom: "5%", left: "-5%", background: dark ? "rgba(196,125,142,.03)" : "rgba(196,125,142,.015)" }} />

      {/* Nav */}
      <nav className="flex items-center justify-center px-6 h-14 backdrop-blur-[20px] relative z-10 shrink-0" style={{ borderBottom: `1px solid ${t.cbd}`, background: dark ? "rgba(8,11,20,.8)" : "rgba(244,241,237,.8)" }}>
        <div className="flex items-center gap-2.5">
          <div className="w-[26px] h-[26px] rounded-[7px] flex items-center justify-center" style={{ background: "linear-gradient(135deg,#c47d8e,#8b5e6b)" }}>
            <svg width="10" height="11" viewBox="0 0 1601 1785" fill="#fff"><path d="M1600.82 160.089V1313c-.85 53.13-10.35 104.17-27.19 151.74-48.19 136.54-156.38 244.73-292.92 292.92-50.12 17.76-103.94 27.34-160.08 27.34 0 0-79.39 0-160.01-27.34-85.1-28.88-155.38-85.49-208.28-141.55-72.59-76.84-112.13-179.09-112.13-284.74V1023.4v-3.08-12.9c.08-1.39.08-2.7.08-4.17 0-1.39 0-2.7-.08-4.09-2.08-84.64-69.97-153.06-154.53-155.84-1.85-.08-3.71-.15-5.48-.15-1.78 0-3.71.08-5.48.15-84.56 2.78-152.44 71.2-154.61 155.84-.08 1.39-.08 2.7-.08 4.09 0 1.47 0 2.78.08 4.17v534.87c0 88.42-71.67 160.09-160.09 160.09-44.17 0-84.25-17.92-113.21-46.88C17.92 1626.84 0 1586.76 0 1542.59V995.288c.927-53.132 10.426-104.178 27.261-151.672C75.45 707.003 183.643 598.81 320.179 550.621c50.119-17.685 103.946-27.338 160.089-27.338 0 0 79.388 0 160.012 27.338 85.103 28.882 155.379 85.489 208.278 141.555 72.593 76.84 112.132 179.087 112.132 284.732v307.972l-.077.92v12.89c-.077 1.39-.077 2.78-.077 4.17 0 1.39 0 2.7.077 4.17 2.085 84.64 69.967 152.99 154.527 155.84 1.86 0 3.71 0 5.49 0 1.77 0 3.7 0 5.48 0 84.56-2.85 152.44-71.2 154.6-155.84V160.089C1280.71 71.666 1352.38 0 1440.8 0c44.18 0 84.18 17.916 113.14 46.876 28.96 28.96 46.88 69.04 46.88 113.213z"/></svg>
          </div>
          <span className="text-base font-semibold tracking-[1.5px]" style={{ color: t.tx }}>NITRO</span>
        </div>
      </nav>

      {/* Main */}
      <div className="flex-1 flex items-center justify-center relative z-[1]">
        <div className="text-center p-6 max-w-[480px]" style={{ opacity: mounted ? 1 : 0, transform: mounted ? "translateY(0)" : "translateY(12px)", transition: "opacity .5s ease, transform .5s ease" }}>

          {/* Icon — lock with pulse ring */}
          <div className="relative w-[88px] h-[88px] mx-auto mb-7">
            <div className="absolute inset-0 rounded-full" style={{ border: `2px solid ${t.redBorder}`, animation: "banned-pulse 2.5s ease-in-out infinite" }} />
            <div className="w-[88px] h-[88px] rounded-full flex items-center justify-center" style={{ background: t.redSoft }}>
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke={t.red} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                <path d="M7 11V7a5 5 0 0110 0v4"/>
                <circle cx="12" cy="16" r="1"/>
              </svg>
            </div>
          </div>

          <h1 className="font-bold mb-2.5 leading-[1.1]" style={{ fontSize: "clamp(28px, 5vw, 38px)", color: t.tx, fontFamily: "'Cormorant Garamond',serif" }}>
            Account Suspended
          </h1>
          <p className="text-base leading-[1.7] max-w-[380px] mx-auto mb-8" style={{ color: t.ts }}>
            Your account has been suspended for violating our Terms of Service. If you believe this was a mistake, reach out to our support team.
          </p>

          {/* Info card */}
          <div className="rounded-2xl py-5 px-6 text-left max-w-[380px] mx-auto mb-8" style={{ background: t.redSoft, border: `1px solid ${t.redBorder}` }}>
            <div className="text-xs font-semibold mb-3.5 uppercase tracking-[1.5px]" style={{ color: t.red }}>What this means</div>
            {[
              ["Dashboard and services are inaccessible", <svg key="1" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={t.red} strokeWidth="1.5" strokeLinecap="round"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="9" y1="9" x2="15" y2="15"/><line x1="15" y1="9" x2="9" y2="15"/></svg>],
              ["Your wallet balance is frozen", <svg key="2" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={t.red} strokeWidth="1.5" strokeLinecap="round"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>],
              ["Active orders will still complete delivery", <svg key="3" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={dark ? "#6ee7b7" : "#059669"} strokeWidth="1.5" strokeLinecap="round"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>],
            ].map(([text, icon], i) => (
              <div key={i} className="flex items-center gap-3 py-2" style={{ borderTop: i > 0 ? `1px solid ${dark ? "rgba(252,165,165,.12)" : "rgba(220,38,38,.08)"}` : "none" }}>
                <div className="shrink-0 w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: dark ? "rgba(255,255,255,.05)" : "rgba(0,0,0,.02)" }}>{icon}</div>
                <span className="text-sm leading-[1.4]" style={{ color: t.ts }}>{text}</span>
              </div>
            ))}
          </div>

          {/* Actions */}
          <div className="flex gap-3 justify-center flex-wrap">
            <a href="https://wa.me/2347071656156?text=Hi%20*Nitro*%2C%20I%20need%20help" target="_blank" rel="noopener noreferrer" className="py-3.5 px-8 rounded-xl text-[15px] font-semibold no-underline flex items-center gap-2 transition-[transform,box-shadow] duration-200 hover:-translate-y-px hover:shadow-[0_6px_20px_rgba(37,211,102,.31)]" style={{ background: "linear-gradient(135deg,#25D366,#128C7E)", color: "#fff", boxShadow: "0 4px 20px rgba(37,211,102,.3)" }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
              Chat on WhatsApp
            </a>
            <a href="/" className="py-3.5 px-8 rounded-xl text-[15px] font-semibold no-underline" style={{ background: dark ? "rgba(255,255,255,.14)" : "rgba(0,0,0,.06)", color: t.ts, border: `1px solid ${t.cbd}` }}>
              Back to Home
            </a>
          </div>

          <p className="text-[13px] mt-6 leading-[1.5]" style={{ color: t.tm }}>
            Think this is an error? Message us on <a href="https://wa.me/2347071656156?text=Hi%20*Nitro*%2C%20I%20need%20help" target="_blank" rel="noopener noreferrer" className="no-underline" style={{ color: t.ac }}>WhatsApp</a> with your account email and we'll review it within 24 hours.
          </p>
        </div>
      </div>

      {/* Footer */}
      <footer className="py-3.5 px-6 flex justify-between items-center shrink-0 relative z-10" style={{ borderTop: `1px solid ${t.cbd}` }}>
        <span className="text-sm" style={{ color: t.tm }}>© {new Date().getFullYear() > 2025 ? `2025–${new Date().getFullYear()}` : "2025"} Nitro</span>
        <div className="flex gap-4">
          <a href="/terms" className="text-sm no-underline" style={{ color: t.tm }}>Terms</a>
          <a href="/privacy" className="text-sm no-underline" style={{ color: t.tm }}>Privacy</a>
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
