'use client';
import { useState, useEffect, useMemo, useRef, useTransition, Fragment } from "react";
import dynamic from "next/dynamic";
import { ThemeProvider, useTheme, ThemeToggle } from "./shared-nav";
import { NitroWordmark } from "./nitro-logo";
import { ToastProvider } from "./toast";
import { ConfirmProvider } from "./confirm-dialog";
import AnnouncementBanner from "./announcement-banner";
import { OverviewPage, RightSidebar } from "./dashboard-overview";
import { SegPill } from "./seg-pill";
import { fN, fD } from "../lib/format";
import { Avatar } from "./avatar";
import OrderTour from "./order-tour";
import { PAYMENT_STATES, isCreditedPaymentResult } from "../lib/payment-state";
import {
  PAYMENT_STATUS_STORAGE_KEY,
  readStoredPaymentStatus,
  persistPaymentStatus,
  decorateUserWithRewardsStatus,
  paymentNoticeFromResult,
  paymentNoticeFromTransaction,
} from "../lib/dashboard-state";

export {
  PAYMENT_STATUS_STORAGE_KEY,
  PAYMENT_STATUS_STORAGE_TTL_MS,
  readStoredPaymentStatus,
  persistPaymentStatus,
  decorateUserWithRewardsStatus,
} from "../lib/dashboard-state";

function normalizedPromptPhone(value) {
  return typeof value === 'string' ? value.trim() : '';
}

export function advancePhoneGeneration(currentGeneration, phone) {
  return normalizedPromptPhone(phone) ? currentGeneration + 1 : currentGeneration;
}

export function isCurrentPhoneRequest(requestGeneration, currentGeneration) {
  return requestGeneration === null || requestGeneration === currentGeneration;
}

export function createPhoneConfirmation(user) {
  const phone = normalizedPromptPhone(user?.phone);
  return {
    userId: user?.id || null,
    // A non-empty phone can safely suppress the prompt immediately. An empty
    // server-rendered value is rechecked against /api/auth/me before prompting.
    phone: phone || null,
  };
}

export function reconcilePhoneConfirmation(current, incoming, { authoritative = false, allowClear = false } = {}) {
  if (!incoming?.id) return current || { userId: null, phone: null };

  const sameUser = current?.userId === incoming.id;
  const hasPhoneField = Object.prototype.hasOwnProperty.call(incoming, 'phone');
  const phone = hasPhoneField ? normalizedPromptPhone(incoming.phone) : '';

  if (authoritative) {
    if (!hasPhoneField) return sameUser ? current : { userId: incoming.id, phone: null };
    // A caller may clear a confirmed number only after proving its request was
    // opened after the latest phone observation/save. This fences stale reads.
    if (phone || allowClear) {
      return { userId: incoming.id, phone };
    }
    return sameUser ? current : { userId: incoming.id, phone: null };
  }

  // Dashboard payloads may be stale or incomplete. They may confirm a saved
  // number, but cannot erase one or prove that a number is missing.
  if (phone) return { userId: incoming.id, phone };
  return sameUser ? current : { userId: incoming.id, phone: null };
}

export function mergeDashboardUser(previous, incoming) {
  if (!incoming) return previous;
  const previousPhone = previous?.id === incoming.id
    ? normalizedPromptPhone(previous.phone)
    : '';
  const incomingPhone = normalizedPromptPhone(incoming.phone);
  return previousPhone && !incomingPhone
    ? { ...incoming, phone: previous.phone }
    : incoming;
}

export function shouldShowPhonePrompt({ phoneKnown, phone, user, currentTosVersion }) {
  const promptPhone = phone === undefined ? user?.phone : phone;
  return !!(phoneKnown && user && !normalizedPromptPhone(promptPhone) && !(currentTosVersion && user.tosVersion !== currentTosVersion));
}

/* Dynamic imports — only load when user navigates to that page */
const NewOrderPage = dynamic(() => import("./new-order").then(m => m.default), { ssr: false });
const ServicesSidebar = dynamic(() => import("./new-order").then(m => m.ServicesSidebar), { ssr: false });
const OrdersPage = dynamic(() => import("./orders-page").then(m => m.default), { ssr: false });
const OrdersSidebar = dynamic(() => import("./orders-page").then(m => m.OrdersSidebar), { ssr: false });
const ReferralsPage = dynamic(() => import("./referrals-page").then(m => m.default), { ssr: false });
const ReferralsSidebar = dynamic(() => import("./referrals-page").then(m => m.ReferralsSidebar), { ssr: false });
const SettingsPage = dynamic(() => import("./settings-page").then(m => m.default), { ssr: false });
const SettingsSidebar = dynamic(() => import("./settings-page").then(m => m.SettingsSidebar), { ssr: false });
const SupportPage = dynamic(() => import("./support-page").then(m => m.default), { ssr: false });
const SupportSidebar = dynamic(() => import("./support-page").then(m => m.SupportSidebar), { ssr: false });
const AddFundsPage = dynamic(() => import("./addfunds-page").then(m => m.default), { ssr: false });
const AddFundsSidebar = dynamic(() => import("./addfunds-page").then(m => m.AddFundsSidebar), { ssr: false });
const GuidePage = dynamic(() => import("./guide-page").then(m => m.default), { ssr: false });
const GuideSidebar = dynamic(() => import("./guide-page").then(m => m.GuideSidebar), { ssr: false });
const LeaderboardPage = dynamic(() => import("./leaderboard-page").then(m => m.default), { ssr: false });
const LeaderboardCard = dynamic(() => import("./leaderboard-page").then(m => m.LeaderboardCard), { ssr: false });
const EarnPage = dynamic(() => import("./earn-page").then(m => m.default), { ssr: false });
const ResellerLabPage = dynamic(() => import("./reseller-hq").then(m => m.ResellerHQDashboard), { ssr: false });
const ResellerCataloguePage = dynamic(() => import("./reseller-catalogue"), { ssr: false });
const ResellerCatalogueSidebar = dynamic(() => import("./reseller-catalogue").then(m => m.ResellerCatalogueSidebar), { ssr: false });
const ResellerLabSidebar = dynamic(() => import("./reseller-hq").then(m => m.ResellerHQSidebar), { ssr: false });
const TasksPage = dynamic(() => import("./tasks-page").then(m => m.default), { ssr: false });

/* ═══════════════════════════════════════════ */
/* ═══ SVG ICONS                          ═══ */
/* ═══════════════════════════════════════════ */
const I = {
  lab: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="m21 2-2 2m-7.6 7.6a5.5 5.5 0 11-7.8 7.8 5.5 5.5 0 017.8-7.8zm0 0L19 3l2 2-3 3"/></svg>,
  audit: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a7 7 0 017 7c0 2.38-1.19 4.47-3 5.74V17a1 1 0 01-1 1H9a1 1 0 01-1-1v-2.26C6.19 13.47 5 11.38 5 9a7 7 0 017-7z"/><line x1="9" y1="21" x2="15" y2="21"/><line x1="10" y1="24" x2="14" y2="24"/></svg>,
  cleanup: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 21l2-2m0 0l4-7 3 3-7 4z"/><path d="M14 3l1.5 3L19 7.5 15.5 9 14 12l-1.5-3L9 7.5 12.5 6z"/><path d="M19 14l1 2 2 1-2 1-1 2-1-2-2-1 2-1z"/></svg>,
  overview: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>,
  orders: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>,
  "add-funds": <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/><path d="M7 15h2"/></svg>,
  guide: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M2 3h6a4 4 0 014 4v14a3 3 0 00-3-3H2z"/><path d="M22 3h-6a4 4 0 00-4 4v14a3 3 0 013-3h7z"/></svg>,
  services: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>,
  referrals: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>,
  support: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>,
  settings: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09a1.65 1.65 0 00-1-1.51 1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>,
  earn: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 6v12"/><path d="M15.5 9.5c0-1.38-1.57-2.5-3.5-2.5s-3.5 1.12-3.5 2.5S10.07 12 12 12s3.5 1.12 3.5 2.5-1.57 2.5-3.5 2.5-3.5-1.12-3.5-2.5"/></svg>,
  tasks: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 11l3 3 8-8"/><path d="M20 12v6a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h9"/></svg>,
  catalogue: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M2 3h6a4 4 0 014 4v14a3 3 0 00-3-3H2z"/><path d="M22 3h-6a4 4 0 00-4 4v14a3 3 0 013-3h7z"/><line x1="6" y1="8" x2="9" y2="8"/><line x1="6" y1="12" x2="9" y2="12"/></svg>,
  resellers: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l1.5-5h15L21 9"/><path d="M3 9h18v11a1 1 0 01-1 1H4a1 1 0 01-1-1z"/><path d="M9 13h6"/></svg>,
  changelog: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 8v4l3 3"/><circle cx="12" cy="12" r="10"/></svg>,
  leaderboard: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M8 21V12H2v9h6zM22 21V8h-6v13h6zM15 21V4H9v17h6z"/></svg>,
  instagram: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="20" rx="5"/><circle cx="12" cy="12" r="5"/><circle cx="17.5" cy="6.5" r="1.5" fill="currentColor" stroke="none"/></svg>,
  x: <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>,
  logout: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>,
};

const NAV_ITEMS = [
  { id: "overview", label: "Home" },
  { id: "services", label: "New Order" },
  { id: "orders", label: "History" },
  { id: "add-funds", label: "Wallet" },
  { id: "guide", label: "Blog" },
  { id: "changelog", label: "What's New", href: "/changelog" },
  { id: "referrals", label: "Referrals" },
  { id: "tasks", label: "Tasks" },
  { id: "support", label: "Support" },
  { id: "settings", label: "Settings" },
];

const BOTTOM_TABS = [
  { id: "overview", label: "Home" },
  { id: "add-funds", label: "Wallet" },
  { id: "services", label: "New Order", primary: true },
  { id: "orders", label: "History" },
  { id: "more", label: "More" },
];
const MORE_ITEMS = [
  { id: "referrals", label: "Referrals" },
  { id: "tasks", label: "Tasks" },
  { id: "guide", label: "Blog" },
  { id: "changelog", label: "What's New", href: "/changelog" },
  { id: "support", label: "Support" },
  { id: "settings", label: "Settings" },
  { id: "logout", label: "Log Out" },
];
const MoreIcon = <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/><circle cx="5" cy="12" r="1.5"/></svg>;
const OrderIcon = <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>;

const WAITLIST_META = {
  audit: { icon: I.audit, title: "Be the first to audit your account", desc: "We're building a tool that analyzes your social media — follower quality, engagement rate, growth trends, and more. Join the waitlist to get early access." },
  cleanup: { icon: I.cleanup, title: "Be the first to clean up your account", desc: "Mass unfollow ghost followers, non-followers, and inactive accounts — all from your Nitro dashboard. Join the waitlist to get early access." },
};

function WaitlistPage({ feature, dark, t }) {
  const meta = WAITLIST_META[feature];
  const [email, setEmail] = useState("");
  const [joined, setJoined] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetch("/api/waitlist").then(r => r.json()).then(d => {
      if (d.joined?.audit || d.joined?.cleanup) setJoined(d.joined.audit || d.joined.cleanup);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [feature]);

  const submit = async (e) => {
    e.preventDefault();
    if (!email.trim()) return;
    setSubmitting(true);
    try {
      const [r1, r2] = await Promise.all([
        fetch("/api/waitlist", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ feature: "audit", email }) }),
        fetch("/api/waitlist", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ feature: "cleanup", email }) }),
      ]);
      if (r1.ok || r2.ok) setJoined({ email: email.trim() });
    } catch {}
    setSubmitting(false);
  };

  if (loading) return <div className="flex justify-center py-20"><div className={`skel-bone w-48 h-6 rounded-lg ${dark ? "skel-dark" : "skel-light"}`} /></div>;

  return (
    <div className="rounded-[14px] max-md:rounded-xl overflow-hidden" style={{ background: t.cardBg, border: `1px solid ${dark ? "rgba(255,255,255,.12)" : "rgba(0,0,0,.08)"}` }}>
      <div className="py-10 px-6 max-md:py-8 max-md:px-4 flex flex-col items-center text-center">
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-5 text-accent" style={{ background: dark ? "rgba(196,125,142,.12)" : "rgba(196,125,142,.08)" }}>
          <span className="scale-[1.8]">{meta.icon}</span>
        </div>
        <div className="text-xl max-md:text-lg font-semibold mb-2 text-t-text">{meta.title}</div>
        <div className="text-sm max-md:text-[13px] max-w-[440px] mb-8 leading-relaxed text-t-text-muted">{meta.desc}</div>

        {joined ? (
          <div className="rounded-xl py-4 px-6 max-md:px-4" style={{ background: dark ? "rgba(110,231,183,.06)" : "rgba(5,150,105,.04)", border: `1px solid ${dark ? "rgba(110,231,183,.15)" : "rgba(5,150,105,.12)"}` }}>
            <div className="flex items-center gap-2 justify-center mb-1">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={t.green} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
              <span className="text-sm font-semibold text-t-green">You're on the list</span>
            </div>
            <div className="text-[13px] text-t-text-muted">{joined.email}</div>
          </div>
        ) : (
          <form onSubmit={submit} className="w-full max-w-[360px]">
            <div className="mb-4">
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Enter your email" className="w-full py-2.5 px-3 rounded-[10px] text-sm font-[inherit] outline-none box-border text-t-text" style={{ background: dark ? "rgba(255,255,255,.09)" : "#fff", border: `1px solid ${dark ? "rgba(255,255,255,.18)" : "rgba(0,0,0,.14)"}` }} />
            </div>
            <button type="submit" disabled={submitting || !email.trim()} className="w-full py-2.5 rounded-[10px] text-sm font-semibold border-none cursor-pointer transition-transform duration-200 hover:-translate-y-px bg-accent text-white" style={{ opacity: submitting || !email.trim() ? 0.5 : 1 }}>
              {submitting ? "Joining…" : "Join the waitlist"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

const NOTIF_ICONS = {
  check: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>,
  clock: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
  x: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>,
  dollar: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>,
  gift: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 12v10H4V12"/><path d="M2 7h20v5H2z"/><path d="M12 22V7"/></svg>,
  chat: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>,
};

function NotifDropdown({ items, dark, t, onClose, readIds, setReadIds, clearedIds, setClearedIds, setClearedAt, readAllAt, setReadAllAt, onNavigate, socialLinks = {} }) {
  const [filter, setFilter] = useState("all");

  const filtered = filter === "all" ? items : items.filter(n => n.type === filter);
  const display = filtered.slice(0, 10);
  const hasMore = filtered.length > 10;
  const unreadCount = items.filter(n => n.alwaysUnread || (!readIds.has(n.id) && !(readAllAt && n.ts && n.ts <= readAllAt))).length;
  const markAllRead = () => {
    const allIds = items.map(n => n.id);
    const now = new Date();
    setReadIds(new Set([...readIds, ...allIds]));
    setReadAllAt(now);
    fetch("/api/auth/notifications", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ readIds: allIds, readAllAt: now.toISOString() }) }).catch(() => {});
  };
  const markRead = (id) => {
    setReadIds(prev => new Set([...prev, id]));
    fetch("/api/auth/notifications", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ readIds: [id] }) }).catch(() => {});
  };
  const clearAll = () => {
    setClearedIds(new Set([...clearedIds, ...items.map(n => n.id)]));
    const now = new Date();
    if (typeof setClearedAt === "function") setClearedAt(now);
    fetch("/api/auth/notifications", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ clearAll: true }) }).catch(() => {});
  };

  return (
    <div className="absolute top-[calc(100%+8px)] right-0 w-80 max-md:w-[280px] max-md:-right-2 rounded-[14px] backdrop-blur-[20px] z-50 overflow-hidden" style={{
      background: dark ? "rgba(13,16,32,.98)" : "rgba(255,255,255,.98)",
      borderWidth: 1, borderStyle: "solid", borderColor: t.cardBorder,
      boxShadow: dark ? "0 12px 40px rgba(0,0,0,.5)" : "0 12px 40px rgba(0,0,0,.12)",
    }}>
      {/* Header */}
      <div className="flex justify-between items-center py-3.5 px-4">
        <div className="flex items-center gap-2">
          <span className="text-base font-semibold text-t-text">Notifications</span>
          {unreadCount > 0 && <span className="text-xs py-0.5 px-1.5 rounded-[5px] font-semibold text-accent" style={{ background: dark ? "#1c1015" : "#fdf2f4" }}>{unreadCount}</span>}
        </div>
        <div className="flex gap-2.5">
          {unreadCount > 0 && <button onClick={markAllRead} className="text-[13px] font-semibold bg-none border-none cursor-pointer transition-transform duration-200 hover:-translate-y-px text-accent">Mark all read</button>}
          {items.length > 0 && <button onClick={clearAll} className="text-[13px] font-semibold bg-none border-none cursor-pointer transition-transform duration-200 hover:-translate-y-px text-t-text-muted">Clear all</button>}
        </div>
      </div>
      {/* Filter tabs */}
      <div className="px-3.5 pb-2.5">
        <SegPill value={filter} options={[{value: "all", label: "All"}, {value: "order", label: "Orders"}, {value: "deposit", label: "Deposits"}]} onChange={setFilter} dark={dark} t={t} fill />
      </div>
      <div className="h-px bg-t-card-border" />
      {/* List */}
      <div className="max-h-[280px] overflow-y-auto">
        {display.length > 0 ? display.map((n, i) => {
          const isRead = n.alwaysUnread ? false : readIds.has(n.id) || (readAllAt && n.ts && n.ts <= readAllAt);
          return (
            <div key={n.id} role="button" tabIndex={0} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();e.currentTarget.click()}}} onClick={() => { if (n.type === "ticket" && socialLinks?.social_whatsapp_support) { window.open(`https://wa.me/${socialLinks.social_whatsapp_support.replace(/\D/g, "")}?text=${encodeURIComponent("Hi *Nitro*, I need help")}`, "_blank"); onClose(); } else { markRead(n.id); } }} className="flex items-start gap-2.5 py-3 px-4 transition-colors duration-150 hover:bg-[rgba(196,125,142,.1)]" style={{ borderBottom: i < display.length - 1 ? `1px solid ${t.cardBorder}` : "none", background: !isRead ? (dark ? "rgba(196,125,142,.06)" : "rgba(196,125,142,.04)") : "transparent", cursor: "pointer" }}>
              <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${n.color}15`, color: n.color }}>{NOTIF_ICONS[n.icon]}</div>
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-center gap-1.5">
                  <span className="text-sm text-t-text" style={{ fontWeight: isRead ? 500 : 600 }}>{n.title}</span>
                  {!isRead && <div className="w-1.5 h-1.5 rounded-full shrink-0 bg-accent" />}
                </div>
                <div className="text-sm mt-0.5 overflow-hidden text-ellipsis whitespace-nowrap text-t-text-soft">{n.desc}</div>
                <div className="text-[13px] mt-[3px] text-t-text-muted">{n.time}</div>
              </div>
            </div>
          );
        }) : (
          <div className="py-6 px-3.5 text-center text-sm text-t-text-muted">No notifications</div>
        )}
      </div>
      {/* Footer */}
      {hasMore && <div className="py-2 px-3.5 text-center text-xs text-t-text-muted" style={{ borderTop: `1px solid ${t.cardBorder}` }}>Showing latest 10 of {filtered.length}</div>}
    </div>
  );
}

/* ═══════════════════════════════════════════ */
/* ═══ MAIN DASHBOARD SHELL               ═══ */
/* ═══════════════════════════════════════════ */
export default function Dashboard({ initialData }) {
  return <ThemeProvider><DashboardInner initialData={initialData} /></ThemeProvider>;
}

function DashboardInner({ initialData }) {
  const { dark, setDark, toggleTheme, t: baseT, themeMode, setThemeMode } = useTheme();
  const applyThemeMode = (mode) => {
    setThemeMode(mode);
    try { localStorage.setItem("nitro-theme", mode); } catch {}
    if (mode === "day") setDark(false);
    else if (mode === "night") setDark(true);
    else { const h = new Date().getHours(), m = new Date().getMinutes(); setDark(h >= 19 || h < 6 || (h === 6 && m < 30) || (h === 18 && m >= 30)); }
  };
  const [active, setActiveRaw] = useState("services");
  const [, startTransition] = useTransition();
  const setActive = (page) => { startTransition(() => { setActiveRaw(page); try { localStorage.setItem("nitro-page", page); } catch {} }); };
  useEffect(() => {
    try {
      const nav = performance.getEntriesByType?.("navigation")?.[0];
      const isReload = nav?.type === "reload" || nav?.type === "back_forward";
      if (isReload) { let saved = localStorage.getItem("nitro-page"); if (saved === "how-to") { saved = "guide"; localStorage.setItem("nitro-page", "guide"); } if (saved) setActiveRaw(saved); }
      else { localStorage.removeItem("nitro-page"); }
    } catch {}
    const sp = new URLSearchParams(window.location.search);
    if (sp.get("new_user")) {
      const eid = sp.get("eid");
      window.fbq && window.fbq("track", "CompleteRegistration", { content_name: "signup", status: true }, eid ? { eventID: eid } : {});
      window.history.replaceState({}, "", "/dashboard");
    }
  }, []);
  const [leftOpen, setLeftOpen] = useState(false);
  const [avOpen, setAvOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false); // the concierge panel: a sheet on a phone, a docked window on a desktop
  // Onboarding funnel: tell the server the first time Wallet and New Order are opened.
  const seenSurfaces = useRef(new Set());
  useEffect(() => {
    const surface = active === "add-funds" ? "wallet" : active === "services" ? "new_order" : null;
    if (!surface || seenSurfaces.current.has(surface)) return;
    seenSurfaces.current.add(surface);
    fetch("/api/telemetry/first-seen", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ surface }) }).catch(() => {});
  }, [active]);
  const [dockMsg, setDockMsg] = useState("");
  const dockInputRef = useRef(null);
  const avRef = useRef(null);
  const [moreOpen, setMoreOpen] = useState(false);
  const [showOrderTour, setShowOrderTour] = useState(false);

  // PWA Add to Home Screen
  const deferredPrompt = useRef(null);
  const [a2hsReady, setA2hsReady] = useState(false);
  const [isIos, setIsIos] = useState(false);
  const [a2hsDismissed, setA2hsDismissed] = useState(() => {
    if (typeof window === 'undefined') return true;
    return !!localStorage.getItem('nitro-a2hs-dismissed') || window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
  });
  useEffect(() => {
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});
    const handler = (e) => { e.preventDefault(); deferredPrompt.current = e; setA2hsReady(true); };
    window.addEventListener('beforeinstallprompt', handler);
    const ua = navigator.userAgent;
    if (/iPad|iPhone|iPod/.test(ua) && !window.MSStream && !window.navigator.standalone) setIsIos(true);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);
  const handleA2hsInstall = async () => {
    if (!deferredPrompt.current) return;
    deferredPrompt.current.prompt();
    const { outcome } = await deferredPrompt.current.userChoice;
    if (outcome === 'accepted') { setA2hsDismissed(true); localStorage.setItem('nitro-a2hs-dismissed', '1'); }
    deferredPrompt.current = null;
    setA2hsReady(false);
  };
  const dismissA2hs = () => { setA2hsDismissed(true); localStorage.setItem('nitro-a2hs-dismissed', '1'); };
  const orderTourChecked = useRef(false);
  const bottomNavRef = useRef(null);
  const [notifOpen, setNotifOpen] = useState(false);
  const [readNotifIds, setReadNotifIds] = useState(() => {
    if (typeof window === 'undefined') return new Set();
    const v = localStorage.getItem("nitro-notif-v");
    if (v !== "2") { localStorage.removeItem("nitro-notif-read"); localStorage.removeItem("nitro-notif-cleared"); localStorage.removeItem("nitro-notif-cleared-at"); localStorage.setItem("nitro-notif-v", "2"); return new Set(); }
    try { const s = localStorage.getItem("nitro-notif-read"); return s ? new Set(JSON.parse(s)) : new Set(); } catch { return new Set(); }
  });
  const [clearedNotifIds, setClearedNotifIds] = useState(() => {
    if (typeof window === 'undefined') return new Set();
    try { const s = localStorage.getItem("nitro-notif-cleared"); return s ? new Set(JSON.parse(s)) : new Set(); } catch { return new Set(); }
  });
  const [notifClearedAt, setNotifClearedAt] = useState(() => {
    if (typeof window === 'undefined') return null;
    try { const s = localStorage.getItem("nitro-notif-cleared-at"); return s ? new Date(s) : null; } catch { return null; }
  });
  const [notifReadAllAt, setNotifReadAllAt] = useState(() => {
    if (typeof window === 'undefined') return null;
    try { const s = localStorage.getItem("nitro-notif-readall-at"); return s ? new Date(s) : null; } catch { return null; }
  });
  const [notifSynced, setNotifSynced] = useState(false);

  // Persist to localStorage on change
  useEffect(() => { try { localStorage.setItem("nitro-notif-read", JSON.stringify([...readNotifIds])); } catch {} }, [readNotifIds]);
  useEffect(() => { try { localStorage.setItem("nitro-notif-cleared", JSON.stringify([...clearedNotifIds])); } catch {} }, [clearedNotifIds]);
  useEffect(() => { if (notifClearedAt) { try { localStorage.setItem("nitro-notif-cleared-at", notifClearedAt.toISOString()); } catch {} } }, [notifClearedAt]);
  useEffect(() => { if (notifReadAllAt) { try { localStorage.setItem("nitro-notif-readall-at", notifReadAllAt.toISOString()); } catch {} } }, [notifReadAllAt]);

  // Scroll lock when sidebar or notification panel is open (mobile/tablet)
  useEffect(() => { document.body.style.overflow = leftOpen || notifOpen ? "hidden" : ""; return () => { document.body.style.overflow = ""; }; }, [leftOpen, notifOpen]);

  // Sync theme preference to server when it changes (skip initial mount)
  const themeSyncedRef = useRef(false);
  useEffect(() => {
    if (!themeSyncedRef.current) { themeSyncedRef.current = true; return; }
    fetch("/api/auth/notifications", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ themePreference: themeMode }) }).catch(() => {});
  }, [themeMode]);
  const [user, setUser] = useState(() => {
    const u = initialData?.user || null;
    if (typeof window !== 'undefined' && u) {
      const prev = localStorage.getItem("nitro-uid");
      if (prev && prev !== u.id) {
        ["nitro_bulk_cart_v1", "nitro-page", "nitro-notif-read", "nitro-notif-cleared", "nitro-notif-cleared-at", "nitro-notif-readall-at"].forEach(k => localStorage.removeItem(k));
        ["nitro_order_mode", "nitro_bulk_pending_key", "nitro-payment-status"].forEach(k => sessionStorage.removeItem(k));
      }
      localStorage.setItem("nitro-uid", u.id);
    }
    return u;
  });
  const [orders, setOrders] = useState(initialData?.orders || []);
  // Whether this account has reseller access — decides if the Catalogue tab
  // shows. One lightweight probe; non-resellers get a 403 and no tab.
  const [isReseller, setIsReseller] = useState(false);
  useEffect(() => {
    fetch("/api/reseller/catalogue?probe=1").then(r => { if (r.ok) setIsReseller(true); }).catch(() => {});
  }, []);
  const [activeOrders, setActiveOrders] = useState(initialData?.activeOrders || []);
  const [ordersTotal, setOrdersTotal] = useState(initialData?.ordersTotal ?? initialData?.orders?.length ?? 0);
  const [orderSummary, setOrderSummary] = useState(initialData?.orderSummary || {
    total: initialData?.ordersTotal ?? initialData?.orders?.length ?? 0,
    active: 0, completed: 0, thisWeek: 0, attention: 0,
    spent: 0, refunded: 0, averageQuantity: 0, topPlatform: null,
  });
  const [txs, setTxs] = useState(initialData?.transactions || []);
  const [transactionsTotal, setTransactionsTotal] = useState(initialData?.transactionsTotal ?? initialData?.transactions?.length ?? 0);
  const [unreadTickets, setUnreadTickets] = useState(initialData?.unreadTickets || []);
  const [walletSummary, setWalletSummary] = useState(initialData?.walletSummary || { funded: 0, spent: 0 });
  const enrichedTxs = useMemo(() => {
    const orderMap = {};
    orders.forEach(o => { orderMap[o.id] = o; });
    return txs.map(tx => {
      if (tx.type === 'order' && tx.reference) {
        const o = orderMap[tx.reference];
        if (o) {
          const name = o.tier ? `${o.service} (${o.tier})` : o.service;
          const prefix = tx.description?.startsWith('Reorder') ? 'Reorder' : 'Order';
          return { ...tx, description: `${prefix} ${tx.reference} — ${name} x${o.quantity?.toLocaleString()}`, orderStatus: o.status };
        }
      }
      return tx;
    });
  }, [txs, orders]);
  const [alerts, setAlerts] = useState(initialData?.alerts || []);
  const [currentTosVersion, setCurrentTosVersion] = useState(initialData?.currentTosVersion || null);
  const [tosChecked, setTosChecked] = useState(false);
  const [tosAccepting, setTosAccepting] = useState(false);
  const [phoneConfirmation, setPhoneConfirmation] = useState(() => createPhoneConfirmation(initialData?.user));
  const phoneKnown = phoneConfirmation.userId === user?.id && phoneConfirmation.phone !== null;
  const phoneForPrompt = phoneKnown ? phoneConfirmation.phone : null;
  const [phonePromptVal, setPhonePromptVal] = useState("");
  const [phonePromptSaving, setPhonePromptSaving] = useState(false);
  const [phonePromptError, setPhonePromptError] = useState("");
  const [phonePromptDone, setPhonePromptDone] = useState(false);
  const currentUserIdRef = useRef(initialData?.user?.id || null);
  const identityRequestGenerationRef = useRef(0);
  const [socialLinks, setSocialLinks] = useState({});
  const [rewards, setRewards] = useState(initialData?.rewards || null);
  const userWithRewardsStatus = useMemo(
    () => decorateUserWithRewardsStatus(user, rewards),
    [user, rewards],
  );
  const [activePromotion, setActivePromotion] = useState(null);
  const [gatewayReturnReference] = useState(() => {
    if (typeof window === 'undefined') return null;
    const params = new URLSearchParams(window.location.search);
    return params.get("verify") || params.get("reference") || params.get("trxref");
  });
  const [paymentStatus, setPaymentStatusRaw] = useState(() => {
    if (typeof window === 'undefined') return null;
    return readStoredPaymentStatus(sessionStorage, initialData?.user?.id);
  });
  const paymentStatusRef = useRef(paymentStatus);
  const setPaymentStatus = (val) => {
    paymentStatusRef.current = val;
    setPaymentStatusRaw(val);
    persistPaymentStatus(sessionStorage, val, user?.id || initialData?.user?.id);
  };
  const notifRef = useRef(null);

  const applyDashboardUser = (incoming, {
    authoritativePhone = false,
    requestGeneration = null,
  } = {}) => {
    if (!incoming) return;
    if (currentUserIdRef.current && incoming.id && currentUserIdRef.current !== incoming.id) {
      window.location.reload();
      return;
    }
    if (incoming.id) currentUserIdRef.current = incoming.id;

    const hasPhoneField = Object.prototype.hasOwnProperty.call(incoming, 'phone');
    const incomingPhone = hasPhoneField ? normalizedPromptPhone(incoming.phone) : '';
    const responseIsCurrent = isCurrentPhoneRequest(
      requestGeneration,
      identityRequestGenerationRef.current,
    );
    const stalePhoneResponse = authoritativePhone
      && requestGeneration !== null
      && !responseIsCurrent;
    const allowPhoneClear = authoritativePhone
      && hasPhoneField
      && !incomingPhone
      && responseIsCurrent;

    // A newly observed number invalidates all older identity/dashboard reads.
    if (authoritativePhone && incomingPhone && responseIsCurrent) {
      identityRequestGenerationRef.current = advancePhoneGeneration(
        identityRequestGenerationRef.current,
        incomingPhone,
      );
    }
    if (!stalePhoneResponse) {
      setPhoneConfirmation(current => reconcilePhoneConfirmation(
        current,
        incoming,
        { authoritative: authoritativePhone, allowClear: allowPhoneClear },
      ));
    }
    setUser(previous => {
      if (stalePhoneResponse && hasPhoneField) {
        return { ...incoming, phone: previous?.id === incoming.id ? previous.phone : '' };
      }
      return allowPhoneClear
        ? { ...incoming, phone: '' }
        : mergeDashboardUser(previous, incoming);
    });
  };

  // Reconcile a persisted transient notice only against the exact Flutterwave
  // deposit that created it. A confirmed success is never downgraded by stale
  // dashboard data, while a later durable completion can safely upgrade it.
  useEffect(() => {
    const current = paymentStatusRef.current;
    if (!current?.reference || isCreditedPaymentResult(current)) return;
    const tx = txs.find(item => (
      item.type === "deposit"
      && (item.method === "flutterwave" || item.method == null)
      && item.reference === current.reference
    ));
    if (!tx) return;

    const next = paymentNoticeFromTransaction(tx);
    if (
      current.type === next.type
      && current.paymentState === next.paymentState
      && current.transactionStatus === next.transactionStatus
    ) return;
    setPaymentStatus(next);
  }, [txs]);

  // Build notification items — single source of truth for both bell badge and dropdown
  const notifItems = useMemo(() => {
    const dark_ = typeof document !== 'undefined' && document.documentElement.classList.contains('dark');
    const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const all = [
      ...orders.filter(o => o.created && new Date(o.created) >= cutoff).map(o => {
        const s = o.status;
        return {
          id: `ord-${o.id}`, type: "order",
          title: s === "Completed" ? "Order delivered" : s === "Cancelled" ? "Order cancelled" : "Order in progress",
          desc: `${o.service || "Service"} ${s === "Completed" ? "delivered" : s === "Cancelled" ? "cancelled" : "started"}`,
          time: o.created ? fD(o.created) : "", ts: new Date(o.created),
          color: s === "Completed" ? (dark_ ? "#60a5fa" : "#2563eb") : s === "Cancelled" ? (dark_ ? "#fca5a5" : "#dc2626") : (dark_ ? "#e0a458" : "#d97706"),
          icon: s === "Completed" ? "check" : s === "Cancelled" ? "x" : "clock",
        };
      }),
      ...txs.filter(tx => tx.type === "deposit" && tx.status === "Completed" && tx.date && new Date(tx.date) >= cutoff).map(tx => ({
        id: `dep-${tx.id || tx.reference}`, type: "deposit", title: "Funds added",
        desc: `${fN(tx.amount)} added via ${tx.method || "Flutterwave"}`,
        time: tx.date ? fD(tx.date) : "", ts: new Date(tx.date),
        color: dark_ ? "#6ee7b7" : "#059669",
        icon: "dollar",
      })),
      ...txs.filter(tx => (tx.type === "bonus" || tx.type === "admin_credit" || tx.type === "referral") && tx.date && new Date(tx.date) >= cutoff).map(tx => ({
        id: `bonus-${tx.id || tx.reference}`, type: "reward", title: tx.type === "referral" ? "Referral bonus" : tx.type === "bonus" ? "Reward received!" : "Balance credited",
        desc: `${fN(tx.amount)} — ${(tx.description || "Bonus from Nitro").replace(/\s*\[[^\]]+\]\s*/g, " ").trim()}`,
        time: tx.date ? fD(tx.date) : "", ts: new Date(tx.date),
        color: dark_ ? "#e0a458" : "#d97706",
        icon: "gift",
      })),
      ...unreadTickets.map(tk => ({
        id: `tkt-${tk.id}`, type: "ticket",
        title: "New message from support",
        desc: tk.subject || "You have an unread support message",
        time: tk.updated ? fD(tk.updated) : "", ts: new Date(tk.updated),
        color: dark_ ? "#a5b4fc" : "#4f46e5",
        icon: "chat",
        alwaysUnread: true,
      })),
    ];
    return all.filter(n => {
      if (n.alwaysUnread) return true;
      if (clearedNotifIds.has(n.id)) return false;
      if (notifClearedAt && n.ts && n.ts <= new Date(notifClearedAt)) return false;
      return true;
    }).sort((a, b) => (b.ts || 0) - (a.ts || 0));
  }, [orders, txs, unreadTickets, notifClearedAt, clearedNotifIds]);
  const bellUnread = notifSynced ? notifItems.filter(n => {
    if (n.alwaysUnread) return true;
    if (readNotifIds.has(n.id)) return false;
    if (notifReadAllAt && n.ts && n.ts <= notifReadAllAt) return false;
    return true;
  }).length : 0;

  /* Services/Order state (lifted so sidebars can access) */
  const [noPlatform, setNoPlatform] = useState("instagram");
  const [noSelSvc, setNoSelSvc] = useState(null);
  const [noSelTier, setNoSelTier] = useState(null);
  const [noQty, setNoQty] = useState(1000);
  const [noLink, setNoLink] = useState("");
  const [noComments, setNoComments] = useState("");
  const [noCatModal, setNoCatModal] = useState(false);
  const isServices = active === "services";
  const isOrders = active === "orders";
  const isReferrals = active === "referrals";
  const isSettings = active === "settings";
  const isSupport = active === "support";
  const isAddFunds = active === "add-funds";
  const isGuide = active === "guide";
  const isLeaderboard = active === "leaderboard";
  const isAudit = active === "audit";
  const isCleanup = active === "cleanup";
  const isEarn = active === "earn";
  const isLab = active === "lab";
  const isTasks = active === "tasks";
  const noHasOrder = noSelSvc && noSelTier;

  // Trigger order tour on first visit to services page
  useEffect(() => {
    if (!isServices || orderTourChecked.current || !user) return;
    orderTourChecked.current = true;
    const orderDone = user.orderTourCompleted || localStorage.getItem("nitro-order-tour-done");
    if (!orderDone) {
      const timer = setTimeout(() => setShowOrderTour(true), 600);
      return () => clearTimeout(timer);
    }
  }, [isServices, user]);

  // Manual order tour trigger from sidebar button
  useEffect(() => {
    const handler = () => setShowOrderTour(true);
    window.addEventListener("nitro-order-tour", handler);
    return () => window.removeEventListener("nitro-order-tour", handler);
  }, []);

  useEffect(() => { if (isSupport) setUnreadTickets([]); }, [isSupport]);


  /* Theme — provided by ThemeProvider */

  /* Refresh dashboard data */
  const refreshDashboard = async () => {
    try {
      const phoneRequestGeneration = identityRequestGenerationRef.current;
      const res = await fetch("/api/dashboard", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        applyDashboardUser(data.user, {
          authoritativePhone: true,
          requestGeneration: phoneRequestGeneration,
        });
        if (data.orders) setOrders(data.orders);
        if (data.activeOrders) setActiveOrders(data.activeOrders);
        if (data.ordersTotal != null) setOrdersTotal(data.ordersTotal);
        if (data.orderSummary) setOrderSummary(data.orderSummary);
        if (data.transactions) setTxs(data.transactions);
        if (data.transactionsTotal != null) setTransactionsTotal(data.transactionsTotal);
        if (data.unreadTickets) setUnreadTickets(data.unreadTickets);
        if (data.walletSummary) setWalletSummary(data.walletSummary);
        if (data.alerts) setAlerts(data.alerts);
        if (data.currentTosVersion) setCurrentTosVersion(data.currentTosVersion);
      }
    } catch {}
    try { const cr = await fetch("/api/promotion"); if (cr.ok) { const cd = await cr.json(); setActivePromotion(cd.active ? cd : null); } } catch {}
  };

  const refreshRewards = () => fetch('/api/rewards').then(r => r.ok ? r.json() : null).then(d => { if (d) setRewards(d); }).catch(() => {});

  /* Auto-poll when on orders page (every 45s) */
  useEffect(() => {
    if (active !== "orders") return;
    const interval = setInterval(refreshDashboard, 45000);
    return () => clearInterval(interval);
  }, [active]);

  /* Data fetch */
  useEffect(() => {
    async function load() {
      try {
        /* Check maintenance mode first */
        try {
          const maintRes = await fetch("/api/maintenance-check");
          if (maintRes.ok) { const m = await maintRes.json(); if (m.maintenance) { window.location.replace("/maintenance"); return; } }
        } catch {}

        /* Skip the full dashboard fetch if the server already provided data. */
        if (!initialData) {
          const phoneRequestGeneration = identityRequestGenerationRef.current;
          const res = await fetch("/api/dashboard", { cache: "no-store" });
          if (res.status === 401) { window.location.replace("/?session_expired=1"); return; }
          if (res.ok) {
            const data = await res.json();
            applyDashboardUser(data.user, {
              authoritativePhone: true,
              requestGeneration: phoneRequestGeneration,
            });
            if (data.orders) setOrders(data.orders);
            if (data.activeOrders) setActiveOrders(data.activeOrders);
            if (data.ordersTotal != null) setOrdersTotal(data.ordersTotal);
            if (data.orderSummary) setOrderSummary(data.orderSummary);
            if (data.transactions) setTxs(data.transactions);
            if (data.transactionsTotal != null) setTransactionsTotal(data.transactionsTotal);
        if (data.unreadTickets) setUnreadTickets(data.unreadTickets);
            if (data.walletSummary) setWalletSummary(data.walletSummary);
            if (data.alerts) setAlerts(data.alerts);
            if (data.currentTosVersion) setCurrentTosVersion(data.currentTosVersion);
          } else setUser(prev => prev || { name: "User", email: "", balance: 0, phone: "", refCode: "—", refs: 0, earnings: 0 });
        }
        /* Fetch social links + active promotion + rewards */
        try { const sr = await fetch("/api/settings"); if (sr.ok) { const sd = await sr.json(); setSocialLinks(sd.settings || {}); } } catch {}
        try { const cr = await fetch("/api/promotion"); if (cr.ok) { const cd = await cr.json(); if (cd.active) setActivePromotion(cd); } } catch {}
        if (!initialData?.rewards) {
          fetch('/api/rewards').then(r => r.ok ? r.json() : null).then(d => { if (d) setRewards(d); }).catch(() => {});
        }
        /* Load notification state + preferences from server (merges with localStorage) */
        try {
          const nr = await fetch("/api/auth/notifications");
          if (nr.ok) {
            const nd = await nr.json();
            if (nd.notifClearedAt) setNotifClearedAt(new Date(nd.notifClearedAt));
            if (nd.notifReadAllAt) {
              setNotifReadAllAt(new Date(nd.notifReadAllAt));
            } else {
              const now = new Date();
              setNotifReadAllAt(now);
              fetch("/api/auth/notifications", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ readAllAt: now.toISOString() }) }).catch(() => {});
            }
            if (Array.isArray(nd.notifReadIds) && nd.notifReadIds.length > 0) {
              setReadNotifIds(prev => new Set([...prev, ...nd.notifReadIds]));
            }
            // Sync theme from server (overrides localStorage on new devices)
            if (nd.themePreference && nd.themePreference !== "auto") {
              const saved = localStorage.getItem("nitro-theme");
              if (!saved || saved === "auto") {
                setThemeMode(nd.themePreference);
                setDark(nd.themePreference === "night");
                try { localStorage.setItem("nitro-theme", nd.themePreference); } catch {}
              }
            }
            // Sync perPage from server
            if (nd.perPagePreference && nd.perPagePreference !== 10) {
              const saved = localStorage.getItem("nitro-per-page");
              if (!saved) {
                try { localStorage.setItem("nitro-per-page", String(nd.perPagePreference)); } catch {}
              }
            }
            setNotifSynced(true);
          }
        } catch {}
        setNotifSynced(true);
      } catch { setUser(prev => prev || { name: "User", email: "", balance: 0, phone: "", refCode: "—", refs: 0, earnings: 0 }); }
    }
    load().then(() => {
      // Check tour state from DB (via user data) + localStorage as fallback
      const u = document.querySelector("[data-user-tour]");
      // We'll check after user state is set
    });
  }, []);

  // Confirm an empty phone against the narrow identity endpoint before ever
  // showing the mandatory prompt. Retry transient failures, and fence older
  // responses so they cannot undo a phone saved while the request was open.
  useEffect(() => {
    const expectedUserId = user?.id;
    if (!expectedUserId) return undefined;

    let cancelled = false;
    let retryTimer = null;
    let retryIndex = 0;
    const retryDelays = [3000, 15000];
    setPhonePromptDone(false);

    const confirmIdentity = async () => {
      const requestGeneration = ++identityRequestGenerationRef.current;
      let confirmed = false;
      try {
        const response = await fetch("/api/auth/me", { cache: "no-store" });
        const data = response.ok ? await response.json() : null;
        if (cancelled || requestGeneration !== identityRequestGenerationRef.current) return;
        if (data?.user?.id && data.user.id !== expectedUserId) {
          window.location.reload();
          return;
        }
        if (data?.user && Object.prototype.hasOwnProperty.call(data.user, 'phone')) {
          const phone = normalizedPromptPhone(data.user.phone);
          // A confirmed number wins over dashboard reads that began while this
          // identity request was still in flight.
          identityRequestGenerationRef.current = advancePhoneGeneration(
            identityRequestGenerationRef.current,
            phone,
          );
          setPhoneConfirmation(current => reconcilePhoneConfirmation(
            current,
            data.user,
            { authoritative: true, allowClear: true },
          ));
          setUser(previous => previous?.id === data.user.id ? { ...previous, phone } : previous);
          confirmed = true;
        }
      } catch {}

      if (!confirmed && !cancelled && requestGeneration === identityRequestGenerationRef.current && retryIndex < retryDelays.length) {
        const delay = retryDelays[retryIndex++];
        retryTimer = setTimeout(confirmIdentity, delay);
      } else if (!confirmed && !cancelled && requestGeneration === identityRequestGenerationRef.current) {
        // Rare fallback: if the narrow identity lookup repeatedly fails, do
        // one fresh dashboard read instead of leaving a missing-phone user in
        // an unknown state until the regular 60-second poll.
        const dashboardRequestGeneration = identityRequestGenerationRef.current;
        try {
          const response = await fetch("/api/dashboard", { cache: "no-store" });
          const data = response.ok ? await response.json() : null;
          if (!cancelled && data?.user) {
            applyDashboardUser(data.user, {
              authoritativePhone: true,
              requestGeneration: dashboardRequestGeneration,
            });
          }
        } catch {}
      }
    };

    confirmIdentity();
    return () => {
      cancelled = true;
      identityRequestGenerationRef.current += 1;
      if (retryTimer) clearTimeout(retryTimer);
    };
  }, [user?.id]);

  // Sync order tour state from DB to localStorage
  useEffect(() => {
    if (!user || user.name === "User") return;
    if (user.orderTourCompleted) try { localStorage.setItem("nitro-order-tour-done", "1"); } catch {}
  }, [user]);

  /* Smart polling — refresh data every 60s, pause when tab is hidden */
  useEffect(() => {
    let interval = null;
    const poll = async () => {
      try {
        // Check maintenance
        const mRes = await fetch("/api/maintenance-check");
        if (mRes.ok) { const m = await mRes.json(); if (m.maintenance) { window.location.replace("/maintenance"); return; } }
        const phoneRequestGeneration = identityRequestGenerationRef.current;
        const res = await fetch("/api/dashboard", { cache: "no-store" });
        if (res.status === 401) { window.location.replace("/?session_expired=1"); return; }
        if (res.ok) {
          const data = await res.json();
          if (data.user) applyDashboardUser(data.user, {
            authoritativePhone: true,
            requestGeneration: phoneRequestGeneration,
          });
          if (data.orders) setOrders(data.orders);
          if (data.activeOrders) setActiveOrders(data.activeOrders);
          if (data.ordersTotal != null) setOrdersTotal(data.ordersTotal);
          if (data.orderSummary) setOrderSummary(data.orderSummary);
          if (data.transactions) setTxs(data.transactions);
          if (data.transactionsTotal != null) setTransactionsTotal(data.transactionsTotal);
        if (data.unreadTickets) setUnreadTickets(data.unreadTickets);
          if (data.walletSummary) setWalletSummary(data.walletSummary);
          if (data.alerts) setAlerts(data.alerts);
        }
      } catch {}
    };
    const start = () => { interval = setInterval(poll, 60000); };
    const stop = () => { clearInterval(interval); interval = null; };
    const onVisibility = () => { document.hidden ? stop() : (poll(), start()); };
    start();
    document.addEventListener("visibilitychange", onVisibility);
    return () => { stop(); document.removeEventListener("visibilitychange", onVisibility); };
  }, []);

  /* Verify payment return from gateway */
  useEffect(() => {
    const ref = gatewayReturnReference;
    if (!ref) return;

    /* Clean URL immediately */
    window.history.replaceState({}, "", "/dashboard");
    setActive("add-funds");
    setPaymentStatus({
      success: false,
      type: "info",
      reference: ref,
      paymentState: PAYMENT_STATES.VERIFYING,
      transactionStatus: null,
      message: "We’re confirming your payment with Flutterwave.",
    });

    async function verify() {
      try {
        const res = await fetch("/api/payments/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reference: ref }),
        });
        const data = await res.json();
        if (isCreditedPaymentResult(data)) {
          setPaymentStatus({
            ...data,
            type: "success",
            reference: data.reference || ref,
            message: data.message || "Payment successful!",
            welcomeBonus: data.welcomeBonus || 0,
          });
          if (data.eventId && typeof window.fbq === "function") {
            window.fbq("track", "AddPaymentInfo", { value: data.amount, currency: "NGN" }, { eventID: data.eventId });
          }
          /* Refresh user balance */
          try {
            const phoneRequestGeneration = identityRequestGenerationRef.current;
            const dashRes = await fetch("/api/dashboard", { cache: "no-store" });
            if (dashRes.ok) {
              const dashData = await dashRes.json();
              applyDashboardUser(dashData.user, {
                authoritativePhone: true,
                requestGeneration: phoneRequestGeneration,
              });
              if (dashData.transactions) setTxs(dashData.transactions);
              if (dashData.transactionsTotal != null) setTransactionsTotal(dashData.transactionsTotal);
              if (dashData.unreadTickets) setUnreadTickets(dashData.unreadTickets);
              if (dashData.walletSummary) setWalletSummary(dashData.walletSummary);
            }
          } catch {}
        } else {
          setPaymentStatus(paymentNoticeFromResult(data, ref));
        }
      } catch {
        setPaymentStatus(paymentNoticeFromResult({
          paymentState: PAYMENT_STATES.RETRYABLE,
          transactionStatus: null,
          retryable: true,
          message: "We couldn’t reach Flutterwave. Your payment is safe and can be checked again.",
        }, ref));
      }
    }
    verify();
  }, [gatewayReturnReference]);

  /* Close notif on outside click */
  useEffect(() => {
    if (!notifOpen) return;
    const handler = (e) => { if (notifRef.current && !notifRef.current.contains(e.target)) setNotifOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [notifOpen]);

  useEffect(() => {
    if (!avOpen) return;
    const onDown = (e) => { if (avRef.current && !avRef.current.contains(e.target)) setAvOpen(false); };
    const onKey = (e) => { if (e.key === "Escape") setAvOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey); };
  }, [avOpen]);

  useEffect(() => {
    if (!chatOpen) return undefined;
    dockInputRef.current?.focus();
    const onKey = (e) => { if (e.key === "Escape") setChatOpen(false); };
    document.addEventListener("keydown", onKey);
    // On a phone the panel is a sheet and owns the screen; on a desktop it is a small window and the page stays live.
    const phone = window.matchMedia("(max-width: 1199px)").matches;
    const prev = document.body.style.overflow;
    if (phone) document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); if (phone) document.body.style.overflow = prev; };
  }, [chatOpen]);

  const sendDockMessage = () => {
    const num = socialLinks.social_whatsapp_support?.replace(/\D/g, "");
    if (!num) return;
    // The account goes in the message so support never has to ask "which
    // account?" before placing anything.
    const who = user?.email ? `\n\nMy account: ${user.email}` : "";
    const text = (dockMsg.trim()
      ? `Hi Nitro, please place this order for me: ${dockMsg.trim()}`
      : "Hi Nitro, I want to place an order. Can you help me?") + who;
    openWa(text);
    setDockMsg(""); setChatOpen(false);
  };
  // In place on a phone (WhatsApp takes over the screen anyway), a new tab on a desktop.
  const openWa = (text) => {
    const num = socialLinks.social_whatsapp_support?.replace(/\D/g, "");
    if (!num) return;
    const url = `https://wa.me/${num}?text=${encodeURIComponent(text)}`;
    if (window.matchMedia("(max-width: 1199px)").matches) window.location.href = url; else window.open(url, "_blank", "noopener");
  };
  const chatQuick = (text) => { const who = user?.email ? `\n\nMy account: ${user.email}` : ""; openWa(text + who); setChatOpen(false); };

  const handleLogout = async () => {
    let res;
    try {
      res = await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      window.alert("Unable to log out. Check your connection and try again.");
      return;
    }
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      window.alert(data.error || "Unable to log out. Please try again.");
      return;
    }
    try { sessionStorage.removeItem(PAYMENT_STATUS_STORAGE_KEY); } catch {}
    window.location.replace("/?logout=1");
  };

  /* Reset services state when leaving */
  useEffect(() => { if (!isServices) { setNoSelSvc(null); setNoSelTier(null); setNoLink(""); setNoComments(""); setNoCatModal(false); } }, [active]);

  const t = baseT;

  const initials = user ? ((user.firstName?.[0] || '') + (user.lastName?.[0] || '')).toUpperCase() || user.name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2) : "";
  const firstName = user ? (user.firstName || user.name.split(" ")[0]) : "";

  /* Loading — skeleton */
  if (!user) {
    const skBone = `skel-bone ${dark ? "skel-dark" : "skel-light"}`;
    return (
      <div className="dash-root bg-t-bg">
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}@keyframes skeletonShimmer{0%{background-position:-200% 0}100%{background-position:200% 0}}`}</style>
        <nav className="dash-nav bg-t-sidebar-bg border-b-[0.5px] border-t-sidebar-border">
          <div className="dash-nav-left">
            <div className="dash-logo-static">
              <div className="h-7 px-3 rounded-lg flex items-center justify-center" style={{ background: "linear-gradient(135deg,#c47d8e,#8b5e6b)" }}><NitroWordmark height={12} color="#fff" /></div>
            </div>
          </div>
          <div className="dash-nav-right">
            <div className={`${skBone} w-11 h-6 rounded-xl`} />
            <div className={`${skBone} w-[30px] h-[30px] rounded-[10px]`} />
          </div>
        </nav>
        <div className="dash-body">
          <aside className="dash-left bg-t-sidebar-bg border-r-[0.5px] border-t-sidebar-border">
            {[1,2,3,4,5,6,7,8].map(i => <div key={i} className={`${skBone} h-9 rounded-xl mb-1`} />)}
          </aside>
          <main className="dash-main bg-t-bg">
            <div className={`${skBone} w-[260px] h-6 mb-2`} />
            <div className={`${skBone} w-[200px] h-3.5 mb-6`} />
            <div className="grid grid-cols-4 gap-3 mb-6">
              {[1,2,3,4].map(i => (
                <div key={i} className="p-5 rounded-2xl" style={{ background: t.cardBg, border: `1px solid ${t.cardBorder}` }}>
                  <div className={`${skBone} w-[60%] h-2.5 mb-2.5`} />
                  <div className={`${skBone} w-[45%] h-6 mb-2`} />
                  <div className={`${skBone} w-[70%] h-[9px]`} />
                </div>
              ))}
            </div>
            <div className={`${skBone} w-[120px] h-2.5 mb-3`} />
            <div className="rounded-2xl py-1 px-4 bg-t-card-bg border border-t-card-border">
              {[1,2,3,4].map(i => (
                <div key={i} className="flex justify-between items-center py-4" style={{ borderBottom: i < 4 ? `1px solid ${t.cardBorder}` : "none" }}>
                  <div>
                    <div className={`${skBone} w-[220px] h-[13px] mb-2`} />
                    <div className="flex gap-3">
                      <div className={`${skBone} w-[70px] h-2.5`} />
                      <div className={`${skBone} w-[50px] h-2.5`} />
                    </div>
                  </div>
                  <div className={`${skBone} w-[60px] h-[13px]`} />
                </div>
              ))}
            </div>
          </main>
          <div className="dash-right bg-t-sidebar-bg border-l-[0.5px] border-t-sidebar-border">
            <div className={`${skBone} w-[100px] h-2 mb-3.5`} />
            {[1,2,3].map(i => <div key={i} className={`${skBone} h-[50px] rounded-[10px] mb-1.5`} />)}
            <div className="h-0.5 my-3 bg-t-sidebar-border" />
            <div className={`${skBone} w-20 h-2 mb-3.5`} />
            <div className={`${skBone} h-20 rounded-xl`} />
          </div>
        </div>
      </div>
    );
  }

  /* Render active page */
  const renderPage = () => {
    switch (active) {
      case "overview":
        return <OverviewPage user={user} orders={orders} activeOrders={activeOrders} orderSummary={orderSummary} isReseller={isReseller} dark={dark} t={t} setActive={setActive} a2hs={{ ready: a2hsReady, isIos, dismissed: a2hsDismissed, onInstall: handleA2hsInstall, onDismiss: dismissA2hs }} socialLinks={socialLinks} rewards={rewards} />;
      case "services":
        return <NewOrderPage dark={dark} t={t} user={user} onOrderSuccess={refreshDashboard} onViewOrders={() => setActive("orders")} onNavigate={(id) => setActive(id)} onTopUp={() => setActive("add-funds")} platform={noPlatform} setPlatform={setNoPlatform} selSvc={noSelSvc} setSelSvc={setNoSelSvc} selTier={noSelTier} setSelTier={setNoSelTier} qty={noQty} setQty={setNoQty} link={noLink} setLink={setNoLink} comments={noComments} setComments={setNoComments} catModal={noCatModal} setCatModal={setNoCatModal} tourActive={showOrderTour} activePromotion={activePromotion} rewards={rewards} socialLinks={socialLinks} refreshRewards={refreshRewards} />;
      case "orders":
        return <OrdersPage orders={orders} initialTotal={ordersTotal} orderSummary={orderSummary} txs={enrichedTxs} dark={dark} t={t} onNavigate={setActive} onRefresh={refreshDashboard} waNum={socialLinks.social_whatsapp_support?.replace(/\D/g, "")} email={user?.email} />;
      case "referrals":
        return <ReferralsPage user={user} dark={dark} t={t} />;
      case "settings":
        return <SettingsPage user={userWithRewardsStatus} dark={dark} t={t} themeMode={themeMode} setThemeMode={setThemeMode} setDark={setDark} />;
      case "support":
        if (socialLinks.social_whatsapp_support) { window.open(`https://wa.me/${socialLinks.social_whatsapp_support.replace(/\D/g, "")}?text=${encodeURIComponent("Hi Nitro, I need help")}`, "_blank"); setActive("overview"); return null; }
        return <SupportPage dark={dark} t={t} />;
      case "add-funds":
        return <AddFundsPage user={user} txs={enrichedTxs} transactionsTotal={transactionsTotal} walletSummary={walletSummary} dark={dark} t={t} paymentStatus={paymentStatus} setPaymentStatus={setPaymentStatus} gatewayReturnReference={gatewayReturnReference} onPlaceOrder={() => setActive("services")} onRefresh={refreshDashboard} />;
      case "guide":
        return <GuidePage dark={dark} t={t} />;
      case "earn":
        return <EarnPage dark={dark} t={t} />;
      case "leaderboard":
        return <LeaderboardPage dark={dark} t={t} />;
      case "audit":
        return <WaitlistPage feature="audit" dark={dark} t={t} />;
      case "cleanup":
        return <WaitlistPage feature="cleanup" dark={dark} t={t} />;
      case "tasks":
        return <TasksPage dark={dark} t={t} />;
      case "lab":
        return <ResellerLabPage dark={dark} t={t} onNavigate={setActive} socialLinks={socialLinks} />;
      case "catalogue":
        return <ResellerCataloguePage dark={dark} t={t} />;
      default:
        return (
          <div className="p-10 rounded-2xl flex flex-col items-center justify-center min-h-[300px]" style={{ background: t.cardBg, border: `1px solid ${t.cardBorder}` }}>
            <div className="text-base font-medium text-t-text-muted">{active.charAt(0).toUpperCase() + active.slice(1).replace("-", " ")}</div>
            <div className="text-sm opacity-50 mt-1 text-t-text-muted">Coming soon</div>
          </div>
        );
    }
  };

  return (
    <ToastProvider dark={dark}>
    <ConfirmProvider dark={dark}>
    <div className="dash-root user-dash bg-t-bg">

      {/* ═══ TOP NAV ═══ */}
      <nav className="dash-nav" style={{ background: dark ? "rgba(9,12,21,.9)" : "rgba(248,245,241,.92)", borderBottom: `0.5px solid ${dark ? "rgba(255,255,255,.09)" : "rgba(0,0,0,.06)"}`, backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)" }}>
        <div className="dash-nav-left">
          {/* Mobile/tablet: hamburger + logo as one button to toggle sidebar */}
          <button className="dash-menu-btn" onClick={() => setLeftOpen(!leftOpen)} aria-label={leftOpen ? "Close menu" : "Open menu"}>
            <div className="dash-hamburger-bars" style={{ opacity: leftOpen ? 0 : 1, position: leftOpen ? "absolute" : "relative" }}>
              <div className="h-0.5 rounded-[1px] w-4 bg-accent" />
              <div className="h-0.5 rounded-[1px] w-[11px] bg-accent" />
              <div className="h-0.5 rounded-[1px] w-4 bg-accent" />
            </div>
            {leftOpen && (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={t.accent} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            )}
            <span className="dash-logo-n"><span className="w-[24px] h-[24px] rounded-[6px] flex items-center justify-center" style={{ background: t.grad }}><svg width="10" height="11" viewBox="0 0 1601 1785" fill="#fff"><path d="M1600.82 160.089V1313c-.85 53.13-10.35 104.17-27.19 151.74-48.19 136.54-156.38 244.73-292.92 292.92-50.12 17.76-103.94 27.34-160.08 27.34 0 0-79.39 0-160.01-27.34-85.1-28.88-155.38-85.49-208.28-141.55-72.59-76.84-112.13-179.09-112.13-284.74V1023.4v-3.08-12.9c.08-1.39.08-2.7.08-4.17 0-1.39 0-2.7-.08-4.09-2.08-84.64-69.97-153.06-154.53-155.84-1.85-.08-3.71-.15-5.48-.15-1.78 0-3.71.08-5.48.15-84.56 2.78-152.44 71.2-154.61 155.84-.08 1.39-.08 2.7-.08 4.09 0 1.47 0 2.78.08 4.17v534.87c0 88.42-71.67 160.09-160.09 160.09-44.17 0-84.25-17.92-113.21-46.88C17.92 1626.84 0 1586.76 0 1542.59V995.288c.927-53.132 10.426-104.178 27.261-151.672C75.45 707.003 183.643 598.81 320.179 550.621c50.119-17.685 103.946-27.338 160.089-27.338 0 0 79.388 0 160.012 27.338 85.103 28.882 155.379 85.489 208.278 141.555 72.593 76.84 112.132 179.087 112.132 284.732v307.972l-.077.92v12.89c-.077 1.39-.077 2.78-.077 4.17 0 1.39 0 2.7.077 4.17 2.085 84.64 69.967 152.99 154.527 155.84 1.86 0 3.71 0 5.49 0 1.77 0 3.7 0 5.48 0 84.56-2.85 152.44-71.2 154.6-155.84V160.089C1280.71 71.666 1352.38 0 1440.8 0c44.18 0 84.18 17.916 113.14 46.876 28.96 28.96 46.88 69.04 46.88 113.213z"/></svg></span></span>
            <span className="dash-logo-wordmark"><span className="h-7 px-3 rounded-lg flex items-center justify-center" style={{ background: "linear-gradient(135deg,#c47d8e,#8b5e6b)" }}><NitroWordmark height={12} color="#fff" /></span></span>
          </button>
          {/* Desktop: static logo, no click action */}
          <div className="dash-logo-static">
            <div className="h-7 px-3 rounded-lg flex items-center justify-center" style={{ background: "linear-gradient(135deg,#c47d8e,#8b5e6b)" }}><NitroWordmark height={12} color="#fff" /></div>
          </div>
        </div>
        <div className="dash-nav-right">
          {/* Balance pill — desktop only. Balance as a number, Top up as the action inside it. */}
          <button onClick={() => setActive("add-funds")} aria-label={`Balance ₦${Math.round(user?.balance || 0).toLocaleString()}. Top up`}
            className="max-desktop:hidden flex items-center gap-2 h-[34px] pl-3 pr-1.5 rounded-full cursor-pointer text-[13px] font-semibold text-t-text"
            style={{ background: dark ? "rgba(255,255,255,.07)" : "#fff", border: `1px solid ${dark ? "rgba(255,255,255,.12)" : "rgba(0,0,0,.08)"}`, fontVariantNumeric: "tabular-nums" }}>
            ₦{Math.round(user?.balance || 0).toLocaleString()}
            <span className="text-[11px] font-bold text-white py-1 px-2.5 rounded-full" style={{ background: t.accent }}>Top up</span>
          </button>
          {/* Notification bell */}
          <div ref={notifRef} className="relative">
            <button onClick={() => setNotifOpen(!notifOpen)} className="dash-bell" aria-label="Notifications" style={{ color: t.textSoft }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></svg>
              {bellUnread > 0 && <div className="dash-bell-badge">{bellUnread > 10 ? "10+" : bellUnread}</div>}
            </button>
            {notifOpen && <NotifDropdown items={notifItems} dark={dark} t={t} onClose={() => setNotifOpen(false)} readIds={readNotifIds} setReadIds={setReadNotifIds} clearedIds={clearedNotifIds} setClearedIds={setClearedNotifIds} setClearedAt={setNotifClearedAt} readAllAt={notifReadAllAt} setReadAllAt={setNotifReadAllAt} onNavigate={setActive} socialLinks={socialLinks} />}
          </div>
          {/* Avatar → account menu on desktop, Settings on mobile (the More sheet carries the rest there) */}
          <div ref={avRef} className="relative">
            <button
              onClick={() => { if (window.matchMedia("(min-width: 1200px)").matches) setAvOpen(o => !o); else { setActive("settings"); setLeftOpen(false); } }}
              className="dash-avatar-btn" aria-label="Account menu" aria-haspopup="menu" aria-expanded={avOpen}>
              <Avatar size={30} rounded={10} />
            </button>
            {avOpen && (
              <div role="menu" aria-label="Account" className="dash-av-menu" style={{ background: dark ? "#131728" : "#fff", border: `1px solid ${dark ? "rgba(255,255,255,.1)" : "rgba(0,0,0,.08)"}` }}>
                <div className="dash-av-head" style={{ borderBottom: `1px solid ${dark ? "rgba(255,255,255,.08)" : "rgba(0,0,0,.06)"}` }}>
                  <Avatar size={34} rounded={10} />
                  <div className="min-w-0 flex-1">
                    <div className="text-[13px] font-semibold truncate text-t-text">{user?.name || "Your account"}</div>
                    <div className="text-[11px] truncate text-t-text-muted">{user?.email || ""}</div>
                  </div>
                  <button role="menuitem" onClick={() => { setAvOpen(false); setActive("settings"); }} className="dash-av-gear" aria-label="Settings" style={{ color: t.textMuted }}>{I.settings}</button>
                </div>
                <button role="menuitem" onClick={() => { setAvOpen(false); window.location.href = "/changelog"; }} className="dash-av-item" style={{ color: t.textSoft }}>{I.changelog}What&rsquo;s New</button>
                <button role="menuitem" onClick={() => { setAvOpen(false); setActive("referrals"); }} className="dash-av-item" style={{ color: t.textSoft }}>{I.referrals}Referrals</button>
                <button role="menuitem" onClick={() => { setAvOpen(false); if (socialLinks.social_whatsapp_support) window.open(`https://wa.me/${socialLinks.social_whatsapp_support.replace(/\D/g, "")}?text=${encodeURIComponent("Hi Nitro, I need help")}`, "_blank"); }} className="dash-av-item" style={{ color: "#25d366" }}>{I.support}Support on WhatsApp</button>
                <div className="dash-av-foot" style={{ borderTop: `1px solid ${dark ? "rgba(255,255,255,.08)" : "rgba(0,0,0,.06)"}` }}>
                  <div role="group" aria-label="Theme" className="inline-flex items-center gap-0.5 p-[3px] rounded-full" style={{ background: dark ? "rgba(255,255,255,.08)" : "rgba(0,0,0,.05)", border: `1px solid ${t.cardBorder}` }}>
                    {[["day", "Light", <svg key="d" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>], ["night", "Dark", <svg key="n" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 12.8A9 9 0 1111.2 3a7 7 0 009.8 9.8z"/></svg>], ["auto", "Auto", <svg key="a" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg>]].map(([id, label, icon]) => (
                      <button key={id} onClick={() => applyThemeMode(id)} aria-pressed={themeMode === id} aria-label={label} title={label} className="w-8 h-7 rounded-full border-none flex items-center justify-center cursor-pointer" style={themeMode === id ? { background: dark ? "#161b2e" : "#fff", color: t.text, boxShadow: "0 1px 3px rgba(0,0,0,.12)" } : { background: "transparent", color: t.textMuted }}>{icon}</button>
                    ))}
                  </div>
                  <button role="menuitem" onClick={handleLogout} className="dash-av-logout" style={{ color: t.textMuted }}>Log out</button>
                </div>
              </div>
            )}
          </div>
        </div>
      </nav>

      {/* ═══ BODY ═══ */}
      <div className="dash-body">

        {/* ── LEFT SIDEBAR ── */}
        <aside className="dash-left bg-t-sidebar-bg border-r-[0.5px] border-t-sidebar-border" style={{ left: leftOpen ? 0 : undefined }}>

            {/* ── Nav items — grouped on desktop, flat on mobile ── */}
            <>
              {(() => {
                // Sections group the rail by what you are doing, not alphabetically.
                // Account-level items (referrals, what's new, settings, log out) live
                // behind the avatar on desktop and in the More sheet on mobile.
                const byId = Object.fromEntries(NAV_ITEMS.map(n => [n.id, n]));
                const browse = isReseller ? { id: "catalogue", label: "Catalogue" } : { id: "resellers", label: "Resellers", href: "/resellers" };
                const hq = { id: "lab", label: isReseller ? "Reseller HQ" : "API access" };
                const sections = [
                  ["Order", [byId.overview, byId.services, byId.orders]],
                  ["Money", [byId["add-funds"], byId.tasks]],
                  ["Browse", [browse, hq, byId.guide]],
                  ["Help", [byId.support]],
                ];
                return sections.flatMap(([section, items]) => items.filter(Boolean).map((item, j) => ({ ...item, section, first: j === 0 })));
              })().map((item, i) => {
                const processingCount = item.id === "orders" ? orderSummary.active : 0;
                const isSupportItem = item.id === "support";
                const isTasksItem = item.id === "tasks";
                const isActive = active === item.id;
                const specialClr = isSupportItem ? "#25d366" : (isTasksItem || item.id === "resellers") ? (dark ? "#60a5fa" : "#2563eb") : null;
                return (
                  <Fragment key={item.id}>
                    {item.first && <div className="rail-sec"><span>{item.section}</span></div>}
                    <button data-nav={item.id} onClick={() => { if (item.soon) return; if (item.href) { window.location.href = item.href; return; } if (isSupportItem) { setLeftOpen(false); setChatOpen(true); return; } setActive(item.id); setLeftOpen(false); }} className={"rail-it" + (isActive ? " on" : "") + (specialClr && !isActive ? " tint" : "") + (item.soon ? " soon" : "")} style={specialClr ? { "--ic": specialClr } : undefined}>
                      <span className="rail-ii">{I[item.id]}</span>
                      <span className="rail-il">{item.label}</span>
                      {item.soon && <span className="text-[11px] font-bold uppercase tracking-[0.5px] py-[1px] px-1.5 rounded-[4px] ml-auto text-accent" style={{ background: dark ? "rgba(196,125,142,.15)" : "rgba(196,125,142,.1)" }}>Soon</span>}
                      {processingCount > 0 && <span className="m rail-bd">{processingCount > 99 ? "99+" : processingCount}</span>}
                    </button>
                  </Fragment>
                );
              })}
            </>

          <div className="flex-1" />
          <div className="dash-sidebar-divider bg-t-sidebar-border" />
          <div className="dash-sidebar-social">
            <div className="dash-social-btns">
              <a href={`https://instagram.com/${(socialLinks.social_instagram || "Nitro.ng").replace(/^(https?:\/\/)?(www\.)?(instagram\.com)\/?/i,"").replace(/^@/,"").replace(/\/$/,"")}`} target="_blank" rel="noopener noreferrer" className="dash-social-btn text-accent" title="Instagram">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><rect x="2" y="2" width="20" height="20" rx="5"/><path d="M16 11.37A4 4 0 1112.63 8 4 4 0 0116 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/></svg>
              </a>
              <a href={`https://x.com/${(socialLinks.social_twitter || "TheNitroNG").replace(/^(https?:\/\/)?(www\.)?(x\.com|twitter\.com)\/?/i,"").replace(/^@/,"").replace(/\/$/,"")}`} target="_blank" rel="noopener noreferrer" className="dash-social-btn" title="X (Twitter)" style={{ color: dark ? "rgba(255,255,255,.6)" : "rgba(0,0,0,.5)" }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
              </a>
              {socialLinks.social_tiktok && <a href={`https://tiktok.com/@${socialLinks.social_tiktok.replace(/^(https?:\/\/)?(www\.)?(tiktok\.com\/@?)?/i,"").replace(/^@/,"").replace(/\/$/,"")}`} target="_blank" rel="noopener noreferrer" className="dash-social-btn" title="TikTok" style={{ color: dark ? "rgba(255,255,255,.6)" : "rgba(0,0,0,.5)" }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.27 6.27 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V9.41a8.16 8.16 0 004.77 1.52V7.48a4.85 4.85 0 01-1-.79z"/></svg>
              </a>}
              {socialLinks.social_whatsapp_support && <a href={`https://wa.me/${socialLinks.social_whatsapp_support.replace(/\D/g,"")}`} target="_blank" rel="noopener noreferrer" className="dash-social-btn text-[#25d366]" title="WhatsApp">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
              </a>}
            </div>
          </div>
        </aside>

        {/* Overlay */}
        {leftOpen && <div className="dash-overlay" onClick={() => setLeftOpen(false)} />}

        {/* ── MAIN ── */}
        <main className="dash-main bg-t-bg" style={isSupport ? { overflow: "hidden" } : undefined}>
          <AnnouncementBanner alerts={alerts} dark={dark} mode="dashboard" />
          {activePromotion && (
            <div className="mb-3 rounded-xl px-4 py-2.5 flex items-center gap-2.5" style={{ background: activePromotion.bannerColor ? `${activePromotion.bannerColor}22` : (dark ? 'rgba(16,185,129,.12)' : 'rgba(16,185,129,.08)'), border: `1px solid ${activePromotion.bannerColor || '#10b981'}44` }}>
              <span className="w-2 h-2 rounded-full shrink-0 animate-pulse" style={{ background: activePromotion.bannerColor || '#10b981' }} />
              <span className="text-sm font-medium flex-1 text-t-text">{activePromotion.bannerCopy}</span>
              <span className="px-2.5 py-1 rounded-lg text-xs font-bold shrink-0 m text-center" style={{ background: activePromotion.bannerColor || '#10b981', color: '#fff' }}>{activePromotion.discountPercent}% OFF{activePromotion.maxDiscountPerOrder ? <><br /><span className="font-medium opacity-90" style={{ fontSize: 11 }}>up to ₦{(activePromotion.maxDiscountPerOrder / 100).toLocaleString()}</span></> : ''}</span>
            </div>
          )}
          {active !== "overview" && !isServices && !isOrders && !isReferrals && !isSettings && !isSupport && !isAddFunds && !isGuide && !isLeaderboard && !isAudit && !isCleanup && !isEarn && !isLab && !isTasks && active !== "catalogue" && <div className="pb-6 max-md:pb-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xl max-md:text-lg font-semibold mb-0.5 text-t-text">Welcome back, {firstName}</div>
                <div className="text-sm text-t-text-muted">{orderSummary.total === 0 ? "Place your first order in under a minute." : "Here's your dashboard at a glance."}</div>
              </div>
              <div className="shrink-0 ml-4 py-1.5 px-3 max-md:py-1 max-md:px-2.5 rounded-xl text-right" style={{ background: t.cardBg, border: `1px solid ${dark ? "rgba(255,255,255,.12)" : "rgba(0,0,0,.08)"}` }}>
                <div className="text-[11px] uppercase tracking-[1px] mb-0.5 text-t-text-muted">Balance</div>
                <div className="m text-lg max-md:text-base font-semibold text-t-green">{fN(user?.balance || 0)}</div>
                {user?.bonusCredit && <div className="text-[11px] mt-0.5 text-accent">₦{(user.bonusCredit.amount / 100).toLocaleString()} bonus — expires in {Math.max(1, Math.ceil((new Date(user.bonusCredit.expiresAt) - Date.now()) / 86400000))}d</div>}
              </div>
            </div>
            <div className="page-divider bg-t-card-border" />
          </div>}
          {isAudit && <div className="pb-3.5 max-md:pb-2">
            <div className="text-xl max-md:text-lg font-semibold mb-0.5 text-t-text">Audit</div>
            <div className="text-sm text-t-text-muted">Deep analytics and insights for your social accounts</div>
            <div className="page-divider bg-t-card-border" />
          </div>}
          {isCleanup && <div className="pb-3.5 max-md:pb-2">
            <div className="text-xl max-md:text-lg font-semibold mb-0.5 text-t-text">Cleanup</div>
            <div className="text-sm text-t-text-muted">Remove ghost followers, non-followers, and inactive accounts</div>
            <div className="page-divider bg-t-card-border" />
          </div>}
          {isLab && <div className="pb-2 desktop:pb-3.5">
            <div className="text-lg desktop:text-[22px] font-semibold mb-0.5 text-t-text">Reseller HQ</div>
            <div className="text-sm desktop:text-[15px] text-t-text-muted">Your key, your prices, and the API for your panel</div>
            <div className="page-divider bg-t-card-border" />
          </div>}
          {isTasks && <div className="pb-2 desktop:pb-3.5">
            <div className="text-lg desktop:text-[22px] font-semibold mb-0.5 text-t-text">Tasks</div>
            <div className="text-sm desktop:text-[15px] text-t-text-muted">Do tasks, earn free credit</div>
            <div className="page-divider bg-t-card-border" />
          </div>}

          <div key={active} className="dash-page-enter" style={isSupport ? { flex: 1, display: "flex", flexDirection: "column", minHeight: 0, overflow: "hidden" } : undefined}>
            {renderPage()}
          </div>

        </main>

        {/* ── RIGHT SIDEBAR ── */}
        <aside className="dash-right bg-t-sidebar-bg border-l-[0.5px] border-t-sidebar-border">
          {isServices ? (
            <ServicesSidebar dark={dark} t={t} />
          ) : isOrders ? (
            <OrdersSidebar orders={orders} orderSummary={orderSummary} dark={dark} t={t} />
          ) : isReferrals ? (
            <ReferralsSidebar user={user} dark={dark} t={t} />
          ) : isSettings ? (
            <SettingsSidebar user={user} dark={dark} t={t} />
          ) : isSupport ? (
            <SupportSidebar dark={dark} t={t} tickets={[]} socialLinks={socialLinks} />
          ) : isAddFunds ? (
            <AddFundsSidebar user={user} txs={enrichedTxs} dark={dark} t={t} />
          ) : isGuide ? (
            <GuideSidebar dark={dark} t={t} />
          ) : isLeaderboard ? (
            <LeaderboardCard dark={dark} t={t} />
          ) : isAudit ? (
            <div className="flex flex-col gap-0">
              <div className="text-[11px] font-semibold uppercase tracking-[1.5px] mb-2 py-1.5 px-2.5 rounded-lg text-t-text-muted" style={{ background: dark ? "rgba(196,125,142,.1)" : "rgba(196,125,142,.06)" }}>What you'll get</div>
              {[["Follower quality score", "See how many real vs ghost followers you have"],["Engagement rate", "Your true engagement compared to your follower count"],["Best posting times", "When your audience is most active"],["Growth trends", "Track follower gains and losses over time"]].map(([title, desc]) => (
                <div key={title} className="py-2.5 px-3 rounded-lg mb-1.5" style={{ background: dark ? "rgba(255,255,255,.07)" : "rgba(0,0,0,.02)" }}>
                  <div className="text-sm font-medium mb-0.5 text-t-text">{title}</div>
                  <div className="text-xs text-t-text-muted">{desc}</div>
                </div>
              ))}
            </div>
          ) : active === "catalogue" ? (
            <ResellerCatalogueSidebar dark={dark} t={t} />
          ) : isLab ? (
            <ResellerLabSidebar dark={dark} t={t} onNavigate={setActive} />
          ) : isCleanup ? (
            <div className="flex flex-col gap-0">
              <div className="text-[11px] font-semibold uppercase tracking-[1.5px] mb-2 py-1.5 px-2.5 rounded-lg text-t-text-muted" style={{ background: dark ? "rgba(196,125,142,.1)" : "rgba(196,125,142,.06)" }}>Cleanup tools</div>
              {[["Ghost followers", "Remove inactive accounts that never engage"],["Non-followers", "Unfollow people who don't follow you back"],["Mass unfollow", "Bulk unfollow with filters and safety limits"],["Inactive accounts", "Detect and remove accounts that haven't posted in months"]].map(([title, desc]) => (
                <div key={title} className="py-2.5 px-3 rounded-lg mb-1.5" style={{ background: dark ? "rgba(255,255,255,.07)" : "rgba(0,0,0,.02)" }}>
                  <div className="text-sm font-medium mb-0.5 text-t-text">{title}</div>
                  <div className="text-xs text-t-text-muted">{desc}</div>
                </div>
              ))}
            </div>
          ) : (
            <RightSidebar activeOrders={activeOrders} orderSummary={orderSummary} user={user} dark={dark} t={t} setActive={setActive} />
          )}
        </aside>
      </div>

      {/* ═══ TOUR GUIDE ═══ */}
      {showOrderTour && <OrderTour dark={dark} onComplete={() => setShowOrderTour(false)} setSelSvc={setNoSelSvc} setSelTier={setNoSelTier} setQty={setNoQty} user={user} onTopUp={() => setActive("add-funds")} />}

      {/* ═══ MOBILE BOTTOM NAV ═══ */}
      {moreOpen && <div className="dash-more-overlay" onClick={() => setMoreOpen(false)} />}
      {moreOpen && (
        <div className="dash-more-sheet" role="dialog" aria-modal="true" aria-label="More" style={{ background: dark ? "#161b2e" : "#fff", borderTop: `1px solid ${dark ? "rgba(255,255,255,.1)" : "rgba(0,0,0,.08)"}` }}>
          <div className="dash-more-grab" style={{ background: dark ? "rgba(255,255,255,.22)" : "rgba(0,0,0,.18)" }} />
          <div className="dash-more-head" style={{ borderBottom: `1px solid ${dark ? "rgba(255,255,255,.08)" : "rgba(0,0,0,.06)"}` }}>
            <Avatar size={34} rounded={10} />
            <div className="min-w-0 flex-1">
              <div className="text-[13px] font-semibold truncate text-t-text">{user?.name || "Your account"}</div>
              <div className="text-[11px] truncate text-t-text-muted">{user?.email || ""}</div>
            </div>
            <ThemeToggle dark={dark} onToggle={toggleTheme} />
          </div>
          {(() => {
            const byId = Object.fromEntries(MORE_ITEMS.map(m => [m.id, m]));
            const browse = isReseller ? { id: "catalogue", label: "Catalogue" } : { id: "resellers", label: "Resellers", href: "/resellers" };
            const hq = { id: "lab", label: isReseller ? "Reseller HQ" : "API access" };
            const sec = (id, label) => ({ id, section: label, header: true });
            return [
              sec("sec-money", "Money"), byId.referrals, byId.tasks,
              sec("sec-browse", "Browse"), browse, hq, byId.guide, byId.changelog,
              sec("sec-account", "Account"), byId.support, byId.settings,
              byId.logout,
            ].filter(Boolean);
          })().map(item => {
            if (item.header) return <div key={item.id} className="dash-more-eyebrow text-t-text-muted">{item.section}</div>;
            if (item.id === "logout") {
              return (
                <button key={item.id} onClick={() => { setMoreOpen(false); handleLogout(); }} className="dash-more-item" style={{ background: dark ? "rgba(220,38,38,.06)" : "rgba(220,38,38,.03)", color: dark ? "#fca5a5" : "#dc2626", fontWeight: 500 }}>
                  <div className="dash-more-item-icon" style={{ background: dark ? "rgba(220,38,38,.1)" : "rgba(220,38,38,.06)", color: dark ? "#fca5a5" : "#dc2626" }}>{I[item.id]}</div>
                  {item.label}
                </button>
              );
            }
            return (
              <button key={item.id} onClick={() => { if (item.soon) return; if (item.href) { window.location.href = item.href; return; } if (item.id === "support" && socialLinks.social_whatsapp_support) { window.open(`https://wa.me/${socialLinks.social_whatsapp_support.replace(/\D/g, "")}?text=${encodeURIComponent("Hi Nitro, I need help")}`, "_blank"); setMoreOpen(false); return; } setActive(item.id); setMoreOpen(false); }} className="dash-more-item" style={{ background: item.id === "support" ? (dark ? "rgba(37,211,102,.15)" : "rgba(37,211,102,.1)") : item.id === "tasks" ? (dark ? "rgba(96,165,250,.14)" : "rgba(37,99,235,.08)") : (active === item.id ? (dark ? "rgba(196,125,142,.08)" : "rgba(196,125,142,.04)") : (dark ? "rgba(255,255,255,.05)" : "rgba(0,0,0,.02)")), color: item.soon ? (dark ? "rgba(255,255,255,.35)" : "rgba(0,0,0,.35)") : (item.id === "support" ? "#25d366" : item.id === "tasks" ? (dark ? "#fbbf24" : "#d97706") : (active === item.id ? t.accent : (dark ? "rgba(255,255,255,.6)" : "rgba(0,0,0,.6)"))), fontWeight: active === item.id || item.id === "tasks" ? 600 : 500, cursor: item.soon ? "default" : "pointer", borderColor: item.soon ? "transparent" : undefined }}>
                <div className="dash-more-item-icon" style={{ background: item.soon ? (dark ? "rgba(255,255,255,.05)" : "rgba(0,0,0,.02)") : (item.id === "support" ? (dark ? "rgba(37,211,102,.12)" : "rgba(37,211,102,.08)") : item.id === "tasks" ? (dark ? "rgba(96,165,250,.14)" : "rgba(37,99,235,.08)") : (active === item.id ? (dark ? "rgba(196,125,142,.12)" : "rgba(196,125,142,.08)") : (dark ? "rgba(255,255,255,.08)" : "rgba(0,0,0,.04)"))), color: item.soon ? (dark ? "rgba(255,255,255,.3)" : "rgba(0,0,0,.3)") : (item.id === "support" ? "#25d366" : item.id === "tasks" ? (dark ? "#fbbf24" : "#d97706") : (active === item.id ? t.accent : (dark ? "rgba(255,255,255,.55)" : "rgba(0,0,0,.5)"))) }}>{I[item.id]}</div>
                {item.label}
                {item.soon && <span className="text-[11px] font-bold uppercase tracking-[0.5px] py-[1px] px-1.5 rounded-[4px] ml-auto text-accent" style={{ background: dark ? "rgba(196,125,142,.15)" : "rgba(196,125,142,.1)" }}>Soon</span>}
              </button>
            );
          })}
          <div className="w-full flex items-center justify-center gap-3 mt-1.5 pt-2" style={{ borderTop: `1px solid ${dark ? "rgba(255,255,255,.16)" : "rgba(0,0,0,.12)"}` }}>
            <a href={`https://instagram.com/${(socialLinks.social_instagram || "Nitro.ng").replace(/^(https?:\/\/)?(www\.)?(instagram\.com)\/?/i,"").replace(/^@/,"").replace(/\/$/,"")}`} target="_blank" rel="noopener noreferrer" aria-label="Instagram" className="w-9 h-9 rounded-[10px] flex items-center justify-center" style={{ background: dark ? "rgba(255,255,255,.08)" : "rgba(0,0,0,.04)", color: "#E1306C" }}>{I.instagram}</a>
            <div className="w-px h-5 shrink-0" style={{ background: dark ? "rgba(255,255,255,.14)" : "rgba(0,0,0,.08)" }} />
            <a href={`https://x.com/${(socialLinks.social_twitter || "TheNitroNG").replace(/^(https?:\/\/)?(www\.)?(x\.com|twitter\.com)\/?/i,"").replace(/^@/,"").replace(/\/$/,"")}`} target="_blank" rel="noopener noreferrer" aria-label="X" className="w-9 h-9 rounded-[10px] flex items-center justify-center" style={{ background: dark ? "rgba(255,255,255,.08)" : "rgba(0,0,0,.04)", color: dark ? "rgba(255,255,255,.6)" : "rgba(0,0,0,.4)" }}>{I.x}</a>
            {socialLinks.social_tiktok && <><div className="w-px h-5 shrink-0" style={{ background: dark ? "rgba(255,255,255,.14)" : "rgba(0,0,0,.08)" }} /><a href={`https://tiktok.com/@${socialLinks.social_tiktok.replace(/^(https?:\/\/)?(www\.)?(tiktok\.com\/@?)?/i,"").replace(/^@/,"").replace(/\/$/,"")}`} target="_blank" rel="noopener noreferrer" aria-label="TikTok" className="w-9 h-9 rounded-[10px] flex items-center justify-center" style={{ background: dark ? "rgba(255,255,255,.08)" : "rgba(0,0,0,.04)", color: dark ? "rgba(255,255,255,.6)" : "rgba(0,0,0,.4)" }}><svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.27 6.27 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V9.41a8.16 8.16 0 004.77 1.52V7.48a4.85 4.85 0 01-1-.79z"/></svg></a></>}
            
          </div>
        </div>
      )}
      {/* Bottom dock: a floating capsule with the five tabs, and the WhatsApp
          concierge at the end that expands into a one-line message. */}
      <nav ref={bottomNavRef} aria-label="Primary" className={`dash-bottom-nav dash-dock ${dark ? "dark" : "light"}`} style={{ background: dark ? "#161b2e" : "#fff", border: `1px solid ${dark ? "rgba(255,255,255,.1)" : "rgba(0,0,0,.08)"}` }}>
        {BOTTOM_TABS.map(tab => {
          const isMore = tab.id === "more";
          return (
            <button key={tab.id} data-tab={tab.id} onClick={() => {
              if (isMore) { setMoreOpen(!moreOpen); }
              else {
                // Instant DOM update — no waiting for React
                if (bottomNavRef.current) {
                  bottomNavRef.current.querySelectorAll(".dash-bottom-tab").forEach(el => el.classList.remove("active"));
                  bottomNavRef.current.querySelector(`[data-tab="${tab.id}"]`)?.classList.add("active");
                }
                setActive(tab.id); setMoreOpen(false); setLeftOpen(false);
              }
            }} className={`dash-bottom-tab${(!moreOpen && active === tab.id) || (isMore && moreOpen) ? " active" : ""}${tab.primary ? " primary" : ""}`}>
              <span className="dash-bottom-icon">{isMore ? MoreIcon : tab.primary ? OrderIcon : I[tab.id]}</span>
              <span className="dash-bottom-label">{tab.label}</span>
            </button>
          );
        })}
      </nav>

      {/* ── The concierge: a float above the dock (bottom-right on a desktop) that opens the "we can order for you" panel.
          A sheet over the dock on a phone, a docked window on a desktop. Send hands off to WhatsApp with the message ready. ── */}
      {socialLinks.social_whatsapp_support && !chatOpen && !moreOpen && !leftOpen && (
        <button type="button" className="dash-chat-fab" onClick={() => setChatOpen(true)} aria-label="We can order for you. Message us on WhatsApp"><svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2A10 10 0 002 12c0 1.8.5 3.5 1.3 5L2 22l5.2-1.3A10 10 0 1012 2zm0 18.2c-1.6 0-3.1-.4-4.4-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1112 20.2zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 01-3.3-2.9c-.3-.4.2-.4.7-1.3.1-.2 0-.3 0-.5l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5c-.2 0-.5.1-.7.3-.2.3-.9.9-.9 2.2s.9 2.5 1.1 2.7c.1.2 1.9 2.9 4.6 4 1.7.7 2.3.8 3.2.7.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.2-1.2-.1-.1-.3-.2-.5-.3z"/></svg></button>
      )}
      {chatOpen && (
        <>
          <div className="dash-chat-back" onClick={() => setChatOpen(false)} />
          <div className="dash-chat" role="dialog" aria-modal="true" aria-label="We can order for you" style={{ background: dark ? "#141930" : "#fff", borderColor: dark ? "rgba(255,255,255,.12)" : "rgba(0,0,0,.1)", color: t.text }}>
            <div className="dash-chat-grab" style={{ background: dark ? "rgba(255,255,255,.14)" : "rgba(0,0,0,.12)" }} />
            <div className="dash-chat-hd">
              <span className="dash-chat-av"><svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2A10 10 0 002 12c0 1.8.5 3.5 1.3 5L2 22l5.2-1.3A10 10 0 1012 2zm0 18.2c-1.6 0-3.1-.4-4.4-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1112 20.2zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 01-3.3-2.9c-.3-.4.2-.4.7-1.3.1-.2 0-.3 0-.5l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5c-.2 0-.5.1-.7.3-.2.3-.9.9-.9 2.2s.9 2.5 1.1 2.7c.1.2 1.9 2.9 4.6 4 1.7.7 2.3.8 3.2.7.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.2-1.2-.1-.1-.3-.2-.5-.3z"/></svg></span>
              <span className="dash-chat-t"><b>We can order for you</b><i style={{ color: t.textMuted }}>Nitro Support on WhatsApp · replies in minutes</i></span>
              <button type="button" onClick={() => setChatOpen(false)} className="dash-chat-x" aria-label="Close" style={{ color: t.textMuted }}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg></button>
            </div>
            <div className="dash-chat-bub" style={{ background: dark ? "rgba(255,255,255,.07)" : "rgba(0,0,0,.05)" }}>Not sure what to pick, or in a hurry? Paste your link and say what you want. We place the order on your account.</div>
            {active === "services" && noSelSvc && (
              <div className="dash-chat-ctx" style={{ borderColor: dark ? "rgba(255,255,255,.12)" : "rgba(0,0,0,.1)" }}>
                <span className="dash-chat-ci" style={{ background: dark ? "rgba(255,255,255,.07)" : "rgba(0,0,0,.05)", color: t.textMuted }}>{I.services}</span>
                <span className="dash-chat-ct"><b>{noSelSvc.name}{noSelTier?.tier ? ` · ${noSelTier.tier}` : ""}</b><i style={{ color: t.textMuted }}>the service you are looking at</i></span>
                <button type="button" className="dash-chat-cb" onClick={() => chatQuick(`Hi! I want to order ${noSelSvc.name}${noSelTier?.tier ? ` (${noSelTier.tier})` : ""} on Nitro. Can you help me place it?`)}>Order this for me</button>
              </div>
            )}
            <div className="dash-chat-quick">
              {[["Where is my order?", "Hi Nitro, where is my order?"], ["Add funds", "Hi Nitro, I want to add funds to my wallet. Can you help?"], ["Something went wrong", "Hi Nitro, something went wrong with my order. Can you help?"]].map(([label, text]) => (
                <button key={label} type="button" onClick={() => chatQuick(text)} style={{ borderColor: dark ? "rgba(255,255,255,.14)" : "rgba(0,0,0,.12)", color: t.text }}>{label}</button>
              ))}
            </div>
            <div className="dash-chat-field" style={{ borderColor: dark ? "rgba(255,255,255,.14)" : "rgba(0,0,0,.12)" }}>
              <input ref={dockInputRef} value={dockMsg} onChange={e => setDockMsg(e.target.value)} onKeyDown={e => { if (e.key === "Enter") sendDockMessage(); }}
                aria-label="Your link, or what you want ordered" placeholder="Paste your link, we place the order" autoComplete="off" spellCheck={false} style={{ color: t.text }} />
              <button type="button" onClick={sendDockMessage} className="dash-chat-send" aria-label="Send on WhatsApp">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m22 2-7 20-4-9-9-4z"/><path d="M22 2 11 13"/></svg>
              </button>
            </div>
            <div className="dash-chat-foot" style={{ color: t.textMuted }}>Opens WhatsApp with the message ready, with your account attached.</div>
          </div>
        </>
      )}

      {/* Phone number prompt for existing users */}
      {(phonePromptDone || shouldShowPhonePrompt({ phoneKnown, phone: phoneForPrompt, user, currentTosVersion })) && (
        <div className="fixed inset-0 z-[99998] bg-black/60 flex items-center justify-center p-5">
          <div className="rounded-2xl py-8 px-7 max-w-[420px] w-full shadow-[0_20px_60px_rgba(0,0,0,.3)]" style={{ background: dark ? "#1a1a1a" : "#fff" }}>
            <div className="text-center mb-5">
              <div className="w-12 h-12 rounded-[14px] bg-[rgba(37,211,102,.15)] inline-flex items-center justify-center relative">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="#25d366"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                {phonePromptDone && <div className="absolute -bottom-[3px] -right-[3px] w-5 h-5 rounded-full bg-[#25d366] flex items-center justify-center" style={{ border: `2px solid ${dark ? "#1a1a1a" : "#fff"}` }}><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg></div>}
              </div>
            </div>
            {phonePromptDone ? <>
              <h2 className="text-lg font-semibold text-t-text text-center m-0 mb-2">Number saved</h2>
              <p className="text-[13px] text-t-text-muted text-center m-0 leading-[1.6]">
                We'll reach you on WhatsApp for order updates and support.
              </p>
            </> : <>
            <h2 className="text-lg font-semibold text-t-text text-center m-0 mb-2">Add your WhatsApp number</h2>
            <p className="text-[13px] text-t-text-muted text-center m-0 mb-5 leading-[1.6]">
              We need your WhatsApp number to send you order updates and support.
            </p>
            {phonePromptError && <div className="py-2 px-3 rounded-lg text-[13px] mb-3" style={{ background: dark ? "rgba(220,38,38,0.1)" : "#fef2f2", border: `1px solid ${dark ? "rgba(220,38,38,.28)" : "#fecaca"}`, color: dark ? "#fca5a5" : "#dc2626" }}>{phonePromptError}</div>}
            <div className="flex gap-2 mb-5">
              <div className="py-3 px-3.5 rounded-xl text-[15px] shrink-0 flex items-center gap-1.5 text-t-text-muted" style={{ background: dark ? "rgba(255,255,255,.07)" : "rgba(0,0,0,.03)", border: `1px solid ${dark ? "rgba(255,255,255,.12)" : "rgba(0,0,0,.1)"}` }}>
                <span className="text-base">🇳🇬</span> +234
              </div>
              <input
                value={phonePromptVal}
                onChange={e => setPhonePromptVal(e.target.value.replace(/\D/g, "").slice(0, 11))}
                placeholder="8012345678"
                type="tel"
                autoComplete="tel"
                className="flex-1 py-3 px-3.5 rounded-xl text-[15px] outline-none font-[inherit] text-t-text"
                style={{ background: dark ? "rgba(255,255,255,.07)" : "#fff", border: `1px solid ${dark ? "rgba(255,255,255,.12)" : "rgba(0,0,0,.1)"}` }}
              />
            </div>
            <button
              disabled={phonePromptSaving || !/^[789]\d{9}$/.test(phonePromptVal.replace(/^0+/, ""))}
              onClick={async () => {
                setPhonePromptError("");
                const cleaned = phonePromptVal.replace(/^0+/, "");
                if (!/^[789]\d{9}$/.test(cleaned)) { setPhonePromptError("Enter a valid Nigerian number (e.g. 8012345678)"); return; }
                setPhonePromptSaving(true);
                try {
                  const res = await fetch("/api/auth/notifications", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ phone: `+234${cleaned}` }) });
                  if (res.ok) {
                    const savedPhone = `+234${cleaned}`;
                    const savedUserId = user?.id;
                    identityRequestGenerationRef.current += 1;
                    setPhonePromptDone(true);
                    setUser(prev => prev?.id === savedUserId ? { ...prev, phone: savedPhone } : prev);
                    setPhoneConfirmation(prev => prev.userId === savedUserId
                      ? { userId: savedUserId, phone: savedPhone }
                      : prev);
                    setTimeout(() => {
                      setPhonePromptDone(false);
                    }, 3000);
                  }
                  else { const d = await res.json(); setPhonePromptError(d.error || "Failed to save"); }
                } catch { setPhonePromptError("Network error. Try again."); }
                setPhonePromptSaving(false);
              }}
              className="w-full py-3 rounded-[10px] border-none text-sm font-semibold font-[inherit] transition-all duration-200"
              style={{
                cursor: /^[789]\d{9}$/.test(phonePromptVal.replace(/^0+/, "")) && !phonePromptSaving ? "pointer" : "default",
                background: /^[789]\d{9}$/.test(phonePromptVal.replace(/^0+/, "")) ? "#25d366" : (dark ? "rgba(255,255,255,.12)" : "rgba(0,0,0,.08)"),
                color: /^[789]\d{9}$/.test(phonePromptVal.replace(/^0+/, "")) ? "#fff" : t.textMuted,
                opacity: phonePromptSaving ? 0.7 : 1,
              }}
            >{phonePromptSaving ? "Saving…" : "Save"}</button>
            </>}
          </div>
        </div>
      )}

      {/* ToS re-acceptance modal */}
      {currentTosVersion && user && user.tosVersion !== currentTosVersion && (
        <div className="fixed inset-0 z-[99999] bg-black/60 flex items-center justify-center p-5">
          <div className="rounded-2xl py-8 px-7 max-w-[420px] w-full shadow-[0_20px_60px_rgba(0,0,0,.3)] bg-t-card-bg">
            <div className="text-center mb-5">
              <div className="w-12 h-12 rounded-[14px] inline-flex items-center justify-center" style={{ background: `linear-gradient(135deg, ${t.accent}, ${dark ? "#6b3a4a" : "#8b5e6b"})` }}><svg width="22" height="24" viewBox="0 0 1601 1785" fill="#fff"><path d="M1600.82 160.089V1313c-.85 53.13-10.35 104.17-27.19 151.74-48.19 136.54-156.38 244.73-292.92 292.92-50.12 17.76-103.94 27.34-160.08 27.34 0 0-79.39 0-160.01-27.34-85.1-28.88-155.38-85.49-208.28-141.55-72.59-76.84-112.13-179.09-112.13-284.74V1023.4v-3.08-12.9c.08-1.39.08-2.7.08-4.17 0-1.39 0-2.7-.08-4.09-2.08-84.64-69.97-153.06-154.53-155.84-1.85-.08-3.71-.15-5.48-.15-1.78 0-3.71.08-5.48.15-84.56 2.78-152.44 71.2-154.61 155.84-.08 1.39-.08 2.7-.08 4.09 0 1.47 0 2.78.08 4.17v534.87c0 88.42-71.67 160.09-160.09 160.09-44.17 0-84.25-17.92-113.21-46.88C17.92 1626.84 0 1586.76 0 1542.59V995.288c.927-53.132 10.426-104.178 27.261-151.672C75.45 707.003 183.643 598.81 320.179 550.621c50.119-17.685 103.946-27.338 160.089-27.338 0 0 79.388 0 160.012 27.338 85.103 28.882 155.379 85.489 208.278 141.555 72.593 76.84 112.132 179.087 112.132 284.732v307.972l-.077.92v12.89c-.077 1.39-.077 2.78-.077 4.17 0 1.39 0 2.7.077 4.17 2.085 84.64 69.967 152.99 154.527 155.84 1.86 0 3.71 0 5.49 0 1.77 0 3.7 0 5.48 0 84.56-2.85 152.44-71.2 154.6-155.84V160.089C1280.71 71.666 1352.38 0 1440.8 0c44.18 0 84.18 17.916 113.14 46.876 28.96 28.96 46.88 69.04 46.88 113.213z"/></svg></div>
            </div>
            <h2 className="text-lg font-semibold text-t-text text-center m-0 mb-2">We've updated our Terms</h2>
            <p className="text-[13px] text-t-text-muted text-center m-0 mb-5 leading-[1.6]">
              Our Terms of Service and Privacy Policy have been updated. Please review and accept to continue using Nitro.
            </p>
            <div className="flex gap-3 justify-center mb-5">
              <a href="/terms" target="_blank" rel="noopener" className="text-[13px] text-accent no-underline font-medium">Terms of Service ↗</a>
              <a href="/privacy" target="_blank" rel="noopener" className="text-[13px] text-accent no-underline font-medium">Privacy Policy ↗</a>
            </div>
            <label className="flex items-start gap-2.5 cursor-pointer mb-5 py-3 px-3.5 rounded-[10px]" style={{ background: dark ? "rgba(255,255,255,.07)" : "rgba(0,0,0,.03)" }}>
              <input type="checkbox" checked={tosChecked} onChange={e => setTosChecked(e.target.checked)} aria-label="Agree to updated terms" className="mt-0.5" style={{ accentColor: t.accent }} />
              <span className="text-[13px] text-t-text leading-normal">I have read and agree to the updated Terms of Service and Privacy Policy</span>
            </label>
            <button
              disabled={!tosChecked || tosAccepting}
              onClick={async () => {
                setTosAccepting(true);
                try {
                  const res = await fetch("/api/auth/tos-accept", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ version: currentTosVersion }) });
                  if (res.ok) setUser(prev => ({ ...prev, tosVersion: currentTosVersion }));
                } catch {}
                setTosAccepting(false);
              }}
              className="w-full py-3 rounded-[10px] border-none text-sm font-semibold font-[inherit] transition-all duration-200"
              style={{
                cursor: tosChecked && !tosAccepting ? "pointer" : "default",
                background: tosChecked ? t.accent : dark ? "rgba(255,255,255,.12)" : "rgba(0,0,0,.08)",
                color: tosChecked ? "#fff" : t.textMuted,
                opacity: tosAccepting ? 0.7 : 1,
              }}
            >{tosAccepting ? "Accepting…" : "Accept & Continue"}</button>
          </div>
        </div>
      )}
    </div>
    </ConfirmProvider>
    </ToastProvider>
  );
}
