'use client';
import { useState, useEffect } from "react";
import { useConfirm } from "./confirm-dialog";
import { PlatformIcon } from "./platform-icon";
import { fN, fD } from "../lib/format";


/* ── Status helpers ── */
function sClr(s, dk) { return s === "Completed" ? (dk ? "#6ee7b7" : "#059669") : s === "Processing" ? (dk ? "#a5b4fc" : "#4f46e5") : s === "Pending" ? (dk ? "#fcd34d" : "#d97706") : s === "Partial" ? (dk ? "#fca5a5" : "#dc2626") : s === "Cancelled" ? (dk ? "#888" : "#666") : (dk ? "#555" : "#888"); }
function sBg(s, dk) { return s === "Completed" ? (dk ? "#0a2416" : "#ecfdf5") : s === "Processing" ? (dk ? "#0f1629" : "#eef2ff") : s === "Pending" ? (dk ? "#1c1608" : "#fffbeb") : s === "Partial" ? (dk ? "#1f0a0a" : "#fef2f2") : (dk ? "#1a1a1a" : "#f5f5f5"); }
function sBrd(s, dk) { return s === "Completed" ? (dk ? "#166534" : "#a7f3d0") : s === "Processing" ? (dk ? "#3730a3" : "#c7d2fe") : s === "Pending" ? (dk ? "#92400e" : "#fde68a") : s === "Partial" ? (dk ? "#991b1b" : "#fecaca") : (dk ? "#404040" : "#d4d4d4"); }
function txClr(type, dk) { return type === "deposit" ? (dk ? "#6ee7b7" : "#059669") : type === "referral" ? "#c47d8e" : type === "refund" ? (dk ? "#fcd34d" : "#d97706") : (dk ? "#fca5a5" : "#dc2626"); }
function txIcon(type) { return type === "deposit" ? "↓" : type === "referral" ? "★" : type === "refund" ? "↩" : "↑"; }

function Badge({ status, dark }) {
  return <span style={{ fontSize: 13, fontWeight: 600, padding: "2px 8px", borderRadius: 5, background: sBg(status, dark), color: sClr(status, dark), borderWidth: .5, borderStyle: "solid", borderColor: sBrd(status, dark), whiteSpace: "nowrap", display: "inline-block" }}>{status}</span>;
}

const PER_PAGE_OPTIONS = [5, 10, 20];

function Pagination({ total, page, setPage, perPage, setPerPage, t }) {
  const totalPages = Math.ceil(total / perPage);
  if (total <= 5) return null;
  return (
    <div className="ord-pagination">
      <div className="ord-pag-left">
        <span style={{ color: t.textMuted }}>Show</span>
        <select value={perPage} onChange={e => { const v = Number(e.target.value); setPerPage(v); setPage(1); try { localStorage.setItem("nitro-per-page", String(v)); } catch {} fetch("/api/auth/notifications", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ perPagePreference: v }) }).catch(() => {}); }} className="m ord-pag-select" style={{ background: t.cardBg, borderColor: t.cardBorder, color: t.text }}>
          {PER_PAGE_OPTIONS.map(n => <option key={n} value={n}>{n}</option>)}
        </select>
        <span style={{ color: t.textMuted }}>{total} total</span>
      </div>
      <div className="ord-pag-right">
        <button onClick={() => setPage(Math.max(1, page - 1))} disabled={page <= 1} className="ord-pag-btn" style={{ borderColor: t.cardBorder, color: t.textSoft, opacity: page <= 1 ? .3 : 1 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
          let p;
          if (totalPages <= 5) p = i + 1;
          else if (page <= 2) p = i + 1;
          else if (page >= totalPages - 1) p = totalPages - 4 + i;
          else p = page - 2 + i;
          return (
            <button key={p} onClick={() => setPage(p)} className={`m ord-pag-num${page === p ? " active" : ""}`} style={{ background: page === p ? t.navActive : "transparent", color: page === p ? t.accent : t.textMuted, borderColor: page === p ? t.accent + "40" : t.cardBorder }}>{p}</button>
          );
        })}
        <button onClick={() => setPage(Math.min(totalPages, page + 1))} disabled={page >= totalPages} className="ord-pag-btn" style={{ borderColor: t.cardBorder, color: t.textSoft, opacity: page >= totalPages ? .3 : 1 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>
        </button>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════ */
/* ═══ ORDERS PAGE                         ═══ */
/* ═══════════════════════════════════════════ */
export default function OrdersPage({ orders: initialOrders, txs, dark, t }) {
  const confirm = useConfirm();
  const [orders, setOrders] = useState(initialOrders);
  const [tab, setTab] = useState("orders");
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [txFilter, setTxFilter] = useState("all");
  const [expanded, setExpanded] = useState(null);
  const [oPage, setOPage] = useState(1);
  const [tPage, setTPage] = useState(1);
  const [actionLoading, setActionLoading] = useState(null);
  const [orderMsg, setOrderMsg] = useState({}); // { [orderId]: { type, text } }

  useEffect(() => { setOrders(initialOrders); }, [initialOrders]);

  const doAction = async (orderId, action) => {
    setActionLoading(orderId);
    setOrderMsg(prev => { const n = { ...prev }; delete n[orderId]; return n; });
    try {
      const res = await fetch("/api/orders", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, orderId }) });
      const data = await res.json();
      if (!res.ok) { setOrderMsg(prev => ({ ...prev, [orderId]: { type: "error", text: data.error || "Action failed" } })); setActionLoading(null); return; }
      if (action === "check") {
        if (data.status) setOrders(prev => prev.map(o => (o.id === orderId ? { ...o, status: data.status } : o)));
        setOrderMsg(prev => ({ ...prev, [orderId]: { type: "success", text: `${data.status}${data.remains != null ? " · " + data.remains + " remaining" : ""}` } }));
      } else if (action === "cancel") {
        setOrders(prev => prev.map(o => (o.id === orderId ? { ...o, status: "Cancelled" } : o)));
        setOrderMsg(prev => ({ ...prev, [orderId]: { type: "success", text: `Cancelled${data.refunded ? " · ₦" + data.refunded.toLocaleString() + " refunded" : ""}` } }));
      } else if (action === "reorder") {
        setOrderMsg(prev => ({ ...prev, [orderId]: { type: "success", text: `Reorder placed — ${data.order?.id || ""}` } }));
      }
    } catch { setOrderMsg(prev => ({ ...prev, [orderId]: { type: "error", text: "Request failed" } })); }
    setActionLoading(null);
  };

  /* Per-page preference from localStorage */
  const [perPage, setPerPage] = useState(10);
  useEffect(() => {
    try { const saved = localStorage.getItem("nitro-per-page"); if (saved) setPerPage(Number(saved)); } catch {}
  }, []);

  const filteredOrders = orders.filter(o => {
    if (filter !== "all" && o.status !== filter) return false;
    if (search && !o.id?.toLowerCase().includes(search.toLowerCase()) && !o.service?.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });
  const pagedOrders = filteredOrders.slice((oPage - 1) * perPage, oPage * perPage);

  const filteredTxs = txs.filter(tx => txFilter === "all" || tx.type === txFilter);
  const pagedTxs = filteredTxs.slice((tPage - 1) * perPage, tPage * perPage);

  const counts = { all: orders.length };
  ["Completed", "Processing", "Pending", "Partial", "Cancelled"].forEach(s => { counts[s] = orders.filter(o => o.status === s).length; });

  return (
    <>
      {/* Header */}
      <div className="ord-header">
        <div className="ord-title" style={{ color: t.text }}>History</div>
        <div className="ord-subtitle" style={{ color: t.textMuted }}>Your order history and transactions</div>
        <div className="page-divider" style={{ background: t.cardBorder }} />
      </div>

      {/* Tab switcher */}
      <div className="ord-tabs" style={{ background: dark ? "rgba(255,255,255,.04)" : "rgba(0,0,0,.03)", borderColor: t.cardBorder }}>
        {[["orders", "Orders", orders.length], ["transactions", "Transactions", txs.length]].map(([id, lb, count]) => (
          <button key={id} onClick={() => { setTab(id); setOPage(1); setTPage(1); setExpanded(null); }} className="ord-tab" style={{ background: tab === id ? t.navActive : "transparent", color: tab === id ? t.accent : t.textMuted }}>
            {lb} <span style={{ fontSize: 13, opacity: .7 }}>({count})</span>
          </button>
        ))}
      </div>

      {/* ═══ ORDERS TAB ═══ */}
      {tab === "orders" && <>
        {/* Status filters */}
        <div className="ord-filters">
          {["all", "Completed", "Processing", "Pending", "Partial", "Cancelled"].map(f => (
            <button key={f} onClick={() => { setFilter(f); setOPage(1); setExpanded(null); }} className="ord-filter-pill" style={{ borderWidth: 1, borderStyle: "solid", borderColor: filter === f ? t.accent : t.cardBorder, background: filter === f ? (dark ? "#2a1a22" : "#fdf2f4") : "transparent", color: filter === f ? t.accent : t.textMuted }}>
              {f === "all" ? "All" : f} <span style={{ fontSize: 11 }}>({counts[f] || 0})</span>
            </button>
          ))}
        </div>

        {/* Search */}
        <input placeholder="Search by order ID or service..." value={search} onChange={e => { setSearch(e.target.value); setOPage(1); }} className="m ord-search" style={{ borderColor: t.cardBorder, background: dark ? "#0d1020" : "#fff", color: t.text }} />

        {/* Order list */}
        <div className="ord-list" style={{ background: dark ? "rgba(255,255,255,.03)" : "rgba(255,255,255,.85)", border: `0.5px solid ${t.cardBorder}` }}>
          {pagedOrders.length > 0 ? pagedOrders.map((o, i) => (
            <div key={o.id}>
              <div onClick={() => setExpanded(expanded === o.id ? null : o.id)} className="ord-row" style={{ borderBottom: (i < pagedOrders.length - 1 || expanded === o.id) ? `1px solid ${t.cardBorder}` : "none" }}>
                <PlatformIcon platform={o.platform} dark={dark} />
                <div className="ord-row-left">
                  <div className="ord-row-service" style={{ color: t.text }}>{o.service}{o.tier ? ` · ${o.tier}` : ""}</div>
                  <div className="ord-row-meta ord-row-meta-wide" style={{ color: t.textMuted }}>
                    <span className="m">{o.id}</span>
                    <span className="ord-meta-sep" />
                    <span>{o.quantity?.toLocaleString() || 0} qty</span>
                    <span className="ord-meta-sep" />
                    <span>{o.created ? fD(o.created) : ""}</span>
                  </div>
                  <div className="ord-row-meta ord-row-meta-narrow" style={{ color: t.textMuted }}>
                    <div className="m">{o.id}</div>
                    <div className="ord-row-meta-sub">
                      <span>{o.quantity?.toLocaleString() || 0} qty</span>
                      <span className="ord-meta-sep" />
                      <span>{o.created ? fD(o.created, true) : ""}</span>
                    </div>
                  </div>
                </div>
                <div className="ord-row-right">
                  <div className="m ord-row-charge" style={{ color: t.green }}>{fN(o.charge)}</div>
                  <Badge status={o.status} dark={dark} />
                </div>
                <svg className="ord-row-chevron" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={t.textMuted} strokeWidth="2" strokeLinecap="round" style={{ transform: expanded === o.id ? "rotate(180deg)" : "rotate(0)", transition: "transform .2s" }}><polyline points="6 9 12 15 18 9"/></svg>
              </div>

              {/* Expanded details */}
              {expanded === o.id && (
                <div className="ord-expanded" style={{ background: dark ? "rgba(255,255,255,.015)" : "rgba(0,0,0,.015)", borderBottom: i < pagedOrders.length - 1 ? `1px solid ${t.cardBorder}` : "none" }}>
                  <div className="ord-detail-grid">
                    <div className="ord-detail-link">
                      <div className="ord-detail-label" style={{ color: t.textMuted }}>Link</div>
                      <div className="m ord-detail-val" style={{ color: t.accent, wordBreak: "break-all" }}>{o.link || "—"}</div>
                    </div>
                    <div>
                      <div className="ord-detail-label" style={{ color: t.textMuted }}>Platform</div>
                      <div className="ord-detail-val" style={{ color: t.text }}>{o.platform || "—"}</div>
                    </div>
                    <div>
                      <div className="ord-detail-label" style={{ color: t.textMuted }}>Status</div>
                      <div style={{ marginTop: 2 }}><Badge status={o.status} dark={dark} /></div>
                    </div>
                  </div>
                  {(o.status === "Processing" || o.status === "Pending") && (
                    <div className="ord-actions">
                      <button onClick={() => doAction(o.id, "check")} disabled={actionLoading === o.id} className="m ord-action-btn" style={{ borderColor: t.cardBorder, color: t.textSoft }}>{actionLoading === o.id ? "..." : "Check Status"}</button>
                      <button onClick={async () => { const ok = await confirm({ title: "Cancel Order", message: `Cancel order ${o.id}? Your wallet will be refunded.`, confirmLabel: "Cancel Order", danger: true }); if (ok) doAction(o.id, "cancel"); }} disabled={actionLoading === o.id} className="m ord-action-btn" style={{ borderColor: dark ? "rgba(252,165,165,.2)" : "rgba(220,38,38,.15)", color: dark ? "#fca5a5" : "#dc2626" }}>Cancel</button>
                    </div>
                  )}
                  {o.status === "Completed" && (
                    <div className="ord-actions">
                      <button onClick={async () => { const ok = await confirm({ title: "Reorder", message: `Reorder ${o.service}? ₦${o.charge?.toLocaleString()} will be charged from your wallet.`, confirmLabel: "Place Reorder" }); if (ok) doAction(o.id, "reorder"); }} disabled={actionLoading === o.id} className="m ord-action-btn" style={{ borderColor: t.cardBorder, color: t.accent }}>{actionLoading === o.id ? "..." : "Reorder"}</button>
                    </div>
                  )}
                  {orderMsg[o.id] && (
                    <div style={{ marginTop: 8, padding: "6px 10px", borderRadius: 6, fontSize: 13, background: orderMsg[o.id].type === "success" ? (dark ? "rgba(110,231,183,.08)" : "#ecfdf5") : (dark ? "rgba(220,38,38,.08)" : "#fef2f2"), color: orderMsg[o.id].type === "success" ? (dark ? "#6ee7b7" : "#059669") : (dark ? "#fca5a5" : "#dc2626"), display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span>{orderMsg[o.id].type === "success" ? "✓" : "⚠️"} {orderMsg[o.id].text}</span>
                      <button onClick={() => setOrderMsg(prev => { const n = { ...prev }; delete n[o.id]; return n; })} style={{ background: "none", color: "inherit", border: "none", cursor: "pointer", fontSize: 12 }}>✕</button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )) : (
            <div className="ord-empty" style={{ color: t.textMuted, padding: "40px 20px", textAlign: "center" }}>
              <svg width="48" height="48" viewBox="0 0 64 64" fill="none" style={{ marginBottom: 14, opacity: .5 }}>
                <rect x="12" y="8" width="40" height="48" rx="6" stroke={t.accent} strokeWidth="1.5" opacity=".3" />
                <line x1="20" y1="22" x2="44" y2="22" stroke={t.accent} strokeWidth="1.5" opacity=".2" strokeLinecap="round" />
                <line x1="20" y1="30" x2="38" y2="30" stroke={t.accent} strokeWidth="1.5" opacity=".15" strokeLinecap="round" />
                <circle cx="32" cy="38" r="8" stroke={t.accent} strokeWidth="1.5" opacity=".2" />
                <path d="M29 38l2 2 4-4" stroke={t.accent} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity=".4" />
              </svg>
              <div style={{ fontSize: 16, fontWeight: 600, color: t.textSoft, marginBottom: 4 }}>No orders yet — let's change that 🚀</div>
              <div style={{ fontSize: 15, color: t.textMuted }}>Your order history will show up here once you start boosting</div>
            </div>
          )}
        </div>
        <Pagination total={filteredOrders.length} page={oPage} setPage={setOPage} perPage={perPage} setPerPage={setPerPage} t={t} />
      </>}

      {/* ═══ TRANSACTIONS TAB ═══ */}
      {tab === "transactions" && <>
        <div className="ord-filters">
          {["all", "deposit", "order", "referral", "refund"].map(f => (
            <button key={f} onClick={() => { setTxFilter(f); setTPage(1); }} className="ord-filter-pill" style={{ borderWidth: 1, borderStyle: "solid", borderColor: txFilter === f ? t.accent : t.cardBorder, background: txFilter === f ? (dark ? "#2a1a22" : "#fdf2f4") : "transparent", color: txFilter === f ? t.accent : t.textMuted, textTransform: "capitalize" }}>{f === "all" ? "All" : f}</button>
          ))}
        </div>

        <div className="ord-list" style={{ background: dark ? "rgba(255,255,255,.03)" : "rgba(255,255,255,.85)", border: `0.5px solid ${t.cardBorder}` }}>
          {pagedTxs.length > 0 ? pagedTxs.map((tx, i) => (
            <div key={tx.id} className="ord-tx-row" style={{ borderBottom: i < pagedTxs.length - 1 ? `1px solid ${t.cardBorder}` : "none" }}>
              <div className="ord-tx-icon" style={{ background: dark ? `${txClr(tx.type, dark)}15` : `${txClr(tx.type, dark)}10`, color: txClr(tx.type, dark) }}>{txIcon(tx.type)}</div>
              <div className="ord-tx-info">
                <div className="ord-tx-method" style={{ color: t.text }}>{tx.method}</div>
                <div className="ord-tx-meta" style={{ color: t.textMuted }}>
                  <span>{tx.id}</span>
                  <span>{tx.date ? fD(tx.date) : ""}</span>
                </div>
              </div>
              <div className="m ord-tx-amount" style={{ color: tx.amount > 0 ? t.green : (dark ? "#fca5a5" : "#dc2626") }}>
                {tx.amount > 0 ? "+" : ""}{fN(tx.amount)}
              </div>
            </div>
          )) : (
            <div className="ord-empty" style={{ color: t.textMuted, padding: "40px 20px", textAlign: "center" }}>
              <svg width="48" height="48" viewBox="0 0 64 64" fill="none" style={{ marginBottom: 14, opacity: .5 }}>
                <rect x="8" y="16" width="48" height="32" rx="6" stroke={t.accent} strokeWidth="1.5" opacity=".25" />
                <rect x="38" y="26" width="18" height="12" rx="3" stroke={t.accent} strokeWidth="1.5" opacity=".2" />
                <circle cx="46" cy="32" r="2" stroke={t.accent} strokeWidth="1.5" opacity=".3" />
                <line x1="16" y1="24" x2="30" y2="24" stroke={t.accent} strokeWidth="1.5" opacity=".15" strokeLinecap="round" />
              </svg>
              <div style={{ fontSize: 16, fontWeight: 600, color: t.textSoft, marginBottom: 4 }}>No transactions yet 💳</div>
              <div style={{ fontSize: 15, color: t.textMuted }}>Add funds to your wallet and start boosting</div>
            </div>
          )}
        </div>
        <Pagination total={filteredTxs.length} page={tPage} setPage={setTPage} perPage={perPage} setPerPage={setPerPage} t={t} />
      </>}
    </>
  );
}

/* ═══════════════════════════════════════════ */
/* ═══ ORDERS RIGHT SIDEBAR                ═══ */
/* ═══════════════════════════════════════════ */
export function OrdersSidebar({ orders, dark, t }) {
  const counts = {};
  ["Completed", "Processing", "Pending", "Partial", "Cancelled"].forEach(s => { counts[s] = orders.filter(o => o.status === s).length; });
  const totalSpent = orders.reduce((s, o) => s + (o.charge || 0), 0);

  return (
    <>
      {/* Stats */}
      <div className="ord-rs-title" style={{ color: t.textMuted }}>Order Summary</div>
      <div className="ord-rs-stats">
        {[
          ["Total", String(orders.length), dark ? "#a5b4fc" : "#4f46e5"],
          ["Completed", String(counts.Completed || 0), t.green],
          ["Processing", String((counts.Processing || 0) + (counts.Pending || 0)), dark ? "#e0a458" : "#d97706"],
          ["Spent", fN(totalSpent), t.accent],
        ].map(([label, val, color]) => (
          <div key={label} className="ord-rs-stat" style={{ background: t.cardBg }}>
            <div className="ord-rs-stat-label" style={{ color: t.textMuted }}>{label}</div>
            <div className="m ord-rs-stat-val" style={{ color }}>{val}</div>
          </div>
        ))}
      </div>

      <div className="ord-rs-divider" style={{ background: t.sidebarBorder }} />

      {/* Recent activity */}
      <div className="ord-rs-title" style={{ color: t.textMuted }}>Recent Activity</div>
      {orders.slice(0, 5).map(o => (
        <div key={o.id} className="ord-rs-item" style={{ background: t.cardBg }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <PlatformIcon platform={o.platform} dark={dark} size={28} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="ord-rs-item-name" style={{ color: t.text }}>{o.service}{o.tier ? ` · ${o.tier}` : ""}</div>
              <div className="ord-rs-item-row">
                <span style={{ fontWeight: 600, color: sClr(o.status, dark) }}>{o.status}</span>
                <span style={{ color: t.textMuted }}>{o.created ? fD(o.created, true) : ""}</span>
              </div>
            </div>
          </div>
        </div>
      ))}
    </>
  );
}
