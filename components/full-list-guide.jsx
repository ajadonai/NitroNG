'use client';
import { useEffect, useState } from "react";
import { useT } from "./locale";
import { OffsetIcon } from "./offset-icons";
import { ServiceGlyph } from "./service-glyph";
import { Chip } from "./full-list-chip";

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
 * So the row is the guide: a real one, drawn with the list's own Chip (17 Oct
 * 2026, mockup "How to Read the Full List") so its colours are the list's, with
 * a numbered pin hanging clear of each part and the lines below keyed to those
 * numbers. Pointing at a line, or tapping it, lights its part of the row. The
 * pins are children of the elements they mark rather than placed against
 * measured geometry, so nothing needs re-measuring on resize and a translated
 * label cannot drag a pin off its badge.
 *
 * It follows the house modal rules: the page behind does not scroll, the
 * backdrop closes it and nothing else, and the surface is an opaque card.
 */
const FLG_CSS = `
.flg-spec{margin:16px 20px 0;padding:12px 14px 30px;border-radius:16px;background-color:var(--flg-well);background-image:radial-gradient(var(--t-card-border) 1px,transparent 1px);background-size:14px 14px;box-shadow:inset 0 0 0 1px var(--t-card-border)}
.flg-lab{font-size:10px;font-weight:700;letter-spacing:1.4px;text-transform:uppercase;color:var(--t-text-muted)}
.flg-row{display:flex;align-items:center;gap:12px;margin-top:10px;padding:12px 14px;border-radius:13px;background:var(--flg-card);box-shadow:inset 0 0 0 1px var(--t-card-border)}
.flg-chips{display:flex;flex-wrap:wrap;gap:30px 6px;margin-top:7px}
.flg-part{position:relative;display:inline-flex;border-radius:6px;transition:box-shadow .15s}
.flg-hot .flg-part.on{box-shadow:0 0 0 2px var(--flg-card),0 0 0 4px #c47d8e}
.flg-pin{position:absolute;z-index:2;width:18px;height:18px;border-radius:50%;display:grid;place-items:center;font-family:'JetBrains Mono',monospace;font-size:10px;font-weight:800;line-height:1;color:var(--flg-pin-ink);background:var(--flg-pin);box-shadow:1.5px 1.5px 0 #6b3a4a;transition:transform .15s}
.flg-pin.below{top:calc(100% + 5px);left:50%;margin-left:-9px}
.flg-pin.below::before{content:"";position:absolute;bottom:100%;left:50%;width:1.5px;height:5px;margin-left:-.75px;background:var(--flg-pin)}
.flg-pin.beside{top:50%;margin-top:-9px}
.flg-hot .flg-pin.on{transform:scale(1.25)}
.flg-li{display:flex;align-items:flex-start;gap:11px;width:100%;padding:10px 6px;border:0;border-top:1px solid var(--t-card-border);border-radius:8px;background:none;font:inherit;text-align:start;cursor:pointer}
.flg-li:first-child{border-top:0}
.flg-li .flg-pin{position:static;flex-shrink:0;margin-top:1px}
.flg-li:focus-visible{outline:2px solid var(--t-accent);outline-offset:-2px}
.flg-hot .flg-li.on{background:rgba(196,125,142,.12)}
.flg-box{margin:10px 20px 0;padding:13px 14px;border-radius:14px}
@media (max-width:767px){.flg-spec{margin-inline:16px}.flg-box{margin-inline:16px}.flg-row{gap:10px;padding:11px}}
@media (prefers-reduced-motion:reduce){.flg-pin,.flg-part{transition:none}}
`;

export function FullListGuide({ open, onClose, dark, t }) {
  const tr = useT();
  const [hot, setHot] = useState(0);

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
  const print = dark ? "#6b3a4a" : "#efc4cf";

  // One pin, hanging clear of the thing it names: under a chip on a short
  // stem, beside the ID. `insetInlineEnd` rather than `right`, so the RTL build
  // has no physical rule to mirror and no [dir] selector to out-specify.
  const Pin = ({ n }) => (
    <span aria-hidden="true" className={`flg-pin ${n === 1 ? "beside" : "below"}${hot === n ? " on" : ""}`}
      style={n === 1 ? { insetInlineEnd: -27 } : undefined}>{n}</span>
  );
  const on = (n) => (hot === n ? " on" : "");

  // Each line: the number on the row, what it is, and the one sentence that
  // makes it useful. Seven parts, none longer than a breath.
  const POINTS = [
    [1, tr("Service ID"), tr("Search it to find this one again. Resellers order by it.")],
    [2, tr("Refill"), tr("Tops your count back up if it drops.")],
    [3, tr("Whose accounts"), tr("Where the accounts are from. Nigerian and USA carry their own colours.")],
    [4, tr("Quality grade"), tr("How good the accounts are. UHQ is the highest.")],
    [5, tr("Buyer votes"), tr("The share of buyers who gave it a thumbs up, once enough have voted.")],
    [6, tr("Ordered before"), tr("How many times you have bought it. Only you see this.")],
    [7, tr("Save"), tr("Keeps it on your Saved tab. Free, and no order needed.")],
  ];

  return (
    <div
      className="fixed inset-0 z-[10000] flex items-end md:items-center justify-center p-0 md:p-5"
      style={{ background: "rgba(10,6,14,.55)" }}
      onClick={onClose}
      role="presentation"
    >
      <style>{FLG_CSS}</style>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={tr("How to read this list")}
        onClick={(e) => e.stopPropagation()}
        className={`w-full md:max-w-[540px] max-h-[88vh] flex flex-col rounded-t-3xl md:rounded-[22px]${hot ? " flg-hot" : ""}`}
        style={{ background: card, boxShadow: `inset 0 0 0 1px ${t.cardBorder}, 5px 5px 0 rgba(10,6,14,.35)`, "--flg-card": card, "--flg-well": dark ? "rgba(255,255,255,.035)" : "#f7f1ec", "--flg-pin": dark ? "#e9b0bf" : "#96626f", "--flg-pin-ink": dark ? "#241019" : "#fff" }}
      >
        <div className="overflow-y-auto pb-2">
          <div className="flex items-start gap-3 px-5 pt-5 max-md:px-4">
            <span className="ic-tile" style={{ width: 40, height: 40, borderRadius: 12 }}><OffsetIcon name="book" size={19} /></span>
            <div className="min-w-0 flex-1">
              <h2 className="serif text-[28px] max-md:text-[25px] font-semibold leading-[1.05] m-0" style={{ color: t.text }}>{tr("How to read this list")}</h2>
              <p className="text-[13px] leading-[1.5] mt-1.5 m-0" style={{ color: t.textMuted }}>{tr("What every part of a row tells you.")}</p>
            </div>
            <button onClick={onClose} aria-label={tr("Close")} className="nitro-x shrink-0" style={{ width: 34, height: 34, borderRadius: 11, color: t.textSoft, background: card, boxShadow: `inset 0 0 0 1px ${t.cardBorder}, 2px 2px 0 ${print}` }}>
              <OffsetIcon name="close" size={13} />
            </button>
          </div>

          {/* The row itself, drawn with the list's own pieces. Sample data, like
              the id and the price beside it: a service name is a product, not
              copy, and the list never translates one. */}
          <div className="flg-spec">
            <span className="flg-lab">{tr("A row from the list")}</span>
            <div className="flg-row" aria-hidden="true">
              <ServiceGlyph type="followers" tone={t.accentInk} dark={dark} size={34} radius={10} print />
              <span className="min-w-0 flex-1">
                <span className="block text-[14px] font-semibold truncate" style={{ color: t.text }}>Instagram Followers</span>
                <span className={`flg-part m text-[10.5px] mt-[3px] leading-none${on(1)}`} style={{ color: t.textMuted, fontFamily: "'JetBrains Mono', monospace" }}>#4821<Pin n={1} /></span>
                <span className="flg-chips">
                  <span className={`flg-part${on(2)}`}><Chip kind="refill" dark={dark}>{tr("30-day refill")}</Chip><Pin n={2} /></span>
                  <span className={`flg-part${on(3)}`}><Chip kind="ng" dark={dark}>{tr("Nigerian")}</Chip><Pin n={3} /></span>
                  <span className={`flg-part${on(4)}`}><Chip kind="quality" dark={dark}>UHQ</Chip><Pin n={4} /></span>
                  <span className={`flg-part${on(5)}`}><Chip kind="refill" dark={dark}><OffsetIcon name="thumbUp" size={11} />86%</Chip><Pin n={5} /></span>
                  <span className={`flg-part${on(6)}`}>
                    <span className="inline-flex items-center gap-1 text-[10.5px] font-semibold rounded-[5px] px-[6px] py-[1.5px] whitespace-nowrap" style={{ color: t.accentInk, background: t.accentLight }}><OffsetIcon name="clock" size={10} />{tr("Ordered")} 2×</span>
                    <Pin n={6} />
                  </span>
                </span>
              </span>
              <span className={`flg-part shrink-0${on(7)}`} style={{ color: dark ? "#e0a458" : "#b45309" }}><OffsetIcon name="star" size={16} /><Pin n={7} /></span>
              <span className="text-end shrink-0">
                <span className="block m text-[15px] font-bold" style={{ color: "var(--t-accent-ink)", fontFamily: "'JetBrains Mono', monospace" }}>₦1,450</span>
                <span className="block text-[10px] mt-px" style={{ color: t.textMuted }}>{tr("per 1K")}</span>
              </span>
            </div>
          </div>

          <div className="px-5 pt-3 max-md:px-4">
            {POINTS.map(([n, title, body]) => (
              <button key={n} type="button" className={`flg-li${on(n)}`}
                onMouseEnter={() => setHot(n)} onMouseLeave={() => setHot(0)} onFocus={() => setHot(n)} onBlur={() => setHot(0)} onClick={() => setHot(n)}>
                <span className="flg-pin">{n}</span>
                <span className="text-[13.5px] leading-[1.5]" style={{ color: t.textSoft }}><b className="font-bold" style={{ color: t.text }}>{title}.</b> {body}</span>
              </button>
            ))}
          </div>

          {/* What the colours mean, and the part a row only shows when it has
              room: start time. A row carries two facts beyond refill, origin
              first, so the sample row cannot show it as well. */}
          <div className="flg-box" style={{ background: "var(--flg-well)", boxShadow: `inset 0 0 0 1px ${t.cardBorder}` }}>
            <b className="block text-[13px] font-bold" style={{ color: t.text }}>{tr("The colour says the kind of fact")}</b>
            <span className="flex flex-wrap gap-[7px] mt-2.5">
              <Chip kind="refill" dark={dark}>{tr("Refill")}</Chip>
              <Chip kind="quality" dark={dark}>UHQ</Chip>
              <Chip kind="speed" dark={dark}>{tr("Instant")}</Chip>
              <Chip kind="location" dark={dark}>{tr("Worldwide")}</Chip>
              <Chip kind="neutral" dark={dark}>{tr("No refill")}</Chip>
              <Chip kind="auto" dark={dark}>{tr("Auto")}</Chip>
            </span>
            <span className="block text-[12.5px] leading-[1.55] mt-2.5" style={{ color: t.textSoft }}>
              <b style={{ color: t.text }}>{tr("Start time")}.</b> {tr("Instant means minutes. Otherwise, up to 24 hours.")} {tr("It shows when a row has room for it.")}
            </span>
            <span className="block text-[12.5px] leading-[1.55] mt-1" style={{ color: t.textSoft }}>
              <b style={{ color: t.text }}>{tr("Grey")}.</b> {tr("A plain fact, not a fault. No refill is a cheaper product.")}
            </span>
          </div>

          {/* Not another pin. The parts above decode a row; this is a different
              kind of service that some rows are. It sits last because most
              people will never order one, but the ones who do were ordering
              them by accident, which is what this exists to stop. */}
          <div className="flg-box" style={{ background: card, boxShadow: `inset 0 0 0 1px ${dark ? "rgba(253,186,116,.35)" : "rgba(154,52,18,.3)"}, 2px 2px 0 ${dark ? "rgba(253,186,116,.25)" : "rgba(154,52,18,.2)"}` }}>
            <div className="flex items-center gap-2 mb-1.5">
              <Chip kind="auto" dark={dark}>{tr("Auto")}</Chip>
              <b className="text-[14px] font-bold" style={{ color: t.text }}>{tr("Auto services")}</b>
            </div>
            <span className="text-[12.5px] leading-[1.55] block" style={{ color: t.textSoft }}>
              <span className="block">{tr("Delivers to every post you make from now on, not to one post.")}</span>
              <span className="block mt-1">{tr("Give it your profile or channel link. Quantity is what each new post gets.")}</span>
              <span className="block mt-1">{tr("Filter the list by Auto to see them.")}</span>
            </span>
          </div>
        </div>

        <div className="px-5 pt-3 pb-5 max-md:px-4" style={{ borderTop: `1px solid ${t.cardBorder}` }}>
          <button onClick={onClose} className="nb pri lg full">{tr("Got it")}</button>
        </div>
      </div>
    </div>
  );
}
