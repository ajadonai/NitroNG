'use client';
import { useState, useEffect, useMemo, useRef } from "react";
import NewOrderPage, { PLATFORMS, PLATFORM_GROUPS, OrderForm } from "./new-order";
import OrdersPage, { OrdersSidebar } from "./orders-page";
import ReferralsPage, { ReferralsSidebar } from "./referrals-page";
import ServicesPage, { ServicesSidebar } from "./services-page";
import SettingsPage, { SettingsSidebar } from "./settings-page";
import SupportPage, { SupportSidebar } from "./support-page";
import AddFundsPage, { AddFundsSidebar } from "./addfunds-page";

/* ═══════════════════════════════════════════ */
/* ═══ SVG ICONS                          ═══ */
/* ═══════════════════════════════════════════ */
const I = {
  overview: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>,
  "new-order": <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>,
  orders: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>,
  "add-funds": <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/><path d="M7 15h2"/></svg>,
  services: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>,
  referrals: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>,
  support: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>,
  settings: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09a1.65 1.65 0 00-1-1.51 1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>,
};

const NAV_ITEMS = [
  { id: "overview", label: "Overview" },
  { id: "new-order", label: "New Order" },
  { id: "orders", label: "Orders" },
  { id: "add-funds", label: "Add Funds" },
  { id: "services", label: "Services" },
  { id: "referrals", label: "Referrals" },
  { id: "support", label: "Support" },
  { id: "settings", label: "Settings" },
];

const fN = (a) => `₦${Math.abs(a).toLocaleString("en-NG")}`;
const fD = (d) => new Date(d).toLocaleDateString("en-NG", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });

/* ── Status helpers ── */
function sClr(s, dk) { return s === "Completed" ? (dk ? "#6ee7b7" : "#059669") : s === "Processing" ? (dk ? "#a5b4fc" : "#4f46e5") : s === "Pending" ? (dk ? "#fcd34d" : "#d97706") : s === "Partial" ? (dk ? "#fca5a5" : "#dc2626") : (dk ? "#555250" : "#8a8785"); }
function sBg(s, dk) { return s === "Completed" ? (dk ? "#0a2416" : "#ecfdf5") : s === "Processing" ? (dk ? "#0f1629" : "#eef2ff") : s === "Pending" ? (dk ? "#1c1608" : "#fffbeb") : s === "Partial" ? (dk ? "#1f0a0a" : "#fef2f2") : (dk ? "#141414" : "#f5f5f5"); }
function sBrd(s, dk) { return s === "Completed" ? (dk ? "#166534" : "#a7f3d0") : s === "Processing" ? (dk ? "#3730a3" : "#c7d2fe") : s === "Pending" ? (dk ? "#92400e" : "#fde68a") : s === "Partial" ? (dk ? "#991b1b" : "#fecaca") : (dk ? "#404040" : "#d4d4d4"); }

function Badge({ status, dark }) {
  return <span style={{ fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 5, background: sBg(status, dark), color: sClr(status, dark), borderWidth: .5, borderStyle: "solid", borderColor: sBrd(status, dark), whiteSpace: "nowrap", display: "inline-block" }}>{status}</span>;
}

/* ═══════════════════════════════════════════ */
/* ═══ OVERVIEW PAGE                      ═══ */
/* ═══════════════════════════════════════════ */
function OverviewPage({ user, orders, alerts, dark, t }) {
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
          <span style={{ fontSize: 14, flexShrink: 0 }}>{a.type === "warning" ? "⚠️" : "📢"}</span>
          <span style={{ flex: 1 }}>{a.message}</span>
        </div>
      ))}

      {/* Stat cards */}
      <div className="dash-stats">
        {[
          ["Wallet Balance", balance, t.green, "+₦2,000 this week"],
          ["Total Orders", String(total), dark ? "#a5b4fc" : "#4f46e5", "3 this week"],
          ["Processing", String(processing), dark ? "#e0a458" : "#d97706", "Est. 1-2 hrs"],
          ["Completed", String(completed), dark ? "#6ee7b7" : "#059669", rate + "% success"],
        ].map(([label, val, color, sub]) => (
          <div key={label} className="dash-stat-card" style={{ background: t.cardBg, borderWidth: 1, borderStyle: "solid", borderColor: t.cardBorder }}>
            <div className="dash-stat-label" style={{ color: t.textMuted }}>{label}</div>
            <div className="m dash-stat-value" style={{ color }}>{val}</div>
            <div className="dash-stat-sub" style={{ color: t.textMuted }}>{sub}</div>
          </div>
        ))}
      </div>

      {/* Recent orders */}
      <div className="dash-section-title" style={{ color: t.textMuted }}>Recent Orders</div>
      <div className="dash-orders-card" style={{ background: t.cardBg, borderWidth: 1, borderStyle: "solid", borderColor: t.cardBorder }}>
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
            <div style={{ color: t.textSoft }}>No orders yet</div>
            <div style={{ color: t.textMuted, fontSize: 12, marginTop: 4 }}>Place your first order to see activity here</div>
          </div>
        )}
        {orders.length > 5 && (
          <div className="dash-view-all"><button style={{ color: t.accent }}>View all orders →</button></div>
        )}
      </div>

      {/* Referral card — tablet/mobile only */}
      <div className="dash-mobile-ref" style={{ background: t.cardBg, borderWidth: 1, borderStyle: "solid", borderColor: t.cardBorder }}>
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
function RightSidebar({ orders, user, dark, t }) {
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
          {activeOrders.length === 0 && <div style={{ fontSize: 11, color: t.textMuted }}>No active orders</div>}
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
          <button className="dash-rs-viewall" style={{ color: t.accent }}>View all {activeOrders.length} active →</button>
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
        <div className="dash-rs-ref-card" style={{ background: t.cardBg, borderWidth: 1, borderStyle: "solid", borderColor: t.cardBorder }}>
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
function NotifDropdown({ orders, txs, dark, t, onClose }) {
  const items = [
    ...orders.filter(o => o.status === "Completed").slice(0, 3).map(o => ({
      msg: `Order ${o.id} completed`, time: o.created ? fD(o.created) : "",
      icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={dark ? "#6ee7b7" : "#059669"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>,
      iconBg: dark ? "rgba(110,231,183,.1)" : "rgba(5,150,105,.06)",
    })),
    ...txs.filter(tx => tx.type === "deposit").slice(0, 2).map(tx => ({
      msg: `Deposit of ${fN(tx.amount)} received`, time: tx.date ? fD(tx.date) : "",
      icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={dark ? "#6ee7b7" : "#059669"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/></svg>,
      iconBg: dark ? "rgba(110,231,183,.1)" : "rgba(5,150,105,.06)",
    })),
  ];

  return (
    <div className="dash-notif" style={{
      background: dark ? "rgba(13,16,32,.98)" : "rgba(255,255,255,.98)",
      borderWidth: 1, borderStyle: "solid", borderColor: t.cardBorder,
      boxShadow: dark ? "0 12px 40px rgba(0,0,0,.5)" : "0 12px 40px rgba(0,0,0,.12)",
    }}>
      <div className="dash-notif-header">
        <span style={{ fontSize: 13, fontWeight: 600, color: t.text }}>Notifications</span>
        <button style={{ fontSize: 11, fontWeight: 500, color: t.accent, background: "none" }}>Mark all read</button>
      </div>
      <div className="dash-notif-list">
        {items.length > 0 ? items.map((n, i) => (
          <div key={i} className="dash-notif-item" style={{ borderBottom: i < items.length - 1 ? `1px solid ${t.cardBorder}` : "none" }}>
            <div className="dash-notif-icon" style={{ background: n.iconBg }}>{n.icon}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 500, color: t.text }}>{n.msg}</div>
              <div style={{ fontSize: 10, color: t.textMuted, marginTop: 2 }}>{n.time}</div>
            </div>
          </div>
        )) : (
          <div style={{ padding: "20px 16px", textAlign: "center", fontSize: 12, color: t.textMuted }}>No new notifications</div>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════ */
/* ═══ MAIN DASHBOARD SHELL               ═══ */
/* ═══════════════════════════════════════════ */
export default function Dashboard() {
  const getAuto = () => { const h = new Date().getHours(), m = new Date().getMinutes(); if (h >= 7 && h < 18) return false; if (h >= 19 || h < 6) return true; if (h === 6) return m < 30; if (h === 18) return m >= 30; return true; };
  const [dark, setDark] = useState(false);
  const [themeMode, setThemeMode] = useState("auto");
  const [active, setActive] = useState("overview");
  const [leftOpen, setLeftOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [user, setUser] = useState(null);
  const [orders, setOrders] = useState([]);
  const [txs, setTxs] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [paymentStatus, setPaymentStatus] = useState(null); // { type: "success"|"error", message, amount }
  const notifRef = useRef(null);

  /* New Order state (lifted so sidebars can access) */
  const [noPlatform, setNoPlatform] = useState("instagram");
  const [noSelSvc, setNoSelSvc] = useState(null);
  const [noSelTier, setNoSelTier] = useState(null);
  const [noQty, setNoQty] = useState(1000);
  const [noLink, setNoLink] = useState("");
  const [noCatModal, setNoCatModal] = useState(false);
  const isNewOrder = active === "new-order";
  const isOrders = active === "orders";
  const isReferrals = active === "referrals";
  const isServices = active === "services";
  const isSettings = active === "settings";
  const isSupport = active === "support";
  const isAddFunds = active === "add-funds";
  const noHasOrder = noSelSvc && noSelTier;

  /* Services page state */
  const [svcPlatform, setSvcPlatform] = useState("instagram");
  const [svcCatModal, setSvcCatModal] = useState(false);

  /* Theme */
  useEffect(() => { const saved = localStorage.getItem("nitro-theme") || "auto"; setThemeMode(saved); if (saved === "day") setDark(false); else if (saved === "night") setDark(true); else setDark(getAuto()); }, []);
  useEffect(() => { if (themeMode !== "auto") return; const iv = setInterval(() => setDark(getAuto()), 60000); return () => clearInterval(iv); }, [themeMode]);
  const toggleTheme = () => { const next = !dark; setDark(next); const mode = next ? "night" : "day"; setThemeMode(mode); localStorage.setItem("nitro-theme", mode); };

  /* Data fetch */
  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/dashboard");
        if (res.status === 401) { window.location.href = "/?login=1"; return; }
        if (res.ok) {
          const data = await res.json();
          setUser(data.user);
          if (data.orders?.length) setOrders(data.orders);
          if (data.transactions?.length) setTxs(data.transactions);
          if (data.alerts?.length) setAlerts(data.alerts);
        } else setUser({ name: "User", email: "", balance: 0, refCode: "—", refs: 0, earnings: 0 });
      } catch { setUser({ name: "User", email: "", balance: 0, refCode: "—", refs: 0, earnings: 0 }); }
    }
    load();
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
              if (dashData.transactions?.length) setTxs(dashData.transactions);
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

  /* Reset new-order state when leaving */
  useEffect(() => { if (!isNewOrder) { setNoSelSvc(null); setNoSelTier(null); setNoLink(""); setNoCatModal(false); } }, [active]);

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
    navActive: dark ? "rgba(196,125,142,.1)" : "rgba(196,125,142,.1)",
    green: dark ? "#6ee7b7" : "#059669",
  }), [dark]);

  const initials = user ? user.name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2) : "";
  const firstName = user ? user.name.split(" ")[0] : "";
  const balance = user ? fN(user.balance) : "₦0";

  /* Loading */
  const sp = dark ? "rgba(196,125,142,.3)" : "rgba(196,125,142,.2)";
  if (!user) return <div style={{ height: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", background: t.bg }}><div style={{ width: 24, height: 24, borderWidth: 2, borderStyle: "solid", borderTopColor: t.accent, borderRightColor: sp, borderBottomColor: sp, borderLeftColor: sp, borderRadius: "50%", animation: "spin .6s linear infinite" }} /></div>;

  /* Render active page */
  const renderPage = () => {
    switch (active) {
      case "overview":
        return <OverviewPage user={user} orders={orders} alerts={alerts} dark={dark} t={t} />;
      case "new-order":
        return <NewOrderPage dark={dark} t={t} platform={noPlatform} setPlatform={setNoPlatform} selSvc={noSelSvc} setSelSvc={setNoSelSvc} selTier={noSelTier} setSelTier={setNoSelTier} qty={noQty} setQty={setNoQty} link={noLink} setLink={setNoLink} catModal={noCatModal} setCatModal={setNoCatModal} />;
      case "orders":
        return <OrdersPage orders={orders} txs={txs} dark={dark} t={t} />;
      case "referrals":
        return <ReferralsPage user={user} dark={dark} t={t} />;
      case "services":
        return <ServicesPage dark={dark} t={t} svcPlatform={svcPlatform} setSvcPlatform={setSvcPlatform} onOrderNav={(plat) => { if (plat) setNoPlatform(plat); setActive("new-order"); }} catModal={svcCatModal} setCatModal={setSvcCatModal} />;
      case "settings":
        return <SettingsPage user={user} dark={dark} t={t} themeMode={themeMode} setThemeMode={setThemeMode} setDark={setDark} />;
      case "support":
        return <SupportPage dark={dark} t={t} tickets={[]} />;
      case "add-funds":
        return <AddFundsPage user={user} dark={dark} t={t} paymentStatus={paymentStatus} setPaymentStatus={setPaymentStatus} />;
      default:
        return (
          <div className="dash-placeholder" style={{ background: t.cardBg, borderWidth: 1, borderStyle: "solid", borderColor: t.cardBorder }}>
            <div style={{ color: t.textMuted, fontSize: 14, fontWeight: 500 }}>{active.charAt(0).toUpperCase() + active.slice(1).replace("-", " ")}</div>
            <div style={{ color: t.textMuted, fontSize: 12, opacity: .5, marginTop: 4 }}>Coming soon</div>
          </div>
        );
    }
  };

  return (
    <div className="dash-root" style={{ background: t.bg }}>

      {/* ═══ TOP NAV ═══ */}
      <nav className="dash-nav" style={{ background: t.sidebarBg, borderBottom: `1px solid ${t.sidebarBorder}` }}>
        <div className="dash-nav-left">
          <button className="dash-hamburger" onClick={() => setLeftOpen(!leftOpen)} style={{ color: t.textSoft }}>
            {leftOpen
              ? <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              : <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
            }
          </button>
          <a href="/" className="dash-logo-link">
            <div className="dash-logo-box">
              <svg width="11" height="11" viewBox="0 0 20 20" fill="none"><path d="M4,16 L4,4 L16,16 L16,4" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </div>
            <span className="dash-logo-text" style={{ color: t.text }}>NITRO</span>
          </a>
        </div>
        <div className="dash-nav-right">
          {/* Theme toggle */}
          <button onClick={toggleTheme} className="dash-theme-toggle" style={{ background: dark ? "rgba(99,102,241,.25)" : "rgba(0,0,0,.06)", borderWidth: 1, borderStyle: "solid", borderColor: dark ? "rgba(99,102,241,.2)" : "rgba(0,0,0,.08)" }}>
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
              <div className="dash-bell-dot" />
            </button>
            {notifOpen && <NotifDropdown orders={orders} txs={txs} dark={dark} t={t} onClose={() => setNotifOpen(false)} />}
          </div>
          {/* Avatar */}
          <button className="dash-avatar-btn">
            <div className="dash-avatar" style={{ background: t.accent }}>{initials}</div>
            <span className="dash-nav-name" style={{ color: t.text, textTransform: "uppercase" }}>{firstName}</span>
          </button>
        </div>
      </nav>

      {/* ═══ BODY ═══ */}
      <div className="dash-body">

        {/* ── LEFT SIDEBAR ── */}
        <aside className="dash-left" style={{ background: t.sidebarBg, borderRight: `1px solid ${t.sidebarBorder}`, left: leftOpen ? 0 : undefined }}>

          {(isNewOrder || isServices) ? (
            /* ── Platform categories for New Order / Services ── */
            <>
              <button onClick={() => { setActive("overview"); setLeftOpen(false); }} className="dash-nav-item" style={{ color: t.accent, fontWeight: 550, marginBottom: 8 }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><polyline points="15 18 9 12 15 6"/></svg>
                ← Back to menu
              </button>
              <div style={{ fontSize: 10, fontWeight: 650, color: t.textMuted, textTransform: "uppercase", letterSpacing: 1.5, padding: "0 14px 8px" }}>Platforms</div>
              <div className="dash-plat-list">
                {PLATFORM_GROUPS.map(group => (
                  <div key={group.label}>
                    <div style={{ fontSize: 9, fontWeight: 600, color: t.accent, textTransform: "uppercase", letterSpacing: 1, padding: "10px 14px 4px", opacity: .7 }}>{group.label}</div>
                    {group.platforms.map(p => {
                      const currentPlat = isNewOrder ? noPlatform : svcPlatform;
                      const setPlat = isNewOrder ? setNoPlatform : setSvcPlatform;
                      return (
                        <button key={p.id} onClick={() => { setPlat(p.id); setLeftOpen(false); }} className="dash-nav-item" style={{ background: currentPlat === p.id ? t.navActive : "transparent", color: currentPlat === p.id ? t.accent : t.textSoft, fontWeight: currentPlat === p.id ? 600 : 430 }}>
                          <span style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 18, opacity: currentPlat === p.id ? 1 : .5, flexShrink: 0 }}>{p.icon}</span>
                          {p.label}
                        </button>
                      );
                    })}
                  </div>
                ))}
              </div>
            </>
          ) : (
            /* ── Regular nav items ── */
            <>
              {NAV_ITEMS.map(item => (
                <button key={item.id} onClick={() => { setActive(item.id); setLeftOpen(false); }} className="dash-nav-item" style={{ background: active === item.id ? t.navActive : "transparent", color: active === item.id ? t.accent : t.textSoft, fontWeight: active === item.id ? 600 : 450 }}>
                  <span style={{ opacity: active === item.id ? 1 : .6, flexShrink: 0 }}>{I[item.id]}</span>
                  {item.label}
                </button>
              ))}
            </>
          )}

          <div style={{ flex: 1 }} />
          <div className="dash-sidebar-divider" style={{ background: t.sidebarBorder }} />
          <div className="dash-sidebar-balance">
            <div className="dash-bal-label" style={{ color: t.textMuted }}>Balance</div>
            <div className="m dash-bal-value" style={{ color: t.green }}>{balance}</div>
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
        <main className="dash-main" style={{ background: t.bg }}>
          {!isNewOrder && !isOrders && !isReferrals && !isServices && !isSettings && !isSupport && !isAddFunds && <>
            <div className="dash-welcome" style={{ color: t.text }}>Welcome back, {firstName.toUpperCase()}</div>
            <div className="dash-welcome-sub" style={{ color: t.textMuted }}>Here's what's happening with your account.</div>
          </>}

          {renderPage()}

          {/* Footer */}
          <div className="dash-footer" style={{ borderTop: `1px solid ${t.sidebarBorder}` }}>
            <span style={{ color: t.textMuted }}>© 2026 Nitro</span>
            <div className="dash-footer-links">
              <a href="/terms" style={{ color: t.textMuted }}>Terms</a>
              <a href="/privacy" style={{ color: t.textMuted }}>Privacy</a>
              <a href="https://instagram.com/Nitro.ng" target="_blank" rel="noopener" style={{ color: t.textMuted }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1112.63 8 4 4 0 0116 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/></svg>
              </a>
              <a href="https://x.com/TheNitroNG" target="_blank" rel="noopener" style={{ color: t.textMuted }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
              </a>
            </div>
          </div>
        </main>

        {/* ── RIGHT SIDEBAR ── */}
        <aside className="dash-right" style={{ background: t.sidebarBg, borderLeft: `1px solid ${t.sidebarBorder}` }}>
          {isNewOrder ? (
            noHasOrder ? (
              <OrderForm selSvc={noSelSvc} selTier={noSelTier} platform={noPlatform} qty={noQty} setQty={setNoQty} link={noLink} setLink={setNoLink} dark={dark} t={t} compact />
            ) : (
              <div className="dash-rs-empty">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke={t.textMuted} strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: .3, marginBottom: 12 }}><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
                <div style={{ fontSize: 13, color: t.textMuted, textAlign: "center", fontWeight: 450 }}>Select a service</div>
                <div style={{ fontSize: 11, color: t.textMuted, opacity: .5, marginTop: 4, textAlign: "center" }}>Choose a platform and service to place an order</div>
              </div>
            )
          ) : isOrders ? (
            <OrdersSidebar orders={orders} dark={dark} t={t} />
          ) : isReferrals ? (
            <ReferralsSidebar user={user} dark={dark} t={t} />
          ) : isServices ? (
            <ServicesSidebar dark={dark} t={t} onOrderNav={() => setActive("new-order")} />
          ) : isSettings ? (
            <SettingsSidebar user={user} dark={dark} t={t} />
          ) : isSupport ? (
            <SupportSidebar dark={dark} t={t} tickets={[]} />
          ) : isAddFunds ? (
            <AddFundsSidebar user={user} txs={txs} dark={dark} t={t} />
          ) : (
            <RightSidebar orders={orders} user={user} dark={dark} t={t} />
          )}
        </aside>
      </div>
    </div>
  );
}
