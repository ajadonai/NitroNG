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
  const [expanded, setExpanded] = useState(null);
  const [editMode, setEditMode] = useState(null);

  useEffect(() => {
    fetch("/api/admin/services").then(r => r.json()).then(d => { setServices(d.services || []); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  const categories = [...new Set(services.map(s => s.category))].filter(Boolean);
  const filtered = services.filter(s => {
    if (catFilter !== "all" && s.category !== catFilter) return false;
    if (search) { const q = search.toLowerCase(); return s.name?.toLowerCase().includes(q) || s.category?.toLowerCase().includes(q); }
    return true;
  });

  const toggleEnabled = async (id, enabled) => {
    try {
      await fetch("/api/admin/services", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "toggle", serviceId: id, enabled: !enabled }) });
      setServices(prev => prev.map(s => s.id === id ? { ...s, enabled: !enabled } : s));
    } catch {}
  };

  return (
    <>
      <div className="adm-header">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <div className="adm-title" style={{ color: t.text }}>Services</div>
            <div className="adm-subtitle" style={{ color: t.textMuted }}>{services.length} services across {categories.length} platforms</div>
          </div>
          <button className="adm-btn-primary">+ Add Service</button>
        </div>
        <div className="page-divider" style={{ background: t.cardBorder }} />
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

      <div className="adm-card" style={{ background: dark ? "rgba(255,255,255,.06)" : "rgba(255,255,255,.95)", borderWidth: 1, borderStyle: "solid", borderColor: dark ? "rgba(255,255,255,.06)" : "rgba(0,0,0,.06)", boxShadow: dark ? "0 4px 20px rgba(0,0,0,.25)" : "0 4px 20px rgba(0,0,0,.04)" }}>
        {loading ? (
          <div className="adm-empty" style={{ color: t.textMuted }}>Loading services...</div>
        ) : filtered.length > 0 ? filtered.map((s, i) => (
          <div key={s.id}>
            <div className="adm-list-row" onClick={() => setExpanded(expanded === s.id ? null : s.id)} style={{ borderBottom: i < filtered.length - 1 ? `1px solid ${t.cardBorder}` : "none", cursor: "pointer" }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: 500, color: t.text }}>{s.name}</span>
                  {!s.enabled && <span style={{ fontSize: 9, padding: "1px 6px", borderRadius: 4, background: dark ? "rgba(252,165,165,.1)" : "rgba(220,38,38,.06)", color: t.red, fontWeight: 600 }}>Disabled</span>}
                </div>
                <div style={{ fontSize: 11, color: t.textMuted, marginTop: 2 }}>{s.category} · ID: {s.id}</div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                {(s.tiers || []).map(tier => (
                  <span key={tier.name} className="m" style={{ fontSize: 9, padding: "2px 7px", borderRadius: 4, fontWeight: 600, background: TIER_COLORS[tier.name]?.bg || "rgba(128,128,128,.08)", color: TIER_COLORS[tier.name]?.color || "#888" }}>
                    {tier.name} ₦{tier.price?.toLocaleString() || 0}
                  </span>
                ))}
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={t.textMuted} strokeWidth="2" strokeLinecap="round" style={{ transform: expanded === s.id ? "rotate(180deg)" : "rotate(0)", transition: "transform .2s", marginLeft: 4 }}><polyline points="6 9 12 15 18 9"/></svg>
              </div>
            </div>
            {expanded === s.id && (
              <div style={{ padding: "12px 16px 16px", borderBottom: i < filtered.length - 1 ? `1px solid ${t.cardBorder}` : "none", background: dark ? "rgba(255,255,255,.02)" : "rgba(0,0,0,.01)" }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 12, fontSize: 11 }}>
                  <div><span style={{ color: t.textMuted }}>Category:</span> <span style={{ color: t.text }}>{s.category}</span></div>
                  <div><span style={{ color: t.textMuted }}>Provider:</span> <span style={{ color: t.text }}>{s.provider || "MTP"}</span></div>
                  <div><span style={{ color: t.textMuted }}>Status:</span> <span style={{ color: s.enabled ? t.green : t.red }}>{s.enabled ? "Active" : "Disabled"}</span></div>
                  <div><span style={{ color: t.textMuted }}>Min:</span> <span className="m" style={{ color: t.text }}>{s.min || 0}</span></div>
                  <div><span style={{ color: t.textMuted }}>Max:</span> <span className="m" style={{ color: t.text }}>{s.max || 0}</span></div>
                  <div><span style={{ color: t.textMuted }}>Type:</span> <span style={{ color: t.text }}>{s.type || "—"}</span></div>
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  <button onClick={async () => { const ok = await confirm({ title: s.enabled ? "Disable Service" : "Enable Service", message: s.enabled ? `Disable "${s.name}"? Users won't be able to order it.` : `Re-enable "${s.name}"?`, confirmLabel: s.enabled ? "Disable" : "Enable", danger: s.enabled }); if (ok) toggleEnabled(s.id, s.enabled); }} className="adm-btn-sm" style={{ borderColor: t.cardBorder, color: s.enabled ? t.red : t.green }}>{s.enabled ? "Disable" : "Enable"}</button>
                  <button className="adm-btn-sm" style={{ borderColor: t.cardBorder, color: t.accent }}>Edit</button>
                  <button onClick={async () => { const ok = await confirm({ title: "Delete Service", message: `Permanently delete "${s.name}"? This cannot be undone.`, confirmLabel: "Delete", danger: true }); if (ok) {} }} className="adm-btn-sm" style={{ borderColor: dark ? "rgba(252,165,165,.2)" : "rgba(220,38,38,.15)", color: t.red }}>Delete</button>
                </div>
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
