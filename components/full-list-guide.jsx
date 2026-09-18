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
 * It used to argue for an annotated row and then not draw one — six chips in a
 * column, each with a paragraph beside it, 1,060 characters of prose about
 * things sitting three centimetres away on the list behind the sheet. Naming a
 * badge in the abstract costs a sentence; pointing at it costs four words.
 *
 * So the row is the guide. A real one, built from the same pieces the list
 * draws, with a numbered pin on each part and the six lines below keyed to
 * those numbers. The pins are children of the elements they mark rather than
 * absolutely placed against measured geometry, so nothing needs re-measuring
 * on resize and a translated label cannot drag a pin off its badge.
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
  const well = dark ? "rgba(255,255,255,.03)" : "rgba(0,0,0,.02)";
  const good = dark ? "#6ee7b7" : "#059669";
  const goodBg = dark ? "rgba(110,231,183,.13)" : "rgba(5,150,105,.10)";
  const quiet = dark ? "rgba(255,255,255,.08)" : "rgba(0,0,0,.05)";

  // One pin, sitting on the thing it names. `inset-inline-end` rather than
  // `right`, so the RTL build has no physical rule to mirror and no [dir]
  // selector to out-specify.
  const Pin = ({ n }) => (
    <span
      aria-hidden="true"
      className="absolute -top-[7px] inline-flex items-center justify-center rounded-full text-[9.5px] font-bold"
      style={{
        insetInlineEnd: -7, width: 15, height: 15,
        background: t.accent, color: "#fff", boxShadow: `0 0 0 2px ${card}`,
      }}
    >{n}</span>
  );

  // Each line: the number on the row, what it is, and the one sentence that
  // makes it useful. Six facts, none longer than a breath.
  const POINTS = [
    [1, tr("Service ID"), tr("Search it to find this one again. Resellers order by it.")],
    [2, tr("Refill"), tr("Tops your count back up if it drops.")],
    [3, tr("Start time"), tr("Instant means minutes. Otherwise, up to 24 hours.")],
    [4, tr("Quality grade"), tr("How good the accounts are. UHQ is the highest.")],
    [5, tr("Buyer votes"), tr("The share of buyers who gave it a thumbs up.")],
    [6, tr("Save"), tr("Keeps it on your Saved tab. Free, and no order needed.")],
  ];

  const badge = (bg, color) => ({
    background: bg, color,
    fontSize: "10.5px", fontWeight: 600, padding: "1.5px 6px", borderRadius: 5, whiteSpace: "nowrap",
  });

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
        className="w-full md:max-w-[500px] max-h-[86vh] overflow-y-auto rounded-t-2xl md:rounded-2xl"
        style={{ background: card, border: `1px solid ${t.cardBorder}`, boxShadow: "0 24px 60px rgba(0,0,0,.4)" }}
      >
        <div className="flex items-start gap-3 p-5 pb-4">
          <div className="min-w-0 flex-1">
            <h2 className="text-[17px] font-bold m-0" style={{ color: t.text }}>{tr("How to read this list")}</h2>
            <p className="text-[12.5px] leading-[1.55] mt-1.5 m-0" style={{ color: t.textMuted }}>
              {tr("What every part of a row tells you.")}
            </p>
          </div>
          <button onClick={onClose} aria-label={tr("Close")} className="nitro-x shrink-0" style={{ color: t.textMuted }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
          </button>
        </div>

        {/* The row itself — the same shape full-list.jsx draws, one step larger
            so six pins have room to sit without crowding the badges. */}
        <div className="mx-5 mb-1 pt-3 pb-3 px-3 rounded-xl" style={{ background: well, border: `1px solid ${rail}` }}>
          <div className="flex items-center gap-3" aria-hidden="true">
            <span className="shrink-0 w-[34px] h-[34px] rounded-[10px] inline-flex items-center justify-center"
              style={{ background: t.accentLight, color: t.accentInk }}>
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M19 8v6M22 11h-6" /></svg>
            </span>

            <span className="min-w-0 flex-1">
              {/* Sample data, like the id and the price beside it — a service
                  name is a product, not copy, and the list never translates one. */}
              <span className="block text-[13.5px] font-semibold truncate" style={{ color: t.text }}>
                Instagram Followers
              </span>
              <span className="relative inline-block m text-[10.5px] mt-[3px] leading-none"
                style={{ color: t.textMuted, fontFamily: "'JetBrains Mono', monospace" }}>
                #4821<Pin n={1} />
              </span>
              <span className="flex items-center gap-1.5 flex-wrap mt-[7px]">
                <span className="relative inline-flex" style={badge(goodBg, good)}>{tr("30-day refill")}<Pin n={2} /></span>
                <span className="relative inline-flex" style={badge(quiet, t.textSoft)}>{tr("Instant")}<Pin n={3} /></span>
                <span className="relative inline-flex" style={badge(quiet, t.textSoft)}>UHQ<Pin n={4} /></span>
                <span className="relative inline-flex items-center gap-1" style={badge(goodBg, good)}>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><path d="M2 20h2c.55 0 1-.45 1-1v-9c0-.55-.45-1-1-1H2v11zm19.83-7.12c.11-.25.17-.52.17-.8V11c0-1.1-.9-2-2-2h-5.5l.92-4.65c.05-.22.02-.46-.08-.66a4.8 4.8 0 0 0-.79-1.06L14 2 7.59 8.41C7.21 8.79 7 9.3 7 9.83v7.84A2.34 2.34 0 0 0 9.34 20h8.11c.7 0 1.36-.37 1.72-.97l2.66-6.15z" /></svg>
                  86%<Pin n={5} />
                </span>
              </span>
            </span>

            <span className="relative shrink-0 inline-flex" style={{ color: dark ? "#e0a458" : "#b45309", opacity: .55 }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26" /></svg>
              <Pin n={6} />
            </span>

            <span className="text-end shrink-0">
              <span className="block m text-[14.5px] font-bold" style={{ color: "var(--t-accent-ink)", fontFamily: "'JetBrains Mono', monospace" }}>₦1,450</span>
              <span className="block text-[10px] mt-px" style={{ color: t.textMuted }}>{tr("per 1K")}</span>
            </span>
          </div>
        </div>

        <div className="px-5 pb-2">
          {POINTS.map(([n, title, body]) => (
            <div key={n} className="flex gap-2.5 py-[9px]" style={{ borderTop: `1px solid ${rail}` }}>
              <span
                aria-hidden="true"
                className="shrink-0 inline-flex items-center justify-center rounded-full text-[9.5px] font-bold mt-[2px]"
                style={{ width: 15, height: 15, background: t.accentLight, color: t.accentInk }}
              >{n}</span>
              <div className="min-w-0">
                <b className="text-[12.5px] font-semibold" style={{ color: t.text }}>{title}</b>{" "}
                <span className="text-[12px] leading-[1.5]" style={{ color: t.textMuted }}>{body}</span>
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
