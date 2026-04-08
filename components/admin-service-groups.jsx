'use client';
import { useState, useEffect, useMemo } from "react";
import { calculateTierPrice, koboToNaira, marginPercent, getMarkupForTier, usdCentsToKobo, MARKUP_DEFAULTS } from "../lib/markup";
import { useConfirm } from "./confirm-dialog";

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

  const cardStyle = { background: dark ? "rgba(255,255,255,.04)" : "rgba(255,255,255,.8)", borderWidth: 1, borderStyle: "solid", borderColor: dark ? "rgba(255,255,255,.08)" : "rgba(0,0,0,.1)", borderRadius: 12, padding: 16, marginBottom: 12 };
  const inputStyle = { padding: "8px 12px", borderRadius: 8, background: dark ? "#0d1020" : "#fff", border: `1px solid ${dark ? "rgba(255,255,255,.08)" : "rgba(0,0,0,.1)"}`, color: dark ? "#f5f3f0" : "#1a1917", fontSize: 13, outline: "none" };
  const btnStyle = { padding: "8px 16px", borderRadius: 8, fontSize: 13, fontWeight: 600, border: "none", cursor: "pointer" };
  const accentBtn = { ...btnStyle, background: "linear-gradient(135deg,#c47d8e,#a3586b)", color: "#fff" };
  const ghostBtn = { ...btnStyle, background: dark ? "rgba(255,255,255,.06)" : "rgba(0,0,0,.04)", color: dark ? "#a09b95" : "#555250" };

  if (loading) return <div style={{ padding: 24, color: t.textMuted }}>Loading menu builder...</div>;

  return (
    <div style={{ padding: "0 0 40px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: t.text, margin: 0 }}>Menu Builder</h2>
          <p style={{ fontSize: 13, color: t.textMuted, marginTop: 4 }}>{groups.length} groups · {groups.reduce((a, g) => a + g.tiers.length, 0)} tiers · {services.length} MTP services available</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => setShowGuide(!showGuide)} style={ghostBtn}>{showGuide ? "Hide Guide" : "📖 Guide"}</button>
          <button onClick={() => setShowNew(!showNew)} style={accentBtn}>{showNew ? "Cancel" : "+ New Group"}</button>
        </div>
      </div>

      {/* Guide */}
      {showGuide && (
        <div style={{ ...cardStyle, marginBottom: 20, fontSize: 13, lineHeight: 1.7, color: t.textMuted }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: t.text, marginBottom: 12 }}>How the Menu Builder Works</div>
          <div style={{ marginBottom: 12 }}>
            <b style={{ color: t.text }}>Structure:</b> The menu is organized as <b style={{ color: t.text }}>Groups</b> → <b style={{ color: t.text }}>Tiers</b>. A group is a service customers see (e.g. "Instagram Followers"). Each group has 1–3 tiers (Budget, Standard, Premium) — each tier is linked to a different MTP backend service with different quality/speed.
          </div>
          <div style={{ marginBottom: 12 }}>
            <b style={{ color: t.text }}>Pricing flow:</b> MTP charges in USD → we convert at the USD→NGN rate (set in Settings) → then apply markup % per tier → that's the customer sell price. Go to <b style={{ color: t.text }}>Settings → Pricing & Markup</b> to set the rate and percentages, then hit <b style={{ color: t.text }}>Recalculate All Prices</b> to bulk-update.
          </div>
          <div style={{ marginBottom: 12 }}>
            <b style={{ color: t.text }}>Tier colors:</b>{" "}
            <span style={{ color: "#e0a458", fontWeight: 600 }}>Budget</span> (cheapest, basic quality) ·{" "}
            <span style={{ color: "#60a5fa", fontWeight: 600 }}>Standard</span> (recommended, good balance) ·{" "}
            <span style={{ color: "#a78bfa", fontWeight: 600 }}>Premium</span> (best quality, highest price)
          </div>
          <div style={{ marginBottom: 12 }}>
            <b style={{ color: t.text }}>🇳🇬 Nigerian services:</b> Check the Nigerian flag when creating a group to mark it as Nigeria-specific. These get a green tint and flag badge on the customer-facing page. Use for services targeting Nigerian audiences (e.g. Naija Twitter followers, Boomplay streams).
          </div>
          <div>
            <b style={{ color: t.text }}>Adding a tier:</b> Click "Add Tier" on any group → search for the MTP service → pick a tier level → the sell price auto-fills from your markup settings. You can override the price manually. The info row shows cost, suggested price, and margin %.
          </div>
        </div>
      )}

      {error && <div style={{ padding: "10px 14px", borderRadius: 8, background: dark ? "rgba(220,38,38,.1)" : "#fef2f2", border: `1px solid ${dark ? "rgba(220,38,38,.2)" : "#fecaca"}`, color: dark ? "#fca5a5" : "#dc2626", fontSize: 13, marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}><span>{error}</span><button onClick={() => setError("")} style={{ background: "none", color: "inherit", fontSize: 16 }}>✕</button></div>}

      {/* New group form */}
      {showNew && (
        <div style={{ ...cardStyle, marginBottom: 20 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: t.text, marginBottom: 12 }}>Create Service Group</div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
            <input placeholder="Group name (e.g. Instagram Followers)" value={newName} onChange={e => setNewName(e.target.value)} style={{ ...inputStyle, flex: 1, minWidth: 180 }} />
            <input placeholder="Platform (e.g. Instagram)" value={newPlatform} onChange={e => setNewPlatform(e.target.value)} style={{ ...inputStyle, width: 140 }} />
            <select value={newType} onChange={e => setNewType(e.target.value)} style={{ ...inputStyle, width: 110 }}>
              <option>Standard</option><option>Premium</option><option>Budget</option>
            </select>
            <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: t.textSoft }}>
              <input type="checkbox" checked={newNigerian} onChange={e => setNewNigerian(e.target.checked)} style={{ accentColor: "#c47d8e" }} /> 🇳🇬 Nigerian
            </label>
          </div>
          <button onClick={createGroup} style={accentBtn}>Create Group</button>
        </div>
      )}

      {/* Filters */}
      <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
        <input placeholder="Search groups..." value={search} onChange={e => setSearch(e.target.value)} style={{ ...inputStyle, flex: 1, minWidth: 160 }} />
        <select value={platFilter} onChange={e => setPlatFilter(e.target.value)} style={{ ...inputStyle, width: 140 }}>
          <option value="all">All Platforms</option>
          {platforms.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
        <button onClick={() => setNgFilter(!ngFilter)} style={{ ...ghostBtn, background: ngFilter ? (dark ? "rgba(74,222,128,.12)" : "rgba(22,163,74,.08)") : undefined, color: ngFilter ? (dark ? "#4ade80" : "#16a34a") : (dark ? "#a09b95" : "#555250"), borderWidth: 1, borderStyle: "solid", borderColor: ngFilter ? (dark ? "rgba(74,222,128,.2)" : "rgba(22,163,74,.15)") : "transparent" }}>🇳🇬 Nigerian</button>
      </div>

      {/* Groups list */}
      {filtered.length === 0 && <div style={{ padding: 40, textAlign: "center", color: t.textMuted, fontSize: 14 }}>No service groups yet. Create one to get started.</div>}

      {filtered.map(g => (
        <div key={g.id} style={{ ...cardStyle, opacity: g.enabled ? 1 : .5, borderLeft: g.nigerian ? `3px solid ${dark ? "#4ade80" : "#16a34a"}` : undefined }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, flexWrap: "wrap", gap: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 15, fontWeight: 600, color: t.text }}>{g.name}</span>
              <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 4, background: dark ? "rgba(196,125,142,.1)" : "rgba(196,125,142,.06)", color: "#c47d8e", fontWeight: 500 }}>{g.platform}</span>
              {g.nigerian && <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 4, background: dark ? "rgba(74,222,128,.1)" : "rgba(22,163,74,.06)", color: dark ? "#4ade80" : "#16a34a", fontWeight: 500 }}>🇳🇬 Nigerian</span>}
              {!g.enabled && <span style={{ fontSize: 11, color: t.textMuted }}>(disabled)</span>}
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              <button onClick={() => act({ action: "update-group", groupId: g.id, enabled: !g.enabled })} style={ghostBtn}>{g.enabled ? "Disable" : "Enable"}</button>
              <button onClick={() => setAddTierGroup(addTierGroup === g.id ? null : g.id)} style={ghostBtn}>{addTierGroup === g.id ? "Cancel" : "+ Tier"}</button>
              <button onClick={async () => { if (await confirm({ title: "Delete Group", message: `Delete "${g.name}" and all its tiers?`, confirmLabel: "Delete", danger: true })) act({ action: "delete-group", groupId: g.id }); }} style={{ ...ghostBtn, color: dark ? "#fca5a5" : "#dc2626" }}>Delete</button>
            </div>
          </div>

          {/* Add tier form */}
          {addTierGroup === g.id && (
            <div style={{ padding: 12, borderRadius: 8, background: dark ? "rgba(255,255,255,.03)" : "rgba(0,0,0,.02)", marginBottom: 12, border: `1px solid ${dark ? "rgba(255,255,255,.06)" : "rgba(0,0,0,.06)"}` }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: t.text, marginBottom: 4 }}>Add Tier to {g.name}</div>
              <div style={{ fontSize: 10, color: t.textMuted, marginBottom: 8, fontFamily: "'JetBrains Mono',monospace" }}>Markup: {Object.keys(markupSettings).length > 0 ? `DB (${markupSettings.markup_standard || "?"}% std)` : "⚠️ defaults (no DB settings)"}</div>
              <div style={{ marginBottom: 8 }}>
                <input placeholder="Search MTP services..." value={tierSvcSearch} onChange={e => setTierSvcSearch(e.target.value)} style={{ ...inputStyle, width: "100%", marginBottom: 6 }} />
                {tierSvcSearch && (
                  <div style={{ maxHeight: 150, overflowY: "auto", borderRadius: 8, border: `1px solid ${dark ? "rgba(255,255,255,.06)" : "rgba(0,0,0,.06)"}` }}>
                    {filteredSvcs.map(s => (
                      <div key={s.id} onClick={() => { setTierSvcId(s.id); setTierSvcSearch(s.name); const suggested = calculateTierPrice(s.costPer1k, tierLevel, markupSettings); setTierPrice((suggested / 100).toFixed(2)); }} style={{ padding: "6px 10px", fontSize: 12, color: tierSvcId === s.id ? "#c47d8e" : t.text, background: tierSvcId === s.id ? (dark ? "rgba(196,125,142,.08)" : "rgba(196,125,142,.04)") : "transparent", cursor: "pointer" }}>
                        <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 10, color: t.textMuted, marginRight: 6 }}>#{s.apiId}</span>
                        {s.name} <span style={{ color: t.textMuted, fontSize: 10 }}>— {koboToNaira(usdCentsToKobo(s.costPer1k, Number(markupSettings.markup_usd_rate || 1600)))}/1k</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
                <select value={tierLevel} onChange={e => { setTierLevel(e.target.value); if (tierSvcId) { const svc = services.find(s => s.id === tierSvcId); if (svc) { const suggested = calculateTierPrice(svc.costPer1k, e.target.value, markupSettings); setTierPrice((suggested / 100).toFixed(2)); } } }} style={{ ...inputStyle, width: 110 }}>
                  <option>Budget</option><option>Standard</option><option>Premium</option>
                </select>
                <input placeholder="Sell price ₦/1k" value={tierPrice} onChange={e => setTierPrice(e.target.value.replace(/[^0-9.]/g, ""))} style={{ ...inputStyle, width: 120 }} />
                <input placeholder="Speed" value={tierSpeed} onChange={e => setTierSpeed(e.target.value)} style={{ ...inputStyle, width: 100 }} />
                <label style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, color: t.textSoft }}>
                  <input type="checkbox" checked={tierRefill} onChange={e => setTierRefill(e.target.checked)} style={{ accentColor: "#c47d8e" }} /> Refill
                </label>
              </div>
              {tierSvcId && (() => {
                const svc = services.find(s => s.id === tierSvcId);
                if (!svc) return null;
                const costUsd = svc.costPer1k;
                const { usdRate, markupPercent } = getMarkupForTier(tierLevel, markupSettings);
                const costKobo = usdCentsToKobo(costUsd, usdRate);
                const sell = Math.round(Number(tierPrice) * 100);
                const suggested = calculateTierPrice(costUsd, tierLevel, markupSettings);
                const margin = sell > 0 ? marginPercent(costUsd, sell, usdRate) : 0;
                const isLow = sell > 0 && sell < Math.ceil(costKobo * 1.5);
                return (
                  <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center", marginBottom: 10, padding: "8px 10px", borderRadius: 8, background: dark ? "rgba(255,255,255,.02)" : "rgba(0,0,0,.02)", fontSize: 11, color: t.textMuted }}>
                    <span>Cost: <b style={{ color: t.text, fontFamily: "'JetBrains Mono',monospace" }}>{koboToNaira(costKobo)}</b>/1k</span>
                    <span>Suggested: <b style={{ color: "#c47d8e", fontFamily: "'JetBrains Mono',monospace" }}>{koboToNaira(suggested)}</b> ({markupPercent}%)</span>
                    {sell > 0 && <span>Margin: <b style={{ color: isLow ? (dark ? "#fca5a5" : "#dc2626") : (dark ? "#6ee7b7" : "#059669"), fontFamily: "'JetBrains Mono',monospace" }}>{margin}%</b>{isLow && " ⚠️ below 50%"}</span>}
                    {sell > 0 && sell !== suggested && <button onClick={() => setTierPrice((suggested / 100).toFixed(2))} style={{ background: "none", color: "#c47d8e", fontSize: 11, fontWeight: 600, cursor: "pointer", border: "none", padding: 0 }}>Use suggested</button>}
                  </div>
                );
              })()}
              <button onClick={addTier} style={accentBtn}>Add Tier</button>
            </div>
          )}

          {/* Tiers table */}
          {g.tiers.length > 0 ? (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${dark ? "rgba(255,255,255,.06)" : "rgba(0,0,0,.06)"}` }}>
                    {["Tier", "MTP Service", "Sell ₦/1k", "Min–Max", "Speed", "Refill", ""].map(h => (
                      <th key={h} style={{ textAlign: "left", padding: "6px 8px", fontSize: 11, fontWeight: 600, color: t.textMuted, textTransform: "uppercase", letterSpacing: .5 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {g.tiers.map(tier => (
                    <tr key={tier.id} style={{ borderBottom: `1px solid ${dark ? "rgba(255,255,255,.04)" : "rgba(0,0,0,.04)"}` }}>
                      <td style={{ padding: "8px", color: tier.tier === "Premium" ? "#a855f7" : tier.tier === "Budget" ? "#f59e0b" : "#3b82f6", fontWeight: 600 }}>{tier.tier}</td>
                      <td style={{ padding: "8px", color: t.text }}><span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 10, color: t.textMuted }}>#{tier.service?.apiId} </span>{tier.service?.name?.slice(0, 40)}</td>
                      <td style={{ padding: "8px", color: t.text, fontFamily: "'JetBrains Mono',monospace" }}>₦{(tier.sellPer1k / 100).toFixed(2)}</td>
                      <td style={{ padding: "8px", color: t.textSoft, fontSize: 12 }}>{tier.service?.min?.toLocaleString()}–{tier.service?.max?.toLocaleString()}</td>
                      <td style={{ padding: "8px", color: t.textSoft }}>{tier.speed}</td>
                      <td style={{ padding: "8px" }}>{tier.refill ? <span style={{ color: dark ? "#6ee7b7" : "#059669" }}>✓</span> : <span style={{ color: t.textMuted }}>—</span>}</td>
                      <td style={{ padding: "8px" }}>
                        <button onClick={async () => { if (await confirm({ title: "Delete Tier", message: "Delete this tier?", confirmLabel: "Delete", danger: true })) act({ action: "delete-tier", tierIdToDelete: tier.id }); }} style={{ background: "none", color: dark ? "#fca5a5" : "#dc2626", fontSize: 12, fontWeight: 500, cursor: "pointer", border: "none" }}>Delete</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div style={{ padding: "12px 0", fontSize: 13, color: t.textMuted, textAlign: "center" }}>No tiers added yet</div>
          )}
        </div>
      ))}
    </div>
  );
}
