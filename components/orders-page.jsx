'use client';
import { useState, useEffect, useRef, useCallback } from "react";
import { useConfirm } from "./confirm-dialog";
import { useToast } from "./toast";
import { PlatformIcon } from "./platform-icon";
import { fN, fD } from "../lib/format";
import { DateRangePicker, FilterDropdown } from "./date-range-picker";

function Spinner({ size = 14, color = "currentColor" }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className="animate-spin"><circle cx="12" cy="12" r="10" stroke={color} strokeWidth="3" strokeLinecap="round" opacity=".25" /><path d="M12 2a10 10 0 0 1 10 10" stroke={color} strokeWidth="3" strokeLinecap="round" /></svg>;
}

/* ── Estimate delivery time from speed string + quantity ── */
function estimateTime(speed, qty) {
  if (!speed || !qty) return null;
  const s = speed.trim();
  // Already a time string — return as-is
  if (/^\d+[-–]\d+\s*hrs?$/i.test(s) || /^\d+\s*hrs?$/i.test(s) || /^\d+[-–]\d+\s*hours?$/i.test(s)) return s;
  if (/^\d+\s*min(ute)?s?$/i.test(s) || /^\d+[-–]\d+\s*min/i.test(s)) return s;
  if (/^\d+[-–]\d+\s*days?$/i.test(s) || /^\d+\s*days?$/i.test(s)) return s;
  if (/^\d+\s*months?$/i.test(s) || /^\d+[-–]\d+\s*months?$/i.test(s)) return s;
  if (/^(instant|fast|natural|custom)$/i.test(s)) return s;
  if (/^\d+[-–]\d+\s*hr/i.test(s) || /^0-\d+\s*hr/i.test(s)) return s;
  if (/^\d+hr/i.test(s)) return s;
  // Rate-based: parse "X-YK/day" or "XK/day" patterns
  const rateMatch = s.match(/^(\d+(?:\.\d+)?)\s*[-–]?\s*(\d+(?:\.\d+)?)?\s*(K|M)?\s*\/\s*day$/i);
  if (!rateMatch) return s;
  const mult = (rateMatch[3] || '').toUpperCase() === 'M' ? 1000000 : (rateMatch[3] || '').toUpperCase() === 'K' ? 1000 : 1;
  const lo = parseFloat(rateMatch[1]) * mult;
  const hi = rateMatch[2] ? parseFloat(rateMatch[2]) * mult : lo;
  if (lo <= 0 && hi <= 0) return s;
  const fastHrs = hi > 0 ? (qty / hi) * 24 : 0;
  const slowHrs = lo > 0 ? (qty / lo) * 24 : fastHrs;
  const fmt = (h) => {
    if (h < 1) return `${Math.max(1, Math.round(h * 60))} min`;
    if (h < 48) return `${Math.round(h)} hr${Math.round(h) !== 1 ? 's' : ''}`;
    const d = Math.round(h / 24);
    return `${d} day${d !== 1 ? 's' : ''}`;
  };
  if (Math.abs(fastHrs - slowHrs) < 0.5) return `~${fmt(fastHrs)}`;
  return `${fmt(fastHrs)} – ${fmt(slowHrs)}`;
}

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

function ProgressBar({ order, dark, detailed }) {
  const qty = order.quantity || 0;
  if (!qty || order.status === "Cancelled") return null;
  const hasData = order.remains != null;
  const isComplete = order.status === "Completed";
  const delivered = isComplete ? qty : hasData ? Math.max(0, qty - Math.max(0, order.remains)) : 0;
  const pct = isComplete ? 100 : hasData ? Math.min(100, Math.round((delivered / qty) * 100)) : 0;
  const color = isComplete ? (dark ? "#6ee7b7" : "#059669") : "#c47d8e";
  const waiting = !hasData && !isComplete && (order.status === "Pending" || order.status === "Processing");
  if (detailed) {
    return (
      <div>
        <div className="flex items-center justify-between text-[11px] mb-1" style={{ color: dark ? "rgba(255,255,255,.6)" : "rgba(0,0,0,.45)" }}>
          <span>{waiting ? "Waiting to start" : `${delivered.toLocaleString()} / ${qty.toLocaleString()} delivered`}</span>
          {!waiting && <span style={{ color }}>{pct}%</span>}
        </div>
        <div className="h-1.5 rounded-full overflow-hidden" style={{ background: dark ? "rgba(255,255,255,.14)" : "rgba(0,0,0,.08)" }}>
          {waiting
            ? <div className="h-full w-1/3 rounded-full" style={{ background: `${color}40`, animation: "progress-pulse 1.8s ease-in-out infinite" }} />
            : <div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${pct}%`, background: color }} />}
        </div>
      </div>
    );
  }
  return (
    <div className="w-full h-[3px] rounded-full overflow-hidden" style={{ background: dark ? "rgba(255,255,255,.12)" : "rgba(0,0,0,.06)" }}>
      {waiting
        ? <div className="h-full w-1/4 rounded-full" style={{ background: `${color}40`, animation: "progress-pulse 1.8s ease-in-out infinite" }} />
        : <div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${pct}%`, background: color }} />}
    </div>
  );
}


/* ── Dot menu ── */
function DotMenu({ items, dark, t, loading }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const btnRef = useRef(null);
  const posRef = useRef({ top: 0, right: 0 });
  const filtered = items.filter(Boolean);

  useEffect(() => {
    if (!open) return;
    const close = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const esc = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("pointerdown", close); document.removeEventListener("keydown", esc); };
  }, [open]);

  if (filtered.length === 0) return null;

  const handleOpen = (e) => {
    e.stopPropagation();
    if (loading) return;
    if (!open && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      posRef.current = { top: r.bottom + 4, right: window.innerWidth - r.right };
    }
    setOpen(v => !v);
  };

  return (
    <div ref={ref} className="dot-menu-root">
      <button ref={btnRef} onPointerDown={handleOpen} className="w-9 h-9 max-md:w-10 max-md:h-10 flex items-center justify-center rounded-md border-none cursor-pointer bg-transparent" style={{ color: t.textMuted, opacity: loading ? .5 : 1, touchAction: "none" }} aria-label="Actions">
        {loading ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{ animation: "spin 1s linear infinite" }}><path d="M12 2v4m0 12v4m-7.07-3.93l2.83-2.83m8.48-8.48l2.83-2.83M2 12h4m12 0h4m-3.93 7.07l-2.83-2.83M7.76 7.76L4.93 4.93"/></svg> : <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/></svg>}
      </button>
      {open && (
        <div className="fixed min-w-[160px] rounded-lg overflow-hidden shadow-lg" style={{ top: posRef.current.top, right: posRef.current.right, zIndex: 60, background: dark ? "#1e1e1e" : "#fff", border: `1px solid ${dark ? "rgba(255,255,255,.18)" : "rgba(0,0,0,.18)"}` }}>
          {filtered.map((item, i) => (
            <button key={i} onPointerDown={(e) => { e.stopPropagation(); setOpen(false); item.action(); }} className="w-full text-left py-2.5 px-3.5 text-[13px] font-medium border-none cursor-pointer bg-transparent block" style={{ color: item.danger ? (dark ? "#fca5a5" : "#dc2626") : t.textSoft, borderBottom: i < filtered.length - 1 ? `1px solid ${dark ? "rgba(255,255,255,.16)" : "rgba(0,0,0,.1)"}` : "none", touchAction: "none" }}>{item.label}</button>
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


  return (
    <div>
      {/* Collapsed header */}
      <div role="button" tabIndex={0} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();e.currentTarget.click()}}} onClick={() => onToggle(batch.batchId)} className="flex items-center py-3 px-3.5 desktop:py-3.5 desktop:px-[18px] cursor-pointer gap-3 desktop:gap-4 transition-[background-color] duration-150 hover:bg-[rgba(196,125,142,.06)]" style={{ borderBottom: `1px solid ${t.cardBorder}` }}>
        <div className="shrink-0 flex items-center justify-center rounded-xl" style={{ width: 42, height: 42, background: dark ? "rgba(196,125,142,.12)" : "rgba(196,125,142,.08)", border: `1px solid ${dark ? "rgba(196,125,142,.2)" : "rgba(196,125,142,.15)"}` }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={t.accent} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 002 1.61h9.72a2 2 0 002-1.61L23 6H6"/></svg>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap mb-0.5">
            <span className="m text-[13px] desktop:text-[15px] font-semibold" style={{ color: t.text }}>{batch.batchId}</span>
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
        <div className="text-right shrink-0 flex flex-col items-end gap-1.5">
          <div className="m text-[13px] desktop:text-[15px] font-bold" style={{ color: batch.orders.every(o => o.status === "Cancelled") ? (dark ? "#6ee7b7" : "#059669") : (dark ? "#fca5a5" : "#dc2626") }}>{batch.orders.every(o => o.status === "Cancelled") ? "+" : "-"}{fN(totalCharge)}</div>
          <PlatformStack platforms={platforms} dark={dark} />
        </div>
        <svg className="shrink-0 ml-0.5" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={t.textMuted} strokeWidth="2" strokeLinecap="round" style={{ transform: expanded ? "rotate(180deg)" : "rotate(0)", transition: "transform .2s", }}><polyline points="6 9 12 15 18 9"/></svg>
      </div>

      {/* Expanded body — order list */}
      {expanded && (
        <div style={{ background: dark ? "rgba(255,255,255,.05)" : "rgba(0,0,0,.02)", borderLeft: `3px solid ${accentColor}`, borderTop: `2px solid ${dark ? "rgba(196,125,142,.28)" : "rgba(196,125,142,.24)"}` }}>
          {batch.orders.map((o, i) => (
            <div key={o.id}>
              <div role="button" tabIndex={0} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();e.currentTarget.click()}}} onClick={() => setExpandedOrder(expandedOrder === o.id ? null : o.id)} className="flex items-center py-2.5 px-3 desktop:py-3 desktop:px-4 pl-4 desktop:pl-5 cursor-pointer gap-2.5 desktop:gap-3 transition-[background-color] duration-150 hover:bg-[rgba(196,125,142,.06)]" style={{ borderBottom: `1px solid ${dark ? "rgba(255,255,255,.12)" : "rgba(0,0,0,.08)"}` }}>
                <div className="shrink-0 flex items-center justify-center rounded-lg" style={{ width: 36, height: 36, background: dark ? "rgba(255,255,255,.08)" : "rgba(0,0,0,.03)", border: `1px solid ${dark ? "rgba(255,255,255,.10)" : "rgba(0,0,0,.05)"}` }}>
                  <PlatformIcon platform={o.platform} dark={dark} size={22} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] desktop:text-sm font-semibold overflow-hidden text-ellipsis whitespace-nowrap max-md:whitespace-normal max-md:line-clamp-2 max-md:[display:-webkit-box] max-md:[-webkit-box-orient:vertical]" style={{ color: t.text }}>{o.service}{o.tier ? <span className="font-normal" style={{ color: t.textMuted }}> · {o.tier}</span> : ""}</div>
                  <div className="flex items-center gap-1.5 text-[10px] desktop:text-[11px] mt-0.5" style={{ color: t.textMuted }}>
                    <span className="m" style={o.status === "Cancelled" ? { color: dark ? "#fca5a5" : "#dc2626" } : o.status === "Partial" ? { color: dark ? "#fbbf24" : "#d97706" } : undefined}>{o.id}</span>
                    <span className="w-[3px] h-[3px] rounded-full bg-current opacity-30 shrink-0" />
                    <span>{o.quantity?.toLocaleString() || 0} qty</span>
                  </div>
                </div>
                <div className="text-right shrink-0 flex items-center gap-1.5">
                  {!["Completed", "Cancelled"].includes(o.status) && <span className="inline-block w-[5px] h-[5px] rounded-full shrink-0" style={{ background: sClr(o.status, dark) }} />}
                  <div className="m text-[13px] desktop:text-sm font-bold" style={{ color: o.status === "Cancelled" ? (dark ? "#6ee7b7" : "#059669") : (dark ? "#fca5a5" : "#dc2626") }}>{o.status === "Cancelled" ? "+" : "-"}{fN(o.charge)}</div>
                </div>
                <svg className="shrink-0 ml-0.5" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={t.textMuted} strokeWidth="2" strokeLinecap="round" style={{ transform: expandedOrder === o.id ? "rotate(180deg)" : "rotate(0)", transition: "transform .2s", }}><polyline points="6 9 12 15 18 9"/></svg>
              </div>
              {expandedOrder === o.id && (
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

                    {/* Delivery progress */}
                    {(() => {
                      const qty = o.quantity || 0;
                      const isCancelled = o.status === "Cancelled";
                      const hasData = o.remains != null;
                      const isComplete = o.status === "Completed";
                      const delivered = isCancelled ? 0 : isComplete ? qty : hasData ? Math.max(0, qty - Math.max(0, o.remains)) : 0;
                      const pct = isCancelled ? 0 : isComplete ? 100 : hasData ? Math.min(100, Math.round((delivered / qty) * 100)) : 0;
                      const barColor = isCancelled ? (dark ? "#666" : "#999") : isComplete ? (dark ? "#6ee7b7" : "#059669") : "#c47d8e";
                      const waiting = !isCancelled && !hasData && !isComplete && (o.status === "Pending" || o.status === "Processing");
                      return (
                        <div className="mb-2.5 py-1.5 px-2.5 rounded-lg" style={{ background: dark ? "rgba(255,255,255,.05)" : "rgba(0,0,0,.02)", border: `1px solid ${dark ? "rgba(255,255,255,.08)" : "rgba(0,0,0,.04)"}` }}>
                          <div className="flex items-center justify-between text-[11px] mb-1.5">
                            <span style={{ color: t.textMuted }}>{isCancelled ? "Cancelled" : waiting ? "Waiting to start" : "Delivered"}</span>
                            {!waiting && <span className="m font-semibold" style={{ color: barColor }}>{delivered.toLocaleString()} / {qty.toLocaleString()}{!isCancelled && ` · ${pct}%`}</span>}
                          </div>
                          <div className="h-1.5 rounded-full overflow-hidden" style={{ background: dark ? "rgba(255,255,255,.14)" : "rgba(0,0,0,.08)" }}>
                            {waiting
                              ? <div className="h-full w-1/3 rounded-full" style={{ background: `${barColor}40`, animation: "progress-pulse 1.8s ease-in-out infinite" }} />
                              : <div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${pct}%`, background: barColor }} />}
                          </div>
                        </div>
                      );
                    })()}

                    {/* Info grid */}
                    <div className="grid grid-cols-3 gap-1.5 mb-2.5">
                      <div className="py-1.5 px-2 rounded-lg text-center" style={{ background: dark ? "rgba(255,255,255,.07)" : "rgba(0,0,0,.03)", border: `1px solid ${dark ? "rgba(255,255,255,.12)" : "rgba(0,0,0,.06)"}` }}>
                        <div className="text-[10px] uppercase tracking-[1px] mb-0.5" style={{ color: t.textMuted }}>{o.status === "Cancelled" ? "Refunded" : "Charge"}</div>
                        <div className="m text-[13px] font-semibold" style={{ color: o.status === "Cancelled" ? (dark ? "#6ee7b7" : "#059669") : (dark ? "#fca5a5" : "#dc2626") }}>{o.status === "Cancelled" ? "+" : "-"}{fN(o.charge)}</div>
                      </div>
                      <div className="py-1.5 px-2 rounded-lg text-center" style={{ background: dark ? "rgba(255,255,255,.07)" : "rgba(0,0,0,.03)", border: `1px solid ${dark ? "rgba(255,255,255,.12)" : "rgba(0,0,0,.06)"}` }}>
                        <div className="text-[10px] uppercase tracking-[1px] mb-0.5" style={{ color: t.textMuted }}>Status</div>
                        <Badge status={o.status} dark={dark} />
                      </div>
                      {o.startCount != null ? (
                        <div className="py-1.5 px-2 rounded-lg text-center" style={{ background: dark ? "rgba(255,255,255,.07)" : "rgba(0,0,0,.03)", border: `1px solid ${dark ? "rgba(255,255,255,.12)" : "rgba(0,0,0,.06)"}` }}>
                          <div className="text-[10px] uppercase tracking-[1px] mb-0.5" style={{ color: t.textMuted }}>Start Count</div>
                          <div className="m text-[13px] font-semibold" style={{ color: t.text }}>{o.startCount.toLocaleString()}</div>
                        </div>
                      ) : o.speed && !["Completed", "Cancelled"].includes(o.status) ? (
                        <div className="py-1.5 px-2 rounded-lg text-center" style={{ background: dark ? "rgba(255,255,255,.07)" : "rgba(0,0,0,.03)", border: `1px solid ${dark ? "rgba(255,255,255,.12)" : "rgba(0,0,0,.06)"}` }}>
                          <div className="text-[10px] uppercase tracking-[1px] mb-0.5" style={{ color: t.textMuted }}>Est. Time</div>
                          <div className="m text-[13px] font-semibold" style={{ color: dark ? "#a5b4fc" : "#4f46e5" }}>{estimateTime(o.speed, o.quantity)}</div>
                        </div>
                      ) : (
                        <div className="py-1.5 px-2 rounded-lg text-center" style={{ background: dark ? "rgba(255,255,255,.07)" : "rgba(0,0,0,.03)", border: `1px solid ${dark ? "rgba(255,255,255,.12)" : "rgba(0,0,0,.06)"}` }}>
                          <div className="text-[10px] uppercase tracking-[1px] mb-0.5" style={{ color: t.textMuted }}>Quantity</div>
                          <div className="m text-[13px] font-semibold" style={{ color: t.text }}>{o.quantity?.toLocaleString()}</div>
                        </div>
                      )}
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
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState(null);
  const [expandedBatch, setExpandedBatch] = useState(null);
  const [expandedBatchOrder, setExpandedBatchOrder] = useState(null);
  const [oPage, setOPage] = useState(1);
  const [actionLoading, setActionLoading] = useState(null);
  const [batchActionLoading, setBatchActionLoading] = useState(null);
  const [dateRange, setDateRange] = useState(null);
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
        setOrders(prev => prev.map(o => (o.id === orderId ? { ...o, ...(data.status && { status: data.status }), ...(data.remains != null && { remains: data.remains }), ...(data.startCount != null && { startCount: data.startCount }) } : o)));
        const order = orders.find(o => o.id === orderId);
        const qty = order?.quantity || 0;
        let detail = "";
        if (data.status === "Completed") {
          detail = `Delivered ${qty.toLocaleString()}/${qty.toLocaleString()}`;
        } else if (data.remains != null && qty > 0) {
          const delivered = Math.max(0, qty - Math.max(0, data.remains));
          detail = `${delivered.toLocaleString()}/${qty.toLocaleString()} delivered`;
        } else if (data.startCount != null) {
          detail = "Order started";
        }
        toast.info(data.status, detail || "Waiting to start");
      } else if (action === "cancel") {
        setOrders(prev => prev.map(o => (o.id === orderId ? { ...o, status: "Cancelled" } : o)));
        toast.success("Order cancelled", data.refunded ? `₦${data.refunded.toLocaleString()} refunded to wallet` : "Cancelled successfully");
      } else if (action === "reorder") {
        toast.success(data.queued ? "Reorder queued" : "Reorder placed", data.queued ? "Will start when your current order for this link completes." : (data.order?.id || ""));
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
    if (dateRange) {
      const d = new Date(o.created);
      if (dateRange.start && d < dateRange.start) return false;
      if (dateRange.end) { const endOfDay = new Date(dateRange.end); endOfDay.setHours(23, 59, 59, 999); if (d > endOfDay) return false; }
    }
    return true;
  });
  const grouped = groupOrders(filteredOrders);
  const pagedGroups = grouped.slice((oPage - 1) * perPage, oPage * perPage);

  const counts = { all: orders.length };
  ["Completed", "Processing", "Pending", "Partial", "Cancelled"].forEach(s => { counts[s] = orders.filter(o => o.status === s).length; });

  const autoChecked = useRef(new Set());
  const autoCheck = useCallback((o) => {
    if (!o || !o.apiOrderId || ["Completed", "Cancelled"].includes(o.status) || autoChecked.current.has(o.id) || actionLoading) return;
    autoChecked.current.add(o.id);
    doAction(o.id, "check");
  }, [actionLoading]);

  useEffect(() => {
    if (expanded) { const o = orders.find(x => x.id === expanded); autoCheck(o); }
  }, [expanded]);
  useEffect(() => {
    if (expandedBatchOrder) { const o = orders.find(x => x.id === expandedBatchOrder); autoCheck(o); }
  }, [expandedBatchOrder]);

  return (
    <>
      {/* Header */}
      <div className="pb-2 desktop:pb-3.5">
        <div className="adm-header-row">
          <div>
            <div className="text-lg desktop:text-[22px] font-semibold mb-0.5" style={{ color: t.text }}>History</div>
            <div className="text-sm desktop:text-[15px]" style={{ color: t.textMuted }}>Your order history</div>
          </div>
        </div>
        <div className="page-divider" style={{ background: t.cardBorder }} />
      </div>

      {/* Search + filters */}
        <div className="flex items-center gap-2 desktop:gap-3 mb-2 desktop:mb-3 flex-wrap">
          <div className="relative flex-1 min-w-full desktop:min-w-[200px]">
            <input aria-label="Search orders" placeholder="Search by order ID or service..." value={search} onChange={e => { setSearch(e.target.value); setOPage(1); }} className="w-full py-2 desktop:py-2.5 px-3 desktop:px-3.5 pr-8 rounded-[10px] border text-[13px] desktop:text-sm font-[inherit] outline-none box-border" style={{ borderColor: t.cardBorder, background: dark ? "rgba(255,255,255,.09)" : "#fff", color: t.text }} />
            {search && <button aria-label="Clear search" onClick={() => { setSearch(""); setOPage(1); }} className="absolute right-2.5 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center rounded-full text-xs cursor-pointer border-none" style={{ background: dark ? "rgba(255,255,255,.18)" : "rgba(0,0,0,.14)", color: t.textMuted }}><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>}
          </div>
          <DateRangePicker dark={dark} t={t} value={dateRange} onChange={(v) => { setDateRange(v); setOPage(1); }} />
          <FilterDropdown dark={dark} t={t} value={filter} onChange={(v) => { setFilter(v); setOPage(1); setExpanded(null); }} options={
            ["all", "Completed", "Processing", "Pending", "Partial", "Cancelled"].map(f => ({
              value: f, label: f === "all" ? "All" : f,
            }))
          } />
        </div>

        {/* Order list */}
        <div className="rounded-xl desktop:rounded-[14px] overflow-hidden" style={{ background: dark ? "rgba(255,255,255,.09)" : "rgba(255,255,255,.85)", border: `0.5px solid ${t.cardBorder}` }}>
          {pagedGroups.length > 0 ? pagedGroups.map((item, i) => {
            if (item.type === "batch") {
              return <BatchRow key={item.batchId} batch={item} dark={dark} t={t} expanded={expandedBatch === item.batchId} onToggle={(id) => { setExpandedBatch(expandedBatch === id ? null : id); setExpandedBatchOrder(null); setExpanded(null); }} expandedOrder={expandedBatchOrder} setExpandedOrder={setExpandedBatchOrder} doAction={doAction} actionLoading={actionLoading} doBatchAction={doBatchAction} batchActionLoading={batchActionLoading} confirm={confirm} />;
            }
            const o = item.order;
            return (
              <div key={o.id}>
                <div role="button" tabIndex={0} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();e.currentTarget.click()}}} onClick={() => { setExpanded(expanded === o.id ? null : o.id); setExpandedBatch(null); setExpandedBatchOrder(null); }} className="flex items-center py-3 px-3.5 desktop:py-3.5 desktop:px-[18px] cursor-pointer gap-3 desktop:gap-4 transition-[background-color] duration-150 hover:bg-[rgba(196,125,142,.06)]" style={{ borderBottom: (i < pagedGroups.length - 1 || expanded === o.id) ? `1px solid ${t.cardBorder}` : "none" }}>
                  <div className="shrink-0 flex items-center justify-center rounded-xl" style={{ width: 42, height: 42, background: dark ? "rgba(255,255,255,.09)" : "rgba(0,0,0,.04)", border: `1px solid ${dark ? "rgba(255,255,255,.12)" : "rgba(0,0,0,.06)"}` }}>
                    <PlatformIcon platform={o.platform} dark={dark} size={26} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-[13px] desktop:text-[15px] font-semibold overflow-hidden text-ellipsis whitespace-nowrap desktop:whitespace-nowrap mb-0.5 max-md:whitespace-normal max-md:line-clamp-2 max-md:[display:-webkit-box] max-md:[-webkit-box-orient:vertical]" style={{ color: t.text }}>{o.service}{o.tier ? <span className="font-normal" style={{ color: t.textMuted }}> · {o.tier}</span> : ""}</div>
                    <div className="flex items-center gap-1.5 text-[11px] desktop:text-xs" style={{ color: t.textMuted }}>
                      <span className="m" style={o.status === "Cancelled" ? { color: dark ? "#fca5a5" : "#dc2626" } : o.status === "Partial" ? { color: dark ? "#fbbf24" : "#d97706" } : undefined}>{o.id}</span>
                      <span className="w-[3px] h-[3px] rounded-full bg-current opacity-30 shrink-0" />
                      <span>{o.quantity?.toLocaleString() || 0} qty</span>
                      <span className="w-[3px] h-[3px] rounded-full bg-current opacity-30 shrink-0" />
                      <span>{o.created ? fD(o.created, true) : ""}</span>
                    </div>
                  </div>
                  <div className="text-right shrink-0 flex items-center gap-1.5">
                    {!["Completed", "Cancelled"].includes(o.status) && <span className="inline-block w-[6px] h-[6px] rounded-full shrink-0" style={{ background: sClr(o.status, dark) }} />}
                    <div className="m text-[13px] desktop:text-[15px] font-bold" style={{ color: o.status === "Cancelled" ? (dark ? "#6ee7b7" : "#059669") : (dark ? "#fca5a5" : "#dc2626") }}>{o.status === "Cancelled" ? "+" : "-"}{fN(o.charge)}</div>
                  </div>
                  <svg className="shrink-0 ml-0.5" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={t.textMuted} strokeWidth="2" strokeLinecap="round" style={{ transform: expanded === o.id ? "rotate(180deg)" : "rotate(0)", transition: "transform .2s", }}><polyline points="6 9 12 15 18 9"/></svg>
                </div>

                {/* Expanded details */}
                {expanded === o.id && (
                  <div className="py-3.5 px-3.5 desktop:py-4 desktop:px-[18px]" style={{ background: dark ? "rgba(196,125,142,.05)" : "rgba(196,125,142,.04)", borderTop: `1px solid ${dark ? "rgba(196,125,142,.2)" : "rgba(196,125,142,.15)"}`, borderBottom: `3px solid ${dark ? "rgba(196,125,142,.25)" : "rgba(196,125,142,.2)"}`, borderLeft: `3px solid ${t.accent}` }}>
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

                    {/* Delivery progress */}
                    {(() => {
                      const qty = o.quantity || 0;
                      const isCancelled = o.status === "Cancelled";
                      const hasData = o.remains != null;
                      const isComplete = o.status === "Completed";
                      const delivered = isCancelled ? 0 : isComplete ? qty : hasData ? Math.max(0, qty - Math.max(0, o.remains)) : 0;
                      const pct = isCancelled ? 0 : isComplete ? 100 : hasData ? Math.min(100, Math.round((delivered / qty) * 100)) : 0;
                      const barColor = isCancelled ? (dark ? "#666" : "#999") : isComplete ? (dark ? "#6ee7b7" : "#059669") : "#c47d8e";
                      const waiting = !isCancelled && !hasData && !isComplete && (o.status === "Pending" || o.status === "Processing");
                      return (
                        <div className="mb-3 py-2 px-3 rounded-lg" style={{ background: dark ? "rgba(255,255,255,.05)" : "rgba(0,0,0,.02)", border: `1px solid ${dark ? "rgba(255,255,255,.08)" : "rgba(0,0,0,.04)"}` }}>
                          <div className="flex items-center justify-between text-[12px] mb-1.5">
                            <span style={{ color: t.textMuted }}>{isCancelled ? "Cancelled" : waiting ? "Waiting to start" : "Delivered"}</span>
                            {!waiting && <span className="m font-semibold" style={{ color: barColor }}>{delivered.toLocaleString()} / {qty.toLocaleString()}{!isCancelled && ` · ${pct}%`}</span>}
                          </div>
                          <div className="h-1.5 rounded-full overflow-hidden" style={{ background: dark ? "rgba(255,255,255,.14)" : "rgba(0,0,0,.08)" }}>
                            {waiting
                              ? <div className="h-full w-1/3 rounded-full" style={{ background: `${barColor}40`, animation: "progress-pulse 1.8s ease-in-out infinite" }} />
                              : <div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${pct}%`, background: barColor }} />}
                          </div>
                        </div>
                      );
                    })()}

                    {/* Info grid */}
                    <div className="grid grid-cols-3 gap-2 mb-3">
                      <div className="py-2 px-2.5 rounded-lg text-center" style={{ background: dark ? "rgba(255,255,255,.07)" : "rgba(0,0,0,.03)", border: `1px solid ${dark ? "rgba(255,255,255,.12)" : "rgba(0,0,0,.06)"}` }}>
                        <div className="text-[11px] uppercase tracking-[1px] mb-1" style={{ color: t.textMuted }}>{o.status === "Cancelled" ? "Refunded" : "Charge"}</div>
                        <div className="m text-sm font-semibold" style={{ color: o.status === "Cancelled" ? (dark ? "#6ee7b7" : "#059669") : (dark ? "#fca5a5" : "#dc2626") }}>{o.status === "Cancelled" ? "+" : "-"}{fN(o.charge)}</div>
                      </div>
                      <div className="py-2 px-2.5 rounded-lg text-center" style={{ background: dark ? "rgba(255,255,255,.07)" : "rgba(0,0,0,.03)", border: `1px solid ${dark ? "rgba(255,255,255,.12)" : "rgba(0,0,0,.06)"}` }}>
                        <div className="text-[11px] uppercase tracking-[1px] mb-1" style={{ color: t.textMuted }}>Status</div>
                        <Badge status={o.status} dark={dark} />
                      </div>
                      {o.startCount != null ? (
                        <div className="py-2 px-2.5 rounded-lg text-center" style={{ background: dark ? "rgba(255,255,255,.07)" : "rgba(0,0,0,.03)", border: `1px solid ${dark ? "rgba(255,255,255,.12)" : "rgba(0,0,0,.06)"}` }}>
                          <div className="text-[11px] uppercase tracking-[1px] mb-1" style={{ color: t.textMuted }}>Start Count</div>
                          <div className="m text-sm font-semibold" style={{ color: t.text }}>{o.startCount.toLocaleString()}</div>
                        </div>
                      ) : o.speed && !["Completed", "Cancelled"].includes(o.status) ? (
                        <div className="py-2 px-2.5 rounded-lg text-center" style={{ background: dark ? "rgba(255,255,255,.07)" : "rgba(0,0,0,.03)", border: `1px solid ${dark ? "rgba(255,255,255,.12)" : "rgba(0,0,0,.06)"}` }}>
                          <div className="text-[11px] uppercase tracking-[1px] mb-1" style={{ color: t.textMuted }}>Est. Time</div>
                          <div className="m text-sm font-semibold" style={{ color: dark ? "#a5b4fc" : "#4f46e5" }}>{estimateTime(o.speed, o.quantity)}</div>
                        </div>
                      ) : (
                        <div className="py-2 px-2.5 rounded-lg text-center" style={{ background: dark ? "rgba(255,255,255,.07)" : "rgba(0,0,0,.03)", border: `1px solid ${dark ? "rgba(255,255,255,.12)" : "rgba(0,0,0,.06)"}` }}>
                          <div className="text-[11px] uppercase tracking-[1px] mb-1" style={{ color: t.textMuted }}>Quantity</div>
                          <div className="m text-sm font-semibold" style={{ color: t.text }}>{o.quantity?.toLocaleString()}</div>
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    {(o.status === "Processing" || o.status === "Pending") && (
                      <div className="flex gap-2">
                        <button onClick={() => doAction(o.id, "check")} disabled={actionLoading === o.id} className="m w-[72px] py-2 rounded-lg text-xs desktop:text-[13px] font-semibold cursor-pointer border-none transition-all duration-200 hover:-translate-y-px flex items-center justify-center" style={{ background: dark ? "rgba(96,165,250,.12)" : "rgba(37,99,235,.08)", color: dark ? "#60a5fa" : "#2563eb" }}>{actionLoading === o.id ? <Spinner size={14} color={dark ? "#60a5fa" : "#2563eb"} /> : "Check"}</button>
                        <button onClick={async () => { const ok = await confirm({ title: "Cancel Order", message: `Cancel order ${o.id}? Your wallet will be refunded.`, confirmLabel: "Cancel Order", danger: true }); if (ok) doAction(o.id, "cancel"); }} disabled={actionLoading === o.id} className="m py-2 px-4 rounded-lg text-xs desktop:text-[13px] font-semibold cursor-pointer border-none transition-all duration-200 hover:-translate-y-px" style={{ background: dark ? "rgba(252,165,165,.12)" : "rgba(220,38,38,.08)", color: dark ? "#fca5a5" : "#dc2626" }}>Cancel</button>
                      </div>
                    )}
                    {(o.status === "Completed" || o.status === "Cancelled") && (
                      <div className="flex gap-2">
                        <button onClick={async () => { const ok = await confirm({ title: "Reorder", message: `Reorder ${o.service}? ₦${o.charge?.toLocaleString()} will be charged from your wallet.`, confirmLabel: "Place Reorder" }); if (ok) doAction(o.id, "reorder"); }} disabled={actionLoading === o.id} className="m py-2 px-4 rounded-lg text-xs desktop:text-[13px] font-semibold cursor-pointer border-none transition-all duration-200 hover:-translate-y-px" style={{ background: dark ? "rgba(196,125,142,.15)" : "rgba(196,125,142,.1)", color: t.accent }}>{actionLoading === o.id ? "..." : "Reorder"}</button>
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
              <div className="text-[15px]" style={{ color: t.textMuted }}>Your orders will show up here once you start boosting</div>
            </div>
          )}
        </div>
        <Pagination total={grouped.length} page={oPage} setPage={setOPage} perPage={perPage} setPerPage={setPerPage} t={t} />
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
