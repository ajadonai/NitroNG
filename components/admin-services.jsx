'use client';
import { useState, useEffect } from "react";
import { useConfirm } from "./confirm-dialog";

const fN = (a) => `₦${Math.abs(a).toLocaleString("en-NG")}`;

const TIER_COLORS = {
  Budget: { color: "#d97706", bg: "rgba(217,119,6,.08)" },
  Standard: { color: "#2563eb", bg: "rgba(37,99,235,.08)" },
  Premium: { color: "#7c3aed", bg: "rgba(124,58,237,.08)" },
};

export default function AdminServicesPage({ dark, t }) {
  const confirm = useConfirm();
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [expanded, setExpanded] = useState(null);
  const [editMode, setEditMode] = useState(null);

  useEffect(() => {
    fetch("/api/admin/services").then(r => r.json()).then(d => { setServices(d.services || []); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  const categories = [...new Set(services.map(s => s.category))].filter(Boolean);
  const activeCount = services.filter(s => s.enabled).length;
  const inactiveCount = services.filter(s => !s.enabled).length;
  const filtered = services.filter(s => {
    if (statusFilter === "active" && !s.enabled) return false;
    if (statusFilter === "inactive" && s.enabled) return false;
    if (catFilter !== "all" && s.category !== catFilter) return false;
    if (search) { const q = search.toLowerCase(); return s.name?.toLowerCase().includes(q) || s.category?.toLowerCase().includes(q); }
    return true;
  });

  const [editData, setEditData] = useState({});
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);

  const toggleEnabled = async (id, enabled) => {
    try {
      await fetch("/api/admin/services", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "toggle", serviceId: id, enabled: !enabled }) });
      setServices(prev => prev.map(s => s.id === id ? { ...s, enabled: !enabled } : s));
    } catch {}
  };

  const startEdit = (s) => {
    setEditMode(s.id);
    setEditData({ name: s.name, category: s.category, min: s.min, max: s.max, refill: s.refill, avgTime: s.avgTime || "" });
  };

  const saveEdit = async (id) => {
    setSaving(true); setMsg(null);
    try {
      const res = await fetch("/api/admin/services", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "edit", serviceId: id, ...editData }) });
      const data = await res.json();
      if (res.ok) {
        setServices(prev => prev.map(s => s.id === id ? { ...s, ...data.service } : s));
        setEditMode(null);
        setMsg({ type: "success", text: "Service updated" });
      } else {
        setMsg({ type: "error", text: data.error || "Failed to save" });
      }
    } catch { setMsg({ type: "error", text: "Request failed" }); }
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
          setMsg({ type: "success", text: "Service deleted" });
        } else if (data.disabled) {
          setServices(prev => prev.map(x => x.id === s.id ? { ...x, enabled: false } : x));
          setMsg({ type: "success", text: data.message });
        }
      } else {
        setMsg({ type: "error", text: data.error || "Failed to delete" });
      }
    } catch { setMsg({ type: "error", text: "Request failed" }); }
  };

  return (
    <>
      <div className="adm-header">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <div className="adm-title" style={{ color: t.text }}>Raw Services</div>
            <div className="adm-subtitle" style={{ color: t.textMuted }}>{services.length} services across {categories.length} platforms</div>
          </div>
          <button className="adm-btn-primary">+ Add Service</button>
        </div>
        <div className="page-divider" style={{ background: t.cardBorder }} />
      </div>

      <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
        {[["all", `All (${services.length})`], ["active", `Active (${activeCount})`], ["inactive", `Inactive (${inactiveCount})`]].map(([val, label]) => (
          <button key={val} onClick={() => setStatusFilter(val)} style={{ padding: "5px 14px", borderRadius: 8, fontSize: 12, fontWeight: 600, border: `1px solid ${statusFilter === val ? (val === "inactive" ? (dark ? "rgba(252,165,165,.3)" : "rgba(220,38,38,.2)") : val === "active" ? (dark ? "rgba(110,231,183,.3)" : "rgba(5,150,105,.2)") : t.accent) : t.cardBorder}`, background: statusFilter === val ? (val === "inactive" ? (dark ? "rgba(252,165,165,.06)" : "rgba(220,38,38,.04)") : val === "active" ? (dark ? "rgba(110,231,183,.06)" : "rgba(5,150,105,.04)") : (dark ? "#2a1a22" : "#fdf2f4")) : "transparent", color: statusFilter === val ? (val === "inactive" ? (dark ? "#fca5a5" : "#dc2626") : val === "active" ? (dark ? "#6ee7b7" : "#059669") : t.accent) : t.textMuted, cursor: "pointer" }}>{label}</button>
        ))}
      </div>

      <div className="adm-filters" style={{ marginBottom: 0 }}>
        <button onClick={() => setCatFilter("all")} className="adm-filter-pill" style={{ borderWidth: 1, borderStyle: "solid", borderColor: catFilter === "all" ? t.accent : t.cardBorder, background: catFilter === "all" ? (dark ? "#2a1a22" : "#fdf2f4") : "transparent", color: catFilter === "all" ? t.accent : t.textMuted }}>
          All <span className="m">({services.length})</span>
        </button>
        {categories.map(cat => (
          <button key={cat} onClick={() => setCatFilter(cat)} className="adm-filter-pill" style={{ borderWidth: 1, borderStyle: "solid", borderColor: catFilter === cat ? t.accent : t.cardBorder, background: catFilter === cat ? (dark ? "#2a1a22" : "#fdf2f4") : "transparent", color: catFilter === cat ? t.accent : t.textMuted }}>
            {cat} <span className="m">({services.filter(s => s.category === cat).length})</span>
          </button>
        ))}
      </div>

      <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search services..." className="m adm-search" style={{ borderColor: t.cardBorder, background: dark ? "#0d1020" : "#fff", color: t.text }} />

      {msg && <div style={{ padding: "10px 14px", borderRadius: 8, marginBottom: 12, background: msg.type === "success" ? (dark ? "rgba(110,231,183,.08)" : "#f0fdf4") : (dark ? "rgba(220,38,38,.08)" : "#fef2f2"), color: msg.type === "success" ? (dark ? "#6ee7b7" : "#059669") : (dark ? "#fca5a5" : "#dc2626"), fontSize: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}><span>{msg.text}</span><button onClick={() => setMsg(null)} style={{ background: "none", color: "inherit", fontSize: 14, border: "none", cursor: "pointer" }}>✕</button></div>}

      <div className="adm-card" style={{ background: dark ? "rgba(255,255,255,.06)" : "rgba(255,255,255,.95)", borderWidth: 1, borderStyle: "solid", borderColor: dark ? "rgba(255,255,255,.06)" : "rgba(0,0,0,.06)", boxShadow: dark ? "0 4px 20px rgba(0,0,0,.25)" : "0 4px 20px rgba(0,0,0,.04)" }}>
        {loading ? (
          <div className="adm-empty" style={{ color: t.textMuted }}>Loading services...</div>
        ) : filtered.length > 0 ? filtered.map((s, i) => (
          <div key={s.id}>
            <div className="adm-list-row" onClick={() => { setExpanded(expanded === s.id ? null : s.id); if (editMode === s.id) setEditMode(null); }} style={{ borderBottom: i < filtered.length - 1 ? `1px solid ${t.cardBorder}` : "none", cursor: "pointer" }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 14, fontWeight: 500, color: t.text }}>{s.name}</span>
                  {!s.enabled && <span style={{ fontSize: 11, padding: "1px 6px", borderRadius: 4, background: dark ? "rgba(252,165,165,.1)" : "rgba(220,38,38,.06)", color: t.red, fontWeight: 600 }}>Disabled</span>}
                </div>
                <div style={{ fontSize: 13, color: t.textMuted, marginTop: 2 }}>{s.category} · API #{s.apiId} · {s.orders || 0} orders</div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span className="m" style={{ fontSize: 12, color: t.textMuted }}>₦{s.costPer1k?.toLocaleString()}</span>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={t.textMuted} strokeWidth="2" strokeLinecap="round" style={{ transform: expanded === s.id ? "rotate(180deg)" : "rotate(0)", transition: "transform .2s" }}><polyline points="6 9 12 15 18 9"/></svg>
              </div>
            </div>
            {expanded === s.id && (
              <div style={{ padding: "12px 16px 16px", borderBottom: i < filtered.length - 1 ? `1px solid ${t.cardBorder}` : "none", background: dark ? "rgba(255,255,255,.02)" : "rgba(0,0,0,.01)" }}>
                {editMode === s.id ? (
                  <>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 }}>
                      <div><label style={{ fontSize: 11, color: t.textMuted, display: "block", marginBottom: 3 }}>Name</label><input value={editData.name || ""} onChange={e => setEditData(p => ({ ...p, name: e.target.value }))} style={{ width: "100%", boxSizing: "border-box", padding: "7px 10px", borderRadius: 8, border: `1px solid ${t.cardBorder}`, background: dark ? "#0d1020" : "#fff", color: t.text, fontSize: 13 }} /></div>
                      <div><label style={{ fontSize: 11, color: t.textMuted, display: "block", marginBottom: 3 }}>Category</label><input value={editData.category || ""} onChange={e => setEditData(p => ({ ...p, category: e.target.value }))} style={{ width: "100%", boxSizing: "border-box", padding: "7px 10px", borderRadius: 8, border: `1px solid ${t.cardBorder}`, background: dark ? "#0d1020" : "#fff", color: t.text, fontSize: 13 }} /></div>
                      <div><label style={{ fontSize: 11, color: t.textMuted, display: "block", marginBottom: 3 }}>Min order</label><input type="number" value={editData.min || ""} onChange={e => setEditData(p => ({ ...p, min: e.target.value }))} style={{ width: "100%", boxSizing: "border-box", padding: "7px 10px", borderRadius: 8, border: `1px solid ${t.cardBorder}`, background: dark ? "#0d1020" : "#fff", color: t.text, fontSize: 13, fontFamily: "'JetBrains Mono',monospace" }} /></div>
                      <div><label style={{ fontSize: 11, color: t.textMuted, display: "block", marginBottom: 3 }}>Max order</label><input type="number" value={editData.max || ""} onChange={e => setEditData(p => ({ ...p, max: e.target.value }))} style={{ width: "100%", boxSizing: "border-box", padding: "7px 10px", borderRadius: 8, border: `1px solid ${t.cardBorder}`, background: dark ? "#0d1020" : "#fff", color: t.text, fontSize: 13, fontFamily: "'JetBrains Mono',monospace" }} /></div>
                      <div><label style={{ fontSize: 11, color: t.textMuted, display: "block", marginBottom: 3 }}>Avg time</label><input value={editData.avgTime || ""} onChange={e => setEditData(p => ({ ...p, avgTime: e.target.value }))} style={{ width: "100%", boxSizing: "border-box", padding: "7px 10px", borderRadius: 8, border: `1px solid ${t.cardBorder}`, background: dark ? "#0d1020" : "#fff", color: t.text, fontSize: 13 }} /></div>
                      <div style={{ display: "flex", alignItems: "flex-end", paddingBottom: 4 }}><label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: t.textSoft }}><input type="checkbox" checked={editData.refill || false} onChange={e => setEditData(p => ({ ...p, refill: e.target.checked }))} style={{ accentColor: "#c47d8e" }} /> Refill</label></div>
                    </div>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button onClick={() => saveEdit(s.id)} disabled={saving} className="adm-btn-sm" style={{ borderColor: t.accent, color: t.accent, opacity: saving ? .5 : 1 }}>{saving ? "Saving..." : "Save"}</button>
                      <button onClick={() => setEditMode(null)} className="adm-btn-sm" style={{ borderColor: t.cardBorder, color: t.textMuted }}>Cancel</button>
                    </div>
                  </>
                ) : (
                  <>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 12, fontSize: 13 }}>
                      <div><span style={{ color: t.textMuted }}>Category:</span> <span style={{ color: t.text }}>{s.category}</span></div>
                      <div><span style={{ color: t.textMuted }}>Provider:</span> <span style={{ color: t.text }}>MTP #{s.apiId}</span></div>
                      <div><span style={{ color: t.textMuted }}>Status:</span> <span style={{ color: s.enabled ? t.green : t.red }}>{s.enabled ? "Active" : "Disabled"}</span></div>
                      <div><span style={{ color: t.textMuted }}>Min:</span> <span className="m" style={{ color: t.text }}>{s.min?.toLocaleString() || 0}</span></div>
                      <div><span style={{ color: t.textMuted }}>Max:</span> <span className="m" style={{ color: t.text }}>{s.max?.toLocaleString() || 0}</span></div>
                      <div><span style={{ color: t.textMuted }}>Refill:</span> <span style={{ color: s.refill ? t.green : t.textMuted }}>{s.refill ? "Yes" : "No"}</span></div>
                      <div><span style={{ color: t.textMuted }}>Cost/1K:</span> <span className="m" style={{ color: t.text }}>₦{s.costPer1k?.toLocaleString()}</span></div>
                      <div><span style={{ color: t.textMuted }}>Sell/1K:</span> <span className="m" style={{ color: t.text }}>₦{s.sellPer1k?.toLocaleString()}</span></div>
                      <div><span style={{ color: t.textMuted }}>Avg time:</span> <span style={{ color: t.text }}>{s.avgTime || "—"}</span></div>
                    </div>
                    <div style={{ display: "flex", gap: 6 }}>
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
    </>
  );
}
