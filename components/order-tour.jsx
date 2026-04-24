'use client';
import { useState, useEffect, useCallback, useRef } from "react";

const STEPS = [
  { target: "no-platform-tabs", findFirst: ".no-plat-icon-on, .no-mob-plat-on, .no-plat-icon-btn:first-child, .no-mob-plat-btn:first-child", noScroll: true, title: "Pick a platform", desc: "Choose which platform you want to grow. Instagram, TikTok, YouTube — we support 35+.", icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg> },
  { target: "no-service-list", findFirst: ".no-svc-card", title: "Choose a service", desc: "Browse available services — followers, likes, views, comments, and more. Tap one to select it.", icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M4 6h16M4 12h16M4 18h10"/></svg> },
  { target: "no-tier-select", title: "Select your tier", desc: "Budget is cheapest, Standard is balanced, Premium is highest quality. Pick what fits your needs.", icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26"/></svg>, before: "selectService" },
  { target: "no-link-input", title: "Enter your link & quantity", desc: "Paste your profile or post URL and set how many you want. Minimum varies by service.", icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/></svg>, before: "selectTier" },
  { target: "no-order-bar", title: "Place your order", desc: "Review your selection, tap Order, enter your link and you're done. We start processing immediately.", icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg> },
  { target: "no-mode-toggle", title: "Bulk ordering", desc: "Need multiple orders at once? Switch to Bulk mode — add services to a cart and place them all in one go.", icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="18" rx="2"/><path d="M8 7v10M12 7v10M16 7v10"/></svg>, before: "clearOrder" },
];

function findTarget(s) {
  if (s.findFirst) {
    const el = document.querySelector(s.findFirst);
    if (el && el.offsetParent !== null) return el;
  }
  return document.querySelector(`[data-tour="${s.target}"]`);
}

// Wait for an element to appear in DOM, then call callback
function waitForEl(selector, cb, onTimeout, maxWait = 3000) {
  const start = Date.now();
  const check = () => {
    const el = document.querySelector(selector);
    if (el) { cb(el); return; }
    if (Date.now() - start < maxWait) requestAnimationFrame(check);
    else if (onTimeout) onTimeout();
  };
  check();
}

export default function OrderTour({ dark, onComplete, setSelSvc, setSelTier, setQty }) {
  // Resume from saved progress
  const saved = (() => {
    try { const s = localStorage.getItem("nitro-order-tour-progress"); return s ? JSON.parse(s) : null; } catch { return null; }
  })();
  const [phase, setPhase] = useState(saved?.phase || "welcome");
  const [step, setStep] = useState(saved?.step || 0);
  const [visible, setVisible] = useState(false);
  const [spotRect, setSpotRect] = useState(null);
  const [skipMsg, setSkipMsg] = useState(null);
  const rafRef = useRef(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(true);
      // If resuming mid-tour, re-run auto-selections to reach the saved step
      if (saved?.phase === "touring" && saved.step >= 2) {
        // Need to select service first
        window.dispatchEvent(new CustomEvent("nitro-tour-select-service"));
        if (saved.step >= 3) {
          setTimeout(() => window.dispatchEvent(new CustomEvent("nitro-tour-select-tier")), 800);
        }
      }
    }, 400);
    return () => clearTimeout(timer);
  }, []);

  // Save progress on every step/phase change
  useEffect(() => {
    try { localStorage.setItem("nitro-order-tour-progress", JSON.stringify({ phase, step })); } catch {}
  }, [phase, step]);

  const finish = useCallback(() => {
    setVisible(false);
    try { localStorage.setItem("nitro-order-tour-done", "1"); localStorage.removeItem("nitro-order-tour-progress"); } catch {}
    fetch("/api/auth/tour", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tour: "order" }) }).catch(() => {});
    setSelSvc?.(null);
    setSelTier?.(null);
    setTimeout(() => onComplete?.(), 300);
  }, [onComplete, setSelSvc, setSelTier]);

  const showSkip = (msg) => {
    setSkipMsg(msg);
    setTimeout(() => setSkipMsg(null), 2000);
  };

  const skipToNext = (fromIdx) => {
    if (fromIdx < STEPS.length - 1) {
      showSkip("Skipping step...");
      setTimeout(() => setStep(fromIdx + 1), 500);
    } else {
      showSkip("Finishing tour...");
      setTimeout(() => finish(), 500);
    }
  };

  const startTour = () => {
    setPhase("touring");
    setStep(0);
  };

  const goToStep = (idx) => {
    const s = STEPS[idx];

    if (s.before === "selectService") {
      window.dispatchEvent(new CustomEvent("nitro-tour-select-service"));
      waitForEl(".no-tier-chip", () => {
        setStep(idx);
      }, () => skipToNext(idx));
      return;
    }

    if (s.before === "selectTier") {
      window.dispatchEvent(new CustomEvent("nitro-tour-select-tier"));
      waitForEl('[data-tour="no-link-input"]', () => {
        setStep(idx);
      }, () => skipToNext(idx));
      return;
    }

    if (s.before === "clearOrder") {
      window.dispatchEvent(new CustomEvent("nitro-tour-clear-order"));
      setTimeout(() => setStep(idx), 300);
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

  // Step 5 only: raise the bottom bar above the overlay so it's visible
  useEffect(() => {
    if (phase !== "touring" || !visible || step !== 4) return;
    const timer = setTimeout(() => {
      const bar = document.querySelector(".no-bottom-bar");
      if (bar) bar.style.zIndex = "101";
    }, 200);
    return () => {
      clearTimeout(timer);
      const bar = document.querySelector(".no-bottom-bar");
      if (bar) bar.style.zIndex = "";
    };
  }, [step, phase, visible]);

  // Force re-render on resize so tooltip repositions
  const [, setResize] = useState(0);
  useEffect(() => {
    const handler = () => setResize(n => n + 1);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);

  if (!visible) return null;

  const accent = "#c47d8e";
  const bg = dark ? "#161b2e" : "#ffffff";
  const border = dark ? "rgba(196,125,142,.31)" : "rgba(0,0,0,.14)";
  const text = dark ? "#fff" : "#1a1a1a";
  const sub = dark ? "rgba(255,255,255,0.5)" : "rgba(0,0,0,0.5)";
  const skipC = dark ? "rgba(255,255,255,0.3)" : "rgba(0,0,0,0.3)";
  const dotOff = dark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.1)";
  const pad = 8;
  const sr = spotRect;

  // Position tooltip close to spotlight but not overlapping
  const tooltipPos = (() => {
    if (!sr) return { bottom: 90 };
    const tooltipHeight = 180; // approximate
    const gap = 16;
    const spotBottom = sr.y + sr.h;
    const spotTop = sr.y;
    const spaceBelow = window.innerHeight - spotBottom;
    const spaceAbove = spotTop;

    if (spaceBelow > tooltipHeight + gap + 70) {
      // Place below spotlight
      return { top: spotBottom + gap };
    } else if (spaceAbove > tooltipHeight + gap) {
      // Place above spotlight
      return { bottom: window.innerHeight - spotTop + gap };
    }
    // Fallback — whichever side has more room
    return spaceBelow > spaceAbove ? { top: spotBottom + gap } : { bottom: window.innerHeight - spotTop + gap };
  })();

  return (
    <>
      <style>{`
        @keyframes otFadeIn { from { opacity: 0; transform: translateX(-50%) translateY(8px); } to { opacity: 1; transform: translateX(-50%) translateY(0); } }
        @keyframes otWelcomeFadeIn { from { opacity: 0; transform: translate(-50%, -48%); } to { opacity: 1; transform: translate(-50%, -50%); } }
      `}</style>

      <svg onClick={finish} className="fixed inset-0 w-full h-full z-[100]">
        <defs>
          <mask id="orderTourMask">
            <rect width="100%" height="100%" fill="white" />
            {phase === "touring" && sr && <rect x={sr.x - pad} y={sr.y - pad} width={sr.w + pad * 2} height={sr.h + pad * 2} rx="12" fill="black" />}
          </mask>
        </defs>
        <rect width="100%" height="100%" fill={phase === "welcome" ? "rgba(0,0,0,0.65)" : "rgba(0,0,0,0.5)"} mask="url(#orderTourMask)" />
        {phase === "touring" && sr && <>
          {/* Glow fill pulse */}
          <rect x={sr.x - pad} y={sr.y - pad} width={sr.w + pad * 2} height={sr.h + pad * 2} rx="12" fill={accent} stroke="none">
            <animate attributeName="opacity" values="0.15;0.05;0.15" dur="1.4s" repeatCount="indefinite" />
          </rect>
          {/* Solid inner ring */}
          <rect x={sr.x - pad} y={sr.y - pad} width={sr.w + pad * 2} height={sr.h + pad * 2} rx="12" fill="none" stroke={accent} strokeWidth="3" opacity="0.9" />
          {/* Expanding outer pulse ring */}
          <rect x={sr.x - pad - 4} y={sr.y - pad - 4} width={sr.w + pad * 2 + 8} height={sr.h + pad * 2 + 8} rx="16" fill="none" stroke={accent} strokeWidth="3">
            <animate attributeName="stroke-width" values="3;14" dur="1.4s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="0.7;0" dur="1.4s" repeatCount="indefinite" />
          </rect>
        </>}
      </svg>

      {/* WELCOME */}
      {phase === "welcome" && (
        <div className="fixed z-[101] top-1/2 left-1/2 text-center rounded-2xl pt-7 px-7 pb-6 max-w-[360px] w-[calc(100%-32px)]" style={{
          transform: "translate(-50%, -50%)",
          background: bg, border: `1.5px solid ${border}`,
          boxShadow: dark ? "0 12px 40px rgba(0,0,0,0.5)" : "0 12px 40px rgba(0,0,0,0.12)",
          animation: "otWelcomeFadeIn 0.3s ease",
        }}>
          <div className="w-11 h-11 rounded-xl flex items-center justify-center mx-auto mb-3.5" style={{ background: dark ? "rgba(196,125,142,0.1)" : "rgba(196,125,142,0.06)", color: accent }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14"/></svg>
          </div>
          <div className="text-lg font-bold mb-1.5" style={{ color: text }}>Ready to place an order?</div>
          <div className="text-[13px] leading-[1.6] mb-[22px]" style={{ color: sub }}>We'll walk you through the process. Takes about 15 seconds.</div>
          <div className="flex flex-col gap-2">
            <button onClick={startTour} className="py-[11px] px-0 rounded-[10px] text-sm font-semibold border-none cursor-pointer font-[inherit] w-full transition-transform duration-200 hover:-translate-y-px" style={{ background: accent, color: "#fff" }}>Show me</button>
            <button onClick={finish} className="py-[9px] px-0 rounded-[10px] text-[13px] font-medium bg-transparent border-none cursor-pointer font-[inherit] transition-transform duration-200 hover:-translate-y-px" style={{ color: skipC }}>I know how</button>
          </div>
        </div>
      )}

      {/* TOUR STEP */}
      {phase === "touring" && (
        <div data-tour-tooltip className="fixed z-[101] left-1/2 rounded-[14px] py-[18px] px-5 max-w-[340px] w-[calc(100%-32px)]" style={{
          ...tooltipPos,
          transform: "translateX(-50%)", animation: "otFadeIn 0.3s ease",
          background: bg, border: `1.5px solid ${border}`,
          boxShadow: dark ? "0 12px 40px rgba(0,0,0,0.5)" : "0 12px 40px rgba(0,0,0,0.12)",
        }}>
          <div className="flex items-center gap-2 mb-2.5">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: dark ? "rgba(196,125,142,0.1)" : "rgba(196,125,142,0.06)", color: accent }}>{STEPS[step].icon}</div>
            <span className="text-[10px] font-bold tracking-[1.5px] uppercase" style={{ color: accent }}>Step {step + 1} of {STEPS.length}</span>
          </div>
          <div className="text-base font-bold mb-[5px]" style={{ color: text }}>{STEPS[step].title}</div>
          <div className="text-xs leading-[1.6] mb-4" style={{ color: sub }}>{STEPS[step].desc}</div>
          <div className="flex items-center justify-between">
            <div className="flex gap-1">
              {STEPS.map((_, i) => (
                <div key={i} className="w-1.5 h-1.5 rounded-full" style={{ background: i === step ? accent : i < step ? (dark ? "rgba(196,125,142,0.3)" : "rgba(196,125,142,0.2)") : dotOff }} />
              ))}
            </div>
            <div className="flex items-center gap-3">
              <button onClick={finish} className="bg-transparent border-none text-[11px] font-medium cursor-pointer font-[inherit] p-0 transition-transform duration-200 hover:-translate-y-px" style={{ color: skipC }}>Skip</button>
              <button onClick={next} className="py-[7px] px-5 rounded-[7px] text-xs font-semibold border-none cursor-pointer font-[inherit] transition-transform duration-200 hover:-translate-y-px" style={{ background: accent, color: "#fff" }}>
                {step === STEPS.length - 1 ? "Got it!" : "Next"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Skip message */}
      {skipMsg && (
        <div className="fixed z-[102] top-5 left-1/2 -translate-x-1/2 py-2 px-[18px] rounded-[10px] text-[13px] font-medium backdrop-blur-[8px]" style={{ background: dark ? "rgba(17,22,40,.95)" : "rgba(255,255,255,.95)", border: `1px solid ${dark ? "rgba(255,255,255,.18)" : "rgba(0,0,0,.14)"}`, color: dark ? "rgba(255,255,255,.6)" : "rgba(0,0,0,.5)" }}>{skipMsg}</div>
      )}
    </>
  );
}

export function shouldShowOrderTour() {
  if (typeof window === "undefined") return false;
  try { return !localStorage.getItem("nitro-order-tour-done"); } catch { return false; }
}
