'use client';
import { useState, useEffect, useRef, useCallback } from "react";
import { useConfirm } from "./confirm-dialog";
import { useToast } from "./toast";
import { PlatformIcon } from "./platform-icon";
import { fN, fD, fT } from "../lib/format";
import { FilterDropdown } from "./date-range-picker";

const DRIP_CONFIG = {
  followers:  { batchSize: 200,  intervalHours: 2 },
  views:      { batchSize: 2000, intervalHours: 1 },
  likes:      { batchSize: 200,  intervalHours: 1 },
  comments:   { batchSize: 20,   intervalHours: 0.5 },
  engagement: { batchSize: 500,  intervalHours: 1 },
  reviews:    { batchSize: 5,    intervalHours: 2 },
};

function estimateDelivery(serviceType, quantity, remains, dripEndAt) {
  if (dripEndAt) {
    const msLeft = new Date(dripEndAt).getTime() - Date.now();
    if (msLeft <= 0) return null;
    const hoursLeft = msLeft / 3600000;
    if (hoursLeft < 1) return `< 1 hour`;
    if (hoursLeft < 24) { const h = Math.ceil(hoursLeft); return `~${h} ${h === 1 ? 'hour' : 'hours'}`; }
    const d = Math.ceil(hoursLeft / 24);
    return `~${d} ${d === 1 ? 'day' : 'days'}`;
  }
  const cfg = DRIP_CONFIG[(serviceType || '').toLowerCase()];
  if (!cfg) return null;
  if (remains != null && remains <= 0) return null;
  const q = remains != null && remains < quantity ? remains : quantity;
  const batches = Math.floor(q / cfg.batchSize);
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

function Spinner({ size = 14, color = "currentColor" }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className="animate-spin"><circle cx="12" cy="12" r="10" stroke={color} strokeWidth="3" strokeLinecap="round" opacity=".25" /><path d="M12 2a10 10 0 0 1 10 10" stroke={color} strokeWidth="3" strokeLinecap="round" /></svg>;
}

function CopyId({ value, dark, mono = true, size = "sm" }) {
  const [copied, setCopied] = useState(false);
  if (!value) return null;
  const fs = size === "sm" ? "text-[13px]" : "text-sm";
  return (
    <span
      className={`${fs} font-semibold cursor-pointer inline-flex items-center gap-1 transition-opacity hover:opacity-70`}
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


function CopyAllIds({ ids, dark }) {
  const [copied, setCopied] = useState(false);
  if (!ids || ids.length === 0) return null;
  return (
    <button
      onClick={e => { e.stopPropagation(); navigator.clipboard.writeText(ids.join(", ")); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
      className="text-[11px] font-semibold cursor-pointer border-none rounded-lg py-1 px-2.5 transition-all duration-200 hover:-translate-y-px"
      style={{ background: copied ? (dark ? "rgba(74,222,128,.15)" : "rgba(22,163,74,.1)") : (dark ? "rgba(96,165,250,.12)" : "rgba(37,99,235,.08)"), color: copied ? (dark ? "#4ade80" : "#16a34a") : (dark ? "#60a5fa" : "#2563eb") }}
    >{copied ? "Copied!" : `Copy all ${ids.length} IDs`}</button>
  );
}

function DripSection({ dispatches, dripConfig, dark, t }) {
  const [openDays, setOpenDays] = useState({});
  const allIds = dispatches.filter(d => d.apiOrderId).map(d => d.apiOrderId);
  const doneCount = dispatches.filter(d => d.status === "completed" || d.status === "partial").length;
  const days = {};
  for (const d of dispatches) {
    const day = d.day || 1;
    if (!days[day]) days[day] = [];
    days[day].push(d);
  }
  const dayKeys = Object.keys(days).sort((a, b) => a - b);
  const toggleDay = (day) => setOpenDays(prev => ({ ...prev, [day]: !prev[day] }));
  const statusLabel = (s) => s === "completed" ? "Completed" : s === "processing" ? "Processing" : s === "failed" ? "Failed" : s === "partial" ? "Partial" : "Pending";
  const cfgParts = [];
  if (dripConfig) {
    if (dripConfig.curve && dripConfig.curve !== "even") cfgParts.push(dripConfig.curve);
    if (dripConfig.window) cfgParts.push(`${dripConfig.window.startHour}:00–${dripConfig.window.endHour}:00`);
    if (dripConfig.pauseDay) cfgParts.push(`pause d${dripConfig.pauseDay}`);
    if (dripConfig.timezone) cfgParts.push(dripConfig.timezone.split("/").pop());
  }

  return (
    <div className="mt-2 mb-2 rounded-lg overflow-hidden" style={{ border: `1px solid ${dark ? "rgba(196,125,142,.18)" : "rgba(196,125,142,.14)"}` }}>
      <div className="flex items-center justify-between py-1.5 px-2.5" style={{ background: dark ? "rgba(196,125,142,.1)" : "rgba(196,125,142,.06)" }}>
        <span className="text-[11px] font-semibold uppercase tracking-[0.5px]" style={{ color: t.accent }}>Drip · {doneCount}/{dispatches.length} batches · {dayKeys.length} days{cfgParts.length > 0 ? ` · ${cfgParts.join(" · ")}` : ""}</span>
        <CopyAllIds ids={allIds} dark={dark} />
      </div>
      {dayKeys.map(day => {
        const batches = days[day];
        const dayIds = batches.filter(d => d.apiOrderId).map(d => d.apiOrderId);
        const dayDone = batches.filter(d => d.status === "completed" || d.status === "partial").length;
        const isOpen = openDays[day];
        const dayDate = batches[0]?.scheduled ? new Date(batches[0].scheduled).toLocaleDateString("en-GB", { day: "numeric", month: "short", ...(dripConfig?.timezone ? { timeZone: dripConfig.timezone } : {}) }) : "";
        return (
          <div key={day}>
            <div onClick={() => toggleDay(day)} className="w-full flex items-center gap-2 py-1.5 px-2.5 text-[11px] cursor-pointer" style={{ borderTop: `1px solid ${dark ? "rgba(255,255,255,.06)" : "rgba(0,0,0,.04)"}`, color: t.text }}>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 transition-transform" style={{ transform: isOpen ? "rotate(90deg)" : "rotate(0deg)" }}><polyline points="9 18 15 12 9 6"/></svg>
              <span className="font-semibold">Day {day}</span>
              {dayDate && <span style={{ color: t.textMuted }}>{dayDate}</span>}
              <span className="py-0.5 px-1.5 rounded text-[10px] font-semibold" style={{ background: dayDone === batches.length ? (dark ? "#0a2416" : "#ecfdf5") : (dark ? "rgba(250,204,21,.08)" : "#fffbeb"), color: dayDone === batches.length ? (dark ? "#6ee7b7" : "#059669") : (dark ? "#fcd34d" : "#d97706") }}>{dayDone}/{batches.length}</span>
              <span className="ml-auto flex items-center gap-1.5">
                {dayIds.length > 0 && dayKeys.length > 1 && <CopyAllIds ids={dayIds} dark={dark} />}
              </span>
            </div>
            {isOpen && (
              <div style={{ background: dark ? "rgba(0,0,0,.15)" : "rgba(0,0,0,.02)" }}>
                {batches.map((d, i) => {
                  const bDone = d.status === "completed";
                  const bProcessing = d.status === "processing" || d.status === "dispatching";
                  const bPartial = d.status === "partial";
                  const bFailed = d.status === "failed";
                  const bPending = d.status === "pending";
                  const barColor = bDone ? (dark ? "#6ee7b7" : "#059669") : bPartial ? (dark ? "#fbbf24" : "#d97706") : bFailed ? (dark ? "#fca5a5" : "#dc2626") : "#c47d8e";
                  return (
                  <div key={d.id || i} className="py-2 px-2.5 pl-7" style={{ borderTop: `1px solid ${dark ? "rgba(255,255,255,.04)" : "rgba(0,0,0,.03)"}` }}>
                    <div className="flex items-center gap-2 text-[11px]">
                      <span className="shrink-0 w-5 text-center font-semibold" style={{ color: t.textMuted }}>#{d.batch}</span>
                      <span className="shrink-0 w-12 font-semibold" style={{ color: t.text }}>{d.qty?.toLocaleString()}</span>
                      <span className="shrink-0 py-0.5 px-1.5 rounded text-[10px] font-semibold" style={{ background: sBg(statusLabel(d.status), dark), color: sClr(statusLabel(d.status), dark) }}>{d.status}</span>
                      {d.apiOrderId ? <CopyId value={d.apiOrderId} dark={dark} size="sm" /> : <span style={{ color: t.textMuted }}>—</span>}
                      <span className="ml-auto shrink-0" style={{ color: t.textMuted }}>{d.scheduled ? new Date(d.scheduled).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", ...(dripConfig?.timezone ? { timeZone: dripConfig.timezone } : {}) }) : ""}</span>
                    </div>
                    {!bPending && (
                      <div className="mt-1.5 ml-7 h-1 rounded-full overflow-hidden" style={{ background: dark ? "rgba(255,255,255,.1)" : "rgba(0,0,0,.06)" }}>
                        <div className="h-full rounded-full" style={{ width: bProcessing ? "60%" : bDone ? "100%" : bPartial ? `${d.qty && d.remains != null ? Math.round(((d.qty - d.remains) / d.qty) * 100) : 50}%` : "100%", background: barColor, ...(bProcessing ? { animation: "progress-pulse 2.8s ease-in-out infinite" } : {}) }} />
                      </div>
                    )}
                  </div>);
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function sClr(s, dk) { return s === "Completed" ? (dk ? "#6ee7b7" : "#059669") : s === "Processing" ? (dk ? "#a5b4fc" : "#4f46e5") : s === "Pending" ? (dk ? "#fcd34d" : "#d97706") : s === "Partial" ? (dk ? "#fdba74" : "#ea580c") : (s === "Failed" || s === "Rejected") ? (dk ? "#fca5a5" : "#dc2626") : s === "Cancelled" ? (dk ? "#a1a1aa" : "#71717a") : (dk ? "#555250" : "#8a8785"); }
function sBg(s, dk) { return s === "Completed" ? (dk ? "#0a2416" : "#ecfdf5") : s === "Processing" ? (dk ? "#0f1629" : "#eef2ff") : s === "Pending" ? (dk ? "#1c1608" : "#fffbeb") : s === "Partial" ? (dk ? "#1c1008" : "#fff7ed") : (s === "Failed" || s === "Rejected") ? (dk ? "#1f0a0a" : "#fef2f2") : s === "Cancelled" ? (dk ? "#1a1a1a" : "#f5f5f5") : (dk ? "#141414" : "#f5f5f5"); }


function errInfo(err, retryCount) {
  if (err === "user_cancelled") return { label: "Cancelled by User", tone: "neutral" };
  if (err?.startsWith?.("admin_cancelled")) return { label: "Cancelled by Admin", tone: "neutral" };
  if (err === "dispatch_failed") return { label: "Dispatch Failed", detail: "Order couldn't reach the provider and was auto-refunded", tone: "warn" };
  if (err === "needs_post_link") return { label: "Wrong Link Type", detail: "Customer sent a profile link — this service needs a post/video link", tone: "warn" };
  if (err === "needs_profile_link") return { label: "Wrong Link Type", detail: "Customer sent a post link — this service needs a profile link", tone: "warn" };
  if (err === "wrong_platform_link") return { label: "Wrong Platform", detail: "Link is from a different platform than the service", tone: "warn" };
  if (err === "wrong_service_type") return { label: "Service Mismatch", detail: "Service type doesn't match the link (e.g. followers service with a post link)", tone: "warn" };
  if (err === "missing_comments") return { label: "Missing Input", detail: "This service requires custom comments but none were provided", tone: "warn" };
  if (/incorrect service|invalid service|service replaced/i.test(err)) return { label: "Service Unavailable", detail: "Provider rejected or removed this service", tone: "error" };
  if (/quantity.*less|minim/i.test(err)) return { label: "Quantity Too Low", detail: err, tone: "warn" };
  if (/duplicate/i.test(err)) return { label: "Duplicate Order", detail: "Provider already has an active order for this link", tone: "warn" };
  if (/^\[TIMEOUT\]/.test(err)) return { label: `Timeout${retryCount > 0 ? ` · ${retryCount}/5 retries` : ""}`, detail: "Provider didn't respond in time — will retry", tone: "warn" };
  if (/^\[DUPLICATE\]/.test(err)) return { label: "Needs Manual Review", detail: err.replace("[DUPLICATE] ", ""), tone: "error" };
  return { label: `Provider Error${retryCount > 0 ? ` · ${retryCount} retries` : ""}`, detail: err, tone: "error" };
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

  const [total, setTotal] = useState(0);
  const [counts, setCounts] = useState({});
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const abortRef = useRef(null);

  const fetchOrders = useCallback((q, f, p, pp) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const params = new URLSearchParams();
    if (q?.trim().length >= 2) params.set('search', q.trim());
    if (f && f !== 'all') params.set('filter', f);
    params.set('page', String(p || 1));
    params.set('perPage', String(pp || 25));
    const qs = params.toString();
    fetch(`/api/admin/orders${qs ? `?${qs}` : ''}`, { signal: controller.signal }).then(r => r.json()).then(d => {
      setOrders(d.orders || []);
      setTotal(d.total || 0);
      if (d.counts) setCounts(d.counts);
      setLoading(false);
    }).catch(e => { if (e.name !== 'AbortError') setLoading(false); });
  }, []);

  useEffect(() => {
    const nextSearch = search.trim().length >= 2 ? search.trim() : "";
    const t = setTimeout(() => { setDebouncedSearch(nextSearch); setPage(1); }, search ? 350 : 0);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    fetchOrders(debouncedSearch, filter, page, perPage);
  }, [fetchOrders, debouncedSearch, filter, page, perPage]);

  useEffect(() => {
    const id = setInterval(() => fetchOrders(debouncedSearch, filter, page, perPage), 30000);
    const onVis = () => { if (document.visibilityState === 'visible') fetchOrders(debouncedSearch, filter, page, perPage); };
    document.addEventListener('visibilitychange', onVis);
    return () => { clearInterval(id); document.removeEventListener('visibilitychange', onVis); };
  }, [fetchOrders, debouncedSearch, filter, page, perPage]);

  const grouped = groupOrders(orders);
  const totalPages = Math.ceil(total / perPage);
  const paged = grouped;

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
        fetchOrders(search, filter, page, perPage);
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
      if (action === "dispatch") {
        toast.success(orderId, data.message || "Dispatched");
        fetchOrders(search, filter, page, perPage);
      } else {
        const label = action === "check" ? `Status: ${data.status || "unknown"}${data.remains != null ? ` · ${data.remains} remaining` : ""}` : action === "cancel" ? "Order cancelled" : "Refill requested";
        toast.success(orderId, label);
      }
    } catch { toast.error("Request failed", "Check your connection"); } finally { setActionLoading(null); }
  };

  const [batchActionLoading, setBatchActionLoading] = useState(null);
  const doBatchAction = async (batchId, action) => {
    setBatchActionLoading(batchId);
    try {
      const res = await fetch(`/api/admin/orders?batchId=${encodeURIComponent(batchId)}`);
      if (!res.ok) { toast.error("Batch load failed", "Could not fetch all orders in this batch"); setBatchActionLoading(null); return; }
      const data = await res.json();
      const batchOrders = data.orders || [];
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
      fetchOrders(debouncedSearch, filter, page, perPage);
    } catch { toast.error("Request failed", "Check your connection"); }
    setBatchActionLoading(null);
  };

  const autoChecked = useRef(new Set());
  const needsDispatch = (o) => {
    if (o.queuedBehind || !['Pending', 'Processing', 'Dispatching'].includes(o.status)) return false;
    if (o.dripDispatches && o.dripDispatches.length > 0) return o.dripDispatches.some(d => d.status === 'failed');
    return !o.apiOrderId;
  };

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

  const [cancelPrompt, setCancelPrompt] = useState(null);
  const [cancelNote, setCancelNote] = useState('');
  const [cancelSending, setCancelSending] = useState(false);
  const openCancel = (o) => { setCancelPrompt(o); setCancelNote(''); };
  const doCancel = async () => {
    if (!cancelPrompt) return;
    setCancelSending(true);
    try {
      const res = await fetch("/api/admin/orders", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "cancel", orderId: cancelPrompt.id, note: cancelNote.trim() }) });
      const data = await res.json();
      if (!res.ok) { toast.error("Cancel failed", data.error || "Something went wrong"); return; }
      toast.success(cancelPrompt.id, data.message || "Order cancelled");
      setCancelPrompt(null);
      if (data.status) setOrders(prev => prev.map(o => o.id === cancelPrompt.id ? { ...o, status: data.status } : o));
    } catch { toast.error("Request failed", "Check your connection"); } finally { setCancelSending(false); }
  };

  const [redispatchPrompt, setRedispatchPrompt] = useState(null);
  const [redispatchLink, setRedispatchLink] = useState('');
  const [redispatchSending, setRedispatchSending] = useState(false);
  const openRedispatch = (o) => { setRedispatchPrompt(o); setRedispatchLink(o.link || ''); };
  const doRedispatch = async () => {
    if (!redispatchPrompt) return;
    setRedispatchSending(true);
    try {
      const res = await fetch("/api/admin/orders", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "redispatch", orderId: redispatchPrompt.id, link: redispatchLink.trim() }) });
      const data = await res.json();
      if (!res.ok && !data.success) { toast.error("Re-dispatch failed", data.error || "Something went wrong"); return; }
      toast.success(data.newOrderId || redispatchPrompt.id, data.message || "Re-dispatched");
      setRedispatchPrompt(null);
      fetchOrders(search, filter, page, perPage);
    } catch { toast.error("Request failed", "Check your connection"); } finally { setRedispatchSending(false); }
  };

  const [editLinkPrompt, setEditLinkPrompt] = useState(null);
  const [editLinkValue, setEditLinkValue] = useState('');
  const [editLinkSending, setEditLinkSending] = useState(false);
  const openEditLink = (o) => { setEditLinkPrompt(o); setEditLinkValue(o.link || ''); };
  const doEditLink = async () => {
    if (!editLinkPrompt) return;
    setEditLinkSending(true);
    try {
      const res = await fetch("/api/admin/orders", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "update_link", orderId: editLinkPrompt.id, link: editLinkValue.trim() }) });
      const data = await res.json();
      if (!res.ok) { toast.error("Update failed", data.error || "Something went wrong"); return; }
      toast.success(editLinkPrompt.id, "Link updated");
      setOrders(prev => prev.map(o => o.id === editLinkPrompt.id ? { ...o, link: data.link } : o));
      setEditLinkPrompt(null);
    } catch { toast.error("Request failed", "Check your connection"); } finally { setEditLinkSending(false); }
  };

  const [refundPrompt, setRefundPrompt] = useState(null);
  const [refundPercent, setRefundPercent] = useState(25);
  const [refundSending, setRefundSending] = useState(false);
  const openRefund = (o) => { setRefundPrompt(o); setRefundPercent(25); };
  const doRefund = async () => {
    if (!refundPrompt) return;
    const alr = refundPrompt.refundedTotal || 0;
    const rem = Math.max(0, refundPrompt.charge - alr);
    const amt = refundPercent === 100 ? rem : Math.round(refundPrompt.charge * refundPercent / 100 * 100) / 100;
    const ok = await confirm({ title: "Confirm Refund", message: `Refund ${fN(amt)} (${refundPercent === 100 ? "full" : refundPercent + "%"}) to ${refundPrompt.user} for order ${refundPrompt.id}?`, confirmLabel: "Yes, Refund", danger: false, compact: true });
    if (!ok) return;
    setRefundSending(true);
    try {
      const res = await fetch("/api/admin/orders", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "refund", orderId: refundPrompt.id, percent: refundPercent }) });
      const data = await res.json();
      if (!res.ok) { toast.error("Refund failed", data.error || "Something went wrong"); return; }
      toast.success(refundPrompt.id, data.message || "Refund processed");
      setRefundPrompt(null);
      fetchOrders(search, filter, page, perPage);
    } catch { toast.error("Refund failed", "Check your connection"); } finally { setRefundSending(false); }
  };


  return (
    <>
      <div className="adm-header">
        <div className="adm-title" style={{ color: t.text }}>Orders</div>
        <div className="adm-subtitle" style={{ color: t.textMuted }}>{total} total orders</div>
        <div className="page-divider" style={{ background: t.cardBorder }} />
      </div>

      {/* Search + filters */}
      <div className="flex items-center gap-2 mb-4">
        <div className="relative flex-1 min-w-0">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={t.textMuted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg></span>
          <input aria-label="Search orders" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search order ID, service, or user…" className="w-full py-[9px] pl-9 pr-8 rounded-lg text-[13px] outline-none font-[inherit]" style={{ border: `1px solid ${t.cardBorder}`, background: dark ? '#131728' : '#fff', color: t.text }} />
          {search && <button aria-label="Clear search" onClick={() => { setSearch(""); setPage(1); }} className="absolute right-2.5 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center rounded-full cursor-pointer border-none p-0" style={{ background: dark ? 'rgba(255,255,255,.15)' : 'rgba(0,0,0,.1)', color: t.textMuted }}><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>}
        </div>
        <FilterDropdown dark={dark} t={t} value={filter} onChange={(v) => { setFilter(v); setPage(1); }} alert={counts.needs_dispatch > 0} options={
          [
            { value: "all", label: "All" },
            { value: "needs_dispatch", label: `Needs Dispatch${counts.needs_dispatch ? ` (${counts.needs_dispatch})` : ""}` },
            { value: "queued", label: `Queued${counts.queued ? ` (${counts.queued})` : ""}` },
            ...["Pending", "Processing", "Completed", "Partial", "Cancelled"].map(f => ({ value: f, label: f })),
          ]
        } />
        <button onClick={syncOrders} disabled={syncing} className="py-[7px] px-3 rounded-lg text-[12px] font-semibold cursor-pointer font-[inherit] flex items-center gap-1.5 shrink-0" style={{ border: `1px solid ${t.cardBorder}`, background: 'transparent', color: t.accent, opacity: syncing ? .5 : 1 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ animation: syncing ? "spin 1s linear infinite" : "none" }}><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/></svg>
          {syncing ? "Syncing…" : "Sync"}
        </button>
      </div>

      {/* Orders list */}
      <div className="adm-card" style={{ background: dark ? "rgba(255,255,255,.09)" : "rgba(255,255,255,.85)", border: `0.5px solid ${dark ? "rgba(255,255,255,.16)" : "rgba(0,0,0,.12)"}` }}>
        {loading ? (
          <div className="adm-empty">{[1,2,3,4,5].map(i => <div key={i} className={`skel-bone h-[52px] rounded-lg mb-1.5 ${dark ? "skel-dark" : "skel-light"}`} />)}</div>
        ) : paged.length > 0 ? paged.map((item, idx) => {
          if (item.type === "batch") {
            const batch = item;
            const isOpen = expandedBatch === batch.batchId;
            const totalCharge = batch.orders.reduce((s, o) => s + (o.charge || 0), 0);
            const hasAttention = batch.orders.some(o => o.status === "Partial" || (o.lastError && o.status === "Pending" && !o.apiOrderId));
            const activeOrders = batch.orders.filter(o => !["Completed", "Cancelled"].includes(o.status));
            const checkable = batch.orders.filter(o => o.apiOrderId && !["Completed", "Cancelled"].includes(o.status));
            const isBatchLoading = batchActionLoading === batch.batchId;
            const accentColor = hasAttention ? (dark ? "#fcd34d" : "#d97706") : t.accent;

            const batchSt = batch.orders.every(o => o.status === "Completed") ? "Completed"
              : batch.orders.every(o => o.status === "Cancelled") ? "Cancelled"
              : batch.orders.some(o => ["Pending", "Processing", "In progress"].includes(o.status)) ? "Processing"
              : "Partial";

            return (
              <div key={batch.batchId} style={{ borderBottom: idx < paged.length - 1 ? `1px solid ${t.cardBorder}` : "none" }}>
                {/* Batch header */}
                <div role="button" tabIndex={0} onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.currentTarget.click(); } }} onClick={() => { setExpandedBatch(isOpen ? null : batch.batchId); setExpandedBatchOrder(null); setExpanded(null); }} className="flex items-center py-3 px-3.5 desktop:py-3.5 desktop:px-5 cursor-pointer gap-3 desktop:gap-4 transition-[background-color] duration-150 hover:bg-[rgba(196,125,142,.06)]" style={{ ...(hasAttention && { borderLeft: `3px solid ${dark ? "#fbbf24" : "#d97706"}` }) }}>
                  <div className="shrink-0 flex items-center justify-center rounded-xl" style={{ width: 42, height: 42, background: dark ? "rgba(196,125,142,.12)" : "rgba(196,125,142,.08)", border: `1px solid ${dark ? "rgba(196,125,142,.2)" : "rgba(196,125,142,.15)"}` }}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={t.accent} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 002 1.61h9.72a2 2 0 002-1.61L23 6H6"/></svg>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-[13px] desktop:text-[15px] font-semibold overflow-hidden text-ellipsis whitespace-nowrap" style={{ color: t.text }}>{batch.batchId} <span className="text-[11px] desktop:text-xs font-normal" style={{ color: t.textMuted }}>{batch.orders[0]?.user}</span></div>
                    <div className="text-[11px] desktop:text-xs font-medium mt-0.5" style={{ color: t.accent }}>{batch.orders.length} order{batch.orders.length !== 1 ? "s" : ""}</div>
                    {batch.created && <div className="text-[10px] desktop:text-[11px] mt-0.5" style={{ color: t.textMuted }}>{fD(batch.created, true)}</div>}
                  </div>
                  <div className="text-right shrink-0 flex items-center gap-1.5">
                    {(batchSt === "Processing") && <span className="w-2 h-2 rounded-full shrink-0 animate-pulse" style={{ background: sClr("Processing", dark) }} />}
                    <div className="m text-[13px] desktop:text-[15px] font-bold" style={{ color: batchSt === "Cancelled" ? (dark ? "#fca5a5" : "#dc2626") : batchSt === "Partial" ? (dark ? "#fbbf24" : "#d97706") : (dark ? "#6ee7b7" : "#059669") }}>{batchSt === "Cancelled" ? "-" : "+"}{fN(totalCharge)}</div>
                  </div>
                  <svg className="shrink-0" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={t.textMuted} strokeWidth="2" strokeLinecap="round" style={{ transform: isOpen ? "rotate(180deg)" : "rotate(0)", transition: "transform .2s" }}><polyline points="6 9 12 15 18 9"/></svg>
                </div>

                {/* Expanded batch — order list */}
                {isOpen && (
                  <div style={{ background: dark ? "rgba(255,255,255,.05)" : "rgba(0,0,0,.02)", borderTop: `2px solid ${dark ? "rgba(196,125,142,.28)" : "rgba(196,125,142,.24)"}`, ...(activeOrders.length > 0 ? { borderLeft: `3px solid ${accentColor}` } : {}) }}>
                    {/* Batch action bar */}
                    <div className="flex items-center gap-2 py-2.5 px-4 desktop:px-5 flex-wrap" style={{ borderBottom: `1px solid ${dark ? "rgba(255,255,255,.12)" : "rgba(0,0,0,.08)"}` }}>
                      <span className="text-[11px] uppercase tracking-[1px] font-medium mr-auto" style={{ color: t.textMuted }}>Batch actions</span>
                      {checkable.length > 0 && <button onClick={() => doBatchAction(batch.batchId, "check")} disabled={isBatchLoading} className="adm-btn-sm text-[11px] flex items-center justify-center gap-1.5 min-w-[70px]" style={{ borderColor: dark ? "rgba(96,165,250,.25)" : "rgba(37,99,235,.2)", color: dark ? "#60a5fa" : "#2563eb", background: dark ? "rgba(96,165,250,.08)" : "rgba(37,99,235,.04)" }}>{isBatchLoading ? <Spinner size={11} color={dark ? "#60a5fa" : "#2563eb"} /> : "Check all"}</button>}
                      {activeOrders.length > 0 && <button onClick={async () => { const ok = await confirm({ title: "Cancel Batch", message: `Cancel all active orders in ${batch.batchId}? This may issue refunds.`, confirmLabel: "Cancel All", danger: true }); if (ok) doBatchAction(batch.batchId, "cancel"); }} disabled={isBatchLoading} className="adm-btn-sm text-[11px]" style={{ borderColor: dark ? "rgba(252,165,165,.28)" : "rgba(220,38,38,.24)", color: dark ? "#fca5a5" : "#dc2626", opacity: isBatchLoading ? .5 : 1 }}>Cancel all</button>}
                    </div>
                    {batch.orders.map((o, i) => (
                      <div key={o.id}>
                        <div role="button" tabIndex={0} onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.currentTarget.click(); } }} onClick={() => setExpandedBatchOrder(expandedBatchOrder === o.id ? null : o.id)} className="flex items-center py-2.5 px-3 desktop:py-3 desktop:px-4 pl-4 desktop:pl-5 cursor-pointer gap-2.5 desktop:gap-3 transition-[background-color] duration-150 hover:bg-[rgba(196,125,142,.06)]" style={{ borderBottom: `1px solid ${dark ? "rgba(255,255,255,.12)" : "rgba(0,0,0,.08)"}` }}>
                          <div className="shrink-0 flex items-center justify-center rounded-lg" style={{ width: 36, height: 36, background: dark ? "rgba(255,255,255,.08)" : "rgba(0,0,0,.03)", border: `1px solid ${dark ? "rgba(255,255,255,.10)" : "rgba(0,0,0,.05)"}` }}>
                            <PlatformIcon platform={o.platform} dark={dark} size={22} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div title={o.service} className="text-[13px] desktop:text-sm font-semibold overflow-hidden text-ellipsis whitespace-nowrap max-md:whitespace-normal max-md:line-clamp-2 max-md:[display:-webkit-box] max-md:[-webkit-box-orient:vertical]" style={{ color: t.text }}>{o.service}</div>
                            {(o.tierLabel || o.offerDisabled) && (
                              <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                                {o.tierLabel && <span className="text-[10px] desktop:text-[11px] font-medium" style={{ color: t.accent }}>{o.tierLabel}</span>}
                                {o.offerDisabled && <span className="inline-flex items-center rounded-full py-px px-1.5 text-[9px] desktop:text-[10px] font-semibold uppercase tracking-[0.4px]" style={{ background: dark ? "rgba(252,165,165,.12)" : "rgba(220,38,38,.07)", color: dark ? "#fca5a5" : "#dc2626", border: `1px solid ${dark ? "rgba(252,165,165,.2)" : "rgba(220,38,38,.12)"}` }}>Disabled</span>}
                              </div>
                            )}
                            <div className="flex items-center gap-1.5 text-[10px] desktop:text-[11px] mt-0.5 flex-wrap" style={{ color: t.textMuted }}>
                              <span>{o.created ? fD(o.created, true) : ""}</span>
                              <span className="w-[3px] h-[3px] rounded-full bg-current opacity-30 shrink-0" />
                              <span>{o.user}</span>
                            </div>
                          </div>
                          {(o.status === "Processing" || o.status === "Pending") && <span className="w-[6px] h-[6px] rounded-full shrink-0" style={{ background: sClr(o.status, dark), animation: "progress-pulse 2.8s ease-in-out infinite" }} />}
                          <div className="text-right shrink-0">
                            <div className="m text-[13px] desktop:text-sm font-bold" style={{ color: o.status === "Cancelled" ? (dark ? "#fca5a5" : "#dc2626") : o.status === "Partial" ? (dark ? "#fbbf24" : "#d97706") : (dark ? "#6ee7b7" : "#059669") }}>{o.status === "Cancelled" ? "-" : "+"}{fN(o.charge)}</div>
                          </div>
                          <svg className="shrink-0 ml-0.5" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={t.textMuted} strokeWidth="2" strokeLinecap="round" style={{ transform: expandedBatchOrder === o.id ? "rotate(180deg)" : "rotate(0)", transition: "transform .2s" }}><polyline points="6 9 12 15 18 9"/></svg>
                        </div>
                        {expandedBatchOrder === o.id && (
                          <div className="py-3 px-3 desktop:py-3.5 desktop:px-4 pl-4 desktop:pl-5" style={{ background: dark ? "rgba(196,125,142,.05)" : "rgba(196,125,142,.04)", borderTop: `1px solid ${dark ? "rgba(196,125,142,.2)" : "rgba(196,125,142,.15)"}`, borderBottom: `3px solid ${dark ? "rgba(196,125,142,.25)" : "rgba(196,125,142,.2)"}`, borderLeft: `3px solid ${t.accent}` }}>
                            {/* User header */}
                            <div className="flex items-center gap-2.5 mb-2.5">
                              <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0" style={{ background: `${t.accent}20`, color: t.accent }}>{(o.user || "?")[0].toUpperCase()}</div>
                              <div className="flex-1 min-w-0">
                                <span className="text-[12px] font-semibold" style={{ color: t.text }}>{o.user}</span>
                                <span className="text-[11px] ml-1.5" style={{ color: t.textMuted }}>{o.email}</span>
                              </div>
                              <span className="text-[11px] shrink-0" style={{ color: t.textMuted }}>{o.created ? fD(o.created) : ""}</span>
                            </div>

                            {/* Link */}
                            {o.link && (
                              <div className="mb-2.5 py-1.5 px-2.5 rounded-lg flex items-center gap-2 min-w-0 max-w-full overflow-hidden" style={{ background: dark ? "rgba(255,255,255,.05)" : "rgba(0,0,0,.025)", border: `1px solid ${dark ? "rgba(255,255,255,.1)" : "rgba(0,0,0,.06)"}` }}>
                                <div className="w-6 h-6 rounded-md flex items-center justify-center shrink-0" style={{ background: dark ? "rgba(255,255,255,.08)" : "rgba(0,0,0,.04)", color: t.textMuted }}>
                                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/></svg>
                                </div>
                                <a href={o.link} target="_blank" rel="noopener noreferrer" title={o.link} className="m min-w-0 flex-1 text-[12px] leading-[1.45] overflow-hidden text-ellipsis whitespace-nowrap no-underline" style={{ color: t.textSoft }}>{o.link}</a>
                                {!o.apiOrderId && o.status !== "Cancelled" && <button onClick={() => openEditLink(o)} className="shrink-0 w-6 h-6 rounded-md flex items-center justify-center cursor-pointer border-none" style={{ background: dark ? "rgba(255,255,255,.08)" : "rgba(0,0,0,.04)", color: t.textMuted }} title="Edit link"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>}
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
                              const isPartial = o.status === "Partial";
                              const barColor = isCancelled ? (dark ? "#666" : "#999") : isComplete ? (dark ? "#6ee7b7" : "#059669") : isPartial ? (dark ? "#fbbf24" : "#d97706") : "#c47d8e";
                              const waiting = !isCancelled && !hasData && !isComplete && (o.status === "Pending" || o.status === "Processing");
                              const queued = !!o.queuedBehind;
                              const isProcessing = !isComplete && !isPartial && !isCancelled && !waiting && pct > 0 && pct < 100;
                              return (
                                <div className="mb-2.5 py-1.5 px-2.5 rounded-lg" style={{ background: dark ? "rgba(255,255,255,.05)" : "rgba(0,0,0,.02)", border: `1px solid ${dark ? "rgba(255,255,255,.08)" : "rgba(0,0,0,.04)"}` }}>
                                  <div className="flex items-center justify-between text-[11px] mb-1">
                                    <span style={{ color: t.textMuted }}>{isCancelled ? "Cancelled" : queued ? `Queued behind ${o.queuedBehind}` : waiting ? "Waiting to start" : "Delivered"}</span>
                                    {!waiting && <span className="m font-semibold" style={{ color: barColor }}>{delivered.toLocaleString()} / {qty.toLocaleString()}</span>}
                                  </div>
                                  <div className="h-1.5 rounded-full overflow-hidden" style={{ background: dark ? "rgba(255,255,255,.14)" : "rgba(0,0,0,.08)" }}>
                                    {waiting
                                      ? <div className="h-full rounded-full" style={{ background: `repeating-linear-gradient(-55deg, ${dark ? "rgba(255,255,255,.22)" : "rgba(0,0,0,.16)"}, ${dark ? "rgba(255,255,255,.22)" : "rgba(0,0,0,.16)"} 6px, ${dark ? "rgba(255,255,255,.06)" : "rgba(0,0,0,.04)"} 6px, ${dark ? "rgba(255,255,255,.06)" : "rgba(0,0,0,.04)"} 12px)`, backgroundSize: "28px 100%", animation: "progress-stripe .8s linear infinite" }} />
                                      : <div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${pct}%`, background: barColor, ...(isProcessing ? { animation: "progress-pulse 2.8s ease-in-out infinite" } : {}) }} />}
                                  </div>
                                </div>
                              );
                            })()}

                            {/* Error / cancel info */}
                            {o.lastError && (() => {
                              const ei = errInfo(o.lastError, o.retryCount);
                              const colors = { neutral: { bg: dark ? "rgba(161,161,170,.08)" : "rgba(113,113,122,.04)", brd: dark ? "rgba(161,161,170,.18)" : "rgba(113,113,122,.12)", clr: dark ? "#a1a1aa" : "#71717a" }, warn: { bg: dark ? "rgba(251,191,36,.08)" : "rgba(217,119,6,.04)", brd: dark ? "rgba(251,191,36,.18)" : "rgba(217,119,6,.12)", clr: dark ? "#fbbf24" : "#d97706" }, error: { bg: dark ? "rgba(252,165,165,.08)" : "rgba(220,38,38,.04)", brd: dark ? "rgba(252,165,165,.18)" : "rgba(220,38,38,.12)", clr: dark ? "#fca5a5" : "#dc2626" } }[ei.tone];
                              return (
                              <div className="mb-2.5 py-2 px-3 rounded-lg flex items-start gap-2" style={{ background: colors.bg, border: `1px solid ${colors.brd}` }}>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={colors.clr} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 mt-0.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                                <div className="min-w-0">
                                  <div className="text-[11px] font-semibold uppercase tracking-[0.5px] mb-0.5" style={{ color: colors.clr }}>{ei.label}</div>
                                  {ei.detail && <div className="text-[12px] break-all" style={{ color: colors.clr, opacity: .8 }}>{ei.detail}</div>}
                                </div>
                              </div>);
                            })()}

                            {/* Details grid */}
                            {(() => { const isPartial = o.status === "Partial" && o.remains > 0 && o.quantity > 0; const delivered = isPartial ? o.quantity - o.remains : o.quantity; const ratio = isPartial ? delivered / o.quantity : 1; const netCharge = isPartial ? Math.round(o.charge * ratio) : o.charge; const netCost = isPartial ? Math.round((o.cost || 0) * ratio) : (o.cost || 0); const profit = netCharge - netCost; const margin = netCost > 0 ? Math.round(profit / netCost * 100) : 0; return (
                            <div className="grid grid-cols-2 desktop:grid-cols-4 gap-1.5 mb-2.5">
                              <div className="py-1.5 px-2 rounded-lg text-center" style={{ background: dark ? "rgba(255,255,255,.07)" : "rgba(0,0,0,.03)", border: `1px solid ${dark ? "rgba(255,255,255,.12)" : "rgba(0,0,0,.06)"}` }}>
                                <div className="text-[10px] uppercase tracking-[1px] mb-0.5" style={{ color: t.textMuted }}>{o.status === "Cancelled" ? "Refunded" : isPartial ? "Net Charge" : "Charge"}</div>
                                <div className="m text-[13px] font-bold" style={{ color: o.status === "Cancelled" ? (dark ? "#fca5a5" : "#dc2626") : (dark ? "#6ee7b7" : "#059669") }}>{o.status === "Cancelled" ? "-" : "+"}{fN(netCharge)}</div>
                              </div>
                              <div className="py-1.5 px-2 rounded-lg text-center" style={{ background: dark ? "rgba(255,255,255,.07)" : "rgba(0,0,0,.03)", border: `1px solid ${dark ? "rgba(255,255,255,.12)" : "rgba(0,0,0,.06)"}` }}>
                                <div className="text-[10px] uppercase tracking-[1px] mb-0.5" style={{ color: t.textMuted }}>Cost</div>
                                <div className="m text-[13px] font-bold" style={{ color: t.textSoft }}>{fN(o.status === "Cancelled" ? 0 : netCost)}</div>
                              </div>
                              <div className="py-1.5 px-2 rounded-lg text-center" style={{ background: dark ? "rgba(255,255,255,.07)" : "rgba(0,0,0,.03)", border: `1px solid ${dark ? "rgba(255,255,255,.12)" : "rgba(0,0,0,.06)"}` }}>
                                <div className="text-[10px] uppercase tracking-[1px] mb-0.5" style={{ color: t.textMuted }}>Profit</div>
                                <div className="m text-[13px] font-bold" style={{ color: o.status === "Cancelled" ? t.textMuted : profit < 0 ? (dark ? "#fca5a5" : "#dc2626") : (dark ? "#6ee7b7" : "#059669") }}>{o.status === "Cancelled" ? fN(0) : fN(profit)}{o.status !== "Cancelled" && <span className="inline-flex items-center ml-1.5 text-[9px] font-semibold py-[1px] px-1.5 rounded-md" style={{ background: profit < 0 ? (dark ? "rgba(252,165,165,.12)" : "rgba(220,38,38,.08)") : (dark ? "rgba(110,231,183,.12)" : "rgba(5,150,105,.08)"), color: profit < 0 ? (dark ? "#fca5a5" : "#dc2626") : (dark ? "#6ee7b7" : "#059669") }}>{margin}%</span>}</div>
                              </div>
                              <div className="py-1.5 px-2 rounded-lg text-center" style={{ background: dark ? "rgba(255,255,255,.07)" : "rgba(0,0,0,.03)", border: `1px solid ${dark ? "rgba(255,255,255,.12)" : "rgba(0,0,0,.06)"}` }}>
                                <div className="text-[10px] uppercase tracking-[1px] mb-0.5" style={{ color: t.textMuted }}>Order No</div>
                                <CopyId value={o.id} dark={dark} size="sm" />
                                {o.parentOrderId && <button onClick={(e) => { e.stopPropagation(); setSearch(o.parentOrderId); }} className="mt-1 text-[9px] font-semibold cursor-pointer border-none rounded px-1.5 py-0.5" style={{ background: dark ? "rgba(165,180,252,.12)" : "rgba(79,70,229,.07)", color: dark ? "#a5b4fc" : "#4f46e5" }}>From {o.parentOrderId}</button>}
                                {o.childOrderId && <button onClick={(e) => { e.stopPropagation(); setSearch(o.childOrderId); }} className="mt-1 text-[9px] font-semibold cursor-pointer border-none rounded px-1.5 py-0.5" style={{ background: dark ? "rgba(252,211,77,.12)" : "rgba(217,119,6,.07)", color: dark ? "#fcd34d" : "#d97706" }}>&rarr; {o.childOrderId}</button>}
                              </div>
                              <div className="py-1.5 px-2 rounded-lg text-center" style={{ background: dark ? "rgba(255,255,255,.07)" : "rgba(0,0,0,.03)", border: `1px solid ${dark ? "rgba(255,255,255,.12)" : "rgba(0,0,0,.06)"}` }}>
                                <div className="text-[10px] uppercase tracking-[1px] mb-0.5" style={{ color: t.textMuted }}>Quantity</div>
                                <div className="m text-[13px] font-semibold" style={{ color: t.text }}>{(o.quantity || 0).toLocaleString()}</div>
                              </div>
                              <div className="py-1.5 px-2 rounded-lg text-center" style={{ background: dark ? "rgba(255,255,255,.07)" : "rgba(0,0,0,.03)", border: `1px solid ${dark ? "rgba(255,255,255,.12)" : "rgba(0,0,0,.06)"}` }}>
                                <div className="text-[10px] uppercase tracking-[1px] mb-0.5" style={{ color: t.textMuted }}>Provider</div>
                                <div className="m text-[13px] font-bold" style={{ color: t.text }}>{{ mtp: "MTP", daosmm: "DaoSMM" }[o.provider] || (o.provider || "mtp").toUpperCase()}</div>
                              </div>
                              {o.serviceApiId && <div className="py-1.5 px-2 rounded-lg text-center" style={{ background: dark ? "rgba(255,255,255,.07)" : "rgba(0,0,0,.03)", border: `1px solid ${dark ? "rgba(255,255,255,.12)" : "rgba(0,0,0,.06)"}` }}>
                                <div className="text-[10px] uppercase tracking-[1px] mb-0.5" style={{ color: t.textMuted }}>Service ID</div>
                                <CopyId value={o.serviceApiId} dark={dark} size="sm" />
                              </div>}
                              {o.apiOrderId && <div className="py-1.5 px-2 rounded-lg text-center" style={{ background: dark ? "rgba(255,255,255,.07)" : "rgba(0,0,0,.03)", border: `1px solid ${dark ? "rgba(255,255,255,.12)" : "rgba(0,0,0,.06)"}` }}>
                                <div className="text-[10px] uppercase tracking-[1px] mb-0.5" style={{ color: t.textMuted }}>Provider Order</div>
                                <CopyId value={o.apiOrderId} dark={dark} size="sm" />
                              </div>}
                              {o.startCount != null && <div className="py-1.5 px-2 rounded-lg text-center" style={{ background: dark ? "rgba(255,255,255,.07)" : "rgba(0,0,0,.03)", border: `1px solid ${dark ? "rgba(255,255,255,.12)" : "rgba(0,0,0,.06)"}` }}>
                                <div className="text-[10px] uppercase tracking-[1px] mb-0.5" style={{ color: t.textMuted }}>Start Count</div>
                                <div className="m text-[13px] font-semibold" style={{ color: t.text }}>{o.startCount.toLocaleString()}</div>
                              </div>}
                              {(() => { const est = estimateDelivery(o.serviceType, o.quantity, o.remains, o.dripEndAt); if (!est || o.status === "Completed" || o.status === "Cancelled") return null; return (
                              <div className="py-1.5 px-2 rounded-lg text-center" style={{ background: dark ? "rgba(196,125,142,.1)" : "rgba(196,125,142,.05)", border: `1px solid ${dark ? "rgba(196,125,142,.2)" : "rgba(196,125,142,.12)"}` }}>
                                <div className="text-[10px] uppercase tracking-[1px] mb-0.5" style={{ color: t.textMuted }}>Est. Time</div>
                                <div className="m text-[13px] font-semibold flex items-center justify-center gap-1" style={{ color: t.accent }}>
                                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                                  {est}
                                </div>
                              </div>); })()}
                            </div>); })()}

                            {/* Drip dispatches */}
                            {o.dripDispatches && <DripSection dispatches={o.dripDispatches} dripConfig={o.dripConfig} dark={dark} t={t} />}

                            {/* Actions */}
                            <div className="flex items-center gap-2 flex-wrap py-1.5 px-1">
                              {needsDispatch(o) && <button onClick={async () => { const ok = await confirm({ title: "Manual Dispatch", message: `Dispatch order ${o.id} to provider now?`, confirmLabel: "Dispatch" }); if (ok) doAction(o.id, "dispatch"); }} disabled={!!actionLoading} className="m flex items-center gap-1.5 text-[12px] font-semibold cursor-pointer border-none rounded-lg py-1.5 px-2.5" style={{ background: dark ? "rgba(252,211,77,.12)" : "rgba(217,119,6,.07)", color: dark ? "#fcd34d" : "#d97706" }}>{actionLoading === o.id ? <Spinner size={12} color={dark ? "#fcd34d" : "#d97706"} /> : <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>}Dispatch</button>}
                              <button onClick={() => doAction(o.id, "check")} disabled={actionLoading === o.id} className="m flex items-center gap-1.5 text-[12px] font-semibold cursor-pointer border-none rounded-lg py-1.5 px-2.5" style={{ background: dark ? "rgba(165,180,252,.12)" : "rgba(79,70,229,.07)", color: dark ? "#a5b4fc" : "#4f46e5" }}>{actionLoading === o.id ? <Spinner size={12} color={dark ? "#a5b4fc" : "#4f46e5"} /> : <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>}Check</button>
                              {!["Cancelled", "Completed", "Partial"].includes(o.status) && <button onClick={() => openCancel(o)} disabled={!!actionLoading} className="m flex items-center gap-1.5 text-[12px] font-semibold cursor-pointer border-none rounded-lg py-1.5 px-2.5" style={{ background: dark ? "rgba(252,165,165,.1)" : "rgba(220,38,38,.06)", color: dark ? "#fca5a5" : "#dc2626" }}><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>Cancel</button>}
                              {o.status === "Cancelled" && o.lastError !== "user_cancelled" && !o.redispatchedAt && <button onClick={() => openRedispatch(o)} disabled={!!actionLoading} className="m flex items-center gap-1.5 text-[12px] font-semibold cursor-pointer border-none rounded-lg py-1.5 px-2.5" style={{ background: dark ? "rgba(252,211,77,.12)" : "rgba(217,119,6,.07)", color: dark ? "#fcd34d" : "#d97706" }}><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/></svg>Re-dispatch</button>}
                              {o.status === "Completed" && <button onClick={async () => { const ok = await confirm({ title: "Refill Order", message: `Request a refill for order ${o.id}?`, confirmLabel: "Refill" }); if (ok) doAction(o.id, "refill"); }} disabled={!!actionLoading} className="m flex items-center gap-1.5 text-[12px] font-semibold cursor-pointer border-none rounded-lg py-1.5 px-2.5" style={{ background: dark ? "rgba(196,125,142,.12)" : "rgba(196,125,142,.07)", color: t.accent }}><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 102.13-9.36L1 10"/></svg>Refill</button>}
                              {(o.status === "Completed" || o.status === "Partial") && <button onClick={() => openRefund(o)} className="m flex items-center gap-1.5 text-[12px] font-semibold cursor-pointer border-none rounded-lg py-1.5 px-2.5" style={{ background: dark ? "rgba(251,191,36,.1)" : "rgba(217,119,6,.06)", color: dark ? "#fbbf24" : "#c2710a" }}><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 14 4 9 9 4"/><path d="M20 20v-7a4 4 0 00-4-4H4"/></svg>{o.refundedTotal >= o.charge ? "Fully Refunded" : o.refundedTotal > 0 ? `Refund (${Math.round(o.refundedTotal / o.charge * 100)}%)` : "Refund"}</button>}
                              {o.phone ? <a href={`https://wa.me/${o.phone.replace(/\D/g,"")}?text=${encodeURIComponent(`Hi ${(o.user||"").split(" ")[0]||"there"}, this is Nitro Support.\n\nRegarding your order ${o.id} (${o.service} x ${o.quantity}):\n\n`)}`} target="_blank" rel="noopener noreferrer" className="m flex items-center gap-1.5 text-[12px] font-semibold cursor-pointer no-underline border-none rounded-lg py-1.5 px-2.5" style={{ background: dark ? "rgba(37,211,102,.12)" : "rgba(37,211,102,.07)", color: "#25d366" }}><svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>WhatsApp</a> : <button onClick={() => toast.info("No WhatsApp", `${o.user} hasn't added their number yet`)} className="m flex items-center gap-1.5 text-[12px] font-semibold cursor-pointer border-none rounded-lg py-1.5 px-2.5 opacity-40" style={{ color: "#25d366" }}><svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>WhatsApp</button>}
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
                  <div title={o.service} className="text-[13px] desktop:text-[15px] font-semibold overflow-hidden text-ellipsis whitespace-nowrap max-md:whitespace-normal max-md:line-clamp-2 max-md:[display:-webkit-box] max-md:[-webkit-box-orient:vertical]" style={{ color: t.text }}>{o.service}</div>
                  {(o.tierLabel || o.offerDisabled) && (
                    <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                      {o.tierLabel && <span className="text-[11px] desktop:text-xs font-medium" style={{ color: t.accent }}>{o.tierLabel}</span>}
                      {o.offerDisabled && <span className="inline-flex items-center rounded-full py-px px-1.5 text-[9px] desktop:text-[10px] font-semibold uppercase tracking-[0.4px]" style={{ background: dark ? "rgba(252,165,165,.12)" : "rgba(220,38,38,.07)", color: dark ? "#fca5a5" : "#dc2626", border: `1px solid ${dark ? "rgba(252,165,165,.2)" : "rgba(220,38,38,.12)"}` }}>Disabled</span>}
                    </div>
                  )}
                  <div className="flex items-center gap-1.5 text-[10px] desktop:text-[11px] mt-0.5 flex-wrap" style={{ color: t.textMuted }}>
                    <span>{o.created ? fD(o.created, true) : ""}</span>
                    <span className="w-[3px] h-[3px] rounded-full bg-current opacity-30 shrink-0" />
                    <span>{o.user}</span>
                  </div>
                </div>
                {(o.status === "Processing" || o.status === "Pending") && <span className="w-[7px] h-[7px] rounded-full shrink-0" style={{ background: sClr(o.status, dark), animation: "progress-pulse 2.8s ease-in-out infinite" }} />}
                <div className="text-right shrink-0">
                  <div className="m text-[13px] desktop:text-[15px] font-bold" style={{ color: o.status === "Cancelled" ? (dark ? "#fca5a5" : "#dc2626") : o.status === "Partial" ? (dark ? "#fbbf24" : "#d97706") : (dark ? "#6ee7b7" : "#059669") }}>{o.status === "Cancelled" ? "-" : "+"}{fN(o.charge)}</div>
                </div>
                <svg className="shrink-0 ml-0.5" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={t.textMuted} strokeWidth="2" strokeLinecap="round" style={{ transform: expanded === o.id ? "rotate(180deg)" : "rotate(0)", transition: "transform .2s" }}><polyline points="6 9 12 15 18 9"/></svg>
              </div>
              {expanded === o.id && (
                <div className="py-3.5 px-3.5 desktop:py-4 desktop:px-5" style={{ background: dark ? "rgba(196,125,142,.05)" : "rgba(196,125,142,.04)", borderTop: `1px solid ${dark ? "rgba(196,125,142,.2)" : "rgba(196,125,142,.15)"}`, ...((o.status === "Processing" || o.status === "Pending") ? { borderBottom: `3px solid ${dark ? "rgba(196,125,142,.25)" : "rgba(196,125,142,.2)"}`, borderLeft: `3px solid ${t.accent}` } : {}) }}>
                  {/* User header */}
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-[12px] font-bold shrink-0" style={{ background: `${t.accent}20`, color: t.accent }}>{(o.user || "?")[0].toUpperCase()}</div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[14px] font-semibold" style={{ color: t.text }}>{o.user}</div>
                      <div className="text-[12px]" style={{ color: t.textMuted }}>{o.email}</div>
                    </div>
                    <div className="text-[12px] text-right shrink-0" style={{ color: t.textMuted }}>{o.created ? fT(o.created) : ""}</div>
                  </div>

                  {/* Link */}
                  {o.link && (
                    <div className="mb-3 py-2 px-2.5 rounded-lg flex items-center gap-2 min-w-0 max-w-full overflow-hidden" style={{ background: dark ? "rgba(255,255,255,.05)" : "rgba(0,0,0,.025)", border: `1px solid ${dark ? "rgba(255,255,255,.1)" : "rgba(0,0,0,.06)"}` }}>
                      <div className="w-6 h-6 rounded-md flex items-center justify-center shrink-0" style={{ background: dark ? "rgba(255,255,255,.08)" : "rgba(0,0,0,.04)", color: t.textMuted }}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/></svg>
                      </div>
                      <a href={o.link} target="_blank" rel="noopener noreferrer" title={o.link} className="m min-w-0 flex-1 text-[12px] desktop:text-[13px] leading-[1.45] overflow-hidden text-ellipsis whitespace-nowrap no-underline" style={{ color: t.textSoft }}>{o.link}</a>
                      {!o.apiOrderId && o.status !== "Cancelled" && <button onClick={() => openEditLink(o)} className="shrink-0 w-6 h-6 rounded-md flex items-center justify-center cursor-pointer border-none" style={{ background: dark ? "rgba(255,255,255,.08)" : "rgba(0,0,0,.04)", color: t.textMuted }} title="Edit link"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>}
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
                    const isPartial = o.status === "Partial";
                    const barColor = isCancelled ? (dark ? "#666" : "#999") : isComplete ? (dark ? "#6ee7b7" : "#059669") : isPartial ? (dark ? "#fbbf24" : "#d97706") : "#c47d8e";
                    const waiting = !isCancelled && !hasData && !isComplete && (o.status === "Pending" || o.status === "Processing");
                    const queued = !!o.queuedBehind;
                    const isProcessing = !isComplete && !isPartial && !isCancelled && !waiting && pct > 0 && pct < 100;
                    return (
                      <div className="mb-3 py-2 px-3 rounded-lg" style={{ background: dark ? "rgba(255,255,255,.05)" : "rgba(0,0,0,.02)", border: `1px solid ${dark ? "rgba(255,255,255,.08)" : "rgba(0,0,0,.04)"}` }}>
                        <div className="flex items-center justify-between text-[12px] mb-1.5">
                          <span style={{ color: t.textMuted }}>{isCancelled ? "Cancelled" : queued ? `Queued behind ${o.queuedBehind}` : waiting ? "Waiting to start" : "Delivered"}</span>
                          {!waiting && <span className="m font-semibold" style={{ color: barColor }}>{delivered.toLocaleString()} / {qty.toLocaleString()}</span>}
                        </div>
                        <div className="h-1.5 rounded-full overflow-hidden" style={{ background: dark ? "rgba(255,255,255,.14)" : "rgba(0,0,0,.08)" }}>
                          {waiting
                            ? <div className="h-full rounded-full" style={{ background: `repeating-linear-gradient(-55deg, ${dark ? "rgba(255,255,255,.22)" : "rgba(0,0,0,.16)"}, ${dark ? "rgba(255,255,255,.22)" : "rgba(0,0,0,.16)"} 6px, ${dark ? "rgba(255,255,255,.06)" : "rgba(0,0,0,.04)"} 6px, ${dark ? "rgba(255,255,255,.06)" : "rgba(0,0,0,.04)"} 12px)`, backgroundSize: "28px 100%", animation: "progress-stripe .8s linear infinite" }} />
                            : <div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${pct}%`, background: barColor, ...(isProcessing ? { animation: "progress-pulse 2.8s ease-in-out infinite" } : {}) }} />}
                        </div>
                      </div>
                    );
                  })()}

                  {/* Error / cancel info */}
                  {o.lastError && (() => {
                    const ei = errInfo(o.lastError, o.retryCount);
                    const colors = { neutral: { bg: dark ? "rgba(161,161,170,.08)" : "rgba(113,113,122,.04)", brd: dark ? "rgba(161,161,170,.18)" : "rgba(113,113,122,.12)", clr: dark ? "#a1a1aa" : "#71717a" }, warn: { bg: dark ? "rgba(251,191,36,.08)" : "rgba(217,119,6,.04)", brd: dark ? "rgba(251,191,36,.18)" : "rgba(217,119,6,.12)", clr: dark ? "#fbbf24" : "#d97706" }, error: { bg: dark ? "rgba(252,165,165,.08)" : "rgba(220,38,38,.04)", brd: dark ? "rgba(252,165,165,.18)" : "rgba(220,38,38,.12)", clr: dark ? "#fca5a5" : "#dc2626" } }[ei.tone];
                    return (
                    <div className="mb-3 py-2 px-3 rounded-lg flex items-start gap-2" style={{ background: colors.bg, border: `1px solid ${colors.brd}` }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={colors.clr} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 mt-0.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                      <div className="min-w-0">
                        <div className="text-[11px] font-semibold uppercase tracking-[0.5px] mb-0.5" style={{ color: colors.clr }}>{ei.label}</div>
                        {ei.detail && <div className="text-[12px] break-all" style={{ color: colors.clr, opacity: .8 }}>{ei.detail}</div>}
                      </div>
                    </div>);
                  })()}

                  {/* Details grid */}
                  {(() => { const isPartial = o.status === "Partial" && o.remains > 0 && o.quantity > 0; const delivered = isPartial ? o.quantity - o.remains : o.quantity; const ratio = isPartial ? delivered / o.quantity : 1; const netCharge = isPartial ? Math.round(o.charge * ratio) : o.charge; const netCost = isPartial ? Math.round((o.cost || 0) * ratio) : (o.cost || 0); const profit = netCharge - netCost; const margin = netCost > 0 ? Math.round(profit / netCost * 100) : 0; return (
                  <div className="grid grid-cols-2 desktop:grid-cols-4 gap-2 mb-3">
                    <div className="py-2 px-2.5 rounded-lg text-center" style={{ background: dark ? "rgba(255,255,255,.07)" : "rgba(0,0,0,.03)", border: `1px solid ${dark ? "rgba(255,255,255,.12)" : "rgba(0,0,0,.06)"}` }}>
                      <div className="text-[11px] uppercase tracking-[1px] mb-1" style={{ color: t.textMuted }}>{o.status === "Cancelled" ? "Refunded" : isPartial ? "Net Charge" : "Charge"}</div>
                      <div className="m text-sm font-bold" style={{ color: o.status === "Cancelled" ? (dark ? "#fca5a5" : "#dc2626") : (dark ? "#6ee7b7" : "#059669") }}>{o.status === "Cancelled" ? "-" : "+"}{fN(netCharge)}</div>
                    </div>
                    <div className="py-2 px-2.5 rounded-lg text-center" style={{ background: dark ? "rgba(255,255,255,.07)" : "rgba(0,0,0,.03)", border: `1px solid ${dark ? "rgba(255,255,255,.12)" : "rgba(0,0,0,.06)"}` }}>
                      <div className="text-[11px] uppercase tracking-[1px] mb-1" style={{ color: t.textMuted }}>Cost</div>
                      <div className="m text-sm font-bold" style={{ color: t.textSoft }}>{fN(o.status === "Cancelled" ? 0 : netCost)}</div>
                    </div>
                    <div className="py-2 px-2.5 rounded-lg text-center" style={{ background: dark ? "rgba(255,255,255,.07)" : "rgba(0,0,0,.03)", border: `1px solid ${dark ? "rgba(255,255,255,.12)" : "rgba(0,0,0,.06)"}` }}>
                      <div className="text-[11px] uppercase tracking-[1px] mb-1" style={{ color: t.textMuted }}>Profit</div>
                      <div className="m text-sm font-bold" style={{ color: o.status === "Cancelled" ? t.textMuted : profit < 0 ? (dark ? "#fca5a5" : "#dc2626") : (dark ? "#6ee7b7" : "#059669") }}>{o.status === "Cancelled" ? fN(0) : fN(profit)}{o.status !== "Cancelled" && <span className="inline-flex items-center ml-1.5 text-[10px] font-semibold py-[1px] px-1.5 rounded-md" style={{ background: profit < 0 ? (dark ? "rgba(252,165,165,.12)" : "rgba(220,38,38,.08)") : (dark ? "rgba(110,231,183,.12)" : "rgba(5,150,105,.08)"), color: profit < 0 ? (dark ? "#fca5a5" : "#dc2626") : (dark ? "#6ee7b7" : "#059669") }}>{margin}%</span>}</div>
                    </div>
                    <div className="py-2 px-2.5 rounded-lg text-center" style={{ background: dark ? "rgba(255,255,255,.07)" : "rgba(0,0,0,.03)", border: `1px solid ${dark ? "rgba(255,255,255,.12)" : "rgba(0,0,0,.06)"}` }}>
                      <div className="text-[11px] uppercase tracking-[1px] mb-1" style={{ color: t.textMuted }}>Order No</div>
                      <CopyId value={o.id} dark={dark} />
                      {o.parentOrderId && <button onClick={() => setSearch(o.parentOrderId)} className="mt-1 text-[10px] font-semibold cursor-pointer border-none rounded px-1.5 py-0.5" style={{ background: dark ? "rgba(165,180,252,.12)" : "rgba(79,70,229,.07)", color: dark ? "#a5b4fc" : "#4f46e5" }}>From {o.parentOrderId}</button>}
                      {o.childOrderId && <button onClick={() => setSearch(o.childOrderId)} className="mt-1 text-[10px] font-semibold cursor-pointer border-none rounded px-1.5 py-0.5" style={{ background: dark ? "rgba(252,211,77,.12)" : "rgba(217,119,6,.07)", color: dark ? "#fcd34d" : "#d97706" }}>&rarr; {o.childOrderId}</button>}
                    </div>
                    <div className="py-2 px-2.5 rounded-lg text-center" style={{ background: dark ? "rgba(255,255,255,.07)" : "rgba(0,0,0,.03)", border: `1px solid ${dark ? "rgba(255,255,255,.12)" : "rgba(0,0,0,.06)"}` }}>
                      <div className="text-[11px] uppercase tracking-[1px] mb-1" style={{ color: t.textMuted }}>Quantity</div>
                      <div className="m text-sm font-semibold" style={{ color: t.text }}>{(o.quantity || 0).toLocaleString()}</div>
                    </div>
                    <div className="py-2 px-2.5 rounded-lg text-center" style={{ background: dark ? "rgba(255,255,255,.07)" : "rgba(0,0,0,.03)", border: `1px solid ${dark ? "rgba(255,255,255,.12)" : "rgba(0,0,0,.06)"}` }}>
                      <div className="text-[11px] uppercase tracking-[1px] mb-1" style={{ color: t.textMuted }}>Provider</div>
                      <div className="m text-sm font-bold" style={{ color: t.text }}>{{ mtp: "MTP", daosmm: "DaoSMM" }[o.provider] || (o.provider || "mtp").toUpperCase()}</div>
                    </div>
                    {o.serviceApiId && <div className="py-2 px-2.5 rounded-lg text-center" style={{ background: dark ? "rgba(255,255,255,.07)" : "rgba(0,0,0,.03)", border: `1px solid ${dark ? "rgba(255,255,255,.12)" : "rgba(0,0,0,.06)"}` }}>
                      <div className="text-[11px] uppercase tracking-[1px] mb-1" style={{ color: t.textMuted }}>Service ID</div>
                      <CopyId value={o.serviceApiId} dark={dark} />
                    </div>}
                    {o.apiOrderId && <div className="py-2 px-2.5 rounded-lg text-center" style={{ background: dark ? "rgba(255,255,255,.07)" : "rgba(0,0,0,.03)", border: `1px solid ${dark ? "rgba(255,255,255,.12)" : "rgba(0,0,0,.06)"}` }}>
                      <div className="text-[11px] uppercase tracking-[1px] mb-1" style={{ color: t.textMuted }}>Provider Order</div>
                      <CopyId value={o.apiOrderId} dark={dark} />
                    </div>}
                    {o.startCount != null && <div className="py-2 px-2.5 rounded-lg text-center" style={{ background: dark ? "rgba(255,255,255,.07)" : "rgba(0,0,0,.03)", border: `1px solid ${dark ? "rgba(255,255,255,.12)" : "rgba(0,0,0,.06)"}` }}>
                      <div className="text-[11px] uppercase tracking-[1px] mb-1" style={{ color: t.textMuted }}>Start Count</div>
                      <div className="m text-sm font-semibold" style={{ color: t.text }}>{o.startCount.toLocaleString()}</div>
                    </div>}
                    {(() => { const est = estimateDelivery(o.serviceType, o.quantity, o.remains, o.dripEndAt); if (!est || o.status === "Completed" || o.status === "Cancelled") return null; return (
                    <div className="py-2 px-2.5 rounded-lg text-center" style={{ background: dark ? "rgba(196,125,142,.1)" : "rgba(196,125,142,.05)", border: `1px solid ${dark ? "rgba(196,125,142,.2)" : "rgba(196,125,142,.12)"}` }}>
                      <div className="text-[11px] uppercase tracking-[1px] mb-1" style={{ color: t.textMuted }}>Est. Time</div>
                      <div className="m text-sm font-semibold flex items-center justify-center gap-1" style={{ color: t.accent }}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                        {est}
                      </div>
                    </div>); })()}
                  </div>); })()}

                  {/* Drip dispatches */}
                  {o.dripDispatches && <DripSection dispatches={o.dripDispatches} dripConfig={o.dripConfig} dark={dark} t={t} />}

                  {/* Actions */}
                  <div className="flex items-center gap-2 flex-wrap py-1.5 px-1">
                    {needsDispatch(o) && <button onClick={async () => { const ok = await confirm({ title: "Manual Dispatch", message: `Dispatch order ${o.id} to provider now?`, confirmLabel: "Dispatch" }); if (ok) doAction(o.id, "dispatch"); }} disabled={!!actionLoading} className="m flex items-center gap-1.5 text-[12px] font-semibold cursor-pointer border-none rounded-lg py-1.5 px-2.5" style={{ background: dark ? "rgba(252,211,77,.12)" : "rgba(217,119,6,.07)", color: dark ? "#fcd34d" : "#d97706" }}>{actionLoading === o.id ? <Spinner size={14} color={dark ? "#fcd34d" : "#d97706"} /> : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>}Dispatch</button>}
                    <button onClick={() => doAction(o.id, "check")} disabled={actionLoading === o.id} className="m flex items-center gap-1.5 text-[12px] font-semibold cursor-pointer border-none rounded-lg py-1.5 px-2.5" style={{ background: dark ? "rgba(165,180,252,.12)" : "rgba(79,70,229,.07)", color: dark ? "#a5b4fc" : "#4f46e5" }}>{actionLoading === o.id ? <Spinner size={14} color={dark ? "#a5b4fc" : "#4f46e5"} /> : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>}Check</button>
                    {!["Cancelled", "Completed", "Partial"].includes(o.status) && <button onClick={() => openCancel(o)} disabled={!!actionLoading} className="m flex items-center gap-1.5 text-[12px] font-semibold cursor-pointer border-none rounded-lg py-1.5 px-2.5" style={{ background: dark ? "rgba(252,165,165,.1)" : "rgba(220,38,38,.06)", color: dark ? "#fca5a5" : "#dc2626" }}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>Cancel</button>}
                    {o.status === "Cancelled" && o.lastError !== "user_cancelled" && !o.redispatchedAt && <button onClick={() => openRedispatch(o)} disabled={!!actionLoading} className="m flex items-center gap-1.5 text-[12px] font-semibold cursor-pointer border-none rounded-lg py-1.5 px-2.5" style={{ background: dark ? "rgba(252,211,77,.12)" : "rgba(217,119,6,.07)", color: dark ? "#fcd34d" : "#d97706" }}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/></svg>Re-dispatch</button>}
                    {o.status === "Completed" && <button onClick={async () => { const ok = await confirm({ title: "Refill Order", message: `Request a refill for order ${o.id}?`, confirmLabel: "Refill" }); if (ok) doAction(o.id, "refill"); }} disabled={!!actionLoading} className="m flex items-center gap-1.5 text-[12px] font-semibold cursor-pointer border-none rounded-lg py-1.5 px-2.5" style={{ background: dark ? "rgba(196,125,142,.12)" : "rgba(196,125,142,.07)", color: t.accent }}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 102.13-9.36L1 10"/></svg>Refill</button>}
                    {(o.status === "Completed" || o.status === "Partial") && <button onClick={() => openRefund(o)} className="m flex items-center gap-1.5 text-[12px] font-semibold cursor-pointer border-none rounded-lg py-1.5 px-2.5" style={{ background: dark ? "rgba(251,191,36,.1)" : "rgba(217,119,6,.06)", color: dark ? "#fbbf24" : "#c2710a" }}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 14 4 9 9 4"/><path d="M20 20v-7a4 4 0 00-4-4H4"/></svg>{o.refundedTotal >= o.charge ? "Fully Refunded" : o.refundedTotal > 0 ? `Refund (${Math.round(o.refundedTotal / o.charge * 100)}%)` : "Refund"}</button>}
                    {o.phone ? <a href={`https://wa.me/${o.phone.replace(/\D/g,"")}?text=${encodeURIComponent(`Hi ${(o.user||"").split(" ")[0]||"there"}, this is Nitro Support.\n\nRegarding your order ${o.id} (${o.service} x ${o.quantity}):\n\n`)}`} target="_blank" rel="noopener noreferrer" className="m flex items-center gap-1.5 text-[12px] font-semibold cursor-pointer no-underline border-none rounded-lg py-1.5 px-2.5" style={{ background: dark ? "rgba(37,211,102,.12)" : "rgba(37,211,102,.07)", color: "#25d366" }}><svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>WhatsApp</a> : <button onClick={() => toast.info("No WhatsApp", `${o.user} hasn't added their number yet`)} className="m flex items-center gap-1.5 text-[12px] font-semibold cursor-pointer border-none rounded-lg py-1.5 px-2.5 opacity-40" style={{ color: "#25d366" }}><svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>WhatsApp</button>}
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
            {search || filter !== "all" ? (<>
              <div className="text-base font-semibold mb-1" style={{ color: t.textSoft }}>No matching orders</div>
              <div className="text-sm mb-3" style={{ color: t.textMuted }}>Try adjusting your search or filter</div>
              <button onClick={() => { setSearch(""); setFilter("all"); setPage(1); }} className="text-xs font-semibold px-4 py-1.5 rounded-full cursor-pointer border-none" style={{ background: dark ? "rgba(196,125,142,.15)" : "rgba(196,125,142,.1)", color: t.accent }}>Clear filters</button>
            </>) : (<>
              <div className="text-base font-semibold mb-1" style={{ color: t.textSoft }}>No orders yet</div>
              <div className="text-sm" style={{ color: t.textMuted }}>Orders will appear here once placed</div>
            </>)}
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

      {cancelPrompt && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center" style={{ background: "rgba(0,0,0,.5)" }} onClick={() => setCancelPrompt(null)}>
          <div className="w-full max-w-[400px] mx-4 rounded-xl p-5" style={{ background: dark ? "#1e1e1e" : "#fff", border: `1px solid ${t.cardBorder}` }} onClick={e => e.stopPropagation()}>
            <div className="text-[15px] font-semibold mb-1" style={{ color: t.text }}>Cancel order {cancelPrompt.id}</div>
            <div className="text-[12px] mb-4" style={{ color: t.textMuted }}>Customer: {cancelPrompt.user} · Charged: {fN(cancelPrompt.charge)}</div>
            <div className="mb-4">
              <label className="text-[11px] uppercase tracking-[1px] block mb-1.5" style={{ color: t.textMuted }}>Reason (optional)</label>
              <textarea value={cancelNote} onChange={e => setCancelNote(e.target.value)} rows={3} className="w-full rounded-lg py-2.5 px-3 text-sm outline-none resize-none" style={{ background: dark ? "rgba(255,255,255,.06)" : "rgba(0,0,0,.03)", border: `1px solid ${dark ? "rgba(255,255,255,.12)" : "rgba(0,0,0,.08)"}`, color: t.text, fontFamily: "inherit" }} placeholder="e.g. Wrong link format, user requested..." autoFocus />
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setCancelPrompt(null)} className="py-2 px-4 rounded-lg text-sm font-medium cursor-pointer border-none" style={{ background: dark ? "rgba(255,255,255,.08)" : "rgba(0,0,0,.05)", color: t.textSoft }}>Back</button>
              <button onClick={doCancel} disabled={cancelSending} className="py-2 px-4 rounded-lg text-sm font-semibold cursor-pointer border-none transition-all duration-200 hover:-translate-y-px" style={{ background: dark ? "rgba(252,165,165,.2)" : "rgba(220,38,38,.12)", color: dark ? "#fca5a5" : "#dc2626", opacity: cancelSending ? .5 : 1 }}>{cancelSending ? "Cancelling..." : "Cancel Order"}</button>
            </div>
          </div>
        </div>
      )}

      {refundPrompt && (() => {
        const alreadyRefunded = refundPrompt.refundedTotal || 0;
        const remaining = Math.max(0, refundPrompt.charge - alreadyRefunded);
        const refundPctOf = (pct) => pct === 100 ? remaining : Math.round(remaining * pct / 100 * 100) / 100;
        const amber = dark ? "#fbbf24" : "#c2710a";
        const amberBg = dark ? "rgba(251,191,36,.10)" : "rgba(217,119,6,.08)";
        const amberBrd = dark ? "rgba(251,191,36,.32)" : "rgba(217,119,6,.30)";
        const optBrd = dark ? "rgba(255,255,255,.12)" : "rgba(0,0,0,.10)";
        const confirmGreen = dark ? "#10b981" : "#059669";
        return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center" style={{ background: dark ? "rgba(4,6,12,.55)" : "rgba(20,20,28,.42)", backdropFilter: "blur(3px)" }} onClick={() => setRefundPrompt(null)}>
          <div className="w-full max-w-[400px] mx-4 rounded-[20px] p-[26px]" style={{ background: dark ? "#0f1322" : "#fff", border: `1px solid ${dark ? "rgba(255,255,255,.12)" : "rgba(0,0,0,.06)"}`, boxShadow: dark ? "0 30px 70px -20px rgba(0,0,0,.7)" : "0 30px 70px -24px rgba(0,0,0,.34)" }} onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-1">
              <span className="w-[34px] h-[34px] rounded-[11px] grid place-items-center shrink-0" style={{ background: amberBg, color: amber }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 14 4 9 9 4"/><path d="M20 20v-7a4 4 0 00-4-4H4"/></svg>
              </span>
              <div className="text-[18px] font-semibold" style={{ color: t.text, letterSpacing: "-.2px" }}>Refund order <span className="font-mono">{refundPrompt.id}</span></div>
            </div>
            <div className="text-[13.5px] mb-5" style={{ color: t.textMuted, marginLeft: 46 }}>{refundPrompt.user} · Charged <span className="font-semibold font-mono" style={{ color: t.textSoft }}>{fN(refundPrompt.charge)}</span></div>

            {alreadyRefunded > 0 && (
              <div className="text-[12px] py-2 px-3 rounded-[14px] mb-4 flex items-center gap-1.5" style={{ background: amberBg, border: `1px solid ${amberBrd}`, color: amber }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                {fN(alreadyRefunded)} already refunded · {fN(remaining)} remaining
              </div>
            )}

            <div className="grid grid-cols-3 gap-2.5 mb-4">
              {[25, 50, 100].map(pct => {
                const amt = refundPctOf(pct);
                const disabled = amt <= 0 || amt > remaining + 0.01;
                const active = refundPercent === pct && !disabled;
                return (
                  <button key={pct} onClick={() => !disabled && setRefundPercent(pct)} disabled={disabled} className="relative py-[18px] px-2.5 rounded-[14px] text-center cursor-pointer transition-all duration-150" style={{ border: `1.5px solid ${active ? amberBrd : optBrd}`, background: active ? amberBg : "transparent", opacity: disabled ? .4 : 1, cursor: disabled ? "not-allowed" : "pointer" }}>
                    {active && <span className="absolute top-2 right-2 w-[15px] h-[15px] rounded-full grid place-items-center" style={{ background: amber, color: dark ? "#2a1c00" : "#fff" }}><svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg></span>}
                    <div className="text-[18px] font-semibold leading-none" style={{ color: active ? amber : disabled ? (dark ? "rgba(255,255,255,.2)" : "rgba(0,0,0,.15)") : t.text }}>{pct === 100 ? "Full" : `${pct}%`}</div>
                  </button>
                );
              })}
            </div>

            <div className="rounded-[14px] py-4 px-4 text-center mb-5" style={{ background: amberBg, border: `1px solid ${amberBrd}` }}>
              <div className="text-[10.5px] font-semibold uppercase tracking-[2px] mb-2" style={{ color: t.textMuted }}>Refund amount</div>
              <div className="font-mono text-[30px] font-bold leading-none" style={{ color: amber, letterSpacing: "-.5px" }}>{fN(refundPctOf(refundPercent))}</div>
            </div>

            <div className="flex gap-2.5">
              <button onClick={() => setRefundPrompt(null)} className="flex-1 py-3 px-5 rounded-[11px] text-sm font-semibold cursor-pointer transition-all duration-150 hover:-translate-y-px" style={{ background: dark ? "rgba(252,165,165,.10)" : "rgba(220,38,38,.06)", border: `1px solid ${dark ? "rgba(252,165,165,.26)" : "rgba(220,38,38,.22)"}`, color: dark ? "#fca5a5" : "#dc2626" }}>Cancel</button>
              <button onClick={doRefund} disabled={refundSending || refundPctOf(refundPercent) <= 0} className="flex-1 py-3 px-5 rounded-[11px] text-sm font-semibold cursor-pointer border-none transition-all duration-150 hover:-translate-y-px" style={{ background: confirmGreen, color: dark ? "#04231a" : "#fff", boxShadow: dark ? "0 8px 22px -10px rgba(16,185,129,.5)" : "0 8px 22px -12px rgba(5,150,105,.55)", opacity: refundSending || refundPctOf(refundPercent) <= 0 ? .5 : 1 }}>{refundSending ? "Processing..." : "Confirm"}</button>
            </div>
          </div>
        </div>
        );
      })()}

      {redispatchPrompt && (() => {
        const rd = redispatchPrompt;
        const hasSwap = rd.tierServiceApiId && rd.tierServiceApiId !== rd.serviceApiId;
        return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center" style={{ background: "rgba(0,0,0,.5)" }} onClick={() => setRedispatchPrompt(null)}>
          <div className="w-full max-w-[400px] mx-4 rounded-xl p-5" style={{ background: dark ? "#1e1e1e" : "#fff", border: `1px solid ${t.cardBorder}` }} onClick={e => e.stopPropagation()}>
            <div className="text-[15px] font-semibold mb-1" style={{ color: t.text }}>Re-dispatch {rd.id}</div>
            <div className="text-[12px] mb-4" style={{ color: t.textMuted }}>Customer: {rd.user} · Qty: {(rd.quantity || 0).toLocaleString()}</div>
            <div className="mb-4">
              <label className="text-[11px] uppercase tracking-[1px] block mb-1.5" style={{ color: t.textMuted }}>Link</label>
              <input type="url" value={redispatchLink} onChange={e => setRedispatchLink(e.target.value)} className="w-full rounded-lg py-2.5 px-3 text-sm outline-none" style={{ background: dark ? "rgba(255,255,255,.06)" : "rgba(0,0,0,.03)", border: `1px solid ${dark ? "rgba(255,255,255,.12)" : "rgba(0,0,0,.08)"}`, color: t.text, fontFamily: "inherit" }} placeholder="https://..." autoFocus />
            </div>
            <div className="text-[11px] mb-4 py-2.5 px-3 rounded-lg flex flex-col gap-1.5" style={{ background: dark ? "rgba(252,211,77,.08)" : "rgba(217,119,6,.05)", color: dark ? "#fcd34d" : "#d97706" }}>
              <div>Creates a new order for remaining quantity</div>
              <div>Charges only if original was refunded</div>
              {hasSwap && (
                <div className="flex items-center gap-1.5"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 014-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 01-4 4H3"/></svg>Service <span className="font-mono font-semibold">{rd.serviceApiId}</span> → <span className="font-mono font-semibold">{rd.tierServiceApiId}</span></div>
              )}
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setRedispatchPrompt(null)} className="py-2 px-4 rounded-lg text-sm font-medium cursor-pointer border-none" style={{ background: dark ? "rgba(255,255,255,.08)" : "rgba(0,0,0,.05)", color: t.textSoft }}>Cancel</button>
              <button onClick={doRedispatch} disabled={redispatchSending || !redispatchLink.trim()} className="py-2 px-4 rounded-lg text-sm font-semibold cursor-pointer border-none transition-all duration-200 hover:-translate-y-px" style={{ background: dark ? "rgba(252,211,77,.2)" : "rgba(217,119,6,.12)", color: dark ? "#fcd34d" : "#d97706", opacity: redispatchSending || !redispatchLink.trim() ? .5 : 1 }}>{redispatchSending ? "Dispatching..." : "Re-dispatch"}</button>
            </div>
          </div>
        </div>
        );
      })()}

      {editLinkPrompt && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center" style={{ background: "rgba(0,0,0,.5)" }} onClick={() => setEditLinkPrompt(null)}>
          <div className="w-full max-w-[400px] mx-4 rounded-xl p-5" style={{ background: dark ? "#1e1e1e" : "#fff", border: `1px solid ${t.cardBorder}` }} onClick={e => e.stopPropagation()}>
            <div className="text-[15px] font-semibold mb-1" style={{ color: t.text }}>Edit Link — {editLinkPrompt.id}</div>
            <div className="text-[12px] mb-4" style={{ color: t.textMuted }}>Tracking params will be stripped automatically.</div>
            <div className="mb-4">
              <label className="text-[11px] uppercase tracking-[1px] block mb-1.5" style={{ color: t.textMuted }}>Link</label>
              <input type="url" value={editLinkValue} onChange={e => setEditLinkValue(e.target.value)} className="w-full rounded-lg py-2.5 px-3 text-sm outline-none" style={{ background: dark ? "rgba(255,255,255,.06)" : "rgba(0,0,0,.03)", border: `1px solid ${dark ? "rgba(255,255,255,.12)" : "rgba(0,0,0,.08)"}`, color: t.text, fontFamily: "inherit" }} placeholder="https://..." autoFocus />
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setEditLinkPrompt(null)} className="py-2 px-4 rounded-lg text-sm font-medium cursor-pointer border-none" style={{ background: dark ? "rgba(255,255,255,.08)" : "rgba(0,0,0,.05)", color: t.textSoft }}>Cancel</button>
              <button onClick={doEditLink} disabled={editLinkSending || !editLinkValue.trim()} className="py-2 px-4 rounded-lg text-sm font-semibold cursor-pointer border-none transition-all duration-200 hover:-translate-y-px" style={{ background: dark ? "rgba(196,125,142,.2)" : "rgba(196,125,142,.12)", color: dark ? "#e8a0b2" : "#c47d8e", opacity: editLinkSending || !editLinkValue.trim() ? .5 : 1 }}>{editLinkSending ? "Saving..." : "Save Link"}</button>
            </div>
          </div>
        </div>
      )}

    </>
  );
}
