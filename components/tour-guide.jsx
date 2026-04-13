'use client';
import { useState, useEffect, useCallback } from "react";

const STEPS = [
  {
    page: "add-funds",
    title: "Fund your wallet",
    desc: "This is where you add money to your account. We support bank transfers and card payments.",
    icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M2 10h20"/><circle cx="16" cy="15" r="1.5"/></svg>,
  },
  {
    page: "services",
    title: "Browse & order",
    desc: "Pick a platform, choose your service tier, enter your link and quantity — and place your order.",
    icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14"/></svg>,
  },
  {
    page: "orders",
    title: "Track your orders",
    desc: "All your orders show up here with real-time status updates. Processing starts within seconds.",
    icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>,
  },
  {
    page: "support",
    mobileAction: "openMore",
    title: "Need help?",
    desc: "Our support team is here for you. Create a ticket anytime — we respond fast.",
    icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>,
  },
];

export default function TourGuide({ dark, onComplete, onNavigate, onOpenMore }) {
  const [phase, setPhase] = useState("welcome");
  const [step, setStep] = useState(0);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), 500);
    return () => clearTimeout(timer);
  }, []);

  const finish = useCallback(() => {
    setVisible(false);
    try { localStorage.setItem("nitro-tour-done", "1"); } catch {}
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

  // Highlight nav items
  useEffect(() => {
    if (phase !== "touring" || !visible) return;
    const s = STEPS[step];
    const mobile = isMobile();

    const sidebarItem = document.querySelector(`[data-nav="${s.page}"]`);
    const bottomId = (mobile && s.mobileAction === "openMore") ? "more" : s.page;
    const bottomItem = document.querySelector(`[data-tab="${bottomId}"]`);

    sidebarItem?.classList.add("tour-highlight");
    bottomItem?.classList.add("tour-highlight");

    // Highlight support inside More popup on mobile
    let moreItem = null;
    if (mobile && s.mobileAction === "openMore") {
      const timer = setTimeout(() => {
        moreItem = [...document.querySelectorAll(".dash-more-item")].find(el => el.textContent?.includes("Support"));
        moreItem?.classList.add("tour-highlight");
      }, 150);
      return () => {
        clearTimeout(timer);
        sidebarItem?.classList.remove("tour-highlight");
        bottomItem?.classList.remove("tour-highlight");
        moreItem?.classList.remove("tour-highlight");
      };
    }

    return () => {
      sidebarItem?.classList.remove("tour-highlight");
      bottomItem?.classList.remove("tour-highlight");
    };
  }, [step, phase, visible]);

  if (!visible) return null;

  const accent = "#c47d8e";
  const bg = dark ? "#161b2e" : "#ffffff";
  const border = dark ? "rgba(196,125,142,0.25)" : "rgba(0,0,0,0.08)";
  const text = dark ? "#fff" : "#1a1a1a";
  const sub = dark ? "rgba(255,255,255,0.5)" : "rgba(0,0,0,0.5)";
  const skipC = dark ? "rgba(255,255,255,0.3)" : "rgba(0,0,0,0.3)";
  const dotOff = dark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.1)";

  const tooltipBase = {
    position: "fixed", zIndex: 53,
    background: bg, border: `1.5px solid ${border}`, borderRadius: 16,
    padding: "22px 24px", maxWidth: 360, width: "calc(100% - 32px)",
    boxShadow: dark ? "0 12px 40px rgba(0,0,0,0.5)" : "0 12px 40px rgba(0,0,0,0.12)",
    animation: "tourFadeIn 0.3s ease",
    left: "50%", transform: "translateX(-50%)",
  };

  return (
    <>
      <style>{`
        @keyframes tourFadeIn { from { opacity: 0; transform: translateX(-50%) translateY(8px); } to { opacity: 1; transform: translateX(-50%) translateY(0); } }
        @keyframes tourPulse { 0%,100% { box-shadow: 0 0 0 0 rgba(196,125,142,0.4); } 70% { box-shadow: 0 0 0 8px rgba(196,125,142,0); } }
        .tour-highlight { position: relative; z-index: 52 !important; animation: tourPulse 2s ease-in-out infinite; border-radius: 8px; }
      `}</style>

      {/* Overlay */}
      <div onClick={finish} style={{
        position: "fixed", inset: 0, zIndex: 50,
        background: phase === "welcome" ? "rgba(0,0,0,0.6)" : "rgba(0,0,0,0.4)",
        backdropFilter: phase === "welcome" ? "blur(4px)" : "blur(1px)",
        transition: "all 0.3s",
      }} />

      {/* ═══ WELCOME ═══ */}
      {phase === "welcome" && (
        <div className="tour-tooltip" style={{ ...tooltipBase, top: "50%", bottom: "auto", transform: "translate(-50%, -50%)", textAlign: "center" }}>
          <div style={{ width: 48, height: 48, borderRadius: 14, background: "linear-gradient(135deg, #c47d8e, #8b5e6b)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px", fontSize: 22, fontWeight: 700, color: "#fff" }}>N</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: text, marginBottom: 6 }}>Welcome to Nitro!</div>
          <div style={{ fontSize: 14, lineHeight: 1.6, color: sub, marginBottom: 24 }}>Let us show you around. It only takes a few seconds.</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <button onClick={startTour} style={{ padding: "12px 0", borderRadius: 10, fontSize: 15, fontWeight: 600, background: accent, color: "#fff", border: "none", cursor: "pointer", fontFamily: "inherit", width: "100%" }}>Let's go</button>
            <button onClick={finish} style={{ padding: "10px 0", borderRadius: 10, fontSize: 14, fontWeight: 500, background: "none", color: skipC, border: "none", cursor: "pointer", fontFamily: "inherit" }}>I'll figure it out myself</button>
          </div>
        </div>
      )}

      {/* ═══ TOUR STEP ═══ */}
      {phase === "touring" && (
        <div className="tour-tooltip" style={{ ...tooltipBase, bottom: 90 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: dark ? "rgba(196,125,142,0.1)" : "rgba(196,125,142,0.06)", display: "flex", alignItems: "center", justifyContent: "center", color: accent }}>{STEPS[step].icon}</div>
            <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", color: accent }}>Step {step + 1} of {STEPS.length}</span>
          </div>
          <div style={{ fontSize: 17, fontWeight: 700, color: text, marginBottom: 6 }}>{STEPS[step].title}</div>
          <div style={{ fontSize: 13, lineHeight: 1.6, color: sub, marginBottom: 20 }}>{STEPS[step].desc}</div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", gap: 5 }}>
              {STEPS.map((_, i) => (
                <div key={i} style={{ width: 7, height: 7, borderRadius: "50%", background: i === step ? accent : i < step ? (dark ? "rgba(196,125,142,0.3)" : "rgba(196,125,142,0.2)") : dotOff, transition: "background 0.3s" }} />
              ))}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <button onClick={finish} style={{ background: "none", border: "none", fontSize: 12, fontWeight: 500, color: skipC, cursor: "pointer", fontFamily: "inherit", padding: 0 }}>Skip</button>
              <button onClick={next} style={{ padding: "8px 22px", borderRadius: 8, fontSize: 13, fontWeight: 600, background: accent, color: "#fff", border: "none", cursor: "pointer", fontFamily: "inherit" }}>
                {step === STEPS.length - 1 ? "Got it!" : "Next"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export function shouldShowTour() {
  if (typeof window === "undefined") return false;
  try { return !localStorage.getItem("nitro-tour-done"); } catch { return false; }
}
