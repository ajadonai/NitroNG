'use client';
import { useEffect } from "react";
import { useT } from "./locale";

/**
 * How to read a full-list row.
 *
 * The order tour cannot teach this. It deliberately forces the curated view —
 * `if (tourActive && view === "full") switchView("nitro")` — because its whole
 * argument is that Nitro tests the picks, and it would be walking somebody
 * through a list that says plainly it has tested nothing. So the full list has
 * never had a guide, while carrying the densest row on the site: a name, an ID,
 * three or four badges, a rating and a price, most of which mean something
 * specific that nothing on the page explains.
 *
 * A short sheet rather than a second spotlight tour. There are six facts worth
 * knowing and they are all visible in one row, so an annotated row teaches them
 * faster than six steps walking across the screen — and it can be reopened,
 * which a tour that fires once cannot.
 *
 * It follows the house modal rules: the page behind does not scroll, the
 * backdrop closes it and nothing else, and the surface is an opaque card.
 */
export function FullListGuide({ open, onClose, dark, t }) {
  const tr = useT();

  useEffect(() => {
    if (!open) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = prev; document.removeEventListener("keydown", onKey); };
  }, [open, onClose]);

  if (!open) return null;

  const card = dark ? "#171126" : "#ffffff";
  const rail = dark ? "rgba(255,255,255,.08)" : "rgba(0,0,0,.06)";

  // Each row: the thing on screen, and the one sentence that makes it useful.
  const POINTS = [
    ["#4821", tr("The service ID"), tr("Every service keeps the same ID for as long as we carry it, so this is how you find one again — paste it into the search box. It is also the ID a reseller uses through the API.")],
    [tr("30-day refill"), tr("What happens if it drops"), tr("The provider's own promise, not ours. Some say 30 days, some say lifetime, some say no refill at all — and a service with no refill is a cheaper product, not a broken one.")],
    [tr("Instant"), tr("When it starts"), tr("Instant means minutes. Anything without it says 0-24 hours, which is the outside edge rather than a prediction. A precise figure like “Starts in 0-3 min” is the provider's own.")],
    ["UHQ · HQ", tr("What the accounts are like"), tr("The provider's grade: ultra high quality and high quality. It is their word, not a Nitro test — which is what the whole of this list is.")],
    ["★", tr("Save it for next time"), tr("A list this size is hard to search twice. The star keeps a service on your Saved tab, and unlike the rating it costs nothing and needs no order behind it.")],
    ["\u{1F44D} 86%", tr("What other buyers said"), tr("The only opinion on this list that is not the provider's. It appears once three people who actually ordered it have voted, and you can only vote on something you have bought.")],
  ];

  return (
    <div
      className="fixed inset-0 z-[10000] flex items-end md:items-center justify-center p-0 md:p-5"
      style={{ background: "rgba(10,6,14,.55)" }}
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={tr("How to read this list")}
        onClick={(e) => e.stopPropagation()}
        className="w-full md:max-w-[520px] max-h-[86vh] overflow-y-auto rounded-t-2xl md:rounded-2xl"
        style={{ background: card, border: `1px solid ${t.cardBorder}`, boxShadow: "0 24px 60px rgba(0,0,0,.4)" }}
      >
        <div className="flex items-start gap-3 p-5 pb-3">
          <div className="min-w-0 flex-1">
            <h2 className="text-[17px] font-bold m-0" style={{ color: t.text }}>{tr("How to read this list")}</h2>
            <p className="text-[12.5px] leading-[1.55] mt-1.5 m-0" style={{ color: t.textMuted }}>
              {tr("Nitro has not tested anything here. Every row carries the provider's own terms, printed on the row, and these are the six things worth reading before you order.")}
            </p>
          </div>
          <button onClick={onClose} aria-label={tr("Close")} className="nitro-x shrink-0" style={{ color: t.textMuted }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="px-5 pb-2">
          {POINTS.map(([chip, title, body]) => (
            <div key={title} className="flex gap-3 py-3" style={{ borderTop: `1px solid ${rail}` }}>
              <span
                className="m shrink-0 inline-flex items-center justify-center text-[10.5px] font-bold rounded-[6px] px-2 h-[22px] mt-[1px]"
                style={{ fontFamily: "'JetBrains Mono', monospace", background: dark ? "rgba(196,125,142,.16)" : "rgba(196,125,142,.12)", color: t.accentInk, minWidth: 44 }}
              >{chip}</span>
              <div className="min-w-0">
                <b className="block text-[13.5px] font-semibold" style={{ color: t.text }}>{title}</b>
                <span className="block text-[12.5px] leading-[1.55] mt-0.5" style={{ color: t.textMuted }}>{body}</span>
              </div>
            </div>
          ))}
        </div>

        <div className="p-5 pt-3" style={{ borderTop: `1px solid ${rail}` }}>
          <button
            onClick={onClose}
            className="w-full py-3 rounded-full text-[14px] font-bold border-none cursor-pointer font-[inherit] text-white"
            style={{ background: t.accent }}
          >{tr("Got it")}</button>
        </div>
      </div>
    </div>
  );
}
