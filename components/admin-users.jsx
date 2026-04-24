'use client';
import { useState, useEffect } from "react";
import { useConfirm } from "./confirm-dialog";
import { fN, fD } from "../lib/format";

const FILTERS = [
  { id: "all", label: "All" },
  { id: "active", label: "Active" },
  { id: "suspended", label: "Banned" },
  { id: "pending-deletion", label: "Pending Del." },
  { id: "deleted", label: "Deleted" },
];

function filterCount(users, id) {
  if (id === "all") return users.length;
  if (id === "active") return users.filter(u => u.status === "Active").length;
  if (id === "suspended") return users.filter(u => u.status === "Suspended").length;
  if (id === "pending-deletion") return users.filter(u => u.status === "PendingDeletion").length;
  if (id === "deleted") return users.filter(u => u.status === "Deleted").length;
  return 0;
}

export default function AdminUsersPage({ dark, t }) {
  const confirm = useConfirm();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [creditId, setCreditId] = useState(null);
  const [creditAmt, setCreditAmt] = useState("");
  const [creditType, setCreditType] = useState("credit");
  const [txUser, setTxUser] = useState(null);
  const [txList, setTxList] = useState([]);
  const [txLoading, setTxLoading] = useState(false);
  const [txPage, setTxPage] = useState(1);
  const [page, setPage] = useState(1);
  const perPage = 15;

  useEffect(() => {
    fetch("/api/admin/users").then(r => r.json()).then(d => { setUsers(d.users || []); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  const filtered = users.filter(u => {
    if (filter === "active" && u.status !== "Active") return false;
    if (filter === "suspended" && u.status !== "Suspended") return false;
    if (filter === "deleted" && u.status !== "Deleted" && u.status !== "PendingDeletion") return false;
    if (filter === "pending-deletion" && u.status !== "PendingDeletion") return false;
    if (search) { const q = search.toLowerCase(); const name = (u.deletedName || u.name || "").toLowerCase(); const email = (u.deletedEmail || u.email || "").toLowerCase(); return name.includes(q) || email.includes(q); }
    return true;
  });

  const totalPages = Math.ceil(filtered.length / perPage);
  const paged = filtered.slice((page - 1) * perPage, page * perPage);

  const [actionLoading, setActionLoading] = useState(null);
  const doAction = async (userId, action, amount, subtype) => {
    if (actionLoading) return;
    setActionLoading(userId);
    try {
      const res = await fetch("/api/admin/users", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, userId, amount: Number(amount) || 0, subtype }) });
      const data = await res.json();
      if (res.ok) {
        if (action === "credit") { setUsers(prev => prev.map(u => u.id === userId ? { ...u, balance: (u.balance || 0) + (Number(amount) || 0) } : u)); setCreditId(null); setCreditAmt(""); setCreditType("credit"); }
        if (action === "suspend" || action === "activate") { setUsers(prev => prev.map(u => u.id === userId ? { ...u, status: action === "suspend" ? "Suspended" : "Active" } : u)); }
        if (action === "reinstate") { setUsers(prev => prev.map(u => u.id === userId ? { ...u, status: "Active", name: u.deletedName || u.name, email: u.deletedEmail || u.email } : u)); }
      }
    } catch {} finally { setActionLoading(null); }
  };

  const handleBan = async (user) => {
    if (user.status === "PendingDeletion") {
      const ok = await confirm({ title: "Reinstate Account", message: `Reinstate ${user.deletedName || user.name}'s account (${user.deletedEmail || user.email})? They will be able to log in again.`, confirmLabel: "Reinstate", danger: false });
      if (ok) doAction(user.id, "reinstate");
    } else {
      const ok = await confirm({ title: user.status === "Active" ? "Ban User" : "Activate User", message: user.status === "Active" ? `Are you sure you want to ban ${user.name} (${user.email})? They will lose access to their account.` : `Reactivate ${user.name}'s account?`, confirmLabel: user.status === "Active" ? "Ban User" : "Activate", danger: user.status === "Active" });
      if (ok) doAction(user.id, user.status === "Active" ? "suspend" : "activate");
    }
  };

  const handleCredit = async (user) => {
    if (Number(creditAmt) <= 0) return;
    const label = creditType === "gift" ? "Gift" : "Credit";
    const ok = await confirm({ title: `${label} Wallet`, message: `${label} ${fN(Number(creditAmt))} to ${user.name}'s wallet?${creditType === "gift" ? "\n\nThis will be recorded as a gift (counts as an expense)." : ""}`, confirmLabel: `${label} ${fN(Number(creditAmt))}` });
    if (ok) doAction(user.id, "credit", creditAmt, creditType);
  };

  const viewTransactions = async (user) => {
    if (txUser?.id === user.id) { setTxUser(null); setTxList([]); setTxPage(1); return; }
    setTxUser(user); setTxLoading(true); setTxList([]); setTxPage(1);
    try {
      const r = await fetch("/api/admin/users", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "transactions", userId: user.id }) });
      const d = await r.json();
      setTxList(d.transactions || []);
    } catch {}
    setTxLoading(false);
  };

  const downloadCSV = (user) => {
    if (!txList.length) return;
    const name = user.deletedName || user.name || "user";
    const header = "Date,Type,Amount,Status,Method,Reference,Note";
    const rows = txList.map(tx => [
      new Date(tx.createdAt).toISOString().split("T")[0],
      tx.type,
      (tx.amount / 100).toFixed(2),
      tx.status,
      tx.method || "",
      tx.reference || "",
      `"${(tx.note || "").replace(/"/g, '""')}"`,
    ].join(","));
    const csv = [header, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `${name.replace(/\s+/g, "-")}-transactions.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const totalBal = users.reduce((s, u) => s + (u.balance || 0), 0);
  const totalOrd = users.reduce((s, u) => s + (u.orders || 0), 0);
  const activeCount = users.filter(u => u.status === "Active").length;

  const cardBg = { background: dark ? "rgba(255,255,255,.06)" : "rgba(255,255,255,.85)" };
  const accentHdr = { background: dark ? "rgba(196,125,142,.18)" : "rgba(196,125,142,.10)" };

  return (
    <>
      {/* Header */}
      <div className="adm-header">
        <div className="adm-title" style={{ color: t.text }}>Users</div>
        <div className="adm-subtitle" style={{ color: t.textMuted }}>{users.length} registered · {activeCount} active</div>
        <div className="page-divider" style={{ background: t.cardBorder }} />
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-4 max-md:grid-cols-2 gap-3 mb-5">
        {[
          { label: "Total Users", value: loading ? "—" : users.length, icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg> },
          { label: "Active", value: loading ? "—" : activeCount, icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg> },
          { label: "Total Balance", value: loading ? "—" : fN(totalBal), icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 12V8H6a2 2 0 010-4h12v4"/><path d="M4 6v12a2 2 0 002 2h14v-4"/><path d="M18 12a2 2 0 000 4h4v-4h-4z"/></svg> },
          { label: "Total Orders", value: loading ? "—" : totalOrd.toLocaleString(), icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8"/><path d="M12 17v4"/></svg> },
        ].map((s, i) => (
          <div key={i} className="rounded-xl py-3 px-4 border" style={{ borderColor: t.cardBorder, ...cardBg }}>
            <div className="flex items-center gap-2 mb-1">
              <span style={{ color: t.accent, opacity: .7 }}>{s.icon}</span>
              <span className="text-[11px] font-semibold uppercase tracking-[1px]" style={{ color: t.textMuted }}>{s.label}</span>
            </div>
            <div className="flex items-baseline gap-2">
              <div className="text-lg font-bold" style={{ color: t.text }}>{s.value}</div>
              {s.sub && <span className="text-xs font-medium" style={{ color: t.accent }}>{s.sub}</span>}
            </div>
          </div>
        ))}
      </div>

      {/* Search + filter bar */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={t.textMuted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input aria-label="Search users" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} placeholder="Search by name or email..." className="w-full py-[9px] pl-9 pr-8 rounded-lg text-[13px] outline-none font-[inherit]" style={{ border: `1px solid ${t.cardBorder}`, background: dark ? "#0d1020" : "#fff", color: t.text }} />
          {search && <button aria-label="Clear search" onClick={() => { setSearch(""); setPage(1); }} className="absolute right-2.5 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center rounded-full text-xs cursor-pointer border-none" style={{ background: dark ? "rgba(255,255,255,.18)" : "rgba(0,0,0,.14)", color: t.textMuted }}><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>}
        </div>
        <select value={filter} onChange={e => { setFilter(e.target.value); setPage(1); }} className="py-[7px] pr-7 pl-2.5 rounded-lg text-[13px] font-medium appearance-none cursor-pointer font-[inherit]" style={{
          backgroundColor: dark ? "rgba(255,255,255,.04)" : "rgba(0,0,0,.03)",
          border: `1px solid ${dark ? "rgba(255,255,255,.14)" : "rgba(0,0,0,.14)"}`,
          color: dark ? "rgba(255,255,255,.7)" : "rgba(0,0,0,.7)",
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='10' height='6' viewBox='0 0 10 6' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1L5 5L9 1' stroke='${dark ? "%23666" : "%23999"}' stroke-width='1.5' stroke-linecap='round'/%3E%3C/svg%3E")`,
          backgroundRepeat: "no-repeat", backgroundPosition: "right 8px center",
        }}>
          {FILTERS.map(f => <option key={f.id} value={f.id}>{f.label} ({filterCount(users, f.id)})</option>)}
        </select>
      </div>

      {/* User list */}
      <div className="rounded-xl overflow-hidden border" style={{ borderColor: t.cardBorder }}>
        {/* Accent table header */}
        <div className="flex py-2.5 px-4 text-[11px] font-semibold uppercase tracking-[1px] gap-3 items-center" style={{ color: t.accent, ...accentHdr }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={t.accent} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>
          <span>{filter === "all" ? "All Users" : FILTERS.find(f => f.id === filter)?.label || "Users"}</span>
          <span className="ml-auto font-medium" style={{ color: t.textMuted }}>{filtered.length} {filtered.length === 1 ? "user" : "users"}</span>
        </div>

        <div style={cardBg}>
          {loading ? (
            <div className="p-4">{[1,2,3,4,5].map(i => <div key={i} className={`skel-bone ${dark ? "skel-dark" : "skel-light"}`} style={{ height: 52, borderRadius: 8, marginBottom: 6 }} />)}</div>
          ) : paged.length > 0 ? paged.map((u, i) => {
            const isDeleted = u.status === "Deleted" || u.status === "PendingDeletion";
            const displayName = isDeleted ? (u.deletedName || u.name) : u.name;
            const displayEmail = isDeleted ? (u.deletedEmail || u.email) : u.email;
            const hue = (displayName || "U").charCodeAt(0) * 45;

            return (
              <div key={u.id}>
                <div className="flex items-center gap-3 py-3 px-4 flex-wrap" style={{ borderBottom: (i < paged.length - 1 && creditId !== u.id && txUser?.id !== u.id) ? `1px solid ${dark ? "rgba(255,255,255,.06)" : "rgba(0,0,0,.06)"}` : "none" }}>
                  {/* Avatar */}
                  <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold shrink-0" style={{ background: isDeleted ? (dark ? "rgba(255,255,255,.06)" : "rgba(0,0,0,.06)") : `linear-gradient(135deg, hsl(${hue},45%,${dark ? 28 : 62}%), hsl(${hue + 30},40%,${dark ? 35 : 70}%))`, color: isDeleted ? t.textMuted : "#fff", textShadow: isDeleted ? "none" : "0 1px 2px rgba(0,0,0,.3)" }}>{(displayName || "U")[0].toUpperCase()}</div>

                  {/* Info */}
                  <div className="flex-1 min-w-[160px]">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[14px] font-semibold" style={{ color: isDeleted ? t.textMuted : t.text }}>{displayName}</span>
                      {u.status !== "Active" && <span className="text-[11px] py-[1px] px-1.5 rounded font-semibold" style={{
                        background: u.status === "PendingDeletion" ? (dark ? "rgba(249,115,22,.1)" : "rgba(249,115,22,.06)")
                          : u.status === "Deleted" ? (dark ? "rgba(255,255,255,.06)" : "rgba(0,0,0,.04)")
                          : (dark ? "rgba(252,165,165,.1)" : "rgba(220,38,38,.06)"),
                        color: u.status === "PendingDeletion" ? (dark ? "#fdba74" : "#ea580c")
                          : u.status === "Deleted" ? t.textMuted
                          : (dark ? "#fca5a5" : "#dc2626"),
                      }}>{u.status === "PendingDeletion" ? "Pending Deletion" : u.status}</span>}
                    </div>
                    <div className="text-[12px] mt-0.5" style={{ color: t.textMuted }}>{displayEmail}</div>
                    {u.status === "PendingDeletion" && u.deletedAt && <div className="text-[11px] mt-0.5" style={{ color: dark ? "#fdba74" : "#ea580c" }}>Deletes {fD(u.deletedAt, true)}</div>}
                    {u.status === "Deleted" && u.deletedAt && <div className="text-[11px] mt-0.5" style={{ color: t.textSoft }}>Deleted {fD(u.deletedAt, true)}</div>}
                  </div>

                  {/* Metrics */}
                  <div className="flex items-center gap-4 max-sm:gap-3">
                    <div className="text-center min-w-[60px]">
                      <div className="text-[14px] font-bold" style={{ color: t.green }}>{fN(u.balance || 0)}</div>
                      <div className="text-[10px] uppercase tracking-[0.5px] font-medium" style={{ color: t.textMuted }}>Balance</div>
                    </div>
                    <div className="text-center min-w-[40px]">
                      <div className="text-[14px] font-bold" style={{ color: t.text }}>{u.orders || 0}</div>
                      <div className="text-[10px] uppercase tracking-[0.5px] font-medium" style={{ color: t.textMuted }}>Orders</div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-1.5 shrink-0">
                    <button onClick={() => viewTransactions(u)} className="py-1.5 px-2.5 rounded-lg text-[11px] font-semibold cursor-pointer font-[inherit] transition-all duration-200 hover:-translate-y-px" style={{ border: `1px solid ${txUser?.id === u.id ? t.accent : t.cardBorder}`, background: txUser?.id === u.id ? (dark ? "rgba(196,125,142,.14)" : "rgba(196,125,142,.06)") : "none", color: txUser?.id === u.id ? t.accent : t.textSoft }}>Txns</button>
                    {!isDeleted && <button onClick={() => setCreditId(creditId === u.id ? null : u.id)} className="py-1.5 px-2.5 rounded-lg text-[11px] font-semibold cursor-pointer font-[inherit] transition-all duration-200 hover:-translate-y-px" style={{ border: `1px solid ${creditId === u.id ? t.accent : t.cardBorder}`, background: creditId === u.id ? (dark ? "rgba(196,125,142,.14)" : "rgba(196,125,142,.06)") : "none", color: t.accent }}>Credit</button>}
                    {!isDeleted && <button onClick={() => handleBan(u)} className="py-1.5 px-2.5 rounded-lg text-[11px] font-semibold cursor-pointer font-[inherit] transition-all duration-200 hover:-translate-y-px" style={{ border: `1px solid ${u.status === "PendingDeletion" ? (dark ? "rgba(110,231,183,.28)" : "rgba(5,150,105,.24)") : (dark ? "rgba(252,165,165,.28)" : "rgba(220,38,38,.24)")}`, background: "none", color: u.status === "PendingDeletion" ? t.green : (u.status === "Active" ? (dark ? "#fca5a5" : "#dc2626") : t.green) }}>{u.status === "PendingDeletion" ? "Reinstate" : (u.status === "Active" ? "Ban" : "Activate")}</button>}
                  </div>
                </div>

                {/* Credit panel */}
                {creditId === u.id && (
                  <div className="py-3 px-4 flex gap-2 items-center flex-wrap" style={{ borderBottom: `1px solid ${dark ? "rgba(255,255,255,.08)" : "rgba(0,0,0,.08)"}`, background: dark ? "rgba(196,125,142,.06)" : "rgba(196,125,142,.03)" }}>
                    <div className="flex rounded-lg overflow-hidden" style={{ border: `1px solid ${t.cardBorder}` }}>
                      {[["credit", "Payment"], ["gift", "Gift"]].map(([val, label]) => (
                        <button key={val} onClick={() => setCreditType(val)} className="py-1.5 px-3 text-xs font-semibold border-none cursor-pointer font-[inherit] transition-all duration-200" style={{ background: creditType === val ? (val === "gift" ? (dark ? "rgba(251,191,36,.24)" : "rgba(217,119,6,.14)") : (dark ? "rgba(110,231,183,.24)" : "rgba(5,150,105,.14)")) : "transparent", color: creditType === val ? (val === "gift" ? (dark ? "#fbbf24" : "#d97706") : t.green) : t.textMuted }}>{label}</button>
                      ))}
                    </div>
                    <input type="number" aria-label="Credit amount" placeholder="Amount" value={creditAmt} onChange={e => setCreditAmt(e.target.value)} className="flex-1 min-w-[100px] py-2 px-3 rounded-lg text-[13px] outline-none font-[inherit]" style={{ background: dark ? "#0d1020" : "#fff", border: `1px solid ${t.cardBorder}`, color: t.text }} />
                    {[1000, 5000, 10000, 50000].map(p => (
                      <button key={p} onClick={() => setCreditAmt(String(p))} className="py-1.5 px-2.5 rounded-lg text-[11px] font-medium cursor-pointer font-[inherit] transition-all duration-200 max-sm:hidden" style={{ border: `1px solid ${Number(creditAmt) === p ? t.accent : t.cardBorder}`, background: Number(creditAmt) === p ? (dark ? "rgba(196,125,142,.14)" : "rgba(196,125,142,.06)") : "none", color: Number(creditAmt) === p ? t.accent : t.textMuted }}>{fN(p)}</button>
                    ))}
                    <button onClick={() => handleCredit(u)} disabled={!!actionLoading} className="py-[7px] px-4 rounded-lg border-none text-xs font-semibold cursor-pointer font-[inherit] transition-all duration-200 hover:-translate-y-px" style={{ background: "linear-gradient(135deg,#c47d8e,#8b5e6b)", color: "#fff", opacity: Number(creditAmt) > 0 && !actionLoading ? 1 : .4 }}>{creditType === "gift" ? "Gift" : "Credit"} {creditAmt ? fN(Number(creditAmt)) : ""}</button>
                    <button onClick={() => { setCreditId(null); setCreditType("credit"); }} className="p-1 border-none bg-transparent cursor-pointer" style={{ color: t.textMuted }}><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
                  </div>
                )}

                {/* Transactions panel */}
                {txUser?.id === u.id && (
                  <div style={{ borderBottom: `1px solid ${dark ? "rgba(255,255,255,.08)" : "rgba(0,0,0,.08)"}`, background: dark ? "rgba(255,255,255,.03)" : "rgba(0,0,0,.015)" }}>
                    <div className="flex justify-between items-center py-2.5 px-4" style={{ borderBottom: `1px solid ${dark ? "rgba(255,255,255,.08)" : "rgba(0,0,0,.08)"}` }}>
                      <div className="flex items-center gap-2">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={t.accent} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
                        <span className="text-[12px] font-semibold uppercase tracking-[0.5px]" style={{ color: t.accent }}>Transactions ({txList.length})</span>
                      </div>
                      <div className="flex gap-1.5">
                        {txList.length > 0 && <button onClick={() => downloadCSV(u)} className="py-1 px-2.5 rounded-lg text-[11px] font-semibold cursor-pointer font-[inherit] transition-all duration-200 hover:-translate-y-px" style={{ border: `1px solid ${t.cardBorder}`, background: "none", color: t.accent }}>↓ CSV</button>}
                        <button onClick={() => { setTxUser(null); setTxList([]); }} className="p-1 border-none bg-transparent cursor-pointer" style={{ color: t.textMuted }}><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
                      </div>
                    </div>
                    {txLoading ? (
                      <div className="p-4">{[1,2,3,4].map(i => <div key={i} className={`skel-bone ${dark ? "skel-dark" : "skel-light"}`} style={{ height: 36, borderRadius: 6, marginBottom: 6 }} />)}</div>
                    ) : txList.length > 0 ? (() => {
                      const txPerPg = 15;
                      const txTotalPages = Math.ceil(txList.length / txPerPg);
                      const txPaged = txList.slice((txPage - 1) * txPerPg, txPage * txPerPg);
                      return (
                        <>
                          {txPaged.map((tx, j) => (
                            <div key={tx.id} className="flex items-center gap-2.5 py-2.5 px-4 text-[13px] flex-wrap" style={{ borderBottom: j < txPaged.length - 1 ? `1px solid ${dark ? "rgba(255,255,255,.05)" : "rgba(0,0,0,.05)"}` : "none" }}>
                              <span className="w-[70px] text-[11px] shrink-0" style={{ color: t.textSoft }}>{fD(tx.createdAt, true)}</span>
                              <span className="w-[60px] text-[10px] py-[2px] px-1.5 rounded text-center shrink-0 uppercase font-semibold tracking-[0.3px]" style={{ background: tx.type === "deposit" ? (dark ? "rgba(110,231,183,.08)" : "rgba(5,150,105,.04)") : tx.type === "order" ? (dark ? "rgba(196,125,142,.08)" : "rgba(196,125,142,.04)") : tx.type === "referral" || tx.type === "bonus" ? (dark ? "rgba(96,165,250,.08)" : "rgba(96,165,250,.04)") : (dark ? "rgba(255,255,255,.04)" : "rgba(0,0,0,.02)"), color: tx.type === "deposit" ? (dark ? "#6ee7b7" : "#059669") : tx.type === "order" ? t.accent : tx.type === "referral" || tx.type === "bonus" ? "#60a5fa" : t.textMuted }}>{tx.type}</span>
                              <span className="w-20 text-right font-bold text-[13px] shrink-0" style={{ color: tx.type === "deposit" || tx.type === "referral" || tx.type === "bonus" || tx.type === "refund" ? (dark ? "#6ee7b7" : "#059669") : t.text }}>{tx.type === "order" ? "-" : "+"}{fN(tx.amount / 100)}</span>
                              <span className="text-[11px] font-medium" style={{ color: tx.status === "Completed" ? t.textMuted : tx.status === "Pending" ? "#e0a458" : (dark ? "#fca5a5" : "#dc2626") }}>{tx.status}</span>
                              <span className="flex-1 text-[11px] overflow-hidden text-ellipsis whitespace-nowrap" style={{ color: t.textSoft }}>{tx.note || tx.reference || ""}</span>
                            </div>
                          ))}
                          {txTotalPages > 1 && (
                            <div className="flex justify-between items-center py-2.5 px-4" style={{ borderTop: `1px solid ${dark ? "rgba(255,255,255,.08)" : "rgba(0,0,0,.08)"}` }}>
                              <span className="text-[11px]" style={{ color: t.textMuted }}>{txList.length} transactions · Page {txPage}/{txTotalPages}</span>
                              <div className="flex gap-1">
                                <button onClick={() => setTxPage(p => Math.max(1, p - 1))} disabled={txPage === 1} className="py-1 px-2.5 rounded-lg text-[11px] font-medium cursor-pointer font-[inherit]" style={{ border: `1px solid ${t.cardBorder}`, background: "none", color: t.textSoft, opacity: txPage === 1 ? .4 : 1 }}>←</button>
                                <button onClick={() => setTxPage(p => Math.min(txTotalPages, p + 1))} disabled={txPage >= txTotalPages} className="py-1 px-2.5 rounded-lg text-[11px] font-medium cursor-pointer font-[inherit]" style={{ border: `1px solid ${t.cardBorder}`, background: "none", color: t.textSoft, opacity: txPage >= txTotalPages ? .4 : 1 }}>→</button>
                              </div>
                            </div>
                          )}
                        </>
                      );
                    })() : (
                      <div className="py-5 px-4 text-center text-[13px]" style={{ color: t.textMuted }}>No transactions</div>
                    )}
                  </div>
                )}
              </div>
            );
          }) : (
            <div className="py-[60px] px-5 text-center">
              <svg width="48" height="48" viewBox="0 0 64 64" fill="none" style={{ display: "block", margin: "0 auto 14px", opacity: .7 }}>
                <circle cx="32" cy="22" r="10" stroke={t.accent} strokeWidth="1.5" opacity=".3" />
                <path d="M14 52c0-10 8-16 18-16s18 6 18 16" stroke={t.accent} strokeWidth="1.5" opacity=".2" strokeLinecap="round" />
              </svg>
              <div className="text-[15px] font-semibold mb-1" style={{ color: t.textSoft }}>No users found</div>
              <div className="text-[13px]" style={{ color: t.textMuted }}>{search ? "Try a different search term" : "Users will appear here once they sign up"}</div>
            </div>
          )}
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-between items-center mt-4">
          <span className="text-[12px]" style={{ color: t.textMuted }}>{filtered.length} users · Page {page} of {totalPages}</span>
          <div className="flex gap-1">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="py-1.5 px-3 rounded-lg text-[12px] font-medium cursor-pointer font-[inherit]" style={{ border: `1px solid ${t.cardBorder}`, background: "none", color: t.textSoft, opacity: page === 1 ? .4 : 1 }}>← Prev</button>
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages} className="py-1.5 px-3 rounded-lg text-[12px] font-medium cursor-pointer font-[inherit]" style={{ border: `1px solid ${t.cardBorder}`, background: "none", color: t.textSoft, opacity: page >= totalPages ? .4 : 1 }}>Next →</button>
          </div>
        </div>
      )}
    </>
  );
}
