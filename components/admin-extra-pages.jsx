'use client';
import { useState, useEffect } from "react";
import { useConfirm } from "./confirm-dialog";

const fN = (a) => `₦${Math.abs(a).toLocaleString("en-NG")}`;
const fD = (d) => new Date(d).toLocaleDateString("en-NG", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });

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
        <div className="adm-title" style={{ color: t.text }}>Activity Log</div>
        <div className="adm-subtitle" style={{ color: t.textMuted }}>Admin audit trail — {logs.length} entries</div>
        <div className="page-divider" style={{ background: t.cardBorder }} />
      </div>

      <div className="adm-filters">
        <button onClick={() => setFilter("all")} className="adm-filter-pill" style={{ borderWidth: 1, borderStyle: "solid", borderColor: filter === "all" ? t.accent : t.cardBorder, background: filter === "all" ? (dark ? "#2a1a22" : "#fdf2f4") : "transparent", color: filter === "all" ? t.accent : t.textMuted }}>All ({logs.length})</button>
        {types.map(ty => (
          <button key={ty} onClick={() => setFilter(ty)} className="adm-filter-pill" style={{ borderWidth: 1, borderStyle: "solid", borderColor: filter === ty ? t.accent : t.cardBorder, background: filter === ty ? (dark ? "#2a1a22" : "#fdf2f4") : "transparent", color: filter === ty ? t.accent : t.textMuted }}>{ty} ({logs.filter(l => l.type === ty).length})</button>
        ))}
      </div>

      <div className="adm-card" style={{ background: dark ? "rgba(255,255,255,.06)" : "rgba(255,255,255,.95)", borderWidth: 1, borderStyle: "solid", borderColor: dark ? "rgba(255,255,255,.06)" : "rgba(0,0,0,.06)", boxShadow: dark ? "0 4px 20px rgba(0,0,0,.25)" : "0 4px 20px rgba(0,0,0,.04)" }}>
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
/* ═══ TEAM MANAGEMENT                     ═══ */
/* ═══════════════════════════════════════════ */
export function AdminTeamPage({ dark, t }) {
  const confirm = useConfirm();
  const [admins, setAdmins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPw, setNewPw] = useState("");
  const [newRole, setNewRole] = useState("admin");

  useEffect(() => {
    fetch("/api/admin/team").then(r => r.json()).then(d => { setAdmins(d.admins || []); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  const createAdmin = async () => {
    if (!newName.trim() || !newEmail.trim() || !newPw.trim()) return;
    try {
      const res = await fetch("/api/admin/team", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "create", name: newName, email: newEmail, password: newPw, role: newRole }) });
      if (res.ok) { setShowAdd(false); setNewName(""); setNewEmail(""); setNewPw(""); fetch("/api/admin/team").then(r => r.json()).then(d => setAdmins(d.admins || [])); }
    } catch {}
  };

  const toggleStatus = async (id) => {
    try {
      const res = await fetch("/api/admin/team", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "toggleStatus", adminId: id }) });
      const data = await res.json();
      if (data.success) setAdmins(prev => prev.map(a => a.id === id ? { ...a, status: data.status } : a));
    } catch {}
  };

  const changeRole = async (id, role) => {
    try {
      await fetch("/api/admin/team", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "updateRole", adminId: id, role }) });
      setAdmins(prev => prev.map(a => a.id === id ? { ...a, role } : a));
    } catch {}
  };

  const inputStyle = { width: "100%", padding: "10px 14px", borderRadius: 8, borderWidth: 1, borderStyle: "solid", borderColor: t.cardBorder, background: dark ? "#0d1020" : "#fff", color: t.text, fontSize: 14, outline: "none", boxSizing: "border-box", fontFamily: "inherit" };

  return (
    <>
      <div className="adm-header">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <div className="adm-title" style={{ color: t.text }}>Team</div>
            <div className="adm-subtitle" style={{ color: t.textMuted }}>Manage admin accounts and roles</div>
          </div>
          <button onClick={() => setShowAdd(!showAdd)} className="adm-btn-primary">{showAdd ? "Cancel" : "+ Add Admin"}</button>
        </div>
        <div className="page-divider" style={{ background: t.cardBorder }} />
      </div>

      {showAdd && (
        <div className="adm-card" style={{ background: dark ? "rgba(255,255,255,.06)" : "rgba(255,255,255,.95)", borderWidth: 1, borderStyle: "solid", borderColor: dark ? "rgba(255,255,255,.06)" : "rgba(0,0,0,.06)", padding: 18, marginTop: 16, marginBottom: 16, boxShadow: dark ? "0 4px 20px rgba(0,0,0,.25)" : "0 4px 20px rgba(0,0,0,.04)", borderRadius: 14 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
            <div><label style={{ fontSize: 13, color: t.textMuted, display: "block", marginBottom: 4 }}>Name</label><input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Full name" style={inputStyle} /></div>
            <div><label style={{ fontSize: 13, color: t.textMuted, display: "block", marginBottom: 4 }}>Email</label><input value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder="admin@nitro.ng" type="email" style={inputStyle} /></div>
            <div><label style={{ fontSize: 13, color: t.textMuted, display: "block", marginBottom: 4 }}>Password</label><input value={newPw} onChange={e => setNewPw(e.target.value)} placeholder="Password" type="password" style={inputStyle} /></div>
            <div><label style={{ fontSize: 13, color: t.textMuted, display: "block", marginBottom: 4 }}>Role</label>
              <div style={{ display: "flex", gap: 4 }}>
                {["admin", "support", "finance"].map(r => (
                  <button key={r} onClick={() => setNewRole(r)} className="adm-filter-pill" style={{ borderWidth: 1, borderStyle: "solid", borderColor: newRole === r ? t.accent : t.cardBorder, background: newRole === r ? (dark ? "#2a1a22" : "#fdf2f4") : "transparent", color: newRole === r ? t.accent : t.textMuted, textTransform: "capitalize" }}>{r}</button>
                ))}
              </div>
            </div>
          </div>
          <button onClick={createAdmin} className="adm-btn-primary" style={{ opacity: newName && newEmail && newPw ? 1 : .4 }}>Create Admin</button>
        </div>
      )}

      <div className="adm-card" style={{ background: dark ? "rgba(255,255,255,.06)" : "rgba(255,255,255,.95)", borderWidth: 1, borderStyle: "solid", borderColor: dark ? "rgba(255,255,255,.06)" : "rgba(0,0,0,.06)", boxShadow: dark ? "0 4px 20px rgba(0,0,0,.25)" : "0 4px 20px rgba(0,0,0,.04)", marginTop: showAdd ? 0 : 16 }}>
        {loading ? (
          <div className="adm-empty" style={{ color: t.textMuted }}>Loading team...</div>
        ) : admins.map((a, i) => (
          <div key={a.id} className="adm-list-row" style={{ borderBottom: i < admins.length - 1 ? `1px solid ${t.cardBorder}` : "none", flexWrap: "wrap", gap: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, minWidth: 180 }}>
              <div className="adm-user-avatar" style={{ background: ROLE_COLORS[a.role] || "#888" }}>{(a.name || "A")[0]}</div>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 14, fontWeight: 500, color: t.text }}>{a.name}</span>
                  <span className="m" style={{ fontSize: 11, padding: "1px 6px", borderRadius: 4, fontWeight: 600, background: `${ROLE_COLORS[a.role] || "#888"}20`, color: ROLE_COLORS[a.role] || "#888", textTransform: "capitalize" }}>{a.role}</span>
                  {a.status !== "Active" && <span style={{ fontSize: 11, padding: "1px 6px", borderRadius: 4, background: dark ? "rgba(252,165,165,.1)" : "rgba(220,38,38,.06)", color: t.red, fontWeight: 600 }}>Inactive</span>}
                </div>
                <div style={{ fontSize: 13, color: t.textMuted, marginTop: 1 }}>{a.email}</div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 4, alignItems: "center", flexWrap: "wrap" }}>
              <span style={{ fontSize: 12, color: t.textMuted }}>Last active: {a.lastActive ? fD(a.lastActive) : "Never"}</span>
              <select value={a.role} onChange={e => changeRole(a.id, e.target.value)} style={{ padding: "3px 8px", borderRadius: 6, background: dark ? "#0d1020" : "#fff", borderWidth: 1, borderStyle: "solid", borderColor: t.cardBorder, color: t.text, fontSize: 13, outline: "none" }}>
                {["superadmin", "admin", "support", "finance"].map(r => <option key={r} value={r}>{r}</option>)}
              </select>
              <button onClick={async () => { const ok = await confirm({ title: a.status === "Active" ? "Deactivate Admin" : "Activate Admin", message: a.status === "Active" ? `Deactivate ${a.name}? They will lose admin access.` : `Reactivate ${a.name}'s admin access?`, confirmLabel: a.status === "Active" ? "Deactivate" : "Activate", danger: a.status === "Active" }); if (ok) toggleStatus(a.id); }} className="adm-btn-sm" style={{ borderColor: t.cardBorder, color: a.status === "Active" ? t.red : t.green }}>{a.status === "Active" ? "Deactivate" : "Activate"}</button>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

/* ═══════════════════════════════════════════ */
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
        <div className="adm-card" style={{ background: dark ? "rgba(255,255,255,.06)" : "rgba(255,255,255,.95)", borderWidth: 1, borderStyle: "solid", borderColor: dark ? "rgba(255,255,255,.06)" : "rgba(0,0,0,.06)", padding: 18, marginTop: 16, marginBottom: 16, boxShadow: dark ? "0 4px 20px rgba(0,0,0,.25)" : "0 4px 20px rgba(0,0,0,.04)", borderRadius: 14 }}>
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

      <div className="adm-card" style={{ background: dark ? "rgba(255,255,255,.06)" : "rgba(255,255,255,.95)", borderWidth: 1, borderStyle: "solid", borderColor: dark ? "rgba(255,255,255,.06)" : "rgba(0,0,0,.06)", boxShadow: dark ? "0 4px 20px rgba(0,0,0,.25)" : "0 4px 20px rgba(0,0,0,.04)", marginTop: showAdd ? 0 : 16 }}>
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

  useEffect(() => {
    fetch("/api/admin/notifications").then(r => r.json()).then(d => { setHistory(d.history || []); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  const send = async () => {
    if (!message.trim()) return;
    try {
      const res = await fetch("/api/admin/notifications", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ subject, message, target }) });
      if (res.ok) { setSubject(""); setMessage(""); fetch("/api/admin/notifications").then(r => r.json()).then(d => setHistory(d.history || [])); }
    } catch {}
  };

  const inputStyle = { width: "100%", padding: "10px 14px", borderRadius: 8, borderWidth: 1, borderStyle: "solid", borderColor: t.cardBorder, background: dark ? "#0d1020" : "#fff", color: t.text, fontSize: 14, outline: "none", boxSizing: "border-box", fontFamily: "inherit" };

  return (
    <>
      <div className="adm-header">
        <div className="adm-title" style={{ color: t.text }}>Notifications</div>
        <div className="adm-subtitle" style={{ color: t.textMuted }}>Send announcements to users</div>
        <div className="page-divider" style={{ background: t.cardBorder }} />
      </div>

      {/* Compose */}
      <div className="adm-card" style={{ background: dark ? "rgba(255,255,255,.06)" : "rgba(255,255,255,.95)", borderWidth: 1, borderStyle: "solid", borderColor: dark ? "rgba(255,255,255,.06)" : "rgba(0,0,0,.06)", padding: 18, marginTop: 16, marginBottom: 20, boxShadow: dark ? "0 4px 20px rgba(0,0,0,.25)" : "0 4px 20px rgba(0,0,0,.04)", borderRadius: 14 }}>
        <div style={{ fontSize: 15, fontWeight: 600, color: t.text, marginBottom: 12 }}>Compose Notification</div>
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
          <button onClick={send} className="adm-btn-primary" style={{ opacity: message.trim() ? 1 : .4 }}>Send Notification</button>
        </div>
      </div>

      {/* History */}
      <div className="adm-section-title" style={{ color: t.textMuted, marginBottom: 10 }}>Sent History</div>
      <div className="adm-card" style={{ background: dark ? "rgba(255,255,255,.06)" : "rgba(255,255,255,.95)", borderWidth: 1, borderStyle: "solid", borderColor: dark ? "rgba(255,255,255,.06)" : "rgba(0,0,0,.06)", boxShadow: dark ? "0 4px 20px rgba(0,0,0,.25)" : "0 4px 20px rgba(0,0,0,.04)" }}>
        {loading ? (
          <div className="adm-empty" style={{ color: t.textMuted }}>Loading...</div>
        ) : history.length > 0 ? history.map((n, i) => (
          <div key={n.id} className="adm-list-row" style={{ borderBottom: i < history.length - 1 ? `1px solid ${t.cardBorder}` : "none" }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 500, color: t.text }}>{n.subject || "Notification"}</div>
              <div style={{ fontSize: 13, color: t.textSoft, marginTop: 2 }}>{n.message}</div>
              <div style={{ fontSize: 12, color: t.textMuted, marginTop: 4 }}>To: {n.target} · By: {n.sentBy} · {n.sentAt ? fD(n.sentAt) : ""}</div>
            </div>
            <span className="m" style={{ fontSize: 11, padding: "2px 7px", borderRadius: 4, fontWeight: 600, background: n.status === "sent" ? (dark ? "rgba(110,231,183,.1)" : "rgba(5,150,105,.06)") : (dark ? "rgba(252,211,77,.1)" : "rgba(217,119,6,.06)"), color: n.status === "sent" ? t.green : t.amber }}>{n.status}</span>
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
      await fetch("/api/admin/maintenance", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ enabled: e, message: msg, durationMinutes: mins, estimatedReturn: formatDuration(mins) }) });
      if (newEnabled !== undefined) setEnabled(e);
    } catch {}
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
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 700, color: t.text, marginBottom: 4 }}>Platform Status</div>
                <div style={{ fontSize: 14, color: t.textMuted }}>{enabled ? "⚠️ Platform is currently offline" : "✅ Platform is online and operational"}</div>
              </div>
              <button onClick={() => { setEnabled(!enabled); }} style={{ width: 52, height: 28, borderRadius: 14, position: "relative", border: "none", cursor: "pointer", background: enabled ? "rgba(252,165,165,.2)" : (dark ? "rgba(110,231,183,.15)" : "rgba(5,150,105,.1)"), borderWidth: 1, borderStyle: "solid", borderColor: enabled ? (dark ? "rgba(252,165,165,.3)" : "rgba(220,38,38,.2)") : (dark ? "rgba(110,231,183,.3)" : "rgba(5,150,105,.2)") }}>
                <div style={{ width: 22, height: 22, borderRadius: "50%", position: "absolute", top: 2, left: enabled ? 27 : 3, transition: "left .3s ease", background: enabled ? (dark ? "#fca5a5" : "#dc2626") : (dark ? "#6ee7b7" : "#059669") }} />
              </button>
            </div>

            {/* Duration presets */}
            <div style={{ fontSize: 12, fontWeight: 600, color: t.textMuted, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 12 }}>Estimated Duration</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginBottom: 12 }}>
              {PRESETS.map(p => {
                const active = !useCustom && duration === p.m;
                return (<button key={p.m} onClick={() => { setDuration(p.m); setUseCustom(false); }} className="m" style={{ padding: "10px 0", borderRadius: 10, fontSize: 13, fontWeight: 600, textAlign: "center", borderWidth: active ? 2 : 1, borderStyle: "solid", borderColor: active ? t.accent : t.cardBorder, background: active ? (dark ? "rgba(196,125,142,.1)" : "rgba(196,125,142,.06)") : "transparent", color: active ? t.accent : t.textSoft, cursor: "pointer" }}>{p.label}</button>);
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
          <button onClick={() => save()} style={{ width: "100%", padding: "12px 0", borderRadius: 10, marginTop: 10, background: "none", color: t.textSoft, fontSize: 14, fontWeight: 500, cursor: "pointer", borderWidth: 1, borderStyle: "solid", borderColor: t.cardBorder }}>Save Settings</button>
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
      if (res.ok) setResult({ id: provider.id, type: "success", message: `Connected! MTP provider balance: $${data.balance?.balance || "0"} USD` });
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
            <div key={p.id} className="adm-card" style={{ background: dark ? "rgba(255,255,255,.06)" : "rgba(255,255,255,.95)", borderWidth: 1, borderStyle: "solid", borderColor: dark ? "rgba(255,255,255,.06)" : "rgba(0,0,0,.06)", padding: 18, marginBottom: 12, boxShadow: dark ? "0 4px 20px rgba(0,0,0,.25)" : "0 4px 20px rgba(0,0,0,.04)", borderRadius: 14 }}>
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
