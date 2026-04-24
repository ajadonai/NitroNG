'use client';
import { useState, useEffect } from "react";
import { useConfirm } from "./confirm-dialog";
import { useToast } from "./toast";
import { PlatformIcon } from "./platform-icon";
import { fN, fD } from "../lib/format";


const STATUS_COLORS = {
  Completed: { bg: "rgba(110,231,183,.1)", bgL: "rgba(5,150,105,.06)", text: "#6ee7b7", textL: "#059669" },
  Processing: { bg: "rgba(165,180,252,.1)", bgL: "rgba(79,70,229,.06)", text: "#a5b4fc", textL: "#4f46e5" },
  Pending: { bg: "rgba(252,211,77,.1)", bgL: "rgba(217,119,6,.06)", text: "#fcd34d", textL: "#d97706" },
  Partial: { bg: "rgba(252,165,165,.1)", bgL: "rgba(220,38,38,.06)", text: "#fca5a5", textL: "#dc2626" },
  Cancelled: { bg: "rgba(160,160,160,.1)", bgL: "rgba(100,100,100,.06)", text: "#a3a3a3", textL: "#737373" },
};

function sClr(status, dark) {
  const s = STATUS_COLORS[status] || STATUS_COLORS.Cancelled;
  return dark ? s.text : s.textL;
}

function chargeColor(status, t) {
  if (status === "Cancelled" || status === "Partial") return t.red;
  return t.green;
}

function Badge({ status, dark }) {
  const s = STATUS_COLORS[status] || STATUS_COLORS.Cancelled;
  return <span className="text-[13px] py-0.5 px-2 rounded-[5px] font-semibold" style={{ background: dark ? s.bg : s.bgL, color: dark ? s.text : s.textL }}>{status}</span>;
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

  const [actionLoading, setActionLoading] = useState(null);
  const doAction = async (orderId, action) => {
    if (actionLoading) return;
    setActionLoading(orderId);
    try {
      const res = await fetch("/api/admin/orders", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, orderId }) });
      const data = await res.json();
      if (!res.ok) { toast.error("Action failed", data.error || "Something went wrong"); return; }
      if (data.status) {
        setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: data.status } : o));
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
            if (res.ok) { checked++; if (data.status && data.status !== o.status) { updated++; setOrders(prev => prev.map(p => p.id === o.id ? { ...p, status: data.status } : p)); } }
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

  const cardBg = dark ? "rgba(255,255,255,.06)" : "rgba(255,255,255,.85)";
  const cardBd = `0.5px solid ${dark ? "rgba(255,255,255,.12)" : "rgba(0,0,0,.12)"}`;

  return (
    <>
      <div className="adm-header">
        <div className="adm-title" style={{ color: t.text }}>Orders</div>
        <div className="adm-subtitle" style={{ color: t.textMuted }}>{orders.length} total orders</div>
        <div className="page-divider" style={{ background: t.cardBorder }} />
      </div>

      {/* Search */}
      <div className="relative">
        <input aria-label="Search orders" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} placeholder="Search by order ID, batch ID, service, or user..." className="adm-search pr-8" style={{ borderColor: t.cardBorder, background: dark ? "rgba(255,255,255,.06)" : "#fff", color: t.text }} />
        {search && <button aria-label="Clear search" onClick={() => { setSearch(""); setPage(1); }} className="absolute right-2.5 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center rounded-full text-xs cursor-pointer border-none" style={{ background: dark ? "rgba(255,255,255,.18)" : "rgba(0,0,0,.14)", color: t.textMuted }}><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>}
      </div>

      {/* Filters */}
      <div className="adm-filters flex justify-end">
        <select value={filter} onChange={e => { setFilter(e.target.value); setPage(1); }} className="py-[7px] pr-7 pl-2.5 rounded-lg text-[13px] font-medium appearance-none cursor-pointer font-[inherit] bg-no-repeat bg-[position:right_8px_center]" style={{
          backgroundColor: dark ? "rgba(255,255,255,.04)" : "rgba(0,0,0,.03)",
          border: `1px solid ${dark ? "rgba(255,255,255,.14)" : "rgba(0,0,0,.14)"}`,
          color: dark ? "rgba(255,255,255,.7)" : "rgba(0,0,0,.7)",
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='10' height='6' viewBox='0 0 10 6' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1L5 5L9 1' stroke='${dark ? "%23666" : "%23999"}' stroke-width='1.5' stroke-linecap='round'/%3E%3C/svg%3E")`,
        }}>
          {["all", "Completed", "Processing", "Pending", "Partial", "Cancelled"].map(f => (
            <option key={f} value={f}>{f === "all" ? `All (${orders.length})` : `${f} (${counts[f] || 0})`}</option>
          ))}
        </select>
      </div>

      {/* Orders list */}
      <div className="adm-card" style={{ background: cardBg, border: cardBd }}>
        {loading ? (
          <div className="adm-empty">{[1,2,3,4,5].map(i => <div key={i} className={`skel-bone h-[52px] rounded-lg mb-1.5 ${dark ? "skel-dark" : "skel-light"}`} />)}</div>
        ) : paged.length > 0 ? paged.map((item, idx) => {
          if (item.type === "batch") {
            const batch = item;
            const isOpen = expandedBatch === batch.batchId;
            const statusCounts = {};
            batch.orders.forEach(o => { statusCounts[o.status] = (statusCounts[o.status] || 0) + 1; });
            const totalCharge = batch.orders.reduce((s, o) => s + (o.charge || 0), 0);
            const hasAttention = batch.orders.some(o => o.status === "Partial");
            const activeOrders = batch.orders.filter(o => !["Completed", "Cancelled"].includes(o.status));
            const checkable = batch.orders.filter(o => o.apiOrderId && !["Completed", "Cancelled"].includes(o.status));
            const isBatchLoading = batchActionLoading === batch.batchId;
            const allBad = batch.orders.every(o => o.status === "Cancelled" || o.status === "Partial");
            const batchChargeColor = allBad ? t.red : t.green;

            return (
              <div key={batch.batchId} style={{ borderBottom: idx < paged.length - 1 ? `1px solid ${t.cardBorder}` : "none" }}>
                {/* Batch header */}
                <div role="button" tabIndex={0} onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.currentTarget.click(); } }} onClick={() => { setExpandedBatch(isOpen ? null : batch.batchId); setExpandedBatchOrder(null); }} className="flex items-center py-3.5 px-5 cursor-pointer gap-3 transition-[background-color] duration-150 hover:bg-[rgba(196,125,142,.06)]">
                  <div className="shrink-0 flex items-center justify-center" style={{ width: 36, height: 36, borderRadius: 10, background: dark ? "rgba(196,125,142,.1)" : "rgba(196,125,142,.08)" }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={t.accent} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 002 1.61h9.72a2 2 0 002-1.61L23 6H6"/></svg>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="m text-[15px] font-semibold" style={{ color: t.text }}>{batch.batchId}</span>
                      {hasAttention && <span className="text-[11px] font-semibold py-0.5 px-1.5 rounded" style={{ background: dark ? "rgba(252,211,77,.15)" : "rgba(217,119,6,.08)", color: dark ? "#fcd34d" : "#d97706" }}>Attention</span>}
                    </div>
                    <div className="flex items-center gap-1 mt-0.5 text-[13px] flex-wrap" style={{ color: t.textMuted }}>
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
                  <div className="text-right shrink-0 flex items-center gap-2.5">
                    <div className="text-sm font-semibold" style={{ color: batchChargeColor }}>{fN(totalCharge)}</div>
                    <div className="flex gap-1">
                      {checkable.length > 0 && <button onClick={e => { e.stopPropagation(); doBatchAction(batch.batchId, "check"); }} disabled={isBatchLoading} className="adm-btn-sm text-[11px]" style={{ borderColor: t.cardBorder, color: t.textSoft, opacity: isBatchLoading ? .5 : 1 }}>{isBatchLoading ? "..." : "Check All"}</button>}
                      {activeOrders.length > 0 && <button onClick={async e => { e.stopPropagation(); const ok = await confirm({ title: "Cancel Batch", message: `Cancel ${activeOrders.length} active order${activeOrders.length > 1 ? "s" : ""} in ${batch.batchId}? This may issue refunds.`, confirmLabel: "Cancel All", danger: true }); if (ok) doBatchAction(batch.batchId, "cancel"); }} disabled={isBatchLoading} className="adm-btn-sm text-[11px]" style={{ borderColor: dark ? "rgba(252,165,165,.28)" : "rgba(220,38,38,.24)", color: dark ? "#fca5a5" : "#dc2626", opacity: isBatchLoading ? .5 : 1 }}>Cancel All</button>}
                    </div>
                    <svg className="shrink-0" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={t.textMuted} strokeWidth="2" strokeLinecap="round" style={{ transform: isOpen ? "rotate(180deg)" : "rotate(0)", transition: "transform .2s" }}><polyline points="6 9 12 15 18 9"/></svg>
                  </div>
                </div>

                {/* Expanded batch — order list */}
                {isOpen && (
                  <div style={{ background: dark ? "rgba(255,255,255,.03)" : "rgba(0,0,0,.02)", borderLeft: `3px solid ${hasAttention ? (dark ? "#fcd34d" : "#d97706") : t.accent}`, borderTop: `2px solid ${dark ? "rgba(196,125,142,.28)" : "rgba(196,125,142,.24)"}` }}>
                    {batch.orders.map((o, i) => (
                      <div key={o.id}>
                        <div role="button" tabIndex={0} onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.currentTarget.click(); } }} onClick={() => setExpandedBatchOrder(expandedBatchOrder === o.id ? null : o.id)} className="adm-list-row cursor-pointer pl-5 transition-[background-color] duration-150 hover:bg-[rgba(196,125,142,.06)]" style={{ borderBottom: `1px solid ${dark ? "rgba(255,255,255,.08)" : "rgba(0,0,0,.08)"}` }}>
                          <div className="min-w-0 flex-1">
                            <div className="text-[14px] font-medium" style={{ color: t.text }}>{o.service}{o.tier ? ` · ${o.tier}` : ""}</div>
                            <div className="text-[13px] mt-0.5" style={{ color: t.textMuted }}>
                              <span className="m">{o.id}</span> · {o.user} · {o.quantity?.toLocaleString() || 0} qty
                            </div>
                          </div>
                          <div className="text-right flex items-center gap-2.5">
                            <div>
                              <div className="text-sm font-semibold" style={{ color: chargeColor(o.status, t) }}>{fN(o.charge)}</div>
                              <Badge status={o.status} dark={dark} />
                            </div>
                            <svg className="shrink-0" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={t.textMuted} strokeWidth="2" strokeLinecap="round" style={{ transform: expandedBatchOrder === o.id ? "rotate(180deg)" : "rotate(0)", transition: "transform .2s" }}><polyline points="6 9 12 15 18 9"/></svg>
                          </div>
                        </div>
                        {expandedBatchOrder === o.id && (
                          <div className="py-3 px-4 pb-4 pl-[52px]" style={{ borderBottom: `1px solid ${dark ? "rgba(255,255,255,.08)" : "rgba(0,0,0,.08)"}`, background: dark ? "rgba(196,125,142,.08)" : "rgba(196,125,142,.06)", borderTop: `2px solid ${dark ? "rgba(196,125,142,.28)" : "rgba(196,125,142,.24)"}`, borderLeft: `3px solid ${t.accent}` }}>
                            <div className="adm-detail-grid grid gap-3 mb-3 text-[13px]">
                              <div><span style={{ color: t.textMuted }}>User:</span> <span style={{ color: t.text }}>{o.user}</span></div>
                              <div><span style={{ color: t.textMuted }}>Email:</span> <span style={{ color: t.text }}>{o.email}</span></div>
                              <div><span style={{ color: t.textMuted }}>Platform:</span> <span style={{ color: t.text }}>{o.category}</span></div>
                              <div><span style={{ color: t.textMuted }}>Provider:</span> <span style={{ color: t.text, fontWeight: 600 }}>{(o.provider || "mtp").toUpperCase()}</span></div>
                              <div><span style={{ color: t.textMuted }}>Cost:</span> <span style={{ color: t.red }}>{fN(o.cost || 0)}</span></div>
                              <div><span style={{ color: t.textMuted }}>Profit:</span> <span style={{ color: chargeColor(o.status, t) }}>{fN((o.charge || 0) - (o.cost || 0))}</span></div>
                              <div><span style={{ color: t.textMuted }}>Date:</span> <span style={{ color: t.text }}>{o.created ? fD(o.created) : ""}</span></div>
                            </div>
                            {o.link && <div className="text-sm mb-2.5 break-all" style={{ color: t.textMuted }}>Link: <a href={o.link} target="_blank" rel="noopener noreferrer" className="underline underline-offset-[3px]" style={{ color: t.accent }}>{o.link}</a></div>}
                            <div className="flex gap-1.5">
                              <button onClick={() => doAction(o.id, "check")} disabled={actionLoading === o.id} className="adm-btn-sm" style={{ borderColor: t.cardBorder, color: t.textSoft, opacity: actionLoading === o.id ? .5 : 1 }}>{actionLoading === o.id ? "Checking..." : "Check Status"}</button>
                              {o.status !== "Cancelled" && o.status !== "Completed" && <button onClick={async () => { const ok = await confirm({ title: "Cancel Order", message: `Cancel order ${o.id}? This may issue a refund.`, confirmLabel: "Cancel Order", danger: true }); if (ok) doAction(o.id, "cancel"); }} disabled={!!actionLoading} className="adm-btn-sm" style={{ borderColor: dark ? "rgba(252,165,165,.28)" : "rgba(220,38,38,.24)", color: t.red }}>Cancel</button>}
                              {o.status === "Completed" && <button onClick={async () => { const ok = await confirm({ title: "Refill Order", message: `Request a refill for order ${o.id}?`, confirmLabel: "Refill" }); if (ok) doAction(o.id, "refill"); }} disabled={!!actionLoading} className="adm-btn-sm" style={{ borderColor: t.cardBorder, color: t.accent }}>Refill</button>}
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
              <div className="adm-list-row" role="button" tabIndex={0} onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.currentTarget.click(); } }} onClick={() => setExpanded(expanded === o.id ? null : o.id)} style={{ cursor: "pointer" }}>
                <PlatformIcon platform={o.platform} dark={dark} />
                <div className="min-w-0 flex-1">
                  <div className="text-[15px] font-medium" style={{ color: t.text }}>{o.service}{o.tier ? ` · ${o.tier}` : ""}</div>
                  <div className="text-sm mt-0.5" style={{ color: t.textMuted }}>
                    <span className="m">{o.id}</span> · {o.user} · {o.quantity?.toLocaleString() || 0} qty
                  </div>
                </div>
                <div className="text-right flex items-center gap-2.5">
                  <div>
                    <div className="text-sm font-semibold" style={{ color: chargeColor(o.status, t) }}>{fN(o.charge)}</div>
                    <Badge status={o.status} dark={dark} />
                  </div>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={t.textMuted} strokeWidth="2" strokeLinecap="round" style={{ transform: expanded === o.id ? "rotate(180deg)" : "rotate(0)", transition: "transform .2s" }}><polyline points="6 9 12 15 18 9"/></svg>
                </div>
              </div>
              {expanded === o.id && (
                <div className="py-3 px-4 pb-4" style={{ background: dark ? "rgba(255,255,255,.04)" : "rgba(0,0,0,.02)", borderLeft: `3px solid ${t.accent}`, borderTop: `2px solid ${dark ? "rgba(196,125,142,.28)" : "rgba(196,125,142,.24)"}` }}>
                  <div className="adm-detail-grid grid gap-3 mb-3 text-[13px]">
                    <div><span style={{ color: t.textMuted }}>User:</span> <span style={{ color: t.text }}>{o.user}</span></div>
                    <div><span style={{ color: t.textMuted }}>Email:</span> <span style={{ color: t.text }}>{o.email}</span></div>
                    <div><span style={{ color: t.textMuted }}>Platform:</span> <span style={{ color: t.text }}>{o.category}</span></div>
                    <div><span style={{ color: t.textMuted }}>Provider:</span> <span style={{ color: t.text, fontWeight: 600 }}>{(o.provider || "mtp").toUpperCase()}</span></div>
                    <div><span style={{ color: t.textMuted }}>Cost:</span> <span style={{ color: t.red }}>{fN(o.cost || 0)}</span></div>
                    <div><span style={{ color: t.textMuted }}>Profit:</span> <span style={{ color: chargeColor(o.status, t) }}>{fN((o.charge || 0) - (o.cost || 0))}</span></div>
                    <div><span style={{ color: t.textMuted }}>Date:</span> <span style={{ color: t.text }}>{o.created ? fD(o.created) : ""}</span></div>
                  </div>
                  {o.link && <div className="text-sm mb-2.5 break-all" style={{ color: t.textMuted }}>Link: <a href={o.link} target="_blank" rel="noopener noreferrer" className="underline underline-offset-[3px]" style={{ color: t.accent }}>{o.link}</a></div>}
                  <div className="flex gap-1.5">
                    <button onClick={() => doAction(o.id, "check")} disabled={actionLoading === o.id} className="adm-btn-sm" style={{ borderColor: t.cardBorder, color: t.textSoft, opacity: actionLoading === o.id ? .5 : 1 }}>{actionLoading === o.id ? "Checking..." : "Check Status"}</button>
                    {o.status !== "Cancelled" && o.status !== "Completed" && <button onClick={async () => { const ok = await confirm({ title: "Cancel Order", message: `Cancel order ${o.id}? This may issue a refund.`, confirmLabel: "Cancel Order", danger: true }); if (ok) doAction(o.id, "cancel"); }} disabled={!!actionLoading} className="adm-btn-sm" style={{ borderColor: dark ? "rgba(252,165,165,.28)" : "rgba(220,38,38,.24)", color: t.red }}>Cancel</button>}
                    {o.status === "Completed" && <button onClick={async () => { const ok = await confirm({ title: "Refill Order", message: `Request a refill for order ${o.id}?`, confirmLabel: "Refill" }); if (ok) doAction(o.id, "refill"); }} disabled={!!actionLoading} className="adm-btn-sm" style={{ borderColor: t.cardBorder, color: t.accent }}>Refill</button>}
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
                <select value={perPage} onChange={e => { const v = Number(e.target.value); setPerPage(v); setPage(1); try { localStorage.setItem("adm-per-page", String(v)); } catch {} }} className="py-1 px-1.5 rounded-md text-[12px] font-medium cursor-pointer font-[inherit]" style={{ background: dark ? "rgba(255,255,255,.06)" : "rgba(0,0,0,.04)", border: `1px solid ${t.cardBorder}`, color: t.textMuted }}>
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
