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
        <span className="text-xs py-px px-2 rounded font-semibold" style={{ background: dark ? "rgba(224,164,88,.1)" : "rgba(217,119,6,.06)", color: dark ? "#e0a458" : "#d97706" }}>⚠️ Unlinked</span>
        <button onClick={() => setOpen(true)} className="bg-transparent text-xs font-semibold cursor-pointer border-none p-0" style={{ color: "#c47d8e" }}>Link service</button>
      </span>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <input placeholder="Search MTP services..." value={search} onChange={e => setSearch(e.target.value)} autoFocus className="w-full py-[5px] px-2 rounded-lg text-[13px] outline-none" style={{ ...inputStyle }} />
      <div className="max-h-[120px] overflow-y-auto rounded-md" style={{ border: `1px solid ${dark ? "rgba(255,255,255,.06)" : "rgba(0,0,0,.06)"}`, background: dark ? "#0d1020" : "#fff" }}>
        {filtered.map(s => (
          <div key={s.id} role="button" tabIndex={0} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();e.currentTarget.click()}}} onClick={async () => { setLinking(true); await onLink(s.id); setLinking(false); setOpen(false); }} className="py-[5px] px-2 text-xs cursor-pointer" style={{ color: t.text, borderBottom: `1px solid ${dark ? "rgba(255,255,255,.03)" : "rgba(0,0,0,.03)"}` }}>
            <span className="text-[10px] mr-1" style={{ fontFamily: "'JetBrains Mono',monospace", color: t.textMuted }}>#{s.apiId}</span>
            {s.name?.slice(0, 50)}
            <span className="text-[10px] ml-1" style={{ color: t.textMuted }}>— {formatNaira(Math.round(s.costPer1k * Number(markupSettings.markup_usd_rate || 1600)))}/1k</span>
          </div>
        ))}
        {filtered.length === 0 && <div className="p-2 text-xs text-center" style={{ color: t.textMuted }}>No matches</div>}
      </div>
      <button onClick={() => setOpen(false)} className="bg-transparent text-[11px] cursor-pointer border-none p-0 self-start" style={{ color: t.textMuted }}>Cancel</button>
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

  // New group form
  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPlatform, setNewPlatform] = useState("");
  const [newType, setNewType] = useState("Standard");
  const [newNigerian, setNewNigerian] = useState(false);

  // Add tier form
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

  const cardCls = "rounded-xl p-4 border";
  const cardStyle = { background: dark ? "rgba(255,255,255,.04)" : "rgba(255,255,255,.8)", borderColor: dark ? "rgba(255,255,255,.08)" : "rgba(0,0,0,.1)" };
  const inputCls = "py-2 px-3 rounded-lg text-sm outline-none";
  const inputStyle = { background: dark ? "#0d1020" : "#fff", border: `1px solid ${dark ? "rgba(255,255,255,.08)" : "rgba(0,0,0,.1)"}`, color: dark ? "#f5f3f0" : "#1a1917" };
  const btnCls = "py-2 px-4 rounded-lg text-sm font-semibold border-none cursor-pointer";
  const accentBtn = { background: "linear-gradient(135deg,#c47d8e,#a3586b)", color: "#fff" };
  const ghostBtn = { background: dark ? "rgba(255,255,255,.06)" : "rgba(0,0,0,.04)", color: dark ? "#a09b95" : "#555250" };

  if (loading) return <div className="p-6">{[1,2,3,4].map(i => <div key={i} className={`skel-bone ${dark ? "skel-dark" : "skel-light"} h-14 rounded-[10px] mb-2`} />)}</div>;

  return (
    <div className="pb-10">
      <div className="flex justify-between items-center mb-5 flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-semibold m-0" style={{ color: t.text }}>Menu Builder</h2>
          <p className="text-sm mt-1" style={{ color: t.textMuted }}>{groups.length} groups · {groups.reduce((a, g) => a + g.tiers.length, 0)} tiers · {services.length} MTP services available</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowGuide(!showGuide)} className={btnCls} style={ghostBtn}>{showGuide ? "Hide Guide" : "📖 Guide"}</button>
          <button onClick={() => setShowNew(!showNew)} className={btnCls} style={accentBtn}>{showNew ? "Cancel" : "+ New Group"}</button>
        </div>
      </div>

      {/* Guide */}
      {showGuide && (
        <div className={`${cardCls} mb-5 text-sm leading-[1.7]`} style={{ ...cardStyle, color: t.textMuted }}>
          <div className="text-base font-semibold mb-3" style={{ color: t.text }}>How the Menu Builder Works</div>
          <div className="mb-3">
            <b style={{ color: t.text }}>Structure:</b> The menu is organized as <b style={{ color: t.text }}>Groups</b> → <b style={{ color: t.text }}>Tiers</b>. A group is a service customers see (e.g. "Instagram Followers"). Each group has 1–3 tiers (Budget, Standard, Premium) — each tier is linked to a different MTP backend service with different quality/speed.
          </div>
          <div className="mb-3">
            <b style={{ color: t.text }}>Pricing flow:</b> MTP charges in USD → we convert at the USD→NGN rate (set in Settings) → then apply markup % per tier → that's the customer sell price. Go to <b style={{ color: t.text }}>Settings → Pricing & Markup</b> to set the rate and percentages, then hit <b style={{ color: t.text }}>Recalculate All Prices</b> to bulk-update.
          </div>
          <div className="mb-3">
            <b style={{ color: t.text }}>Tier colors:</b>{" "}
            <span className="font-semibold" style={{ color: "#e0a458" }}>Budget</span> (cheapest, basic quality) ·{" "}
            <span className="font-semibold" style={{ color: "#60a5fa" }}>Standard</span> (recommended, good balance) ·{" "}
            <span className="font-semibold" style={{ color: "#a78bfa" }}>Premium</span> (best quality, highest price)
          </div>
          <div className="mb-3">
            <b style={{ color: t.text }}>🇳🇬 Nigerian services:</b> Check the Nigerian flag when creating a group to mark it as Nigeria-specific. These get a green tint and flag badge on the customer-facing page. Use for services targeting Nigerian audiences (e.g. Naija Twitter followers, Boomplay streams).
          </div>
          <div>
            <b style={{ color: t.text }}>Adding a tier:</b> Click "Add Tier" on any group → search for the MTP service → pick a tier level → the sell price auto-fills from your markup settings. You can override the price manually. The info row shows cost, suggested price, and margin %.
          </div>
        </div>
      )}

      {error && <div className="py-2.5 px-3.5 rounded-lg text-sm mb-4 flex justify-between items-center" style={{ background: dark ? "rgba(220,38,38,.1)" : "#fef2f2", border: `1px solid ${dark ? "rgba(220,38,38,.2)" : "#fecaca"}`, color: dark ? "#fca5a5" : "#dc2626" }}><span>{error}</span><button onClick={() => setError("")} className="bg-transparent border-none text-base" style={{ color: "inherit" }}>✕</button></div>}

      {/* New group form */}
      {showNew && (
        <div className={`${cardCls} mb-5`} style={cardStyle}>
          <div className="text-[15px] font-semibold mb-3" style={{ color: t.text }}>Create Service Group</div>
          <div className="flex gap-2.5 flex-wrap mb-3">
            <input placeholder="Group name (e.g. Instagram Followers)" value={newName} onChange={e => setNewName(e.target.value)} className={`${inputCls} flex-1 min-w-[180px]`} style={inputStyle} />
            <input placeholder="Platform (e.g. Instagram)" value={newPlatform} onChange={e => setNewPlatform(e.target.value)} className={`${inputCls} w-[140px]`} style={inputStyle} />
            <select value={newType} onChange={e => setNewType(e.target.value)} className={`${inputCls} w-[110px]`} style={inputStyle}>
              <option>Standard</option><option>Premium</option><option>Budget</option>
            </select>
            <label className="flex items-center gap-1.5 text-sm" style={{ color: t.textSoft }}>
              <input type="checkbox" checked={newNigerian} onChange={e => setNewNigerian(e.target.checked)} style={{ accentColor: "#c47d8e" }} /> 🇳🇬 Nigerian
            </label>
          </div>
          <button onClick={createGroup} className={btnCls} style={accentBtn}>Create Group</button>
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-2.5 mb-4 flex-wrap items-center">
        <input placeholder="Search groups..." value={search} onChange={e => setSearch(e.target.value)} className={`${inputCls} flex-1 min-w-[160px]`} style={inputStyle} />
        <select value={platFilter} onChange={e => setPlatFilter(e.target.value)} className={`${inputCls} w-[140px]`} style={inputStyle}>
          <option value="all">All Platforms</option>
          {platforms.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
        <button onClick={() => setNgFilter(!ngFilter)} className={`${btnCls} border`} style={{ background: ngFilter ? (dark ? "rgba(74,222,128,.12)" : "rgba(22,163,74,.08)") : (dark ? "rgba(255,255,255,.06)" : "rgba(0,0,0,.04)"), color: ngFilter ? (dark ? "#4ade80" : "#16a34a") : (dark ? "#a09b95" : "#555250"), borderColor: ngFilter ? (dark ? "rgba(74,222,128,.2)" : "rgba(22,163,74,.15)") : "transparent" }}>🇳🇬 Nigerian</button>
      </div>

      {/* Groups list */}
      {filtered.length === 0 && <div className="py-[60px] px-5 text-center">
        <svg width="48" height="48" viewBox="0 0 64 64" fill="none" style={{ display: "block", margin: "0 auto 14px", opacity: .7 }}>
          <rect x="8" y="28" width="48" height="24" rx="4" stroke={t.accent} strokeWidth="1.5" opacity=".2" />
          <rect x="8" y="12" width="48" height="24" rx="4" stroke={t.accent} strokeWidth="1.5" opacity=".3" />
        </svg>
        <div className="text-base font-semibold mb-1" style={{ color: t.textSoft }}>No service groups yet</div>
        <div className="text-sm" style={{ color: t.textMuted }}>Create one to get started</div>
      </div>}

      {filtered.map(g => (
        <div key={g.id} className={`sg-card ${cardCls} mb-3`} style={{ ...cardStyle, opacity: g.enabled ? 1 : .5, borderLeft: g.nigerian ? `3px solid ${dark ? "#4ade80" : "#16a34a"}` : undefined }}>
          <div className="sg-header-row flex justify-between items-center mb-2 flex-wrap gap-2">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="text-base font-semibold" style={{ color: t.text }}>{g.name}</span>
              <span className="text-xs py-px px-2 rounded font-medium" style={{ background: dark ? "rgba(196,125,142,.1)" : "rgba(196,125,142,.06)", color: "#c47d8e" }}>{g.platform}</span>
              {g.nigerian && <span className="text-xs py-px px-2 rounded font-medium" style={{ background: dark ? "rgba(74,222,128,.1)" : "rgba(22,163,74,.06)", color: dark ? "#4ade80" : "#16a34a" }}>🇳🇬 Nigerian</span>}
              {!g.enabled && <span className="text-xs" style={{ color: t.textMuted }}>(disabled)</span>}
            </div>
            <div className="sg-actions flex gap-1.5">
              <button onClick={() => act({ action: "update-group", groupId: g.id, enabled: !g.enabled })} className={btnCls} style={ghostBtn}>{g.enabled ? "Disable" : "Enable"}</button>
              <button onClick={() => setAddTierGroup(addTierGroup === g.id ? null : g.id)} className={btnCls} style={ghostBtn}>{addTierGroup === g.id ? "Cancel" : "+ Tier"}</button>
              <button onClick={async () => { if (await confirm({ title: "Delete Group", message: `Delete "${g.name}" and all its tiers?`, confirmLabel: "Delete", danger: true })) act({ action: "delete-group", groupId: g.id }); }} className={btnCls} style={{ ...ghostBtn, color: dark ? "#fca5a5" : "#dc2626" }}>Delete</button>
            </div>
          </div>

          {/* Add tier form */}
          {addTierGroup === g.id && (
            <div className="p-3 rounded-lg mb-3" style={{ background: dark ? "rgba(255,255,255,.03)" : "rgba(0,0,0,.02)", border: `1px solid ${dark ? "rgba(255,255,255,.06)" : "rgba(0,0,0,.06)"}` }}>
              <div className="text-sm font-semibold mb-1" style={{ color: t.text }}>Add Tier to {g.name}</div>
              <div className="text-[11px] mb-2" style={{ color: t.textMuted, fontFamily: "'JetBrains Mono',monospace" }}>Markup: {Object.keys(markupSettings).length > 0 ? `DB (${markupSettings.markup_standard || "?"}% std)` : "⚠️ defaults (no DB settings)"}</div>
              <div className="mb-2">
                <input placeholder="Search MTP services..." value={tierSvcSearch} onChange={e => setTierSvcSearch(e.target.value)} className={`${inputCls} w-full mb-1.5`} style={inputStyle} />
                {tierSvcSearch && (
                  <div className="max-h-[150px] overflow-y-auto rounded-lg" style={{ border: `1px solid ${dark ? "rgba(255,255,255,.06)" : "rgba(0,0,0,.06)"}` }}>
                    {filteredSvcs.map(s => (
                      <div key={s.id} role="button" tabIndex={0} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();e.currentTarget.click()}}} onClick={() => { setTierSvcId(s.id); setTierSvcSearch(s.name); const suggested = calculateTierPrice(s.costPer1k, tierLevel, markupSettings); setTierPrice((suggested / 100).toFixed(2)); }} className="py-1.5 px-2.5 text-[13px] cursor-pointer" style={{ color: tierSvcId === s.id ? "#c47d8e" : t.text, background: tierSvcId === s.id ? (dark ? "rgba(196,125,142,.08)" : "rgba(196,125,142,.04)") : "transparent" }}>
                        <span className="text-[11px] mr-1.5" style={{ fontFamily: "'JetBrains Mono',monospace", color: t.textMuted }}>#{s.apiId}</span>
                        {s.name} <span className="text-[10px]" style={{ color: t.textMuted }}>— {formatNaira(Math.round(s.costPer1k * Number(markupSettings.markup_usd_rate || 1600)))}/1k</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex gap-2 flex-wrap mb-2">
                <select value={tierLevel} onChange={e => { setTierLevel(e.target.value); if (tierSvcId) { const svc = services.find(s => s.id === tierSvcId); if (svc) { const suggested = calculateTierPrice(svc.costPer1k, e.target.value, markupSettings); setTierPrice((suggested / 100).toFixed(2)); } } }} className={`${inputCls} w-[110px]`} style={inputStyle}>
                  <option>Budget</option><option>Standard</option><option>Premium</option>
                </select>
                <input placeholder="Sell price ₦/1k" value={tierPrice} onChange={e => setTierPrice(e.target.value.replace(/[^0-9.]/g, ""))} className={`${inputCls} w-[120px]`} style={inputStyle} />
                <input placeholder="Speed" value={tierSpeed} onChange={e => setTierSpeed(e.target.value)} className={`${inputCls} w-[100px]`} style={inputStyle} />
                <label className="flex items-center gap-1 text-[13px]" style={{ color: t.textSoft }}>
                  <input type="checkbox" checked={tierRefill} onChange={e => setTierRefill(e.target.checked)} style={{ accentColor: "#c47d8e" }} /> Refill
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
                const margin = sell > 0 ? (sell > 0 ? Math.round(((sell - Math.round(costUsd * usdRate)) / sell) * 100) : 0) : 0;
                const isLow = sell > 0 && sell < Math.ceil(costKobo * 1.5);
                return (
                  <div className="flex gap-3 flex-wrap items-center mb-2.5 py-2 px-2.5 rounded-lg text-xs" style={{ background: dark ? "rgba(255,255,255,.02)" : "rgba(0,0,0,.02)", color: t.textMuted }}>
                    <span>Cost: <b style={{ color: t.text, fontFamily: "'JetBrains Mono',monospace" }}>{formatNaira(costKobo)}</b>/1k</span>
                    <span>Suggested: <b style={{ color: "#c47d8e", fontFamily: "'JetBrains Mono',monospace" }}>{formatNaira(suggested)}</b> ({markupPercent}%)</span>
                    {sell > 0 && <span>Margin: <b style={{ color: isLow ? (dark ? "#fca5a5" : "#dc2626") : (dark ? "#6ee7b7" : "#059669"), fontFamily: "'JetBrains Mono',monospace" }}>{margin}%</b>{isLow && " ⚠️ below 50%"}</span>}
                    {sell > 0 && sell !== suggested && <button onClick={() => setTierPrice((suggested / 100).toFixed(2))} className="bg-transparent text-xs font-semibold cursor-pointer border-none p-0" style={{ color: "#c47d8e" }}>Use suggested</button>}
                  </div>
                );
              })()}
              <button onClick={addTier} className={btnCls} style={accentBtn}>Add Tier</button>
            </div>
          )}

          {/* Tiers table */}
          {g.tiers.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-[13px]">
                <thead>
                  <tr style={{ borderBottom: `1px solid ${dark ? "rgba(255,255,255,.06)" : "rgba(0,0,0,.06)"}` }}>
                    {["Tier", "MTP Service", "Sell ₦/1k", "Min–Max", "Speed", "Refill", ""].map(h => (
                      <th key={h} className="text-left p-2 text-xs font-semibold uppercase tracking-[.5px]" style={{ color: t.textMuted }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {g.tiers.map(tier => (
                    <tr key={tier.id} style={{ borderBottom: `1px solid ${dark ? "rgba(255,255,255,.04)" : "rgba(0,0,0,.04)"}` }}>
                      <td className="p-2 font-semibold" style={{ color: tier.tier === "Premium" ? "#a855f7" : tier.tier === "Budget" ? "#f59e0b" : "#3b82f6" }}>{tier.tier}</td>
                      <td className="p-2" style={{ color: t.text }}>
                        {tier.serviceId ? (
                          <><span className="text-[11px]" style={{ fontFamily: "'JetBrains Mono',monospace", color: t.textMuted }}>#{tier.service?.apiId} </span>{tier.service?.name?.slice(0, 40)}</>
                        ) : (
                          <LinkServiceInline tierId={tier.id} services={services} dark={dark} t={t} inputStyle={inputStyle} markupSettings={markupSettings} onLink={(svcId) => act({ action: "update-tier", tierIdToUpdate: tier.id, serviceId: svcId })} />
                        )}
                      </td>
                      <td className="p-2" style={{ color: t.text, fontFamily: "'JetBrains Mono',monospace" }}>₦{(tier.sellPer1k / 100).toFixed(2)}</td>
                      <td className="p-2 text-xs" style={{ color: t.textSoft }}>{tier.service?.min?.toLocaleString() || "—"}–{tier.service?.max?.toLocaleString() || "—"}</td>
                      <td className="p-2" style={{ color: t.textSoft }}>{tier.speed}</td>
                      <td className="p-2">{tier.refill ? <span style={{ color: dark ? "#6ee7b7" : "#059669" }}>✓</span> : <span style={{ color: t.textMuted }}>—</span>}</td>
                      <td className="p-2">
                        <button onClick={async () => { if (await confirm({ title: "Delete Tier", message: "Delete this tier?", confirmLabel: "Delete", danger: true })) act({ action: "delete-tier", tierIdToDelete: tier.id }); }} className="bg-transparent text-[13px] font-medium cursor-pointer border-none" style={{ color: dark ? "#fca5a5" : "#dc2626" }}>Delete</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="py-3 text-sm text-center" style={{ color: t.textMuted }}>No tiers added yet</div>
          )}
        </div>
      ))}
    </div>
  );
}
