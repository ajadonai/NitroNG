'use client';
import { useState, useEffect } from "react";
import { useConfirm } from "./confirm-dialog";
import { useToast } from "./toast";
import { fN } from "../lib/format";
import { SITE } from "../lib/site";
import { Avatar } from "./avatar";

function SettingsModal({ open, onClose, title, dark, t, children }) {
  useEffect(() => {
    if (open) document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, [open]);
  if (!open) return null;
  return (
    <div onClick={onClose} className="fixed inset-0 z-[200] flex items-center justify-center bg-black/55 backdrop-blur-[6px]">
      <div onClick={e => e.stopPropagation()} className="w-full max-w-[480px] mx-4 rounded-2xl max-h-[85vh] overflow-y-auto" style={{ background: dark ? "#131728" : "#fff", border: `1px solid ${dark ? "rgba(255,255,255,.12)" : "rgba(0,0,0,.08)"}`, boxShadow: "0 24px 48px rgba(0,0,0,.35)" }}>
        <div className="flex items-center justify-between py-4 px-5" style={{ borderBottom: `1px solid ${dark ? "rgba(255,255,255,.08)" : "rgba(0,0,0,.06)"}` }}>
          <div className="text-[16px] font-bold text-t-text">{title}</div>
          <button onClick={onClose} className="border-none cursor-pointer p-1 bg-transparent text-t-text-muted">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <div className="px-5 py-4">{children}</div>
      </div>
    </div>
  );
}

function ShieldBadge({ color = "#9ca3af", size = 20, tier = "Spark" }) {
  const isSpark = tier === "Spark";
  const rank = ["Spark","Pulse","Boost","Surge","Apex","Legend"].indexOf(tier);
  const isLegend = tier === "Legend";
  return (
    <svg width={size} height={size * 1.1} viewBox="0 0 40 44" fill="none" className="shrink-0">
      <path d="M20 2L38 10V22C38 32 30 40 20 44C10 40 2 32 2 22V10L20 2Z" fill={color} fillOpacity={isSpark ? 0.15 : 0.2} stroke={color} strokeWidth={isLegend ? 2 : 1.5}/>
      <path d="M20 14L22 18H26L23 21L24 25L20 22L16 25L17 21L14 18H18Z" fill={color} fillOpacity={isSpark ? 0.4 : 1} transform={rank >= 3 ? "translate(0,-2) scale(1.15) translate(-2.6, -0.5)" : undefined}/>
      {rank >= 2 && <line x1="12" y1="8" x2="28" y2="8" stroke={color} strokeWidth="1" opacity="0.5"/>}
      {rank >= 4 && <line x1="14" y1="5" x2="26" y2="5" stroke={color} strokeWidth="0.8" opacity="0.3"/>}
      {isLegend && <circle cx="20" cy="22" r="16" fill="none" stroke={color} strokeWidth="0.5" opacity="0.3"/>}
    </svg>
  );
}


function Toggle({ on, onToggle, accent }) {
  return (
    <button onClick={onToggle} className="w-[38px] h-[22px] rounded-[11px] relative border-none cursor-pointer shrink-0" style={{ background: on ? accent : "rgba(128,128,128,.28)" }}>
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
  const [notifPromo, setNotifPromo] = useState(true);
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
  const [pwModalOpen, setPwModalOpen] = useState(false);
  const [notifModalOpen, setNotifModalOpen] = useState(false);
  const [sessionsModalOpen, setSessionsModalOpen] = useState(false);

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
    else { const h = new Date().getHours(), m = new Date().getMinutes(); setDark(h >= 19 || h < 6 || (h === 6 && m < 30) || (h === 18 && m >= 30)); }
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
        <div className="text-xl max-desktop:text-lg font-semibold mb-0.5 text-t-text">Settings</div>
        <div className="text-sm text-t-text-muted">Manage your account preferences</div>
        <div className="page-divider bg-t-card-border" />
      </div>

      <div>

        {/* ── PROFILE ── */}
        <div className="set-section">
          <div className="set-card overflow-hidden" style={{ background: dark ? "rgba(255,255,255,.09)" : "rgba(255,255,255,.85)", border: `0.5px solid ${t.cardBorder}` }}>
            <div className="h-[72px] max-md:h-16 bg-gradient-to-br from-[#c47d8e] via-[#a3586b] to-[#8b5e6b]" />
            <div className="px-5 pb-5 max-desktop:px-4 max-desktop:pb-4">
              <div className="-mt-8 max-md:-mt-7 mb-3 shadow-lg border-[3px] rounded-2xl w-fit" style={{ borderColor: dark ? "#0e1225" : "#f3f0ec" }}>
                <Avatar size={56} rounded={14} />
              </div>
              <div className="text-lg font-semibold mb-0.5 text-t-text">{user?.name || "User"}</div>
              <div className="flex items-center gap-1 mb-1">
                {user?.badgeColor && <ShieldBadge color={user.badgeColor} size={14} tier={user.badge} />}
                <span className="text-xs font-semibold" style={{ color: user?.badgeColor || t.textMuted }}>{user?.badge || "Spark"}</span>

              </div>
              <div className="text-[13px] mb-3.5 text-t-text-muted">Your account information. Contact support to update.</div>
              <div className="grid grid-cols-3 max-md:grid-cols-1 gap-y-3.5 gap-x-6">
                {[
                  ["Email", user?.email || "—"],
                  ["Phone", user?.phone || "—"],
                  ["Referral code", user?.refCode || "—"],
                ].map(([label, val]) => (
                  <div key={label}>
                    <div className="text-[11px] font-semibold tracking-[.8px] uppercase mb-[3px] text-t-text-muted">{label}</div>
                    <div className={`text-[15px] font-medium${label === "Referral code" ? " m" : ""} text-t-text`}>{val}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ── SETTINGS GRID ── */}
        <div className="grid grid-cols-2 max-md:grid-cols-1 gap-4">

        {/* ── CHANGE PASSWORD ── */}
        <div id="set-change-password" className="set-card cursor-pointer" style={{ background: dark ? "rgba(255,255,255,.09)" : "rgba(255,255,255,.85)", border: `0.5px solid ${t.cardBorder}` }} onClick={() => setPwModalOpen(true)}>
          <div className="flex items-center gap-3 p-4">
            <div className="w-9 h-9 rounded-[10px] flex items-center justify-center shrink-0" style={{ background: dark ? "rgba(196,125,142,.12)" : "rgba(196,125,142,.08)" }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={t.accent} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[14px] font-semibold text-t-text">Change password</div>
              <div className="text-[12.5px] mt-0.5 text-t-text-muted">Keep your account secure</div>
            </div>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={t.textMuted} strokeWidth="2" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>
          </div>
        </div>

        {/* ── NOTIFICATIONS ── */}
        <div id="set-notifications" className="set-card cursor-pointer" style={{ background: dark ? "rgba(255,255,255,.09)" : "rgba(255,255,255,.85)", border: `0.5px solid ${t.cardBorder}` }} onClick={() => setNotifModalOpen(true)}>
          <div className="flex items-center gap-3 p-4">
            <div className="w-9 h-9 rounded-[10px] flex items-center justify-center shrink-0" style={{ background: dark ? "rgba(196,125,142,.12)" : "rgba(196,125,142,.08)" }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={t.accent} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></svg>
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[14px] font-semibold text-t-text">Notifications</div>
              <div className="text-[12.5px] mt-0.5 text-t-text-muted">{[notifOrders && "Orders", notifPromo && "Promos", notifEmail && "Email"].filter(Boolean).join(" · ") || "All off"}</div>
            </div>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={t.textMuted} strokeWidth="2" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>
          </div>
        </div>

        {/* ── THEME ── */}
        <div id="set-theme" className="set-card" style={{ background: dark ? "rgba(255,255,255,.09)" : "rgba(255,255,255,.85)", border: `0.5px solid ${t.cardBorder}` }}>
            <div className="set-card-header" style={{ background: dark ? "rgba(196,125,142,.18)" : "rgba(196,125,142,.12)", borderBottom: `1px solid ${dark ? "rgba(255,255,255,.12)" : "rgba(0,0,0,.08)"}` }}>
              <div className="set-card-title text-t-text-muted">Theme</div>
              <div className="set-card-desc text-t-text-muted">Choose how Nitro looks for you.</div>
            </div>
            <div className="set-card-body">
              <div className="flex gap-2">
                {[
                  ["day", "Light", <svg key="s" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>],
                  ["night", "Dark", <svg key="m" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/></svg>],
                  ["auto", "Auto", <svg key="a" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 3a9 9 0 000 18z" fill="currentColor" opacity=".4"/></svg>],
                ].map(([id, lb, icon]) => (
                  <button key={id} onClick={() => applyTheme(id)} className="flex-1 py-[11px] px-2.5 rounded-[10px] text-sm max-md:text-[13px] max-md:py-2.5 max-md:px-2 font-medium cursor-pointer bg-transparent flex items-center justify-center gap-1.5 transition-transform duration-200 hover:-translate-y-px" style={{ border: `0.5px solid ${themeMode === id ? t.accent : t.cardBorder}`, background: themeMode === id ? (dark ? "rgba(196,125,142,.14)" : "rgba(196,125,142,.12)") : "transparent", color: themeMode === id ? t.accent : t.textSoft }}>{icon} {lb}</button>
                ))}
              </div>
              {themeMode === "auto" && <div className="text-[13px] mt-2 text-t-text-muted">Switches automatically — light 6:30am–6:30pm, dark otherwise.</div>}
            </div>
        </div>

        {/* ── ACTIVE SESSIONS ── */}
        <div id="set-active-sessions" className="set-card cursor-pointer" style={{ background: dark ? "rgba(255,255,255,.09)" : "rgba(255,255,255,.85)", border: `0.5px solid ${t.cardBorder}` }} onClick={() => setSessionsModalOpen(true)}>
          <div className="flex items-center gap-3 p-4">
            <div className="w-9 h-9 rounded-[10px] flex items-center justify-center shrink-0" style={{ background: dark ? "rgba(196,125,142,.12)" : "rgba(196,125,142,.08)" }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={t.accent} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[14px] font-semibold text-t-text">Active sessions</div>
              <div className="text-[12.5px] mt-0.5 truncate text-t-text-muted">{sessionsLoading ? "Loading..." : `${sessions.length} device${sessions.length !== 1 ? "s" : ""} · This ${sessions.find(s => s.current)?.deviceType || "device"}`}</div>
            </div>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={t.textMuted} strokeWidth="2" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>
          </div>
        </div>

        {/* ── SYSTEM STATUS ── */}
        <div id="set-status" className="set-card" style={{ background: dark ? "rgba(255,255,255,.09)" : "rgba(255,255,255,.85)", border: `0.5px solid ${t.cardBorder}` }}>
            <div className="set-card-header" style={{ background: dark ? "rgba(196,125,142,.18)" : "rgba(196,125,142,.12)", borderBottom: `1px solid ${dark ? "rgba(255,255,255,.12)" : "rgba(0,0,0,.08)"}` }}>
              <div className="set-card-title text-t-text-muted">System status</div>
              <div className="set-card-desc text-t-text-muted">Check if all Nitro services are running.</div>
            </div>
            <div className="set-card-body">
              <a href={SITE.status} target="_blank" rel="noopener noreferrer" className="flex items-center justify-between no-underline py-0.5">
                <div className="flex items-center gap-2.5">
                  <div className="w-2 h-2 rounded-full bg-[#34d399] shrink-0" />
                  <span className="text-sm font-medium whitespace-nowrap text-t-text">All systems operational</span>
                </div>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={t.textMuted} strokeWidth="2" strokeLinecap="round"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
              </a>
            </div>
        </div>

        {/* ── API ACCESS ── */}
        <div id="set-api" className="set-card opacity-[.55]" style={{ background: dark ? "rgba(255,255,255,.09)" : "rgba(255,255,255,.85)", border: `0.5px solid ${t.cardBorder}` }}>
            <div className="set-card-header" style={{ background: dark ? "rgba(196,125,142,.18)" : "rgba(196,125,142,.12)", borderBottom: `1px solid ${dark ? "rgba(255,255,255,.12)" : "rgba(0,0,0,.08)"}` }}>
              <div className="set-card-title text-t-text">API Access</div>
              <div className="set-card-desc text-t-text-muted">Integrate Nitro services into your own platform.</div>
            </div>
            <div className="set-card-body flex flex-col gap-3">
              <div className="text-sm text-t-text-muted">Coming soon — reseller API with full documentation, key management, and usage dashboard.</div>
            </div>
        </div>

        </div>{/* end grid */}

        {/* ── PASSWORD MODAL ── */}
        <SettingsModal open={pwModalOpen} onClose={() => setPwModalOpen(false)} title="Change password" dark={dark} t={t}>
          <div className="mb-3">
            <label htmlFor="pw-current" className="text-[13px] font-medium block mb-[5px] text-t-text-muted">Current password</label>
            <input type="password" id="pw-current" autoComplete="current-password" value={curPw} onChange={e => setCurPw(e.target.value)} className="w-full py-2.5 px-3.5 rounded-lg border-[0.5px] text-[15px] outline-none focus-visible:ring-2 focus-visible:ring-[#c47d8e]/40 box-border text-t-text" style={{ borderColor: dark ? "rgba(255,255,255,.18)" : "rgba(0,0,0,.18)", background: dark ? "rgba(255,255,255,.12)" : "#fff" }} />
          </div>
          <div className="mb-3">
            <label htmlFor="pw-new" className="text-[13px] font-medium block mb-[5px] text-t-text-muted">New password</label>
            <input type="password" id="pw-new" autoComplete="new-password" value={newPw} onChange={e => setNewPw(e.target.value)} className="w-full py-2.5 px-3.5 rounded-lg border-[0.5px] text-[15px] outline-none focus-visible:ring-2 focus-visible:ring-[#c47d8e]/40 box-border text-t-text" style={{ borderColor: dark ? "rgba(255,255,255,.18)" : "rgba(0,0,0,.18)", background: dark ? "rgba(255,255,255,.12)" : "#fff" }} />
          </div>
          <div className="mb-3">
            <label htmlFor="pw-confirm" className="text-[13px] font-medium block mb-[5px] text-t-text-muted">Confirm new password</label>
            <input type="password" id="pw-confirm" autoComplete="new-password" value={confirmPw} onChange={e => setConfirmPw(e.target.value)} className="w-full py-2.5 px-3.5 rounded-lg border-[0.5px] text-[15px] outline-none focus-visible:ring-2 focus-visible:ring-[#c47d8e]/40 box-border text-t-text" style={{ borderColor: dark ? "rgba(255,255,255,.18)" : "rgba(0,0,0,.18)", background: dark ? "rgba(255,255,255,.12)" : "#fff" }} />
          </div>
          <button onClick={changePassword} disabled={pwLoading} className="py-2.5 px-7 rounded-lg bg-gradient-to-br from-[#c47d8e] to-[#8b5e6b] text-white text-sm font-semibold border-none cursor-pointer mt-1 transition-[transform,box-shadow] duration-200 ease-in-out hover:translate-y-[-1px] hover:shadow-[0_6px_20px_rgba(196,125,142,.31)]" style={{ opacity: curPw && newPw && confirmPw && !pwLoading ? 1 : .4 }}>{pwLoading ? "Updating..." : "Update password"}</button>
        </SettingsModal>

        {/* ── NOTIFICATIONS MODAL ── */}
        <SettingsModal open={notifModalOpen} onClose={() => setNotifModalOpen(false)} title="Notifications" dark={dark} t={t}>
          <div className="text-[13px] mb-4 text-t-text-muted">Control what alerts you receive.</div>
          {[
            ["Order updates", "Get notified when orders complete or fail", notifOrders, setNotifOrders, "notifOrders"],
            ["Promotions", "Receive offers and discount alerts", notifPromo, setNotifPromo, "notifPromo"],
            ["Email notifications", "Receive notifications via email", notifEmail, setNotifEmail, "notifEmail"],
          ].map(([title, desc, on, setOn, key], i, arr) => (
            <div key={title} className="flex items-center justify-between gap-3 py-3" style={{ borderBottom: i < arr.length - 1 ? `0.5px solid ${dark ? "rgba(255,255,255,.08)" : "rgba(0,0,0,.06)"}` : "none" }}>
              <div>
                <div className="text-[14px] font-medium text-t-text">{title}</div>
                <div className="text-[12px] mt-0.5 text-t-text-muted">{desc}</div>
              </div>
              <Toggle on={on} onToggle={() => { setOn(!on); saveNotif(key, !on); }} accent={t.accent} />
            </div>
          ))}
        </SettingsModal>

        {/* ── SESSIONS MODAL ── */}
        <SettingsModal open={sessionsModalOpen} onClose={() => setSessionsModalOpen(false)} title="Active sessions" dark={dark} t={t}>
          <div className="text-[13px] mb-4 text-t-text-muted">Devices logged into your account. Max 1 web + 1 mobile.</div>
          {sessionsLoading ? (
            <div className="text-center text-[13px] py-4 text-t-text-muted">Loading sessions...</div>
          ) : sessions.length === 0 ? (
            <div className="text-center text-[13px] py-4 text-t-text-muted">No active sessions</div>
          ) : sessions.map((s, i, arr) => (
            <div key={s.id} className="flex items-center gap-3 py-3" style={{ borderBottom: i < arr.length - 1 ? `0.5px solid ${dark ? "rgba(255,255,255,.08)" : "rgba(0,0,0,.06)"}` : "none" }}>
              <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: s.current ? (dark ? "rgba(110,231,183,.06)" : "rgba(5,150,105,.04)") : (dark ? "rgba(255,255,255,.05)" : "rgba(0,0,0,.02)") }}>
                {s.deviceType === "mobile" ? (
                  <svg width="14" height="16" viewBox="0 0 24 24" fill="none" stroke={s.current ? t.green : t.textMuted} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="2" width="14" height="20" rx="2" ry="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg>
                ) : (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={s.current ? t.green : t.textMuted} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
                )}
              </div>
              <div className="flex-1">
                <div className="text-sm font-medium flex items-center gap-1.5 text-t-text">
                  {s.deviceInfo || s.deviceType}
                  {s.current && <span className="text-[11px] py-px px-1.5 rounded font-semibold border-[.5px]" style={{ background: dark ? "rgba(110,231,183,.14)" : "#ecfdf5", color: t.green, borderColor: dark ? "rgba(110,231,183,.24)" : "#a7f3d0" }}>Current</span>}
                  <span className="text-[11px] py-px px-[5px] rounded ml-1" style={{ background: dark ? "rgba(255,255,255,.07)" : "rgba(0,0,0,.03)", color: t.textMuted }}>{s.deviceType}</span>
                </div>
                <div className="text-[13px] mt-0.5 text-t-text-muted">{s.ip || "—"} · {fDSession(s.lastActive)}</div>
              </div>
              {!s.current && <button onClick={(e) => { e.stopPropagation(); revokeSession(s.id); }} disabled={revoking === s.id} className="py-[5px] px-3 rounded-md text-xs font-semibold border-[0.5px] cursor-pointer bg-transparent" style={{ borderColor: dark ? "rgba(252,165,165,.24)" : "rgba(220,38,38,.19)", color: dark ? "#fca5a5" : "#dc2626" }}>{revoking === s.id ? "..." : "Revoke"}</button>}
            </div>
          ))}
        </SettingsModal>

        {/* ── LOG OUT ── */}
        <div id="set-account" className="mt-4">
          <button onClick={async () => {
            const ok = await confirm({ title: "Log Out", message: "You will be logged out of this device.", confirmLabel: "Log Out" });
            if (ok) {
              let res;
              try {
                res = await fetch("/api/auth/logout", { method: "POST" });
              } catch {
                toast.error("Unable to log out", "Check your connection and try again.");
                return;
              }
              if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                toast.error("Unable to log out", data.error || "Please try again.");
                return;
              }
              window.location.replace("/");
            }
          }} className="w-full py-[11px] rounded-xl max-md:rounded-xl text-sm font-medium cursor-pointer text-center flex items-center justify-center gap-2" style={{ background: dark ? "rgba(255,255,255,.14)" : "rgba(0,0,0,.06)", border: `1px solid ${dark ? "rgba(255,255,255,.18)" : "rgba(0,0,0,.14)"}`, color: dark ? "#fca5a5" : "#dc2626" }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
            Log out
          </button>
        </div>

        {/* ── DANGER ZONE ── */}
        <div id="set-danger-zone" className="mt-4">
          <div className="rounded-xl max-desktop:rounded-xl p-5 max-desktop:p-4" style={{ background: dark ? "rgba(220,38,38,.08)" : "rgba(220,38,38,.04)", border: `0.5px solid ${dark ? "rgba(252,165,165,.14)" : "rgba(220,38,38,.14)"}` }}>
            <div className="text-sm font-semibold tracking-[0.3px] uppercase mb-0.5" style={{ color: dark ? "#fca5a5" : "#dc2626" }}>Delete account</div>
            <div className="text-[13px] mb-3.5 text-t-text-muted">Schedule your account for deletion. You have 30 days to change your mind.</div>
            {showDelete ? (
              <div className="mt-3">
                <label htmlFor="delete-account-password" className="block text-[13px] mb-1.5 text-t-text-muted">Enter your password to confirm</label>
                <div className="flex gap-2 flex-wrap max-md:flex-wrap">
                  <input type="password" id="delete-account-password" autoComplete="current-password" value={deletePassword} onChange={e => setDeletePassword(e.target.value)} placeholder="Your password" className="flex-1 min-w-40 py-2.5 px-3.5 rounded-lg text-sm outline-none text-t-text" style={{ background: dark ? "#131728" : "#fff", border: `1px solid ${dark ? "rgba(252,165,165,.24)" : "rgba(220,38,38,.19)"}` }} />
                  <button onClick={async () => {
                    if (!deletePassword) return;
                    const ok = await confirm({ title: "Delete Your Account", message: "Your account will be scheduled for deletion in 30 days. During this period you cannot log in or sign up with this email. Contact support@nitro.ng before the deadline to cancel. After 30 days, your personal details will be permanently removed and the account cannot be restored. Financial records required for legal and accounting purposes are retained without your contact details.", confirmLabel: "Delete Account", danger: true, requireType: "DELETE" });
                    if (ok) {
                      try {
                        const res = await fetch("/api/auth/delete-account", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password: deletePassword }) });
                        const data = await res.json();
                        if (res.ok) { window.location.replace("/?deleted=1"); }
                        else { setDeleteError(data.error || "Failed to delete account"); }
                      } catch { setDeleteError("Request failed"); }
                    }
                  }} className="py-[9px] px-5 rounded-lg border-[0.5px] text-[13px] font-semibold cursor-pointer bg-transparent whitespace-nowrap" style={{ borderColor: dark ? "rgba(252,165,165,.28)" : "rgba(220,38,38,.25)", color: dark ? "#fca5a5" : "#dc2626", opacity: deletePassword ? 1 : .4 }}>Delete my account</button>
                  <button onClick={() => { setShowDelete(false); setDeletePassword(""); setDeleteError(""); }} className="py-2.5 px-3.5 rounded-lg bg-transparent text-sm cursor-pointer text-t-text-muted" style={{ border: `1px solid ${t.cardBorder}` }}>Cancel</button>
                </div>
                {deleteError && <div className="text-[13px] mt-2" style={{ color: dark ? "#fca5a5" : "#dc2626" }}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="inline align-middle"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg> {deleteError}</div>}
              </div>
            ) : (
              <button onClick={() => setShowDelete(true)} className="py-[9px] px-5 rounded-lg border-[0.5px] text-[13px] font-semibold cursor-pointer bg-transparent" style={{ borderColor: dark ? "rgba(252,165,165,.28)" : "rgba(220,38,38,.25)", color: dark ? "#fca5a5" : "#dc2626" }}>Delete my account</button>
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
    <div className="flex flex-col gap-0">
      <div className="text-[11px] font-semibold uppercase tracking-[1.5px] mb-2 py-1.5 px-2.5 rounded-lg text-t-text-muted" style={{ background: dark ? "rgba(196,125,142,.1)" : "rgba(196,125,142,.06)" }}>Quick Links</div>
      {[
        ["Change Password", "set-change-password"],
        ["Notifications", "set-notifications"],
        ["Theme", "set-theme"],
        ["Active Sessions", "set-active-sessions"],
        ["System Status", "set-status"],
        ["API Access", "set-api"],
        ["Log Out", "set-account"],
        ["Account", "set-danger-zone"],
      ].map(([label, id]) => (
        <div key={label} role="button" tabIndex={0} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();e.currentTarget.click()}}} onClick={() => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" })} className="py-2 px-3 rounded-lg mb-0.5 text-sm font-[450] cursor-pointer" style={{ color: label === "Account" ? (dark ? "#fca5a5" : "#dc2626") : t.textSoft }}>{label}</div>
      ))}
    </div>
  );
}
