'use client';
import { useState, useEffect } from "react";
import { useConfirm } from "./confirm-dialog";
import { fN, fD } from "../lib/format";


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
  const [range, setRange] = useState("30d");

  const load = (r) => {
    setLoading(true);
    fetch(`/api/admin/analytics?range=${r}`).then(res => res.json()).then(d => { setStats(d); setLoading(false); }).catch(() => setLoading(false));
  };
  useEffect(() => { load(range); }, []);

  const changeRange = (r) => { setRange(r); load(r); };

  if (loading) return <><div className="adm-header"><div className="adm-title" style={{ color: t.text }}>Analytics</div><div className="adm-subtitle" style={{ color: t.textMuted }}>Loading...</div><div className="page-divider" style={{ background: t.cardBorder }} /></div></>;

  const s = stats || {};
  return (
    <>
      <div className="adm-header">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 10 }}>
          <div>
            <div className="adm-title" style={{ color: t.text }}>Analytics</div>
            <div className="adm-subtitle" style={{ color: t.textMuted }}>Revenue, growth, and performance</div>
          </div>
          <div style={{ display: "flex", gap: 4 }}>
            {[["24h", "24h"], ["7d", "7 days"], ["30d", "30 days"], ["90d", "90 days"]].map(([id, lb]) => (
              <button key={id} onClick={() => changeRange(id)} style={{ padding: "6px 12px", borderRadius: 6, fontSize: 12, fontWeight: range === id ? 600 : 400, background: range === id ? (dark ? "#2a1a22" : "#fdf2f4") : "transparent", color: range === id ? t.accent : t.textMuted, borderWidth: 1, borderStyle: "solid", borderColor: range === id ? t.accent : t.cardBorder }}>{lb}</button>
            ))}
          </div>
        </div>
        <div className="page-divider" style={{ background: t.cardBorder }} />
      </div>

      <div className="adm-stats" style={{ marginTop: 16 }}>
        {[
          ["Total Revenue", fN(s.totalRevenue || 0), t.green],
          ["Total Cost", fN(s.totalCost || 0), dark ? "#fca5a5" : "#dc2626"],
          ["Profit", fN(s.profit || 0), s.profit >= 0 ? t.green : (dark ? "#fca5a5" : "#dc2626")],
          ["Avg Order Value", fN(s.avgOrderValue || 0), t.accent],
          ["Completion Rate", `${s.conversionRate || 0}%`, t.blue],
          ["Orders", String(s.orderCount || 0), t.amber],
          ["New Users", String(s.newUsers || 0), t.blue],
          ["Deposits", fN(s.totalDeposits || 0), t.green],
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
            {(s.topPlatforms || []).length > 0 ? s.topPlatforms.map((p, i, arr) => (
              <div key={p.name} className="adm-list-row" style={{ borderBottom: i < arr.length - 1 ? `1px solid ${t.cardBorder}` : "none" }}>
                <div><div style={{ fontSize: 14, fontWeight: 500, color: t.text }}>{p.name}</div><div style={{ fontSize: 13, color: t.textMuted }}>{p.orders} orders</div></div>
                <div className="m" style={{ fontSize: 14, fontWeight: 600, color: t.green }}>{fN(p.revenue || 0)}</div>
              </div>
            )) : <div className="adm-empty" style={{ color: t.textMuted }}>No platform data yet</div>}
          </div>
        </div>
        <div>
          <div className="adm-section-title" style={{ color: t.textMuted, marginBottom: 10 }}>Order Status Breakdown</div>
          <div className="adm-card" style={{ background: dark ? "rgba(255,255,255,.06)" : "rgba(255,255,255,.95)", borderWidth: 1, borderStyle: "solid", borderColor: dark ? "rgba(255,255,255,.06)" : "rgba(0,0,0,.06)", boxShadow: dark ? "0 4px 20px rgba(0,0,0,.25)" : "0 4px 20px rgba(0,0,0,.04)" }}>
            {[["Completed", s.byStatus?.find(x => x.status === "Completed")?.count || 0, t.green], ["Processing", s.byStatus?.find(x => x.status === "Processing")?.count || 0, t.blue], ["Pending", s.byStatus?.find(x => x.status === "Pending")?.count || 0, t.amber], ["Canceled", s.byStatus?.find(x => x.status === "Canceled")?.count || 0, dark ? "#fca5a5" : "#dc2626"]].map(([label, count, color], i, arr) => (
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

      {/* Top Services */}
      {(s.topServices || []).length > 0 && (
        <div style={{ marginTop: 24 }}>
          <div className="adm-section-title" style={{ color: t.textMuted, marginBottom: 10 }}>Top Services by Revenue</div>
          <div className="adm-card" style={{ background: dark ? "rgba(255,255,255,.06)" : "rgba(255,255,255,.95)", borderWidth: 1, borderStyle: "solid", borderColor: dark ? "rgba(255,255,255,.06)" : "rgba(0,0,0,.06)", boxShadow: dark ? "0 4px 20px rgba(0,0,0,.25)" : "0 4px 20px rgba(0,0,0,.04)" }}>
            {s.topServices.map((sv, i, arr) => (
              <div key={i} className="adm-list-row" style={{ borderBottom: i < arr.length - 1 ? `1px solid ${t.cardBorder}` : "none" }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 500, color: t.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{sv.name}</div>
                  <div style={{ fontSize: 12, color: t.textMuted }}>{sv.category} · {sv.orders} orders</div>
                </div>
                <div className="m" style={{ fontSize: 14, fontWeight: 600, color: t.green }}>{fN(sv.revenue || 0)}</div>
              </div>
            ))}
          </div>
        </div>
      )}
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
            <div className="adm-title" style={{ color: t.text }}>Announcements</div>
            <div className="adm-subtitle" style={{ color: t.textMuted }}>User-facing announcements and banners</div>
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
              <button onClick={async () => { const ok = await confirm({ title: "Delete Announcement", message: `Delete this alert? "${a.message?.slice(0, 50)}..."`, confirmLabel: "Delete", danger: true }); if (ok) deleteAlert(a.id); }} className="adm-btn-sm" style={{ borderColor: dark ? "rgba(252,165,165,.2)" : "rgba(220,38,38,.15)", color: t.red }}>Delete</button>
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
function CleanupButton({ dark, t }) {
  const [info, setInfo] = useState(null);
  const [cleaning, setCleaning] = useState(false);
  const [result, setResult] = useState(null);

  useEffect(() => {
    fetch("/api/admin/cleanup").then(r => r.json()).then(d => setInfo(d)).catch(() => {});
  }, []);

  const run = async () => {
    setCleaning(true); setResult(null);
    try {
      const res = await fetch("/api/admin/cleanup", { method: "POST" });
      const data = await res.json();
      setResult(res.ok ? { type: "success", text: data.message } : { type: "error", text: data.error });
      if (res.ok) fetch("/api/admin/cleanup").then(r => r.json()).then(d => setInfo(d)).catch(() => {});
    } catch { setResult({ type: "error", text: "Failed" }); }
    setCleaning(false);
  };

  return (
    <>
      {info && <div style={{ fontSize: 13, color: t.text, marginBottom: 10 }}>{info.unverifiedTotal || 0} unverified accounts total · {info.staleCount || 0} older than 7 days</div>}
      {result && <div style={{ padding: "8px 12px", borderRadius: 8, marginBottom: 10, fontSize: 13, background: result.type === "success" ? (dark ? "rgba(110,231,183,.08)" : "#ecfdf5") : (dark ? "rgba(220,38,38,.08)" : "#fef2f2"), color: result.type === "success" ? (dark ? "#6ee7b7" : "#059669") : (dark ? "#fca5a5" : "#dc2626") }}>{result.type === "success" ? "✓" : "⚠️"} {result.text}</div>}
      <button onClick={run} disabled={cleaning} className="adm-btn-primary" style={{ opacity: cleaning ? .5 : 1 }}>{cleaning ? "Cleaning..." : "Clean Up Stale Accounts"}</button>
    </>
  );
}

export function AdminSettingsPage({ admin, dark, t, themeMode, setThemeMode, setDark }) {
  const confirm = useConfirm();
  const [social, setSocial] = useState({ social_whatsapp: "", social_telegram: "", social_instagram: "", social_twitter: "", social_whatsapp_support: "" });
  const [refSettings, setRefSettings] = useState({ ref_referrer_bonus: "50000", ref_invitee_bonus: "50000" });
  const [socialLoading, setSocialLoading] = useState(true);
  const [socialSaving, setSocialSaving] = useState(false);
  const [socialMsg, setSocialMsg] = useState(null);
  const [refSaving, setRefSaving] = useState(false);
  const [refMsg, setRefMsg] = useState(null);

  useEffect(() => {
    fetch("/api/admin/settings").then(r => r.json()).then(d => {
      if (d.settings) {
        setSocial(prev => ({ ...prev, ...Object.fromEntries(Object.entries(d.settings).filter(([k]) => k.startsWith("social_"))) }));
        setRefSettings(prev => ({ ...prev, ...Object.fromEntries(Object.entries(d.settings).filter(([k]) => k.startsWith("ref_"))) }));
      }
    }).finally(() => setSocialLoading(false));
  }, []);

  const saveSocial = async () => {
    setSocialSaving(true); setSocialMsg(null);
    try {
      const res = await fetch("/api/admin/settings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ settings: social }) });
      const data = await res.json();
      setSocialMsg(res.ok ? { type: "success", text: "Social links saved" } : { type: "error", text: data.error || "Failed" });
    } catch { setSocialMsg({ type: "error", text: "Request failed" }); }
    setSocialSaving(false);
  };

  const applyTheme = (mode) => {
    setThemeMode(mode);
    try { localStorage.setItem("nitro-admin-theme", mode); } catch {}
    if (mode === "day") setDark(false);
    else if (mode === "night") setDark(true);
    else { const h = new Date().getHours(); setDark(h >= 19 || h < 7); }
  };

  // Profile edit
  const [editName, setEditName] = useState(admin?.name || "");
  const [editEmail, setEditEmail] = useState(admin?.email || "");
  const [profileEditing, setProfileEditing] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMsg, setProfileMsg] = useState(null);

  useEffect(() => { setEditName(admin?.name || ""); setEditEmail(admin?.email || ""); }, [admin?.name, admin?.email]);

  const saveProfile = async () => {
    setProfileSaving(true); setProfileMsg(null);
    try {
      const res = await fetch("/api/auth/admin/profile", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "update-profile", name: editName, email: editEmail }) });
      const data = await res.json();
      if (res.ok) { setProfileMsg({ type: "success", text: "Profile updated" }); setProfileEditing(false); } else setProfileMsg({ type: "error", text: data.error || "Failed" });
    } catch { setProfileMsg({ type: "error", text: "Request failed" }); }
    setProfileSaving(false);
  };

  // Change password
  const [admCurPw, setAdmCurPw] = useState("");
  const [admNewPw, setAdmNewPw] = useState("");
  const [admConfPw, setAdmConfPw] = useState("");
  const [pwSaving, setPwSaving] = useState(false);
  const [admPwMsg, setAdmPwMsg] = useState(null);

  const changeAdmPw = async () => {
    setAdmPwMsg(null);
    if (!admCurPw || !admNewPw || !admConfPw) { setAdmPwMsg({ type: "error", text: "All fields required" }); return; }
    if (admNewPw !== admConfPw) { setAdmPwMsg({ type: "error", text: "New passwords don't match" }); return; }
    if (admNewPw.length < 6) { setAdmPwMsg({ type: "error", text: "Minimum 6 characters" }); return; }
    setPwSaving(true);
    try {
      const res = await fetch("/api/auth/admin/profile", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "change-password", currentPassword: admCurPw, newPassword: admNewPw }) });
      const data = await res.json();
      if (res.ok) { setAdmPwMsg({ type: "success", text: "Password updated" }); setAdmCurPw(""); setAdmNewPw(""); setAdmConfPw(""); } else setAdmPwMsg({ type: "error", text: data.error || "Failed" });
    } catch { setAdmPwMsg({ type: "error", text: "Request failed" }); }
    setPwSaving(false);
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
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: t.text }}>Profile</div>
            {!profileEditing && <button onClick={() => setProfileEditing(true)} style={{ fontSize: 12, color: t.accent, background: "none", border: "none", cursor: "pointer" }}>Edit</button>}
          </div>
          <div className="adm-card" style={{ background: dark ? "rgba(255,255,255,.06)" : "rgba(255,255,255,.95)", borderWidth: 1, borderStyle: "solid", borderColor: dark ? "rgba(255,255,255,.06)" : "rgba(0,0,0,.06)", padding: 18, borderRadius: 14, boxShadow: dark ? "0 4px 20px rgba(0,0,0,.25)" : "0 4px 20px rgba(0,0,0,.04)" }}>
            {profileMsg && <div style={{ padding: "8px 12px", borderRadius: 8, marginBottom: 12, fontSize: 13, background: profileMsg.type === "success" ? (dark ? "rgba(110,231,183,.08)" : "#ecfdf5") : (dark ? "rgba(220,38,38,.08)" : "#fef2f2"), color: profileMsg.type === "success" ? (dark ? "#6ee7b7" : "#059669") : (dark ? "#fca5a5" : "#dc2626") }}>{profileMsg.type === "success" ? "✓" : "⚠️"} {profileMsg.text}</div>}
            {profileEditing ? (
              <>
                <div style={{ marginBottom: 12 }}>
                  <label style={{ fontSize: 13, color: t.textMuted, display: "block", marginBottom: 4 }}>Name</label>
                  <input value={editName} onChange={e => setEditName(e.target.value)} style={{ width: "100%", padding: "10px 14px", borderRadius: 8, borderWidth: 1, borderStyle: "solid", borderColor: t.cardBorder, background: dark ? "#0d1020" : "#fff", color: t.text, fontSize: 14, outline: "none", boxSizing: "border-box" }} />
                </div>
                <div style={{ marginBottom: 12 }}>
                  <label style={{ fontSize: 13, color: t.textMuted, display: "block", marginBottom: 4 }}>Email</label>
                  <input value={editEmail} onChange={e => setEditEmail(e.target.value)} style={{ width: "100%", padding: "10px 14px", borderRadius: 8, borderWidth: 1, borderStyle: "solid", borderColor: t.cardBorder, background: dark ? "#0d1020" : "#fff", color: t.text, fontSize: 14, outline: "none", boxSizing: "border-box" }} />
                </div>
                <div style={{ marginBottom: 8 }}>
                  <div style={{ fontSize: 12, color: t.textMuted, textTransform: "uppercase", letterSpacing: .8, marginBottom: 3 }}>Role</div>
                  <div style={{ fontSize: 14, fontWeight: 500, color: t.textMuted }}>{admin?.role || "admin"} (cannot be changed)</div>
                </div>
                <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
                  <button onClick={saveProfile} disabled={profileSaving} className="adm-btn-primary" style={{ opacity: profileSaving ? .5 : 1 }}>{profileSaving ? "Saving..." : "Save"}</button>
                  <button onClick={() => { setProfileEditing(false); setEditName(admin?.name || ""); setEditEmail(admin?.email || ""); setProfileMsg(null); }} style={{ padding: "8px 16px", borderRadius: 8, border: `1px solid ${t.cardBorder}`, background: "none", color: t.textSoft, fontSize: 13, cursor: "pointer" }}>Cancel</button>
                </div>
              </>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                {[["Name", admin?.name || "Admin"], ["Email", admin?.email || ""], ["Role", admin?.role || "admin"]].map(([label, val]) => (
                  <div key={label}><div style={{ fontSize: 12, color: t.textMuted, textTransform: "uppercase", letterSpacing: .8, marginBottom: 3 }}>{label}</div><div style={{ fontSize: 14, fontWeight: 500, color: t.text }}>{val}</div></div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Theme */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: t.text, marginBottom: 10 }}>Theme</div>
          <div style={{ display: "flex", gap: 8 }}>
            {[["day", "☀ Light"], ["night", "☾ Dark"], ["auto", "◑ Auto"]].map(([id, lb]) => (
              <button key={id} onClick={() => applyTheme(id)} style={{ flex: 1, padding: "12px 10px", borderRadius: 10, borderWidth: 1, borderStyle: "solid", borderColor: themeMode === id ? t.accent : t.cardBorder, background: themeMode === id ? (dark ? "#2a1a22" : "#fdf2f4") : (dark ? "rgba(255,255,255,.04)" : "rgba(255,255,255,.8)"), color: themeMode === id ? t.accent : t.textSoft, fontSize: 14, fontWeight: themeMode === id ? 600 : 450, textAlign: "center" }}>{lb}</button>
            ))}
          </div>
        </div>

        {/* Change password */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: t.text, marginBottom: 10 }}>Change Password</div>
          <div className="adm-card" style={{ background: dark ? "rgba(255,255,255,.06)" : "rgba(255,255,255,.95)", borderWidth: 1, borderStyle: "solid", borderColor: dark ? "rgba(255,255,255,.06)" : "rgba(0,0,0,.06)", padding: 18, borderRadius: 14, boxShadow: dark ? "0 4px 20px rgba(0,0,0,.25)" : "0 4px 20px rgba(0,0,0,.04)" }}>
            {admPwMsg && <div style={{ padding: "8px 12px", borderRadius: 8, marginBottom: 12, fontSize: 13, background: admPwMsg.type === "success" ? (dark ? "rgba(110,231,183,.08)" : "#ecfdf5") : (dark ? "rgba(220,38,38,.08)" : "#fef2f2"), color: admPwMsg.type === "success" ? (dark ? "#6ee7b7" : "#059669") : (dark ? "#fca5a5" : "#dc2626") }}>{admPwMsg.type === "success" ? "✓" : "⚠️"} {admPwMsg.text}</div>}
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 13, color: t.textMuted, display: "block", marginBottom: 4 }}>Current Password</label>
              <input type="password" value={admCurPw} onChange={e => setAdmCurPw(e.target.value)} style={{ width: "100%", padding: "10px 14px", borderRadius: 8, borderWidth: 1, borderStyle: "solid", borderColor: t.cardBorder, background: dark ? "#0d1020" : "#fff", color: t.text, fontSize: 14, outline: "none", boxSizing: "border-box" }} />
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 13, color: t.textMuted, display: "block", marginBottom: 4 }}>New Password</label>
              <input type="password" value={admNewPw} onChange={e => setAdmNewPw(e.target.value)} style={{ width: "100%", padding: "10px 14px", borderRadius: 8, borderWidth: 1, borderStyle: "solid", borderColor: t.cardBorder, background: dark ? "#0d1020" : "#fff", color: t.text, fontSize: 14, outline: "none", boxSizing: "border-box" }} />
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 13, color: t.textMuted, display: "block", marginBottom: 4 }}>Confirm Password</label>
              <input type="password" value={admConfPw} onChange={e => setAdmConfPw(e.target.value)} style={{ width: "100%", padding: "10px 14px", borderRadius: 8, borderWidth: 1, borderStyle: "solid", borderColor: t.cardBorder, background: dark ? "#0d1020" : "#fff", color: t.text, fontSize: 14, outline: "none", boxSizing: "border-box" }} />
            </div>
            <button onClick={changeAdmPw} disabled={pwSaving} className="adm-btn-primary" style={{ opacity: admCurPw && admNewPw && admConfPw && !pwSaving ? 1 : .4 }}>{pwSaving ? "Updating..." : "Update Password"}</button>
          </div>
        </div>

        {/* Social Links & Community */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: t.text, marginBottom: 10 }}>Social Links & Community</div>
          <div className="adm-card" style={{ background: dark ? "rgba(255,255,255,.06)" : "rgba(255,255,255,.95)", borderWidth: 1, borderStyle: "solid", borderColor: dark ? "rgba(255,255,255,.06)" : "rgba(0,0,0,.06)", padding: 18, borderRadius: 14, boxShadow: dark ? "0 4px 20px rgba(0,0,0,.25)" : "0 4px 20px rgba(0,0,0,.04)" }}>
            <div style={{ fontSize: 12, color: t.textMuted, marginBottom: 14, lineHeight: 1.5 }}>These links appear in the user dashboard sidebar, landing page footer, and support page. Leave blank to hide.</div>

            {socialMsg && <div style={{ padding: "8px 12px", borderRadius: 8, marginBottom: 12, fontSize: 13, background: socialMsg.type === "success" ? (dark ? "rgba(110,231,183,.08)" : "#ecfdf5") : (dark ? "rgba(220,38,38,.08)" : "#fef2f2"), color: socialMsg.type === "success" ? (dark ? "#6ee7b7" : "#059669") : (dark ? "#fca5a5" : "#dc2626") }}>{socialMsg.type === "success" ? "✓" : "⚠️"} {socialMsg.text}</div>}

            {[
              ["social_whatsapp", "WhatsApp Group Link", "https://chat.whatsapp.com/...", "Group invite link for community"],
              ["social_telegram", "Telegram Channel", "https://t.me/...", "Channel or group link"],
              ["social_whatsapp_support", "WhatsApp Support Number", "", "Number for wa.me link (no + prefix)"],
              ["social_instagram", "Instagram Handle", "Nitro.ng", "Without the @ symbol"],
              ["social_twitter", "X / Twitter Handle", "TheNitroNG", "Without the @ symbol"],
            ].map(([key, label, placeholder, hint]) => (
              <div key={key} style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 13, color: t.textMuted, display: "block", marginBottom: 3 }}>{label}</label>
                <input value={social[key] || ""} onChange={e => setSocial(prev => ({ ...prev, [key]: e.target.value }))} placeholder={placeholder} style={{ width: "100%", padding: "10px 14px", borderRadius: 8, borderWidth: 1, borderStyle: "solid", borderColor: t.cardBorder, background: dark ? "#0d1020" : "#fff", color: t.text, fontSize: 14, outline: "none", boxSizing: "border-box", fontFamily: "inherit" }} />
                <div style={{ fontSize: 11, color: t.textMuted, marginTop: 2, opacity: .7 }}>{hint}</div>
              </div>
            ))}

            <button onClick={saveSocial} disabled={socialSaving} className="adm-btn-primary" style={{ opacity: socialSaving ? .5 : 1 }}>{socialSaving ? "Saving..." : "Save Social Links"}</button>
          </div>
        </div>

        {/* Referral Settings */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: t.text, marginBottom: 10 }}>Referral Program</div>
          <div className="adm-card" style={{ background: dark ? "rgba(255,255,255,.06)" : "rgba(255,255,255,.95)", borderWidth: 1, borderStyle: "solid", borderColor: dark ? "rgba(255,255,255,.06)" : "rgba(0,0,0,.06)", padding: 18, borderRadius: 14, boxShadow: dark ? "0 4px 20px rgba(0,0,0,.25)" : "0 4px 20px rgba(0,0,0,.04)" }}>
            <div style={{ fontSize: 12, color: t.textMuted, marginBottom: 14, lineHeight: 1.5 }}>Bonus amounts in kobo (100 kobo = ₦1). Default ₦500 = 50000 kobo. Set to 0 to disable.</div>

            {refMsg && <div style={{ padding: "8px 12px", borderRadius: 8, marginBottom: 12, fontSize: 13, background: refMsg.type === "success" ? (dark ? "rgba(110,231,183,.08)" : "#ecfdf5") : (dark ? "rgba(220,38,38,.08)" : "#fef2f2"), color: refMsg.type === "success" ? (dark ? "#6ee7b7" : "#059669") : (dark ? "#fca5a5" : "#dc2626") }}>{refMsg.type === "success" ? "✓" : "⚠️"} {refMsg.text}</div>}

            {[
              ["ref_referrer_bonus", "Referrer Bonus", "Amount credited to the person who shared their code"],
              ["ref_invitee_bonus", "Invitee Bonus", "Amount credited to the new user who used a referral code"],
            ].map(([key, label, hint]) => (
              <div key={key} style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 13, color: t.textMuted, display: "block", marginBottom: 3 }}>{label} <span style={{ fontSize: 12, color: t.accent, fontWeight: 600 }}>₦{((Number(refSettings[key]) || 0) / 100).toLocaleString()}</span></label>
                <input type="number" value={refSettings[key] || ""} onChange={e => setRefSettings(prev => ({ ...prev, [key]: e.target.value }))} placeholder="50000" style={{ width: "100%", padding: "10px 14px", borderRadius: 8, borderWidth: 1, borderStyle: "solid", borderColor: t.cardBorder, background: dark ? "#0d1020" : "#fff", color: t.text, fontSize: 14, outline: "none", boxSizing: "border-box", fontFamily: "'JetBrains Mono', monospace" }} />
                <div style={{ fontSize: 11, color: t.textMuted, marginTop: 2, opacity: .7 }}>{hint}</div>
              </div>
            ))}

            <button onClick={async () => {
              setRefSaving(true); setRefMsg(null);
              try {
                const res = await fetch("/api/admin/settings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ settings: refSettings }) });
                setRefMsg(res.ok ? { type: "success", text: "Referral settings saved" } : { type: "error", text: "Failed to save" });
              } catch { setRefMsg({ type: "error", text: "Request failed" }); }
              setRefSaving(false);
            }} disabled={refSaving} className="adm-btn-primary" style={{ opacity: refSaving ? .5 : 1 }}>{refSaving ? "Saving..." : "Save Referral Settings"}</button>
          </div>
        </div>

        {/* Cleanup */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: t.text, marginBottom: 10 }}>Cleanup</div>
          <div className="adm-card" style={{ background: dark ? "rgba(255,255,255,.06)" : "rgba(255,255,255,.95)", borderWidth: 1, borderStyle: "solid", borderColor: dark ? "rgba(255,255,255,.06)" : "rgba(0,0,0,.06)", padding: 18, borderRadius: 14, boxShadow: dark ? "0 4px 20px rgba(0,0,0,.25)" : "0 4px 20px rgba(0,0,0,.04)" }}>
            <div style={{ fontSize: 13, color: t.textMuted, marginBottom: 12, lineHeight: 1.5 }}>Remove unverified accounts older than 7 days that have no orders or transactions.</div>
            <CleanupButton dark={dark} t={t} />
          </div>
        </div>
      </div>
    </>
  );
}
