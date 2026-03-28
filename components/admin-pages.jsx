'use client';
import { useState, useEffect } from "react";
import { useConfirm } from "./confirm-dialog";

const fN = (a) => `₦${Math.abs(a).toLocaleString("en-NG")}`;
const fD = (d) => new Date(d).toLocaleDateString("en-NG", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });

/* ═══════════════════════════════════════════ */
/* ═══ PAYMENTS PAGE                       ═══ */
/* ═══════════════════════════════════════════ */
export function AdminPaymentsPage({ dark, t }) {
  const [gateways, setGateways] = useState([
    { id: "paystack", name: "Paystack", desc: "Cards, Bank Transfer, USSD", enabled: true, priority: 1 },
    { id: "flutterwave", name: "Flutterwave", desc: "Cards, Bank Transfer, Mobile Money", enabled: true, priority: 2 },
    { id: "alatpay", name: "ALATPay (Wema)", desc: "Direct bank debit, web payment", enabled: true, priority: 3 },
    { id: "crypto", name: "Crypto", desc: "USDT, BTC, ETH", enabled: false, priority: 4 },
    { id: "monnify", name: "Monnify", desc: "Auto-confirmed bank transfer", enabled: false, priority: 5 },
  ]);

  const toggleGateway = (id) => {
    setGateways(prev => prev.map(g => g.id === id ? { ...g, enabled: !g.enabled } : g));
  };

  return (
    <>
      <div className="adm-header">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <div className="adm-title" style={{ color: t.text }}>Payments</div>
            <div className="adm-subtitle" style={{ color: t.textMuted }}>Manage payment gateways</div>
          </div>
          <button className="adm-btn-primary">+ Add Gateway</button>
        </div>
        <div className="page-divider" style={{ background: t.cardBorder }} />
      </div>

      <div className="adm-section-title" style={{ color: t.textMuted, marginTop: 16, marginBottom: 10 }}>Payment Gateways</div>
      <div className="adm-card" style={{ background: dark ? "rgba(255,255,255,.06)" : "rgba(255,255,255,.95)", borderWidth: 1, borderStyle: "solid", borderColor: dark ? "rgba(255,255,255,.06)" : "rgba(0,0,0,.06)", boxShadow: dark ? "0 4px 20px rgba(0,0,0,.25)" : "0 4px 20px rgba(0,0,0,.04)" }}>
        {gateways.map((g, i) => (
          <div key={g.id} className="adm-list-row" style={{ borderBottom: i < gateways.length - 1 ? `1px solid ${t.cardBorder}` : "none", flexWrap: "wrap", gap: 10 }}>
            <div style={{ flex: 1, minWidth: 160 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 14, fontWeight: 500, color: t.text }}>{g.name}</span>
                <span className="m" style={{ fontSize: 11, padding: "1px 6px", borderRadius: 4, fontWeight: 600, background: g.enabled ? (dark ? "rgba(110,231,183,.1)" : "rgba(5,150,105,.06)") : (dark ? "rgba(252,165,165,.1)" : "rgba(220,38,38,.06)"), color: g.enabled ? t.green : t.red }}>{g.enabled ? "Active" : "Disabled"}</span>
              </div>
              <div style={{ fontSize: 13, color: t.textMuted, marginTop: 2 }}>{g.desc}</div>
            </div>
            <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
              <span className="m" style={{ fontSize: 12, color: t.textMuted }}>Priority: {g.priority}</span>
              <button onClick={() => toggleGateway(g.id)} className="adm-btn-sm" style={{ borderColor: t.cardBorder, color: g.enabled ? t.red : t.green }}>{g.enabled ? "Disable" : "Enable"}</button>
              <button className="adm-btn-sm" style={{ borderColor: t.cardBorder, color: t.accent }}>Configure</button>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

/* ═══════════════════════════════════════════ */
/* ═══ ANALYTICS PAGE                      ═══ */
/* ═══════════════════════════════════════════ */
export function AdminAnalyticsPage({ dark, t }) {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/analytics").then(r => r.json()).then(d => { setStats(d); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  if (loading) return <><div className="adm-header"><div className="adm-title" style={{ color: t.text }}>Analytics</div><div className="adm-subtitle" style={{ color: t.textMuted }}>Loading...</div><div className="page-divider" style={{ background: t.cardBorder }} /></div></>;

  const s = stats || {};
  return (
    <>
      <div className="adm-header">
        <div className="adm-title" style={{ color: t.text }}>Analytics</div>
        <div className="adm-subtitle" style={{ color: t.textMuted }}>Revenue, growth, and performance</div>
        <div className="page-divider" style={{ background: t.cardBorder }} />
      </div>

      <div className="adm-stats" style={{ marginTop: 16 }}>
        {[
          ["Total Revenue", fN(s.totalRevenue || 0), t.green],
          ["Total Cost", fN(s.totalCost || 0), t.red],
          ["Profit", fN(s.profit || 0), t.green],
          ["Avg Order Value", fN(s.avgOrderValue || 0), t.accent],
          ["Conversion Rate", `${s.conversionRate || 0}%`, t.blue],
        ].map(([label, val, color]) => (
          <div key={label} className="dash-stat-card" style={{ background: dark ? "rgba(255,255,255,.06)" : "rgba(255,255,255,.95)", borderTopWidth: 1, borderRightWidth: 1, borderBottomWidth: 1, borderLeftWidth: 3, borderStyle: "solid", borderTopColor: dark ? "rgba(255,255,255,.06)" : "rgba(0,0,0,.06)", borderRightColor: dark ? "rgba(255,255,255,.06)" : "rgba(0,0,0,.06)", borderBottomColor: dark ? "rgba(255,255,255,.06)" : "rgba(0,0,0,.06)", borderLeftColor: color, boxShadow: dark ? "0 4px 20px rgba(0,0,0,.25)" : "0 4px 20px rgba(0,0,0,.04)" }}>
            <div className="dash-stat-label" style={{ color: t.textMuted }}>{label}</div>
            <div className="m dash-stat-value" style={{ color }}>{val}</div>
          </div>
        ))}
      </div>

      <div className="adm-grid-2" style={{ marginTop: 24 }}>
        <div>
          <div className="adm-section-title" style={{ color: t.textMuted, marginBottom: 10 }}>Top Platforms</div>
          <div className="adm-card" style={{ background: dark ? "rgba(255,255,255,.06)" : "rgba(255,255,255,.95)", borderWidth: 1, borderStyle: "solid", borderColor: dark ? "rgba(255,255,255,.06)" : "rgba(0,0,0,.06)", boxShadow: dark ? "0 4px 20px rgba(0,0,0,.25)" : "0 4px 20px rgba(0,0,0,.04)" }}>
            {(s.topPlatforms || [{ name: "Instagram", orders: 0, revenue: 0 }, { name: "TikTok", orders: 0, revenue: 0 }, { name: "YouTube", orders: 0, revenue: 0 }]).map((p, i, arr) => (
              <div key={p.name} className="adm-list-row" style={{ borderBottom: i < arr.length - 1 ? `1px solid ${t.cardBorder}` : "none" }}>
                <div><div style={{ fontSize: 14, fontWeight: 500, color: t.text }}>{p.name}</div><div style={{ fontSize: 13, color: t.textMuted }}>{p.orders} orders</div></div>
                <div className="m" style={{ fontSize: 14, fontWeight: 600, color: t.green }}>{fN(p.revenue || 0)}</div>
              </div>
            ))}
          </div>
        </div>
        <div>
          <div className="adm-section-title" style={{ color: t.textMuted, marginBottom: 10 }}>Order Status Breakdown</div>
          <div className="adm-card" style={{ background: dark ? "rgba(255,255,255,.06)" : "rgba(255,255,255,.95)", borderWidth: 1, borderStyle: "solid", borderColor: dark ? "rgba(255,255,255,.06)" : "rgba(0,0,0,.06)", boxShadow: dark ? "0 4px 20px rgba(0,0,0,.25)" : "0 4px 20px rgba(0,0,0,.04)" }}>
            {[["Completed", s.byStatus?.find(x => x.status === "Completed")?.count || 0, t.green], ["Processing", s.byStatus?.find(x => x.status === "Processing")?.count || 0, t.blue], ["Pending", s.byStatus?.find(x => x.status === "Pending")?.count || 0, t.amber], ["Canceled", s.byStatus?.find(x => x.status === "Canceled")?.count || 0, t.red]].map(([label, count, color], i, arr) => (
              <div key={label} className="adm-list-row" style={{ borderBottom: i < arr.length - 1 ? `1px solid ${t.cardBorder}` : "none" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ width: 8, height: 8, borderRadius: 4, background: color }} />
                  <span style={{ fontSize: 14, color: t.text }}>{label}</span>
                </div>
                <span className="m" style={{ fontSize: 14, fontWeight: 600, color }}>{count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

/* ═══════════════════════════════════════════ */
/* ═══ ALERTS PAGE                         ═══ */
/* ═══════════════════════════════════════════ */
export function AdminAlertsPage({ dark, t }) {
  const confirm = useConfirm();
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [newMsg, setNewMsg] = useState("");
  const [newType, setNewType] = useState("info");
  const [newTarget, setNewTarget] = useState("both");

  useEffect(() => {
    fetch("/api/admin/alerts").then(r => r.json()).then(d => { setAlerts(d.alerts || []); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  const createAlert = async () => {
    if (!newMsg.trim()) return;
    try {
      const res = await fetch("/api/admin/alerts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "create", message: newMsg, type: newType, target: newTarget }) });
      const data = await res.json();
      if (res.ok && data.alert) { setAlerts(prev => [data.alert, ...prev]); setNewMsg(""); setShowNew(false); }
    } catch {}
  };

  const toggleAlert = async (id, active) => {
    try {
      await fetch("/api/admin/alerts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "toggle", id }) });
      setAlerts(prev => prev.map(a => a.id === id ? { ...a, active: !active } : a));
    } catch {}
  };

  const deleteAlert = async (id) => {
    try {
      await fetch("/api/admin/alerts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "delete", id }) });
      setAlerts(prev => prev.filter(a => a.id !== id));
    } catch {}
  };

  return (
    <>
      <div className="adm-header">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <div className="adm-title" style={{ color: t.text }}>Alerts</div>
            <div className="adm-subtitle" style={{ color: t.textMuted }}>User-facing notifications and banners</div>
          </div>
          <button onClick={() => setShowNew(!showNew)} className="adm-btn-primary">{showNew ? "Cancel" : "+ New Alert"}</button>
        </div>
        <div className="page-divider" style={{ background: t.cardBorder }} />
      </div>

      {showNew && (
        <div className="adm-card" style={{ background: dark ? "rgba(255,255,255,.06)" : "rgba(255,255,255,.95)", borderWidth: 1, borderStyle: "solid", borderColor: dark ? "rgba(255,255,255,.06)" : "rgba(0,0,0,.06)", padding: 18, marginTop: 16, marginBottom: 16, boxShadow: dark ? "0 4px 20px rgba(0,0,0,.25)" : "0 4px 20px rgba(0,0,0,.04)", borderRadius: 14 }}>
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 13, color: t.textMuted, display: "block", marginBottom: 4 }}>Message</label>
            <textarea value={newMsg} onChange={e => setNewMsg(e.target.value)} placeholder="Alert message..." rows={2} style={{ width: "100%", padding: "10px 14px", borderRadius: 8, borderWidth: 1, borderStyle: "solid", borderColor: t.cardBorder, background: dark ? "#0d1020" : "#fff", color: t.text, fontSize: 14, outline: "none", resize: "vertical", fontFamily: "inherit", boxSizing: "border-box" }} />
          </div>
          <div style={{ display: "flex", gap: 12, marginBottom: 12, flexWrap: "wrap" }}>
            <div>
              <label style={{ fontSize: 13, color: t.textMuted, display: "block", marginBottom: 4 }}>Type</label>
              <div style={{ display: "flex", gap: 4 }}>
                {["info", "warning"].map(ty => (
                  <button key={ty} onClick={() => setNewType(ty)} className="adm-filter-pill" style={{ borderWidth: 1, borderStyle: "solid", borderColor: newType === ty ? t.accent : t.cardBorder, background: newType === ty ? (dark ? "#2a1a22" : "#fdf2f4") : "transparent", color: newType === ty ? t.accent : t.textMuted }}>{ty}</button>
                ))}
              </div>
            </div>
            <div>
              <label style={{ fontSize: 13, color: t.textMuted, display: "block", marginBottom: 4 }}>Show on</label>
              <div style={{ display: "flex", gap: 4 }}>
                {["both", "dashboard", "login"].map(tg => (
                  <button key={tg} onClick={() => setNewTarget(tg)} className="adm-filter-pill" style={{ borderWidth: 1, borderStyle: "solid", borderColor: newTarget === tg ? t.accent : t.cardBorder, background: newTarget === tg ? (dark ? "#2a1a22" : "#fdf2f4") : "transparent", color: newTarget === tg ? t.accent : t.textMuted }}>{tg}</button>
                ))}
              </div>
            </div>
          </div>
          <button onClick={createAlert} className="adm-btn-primary" style={{ opacity: newMsg.trim() ? 1 : .4 }}>Create Alert</button>
        </div>
      )}

      <div className="adm-card" style={{ background: dark ? "rgba(255,255,255,.06)" : "rgba(255,255,255,.95)", borderWidth: 1, borderStyle: "solid", borderColor: dark ? "rgba(255,255,255,.06)" : "rgba(0,0,0,.06)", boxShadow: dark ? "0 4px 20px rgba(0,0,0,.25)" : "0 4px 20px rgba(0,0,0,.04)", marginTop: showNew ? 0 : 16 }}>
        {loading ? (
          <div className="adm-empty" style={{ color: t.textMuted }}>Loading alerts...</div>
        ) : alerts.length > 0 ? alerts.map((a, i) => (
          <div key={`${a.id}-${i}`} className="adm-list-row" style={{ borderBottom: i < alerts.length - 1 ? `1px solid ${t.cardBorder}` : "none" }}>
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 15 }}>{a.type === "warning" ? "⚠️" : "📢"}</span>
                <span style={{ fontSize: 14, fontWeight: 500, color: t.text, opacity: a.active ? 1 : .5 }}>{a.message}</span>
              </div>
              <div style={{ fontSize: 12, color: t.textMuted, marginTop: 3, paddingLeft: 26 }}>Target: {a.target} · {a.active ? "Active" : "Inactive"} · {a.created ? fD(a.created) : ""}</div>
            </div>
            <div style={{ display: "flex", gap: 4 }}>
              <button onClick={() => toggleAlert(a.id, a.active)} className="adm-btn-sm" style={{ borderColor: t.cardBorder, color: a.active ? t.amber : t.green }}>{a.active ? "Pause" : "Activate"}</button>
              <button onClick={async () => { const ok = await confirm({ title: "Delete Alert", message: `Delete this alert? "${a.message?.slice(0, 50)}..."`, confirmLabel: "Delete", danger: true }); if (ok) deleteAlert(a.id); }} className="adm-btn-sm" style={{ borderColor: dark ? "rgba(252,165,165,.2)" : "rgba(220,38,38,.15)", color: t.red }}>Delete</button>
            </div>
          </div>
        )) : (
          <div className="adm-empty" style={{ color: t.textMuted }}>No alerts</div>
        )}
      </div>
    </>
  );
}

/* ═══════════════════════════════════════════ */
/* ═══ SETTINGS PAGE                       ═══ */
/* ═══════════════════════════════════════════ */
export function AdminSettingsPage({ admin, dark, t, themeMode, setThemeMode, setDark }) {
  const applyTheme = (mode) => {
    setThemeMode(mode);
    localStorage.setItem("nitro-admin-theme", mode);
    if (mode === "day") setDark(false);
    else if (mode === "night") setDark(true);
    else { const h = new Date().getHours(); setDark(h >= 19 || h < 7); }
  };

  return (
    <>
      <div className="adm-header">
        <div className="adm-title" style={{ color: t.text }}>Settings</div>
        <div className="adm-subtitle" style={{ color: t.textMuted }}>Admin preferences and configuration</div>
        <div className="page-divider" style={{ background: t.cardBorder }} />
      </div>

      <div style={{ maxWidth: 550, marginTop: 16 }}>
        {/* Profile */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: t.text, marginBottom: 10 }}>Profile</div>
          <div className="adm-card" style={{ background: dark ? "rgba(255,255,255,.06)" : "rgba(255,255,255,.95)", borderWidth: 1, borderStyle: "solid", borderColor: dark ? "rgba(255,255,255,.06)" : "rgba(0,0,0,.06)", padding: 18, borderRadius: 14, boxShadow: dark ? "0 4px 20px rgba(0,0,0,.25)" : "0 4px 20px rgba(0,0,0,.04)" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              {[["Name", admin?.name || "Admin"], ["Email", admin?.email || ""], ["Role", admin?.role || "admin"]].map(([label, val]) => (
                <div key={label}><div style={{ fontSize: 12, color: t.textMuted, textTransform: "uppercase", letterSpacing: .8, marginBottom: 3 }}>{label}</div><div style={{ fontSize: 14, fontWeight: 500, color: t.text }}>{val}</div></div>
              ))}
            </div>
          </div>
        </div>

        {/* Theme */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: t.text, marginBottom: 10 }}>Theme</div>
          <div style={{ display: "flex", gap: 8 }}>
            {[["day", "☀ Light"], ["night", "☾ Dark"], ["auto", "◑ Auto"]].map(([id, lb]) => (
              <button key={id} onClick={() => applyTheme(id)} style={{ flex: 1, padding: "12px 10px", borderRadius: 10, borderWidth: themeMode === id ? 2 : 1, borderStyle: "solid", borderColor: themeMode === id ? t.accent : t.cardBorder, background: themeMode === id ? (dark ? "#2a1a22" : "#fdf2f4") : (dark ? "rgba(255,255,255,.04)" : "rgba(255,255,255,.8)"), color: themeMode === id ? t.accent : t.textSoft, fontSize: 14, fontWeight: themeMode === id ? 600 : 450, textAlign: "center" }}>{lb}</button>
            ))}
          </div>
        </div>

        {/* Change password */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: t.text, marginBottom: 10 }}>Change Password</div>
          <div className="adm-card" style={{ background: dark ? "rgba(255,255,255,.06)" : "rgba(255,255,255,.95)", borderWidth: 1, borderStyle: "solid", borderColor: dark ? "rgba(255,255,255,.06)" : "rgba(0,0,0,.06)", padding: 18, borderRadius: 14, boxShadow: dark ? "0 4px 20px rgba(0,0,0,.25)" : "0 4px 20px rgba(0,0,0,.04)" }}>
            {["Current Password", "New Password", "Confirm Password"].map(label => (
              <div key={label} style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 13, color: t.textMuted, display: "block", marginBottom: 4 }}>{label}</label>
                <input type="password" style={{ width: "100%", padding: "10px 14px", borderRadius: 8, borderWidth: 1, borderStyle: "solid", borderColor: t.cardBorder, background: dark ? "#0d1020" : "#fff", color: t.text, fontSize: 14, outline: "none", boxSizing: "border-box" }} />
              </div>
            ))}
            <button className="adm-btn-primary">Update Password</button>
          </div>
        </div>
      </div>
    </>
  );
}
