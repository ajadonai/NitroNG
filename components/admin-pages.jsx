'use client';
import { useState, useEffect, useRef } from "react";
import { useConfirm } from "./confirm-dialog";
import { useToast } from "./toast";
import { fN, fD } from "../lib/format";
import { SegPill } from "./seg-pill";
import { DateRangePicker, FilterDropdown } from "./date-range-picker";
import InlineAlert from "./inline-alert";

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
          <div className="adm-card" style={{ background: dark ? "rgba(255,255,255,.09)" : "rgba(255,255,255,.85)", border: `0.5px solid ${dark ? "rgba(255,255,255,.16)" : "rgba(0,0,0,.12)"}`, borderRadius: 14, overflow: "hidden" }}>
            {deposits.map((tx, i) => {
              const sc = statusColors[tx.status] || statusColors.Pending;
              const initials = (tx.user || "?").split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase();
              const isPending = tx.status === "Pending";
              return (
                <div key={tx.id} style={{ display: "flex", gap: 13, padding: "13px 16px", borderBottom: i < deposits.length - 1 ? `1px solid ${t.cardBorder}` : "none", alignItems: "flex-start", ...(isPending ? { boxShadow: `inset 2.5px 0 0 ${sc.color}` } : {}), transition: "background .12s" }}>
                  <div style={{ width: 38, height: 38, borderRadius: 99, background: dark ? "rgba(196,125,142,.22)" : "rgba(196,125,142,.16)", color: t.accent, fontSize: 13, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1 }}>{initials}</div>
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
                        <button onClick={() => { navigator.clipboard?.writeText(tx.reference); toast.success("Copied", tx.reference); }} style={{ display: "flex", color: t.textMuted, transition: ".12s", cursor: "pointer", background: "none", border: "none", padding: 0 }} title="Copy reference">
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
            <div className="adm-card" style={{ background: dark ? "rgba(255,255,255,.09)" : "rgba(255,255,255,.85)", border: `0.5px solid ${dark ? "rgba(255,255,255,.16)" : "rgba(0,0,0,.12)"}` }}>
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
  const chartRef = useRef(null);
  const chartInstance = useRef(null);

  const load = (dv) => {
    setLoading(true);
    const params = new URLSearchParams();
    if (dv?.start) params.set("from", localDate(dv.start));
    if (dv?.end) params.set("to", localDate(dv.end));
    if (!dv) params.set("range", "all");
    fetch(`/api/admin/analytics?${params}`).then(res => res.json()).then(d => { setStats(d); setLoading(false); }).catch(() => setLoading(false));
  };

  // Render chart when data is ready
  useEffect(() => {
    if (!stats?.chartData?.length || !chartRef.current) return;
    let destroyed = false;
    import("chart.js/auto").then(({ default: Chart }) => {
      if (destroyed || !chartRef.current) return;
      if (chartInstance.current) chartInstance.current.destroy();
      const cd = stats.chartData;
      const gridColor = dark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)";
      const tickColor = dark ? "rgba(255,255,255,0.4)" : "rgba(0,0,0,0.4)";
      chartInstance.current = new Chart(chartRef.current, {
        type: "bar",
        data: {
          labels: cd.map(d => { const dt = new Date(d.date); return dt.toLocaleDateString("en-GB", { day: "numeric", month: "short" }); }),
          datasets: [
            { label: "Orders", data: cd.map(d => d.orders), backgroundColor: dark ? "rgba(196,125,142,0.5)" : "rgba(196,125,142,0.6)", borderRadius: 4, barPercentage: 0.6, yAxisID: "y" },
            { label: "Deposits", data: cd.map(d => d.deposits), backgroundColor: dark ? "rgba(5,150,105,0.45)" : "rgba(5,150,105,0.55)", borderRadius: 4, barPercentage: 0.6, yAxisID: "y1" },
          ],
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          interaction: { mode: "index", intersect: false },
          plugins: { legend: { display: false }, tooltip: { callbacks: { label: (ctx) => ctx.dataset.label === "Deposits" ? "Deposits: ₦" + ctx.parsed.y.toLocaleString() : "Orders: " + ctx.parsed.y } } },
          scales: {
            x: { grid: { color: gridColor }, ticks: { color: tickColor, font: { size: 11 }, maxRotation: 45, autoSkip: true, maxTicksLimit: 15 } },
            y: { position: "left", grid: { color: gridColor }, ticks: { color: tickColor, font: { size: 11 }, stepSize: 1 }, title: { display: true, text: "Orders", color: tickColor, font: { size: 11 } } },
            y1: { position: "right", grid: { drawOnChartArea: false }, ticks: { color: tickColor, font: { size: 11 }, callback: (v) => "₦" + (v >= 1000 ? Math.round(v / 1000) + "K" : v) }, title: { display: true, text: "Deposits", color: tickColor, font: { size: 11 } } },
          },
        },
      });
    });
    return () => { destroyed = true; if (chartInstance.current) { chartInstance.current.destroy(); chartInstance.current = null; } };
  }, [stats, dark]);

  const changeDateValue = (v) => { setDateValue(v); load(v); };

  const s = stats || {};
  return (
    <>
      {/* Range filter */}
      <div className="flex justify-end mb-4">
        <DateRangePicker dark={dark} t={t} value={dateValue} onChange={changeDateValue} defaultPreset="This month" />
      </div>

      {loading ? <div className="adm-stats">{[1,2,3,4].map(i => <div key={i} className={`skel-bone ${dark ? "skel-dark" : "skel-light"} h-[90px] rounded-xl`} />)}</div> : <>
      <div className="adm-stats mt-0">
        {[
          ["Revenue", fN(s.totalRevenue || 0), t.green],
          ["Provider Cost", fN(s.totalCost || 0), dark ? "#fca5a5" : "#dc2626"],
          ["Profit", fN(s.profit || 0), s.profit >= 0 ? t.green : (dark ? "#fca5a5" : "#dc2626")],
          ["Money In", fN(s.totalMoneyIn || 0), t.green],
          ["Provider Top-ups", fN(s.totalMoneyOut || 0), dark ? "#fca5a5" : "#dc2626"],
          ["Net Cash Flow", fN(s.netCashFlow || 0), (s.netCashFlow || 0) >= 0 ? t.green : (dark ? "#fca5a5" : "#dc2626")],
          ["Orders", String(s.orderCount || 0), t.amber],
          ["New Users", String(s.newUsers || 0), t.blue],
        ].map(([label, val, color]) => (
          <div key={label} className="dash-stat-card" style={{ background: dark ? "rgba(255,255,255,.12)" : "rgba(255,255,255,.85)", border: `0.5px solid ${dark ? "rgba(255,255,255,.16)" : "rgba(0,0,0,.12)"}` }}>
            <div className="dash-stat-dot" style={{ background: color }} />
            <div className="dash-stat-label" style={{ color: t.textMuted }}>{label}</div>
            <div className="m dash-stat-value" style={{ color }}>{val}</div>
          </div>
        ))}
      </div>

      {/* Chart — Orders & Deposits */}
      {stats?.chartData?.length > 0 && (
        <div className="adm-card mb-6" style={{ background: dark ? "rgba(255,255,255,.09)" : "rgba(255,255,255,.85)", border: `0.5px solid ${dark ? "rgba(255,255,255,.16)" : "rgba(0,0,0,.12)"}` }}>
          <div className="set-card-header flex justify-between items-center" style={{ background: dark ? "rgba(196,125,142,.18)" : "rgba(196,125,142,.12)", borderBottom: `1px solid ${dark ? "rgba(255,255,255,.12)" : "rgba(0,0,0,.08)"}` }}>
            <div className="set-card-title" style={{ color: t.textMuted }}>Orders & Deposits</div>
            <div className="flex gap-3 text-xs" style={{ color: t.textMuted }}>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm" style={{ background: dark ? "rgba(196,125,142,0.5)" : "rgba(196,125,142,0.6)" }} />Orders</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm" style={{ background: "#059669" }} />Deposits</span>
            </div>
          </div>
          <div className="set-card-body">
            <div className="relative h-60">
              <canvas ref={chartRef} />
            </div>
          </div>
        </div>
      )}

      <div className="adm-grid-2 mt-6">
        <div>
          <div className="adm-card" style={{ background: dark ? "rgba(255,255,255,.09)" : "rgba(255,255,255,.85)", border: `0.5px solid ${dark ? "rgba(255,255,255,.16)" : "rgba(0,0,0,.12)"}` }}>
            <div className="set-card-header" style={{ background: dark ? "rgba(196,125,142,.18)" : "rgba(196,125,142,.12)", borderBottom: `1px solid ${dark ? "rgba(255,255,255,.12)" : "rgba(0,0,0,.08)"}` }}>
              <div className="set-card-title" style={{ color: t.textMuted }}>Top platforms</div>
            </div>
            {(s.topPlatforms || []).length > 0 ? s.topPlatforms.map((p, i, arr) => (
              <div key={p.name} className="adm-list-row" style={{ borderBottom: i < arr.length - 1 ? `1px solid ${t.cardBorder}` : "none" }}>
                <div><div className="text-[15px] font-medium" style={{ color: t.text }}>{p.name}</div><div className="text-sm" style={{ color: t.textMuted }}>{p.orders} orders</div></div>
                <div className="text-[15px] font-semibold" style={{ color: t.green }}>{fN(p.revenue || 0)}</div>
              </div>
            )) : <div className="py-8 px-5 text-center">
              <svg width="36" height="36" viewBox="0 0 64 64" fill="none" style={{ display: "block", margin: "0 auto 10px", opacity: .7 }}>
                <rect x="6" y="28" width="14" height="24" rx="3" stroke={t.accent} strokeWidth="1.5" opacity=".2" />
                <rect x="25" y="12" width="14" height="40" rx="3" stroke={t.accent} strokeWidth="1.5" opacity=".3" />
                <rect x="44" y="20" width="14" height="32" rx="3" stroke={t.accent} strokeWidth="1.5" opacity=".25" />
              </svg>
              <div className="text-sm font-semibold" style={{ color: t.textSoft }}>No platform data yet</div>
            </div>}
          </div>
        </div>
        <div>
          <div className="adm-card" style={{ background: dark ? "rgba(255,255,255,.09)" : "rgba(255,255,255,.85)", border: `0.5px solid ${dark ? "rgba(255,255,255,.16)" : "rgba(0,0,0,.12)"}` }}>
            <div className="set-card-header" style={{ background: dark ? "rgba(196,125,142,.18)" : "rgba(196,125,142,.12)", borderBottom: `1px solid ${dark ? "rgba(255,255,255,.12)" : "rgba(0,0,0,.08)"}` }}>
              <div className="set-card-title" style={{ color: t.textMuted }}>Order status breakdown</div>
            </div>
            {[["Completed", s.byStatus?.find(x => x.status === "Completed")?.count || 0, t.green], ["Processing", s.byStatus?.find(x => x.status === "Processing")?.count || 0, t.blue], ["Pending", s.byStatus?.find(x => x.status === "Pending")?.count || 0, t.amber], ["Cancelled", s.byStatus?.find(x => x.status === "Cancelled")?.count || 0, dark ? "#fca5a5" : "#dc2626"]].map(([label, count, color], i, arr) => (
              <div key={label} className="adm-list-row" style={{ borderBottom: i < arr.length - 1 ? `1px solid ${t.cardBorder}` : "none" }}>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full" style={{ background: color }} />
                  <span className="text-[15px]" style={{ color: t.text }}>{label}</span>
                </div>
                <span className="text-[15px] font-semibold" style={{ color }}>{count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Top Services */}
      {(s.topServices || []).length > 0 && (
        <div className="mt-6">
          <div className="adm-card" style={{ background: dark ? "rgba(255,255,255,.09)" : "rgba(255,255,255,.85)", border: `0.5px solid ${dark ? "rgba(255,255,255,.16)" : "rgba(0,0,0,.12)"}` }}>
            <div className="set-card-header" style={{ background: dark ? "rgba(196,125,142,.18)" : "rgba(196,125,142,.12)", borderBottom: `1px solid ${dark ? "rgba(255,255,255,.12)" : "rgba(0,0,0,.08)"}` }}>
              <div className="set-card-title" style={{ color: t.textMuted }}>Top services by revenue</div>
            </div>
            {s.topServices.map((sv, i, arr) => (
              <div key={i} className="adm-list-row" style={{ borderBottom: i < arr.length - 1 ? `1px solid ${t.cardBorder}` : "none" }}>
                <div className="flex-1 min-w-0">
                  <div className="text-[15px] font-medium truncate" style={{ color: t.text }}>{sv.name}</div>
                  <div className="text-[13px]" style={{ color: t.textMuted }}>{sv.category} · {sv.orders} orders</div>
                </div>
                <div className="text-[15px] font-semibold" style={{ color: t.green }}>{fN(sv.revenue || 0)}</div>
              </div>
            ))}
          </div>
        </div>
      )}
      </>}
    </>
  );
}

/* ═══════════════════════════════════════════ */
/* ═══ ALERTS PAGE                         ═══ */
/* ═══════════════════════════════════════════ */
export function AdminAlertsPage({ dark, t }) {
  const confirm = useConfirm();
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(null);
  const [newMsg, setNewMsg] = useState("");
  const [newType, setNewType] = useState("info");
  const [newActionLabel, setNewActionLabel] = useState("");
  const [newActionHref, setNewActionHref] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/admin/alerts").then(r => r.json()).then(d => { setAlerts(d.alerts || []); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  const createAlert = async (target) => {
    if (!newMsg.trim() || saving) return;
    setSaving(true);
    try {
      const body = { action: "create", message: newMsg, type: newType, target };
      if (newActionLabel.trim() && newActionHref.trim()) {
        body.actionLabel = newActionLabel;
        body.actionHref = newActionHref;
      }
      const res = await fetch("/api/admin/alerts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json();
      if (res.ok && data.alert) {
        setAlerts(prev => [data.alert, ...prev.map(a => {
          if (target === "everyone") return { ...a, active: false };
          if (a.target === target) return { ...a, active: false };
          return a;
        })]);
        setNewMsg(""); setCreating(null); setNewType("info"); setNewActionLabel(""); setNewActionHref("");
      }
    } catch {}
    setSaving(false);
  };

  const toggleAlert = async (id, active, target) => {
    try {
      await fetch("/api/admin/alerts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "toggle", id }) });
      if (!active) {
        // Activating: if everyone → pause all others, otherwise pause same-target
        setAlerts(prev => prev.map(a => {
          if (a.id === id) return { ...a, active: true };
          if (target === "everyone") return { ...a, active: false };
          if (a.target === target && a.active) return { ...a, active: false };
          return a;
        }));
      } else {
        setAlerts(prev => prev.map(a => a.id === id ? { ...a, active: false } : a));
      }
    } catch {}
  };

  const deleteAlert = async (id) => {
    try {
      await fetch("/api/admin/alerts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "delete", id }) });
      setAlerts(prev => prev.filter(a => a.id !== id));
    } catch {}
  };

  const typeColors = { info: t.accent, warning: dark ? "#fbbf24" : "#d97706", success: dark ? "#6ee7b7" : "#059669", urgent: dark ? "#fca5a5" : "#dc2626" };
  const typeIcons = {
    info: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>,
    warning: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>,
    success: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>,
    urgent: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="7.86 2 16.14 2 22 7.86 22 16.14 16.14 22 7.86 22 2 16.14 2 7.86 7.86 2"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>,
  };
  const typeSvgs = {
    info: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>,
    warning: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>,
    success: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>,
    urgent: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="7.86 2 16.14 2 22 7.86 22 16.14 16.14 22 7.86 22 2 16.14 2 7.86 7.86 2"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>,
  };

  const [histPage, setHistPage] = useState({});
  const getActive = (target) => alerts.find(a => a.target === target && a.active);
  const getHistory = (target) => alerts.filter(a => a.target === target && !a.active);
  const everyoneActive = getActive("everyone");

  const renderSlotCard = (target, title, desc, isOverride) => {
    const active = getActive(target);
    const history = getHistory(target);
    const isCreating = creating === target;
    const cardBorder = isOverride ? (dark ? "rgba(251,191,36,.24)" : "rgba(217,119,6,.19)") : t.cardBorder;
    const cardBg = isOverride ? (dark ? "rgba(251,191,36,.03)" : "rgba(217,119,6,.02)") : (dark ? "rgba(255,255,255,.05)" : "rgba(255,255,255,.85)");
    const inputBg = dark ? "#131728" : "#fff";

    return (
        <div key={target} className="set-card" style={{ background: cardBg, border: `0.5px solid ${cardBorder}` }}>
          <div className="set-card-header" style={{ background: dark ? "rgba(196,125,142,.18)" : "rgba(196,125,142,.12)", borderBottom: `1px solid ${dark ? "rgba(255,255,255,.12)" : "rgba(0,0,0,.08)"}` }}>
            <div className="set-card-title" style={{ color: isOverride ? (dark ? "#fbbf24" : "#d97706") : t.textMuted }}>{isOverride ? <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{display:"inline",verticalAlign:"middle"}}><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>{" "}</> : ""}{title}</div>
            <div className="set-card-desc" style={{ color: t.textMuted }}>{desc}</div>
          </div>
          <div className="set-card-body">

          {active ? (
            <>
              <div className="flex items-center gap-2.5 py-3 px-3.5 rounded-[10px] mb-3" style={{
                background: dark ? `${typeColors[active.type]}15` : `${typeColors[active.type]}08`,
                border: `1px solid ${dark ? `${typeColors[active.type]}40` : `${typeColors[active.type]}30`}`,
                borderLeft: `3px solid ${typeColors[active.type]}`,
              }}>
                <span className="shrink-0" style={{ color: typeColors[active.type] }}>{typeIcons[active.type] || typeIcons.info}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium" style={{ color: t.text }}>
                    {active.message.split(/(\*[^*]+\*)/).map((p, i) => p.startsWith('*') && p.endsWith('*') ? <strong key={i}>{p.slice(1, -1)}</strong> : p)}
                    {active.actionLabel && active.actionHref && <span className="text-xs font-semibold ml-1.5" style={{ color: typeColors[active.type] }}>{active.actionLabel}</span>}
                  </div>
                  <div className="flex items-center gap-2 mt-1.5">
                    <span className="text-[11px] font-semibold py-0.5 px-2 rounded-md" style={{ background: dark ? "rgba(110,231,183,.12)" : "rgba(5,150,105,.06)", color: dark ? "#6ee7b7" : "#059669" }}>Live</span>
                    {active.created && <span className="text-[11px]" style={{ color: t.textMuted }}>{fD(active.created)}</span>}
                  </div>
                </div>
              </div>
              <div className={`flex gap-1.5 flex-wrap ${history.length > 0 ? "mb-3" : ""}`}>
                <button onClick={() => toggleAlert(active.id, true, target)} className="adm-btn-sm" style={{ borderColor: dark ? "rgba(251,191,36,.24)" : "rgba(217,119,6,.19)", color: dark ? "#fbbf24" : "#d97706" }}>Pause</button>
                <button onClick={async () => { const ok = await confirm({ title: "Delete Alert", message: `Delete "${active.message?.slice(0, 50)}..."?`, confirmLabel: "Delete", danger: true }); if (ok) deleteAlert(active.id); }} className="adm-btn-sm" style={{ borderColor: dark ? "rgba(252,165,165,.28)" : "rgba(220,38,38,.24)", color: dark ? "#fca5a5" : "#dc2626" }}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg></button>
                <button onClick={() => { setCreating(target); setNewMsg(""); setNewType("info"); setNewActionLabel(""); setNewActionHref(""); }} className="adm-btn-sm ml-auto" style={{ borderColor: t.cardBorder, color: t.accent }}>+ New</button>
              </div>
            </>
          ) : (
            <div className="flex items-center gap-2 mb-3">
              <div className="w-1.5 h-1.5 rounded-full" style={{ background: t.textMuted }} />
              <span className="text-[13px]" style={{ color: t.textMuted }}>No active alert</span>
              <button onClick={() => { setCreating(target); setNewMsg(""); setNewType("info"); setNewActionLabel(""); setNewActionHref(""); }} className="adm-btn-primary ml-auto text-xs py-1.5 px-3.5">+ Create</button>
            </div>
          )}

          {isCreating && (
            <div className="mt-2 pt-3" style={{ borderTop: `1px solid ${dark ? "rgba(255,255,255,.12)" : "rgba(0,0,0,.08)"}` }}>
              {active && (
                <div className="flex items-center gap-2 text-xs mb-3 py-2 px-3 rounded-lg" style={{ background: dark ? "rgba(251,191,36,.06)" : "rgba(217,119,6,.04)", color: dark ? "#fbbf24" : "#d97706" }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                  Current alert will be auto-paused when you create a new one.
                </div>
              )}
              <textarea value={newMsg} onChange={e => setNewMsg(e.target.value)} placeholder="What do you want to announce?" rows={3} className="w-full py-2.5 px-3.5 rounded-lg border text-sm outline-none resize-y font-[inherit] box-border mb-1.5" style={{ borderColor: t.cardBorder, background: inputBg, color: t.text }} />
              <div className="text-[11px] mb-3" style={{ color: t.textMuted }}>Wrap text in <code className="py-0.5 px-1 rounded text-[10px]" style={{ background: dark ? "rgba(255,255,255,.08)" : "rgba(0,0,0,.05)" }}>*asterisks*</code> for <strong>bold</strong></div>
              <div className="flex gap-2 mb-3">
                <input value={newActionLabel} onChange={e => setNewActionLabel(e.target.value)} placeholder="Link text (optional)" className="flex-1 py-2 px-3 rounded-lg border text-[13px] outline-none font-[inherit] box-border" style={{ borderColor: t.cardBorder, background: inputBg, color: t.text }} />
                <input value={newActionHref} onChange={e => setNewActionHref(e.target.value)} placeholder="URL, e.g. /services" className="flex-[2] py-2 px-3 rounded-lg border text-[13px] outline-none font-[inherit] box-border" style={{ borderColor: t.cardBorder, background: inputBg, color: t.text }} />
              </div>
              <div className="flex gap-1.5 mb-3">
                {[["info", "Info"], ["success", "Success"], ["warning", "Warning"], ["urgent", "Urgent"]].map(([ty, label]) => (
                  <button key={ty} onClick={() => setNewType(ty)} className="flex-1 py-2 rounded-lg text-xs font-semibold cursor-pointer border font-[inherit] transition-transform duration-150 hover:-translate-y-px flex items-center justify-center gap-1.5" style={{
                    borderColor: newType === ty ? typeColors[ty] : t.cardBorder,
                    background: newType === ty ? (dark ? `${typeColors[ty]}15` : `${typeColors[ty]}08`) : "transparent",
                    color: newType === ty ? typeColors[ty] : t.textMuted,
                  }}><span style={{ color: newType === ty ? typeColors[ty] : t.textMuted }}>{typeSvgs[ty]}</span> {label}</button>
                ))}
              </div>
              <div className="flex gap-2">
                <button onClick={() => createAlert(target)} disabled={!newMsg.trim() || saving} className="adm-btn-primary flex-1 text-[13px]" style={{ opacity: newMsg.trim() && !saving ? 1 : .4 }}>{saving ? "Creating..." : isOverride ? "Create override" : "Create alert"}</button>
                <button onClick={() => setCreating(null)} className="adm-btn-sm" style={{ borderColor: t.cardBorder, color: t.textSoft }}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
              </div>
            </div>
          )}

          {history.length > 0 && (() => {
            const PER_PAGE = 3;
            const page = histPage[target] || 0;
            const totalPages = Math.ceil(history.length / PER_PAGE);
            const slice = history.slice(page * PER_PAGE, (page + 1) * PER_PAGE);
            return (
            <>
              <div className="flex items-center gap-2 mt-3.5 mb-2">
                <div className="text-[11px] font-semibold tracking-[1.5px] uppercase py-1 px-2 rounded" style={{ color: t.textMuted, background: dark ? "rgba(255,255,255,.07)" : "rgba(0,0,0,.03)" }}>History</div>
                {totalPages > 1 && <span className="text-[11px] ml-auto" style={{ color: t.textMuted }}>{page + 1}/{totalPages}</span>}
              </div>
              {slice.map(a => (
                <div key={a.id} className="flex items-center gap-2 py-2 text-[13px]" style={{ borderBottom: `1px solid ${dark ? "rgba(255,255,255,.09)" : "rgba(0,0,0,.05)"}` }}>
                  <span className="shrink-0" style={{ color: typeColors[a.type] || t.textMuted }}>{typeSvgs[a.type] || typeSvgs.info}</span>
                  <span className="flex-1 truncate" style={{ color: t.textMuted }}>{a.message}</span>
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => toggleAlert(a.id, false, target)} className="adm-btn-sm py-[3px] px-2 text-[11px]" style={{ borderColor: t.cardBorder, color: dark ? "#6ee7b7" : "#059669" }}>Reactivate</button>
                    <button onClick={async () => { const ok = await confirm({ title: "Delete", message: `Delete this alert?`, confirmLabel: "Delete", danger: true }); if (ok) deleteAlert(a.id); }} className="adm-btn-sm py-[3px] px-2 text-[11px]" style={{ borderColor: dark ? "rgba(252,165,165,.24)" : "rgba(220,38,38,.18)", color: dark ? "#fca5a5" : "#dc2626" }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
                    </button>
                  </div>
                </div>
              ))}
              {totalPages > 1 && (
                <div className="flex items-center justify-end gap-1.5 mt-2">
                  <button onClick={() => setHistPage(p => ({ ...p, [target]: Math.max(0, page - 1) }))} disabled={page === 0} className="adm-btn-sm py-[3px] px-2 text-[11px]" style={{ borderColor: t.cardBorder, color: t.textMuted, opacity: page === 0 ? .3 : 1 }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
                  </button>
                  <button onClick={() => setHistPage(p => ({ ...p, [target]: Math.min(totalPages - 1, page + 1) }))} disabled={page >= totalPages - 1} className="adm-btn-sm py-[3px] px-2 text-[11px]" style={{ borderColor: t.cardBorder, color: t.textMuted, opacity: page >= totalPages - 1 ? .3 : 1 }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
                  </button>
                </div>
              )}
            </>
            );
          })()}
          </div>
        </div>
    );
  };

  if (loading) return <><div className="adm-header"><div className="adm-title" style={{ color: t.text }}>Announcements</div><div className="adm-subtitle" style={{ color: t.textMuted }}>Loading...</div><div className="page-divider" style={{ background: t.cardBorder }} /></div><div>{[1,2,3].map(i => <div key={i} className={`skel-bone ${dark ? "skel-dark" : "skel-light"} h-[60px] rounded-[10px] mb-2`} />)}</div></>;

  return (
    <>
      <div className="adm-header">
        <div>
          <div className="adm-title" style={{ color: t.text }}>Announcements</div>
          <div className="adm-subtitle" style={{ color: t.textMuted }}>Manage banners for each audience independently</div>
        </div>
        <div className="page-divider" style={{ background: t.cardBorder }} />
      </div>

      {everyoneActive && (
        <div className="text-xs mb-2 flex items-center gap-1.5" style={{ color: dark ? "#fbbf24" : "#d97706" }}>
          <span><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg></span> Everyone override is active — individual slot alerts are hidden while this is live.
        </div>
      )}

      <div className="grid grid-cols-2 max-md:grid-cols-1 gap-4">
        {renderSlotCard("everyone", "Everyone override", "Overrides all slots. Shows on landing page, user dashboard, and admin panel simultaneously.", true)}
        {renderSlotCard("landing", "Landing page", "Shown to visitors on the landing page before they log in.")}
        {renderSlotCard("users", "Users", "Shown to logged-in users across all dashboard pages.")}
        {renderSlotCard("admin", "Admin", "Internal notes shown only in the admin panel.")}
      </div>
    </>
  );
}

/* ═══════════════════════════════════════════ */
/* ═══ SETTINGS PAGE                       ═══ */
/* ═══════════════════════════════════════════ */
function CleanupButton({ dark, t }) {
  const [info, setInfo] = useState(null);
  const [cleaning, setCleaning] = useState(false);
  const [result, setResult] = useState(null);

  useEffect(() => {
    fetch("/api/admin/cleanup").then(r => r.json()).then(d => setInfo(d)).catch(() => {});
  }, []);

  const run = async () => {
    setCleaning(true); setResult(null);
    try {
      const res = await fetch("/api/admin/cleanup", { method: "POST" });
      const data = await res.json();
      setResult(res.ok ? { type: "success", text: data.message } : { type: "error", text: data.error });
      if (res.ok) fetch("/api/admin/cleanup").then(r => r.json()).then(d => setInfo(d)).catch(() => {});
    } catch { setResult({ type: "error", text: "Failed" }); }
    setCleaning(false);
  };

  return (
    <>
      {info && <div className="text-sm mb-2.5" style={{ color: t.text }}>{info.unverifiedTotal || 0} unverified accounts total · {info.staleCount || 0} safe to remove after {info.cutoffDays || 30} days</div>}
      {result && <div className="py-2 px-3 rounded-lg mb-2.5 text-sm" style={{ background: result.type === "success" ? (dark ? "rgba(110,231,183,.08)" : "#ecfdf5") : (dark ? "rgba(220,38,38,.08)" : "#fef2f2"), color: result.type === "success" ? (dark ? "#6ee7b7" : "#059669") : (dark ? "#fca5a5" : "#dc2626") }}>{result.type === "success" ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{display:"inline",verticalAlign:"middle"}}><polyline points="20 6 9 17 4 12"/></svg> : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{display:"inline",verticalAlign:"middle"}}><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>} {result.text}</div>}
      <button onClick={run} disabled={cleaning} className="adm-btn-primary" style={{ opacity: cleaning ? .5 : 1 }}>{cleaning ? "Cleaning..." : "Clean Up Stale Accounts"}</button>
    </>
  );
}

export function AdminSettingsPage({ admin, dark, t, themeMode, setThemeMode, setDark, onLogout, notifPrefs, updateNotifPref }) {
  const confirm = useConfirm();
  const [social, setSocial] = useState({ social_instagram: "", social_twitter: "", social_whatsapp_support: "", social_whatsapp_channel: "", social_telegram_support: "" });
  const [emails, setEmails] = useState({ site_email_general: "", site_email_support: "" });
  const [socialLoading, setSocialLoading] = useState(true);
  const [socialSaving, setSocialSaving] = useState(false);
  const [socialMsg, setSocialMsg] = useState(null);
  const [emailSaving, setEmailSaving] = useState(false);
  const [emailMsg, setEmailMsg] = useState(null);
  const [winback, setWinback] = useState({ winback30_pct: "15", winback30_min_naira: "100", winback30_cap_naira: "500", winback60_pct: "25", winback60_min_naira: "150", winback60_cap_naira: "1000", winback_credit_expiry_days: "7" });
  const [winbackSaving, setWinbackSaving] = useState(false);
  const [winbackMsg, setWinbackMsg] = useState(null);

  useEffect(() => {
    fetch("/api/admin/settings").then(r => r.json()).then(d => {
      if (d.settings) {
        setSocial(prev => ({ ...prev, ...Object.fromEntries(Object.entries(d.settings).filter(([k]) => k.startsWith("social_"))) }));
        setEmails(prev => ({ ...prev, ...Object.fromEntries(Object.entries(d.settings).filter(([k]) => k.startsWith("site_email_"))) }));
        setWinback(prev => ({ ...prev, ...Object.fromEntries(Object.entries(d.settings).filter(([k]) => k.startsWith("winback"))) }));
      }
    }).finally(() => setSocialLoading(false));
  }, []);

  const saveSocial = async () => {
    setSocialSaving(true); setSocialMsg(null);
    try {
      const res = await fetch("/api/admin/settings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ settings: social }) });
      const data = await res.json();
      setSocialMsg(res.ok ? { type: "success", text: "Social links saved" } : { type: "error", text: data.error || "Failed" });
    } catch { setSocialMsg({ type: "error", text: "Request failed" }); }
    setSocialSaving(false);
  };

  const saveEmails = async () => {
    setEmailSaving(true); setEmailMsg(null);
    try {
      const res = await fetch("/api/admin/settings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ settings: emails }) });
      const data = await res.json();
      setEmailMsg(res.ok ? { type: "success", text: "Contact emails saved" } : { type: "error", text: data.error || "Failed" });
    } catch { setEmailMsg({ type: "error", text: "Request failed" }); }
    setEmailSaving(false);
  };

  const saveWinback = async () => {
    setWinbackSaving(true); setWinbackMsg(null);
    try {
      const res = await fetch("/api/admin/settings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ settings: winback }) });
      const data = await res.json();
      setWinbackMsg(res.ok ? { type: "success", text: "Win-back settings saved" } : { type: "error", text: data.error || "Failed" });
    } catch { setWinbackMsg({ type: "error", text: "Request failed" }); }
    setWinbackSaving(false);
  };

  const applyTheme = (mode) => {
    setThemeMode(mode);
    try { localStorage.setItem("nitro-admin-theme", mode); } catch {}
    if (mode === "day") setDark(false);
    else if (mode === "night") setDark(true);
    else { const h = new Date().getHours(), m = new Date().getMinutes(); setDark(h >= 19 || h < 6 || (h === 6 && m < 30) || (h === 18 && m >= 30)); }
  };

  // Profile edit
  const [editName, setEditName] = useState(admin?.name || "");
  const [editEmail, setEditEmail] = useState(admin?.email || "");
  const [profileEditing, setProfileEditing] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMsg, setProfileMsg] = useState(null);

  useEffect(() => { setEditName(admin?.name || ""); setEditEmail(admin?.email || ""); }, [admin?.name, admin?.email]);

  const saveProfile = async () => {
    setProfileSaving(true); setProfileMsg(null);
    try {
      const res = await fetch("/api/auth/admin/profile", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "update-profile", name: editName, email: editEmail }) });
      const data = await res.json();
      if (res.ok) { setProfileMsg({ type: "success", text: "Profile updated" }); setProfileEditing(false); } else setProfileMsg({ type: "error", text: data.error || "Failed" });
    } catch { setProfileMsg({ type: "error", text: "Request failed" }); }
    setProfileSaving(false);
  };

  // Change password
  const [admCurPw, setAdmCurPw] = useState("");
  const [admNewPw, setAdmNewPw] = useState("");
  const [admConfPw, setAdmConfPw] = useState("");
  const [pwSaving, setPwSaving] = useState(false);
  const [admPwMsg, setAdmPwMsg] = useState(null);

  const changeAdmPw = async () => {
    setAdmPwMsg(null);
    if (!admCurPw || !admNewPw || !admConfPw) { setAdmPwMsg({ type: "error", text: "All fields required" }); return; }
    if (admNewPw !== admConfPw) { setAdmPwMsg({ type: "error", text: "New passwords don't match" }); return; }
    if (admNewPw.length < 6) { setAdmPwMsg({ type: "error", text: "Minimum 6 characters" }); return; }
    setPwSaving(true);
    try {
      const res = await fetch("/api/auth/admin/profile", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "change-password", currentPassword: admCurPw, newPassword: admNewPw }) });
      const data = await res.json();
      if (res.ok) { setAdmPwMsg({ type: "success", text: "Password updated" }); setAdmCurPw(""); setAdmNewPw(""); setAdmConfPw(""); } else setAdmPwMsg({ type: "error", text: data.error || "Failed" });
    } catch { setAdmPwMsg({ type: "error", text: "Request failed" }); }
    setPwSaving(false);
  };

  const cardBg = dark ? "rgba(255,255,255,.09)" : "rgba(255,255,255,.85)";
  const cardBorder = `0.5px solid ${t.cardBorder}`;
  const admInputStyle = { borderColor: t.cardBorder, background: dark ? "#131728" : "#fff", color: t.text };

  return (
    <>
      <div className="adm-header">
        <div className="adm-title" style={{ color: t.text }}>Settings</div>
        <div className="adm-subtitle" style={{ color: t.textMuted }}>Admin preferences and configuration</div>
        <div className="page-divider" style={{ background: t.cardBorder }} />
      </div>

      {/* ── PROFILE HERO ── */}
      <div className="mb-4 overflow-hidden rounded-[14px] max-desktop:rounded-xl" style={{ background: cardBg, border: cardBorder }}>
        <div className="h-[72px] max-md:h-16" style={{ background: "linear-gradient(135deg, #c47d8e 0%, #a3586b 50%, #8b5e6b 100%)" }} />
        <div className="px-5 pb-5 max-desktop:px-4 max-desktop:pb-4">
          <div className="w-[56px] h-[56px] max-md:w-12 max-md:h-12 rounded-2xl flex items-center justify-center text-white shrink-0 shadow-lg border-[3px] -mt-8 max-md:-mt-7 mb-3" style={{ background: "linear-gradient(135deg, #c47d8e, #8b5e6b)", borderColor: dark ? "#0e1225" : "#f3f0ec" }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
          </div>
          {profileMsg && <InlineAlert type={profileMsg.type} dark={dark} className="mb-3">{profileMsg.text}</InlineAlert>}
          {profileEditing ? (
            <>
              <div className="mb-3">
                <label className="text-sm block mb-1" style={{ color: t.textMuted }}>Name</label>
                <input value={editName} onChange={e => setEditName(e.target.value)} className="w-full py-2.5 px-3.5 rounded-lg text-[15px] outline-none border" style={admInputStyle} />
              </div>
              <div className="mb-3">
                <label className="text-sm block mb-1" style={{ color: t.textMuted }}>Email</label>
                <input value={editEmail} onChange={e => setEditEmail(e.target.value)} className="w-full py-2.5 px-3.5 rounded-lg text-[15px] outline-none border" style={admInputStyle} />
              </div>
              <div className="mb-2">
                <div className="text-[13px] uppercase tracking-wide mb-0.5" style={{ color: t.textMuted }}>Role</div>
                <div className="text-[15px] font-medium" style={{ color: t.textMuted }}>{admin?.role || "admin"} (cannot be changed)</div>
              </div>
              <div className="flex gap-2 mt-3.5">
                <button onClick={saveProfile} disabled={profileSaving} className="adm-btn-primary" style={{ opacity: profileSaving ? .5 : 1 }}>{profileSaving ? "Saving..." : "Save"}</button>
                <button onClick={() => { setProfileEditing(false); setEditName(admin?.name || ""); setEditEmail(admin?.email || ""); setProfileMsg(null); }} className="py-2 px-4 rounded-lg bg-none text-sm cursor-pointer transition-transform duration-200 hover:-translate-y-px flex items-center justify-center" style={{ border: `1px solid ${t.cardBorder}`, color: t.textSoft }}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center justify-between mb-1">
                <div className="text-lg font-semibold" style={{ color: t.text }}>{admin?.name || "Admin"}</div>
                <button onClick={() => setProfileEditing(true)} className="text-[13px] bg-none border-none cursor-pointer transition-transform duration-200 hover:-translate-y-px flex items-center gap-1" style={{ color: t.accent }}><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
              </div>
              <div className="grid grid-cols-3 max-md:grid-cols-1 gap-y-3 gap-x-6 mt-3">
                {[["Email", admin?.email || ""], ["Role", admin?.role || "admin"]].map(([label, val]) => (
                  <div key={label}><div className="text-[11px] font-semibold tracking-[.8px] uppercase mb-[3px]" style={{ color: t.textMuted }}>{label}</div><div className="text-[15px] font-medium" style={{ color: t.text }}>{val}</div></div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── SETTINGS GRID ── */}
      <div className="grid grid-cols-2 max-md:grid-cols-1 gap-4">

        {/* ── NOTIFICATIONS ── */}
        <div className="set-card" style={{ background: cardBg, border: cardBorder }}>
          <div className="set-card-header" style={{ background: dark ? "rgba(196,125,142,.18)" : "rgba(196,125,142,.12)", borderBottom: `1px solid ${dark ? "rgba(255,255,255,.12)" : "rgba(0,0,0,.08)"}` }}>
            <div className="set-card-title" style={{ color: t.textMuted }}>Notifications</div>
            <div className="set-card-desc" style={{ color: t.textMuted }}>Choose which events trigger alerts for you.</div>
          </div>
          <div className="set-card-body">
          {notifPrefs && updateNotifPref ? (
            <div className="flex flex-col gap-3">
              {[
                ["new_ticket", "New tickets", "Alert when a user opens a new support ticket"],
                ["ticket_reply", "Ticket replies", "Alert when a user sends a new message in a ticket"],
                ["deposit", "Deposits", "Alert when a user completes a deposit"],
                ["large_deposit", "Large deposits", "Alert for deposits above the large-deposit threshold"],
                ["stale_ticket", "Stale tickets", "Escalation alert for unanswered tickets (15+ min)"],
                ["price_alert", "Price alerts", "Alert when services are selling below provider cost"],
              ].map(([key, label, hint]) => (
                <label key={key} className="flex items-center justify-between gap-3 cursor-pointer py-1.5">
                  <div>
                    <div className="text-[14px] font-medium" style={{ color: t.text }}>{label}</div>
                    <div className="text-[12px] mt-0.5" style={{ color: t.textMuted }}>{hint}</div>
                  </div>
                  <button
                    onClick={() => updateNotifPref(key, !notifPrefs[key])}
                    className="relative shrink-0 w-[40px] h-[22px] rounded-full transition-colors duration-200"
                    style={{ background: notifPrefs[key] ? t.accent : (dark ? "rgba(255,255,255,.15)" : "rgba(0,0,0,.12)") }}
                  >
                    <span className="absolute top-[2px] left-[2px] w-[18px] h-[18px] rounded-full bg-white shadow-sm transition-transform duration-200" style={{ transform: notifPrefs[key] ? "translateX(18px)" : "translateX(0)" }} />
                  </button>
                </label>
              ))}
            </div>
          ) : (
            <div className="text-sm" style={{ color: t.textMuted }}>Notification preferences unavailable.</div>
          )}
          </div>
        </div>

        {/* ── CHANGE PASSWORD ── */}
        <div className="set-card" style={{ background: cardBg, border: cardBorder }}>
          <div className="set-card-header" style={{ background: dark ? "rgba(196,125,142,.18)" : "rgba(196,125,142,.12)", borderBottom: `1px solid ${dark ? "rgba(255,255,255,.12)" : "rgba(0,0,0,.08)"}` }}>
            <div className="set-card-title" style={{ color: t.textMuted }}>Change password</div>
            <div className="set-card-desc" style={{ color: t.textMuted }}>Update your admin password regularly.</div>
          </div>
          <div className="set-card-body">
          {admPwMsg && <InlineAlert type={admPwMsg.type} dark={dark} className="mb-3">{admPwMsg.text}</InlineAlert>}
          <div className="mb-3">
            <label className="text-sm block mb-1" style={{ color: t.textMuted }}>Current Password</label>
            <input type="password" value={admCurPw} onChange={e => setAdmCurPw(e.target.value)} className="w-full py-2.5 px-3.5 rounded-lg text-[15px] outline-none border" style={admInputStyle} />
          </div>
          <div className="mb-3">
            <label className="text-sm block mb-1" style={{ color: t.textMuted }}>New Password</label>
            <input type="password" value={admNewPw} onChange={e => setAdmNewPw(e.target.value)} className="w-full py-2.5 px-3.5 rounded-lg text-[15px] outline-none border" style={admInputStyle} />
          </div>
          <div className="mb-3">
            <label className="text-sm block mb-1" style={{ color: t.textMuted }}>Confirm Password</label>
            <input type="password" value={admConfPw} onChange={e => setAdmConfPw(e.target.value)} className="w-full py-2.5 px-3.5 rounded-lg text-[15px] outline-none border" style={admInputStyle} />
          </div>
          <button onClick={changeAdmPw} disabled={pwSaving} className="adm-btn-primary" style={{ opacity: admCurPw && admNewPw && admConfPw && !pwSaving ? 1 : .4 }}>{pwSaving ? "Updating..." : "Update Password"}</button>
          </div>
        </div>

        {/* ── CONTACT EMAILS ── */}
        <div className="set-card" style={{ background: cardBg, border: cardBorder }}>
          <div className="set-card-header" style={{ background: dark ? "rgba(196,125,142,.18)" : "rgba(196,125,142,.12)", borderBottom: `1px solid ${dark ? "rgba(255,255,255,.12)" : "rgba(0,0,0,.08)"}` }}>
            <div className="set-card-title" style={{ color: t.textMuted }}>Contact emails</div>
            <div className="set-card-desc" style={{ color: t.textMuted }}>Shown across the site — landing page, support, legal pages, and account notices</div>
          </div>
          <div className="set-card-body">
          {emailMsg && <InlineAlert type={emailMsg.type} dark={dark} className="mb-3">{emailMsg.text}</InlineAlert>}
          {[
            ["site_email_general", "General Email", "info@nitro.ng", "Main contact email shown on landing page and legal pages"],
            ["site_email_support", "Support Email", "support@nitro.ng", "Support-specific email shown on support, tickets, and banned account pages"],
          ].map(([key, label, placeholder, hint]) => (
            <div key={key} className="mb-3">
              <label className="text-sm block mb-0.5" style={{ color: t.textMuted }}>{label}</label>
              <input value={emails[key] || ""} onChange={e => setEmails(prev => ({ ...prev, [key]: e.target.value.trim() }))} placeholder={placeholder} type="email" className="w-full py-2.5 px-3.5 rounded-lg text-[15px] outline-none border font-[inherit]" style={admInputStyle} />
              <div className="text-xs mt-0.5 opacity-70" style={{ color: t.textMuted }}>{hint}</div>
            </div>
          ))}
          <button onClick={saveEmails} disabled={emailSaving} className="adm-btn-primary" style={{ opacity: emailSaving ? .5 : 1 }}>{emailSaving ? "Saving..." : "Save Emails"}</button>
          </div>
        </div>

        {/* ── SOCIAL LINKS ── */}
        <div className="set-card" style={{ background: cardBg, border: cardBorder }}>
          <div className="set-card-header" style={{ background: dark ? "rgba(196,125,142,.18)" : "rgba(196,125,142,.12)", borderBottom: `1px solid ${dark ? "rgba(255,255,255,.12)" : "rgba(0,0,0,.08)"}` }}>
            <div className="set-card-title" style={{ color: t.textMuted }}>Social links & community</div>
            <div className="set-card-desc" style={{ color: t.textMuted }}>Shown in sidebar, landing page footer, and support page. Leave blank to hide.</div>
          </div>
          <div className="set-card-body">
          {socialMsg && <InlineAlert type={socialMsg.type} dark={dark} className="mb-3">{socialMsg.text}</InlineAlert>}
          {[
            ["social_instagram", "Instagram Handle", "Nitro.ng", "Handle, @handle, or full URL — all work"],
            ["social_twitter", "X / Twitter Handle", "TheNitroNG", "Handle, @handle, or full URL — all work"],
            ["social_whatsapp_support", "WhatsApp Number", "2348012345678", "Any format — spaces, dashes, + prefix all stripped automatically"],
            ["social_whatsapp_channel", "WhatsApp Channel URL", "https://whatsapp.com/channel/...", "Full URL to your WhatsApp channel page"],
            ["social_telegram_support", "Telegram Handle", "TheNitroNG", "Handle, @handle, or full URL — all work"],
          ].map(([key, label, placeholder, hint]) => (
            <div key={key} className="mb-3">
              <label className="text-sm block mb-0.5" style={{ color: t.textMuted }}>{label}</label>
              <input value={social[key] || ""} onChange={e => setSocial(prev => ({ ...prev, [key]: e.target.value }))} placeholder={placeholder} className="w-full py-2.5 px-3.5 rounded-lg text-[15px] outline-none border font-[inherit]" style={admInputStyle} />
              <div className="text-xs mt-0.5 opacity-70" style={{ color: t.textMuted }}>{hint}</div>
            </div>
          ))}
          <button onClick={saveSocial} disabled={socialSaving} className="adm-btn-primary" style={{ opacity: socialSaving ? .5 : 1 }}>{socialSaving ? "Saving..." : "Save Social Links"}</button>
          </div>
        </div>

        {/* ── WIN-BACK CREDITS ── */}
        <div className="set-card" style={{ background: cardBg, border: cardBorder }}>
          <div className="set-card-header" style={{ background: dark ? "rgba(196,125,142,.18)" : "rgba(196,125,142,.12)", borderBottom: `1px solid ${dark ? "rgba(255,255,255,.12)" : "rgba(0,0,0,.08)"}` }}>
            <div className="set-card-title" style={{ color: t.textMuted }}>Win-back credits</div>
            <div className="set-card-desc" style={{ color: t.textMuted }}>Configure bonus credit amounts for the automated win-back sequence (Play 7).</div>
          </div>
          <div className="set-card-body">
          {winbackMsg && <InlineAlert type={winbackMsg.type} dark={dark} className="mb-3">{winbackMsg.text}</InlineAlert>}
          <div className="text-[11px] font-semibold tracking-[.8px] uppercase mb-2" style={{ color: t.textMuted }}>Day 30 touch</div>
          {[
            ["winback30_pct", "Credit %", "15", "Percentage of lifetime spend"],
            ["winback30_min_naira", "Floor (₦)", "100", "Minimum credit in naira"],
            ["winback30_cap_naira", "Cap (₦)", "500", "Maximum credit in naira"],
          ].map(([key, label, placeholder, hint]) => (
            <div key={key} className="mb-3">
              <label className="text-sm block mb-0.5" style={{ color: t.textMuted }}>{label}</label>
              <input value={winback[key] || ""} onChange={e => setWinback(prev => ({ ...prev, [key]: e.target.value }))} placeholder={placeholder} type="number" className="w-full py-2.5 px-3.5 rounded-lg text-[15px] outline-none border font-[inherit]" style={admInputStyle} />
              <div className="text-xs mt-0.5 opacity-70" style={{ color: t.textMuted }}>{hint}</div>
            </div>
          ))}
          <div className="text-[11px] font-semibold tracking-[.8px] uppercase mb-2 mt-4" style={{ color: t.textMuted }}>Day 60 touch</div>
          {[
            ["winback60_pct", "Credit %", "25", "Percentage of lifetime spend"],
            ["winback60_min_naira", "Floor (₦)", "150", "Minimum credit in naira"],
            ["winback60_cap_naira", "Cap (₦)", "1000", "Maximum credit in naira"],
          ].map(([key, label, placeholder, hint]) => (
            <div key={key} className="mb-3">
              <label className="text-sm block mb-0.5" style={{ color: t.textMuted }}>{label}</label>
              <input value={winback[key] || ""} onChange={e => setWinback(prev => ({ ...prev, [key]: e.target.value }))} placeholder={placeholder} type="number" className="w-full py-2.5 px-3.5 rounded-lg text-[15px] outline-none border font-[inherit]" style={admInputStyle} />
              <div className="text-xs mt-0.5 opacity-70" style={{ color: t.textMuted }}>{hint}</div>
            </div>
          ))}
          <div className="text-[11px] font-semibold tracking-[.8px] uppercase mb-2 mt-4" style={{ color: t.textMuted }}>General</div>
          <div className="mb-3">
            <label className="text-sm block mb-0.5" style={{ color: t.textMuted }}>Expiry (days)</label>
            <input value={winback["winback_credit_expiry_days"] || ""} onChange={e => setWinback(prev => ({ ...prev, winback_credit_expiry_days: e.target.value }))} placeholder="7" type="number" className="w-full py-2.5 px-3.5 rounded-lg text-[15px] outline-none border font-[inherit]" style={admInputStyle} />
            <div className="text-xs mt-0.5 opacity-70" style={{ color: t.textMuted }}>Days before bonus credit expires</div>
          </div>
          <button onClick={saveWinback} disabled={winbackSaving} className="adm-btn-primary" style={{ opacity: winbackSaving ? .5 : 1 }}>{winbackSaving ? "Saving..." : "Save Win-back Settings"}</button>
          </div>
        </div>

        {/* ── THEME ── */}
        <div className="set-card" style={{ background: cardBg, border: cardBorder }}>
          <div className="set-card-header" style={{ background: dark ? "rgba(196,125,142,.18)" : "rgba(196,125,142,.12)", borderBottom: `1px solid ${dark ? "rgba(255,255,255,.12)" : "rgba(0,0,0,.08)"}` }}>
            <div className="set-card-title" style={{ color: t.textMuted }}>Theme</div>
            <div className="set-card-desc" style={{ color: t.textMuted }}>Choose how Nitro looks for you.</div>
          </div>
          <div className="set-card-body">
          <div className="flex gap-2">
            {[
              ["day", "Light", <svg key="s" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>],
              ["night", "Dark", <svg key="m" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/></svg>],
              ["auto", "Auto", <svg key="a" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 3a9 9 0 000 18z" fill="currentColor" opacity=".4"/></svg>],
            ].map(([id, lb, icon]) => (
              <button key={id} onClick={() => applyTheme(id)} className="flex-1 py-3 px-2.5 rounded-[10px] border text-[15px] flex items-center justify-center gap-1.5" style={{ borderColor: themeMode === id ? t.accent : t.cardBorder, background: themeMode === id ? (dark ? "#2a1a22" : "#fdf2f4") : (dark ? "rgba(255,255,255,.12)" : "rgba(255,255,255,.8)"), color: themeMode === id ? t.accent : t.textSoft, fontWeight: themeMode === id ? 600 : 500 }}>{icon} {lb}</button>
            ))}
          </div>
          </div>
        </div>

        {/* ── CLEANUP ── */}
        <div className="set-card" style={{ background: cardBg, border: cardBorder }}>
          <div className="set-card-header" style={{ background: dark ? "rgba(196,125,142,.18)" : "rgba(196,125,142,.12)", borderBottom: `1px solid ${dark ? "rgba(255,255,255,.12)" : "rgba(0,0,0,.08)"}` }}>
            <div className="set-card-title" style={{ color: t.textMuted }}>Cleanup</div>
            <div className="set-card-desc" style={{ color: t.textMuted }}>Free up space by removing stale accounts.</div>
          </div>
          <div className="set-card-body">
          <div className="text-sm mb-3 leading-normal" style={{ color: t.textMuted }}>Remove abandoned, unverified signups older than 30 days only when they have no recent activity or related records.</div>
          <CleanupButton dark={dark} t={t} />
          </div>
        </div>

      </div>

      {/* ── LOG OUT ── */}
      <div className="mt-4">
        <button onClick={onLogout} className="flex items-center justify-center gap-2 w-full py-3 px-5 rounded-[10px] bg-none cursor-pointer text-[15px] font-semibold font-[inherit] transition-transform duration-200 hover:-translate-y-px" style={{ border: `1px solid ${dark ? "rgba(252,165,165,.28)" : "rgba(220,38,38,.24)"}`, color: dark ? "#fca5a5" : "#dc2626" }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
          Log out
        </button>
      </div>
    </>
  );
}

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

  const green = dark ? "#6ee7b7" : "#059669";
  const red = dark ? "#fca5a5" : "#dc2626";
  const amber = dark ? "#fbbf24" : "#d97706";
  const blue = dark ? "#93c5fd" : "#2563eb";
  const cardBg = dark ? "rgba(255,255,255,.05)" : "rgba(255,255,255,.85)";
  const cardBorder = dark ? "rgba(255,255,255,.16)" : "rgba(0,0,0,.12)";
  const subText = dark ? "rgba(255,255,255,.35)" : "rgba(0,0,0,.35)";
  const rowBorder = dark ? "rgba(255,255,255,.12)" : "rgba(0,0,0,.08)";
  const sectionHeading = "text-xs font-semibold uppercase tracking-[1.5px] mb-2.5";

  const DropdownFilter = ({ value, onChange, options }) => (
    <FilterDropdown dark={dark} t={t} value={value} onChange={onChange} options={options} />
  );

  const MetricCard = ({ label, value, sub, color }) => (
    <div className="py-3.5 px-4 rounded-xl" style={{ background: cardBg, border: `0.5px solid ${cardBorder}` }}>
      <div className="text-[10px] font-semibold uppercase tracking-[1px] mb-1.5" style={{ color: subText }}>{label}</div>
      <div className="m text-xl font-bold" style={{ color: color || t.text }}>{value}</div>
      {sub && <div className="text-[11px] mt-[3px]" style={{ color: subText }}>{sub}</div>}
    </div>
  );

  const MiniBar = ({ value, max, color }) => (
    <div className="h-[3px] rounded-sm overflow-hidden" style={{ background: dark ? "rgba(255,255,255,.09)" : "rgba(0,0,0,.06)" }}>
      <div className="h-full rounded-sm" style={{ width: `${Math.min((value / (max || 1)) * 100, 100)}%`, background: color }} />
    </div>
  );

  const s = stats || {};
  const p = s.profitability || {};
  const mIn = s.moneyIn || {};
  const mOut = s.moneyOut || {};
  const wObl = s.walletObligations || {};
  const lib = s.liability || {};
  const totalIn = (mIn.deposits || 0) + (mIn.adminCredits || 0);
  const totalOut = (mOut.providerTopups || 0);
  const totalWalletObl = (wObl.refunds || 0) + (wObl.couponBonuses || 0) + (wObl.referralBonuses || 0) + (wObl.adminGifts || 0);

  return (
    <>
      {/* Filters */}
      <div className="flex gap-2 mb-5 flex-wrap justify-end">
        <DateRangePicker dark={dark} t={t} value={dateValue} onChange={setDateValue} defaultPreset="This month" />
        <DropdownFilter value={platform} onChange={setPlatform} options={[
          { value: "all", label: "All platforms" }, { value: "instagram", label: "Instagram" },
          { value: "tiktok", label: "TikTok" }, { value: "youtube", label: "YouTube" },
          { value: "twitter", label: "Twitter/X" }, { value: "telegram", label: "Telegram" },
          { value: "facebook", label: "Facebook" }, { value: "spotify", label: "Spotify" },
        ]} />
        <DropdownFilter value={tier} onChange={setTier} options={[
          { value: "all", label: "All tiers" }, { value: "budget", label: "Budget" },
          { value: "standard", label: "Standard" }, { value: "premium", label: "Premium" },
        ]} />
        <DropdownFilter value={provider} onChange={setProvider} options={[
          { value: "all", label: "All providers" }, { value: "mtp", label: "MTP" },
          { value: "jap", label: "JAP" }, { value: "dao", label: "DaoSMM" },
        ]} />
        {['owner', 'superadmin'].includes(admin?.role) && (
          <div className="relative" ref={csvMenuRef}>
            <button onClick={() => setCsvMenuOpen(o => !o)} disabled={reportLoading} className="h-9 px-3.5 rounded-lg text-xs font-semibold cursor-pointer font-[inherit] transition-transform duration-200 hover:-translate-y-px disabled:opacity-60" style={{ background: dark ? "rgba(52,211,153,.12)" : "rgba(5,150,105,.08)", border: `1px solid ${dark ? "rgba(52,211,153,.28)" : "rgba(5,150,105,.18)"}`, color: green }}>
              {reportLoading ? "Preparing..." : "↓ Finance CSV"}
            </button>
            {csvMenuOpen && (
              <div className="absolute right-0 top-full mt-1 rounded-lg p-2.5 z-50 min-w-[180px]" style={{ background: dark ? "#1e1e2e" : "#fff", border: `1px solid ${cardBorder}`, boxShadow: "0 4px 16px rgba(0,0,0,.18)" }}>
                <div className="text-[10px] font-semibold uppercase tracking-[1px] mb-2" style={{ color: subText }}>Include sections</div>
                {[["wallet", "Wallet"], ["orders", "Orders"], ["points", "Nitro Points"], ["provider", "Provider Top-ups"], ["affiliate", "Affiliate"], ["liabilities", "Liabilities"]].map(([key, label]) => (
                  <label key={key} className="flex items-center gap-2 py-1 text-xs cursor-pointer" style={{ color: t.text }}>
                    <input type="checkbox" checked={csvSections[key]} onChange={() => setCsvSections(s => ({ ...s, [key]: !s[key] }))} className="rounded" />
                    {label}
                  </label>
                ))}
                <button onClick={downloadReport} disabled={reportLoading} className="mt-2 w-full h-8 rounded-md text-xs font-semibold cursor-pointer" style={{ background: green, color: dark ? "#111" : "#fff" }}>
                  Download
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {loading ? <div className="adm-stats">{[1,2,3,4,5,6].map(i => <div key={i} className={`skel-bone ${dark ? "skel-dark" : "skel-light"} h-20 rounded-xl`} />)}</div> : <>

      {/* Profitability */}
      <div className={sectionHeading} style={{ color: subText }}>Profitability</div>
      <div className="adm-stats mb-5">
        <MetricCard label="Gross Revenue" value={fN(p.grossRevenue || 0)} sub="Before discounts" />
        <MetricCard label="Discounts" value={fN(p.totalDiscounts || 0)} sub={`Promo ₦${(p.promoDiscounts || 0).toLocaleString()} | Status ₦${(p.loyaltyDiscounts || 0).toLocaleString()}`} color={amber} />
        <MetricCard label="Net Revenue" value={fN(p.netRevenue || 0)} sub="What users actually paid" color={green} />
        <MetricCard label="Provider Cost" value={fN(p.totalCost || 0)} sub="MTP + JAP + DAO" color={red} />
        <MetricCard label="Gross Profit" value={fN(p.grossProfit || 0)} sub={`${p.margin || 0}% markup`} color={p.grossProfit >= 0 ? green : red} />
        <MetricCard label="Per Order" value={fN(p.profitPerOrder || 0)} sub={`${p.orderCount || 0} orders | ${p.refundRate || 0}% refund rate`} />
      </div>

      {/* Money In / Money Out */}
      <div className="adm-grid-2 mb-5">
        <div>
          <div className="rounded-[14px] py-3.5 px-4" style={{ background: cardBg, border: `0.5px solid ${cardBorder}` }}>
            <div className="text-[11px] font-semibold uppercase tracking-[1px] mb-3 flex items-center gap-1.5" style={{ color: green }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 014-4h14"/></svg>
              Money In
            </div>
            {[
              ["Deposits", mIn.deposits],
              ["Admin Credits", mIn.adminCredits],
            ].map(([label, val]) => (
              <div key={label} className="flex justify-between py-[7px]" style={{ borderBottom: `0.5px solid ${rowBorder}` }}>
                <span className="text-[13px]" style={{ color: dark ? "rgba(255,255,255,.6)" : "rgba(0,0,0,.5)" }}>{label}</span>
                <span className="m text-[13px] font-semibold" style={{ color: green }}>{fN(val || 0)}</span>
              </div>
            ))}
            <div className="flex justify-between pt-2.5 pb-0.5 mt-1">
              <span className="text-[13px] font-bold" style={{ color: dark ? "rgba(255,255,255,.7)" : "rgba(0,0,0,.7)" }}>Total In</span>
              <span className="m text-[15px] font-bold" style={{ color: green }}>{fN(totalIn)}</span>
            </div>
          </div>
        </div>
        <div>
          <div className="rounded-[14px] py-3.5 px-4" style={{ background: cardBg, border: `0.5px solid ${cardBorder}` }}>
            <div className="text-[11px] font-semibold uppercase tracking-[1px] mb-3 flex items-center gap-1.5" style={{ color: red }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 01-4 4H3"/></svg>
              Money Out
            </div>
            {[
              ["Provider Top-ups", mOut.providerTopups],
              ["Est. Provider Cost", mOut.providerCosts],
            ].map(([label, val]) => (
              <div key={label} className="flex justify-between py-[7px]" style={{ borderBottom: `0.5px solid ${rowBorder}` }}>
                <span className="text-[13px]" style={{ color: dark ? "rgba(255,255,255,.6)" : "rgba(0,0,0,.5)" }}>{label}</span>
                <span className="m text-[13px] font-semibold" style={{ color: red }}>{fN(val || 0)}</span>
              </div>
            ))}
            <div className="flex justify-between pt-2.5 pb-0.5 mt-1">
              <span className="text-[13px] font-bold" style={{ color: dark ? "rgba(255,255,255,.7)" : "rgba(0,0,0,.7)" }}>Total Cash Out</span>
              <span className="m text-[15px] font-bold" style={{ color: red }}>{fN(totalOut)}</span>
            </div>
            <div className="text-[11px] font-semibold uppercase tracking-[1px] mt-4 mb-2 flex items-center gap-1.5" style={{ color: amber }}>
              Wallet Obligations
            </div>
            {[
              ["Order Refunds", wObl.refunds],
              ["Coupon Bonuses", wObl.couponBonuses],
              ["Referral Bonuses", wObl.referralBonuses],
              ["Admin Gifts", wObl.adminGifts],
            ].map(([label, val]) => (
              <div key={label} className="flex justify-between py-[7px]" style={{ borderBottom: `0.5px solid ${rowBorder}` }}>
                <span className="text-[13px]" style={{ color: dark ? "rgba(255,255,255,.6)" : "rgba(0,0,0,.5)" }}>{label}</span>
                <span className="m text-[13px] font-semibold" style={{ color: amber }}>{fN(val || 0)}</span>
              </div>
            ))}
            <div className="flex justify-between pt-2.5 pb-0.5 mt-1">
              <span className="text-[13px] font-bold" style={{ color: dark ? "rgba(255,255,255,.7)" : "rgba(0,0,0,.7)" }}>Total Obligations</span>
              <span className="m text-[15px] font-bold" style={{ color: amber }}>{fN(totalWalletObl)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Record Top-up */}
      <div className="rounded-[14px] py-3.5 px-4 mb-5" style={{ background: cardBg, border: `0.5px solid ${cardBorder}` }}>
        <div className="text-[11px] font-semibold uppercase tracking-[1px] mb-3" style={{ color: subText }}>Record Provider Top-up</div>
        <div className="flex gap-2 items-end flex-wrap max-sm:flex-col max-sm:items-stretch">
          <div className="flex gap-2 items-end">
            <select value={topupProvider} onChange={e => setTopupProvider(e.target.value)} className="h-9 rounded-lg px-2.5 text-[13px] outline-none" style={{ background: dark ? "rgba(255,255,255,.08)" : "rgba(0,0,0,.04)", border: `0.5px solid ${cardBorder}`, color: t.text }}>
              <option value="dao">DaoSMM</option>
              <option value="mtp">MTP</option>
              <option value="jap">JAP</option>
            </select>
            <input type="number" placeholder="Amount (₦)" value={topupAmount} onChange={e => setTopupAmount(e.target.value)} className="h-9 rounded-lg px-2.5 text-[13px] w-32 outline-none" style={{ background: dark ? "rgba(255,255,255,.08)" : "rgba(0,0,0,.04)", border: `0.5px solid ${cardBorder}`, color: t.text }} />
          </div>
          <div className="flex gap-2 items-end flex-1 min-w-0">
            <input type="text" placeholder="Note (optional)" value={topupNote} onChange={e => setTopupNote(e.target.value)} className="h-9 rounded-lg px-2.5 text-[13px] flex-1 min-w-0 outline-none" style={{ background: dark ? "rgba(255,255,255,.08)" : "rgba(0,0,0,.04)", border: `0.5px solid ${cardBorder}`, color: t.text }} />
            <button onClick={handleTopup} disabled={topupSaving || !topupAmount} className="h-9 px-4 rounded-lg text-[13px] font-semibold text-white shrink-0" style={{ background: t.accent, opacity: topupSaving || !topupAmount ? 0.5 : 1 }}>
              {topupSaving ? "Saving..." : "Record"}
            </button>
          </div>
        </div>
      </div>

      {/* Liability */}
      <div className={sectionHeading} style={{ color: subText }}>Liability & Cash</div>
      <div className="adm-stats mb-5">
        <MetricCard label="Wallet Liability" value={fN(lib.walletBalances || 0)} sub={`${lib.walletUsers || 0} users with balance`} color={amber} />
        <MetricCard label="Net Cash Flow" value={fN(totalIn - totalOut)} sub="Money in - Money out" color={totalIn - totalOut >= 0 ? green : red} />
        <MetricCard label="Retained Profit" value={fN((p.grossProfit || 0))} sub={`${p.margin || 0}% markup`} color={green} />
      </div>

      {/* Profit by Platform */}
      {(s.byPlatform || []).length > 0 && <>
        <div className={`${sectionHeading} mt-1`} style={{ color: subText }}>Profit by platform</div>
        <div className="adm-card mb-5 overflow-hidden" style={{ background: cardBg, border: `0.5px solid ${cardBorder}` }}>
          {/* Header */}
          <div className="fin-table-header grid grid-cols-[2fr_1fr_1fr_1fr_0.7fr_0.6fr] py-2.5 px-3.5" style={{ borderBottom: `0.5px solid ${dark ? "rgba(255,255,255,.16)" : "rgba(0,0,0,.12)"}` }}>
            {["Platform", "Revenue", "Cost", "Profit", "Orders", "Markup"].map(h => (
              <div key={h} className="text-[10px] font-semibold uppercase tracking-[1px]" style={{ color: subText, textAlign: h !== "Platform" ? "right" : "left" }}>{h}</div>
            ))}
          </div>
          {s.byPlatform.map((pl, i) => (
            <div key={pl.name}>
              <div className="fin-table-row grid grid-cols-[2fr_1fr_1fr_1fr_0.7fr_0.6fr] py-2.5 px-3.5" style={{ borderBottom: i < s.byPlatform.length - 1 ? `0.5px solid ${rowBorder}` : "none" }}>
                <div className="text-[13px] font-semibold" style={{ color: t.text }}>{pl.name}</div>
                <div className="m text-xs text-right" style={{ color: dark ? "rgba(255,255,255,.6)" : "rgba(0,0,0,.6)" }}>{fN(pl.revenue || 0)}</div>
                <div className="m text-xs text-right" style={{ color: red }}>{fN(pl.cost || 0)}</div>
                <div className="m text-xs text-right font-semibold" style={{ color: green }}>{fN(pl.profit || 0)}</div>
                <div className="text-xs text-right" style={{ color: dark ? "rgba(255,255,255,.6)" : "rgba(0,0,0,.5)" }}>{pl.orders}</div>
                <div className="text-xs text-right font-semibold" style={{ color: (pl.margin || 0) >= 100 ? green : amber }}>{pl.margin || 0}%</div>
              </div>
              <div className="px-3.5 pb-1.5"><MiniBar value={pl.profit || 0} max={(s.byPlatform[0]?.profit || 1)} color={t.accent} /></div>
            </div>
          ))}
        </div>
      </>}

      {/* Profit by Tier */}
      {(s.byTier || []).length > 0 && <>
        <div className={sectionHeading} style={{ color: subText }}>Profit by tier</div>
        <div className="adm-stats mb-5">
          {s.byTier.map(tr => {
            const tierColor = tr.name === "Budget" ? "#f59e0b" : tr.name === "Standard" ? "#3b82f6" : "#8b5cf6";
            return (
              <div key={tr.name} className="py-3.5 px-4 rounded-xl" style={{ background: cardBg, border: `0.5px solid ${cardBorder}` }}>
                <div className="flex items-center gap-1.5 mb-2">
                  <div className="w-2 h-2 rounded-full" style={{ background: tierColor }} />
                  <span className="text-[13px] font-semibold" style={{ color: t.text }}>{tr.name}</span>
                </div>
                <div className="m text-lg font-bold mb-[3px]" style={{ color: green }}>{fN(tr.profit || 0)}</div>
                <div className="text-[11px] mb-2" style={{ color: subText }}>{tr.orders} orders · {tr.margin || 0}% markup</div>
                <MiniBar value={tr.margin || 0} max={Math.max(...(s.byTier || []).map(t => t.margin || 0), 100)} color={tierColor} />
                <div className="flex justify-between mt-2 text-[11px]" style={{ color: subText }}>
                  <span>Rev: {fN(tr.revenue || 0)}</span>
                  <span>Cost: {fN(tr.cost || 0)}</span>
                </div>
              </div>
            );
          })}
        </div>
      </>}

      {/* Top Spenders */}
      {(s.topSpenders || []).length > 0 && <>
        <div className={sectionHeading} style={{ color: subText }}>Top spenders</div>
        <div className="adm-card overflow-hidden" style={{ background: cardBg, border: `0.5px solid ${cardBorder}` }}>
          {s.topSpenders.map((sp, i) => (
            <div key={i} className="flex items-center gap-3 py-2.5 px-3.5" style={{ borderBottom: i < s.topSpenders.length - 1 ? `0.5px solid ${rowBorder}` : "none" }}>
              <div className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0" style={{ background: dark ? "rgba(196,125,142,.1)" : "rgba(196,125,142,.06)", color: t.accent }}>{i + 1}</div>
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-semibold overflow-hidden text-ellipsis whitespace-nowrap" style={{ color: t.text }}>{sp.name}</div>
                <div className="text-[11px]" style={{ color: subText }}>{sp.orders} orders</div>
              </div>
              <div className="m text-sm font-bold shrink-0" style={{ color: green }}>{fN(sp.spent || 0)}</div>
            </div>
          ))}
        </div>
      </>}
      </>}
    </>
  );
}

function FinanceRewardsTab({ dark, t }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const reqRef = useRef(0);

  const load = (fromVal, toVal) => {
    const reqId = ++reqRef.current;
    setLoading(true);
    const params = new URLSearchParams({ view: 'summary' });
    if (fromVal) params.set('from', fromVal);
    if (toVal) params.set('to', toVal);
    fetch(`/api/admin/rewards?${params}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (reqId === reqRef.current) { setData(d); setLoading(false); } })
      .catch(() => { if (reqId === reqRef.current) setLoading(false); });
  };

  useEffect(() => { load(from, to); }, []);

  const cardBg = dark ? 'rgba(255,255,255,.06)' : '#fff';
  const cardBd = `1px solid ${dark ? 'rgba(255,255,255,.1)' : 'rgba(0,0,0,.08)'}`;

  const TYPES = [
    { key: 'earned_order', label: 'Earned', color: t.green },
    { key: 'redeemed_order', label: 'Redeemed', color: t.red },
    { key: 'reversed_refund', label: 'Reversed', color: t.amber },
    { key: 'restored_refund', label: 'Restored', color: t.green },
    { key: 'manual_credit', label: 'Manual credit', color: t.accent },
    { key: 'manual_debit', label: 'Manual debit', color: t.red },
  ];

  const koboToNaira = (kobo) => Math.round((kobo || 0) / 100);
  const cost = data?.cost || {};
  const checkout = cost.checkoutReductions || {};
  const movement = cost.pointsMovement || {};
  const accrual = cost.accrualRewardCost || {};
  const movementColor = (movement.netLiabilityChangeKobo || 0) >= 0 ? t.amber : t.green;
  const fSignedKobo = (kobo) => `${(kobo || 0) < 0 ? '-' : ''}${fN(koboToNaira(kobo))}`;
  const fPts = (points) => (Number(points) || 0).toLocaleString(undefined, { maximumFractionDigits: 2 });

  return (
    <div className="p-6 max-w-[900px]">
      {/* Date filter */}
      <div className="flex flex-wrap gap-2 mb-5 items-center">
        <span className="text-[12px] font-semibold uppercase tracking-[0.5px]" style={{ color: t.textMuted }}>Period</span>
        <input type="date" value={from} onChange={e => { setFrom(e.target.value); load(e.target.value, to); }} className="py-1.5 px-2.5 rounded-lg text-[12px] outline-none font-[inherit]" style={{ border: cardBd, background: cardBg, color: t.text }} />
        <span className="text-[11px]" style={{ color: t.textMuted }}>to</span>
        <input type="date" value={to} onChange={e => { setTo(e.target.value); load(from, e.target.value); }} className="py-1.5 px-2.5 rounded-lg text-[12px] outline-none font-[inherit]" style={{ border: cardBd, background: cardBg, color: t.text }} />
        {(from || to) && <button onClick={() => { setFrom(''); setTo(''); load('', ''); }} className="text-[11px] font-semibold cursor-pointer font-[inherit] border-none bg-transparent" style={{ color: t.accent }}>Clear</button>}
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1,2,3].map(i => <div key={i} className={`skel-bone ${dark ? 'skel-dark' : 'skel-light'}`} style={{ height: 60, borderRadius: 10 }} />)}
        </div>
      ) : data ? (
        <>
          {/* Liability card */}
          <div className="rounded-xl p-5 mb-5" style={{ background: dark ? 'rgba(196,125,142,.1)' : 'rgba(196,125,142,.05)', border: `1px solid ${dark ? 'rgba(196,125,142,.2)' : 'rgba(196,125,142,.12)'}` }}>
            <div className="text-[11px] font-semibold uppercase tracking-[0.5px] mb-1" style={{ color: t.textMuted }}>Outstanding Points Liability</div>
            <div className="text-[28px] font-bold" style={{ color: t.accent, fontFamily: 'JetBrains Mono, monospace' }}>{fPts(data.liability.points || 0)} <span className="text-[14px] font-medium" style={{ color: t.textSoft }}>pts</span></div>
            <div className="text-[13px] mt-1" style={{ color: t.textSoft }}>₦{fPts(data.liability.points || 0)} redeemable value</div>
          </div>

          {/* Cost reporting */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
            <div className="rounded-xl p-4" style={{ background: cardBg, border: cardBd }}>
              <div className="text-[10px] font-semibold uppercase tracking-[0.5px] mb-1" style={{ color: t.textMuted }}>Reward cost</div>
              <div className="text-[20px] font-bold" style={{ color: t.red, fontFamily: 'JetBrains Mono, monospace' }}>{fN(koboToNaira(accrual.kobo))}</div>
              <div className="text-[11px] mt-0.5" style={{ color: t.textSoft }}>Status/campaign discounts + points issued</div>
            </div>
            <div className="rounded-xl p-4" style={{ background: cardBg, border: cardBd }}>
              <div className="text-[10px] font-semibold uppercase tracking-[0.5px] mb-1" style={{ color: t.textMuted }}>Checkout reductions</div>
              <div className="text-[20px] font-bold" style={{ color: t.amber, fontFamily: 'JetBrains Mono, monospace' }}>{fN(koboToNaira(checkout.totalKobo))}</div>
              <div className="text-[11px] mt-0.5" style={{ color: t.textSoft }}>Discounts + points used at checkout</div>
            </div>
            <div className="rounded-xl p-4" style={{ background: cardBg, border: cardBd }}>
              <div className="text-[10px] font-semibold uppercase tracking-[0.5px] mb-1" style={{ color: t.textMuted }}>Net points liability change</div>
              <div className="text-[20px] font-bold" style={{ color: movementColor, fontFamily: 'JetBrains Mono, monospace' }}>{fSignedKobo(movement.netLiabilityChangeKobo)}</div>
              <div className="text-[11px] mt-0.5" style={{ color: t.textSoft }}>{(movement.netLiabilityChangeKobo || 0) >= 0 ? 'Liability increased' : 'Liability reduced'} this period</div>
            </div>
          </div>

          <div className="rounded-xl p-4 mb-5" style={{ background: cardBg, border: cardBd }}>
            <div className="text-[11px] font-semibold uppercase tracking-[0.5px] mb-3" style={{ color: t.textMuted }}>Monthly rewards report breakdown</div>
            {[
              ['Nitro Status discounts', checkout.statusDiscountKobo, 'Immediate revenue reduction on orders', t.amber],
              ['Campaign discounts', checkout.campaignDiscountKobo, 'Platform/recurring promotion reduction', t.amber],
              ['Points redeemed at checkout', checkout.pointsRedeemedKobo, 'Existing liability used to pay for orders', t.red],
              ['Points earned from orders', movement.earnedKobo, 'New points liability created by spend', t.green],
              ['Manual point credits', movement.manualCreditKobo, 'Admin-issued points liability', t.accent],
              ['Opening balances', movement.openingBalanceKobo, 'Imported/launch points liability', t.accent],
              ['Points restored on refunds', movement.restoredKobo, 'Redeemed points returned after refunds', t.green],
              ['Earned points reversed', movement.reversedKobo, 'Earned points removed after refunds', t.red],
              ['Manual point debits', movement.manualDebitKobo, 'Admin-reduced liability', t.red],
            ].map(([label, kobo, note, color]) => (
              <div key={label} className="flex items-start justify-between gap-3 py-2.5" style={{ borderBottom: `1px solid ${dark ? 'rgba(255,255,255,.08)' : 'rgba(0,0,0,.06)'}` }}>
                <div>
                  <div className="text-[13px] font-semibold" style={{ color: t.text }}>{label}</div>
                  <div className="text-[11px] mt-0.5" style={{ color: t.textSoft }}>{note}</div>
                </div>
                <div className="text-[13px] font-bold text-right whitespace-nowrap" style={{ color, fontFamily: 'JetBrains Mono, monospace' }}>{fN(koboToNaira(kobo))}</div>
              </div>
            ))}
            <div className="text-[11px] mt-3 leading-relaxed" style={{ color: t.textMuted }}>
              Reward cost excludes points redeemed because those points were already counted when issued. Checkout reductions include points redeemed so cash collected can still be reconciled.
            </div>
          </div>

          {/* Movement metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {TYPES.map(({ key, label, color }) => {
              const entry = data.byType?.[key];
              if (!entry) return null;
              const pts = Math.abs(Math.round((entry.kobo || 0) / 100));
              return (
                <div key={key} className="rounded-xl p-4" style={{ background: cardBg, border: cardBd }}>
                  <div className="text-[10px] font-semibold uppercase tracking-[0.5px] mb-1" style={{ color: t.textMuted }}>{label}</div>
                  <div className="text-[18px] font-bold" style={{ color, fontFamily: 'JetBrains Mono, monospace' }}>{pts.toLocaleString()}</div>
                  <div className="text-[11px] mt-0.5" style={{ color: t.textSoft }}>{entry.count} {entry.count === 1 ? 'entry' : 'entries'}</div>
                </div>
              );
            })}
          </div>

          {data.dateFiltered && (
            <div className="mt-4 text-[11px]" style={{ color: t.textMuted }}>Metrics filtered by date range. Liability is always the current total.</div>
          )}
        </>
      ) : (
        <div className="py-8 text-center text-[13px]" style={{ color: t.textMuted }}>Could not load rewards data</div>
      )}
    </div>
  );
}
