'use client';
import { useState, useEffect } from "react";
import { useConfirm } from "./confirm-dialog";
import { useToast } from "./toast";
import { fN } from "../lib/format";


const TIER_COLORS = {
  Budget: { color: "#d97706", bg: "rgba(217,119,6,.08)" },
  Standard: { color: "#2563eb", bg: "rgba(37,99,235,.08)" },
  Premium: { color: "#7c3aed", bg: "rgba(124,58,237,.08)" },
};

export default function AdminServicesPage({ dark, t }) {
  const confirm = useConfirm();
  const toast = useToast();
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [providerFilter, setProviderFilter] = useState("all");
  const [expanded, setExpanded] = useState(null);
  const [editMode, setEditMode] = useState(null);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(50);

  useEffect(() => {
    fetch("/api/admin/services").then(r => r.json()).then(d => { setServices(d.services || []); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  const categories = [...new Set(services.map(s => s.category))].filter(Boolean);
  const providers = [...new Set(services.map(s => s.provider || "mtp"))];
  const activeCount = services.filter(s => s.enabled).length;
  const inactiveCount = services.filter(s => !s.enabled).length;
  const inUseCount = services.filter(s => s.tiers > 0).length;
  const inUseDisabledCount = services.filter(s => s.tiers > 0 && !s.enabled).length;
  const filtered = services.filter(s => {
    if (providerFilter !== "all" && (s.provider || "mtp") !== providerFilter) return false;
    if (statusFilter === "active" && !s.enabled) return false;
    if (statusFilter === "inactive" && s.enabled) return false;
    if (statusFilter === "in-use" && s.tiers === 0) return false;
    if (statusFilter === "in-use-disabled" && !(s.tiers > 0 && !s.enabled)) return false;
    if (catFilter !== "all" && s.category !== catFilter) return false;
    if (search) { const q = search.toLowerCase(); return s.name?.toLowerCase().includes(q) || s.category?.toLowerCase().includes(q); }
    return true;
  });
  const totalPages = Math.ceil(filtered.length / perPage);
  const paged = filtered.slice((page - 1) * perPage, page * perPage);

  const [editData, setEditData] = useState({});
  const [saving, setSaving] = useState(false);
  
  const [syncing, setSyncing] = useState(false);

  const toggleEnabled = async (id, enabled) => {
    try {
      const res = await fetch("/api/admin/services", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "toggle", serviceId: id }) });
      const data = await res.json();
      if (res.ok) {
        setServices(prev => prev.map(s => s.id === id ? { ...s, enabled: data.enabled } : s));
        if (data.cascaded) toast.success("Done", data.message);
      }
    } catch {}
  };

  const syncEnable = async () => {
    setSyncing(true); 
    try {
      const res = await fetch("/api/admin/services", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "sync-enable" }) });
      const data = await res.json();
      if (res.ok) {
        toast.success("Done", data.message);
        // Refresh list
        const r = await fetch("/api/admin/services");
        if (r.ok) { const d = await r.json(); setServices(d.services || []); }
      } else {
        toast.error("Sync failed", data.error || "Sync failed");
      }
    } catch { toast.error("Request failed", "Check your connection"); }
    setSyncing(false);
  };

  const startEdit = (s) => {
    setEditMode(s.id);
    setEditData({ name: s.name, category: s.category, min: s.min, max: s.max, refill: s.refill, avgTime: s.avgTime || "" });
  };

  const saveEdit = async (id) => {
    setSaving(true); 
    try {
      const res = await fetch("/api/admin/services", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "edit", serviceId: id, ...editData }) });
      const data = await res.json();
      if (res.ok) {
        setServices(prev => prev.map(s => s.id === id ? { ...s, ...data.service } : s));
        setEditMode(null);
        toast.success("Saved", "Service updated");
      } else {
        toast.error("Failed", data.error || "Failed to save");
      }
    } catch { toast.error("Request failed", "Check your connection"); }
    setSaving(false);
  };

  const deleteService = async (s) => {
    const ok = await confirm({ title: "Delete Service", message: `Delete "${s.name}"? If it has orders, it will be disabled instead.`, confirmLabel: "Delete", danger: true });
    if (!ok) return;
    try {
      const res = await fetch("/api/admin/services", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "delete", serviceId: s.id }) });
      const data = await res.json();
      if (res.ok) {
        if (data.deleted) {
          setServices(prev => prev.filter(x => x.id !== s.id));
          toast.success("Deleted", "Service deleted");
        } else if (data.disabled) {
          setServices(prev => prev.map(x => x.id === s.id ? { ...x, enabled: false } : x));
          toast.success("Done", data.message);
        }
      } else {
        toast.error("Failed", data.error || "Failed to delete");
      }
    } catch { toast.error("Request failed", "Check your connection"); }
  };

  return (
    <>
      <div className="adm-header">
        <div className="flex justify-between items-start">
          <div>
            <div className="adm-title" style={{ color: t.text }}>Raw Services</div>
            <div className="adm-subtitle" style={{ color: t.textMuted }}>{services.length} services · {activeCount} active · {inUseCount} in use by Menu Builder</div>
          </div>
          <div className="flex gap-2">
            {inUseDisabledCount > 0 && <button onClick={syncEnable} disabled={syncing} className="py-2 px-4 rounded-lg text-[13px] font-semibold" style={{ border: `1px solid ${dark ? "rgba(110,231,183,.2)" : "rgba(5,150,105,.15)"}`, background: dark ? "rgba(110,231,183,.06)" : "rgba(5,150,105,.04)", color: dark ? "#6ee7b7" : "#059669", cursor: syncing ? "wait" : "pointer", opacity: syncing ? .5 : 1 }}>{syncing ? "Syncing..." : `Enable ${inUseDisabledCount} In-Use`}</button>}
          </div>
        </div>
        <div className="page-divider" style={{ background: t.cardBorder }} />
      </div>

      {inUseDisabledCount > 0 && <div className="py-2.5 px-3.5 rounded-lg mb-3 text-[13px] leading-[1.5]" style={{ background: dark ? "rgba(224,164,88,.06)" : "rgba(217,119,6,.04)", border: `1px solid ${dark ? "rgba(224,164,88,.15)" : "rgba(217,119,6,.1)"}`, color: dark ? "#e0a458" : "#92400e" }}>⚠️ {inUseDisabledCount} service{inUseDisabledCount > 1 ? "s" : ""} used by Menu Builder {inUseDisabledCount > 1 ? "are" : "is"} disabled. Users can see {inUseDisabledCount > 1 ? "them" : "it"} in the menu but orders may fail.</div>}

      {/* Search */}
      <div className="mb-2.5">
        <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} placeholder="Search services..." className="w-full py-2 px-3 rounded-lg border text-sm outline-none" style={{ borderColor: t.cardBorder, background: dark ? "#0d1020" : "#fff", color: t.text }} />
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-3 flex-wrap justify-end">
        {providers.length > 1 && (
          <select value={providerFilter} onChange={e => { setProviderFilter(e.target.value); setPage(1); }} className="py-[7px] pr-7 pl-2.5 rounded-lg text-[13px] font-medium appearance-none cursor-pointer font-[inherit]" style={{
            backgroundColor: dark ? "rgba(255,255,255,.04)" : "rgba(0,0,0,.03)",
            border: `1px solid ${dark ? "rgba(255,255,255,.08)" : "rgba(0,0,0,.08)"}`,
            color: dark ? "rgba(255,255,255,.7)" : "rgba(0,0,0,.7)",
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='10' height='6' viewBox='0 0 10 6' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1L5 5L9 1' stroke='${dark ? "%23666" : "%23999"}' stroke-width='1.5' stroke-linecap='round'/%3E%3C/svg%3E")`,
            backgroundRepeat: "no-repeat", backgroundPosition: "right 8px center",
          }}>
            <option value="all">All providers ({services.length})</option>
            {providers.map(p => {
              const count = services.filter(s => (s.provider || "mtp") === p).length;
              const label = p === "mtp" ? "MTP" : p === "jap" ? "JAP" : p === "dao" ? "DaoSMM" : p.toUpperCase();
              return <option key={p} value={p}>{label} ({count})</option>;
            })}
          </select>
        )}
        <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }} className="py-[7px] pr-7 pl-2.5 rounded-lg text-[13px] font-medium appearance-none cursor-pointer font-[inherit]" style={{
          backgroundColor: dark ? "rgba(255,255,255,.04)" : "rgba(0,0,0,.03)",
          border: `1px solid ${dark ? "rgba(255,255,255,.08)" : "rgba(0,0,0,.08)"}`,
          color: dark ? "rgba(255,255,255,.7)" : "rgba(0,0,0,.7)",
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='10' height='6' viewBox='0 0 10 6' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1L5 5L9 1' stroke='${dark ? "%23666" : "%23999"}' stroke-width='1.5' stroke-linecap='round'/%3E%3C/svg%3E")`,
          backgroundRepeat: "no-repeat", backgroundPosition: "right 8px center",
        }}>
          {[["all", `All (${services.length})`], ["active", `Active (${activeCount})`], ["inactive", `Inactive (${inactiveCount})`], ["in-use", `In Use (${inUseCount})`], ...(inUseDisabledCount > 0 ? [["in-use-disabled", `⚠️ In Use + Disabled (${inUseDisabledCount})`]] : [])].map(([val, label]) => (
            <option key={val} value={val}>{label}</option>
          ))}
        </select>
        <select value={catFilter} onChange={e => { setCatFilter(e.target.value); setPage(1); }} className="py-[7px] pr-7 pl-2.5 rounded-lg text-[13px] font-medium appearance-none cursor-pointer font-[inherit]" style={{
          backgroundColor: dark ? "rgba(255,255,255,.04)" : "rgba(0,0,0,.03)",
          border: `1px solid ${dark ? "rgba(255,255,255,.08)" : "rgba(0,0,0,.08)"}`,
          color: dark ? "rgba(255,255,255,.7)" : "rgba(0,0,0,.7)",
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='10' height='6' viewBox='0 0 10 6' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1L5 5L9 1' stroke='${dark ? "%23666" : "%23999"}' stroke-width='1.5' stroke-linecap='round'/%3E%3C/svg%3E")`,
          backgroundRepeat: "no-repeat", backgroundPosition: "right 8px center",
        }}>
          <option value="all">All platforms ({services.length})</option>
          {categories.map(cat => <option key={cat} value={cat}>{cat} ({services.filter(s => s.category === cat).length})</option>)}
        </select>
      </div>


      <div className="adm-card" style={{ background: dark ? "rgba(255,255,255,.03)" : "rgba(255,255,255,.85)", border: `0.5px solid ${dark ? "rgba(255,255,255,.06)" : "rgba(0,0,0,.06)"}` }}>
        {loading ? (
          <div className="adm-empty">{[1,2,3,4,5].map(i => <div key={i} className={`skel-bone ${dark ? "skel-dark" : "skel-light"} h-11 rounded-md mb-1.5`} />)}</div>
        ) : paged.length > 0 ? paged.map((s, i) => (
          <div key={s.id}>
            <div className="adm-list-row cursor-pointer" role="button" tabIndex={0} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();e.currentTarget.click()}}} onClick={() => { setExpanded(expanded === s.id ? null : s.id); if (editMode === s.id) setEditMode(null); }} style={{ borderBottom: i < paged.length - 1 ? `1px solid ${t.cardBorder}` : "none" }}>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[15px] font-medium" style={{ color: t.text }}>{s.name}</span>
                  {s.provider && s.provider !== "mtp" && <span className="text-[10px] py-px px-[5px] rounded-[3px] font-bold uppercase" style={{ background: dark ? "rgba(165,180,252,.1)" : "rgba(79,70,229,.06)", color: dark ? "#a5b4fc" : "#4f46e5" }}>{s.provider === "jap" ? "JAP" : s.provider === "dao" ? "DAO" : s.provider}</span>}
                  {s.tiers > 0 && <span className="text-xs py-px px-1.5 rounded font-semibold" style={{ background: dark ? "rgba(96,165,250,.1)" : "rgba(37,99,235,.06)", color: dark ? "#60a5fa" : "#2563eb" }}>In Use · {s.tiers}</span>}
                  {!s.enabled && <span className="text-xs py-px px-1.5 rounded font-semibold" style={{ background: dark ? "rgba(252,165,165,.1)" : "rgba(220,38,38,.06)", color: t.red }}>Disabled</span>}
                  {s.tiers > 0 && !s.enabled && <span className="text-xs py-px px-1.5 rounded font-semibold" style={{ background: dark ? "rgba(224,164,88,.1)" : "rgba(217,119,6,.06)", color: dark ? "#e0a458" : "#d97706" }}>⚠️</span>}
                </div>
                <div className="text-sm mt-0.5" style={{ color: t.textMuted }}>{s.category} · API #{s.apiId} · {s.orders || 0} orders</div>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-[13px]" style={{ color: t.textMuted }}>₦{s.costPer1k?.toLocaleString()}</span>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={t.textMuted} strokeWidth="2" strokeLinecap="round" style={{ transform: expanded === s.id ? "rotate(180deg)" : "rotate(0)", transition: "transform .2s" }}><polyline points="6 9 12 15 18 9"/></svg>
              </div>
            </div>
            {expanded === s.id && (
              <div className="pt-3 px-4 pb-4" style={{ borderBottom: i < filtered.length - 1 ? `1px solid ${t.cardBorder}` : "none", background: dark ? "rgba(255,255,255,.02)" : "rgba(0,0,0,.01)" }}>
                {editMode === s.id ? (
                  <>
                    <div className="grid grid-cols-2 gap-2 mb-3">
                      <div><label className="text-xs block mb-[3px]" style={{ color: t.textMuted }}>Name</label><input value={editData.name || ""} onChange={e => setEditData(p => ({ ...p, name: e.target.value }))} className="w-full py-[7px] px-2.5 rounded-lg text-[13px]" style={{ border: `1px solid ${t.cardBorder}`, background: dark ? "#0d1020" : "#fff", color: t.text }} /></div>
                      <div><label className="text-xs block mb-[3px]" style={{ color: t.textMuted }}>Category</label><input value={editData.category || ""} onChange={e => setEditData(p => ({ ...p, category: e.target.value }))} className="w-full py-[7px] px-2.5 rounded-lg text-[13px]" style={{ border: `1px solid ${t.cardBorder}`, background: dark ? "#0d1020" : "#fff", color: t.text }} /></div>
                      <div><label className="text-xs block mb-[3px]" style={{ color: t.textMuted }}>Min order</label><input type="number" value={editData.min || ""} onChange={e => setEditData(p => ({ ...p, min: e.target.value }))} className="w-full py-[7px] px-2.5 rounded-lg text-sm" style={{ border: `1px solid ${t.cardBorder}`, background: dark ? "#0d1020" : "#fff", color: t.text, fontFamily: "'JetBrains Mono',monospace" }} /></div>
                      <div><label className="text-xs block mb-[3px]" style={{ color: t.textMuted }}>Max order</label><input type="number" value={editData.max || ""} onChange={e => setEditData(p => ({ ...p, max: e.target.value }))} className="w-full py-[7px] px-2.5 rounded-lg text-sm" style={{ border: `1px solid ${t.cardBorder}`, background: dark ? "#0d1020" : "#fff", color: t.text, fontFamily: "'JetBrains Mono',monospace" }} /></div>
                      <div><label className="text-xs block mb-[3px]" style={{ color: t.textMuted }}>Avg time</label><input value={editData.avgTime || ""} onChange={e => setEditData(p => ({ ...p, avgTime: e.target.value }))} className="w-full py-[7px] px-2.5 rounded-lg text-[13px]" style={{ border: `1px solid ${t.cardBorder}`, background: dark ? "#0d1020" : "#fff", color: t.text }} /></div>
                      <div className="flex items-end pb-1"><label className="flex items-center gap-1.5 text-sm" style={{ color: t.textSoft }}><input type="checkbox" checked={editData.refill || false} onChange={e => setEditData(p => ({ ...p, refill: e.target.checked }))} style={{ accentColor: "#c47d8e" }} /> Refill</label></div>
                    </div>
                    <div className="flex gap-1.5">
                      <button onClick={() => saveEdit(s.id)} disabled={saving} className="adm-btn-sm" style={{ borderColor: t.accent, color: t.accent, opacity: saving ? .5 : 1 }}>{saving ? "Saving..." : "Save"}</button>
                      <button onClick={() => setEditMode(null)} className="adm-btn-sm" style={{ borderColor: t.cardBorder, color: t.textMuted }}>Cancel</button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="grid grid-cols-3 gap-2.5 mb-3 text-[13px]">
                      <div><span style={{ color: t.textMuted }}>Category:</span> <span style={{ color: t.text }}>{s.category}</span></div>
                      <div><span style={{ color: t.textMuted }}>Provider:</span> <span style={{ color: t.text }}>MTP #{s.apiId}</span></div>
                      <div><span style={{ color: t.textMuted }}>Status:</span> <span style={{ color: s.enabled ? t.green : t.red }}>{s.enabled ? "Active" : "Disabled"}</span></div>
                      <div><span style={{ color: t.textMuted }}>Min:</span> <span style={{ color: t.text }}>{s.min?.toLocaleString() || 0}</span></div>
                      <div><span style={{ color: t.textMuted }}>Max:</span> <span style={{ color: t.text }}>{s.max?.toLocaleString() || 0}</span></div>
                      <div><span style={{ color: t.textMuted }}>Refill:</span> <span style={{ color: s.refill ? t.green : t.textMuted }}>{s.refill ? "Yes" : "No"}</span></div>
                      <div><span style={{ color: t.textMuted }}>Cost/1K:</span> <span style={{ color: t.text }}>₦{s.costPer1k?.toLocaleString()}</span></div>
                      <div><span style={{ color: t.textMuted }}>Sell/1K:</span> <span style={{ color: t.text }}>₦{s.sellPer1k?.toLocaleString()}</span></div>
                      <div><span style={{ color: t.textMuted }}>Avg time:</span> <span style={{ color: t.text }}>{s.avgTime || "—"}</span></div>
                    </div>
                    <div className="flex gap-1.5">
                      <button onClick={async () => { const ok = await confirm({ title: s.enabled ? "Disable Service" : "Enable Service", message: s.enabled ? `Disable "${s.name}"? Users won't be able to order it.` : `Re-enable "${s.name}"?`, confirmLabel: s.enabled ? "Disable" : "Enable", danger: s.enabled }); if (ok) toggleEnabled(s.id, s.enabled); }} className="adm-btn-sm" style={{ borderColor: t.cardBorder, color: s.enabled ? t.red : t.green }}>{s.enabled ? "Disable" : "Enable"}</button>
                      <button onClick={() => startEdit(s)} className="adm-btn-sm" style={{ borderColor: t.cardBorder, color: t.accent }}>Edit</button>
                      <button onClick={() => deleteService(s)} className="adm-btn-sm" style={{ borderColor: dark ? "rgba(252,165,165,.2)" : "rgba(220,38,38,.15)", color: t.red }}>Delete</button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        )) : (
          <div className="adm-empty" style={{ color: t.textMuted }}>No services found</div>
        )}
      </div>

      {/* Pagination */}
      {filtered.length > perPage && (
        <div className="flex justify-between items-center mt-3 flex-wrap gap-2">
          <div className="flex items-center gap-2 text-[13px]">
            <span style={{ color: t.textMuted }}>Show</span>
            <select value={perPage} onChange={e => { setPerPage(Number(e.target.value)); setPage(1); }} className="py-[5px] pr-6 pl-2 rounded-md text-[13px] appearance-none cursor-pointer font-[inherit]" style={{
              border: `1px solid ${t.cardBorder}`, backgroundColor: dark ? "rgba(255,255,255,.04)" : "#fff", color: t.text,
              backgroundImage: `url("data:image/svg+xml,%3Csvg width='10' height='6' viewBox='0 0 10 6' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1L5 5L9 1' stroke='${dark ? "%23666" : "%23999"}' stroke-width='1.5' stroke-linecap='round'/%3E%3C/svg%3E")`,
              backgroundRepeat: "no-repeat", backgroundPosition: "right 6px center",
            }}>
              {[25, 50, 100, 200].map(n => <option key={n} value={n}>{n}</option>)}
            </select>
            <span style={{ color: t.textMuted }}>{filtered.length} total</span>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={() => setPage(Math.max(1, page - 1))} disabled={page <= 1} className="py-[5px] px-2 rounded-md bg-transparent" style={{ border: `1px solid ${t.cardBorder}`, color: t.textSoft, cursor: page <= 1 ? "default" : "pointer", opacity: page <= 1 ? .3 : 1 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>
            </button>
            <span className="text-[13px] px-2" style={{ color: t.textMuted }}>{page} / {totalPages}</span>
            <button onClick={() => setPage(Math.min(totalPages, page + 1))} disabled={page >= totalPages} className="py-[5px] px-2 rounded-md bg-transparent" style={{ border: `1px solid ${t.cardBorder}`, color: t.textSoft, cursor: page >= totalPages ? "default" : "pointer", opacity: page >= totalPages ? .3 : 1 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>
            </button>
          </div>
        </div>
      )}
    </>
  );
}
