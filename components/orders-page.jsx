'use client';
import { useState, useEffect, useRef, useCallback } from "react";
import { useConfirm } from "./confirm-dialog";
import { useToast } from "./toast";
import { PlatformIcon } from "./platform-icon";
import { SegPill } from "./seg-pill";
import { fN, fD } from "../lib/format";


/* ── Status helpers ── */
function sClr(s, dk) { return s === "Completed" ? (dk ? "#6ee7b7" : "#059669") : s === "Processing" ? (dk ? "#a5b4fc" : "#4f46e5") : s === "Pending" ? (dk ? "#fcd34d" : "#d97706") : s === "Partial" ? (dk ? "#fca5a5" : "#dc2626") : s === "Cancelled" ? (dk ? "#888" : "#666") : (dk ? "#555" : "#888"); }
function sBg(s, dk) { return s === "Completed" ? (dk ? "#0a2416" : "#ecfdf5") : s === "Processing" ? (dk ? "#0f1629" : "#eef2ff") : s === "Pending" ? (dk ? "#1c1608" : "#fffbeb") : s === "Partial" ? (dk ? "#1f0a0a" : "#fef2f2") : s === "Cancelled" ? (dk ? "#1a1a1a" : "#f5f5f5") : (dk ? "#1a1a1a" : "#f5f5f5"); }
function sBrd(s, dk) { return s === "Completed" ? (dk ? "#166534" : "#a7f3d0") : s === "Processing" ? (dk ? "#3730a3" : "#c7d2fe") : s === "Pending" ? (dk ? "#92400e" : "#fde68a") : s === "Partial" ? (dk ? "#991b1b" : "#fecaca") : s === "Cancelled" ? (dk ? "#404040" : "#d4d4d4") : (dk ? "#404040" : "#d4d4d4"); }
const TX_META = {
  deposit:      { label: "Deposit",       icon: "↓", clr: dk => dk ? "#6ee7b7" : "#059669" },
  order:        { label: "Order",         icon: "↑", clr: dk => dk ? "#fca5a5" : "#dc2626" },
  referral:     { label: "Referral bonus",icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="none"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>, clr: () => "#c47d8e" },
  refund:       { label: "Refund",        icon: "↩", clr: dk => dk ? "#fcd34d" : "#d97706" },
  admin_credit: { label: "Admin credit",  icon: "＋", clr: dk => dk ? "#a5b4fc" : "#4f46e5" },
  admin_gift:   { label: "Gift",          icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 12 20 22 4 22 4 12"/><rect x="2" y="7" width="20" height="5"/><line x1="12" y1="22" x2="12" y2="7"/><path d="M12 7H7.5a2.5 2.5 0 010-5C11 2 12 7 12 7z"/><path d="M12 7h4.5a2.5 2.5 0 000-5C13 2 12 7 12 7z"/></svg>, clr: dk => dk ? "#f0abfc" : "#a855f7" },
};
function txClr(type, dk) { return (TX_META[type] || TX_META.order).clr(dk); }
function txIcon(type) { return (TX_META[type] || TX_META.order).icon; }
function txLabel(type) { return (TX_META[type] || { label: type }).label; }
function txDesc(tx) {
  if (tx.description && tx.description !== tx.reference) return tx.description.replace(/\s*\[[^\]]+\]\s*$/, "");
  if (tx.type === "order" && tx.reference) {
    const ref = tx.reference;
    if (ref.startsWith("BULK-")) return `Bulk order ${ref}`;
    return `Order ${ref}`;
  }
  if (tx.type === "refund") return tx.reference ? `Refund for ${tx.reference.replace(/^(ADM-)?REF-/, "")}` : "Order refund";
  if (tx.type === "deposit") return tx.reference || "Wallet top-up";
  if (tx.type === "referral") return "Referral commission";
  if (tx.type === "admin_credit" || tx.type === "admin_gift") return tx.description || "Credited by Nitro Team";
  return tx.reference || "";
}

function Badge({ status, dark }) {
  return <span className="text-[13px] font-semibold py-0.5 px-2 rounded-[5px] border-[0.5px] whitespace-nowrap inline-block" style={{ background: sBg(status, dark), color: sClr(status, dark), borderColor: sBrd(status, dark) }}>{status}</span>;
}


/* ── Dot menu ── */
function DotMenu({ items, dark, t, loading }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const close = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const esc = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", esc); };
  }, [open]);

  return (
    <div ref={ref} className="relative" style={{ zIndex: open ? 20 : 1 }}>
      <button onClick={(e) => { e.stopPropagation(); if (!loading) setOpen(!open); }} className="w-7 h-7 flex items-center justify-center rounded-md border-none cursor-pointer bg-transparent transition-transform duration-200 hover:-translate-y-px" style={{ color: t.textMuted, opacity: loading ? .5 : 1 }} aria-label="Actions">
        {loading ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{ animation: "spin 1s linear infinite" }}><path d="M12 2v4m0 12v4m-7.07-3.93l2.83-2.83m8.48-8.48l2.83-2.83M2 12h4m12 0h4m-3.93 7.07l-2.83-2.83M7.76 7.76L4.93 4.93"/></svg> : <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/></svg>}
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 min-w-[160px] rounded-lg overflow-hidden shadow-lg" style={{ background: dark ? "#1e1e1e" : "#fff", border: `1px solid ${dark ? "rgba(255,255,255,.18)" : "rgba(0,0,0,.18)"}` }}>
          {items.filter(Boolean).map((item, i) => (
            <button key={i} onClick={(e) => { e.stopPropagation(); setOpen(false); item.action(); }} className="w-full text-left py-2 px-3 text-[13px] font-medium border-none cursor-pointer bg-transparent block transition-transform duration-200 hover:-translate-y-px" style={{ color: item.danger ? (dark ? "#fca5a5" : "#dc2626") : t.textSoft, borderBottom: i < items.filter(Boolean).length - 1 ? `1px solid ${dark ? "rgba(255,255,255,.12)" : "rgba(0,0,0,.1)"}` : "none" }} onMouseEnter={e => e.currentTarget.style.background = dark ? "rgba(255,255,255,.1)" : "rgba(0,0,0,.06)"} onMouseLeave={e => e.currentTarget.style.background = "transparent"}>{item.label}</button>
          ))}
        </div>
      )}
    </div>
  );
}


/* ── Group orders into batch + single timeline ── */
function groupOrders(orders) {
  const batches = {};
  const items = [];
  for (const o of orders) {
    if (o.batchId) {
      if (!batches[o.batchId]) {
        batches[o.batchId] = { type: "batch", batchId: o.batchId, orders: [], created: o.created };
        items.push(batches[o.batchId]);
      }
      batches[o.batchId].orders.push(o);
      if (o.created < batches[o.batchId].created) batches[o.batchId].created = o.created;
    } else {
      items.push({ type: "single", order: o, created: o.created });
    }
  }
  items.sort((a, b) => new Date(b.created) - new Date(a.created));
  return items;
}


/* ── Platform stack (overlapping icons) ── */
function PlatformStack({ platforms, dark }) {
  const unique = [...new Set(platforms)].slice(0, 4);
  return (
    <div className="flex items-center" style={{ marginLeft: 4 }}>
      {unique.map((p, i) => (
        <div key={p} style={{ marginLeft: i > 0 ? -8 : 0, zIndex: unique.length - i, position: "relative" }}>
          <PlatformIcon platform={p} dark={dark} size={24} />
        </div>
      ))}
    </div>
  );
}


/* ── Batch row ── */
function BatchRow({ batch, dark, t, expanded, onToggle, expandedOrder, setExpandedOrder, doAction, actionLoading, doBatchAction, batchActionLoading, confirm }) {
  const hasAttention = batch.orders.some(o => o.status === "Partial");
  const activeOrders = batch.orders.filter(o => o.status === "Pending" || o.status === "Processing");
  const pendingNoApi = batch.orders.filter(o => o.status === "Pending" && !o.apiOrderId && (o.lastError || o.retryCount > 0));
  const platforms = batch.orders.map(o => o.platform);
  const totalCharge = batch.orders.reduce((s, o) => s + (o.charge || 0), 0);
  const statusCounts = {};
  batch.orders.forEach(o => { statusCounts[o.status] = (statusCounts[o.status] || 0) + 1; });
  const isLoading = batchActionLoading === batch.batchId;
  const accentColor = hasAttention ? (dark ? "#fcd34d" : "#d97706") : t.accent;

  const checkable = batch.orders.filter(o => o.apiOrderId && !["Completed", "Cancelled"].includes(o.status));
  const completedOrders = batch.orders.filter(o => o.status === "Completed");
  const menuItems = [
    checkable.length > 0 && { label: "Check All", action: () => doBatchAction(batch.batchId, "check") },
    completedOrders.length > 0 && { label: `Reorder (${completedOrders.length})`, action: async () => {
      const ok = await confirm({ title: "Reorder Batch", message: `Reorder ${completedOrders.length} completed order${completedOrders.length > 1 ? "s" : ""} from ${batch.batchId}? A new batch will be created and charged from your wallet.`, confirmLabel: "Place Reorder" });
      if (ok) doBatchAction(batch.batchId, "reorder_completed");
    }},
    pendingNoApi.length > 0 && { label: `Retry Pending (${pendingNoApi.length})`, action: async () => {
      const ok = await confirm({ title: "Retry Pending", message: `Retry ${pendingNoApi.length} pending order${pendingNoApi.length > 1 ? "s" : ""} in ${batch.batchId}?`, confirmLabel: "Retry" });
      if (ok) doBatchAction(batch.batchId, "reorder");
    }},
    activeOrders.length > 0 && { label: `Cancel All (${activeOrders.length})`, danger: true, action: async () => {
      const ok = await confirm({ title: "Cancel Batch", message: `Cancel ${activeOrders.length} active order${activeOrders.length > 1 ? "s" : ""} in ${batch.batchId}? Your wallet will be refunded.`, confirmLabel: "Cancel All", danger: true });
      if (ok) doBatchAction(batch.batchId, "cancel");
    }},
  ];

  return (
    <div>
      {/* Collapsed header */}
      <div role="button" tabIndex={0} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();e.currentTarget.click()}}} onClick={() => onToggle(batch.batchId)} className="flex items-center py-3 px-3 desktop:py-3.5 desktop:px-4 cursor-pointer gap-2 desktop:gap-3 transition-[background-color] duration-150 hover:bg-[rgba(196,125,142,.06)]" style={{ borderBottom: `1px solid ${t.cardBorder}` }}>
        <div className="shrink-0 flex items-center justify-center" style={{ width: 36, height: 36, borderRadius: 10, background: dark ? "rgba(196,125,142,.1)" : "rgba(196,125,142,.08)" }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={t.accent} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 002 1.61h9.72a2 2 0 002-1.61L23 6H6"/></svg>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="m text-sm desktop:text-[15px] font-semibold" style={{ color: t.text }}>{batch.batchId}</span>
            {hasAttention && <span className="text-[11px] font-semibold py-0.5 px-1.5 rounded" style={{ background: dark ? "rgba(252,211,77,.15)" : "rgba(217,119,6,.08)", color: dark ? "#fcd34d" : "#d97706" }}>Attention</span>}
          </div>
          <div className="flex items-center gap-1 mt-1 text-xs desktop:text-[13px] flex-wrap" style={{ color: t.textMuted }}>
            <span>{batch.orders.length} orders</span>
            {Object.entries(statusCounts).map(([status, count]) => (
              <span key={status} className="flex items-center gap-1">
                <span className="w-[3px] h-[3px] rounded-full bg-current opacity-35 shrink-0" />
                <span className="inline-block w-[6px] h-[6px] rounded-full shrink-0" style={{ background: sClr(status, dark) }} />
                <span>{count} {status}</span>
              </span>
            ))}
          </div>
        </div>
        <div className="text-right shrink-0 flex items-center gap-2">
          <div className="m text-sm desktop:text-[15px] font-semibold" style={{ color: dark ? "#fca5a5" : "#dc2626" }}>{fN(totalCharge)}</div>
          <DotMenu items={menuItems} dark={dark} t={t} loading={isLoading} />
          <svg className="shrink-0" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={t.textMuted} strokeWidth="2" strokeLinecap="round" style={{ transform: expanded ? "rotate(180deg)" : "rotate(0)", transition: "transform .2s" }}><polyline points="6 9 12 15 18 9"/></svg>
        </div>
      </div>

      {/* Expanded body — order list */}
      {expanded && (
        <div style={{ background: dark ? "rgba(255,255,255,.03)" : "rgba(0,0,0,.02)", borderLeft: `3px solid ${accentColor}`, borderTop: `2px solid ${dark ? "rgba(196,125,142,.28)" : "rgba(196,125,142,.24)"}` }}>
          {batch.orders.map((o, i) => (
            <div key={o.id}>
              <div role="button" tabIndex={0} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();e.currentTarget.click()}}} onClick={() => setExpandedOrder(expandedOrder === o.id ? null : o.id)} className="flex items-center py-2.5 px-3 desktop:py-3 desktop:px-4 pl-4 desktop:pl-5 cursor-pointer gap-2.5 desktop:gap-3 transition-[background-color] duration-150 hover:bg-[rgba(196,125,142,.06)]" style={{ borderBottom: `1px solid ${dark ? "rgba(255,255,255,.08)" : "rgba(0,0,0,.08)"}` }}>
                <PlatformIcon platform={o.platform} dark={dark} size={32} />
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] desktop:text-sm font-medium overflow-hidden text-ellipsis whitespace-nowrap max-md:whitespace-normal max-md:line-clamp-2 max-md:[display:-webkit-box] max-md:[-webkit-box-orient:vertical]" style={{ color: t.text }}>{o.service}{o.tier ? ` · ${o.tier}` : ""}</div>
                  <div className="flex items-center gap-1.5 text-[11px] desktop:text-xs mt-0.5" style={{ color: t.textMuted }}>
                    <span className="m">{o.id}</span>
                    <span className="w-[3px] h-[3px] rounded-full bg-current opacity-35 shrink-0" />
                    <span>{o.quantity?.toLocaleString() || 0} qty</span>
                  </div>
                </div>
                <div className="text-right shrink-0 flex items-center gap-2">
                  <div>
                    <div className="m text-[13px] desktop:text-sm font-semibold" style={{ color: dark ? "#fca5a5" : "#dc2626" }}>{fN(o.charge)}</div>
                    <Badge status={o.status} dark={dark} />
                  </div>
                  <DotMenu items={[
                    (o.status === "Processing" || o.status === "Pending") && { label: "Check Status", action: () => doAction(o.id, "check") },
                    (o.status === "Processing" || o.status === "Pending") && { label: "Cancel", danger: true, action: async () => { const ok = await confirm({ title: "Cancel Order", message: `Cancel order ${o.id}? Your wallet will be refunded.`, confirmLabel: "Cancel Order", danger: true }); if (ok) doAction(o.id, "cancel"); }},
                    (o.status === "Completed" || o.status === "Cancelled") && { label: "Reorder", action: async () => { const ok = await confirm({ title: "Reorder", message: `Reorder ${o.service}? ${fN(o.charge)} will be charged from your wallet.`, confirmLabel: "Place Reorder" }); if (ok) doAction(o.id, "reorder"); }},
                  ]} dark={dark} t={t} loading={actionLoading === o.id} />
                  <svg className="shrink-0" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={t.textMuted} strokeWidth="2" strokeLinecap="round" style={{ transform: expandedOrder === o.id ? "rotate(180deg)" : "rotate(0)", transition: "transform .2s" }}><polyline points="6 9 12 15 18 9"/></svg>
                </div>
              </div>
              {expandedOrder === o.id && (
                <div className="py-3 px-3 desktop:px-4 pl-[52px] desktop:pl-[60px]" style={{ background: dark ? "rgba(196,125,142,.08)" : "rgba(196,125,142,.06)", borderTop: `2px solid ${dark ? "rgba(196,125,142,.28)" : "rgba(196,125,142,.24)"}`, borderBottom: `1px solid ${dark ? "rgba(255,255,255,.08)" : "rgba(0,0,0,.08)"}`, borderLeft: `3px solid ${t.accent}` }}>
                  <div className="grid grid-cols-2 desktop:grid-cols-3 gap-2 text-[13px]">
                    <div className="col-span-full">
                      <div className="text-[11px] mb-[3px] uppercase tracking-[1px]" style={{ color: t.textMuted }}>Link</div>
                      <div className="m text-[13px] break-all" style={{ color: t.accent }}>{o.link ? <a href={o.link} target="_blank" rel="noopener noreferrer" style={{ color: "inherit", textDecoration: "underline", textUnderlineOffset: 3 }}>{o.link}</a> : "—"}</div>
                    </div>
                    <div>
                      <div className="text-[11px] mb-[3px] uppercase tracking-[1px]" style={{ color: t.textMuted }}>Quantity</div>
                      <div className="m text-[13px]" style={{ color: t.text }}>{o.quantity?.toLocaleString() || 0}</div>
                    </div>
                    <div>
                      <div className="text-[11px] mb-[3px] uppercase tracking-[1px]" style={{ color: t.textMuted }}>Platform</div>
                      <div className="text-[13px]" style={{ color: t.text }}>{o.platform || "—"}</div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const PER_PAGE_OPTIONS = [25, 50, 100];

function Pagination({ total, page, setPage, perPage, setPerPage, t }) {
  const totalPages = Math.ceil(total / perPage);
  if (total <= 25) return null;
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
        <button onClick={() => setPage(Math.max(1, page - 1))} disabled={page <= 1} className="w-[30px] h-[30px] rounded-md flex items-center justify-center border cursor-pointer bg-transparent transition-transform duration-200 hover:-translate-y-px" style={{ borderColor: t.cardBorder, color: t.textSoft, opacity: page <= 1 ? .3 : 1 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
          let p;
          if (totalPages <= 5) p = i + 1;
          else if (page <= 2) p = i + 1;
          else if (page >= totalPages - 1) p = totalPages - 4 + i;
          else p = page - 2 + i;
          return (
            <button key={p} onClick={() => setPage(p)} className="m py-1 px-2.5 rounded-md text-sm border cursor-pointer transition-transform duration-200 hover:-translate-y-px" style={{ background: page === p ? t.navActive : "transparent", color: page === p ? t.accent : t.textMuted, borderColor: page === p ? t.accent + "40" : t.cardBorder }}>{p}</button>
          );
        })}
        <button onClick={() => setPage(Math.min(totalPages, page + 1))} disabled={page >= totalPages} className="w-[30px] h-[30px] rounded-md flex items-center justify-center border cursor-pointer bg-transparent transition-transform duration-200 hover:-translate-y-px" style={{ borderColor: t.cardBorder, color: t.textSoft, opacity: page >= totalPages ? .3 : 1 }}>
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
  const [expandedBatch, setExpandedBatch] = useState(null);
  const [expandedBatchOrder, setExpandedBatchOrder] = useState(null);
  const [expandedTx, setExpandedTx] = useState(null);
  const [oPage, setOPage] = useState(1);
  const [tPage, setTPage] = useState(1);
  const [actionLoading, setActionLoading] = useState(null);
  const [batchActionLoading, setBatchActionLoading] = useState(null);
  const toast = useToast();

  useEffect(() => { setOrders(initialOrders); }, [initialOrders]);

  const fetchOrders = useCallback(async () => {
    try {
      const res = await fetch("/api/orders");
      const data = await res.json();
      if (res.ok && data.orders) setOrders(data.orders);
    } catch {}
  }, []);

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

  const doBatchAction = async (batchId, action) => {
    setBatchActionLoading(batchId);
    try {
      const res = await fetch("/api/orders/bulk", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, batchId }) });
      const data = await res.json();
      if (!res.ok) { toast.error("Action failed", data.error || "Something went wrong"); setBatchActionLoading(null); return; }
      await fetchOrders();
      if (action === "check") toast.info("Batch checked", `Checked ${data.checked || 0} orders · ${data.updated || 0} updated`);
      else if (action === "cancel") toast.success("Batch cancelled", `${data.cancelled || 0} cancelled${data.refunded ? ` · ${fN(data.refunded)} refunded` : ""}`);
      else if (action === "reorder") toast.success("Batch retry", `Placed ${data.placed || 0} of ${data.retried || 0}`);
      else if (action === "reorder_completed") toast.success("Reorder placed", `${data.placed || 0} orders · ${data.newBatchId || ""} · ${fN(data.totalCharge || 0)} charged`);
    } catch { toast.error("Request failed", "Check your connection and try again"); }
    setBatchActionLoading(null);
  };

  /* Per-page preference from localStorage */
  const [perPage, setPerPage] = useState(25);
  useEffect(() => {
    try { const saved = localStorage.getItem("nitro-per-page"); if (saved) setPerPage(Number(saved)); } catch {}
  }, []);

  const filteredOrders = orders.filter(o => {
    if (filter !== "all" && o.status !== filter) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!o.id?.toLowerCase().includes(q) && !o.service?.toLowerCase().includes(q) && !(o.batchId || "").toLowerCase().includes(q)) return false;
    }
    return true;
  });
  const grouped = groupOrders(filteredOrders);
  const pagedGroups = grouped.slice((oPage - 1) * perPage, oPage * perPage);

  const txTypes = [...new Set(txs.map(tx => tx.type))];
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
          <input aria-label="Search orders" placeholder="Search by order ID or service..." value={search} onChange={e => { setSearch(e.target.value); setOPage(1); }} className="w-full py-2 desktop:py-2.5 px-3 desktop:px-3.5 pr-8 rounded-[10px] border text-[13px] desktop:text-sm font-[inherit] outline-none box-border" style={{ borderColor: t.cardBorder, background: dark ? "rgba(255,255,255,.06)" : "#fff", color: t.text }} />
          {search && <button aria-label="Clear search" onClick={() => { setSearch(""); setOPage(1); }} className="absolute right-2.5 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center rounded-full text-xs cursor-pointer border-none" style={{ background: dark ? "rgba(255,255,255,.18)" : "rgba(0,0,0,.14)", color: t.textMuted }}><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>}
        </div>

        {/* Status filters */}
        <div className="flex gap-1 desktop:gap-1.5 mb-2 desktop:mb-3 flex-wrap justify-end">
          <select value={filter} onChange={e => { setFilter(e.target.value); setOPage(1); setExpanded(null); }} style={{
            padding: "7px 28px 7px 10px", borderRadius: 8, fontSize: 13, fontWeight: 500,
            background: dark ? "rgba(255,255,255,.04)" : "rgba(0,0,0,.03)",
            border: `1px solid ${dark ? "rgba(255,255,255,.14)" : "rgba(0,0,0,.14)"}`,
            color: dark ? "rgba(255,255,255,.7)" : "rgba(0,0,0,.7)",
            appearance: "none", cursor: "pointer", fontFamily: "inherit", textAlign: "center", textAlignLast: "center",
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='10' height='6' viewBox='0 0 10 6' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1L5 5L9 1' stroke='${dark ? "%23666" : "%23999"}' stroke-width='1.5' stroke-linecap='round'/%3E%3C/svg%3E")`,
            backgroundRepeat: "no-repeat", backgroundPosition: "right 8px center",
          }}>
            {["all", "Completed", "Processing", "Pending", "Partial", "Cancelled"].map(f => (
              <option key={f} value={f}>{f === "all" ? `All (${orders.length})` : `${f} (${counts[f] || 0})`}</option>
            ))}
          </select>
        </div>

        {/* Order list */}
        <div className="rounded-xl desktop:rounded-[14px] overflow-hidden" style={{ background: dark ? "rgba(255,255,255,.06)" : "rgba(255,255,255,.85)", border: `0.5px solid ${t.cardBorder}` }}>
          {pagedGroups.length > 0 ? pagedGroups.map((item, i) => {
            if (item.type === "batch") {
              return <BatchRow key={item.batchId} batch={item} dark={dark} t={t} expanded={expandedBatch === item.batchId} onToggle={(id) => { setExpandedBatch(expandedBatch === id ? null : id); setExpandedBatchOrder(null); }} expandedOrder={expandedBatchOrder} setExpandedOrder={setExpandedBatchOrder} doAction={doAction} actionLoading={actionLoading} doBatchAction={doBatchAction} batchActionLoading={batchActionLoading} confirm={confirm} />;
            }
            const o = item.order;
            return (
              <div key={o.id}>
                <div role="button" tabIndex={0} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();e.currentTarget.click()}}} onClick={() => setExpanded(expanded === o.id ? null : o.id)} className="flex items-center py-3 px-3.5 desktop:py-3.5 desktop:px-[18px] cursor-pointer gap-2.5 desktop:gap-3.5 transition-[background-color] duration-150 hover:bg-[rgba(196,125,142,.06)]" style={{ borderBottom: (i < pagedGroups.length - 1 || expanded === o.id) ? `1px solid ${t.cardBorder}` : "none" }}>
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
                    <div className="m text-sm desktop:text-[15px] font-semibold" style={{ color: dark ? "#fca5a5" : "#dc2626" }}>{fN(o.charge)}</div>
                    <Badge status={o.status} dark={dark} />
                  </div>
                  <svg className="shrink-0" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={t.textMuted} strokeWidth="2" strokeLinecap="round" style={{ transform: expanded === o.id ? "rotate(180deg)" : "rotate(0)", transition: "transform .2s" }}><polyline points="6 9 12 15 18 9"/></svg>
                </div>

                {/* Expanded details */}
                {expanded === o.id && (
                  <div className="py-3.5 px-3.5 desktop:py-3.5 desktop:px-[18px] pl-[58px] desktop:pl-[70px]" style={{ background: dark ? "rgba(196,125,142,.08)" : "rgba(196,125,142,.06)", borderTop: `2px solid ${dark ? "rgba(196,125,142,.28)" : "rgba(196,125,142,.24)"}`, borderBottom: `2px solid ${dark ? "rgba(196,125,142,.24)" : "rgba(196,125,142,.19)"}`, borderLeft: `3px solid ${t.accent}` }}>
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
                        <button onClick={() => doAction(o.id, "check")} disabled={actionLoading === o.id} className="m py-1.5 px-3 desktop:px-4 rounded-md text-xs desktop:text-[13px] font-semibold border cursor-pointer bg-transparent transition-transform duration-200 hover:-translate-y-px" style={{ borderColor: t.cardBorder, color: t.textSoft }}>{actionLoading === o.id ? "..." : "Check Status"}</button>
                        <button onClick={async () => { const ok = await confirm({ title: "Cancel Order", message: `Cancel order ${o.id}? Your wallet will be refunded.`, confirmLabel: "Cancel Order", danger: true }); if (ok) doAction(o.id, "cancel"); }} disabled={actionLoading === o.id} className="m py-1.5 px-3 desktop:px-4 rounded-md text-xs desktop:text-[13px] font-semibold border cursor-pointer bg-transparent transition-transform duration-200 hover:-translate-y-px" style={{ borderColor: dark ? "rgba(252,165,165,.28)" : "rgba(220,38,38,.24)", color: dark ? "#fca5a5" : "#dc2626" }}>Cancel</button>
                      </div>
                    )}
                    {(o.status === "Completed" || o.status === "Cancelled") && (
                      <div className="flex gap-2">
                        <button onClick={async () => { const ok = await confirm({ title: "Reorder", message: `Reorder ${o.service}? ₦${o.charge?.toLocaleString()} will be charged from your wallet.`, confirmLabel: "Place Reorder" }); if (ok) doAction(o.id, "reorder"); }} disabled={actionLoading === o.id} className="m py-1.5 px-3 desktop:px-4 rounded-md text-xs desktop:text-[13px] font-semibold border cursor-pointer bg-transparent transition-transform duration-200 hover:-translate-y-px" style={{ borderColor: t.cardBorder, color: t.accent }}>{actionLoading === o.id ? "..." : "Reorder"}</button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          }) : (
            <div className="p-10 text-center text-[15px]" style={{ color: t.textMuted }}>
              <svg width="48" height="48" viewBox="0 0 64 64" fill="none" style={{ marginBottom: 14, opacity: .7, display: "block", margin: "0 auto 14px" }}>
                <rect x="12" y="8" width="40" height="48" rx="6" stroke={t.accent} strokeWidth="1.5" opacity=".3" />
                <line x1="20" y1="22" x2="44" y2="22" stroke={t.accent} strokeWidth="1.5" opacity=".2" strokeLinecap="round" />
                <line x1="20" y1="30" x2="38" y2="30" stroke={t.accent} strokeWidth="1.5" opacity=".15" strokeLinecap="round" />
                <circle cx="32" cy="38" r="8" stroke={t.accent} strokeWidth="1.5" opacity=".2" />
                <path d="M29 38l2 2 4-4" stroke={t.accent} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity=".4" />
              </svg>
              <div className="text-base font-semibold mb-1" style={{ color: t.textSoft }}>No orders yet — let's change that</div>
              <div className="text-[15px]" style={{ color: t.textMuted }}>Your order history will show up here once you start boosting</div>
            </div>
          )}
        </div>
        <Pagination total={grouped.length} page={oPage} setPage={setOPage} perPage={perPage} setPerPage={setPerPage} t={t} />
      </>}

      {/* ═══ TRANSACTIONS TAB ═══ */}
      {tab === "transactions" && <>
        <div className="flex gap-1 desktop:gap-1.5 mb-2 desktop:mb-3 flex-wrap justify-end">
          <select value={txFilter} onChange={e => { setTxFilter(e.target.value); setTPage(1); }} style={{
            padding: "7px 28px 7px 10px", borderRadius: 8, fontSize: 13, fontWeight: 500,
            background: dark ? "rgba(255,255,255,.04)" : "rgba(0,0,0,.03)",
            border: `1px solid ${dark ? "rgba(255,255,255,.14)" : "rgba(0,0,0,.14)"}`,
            color: dark ? "rgba(255,255,255,.7)" : "rgba(0,0,0,.7)",
            appearance: "none", cursor: "pointer", fontFamily: "inherit", textTransform: "capitalize", textAlign: "center", textAlignLast: "center",
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='10' height='6' viewBox='0 0 10 6' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1L5 5L9 1' stroke='${dark ? "%23666" : "%23999"}' stroke-width='1.5' stroke-linecap='round'/%3E%3C/svg%3E")`,
            backgroundRepeat: "no-repeat", backgroundPosition: "right 8px center",
          }}>
            <option value="all">All ({txs.length})</option>
            {txTypes.map(f => (
              <option key={f} value={f}>{txLabel(f)} ({txs.filter(tx => tx.type === f).length})</option>
            ))}
          </select>
        </div>

        <div className="rounded-xl desktop:rounded-[14px] overflow-hidden" style={{ background: dark ? "rgba(255,255,255,.06)" : "rgba(255,255,255,.85)", border: `0.5px solid ${t.cardBorder}` }}>
          {pagedTxs.length > 0 ? pagedTxs.map((tx, i) => {
            const isBulk = tx.type === "order" && tx.reference?.startsWith("BULK-");
            const batchOrders = isBulk ? orders.filter(o => o.batchId === tx.reference) : [];
            const isExpanded = expandedTx === tx.id;
            return (
              <div key={tx.id}>
                <div role={isBulk ? "button" : undefined} tabIndex={isBulk ? 0 : undefined} onKeyDown={isBulk ? e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.currentTarget.click(); } } : undefined} onClick={isBulk ? () => setExpandedTx(isExpanded ? null : tx.id) : undefined} className={`flex items-center gap-2.5 desktop:gap-3.5 py-3 px-3.5 desktop:py-3.5 desktop:px-[18px]${isBulk ? " cursor-pointer transition-[background-color] duration-150 hover:bg-[rgba(196,125,142,.06)]" : ""}`} style={{ borderBottom: (i < pagedTxs.length - 1 || isExpanded) ? `1px solid ${t.cardBorder}` : "none" }}>
                  <div className="w-8 h-8 desktop:w-9 desktop:h-9 rounded-[10px] flex items-center justify-center text-base font-semibold shrink-0" style={{ background: dark ? `${txClr(tx.type, dark)}15` : `${txClr(tx.type, dark)}10`, color: txClr(tx.type, dark) }}>{txIcon(tx.type)}</div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm desktop:text-[15px] font-medium overflow-hidden text-ellipsis whitespace-nowrap" style={{ color: t.text }}>{txLabel(tx.type)}{isBulk ? ` · ${batchOrders.length} orders` : ""}</div>
                    <div className="text-[13px] desktop:text-sm mt-0.5 overflow-hidden text-ellipsis whitespace-nowrap" style={{ color: t.textMuted }}>{txDesc(tx)}</div>
                    <div className="text-[11px] desktop:text-xs mt-0.5" style={{ color: t.textMuted, opacity: .7 }}>{tx.date ? fD(tx.date) : ""}</div>
                  </div>
                  <div className="m text-[15px] desktop:text-base font-semibold shrink-0" style={{ color: tx.amount > 0 ? t.green : (dark ? "#fca5a5" : "#dc2626") }}>
                    {tx.amount > 0 ? "+" : ""}{fN(tx.amount)}
                  </div>
                  {isBulk && <svg className="shrink-0" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={t.textMuted} strokeWidth="2" strokeLinecap="round" style={{ transform: isExpanded ? "rotate(180deg)" : "rotate(0)", transition: "transform .2s" }}><polyline points="6 9 12 15 18 9"/></svg>}
                </div>
                {isExpanded && batchOrders.length > 0 && (
                  <div style={{ background: dark ? "rgba(255,255,255,.04)" : "rgba(0,0,0,.02)", borderBottom: i < pagedTxs.length - 1 ? `1px solid ${t.cardBorder}` : "none", borderLeft: `3px solid ${t.accent}`, borderTop: `2px solid ${dark ? "rgba(196,125,142,.28)" : "rgba(196,125,142,.24)"}` }}>
                    {batchOrders.map((o, j) => (
                      <div key={o.id} className="flex items-center gap-2.5 py-2 px-4 pl-[52px] desktop:pl-[58px]" style={{ borderBottom: j < batchOrders.length - 1 ? `1px solid ${dark ? "rgba(255,255,255,.08)" : "rgba(0,0,0,.08)"}` : "none" }}>
                        <PlatformIcon platform={o.platform} dark={dark} size={16} />
                        <div className="flex-1 min-w-0">
                          <div className="text-[13px] font-medium overflow-hidden text-ellipsis whitespace-nowrap" style={{ color: t.text }}>{o.service}</div>
                          <div className="text-[11px]" style={{ color: t.textMuted }}>{o.id} · {(o.quantity || 0).toLocaleString()} qty</div>
                        </div>
                        <Badge status={o.status} dark={dark} />
                        <div className="m text-[13px] font-semibold shrink-0" style={{ color: dark ? "#fca5a5" : "#dc2626" }}>{fN(o.charge)}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          }) : (
            <div className="p-10 text-center text-[15px]" style={{ color: t.textMuted }}>
              <svg width="48" height="48" viewBox="0 0 64 64" fill="none" style={{ marginBottom: 14, opacity: .7, display: "block", margin: "0 auto 14px" }}>
                <rect x="8" y="16" width="48" height="32" rx="6" stroke={t.accent} strokeWidth="1.5" opacity=".25" />
                <rect x="38" y="26" width="18" height="12" rx="3" stroke={t.accent} strokeWidth="1.5" opacity=".2" />
                <circle cx="46" cy="32" r="2" stroke={t.accent} strokeWidth="1.5" opacity=".3" />
                <line x1="16" y1="24" x2="30" y2="24" stroke={t.accent} strokeWidth="1.5" opacity=".15" strokeLinecap="round" />
              </svg>
              <div className="text-base font-semibold mb-1" style={{ color: t.textSoft }}>No transactions yet</div>
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
      <div className="text-[13px] font-semibold uppercase tracking-[1.5px] mb-2.5 py-2 px-3 rounded-lg" style={{ color: t.textMuted, background: dark ? "rgba(196,125,142,.18)" : "rgba(196,125,142,.12)" }}>Order Summary</div>
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
      <div className="text-[13px] font-semibold uppercase tracking-[1.5px] mb-2.5 py-2 px-3 rounded-lg" style={{ color: t.textMuted, background: dark ? "rgba(196,125,142,.18)" : "rgba(196,125,142,.12)" }}>Recent Activity</div>
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
