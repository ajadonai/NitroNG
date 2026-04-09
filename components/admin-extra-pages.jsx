'use client';
import { useState, useEffect } from "react";
import { useConfirm } from "./confirm-dialog";
import { fN, fD } from "../lib/format";


const ROLE_COLORS = { superadmin: "#c47d8e", admin: "#a5b4fc", support: "#6ee7b7", finance: "#fcd34d" };

/* ═══════════════════════════════════════════ */
/* ═══ ACTIVITY LOG                        ═══ */
/* ═══════════════════════════════════════════ */
export function AdminActivityPage({ dark, t }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    fetch("/api/admin/activity").then(r => r.json()).then(d => { setLogs(d.activity || []); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  const types = [...new Set(logs.map(l => l.type))].filter(Boolean);
  const filtered = filter === "all" ? logs : logs.filter(l => l.type === filter);

  const typeColor = (type) => {
    if (type === "order") return t.blue;
    if (type === "credit" || type === "deposit") return t.green;
    if (type === "admin" || type === "maintenance") return t.amber;
    if (type === "notification") return t.accent;
    return t.textMuted;
  };

  return (
    <>
      <div className="adm-header">
        <div className="adm-title" style={{ color: t.text }}>Admin Logs</div>
        <div className="adm-subtitle" style={{ color: t.textMuted }}>Admin audit trail — {logs.length} entries</div>
        <div className="page-divider" style={{ background: t.cardBorder }} />
      </div>

      <div className="adm-filters">
        <button onClick={() => setFilter("all")} className="adm-filter-pill" style={{ borderWidth: 1, borderStyle: "solid", borderColor: filter === "all" ? t.accent : t.cardBorder, background: filter === "all" ? (dark ? "#2a1a22" : "#fdf2f4") : "transparent", color: filter === "all" ? t.accent : t.textMuted }}>All ({logs.length})</button>
        {types.map(ty => (
          <button key={ty} onClick={() => setFilter(ty)} className="adm-filter-pill" style={{ borderWidth: 1, borderStyle: "solid", borderColor: filter === ty ? t.accent : t.cardBorder, background: filter === ty ? (dark ? "#2a1a22" : "#fdf2f4") : "transparent", color: filter === ty ? t.accent : t.textMuted }}>{ty} ({logs.filter(l => l.type === ty).length})</button>
        ))}
      </div>

      <div className="adm-card" style={{ background: dark ? "rgba(255,255,255,.03)" : "rgba(255,255,255,.85)", border: `0.5px solid ${dark ? "rgba(255,255,255,.06)" : "rgba(0,0,0,.06)"}` }}>
        {loading ? (
          <div className="adm-empty" style={{ color: t.textMuted }}>Loading activity...</div>
        ) : filtered.length > 0 ? filtered.map((l, i) => (
          <div key={l.id || i} className="adm-list-row" style={{ borderBottom: i < filtered.length - 1 ? `1px solid ${t.cardBorder}` : "none" }}>
            <div style={{ width: 8, height: 8, borderRadius: 4, background: typeColor(l.type), flexShrink: 0, marginTop: 6 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, color: t.text, fontWeight: 450 }}>{l.action}</div>
              <div style={{ fontSize: 13, color: t.textMuted, marginTop: 2 }}>
                <span style={{ fontWeight: 600, color: t.textSoft }}>{l.admin}</span> · {l.type || "action"} · {l.time ? fD(l.time) : ""}
              </div>
            </div>
          </div>
        )) : (
          <div className="adm-empty" style={{ color: t.textMuted }}>No activity logged yet</div>
        )}
      </div>
    </>
  );
}

/* ═══════════════════════════════════════════ */

/* ═══════════════════════════════════════════ */
/* ═══ TEAM MANAGEMENT                     ═══ */
/* ═══════════════════════════════════════════ */
const ROLE_INFO = {
  owner:      { color: "#e0a458", desc: "Full platform access. Cannot be modified. Only one owner exists." },
  superadmin: { color: "#c47d8e", desc: "Full access to all admin features. Can manage team and settings." },
  admin:      { color: "#a5b4fc", desc: "Default access to most features. Permissions customizable." },
  support:    { color: "#6ee7b7", desc: "Tickets, orders, users only. Permissions customizable." },
  finance:    { color: "#fcd34d", desc: "Payments and analytics only. Permissions customizable." },
};
const ASSIGNABLE_ROLES = ["admin", "support", "finance"];
const ALL_PAGES = [
  { id:"overview", label:"Overview", g:"Main" },{ id:"orders", label:"Orders", g:"Main" },{ id:"users", label:"Users", g:"Main" },{ id:"tickets", label:"Tickets", g:"Main" },
  { id:"services", label:"Services", g:"Catalog" },{ id:"menu-builder", label:"Menu Builder", g:"Catalog" },{ id:"blog", label:"Blog", g:"Catalog" },{ id:"payments", label:"Payments", g:"Catalog" },
  { id:"analytics", label:"Analytics", g:"Insights" },{ id:"activity", label:"Activity Log", g:"Insights" },
  { id:"alerts", label:"Alerts", g:"System" },{ id:"team", label:"Team", g:"System" },{ id:"coupons", label:"Coupons", g:"System" },{ id:"notifications", label:"Notifications", g:"System" },{ id:"maintenance", label:"Maintenance", g:"System" },{ id:"api", label:"API Management", g:"System" },{ id:"settings", label:"Settings", g:"System" },
];
const DEFAULT_PAGES = {
  admin: ["overview","orders","users","services","menu-builder","api","payments","tickets","activity","alerts","analytics","coupons","notifications","maintenance","blog"],
  support: ["overview","orders","users","tickets"],
  finance: ["overview","orders","payments","analytics"],
};
const PAGE_GROUPS = [...new Set(ALL_PAGES.map(p => p.g))];

export function AdminTeamPage({ admin: currentAdmin, dark, t }) {
  const confirm = useConfirm();
  const [admins, setAdmins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [expandedId, setExpandedId] = useState(null);
  const [permTab, setPermTab] = useState("permissions");
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPw, setNewPw] = useState("");
  const [newRole, setNewRole] = useState("admin");
  const [resetPw, setResetPw] = useState("");
  const [localPages, setLocalPages] = useState(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);

  const reload = () => fetch("/api/admin/team").then(r => r.json()).then(d => setAdmins(d.admins || []));
  useEffect(() => { reload().finally(() => setLoading(false)); }, []);

  const act = async (body) => {
    setSaving(true); setMsg(null);
    try {
      const res = await fetch("/api/admin/team", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) { setMsg({ type: "error", text: data.error || "Failed" }); setSaving(false); return false; }
      await reload(); setSaving(false); return data;
    } catch { setMsg({ type: "error", text: "Request failed" }); setSaving(false); return false; }
  };

  const createAdmin = async () => {
    if (!newName.trim() || !newEmail.trim() || !newPw.trim()) return;
    const ok = await act({ action: "create", name: newName, email: newEmail, password: newPw, role: newRole });
    if (ok) { setShowAdd(false); setNewName(""); setNewEmail(""); setNewPw(""); setMsg({ type: "success", text: "Admin created" }); }
  };

  const getEffective = (a) => {
    if (a.role === "owner" || a.role === "superadmin") return ALL_PAGES.map(p => p.id);
    return a.customPages || DEFAULT_PAGES[a.role] || [];
  };

  const canManage = currentAdmin?.role === "owner" || currentAdmin?.role === "superadmin";
  const inputStyle = { width: "100%", padding: "10px 14px", borderRadius: 8, borderWidth: 1, borderStyle: "solid", borderColor: t.cardBorder, background: dark ? "#0d1020" : "#fff", color: t.text, fontSize: 14, outline: "none", boxSizing: "border-box", fontFamily: "inherit" };

  return (
    <>
      <div className="adm-header">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <div className="adm-title" style={{ color: t.text }}>Team</div>
            <div className="adm-subtitle" style={{ color: t.textMuted }}>{admins.length} members · Manage roles, permissions & passwords</div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => { setShowGuide(!showGuide); if (!showGuide) setShowAdd(false); }} className="adm-btn-sm" style={{ borderColor: t.cardBorder, color: t.accent }}>{showGuide ? "Hide Guide" : "Role Guide"}</button>
            {canManage && <button onClick={() => { setShowAdd(!showAdd); if (!showAdd) setShowGuide(false); }} className="adm-btn-primary">{showAdd ? "Cancel" : "+ Add Admin"}</button>}
          </div>
        </div>
        <div className="page-divider" style={{ background: t.cardBorder }} />
      </div>

      {msg && <div style={{ padding: "8px 14px", borderRadius: 8, marginTop: 12, fontSize: 13, background: msg.type === "success" ? (dark ? "rgba(110,231,183,.08)" : "#ecfdf5") : (dark ? "rgba(220,38,38,.08)" : "#fef2f2"), color: msg.type === "success" ? (dark ? "#6ee7b7" : "#059669") : (dark ? "#fca5a5" : "#dc2626"), display: "flex", justifyContent: "space-between", alignItems: "center" }}><span>{msg.type === "success" ? "✓" : "⚠️"} {msg.text}</span><button onClick={() => setMsg(null)} style={{ background: "none", color: "inherit", border: "none", fontSize: 15, cursor: "pointer" }}>✕</button></div>}

      {showGuide && (
        <div className="adm-card" style={{ background: dark ? "rgba(255,255,255,.03)" : "rgba(255,255,255,.85)", border: `0.5px solid ${dark ? "rgba(255,255,255,.06)" : "rgba(0,0,0,.06)"}`, padding: 18, marginTop: 16, marginBottom: 16, boxShadow: dark ? "0 4px 20px rgba(0,0,0,.25)" : "0 4px 20px rgba(0,0,0,.04)", borderRadius: 14 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: t.text, marginBottom: 14 }}>Role Permissions</div>
          {Object.entries(ROLE_INFO).map(([role, info], idx, arr) => (
            <div key={role} style={{ display: "flex", gap: 12, alignItems: "flex-start", marginBottom: idx < arr.length - 1 ? 12 : 0, paddingBottom: idx < arr.length - 1 ? 12 : 0, borderBottom: idx < arr.length - 1 ? `1px solid ${t.cardBorder}` : "none" }}>
              <span className="m" style={{ fontSize: 11, padding: "2px 8px", borderRadius: 4, fontWeight: 600, background: `${info.color}20`, color: info.color, textTransform: "capitalize", flexShrink: 0 }}>{role === "owner" ? "👑 owner" : role}</span>
              <span style={{ fontSize: 13, color: t.textMuted, lineHeight: 1.5 }}>{info.desc}</span>
            </div>
          ))}
        </div>
      )}

      {showAdd && (
        <div className="adm-card" style={{ background: dark ? "rgba(255,255,255,.03)" : "rgba(255,255,255,.85)", border: `0.5px solid ${dark ? "rgba(255,255,255,.06)" : "rgba(0,0,0,.06)"}`, padding: 18, marginTop: 16, marginBottom: 16, boxShadow: dark ? "0 4px 20px rgba(0,0,0,.25)" : "0 4px 20px rgba(0,0,0,.04)", borderRadius: 14 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
            <div><label style={{ fontSize: 13, color: t.textMuted, display: "block", marginBottom: 4 }}>Name</label><input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Full name" style={inputStyle} /></div>
            <div><label style={{ fontSize: 13, color: t.textMuted, display: "block", marginBottom: 4 }}>Email</label><input value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder="admin@nitro.ng" type="email" style={inputStyle} /></div>
            <div><label style={{ fontSize: 13, color: t.textMuted, display: "block", marginBottom: 4 }}>Password</label><input value={newPw} onChange={e => setNewPw(e.target.value)} placeholder="Password" type="password" style={inputStyle} /></div>
            <div><label style={{ fontSize: 13, color: t.textMuted, display: "block", marginBottom: 4 }}>Role</label>
              <div style={{ display: "flex", gap: 4 }}>
                {ASSIGNABLE_ROLES.map(r => (
                  <button key={r} onClick={() => setNewRole(r)} className="adm-filter-pill" style={{ borderWidth: 1, borderStyle: "solid", borderColor: newRole === r ? t.accent : t.cardBorder, background: newRole === r ? (dark ? "#2a1a22" : "#fdf2f4") : "transparent", color: newRole === r ? t.accent : t.textMuted, textTransform: "capitalize" }}>{r}</button>
                ))}
              </div>
            </div>
          </div>
          <button onClick={createAdmin} disabled={saving} className="adm-btn-primary" style={{ opacity: newName && newEmail && newPw && !saving ? 1 : .4 }}>{saving ? "Creating..." : "Create Admin"}</button>
        </div>
      )}

      <div className="adm-card" style={{ background: dark ? "rgba(255,255,255,.03)" : "rgba(255,255,255,.85)", border: `0.5px solid ${dark ? "rgba(255,255,255,.06)" : "rgba(0,0,0,.06)"}`, marginTop: showAdd || showGuide ? 0 : 16 }}>
        {loading ? <div className="adm-empty" style={{ color: t.textMuted }}>Loading team...</div> : admins.map((a, i) => {
          const owner = a.role === "owner";
          const ri = ROLE_INFO[a.role] || { color: "#888" };
          const expanded = expandedId === a.id && !owner && canManage;
          const hasCustom = a.customPages !== null && !owner && a.role !== "superadmin";
          const pages = expanded && localPages !== null ? localPages : (a.customPages || DEFAULT_PAGES[a.role] || []);

          return (
            <div key={a.id} style={{ borderBottom: i < admins.length - 1 ? `1px solid ${t.cardBorder}` : "none" }}>
              <div onClick={() => { if (!owner && canManage) { if (expanded) { setExpandedId(null); } else { setExpandedId(a.id); setPermTab("permissions"); setResetPw(""); setLocalPages(null); setMsg(null); } } }} style={{ padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap", cursor: owner || !canManage ? "default" : "pointer", background: expanded ? (dark ? "rgba(196,125,142,.03)" : "rgba(196,125,142,.02)") : "transparent" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, minWidth: 180 }}>
                  <div className="adm-user-avatar" style={{ background: ri.color }}>{(a.name || "A")[0]}</div>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                      <span style={{ fontSize: 14, fontWeight: 500, color: t.text }}>{a.name}</span>
                      <span className="m" style={{ fontSize: 11, padding: "1px 6px", borderRadius: 4, fontWeight: 600, background: `${ri.color}20`, color: ri.color, textTransform: "capitalize" }}>{a.role}</span>
                      {owner && <span style={{ fontSize: 11 }}>👑</span>}
                      {hasCustom && <span style={{ fontSize: 10, padding: "1px 5px", borderRadius: 4, background: dark ? "rgba(196,125,142,.12)" : "rgba(196,125,142,.06)", color: t.accent, fontWeight: 600 }}>custom</span>}
                      {a.status !== "Active" && <span style={{ fontSize: 11, padding: "1px 6px", borderRadius: 4, background: dark ? "rgba(252,165,165,.1)" : "rgba(220,38,38,.06)", color: dark ? "#fca5a5" : "#dc2626", fontWeight: 600 }}>Inactive</span>}
                    </div>
                    <div style={{ fontSize: 13, color: t.textMuted, marginTop: 1 }}>{a.email}</div>
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 12, color: t.textMuted }}>{a.lastActive ? fD(a.lastActive) : "Never"}</span>
                  {owner ? <span style={{ fontSize: 12, color: t.textMuted, fontStyle: "italic" }}>Protected</span> : canManage ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={t.textMuted} strokeWidth="2" strokeLinecap="round" style={{ transform: expanded ? "rotate(180deg)" : "none", transition: "transform .2s" }}><polyline points="6 9 12 15 18 9" /></svg> : null}
                </div>
              </div>

              {expanded && (
                <div style={{ padding: "0 16px 16px", background: dark ? "rgba(0,0,0,.15)" : "rgba(0,0,0,.02)" }}>
                  <div style={{ display: "flex", gap: 4, marginBottom: 14, background: dark ? "rgba(255,255,255,.04)" : "rgba(0,0,0,.03)", borderRadius: 8, padding: 3 }}>
                    {[["permissions","🔐 Permissions"],["password","🔑 Password"],["role","🏷️ Role"]].map(([id, label]) => (
                      <button key={id} onClick={e => { e.stopPropagation(); setPermTab(id); }} style={{ flex: 1, padding: "7px 0", borderRadius: 6, fontSize: 12, fontWeight: permTab === id ? 600 : 430, background: permTab === id ? (dark ? "rgba(196,125,142,.15)" : "rgba(196,125,142,.08)") : "transparent", color: permTab === id ? t.accent : t.textMuted, border: "none", cursor: "pointer" }}>{label}</button>
                    ))}
                  </div>

                  {permTab === "permissions" && (a.role !== "superadmin" ? (
                    <div>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                        <span style={{ fontSize: 12, color: t.textSoft }}>{pages.length} of {ALL_PAGES.length} pages enabled</span>
                        {(localPages !== null || a.customPages !== null) && <button onClick={e => { e.stopPropagation(); setLocalPages(null); act({ action: "updatePermissions", adminId: a.id, pages: null }).then(() => setMsg({ type: "success", text: "Reset to default" })); }} style={{ fontSize: 11, color: t.textMuted, background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}>Reset to default</button>}
                      </div>
                      {PAGE_GROUPS.map(group => (
                        <div key={group} style={{ marginBottom: 12 }}>
                          <div style={{ fontSize: 10, fontWeight: 600, color: t.accent, textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>{group}</div>
                          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 4 }}>
                            {ALL_PAGES.filter(p => p.g === group).map(page => {
                              const enabled = pages.includes(page.id);
                              const defEnabled = (DEFAULT_PAGES[a.role] || []).includes(page.id);
                              const customized = (localPages !== null || a.customPages !== null) && enabled !== defEnabled;
                              return (
                                <button key={page.id} onClick={e => { e.stopPropagation(); const next = enabled ? pages.filter(p => p !== page.id) : [...pages, page.id]; setLocalPages(next); }} style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 10px", borderRadius: 8, borderWidth: 1, borderStyle: "solid", borderColor: enabled ? t.accent : t.cardBorder, background: enabled ? (dark ? "rgba(196,125,142,.08)" : "rgba(196,125,142,.04)") : "transparent", cursor: "pointer", textAlign: "left" }}>
                                  <div style={{ width: 14, height: 14, borderRadius: 4, borderWidth: 1.5, borderStyle: "solid", borderColor: enabled ? t.accent : t.textMuted, background: enabled ? t.accent : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                                    {enabled && <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>}
                                  </div>
                                  <span style={{ fontSize: 12, color: enabled ? t.text : t.textMuted, fontWeight: enabled ? 500 : 400 }}>{page.label}</span>
                                  {customized && <span style={{ width: 5, height: 5, borderRadius: "50%", background: t.accent, flexShrink: 0 }} />}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                      <button onClick={e => { e.stopPropagation(); act({ action: "updatePermissions", adminId: a.id, pages: localPages || pages }).then(ok => { if (ok) { setMsg({ type: "success", text: "Permissions saved" }); setLocalPages(null); } }); }} disabled={saving} className="adm-btn-primary" style={{ width: "100%", marginTop: 4, opacity: saving ? .5 : 1 }}>{saving ? "Saving..." : "Save Permissions"}</button>
                    </div>
                  ) : <div style={{ padding: "16px 0", textAlign: "center", color: t.textMuted, fontSize: 13 }}>Superadmin has full access. No customization needed.</div>)}

                  {permTab === "password" && (
                    <div>
                      <div style={{ fontSize: 13, color: t.textMuted, marginBottom: 12, lineHeight: 1.6 }}>Set a new password for <strong style={{ color: t.text }}>{a.name}</strong>.</div>
                      <div style={{ marginBottom: 12 }}>
                        <label style={{ fontSize: 11, color: t.textMuted, fontWeight: 600, display: "block", marginBottom: 4, textTransform: "uppercase", letterSpacing: 1 }}>New Password</label>
                        <input type="password" placeholder="Min. 6 characters" value={resetPw} onChange={e => setResetPw(e.target.value)} onClick={e => e.stopPropagation()} style={inputStyle} />
                      </div>
                      <button onClick={e => { e.stopPropagation(); act({ action: "resetPassword", adminId: a.id, newPassword: resetPw }).then(ok => { if (ok) { setMsg({ type: "success", text: `Password reset for ${a.name}` }); setResetPw(""); } }); }} disabled={resetPw.length < 6 || saving} className="adm-btn-primary" style={{ width: "100%", opacity: resetPw.length >= 6 && !saving ? 1 : .4 }}>{saving ? "Resetting..." : "Reset Password"}</button>
                    </div>
                  )}

                  {permTab === "role" && (
                    <div>
                      <div style={{ fontSize: 13, color: t.textMuted, marginBottom: 12, lineHeight: 1.6 }}>Change <strong style={{ color: t.text }}>{a.name}</strong>'s role. Custom permissions are preserved.</div>
                      <div style={{ display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap" }}>
                        {ASSIGNABLE_ROLES.map(r => {
                          const ri2 = ROLE_INFO[r]; const active = a.role === r;
                          return <button key={r} onClick={e => { e.stopPropagation(); act({ action: "updateRole", adminId: a.id, role: r }).then(ok => { if (ok) setMsg({ type: "success", text: `${a.name} is now ${r}` }); }); }} style={{ padding: "8px 16px", borderRadius: 8, borderWidth: 1, borderStyle: "solid", borderColor: active ? ri2.color : t.cardBorder, background: active ? `${ri2.color}15` : "transparent", color: active ? ri2.color : t.textMuted, fontSize: 13, fontWeight: active ? 600 : 430, cursor: "pointer", textTransform: "capitalize" }}>{r}</button>;
                        })}
                      </div>
                      <button onClick={async e => { e.stopPropagation(); const ok = await confirm({ title: a.status === "Active" ? "Deactivate Admin" : "Activate Admin", message: a.status === "Active" ? `Deactivate ${a.name}?` : `Reactivate ${a.name}?`, confirmLabel: a.status === "Active" ? "Deactivate" : "Activate", danger: a.status === "Active" }); if (ok) { const r = await act({ action: "toggleStatus", adminId: a.id }); if (r) setMsg({ type: "success", text: `${a.name} ${r.status === "Active" ? "activated" : "deactivated"}` }); } }} className="adm-btn-sm" style={{ borderColor: t.cardBorder, color: a.status === "Active" ? (dark ? "#fca5a5" : "#dc2626") : (dark ? "#6ee7b7" : "#059669") }}>{a.status === "Active" ? "Deactivate" : "Activate"}</button>
                      <button onClick={async e => { e.stopPropagation(); const ok = await confirm({ title: "Delete Admin", message: `Permanently delete ${a.name}? This cannot be undone.`, confirmLabel: "Delete", danger: true }); if (ok) { const r = await act({ action: "delete", adminId: a.id }); if (r) setMsg({ type: "success", text: `${a.name} deleted` }); } }} className="adm-btn-sm" style={{ borderColor: dark ? "rgba(252,165,165,.2)" : "rgba(220,38,38,.1)", color: dark ? "#fca5a5" : "#dc2626" }}>Delete</button>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}

/* ═══ COUPONS                             ═══ */
/* ═══════════════════════════════════════════ */
export function AdminCouponsPage({ dark, t }) {
  const confirm = useConfirm();
  const [coupons, setCoupons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ code: "", type: "percent", value: "", minOrder: "", maxUses: "", expires: "" });

  useEffect(() => {
    fetch("/api/admin/coupons").then(r => r.json()).then(d => { setCoupons(d.coupons || []); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  const createCoupon = async () => {
    if (!form.code.trim() || !form.value) return;
    try {
      const res = await fetch("/api/admin/coupons", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "create", ...form, value: Number(form.value), minOrder: Number(form.minOrder) || 0, maxUses: Number(form.maxUses) || 0 }) });
      if (res.ok) { setShowAdd(false); setForm({ code: "", type: "percent", value: "", minOrder: "", maxUses: "", expires: "" }); fetch("/api/admin/coupons").then(r => r.json()).then(d => setCoupons(d.coupons || [])); }
    } catch {}
  };

  const deleteCoupon = async (code) => {
    try {
      await fetch("/api/admin/coupons", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "delete", code }) });
      setCoupons(prev => prev.filter(c => c.code !== code));
    } catch {}
  };

  const inputStyle = { width: "100%", padding: "10px 14px", borderRadius: 8, borderWidth: 1, borderStyle: "solid", borderColor: t.cardBorder, background: dark ? "#0d1020" : "#fff", color: t.text, fontSize: 14, outline: "none", boxSizing: "border-box", fontFamily: "inherit" };

  return (
    <>
      <div className="adm-header">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <div className="adm-title" style={{ color: t.text }}>Coupons</div>
            <div className="adm-subtitle" style={{ color: t.textMuted }}>Manage promo codes and discounts</div>
          </div>
          <button onClick={() => setShowAdd(!showAdd)} className="adm-btn-primary">{showAdd ? "Cancel" : "+ New Coupon"}</button>
        </div>
        <div className="page-divider" style={{ background: t.cardBorder }} />
      </div>

      {showAdd && (
        <div className="adm-card" style={{ background: dark ? "rgba(255,255,255,.03)" : "rgba(255,255,255,.85)", border: `0.5px solid ${dark ? "rgba(255,255,255,.06)" : "rgba(0,0,0,.06)"}`, padding: 18, marginTop: 16, marginBottom: 16, boxShadow: dark ? "0 4px 20px rgba(0,0,0,.25)" : "0 4px 20px rgba(0,0,0,.04)", borderRadius: 14 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
            <div><label style={{ fontSize: 13, color: t.textMuted, display: "block", marginBottom: 4 }}>Code</label><input value={form.code} onChange={e => setForm({ ...form, code: e.target.value.toUpperCase() })} placeholder="WELCOME20" className="m" style={inputStyle} /></div>
            <div><label style={{ fontSize: 13, color: t.textMuted, display: "block", marginBottom: 4 }}>Type</label>
              <div style={{ display: "flex", gap: 4 }}>
                {[["percent", "% Off"], ["fixed", "₦ Off"]].map(([id, lb]) => (
                  <button key={id} onClick={() => setForm({ ...form, type: id })} className="adm-filter-pill" style={{ borderWidth: 1, borderStyle: "solid", borderColor: form.type === id ? t.accent : t.cardBorder, background: form.type === id ? (dark ? "#2a1a22" : "#fdf2f4") : "transparent", color: form.type === id ? t.accent : t.textMuted }}>{lb}</button>
                ))}
              </div>
            </div>
            <div><label style={{ fontSize: 13, color: t.textMuted, display: "block", marginBottom: 4 }}>Value</label><input type="number" value={form.value} onChange={e => setForm({ ...form, value: e.target.value })} placeholder={form.type === "percent" ? "20" : "500"} className="m" style={inputStyle} /></div>
            <div><label style={{ fontSize: 13, color: t.textMuted, display: "block", marginBottom: 4 }}>Min Order (₦)</label><input type="number" value={form.minOrder} onChange={e => setForm({ ...form, minOrder: e.target.value })} placeholder="0" className="m" style={inputStyle} /></div>
            <div><label style={{ fontSize: 13, color: t.textMuted, display: "block", marginBottom: 4 }}>Max Uses (0 = unlimited)</label><input type="number" value={form.maxUses} onChange={e => setForm({ ...form, maxUses: e.target.value })} placeholder="0" className="m" style={inputStyle} /></div>
            <div><label style={{ fontSize: 13, color: t.textMuted, display: "block", marginBottom: 4 }}>Expires</label><input type="date" value={form.expires} onChange={e => setForm({ ...form, expires: e.target.value })} style={inputStyle} /></div>
          </div>
          <button onClick={createCoupon} className="adm-btn-primary" style={{ opacity: form.code && form.value ? 1 : .4 }}>Create Coupon</button>
        </div>
      )}

      <div className="adm-card" style={{ background: dark ? "rgba(255,255,255,.03)" : "rgba(255,255,255,.85)", border: `0.5px solid ${dark ? "rgba(255,255,255,.06)" : "rgba(0,0,0,.06)"}`, marginTop: showAdd ? 0 : 16 }}>
        {loading ? (
          <div className="adm-empty" style={{ color: t.textMuted }}>Loading coupons...</div>
        ) : coupons.length > 0 ? coupons.map((c, i) => (
          <div key={c.code} className="adm-list-row" style={{ borderBottom: i < coupons.length - 1 ? `1px solid ${t.cardBorder}` : "none", flexWrap: "wrap", gap: 10 }}>
            <div style={{ flex: 1, minWidth: 160 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span className="m" style={{ fontSize: 15, fontWeight: 700, color: t.accent }}>{c.code}</span>
                <span className="m" style={{ fontSize: 13, color: t.green, fontWeight: 600 }}>{c.type === "percent" ? `${c.value}%` : fN(c.value)} off</span>
              </div>
              <div style={{ fontSize: 13, color: t.textMuted, marginTop: 2 }}>
                Min: {c.minOrder ? fN(c.minOrder) : "None"} · Uses: {c.uses || 0}/{c.maxUses || "∞"} · {c.expires ? `Expires: ${c.expires}` : "No expiry"}
              </div>
            </div>
            <button onClick={async () => { const ok = await confirm({ title: "Delete Coupon", message: `Delete coupon "${c.code}"? This cannot be undone.`, confirmLabel: "Delete", danger: true }); if (ok) deleteCoupon(c.code); }} className="adm-btn-sm" style={{ borderColor: dark ? "rgba(252,165,165,.2)" : "rgba(220,38,38,.15)", color: t.red }}>Delete</button>
          </div>
        )) : (
          <div className="adm-empty" style={{ color: t.textMuted }}>No coupons created yet</div>
        )}
      </div>
    </>
  );
}

/* ═══════════════════════════════════════════ */
/* ═══ NOTIFICATIONS                       ═══ */
/* ═══════════════════════════════════════════ */
export function AdminNotificationsPage({ dark, t }) {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [target, setTarget] = useState("all");
  const [sending, setSending] = useState(false);
  const [msg, setMsg] = useState(null);

  useEffect(() => {
    fetch("/api/admin/notifications").then(r => r.json()).then(d => { setHistory(d.history || []); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  const send = async () => {
    if (!message.trim() || sending) return;
    setSending(true); setMsg(null);
    try {
      const res = await fetch("/api/admin/notifications", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ subject, message, target }) });
      const data = await res.json();
      if (res.ok) {
        setMsg({ type: "success", text: data.message || "Sending..." });
        setSubject(""); setMessage("");
        // Poll history every 3s until status changes from "sending"
        const pollDone = setInterval(() => {
          fetch("/api/admin/notifications").then(r => r.json()).then(d => {
            setHistory(d.history || []);
            const latest = (d.history || [])[0];
            if (latest && latest.status !== "sending") {
              clearInterval(pollDone);
              setMsg({ type: latest.status === "failed" ? "error" : "success", text: `${latest.sent}/${latest.recipients} delivered` });
            }
          });
        }, 3000);
        // Stop polling after 2 minutes max
        setTimeout(() => clearInterval(pollDone), 120000);
      }
      else setMsg({ type: "error", text: data.error || "Failed" });
    } catch { setMsg({ type: "error", text: "Request failed" }); }
    setSending(false);
  };

  const inputStyle = { width: "100%", padding: "10px 14px", borderRadius: 8, borderWidth: 1, borderStyle: "solid", borderColor: t.cardBorder, background: dark ? "#0d1020" : "#fff", color: t.text, fontSize: 14, outline: "none", boxSizing: "border-box", fontFamily: "inherit" };

  return (
    <>
      <div className="adm-header">
        <div className="adm-title" style={{ color: t.text }}>Email Blasts</div>
        <div className="adm-subtitle" style={{ color: t.textMuted }}>Send email blasts to users</div>
        <div className="page-divider" style={{ background: t.cardBorder }} />
      </div>

      {/* Compose */}
      <div className="adm-card" style={{ background: dark ? "rgba(255,255,255,.03)" : "rgba(255,255,255,.85)", border: `0.5px solid ${dark ? "rgba(255,255,255,.06)" : "rgba(0,0,0,.06)"}`, padding: 18, marginTop: 16, marginBottom: 20, boxShadow: dark ? "0 4px 20px rgba(0,0,0,.25)" : "0 4px 20px rgba(0,0,0,.04)", borderRadius: 14 }}>
        <div style={{ fontSize: 15, fontWeight: 600, color: t.text, marginBottom: 12 }}>Compose Notification</div>
        {msg && <div style={{ padding: "8px 12px", borderRadius: 8, marginBottom: 12, fontSize: 13, background: msg.type === "success" ? (dark ? "rgba(110,231,183,.08)" : "#ecfdf5") : (dark ? "rgba(220,38,38,.08)" : "#fef2f2"), color: msg.type === "success" ? (dark ? "#6ee7b7" : "#059669") : (dark ? "#fca5a5" : "#dc2626") }}>{msg.type === "success" ? "✓" : "⚠️"} {msg.text}</div>}
        <div style={{ marginBottom: 12 }}>
          <label style={{ fontSize: 13, color: t.textMuted, display: "block", marginBottom: 4 }}>Subject</label>
          <input value={subject} onChange={e => setSubject(e.target.value)} placeholder="Notification subject..." style={inputStyle} />
        </div>
        <div style={{ marginBottom: 12 }}>
          <label style={{ fontSize: 13, color: t.textMuted, display: "block", marginBottom: 4 }}>Message</label>
          <textarea value={message} onChange={e => setMessage(e.target.value)} placeholder="Write your message..." rows={3} style={{ ...inputStyle, resize: "vertical", lineHeight: 1.5 }} />
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
          <div style={{ display: "flex", gap: 4 }}>
            <label style={{ fontSize: 13, color: t.textMuted, marginRight: 6, lineHeight: "28px" }}>Send to:</label>
            {["all", "active", "new"].map(tg => (
              <button key={tg} onClick={() => setTarget(tg)} className="adm-filter-pill" style={{ borderWidth: 1, borderStyle: "solid", borderColor: target === tg ? t.accent : t.cardBorder, background: target === tg ? (dark ? "#2a1a22" : "#fdf2f4") : "transparent", color: target === tg ? t.accent : t.textMuted, textTransform: "capitalize" }}>{tg} users</button>
            ))}
          </div>
          <button onClick={send} disabled={sending || !message.trim()} className="adm-btn-primary" style={{ opacity: message.trim() && !sending ? 1 : .4 }}>{sending ? "Sending..." : "Send Notification"}</button>
        </div>
      </div>

      {/* History */}
      <div className="adm-card" style={{ background: dark ? "rgba(255,255,255,.03)" : "rgba(255,255,255,.85)", border: `0.5px solid ${dark ? "rgba(255,255,255,.06)" : "rgba(0,0,0,.06)"}` }}>
        <div className="adm-card-title" style={{ color: t.textMuted, padding: "16px 16px 0" }}>Sent history</div>
        <div className="adm-card-divider" style={{ background: dark ? "rgba(255,255,255,.06)" : "rgba(0,0,0,.06)", margin: "12px 0 0" }} />
        {loading ? (
          <div className="adm-empty" style={{ color: t.textMuted }}>Loading...</div>
        ) : history.length > 0 ? history.map((n, i) => (
          <div key={n.id} className="adm-list-row" style={{ borderBottom: i < history.length - 1 ? `1px solid ${t.cardBorder}` : "none" }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 500, color: t.text }}>{n.subject || "Notification"}</div>
              <div style={{ fontSize: 13, color: t.textSoft, marginTop: 2 }}>{n.message}</div>
              <div style={{ fontSize: 12, color: t.textMuted, marginTop: 4 }}>To: {n.target} · {n.recipients ? `${n.sent || 0}/${n.recipients} delivered` : ""} · By: {n.sentBy} · {n.sentAt ? fD(n.sentAt) : ""}</div>
            </div>
            <span className="m" style={{ fontSize: 11, padding: "2px 7px", borderRadius: 4, fontWeight: 600, background: n.status === "sent" ? (dark ? "rgba(110,231,183,.1)" : "rgba(5,150,105,.06)") : n.status === "sending" ? (dark ? "rgba(96,165,250,.1)" : "rgba(59,130,246,.06)") : (dark ? "rgba(252,211,77,.1)" : "rgba(217,119,6,.06)"), color: n.status === "sent" ? t.green : n.status === "sending" ? (dark ? "#60a5fa" : "#2563eb") : t.amber }}>{n.status === "sending" ? "sending..." : n.status}</span>
          </div>
        )) : (
          <div className="adm-empty" style={{ color: t.textMuted }}>No notifications sent yet</div>
        )}
      </div>
    </>
  );
}

/* ═══════════════════════════════════════════ */
/* ═══ MAINTENANCE                         ═══ */
/* ═══════════════════════════════════════════ */
export function AdminMaintenancePage({ dark, t }) {
  const confirm = useConfirm();
  const [enabled, setEnabled] = useState(false);
  const [msg, setMsg] = useState("We're upgrading our systems to serve you better. We'll be back shortly!");
  const [duration, setDuration] = useState(60);
  const [useCustom, setUseCustom] = useState(false);
  const [customH, setCustomH] = useState("");
  const [customM, setCustomM] = useState("");
  const [loading, setLoading] = useState(true);

  const PRESETS = [{ label: "30 min", m: 30 }, { label: "1 hour", m: 60 }, { label: "2 hours", m: 120 }, { label: "6 hours", m: 360 }, { label: "12 hours", m: 720 }, { label: "24 hours", m: 1440 }];

  const formatDuration = (mins) => { if (mins < 60) return `~${mins} minutes`; const h = Math.floor(mins / 60); const m = mins % 60; return m ? `~${h}h ${m}m` : `~${h} hour${h > 1 ? "s" : ""}`; };

  useEffect(() => {
    fetch("/api/admin/maintenance").then(r => r.json()).then(d => { setEnabled(d.enabled || false); if (d.message) setMsg(d.message); if (d.durationMinutes) setDuration(d.durationMinutes); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  const save = async (newEnabled) => {
    const e = newEnabled !== undefined ? newEnabled : enabled;
    const mins = useCustom ? ((Number(customH) || 0) * 60 + (Number(customM) || 0)) : duration;
    try {
      const res = await fetch("/api/admin/maintenance", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ enabled: e, message: msg, durationMinutes: mins, estimatedReturn: formatDuration(mins) }) });
      if (res.ok) { if (newEnabled !== undefined) setEnabled(e); }
      else { const d = await res.json().catch(() => ({})); alert(d.error || "Failed to save"); }
    } catch { alert("Network error"); }
  };

  return (
    <>
      <div className="adm-header">
        <div className="adm-title" style={{ color: t.text }}>Maintenance Mode</div>
        <div className="adm-subtitle" style={{ color: t.textMuted }}>Take the platform offline for updates</div>
        <div className="page-divider" style={{ background: t.cardBorder }} />
      </div>

      {loading ? null : (
        <div style={{ maxWidth: 600, marginTop: 16 }}>
          {/* Status card */}
          <div style={{ borderRadius: 16, background: dark ? "rgba(255,255,255,.06)" : "rgba(255,255,255,.95)", borderWidth: 1, borderStyle: "solid", borderColor: t.cardBorder, boxShadow: dark ? "0 4px 20px rgba(0,0,0,.25)" : "0 4px 20px rgba(0,0,0,.04)", padding: 24, marginBottom: 20 }}>
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: t.text, marginBottom: 4 }}>Platform Status</div>
              <div style={{ fontSize: 14, color: t.textMuted }}>{enabled ? "⚠️ Platform is currently offline" : "✅ Platform is online and operational"}</div>
            </div>

            {/* Duration presets */}
            <div style={{ fontSize: 12, fontWeight: 600, color: t.textMuted, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 12 }}>Estimated Duration</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginBottom: 12 }}>
              {PRESETS.map(p => {
                const active = !useCustom && duration === p.m;
                return (<button key={p.m} onClick={() => { setDuration(p.m); setUseCustom(false); }} className="m" style={{ padding: "10px 0", borderRadius: 10, fontSize: 13, fontWeight: 600, textAlign: "center", borderWidth: 1, borderStyle: "solid", borderColor: active ? t.accent : t.cardBorder, background: active ? (dark ? "rgba(196,125,142,.1)" : "rgba(196,125,142,.06)") : "transparent", color: active ? t.accent : t.textSoft, cursor: "pointer" }}>{p.label}</button>);
              })}
            </div>
            <button onClick={() => setUseCustom(!useCustom)} style={{ fontSize: 14, color: useCustom ? t.accent : t.textSoft, fontWeight: 500, background: "none", marginBottom: useCustom ? 12 : 0, cursor: "pointer" }}>{useCustom ? "▾ Custom duration" : "▸ Custom duration"}</button>
            {useCustom && (
              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <div style={{ flex: 1 }}><label style={{ fontSize: 12, color: t.textMuted, display: "block", marginBottom: 4 }}>Hours</label><input type="number" min="0" max="72" value={customH} onChange={e => setCustomH(e.target.value)} placeholder="0" className="m" style={{ width: "100%", padding: "10px 14px", borderRadius: 10, background: dark ? "#0d1020" : "#fff", borderWidth: 1, borderStyle: "solid", borderColor: t.cardBorder, color: t.text, fontSize: 16, fontWeight: 600, outline: "none", textAlign: "center", boxSizing: "border-box" }} /></div>
                <span style={{ fontSize: 20, color: t.textMuted, marginTop: 16 }}>:</span>
                <div style={{ flex: 1 }}><label style={{ fontSize: 12, color: t.textMuted, display: "block", marginBottom: 4 }}>Minutes</label><input type="number" min="0" max="59" value={customM} onChange={e => setCustomM(e.target.value)} placeholder="0" className="m" style={{ width: "100%", padding: "10px 14px", borderRadius: 10, background: dark ? "#0d1020" : "#fff", borderWidth: 1, borderStyle: "solid", borderColor: t.cardBorder, color: t.text, fontSize: 16, fontWeight: 600, outline: "none", textAlign: "center", boxSizing: "border-box" }} /></div>
                <div className="m" style={{ flex: 1, fontSize: 13, color: t.textMuted, marginTop: 16 }}>= {(Number(customH) || 0) * 60 + (Number(customM) || 0)} min</div>
              </div>
            )}
          </div>

          {/* Message card */}
          <div style={{ borderRadius: 16, background: dark ? "rgba(255,255,255,.06)" : "rgba(255,255,255,.95)", borderWidth: 1, borderStyle: "solid", borderColor: t.cardBorder, boxShadow: dark ? "0 4px 20px rgba(0,0,0,.25)" : "0 4px 20px rgba(0,0,0,.04)", padding: 24, marginBottom: 20 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: t.textMuted, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 8 }}>Maintenance Message</div>
            <div style={{ fontSize: 13, color: t.textMuted, marginBottom: 10 }}>This is what users will see on the maintenance page</div>
            <textarea value={msg} onChange={e => setMsg(e.target.value)} rows={3} style={{ width: "100%", padding: "12px 14px", borderRadius: 12, background: dark ? "#0d1020" : "#fff", resize: "vertical", borderWidth: 1, borderStyle: "solid", borderColor: t.cardBorder, color: t.text, fontSize: 14, outline: "none", fontFamily: "inherit", lineHeight: 1.6, boxSizing: "border-box" }} />
          </div>

          {/* Action */}
          <button onClick={async () => { const ok = await confirm({ title: enabled ? "Bring Platform Online" : "Take Platform Offline", message: enabled ? "Bring the platform back online for all users?" : "This will take the platform offline. All users will see a maintenance page.", confirmLabel: enabled ? "Go Online" : "Take Offline", danger: !enabled }); if (ok) save(!enabled); }} style={{ width: "100%", padding: "14px 0", borderRadius: 12, fontSize: 15, fontWeight: 700, border: "none", cursor: "pointer", background: enabled ? (dark ? "rgba(110,231,183,.12)" : "rgba(5,150,105,.08)") : `linear-gradient(135deg,#c47d8e,#8b5e6b)`, color: enabled ? t.green : "#fff", boxShadow: enabled ? "none" : "0 4px 16px rgba(196,125,142,.25)" }}>{enabled ? "🟢 Bring Platform Online" : "🔴 Take Platform Offline"}</button>
        </div>
      )}
    </>
  );
}

/* ═══════════════════════════════════════════ */
/* ═══ API MANAGEMENT                      ═══ */
/* ═══════════════════════════════════════════ */
export function AdminAPIPage({ dark, t }) {
  const PROVIDERS = [
    { id: "mtp", name: "MoreThanPanel (MTP)", url: "https://morethanpanel.com/api/v2", envKey: "MTP_API_KEY", envUrl: "MTP_API_URL" },
    { id: "jap", name: "JustAnotherPanel (JAP)", url: "", envKey: "JAP_API_KEY", envUrl: "JAP_API_URL" },
    { id: "dao", name: "DaoSMM", url: "", envKey: "DAO_API_KEY", envUrl: "DAO_API_URL" },
  ];

  const [loading, setLoading] = useState(true);
  const [svcCount, setSvcCount] = useState(0);
  const [envStatus, setEnvStatus] = useState({});
  const [testing, setTesting] = useState(null);
  const [syncing, setSyncing] = useState(null);
  const [result, setResult] = useState(null);

  useEffect(() => {
    async function load() {
      try {
        const [svcsRes, statusRes] = await Promise.all([
          fetch("/api/admin/services"),
          fetch("/api/admin/sync"),
        ]);
        if (svcsRes.ok) { const d = await svcsRes.json(); setSvcCount(d.services?.length || 0); }
        if (statusRes.ok) { const d = await statusRes.json(); setEnvStatus(d.status || {}); }
      } catch {}
      setLoading(false);
    }
    load();
  }, []);

  const testConnection = async (provider) => {
    setTesting(provider.id); setResult(null);
    try {
      const res = await fetch("/api/admin/sync", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "test" }) });
      const data = await res.json();
      if (res.ok) {
        const usd = parseFloat(data.balance?.balance || 0);
        let rate = 1600;
        try { const sr = await fetch("/api/admin/settings"); if (sr.ok) { const sd = await sr.json(); rate = Number(sd.settings?.markup_usd_rate) || 1600; } } catch {}
        const ngn = Math.round(usd * rate);
        setResult({ id: provider.id, type: "success", message: `Connected! Provider balance: ₦${ngn.toLocaleString()} (≈$${usd.toFixed(2)} at ₦${rate}/$)` });
      }
      else setResult({ id: provider.id, type: "error", message: data.error || "Connection failed" });
    } catch (e) { setResult({ id: provider.id, type: "error", message: e.message || "Network error" }); }
    setTesting(null);
  };

  const syncServices = async (provider) => {
    setSyncing(provider.id); setResult(null);
    try {
      const res = await fetch("/api/admin/sync", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "sync" }) });
      const data = await res.json();
      if (res.ok) {
        setResult({ id: provider.id, type: "success", message: `Synced! ${data.created} new, ${data.updated} updated, ${data.skipped} skipped (${data.total} total)` });
        setSvcCount(prev => prev + (data.created || 0));
      } else setResult({ id: provider.id, type: "error", message: data.error || "Sync failed" });
    } catch (e) { setResult({ id: provider.id, type: "error", message: e.message || "Network error" }); }
    setSyncing(null);
  };

  if (loading) return <div style={{ padding: 24, color: t.textMuted }}>Loading API settings...</div>;

  return (
    <>
      <div className="adm-header">
        <div>
          <div className="adm-title" style={{ color: t.text }}>API Management</div>
          <div className="adm-subtitle" style={{ color: t.textMuted }}>SMM provider connections · {svcCount.toLocaleString()} services in database</div>
        </div>
        <div className="page-divider" style={{ background: t.cardBorder }} />
      </div>

      <div style={{ padding: "12px 16px", borderRadius: 10, background: dark ? "rgba(196,125,142,.06)" : "rgba(196,125,142,.04)", border: `1px solid ${dark ? "rgba(196,125,142,.12)" : "rgba(196,125,142,.08)"}`, marginTop: 16, marginBottom: 16, fontSize: 13, color: t.textSoft, lineHeight: 1.6 }}>
        API keys are configured via environment variables for security. Add them in your <strong style={{ color: t.text }}>.env</strong> file locally or in <strong style={{ color: t.text }}>Vercel → Settings → Environment Variables</strong> for production.
      </div>

      <div>
        {PROVIDERS.map((p, i) => {
          const configured = envStatus[p.id] || false;
          const pResult = result?.id === p.id ? result : null;

          return (
            <div key={p.id} className="adm-card" style={{ background: dark ? "rgba(255,255,255,.03)" : "rgba(255,255,255,.85)", border: `0.5px solid ${dark ? "rgba(255,255,255,.06)" : "rgba(0,0,0,.06)"}`, padding: 18, marginBottom: 12, boxShadow: dark ? "0 4px 20px rgba(0,0,0,.25)" : "0 4px 20px rgba(0,0,0,.04)", borderRadius: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 10 }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 15, fontWeight: 600, color: t.text }}>{p.name}</span>
                    <span className="m" style={{ fontSize: 11, padding: "2px 7px", borderRadius: 4, fontWeight: 600, background: configured ? (dark ? "rgba(110,231,183,.1)" : "rgba(5,150,105,.06)") : (dark ? "rgba(252,211,77,.1)" : "rgba(217,119,6,.06)"), color: configured ? (dark ? "#6ee7b7" : "#059669") : (dark ? "#fcd34d" : "#d97706") }}>{configured ? "connected" : "not configured"}</span>
                  </div>
                  <div className="m" style={{ fontSize: 13, color: t.textMuted, marginTop: 4 }}>{p.url || "URL pending"}</div>
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  {configured && p.id === "mtp" && <button onClick={() => testConnection(p)} disabled={testing === p.id} className="adm-btn-sm" style={{ borderColor: t.cardBorder, color: dark ? "#a5b4fc" : "#4f46e5", opacity: testing === p.id ? .5 : 1 }}>{testing === p.id ? "Testing..." : "Test"}</button>}
                  {configured && p.id === "mtp" && <button onClick={() => syncServices(p)} disabled={syncing === p.id} className="adm-btn-sm" style={{ borderColor: t.cardBorder, color: dark ? "#6ee7b7" : "#059669", opacity: syncing === p.id ? .5 : 1 }}>{syncing === p.id ? "Syncing..." : "Sync Services"}</button>}
                </div>
              </div>

              {pResult && (
                <div style={{ marginTop: 10, padding: "8px 12px", borderRadius: 8, fontSize: 12, background: pResult.type === "success" ? (dark ? "rgba(110,231,183,.08)" : "#ecfdf5") : (dark ? "rgba(220,38,38,.08)" : "#fef2f2"), color: pResult.type === "success" ? (dark ? "#6ee7b7" : "#059669") : (dark ? "#fca5a5" : "#dc2626") }}>
                  {pResult.type === "success" ? "✓" : "⚠️"} {pResult.message}
                </div>
              )}

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginTop: 14, paddingTop: 14, borderTop: `1px solid ${t.cardBorder}`, fontSize: 13 }}>
                <div><span style={{ color: t.textMuted }}>Env var:</span> <span className="m" style={{ color: t.textSoft }}>{p.envKey}</span></div>
                <div><span style={{ color: t.textMuted }}>Services:</span> <span className="m" style={{ color: t.text }}>{p.id === "mtp" ? svcCount.toLocaleString() : "—"}</span></div>
                <div><span style={{ color: t.textMuted }}>Priority:</span> <span className="m" style={{ color: t.text }}>{i + 1}</span></div>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
