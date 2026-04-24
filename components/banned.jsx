'use client';
import { useState, useEffect } from "react";
import { SITE } from "../lib/site";

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
    redBorder: dark ? "rgba(252,165,165,.19)" : "rgba(220,38,38,.14)",
  };

  return (
    <div className="min-h-dvh flex flex-col relative overflow-hidden" style={{ background: t.bg, fontFamily: "'Outfit',system-ui,sans-serif" }}>

      {/* Ambient glow */}
      <div className="absolute w-[400px] h-[400px] rounded-full blur-[100px] pointer-events-none" style={{ top: "10%", right: "-5%", background: dark ? "rgba(220,38,38,.03)" : "rgba(220,38,38,.015)" }} />
      <div className="absolute w-[300px] h-[300px] rounded-full blur-[80px] pointer-events-none" style={{ bottom: "5%", left: "-5%", background: dark ? "rgba(196,125,142,.03)" : "rgba(196,125,142,.015)" }} />

      {/* Nav */}
      <nav className="flex items-center justify-center px-6 h-14 backdrop-blur-[20px] relative z-10 shrink-0" style={{ borderBottom: `1px solid ${t.cbd}`, background: dark ? "rgba(8,11,20,.8)" : "rgba(244,241,237,.8)" }}>
        <div className="flex items-center gap-2.5">
          <div className="w-[26px] h-[26px] rounded-[7px] flex items-center justify-center" style={{ background: "linear-gradient(135deg,#c47d8e,#8b5e6b)" }}>
            <svg width="11" height="11" viewBox="0 0 20 20" fill="none"><path d="M4,16 L4,4 L16,16 L16,4" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/></svg>
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
                <div className="shrink-0 w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: dark ? "rgba(255,255,255,.03)" : "rgba(0,0,0,.02)" }}>{icon}</div>
                <span className="text-sm leading-[1.4]" style={{ color: t.ts }}>{text}</span>
              </div>
            ))}
          </div>

          {/* Actions */}
          <div className="flex gap-3 justify-center flex-wrap">
            <a href={`mailto:${SITE.email.general}`} className="py-3.5 px-8 rounded-xl text-[15px] font-semibold no-underline flex items-center gap-2 transition-[transform,box-shadow] duration-200 hover:-translate-y-px hover:shadow-[0_6px_20px_rgba(196,125,142,.31)]" style={{ background: "linear-gradient(135deg,#c47d8e,#8b5e6b)", color: "#fff", boxShadow: "0 4px 20px rgba(196,125,142,.3)" }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="2" y="4" width="20" height="16" rx="2"/><polyline points="22,6 12,13 2,6"/></svg>
              Contact Support
            </a>
            <a href="/" className="py-3.5 px-8 rounded-xl text-[15px] font-semibold no-underline" style={{ background: dark ? "rgba(255,255,255,.1)" : "rgba(0,0,0,.06)", color: t.ts, border: `1px solid ${t.cbd}` }}>
              Back to Home
            </a>
          </div>

          <p className="text-[13px] mt-6 leading-[1.5]" style={{ color: t.tm }}>
            Think this is an error? Email us at <a href={`mailto:${SITE.email.general}`} className="no-underline" style={{ color: t.ac }}>{SITE.email.general}</a> with your account email and we'll review it within 24 hours.
          </p>
        </div>
      </div>

      {/* Footer */}
      <footer className="py-3.5 px-6 flex justify-between items-center shrink-0 relative z-10" style={{ borderTop: `1px solid ${t.cbd}` }}>
        <span className="text-sm" style={{ color: t.tm }}>© {new Date().getFullYear() > 2026 ? `2026–${new Date().getFullYear()}` : "2026"} Nitro</span>
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
