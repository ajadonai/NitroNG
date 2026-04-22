'use client';
import { useState, useEffect } from "react";
import { useConfirm } from "./confirm-dialog";
import { useToast } from "./toast";
import { fN, fD } from "../lib/format";


const STATUS_COLORS = {
  Completed: { bg: "rgba(110,231,183,.1)", bgL: "rgba(5,150,105,.06)", text: "#6ee7b7", textL: "#059669" },
  Processing: { bg: "rgba(165,180,252,.1)", bgL: "rgba(79,70,229,.06)", text: "#a5b4fc", textL: "#4f46e5" },
  Pending: { bg: "rgba(252,211,77,.1)", bgL: "rgba(217,119,6,.06)", text: "#fcd34d", textL: "#d97706" },
  Partial: { bg: "rgba(252,165,165,.1)", bgL: "rgba(220,38,38,.06)", text: "#fca5a5", textL: "#dc2626" },
  Cancelled: { bg: "rgba(160,160,160,.1)", bgL: "rgba(100,100,100,.06)", text: "#a3a3a3", textL: "#737373" },
};

function Badge({ status, dark }) {
  const s = STATUS_COLORS[status] || STATUS_COLORS.Cancelled;
  return <span className="text-[13px] py-0.5 px-2 rounded-[5px] font-semibold" style={{ background: dark ? s.bg : s.bgL, color: dark ? s.text : s.textL }}>{status}</span>;
}

export default function AdminOrdersPage({ dark, t }) {
  const confirm = useConfirm();
  const toast = useToast();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState(null);
  const [page, setPage] = useState(1);
  const perPage = 15;

  useEffect(() => {
    fetch("/api/admin/orders").then(r => r.json()).then(d => { setOrders(d.orders || []); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  const filtered = orders.filter(o => {
    if (filter !== "all" && o.status !== filter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (o.id || "").toLowerCase().includes(q) || (o.service || "").toLowerCase().includes(q) || (o.user || "").toLowerCase().includes(q);
    }
    return true;
  });

  const totalPages = Math.ceil(filtered.length / perPage);
  const paged = filtered.slice((page - 1) * perPage, page * perPage);
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

  return (
    <>
      <div className="adm-header">
        <div className="adm-title" style={{ color: t.text }}>Orders</div>
        <div className="adm-subtitle" style={{ color: t.textMuted }}>{orders.length} total orders</div>
        <div className="page-divider" style={{ background: t.cardBorder }} />
      </div>


      {/* Search */}
      <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} placeholder="Search by order ID, service, or user..." className="adm-search" style={{ borderColor: t.cardBorder, background: dark ? "rgba(255,255,255,.03)" : "#fff", color: t.text }} />

      {/* Filters */}
      <div className="adm-filters flex justify-end">
        <select value={filter} onChange={e => { setFilter(e.target.value); setPage(1); }} className="py-[7px] pr-7 pl-2.5 rounded-lg text-[13px] font-medium appearance-none cursor-pointer font-[inherit] bg-no-repeat bg-[position:right_8px_center]" style={{
          backgroundColor: dark ? "rgba(255,255,255,.04)" : "rgba(0,0,0,.03)",
          border: `1px solid ${dark ? "rgba(255,255,255,.08)" : "rgba(0,0,0,.08)"}`,
          color: dark ? "rgba(255,255,255,.7)" : "rgba(0,0,0,.7)",
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='10' height='6' viewBox='0 0 10 6' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1L5 5L9 1' stroke='${dark ? "%23666" : "%23999"}' stroke-width='1.5' stroke-linecap='round'/%3E%3C/svg%3E")`,
        }}>
          {["all", "Completed", "Processing", "Pending", "Partial", "Cancelled"].map(f => (
            <option key={f} value={f}>{f === "all" ? `All (${orders.length})` : `${f} (${counts[f] || 0})`}</option>
          ))}
        </select>
      </div>

      {/* Orders list */}
      <div className="adm-card" style={{ background: dark ? "rgba(255,255,255,.03)" : "rgba(255,255,255,.85)", border: `0.5px solid ${dark ? "rgba(255,255,255,.06)" : "rgba(0,0,0,.06)"}` }}>
        {loading ? (
          <div className="adm-empty">{[1,2,3,4,5].map(i => <div key={i} className={`skel-bone h-[52px] rounded-lg mb-1.5 ${dark ? "skel-dark" : "skel-light"}`} />)}</div>
        ) : paged.length > 0 ? paged.map((o, i) => (
          <div key={o.id}>
            <div className="adm-list-row" role="button" tabIndex={0} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();e.currentTarget.click()}}} onClick={() => setExpanded(expanded === o.id ? null : o.id)} style={{ borderBottom: (i < paged.length - 1 || expanded === o.id) ? `1px solid ${t.cardBorder}` : "none", cursor: "pointer" }}>
              <div className="min-w-0 flex-1">
                <div className="text-[15px] font-medium" style={{ color: t.text }}>{o.service}{o.tier ? ` · ${o.tier}` : ""}</div>
                <div className="text-sm mt-0.5" style={{ color: t.textMuted }}>
                  <span className="m">{o.id}</span> · {o.user} · {o.quantity?.toLocaleString() || 0} qty
                </div>
              </div>
              <div className="text-right flex items-center gap-2.5">
                <div>
                  <div className="text-sm font-semibold" style={{ color: t.green }}>{fN(o.charge)}</div>
                  <Badge status={o.status} dark={dark} />
                </div>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={t.textMuted} strokeWidth="2" strokeLinecap="round" style={{ transform: expanded === o.id ? "rotate(180deg)" : "rotate(0)", transition: "transform .2s" }}><polyline points="6 9 12 15 18 9"/></svg>
              </div>
            </div>
            {expanded === o.id && (
              <div className="py-3 px-4 pb-4" style={{ borderBottom: i < paged.length - 1 ? `1px solid ${t.cardBorder}` : "none", background: dark ? "rgba(255,255,255,.02)" : "rgba(0,0,0,.01)" }}>
                <div className="adm-detail-grid grid gap-3 mb-3 text-[13px]">
                  <div><span style={{ color: t.textMuted }}>User:</span> <span style={{ color: t.text }}>{o.user}</span></div>
                  <div><span style={{ color: t.textMuted }}>Email:</span> <span style={{ color: t.text }}>{o.email}</span></div>
                  <div><span style={{ color: t.textMuted }}>Platform:</span> <span style={{ color: t.text }}>{o.category}</span></div>
                  <div><span style={{ color: t.textMuted }}>Provider:</span> <span style={{ color: t.text, fontWeight: 600 }}>{(o.provider || "mtp").toUpperCase()}</span></div>
                  <div><span style={{ color: t.textMuted }}>Cost:</span> <span style={{ color: t.red }}>{fN(o.cost || 0)}</span></div>
                  <div><span style={{ color: t.textMuted }}>Profit:</span> <span style={{ color: t.green }}>{fN((o.charge || 0) - (o.cost || 0))}</span></div>
                  <div><span style={{ color: t.textMuted }}>Date:</span> <span style={{ color: t.text }}>{o.created ? fD(o.created) : ""}</span></div>
                </div>
                {o.link && <div className="text-sm mb-2.5 break-all" style={{ color: t.textMuted }}>Link: <a href={o.link} target="_blank" rel="noopener noreferrer" className="underline underline-offset-[3px]" style={{ color: t.accent }}>{o.link}</a></div>}
                <div className="flex gap-1.5">
                  <button onClick={() => doAction(o.id, "check")} disabled={actionLoading === o.id} className="adm-btn-sm" style={{ borderColor: t.cardBorder, color: t.textSoft, opacity: actionLoading === o.id ? .5 : 1 }}>{actionLoading === o.id ? "Checking..." : "Check Status"}</button>
                  {o.status !== "Cancelled" && o.status !== "Completed" && <button onClick={async () => { const ok = await confirm({ title: "Cancel Order", message: `Cancel order ${o.id}? This may issue a refund.`, confirmLabel: "Cancel Order", danger: true }); if (ok) doAction(o.id, "cancel"); }} disabled={!!actionLoading} className="adm-btn-sm" style={{ borderColor: dark ? "rgba(252,165,165,.2)" : "rgba(220,38,38,.15)", color: t.red }}>Cancel</button>}
                  {o.status === "Completed" && <button onClick={async () => { const ok = await confirm({ title: "Refill Order", message: `Request a refill for order ${o.id}?`, confirmLabel: "Refill" }); if (ok) doAction(o.id, "refill"); }} disabled={!!actionLoading} className="adm-btn-sm" style={{ borderColor: t.cardBorder, color: t.accent }}>Refill</button>}
                </div>
              </div>
            )}
          </div>
        )) : (
          <div className="py-[60px] px-5 text-center">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke={dark ? "rgba(255,255,255,.15)" : "rgba(0,0,0,.1)"} strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" className="mx-auto mb-4 block"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
            <div className="text-base font-semibold" style={{ color: t.textSoft }}>No orders found</div>
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="adm-pagination">
          <span className="text-sm" style={{ color: t.textMuted }}>{filtered.length} results · Page {page} of {totalPages}</span>
          <div className="flex gap-1">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="adm-btn-sm" style={{ borderColor: t.cardBorder, color: page === 1 ? t.textMuted : t.textSoft, opacity: page === 1 ? .5 : 1 }}>← Prev</button>
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages} className="adm-btn-sm" style={{ borderColor: t.cardBorder, color: page >= totalPages ? t.textMuted : t.textSoft, opacity: page >= totalPages ? .5 : 1 }}>Next →</button>
          </div>
        </div>
      )}
    </>
  );
}
