'use client';
import { useState, useEffect, useMemo, useRef } from "react";
import { calculateTierPrice, formatNaira, DEFAULT_USD_RATE } from "../lib/markup";
import { useConfirm } from "./confirm-dialog";
import { FilterDropdown } from "./date-range-picker";
import InlineAlert from "./inline-alert";
import { PlatformIcon } from "./platform-icon";

const TIER_COLORS = { Budget: "#f59e0b", Standard: "#3b82f6", Premium: "#a855f7" };
const TIER_BG = { Budget: "rgba(245,158,11,.14)", Standard: "rgba(59,130,246,.14)", Premium: "rgba(168,85,247,.14)" };
const PROV_META = { mtp: ["MTP", "#ef4444"], jap: ["JAP", "#3b82f6"], dao: ["DAO", "#22c55e"] };

/* Provider tag — renders only when the API payload includes service.provider */
function ProvTag({ provider }) {
  const meta = PROV_META[provider];
  if (!meta) return null;
  return <span className="text-[9px] font-extrabold tracking-[.5px] py-0.5 px-1.5 rounded-full mr-1.5 align-middle" style={{ color: meta[1], background: `${meta[1]}22` }}>{meta[0]}</span>;
}

function LinkServiceInline({ tierId, services, dark, t, inputStyle, markupSettings, onLink }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [linking, setLinking] = useState(false);
  const filtered = useMemo(() => {
    if (!search) return services.slice(0, 15);
    return services.filter(s => s.name.toLowerCase().includes(search.toLowerCase()) || String(s.apiId).includes(search)).slice(0, 15);
  }, [services, search]);

  if (!open) {
    return (
      <span className="flex items-center gap-1.5">
        <span className="text-xs py-0.5 px-2 rounded-full font-semibold flex items-center gap-1" style={{ background: dark ? "rgba(224,164,88,.1)" : "rgba(217,119,6,.06)", color: dark ? "#e0a458" : "#d97706" }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
          Unlinked
        </span>
        <button onClick={() => setOpen(true)} className="bg-transparent text-xs font-semibold cursor-pointer border-none p-0 font-[inherit] transition-transform duration-150 hover:-translate-y-px" style={{ color: "#c47d8e" }}>Link service</button>
      </span>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="relative">
        <input aria-label="Search services" placeholder="Search services..." value={search} onChange={e => setSearch(e.target.value)} autoFocus className="w-full py-[5px] px-2 pr-7 rounded-lg text-[13px] outline-none font-[inherit]" style={{ ...inputStyle }} />
        {search && <button aria-label="Clear search" onClick={() => setSearch("")} className="absolute right-1.5 top-1/2 -translate-y-1/2 w-4 h-4 flex items-center justify-center rounded-full text-[10px] cursor-pointer border-none" style={{ background: dark ? "rgba(255,255,255,.18)" : "rgba(0,0,0,.14)", color: t.textMuted }}><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>}
      </div>
      <div className="max-h-[120px] overflow-y-auto overscroll-contain rounded-md" style={{ border: `1px solid ${dark ? "rgba(255,255,255,.16)" : "rgba(0,0,0,.12)"}`, background: dark ? "#131728" : "#fff" }}>
        {filtered.map(s => (
          <div key={s.id} role="button" tabIndex={0} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();e.currentTarget.click()}}} onClick={async () => { setLinking(true); await onLink(s.id); setLinking(false); setOpen(false); }} className="py-[5px] px-2 text-xs cursor-pointer" style={{ color: t.text, borderBottom: `1px solid ${dark ? "rgba(255,255,255,.09)" : "rgba(0,0,0,.06)"}` }}>
            <ProvTag provider={s.provider} />
            <span className="text-[10px] mr-1" style={{ fontFamily: "'JetBrains Mono',monospace", color: t.textMuted }}>#{s.apiId}</span>
            {s.name?.slice(0, 50)}
            <span className="text-[10px] ml-1" style={{ color: t.textMuted }}>— {formatNaira(Math.round(s.costPer1k * Number(markupSettings.markup_usd_rate || 1600)))}/1k</span>
          </div>
        ))}
        {filtered.length === 0 && <div className="p-2 text-xs text-center" style={{ color: t.textMuted }}>No matches</div>}
      </div>
      <button onClick={() => setOpen(false)} className="bg-transparent text-[11px] cursor-pointer border-none p-0 self-start font-[inherit] transition-transform duration-150 hover:-translate-y-px" style={{ color: t.textMuted }}><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
    </div>
  );
}

export default function AdminServiceGroupsPage({ dark, t }) {
  const confirm = useConfirm();
  const [groups, setGroups] = useState([]);
  const [services, setServices] = useState([]);
  const [markupSettings, setMarkupSettings] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [platFilter, setPlatFilter] = useState("all");
  const [showGuide, setShowGuide] = useState(false);
  const [ngFilter, setNgFilter] = useState(false);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);

  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPlatform, setNewPlatform] = useState("");
  const [newType, setNewType] = useState("Standard");
  const [newNigerian, setNewNigerian] = useState(false);

  const [addTierGroup, setAddTierGroup] = useState(null);
  const [tierSvcSearch, setTierSvcSearch] = useState("");
  const [tierSvcId, setTierSvcId] = useState("");
  const [tierLevel, setTierLevel] = useState("Standard");
  const [tierPrice, setTierPrice] = useState("");
  const [tierRefill, setTierRefill] = useState(false);
  const [tierSpeed, setTierSpeed] = useState("0-2 hrs");

  /* Accordion state — persisted so open groups survive reloads */
  const [openIds, setOpenIds] = useState(() => {
    try { return new Set(JSON.parse(localStorage.getItem("nitro_mb_open") || "[]")); } catch { return new Set(); }
  });
  const persistOpen = (next) => {
    setOpenIds(next);
    try { localStorage.setItem("nitro_mb_open", JSON.stringify([...next])); } catch {}
  };
  const toggleGroup = (id) => {
    const next = new Set(openIds);
    if (next.has(id)) next.delete(id); else next.add(id);
    persistOpen(next);
  };
  const openGroup = (id) => {
    if (openIds.has(id)) return;
    const next = new Set(openIds); next.add(id); persistOpen(next);
  };

  const cardsRef = useRef(null);

  /* Inline tier editing — saves through the existing update-tier action */
  const [editTier, setEditTier] = useState(null); // { id, price, speed, refill }
  const [savingTier, setSavingTier] = useState(false);

  const load = async () => {
    try {
      const [sgRes, stRes] = await Promise.all([
        fetch("/api/admin/service-groups"),
        fetch("/api/admin/settings"),
      ]);
      if (!sgRes.ok) throw new Error("Failed to load");
      const sgData = await sgRes.json();
      setGroups(sgData.groups || []);
      setServices(sgData.services || []);
      if (stRes.ok) {
        const stData = await stRes.json();
        const ms = {};
        Object.entries(stData.settings || {}).filter(([k]) => k.startsWith("markup_")).forEach(([k, v]) => { ms[k] = v; });
        setMarkupSettings(ms);
      }
    } catch (e) { setError(e.message); }
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const act = async (body) => {
    try {
      const res = await fetch("/api/admin/service-groups", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Action failed"); return false; }
      await load();
      return true;
    } catch { setError("Request failed"); return false; }
  };

  const platforms = useMemo(() => [...new Set(groups.map(g => g.platform))].sort(), [groups]);
  const filtersActive = search !== "" || platFilter !== "all" || ngFilter;
  useEffect(() => {
    const handler = (e) => {
      if (filtersActive || openIds.size === 0) return;
      if (cardsRef.current && !cardsRef.current.contains(e.target)) persistOpen(new Set());
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [openIds, filtersActive]);
  const isOpen = (g) => filtersActive || openIds.has(g.id);
  const filtered = useMemo(() => {
    let g = groups;
    if (platFilter !== "all") g = g.filter(gr => gr.platform === platFilter);
    if (ngFilter) g = g.filter(gr => gr.nigerian);
    if (search) g = g.filter(gr => gr.name.toLowerCase().includes(search.toLowerCase()) || gr.platform.toLowerCase().includes(search.toLowerCase()));
    return g;
  }, [groups, platFilter, ngFilter, search]);

  const totalPages = Math.ceil(filtered.length / perPage);
  const paged = filtered.slice((page - 1) * perPage, page * perPage);

  const filteredSvcs = useMemo(() => {
    if (!tierSvcSearch) return services.slice(0, 20);
    return services.filter(s => s.name.toLowerCase().includes(tierSvcSearch.toLowerCase()) || String(s.apiId).includes(tierSvcSearch)).slice(0, 20);
  }, [services, tierSvcSearch]);

  const createGroup = async () => {
    if (!newName || !newPlatform) { setError("Name and platform required"); return; }
    const ok = await act({ action: "create-group", name: newName, platform: newPlatform, type: newType, nigerian: newNigerian });
    if (ok) { setShowNew(false); setNewName(""); setNewPlatform(""); setNewType("Standard"); setNewNigerian(false); }
  };

  const addTier = async () => {
    if (!addTierGroup || !tierSvcId || !tierPrice) { setError("Service and price required"); return; }
    const ok = await act({ action: "add-tier", groupId: addTierGroup, serviceId: tierSvcId, tier: tierLevel, sellPer1k: Math.round(Number(tierPrice) * 100), refill: tierRefill, speed: tierSpeed });
    if (ok) { setAddTierGroup(null); setTierSvcId(""); setTierSvcSearch(""); setTierLevel("Standard"); setTierPrice(""); setTierRefill(false); setTierSpeed("0-2 hrs"); }
  };

  const saveTierEdit = async () => {
    if (!editTier) return;
    setSavingTier(true);
    const ok = await act({ action: "update-tier", tierIdToUpdate: editTier.id, sellPer1k: Math.round(Number(editTier.price) * 100), speed: editTier.speed, refill: editTier.refill });
    setSavingTier(false);
    if (ok) setEditTier(null);
  };

  const usdRate = Number(markupSettings.markup_usd_rate || DEFAULT_USD_RATE || 1600);
  const tierCostKobo = (tier) => tier.service?.costPer1k != null ? Math.round(tier.service.costPer1k * usdRate) : null;
  const marginPct = (sellKobo, cKobo) => sellKobo > 0 ? Math.round(((sellKobo - cKobo) / sellKobo) * 100) : 0;
  const lowMargin = (sellKobo, cKobo) => sellKobo > 0 && sellKobo < Math.ceil(cKobo * 1.5);

  const cardBg = dark ? "rgba(255,255,255,.09)" : "rgba(255,255,255,.85)";
  const cardBd = `0.5px solid ${dark ? "rgba(255,255,255,.16)" : "rgba(0,0,0,.12)"}`;
  const headerBg = dark ? "rgba(196,125,142,.18)" : "rgba(196,125,142,.12)";
  const headerBorder = `1px solid ${dark ? "rgba(255,255,255,.12)" : "rgba(0,0,0,.08)"}`;
  const inputCls = "py-2.5 px-3.5 rounded-lg text-sm outline-none font-[inherit]";
  const inputStyle = { background: dark ? "#131728" : "#fff", border: `1px solid ${dark ? "rgba(255,255,255,.18)" : "rgba(0,0,0,.14)"}`, color: t.text };
  const selectSt = {
    backgroundColor: dark ? "rgba(255,255,255,.07)" : "rgba(0,0,0,.03)",
    border: `1px solid ${dark ? "rgba(255,255,255,.18)" : "rgba(0,0,0,.14)"}`,
    color: dark ? "rgba(255,255,255,.7)" : "rgba(0,0,0,.7)",
    backgroundImage: `url("data:image/svg+xml,%3Csvg width='10' height='6' viewBox='0 0 10 6' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1L5 5L9 1' stroke='${dark ? "%23666" : "%23999"}' stroke-width='1.5' stroke-linecap='round'/%3E%3C/svg%3E")`,
  };

  const totalTiers = groups.reduce((a, g) => a + g.tiers.length, 0);
  const enabledGroups = groups.filter(g => g.enabled).length;
  const ngCount = groups.filter(g => g.nigerian).length;

  const statChips = [
    ["Groups", String(groups.length), "linear-gradient(135deg,#c47d8e,#8b5e6b)", <svg key="g" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>],
    ["Enabled", String(enabledGroups), "linear-gradient(135deg,#34d399,#059669)", <svg key="e" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>],
    ["Tiers", String(totalTiers), "linear-gradient(135deg,#60a5fa,#2563eb)", <svg key="t" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>],
    ...(ngCount > 0 ? [["Nigerian", String(ngCount), "linear-gradient(135deg,#4ade80,#16a34a)", <svg key="n" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg>]] : []),
  ];

  return (
    <>
      <div className="adm-header">
        <div className="flex justify-between items-start">
          <div>
            <div className="adm-title" style={{ color: t.text }}>Menu Builder</div>
            <div className="adm-subtitle" style={{ color: t.textMuted }}>{groups.length} groups · {totalTiers} tiers · {services.length} services available</div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => { setShowGuide(!showGuide); if (!showGuide) setShowNew(false); }} className="adm-btn-sm flex items-center gap-1.5" style={{ borderColor: t.cardBorder, color: t.accent }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 3h6a4 4 0 014 4v14a3 3 0 00-3-3H2z"/><path d="M22 3h-6a4 4 0 00-4 4v14a3 3 0 013-3h7z"/></svg>
              {showGuide ? "Hide Guide" : "Guide"}
            </button>
            <button onClick={() => { setShowNew(!showNew); if (!showNew) setShowGuide(false); }} className="adm-btn-primary flex items-center gap-1.5">
              {showNew ? "Cancel" : <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> New Group</>}
            </button>
          </div>
        </div>
        <div className="page-divider" style={{ background: t.cardBorder }} />
      </div>

      {/* Stats */}
      {!loading && <div className="flex gap-2 flex-wrap mt-4">
        {statChips.map(([label, val, grad, icon]) => (
          <div key={label} className="flex-1 min-w-[110px] flex items-center gap-2.5 rounded-xl py-2.5 px-3.5" style={{ background: cardBg, border: cardBd }}>
            <div className="w-[30px] h-[30px] rounded-[9px] flex items-center justify-center shrink-0 text-white" style={{ background: grad }}>{icon}</div>
            <div>
              <div className="text-[9.5px] font-bold uppercase tracking-[.9px]" style={{ color: t.textMuted }}>{label}</div>
              <div className="m text-base font-bold mt-px" style={{ color: t.text, fontFamily: "'JetBrains Mono',monospace" }}>{val}</div>
            </div>
          </div>
        ))}
      </div>}

      {/* Guide */}
      {showGuide && (
        <div className="adm-card mt-4 overflow-hidden" style={{ background: cardBg, border: cardBd }}>
          <div className="set-card-header" style={{ background: headerBg, borderBottom: headerBorder }}>
            <div className="set-card-title" style={{ color: t.textMuted }}>How the Menu Builder Works</div>
          </div>
          <div className="set-card-body text-sm leading-[1.75]" style={{ color: t.textMuted }}>
            <div className="mb-3.5">
              <b style={{ color: t.text }}>Structure:</b> The menu is organized as <b style={{ color: t.text }}>Groups</b> &rarr; <b style={{ color: t.text }}>Tiers</b>. A group is a service customers see (e.g. "Instagram Followers"). Each group has 1&ndash;3 tiers (Budget, Standard, Premium) &mdash; each tier is linked to a different provider backend service with different quality/speed.
            </div>
            <div className="mb-3.5">
              <b style={{ color: t.text }}>Pricing flow:</b> Providers charge in USD &rarr; we convert at the USD&rarr;NGN rate (set in Settings) &rarr; then apply markup % per tier &rarr; that's the customer sell price. Go to <b style={{ color: t.text }}>Settings &rarr; Pricing &amp; Markup</b> to set the rate and percentages.
            </div>
            <div className="mb-3.5 flex items-center gap-2 flex-wrap">
              <b style={{ color: t.text }}>Tier colors:</b>
              {[["Budget", "#f59e0b", "cheapest, basic quality"], ["Standard", "#3b82f6", "recommended, good balance"], ["Premium", "#a855f7", "best quality, highest price"]].map(([name, color, desc]) => (
                <span key={name} className="inline-flex items-center gap-1 text-[13px]">
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ background: color }} />
                  <span className="font-semibold" style={{ color }}>{name}</span>
                  <span>({desc})</span>
                </span>
              ))}
            </div>
            <div className="mb-3.5">
              <b style={{ color: t.text }}>Nigerian services:</b> Check the Nigerian flag when creating a group to mark it as Nigeria-specific. These get a green tint and flag badge on the customer page.
            </div>
            <div>
              <b style={{ color: t.text }}>Adding a tier:</b> Click "+ Tier" on any group &rarr; search for the provider service &rarr; pick a tier level &rarr; the sell price auto-fills from your markup settings. You can override it manually.
            </div>
          </div>
        </div>
      )}

      {error && <InlineAlert type="error" dark={dark} onDismiss={() => setError("")} className="mt-4">{error}</InlineAlert>}

      {/* New group form */}
      {showNew && (
        <div className="adm-card mt-4 overflow-hidden" style={{ background: cardBg, border: cardBd }}>
          <div className="set-card-header" style={{ background: headerBg, borderBottom: headerBorder }}>
            <div className="set-card-title" style={{ color: t.textMuted }}>Create Service Group</div>
          </div>
          <div className="set-card-body">
            <div className="grid grid-cols-2 max-md:grid-cols-1 gap-3 mb-3.5">
              <div><label className="text-[13px] font-semibold block mb-1" style={{ color: t.textMuted }}>Group Name</label><input placeholder="e.g. Instagram Followers" value={newName} onChange={e => setNewName(e.target.value)} className={`${inputCls} w-full`} style={inputStyle} /></div>
              <div><label className="text-[13px] font-semibold block mb-1" style={{ color: t.textMuted }}>Platform</label><input placeholder="e.g. Instagram" value={newPlatform} onChange={e => setNewPlatform(e.target.value)} className={`${inputCls} w-full`} style={inputStyle} /></div>
              <div><label className="text-[13px] font-semibold block mb-1" style={{ color: t.textMuted }}>Type</label>
                <select value={newType} onChange={e => setNewType(e.target.value)} className={`${inputCls} w-full appearance-none cursor-pointer bg-no-repeat bg-[position:right_10px_center]`} style={selectSt}>
                  <option>Standard</option><option>Premium</option><option>Budget</option>
                </select>
              </div>
              <div className="flex items-end pb-1">
                <label className="flex items-center gap-2 cursor-pointer text-sm" style={{ color: t.textSoft }}>
                  <input type="checkbox" checked={newNigerian} onChange={e => setNewNigerian(e.target.checked)} className="w-4 h-4" style={{ accentColor: "#c47d8e" }} />
                  <svg width="16" height="12" viewBox="0 0 16 12" fill="none"><rect width="5.33" height="12" fill="#008751"/><rect x="5.33" width="5.34" height="12" fill="#fff"/><rect x="10.67" width="5.33" height="12" fill="#008751"/></svg>
                  Nigerian service
                </label>
              </div>
            </div>
            <button onClick={createGroup} className="adm-btn-primary w-full" style={{ opacity: newName && newPlatform ? 1 : .4 }}>Create Group</button>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-2.5 mt-4 mb-4 flex-wrap items-center">
        <div className="relative flex-1 min-w-[160px]">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: t.textMuted }}><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        <input aria-label="Search groups" placeholder="Search groups..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} className={`${inputCls} w-full pl-9 pr-7`} style={inputStyle} />
          {search && <button aria-label="Clear search" onClick={() => { setSearch(""); setPage(1); }} className="absolute right-2.5 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center rounded-full text-xs cursor-pointer border-none" style={{ background: dark ? "rgba(255,255,255,.18)" : "rgba(0,0,0,.14)", color: t.textMuted }}><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>}
        </div>
        <FilterDropdown dark={dark} t={t} searchable value={platFilter} onChange={(v) => { setPlatFilter(v); setPage(1); }} options={[
          { value: "all", label: "All Platforms" },
          ...platforms.map(p => ({ value: p, label: p })),
        ]} />
        <button onClick={() => { setNgFilter(!ngFilter); setPage(1); }} className="adm-btn-sm flex items-center gap-1.5" style={{ borderColor: ngFilter ? (dark ? "rgba(74,222,128,.28)" : "rgba(22,163,74,.24)") : t.cardBorder, background: ngFilter ? (dark ? "rgba(74,222,128,.12)" : "rgba(22,163,74,.08)") : "transparent", color: ngFilter ? (dark ? "#4ade80" : "#16a34a") : t.textMuted }}>
          <svg width="14" height="10" viewBox="0 0 16 12" fill="none"><rect width="5.33" height="12" fill={ngFilter ? "#008751" : (dark ? "#555" : "#999")}/><rect x="5.33" width="5.34" height="12" fill={ngFilter ? "#fff" : (dark ? "#777" : "#ccc")}/><rect x="10.67" width="5.33" height="12" fill={ngFilter ? "#008751" : (dark ? "#555" : "#999")}/></svg>
          Nigerian
        </button>
      </div>

      {/* Loading */}
      {loading && <div className="adm-card p-5" style={{ background: cardBg, border: cardBd }}>{[1,2,3,4].map(i => <div key={i} className={`skel-bone ${dark ? "skel-dark" : "skel-light"} h-14 rounded-[10px] mb-2`} />)}</div>}

      {/* Empty */}
      {!loading && paged.length === 0 && (
        <div className="adm-card py-[60px] px-5 text-center" style={{ background: cardBg, border: cardBd }}>
          <svg width="48" height="48" viewBox="0 0 64 64" fill="none" style={{ display: "block", margin: "0 auto 14px", opacity: .7 }}>
            <rect x="8" y="28" width="48" height="24" rx="4" stroke={t.accent} strokeWidth="1.5" opacity=".2" />
            <rect x="8" y="12" width="48" height="24" rx="4" stroke={t.accent} strokeWidth="1.5" opacity=".3" />
          </svg>
          <div className="text-base font-semibold mb-1" style={{ color: t.textSoft }}>{search || platFilter !== "all" || ngFilter ? "No matching groups" : "No service groups yet"}</div>
          <div className="text-sm" style={{ color: t.textMuted }}>{search || platFilter !== "all" || ngFilter ? "Try a different filter" : "Create one to get started"}</div>
        </div>
      )}

      <div ref={cardsRef}>{!loading && paged.map(g => {
        const open = isOpen(g);
        const ng = g.nigerian;
        const ngCardBg = ng ? (dark ? "rgba(74,222,128,.06)" : "rgba(22,163,74,.04)") : cardBg;
        const ngCardBd = ng ? `0.5px solid ${dark ? "rgba(74,222,128,.2)" : "rgba(22,163,74,.15)"}` : cardBd;
        const ngHeaderBg = ng ? (dark ? "rgba(74,222,128,.12)" : "rgba(22,163,74,.06)") : headerBg;
        return (
        <div key={g.id} className="adm-card mb-3 overflow-hidden" style={{ background: ngCardBg, border: ngCardBd, opacity: g.enabled ? 1 : .55, borderLeft: ng ? `3px solid ${dark ? "#4ade80" : "#16a34a"}` : undefined }}>
          {/* Group header — click to expand */}
          <div role="button" tabIndex={0} aria-expanded={open} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();toggleGroup(g.id);}}} onClick={() => toggleGroup(g.id)} className="flex justify-between items-center py-3 px-4 flex-wrap gap-2 cursor-pointer select-none" style={{ background: ngHeaderBg, borderBottom: open ? headerBorder : "none" }}>
            <div className="flex items-center gap-2.5 min-w-0">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 transition-transform duration-200" style={{ color: open ? t.accent : t.textMuted, transform: open ? "rotate(90deg)" : "none" }}><polyline points="9 18 15 12 9 6"/></svg>
              <PlatformIcon platform={g.platform} dark={dark} size={34} />
              <span className="text-[15px] font-bold truncate" style={{ color: t.text }}>{g.name}</span>
              {g.nigerian && <span className="text-[10.5px] py-0.5 px-2 rounded-full font-bold shrink-0" style={{ background: dark ? "rgba(74,222,128,.12)" : "rgba(22,163,74,.08)", color: dark ? "#4ade80" : "#16a34a" }}>Nigerian</span>}
              {!g.enabled && <span className="text-[10.5px] py-0.5 px-2 rounded-full font-bold shrink-0" style={{ background: dark ? "rgba(160,160,160,.1)" : "rgba(100,100,100,.06)", color: t.textMuted }}>Disabled</span>}
            </div>
            <div className="flex gap-1.5 items-center" onClick={e => e.stopPropagation()}>
              <button onClick={() => act({ action: "update-group", groupId: g.id, enabled: !g.enabled })} title={g.enabled ? "Enabled — click to disable" : "Disabled — click to enable"} aria-label="Toggle group enabled" className="relative w-[34px] h-[19px] rounded-full border border-solid cursor-pointer transition-colors duration-200 shrink-0" style={{ background: g.enabled ? (dark ? "rgba(110,231,183,.15)" : "rgba(5,150,105,.1)") : (dark ? "rgba(255,255,255,.08)" : "rgba(0,0,0,.06)"), borderColor: g.enabled ? (dark ? "rgba(110,231,183,.4)" : "rgba(5,150,105,.35)") : t.cardBorder }}>
                <span className="absolute top-[2px] w-[13px] h-[13px] rounded-full transition-all duration-200" style={{ left: g.enabled ? 17 : 2, background: g.enabled ? (dark ? "#6ee7b7" : "#059669") : t.textMuted }} />
              </button>
              <button onClick={() => { const opening = addTierGroup !== g.id; setAddTierGroup(opening ? g.id : null); if (opening) openGroup(g.id); }} title={addTierGroup === g.id ? "Cancel" : "Add tier"} className="adm-btn-sm text-[12px]" style={{ borderColor: t.cardBorder, color: t.accent }}>{addTierGroup === g.id ? "Cancel" : "+ Tier"}</button>
              <button onClick={async () => { if (await confirm({ title: "Delete Group", message: `Delete "${g.name}" and all its tiers?`, confirmLabel: "Delete", danger: true })) act({ action: "delete-group", groupId: g.id }); }} title="Delete group" className="adm-btn-sm text-[12px]" style={{ borderColor: dark ? "rgba(252,165,165,.28)" : "rgba(220,38,38,.24)", color: dark ? "#fca5a5" : "#dc2626" }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
              </button>
            </div>
          </div>

          {open && <>
          {/* Add tier form */}
          {addTierGroup === g.id && (
            <div className="py-4 px-5" style={{ background: dark ? "rgba(196,125,142,.06)" : "rgba(196,125,142,.03)", borderBottom: headerBorder }}>
              <div className="text-sm font-semibold mb-0.5" style={{ color: t.text }}>Add Tier to {g.name}</div>
              <div className="text-[11px] mb-3" style={{ color: t.textMuted, fontFamily: "'JetBrains Mono',monospace" }}>Markup: {Object.keys(markupSettings).length > 0 ? `DB (${markupSettings.markup_standard || "?"}% std)` : "defaults (no DB settings)"}</div>
              <div className="mb-2.5">
                <div className="relative mb-1.5">
                  <input aria-label="Search services" placeholder="Search services..." value={tierSvcSearch} onChange={e => { setTierSvcSearch(e.target.value); setTierSvcId(""); }} className={`${inputCls} w-full pr-7`} style={inputStyle} />
                  {tierSvcSearch && <button aria-label="Clear search" onClick={() => setTierSvcSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 flex items-center justify-center rounded-full text-[10px] cursor-pointer border-none" style={{ background: dark ? "rgba(255,255,255,.18)" : "rgba(0,0,0,.14)", color: t.textMuted }}><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>}
                </div>
                {!tierSvcId && (
                  <div className="max-h-[220px] overflow-y-auto overscroll-contain rounded-lg" style={{ border: `1px solid ${dark ? "rgba(255,255,255,.16)" : "rgba(0,0,0,.12)"}`, background: dark ? "#131728" : "#fff" }}>
                    {filteredSvcs.map(s => (
                      <div key={s.id} role="button" tabIndex={0} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();e.currentTarget.click()}}} onClick={() => { setTierSvcId(s.id); setTierSvcSearch(s.name); const suggested = calculateTierPrice(s.costPer1k, tierLevel, markupSettings); setTierPrice((suggested / 100).toFixed(2)); }} className="py-1.5 px-3 text-[13px] cursor-pointer transition-[background-color] duration-100" style={{ color: tierSvcId === s.id ? "#c47d8e" : t.text, background: tierSvcId === s.id ? (dark ? "rgba(196,125,142,.08)" : "rgba(196,125,142,.04)") : "transparent", borderBottom: `1px solid ${dark ? "rgba(255,255,255,.09)" : "rgba(0,0,0,.06)"}` }}>
                        <ProvTag provider={s.provider} />
                        <span className="text-[11px] mr-1.5" style={{ fontFamily: "'JetBrains Mono',monospace", color: t.textMuted }}>#{s.apiId}</span>
                        {s.name} <span className="text-[10px]" style={{ color: t.textMuted }}>— {formatNaira(Math.round(s.costPer1k * usdRate))}/1k</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex gap-2.5 flex-wrap mb-2.5">
                <select value={tierLevel} onChange={e => { setTierLevel(e.target.value); if (tierSvcId) { const svc = services.find(s => s.id === tierSvcId); if (svc) { const suggested = calculateTierPrice(svc.costPer1k, e.target.value, markupSettings); setTierPrice((suggested / 100).toFixed(2)); } } }} className={`${inputCls} w-[110px] appearance-none cursor-pointer bg-no-repeat bg-[position:right_8px_center]`} style={selectSt}>
                  <option>Budget</option><option>Standard</option><option>Premium</option>
                </select>
                <input placeholder="Sell price ₦/1k" value={tierPrice} onChange={e => setTierPrice(e.target.value.replace(/[^0-9.]/g, ""))} className={`${inputCls} w-[130px]`} style={inputStyle} />
                <input placeholder="Speed" value={tierSpeed} onChange={e => setTierSpeed(e.target.value)} className={`${inputCls} w-[110px]`} style={inputStyle} />
                <label className="flex items-center gap-1.5 text-[13px] cursor-pointer" style={{ color: t.textSoft }}>
                  <input type="checkbox" checked={tierRefill} onChange={e => setTierRefill(e.target.checked)} className="w-4 h-4" style={{ accentColor: "#c47d8e" }} /> Refill
                </label>
              </div>
              {tierSvcId && (() => {
                const svc = services.find(s => s.id === tierSvcId);
                if (!svc) return null;
                const costUsd = svc.costPer1k;
                const costKobo = Math.round(costUsd * usdRate);
                const sell = Math.round(Number(tierPrice) * 100);
                const suggested = calculateTierPrice(costUsd, tierLevel, markupSettings);
                const margin = sell > 0 ? Math.round(((sell - costKobo) / sell) * 100) : 0;
                const isLow = sell > 0 && sell < Math.ceil(costKobo * 1.5);
                const markupPct = markupSettings[`markup_${tierLevel.toLowerCase()}`] || "?";
                return (
                  <div className="flex gap-3 flex-wrap items-center mb-3 py-2.5 px-3 rounded-lg text-xs" style={{ background: dark ? "rgba(255,255,255,.07)" : "rgba(0,0,0,.03)", color: t.textMuted }}>
                    <span>Cost: <b className="m" style={{ color: t.text }}>{formatNaira(costKobo)}</b>/1k</span>
                    <span>Suggested: <b className="m" style={{ color: "#c47d8e" }}>{formatNaira(suggested)}</b> ({markupPct}%)</span>
                    {sell > 0 && <span>Margin: <b className="m" style={{ color: isLow ? (dark ? "#fca5a5" : "#dc2626") : (dark ? "#6ee7b7" : "#059669") }}>{margin}%</b>{isLow && " (low)"}</span>}
                    {sell > 0 && sell !== suggested && <button onClick={() => setTierPrice((suggested / 100).toFixed(2))} className="bg-transparent text-xs font-semibold cursor-pointer border-none p-0 font-[inherit] transition-transform duration-150 hover:-translate-y-px" style={{ color: "#c47d8e" }}>Use suggested</button>}
                  </div>
                );
              })()}
              <button onClick={addTier} className="adm-btn-primary" style={{ opacity: tierSvcId && tierPrice ? 1 : .4 }}>Add Tier</button>
            </div>
          )}

          {/* Tiers */}
          {g.tiers.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-[13px]">
                <thead>
                  <tr style={{ borderBottom: `1px solid ${dark ? "rgba(255,255,255,.14)" : "rgba(0,0,0,.1)"}` }}>
                    {["", "Tier", "Service", "Sell ₦/1k", "Cost ₦/1k", "Margin", "Speed", "Refill", ""].map((h, hi) => (
                      <th key={hi} className="text-left py-2.5 px-3.5 text-[11px] font-semibold uppercase tracking-[.5px]" style={{ color: t.textMuted }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {g.tiers.map((tier, i) => {
                    const cKobo = tierCostKobo(tier);
                    const isEditing = editTier?.id === tier.id;
                    const m = cKobo != null ? marginPct(tier.sellPer1k, cKobo) : null;
                    const low = cKobo != null && lowMargin(tier.sellPer1k, cKobo);
                    return (
                    <tr key={tier.id} className="transition-[background-color] duration-100 hover:bg-[rgba(196,125,142,.04)]" style={{ borderBottom: i < g.tiers.length - 1 ? `1px solid ${dark ? "rgba(255,255,255,.09)" : "rgba(0,0,0,.06)"}` : "none", background: isEditing ? (dark ? "rgba(196,125,142,.08)" : "rgba(196,125,142,.05)") : undefined }}>
                      <td className="py-2.5 px-2 w-8">
                        {g.tiers.length > 1 && (
                          <div className="flex flex-col gap-0.5">
                            <button disabled={i === 0} onClick={() => act({ action: "swap-tier-order", tierA: tier.id, tierB: g.tiers[i - 1].id })} className="bg-transparent border-none cursor-pointer p-0 leading-none" style={{ color: i === 0 ? (dark ? "rgba(255,255,255,.15)" : "rgba(0,0,0,.15)") : t.textMuted, cursor: i === 0 ? "default" : "pointer" }} title="Move up">
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="18 15 12 9 6 15"/></svg>
                            </button>
                            <button disabled={i === g.tiers.length - 1} onClick={() => act({ action: "swap-tier-order", tierA: tier.id, tierB: g.tiers[i + 1].id })} className="bg-transparent border-none cursor-pointer p-0 leading-none" style={{ color: i === g.tiers.length - 1 ? (dark ? "rgba(255,255,255,.15)" : "rgba(0,0,0,.15)") : t.textMuted, cursor: i === g.tiers.length - 1 ? "default" : "pointer" }} title="Move down">
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
                            </button>
                          </div>
                        )}
                      </td>
                      <td className="py-2.5 px-3.5">
                        <span className="inline-flex items-center text-[11.5px] font-bold py-[3px] px-2.5 rounded-full" style={{ color: TIER_COLORS[tier.tier] || t.text, background: TIER_BG[tier.tier] || (dark ? "rgba(255,255,255,.08)" : "rgba(0,0,0,.05)") }}>{tier.tier}</span>
                      </td>
                      <td className="py-2.5 px-3.5" style={{ color: t.text }}>
                        {tier.serviceId ? (
                          <><ProvTag provider={tier.service?.provider} /><span className="text-[11px]" style={{ fontFamily: "'JetBrains Mono',monospace", color: t.textMuted }}>#{tier.service?.apiId} </span>{tier.service?.name?.slice(0, 40)}</>
                        ) : (
                          <LinkServiceInline tierId={tier.id} services={services} dark={dark} t={t} inputStyle={inputStyle} markupSettings={markupSettings} onLink={(svcId) => act({ action: "update-tier", tierIdToUpdate: tier.id, serviceId: svcId })} />
                        )}
                      </td>
                      {isEditing ? (
                        <td className="py-2.5 px-3.5"><input aria-label="Sell price" value={editTier.price} onChange={e => setEditTier({ ...editTier, price: e.target.value.replace(/[^0-9.]/g, "") })} className="w-[90px] py-1.5 px-2 rounded-md text-[12.5px] outline-none font-[inherit]" style={{ ...inputStyle, borderColor: dark ? "rgba(196,125,142,.4)" : "rgba(196,125,142,.35)", fontFamily: "'JetBrains Mono',monospace" }} /></td>
                      ) : (
                        <td className="py-2.5 px-3.5 font-bold" style={{ color: t.text, fontFamily: "'JetBrains Mono',monospace" }}>₦{(tier.sellPer1k / 100).toFixed(2)}</td>
                      )}
                      <td className="py-2.5 px-3.5" style={{ color: t.textMuted, fontFamily: "'JetBrains Mono',monospace" }}>{cKobo != null ? formatNaira(cKobo) : "—"}</td>
                      <td className="py-2.5 px-3.5">
                        {isEditing || m == null ? <span style={{ color: t.textMuted }}>—</span> : (
                          <span className="font-bold" style={{ color: low ? (dark ? "#fca5a5" : "#dc2626") : (dark ? "#6ee7b7" : "#059669") }}>{m}%{low && <span className="text-[9px] font-extrabold tracking-[.5px] py-0.5 px-1.5 rounded-full ml-1.5" style={{ background: dark ? "rgba(252,165,165,.14)" : "rgba(220,38,38,.1)", color: dark ? "#fca5a5" : "#dc2626" }}>LOW</span>}</span>
                        )}
                      </td>
                      {isEditing ? (
                        <td className="py-2.5 px-3.5"><input aria-label="Speed" value={editTier.speed} onChange={e => setEditTier({ ...editTier, speed: e.target.value })} className="w-[80px] py-1.5 px-2 rounded-md text-[12.5px] outline-none font-[inherit]" style={{ ...inputStyle, borderColor: dark ? "rgba(196,125,142,.4)" : "rgba(196,125,142,.35)" }} /></td>
                      ) : (
                        <td className="py-2.5 px-3.5" style={{ color: t.textSoft }}>{tier.speed}</td>
                      )}
                      <td className="py-2.5 px-3.5">
                        {isEditing ? (
                          <input type="checkbox" aria-label="Refill" checked={editTier.refill} onChange={e => setEditTier({ ...editTier, refill: e.target.checked })} className="w-4 h-4" style={{ accentColor: "#c47d8e" }} />
                        ) : (
                          tier.refill ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={dark ? "#6ee7b7" : "#059669"} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg> : <span style={{ color: t.textMuted }}>—</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3.5 whitespace-nowrap">
                        {isEditing ? (
                          <span className="flex gap-1.5">
                            <button onClick={saveTierEdit} disabled={savingTier} className="adm-btn-sm text-[12px]" style={{ background: "linear-gradient(135deg,#c47d8e,#8b5e6b)", borderColor: "transparent", color: "#fff", opacity: savingTier ? .6 : 1 }}>{savingTier ? "Saving..." : "Save"}</button>
                            <button onClick={() => setEditTier(null)} disabled={savingTier} className="adm-btn-sm text-[12px]" style={{ borderColor: t.cardBorder, color: t.textMuted }}>Cancel</button>
                          </span>
                        ) : (
                          <span className="flex gap-1.5">
                            <button onClick={() => setEditTier({ id: tier.id, price: (tier.sellPer1k / 100).toFixed(2), speed: tier.speed || "", refill: !!tier.refill })} title="Edit tier" className="adm-btn-sm text-[12px]" style={{ borderColor: t.cardBorder, color: t.textMuted }}>Edit</button>
                            <button onClick={async () => { if (await confirm({ title: "Delete Tier", message: "Delete this tier?", confirmLabel: "Delete", danger: true })) act({ action: "delete-tier", tierIdToDelete: tier.id }); }} title="Delete tier" className="adm-btn-sm text-[12px]" style={{ borderColor: dark ? "rgba(252,165,165,.28)" : "rgba(220,38,38,.24)", color: dark ? "#fca5a5" : "#dc2626" }}>
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
                            </button>
                          </span>
                        )}
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="py-5 text-sm text-center" style={{ color: t.textMuted }}>No tiers added yet — click "+ Tier" to start</div>
          )}
          </>}
        </div>
        );
      })}</div>

      {/* Pagination */}
      {!loading && totalPages > 1 && (
        <div className="adm-card mt-3 flex items-center justify-between py-3 px-5" style={{ background: cardBg, border: cardBd }}>
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="adm-btn-sm flex items-center gap-1" style={{ borderColor: t.cardBorder, color: t.textMuted, opacity: page === 1 ? .35 : 1 }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
            Prev
          </button>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 text-[12px]" style={{ color: t.textMuted }}>
              <span>Show</span>
              <select value={perPage} onChange={e => { setPerPage(Number(e.target.value)); setPage(1); }} className="py-1 px-1.5 rounded-md text-[12px] font-medium cursor-pointer font-[inherit]" style={{ background: dark ? "rgba(255,255,255,.09)" : "rgba(0,0,0,.04)", border: `1px solid ${t.cardBorder}`, color: t.textMuted }}>
                {[10, 25, 50].map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
            <span className="text-[12px] font-medium" style={{ color: t.textMuted }}>Page {page} of {totalPages}</span>
          </div>
          <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages} className="adm-btn-sm flex items-center gap-1" style={{ borderColor: t.cardBorder, color: t.textMuted, opacity: page >= totalPages ? .35 : 1 }}>
            Next
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
          </button>
        </div>
      )}
    </>
  );
}
