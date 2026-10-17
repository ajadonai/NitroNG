'use client';
import { useState, useEffect } from "react";
import { RailSec, RailCard, RailJump } from "./rail";
import { SkelList } from "./skeleton";
import { Modal } from "./ui-primitives";
import { useConfirm } from "./confirm-dialog";
import { useToast } from "./toast";
import { useT } from "./locale";
import { docDateLocale } from "../lib/format";
import { SITE } from "../lib/site";
import { Avatar } from "./avatar";
import { copyText } from '@/lib/clipboard';
import { ThemePill } from "./shared-nav";
import { CurrencyOptions, LanguageOptions } from "./locale-switcher";
import { SWITCHER_LIVE, useLocale, LANGUAGES } from "./locale";
import { CURRENCIES } from "../lib/currency";
import { OffsetIcon, CurrencyCoin } from "./offset-icons";
import { CopyChip } from "./copy-chip";
import { WaButton } from "./wa-button";

function SettingsModal({ open, onClose, title, subtitle, icon, dark, children }) {
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

/** A switch that saves the moment it is flipped. */
function Toggle({ on, onToggle, label }) {
  return <button type="button" role="switch" aria-checked={on} aria-label={label} onClick={onToggle} className="st-tg" />;
}

/* ═══════════════════════════════════════════ */
/* ═══ SETTINGS PAGE                       ═══ */
/* ═══════════════════════════════════════════ */

const I_LOCK = <OffsetIcon name="lock" size={16} />;
const I_BELL = <OffsetIcon name="bell" size={16} />;
const I_DEV = <OffsetIcon name="monitor" size={16} />;
const I_PHONE = <OffsetIcon name="phone" size={16} />;
// API access uses the code icon, the same as the left sidebar row.
const I_API = <OffsetIcon name="code" size={16} />;
const I_GLOBE = <OffsetIcon name="globe" size={16} />;
const I_COIN = <CurrencyCoin size={16} />;
const I_PULSE = <OffsetIcon name="activity" size={16} />;
const I_OUT = <OffsetIcon name="logout" size={16} />;
const I_TRASH = <OffsetIcon name="trash" size={16} />;
const I_CHEV = <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg>;
const I_EXT = <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/></svg>;

/* The printed parts of the page (17 Oct 2026): the profile card, the switches,
   the devices, the API key and the delete step. Rows, cards and section heads
   stay Tailwind because the admin Settings page shares them. */
const ST_CSS = `
.st{--st-print:#efc4cf;--st-field:#f6f0eb}
.dark .st{--st-print:#6b3a4a;--st-field:rgba(255,255,255,.05)}
.st-prof{border-radius:16px;background:var(--t-card-bg);box-shadow:inset 0 0 0 1px var(--t-card-border),4px 4px 0 var(--st-print);overflow:hidden}
.st-prof-top{display:flex;align-items:center;gap:14px;padding:16px;background:radial-gradient(120% 140% at 0% 0%,rgba(196,125,142,.16),transparent 62%)}
.st-tier{display:inline-flex;align-items:center;gap:5px;margin-top:4px;height:22px;padding-inline:8px;border-radius:7px;font-size:11.5px;font-weight:700;color:var(--tc);background:color-mix(in srgb,var(--tc) 11%,transparent);box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--tc) 30%,transparent)}
.st-det{display:flex;align-items:center;justify-content:space-between;gap:12px;min-height:44px;padding:8px 16px;border-top:1px solid var(--t-card-border);font-size:13px;color:var(--t-text-muted)}
.st-det>span:first-child{display:inline-flex;align-items:center;gap:8px;flex-shrink:0}
.st-det b{min-width:0;font-size:13px;font-weight:600;color:var(--t-text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.st-prof-ft{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;padding:10px 16px 12px;border-top:1px solid var(--t-card-border);font-size:12px;color:var(--t-text-muted);background:var(--st-field)}
.st-tg{position:relative;width:42px;height:24px;flex-shrink:0;border:0;border-radius:99px;cursor:pointer;background:var(--t-card-border);transition:background-color .18s}
.st-tg::after{content:"";position:absolute;top:3px;inset-inline-start:3px;width:18px;height:18px;border-radius:50%;background:#fff;box-shadow:0 1px 2px rgba(0,0,0,.25);transition:transform .18s}
.st-tg[aria-checked="true"]{background:#c47d8e;box-shadow:inset 0 0 0 1px #a8667a,2px 2px 0 var(--st-print)}
.st-tg[aria-checked="true"]::after{transform:translateX(18px)}
[dir="rtl"] .st-tg[aria-checked="true"]::after{transform:translateX(-18px)}
.st-tg:focus-visible{outline:2px solid var(--t-accent);outline-offset:2px}
.st-sub{padding:10px 14px 4px;font-size:10.5px;font-weight:800;letter-spacing:1.1px;text-transform:uppercase;color:var(--t-text-muted);border-top:1px solid var(--t-card-border)}
.st-dev{display:flex;align-items:center;gap:12px;padding:10px 14px;border-top:1px solid var(--t-card-border)}
.st-sub+.st-dev{border-top:0}
.st-foot{padding:9px 14px 12px;font-size:12px;color:var(--t-text-muted);border-top:1px solid var(--t-card-border)}
.st-api{padding:12px 14px 14px}
.st-key{display:flex;align-items:center;gap:8px;margin-top:10px;padding:5px 5px 5px 11px;border-radius:11px;background:var(--st-field);box-shadow:inset 0 0 0 1px var(--t-card-border)}
.st-key code{flex:1;min-width:0;font-family:'JetBrains Mono',monospace;font-size:12.5px;font-weight:600;color:var(--t-text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;direction:ltr;text-align:start}
.st-kcopy{flex-shrink:0;height:28px;padding-inline:10px;border:0;border-radius:8px;font:inherit;font-size:12px;font-weight:700;color:var(--t-accent-ink);background:rgba(196,125,142,.1);box-shadow:inset 0 0 0 1px rgba(196,125,142,.35);cursor:pointer}
.st-kcopy.done{color:var(--t-green);background:color-mix(in srgb,var(--t-green) 10%,transparent);box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--t-green) 35%,transparent)}
.st-links{display:flex;flex-wrap:wrap;gap:6px 16px;margin-top:10px;font-size:12.5px;font-weight:700}
.st-links a,.st-links button{padding:0;border:0;background:none;font:inherit;color:var(--t-accent-ink);text-decoration:underline;text-underline-offset:3px;cursor:pointer}
.st-del{padding:2px 14px 14px;border-top:1px solid var(--t-card-border)}
.st-del input{flex:1 1 160px;min-width:0;height:40px;padding-inline:12px;border-radius:10px;font:inherit;font-size:14px;color:var(--t-text);background:var(--t-card-bg);border:1px solid color-mix(in srgb,var(--t-red) 30%,transparent);outline:none}
.st-del input:focus-visible{box-shadow:0 0 0 3px color-mix(in srgb,var(--t-red) 18%,transparent)}
.st-del p{margin:10px 0 0;font-size:12px;line-height:1.5;color:var(--t-text-muted)}
@media (prefers-reduced-motion:reduce){.st-tg,.st-tg::after{transition:none}}
`;

/** A settings row: printed icon tile, title, one-line hint, and whatever sits on the right. */
function Row({ id, icon, title, sub, right, onClick, href, danger, first, dark, t }) {
  const inner = (<>
    <span className={"ic-tile" + (danger ? " tc" : "")} style={{ width: 34, height: 34, ...(danger ? { "--tc": dark ? "#fca5a5" : "#dc2626" } : null) }}>{icon}</span>
    <span className="flex flex-col gap-[2px] flex-1 min-w-0 text-start"><b className="text-[14px] font-semibold" style={{ color: danger ? (dark ? "#fca5a5" : "#dc2626") : t.text }}>{title}</b>{sub && <small className="text-[11.5px] text-t-text-muted">{sub}</small>}</span>
    <span className="flex items-center shrink-0 text-t-text-muted">{right === undefined ? I_CHEV : right}</span>
  </>);
  const cls = "flex items-center gap-3 w-full py-3 px-3.5 bg-transparent border-none font-[inherit] no-underline";
  const style = { borderTop: first ? "none" : `1px solid ${t.cardBorder}` };
  if (href) return <a id={id} href={href} target="_blank" rel="noopener noreferrer" className={`${cls} cursor-pointer`} style={style}>{inner}</a>;
  if (onClick) return <button id={id} onClick={onClick} className={`${cls} cursor-pointer text-start`} style={style}>{inner}</button>;
  return <div id={id} className={cls} style={style}>{inner}</div>;
}
function SectionHead({ children, icon }) {
  return <div className="flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-[1px] px-0.5 pb-1.5 text-t-text-muted">{icon && <span className="inline-flex text-accent-ink"><OffsetIcon name={icon} size={14} /></span>}{children}</div>;
}

export default function SettingsPage({ user, dark, t, themeMode, setThemeMode, setDark, waNum, onNavigate }) {
  const tr = useT();
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
  const [keyCopied, setKeyCopied] = useState(false);
  useEffect(() => { fetch("/api/reseller/key").then(r => r.ok ? r.json() : null).then(d => { if (d?.apiKey) { setApiKey(d.apiKey); setApiWholesale(!!d.wholesale); } }).catch(() => {}); }, []);
  useEffect(() => {
    if (!keyCopied) return undefined;
    const id = setTimeout(() => setKeyCopied(false), 1600);
    return () => clearTimeout(id);
  }, [keyCopied]);
  const [deleteProof, setDeleteProof] = useState("");
  const [deleteError, setDeleteError] = useState("");
  // A Google sign-up has no password to re-enter; it confirms deletion by
  // typing its email instead. Missing flag (older payload) keeps the password box.
  const hasPassword = user?.hasPassword !== false;

  // Change password state
  const [curPw, setCurPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [pwLoading, setPwLoading] = useState(false);
  const [pwModalOpen, setPwModalOpen] = useState(false);
  const [langModalOpen, setLangModalOpen] = useState(false);
  const [currencyModalOpen, setCurrencyModalOpen] = useState(false);
  // Read only — the pickers themselves set these. Used for the value shown on
  // the row, so somebody can see what they are on without opening anything.
  const loc = useLocale();
  const currentLang = LANGUAGES.find(l => l.code === loc?.lang) || LANGUAGES[0];
  const currentCurrency = CURRENCIES[loc?.currency] || null;

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
    return new Date(d).toLocaleDateString(docDateLocale(), { month: "short", day: "numeric" });
  };

  const applyTheme = (mode) => {
    setThemeMode(mode);
    try { localStorage.setItem("nitro-theme", mode); } catch {};
    if (mode === "day") setDark(false);
    else if (mode === "night") setDark(true);
    else { const h = new Date().getHours(), m = new Date().getMinutes(); setDark(h >= 19 || h < 6 || (h === 6 && m < 30) || (h === 18 && m >= 30)); }
  };

  const changePassword = async () => {
    if (!curPw || !newPw || !confirmPw) { toast.error(tr("Missing fields"), tr("All fields required")); return; }
    if (newPw !== confirmPw) { toast.error(tr("Mismatch"), tr("New passwords don't match")); return; }
    if (newPw.length < 6) { toast.error(tr("Too short"), tr("Minimum 6 characters")); return; }
    setPwLoading(true);
    try {
      const res = await fetch("/api/auth/change-password", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ currentPassword: curPw, newPassword: newPw }), signal: AbortSignal.timeout(15000) });
      const data = await res.json();
      if (!res.ok) { toast.error(tr("Failed"), data.error ? tr(data.error) : tr("Password change failed")); } else { toast.success(tr("Password updated"), tr("Your password has been changed")); setCurPw(""); setNewPw(""); setConfirmPw(""); }
    } catch (err) { toast.error(err?.name === "TimeoutError" ? tr("Timed out") : tr("Network error"), tr("Check your connection")); }
    setPwLoading(false);
  };

  const card = { background: t.cardBg, border: `1px solid ${t.cardBorder}` };
  const pwInput = "w-full py-2.5 px-3.5 rounded-lg border text-[15px] outline-none focus-visible:ring-2 focus-visible:ring-[#c47d8e]/40 box-border text-t-text";
  const pwStyle = { borderColor: dark ? "rgba(255,255,255,.18)" : "rgba(0,0,0,.18)", background: dark ? "rgba(255,255,255,.12)" : "#fff" };
  const red = dark ? "#fca5a5" : "#dc2626";
  const green = dark ? "#6ee7b7" : "#047857";
  const notifRows = [
    [tr("Order updates"), tr("Get notified when orders complete or fail"), notifOrders, setNotifOrders, "notifOrders"],
    [tr("Promotions"), tr("Receive offers and discount alerts"), notifPromo, setNotifPromo, "notifPromo"],
    [tr("Email notifications"), tr("Receive notifications via email"), notifEmail, setNotifEmail, "notifEmail"],
  ];
  const logOut = async () => {
    const ok = await confirm({ title: tr("Log Out"), message: tr("You will be logged out of this device."), confirmLabel: tr("Log Out") });
    if (!ok) return;
    let res;
    try {
      res = await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      toast.error(tr("Unable to log out"), tr("Check your connection and try again."));
      return;
    }
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      toast.error(tr("Unable to log out"), data.error ? tr(data.error) : tr("Please try again."));
      return;
    }
    window.location.replace("/");
  };
  const deleteAccount = async () => {
    if (!deleteProof) return;
    const ok = await confirm({ title: "Delete Your Account", message: tr("Your account will be scheduled for deletion in 30 days. During this period you cannot log in or sign up with this email. Contact support@nitro.ng before the deadline to cancel. After 30 days, your personal details will be permanently removed and the account cannot be restored. Financial records required for legal and accounting purposes are retained without your contact details."), confirmLabel: tr("Delete Account"), danger: true, requireType: "DELETE" });
    if (!ok) return;
    try {
      const res = await fetch("/api/auth/delete-account", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(hasPassword ? { password: deleteProof } : { confirmEmail: deleteProof }) });
      const data = await res.json();
      if (res.ok) { window.location.replace("/?deleted=1"); }
      else { setDeleteError(data.error || "Failed to delete account"); }
    } catch { setDeleteError("Request failed"); }
  };

  return (
    <div className="st">
      <style>{ST_CSS}</style>
      <div className="pb-3.5 max-md:pb-2">
        <div className="text-xl max-desktop:text-lg font-semibold mb-0.5 text-t-text">{tr("Settings")}</div>
        <div className="text-sm text-t-text-muted">{tr("Your account and how Nitro looks")}</div>
        <div className="page-divider bg-t-card-border" />
      </div>
      {/* Two columns on a computer, read row by row: who you are beside
          security, preferences beside notifications, more beside log out. On a
          phone the same order is one column. */}
      <div className="flex flex-col gap-[18px] desktop:grid desktop:grid-cols-2 desktop:gap-x-4 desktop:items-start">

        {/* ── Who you are ── */}
        <div className="st-prof">
          <div className="st-prof-top">
            <Avatar size={52} ring />
            <div className="flex flex-col min-w-0">
              <div className="text-[17px] font-bold truncate text-t-text">{user?.name || tr("User")}</div>
              <span className="st-tier self-start" style={{ "--tc": user?.badgeColor || t.textMuted }}><ShieldBadge color={user?.badgeColor} size={12} tier={user?.badge} />{user?.badge || "Spark"}</span>
            </div>
          </div>
          <div className="st-det"><span><OffsetIcon name="mail" size={15} />{tr("Email")}</span><b>{user?.email || "—"}</b></div>
          <div className="st-det"><span><OffsetIcon name="phone" size={15} />{tr("Phone")}</span><b className="m">{user?.phone || "—"}</b></div>
          <div className="st-det"><span><OffsetIcon name="referral" size={15} />{tr("Referral code")}</span>{user?.refCode ? <CopyChip value={user.refCode} label={tr("Copy referral code")} small /> : <b>—</b>}</div>
          <div className="st-prof-ft">
            <span>{tr("To change your email or phone, message us.")}</span>
            {waNum && <WaButton href={`https://wa.me/${waNum}?text=${encodeURIComponent("Hi Nitro, I need help")}`} size="sm">{"WhatsApp"}</WaButton>}
          </div>
        </div>

        {/* ── Security: password and the devices signed in ── */}
        <div>
          <SectionHead icon="lock">{tr("Security")}</SectionHead>
          <div className="rounded-[14px] overflow-hidden" style={card}>
            <Row id="set-change-password" first icon={I_LOCK} title={tr("Change password")} sub={tr("Keep your account secure")} onClick={() => setPwModalOpen(true)} dark={dark} t={t} />
            <div id="set-active-sessions" className="st-sub">{tr("Signed in on")}</div>
            {sessionsLoading ? (
              <div className="px-3.5 pb-2"><SkelList dark={dark} rows={2} bare avatar="square" rowH={52} /></div>
            ) : sessions.length === 0 ? (
              <div className="st-dev text-[13px] text-t-text-muted">{tr("No active sessions")}</div>
            ) : sessions.map(s => (
              <div key={s.id} className="st-dev">
                <span className={"ic-tile" + (s.current ? " tc" : "")} style={{ width: 34, height: 34, ...(s.current ? { "--tc": green } : null) }}>{s.deviceType === "mobile" ? I_PHONE : I_DEV}</span>
                <span className="flex flex-col gap-[2px] flex-1 min-w-0">
                  <b className="flex items-center gap-2 flex-wrap text-[14px] font-semibold text-t-text">{s.deviceInfo || s.deviceType}{s.current && <span className="pbadge ok">{tr("This device")}</span>}</b>
                  <small className="text-[11.5px] text-t-text-muted">{[s.ip, fDSession(s.lastActive)].filter(Boolean).join(", ")}</small>
                </span>
                {!s.current && <button type="button" onClick={() => revokeSession(s.id)} disabled={revoking === s.id} className="nb bad sm">{revoking === s.id ? "…" : tr("Revoke")}</button>}
              </div>
            ))}
            <div className="st-foot">{tr("One computer and one phone can be signed in at a time.")}</div>
          </div>
        </div>

        {/* ── Preferences: theme, language, currency ── */}
        <div>
          <SectionHead icon="gear">{tr("Preferences")}</SectionHead>
          <div className="rounded-[14px] overflow-hidden" style={card}>
            <Row id="set-theme" first icon={<OffsetIcon name={themeMode === "auto" ? "contrast" : dark ? "moon" : "sun"} size={16} />} title={tr("Theme")} sub={themeMode === "auto" ? tr("Auto: light 6:30am to 6:30pm, dark otherwise") : tr("Choose how Nitro looks")} dark={dark} t={t}
              right={<ThemePill mode={themeMode} onMode={applyTheme} />} />
            {SWITCHER_LIVE && (
              <Row id="set-language" icon={I_GLOBE} title={tr("Language")}
                sub={tr("What language the site reads in")} dark={dark} t={t}
                onClick={() => setLangModalOpen(true)}
                right={<span className="flex items-center gap-1.5"><span className="text-[13px] font-semibold text-t-text">{currentLang.label}</span>{I_CHEV}</span>} />
            )}
            {SWITCHER_LIVE && currentCurrency && (
              <Row id="set-currency" icon={I_COIN} title={tr("Currency")}
                sub={tr("What prices are shown in. Your wallet stays in naira.")} dark={dark} t={t}
                onClick={() => setCurrencyModalOpen(true)}
                right={<span className="flex items-center gap-1.5"><span className="text-[13px] font-semibold text-t-text">{loc.currency}</span>{I_CHEV}</span>} />
            )}
          </div>
        </div>

        {/* ── Notifications: switches on the page, saved as they flip ── */}
        <div>
          <SectionHead icon="bell">{tr("Notifications")}</SectionHead>
          <div id="set-notifications" className="rounded-[14px] overflow-hidden" style={card}>
            {notifRows.map(([title, desc, on, setOn, key], i) => (
              <div key={key} className="flex items-center gap-3 py-3 px-3.5" style={{ borderTop: i ? `1px solid ${t.cardBorder}` : "none" }}>
                <span className="flex flex-col gap-[2px] flex-1 min-w-0"><b className="text-[14px] font-semibold text-t-text">{title}</b><small className="text-[11.5px] text-t-text-muted">{desc}</small></span>
                <Toggle on={on} label={title} onToggle={() => { setOn(!on); saveNotif(key, !on); }} />
              </div>
            ))}
          </div>
        </div>

        {/* ── More: API access and system status ── */}
        <div>
          <SectionHead icon="grid">{tr("More")}</SectionHead>
          <div className="rounded-[14px] overflow-hidden" style={card}>
            {apiKey ? (
              <div id="set-api" className="st-api">
                <div className="flex items-center gap-3">
                  <span className="ic-tile" style={{ width: 34, height: 34 }}>{I_API}</span>
                  <span className="flex flex-col gap-[2px] flex-1 min-w-0">
                    <b className="flex items-center gap-2 flex-wrap text-[14px] font-semibold text-t-text">{tr("API access")}<span className={"pbadge " + (apiWholesale ? "ok" : "tag")}>{apiWholesale ? tr("Wholesale") : tr("Retail")}</span></b>
                    <small className="text-[11.5px] text-t-text-muted">{tr("Use Nitro from your own platform")}</small>
                  </span>
                </div>
                {/* The key is a developer copy, so it keeps its own field rather than the order-number chip. */}
                <div className="st-key">
                  <code>{`${apiKey.slice(0, 9)}••••${apiKey.slice(-4)}`}</code>
                  <button type="button" className={"st-kcopy" + (keyCopied ? " done" : "")} onClick={async () => { if (await copyText(apiKey)) setKeyCopied(true); }}>{keyCopied ? tr("Copied") : tr("Copy")}</button>
                </div>
                <div className="st-links">
                  <a href="/resellers/docs" target="_blank" rel="noopener noreferrer">{tr("Read the docs")}</a>
                  {onNavigate && <button type="button" onClick={() => onNavigate("lab")}>{tr("Open API access")}</button>}
                </div>
              </div>
            ) : (
              <Row id="set-api" first icon={I_API} title={tr("API access")} sub={tr("Use Nitro from your own platform")} right={<span className="text-[10.5px] font-bold uppercase tracking-[.5px] py-[2px] px-2 rounded-md text-accent-ink" style={{ background: dark ? "rgba(196,125,142,.14)" : "rgba(196,125,142,.1)" }}>{tr("Soon")}</span>} dark={dark} t={t} />
            )}
            <Row id="set-status" icon={I_PULSE} title={tr("System status")} sub={tr("Check that every Nitro service is running")} href={SITE.status} right={<span className="flex items-center gap-2.5"><span className="w-[9px] h-[9px] rounded-full" style={{ background: "#059669", boxShadow: "0 0 0 3px rgba(5,150,105,.15)" }} />{I_EXT}</span>} dark={dark} t={t} />
          </div>
        </div>

        {/* ── Log out, and delete on its own card ── */}
        <div className="flex flex-col gap-3 desktop:mt-[22px]">
          <div className="rounded-[14px] overflow-hidden" style={card}>
            <Row id="set-account" first icon={I_OUT} title={tr("Log out")} sub={tr("Of this device")} onClick={logOut} dark={dark} t={t} />
          </div>
          <div className="rounded-[14px] overflow-hidden" style={card}>
            <Row id="set-danger-zone" first icon={I_TRASH} title={tr("Delete account")} sub={tr("Scheduled 30 days after you ask")} danger onClick={() => { setShowDelete(v => !v); setDeleteProof(""); setDeleteError(""); }} right={showDelete ? null : I_CHEV} dark={dark} t={t} />
            {showDelete && (
              <div className="st-del">
                <label htmlFor="delete-account-password" className="block text-[12.5px] mt-3 mb-1.5 text-t-text-muted">{hasPassword ? tr("Enter your password to confirm") : tr("Type your email address to confirm")}</label>
                <div className="flex gap-2 flex-wrap">
                  <input type={hasPassword ? "password" : "email"} id="delete-account-password" autoComplete={hasPassword ? "current-password" : "off"} value={deleteProof} onChange={e => setDeleteProof(e.target.value)} placeholder={hasPassword ? tr("Your password") : (user?.email || "")} />
                  <button type="button" onClick={deleteAccount} disabled={!deleteProof} className="nb bad" style={{ height: 40, opacity: deleteProof ? 1 : .45 }}>{tr("Delete my account")}</button>
                  <button type="button" onClick={() => { setShowDelete(false); setDeleteProof(""); setDeleteError(""); }} className="nb ghost" style={{ height: 40 }}>{tr("Cancel")}</button>
                </div>
                {deleteError && <div className="text-[13px] mt-2" style={{ color: red }}><OffsetIcon name="alert" size={14} className="inline align-middle" /> {deleteError}</div>}
                <p>{tr("Next you type DELETE to be sure. For 30 days you cannot log in or sign up with this email, and a message to us before then undoes it.")}</p>
              </div>
            )}
          </div>
        </div>

        <SettingsModal open={langModalOpen} onClose={() => setLangModalOpen(false)} title={tr("Language")} subtitle={tr("What language the site reads in")} icon={I_GLOBE} dark={dark} t={t}>
          <div className="loc-inmodal"><LanguageOptions onPick={() => setLangModalOpen(false)} /></div>
        </SettingsModal>

        <SettingsModal open={currencyModalOpen} onClose={() => setCurrencyModalOpen(false)} title={tr("Currency")} subtitle={tr("What prices are shown in. Your wallet stays in naira.")} icon={I_COIN} dark={dark} t={t}>
          <div className="loc-inmodal"><CurrencyOptions onPick={() => setCurrencyModalOpen(false)} /></div>
        </SettingsModal>

        {/* ── PASSWORD MODAL ── */}
        <SettingsModal open={pwModalOpen} onClose={() => setPwModalOpen(false)} title={tr("Change password")} subtitle={tr("Keep your account secure")} icon={I_LOCK} dark={dark} t={t}>
          <div className="mb-3">
            <label htmlFor="pw-current" className="text-[13px] font-medium block mb-[5px] text-t-text-muted">{tr("Current password")}</label>
            <input type="password" id="pw-current" autoComplete="current-password" value={curPw} onChange={e => setCurPw(e.target.value)} className={pwInput} style={pwStyle} />
          </div>
          <div className="mb-3">
            <label htmlFor="pw-new" className="text-[13px] font-medium block mb-[5px] text-t-text-muted">{tr("New password")}</label>
            <input type="password" id="pw-new" autoComplete="new-password" value={newPw} onChange={e => setNewPw(e.target.value)} className={pwInput} style={pwStyle} />
          </div>
          <div className="mb-3">
            <label htmlFor="pw-confirm" className="text-[13px] font-medium block mb-[5px] text-t-text-muted">{tr("Confirm new password")}</label>
            <input type="password" id="pw-confirm" autoComplete="new-password" value={confirmPw} onChange={e => setConfirmPw(e.target.value)} className={pwInput} style={pwStyle} />
          </div>
          <button type="button" onClick={changePassword} disabled={pwLoading} className="nb pri lg full mt-1" style={{ opacity: curPw && newPw && confirmPw && !pwLoading ? 1 : .45 }}>{pwLoading ? tr("Updating...") : tr("Update password")}</button>
        </SettingsModal>
      </div>
    </div>
  );
}

export function SettingsSidebar() {
  const tr = useT();
  const jump = (id) => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "center" });
  return (
    <div className="rr">
      <RailSec icon="list">{tr("On this page")}</RailSec>
      <RailCard>
        {[
          ["Change password", "set-change-password", "lock"],
          ["Active sessions", "set-active-sessions", "monitor"],
          ["Theme", "set-theme", "contrast"],
          ...(SWITCHER_LIVE ? [["Language", "set-language", "globe"], ["Currency", "set-currency", <CurrencyCoin size={15} />]] : []),
          ["Notifications", "set-notifications", "bell"],
          ["API access", "set-api", "code"],
          ["System status", "set-status", "activity"],
          ["Log out", "set-account", "logout"],
          ["Account", "set-danger-zone", "trash"],
        ].map(([label, id, icon]) => (
          <RailJump key={id} icon={icon} label={tr(label)} onClick={() => jump(id)} />
        ))}
      </RailCard>
    </div>
  );
}

// Shared with the admin Settings page so both read the same.
export { Row as SettingsRow, SectionHead as SettingsSectionHead, I_LOCK, I_BELL, I_PULSE, I_OUT, I_CHEV };
