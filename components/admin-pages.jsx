'use client';
import { useState, useEffect, useRef } from "react";
import { useConfirm } from "./confirm-dialog";
import { useToast } from "./toast";
import { fN, fD } from "../lib/format";

const ADM_SELECT = "py-[7px] pl-[10px] pr-[28px] rounded-lg text-[13px] font-medium appearance-none cursor-pointer font-[inherit] bg-no-repeat bg-[right_8px_center]";

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
  const [dateRange, setDateRange] = useState("all");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [canApprove, setCanApprove] = useState(false);
  const [canConfigure, setCanConfigure] = useState(false);

  const getDateRange = (range, cf, ct) => {
    const now = new Date();
    let from = "", to = "";
    if (range === "today") { from = now.toISOString().split("T")[0]; }
    else if (range === "7d") { const d = new Date(now - 7*24*60*60*1000); from = d.toISOString().split("T")[0]; }
    else if (range === "30d") { const d = new Date(now - 30*24*60*60*1000); from = d.toISOString().split("T")[0]; }
    else if (range === "90d") { const d = new Date(now - 90*24*60*60*1000); from = d.toISOString().split("T")[0]; }
    else if (range === "custom") { from = cf || customFrom; to = ct || customTo; }
    return { from, to };
  };

  const refresh = (s, st, range, cf, ct) => {
    const params = new URLSearchParams();
    if (s || search) params.set("search", s ?? search);
    if ((st ?? statusFilter) !== "all") params.set("status", st ?? statusFilter);
    const { from, to } = getDateRange(range ?? dateRange, cf, ct);
    if (from) params.set("from", from);
    if (to) params.set("to", to);
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
  }, [tab]);

  const doSearch = () => refresh(search, statusFilter, dateRange);
  const changeStatus = (s) => { setStatusFilter(s); refresh(search, s, dateRange); };
  const changeDateRange = (r) => { setDateRange(r); if (r !== "custom") refresh(search, statusFilter, r); };

  const downloadCSV = () => {
    const rows = [["Date", "Reference", "User", "Email", "Amount", "Method", "Status", "Approved/Rejected By", "Bank Ref"]];
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
    const ok = await confirm({ title: "Approve deposit?", message: `Credit ₦${tx.amount.toLocaleString()} to ${tx.user} (${tx.email})?\nRef: ${tx.reference}${tx.senderRef ? `\nBank ref: ${tx.senderRef}` : ""}`, confirmText: "Approve", danger: false });
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
  const statusColors = { Pending: { bg: dark ? "rgba(251,191,36,.08)" : "rgba(217,119,6,.04)", color: dark ? "#fbbf24" : "#d97706" }, Completed: { bg: dark ? "rgba(110,231,183,.08)" : "rgba(5,150,105,.04)", color: dark ? "#6ee7b7" : "#059669" }, Failed: { bg: dark ? "rgba(220,38,38,.08)" : "rgba(220,38,38,.04)", color: dark ? "#fca5a5" : "#dc2626" } };

  return (
    <>
      <div className="adm-header">
        <div className="adm-header-row">
          <div>
            <div className="adm-title" style={{ color: t.text }}>Payments</div>
            <div className="adm-subtitle" style={{ color: t.textMuted }}>Manage deposits and payment gateways</div>
          </div>
          <div className="flex gap-1">
            <button onClick={() => setTab("deposits")} className="py-2 px-5 rounded-lg text-[13px] cursor-pointer font-[inherit] flex items-center gap-1.5" style={{ fontWeight: tab === "deposits" ? 600 : 400, background: tab === "deposits" ? (dark ? "rgba(196,125,142,.12)" : "rgba(196,125,142,.08)") : "transparent", color: tab === "deposits" ? t.accent : t.textMuted, border: `1px solid ${tab === "deposits" ? (dark ? "rgba(196,125,142,.2)" : "rgba(196,125,142,.15)") : "transparent"}` }}>
              Deposits
              {pendingCount > 0 && <span className="text-[11px] py-px px-1.5 rounded-[10px] font-bold" style={{ background: dark ? "rgba(196,125,142,.15)" : "rgba(196,125,142,.1)", color: t.accent }}>{pendingCount}</span>}
            </button>
            {canConfigure && <button onClick={() => setTab("gateways")} className="py-2 px-5 rounded-lg text-[13px] cursor-pointer font-[inherit]" style={{ fontWeight: tab === "gateways" ? 600 : 400, background: tab === "gateways" ? (dark ? "rgba(196,125,142,.12)" : "rgba(196,125,142,.08)") : "transparent", color: tab === "gateways" ? t.accent : t.textMuted, border: `1px solid ${tab === "gateways" ? (dark ? "rgba(196,125,142,.2)" : "rgba(196,125,142,.15)") : "transparent"}` }}>Gateway Config</button>}
          </div>
        </div>
        <div className="page-divider" style={{ background: t.cardBorder }} />
      </div>


      {/* ═══ DEPOSITS TAB ═══ */}
      {tab === "deposits" && (<>
        {/* Search */}
        <div className="mb-2.5">
          <input value={search} onChange={e => setSearch(e.target.value)} onKeyDown={e => e.key === "Enter" && doSearch()} placeholder="Search ref, user, email..." className="w-full py-2 px-3 rounded-lg text-[13px] outline-none font-[inherit] box-border" style={{ border: `1px solid ${t.cardBorder}`, background: dark ? "rgba(255,255,255,.04)" : "#fff", color: t.text }} />
        </div>
        {/* Filters */}
        <div className={`flex gap-2 flex-wrap items-center justify-end ${dateRange === "custom" ? "mb-2" : "mb-3.5"}`}>
          <select value={dateRange} onChange={e => changeDateRange(e.target.value)} className={ADM_SELECT} style={{ backgroundColor: dark ? "rgba(255,255,255,.04)" : "rgba(0,0,0,.03)", border: `1px solid ${dark ? "rgba(255,255,255,.08)" : "rgba(0,0,0,.08)"}`, color: dark ? "rgba(255,255,255,.7)" : "rgba(0,0,0,.7)", backgroundImage: `url("data:image/svg+xml,%3Csvg width='10' height='6' viewBox='0 0 10 6' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1L5 5L9 1' stroke='${dark ? "%23666" : "%23999"}' stroke-width='1.5' stroke-linecap='round'/%3E%3C/svg%3E")` }}>
            <option value="all">All time</option>
            <option value="today">Today</option>
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
            <option value="custom">Custom range</option>
          </select>
          <select value={statusFilter} onChange={e => changeStatus(e.target.value)} className={ADM_SELECT} style={{ backgroundColor: dark ? "rgba(255,255,255,.04)" : "rgba(0,0,0,.03)", border: `1px solid ${dark ? "rgba(255,255,255,.08)" : "rgba(0,0,0,.08)"}`, color: dark ? "rgba(255,255,255,.7)" : "rgba(0,0,0,.7)", backgroundImage: `url("data:image/svg+xml,%3Csvg width='10' height='6' viewBox='0 0 10 6' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1L5 5L9 1' stroke='${dark ? "%23666" : "%23999"}' stroke-width='1.5' stroke-linecap='round'/%3E%3C/svg%3E")` }}>
            <option value="all">All statuses</option>
            <option value="Pending">Pending</option>
            <option value="Completed">Completed</option>
            <option value="Failed">Failed</option>
          </select>
          <button onClick={downloadCSV} className="py-[7px] px-3.5 rounded-lg bg-none text-xs cursor-pointer font-[inherit]" style={{ border: `1px solid ${dark ? "rgba(255,255,255,.08)" : "rgba(0,0,0,.08)"}`, color: t.textMuted }}>↓ CSV</button>
        </div>
        {dateRange === "custom" && (
          <div className="flex gap-2 mb-3.5 flex-wrap items-center justify-end">
            <span className="text-xs" style={{ color: t.textMuted }}>From</span>
            <input type="date" value={customFrom} onChange={e => { setCustomFrom(e.target.value); refresh(search, statusFilter, "custom", e.target.value, customTo); }} className="py-[7px] px-2.5 rounded-lg text-xs font-[inherit] outline-none" style={{ border: `1px solid ${dark ? "rgba(255,255,255,.08)" : "rgba(0,0,0,.08)"}`, background: dark ? "rgba(255,255,255,.04)" : "rgba(0,0,0,.03)", color: customFrom ? (dark ? "rgba(255,255,255,.7)" : "rgba(0,0,0,.7)") : (dark ? "rgba(255,255,255,.3)" : "rgba(0,0,0,.3)") }} />
            <span className="text-xs" style={{ color: t.textMuted }}>To</span>
            <input type="date" value={customTo} onChange={e => { setCustomTo(e.target.value); refresh(search, statusFilter, "custom", customFrom, e.target.value); }} className="py-[7px] px-2.5 rounded-lg text-xs font-[inherit] outline-none" style={{ border: `1px solid ${dark ? "rgba(255,255,255,.08)" : "rgba(0,0,0,.08)"}`, background: dark ? "rgba(255,255,255,.04)" : "rgba(0,0,0,.03)", color: customTo ? (dark ? "rgba(255,255,255,.7)" : "rgba(0,0,0,.7)") : (dark ? "rgba(255,255,255,.3)" : "rgba(0,0,0,.3)") }} />
          </div>
        )}

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
          <div className="adm-card" style={{ background: dark ? "rgba(255,255,255,.03)" : "rgba(255,255,255,.85)", border: `0.5px solid ${dark ? "rgba(255,255,255,.06)" : "rgba(0,0,0,.06)"}` }}>
            {deposits.map((tx, i) => {
              const sc = statusColors[tx.status] || statusColors.Pending;
              return (
                <div key={tx.id} className="adm-list-row gap-2.5 flex-wrap" style={{ borderBottom: i < deposits.length - 1 ? `1px solid ${t.cardBorder}` : "none" }}>
                  <div className="flex-1 min-w-[160px]">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-base font-bold" style={{ color: sc.color }}>{fN(tx.amount)}</span>
                      <span className="text-[11px] py-0.5 px-2 rounded font-semibold" style={{ background: sc.bg, color: sc.color }}>{tx.status}</span>
                      <span className="text-[11px] py-0.5 px-1.5 rounded" style={{ background: dark ? "rgba(255,255,255,.04)" : "rgba(0,0,0,.03)", color: t.textMuted }}>{tx.method}</span>
                      {tx.confirmed && tx.status === "Pending" && <span className="text-[11px] py-0.5 px-1.5 rounded" style={{ background: dark ? "rgba(110,231,183,.06)" : "rgba(5,150,105,.03)", color: dark ? "#6ee7b7" : "#059669" }}>Sent</span>}
                    </div>
                    <div className="text-sm" style={{ color: t.text }}>{tx.user} · <span style={{ color: t.textMuted }}>{tx.email}</span></div>
                    <div className="text-xs mt-0.5" style={{ color: t.textMuted }}>
                      Ref: <span className="m" style={{ color: t.text }}>{tx.reference}</span>
                      {tx.senderRef && <> · Bank ref: <span style={{ color: t.accent }}>{tx.senderRef}</span></>}
                      {tx.actionBy && <> · <span style={{ color: dark ? "#a5b4fc" : "#4f46e5" }}>{tx.status === "Completed" ? "Approved" : "Rejected"} by {tx.actionBy}</span></>}
                      {" · "}{fD(tx.date)}
                    </div>
                  </div>
                  {tx.status === "Pending" && canApprove && (
                    <div className="flex items-center gap-1.5">
                      <button onClick={() => approveManual(tx)} className="adm-btn-sm" style={{ borderColor: dark ? "rgba(110,231,183,.2)" : "rgba(5,150,105,.15)", color: dark ? "#6ee7b7" : "#059669" }}>Approve</button>
                      <button onClick={() => rejectManual(tx)} className="adm-btn-sm" style={{ borderColor: dark ? "rgba(220,38,38,.2)" : "rgba(220,38,38,.1)", color: dark ? "#fca5a5" : "#dc2626" }}>Reject</button>
                    </div>
                  )}
                  {tx.status === "Pending" && !canApprove && (
                    <span className="text-[11px] py-[3px] px-2.5 rounded" style={{ background: dark ? "rgba(255,255,255,.04)" : "rgba(0,0,0,.03)", color: t.textMuted }}>View only</span>
                  )}
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
            <div className="adm-card" style={{ background: dark ? "rgba(255,255,255,.03)" : "rgba(255,255,255,.85)", border: `0.5px solid ${dark ? "rgba(255,255,255,.06)" : "rgba(0,0,0,.06)"}` }}>
              {gateways.map((g, i) => (
                <div key={g.id} className="adm-list-row flex-wrap gap-2.5" style={{ borderBottom: i < gateways.length - 1 ? `1px solid ${t.cardBorder}` : "none" }}>
                  <div className="flex-1 min-w-[160px]">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-[15px] font-medium" style={{ color: t.text }}>{g.name}</span>
                      <span className="text-[11px] py-0.5 px-1.5 rounded font-semibold" style={{ background: g.enabled ? (dark ? "rgba(110,231,183,.1)" : "rgba(5,150,105,.06)") : (dark ? "rgba(255,255,255,.06)" : "rgba(0,0,0,.04)"), color: g.enabled ? (dark ? "#6ee7b7" : "#059669") : t.textMuted }}>{g.enabled ? "Active" : "Disabled"}</span>
                      {g.hasKeys && <span className="text-[11px] py-0.5 px-1.5 rounded font-semibold" style={{ background: dark ? "rgba(96,165,250,.08)" : "rgba(59,130,246,.06)", color: dark ? "#60a5fa" : "#2563eb" }}>Keys set</span>}
                    </div>
                    <div className="text-[13px]" style={{ color: t.textMuted }}>{g.desc}</div>
                  </div>
                  <div className="flex gap-1.5 items-center flex-wrap">
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
        <div onClick={() => setConfiguring(null)} onKeyDown={e=>{if(e.key==='Escape')setConfiguring(null)}} className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-[4px]">
          <div role="dialog" aria-modal="true" aria-label="Configure gateway" onClick={e => e.stopPropagation()} className="w-full max-w-[440px] rounded-2xl p-6 shadow-[0_20px_60px_rgba(0,0,0,.3)]" style={{ background: dark ? "#111728" : "#fff", border: `1px solid ${t.cardBorder}` }}>
            <div className="flex justify-between items-center mb-4">
              <div className="text-base font-semibold" style={{ color: t.text }}>Configure {configuring.name}</div>
              <button onClick={() => setConfiguring(null)} className="bg-none border-none text-lg cursor-pointer" style={{ color: t.textMuted }}>✕</button>
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
                  style={{ border: `1px solid ${t.cardBorder}`, background: dark ? "rgba(255,255,255,.04)" : "rgba(0,0,0,.03)", color: t.text, fontFamily: isSecret ? "'JetBrains Mono', monospace" : "'Outfit', sans-serif" }}
                />
              </div>
              );
            })}
            <div className="flex gap-2 mt-2">
              <button onClick={saveConfig} disabled={saving} className="flex-1 py-[11px] rounded-lg text-sm font-semibold border-none cursor-pointer text-white" style={{ background: "linear-gradient(135deg,#c47d8e,#8b5e6b)" }}>{saving ? "Saving..." : "Save Keys"}</button>
              <button onClick={() => setConfiguring(null)} className="py-[11px] px-5 rounded-lg bg-none text-sm cursor-pointer" style={{ border: `1px solid ${t.cardBorder}`, color: t.textMuted }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Add Gateway modal */}
      {addModal && (
        <div onClick={() => setAddModal(false)} onKeyDown={e=>{if(e.key==='Escape')setAddModal(false)}} className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-[4px]">
          <div role="dialog" aria-modal="true" aria-label="Add payment gateway" onClick={e => e.stopPropagation()} className="w-full max-w-[420px] rounded-2xl p-6 shadow-[0_20px_60px_rgba(0,0,0,.3)]" style={{ background: dark ? "#111728" : "#fff", border: `1px solid ${t.cardBorder}` }}>
            <div className="flex justify-between items-center mb-4">
              <div className="text-base font-semibold" style={{ color: t.text }}>Add Payment Gateway</div>
              <button onClick={() => setAddModal(false)} className="bg-none border-none text-lg cursor-pointer" style={{ color: t.textMuted }}>✕</button>
            </div>
            <div className="mb-3.5">
              <label className="block text-[13px] font-semibold mb-1 uppercase tracking-wide" style={{ color: t.textMuted }}>Gateway ID</label>
              <div className="text-xs mb-1" style={{ color: t.textMuted }}>Lowercase, no spaces (e.g. "stripe", "squad")</div>
              <input value={newGw.id} onChange={e => setNewGw(prev => ({ ...prev, id: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 30) }))} placeholder="e.g. stripe" className="m w-full py-2.5 px-3 rounded-lg text-sm outline-none box-border" style={{ border: `1px solid ${t.cardBorder}`, background: dark ? "rgba(255,255,255,.04)" : "rgba(0,0,0,.03)", color: t.text }} />
            </div>
            <div className="mb-3.5">
              <label className="block text-[13px] font-semibold mb-1 uppercase tracking-wide" style={{ color: t.textMuted }}>Display Name</label>
              <input value={newGw.name} onChange={e => setNewGw(prev => ({ ...prev, name: e.target.value.slice(0, 50) }))} placeholder="e.g. Stripe" className="w-full py-2.5 px-3 rounded-lg text-sm outline-none box-border" style={{ border: `1px solid ${t.cardBorder}`, background: dark ? "rgba(255,255,255,.04)" : "rgba(0,0,0,.03)", color: t.text }} />
            </div>
            <div className="mb-3.5">
              <label className="block text-[13px] font-semibold mb-1 uppercase tracking-wide" style={{ color: t.textMuted }}>Description</label>
              <input value={newGw.desc} onChange={e => setNewGw(prev => ({ ...prev, desc: e.target.value.slice(0, 100) }))} placeholder="e.g. Cards, Apple Pay" className="w-full py-2.5 px-3 rounded-lg text-sm outline-none box-border" style={{ border: `1px solid ${t.cardBorder}`, background: dark ? "rgba(255,255,255,.04)" : "rgba(0,0,0,.03)", color: t.text }} />
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
              }} disabled={saving || !newGw.id || !newGw.name} className="flex-1 py-[11px] rounded-lg text-sm font-semibold border-none" style={{ background: newGw.id && newGw.name ? "linear-gradient(135deg,#c47d8e,#8b5e6b)" : (dark ? "rgba(255,255,255,.04)" : "rgba(0,0,0,.03)"), color: newGw.id && newGw.name ? "#fff" : t.textMuted, cursor: newGw.id && newGw.name ? "pointer" : "default" }}>{saving ? "Adding..." : "Add Gateway"}</button>
              <button onClick={() => setAddModal(false)} className="py-[11px] px-5 rounded-lg bg-none text-sm cursor-pointer" style={{ border: `1px solid ${t.cardBorder}`, color: t.textMuted }}>Cancel</button>
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

  const tabStyle = (id) => ({
    fontWeight: tab === id ? 600 : 400,
    background: tab === id ? (dark ? "rgba(196,125,142,.12)" : "rgba(196,125,142,.08)") : "transparent",
    color: tab === id ? t.accent : t.textMuted,
    border: `1px solid ${tab === id ? (dark ? "rgba(196,125,142,.2)" : "rgba(196,125,142,.15)") : "transparent"}`,
  });

  return (
    <>
      <div className="adm-header">
        <div className="adm-header-row">
          <div>
            <div className="adm-title" style={{ color: t.text }}>Finance</div>
            <div className="adm-subtitle" style={{ color: t.textMuted }}>{tab === "overview" ? "Revenue, growth, and performance" : "Complete money flow breakdown"}</div>
          </div>
          <div className="flex gap-1">
            <button onClick={() => setTab("overview")} className="py-2 px-5 rounded-lg text-[13px] cursor-pointer" style={tabStyle("overview")}>Overview</button>
            {canBreakdown && <button onClick={() => setTab("breakdown")} className="py-2 px-5 rounded-lg text-[13px] cursor-pointer" style={tabStyle("breakdown")}>Breakdown</button>}
          </div>
        </div>
        <div className="page-divider" style={{ background: t.cardBorder }} />
      </div>
      {tab === "overview" ? <FinanceOverviewTab dark={dark} t={t} /> : <FinanceBreakdownTab dark={dark} t={t} />}
    </>
  );
}

function FinanceOverviewTab({ dark, t }) {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState("30d");
  const chartRef = useRef(null);
  const chartInstance = useRef(null);

  const load = (r) => {
    setLoading(true);
    fetch(`/api/admin/analytics?range=${r}`).then(res => res.json()).then(d => { setStats(d); setLoading(false); }).catch(() => setLoading(false));
  };
  useEffect(() => { load(range); }, []);

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
            { label: "Deposits", data: cd.map(d => d.deposits), type: "line", borderColor: "#059669", backgroundColor: "transparent", tension: 0.3, pointRadius: 2, pointBackgroundColor: "#059669", borderWidth: 2, yAxisID: "y1" },
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

  const changeRange = (r) => { setRange(r); load(r); };

  if (loading) return <div className="adm-stats">{[1,2,3,4].map(i => <div key={i} className={`skel-bone ${dark ? "skel-dark" : "skel-light"} h-[90px] rounded-xl`} />)}</div>;

  const s = stats || {};
  return (
    <>
      {/* Range filter */}
      <div className="flex justify-end mb-4">
        <select value={range} onChange={e => changeRange(e.target.value)} className={ADM_SELECT} style={{
          background: dark ? "rgba(255,255,255,.04)" : "rgba(0,0,0,.03)",
          border: `1px solid ${dark ? "rgba(255,255,255,.08)" : "rgba(0,0,0,.08)"}`,
          color: dark ? "rgba(255,255,255,.7)" : "rgba(0,0,0,.7)",
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='10' height='6' viewBox='0 0 10 6' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1L5 5L9 1' stroke='${dark ? "%23666" : "%23999"}' stroke-width='1.5' stroke-linecap='round'/%3E%3C/svg%3E")`,
        }}>
          {[["24h", "Today"], ["7d", "Last 7 days"], ["30d", "Last 30 days"], ["90d", "Last 90 days"]].map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>
      </div>

      <div className="adm-stats mt-0">
        {[
          ["Revenue", fN(s.totalRevenue || 0), t.green],
          ["Provider Cost", fN(s.totalCost || 0), dark ? "#fca5a5" : "#dc2626"],
          ["Profit", fN(s.profit || 0), s.profit >= 0 ? t.green : (dark ? "#fca5a5" : "#dc2626")],
          ["Money In", fN(s.totalMoneyIn || 0), t.green],
          ["Money Out", fN(s.totalMoneyOut || 0), dark ? "#fca5a5" : "#dc2626"],
          ["Net Cash Flow", fN(s.netCashFlow || 0), (s.netCashFlow || 0) >= 0 ? t.green : (dark ? "#fca5a5" : "#dc2626")],
          ["Orders", String(s.orderCount || 0), t.amber],
          ["New Users", String(s.newUsers || 0), t.blue],
        ].map(([label, val, color]) => (
          <div key={label} className="dash-stat-card" style={{ background: dark ? "rgba(255,255,255,.04)" : "rgba(255,255,255,.85)", border: `0.5px solid ${dark ? "rgba(255,255,255,.06)" : "rgba(0,0,0,.06)"}` }}>
            <div className="dash-stat-dot" style={{ background: color }} />
            <div className="dash-stat-label" style={{ color: t.textMuted }}>{label}</div>
            <div className="m dash-stat-value" style={{ color }}>{val}</div>
          </div>
        ))}
      </div>

      {/* Chart — Orders & Deposits */}
      {stats?.chartData?.length > 0 && (
        <div className="adm-card p-4 mb-6" style={{ background: dark ? "rgba(255,255,255,.03)" : "rgba(255,255,255,.85)", border: `0.5px solid ${dark ? "rgba(255,255,255,.06)" : "rgba(0,0,0,.06)"}` }}>
          <div className="flex justify-between items-center mb-3">
            <div className="adm-card-title" style={{ color: t.textMuted }}>Orders & Deposits</div>
            <div className="flex gap-3 text-xs" style={{ color: t.textMuted }}>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm" style={{ background: dark ? "rgba(196,125,142,0.5)" : "rgba(196,125,142,0.6)" }} />Orders</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm" style={{ background: "#059669" }} />Deposits</span>
            </div>
          </div>
          <div className="relative h-60">
            <canvas ref={chartRef} />
          </div>
        </div>
      )}

      <div className="adm-grid-2 mt-6">
        <div>
          <div className="adm-card" style={{ background: dark ? "rgba(255,255,255,.03)" : "rgba(255,255,255,.85)", border: `0.5px solid ${dark ? "rgba(255,255,255,.06)" : "rgba(0,0,0,.06)"}` }}>
            <div className="adm-card-title px-4 pt-4" style={{ color: t.textMuted }}>Top platforms</div>
            <div className="adm-card-divider mt-3" style={{ background: dark ? "rgba(255,255,255,.06)" : "rgba(0,0,0,.06)" }} />
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
          <div className="adm-card" style={{ background: dark ? "rgba(255,255,255,.03)" : "rgba(255,255,255,.85)", border: `0.5px solid ${dark ? "rgba(255,255,255,.06)" : "rgba(0,0,0,.06)"}` }}>
            <div className="adm-card-title px-4 pt-4" style={{ color: t.textMuted }}>Order status breakdown</div>
            <div className="adm-card-divider mt-3" style={{ background: dark ? "rgba(255,255,255,.06)" : "rgba(0,0,0,.06)" }} />
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
          <div className="adm-card" style={{ background: dark ? "rgba(255,255,255,.03)" : "rgba(255,255,255,.85)", border: `0.5px solid ${dark ? "rgba(255,255,255,.06)" : "rgba(0,0,0,.06)"}` }}>
            <div className="adm-card-title px-4 pt-4" style={{ color: t.textMuted }}>Top services by revenue</div>
            <div className="adm-card-divider mt-3" style={{ background: dark ? "rgba(255,255,255,.06)" : "rgba(0,0,0,.06)" }} />
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
  const [creating, setCreating] = useState(null); // which slot is creating: "everyone"|"landing"|"users"|"admin"
  const [newMsg, setNewMsg] = useState("");
  const [newType, setNewType] = useState("info");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/admin/alerts").then(r => r.json()).then(d => { setAlerts(d.alerts || []); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  const createAlert = async (target) => {
    if (!newMsg.trim() || saving) return;
    setSaving(true);
    try {
      const res = await fetch("/api/admin/alerts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "create", message: newMsg, type: newType, target }) });
      const data = await res.json();
      if (res.ok && data.alert) {
        // Auto-pause: if everyone → pause ALL, otherwise pause same-target only
        setAlerts(prev => [data.alert, ...prev.map(a => {
          if (target === "everyone") return { ...a, active: false };
          if (a.target === target) return { ...a, active: false };
          return a;
        })]);
        setNewMsg(""); setCreating(null); setNewType("info");
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
  const typeIcons = { info: "📢", warning: "⚠️", success: "✅", urgent: "🚨" };

  const getActive = (target) => alerts.find(a => a.target === target && a.active);
  const getHistory = (target) => alerts.filter(a => a.target === target && !a.active);
  const everyoneActive = getActive("everyone");

  const SlotCard = ({ target, title, desc, isOverride }) => {
    const active = getActive(target);
    const history = getHistory(target);
    const isCreating = creating === target;
    const cardBorder = isOverride ? (dark ? "rgba(251,191,36,.15)" : "rgba(217,119,6,.12)") : t.cardBorder;
    const cardBg = isOverride ? (dark ? "rgba(251,191,36,.03)" : "rgba(217,119,6,.02)") : (dark ? "rgba(255,255,255,.03)" : "rgba(255,255,255,.85)");

    return (
      <div className="set-section">
        <div className="set-card" style={{ background: cardBg, border: `0.5px solid ${cardBorder}` }}>
          <div className="set-card-title" style={{ color: isOverride ? (dark ? "#fbbf24" : "#d97706") : t.textMuted }}>{isOverride ? "⚡ " : ""}{title}</div>
          <div className="set-card-desc" style={{ color: t.textMuted }}>{desc}</div>
          <div className="set-card-divider" style={{ background: cardBorder }} />

          {/* Active alert or empty */}
          {active ? (
            <>
              <div className="flex items-center gap-1.5 text-xs mb-2.5" style={{ color: dark ? "#6ee7b7" : "#059669" }}>
                <div className="w-1.5 h-1.5 rounded-full" style={{ background: dark ? "#6ee7b7" : "#059669" }} />
                Active
              </div>
              <div className="flex items-center gap-2.5 py-3 px-3.5 rounded-[10px] mb-3" style={{
                background: dark ? `${typeColors[active.type]}15` : `${typeColors[active.type]}08`,
                border: `1px solid ${dark ? `${typeColors[active.type]}40` : `${typeColors[active.type]}30`}`,
                borderLeft: `3px solid ${typeColors[active.type]}`,
              }}>
                <span className="text-sm shrink-0">{typeIcons[active.type] || "📢"}</span>
                <span className="flex-1 text-sm font-medium" style={{ color: t.text }}>{active.message}</span>
                <span className="text-[11px] font-semibold py-0.5 px-2 rounded-md shrink-0" style={{ background: dark ? "rgba(110,231,183,.12)" : "rgba(5,150,105,.06)", color: dark ? "#6ee7b7" : "#059669" }}>Live</span>
              </div>
              <div className={`flex gap-1.5 ${history.length > 0 ? "mb-3" : ""}`}>
                <button onClick={() => toggleAlert(active.id, true, target)} className="adm-btn-sm" style={{ borderColor: t.cardBorder, color: dark ? "#fbbf24" : "#d97706" }}>Pause</button>
                <button onClick={async () => { const ok = await confirm({ title: "Delete Alert", message: `Delete "${active.message?.slice(0, 50)}..."?`, confirmLabel: "Delete", danger: true }); if (ok) deleteAlert(active.id); }} className="adm-btn-sm" style={{ borderColor: dark ? "rgba(252,165,165,.2)" : "rgba(220,38,38,.15)", color: dark ? "#fca5a5" : "#dc2626" }}>Delete</button>
                <button onClick={() => { setCreating(target); setNewMsg(""); setNewType("info"); }} className="adm-btn-sm" style={{ borderColor: t.cardBorder, color: t.textSoft }}>+ New</button>
              </div>
            </>
          ) : (
            <div className="flex items-center gap-1.5 mb-3">
              <div className="w-1.5 h-1.5 rounded-full bg-[#555]" />
              <span className="text-xs text-[#555]">No active alert</span>
              <button onClick={() => { setCreating(target); setNewMsg(""); setNewType("info"); }} className="adm-btn-primary ml-auto text-xs py-1.5 px-3.5">+ Create</button>
            </div>
          )}

          {/* Create form — inline */}
          {isCreating && (
            <div className="mt-2 pt-3" style={{ borderTop: `1px solid ${t.cardBorder}` }}>
              {active && (
                <div className="text-xs mb-2.5" style={{ color: dark ? "#fbbf24" : "#d97706" }}>
                  Current alert will be auto-paused when you create a new one.
                </div>
              )}
              <div className="mb-2.5">
                <label className="text-[13px] block mb-1" style={{ color: t.textMuted }}>Message</label>
                <textarea value={newMsg} onChange={e => setNewMsg(e.target.value)} placeholder="What do you want to announce?" rows={2} className="w-full py-2.5 px-3.5 rounded-lg border text-sm outline-none resize-y font-[inherit] box-border" style={{ borderColor: t.cardBorder, background: dark ? "#0d1020" : "#fff", color: t.text }} />
              </div>
              <div className="mb-3">
                <label className="text-[13px] block mb-1" style={{ color: t.textMuted }}>Type</label>
                <div className="flex gap-1">
                  {[["info", "Info"], ["success", "Success"], ["warning", "Warning"], ["urgent", "Urgent"]].map(([ty, label]) => (
                    <button key={ty} onClick={() => setNewType(ty)} className="py-1.5 px-3 rounded-[7px] text-xs font-semibold cursor-pointer border font-[inherit]" style={{
                      borderColor: newType === ty ? typeColors[ty] : t.cardBorder,
                      background: newType === ty ? (dark ? "rgba(255,255,255,.04)" : "rgba(0,0,0,.02)") : "transparent",
                      color: newType === ty ? typeColors[ty] : t.textMuted,
                    }}>{label}</button>
                  ))}
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => createAlert(target)} disabled={!newMsg.trim() || saving} className="adm-btn-primary text-[13px]" style={{ opacity: newMsg.trim() && !saving ? 1 : .4 }}>{saving ? "Creating..." : isOverride ? "Create override" : "Create & auto-pause old"}</button>
                <button onClick={() => setCreating(null)} className="adm-btn-sm" style={{ borderColor: t.cardBorder, color: t.textSoft }}>Cancel</button>
              </div>
            </div>
          )}

          {/* History */}
          {history.length > 0 && (
            <>
              <div className="text-[11px] font-semibold tracking-[1.5px] uppercase text-[#555] mt-3.5 mb-1.5">History</div>
              {history.slice(0, 5).map(a => (
                <div key={a.id} className="flex items-center gap-2 py-[7px] text-[13px]" style={{ borderBottom: `1px solid ${dark ? "rgba(255,255,255,.04)" : "rgba(0,0,0,.04)"}` }}>
                  <span className="text-[11px] font-semibold py-px px-1.5 rounded shrink-0" style={{ background: dark ? `${typeColors[a.type]}15` : `${typeColors[a.type]}08`, color: typeColors[a.type] || t.textMuted }}>{a.type}</span>
                  <span className="flex-1 text-[#706c68] truncate">{a.message}</span>
                  <span className="text-[#555] text-xs shrink-0">{a.created ? fD(a.created) : ""}</span>
                  <button onClick={() => toggleAlert(a.id, false, target)} className="adm-btn-sm py-[3px] px-2 text-[11px]" style={{ borderColor: t.cardBorder, color: dark ? "#6ee7b7" : "#059669" }}>Reactivate</button>
                  <button onClick={async () => { const ok = await confirm({ title: "Delete", message: `Delete this alert?`, confirmLabel: "Delete", danger: true }); if (ok) deleteAlert(a.id); }} className="adm-btn-sm py-[3px] px-2 text-[11px]" style={{ borderColor: dark ? "rgba(252,165,165,.15)" : "rgba(220,38,38,.1)", color: dark ? "#fca5a5" : "#dc2626" }}>✕</button>
                </div>
              ))}
            </>
          )}
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
          <span>⚡</span> Everyone override is active — individual slot alerts are hidden while this is live.
        </div>
      )}

      <SlotCard target="everyone" title="Everyone override" desc="Overrides all slots. Shows on landing page, user dashboard, and admin panel simultaneously." isOverride />
      <SlotCard target="landing" title="Landing page" desc="Shown to visitors on the landing page before they log in." />
      <SlotCard target="users" title="Users" desc="Shown to logged-in users across all dashboard pages." />
      <SlotCard target="admin" title="Admin" desc="Internal notes shown only in the admin panel." />
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
      {info && <div className="text-sm mb-2.5" style={{ color: t.text }}>{info.unverifiedTotal || 0} unverified accounts total · {info.staleCount || 0} older than 7 days</div>}
      {result && <div className="py-2 px-3 rounded-lg mb-2.5 text-sm" style={{ background: result.type === "success" ? (dark ? "rgba(110,231,183,.08)" : "#ecfdf5") : (dark ? "rgba(220,38,38,.08)" : "#fef2f2"), color: result.type === "success" ? (dark ? "#6ee7b7" : "#059669") : (dark ? "#fca5a5" : "#dc2626") }}>{result.type === "success" ? "✓" : "⚠️"} {result.text}</div>}
      <button onClick={run} disabled={cleaning} className="adm-btn-primary" style={{ opacity: cleaning ? .5 : 1 }}>{cleaning ? "Cleaning..." : "Clean Up Stale Accounts"}</button>
    </>
  );
}

export function AdminSettingsPage({ admin, dark, t, themeMode, setThemeMode, setDark, onLogout }) {
  const confirm = useConfirm();
  const [social, setSocial] = useState({ social_whatsapp: "", social_telegram: "", social_instagram: "", social_twitter: "", social_whatsapp_support: "", social_telegram_support: "" });
  const [emails, setEmails] = useState({ site_email_general: "", site_email_support: "" });
  const [socialLoading, setSocialLoading] = useState(true);
  const [socialSaving, setSocialSaving] = useState(false);
  const [socialMsg, setSocialMsg] = useState(null);
  const [emailSaving, setEmailSaving] = useState(false);
  const [emailMsg, setEmailMsg] = useState(null);

  useEffect(() => {
    fetch("/api/admin/settings").then(r => r.json()).then(d => {
      if (d.settings) {
        setSocial(prev => ({ ...prev, ...Object.fromEntries(Object.entries(d.settings).filter(([k]) => k.startsWith("social_"))) }));
        setEmails(prev => ({ ...prev, ...Object.fromEntries(Object.entries(d.settings).filter(([k]) => k.startsWith("site_email_"))) }));
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

  const applyTheme = (mode) => {
    setThemeMode(mode);
    try { localStorage.setItem("nitro-admin-theme", mode); } catch {}
    if (mode === "day") setDark(false);
    else if (mode === "night") setDark(true);
    else { const h = new Date().getHours(); setDark(h >= 19 || h < 7); }
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

  return (
    <>
      <div className="adm-header">
        <div className="adm-title" style={{ color: t.text }}>Settings</div>
        <div className="adm-subtitle" style={{ color: t.textMuted }}>Admin preferences and configuration</div>
        <div className="page-divider" style={{ background: t.cardBorder }} />
      </div>

      <div className="mt-4">
        {/* Profile */}
        <div className="set-section">
          <div className="set-card" style={{ background: dark ? "rgba(255,255,255,.03)" : "rgba(255,255,255,.85)", border: `0.5px solid ${t.cardBorder}` }}>
            <div className="flex justify-between items-center">
              <div className="set-card-title" style={{ color: t.textMuted }}>Profile</div>
              {!profileEditing && <button onClick={() => setProfileEditing(true)} className="text-[13px] bg-none border-none cursor-pointer" style={{ color: t.accent }}>Edit</button>}
            </div>
            <div className="set-card-divider" style={{ background: t.cardBorder }} />
            {profileMsg && <div className="py-2 px-3 rounded-lg mb-3 text-sm" style={{ background: profileMsg.type === "success" ? (dark ? "rgba(110,231,183,.08)" : "#ecfdf5") : (dark ? "rgba(220,38,38,.08)" : "#fef2f2"), color: profileMsg.type === "success" ? (dark ? "#6ee7b7" : "#059669") : (dark ? "#fca5a5" : "#dc2626") }}>{profileMsg.type === "success" ? "✓" : "⚠️"} {profileMsg.text}</div>}
            {profileEditing ? (
              <>
                <div className="mb-3">
                  <label className="text-sm block mb-1" style={{ color: t.textMuted }}>Name</label>
                  <input value={editName} onChange={e => setEditName(e.target.value)} className="w-full py-2.5 px-3.5 rounded-lg text-[15px] outline-none border" style={{ borderColor: t.cardBorder, background: dark ? "#0d1020" : "#fff", color: t.text }} />
                </div>
                <div className="mb-3">
                  <label className="text-sm block mb-1" style={{ color: t.textMuted }}>Email</label>
                  <input value={editEmail} onChange={e => setEditEmail(e.target.value)} className="w-full py-2.5 px-3.5 rounded-lg text-[15px] outline-none border" style={{ borderColor: t.cardBorder, background: dark ? "#0d1020" : "#fff", color: t.text }} />
                </div>
                <div className="mb-2">
                  <div className="text-[13px] uppercase tracking-wide mb-0.5" style={{ color: t.textMuted }}>Role</div>
                  <div className="text-[15px] font-medium" style={{ color: t.textMuted }}>{admin?.role || "admin"} (cannot be changed)</div>
                </div>
                <div className="flex gap-2 mt-3.5">
                  <button onClick={saveProfile} disabled={profileSaving} className="adm-btn-primary" style={{ opacity: profileSaving ? .5 : 1 }}>{profileSaving ? "Saving..." : "Save"}</button>
                  <button onClick={() => { setProfileEditing(false); setEditName(admin?.name || ""); setEditEmail(admin?.email || ""); setProfileMsg(null); }} className="py-2 px-4 rounded-lg bg-none text-sm cursor-pointer" style={{ border: `1px solid ${t.cardBorder}`, color: t.textSoft }}>Cancel</button>
                </div>
              </>
            ) : (
              <div className="grid grid-cols-2 gap-2.5">
                {[["Name", admin?.name || "Admin"], ["Email", admin?.email || ""], ["Role", admin?.role || "admin"]].map(([label, val]) => (
                  <div key={label}><div className="text-[13px] uppercase tracking-wide mb-0.5" style={{ color: t.textMuted }}>{label}</div><div className="text-[15px] font-medium" style={{ color: t.text }}>{val}</div></div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Theme */}
        <div className="set-section">
          <div className="set-card" style={{ background: dark ? "rgba(255,255,255,.03)" : "rgba(255,255,255,.85)", border: `0.5px solid ${t.cardBorder}` }}>
            <div className="set-card-title" style={{ color: t.textMuted }}>Theme</div>
            <div className="set-card-divider" style={{ background: t.cardBorder }} />
            <div className="flex gap-2">
              {[["day", "☀ Light"], ["night", "☾ Dark"], ["auto", "◑ Auto"]].map(([id, lb]) => (
                <button key={id} onClick={() => applyTheme(id)} className="flex-1 py-3 px-2.5 rounded-[10px] border text-[15px] text-center" style={{ borderColor: themeMode === id ? t.accent : t.cardBorder, background: themeMode === id ? (dark ? "#2a1a22" : "#fdf2f4") : (dark ? "rgba(255,255,255,.04)" : "rgba(255,255,255,.8)"), color: themeMode === id ? t.accent : t.textSoft, fontWeight: themeMode === id ? 600 : 450 }}>{lb}</button>
              ))}
            </div>
          </div>
        </div>

        {/* Change password */}
        <div className="set-section">
          <div className="set-card" style={{ background: dark ? "rgba(255,255,255,.03)" : "rgba(255,255,255,.85)", border: `0.5px solid ${t.cardBorder}` }}>
            <div className="set-card-title" style={{ color: t.textMuted }}>Change password</div>
            <div className="set-card-divider" style={{ background: t.cardBorder }} />
            {admPwMsg && <div className="py-2 px-3 rounded-lg mb-3 text-sm" style={{ background: admPwMsg.type === "success" ? (dark ? "rgba(110,231,183,.08)" : "#ecfdf5") : (dark ? "rgba(220,38,38,.08)" : "#fef2f2"), color: admPwMsg.type === "success" ? (dark ? "#6ee7b7" : "#059669") : (dark ? "#fca5a5" : "#dc2626") }}>{admPwMsg.type === "success" ? "✓" : "⚠️"} {admPwMsg.text}</div>}
            <div className="mb-3">
              <label className="text-sm block mb-1" style={{ color: t.textMuted }}>Current Password</label>
              <input type="password" value={admCurPw} onChange={e => setAdmCurPw(e.target.value)} className="w-full py-2.5 px-3.5 rounded-lg text-[15px] outline-none border" style={{ borderColor: t.cardBorder, background: dark ? "#0d1020" : "#fff", color: t.text }} />
            </div>
            <div className="mb-3">
              <label className="text-sm block mb-1" style={{ color: t.textMuted }}>New Password</label>
              <input type="password" value={admNewPw} onChange={e => setAdmNewPw(e.target.value)} className="w-full py-2.5 px-3.5 rounded-lg text-[15px] outline-none border" style={{ borderColor: t.cardBorder, background: dark ? "#0d1020" : "#fff", color: t.text }} />
            </div>
            <div className="mb-3">
              <label className="text-sm block mb-1" style={{ color: t.textMuted }}>Confirm Password</label>
              <input type="password" value={admConfPw} onChange={e => setAdmConfPw(e.target.value)} className="w-full py-2.5 px-3.5 rounded-lg text-[15px] outline-none border" style={{ borderColor: t.cardBorder, background: dark ? "#0d1020" : "#fff", color: t.text }} />
            </div>
            <button onClick={changeAdmPw} disabled={pwSaving} className="adm-btn-primary" style={{ opacity: admCurPw && admNewPw && admConfPw && !pwSaving ? 1 : .4 }}>{pwSaving ? "Updating..." : "Update Password"}</button>
          </div>
        </div>

        {/* Contact Emails */}
        <div className="set-section">
          <div className="set-card" style={{ background: dark ? "rgba(255,255,255,.03)" : "rgba(255,255,255,.85)", border: `0.5px solid ${t.cardBorder}` }}>
            <div className="set-card-title" style={{ color: t.textMuted }}>Contact emails</div>
            <div className="set-card-desc" style={{ color: t.textMuted }}>Shown across the site — landing page, support, legal pages, banned page</div>
            <div className="set-card-divider" style={{ background: t.cardBorder }} />

            {emailMsg && <div className="py-2 px-3 rounded-lg mb-3 text-sm" style={{ background: emailMsg.type === "success" ? (dark ? "rgba(110,231,183,.08)" : "#ecfdf5") : (dark ? "rgba(220,38,38,.08)" : "#fef2f2"), color: emailMsg.type === "success" ? (dark ? "#6ee7b7" : "#059669") : (dark ? "#fca5a5" : "#dc2626") }}>{emailMsg.type === "success" ? "✓" : "⚠️"} {emailMsg.text}</div>}

            {[
              ["site_email_general", "General Email", "info@nitro.ng", "Main contact email shown on landing page, legal pages, banned page"],
              ["site_email_support", "Support Email", "support@nitro.ng", "Support-specific email shown on support page and ticket responses"],
            ].map(([key, label, placeholder, hint]) => (
              <div key={key} className="mb-3">
                <label className="text-sm block mb-0.5" style={{ color: t.textMuted }}>{label}</label>
                <input value={emails[key] || ""} onChange={e => setEmails(prev => ({ ...prev, [key]: e.target.value.trim() }))} placeholder={placeholder} type="email" className="w-full py-2.5 px-3.5 rounded-lg text-[15px] outline-none border font-[inherit]" style={{ borderColor: t.cardBorder, background: dark ? "#0d1020" : "#fff", color: t.text }} />
                <div className="text-xs mt-0.5 opacity-70" style={{ color: t.textMuted }}>{hint}</div>
              </div>
            ))}

            <button onClick={saveEmails} disabled={emailSaving} className="adm-btn-primary" style={{ opacity: emailSaving ? .5 : 1 }}>{emailSaving ? "Saving..." : "Save Emails"}</button>
          </div>
        </div>

        {/* Social Links & Community */}
        <div className="set-section">
          <div className="set-card" style={{ background: dark ? "rgba(255,255,255,.03)" : "rgba(255,255,255,.85)", border: `0.5px solid ${t.cardBorder}` }}>
            <div className="set-card-title" style={{ color: t.textMuted }}>Social links & community</div>
            <div className="set-card-desc" style={{ color: t.textMuted }}>Shown in sidebar, landing page footer, and support page. Leave blank to hide.</div>
            <div className="set-card-divider" style={{ background: t.cardBorder }} />

            {socialMsg && <div className="py-2 px-3 rounded-lg mb-3 text-sm" style={{ background: socialMsg.type === "success" ? (dark ? "rgba(110,231,183,.08)" : "#ecfdf5") : (dark ? "rgba(220,38,38,.08)" : "#fef2f2"), color: socialMsg.type === "success" ? (dark ? "#6ee7b7" : "#059669") : (dark ? "#fca5a5" : "#dc2626") }}>{socialMsg.type === "success" ? "✓" : "⚠️"} {socialMsg.text}</div>}

            {[
              ["social_whatsapp", "WhatsApp Group Link", "https://chat.whatsapp.com/...", "Group invite link for community"],
              ["social_telegram", "Telegram Channel", "https://t.me/...", "Channel or group link"],
              ["social_telegram_support", "Telegram Support", "https://t.me/...", "Support bot or direct chat link"],
              ["social_whatsapp_support", "WhatsApp Support Number", "2348012345678", "Number for wa.me link (no + prefix)"],
              ["social_instagram", "Instagram Handle", "Nitro.ng", "Without the @ symbol"],
              ["social_twitter", "X / Twitter Handle", "TheNitroNG", "Without the @ symbol"],
            ].map(([key, label, placeholder, hint]) => (
              <div key={key} className="mb-3">
                <label className="text-sm block mb-0.5" style={{ color: t.textMuted }}>{label}</label>
                <input value={social[key] || ""} onChange={e => setSocial(prev => ({ ...prev, [key]: e.target.value }))} placeholder={placeholder} className="w-full py-2.5 px-3.5 rounded-lg text-[15px] outline-none border font-[inherit]" style={{ borderColor: t.cardBorder, background: dark ? "#0d1020" : "#fff", color: t.text }} />
                <div className="text-xs mt-0.5 opacity-70" style={{ color: t.textMuted }}>{hint}</div>
              </div>
            ))}

            <button onClick={saveSocial} disabled={socialSaving} className="adm-btn-primary" style={{ opacity: socialSaving ? .5 : 1 }}>{socialSaving ? "Saving..." : "Save Social Links"}</button>
          </div>
        </div>

        {/* Cleanup */}
        <div className="mb-5">
          <div className="text-base font-semibold mb-2.5" style={{ color: t.text }}>Cleanup</div>
          <div className="adm-card p-[18px] rounded-[14px]" style={{ background: dark ? "rgba(255,255,255,.03)" : "rgba(255,255,255,.85)", border: `0.5px solid ${dark ? "rgba(255,255,255,.06)" : "rgba(0,0,0,.06)"}`, boxShadow: dark ? "0 4px 20px rgba(0,0,0,.25)" : "0 4px 20px rgba(0,0,0,.04)" }}>
            <div className="text-sm mb-3 leading-normal" style={{ color: t.textMuted }}>Remove unverified accounts older than 7 days that have no orders or transactions.</div>
            <CleanupButton dark={dark} t={t} />
          </div>
        </div>

        {/* Logout */}
        <div className="mb-5">
          <button onClick={onLogout} className="flex items-center justify-center gap-2 w-full py-3 px-5 rounded-[10px] bg-none cursor-pointer text-[15px] font-semibold font-[inherit]" style={{ border: `1px solid ${dark ? "rgba(252,165,165,.2)" : "rgba(220,38,38,.15)"}`, color: dark ? "#fca5a5" : "#dc2626" }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
            Log out
          </button>
        </div>
      </div>
    </>
  );
}

/* ═══════════════════════════════════════════ */
/* ═══ FINANCIALS PAGE                     ═══ */
/* ═══════════════════════════════════════════ */
function FinanceBreakdownTab({ dark, t }) {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState("30d");
  const [platform, setPlatform] = useState("all");
  const [tier, setTier] = useState("all");
  const [provider, setProvider] = useState("all");

  const load = () => {
    setLoading(true);
    fetch(`/api/admin/financials?range=${range}&platform=${platform}&tier=${tier}&provider=${provider}`)
      .then(r => r.json()).then(d => { setStats(d); setLoading(false); }).catch(() => setLoading(false));
  };
  useEffect(() => { load(); }, [range, platform, tier, provider]);

  const green = dark ? "#6ee7b7" : "#059669";
  const red = dark ? "#fca5a5" : "#dc2626";
  const amber = dark ? "#fbbf24" : "#d97706";
  const blue = dark ? "#93c5fd" : "#2563eb";
  const cardBg = dark ? "rgba(255,255,255,.03)" : "rgba(255,255,255,.85)";
  const cardBorder = dark ? "rgba(255,255,255,.06)" : "rgba(0,0,0,.06)";
  const subText = dark ? "rgba(255,255,255,.35)" : "rgba(0,0,0,.35)";
  const rowBorder = dark ? "rgba(255,255,255,.04)" : "rgba(0,0,0,.04)";
  const sectionHeading = "text-xs font-semibold uppercase tracking-[1.5px] mb-2.5";

  const DropdownFilter = ({ value, onChange, options }) => (
    <select value={value} onChange={e => onChange(e.target.value)} className={ADM_SELECT} style={{
      background: dark ? "rgba(255,255,255,.04)" : "rgba(0,0,0,.03)",
      border: `1px solid ${dark ? "rgba(255,255,255,.08)" : "rgba(0,0,0,.08)"}`,
      color: dark ? "rgba(255,255,255,.7)" : "rgba(0,0,0,.7)",
      backgroundImage: `url("data:image/svg+xml,%3Csvg width='10' height='6' viewBox='0 0 10 6' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1L5 5L9 1' stroke='${dark ? "%23666" : "%23999"}' stroke-width='1.5' stroke-linecap='round'/%3E%3C/svg%3E")`,
    }}>
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );

  const MetricCard = ({ label, value, sub, color }) => (
    <div className="py-3.5 px-4 rounded-xl" style={{ background: cardBg, border: `0.5px solid ${cardBorder}` }}>
      <div className="text-[10px] font-semibold uppercase tracking-[1px] mb-1.5" style={{ color: subText }}>{label}</div>
      <div className="m text-xl font-bold" style={{ color: color || t.text }}>{value}</div>
      {sub && <div className="text-[11px] mt-[3px]" style={{ color: subText }}>{sub}</div>}
    </div>
  );

  const MiniBar = ({ value, max, color }) => (
    <div className="h-[3px] rounded-sm overflow-hidden" style={{ background: dark ? "rgba(255,255,255,.06)" : "rgba(0,0,0,.06)" }}>
      <div className="h-full rounded-sm" style={{ width: `${Math.min((value / (max || 1)) * 100, 100)}%`, background: color }} />
    </div>
  );

  if (loading) return (
    <div className="adm-stats">{[1,2,3,4,5,6].map(i => <div key={i} className={`skel-bone ${dark ? "skel-dark" : "skel-light"} h-20 rounded-xl`} />)}</div>
  );

  const s = stats || {};
  const p = s.profitability || {};
  const mIn = s.moneyIn || {};
  const mOut = s.moneyOut || {};
  const lib = s.liability || {};
  const totalIn = (mIn.deposits || 0) + (mIn.adminCredits || 0);
  const totalOut = (mOut.providerCosts || 0) + (mOut.refunds || 0) + (mOut.couponBonuses || 0) + (mOut.referralBonuses || 0) + (mOut.adminGifts || 0);

  return (
    <>
      {/* Filters */}
      <div className="flex gap-2 mb-5 flex-wrap justify-end">
        <DropdownFilter value={range} onChange={setRange} options={[
          { value: "24h", label: "Today" }, { value: "7d", label: "Last 7 days" },
          { value: "30d", label: "Last 30 days" }, { value: "90d", label: "Last 90 days" },
          { value: "month", label: "This month" }, { value: "lastmonth", label: "Last month" },
          { value: "year", label: "This year" },
        ]} />
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
      </div>

      {/* Profitability */}
      <div className={sectionHeading} style={{ color: subText }}>Profitability</div>
      <div className="adm-stats mb-5">
        <MetricCard label="Gross Revenue" value={fN(p.grossRevenue || 0)} sub="Total order charges" />
        <MetricCard label="Refunds" value={fN(p.totalRefunds || 0)} sub={`${p.refundRate || 0}% refund rate`} color={red} />
        <MetricCard label="Net Revenue" value={fN(p.netRevenue || 0)} sub="After refunds" color={green} />
        <MetricCard label="Provider Cost" value={fN(p.totalCost || 0)} sub="MTP + JAP + DAO" color={amber} />
        <MetricCard label="Gross Profit" value={fN(p.grossProfit || 0)} sub={`${p.margin || 0}% margin`} color={p.grossProfit >= 0 ? green : red} />
        <MetricCard label="Per Order" value={fN(p.profitPerOrder || 0)} sub={`${p.orderCount || 0} orders`} />
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
                <span className="text-[13px]" style={{ color: dark ? "rgba(255,255,255,.5)" : "rgba(0,0,0,.5)" }}>{label}</span>
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
              ["Provider Costs", mOut.providerCosts],
              ["Order Refunds", mOut.refunds],
              ["Coupon Bonuses", mOut.couponBonuses],
              ["Referral Bonuses", mOut.referralBonuses],
              ["Admin Gifts", mOut.adminGifts],
            ].map(([label, val]) => (
              <div key={label} className="flex justify-between py-[7px]" style={{ borderBottom: `0.5px solid ${rowBorder}` }}>
                <span className="text-[13px]" style={{ color: dark ? "rgba(255,255,255,.5)" : "rgba(0,0,0,.5)" }}>{label}</span>
                <span className="m text-[13px] font-semibold" style={{ color: red }}>{fN(val || 0)}</span>
              </div>
            ))}
            <div className="flex justify-between pt-2.5 pb-0.5 mt-1">
              <span className="text-[13px] font-bold" style={{ color: dark ? "rgba(255,255,255,.7)" : "rgba(0,0,0,.7)" }}>Total Out</span>
              <span className="m text-[15px] font-bold" style={{ color: red }}>{fN(totalOut)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Liability */}
      <div className={sectionHeading} style={{ color: subText }}>Liability & Cash</div>
      <div className="adm-stats mb-5">
        <MetricCard label="Wallet Liability" value={fN(lib.walletBalances || 0)} sub={`${lib.walletUsers || 0} users with balance`} color={amber} />
        <MetricCard label="Net Cash Flow" value={fN(totalIn - totalOut)} sub="Money in - Money out" color={totalIn - totalOut >= 0 ? green : red} />
        <MetricCard label="Retained Profit" value={fN((p.grossProfit || 0))} sub={`${p.margin || 0}% margin`} color={green} />
      </div>

      {/* Profit by Platform */}
      {(s.byPlatform || []).length > 0 && <>
        <div className={`${sectionHeading} mt-1`} style={{ color: subText }}>Profit by platform</div>
        <div className="adm-card mb-5 overflow-hidden" style={{ background: cardBg, border: `0.5px solid ${cardBorder}` }}>
          {/* Header */}
          <div className="fin-table-header grid grid-cols-[2fr_1fr_1fr_1fr_0.7fr_0.6fr] py-2.5 px-3.5" style={{ borderBottom: `0.5px solid ${dark ? "rgba(255,255,255,.06)" : "rgba(0,0,0,.06)"}` }}>
            {["Platform", "Revenue", "Cost", "Profit", "Orders", "Margin"].map(h => (
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
                <div className="text-xs text-right" style={{ color: dark ? "rgba(255,255,255,.5)" : "rgba(0,0,0,.5)" }}>{pl.orders}</div>
                <div className="text-xs text-right font-semibold" style={{ color: (pl.margin || 0) >= 50 ? green : amber }}>{pl.margin || 0}%</div>
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
                <div className="text-[11px] mb-2" style={{ color: subText }}>{tr.orders} orders · {tr.margin || 0}% margin</div>
                <MiniBar value={tr.margin || 0} max={100} color={tierColor} />
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
    </>
  );
}
