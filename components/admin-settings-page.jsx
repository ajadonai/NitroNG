'use client';
import { useEffect, useState } from "react";
import { useConfirm } from "./confirm-dialog";
import InlineAlert from "./inline-alert";

function SettingsModal({ open, onClose, title, dark, t, children }) {
  useEffect(() => {
    if (open) document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, [open]);
  if (!open) return null;
  return (
    <div onClick={onClose} className="fixed inset-0 z-[200] flex items-center justify-center" style={{ background: "rgba(0,0,0,.55)", backdropFilter: "blur(6px)" }}>
      <div onClick={e => e.stopPropagation()} className="w-full max-w-[480px] mx-4 rounded-2xl" style={{ background: dark ? "#131728" : "#fff", border: `1px solid ${dark ? "rgba(255,255,255,.12)" : "rgba(0,0,0,.08)"}`, boxShadow: "0 24px 48px rgba(0,0,0,.35)", maxHeight: "85vh", overflowY: "auto" }}>
        <div className="flex items-center justify-between py-4 px-5" style={{ borderBottom: `1px solid ${dark ? "rgba(255,255,255,.08)" : "rgba(0,0,0,.06)"}` }}>
          <div className="text-[16px] font-bold" style={{ color: t.text }}>{title}</div>
          <button onClick={onClose} className="border-none cursor-pointer p-1" style={{ background: "none", color: t.textMuted }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <div className="px-5 py-4">{children}</div>
      </div>
    </div>
  );
}

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
      {info && <div className="text-sm mb-2.5" style={{ color: t.text }}>{info.unverifiedTotal || 0} unverified accounts total · {info.staleCount || 0} safe to remove after {info.cutoffDays || 30} days</div>}
      {result && <div className="py-2 px-3 rounded-lg mb-2.5 text-sm" style={{ background: result.type === "success" ? (dark ? "rgba(110,231,183,.08)" : "#ecfdf5") : (dark ? "rgba(220,38,38,.08)" : "#fef2f2"), color: result.type === "success" ? (dark ? "#6ee7b7" : "#059669") : (dark ? "#fca5a5" : "#dc2626") }}>{result.type === "success" ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{display:"inline",verticalAlign:"middle"}}><polyline points="20 6 9 17 4 12"/></svg> : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{display:"inline",verticalAlign:"middle"}}><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>} {result.text}</div>}
      <button onClick={run} disabled={cleaning} className="adm-btn-primary" style={{ opacity: cleaning ? .5 : 1 }}>{cleaning ? "Cleaning..." : "Clean Up Stale Accounts"}</button>
    </>
  );
}

export function AdminSettingsPage({ admin, dark, t, themeMode, setThemeMode, setDark, onLogout, notifPrefs, updateNotifPref }) {
  const confirm = useConfirm();
  const [social, setSocial] = useState({ social_instagram: "", social_twitter: "", social_whatsapp_support: "", social_whatsapp_channel: "", social_telegram_support: "", social_tiktok: "", discord_bot_url: "" });
  const [emails, setEmails] = useState({ site_email_general: "", site_email_support: "" });
  const [socialLoading, setSocialLoading] = useState(true);
  const [socialSaving, setSocialSaving] = useState(false);
  const [socialMsg, setSocialMsg] = useState(null);
  const [emailSaving, setEmailSaving] = useState(false);
  const [emailMsg, setEmailMsg] = useState(null);
  const [winback, setWinback] = useState({ winback30_pct: "15", winback30_min_naira: "100", winback30_cap_naira: "500", winback60_pct: "25", winback60_min_naira: "150", winback60_cap_naira: "1000", winback_credit_expiry_days: "7" });
  const [winbackSaving, setWinbackSaving] = useState(false);
  const [winbackMsg, setWinbackMsg] = useState(null);
  const [pwModalOpen, setPwModalOpen] = useState(false);
  const [emailModalOpen, setEmailModalOpen] = useState(false);
  const [socialModalOpen, setSocialModalOpen] = useState(false);
  const [winbackModalOpen, setWinbackModalOpen] = useState(false);
  const [notifModalOpen, setNotifModalOpen] = useState(false);

  useEffect(() => {
    fetch("/api/admin/settings").then(r => r.json()).then(d => {
      if (d.settings) {
        // Filtering on the social_ prefix alone would drop discord_bot_url, which
        // shares this form and save path — it would save and then reload blank.
        setSocial(prev => ({ ...prev, ...Object.fromEntries(Object.entries(d.settings).filter(([k]) => k.startsWith("social_") || k === "discord_bot_url")) }));
        setEmails(prev => ({ ...prev, ...Object.fromEntries(Object.entries(d.settings).filter(([k]) => k.startsWith("site_email_"))) }));
        setWinback(prev => ({ ...prev, ...Object.fromEntries(Object.entries(d.settings).filter(([k]) => k.startsWith("winback"))) }));
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

  const saveEmails = async () => {
    setEmailSaving(true); setEmailMsg(null);
    try {
      const res = await fetch("/api/admin/settings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ settings: emails }) });
      const data = await res.json();
      setEmailMsg(res.ok ? { type: "success", text: "Contact emails saved" } : { type: "error", text: data.error || "Failed" });
    } catch { setEmailMsg({ type: "error", text: "Request failed" }); }
    setEmailSaving(false);
  };

  const saveWinback = async () => {
    setWinbackSaving(true); setWinbackMsg(null);
    try {
      const res = await fetch("/api/admin/settings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ settings: winback }) });
      const data = await res.json();
      setWinbackMsg(res.ok ? { type: "success", text: "Win-back settings saved" } : { type: "error", text: data.error || "Failed" });
    } catch { setWinbackMsg({ type: "error", text: "Request failed" }); }
    setWinbackSaving(false);
  };

  const applyTheme = (mode) => {
    setThemeMode(mode);
    try { localStorage.setItem("nitro-admin-theme", mode); } catch {}
    if (mode === "day") setDark(false);
    else if (mode === "night") setDark(true);
    else { const h = new Date().getHours(), m = new Date().getMinutes(); setDark(h >= 19 || h < 6 || (h === 6 && m < 30) || (h === 18 && m >= 30)); }
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

  const cardBg = dark ? "rgba(255,255,255,.09)" : "rgba(255,255,255,.85)";
  const cardBorder = `0.5px solid ${t.cardBorder}`;
  const admInputStyle = { borderColor: t.cardBorder, background: dark ? "#131728" : "#fff", color: t.text };

  return (
    <>
      <div className="adm-header">
        <div className="adm-title" style={{ color: t.text }}>Settings</div>
        <div className="adm-subtitle" style={{ color: t.textMuted }}>Admin preferences and configuration</div>
        <div className="page-divider" style={{ background: t.cardBorder }} />
      </div>

      {/* ── PROFILE HERO ── */}
      <div className="mb-4 overflow-hidden rounded-[14px] max-desktop:rounded-xl" style={{ background: cardBg, border: cardBorder }}>
        <div className="h-[72px] max-md:h-16" style={{ background: "linear-gradient(135deg, #c47d8e 0%, #a3586b 50%, #8b5e6b 100%)" }} />
        <div className="px-5 pb-5 max-desktop:px-4 max-desktop:pb-4">
          <div className="w-[56px] h-[56px] max-md:w-12 max-md:h-12 rounded-2xl flex items-center justify-center text-white shrink-0 shadow-lg border-[3px] -mt-8 max-md:-mt-7 mb-3" style={{ background: "linear-gradient(135deg, #c47d8e, #8b5e6b)", borderColor: dark ? "#0e1225" : "#f3f0ec" }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
          </div>
          {profileMsg && <InlineAlert type={profileMsg.type} dark={dark} className="mb-3">{profileMsg.text}</InlineAlert>}
          {profileEditing ? (
            <>
              <div className="mb-3">
                <label className="text-sm block mb-1" style={{ color: t.textMuted }}>Name</label>
                <input value={editName} onChange={e => setEditName(e.target.value)} className="w-full py-2.5 px-3.5 rounded-lg text-[15px] outline-none border" style={admInputStyle} />
              </div>
              <div className="mb-3">
                <label className="text-sm block mb-1" style={{ color: t.textMuted }}>Email</label>
                <input value={editEmail} onChange={e => setEditEmail(e.target.value)} className="w-full py-2.5 px-3.5 rounded-lg text-[15px] outline-none border" style={admInputStyle} />
              </div>
              <div className="mb-2">
                <div className="text-[13px] uppercase tracking-wide mb-0.5" style={{ color: t.textMuted }}>Role</div>
                <div className="text-[15px] font-medium" style={{ color: t.textMuted }}>{admin?.role || "admin"} (cannot be changed)</div>
              </div>
              <div className="flex gap-2 mt-3.5">
                <button onClick={saveProfile} disabled={profileSaving} className="adm-btn-primary" style={{ opacity: profileSaving ? .5 : 1 }}>{profileSaving ? "Saving..." : "Save"}</button>
                <button onClick={() => { setProfileEditing(false); setEditName(admin?.name || ""); setEditEmail(admin?.email || ""); setProfileMsg(null); }} className="py-2 px-4 rounded-lg bg-none text-sm cursor-pointer transition-transform duration-200 hover:-translate-y-px flex items-center justify-center" style={{ border: `1px solid ${t.cardBorder}`, color: t.textSoft }}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center justify-between mb-1">
                <div className="text-lg font-semibold" style={{ color: t.text }}>{admin?.name || "Admin"}</div>
                <button onClick={() => setProfileEditing(true)} className="text-[13px] bg-none border-none cursor-pointer transition-transform duration-200 hover:-translate-y-px flex items-center gap-1" style={{ color: t.accent }}><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
              </div>
              <div className="grid grid-cols-3 max-md:grid-cols-1 gap-y-3 gap-x-6 mt-3">
                {[["Email", admin?.email || ""], ["Role", admin?.role || "admin"]].map(([label, val]) => (
                  <div key={label}><div className="text-[11px] font-semibold tracking-[.8px] uppercase mb-[3px]" style={{ color: t.textMuted }}>{label}</div><div className="text-[15px] font-medium" style={{ color: t.text }}>{val}</div></div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── SETTINGS GRID ── */}
      <div className="grid grid-cols-2 max-md:grid-cols-1 gap-4">

        {/* ── NOTIFICATIONS ── */}
        <div className="set-card" style={{ background: cardBg, border: cardBorder, cursor: "pointer" }} onClick={() => setNotifModalOpen(true)}>
          <div className="flex items-center gap-3 p-4">
            <div className="w-9 h-9 rounded-[10px] flex items-center justify-center shrink-0" style={{ background: dark ? "rgba(196,125,142,.12)" : "rgba(196,125,142,.08)" }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={t.accent} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></svg>
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[14px] font-semibold" style={{ color: t.text }}>Notifications</div>
              <div className="text-[12.5px] mt-0.5" style={{ color: t.textMuted }}>{notifPrefs ? `${Object.values(notifPrefs).filter(Boolean).length} of 6 alerts enabled` : "Configure alert preferences"}</div>
            </div>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={t.textMuted} strokeWidth="2" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>
          </div>
        </div>

        {/* ── CHANGE PASSWORD ── */}
        <div className="set-card" style={{ background: cardBg, border: cardBorder, cursor: "pointer" }} onClick={() => setPwModalOpen(true)}>
          <div className="flex items-center gap-3 p-4">
            <div className="w-9 h-9 rounded-[10px] flex items-center justify-center shrink-0" style={{ background: dark ? "rgba(196,125,142,.12)" : "rgba(196,125,142,.08)" }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={t.accent} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[14px] font-semibold" style={{ color: t.text }}>Change password</div>
              <div className="text-[12.5px] mt-0.5" style={{ color: t.textMuted }}>Update your admin password regularly</div>
            </div>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={t.textMuted} strokeWidth="2" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>
          </div>
        </div>

        {/* ── CONTACT EMAILS ── */}
        <div className="set-card" style={{ background: cardBg, border: cardBorder, cursor: "pointer" }} onClick={() => setEmailModalOpen(true)}>
          <div className="flex items-center gap-3 p-4">
            <div className="w-9 h-9 rounded-[10px] flex items-center justify-center shrink-0" style={{ background: dark ? "rgba(196,125,142,.12)" : "rgba(196,125,142,.08)" }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={t.accent} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[14px] font-semibold" style={{ color: t.text }}>Contact emails</div>
              <div className="text-[12.5px] mt-0.5 truncate" style={{ color: t.textMuted }}>{[emails.site_email_general, emails.site_email_support].filter(Boolean).join(" · ") || "Not configured"}</div>
            </div>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={t.textMuted} strokeWidth="2" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>
          </div>
        </div>

        {/* ── SOCIAL LINKS ── */}
        <div className="set-card" style={{ background: cardBg, border: cardBorder, cursor: "pointer" }} onClick={() => setSocialModalOpen(true)}>
          <div className="flex items-center gap-3 p-4">
            <div className="w-9 h-9 rounded-[10px] flex items-center justify-center shrink-0" style={{ background: dark ? "rgba(196,125,142,.12)" : "rgba(196,125,142,.08)" }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={t.accent} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[14px] font-semibold" style={{ color: t.text }}>Social links</div>
              <div className="text-[12.5px] mt-0.5 truncate" style={{ color: t.textMuted }}>{[social.social_instagram && "Instagram", social.social_twitter && "X", social.social_tiktok && "TikTok", social.social_whatsapp_support && "WhatsApp", social.social_telegram_support && "Telegram"].filter(Boolean).join(" · ") || "Not configured"}</div>
            </div>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={t.textMuted} strokeWidth="2" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>
          </div>
        </div>

        {/* ── WIN-BACK CREDITS ── */}
        <div className="set-card" style={{ background: cardBg, border: cardBorder, cursor: "pointer" }} onClick={() => setWinbackModalOpen(true)}>
          <div className="flex items-center gap-3 p-4">
            <div className="w-9 h-9 rounded-[10px] flex items-center justify-center shrink-0" style={{ background: dark ? "rgba(196,125,142,.12)" : "rgba(196,125,142,.08)" }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={t.accent} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 1v22"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[14px] font-semibold" style={{ color: t.text }}>Win-back credits</div>
              <div className="text-[12.5px] mt-0.5" style={{ color: t.textMuted }}>Day 30: {winback.winback30_pct || 15}% · Day 60: {winback.winback60_pct || 25}% · Expires {winback.winback_credit_expiry_days || 7}d</div>
            </div>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={t.textMuted} strokeWidth="2" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>
          </div>
        </div>

        {/* ── THEME ── */}
        <div className="set-card" style={{ background: cardBg, border: cardBorder }}>
          <div className="set-card-header" style={{ background: dark ? "rgba(196,125,142,.18)" : "rgba(196,125,142,.12)", borderBottom: `1px solid ${dark ? "rgba(255,255,255,.12)" : "rgba(0,0,0,.08)"}` }}>
            <div className="set-card-title" style={{ color: t.textMuted }}>Theme</div>
            <div className="set-card-desc" style={{ color: t.textMuted }}>Choose how Nitro looks for you.</div>
          </div>
          <div className="set-card-body">
          <div className="flex gap-2">
            {[
              ["day", "Light", <svg key="s" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>],
              ["night", "Dark", <svg key="m" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/></svg>],
              ["auto", "Auto", <svg key="a" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 3a9 9 0 000 18z" fill="currentColor" opacity=".4"/></svg>],
            ].map(([id, lb, icon]) => (
              <button key={id} onClick={() => applyTheme(id)} className="flex-1 py-3 px-2.5 rounded-[10px] border text-[15px] flex items-center justify-center gap-1.5" style={{ borderColor: themeMode === id ? t.accent : t.cardBorder, background: themeMode === id ? (dark ? "#2a1a22" : "#fdf2f4") : (dark ? "rgba(255,255,255,.12)" : "rgba(255,255,255,.8)"), color: themeMode === id ? t.accent : t.textSoft, fontWeight: themeMode === id ? 600 : 500 }}>{icon} {lb}</button>
            ))}
          </div>
          </div>
        </div>

        {/* ── CLEANUP ── */}
        <div className="set-card" style={{ background: cardBg, border: cardBorder }}>
          <div className="set-card-header" style={{ background: dark ? "rgba(196,125,142,.18)" : "rgba(196,125,142,.12)", borderBottom: `1px solid ${dark ? "rgba(255,255,255,.12)" : "rgba(0,0,0,.08)"}` }}>
            <div className="set-card-title" style={{ color: t.textMuted }}>Cleanup</div>
            <div className="set-card-desc" style={{ color: t.textMuted }}>Free up space by removing stale accounts.</div>
          </div>
          <div className="set-card-body">
          <div className="text-sm mb-3 leading-normal" style={{ color: t.textMuted }}>Remove abandoned, unverified signups older than 30 days only when they have no recent activity or related records.</div>
          <CleanupButton dark={dark} t={t} />
          </div>
        </div>

      </div>

      {/* ── MODALS ── */}
      <SettingsModal open={pwModalOpen} onClose={() => setPwModalOpen(false)} title="Change password" dark={dark} t={t}>
        {admPwMsg && <InlineAlert type={admPwMsg.type} dark={dark} className="mb-3">{admPwMsg.text}</InlineAlert>}
        <div className="mb-3">
          <label className="text-sm block mb-1" style={{ color: t.textMuted }}>Current Password</label>
          <input type="password" value={admCurPw} onChange={e => setAdmCurPw(e.target.value)} className="w-full py-2.5 px-3.5 rounded-lg text-[15px] outline-none border" style={admInputStyle} />
        </div>
        <div className="mb-3">
          <label className="text-sm block mb-1" style={{ color: t.textMuted }}>New Password</label>
          <input type="password" value={admNewPw} onChange={e => setAdmNewPw(e.target.value)} className="w-full py-2.5 px-3.5 rounded-lg text-[15px] outline-none border" style={admInputStyle} />
        </div>
        <div className="mb-3">
          <label className="text-sm block mb-1" style={{ color: t.textMuted }}>Confirm Password</label>
          <input type="password" value={admConfPw} onChange={e => setAdmConfPw(e.target.value)} className="w-full py-2.5 px-3.5 rounded-lg text-[15px] outline-none border" style={admInputStyle} />
        </div>
        <button onClick={changeAdmPw} disabled={pwSaving} className="adm-btn-primary" style={{ opacity: admCurPw && admNewPw && admConfPw && !pwSaving ? 1 : .4 }}>{pwSaving ? "Updating..." : "Update Password"}</button>
      </SettingsModal>

      <SettingsModal open={emailModalOpen} onClose={() => setEmailModalOpen(false)} title="Contact emails" dark={dark} t={t}>
        <div className="text-[13px] mb-4" style={{ color: t.textMuted }}>Shown across the site — landing page, support, legal pages, and account notices.</div>
        {emailMsg && <InlineAlert type={emailMsg.type} dark={dark} className="mb-3">{emailMsg.text}</InlineAlert>}
        {[
          ["site_email_general", "General Email", "info@nitro.ng", "Main contact email shown on landing page and legal pages"],
          ["site_email_support", "Support Email", "support@nitro.ng", "Support-specific email shown on support, tickets, and banned account pages"],
        ].map(([key, label, placeholder, hint]) => (
          <div key={key} className="mb-3">
            <label className="text-sm block mb-0.5" style={{ color: t.textMuted }}>{label}</label>
            <input value={emails[key] || ""} onChange={e => setEmails(prev => ({ ...prev, [key]: e.target.value.trim() }))} placeholder={placeholder} type="email" className="w-full py-2.5 px-3.5 rounded-lg text-[15px] outline-none border font-[inherit]" style={admInputStyle} />
            <div className="text-xs mt-0.5 opacity-70" style={{ color: t.textMuted }}>{hint}</div>
          </div>
        ))}
        <button onClick={saveEmails} disabled={emailSaving} className="adm-btn-primary" style={{ opacity: emailSaving ? .5 : 1 }}>{emailSaving ? "Saving..." : "Save Emails"}</button>
      </SettingsModal>

      <SettingsModal open={socialModalOpen} onClose={() => setSocialModalOpen(false)} title="Social links" dark={dark} t={t}>
        <div className="text-[13px] mb-4" style={{ color: t.textMuted }}>Shown in sidebar, landing page footer, and support page. Leave blank to hide.</div>
        {socialMsg && <InlineAlert type={socialMsg.type} dark={dark} className="mb-3">{socialMsg.text}</InlineAlert>}
        {[
          ["social_instagram", "Instagram Handle", "Nitro.ng", "Handle, @handle, or full URL — all work"],
          ["social_twitter", "X / Twitter Handle", "TheNitroNG", "Handle, @handle, or full URL — all work"],
          ["social_tiktok", "TikTok Handle", "nitro.ng", "Handle, @handle, or full URL — all work"],
          ["social_whatsapp_support", "WhatsApp Number", "2348012345678", "Any format — spaces, dashes, + prefix all stripped automatically"],
          ["social_whatsapp_channel", "WhatsApp Channel URL", "https://whatsapp.com/channel/...", "Full URL to your WhatsApp channel page"],
          ["social_telegram_support", "Telegram Handle", "TheNitroNG", "Handle, @handle, or full URL — all work"],
          ["discord_bot_url", "Discord Bot Link", "https://nowon.tools", "Shown in the Discord order setup steps. Providers change this bot without notice — update it here when it changes."],
        ].map(([key, label, placeholder, hint]) => (
          <div key={key} className="mb-3">
            <label className="text-sm block mb-0.5" style={{ color: t.textMuted }}>{label}</label>
            <input value={social[key] || ""} onChange={e => setSocial(prev => ({ ...prev, [key]: e.target.value }))} placeholder={placeholder} className="w-full py-2.5 px-3.5 rounded-lg text-[15px] outline-none border font-[inherit]" style={admInputStyle} />
            <div className="text-xs mt-0.5 opacity-70" style={{ color: t.textMuted }}>{hint}</div>
          </div>
        ))}
        <button onClick={saveSocial} disabled={socialSaving} className="adm-btn-primary" style={{ opacity: socialSaving ? .5 : 1 }}>{socialSaving ? "Saving..." : "Save Social Links"}</button>
      </SettingsModal>

      <SettingsModal open={winbackModalOpen} onClose={() => setWinbackModalOpen(false)} title="Win-back credits" dark={dark} t={t}>
        <div className="text-[13px] mb-4" style={{ color: t.textMuted }}>Configure bonus credit amounts for the automated win-back sequence (Play 7).</div>
        {winbackMsg && <InlineAlert type={winbackMsg.type} dark={dark} className="mb-3">{winbackMsg.text}</InlineAlert>}
        <div className="text-[11px] font-semibold tracking-[.8px] uppercase mb-2" style={{ color: t.textMuted }}>Day 30 touch</div>
        {[
          ["winback30_pct", "Credit %", "15", "Percentage of lifetime spend"],
          ["winback30_min_naira", "Floor (₦)", "100", "Minimum credit in naira"],
          ["winback30_cap_naira", "Cap (₦)", "500", "Maximum credit in naira"],
        ].map(([key, label, placeholder, hint]) => (
          <div key={key} className="mb-3">
            <label className="text-sm block mb-0.5" style={{ color: t.textMuted }}>{label}</label>
            <input value={winback[key] || ""} onChange={e => setWinback(prev => ({ ...prev, [key]: e.target.value }))} placeholder={placeholder} type="number" className="w-full py-2.5 px-3.5 rounded-lg text-[15px] outline-none border font-[inherit]" style={admInputStyle} />
            <div className="text-xs mt-0.5 opacity-70" style={{ color: t.textMuted }}>{hint}</div>
          </div>
        ))}
        <div className="text-[11px] font-semibold tracking-[.8px] uppercase mb-2 mt-4" style={{ color: t.textMuted }}>Day 60 touch</div>
        {[
          ["winback60_pct", "Credit %", "25", "Percentage of lifetime spend"],
          ["winback60_min_naira", "Floor (₦)", "150", "Minimum credit in naira"],
          ["winback60_cap_naira", "Cap (₦)", "1000", "Maximum credit in naira"],
        ].map(([key, label, placeholder, hint]) => (
          <div key={key} className="mb-3">
            <label className="text-sm block mb-0.5" style={{ color: t.textMuted }}>{label}</label>
            <input value={winback[key] || ""} onChange={e => setWinback(prev => ({ ...prev, [key]: e.target.value }))} placeholder={placeholder} type="number" className="w-full py-2.5 px-3.5 rounded-lg text-[15px] outline-none border font-[inherit]" style={admInputStyle} />
            <div className="text-xs mt-0.5 opacity-70" style={{ color: t.textMuted }}>{hint}</div>
          </div>
        ))}
        <div className="text-[11px] font-semibold tracking-[.8px] uppercase mb-2 mt-4" style={{ color: t.textMuted }}>General</div>
        <div className="mb-3">
          <label className="text-sm block mb-0.5" style={{ color: t.textMuted }}>Expiry (days)</label>
          <input value={winback["winback_credit_expiry_days"] || ""} onChange={e => setWinback(prev => ({ ...prev, winback_credit_expiry_days: e.target.value }))} placeholder="7" type="number" className="w-full py-2.5 px-3.5 rounded-lg text-[15px] outline-none border font-[inherit]" style={admInputStyle} />
          <div className="text-xs mt-0.5 opacity-70" style={{ color: t.textMuted }}>Days before bonus credit expires</div>
        </div>
        <button onClick={saveWinback} disabled={winbackSaving} className="adm-btn-primary" style={{ opacity: winbackSaving ? .5 : 1 }}>{winbackSaving ? "Saving..." : "Save Win-back Settings"}</button>
      </SettingsModal>

      <SettingsModal open={notifModalOpen} onClose={() => setNotifModalOpen(false)} title="Notifications" dark={dark} t={t}>
        <div className="text-[13px] mb-4" style={{ color: t.textMuted }}>Choose which events trigger alerts for you.</div>
        {notifPrefs && updateNotifPref ? (
          <div className="flex flex-col gap-3">
            {[
              ["new_ticket", "New tickets", "Alert when a user opens a new support ticket"],
              ["ticket_reply", "Ticket replies", "Alert when a user sends a new message in a ticket"],
              ["deposit", "Deposits", "Alert when a user completes a deposit"],
              ["large_deposit", "Large deposits", "Alert for deposits above the large-deposit threshold"],
              ["stale_ticket", "Stale tickets", "Escalation alert for unanswered tickets (15+ min)"],
              ["price_alert", "Price alerts", "Alert when services are selling below provider cost"],
            ].map(([key, label, hint]) => (
              <label key={key} className="flex items-center justify-between gap-3 cursor-pointer py-1.5">
                <div>
                  <div className="text-[14px] font-medium" style={{ color: t.text }}>{label}</div>
                  <div className="text-[12px] mt-0.5" style={{ color: t.textMuted }}>{hint}</div>
                </div>
                <button
                  onClick={() => updateNotifPref(key, !notifPrefs[key])}
                  className="relative shrink-0 w-[40px] h-[22px] rounded-full transition-colors duration-200"
                  style={{ background: notifPrefs[key] ? t.accent : (dark ? "rgba(255,255,255,.15)" : "rgba(0,0,0,.12)") }}
                >
                  <span className="absolute top-[2px] left-[2px] w-[18px] h-[18px] rounded-full bg-white shadow-sm transition-transform duration-200" style={{ transform: notifPrefs[key] ? "translateX(18px)" : "translateX(0)" }} />
                </button>
              </label>
            ))}
          </div>
        ) : (
          <div className="text-sm" style={{ color: t.textMuted }}>Notification preferences unavailable.</div>
        )}
      </SettingsModal>

      {/* ── LOG OUT ── */}
      <div className="mt-4">
        <button onClick={onLogout} className="flex items-center justify-center gap-2 w-full py-3 px-5 rounded-[10px] bg-none cursor-pointer text-[15px] font-semibold font-[inherit] transition-transform duration-200 hover:-translate-y-px" style={{ border: `1px solid ${dark ? "rgba(252,165,165,.28)" : "rgba(220,38,38,.24)"}`, color: dark ? "#fca5a5" : "#dc2626" }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
          Log out
        </button>
      </div>
    </>
  );
}

