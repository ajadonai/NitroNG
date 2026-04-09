'use client';
import { useState, useEffect, useMemo, useRef } from "react";
import dynamic from "next/dynamic";
import { ThemeProvider, useTheme } from "./shared-nav";
import NewOrderPage, { PLATFORMS, PLATFORM_GROUPS, OrderForm, ServicesSidebar } from "./new-order";
import { ToastProvider } from "./toast";
import { ConfirmProvider } from "./confirm-dialog";
import { fN, fD } from "../lib/format";

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
const HowToPage = dynamic(() => import("./howto-page").then(m => m.default), { ssr: false });
const HowToSidebar = dynamic(() => import("./howto-page").then(m => m.HowToSidebar), { ssr: false });

/* ═══════════════════════════════════════════ */
/* ═══ SVG ICONS                          ═══ */
/* ═══════════════════════════════════════════ */
const I = {
  overview: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>,
  orders: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>,
  "add-funds": <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/><path d="M7 15h2"/></svg>,
  "how-to": <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M2 3h6a4 4 0 014 4v14a3 3 0 00-3-3H2z"/><path d="M22 3h-6a4 4 0 00-4 4v14a3 3 0 013-3h7z"/></svg>,
  services: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>,
  referrals: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>,
  support: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>,
  settings: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09a1.65 1.65 0 00-1-1.51 1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>,
};

const NAV_ITEMS = [
  { id: "overview", label: "Overview" },
  { id: "services", label: "Services" },
  { id: "orders", label: "History" },
  { id: "add-funds", label: "Wallet" },
  { id: "how-to", label: "Guide" },
  { id: "referrals", label: "Referrals" },
  { id: "support", label: "Support" },
  { id: "settings", label: "Settings" },
];


/* ── Status helpers ── */
function sClr(s, dk) { return s === "Completed" ? (dk ? "#6ee7b7" : "#059669") : s === "Processing" ? (dk ? "#a5b4fc" : "#4f46e5") : s === "Pending" ? (dk ? "#fcd34d" : "#d97706") : s === "Partial" ? (dk ? "#fca5a5" : "#dc2626") : (dk ? "#555250" : "#8a8785"); }
function sBg(s, dk) { return s === "Completed" ? (dk ? "#0a2416" : "#ecfdf5") : s === "Processing" ? (dk ? "#0f1629" : "#eef2ff") : s === "Pending" ? (dk ? "#1c1608" : "#fffbeb") : s === "Partial" ? (dk ? "#1f0a0a" : "#fef2f2") : (dk ? "#141414" : "#f5f5f5"); }
function sBrd(s, dk) { return s === "Completed" ? (dk ? "#166534" : "#a7f3d0") : s === "Processing" ? (dk ? "#3730a3" : "#c7d2fe") : s === "Pending" ? (dk ? "#92400e" : "#fde68a") : s === "Partial" ? (dk ? "#991b1b" : "#fecaca") : (dk ? "#404040" : "#d4d4d4"); }

function Badge({ status, dark }) {
  return <span style={{ fontSize: 13, fontWeight: 600, padding: "2px 8px", borderRadius: 5, background: sBg(status, dark), color: sClr(status, dark), borderWidth: .5, borderStyle: "solid", borderColor: sBrd(status, dark), whiteSpace: "nowrap", display: "inline-block" }}>{status}</span>;
}

/* ═══════════════════════════════════════════ */
/* ═══ MOBILE MENU HINT                    ═══ */
/* ═══════════════════════════════════════════ */
function MobileMenuHint({ dark, t }) {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;
  return (
    <div className="dash-menu-hint" style={{ background: dark ? "rgba(196,125,142,.06)" : "rgba(196,125,142,.03)", border: `1px solid ${dark ? "rgba(196,125,142,.12)" : "rgba(196,125,142,.08)"}`, borderRadius: 12, padding: "10px 14px", marginBottom: 12, alignItems: "center", gap: 10 }}>
      <span style={{ fontSize: 16, flexShrink: 0 }}>👋</span>
      <div style={{ flex: 1, fontSize: 13, color: t.textMuted, lineHeight: 1.5 }}>
        Tap the <b style={{ color: t.text }}>menu icon</b> (top left) to access Services, Orders, Funds, and more.
      </div>
      <button onClick={() => setDismissed(true)} style={{ background: "none", border: "none", color: t.textMuted, fontSize: 16, cursor: "pointer", padding: "0 2px", flexShrink: 0 }}>✕</button>
    </div>
  );
}

/* ═══════════════════════════════════════════ */
/* ═══ OVERVIEW PAGE                      ═══ */
/* ═══════════════════════════════════════════ */
function OverviewPage({ user, orders, alerts, dark, t, setActive }) {
  const balance = user ? fN(user.balance) : "₦0";
  const total = orders.length;
  const processing = orders.filter(o => o.status === "Processing" || o.status === "Pending").length;
  const completed = orders.filter(o => o.status === "Completed").length;
  const rate = total > 0 ? Math.round(completed / total * 100) : 0;

  return (
    <>
      {/* Alert bar — only shows when alerts exist */}
      {alerts.length > 0 && alerts.map((a, i) => (
        <div key={a.id || i} className="dash-alert" style={{
          background: a.type === "warning" ? (dark ? "rgba(217,119,6,.08)" : "rgba(217,119,6,.04)") : (dark ? "rgba(196,125,142,.06)" : "rgba(196,125,142,.04)"),
          borderTopWidth: 1, borderRightWidth: 1, borderBottomWidth: 1, borderLeftWidth: 3,
          borderStyle: "solid",
          borderTopColor: a.type === "warning" ? (dark ? "rgba(251,191,36,.15)" : "rgba(217,119,6,.12)") : (dark ? "rgba(196,125,142,.12)" : "rgba(196,125,142,.08)"),
          borderRightColor: a.type === "warning" ? (dark ? "rgba(251,191,36,.15)" : "rgba(217,119,6,.12)") : (dark ? "rgba(196,125,142,.12)" : "rgba(196,125,142,.08)"),
          borderBottomColor: a.type === "warning" ? (dark ? "rgba(251,191,36,.15)" : "rgba(217,119,6,.12)") : (dark ? "rgba(196,125,142,.12)" : "rgba(196,125,142,.08)"),
          borderLeftColor: a.type === "warning" ? (dark ? "#fbbf24" : "#d97706") : t.accent,
          color: a.type === "warning" ? (dark ? "#fbbf24" : "#92400e") : t.text,
        }}>
          <span style={{ fontSize: 16, flexShrink: 0 }}>{a.type === "warning" ? "⚠️" : "📢"}</span>
          <span style={{ flex: 1 }}>{a.message}</span>
        </div>
      ))}

      {/* Mobile menu hint */}
      <MobileMenuHint dark={dark} t={t} />

      {/* Stat cards */}
      <div className="dash-stats">
        {[
          ["Balance", balance, t.green, "+₦2,000 this week"],
          ["Orders", String(total), dark ? "#a5b4fc" : "#4f46e5", "3 this week"],
          ["In Progress", String(processing), dark ? "#e0a458" : "#d97706", "Est. 1-2 hrs"],
          ["Delivered", String(completed), dark ? "#6ee7b7" : "#059669", rate + "% success"],
        ].map(([label, val, color, sub]) => (
          <div key={label} className="dash-stat-card" style={{ background: dark ? "rgba(255,255,255,.04)" : "rgba(255,255,255,.85)", border: `0.5px solid ${dark ? "rgba(255,255,255,.06)" : "rgba(0,0,0,.06)"}` }}>
            <div className="dash-stat-dot" style={{ background: color }} />
            <div className="dash-stat-label" style={{ color: t.textMuted }}>{label}</div>
            <div className="m dash-stat-value" style={{ color }}>{val}</div>
            <div className="dash-stat-sub" style={{ color: t.textMuted }}>{sub}</div>
          </div>
        ))}
      </div>

      {/* Quick actions — mobile/tablet only */}
      <div className="dash-quick-actions">
        <div className="dash-qa-card" style={{ background: dark ? "rgba(196,125,142,.04)" : "rgba(196,125,142,.03)", border: `1px solid ${dark ? "rgba(196,125,142,.1)" : "rgba(196,125,142,.06)"}`, borderRadius: 14, padding: "10px 10px 12px" }}>
          <div style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1.2, color: t.textMuted, padding: "0 4px 6px", opacity: .7 }}>Quick Actions</div>
          <div className="dash-qa-grid">
            {[
              ["Services", "services", t.accent, <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>],
              ["Top Up", "add-funds", dark ? "#6ee7b7" : "#059669", <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>],
              ["History", "orders", dark ? "#a5b4fc" : "#4f46e5", <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>],
              ["Refer", "referrals", dark ? "#e0a458" : "#d97706", <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>],
            ].map(([label, page, color, icon]) => (
              <button key={page} onClick={() => setActive(page)} className="dash-qa-btn" style={{ background: dark ? "rgba(255,255,255,.06)" : "#fff" }}>
                <div className="dash-qa-icon" style={{ color, background: `${color}15` }}>{icon}</div>
                <span style={{ fontSize: 11, fontWeight: 600, color: t.textSoft }}>{label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Recent orders */}
      <div className="dash-orders-card" style={{ background: dark ? "rgba(255,255,255,.03)" : "rgba(255,255,255,.85)", border: `0.5px solid ${dark ? "rgba(255,255,255,.06)" : "rgba(0,0,0,.06)"}` }}>
        <div style={{ padding: "16px 18px 0" }}>
          <div className="dash-section-title" style={{ color: t.textMuted }}>Recent activity</div>
        </div>
        <div className="dash-section-divider" style={{ background: dark ? "rgba(255,255,255,.06)" : "rgba(0,0,0,.06)" }} />
        {orders.length > 0 ? orders.slice(0, 5).map((o, i, arr) => (
          <div key={o.id} className="dash-order-row" style={{ borderBottom: i < arr.length - 1 ? `1px solid ${t.cardBorder}` : "none" }}>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div className="dash-order-service" style={{ color: t.text }}>{o.service}</div>
              <div className="dash-order-meta">
                <span className="m" style={{ color: t.textMuted }}>{o.id}</span>
                <span style={{ color: t.textMuted }}>{o.quantity?.toLocaleString() || 0} qty</span>
                <span style={{ color: t.textMuted }}>{o.created ? fD(o.created) : ""}</span>
              </div>
            </div>
            <div className="dash-order-right">
              <div className="m dash-order-amount" style={{ color: t.green }}>{fN(o.charge)}</div>
              <div style={{ marginTop: 4 }}><Badge status={o.status} dark={dark} /></div>
            </div>
          </div>
        )) : (
          <div className="dash-empty">
            <svg width="56" height="56" viewBox="0 0 64 64" fill="none" style={{ marginBottom: 16, opacity: .6 }}>
              <rect x="12" y="8" width="40" height="48" rx="6" stroke={t.accent} strokeWidth="1.5" opacity=".3" />
              <line x1="20" y1="22" x2="44" y2="22" stroke={t.accent} strokeWidth="1.5" opacity=".2" strokeLinecap="round" />
              <line x1="20" y1="30" x2="38" y2="30" stroke={t.accent} strokeWidth="1.5" opacity=".15" strokeLinecap="round" />
              <line x1="20" y1="38" x2="34" y2="38" stroke={t.accent} strokeWidth="1.5" opacity=".1" strokeLinecap="round" />
              <circle cx="32" cy="32" r="12" stroke={t.accent} strokeWidth="1.5" opacity=".2" />
              <line x1="28" y1="32" x2="36" y2="32" stroke={t.accent} strokeWidth="2" strokeLinecap="round" opacity=".4" />
              <line x1="32" y1="28" x2="32" y2="36" stroke={t.accent} strokeWidth="2" strokeLinecap="round" opacity=".4" />
            </svg>
            <div style={{ fontSize: 17, fontWeight: 600, color: t.textSoft, marginBottom: 6 }}>No orders yet — let's fix that 🔥</div>
            <div style={{ color: t.textMuted, fontSize: 15, marginBottom: 16, lineHeight: 1.5 }}>Boost your first Instagram post in under 60 seconds</div>
            <button onClick={() => setActive("services")} style={{ padding: "12px 28px", borderRadius: 10, background: `linear-gradient(135deg,${t.accent},#8b5e6b)`, color: "#fff", fontSize: 15, fontWeight: 600, border: "none", boxShadow: "0 4px 16px rgba(196,125,142,.25)" }}>Place your first order →</button>
          </div>
        )}
        {orders.length > 5 && (
          <div className="dash-view-all"><button onClick={() => setActive("orders")} style={{ color: t.accent }}>View all orders →</button></div>
        )}
      </div>

      {/* Referral card — tablet/mobile only */}
      <div className="dash-mobile-ref" style={{ background: dark ? "rgba(255,255,255,.03)" : "rgba(255,255,255,.85)", border: `0.5px solid ${t.cardBorder}` }}>
        <div className="dash-ref-label" style={{ color: t.textMuted }}>Your referral code</div>
        <div className="m dash-ref-code" style={{ color: t.accent }}>{user?.refCode || "—"}</div>
        <div className="dash-ref-stats" style={{ color: t.textMuted }}>{user?.refs || 0} referrals · {fN(user?.earnings || 0)} earned</div>
      </div>
    </>
  );
}

/* ═══════════════════════════════════════════ */
/* ═══ RIGHT SIDEBAR                      ═══ */
/* ═══════════════════════════════════════════ */
function RightSidebar({ orders, user, dark, t, setActive }) {
  const activeOrders = orders.filter(o => o.status === "Processing" || o.status === "Pending" || o.status === "Partial");
  const prc = orders.filter(o => o.status === "Processing").length;
  const pnd = orders.filter(o => o.status === "Pending").length;
  const prt = orders.filter(o => o.status === "Partial").length;

  return (
    <>
      {/* ── Active Orders — 40% ── */}
      <div className="dash-rs-section dash-rs-active">
        <div className="dash-rs-title" style={{ color: t.textMuted }}>Active Orders</div>
        <div className="dash-rs-pills">
          {prc > 0 && (
            <div className="dash-rs-pill" style={{ background: sBg("Processing", dark), color: sClr("Processing", dark) }}>
              <div className="dash-rs-dot" style={{ background: sClr("Processing", dark) }} />
              {prc} processing
            </div>
          )}
          {pnd > 0 && <div className="dash-rs-pill" style={{ background: sBg("Pending", dark), color: sClr("Pending", dark) }}>{pnd} pending</div>}
          {prt > 0 && <div className="dash-rs-pill" style={{ background: sBg("Partial", dark), color: sClr("Partial", dark) }}>{prt} partial</div>}
          {activeOrders.length === 0 && <div style={{ fontSize: 14, color: t.textMuted }}>No active orders</div>}
        </div>
        <div className="dash-rs-list">
          {activeOrders.slice(0, 3).map(o => (
            <div key={o.id} className="dash-rs-item" style={{ background: t.cardBg }}>
              <div className="dash-rs-item-name" style={{ color: t.text }}>{o.service}</div>
              <div className="dash-rs-item-row">
                <span style={{ fontWeight: 600, color: sClr(o.status, dark) }}>{o.status}</span>
                <span className="m" style={{ color: t.textMuted }}>{o.quantity?.toLocaleString() || 0} qty</span>
              </div>
            </div>
          ))}
        </div>
        {activeOrders.length > 3 && (
          <button onClick={() => setActive("orders")} className="dash-rs-viewall" style={{ color: t.accent }}>View all {activeOrders.length} active →</button>
        )}
      </div>

      {/* Divider */}
      <div className="dash-rs-divider" style={{ background: t.sidebarBorder }} />

      {/* ── Promo / Stats — 45% ── */}
      <div className="dash-rs-section dash-rs-promo">
        <div className="dash-rs-title" style={{ color: t.textMuted }}>Your Stats</div>
        <div className="dash-rs-stats-list">
          {[
            ["Most Ordered", "Instagram", <svg key="ig" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={t.accent} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1112.63 8 4 4 0 0116 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/></svg>],
            ["Avg Order Size", "1,200 qty", <svg key="sz" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={dark ? "#a5b4fc" : "#4f46e5"} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/></svg>],
            ["This Week", "3 orders", <svg key="wk" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={dark ? "#6ee7b7" : "#059669"} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>],
            ["Member Since", "Mar 2026", <svg key="ms" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={dark ? "#e0a458" : "#d97706"} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>],
          ].map(([label, val, icon]) => (
            <div key={label} className="dash-rs-stat-row" style={{ borderBottom: `1px solid ${t.cardBorder}` }}>
              <div className="dash-rs-stat-icon">{icon}</div>
              <div style={{ flex: 1 }}>
                <div className="dash-rs-stat-label" style={{ color: t.textMuted }}>{label}</div>
                <div className="dash-rs-stat-val" style={{ color: t.text }}>{val}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Divider */}
      <div className="dash-rs-divider" style={{ background: t.sidebarBorder }} />

      {/* ── Referral Card — 15% ── */}
      <div className="dash-rs-section dash-rs-ref">
        <div className="dash-rs-ref-card" style={{ background: dark ? "rgba(255,255,255,.03)" : "rgba(255,255,255,.85)", border: `0.5px solid ${t.cardBorder}` }}>
          <div className="dash-ref-label" style={{ color: t.textMuted }}>Your referral code</div>
          <div className="m dash-ref-code" style={{ color: t.accent }}>{user?.refCode || "—"}</div>
          <div className="dash-ref-stats" style={{ color: t.textMuted }}>{user?.refs || 0} referrals · {fN(user?.earnings || 0)} earned</div>
        </div>
      </div>
    </>
  );
}

/* ═══════════════════════════════════════════ */
/* ═══ NOTIFICATION DROPDOWN              ═══ */
/* ═══════════════════════════════════════════ */
function NotifDropdown({ orders, txs, dark, t, onClose, readIds, setReadIds, clearedIds, setClearedIds, notifClearedAt, setClearedAt }) {
  const [filter, setFilter] = useState("all");

  /* Build ALL notification items from real data */
  const allItems = [
    ...orders.filter(o => o.status === "Completed").map(o => ({
      id: `ord-${o.id}`, type: "order", title: "Order delivered",
      desc: `${o.id} · ${o.service || "Service"} delivered`,
      time: o.created ? fD(o.created) : "", ts: o.created ? new Date(o.created) : null,
      color: dark ? "#60a5fa" : "#2563eb",
      icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>,
    })),
    ...orders.filter(o => o.status === "Processing" || o.status === "Pending").map(o => ({
      id: `proc-${o.id}`, type: "order", title: "Order in progress",
      desc: `${o.id} · ${o.service || "Service"} started`,
      time: o.created ? fD(o.created) : "", ts: o.created ? new Date(o.created) : null,
      color: dark ? "#e0a458" : "#d97706",
      icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
    })),
    ...txs.filter(tx => tx.type === "deposit").map(tx => ({
      id: `dep-${tx.id || tx.reference}`, type: "deposit", title: "Funds added",
      desc: `${fN(tx.amount)} added via ${tx.method || "Paystack"}`,
      time: tx.date ? fD(tx.date) : "", ts: tx.date ? new Date(tx.date) : null,
      color: dark ? "#6ee7b7" : "#059669",
      icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>,
    })),
  ];

  // Filter out cleared items (by ID or by timestamp)
  const items = allItems.filter(n => {
    if (clearedIds.has(n.id)) return false;
    if (notifClearedAt && n.ts && n.ts <= notifClearedAt) return false;
    return true;
  });
  const filtered = filter === "all" ? items : items.filter(n => n.type === filter);
  const display = filtered.slice(0, 10);
  const hasMore = filtered.length > 10;
  const unreadCount = items.filter(n => !readIds.has(n.id)).length;
  const markAllRead = () => {
    const allIds = items.map(n => n.id);
    setReadIds(new Set([...readIds, ...allIds]));
    fetch("/api/auth/notifications", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ readIds: allIds }) }).catch(() => {});
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
    <div className="dash-notif" style={{
      background: dark ? "rgba(13,16,32,.98)" : "rgba(255,255,255,.98)",
      borderWidth: 1, borderStyle: "solid", borderColor: t.cardBorder,
      boxShadow: dark ? "0 12px 40px rgba(0,0,0,.5)" : "0 12px 40px rgba(0,0,0,.12)",
    }}>
      {/* Header */}
      <div className="dash-notif-header">
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 16, fontWeight: 600, color: t.text }}>Notifications</span>
          {unreadCount > 0 && <span className="m" style={{ fontSize: 12, padding: "2px 6px", borderRadius: 5, background: dark ? "#1c1015" : "#fdf2f4", color: t.accent, fontWeight: 600 }}>{unreadCount}</span>}
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          {unreadCount > 0 && <button onClick={markAllRead} style={{ fontSize: 13, fontWeight: 600, color: t.accent, background: "none", border: "none", cursor: "pointer" }}>Mark all read</button>}
          {items.length > 0 && <button onClick={clearAll} style={{ fontSize: 13, fontWeight: 600, color: t.textMuted, background: "none", border: "none", cursor: "pointer" }}>Clear all</button>}
        </div>
      </div>
      {/* Filter tabs */}
      <div style={{ display: "flex", gap: 4, padding: "0 14px 10px" }}>
        {[["all", "All"], ["order", "Orders"], ["deposit", "Deposits"]].map(([id, label]) => (
          <button key={id} onClick={() => setFilter(id)} style={{ padding: "3px 10px", borderRadius: 7, fontSize: 13, fontWeight: 500, background: filter === id ? (dark ? "rgba(196,125,142,.1)" : "rgba(196,125,142,.06)") : "transparent", color: filter === id ? t.accent : t.textMuted, border: "none", cursor: "pointer" }}>{label}</button>
        ))}
      </div>
      <div style={{ height: 1, background: t.cardBorder }} />
      {/* List */}
      <div className="dash-notif-list">
        {display.length > 0 ? display.map((n, i) => {
          const isRead = readIds.has(n.id);
          return (
            <div key={n.id} onClick={() => markRead(n.id)} className="dash-notif-item" style={{ borderBottom: i < display.length - 1 ? `1px solid ${t.cardBorder}` : "none", background: !isRead ? (dark ? "rgba(196,125,142,.03)" : "rgba(196,125,142,.02)") : "transparent", cursor: "pointer" }}>
              <div className="dash-notif-icon" style={{ background: `${n.color}15`, color: n.color }}>{n.icon}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 6 }}>
                  <span style={{ fontSize: 14, fontWeight: isRead ? 450 : 600, color: t.text }}>{n.title}</span>
                  {!isRead && <div style={{ width: 6, height: 6, borderRadius: "50%", background: t.accent, flexShrink: 0 }} />}
                </div>
                <div style={{ fontSize: 14, color: t.textSoft, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{n.desc}</div>
                <div style={{ fontSize: 13, color: t.textMuted, marginTop: 3 }}>{n.time}</div>
              </div>
            </div>
          );
        }) : (
          <div style={{ padding: "24px 14px", textAlign: "center", fontSize: 14, color: t.textMuted }}>No notifications</div>
        )}
      </div>
      {/* Footer */}
      {hasMore && <div style={{ padding: "8px 14px", textAlign: "center", fontSize: 12, color: t.textMuted, borderTop: `1px solid ${t.cardBorder}` }}>Showing latest 10 of {filtered.length}</div>}
    </div>
  );
}

/* ═══════════════════════════════════════════ */
/* ═══ MAIN DASHBOARD SHELL               ═══ */
/* ═══════════════════════════════════════════ */
export default function Dashboard() {
  return <ThemeProvider><DashboardInner /></ThemeProvider>;
}

function DashboardInner() {
  const { dark, setDark, toggleTheme, t: baseT, themeMode, setThemeMode } = useTheme();
  const [active, setActiveRaw] = useState("overview");
  const setActive = (page) => { setActiveRaw(page); try { localStorage.setItem("nitro-page", page); } catch {} };
  useEffect(() => {
    try {
      const nav = performance.getEntriesByType?.("navigation")?.[0];
      const isReload = nav?.type === "reload" || nav?.type === "back_forward";
      if (isReload) { const saved = localStorage.getItem("nitro-page"); if (saved) setActiveRaw(saved); }
      else { localStorage.removeItem("nitro-page"); }
    } catch {}
  }, []);
  const [leftOpen, setLeftOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [readNotifIds, setReadNotifIds] = useState(() => {
    if (typeof window === 'undefined') return new Set();
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

  // Persist to localStorage on change
  useEffect(() => { try { localStorage.setItem("nitro-notif-read", JSON.stringify([...readNotifIds])); } catch {} }, [readNotifIds]);
  useEffect(() => { try { localStorage.setItem("nitro-notif-cleared", JSON.stringify([...clearedNotifIds])); } catch {} }, [clearedNotifIds]);
  useEffect(() => { if (notifClearedAt) { try { localStorage.setItem("nitro-notif-cleared-at", notifClearedAt.toISOString()); } catch {} } }, [notifClearedAt]);

  // Scroll lock when sidebar or notification panel is open (mobile/tablet)
  useEffect(() => { document.body.style.overflow = leftOpen || notifOpen ? "hidden" : ""; return () => { document.body.style.overflow = ""; }; }, [leftOpen, notifOpen]);

  // Sync theme preference to server when it changes (skip initial mount)
  const themeSyncedRef = useRef(false);
  useEffect(() => {
    if (!themeSyncedRef.current) { themeSyncedRef.current = true; return; }
    fetch("/api/auth/notifications", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ themePreference: themeMode }) }).catch(() => {});
  }, [themeMode]);
  const [user, setUser] = useState(null);
  const [orders, setOrders] = useState([]);
  const [txs, setTxs] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [socialLinks, setSocialLinks] = useState({});
  const [paymentStatus, setPaymentStatus] = useState(null); // { type: "success"|"error", message, amount }
  const notifRef = useRef(null);

  // Compute notification item IDs for bell badge
  const notifItemIds = useMemo(() => {
    const ids = [];
    const cutoff = notifClearedAt ? new Date(notifClearedAt) : null;
    orders.filter(o => o.status === "Completed").filter(o => !cutoff || (o.created && new Date(o.created) > cutoff)).forEach(o => ids.push(`ord-${o.id}`));
    orders.filter(o => o.status === "Processing" || o.status === "Pending").filter(o => !cutoff || (o.created && new Date(o.created) > cutoff)).forEach(o => ids.push(`proc-${o.id}`));
    txs.filter(tx => tx.type === "deposit").filter(tx => !cutoff || (tx.date && new Date(tx.date) > cutoff)).forEach(tx => ids.push(`dep-${tx.id || tx.reference}`));
    return ids;
  }, [orders, txs, notifClearedAt]);
  const bellUnread = notifItemIds.filter(id => !readNotifIds.has(id) && !clearedNotifIds.has(id)).length;

  /* Services/Order state (lifted so sidebars can access) */
  const [noPlatform, setNoPlatform] = useState("instagram");
  const [noSelSvc, setNoSelSvc] = useState(null);
  const [noSelTier, setNoSelTier] = useState(null);
  const [noQty, setNoQty] = useState(1000);
  const [noLink, setNoLink] = useState("");
  const [noCatModal, setNoCatModal] = useState(false);
  const isServices = active === "services";
  const isOrders = active === "orders";
  const isReferrals = active === "referrals";
  const isSettings = active === "settings";
  const isSupport = active === "support";
  const isAddFunds = active === "add-funds";
  const isHowTo = active === "how-to";
  const noHasOrder = noSelSvc && noSelTier;

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
        if (data.alerts) setAlerts(data.alerts);
      }
    } catch {}
  };

  /* Data fetch */
  useEffect(() => {
    async function load() {
      try {
        /* Check maintenance mode first */
        const maintRes = await fetch("/api/maintenance-check");
        if (maintRes.ok) { const m = await maintRes.json(); if (m.maintenance) { window.location.replace("/maintenance"); return; } }
        
        const res = await fetch("/api/dashboard");
        if (res.status === 401) { try { await fetch("/api/auth/logout", { method: "POST" }); } catch {} window.location.replace("/?session_expired=1"); return; }
        if (res.ok) {
          const data = await res.json();
          setUser(data.user);
          if (data.orders) setOrders(data.orders);
          if (data.transactions) setTxs(data.transactions);
          if (data.alerts) setAlerts(data.alerts);
        } else setUser({ name: "User", email: "", balance: 0, refCode: "—", refs: 0, earnings: 0 });
        /* Fetch social links */
        try { const sr = await fetch("/api/settings"); if (sr.ok) { const sd = await sr.json(); setSocialLinks(sd.settings || {}); } } catch {}
        /* Load notification state + preferences from server (merges with localStorage) */
        try {
          const nr = await fetch("/api/auth/notifications");
          if (nr.ok) {
            const nd = await nr.json();
            if (nd.notifClearedAt) setNotifClearedAt(new Date(nd.notifClearedAt));
            if (Array.isArray(nd.notifReadIds) && nd.notifReadIds.length > 0) {
              setReadNotifIds(prev => new Set([...prev, ...nd.notifReadIds]));
            }
            // Sync theme from server (overrides localStorage on new devices)
            if (nd.themePreference && nd.themePreference !== "auto") {
              const saved = localStorage.getItem("nitro-theme");
              if (!saved || saved === "auto") {
                setThemeMode(nd.themePreference);
              }
            }
            // Sync perPage from server
            if (nd.perPagePreference && nd.perPagePreference !== 10) {
              const saved = localStorage.getItem("nitro-per-page");
              if (!saved) {
                try { localStorage.setItem("nitro-per-page", String(nd.perPagePreference)); } catch {}
              }
            }
          }
        } catch {}
      } catch { setUser({ name: "User", email: "", balance: 0, refCode: "—", refs: 0, earnings: 0 }); }
    }
    load();
  }, []);

  /* Smart polling — refresh data every 45s, pause when tab is hidden */
  useEffect(() => {
    let interval = null;
    const poll = async () => {
      try {
        // Check maintenance
        const mRes = await fetch("/api/maintenance-check");
        if (mRes.ok) { const m = await mRes.json(); if (m.maintenance) { window.location.replace("/maintenance"); return; } }
        const res = await fetch("/api/dashboard");
        if (res.status === 401) { try { await fetch("/api/auth/logout", { method: "POST" }); } catch {} window.location.replace("/?session_expired=1"); return; }
        if (res.ok) {
          const data = await res.json();
          if (data.user) setUser(data.user);
          if (data.orders) setOrders(data.orders);
          if (data.transactions) setTxs(data.transactions);
          if (data.alerts) setAlerts(data.alerts);
        }
      } catch {}
    };
    const start = () => { interval = setInterval(poll, 45000); };
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
          setPaymentStatus({ type: "success", message: "Payment successful!", amount: data.amount });
          /* Refresh user balance */
          try {
            const dashRes = await fetch("/api/dashboard");
            if (dashRes.ok) {
              const dashData = await dashRes.json();
              setUser(dashData.user);
              if (dashData.transactions) setTxs(dashData.transactions);
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
  useEffect(() => { if (!isServices) { setNoSelSvc(null); setNoSelTier(null); setNoLink(""); setNoCatModal(false); } }, [active]);

  const t = useMemo(() => ({
    ...baseT,
    sidebarBg: dark ? "#060810" : "#eceae5",
    sidebarBorder: dark ? "rgba(255,255,255,.08)" : "rgba(0,0,0,.1)",
    cardBg: dark ? "rgba(255,255,255,.04)" : "rgba(255,255,255,.8)",
    cardBorder: dark ? "rgba(255,255,255,.08)" : "rgba(0,0,0,.1)",
    navActive: dark ? "rgba(196,125,142,.1)" : "rgba(196,125,142,.1)",
  }), [dark, baseT]);

  const initials = user ? ((user.firstName?.[0] || '') + (user.lastName?.[0] || '')).toUpperCase() || user.name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2) : "";
  const firstName = user ? (user.firstName || user.name.split(" ")[0]) : "";
  const balance = user ? fN(user.balance) : "₦0";

  /* Loading — skeleton */
  if (!user) {
    const skBone = `skel-bone ${dark ? "skel-dark" : "skel-light"}`;
    return (
      <div className="dash-root" style={{ background: t.bg }}>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}@keyframes skeletonShimmer{0%{background-position:-200% 0}100%{background-position:200% 0}}`}</style>
        <nav className="dash-nav" style={{ background: t.sidebarBg, borderBottom: `0.5px solid ${t.sidebarBorder}` }}>
          <div className="dash-nav-left">
            <div className="dash-logo-static">
              <div className="dash-logo-box"><svg width="11" height="11" viewBox="0 0 20 20" fill="none"><path d="M4,16 L4,4 L16,16 L16,4" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg></div>
              <span className="dash-logo-text" style={{ color: t.text }}>NITRO</span>
            </div>
          </div>
          <div className="dash-nav-right">
            <div className={skBone} style={{ width: 44, height: 24, borderRadius: 12 }} />
            <div className={skBone} style={{ width: 30, height: 30, borderRadius: 10 }} />
          </div>
        </nav>
        <div className="dash-body">
          <aside className="dash-left" style={{ background: t.sidebarBg, borderRight: `0.5px solid ${t.sidebarBorder}` }}>
            {[1,2,3,4,5,6,7,8].map(i => <div key={i} className={skBone} style={{ height: 36, borderRadius: 12, margin: "0 0 4px" }} />)}
          </aside>
          <main className="dash-main" style={{ background: t.bg }}>
            <div className={skBone} style={{ width: 260, height: 24, marginBottom: 8 }} />
            <div className={skBone} style={{ width: 200, height: 14, marginBottom: 24 }} />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 12, marginBottom: 24 }}>
              {[1,2,3,4].map(i => (
                <div key={i} style={{ padding: 20, borderRadius: 16, background: dark ? "rgba(255,255,255,.03)" : "rgba(255,255,255,.85)", border: `0.5px solid ${t.cardBorder}` }}>
                  <div className={skBone} style={{ width: "60%", height: 10, marginBottom: 10 }} />
                  <div className={skBone} style={{ width: "45%", height: 24, marginBottom: 8 }} />
                  <div className={skBone} style={{ width: "70%", height: 9 }} />
                </div>
              ))}
            </div>
            <div className={skBone} style={{ width: 120, height: 10, marginBottom: 12 }} />
            <div style={{ borderRadius: 16, background: t.cardBg, borderWidth: 1, borderStyle: "solid", borderColor: t.cardBorder, padding: "4px 16px" }}>
              {[1,2,3,4].map(i => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 0", borderBottom: i < 4 ? `1px solid ${t.cardBorder}` : "none" }}>
                  <div>
                    <div className={skBone} style={{ width: 220, height: 13, marginBottom: 8 }} />
                    <div style={{ display: "flex", gap: 12 }}>
                      <div className={skBone} style={{ width: 70, height: 10 }} />
                      <div className={skBone} style={{ width: 50, height: 10 }} />
                    </div>
                  </div>
                  <div className={skBone} style={{ width: 60, height: 13 }} />
                </div>
              ))}
            </div>
          </main>
          <div className="dash-right" style={{ background: t.sidebarBg, borderLeft: `0.5px solid ${t.sidebarBorder}` }}>
            <div className={skBone} style={{ width: 100, height: 8, marginBottom: 14 }} />
            {[1,2,3].map(i => <div key={i} className={skBone} style={{ height: 50, borderRadius: 10, marginBottom: 6 }} />)}
            <div style={{ height: 2, background: t.sidebarBorder, margin: "12px 0" }} />
            <div className={skBone} style={{ width: 80, height: 8, marginBottom: 14 }} />
            <div className={skBone} style={{ height: 80, borderRadius: 12 }} />
          </div>
        </div>
      </div>
    );
  }

  /* Render active page */
  const renderPage = () => {
    switch (active) {
      case "overview":
        return <OverviewPage user={user} orders={orders} alerts={alerts} dark={dark} t={t} setActive={setActive} />;
      case "services":
        return <NewOrderPage dark={dark} t={t} user={user} onOrderSuccess={refreshDashboard} platform={noPlatform} setPlatform={setNoPlatform} selSvc={noSelSvc} setSelSvc={setNoSelSvc} selTier={noSelTier} setSelTier={setNoSelTier} qty={noQty} setQty={setNoQty} link={noLink} setLink={setNoLink} catModal={noCatModal} setCatModal={setNoCatModal} />;
      case "orders":
        return <OrdersPage orders={orders} txs={txs} dark={dark} t={t} />;
      case "referrals":
        return <ReferralsPage user={user} dark={dark} t={t} />;
      case "settings":
        return <SettingsPage user={user} dark={dark} t={t} themeMode={themeMode} setThemeMode={setThemeMode} setDark={setDark} />;
      case "support":
        return <SupportPage dark={dark} t={t} />;
      case "add-funds":
        return <AddFundsPage user={user} dark={dark} t={t} paymentStatus={paymentStatus} setPaymentStatus={setPaymentStatus} />;
      case "how-to":
        return <HowToPage dark={dark} t={t} />;
      default:
        return (
          <div className="dash-placeholder" style={{ background: dark ? "rgba(255,255,255,.03)" : "rgba(255,255,255,.85)", border: `0.5px solid ${t.cardBorder}` }}>
            <div style={{ color: t.textMuted, fontSize: 16, fontWeight: 500 }}>{active.charAt(0).toUpperCase() + active.slice(1).replace("-", " ")}</div>
            <div style={{ color: t.textMuted, fontSize: 14, opacity: .5, marginTop: 4 }}>Coming soon</div>
          </div>
        );
    }
  };

  return (
    <ToastProvider dark={dark}>
    <ConfirmProvider dark={dark}>
    <div className="dash-root" style={{ background: t.bg }}>

      {/* ═══ TOP NAV ═══ */}
      <nav className="dash-nav" style={{ background: t.sidebarBg, borderBottom: `0.5px solid ${t.sidebarBorder}` }}>
        <div className="dash-nav-left">
          {/* Mobile/tablet: hamburger + logo as one button to toggle sidebar */}
          <button className="dash-menu-btn" onClick={() => setLeftOpen(!leftOpen)}>
            <div className="dash-hamburger-bars" style={{ opacity: leftOpen ? 0 : 1, position: leftOpen ? "absolute" : "relative" }}>
              <div style={{ height: 2, borderRadius: 1, background: t.accent, width: 16 }} />
              <div style={{ height: 2, borderRadius: 1, background: t.accent, width: 11 }} />
              <div style={{ height: 2, borderRadius: 1, background: t.accent, width: 16 }} />
            </div>
            {leftOpen && (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={t.accent} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            )}
            <div className="dash-logo-box">
              <svg width="11" height="11" viewBox="0 0 20 20" fill="none"><path d="M4,16 L4,4 L16,16 L16,4" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </div>
            <span className="dash-logo-text" style={{ color: t.text }}>NITRO</span>
          </button>
          {/* Desktop: static logo, no click action */}
          <div className="dash-logo-static">
            <div className="dash-logo-box">
              <svg width="11" height="11" viewBox="0 0 20 20" fill="none"><path d="M4,16 L4,4 L16,16 L16,4" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </div>
            <span className="dash-logo-text" style={{ color: t.text }}>NITRO</span>
          </div>
        </div>
        <div className="dash-nav-right">
          {/* Theme toggle */}
          <button onClick={toggleTheme} className="dash-theme-toggle" style={{ background: dark ? "rgba(99,102,241,.2)" : "rgba(0,0,0,.06)", border: `0.5px solid ${dark ? "rgba(99,102,241,.15)" : "rgba(0,0,0,.08)"}` }}>
            <div className="dash-theme-thumb" style={{ background: dark ? "#1e1b4b" : "#fff", left: dark ? 23 : 3, boxShadow: dark ? "0 0 6px rgba(99,102,241,.3)" : "0 1px 4px rgba(0,0,0,.15)" }}>
              {dark
                ? <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#a5b4fc" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/></svg>
                : <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
              }
            </div>
          </button>
          {/* Notification bell */}
          <div ref={notifRef} style={{ position: "relative" }}>
            <button onClick={() => setNotifOpen(!notifOpen)} className="dash-bell" style={{ color: t.textSoft }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></svg>
              {bellUnread > 0 && <div className="dash-bell-badge">{bellUnread > 10 ? "10+" : bellUnread}</div>}
            </button>
            {notifOpen && <NotifDropdown orders={orders} txs={txs} dark={dark} t={t} onClose={() => setNotifOpen(false)} readIds={readNotifIds} setReadIds={setReadNotifIds} clearedIds={clearedNotifIds} setClearedIds={setClearedNotifIds} notifClearedAt={notifClearedAt} setClearedAt={setNotifClearedAt} />}
          </div>
          {/* Avatar → Settings */}
          <button onClick={() => { setActive("settings"); setLeftOpen(false); }} className="dash-avatar-btn">
            <div className="dash-avatar" style={{ background: t.accent }}>{initials}</div>
            <span className="dash-nav-name" style={{ color: t.text, textTransform: "uppercase" }}>{firstName}</span>
          </button>
        </div>
      </nav>

      {/* ═══ BODY ═══ */}
      <div className="dash-body">

        {/* ── LEFT SIDEBAR ── */}
        <aside className="dash-left" style={{ background: t.sidebarBg, borderRight: `0.5px solid ${t.sidebarBorder}`, left: leftOpen ? 0 : undefined }}>

            {/* ── Regular nav items — always shown ── */}
            <>
              {NAV_ITEMS.map(item => {
                const processingCount = item.id === "orders" ? orders.filter(o => o.status === "Processing" || o.status === "Pending").length : 0;
                return (
                  <button key={item.id} onClick={() => { setActive(item.id); setLeftOpen(false); }} className="dash-nav-item" style={{ background: active === item.id ? t.navActive : "transparent", color: active === item.id ? t.accent : t.textSoft, fontWeight: active === item.id ? 600 : 450 }}>
                    <span style={{ opacity: active === item.id ? 1 : .6, flexShrink: 0 }}>{I[item.id]}</span>
                    {item.label}
                    {processingCount > 0 && <span className="m dash-nav-badge">{processingCount > 9 ? "9+" : processingCount}</span>}
                  </button>
                );
              })}
            </>

          <div style={{ flex: 1 }} />
          <div className="dash-sidebar-divider" style={{ background: t.sidebarBorder }} />
          <div className="dash-sidebar-balance">
            <div className="dash-bal-label" style={{ color: t.textMuted }}>Balance</div>
            <div className="m dash-bal-value" style={{ color: t.green }}>{balance}</div>
          </div>
          <div className="dash-sidebar-divider" style={{ background: t.sidebarBorder }} />
          <div className="dash-sidebar-social">
            <div className="dash-social-label" style={{ color: t.textMuted }}>Join our community</div>
            <div className="dash-social-btns">
              {socialLinks.social_whatsapp ? (
                <a href={socialLinks.social_whatsapp} target="_blank" rel="noopener" className="dash-social-btn dash-social-wa">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                  WhatsApp
                </a>
              ) : (
                <span className="dash-social-btn dash-social-wa" style={{ opacity: .5, cursor: "default" }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                  WhatsApp
                </span>
              )}
              {socialLinks.social_telegram ? (
                <a href={socialLinks.social_telegram} target="_blank" rel="noopener" className="dash-social-btn dash-social-tg">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M11.944 0A12 12 0 000 12a12 12 0 0012 12 12 12 0 0012-12A12 12 0 0012 0a12 12 0 00-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 01.171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.479.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/></svg>
                  Telegram
                </a>
              ) : (
                <span className="dash-social-btn dash-social-tg" style={{ opacity: .5, cursor: "default" }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M11.944 0A12 12 0 000 12a12 12 0 0012 12 12 12 0 0012-12A12 12 0 0012 0a12 12 0 00-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 01.171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.479.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/></svg>
                  Telegram
                </span>
              )}
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
          {!isServices && !isOrders && !isReferrals && !isSettings && !isSupport && !isAddFunds && !isHowTo && <>
            <div className="dash-welcome" style={{ color: t.text }}>What's good, {firstName}</div>
            <div className="dash-welcome-sub" style={{ color: t.textMuted }}>Here's your empire at a glance</div>
          </>}

          <div key={active} className="dash-page-enter" style={isSupport ? { flex: 1, display: "flex", flexDirection: "column", minHeight: 0, overflow: "hidden" } : undefined}>
            {renderPage()}
          </div>

          {/* Footer */}
          <div className="dash-footer" style={{ borderTopColor: t.sidebarBorder, flexShrink: 0 }}>
            <span style={{ color: t.textMuted }}>© {new Date().getFullYear() > 2026 ? `2026–${new Date().getFullYear()}` : "2026"} Nitro</span>
            <div className="dash-footer-links">
              <a href="/terms" style={{ color: t.textMuted }}>Terms</a>
              <a href="/privacy" style={{ color: t.textMuted }}>Privacy</a>
              <a href={`https://instagram.com/${socialLinks.social_instagram || "Nitro.ng"}`} target="_blank" rel="noopener" style={{ color: t.textMuted }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1112.63 8 4 4 0 0116 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/></svg>
              </a>
              <a href={`https://x.com/${socialLinks.social_twitter || "TheNitroNG"}`} target="_blank" rel="noopener" style={{ color: t.textMuted }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
              </a>
            </div>
          </div>
        </main>

        {/* ── RIGHT SIDEBAR ── */}
        <aside className="dash-right" style={{ background: t.sidebarBg, borderLeft: `0.5px solid ${t.sidebarBorder}` }}>
          {isServices ? (
            noHasOrder ? (
              <OrderForm selSvc={noSelSvc} selTier={noSelTier} platform={noPlatform} qty={noQty} setQty={setNoQty} link={noLink} setLink={setNoLink} dark={dark} t={t} compact />
            ) : (
              <>
              <ServicesSidebar dark={dark} t={t} />
              <div className="dash-rs-empty" style={{ marginTop: 16 }}>
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke={t.textMuted} strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: .3, marginBottom: 12 }}><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
                <div style={{ fontSize: 15, color: t.textMuted, textAlign: "center", fontWeight: 450 }}>Select a service</div>
                <div style={{ fontSize: 14, color: t.textMuted, opacity: .5, marginTop: 4, textAlign: "center" }}>Choose a platform and service to place an order</div>
              </div>
              </>
            )
          ) : isOrders ? (
            <OrdersSidebar orders={orders} dark={dark} t={t} />
          ) : isReferrals ? (
            <ReferralsSidebar user={user} dark={dark} t={t} />
          ) : isSettings ? (
            <SettingsSidebar user={user} dark={dark} t={t} />
          ) : isSupport ? (
            <SupportSidebar dark={dark} t={t} tickets={[]} />
          ) : isAddFunds ? (
            <AddFundsSidebar user={user} txs={txs} dark={dark} t={t} />
          ) : isHowTo ? (
            <HowToSidebar dark={dark} t={t} />
          ) : (
            <RightSidebar orders={orders} user={user} dark={dark} t={t} setActive={setActive} />
          )}
        </aside>
      </div>
    </div>
    </ConfirmProvider>
    </ToastProvider>
  );
}
