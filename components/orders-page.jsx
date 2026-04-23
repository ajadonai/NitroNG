'use client';
import { useState, useEffect } from "react";
import { useConfirm } from "./confirm-dialog";
import { useToast } from "./toast";
import { PlatformIcon } from "./platform-icon";
import { SegPill } from "./seg-pill";
import { fN, fD } from "../lib/format";


/* ── Status helpers ── */
function sClr(s, dk) { return s === "Completed" ? (dk ? "#6ee7b7" : "#059669") : s === "Processing" ? (dk ? "#a5b4fc" : "#4f46e5") : s === "Pending" ? (dk ? "#fcd34d" : "#d97706") : s === "Partial" ? (dk ? "#fca5a5" : "#dc2626") : s === "Cancelled" ? (dk ? "#888" : "#666") : (dk ? "#555" : "#888"); }
function sBg(s, dk) { return s === "Completed" ? (dk ? "#0a2416" : "#ecfdf5") : s === "Processing" ? (dk ? "#0f1629" : "#eef2ff") : s === "Pending" ? (dk ? "#1c1608" : "#fffbeb") : s === "Partial" ? (dk ? "#1f0a0a" : "#fef2f2") : (dk ? "#1a1a1a" : "#f5f5f5"); }
function sBrd(s, dk) { return s === "Completed" ? (dk ? "#166534" : "#a7f3d0") : s === "Processing" ? (dk ? "#3730a3" : "#c7d2fe") : s === "Pending" ? (dk ? "#92400e" : "#fde68a") : s === "Partial" ? (dk ? "#991b1b" : "#fecaca") : (dk ? "#404040" : "#d4d4d4"); }
function txClr(type, dk) { return type === "deposit" ? (dk ? "#6ee7b7" : "#059669") : type === "referral" ? "#c47d8e" : type === "refund" ? (dk ? "#fcd34d" : "#d97706") : (dk ? "#fca5a5" : "#dc2626"); }
function txIcon(type) { return type === "deposit" ? "↓" : type === "referral" ? "★" : type === "refund" ? "↩" : "↑"; }

function Badge({ status, dark }) {
  return <span className="text-[13px] font-semibold py-0.5 px-2 rounded-[5px] border-[0.5px] whitespace-nowrap inline-block" style={{ background: sBg(status, dark), color: sClr(status, dark), borderColor: sBrd(status, dark) }}>{status}</span>;
}

const PER_PAGE_OPTIONS = [5, 10, 20];

function Pagination({ total, page, setPage, perPage, setPerPage, t }) {
  const totalPages = Math.ceil(total / perPage);
  if (total <= 5) return null;
  return (
    <div className="flex justify-between items-center mt-3.5 flex-wrap gap-2">
      <div className="flex items-center gap-2 text-[13px] desktop:text-sm">
        <span style={{ color: t.textMuted }}>Show</span>
        <select value={perPage} onChange={e => { const v = Number(e.target.value); setPerPage(v); setPage(1); try { localStorage.setItem("nitro-per-page", String(v)); } catch {} fetch("/api/auth/notifications", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ perPagePreference: v }) }).catch(() => {}); }} className="m py-1 px-2 rounded-md text-sm outline-none border" style={{ background: t.cardBg, borderColor: t.cardBorder, color: t.text }}>
          {PER_PAGE_OPTIONS.map(n => <option key={n} value={n}>{n}</option>)}
        </select>
        <span style={{ color: t.textMuted }}>{total} total</span>
      </div>
      <div className="flex items-center gap-1">
        <button onClick={() => setPage(Math.max(1, page - 1))} disabled={page <= 1} className="w-[30px] h-[30px] rounded-md flex items-center justify-center border cursor-pointer bg-transparent" style={{ borderColor: t.cardBorder, color: t.textSoft, opacity: page <= 1 ? .3 : 1 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
          let p;
          if (totalPages <= 5) p = i + 1;
          else if (page <= 2) p = i + 1;
          else if (page >= totalPages - 1) p = totalPages - 4 + i;
          else p = page - 2 + i;
          return (
            <button key={p} onClick={() => setPage(p)} className="m py-1 px-2.5 rounded-md text-sm border cursor-pointer" style={{ background: page === p ? t.navActive : "transparent", color: page === p ? t.accent : t.textMuted, borderColor: page === p ? t.accent + "40" : t.cardBorder }}>{p}</button>
          );
        })}
        <button onClick={() => setPage(Math.min(totalPages, page + 1))} disabled={page >= totalPages} className="w-[30px] h-[30px] rounded-md flex items-center justify-center border cursor-pointer bg-transparent" style={{ borderColor: t.cardBorder, color: t.textSoft, opacity: page >= totalPages ? .3 : 1 }}>
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
  const toast = useToast();

  useEffect(() => { setOrders(initialOrders); }, [initialOrders]);

  const doAction = async (orderId, action) => {
    setActionLoading(orderId);
    try {
      const res = await fetch("/api/orders", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, orderId }) });
      const data = await res.json();
      if (!res.ok) { toast.error("Action failed", data.error || "Something went wrong"); setActionLoading(null); return; }
      if (action === "check") {
        if (data.status) setOrders(prev => prev.map(o => (o.id === orderId ? { ...o, status: data.status } : o)));
        toast.info("Status checked", `${data.status}${data.remains != null ? " · " + data.remains + " remaining" : ""}`);
      } else if (action === "cancel") {
        setOrders(prev => prev.map(o => (o.id === orderId ? { ...o, status: "Cancelled" } : o)));
        toast.success("Order cancelled", data.refunded ? `₦${data.refunded.toLocaleString()} refunded to wallet` : "Cancelled successfully");
      } else if (action === "reorder") {
        toast.success("Reorder placed", data.order?.id || "");
      }
    } catch { toast.error("Request failed", "Check your connection and try again"); }
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
      <div className="pb-2 desktop:pb-3.5">
        <div className="adm-header-row">
          <div>
            <div className="text-lg desktop:text-[22px] font-semibold mb-0.5" style={{ color: t.text }}>History</div>
            <div className="text-sm desktop:text-[15px]" style={{ color: t.textMuted }}>Your order history and transactions</div>
          </div>
          <SegPill value={tab} options={[{value: "orders", label: `Orders (${orders.length})`}, {value: "transactions", label: `Transactions (${txs.length})`}]} onChange={(v) => { setTab(v); setOPage(1); setTPage(1); setExpanded(null); }} dark={dark} t={t} />
        </div>
        <div className="page-divider" style={{ background: t.cardBorder }} />
      </div>

      {/* ═══ ORDERS TAB ═══ */}
      {tab === "orders" && <>
        {/* Search */}
        <div className="relative mb-2.5 desktop:mb-3.5">
          <input placeholder="Search by order ID or service..." value={search} onChange={e => { setSearch(e.target.value); setOPage(1); }} className="w-full py-2 desktop:py-2.5 px-3 desktop:px-3.5 pr-8 rounded-[10px] border text-[13px] desktop:text-sm font-[inherit] outline-none box-border" style={{ borderColor: t.cardBorder, background: dark ? "rgba(255,255,255,.03)" : "#fff", color: t.text }} />
          {search && <button aria-label="Clear search" onClick={() => { setSearch(""); setOPage(1); }} className="absolute right-2.5 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center rounded-full text-xs cursor-pointer border-none" style={{ background: dark ? "rgba(255,255,255,.1)" : "rgba(0,0,0,.08)", color: t.textMuted }}>✕</button>}
        </div>

        {/* Status filters */}
        <div className="flex gap-1 desktop:gap-1.5 mb-2 desktop:mb-3 flex-wrap justify-end">
          <select value={filter} onChange={e => { setFilter(e.target.value); setOPage(1); setExpanded(null); }} style={{
            padding: "7px 28px 7px 10px", borderRadius: 8, fontSize: 13, fontWeight: 500,
            background: dark ? "rgba(255,255,255,.04)" : "rgba(0,0,0,.03)",
            border: `1px solid ${dark ? "rgba(255,255,255,.08)" : "rgba(0,0,0,.08)"}`,
            color: dark ? "rgba(255,255,255,.7)" : "rgba(0,0,0,.7)",
            appearance: "none", cursor: "pointer", fontFamily: "inherit",
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='10' height='6' viewBox='0 0 10 6' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1L5 5L9 1' stroke='${dark ? "%23666" : "%23999"}' stroke-width='1.5' stroke-linecap='round'/%3E%3C/svg%3E")`,
            backgroundRepeat: "no-repeat", backgroundPosition: "right 8px center",
          }}>
            {["all", "Completed", "Processing", "Pending", "Partial", "Cancelled"].map(f => (
              <option key={f} value={f}>{f === "all" ? `All (${orders.length})` : `${f} (${counts[f] || 0})`}</option>
            ))}
          </select>
        </div>

        {/* Order list */}
        <div className="rounded-xl desktop:rounded-[14px] overflow-hidden" style={{ background: dark ? "rgba(255,255,255,.03)" : "rgba(255,255,255,.85)", border: `0.5px solid ${t.cardBorder}` }}>
          {pagedOrders.length > 0 ? pagedOrders.map((o, i) => (
            <div key={o.id}>
              <div role="button" tabIndex={0} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();e.currentTarget.click()}}} onClick={() => setExpanded(expanded === o.id ? null : o.id)} className="flex items-center py-3 px-3.5 desktop:py-3.5 desktop:px-[18px] cursor-pointer gap-2.5 desktop:gap-3.5 transition-[background-color] duration-150 hover:bg-[rgba(196,125,142,.03)]" style={{ borderBottom: (i < pagedOrders.length - 1 || expanded === o.id) ? `1px solid ${t.cardBorder}` : "none" }}>
                <PlatformIcon platform={o.platform} dark={dark} />
                <div className="min-w-0 flex-1">
                  <div className="text-sm desktop:text-[15px] font-medium overflow-hidden text-ellipsis whitespace-nowrap desktop:whitespace-nowrap mb-[3px] max-md:whitespace-normal max-md:line-clamp-2 max-md:[display:-webkit-box] max-md:[-webkit-box-orient:vertical]" style={{ color: t.text }}>{o.service}{o.tier ? ` · ${o.tier}` : ""}</div>
                  <div className="flex items-center gap-1.5 text-xs desktop:text-[13px]" style={{ color: t.textMuted }}>
                    <span className="m">{o.id}</span>
                    <span className="w-[3px] h-[3px] rounded-full bg-current opacity-35 shrink-0" />
                    <span>{o.created ? fD(o.created, true) : ""}</span>
                  </div>
                </div>
                <div className="text-right shrink-0 flex flex-col items-end gap-1">
                  <div className="m text-sm desktop:text-[15px] font-semibold" style={{ color: t.green }}>{fN(o.charge)}</div>
                  <Badge status={o.status} dark={dark} />
                </div>
                <svg className="shrink-0" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={t.textMuted} strokeWidth="2" strokeLinecap="round" style={{ transform: expanded === o.id ? "rotate(180deg)" : "rotate(0)", transition: "transform .2s" }}><polyline points="6 9 12 15 18 9"/></svg>
              </div>

              {/* Expanded details */}
              {expanded === o.id && (
                <div className="py-3.5 px-3.5 desktop:py-3.5 desktop:px-[18px] pl-[58px] desktop:pl-[70px]" style={{ background: dark ? "rgba(196,125,142,.04)" : "rgba(196,125,142,.03)", borderBottom: `2px solid ${dark ? "rgba(196,125,142,.15)" : "rgba(196,125,142,.12)"}`, borderLeft: `3px solid ${t.accent}` }}>
                  <div className="grid grid-cols-2 desktop:grid-cols-3 gap-2 desktop:gap-2.5 text-sm mb-3">
                    <div className="col-span-full">
                      <div className="text-[11px] mb-[3px] uppercase tracking-[1px]" style={{ color: t.textMuted }}>Link</div>
                      <div className="m text-sm break-all" style={{ color: t.accent }}>{o.link ? <a href={o.link} target="_blank" rel="noopener noreferrer" style={{ color: "inherit", textDecoration: "underline", textUnderlineOffset: 3 }}>{o.link}</a> : "—"}</div>
                    </div>
                    <div>
                      <div className="text-[11px] mb-[3px] uppercase tracking-[1px]" style={{ color: t.textMuted }}>Quantity</div>
                      <div className="m text-sm" style={{ color: t.text }}>{o.quantity?.toLocaleString() || 0}</div>
                    </div>
                    <div>
                      <div className="text-[11px] mb-[3px] uppercase tracking-[1px]" style={{ color: t.textMuted }}>Platform</div>
                      <div className="text-sm" style={{ color: t.text }}>{o.platform || "—"}</div>
                    </div>
                  </div>
                  {(o.status === "Processing" || o.status === "Pending") && (
                    <div className="flex gap-2">
                      <button onClick={() => doAction(o.id, "check")} disabled={actionLoading === o.id} className="m py-1.5 px-3 desktop:px-4 rounded-md text-xs desktop:text-[13px] font-semibold border cursor-pointer bg-transparent" style={{ borderColor: t.cardBorder, color: t.textSoft }}>{actionLoading === o.id ? "..." : "Check Status"}</button>
                      <button onClick={async () => { const ok = await confirm({ title: "Cancel Order", message: `Cancel order ${o.id}? Your wallet will be refunded.`, confirmLabel: "Cancel Order", danger: true }); if (ok) doAction(o.id, "cancel"); }} disabled={actionLoading === o.id} className="m py-1.5 px-3 desktop:px-4 rounded-md text-xs desktop:text-[13px] font-semibold border cursor-pointer bg-transparent" style={{ borderColor: dark ? "rgba(252,165,165,.2)" : "rgba(220,38,38,.15)", color: dark ? "#fca5a5" : "#dc2626" }}>Cancel</button>
                    </div>
                  )}
                  {o.status === "Completed" && (
                    <div className="flex gap-2">
                      <button onClick={async () => { const ok = await confirm({ title: "Reorder", message: `Reorder ${o.service}? ₦${o.charge?.toLocaleString()} will be charged from your wallet.`, confirmLabel: "Place Reorder" }); if (ok) doAction(o.id, "reorder"); }} disabled={actionLoading === o.id} className="m py-1.5 px-3 desktop:px-4 rounded-md text-xs desktop:text-[13px] font-semibold border cursor-pointer bg-transparent" style={{ borderColor: t.cardBorder, color: t.accent }}>{actionLoading === o.id ? "..." : "Reorder"}</button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )) : (
            <div className="p-10 text-center text-[15px]" style={{ color: t.textMuted }}>
              <svg width="48" height="48" viewBox="0 0 64 64" fill="none" style={{ marginBottom: 14, opacity: .7, display: "block", margin: "0 auto 14px" }}>
                <rect x="12" y="8" width="40" height="48" rx="6" stroke={t.accent} strokeWidth="1.5" opacity=".3" />
                <line x1="20" y1="22" x2="44" y2="22" stroke={t.accent} strokeWidth="1.5" opacity=".2" strokeLinecap="round" />
                <line x1="20" y1="30" x2="38" y2="30" stroke={t.accent} strokeWidth="1.5" opacity=".15" strokeLinecap="round" />
                <circle cx="32" cy="38" r="8" stroke={t.accent} strokeWidth="1.5" opacity=".2" />
                <path d="M29 38l2 2 4-4" stroke={t.accent} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity=".4" />
              </svg>
              <div className="text-base font-semibold mb-1" style={{ color: t.textSoft }}>No orders yet — let's change that 🚀</div>
              <div className="text-[15px]" style={{ color: t.textMuted }}>Your order history will show up here once you start boosting</div>
            </div>
          )}
        </div>
        <Pagination total={filteredOrders.length} page={oPage} setPage={setOPage} perPage={perPage} setPerPage={setPerPage} t={t} />
      </>}

      {/* ═══ TRANSACTIONS TAB ═══ */}
      {tab === "transactions" && <>
        <div className="flex gap-1 desktop:gap-1.5 mb-2 desktop:mb-3 flex-wrap justify-end">
          <select value={txFilter} onChange={e => { setTxFilter(e.target.value); setTPage(1); }} style={{
            padding: "7px 28px 7px 10px", borderRadius: 8, fontSize: 13, fontWeight: 500,
            background: dark ? "rgba(255,255,255,.04)" : "rgba(0,0,0,.03)",
            border: `1px solid ${dark ? "rgba(255,255,255,.08)" : "rgba(0,0,0,.08)"}`,
            color: dark ? "rgba(255,255,255,.7)" : "rgba(0,0,0,.7)",
            appearance: "none", cursor: "pointer", fontFamily: "inherit", textTransform: "capitalize",
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='10' height='6' viewBox='0 0 10 6' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1L5 5L9 1' stroke='${dark ? "%23666" : "%23999"}' stroke-width='1.5' stroke-linecap='round'/%3E%3C/svg%3E")`,
            backgroundRepeat: "no-repeat", backgroundPosition: "right 8px center",
          }}>
            {["all", "deposit", "order", "referral", "refund"].map(f => (
              <option key={f} value={f}>{f === "all" ? "All types" : f}</option>
            ))}
          </select>
        </div>

        <div className="rounded-xl desktop:rounded-[14px] overflow-hidden" style={{ background: dark ? "rgba(255,255,255,.03)" : "rgba(255,255,255,.85)", border: `0.5px solid ${t.cardBorder}` }}>
          {pagedTxs.length > 0 ? pagedTxs.map((tx, i) => (
            <div key={tx.id} className="flex items-center gap-2.5 desktop:gap-3.5 py-3 px-3.5 desktop:py-3.5 desktop:px-[18px]" style={{ borderBottom: i < pagedTxs.length - 1 ? `1px solid ${t.cardBorder}` : "none" }}>
              <div className="w-8 h-8 desktop:w-9 desktop:h-9 rounded-[10px] flex items-center justify-center text-base font-semibold shrink-0" style={{ background: dark ? `${txClr(tx.type, dark)}15` : `${txClr(tx.type, dark)}10`, color: txClr(tx.type, dark) }}>{txIcon(tx.type)}</div>
              <div className="flex-1 min-w-0">
                <div className="text-sm desktop:text-[15px] font-medium overflow-hidden text-ellipsis whitespace-nowrap" style={{ color: t.text }}>{tx.method}</div>
                <div className="flex gap-1.5 desktop:gap-2.5 mt-0.5 text-[13px] desktop:text-sm" style={{ color: t.textMuted }}>
                  <span>{tx.reference || tx.id}</span>
                  <span>{tx.date ? fD(tx.date) : ""}</span>
                </div>
              </div>
              <div className="m text-[15px] desktop:text-base font-semibold shrink-0" style={{ color: tx.amount > 0 ? t.green : (dark ? "#fca5a5" : "#dc2626") }}>
                {tx.amount > 0 ? "+" : ""}{fN(tx.amount)}
              </div>
            </div>
          )) : (
            <div className="p-10 text-center text-[15px]" style={{ color: t.textMuted }}>
              <svg width="48" height="48" viewBox="0 0 64 64" fill="none" style={{ marginBottom: 14, opacity: .7, display: "block", margin: "0 auto 14px" }}>
                <rect x="8" y="16" width="48" height="32" rx="6" stroke={t.accent} strokeWidth="1.5" opacity=".25" />
                <rect x="38" y="26" width="18" height="12" rx="3" stroke={t.accent} strokeWidth="1.5" opacity=".2" />
                <circle cx="46" cy="32" r="2" stroke={t.accent} strokeWidth="1.5" opacity=".3" />
                <line x1="16" y1="24" x2="30" y2="24" stroke={t.accent} strokeWidth="1.5" opacity=".15" strokeLinecap="round" />
              </svg>
              <div className="text-base font-semibold mb-1" style={{ color: t.textSoft }}>No transactions yet 💳</div>
              <div className="text-[15px]" style={{ color: t.textMuted }}>Add funds to your wallet and start boosting</div>
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
  const totalSpent = orders.filter(o => o.status !== "Cancelled").reduce((s, o) => s + (o.charge || 0), 0);

  return (
    <>
      {/* Stats */}
      <div className="text-[13px] font-semibold uppercase tracking-[1.5px] mb-2.5 pl-1" style={{ color: t.textMuted }}>Order Summary</div>
      <div className="grid grid-cols-2 gap-1.5 mb-4">
        {[
          ["Total", String(orders.length), dark ? "#a5b4fc" : "#4f46e5"],
          ["Completed", String(counts.Completed || 0), t.green],
          ["Processing", String((counts.Processing || 0) + (counts.Pending || 0)), dark ? "#e0a458" : "#d97706"],
          ["Spent", fN(totalSpent), t.accent],
        ].map(([label, val, color]) => (
          <div key={label} className="p-3 rounded-[10px]" style={{ background: t.cardBg }}>
            <div className="text-xs uppercase tracking-[0.5px] mb-1" style={{ color: t.textMuted }}>{label}</div>
            <div className="m text-base font-semibold" style={{ color }}>{val}</div>
          </div>
        ))}
      </div>

      <div className="h-px mt-1 mb-4" style={{ background: t.sidebarBorder }} />

      {/* Recent activity */}
      <div className="text-[13px] font-semibold uppercase tracking-[1.5px] mb-2.5 pl-1" style={{ color: t.textMuted }}>Recent Activity</div>
      {orders.slice(0, 5).map(o => (
        <div key={o.id} className="py-2 px-2.5 rounded-lg mb-1" style={{ background: t.cardBg }}>
          <div className="flex items-center gap-2.5">
            <PlatformIcon platform={o.platform} dark={dark} size={28} />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium mb-0.5 overflow-hidden text-ellipsis whitespace-nowrap" style={{ color: t.text }}>{o.service}{o.tier ? ` · ${o.tier}` : ""}</div>
              <div className="flex justify-between items-center text-[13px]">
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
