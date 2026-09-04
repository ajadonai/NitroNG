'use client';
import { useState, useEffect } from "react";
import { RailSec, RailCard, RailJump } from "./rail";
import { SkelList, Bone } from "./skeleton";
import { Modal } from "./ui-primitives";
import { useConfirm } from "./confirm-dialog";
import { useToast } from "./toast";
import { fN } from "../lib/format";
import { SITE } from "../lib/site";
import { Avatar } from "./avatar";
import { copyText } from '@/lib/clipboard';

function SettingsModal({ open, onClose, title, subtitle, icon, dark, t, children }) {
  return (
    <Modal open={open} onClose={onClose} dark={dark} maxWidth={480} title={title} subtitle={subtitle} icon={icon}>
      {children}
    </Modal>
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

const I_LOCK = <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>;
const I_BELL = <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M18 8a6 6 0 00-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 01-3.4 0"/></svg>;
const I_DEV = <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg>;
const I_KEY = <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m21 2-2 2m-7.6 7.6a5.5 5.5 0 11-7.8 7.8 5.5 5.5 0 017.8-7.8zm0 0L19 3l2 2-3 3"/></svg>;
const I_PULSE = <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>;
const I_OUT = <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9"/></svg>;
const I_TRASH = <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/></svg>;
const I_CHEV = <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg>;
const I_COPY = <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 012-2h10"/></svg>;
const I_SUN = <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>;
const I_MOON = <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 12.8A9 9 0 1111.2 3a7 7 0 009.8 9.8z"/></svg>;
const I_AUTO = <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 3a9 9 0 010 18z" fill="currentColor" stroke="none"/></svg>;

/** A settings row: icon tile, title, one-line hint, and whatever sits on the right. */
function Row({ id, icon, title, sub, right, onClick, href, danger, first, dark, t }) {
  const inner = (<>
    <span className="w-[34px] h-[34px] rounded-[10px] flex items-center justify-center shrink-0" style={{ background: danger ? (dark ? "rgba(252,165,165,.12)" : "rgba(220,38,38,.08)") : (dark ? "rgba(255,255,255,.08)" : "rgba(0,0,0,.04)"), color: danger ? (dark ? "#fca5a5" : "#dc2626") : t.textSoft }}>{icon}</span>
    <span className="flex flex-col gap-[2px] flex-1 min-w-0 text-left"><b className="text-[14px] font-semibold" style={{ color: danger ? (dark ? "#fca5a5" : "#dc2626") : t.text }}>{title}</b>{sub && <small className="text-[11.5px] text-t-text-muted">{sub}</small>}</span>
    <span className="flex items-center shrink-0 text-t-text-muted">{right === undefined ? I_CHEV : right}</span>
  </>);
  const cls = "flex items-center gap-3 w-full py-3 px-3.5 bg-transparent border-none font-[inherit] no-underline";
  const style = { borderTop: first ? "none" : `1px solid ${t.cardBorder}` };
  if (href) return <a id={id} href={href} target="_blank" rel="noopener noreferrer" className={`${cls} cursor-pointer`} style={style}>{inner}</a>;
  if (onClick) return <button id={id} onClick={onClick} className={`${cls} cursor-pointer text-left`} style={style}>{inner}</button>;
  return <div id={id} className={cls} style={style}>{inner}</div>;
}
function SectionHead({ children }) {
  return <div className="text-[10.5px] font-semibold uppercase tracking-[1px] px-0.5 pb-1.5 text-t-text-muted">{children}</div>;
}

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
  // Every verified account has an API key; wholesale shows when the account has reseller terms.
  const [apiKey, setApiKey] = useState(null);
  const [apiWholesale, setApiWholesale] = useState(false);
  useEffect(() => { fetch("/api/reseller/key").then(r => r.ok ? r.json() : null).then(d => { if (d?.apiKey) { setApiKey(d.apiKey); setApiWholesale(!!d.wholesale); } }).catch(() => {}); }, []);
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

  const card = { background: t.cardBg, border: `1px solid ${t.cardBorder}` };
  const copyCode = () => { if (!user?.refCode) return; try { copyText(user.refCode); toast.success("Copied", user.refCode); } catch {} };
  const themeBtn = (id, label, icon) => (
    <button key={id} onClick={() => applyTheme(id)} aria-pressed={themeMode === id} className="inline-flex items-center gap-1 h-[26px] px-2.5 rounded-full border-none font-[inherit] text-[11.5px] font-semibold cursor-pointer" style={themeMode === id ? { background: dark ? "#161b2e" : "#fff", color: t.text, boxShadow: "0 1px 3px rgba(0,0,0,.12)" } : { background: "transparent", color: t.textMuted }}>{icon}{label}</button>
  );
  return (
    <>
      <div className="pb-3.5 max-md:pb-2">
        <div className="text-xl max-desktop:text-lg font-semibold mb-0.5 text-t-text">Settings</div>
        <div className="text-sm text-t-text-muted">Your account and how Nitro looks</div>
        <div className="page-divider bg-t-card-border" />
      </div>
      <div className="desktop:grid desktop:grid-cols-2 desktop:gap-x-4 desktop:items-start">
        <div>

        {/* ── Profile ── */}
        <div className="flex items-center gap-3 rounded-[14px] p-3.5 mb-2" style={card}>
          <Avatar size={52} rounded={14} />
          <div className="flex flex-col gap-[3px] min-w-0">
            <div className="text-[16px] font-semibold truncate text-t-text">{user?.name || "User"}</div>
            <div className="flex items-center gap-1 text-[11.5px] font-semibold" style={{ color: user?.badgeColor || t.textMuted }}><ShieldBadge color={user?.badgeColor} size={12} tier={user?.badge} />{user?.badge || "Spark"}</div>
          </div>
        </div>
        <div className="rounded-[14px] px-3.5 mb-[18px]" style={card}>
          {[["Email", user?.email || "—", false], ["Phone", user?.phone || "—", true], ["Referral code", user?.refCode || "—", true]].map(([label, val, mono], i) => (
            <div key={label} className="flex items-center justify-between gap-3 py-2.5 text-[13px] text-t-text-muted" style={{ borderTop: i > 0 ? `1px solid ${t.cardBorder}` : "none" }}>
              <span>{label}</span>
              <span className="flex items-center gap-1.5 min-w-0"><b className={`text-[13px] font-semibold truncate text-t-text${mono ? " m" : ""}`}>{val}</b>{label === "Referral code" && user?.refCode && <button onClick={copyCode} aria-label="Copy referral code" className="w-6 h-6 rounded-[7px] flex items-center justify-center cursor-pointer bg-transparent text-t-text-muted" style={{ border: `1px solid ${t.cardBorder}` }}>{I_COPY}</button>}</span>
            </div>
          ))}
          <div className="py-2 text-[11.5px] text-t-text-muted" style={{ borderTop: `1px solid ${t.cardBorder}` }}>To change these, message support.</div>
        </div>

        </div>
        <div>
        {/* ── Account ── */}
        <SectionHead>Account</SectionHead>
        <div className="rounded-[14px] overflow-hidden mb-[18px]" style={card}>
          <Row id="set-change-password" first icon={I_LOCK} title="Change password" sub="Keep your account secure" onClick={() => setPwModalOpen(true)} dark={dark} t={t} />
          <Row id="set-notifications" icon={I_BELL} title="Notifications" sub="Orders, promos, email" onClick={() => setNotifModalOpen(true)} dark={dark} t={t} />
          <Row id="set-active-sessions" icon={I_DEV} title="Active sessions" sub={sessionsLoading ? <Bone dark={dark} w={140} h={9} style={{ display: "inline-block", verticalAlign: "middle" }} /> : `${sessions.length} device${sessions.length !== 1 ? "s" : ""}${sessions.find(x => x.current)?.deviceType ? ` · this ${sessions.find(x => x.current).deviceType}` : ""}`} onClick={() => setSessionsModalOpen(true)} dark={dark} t={t} />
        </div>

        </div>
        <div>
        {/* ── Appearance ── */}
        <SectionHead>Appearance</SectionHead>
        <div className="rounded-[14px] overflow-hidden mb-[18px]" style={card}>
          <Row id="set-theme" first icon={dark ? I_MOON : I_SUN} title="Theme" sub={themeMode === "auto" ? "Auto: light 6:30am to 6:30pm, dark otherwise" : "Choose how Nitro looks"} dark={dark} t={t}
            right={<span className="inline-flex p-[3px] rounded-full" style={{ background: dark ? "rgba(255,255,255,.08)" : "rgba(0,0,0,.05)", border: `1px solid ${t.cardBorder}` }}>{themeBtn("auto", "Auto", I_AUTO)}{themeBtn("day", "Light", I_SUN)}{themeBtn("night", "Dark", I_MOON)}</span>} />
        </div>

        </div>
        <div>
        {/* ── More ── */}
        <SectionHead>More</SectionHead>
        <div className="rounded-[14px] overflow-hidden mb-[18px]" style={card}>
          {apiKey
            ? <Row id="set-api" first icon={I_KEY} title="API access" sub={<span className="flex flex-col gap-[3px]"><span className="flex items-center gap-2 flex-wrap"><span className="m" style={{ color: t.text }}>{`${apiKey.slice(0, 9)}••••${apiKey.slice(-4)}`}</span><span className="text-[9.5px] font-bold uppercase tracking-[.5px] py-[1px] px-[6px] rounded-md" style={apiWholesale ? { color: dark ? "#4ade80" : "#15803d", background: dark ? "rgba(74,222,128,.14)" : "rgba(22,163,74,.1)" } : { color: t.textMuted, background: dark ? "rgba(255,255,255,.07)" : "rgba(0,0,0,.05)" }}>{apiWholesale ? "Wholesale" : "Retail"}</span></span><span>POST nitro.ng/api/v2</span></span>} onClick={() => { try { copyText(apiKey); toast.success("API key copied"); } catch {} }} right={<span className="flex items-center gap-2"><span className="w-6 h-6 rounded-[7px] flex items-center justify-center text-t-text-muted" style={{ border: `1px solid ${t.cardBorder}` }}>{I_COPY}</span><a href="/resellers/docs" target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} className="text-[12px] font-semibold no-underline text-accent">Docs</a></span>} dark={dark} t={t} />
            : <Row id="set-api" first icon={I_KEY} title="API access" sub="Use Nitro from your own platform" right={<span className="text-[10.5px] font-bold uppercase tracking-[.5px] py-[2px] px-2 rounded-md text-accent" style={{ background: dark ? "rgba(196,125,142,.14)" : "rgba(196,125,142,.1)" }}>Soon</span>} dark={dark} t={t} />}
          <Row id="set-status" icon={I_PULSE} title="System status" sub="Check that every Nitro service is running" href={SITE.status} right={<span className="w-[9px] h-[9px] rounded-full" style={{ background: "#059669", boxShadow: "0 0 0 3px rgba(5,150,105,.15)" }} />} dark={dark} t={t} />
        </div>

        </div>
        <div className="desktop:col-span-2">
        {/* ── Log out, delete ── */}
        <div className="rounded-[14px] overflow-hidden mb-4" style={card}>
          <Row id="set-account" first icon={I_OUT} title="Log out" onClick={async () => {
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
          }} dark={dark} t={t} />
          <Row id="set-danger-zone" icon={I_TRASH} title="Delete account" sub="Scheduled 30 days after you ask" danger onClick={() => setShowDelete(v => !v)} right={showDelete ? null : I_CHEV} dark={dark} t={t} />
          {showDelete && (
            <div className="px-3.5 pb-4" style={{ borderTop: `1px solid ${t.cardBorder}` }}>
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
          )}
        </div>

        </div>
        {/* ── PASSWORD MODAL ── */}
        <SettingsModal open={pwModalOpen} onClose={() => setPwModalOpen(false)} title="Change password" subtitle="Keep your account secure" icon={I_LOCK} dark={dark} t={t}>
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
        <SettingsModal open={notifModalOpen} onClose={() => setNotifModalOpen(false)} title="Notifications" subtitle="Orders, promos, email" icon={I_BELL} dark={dark} t={t}>
          <div className="text-[13px] mb-4 text-t-text-muted">Control what alerts you receive.</div>
          {[
            ["Order updates", "Get notified when orders complete or fail", notifOrders, setNotifOrders, "notifOrders"],
            ["Promotions", "Receive offers and discount alerts", notifPromo, setNotifPromo, "notifPromo"],
            ["Email notifications", "Receive notifications via email", notifEmail, setNotifEmail, "notifEmail"],
          ].map(([title, desc, on, setOn, key], i, arr) => (
            <div key={title} className="flex items-center justify-between gap-3 py-3" style={{ borderBottom: i < arr.length - 1 ? `0.5px solid ${dark ? "rgba(255,255,255,.08)" : "rgba(0,0,0,.06)"}` : "none" }}>
              <div>
                <div className="text-[13px] font-medium text-t-text">{title}</div>
                <div className="text-[11px] mt-0.5 text-t-text-muted">{desc}</div>
              </div>
              <Toggle on={on} onToggle={() => { setOn(!on); saveNotif(key, !on); }} accent={t.accent} />
            </div>
          ))}
        </SettingsModal>

        {/* ── SESSIONS MODAL ── */}
        <SettingsModal open={sessionsModalOpen} onClose={() => setSessionsModalOpen(false)} title="Active sessions" subtitle="Devices signed in to your account" icon={I_DEV} dark={dark} t={t}>
          <div className="text-[13px] mb-4 text-t-text-muted">Devices logged into your account. Max 1 web + 1 mobile.</div>
          {sessionsLoading ? (
            <SkelList dark={dark} rows={2} bare avatar="square" rowH={56} />
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

      </div>
    </>
  );
}

export function SettingsSidebar() {
  const jump = (id) => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "center" });
  return (
    <div className="rr">
      <RailSec>On this page</RailSec>
      <RailCard>
        {[["Change password", "set-change-password"], ["Notifications", "set-notifications"], ["Theme", "set-theme"], ["Active sessions", "set-active-sessions"], ["System status", "set-status"], ["API access", "set-api"], ["Log out", "set-account"], ["Account", "set-danger-zone"]].map(([label, id]) => (
          <RailJump key={id} label={label} onClick={() => jump(id)} />
        ))}
      </RailCard>
    </div>
  );
}

// Shared with the admin Settings page so both read the same.
export { Row as SettingsRow, SectionHead as SettingsSectionHead, I_LOCK, I_BELL, I_PULSE, I_OUT, I_CHEV, I_SUN, I_MOON, I_AUTO };
