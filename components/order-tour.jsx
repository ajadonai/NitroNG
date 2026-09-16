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
  // The selector leads. It decides what every control under it shows, so
  // teaching the tiles or the tiers before it explains the branches before the
  // trunk — and it is also the first thing on the page, so the spotlight walks
  // straight down rather than jumping back up.
  //
  // No counts in any of this copy. They are per-platform (Instagram carries 19
  // picks and 934 others; YouTube's wider list is 1,422) and they move on every
  // sync, so a number typed in here is wrong for most people reading it. The
  // live pills on the selector say it instead. The old step 1 claimed "we
  // support 28" while the page header said 29.
  { target: "no-list-select", noScroll: true, title: msg("Start here — two lists"),
    desc: msg("Nitro picks are the ones we test every week and back with a refill. Full list is everything else we carry for this platform — cheaper and far wider, sold exactly as listed. Everything below changes with whichever one you are on."),
    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg> },

  // findFirst aims at the tile itself. The four selectors this used to try —
  // no-plat-icon-on, no-mob-plat-on, no-plat-icon-btn, no-mob-plat-btn — are
  // not rendered anywhere and have not been for a long time, so findTarget fell
  // back to the anchor every single time. The anchor was the CATEGORY TABS row,
  // which meant step one explained Instagram and TikTok while circling
  // "Social / Music / SEO & Reviews". It never errored, because a dead selector
  // quietly resolves to its ancestor. tests/order-tour-targets.test.js now
  // fails the build instead.
  { target: "no-platform-grid", findFirst: ".no-plat-tile", title: msg("Pick a platform"),
    desc: msg("Choose where you want to grow. Instagram, TikTok, YouTube and more, grouped under the tabs above."),
    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg> },

  { target: "no-service-list", findFirst: ".no-svc-card", title: msg("Choose a service"),
    desc: msg("Followers, likes, views, comments and more. Tap one to open it."),
    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M4 6h16M4 12h16M4 18h10"/></svg> },

  // The chips, not the whole card: the tiers are the thing being described.
  { target: "no-tier-select", findFirst: ".no-tier-chip", title: msg("Pick a tier"),
    desc: msg("Budget has no refill. Standard is refilled for 30 days. Premium is refilled for life. Same service, different promise."),
    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26"/></svg>, before: "selectService" },

  { target: "no-link-input", title: msg("Enter your link & quantity"),
    desc: msg("Paste your profile or post URL and set how many you want. The minimum varies by service."),
    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/></svg>, before: "selectTier" },

  // Restored. This step existed before and I dropped it in the rebuild, which
  // left the tour going from "enter your link" straight to bulk mode without
  // ever showing how an order is placed.
  //
  // It aims at the submit button INSIDE the modal, not at no-order-bar as it
  // used to. That bar is the mobile/tablet strip — it does not exist on desktop
  // at all, and from the tier step onward the modal is open on top of it
  // anyway. no-submit-btn is rendered on every viewport and is the control the
  // step is actually describing, whether it reads "Order" or "Top up".
  // Two readings of the same step, chosen on the balance at render.
  //
  // A customer who has never deposited has ₦0, so the button in the modal says
  // "Top up", not "Order" — and this step was telling them to place an order
  // while pointing at it. Faking an Order button would be worse than the wrong
  // words: tapping it fails. So the step describes the control that is there,
  // and for a bonus-eligible customer it hands straight into the deposit card
  // that already comes next.
  { target: "no-submit-btn", title: msg("Place your order"),
    desc: msg("Check the total, then tap the button. We start straight away — you can watch it fill on the Orders page."),
    // No Top up variant any more. The form assumes the wallet covers it while
    // the tour is running (see assumeFunded in order-form), so this step always
    // points at an Order button and one description is enough. Two earlier
    // attempts wrote around the problem — first retitling the step, then
    // explaining the wrong button — instead of removing it.
    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg> },

  { target: "no-mode-toggle", title: msg("Ordering a lot at once"),
    desc: msg("Switch to Bulk and every service gets a plus instead. Fill one cart, pay once."),
    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="18" rx="2"/><path d="M8 7v10M12 7v10M16 7v10"/></svg>, before: "clearOrder" },
];

// The first VISIBLE match, not the first match.
//
// New Order renders its platform grid twice — a desktop grid and a phone
// window — with one hidden at any width, so "the first one in the document" is
// the wrong element half the time. Same for the anchor: both carry
// data-tour="no-platform-grid".
//
// The old version asked querySelector for ONE element and gave up if it was
// hidden, falling silently back to the anchor. That silence is what let four
// dead platform selectors survive for months: the tour went on pointing at the
// category tabs and nothing ever said it could not find a tile.
/**
 * An element is only a usable target if it actually occupies space.
 *
 * This used to accept anything with a client rect, then fall back to plain
 * querySelector when nothing matched — which happily returned a display:none
 * element. A hidden element measures 0x0 at 0,0, so the spotlight jumped to the
 * top-left corner of the screen and the tour appeared to point at nothing. On a
 * phone that is most steps, because the desktop copy of a control is the one
 * that is hidden and it is usually first in the DOM.
 */
function firstVisible(sel) {
  for (const el of document.querySelectorAll(sel)) {
    if (el.offsetParent === null) continue;
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.height > 0) return el;
  }
  return null;
}

function findTarget(s) {
  if (s.findFirst) {
    const el = firstVisible(s.findFirst);
    if (el) return el;
  }
  // No querySelector fallback: a target that cannot be seen cannot be pointed
  // at, and returning a hidden one is worse than returning nothing.
  return firstVisible(`[data-tour="${s.target}"]`);
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

export default function OrderTour({ dark, onComplete, setSelSvc, setSelTier, user, onTopUp }) {
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
  // Asked once, and kept current if they change it mid-session.
  const [reduceMotion, setReduceMotion] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduceMotion(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);
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

    // Follow until the box stops moving, not until a timer says it should have.
    // The old version measured for a fixed 900ms starting 300ms in, while the
    // scroll below did not even begin until 400ms — so on a phone, where a
    // smooth scroll routinely runs past a second, the spotlight locked onto
    // where the target had been and stayed there. Now it tracks until the rect
    // has held still for a few frames, with a ceiling so a page that never
    // settles cannot pin a rAF loop open.
    let lastKey = "";
    let stillFor = 0;
    const deadline = Date.now() + 4000;
    const follow = () => {
      measure();
      const el = findTarget(STEPS[step]);
      const r = el?.getBoundingClientRect();
      const key = r ? `${Math.round(r.top)},${Math.round(r.left)},${Math.round(r.width)}` : "";
      stillFor = key && key === lastKey ? stillFor + 1 : 0;
      lastKey = key;
      const settled = stillFor >= 6 && key !== "";
      rafRef.current = (settled || Date.now() > deadline) ? null : requestAnimationFrame(follow);
    };
    const timer = setTimeout(follow, 0);

    const onMove = () => {
      stillFor = 0;
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

  /**
   * Bring the step's target into view before pointing at it.
   *
   * Three things were wrong on a phone. It waited 400ms before even looking,
   * by which time the spotlight had already measured and stopped following.
   * It gave up if the element was not in the DOM on that single attempt —
   * common when the previous step's tap is still rendering. And "in view"
   * demanded the whole element sit inside a window shrunk by 240px, which a
   * tall control on a small screen can never satisfy, so it scrolled on every
   * step and fought the user.
   *
   * Now it retries until the target exists, centres it whenever any part of it
   * is outside a comfortable band, and honours reduced-motion by jumping.
   */
  useEffect(() => {
    if (phase !== "touring" || !visible || STEPS[step].noScroll) return undefined;
    let cancelled = false;
    let tries = 0;
    const smooth = !window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    const attempt = () => {
      if (cancelled) return;
      const el = findTarget(STEPS[step]);
      if (!el) {
        // The target may still be rendering from the previous step's tap.
        if (tries++ < 20) { setTimeout(attempt, 100); return; }
        // Two seconds of looking and it is not there. Something upstream is
        // showing a screen this step was not written for, and a tour parked on
        // an empty spotlight is worse than a slightly shorter one — so move on
        // rather than sit there. Past the last step, end cleanly.
        if (step < STEPS.length - 1) next(); else finish();
        return;
      }
      const r = el.getBoundingClientRect();
      const top = 70;
      // Leave room for the tooltip, but never demand more space than exists.
      const bottom = window.innerHeight - Math.min(200, window.innerHeight * 0.32);
      const inView = r.top >= top && r.bottom <= bottom;
      if (!inView) el.scrollIntoView({ behavior: smooth ? "smooth" : "auto", block: "center", inline: "nearest" });
    };

    attempt();
    return () => { cancelled = true; };
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
  // Measured, not guessed. Both of these sat under WCAG's 4.5:1 for normal
  // text — "Skip tour" and "Esc to exit" worst at 2.12:1 on white and 3.22:1 on
  // the dark card, which is why they read as almost invisible. The minimum
  // alpha that clears 4.5:1 is .54 on white and .46 on #1a1329; body copy was
  // also short at 3.95:1 in light.
  const sub = dark ? "rgba(255,255,255,0.72)" : "rgba(0,0,0,0.66)";
  const skipC = dark ? "rgba(255,255,255,0.56)" : "rgba(0,0,0,0.56)";
  const dotOff = dark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.08)";
  // The deposit card is a separate phase, not a seventh step: it is never
  // numbered, so it does not belong in the count the rail and the label share.
  const pad = 10;
  const stepTitle = STEPS[step]?.title;
  const stepDesc = STEPS[step]?.desc;
  const sr = spotRect;

  // Smart tooltip positioning — stays close to the spotlight, avoids edges
  // Where the card goes, and the one rule it must never break: it cannot cover
  // the thing it is pointing at.
  //
  // Two things the old version did not know about. The dashboard's floating
  // bottom nav owns the last ~74px at every width 1199 and under — phone,
  // tablet AND laptop — so "space below" was overstated by that much on three
  // of the four viewports. And its last-resort branch was
  // `top = max(70, spotBottom + gap)`, which lands ON the target whenever
  // neither side fits; the Place-your-order step is exactly that case, because
  // the order bar is itself pinned to the bottom.
  const tooltipPos = (() => {
    if (!sr) return { bottom: 90, left: "50%", transform: "translateX(-50%)" };
    const tooltipH = 190;
    const tooltipW = 320;
    const gap = 14;
    const navH = window.innerWidth <= 1199 ? 74 : 0;
    const floor = window.innerHeight - navH;
    const spotBottom = sr.y + sr.h;
    const spotTop = sr.y;
    const spotCenterX = sr.x + sr.w / 2;
    const spaceBelow = floor - spotBottom;
    const spaceAbove = spotTop;

    const pos = {};

    if (spaceBelow > tooltipH + gap + 40) {
      pos.top = spotBottom + gap;
    } else if (spaceAbove > tooltipH + gap) {
      pos.bottom = window.innerHeight - spotTop + gap;
    } else {
      // Neither side fits. Take the roomier one and sit hard against the edge
      // rather than on the target — a spotlight the card covers is worse than
      // a card that crowds the edge.
      if (spaceAbove >= spaceBelow) pos.bottom = Math.max(navH + 10, window.innerHeight - spotTop + gap);
      else pos.top = Math.min(spotBottom + gap, floor - tooltipH - 10);
    }

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
      {/* Above the order modal, not under it.
          Selecting a tier opens that modal (handleSelectTier calls
          setOrderModal(true)), so it is on screen for the link step, the order
          step and nothing the customer did put it there. At z-100/101 against
          the modal's z-200 the tour simply disappeared behind it: the form came
          up and the step vanished. The spotlight cutout still shows the modal
          through the hole; only the surround is dimmed twice. */}
      <svg aria-hidden="true" className="fixed inset-0 w-full h-full z-[210]" style={{ animation: "otOverlayIn .3s ease" }}>
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
          {/* The ripple: three on arrival, then still.
              It used to repeat indefinitely, which keeps pulling the eye back
              to the ring for as long as you are trying to read the words beside
              it. Three says "here", then gets out of the way. Keyed on the step
              so it fires again each time the spotlight moves.
              Skipped entirely for anyone who asked for less motion — the ring
              and its accent edge above are the signal; this is the garnish. */}
          {!reduceMotion && (
            <rect key={`ripple-${step}`} x={sr.x - pad - 3} y={sr.y - pad - 3} width={sr.w + pad * 2 + 6} height={sr.h + pad * 2 + 6} rx="17" fill="none" stroke={accent} strokeWidth="2">
              <animate attributeName="stroke-width" values="2;10" dur="1.5s" repeatCount="3" fill="freeze" />
              <animate attributeName="opacity" values="0.55;0" dur="1.5s" repeatCount="3" fill="freeze" />
            </rect>
          )}
        </>}
      </svg>

      {/* WELCOME CARD */}
      {phase === "welcome" && (
        <div className="fixed z-[211] top-1/2 left-1/2 rounded-2xl pt-7 px-6 pb-6 max-w-[340px] w-[calc(100%-32px)]" style={{
          transform: "translate(-50%, -50%)",
          background: bg, border: `1px solid ${border}`,
          boxShadow: dark ? "0 16px 48px rgba(0,0,0,0.55), 0 0 0 1px rgba(196,125,142,.08)" : "0 16px 48px rgba(0,0,0,0.1), 0 0 0 1px rgba(0,0,0,.04)",
          animation: "otWelcomeFadeIn 0.35s cubic-bezier(.4,0,.2,1)",
        }}>
          {/* Icon and heading on one line, and the heading says what the tour
              is for rather than asking a yes/no question.

              The icon used to be M12 5v14M5 12h14 — a plus, which reads as a
              missing asset on a card about a walkthrough. It is a route now.

              "takes about 15 seconds" is gone. It was written when there were
              six steps, it is wrong at seven, and it is the same kind of
              hardcoded claim as "we support 28" — a number nobody maintains.
              The three lines below are the summary instead, and they stay true
              when a step is added. They also name the two lists, which is the
              one thing a returning customer does not already know. */}
          <div className="flex items-center gap-3 mb-3">
            <div className="w-[38px] h-[38px] rounded-xl flex items-center justify-center shrink-0" style={{ background: dark ? "rgba(196,125,142,0.12)" : "rgba(196,125,142,0.07)", color: accent }}>
              <svg className="dir-flip" width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M9 20l-5.4 1.8 1.8-5.4L16.5 4.3a2.1 2.1 0 013 3z"/><path d="M15 6l3 3"/></svg>
            </div>
            <div className="text-[17px] font-bold leading-tight" style={{ color: text }}>{tr("New here? Let us show you the page")}</div>
          </div>
          <div className="text-[13px] leading-[1.6] mb-3.5" style={{ color: sub }}>{tr("The two lists, how to pick a service and a tier, and how an order goes out.")}</div>
          <div className="flex flex-col gap-[7px] mb-4">
            {[msg("Two lists — tested picks, and everything else"), msg("Pick a platform and a service"), msg("Choose a tier — how long the refill lasts")].map((line, i) => (
              <div key={line} className="flex items-center gap-2.5 text-[12.5px]" style={{ color: sub }}>
                <span className="w-5 h-5 rounded-md flex items-center justify-center shrink-0 text-[10.5px] font-extrabold"
                  style={{ background: dark ? "rgba(255,255,255,.06)" : "rgba(0,0,0,.04)", color: accent }}>{i + 1}</span>
                {tr(line)}
              </div>
            ))}
          </div>
          {eligible && (
            <div className="flex items-center gap-2 rounded-lg py-2 px-3 mb-3" style={{ background: greenBg, border: `1px solid ${greenBorder}` }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={green} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0"><path d="M20 12v10H4V12"/><path d="M2 7h20v5H2z"/><path d="M12 22V7"/><path d="M12 7H7.5a2.5 2.5 0 010-5C11 2 12 7 12 7z"/><path d="M12 7h4.5a2.5 2.5 0 000-5C13 2 12 7 12 7z"/></svg>
              <span className="text-[11px] font-semibold" style={{ color: green }}>{tr("Up to")} {money(MAX_BONUS_NAIRA, { round: "down" })} {tr("free on your first deposit")}</span>
            </div>
          )}
          <div className="flex gap-2.5">
            <button onClick={finish} className="py-3 px-4 rounded-xl text-[13px] font-semibold bg-transparent cursor-pointer font-[inherit] shrink-0 transition-all duration-200 hover:-translate-y-px" style={{ color: sub, border: `1px solid ${border}` }}>{tr("Skip")}</button>
            <button onClick={startTour} className="py-3 px-0 rounded-xl text-sm font-semibold border-none cursor-pointer font-[inherit] flex-1 transition-all duration-200 hover:-translate-y-px hover:shadow-[0_6px_20px_rgba(196,125,142,.35)]" style={{ background: accent, color: "#fff" }}>{tr("Show me how")}</button>
          </div>
        </div>
      )}

      {/* Resume notice — only on the step the tour was restored onto. */}
      {phase === "touring" && resumed && (
        <div className="fixed z-[212] top-4 left-1/2 -translate-x-1/2 flex items-center gap-2 py-1.5 ps-3 pe-1.5 rounded-full text-[11px] font-semibold whitespace-nowrap"
          style={{ background: bg, border: `1px solid ${border}`, color: sub, boxShadow: "0 8px 22px rgba(0,0,0,.2)" }}>
          {tr("Picked up where you stopped")}
          <button onClick={() => { setResumed(false); setStep(0); setAnimKey(k => k + 1); }}
            className="border-none rounded-full text-[10px] font-bold cursor-pointer font-[inherit] py-1 px-2.5" style={{ background: accent, color: "#fff" }}>{tr("Restart")}</button>
        </div>
      )}

      {/* TOUR STEP CARD */}
      {phase === "touring" && (
        <div key={animKey} data-tour-tooltip role="dialog" aria-modal="false"
          aria-label={`${tr("Step")} ${step + 1} ${tr("of")} ${STEPS.length} — ${tr(STEPS[step].title)}. ${tr("Esc to exit")}`}
          className="fixed z-[211] rounded-2xl py-5 px-5 max-w-[320px] w-[calc(100%-32px)]" style={{
          ...tooltipPos,
          animation: "otFadeIn 0.3s cubic-bezier(.4,0,.2,1)",
          background: bg, border: `1px solid ${border}`,
          boxShadow: dark ? "0 16px 48px rgba(0,0,0,0.55), 0 0 0 1px rgba(196,125,142,.08)" : "0 16px 48px rgba(0,0,0,0.1), 0 0 0 1px rgba(0,0,0,.04)",
        }}>
          {/* Step indicator + icon. The counter counts the steps you actually
              walk. It used to read "of STEPS.length" (six) beside a row of dots
              built from totalDots (seven for a bonus-eligible user), so the two
              halves of the same progress display disagreed on screen. */}
          {/* Icon and title on one line, as the mockup had it. This used to
              spend the whole header on "STEP 1 OF 6" in accent caps with an
              "Esc to exit" chip opposite, pushing the actual heading onto a
              third row — three pieces of chrome above one sentence. The rail
              below already says how far along you are, and Escape still works;
              it is announced to screen readers rather than shouted on screen.
              tr() at render — STEPS holds msg()-marked English keys, because a
              hook cannot be called at module scope where the array is defined. */}
          <div className="flex items-center gap-2.5 mb-2">
            <div className="w-9 h-9 rounded-[10px] flex items-center justify-center shrink-0" style={{ background: dark ? "rgba(196,125,142,0.12)" : "rgba(196,125,142,0.07)", color: accent }}>{STEPS[step].icon}</div>
            <div className="text-[15px] font-bold leading-tight" style={{ color: text }}>{tr(stepTitle)}</div>
          </div>
          <div className="text-[12.5px] leading-[1.55] mb-4" style={{ color: sub }}>{tr(stepDesc)}</div>

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
        <div className="fixed z-[211] top-1/2 left-1/2 rounded-2xl pt-7 px-6 pb-6 max-w-[370px] w-[calc(100%-32px)]" style={{
          transform: "translate(-50%, -50%)",
          background: bg, border: `1px solid ${border}`,
          boxShadow: dark ? "0 16px 48px rgba(0,0,0,0.55), 0 0 0 1px rgba(196,125,142,.08)" : "0 16px 48px rgba(0,0,0,0.1), 0 0 0 1px rgba(0,0,0,.04)",
          animation: "otWelcomeFadeIn 0.35s cubic-bezier(.4,0,.2,1)",
        }}>
          {/* Rows, not tiles.
              Three tiles of equal weight made the choice read as "which
              number" rather than "what do I get" — and the figure that actually
              answers the question, what you end up with to spend, was nowhere
              on the card. Amount, bonus and total are a row each and cannot
              line up across three columns.
              Every figure comes from BONUS_PRESETS, so they follow the ladder
              whenever it is restored and there is nothing here to edit. */}
          <div className="flex items-center gap-3 mb-3.5">
            <div className="w-[38px] h-[38px] rounded-xl flex items-center justify-center shrink-0" style={{ background: greenBg, color: green }}>
              <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/></svg>
            </div>
            <div className="text-[17px] font-bold leading-tight" style={{ color: text }}>{tr("Add funds to place it")}</div>
          </div>
          <div className="text-[13px] leading-[1.6] mb-4" style={{ color: sub }}>{tr("Your first deposit earns free credit to spend on Nitro.")}</div>

          <div className="flex flex-col gap-2 mb-4">
            {BONUS_PRESETS.map((p, i) => (
              <div key={p.amount} className="relative flex items-center gap-3 rounded-xl py-2.5 px-3.5" style={{
                background: i === 1 ? greenBg : "transparent",
                border: `1px solid ${i === 1 ? greenBorder : border}`,
              }}>
                {i === 1 && (
                  <span className="absolute -top-2 end-3 text-[9px] font-extrabold uppercase tracking-[.6px] rounded-full px-2 py-px" style={{ background: green, color: "#fff" }}>{tr("Best value")}</span>
                )}
                <span className="m text-[15px] font-bold min-w-[72px]" style={{ color: i === 1 ? green : text }}>{money(p.amount)}</span>
                <span className="text-[12px] font-bold rounded-full px-2 py-px" style={{ background: greenBg, color: green, border: `1px solid ${greenBorder}` }}>+{money(p.bonus, { round: "down" })}</span>
                <span className="ms-auto text-[11.5px]" style={{ color: sub }}>{money(p.amount + p.bonus, { round: "down" })} {tr("to spend")}</span>
              </div>
            ))}
          </div>

          <div className="flex gap-2.5 flex-row-reverse">
            <button onClick={() => { finish(); onTopUp?.(); }} className="py-3 px-0 rounded-xl text-sm font-semibold border-none cursor-pointer font-[inherit] flex-1 transition-all duration-200 hover:-translate-y-px hover:shadow-[0_6px_20px_rgba(5,150,105,.3)]" style={{ background: dark ? "#059669" : "#059669", color: "#fff" }}>{tr("Add funds →")}</button>
            <button onClick={finish} className="py-3 px-4 rounded-xl text-[13px] font-semibold bg-transparent shrink-0 cursor-pointer font-[inherit] transition-all duration-200 hover:-translate-y-px" style={{ color: sub, border: `1px solid ${border}` }}>{tr("Maybe later")}</button>
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
