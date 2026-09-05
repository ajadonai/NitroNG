'use client';
import { useEffect, useState } from "react";
import { Bone } from "./skeleton";
import { useConfirm } from "./confirm-dialog";
import { Modal } from "./ui-primitives";
import InlineAlert from "./inline-alert";
import { useToast } from "./toast";
import { SITE } from "../lib/site";
import { SettingsRow as Row, SettingsSectionHead as SectionHead, I_LOCK, I_BELL, I_PULSE, I_OUT, I_CHEV, I_SUN, I_MOON, I_AUTO } from "./settings-page";

// The shared Modal primitive carries the reference anatomy now — this wrapper
// only keeps the page's historical call signature.
function SettingsModal({ open, onClose, title, subtitle, icon, dark, t, children }) {
  return (
    <Modal open={open} onClose={onClose} dark={dark} maxWidth={480} title={title} subtitle={subtitle} icon={icon}>
      {children}
    </Modal>
  );
}

function CleanupRow({ dark, t }) {
  const confirm = useConfirm();
  const toast = useToast();
  const [info, setInfo] = useState(null);
  const [cleaning, setCleaning] = useState(false);
  useEffect(() => { fetch("/api/admin/cleanup").then(r => r.json()).then(d => setInfo(d)).catch(() => {}); }, []);
  const run = async () => {
    const ok = await confirm({ title: "Clean up stale accounts?", message: `${info?.staleCount || 0} unverified accounts older than ${info?.cutoffDays || 30} days are removed. Verified accounts are never touched.`, confirmLabel: "Clean up", danger: true });
    if (!ok) return;
    setCleaning(true);
    try {
      const res = await fetch("/api/admin/cleanup", { method: "POST" });
      const data = await res.json();
      if (res.ok) { toast.success("Cleaned up", data.message || ""); fetch("/api/admin/cleanup").then(r => r.json()).then(d => setInfo(d)).catch(() => {}); }
      else toast.error("Failed", data.error || "");
    } catch { toast.error("Request failed", "Check your connection"); }
    setCleaning(false);
  };
  return (
    <Row id="set-cleanup" icon={I_BROOM} title="Clean up stale accounts" sub={info ? `${info.unverifiedTotal || 0} unverified · ${info.staleCount || 0} safe to remove after ${info.cutoffDays || 30} days` : "Unverified accounts that never came back"} dark={dark} t={t}
      right={<button type="button" onClick={run} disabled={cleaning || !info?.staleCount} className="adm-btn-sm" style={{ borderColor: t.cardBorder, color: info?.staleCount ? (dark ? "#fcd34d" : "#b45309") : t.textMuted, opacity: cleaning ? .5 : 1 }}>{cleaning ? "Cleaning…" : "Clean up"}</button>} />
  );
}

const I_MAIL = <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-10 6L2 7"/></svg>;
const I_SHARE = <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4"/></svg>;
const I_GIFT = <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="20 12 20 22 4 22 4 12"/><rect x="2" y="7" width="20" height="5"/><line x1="12" y1="22" x2="12" y2="7"/><path d="M12 7H7.5a2.5 2.5 0 010-5C11 2 12 7 12 7zM12 7h4.5a2.5 2.5 0 000-5C13 2 12 7 12 7z"/></svg>;
const I_BROOM = <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M19 3l-7 7M4 21l6-6M9 15l-3-3 6-6 3 3z"/><path d="M4 21h5l2-2-5-5-2 2z"/></svg>;

export function AdminSettingsPage({ admin, dark, t, themeMode, setThemeMode, setDark, onLogout, notifPrefs, updateNotifPref }) {
  const [social, setSocial] = useState({ social_instagram: "", social_twitter: "", social_whatsapp_support: "", social_whatsapp_reseller: "", social_whatsapp_channel: "", social_telegram_support: "", social_tiktok: "", discord_bot_url: "", discord_bot_url_premium: "" });
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
        setSocial(prev => ({ ...prev, ...Object.fromEntries(Object.entries(d.settings).filter(([k]) => k.startsWith("social_") || k.startsWith("discord_bot_url"))) }));
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
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMsg, setProfileMsg] = useState(null);

  useEffect(() => { setEditName(admin?.name || ""); setEditEmail(admin?.email || ""); }, [admin?.name, admin?.email]);

  const saveProfile = async () => {
    setProfileSaving(true); setProfileMsg(null);
    try {
      const res = await fetch("/api/auth/admin/profile", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "update-profile", name: editName, email: editEmail }) });
      const data = await res.json();
      if (res.ok) { setProfileMsg({ type: "success", text: "Profile updated" }); setProfileModalOpen(false); } else setProfileMsg({ type: "error", text: data.error || "Failed" });
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

  const cardBg = t.cardBg;
  const admInputStyle = { borderColor: t.cardBorder, background: dark ? "#160f22" : "#fff", color: t.text };
  const card = { background: cardBg, border: `1px solid ${t.cardBorder}` };
  const initials = (admin?.name || "A").split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase();
  const notifOn = notifPrefs ? Object.values(notifPrefs).filter(Boolean).length : null;
  const themeBtn = (id, label, icon) => (
    <button key={id} onClick={() => applyTheme(id)} aria-pressed={themeMode === id} className="inline-flex items-center gap-1 h-[26px] px-2.5 rounded-full border-none font-[inherit] text-[11.5px] font-semibold cursor-pointer" style={themeMode === id ? { background: dark ? "#1a1329" : "#fff", color: t.text, boxShadow: "0 1px 3px rgba(0,0,0,.12)" } : { background: "transparent", color: t.textMuted }}>{icon}{label}</button>
  );

  return (
    <>
      <div className="adm-header">
        <div className="adm-title" style={{ color: t.text }}>Settings</div>
        <div className="adm-subtitle" style={{ color: t.textMuted }}>Your account, and what the site shows and sends.</div>
        <div className="page-divider" style={{ background: t.cardBorder }} />
      </div>

      <div className="desktop:grid desktop:grid-cols-2 desktop:gap-x-4 desktop:items-start">
        <div>
          {/* ── Profile ── */}
          <div className="flex items-center gap-3 rounded-[14px] p-3.5 mb-2" style={card}>
            <div className="w-[52px] h-[52px] rounded-[14px] flex items-center justify-center text-white text-[17px] font-bold shrink-0" style={{ background: "linear-gradient(135deg, #c47d8e, #8b5e6b)" }}>{initials}</div>
            <div className="flex flex-col gap-[3px] min-w-0">
              <div className="text-[16px] font-semibold truncate" style={{ color: t.text }}>{admin?.name || "Admin"}</div>
              <div className="text-[11.5px] font-semibold uppercase tracking-[.6px]" style={{ color: t.accent }}>{admin?.role || "admin"}</div>
            </div>
          </div>
          <div className="rounded-[14px] px-3.5 mb-[18px]" style={card}>
            {[["Email", admin?.email || "—"], ["Role", admin?.role || "admin"]].map(([label, val], i) => (
              <div key={label} className="flex items-center justify-between gap-3 py-2.5 text-[13px]" style={{ color: t.textMuted, borderTop: i > 0 ? `1px solid ${t.cardBorder}` : "none" }}>
                <span>{label}</span>
                <b className="text-[13px] font-semibold truncate" style={{ color: t.text }}>{val}</b>
              </div>
            ))}
            <button type="button" onClick={() => { setProfileMsg(null); setProfileModalOpen(true); }} className="w-full text-left py-2 text-[12.5px] font-semibold bg-transparent border-none cursor-pointer font-[inherit]" style={{ color: t.accent, borderTop: `1px solid ${t.cardBorder}` }}>Edit name or email</button>
          </div>
        </div>

        <div>
          <SectionHead>Account</SectionHead>
          <div className="rounded-[14px] overflow-hidden mb-[18px]" style={card}>
            <Row id="set-change-password" first icon={I_LOCK} title="Change password" sub="Keep your admin login secure" onClick={() => { setAdmPwMsg(null); setPwModalOpen(true); }} dark={dark} t={t} />
            <Row id="set-notifications" icon={I_BELL} title="Notifications" sub={notifOn != null ? `${notifOn} of 6 alerts on` : "Which events alert you"} onClick={() => setNotifModalOpen(true)} dark={dark} t={t} />
          </div>
        </div>

        <div>
          <SectionHead>Site</SectionHead>
          <div className="rounded-[14px] overflow-hidden mb-[18px]" style={card}>
            <Row id="set-emails" first icon={I_MAIL} title="Contact emails" sub={socialLoading ? <Bone dark={dark} w={160} h={9} style={{ display: "inline-block", verticalAlign: "middle" }} /> : (emails.site_email_general || "Not set")} onClick={() => { setEmailMsg(null); setEmailModalOpen(true); }} dark={dark} t={t} />
            <Row id="set-social" icon={I_SHARE} title="Social links" sub="Instagram, X, TikTok, WhatsApp, Telegram, the Discord bot" onClick={() => { setSocialMsg(null); setSocialModalOpen(true); }} dark={dark} t={t} />
            <Row id="set-winback" icon={I_GIFT} title="Win-back credits" sub={`Day 30: ${winback.winback30_pct || 0}% · Day 60: ${winback.winback60_pct || 0}% · expire in ${winback.winback_credit_expiry_days || 7} days`} onClick={() => { setWinbackMsg(null); setWinbackModalOpen(true); }} dark={dark} t={t} />
          </div>
        </div>

        <div>
          <SectionHead>Appearance</SectionHead>
          <div className="rounded-[14px] overflow-hidden mb-[18px]" style={card}>
            <Row id="set-theme" first icon={dark ? I_MOON : I_SUN} title="Theme" sub={themeMode === "auto" ? "Auto: light 6:30am to 6:30pm, dark otherwise" : "Choose how the admin looks"} dark={dark} t={t}
              right={<span className="inline-flex p-[3px] rounded-full" style={{ background: dark ? "rgba(255,255,255,.08)" : "rgba(0,0,0,.05)", border: `1px solid ${t.cardBorder}` }}>{themeBtn("auto", "Auto", I_AUTO)}{themeBtn("day", "Light", I_SUN)}{themeBtn("night", "Dark", I_MOON)}</span>} />
          </div>
          <SectionHead>System</SectionHead>
          <div className="rounded-[14px] overflow-hidden mb-[18px]" style={card}>
            <Row id="set-status" first icon={I_PULSE} title="System status" sub="Check that every Nitro service is running" href={SITE.status} right={<span className="w-[9px] h-[9px] rounded-full" style={{ background: "#059669", boxShadow: "0 0 0 3px rgba(5,150,105,.15)" }} />} dark={dark} t={t} />
            <CleanupRow dark={dark} t={t} />
          </div>
        </div>

        <div className="desktop:col-span-2">
          <div className="rounded-[14px] overflow-hidden mb-4" style={card}>
            <Row id="set-logout" first icon={I_OUT} title="Log out" sub="Of this device" onClick={onLogout} right={I_CHEV} dark={dark} t={t} />
          </div>
        </div>
      </div>

      <SettingsModal open={profileModalOpen} onClose={() => setProfileModalOpen(false)} title="Edit profile" dark={dark} t={t}>
        {profileMsg && <InlineAlert type={profileMsg.type} dark={dark} className="mb-3">{profileMsg.text}</InlineAlert>}
        <div className="mb-3">
          <label className="text-sm block mb-1" style={{ color: t.textMuted }}>Name</label>
          <input value={editName} onChange={e => setEditName(e.target.value)} className="w-full py-2.5 px-3.5 rounded-lg text-[15px] outline-none border" style={admInputStyle} />
        </div>
        <div className="mb-3">
          <label className="text-sm block mb-1" style={{ color: t.textMuted }}>Email</label>
          <input value={editEmail} onChange={e => setEditEmail(e.target.value)} className="w-full py-2.5 px-3.5 rounded-lg text-[15px] outline-none border" style={admInputStyle} />
        </div>
        <div className="text-[12.5px] mb-4" style={{ color: t.textMuted }}>Role: <b style={{ color: t.text }}>{admin?.role || "admin"}</b> — set by the owner, not here.</div>
        <button onClick={saveProfile} disabled={profileSaving} className="adm-btn-primary" style={{ opacity: profileSaving ? .5 : 1 }}>{profileSaving ? "Saving…" : "Save changes"}</button>
      </SettingsModal>

      <SettingsModal open={pwModalOpen} onClose={() => setPwModalOpen(false)} title="Change password" subtitle="Your admin login" icon={I_LOCK} dark={dark} t={t}>
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
          ["social_whatsapp_support", "WhatsApp Number", "2348012345678", "The general support line (Dash). Every customer-facing WhatsApp button uses this. Any format — spaces, dashes, + prefix all stripped automatically"],
          ["social_whatsapp_reseller", "Reseller WhatsApp Number", "2348012345678", "Reseller HQ and reseller pages message this number instead. Leave blank and they use the main WhatsApp number"],
          ["social_whatsapp_channel", "WhatsApp Channel URL", "https://whatsapp.com/channel/...", "Full URL to your WhatsApp channel page"],
          ["social_telegram_support", "Telegram Handle", "TheNitroNG", "Handle, @handle, or full URL — all work"],
          ["discord_bot_url", "Discord Bot Link — Standard", "https://nowon.tools", "Shown in the Discord order setup steps for Standard tiers. Providers change this bot without notice — update it here when it changes."],
          ["discord_bot_url_premium", "Discord Bot Link — Premium", "https://ysecret.com.br/apple", "The Premium tiers use a different provider bot. Leave blank to use the Standard link."],
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

      <SettingsModal open={notifModalOpen} onClose={() => setNotifModalOpen(false)} title="Notifications" subtitle="What the team gets pinged about" icon={I_BELL} dark={dark} t={t}>
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

    </>
  );
}
