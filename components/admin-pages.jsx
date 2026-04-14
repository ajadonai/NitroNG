'use client';
import { useState, useEffect, useRef, useCallback } from "react";
import { useConfirm } from "./confirm-dialog";
import { fN, fD } from "../lib/format";


/* ═══════════════════════════════════════════ */
/* ═══ PAYMENTS PAGE                       ═══ */
/* ═══════════════════════════════════════════ */
export function AdminPaymentsPage({ dark, t }) {
  const confirm = useConfirm();
  const [tab, setTab] = useState("deposits");
  const [gateways, setGateways] = useState([]);
  const [deposits, setDeposits] = useState([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [configuring, setConfiguring] = useState(null);
  const [configFields, setConfigFields] = useState({});
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);
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
    setMsg(null);
    const res = await fetch("/api/admin/payments", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "toggle", gatewayId: id, enabled }) });
    if (res.ok) { refresh(); setMsg({ type: "success", text: `${id} ${enabled ? "enabled" : "disabled"}` }); }
    else { const d = await res.json(); setMsg({ type: "error", text: d.error || "Failed" }); }
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
    if (Object.keys(nonEmpty).length === 0) { setMsg({ type: "error", text: "Enter at least one field" }); return; }
    setSaving(true);
    const res = await fetch("/api/admin/payments", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "configure", gatewayId: configuring.id, fields: nonEmpty }) });
    if (res.ok) { setMsg({ type: "success", text: `${configuring.name} saved` }); setConfiguring(null); refresh(); }
    else { const d = await res.json(); setMsg({ type: "error", text: d.error || "Save failed" }); }
    setSaving(false);
  };

  const approveManual = async (tx) => {
    const ok = await confirm({ title: "Approve deposit?", message: `Credit ₦${tx.amount.toLocaleString()} to ${tx.user} (${tx.email})?\nRef: ${tx.reference}${tx.senderRef ? `\nBank ref: ${tx.senderRef}` : ""}`, confirmText: "Approve", danger: false });
    if (!ok) return;
    const res = await fetch("/api/admin/payments", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "approve_manual", gatewayId: tx.id }) });
    if (res.ok) { setMsg({ type: "success", text: `₦${tx.amount.toLocaleString()} approved for ${tx.user}` }); refresh(); }
    else { const d = await res.json(); setMsg({ type: "error", text: d.error || "Failed" }); }
  };

  const rejectManual = async (tx) => {
    const ok = await confirm({ title: "Reject deposit?", message: `Reject ₦${tx.amount.toLocaleString()} from ${tx.user}? This cannot be undone.`, confirmText: "Reject", danger: true });
    if (!ok) return;
    const res = await fetch("/api/admin/payments", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "reject_manual", gatewayId: tx.id }) });
    if (res.ok) { setMsg({ type: "success", text: "Deposit rejected" }); refresh(); }
    else { const d = await res.json(); setMsg({ type: "error", text: d.error || "Failed" }); }
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
          <div style={{ display: "flex", gap: 4 }}>
            <button onClick={() => setTab("deposits")} style={{ padding: "8px 20px", borderRadius: 8, fontSize: 13, fontWeight: tab === "deposits" ? 600 : 400, background: tab === "deposits" ? (dark ? "rgba(196,125,142,.12)" : "rgba(196,125,142,.08)") : "transparent", color: tab === "deposits" ? t.accent : t.textMuted, border: `1px solid ${tab === "deposits" ? (dark ? "rgba(196,125,142,.2)" : "rgba(196,125,142,.15)") : "transparent"}`, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 6 }}>
              Deposits
              {pendingCount > 0 && <span style={{ fontSize: 11, padding: "1px 6px", borderRadius: 10, background: dark ? "rgba(196,125,142,.15)" : "rgba(196,125,142,.1)", color: t.accent, fontWeight: 700 }}>{pendingCount}</span>}
            </button>
            {canConfigure && <button onClick={() => setTab("gateways")} style={{ padding: "8px 20px", borderRadius: 8, fontSize: 13, fontWeight: tab === "gateways" ? 600 : 400, background: tab === "gateways" ? (dark ? "rgba(196,125,142,.12)" : "rgba(196,125,142,.08)") : "transparent", color: tab === "gateways" ? t.accent : t.textMuted, border: `1px solid ${tab === "gateways" ? (dark ? "rgba(196,125,142,.2)" : "rgba(196,125,142,.15)") : "transparent"}`, cursor: "pointer", fontFamily: "inherit" }}>Gateway Config</button>}
          </div>
        </div>
        <div className="page-divider" style={{ background: t.cardBorder }} />
      </div>

      {msg && <div style={{ padding: "10px 14px", borderRadius: 8, marginBottom: 12, background: msg.type === "success" ? (dark ? "rgba(110,231,183,.08)" : "#ecfdf5") : (dark ? "rgba(220,38,38,.08)" : "#fef2f2"), color: msg.type === "success" ? (dark ? "#6ee7b7" : "#059669") : (dark ? "#fca5a5" : "#dc2626"), fontSize: 14, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span>{msg.text}</span>
        <button onClick={() => setMsg(null)} style={{ background: "none", border: "none", color: "inherit", cursor: "pointer", fontSize: 14 }}>✕</button>
      </div>}

      {/* ═══ DEPOSITS TAB ═══ */}
      {tab === "deposits" && (<>
        {/* Search */}
        <div style={{ marginBottom: 10 }}>
          <input value={search} onChange={e => setSearch(e.target.value)} onKeyDown={e => e.key === "Enter" && doSearch()} placeholder="Search ref, user, email..." style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: `1px solid ${t.cardBorder}`, background: dark ? "rgba(255,255,255,.04)" : "#fff", color: t.text, fontSize: 13, outline: "none", fontFamily: "inherit", boxSizing: "border-box" }} />
        </div>
        {/* Filters */}
        <div style={{ display: "flex", gap: 8, marginBottom: dateRange === "custom" ? 8 : 14, flexWrap: "wrap", alignItems: "center", justifyContent: "flex-end" }}>
          <select value={dateRange} onChange={e => changeDateRange(e.target.value)} style={{ padding: "7px 28px 7px 10px", borderRadius: 8, fontSize: 13, fontWeight: 500, background: dark ? "rgba(255,255,255,.04)" : "rgba(0,0,0,.03)", border: `1px solid ${dark ? "rgba(255,255,255,.08)" : "rgba(0,0,0,.08)"}`, color: dark ? "rgba(255,255,255,.7)" : "rgba(0,0,0,.7)", appearance: "none", cursor: "pointer", fontFamily: "inherit", backgroundImage: `url("data:image/svg+xml,%3Csvg width='10' height='6' viewBox='0 0 10 6' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1L5 5L9 1' stroke='${dark ? "%23666" : "%23999"}' stroke-width='1.5' stroke-linecap='round'/%3E%3C/svg%3E")`, backgroundRepeat: "no-repeat", backgroundPosition: "right 8px center" }}>
            <option value="all">All time</option>
            <option value="today">Today</option>
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
            <option value="custom">Custom range</option>
          </select>
          <select value={statusFilter} onChange={e => changeStatus(e.target.value)} style={{ padding: "7px 28px 7px 10px", borderRadius: 8, fontSize: 13, fontWeight: 500, background: dark ? "rgba(255,255,255,.04)" : "rgba(0,0,0,.03)", border: `1px solid ${dark ? "rgba(255,255,255,.08)" : "rgba(0,0,0,.08)"}`, color: dark ? "rgba(255,255,255,.7)" : "rgba(0,0,0,.7)", appearance: "none", cursor: "pointer", fontFamily: "inherit", backgroundImage: `url("data:image/svg+xml,%3Csvg width='10' height='6' viewBox='0 0 10 6' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1L5 5L9 1' stroke='${dark ? "%23666" : "%23999"}' stroke-width='1.5' stroke-linecap='round'/%3E%3C/svg%3E")`, backgroundRepeat: "no-repeat", backgroundPosition: "right 8px center" }}>
            <option value="all">All statuses</option>
            <option value="Pending">Pending</option>
            <option value="Completed">Completed</option>
            <option value="Failed">Failed</option>
          </select>
          <button onClick={downloadCSV} style={{ padding: "7px 14px", borderRadius: 8, border: `1px solid ${dark ? "rgba(255,255,255,.08)" : "rgba(0,0,0,.08)"}`, background: "none", color: t.textMuted, fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>↓ CSV</button>
        </div>
        {dateRange === "custom" && (
          <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap", alignItems: "center", justifyContent: "flex-end" }}>
            <span style={{ fontSize: 12, color: t.textMuted }}>From</span>
            <input type="date" value={customFrom} onChange={e => { setCustomFrom(e.target.value); refresh(search, statusFilter, "custom", e.target.value, customTo); }} style={{ padding: "7px 10px", borderRadius: 8, border: `1px solid ${dark ? "rgba(255,255,255,.08)" : "rgba(0,0,0,.08)"}`, background: dark ? "rgba(255,255,255,.04)" : "rgba(0,0,0,.03)", color: customFrom ? (dark ? "rgba(255,255,255,.7)" : "rgba(0,0,0,.7)") : (dark ? "rgba(255,255,255,.3)" : "rgba(0,0,0,.3)"), fontSize: 12, fontFamily: "inherit", outline: "none" }} />
            <span style={{ fontSize: 12, color: t.textMuted }}>To</span>
            <input type="date" value={customTo} onChange={e => { setCustomTo(e.target.value); refresh(search, statusFilter, "custom", customFrom, e.target.value); }} style={{ padding: "7px 10px", borderRadius: 8, border: `1px solid ${dark ? "rgba(255,255,255,.08)" : "rgba(0,0,0,.08)"}`, background: dark ? "rgba(255,255,255,.04)" : "rgba(0,0,0,.03)", color: customTo ? (dark ? "rgba(255,255,255,.7)" : "rgba(0,0,0,.7)") : (dark ? "rgba(255,255,255,.3)" : "rgba(0,0,0,.3)"), fontSize: 12, fontFamily: "inherit", outline: "none" }} />
          </div>
        )}

        {loading ? <div>{[1,2,3].map(i => <div key={i} className={`skel-bone ${dark ? "skel-dark" : "skel-light"}`} style={{ height: 60, borderRadius: 8, marginBottom: 6 }} />)}</div> :
        deposits.length === 0 ? (
          <div style={{ padding: "60px 20px", textAlign: "center" }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>{statusFilter === "Pending" ? "✓" : "—"}</div>
            <div style={{ fontSize: 16, fontWeight: 500, color: t.text, marginBottom: 4 }}>{statusFilter === "Pending" ? "No pending deposits" : "No deposits found"}</div>
            <div style={{ fontSize: 14, color: t.textMuted }}>{statusFilter === "Pending" ? "Manual and crypto deposits will appear here" : "Try adjusting your search or filters"}</div>
          </div>
        ) : (
          <div className="adm-card" style={{ background: dark ? "rgba(255,255,255,.03)" : "rgba(255,255,255,.85)", border: `0.5px solid ${dark ? "rgba(255,255,255,.06)" : "rgba(0,0,0,.06)"}` }}>
            {deposits.map((tx, i) => {
              const sc = statusColors[tx.status] || statusColors.Pending;
              return (
                <div key={tx.id} className="adm-list-row" style={{ borderBottom: i < deposits.length - 1 ? `1px solid ${t.cardBorder}` : "none", gap: 10, flexWrap: "wrap" }}>
                  <div style={{ flex: 1, minWidth: 160 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
                      <span style={{ fontSize: 16, fontWeight: 700, color: sc.color }}>{fN(tx.amount)}</span>
                      <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 4, fontWeight: 600, background: sc.bg, color: sc.color }}>{tx.status}</span>
                      <span style={{ fontSize: 11, padding: "2px 6px", borderRadius: 4, background: dark ? "rgba(255,255,255,.04)" : "rgba(0,0,0,.03)", color: t.textMuted }}>{tx.method}</span>
                      {tx.confirmed && tx.status === "Pending" && <span style={{ fontSize: 11, padding: "2px 6px", borderRadius: 4, background: dark ? "rgba(110,231,183,.06)" : "rgba(5,150,105,.03)", color: dark ? "#6ee7b7" : "#059669" }}>Sent</span>}
                    </div>
                    <div style={{ fontSize: 14, color: t.text }}>{tx.user} · <span style={{ color: t.textMuted }}>{tx.email}</span></div>
                    <div style={{ fontSize: 12, color: t.textMuted, marginTop: 2 }}>
                      Ref: <span className="m" style={{ color: t.text }}>{tx.reference}</span>
                      {tx.senderRef && <> · Bank ref: <span style={{ color: t.accent }}>{tx.senderRef}</span></>}
                      {tx.actionBy && <> · <span style={{ color: dark ? "#a5b4fc" : "#4f46e5" }}>{tx.status === "Completed" ? "Approved" : "Rejected"} by {tx.actionBy}</span></>}
                      {" · "}{fD(tx.date)}
                    </div>
                  </div>
                  {tx.status === "Pending" && canApprove && (
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <button onClick={() => approveManual(tx)} className="adm-btn-sm" style={{ borderColor: dark ? "rgba(110,231,183,.2)" : "rgba(5,150,105,.15)", color: dark ? "#6ee7b7" : "#059669" }}>Approve</button>
                      <button onClick={() => rejectManual(tx)} className="adm-btn-sm" style={{ borderColor: dark ? "rgba(220,38,38,.2)" : "rgba(220,38,38,.1)", color: dark ? "#fca5a5" : "#dc2626" }}>Reject</button>
                    </div>
                  )}
                  {tx.status === "Pending" && !canApprove && (
                    <span style={{ fontSize: 11, padding: "3px 10px", borderRadius: 4, background: dark ? "rgba(255,255,255,.04)" : "rgba(0,0,0,.03)", color: t.textMuted }}>View only</span>
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
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
            <button onClick={() => setAddModal(true)} className="adm-btn-primary" style={{ flexShrink: 0 }}>+ Add Gateway</button>
          </div>
          {loading ? <div>{[1,2,3].map(i => <div key={i} className={`skel-bone ${dark ? "skel-dark" : "skel-light"}`} style={{ height: 52, borderRadius: 8, marginBottom: 6 }} />)}</div> : (
            <div className="adm-card" style={{ background: dark ? "rgba(255,255,255,.03)" : "rgba(255,255,255,.85)", border: `0.5px solid ${dark ? "rgba(255,255,255,.06)" : "rgba(0,0,0,.06)"}` }}>
              {gateways.map((g, i) => (
                <div key={g.id} className="adm-list-row" style={{ borderBottom: i < gateways.length - 1 ? `1px solid ${t.cardBorder}` : "none", flexWrap: "wrap", gap: 10 }}>
                  <div style={{ flex: 1, minWidth: 160 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
                      <span style={{ fontSize: 15, fontWeight: 500, color: t.text }}>{g.name}</span>
                      <span style={{ fontSize: 11, padding: "2px 6px", borderRadius: 4, fontWeight: 600, background: g.enabled ? (dark ? "rgba(110,231,183,.1)" : "rgba(5,150,105,.06)") : (dark ? "rgba(255,255,255,.06)" : "rgba(0,0,0,.04)"), color: g.enabled ? (dark ? "#6ee7b7" : "#059669") : t.textMuted }}>{g.enabled ? "Active" : "Disabled"}</span>
                      {g.hasKeys && <span style={{ fontSize: 11, padding: "2px 6px", borderRadius: 4, fontWeight: 600, background: dark ? "rgba(96,165,250,.08)" : "rgba(59,130,246,.06)", color: dark ? "#60a5fa" : "#2563eb" }}>Keys set</span>}
                    </div>
                    <div style={{ fontSize: 13, color: t.textMuted }}>{g.desc}</div>
                  </div>
                  <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
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
        <div onClick={() => setConfiguring(null)} style={{ position: "fixed", inset: 0, zIndex: 100, background: "rgba(0,0,0,.5)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div onClick={e => e.stopPropagation()} style={{ width: "100%", maxWidth: 440, background: dark ? "#111728" : "#fff", borderRadius: 16, padding: 24, border: `1px solid ${t.cardBorder}`, boxShadow: "0 20px 60px rgba(0,0,0,.3)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div style={{ fontSize: 16, fontWeight: 600, color: t.text }}>Configure {configuring.name}</div>
              <button onClick={() => setConfiguring(null)} style={{ background: "none", border: "none", color: t.textMuted, fontSize: 18, cursor: "pointer" }}>✕</button>
            </div>
            <div style={{ fontSize: 13, color: t.textMuted, marginBottom: 16, lineHeight: 1.5 }}>{configuring.id === "manual" ? "Enter your bank details. Users will see these when selecting bank transfer." : configuring.id === "crypto" ? "API key is set via environment variable. You can leave this blank." : "Enter your API keys. Leave blank to keep existing keys. Current keys are masked for security."}</div>
            {Object.entries(configFields).map(([key]) => {
              const isSecret = !["bankName", "accountNumber", "accountName"].includes(key);
              return (
              <div key={key} style={{ marginBottom: 14 }}>
                <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: t.textMuted, marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.8 }}>{FIELD_LABELS[key] || key}</label>
                <div style={{ fontSize: 12, color: t.textMuted, marginBottom: 4 }}>Current: {configuring.fields?.[key] || "Not set"}</div>
                <input
                  type={isSecret ? "password" : "text"}
                  value={configFields[key]}
                  onChange={e => setConfigFields(prev => ({ ...prev, [key]: e.target.value }))}
                  placeholder={`Enter ${FIELD_LABELS[key] || key}`}
                  style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: `1px solid ${t.cardBorder}`, background: dark ? "rgba(255,255,255,.04)" : "rgba(0,0,0,.03)", color: t.text, fontSize: 14, outline: "none", fontFamily: isSecret ? "'JetBrains Mono', monospace" : "'Outfit', sans-serif", boxSizing: "border-box" }}
                />
              </div>
              );
            })}
            <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
              <button onClick={saveConfig} disabled={saving} style={{ flex: 1, padding: "11px 0", borderRadius: 8, background: "linear-gradient(135deg,#c47d8e,#8b5e6b)", color: "#fff", fontSize: 14, fontWeight: 600, border: "none", cursor: "pointer" }}>{saving ? "Saving..." : "Save Keys"}</button>
              <button onClick={() => setConfiguring(null)} style={{ padding: "11px 20px", borderRadius: 8, background: "none", border: `1px solid ${t.cardBorder}`, color: t.textMuted, fontSize: 14, cursor: "pointer" }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Add Gateway modal */}
      {addModal && (
        <div onClick={() => setAddModal(false)} style={{ position: "fixed", inset: 0, zIndex: 100, background: "rgba(0,0,0,.5)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div onClick={e => e.stopPropagation()} style={{ width: "100%", maxWidth: 420, background: dark ? "#111728" : "#fff", borderRadius: 16, padding: 24, border: `1px solid ${t.cardBorder}`, boxShadow: "0 20px 60px rgba(0,0,0,.3)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div style={{ fontSize: 16, fontWeight: 600, color: t.text }}>Add Payment Gateway</div>
              <button onClick={() => setAddModal(false)} style={{ background: "none", border: "none", color: t.textMuted, fontSize: 18, cursor: "pointer" }}>✕</button>
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: t.textMuted, marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.8 }}>Gateway ID</label>
              <div style={{ fontSize: 12, color: t.textMuted, marginBottom: 4 }}>Lowercase, no spaces (e.g. "stripe", "squad")</div>
              <input value={newGw.id} onChange={e => setNewGw(prev => ({ ...prev, id: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 30) }))} placeholder="e.g. stripe" style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: `1px solid ${t.cardBorder}`, background: dark ? "rgba(255,255,255,.04)" : "rgba(0,0,0,.03)", color: t.text, fontSize: 14, outline: "none", fontFamily: "'JetBrains Mono', monospace", boxSizing: "border-box" }} />
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: t.textMuted, marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.8 }}>Display Name</label>
              <input value={newGw.name} onChange={e => setNewGw(prev => ({ ...prev, name: e.target.value.slice(0, 50) }))} placeholder="e.g. Stripe" style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: `1px solid ${t.cardBorder}`, background: dark ? "rgba(255,255,255,.04)" : "rgba(0,0,0,.03)", color: t.text, fontSize: 14, outline: "none", boxSizing: "border-box" }} />
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: t.textMuted, marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.8 }}>Description</label>
              <input value={newGw.desc} onChange={e => setNewGw(prev => ({ ...prev, desc: e.target.value.slice(0, 100) }))} placeholder="e.g. Cards, Apple Pay" style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: `1px solid ${t.cardBorder}`, background: dark ? "rgba(255,255,255,.04)" : "rgba(0,0,0,.03)", color: t.text, fontSize: 14, outline: "none", boxSizing: "border-box" }} />
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={async () => {
                if (!newGw.id || !newGw.name) { setMsg({ type: "error", text: "ID and name required" }); return; }
                if (gateways.some(g => g.id === newGw.id)) { setMsg({ type: "error", text: "Gateway ID already exists" }); return; }
                setSaving(true);
                const res = await fetch("/api/admin/payments", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "add", gatewayId: newGw.id, name: newGw.name, desc: newGw.desc }) });
                if (res.ok) { setMsg({ type: "success", text: `${newGw.name} added` }); setAddModal(false); setNewGw({ id: "", name: "", desc: "" }); refresh(); }
                else { const d = await res.json(); setMsg({ type: "error", text: d.error || "Failed" }); }
                setSaving(false);
              }} disabled={saving || !newGw.id || !newGw.name} style={{ flex: 1, padding: "11px 0", borderRadius: 8, background: newGw.id && newGw.name ? "linear-gradient(135deg,#c47d8e,#8b5e6b)" : (dark ? "rgba(255,255,255,.04)" : "rgba(0,0,0,.03)"), color: newGw.id && newGw.name ? "#fff" : t.textMuted, fontSize: 14, fontWeight: 600, border: "none", cursor: newGw.id && newGw.name ? "pointer" : "default" }}>{saving ? "Adding..." : "Add Gateway"}</button>
              <button onClick={() => setAddModal(false)} style={{ padding: "11px 20px", borderRadius: 8, background: "none", border: `1px solid ${t.cardBorder}`, color: t.textMuted, fontSize: 14, cursor: "pointer" }}>Cancel</button>
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
    padding: "8px 20px", borderRadius: 8, fontSize: 13, fontWeight: tab === id ? 600 : 400,
    background: tab === id ? (dark ? "rgba(196,125,142,.12)" : "rgba(196,125,142,.08)") : "transparent",
    color: tab === id ? t.accent : t.textMuted,
    border: `1px solid ${tab === id ? (dark ? "rgba(196,125,142,.2)" : "rgba(196,125,142,.15)") : "transparent"}`,
    cursor: "pointer",
  });

  return (
    <>
      <div className="adm-header">
        <div className="adm-header-row">
          <div>
            <div className="adm-title" style={{ color: t.text }}>Finance</div>
            <div className="adm-subtitle" style={{ color: t.textMuted }}>{tab === "overview" ? "Revenue, growth, and performance" : "Complete money flow breakdown"}</div>
          </div>
          <div style={{ display: "flex", gap: 4 }}>
            <button onClick={() => setTab("overview")} style={tabStyle("overview")}>Overview</button>
            {canBreakdown && <button onClick={() => setTab("breakdown")} style={tabStyle("breakdown")}>Breakdown</button>}
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

  // Load Chart.js dynamically
  useEffect(() => {
    if (!window.Chart) {
      const s = document.createElement("script");
      s.src = "https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.js";
      s.onload = () => renderChart();
      document.head.appendChild(s);
    }
  }, []);

  // Render/update chart when data or theme changes
  const renderChart = useCallback(() => {
    if (!chartRef.current || !stats?.chartData || !window.Chart) return;
    if (chartInstance.current) chartInstance.current.destroy();
    const cd = stats.chartData;
    const gridColor = dark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)";
    const tickColor = dark ? "rgba(255,255,255,0.4)" : "rgba(0,0,0,0.4)";
    chartInstance.current = new window.Chart(chartRef.current, {
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
  }, [stats, dark]);

  useEffect(() => { renderChart(); }, [renderChart]);

  const changeRange = (r) => { setRange(r); load(r); };

  if (loading) return <div className="adm-stats">{[1,2,3,4].map(i => <div key={i} className={`skel-bone ${dark ? "skel-dark" : "skel-light"}`} style={{ height: 90, borderRadius: 12 }} />)}</div>;

  const s = stats || {};
  return (
    <>
      {/* Range filter */}
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 16 }}>
        <select value={range} onChange={e => changeRange(e.target.value)} style={{
          padding: "7px 28px 7px 10px", borderRadius: 8, fontSize: 13, fontWeight: 500,
          background: dark ? "rgba(255,255,255,.04)" : "rgba(0,0,0,.03)",
          border: `1px solid ${dark ? "rgba(255,255,255,.08)" : "rgba(0,0,0,.08)"}`,
          color: dark ? "rgba(255,255,255,.7)" : "rgba(0,0,0,.7)",
          appearance: "none", cursor: "pointer", fontFamily: "inherit",
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='10' height='6' viewBox='0 0 10 6' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1L5 5L9 1' stroke='${dark ? "%23666" : "%23999"}' stroke-width='1.5' stroke-linecap='round'/%3E%3C/svg%3E")`,
          backgroundRepeat: "no-repeat", backgroundPosition: "right 8px center",
        }}>
          {[["24h", "Today"], ["7d", "Last 7 days"], ["30d", "Last 30 days"], ["90d", "Last 90 days"]].map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>
      </div>

      <div className="adm-stats" style={{ marginTop: 0 }}>
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
        <div className="adm-card" style={{ background: dark ? "rgba(255,255,255,.03)" : "rgba(255,255,255,.85)", border: `0.5px solid ${dark ? "rgba(255,255,255,.06)" : "rgba(0,0,0,.06)"}`, padding: "16px", marginBottom: 24 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <div className="adm-card-title" style={{ color: t.textMuted }}>Orders & Deposits</div>
            <div style={{ display: "flex", gap: 12, fontSize: 12, color: t.textMuted }}>
              <span style={{ display: "flex", alignItems: "center", gap: 4 }}><span style={{ width: 10, height: 10, borderRadius: 2, background: dark ? "rgba(196,125,142,0.5)" : "rgba(196,125,142,0.6)" }} />Orders</span>
              <span style={{ display: "flex", alignItems: "center", gap: 4 }}><span style={{ width: 10, height: 10, borderRadius: 2, background: "#059669" }} />Deposits</span>
            </div>
          </div>
          <div style={{ position: "relative", height: 240 }}>
            <canvas ref={chartRef} />
          </div>
        </div>
      )}

      <div className="adm-grid-2" style={{ marginTop: 24 }}>
        <div>
          <div className="adm-card" style={{ background: dark ? "rgba(255,255,255,.03)" : "rgba(255,255,255,.85)", border: `0.5px solid ${dark ? "rgba(255,255,255,.06)" : "rgba(0,0,0,.06)"}` }}>
            <div className="adm-card-title" style={{ color: t.textMuted, padding: "16px 16px 0" }}>Top platforms</div>
            <div className="adm-card-divider" style={{ background: dark ? "rgba(255,255,255,.06)" : "rgba(0,0,0,.06)", margin: "12px 0 0" }} />
            {(s.topPlatforms || []).length > 0 ? s.topPlatforms.map((p, i, arr) => (
              <div key={p.name} className="adm-list-row" style={{ borderBottom: i < arr.length - 1 ? `1px solid ${t.cardBorder}` : "none" }}>
                <div><div style={{ fontSize: 15, fontWeight: 500, color: t.text }}>{p.name}</div><div style={{ fontSize: 14, color: t.textMuted }}>{p.orders} orders</div></div>
                <div style={{ fontSize: 15, fontWeight: 600, color: t.green }}>{fN(p.revenue || 0)}</div>
              </div>
            )) : <div className="adm-empty" style={{ color: t.textMuted }}>No platform data yet</div>}
          </div>
        </div>
        <div>
          <div className="adm-card" style={{ background: dark ? "rgba(255,255,255,.03)" : "rgba(255,255,255,.85)", border: `0.5px solid ${dark ? "rgba(255,255,255,.06)" : "rgba(0,0,0,.06)"}` }}>
            <div className="adm-card-title" style={{ color: t.textMuted, padding: "16px 16px 0" }}>Order status breakdown</div>
            <div className="adm-card-divider" style={{ background: dark ? "rgba(255,255,255,.06)" : "rgba(0,0,0,.06)", margin: "12px 0 0" }} />
            {[["Completed", s.byStatus?.find(x => x.status === "Completed")?.count || 0, t.green], ["Processing", s.byStatus?.find(x => x.status === "Processing")?.count || 0, t.blue], ["Pending", s.byStatus?.find(x => x.status === "Pending")?.count || 0, t.amber], ["Canceled", s.byStatus?.find(x => x.status === "Canceled")?.count || 0, dark ? "#fca5a5" : "#dc2626"]].map(([label, count, color], i, arr) => (
              <div key={label} className="adm-list-row" style={{ borderBottom: i < arr.length - 1 ? `1px solid ${t.cardBorder}` : "none" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ width: 8, height: 8, borderRadius: 4, background: color }} />
                  <span style={{ fontSize: 15, color: t.text }}>{label}</span>
                </div>
                <span style={{ fontSize: 15, fontWeight: 600, color }}>{count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Top Services */}
      {(s.topServices || []).length > 0 && (
        <div style={{ marginTop: 24 }}>
          <div className="adm-card" style={{ background: dark ? "rgba(255,255,255,.03)" : "rgba(255,255,255,.85)", border: `0.5px solid ${dark ? "rgba(255,255,255,.06)" : "rgba(0,0,0,.06)"}` }}>
            <div className="adm-card-title" style={{ color: t.textMuted, padding: "16px 16px 0" }}>Top services by revenue</div>
            <div className="adm-card-divider" style={{ background: dark ? "rgba(255,255,255,.06)" : "rgba(0,0,0,.06)", margin: "12px 0 0" }} />
            {s.topServices.map((sv, i, arr) => (
              <div key={i} className="adm-list-row" style={{ borderBottom: i < arr.length - 1 ? `1px solid ${t.cardBorder}` : "none" }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 15, fontWeight: 500, color: t.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{sv.name}</div>
                  <div style={{ fontSize: 13, color: t.textMuted }}>{sv.category} · {sv.orders} orders</div>
                </div>
                <div style={{ fontSize: 15, fontWeight: 600, color: t.green }}>{fN(sv.revenue || 0)}</div>
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
              <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: dark ? "#6ee7b7" : "#059669", marginBottom: 10 }}>
                <div style={{ width: 6, height: 6, borderRadius: "50%", background: dark ? "#6ee7b7" : "#059669" }} />
                Active
              </div>
              <div style={{
                display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", borderRadius: 10, marginBottom: 12,
                background: dark ? `${typeColors[active.type]}15` : `${typeColors[active.type]}08`,
                border: `1px solid ${dark ? `${typeColors[active.type]}40` : `${typeColors[active.type]}30`}`,
                borderLeft: `3px solid ${typeColors[active.type]}`,
              }}>
                <span style={{ fontSize: 14, flexShrink: 0 }}>{typeIcons[active.type] || "📢"}</span>
                <span style={{ flex: 1, fontSize: 14, fontWeight: 500, color: t.text }}>{active.message}</span>
                <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 6, background: dark ? "rgba(110,231,183,.12)" : "rgba(5,150,105,.06)", color: dark ? "#6ee7b7" : "#059669", flexShrink: 0 }}>Live</span>
              </div>
              <div style={{ display: "flex", gap: 6, marginBottom: history.length > 0 ? 12 : 0 }}>
                <button onClick={() => toggleAlert(active.id, true, target)} className="adm-btn-sm" style={{ borderColor: t.cardBorder, color: dark ? "#fbbf24" : "#d97706" }}>Pause</button>
                <button onClick={async () => { const ok = await confirm({ title: "Delete Alert", message: `Delete "${active.message?.slice(0, 50)}..."?`, confirmLabel: "Delete", danger: true }); if (ok) deleteAlert(active.id); }} className="adm-btn-sm" style={{ borderColor: dark ? "rgba(252,165,165,.2)" : "rgba(220,38,38,.15)", color: dark ? "#fca5a5" : "#dc2626" }}>Delete</button>
                <button onClick={() => { setCreating(target); setNewMsg(""); setNewType("info"); }} className="adm-btn-sm" style={{ borderColor: t.cardBorder, color: t.textSoft }}>+ New</button>
              </div>
            </>
          ) : (
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 12 }}>
              <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#555" }} />
              <span style={{ fontSize: 12, color: "#555" }}>No active alert</span>
              <button onClick={() => { setCreating(target); setNewMsg(""); setNewType("info"); }} className="adm-btn-primary" style={{ marginLeft: "auto", fontSize: 12, padding: "6px 14px" }}>+ Create</button>
            </div>
          )}

          {/* Create form — inline */}
          {isCreating && (
            <div style={{ marginTop: 8, paddingTop: 12, borderTop: `1px solid ${t.cardBorder}` }}>
              {active && (
                <div style={{ fontSize: 12, color: dark ? "#fbbf24" : "#d97706", marginBottom: 10 }}>
                  Current alert will be auto-paused when you create a new one.
                </div>
              )}
              <div style={{ marginBottom: 10 }}>
                <label style={{ fontSize: 13, color: t.textMuted, display: "block", marginBottom: 4 }}>Message</label>
                <textarea value={newMsg} onChange={e => setNewMsg(e.target.value)} placeholder="What do you want to announce?" rows={2} style={{ width: "100%", padding: "10px 14px", borderRadius: 8, borderWidth: 1, borderStyle: "solid", borderColor: t.cardBorder, background: dark ? "#0d1020" : "#fff", color: t.text, fontSize: 14, outline: "none", resize: "vertical", fontFamily: "inherit", boxSizing: "border-box" }} />
              </div>
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 13, color: t.textMuted, display: "block", marginBottom: 4 }}>Type</label>
                <div style={{ display: "flex", gap: 4 }}>
                  {[["info", "Info"], ["success", "Success"], ["warning", "Warning"], ["urgent", "Urgent"]].map(([ty, label]) => (
                    <button key={ty} onClick={() => setNewType(ty)} style={{
                      padding: "6px 12px", borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: "pointer",
                      borderWidth: 1, borderStyle: "solid", fontFamily: "inherit",
                      borderColor: newType === ty ? typeColors[ty] : t.cardBorder,
                      background: newType === ty ? (dark ? "rgba(255,255,255,.04)" : "rgba(0,0,0,.02)") : "transparent",
                      color: newType === ty ? typeColors[ty] : t.textMuted,
                    }}>{label}</button>
                  ))}
                </div>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => createAlert(target)} disabled={!newMsg.trim() || saving} className="adm-btn-primary" style={{ opacity: newMsg.trim() && !saving ? 1 : .4, fontSize: 13 }}>{saving ? "Creating..." : isOverride ? "Create override" : "Create & auto-pause old"}</button>
                <button onClick={() => setCreating(null)} className="adm-btn-sm" style={{ borderColor: t.cardBorder, color: t.textSoft }}>Cancel</button>
              </div>
            </div>
          )}

          {/* History */}
          {history.length > 0 && (
            <>
              <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: 1.5, textTransform: "uppercase", color: "#555", marginTop: 14, marginBottom: 6 }}>History</div>
              {history.slice(0, 5).map(a => (
                <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 0", borderBottom: `1px solid ${dark ? "rgba(255,255,255,.04)" : "rgba(0,0,0,.04)"}`, fontSize: 13 }}>
                  <span style={{ fontSize: 11, fontWeight: 600, padding: "1px 6px", borderRadius: 4, flexShrink: 0, background: dark ? `${typeColors[a.type]}15` : `${typeColors[a.type]}08`, color: typeColors[a.type] || t.textMuted }}>{a.type}</span>
                  <span style={{ flex: 1, color: "#706c68", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.message}</span>
                  <span style={{ color: "#555", fontSize: 12, flexShrink: 0 }}>{a.created ? fD(a.created) : ""}</span>
                  <button onClick={() => toggleAlert(a.id, false, target)} className="adm-btn-sm" style={{ padding: "3px 8px", fontSize: 11, borderColor: t.cardBorder, color: dark ? "#6ee7b7" : "#059669" }}>Reactivate</button>
                  <button onClick={async () => { const ok = await confirm({ title: "Delete", message: `Delete this alert?`, confirmLabel: "Delete", danger: true }); if (ok) deleteAlert(a.id); }} className="adm-btn-sm" style={{ padding: "3px 8px", fontSize: 11, borderColor: dark ? "rgba(252,165,165,.15)" : "rgba(220,38,38,.1)", color: dark ? "#fca5a5" : "#dc2626" }}>✕</button>
                </div>
              ))}
            </>
          )}
        </div>
      </div>
    );
  };

  if (loading) return <><div className="adm-header"><div className="adm-title" style={{ color: t.text }}>Announcements</div><div className="adm-subtitle" style={{ color: t.textMuted }}>Loading...</div><div className="page-divider" style={{ background: t.cardBorder }} /></div><div>{[1,2,3].map(i => <div key={i} className={`skel-bone ${dark ? "skel-dark" : "skel-light"}`} style={{ height: 60, borderRadius: 10, marginBottom: 8 }} />)}</div></>;

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
        <div style={{ fontSize: 12, color: dark ? "#fbbf24" : "#d97706", marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
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
      {info && <div style={{ fontSize: 14, color: t.text, marginBottom: 10 }}>{info.unverifiedTotal || 0} unverified accounts total · {info.staleCount || 0} older than 7 days</div>}
      {result && <div style={{ padding: "8px 12px", borderRadius: 8, marginBottom: 10, fontSize: 14, background: result.type === "success" ? (dark ? "rgba(110,231,183,.08)" : "#ecfdf5") : (dark ? "rgba(220,38,38,.08)" : "#fef2f2"), color: result.type === "success" ? (dark ? "#6ee7b7" : "#059669") : (dark ? "#fca5a5" : "#dc2626") }}>{result.type === "success" ? "✓" : "⚠️"} {result.text}</div>}
      <button onClick={run} disabled={cleaning} className="adm-btn-primary" style={{ opacity: cleaning ? .5 : 1 }}>{cleaning ? "Cleaning..." : "Clean Up Stale Accounts"}</button>
    </>
  );
}

export function AdminSettingsPage({ admin, dark, t, themeMode, setThemeMode, setDark, onLogout }) {
  const confirm = useConfirm();
  const [social, setSocial] = useState({ social_whatsapp: "", social_telegram: "", social_instagram: "", social_twitter: "", social_whatsapp_support: "" });
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

      <div style={{ marginTop: 16 }}>
        {/* Profile */}
        <div className="set-section">
          <div className="set-card" style={{ background: dark ? "rgba(255,255,255,.03)" : "rgba(255,255,255,.85)", border: `0.5px solid ${t.cardBorder}` }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div className="set-card-title" style={{ color: t.textMuted }}>Profile</div>
              {!profileEditing && <button onClick={() => setProfileEditing(true)} style={{ fontSize: 13, color: t.accent, background: "none", border: "none", cursor: "pointer" }}>Edit</button>}
            </div>
            <div className="set-card-divider" style={{ background: t.cardBorder }} />
            {profileMsg && <div style={{ padding: "8px 12px", borderRadius: 8, marginBottom: 12, fontSize: 14, background: profileMsg.type === "success" ? (dark ? "rgba(110,231,183,.08)" : "#ecfdf5") : (dark ? "rgba(220,38,38,.08)" : "#fef2f2"), color: profileMsg.type === "success" ? (dark ? "#6ee7b7" : "#059669") : (dark ? "#fca5a5" : "#dc2626") }}>{profileMsg.type === "success" ? "✓" : "⚠️"} {profileMsg.text}</div>}
            {profileEditing ? (
              <>
                <div style={{ marginBottom: 12 }}>
                  <label style={{ fontSize: 14, color: t.textMuted, display: "block", marginBottom: 4 }}>Name</label>
                  <input value={editName} onChange={e => setEditName(e.target.value)} style={{ width: "100%", padding: "10px 14px", borderRadius: 8, borderWidth: 1, borderStyle: "solid", borderColor: t.cardBorder, background: dark ? "#0d1020" : "#fff", color: t.text, fontSize: 15, outline: "none", boxSizing: "border-box" }} />
                </div>
                <div style={{ marginBottom: 12 }}>
                  <label style={{ fontSize: 14, color: t.textMuted, display: "block", marginBottom: 4 }}>Email</label>
                  <input value={editEmail} onChange={e => setEditEmail(e.target.value)} style={{ width: "100%", padding: "10px 14px", borderRadius: 8, borderWidth: 1, borderStyle: "solid", borderColor: t.cardBorder, background: dark ? "#0d1020" : "#fff", color: t.text, fontSize: 15, outline: "none", boxSizing: "border-box" }} />
                </div>
                <div style={{ marginBottom: 8 }}>
                  <div style={{ fontSize: 13, color: t.textMuted, textTransform: "uppercase", letterSpacing: .8, marginBottom: 3 }}>Role</div>
                  <div style={{ fontSize: 15, fontWeight: 500, color: t.textMuted }}>{admin?.role || "admin"} (cannot be changed)</div>
                </div>
                <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
                  <button onClick={saveProfile} disabled={profileSaving} className="adm-btn-primary" style={{ opacity: profileSaving ? .5 : 1 }}>{profileSaving ? "Saving..." : "Save"}</button>
                  <button onClick={() => { setProfileEditing(false); setEditName(admin?.name || ""); setEditEmail(admin?.email || ""); setProfileMsg(null); }} style={{ padding: "8px 16px", borderRadius: 8, border: `1px solid ${t.cardBorder}`, background: "none", color: t.textSoft, fontSize: 14, cursor: "pointer" }}>Cancel</button>
                </div>
              </>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                {[["Name", admin?.name || "Admin"], ["Email", admin?.email || ""], ["Role", admin?.role || "admin"]].map(([label, val]) => (
                  <div key={label}><div style={{ fontSize: 13, color: t.textMuted, textTransform: "uppercase", letterSpacing: .8, marginBottom: 3 }}>{label}</div><div style={{ fontSize: 15, fontWeight: 500, color: t.text }}>{val}</div></div>
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
            <div style={{ display: "flex", gap: 8 }}>
              {[["day", "☀ Light"], ["night", "☾ Dark"], ["auto", "◑ Auto"]].map(([id, lb]) => (
                <button key={id} onClick={() => applyTheme(id)} style={{ flex: 1, padding: "12px 10px", borderRadius: 10, borderWidth: 1, borderStyle: "solid", borderColor: themeMode === id ? t.accent : t.cardBorder, background: themeMode === id ? (dark ? "#2a1a22" : "#fdf2f4") : (dark ? "rgba(255,255,255,.04)" : "rgba(255,255,255,.8)"), color: themeMode === id ? t.accent : t.textSoft, fontSize: 15, fontWeight: themeMode === id ? 600 : 450, textAlign: "center" }}>{lb}</button>
              ))}
            </div>
          </div>
        </div>

        {/* Change password */}
        <div className="set-section">
          <div className="set-card" style={{ background: dark ? "rgba(255,255,255,.03)" : "rgba(255,255,255,.85)", border: `0.5px solid ${t.cardBorder}` }}>
            <div className="set-card-title" style={{ color: t.textMuted }}>Change password</div>
            <div className="set-card-divider" style={{ background: t.cardBorder }} />
            {admPwMsg && <div style={{ padding: "8px 12px", borderRadius: 8, marginBottom: 12, fontSize: 14, background: admPwMsg.type === "success" ? (dark ? "rgba(110,231,183,.08)" : "#ecfdf5") : (dark ? "rgba(220,38,38,.08)" : "#fef2f2"), color: admPwMsg.type === "success" ? (dark ? "#6ee7b7" : "#059669") : (dark ? "#fca5a5" : "#dc2626") }}>{admPwMsg.type === "success" ? "✓" : "⚠️"} {admPwMsg.text}</div>}
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 14, color: t.textMuted, display: "block", marginBottom: 4 }}>Current Password</label>
              <input type="password" value={admCurPw} onChange={e => setAdmCurPw(e.target.value)} style={{ width: "100%", padding: "10px 14px", borderRadius: 8, borderWidth: 1, borderStyle: "solid", borderColor: t.cardBorder, background: dark ? "#0d1020" : "#fff", color: t.text, fontSize: 15, outline: "none", boxSizing: "border-box" }} />
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 14, color: t.textMuted, display: "block", marginBottom: 4 }}>New Password</label>
              <input type="password" value={admNewPw} onChange={e => setAdmNewPw(e.target.value)} style={{ width: "100%", padding: "10px 14px", borderRadius: 8, borderWidth: 1, borderStyle: "solid", borderColor: t.cardBorder, background: dark ? "#0d1020" : "#fff", color: t.text, fontSize: 15, outline: "none", boxSizing: "border-box" }} />
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 14, color: t.textMuted, display: "block", marginBottom: 4 }}>Confirm Password</label>
              <input type="password" value={admConfPw} onChange={e => setAdmConfPw(e.target.value)} style={{ width: "100%", padding: "10px 14px", borderRadius: 8, borderWidth: 1, borderStyle: "solid", borderColor: t.cardBorder, background: dark ? "#0d1020" : "#fff", color: t.text, fontSize: 15, outline: "none", boxSizing: "border-box" }} />
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

            {emailMsg && <div style={{ padding: "8px 12px", borderRadius: 8, marginBottom: 12, fontSize: 14, background: emailMsg.type === "success" ? (dark ? "rgba(110,231,183,.08)" : "#ecfdf5") : (dark ? "rgba(220,38,38,.08)" : "#fef2f2"), color: emailMsg.type === "success" ? (dark ? "#6ee7b7" : "#059669") : (dark ? "#fca5a5" : "#dc2626") }}>{emailMsg.type === "success" ? "✓" : "⚠️"} {emailMsg.text}</div>}

            {[
              ["site_email_general", "General Email", "info@nitro.ng", "Main contact email shown on landing page, legal pages, banned page"],
              ["site_email_support", "Support Email", "support@nitro.ng", "Support-specific email shown on support page and ticket responses"],
            ].map(([key, label, placeholder, hint]) => (
              <div key={key} style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 14, color: t.textMuted, display: "block", marginBottom: 3 }}>{label}</label>
                <input value={emails[key] || ""} onChange={e => setEmails(prev => ({ ...prev, [key]: e.target.value.trim() }))} placeholder={placeholder} type="email" style={{ width: "100%", padding: "10px 14px", borderRadius: 8, borderWidth: 1, borderStyle: "solid", borderColor: t.cardBorder, background: dark ? "#0d1020" : "#fff", color: t.text, fontSize: 15, outline: "none", boxSizing: "border-box", fontFamily: "inherit" }} />
                <div style={{ fontSize: 12, color: t.textMuted, marginTop: 2, opacity: .7 }}>{hint}</div>
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

            {socialMsg && <div style={{ padding: "8px 12px", borderRadius: 8, marginBottom: 12, fontSize: 14, background: socialMsg.type === "success" ? (dark ? "rgba(110,231,183,.08)" : "#ecfdf5") : (dark ? "rgba(220,38,38,.08)" : "#fef2f2"), color: socialMsg.type === "success" ? (dark ? "#6ee7b7" : "#059669") : (dark ? "#fca5a5" : "#dc2626") }}>{socialMsg.type === "success" ? "✓" : "⚠️"} {socialMsg.text}</div>}

            {[
              ["social_whatsapp", "WhatsApp Group Link", "https://chat.whatsapp.com/...", "Group invite link for community"],
              ["social_telegram", "Telegram Channel", "https://t.me/...", "Channel or group link"],
              ["social_whatsapp_support", "WhatsApp Support Number", "", "Number for wa.me link (no + prefix)"],
              ["social_instagram", "Instagram Handle", "Nitro.ng", "Without the @ symbol"],
              ["social_twitter", "X / Twitter Handle", "TheNitroNG", "Without the @ symbol"],
            ].map(([key, label, placeholder, hint]) => (
              <div key={key} style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 14, color: t.textMuted, display: "block", marginBottom: 3 }}>{label}</label>
                <input value={social[key] || ""} onChange={e => setSocial(prev => ({ ...prev, [key]: e.target.value }))} placeholder={placeholder} style={{ width: "100%", padding: "10px 14px", borderRadius: 8, borderWidth: 1, borderStyle: "solid", borderColor: t.cardBorder, background: dark ? "#0d1020" : "#fff", color: t.text, fontSize: 15, outline: "none", boxSizing: "border-box", fontFamily: "inherit" }} />
                <div style={{ fontSize: 12, color: t.textMuted, marginTop: 2, opacity: .7 }}>{hint}</div>
              </div>
            ))}

            <button onClick={saveSocial} disabled={socialSaving} className="adm-btn-primary" style={{ opacity: socialSaving ? .5 : 1 }}>{socialSaving ? "Saving..." : "Save Social Links"}</button>
          </div>
        </div>

        {/* Cleanup */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 16, fontWeight: 600, color: t.text, marginBottom: 10 }}>Cleanup</div>
          <div className="adm-card" style={{ background: dark ? "rgba(255,255,255,.03)" : "rgba(255,255,255,.85)", border: `0.5px solid ${dark ? "rgba(255,255,255,.06)" : "rgba(0,0,0,.06)"}`, padding: 18, borderRadius: 14, boxShadow: dark ? "0 4px 20px rgba(0,0,0,.25)" : "0 4px 20px rgba(0,0,0,.04)" }}>
            <div style={{ fontSize: 14, color: t.textMuted, marginBottom: 12, lineHeight: 1.5 }}>Remove unverified accounts older than 7 days that have no orders or transactions.</div>
            <CleanupButton dark={dark} t={t} />
          </div>
        </div>

        {/* Logout */}
        <div style={{ marginBottom: 20 }}>
          <button onClick={onLogout} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, width: "100%", padding: "12px 20px", borderRadius: 10, background: "none", border: `1px solid ${dark ? "rgba(252,165,165,.2)" : "rgba(220,38,38,.15)"}`, cursor: "pointer", fontSize: 15, fontWeight: 600, color: dark ? "#fca5a5" : "#dc2626", fontFamily: "inherit" }}>
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

  const DropdownFilter = ({ value, onChange, options }) => (
    <select value={value} onChange={e => onChange(e.target.value)} style={{
      padding: "7px 28px 7px 10px", borderRadius: 8, fontSize: 13, fontWeight: 500,
      background: dark ? "rgba(255,255,255,.04)" : "rgba(0,0,0,.03)",
      border: `1px solid ${dark ? "rgba(255,255,255,.08)" : "rgba(0,0,0,.08)"}`,
      color: dark ? "rgba(255,255,255,.7)" : "rgba(0,0,0,.7)",
      appearance: "none", cursor: "pointer", fontFamily: "inherit",
      backgroundImage: `url("data:image/svg+xml,%3Csvg width='10' height='6' viewBox='0 0 10 6' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1L5 5L9 1' stroke='${dark ? "%23666" : "%23999"}' stroke-width='1.5' stroke-linecap='round'/%3E%3C/svg%3E")`,
      backgroundRepeat: "no-repeat", backgroundPosition: "right 8px center",
    }}>
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );

  const MetricCard = ({ label, value, sub, color }) => (
    <div style={{ padding: "14px 16px", borderRadius: 12, background: cardBg, border: `0.5px solid ${cardBorder}` }}>
      <div style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, color: subText, marginBottom: 6 }}>{label}</div>
      <div className="m" style={{ fontSize: 20, fontWeight: 700, color: color || t.text }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: subText, marginTop: 3 }}>{sub}</div>}
    </div>
  );

  const MiniBar = ({ value, max, color }) => (
    <div style={{ height: 3, borderRadius: 2, background: dark ? "rgba(255,255,255,.06)" : "rgba(0,0,0,.06)", overflow: "hidden" }}>
      <div style={{ height: "100%", width: `${Math.min((value / (max || 1)) * 100, 100)}%`, borderRadius: 2, background: color }} />
    </div>
  );

  if (loading) return (
    <div className="adm-stats">{[1,2,3,4,5,6].map(i => <div key={i} className={`skel-bone ${dark ? "skel-dark" : "skel-light"}`} style={{ height: 80, borderRadius: 12 }} />)}</div>
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
      <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap", justifyContent: "flex-end" }}>
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
      <div style={{ fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1.5, color: subText, marginBottom: 10 }}>Profitability</div>
      <div className="adm-stats" style={{ marginBottom: 20 }}>
        <MetricCard label="Gross Revenue" value={fN(p.grossRevenue || 0)} sub="Total order charges" />
        <MetricCard label="Refunds" value={fN(p.totalRefunds || 0)} sub={`${p.refundRate || 0}% refund rate`} color={red} />
        <MetricCard label="Net Revenue" value={fN(p.netRevenue || 0)} sub="After refunds" color={green} />
        <MetricCard label="Provider Cost" value={fN(p.totalCost || 0)} sub="MTP + JAP + DAO" color={amber} />
        <MetricCard label="Gross Profit" value={fN(p.grossProfit || 0)} sub={`${p.margin || 0}% margin`} color={p.grossProfit >= 0 ? green : red} />
        <MetricCard label="Per Order" value={fN(p.profitPerOrder || 0)} sub={`${p.orderCount || 0} orders`} />
      </div>

      {/* Money In / Money Out */}
      <div className="adm-grid-2" style={{ marginBottom: 20 }}>
        <div>
          <div style={{ background: cardBg, border: `0.5px solid ${cardBorder}`, borderRadius: 14, padding: "14px 16px" }}>
            <div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, color: green, marginBottom: 12, display: "flex", alignItems: "center", gap: 6 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 014-4h14"/></svg>
              Money In
            </div>
            {[
              ["Deposits", mIn.deposits],
              ["Admin Credits", mIn.adminCredits],
            ].map(([label, val]) => (
              <div key={label} style={{ display: "flex", justifyContent: "space-between", padding: "7px 0", borderBottom: `0.5px solid ${rowBorder}` }}>
                <span style={{ fontSize: 13, color: dark ? "rgba(255,255,255,.5)" : "rgba(0,0,0,.5)" }}>{label}</span>
                <span className="m" style={{ fontSize: 13, fontWeight: 600, color: green }}>{fN(val || 0)}</span>
              </div>
            ))}
            <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 0 2px", marginTop: 4 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: dark ? "rgba(255,255,255,.7)" : "rgba(0,0,0,.7)" }}>Total In</span>
              <span className="m" style={{ fontSize: 15, fontWeight: 700, color: green }}>{fN(totalIn)}</span>
            </div>
          </div>
        </div>
        <div>
          <div style={{ background: cardBg, border: `0.5px solid ${cardBorder}`, borderRadius: 14, padding: "14px 16px" }}>
            <div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, color: red, marginBottom: 12, display: "flex", alignItems: "center", gap: 6 }}>
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
              <div key={label} style={{ display: "flex", justifyContent: "space-between", padding: "7px 0", borderBottom: `0.5px solid ${rowBorder}` }}>
                <span style={{ fontSize: 13, color: dark ? "rgba(255,255,255,.5)" : "rgba(0,0,0,.5)" }}>{label}</span>
                <span className="m" style={{ fontSize: 13, fontWeight: 600, color: red }}>{fN(val || 0)}</span>
              </div>
            ))}
            <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 0 2px", marginTop: 4 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: dark ? "rgba(255,255,255,.7)" : "rgba(0,0,0,.7)" }}>Total Out</span>
              <span className="m" style={{ fontSize: 15, fontWeight: 700, color: red }}>{fN(totalOut)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Liability */}
      <div style={{ fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1.5, color: subText, marginBottom: 10 }}>Liability & Cash</div>
      <div className="adm-stats" style={{ marginBottom: 20 }}>
        <MetricCard label="Wallet Liability" value={fN(lib.walletBalances || 0)} sub={`${lib.walletUsers || 0} users with balance`} color={amber} />
        <MetricCard label="Net Cash Flow" value={fN(totalIn - totalOut)} sub="Money in - Money out" color={totalIn - totalOut >= 0 ? green : red} />
        <MetricCard label="Retained Profit" value={fN((p.grossProfit || 0))} sub={`${p.margin || 0}% margin`} color={green} />
      </div>

      {/* Profit by Platform */}
      {(s.byPlatform || []).length > 0 && <>
        <div style={{ fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1.5, color: subText, marginBottom: 10, marginTop: 4 }}>Profit by platform</div>
        <div className="adm-card" style={{ background: cardBg, border: `0.5px solid ${cardBorder}`, marginBottom: 20, overflow: "hidden" }}>
          {/* Header */}
          <div className="fin-table-header" style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr 0.7fr 0.6fr", padding: "10px 14px", borderBottom: `0.5px solid ${dark ? "rgba(255,255,255,.06)" : "rgba(0,0,0,.06)"}` }}>
            {["Platform", "Revenue", "Cost", "Profit", "Orders", "Margin"].map(h => (
              <div key={h} style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, color: subText, textAlign: h !== "Platform" ? "right" : "left" }}>{h}</div>
            ))}
          </div>
          {s.byPlatform.map((pl, i) => (
            <div key={pl.name}>
              <div className="fin-table-row" style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr 0.7fr 0.6fr", padding: "10px 14px", borderBottom: i < s.byPlatform.length - 1 ? `0.5px solid ${rowBorder}` : "none" }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: t.text }}>{pl.name}</div>
                <div className="m" style={{ fontSize: 12, color: dark ? "rgba(255,255,255,.6)" : "rgba(0,0,0,.6)", textAlign: "right" }}>{fN(pl.revenue || 0)}</div>
                <div className="m" style={{ fontSize: 12, color: red, textAlign: "right" }}>{fN(pl.cost || 0)}</div>
                <div className="m" style={{ fontSize: 12, color: green, textAlign: "right", fontWeight: 600 }}>{fN(pl.profit || 0)}</div>
                <div style={{ fontSize: 12, color: dark ? "rgba(255,255,255,.5)" : "rgba(0,0,0,.5)", textAlign: "right" }}>{pl.orders}</div>
                <div style={{ fontSize: 12, fontWeight: 600, color: (pl.margin || 0) >= 50 ? green : amber, textAlign: "right" }}>{pl.margin || 0}%</div>
              </div>
              <div style={{ padding: "0 14px 6px" }}><MiniBar value={pl.profit || 0} max={(s.byPlatform[0]?.profit || 1)} color={t.accent} /></div>
            </div>
          ))}
        </div>
      </>}

      {/* Profit by Tier */}
      {(s.byTier || []).length > 0 && <>
        <div style={{ fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1.5, color: subText, marginBottom: 10 }}>Profit by tier</div>
        <div className="adm-stats" style={{ marginBottom: 20 }}>
          {s.byTier.map(tr => {
            const tierColor = tr.name === "Budget" ? "#f59e0b" : tr.name === "Standard" ? "#3b82f6" : "#8b5cf6";
            return (
              <div key={tr.name} style={{ padding: "14px 16px", borderRadius: 12, background: cardBg, border: `0.5px solid ${cardBorder}` }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: tierColor }} />
                  <span style={{ fontSize: 13, fontWeight: 600, color: t.text }}>{tr.name}</span>
                </div>
                <div className="m" style={{ fontSize: 18, fontWeight: 700, color: green, marginBottom: 3 }}>{fN(tr.profit || 0)}</div>
                <div style={{ fontSize: 11, color: subText, marginBottom: 8 }}>{tr.orders} orders · {tr.margin || 0}% margin</div>
                <MiniBar value={tr.margin || 0} max={100} color={tierColor} />
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, fontSize: 11, color: subText }}>
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
        <div style={{ fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1.5, color: subText, marginBottom: 10 }}>Top spenders</div>
        <div className="adm-card" style={{ background: cardBg, border: `0.5px solid ${cardBorder}`, overflow: "hidden" }}>
          {s.topSpenders.map((sp, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", borderBottom: i < s.topSpenders.length - 1 ? `0.5px solid ${rowBorder}` : "none" }}>
              <div style={{ width: 24, height: 24, borderRadius: "50%", background: dark ? "rgba(196,125,142,.1)" : "rgba(196,125,142,.06)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: t.accent, flexShrink: 0 }}>{i + 1}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: t.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{sp.name}</div>
                <div style={{ fontSize: 11, color: subText }}>{sp.orders} orders</div>
              </div>
              <div className="m" style={{ fontSize: 14, fontWeight: 700, color: green, flexShrink: 0 }}>{fN(sp.spent || 0)}</div>
            </div>
          ))}
        </div>
      </>}
    </>
  );
}
