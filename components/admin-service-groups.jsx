'use client';
import { useState, useEffect, useMemo } from "react";
import { calculateTierPrice, formatNaira, DEFAULT_USD_RATE } from "../lib/markup";
import { useConfirm } from "./confirm-dialog";

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
        <input aria-label="Search MTP services" placeholder="Search MTP services..." value={search} onChange={e => setSearch(e.target.value)} autoFocus className="w-full py-[5px] px-2 pr-7 rounded-lg text-[13px] outline-none font-[inherit]" style={{ ...inputStyle }} />
        {search && <button aria-label="Clear search" onClick={() => setSearch("")} className="absolute right-1.5 top-1/2 -translate-y-1/2 w-4 h-4 flex items-center justify-center rounded-full text-[10px] cursor-pointer border-none" style={{ background: dark ? "rgba(255,255,255,.18)" : "rgba(0,0,0,.14)", color: t.textMuted }}><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>}
      </div>
      <div className="max-h-[120px] overflow-y-auto rounded-md" style={{ border: `1px solid ${dark ? "rgba(255,255,255,.12)" : "rgba(0,0,0,.12)"}`, background: dark ? "#0d1020" : "#fff" }}>
        {filtered.map(s => (
          <div key={s.id} role="button" tabIndex={0} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();e.currentTarget.click()}}} onClick={async () => { setLinking(true); await onLink(s.id); setLinking(false); setOpen(false); }} className="py-[5px] px-2 text-xs cursor-pointer" style={{ color: t.text, borderBottom: `1px solid ${dark ? "rgba(255,255,255,.06)" : "rgba(0,0,0,.06)"}` }}>
            <span className="text-[10px] mr-1" style={{ fontFamily: "'JetBrains Mono',monospace", color: t.textMuted }}>#{s.apiId}</span>
            {s.name?.slice(0, 50)}
            <span className="text-[10px] ml-1" style={{ color: t.textMuted }}>— {formatNaira(Math.round(s.costPer1k * Number(markupSettings.markup_usd_rate || 1600)))}/1k</span>
          </div>
        ))}
        {filtered.length === 0 && <div className="p-2 text-xs text-center" style={{ color: t.textMuted }}>No matches</div>}
      </div>
      <button onClick={() => setOpen(false)} className="bg-transparent text-[11px] cursor-pointer border-none p-0 self-start font-[inherit] transition-transform duration-150 hover:-translate-y-px" style={{ color: t.textMuted }}>Cancel</button>
    </div>
  );
}

const TIER_COLORS = { Budget: "#f59e0b", Standard: "#3b82f6", Premium: "#a855f7" };

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

  const cardBg = dark ? "rgba(255,255,255,.06)" : "rgba(255,255,255,.85)";
  const cardBd = `0.5px solid ${dark ? "rgba(255,255,255,.12)" : "rgba(0,0,0,.12)"}`;
  const headerBg = dark ? "rgba(196,125,142,.18)" : "rgba(196,125,142,.12)";
  const headerBorder = `1px solid ${dark ? "rgba(255,255,255,.08)" : "rgba(0,0,0,.08)"}`;
  const inputCls = "py-2.5 px-3.5 rounded-lg text-sm outline-none font-[inherit]";
  const inputStyle = { background: dark ? "#0d1020" : "#fff", border: `1px solid ${dark ? "rgba(255,255,255,.14)" : "rgba(0,0,0,.14)"}`, color: t.text };
  const selectSt = {
    backgroundColor: dark ? "rgba(255,255,255,.04)" : "rgba(0,0,0,.03)",
    border: `1px solid ${dark ? "rgba(255,255,255,.14)" : "rgba(0,0,0,.14)"}`,
    color: dark ? "rgba(255,255,255,.7)" : "rgba(0,0,0,.7)",
    backgroundImage: `url("data:image/svg+xml,%3Csvg width='10' height='6' viewBox='0 0 10 6' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1L5 5L9 1' stroke='${dark ? "%23666" : "%23999"}' stroke-width='1.5' stroke-linecap='round'/%3E%3C/svg%3E")`,
  };

  const totalTiers = groups.reduce((a, g) => a + g.tiers.length, 0);
  const enabledGroups = groups.filter(g => g.enabled).length;
  const ngCount = groups.filter(g => g.nigerian).length;

  return (
    <>
      <div className="adm-header">
        <div className="flex justify-between items-start">
          <div>
            <div className="adm-title" style={{ color: t.text }}>Menu Builder</div>
            <div className="adm-subtitle" style={{ color: t.textMuted }}>{groups.length} groups · {totalTiers} tiers · {services.length} MTP services available</div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => { setShowGuide(!showGuide); if (!showGuide) setShowNew(false); }} className="adm-btn-sm flex items-center gap-1.5" style={{ borderColor: t.cardBorder, color: t.accent }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 3h6a4 4 0 014 4v14a3 3 0 00-3-3H2z"/><path d="M22 3h-6a4 4 0 00-4 4v14a3 3 0 013-3h7z"/></svg>
              {showGuide ? "Hide Guide" : "Guide"}
            </button>
            <button onClick={() => { setShowNew(!showNew); if (!showNew) setShowGuide(false); }} className="adm-btn-primary flex items-center gap-1.5">
              {showNew ? "Cancel" : <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> New Group</>}
            </button>
          </div>
        </div>
        <div className="page-divider" style={{ background: t.cardBorder }} />
      </div>

      {/* Stats */}
      {!loading && <div className="adm-stats mt-4">
        {[
          ["Groups", String(groups.length), t.accent],
          ["Enabled", String(enabledGroups), dark ? "#6ee7b7" : "#059669"],
          ["Tiers", String(totalTiers), dark ? "#60a5fa" : "#2563eb"],
          ["Platforms", String(platforms.length), dark ? "#a5b4fc" : "#4f46e5"],
          ...(ngCount > 0 ? [["Nigerian", String(ngCount), dark ? "#4ade80" : "#16a34a"]] : []),
        ].map(([label, val, color]) => (
          <div key={label} className="dash-stat-card" style={{ background: cardBg, border: cardBd }}>
            <div className="dash-stat-dot" style={{ background: color }} />
            <div className="dash-stat-label" style={{ color: t.textMuted }}>{label}</div>
            <div className="m dash-stat-value" style={{ color }}>{val}</div>
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
              <b style={{ color: t.text }}>Structure:</b> The menu is organized as <b style={{ color: t.text }}>Groups</b> &rarr; <b style={{ color: t.text }}>Tiers</b>. A group is a service customers see (e.g. "Instagram Followers"). Each group has 1&ndash;3 tiers (Budget, Standard, Premium) &mdash; each tier is linked to a different MTP backend service with different quality/speed.
            </div>
            <div className="mb-3.5">
              <b style={{ color: t.text }}>Pricing flow:</b> MTP charges in USD &rarr; we convert at the USD&rarr;NGN rate (set in Settings) &rarr; then apply markup % per tier &rarr; that's the customer sell price. Go to <b style={{ color: t.text }}>Settings &rarr; Pricing &amp; Markup</b> to set the rate and percentages.
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
              <b style={{ color: t.text }}>Adding a tier:</b> Click "+ Tier" on any group &rarr; search for the MTP service &rarr; pick a tier level &rarr; the sell price auto-fills from your markup settings. You can override it manually.
            </div>
          </div>
        </div>
      )}

      {error && <div className="py-2.5 px-4 rounded-lg text-sm mt-4 flex justify-between items-center" style={{ background: dark ? "rgba(220,38,38,.18)" : "#fef2f2", border: `1px solid ${dark ? "rgba(220,38,38,.28)" : "#fecaca"}`, color: dark ? "#fca5a5" : "#dc2626" }}><span>{error}</span><button onClick={() => setError("")} className="bg-transparent border-none cursor-pointer" style={{ color: "inherit" }}><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button></div>}

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
          <input aria-label="Search groups" placeholder="Search groups..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} className={`${inputCls} w-full pr-7`} style={inputStyle} />
          {search && <button aria-label="Clear search" onClick={() => { setSearch(""); setPage(1); }} className="absolute right-2.5 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center rounded-full text-xs cursor-pointer border-none" style={{ background: dark ? "rgba(255,255,255,.18)" : "rgba(0,0,0,.14)", color: t.textMuted }}><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>}
        </div>
        <select value={platFilter} onChange={e => { setPlatFilter(e.target.value); setPage(1); }} className={`${inputCls} w-[140px] appearance-none cursor-pointer bg-no-repeat bg-[position:right_10px_center]`} style={selectSt}>
          <option value="all">All Platforms</option>
          {platforms.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
        <button onClick={() => { setNgFilter(!ngFilter); setPage(1); }} className="adm-btn-sm flex items-center gap-1.5" style={{ borderColor: ngFilter ? (dark ? "rgba(74,222,128,.28)" : "rgba(22,163,74,.24)") : t.cardBorder, background: ngFilter ? (dark ? "rgba(74,222,128,.12)" : "rgba(22,163,74,.08)") : "transparent", color: ngFilter ? (dark ? "#4ade80" : "#16a34a") : t.textMuted }}>
          <svg width="14" height="10" viewBox="0 0 16 12" fill="none"><rect width="5.33" height="12" fill={ngFilter ? "#008751" : (dark ? "#555" : "#999")}/><rect x="5.33" width="5.34" height="12" fill={ngFilter ? "#fff" : (dark ? "#777" : "#ccc")}/><rect x="10.67" width="5.33" height="12" fill={ngFilter ? "#008751" : (dark ? "#555" : "#999")}/></svg>
          Nigerian
        </button>
      </div>

      {/* Loading */}
      {loading && <div className="adm-card p-5" style={{ background: cardBg, border: cardBd }}>{[1,2,3,4].map(i => <div key={i} className={`skel-bone ${dark ? "skel-dark" : "skel-light"} h-14 rounded-[10px] mb-2`} />)}</div>}

      {/* Groups */}
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

      {!loading && paged.map(g => (
        <div key={g.id} className="adm-card mb-3 overflow-hidden" style={{ background: cardBg, border: cardBd, opacity: g.enabled ? 1 : .55, borderLeft: g.nigerian ? `3px solid ${dark ? "#4ade80" : "#16a34a"}` : undefined }}>
          {/* Group header */}
          <div className="flex justify-between items-center py-3.5 px-5 flex-wrap gap-2" style={{ background: headerBg, borderBottom: headerBorder }}>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[15px] font-semibold" style={{ color: t.text }}>{g.name}</span>
              <span className="text-[11px] py-0.5 px-2 rounded-full font-semibold" style={{ background: dark ? "rgba(196,125,142,.12)" : "rgba(196,125,142,.08)", color: "#c47d8e" }}>{g.platform}</span>
              {g.nigerian && <span className="text-[11px] py-0.5 px-2 rounded-full font-semibold flex items-center gap-1" style={{ background: dark ? "rgba(74,222,128,.1)" : "rgba(22,163,74,.06)", color: dark ? "#4ade80" : "#16a34a" }}>
                <svg width="12" height="9" viewBox="0 0 16 12" fill="none"><rect width="5.33" height="12" fill="#008751"/><rect x="5.33" width="5.34" height="12" fill="#fff"/><rect x="10.67" width="5.33" height="12" fill="#008751"/></svg>
                Nigerian
              </span>}
              {!g.enabled && <span className="text-[11px] py-0.5 px-2 rounded-full font-semibold" style={{ background: dark ? "rgba(160,160,160,.1)" : "rgba(100,100,100,.06)", color: t.textMuted }}>Disabled</span>}
              <span className="text-[12px]" style={{ color: t.textMuted }}>{g.tiers.length} {g.tiers.length === 1 ? "tier" : "tiers"}</span>
            </div>
            <div className="flex gap-1.5">
              <button onClick={() => act({ action: "update-group", groupId: g.id, enabled: !g.enabled })} className="adm-btn-sm text-[12px]" style={{ borderColor: t.cardBorder, color: g.enabled ? t.textMuted : (dark ? "#6ee7b7" : "#059669") }}>{g.enabled ? "Disable" : "Enable"}</button>
              <button onClick={() => setAddTierGroup(addTierGroup === g.id ? null : g.id)} className="adm-btn-sm text-[12px]" style={{ borderColor: t.cardBorder, color: t.accent }}>{addTierGroup === g.id ? "Cancel" : "+ Tier"}</button>
              <button onClick={async () => { if (await confirm({ title: "Delete Group", message: `Delete "${g.name}" and all its tiers?`, confirmLabel: "Delete", danger: true })) act({ action: "delete-group", groupId: g.id }); }} className="adm-btn-sm text-[12px]" style={{ borderColor: dark ? "rgba(252,165,165,.28)" : "rgba(220,38,38,.24)", color: dark ? "#fca5a5" : "#dc2626" }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
              </button>
            </div>
          </div>

          {/* Add tier form */}
          {addTierGroup === g.id && (
            <div className="py-4 px-5" style={{ background: dark ? "rgba(196,125,142,.06)" : "rgba(196,125,142,.03)", borderBottom: headerBorder }}>
              <div className="text-sm font-semibold mb-0.5" style={{ color: t.text }}>Add Tier to {g.name}</div>
              <div className="text-[11px] mb-3" style={{ color: t.textMuted, fontFamily: "'JetBrains Mono',monospace" }}>Markup: {Object.keys(markupSettings).length > 0 ? `DB (${markupSettings.markup_standard || "?"}% std)` : "defaults (no DB settings)"}</div>
              <div className="mb-2.5">
                <div className="relative mb-1.5">
                  <input aria-label="Search MTP services" placeholder="Search MTP services..." value={tierSvcSearch} onChange={e => setTierSvcSearch(e.target.value)} className={`${inputCls} w-full pr-7`} style={inputStyle} />
                  {tierSvcSearch && <button aria-label="Clear search" onClick={() => setTierSvcSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 flex items-center justify-center rounded-full text-[10px] cursor-pointer border-none" style={{ background: dark ? "rgba(255,255,255,.18)" : "rgba(0,0,0,.14)", color: t.textMuted }}><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>}
                </div>
                {tierSvcSearch && (
                  <div className="max-h-[150px] overflow-y-auto rounded-lg" style={{ border: `1px solid ${dark ? "rgba(255,255,255,.12)" : "rgba(0,0,0,.12)"}`, background: dark ? "#0d1020" : "#fff" }}>
                    {filteredSvcs.map(s => (
                      <div key={s.id} role="button" tabIndex={0} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();e.currentTarget.click()}}} onClick={() => { setTierSvcId(s.id); setTierSvcSearch(s.name); const suggested = calculateTierPrice(s.costPer1k, tierLevel, markupSettings); setTierPrice((suggested / 100).toFixed(2)); }} className="py-1.5 px-3 text-[13px] cursor-pointer transition-[background-color] duration-100" style={{ color: tierSvcId === s.id ? "#c47d8e" : t.text, background: tierSvcId === s.id ? (dark ? "rgba(196,125,142,.08)" : "rgba(196,125,142,.04)") : "transparent", borderBottom: `1px solid ${dark ? "rgba(255,255,255,.06)" : "rgba(0,0,0,.06)"}` }}>
                        <span className="text-[11px] mr-1.5" style={{ fontFamily: "'JetBrains Mono',monospace", color: t.textMuted }}>#{s.apiId}</span>
                        {s.name} <span className="text-[10px]" style={{ color: t.textMuted }}>— {formatNaira(Math.round(s.costPer1k * Number(markupSettings.markup_usd_rate || 1600)))}/1k</span>
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
                const usdRate = Number(markupSettings.markup_usd_rate || 1600);
                const costKobo = Math.round(costUsd * usdRate);
                const sell = Math.round(Number(tierPrice) * 100);
                const suggested = calculateTierPrice(costUsd, tierLevel, markupSettings);
                const margin = sell > 0 ? Math.round(((sell - costKobo) / sell) * 100) : 0;
                const isLow = sell > 0 && sell < Math.ceil(costKobo * 1.5);
                const markupPct = markupSettings[`markup_${tierLevel.toLowerCase()}`] || "?";
                return (
                  <div className="flex gap-3 flex-wrap items-center mb-3 py-2.5 px-3 rounded-lg text-xs" style={{ background: dark ? "rgba(255,255,255,.04)" : "rgba(0,0,0,.03)", color: t.textMuted }}>
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
                  <tr style={{ borderBottom: `1px solid ${dark ? "rgba(255,255,255,.1)" : "rgba(0,0,0,.1)"}` }}>
                    {["Tier", "MTP Service", "Sell ₦/1k", "Min–Max", "Speed", "Refill", ""].map(h => (
                      <th key={h} className="text-left py-2.5 px-4 text-[11px] font-semibold uppercase tracking-[.5px]" style={{ color: t.textMuted }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {g.tiers.map((tier, i) => (
                    <tr key={tier.id} className="transition-[background-color] duration-100 hover:bg-[rgba(196,125,142,.04)]" style={{ borderBottom: i < g.tiers.length - 1 ? `1px solid ${dark ? "rgba(255,255,255,.06)" : "rgba(0,0,0,.06)"}` : "none" }}>
                      <td className="py-2.5 px-4">
                        <span className="inline-flex items-center gap-1.5 text-[13px] font-semibold" style={{ color: TIER_COLORS[tier.tier] || t.text }}>
                          <span className="w-2 h-2 rounded-full shrink-0" style={{ background: TIER_COLORS[tier.tier] || t.textMuted }} />
                          {tier.tier}
                        </span>
                      </td>
                      <td className="py-2.5 px-4" style={{ color: t.text }}>
                        {tier.serviceId ? (
                          <><span className="text-[11px]" style={{ fontFamily: "'JetBrains Mono',monospace", color: t.textMuted }}>#{tier.service?.apiId} </span>{tier.service?.name?.slice(0, 40)}</>
                        ) : (
                          <LinkServiceInline tierId={tier.id} services={services} dark={dark} t={t} inputStyle={inputStyle} markupSettings={markupSettings} onLink={(svcId) => act({ action: "update-tier", tierIdToUpdate: tier.id, serviceId: svcId })} />
                        )}
                      </td>
                      <td className="py-2.5 px-4 m" style={{ color: t.text, fontFamily: "'JetBrains Mono',monospace" }}>₦{(tier.sellPer1k / 100).toFixed(2)}</td>
                      <td className="py-2.5 px-4 text-xs" style={{ color: t.textSoft }}>{tier.service?.min?.toLocaleString() || "—"}–{tier.service?.max?.toLocaleString() || "—"}</td>
                      <td className="py-2.5 px-4" style={{ color: t.textSoft }}>{tier.speed}</td>
                      <td className="py-2.5 px-4">{tier.refill ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={dark ? "#6ee7b7" : "#059669"} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg> : <span style={{ color: t.textMuted }}>—</span>}</td>
                      <td className="py-2.5 px-4">
                        <button onClick={async () => { if (await confirm({ title: "Delete Tier", message: "Delete this tier?", confirmLabel: "Delete", danger: true })) act({ action: "delete-tier", tierIdToDelete: tier.id }); }} className="adm-btn-sm text-[12px]" style={{ borderColor: dark ? "rgba(252,165,165,.28)" : "rgba(220,38,38,.24)", color: dark ? "#fca5a5" : "#dc2626" }}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="py-5 text-sm text-center" style={{ color: t.textMuted }}>No tiers added yet — click "+ Tier" to start</div>
          )}
        </div>
      ))}

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
              <select value={perPage} onChange={e => { setPerPage(Number(e.target.value)); setPage(1); }} className="py-1 px-1.5 rounded-md text-[12px] font-medium cursor-pointer font-[inherit]" style={{ background: dark ? "rgba(255,255,255,.06)" : "rgba(0,0,0,.04)", border: `1px solid ${t.cardBorder}`, color: t.textMuted }}>
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
