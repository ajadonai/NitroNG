'use client';
import { useState, useEffect } from "react";
import { useConfirm } from "./confirm-dialog";
import { useToast } from "./toast";
import { PlatformIcon } from "./platform-icon";
import { fN, fD } from "../lib/format";
import { FilterDropdown } from "./date-range-picker";


function sClr(s, dk) { return s === "Completed" ? (dk ? "#6ee7b7" : "#059669") : s === "Processing" ? (dk ? "#a5b4fc" : "#4f46e5") : s === "Pending" ? (dk ? "#fcd34d" : "#d97706") : s === "Partial" ? (dk ? "#fca5a5" : "#dc2626") : s === "Cancelled" ? (dk ? "#888" : "#666") : (dk ? "#555" : "#888"); }
function sBg(s, dk) { return s === "Completed" ? (dk ? "#0a2416" : "#ecfdf5") : s === "Processing" ? (dk ? "#0f1629" : "#eef2ff") : s === "Pending" ? (dk ? "#1c1608" : "#fffbeb") : s === "Partial" ? (dk ? "#1f0a0a" : "#fef2f2") : s === "Cancelled" ? (dk ? "#1a1a1a" : "#f5f5f5") : (dk ? "#1a1a1a" : "#f5f5f5"); }
function sBrd(s, dk) { return s === "Completed" ? (dk ? "#166534" : "#a7f3d0") : s === "Processing" ? (dk ? "#3730a3" : "#c7d2fe") : s === "Pending" ? (dk ? "#92400e" : "#fde68a") : s === "Partial" ? (dk ? "#991b1b" : "#fecaca") : s === "Cancelled" ? (dk ? "#404040" : "#d4d4d4") : (dk ? "#404040" : "#d4d4d4"); }

function Badge({ status, dark }) {
  return <span className="text-[13px] font-semibold py-0.5 px-2 rounded-[5px] border-[0.5px] whitespace-nowrap inline-block" style={{ background: sBg(status, dark), color: sClr(status, dark), borderColor: sBrd(status, dark) }}>{status}</span>;
}

function ProgressBar({ order, dark }) {
  const qty = order.quantity || 0;
  if (!qty || order.status === "Cancelled") return null;
  const hasData = order.remains != null;
  const isComplete = order.status === "Completed";
  const delivered = isComplete ? qty : hasData ? Math.max(0, qty - Math.max(0, order.remains)) : 0;
  const pct = isComplete ? 100 : hasData ? Math.min(100, Math.round((delivered / qty) * 100)) : 0;
  const color = isComplete ? (dark ? "#6ee7b7" : "#059669") : "#c47d8e";
  const waiting = !hasData && !isComplete && (order.status === "Pending" || order.status === "Processing");
  return (
    <div>
      <div className="flex items-center justify-between text-[11px] mb-1" style={{ color: dark ? "rgba(255,255,255,.6)" : "rgba(0,0,0,.45)" }}>
        <span>{waiting ? "Waiting to start" : `${delivered.toLocaleString()} / ${qty.toLocaleString()} delivered`}</span>
        {!waiting && <span style={{ color }}>{pct}%</span>}
      </div>
      <div className="max-w-[220px] h-1.5 rounded-full overflow-hidden" style={{ background: dark ? "rgba(255,255,255,.14)" : "rgba(0,0,0,.08)" }}>
        {waiting
          ? <div className="h-full w-1/3 rounded-full" style={{ background: `${color}40`, animation: "progress-pulse 1.8s ease-in-out infinite" }} />
          : <div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${pct}%`, background: color }} />}
      </div>
    </div>
  );
}

function PlatformStack({ platforms, dark }) {
  const unique = [...new Set(platforms.filter(Boolean))];
  if (!unique.length) return null;
  return (
    <div className="flex items-center">
      {unique.slice(0, 4).map((p, i) => (
        <div key={p} className="rounded-lg flex items-center justify-center" style={{ width: 26, height: 26, background: dark ? "rgba(255,255,255,.09)" : "rgba(0,0,0,.04)", border: `1px solid ${dark ? "rgba(255,255,255,.12)" : "rgba(0,0,0,.06)"}`, marginLeft: i > 0 ? -6 : 0, zIndex: unique.length - i }}>
          <PlatformIcon platform={p} dark={dark} size={16} />
        </div>
      ))}
    </div>
  );
}

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

export default function AdminOrdersPage({ dark, t }) {
  const confirm = useConfirm();
  const toast = useToast();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState(null);
  const [expandedBatch, setExpandedBatch] = useState(null);
  const [expandedBatchOrder, setExpandedBatchOrder] = useState(null);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(() => { try { const s = localStorage.getItem("adm-per-page"); return s ? Number(s) : 25; } catch { return 25; } });

  useEffect(() => {
    fetch("/api/admin/orders").then(r => r.json()).then(d => { setOrders(d.orders || []); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  const filtered = orders.filter(o => {
    if (filter !== "all" && o.status !== filter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (o.id || "").toLowerCase().includes(q) || (o.service || "").toLowerCase().includes(q) || (o.user || "").toLowerCase().includes(q) || (o.batchId || "").toLowerCase().includes(q);
    }
    return true;
  });

  const grouped = groupOrders(filtered);
  const totalPages = Math.ceil(grouped.length / perPage);
  const paged = grouped.slice((page - 1) * perPage, page * perPage);
  const counts = { all: orders.length };
  ["Completed", "Processing", "Pending", "Partial", "Cancelled"].forEach(s => { counts[s] = orders.filter(o => o.status === s).length; });

  const [syncing, setSyncing] = useState(false);
  const syncOrders = async () => {
    setSyncing(true);
    try {
      const res = await fetch("/api/admin/sync", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "sync-orders" }) });
      const data = await res.json();
      if (!res.ok) { toast.error("Sync failed", data.error || "Something went wrong"); return; }
      if (data.message) { toast.info("Sync complete", data.message); return; }
      toast.success("Sync complete", `Checked ${data.checked} · ${data.updated} updated · ${data.refunded} refunded${data.errors ? ` · ${data.errors} errors` : ""}`);
      if (data.updated > 0) {
        const r = await fetch("/api/admin/orders");
        const d = await r.json();
        if (d.orders) setOrders(d.orders);
      }
    } catch { toast.error("Sync failed", "Check your connection"); } finally { setSyncing(false); }
  };

  const [actionLoading, setActionLoading] = useState(null);
  const doAction = async (orderId, action) => {
    if (actionLoading) return;
    setActionLoading(orderId);
    try {
      const res = await fetch("/api/admin/orders", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, orderId }) });
      const data = await res.json();
      if (!res.ok) { toast.error("Action failed", data.error || "Something went wrong"); return; }
      if (data.status) {
        setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: data.status, ...(data.remains != null && { remains: data.remains }), ...(data.startCount != null && { startCount: Number(data.startCount) }) } : o));
      }
      const label = action === "check" ? `Status: ${data.status || "unknown"}${data.remains != null ? ` · ${data.remains} remaining` : ""}` : action === "cancel" ? "Order cancelled" : "Refill requested";
      toast.success(orderId, label);
    } catch { toast.error("Request failed", "Check your connection"); } finally { setActionLoading(null); }
  };

  const [batchActionLoading, setBatchActionLoading] = useState(null);
  const doBatchAction = async (batchId, action) => {
    setBatchActionLoading(batchId);
    try {
      const batchOrders = orders.filter(o => o.batchId === batchId);
      let checked = 0, updated = 0, cancelled = 0;
      for (const o of batchOrders) {
        if (action === "check" && o.apiOrderId && !["Completed", "Cancelled"].includes(o.status)) {
          try {
            const res = await fetch("/api/admin/orders", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "check", orderId: o.id }) });
            const data = await res.json();
            if (res.ok) { checked++; if (data.status) { if (data.status !== o.status) updated++; setOrders(prev => prev.map(p => p.id === o.id ? { ...p, status: data.status, ...(data.remains != null && { remains: data.remains }), ...(data.startCount != null && { startCount: Number(data.startCount) }) } : p)); } }
          } catch {}
        }
        if (action === "cancel" && !["Completed", "Cancelled"].includes(o.status)) {
          try {
            const res = await fetch("/api/admin/orders", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "cancel", orderId: o.id }) });
            if (res.ok) { cancelled++; setOrders(prev => prev.map(p => p.id === o.id ? { ...p, status: "Cancelled" } : p)); }
          } catch {}
        }
      }
      if (action === "check") toast.info("Batch checked", `Checked ${checked} orders · ${updated} updated`);
      if (action === "cancel") toast.success("Batch cancelled", `${cancelled} orders cancelled`);
    } catch { toast.error("Request failed", "Check your connection"); }
    setBatchActionLoading(null);
  };

  return (
    <>
      <div className="adm-header">
        <div className="flex items-center justify-between">
          <div>
            <div className="adm-title" style={{ color: t.text }}>Orders</div>
            <div className="adm-subtitle" style={{ color: t.textMuted }}>{orders.length} total orders</div>
          </div>
          <button onClick={syncOrders} disabled={syncing} className="m flex items-center gap-1.5 py-2 px-4 rounded-lg text-[13px] font-semibold cursor-pointer border-none transition-all duration-200 hover:-translate-y-px" style={{ background: dark ? "rgba(196,125,142,.15)" : "rgba(196,125,142,.1)", color: t.accent, opacity: syncing ? .5 : 1 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ animation: syncing ? "spin 1s linear infinite" : "none" }}><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/></svg>
            {syncing ? "Syncing..." : "Sync Orders"}
          </button>
        </div>
        <div className="page-divider" style={{ background: t.cardBorder }} />
      </div>

      {/* Search + filters */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <div className="relative flex-1 min-w-full desktop:min-w-[200px]">
          <input aria-label="Search orders" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} placeholder="Search by order ID, batch ID, service, or user..." className="adm-search pr-8 w-full" style={{ borderColor: t.cardBorder, background: dark ? "rgba(255,255,255,.09)" : "#fff", color: t.text }} />
          {search && <button aria-label="Clear search" onClick={() => { setSearch(""); setPage(1); }} className="absolute right-2.5 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center rounded-full text-xs cursor-pointer border-none" style={{ background: dark ? "rgba(255,255,255,.18)" : "rgba(0,0,0,.14)", color: t.textMuted }}><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>}
        </div>
        <FilterDropdown dark={dark} t={t} value={filter} onChange={(v) => { setFilter(v); setPage(1); }} options={
          ["all", "Completed", "Processing", "Pending", "Partial", "Cancelled"].map(f => ({
            value: f, label: f === "all" ? "All" : f,
          }))
        } />
      </div>

      {/* Orders list */}
      <div className="adm-card" style={{ background: dark ? "rgba(255,255,255,.09)" : "rgba(255,255,255,.85)", border: `0.5px solid ${dark ? "rgba(255,255,255,.16)" : "rgba(0,0,0,.12)"}` }}>
        {loading ? (
          <div className="adm-empty">{[1,2,3,4,5].map(i => <div key={i} className={`skel-bone h-[52px] rounded-lg mb-1.5 ${dark ? "skel-dark" : "skel-light"}`} />)}</div>
        ) : paged.length > 0 ? paged.map((item, idx) => {
          if (item.type === "batch") {
            const batch = item;
            const isOpen = expandedBatch === batch.batchId;
            const statusCounts = {};
            batch.orders.forEach(o => { statusCounts[o.status] = (statusCounts[o.status] || 0) + 1; });
            const totalCharge = batch.orders.reduce((s, o) => s + (o.charge || 0), 0);
            const hasAttention = batch.orders.some(o => o.status === "Pending" || o.status === "Processing");
            const activeOrders = batch.orders.filter(o => !["Completed", "Cancelled"].includes(o.status));
            const checkable = batch.orders.filter(o => o.apiOrderId && !["Completed", "Cancelled"].includes(o.status));
            const isBatchLoading = batchActionLoading === batch.batchId;
            const allCancelled = batch.orders.every(o => o.status === "Cancelled");
            const accentColor = hasAttention ? (dark ? "#fcd34d" : "#d97706") : t.accent;
            const platforms = batch.orders.map(o => o.platform);

            return (
              <div key={batch.batchId} style={{ borderBottom: idx < paged.length - 1 ? `1px solid ${t.cardBorder}` : "none" }}>
                {/* Batch header */}
                <div role="button" tabIndex={0} onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.currentTarget.click(); } }} onClick={() => { setExpandedBatch(isOpen ? null : batch.batchId); setExpandedBatchOrder(null); setExpanded(null); }} className="flex items-center py-3 px-3.5 desktop:py-3.5 desktop:px-5 cursor-pointer gap-3 desktop:gap-4 transition-[background-color] duration-150 hover:bg-[rgba(196,125,142,.06)]">
                  <div className="shrink-0 flex items-center justify-center rounded-xl" style={{ width: 42, height: 42, background: dark ? "rgba(196,125,142,.12)" : "rgba(196,125,142,.08)", border: `1px solid ${dark ? "rgba(196,125,142,.2)" : "rgba(196,125,142,.15)"}` }}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={t.accent} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 002 1.61h9.72a2 2 0 002-1.61L23 6H6"/></svg>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap mb-0.5">
                      <span className="m text-[13px] desktop:text-[15px] font-semibold" style={{ color: t.text }}>{batch.batchId}</span>
                      <span className="text-[11px] desktop:text-xs" style={{ color: t.textMuted }}>{batch.orders[0]?.user}</span>
                      {hasAttention && <span className="text-[10px] font-bold py-0.5 px-1.5 rounded-md uppercase tracking-wide" style={{ background: dark ? "rgba(252,211,77,.15)" : "rgba(217,119,6,.08)", color: dark ? "#fcd34d" : "#d97706" }}>Attention</span>}
                    </div>
                    <div className="flex items-center gap-1.5 text-[11px] desktop:text-xs flex-wrap" style={{ color: t.textMuted }}>
                      <span className="font-medium">{batch.orders.length} orders</span>
                      {Object.entries(statusCounts).map(([status, count]) => (
                        <span key={status} className="flex items-center gap-1">
                          <span className="w-[3px] h-[3px] rounded-full bg-current opacity-30 shrink-0" />
                          <span className="inline-block w-[5px] h-[5px] rounded-full shrink-0" style={{ background: sClr(status, dark) }} />
                          <span>{count} {status}</span>
                        </span>
                      ))}
                      <span className="w-[3px] h-[3px] rounded-full bg-current opacity-30 shrink-0" />
                      <span>{batch.created ? fD(batch.created, true) : ""}</span>
                    </div>
                  </div>
                  <div className="text-right shrink-0 flex items-center gap-2.5">
                    <div className="flex flex-col items-end gap-1.5">
                      <div className="m text-[13px] desktop:text-[15px] font-bold" style={{ color: allCancelled ? (dark ? "#fca5a5" : "#dc2626") : (dark ? "#6ee7b7" : "#059669") }}>{allCancelled ? "-" : "+"}{fN(totalCharge)}</div>
                      <PlatformStack platforms={platforms} dark={dark} />
                    </div>
                    <div className="flex gap-1">
                      {checkable.length > 0 && <button onClick={e => { e.stopPropagation(); doBatchAction(batch.batchId, "check"); }} disabled={isBatchLoading} className="adm-btn-sm text-[11px]" style={{ borderColor: t.cardBorder, color: t.textSoft, opacity: isBatchLoading ? .5 : 1 }}>{isBatchLoading ? "..." : "Check All"}</button>}
                      {activeOrders.length > 0 && <button onClick={async e => { e.stopPropagation(); const ok = await confirm({ title: "Cancel Batch", message: `Cancel ${activeOrders.length} active order${activeOrders.length > 1 ? "s" : ""} in ${batch.batchId}? This may issue refunds.`, confirmLabel: "Cancel All", danger: true }); if (ok) doBatchAction(batch.batchId, "cancel"); }} disabled={isBatchLoading} className="adm-btn-sm text-[11px]" style={{ borderColor: dark ? "rgba(252,165,165,.28)" : "rgba(220,38,38,.24)", color: dark ? "#fca5a5" : "#dc2626", opacity: isBatchLoading ? .5 : 1 }}>Cancel All</button>}
                    </div>
                    <svg className="shrink-0" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={t.textMuted} strokeWidth="2" strokeLinecap="round" style={{ transform: isOpen ? "rotate(180deg)" : "rotate(0)", transition: "transform .2s" }}><polyline points="6 9 12 15 18 9"/></svg>
                  </div>
                </div>

                {/* Expanded batch — order list */}
                {isOpen && (
                  <div style={{ background: dark ? "rgba(255,255,255,.05)" : "rgba(0,0,0,.02)", borderLeft: `3px solid ${accentColor}`, borderTop: `2px solid ${dark ? "rgba(196,125,142,.28)" : "rgba(196,125,142,.24)"}` }}>
                    {batch.orders.map((o, i) => (
                      <div key={o.id}>
                        <div role="button" tabIndex={0} onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.currentTarget.click(); } }} onClick={() => setExpandedBatchOrder(expandedBatchOrder === o.id ? null : o.id)} className="flex items-center py-2.5 px-3 desktop:py-3 desktop:px-4 pl-4 desktop:pl-5 cursor-pointer gap-2.5 desktop:gap-3 transition-[background-color] duration-150 hover:bg-[rgba(196,125,142,.06)]" style={{ borderBottom: `1px solid ${dark ? "rgba(255,255,255,.12)" : "rgba(0,0,0,.08)"}` }}>
                          <div className="shrink-0 flex items-center justify-center rounded-lg" style={{ width: 36, height: 36, background: dark ? "rgba(255,255,255,.08)" : "rgba(0,0,0,.03)", border: `1px solid ${dark ? "rgba(255,255,255,.10)" : "rgba(0,0,0,.05)"}` }}>
                            <PlatformIcon platform={o.platform} dark={dark} size={22} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="text-[13px] desktop:text-sm font-semibold overflow-hidden text-ellipsis whitespace-nowrap max-md:whitespace-normal max-md:line-clamp-2 max-md:[display:-webkit-box] max-md:[-webkit-box-orient:vertical]" style={{ color: t.text }}>{o.service}{o.tier ? <span className="font-normal" style={{ color: t.textMuted }}> · {o.tier}</span> : ""}</div>
                            <div className="flex items-center gap-1.5 text-[10px] desktop:text-[11px] mt-0.5" style={{ color: t.textMuted }}>
                              <span className="m" style={o.status === "Cancelled" ? { color: dark ? "#fca5a5" : "#dc2626" } : o.status === "Completed" ? { color: dark ? "#6ee7b7" : "#059669" } : o.status === "Partial" ? { color: dark ? "#fbbf24" : "#d97706" } : undefined}>{o.id}</span>
                              <span className="w-[3px] h-[3px] rounded-full bg-current opacity-30 shrink-0" />
                              <span>{o.quantity?.toLocaleString() || 0} qty</span>
                            </div>
                          </div>
                          <div className="text-right shrink-0 flex items-center gap-1.5">
                            {!["Completed", "Cancelled", "Partial"].includes(o.status) && <span className="inline-block w-[5px] h-[5px] rounded-full shrink-0" style={{ background: sClr(o.status, dark) }} />}
                            <div className="m text-[13px] desktop:text-sm font-bold" style={{ color: o.status === "Cancelled" ? (dark ? "#fca5a5" : "#dc2626") : o.status === "Partial" ? (dark ? "#fbbf24" : "#d97706") : (dark ? "#6ee7b7" : "#059669") }}>{o.status === "Cancelled" ? "-" : "+"}{fN(o.charge)}</div>
                          </div>
                          <svg className="shrink-0 ml-0.5" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={t.textMuted} strokeWidth="2" strokeLinecap="round" style={{ transform: expandedBatchOrder === o.id ? "rotate(180deg)" : "rotate(0)", transition: "transform .2s" }}><polyline points="6 9 12 15 18 9"/></svg>
                        </div>
                        {expandedBatchOrder === o.id && (
                          <div className="py-3 px-3 desktop:py-3.5 desktop:px-4 pl-4 desktop:pl-5" style={{ background: dark ? "rgba(196,125,142,.05)" : "rgba(196,125,142,.04)", borderTop: `1px solid ${dark ? "rgba(196,125,142,.2)" : "rgba(196,125,142,.15)"}`, borderBottom: `3px solid ${dark ? "rgba(196,125,142,.25)" : "rgba(196,125,142,.2)"}`, borderLeft: `3px solid ${t.accent}` }}>
                            {/* Link */}
                            {o.link && (
                              <div className="mb-2.5 py-1.5 px-2.5 rounded-lg" style={{ background: dark ? "rgba(255,255,255,.07)" : "rgba(0,0,0,.03)", border: `1px solid ${dark ? "rgba(255,255,255,.12)" : "rgba(0,0,0,.06)"}` }}>
                                <div className="flex items-center gap-1.5 mb-0.5">
                                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={t.textMuted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/></svg>
                                  <span className="text-[10px] uppercase tracking-[1px] font-medium" style={{ color: t.textMuted }}>Link</span>
                                </div>
                                <a href={o.link} target="_blank" rel="noopener noreferrer" className="m text-[12px] break-all" style={{ color: t.accent, textDecoration: "underline", textUnderlineOffset: 3 }}>{o.link}</a>
                              </div>
                            )}

                            {/* Info grid */}
                            {(() => { const isPartial = o.status === "Partial" && o.remains > 0 && o.quantity > 0; const delivered = isPartial ? o.quantity - o.remains : o.quantity; const ratio = isPartial ? delivered / o.quantity : 1; const netCharge = isPartial ? Math.round(o.charge * ratio) : o.charge; const netCost = isPartial ? Math.round((o.cost || 0) * ratio) : (o.cost || 0); return (
                            <div className="grid grid-cols-2 desktop:grid-cols-4 gap-1.5 mb-2.5">
                              <div className="py-1.5 px-2 rounded-lg text-center" style={{ background: dark ? "rgba(255,255,255,.07)" : "rgba(0,0,0,.03)", border: `1px solid ${dark ? "rgba(255,255,255,.12)" : "rgba(0,0,0,.06)"}` }}>
                                <div className="text-[10px] uppercase tracking-[1px] mb-0.5" style={{ color: t.textMuted }}>{isPartial ? "Delivered" : "Qty"}</div>
                                <div className="m text-[13px] font-semibold" style={{ color: t.text }}>{isPartial ? `${delivered.toLocaleString()}/${o.quantity.toLocaleString()}` : (o.quantity?.toLocaleString() || 0)}</div>
                              </div>
                              <div className="py-1.5 px-2 rounded-lg text-center" style={{ background: dark ? "rgba(255,255,255,.07)" : "rgba(0,0,0,.03)", border: `1px solid ${dark ? "rgba(255,255,255,.12)" : "rgba(0,0,0,.06)"}` }}>
                                <div className="text-[10px] uppercase tracking-[1px] mb-0.5" style={{ color: t.textMuted }}>{o.status === "Cancelled" ? "Refunded" : isPartial ? "Net Charge" : "Charge"}</div>
                                <div className="m text-[13px] font-semibold" style={{ color: o.status === "Cancelled" ? (dark ? "#fca5a5" : "#dc2626") : o.status === "Partial" ? (dark ? "#fbbf24" : "#d97706") : (dark ? "#6ee7b7" : "#059669") }}>{o.status === "Cancelled" ? "-" : "+"}{fN(netCharge)}</div>
                              </div>
                              <div className="py-1.5 px-2 rounded-lg text-center" style={{ background: dark ? "rgba(255,255,255,.07)" : "rgba(0,0,0,.03)", border: `1px solid ${dark ? "rgba(255,255,255,.12)" : "rgba(0,0,0,.06)"}` }}>
                                <div className="text-[10px] uppercase tracking-[1px] mb-0.5" style={{ color: t.textMuted }}>Cost</div>
                                <div className="m text-[13px] font-semibold" style={{ color: o.status === "Cancelled" ? t.textMuted : (dark ? "#fca5a5" : "#dc2626") }}>{fN(o.status === "Cancelled" ? 0 : netCost)}</div>
                              </div>
                              <div className="py-1.5 px-2 rounded-lg text-center" style={{ background: dark ? "rgba(255,255,255,.07)" : "rgba(0,0,0,.03)", border: `1px solid ${dark ? "rgba(255,255,255,.12)" : "rgba(0,0,0,.06)"}` }}>
                                <div className="text-[10px] uppercase tracking-[1px] mb-0.5" style={{ color: t.textMuted }}>Profit</div>
                                <div className="m text-[13px] font-semibold" style={{ color: o.status === "Cancelled" ? t.textMuted : (dark ? "#6ee7b7" : "#059669") }}>{fN(o.status === "Cancelled" ? 0 : netCharge - netCost)}</div>
                              </div>
                              <div className="py-1.5 px-2 rounded-lg text-center" style={{ background: dark ? "rgba(255,255,255,.07)" : "rgba(0,0,0,.03)", border: `1px solid ${dark ? "rgba(255,255,255,.12)" : "rgba(0,0,0,.06)"}` }}>
                                <div className="text-[10px] uppercase tracking-[1px] mb-0.5" style={{ color: t.textMuted }}>Status</div>
                                <Badge status={o.status} dark={dark} />
                              </div>
                              <div className="py-1.5 px-2 rounded-lg text-center" style={{ background: dark ? "rgba(255,255,255,.07)" : "rgba(0,0,0,.03)", border: `1px solid ${dark ? "rgba(255,255,255,.12)" : "rgba(0,0,0,.06)"}` }}>
                                <div className="text-[10px] uppercase tracking-[1px] mb-0.5" style={{ color: t.textMuted }}>Provider</div>
                                <div className="m text-[13px] font-bold" style={{ color: t.text }}>{(o.provider || "mtp").toUpperCase()}</div>
                              </div>
                              {o.serviceApiId && <div className="py-1.5 px-2 rounded-lg text-center" style={{ background: dark ? "rgba(255,255,255,.07)" : "rgba(0,0,0,.03)", border: `1px solid ${dark ? "rgba(255,255,255,.12)" : "rgba(0,0,0,.06)"}` }}>
                                <div className="text-[10px] uppercase tracking-[1px] mb-0.5" style={{ color: t.textMuted }}>Service ID</div>
                                <div className="m text-[13px] font-semibold" style={{ color: t.text, fontFamily: "var(--font-mono, monospace)" }}>{o.serviceApiId}</div>
                              </div>}
                              {o.apiOrderId && <div className="py-1.5 px-2 rounded-lg text-center" style={{ background: dark ? "rgba(255,255,255,.07)" : "rgba(0,0,0,.03)", border: `1px solid ${dark ? "rgba(255,255,255,.12)" : "rgba(0,0,0,.06)"}` }}>
                                <div className="text-[10px] uppercase tracking-[1px] mb-0.5" style={{ color: t.textMuted }}>Provider Order</div>
                                <div className="m text-[13px] font-semibold" style={{ color: t.text, fontFamily: "var(--font-mono, monospace)" }}>{o.apiOrderId}</div>
                              </div>}
                              {o.remains != null && o.status !== "Cancelled" && <div className="py-1.5 px-2 rounded-lg text-center" style={{ background: dark ? "rgba(255,255,255,.07)" : "rgba(0,0,0,.03)", border: `1px solid ${dark ? "rgba(255,255,255,.12)" : "rgba(0,0,0,.06)"}` }}>
                                <div className="text-[10px] uppercase tracking-[1px] mb-0.5" style={{ color: t.textMuted }}>Delivered</div>
                                <div className="m text-[13px] font-semibold" style={{ color: dark ? "#6ee7b7" : "#059669" }}>{Math.max(0, (o.quantity || 0) - o.remains).toLocaleString()}</div>
                              </div>}
                              {o.startCount != null && <div className="py-1.5 px-2 rounded-lg text-center" style={{ background: dark ? "rgba(255,255,255,.07)" : "rgba(0,0,0,.03)", border: `1px solid ${dark ? "rgba(255,255,255,.12)" : "rgba(0,0,0,.06)"}` }}>
                                <div className="text-[10px] uppercase tracking-[1px] mb-0.5" style={{ color: t.textMuted }}>Start Count</div>
                                <div className="m text-[13px] font-semibold" style={{ color: t.text }}>{o.startCount.toLocaleString()}</div>
                              </div>}
                            </div>
                            ); })()}

                            {/* User + date */}
                            <div className="text-[12px] mb-2.5" style={{ color: t.textMuted }}>
                              <span style={{ color: t.text }}>{o.user}</span> · {o.email} · {o.created ? fD(o.created) : ""}
                            </div>

                            {/* Progress */}
                            {o.status !== "Cancelled" && <div className="mb-2.5"><ProgressBar order={o} dark={dark} /></div>}

                            {/* Actions */}
                            <div className="flex gap-1.5">
                              <button onClick={() => doAction(o.id, "check")} disabled={actionLoading === o.id} className="m py-1.5 px-3 rounded-lg text-[11px] font-semibold cursor-pointer border-none transition-all duration-200 hover:-translate-y-px" style={{ background: dark ? "rgba(196,125,142,.15)" : "rgba(196,125,142,.1)", color: t.accent, opacity: actionLoading === o.id ? .5 : 1 }}>{actionLoading === o.id ? "..." : "Check Status"}</button>
                              {o.status !== "Cancelled" && o.status !== "Completed" && <button onClick={async () => { const ok = await confirm({ title: "Cancel Order", message: `Cancel order ${o.id}? This may issue a refund.`, confirmLabel: "Cancel Order", danger: true }); if (ok) doAction(o.id, "cancel"); }} disabled={!!actionLoading} className="m py-1.5 px-3 rounded-lg text-[11px] font-semibold cursor-pointer border-none transition-all duration-200 hover:-translate-y-px" style={{ background: dark ? "rgba(252,165,165,.12)" : "rgba(220,38,38,.08)", color: dark ? "#fca5a5" : "#dc2626" }}>Cancel</button>}
                              {o.status === "Completed" && <button onClick={async () => { const ok = await confirm({ title: "Refill Order", message: `Request a refill for order ${o.id}?`, confirmLabel: "Refill" }); if (ok) doAction(o.id, "refill"); }} disabled={!!actionLoading} className="m py-1.5 px-3 rounded-lg text-[11px] font-semibold cursor-pointer border-none transition-all duration-200 hover:-translate-y-px" style={{ background: dark ? "rgba(196,125,142,.15)" : "rgba(196,125,142,.1)", color: t.accent }}>Refill</button>}
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

          // Single order
          const o = item.order;
          return (
            <div key={o.id} style={{ borderBottom: idx < paged.length - 1 ? `1px solid ${t.cardBorder}` : "none" }}>
              <div role="button" tabIndex={0} onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.currentTarget.click(); } }} onClick={() => { setExpanded(expanded === o.id ? null : o.id); setExpandedBatch(null); setExpandedBatchOrder(null); }} className="flex items-center py-3 px-3.5 desktop:py-3.5 desktop:px-5 cursor-pointer gap-3 desktop:gap-4 transition-[background-color] duration-150 hover:bg-[rgba(196,125,142,.06)]" style={{ cursor: "pointer" }}>
                <div className="shrink-0 flex items-center justify-center rounded-xl" style={{ width: 42, height: 42, background: dark ? "rgba(255,255,255,.09)" : "rgba(0,0,0,.04)", border: `1px solid ${dark ? "rgba(255,255,255,.12)" : "rgba(0,0,0,.06)"}` }}>
                  <PlatformIcon platform={o.platform} dark={dark} size={26} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] desktop:text-[15px] font-semibold overflow-hidden text-ellipsis whitespace-nowrap max-md:whitespace-normal max-md:line-clamp-2 max-md:[display:-webkit-box] max-md:[-webkit-box-orient:vertical] mb-0.5" style={{ color: t.text }}>{o.service}{o.tier ? <span className="font-normal" style={{ color: t.textMuted }}> · {o.tier}</span> : ""}</div>
                  <div className="flex items-center gap-1.5 text-[11px] desktop:text-xs" style={{ color: t.textMuted }}>
                    <span className="m" style={o.status === "Cancelled" ? { color: dark ? "#fca5a5" : "#dc2626" } : o.status === "Completed" ? { color: dark ? "#6ee7b7" : "#059669" } : o.status === "Partial" ? { color: dark ? "#fbbf24" : "#d97706" } : undefined}>{o.id}</span>
                    <span className="w-[3px] h-[3px] rounded-full bg-current opacity-30 shrink-0" />
                    <span>{o.user}</span>
                    <span className="w-[3px] h-[3px] rounded-full bg-current opacity-30 shrink-0" />
                    <span>{o.quantity?.toLocaleString() || 0} qty</span>
                    <span className="w-[3px] h-[3px] rounded-full bg-current opacity-30 shrink-0" />
                    <span>{o.created ? fD(o.created, true) : ""}</span>
                  </div>
                </div>
                <div className="text-right shrink-0 flex items-center gap-1.5">
                  {!["Completed", "Cancelled", "Partial"].includes(o.status) && <span className="inline-block w-[6px] h-[6px] rounded-full shrink-0" style={{ background: sClr(o.status, dark) }} />}
                  <div className="m text-[13px] desktop:text-[15px] font-bold" style={{ color: o.status === "Cancelled" ? (dark ? "#fca5a5" : "#dc2626") : o.status === "Partial" ? (dark ? "#fbbf24" : "#d97706") : (dark ? "#6ee7b7" : "#059669") }}>{o.status === "Cancelled" ? "-" : "+"}{fN(o.charge)}</div>
                </div>
                <svg className="shrink-0 ml-0.5" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={t.textMuted} strokeWidth="2" strokeLinecap="round" style={{ transform: expanded === o.id ? "rotate(180deg)" : "rotate(0)", transition: "transform .2s" }}><polyline points="6 9 12 15 18 9"/></svg>
              </div>
              {expanded === o.id && (
                <div className="py-3.5 px-3.5 desktop:py-4 desktop:px-5" style={{ background: dark ? "rgba(196,125,142,.05)" : "rgba(196,125,142,.04)", borderTop: `1px solid ${dark ? "rgba(196,125,142,.2)" : "rgba(196,125,142,.15)"}`, borderBottom: `3px solid ${dark ? "rgba(196,125,142,.25)" : "rgba(196,125,142,.2)"}`, borderLeft: `3px solid ${t.accent}` }}>
                  {/* Link */}
                  {o.link && (
                    <div className="mb-3 py-2 px-3 rounded-lg" style={{ background: dark ? "rgba(255,255,255,.07)" : "rgba(0,0,0,.03)", border: `1px solid ${dark ? "rgba(255,255,255,.12)" : "rgba(0,0,0,.06)"}` }}>
                      <div className="flex items-center gap-1.5 mb-1">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={t.textMuted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/></svg>
                        <span className="text-[11px] uppercase tracking-[1px] font-medium" style={{ color: t.textMuted }}>Link</span>
                      </div>
                      <a href={o.link} target="_blank" rel="noopener noreferrer" className="m text-[13px] break-all" style={{ color: t.accent, textDecoration: "underline", textUnderlineOffset: 3 }}>{o.link}</a>
                    </div>
                  )}

                  {/* Info grid */}
                  {(() => { const isPartial = o.status === "Partial" && o.remains > 0 && o.quantity > 0; const delivered = isPartial ? o.quantity - o.remains : o.quantity; const ratio = isPartial ? delivered / o.quantity : 1; const netCharge = isPartial ? Math.round(o.charge * ratio) : o.charge; const netCost = isPartial ? Math.round((o.cost || 0) * ratio) : (o.cost || 0); return (
                  <div className="grid grid-cols-2 desktop:grid-cols-4 gap-2 mb-3">
                    <div className="py-2 px-2.5 rounded-lg text-center" style={{ background: dark ? "rgba(255,255,255,.07)" : "rgba(0,0,0,.03)", border: `1px solid ${dark ? "rgba(255,255,255,.12)" : "rgba(0,0,0,.06)"}` }}>
                      <div className="text-[11px] uppercase tracking-[1px] mb-1" style={{ color: t.textMuted }}>{isPartial ? "Delivered" : "Quantity"}</div>
                      <div className="m text-sm font-semibold" style={{ color: t.text }}>{isPartial ? `${delivered.toLocaleString()}/${o.quantity.toLocaleString()}` : (o.quantity?.toLocaleString() || 0)}</div>
                    </div>
                    <div className="py-2 px-2.5 rounded-lg text-center" style={{ background: dark ? "rgba(255,255,255,.07)" : "rgba(0,0,0,.03)", border: `1px solid ${dark ? "rgba(255,255,255,.12)" : "rgba(0,0,0,.06)"}` }}>
                      <div className="text-[11px] uppercase tracking-[1px] mb-1" style={{ color: t.textMuted }}>{o.status === "Cancelled" ? "Refunded" : isPartial ? "Net Charge" : "Charge"}</div>
                      <div className="m text-sm font-semibold" style={{ color: o.status === "Cancelled" ? (dark ? "#fca5a5" : "#dc2626") : o.status === "Partial" ? (dark ? "#fbbf24" : "#d97706") : (dark ? "#6ee7b7" : "#059669") }}>{o.status === "Cancelled" ? "-" : "+"}{fN(netCharge)}</div>
                    </div>
                    <div className="py-2 px-2.5 rounded-lg text-center" style={{ background: dark ? "rgba(255,255,255,.07)" : "rgba(0,0,0,.03)", border: `1px solid ${dark ? "rgba(255,255,255,.12)" : "rgba(0,0,0,.06)"}` }}>
                      <div className="text-[11px] uppercase tracking-[1px] mb-1" style={{ color: t.textMuted }}>Cost</div>
                      <div className="m text-sm font-semibold" style={{ color: o.status === "Cancelled" ? t.textMuted : (dark ? "#fca5a5" : "#dc2626") }}>{fN(o.status === "Cancelled" ? 0 : netCost)}</div>
                    </div>
                    <div className="py-2 px-2.5 rounded-lg text-center" style={{ background: dark ? "rgba(255,255,255,.07)" : "rgba(0,0,0,.03)", border: `1px solid ${dark ? "rgba(255,255,255,.12)" : "rgba(0,0,0,.06)"}` }}>
                      <div className="text-[11px] uppercase tracking-[1px] mb-1" style={{ color: t.textMuted }}>Profit</div>
                      <div className="m text-sm font-semibold" style={{ color: o.status === "Cancelled" ? t.textMuted : (dark ? "#6ee7b7" : "#059669") }}>{fN(o.status === "Cancelled" ? 0 : netCharge - netCost)}</div>
                    </div>
                    <div className="py-2 px-2.5 rounded-lg text-center" style={{ background: dark ? "rgba(255,255,255,.07)" : "rgba(0,0,0,.03)", border: `1px solid ${dark ? "rgba(255,255,255,.12)" : "rgba(0,0,0,.06)"}` }}>
                      <div className="text-[11px] uppercase tracking-[1px] mb-1" style={{ color: t.textMuted }}>Status</div>
                      <Badge status={o.status} dark={dark} />
                    </div>
                    <div className="py-2 px-2.5 rounded-lg text-center" style={{ background: dark ? "rgba(255,255,255,.07)" : "rgba(0,0,0,.03)", border: `1px solid ${dark ? "rgba(255,255,255,.12)" : "rgba(0,0,0,.06)"}` }}>
                      <div className="text-[11px] uppercase tracking-[1px] mb-1" style={{ color: t.textMuted }}>Provider</div>
                      <div className="m text-sm font-bold" style={{ color: t.text }}>{(o.provider || "mtp").toUpperCase()}</div>
                    </div>
                    {o.serviceApiId && <div className="py-2 px-2.5 rounded-lg text-center" style={{ background: dark ? "rgba(255,255,255,.07)" : "rgba(0,0,0,.03)", border: `1px solid ${dark ? "rgba(255,255,255,.12)" : "rgba(0,0,0,.06)"}` }}>
                      <div className="text-[11px] uppercase tracking-[1px] mb-1" style={{ color: t.textMuted }}>Service ID</div>
                      <div className="m text-sm font-semibold" style={{ color: t.text, fontFamily: "var(--font-mono, monospace)" }}>{o.serviceApiId}</div>
                    </div>}
                    {o.apiOrderId && <div className="py-2 px-2.5 rounded-lg text-center" style={{ background: dark ? "rgba(255,255,255,.07)" : "rgba(0,0,0,.03)", border: `1px solid ${dark ? "rgba(255,255,255,.12)" : "rgba(0,0,0,.06)"}` }}>
                      <div className="text-[11px] uppercase tracking-[1px] mb-1" style={{ color: t.textMuted }}>Provider Order</div>
                      <div className="m text-sm font-semibold" style={{ color: t.text, fontFamily: "var(--font-mono, monospace)" }}>{o.apiOrderId}</div>
                    </div>}
                    {o.remains != null && o.status !== "Cancelled" && <div className="py-2 px-2.5 rounded-lg text-center" style={{ background: dark ? "rgba(255,255,255,.07)" : "rgba(0,0,0,.03)", border: `1px solid ${dark ? "rgba(255,255,255,.12)" : "rgba(0,0,0,.06)"}` }}>
                      <div className="text-[11px] uppercase tracking-[1px] mb-1" style={{ color: t.textMuted }}>Delivered</div>
                      <div className="m text-sm font-semibold" style={{ color: dark ? "#6ee7b7" : "#059669" }}>{Math.max(0, (o.quantity || 0) - o.remains).toLocaleString()}</div>
                    </div>}
                    {o.startCount != null && <div className="py-2 px-2.5 rounded-lg text-center" style={{ background: dark ? "rgba(255,255,255,.07)" : "rgba(0,0,0,.03)", border: `1px solid ${dark ? "rgba(255,255,255,.12)" : "rgba(0,0,0,.06)"}` }}>
                      <div className="text-[11px] uppercase tracking-[1px] mb-1" style={{ color: t.textMuted }}>Start Count</div>
                      <div className="m text-sm font-semibold" style={{ color: t.text }}>{o.startCount.toLocaleString()}</div>
                    </div>}
                  </div>
                  ); })()}

                  {/* User info */}
                  <div className="text-[13px] mb-3" style={{ color: t.textMuted }}>
                    <span style={{ color: t.text, fontWeight: 500 }}>{o.user}</span> · {o.email} · {o.created ? fD(o.created) : ""}
                  </div>

                  {/* Progress */}
                  {o.status !== "Cancelled" && <div className="mb-3"><ProgressBar order={o} dark={dark} /></div>}

                  {/* Actions */}
                  <div className="flex gap-2">
                    <button onClick={() => doAction(o.id, "check")} disabled={actionLoading === o.id} className="m py-2 px-4 rounded-lg text-xs desktop:text-[13px] font-semibold cursor-pointer border-none transition-all duration-200 hover:-translate-y-px" style={{ background: dark ? "rgba(196,125,142,.15)" : "rgba(196,125,142,.1)", color: t.accent, opacity: actionLoading === o.id ? .5 : 1 }}>{actionLoading === o.id ? "..." : "Check Status"}</button>
                    {o.status !== "Cancelled" && o.status !== "Completed" && <button onClick={async () => { const ok = await confirm({ title: "Cancel Order", message: `Cancel order ${o.id}? This may issue a refund.`, confirmLabel: "Cancel Order", danger: true }); if (ok) doAction(o.id, "cancel"); }} disabled={!!actionLoading} className="m py-2 px-4 rounded-lg text-xs desktop:text-[13px] font-semibold cursor-pointer border-none transition-all duration-200 hover:-translate-y-px" style={{ background: dark ? "rgba(252,165,165,.12)" : "rgba(220,38,38,.08)", color: dark ? "#fca5a5" : "#dc2626" }}>Cancel</button>}
                    {o.status === "Completed" && <button onClick={async () => { const ok = await confirm({ title: "Refill Order", message: `Request a refill for order ${o.id}?`, confirmLabel: "Refill" }); if (ok) doAction(o.id, "refill"); }} disabled={!!actionLoading} className="m py-2 px-4 rounded-lg text-xs desktop:text-[13px] font-semibold cursor-pointer border-none transition-all duration-200 hover:-translate-y-px" style={{ background: dark ? "rgba(196,125,142,.15)" : "rgba(196,125,142,.1)", color: t.accent }}>Refill</button>}
                  </div>
                </div>
              )}
            </div>
          );
        }) : (
          <div className="py-[60px] px-5 text-center">
            <svg width="48" height="48" viewBox="0 0 64 64" fill="none" style={{ display: "block", margin: "0 auto 14px", opacity: .7 }}>
              <rect x="12" y="8" width="40" height="48" rx="6" stroke={t.accent} strokeWidth="1.5" opacity=".3" />
              <line x1="20" y1="22" x2="44" y2="22" stroke={t.accent} strokeWidth="1.5" opacity=".2" strokeLinecap="round" />
              <line x1="20" y1="30" x2="38" y2="30" stroke={t.accent} strokeWidth="1.5" opacity=".15" strokeLinecap="round" />
              <circle cx="32" cy="38" r="8" stroke={t.accent} strokeWidth="1.5" opacity=".2" />
              <path d="M29 38l2 2 4-4" stroke={t.accent} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity=".4" />
            </svg>
            <div className="text-base font-semibold mb-1" style={{ color: t.textSoft }}>No orders found</div>
            <div className="text-sm" style={{ color: t.textMuted }}>Orders will appear here once placed</div>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between py-3 px-5" style={{ borderTop: `1px solid ${t.cardBorder}` }}>
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="adm-btn-sm flex items-center gap-1" style={{ borderColor: t.cardBorder, color: t.textMuted, opacity: page === 1 ? .35 : 1 }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
              Prev
            </button>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5 text-[12px]" style={{ color: t.textMuted }}>
                <span>Show</span>
                <select value={perPage} onChange={e => { const v = Number(e.target.value); setPerPage(v); setPage(1); try { localStorage.setItem("adm-per-page", String(v)); } catch {} }} className="py-1 px-1.5 rounded-md text-[12px] font-medium cursor-pointer font-[inherit]" style={{ background: dark ? "rgba(255,255,255,.09)" : "rgba(0,0,0,.04)", border: `1px solid ${t.cardBorder}`, color: t.textMuted }}>
                  {[25, 50, 100].map(n => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
              <span className="text-[12px] font-medium" style={{ color: t.textMuted }}>Page {page} of {totalPages}</span>
            </div>
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages} className="adm-btn-sm flex items-center gap-1" style={{ borderColor: t.cardBorder, color: t.textMuted, opacity: page >= totalPages ? .35 : 1 }}>
              Next
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
            </button>
          </div>
        )}
      </div>
    </>
  );
}
