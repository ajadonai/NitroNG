'use client';
import { useState, useEffect, useMemo, useRef } from "react";
import { RailSec, RailCard, RailRow, RailLink, RailEmpty, RailLegend } from "./rail";
import dynamic from "next/dynamic";
import { ThemeProvider, useTheme, ThemeToggle } from "./shared-nav";
import { NitroWordmark } from "./nitro-logo";
import { ToastProvider } from "./toast";
import { ConfirmProvider } from "./confirm-dialog";
import AnnouncementBanner from "./announcement-banner";
import { fN, fD } from "../lib/format";
import { SITE } from "../lib/site";
import { PlatformIcon } from "./platform-icon";
import { Avatar } from "./avatar";
import { useToast } from "./toast";
import NitroLoader from "./nitro-loader";
import { useSessionHeartbeat } from "../lib/use-session-heartbeat";

const AdminOrdersPage = dynamic(() => import("./admin-orders"), { ssr: false });
const AdminUsersPage = dynamic(() => import("./admin-users"), { ssr: false });
const AdminTicketsPage = dynamic(() => import("./admin-tickets"), { ssr: false });
const AdminServicesPage = dynamic(() => import("./admin-services"), { ssr: false });
const AdminServiceGroupsPage = dynamic(() => import("./admin-service-groups"), { ssr: false });
const AdminPricingPage = dynamic(() => import("./admin-pricing"), { ssr: false });
const AdminPriceChangesPage = dynamic(() => import("./admin-price-changes").then(m => m.AdminPriceChangesPage), { ssr: false });
const AdminPaymentsPage = dynamic(() => import("./admin-pages").then(m => m.AdminPaymentsPage), { ssr: false });
const AdminFinancePage = dynamic(() => import("./admin-pages").then(m => m.AdminFinancePage), { ssr: false });
const AdminAlertsPage = dynamic(() => import("./admin-alerts-page").then(m => m.AdminAlertsPage), { ssr: false });
const AdminSettingsPage = dynamic(() => import("./admin-settings-page").then(m => m.AdminSettingsPage), { ssr: false });
const AdminActivityPage = dynamic(() => import("./admin-extra-pages").then(m => m.AdminActivityPage), { ssr: false });
const AdminTeamPage = dynamic(() => import("./admin-extra-pages").then(m => m.AdminTeamPage), { ssr: false });
const AdminCouponsPage = dynamic(() => import("./admin-extra-pages").then(m => m.AdminCouponsPage), { ssr: false });
const AdminNotificationsPage = dynamic(() => import("./admin-extra-pages").then(m => m.AdminNotificationsPage), { ssr: false });
const AdminMaintenancePage = dynamic(() => import("./admin-extra-pages").then(m => m.AdminMaintenancePage), { ssr: false });
const AdminAPIPage = dynamic(() => import("./admin-extra-pages").then(m => m.AdminAPIPage), { ssr: false });
const AdminAcquisitionPage = dynamic(() => import("./admin-extra-pages").then(m => m.AdminAcquisitionPage), { ssr: false });
const AdminIssuesPage = dynamic(() => import("./admin-extra-pages").then(m => m.AdminIssuesPage), { ssr: false });
const AdminChangelogPage = dynamic(() => import("./admin-extra-pages").then(m => m.AdminChangelogPage), { ssr: false });
const AdminCreateOrderPage = dynamic(() => import("./admin-create-order-page").then(m => m.AdminCreateOrderPage), { ssr: false });
const AdminRefillsPage = dynamic(() => import("./admin-refills"), { ssr: false });
const AdminResellersPage = dynamic(() => import("./admin-resellers"), { ssr: false });
const AdminCrewPage = dynamic(() => import("./admin-crew").then(m => m.AdminCrewPage), { ssr: false });
const AdminBlogPage = dynamic(() => import("./admin-blog"), { ssr: false });
const AdminPromotionsPage = dynamic(() => import("./admin-promotions"), { ssr: false });
const AdminTasksPage = dynamic(() => import("./admin-tasks"), { ssr: false });
const AdminLeaderboardPage = dynamic(() => import("./admin-leaderboard"), { ssr: false });
const AdminOutreachPage = dynamic(() => import("./admin-outreach"), { ssr: false });
const AdminLeaderboardSidebar = dynamic(() => import("./admin-leaderboard").then(m => m.AdminLeaderboardSidebar), { ssr: false });

/* ═══════════════════════════════════════════ */
/* ═══ HELPERS                             ═══ */
/* ═══════════════════════════════════════════ */
function ToastBridge({ toastRef }) { toastRef.current = useToast(); return null; }

/* ═══════════════════════════════════════════ */
/* ═══ NAV CONFIG                          ═══ */
/* ═══════════════════════════════════════════ */
const ADMIN_NAV = [
  { section: "Operations", items: [
    { id: "overview", label: "Overview", icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg> },
    { id: "orders", label: "Orders", icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>, badge: 'orders' },
    { id: "create-order", label: "Create Order", icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> },
    { id: "refills", label: "Refills", icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg> , badge: 'refills' },
    { id: "users", label: "Users", icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg> },
    { id: "resellers", label: "Resellers", icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l1.5-5h15L21 9"/><path d="M3 9h18v11a1 1 0 01-1 1H4a1 1 0 01-1-1z"/><path d="M9 13h6"/></svg> },
    { id: "leaderboard", label: "Leaderboard", icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M8 21V12H2v9h6zM22 21V8h-6v13h6zM15 21V4H9v17h6z"/></svg> },
    { id: "tickets", label: "Support", icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>, badge: 'tickets' },
  ]},
  { section: "Catalog", items: [
    { id: "menu-builder", label: "Menu Builder", icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg> },
    { id: "services", label: "Raw Services", icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg> },
    { id: "pricing", label: "Pricing", icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg> },
    { id: "price-changes", label: "Price Changes", icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg> },
  ]},
  { section: "Marketing", items: [
    { id: "promotions", label: "Promotions", icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg> },
    { id: "blog", label: "Blog", icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/></svg> },
    { id: "alerts", label: "Announcements", icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></svg> },
    { id: "notifications", label: "Email Blasts", icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 17H2a3 3 0 003-3V9a7 7 0 0114 0v5a3 3 0 003 3zm-8.27 4a2 2 0 01-3.46 0"/></svg> },
    { id: "rewards", label: "Rewards", icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 12v10H4V12"/><path d="M2 7h20v5H2z"/><path d="M12 22V7"/><path d="M12 7H7.5a2.5 2.5 0 010-5C11 2 12 7 12 7z"/><path d="M12 7h4.5a2.5 2.5 0 000-5C13 2 12 7 12 7z"/></svg> },
    { id: "tasks", label: "Tasks", icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg>, badge: 'tasks' },
    { id: "acquisition", label: "Tracking Links", icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/></svg> },
    { id: "outreach", label: "Outreach", icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4 20-7z"/></svg> },
    { id: "crew", label: "Pit", icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg> },
    { id: "changelog", label: "Changelog", icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 8v4l3 3"/><circle cx="12" cy="12" r="10"/></svg> },
  ]},
  { section: "System", items: [
    { id: "payments", label: "Payments", icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>, badge: 'payments' },
    { id: "finance", label: "Finance", icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg> },
    { id: "activity", label: "Logs", icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg> },
    { id: "team", label: "Team", icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a3 3 0 00-3 3v1a3 3 0 006 0V5a3 3 0 00-3-3z"/><path d="M19 8a2 2 0 00-2 2v1a2 2 0 004 0v-1a2 2 0 00-2-2z"/><path d="M5 8a2 2 0 00-2 2v1a2 2 0 004 0v-1a2 2 0 00-2-2z"/><path d="M3 21v-2a4 4 0 014-4h1"/><path d="M21 21v-2a4 4 0 00-4-4h-1"/><path d="M8 21v-2a4 4 0 014-4 4 4 0 014 4v2"/></svg> },
    { id: "issues", label: "Issues", icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>, badge: 'issues' },
    { id: "api", label: "Providers", icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg> },
    { id: "maintenance", label: "Maintenance", icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z"/></svg> },
    { id: "settings", label: "Settings", icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z"/></svg> },
  ]},
];

/* ═══════════════════════════════════════════ */
/* ═══ ADMIN OVERVIEW                      ═══ */
/* ═══════════════════════════════════════════ */
function AdminOverview({ data, dark, t, setActive, openOrders }) {
  const { stats, recentOrders, recentUsers, activity } = data;
  const s = stats || {};
  const today = new Date();
  const pct = (a, b) => (b == null || b === 0) ? null : Math.round((a - b) / b * 100);
  const cmp = (a, b, what) => { const d = pct(a, b); if (d == null) return { cls: "", text: `${what} · nothing yesterday` }; return { cls: d >= 0 ? "up" : "dn", text: `${d >= 0 ? "↑" : "↓"} ${Math.abs(d)}% on yesterday · ${what}` }; };
  const sales = cmp(s.revenue || 0, s.revenueYesterday, `${s.ordersToday || 0} order${s.ordersToday === 1 ? "" : "s"}`);
  const deps = cmp(s.deposits || 0, s.depositsYesterday, "deposits");
  const nu = s.newUsersToday || 0, nuY = s.newUsersYesterday;
  const doors = [
    { n: s.pendingManualCount || 0, label: "Deposits to approve", go: () => setActive("payments") },
    { n: s.pendingRefillCount || 0, label: s.pendingRefillCount === 1 ? "Refill waiting" : "Refills waiting", go: () => setActive("refills") },
    { n: s.openIssueCount || 0, label: s.openIssueCount === 1 ? "Open issue" : "Open issues", go: () => setActive("issues") },
    { n: s.pendingDispatchCount || 0, label: "Orders to dispatch", go: () => openOrders("pending") },
    { n: s.partialCount || 0, label: "Partial orders", go: () => openOrders("partial") },
  ];
  const hours = s.ordersByHour || [];
  const maxH = Math.max(1, ...hours.map(h => h.n));
  const peak = hours.reduce((a, b) => (b.n > (a?.n || 0) ? b : a), null);
  const richest = hours.reduce((a, b) => (b.revenue > (a?.revenue || 0) ? b : a), null);
  const nowH = today.getHours();
  const timeOf = (iso) => { const d = new Date(iso); return d.toDateString() === today.toDateString() ? d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) : d.toLocaleDateString("en-GB", { day: "numeric", month: "short" }); };
  const initialsOf = (n) => (n || "?").replace(/\s*\(TG\)\s*$/, "").split(/\s+/).map(w => w[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();
  const PF = { tiktok: "TT", instagram: "IG", youtube: "YT", facebook: "FB", twitter: "X", x: "X", telegram: "TG", discord: "DC", spotify: "SP", threads: "TH", snapchat: "SC", linkedin: "LI", website: "WEB", traffic: "WEB" };
  const okStatus = (st) => st === "Completed" ? "ok" : st === "Cancelled" || st === "Failed" ? "bad" : "warn";
  const vars = {
    "--card": dark ? "#171126" : "#ffffff", "--ink": t.text, "--mut": t.textMuted, "--dim": dark ? "#5c6170" : "#a19b93", "--line": t.cardBorder, "--rail": dark ? "rgba(255,255,255,.07)" : "rgba(0,0,0,.06)", "--soft": dark ? "#111634" : "#faf9f7",
    "--ac": t.accent, "--ok": dark ? "#6ee7b7" : "#0a7d54", "--warn": dark ? "#fcd34d" : "#b45309", "--bad": dark ? "#fca5a5" : "#c62828",
  };
  return (
    <div className="ov" style={vars}>
      <style>{OV_CSS}</style>
      <div className="adm-header">
        <div className="adm-header-row">
          <div>
            <div className="adm-title" style={{ color: t.text }}>Overview</div>
            <div className="adm-subtitle" style={{ color: t.textMuted }}>{today.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })} · how today is going.</div>
          </div>
          <span className="ov-live"><i />Live · updates every 20 s</span>
        </div>
        <div className="page-divider" style={{ background: t.cardBorder }} />
      </div>

      <div className="ov-stats">
        <div className="ov-stt"><b className="m">{fN(s.revenue || 0)}</b><span>Sales today</span><i className={sales.cls}>{sales.text}</i></div>
        <div className="ov-stt"><b className="m">{fN(s.deposits || 0)}</b><span>Deposits today</span><i className={deps.cls}>{deps.text}</i></div>
        <div className="ov-stt"><b className="m">{nu}</b><span>New customers</span><i className={nuY == null ? "" : nu >= nuY ? "up" : "dn"}>{nuY == null ? "" : `${nu >= nuY ? "↑" : "↓"} ${nuY} yesterday · `}{(s.users || 0).toLocaleString()} in all</i></div>
        <div className="ov-stt"><b className="m">{s.processing || 0}</b><span>Processing</span><i>{s.pendingDispatchCount || 0} waiting to dispatch · {s.partialCount || 0} partial</i></div>
      </div>

      <div className="ov-needs">
        {doors.map(d => <button key={d.label} type="button" className={"ov-nd" + (d.n > 0 ? " on" : "")} onClick={d.go}><b className="m">{d.n}</b><span>{d.label}</span></button>)}
      </div>

      <section className="ov-card">
        <header><h3>Today by the hour</h3><span className="ov-cnt">{peak && peak.n > 0 ? `orders · busiest at ${String(peak.h).padStart(2, "0")}:00 with ${peak.n}${richest && richest.revenue > 0 ? ` · the ${String(richest.h).padStart(2, "0")}:00 hour brought ${fN(richest.revenue)}` : ""}` : "no orders yet today"}</span></header>
        <div className="ov-chart">
          <div className="ov-hbs">{hours.map(h => <div key={h.h} className={"ov-hb" + (h.h === nowH ? " now" : "") + (peak && h.n === peak.n && h.n > 0 ? " peak" : "")} title={`${String(h.h).padStart(2, "0")}:00 · ${h.n} order${h.n === 1 ? "" : "s"} · ${fN(h.revenue)}`}><i style={{ height: `${h.n ? Math.max(3, Math.round(h.n / maxH * 100)) : 0}%` }} /></div>)}</div>
          <div className="ov-hax m"><span>00</span><span>06</span><span>12</span><span>18</span><span>23</span></div>
        </div>
      </section>

      <div className="ov-cols">
        <section className="ov-card">
          <header><h3>Latest orders</h3><button type="button" className="ov-lnk" onClick={() => setActive("orders")}>All orders ›</button></header>
          <div className="ov-list">
            {(recentOrders || []).length === 0 ? <div className="ov-empty">No orders yet.</div> : (recentOrders || []).slice(0, 6).map(o => (
              <div key={o.id} className="ov-or">
                <span className="ov-pav">{PF[String(o.platform || "").toLowerCase()] || "•"}</span>
                <span className="ov-ot"><b className="m">{o.id}</b><i>{o.user || "user"}</i></span>
                <span className="ov-os"><b>{o.service}{o.tier ? ` · ${o.tier}` : ""}</b><i>{o.batchId ? "part of a batch" : "single order"}</i></span>
                <b className="m ov-oc">{fN(o.charge || 0)}</b>
                <span className="ov-st"><i className={"ov-dot " + okStatus(o.status)} />{o.status}</span>
                <span className="ov-cnt m ov-tm">{o.created ? timeOf(o.created) : ""}</span>
              </div>
            ))}
          </div>
        </section>
        <section className="ov-card">
          <header><h3>New customers</h3><button type="button" className="ov-lnk" onClick={() => setActive("users")}>All users ›</button></header>
          <div className="ov-list">
            {(recentUsers || []).length === 0 ? <div className="ov-empty">No one new yet.</div> : (recentUsers || []).slice(0, 5).map(u => (
              <div key={u.id} className="ov-ur">
                <span className="ov-uav">{initialsOf(u.name)}</span>
                <span className="ov-ut"><b>{u.name}</b><i>{u.orders ? `${u.orders} order${u.orders === 1 ? "" : "s"}` : u.balance ? "funded, no orders yet" : "no orders yet"}</i></span>
                <b className="m">{fN(u.balance || 0)}</b>
                <span className="ov-cnt m ov-tm">{u.created ? timeOf(u.created) : ""}</span>
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className="ov-card">
        <header><h3>What the team did</h3><button type="button" className="ov-lnk" onClick={() => setActive("activity")}>Logs ›</button></header>
        <div className="ov-list">
          {(activity || []).length === 0 ? <div className="ov-empty">Nothing yet today.</div> : (activity || []).slice(0, 6).map((a, i) => (
            <div key={i} className="ov-ar"><span className="ov-cnt m ov-tm">{a.time ? timeOf(a.time) : ""}</span><span className="ov-aav">{initialsOf(a.detail)}</span><b>{(a.detail || "System").replace(/\s*\(TG\)\s*$/, "")}</b><i>{a.action}</i></div>
          ))}
        </div>
      </section>
    </div>
  );
}

const OV_CSS = `
.ov{display:flex;flex-direction:column;gap:14px;color:var(--ink)}
.ov *{box-sizing:border-box}
.ov .m{font-family:'JetBrains Mono',ui-monospace,monospace;font-variant-numeric:tabular-nums}
.ov-live{display:inline-flex;align-items:center;gap:7px;font-size:12px;color:var(--mut);white-space:nowrap}.ov-live i{width:8px;height:8px;border-radius:50%;background:var(--ok);box-shadow:0 0 0 3px rgba(10,125,84,.15)}
.ov-stats{display:grid;grid-template-columns:repeat(4,1fr);background:var(--card);border:1px solid var(--line);border-radius:14px}
.ov-stt{padding:12px 16px;border-left:1px solid var(--line);display:flex;flex-direction:column;min-width:0}.ov-stt:first-child{border-left:0}
.ov-stt b{font-size:20px;font-weight:800;letter-spacing:-.01em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.ov-stt span{font-size:11px;font-weight:700;letter-spacing:.8px;text-transform:uppercase;color:var(--mut);margin-top:2px;white-space:nowrap}.ov-stt i{font-style:normal;font-size:11.5px;color:var(--dim);margin-top:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.ov-stt i.up{color:var(--ok)}.ov-stt i.dn{color:var(--warn)}
.ov-needs{display:grid;grid-template-columns:repeat(5,1fr);gap:10px}
.ov-nd{display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:12px;background:var(--card);border:1px solid var(--line);color:var(--dim);font:inherit;cursor:pointer;text-align:left;transition:transform .15s}.ov-nd:hover{transform:translateY(-1px)}.ov-nd b{font-size:18px;font-weight:800;min-width:28px}.ov-nd span{font-size:12px;font-weight:600}.ov-nd.on{color:var(--ink);border-color:var(--ac)}.ov-nd.on b{color:var(--ac)}
.ov-card{background:var(--card);border:1px solid var(--line);border-radius:14px;overflow:hidden}
.ov-card>header{display:flex;justify-content:space-between;align-items:baseline;gap:10px;padding:11px 16px;border-bottom:1px solid var(--line)}.ov-card h3{margin:0;font-size:11px;letter-spacing:1.2px;text-transform:uppercase;color:var(--mut);font-weight:700}.ov-cnt{font-size:11.5px;color:var(--dim);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ov-lnk{font:inherit;font-size:12px;font-weight:600;color:var(--ac);background:none;border:0;padding:0;cursor:pointer;white-space:nowrap}
.ov-chart{padding:14px 16px 10px}.ov-hbs{display:grid;grid-template-columns:repeat(24,1fr);gap:4px;height:110px;align-items:end}.ov-hb{height:100%;display:flex;align-items:flex-end;border-radius:4px;background:var(--rail)}.ov-hb i{display:block;width:100%;background:var(--ac);border-radius:4px;opacity:.55}.ov-hb.peak i{opacity:1}.ov-hb.now i{opacity:.9;outline:2px solid var(--ink);outline-offset:1px}
.ov-hax{display:flex;justify-content:space-between;font-size:10.5px;color:var(--dim);margin-top:6px}
.ov-cols{display:grid;grid-template-columns:1.25fr 1fr;gap:14px;align-items:start}
.ov-list{display:flex;flex-direction:column}.ov-empty{padding:24px 16px;text-align:center;font-size:13px;color:var(--mut)}
.ov-or{display:grid;grid-template-columns:34px 130px 1fr 72px 100px 44px;align-items:center;gap:10px;padding:10px 16px;border-top:1px solid var(--rail);font-size:13px}.ov-or:first-child{border-top:0}
.ov-pav{width:34px;height:34px;border-radius:10px;background:var(--soft);border:1px solid var(--line);display:inline-flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;color:var(--mut)}
.ov-ot,.ov-os,.ov-ut{display:flex;flex-direction:column;min-width:0}.ov-ot b{font-size:12.5px;font-weight:700}.ov-ot i,.ov-os i,.ov-ut i{font-style:normal;font-size:11.5px;color:var(--dim);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.ov-os b,.ov-ut b{font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.ov-oc{text-align:right;font-weight:700}
.ov-st{display:inline-flex;align-items:center;gap:6px;font-size:12px;font-weight:600;color:var(--mut);white-space:nowrap}.ov-dot{width:8px;height:8px;border-radius:50%;display:inline-block;flex-shrink:0}.ov-dot.ok{background:var(--ok)}.ov-dot.warn{background:var(--warn)}.ov-dot.bad{background:var(--bad)}
.ov-ur{display:grid;grid-template-columns:34px 1fr 80px 44px;align-items:center;gap:10px;padding:10px 16px;border-top:1px solid var(--rail);font-size:13px}.ov-ur:first-child{border-top:0}.ov-uav{width:34px;height:34px;border-radius:50%;background:var(--ac);color:#fff;display:inline-flex;align-items:center;justify-content:center;font-size:12px;font-weight:700}.ov-ur>b{text-align:right;font-weight:700}
.ov-ar{display:grid;grid-template-columns:44px 28px 120px 1fr;align-items:center;gap:10px;padding:9px 16px;border-top:1px solid var(--rail);font-size:13px}.ov-ar:first-child{border-top:0}.ov-aav{width:28px;height:28px;border-radius:50%;background:var(--ac);color:#fff;display:inline-flex;align-items:center;justify-content:center;font-size:10.5px;font-weight:700}.ov-ar b{font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.ov-ar i{font-style:normal;color:var(--mut);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
@media (max-width:900px){
  .ov .adm-header-row{flex-direction:row;align-items:flex-start}.ov-live{font-size:11px}
  .ov-stats{grid-template-columns:1fr 1fr}.ov-stt:nth-child(3){border-left:0}.ov-stt:nth-child(n+3){border-top:1px solid var(--line)}.ov-stt b{font-size:17px}
  .ov-needs{grid-template-columns:1fr 1fr}.ov-nd:last-child{grid-column:1 / -1}
  .ov-hbs{height:90px;gap:2px}.ov-cols{grid-template-columns:1fr}
  .ov-or{grid-template-columns:34px 1fr auto;grid-template-areas:"pav ot oc" "pav os st";gap:2px 10px}.ov-pav{grid-area:pav;align-self:start}.ov-ot{grid-area:ot}.ov-oc{grid-area:oc}.ov-os{grid-area:os}.ov-or .ov-st{grid-area:st;justify-self:end}.ov-or .ov-tm{display:none}
  .ov-ur{grid-template-columns:34px 1fr auto}.ov-ur .ov-tm{display:none}
  .ov-ar{grid-template-columns:28px 1fr auto;grid-template-areas:"av b t" "av i i"}.ov-ar .ov-tm{grid-area:t}.ov-aav{grid-area:av;align-self:start}.ov-ar b{grid-area:b}.ov-ar i{grid-area:i;white-space:normal}
}
`;

function PlaceholderPage({ title, subtitle, dark, t }) {
  return (
    <>
      <div className="adm-header">
        <div className="adm-title text-t-text">{title}</div>
        <div className="adm-subtitle text-t-text-muted">{subtitle}</div>
        <div className="page-divider bg-t-card-border" />
      </div>
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <div className="text-base font-medium text-t-text-muted">Building {title}...</div>
          <div className="text-sm mt-1 text-t-text-muted">This page will be built next</div>
        </div>
      </div>
    </>
  );
}

/* ═══════════════════════════════════════════ */
/* ═══ RIGHT SIDEBAR                       ═══ */
/* ═══════════════════════════════════════════ */
function AdminRightSidebar({ data, dark, t, active, admin, setActive }) {
  const isSensitive = admin?.role === 'owner' || admin?.role === 'superadmin';
  const showProviderColors = isSensitive && ["orders", "services", "menu-builder", "pricing", "finance", "payments"].includes(active);
  const showActivity = !["leaderboard"].includes(active);
  const activityTypeMap = {
    overview: null, orders: ["order"], finance: ["order", "payment", "user"], users: ["user"], blog: ["blog"],
    tickets: ["ticket"], // support moved to WhatsApp — page kept for history
    services: ["service"], "menu-builder": ["service"], pricing: ["service", "settings"], payments: ["payment"], team: ["admin"], coupons: ["coupon"],
    alerts: ["alert"], promotions: ["promotion"], settings: ["settings", "maintenance"], notifications: ["notification"], maintenance: ["maintenance"],
    issues: ["system", "alert"], api: ["settings"], crew: ["crew"], acquisition: ["acquisition"],
  };
  const allowedTypes = activityTypeMap[active] || null;
  const filteredActivity = allowedTypes ? (data.activity || []).filter(a => allowedTypes.includes(a.type)) : (data.activity || []);
  const activityLabel = {
    orders: "Orders, by the team", finance: "Money, by the team", users: "Users, by the team", blog: "Blog activity", tickets: "Ticket activity",
    services: "Catalogue activity", "menu-builder": "Catalogue activity", pricing: "Pricing activity", payments: "Payments, by the team",
    team: "Team changes", coupons: "Coupon activity", alerts: "Notice activity", promotions: "Promotion activity", notifications: "Notification activity", maintenance: "Maintenance activity",
  }[active] || "What the team did";
  const ini = (n) => (n || "S").replace(/\s*\(TG\)\s*$/, "").split(/\s+/).map(w => w[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();
  const when = (iso) => { const d = new Date(iso); return d.toDateString() === new Date().toDateString() ? d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) : d.toLocaleDateString("en-GB", { day: "numeric", month: "short" }); };
  return (
    <div className="rr" style={{ flex: 1, minHeight: 0, overflow: "auto" }}>
      {showActivity && <>
        <RailSec action={<RailLink onClick={() => setActive?.("activity")}>All logs</RailLink>}>{activityLabel}</RailSec>
        <RailCard>
          {filteredActivity.length === 0 ? <RailEmpty>Nothing yet.</RailEmpty> : filteredActivity.slice(0, 6).map((a, i) => (
            <RailRow key={i} tile={ini(a.detail)} round title={(a.detail || "System").replace(/\s*\(TG\)\s*$/, "")} sub={(a.action || "").split("\n")[0]} right={a.time ? when(a.time) : null} />
          ))}
        </RailCard>
      </>}
      {showProviderColors && <>
        <RailSec>Providers</RailSec>
        <RailLegend items={[["MTP", "#ef4444"], ["DAO", "#22c55e"], ["JAP", "#3b82f6"]]} />
      </>}
    </div>
  );
}

/* ═══════════════════════════════════════════ */
/* ═══ MAIN ADMIN SHELL                    ═══ */
/* ═══════════════════════════════════════════ */
const ADMIN_PINS = ["overview", "orders", "users", "create-order"];

export default function AdminDashboard({ initialData }) {
  return <ThemeProvider storageKey="nitro-admin-theme"><AdminDashboardInner initialData={initialData} /></ThemeProvider>;
}

function AdminDashboardInner({ initialData }) {
  useSessionHeartbeat('admin');
  const { dark, setDark, toggleTheme, t: baseT, themeMode, setThemeMode } = useTheme();
  const [active, setActiveRaw] = useState("overview");
  const setActive = (page) => { setActiveRaw(page); try { localStorage.setItem("nitro-admin-page", page); } catch {} };
  useEffect(() => { try { const saved = localStorage.getItem("nitro-admin-page"); if (saved) setActiveRaw(saved); } catch {} }, []);

  const [leftOpen, setLeftOpen] = useState(false);
  // The rail: every section starts folded; one opens at a time (opening another closes the previous).
  // Picking a page inside a section keeps that section open; the pinned tiles and the jump box do not open one.
  const [openSection, setOpenSection] = useState(null);
  const [jump, setJump] = useState("");
  const jumpRef = useRef(null);
  const [ordersPreset, setOrdersPreset] = useState("all");
  const openOrders = (f) => { setOrdersPreset(f); setActive("orders"); };
  useEffect(() => { if (active !== "orders") setOrdersPreset("all"); }, [active]);
  // The avatar drops an account menu on a desktop, like the user side; on a phone it opens Settings.
  const [avOpen, setAvOpen] = useState(false);
  const avRef = useRef(null);
  useEffect(() => {
    if (!avOpen) return;
    const onDown = (e) => { if (avRef.current && !avRef.current.contains(e.target)) setAvOpen(false); };
    const onKey = (e) => { if (e.key === "Escape") setAvOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey); };
  }, [avOpen]);
  const applyThemeMode = (mode) => {
    setThemeMode(mode);
    try { localStorage.setItem("nitro-theme", mode); } catch {}
    if (mode === "day") setDark(false);
    else if (mode === "night") setDark(true);
    else { const h = new Date().getHours(), m = new Date().getMinutes(); setDark(h >= 19 || h < 6 || (h === 6 && m < 30) || (h === 18 && m >= 30)); }
  };
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== "/" || e.metaKey || e.ctrlKey || e.altKey) return;
      const tag = (e.target?.tagName || "").toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select" || e.target?.isContentEditable) return;
      e.preventDefault(); jumpRef.current?.focus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  const [admin, setAdmin] = useState(() => {
    if (!initialData) return null;
    const d = initialData;
    return { name: d.admin?.name || "Admin", role: d.admin?.role || "superadmin", email: d.admin?.email || "", pages: d.admin?.pages || "*", customActions: d.admin?.customActions || null };
  });
  const [data, setData] = useState(() => {
    if (!initialData) return { stats: {}, recentOrders: [], recentUsers: [], openTickets: [], activity: [], unreadTicketCount: 0, pendingManualCount: 0, pendingOrderCount: 0, openIssueCount: 0 };
    const d = initialData;
    return { stats: d, recentOrders: d.recentOrders || [], recentUsers: d.recentUsers || [], openTickets: d.openTickets || [], activity: d.activity || [], unreadTicketCount: d.unreadTicketCount || 0, pendingManualCount: d.pendingManualCount || 0, pendingOrderCount: d.pendingOrderCount || 0, openIssueCount: d.openIssueCount || 0, pendingTaskReviewCount: d.pendingTaskReviewCount || 0 };
  });
  const toastRef = useRef(null);

  /* Theme — provided by ThemeProvider */
  // Sync admin theme preference to server when it changes (skip initial mount)
  const adminThemeSyncRef = useRef(false);
  useEffect(() => {
    if (!adminThemeSyncRef.current) { adminThemeSyncRef.current = true; return; }
    fetch("/api/auth/admin/profile", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "save-theme", themePreference: themeMode }) }).catch(() => {});
  }, [themeMode]);

  /* Data fetch */
  const [redirecting, setRedirecting] = useState(false);
  const [adminAlerts, setAdminAlerts] = useState([]);
  useEffect(() => {
    if (redirecting) return;
    // Fetch admin-targeted alerts
    fetch("/api/admin/alerts/active").then(r => r.ok ? r.json() : { alerts: [] }).then(d => setAdminAlerts(d.alerts || [])).catch(() => {});
    const applyThemePreference = (d) => {
      if (d.admin?.themePreference && d.admin.themePreference !== "auto") {
        const saved = localStorage.getItem("nitro-admin-theme");
        if (!saved || saved === "auto") {
          setThemeMode(d.admin.themePreference);
          setDark(d.admin.themePreference === "night");
          try { localStorage.setItem("nitro-admin-theme", d.admin.themePreference); } catch {}
        }
      }
    };
    async function load() {
      try {
        const res = await fetch("/api/admin/overview");
        if (!res.ok) {
          if (res.status === 401) { setRedirecting(true); window.location.replace("/admin/login"); }
          return;
        }
        const d = await res.json();
        setAdmin({ name: d.admin?.name || "Admin", role: d.admin?.role || "superadmin", email: d.admin?.email || "", pages: d.admin?.pages || "*", customActions: d.admin?.customActions || null });
        setData({
          stats: d || {},
          recentOrders: d.recentOrders || [],
          recentUsers: d.recentUsers || [],
          openTickets: d.openTickets || [],
          activity: d.activity || [],
          unreadTicketCount: d.unreadTicketCount || 0,
          pendingManualCount: d.pendingManualCount || 0,
          pendingOrderCount: d.pendingOrderCount || 0,
          openIssueCount: d.openIssueCount || 0,
          pendingTaskReviewCount: d.pendingTaskReviewCount || 0,
        });
        applyThemePreference(d);
      } catch {
        setAdmin({ name: "Admin", role: "superadmin", email: "" });
      }
    }
    // The server has just loaded the same endpoint for initialData. Avoid an
    // immediate duplicate burst during hydration; retry only when SSR failed.
    if (initialData) applyThemePreference(initialData);
    else load();
  }, [redirecting, initialData]);

  /* ── Admin notification system ── */
  const notifLastPollRef = useRef(null);
  const notifSeenRef = useRef(new Set());
  const staleLastAlertRef = useRef(new Map());
  const origTitleRef = useRef(typeof document !== 'undefined' ? document.title : '');
  const titleFlashRef = useRef(null);
  const [dnd, setDnd] = useState(() => { try { return localStorage.getItem('nitro-admin-dnd') === '1'; } catch { return false; } });
  const [notifPrefs, setNotifPrefs] = useState(() => {
    try {
      const saved = localStorage.getItem('nitro-admin-notif-prefs');
      return saved ? JSON.parse(saved) : { new_ticket: true, ticket_reply: true, deposit: true, large_deposit: true, stale_ticket: true, price_alert: true };
    } catch { return { new_ticket: true, ticket_reply: true, deposit: true, large_deposit: true, stale_ticket: true, price_alert: true }; }
  });

  const toggleDnd = () => {
    setDnd(prev => {
      const next = !prev;
      try { localStorage.setItem('nitro-admin-dnd', next ? '1' : '0'); } catch {}
      if (next) stopTitleFlash();
      return next;
    });
  };
  const updateNotifPref = (key, val) => {
    setNotifPrefs(prev => {
      const next = { ...prev, [key]: val };
      try { localStorage.setItem('nitro-admin-notif-prefs', JSON.stringify(next)); } catch {}
      return next;
    });
  };

  const audioCtxRef = useRef(null);
  useEffect(() => {
    const unlock = () => {
      if (!audioCtxRef.current) audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
      if (audioCtxRef.current.state === 'suspended') audioCtxRef.current.resume();
    };
    window.addEventListener('click', unlock, { once: false });
    window.addEventListener('keydown', unlock, { once: false });
    return () => { window.removeEventListener('click', unlock); window.removeEventListener('keydown', unlock); };
  }, []);

  const playSound = (type) => {
    try {
      if (!audioCtxRef.current) audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') ctx.resume();
      const play = (freq, start, dur, vol = 0.12) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(vol, ctx.currentTime + start);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + dur);
        osc.connect(gain).connect(ctx.destination);
        osc.start(ctx.currentTime + start);
        osc.stop(ctx.currentTime + start + dur);
      };
      if (type === 'new_ticket') { play(880, 0, 0.12); play(1100, 0.1, 0.12); play(1320, 0.2, 0.18); }
      else if (type === 'ticket_reply') { play(660, 0, 0.12); play(880, 0.1, 0.15); }
      else if (type === 'large_deposit') { play(523, 0, 0.1, 0.18); play(659, 0.08, 0.1, 0.18); play(784, 0.16, 0.1, 0.18); play(1047, 0.24, 0.25, 0.18); }
      else if (type === 'deposit') { play(784, 0, 0.1); play(1047, 0.1, 0.15); }
      else if (type === 'pending_deposit') { play(587, 0, 0.1, 0.15); play(740, 0.1, 0.1, 0.15); play(587, 0.2, 0.15, 0.15); }
      else if (type === 'stale_ticket') { play(440, 0, 0.2, 0.18); play(440, 0.3, 0.2, 0.18); play(440, 0.6, 0.3, 0.2); }
      else if (type === 'price_alert') { play(330, 0, 0.15, 0.2); play(262, 0.15, 0.15, 0.2); play(330, 0.3, 0.15, 0.2); play(262, 0.45, 0.25, 0.2); }
    } catch {}
  };

  const titleCountRef = useRef(0);
  const startTitleFlash = () => {
    titleCountRef.current++;
    const update = () => { document.title = `(${titleCountRef.current}) ${origTitleRef.current}`; };
    update();
    if (titleFlashRef.current) return;
    let on = true;
    titleFlashRef.current = setInterval(() => {
      document.title = on ? `(${titleCountRef.current}) ${origTitleRef.current}` : origTitleRef.current;
      on = !on;
    }, 1200);
  };
  const stopTitleFlash = () => {
    titleCountRef.current = 0;
    if (titleFlashRef.current) { clearInterval(titleFlashRef.current); titleFlashRef.current = null; }
    if (typeof document !== 'undefined') document.title = origTitleRef.current;
  };

  useEffect(() => {
    const onFocus = () => stopTitleFlash();
    window.addEventListener('focus', onFocus);
    return () => { window.removeEventListener('focus', onFocus); stopTitleFlash(); };
  }, []);

  const fireNotifRef = useRef(null);
  fireNotifRef.current = (event, toast) => {
    if (dnd) return;
    if (!notifPrefs[event.type]) return;

    const pages = admin?.pages || '';
    const hasPage = (p) => pages === '*' || (Array.isArray(pages) ? pages.includes(p) : String(pages).includes(p));
    if ((event.type === 'new_ticket' || event.type === 'ticket_reply' || event.type === 'stale_ticket') && !hasPage('tickets')) return;
    if ((event.type === 'deposit' || event.type === 'large_deposit' || event.type === 'pending_deposit') && !hasPage('finance') && !hasPage('payments') && !hasPage('overview')) return;
    if (event.type === 'price_alert' && !hasPage('services') && !hasPage('pricing') && !hasPage('overview')) return;

    if (active === 'tickets' && document.hasFocus() && (event.type === 'new_ticket' || event.type === 'ticket_reply' || event.type === 'stale_ticket')) return;

    const key = `${event.type}:${event.id}`;
    if (event.type === 'stale_ticket') {
      const now = Date.now();
      const lastAlert = staleLastAlertRef.current.get(event.id);
      if (lastAlert) {
        const interval = event.minutes >= 30 ? 5 * 60000 : 5 * 60000;
        if (now - lastAlert < interval) return;
      }
      staleLastAlertRef.current.set(event.id, now);
    } else {
      if (notifSeenRef.current.has(key)) return;
      notifSeenRef.current.add(key);
      if (notifSeenRef.current.size > 200) notifSeenRef.current = new Set([...notifSeenRef.current].slice(-100));
    }

    playSound(event.type);

    const labels = {
      new_ticket: { title: 'New ticket dropped', toast: 'warning', body: `${event.user}: ${event.title}` },
      ticket_reply: { title: `${event.user} dey wait o`, toast: 'info', body: event.title },
      deposit: { title: `Money entered ₦${(event.amount / 100).toLocaleString()}`, toast: 'success', body: `${event.user} just funded` },
      large_deposit: { title: `Whale alert ₦${(event.amount / 100).toLocaleString()}`, toast: 'success', body: `${event.user} came correct` },
      pending_deposit: { title: `Approve ₦${(event.amount / 100).toLocaleString()}`, toast: 'warning', body: `${event.user} sent bank transfer` },
      stale_ticket: { title: `${event.user} still waiting (${event.minutes}m)`, toast: 'error', body: `${event.title} — reply now` },
      price_alert: { title: `${event.count} service${event.count > 1 ? 's' : ''} selling below cost`, toast: 'error', body: 'Check Pricing page — you\'re losing money' },
    };
    const l = labels[event.type] || { title: 'Notification', toast: 'info', body: '' };

    if (toast) toast[l.toast](l.title, l.body, { duration: event.type === 'stale_ticket' ? 10000 : 6000 });

    if (!document.hasFocus()) startTitleFlash();

    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      new Notification(l.title, { body: l.body, icon: '/icon-192.png', tag: key });
    }
  };

  useEffect(() => {
    if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  /* Smart polling — refresh data and notifications every 20s */
  useEffect(() => {
    if (redirecting) return;
    let interval = null;
    let inFlight = false;
    const poll = async () => {
      if (document.visibilityState !== 'visible' || inFlight) return;
      inFlight = true;
      try {
        // Overview is intentionally expensive. Refresh it only while that page
        // is visible; other admin pages fetch their own data.
        if (active === 'overview') {
          const res = await fetch("/api/admin/overview");
          if (res.status === 401) { window.location.replace("/admin/login"); return; }
          if (res.ok) {
            const d = await res.json();
            setAdmin(prev => ({ ...prev, name: d.admin?.name || prev.name, role: d.admin?.role || prev.role, pages: d.admin?.pages || prev.pages, customActions: d.admin?.customActions || prev.customActions }));
            setData({
              stats: d || {},
              recentOrders: d.recentOrders || [],
              recentUsers: d.recentUsers || [],
              openTickets: d.openTickets || [],
              activity: d.activity || [],
              unreadTicketCount: d.unreadTicketCount || 0,
              pendingManualCount: d.pendingManualCount || 0,
              pendingOrderCount: d.pendingOrderCount || 0,
              openIssueCount: d.openIssueCount || 0,
              pendingTaskReviewCount: d.pendingTaskReviewCount || 0,
              pendingRefillCount: d.pendingRefillCount || 0,
            });
          }
        } else {
          // Every other page: only the badge counts, so a badge clears once the work is done.
          const br = await fetch("/api/admin/badges");
          if (br.status === 401) { window.location.replace("/admin/login"); return; }
          if (br.ok) { const counts = await br.json(); setData(prev => ({ ...prev, ...counts })); }
        }

        if (notifLastPollRef.current) {
          const nr = await fetch(`/api/admin/notifications/poll?since=${encodeURIComponent(notifLastPollRef.current)}`);
          if (nr.status === 401) { window.location.replace("/admin/login"); return; }
          if (nr.ok) {
            const { events } = await nr.json();
            const grouped = {};
            const singles = [];
            for (const e of events) {
              if (e.type === 'deposit') {
                if (!grouped.deposit) grouped.deposit = { count: 0, total: 0, ids: [] };
                grouped.deposit.count++;
                grouped.deposit.total += e.amount;
                grouped.deposit.ids.push(e.id);
              } else {
                singles.push(e);
              }
            }
            for (const e of singles) fireNotifRef.current?.(e, toastRef.current);
            if (grouped.deposit && grouped.deposit.count > 1) {
              fireNotifRef.current?.({
                type: 'deposit',
                id: grouped.deposit.ids.join(','),
                amount: grouped.deposit.total,
                user: `${grouped.deposit.count} users`,
              }, toastRef.current);
            } else if (grouped.deposit && grouped.deposit.count === 1) {
              const d = events.find(e => e.type === 'deposit');
              if (d) fireNotifRef.current?.(d, toastRef.current);
            }
          }
        }
        notifLastPollRef.current = new Date().toISOString();
      } catch {
        // A later visible poll retries without replacing currently rendered data.
      } finally {
        inFlight = false;
      }
    };
    const start = () => { if (!interval) interval = setInterval(poll, 20000); };
    const stop = () => { clearInterval(interval); interval = null; };
    const onVisibility = () => { if (document.visibilityState === 'visible') poll(); };
    start();
    // Arriving on a page refreshes the counts at once, not on the next tick.
    if (active !== 'overview') poll();
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      stop();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [redirecting, active]);

  const handleLogout = async () => {
    try {
      const res = await fetch("/api/auth/admin/logout", { method: "POST" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toastRef.current?.error("Logout failed", data.error || "Please try again.");
        return;
      }
      window.location.replace("/admin/login?logout=1");
    } catch {
      toastRef.current?.error("Logout failed", "Please check your connection and try again.");
    }
  };

  const t = useMemo(() => ({
    bg: dark ? "#080b14" : "#f4f1ed",
    sidebarBg: dark ? "#120c1e" : "#eceae5",
    sidebarBorder: dark ? "rgba(255,255,255,.18)" : "rgba(0,0,0,.18)",
    cardBg: dark ? "rgba(255,255,255,.07)" : "rgba(255,255,255,.8)",
    cardBorder: dark ? "rgba(255,255,255,.18)" : "rgba(0,0,0,.18)",
    text: dark ? "#f5f3f0" : "#1a1917",
    textSoft: dark ? "#a09b95" : "#555250",
    textMuted: dark ? "#8a8580" : "#757170",
    accent: "#c47d8e",
    navActive: dark ? "rgba(196,125,142,.12)" : "rgba(196,125,142,.08)",
    green: dark ? "#6ee7b7" : "#059669",
    red: dark ? "#fca5a5" : "#dc2626",
    amber: dark ? "#e0a458" : "#d97706",
    blue: dark ? "#a5b4fc" : "#4f46e5",
  }), [dark]);

  const initials = admin ? admin.name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2) : "";

  /* Loading skeleton */
  if (redirecting) return null;
  if (!admin) {
    const skBone = `skel-bone ${dark ? "skel-dark" : "skel-light"}`;
    return (
      <div className="dash-root bg-t-bg">
        <nav className="dash-nav bg-t-sidebar-bg" style={{ borderBottom: `0.5px solid ${t.sidebarBorder}` }}>
          <div className="dash-nav-left"><div className="dash-logo-static"><div className="h-7 px-3 rounded-lg flex items-center justify-center" style={{ background: "linear-gradient(135deg,#c47d8e,#8b5e6b)" }}><NitroWordmark height={12} color="#fff" /></div></div></div>
          <div className="dash-nav-right"><div className={`${skBone} w-[30px] h-[30px] rounded-[10px]`} /></div>
        </nav>
        <div className="dash-body">
          <aside className="dash-left bg-t-sidebar-bg" style={{ borderRight: `0.5px solid ${t.sidebarBorder}` }}>
            {[1,2,3,4,5,6,7,8,9].map(i => <div key={i} className={`${skBone} h-9 rounded-xl mb-1`} />)}
          </aside>
          <main className="dash-main bg-t-bg">
            <div className={`${skBone} w-60 h-6 mb-2`} />
            <div className={`${skBone} w-[180px] h-3.5 mb-6`} />
            <div className="grid grid-cols-5 gap-3">
              {[1,2,3,4,5].map(i => <div key={i} className="p-[18px] rounded-[14px] border border-solid bg-t-card-bg border-t-card-border"><div className={`${skBone} w-[60%] h-2.5 mb-2.5`} /><div className={`${skBone} w-[45%] h-[22px]`} /></div>)}
            </div>
          </main>
          <div className="dash-right bg-t-sidebar-bg" style={{ borderLeft: `0.5px solid ${t.sidebarBorder}` }}>
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

  /* Render page */
  const renderPage = () => {
    const ap = admin?.pages;
    // Guard: if page not in allowed list, fall back to overview
    if (active !== "overview" && ap !== "*" && Array.isArray(ap) && !ap.includes(active)) {
      return <AdminOverview data={data} dark={dark} t={t} setActive={setActive} openOrders={openOrders} />;
    }
    switch (active) {
      case "overview": return <AdminOverview data={data} dark={dark} t={t} setActive={setActive} openOrders={openOrders} />;
      case "orders": return <AdminOrdersPage key={ordersPreset} dark={dark} t={t} admin={admin} initialFilter={ordersPreset} />;
      case "users": return <AdminUsersPage dark={dark} t={t} admin={admin} />;
      case "leaderboard": return <AdminLeaderboardPage dark={dark} t={t} />;
      case "tickets": return <AdminTicketsPage dark={dark} t={t} adminName={admin?.name || "Admin"} />;
      case "services": return <AdminServicesPage dark={dark} t={t} />;
      case "menu-builder": return <AdminServiceGroupsPage dark={dark} t={t} />;
      case "pricing": return <AdminPricingPage dark={dark} t={t} />;
      case "price-changes": return <AdminPriceChangesPage dark={dark} t={t} />;
      case "promotions": return <AdminPromotionsPage dark={dark} t={t} />;
      case "blog": return <AdminBlogPage dark={dark} t={t} />;
      case "payments": return <AdminPaymentsPage dark={dark} t={t} />;
      case "finance": return <AdminFinancePage dark={dark} t={t} admin={admin} />;
      case "alerts": return <AdminAlertsPage dark={dark} t={t} />;
      case "rewards": return <AdminCouponsPage dark={dark} t={t} />;
      case "notifications": return <AdminNotificationsPage dark={dark} t={t} />;
      case "activity": return <AdminActivityPage dark={dark} t={t} />;
      case "team": return <AdminTeamPage admin={admin} dark={dark} t={t} />;
      case "maintenance": return <AdminMaintenancePage dark={dark} t={t} />;
      case "api": return <AdminAPIPage dark={dark} t={t} />;
      case "acquisition": return <AdminAcquisitionPage dark={dark} t={t} />;
      case "outreach": return <AdminOutreachPage dark={dark} t={t} />;
      case "issues": return <AdminIssuesPage dark={dark} t={t} />;
      case "crew": return <AdminCrewPage dark={dark} t={t} />;
      case "tasks": return <AdminTasksPage dark={dark} t={t} />;
      case "changelog": return <AdminChangelogPage dark={dark} t={t} />;
      case "create-order": return <AdminCreateOrderPage dark={dark} t={t} />;
      case "refills": return <AdminRefillsPage dark={dark} t={t} />;
      case "resellers": return <AdminResellersPage dark={dark} t={t} />;
      case "settings": return <AdminSettingsPage admin={admin} dark={dark} t={t} themeMode={themeMode} setThemeMode={setThemeMode} setDark={setDark} onLogout={handleLogout} notifPrefs={notifPrefs} updateNotifPref={updateNotifPref} />;
      default: return <AdminOverview data={data} dark={dark} t={t} setActive={setActive} openOrders={openOrders} />;
    }
  };

  const ticketCount = data.unreadTicketCount || 0;
  const paymentCount = data.pendingManualCount || 0;
  const orderCount = data.pendingOrderCount || 0;
  const refillCount = data.pendingRefillCount || 0;
  const issueCount = data.openIssueCount || 0;
  const taskReviewCount = data.pendingTaskReviewCount || 0;
  const badgeCounts = { tickets: ticketCount, payments: paymentCount, orders: orderCount, issues: issueCount, tasks: taskReviewCount, refills: refillCount };


  return (
    <ToastProvider dark={dark}>
    <ToastBridge toastRef={toastRef} />
    <ConfirmProvider dark={dark}>
    <div className="dash-root bg-t-bg">

      {/* ═══ TOP NAV ═══ */}
      <nav className="dash-nav" style={{ background: dark ? "rgba(14,9,22,.9)" : "rgba(248,245,241,.92)", borderBottom: `0.5px solid ${dark ? "rgba(255,255,255,.09)" : "rgba(0,0,0,.06)"}`, backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)" }}>
        <div className="dash-nav-left">
          <button className="dash-menu-btn" onClick={() => setLeftOpen(!leftOpen)}>
            <div className="dash-hamburger-bars" style={{ opacity: leftOpen ? 0 : 1, position: leftOpen ? "absolute" : "relative" }}>
              <div className="h-0.5 rounded-[1px] w-4 bg-accent" />
              <div className="h-0.5 rounded-[1px] w-[11px] bg-accent" />
              <div className="h-0.5 rounded-[1px] w-4 bg-accent" />
            </div>
            {leftOpen && <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={t.accent} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>}
            <span className="dash-logo-n"><span className="w-[24px] h-[24px] rounded-[6px] flex items-center justify-center" style={{ background: "linear-gradient(135deg,#c47d8e,#8b5e6b)" }}><svg width="10" height="11" viewBox="0 0 1601 1785" fill="#fff"><path d="M1600.82 160.089V1313c-.85 53.13-10.35 104.17-27.19 151.74-48.19 136.54-156.38 244.73-292.92 292.92-50.12 17.76-103.94 27.34-160.08 27.34 0 0-79.39 0-160.01-27.34-85.1-28.88-155.38-85.49-208.28-141.55-72.59-76.84-112.13-179.09-112.13-284.74V1023.4v-3.08-12.9c.08-1.39.08-2.7.08-4.17 0-1.39 0-2.7-.08-4.09-2.08-84.64-69.97-153.06-154.53-155.84-1.85-.08-3.71-.15-5.48-.15-1.78 0-3.71.08-5.48.15-84.56 2.78-152.44 71.2-154.61 155.84-.08 1.39-.08 2.7-.08 4.09 0 1.47 0 2.78.08 4.17v534.87c0 88.42-71.67 160.09-160.09 160.09-44.17 0-84.25-17.92-113.21-46.88C17.92 1626.84 0 1586.76 0 1542.59V995.288c.927-53.132 10.426-104.178 27.261-151.672C75.45 707.003 183.643 598.81 320.179 550.621c50.119-17.685 103.946-27.338 160.089-27.338 0 0 79.388 0 160.012 27.338 85.103 28.882 155.379 85.489 208.278 141.555 72.593 76.84 112.132 179.087 112.132 284.732v307.972l-.077.92v12.89c-.077 1.39-.077 2.78-.077 4.17 0 1.39 0 2.7.077 4.17 2.085 84.64 69.967 152.99 154.527 155.84 1.86 0 3.71 0 5.49 0 1.77 0 3.7 0 5.48 0 84.56-2.85 152.44-71.2 154.6-155.84V160.089C1280.71 71.666 1352.38 0 1440.8 0c44.18 0 84.18 17.916 113.14 46.876 28.96 28.96 46.88 69.04 46.88 113.213z"/></svg></span></span>
            <span className="dash-logo-wordmark"><span className="h-7 px-3 rounded-lg flex items-center justify-center" style={{ background: "linear-gradient(135deg,#c47d8e,#8b5e6b)" }}><NitroWordmark height={12} color="#fff" /></span></span>
          </button>
          <div className="dash-logo-static gap-2">
            <div className="h-7 px-3 rounded-lg flex items-center justify-center" style={{ background: "linear-gradient(135deg,#c47d8e,#8b5e6b)" }}><NitroWordmark height={12} color="#fff" /></div>
            <span className="text-xs py-0.5 px-1.5 rounded font-semibold text-accent" style={{ background: dark ? "rgba(196,125,142,.15)" : "rgba(196,125,142,.08)" }}>ADMIN</span>
          </div>
        </div>
        <div className="dash-nav-right">
          <ThemeToggle dark={dark} onToggle={toggleTheme} />
          {/* DND toggle */}
          <button onClick={toggleDnd} className="dash-bell relative" aria-label={dnd ? 'Unmute notifications' : 'Mute notifications'} title={dnd ? 'Notifications muted' : 'Notifications on'} style={{ color: dnd ? t.red : t.textSoft }}>
            {dnd
              ? <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
              : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></svg>}
          </button>
          {/* Open tickets */}
          <button onClick={() => { setActive("tickets"); setLeftOpen(false); }} className="dash-bell relative text-t-text-soft" aria-label="Open tickets">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
            {ticketCount > 0 && <div className="dash-bell-badge">{ticketCount > 9 ? "9+" : ticketCount}</div>}
          </button>
          <button onClick={() => { setActive("payments"); setLeftOpen(false); }} className="dash-bell relative text-t-text-soft" aria-label="Pending payments">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
            {paymentCount > 0 && <div className="dash-bell-badge">{paymentCount > 9 ? "9+" : paymentCount}</div>}
          </button>
          <div ref={avRef} className="relative">
            <button
              onClick={() => { if (window.matchMedia("(min-width: 1200px)").matches) setAvOpen(o => !o); else { setActive("settings"); setLeftOpen(false); } }}
              className="dash-avatar-btn" aria-label="Account menu" aria-haspopup="menu" aria-expanded={avOpen}>
              <Avatar size={30} rounded={10} />
            </button>
            {avOpen && (
              <div role="menu" aria-label="Account" className="dash-av-menu" style={{ background: dark ? "#160f22" : "#fff", border: `1px solid ${dark ? "rgba(255,255,255,.1)" : "rgba(0,0,0,.08)"}` }}>
                <div className="dash-av-head" style={{ borderBottom: `1px solid ${dark ? "rgba(255,255,255,.08)" : "rgba(0,0,0,.06)"}` }}>
                  <Avatar size={34} rounded={10} />
                  <div className="min-w-0 flex-1">
                    <div className="text-[13px] font-semibold truncate text-t-text">{admin?.name || "Admin"}</div>
                    <div className="text-[11px] truncate text-t-text-muted">{admin?.email || admin?.role || ""}</div>
                  </div>
                  <button role="menuitem" onClick={() => { setAvOpen(false); setActive("settings"); }} className="dash-av-gear" aria-label="Settings" style={{ color: t.textMuted }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09a1.65 1.65 0 00-1-1.51 1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09a1.65 1.65 0 001.51-1 1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>
                  </button>
                </div>
                <button role="menuitem" onClick={() => { setAvOpen(false); setActive("team"); }} className="dash-av-item" style={{ color: t.textSoft }}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg>Team</button>
                <button role="menuitem" onClick={() => { setAvOpen(false); setActive("activity"); }} className="dash-av-item" style={{ color: t.textSoft }}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>Logs</button>
                <button role="menuitem" onClick={() => { setAvOpen(false); window.open("/changelog", "_blank", "noopener"); }} className="dash-av-item" style={{ color: t.textSoft }}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2l2.4 5.2L20 8l-4 3.9.9 5.6L12 14.8 7.1 17.5 8 11.9 4 8l5.6-.8z"/></svg>What&rsquo;s New</button>
                <div className="dash-av-foot" style={{ borderTop: `1px solid ${dark ? "rgba(255,255,255,.08)" : "rgba(0,0,0,.06)"}` }}>
                  <div role="group" aria-label="Theme" className="inline-flex items-center gap-0.5 p-[3px] rounded-full" style={{ background: dark ? "rgba(255,255,255,.08)" : "rgba(0,0,0,.05)", border: `1px solid ${dark ? "rgba(255,255,255,.1)" : "rgba(0,0,0,.08)"}` }}>
                    {[["day", "Light", <svg key="d" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>], ["night", "Dark", <svg key="n" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 12.8A9 9 0 1111.2 3a7 7 0 009.8 9.8z"/></svg>], ["auto", "Auto", <svg key="a" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 3a9 9 0 010 18z" fill="currentColor" stroke="none"/></svg>]].map(([id, label, icon]) => (
                      <button key={id} onClick={() => applyThemeMode(id)} aria-pressed={themeMode === id} aria-label={label} title={label} className="w-8 h-7 rounded-full border-none flex items-center justify-center cursor-pointer" style={{ background: themeMode === id ? (dark ? "rgba(255,255,255,.14)" : "#fff") : "transparent", color: themeMode === id ? t.text : t.textMuted, boxShadow: themeMode === id ? "0 1px 3px rgba(0,0,0,.15)" : "none" }}>{icon}</button>
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
        <aside className="dash-left admin-sidebar rail-adm bg-t-sidebar-bg" style={{ borderRight: `0.5px solid ${t.sidebarBorder}`, left: leftOpen ? 0 : undefined }}>
          {(() => {
            const ap = admin?.pages;
            const canSee = (id) => ap === "*" || ap?.includes(id);
            const allItems = ADMIN_NAV.flatMap(sec => sec.items.map(it => ({ ...it, section: sec.section }))).filter(it => canSee(it.id));
            const go = (id) => { setActive(id); setLeftOpen(false); setJump(""); };
            const badgeOf = (item) => item.badge && badgeCounts[item.badge] > 0 ? (item.badge === "orders" ? badgeCounts[item.badge] : badgeCounts[item.badge] > 9 ? "9+" : badgeCounts[item.badge]) : null;
            const CHEV = <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9" /></svg>;
            const row = (item) => (
              <button key={item.id} type="button" className={"rail-it" + (active === item.id ? " on" : "")} onClick={() => go(item.id)}>
                <span className="rail-ii">{item.icon}</span>
                <span className="rail-il">{item.label}</span>
                {badgeOf(item) != null && <span className="m rail-bd">{badgeOf(item)}</span>}
              </button>
            );
            const q = jump.trim().toLowerCase();
            const matches = q ? allItems.filter(it => it.label.toLowerCase().includes(q) || it.id.includes(q)) : [];
            const pins = ADMIN_PINS.map(id => allItems.find(it => it.id === id)).filter(Boolean);
            const pinned = new Set(pins.map(it => it.id));
            return (
              <>
                <div className="rail-jump">
                  <span className="rail-ji"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><line x1="20" y1="20" x2="16.5" y2="16.5" /></svg></span>
                  <input ref={jumpRef} value={jump} onChange={e => setJump(e.target.value)} placeholder="Jump to a page" aria-label="Jump to a page"
                    onKeyDown={e => { if (e.key === "Enter" && matches[0]) go(matches[0].id); if (e.key === "Escape") { setJump(""); e.currentTarget.blur(); } }} />
                  {!jump && <kbd>/</kbd>}
                </div>
                {q ? (
                  matches.length ? matches.map(row) : <div className="rail-empty">No page called “{jump.trim()}”.</div>
                ) : (
                  <>
                    {pins.length > 0 && (
                      <div className="rail-pins">
                        {pins.map(item => (
                          <button key={item.id} type="button" className={"rail-pin" + (active === item.id ? " on" : "")} onClick={() => go(item.id)}>
                            <span className="rail-ii">{item.icon}</span>
                            <span>{item.id === "create-order" ? "Create order" : item.label}</span>
                            {badgeOf(item) != null && <b className="m rail-pb">{badgeOf(item)}</b>}
                          </button>
                        ))}
                      </div>
                    )}
                    {ADMIN_NAV.map(section => {
                      const items = section.items.filter(it => canSee(it.id) && !pinned.has(it.id));
                      if (items.length === 0) return null;
                      const open = openSection === section.section;
                      const folded = items.reduce((n, it) => n + (it.badge && badgeCounts[it.badge] > 0 ? Number(badgeCounts[it.badge]) : 0), 0);
                      return (
                        <div key={section.section} className={"rail-acc" + (open ? " open" : "")}>
                          <button type="button" className="rail-ah" onClick={() => setOpenSection(open ? null : section.section)} aria-expanded={open}>
                            <span className="rail-an">{section.section}</span>
                            {!open && folded > 0 && <span className="m rail-bd">{folded > 9 ? "9+" : folded}</span>}
                            <span className="rail-chev">{CHEV}</span>
                          </button>
                          {open && items.map(row)}
                        </div>
                      );
                    })}
                  </>
                )}
              </>
            );
          })()}
          <div className="flex-1" />
          <div className="dash-sidebar-divider bg-t-sidebar-border" />
          <div className="pt-1 px-3.5 pb-2">
            <a href={SITE.status} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 no-underline">
              <div className="w-1.5 h-1.5 rounded-full bg-t-green" />
              <span className="text-[13px] font-medium text-t-green">All systems operational</span>
              <svg className="ml-auto" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={t.textMuted} strokeWidth="2" strokeLinecap="round"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
            </a>
          </div>
        </aside>

        {leftOpen && <div className="dash-overlay" onClick={() => setLeftOpen(false)} />}

        <main className="dash-main bg-t-bg" style={{ ...(active === "tickets" ? { overflow: "hidden" } : {}) }}>
          <AnnouncementBanner alerts={adminAlerts} dark={dark} mode="dashboard" />
          <div key={active} className={`dash-page-enter ${active === "tickets" ? "flex-1 flex flex-col min-h-0 overflow-hidden" : ""}`}>
            {renderPage()}
          </div>

        </main>

        <div className="dash-right bg-t-sidebar-bg" style={{ borderLeft: `0.5px solid ${t.sidebarBorder}` }}>
          {active === "create-order" ? <div id="create-order-sidebar" className="flex flex-col gap-4 flex-1 overflow-auto min-h-0" /> : active === "leaderboard" ? <AdminLeaderboardSidebar dark={dark} t={t} /> : <AdminRightSidebar data={data} dark={dark} t={t} active={active} admin={admin} setActive={setActive} />}
        </div>
      </div>
    </div>
    </ConfirmProvider>
    </ToastProvider>
  );
}
