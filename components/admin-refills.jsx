'use client';
import { useState, useEffect } from "react";
import { useToast } from "./toast";
import { fD } from "../lib/format";

function timeAgo(dateStr) {
  const ms = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function Spinner({ size = 14, color = "currentColor" }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className="animate-spin"><circle cx="12" cy="12" r="10" stroke={color} strokeWidth="3" strokeLinecap="round" opacity=".25" /><path d="M12 2a10 10 0 0 1 10 10" stroke={color} strokeWidth="3" strokeLinecap="round" /></svg>;
}

export default function AdminRefillsPage({ dark, t }) {
  const toast = useToast();
  const [refills, setRefills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);

  useEffect(() => {
    fetch("/api/admin/refills")
      .then(r => r.json())
      .then(d => { setRefills(d.refills || []); setLoading(false); })
      .catch(() => { toast.error("Failed to load refills"); setLoading(false); });
  }, []);

  const doAction = async (orderId, action) => {
    if (actionLoading) return;
    setActionLoading(orderId + action);
    try {
      const res = await fetch("/api/admin/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, action }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error("Action failed", data.error || "Something went wrong");
        return;
      }
      if (action === "reset_refill") {
        setRefills(prev => prev.filter(r => r.orderId !== orderId));
        toast.success("Refill reset", data.message || "User can request again");
      } else {
        toast.success("Refill sent", data.message || "Refill requested with provider");
      }
    } catch {
      toast.error("Request failed", "Check your connection");
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <>
      <div className="adm-header">
        <div className="adm-title text-t-text">Refills</div>
        <div className="adm-subtitle text-t-text-muted">Orders with pending refill requests</div>
        <div className="page-divider bg-t-card-border" />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Spinner size={20} color={t.accent} />
        </div>
      ) : refills.length === 0 ? (
        <div className="py-[60px] px-5 text-center">
          <svg width="48" height="48" viewBox="0 0 64 64" fill="none" style={{ display: "block", margin: "0 auto 14px", opacity: .7 }}>
            <circle cx="32" cy="32" r="22" stroke={t.accent} strokeWidth="1.5" opacity=".2" />
            <path d="M42 22a14 14 0 1 0 .5 17" stroke={t.accent} strokeWidth="1.5" opacity=".3" strokeLinecap="round" />
            <polyline points="42 17 42 23 36 23" stroke={t.accent} strokeWidth="2" opacity=".4" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M29 32l3 3 5-5" stroke={t.accent} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity=".3" />
          </svg>
          <div className="text-base font-semibold mb-1" style={{ color: t.textSoft }}>No pending refills</div>
          <div className="text-sm" style={{ color: t.textMuted }}>Refill requests from users will appear here</div>
        </div>
      ) : (
        <div className="rounded-[14px] overflow-hidden" style={{ background: dark ? "rgba(255,255,255,.07)" : "rgba(255,255,255,.85)", border: `1px solid ${dark ? "rgba(255,255,255,.12)" : "rgba(0,0,0,.08)"}` }}>
          {/* Header */}
          <div className="hidden md:grid grid-cols-[120px_1fr_1.5fr_90px_70px_100px_140px] gap-3 py-2.5 px-4 text-[11px] font-semibold uppercase tracking-wide text-t-text-muted" style={{ background: dark ? "rgba(196,125,142,.1)" : "rgba(196,125,142,.06)", borderBottom: `1px solid ${dark ? "rgba(255,255,255,.08)" : "rgba(0,0,0,.05)"}` }}>
            <span>Order ID</span>
            <span>User</span>
            <span>Service</span>
            <span>Status</span>
            <span>Qty</span>
            <span>Requested</span>
            <span>Actions</span>
          </div>

          {/* Rows */}
          {refills.map((r, i) => {
            const statusColor = r.status === "Completed" ? (dark ? "#6ee7b7" : "#059669")
              : r.status === "Processing" ? (dark ? "#a5b4fc" : "#4f46e5")
              : r.status === "Partial" ? (dark ? "#fdba74" : "#ea580c")
              : r.status === "Cancelled" ? (dark ? "#a1a1aa" : "#71717a")
              : (dark ? "#fcd34d" : "#d97706");
            const statusBg = r.status === "Completed" ? (dark ? "#0a2416" : "#ecfdf5")
              : r.status === "Processing" ? (dark ? "#0f1629" : "#eef2ff")
              : r.status === "Partial" ? (dark ? "#1c1008" : "#fff7ed")
              : r.status === "Cancelled" ? (dark ? "#1a1a1a" : "#f5f5f5")
              : (dark ? "#1c1608" : "#fffbeb");

            return (
              <div key={r.id} className="grid grid-cols-1 md:grid-cols-[120px_1fr_1.5fr_90px_70px_100px_140px] gap-1 md:gap-3 items-center py-3 px-4" style={{ borderTop: i > 0 ? `1px solid ${dark ? "rgba(255,255,255,.06)" : "rgba(0,0,0,.04)"}` : "none" }}>
                {/* Order ID */}
                <span className="text-[13px] font-semibold text-t-text" style={{ fontFamily: "var(--font-mono, monospace)" }}>{r.orderId}</span>

                {/* User */}
                <div className="min-w-0">
                  <div className="text-[13px] font-medium text-t-text truncate">{r.userName}</div>
                  <div className="text-[11px] text-t-text-muted truncate">{r.userEmail}</div>
                </div>

                {/* Service */}
                <div className="min-w-0">
                  <div className="text-[13px] text-t-text truncate">{r.serviceName}</div>
                  <div className="text-[11px] text-t-text-muted truncate">
                    {r.serviceCategory}{r.tierLabel ? ` · ${r.tierLabel}` : ""}
                  </div>
                </div>

                {/* Status */}
                <span className="inline-flex items-center">
                  <span className="py-0.5 px-2 rounded text-[11px] font-semibold" style={{ background: statusBg, color: statusColor }}>{r.status}</span>
                </span>

                {/* Qty */}
                <span className="text-[13px] font-medium text-t-text">{r.quantity?.toLocaleString()}</span>

                {/* Requested */}
                <span className="text-[12px] text-t-text-muted" title={r.refillRequestedAt ? fD(r.refillRequestedAt) : ""}>{r.refillRequestedAt ? timeAgo(r.refillRequestedAt) : ""}</span>

                {/* Actions */}
                <div className="flex items-center gap-1.5">
                  <button
                    disabled={!!actionLoading}
                    onClick={() => doAction(r.orderId, "refill")}
                    className="py-1 px-2.5 rounded-lg text-[11px] font-semibold cursor-pointer border-none transition-opacity disabled:opacity-40"
                    style={{ background: dark ? "rgba(110,231,183,.12)" : "rgba(5,150,105,.08)", color: dark ? "#6ee7b7" : "#059669" }}
                  >
                    {actionLoading === r.orderId + "refill" ? <Spinner size={12} /> : "Refill"}
                  </button>
                  <button
                    disabled={!!actionLoading}
                    onClick={() => doAction(r.orderId, "reset_refill")}
                    className="py-1 px-2.5 rounded-lg text-[11px] font-semibold cursor-pointer border-none transition-opacity disabled:opacity-40"
                    style={{ background: dark ? "rgba(224,164,88,.12)" : "rgba(217,119,6,.08)", color: dark ? "#e0a458" : "#d97706" }}
                  >
                    {actionLoading === r.orderId + "reset_refill" ? <Spinner size={12} /> : "Reset"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
