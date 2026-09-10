'use client';
import { useMoney, useT } from "./locale";
import { msg } from "../lib/i18n";
import { MAX_BONUS_NAIRA } from "../lib/welcome-bonus";
import { useState, useEffect, useCallback, useRef } from "react";
import { BONUS_PRESETS } from "../lib/welcome-bonus";

// title and desc are English KEYS, not finished copy. They sit at module scope,
// where tr() — a hook — cannot legally be called, so msg() marks them for the
// scanner and the component translates them at render. Before this the tour was
// the one customer-facing surface the wrapper could never reach: 1,856 strings
// were translated around it while it went on greeting every French, Swahili and
// Arabic user in English.
const STEPS = [
  { target: "no-platform-tabs", findFirst: ".no-plat-icon-on, .no-mob-plat-on, .no-plat-icon-btn:first-child, .no-mob-plat-btn:first-child", noScroll: true, title: msg("Pick a platform"), desc: msg("Choose which platform you want to grow. Instagram, TikTok, YouTube — we support 28."), icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg> },
  { target: "no-service-list", findFirst: ".no-svc-card", title: msg("Choose a service"), desc: msg("Browse available services — followers, likes, views, comments, and more. Tap one to select it."), icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M4 6h16M4 12h16M4 18h10"/></svg> },
  { target: "no-tier-select", title: msg("Select your tier"), desc: msg("Budget has no refill, Standard includes 30-day refill, Premium has lifetime refill. Pick what fits your needs."), icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26"/></svg>, before: "selectService" },
  { target: "no-link-input", title: msg("Enter your link & quantity"), desc: msg("Paste your profile or post URL and set how many you want. Minimum varies by service."), icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/></svg>, before: "selectTier" },
  { target: "no-order-bar", title: msg("Place your order"), desc: msg("Review your selection, tap Order, enter your link and you're done. We start processing immediately."), icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg> },
  { target: "no-mode-toggle", title: msg("Bulk ordering"), desc: msg("Need multiple orders at once? Switch to Bulk mode — add services to a cart and place them all in one go."), icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="18" rx="2"/><path d="M8 7v10M12 7v10M16 7v10"/></svg>, before: "clearOrder" },
];

function findTarget(s) {
  if (s.findFirst) {
    const el = document.querySelector(s.findFirst);
    if (el && el.offsetParent !== null) return el;
  }
  return document.querySelector(`[data-tour="${s.target}"]`);
}

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

export default function OrderTour({ dark, onComplete, setSelSvc, setSelTier, setQty, user, onTopUp }) {
  const tr = useT();
  const money = useMoney();
  const eligible = user?.welcomeBonusEligible;
  const saved = (() => {
    try { const s = localStorage.getItem("nitro-order-tour-progress"); return s ? JSON.parse(s) : null; } catch { return null; }
  })();
  const [phase, setPhase] = useState(saved?.phase || "welcome");
  const [step, setStep] = useState(saved?.step || 0);
  // Progress has always been restored from localStorage in silence, so someone
  // who left mid-tour came back to step four with no idea why they had skipped
  // the first three. Say it once, and offer the restart that implies.
  const [resumed, setResumed] = useState(saved?.phase === "touring" && saved.step > 0);
  const [visible, setVisible] = useState(false);
  const [spotRect, setSpotRect] = useState(null);
  const [animKey, setAnimKey] = useState(0);
  const rafRef = useRef(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(true);
      if (saved?.phase === "touring" && saved.step >= 2) {
        window.dispatchEvent(new CustomEvent("nitro-tour-select-service"));
        if (saved.step >= 3) {
          setTimeout(() => window.dispatchEvent(new CustomEvent("nitro-tour-select-tier")), 800);
        }
      }
    }, 400);
    return () => clearTimeout(timer);
  }, []);

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

  // A target that never appeared is our problem, not the customer's. This used
  // to flash "Skipping step…", "Almost done…" or "Finishing tour…" — internal
  // states named in developer language to someone who cannot tell what was
  // skipped or why. Recovery is silent now: the tour simply moves on.
  const skipToNext = (fromIdx) => {
    if (fromIdx < STEPS.length - 1) setStep(fromIdx + 1);
    else if (eligible) setPhase("deposit");
    else finish();
  };

  const startTour = () => {
    setPhase("touring");
    setStep(0);
  };

  const goToStep = (idx) => {
    const s = STEPS[idx];

    if (s.before === "selectService") {
      window.dispatchEvent(new CustomEvent("nitro-tour-select-service"));
      waitForEl(".no-tier-chip", () => { setStep(idx); setAnimKey(k => k + 1); }, () => skipToNext(idx));
      return;
    }

    if (s.before === "selectTier") {
      window.dispatchEvent(new CustomEvent("nitro-tour-select-tier"));
      waitForEl('[data-tour="no-link-input"]', () => { setStep(idx); setAnimKey(k => k + 1); }, () => skipToNext(idx));
      return;
    }

    if (s.before === "clearOrder") {
      window.dispatchEvent(new CustomEvent("nitro-tour-clear-order"));
      setTimeout(() => { setStep(idx); setAnimKey(k => k + 1); }, 300);
      return;
    }

    setStep(idx);
    setAnimKey(k => k + 1);
  };

  const next = () => {
    const nextIdx = step + 1;
    if (nextIdx >= STEPS.length) {
      if (eligible) { setPhase("deposit"); } else { finish(); }
      return;
    }
    goToStep(nextIdx);
  };

  // Going back never re-runs a `before` action: those select a service or tier
  // to set the screen up for the step ahead, and replaying them on the way back
  // would fight whatever the customer has since chosen. The earlier screens are
  // all still valid with a selection in place.
  const back = () => { if (step > 0) { setStep(step - 1); setAnimKey(k => k + 1); } };

  // Track the target's position.
  //
  // This used to end `update` with an unconditional requestAnimationFrame(update),
  // so it recomputed a rect and set state on every frame for the entire tour
  // whether anything had moved or not — a permanent 60fps loop on a phone, for a
  // box that only moves when the step changes or the page scrolls. It now
  // measures on those events, and only follows frame-by-frame while a smooth
  // scroll is actually settling.
  useEffect(() => {
    if (phase !== "touring" || !visible) { setSpotRect(null); return undefined; }

    const measure = () => {
      const el = findTarget(STEPS[step]);
      if (!el) { setSpotRect(null); return; }
      const r = el.getBoundingClientRect();
      setSpotRect(prev => (prev && prev.x === r.left && prev.y === r.top && prev.w === r.width && prev.h === r.height)
        ? prev
        : { x: r.left, y: r.top, w: r.width, h: r.height });
    };

    // While the step's scrollIntoView animates, follow it; then stop.
    let settleUntil = Date.now() + 900;
    const follow = () => {
      measure();
      rafRef.current = Date.now() < settleUntil ? requestAnimationFrame(follow) : null;
    };
    const timer = setTimeout(follow, 300);

    const onMove = () => {
      settleUntil = Date.now() + 250;
      if (!rafRef.current) rafRef.current = requestAnimationFrame(follow);
    };
    window.addEventListener("scroll", onMove, true);
    window.addEventListener("resize", onMove);
    return () => {
      clearTimeout(timer);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      window.removeEventListener("scroll", onMove, true);
      window.removeEventListener("resize", onMove);
    };
  }, [step, phase, visible]);

  // Escape leaves, and the arrows walk the steps, the way they do in every other
  // overlay in the app.
  //
  // Deliberately NO body scroll lock here, which is the one house rule this
  // component gets to break: the tour's whole job is to scroll the page behind
  // it to bring each target into view, so `overflow: hidden` on the body would
  // stop scrollIntoView dead and strand every step below the fold.
  useEffect(() => {
    if (!visible) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") finish();
      else if (phase === "touring" && e.key === "ArrowRight") next();
      else if (phase === "touring" && e.key === "ArrowLeft") back();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [visible, phase, step, finish]);

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

  // Step 5: raise the bottom bar above the overlay
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

  // A resize re-render used to be forced from here. The spotlight tracker now
  // listens for resize itself and remeasures, so this second listener would only
  // re-render the same numbers a second time.

  if (!visible) return null;

  const accent = "#c47d8e";
  const green = dark ? "#6ee7b7" : "#059669";
  const greenBg = dark ? "rgba(110,231,183,.1)" : "rgba(5,150,105,.06)";
  const greenBorder = dark ? "rgba(110,231,183,.2)" : "rgba(5,150,105,.15)";
  const bg = dark ? "#1a1329" : "#ffffff";
  const border = dark ? "rgba(196,125,142,.22)" : "rgba(0,0,0,.1)";
  const text = dark ? "#f5f3f0" : "#1c1b19";
  const sub = dark ? "rgba(255,255,255,0.55)" : "rgba(0,0,0,0.5)";
  const skipC = dark ? "rgba(255,255,255,0.35)" : "rgba(0,0,0,0.3)";
  const dotOff = dark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.08)";
  // The deposit card is a separate phase, not a seventh step: it is never
  // numbered, so it does not belong in the count the rail and the label share.
  const pad = 10;
  const sr = spotRect;

  // Smart tooltip positioning — stays close to the spotlight, avoids edges
  const tooltipPos = (() => {
    if (!sr) return { bottom: 90, left: "50%", transform: "translateX(-50%)" };
    const tooltipH = 190;
    const tooltipW = 320;
    const gap = 14;
    const spotBottom = sr.y + sr.h;
    const spotTop = sr.y;
    const spotCenterX = sr.x + sr.w / 2;
    const spaceBelow = window.innerHeight - spotBottom;
    const spaceAbove = spotTop;

    const pos = {};

    // Vertical: prefer below, fall back to above
    if (spaceBelow > tooltipH + gap + 40) {
      pos.top = spotBottom + gap;
    } else if (spaceAbove > tooltipH + gap) {
      pos.bottom = window.innerHeight - spotTop + gap;
    } else {
      pos.top = Math.max(70, spotBottom + gap);
    }

    // Horizontal: anchor near the spotlight center, clamped to screen edges
    const halfW = tooltipW / 2;
    let left = spotCenterX;
    if (left - halfW < 16) left = halfW + 16;
    if (left + halfW > window.innerWidth - 16) left = window.innerWidth - halfW - 16;
    pos.left = left;
    pos.transform = "translateX(-50%)";

    return pos;
  })();

  return (
    <>
      <style>{`
        @keyframes otFadeIn { from { opacity: 0; transform: translateX(-50%) translateY(10px); } to { opacity: 1; transform: translateX(-50%) translateY(0); } }
        @keyframes otWelcomeFadeIn { from { opacity: 0; transform: translate(-50%, -48%) scale(.96); } to { opacity: 1; transform: translate(-50%, -50%) scale(1); } }
        @keyframes otPulseRing { 0% { r: 0; opacity: .5; } 100% { r: 60; opacity: 0; } }
        @keyframes otOverlayIn { from { opacity: 0; } to { opacity: 1; } }
      `}</style>

      {/* Overlay with spotlight cutout.
          No onClick={finish} on this any more. A full-screen dim that ends
          onboarding on any stray tap gave the customer no undo and no warning —
          leaving is Skip or Escape, both of which say so. */}
      <svg aria-hidden="true" className="fixed inset-0 w-full h-full z-[100]" style={{ animation: "otOverlayIn .3s ease" }}>
        <defs>
          <mask id="orderTourMask">
            <rect width="100%" height="100%" fill="white" />
            {phase === "touring" && sr && <rect x={sr.x - pad} y={sr.y - pad} width={sr.w + pad * 2} height={sr.h + pad * 2} rx="14" fill="black" />}
          </mask>
        </defs>
        <rect width="100%" height="100%" fill={phase === "welcome" || phase === "deposit" ? "rgba(0,0,0,0.6)" : "rgba(0,0,0,0.45)"} mask="url(#orderTourMask)" />
        {phase === "touring" && sr && <>
          {/* Soft accent glow behind spotlight */}
          <rect x={sr.x - pad} y={sr.y - pad} width={sr.w + pad * 2} height={sr.h + pad * 2} rx="14" fill="none" stroke={accent} strokeWidth="2" opacity="0.6" />
          <rect x={sr.x - pad - 3} y={sr.y - pad - 3} width={sr.w + pad * 2 + 6} height={sr.h + pad * 2 + 6} rx="17" fill="none" stroke={accent} strokeWidth="2">
            <animate attributeName="stroke-width" values="2;10" dur="1.6s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="0.5;0" dur="1.6s" repeatCount="indefinite" />
          </rect>
        </>}
      </svg>

      {/* WELCOME CARD */}
      {phase === "welcome" && (
        <div className="fixed z-[101] top-1/2 left-1/2 text-center rounded-2xl pt-8 px-7 pb-7 max-w-[340px] w-[calc(100%-32px)]" style={{
          transform: "translate(-50%, -50%)",
          background: bg, border: `1px solid ${border}`,
          boxShadow: dark ? "0 16px 48px rgba(0,0,0,0.55), 0 0 0 1px rgba(196,125,142,.08)" : "0 16px 48px rgba(0,0,0,0.1), 0 0 0 1px rgba(0,0,0,.04)",
          animation: "otWelcomeFadeIn 0.35s cubic-bezier(.4,0,.2,1)",
        }}>
          <div className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-4" style={{ background: dark ? "rgba(196,125,142,0.12)" : "rgba(196,125,142,0.07)", color: accent }}>
            <svg className="dir-flip" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14"/></svg>
          </div>
          <div className="text-lg font-bold mb-1" style={{ color: text }}>{tr("Ready to place an order?")}</div>
          <div className="text-[13px] leading-[1.6] mb-3" style={{ color: sub }}>{tr("Quick walkthrough — takes about 15 seconds.")}</div>
          {eligible && (
            <div className="flex items-center gap-2 rounded-lg py-2 px-3 mb-3" style={{ background: greenBg, border: `1px solid ${greenBorder}` }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={green} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0"><path d="M20 12v10H4V12"/><path d="M2 7h20v5H2z"/><path d="M12 22V7"/><path d="M12 7H7.5a2.5 2.5 0 010-5C11 2 12 7 12 7z"/><path d="M12 7h4.5a2.5 2.5 0 000-5C13 2 12 7 12 7z"/></svg>
              <span className="text-[11px] font-semibold" style={{ color: green }}>{tr("Up to")} {money(MAX_BONUS_NAIRA, { round: "down" })} {tr("free on your first deposit")}</span>
            </div>
          )}
          <div className="flex flex-col gap-2.5">
            <button onClick={startTour} className="py-3 px-0 rounded-xl text-sm font-semibold border-none cursor-pointer font-[inherit] w-full transition-all duration-200 hover:-translate-y-px hover:shadow-[0_6px_20px_rgba(196,125,142,.35)]" style={{ background: accent, color: "#fff" }}>{tr("Show me how")}</button>
            <button onClick={finish} className="py-2.5 px-0 rounded-xl text-[13px] font-medium bg-transparent cursor-pointer font-[inherit] transition-all duration-200 hover:-translate-y-px" style={{ color: skipC, border: "none" }}>{tr("I already know")}</button>
          </div>
        </div>
      )}

      {/* Resume notice — only on the step the tour was restored onto. */}
      {phase === "touring" && resumed && (
        <div className="fixed z-[102] top-4 left-1/2 -translate-x-1/2 flex items-center gap-2 py-1.5 ps-3 pe-1.5 rounded-full text-[11px] font-semibold whitespace-nowrap"
          style={{ background: bg, border: `1px solid ${border}`, color: sub, boxShadow: "0 8px 22px rgba(0,0,0,.2)" }}>
          {tr("Picked up where you stopped")}
          <button onClick={() => { setResumed(false); setStep(0); setAnimKey(k => k + 1); }}
            className="border-none rounded-full text-[10px] font-bold cursor-pointer font-[inherit] py-1 px-2.5" style={{ background: accent, color: "#fff" }}>{tr("Restart")}</button>
        </div>
      )}

      {/* TOUR STEP CARD */}
      {phase === "touring" && (
        <div key={animKey} data-tour-tooltip className="fixed z-[101] rounded-2xl py-5 px-5 max-w-[320px] w-[calc(100%-32px)]" style={{
          ...tooltipPos,
          animation: "otFadeIn 0.3s cubic-bezier(.4,0,.2,1)",
          background: bg, border: `1px solid ${border}`,
          boxShadow: dark ? "0 16px 48px rgba(0,0,0,0.55), 0 0 0 1px rgba(196,125,142,.08)" : "0 16px 48px rgba(0,0,0,0.1), 0 0 0 1px rgba(0,0,0,.04)",
        }}>
          {/* Step indicator + icon. The counter counts the steps you actually
              walk. It used to read "of STEPS.length" (six) beside a row of dots
              built from totalDots (seven for a bonus-eligible user), so the two
              halves of the same progress display disagreed on screen. */}
          <div className="flex items-center gap-2.5 mb-3">
            <div className="w-9 h-9 rounded-[10px] flex items-center justify-center shrink-0" style={{ background: dark ? "rgba(196,125,142,0.12)" : "rgba(196,125,142,0.07)", color: accent }}>{STEPS[step].icon}</div>
            <div className="text-[11px] font-bold tracking-[1.5px] uppercase" style={{ color: accent }}>{tr("Step")} {step + 1} {tr("of")} {STEPS.length}</div>
            <span className="ms-auto text-[10px] font-medium px-1.5 py-0.5 rounded-md max-md:hidden" style={{ color: skipC, border: `1px solid ${border}` }}>{tr("Esc to exit")}</span>
          </div>
          {/* tr() at render — STEPS holds msg()-marked English keys, because a
              hook cannot be called at module scope where the array is defined. */}
          <div className="text-[15px] font-bold mb-1" style={{ color: text }}>{tr(STEPS[step].title)}</div>
          <div className="text-[12.5px] leading-[1.55] mb-4" style={{ color: sub }}>{tr(STEPS[step].desc)}</div>

          {/* One progress rail rather than two counters that can disagree. */}
          <div className="h-[3px] rounded-full overflow-hidden mb-3.5" style={{ background: dotOff }}>
            <div className="h-full rounded-full transition-[width] duration-300" style={{ width: `${((step + 1) / STEPS.length) * 100}%`, background: accent }} />
          </div>

          <div className="flex items-center gap-2">
            <button onClick={back} disabled={step === 0} aria-label={tr("Back")}
              className="py-2 px-3 rounded-[10px] text-[11.5px] font-semibold cursor-pointer font-[inherit] transition-all duration-200 disabled:opacity-35 disabled:cursor-default enabled:hover:-translate-y-px"
              style={{ background: "transparent", border: `1px solid ${border}`, color: sub }}>{tr("Back")}</button>
            <button onClick={finish} className="bg-transparent border-none text-[11.5px] font-medium cursor-pointer font-[inherit] px-1 transition-all duration-200 hover:opacity-70" style={{ color: skipC }}>{tr("Skip tour")}</button>
            <button onClick={next} className="ms-auto py-2 px-5 rounded-[10px] text-xs font-semibold border-none cursor-pointer font-[inherit] transition-all duration-200 hover:-translate-y-px hover:shadow-[0_4px_14px_rgba(196,125,142,.3)]" style={{ background: accent, color: "#fff" }}>
              {step === STEPS.length - 1 && !eligible ? tr("Got it!") : tr("Next")}
            </button>
          </div>
        </div>
      )}

      {/* DEPOSIT CARD — bonus-eligible users only */}
      {phase === "deposit" && (
        <div className="fixed z-[101] top-1/2 left-1/2 text-center rounded-2xl pt-8 px-7 pb-7 max-w-[370px] w-[calc(100%-32px)]" style={{
          transform: "translate(-50%, -50%)",
          background: bg, border: `1px solid ${border}`,
          boxShadow: dark ? "0 16px 48px rgba(0,0,0,0.55), 0 0 0 1px rgba(196,125,142,.08)" : "0 16px 48px rgba(0,0,0,0.1), 0 0 0 1px rgba(0,0,0,.04)",
          animation: "otWelcomeFadeIn 0.35s cubic-bezier(.4,0,.2,1)",
        }}>
          <div className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-4" style={{ background: greenBg, color: green }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
          </div>
          <div className="text-lg font-bold mb-1" style={{ color: text }}>{tr("Add funds to begin")}</div>
          <div className="text-[13px] leading-[1.6] mb-4" style={{ color: sub }}>{tr("Top up to place your order — your first deposit gets free credit to spend. The more you add, the bigger the bonus.")}</div>

          <div className="flex gap-2 justify-center mb-5">
            {BONUS_PRESETS.map((p, i) => (
              <div key={p.amount} className="py-2 px-3 rounded-lg text-center" style={{
                background: i === 1 ? (dark ? "rgba(110,231,183,.12)" : "rgba(5,150,105,.08)") : (dark ? "rgba(255,255,255,.06)" : "rgba(0,0,0,.03)"),
                border: `1px solid ${i === 1 ? greenBorder : (dark ? "rgba(255,255,255,.08)" : "rgba(0,0,0,.06)")}`,
              }}>
                <div className="text-[13px] font-bold" style={{ color: i === 1 ? green : text }}>{money(p.amount)}</div>
                <div className="text-[11px] font-semibold mt-0.5" style={{ color: i === 1 ? green : sub }}>+{money(p.bonus, { round: "down" })}</div>
              </div>
            ))}
          </div>

          <div className="flex flex-col gap-2.5">
            <button onClick={() => { finish(); onTopUp?.(); }} className="py-3 px-0 rounded-xl text-sm font-semibold border-none cursor-pointer font-[inherit] w-full transition-all duration-200 hover:-translate-y-px hover:shadow-[0_6px_20px_rgba(5,150,105,.3)]" style={{ background: dark ? "#059669" : "#059669", color: "#fff" }}>{tr("Add funds →")}</button>
            <button onClick={finish} className="py-2.5 px-0 rounded-xl text-[13px] font-medium bg-transparent cursor-pointer font-[inherit] transition-all duration-200 hover:-translate-y-px" style={{ color: skipC, border: "none" }}>{tr("Maybe later")}</button>
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
