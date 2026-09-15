'use client';
import { useState, useEffect, useMemo } from "react";
import { useMoney, useT } from "./locale";
import { msg } from "../lib/i18n";
import { attrKind, LOCATION_KEYS, matchesLocation } from "../lib/service-attrs";
import { NotSureHelp } from "./order-help";

/* ═══════════════════════════════════════════ */
/* ═══ FULL LIST                           ═══ */
/* ═══════════════════════════════════════════ */
//
// The other version of New Order. Nitro picks is the curated menu Nitro tests
// and stands behind; this is everything else the provider carries for the same
// platform — cheaper, dearer, faster, slower — at the provider's own terms.
//
// Nothing here is tested by Nitro and nothing here carries a Nitro refill, so
// the page says so once at the top rather than on every row, and the way back
// to a tested pick is never more than one tap. The only figure the list can
// honestly carry is what other customers thought, which is why the vote exists.

// Mirrors TYPES in lib/full-catalogue, in the order a customer looks for them.
const TYPE_ROW = [
  { key: "all", label: msg("All") },
  { key: "followers", label: msg("Followers") },
  { key: "members", label: msg("Members") },
  { key: "likes", label: msg("Likes") },
  { key: "views", label: msg("Views") },
  { key: "comments", label: msg("Comments") },
  { key: "shares", label: msg("Shares") },
  { key: "engagement", label: msg("Engagement") },
];

// Sort orders the list; the Refill only chip beside it decides what is in the
// list. "Refill first" used to sit in here too, which put the same word on two
// controls doing different things, and it was the weaker of the two anyway: it
// left every non-refill row underneath, so anyone who cared about refill
// scrolled through the rows they had just asked to come last.
//
// Every sort answers off a number the row holds exactly. Nothing is derived
// from the provider's free-text speed claims — "Instant start" and "5-50K/day"
// are the provider's words, and ranking them would turn a claim into a Nitro
// ordering on a list that says it has not tested anything.
//
// "Best rated" is offered only once something on the platform has enough votes
// to rank: a sort that cannot reorder anything is a control claiming an
// opinion it does not have.
const SORTS = [
  { key: "cheap", label: msg("Cheapest") },
  { key: "dear", label: msg("Dearest") },
  { key: "min", label: msg("Smallest order") },
  { key: "max", label: msg("Biggest orders") },
  { key: "rated", label: msg("Best rated"), needsVotes: true },
];

// Labels for the origins lib/service-attrs can recognise. The control offers
// only the ones the platform in front of you actually carries, so it never
// lists "Japanese" over three services or an origin over none — which is also
// why the options carry no count. Nothing offered is a dead end, and once one
// is picked the strip's own count says how many are left.
const LOCATION_LABELS = {
  nigerian: msg("Nigerian"), usa: msg("USA"), uk: msg("UK"),
  worldwide: msg("Worldwide"), european: msg("European"), indian: msg("Indian"),
  turkish: msg("Turkish"), brazilian: msg("Brazilian"), arab: msg("Arab"),
  african: msg("African"), asian: msg("Asian"), russian: msg("Russian"),
  german: msg("German"), french: msg("French"),
};
const LOCATION_FLAGS = {
  nigerian: "🇳🇬", usa: "🇺🇸", uk: "🇬🇧", brazilian: "🇧🇷", turkish: "🇹🇷",
  indian: "🇮🇳", russian: "🇷🇺", german: "🇩🇪", french: "🇫🇷",
};
// Below three a location is a coincidence, not a choice worth a menu row.
const LOCATION_MIN = 3;

// Price per 1K runs from ₦205 to ₦29.7M on this list, so a slider would be
// useless — almost the whole range is noise. Fixed bands instead, and these
// ones because they cut every platform into rough quarters: Instagram lands
// 119 / 208 / 227 / 380 across them, TikTok 217 / 221 / 162 / 240. Labelled
// through money() so the edges read in the viewer's currency, matched against
// the naira the row carries.
const PRICE_BANDS = [
  { key: "u1k", lo: 0, hi: 1000 },
  { key: "1k5k", lo: 1000, hi: 5000 },
  { key: "5k20k", lo: 5000, hi: 20000 },
  { key: "o20k", lo: 20000, hi: Infinity },
];

const PAGE = 120;
const OVERVIEW_PER_TYPE = 5;
// How many a section grows by when it is opened further. Fifteen is three more
// screenfuls of five on a phone and still short of the point where the other
// categories scroll out of reach — which is the whole reason the overview
// exists. The button shows the true remainder when it is smaller.
const OVERVIEW_STEP = 15;
// Below this nobody has said enough for a percentage to mean anything, so the
// row shows no figure at all rather than a number built from two opinions.
export const VOTES_NEEDED = 3;

export const THUMB_UP = <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 9V5a3 3 0 00-3-3l-4 9v11h11.28a2 2 0 002-1.7l1.38-9a2 2 0 00-2-2.3H14z"/><path d="M7 22H4a2 2 0 01-2-2v-7a2 2 0 012-2h3"/></svg>;
export const THUMB_DOWN = <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 15v4a3 3 0 003 3l4-9V2H5.72a2 2 0 00-2 1.7l-1.38 9a2 2 0 002 2.3H10z"/><path d="M17 2h3a2 2 0 012 2v7a2 2 0 01-2 2h-3"/></svg>;

/** "10K", "1.5M", or null when the provider means "no limit". */
export function formatMax(max, unlimited) {
  if (unlimited) return null;
  const n = Number(max);
  if (n >= 1_000_000) return `${(n / 1_000_000).toLocaleString(undefined, { maximumFractionDigits: 1 })}M`;
  if (n >= 1_000) return `${(n / 1_000).toLocaleString(undefined, { maximumFractionDigits: 1 })}K`;
  return n.toLocaleString();
}

/**
 * A fact's colour comes from what kind of fact it is, and every hue here is one
 * the page already owns: the tier palette from New Order (amber Budget, blue
 * Standard, violet Premium) plus the green the order form uses for refill.
 * Nothing new is invented, so a full-list row and a curated card read as the
 * same product.
 *
 * Only the facts worth a glance are coloured. "No refill" and the order size
 * stay neutral — one is a cheaper product, not an error, and the other is a
 * number, not a quality. Keeping them grey is what lets the rest carry weight.
 */
const CHIP = {
  refill:   { light: { fg: "#059669", bg: "rgba(5,150,105,.1)" },   dark: { fg: "#6ee7b7", bg: "rgba(110,231,183,.13)" } },
  // Nigerian and US accounts carry the colours the curated cards already give
  // those two audiences, so the same audience reads the same on both lists.
  // Every other origin keeps the neutral location blue — inventing a hue per
  // country would turn a row into a flag parade.
  ng:       { light: { fg: "#15803d", bg: "#e8f5ee" },              dark: { fg: "#4ade80", bg: "rgba(74,222,128,.14)" } },
  us:       { light: { fg: "#b91c1c", bg: "#fdeeee" },              dark: { fg: "#f87171", bg: "rgba(248,113,113,.14)" } },
  speed:    { light: { fg: "#b45309", bg: "#fdf3e7" },              dark: { fg: "#e0a458", bg: "rgba(224,164,88,.14)" } },
  quality:  { light: { fg: "#6d28d9", bg: "#f3ecfa" },              dark: { fg: "#a78bfa", bg: "rgba(167,139,250,.14)" } },
  location: { light: { fg: "#1d5fa5", bg: "#eaf1fa" },              dark: { fg: "#7aa2f7", bg: "rgba(122,162,247,.14)" } },
  neutral:  { light: { fg: "#6e6a65", bg: "rgba(0,0,0,.055)" },     dark: { fg: "#a09890", bg: "rgba(255,255,255,.08)" } },
};

function Chip({ kind = "neutral", dark, mono, children }) {
  const c = CHIP[kind][dark ? "dark" : "light"];
  return (
    <span className={`inline-flex items-center rounded-[5px] px-[6px] py-[1.5px] text-[10.5px] font-semibold whitespace-nowrap${mono ? " m" : ""}`}
      style={{ color: c.fg, background: c.bg, ...(mono ? { fontFamily: "'JetBrains Mono', monospace" } : {}) }}>
      {children}
    </span>
  );
}

/** A location chip takes its audience's colour where we have one for it. */
function chipKind(attr) {
  const kind = attrKind(attr);
  if (kind !== "location") return kind;
  if (matchesLocation(attr, "nigerian")) return "ng";
  if (matchesLocation(attr, "usa")) return "us";
  return "location";
}

// The text a row's origin and search are matched against: its Nitro label plus
// its attributes, because only "Nigerian" and "Worldwide" are attributes —
// USA, Indian and Turkish live in the name and nowhere else.
const hay = (r) => `${r.label} ${(r.attrs || []).join(" ")}`;

export function approvalOf(row) {
  const total = (row.up || 0) + (row.down || 0);
  if (total < VOTES_NEEDED) return null;
  return Math.round((100 * row.up) / total);
}

function sortRows(rows, sort) {
  const l = rows.slice();
  if (sort === "dear") l.sort((a, b) => b.price - a.price || a.id - b.id);
  else if (sort === "max") l.sort((a, b) => b.max - a.max || a.price - b.price);
  // The smallest an order may be, for anyone testing a service before they
  // trust it. Minimums run from 10 to 4,000 on this list, so it is a real
  // question and not a tiebreak.
  else if (sort === "min") l.sort((a, b) => a.min - b.min || a.price - b.price);
  else if (sort === "rated") l.sort((a, b) => {
    const ra = approvalOf(a), rb = approvalOf(b);
    // Unrated rows are not bad rows. They fall to the back in price order
    // rather than being ranked as if silence were a low score.
    if (ra == null && rb == null) return a.price - b.price;
    if (ra == null) return 1;
    if (rb == null) return -1;
    // Same approval, more votes first: fifteen people at 90% is a firmer
    // number than three at 90%.
    return rb - ra || (b.up + b.down) - (a.up + a.down) || a.price - b.price;
  });
  else l.sort((a, b) => a.price - b.price || a.id - b.id);
  return l;
}

function Row({ row, dark, t, onPick, selected, first }) {
  const tr = useT();
  const money = useMoney();
  const mx = formatMax(row.max, row.unlimited);
  const approval = approvalOf(row);
  const attrs = row.attrs || [];
  // Both come from refillOf on the server, so the badge and the "Refill only"
  // filter can never disagree — #9364 used to read "No refill" and survive a
  // filter for refills, because the badge read the name and the filter read the
  // provider's flag.
  const refillText = row.refillLabel || (row.refill ? tr("Refill") : tr("No refill"));
  // Three facts beyond refill and size on a desktop, two on a phone. The cap is
  // the point: a row that badges everything is the grey line again in colour.
  const rest = attrs.filter(a => attrKind(a) !== "refill").slice(0, 3);
  return (
    <div role="button" tabIndex={0} onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onPick(row); } }} onClick={() => onPick(row)}
      className="no-full-row flex items-center justify-between gap-3 py-2.5 px-3 md:py-3 md:px-4 cursor-pointer transition-colors duration-150"
      style={{ borderTop: first ? "none" : `1px solid ${t.cardBorder}`, background: selected ? (dark ? "rgba(196,125,142,.12)" : "rgba(196,125,142,.07)") : "transparent" }}>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2 min-w-0">
          <span className="m text-[11px] shrink-0" style={{ color: t.textMuted, fontFamily: "'JetBrains Mono', monospace" }}>#{row.id}</span>
          <span className="text-[13px] md:text-sm font-semibold truncate" style={{ color: t.text }}>{row.label}</span>
        </div>
        <div className="flex items-center gap-1 flex-wrap mt-[5px]">
          <Chip kind={row.refill ? "refill" : "neutral"} dark={dark}>{refillText}</Chip>
          <Chip dark={dark} mono>{row.min.toLocaleString()}{mx ? ` – ${mx}` : ` ${tr("and up")}`}</Chip>
          {rest.map((a, i) => (
            <span key={a} className={i === 2 ? "hidden md:inline-flex" : "inline-flex"}>
              <Chip kind={chipKind(a)} dark={dark}>{a}</Chip>
            </span>
          ))}
          {approval != null && (
            <span className="inline-flex items-center gap-1 px-[6px] py-[1.5px] rounded-[5px] text-[10.5px] font-semibold whitespace-nowrap"
              title={`${row.up} ${tr("up")}, ${row.down} ${tr("down")}`}
              style={{ color: approval >= 80 ? (dark ? "#6ee7b7" : "#059669") : t.textMuted, background: approval >= 80 ? (dark ? "rgba(110,231,183,.13)" : "rgba(5,150,105,.1)") : (dark ? "rgba(255,255,255,.08)" : "rgba(0,0,0,.055)") }}>
              <span className="w-3 h-3 inline-flex [&_svg]:w-3 [&_svg]:h-3">{THUMB_UP}</span>{approval}%
            </span>
          )}
        </div>
      </div>
      <div className="text-right shrink-0">
        <div className="m text-[14px] md:text-[15px] font-bold" style={{ color: "var(--t-accent-ink)", fontFamily: "'JetBrains Mono', monospace" }}>{money(row.price)}</div>
        <div className="text-[10px] mt-px" style={{ color: t.textMuted }}>{tr("per 1K")}</div>
      </div>
    </div>
  );
}

export default function FullList({ platform, platformLabel, search, dark, t, onPick, selectedId, onBackToPicks, cheapestPick, waNumber, userEmail }) {
  const tr = useT();
  const money = useMoney();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [type, setType] = useState("all");
  const [sort, setSort] = useState("cheap");
  const [refillOnly, setRefillOnly] = useState(false);
  const [location, setLocation] = useState("any");
  const [price, setPrice] = useState("any");
  const [shown, setShown] = useState(PAGE);
  // How far each overview section has been opened, keyed by type.
  const [openCounts, setOpenCounts] = useState({});

  useEffect(() => {
    let cancelled = false;
    setLoading(true); setError(""); setData(null); setType("all"); setShown(PAGE); setOpenCounts({}); setLocation("any"); setPrice("any");
    (async () => {
      try {
        const res = await fetch(`/api/catalogue/full?platform=${encodeURIComponent(platform)}`);
        const json = await res.json();
        if (cancelled) return;
        if (!res.ok) throw new Error(json.error || "Could not load the catalogue");
        setData(json);
      } catch (e) { if (!cancelled) setError(e.message); }
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [platform]);

  useEffect(() => { setShown(PAGE); setOpenCounts({}); }, [type, sort, refillOnly, location, price, search]);

  const q = search.trim().toLowerCase();
  const all = data?.services || [];
  // Rating can only sort once somebody has rated something on this platform.
  const hasRated = useMemo(() => all.some(r => approvalOf(r) != null), [all]);
  // Origins present on this platform, commonest first, counted off the same
  // text the filter matches on so the number on the option is the number of
  // rows it will leave.
  const locations = useMemo(() => {
    const n = {};
    for (const r of all) {
      for (const k of LOCATION_KEYS) if (matchesLocation(hay(r), k)) n[k] = (n[k] || 0) + 1;
    }
    return Object.entries(n).filter(([, c]) => c >= LOCATION_MIN).sort((a, b) => b[1] - a[1]);
  }, [all]);
  const activeLocation = locations.some(([k]) => k === location) ? location : "any";
  // Only bands with something in them, for the same reason the location control
  // lists only origins it carries: an option that returns nothing is a dead end
  // dressed as a choice.
  const bands = useMemo(
    () => PRICE_BANDS.filter(b => all.some(r => r.price >= b.lo && r.price < b.hi)),
    [all],
  );
  const activePrice = bands.some(b => b.key === price) ? price : "any";
  const band = bands.find(b => b.key === activePrice);
  const sorts = SORTS.filter(s2 => !s2.needsVotes || hasRated);
  // Switching platforms can withdraw the sort that is selected — the last one
  // had ratings and this one does not. Fall back rather than leave the select
  // showing one thing while the list is ordered by another.
  const activeSort = sorts.some(s2 => s2.key === sort) ? sort : "cheap";

  // Everything the filters allow, before the type filter. Two things read off
  // this: the type counts, so a pill promises what tapping it would actually
  // give, and the list itself.
  //
  // A search reaches the whole platform — someone who types "story" does not
  // want it narrowed to the type they happen to be looking at. A bare number is
  // a service ID.
  const beforeType = useMemo(() => {
    let l = all;
    if (refillOnly) l = l.filter(r => r.refill);
    if (activeLocation !== "any") l = l.filter(r => matchesLocation(hay(r), activeLocation));
    if (band) l = l.filter(r => r.price >= band.lo && r.price < band.hi);
    if (q) l = l.filter(r => String(r.id).includes(q) || r.label.toLowerCase().includes(q) || (r.attrs || []).join(" ").toLowerCase().includes(q));
    return l;
  }, [all, q, refillOnly, activeLocation, band]);

  const matched = useMemo(
    () => sortRows(q || type === "all" ? beforeType : beforeType.filter(r => r.type === type), activeSort),
    [beforeType, q, type, activeSort],
  );

  // Counted from what the filters left, never from the server's totals. A
  // section saying "Followers 301" over five refill-backed rows would be
  // describing a list nobody is looking at.
  const liveCounts = useMemo(() => {
    const c = { all: beforeType.length };
    for (const t2 of TYPE_ROW) if (t2.key !== "all") c[t2.key] = 0;
    for (const r of beforeType) c[r.type] = (c[r.type] || 0) + 1;
    return c;
  }, [beforeType]);

  // Grouping survives a filter. Narrowing the list is not a reason to throw away
  // the categories that make it readable: five cheapest refill-backed of each
  // type is a better answer than one flat run of them. Only a search flattens,
  // because a search is a lookup and its results have no categories to respect.
  const overview = type === "all" && !q;

  if (loading) return (
    <div className="rounded-xl desktop:rounded-[14px] overflow-hidden" style={{ background: t.cardBg, border: `0.5px solid ${t.cardBorder}` }}>
      {[1, 2, 3, 4, 5, 6].map(i => (
        <div key={i} className="flex items-center justify-between gap-3 py-3 px-4" style={{ borderTop: i === 1 ? "none" : `1px solid ${t.cardBorder}` }}>
          <div className={`skel-bone ${dark ? "skel-dark" : "skel-light"} h-4 rounded`} style={{ width: `${40 + (i % 3) * 12}%` }} />
          <div className={`skel-bone ${dark ? "skel-dark" : "skel-light"} h-5 w-[64px] rounded`} />
        </div>
      ))}
    </div>
  );

  if (error) return <div className="py-10 text-center text-sm" style={{ color: dark ? "#fca5a5" : "#dc2626" }}>{tr(error)}</div>;

  if (all.length === 0) return (
    <div className="rounded-xl desktop:rounded-[14px] py-10 px-5 text-center" style={{ background: t.cardBg, border: `0.5px solid ${t.cardBorder}` }}>
      <div className="text-[15px] mb-1.5" style={{ color: t.textMuted }}>{tr("No full list for this platform yet.")}</div>
      <div className="text-[13px] mb-3" style={{ color: t.textMuted }}>{tr("Nitro's tested picks are the whole menu here.")}</div>
      <button onClick={onBackToPicks} className="text-[13px] font-bold py-1.5 px-3.5 rounded-full border-[1.5px] border-solid cursor-pointer font-[inherit]" style={{ color: t.accentInk, borderColor: t.accent, background: t.accentLight }}>{tr("Back to Nitro picks")}</button>
    </div>
  );

  const typeCount = (k) => liveCounts[k] || 0;
  const visible = overview ? [] : matched.slice(0, shown);
  const left = overview ? 0 : matched.length - visible.length;

  return (
    <>
      {/* ═══ WHAT THIS LIST IS, SAID ONCE ═══
          The way back used to be prose — "our tested picks start at ₦418 and
          are one tap back" — which describes a button instead of being one.
          It is a button now, so the sentence gets shorter and the offer gets
          tappable. The icon centres on the whole strip rather than hanging off
          the first line. */}
      <div className="flex items-center gap-2.5 flex-wrap mb-3 rounded-[11px] py-2 px-3 border border-solid" style={{ borderColor: t.cardBorder, background: dark ? "rgba(255,255,255,.04)" : "rgba(0,0,0,.022)" }}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0" style={{ color: t.textMuted }} aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
        <div className="text-[11.5px] leading-[1.5] flex-1 min-w-[190px]" style={{ color: t.textMuted }}>
          <strong style={{ color: t.text }}>{tr("Outside our tested picks.")}</strong>{" "}
          {tr("These come exactly as listed, and carry no Nitro refill guarantee.")}
        </div>
        {cheapestPick != null && onBackToPicks && (
          <button onClick={onBackToPicks}
            className="shrink-0 inline-flex items-center gap-1.5 text-[11.5px] font-bold py-[5px] px-3 rounded-full border border-solid cursor-pointer font-[inherit] transition-colors duration-150 max-md:w-full max-md:justify-center"
            style={{ color: t.accentInk, borderColor: t.accent, background: t.accentLight }}>
            {tr("Tested picks from")} <span className="m" style={{ fontFamily: "'JetBrains Mono', monospace" }}>{money(cheapestPick)}</span>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="dir-flip opacity-70" aria-hidden="true"><polyline points="9 18 15 12 9 6"/></svg>
          </button>
        )}
      </div>

      {/* ═══ TYPE ═══
          What someone came for, so it sits above the card as categories rather
          than in the strip beside the two controls that merely narrow.

          Eight outlined pills read as a tag cloud — eight objects competing,
          none of them the answer. Border and fill are spent on the one that is
          selected and nothing else: seven quiet labels and one solid chip. The
          count rides with each label, because which category is worth opening
          is mostly a question of how much is in it. */}
      <div className="hidden desktop:flex items-center gap-1 mb-3 pb-3 border-b border-solid" role="tablist" aria-label={tr("Type")} style={{ borderBottomColor: t.cardBorder }}>
        {TYPE_ROW.map(x => {
          const on = type === x.key;
          const n = typeCount(x.key);
          return (
            <button key={x.key} role="tab" aria-selected={on} onClick={() => setType(x.key)} disabled={n === 0}
              className="no-type-tab inline-flex items-baseline gap-1.5 py-[5px] px-2.5 rounded-lg border-none font-[inherit] text-[13px] transition-colors duration-150"
              style={{ cursor: n === 0 ? "default" : "pointer", opacity: n === 0 ? .35 : 1, background: on ? t.accent : "transparent", color: on ? "#fff" : t.textMuted, fontWeight: on ? 700 : 500 }}>
              {tr(x.label)}
              <span className="m text-[10.5px]" style={{ fontFamily: "'JetBrains Mono', monospace", color: on ? "#fff" : t.textMuted, opacity: on ? .75 : .6 }}>{n.toLocaleString()}</span>
            </button>
          );
        })}
      </div>
      <div className="desktop:hidden relative mb-3">
        <select aria-label={tr("Type")} value={type} onChange={e => setType(e.target.value)}
          className="w-full appearance-none py-[9px] pl-3 pr-9 rounded-[10px] border border-solid text-[13px] font-semibold font-[inherit] outline-none box-border cursor-pointer"
          style={{ borderColor: t.cardBorder, background: dark ? "rgba(255,255,255,.09)" : "#fff", color: t.text }}>
          {TYPE_ROW.map(x => <option key={x.key} value={x.key}>{`${tr(x.label)} · ${typeCount(x.key).toLocaleString()}`}</option>)}
        </select>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: t.textMuted }}><polyline points="6 9 12 15 18 9"/></svg>
      </div>

      {/* ═══ THE LIST ═══ */}
      <div className="rounded-xl desktop:rounded-[14px] overflow-hidden" style={{ background: t.cardBg, border: `0.5px solid ${t.cardBorder}` }}>
        {/* Three things stack here and they must not read as one field: this
            toolbar is chrome, a section head is a marker, a row is content.
            Chrome gets the deepest neutral and a hard edge under it. */}
        <div className="flex items-center gap-2 flex-wrap py-2 px-3 md:px-4" style={{ background: dark ? "rgba(255,255,255,.055)" : "rgba(88,52,62,.055)", borderBottom: `1px solid ${t.cardBorder}` }}>
          {/* Just the count. The sort control beside it says which sort is on,
              and in the overview each section carries its own shown/total —
              captioning a layout the reader is already looking at only
              crowds the strip. */}
          <span className="text-[12px] w-full md:w-auto md:mr-auto min-w-0 truncate" style={{ color: t.textMuted }}>
            <strong className="m" style={{ color: t.text, fontFamily: "'JetBrains Mono', monospace" }}>{matched.length.toLocaleString()}</strong>
            {" "}
            {q ? `${tr("results for")} “${search.trim()}”`
              : type === "all" ? tr("services") : tr(TYPE_ROW.find(x => x.key === type).label).toLowerCase()}
          </span>
          <div className="grid grid-cols-2 gap-1.5 w-full md:flex md:items-center md:w-auto">
            {/* A toggle, not a third dropdown. The tick is what says so —
                three identical outlined pills read as three of the same
                control, and only two of these open anything. */}
            <button onClick={() => setRefillOnly(v => !v)} aria-pressed={refillOnly}
              className="inline-flex items-center justify-center gap-1 text-[11px] py-[4px] px-2 md:px-2.5 rounded-[8px] min-w-0 cursor-pointer border border-solid font-[inherit] transition-colors duration-150 whitespace-nowrap min-w-0"
              style={{ color: refillOnly ? (dark ? "#6ee7b7" : "#059669") : t.textMuted, fontWeight: refillOnly ? 700 : 500, borderColor: refillOnly ? (dark ? "rgba(110,231,183,.45)" : "rgba(5,150,105,.4)") : t.cardBorder, background: refillOnly ? (dark ? "rgba(110,231,183,.12)" : "rgba(5,150,105,.08)") : "transparent" }}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="shrink-0" style={{ opacity: refillOnly ? 1 : .35 }} aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>
              <span className="truncate">{tr("Refill only")}</span>
            </button>
            {/* Where the accounts come from. A filter, not a sort — it decides
                what is in the list, the way Refill only does, so it sits with
                that and not in the ordering control beside them. */}
            {locations.length > 0 && (
              <div className="relative min-w-0">
                <select aria-label={tr("Location")} value={activeLocation} onChange={e => setLocation(e.target.value)}
                  className="w-full appearance-none py-[4px] pl-[25px] pr-[22px] rounded-[8px] border border-solid text-[11px] font-semibold font-[inherit] outline-none box-border cursor-pointer truncate"
                  style={{ borderColor: activeLocation !== "any" ? (dark ? "#7aa2f7" : "#1d5fa5") : t.cardBorder, color: activeLocation !== "any" ? (dark ? "#7aa2f7" : "#1d5fa5") : t.text, background: activeLocation !== "any" ? (dark ? "rgba(122,162,247,.14)" : "#eaf1fa") : (dark ? "rgba(255,255,255,.08)" : "#fffdfb") }}>
                  <option value="any">{tr("Anywhere")}</option>
                  {locations.map(([k]) => (
                    <option key={k} value={k}>{`${LOCATION_FLAGS[k] ? LOCATION_FLAGS[k] + " " : ""}${tr(LOCATION_LABELS[k])}`}</option>
                  ))}
                </select>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="absolute left-[8px] top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: activeLocation !== "any" ? (dark ? "#7aa2f7" : "#1d5fa5") : t.textMuted }} aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/></svg>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="absolute right-[7px] top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: activeLocation !== "any" ? (dark ? "#7aa2f7" : "#1d5fa5") : t.textMuted }} aria-hidden="true"><polyline points="6 9 12 15 18 9"/></svg>
              </div>
            )}
            {/* Price per 1K. The bands are fixed because the range is not:
                ₦205 to ₦29.7M, where a slider would give almost its whole
                travel to noise. */}
            {bands.length > 1 && (
              <div className="relative min-w-0">
                <select aria-label={tr("Price")} value={activePrice} onChange={e => setPrice(e.target.value)}
                  className="w-full appearance-none py-[4px] pl-[25px] pr-[22px] rounded-[8px] border border-solid text-[11px] font-semibold font-[inherit] outline-none box-border cursor-pointer truncate"
                  style={{ borderColor: band ? (dark ? "#e0a458" : "#b45309") : t.cardBorder, color: band ? (dark ? "#e0a458" : "#b45309") : t.text, background: band ? (dark ? "rgba(224,164,88,.14)" : "#fdf3e7") : (dark ? "rgba(255,255,255,.08)" : "#fffdfb") }}>
                  <option value="any">{tr("Any price")}</option>
                  {bands.map(b => (
                    <option key={b.key} value={b.key}>
                      {b.lo === 0 ? `${tr("Under")} ${money(b.hi)}`
                        : b.hi === Infinity ? `${tr("Over")} ${money(b.lo)}`
                        : `${money(b.lo)} – ${money(b.hi)}`}
                    </option>
                  ))}
                </select>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="absolute left-[8px] top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: band ? (dark ? "#e0a458" : "#b45309") : t.textMuted }} aria-hidden="true"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="absolute right-[7px] top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: band ? (dark ? "#e0a458" : "#b45309") : t.textMuted }} aria-hidden="true"><polyline points="6 9 12 15 18 9"/></svg>
              </div>
            )}
            <div className="relative min-w-0">
              <select aria-label={tr("Sort")} value={activeSort} onChange={e => setSort(e.target.value)}
                className="w-full appearance-none py-[4px] pl-[25px] pr-[22px] rounded-[8px] border border-solid text-[11px] font-semibold font-[inherit] outline-none box-border cursor-pointer truncate"
                style={{ borderColor: t.cardBorder, background: dark ? "rgba(255,255,255,.08)" : "#fffdfb", color: t.text }}>
                {sorts.map(s2 => <option key={s2.key} value={s2.key}>{tr(s2.label)}</option>)}
              </select>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="absolute left-[8px] top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: t.textMuted }} aria-hidden="true"><line x1="4" y1="7" x2="16" y2="7"/><line x1="4" y1="12" x2="13" y2="12"/><line x1="4" y1="17" x2="10" y2="17"/><polyline points="17 14 20 17 23 14"/><line x1="20" y1="17" x2="20" y2="7"/></svg>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="absolute right-[7px] top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: t.textMuted }} aria-hidden="true"><polyline points="6 9 12 15 18 9"/></svg>
            </div>
          </div>
        </div>

        {matched.length === 0 ? (
          <div className="py-10 px-5 text-center" style={{ borderTop: `1px solid ${t.cardBorder}` }}>
            <div className="text-[15px] mb-1" style={{ color: t.text }}>{tr("Nothing matches that")}</div>
            <div className="text-[13px] mb-3" style={{ color: t.textMuted }}>{tr("Try a shorter word, or a service ID.")}</div>
            <div className="flex items-center justify-center gap-2 flex-wrap">
              {refillOnly && <button onClick={() => setRefillOnly(false)} className="text-[12.5px] font-semibold py-1.5 px-3 rounded-full border border-solid cursor-pointer font-[inherit]" style={{ borderColor: t.cardBorder, color: t.text, background: "transparent" }}>{tr("Show all, refill or not")}</button>}
              {band && <button onClick={() => setPrice("any")} className="text-[12.5px] font-semibold py-1.5 px-3 rounded-full border border-solid cursor-pointer font-[inherit]" style={{ borderColor: t.cardBorder, color: t.text, background: "transparent" }}>{tr("Any price")}</button>}
              {activeLocation !== "any" && <button onClick={() => setLocation("any")} className="text-[12.5px] font-semibold py-1.5 px-3 rounded-full border border-solid cursor-pointer font-[inherit]" style={{ borderColor: t.cardBorder, color: t.text, background: "transparent" }}>{tr("Anywhere")}</button>}
              {type !== "all" && <button onClick={() => setType("all")} className="text-[12.5px] font-semibold py-1.5 px-3 rounded-full border border-solid cursor-pointer font-[inherit]" style={{ borderColor: t.cardBorder, color: t.text, background: "transparent" }}>{tr("All types")}</button>}
            </div>
            <div className="mt-3"><NotSureHelp waNumber={waNumber} dark={dark} context={search.trim() || platformLabel} email={userEmail} /></div>
          </div>
        ) : overview ? (
          /* "All" is not a 599-row scroll. It is the five cheapest of each type
             with a way into each — the same shape a customer already knows from
             a shop's category page. */
          TYPE_ROW.slice(1).map(x => {
            const inType = sortRows(matched.filter(r => r.type === x.key), activeSort);
            const open = openCounts[x.key] ?? OVERVIEW_PER_TYPE;
            const rows = inType.slice(0, open);
            if (!rows.length) return null;
            const left = inType.length - rows.length;
            return (
              <div key={x.key}>
                {/* The marker: the one band that is not a neutral. It carries
                    the accent so a category reads as a different kind of thing
                    from the toolbar above it and the rows under it.
                    It used to carry a "See all" that switched the type filter —
                    which is what the type row at the top of the view already
                    does. A second control for the same thing, so it is gone and
                    the header is just the label and the count. */}
                <div className="flex items-center gap-2 py-2 px-3 md:px-4" style={{ background: dark ? "rgba(196,125,142,.17)" : "rgba(196,125,142,.13)", boxShadow: `inset 3px 0 0 ${t.accent}` }}>
                  <span className="text-[12px] font-bold uppercase tracking-[.7px]" style={{ color: t.accentInk }}>{tr(x.label)}</span>
                  <span className="m text-[10.5px] font-bold rounded-full px-[6px] py-[1px]" style={{ fontFamily: "'JetBrains Mono', monospace", background: dark ? "rgba(255,255,255,.1)" : "rgba(131,83,95,.1)", color: t.accentInk }}>{typeCount(x.key).toLocaleString()}</span>
                  {rows.length < inType.length && <span className="ml-auto m text-[10.5px]" style={{ fontFamily: "'JetBrains Mono', monospace", color: t.accentInk, opacity: .7 }}>{rows.length}/{inType.length.toLocaleString()}</span>}
                </div>
                {rows.map((r, i) => <Row key={r.id} first={i === 0} row={r} dark={dark} t={t} onPick={onPick} selected={selectedId === r.id} />)}
                {/* The number is the promise: the button says exactly how many
                    arrive, and says the true remainder when it is under a step,
                    so it never offers fifteen and hands over two. It grows the
                    section in place — the sort and Refill only still apply, and
                    the other categories stay where they were. */}
                {left > 0 && (
                  <button onClick={() => setOpenCounts(c => ({ ...c, [x.key]: open + Math.min(OVERVIEW_STEP, left) }))}
                    className="w-full py-2.5 text-[12px] font-bold cursor-pointer border-none font-[inherit] inline-flex items-center justify-center gap-1.5"
                    style={{ borderTop: `1px solid ${t.cardBorder}`, color: t.accentInk, background: dark ? "rgba(255,255,255,.03)" : "rgba(0,0,0,.02)" }}>
                    {tr("Load")} {Math.min(OVERVIEW_STEP, left).toLocaleString()} {tr("more")}
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
                  </button>
                )}
              </div>
            );
          })
        ) : (
          visible.map((r, i) => <Row key={r.id} first={i === 0} row={r} dark={dark} t={t} onPick={onPick} selected={selectedId === r.id} />)
        )}

        {left > 0 && (
          <button onClick={() => setShown(s => s + PAGE)} className="w-full py-3 text-[13px] font-bold cursor-pointer border-none font-[inherit]" style={{ borderTop: `1px solid ${t.cardBorder}`, color: t.accentInk, background: dark ? "rgba(255,255,255,.03)" : "rgba(0,0,0,.02)" }}>
            {tr("Show more")} · {Math.min(PAGE, left).toLocaleString()}
          </button>
        )}
      </div>
    </>
  );
}
