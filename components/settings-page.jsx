'use client';
import { useState, useEffect } from "react";
import { useConfirm } from "./confirm-dialog";
import { useToast } from "./toast";
import { fN } from "../lib/format";
import { SITE } from "../lib/site";

function ShieldBadge({ color = "#6B7280", size = 20, tier = "Starter" }) {
  const isStarter = tier === "Starter";
  const isPower = tier === "Power User";
  const isElite = tier === "Elite";
  const isLegend = tier === "Legend";
  return (
    <svg width={size} height={size * 1.1} viewBox="0 0 40 44" fill="none" style={{ flexShrink: 0 }}>
      <path d="M20 2L38 10V22C38 32 30 40 20 44C10 40 2 32 2 22V10L20 2Z" fill={color} fillOpacity={isStarter ? 0.15 : 0.2} stroke={color} strokeWidth={isLegend ? 2 : 1.5}/>
      <path d="M20 14L22 18H26L23 21L24 25L20 22L16 25L17 21L14 18H18Z" fill={color} fillOpacity={isStarter ? 0.4 : 1} transform={isElite || isLegend ? "translate(0,-2) scale(1.15) translate(-2.6, -0.5)" : undefined}/>
      {(isPower || isElite || isLegend) && <line x1="12" y1="8" x2="28" y2="8" stroke={color} strokeWidth="1" opacity="0.5"/>}
      {(isElite || isLegend) && <line x1="14" y1="5" x2="26" y2="5" stroke={color} strokeWidth="0.8" opacity="0.3"/>}
      {isLegend && <circle cx="20" cy="22" r="16" fill="none" stroke={color} strokeWidth="0.5" opacity="0.3"/>}
    </svg>
  );
}


function Toggle({ on, onToggle, accent }) {
  return (
    <button onClick={onToggle} className="w-[38px] h-[22px] rounded-[11px] relative border-none cursor-pointer shrink-0" style={{ background: on ? accent : "rgba(128,128,128,.2)" }}>
      <div className="w-4 h-4 rounded-full bg-white absolute top-[3px] transition-[left] duration-200 ease-in-out shadow-[0_1px_3px_rgba(0,0,0,.2)]" style={{ left: on ? 21 : 3 }} />
    </button>
  );
}

/* ═══════════════════════════════════════════ */
/* ═══ SETTINGS PAGE                       ═══ */
/* ═══════════════════════════════════════════ */
export default function SettingsPage({ user, dark, t, themeMode, setThemeMode, setDark }) {
  const confirm = useConfirm();
  const toast = useToast();
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
  const [showDelete, setShowDelete] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteError, setDeleteError] = useState("");

  // Change password state
  const [curPw, setCurPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [pwLoading, setPwLoading] = useState(false);

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
    try { localStorage.setItem("nitro-theme", mode); } catch {};
    if (mode === "day") setDark(false);
    else if (mode === "night") setDark(true);
    else { const h = new Date().getHours(); setDark(h >= 19 || h < 7); }
  };

  const changePassword = async () => {
    if (!curPw || !newPw || !confirmPw) { toast.error("Missing fields", "All fields required"); return; }
    if (newPw !== confirmPw) { toast.error("Mismatch", "New passwords don't match"); return; }
    if (newPw.length < 6) { toast.error("Too short", "Minimum 6 characters"); return; }
    setPwLoading(true);
    try {
      const res = await fetch("/api/auth/change-password", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ currentPassword: curPw, newPassword: newPw }), signal: AbortSignal.timeout(15000) });
      const data = await res.json();
      if (!res.ok) { toast.error("Failed", data.error || "Password change failed"); } else { toast.success("Password updated", "Your password has been changed"); setCurPw(""); setNewPw(""); setConfirmPw(""); }
    } catch (err) { toast.error(err?.name === "TimeoutError" ? "Timed out" : "Network error", "Check your connection"); }
    setPwLoading(false);
  };

  const initials = user ? ((user.firstName?.[0] || "") + (user.lastName?.[0] || "")).toUpperCase() || user.name?.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2) : "";

  return (
    <>
      <div className="pb-3.5 max-md:pb-2">
        <div className="text-xl max-desktop:text-lg font-semibold mb-0.5" style={{ color: t.text }}>Settings</div>
        <div className="text-sm" style={{ color: t.textMuted }}>Manage your account preferences</div>
        <div className="page-divider" style={{ background: t.cardBorder }} />
      </div>

      <div className="max-w-[600px]">

        {/* ── PROFILE ── */}
        <div className="set-section">
          <div className="set-card" style={{ background: dark ? "rgba(255,255,255,.03)" : "rgba(255,255,255,.85)", border: `0.5px solid ${t.cardBorder}` }}>
            <div className="set-card-title" style={{ color: t.textMuted }}>Profile</div>
            <div className="set-card-desc" style={{ color: t.textMuted }}>Your account information. Contact support to update.</div>
            <div className="set-card-divider" style={{ background: t.cardBorder }} />
            <div className="flex items-center gap-3.5 mb-4">
              <div className="w-11 h-11 rounded-xl flex items-center justify-center text-[17px] font-semibold text-white" style={{ background: t.accent }}><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg></div>
              <div>
                <div className="text-base font-semibold" style={{ color: t.text }}>{user?.name || "User"}</div>
                <div className="flex items-center gap-1 mt-0.5">
                  {user?.badgeColor && <ShieldBadge color={user.badgeColor} size={14} tier={user.badge} />}
                  <span className="text-xs font-semibold" style={{ color: user?.badgeColor || t.textMuted }}>{user?.badge || "Starter"}</span>
                  {user?.badgeDiscount > 0 && <span className="text-[11px]" style={{ color: dark ? "#6ee7b7" : "#059669" }}>· {user.badgeDiscount}% off</span>}
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 max-desktop:grid-cols-1 gap-y-3.5 gap-x-6">
              {[
                ["First name", user?.firstName || user?.name?.split(" ")[0] || "—"],
                ["Last name", user?.lastName || user?.name?.split(" ").slice(1).join(" ") || "—"],
                ["Email", user?.email || "—"],
                ["Phone", user?.phone || "—"],
                ["Referral code", user?.refCode || "—"],
              ].map(([label, val]) => (
                <div key={label}>
                  <div className="text-[11px] font-semibold tracking-[.8px] uppercase mb-[3px]" style={{ color: t.textMuted }}>{label}</div>
                  <div className={`text-[15px] font-medium${label === "Referral code" ? " m" : ""}`} style={{ color: t.text }}>{val}</div>
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
            <div className="mb-3">
              <label className="text-[13px] font-medium block mb-[5px]" style={{ color: t.textMuted }}>Current password</label>
              <input type="password" value={curPw} onChange={e => setCurPw(e.target.value)} className="w-full py-2.5 px-3.5 rounded-lg border-[0.5px] text-[15px] outline-none box-border" style={{ borderColor: dark ? "rgba(255,255,255,.08)" : "rgba(0,0,0,.1)", background: dark ? "rgba(255,255,255,.04)" : "#fff", color: t.text }} />
            </div>
            <div className="mb-3">
              <label className="text-[13px] font-medium block mb-[5px]" style={{ color: t.textMuted }}>New password</label>
              <input type="password" value={newPw} onChange={e => setNewPw(e.target.value)} className="w-full py-2.5 px-3.5 rounded-lg border-[0.5px] text-[15px] outline-none box-border" style={{ borderColor: dark ? "rgba(255,255,255,.08)" : "rgba(0,0,0,.1)", background: dark ? "rgba(255,255,255,.04)" : "#fff", color: t.text }} />
            </div>
            <div className="mb-3">
              <label className="text-[13px] font-medium block mb-[5px]" style={{ color: t.textMuted }}>Confirm new password</label>
              <input type="password" value={confirmPw} onChange={e => setConfirmPw(e.target.value)} className="w-full py-2.5 px-3.5 rounded-lg border-[0.5px] text-[15px] outline-none box-border" style={{ borderColor: dark ? "rgba(255,255,255,.08)" : "rgba(0,0,0,.1)", background: dark ? "rgba(255,255,255,.04)" : "#fff", color: t.text }} />
            </div>
            <button onClick={changePassword} disabled={pwLoading} className="py-2.5 px-7 rounded-lg bg-gradient-to-br from-[#c47d8e] to-[#8b5e6b] text-white text-sm font-semibold border-none cursor-pointer mt-1 transition-[transform,box-shadow] duration-200 ease-in-out hover:translate-y-[-1px] hover:shadow-[0_6px_20px_rgba(196,125,142,.25)]" style={{ opacity: curPw && newPw && confirmPw && !pwLoading ? 1 : .4 }}>{pwLoading ? "Updating..." : "Update password"}</button>
          </div>
        </div>

        {/* ── THEME ── */}
        <div id="set-theme" className="set-section">
          <div className="set-card" style={{ background: dark ? "rgba(255,255,255,.03)" : "rgba(255,255,255,.85)", border: `0.5px solid ${t.cardBorder}` }}>
            <div className="set-card-title" style={{ color: t.textMuted }}>Theme</div>
            <div className="set-card-desc" style={{ color: t.textMuted }}>Choose how Nitro looks for you.</div>
            <div className="set-card-divider" style={{ background: t.cardBorder }} />
            <div className="flex gap-2">
              {[["day", "Light"], ["night", "Dark"], ["auto", "Auto"]].map(([id, lb]) => (
                <button key={id} onClick={() => applyTheme(id)} className="flex-1 py-[11px] px-2.5 rounded-[10px] text-sm max-md:text-[13px] max-md:py-2.5 max-md:px-2 font-medium text-center cursor-pointer bg-transparent" style={{ border: `0.5px solid ${themeMode === id ? t.accent : t.cardBorder}`, background: themeMode === id ? (dark ? "rgba(196,125,142,.08)" : "rgba(196,125,142,.06)") : "transparent", color: themeMode === id ? t.accent : t.textSoft }}>{lb}</button>
              ))}
            </div>
            {themeMode === "auto" && <div className="text-[13px] mt-2" style={{ color: t.textMuted }}>Switches automatically — light 7am–6pm, dark otherwise.</div>}
          </div>
        </div>

        {/* ── NOTIFICATIONS ── */}
        <div id="set-notifications" className="set-section">
          <div className="set-card p-0" style={{ background: dark ? "rgba(255,255,255,.03)" : "rgba(255,255,255,.85)", border: `0.5px solid ${t.cardBorder}` }}>
            <div className="py-5 px-5 pb-0">
              <div className="set-card-title" style={{ color: t.textMuted }}>Notifications</div>
              <div className="set-card-desc" style={{ color: t.textMuted }}>Control what alerts you receive.</div>
            </div>
            <div className="h-px mt-4" style={{ background: t.cardBorder }} />
            {[
              ["Order updates", "Get notified when orders complete or fail", notifOrders, setNotifOrders, "notifOrders"],
              ["Promotions", "Receive offers and discount alerts", notifPromo, setNotifPromo, "notifPromo"],
              ["Email notifications", "Receive notifications via email", notifEmail, setNotifEmail, "notifEmail"],
            ].map(([title, desc, on, setOn, key], i, arr) => (
              <div key={title} className="flex items-center gap-3.5 py-[13px] px-5 max-md:py-[11px] max-md:px-4" style={{ borderBottom: i < arr.length - 1 ? `0.5px solid ${t.cardBorder}` : "none" }}>
                <div className="flex-1">
                  <div className="text-[15px] font-medium" style={{ color: t.text }}>{title}</div>
                  <div className="text-[13px] mt-px" style={{ color: t.textMuted }}>{desc}</div>
                </div>
                <Toggle on={on} onToggle={() => { setOn(!on); saveNotif(key, !on); }} accent={t.accent} />
              </div>
            ))}
          </div>
        </div>

        {/* ── ACTIVE SESSIONS ── */}
        <div id="set-active-sessions" className="set-section">
          <div className="set-card p-0" style={{ background: dark ? "rgba(255,255,255,.03)" : "rgba(255,255,255,.85)", border: `0.5px solid ${t.cardBorder}` }}>
            <div className="py-5 px-5 pb-0">
              <div className="set-card-title" style={{ color: t.textMuted }}>Active sessions</div>
              <div className="set-card-desc" style={{ color: t.textMuted }}>Devices logged into your account. Max 1 web + 1 mobile.</div>
            </div>
            <div className="h-px mt-4" style={{ background: t.cardBorder }} />
            {sessionsLoading ? (
              <div className="p-4 text-center text-[13px]" style={{ color: t.textMuted }}>Loading sessions...</div>
            ) : sessions.length === 0 ? (
              <div className="p-4 text-center text-[13px]" style={{ color: t.textMuted }}>No active sessions</div>
            ) : sessions.map((s, i, arr) => (
              <div key={s.id} className="flex items-center gap-3 py-3 px-5 max-md:py-[11px] max-md:px-4" style={{ borderBottom: i < arr.length - 1 ? `0.5px solid ${t.cardBorder}` : "none" }}>
                <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: s.current ? (dark ? "rgba(110,231,183,.06)" : "rgba(5,150,105,.04)") : (dark ? "rgba(255,255,255,.03)" : "rgba(0,0,0,.02)") }}>
                  {s.deviceType === "mobile" ? (
                    <svg width="14" height="16" viewBox="0 0 24 24" fill="none" stroke={s.current ? t.green : t.textMuted} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="2" width="14" height="20" rx="2" ry="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg>
                  ) : (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={s.current ? t.green : t.textMuted} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
                  )}
                </div>
                <div className="flex-1">
                  <div className="text-sm font-medium flex items-center gap-1.5" style={{ color: t.text }}>
                    {s.deviceInfo || s.deviceType}
                    {s.current && <span className="text-[11px] py-px px-1.5 rounded font-semibold border-[.5px]" style={{ background: dark ? "rgba(110,231,183,.08)" : "#ecfdf5", color: t.green, borderColor: dark ? "rgba(110,231,183,.15)" : "#a7f3d0" }}>Current</span>}
                    <span className="text-[11px] py-px px-[5px] rounded ml-1" style={{ background: dark ? "rgba(255,255,255,.04)" : "rgba(0,0,0,.03)", color: t.textMuted }}>{s.deviceType}</span>
                  </div>
                  <div className="text-[13px] mt-0.5" style={{ color: t.textMuted }}>{s.ip || "—"} · {fDSession(s.lastActive)}</div>
                </div>
                {!s.current && <button onClick={() => revokeSession(s.id)} disabled={revoking === s.id} className="py-[5px] px-3 rounded-md text-xs font-semibold border-[0.5px] cursor-pointer bg-transparent" style={{ borderColor: dark ? "rgba(252,165,165,.15)" : "rgba(220,38,38,.12)", color: dark ? "#fca5a5" : "#dc2626" }}>{revoking === s.id ? "..." : "Revoke"}</button>}
              </div>
            ))}
          </div>
        </div>

        {/* ── SYSTEM STATUS ── */}
        <div id="set-status" className="set-section">
          <div className="set-card" style={{ background: dark ? "rgba(255,255,255,.03)" : "rgba(255,255,255,.85)", border: `0.5px solid ${t.cardBorder}` }}>
            <div className="set-card-title" style={{ color: t.textMuted }}>System status</div>
            <div className="set-card-divider" style={{ background: t.cardBorder }} />
            <a href={SITE.status} target="_blank" rel="noopener noreferrer" className="flex items-center justify-between no-underline py-0.5">
              <div className="flex items-center gap-2.5">
                <div className="w-2 h-2 rounded-full bg-[#34d399] shrink-0" />
                <span className="text-sm font-medium" style={{ color: t.text }}>All systems operational</span>
              </div>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={t.textMuted} strokeWidth="2" strokeLinecap="round"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
            </a>
          </div>
        </div>

        {/* ── API ACCESS ── */}
        <div id="set-api" className="set-section">
          <div className="set-card" style={{ background: dark ? "rgba(255,255,255,.03)" : "rgba(255,255,255,.85)", border: `0.5px solid ${t.cardBorder}`, opacity: .55 }}>
            <div className="set-card-title" style={{ color: t.textMuted }}>API Access</div>
            <div className="set-card-desc" style={{ color: t.textMuted }}>Integrate Nitro services into your own platform.</div>
            <div className="set-card-divider" style={{ background: t.cardBorder }} />
            <div className="py-2.5 px-3.5 rounded-lg text-sm" style={{ background: dark ? "rgba(255,255,255,.03)" : "rgba(0,0,0,.02)", color: t.textMuted }}>Coming soon</div>
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
          }} className="w-full py-[11px] rounded-xl max-md:rounded-xl text-sm font-medium cursor-pointer text-center flex items-center justify-center gap-2" style={{ background: dark ? "rgba(255,255,255,.05)" : "rgba(0,0,0,.03)", border: `1px solid ${dark ? "rgba(255,255,255,.08)" : "rgba(0,0,0,.08)"}`, color: dark ? "#fca5a5" : "#dc2626" }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
            Log out
          </button>
        </div>

        {/* ── DANGER ZONE ── */}
        <div id="set-danger-zone" className="set-section">
          <div className="rounded-xl max-desktop:rounded-xl p-5 max-desktop:p-4" style={{ background: dark ? "rgba(220,38,38,.04)" : "rgba(220,38,38,.02)", border: `0.5px solid ${dark ? "rgba(252,165,165,.08)" : "rgba(220,38,38,.08)"}` }}>
            <div className="text-sm font-semibold tracking-[0.3px] uppercase mb-0.5" style={{ color: dark ? "#fca5a5" : "#dc2626" }}>Delete account</div>
            <div className="text-[13px] mb-3.5" style={{ color: t.textMuted }}>Schedule your account for deletion. You have 30 days to change your mind.</div>
            {showDelete ? (
              <div className="mt-3">
                <div className="text-[13px] mb-1.5" style={{ color: t.textMuted }}>Enter your password to confirm</div>
                <div className="flex gap-2 flex-wrap max-md:flex-wrap">
                  <input type="password" value={deletePassword} onChange={e => setDeletePassword(e.target.value)} placeholder="Your password" className="flex-1 min-w-40 py-2.5 px-3.5 rounded-lg text-sm outline-none" style={{ background: dark ? "#0d1020" : "#fff", border: `1px solid ${dark ? "rgba(252,165,165,.15)" : "rgba(220,38,38,.12)"}`, color: t.text }} />
                  <button onClick={async () => {
                    if (!deletePassword) return;
                    const ok = await confirm({ title: "Delete Your Account", message: "Your account will be scheduled for deletion in 30 days. During this period you cannot log in or sign up with this email. Contact support@nitro.ng to cancel. After 30 days, your data will be permanently removed.", confirmLabel: "Delete Account", danger: true, requireType: "DELETE" });
                    if (ok) {
                      try {
                        const res = await fetch("/api/auth/delete-account", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password: deletePassword }) });
                        const data = await res.json();
                        if (res.ok) { window.location.replace("/?deleted=1"); }
                        else { setDeleteError(data.error || "Failed to delete account"); }
                      } catch { setDeleteError("Request failed"); }
                    }
                  }} className="py-[9px] px-5 rounded-lg border-[0.5px] text-[13px] font-semibold cursor-pointer bg-transparent whitespace-nowrap" style={{ borderColor: dark ? "rgba(252,165,165,.2)" : "rgba(220,38,38,.18)", color: dark ? "#fca5a5" : "#dc2626", opacity: deletePassword ? 1 : .4 }}>Delete my account</button>
                  <button onClick={() => { setShowDelete(false); setDeletePassword(""); setDeleteError(""); }} className="py-2.5 px-3.5 rounded-lg bg-transparent text-sm cursor-pointer" style={{ border: `1px solid ${t.cardBorder}`, color: t.textMuted }}>Cancel</button>
                </div>
                {deleteError && <div className="text-[13px] mt-2" style={{ color: dark ? "#fca5a5" : "#dc2626" }}>⚠️ {deleteError}</div>}
              </div>
            ) : (
              <button onClick={() => setShowDelete(true)} className="py-[9px] px-5 rounded-lg border-[0.5px] text-[13px] font-semibold cursor-pointer bg-transparent" style={{ borderColor: dark ? "rgba(252,165,165,.2)" : "rgba(220,38,38,.18)", color: dark ? "#fca5a5" : "#dc2626" }}>Delete my account</button>
            )}
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
  return (
    <>
      <div className="text-[13px] font-semibold uppercase tracking-[1.5px] mb-3 pl-1" style={{ color: t.textMuted }}>Quick Links</div>
      {[
        ["Change Password", "set-change-password"],
        ["Theme", "set-theme"],
        ["Notifications", "set-notifications"],
        ["Active Sessions", "set-active-sessions"],
        ["System Status", "set-status"],
        ["API Access", "set-api"],
        ["Log Out", "set-account"],
        ["Account", "set-danger-zone"],
      ].map(([label, id]) => (
        <div key={label} role="button" tabIndex={0} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();e.currentTarget.click()}}} onClick={() => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" })} className="py-2 px-3 rounded-lg mb-0.5 text-sm font-[450] cursor-pointer" style={{ color: label === "Account" ? (dark ? "#fca5a5" : "#dc2626") : t.textSoft }}>{label}</div>
      ))}
    </>
  );
}
