'use client';
import { useState, useEffect, useRef, useCallback } from "react";
import { useConfirm } from "./confirm-dialog";
import { useToast } from "./toast";
import { PlatformIcon } from "./platform-icon";
import { fN, fD } from "../lib/format";
import { DateRangePicker, FilterDropdown } from "./date-range-picker";

function CopyId({ value, dark, mono = true }) {
  const [copied, setCopied] = useState(false);
  if (!value) return null;
  return (
    <span
      className="text-sm font-semibold cursor-pointer inline-flex items-center gap-1 transition-opacity hover:opacity-70"
      style={{ color: copied ? (dark ? "#4ade80" : "#16a34a") : (dark ? "#e5e0db" : "#1a1a1a"), fontFamily: mono ? "var(--font-mono, monospace)" : "inherit" }}
      title="Click to copy"
      onClick={e => { e.stopPropagation(); navigator.clipboard.writeText(String(value)); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
    >
      {value}
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: copied ? 1 : 0.4 }}>
        {copied ? <><polyline points="20 6 9 17 4 12"/></> : <><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></>}
      </svg>
    </span>
  );
}

const DRIP_CONFIG = {
  followers:  { batchSize: 500,  intervalHours: 2 },
  views:      { batchSize: 5000, intervalHours: 1 },
  likes:      { batchSize: 500,  intervalHours: 1 },
  comments:   { batchSize: 50,   intervalHours: 0.5 },
  engagement: { batchSize: 1500, intervalHours: 1 },
  reviews:    { batchSize: 10,   intervalHours: 2 },
};

function estimateDelivery(serviceType, quantity, remains) {
  const cfg = DRIP_CONFIG[(serviceType || '').toLowerCase()];
  if (!cfg) return null;
  if (remains != null && remains <= 0) return null;
  const left = remains != null && remains < quantity ? remains : quantity;
  const batches = Math.floor(left / cfg.batchSize);
  if (batches < 2) {
    if (cfg.intervalHours < 1) return `< ${Math.round(cfg.intervalHours * 60)} minutes`;
    return `< ${cfg.intervalHours} ${cfg.intervalHours === 1 ? 'hour' : 'hours'}`;
  }
  const totalHours = (batches - 1) * cfg.intervalHours;
  if (totalHours < 1) return `~${Math.round(totalHours * 60)} minutes`;
  const rounded = Math.round(totalHours);
  if (rounded >= 24) { const d = Math.round(rounded / 24); return `~${d} ${d === 1 ? 'day' : 'days'}`; }
  return `~${rounded} ${rounded === 1 ? 'hour' : 'hours'}`;
}

const LINK_EXAMPLES = {
  instagram: { profile: "instagram.com/username", post: "instagram.com/p/ABC123 or /reel/ABC123" },
  tiktok: { profile: "tiktok.com/@username", post: "tiktok.com/@username/video/123..." },
  twitter: { profile: "x.com/username", post: "x.com/username/status/123..." },
  youtube: { profile: "youtube.com/@channel", post: "youtube.com/watch?v=ABC123" },
  facebook: { profile: "facebook.com/pagename", post: "facebook.com/username/posts/123..." },
  threads: { profile: "threads.net/@username", post: "threads.net/@username/post/ABC123" },
  telegram: { profile: "t.me/channelname", post: "t.me/channelname/123" },
};

function linkHint(platform, serviceName) {
  const ex = LINK_EXAMPLES[platform?.toLowerCase()];
  if (!ex) return "";
  const svc = (serviceName || "").toLowerCase();
  const isProfile = /follow|subscri/i.test(svc);
  const isPost = /view|like|retweet|share|reposts|comment|reaction|vote|save|bookmark|impression|plays/i.test(svc) && !isProfile;
  if (isProfile) return " Make sure you used a profile link, e.g. " + ex.profile;
  if (isPost) return " Make sure you used a post link, e.g. " + ex.post;
  return "";
}

function Spinner({ size = 14, color = "currentColor" }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className="animate-spin"><circle cx="12" cy="12" r="10" stroke={color} strokeWidth="3" strokeLinecap="round" opacity=".25" /><path d="M12 2a10 10 0 0 1 10 10" stroke={color} strokeWidth="3" strokeLinecap="round" /></svg>;
}

/* ── Status helpers (unified) ── */
function sClr(s, dk) { return s === "Completed" ? (dk ? "#6ee7b7" : "#059669") : s === "Processing" ? (dk ? "#a5b4fc" : "#4f46e5") : s === "Pending" ? (dk ? "#fcd34d" : "#d97706") : s === "Partial" ? (dk ? "#fdba74" : "#ea580c") : (s === "Failed" || s === "Rejected") ? (dk ? "#fca5a5" : "#dc2626") : s === "Cancelled" ? (dk ? "#a1a1aa" : "#71717a") : (dk ? "#555250" : "#8a8785"); }
function sBg(s, dk) { return s === "Completed" ? (dk ? "#0a2416" : "#ecfdf5") : s === "Processing" ? (dk ? "#0f1629" : "#eef2ff") : s === "Pending" ? (dk ? "#1c1608" : "#fffbeb") : s === "Partial" ? (dk ? "#1c1008" : "#fff7ed") : (s === "Failed" || s === "Rejected") ? (dk ? "#1f0a0a" : "#fef2f2") : s === "Cancelled" ? (dk ? "#1a1a1a" : "#f5f5f5") : (dk ? "#141414" : "#f5f5f5"); }
function sBrd(s, dk) { return s === "Completed" ? (dk ? "#166534" : "#a7f3d0") : s === "Processing" ? (dk ? "#3730a3" : "#c7d2fe") : s === "Pending" ? (dk ? "#92400e" : "#fde68a") : s === "Partial" ? (dk ? "#9a3412" : "#fed7aa") : (s === "Failed" || s === "Rejected") ? (dk ? "#991b1b" : "#fecaca") : s === "Cancelled" ? (dk ? "#404040" : "#d4d4d4") : (dk ? "#404040" : "#d4d4d4"); }

function isAttention(o) {
  return o.status === "Partial" || (o.lastError && o.status === "Pending" && !o.apiOrderId);
}

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
  return <span className="text-[11px] font-semibold py-0.5 px-1.5 rounded-[5px] border-[0.5px] whitespace-nowrap inline-block leading-tight" style={{ background: sBg(status, dark), color: sClr(status, dark), borderColor: sBrd(status, dark) }}>{status}</span>;
}

function ProgressBar({ order, dark, detailed }) {
  const qty = order.quantity || 0;
  if (!qty || order.status === "Cancelled") return null;
  const hasData = order.remains != null;
  const isComplete = order.status === "Completed";
  const delivered = isComplete ? qty : hasData ? Math.max(0, qty - Math.max(0, order.remains)) : 0;
  const pct = isComplete ? 100 : hasData ? Math.min(100, Math.round((delivered / qty) * 100)) : 0;
  const isPartial = order.status === "Partial";
  const color = isComplete ? (dark ? "#6ee7b7" : "#059669") : isPartial ? (dark ? "#fbbf24" : "#d97706") : "#c47d8e";
  const waiting = !hasData && !isComplete && (order.status === "Pending" || order.status === "Processing");
  const isProcessing = !isComplete && !isPartial && !waiting && pct > 0 && pct < 100;
  if (detailed) {
    return (
      <div>
        <div className="flex items-center justify-between text-[11px] mb-1" style={{ color: dark ? "rgba(255,255,255,.6)" : "rgba(0,0,0,.45)" }}>
          <span>{waiting ? "Waiting to start" : `${delivered.toLocaleString()} / ${qty.toLocaleString()} delivered`}</span>
          {!waiting && <span style={{ color }}>{pct}%</span>}
        </div>
        <div className="h-1.5 rounded-full overflow-hidden" style={{ background: dark ? "rgba(255,255,255,.14)" : "rgba(0,0,0,.08)" }}>
          {waiting
            ? <div className="h-full rounded-full" style={{ background: `repeating-linear-gradient(-55deg, ${dark ? "rgba(255,255,255,.22)" : "rgba(0,0,0,.16)"}, ${dark ? "rgba(255,255,255,.22)" : "rgba(0,0,0,.16)"} 6px, ${dark ? "rgba(255,255,255,.06)" : "rgba(0,0,0,.04)"} 6px, ${dark ? "rgba(255,255,255,.06)" : "rgba(0,0,0,.04)"} 12px)`, backgroundSize: "28px 100%", animation: "progress-stripe .8s linear infinite" }} />
            : <div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${pct}%`, background: color, ...(isProcessing ? { animation: "progress-pulse 2.8s ease-in-out infinite" } : {}) }} />}
        </div>
      </div>
    );
  }
  return (
    <div className="w-full h-1 rounded-full overflow-hidden mt-1.5" style={{ background: dark ? "rgba(255,255,255,.12)" : "rgba(0,0,0,.06)" }}>
      {waiting
        ? <div className="h-full rounded-full" style={{ background: `repeating-linear-gradient(-55deg, ${dark ? "rgba(255,255,255,.22)" : "rgba(0,0,0,.16)"}, ${dark ? "rgba(255,255,255,.22)" : "rgba(0,0,0,.16)"} 6px, ${dark ? "rgba(255,255,255,.06)" : "rgba(0,0,0,.04)"} 6px, ${dark ? "rgba(255,255,255,.06)" : "rgba(0,0,0,.04)"} 12px)`, backgroundSize: "28px 100%", animation: "progress-stripe .8s linear infinite" }} />
        : <div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${pct}%`, background: color, ...(isProcessing ? { animation: "progress-pulse 2.8s ease-in-out infinite" } : {}) }} />}
    </div>
  );
}


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


/* ── Shared expanded order details ── */
function ExpandedOrderDetails({ o, dark, t, doAction, actionLoading, confirm, compact, toast, onNavigate, waNum }) {
  const qty = o.quantity || 0;
  const isCancelled = o.status === "Cancelled";
  const hasData = o.remains != null;
  const isComplete = o.status === "Completed";
  const delivered = isCancelled ? 0 : isComplete ? qty : hasData ? Math.max(0, qty - Math.max(0, o.remains)) : 0;
  const pct = isCancelled ? 0 : isComplete ? 100 : hasData ? Math.min(100, Math.round((delivered / qty) * 100)) : 0;
  const isPartial = o.status === "Partial";
  const barColor = isCancelled ? (dark ? "#666" : "#999") : isComplete ? (dark ? "#6ee7b7" : "#059669") : isPartial ? (dark ? "#fbbf24" : "#d97706") : "#c47d8e";
  const waiting = !isCancelled && !hasData && !isComplete && (o.status === "Pending" || o.status === "Processing");
  const py = compact ? "py-3 px-3 desktop:py-3.5 desktop:px-4" : "py-3.5 px-3.5 desktop:py-4 desktop:px-[18px]";
  const waMessage = encodeURIComponent(`Hi *Nitro*, I need help with my order:\n\n*Order:* ${o.id}\n*Service:* ${o.service}${o.tier ? ' (' + o.tier + ')' : ''}\n*Quantity:* ${qty.toLocaleString()}\n*Delivered:* ${delivered.toLocaleString()} / ${qty.toLocaleString()}\n*Status:* ${o.status}\n*Date:* ${fD(o.created, true)}`);
  const reportIssueButton = waNum ? (
    <a href={`https://wa.me/${waNum}?text=${waMessage}`} target="_blank" rel="noopener noreferrer" className="m py-2 px-4 rounded-lg text-xs desktop:text-[13px] font-semibold cursor-pointer border-none transition-all duration-200 hover:-translate-y-px flex items-center gap-1.5 no-underline" style={{ background: dark ? "rgba(37,211,102,.1)" : "rgba(37,211,102,.06)", color: dark ? "#6ee7b7" : "#16a34a" }}>
      <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
      Get Help
    </a>
  ) : null;


  return (
    <div className={py} style={{ background: dark ? "rgba(196,125,142,.05)" : "rgba(196,125,142,.04)", borderTop: `1px solid ${dark ? "rgba(196,125,142,.2)" : "rgba(196,125,142,.15)"}`, borderBottom: `3px solid ${dark ? "rgba(196,125,142,.25)" : "rgba(196,125,142,.2)"}`, borderLeft: `3px solid ${t.accent}` }}>
      {/* Link */}
      {o.link && (
        <div className="mb-3 py-2 px-2.5 rounded-lg flex items-center gap-2 min-w-0 max-w-full overflow-hidden" style={{ background: dark ? "rgba(255,255,255,.05)" : "rgba(0,0,0,.025)", border: `1px solid ${dark ? "rgba(255,255,255,.1)" : "rgba(0,0,0,.06)"}` }}>
          <div className="w-6 h-6 rounded-md flex items-center justify-center shrink-0" style={{ background: dark ? "rgba(255,255,255,.08)" : "rgba(0,0,0,.04)", color: t.textMuted }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/></svg>
          </div>
          <a href={o.link} target="_blank" rel="noopener noreferrer" title={o.link} className="m min-w-0 flex-1 text-[12px] desktop:text-[13px] leading-[1.45] overflow-hidden text-ellipsis whitespace-nowrap no-underline" style={{ color: t.textSoft }}>{o.link}</a>
        </div>
      )}

      {/* Delivery progress */}
      {(() => {
        const estTime = estimateDelivery(o.serviceType, qty, o.remains);
        const isActive = !isCancelled && !isComplete && o.status !== "Partial";
        const isProcessing = isActive && !waiting && pct > 0 && pct < 100;
        return (
          <div className="mb-3 py-2 px-3 rounded-lg" style={{ background: dark ? "rgba(255,255,255,.05)" : "rgba(0,0,0,.02)", border: `1px solid ${dark ? "rgba(255,255,255,.08)" : "rgba(0,0,0,.04)"}` }}>
            <div className="flex items-center justify-between text-[12px] mb-1.5">
              <span style={{ color: t.textMuted }}>{isCancelled ? "Cancelled" : waiting ? "Waiting to start" : "Delivered"}</span>
              {!waiting && <span className="m font-semibold" style={{ color: barColor }}>{delivered.toLocaleString()} / {qty.toLocaleString()}</span>}
            </div>
            <div className="h-1.5 rounded-full overflow-hidden" style={{ background: dark ? "rgba(255,255,255,.14)" : "rgba(0,0,0,.08)" }}>
              {waiting
                ? <div className="h-full rounded-full" style={{ background: `repeating-linear-gradient(-55deg, ${dark ? "rgba(255,255,255,.22)" : "rgba(0,0,0,.16)"}, ${dark ? "rgba(255,255,255,.22)" : "rgba(0,0,0,.16)"} 6px, ${dark ? "rgba(255,255,255,.06)" : "rgba(0,0,0,.04)"} 6px, ${dark ? "rgba(255,255,255,.06)" : "rgba(0,0,0,.04)"} 12px)`, backgroundSize: "28px 100%", animation: "progress-stripe .8s linear infinite" }} />
                : <div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${pct}%`, background: barColor, ...(isProcessing ? { animation: "progress-pulse 2.8s ease-in-out infinite" } : {}) }} />}
            </div>
            {isActive && estTime && (
              <div className="flex items-center gap-1.5 mt-2.5 py-1.5 px-2.5 rounded-md w-fit" style={{ background: dark ? "rgba(196,125,142,.1)" : "rgba(196,125,142,.07)", border: `1px solid ${dark ? "rgba(196,125,142,.18)" : "rgba(196,125,142,.12)"}` }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={t.accent} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                <span className="text-[11px] desktop:text-[12px] font-medium" style={{ color: dark ? "rgba(196,125,142,.85)" : "rgba(160,80,100,.75)" }}>Est. {estTime}</span>
              </div>
            )}
          </div>
        );
      })()}

      {/* Completed info banner */}
      {o.status === "Completed" && (
        <div className="mb-3 py-2.5 px-3 rounded-lg flex items-start gap-2.5" style={{ background: dark ? "rgba(34,197,94,.08)" : "rgba(34,197,94,.04)", border: `1px solid ${dark ? "rgba(34,197,94,.18)" : "rgba(34,197,94,.12)"}` }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={dark ? "#6ee7b7" : "#059669"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 mt-0.5"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
          <div>
            <div className="text-[13px] font-semibold mb-0.5" style={{ color: dark ? "#6ee7b7" : "#059669" }}>Your order is complete!</div>
            <div className="text-[12px] leading-[1.55]" style={{ color: dark ? "#a09b95" : "#555250" }}>If you notice a small dip in the next few days, don't worry — platforms routinely clean up inactive accounts and it's completely normal. <strong style={{ color: dark ? "#e5e0db" : "#1a1a1a" }}>Services with refill will top you back up automatically.</strong></div>
          </div>
        </div>
      )}

      {/* Partial info banner */}
      {o.status === "Partial" && (
        <div className="mb-3 py-2.5 px-3 rounded-lg flex items-start gap-2.5" style={{ background: dark ? "rgba(245,158,11,.08)" : "rgba(245,158,11,.04)", border: `1px solid ${dark ? "rgba(245,158,11,.18)" : "rgba(245,158,11,.12)"}` }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={dark ? "#fbbf24" : "#d97706"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 mt-0.5"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
          <div>
            <div className="text-[13px] font-semibold mb-0.5" style={{ color: dark ? "#fbbf24" : "#d97706" }}>Partial delivery</div>
            <div className="text-[12px] leading-[1.55]" style={{ color: dark ? "#a09b95" : "#555250" }}>Part of your order has been delivered and the rest has been refunded to your wallet. This usually happens when a provider runs out of capacity mid-delivery — it's not an error. You can use the refunded balance to place a new order anytime.</div>
          </div>
        </div>
      )}

      {/* Issue notice */}
      {o.lastError && o.status === "Pending" && !o.apiOrderId && (
        <div className="mb-3 py-2 px-3 rounded-lg flex items-start gap-2" style={{ background: dark ? "rgba(251,191,36,.08)" : "rgba(217,119,6,.05)", border: `1px solid ${dark ? "rgba(251,191,36,.18)" : "rgba(217,119,6,.14)"}` }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={dark ? "#fbbf24" : "#d97706"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 mt-0.5"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
          <div className="text-[12px]" style={{ color: dark ? "#fbbf24" : "#d97706" }}>
            {/duplicate/i.test(o.lastError) ? "A similar order is already active for this link. This order will start automatically once the other completes."
              : /balance|fund/i.test(o.lastError) ? "Temporarily delayed — our team has been notified and this will be resolved shortly."
              : /incorrect service|invalid service|service replaced/i.test(o.lastError) ? "This service is temporarily unavailable. You'll be refunded if it can't be fulfilled."
              : o.lastError === "wrong_service_type" ? "The link type didn't match this service. You'll be refunded if it can't be fulfilled."
              : o.lastError === "missing_comments" ? "This service needs custom comments. You'll be refunded if it can't be fulfilled."
              : /link|url|wrong_platform|needs_post|needs_profile/i.test(o.lastError) ? "There's an issue with the link for this order. You'll be refunded if it can't be fulfilled."
              : /quantity.*less|minim/i.test(o.lastError) ? "The quantity couldn't be processed. Please contact support if this persists."
              : /timeout|timed.?out/i.test(o.lastError) ? "There was a temporary connection issue. Your order will be retried automatically."
              : "Your order hit a temporary issue and will be retried automatically. Contact support if it stays pending."}
          </div>
        </div>
      )}

      {/* Cancellation reason */}
      {(o.status === "Cancelled" || o.status === "Failed" || o.status === "Rejected") && (() => {
        const err = o.lastError || "";
        let msg, guide = false, isNeutral = false;
        if (err === "user_cancelled") {
          msg = "You cancelled this order and your balance has been restored.";
          isNeutral = true;
        } else if (err === "admin_cancelled") {
          msg = "Our team cancelled this order and refunded your wallet. Reach out to support if you have questions.";
          isNeutral = true;
        } else if (err === "dispatch_failed") {
          msg = "We couldn't place this order so we refunded you automatically.";
        } else if (err === "needs_post_link") {
          msg = "This service needs a link to a specific post or video, not your profile. Try again with the right link!";
          guide = true;
        } else if (err === "needs_profile_link") {
          msg = "This service needs your profile link, not a post or video. Try again with your profile URL!";
          guide = true;
        } else if (err === "wrong_platform_link") {
          msg = "Looks like the link is from a different platform. Make sure you're copying from the right app.";
          guide = true;
        } else if (err === "wrong_service_type") {
          msg = "The link type didn't match this service — for example, a followers service needs a profile link, not a post. Try again with the right link!";
          guide = true;
        } else if (err === "missing_comments") {
          msg = "This service needs custom comments but none were included. Try placing the order again with your comments.";
        } else if (/duplicate/i.test(err)) {
          msg = "There was already an active order for this link, so this one was skipped.";
        } else if (/incorrect service|invalid service|service replaced/i.test(err)) {
          msg = "This service was temporarily unavailable. You've been refunded.";
        } else if (/quantity.*less|minim/i.test(err)) {
          msg = "The quantity was below the minimum for this service.";
        } else if (/link|url/i.test(err)) {
          msg = "Something about this link didn't work. Make sure you're copying the right type of link.";
          guide = true;
        } else if (/timeout|timed.?out/i.test(err)) {
          msg = "There was a connection issue and the order couldn't go through. You've been refunded.";
        } else if (/balance|fund/i.test(err)) {
          msg = "This got held up on our end, but you've been refunded. Try placing it again.";
        } else {
          msg = "This order didn't go through and you've been refunded. If this keeps happening, double-check your link or reach out to support.";
          guide = true;
        }
        const bg = isNeutral ? (dark ? "rgba(161,161,170,.06)" : "rgba(113,113,122,.04)") : (dark ? "rgba(252,165,165,.06)" : "rgba(220,38,38,.04)");
        const brd = isNeutral ? (dark ? "rgba(161,161,170,.15)" : "rgba(113,113,122,.1)") : (dark ? "rgba(252,165,165,.15)" : "rgba(220,38,38,.1)");
        const clr = isNeutral ? (dark ? "#a1a1aa" : "#71717a") : (dark ? "#fca5a5" : "#dc2626");
        return (
        <div className="mb-3 py-2 px-3 rounded-lg flex items-start gap-2" style={{ background: bg, border: `1px solid ${brd}` }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={clr} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 mt-0.5">{isNeutral ? <><circle cx="12" cy="12" r="10"/><path d="M9 12l2 2 4-4"/></> : <><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></>}</svg>
          <div className="text-[12px]" style={{ color: clr }}>
            {msg}{guide && <>{" "}<a href="/blog/how-to-find-the-right-link" target="_blank" style={{ color: clr, textDecoration: "underline", fontWeight: 600 }}>Learn more</a></>}
          </div>
        </div>);
      })()}

      {/* Info grid */}
      <div className="grid grid-cols-2 desktop:grid-cols-4 gap-2 mb-3">
        <div className="py-2 px-2.5 rounded-lg text-center" style={{ background: dark ? "rgba(255,255,255,.07)" : "rgba(0,0,0,.03)", border: `1px solid ${dark ? "rgba(255,255,255,.12)" : "rgba(0,0,0,.06)"}` }}>
          <div className="text-[11px] uppercase tracking-[1px] mb-1" style={{ color: t.textMuted }}>Order No</div>
          <CopyId value={o.id} dark={dark} />
        </div>
        <div className="py-2 px-2.5 rounded-lg text-center" style={{ background: dark ? "rgba(255,255,255,.07)" : "rgba(0,0,0,.03)", border: `1px solid ${dark ? "rgba(255,255,255,.12)" : "rgba(0,0,0,.06)"}` }}>
          <div className="text-[11px] uppercase tracking-[1px] mb-1" style={{ color: t.textMuted }}>Status</div>
          <Badge status={o.status} dark={dark} />
        </div>
        <div className="py-2 px-2.5 rounded-lg text-center" style={{ background: dark ? "rgba(255,255,255,.07)" : "rgba(0,0,0,.03)", border: `1px solid ${dark ? "rgba(255,255,255,.12)" : "rgba(0,0,0,.06)"}` }}>
          <div className="text-[11px] uppercase tracking-[1px] mb-1" style={{ color: t.textMuted }}>{o.status === "Cancelled" ? "Refunded" : "Charge"}</div>
          <div className="m text-sm font-semibold" style={{ color: o.status === "Cancelled" ? (dark ? "#6ee7b7" : "#059669") : (dark ? "#fca5a5" : "#dc2626") }}>{o.status === "Cancelled" ? "+" : "-"}{fN(o.charge)}</div>
        </div>
        <div className="py-2 px-2.5 rounded-lg text-center" style={{ background: dark ? "rgba(255,255,255,.07)" : "rgba(0,0,0,.03)", border: `1px solid ${dark ? "rgba(255,255,255,.12)" : "rgba(0,0,0,.06)"}` }}>
          <div className="text-[11px] uppercase tracking-[1px] mb-1" style={{ color: t.textMuted }}>Start Count</div>
          <div className="m text-sm font-semibold" style={{ color: o.startCount != null ? t.text : t.textMuted }}>{o.startCount != null ? o.startCount.toLocaleString() : "—"}</div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2 flex-wrap">
        {(o.status === "Processing" || o.status === "Pending") && (
          <>
            <button onClick={() => doAction(o.id, "check")} disabled={actionLoading === o.id} className="m w-[72px] py-2 rounded-lg text-xs desktop:text-[13px] font-semibold cursor-pointer border-none transition-all duration-200 hover:-translate-y-px flex items-center justify-center" style={{ background: dark ? "rgba(96,165,250,.12)" : "rgba(37,99,235,.08)", color: dark ? "#60a5fa" : "#2563eb" }}>{actionLoading === o.id ? <Spinner size={14} color={dark ? "#60a5fa" : "#2563eb"} /> : "Check"}</button>
            {!o.apiOrderId && <button onClick={async () => { const ok = await confirm({ title: "Cancel Order", message: `Cancel order ${o.id}? Your wallet will be refunded.`, confirmLabel: "Cancel Order", danger: true }); if (ok) doAction(o.id, "cancel"); }} disabled={actionLoading === o.id} className="m py-2 px-4 rounded-lg text-xs desktop:text-[13px] font-semibold cursor-pointer border-none transition-all duration-200 hover:-translate-y-px" style={{ background: dark ? "rgba(252,165,165,.12)" : "rgba(220,38,38,.08)", color: dark ? "#fca5a5" : "#dc2626" }}>Cancel</button>}
          </>
        )}
        {(o.status === "Completed" || o.status === "Cancelled") && (
          <button onClick={async () => { const ok = await confirm({ title: "Reorder", message: `Reorder ${o.service}? ₦${o.charge?.toLocaleString()} will be charged from your wallet.`, confirmLabel: "Place Reorder" }); if (ok) doAction(o.id, "reorder"); }} disabled={actionLoading === o.id} className="m py-2 px-4 rounded-lg text-xs desktop:text-[13px] font-semibold cursor-pointer border-none transition-all duration-200 hover:-translate-y-px" style={{ background: dark ? "rgba(196,125,142,.15)" : "rgba(196,125,142,.1)", color: t.accent }}>{actionLoading === o.id ? "..." : "Reorder"}</button>
        )}
        {reportIssueButton}
      </div>
    </div>
  );
}


/* ── Batch row ── */
function BatchRow({ batch, dark, t, expanded, onToggle, expandedOrder, setExpandedOrder, doAction, actionLoading, doBatchAction, batchActionLoading, confirm, toast, onNavigate }) {
  const hasAttentionOrders = batch.orders.some(isAttention);
  const totalCharge = batch.orders.reduce((s, o) => s + (o.charge || 0), 0);
  const isLoading = batchActionLoading === batch.batchId;
  const accentColor = hasAttentionOrders ? (dark ? "#fcd34d" : "#d97706") : t.accent;

  const hasActive = batch.orders.some(o => o.status === "Processing" || o.status === "Pending");
  const hasCancellable = batch.orders.some(o => (o.status === "Processing" || o.status === "Pending") && !o.apiOrderId);
  const hasReorderable = batch.orders.some(o => o.status === "Completed" || o.status === "Cancelled");

  const batchSt = batch.orders.every(o => o.status === "Completed") ? "Completed"
    : batch.orders.every(o => o.status === "Cancelled") ? "Cancelled"
    : batch.orders.some(o => ["Pending", "Processing", "In progress"].includes(o.status)) ? "Processing"
    : "Partial";

  return (
    <div>
      {/* Collapsed header */}
      <div role="button" tabIndex={0} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();e.currentTarget.click()}}} onClick={() => onToggle(batch.batchId)} className="flex items-center py-3 px-3.5 desktop:py-3.5 desktop:px-[18px] cursor-pointer gap-3 desktop:gap-4 transition-[background-color] duration-150 hover:bg-[rgba(196,125,142,.06)]" style={{ borderBottom: `1px solid ${t.cardBorder}`, ...(hasAttentionOrders && { borderLeft: `3px solid ${dark ? "#fbbf24" : "#d97706"}` }) }}>
        <div className="shrink-0 flex items-center justify-center rounded-xl" style={{ width: 42, height: 42, background: dark ? "rgba(196,125,142,.12)" : "rgba(196,125,142,.08)", border: `1px solid ${dark ? "rgba(196,125,142,.2)" : "rgba(196,125,142,.15)"}` }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={t.accent} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 002 1.61h9.72a2 2 0 002-1.61L23 6H6"/></svg>
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[13px] desktop:text-[15px] font-semibold overflow-hidden text-ellipsis whitespace-nowrap" style={{ color: t.text }}>{batch.batchId}</div>
          <div className="text-[11px] desktop:text-xs font-medium mt-0.5" style={{ color: t.accent }}>{batch.orders.length} order{batch.orders.length !== 1 ? "s" : ""}</div>
          {batch.created && <div className="text-[10px] desktop:text-[11px] mt-0.5" style={{ color: t.textMuted }}>{fD(batch.created, true)}</div>}
        </div>
        <div className="text-right shrink-0 flex items-center gap-1.5">
          {(batchSt === "Processing") && <span className="w-2 h-2 rounded-full shrink-0 animate-pulse" style={{ background: sClr("Processing", dark) }} />}
          <Badge status={batchSt} dark={dark} />
        </div>
        <svg className="shrink-0 ml-0.5" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={t.textMuted} strokeWidth="2" strokeLinecap="round" style={{ transform: expanded ? "rotate(180deg)" : "rotate(0)", transition: "transform .2s", }}><polyline points="6 9 12 15 18 9"/></svg>
      </div>

      {/* Expanded body */}
      {expanded && (
        <div style={{ background: dark ? "rgba(255,255,255,.05)" : "rgba(0,0,0,.02)", borderLeft: `3px solid ${accentColor}`, borderTop: `2px solid ${dark ? "rgba(196,125,142,.28)" : "rgba(196,125,142,.24)"}` }}>
          {/* Batch action bar */}
          <div className="flex items-center gap-2 py-2.5 px-4 desktop:px-5 flex-wrap" style={{ borderBottom: `1px solid ${dark ? "rgba(255,255,255,.12)" : "rgba(0,0,0,.08)"}` }}>
            <span className="text-[11px] uppercase tracking-[1px] font-medium mr-auto" style={{ color: t.textMuted }}>Batch actions</span>
            {hasActive && (
              <button onClick={() => doBatchAction(batch.batchId, "check")} disabled={isLoading} className="m py-1.5 px-3 rounded-md text-[11px] desktop:text-xs font-semibold cursor-pointer border-none flex items-center gap-1.5" style={{ background: dark ? "rgba(96,165,250,.12)" : "rgba(37,99,235,.08)", color: dark ? "#60a5fa" : "#2563eb", opacity: isLoading ? .5 : 1 }}>
                {isLoading ? <Spinner size={12} color={dark ? "#60a5fa" : "#2563eb"} /> : "Check all"}
              </button>
            )}
            {hasCancellable && (
              <button onClick={async () => { const ok = await confirm({ title: "Cancel Batch", message: `Cancel all pending orders in ${batch.batchId} that haven't been sent to providers yet? Your wallet will be refunded.`, confirmLabel: "Cancel All", danger: true }); if (ok) doBatchAction(batch.batchId, "cancel"); }} disabled={isLoading} className="m py-1.5 px-3 rounded-md text-[11px] desktop:text-xs font-semibold cursor-pointer border-none" style={{ background: dark ? "rgba(252,165,165,.12)" : "rgba(220,38,38,.08)", color: dark ? "#fca5a5" : "#dc2626", opacity: isLoading ? .5 : 1 }}>Cancel all</button>
            )}
            {hasReorderable && (
              <button onClick={async () => { const ok = await confirm({ title: "Reorder Batch", message: `Reorder all completed/cancelled orders from ${batch.batchId}?`, confirmLabel: "Reorder All" }); if (ok) doBatchAction(batch.batchId, "reorder_completed"); }} disabled={isLoading} className="m py-1.5 px-3 rounded-md text-[11px] desktop:text-xs font-semibold cursor-pointer border-none" style={{ background: dark ? "rgba(196,125,142,.15)" : "rgba(196,125,142,.1)", color: t.accent, opacity: isLoading ? .5 : 1 }}>Reorder all</button>
            )}
          </div>

          {/* Child orders */}
          {batch.orders.map((o) => (
            <div key={o.id}>
              <div role="button" tabIndex={0} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();e.currentTarget.click()}}} onClick={() => setExpandedOrder(expandedOrder === o.id ? null : o.id)} className="flex items-center py-2.5 px-3 desktop:py-3 desktop:px-4 pl-4 desktop:pl-5 cursor-pointer gap-2.5 desktop:gap-3 transition-[background-color] duration-150 hover:bg-[rgba(196,125,142,.06)]" style={{ borderBottom: `1px solid ${dark ? "rgba(255,255,255,.12)" : "rgba(0,0,0,.08)"}`, ...(isAttention(o) && { borderLeft: `3px solid ${dark ? "#fbbf24" : "#d97706"}` }) }}>
                <div className="shrink-0 flex items-center justify-center rounded-lg" style={{ width: 36, height: 36, background: dark ? "rgba(255,255,255,.08)" : "rgba(0,0,0,.03)", border: `1px solid ${dark ? "rgba(255,255,255,.10)" : "rgba(0,0,0,.05)"}` }}>
                  <PlatformIcon platform={o.platform} dark={dark} size={22} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] desktop:text-sm font-semibold overflow-hidden text-ellipsis whitespace-nowrap max-md:whitespace-normal max-md:line-clamp-2 max-md:[display:-webkit-box] max-md:[-webkit-box-orient:vertical]" style={{ color: t.text }}>{o.service}</div>
                  {o.tier && <div className="text-[10px] desktop:text-[11px] font-medium mt-0.5" style={{ color: t.accent }}>{o.tier}</div>}
                  {o.created && <div className="text-[10px] desktop:text-[11px] mt-0.5" style={{ color: t.textMuted }}>{fD(o.created, true)}</div>}
                  {expandedOrder !== o.id && <ProgressBar order={o} dark={dark} />}
                </div>
                <div className="text-right shrink-0">
                  <Badge status={o.status} dark={dark} />
                </div>
                <svg className="shrink-0 ml-0.5" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={t.textMuted} strokeWidth="2" strokeLinecap="round" style={{ transform: expandedOrder === o.id ? "rotate(180deg)" : "rotate(0)", transition: "transform .2s", }}><polyline points="6 9 12 15 18 9"/></svg>
              </div>
              {expandedOrder === o.id && <ExpandedOrderDetails o={o} dark={dark} t={t} doAction={doAction} actionLoading={actionLoading} confirm={confirm} toast={toast} onNavigate={onNavigate} waNum={waNum} compact />}
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
export default function OrdersPage({ orders: initialOrders, txs, dark, t, onNavigate, waNum }) {
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

  const fetchOrders = useCallback(async (q) => {
    try {
      const params = q ? `?search=${encodeURIComponent(q)}` : '';
      const res = await fetch(`/api/orders${params}`);
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

  const [perPage, setPerPage] = useState(25);
  useEffect(() => {
    try { const saved = localStorage.getItem("nitro-per-page"); if (saved) setPerPage(Number(saved)); } catch {}
  }, []);

  const searchTimer = useRef(null);
  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => fetchOrders(search), search ? 350 : 0);
    return () => clearTimeout(searchTimer.current);
  }, [search, fetchOrders]);

  const filteredOrders = orders.filter(o => {
    if (filter === "active" && o.status !== "Processing" && o.status !== "Pending") return false;
    if (filter === "attention" && !isAttention(o)) return false;
    if (filter !== "all" && filter !== "active" && filter !== "attention" && o.status !== filter) return false;
    if (dateRange) {
      const d = new Date(o.created);
      if (dateRange.start && d < dateRange.start) return false;
      if (dateRange.end) { const endOfDay = new Date(dateRange.end); endOfDay.setHours(23, 59, 59, 999); if (d > endOfDay) return false; }
    }
    return true;
  });
  const grouped = groupOrders(filteredOrders);
  const pagedGroups = grouped.slice((oPage - 1) * perPage, oPage * perPage);

  const autoChecked = useRef(new Set());
  const autoCheck = useCallback((o) => {
    if (!o || !o.apiOrderId || ["Completed", "Cancelled", "Partial"].includes(o.status) || autoChecked.current.has(o.id) || actionLoading) return;
    autoChecked.current.add(o.id);
    doAction(o.id, "check");
  }, [actionLoading]);

  useEffect(() => {
    if (expanded) { const o = orders.find(x => x.id === expanded); autoCheck(o); }
  }, [expanded]);
  useEffect(() => {
    if (expandedBatchOrder) { const o = orders.find(x => x.id === expandedBatchOrder); autoCheck(o); }
  }, [expandedBatchOrder]);

  const hasFilters = filter !== "all" || search || dateRange;

  return (
    <>
      {/* Header */}
      <div className="pb-2 desktop:pb-3">
        <div className="adm-header-row">
          <div>
            <div className="text-lg desktop:text-[22px] font-semibold mb-0.5" style={{ color: t.text }}>Orders</div>
            <div className="text-sm desktop:text-[15px]" style={{ color: t.textMuted }}>Track delivery, refunds, and reorders</div>
          </div>
        </div>
        <div className="page-divider" style={{ background: t.cardBorder }} />
      </div>

      {/* Search + filters */}
      <div className="flex items-center gap-2 desktop:gap-3 mb-2 desktop:mb-3 flex-nowrap desktop:flex-wrap min-w-0">
        <div className="relative flex-1 min-w-0 desktop:min-w-[200px]">
          <input aria-label="Search orders" placeholder="Search orders..." value={search} onChange={e => { setSearch(e.target.value); setOPage(1); }} className="w-full min-w-0 py-2 desktop:py-2.5 px-3 desktop:px-3.5 pr-8 rounded-[10px] border text-[13px] desktop:text-sm font-[inherit] outline-none box-border" style={{ borderColor: t.cardBorder, background: dark ? "rgba(255,255,255,.09)" : "#fff", color: t.text }} />
          {search && <button aria-label="Clear search" onClick={() => { setSearch(""); setOPage(1); }} className="absolute right-2.5 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center rounded-full text-xs cursor-pointer border-none" style={{ background: dark ? "rgba(255,255,255,.18)" : "rgba(0,0,0,.14)", color: t.textMuted }}><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>}
        </div>
        <DateRangePicker dark={dark} t={t} value={dateRange} onChange={(v) => { setDateRange(v); setOPage(1); }} />
        <FilterDropdown dark={dark} t={t} value={filter} onChange={(v) => { setFilter(v); setOPage(1); setExpanded(null); }} options={
          ["all", "active", "Completed", "Processing", "Pending", "Partial", "attention", "Cancelled"].map(f => ({
            value: f, label: f === "all" ? "All" : f === "active" ? "Active" : f === "attention" ? "Needs attention" : f,
          }))
        } />
      </div>

      {/* Result count */}
      {hasFilters && filteredOrders.length !== orders.length && (
        <div className="text-[12px] desktop:text-[13px] mb-2" style={{ color: t.textMuted }}>
          Showing {filteredOrders.length} of {orders.length} orders
          {hasFilters && <button onClick={() => { setFilter("all"); setSearch(""); setDateRange(null); setOPage(1); }} className="ml-2 underline cursor-pointer bg-transparent border-none font-[inherit] text-[12px] desktop:text-[13px]" style={{ color: t.accent }}>Clear filters</button>}
        </div>
      )}

      {/* Order list */}
      <div className="rounded-xl desktop:rounded-[14px] overflow-hidden" style={{ background: dark ? "rgba(255,255,255,.09)" : "rgba(255,255,255,.85)", border: `0.5px solid ${t.cardBorder}` }}>
        {pagedGroups.length > 0 ? pagedGroups.map((item, i) => {
          if (item.type === "batch") {
            return <BatchRow key={item.batchId} batch={item} dark={dark} t={t} expanded={expandedBatch === item.batchId} onToggle={(id) => { setExpandedBatch(expandedBatch === id ? null : id); setExpandedBatchOrder(null); setExpanded(null); }} expandedOrder={expandedBatchOrder} setExpandedOrder={setExpandedBatchOrder} doAction={doAction} actionLoading={actionLoading} doBatchAction={doBatchAction} batchActionLoading={batchActionLoading} confirm={confirm} toast={toast} onNavigate={onNavigate} />;
          }
          const o = item.order;
          const attn = isAttention(o);
          return (
            <div key={o.id}>
              <div role="button" tabIndex={0} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();e.currentTarget.click()}}} onClick={() => { setExpanded(expanded === o.id ? null : o.id); setExpandedBatch(null); setExpandedBatchOrder(null); }} className="flex items-center py-3 px-3.5 desktop:py-3.5 desktop:px-[18px] cursor-pointer gap-3 desktop:gap-4 transition-[background-color] duration-150 hover:bg-[rgba(196,125,142,.06)]" style={{ borderBottom: (i < pagedGroups.length - 1 || expanded === o.id) ? `1px solid ${t.cardBorder}` : "none", ...(attn && { borderLeft: `3px solid ${dark ? "#fbbf24" : "#d97706"}` }) }}>
                <div className="shrink-0 flex items-center justify-center rounded-xl" style={{ width: 42, height: 42, background: dark ? "rgba(255,255,255,.09)" : "rgba(0,0,0,.04)", border: `1px solid ${dark ? "rgba(255,255,255,.12)" : "rgba(0,0,0,.06)"}` }}>
                  <PlatformIcon platform={o.platform} dark={dark} size={26} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] desktop:text-[15px] font-semibold overflow-hidden text-ellipsis whitespace-nowrap desktop:whitespace-nowrap max-md:whitespace-normal max-md:line-clamp-2 max-md:[display:-webkit-box] max-md:[-webkit-box-orient:vertical]" style={{ color: t.text }}>{o.service}</div>
                  {o.tier && <div className="text-[11px] desktop:text-xs font-medium mt-0.5" style={{ color: t.accent }}>{o.tier}</div>}
                  {o.created && <div className="text-[10px] desktop:text-[11px] mt-0.5" style={{ color: t.textMuted }}>{fD(o.created, true)}</div>}
                  {expanded !== o.id && <ProgressBar order={o} dark={dark} />}
                </div>
                <div className="text-right shrink-0 flex items-center gap-1.5">
                  {(o.status === "Processing" || o.status === "Pending") && <span className="w-2 h-2 rounded-full shrink-0 animate-pulse" style={{ background: sClr(o.status, dark) }} />}
                  <Badge status={o.status} dark={dark} />
                </div>
                <svg className="shrink-0 ml-0.5" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={t.textMuted} strokeWidth="2" strokeLinecap="round" style={{ transform: expanded === o.id ? "rotate(180deg)" : "rotate(0)", transition: "transform .2s", }}><polyline points="6 9 12 15 18 9"/></svg>
              </div>

              {/* Expanded details */}
              {expanded === o.id && <ExpandedOrderDetails o={o} dark={dark} t={t} doAction={doAction} actionLoading={actionLoading} confirm={confirm} toast={toast} onNavigate={onNavigate} waNum={waNum} />}
            </div>
          );
        }) : (
          <div className="py-10 px-6 text-center" style={{ color: t.textMuted }}>
            {hasFilters ? (
              <>
                <div className="text-base font-semibold mb-1" style={{ color: t.textSoft }}>No orders match your filters</div>
                <div className="text-[14px]" style={{ color: t.textMuted }}>Try adjusting your search or filters</div>
                <button onClick={() => { setFilter("all"); setSearch(""); setDateRange(null); setOPage(1); }} className="mt-3 py-1.5 px-4 rounded-lg text-[13px] font-semibold cursor-pointer border" style={{ background: "transparent", borderColor: t.cardBorder, color: t.accent }}>Clear all filters</button>
              </>
            ) : (
              <>
                <div className="text-base font-semibold mb-1" style={{ color: t.textSoft }}>No orders yet</div>
                <div className="text-[14px]" style={{ color: t.textMuted }}>Your orders will show up here once you start boosting</div>
              </>
            )}
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
  const activeCount = orders.filter(o => o.status === "Processing" || o.status === "Pending").length;
  const attentionCount = orders.filter(isAttention).length;
  const completedCount = orders.filter(o => o.status === "Completed").length;
  const totalSpent = orders.filter(o => o.status !== "Cancelled").reduce((s, o) => s + (o.charge || 0), 0);
  const refundedTotal = orders.filter(o => o.status === "Cancelled").reduce((s, o) => s + (o.charge || 0), 0);

  return (
    <>
      <div className="text-[13px] font-semibold uppercase tracking-[1.5px] mb-2.5 py-2 px-3 rounded-lg" style={{ color: t.textMuted, background: dark ? "rgba(196,125,142,.18)" : "rgba(196,125,142,.12)" }}>Order Summary</div>
      <div className="grid grid-cols-2 gap-1.5 mb-4">
        {[
          ["Total", String(orders.length), dark ? "#a5b4fc" : "#4f46e5"],
          ["Active", String(activeCount), dark ? "#fcd34d" : "#d97706"],
          ["Completed", String(completedCount), dark ? "#6ee7b7" : "#059669"],
          ...(attentionCount > 0 ? [["Attention", String(attentionCount), dark ? "#fbbf24" : "#d97706"]] : []),
          ["Spent", fN(totalSpent), t.accent],
          ...(refundedTotal > 0 ? [["Refunded", fN(refundedTotal), dark ? "#6ee7b7" : "#059669"]] : []),
        ].map(([label, val, color]) => (
          <div key={label} className="p-3 rounded-[10px]" style={{ background: t.cardBg }}>
            <div className="text-xs uppercase tracking-[0.5px] mb-1" style={{ color: t.textMuted }}>{label}</div>
            <div className="m text-base font-semibold" style={{ color }}>{val}</div>
          </div>
        ))}
      </div>

      <div className="h-px mt-1 mb-4" style={{ background: t.sidebarBorder }} />

      <div className="text-[13px] font-semibold uppercase tracking-[1.5px] mb-2.5 py-2 px-3 rounded-lg" style={{ color: t.textMuted, background: dark ? "rgba(196,125,142,.18)" : "rgba(196,125,142,.12)" }}>Recent Activity</div>
      {orders.slice(0, 5).map(o => (
        <div key={o.id} className="py-2 px-2.5 rounded-lg mb-1" style={{ background: t.cardBg }}>
          <div className="flex items-center gap-2.5">
            <PlatformIcon platform={o.platform} dark={dark} size={28} />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium overflow-hidden text-ellipsis whitespace-nowrap" style={{ color: t.text }}>{o.service}</div>
              {o.tier && <div className="text-[11px] font-medium" style={{ color: t.accent }}>{o.tier}</div>}
              <div className="text-[11px]" style={{ color: t.textMuted }}>{o.created ? fD(o.created, true) : ""}</div>
            </div>
          </div>
        </div>
      ))}
    </>
  );
}
