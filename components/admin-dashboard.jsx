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

/* ═══════════════════════════════════════════ */
/* ═══ HELPERS                             ═══ */
/* ═══════════════════════════════════════════ */

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
          <div key={label} className="dash-stat-card" style={{ background: dark ? "rgba(255,255,255,.04)" : "rgba(255,255,255,.85)", border: `0.5px solid ${dark ? "rgba(255,255,255,.06)" : "rgba(0,0,0,.06)"}` }}>
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
          <div className="adm-card" style={{ background: dark ? "rgba(255,255,255,.03)" : "rgba(255,255,255,.85)", border: `0.5px solid ${dark ? "rgba(255,255,255,.06)" : "rgba(0,0,0,.06)"}` }}>
            <div className="adm-card-header">
              <span className="adm-card-title" style={{ color: t.textMuted }}>Recent orders</span>
              <button onClick={() => setActive("orders")} className="adm-section-link" style={{ color: t.accent }}>View all →</button>
            </div>
            <div className="adm-card-divider" style={{ background: dark ? "rgba(255,255,255,.06)" : "rgba(0,0,0,.06)" }} />
            {(recentOrders || []).length > 0 ? (recentOrders || []).slice(0, 5).map((o, i, arr) => (
              <div key={o.id} className="adm-list-row" style={{ borderBottom: i < arr.length - 1 ? `1px solid ${t.cardBorder}` : "none" }}>
                <div className="min-w-0 flex-1">
                  <div className="text-[15px] font-medium" style={{ color: t.text }}>{o.service || o.serviceId}</div>
                  <div className="text-sm mt-0.5" style={{ color: t.textMuted }}><span className="m">{o.id}</span> · {o.user || "user"}</div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-semibold" style={{ color: t.green }}>{fN(o.charge || 0)}</div>
                  <span className="m adm-badge" style={{ background: o.status === "Completed" ? (dark ? "rgba(110,231,183,.1)" : "rgba(5,150,105,.06)") : o.status === "Processing" ? (dark ? "rgba(165,180,252,.1)" : "rgba(79,70,229,.06)") : (dark ? "rgba(252,211,77,.1)" : "rgba(217,119,6,.06)"), color: o.status === "Completed" ? t.green : o.status === "Processing" ? t.blue : t.amber }}>{o.status}</span>
                </div>
              </div>
            )) : (
              <div className="adm-empty" style={{ color: t.textMuted }}>No orders yet</div>
            )}
          </div>
        </div>

        <div>
          <div className="adm-card" style={{ background: dark ? "rgba(255,255,255,.03)" : "rgba(255,255,255,.85)", border: `0.5px solid ${dark ? "rgba(255,255,255,.06)" : "rgba(0,0,0,.06)"}` }}>
            <div className="adm-card-header">
              <span className="adm-card-title" style={{ color: t.textMuted }}>New users</span>
              <button onClick={() => setActive("users")} className="adm-section-link" style={{ color: t.accent }}>View all →</button>
            </div>
            <div className="adm-card-divider" style={{ background: dark ? "rgba(255,255,255,.06)" : "rgba(0,0,0,.06)" }} />
            {(recentUsers || []).length > 0 ? (recentUsers || []).slice(0, 5).map((u, i, arr) => (
              <div key={u.id} className="adm-list-row" style={{ borderBottom: i < arr.length - 1 ? `1px solid ${t.cardBorder}` : "none" }}>
                <div className="adm-user-avatar" style={{ background: `hsl(${(u.id || i) * 45}, 40%, ${dark ? 30 : 65}%)` }}>{(u.name || "U")[0]}</div>
                <div className="flex-1 min-w-0">
                  <div className="text-[15px] font-medium" style={{ color: t.text }}>{u.name}</div>
                  <div className="text-sm" style={{ color: t.textMuted }}>{u.email}</div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-semibold" style={{ color: t.text }}>{u.orders || 0} orders</div>
                  <div className="text-[13px]" style={{ color: t.textMuted }}>{u.created ? fD(u.created) : ""}</div>
                </div>
              </div>
            )) : (
              <div className="adm-empty" style={{ color: t.textMuted }}>No users yet</div>
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
        <div className="adm-rs-title" style={{ color: t.textMuted }}>Open Tickets</div>
        {(data.openTickets || []).length > 0 ? (data.openTickets || []).slice(0, 4).map((tk, i) => (
          <div key={tk.id || i} className="adm-rs-ticket" style={{ background: dark ? "rgba(255,255,255,.03)" : "rgba(255,255,255,.85)", border: `0.5px solid ${t.cardBorder}` }}>
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
        <div className="adm-rs-title" style={{ color: t.textMuted }}>Provider Colors</div>
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
        <div className="adm-rs-title" style={{ color: t.textMuted }}>{activityLabel}</div>
        {filteredActivity.slice(0, 6).map((a, i) => (
          <div key={i} className="adm-rs-activity">
            <div className="adm-rs-dot" style={{ background: a.type === "order" ? t.green : a.type === "user" ? t.blue : a.type === "deposit" || a.type === "payment" ? t.green : a.type === "ticket" ? t.amber : a.type === "blog" ? (dark ? "#a5b4fc" : "#4f46e5") : t.accent }} />
            <div>
              <div className="text-sm font-[450]" style={{ color: t.text }}>{a.action}</div>
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
  const [data, setData] = useState({ stats: {}, recentOrders: [], recentUsers: [], openTickets: [], activity: [] });

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
        if (res.status === 401) {
          setRedirecting(true);
          window.location.replace("/admin/login");
          return;
        }
        if (res.ok) {
          const d = await res.json();
          setAdmin({ name: d.admin?.name || "Admin", role: d.admin?.role || "superadmin", email: d.admin?.email || "", pages: d.admin?.pages || "*" });
          setData({
            stats: d || {},
            recentOrders: d.recentOrders || [],
            recentUsers: d.recentUsers || [],
            openTickets: d.openTickets || [],
            activity: d.activity || [],
          });
          // Sync theme from server (overrides localStorage on new devices)
          if (d.admin?.themePreference && d.admin.themePreference !== "auto") {
            const saved = localStorage.getItem("nitro-admin-theme");
            if (!saved || saved === "auto") {
              setThemeMode(d.admin.themePreference);
            }
          }
        } else {
          setRedirecting(true);
          window.location.replace("/admin/login");
        }
      } catch {
        setAdmin({ name: "Admin", role: "superadmin", email: "" });
      }
    }
    load();
  }, [redirecting]);

  /* Smart polling — refresh data every 20s, pause when tab is hidden */
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
          });
        }
      } catch {}
    };
    const start = () => { interval = setInterval(poll, 20000); };
    const stop = () => { clearInterval(interval); interval = null; };
    const onVisibility = () => { document.hidden ? stop() : (poll(), start()); };
    start();
    document.addEventListener("visibilitychange", onVisibility);
    return () => { stop(); document.removeEventListener("visibilitychange", onVisibility); };
  }, [redirecting]);

  const handleLogout = async () => { try { await fetch("/api/auth/admin/logout", { method: "POST" }); } catch {} window.location.replace("/admin/login?logout=1"); };

  const t = useMemo(() => ({
    bg: dark ? "#080b14" : "#f4f1ed",
    sidebarBg: dark ? "#060810" : "#eceae5",
    sidebarBorder: dark ? "rgba(255,255,255,.08)" : "rgba(0,0,0,.1)",
    cardBg: dark ? "rgba(255,255,255,.04)" : "rgba(255,255,255,.8)",
    cardBorder: dark ? "rgba(255,255,255,.08)" : "rgba(0,0,0,.1)",
    text: dark ? "#f5f3f0" : "#1a1917",
    textSoft: dark ? "#a09b95" : "#555250",
    textMuted: dark ? "#706c68" : "#757170",
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
          <div className="dash-nav-left"><div className="dash-logo-static"><div className="dash-logo-box"><svg width="11" height="11" viewBox="0 0 20 20" fill="none"><path d="M4,16 L4,4 L16,16 L16,4" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg></div><span className="dash-logo-text" style={{ color: t.text }}>NITRO</span></div></div>
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
      case "settings": return <AdminSettingsPage admin={admin} dark={dark} t={t} themeMode={themeMode} setThemeMode={setThemeMode} setDark={setDark} onLogout={handleLogout} />;
      default: return <AdminOverview data={data} dark={dark} t={t} setActive={setActive} />;
    }
  };

  const ticketCount = (data.openTickets || []).length;

  return (
    <ToastProvider dark={dark}>
    <ConfirmProvider dark={dark}>
    <div className="dash-root" style={{ background: t.bg }}>

      {/* ═══ TOP NAV ═══ */}
      <nav className="dash-nav" style={{ background: t.sidebarBg, borderBottom: `0.5px solid ${t.sidebarBorder}` }}>
        <div className="dash-nav-left">
          <button className="dash-menu-btn" onClick={() => setLeftOpen(!leftOpen)}>
            <div className="dash-hamburger-bars" style={{ opacity: leftOpen ? 0 : 1, position: leftOpen ? "absolute" : "relative" }}>
              <div className="h-0.5 rounded-[1px] w-4" style={{ background: t.accent }} />
              <div className="h-0.5 rounded-[1px] w-[11px]" style={{ background: t.accent }} />
              <div className="h-0.5 rounded-[1px] w-4" style={{ background: t.accent }} />
            </div>
            {leftOpen && <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={t.accent} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>}
            <div className="dash-logo-box"><svg width="11" height="11" viewBox="0 0 20 20" fill="none"><path d="M4,16 L4,4 L16,16 L16,4" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg></div>
            <span className="dash-logo-text" style={{ color: t.text }}>NITRO</span>
          </button>
          <div className="dash-logo-static">
            <div className="dash-logo-box"><svg width="11" height="11" viewBox="0 0 20 20" fill="none"><path d="M4,16 L4,4 L16,16 L16,4" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg></div>
            <span className="dash-logo-text" style={{ color: t.text }}>NITRO</span>
            <span className="text-xs py-0.5 px-1.5 rounded font-semibold" style={{ background: dark ? "rgba(196,125,142,.15)" : "rgba(196,125,142,.08)", color: t.accent }}>ADMIN</span>
          </div>
        </div>
        <div className="dash-nav-right">
          <button onClick={toggleTheme} className="dash-theme-toggle" style={{ background: dark ? "rgba(99,102,241,.25)" : "rgba(0,0,0,.06)", borderWidth: 1, borderStyle: "solid", borderColor: dark ? "rgba(99,102,241,.2)" : "rgba(0,0,0,.08)" }}>
            <div className="dash-theme-thumb" style={{ background: dark ? "#1e1b4b" : "#fff", left: dark ? 23 : 3, boxShadow: dark ? "0 0 6px rgba(99,102,241,.3)" : "0 1px 4px rgba(0,0,0,.15)" }}>
              {dark ? <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#a5b4fc" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/></svg> : <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>}
            </div>
          </button>
          <button onClick={() => { setActive("settings"); setLeftOpen(false); }} className="dash-avatar-btn">
            <div className="dash-avatar" style={{ background: t.accent }}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg></div>
            <span className="dash-nav-name" style={{ color: t.text, textTransform: "uppercase" }}>{admin.name}</span>
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
                <button key={item.id} onClick={() => { setActive(item.id); setLeftOpen(false); }} className="dash-nav-item" style={{ background: active === item.id ? t.navActive : "transparent", color: active === item.id ? t.accent : t.textSoft, fontWeight: active === item.id ? 600 : 450, borderLeft: active === item.id ? `3px solid ${t.accent}` : "3px solid transparent" }}>
                  <span className="shrink-0" style={{ opacity: active === item.id ? 1 : .6 }}>{item.icon}</span>
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
            <button onClick={handleLogout} className="flex items-center gap-2 w-full py-2 px-2.5 rounded-lg border-none text-[13px] font-medium cursor-pointer font-[inherit]" style={{ background: dark ? "rgba(220,38,38,.08)" : "rgba(220,38,38,.04)", color: dark ? "#fca5a5" : "#dc2626" }}>
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
