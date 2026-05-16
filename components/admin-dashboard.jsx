'use client';
import { useState, useEffect, useMemo, useRef } from "react";
import { ThemeProvider, useTheme } from "./shared-nav";
import { ToastProvider } from "./toast";
import { ConfirmProvider } from "./confirm-dialog";
import AnnouncementBanner from "./announcement-banner";
import AdminOrdersPage from "./admin-orders";
import AdminUsersPage from "./admin-users";
import AdminTicketsPage from "./admin-tickets";
import AdminServicesPage from "./admin-services";
import AdminServiceGroupsPage from "./admin-service-groups";
import AdminPricingPage from "./admin-pricing";
import { AdminPaymentsPage, AdminFinancePage, AdminAlertsPage, AdminSettingsPage } from "./admin-pages";
import { AdminActivityPage, AdminTeamPage, AdminCouponsPage, AdminNotificationsPage, AdminMaintenancePage, AdminAPIPage } from "./admin-extra-pages";
import AdminBlogPage from "./admin-blog";
import AdminLeaderboardPage, { AdminLeaderboardSidebar } from "./admin-leaderboard";
import { fN, fD } from "../lib/format";
import { SITE } from "../lib/site";
import { PlatformIcon } from "./platform-icon";
import { Avatar } from "./avatar";
import { useToast } from "./toast";

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
    { id: "orders", label: "Orders", icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg> },
    { id: "users", label: "Users", icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg> },
    { id: "leaderboard", label: "Leaderboard", icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M8 21V12H2v9h6zM22 21V8h-6v13h6zM15 21V4H9v17h6z"/></svg> },
    { id: "tickets", label: "Support", icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>, badge: true },
  ]},
  { section: "Catalog", items: [
    { id: "menu-builder", label: "Menu Builder", icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg> },
    { id: "services", label: "Raw Services", icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg> },
    { id: "pricing", label: "Pricing", icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg> },
  ]},
  { section: "Marketing", items: [
    { id: "blog", label: "Blog", icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/></svg> },
    { id: "alerts", label: "Announcements", icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></svg> },
    { id: "notifications", label: "Email Blasts", icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 17H2a3 3 0 003-3V9a7 7 0 0114 0v5a3 3 0 003 3zm-8.27 4a2 2 0 01-3.46 0"/></svg> },
    { id: "rewards", label: "Rewards", icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 12v10H4V12"/><path d="M2 7h20v5H2z"/><path d="M12 22V7"/><path d="M12 7H7.5a2.5 2.5 0 010-5C11 2 12 7 12 7z"/><path d="M12 7h4.5a2.5 2.5 0 000-5C13 2 12 7 12 7z"/></svg> },
  ]},
  { section: "System", items: [
    { id: "payments", label: "Payments", icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg> },
    { id: "finance", label: "Finance", icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg> },
    { id: "activity", label: "Logs", icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg> },
    { id: "team", label: "Team", icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a3 3 0 00-3 3v1a3 3 0 006 0V5a3 3 0 00-3-3z"/><path d="M19 8a2 2 0 00-2 2v1a2 2 0 004 0v-1a2 2 0 00-2-2z"/><path d="M5 8a2 2 0 00-2 2v1a2 2 0 004 0v-1a2 2 0 00-2-2z"/><path d="M3 21v-2a4 4 0 014-4h1"/><path d="M21 21v-2a4 4 0 00-4-4h-1"/><path d="M8 21v-2a4 4 0 014-4 4 4 0 014 4v2"/></svg> },
    { id: "api", label: "API", icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg> },
    { id: "maintenance", label: "Maintenance", icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z"/></svg> },
    { id: "settings", label: "Settings", icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z"/></svg> },
  ]},
];

/* ═══════════════════════════════════════════ */
/* ═══ ADMIN OVERVIEW                      ═══ */
/* ═══════════════════════════════════════════ */
function AdminOverview({ data, dark, t, setActive }) {
  const { stats, recentOrders, recentUsers } = data;
  return (
    <>
      <div className="adm-header">
        <div className="adm-title" style={{ color: t.text }}>Dashboard Overview</div>
        <div className="adm-subtitle" style={{ color: t.textMuted }}>Platform at a glance</div>
        <div className="page-divider" style={{ background: t.cardBorder }} />
      </div>

      {/* Stat cards */}
      <div className="adm-stats">
        {[
          ["Today's Revenue", fN(stats.revenue || 0), t.green, `${stats.revenueChange || 0}% vs yesterday`],
          ["Total Users", String(stats.users || 0), t.blue, `${stats.newUsersToday || 0} today`],
          ["Total Orders", String(stats.orders || 0), t.accent, `${stats.ordersToday || 0} today`],
          ["Processing", String(stats.processing || 0), t.amber, "Est. 1-2 hrs"],
          ["Deposits (Today)", fN(stats.deposits || 0), t.green, `${stats.depositsChange || 0}% vs yesterday`],
        ].map(([label, val, color, sub]) => (
          <div key={label} className="dash-stat-card" style={{ background: dark ? "rgba(255,255,255,.12)" : "rgba(255,255,255,.85)", border: `0.5px solid ${dark ? "rgba(255,255,255,.16)" : "rgba(0,0,0,.12)"}` }}>
            <div className="dash-stat-dot" style={{ background: color }} />
            <div className="dash-stat-label" style={{ color: t.textMuted }}>{label}</div>
            <div className="m dash-stat-value" style={{ color }}>{val}</div>
            <div className="dash-stat-sub" style={{ color: t.textMuted }}>{sub}</div>
          </div>
        ))}
      </div>

      {/* Two column — Recent Orders + Recent Users */}
      <div className="adm-grid-2">
        <div>
          <div className="rounded-[14px] overflow-hidden" style={{ background: dark ? "rgba(255,255,255,.09)" : "rgba(255,255,255,.85)", border: `0.5px solid ${dark ? "rgba(255,255,255,.16)" : "rgba(0,0,0,.12)"}` }}>
            <div className="py-3 px-[18px] flex justify-between items-center" style={{ background: dark ? "rgba(196,125,142,.18)" : "rgba(196,125,142,.12)", borderBottom: `1px solid ${dark ? "rgba(255,255,255,.12)" : "rgba(0,0,0,.08)"}` }}>
              <span className="text-sm font-semibold tracking-wide uppercase" style={{ color: t.textMuted }}>Recent orders</span>
              <button onClick={() => setActive("orders")} className="text-xs font-medium bg-transparent border-none cursor-pointer font-[inherit]" style={{ color: t.accent }}>View all →</button>
            </div>
            {(() => {
              const items = [];
              const batches = {};
              for (const o of (recentOrders || [])) {
                if (o.batchId) {
                  if (!batches[o.batchId]) { batches[o.batchId] = { type: "batch", batchId: o.batchId, orders: [], created: o.created }; items.push(batches[o.batchId]); }
                  batches[o.batchId].orders.push(o);
                } else { items.push({ type: "single", order: o, created: o.created }); }
              }
              items.sort((a, b) => new Date(b.created) - new Date(a.created));
              const display = items.slice(0, 5);
              return display.length > 0 ? display.map((item, i) => {
                if (item.type === "batch") {
                  const totalCharge = item.orders.reduce((s, o) => s + (o.charge || 0), 0);
                  return (
                    <div key={item.batchId} className="flex items-center py-3 px-[18px] gap-3" style={{ borderBottom: i < display.length - 1 ? `1px solid ${t.cardBorder}` : "none" }}>
                      <div className="shrink-0 flex items-center justify-center" style={{ width: 36, height: 36, borderRadius: 10, background: dark ? "rgba(196,125,142,.1)" : "rgba(196,125,142,.08)" }}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={t.accent} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 002 1.61h9.72a2 2 0 002-1.61L23 6H6"/></svg>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-[14px] font-medium mb-[2px]" style={{ color: t.text }}>{item.batchId} · {item.orders.length} orders</div>
                        <div className="flex items-center gap-1.5 text-[12px]">
                          <span style={{ color: t.textMuted }}>{item.orders[0]?.user || "user"}</span>
                          <span className="w-[3px] h-[3px] rounded-full bg-current opacity-35 shrink-0" />
                          <span style={{ color: t.textMuted }}>{item.created ? fD(item.created) : ""}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {item.orders.some(o => ["Pending","Processing","Partial"].includes(o.status)) && <span className="inline-block w-[5px] h-[5px] rounded-full" style={{ background: item.orders.some(o => o.status === "Processing") ? (dark ? "#a5b4fc" : "#6366f1") : item.orders.some(o => o.status === "Partial") ? (dark ? "#fdba74" : "#ea580c") : (dark ? "#fcd34d" : "#d97706") }} />}
                        <span className="text-[14px] font-semibold" style={{ color: item.orders.every(o => o.status === "Cancelled") ? (dark ? "#fca5a5" : "#dc2626") : t.green }}>{fN(totalCharge)}</span>
                      </div>
                    </div>
                  );
                }
                const o = item.order;
                return (
                  <div key={o.id} className="flex items-center py-3 px-[18px] gap-3" style={{ borderBottom: i < display.length - 1 ? `1px solid ${t.cardBorder}` : "none" }}>
                    <PlatformIcon platform={o.platform} dark={dark} />
                    <div className="min-w-0 flex-1">
                      <div className="text-[14px] font-medium overflow-hidden text-ellipsis whitespace-nowrap mb-[2px]" style={{ color: t.text }}>{o.service}{o.tier ? ` · ${o.tier}` : ""}</div>
                      <div className="flex items-center gap-1.5 text-[12px]">
                        <span style={{ color: t.textMuted }}>{o.user || "user"}</span>
                        <span className="w-[3px] h-[3px] rounded-full bg-current opacity-35 shrink-0" />
                        <span style={{ color: t.textMuted }}>{o.created ? fD(o.created) : ""}</span>
                      </div>
                    </div>
                    <div className="text-right shrink-0 flex flex-col items-end gap-1">
                      <div className="text-[14px] font-semibold" style={{ color: o.status === "Cancelled" ? (dark ? "#fca5a5" : "#dc2626") : t.green }}>{fN(o.charge || 0)}</div>
                      <span className="text-[11px] font-semibold py-0.5 px-2 rounded-[5px] whitespace-nowrap" style={{ background: o.status === "Completed" ? (dark ? "rgba(110,231,183,.1)" : "#ecfdf5") : o.status === "Processing" ? (dark ? "rgba(165,180,252,.1)" : "#eef2ff") : (o.status === "Failed" || o.status === "Cancelled" || o.status === "Rejected" || o.status === "Partial") ? (dark ? "rgba(252,165,165,.1)" : "#fef2f2") : (dark ? "rgba(252,211,77,.1)" : "#fffbeb"), color: o.status === "Completed" ? t.green : o.status === "Processing" ? t.blue : (o.status === "Failed" || o.status === "Cancelled" || o.status === "Rejected" || o.status === "Partial") ? t.red : t.amber }}>{o.status}</span>
                    </div>
                  </div>
                );
              }) : null;
            })() || (
              <div className="py-8 px-5 text-center">
                <svg width="36" height="36" viewBox="0 0 64 64" fill="none" style={{ display: "block", margin: "0 auto 10px", opacity: .7 }}>
                  <rect x="12" y="8" width="40" height="48" rx="6" stroke={t.accent} strokeWidth="1.5" opacity=".3" />
                  <line x1="20" y1="22" x2="44" y2="22" stroke={t.accent} strokeWidth="1.5" opacity=".2" strokeLinecap="round" />
                  <line x1="20" y1="30" x2="38" y2="30" stroke={t.accent} strokeWidth="1.5" opacity=".15" strokeLinecap="round" />
                </svg>
                <div className="text-sm font-semibold" style={{ color: t.textSoft }}>No orders yet</div>
              </div>
            )}
          </div>
        </div>

        <div>
          <div className="rounded-[14px] overflow-hidden" style={{ background: dark ? "rgba(255,255,255,.09)" : "rgba(255,255,255,.85)", border: `0.5px solid ${dark ? "rgba(255,255,255,.16)" : "rgba(0,0,0,.12)"}` }}>
            <div className="py-3 px-[18px] flex justify-between items-center" style={{ background: dark ? "rgba(196,125,142,.18)" : "rgba(196,125,142,.12)", borderBottom: `1px solid ${dark ? "rgba(255,255,255,.12)" : "rgba(0,0,0,.08)"}` }}>
              <span className="text-sm font-semibold tracking-wide uppercase" style={{ color: t.textMuted }}>New users</span>
              <button onClick={() => setActive("users")} className="text-xs font-medium bg-transparent border-none cursor-pointer font-[inherit]" style={{ color: t.accent }}>View all →</button>
            </div>
            {(recentUsers || []).length > 0 ? (recentUsers || []).slice(0, 5).map((u, i, arr) => (
              <div key={u.id} className="flex items-center py-3 px-[18px] gap-3" style={{ borderBottom: i < arr.length - 1 ? `1px solid ${t.cardBorder}` : "none" }}>
                <Avatar size={32} />
                <div className="flex-1 min-w-0">
                  <div className="text-[14px] font-medium" style={{ color: t.text }}>{u.name}</div>
                  <div className="text-[12px]" style={{ color: t.textMuted }}>{u.email}</div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-[13px] font-semibold" style={{ color: t.text }}>{u.orders || 0} orders</div>
                  <div className="text-[12px]" style={{ color: t.textMuted }}>{u.created ? fD(u.created, true) : ""}</div>
                </div>
              </div>
            )) : (
              <div className="py-8 px-5 text-center">
                <svg width="36" height="36" viewBox="0 0 64 64" fill="none" style={{ display: "block", margin: "0 auto 10px", opacity: .7 }}>
                  <circle cx="32" cy="22" r="10" stroke={t.accent} strokeWidth="1.5" opacity=".3" />
                  <path d="M14 52c0-10 8-16 18-16s18 6 18 16" stroke={t.accent} strokeWidth="1.5" opacity=".2" strokeLinecap="round" />
                </svg>
                <div className="text-sm font-semibold" style={{ color: t.textSoft }}>No users yet</div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

/* ═══════════════════════════════════════════ */
/* ═══ PLACEHOLDER PAGE                    ═══ */
/* ═══════════════════════════════════════════ */
function PlaceholderPage({ title, subtitle, dark, t }) {
  return (
    <>
      <div className="adm-header">
        <div className="adm-title" style={{ color: t.text }}>{title}</div>
        <div className="adm-subtitle" style={{ color: t.textMuted }}>{subtitle}</div>
        <div className="page-divider" style={{ background: t.cardBorder }} />
      </div>
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <div className="text-base font-medium" style={{ color: t.textMuted }}>Building {title}...</div>
          <div className="text-sm mt-1" style={{ color: t.textMuted }}>This page will be built next</div>
        </div>
      </div>
    </>
  );
}

/* ═══════════════════════════════════════════ */
/* ═══ RIGHT SIDEBAR                       ═══ */
/* ═══════════════════════════════════════════ */
function AdminRightSidebar({ data, dark, t, active }) {
  const showTickets = active === "overview";
  const showProviderColors = ["orders", "services", "menu-builder", "pricing", "finance", "payments"].includes(active);
  const showActivity = !["leaderboard"].includes(active);

  // Filter activity by active tab
  const activityTypeMap = {
    overview: null, // show all
    orders: ["order"],
    finance: ["order", "payment", "user"],
    users: ["user"],
    blog: ["blog"],
    tickets: ["ticket"],
    services: ["service"],
    "menu-builder": ["service"],
    pricing: ["service", "settings"],
    payments: ["payment"],
    team: ["admin"],
    coupons: ["coupon"],
    alerts: ["alert"],
    settings: ["settings", "maintenance"],
    notifications: ["notification"],
    maintenance: ["maintenance"],
    api: ["settings"],
  };
  const allowedTypes = activityTypeMap[active] || null;
  const filteredActivity = allowedTypes
    ? (data.activity || []).filter(a => allowedTypes.includes(a.type))
    : (data.activity || []);
  const activityLabel = {
    orders: "Order Activity", finance: "Financial Activity", users: "User Activity",
    blog: "Blog Activity", tickets: "Ticket Activity", services: "Service Activity",
    "menu-builder": "Service Activity", pricing: "Pricing Activity", payments: "Payment Activity",
    team: "Team Activity", coupons: "Coupon Activity", alerts: "Alert Activity",
    notifications: "Notification Activity", maintenance: "Maintenance Activity",
  }[active] || "Recent Activity";

  return (
    <>
      {showTickets && (<>
        <div className="text-xs font-semibold uppercase tracking-[1px] mt-2.5 mb-2.5 py-2 px-3 rounded-lg" style={{ color: t.textMuted, background: dark ? "rgba(196,125,142,.18)" : "rgba(196,125,142,.12)" }}>Open Tickets</div>
        {(data.openTickets || []).length > 0 ? (data.openTickets || []).slice(0, 4).map((tk, i) => (
          <div key={tk.id || i} className="adm-rs-ticket" style={{ background: dark ? "rgba(255,255,255,.09)" : "rgba(255,255,255,.85)", border: `0.5px solid ${t.cardBorder}` }}>
            <div className="adm-rs-ticket-top">
              <span className="text-[13px]" style={{ color: t.accent }}>{tk.id}</span>
              <span className="text-xs" style={{ color: t.textMuted }}>{tk.created ? fD(tk.created) : ""}</span>
            </div>
            <div className="text-sm font-medium mt-[3px]" style={{ color: t.text }}>{tk.subject}</div>
            <div className="text-[13px] mt-0.5" style={{ color: t.textMuted }}>{tk.user || "user"}</div>
          </div>
        )) : (
          <div className="text-sm py-2 px-1" style={{ color: t.textMuted }}>No open tickets</div>
        )}
        <div className="adm-rs-divider" style={{ background: t.sidebarBorder }} />
      </>)}

      {showProviderColors && (<>
        <div className="text-xs font-semibold uppercase tracking-[1px] mt-2.5 mb-2.5 py-2 px-3 rounded-lg" style={{ color: t.textMuted, background: dark ? "rgba(196,125,142,.18)" : "rgba(196,125,142,.12)" }}>Provider Colors</div>
        <div className="flex gap-3 py-1">
          {[["MTP", "#ef4444"], ["JAP", "#3b82f6"], ["DAO", "#22c55e"]].map(([name, color]) => (
            <div key={name} className="flex items-center gap-[5px]">
              <span className="w-[7px] h-[7px] rounded-full" style={{ background: color }} />
              <span className="text-xs font-medium" style={{ color: t.textMuted }}>{name}</span>
            </div>
          ))}
        </div>
        <div className="adm-rs-divider" style={{ background: t.sidebarBorder }} />
      </>)}

      {showActivity && (<>
        <div className="text-xs font-semibold uppercase tracking-[1px] mt-2.5 mb-2.5 py-2 px-3 rounded-lg" style={{ color: t.textMuted, background: dark ? "rgba(196,125,142,.18)" : "rgba(196,125,142,.12)" }}>{activityLabel}</div>
        {filteredActivity.slice(0, 6).map((a, i) => (
          <div key={i} className="adm-rs-activity">
            <div className="adm-rs-dot" style={{ background: a.type === "order" ? t.green : a.type === "user" ? t.blue : a.type === "deposit" || a.type === "payment" ? t.green : a.type === "ticket" ? t.amber : a.type === "blog" ? (dark ? "#a5b4fc" : "#4f46e5") : t.accent }} />
            <div>
              <div className="text-sm font-medium" style={{ color: t.text }}>{a.action}</div>
              <div className="text-[13px]" style={{ color: t.textMuted }}>{a.detail} · {a.time ? fD(a.time) : ""}</div>
            </div>
          </div>
        ))}
        {filteredActivity.length === 0 && <div className="text-sm py-2 px-1" style={{ color: t.textMuted }}>No recent activity</div>}
      </>)}
    </>
  );
}

/* ═══════════════════════════════════════════ */
/* ═══ MAIN ADMIN SHELL                    ═══ */
/* ═══════════════════════════════════════════ */
export default function AdminDashboard() {
  return <ThemeProvider storageKey="nitro-admin-theme"><AdminDashboardInner /></ThemeProvider>;
}

function AdminDashboardInner() {
  const { dark, setDark, toggleTheme, t: baseT, themeMode, setThemeMode } = useTheme();
  const [active, setActiveRaw] = useState("overview");
  const setActive = (page) => { setActiveRaw(page); try { localStorage.setItem("nitro-admin-page", page); } catch {} };
  useEffect(() => { try { const saved = localStorage.getItem("nitro-admin-page"); if (saved) setActiveRaw(saved); } catch {} }, []);

  const [leftOpen, setLeftOpen] = useState(false);
  const [admin, setAdmin] = useState(null);
  const [data, setData] = useState({ stats: {}, recentOrders: [], recentUsers: [], openTickets: [], activity: [], unreadTicketCount: 0 });
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
    async function load() {
      try {
        const res = await fetch("/api/admin/overview");
        if (!res.ok) {
          if (res.status === 401) { setRedirecting(true); window.location.replace("/admin/login"); }
          return;
        }
        const d = await res.json();
        setAdmin({ name: d.admin?.name || "Admin", role: d.admin?.role || "superadmin", email: d.admin?.email || "", pages: d.admin?.pages || "*" });
        setData({
          stats: d || {},
          recentOrders: d.recentOrders || [],
          recentUsers: d.recentUsers || [],
          openTickets: d.openTickets || [],
          activity: d.activity || [],
          unreadTicketCount: d.unreadTicketCount || 0,
        });
        if (d.admin?.themePreference && d.admin.themePreference !== "auto") {
          const saved = localStorage.getItem("nitro-admin-theme");
          if (!saved || saved === "auto") {
            setThemeMode(d.admin.themePreference);
          }
        }
      } catch {
        setAdmin({ name: "Admin", role: "superadmin", email: "" });
      }
    }
    load();
  }, [redirecting]);

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
      return saved ? JSON.parse(saved) : { new_ticket: true, ticket_reply: true, deposit: true, large_deposit: true, stale_ticket: true };
    } catch { return { new_ticket: true, ticket_reply: true, deposit: true, large_deposit: true, stale_ticket: true }; }
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
      else if (type === 'stale_ticket') { play(440, 0, 0.2, 0.18); play(440, 0.3, 0.2, 0.18); play(440, 0.6, 0.3, 0.2); }
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
    if ((event.type === 'deposit' || event.type === 'large_deposit') && !hasPage('finance') && !hasPage('payments') && !hasPage('overview')) return;

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
      stale_ticket: { title: `${event.user} still waiting (${event.minutes}m)`, toast: 'error', body: `${event.title} — reply now` },
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
    const poll = async () => {
      try {
        const res = await fetch("/api/admin/overview");
        if (res.status === 401) { try { await fetch("/api/auth/admin/logout", { method: "POST" }); } catch {} window.location.replace("/admin/login"); return; }
        if (res.ok) {
          const d = await res.json();
          setAdmin(prev => ({ ...prev, name: d.admin?.name || prev.name, role: d.admin?.role || prev.role, pages: d.admin?.pages || prev.pages }));
          setData({
            stats: d || {},
            recentOrders: d.recentOrders || [],
            recentUsers: d.recentUsers || [],
            openTickets: d.openTickets || [],
            activity: d.activity || [],
            unreadTicketCount: d.unreadTicketCount || 0,
          });
        }
      } catch {}

      if (notifLastPollRef.current) {
        try {
          const nr = await fetch(`/api/admin/notifications/poll?since=${encodeURIComponent(notifLastPollRef.current)}`);
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
        } catch {}
      }
      notifLastPollRef.current = new Date().toISOString();
    };
    const start = () => { if (!interval) interval = setInterval(poll, 20000); };
    const stop = () => { clearInterval(interval); interval = null; };
    start();
    return () => { stop(); };
  }, [redirecting]);

  const handleLogout = async () => { try { await fetch("/api/auth/admin/logout", { method: "POST" }); } catch {} window.location.replace("/admin/login?logout=1"); };

  const t = useMemo(() => ({
    bg: dark ? "#080b14" : "#f4f1ed",
    sidebarBg: dark ? "#0e1122" : "#eceae5",
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
      <div className="dash-root" style={{ background: t.bg }}>
        <nav className="dash-nav" style={{ background: t.sidebarBg, borderBottom: `0.5px solid ${t.sidebarBorder}` }}>
          <div className="dash-nav-left"><div className="dash-logo-static"><div className="dash-logo-box"><svg width="10" height="11" viewBox="0 0 1601 1785" fill="#fff"><path d="M1600.82 160.089V1313c-.85 53.13-10.35 104.17-27.19 151.74-48.19 136.54-156.38 244.73-292.92 292.92-50.12 17.76-103.94 27.34-160.08 27.34 0 0-79.39 0-160.01-27.34-85.1-28.88-155.38-85.49-208.28-141.55-72.59-76.84-112.13-179.09-112.13-284.74V1023.4v-3.08-12.9c.08-1.39.08-2.7.08-4.17 0-1.39 0-2.7-.08-4.09-2.08-84.64-69.97-153.06-154.53-155.84-1.85-.08-3.71-.15-5.48-.15-1.78 0-3.71.08-5.48.15-84.56 2.78-152.44 71.2-154.61 155.84-.08 1.39-.08 2.7-.08 4.09 0 1.47 0 2.78.08 4.17v534.87c0 88.42-71.67 160.09-160.09 160.09-44.17 0-84.25-17.92-113.21-46.88C17.92 1626.84 0 1586.76 0 1542.59V995.288c.927-53.132 10.426-104.178 27.261-151.672C75.45 707.003 183.643 598.81 320.179 550.621c50.119-17.685 103.946-27.338 160.089-27.338 0 0 79.388 0 160.012 27.338 85.103 28.882 155.379 85.489 208.278 141.555 72.593 76.84 112.132 179.087 112.132 284.732v307.972l-.077.92v12.89c-.077 1.39-.077 2.78-.077 4.17 0 1.39 0 2.7.077 4.17 2.085 84.64 69.967 152.99 154.527 155.84 1.86 0 3.71 0 5.49 0 1.77 0 3.7 0 5.48 0 84.56-2.85 152.44-71.2 154.6-155.84V160.089C1280.71 71.666 1352.38 0 1440.8 0c44.18 0 84.18 17.916 113.14 46.876 28.96 28.96 46.88 69.04 46.88 113.213z"/></svg></div><span className="dash-logo-text" style={{ color: t.text }}>NITRO</span></div></div>
          <div className="dash-nav-right"><div className={`${skBone} w-[30px] h-[30px] rounded-[10px]`} /></div>
        </nav>
        <div className="dash-body">
          <aside className="dash-left" style={{ background: t.sidebarBg, borderRight: `0.5px solid ${t.sidebarBorder}` }}>
            {[1,2,3,4,5,6,7,8,9].map(i => <div key={i} className={`${skBone} h-9 rounded-xl mb-1`} />)}
          </aside>
          <main className="dash-main" style={{ background: t.bg }}>
            <div className={`${skBone} w-60 h-6 mb-2`} />
            <div className={`${skBone} w-[180px] h-3.5 mb-6`} />
            <div className="grid grid-cols-5 gap-3">
              {[1,2,3,4,5].map(i => <div key={i} className="p-[18px] rounded-[14px] border border-solid" style={{ background: t.cardBg, borderColor: t.cardBorder }}><div className={`${skBone} w-[60%] h-2.5 mb-2.5`} /><div className={`${skBone} w-[45%] h-[22px]`} /></div>)}
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

  /* Render page */
  const renderPage = () => {
    const ap = admin?.pages;
    // Guard: if page not in allowed list, fall back to overview
    if (active !== "overview" && ap !== "*" && Array.isArray(ap) && !ap.includes(active)) {
      return <AdminOverview data={data} dark={dark} t={t} setActive={setActive} />;
    }
    switch (active) {
      case "overview": return <AdminOverview data={data} dark={dark} t={t} setActive={setActive} />;
      case "orders": return <AdminOrdersPage dark={dark} t={t} />;
      case "users": return <AdminUsersPage dark={dark} t={t} />;
      case "leaderboard": return <AdminLeaderboardPage dark={dark} t={t} />;
      case "tickets": return <AdminTicketsPage dark={dark} t={t} adminName={admin?.name || "Admin"} />;
      case "services": return <AdminServicesPage dark={dark} t={t} />;
      case "menu-builder": return <AdminServiceGroupsPage dark={dark} t={t} />;
      case "pricing": return <AdminPricingPage dark={dark} t={t} />;
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
      case "settings": return <AdminSettingsPage admin={admin} dark={dark} t={t} themeMode={themeMode} setThemeMode={setThemeMode} setDark={setDark} onLogout={handleLogout} notifPrefs={notifPrefs} updateNotifPref={updateNotifPref} />;
      default: return <AdminOverview data={data} dark={dark} t={t} setActive={setActive} />;
    }
  };

  const ticketCount = data.unreadTicketCount || 0;


  return (
    <ToastProvider dark={dark}>
    <ToastBridge toastRef={toastRef} />
    <ConfirmProvider dark={dark}>
    <div className="dash-root" style={{ background: t.bg }}>

      {/* ═══ TOP NAV ═══ */}
      <nav className="dash-nav" style={{ background: dark ? "rgba(9,12,21,.9)" : "rgba(248,245,241,.92)", borderBottom: `0.5px solid ${dark ? "rgba(255,255,255,.09)" : "rgba(0,0,0,.06)"}`, backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)" }}>
        <div className="dash-nav-left">
          <button className="dash-menu-btn" onClick={() => setLeftOpen(!leftOpen)}>
            <div className="dash-hamburger-bars" style={{ opacity: leftOpen ? 0 : 1, position: leftOpen ? "absolute" : "relative" }}>
              <div className="h-0.5 rounded-[1px] w-4" style={{ background: t.accent }} />
              <div className="h-0.5 rounded-[1px] w-[11px]" style={{ background: t.accent }} />
              <div className="h-0.5 rounded-[1px] w-4" style={{ background: t.accent }} />
            </div>
            {leftOpen && <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={t.accent} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>}
            <div className="dash-logo-box"><svg width="10" height="11" viewBox="0 0 1601 1785" fill="#fff"><path d="M1600.82 160.089V1313c-.85 53.13-10.35 104.17-27.19 151.74-48.19 136.54-156.38 244.73-292.92 292.92-50.12 17.76-103.94 27.34-160.08 27.34 0 0-79.39 0-160.01-27.34-85.1-28.88-155.38-85.49-208.28-141.55-72.59-76.84-112.13-179.09-112.13-284.74V1023.4v-3.08-12.9c.08-1.39.08-2.7.08-4.17 0-1.39 0-2.7-.08-4.09-2.08-84.64-69.97-153.06-154.53-155.84-1.85-.08-3.71-.15-5.48-.15-1.78 0-3.71.08-5.48.15-84.56 2.78-152.44 71.2-154.61 155.84-.08 1.39-.08 2.7-.08 4.09 0 1.47 0 2.78.08 4.17v534.87c0 88.42-71.67 160.09-160.09 160.09-44.17 0-84.25-17.92-113.21-46.88C17.92 1626.84 0 1586.76 0 1542.59V995.288c.927-53.132 10.426-104.178 27.261-151.672C75.45 707.003 183.643 598.81 320.179 550.621c50.119-17.685 103.946-27.338 160.089-27.338 0 0 79.388 0 160.012 27.338 85.103 28.882 155.379 85.489 208.278 141.555 72.593 76.84 112.132 179.087 112.132 284.732v307.972l-.077.92v12.89c-.077 1.39-.077 2.78-.077 4.17 0 1.39 0 2.7.077 4.17 2.085 84.64 69.967 152.99 154.527 155.84 1.86 0 3.71 0 5.49 0 1.77 0 3.7 0 5.48 0 84.56-2.85 152.44-71.2 154.6-155.84V160.089C1280.71 71.666 1352.38 0 1440.8 0c44.18 0 84.18 17.916 113.14 46.876 28.96 28.96 46.88 69.04 46.88 113.213z"/></svg></div>
            <span className="dash-logo-text" style={{ color: t.text }}>NITRO</span>
          </button>
          <div className="dash-logo-static">
            <div className="dash-logo-box"><svg width="10" height="11" viewBox="0 0 1601 1785" fill="#fff"><path d="M1600.82 160.089V1313c-.85 53.13-10.35 104.17-27.19 151.74-48.19 136.54-156.38 244.73-292.92 292.92-50.12 17.76-103.94 27.34-160.08 27.34 0 0-79.39 0-160.01-27.34-85.1-28.88-155.38-85.49-208.28-141.55-72.59-76.84-112.13-179.09-112.13-284.74V1023.4v-3.08-12.9c.08-1.39.08-2.7.08-4.17 0-1.39 0-2.7-.08-4.09-2.08-84.64-69.97-153.06-154.53-155.84-1.85-.08-3.71-.15-5.48-.15-1.78 0-3.71.08-5.48.15-84.56 2.78-152.44 71.2-154.61 155.84-.08 1.39-.08 2.7-.08 4.09 0 1.47 0 2.78.08 4.17v534.87c0 88.42-71.67 160.09-160.09 160.09-44.17 0-84.25-17.92-113.21-46.88C17.92 1626.84 0 1586.76 0 1542.59V995.288c.927-53.132 10.426-104.178 27.261-151.672C75.45 707.003 183.643 598.81 320.179 550.621c50.119-17.685 103.946-27.338 160.089-27.338 0 0 79.388 0 160.012 27.338 85.103 28.882 155.379 85.489 208.278 141.555 72.593 76.84 112.132 179.087 112.132 284.732v307.972l-.077.92v12.89c-.077 1.39-.077 2.78-.077 4.17 0 1.39 0 2.7.077 4.17 2.085 84.64 69.967 152.99 154.527 155.84 1.86 0 3.71 0 5.49 0 1.77 0 3.7 0 5.48 0 84.56-2.85 152.44-71.2 154.6-155.84V160.089C1280.71 71.666 1352.38 0 1440.8 0c44.18 0 84.18 17.916 113.14 46.876 28.96 28.96 46.88 69.04 46.88 113.213z"/></svg></div>
            <span className="dash-logo-text" style={{ color: t.text }}>NITRO</span>
            <span className="text-xs py-0.5 px-1.5 rounded font-semibold" style={{ background: dark ? "rgba(196,125,142,.15)" : "rgba(196,125,142,.08)", color: t.accent }}>ADMIN</span>
          </div>
        </div>
        <div className="dash-nav-right">
          <button onClick={toggleTheme} className="dash-theme-toggle" style={{ background: dark ? "rgba(99,102,241,.31)" : "rgba(0,0,0,.12)", borderWidth: 1, borderStyle: "solid", borderColor: dark ? "rgba(99,102,241,.28)" : "rgba(0,0,0,.14)" }}>
            <div className="dash-theme-thumb" style={{ background: dark ? "#1e1b4b" : "#fff", left: dark ? 23 : 3, boxShadow: dark ? "0 0 6px rgba(99,102,241,.3)" : "0 1px 4px rgba(0,0,0,.15)" }}>
              {dark ? <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#a5b4fc" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/></svg> : <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>}
            </div>
          </button>
          {/* DND toggle */}
          <button onClick={toggleDnd} className="dash-bell relative" aria-label={dnd ? 'Unmute notifications' : 'Mute notifications'} title={dnd ? 'Notifications muted' : 'Notifications on'} style={{ color: dnd ? t.red : t.textSoft }}>
            {dnd
              ? <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
              : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></svg>}
          </button>
          {/* Open tickets */}
          <button onClick={() => { setActive("tickets"); setLeftOpen(false); }} className="dash-bell relative" aria-label="Open tickets" style={{ color: t.textSoft }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
            {ticketCount > 0 && <div className="dash-bell-badge">{ticketCount > 10 ? "10+" : ticketCount}</div>}
          </button>
          <button onClick={() => { setActive("settings"); setLeftOpen(false); }} className="dash-avatar-btn" aria-label="Profile">
            <Avatar size={30} rounded={10} />
          </button>
        </div>
      </nav>

      {/* ═══ BODY ═══ */}
      <div className="dash-body">
        <aside className="dash-left admin-sidebar" style={{ background: t.sidebarBg, borderRight: `0.5px solid ${t.sidebarBorder}`, left: leftOpen ? 0 : undefined }}>
          {ADMIN_NAV.map((section, si) => {
            const ap = admin?.pages;
            const visibleItems = ap === "*" ? section.items : section.items.filter(item => ap?.includes(item.id));
            if (visibleItems.length === 0) return null;
            return (
            <div key={section.section}>
              {si > 0 && <div className="h-px my-1 mx-3" style={{ background: t.sidebarBorder }} />}
              <div className="adm-nav-section" style={{ color: t.textMuted }}>{section.section}</div>
              {visibleItems.map(item => (
                <button key={item.id} onClick={() => { setActive(item.id); setLeftOpen(false); }} className="dash-nav-item" style={{ background: active === item.id ? (dark ? "rgba(196,125,142,.12)" : "rgba(196,125,142,.08)") : "transparent", color: active === item.id ? t.accent : t.textSoft, fontWeight: active === item.id ? 600 : 450 }}>
                  <span className="shrink-0" style={{ opacity: active === item.id ? 1 : .55, color: active === item.id ? t.accent : t.textMuted }}>{item.icon}</span>
                  {item.label}
                  {item.badge && ticketCount > 0 && <span className="m dash-nav-badge">{ticketCount}</span>}
                </button>
              ))}
            </div>
            );
          })}
          <div className="flex-1" />
          <div className="dash-sidebar-divider" style={{ background: t.sidebarBorder }} />
          <div className="py-1 px-3.5">
            <button onClick={handleLogout} className="flex items-center gap-2 w-full py-2 px-2.5 rounded-lg border-none text-[13px] font-medium cursor-pointer font-[inherit] transition-transform duration-200 hover:-translate-y-px" style={{ background: dark ? "rgba(220,38,38,.14)" : "rgba(220,38,38,.08)", color: dark ? "#fca5a5" : "#dc2626" }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
              Log Out
            </button>
          </div>
          <div className="pt-1 px-3.5 pb-2">
            <a href={SITE.status} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 no-underline">
              <div className="w-1.5 h-1.5 rounded-full" style={{ background: t.green }} />
              <span className="text-[13px] font-medium" style={{ color: t.green }}>All systems operational</span>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={t.textMuted} strokeWidth="2" strokeLinecap="round" style={{ marginLeft: "auto" }}><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
            </a>
          </div>
        </aside>

        {leftOpen && <div className="dash-overlay" onClick={() => setLeftOpen(false)} />}

        <main className="dash-main" style={{ background: t.bg, ...(active === "tickets" ? { overflow: "hidden" } : {}) }}>
          <AnnouncementBanner alerts={adminAlerts} dark={dark} mode="dashboard" />
          <div key={active} className={`dash-page-enter ${active === "tickets" ? "flex-1 flex flex-col min-h-0 overflow-hidden" : ""}`}>
            {renderPage()}
          </div>

          <div className="dash-footer" style={{ borderTopColor: t.sidebarBorder, flexShrink: 0 }}>
            <span style={{ color: t.textMuted }}>© {new Date().getFullYear() > 2026 ? `2026–${new Date().getFullYear()}` : "2026"} Nitro Admin</span>
            <span className="text-[13px]" style={{ color: t.textMuted }}>v1.0.0</span>
          </div>
        </main>

        <div className="dash-right" style={{ background: t.sidebarBg, borderLeft: `0.5px solid ${t.sidebarBorder}` }}>
          {active === "leaderboard" ? <AdminLeaderboardSidebar dark={dark} t={t} /> : <AdminRightSidebar data={data} dark={dark} t={t} active={active} />}
        </div>
      </div>
    </div>
    </ConfirmProvider>
    </ToastProvider>
  );
}
