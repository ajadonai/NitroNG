'use client';
import { useState, useEffect, useRef, useCallback } from "react";
import { copyText } from '@/lib/clipboard';

// Read-only catalogue for granted resellers. Browse and copy IDs here; ordering
// happens on the New Order page (curated) or through the API (either list).
const GRADE_META = {
  premium: { dot: "#3b82f6", label: "Premium", letter: "P" },
  standard: { dot: "#22c55e", label: "Standard", letter: "S" },
  basic: { dot: "#eab308", label: "Basic", letter: "B" },
};

function Spinner({ size = 16, color = "currentColor" }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className="animate-spin"><circle cx="12" cy="12" r="10" stroke={color} strokeWidth="3" strokeLinecap="round" opacity=".25" /><path d="M12 2a10 10 0 0 1 10 10" stroke={color} strokeWidth="3" strokeLinecap="round" /></svg>;
}

const naira = (n) => `₦${Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;

// The legend content, shared by the mobile collapsible and the desktop sidebar.
function GradeLegendBody({ dark, t }) {
  const border = dark ? "rgba(255,255,255,.12)" : "rgba(0,0,0,.08)";
  return (
    <>
      <div className="flex flex-wrap gap-2 mb-3">
        {[...Object.entries(GRADE_META).map(([k, m]) => ({ k, dot: m.dot, label: m.label, letter: m.letter, tint: `${m.dot}1f` })),
          { k: "none", dot: null, label: "Not graded", tint: dark ? "rgba(255,255,255,.06)" : "rgba(0,0,0,.04)" }].map(c => (
          <span key={c.k} className="inline-flex items-center gap-1.5 py-1 px-2.5 rounded-full text-[11px] font-semibold"
            style={{ background: c.tint, color: dark ? "#cfc9c2" : "#555250", border: `1px solid ${c.dot ? `${c.dot}55` : border}` }}>
            {c.dot
              ? <span className="inline-flex items-center justify-center text-[11px] font-bold" style={{ width: 16, height: 16, borderRadius: 4, background: `${c.dot}22`, color: c.dot, border: `1px solid ${c.dot}55` }}>{c.letter}</span>
              : <span style={{ width: 7, height: 7, borderRadius: 99, border: `1.5px solid ${dark ? "rgba(255,255,255,.35)" : "rgba(0,0,0,.25)"}`, display: "inline-block" }} />}
            {c.label}
          </span>
        ))}
      </div>
      <div className="text-[13px] leading-relaxed" style={{ color: t.textMuted }}>
        Not every service carries a grade — an ungraded service is <span style={{ fontWeight: 600, color: dark ? "#cfc9c2" : "#555250" }}>not a lesser one</span>,
        grading just isn&rsquo;t available across the whole catalogue. Judge ungraded services on refill terms and price;
        many are among the strongest performers.
      </div>
    </>
  );
}

// Rendered by the dashboard's right rail on desktop, matching the other pages'
// sidebar pattern.
export function ResellerCatalogueSidebar({ dark, t }) {
  return (
    <div className="flex flex-col gap-0">
      <div className="text-[11px] font-semibold uppercase tracking-[1.5px] mb-2 py-1.5 px-2.5 rounded-lg text-t-text-muted" style={{ background: dark ? "rgba(196,125,142,.1)" : "rgba(196,125,142,.06)" }}>Quality grades</div>
      <div className="py-2.5 px-3 rounded-lg" style={{ background: dark ? "rgba(255,255,255,.07)" : "rgba(0,0,0,.02)" }}>
        <GradeLegendBody dark={dark} t={t} />
      </div>
    </div>
  );
}

const ROW_CSS = `
.cat-row { transition: background .12s; }
.cat-row:hover { background: rgba(196,125,142,.06) !important; }
.cat-chev { transition: transform .18s; display: inline-block; }
.cat-chev.open { transform: rotate(90deg); }
`;

export default function ResellerCataloguePage({ dark, t }) {
  const [state, setState] = useState({ status: "loading" });
  const [view, setView] = useState("curated");
  const [openCats, setOpenCats] = useState({});
  const [catRows, setCatRows] = useState({});
  const [query, setQuery] = useState("");
  const [results, setResults] = useState(null);
  const [drawer, setDrawer] = useState(null);
  const [copied, setCopied] = useState(false);

  // Escape closes the drawer. Without it a keyboard user can open the panel and
  // has no way back out, since the close control is the only exit.
  useEffect(() => {
    if (!drawer) return undefined;
    const onKey = e => { if (e.key === "Escape") setDrawer(null); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [drawer]);

  // Reset the copy confirmation per service, so a stale "Copied" never greets
  // the next drawer that opens.
  useEffect(() => { setCopied(false); }, [drawer]);
  const [legendOpen, setLegendOpen] = useState(false);
  const searchTimer = useRef(null);

  const border = dark ? "rgba(255,255,255,.12)" : "rgba(0,0,0,.08)";
  const cardBg = dark ? "rgba(255,255,255,.07)" : "rgba(255,255,255,.85)";
  const softBg = dark ? "rgba(196,125,142,.1)" : "rgba(196,125,142,.06)";

  const load = useCallback((v) => {
    setState({ status: "loading" });
    fetch(`/api/reseller/catalogue?view=${v}`)
      .then(r => r.json().then(d => ({ ok: r.ok, status: r.status, d })))
      .then(({ ok, status, d }) => {
        if (!ok) { setState({ status: status === 403 ? "denied" : "error", error: d.error }); return; }
        setState({ status: "ready", data: d });
      })
      .catch(() => setState({ status: "error" }));
  }, []);

  useEffect(() => { load(view); setResults(null); setQuery(""); setOpenCats({}); setCatRows({}); }, [view, load]);

  // Instant search, same 350ms debounce the rest of Nitro uses.
  useEffect(() => {
    if (view !== "full") return undefined;
    clearTimeout(searchTimer.current);
    if (!query.trim() || query.trim().length < 2) { setResults(null); return undefined; }
    searchTimer.current = setTimeout(() => {
      fetch(`/api/reseller/catalogue?view=full&q=${encodeURIComponent(query.trim())}`)
        .then(r => r.json())
        .then(d => setResults(d.services || []))
        .catch(() => setResults([]));
    }, 350);
    return () => clearTimeout(searchTimer.current);
  }, [query, view]);

  const fetchCat = (name, offset = 0) => {
    fetch(`/api/reseller/catalogue?view=full&category=${encodeURIComponent(name)}&offset=${offset}`)
      .then(r => r.json())
      .then(d => setCatRows(p => ({
        ...p,
        [name]: {
          rows: offset ? [...(p[name]?.rows || []), ...(d.services || [])] : (d.services || []),
          hasMore: !!d.hasMore,
          loadingMore: false,
        },
      })))
      .catch(() => setCatRows(p => ({ ...p, [name]: { rows: p[name]?.rows || [], hasMore: false, loadingMore: false } })));
  };

  const toggleCat = (name) => {
    setOpenCats(p => ({ ...p, [name]: !p[name] }));
    if (!catRows[name]) fetchCat(name, 0);
  };

  const loadMore = (name) => {
    const cur = catRows[name];
    if (!cur || cur.loadingMore) return;
    setCatRows(p => ({ ...p, [name]: { ...p[name], loadingMore: true } }));
    fetchCat(name, cur.rows.length);
  };

  // A skeleton in the shape of the page it is replacing, matching the house
  // pattern used on Tasks and the dashboard. A centred spinner told you nothing
  // about what was coming and made the page appear to jump when it arrived.
  if (state.status === "loading") {
    const sk = `skel-bone ${dark ? "skel-dark" : "skel-light"}`;
    return (
      <div aria-busy="true" aria-live="polite" aria-label="Loading catalogue">
        {/* legend */}
        <div className="rounded-xl mb-4 py-3 px-4 flex items-center justify-between" style={{ background: cardBg, border: `1px solid ${border}` }}>
          <div className={`${sk} w-[120px] h-[13px]`} />
          <div className={`${sk} w-[13px] h-[13px] rounded-full`} />
        </div>
        {/* view toggle */}
        <div className="flex gap-2 mb-4">
          <div className={`${sk} w-[110px] h-[32px] rounded-full`} />
          <div className={`${sk} w-[110px] h-[32px] rounded-full`} />
        </div>
        {/* search */}
        <div className={`${sk} w-full md:max-w-[420px] h-[40px] rounded-[10px] mb-4`} />
        {/* rows */}
        <div className="rounded-2xl overflow-hidden" style={{ background: cardBg, border: `1px solid ${border}` }}>
          {[0, 1, 2, 3, 4, 5].map(i => (
            <div key={i} className="flex items-center gap-3 py-3 px-4"
              style={{ borderTop: i > 0 ? `1px solid ${dark ? "rgba(255,255,255,.05)" : "rgba(0,0,0,.04)"}` : "none" }}>
              <div className={`${sk} w-[9px] h-[9px] rounded-full shrink-0`} />
              <div className="flex-1 min-w-0">
                <div className={`${sk} h-[13px] mb-1.5`} style={{ width: `${52 + ((i * 13) % 34)}%` }} />
                <div className={`${sk} w-[130px] h-[10px]`} />
              </div>
              <div className={`${sk} w-[64px] h-[13px] shrink-0`} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (state.status === "denied") {
    return (
      <div className="p-10 rounded-2xl text-center" style={{ background: cardBg, border: `1px solid ${border}` }}>
        <div className="text-base font-semibold mb-2" style={{ color: t.text }}>Reseller access required</div>
        <div className="text-sm max-w-[420px] mx-auto" style={{ color: t.textMuted }}>
          The catalogue is for approved resellers. Message our support on WhatsApp and tell us about your business to get set up.
        </div>
      </div>
    );
  }
  if (state.status === "error") {
    return <div className="p-10 rounded-2xl text-center text-sm" style={{ background: cardBg, border: `1px solid ${border}`, color: t.textMuted }}>Could not load the catalogue. Refresh to try again.</div>;
  }

  const { data } = state;
  const hasFull = data.catalog === "full";

  // A lettered chip rather than a coloured dot: colour alone fails on mobile,
  // where there is no hover for the title and the legend is collapsed by
  // default, and blue/green/yellow is the first pairing colour-blind users lose.
  // The letter carries the grade; the colour reinforces it.
  const gradeDot = (grade) => {
    const m = grade && GRADE_META[grade];
    if (!m) {
      return (
        <span aria-label="Ungraded" title="Ungraded"
          className="inline-flex items-center justify-center text-[11px] font-bold shrink-0"
          style={{
            width: 18, height: 18, borderRadius: 5,
            border: `1.5px dashed ${dark ? "rgba(255,255,255,.25)" : "rgba(0,0,0,.2)"}`,
            color: dark ? "rgba(255,255,255,.35)" : "rgba(0,0,0,.3)",
          }}>–</span>
      );
    }
    return (
      <span aria-label={`${m.label} grade`} title={m.label}
        className="inline-flex items-center justify-center text-[11px] font-bold shrink-0"
        style={{ width: 18, height: 18, borderRadius: 5, background: `${m.dot}22`, color: m.dot, border: `1px solid ${m.dot}55` }}>
        {m.letter}
      </span>
    );
  };

  const idChip = (id) => (
    <span className="py-0.5 px-1.5 rounded-md text-[11px] font-semibold"
      style={{ background: dark ? "rgba(255,255,255,.07)" : "rgba(0,0,0,.05)", color: t.textSoft, fontVariantNumeric: "tabular-nums", fontFamily: "'JetBrains Mono', monospace" }}>#{id}</span>
  );

  const fullRow = (s, i) => (
    <button key={s.id} onClick={() => setDrawer(s)}
      className="cat-row w-full flex items-center gap-3 py-3 px-4 text-left cursor-pointer border-none"
      style={{ background: "none", borderTop: i > 0 ? `1px solid ${dark ? "rgba(255,255,255,.05)" : "rgba(0,0,0,.04)"}` : "none" }}>
      {gradeDot(s.grade)}
      <span className="flex-1 min-w-0">
        <span className="block text-[13px] font-medium truncate mb-0.5" style={{ color: t.text }}>{s.label}</span>
        <span className="flex items-center gap-2 text-[11px]" style={{ color: t.textMuted }}>
          {idChip(s.id)}
          <span>{s.min.toLocaleString()}–{s.max.toLocaleString()}</span>
          {s.refill && <span className="py-px px-1.5 rounded-full text-[11px] font-semibold" style={{ background: dark ? "rgba(110,231,183,.12)" : "rgba(5,150,105,.09)", color: dark ? "#6ee7b7" : "#059669" }}>refill</span>}
          {s.cancel && <span className="hidden md:inline py-px px-1.5 rounded-full text-[11px] font-semibold" style={{ background: dark ? "rgba(255,255,255,.07)" : "rgba(0,0,0,.05)", color: t.textMuted }}>cancel</span>}
        </span>
      </span>
      <span className="text-right flex-shrink-0 w-[86px]">
        <span className="block text-[15px] font-bold" style={{ color: t.text, fontFamily: "'JetBrains Mono', monospace", fontVariantNumeric: "tabular-nums" }}>{naira(s.price)}</span>
        <span className="text-[11px]" style={{ color: t.textMuted }}>per 1k</span>
      </span>
      <svg className="flex-shrink-0 max-md:hidden" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={t.textMuted} strokeWidth="2" strokeLinecap="round"><path d="M9 18l6-6-6-6"/></svg>
    </button>
  );

  return (
    <>
      <style>{ROW_CSS}</style>
      <div className="pb-2 desktop:pb-3.5 mb-3">
        <div className="text-lg desktop:text-[22px] font-semibold" style={{ color: t.text }}>Catalogue</div>
        <div className="text-sm desktop:text-[15px] max-md:text-xs mt-0.5" style={{ color: t.textMuted }}>
          Browse and copy service IDs. Order curated services from New Order, or anything here through the API.
        </div>
        <div className="page-divider" style={{ background: t.cardBorder }} />
        <div className="flex items-center gap-2.5 mt-3 py-2 px-3 rounded-xl text-[12px]" style={{ background: dark ? "rgba(196,125,142,.12)" : "rgba(196,125,142,.07)", border: "1px solid rgba(196,125,142,.3)", color: t.textSoft }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#c47d8e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0" aria-hidden="true"><path d="m21 2-2 2m-7.6 7.6a5.5 5.5 0 11-7.8 7.8 5.5 5.5 0 017.8-7.8zm0 0L19 3l2 2-3 3"/></svg>
          <span>Ordering by API? Your key is in <b style={{ color: t.text }}>Settings</b>, the base URL is <b className="m" style={{ color: t.text }}>nitro.ng/api/v2</b>, and the <a href="/resellers/docs" target="_blank" rel="noopener noreferrer" className="font-semibold text-accent">docs</a> cover all six actions.</span>
        </div>
      </div>

      {/* Mobile only: the legend as a collapsible, like "How Our Services Work"
          on the order page. Desktop reads it in the right sidebar instead. */}
      <div className="desktop:hidden mb-4 rounded-[14px] overflow-hidden" style={{ background: softBg, border: `1px solid ${border}` }}>
        <button onClick={() => setLegendOpen(v => !v)} aria-expanded={legendOpen}
          className="w-full flex items-center justify-between py-3 px-4 cursor-pointer border-none text-left" style={{ background: "none" }}>
          <span className="text-sm font-semibold inline-flex items-center gap-1.5" style={{ color: t.text }}>
            <span className="flex gap-0.5">{Object.values(GRADE_META).map(m => <span key={m.dot} style={{ width: 7, height: 7, borderRadius: 99, background: m.dot, display: "inline-block" }} />)}</span>
            Quality grades
          </span>
          <svg className={`cat-chev${legendOpen ? " open" : ""}`} width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={t.textMuted} strokeWidth="2.5" strokeLinecap="round"><path d="M9 18l6-6-6-6"/></svg>
        </button>
        {legendOpen && <div className="px-4 pb-4"><GradeLegendBody dark={dark} t={t} /></div>}
      </div>

      {/* view toggle */}
      {hasFull && (
        <div className="inline-flex rounded-full p-1 mb-5" style={{ background: dark ? "rgba(255,255,255,.06)" : "rgba(0,0,0,.05)" }}>
          {[["curated", "Curated"], ["full", "Full catalogue"]].map(([v, label]) => (
            <button key={v} onClick={() => setView(v)} aria-pressed={view === v}
              className="py-1.5 px-4 rounded-full text-[13px] font-semibold border-none cursor-pointer transition-colors"
              style={{ background: view === v ? t.accent : "none", color: view === v ? "#fff" : t.textMuted }}>
              {label}
            </button>
          ))}
        </div>
      )}

      {/* The two catalogues carry different promises and used to look identical,
          so a reseller who toggled once and forgot could assume a guarantee that
          was never there. The banner states which promise is live and changes
          with the view. */}
      {hasFull && (
        <div className="flex items-start gap-2.5 rounded-[12px] py-2.5 px-3.5 mb-4" aria-live="polite"
          style={{
            background: view === "curated"
              ? (dark ? "rgba(34,197,94,.09)" : "rgba(22,163,74,.07)")
              : (dark ? "rgba(234,179,8,.09)" : "rgba(202,138,4,.07)"),
            border: `1px solid ${view === "curated"
              ? (dark ? "rgba(34,197,94,.22)" : "rgba(22,163,74,.2)")
              : (dark ? "rgba(234,179,8,.24)" : "rgba(202,138,4,.22)")}`,
          }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 mt-px"
            stroke={view === "curated" ? (dark ? "#4ade80" : "#16a34a") : (dark ? "#facc15" : "#ca8a04")} aria-hidden="true">
            {view === "curated"
              ? <><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><path d="M9 12l2 2 4-4" /></>
              : <><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></>}
          </svg>
          <span className="text-[13px] leading-snug" style={{ color: t.textSoft }}>
            {view === "curated"
              ? <>Covered by Nitro&rsquo;s refill guarantee. Order these from New Order or the API.</>
              : <>Sold as listed. Each service carries only its own refill and cancel terms, shown on every row. API only.</>}
          </span>
        </div>
      )}

      {view === "curated" ? (
        <div className="flex flex-col gap-2.5">
          {(data.groups || []).map(g => (
            <div key={g.name} className="rounded-[14px] overflow-hidden" style={{ background: cardBg, border: `1px solid ${border}` }}>
              <button onClick={() => setOpenCats(p => ({ ...p, [g.name]: !p[g.name] }))} aria-expanded={!!openCats[g.name]}
                className="cat-row w-full flex items-center gap-3 py-3.5 px-4 cursor-pointer border-none text-left" style={{ background: "none" }}>
                <svg className={`cat-chev${openCats[g.name] ? " open" : ""}`} width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={t.accent} strokeWidth="2.5" strokeLinecap="round"><path d="M9 18l6-6-6-6"/></svg>
                <span className="flex-1 min-w-0">
                  <span className="block text-[15px] font-semibold truncate" style={{ color: t.text }}>{g.name}</span>
                  <span className="text-[11px]" style={{ color: t.textMuted }}>{g.platform}</span>
                </span>
                <span className="py-0.5 px-2 rounded-full text-[11px] font-semibold flex-shrink-0" style={{ background: dark ? "rgba(255,255,255,.07)" : "rgba(0,0,0,.05)", color: t.textMuted }}>{g.tiers.length} tier{g.tiers.length === 1 ? "" : "s"}</span>
              </button>
              {openCats[g.name] && g.tiers.map((tier, i) => (
                <div key={tier.apiId || i} className="flex items-center gap-3 py-3 px-4"
                  style={{ borderTop: `1px solid ${dark ? "rgba(255,255,255,.05)" : "rgba(0,0,0,.04)"}` }}>
                  <span className="py-0.5 px-2 rounded-full text-[11px] font-bold flex-shrink-0"
                    style={{ background: dark ? "rgba(196,125,142,.16)" : "rgba(196,125,142,.1)", color: t.accent }}>{tier.tier}</span>
                  <span className="flex-1 min-w-0">
                    <span className="flex items-center gap-2 text-[11px]" style={{ color: t.textMuted }}>
                      {idChip(tier.apiId ?? "—")}
                      <span>{tier.min.toLocaleString()}–{tier.max.toLocaleString()}</span>
                      {tier.speed && <span className="max-md:hidden">{tier.speed}</span>}
                      {tier.refill && <span className="py-px px-1.5 rounded-full text-[11px] font-semibold" style={{ background: dark ? "rgba(110,231,183,.12)" : "rgba(5,150,105,.09)", color: dark ? "#6ee7b7" : "#059669" }}>{tier.refill}</span>}
                    </span>
                  </span>
                  <span className="text-right flex-shrink-0 w-[86px]">
                    <span className="block text-[15px] font-bold" style={{ color: t.text, fontFamily: "'JetBrains Mono', monospace", fontVariantNumeric: "tabular-nums" }}>{naira(tier.price)}</span>
                    <span className="text-[11px]" style={{ color: t.textMuted }}>per 1k</span>
                  </span>
                </div>
              ))}
            </div>
          ))}
        </div>
      ) : (
        <>
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            aria-label="Search the catalogue by service name or ID"
            type="search"
            autoComplete="off"
            spellCheck={false}
            placeholder="Search by name or service ID…"
            className="w-full md:max-w-[420px] py-2.5 px-3.5 rounded-[10px] text-[13px] outline-none mb-4 focus-visible:ring-2 focus-visible:ring-[#c47d8e]/40"
            style={{ background: cardBg, border: `1px solid ${border}`, color: t.text }}
          />
          {results !== null ? (
            <div className="rounded-[14px] overflow-hidden" style={{ background: cardBg, border: `1px solid ${border}` }}>
              {results.length === 0
                ? <div className="py-8 px-4 text-center text-[13px]" style={{ color: t.textMuted }}>Nothing matches &ldquo;{query.trim()}&rdquo;.</div>
                : results.map(fullRow)}
            </div>
          ) : (
            <div className="flex flex-col gap-2.5">
              {(data.categories || []).map(c => (
                <div key={c.name} className="rounded-[14px] overflow-hidden" style={{ background: cardBg, border: `1px solid ${border}` }}>
                  <button onClick={() => toggleCat(c.name)}
                    className="cat-row w-full flex items-center gap-3 py-3.5 px-4 cursor-pointer border-none text-left" style={{ background: "none" }}>
                    <svg className={`cat-chev${openCats[c.name] ? " open" : ""}`} width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={t.accent} strokeWidth="2.5" strokeLinecap="round"><path d="M9 18l6-6-6-6"/></svg>
                    <span className="flex-1 text-[15px] font-semibold truncate" style={{ color: t.text }}>{c.name}</span>
                    <span className="py-0.5 px-2 rounded-full text-[11px] font-semibold flex-shrink-0" style={{ background: dark ? "rgba(255,255,255,.07)" : "rgba(0,0,0,.05)", color: t.textMuted }}>{c.count.toLocaleString()}</span>
                  </button>
                  {openCats[c.name] && (catRows[c.name]
                    ? (<>
                      {catRows[c.name].rows.length
                        ? catRows[c.name].rows.map(fullRow)
                        : <div className="py-6 px-4 text-[13px]" style={{ color: t.textMuted }}>Nothing available in this category right now.</div>}
                      {catRows[c.name].hasMore && (
                        <button onClick={() => loadMore(c.name)} disabled={catRows[c.name].loadingMore}
                          className="w-full py-3 text-[13px] font-semibold cursor-pointer border-none"
                          style={{ background: dark ? "rgba(196,125,142,.07)" : "rgba(196,125,142,.05)", color: t.accent, borderTop: `1px solid ${dark ? "rgba(255,255,255,.05)" : "rgba(0,0,0,.04)"}` }}>
                          {catRows[c.name].loadingMore ? <Spinner size={13} color={t.accent} /> : `Show more (${catRows[c.name].rows.length.toLocaleString()} of ${c.count.toLocaleString()})`}
                        </button>
                      )}
                    </>)
                    : <div aria-busy="true" aria-label={`Loading ${c.name}`}>
                      {[0, 1, 2].map(i => (
                        <div key={i} className="flex items-center gap-3 py-3 px-4"
                          style={{ borderTop: `1px solid ${dark ? "rgba(255,255,255,.05)" : "rgba(0,0,0,.04)"}` }}>
                          <div className={`skel-bone ${dark ? "skel-dark" : "skel-light"} w-[9px] h-[9px] rounded-full shrink-0`} />
                          <div className="flex-1 min-w-0">
                            <div className={`skel-bone ${dark ? "skel-dark" : "skel-light"} h-[13px] mb-1.5`} style={{ width: `${58 + ((i * 15) % 28)}%` }} />
                            <div className={`skel-bone ${dark ? "skel-dark" : "skel-light"} w-[120px] h-[10px]`} />
                          </div>
                          <div className={`skel-bone ${dark ? "skel-dark" : "skel-light"} w-[60px] h-[13px] shrink-0`} />
                        </div>
                      ))}
                    </div>)}
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* detail drawer */}
      {drawer && (
        <div className="fixed inset-0 z-[300]">
          <button type="button" aria-label="Close service details"
            className="absolute inset-0 border-none cursor-default"
            style={{ background: "rgba(0,0,0,.45)" }} onClick={() => setDrawer(null)} />
          <div role="dialog" aria-modal="true" aria-label={`${drawer.label} details`}
            className="absolute right-0 top-0 bottom-0 w-full max-w-[400px] p-6 overflow-y-auto"
            style={{ background: dark ? "#16121a" : "#fdfcfb", borderLeft: `1px solid ${border}`, overscrollBehavior: "contain" }}>
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">{gradeDot(drawer.grade)}<span className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: t.textMuted }}>{drawer.grade ? GRADE_META[drawer.grade].label : "Not graded"}</span></div>
              <button onClick={() => setDrawer(null)} aria-label="Close" className="border-none cursor-pointer text-[15px]" style={{ background: "none", color: t.textMuted }}>×</button>
            </div>

            <div className="text-[15px] font-semibold mb-4 leading-snug" style={{ color: t.text }}>{drawer.label}</div>

            {/* the thing they came for */}
            <div className="rounded-[12px] p-4 mb-4" style={{ background: softBg }}>
              <div className="text-[11px] font-semibold uppercase tracking-wide mb-1" style={{ color: t.textMuted }}>Service ID — use this in API calls</div>
              <div className="flex items-center justify-between">
                <span className="text-[28px] font-bold" style={{ color: t.text, fontFamily: "'JetBrains Mono', monospace" }}>{drawer.id}</span>
                <button onClick={() => { copyText(String(drawer.id)); setCopied(true); }}
                  className="py-1.5 px-3 rounded-lg text-[11px] font-semibold border-none cursor-pointer transition-colors" style={{ background: copied ? "#16a34a" : t.accent, color: "#fff" }}>{copied ? "Copied" : "Copy"}</button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 mb-4">
              {[["Price / 1k", naira(drawer.price)], ["Min – Max", `${drawer.min.toLocaleString()} – ${drawer.max.toLocaleString()}`],
                ["Refill", drawer.refill ? "Supported" : "Not offered"], ["Cancel", drawer.cancel ? "Supported" : "Not offered"]].map(([label, value]) => (
                <div key={label} className="rounded-[10px] py-2.5 px-3" style={{ background: cardBg, border: `1px solid ${border}` }}>
                  <div className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: t.textMuted }}>{label}</div>
                  <div className="text-[13px] font-semibold" style={{ color: t.text }}>{value}</div>
                </div>
              ))}
            </div>

            {drawer.attrs?.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-4">
                {drawer.attrs.map(a => (
                  <span key={a} className="py-1 px-2.5 rounded-full text-[11px] font-medium" style={{ background: dark ? "rgba(255,255,255,.07)" : "rgba(0,0,0,.05)", color: t.textSoft }}>{a}</span>
                ))}
              </div>
            )}

            <div className="text-[13px] leading-relaxed" style={{ color: t.textMuted }}>
              Full-catalogue services carry the provider&rsquo;s own terms{drawer.refill ? "" : " and no refill guarantee"}. Order through the API using the ID above.
            </div>
          </div>
        </div>
      )}
    </>
  );
}
