'use client';
import { useState, useEffect, useCallback, useRef } from "react";

const STEPS = [
  { target: "no-platform-tabs", findFirst: ".no-plat-icon-on, .no-mob-plat-on, .no-plat-icon-btn:first-child, .no-mob-plat-btn:first-child", noScroll: true, title: "Pick a platform", desc: "Choose which platform you want to grow. Instagram, TikTok, YouTube — we support 35+.", icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg> },
  { target: "no-service-list", title: "Choose a service", desc: "Browse available services — followers, likes, views, comments, and more. Tap one to select it.", icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M4 6h16M4 12h16M4 18h10"/></svg> },
  { target: "no-tier-select", title: "Select your tier", desc: "Budget is cheapest, Standard is balanced, Premium is highest quality. Pick what fits your needs.", icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26"/></svg> },
  { target: "no-link-input", title: "Enter your link & quantity", desc: "Paste your profile or post URL and set how many you want. Minimum varies by service.", icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/></svg> },
  { target: "no-submit-btn", title: "Place your order", desc: "Review the total, hit the button, and you're done. We start processing immediately.", icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg> },
];

function findTarget(s) {
  // For platform step, find the first visible platform button
  if (s.findFirst) {
    const el = document.querySelector(s.findFirst);
    if (el && el.offsetParent !== null) return el;
  }
  // Fallback to data-tour attribute
  return document.querySelector(`[data-tour="${s.target}"]`);
}

export default function OrderTour({ dark, onComplete }) {
  const [step, setStep] = useState(0);
  const [visible, setVisible] = useState(false);
  const [spotRect, setSpotRect] = useState(null);
  const rafRef = useRef(null);

  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), 400);
    return () => clearTimeout(timer);
  }, []);

  const finish = useCallback(() => {
    setVisible(false);
    try { localStorage.setItem("nitro-order-tour-done", "1"); } catch {}
    setTimeout(() => onComplete?.(), 300);
  }, [onComplete]);

  const next = () => {
    if (step < STEPS.length - 1) setStep(step + 1);
    else finish();
  };

  // Track target element position
  useEffect(() => {
    if (!visible) { setSpotRect(null); return; }
    const update = () => {
      const el = findTarget(STEPS[step]);
      if (el) {
        const r = el.getBoundingClientRect();
        setSpotRect({ x: r.left, y: r.top, w: r.width, h: r.height });
      } else {
        setSpotRect(null);
      }
      rafRef.current = requestAnimationFrame(update);
    };
    const timer = setTimeout(update, 150);
    return () => { clearTimeout(timer); if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [step, visible]);

  // Scroll target into view (skip for noScroll steps)
  useEffect(() => {
    if (!visible || STEPS[step].noScroll) return;
    const timer = setTimeout(() => {
      const el = findTarget(STEPS[step]);
      if (el) {
        const r = el.getBoundingClientRect();
        const inView = r.top >= 0 && r.bottom <= window.innerHeight - 160;
        if (!inView) el.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }, 100);
    return () => clearTimeout(timer);
  }, [step, visible]);

  if (!visible) return null;

  const accent = "#c47d8e";
  const bg = dark ? "#161b2e" : "#ffffff";
  const border = dark ? "rgba(196,125,142,0.25)" : "rgba(0,0,0,0.08)";
  const text = dark ? "#fff" : "#1a1a1a";
  const sub = dark ? "rgba(255,255,255,0.5)" : "rgba(0,0,0,0.5)";
  const skipC = dark ? "rgba(255,255,255,0.3)" : "rgba(0,0,0,0.3)";
  const dotOff = dark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.1)";
  const pad = 8;
  const sr = spotRect;

  return (
    <>
      <style>{`@keyframes otFadeIn { from { opacity: 0; transform: translateX(-50%) translateY(8px); } to { opacity: 1; transform: translateX(-50%) translateY(0); } }`}</style>

      {/* SVG overlay with spotlight */}
      <svg onClick={finish} style={{ position: "fixed", inset: 0, width: "100%", height: "100%", zIndex: 60 }}>
        <defs>
          <mask id="orderTourMask">
            <rect width="100%" height="100%" fill="white" />
            {sr && <rect x={sr.x - pad} y={sr.y - pad} width={sr.w + pad * 2} height={sr.h + pad * 2} rx="12" fill="black" />}
          </mask>
        </defs>
        <rect width="100%" height="100%" fill="rgba(0,0,0,0.5)" mask="url(#orderTourMask)" />
        {sr && (
          <rect x={sr.x - pad} y={sr.y - pad} width={sr.w + pad * 2} height={sr.h + pad * 2} rx="12" fill="none" stroke={accent} strokeWidth="2.5">
            <animate attributeName="opacity" values="0.3;0.8;0.3" dur="2s" repeatCount="indefinite" />
          </rect>
        )}
      </svg>

      {/* Tooltip */}
      <div style={{
        position: "fixed", zIndex: 61, left: "50%", bottom: 90,
        transform: "translateX(-50%)", animation: "otFadeIn 0.3s ease",
        background: bg, border: `1.5px solid ${border}`, borderRadius: 14,
        padding: "18px 20px", maxWidth: 340, width: "calc(100% - 32px)",
        boxShadow: dark ? "0 12px 40px rgba(0,0,0,0.5)" : "0 12px 40px rgba(0,0,0,0.12)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: dark ? "rgba(196,125,142,0.1)" : "rgba(196,125,142,0.06)", display: "flex", alignItems: "center", justifyContent: "center", color: accent }}>{STEPS[step].icon}</div>
          <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", color: accent }}>Step {step + 1} of {STEPS.length}</span>
        </div>
        <div style={{ fontSize: 16, fontWeight: 700, color: text, marginBottom: 5 }}>{STEPS[step].title}</div>
        <div style={{ fontSize: 12, lineHeight: 1.6, color: sub, marginBottom: 16 }}>{STEPS[step].desc}</div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", gap: 4 }}>
            {STEPS.map((_, i) => (
              <div key={i} style={{ width: 6, height: 6, borderRadius: "50%", background: i === step ? accent : i < step ? (dark ? "rgba(196,125,142,0.3)" : "rgba(196,125,142,0.2)") : dotOff }} />
            ))}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button onClick={finish} style={{ background: "none", border: "none", fontSize: 11, fontWeight: 500, color: skipC, cursor: "pointer", fontFamily: "inherit", padding: 0 }}>Skip</button>
            <button onClick={next} style={{ padding: "7px 20px", borderRadius: 7, fontSize: 12, fontWeight: 600, background: accent, color: "#fff", border: "none", cursor: "pointer", fontFamily: "inherit" }}>
              {step === STEPS.length - 1 ? "Got it!" : "Next"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

export function shouldShowOrderTour() {
  if (typeof window === "undefined") return false;
  try { return !localStorage.getItem("nitro-order-tour-done"); } catch { return false; }
}
