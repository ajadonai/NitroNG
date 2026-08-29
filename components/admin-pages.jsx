'use client';
import { useState, useEffect, useRef } from "react";
import { useConfirm } from "./confirm-dialog";
import { useToast } from "./toast";
import { fN, fD } from "../lib/format";
import { SegPill } from "./seg-pill";
import { DateRangePicker, FilterDropdown } from "./date-range-picker";
import { copyText } from '@/lib/clipboard';

const localDate = (d) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;

/* ═══════════════════════════════════════════ */
/* ═══ PAYMENTS PAGE                       ═══ */
/* ═══════════════════════════════════════════ */
export function AdminPaymentsPage({ dark, t }) {
  const toast = useToast();
  const confirm = useConfirm();
  const [tab, setTab] = useState("deposits");
  const [gateways, setGateways] = useState([]);
  const [deposits, setDeposits] = useState([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [configuring, setConfiguring] = useState(null);
  const [configFields, setConfigFields] = useState({});
  const [saving, setSaving] = useState(false);
  
  const [addModal, setAddModal] = useState(false);
  const [newGw, setNewGw] = useState({ id: "", name: "", desc: "" });
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("Pending");
  const [dateValue, setDateValue] = useState(null);
  const [canApprove, setCanApprove] = useState(false);
  const [canConfigure, setCanConfigure] = useState(false);

  const refresh = (s, st, dv) => {
    const params = new URLSearchParams();
    if (s || search) params.set("search", s ?? search);
    if ((st ?? statusFilter) !== "all") params.set("status", st ?? statusFilter);
    const range = dv !== undefined ? dv : dateValue;
    if (range?.start) params.set("from", localDate(range.start));
    if (range?.end) params.set("to", localDate(range.end));
    fetch(`/api/admin/payments?${params}`).then(r => r.json()).then(d => {
      if (d.gateways) setGateways(d.gateways);
      if (d.deposits) setDeposits(d.deposits);
      if (d.pendingCount != null) setPendingCount(d.pendingCount);
      if (d.canApprove != null) setCanApprove(d.canApprove);
      if (d.canConfigure != null) setCanConfigure(d.canConfigure);
      setLoading(false);
    }).catch(() => setLoading(false));
  };
  useEffect(() => { refresh(); }, []);
  useEffect(() => {
    if (tab !== "deposits") return;
    const interval = setInterval(() => refresh(), 30000);
    return () => clearInterval(interval);
  }, [tab, search, statusFilter, dateValue]);

  const doSearch = () => refresh(search, statusFilter);
  const changeStatus = (s) => { setStatusFilter(s); refresh(search, s); };
  const changeDateValue = (v) => { setDateValue(v); refresh(search, statusFilter, v); };

  const downloadCSV = () => {
    const rows = [["Date", "Reference", "User", "Email", "Amount", "Method", "Status", "Approved/Rejected By", "Sender Name"]];
    deposits.forEach(tx => rows.push([tx.date, tx.reference, tx.user, tx.email, tx.amount, tx.method, tx.status, tx.actionBy || "", tx.senderRef || ""]));
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `nitro-deposits-${new Date().toISOString().slice(0,10)}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const toggle = async (id, enabled) => {
    
    const res = await fetch("/api/admin/payments", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "toggle", gatewayId: id, enabled }) });
    if (res.ok) { refresh(); toast.success("Updated", `${id} ${enabled ? "enabled" : "disabled"}`); }
    else { const d = await res.json(); toast.error("Failed", d.error || "Failed"); }
  };

  const openConfig = (g) => {
    const fields = {};
    const defaultFields = { flutterwave: ["secretKey", "publicKey"], alatpay: ["secretKey", "publicKey"], monnify: ["apiKey", "secretKey", "contractCode"], korapay: ["secretKey", "publicKey"], crypto: ["apiKey"], manual: ["bankName", "accountNumber", "accountName"] };
    (defaultFields[g.id] || ["secretKey", "publicKey"]).forEach(k => { fields[k] = ""; });
    setConfigFields(fields);
    setConfiguring(g);
  };

  const reorder = async (idx, dir) => {
    const swapIdx = idx + dir;
    if (swapIdx < 0 || swapIdx >= gateways.length) return;
    const a = gateways[idx], b = gateways[swapIdx];
    const res = await fetch("/api/admin/payments", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "reorder", moves: [{ id: a.id, priority: swapIdx + 1 }, { id: b.id, priority: idx + 1 }] }) });
    if (res.ok) refresh();
    else { const d = await res.json(); toast.error("Failed", d.error || "Reorder failed"); }
  };

  const saveConfig = async () => {
    if (!configuring) return;
    const nonEmpty = Object.fromEntries(Object.entries(configFields).filter(([, v]) => v.trim()));
    if (Object.keys(nonEmpty).length === 0) { toast.error("Missing fields", "Enter at least one field"); return; }
    setSaving(true);
    const res = await fetch("/api/admin/payments", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "configure", gatewayId: configuring.id, fields: nonEmpty }) });
    if (res.ok) { toast.success("Saved", `${configuring.name} saved`); setConfiguring(null); refresh(); }
    else { const d = await res.json(); toast.error("Save failed", d.error || "Save failed"); }
    setSaving(false);
  };

  const approveManual = async (tx) => {
    const ok = await confirm({
      title: "Approve deposit?",
      body: (
        <div className="text-left mb-5 text-sm leading-[1.65]" style={{ color: dark ? "#a09b95" : "#555250" }}>
          <div className="mb-2">Credit <strong style={{ color: dark ? "#6ee7b7" : "#059669" }}>₦{tx.amount.toLocaleString()}</strong> to <strong style={{ color: dark ? "#f5f3f0" : "#1a1917" }}>{tx.user}</strong></div>
          {tx.senderRef && (
            <div className="py-2 px-3 rounded-lg mb-2" style={{ background: dark ? "rgba(196,125,142,.1)" : "rgba(196,125,142,.06)", border: `1px solid ${dark ? "rgba(196,125,142,.25)" : "rgba(196,125,142,.15)"}` }}>
              <div className="text-[10px] uppercase tracking-[1px] font-semibold mb-0.5" style={{ color: dark ? "#c47d8e" : "#9b5a6a" }}>Sender Name</div>
              <div className="text-[15px] font-bold" style={{ color: dark ? "#f5f3f0" : "#1a1917", textTransform: "capitalize" }}>{tx.senderRef.toLowerCase()}</div>
            </div>
          )}
          <div className="text-xs" style={{ color: dark ? "#666" : "#999" }}>Ref: {tx.reference}</div>
          {tx.senderRef && <div className="text-[11px] mt-1.5" style={{ color: dark ? "#fbbf24" : "#d97706" }}>Verify this matches the sender on your bank statement</div>}
        </div>
      ),
      confirmLabel: "Approve",
      danger: false,
    });
    if (!ok) return;
    const res = await fetch("/api/admin/payments", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "approve_manual", gatewayId: tx.id }) });
    if (res.ok) { toast.success("Approved", `₦${tx.amount.toLocaleString()} approved for ${tx.user}`); refresh(); }
    else { const d = await res.json(); toast.error("Failed", d.error || "Failed"); }
  };

  const rejectManual = async (tx) => {
    const ok = await confirm({ title: "Reject deposit?", message: `Reject ₦${tx.amount.toLocaleString()} from ${tx.user}? This cannot be undone.`, confirmText: "Reject", danger: true });
    if (!ok) return;
    const res = await fetch("/api/admin/payments", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "reject_manual", gatewayId: tx.id }) });
    if (res.ok) { toast.success("Rejected", "Deposit rejected"); refresh(); }
    else { const d = await res.json(); toast.error("Failed", d.error || "Failed"); }
  };

  const FIELD_LABELS = { secretKey: "Secret Key", publicKey: "Public Key", apiKey: "API Key", contractCode: "Contract Code", bankName: "Bank Name", accountNumber: "Account Number", accountName: "Account Name" };
  const statusColors = { Pending: { bg: dark ? "rgba(251,191,36,.08)" : "rgba(217,119,6,.04)", color: dark ? "#fbbf24" : "#d97706" }, Processing: { bg: dark ? "rgba(165,180,252,.08)" : "rgba(79,70,229,.04)", color: dark ? "#a5b4fc" : "#4f46e5" }, Completed: { bg: dark ? "rgba(110,231,183,.08)" : "rgba(5,150,105,.04)", color: dark ? "#6ee7b7" : "#059669" }, Failed: { bg: dark ? "rgba(220,38,38,.08)" : "rgba(220,38,38,.04)", color: dark ? "#fca5a5" : "#dc2626" }, Rejected: { bg: dark ? "rgba(220,38,38,.08)" : "rgba(220,38,38,.04)", color: dark ? "#fca5a5" : "#dc2626" }, Cancelled: { bg: dark ? "rgba(220,38,38,.08)" : "rgba(220,38,38,.04)", color: dark ? "#fca5a5" : "#dc2626" } };

  return (
    <>
      <div className="adm-header">
        <div className="adm-header-row">
          <div>
            <div className="adm-title" style={{ color: t.text }}>Payments</div>
            <div className="adm-subtitle" style={{ color: t.textMuted }}>Manage deposits and payment gateways</div>
          </div>
          <SegPill value={tab} options={[{value: "deposits", label: `Deposits${pendingCount > 0 ? ` (${pendingCount})` : ""}`}, ...(canConfigure ? [{value: "gateways", label: "Gateway Config"}] : [])]} onChange={setTab} dark={dark} t={t} />
        </div>
        <div className="page-divider" style={{ background: t.cardBorder }} />
      </div>


      {/* ═══ DEPOSITS TAB ═══ */}
      {tab === "deposits" && (<>
        {/* Search + filters */}
        <div className="flex items-center gap-3 mb-3.5 flex-wrap">
          <div className="relative flex-1 min-w-full desktop:min-w-[200px]">
            <input value={search} onChange={e => setSearch(e.target.value)} onKeyDown={e => e.key === "Enter" && doSearch()} placeholder="Search ref, user, email, sender name..." className="w-full py-2 px-3 pr-8 rounded-lg text-[13px] outline-none font-[inherit] box-border" style={{ border: `1px solid ${t.cardBorder}`, background: dark ? "rgba(255,255,255,.12)" : "#fff", color: t.text }} />
            {search && <button aria-label="Clear search" onClick={() => { setSearch(""); refresh("", statusFilter); }} className="absolute right-2.5 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center rounded-full text-xs cursor-pointer border-none" style={{ background: dark ? "rgba(255,255,255,.18)" : "rgba(0,0,0,.14)", color: t.textMuted }}><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>}
          </div>
          <DateRangePicker dark={dark} t={t} value={dateValue} onChange={changeDateValue} />
          <FilterDropdown dark={dark} t={t} value={statusFilter} onChange={changeStatus} options={[
            { value: "all", label: "All statuses" },
            { value: "Pending", label: "Pending" },
            { value: "Completed", label: "Completed" },
            { value: "Failed", label: "Failed" },
            { value: "Rejected", label: "Rejected" },
          ]} />
          <button onClick={downloadCSV} className="py-[7px] px-3.5 rounded-lg bg-none text-xs cursor-pointer font-[inherit] transition-transform duration-200 hover:-translate-y-px" style={{ border: `1px solid ${dark ? "rgba(255,255,255,.18)" : "rgba(0,0,0,.14)"}`, color: t.textMuted }}>↓ CSV</button>
        </div>

        {loading ? <div>{[1,2,3].map(i => <div key={i} className={`skel-bone ${dark ? "skel-dark" : "skel-light"} h-[60px] rounded-lg mb-1.5`} />)}</div> :
        deposits.length === 0 ? (
          <div className="py-[60px] px-5 text-center">
            <svg width="48" height="48" viewBox="0 0 64 64" fill="none" className="block mx-auto mb-3.5 opacity-50">
              <rect x="8" y="16" width="48" height="32" rx="6" stroke={t.accent} strokeWidth="1.5" opacity=".25" />
              <rect x="38" y="26" width="18" height="12" rx="3" stroke={t.accent} strokeWidth="1.5" opacity=".2" />
              <circle cx="46" cy="32" r="2" stroke={t.accent} strokeWidth="1.5" opacity=".3" />
              <line x1="16" y1="24" x2="30" y2="24" stroke={t.accent} strokeWidth="1.5" opacity=".15" strokeLinecap="round" />
            </svg>
            <div className="text-base font-medium mb-1" style={{ color: t.text }}>{statusFilter === "Pending" ? "No pending deposits" : "No deposits found"}</div>
            <div className="text-sm" style={{ color: t.textMuted }}>{statusFilter === "Pending" ? "Manual and crypto deposits will appear here" : "Try adjusting your search or filters"}</div>
          </div>
        ) : (
          <div className="adm-card" style={{ background: t.cardBg, border: `0.5px solid ${dark ? "rgba(255,255,255,.16)" : "rgba(0,0,0,.12)"}`, borderRadius: 14, overflow: "hidden" }}>
            {deposits.map((tx, i) => {
              const sc = statusColors[tx.status] || statusColors.Pending;
              const initials = (tx.user || "?").split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase();
              const isPending = tx.status === "Pending";
              return (
                <div key={tx.id} style={{ display: "flex", gap: 13, padding: "13px 16px", borderBottom: i < deposits.length - 1 ? `1px solid ${t.cardBorder}` : "none", alignItems: "flex-start", ...(isPending ? { boxShadow: `inset 2.5px 0 0 ${sc.color}` } : {}), transition: "background .12s" }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "baseline", gap: 7, flexWrap: "wrap" }}>
                      <span style={{ fontSize: 14, fontWeight: 700, color: t.text }}>{tx.user}</span>
                      <span style={{ fontSize: 12, color: t.textMuted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{tx.email}</span>
                      {statusFilter === "all" && <span className="text-[11px] py-0.5 px-2 rounded font-semibold" style={{ background: sc.bg, color: sc.color }}>{tx.status}</span>}
                    </div>
                    {tx.senderRef && (
                      <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 6, minHeight: 20 }}>
                        <span style={{ width: 50, flexShrink: 0, fontSize: 9, fontWeight: 800, letterSpacing: 1, color: t.textMuted }}>SENDER</span>
                        <span style={{ fontSize: 13, fontWeight: 700, color: t.text, textTransform: "capitalize" }}>{tx.senderRef.toLowerCase()}</span>
                      </div>
                    )}
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 6, minHeight: 20 }}>
                      <span style={{ width: 50, flexShrink: 0, fontSize: 9, fontWeight: 800, letterSpacing: 1, color: t.textMuted }}>REF</span>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 6, background: dark ? "rgba(255,255,255,.07)" : "rgba(0,0,0,.05)", border: `1px solid ${dark ? "rgba(255,255,255,.09)" : "rgba(0,0,0,.08)"}`, borderRadius: 7, padding: "3px 8px", fontSize: 11, color: dark ? "#c9c5c0" : "#4a4744" }}>
                        <span className="m">{tx.reference}</span>
                        <button onClick={() => { copyText(tx.reference); toast.success("Copied", tx.reference); }} style={{ display: "flex", color: t.textMuted, transition: ".12s", cursor: "pointer", background: "none", border: "none", padding: 0 }} title="Copy reference">
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
                        </button>
                      </span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 6, minHeight: 20 }}>
                      <span style={{ width: 50, flexShrink: 0, fontSize: 9, fontWeight: 800, letterSpacing: 1, color: t.textMuted }}>DATE</span>
                      <span style={{ fontSize: 13, fontWeight: 500, color: t.textMuted }}>{fD(tx.date)}</span>
                    </div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8, flexShrink: 0, alignSelf: "stretch", justifyContent: "space-between" }}>
                    <span className="m" style={{ fontSize: 17, fontWeight: 700, color: isPending ? sc.color : sc.color }}>{fN(tx.amount)}</span>
                    {isPending && canApprove && (
                      <div style={{ display: "flex", gap: 7 }}>
                        <button onClick={() => approveManual(tx)} style={{ background: "linear-gradient(135deg,#34d399,#059669)", color: "#fff", fontSize: 12.5, fontWeight: 800, padding: "8px 16px", borderRadius: 9, display: "flex", alignItems: "center", gap: 5, transition: ".15s", boxShadow: "0 3px 10px rgba(5,150,105,.25)", border: "none", cursor: "pointer" }}>
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                          <span className="max-md:hidden">Approve</span>
                        </button>
                        <button onClick={() => rejectManual(tx)} style={{ fontSize: 12.5, fontWeight: 700, padding: "8px 14px", borderRadius: 9, border: `1px solid ${dark ? "rgba(252,165,165,.35)" : "rgba(220,38,38,.35)"}`, color: dark ? "#fca5a5" : "#dc2626", transition: ".15s", cursor: "pointer", background: "none" }}>
                          <span className="max-md:hidden">Reject</span>
                          <svg className="hidden max-md:block" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                        </button>
                      </div>
                    )}
                    {isPending && !canApprove && (
                      <span style={{ fontSize: 11, padding: "3px 10px", borderRadius: 6, background: dark ? "rgba(255,255,255,.07)" : "rgba(0,0,0,.03)", color: t.textMuted }}>View only</span>
                    )}
                    {!isPending && tx.actionBy && (
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11.5, fontWeight: 700, color: sc.color, background: sc.bg, padding: "3px 8px", borderRadius: 6 }}>
                        {tx.status === "Completed" ? (
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                        ) : (
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                        )}
                        {tx.status === "Completed" ? "Approved" : "Rejected"} by {tx.actionBy}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </>)}

      {/* ═══ GATEWAY CONFIG TAB ═══ */}
      {tab === "gateways" && (
        <>
          <div className="flex justify-end mb-3">
            <button onClick={() => setAddModal(true)} className="adm-btn-primary shrink-0">+ Add Gateway</button>
          </div>
          {loading ? <div>{[1,2,3].map(i => <div key={i} className={`skel-bone ${dark ? "skel-dark" : "skel-light"} h-[52px] rounded-lg mb-1.5`} />)}</div> : (
            <div className="adm-card" style={{ background: t.cardBg, border: `0.5px solid ${dark ? "rgba(255,255,255,.16)" : "rgba(0,0,0,.12)"}` }}>
              {gateways.map((g, i) => (
                <div key={g.id} className="adm-list-row flex-wrap gap-2.5" style={{ borderBottom: i < gateways.length - 1 ? `1px solid ${t.cardBorder}` : "none" }}>
                  <div className="flex-1 min-w-[160px]">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-[15px] font-medium" style={{ color: t.text }}>{g.name}</span>
                      <span className="text-[11px] py-0.5 px-1.5 rounded font-semibold" style={{ background: g.enabled ? (dark ? "rgba(110,231,183,.1)" : "rgba(5,150,105,.06)") : (dark ? "rgba(255,255,255,.09)" : "rgba(0,0,0,.04)"), color: g.enabled ? (dark ? "#6ee7b7" : "#059669") : t.textMuted }}>{g.enabled ? "Active" : "Disabled"}</span>
                      {g.hasKeys && <span className="text-[11px] py-0.5 px-1.5 rounded font-semibold" style={{ background: dark ? "rgba(96,165,250,.08)" : "rgba(59,130,246,.06)", color: dark ? "#60a5fa" : "#2563eb" }}>Keys set</span>}
                    </div>
                    <div className="text-[13px]" style={{ color: t.textMuted }}>{g.desc}</div>
                  </div>
                  <div className="flex gap-1.5 items-center flex-wrap">
                    <div className="flex flex-col gap-0.5 mr-1">
                      <button onClick={() => reorder(i, -1)} disabled={i === 0} className="w-5 h-4 flex items-center justify-center rounded bg-transparent border-none cursor-pointer transition-opacity" style={{ color: t.textMuted, opacity: i === 0 ? .2 : .6 }}><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="18 15 12 9 6 15"/></svg></button>
                      <button onClick={() => reorder(i, 1)} disabled={i === gateways.length - 1} className="w-5 h-4 flex items-center justify-center rounded bg-transparent border-none cursor-pointer transition-opacity" style={{ color: t.textMuted, opacity: i === gateways.length - 1 ? .2 : .6 }}><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg></button>
                    </div>
                    <button onClick={() => toggle(g.id, !g.enabled)} className="adm-btn-sm" style={{ borderColor: t.cardBorder, color: g.enabled ? (dark ? "#fca5a5" : "#dc2626") : (dark ? "#6ee7b7" : "#059669") }}>{g.enabled ? "Disable" : "Enable"}</button>
                    <button onClick={() => openConfig(g)} className="adm-btn-sm" style={{ borderColor: t.cardBorder, color: t.accent }}>Configure</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
      {configuring && (
        <div onClick={() => setConfiguring(null)} onKeyDown={e=>{if(e.key==='Escape')setConfiguring(null)}} className="fixed inset-0 z-[100] flex items-center justify-center p-4 backdrop-blur-[4px] animate-[modalFadeIn_.2s_ease]" style={{ background: "rgba(0,0,0,.45)" }}>
          <div role="dialog" aria-modal="true" aria-label="Configure gateway" onClick={e => e.stopPropagation()} className="w-full max-w-[420px] rounded-2xl p-6 animate-[modalBounceIn_.3s_cubic-bezier(.34,1.56,.64,1)_both]" style={{ background: dark ? "#0e1120" : "#fff", border: `1px solid ${dark ? "rgba(255,255,255,.22)" : "rgba(0,0,0,.14)"}`, boxShadow: dark ? "0 20px 60px rgba(0,0,0,.4)" : "0 20px 60px rgba(0,0,0,.1)" }}>
            <div className="flex justify-between items-center mb-4">
              <div className="text-base font-semibold" style={{ color: t.text }}>Configure {configuring.name}</div>
              <button onClick={() => setConfiguring(null)} className="bg-transparent w-7 h-7 rounded-lg flex items-center justify-center cursor-pointer" style={{ color: t.textMuted, border: `1px solid ${dark ? "rgba(255,255,255,.22)" : "rgba(0,0,0,.14)"}` }}><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
            </div>
            <div className="text-[13px] mb-4 leading-normal" style={{ color: t.textMuted }}>{configuring.id === "manual" ? "Enter your bank details. Users will see these when selecting bank transfer." : configuring.id === "crypto" ? "API key is set via environment variable. You can leave this blank." : "Enter your API keys. Leave blank to keep existing keys. Current keys are masked for security."}</div>
            {Object.entries(configFields).map(([key]) => {
              const isSecret = !["bankName", "accountNumber", "accountName"].includes(key);
              return (
              <div key={key} className="mb-3.5">
                <label className="block text-[13px] font-semibold mb-1 uppercase tracking-wide" style={{ color: t.textMuted }}>{FIELD_LABELS[key] || key}</label>
                <div className="text-xs mb-1" style={{ color: t.textMuted }}>Current: {configuring.fields?.[key] || "Not set"}</div>
                <input
                  type={isSecret ? "password" : "text"}
                  value={configFields[key]}
                  onChange={e => setConfigFields(prev => ({ ...prev, [key]: e.target.value }))}
                  placeholder={`Enter ${FIELD_LABELS[key] || key}`}
                  className="w-full py-2.5 px-3 rounded-lg text-sm outline-none box-border"
                  style={{ border: `1px solid ${t.cardBorder}`, background: dark ? "rgba(255,255,255,.12)" : "rgba(0,0,0,.06)", color: t.text, fontFamily: isSecret ? "'JetBrains Mono', monospace" : "'Plus Jakarta Sans', sans-serif" }}
                />
              </div>
              );
            })}
            <div className="flex gap-2 mt-2">
              <button onClick={saveConfig} disabled={saving} className="flex-1 py-[11px] rounded-lg text-sm font-semibold border-none cursor-pointer text-white transition-[transform,box-shadow] duration-200 hover:-translate-y-px hover:shadow-[0_6px_20px_rgba(196,125,142,.31)]" style={{ background: "linear-gradient(135deg,#c47d8e,#8b5e6b)" }}>{saving ? "Saving..." : "Save Keys"}</button>
              <button onClick={() => setConfiguring(null)} className="py-[11px] px-5 rounded-lg bg-none text-sm cursor-pointer transition-transform duration-200 hover:-translate-y-px flex items-center justify-center" style={{ border: `1px solid ${t.cardBorder}`, color: t.textMuted }}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
            </div>
          </div>
        </div>
      )}

      {/* Add Gateway modal */}
      {addModal && (
        <div onClick={() => setAddModal(false)} onKeyDown={e=>{if(e.key==='Escape')setAddModal(false)}} className="fixed inset-0 z-[100] flex items-center justify-center p-4 backdrop-blur-[4px] animate-[modalFadeIn_.2s_ease]" style={{ background: "rgba(0,0,0,.45)" }}>
          <div role="dialog" aria-modal="true" aria-label="Add payment gateway" onClick={e => e.stopPropagation()} className="w-full max-w-[420px] rounded-2xl p-6 animate-[modalBounceIn_.3s_cubic-bezier(.34,1.56,.64,1)_both]" style={{ background: dark ? "#0e1120" : "#fff", border: `1px solid ${dark ? "rgba(255,255,255,.22)" : "rgba(0,0,0,.14)"}`, boxShadow: dark ? "0 20px 60px rgba(0,0,0,.4)" : "0 20px 60px rgba(0,0,0,.1)" }}>
            <div className="flex justify-between items-center mb-4">
              <div className="text-base font-semibold" style={{ color: t.text }}>Add Payment Gateway</div>
              <button onClick={() => setAddModal(false)} className="bg-transparent w-7 h-7 rounded-lg flex items-center justify-center cursor-pointer" style={{ color: t.textMuted, border: `1px solid ${dark ? "rgba(255,255,255,.22)" : "rgba(0,0,0,.14)"}` }}><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
            </div>
            <div className="mb-3.5">
              <label className="block text-[13px] font-semibold mb-1 uppercase tracking-wide" style={{ color: t.textMuted }}>Gateway ID</label>
              <div className="text-xs mb-1" style={{ color: t.textMuted }}>Lowercase, no spaces (e.g. "stripe", "squad")</div>
              <input value={newGw.id} onChange={e => setNewGw(prev => ({ ...prev, id: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 30) }))} placeholder="e.g. stripe" className="m w-full py-2.5 px-3 rounded-lg text-sm outline-none box-border" style={{ border: `1px solid ${t.cardBorder}`, background: dark ? "rgba(255,255,255,.12)" : "rgba(0,0,0,.06)", color: t.text }} />
            </div>
            <div className="mb-3.5">
              <label className="block text-[13px] font-semibold mb-1 uppercase tracking-wide" style={{ color: t.textMuted }}>Display Name</label>
              <input value={newGw.name} onChange={e => setNewGw(prev => ({ ...prev, name: e.target.value.slice(0, 50) }))} placeholder="e.g. Stripe" className="w-full py-2.5 px-3 rounded-lg text-sm outline-none box-border" style={{ border: `1px solid ${t.cardBorder}`, background: dark ? "rgba(255,255,255,.12)" : "rgba(0,0,0,.06)", color: t.text }} />
            </div>
            <div className="mb-3.5">
              <label className="block text-[13px] font-semibold mb-1 uppercase tracking-wide" style={{ color: t.textMuted }}>Description</label>
              <input value={newGw.desc} onChange={e => setNewGw(prev => ({ ...prev, desc: e.target.value.slice(0, 100) }))} placeholder="e.g. Cards, Apple Pay" className="w-full py-2.5 px-3 rounded-lg text-sm outline-none box-border" style={{ border: `1px solid ${t.cardBorder}`, background: dark ? "rgba(255,255,255,.12)" : "rgba(0,0,0,.06)", color: t.text }} />
            </div>
            <div className="flex max-md:flex-col gap-2">
              <button onClick={async () => {
                if (!newGw.id || !newGw.name) { toast.error("Missing fields", "ID and name required"); return; }
                if (gateways.some(g => g.id === newGw.id)) { toast.error("Duplicate", "Gateway ID already exists"); return; }
                setSaving(true);
                const res = await fetch("/api/admin/payments", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "add", gatewayId: newGw.id, name: newGw.name, desc: newGw.desc }) });
                if (res.ok) { toast.success("Gateway added", newGw.name); setAddModal(false); setNewGw({ id: "", name: "", desc: "" }); refresh(); }
                else { const d = await res.json(); toast.error("Failed", d.error || "Failed"); }
                setSaving(false);
              }} disabled={saving || !newGw.id || !newGw.name} className="flex-1 py-[11px] rounded-lg text-sm font-semibold border-none" style={{ background: newGw.id && newGw.name ? "linear-gradient(135deg,#c47d8e,#8b5e6b)" : (dark ? "rgba(255,255,255,.12)" : "rgba(0,0,0,.06)"), color: newGw.id && newGw.name ? "#fff" : t.textMuted, cursor: newGw.id && newGw.name ? "pointer" : "default" }}>{saving ? "Adding..." : "Add Gateway"}</button>
              <button onClick={() => setAddModal(false)} className="py-[11px] px-5 rounded-lg bg-none text-sm cursor-pointer transition-transform duration-200 hover:-translate-y-px flex items-center justify-center" style={{ border: `1px solid ${t.cardBorder}`, color: t.textMuted }}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/* ═══════════════════════════════════════════ */
/* ═══ ANALYTICS PAGE                      ═══ */
/* ═══════════════════════════════════════════ */
export function AdminFinancePage({ dark, t, admin }) {
  const [tab, setTab] = useState("overview");
  const canBreakdown = admin?.pages === "*" || (Array.isArray(admin?.pages) && admin.pages.includes("financials"));
  const canRewards = admin?.pages === "*" || (Array.isArray(admin?.pages) && admin.pages.includes("rewards"));

  const subtitles = { overview: "Revenue, growth, and performance", breakdown: "Complete money flow breakdown", rewards: "Nitro Points liability and activity" };

  return (
    <>
      <div className="adm-header">
        <div className="adm-header-row">
          <div>
            <div className="adm-title" style={{ color: t.text }}>Finance</div>
            <div className="adm-subtitle" style={{ color: t.textMuted }}>{subtitles[tab] || subtitles.overview}</div>
          </div>
          <SegPill value={tab} options={[{value: "overview", label: "Overview"}, ...(canBreakdown ? [{value: "breakdown", label: "Breakdown"}] : []), ...(canRewards ? [{value: "rewards", label: "Rewards"}] : [])]} onChange={setTab} dark={dark} t={t} />
        </div>
        <div className="page-divider" style={{ background: t.cardBorder }} />
      </div>
      {tab === "overview" && <FinanceOverviewTab dark={dark} t={t} />}
      {tab === "breakdown" && <FinanceBreakdownTab dark={dark} t={t} admin={admin} />}
      {tab === "rewards" && <FinanceRewardsTab dark={dark} t={t} />}
    </>
  );
}

function FinanceOverviewTab({ dark, t }) {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dateValue, setDateValue] = useState(null);
  const load = (dv) => {
    setLoading(true);
    const params = new URLSearchParams();
    if (dv?.start) params.set("from", localDate(dv.start));
    if (dv?.end) params.set("to", localDate(dv.end));
    if (!dv) params.set("range", "all");
    fetch(`/api/admin/analytics?${params}`).then(res => res.json()).then(d => { setStats(d); setLoading(false); }).catch(() => setLoading(false));
  };
  const changeDateValue = (v) => { setDateValue(v); load(v); };
  const s = stats || {};
  const net = s.totalRevenue || 0, gross = s.grossRevenue || net, refunds = s.revenueRefunds || 0, cost = s.totalCost || 0, profit = net - cost;
  const markup = cost > 0 ? Math.round(profit / cost * 100) : 0;
  const deposits = s.totalDeposits || 0, orders = s.orderCount || 0;
  const delta = (now, before) => {
    if (!s.prev || !before) return null;
    const pct = Math.round((now - before) / before * 100);
    return <i className={"fo-d " + (pct >= 0 ? "up" : "dn")}>{pct >= 0 ? "↑" : "↓"} {Math.abs(pct)}% vs before</i>;
  };
  const short = (v) => v >= 1e6 ? `₦${(v / 1e6).toFixed(2)}M` : v >= 1e3 ? `₦${Math.round(v / 1e3)}K` : `₦${Math.round(v)}`;
  const days = (s.chartData || []).slice(-31);
  const maxDay = Math.max(1, ...days.map(d => d.revenue || 0));
  const best = days.reduce((m, d) => (d.revenue || 0) > (m?.revenue || 0) ? d : m, null);
  const plats = (s.topPlatforms || []);
  const maxPlat = Math.max(1, ...plats.map(p => p.revenue || 0));
  const methods = (s.depositsByMethod || []);
  const methodTotal = methods.reduce((n, m) => n + m.amount, 0) || 1;
  const methodName = (m) => ({ flutterwave: "Flutterwave", manual: "Bank transfer", crypto: "Crypto", paystack: "Paystack" })[m] || m.charAt(0).toUpperCase() + m.slice(1);
  const dayLabel = (iso) => new Date(iso + "T12:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  const vars = {
    "--card": t.cardBg, "--ink": t.text, "--mut": t.textMuted, "--dim": dark ? "#5c6170" : "#a19b93", "--line": t.cardBorder, "--rail": dark ? "rgba(255,255,255,.07)" : "rgba(0,0,0,.06)",
    "--ac": t.accent, "--ok": dark ? "#6ee7b7" : "#0a7d54", "--bad": dark ? "#fca5a5" : "#c62828", "--cost": dark ? "#5c6170" : "#a19b93", "--in": dark ? "#a5b4fc" : "#4c62c4",
  };
  const bone = (h) => <div className={`skel-bone ${dark ? "skel-dark" : "skel-light"}`} style={{ height: h, borderRadius: 14 }} />;
  return (
    <div className="fo" style={vars}>
      <style>{FO_CSS}</style>
      <div className="fo-bar"><DateRangePicker dark={dark} t={t} value={dateValue} onChange={changeDateValue} defaultPreset="This month" /></div>
      {loading ? <>{bone(84)}{bone(120)}{bone(230)}<div className="fo-cols">{bone(220)}{bone(220)}</div></> : <>
        <div className="fo-stats">
          <div className="fo-stt"><b className="m">{fN(net)}</b><span>Net revenue</span>{delta(net, s.prev?.netRevenue) || <i>gross {fN(gross)}</i>}</div>
          <div className="fo-stt"><b className={"m" + (profit >= 0 ? " ok" : " bad")}>{fN(profit)}</b><span>Profit</span><i>{markup}% on cost{s.prev ? <> · {delta(profit, s.prev.profit)}</> : ""}</i></div>
          <div className="fo-stt"><b className="m">{fN(deposits)}</b><span>Cash in</span><i>{(s.depositCount || 0).toLocaleString()} deposits{s.prev ? <> · {delta(deposits, s.prev.deposits)}</> : ""}</i></div>
          <div className="fo-stt"><b className="m">{orders.toLocaleString()}</b><span>Orders</span><i>{fN(s.avgOrderValue || 0)} average{s.prev ? <> · {delta(orders, s.prev.orders)}</> : ""}</i></div>
        </div>

        {gross > 0 && (
          <section className="fo-card">
            <header><h3>Where the money went</h3><span className="fo-cnt">gross {fN(gross)}</span></header>
            <div className="fo-cb">
              <div className="fo-flow">
                {[["Refunds", refunds, "ref"], ["Provider cost", cost, "cost"], ["Profit", Math.max(0, profit), "prof"]].map(([lab, v, c]) => (
                  <i key={c} className={c} style={{ width: `${Math.max(0, v / gross * 100)}%` }}><span>{lab}<b className="m">{short(v)}</b></span></i>
                ))}
              </div>
              <div className="fo-legend">
                <span><i className="ref" />Refunds {fN(refunds)} · {(refunds / gross * 100).toFixed(1)}%</span>
                <span><i className="cost" />Provider cost {fN(cost)} · {(cost / gross * 100).toFixed(1)}%</span>
                <span><i className="prof" />Profit {fN(profit)} · {(profit / gross * 100).toFixed(1)}%</span>
              </div>
            </div>
          </section>
        )}

        {days.length > 1 && (
          <section className="fo-card">
            <header><h3>Revenue and cost by day</h3><span className="fo-cnt">{days.length} days · {fN(days.reduce((n, d) => n + (d.revenue || 0), 0))}</span></header>
            <div className="fo-cb">
              <div className="fo-days">
                {days.map((d, i) => (
                  <div key={d.date} className="fo-dbar" title={`${dayLabel(d.date)} · ${fN(d.revenue || 0)} revenue · ${fN(d.cost || 0)} cost`}>
                    <i className="rv" style={{ height: `${(d.revenue || 0) / maxDay * 100}%` }} />
                    <i className="cs" style={{ height: `${(d.cost || 0) / maxDay * 100}%` }} />
                    {(days.length <= 16 || i % Math.ceil(days.length / 12) === 0) && <em>{new Date(d.date + "T12:00:00").getDate()}</em>}
                  </div>
                ))}
              </div>
              <div className="fo-legend"><span><i className="rv" />Revenue</span><span><i className="cs" />Provider cost</span>{best && <span className="fo-dim">Best day {dayLabel(best.date)} · {fN(best.revenue)}</span>}</div>
            </div>
          </section>
        )}

        <div className="fo-cols">
          <section className="fo-card">
            <header><h3>Platforms</h3><span className="fo-cnt">revenue · orders · profit on cost</span></header>
            <div className="fo-cb tight">
              {plats.length === 0 ? <div className="fo-empty">No orders in this period.</div> : plats.map(p => (
                <div key={p.name} className="fo-pr">
                  <span className="fo-pn">{p.name}</span>
                  <span className="fo-pb"><i style={{ width: `${(p.revenue || 0) / maxPlat * 100}%` }} /></span>
                  <b className="m">{short(p.revenue || 0)}</b>
                  <span className="m fo-dimc">{(p.orders || 0).toLocaleString()}</span>
                  <span className="m ok">{p.cost > 0 ? `${Math.round((p.revenue - p.cost) / p.cost * 100)}%` : "—"}</span>
                </div>
              ))}
            </div>
          </section>
          <section className="fo-card">
            <header><h3>Cash in, by method</h3><span className="fo-cnt">{fN(deposits)} · {(s.depositCount || 0).toLocaleString()} deposits</span></header>
            <div className="fo-cb tight">
              {methods.length === 0 ? <div className="fo-empty">No deposits in this period.</div> : methods.map(m => (
                <div key={m.method} className="fo-pr">
                  <span className="fo-pn">{methodName(m.method)}</span>
                  <span className="fo-pb"><i className="in" style={{ width: `${m.amount / methodTotal * 100}%` }} /></span>
                  <b className="m">{short(m.amount)}</b>
                  <span className="m fo-dimc">{m.count.toLocaleString()}</span>
                  <span className="m fo-dimc">{Math.round(m.amount / methodTotal * 100)}%</span>
                </div>
              ))}
              {s.cashRefunds > 0 && <div className="fo-note"><span>Refunded to bank</span><b className="m" style={{ color: "var(--bad)" }}>−{fN(s.cashRefunds)}</b><em>{s.cashRefundCount} {s.cashRefundCount === 1 ? "deposit" : "deposits"} sent back</em></div>}
              {s.walletLiability && <div className="fo-note"><span>Held in wallets</span><b className="m">{fN(s.walletLiability.balances)}</b><em>{s.walletLiability.users.toLocaleString()} people</em></div>}
            </div>
          </section>
        </div>
      </>}
    </div>
  );
}

const FO_CSS = `
.fo{display:flex;flex-direction:column;gap:14px;color:var(--ink)}
.fo *{box-sizing:border-box}
.fo .m{font-family:'JetBrains Mono',ui-monospace,monospace;font-variant-numeric:tabular-nums}
.fo-bar{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.fo-stats{display:grid;grid-template-columns:repeat(4,1fr);background:var(--card);border:1px solid var(--line);border-radius:14px}
.fo-stt{padding:12px 16px;border-left:1px solid var(--line);display:flex;flex-direction:column;min-width:0}.fo-stt:first-child{border-left:0}
.fo-stt b{font-size:20px;font-weight:800;letter-spacing:-.01em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.fo-stt b.ok{color:var(--ok)}.fo-stt b.bad{color:var(--bad)}
.fo-stt span{font-size:11px;font-weight:700;letter-spacing:.8px;text-transform:uppercase;color:var(--mut);margin-top:2px}
.fo-stt i{font-style:normal;font-size:11.5px;color:var(--dim);margin-top:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.fo-d.up{color:var(--ok)}.fo-d.dn{color:var(--bad)}
.fo-card{background:var(--card);border:1px solid var(--line);border-radius:14px;overflow:hidden}
.fo-card>header{display:flex;justify-content:space-between;align-items:baseline;gap:10px;padding:11px 16px;border-bottom:1px solid var(--line)}
.fo-card h3{margin:0;font-size:11px;letter-spacing:1.2px;text-transform:uppercase;color:var(--mut);font-weight:700}.fo-cnt{font-size:11.5px;color:var(--dim)}
.fo-cb{padding:14px 16px;display:flex;flex-direction:column;gap:10px}.fo-cb.tight{padding:6px 16px 10px;gap:0}
.fo-flow{display:flex;height:44px;border-radius:10px;overflow:hidden;background:var(--rail)}.fo-flow i{display:flex;align-items:center;justify-content:center;min-width:0;font-style:normal}
.fo-flow i.ref{background:var(--bad);opacity:.85}.fo-flow i.cost{background:var(--cost)}.fo-flow i.prof{background:var(--ok)}
.fo-flow span{display:flex;flex-direction:column;align-items:center;color:#fff;font-size:10px;font-weight:700;letter-spacing:.4px;text-transform:uppercase;white-space:nowrap;overflow:hidden;padding:0 6px}.fo-flow span b{font-size:13px;letter-spacing:0;text-transform:none}.fo-flow i.ref span{display:none}
.fo-legend{display:flex;gap:16px;flex-wrap:wrap;font-size:12px;color:var(--mut)}.fo-legend span{display:inline-flex;align-items:center;gap:6px}.fo-legend i{width:10px;height:10px;border-radius:3px;display:inline-block}
.fo-legend i.ref{background:var(--bad)}.fo-legend i.cost,.fo-legend i.cs{background:var(--cost)}.fo-legend i.prof{background:var(--ok)}.fo-legend i.rv{background:var(--ac)}.fo-dim{margin-left:auto;color:var(--dim)}
.fo-days{display:flex;align-items:flex-end;gap:6px;height:150px;padding-top:6px;border-bottom:1px solid var(--line)}
.fo-dbar{flex:1;display:flex;align-items:flex-end;justify-content:center;gap:2px;height:100%;position:relative;padding-bottom:18px;min-width:0}
.fo-dbar i{width:44%;border-radius:3px 3px 0 0;display:block;min-height:1px}.fo-dbar i.rv{background:var(--ac)}.fo-dbar i.cs{background:var(--cost);opacity:.7}.fo-dbar em{position:absolute;bottom:0;font-style:normal;font-size:10px;color:var(--dim)}
.fo-cols{display:grid;grid-template-columns:1fr 1fr;gap:14px;align-items:start}
.fo-pr{display:grid;grid-template-columns:96px 1fr 74px 52px 44px;gap:10px;align-items:center;padding:8px 0;border-top:1px solid var(--rail);font-size:13px}.fo-pr:first-child{border-top:0}
.fo-pn{font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.fo-pb{height:8px;border-radius:4px;background:var(--rail);overflow:hidden}.fo-pb i{display:block;height:100%;background:var(--ac);border-radius:4px}.fo-pb i.in{background:var(--in)}
.fo-pr b{text-align:right;font-weight:700}.fo-dimc{text-align:right;color:var(--mut);font-size:12px}.fo-pr .ok{text-align:right;color:var(--ok);font-weight:700;font-size:12px}
.fo-note{display:flex;align-items:baseline;gap:8px;margin-top:8px;padding-top:10px;border-top:1px solid var(--line);font-size:12.5px;color:var(--mut)}.fo-note b{font-size:14px;color:var(--ink)}.fo-note em{font-style:normal;color:var(--dim);margin-left:auto}
.fo-empty{padding:18px 0;font-size:13px;color:var(--mut)}
@media (max-width:900px){
  .fo-stats{grid-template-columns:1fr 1fr}.fo-stt:nth-child(3){border-left:0}.fo-stt:nth-child(n+3){border-top:1px solid var(--line)}.fo-stt b{font-size:17px}
  .fo-flow{height:40px}.fo-flow span b{font-size:12px}.fo-days{gap:3px;height:120px}
  .fo-cols{grid-template-columns:1fr}.fo-pr{grid-template-columns:84px 1fr 64px 40px}.fo-pr>span:nth-child(4){display:none}
}
`;

/* ═══════════════════════════════════════════ */
/* ═══ ALERTS PAGE                         ═══ */
/* ═══════════════════════════════════════════ */
export { AdminAlertsPage } from "./admin-alerts-page";

/* ═══════════════════════════════════════════ */
/* ═══ SETTINGS PAGE                       ═══ */
/* ═══════════════════════════════════════════ */
export { AdminSettingsPage } from "./admin-settings-page";

/* ═══════════════════════════════════════════ */
/* ═══ FINANCIALS PAGE                     ═══ */
/* ═══════════════════════════════════════════ */
function FinanceBreakdownTab({ dark, t, admin }) {
  const toast = useToast();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dateValue, setDateValue] = useState(null);
  const [platform, setPlatform] = useState("all");
  const [tier, setTier] = useState("all");
  const [provider, setProvider] = useState("all");
  const [topupProvider, setTopupProvider] = useState("dao");
  const [topupAmount, setTopupAmount] = useState("");
  const [topupNote, setTopupNote] = useState("");
  const [topupSaving, setTopupSaving] = useState(false);
  const [reportLoading, setReportLoading] = useState(false);
  const [csvSections, setCsvSections] = useState({ wallet: true, orders: true, points: true, provider: true, affiliate: true, liabilities: true });
  const [csvMenuOpen, setCsvMenuOpen] = useState(false);
  const csvMenuRef = useRef(null);
  useEffect(() => {
    if (!csvMenuOpen) return;
    const close = (e) => { if (csvMenuRef.current && !csvMenuRef.current.contains(e.target)) setCsvMenuOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [csvMenuOpen]);

  const buildParams = (extra = {}) => {
    const params = new URLSearchParams();
    if (dateValue?.start) params.set("from", localDate(dateValue.start));
    if (dateValue?.end) params.set("to", localDate(dateValue.end));
    if (!dateValue) params.set("range", "all");
    if (platform !== "all") params.set("platform", platform);
    if (tier !== "all") params.set("tier", tier);
    if (provider !== "all") params.set("provider", provider);
    Object.entries(extra).forEach(([key, value]) => params.set(key, value));
    return params;
  };

  const load = () => {
    setLoading(true);
    const params = buildParams();
    fetch(`/api/admin/financials?${params}`)
      .then(r => r.json()).then(d => { setStats(d); setLoading(false); }).catch(() => setLoading(false));
  };
  useEffect(() => { load(); }, [dateValue, platform, tier, provider]);

  const downloadReport = async () => {
    const selected = Object.entries(csvSections).filter(([, v]) => v).map(([k]) => k);
    if (!selected.length) { toast.error("No sections selected"); return; }
    setReportLoading(true);
    setCsvMenuOpen(false);
    try {
      const params = buildParams({ export: "csv", sections: selected.join(",") });
      const res = await fetch(`/api/admin/financials?${params}`);
      if (!res.ok) {
        let msg = "Could not download report";
        try { const d = await res.json(); if (d.error) msg = d.error; } catch {}
        toast.error("Download failed", msg);
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `nitro-finance-report-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Report downloaded", `Exported ${selected.length} section${selected.length > 1 ? "s" : ""}.`);
    } catch {
      toast.error("Download failed", "Please try again.");
    } finally {
      setReportLoading(false);
    }
  };

  const handleTopup = async () => {
    const amt = parseFloat(topupAmount);
    if (!amt || amt <= 0) return;
    setTopupSaving(true);
    try {
      const res = await fetch("/api/admin/provider-topups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: topupProvider, amount: amt, note: topupNote || null }),
      });
      const d = await res.json();
      if (d.success) {
        setTopupAmount("");
        setTopupNote("");
        load();
      }
    } catch {}
    setTopupSaving(false);
  };

  const s = stats || {};
  const p = s.profitability || {};
  const mIn = s.moneyIn || {};
  const mOut = s.moneyOut || {};
  const wObl = s.walletObligations || {};
  const lib = s.liability || {};
  const rev = s.revenue || {};
  const sensitive = !!s.moneyOut;
  const net = p.netRevenue || 0, gross = p.grossRevenue || 0, refunds = rev.refunds ?? p.totalRefunds ?? 0;
  const cost = p.totalCost || 0, profit = p.grossProfit ?? (net - cost);
  const cashIn = (mIn.deposits || 0) + (mIn.adminCredits || 0);
  const cashOut = (mOut.providerTopups || 0) + (mOut.refundedToBank || 0);
  const tiers = s.byTier || [], plats = s.byPlatform || [];
  const maxTier = Math.max(1, ...tiers.map(x => x.revenue || 0)), maxPlat = Math.max(1, ...plats.map(x => x.revenue || 0));
  const short = (v) => v >= 1e6 ? `₦${(v / 1e6).toFixed(2)}M` : v >= 1e3 ? `₦${Math.round(v / 1e3)}K` : `₦${Math.round(v)}`;
  const TC = { Budget: "bud", Standard: "std", Premium: "prm" };
  const Ledger = ({ title, cnt, rows, total }) => (
    <section className="fo-card">
      <header><h3>{title}</h3>{cnt && <span className="fo-cnt">{cnt}</span>}</header>
      <div className="fo-cb tight">
        {rows.filter(Boolean).map(([label, value, hint, cls, sub]) => (
          <div key={label} className={"fb-lr" + (sub ? " sub" : "")}><span>{label}</span>{hint && <em>{hint}</em>}<b className={"m " + (cls || "")}>{value}</b></div>
        ))}
        {total && <div className="fb-lr tot"><span>{total[0]}</span><b className={"m " + (total[2] || "")}>{total[1]}</b></div>}
      </div>
    </section>
  );
  const vars = {
    "--card": t.cardBg, "--ink": t.text, "--mut": t.textMuted, "--dim": dark ? "#5c6170" : "#a19b93", "--line": t.cardBorder, "--rail": dark ? "rgba(255,255,255,.07)" : "rgba(0,0,0,.06)",
    "--ac": t.accent, "--ok": dark ? "#6ee7b7" : "#0a7d54", "--bad": dark ? "#fca5a5" : "#c62828", "--cost": dark ? "#5c6170" : "#a19b93", "--in": dark ? "#a5b4fc" : "#4c62c4",
    "--bud": dark ? "#e0a458" : "#854F0B", "--std": dark ? "#7aa2f7" : "#185FA5", "--prm": dark ? "#a78bfa" : "#534AB7", "--soft": dark ? "#111634" : "#faf9f7",
  };
  const bone = (h) => <div className={`skel-bone ${dark ? "skel-dark" : "skel-light"}`} style={{ height: h, borderRadius: 14 }} />;
  return (
    <div className="fo fb" style={vars}>
      <style>{FO_CSS}{FB_CSS}</style>
      <div className="fo-bar">
        <DateRangePicker dark={dark} t={t} value={dateValue} onChange={setDateValue} defaultPreset="This month" />
        <FilterDropdown dark={dark} t={t} value={platform} onChange={setPlatform} options={[
          { value: "all", label: "All platforms" }, { value: "instagram", label: "Instagram" }, { value: "tiktok", label: "TikTok" }, { value: "youtube", label: "YouTube" },
          { value: "twitter", label: "Twitter/X" }, { value: "telegram", label: "Telegram" }, { value: "facebook", label: "Facebook" }, { value: "spotify", label: "Spotify" },
        ]} />
        <FilterDropdown dark={dark} t={t} value={tier} onChange={setTier} options={[{ value: "all", label: "All tiers" }, { value: "budget", label: "Budget" }, { value: "standard", label: "Standard" }, { value: "premium", label: "Premium" }]} />
        <FilterDropdown dark={dark} t={t} value={provider} onChange={setProvider} options={[{ value: "all", label: "All providers" }, { value: "mtp", label: "MTP" }, { value: "jap", label: "JAP" }, { value: "dao", label: "DaoSMM" }]} />
        <div className="fb-export" ref={csvMenuRef}>
          <button type="button" className="fb-b" onClick={() => setCsvMenuOpen(v => !v)} disabled={reportLoading}>{reportLoading ? "Preparing…" : "Export report"}</button>
          {csvMenuOpen && (
            <div className="fb-menu">
              <div className="fb-mh">Sections</div>
              {[["wallet", "Wallet"], ["orders", "Orders"], ["points", "Nitro Points"], ["provider", "Provider top-ups"], ["affiliate", "Affiliate"], ["liabilities", "Liabilities"]].map(([key, label]) => (
                <label key={key} className="fb-mi"><input type="checkbox" checked={csvSections[key]} onChange={() => setCsvSections(c => ({ ...c, [key]: !c[key] }))} />{label}</label>
              ))}
              <button type="button" className="fb-pri" onClick={downloadReport}>Download CSV</button>
            </div>
          )}
        </div>
      </div>
      {loading ? <><div className="fo-cols">{bone(220)}{bone(220)}</div><div className="fo-cols">{bone(220)}{bone(220)}</div></> : <>
        <div className="fo-cols">
          <Ledger title="Revenue" cnt="what customers paid" rows={[
            ["Gross revenue", fN(gross), "before refunds"],
            ["Refunds to wallets", `−${fN(refunds)}`, "against orders that did not deliver", "bad", true],
            p.totalDiscounts > 0 ? ["Discounts", `−${fN(p.totalDiscounts)}`, "status and campaign discounts", "", true] : null,
            ["Net revenue", fN(net)],
          ]} total={sensitive ? ["Kept as profit after cost", fN(profit), profit >= 0 ? "ok" : "bad"] : null} />
          {sensitive && <Ledger title="Cost" cnt="paid to providers" rows={[
            ["Provider cost", fN(cost), "on the orders above"],
            ["Provider top-ups", fN(mOut.providerTopups || 0), "what we actually sent"],
            ["Profit on cost", `${p.margin ?? 0}%`, "net revenue less cost, over cost", "ok"],
            ["Per order", fN(p.profitPerOrder || 0), `across ${(p.orderCount || 0).toLocaleString()} orders`],
          ]} />}
          <Ledger title="Cash" cnt="in and out of the business" rows={[
            ["Deposits", fN(mIn.deposits || 0), `${(s.depositCount || 0) ? `${s.depositCount.toLocaleString()} deposits` : "customers funding wallets"}`, "ok"],
            ["Admin credits", fN(mIn.adminCredits || 0), "wallet money we added", "", true],
            sensitive ? ["Provider top-ups", `−${fN(mOut.providerTopups || 0)}`, "", "bad"] : null,
            sensitive ? ["Refunded to bank", `−${fN(mOut.refundedToBank || 0)}`, mOut.refundedToBankCount ? `${mOut.refundedToBankCount} ${mOut.refundedToBankCount === 1 ? "deposit" : "deposits"} sent back` : "nothing sent back", "bad"] : null,
          ]} total={sensitive ? ["Net cash flow", fN(cashIn - cashOut), cashIn - cashOut >= 0 ? "ok" : "bad"] : null} />
          <Ledger title="What we owe" cnt="wallets and promises" rows={[
            ["Wallet balances", fN(lib.walletBalances || 0), `${(lib.walletUsers || 0).toLocaleString()} people`],
            ["Order refunds", fN(wObl.refunds || 0), "credited back to wallets", "", true],
            ["Coupon bonuses", fN(wObl.couponBonuses || 0), "", "", true],
            ["Referral bonuses", fN(wObl.referralBonuses || 0), "", "", true],
            ["Gifts", fN(wObl.adminGifts || 0), "", "", true],
          ]} />
        </div>
        <div className="fo-cols">
          <section className="fo-card">
            <header><h3>By tier</h3><span className="fo-cnt">revenue · orders{sensitive ? " · profit on cost" : ""}</span></header>
            <div className="fo-cb tight">
              {tiers.length === 0 ? <div className="fo-empty">No orders in this period.</div> : tiers.map(x => (
                <div key={x.name} className="fo-pr"><span className={`fo-pn fb-tc ${TC[x.name] || ""}`}>{x.name}</span><span className="fo-pb"><i style={{ width: `${(x.revenue || 0) / maxTier * 100}%` }} /></span><b className="m">{short(x.revenue || 0)}</b><span className="m fo-dimc">{(x.orders || 0).toLocaleString()}</span><span className="m ok">{sensitive && x.cost > 0 ? `${Math.round((x.revenue - x.cost) / x.cost * 100)}%` : "—"}</span></div>
              ))}
            </div>
          </section>
          <section className="fo-card">
            <header><h3>By platform</h3><span className="fo-cnt">revenue · orders{sensitive ? " · profit on cost" : ""}</span></header>
            <div className="fo-cb tight">
              {plats.length === 0 ? <div className="fo-empty">No orders in this period.</div> : plats.map(x => (
                <div key={x.name} className="fo-pr"><span className="fo-pn">{x.name}</span><span className="fo-pb"><i style={{ width: `${(x.revenue || 0) / maxPlat * 100}%` }} /></span><b className="m">{short(x.revenue || 0)}</b><span className="m fo-dimc">{(x.orders || 0).toLocaleString()}</span><span className="m ok">{sensitive && x.cost > 0 ? `${Math.round((x.revenue - x.cost) / x.cost * 100)}%` : "—"}</span></div>
              ))}
            </div>
          </section>
        </div>
        {(admin?.role === "owner" || admin?.role === "superadmin") && (
          <section className="fo-card">
            <header><h3>Record a provider top-up</h3><span className="fo-cnt">so cash out stays true</span></header>
            <div className="fo-cb">
              <div className="fb-row3">
                <select value={topupProvider} onChange={e => setTopupProvider(e.target.value)} className="fb-in"><option value="mtp">MoreThanPanel</option><option value="dao">DaoSMM</option><option value="jap">JAP</option></select>
                <input type="number" min="0" value={topupAmount} onChange={e => setTopupAmount(e.target.value)} placeholder="₦ amount" className="fb-in m" />
                <input value={topupNote} onChange={e => setTopupNote(e.target.value)} placeholder="Note (optional)" className="fb-in" />
              </div>
              <button type="button" className="fb-pri" disabled={topupSaving || !parseFloat(topupAmount)} onClick={handleTopup}>{topupSaving ? "Saving…" : "Record top-up"}</button>
            </div>
          </section>
        )}
      </>}
    </div>
  );
}

const FB_CSS = `
.fb-lr{display:grid;grid-template-columns:1fr auto;grid-template-areas:"lab val" "hint val";align-items:center;column-gap:12px;padding:8px 0;border-top:1px solid var(--rail);font-size:13.5px}.fb-lr:first-child{border-top:0}
.fb-lr>span{grid-area:lab;font-weight:600}.fb-lr em{grid-area:hint;font-style:normal;font-size:11.5px;color:var(--dim)}.fb-lr b{grid-area:val;font-weight:700;text-align:right}.fb-lr b.ok{color:var(--ok)}.fb-lr b.bad{color:var(--bad)}
.fb-lr.sub>span{font-weight:500;color:var(--mut);padding-left:12px}.fb-lr.sub em{padding-left:12px}.fb-lr.sub b{font-weight:600;color:var(--mut)}.fb-lr.sub b.bad{color:var(--bad)}.fb-lr.sub b.ok{color:var(--ok)}
.fb-lr.tot{border-top:1px solid var(--line);margin-top:2px;padding-top:10px}.fb-lr.tot>span{font-size:11px;font-weight:700;letter-spacing:.8px;text-transform:uppercase;color:var(--mut)}.fb-lr.tot b{font-size:18px;font-weight:800;color:var(--ac)}.fb-lr.tot b.ok{color:var(--ok)}.fb-lr.tot b.bad{color:var(--bad)}
.fb-tc.bud{color:var(--bud)}.fb-tc.std{color:var(--std)}.fb-tc.prm{color:var(--prm)}
.fb-export{position:relative;margin-left:auto}
.fb-b{font:inherit;font-size:12.5px;font-weight:600;height:34px;padding:0 12px;border-radius:9px;border:1px solid var(--line);background:var(--card);color:var(--ink);cursor:pointer;white-space:nowrap}.fb-b:disabled{opacity:.5;cursor:not-allowed}
.fb-pri{font:inherit;font-size:12.5px;font-weight:800;height:36px;padding:0 16px;border-radius:9px;border:0;background:var(--ac);color:#fff;cursor:pointer;white-space:nowrap}.fb-pri:disabled{opacity:.5;cursor:not-allowed}
.fb-menu{position:absolute;right:0;top:calc(100% + 6px);z-index:30;width:220px;padding:8px;border-radius:12px;background:var(--card);border:1px solid var(--line);box-shadow:0 12px 30px rgba(0,0,0,.14);display:flex;flex-direction:column;gap:2px}
.fb-mh{font-size:10.5px;font-weight:700;letter-spacing:.9px;text-transform:uppercase;color:var(--mut);padding:4px 6px 6px}
.fb-mi{display:flex;align-items:center;gap:8px;padding:6px;border-radius:8px;font-size:13px;cursor:pointer}.fb-mi:hover{background:var(--soft)}.fb-mi input{accent-color:var(--ac)}
.fb-menu .fb-pri{margin-top:6px;width:100%}
.fb-ladder{grid-template-columns:96px 1fr 74px 60px}
.fb-row3{display:grid;grid-template-columns:1fr 1fr 1.4fr;gap:8px}
.fb-in{height:36px;padding:0 12px;border-radius:10px;border:1px solid var(--line);background:var(--card);font:inherit;font-size:13px;color:var(--ink);outline:none;min-width:0;width:100%}.fb-in:focus{border-color:var(--ac)}
.fb .fb-pri{align-self:flex-start}
@media (max-width:900px){.fb-export{margin-left:0;width:100%}.fb-export .fb-b{width:100%}.fb-menu{left:0;right:auto;width:100%}.fb-row3{grid-template-columns:1fr}.fb .fb-pri{align-self:stretch}}
`;



function FinanceRewardsTab({ dark, t }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dateValue, setDateValue] = useState(null);
  const reqRef = useRef(0);
  const load = (dv) => {
    const reqId = ++reqRef.current;
    setLoading(true);
    const params = new URLSearchParams({ view: 'summary' });
    if (dv?.start) params.set('from', localDate(dv.start));
    if (dv?.end) params.set('to', localDate(dv.end));
    fetch(`/api/admin/rewards?${params}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (reqId === reqRef.current) { setData(d); setLoading(false); } })
      .catch(() => { if (reqId === reqRef.current) setLoading(false); });
  };
  useEffect(() => { load(null); }, []);
  const changeDateValue = (v) => { setDateValue(v); load(v); };
  const n = (kobo) => fN(Math.round((kobo || 0) / 100));
  const cost = data?.cost || {};
  const checkout = cost.checkoutReductions || {};
  const movement = cost.pointsMovement || {};
  const accrual = cost.accrualRewardCost || {};
  const owed = data?.liability?.kobo || 0;
  const netChange = movement.netLiabilityChangeKobo || 0;
  const ladder = data?.statusLadder || [];
  const maxLadder = Math.max(1, ...ladder.map(x => x.orders || 0));
  const vars = {
    "--card": t.cardBg, "--ink": t.text, "--mut": t.textMuted, "--dim": dark ? "#5c6170" : "#a19b93", "--line": t.cardBorder, "--rail": dark ? "rgba(255,255,255,.07)" : "rgba(0,0,0,.06)",
    "--ac": t.accent, "--ok": dark ? "#6ee7b7" : "#0a7d54", "--bad": dark ? "#fca5a5" : "#c62828", "--soft": dark ? "#111634" : "#faf9f7",
  };
  const bone = (h) => <div className={`skel-bone ${dark ? "skel-dark" : "skel-light"}`} style={{ height: h, borderRadius: 14 }} />;
  const Ledger = ({ title, cnt, rows, total }) => (
    <section className="fo-card">
      <header><h3>{title}</h3>{cnt && <span className="fo-cnt">{cnt}</span>}</header>
      <div className="fo-cb tight">
        {rows.map(([label, value, hint, cls, sub]) => (
          <div key={label} className={"fb-lr" + (sub ? " sub" : "")}><span>{label}</span>{hint && <em>{hint}</em>}<b className={"m " + (cls || "")}>{value}</b></div>
        ))}
        {total && <div className="fb-lr tot"><span>{total[0]}</span><b className={"m " + (total[2] || "")}>{total[1]}</b></div>}
      </div>
    </section>
  );
  return (
    <div className="fo fb" style={vars}>
      <style>{FO_CSS}{FB_CSS}</style>
      <div className="fo-bar"><DateRangePicker dark={dark} t={t} value={dateValue} onChange={changeDateValue} defaultPreset="This month" /></div>
      {loading ? <>{bone(84)}<div className="fo-cols">{bone(220)}{bone(220)}</div></> : !data ? <div className="fo-empty">Could not load rewards data.</div> : <>
        <div className="fo-stats">
          <div className="fo-stt"><b className="m">{n(owed)}</b><span>Points owed</span><i>redeemable at checkout today</i></div>
          <div className="fo-stt"><b className="m">{n(accrual.kobo)}</b><span>Reward cost</span><i>points issued and discounts given</i></div>
          <div className="fo-stt"><b className="m">{n(checkout.pointsRedeemedKobo)}</b><span>Redeemed</span><i>points used at checkout</i></div>
          <div className="fo-stt"><b className={"m " + (netChange > 0 ? "bad" : "ok")}>{netChange >= 0 ? "+" : "−"}{n(Math.abs(netChange))}</b><span>{netChange >= 0 ? "Owed grew by" : "Owed fell by"}</span><i>issued less redeemed</i></div>
        </div>
        <div className="fo-cols">
          <Ledger title="Points this period" cnt="how the balance moved" rows={[
            ["Earned from orders", `+${n(movement.earnedKobo)}`, "new points on spend", "ok"],
            ["Manual point credits", `+${n(movement.manualCreditKobo)}`, "issued by an admin", "", true],
            ["Opening balances", `+${n(movement.openingBalanceKobo)}`, "imported at launch", "", true],
            ["Restored on refunds", `+${n(movement.restoredKobo)}`, "redeemed points handed back", "", true],
            ["Redeemed at checkout", `−${n(movement.redeemedKobo)}`, "paid for orders with points", "bad"],
            ["Reversed on refunds", `−${n(movement.reversedKobo)}`, "earned points taken back", "", true],
            ["Manual point debits", `−${n(movement.manualDebitKobo)}`, "reduced by an admin", "", true],
          ]} total={["Net change", `${netChange >= 0 ? "+" : "−"}${n(Math.abs(netChange))}`, netChange > 0 ? "bad" : "ok"]} />
          <Ledger title="Checkout reductions" cnt="money not charged" rows={[
            ["Status discounts", n(checkout.statusDiscountKobo), "Pulse and above pay less"],
            ["Campaign discounts", n(checkout.campaignDiscountKobo), "promotions"],
            ["Points redeemed", n(checkout.pointsRedeemedKobo), "counted when issued, shown here for cash"],
          ]} total={["Given at checkout", n(checkout.totalKobo), ""]} />
        </div>
        {ladder.length > 0 && (
          <section className="fo-card">
            <header><h3>Orders by status</h3><span className="fo-cnt">the status held when they bought, and what it takes off</span></header>
            <div className="fo-cb tight">
              {ladder.map(x => (
                <div key={x.key} className="fo-pr fb-ladder"><span className="fo-pn" style={{ color: x.color }}>{x.name}</span><span className="fo-pb"><i style={{ width: `${(x.orders || 0) / maxLadder * 100}%`, background: x.color }} /></span><b className="m">{(x.orders || 0).toLocaleString()}</b><span className="m fo-dimc">{x.discountPct}% off</span></div>
              ))}
            </div>
          </section>
        )}
      </>}
    </div>
  );
}
