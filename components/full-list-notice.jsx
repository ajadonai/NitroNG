'use client';
import { useEffect } from "react";
import { useT } from "./locale";

/**
 * "New Order has two lists now" — shown once, to the people the change is news
 * to.
 *
 * WHO. Accounts that existed before the full list shipped. Somebody who signs
 * up afterwards meets both lists in step one of the order tour and does not
 * need telling that a page they have never seen has changed. The cutoff is the
 * account's own createdAt against FULL_LIST_LAUNCH_AT below — no migration, no
 * backfill, and no admin switch to forget to flip.
 *
 * WHEN. After the WhatsApp prompt, never beside it. A Gmail signup with no
 * phone number has two cards due on the same visit and should see both, one
 * after the other; the dashboard owns that order (see the queue there). The
 * order tour comes after this one.
 *
 * ONCE. Dismissing writes the same nitro_full_list_seen flag the "New" badge on
 * the Full list half already reads, so the two can never both be shouting about
 * the same thing: whoever sees this modal never sees that badge, and anybody
 * who somehow slips past the modal still gets the badge as a quieter backup.
 * Per-device, like the badge it shares a key with.
 */

// The day the full list reached customers. Accounts older than this get the
// notice; newer ones get the tour, which teaches both lists from the start.
//
// MUST match the day this actually deploys. Set it wrong in the past and
// nobody is told; wrong in the future and every new signup is told about a
// change they never lived through.
export const FULL_LIST_LAUNCH_AT = new Date("2026-09-16T00:00:00Z");
export const FULL_LIST_SEEN_KEY = "nitro_full_list_seen";

/** Is this account old enough to be surprised by the full list? */
export function fullListIsNewsTo(user, now = FULL_LIST_LAUNCH_AT) {
  if (!user?.createdAt) return false;
  const made = new Date(user.createdAt);
  if (Number.isNaN(made.getTime())) return false;
  return made < now;
}

/** Has this device already been told? */
export function fullListAlreadySeen() {
  try { return !!localStorage.getItem(FULL_LIST_SEEN_KEY); } catch { return false; }
}

export function markFullListSeen() {
  try { localStorage.setItem(FULL_LIST_SEEN_KEY, "1"); } catch {}
}

export default function FullListNotice({ dark, onClose, onShowMe }) {
  const tr = useT();

  // It owns the screen while it is up, like every other overlay in the app.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e) => { if (e.key === "Escape") onClose?.(); };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  const card = dark ? "#1a1329" : "#ffffff";
  const brd = dark ? "rgba(196,125,142,.22)" : "rgba(0,0,0,.1)";
  const text = dark ? "#f5f3f0" : "#1c1b19";
  const sub = dark ? "rgba(255,255,255,.72)" : "rgba(0,0,0,.66)";
  const accent = "#c47d8e";
  const accentBg = dark ? "rgba(196,125,142,.12)" : "rgba(196,125,142,.07)";
  const blue = dark ? "#7aa2f7" : "#1d5fa5";
  const blueBg = dark ? "rgba(122,162,247,.12)" : "#eaf1fa";

  return (
    <div role="presentation" onClick={onClose}
      className="fixed inset-0 z-[220] flex items-center justify-center p-5 backdrop-blur-[3px]"
      style={{ background: "rgba(6,3,10,.6)" }}>
      <div role="dialog" aria-modal="true" aria-label={tr("New Order has two lists now")}
        onClick={e => e.stopPropagation()}
        className="w-[400px] max-w-full rounded-[18px] p-[22px]"
        style={{ background: card, border: `1px solid ${brd}`, boxShadow: "0 24px 60px rgba(0,0,0,.4)" }}>

        <span className="inline-flex items-center text-[9.5px] font-extrabold uppercase tracking-[.7px] rounded-full px-[9px] py-[3px] mb-[11px]"
          style={{ background: blueBg, color: blue }}>{tr("New")}</span>

        <div className="flex items-center gap-[11px] mb-[11px]">
          <span className="w-[38px] h-[38px] rounded-[11px] flex items-center justify-center shrink-0" style={{ background: accentBg, color: accent }}>
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
          </span>
          <h3 className="m-0 text-[17px] font-bold leading-tight tracking-[-.3px]" style={{ color: text }}>{tr("New Order has two lists now")}</h3>
        </div>

        {/* Written for somebody who has ordered here before — which is exactly
            who gets this. A newer account meets both lists in the tour. */}
        <p className="m-0 mb-[14px] text-[13px] leading-[1.6]" style={{ color: sub }}>
          {tr("You have been ordering from the tested ones. There is a second list underneath them.")}
        </p>

        <div className="grid grid-cols-2 gap-[9px] mb-4">
          <div className="rounded-xl p-[11px]" style={{ border: `1px solid ${brd}` }}>
            <b className="block text-[12.5px] mb-[3px]" style={{ color: accent }}>{tr("Nitro picks")}</b>
            <span className="block text-[11px] leading-[1.45]" style={{ color: sub }}>{tr("What you have been using. Tested weekly, refill-backed.")}</span>
          </div>
          <div className="rounded-xl p-[11px]" style={{ background: blueBg, border: `1px solid ${dark ? "rgba(122,162,247,.35)" : "rgba(29,95,165,.25)"}` }}>
            <b className="block text-[12.5px] mb-[3px]" style={{ color: blue }}>{tr("Full list")}</b>
            <span className="block text-[11px] leading-[1.45]" style={{ color: sub }}>{tr("Everything else we carry. Cheaper and far wider, sold as listed.")}</span>
          </div>
        </div>

        <div className="flex gap-[9px]">
          <button onClick={onClose}
            className="flex-[0_0_34%] text-[13px] font-semibold py-3 rounded-[11px] cursor-pointer font-[inherit] bg-transparent transition-transform duration-150 hover:-translate-y-px"
            style={{ color: sub, border: `1px solid ${brd}` }}>{tr("Dismiss")}</button>
          <button onClick={onShowMe}
            className="flex-1 text-[13.5px] font-bold py-3 rounded-[11px] border-none cursor-pointer font-[inherit] text-white transition-transform duration-150 hover:-translate-y-px"
            style={{ background: accent }}>{tr("Show me")}</button>
        </div>
      </div>
    </div>
  );
}
