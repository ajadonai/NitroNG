'use client';
import { useState, useEffect } from "react";
import { useConfirm } from "./confirm-dialog";
import { fN } from "../lib/format";


function Toggle({ on, onToggle, accent }) {
  return (
    <button onClick={onToggle} className="set-toggle" style={{ background: on ? accent : "rgba(128,128,128,.2)" }}>
      <div className="set-toggle-thumb" style={{ left: on ? 21 : 3 }} />
    </button>
  );
}

/* ═══════════════════════════════════════════ */
/* ═══ SETTINGS PAGE                       ═══ */
/* ═══════════════════════════════════════════ */
export default function SettingsPage({ user, dark, t, themeMode, setThemeMode, setDark }) {
  const confirm = useConfirm();
  const [notifOrders, setNotifOrders] = useState(true);
  const [notifPromo, setNotifPromo] = useState(false);
  const [notifEmail, setNotifEmail] = useState(true);

  // Load notification prefs from user data
  useEffect(() => {
    if (user) {
      if (typeof user.notifOrders === 'boolean') setNotifOrders(user.notifOrders);
      if (typeof user.notifPromo === 'boolean') setNotifPromo(user.notifPromo);
      if (typeof user.notifEmail === 'boolean') setNotifEmail(user.notifEmail);
    }
  }, [user]);

  // Save notification pref on toggle
  const saveNotif = (key, value) => {
    fetch("/api/auth/notifications", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ [key]: value }) }).catch(() => {});
  };
  const [showApi, setShowApi] = useState(false);
  const [apiKey, setApiKey] = useState(null);
  const [apiLoading, setApiLoading] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [copied, setCopied] = useState(false);

  // Change password state
  const [curPw, setCurPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [pwMsg, setPwMsg] = useState(null);
  const [pwLoading, setPwLoading] = useState(false);

  // Fetch API key on mount
  useEffect(() => {
    fetch("/api/auth/api-key").then(r => r.json()).then(d => { if (d.apiKey) setApiKey(d.apiKey); }).catch(() => {});
  }, []);

  // Sessions state
  const [sessions, setSessions] = useState([]);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [revoking, setRevoking] = useState(null);

  useEffect(() => {
    fetch("/api/auth/sessions").then(r => r.json()).then(d => setSessions(d.sessions || [])).catch(() => {}).finally(() => setSessionsLoading(false));
  }, []);

  const revokeSession = async (id) => {
    setRevoking(id);
    try {
      const res = await fetch("/api/auth/sessions", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sessionId: id }) });
      if (res.ok) setSessions(prev => prev.filter(s => s.id !== id));
    } catch {}
    setRevoking(null);
  };

  const fDSession = (d) => {
    const diff = Date.now() - new Date(d).getTime();
    if (diff < 60000) return "Now";
    if (diff < 3600000) return `${Math.floor(diff / 60000)} min ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)} hrs ago`;
    return new Date(d).toLocaleDateString("en-NG", { month: "short", day: "numeric" });
  };

  const applyTheme = (mode) => {
    setThemeMode(mode);
    try { localStorage.setItem("nitro-theme", mode); } catch {}
    if (mode === "day") setDark(false);
    else if (mode === "night") setDark(true);
    else { const h = new Date().getHours(); setDark(h >= 19 || h < 7); }
  };

  const changePassword = async () => {
    setPwMsg(null);
    if (!curPw || !newPw || !confirmPw) { setPwMsg({ type: "error", text: "All fields required" }); return; }
    if (newPw !== confirmPw) { setPwMsg({ type: "error", text: "New passwords don't match" }); return; }
    if (newPw.length < 6) { setPwMsg({ type: "error", text: "Minimum 6 characters" }); return; }
    setPwLoading(true);
    try {
      const res = await fetch("/api/auth/change-password", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ currentPassword: curPw, newPassword: newPw }), signal: AbortSignal.timeout(15000) });
      const data = await res.json();
      if (!res.ok) { setPwMsg({ type: "error", text: data.error || "Failed" }); } else { setPwMsg({ type: "success", text: "Password updated" }); setCurPw(""); setNewPw(""); setConfirmPw(""); }
    } catch (err) { setPwMsg({ type: "error", text: err?.name === "TimeoutError" ? "Request timed out" : "Network error. Check your connection." }); }
    setPwLoading(false);
  };

  const generateApiKey = async (action) => {
    setApiLoading(true);
    try {
      const res = await fetch("/api/auth/api-key", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }), signal: AbortSignal.timeout(15000) });
      const data = await res.json();
      if (res.ok && data.apiKey) { setApiKey(data.apiKey); setShowApi(true); }
      else if (!res.ok) { console.warn("API key generation failed:", data.error); }
    } catch (err) { console.warn("API key request failed:", err.message); }
    setApiLoading(false);
  };

  const copyApi = () => {
    if (!apiKey) return;
    try { navigator.clipboard?.writeText(apiKey); } catch {}
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  };

  const initials = user ? ((user.firstName?.[0] || "") + (user.lastName?.[0] || "")).toUpperCase() || user.name?.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2) : "";

  return (
    <>
      <div className="set-header">
        <div className="set-title" style={{ color: t.text }}>Settings</div>
        <div className="set-subtitle" style={{ color: t.textMuted }}>Manage your account preferences</div>
        <div className="page-divider" style={{ background: t.cardBorder }} />
      </div>

      <div className="set-content">

        {/* ── PROFILE ── */}
        <div className="set-section">
          <div className="set-card" style={{ background: dark ? "rgba(255,255,255,.03)" : "rgba(255,255,255,.85)", border: `0.5px solid ${t.cardBorder}` }}>
            <div className="set-card-title" style={{ color: t.textMuted }}>Profile</div>
            <div className="set-card-desc" style={{ color: t.textMuted }}>Your account information. Contact support to update.</div>
            <div className="set-card-divider" style={{ background: t.cardBorder }} />
            <div className="set-profile-header">
              <div className="set-profile-avatar" style={{ background: t.accent }}>{initials}</div>
              <div>
                <div className="set-profile-name" style={{ color: t.text }}>{user?.name || "User"}</div>
                <div className="set-profile-since" style={{ color: t.textMuted }}>Member since Mar 2026</div>
              </div>
            </div>
            <div className="set-profile-grid">
              {[
                ["First name", user?.firstName || user?.name?.split(" ")[0] || "—"],
                ["Last name", user?.lastName || user?.name?.split(" ").slice(1).join(" ") || "—"],
                ["Email", user?.email || "—"],
                ["Phone", user?.phone || "—"],
                ["Referral code", user?.refCode || "—"],
              ].map(([label, val]) => (
                <div key={label}>
                  <div className="set-field-label" style={{ color: t.textMuted }}>{label}</div>
                  <div className={`set-field-val${label === "Referral code" ? " m" : ""}`} style={{ color: t.text }}>{val}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── CHANGE PASSWORD ── */}
        <div id="set-change-password" className="set-section">
          <div className="set-card" style={{ background: dark ? "rgba(255,255,255,.03)" : "rgba(255,255,255,.85)", border: `0.5px solid ${t.cardBorder}` }}>
            <div className="set-card-title" style={{ color: t.textMuted }}>Change password</div>
            <div className="set-card-divider" style={{ background: t.cardBorder }} />
            {pwMsg && <div style={{ padding: "8px 12px", borderRadius: 8, marginBottom: 12, fontSize: 14, background: pwMsg.type === "success" ? (dark ? "rgba(110,231,183,.08)" : "#ecfdf5") : (dark ? "rgba(220,38,38,.08)" : "#fef2f2"), color: pwMsg.type === "success" ? (dark ? "#6ee7b7" : "#059669") : (dark ? "#fca5a5" : "#dc2626") }}>{pwMsg.text}</div>}
            <div className="set-input-group">
              <label className="set-input-label" style={{ color: t.textMuted }}>Current password</label>
              <input type="password" value={curPw} onChange={e => setCurPw(e.target.value)} className="set-input" style={{ borderColor: dark ? "rgba(255,255,255,.08)" : "rgba(0,0,0,.1)", background: dark ? "rgba(255,255,255,.04)" : "#fff", color: t.text }} />
            </div>
            <div className="set-input-group">
              <label className="set-input-label" style={{ color: t.textMuted }}>New password</label>
              <input type="password" value={newPw} onChange={e => setNewPw(e.target.value)} className="set-input" style={{ borderColor: dark ? "rgba(255,255,255,.08)" : "rgba(0,0,0,.1)", background: dark ? "rgba(255,255,255,.04)" : "#fff", color: t.text }} />
            </div>
            <div className="set-input-group">
              <label className="set-input-label" style={{ color: t.textMuted }}>Confirm new password</label>
              <input type="password" value={confirmPw} onChange={e => setConfirmPw(e.target.value)} className="set-input" style={{ borderColor: dark ? "rgba(255,255,255,.08)" : "rgba(0,0,0,.1)", background: dark ? "rgba(255,255,255,.04)" : "#fff", color: t.text }} />
            </div>
            <button onClick={changePassword} disabled={pwLoading} className="set-btn-primary" style={{ opacity: curPw && newPw && confirmPw && !pwLoading ? 1 : .4 }}>{pwLoading ? "Updating..." : "Update password"}</button>
          </div>
        </div>

        {/* ── THEME ── */}
        <div id="set-theme" className="set-section">
          <div className="set-card" style={{ background: dark ? "rgba(255,255,255,.03)" : "rgba(255,255,255,.85)", border: `0.5px solid ${t.cardBorder}` }}>
            <div className="set-card-title" style={{ color: t.textMuted }}>Theme</div>
            <div className="set-card-desc" style={{ color: t.textMuted }}>Choose how Nitro looks for you.</div>
            <div className="set-card-divider" style={{ background: t.cardBorder }} />
            <div className="set-theme-grid">
              {[["day", "Light"], ["night", "Dark"], ["auto", "Auto"]].map(([id, lb]) => (
                <button key={id} onClick={() => applyTheme(id)} className="set-theme-btn" style={{ border: `0.5px solid ${themeMode === id ? t.accent : t.cardBorder}`, background: themeMode === id ? (dark ? "rgba(196,125,142,.08)" : "rgba(196,125,142,.06)") : "transparent", color: themeMode === id ? t.accent : t.textSoft }}>{lb}</button>
              ))}
            </div>
            {themeMode === "auto" && <div className="set-theme-note" style={{ color: t.textMuted }}>Switches automatically — light 7am–6pm, dark otherwise.</div>}
          </div>
        </div>

        {/* ── NOTIFICATIONS ── */}
        <div id="set-notifications" className="set-section">
          <div className="set-card set-notif-card" style={{ background: dark ? "rgba(255,255,255,.03)" : "rgba(255,255,255,.85)", border: `0.5px solid ${t.cardBorder}` }}>
            <div style={{ padding: "20px 20px 0" }}>
              <div className="set-card-title" style={{ color: t.textMuted }}>Notifications</div>
              <div className="set-card-desc" style={{ color: t.textMuted }}>Control what alerts you receive.</div>
            </div>
            <div className="set-card-divider-full" style={{ background: t.cardBorder }} />
            {[
              ["Order updates", "Get notified when orders complete or fail", notifOrders, setNotifOrders, "notifOrders"],
              ["Promotions", "Receive offers and discount alerts", notifPromo, setNotifPromo, "notifPromo"],
              ["Email notifications", "Receive notifications via email", notifEmail, setNotifEmail, "notifEmail"],
            ].map(([title, desc, on, setOn, key], i, arr) => (
              <div key={title} className="set-notif-row" style={{ borderBottom: i < arr.length - 1 ? `0.5px solid ${t.cardBorder}` : "none" }}>
                <div className="set-notif-info">
                  <div className="set-notif-title" style={{ color: t.text }}>{title}</div>
                  <div className="set-notif-desc" style={{ color: t.textMuted }}>{desc}</div>
                </div>
                <Toggle on={on} onToggle={() => { setOn(!on); saveNotif(key, !on); }} accent={t.accent} />
              </div>
            ))}
          </div>
        </div>

        {/* ── ACTIVE SESSIONS ── */}
        <div id="set-active-sessions" className="set-section">
          <div className="set-card set-notif-card" style={{ background: dark ? "rgba(255,255,255,.03)" : "rgba(255,255,255,.85)", border: `0.5px solid ${t.cardBorder}` }}>
            <div style={{ padding: "20px 20px 0" }}>
              <div className="set-card-title" style={{ color: t.textMuted }}>Active sessions</div>
              <div className="set-card-desc" style={{ color: t.textMuted }}>Devices logged into your account. Max 1 web + 1 mobile.</div>
            </div>
            <div className="set-card-divider-full" style={{ background: t.cardBorder }} />
            {sessionsLoading ? (
              <div style={{ padding: 16, textAlign: "center", color: t.textMuted, fontSize: 13 }}>Loading sessions...</div>
            ) : sessions.length === 0 ? (
              <div style={{ padding: 16, textAlign: "center", color: t.textMuted, fontSize: 13 }}>No active sessions</div>
            ) : sessions.map((s, i, arr) => (
              <div key={s.id} className="set-session-row" style={{ borderBottom: i < arr.length - 1 ? `0.5px solid ${t.cardBorder}` : "none" }}>
                <div className="set-session-icon" style={{ background: s.current ? (dark ? "rgba(110,231,183,.06)" : "rgba(5,150,105,.04)") : (dark ? "rgba(255,255,255,.03)" : "rgba(0,0,0,.02)") }}>
                  {s.deviceType === "mobile" ? (
                    <svg width="14" height="16" viewBox="0 0 24 24" fill="none" stroke={s.current ? t.green : t.textMuted} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="2" width="14" height="20" rx="2" ry="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg>
                  ) : (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={s.current ? t.green : t.textMuted} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
                  )}
                </div>
                <div style={{ flex: 1 }}>
                  <div className="set-session-device" style={{ color: t.text }}>
                    {s.deviceInfo || s.deviceType}
                    {s.current && <span className="set-session-badge" style={{ background: dark ? "rgba(110,231,183,.08)" : "#ecfdf5", color: t.green, borderColor: dark ? "rgba(110,231,183,.15)" : "#a7f3d0" }}>Current</span>}
                    <span className="m" style={{ fontSize: 11, padding: "1px 5px", borderRadius: 4, background: dark ? "rgba(255,255,255,.04)" : "rgba(0,0,0,.03)", color: t.textMuted, marginLeft: 4 }}>{s.deviceType}</span>
                  </div>
                  <div className="set-session-meta" style={{ color: t.textMuted }}>{s.ip || "—"} · {fDSession(s.lastActive)}</div>
                </div>
                {!s.current && <button onClick={() => revokeSession(s.id)} disabled={revoking === s.id} className="set-btn-danger-sm" style={{ borderColor: dark ? "rgba(252,165,165,.15)" : "rgba(220,38,38,.12)", color: dark ? "#fca5a5" : "#dc2626" }}>{revoking === s.id ? "..." : "Revoke"}</button>}
              </div>
            ))}
          </div>
        </div>

        {/* ── API KEY ── */}
        <div id="set-api-key" className="set-section">
          <div className="set-card" style={{ background: dark ? "rgba(255,255,255,.03)" : "rgba(255,255,255,.85)", border: `0.5px solid ${t.cardBorder}` }}>
            <div className="set-card-title" style={{ color: t.textMuted }}>API key</div>
            <div className="set-card-desc" style={{ color: t.textMuted }}>For advanced users and resellers. Keep this secret.</div>
            <div className="set-card-divider" style={{ background: t.cardBorder }} />
            {apiKey ? (
              <>
                <div className="set-api-row">
                  <div className="m set-api-key" style={{ background: dark ? "rgba(255,255,255,.04)" : "#fff", borderColor: dark ? "rgba(255,255,255,.08)" : "rgba(0,0,0,.1)", color: t.textSoft }}>
                    {showApi ? apiKey : "••••••••••••••••••••••••••••••••"}
                  </div>
                  <button onClick={() => setShowApi(!showApi)} className="set-btn-outline" style={{ borderColor: dark ? "rgba(255,255,255,.1)" : "rgba(0,0,0,.1)", color: t.textSoft }}>{showApi ? "Hide" : "Show"}</button>
                  <button onClick={copyApi} className="set-btn-outline" style={{ borderColor: dark ? "rgba(255,255,255,.1)" : "rgba(0,0,0,.1)", color: copied ? t.green : t.textSoft }}>{copied ? "Copied ✓" : "Copy"}</button>
                </div>
                <button onClick={async () => { const ok = await confirm({ title: "Reset API Key", message: "This will invalidate your current key. Any integrations using it will stop working.", confirmLabel: "Reset", danger: true }); if (ok) generateApiKey("regenerate"); }} disabled={apiLoading} className="m set-btn-danger-sm" style={{ borderColor: dark ? "rgba(252,165,165,.15)" : "rgba(220,38,38,.1)", color: dark ? "#fca5a5" : "#dc2626", marginTop: 10 }}>{apiLoading ? "..." : "Reset Key"}</button>
              </>
            ) : (
              <>
                <div style={{ fontSize: 14, color: t.textMuted, marginBottom: 12 }}>No API key generated yet. Generate one to access Nitro's API.</div>
                <button onClick={() => generateApiKey("generate")} disabled={apiLoading} className="set-btn-primary" style={{ opacity: apiLoading ? .5 : 1 }}>{apiLoading ? "Generating..." : "Create API Key"}</button>
              </>
            )}
          </div>
        </div>

        {/* ── LOG OUT ── */}
        <div id="set-account" className="set-section">
          <button onClick={async () => {
            const ok = await confirm({ title: "Log Out", message: "You will be logged out of this device.", confirmLabel: "Log Out" });
            if (ok) {
              try { await fetch("/api/auth/logout", { method: "POST" }); } catch {}
              window.location.replace("/");
            }
          }} className="set-logout-btn" style={{ background: dark ? "rgba(255,255,255,.03)" : "rgba(255,255,255,.85)", border: `0.5px solid ${t.cardBorder}`, color: t.textSoft }}>
            Log out
          </button>
        </div>

        {/* ── DANGER ZONE ── */}
        <div id="set-danger-zone" className="set-section">
          <div className="set-danger-card" style={{ background: dark ? "rgba(220,38,38,.04)" : "rgba(220,38,38,.02)", border: `0.5px solid ${dark ? "rgba(252,165,165,.08)" : "rgba(220,38,38,.08)"}` }}>
            <div className="set-danger-title" style={{ color: dark ? "#fca5a5" : "#dc2626" }}>Delete account</div>
            <div className="set-danger-desc" style={{ color: t.textMuted }}>Permanently delete your account. Orders and transactions preserved, personal data removed.</div>
            <button onClick={async () => {
              const ok = await confirm({ title: "Delete Your Account", message: "This will permanently delete your account. Your orders and transaction history will be kept for records but your personal info will be removed. This cannot be undone.", confirmLabel: "Delete Account", danger: true, requireType: "DELETE" });
              if (ok) {
                try {
                  const res = await fetch("/api/auth/delete-account", { method: "POST" });
                  if (res.ok) { window.location.replace("/?deleted=1"); }
                } catch {}
              }
            }} className="set-btn-danger" style={{ borderColor: dark ? "rgba(252,165,165,.2)" : "rgba(220,38,38,.18)", color: dark ? "#fca5a5" : "#dc2626" }}>Delete my account</button>
          </div>
        </div>
      </div>
    </>
  );
}

/* ═══════════════════════════════════════════ */
/* ═══ SETTINGS RIGHT SIDEBAR              ═══ */
/* ═══════════════════════════════════════════ */
export function SettingsSidebar({ user, dark, t }) {
  const initials = user ? ((user.firstName?.[0] || "") + (user.lastName?.[0] || "")).toUpperCase() || user.name?.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2) : "";
  return (
    <>
      <div className="set-rs-title" style={{ color: t.textMuted }}>Account</div>
      <div className="set-rs-account" style={{ background: t.cardBg, borderWidth: 1, borderStyle: "solid", borderColor: t.cardBorder }}>
        <div className="set-rs-avatar" style={{ background: t.accent }}>{initials}</div>
        <div className="set-rs-name" style={{ color: t.text }}>{user?.name?.toUpperCase() || "USER"}</div>
        <div className="set-rs-email" style={{ color: t.textMuted }}>{user?.email || ""}</div>
        <div className="m set-rs-ref" style={{ color: t.accent }}>{user?.refCode || "—"}</div>
      </div>

      <div className="set-rs-divider" style={{ background: t.sidebarBorder }} />

      <div className="set-rs-title" style={{ color: t.textMuted }}>Quick Links</div>
      {[
        ["Change Password", "set-change-password"],
        ["Theme", "set-theme"],
        ["Notifications", "set-notifications"],
        ["Active Sessions", "set-active-sessions"],
        ["API Key", "set-api-key"],
        ["Log Out", "set-account"],
        ["Account", "set-danger-zone"],
      ].map(([label, id]) => (
        <div key={label} onClick={() => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" })} className="set-rs-link" style={{ color: label === "Account" ? (dark ? "#fca5a5" : "#dc2626") : t.textSoft, cursor: "pointer" }}>{label}</div>
      ))}
    </>
  );
}
