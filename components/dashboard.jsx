'use client';
import { useState, useEffect, useMemo, useRef, useTransition, Fragment } from "react";
import dynamic from "next/dynamic";
import { ThemeProvider, useTheme } from "./shared-nav";
import NewOrderPage, { PLATFORMS, PLATFORM_GROUPS, OrderForm, ServicesSidebar } from "./new-order";
import { ToastProvider } from "./toast";
import { ConfirmProvider } from "./confirm-dialog";
import AnnouncementBanner from "./announcement-banner";
import { PlatformIcon } from "./platform-icon";
import { SegPill } from "./seg-pill";
import { fN, fD } from "../lib/format";
import { Avatar } from "./avatar";
import OrderTour from "./order-tour";

/* Dynamic imports — only load when user navigates to that page */
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
const TierPerksCard = dynamic(() => import("./leaderboard-page").then(m => m.TierPerksCard), { ssr: false });
const EarnPage = dynamic(() => import("./earn-page").then(m => m.default), { ssr: false });

/* ═══════════════════════════════════════════ */
/* ═══ SVG ICONS                          ═══ */
/* ═══════════════════════════════════════════ */
const I = {
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
  { id: "referrals", label: "Referrals" },
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
  { id: "guide", label: "Blog" },
  { id: "support", label: "Support" },
  { id: "settings", label: "Settings" },
  { id: "logout", label: "Log Out" },
];
const MoreIcon = <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/><circle cx="5" cy="12" r="1.5"/></svg>;
const OrderIcon = <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>;


/* ── Status helpers ── */
function sClr(s, dk) { return s === "Completed" ? (dk ? "#6ee7b7" : "#059669") : s === "Processing" ? (dk ? "#a5b4fc" : "#4f46e5") : s === "Pending" ? (dk ? "#fcd34d" : "#d97706") : s === "Partial" ? (dk ? "#fdba74" : "#ea580c") : (s === "Failed" || s === "Rejected") ? (dk ? "#fca5a5" : "#dc2626") : s === "Cancelled" ? (dk ? "#a1a1aa" : "#71717a") : (dk ? "#555250" : "#8a8785"); }
function sBg(s, dk) { return s === "Completed" ? (dk ? "#0a2416" : "#ecfdf5") : s === "Processing" ? (dk ? "#0f1629" : "#eef2ff") : s === "Pending" ? (dk ? "#1c1608" : "#fffbeb") : s === "Partial" ? (dk ? "#1c1008" : "#fff7ed") : (s === "Failed" || s === "Rejected") ? (dk ? "#1f0a0a" : "#fef2f2") : s === "Cancelled" ? (dk ? "#1a1a1a" : "#f5f5f5") : (dk ? "#141414" : "#f5f5f5"); }
function sBrd(s, dk) { return s === "Completed" ? (dk ? "#166534" : "#a7f3d0") : s === "Processing" ? (dk ? "#3730a3" : "#c7d2fe") : s === "Pending" ? (dk ? "#92400e" : "#fde68a") : s === "Partial" ? (dk ? "#9a3412" : "#fed7aa") : (s === "Failed" || s === "Rejected") ? (dk ? "#991b1b" : "#fecaca") : s === "Cancelled" ? (dk ? "#404040" : "#d4d4d4") : (dk ? "#404040" : "#d4d4d4"); }

function Badge({ status, dark }) {
  return <span className="text-[13px] font-semibold py-0.5 px-2 rounded-[5px] whitespace-nowrap inline-block" style={{ background: sBg(status, dark), color: sClr(status, dark), borderWidth: .5, borderStyle: "solid", borderColor: sBrd(status, dark) }}>{status}</span>;
}

/* ═══════════════════════════════════════════ */
/* ═══ MOBILE MENU HINT                    ═══ */
/* ═══════════════════════════════════════════ */
function MobileMenuHint({ dark, t }) {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;
  return (
    <div className="hidden max-desktop:flex rounded-xl mb-3 items-center gap-2.5" style={{ background: dark ? "rgba(196,125,142,.12)" : "rgba(196,125,142,.06)", border: `1px solid ${dark ? "rgba(196,125,142,.19)" : "rgba(196,125,142,.14)"}`, padding: "10px 14px" }}>
      <span className="text-base shrink-0"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18.97 3.66c-.59-.59-1.54-.59-2.12 0L12 8.51 9.15 5.66c-.59-.59-1.54-.59-2.12 0-.59.59-.59 1.54 0 2.12L9.15 9.9 7.03 12.03c-.59.59-.59 1.54 0 2.12l2.83 2.83c2.34 2.34 6.14 2.34 8.49 0l2.12-2.12c.59-.59.59-1.54 0-2.12"/><path d="M2 12l4.5 4.5"/><path d="M6.5 8L2 12"/></svg></span>
      <div className="flex-1 text-[13px] leading-[1.5]" style={{ color: t.textMuted }}>
        Tap the <b style={{ color: t.text }}>menu icon</b> (top left) to access Services, Orders, Funds, and more.
      </div>
      <button onClick={() => setDismissed(true)} className="bg-none border-none text-base cursor-pointer px-0.5 py-0 shrink-0" style={{ color: t.textMuted }}><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
    </div>
  );
}

/* ═══════════════════════════════════════════ */
/* ═══ OVERVIEW PAGE                      ═══ */
/* ═══════════════════════════════════════════ */
function OverviewPage({ user, orders, alerts, dark, t, setActive, a2hs }) {
  const [tutorialOpen, setTutorialOpen] = useState(false);
  const [tipsOpen, setTipsOpen] = useState(false);
  const balance = user?.balance || 0;
  const activeOrders = orders.filter(o => o.status === "Processing" || o.status === "Pending" || o.status === "Partial");
  const completed = orders.filter(o => o.status === "Completed").length;
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const weekOrders = orders.filter(o => o.created && new Date(o.created) > weekAgo).length;
  const isNew = orders.length === 0;
  const lowBal = balance < 500;
  const firstName = user?.name?.split(" ")[0] || "there";
  const isAttn = (o) => o.status === "Partial" || (o.status === "Pending" && o.lastError && !o.apiOrderId);
  const attentionOrders = activeOrders.filter(isAttn);
  const sortedActive = [...attentionOrders, ...activeOrders.filter(o => !isAttn(o))];

  const primaryAction = isNew
    ? { label: "Place your first order", sub: "Pick a platform and start growing today", target: "services" }
    : lowBal
    ? { label: "Add funds", sub: "Top up your balance to keep the momentum going", target: "add-funds" }
    : activeOrders.length > 0
    ? { label: "Track your orders", sub: `${activeOrders.length} order${activeOrders.length > 1 ? "s" : ""} in progress right now`, target: "orders" }
    : { label: "Start a new order", sub: "Ready when you are — let's keep growing", target: "services" };

  return (
    <>
      {/* ── Stat cards ── */}
      <div className="dash-stats">
        {[
          ["Active", String(activeOrders.length), dark ? "#e0a458" : "#d97706"],
          ["Delivered", String(completed), dark ? "#6ee7b7" : "#059669"],
          ["This Week", String(weekOrders), dark ? "#a5b4fc" : "#4f46e5"],
        ].map(([label, val, color]) => (
          <div key={label} className="dash-stat-card" style={{ background: dark ? "rgba(255,255,255,.12)" : "rgba(255,255,255,.85)", border: `1px solid ${dark ? "rgba(255,255,255,.12)" : "rgba(0,0,0,.08)"}` }}>
            <div className="dash-stat-dot" style={{ background: color }} />
            <div className="dash-stat-label" style={{ color: t.textMuted }}>{label}</div>
            <div className="m dash-stat-value" style={{ color }}>{val}</div>
          </div>
        ))}
      </div>

      {/* Add to Home Screen — mobile/tablet only */}
      {!a2hs.dismissed && (a2hs.ready || a2hs.isIos) && (
        <div className="hidden max-desktop:flex items-center gap-3 rounded-[14px] max-md:rounded-xl py-3.5 px-5 max-md:py-3 max-md:px-4 mb-5 max-md:mb-4" style={{ background: dark ? "rgba(196,125,142,.12)" : "rgba(196,125,142,.08)", border: `1px solid ${dark ? "rgba(196,125,142,.24)" : "rgba(196,125,142,.18)"}` }}>
          <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: "linear-gradient(135deg, #c47d8e, #8b5e6b)" }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14"/></svg>
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold" style={{ color: t.text }}>Add Nitro to Home Screen</div>
            {a2hs.isIos ? (
              <div className="text-[13px] mt-0.5" style={{ color: t.textMuted }}>
                Tap <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="inline -mt-px mx-0.5"><path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg> then <strong>"Add to Home Screen"</strong>
              </div>
            ) : (
              <div className="text-[13px] mt-0.5" style={{ color: t.textMuted }}>Get quick access like a native app</div>
            )}
          </div>
          {a2hs.ready && !a2hs.isIos && (
            <button onClick={a2hs.onInstall} className="shrink-0 py-2 px-4 rounded-lg text-[13px] font-semibold border-none cursor-pointer transition-transform duration-200 hover:-translate-y-px" style={{ background: t.accent, color: "#fff" }}>Add</button>
          )}
          <button onClick={a2hs.onDismiss} className="shrink-0 w-7 h-7 rounded-lg flex items-center justify-center border-none cursor-pointer transition-transform duration-200 hover:-translate-y-px" style={{ background: dark ? "rgba(255,255,255,.16)" : "rgba(0,0,0,.08)", color: t.textMuted }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
      )}

      {/* ── Next action ── */}
      <div className="mb-5 max-md:mb-4 rounded-xl py-4 px-5 max-md:py-3.5 max-md:px-4" style={{ background: dark ? "rgba(196,125,142,.1)" : "rgba(196,125,142,.06)", border: `1px solid ${dark ? "rgba(196,125,142,.18)" : "rgba(196,125,142,.12)"}` }}>
        <div className="text-[13px] mb-2.5 max-md:mb-2" style={{ color: t.textMuted }}>{primaryAction.sub}</div>
        <button onClick={() => setActive(primaryAction.target)} className="w-full py-2.5 max-md:py-2 rounded-[10px] text-sm max-md:text-[13px] font-semibold border-none cursor-pointer transition-transform duration-200 hover:-translate-y-px" style={{ background: t.accent, color: "#fff" }}>{primaryAction.label}</button>
      </div>

      {/* ── Active orders (mobile/tablet only — desktop uses RightSidebar) ── */}
      {sortedActive.length > 0 && (
        <div className="hidden max-desktop:!block rounded-[14px] max-md:rounded-xl overflow-hidden mb-5 max-md:mb-4" style={{ background: dark ? "rgba(255,255,255,.09)" : "rgba(255,255,255,.85)", border: `1px solid ${dark ? "rgba(255,255,255,.12)" : "rgba(0,0,0,.08)"}` }}>
          <div className="py-3 px-[18px] flex justify-between items-center" style={{ background: dark ? "rgba(196,125,142,.18)" : "rgba(196,125,142,.12)", borderBottom: `1px solid ${dark ? "rgba(255,255,255,.12)" : "rgba(0,0,0,.08)"}` }}>
            <div className="flex items-center gap-2">
              <div className="text-sm font-semibold tracking-wide uppercase" style={{ color: t.textMuted }}>Active Orders</div>
              {attentionOrders.length > 0 && <span className="text-[11px] font-semibold py-0.5 px-2 rounded-full" style={{ background: dark ? "rgba(251,191,36,.12)" : "rgba(217,119,6,.08)", color: dark ? "#fcd34d" : "#d97706" }}>Needs attention</span>}
            </div>
            {activeOrders.length > 3 && <button onClick={() => setActive("orders")} className="text-xs font-medium bg-transparent border-none cursor-pointer font-[inherit]" style={{ color: t.accent }}>View all {activeOrders.length} →</button>}
          </div>
          {sortedActive.slice(0, 3).map((o, i) => {
            const pct = o.remains != null && o.quantity > 0 ? Math.max(0, Math.min(100, Math.round((o.quantity - o.remains) / o.quantity * 100))) : null;
            return (
              <div key={o.id} onClick={() => setActive("orders")} className="flex items-center py-3 px-[18px] max-md:px-3.5 gap-3 cursor-pointer transition-colors duration-150 hover:bg-[rgba(196,125,142,.08)]" style={{ borderBottom: i < Math.min(sortedActive.length, 3) - 1 ? `1px solid ${t.cardBorder}` : "none" }}>
                <PlatformIcon platform={o.platform} dark={dark} />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium overflow-hidden text-ellipsis whitespace-nowrap mb-1" style={{ color: t.text }}>{o.service}{o.tier ? ` · ${o.tier}` : ""}</div>
                  {pct != null ? (
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: dark ? "rgba(255,255,255,.14)" : "rgba(0,0,0,.08)" }}>
                        <div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${pct}%`, background: sClr(o.status, dark) }} />
                      </div>
                      <span className="text-[11px] font-medium shrink-0" style={{ color: t.textMuted }}>{pct}%</span>
                    </div>
                  ) : (
                    <div className="text-[12px]" style={{ color: t.textMuted }}>{o.quantity?.toLocaleString()} qty</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Feature cards ── */}
      <div className="grid grid-cols-3 gap-2 mb-5 max-md:mb-4">
        <button onClick={() => setTutorialOpen(true)} className="flex flex-col items-center gap-1.5 py-4 px-2 max-md:py-3 rounded-xl border-none cursor-pointer text-center transition-transform duration-200 hover:-translate-y-px" style={{ background: dark ? "rgba(255,255,255,.07)" : "rgba(255,255,255,.85)", border: `1px solid ${dark ? "rgba(255,255,255,.12)" : "rgba(0,0,0,.08)"}` }}>
          <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: dark ? "rgba(196,125,142,.2)" : "rgba(196,125,142,.12)" }}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={t.accent} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><line x1="9" y1="18" x2="15" y2="18"/><line x1="10" y1="22" x2="14" y2="22"/><path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0018 8 6 6 0 006 8c0 1 .23 2.23 1.5 3.5A4.61 4.61 0 018.91 14"/></svg>
          </div>
          <div className="text-[12px] font-semibold" style={{ color: t.text }}>How it works</div>
          <div className="text-[11px] -mt-0.5" style={{ color: t.textMuted }}>Step-by-step</div>
        </button>
        <button onClick={() => setTipsOpen(true)} className="flex flex-col items-center gap-1.5 py-4 px-2 max-md:py-3 rounded-xl border-none cursor-pointer text-center transition-transform duration-200 hover:-translate-y-px" style={{ background: dark ? "rgba(255,255,255,.07)" : "rgba(255,255,255,.85)", border: `1px solid ${dark ? "rgba(255,255,255,.12)" : "rgba(0,0,0,.08)"}` }}>
          <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: dark ? "rgba(196,125,142,.2)" : "rgba(196,125,142,.12)" }}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={t.accent} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
          </div>
          <div className="text-[12px] font-semibold" style={{ color: t.text }}>What to Expect</div>
          <div className="text-[11px] -mt-0.5" style={{ color: t.textMuted }}>Good to know</div>
        </button>
        <button onClick={() => { if (socialLinks.social_whatsapp_support) window.open(`https://wa.me/${socialLinks.social_whatsapp_support.replace(/\D/g, "")}?text=${encodeURIComponent("Hi Nitro, I need help")}`, "_blank"); }} className="flex flex-col items-center gap-1.5 py-4 px-2 max-md:py-3 rounded-xl border-none cursor-pointer text-center transition-transform duration-200 hover:-translate-y-px" style={{ background: dark ? "rgba(255,255,255,.07)" : "rgba(255,255,255,.85)", border: `1px solid ${dark ? "rgba(255,255,255,.12)" : "rgba(0,0,0,.08)"}` }}>
          <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: dark ? "rgba(37,211,102,.15)" : "rgba(37,211,102,.1)" }}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="#25d366"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
          </div>
          <div className="text-[12px] font-semibold" style={{ color: t.text }}>Support</div>
          <div className="text-[11px] -mt-0.5" style={{ color: t.textMuted }}>WhatsApp</div>
        </button>
      </div>

      {/* Tutorial popup */}
      {tutorialOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 backdrop-blur-[4px] animate-[modalFadeIn_.2s_ease]" onClick={() => setTutorialOpen(false)} style={{ background: "rgba(0,0,0,.45)" }}>
          <div role="dialog" aria-modal="true" className="w-full max-w-[420px] rounded-2xl overflow-hidden animate-[modalBounceIn_.3s_cubic-bezier(.34,1.56,.64,1)_both]" onClick={e => e.stopPropagation()} style={{ background: dark ? "#0e1120" : "#fff", border: `1px solid ${dark ? "rgba(255,255,255,.22)" : "rgba(0,0,0,.14)"}`, boxShadow: dark ? "0 20px 60px rgba(0,0,0,.4)" : "0 20px 60px rgba(0,0,0,.1)" }}>
            <div className="py-4 px-5 flex items-center justify-between" style={{ background: dark ? "rgba(196,125,142,.1)" : "rgba(196,125,142,.06)", borderBottom: `1px solid ${dark ? "rgba(196,125,142,.15)" : "rgba(196,125,142,.1)"}` }}>
              <div className="text-[15px] font-semibold" style={{ color: t.text }}>How it works</div>
              <button onClick={() => setTutorialOpen(false)} className="w-7 h-7 rounded-lg flex items-center justify-center border border-solid cursor-pointer bg-transparent" style={{ borderColor: dark ? "rgba(255,255,255,.22)" : "rgba(0,0,0,.14)", color: t.textSoft }}><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
            </div>
            <div className="py-5 px-5 flex flex-col gap-3.5 max-h-[70vh] overflow-y-auto">
              {[
                { step: "1", title: "Create your account", desc: "Sign up with your email — it only takes a few seconds." },
                { step: "2", title: "Add funds", desc: "Top up your balance via bank transfer or card payment." },
                { step: "3", title: "Pick a platform", desc: "Choose Instagram, TikTok, X, or any platform you want to grow on." },
                { step: "4", title: "Choose a service & tier", desc: "Pick what you need — followers, likes, views — then select Budget, Standard, or Premium quality." },
                { step: "5", title: "Paste your link", desc: "Drop your profile or post link and set the quantity you want." },
                { step: "6", title: "Place your order", desc: "Confirm and your order starts processing. Delivery begins within minutes." },
                { step: "7", title: "Track delivery", desc: "Watch your order progress in real time from your dashboard." },
              ].map((item, i) => (
                <div key={i} className="flex items-start gap-3">
                  <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-[12px] font-bold" style={{ background: dark ? "rgba(196,125,142,.2)" : "rgba(196,125,142,.12)", color: t.accent }}>{item.step}</div>
                  <div className="pt-0.5">
                    <div className="text-[13px] font-semibold mb-0.5" style={{ color: t.text }}>{item.title}</div>
                    <div className="text-[12px] leading-[1.55]" style={{ color: t.textMuted }}>{item.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* What to Expect popup */}
      {tipsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 backdrop-blur-[4px] animate-[modalFadeIn_.2s_ease]" onClick={() => setTipsOpen(false)} style={{ background: "rgba(0,0,0,.45)" }}>
          <div role="dialog" aria-modal="true" className="w-full max-w-[420px] rounded-2xl overflow-hidden animate-[modalBounceIn_.3s_cubic-bezier(.34,1.56,.64,1)_both]" onClick={e => e.stopPropagation()} style={{ background: dark ? "#0e1120" : "#fff", border: `1px solid ${dark ? "rgba(255,255,255,.22)" : "rgba(0,0,0,.14)"}`, boxShadow: dark ? "0 20px 60px rgba(0,0,0,.4)" : "0 20px 60px rgba(0,0,0,.1)" }}>
            <div className="py-4 px-5 flex items-center justify-between" style={{ background: dark ? "rgba(196,125,142,.1)" : "rgba(196,125,142,.06)", borderBottom: `1px solid ${dark ? "rgba(196,125,142,.15)" : "rgba(196,125,142,.1)"}` }}>
              <div className="text-[15px] font-semibold" style={{ color: t.text }}>What to Expect</div>
              <button onClick={() => setTipsOpen(false)} className="w-7 h-7 rounded-lg flex items-center justify-center border border-solid cursor-pointer bg-transparent" style={{ borderColor: dark ? "rgba(255,255,255,.22)" : "rgba(0,0,0,.14)", color: t.textSoft }}><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
            </div>
            <div className="py-5 px-5 flex flex-col gap-4 max-h-[70vh] overflow-y-auto">
              {[
                { icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>, color: dark ? "#a5b4fc" : "#4f46e5", title: "Gradual delivery", desc: "Orders are delivered over hours or days, not all at once. This keeps activity looking natural and protects your account from being flagged." },
                { icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></svg>, color: dark ? "#fbbf24" : "#d97706", title: "Normal drops happen", desc: "Social platforms routinely clean up inactive or low-quality accounts. A small drop after delivery is expected — it's the platform doing its job, not a problem with your order." },
                { icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M23 4v6h-6"/><path d="M1 20v-6h6"/><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/></svg>, color: dark ? "#6ee7b7" : "#059669", title: "Refill is your safety net", desc: "Standard and Premium tiers include automatic refills. If a cleanup hits your count, we top you back up at no extra cost — 30-day window for Standard, lifetime for Premium." },
                { icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>, color: dark ? "#f9a8d4" : "#be185d", title: "Keep your account safe", desc: "Always set your profile to public before ordering. Start small with a Budget tier to test, and avoid ordering on brand-new accounts with zero content." },
              ].map((item, i) => (
                <div key={i} className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5" style={{ background: `${item.color}14`, color: item.color }}>{item.icon}</div>
                  <div>
                    <div className="text-[13px] font-semibold mb-0.5" style={{ color: t.text }}>{item.title}</div>
                    <div className="text-[12px] leading-[1.55]" style={{ color: t.textMuted }}>{item.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Recent orders ── */}
      <div className="rounded-[14px] max-md:rounded-xl overflow-hidden mb-5 max-md:mb-4" style={{ background: dark ? "rgba(255,255,255,.09)" : "rgba(255,255,255,.85)", border: `1px solid ${dark ? "rgba(255,255,255,.12)" : "rgba(0,0,0,.08)"}` }}>
        <div className="py-3 px-[18px] flex justify-between items-center" style={{ background: dark ? "rgba(196,125,142,.18)" : "rgba(196,125,142,.12)", borderBottom: `1px solid ${dark ? "rgba(255,255,255,.12)" : "rgba(0,0,0,.08)"}` }}>
          <div className="text-sm font-semibold tracking-wide uppercase" style={{ color: t.textMuted }}>Recent orders</div>
          {orders.length > 0 && <button onClick={() => setActive("orders")} className="text-xs font-medium bg-transparent border-none cursor-pointer font-[inherit]" style={{ color: t.accent }}>View all →</button>}
        </div>
        {(() => {
          const items = [];
          const batches = {};
          for (const o of orders) {
            if (o.batchId) {
              if (!batches[o.batchId]) { batches[o.batchId] = { type: "batch", batchId: o.batchId, orders: [], created: o.created }; items.push(batches[o.batchId]); }
              batches[o.batchId].orders.push(o);
            } else { items.push({ type: "single", order: o, created: o.created }); }
          }
          items.sort((a, b) => new Date(b.created) - new Date(a.created));
          const display = items.slice(0, 5);
          return display.length > 0 ? display.map((item, i) => {
            if (item.type === "batch") {
              return (
                <div key={item.batchId} onClick={() => setActive("orders")} className="flex items-center py-3 px-[18px] max-md:py-2.5 max-md:px-3.5 gap-3 cursor-pointer transition-colors duration-150 hover:bg-[rgba(196,125,142,.08)]" style={{ borderBottom: i < display.length - 1 ? `1px solid ${t.cardBorder}` : "none" }}>
                  <div className="shrink-0 flex items-center justify-center" style={{ width: 32, height: 32, borderRadius: 8, background: dark ? "rgba(196,125,142,.1)" : "rgba(196,125,142,.08)" }}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={t.accent} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 002 1.61h9.72a2 2 0 002-1.61L23 6H6"/></svg>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium" style={{ color: t.text }}>{item.orders.length} orders</div>
                    <div className="text-xs mt-px" style={{ color: t.textMuted }}>{item.created ? fD(item.created, true) : ""}</div>
                  </div>
                </div>
              );
            }
            const o = item.order;
            return (
              <div key={o.id} onClick={() => setActive("orders")} className="flex items-center py-3 px-[18px] max-md:py-2.5 max-md:px-3.5 gap-3 cursor-pointer transition-colors duration-150 hover:bg-[rgba(196,125,142,.08)]" style={{ borderBottom: i < display.length - 1 ? `1px solid ${t.cardBorder}` : "none" }}>
                <PlatformIcon platform={o.platform} dark={dark} size={32} />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium overflow-hidden text-ellipsis whitespace-nowrap" style={{ color: t.text }}>{o.service}</div>
                  <div className="text-xs mt-px" style={{ color: t.textMuted }}>{o.created ? fD(o.created, true) : ""}</div>
                </div>
              </div>
            );
          }) : null;
        })() || (
          <div className="py-10 px-[18px] text-center flex flex-col items-center">
            <svg width="48" height="48" viewBox="0 0 64 64" fill="none" className="mb-3 opacity-60">
              <rect x="12" y="8" width="40" height="48" rx="6" stroke={t.accent} strokeWidth="1.5" opacity=".3" />
              <line x1="20" y1="22" x2="44" y2="22" stroke={t.accent} strokeWidth="1.5" opacity=".2" strokeLinecap="round" />
              <line x1="20" y1="30" x2="38" y2="30" stroke={t.accent} strokeWidth="1.5" opacity=".15" strokeLinecap="round" />
              <circle cx="32" cy="38" r="8" stroke={t.accent} strokeWidth="1.5" opacity=".2" />
              <path d="M29 38l2 2 4-4" stroke={t.accent} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity=".4" />
            </svg>
            <div className="text-base font-semibold mb-1" style={{ color: t.textSoft }}>No orders yet</div>
            <div className="text-sm mb-4 leading-[1.5] max-w-[320px]" style={{ color: t.textMuted }}>Choose a platform, pick a service, and place your first order.</div>
            <button onClick={() => setActive("services")} className="cursor-pointer py-2.5 px-6 rounded-[10px] text-sm font-semibold border-none transition-transform duration-200 hover:-translate-y-px mb-2" style={{ background: t.accent, color: "#fff" }}>Place first order</button>
            <button onClick={() => setActive("guide")} className="cursor-pointer py-2 px-4 rounded-[10px] text-[13px] font-medium border-none transition-transform duration-200 hover:-translate-y-px" style={{ background: "transparent", color: t.textMuted }}>View blog</button>
          </div>
        )}
      </div>

      {/* ── Referral card — tablet/mobile only ── */}
      <div className="hidden max-desktop:block mb-4 rounded-[14px] max-md:rounded-xl overflow-hidden" style={{ background: dark ? "rgba(255,255,255,.09)" : "rgba(255,255,255,.85)", border: `1px solid ${t.cardBorder}` }}>
        <div className="flex items-center gap-3 p-4 max-md:p-3.5">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: dark ? "rgba(196,125,142,.12)" : "rgba(196,125,142,.08)", color: t.accent }}>
            {I.referrals}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold" style={{ color: t.text }}>Invite friends</div>
            <div className="text-[13px] mt-0.5" style={{ color: t.textMuted }}>{user?.refs || 0} referrals · {fN(user?.earnings || 0)} earned</div>
          </div>
          <div className="text-right shrink-0">
            <div className="m text-base font-semibold tracking-[1.5px]" style={{ color: t.accent }}>{user?.refCode || "—"}</div>
          </div>
        </div>
        <div className="px-4 max-md:px-3.5 pb-3.5">
          <button onClick={() => setActive("referrals")} className="w-full py-2 rounded-lg text-[13px] font-semibold border-none cursor-pointer transition-transform duration-200 hover:-translate-y-px" style={{ background: dark ? "rgba(196,125,142,.15)" : "rgba(196,125,142,.1)", color: t.accent }}>Open referrals</button>
        </div>
      </div>

    </>
  );
}

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
    <div className="rounded-[14px] max-md:rounded-xl overflow-hidden" style={{ background: dark ? "rgba(255,255,255,.09)" : "rgba(255,255,255,.85)", border: `1px solid ${dark ? "rgba(255,255,255,.12)" : "rgba(0,0,0,.08)"}` }}>
      <div className="py-10 px-6 max-md:py-8 max-md:px-4 flex flex-col items-center text-center">
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-5" style={{ background: dark ? "rgba(196,125,142,.12)" : "rgba(196,125,142,.08)", color: t.accent }}>
          <span style={{ transform: "scale(1.8)" }}>{meta.icon}</span>
        </div>
        <div className="text-xl max-md:text-lg font-semibold mb-2" style={{ color: t.text }}>{meta.title}</div>
        <div className="text-sm max-md:text-[13px] max-w-[440px] mb-8 leading-relaxed" style={{ color: t.textMuted }}>{meta.desc}</div>

        {joined ? (
          <div className="rounded-xl py-4 px-6 max-md:px-4" style={{ background: dark ? "rgba(110,231,183,.06)" : "rgba(5,150,105,.04)", border: `1px solid ${dark ? "rgba(110,231,183,.15)" : "rgba(5,150,105,.12)"}` }}>
            <div className="flex items-center gap-2 justify-center mb-1">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={t.green} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
              <span className="text-sm font-semibold" style={{ color: t.green }}>You're on the list</span>
            </div>
            <div className="text-[13px]" style={{ color: t.textMuted }}>{joined.email}</div>
          </div>
        ) : (
          <form onSubmit={submit} className="w-full max-w-[360px]">
            <div className="mb-4">
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Enter your email" className="w-full py-2.5 px-3 rounded-[10px] text-sm font-[inherit] outline-none box-border" style={{ background: dark ? "rgba(255,255,255,.09)" : "#fff", border: `1px solid ${dark ? "rgba(255,255,255,.18)" : "rgba(0,0,0,.14)"}`, color: t.text }} />
            </div>
            <button type="submit" disabled={submitting || !email.trim()} className="w-full py-2.5 rounded-[10px] text-sm font-semibold border-none cursor-pointer transition-transform duration-200 hover:-translate-y-px" style={{ background: t.accent, color: "#fff", opacity: submitting || !email.trim() ? 0.5 : 1 }}>
              {submitting ? "Joining..." : "Join the waitlist"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════ */
/* ═══ RIGHT SIDEBAR                      ═══ */
/* ═══════════════════════════════════════════ */
function RightSidebar({ orders, user, dark, t, setActive }) {
  const activeOrders = orders.filter(o => o.status === "Processing" || o.status === "Pending" || o.status === "Partial");

  return (
    <>
      {/* ── Your Stats ── */}
      <div className="shrink-0">
        <div className="text-sm font-semibold uppercase tracking-[1.5px] mb-2.5 py-2 px-3 rounded-lg" style={{ color: t.textMuted, background: dark ? "rgba(196,125,142,.18)" : "rgba(196,125,142,.12)" }}>Your Stats</div>
        <div className="flex flex-col">
          {(() => {
            const platformCounts = {};
            orders.forEach(o => { const p = o.platform || "unknown"; platformCounts[p] = (platformCounts[p] || 0) + 1; });
            const topPlatform = Object.entries(platformCounts).sort((a, b) => b[1] - a[1])[0];
            const avgQty = orders.length > 0 ? Math.round(orders.reduce((s, o) => s + (o.quantity || 0), 0) / orders.length) : 0;
            const memberDate = user?.createdAt ? new Date(user.createdAt).toLocaleDateString("en-GB", { month: "short", year: "numeric" }) : "—";
            const wk = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
            const wkOrders = orders.filter(o => o.created && new Date(o.created) > wk).length;
            return [
              ["Most Ordered", topPlatform ? topPlatform[0].charAt(0).toUpperCase() + topPlatform[0].slice(1) : "—", <svg key="ig" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={t.accent} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1112.63 8 4 4 0 0116 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/></svg>],
              ["Avg Order Size", avgQty > 0 ? avgQty.toLocaleString() + " qty" : "—", <svg key="sz" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={dark ? "#a5b4fc" : "#4f46e5"} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/></svg>],
              ["This Week", wkOrders > 0 ? wkOrders + " orders" : "No orders", <svg key="wk" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={dark ? "#6ee7b7" : "#059669"} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>],
              ["Member Since", memberDate, <svg key="ms" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={dark ? "#e0a458" : "#d97706"} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>],
            ];
          })().map(([label, val, icon], i, arr) => (
            <div key={label} className="flex items-center gap-2.5 py-[9px] px-1" style={{ borderBottom: i < arr.length - 1 ? `1px solid ${t.cardBorder}` : "none" }}>
              <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0">{icon}</div>
              <div className="flex-1">
                <div className="text-sm font-medium" style={{ color: t.textMuted }}>{label}</div>
                <div className="text-sm font-semibold mt-px" style={{ color: t.text }}>{val}</div>
              </div>
            </div>
          ))}
        </div>
        {/* Walkthrough trigger — inside stats section */}
      </div>

      {/* Divider */}
      <div className="h-0.5 my-1 shrink-0" style={{ background: t.sidebarBorder }} />

      {/* ── Active Orders ── */}
      <div className="flex-1 overflow-auto pt-2">
        <div className="text-sm font-semibold uppercase tracking-[1.5px] mb-2.5 py-2 px-3 rounded-lg" style={{ color: t.textMuted, background: dark ? "rgba(196,125,142,.18)" : "rgba(196,125,142,.12)" }}>Active Orders</div>
        {activeOrders.length === 0 && <div className="text-sm mb-2.5" style={{ color: t.textMuted }}>No active orders</div>}
        <div className="flex flex-col gap-1.5">
          {activeOrders.slice(0, 5).map(o => (
            <div key={o.id} className="py-2.5 px-3 rounded-[10px]" style={{ background: t.cardBg }}>
              <div className="flex items-center gap-2.5">
                <PlatformIcon platform={o.platform} dark={dark} size={28} />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium mb-[3px] overflow-hidden text-ellipsis whitespace-nowrap" style={{ color: t.text }}>{o.service}{o.tier ? ` · ${o.tier}` : ""}</div>
                  <div className="text-[13px]" style={{ color: t.textMuted }}>{o.quantity?.toLocaleString() || 0} qty</div>
                </div>
              </div>
            </div>
          ))}
        </div>
        {activeOrders.length > 5 && (
          <button onClick={() => setActive("orders")} className="w-full py-1.5 text-sm font-medium text-center bg-none border-none cursor-pointer mt-1 transition-transform duration-200 hover:-translate-y-px" style={{ color: t.accent }}>View all {activeOrders.length} active →</button>
        )}
      </div>

      {/* Divider */}
      <div className="h-0.5 my-1 shrink-0" style={{ background: t.sidebarBorder }} />

      {/* ── Referral Card ── */}
      <div className="shrink-0 flex items-center pt-2">
        <div className="p-3.5 rounded-xl text-center w-full" style={{ background: dark ? "rgba(255,255,255,.09)" : "rgba(255,255,255,.85)", border: `1px solid ${t.cardBorder}` }}>
          <div className="text-[13px] uppercase tracking-[1.5px] mb-1" style={{ color: t.textMuted }}>Your referral code</div>
          <div className="m text-lg font-semibold tracking-[2px]" style={{ color: t.accent }}>{user?.refCode || "—"}</div>
          <div className="text-sm mt-1" style={{ color: t.textMuted }}>{user?.refs || 0} referrals · {fN(user?.earnings || 0)} earned</div>
        </div>
      </div>
    </>
  );
}

/* ═══════════════════════════════════════════ */
/* ═══ NOTIFICATION DROPDOWN              ═══ */
/* ═══════════════════════════════════════════ */
const NOTIF_ICONS = {
  check: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>,
  clock: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
  x: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>,
  dollar: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>,
  gift: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 12v10H4V12"/><path d="M2 7h20v5H2z"/><path d="M12 22V7"/></svg>,
  chat: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>,
};

function NotifDropdown({ items, dark, t, onClose, readIds, setReadIds, clearedIds, setClearedIds, setClearedAt, readAllAt, setReadAllAt, onNavigate }) {
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
          <span className="text-base font-semibold" style={{ color: t.text }}>Notifications</span>
          {unreadCount > 0 && <span className="text-xs py-0.5 px-1.5 rounded-[5px] font-semibold" style={{ background: dark ? "#1c1015" : "#fdf2f4", color: t.accent }}>{unreadCount}</span>}
        </div>
        <div className="flex gap-2.5">
          {unreadCount > 0 && <button onClick={markAllRead} className="text-[13px] font-semibold bg-none border-none cursor-pointer transition-transform duration-200 hover:-translate-y-px" style={{ color: t.accent }}>Mark all read</button>}
          {items.length > 0 && <button onClick={clearAll} className="text-[13px] font-semibold bg-none border-none cursor-pointer transition-transform duration-200 hover:-translate-y-px" style={{ color: t.textMuted }}>Clear all</button>}
        </div>
      </div>
      {/* Filter tabs */}
      <div className="px-3.5 pb-2.5">
        <SegPill value={filter} options={[{value: "all", label: "All"}, {value: "order", label: "Orders"}, {value: "deposit", label: "Deposits"}]} onChange={setFilter} dark={dark} t={t} fill />
      </div>
      <div className="h-px" style={{ background: t.cardBorder }} />
      {/* List */}
      <div className="max-h-[280px] overflow-y-auto">
        {display.length > 0 ? display.map((n, i) => {
          const isRead = n.alwaysUnread ? false : readIds.has(n.id) || (readAllAt && n.ts && n.ts <= readAllAt);
          return (
            <div key={n.id} role="button" tabIndex={0} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();e.currentTarget.click()}}} onClick={() => { if (n.type === "ticket" && socialLinks?.social_whatsapp_support) { window.open(`https://wa.me/${socialLinks.social_whatsapp_support.replace(/\D/g, "")}?text=${encodeURIComponent("Hi *Nitro*, I need help")}`, "_blank"); onClose(); } else { markRead(n.id); } }} className="flex items-start gap-2.5 py-3 px-4 transition-colors duration-150 hover:bg-[rgba(196,125,142,.1)]" style={{ borderBottom: i < display.length - 1 ? `1px solid ${t.cardBorder}` : "none", background: !isRead ? (dark ? "rgba(196,125,142,.06)" : "rgba(196,125,142,.04)") : "transparent", cursor: "pointer" }}>
              <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${n.color}15`, color: n.color }}>{NOTIF_ICONS[n.icon]}</div>
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-center gap-1.5">
                  <span className="text-sm" style={{ fontWeight: isRead ? 500 : 600, color: t.text }}>{n.title}</span>
                  {!isRead && <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: t.accent }} />}
                </div>
                <div className="text-sm mt-0.5 overflow-hidden text-ellipsis whitespace-nowrap" style={{ color: t.textSoft }}>{n.desc}</div>
                <div className="text-[13px] mt-[3px]" style={{ color: t.textMuted }}>{n.time}</div>
              </div>
            </div>
          );
        }) : (
          <div className="py-6 px-3.5 text-center text-sm" style={{ color: t.textMuted }}>No notifications</div>
        )}
      </div>
      {/* Footer */}
      {hasMore && <div className="py-2 px-3.5 text-center text-xs" style={{ color: t.textMuted, borderTop: `1px solid ${t.cardBorder}` }}>Showing latest 10 of {filtered.length}</div>}
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
  const [txs, setTxs] = useState(initialData?.transactions || []);
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
  const [socialLinks, setSocialLinks] = useState({});
  const [activePromotion, setActivePromotion] = useState(null);
  const [paymentStatus, setPaymentStatusRaw] = useState(() => {
    if (typeof window === 'undefined') return null;
    try { const s = sessionStorage.getItem("nitro-payment-status"); return s ? JSON.parse(s) : null; } catch { return null; }
  });
  const setPaymentStatus = (val) => {
    setPaymentStatusRaw(val);
    try { if (val) sessionStorage.setItem("nitro-payment-status", JSON.stringify(val)); else sessionStorage.removeItem("nitro-payment-status"); } catch {}
  };
  const notifRef = useRef(null);

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
        desc: `${fN(tx.amount)} — ${tx.description || "Bonus from Nitro"}`,
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
      const res = await fetch("/api/dashboard");
      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
        if (data.orders) setOrders(data.orders);
        if (data.transactions) setTxs(data.transactions);
        if (data.unreadTickets) setUnreadTickets(data.unreadTickets);
        if (data.walletSummary) setWalletSummary(data.walletSummary);
        if (data.alerts) setAlerts(data.alerts);
        if (data.currentTosVersion) setCurrentTosVersion(data.currentTosVersion);
      }
    } catch {}
    try { const cr = await fetch("/api/promotion"); if (cr.ok) { const cd = await cr.json(); setActivePromotion(cd.active ? cd : null); } } catch {}
  };

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
        const maintRes = await fetch("/api/maintenance-check");
        if (maintRes.ok) { const m = await maintRes.json(); if (m.maintenance) { window.location.replace("/maintenance"); return; } }

        /* Skip dashboard fetch if server already provided data */
        if (!initialData) {
          const res = await fetch("/api/dashboard");
          if (res.status === 401) { window.location.replace("/?session_expired=1"); return; }
          if (res.ok) {
            const data = await res.json();
            setUser(data.user);
            if (data.orders) setOrders(data.orders);
            if (data.transactions) setTxs(data.transactions);
        if (data.unreadTickets) setUnreadTickets(data.unreadTickets);
            if (data.walletSummary) setWalletSummary(data.walletSummary);
            if (data.alerts) setAlerts(data.alerts);
            if (data.currentTosVersion) setCurrentTosVersion(data.currentTosVersion);
          } else setUser({ name: "User", email: "", balance: 0, refCode: "—", refs: 0, earnings: 0 });
        }
        /* Fetch social links + active promotion */
        try { const sr = await fetch("/api/settings"); if (sr.ok) { const sd = await sr.json(); setSocialLinks(sd.settings || {}); } } catch {}
        try { const cr = await fetch("/api/promotion"); if (cr.ok) { const cd = await cr.json(); if (cd.active) setActivePromotion(cd); } } catch {}
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
      } catch { setUser({ name: "User", email: "", balance: 0, refCode: "—", refs: 0, earnings: 0 }); }
    }
    load().then(() => {
      // Check tour state from DB (via user data) + localStorage as fallback
      const u = document.querySelector("[data-user-tour]");
      // We'll check after user state is set
    });
  }, []);

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
        const res = await fetch("/api/dashboard");
        if (res.status === 401) { window.location.replace("/?session_expired=1"); return; }
        if (res.ok) {
          const data = await res.json();
          if (data.user) setUser(data.user);
          if (data.orders) setOrders(data.orders);
          if (data.transactions) setTxs(data.transactions);
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
    const params = new URLSearchParams(window.location.search);
    const ref = params.get("verify") || params.get("reference") || params.get("trxref");
    if (!ref) return;

    /* Clean URL immediately */
    window.history.replaceState({}, "", "/dashboard");
    setActive("add-funds");

    async function verify() {
      try {
        const res = await fetch("/api/payments/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reference: ref }),
        });
        const data = await res.json();
        if (data.success) {
          setPaymentStatus({ type: "success", message: "Payment successful!", amount: data.amount, welcomeBonus: data.welcomeBonus || 0 });
          if (typeof window.fbq === "function") fbq("track", "AddPaymentInfo", { value: data.amount, currency: "NGN" }, { eventID: data.eventId });
          /* Refresh user balance */
          try {
            const dashRes = await fetch("/api/dashboard");
            if (dashRes.ok) {
              const dashData = await dashRes.json();
              setUser(dashData.user);
              if (dashData.transactions) setTxs(dashData.transactions);
              if (dashData.unreadTickets) setUnreadTickets(dashData.unreadTickets);
              if (dashData.walletSummary) setWalletSummary(dashData.walletSummary);
            }
          } catch {}
        } else {
          setPaymentStatus({ type: "error", message: data.error || "Payment verification failed" });
        }
      } catch {
        setPaymentStatus({ type: "error", message: "Could not verify payment. Please contact support." });
      }
    }
    verify();
  }, []);

  /* Close notif on outside click */
  useEffect(() => {
    if (!notifOpen) return;
    const handler = (e) => { if (notifRef.current && !notifRef.current.contains(e.target)) setNotifOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [notifOpen]);

  const handleLogout = async () => { try { await fetch("/api/auth/logout", { method: "POST" }); } catch {} window.location.replace("/?logout=1"); };

  /* Reset services state when leaving */
  useEffect(() => { if (!isServices) { setNoSelSvc(null); setNoSelTier(null); setNoLink(""); setNoComments(""); setNoCatModal(false); } }, [active]);

  const t = useMemo(() => ({
    ...baseT,
    sidebarBg: dark ? "#0e1122" : "#eceae5",
    sidebarBorder: dark ? "rgba(255,255,255,.18)" : "rgba(0,0,0,.18)",
    cardBg: dark ? "rgba(255,255,255,.07)" : "rgba(255,255,255,.8)",
    cardBorder: dark ? "rgba(255,255,255,.14)" : "rgba(0,0,0,.1)",
    navActive: dark ? "rgba(196,125,142,.12)" : "rgba(196,125,142,.08)",
  }), [dark, baseT]);

  const initials = user ? ((user.firstName?.[0] || '') + (user.lastName?.[0] || '')).toUpperCase() || user.name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2) : "";
  const firstName = user ? (user.firstName || user.name.split(" ")[0]) : "";

  /* Loading — skeleton */
  if (!user) {
    const skBone = `skel-bone ${dark ? "skel-dark" : "skel-light"}`;
    return (
      <div className="dash-root" style={{ background: t.bg }}>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}@keyframes skeletonShimmer{0%{background-position:-200% 0}100%{background-position:200% 0}}`}</style>
        <nav className="dash-nav" style={{ background: t.sidebarBg, borderBottom: `0.5px solid ${t.sidebarBorder}` }}>
          <div className="dash-nav-left">
            <div className="dash-logo-static">
              <div className="dash-logo-box"><svg width="10" height="11" viewBox="0 0 1601 1785" fill="#fff"><path d="M1600.82 160.089V1313c-.85 53.13-10.35 104.17-27.19 151.74-48.19 136.54-156.38 244.73-292.92 292.92-50.12 17.76-103.94 27.34-160.08 27.34 0 0-79.39 0-160.01-27.34-85.1-28.88-155.38-85.49-208.28-141.55-72.59-76.84-112.13-179.09-112.13-284.74V1023.4v-3.08-12.9c.08-1.39.08-2.7.08-4.17 0-1.39 0-2.7-.08-4.09-2.08-84.64-69.97-153.06-154.53-155.84-1.85-.08-3.71-.15-5.48-.15-1.78 0-3.71.08-5.48.15-84.56 2.78-152.44 71.2-154.61 155.84-.08 1.39-.08 2.7-.08 4.09 0 1.47 0 2.78.08 4.17v534.87c0 88.42-71.67 160.09-160.09 160.09-44.17 0-84.25-17.92-113.21-46.88C17.92 1626.84 0 1586.76 0 1542.59V995.288c.927-53.132 10.426-104.178 27.261-151.672C75.45 707.003 183.643 598.81 320.179 550.621c50.119-17.685 103.946-27.338 160.089-27.338 0 0 79.388 0 160.012 27.338 85.103 28.882 155.379 85.489 208.278 141.555 72.593 76.84 112.132 179.087 112.132 284.732v307.972l-.077.92v12.89c-.077 1.39-.077 2.78-.077 4.17 0 1.39 0 2.7.077 4.17 2.085 84.64 69.967 152.99 154.527 155.84 1.86 0 3.71 0 5.49 0 1.77 0 3.7 0 5.48 0 84.56-2.85 152.44-71.2 154.6-155.84V160.089C1280.71 71.666 1352.38 0 1440.8 0c44.18 0 84.18 17.916 113.14 46.876 28.96 28.96 46.88 69.04 46.88 113.213z"/></svg></div>
              <span className="dash-logo-text" style={{ color: t.text }}>NITRO</span>
            </div>
          </div>
          <div className="dash-nav-right">
            <div className={`${skBone} w-11 h-6 rounded-xl`} />
            <div className={`${skBone} w-[30px] h-[30px] rounded-[10px]`} />
          </div>
        </nav>
        <div className="dash-body">
          <aside className="dash-left" style={{ background: t.sidebarBg, borderRight: `0.5px solid ${t.sidebarBorder}` }}>
            {[1,2,3,4,5,6,7,8].map(i => <div key={i} className={`${skBone} h-9 rounded-xl mb-1`} />)}
          </aside>
          <main className="dash-main" style={{ background: t.bg }}>
            <div className={`${skBone} w-[260px] h-6 mb-2`} />
            <div className={`${skBone} w-[200px] h-3.5 mb-6`} />
            <div className="grid grid-cols-4 gap-3 mb-6">
              {[1,2,3,4].map(i => (
                <div key={i} className="p-5 rounded-2xl" style={{ background: dark ? "rgba(255,255,255,.09)" : "rgba(255,255,255,.85)", border: `1px solid ${t.cardBorder}` }}>
                  <div className={skBone} style={{ width: "60%", height: 10, marginBottom: 10 }} />
                  <div className={skBone} style={{ width: "45%", height: 24, marginBottom: 8 }} />
                  <div className={skBone} style={{ width: "70%", height: 9 }} />
                </div>
              ))}
            </div>
            <div className={`${skBone} w-[120px] h-2.5 mb-3`} />
            <div className="rounded-2xl py-1 px-4" style={{ background: t.cardBg, borderWidth: 1, borderStyle: "solid", borderColor: t.cardBorder }}>
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
          <div className="dash-right" style={{ background: t.sidebarBg, borderLeft: `0.5px solid ${t.sidebarBorder}` }}>
            <div className={`${skBone} w-[100px] h-2 mb-3.5`} />
            {[1,2,3].map(i => <div key={i} className={`${skBone} h-[50px] rounded-[10px] mb-1.5`} />)}
            <div className="h-0.5 my-3" style={{ background: t.sidebarBorder }} />
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
        return <OverviewPage user={user} orders={orders} alerts={alerts} dark={dark} t={t} setActive={setActive} a2hs={{ ready: a2hsReady, isIos, dismissed: a2hsDismissed, onInstall: handleA2hsInstall, onDismiss: dismissA2hs }} />;
      case "services":
        return <NewOrderPage dark={dark} t={t} user={user} onOrderSuccess={refreshDashboard} onViewOrders={() => setActive("orders")} onTopUp={() => setActive("add-funds")} platform={noPlatform} setPlatform={setNoPlatform} selSvc={noSelSvc} setSelSvc={setNoSelSvc} selTier={noSelTier} setSelTier={setNoSelTier} qty={noQty} setQty={setNoQty} link={noLink} setLink={setNoLink} comments={noComments} setComments={setNoComments} catModal={noCatModal} setCatModal={setNoCatModal} tourActive={showOrderTour} activePromotion={activePromotion} />;
      case "orders":
        return <OrdersPage orders={orders} txs={enrichedTxs} dark={dark} t={t} onNavigate={setActive} waNum={socialLinks.social_whatsapp_support?.replace(/\D/g, "")} />;
      case "referrals":
        return <ReferralsPage user={user} dark={dark} t={t} />;
      case "settings":
        return <SettingsPage user={user} dark={dark} t={t} themeMode={themeMode} setThemeMode={setThemeMode} setDark={setDark} />;
      case "support":
        return <SupportPage dark={dark} t={t} />;
      case "add-funds":
        return <AddFundsPage user={user} txs={enrichedTxs} walletSummary={walletSummary} dark={dark} t={t} paymentStatus={paymentStatus} setPaymentStatus={setPaymentStatus} onPlaceOrder={() => setActive("services")} onRefresh={refreshDashboard} />;
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
      default:
        return (
          <div className="p-10 rounded-2xl flex flex-col items-center justify-center min-h-[300px]" style={{ background: dark ? "rgba(255,255,255,.09)" : "rgba(255,255,255,.85)", border: `1px solid ${t.cardBorder}` }}>
            <div className="text-base font-medium" style={{ color: t.textMuted }}>{active.charAt(0).toUpperCase() + active.slice(1).replace("-", " ")}</div>
            <div className="text-sm opacity-50 mt-1" style={{ color: t.textMuted }}>Coming soon</div>
          </div>
        );
    }
  };

  return (
    <ToastProvider dark={dark}>
    <ConfirmProvider dark={dark}>
    <div className="dash-root user-dash" style={{ background: t.bg }}>

      {/* ═══ TOP NAV ═══ */}
      <nav className="dash-nav" style={{ background: dark ? "rgba(9,12,21,.9)" : "rgba(248,245,241,.92)", borderBottom: `0.5px solid ${dark ? "rgba(255,255,255,.09)" : "rgba(0,0,0,.06)"}`, backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)" }}>
        <div className="dash-nav-left">
          {/* Mobile/tablet: hamburger + logo as one button to toggle sidebar */}
          <button className="dash-menu-btn" onClick={() => setLeftOpen(!leftOpen)} aria-label={leftOpen ? "Close menu" : "Open menu"}>
            <div className="dash-hamburger-bars" style={{ opacity: leftOpen ? 0 : 1, position: leftOpen ? "absolute" : "relative" }}>
              <div className="h-0.5 rounded-[1px] w-4" style={{ background: t.accent }} />
              <div className="h-0.5 rounded-[1px] w-[11px]" style={{ background: t.accent }} />
              <div className="h-0.5 rounded-[1px] w-4" style={{ background: t.accent }} />
            </div>
            {leftOpen && (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={t.accent} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            )}
            <div className="dash-logo-box">
              <svg width="10" height="11" viewBox="0 0 1601 1785" fill="#fff"><path d="M1600.82 160.089V1313c-.85 53.13-10.35 104.17-27.19 151.74-48.19 136.54-156.38 244.73-292.92 292.92-50.12 17.76-103.94 27.34-160.08 27.34 0 0-79.39 0-160.01-27.34-85.1-28.88-155.38-85.49-208.28-141.55-72.59-76.84-112.13-179.09-112.13-284.74V1023.4v-3.08-12.9c.08-1.39.08-2.7.08-4.17 0-1.39 0-2.7-.08-4.09-2.08-84.64-69.97-153.06-154.53-155.84-1.85-.08-3.71-.15-5.48-.15-1.78 0-3.71.08-5.48.15-84.56 2.78-152.44 71.2-154.61 155.84-.08 1.39-.08 2.7-.08 4.09 0 1.47 0 2.78.08 4.17v534.87c0 88.42-71.67 160.09-160.09 160.09-44.17 0-84.25-17.92-113.21-46.88C17.92 1626.84 0 1586.76 0 1542.59V995.288c.927-53.132 10.426-104.178 27.261-151.672C75.45 707.003 183.643 598.81 320.179 550.621c50.119-17.685 103.946-27.338 160.089-27.338 0 0 79.388 0 160.012 27.338 85.103 28.882 155.379 85.489 208.278 141.555 72.593 76.84 112.132 179.087 112.132 284.732v307.972l-.077.92v12.89c-.077 1.39-.077 2.78-.077 4.17 0 1.39 0 2.7.077 4.17 2.085 84.64 69.967 152.99 154.527 155.84 1.86 0 3.71 0 5.49 0 1.77 0 3.7 0 5.48 0 84.56-2.85 152.44-71.2 154.6-155.84V160.089C1280.71 71.666 1352.38 0 1440.8 0c44.18 0 84.18 17.916 113.14 46.876 28.96 28.96 46.88 69.04 46.88 113.213z"/></svg>
            </div>
            <span className="dash-logo-text" style={{ color: t.text }}>NITRO</span>
          </button>
          {/* Desktop: static logo, no click action */}
          <div className="dash-logo-static">
            <div className="dash-logo-box">
              <svg width="10" height="11" viewBox="0 0 1601 1785" fill="#fff"><path d="M1600.82 160.089V1313c-.85 53.13-10.35 104.17-27.19 151.74-48.19 136.54-156.38 244.73-292.92 292.92-50.12 17.76-103.94 27.34-160.08 27.34 0 0-79.39 0-160.01-27.34-85.1-28.88-155.38-85.49-208.28-141.55-72.59-76.84-112.13-179.09-112.13-284.74V1023.4v-3.08-12.9c.08-1.39.08-2.7.08-4.17 0-1.39 0-2.7-.08-4.09-2.08-84.64-69.97-153.06-154.53-155.84-1.85-.08-3.71-.15-5.48-.15-1.78 0-3.71.08-5.48.15-84.56 2.78-152.44 71.2-154.61 155.84-.08 1.39-.08 2.7-.08 4.09 0 1.47 0 2.78.08 4.17v534.87c0 88.42-71.67 160.09-160.09 160.09-44.17 0-84.25-17.92-113.21-46.88C17.92 1626.84 0 1586.76 0 1542.59V995.288c.927-53.132 10.426-104.178 27.261-151.672C75.45 707.003 183.643 598.81 320.179 550.621c50.119-17.685 103.946-27.338 160.089-27.338 0 0 79.388 0 160.012 27.338 85.103 28.882 155.379 85.489 208.278 141.555 72.593 76.84 112.132 179.087 112.132 284.732v307.972l-.077.92v12.89c-.077 1.39-.077 2.78-.077 4.17 0 1.39 0 2.7.077 4.17 2.085 84.64 69.967 152.99 154.527 155.84 1.86 0 3.71 0 5.49 0 1.77 0 3.7 0 5.48 0 84.56-2.85 152.44-71.2 154.6-155.84V160.089C1280.71 71.666 1352.38 0 1440.8 0c44.18 0 84.18 17.916 113.14 46.876 28.96 28.96 46.88 69.04 46.88 113.213z"/></svg>
            </div>
            <span className="dash-logo-text" style={{ color: t.text }}>NITRO</span>
          </div>
        </div>
        <div className="dash-nav-right">
          {/* Balance pill — desktop only */}
          <button onClick={() => setActive("add-funds")} className="max-desktop:hidden flex items-center gap-1.5 h-[34px] px-3 rounded-[10px] cursor-pointer bg-transparent" style={{ border: `0.5px solid ${dark ? "rgba(110,231,183,.15)" : "rgba(5,150,105,.12)"}`, background: dark ? "rgba(110,231,183,.06)" : "rgba(5,150,105,.04)", transition: "background .2s ease" }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={t.green} strokeWidth="2" strokeLinecap="round"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
            <span className="m text-[12px] font-semibold" style={{ color: t.green }}>₦{Math.round(user?.balance || 0).toLocaleString()}</span>
          </button>
          {/* Theme toggle — desktop only */}
          <button onClick={toggleTheme} className="dash-theme-toggle max-desktop:hidden" aria-label={dark ? "Switch to light mode" : "Switch to dark mode"} style={{ background: dark ? "rgba(99,102,241,.28)" : "rgba(0,0,0,.12)", border: `0.5px solid ${dark ? "rgba(99,102,241,.24)" : "rgba(0,0,0,.14)"}` }}>
            <div className="dash-theme-thumb" style={{ background: dark ? "#1e1b4b" : "#fff", left: dark ? 23 : 3, boxShadow: dark ? "0 0 6px rgba(99,102,241,.3)" : "0 1px 4px rgba(0,0,0,.15)" }}>
              {dark
                ? <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#a5b4fc" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/></svg>
                : <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
              }
            </div>
          </button>
          {/* Support — mobile/tablet only (replaces theme toggle) */}
          <button onClick={() => { if (socialLinks.social_whatsapp_support) { window.open(`https://wa.me/${socialLinks.social_whatsapp_support.replace(/\D/g, "")}?text=${encodeURIComponent("Hi Nitro, I need help")}`, "_blank"); } }} className="hidden max-desktop:flex items-center gap-1 h-[30px] px-2.5 rounded-[8px] cursor-pointer border-none relative" aria-label="Support" style={{ background: dark ? "rgba(196,125,142,.12)" : "rgba(196,125,142,.08)", color: t.accent }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
            <span className="text-[11px] font-semibold">Help</span>
          </button>
          {/* Notification bell */}
          <div ref={notifRef} className="relative">
            <button onClick={() => setNotifOpen(!notifOpen)} className="dash-bell" aria-label="Notifications" style={{ color: t.textSoft }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></svg>
              {bellUnread > 0 && <div className="dash-bell-badge">{bellUnread > 10 ? "10+" : bellUnread}</div>}
            </button>
            {notifOpen && <NotifDropdown items={notifItems} dark={dark} t={t} onClose={() => setNotifOpen(false)} readIds={readNotifIds} setReadIds={setReadNotifIds} clearedIds={clearedNotifIds} setClearedIds={setClearedNotifIds} setClearedAt={setNotifClearedAt} readAllAt={notifReadAllAt} setReadAllAt={setNotifReadAllAt} onNavigate={setActive} />}
          </div>
          {/* Avatar → Settings */}
          <button onClick={() => { setActive("settings"); setLeftOpen(false); }} className="dash-avatar-btn" aria-label="Profile">
            <Avatar size={30} rounded={10} />
          </button>
        </div>
      </nav>

      {/* ═══ BODY ═══ */}
      <div className="dash-body">

        {/* ── LEFT SIDEBAR ── */}
        <aside className="dash-left" style={{ background: t.sidebarBg, borderRight: `0.5px solid ${t.sidebarBorder}`, left: leftOpen ? 0 : undefined }}>

            {/* ── Nav items — grouped on desktop, flat on mobile ── */}
            <>
              {NAV_ITEMS.map((item, i) => {
                const processingCount = item.id === "orders" ? orders.filter(o => o.status === "Processing" || o.status === "Pending").length : 0;
                const isSupportItem = item.id === "support";
                const isActive = active === item.id;
                return (
                  <Fragment key={item.id}>
                    {(item.id === "leaderboard" || item.id === "audit") && <div className="dash-sidebar-divider max-desktop:hidden my-1" style={{ background: t.sidebarBorder }} />}
                    <button data-nav={item.id} onClick={() => { if (item.soon) return; if (isSupportItem && socialLinks.social_whatsapp_support) { window.open(`https://wa.me/${socialLinks.social_whatsapp_support.replace(/\D/g, "")}?text=${encodeURIComponent("Hi Nitro, I need help")}`, "_blank"); setLeftOpen(false); return; } setActive(item.id); setLeftOpen(false); }} className="dash-nav-item" style={{ background: isActive ? (dark ? "rgba(196,125,142,.12)" : "rgba(196,125,142,.08)") : isSupportItem ? (dark ? "rgba(196,125,142,.06)" : "rgba(196,125,142,.04)") : "transparent", color: item.soon ? t.textMuted : (isActive ? t.accent : isSupportItem ? t.accent : t.textSoft), fontWeight: isActive || isSupportItem ? 600 : 450, opacity: item.soon ? 0.5 : 1, cursor: item.soon ? "default" : "pointer" }}>
                      <span className="shrink-0" style={{ opacity: isActive || isSupportItem ? 1 : .55, color: isActive || isSupportItem ? t.accent : t.textMuted }}>{I[item.id]}</span>
                      {item.label}
                      {item.soon && <span className="text-[9px] font-bold uppercase tracking-[0.5px] py-[1px] px-1.5 rounded-[4px] ml-auto" style={{ background: dark ? "rgba(196,125,142,.15)" : "rgba(196,125,142,.1)", color: t.accent, opacity: 1 }}>Soon</span>}
                      {processingCount > 0 && <span className="m dash-nav-badge">{processingCount > 99 ? "99+" : processingCount}</span>}
                    </button>
                  </Fragment>
                );
              })}
            </>

          <div className="flex-1" />
          <div className="dash-sidebar-divider" style={{ background: t.sidebarBorder }} />
          <div className="dash-sidebar-social">
            <div className="dash-social-btns">
              <a href={`https://instagram.com/${(socialLinks.social_instagram || "Nitro.ng").replace(/^(https?:\/\/)?(www\.)?(instagram\.com)\/?/i,"").replace(/^@/,"").replace(/\/$/,"")}`} target="_blank" rel="noopener noreferrer" className="dash-social-btn" title="Instagram" style={{ color: "#c47d8e" }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><rect x="2" y="2" width="20" height="20" rx="5"/><path d="M16 11.37A4 4 0 1112.63 8 4 4 0 0116 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/></svg>
              </a>
              <a href={`https://x.com/${(socialLinks.social_twitter || "TheNitroNG").replace(/^(https?:\/\/)?(www\.)?(x\.com|twitter\.com)\/?/i,"").replace(/^@/,"").replace(/\/$/,"")}`} target="_blank" rel="noopener noreferrer" className="dash-social-btn" title="X (Twitter)" style={{ color: dark ? "rgba(255,255,255,.6)" : "rgba(0,0,0,.5)" }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
              </a>
              {socialLinks.social_whatsapp_support && <a href={`https://wa.me/${socialLinks.social_whatsapp_support.replace(/\D/g,"")}`} target="_blank" rel="noopener noreferrer" className="dash-social-btn" title="WhatsApp" style={{ color: "#25d366" }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
              </a>}
              {socialLinks.social_telegram_support && <a href={`https://t.me/${socialLinks.social_telegram_support.replace(/^(https?:\/\/)?(t\.me\/)?@?/,"")}`} target="_blank" rel="noopener noreferrer" className="dash-social-btn" title="Telegram" style={{ color: "#0088cc" }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M11.944 0A12 12 0 000 12a12 12 0 0012 12 12 12 0 0012-12A12 12 0 0012 0a12 12 0 00-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 01.171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.479.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/></svg>
              </a>}
            </div>
          </div>
          <div className="dash-sidebar-divider" style={{ background: t.sidebarBorder }} />
          <button onClick={handleLogout} className="dash-logout">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
            Log Out
          </button>
        </aside>

        {/* Overlay */}
        {leftOpen && <div className="dash-overlay" onClick={() => setLeftOpen(false)} />}

        {/* ── MAIN ── */}
        <main className="dash-main" style={{ background: t.bg, ...(isSupport ? { overflow: "hidden" } : {}) }}>
          <AnnouncementBanner alerts={alerts} dark={dark} mode="dashboard" />
          {activePromotion && (
            <div className="mb-3 rounded-xl px-4 py-2.5 flex items-center gap-2.5" style={{ background: activePromotion.bannerColor ? `${activePromotion.bannerColor}22` : (dark ? 'rgba(16,185,129,.12)' : 'rgba(16,185,129,.08)'), border: `1px solid ${activePromotion.bannerColor || '#10b981'}44` }}>
              <span className="w-2 h-2 rounded-full shrink-0 animate-pulse" style={{ background: activePromotion.bannerColor || '#10b981' }} />
              <span className="text-sm font-medium flex-1" style={{ color: t.text }}>{activePromotion.bannerCopy}</span>
              <span className="px-2.5 py-1 rounded-lg text-xs font-bold shrink-0 m text-center" style={{ background: activePromotion.bannerColor || '#10b981', color: '#fff' }}>{activePromotion.discountPercent}% OFF{activePromotion.maxDiscountPerOrder ? <><br /><span className="font-medium opacity-90" style={{ fontSize: 10 }}>up to ₦{(activePromotion.maxDiscountPerOrder / 100).toLocaleString()}</span></> : ''}</span>
            </div>
          )}
          {!isServices && !isOrders && !isReferrals && !isSettings && !isSupport && !isAddFunds && !isGuide && !isLeaderboard && !isAudit && !isCleanup && !isEarn && <div className="pb-6 max-md:pb-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xl max-md:text-lg font-semibold mb-0.5" style={{ color: t.text }}>Welcome back, {firstName}</div>
                <div className="text-sm" style={{ color: t.textMuted }}>{orders.length === 0 ? "Place your first order in under a minute." : "Here's your dashboard at a glance."}</div>
              </div>
              <div className="shrink-0 ml-4 py-1.5 px-3 max-md:py-1 max-md:px-2.5 rounded-xl text-right" style={{ background: dark ? "rgba(255,255,255,.09)" : "rgba(255,255,255,.85)", border: `1px solid ${dark ? "rgba(255,255,255,.12)" : "rgba(0,0,0,.08)"}` }}>
                <div className="text-[10px] uppercase tracking-[1px] mb-0.5" style={{ color: t.textMuted }}>Balance</div>
                <div className="m text-lg max-md:text-base font-semibold" style={{ color: t.green }}>{fN(user?.balance || 0)}</div>
              </div>
            </div>
            <div className="page-divider" style={{ background: t.cardBorder }} />
          </div>}
          {isAudit && <div className="pb-3.5 max-md:pb-2">
            <div className="text-xl max-md:text-lg font-semibold mb-0.5" style={{ color: t.text }}>Audit</div>
            <div className="text-sm" style={{ color: t.textMuted }}>Deep analytics and insights for your social accounts</div>
            <div className="page-divider" style={{ background: t.cardBorder }} />
          </div>}
          {isCleanup && <div className="pb-3.5 max-md:pb-2">
            <div className="text-xl max-md:text-lg font-semibold mb-0.5" style={{ color: t.text }}>Cleanup</div>
            <div className="text-sm" style={{ color: t.textMuted }}>Remove ghost followers, non-followers, and inactive accounts</div>
            <div className="page-divider" style={{ background: t.cardBorder }} />
          </div>}

          <div key={active} className="dash-page-enter" style={isSupport ? { flex: 1, display: "flex", flexDirection: "column", minHeight: 0, overflow: "hidden" } : undefined}>
            {renderPage()}
          </div>

        </main>

        {/* ── RIGHT SIDEBAR ── */}
        <aside className="dash-right" style={{ background: t.sidebarBg, borderLeft: `0.5px solid ${t.sidebarBorder}` }}>
          {isServices ? (
            <ServicesSidebar dark={dark} t={t} />
          ) : isOrders ? (
            <OrdersSidebar orders={orders} dark={dark} t={t} />
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
            <><TierPerksCard dark={dark} t={t} /><LeaderboardCard dark={dark} t={t} /></>
          ) : isAudit ? (
            <>
              <div className="text-[13px] font-semibold uppercase tracking-[1.5px] mb-2.5 py-2 px-3 rounded-lg" style={{ color: t.textMuted, background: dark ? "rgba(196,125,142,.18)" : "rgba(196,125,142,.12)" }}>What you'll get</div>
              {[["Follower quality score", "See how many real vs ghost followers you have"],["Engagement rate", "Your true engagement compared to your follower count"],["Best posting times", "When your audience is most active"],["Growth trends", "Track follower gains and losses over time"]].map(([title, desc]) => (
                <div key={title} className="py-2.5 px-3 rounded-lg mb-1.5" style={{ background: dark ? "rgba(255,255,255,.07)" : "rgba(0,0,0,.02)" }}>
                  <div className="text-sm font-medium mb-0.5" style={{ color: t.text }}>{title}</div>
                  <div className="text-xs" style={{ color: t.textMuted }}>{desc}</div>
                </div>
              ))}
            </>
          ) : isCleanup ? (
            <>
              <div className="text-[13px] font-semibold uppercase tracking-[1.5px] mb-2.5 py-2 px-3 rounded-lg" style={{ color: t.textMuted, background: dark ? "rgba(196,125,142,.18)" : "rgba(196,125,142,.12)" }}>Cleanup tools</div>
              {[["Ghost followers", "Remove inactive accounts that never engage"],["Non-followers", "Unfollow people who don't follow you back"],["Mass unfollow", "Bulk unfollow with filters and safety limits"],["Inactive accounts", "Detect and remove accounts that haven't posted in months"]].map(([title, desc]) => (
                <div key={title} className="py-2.5 px-3 rounded-lg mb-1.5" style={{ background: dark ? "rgba(255,255,255,.07)" : "rgba(0,0,0,.02)" }}>
                  <div className="text-sm font-medium mb-0.5" style={{ color: t.text }}>{title}</div>
                  <div className="text-xs" style={{ color: t.textMuted }}>{desc}</div>
                </div>
              ))}
            </>
          ) : (
            <RightSidebar orders={orders} user={user} dark={dark} t={t} setActive={setActive} />
          )}
        </aside>
      </div>

      {/* ═══ TOUR GUIDE ═══ */}
      {showOrderTour && <OrderTour dark={dark} onComplete={() => setShowOrderTour(false)} setSelSvc={setNoSelSvc} setSelTier={setNoSelTier} setQty={setNoQty} />}

      {/* ═══ MOBILE BOTTOM NAV ═══ */}
      {moreOpen && <div className="dash-more-overlay" onClick={() => setMoreOpen(false)} />}
      {moreOpen && (
        <div className="dash-more-popup" style={{ background: dark ? "#161b2e" : "#fff", border: `1.5px solid ${dark ? "rgba(196,125,142,.31)" : "rgba(196,125,142,.28)"}` }}>
          {MORE_ITEMS.map(item => {
            if (item.id === "logout") {
              return (
                <button key={item.id} onClick={() => { setMoreOpen(false); handleLogout(); }} className="dash-more-item" style={{ background: dark ? "rgba(220,38,38,.06)" : "rgba(220,38,38,.03)", color: dark ? "#fca5a5" : "#dc2626", fontWeight: 500 }}>
                  <div className="dash-more-item-icon" style={{ background: dark ? "rgba(220,38,38,.1)" : "rgba(220,38,38,.06)", color: dark ? "#fca5a5" : "#dc2626" }}>{I[item.id]}</div>
                  {item.label}
                </button>
              );
            }
            return (
              <button key={item.id} onClick={() => { if (item.soon) return; setActive(item.id); setMoreOpen(false); }} className="dash-more-item" style={{ background: active === item.id ? (dark ? "rgba(196,125,142,.08)" : "rgba(196,125,142,.04)") : (dark ? "rgba(255,255,255,.05)" : "rgba(0,0,0,.02)"), color: item.soon ? (dark ? "rgba(255,255,255,.35)" : "rgba(0,0,0,.35)") : (active === item.id ? t.accent : (dark ? "rgba(255,255,255,.6)" : "rgba(0,0,0,.6)")), fontWeight: active === item.id ? 600 : 500, cursor: item.soon ? "default" : "pointer", borderColor: item.soon ? "transparent" : undefined }}>
                <div className="dash-more-item-icon" style={{ background: item.soon ? (dark ? "rgba(255,255,255,.05)" : "rgba(0,0,0,.02)") : (active === item.id ? (dark ? "rgba(196,125,142,.12)" : "rgba(196,125,142,.08)") : (dark ? "rgba(255,255,255,.08)" : "rgba(0,0,0,.04)")), color: item.soon ? (dark ? "rgba(255,255,255,.3)" : "rgba(0,0,0,.3)") : (active === item.id ? t.accent : (dark ? "rgba(255,255,255,.55)" : "rgba(0,0,0,.5)")) }}>{I[item.id]}</div>
                {item.label}
                {item.soon && <span className="text-[9px] font-bold uppercase tracking-[0.5px] py-[1px] px-1.5 rounded-[4px] ml-auto" style={{ background: dark ? "rgba(196,125,142,.15)" : "rgba(196,125,142,.1)", color: t.accent }}>Soon</span>}
              </button>
            );
          })}
          <div className="w-full flex items-center justify-center gap-3 mt-1.5 pt-2" style={{ borderTop: `1px solid ${dark ? "rgba(255,255,255,.16)" : "rgba(0,0,0,.12)"}` }}>
            <a href={`https://instagram.com/${(socialLinks.social_instagram || "Nitro.ng").replace(/^(https?:\/\/)?(www\.)?(instagram\.com)\/?/i,"").replace(/^@/,"").replace(/\/$/,"")}`} target="_blank" rel="noopener noreferrer" aria-label="Instagram" className="w-9 h-9 rounded-[10px] flex items-center justify-center" style={{ background: dark ? "rgba(255,255,255,.08)" : "rgba(0,0,0,.04)", color: "#E1306C" }}>{I.instagram}</a>
            <div className="w-px h-5 shrink-0" style={{ background: dark ? "rgba(255,255,255,.14)" : "rgba(0,0,0,.08)" }} />
            <a href={`https://x.com/${(socialLinks.social_twitter || "TheNitroNG").replace(/^(https?:\/\/)?(www\.)?(x\.com|twitter\.com)\/?/i,"").replace(/^@/,"").replace(/\/$/,"")}`} target="_blank" rel="noopener noreferrer" aria-label="X" className="w-9 h-9 rounded-[10px] flex items-center justify-center" style={{ background: dark ? "rgba(255,255,255,.08)" : "rgba(0,0,0,.04)", color: dark ? "rgba(255,255,255,.6)" : "rgba(0,0,0,.4)" }}>{I.x}</a>
            {socialLinks.social_whatsapp_support && <><div className="w-px h-5 shrink-0" style={{ background: dark ? "rgba(255,255,255,.14)" : "rgba(0,0,0,.08)" }} /><a href={`https://wa.me/${socialLinks.social_whatsapp_support.replace(/\D/g,"")}`} target="_blank" rel="noopener noreferrer" aria-label="WhatsApp" className="w-9 h-9 rounded-[10px] flex items-center justify-center" style={{ background: dark ? "rgba(255,255,255,.08)" : "rgba(0,0,0,.04)", color: "#25d366" }}><svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg></a></>}
            {socialLinks.social_telegram_support && <><div className="w-px h-5 shrink-0" style={{ background: dark ? "rgba(255,255,255,.14)" : "rgba(0,0,0,.08)" }} /><a href={`https://t.me/${socialLinks.social_telegram_support.replace(/^(https?:\/\/)?(t\.me\/)?@?/,"")}`} target="_blank" rel="noopener noreferrer" aria-label="Telegram" className="w-9 h-9 rounded-[10px] flex items-center justify-center" style={{ background: dark ? "rgba(255,255,255,.08)" : "rgba(0,0,0,.04)", color: "#0088cc" }}><svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M11.944 0A12 12 0 000 12a12 12 0 0012 12 12 12 0 0012-12A12 12 0 0012 0a12 12 0 00-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 01.171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.479.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/></svg></a></>}
          </div>
        </div>
      )}
      <nav ref={bottomNavRef} className={`dash-bottom-nav ${dark ? "dark" : "light"}`} style={{ background: dark ? "#0a0e1a" : "#f8f5f1", borderTop: `1.5px solid ${dark ? "rgba(255,255,255,.24)" : "rgba(0,0,0,.24)"}` }}>
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

      {/* ToS re-acceptance modal */}
      {currentTosVersion && user && user.tosVersion !== currentTosVersion && (
        <div style={{ position: "fixed", inset: 0, zIndex: 99999, background: "rgba(0,0,0,.6)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div style={{ background: t.cardBg, borderRadius: 16, padding: "32px 28px", maxWidth: 420, width: "100%", boxShadow: "0 20px 60px rgba(0,0,0,.3)" }}>
            <div style={{ textAlign: "center", marginBottom: 20 }}>
              <div style={{ width: 48, height: 48, borderRadius: 14, background: `linear-gradient(135deg, ${t.accent}, ${dark ? "#6b3a4a" : "#8b5e6b"})`, display: "inline-flex", alignItems: "center", justifyContent: "center" }}><svg width="22" height="24" viewBox="0 0 1601 1785" fill="#fff"><path d="M1600.82 160.089V1313c-.85 53.13-10.35 104.17-27.19 151.74-48.19 136.54-156.38 244.73-292.92 292.92-50.12 17.76-103.94 27.34-160.08 27.34 0 0-79.39 0-160.01-27.34-85.1-28.88-155.38-85.49-208.28-141.55-72.59-76.84-112.13-179.09-112.13-284.74V1023.4v-3.08-12.9c.08-1.39.08-2.7.08-4.17 0-1.39 0-2.7-.08-4.09-2.08-84.64-69.97-153.06-154.53-155.84-1.85-.08-3.71-.15-5.48-.15-1.78 0-3.71.08-5.48.15-84.56 2.78-152.44 71.2-154.61 155.84-.08 1.39-.08 2.7-.08 4.09 0 1.47 0 2.78.08 4.17v534.87c0 88.42-71.67 160.09-160.09 160.09-44.17 0-84.25-17.92-113.21-46.88C17.92 1626.84 0 1586.76 0 1542.59V995.288c.927-53.132 10.426-104.178 27.261-151.672C75.45 707.003 183.643 598.81 320.179 550.621c50.119-17.685 103.946-27.338 160.089-27.338 0 0 79.388 0 160.012 27.338 85.103 28.882 155.379 85.489 208.278 141.555 72.593 76.84 112.132 179.087 112.132 284.732v307.972l-.077.92v12.89c-.077 1.39-.077 2.78-.077 4.17 0 1.39 0 2.7.077 4.17 2.085 84.64 69.967 152.99 154.527 155.84 1.86 0 3.71 0 5.49 0 1.77 0 3.7 0 5.48 0 84.56-2.85 152.44-71.2 154.6-155.84V160.089C1280.71 71.666 1352.38 0 1440.8 0c44.18 0 84.18 17.916 113.14 46.876 28.96 28.96 46.88 69.04 46.88 113.213z"/></svg></div>
            </div>
            <h2 style={{ fontSize: 18, fontWeight: 600, color: t.text, textAlign: "center", margin: "0 0 8px" }}>We've updated our Terms</h2>
            <p style={{ fontSize: 13, color: t.textMuted, textAlign: "center", margin: "0 0 20px", lineHeight: 1.6 }}>
              Our Terms of Service and Privacy Policy have been updated. Please review and accept to continue using Nitro.
            </p>
            <div style={{ display: "flex", gap: 12, justifyContent: "center", marginBottom: 20 }}>
              <a href="/terms" target="_blank" rel="noopener" style={{ fontSize: 13, color: t.accent, textDecoration: "none", fontWeight: 500 }}>Terms of Service ↗</a>
              <a href="/privacy" target="_blank" rel="noopener" style={{ fontSize: 13, color: t.accent, textDecoration: "none", fontWeight: 500 }}>Privacy Policy ↗</a>
            </div>
            <label style={{ display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer", marginBottom: 20, padding: "12px 14px", borderRadius: 10, background: dark ? "rgba(255,255,255,.07)" : "rgba(0,0,0,.03)" }}>
              <input type="checkbox" checked={tosChecked} onChange={e => setTosChecked(e.target.checked)} aria-label="Agree to updated terms" style={{ marginTop: 2, accentColor: t.accent }} />
              <span style={{ fontSize: 13, color: t.text, lineHeight: 1.5 }}>I have read and agree to the updated Terms of Service and Privacy Policy</span>
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
              style={{
                width: "100%", padding: "12px 0", borderRadius: 10, border: "none", cursor: tosChecked && !tosAccepting ? "pointer" : "default",
                background: tosChecked ? t.accent : dark ? "rgba(255,255,255,.12)" : "rgba(0,0,0,.08)",
                color: tosChecked ? "#fff" : t.textMuted, fontSize: 14, fontWeight: 600, fontFamily: "inherit",
                opacity: tosAccepting ? 0.7 : 1, transition: "all .2s",
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
