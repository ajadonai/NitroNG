'use client';
import { useState, useEffect, useCallback, useRef } from "react";

const STEPS = [
  { target: "no-platform-tabs", findFirst: ".no-plat-icon-on, .no-mob-plat-on, .no-plat-icon-btn:first-child, .no-mob-plat-btn:first-child", noScroll: true, title: "Pick a platform", desc: "Choose which platform you want to grow. Instagram, TikTok, YouTube — we support 35+.", icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg> },
  { target: "no-service-list", findFirst: ".no-svc-card", title: "Choose a service", desc: "Browse available services — followers, likes, views, comments, and more. Tap one to select it.", icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M4 6h16M4 12h16M4 18h10"/></svg> },
  { target: "no-tier-select", title: "Select your tier", desc: "Budget is cheapest, Standard is balanced, Premium is highest quality. Pick what fits your needs.", icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26"/></svg>, before: "selectService" },
  { target: "no-link-input", title: "Enter your link & quantity", desc: "Paste your profile or post URL and set how many you want. Minimum varies by service.", icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/></svg>, before: "selectTier" },
  { target: "no-submit-btn", title: "Place your order", desc: "Review the total, hit the button, and you're done. We start processing immediately.", icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg> },
];

function findTarget(s) {
  if (s.findFirst) {
    const el = document.querySelector(s.findFirst);
    if (el && el.offsetParent !== null) return el;
  }
  return document.querySelector(`[data-tour="${s.target}"]`);
}

// Wait for an element to appear in DOM, then call callback
function waitForEl(selector, cb, maxWait = 3000) {
  const start = Date.now();
  const check = () => {
    const el = document.querySelector(selector);
    if (el) { cb(el); return; }
    if (Date.now() - start < maxWait) requestAnimationFrame(check);
  };
  check();
}

export default function OrderTour({ dark, onComplete, setSelSvc, setSelTier, setQty }) {
  const [phase, setPhase] = useState("welcome");
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
    setSelSvc?.(null);
    setSelTier?.(null);
    setTimeout(() => onComplete?.(), 300);
  }, [onComplete, setSelSvc, setSelTier]);

  const startTour = () => {
    setPhase("touring");
    setStep(0);
  };

  const goToStep = (idx) => {
    const s = STEPS[idx];

    if (s.before === "selectService") {
      window.dispatchEvent(new CustomEvent("nitro-tour-select-service"));
      // Wait for tier chips to render
      waitForEl(".no-tier-chip", () => {
        setStep(idx);
      });
      return;
    }

    if (s.before === "selectTier") {
      window.dispatchEvent(new CustomEvent("nitro-tour-select-tier"));
      // Wait for form to appear
      waitForEl('[data-tour="no-link-input"]', () => {
        setStep(idx);
      });
      return;
    }

    setStep(idx);
  };

  const next = () => {
    const nextIdx = step + 1;
    if (nextIdx >= STEPS.length) { finish(); return; }
    goToStep(nextIdx);
  };

  // Track target element position
  useEffect(() => {
    if (phase !== "touring" || !visible) { setSpotRect(null); return; }

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

    const timer = setTimeout(update, 300);
    return () => { clearTimeout(timer); if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [step, phase, visible]);

  // Scroll target into view
  useEffect(() => {
    if (phase !== "touring" || !visible || STEPS[step].noScroll) return;
    const timer = setTimeout(() => {
      const el = findTarget(STEPS[step]);
      if (el) {
        const r = el.getBoundingClientRect();
        const inView = r.top >= 60 && r.bottom <= window.innerHeight - 180;
        if (!inView) el.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [step, phase, visible]);

  // Highlight "Order" tab on bottom nav
  useEffect(() => {
    if (!visible || phase !== "touring") return;
    const tab = document.querySelector('[data-tab="services"]');
    if (tab) tab.classList.add("tour-nav-ring");
    return () => { if (tab) tab.classList.remove("tour-nav-ring"); };
  }, [visible, phase]);

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
      <style>{`
        @keyframes otFadeIn { from { opacity: 0; transform: translateX(-50%) translateY(8px); } to { opacity: 1; transform: translateX(-50%) translateY(0); } }
        @keyframes otWelcomeFadeIn { from { opacity: 0; transform: translate(-50%, -48%); } to { opacity: 1; transform: translate(-50%, -50%); } }
      `}</style>

      <svg onClick={finish} style={{ position: "fixed", inset: 0, width: "100%", height: "100%", zIndex: 100 }}>
        <defs>
          <mask id="orderTourMask">
            <rect width="100%" height="100%" fill="white" />
            {phase === "touring" && sr && <rect x={sr.x - pad} y={sr.y - pad} width={sr.w + pad * 2} height={sr.h + pad * 2} rx="12" fill="black" />}
          </mask>
        </defs>
        <rect width="100%" height="100%" fill={phase === "welcome" ? "rgba(0,0,0,0.65)" : "rgba(0,0,0,0.5)"} mask="url(#orderTourMask)" />
        {phase === "touring" && sr && (
          <rect x={sr.x - pad} y={sr.y - pad} width={sr.w + pad * 2} height={sr.h + pad * 2} rx="12" fill="none" stroke={accent} strokeWidth="2.5">
            <animate attributeName="opacity" values="0.3;0.8;0.3" dur="2s" repeatCount="indefinite" />
          </rect>
        )}
      </svg>

      {/* WELCOME */}
      {phase === "welcome" && (
        <div style={{
          position: "fixed", zIndex: 101, top: "50%", left: "50%",
          transform: "translate(-50%, -50%)", textAlign: "center",
          background: bg, border: `1.5px solid ${border}`, borderRadius: 16,
          padding: "28px 28px 24px", maxWidth: 360, width: "calc(100% - 32px)",
          boxShadow: dark ? "0 12px 40px rgba(0,0,0,0.5)" : "0 12px 40px rgba(0,0,0,0.12)",
          animation: "otWelcomeFadeIn 0.3s ease",
        }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: dark ? "rgba(196,125,142,0.1)" : "rgba(196,125,142,0.06)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px", color: accent }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14"/></svg>
          </div>
          <div style={{ fontSize: 18, fontWeight: 700, color: text, marginBottom: 6 }}>Ready to place an order?</div>
          <div style={{ fontSize: 13, lineHeight: 1.6, color: sub, marginBottom: 22 }}>We'll walk you through the process. Takes about 15 seconds.</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <button onClick={startTour} style={{ padding: "11px 0", borderRadius: 10, fontSize: 14, fontWeight: 600, background: accent, color: "#fff", border: "none", cursor: "pointer", fontFamily: "inherit", width: "100%" }}>Show me</button>
            <button onClick={finish} style={{ padding: "9px 0", borderRadius: 10, fontSize: 13, fontWeight: 500, background: "none", color: skipC, border: "none", cursor: "pointer", fontFamily: "inherit" }}>I know how</button>
          </div>
        </div>
      )}

      {/* TOUR STEP */}
      {phase === "touring" && (
        <div style={{
          position: "fixed", zIndex: 101, left: "50%", bottom: 90,
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
      )}
    </>
  );
}

export function shouldShowOrderTour() {
  if (typeof window === "undefined") return false;
  try { return !localStorage.getItem("nitro-order-tour-done"); } catch { return false; }
}
