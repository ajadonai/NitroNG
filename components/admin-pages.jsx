'use client';
import { useState, useEffect, useRef } from "react";
import { useConfirm } from "./confirm-dialog";
import { useToast } from "./toast";
import { fN, fD } from "../lib/format";
import { SegPill } from "./seg-pill";
import { DateRangePicker, FilterDropdown } from "./date-range-picker";

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
