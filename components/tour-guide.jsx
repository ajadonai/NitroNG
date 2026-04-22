'use client';
import { useState, useEffect, useCallback, useRef } from "react";

const STEPS = [
  {
    page: "add-funds",
    sidebarId: "add-funds",
    bottomId: "add-funds",
    title: "Fund your wallet",
    desc: "This is where you add money to your account. We support bank transfers and card payments.",
    icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M2 10h20"/><circle cx="16" cy="15" r="1.5"/></svg>,
  },
  {
    page: "services",
    sidebarId: "services",
    bottomId: "services",
    title: "Browse & order",
    desc: "Pick a platform, choose your service tier, enter your link and quantity — and place your order.",
    icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14"/></svg>,
  },
  {
    page: "orders",
    sidebarId: "orders",
    bottomId: "orders",
    title: "Track your orders",
    desc: "All your orders show up here with real-time status updates. Processing starts within seconds.",
    icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>,
  },
  {
    page: "support",
    sidebarId: "support",
    bottomId: "more",
    mobileAction: "openMore",
    title: "Need help?",
    desc: "Our support team is here for you. Create a ticket anytime — we respond fast.",
    icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>,
  },
];

export default function TourGuide({ dark, onComplete, onNavigate, onOpenMore }) {
  // Resume from saved progress
  const saved = (() => {
    try { const s = localStorage.getItem("nitro-tour-progress"); return s ? JSON.parse(s) : null; } catch { return null; }
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
      // If resuming mid-tour, navigate to the current step's page
      if (saved?.phase === "touring") goToStep(saved.step);
    }, 500);
    return () => clearTimeout(timer);
  }, []);

  // Save progress on every step/phase change
  useEffect(() => {
    try { localStorage.setItem("nitro-tour-progress", JSON.stringify({ phase, step })); } catch {}
  }, [phase, step]);

  const finish = useCallback(() => {
    setVisible(false);
    try { localStorage.setItem("nitro-tour-done", "1"); localStorage.removeItem("nitro-tour-progress"); } catch {}
    fetch("/api/auth/tour", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tour: "nav" }) }).catch(() => {});
    onNavigate?.("overview");
    setTimeout(() => onComplete?.(), 300);
  }, [onComplete, onNavigate]);

  const isMobile = () => typeof window !== "undefined" && window.innerWidth < 1200;

  const goToStep = (idx) => {
    const s = STEPS[idx];
    if (isMobile() && s.mobileAction === "openMore") {
      onOpenMore?.();
    } else {
      onNavigate?.(s.page);
    }
  };

  const startTour = () => {
    setPhase("touring");
    setStep(0);
    goToStep(0);
  };

  const next = () => {
    if (step < STEPS.length - 1) {
      const nextIdx = step + 1;
      setStep(nextIdx);
      goToStep(nextIdx);
    } else {
      finish();
    }
  };

  // Track spotlight target
  useEffect(() => {
    if (phase !== "touring" || !visible) { setSpotRect(null); return; }

    const updateRect = () => {
      const s = STEPS[step];
      const mobile = isMobile();
      let el = null;

      if (mobile) {
        if (s.mobileAction === "openMore") {
          // ALWAYS spotlight Support inside the popup, not the More button
          el = [...document.querySelectorAll(".dash-more-item")].find(e => e.textContent?.includes("Support"));
        } else {
          el = document.querySelector(`[data-tab="${s.bottomId}"]`);
        }
      } else {
        el = document.querySelector(`[data-nav="${s.sidebarId}"]`);
      }

      if (el) {
        const r = el.getBoundingClientRect();
        setSpotRect({ x: r.left, y: r.top, w: r.width, h: r.height });
      } else {
        setSpotRect(null);
      }
      rafRef.current = requestAnimationFrame(updateRect);
    };

    const timer = setTimeout(updateRect, 300);
    return () => { clearTimeout(timer); if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [step, phase, visible]);

  // During support step on mobile: raise More popup and its overlay above tour overlay
  useEffect(() => {
    if (phase !== "touring" || !visible) return;
    const s = STEPS[step];
    const mobile = isMobile();
    if (mobile && s.mobileAction === "openMore") {
      const popup = document.querySelector(".dash-more-popup");
      const overlay = document.querySelector(".dash-more-overlay");
      if (popup) popup.style.zIndex = "101";
      if (overlay) overlay.style.zIndex = "99";
      return () => {
        if (popup) popup.style.zIndex = "";
        if (overlay) overlay.style.zIndex = "";
      };
    }
  }, [step, phase, visible]);

  // Highlight current step's bottom nav tab with ring
  // For support step: give More an active color but ring goes on Support inside popup
  useEffect(() => {
    if (phase !== "touring" || !visible) return;
    const s = STEPS[step];
    const mobile = isMobile();

    if (mobile && s.mobileAction === "openMore") {
      // More button gets active color only (no ring)
      const moreTab = document.querySelector('[data-tab="more"]');
      if (moreTab) moreTab.classList.add("active");
      // Support item gets ring
      const timer = setTimeout(() => {
        const supportItem = [...document.querySelectorAll(".dash-more-item")].find(e => e.textContent?.includes("Support"));
        if (supportItem) supportItem.classList.add("tour-nav-ring");
      }, 200);
      return () => {
        clearTimeout(timer);
        if (moreTab) moreTab.classList.remove("active");
        const supportItem = [...document.querySelectorAll(".dash-more-item")].find(e => e.textContent?.includes("Support"));
        if (supportItem) supportItem.classList.remove("tour-nav-ring");
      };
    } else {
      const tab = document.querySelector(`[data-tab="${s.bottomId}"]`);
      if (tab) tab.classList.add("tour-nav-ring");
      return () => { if (tab) tab.classList.remove("tour-nav-ring"); };
    }
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
  const border = dark ? "rgba(196,125,142,0.25)" : "rgba(0,0,0,0.08)";
  const text = dark ? "#fff" : "#1a1a1a";
  const sub = dark ? "rgba(255,255,255,0.5)" : "rgba(0,0,0,0.5)";
  const skipC = dark ? "rgba(255,255,255,0.3)" : "rgba(0,0,0,0.3)";
  const dotOff = dark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.1)";
  const pad = 6;
  const sr = spotRect;

  const isSupportStep = STEPS[step]?.mobileAction === "openMore" && isMobile();

  // Position tooltip close to spotlight but not overlapping
  const tooltipPos = (() => {
    if (isSupportStep) return { top: 20 };
    if (!sr) return { bottom: 90 };
    const tooltipHeight = 200;
    const gap = 16;
    const spotBottom = sr.y + sr.h;
    const spotTop = sr.y;
    const spaceBelow = window.innerHeight - spotBottom;
    const spaceAbove = spotTop;

    if (spaceBelow > tooltipHeight + gap + 70) {
      return { top: spotBottom + gap };
    } else if (spaceAbove > tooltipHeight + gap) {
      return { bottom: window.innerHeight - spotTop + gap };
    }
    return spaceBelow > spaceAbove ? { top: spotBottom + gap } : { bottom: window.innerHeight - spotTop + gap };
  })();

  return (
    <>
      <style>{`
        @keyframes tourFadeIn { from { opacity: 0; transform: translateX(-50%) translateY(8px); } to { opacity: 1; transform: translateX(-50%) translateY(0); } }
        @keyframes tourWelcomeFadeIn { from { opacity: 0; transform: translate(-50%, -48%); } to { opacity: 1; transform: translate(-50%, -50%); } }
      `}</style>

      {/* SVG overlay — z-index 100 to sit above bottom nav (90) */}
      <svg onClick={finish} className="fixed inset-0 w-full h-full z-[100]">
        <defs>
          <mask id="tourSpotMask">
            <rect width="100%" height="100%" fill="white" />
            {phase === "touring" && sr && (
              <rect x={sr.x - pad} y={sr.y - pad} width={sr.w + pad * 2} height={sr.h + pad * 2} rx="10" fill="black" />
            )}
          </mask>
        </defs>
        <rect width="100%" height="100%" fill={phase === "welcome" ? "rgba(0,0,0,0.65)" : "rgba(0,0,0,0.55)"} mask="url(#tourSpotMask)" />
        {phase === "touring" && sr && <>
          {/* Glow fill pulse */}
          <rect x={sr.x - pad} y={sr.y - pad} width={sr.w + pad * 2} height={sr.h + pad * 2} rx="10" fill={accent} stroke="none">
            <animate attributeName="opacity" values="0.15;0.05;0.15" dur="1.4s" repeatCount="indefinite" />
          </rect>
          {/* Solid inner ring */}
          <rect x={sr.x - pad} y={sr.y - pad} width={sr.w + pad * 2} height={sr.h + pad * 2} rx="10" fill="none" stroke={accent} strokeWidth="3" opacity="0.9" />
          {/* Expanding outer pulse ring */}
          <rect x={sr.x - pad - 4} y={sr.y - pad - 4} width={sr.w + pad * 2 + 8} height={sr.h + pad * 2 + 8} rx="14" fill="none" stroke={accent} strokeWidth="3">
            <animate attributeName="stroke-width" values="3;14" dur="1.4s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="0.7;0" dur="1.4s" repeatCount="indefinite" />
          </rect>
        </>}
      </svg>

      {/* WELCOME */}
      {phase === "welcome" && (
        <div className="fixed z-[101] top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center rounded-2xl pt-7 px-7 pb-6 max-w-[360px] w-[calc(100%-32px)]" style={{
          background: bg, border: `1.5px solid ${border}`,
          boxShadow: dark ? "0 12px 40px rgba(0,0,0,0.5)" : "0 12px 40px rgba(0,0,0,0.12)",
          animation: "tourWelcomeFadeIn 0.3s ease",
        }}>
          <div className="w-12 h-12 rounded-[14px] flex items-center justify-center mx-auto mb-4 text-[22px] font-bold text-white" style={{ background: "linear-gradient(135deg, #c47d8e, #8b5e6b)" }}>N</div>
          <div className="text-xl font-bold mb-1.5" style={{ color: text }}>Welcome to Nitro!</div>
          <div className="text-sm leading-[1.6] mb-6" style={{ color: sub }}>Let us show you around. It only takes a few seconds.</div>
          <div className="flex flex-col gap-2">
            <button onClick={startTour} className="py-3 rounded-[10px] text-[15px] font-semibold border-none cursor-pointer font-[inherit] w-full" style={{ background: accent, color: "#fff" }}>Let's go</button>
            <button onClick={finish} className="py-2.5 rounded-[10px] text-sm font-medium bg-transparent border-none cursor-pointer font-[inherit]" style={{ color: skipC }}>I'll figure it out myself</button>
          </div>
        </div>
      )}

      {/* TOUR STEP */}
      {phase === "touring" && (
        <div className="tour-tooltip" style={{
          position: "fixed", zIndex: 101,
          background: bg, border: `1.5px solid ${border}`, borderRadius: 16,
          padding: "22px 24px", maxWidth: 360, width: "calc(100% - 32px)",
          boxShadow: dark ? "0 12px 40px rgba(0,0,0,0.5)" : "0 12px 40px rgba(0,0,0,0.12)",
          animation: "tourFadeIn 0.3s ease",
          left: "50%", ...tooltipPos, transform: "translateX(-50%)",
        }}>
          <div className="flex items-center gap-2.5 mb-3">
            <div className="w-9 h-9 rounded-[10px] flex items-center justify-center" style={{ background: dark ? "rgba(196,125,142,0.1)" : "rgba(196,125,142,0.06)", color: accent }}>{STEPS[step].icon}</div>
            <span className="text-[11px] font-bold tracking-[1.5px] uppercase" style={{ color: accent }}>Step {step + 1} of {STEPS.length}</span>
          </div>
          <div className="text-[17px] font-bold mb-1.5" style={{ color: text }}>{STEPS[step].title}</div>
          <div className="text-[13px] leading-[1.6] mb-5" style={{ color: sub }}>{STEPS[step].desc}</div>
          <div className="flex items-center justify-between">
            <div className="flex gap-[5px]">
              {STEPS.map((_, i) => (
                <div key={i} className="w-[7px] h-[7px] rounded-full transition-[background] duration-300" style={{ background: i === step ? accent : i < step ? (dark ? "rgba(196,125,142,0.3)" : "rgba(196,125,142,0.2)") : dotOff }} />
              ))}
            </div>
            <div className="flex items-center gap-3.5">
              <button onClick={finish} className="bg-transparent border-none text-xs font-medium cursor-pointer font-[inherit] p-0" style={{ color: skipC }}>Skip</button>
              <button onClick={next} className="py-2 px-[22px] rounded-lg text-[13px] font-semibold border-none cursor-pointer font-[inherit]" style={{ background: accent, color: "#fff" }}>
                {step === STEPS.length - 1 ? "Got it!" : "Next"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Skip message */}
      {skipMsg && (
        <div className="fixed z-[102] top-5 left-1/2 -translate-x-1/2 py-2 px-[18px] rounded-[10px] text-[13px] font-medium backdrop-blur-[8px]" style={{ background: dark ? "rgba(17,22,40,.95)" : "rgba(255,255,255,.95)", border: `1px solid ${dark ? "rgba(255,255,255,.1)" : "rgba(0,0,0,.08)"}`, color: dark ? "rgba(255,255,255,.6)" : "rgba(0,0,0,.5)" }}>{skipMsg}</div>
      )}
    </>
  );
}

export function shouldShowTour() {
  if (typeof window === "undefined") return false;
  try { return !localStorage.getItem("nitro-tour-done"); } catch { return false; }
}
