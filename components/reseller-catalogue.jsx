'use client';
import { useMoney } from "./locale";
import { useT } from "./locale";
import { useState, useEffect, useRef, useCallback } from "react";
import { RailSec, RailCard } from "./rail";
import { useBodyScrollLock, Emph } from "./ui-primitives";
import { SkelList } from "./skeleton";
import { copyText } from '@/lib/clipboard';
import { OffsetIcon } from "./offset-icons";
import { CopyChip } from "./copy-chip";
import { PlatformIcon } from "./platform-icon";
import { msg } from "../lib/i18n";
import { SegPill } from "./seg-pill";

// The reseller's catalogue (17 Oct 2026). Two lists: the full list, which is
// what the API sells and the page searches and opens a platform at a time, and
// Nitro picks, the curated tiers, read-only here and ordered on New Order until
// they join the full list. Every number on it uses the order-number copy chip.
const GRADE_META = {
  premium: { dot: "#3b82f6", label: "Premium", letter: "P" },
  standard: { dot: "#16a34a", label: "Standard", letter: "S" },
  basic: { dot: "#d97706", label: "Basic", letter: "B" },
};
// The promise is the tier name, not the upstream data (CLAUDE.md).
const PROMISE = { Budget: msg("No refill"), Standard: msg("30-day refill"), Premium: msg("Lifetime refill") };
const NAME = { twitter: "Twitter/X", youtube: "YouTube", tiktok: "TikTok", whatsapp: "WhatsApp", linkedin: "LinkedIn", soundcloud: "SoundCloud", applemusic: "Apple Music", playstore: "Play Store", appstore: "App Store" };

// Reseller prices come from the same catalogue and are paid from the same naira
// wallet, so they follow the display currency like every other price. The
// formatter is passed in because this helper sits outside the components.
const naira = (n, money) => money(Number(n || 0));

const CAT_CSS = `
.cg{--cg-print:#efc4cf;--cg-field:#f6f0eb}
.dark .cg{--cg-print:#6b3a4a;--cg-field:rgba(255,255,255,.05)}
.cg-note{display:flex;align-items:flex-start;gap:11px;padding:12px 14px;border-radius:14px;background:var(--t-card-bg);box-shadow:inset 0 0 0 1px var(--t-card-border),3px 3px 0 var(--cg-print);font-size:13.5px;line-height:1.55;color:var(--t-text-soft)}
.cg-note b{color:var(--t-text);font-weight:700}
.cg-note a,.cg-note button{padding:0;border:0;background:none;font:inherit;font-weight:700;color:var(--t-accent-ink);text-decoration:underline;text-underline-offset:3px;cursor:pointer}
.cg-srch{position:relative;display:block}
.cg-srch input{width:100%;height:48px;padding-inline:42px 14px;border:0;border-radius:13px;font:inherit;font-size:15px;color:var(--t-text);background:var(--t-card-bg);box-shadow:inset 0 0 0 1px var(--t-card-border);outline:none}
.cg-srch input:focus-visible{box-shadow:inset 0 0 0 1.5px var(--t-accent)}
.cg-srch svg{position:absolute;inset-inline-start:14px;top:50%;transform:translateY(-50%);color:var(--t-text-muted)}
.cg-count{display:flex;justify-content:space-between;align-items:baseline;gap:10px;margin:2px 2px 0;font-size:10.5px;font-weight:800;letter-spacing:1.2px;text-transform:uppercase;color:var(--t-text-muted)}
.cg-count span{font-size:12px;font-weight:600;letter-spacing:0;text-transform:none}
.cg-pl{border-radius:14px;background:var(--t-card-bg);box-shadow:inset 0 0 0 1px var(--t-card-border);overflow:hidden}
.cg-pl.open{box-shadow:inset 0 0 0 1px var(--t-card-border),3px 3px 0 var(--cg-print)}
.cg-plh{display:flex;align-items:center;gap:12px;width:100%;padding:10px 14px;border:0;background:none;font:inherit;cursor:pointer;text-align:start}
.cg-plh:hover,.cg-svc:hover{background:var(--cg-field)}
.cg-plh b{flex:1;min-width:0;font-size:15px;font-weight:650;color:var(--t-text)}
.cg-chev{flex-shrink:0;color:var(--t-text-muted);transition:transform .18s}
.cg-pl.open .cg-chev{transform:rotate(90deg)}
[dir="rtl"] .cg-chev{transform:scaleX(-1)}
[dir="rtl"] .cg-pl.open .cg-chev{transform:rotate(90deg)}
.cg-svc{display:flex;align-items:center;gap:12px;width:100%;padding:11px 14px;border:0;border-top:1px solid var(--t-card-border);background:none;font:inherit;text-align:start}
.cg-svc[role="button"]{cursor:pointer}
.cg-res .cg-svc:first-child{border-top:0}
.cg-gr{width:22px;height:22px;border-radius:6px;display:grid;place-items:center;flex-shrink:0;font-size:11px;font-weight:800;color:var(--gc);background:color-mix(in srgb,var(--gc) 13%,var(--t-card-bg));box-shadow:1.5px 1.5px 0 color-mix(in srgb,var(--gc) 30%,transparent)}
.cg-gr.none{color:var(--t-text-muted);background:none;box-shadow:inset 0 0 0 1.5px var(--t-card-border)}
.cg-tx{flex:1;min-width:0;display:flex;flex-direction:column;gap:5px}
.cg-tx b{font-size:13.5px;font-weight:600;line-height:1.35;color:var(--t-text)}
.cg-meta{display:flex;align-items:center;gap:6px;flex-wrap:wrap;font-size:11.5px;color:var(--t-text-muted)}
.cg-tag{display:inline-flex;align-items:center;height:20px;padding-inline:7px;border-radius:6px;font-size:11px;font-weight:650;color:var(--t-text-muted);box-shadow:inset 0 0 0 1px var(--t-card-border)}
.cg-tag.ok{color:var(--t-green);box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--t-green) 30%,transparent);background:color-mix(in srgb,var(--t-green) 9%,transparent)}
.cg-pr{flex-shrink:0;display:flex;flex-direction:column;align-items:flex-end;gap:2px;min-width:92px;text-align:end}
.cg-pr b{font-family:'JetBrains Mono',monospace;font-size:15px;font-weight:700;font-variant-numeric:tabular-nums;color:var(--t-text)}
.cg-pr small{font-size:11px;color:var(--t-text-muted)}
.cg-pr s{font-family:'JetBrains Mono',monospace;font-size:11px;font-weight:600;color:var(--t-text-muted)}
.cg-off{font-size:10.5px;font-weight:800;color:var(--t-green);margin-inline-start:4px}
.cg-more{width:100%;height:42px;border:0;border-top:1px solid var(--t-card-border);background:var(--cg-field);font:inherit;font-size:13px;font-weight:700;color:var(--t-accent-ink);cursor:pointer}
.cg-grp{padding:9px 14px 7px;border-top:1px solid var(--t-card-border);font-size:12.5px;font-weight:700;color:var(--t-text);background:var(--cg-field)}
.cg-tier{display:inline-flex;align-items:center;justify-content:center;min-width:78px;flex-shrink:0;height:22px;padding-inline:8px;border-radius:7px;font-size:11.5px;font-weight:800;color:var(--t-accent-ink);background:rgba(196,125,142,.12);box-shadow:1.5px 1.5px 0 var(--cg-print)}
.cg-empty{padding:22px 14px;text-align:center;font-size:13.5px;color:var(--t-text-muted)}
.cg-lgr{display:flex;align-items:flex-start;gap:10px;font-size:12.5px;line-height:1.45;color:var(--t-text-soft)}
.cg-lgr b{display:block;font-size:13px;font-weight:700;color:var(--t-text)}
.cg-legend{border-radius:14px;background:var(--t-card-bg);box-shadow:inset 0 0 0 1px var(--t-card-border);overflow:hidden}
.cg-legend>button{display:flex;align-items:center;gap:10px;width:100%;padding:11px 14px;border:0;background:none;font:inherit;font-size:13.5px;font-weight:650;color:var(--t-text);cursor:pointer;text-align:start}
.cg-legend[data-open="true"] .cg-chev{transform:rotate(90deg)}
.cg-sheet{position:absolute;display:flex;flex-direction:column;background:var(--t-card-bg);box-shadow:inset 0 0 0 1px var(--t-card-border),5px 5px 0 rgba(10,6,14,.3);overflow:hidden;inset-inline-end:0;top:0;bottom:0;width:100%;max-width:430px}
@media (max-width:767px){.cg-sheet{top:auto;inset-inline:0;max-width:none;max-height:88dvh;border-radius:22px 22px 0 0}}
.cg-sh{display:flex;align-items:center;gap:10px;padding:16px 18px 6px}
.cg-sh>span:nth-child(2){flex:1;font-size:11px;font-weight:800;letter-spacing:1.1px;text-transform:uppercase;color:var(--t-text-muted)}
.cg-x{width:32px;height:32px;border:0;border-radius:10px;display:grid;place-items:center;cursor:pointer;color:var(--t-text-soft);background:var(--t-card-bg);box-shadow:inset 0 0 0 1px var(--t-card-border),2px 2px 0 var(--cg-print)}
.cg-shb{overflow-y:auto;overscroll-behavior:contain;padding:4px 18px 22px;display:grid;gap:14px}
.cg-idb{padding:13px 14px;border-radius:14px;background:var(--cg-field);box-shadow:inset 0 0 0 1px var(--t-card-border)}
.cg-idb small{display:block;margin-bottom:8px;font-size:10.5px;font-weight:800;letter-spacing:1.1px;text-transform:uppercase;color:var(--t-text-muted)}
.cg-facts{display:grid;grid-template-columns:1fr 1fr;border-radius:14px;box-shadow:inset 0 0 0 1px var(--t-card-border);overflow:hidden}
.cg-facts div{padding:10px 12px;border-top:1px solid var(--t-card-border);border-inline-start:1px solid var(--t-card-border)}
.cg-facts div:nth-child(2n+1){border-inline-start:0}
.cg-facts div:nth-child(-n+2){border-top:0}
.cg-facts small{display:block;font-size:10px;font-weight:800;letter-spacing:1px;text-transform:uppercase;color:var(--t-text-muted)}
.cg-facts b{display:block;margin-top:2px;font-size:13.5px;font-weight:700;color:var(--t-text)}
.cg-facts s{font-family:'JetBrains Mono',monospace;font-size:11px;font-weight:600;color:var(--t-text-muted);margin-inline-start:6px}
.cg-attrs{display:flex;flex-wrap:wrap;gap:6px}
.cg-attrs span{display:inline-flex;align-items:center;height:24px;padding-inline:9px;border-radius:7px;font-size:11.5px;font-weight:600;color:var(--t-text-soft);box-shadow:inset 0 0 0 1px var(--t-card-border)}
.cg-term{border-radius:14px;color:#f6eef2;background:radial-gradient(70% 120% at 100% 0%,rgba(196,125,142,.38),transparent 62%),linear-gradient(150deg,#1f121a 0%,#2e1b26 55%,#4a2a3a 100%);box-shadow:3px 3px 0 #120a10;overflow:hidden;direction:ltr;text-align:left}
.dark .cg-term{box-shadow:3px 3px 0 #3a2230}
.cg-termh{display:flex;align-items:center;gap:8px;padding:8px 9px 8px 13px;border-bottom:1px solid rgba(255,255,255,.1)}
.cg-termh span{flex:1;font-size:10.5px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;color:rgba(246,238,242,.6)}
.cg-termh button{height:26px;padding-inline:10px;border:0;border-radius:7px;font:inherit;font-size:11.5px;font-weight:700;color:#f3c5d1;background:rgba(255,255,255,.08);box-shadow:inset 0 0 0 1px rgba(255,255,255,.16);cursor:pointer}
.cg-termh button.done{color:#9ff0c9}
.cg-term pre{margin:0;padding:12px 14px 14px;font:500 12px/1.7 'JetBrains Mono',monospace;white-space:pre;overflow-x:auto}
.cg-term .k{color:#f3a9bd}.cg-term .s{color:#9ff0c9}.cg-term .c{color:rgba(246,238,242,.45)}
.cg-sold{font-size:12.5px;line-height:1.55;color:var(--t-text-muted)}
.cg-sold b{color:var(--t-text)}
@media (prefers-reduced-motion:reduce){.cg-chev{transition:none}}
`;

const Chev = () => <svg className="cg-chev" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg>;

function Grade({ grade }) {
  const tr = useT();
  const m = grade && GRADE_META[grade];
  if (!m) return <span className="cg-gr none" title={tr("Not graded")} aria-label={tr("Not graded")}>–</span>;
  return <span className="cg-gr" style={{ "--gc": m.dot }} title={m.label} aria-label={m.label}>{m.letter}</span>;
}

// The legend content, shared by the phone's fold and the desktop rail.
function GradeLegendBody() {
  const tr = useT();
  return (
    <div className="grid gap-2.5">
      <div className="cg-lgr"><Grade grade="premium" /><span><b>{GRADE_META.premium.label}</b>{tr("The strongest of its kind in the catalogue.")}</span></div>
      <div className="cg-lgr"><Grade grade="standard" /><span><b>{GRADE_META.standard.label}</b>{tr("Dependable for most orders.")}</span></div>
      <div className="cg-lgr"><Grade grade="basic" /><span><b>{GRADE_META.basic.label}</b>{tr("The cheapest way to the number.")}</span></div>
      <div className="cg-lgr"><Grade grade={null} /><span><b>{tr("Not graded")}</b>{tr("Not a lesser service. Grading is not available across the whole catalogue, so judge these on refill terms and price.")}</span></div>
    </div>
  );
}

// Rendered by the dashboard's right rail on desktop, matching the other pages'
// sidebar pattern.
export function ResellerCatalogueSidebar() {
  const tr = useT();
  return (
    <div className="rr cg">
      <style>{CAT_CSS}</style>
      <RailSec icon="diamond">{tr("Quality grades")}</RailSec>
      <RailCard style={{ padding: "12px 14px" }}>
        <GradeLegendBody />
      </RailCard>
    </div>
  );
}

const pname = (id, tr) => id === "webtraffic" ? tr("Website traffic") : NAME[id] || (id ? id[0].toUpperCase() + id.slice(1) : "");

function apiCall(s) {
  return [
    <span key="c" className="c"># POST, form-encoded</span>, "\ncurl https://nitro.ng/api/v2 \\\n",
    "  -d ", <span key="k1" className="k">key</span>, "=", <span key="v1" className="s">YOUR_API_KEY</span>, " \\\n",
    "  -d ", <span key="k2" className="k">action</span>, "=", <span key="v2" className="s">add</span>, " \\\n",
    "  -d ", <span key="k3" className="k">service</span>, "=", <span key="v3" className="s">{s.id}</span>, " \\\n",
    "  -d ", <span key="k4" className="k">link</span>, "=", <span key="v4" className="s">LINK</span>, " \\\n",
    "  -d ", <span key="k5" className="k">quantity</span>, "=", <span key="v5" className="s">{Math.max(s.min, 1000)}</span>,
  ];
}
const apiText = (s) => `curl https://nitro.ng/api/v2 \\\n  -d key=YOUR_API_KEY \\\n  -d action=add \\\n  -d service=${s.id} \\\n  -d link=LINK \\\n  -d quantity=${Math.max(s.min, 1000)}`;

export default function ResellerCataloguePage({ dark, t, onNavigate }) {
  const tr = useT();
  const money = useMoney();
  const [state, setState] = useState({ status: "loading" });
  const [view, setView] = useState("full");
  const [picks, setPicks] = useState(null);
  const [openCats, setOpenCats] = useState({});
  const [catRows, setCatRows] = useState({});
  const [query, setQuery] = useState("");
  const [results, setResults] = useState(null);
  const [drawer, setDrawer] = useState(null);
  const [legendOpen, setLegendOpen] = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);
  const searchTimer = useRef(null);
  useBodyScrollLock(!!drawer);

  // Escape closes the sheet. Without it a keyboard user can open the panel and
  // has no way back out, since the close control is the only exit.
  useEffect(() => {
    if (!drawer) return undefined;
    const onKey = e => { if (e.key === "Escape") setDrawer(null); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [drawer]);
  useEffect(() => { setCodeCopied(false); }, [drawer]);
  useEffect(() => {
    if (!codeCopied) return undefined;
    const id = setTimeout(() => setCodeCopied(false), 1600);
    return () => clearTimeout(id);
  }, [codeCopied]);

  useEffect(() => {
    fetch("/api/reseller/catalogue")
      .then(r => r.json().then(d => ({ ok: r.ok, status: r.status, d })))
      .then(({ ok, status, d }) => setState(ok ? { status: "ready", data: d } : { status: status === 403 ? "denied" : "error", error: d.error }))
      .catch(() => setState({ status: "error" }));
  }, []);

  // Nitro picks load the first time they are asked for.
  useEffect(() => {
    if (view !== "picks" || picks) return;
    fetch("/api/reseller/catalogue?view=picks").then(r => r.ok ? r.json() : null).then(d => setPicks(d?.groups || [])).catch(() => setPicks([]));
  }, [view, picks]);

  // Instant search over the whole full list, same 350ms debounce the rest of Nitro uses.
  useEffect(() => {
    clearTimeout(searchTimer.current);
    const q = query.trim();
    if (view !== "full" || (q.length < 2 && !/^\d+$/.test(q))) { setResults(null); return undefined; }
    searchTimer.current = setTimeout(() => {
      fetch(`/api/reseller/catalogue?q=${encodeURIComponent(q)}`)
        .then(r => r.json())
        .then(d => setResults(d.services || []))
        .catch(() => setResults([]));
    }, 350);
    return () => clearTimeout(searchTimer.current);
  }, [query, view]);

  const fetchCat = useCallback((name, offset = 0) => {
    fetch(`/api/reseller/catalogue?category=${encodeURIComponent(name)}&offset=${offset}`)
      .then(r => r.json())
      .then(d => setCatRows(p => ({
        ...p,
        [name]: { rows: offset ? [...(p[name]?.rows || []), ...(d.services || [])] : (d.services || []), hasMore: !!d.hasMore, loadingMore: false },
      })))
      .catch(() => setCatRows(p => ({ ...p, [name]: { rows: p[name]?.rows || [], hasMore: false, loadingMore: false } })));
  }, []);

  const toggleCat = (name) => {
    setOpenCats(p => ({ ...p, [name]: !p[name] }));
    if (view === "full" && !catRows[name]) fetchCat(name, 0);
  };
  const loadMore = (name) => {
    const cur = catRows[name];
    if (!cur || cur.loadingMore) return;
    setCatRows(p => ({ ...p, [name]: { ...p[name], loadingMore: true } }));
    fetchCat(name, cur.rows.length);
  };
  const switchView = (v) => { setView(v); setQuery(""); setResults(null); setOpenCats({}); };

  const sk = `skel-bone ${dark ? "skel-dark" : "skel-light"}`;
  const head = (
    <div className="pb-2 desktop:pb-3.5 mb-1">
      <div className="text-lg desktop:text-[22px] font-semibold" style={{ color: t.text }}>{tr("Catalogue")}</div>
      <div className="text-sm desktop:text-[15px] max-md:text-xs mt-0.5" style={{ color: t.textMuted }}>{tr("Every service you can order through the API, at your rate. Search by name or number, or open a platform.")}</div>
      <div className="page-divider" style={{ background: t.cardBorder }} />
    </div>
  );

  // A skeleton in the shape of the page it is replacing, matching the house
  // pattern used on Tasks and the dashboard.
  if (state.status === "loading") {
    return (
      <div className="cg" aria-busy="true" aria-live="polite" aria-label={tr("Loading catalogue")}>
        <style>{CAT_CSS}</style>
        {head}
        <div className="grid gap-3.5">
          <div className={`${sk} h-[64px] rounded-[14px]`} />
          <div className={`${sk} w-[260px] h-[44px] rounded-[13px]`} />
          <div className={`${sk} h-[48px] rounded-[13px]`} />
          {[0, 1, 2, 3, 4].map(i => <div key={i} className={`${sk} h-[52px] rounded-[14px]`} />)}
        </div>
      </div>
    );
  }
  if (state.status === "denied" || state.status === "error") {
    return (
      <div className="cg">
        <style>{CAT_CSS}</style>
        {head}
        <div className="cg-note">
          <span className="ic-tile" style={{ width: 30, height: 30, borderRadius: 9 }}><OffsetIcon name="key" size={15} /></span>
          {state.status === "denied"
            ? <span><b>{tr("Reseller access required")}</b><br />{tr("The catalogue is for approved resellers. Message our support on WhatsApp and tell us about your business to get set up.")}</span>
            : <span>{tr("Could not load the catalogue. Refresh to try again.")}</span>}
        </div>
      </div>
    );
  }

  const cats = state.data.categories || [];
  const total = cats.reduce((n, c) => n + c.count, 0);
  const q = query.trim().toLowerCase();

  const fullRow = (s) => (
    <div key={s.id} className="cg-svc" role="button" tabIndex={0} onClick={() => setDrawer(s)} onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setDrawer(s); } }}>
      <Grade grade={s.grade} />
      <span className="cg-tx">
        <b>{s.label}</b>
        <span className="cg-meta">
          <CopyChip value={s.id} label={tr("Copy service number")} small />
          <span>{s.min.toLocaleString()}{tr(" to ")}{s.max.toLocaleString()}</span>
          {s.refill && <span className="cg-tag ok">{tr("Refill")}</span>}
          {s.cancel && <span className="cg-tag">{tr("Cancel")}</span>}
        </span>
      </span>
      <Price price={s.price} retail={s.retail} money={money} tr={tr} />
    </div>
  );

  // Nitro picks, grouped by platform the way the full list is.
  const pickGroups = (picks || []).filter(g => !q || g.name.toLowerCase().includes(q) || g.tiers.some(x => String(x.number || "").startsWith(q)));
  const pickPlats = [...new Set(pickGroups.map(g => g.platform))];
  const tierRow = (g, x, i) => (
    <div key={`${g.name}-${i}`} className="cg-svc">
      <span className="cg-tier">{x.tier}</span>
      <span className="cg-tx">
        {!g.options && PROMISE[x.tier] && <b>{tr(PROMISE[x.tier])}</b>}
        <span className="cg-meta">
          {x.number != null && <CopyChip value={x.number} label={tr("Copy service number")} small />}
          <span>{x.min.toLocaleString()}{tr(" to ")}{x.max.toLocaleString()}</span>
          {x.speed && <span>{x.speed}</span>}
        </span>
      </span>
      <Price price={x.price} retail={x.retail} money={money} tr={tr} />
    </div>
  );

  const platRow = (name, count, body) => {
    const open = !!openCats[name];
    return (
      <div key={name} className={"cg-pl" + (open ? " open" : "")}>
        <button type="button" className="cg-plh" onClick={() => toggleCat(name)} aria-expanded={open}>
          <PlatformIcon platform={name} dark={dark} size={32} print />
          <b>{pname(name, tr)}</b>
          <span className="pbadge">{count.toLocaleString()}</span>
          <Chev />
        </button>
        {open && body}
      </div>
    );
  };

  const fullBody = (c) => {
    const cr = catRows[c.name];
    if (!cr) return <div aria-busy="true" aria-label={tr("Loading catalogue")}><SkelList dark={dark} rows={3} bare avatar={false} rowH={52} /></div>;
    return (<>
      {cr.rows.length ? cr.rows.map(fullRow) : <div className="cg-empty">{tr("Nothing available in this category right now.")}</div>}
      {cr.loadingMore && <SkelList dark={dark} rows={3} bare avatar={false} rowH={52} />}
      {cr.hasMore && <button type="button" className="cg-more" onClick={() => loadMore(c.name)} disabled={cr.loadingMore}>{tr("Show more")} ({cr.rows.length.toLocaleString()}/{c.count.toLocaleString()})</button>}
    </>);
  };

  return (
    <div className="cg">
      <style>{CAT_CSS}</style>
      {head}
      <div className="grid gap-3.5">
        <div className="cg-note">
          <span className="ic-tile" style={{ width: 30, height: 30, borderRadius: 9 }}><OffsetIcon name="key" size={15} /></span>
          {view === "full"
            ? <span><Emph>{tr("Order these through the API with the key in *Settings*. The rate shown is what each order charges your wallet.")}</Emph> <a href="/resellers/docs" target="_blank" rel="noopener noreferrer">{tr("Read the API docs")}</a></span>
            : <span><Emph>{tr("*Nitro picks* are the tiers with the refill promise. Order them on New Order; the API serves the full list.")}</Emph>{onNavigate && <> <button type="button" onClick={() => onNavigate("services")}>{tr("Open New Order")}</button></>}</span>}
        </div>

        <div className="flex">
          <SegPill value={view} onChange={switchView} dark={dark} t={t} options={[
            { value: "full", label: <span className="inline-flex items-center gap-1.5">{tr("Full list")}<span className="pbadge">{total.toLocaleString()}</span></span> },
            { value: "picks", label: <span className="inline-flex items-center gap-1.5">{tr("Nitro picks")}{picks && <span className="pbadge">{picks.reduce((n, g) => n + g.tiers.length, 0).toLocaleString()}</span>}</span> },
          ]} />
        </div>

        <label className="cg-srch">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>
          <input type="search" value={query} onChange={e => setQuery(e.target.value)} autoComplete="off" spellCheck={false}
            aria-label={tr("Search the catalogue by service name or ID")} placeholder={tr("Search by name or service number")} />
        </label>

        {view === "full" && (
          <div className="cg-legend desktop:hidden" data-open={legendOpen}>
            <button type="button" onClick={() => setLegendOpen(v => !v)} aria-expanded={legendOpen}>
              <span className="flex gap-1"><Grade grade="premium" /><Grade grade="standard" /><Grade grade="basic" /></span>
              <span className="flex-1">{tr("What the letters mean")}</span>
              <Chev />
            </button>
            {legendOpen && <div className="px-3.5 pb-3.5 pt-1"><GradeLegendBody /></div>}
          </div>
        )}

        {view === "full" ? (
          results !== null ? (<>
            <div className="cg-count">{tr("Results")}<span>{results.length.toLocaleString()} {tr("services")}</span></div>
            <div className="cg-pl cg-res">{results.length ? results.map(fullRow) : <div className="cg-empty">{tr("Nothing matches “")}{query.trim()}{tr("”.")}</div>}</div>
          </>) : (<>
            <div className="cg-count">{tr("Platforms")}<span>{total.toLocaleString()} {tr("services")}</span></div>
            <div className="grid gap-2">{cats.map(c => platRow(c.name, c.count, fullBody(c)))}</div>
          </>)
        ) : picks === null ? (
          <div className="grid gap-2">{[0, 1, 2, 3].map(i => <div key={i} className={`${sk} h-[52px] rounded-[14px]`} />)}</div>
        ) : (<>
          <div className="cg-count">{tr("Platforms")}<span>{pickGroups.reduce((n, g) => n + g.tiers.length, 0).toLocaleString()} {tr("services")}</span></div>
          {pickPlats.length === 0
            ? <div className="cg-pl"><div className="cg-empty">{tr("Nothing matches “")}{query.trim()}{tr("”.")}</div></div>
            : <div className="grid gap-2">{pickPlats.map(pl => {
                const gs = pickGroups.filter(g => g.platform === pl);
                return platRow(pl, gs.reduce((n, g) => n + g.tiers.length, 0), gs.map(g => (
                  <div key={g.name}>
                    <div className="cg-grp">{g.name}</div>
                    {g.tiers.map((x, i) => tierRow(g, x, i))}
                  </div>
                )));
              })}</div>}
        </>)}
      </div>

      {/* The service sheet. Over the page it owns the screen: the page behind
          does not scroll, the backdrop closes it, and the surface is opaque. */}
      {drawer && (
        <div className="fixed inset-0 z-[300]">
          <button type="button" aria-label={tr("Close service details")} className="absolute inset-0 border-none cursor-default" style={{ background: "rgba(10,6,14,.5)" }} onClick={() => setDrawer(null)} />
          <div role="dialog" aria-modal="true" aria-label={drawer.label} className="cg-sheet">
            <div className="cg-sh">
              <Grade grade={drawer.grade} />
              <span>{drawer.grade ? GRADE_META[drawer.grade].label : tr("Not graded")}</span>
              <button type="button" className="cg-x" onClick={() => setDrawer(null)} aria-label={tr("Close")}><OffsetIcon name="close" size={14} /></button>
            </div>
            <div className="cg-shb">
              <div className="text-[16.5px] font-bold leading-snug" style={{ color: t.text }}>{drawer.label}</div>
              <div className="cg-idb"><small>{tr("Service number, for the API")}</small><CopyChip value={drawer.id} label={tr("Copy service number")} size="lg" /></div>
              <div className="cg-facts">
                <div><small>{tr("Your rate per 1,000")}</small><b>{naira(drawer.price, money)}{drawer.retail > drawer.price && <s>{naira(drawer.retail, money)}</s>}</b></div>
                <div><small>{tr("Order size")}</small><b>{drawer.min.toLocaleString()}{tr(" to ")}{drawer.max.toLocaleString()}</b></div>
                <div><small>{tr("Refill")}</small><b>{drawer.refill ? tr("Offered") : tr("Not offered")}</b></div>
                <div><small>{tr("Cancel")}</small><b>{drawer.cancel ? tr("Offered") : tr("Not offered")}</b></div>
              </div>
              {drawer.attrs?.length > 0 && <div className="cg-attrs">{drawer.attrs.map(a => <span key={a}>{a}</span>)}</div>}
              {/* A developer copy, so the code block keeps its own control. */}
              <div className="cg-term">
                <div className="cg-termh"><span>{tr("Order it through the API")}</span><button type="button" className={codeCopied ? "done" : ""} onClick={async () => { if (await copyText(apiText(drawer))) setCodeCopied(true); }}>{codeCopied ? tr("Copied") : tr("Copy")}</button></div>
                <pre>{apiCall(drawer)}</pre>
              </div>
              <div className="cg-sold"><Emph>{tr("*Sold as listed.* The refill and cancel terms above are this service's own. Nitro picks on New Order carry the refill promise.")}</Emph></div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/** Your rate per 1,000, with retail struck beside it when you pay less. */
function Price({ price, retail, money, tr }) {
  const off = retail > price ? Math.round((1 - price / retail) * 100) : 0;
  return (
    <span className="cg-pr">
      <b>{naira(price, money)}</b>
      <small>{tr("per 1,000")}</small>
      {off > 0 && <span><s>{naira(retail, money)}</s><span className="cg-off">−{off}%</span></span>}
    </span>
  );
}
