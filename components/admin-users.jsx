'use client';
import { useState, useEffect } from "react";
import { useConfirm } from "./confirm-dialog";
import { fN } from "../lib/format";


export default function AdminUsersPage({ dark, t }) {
  const confirm = useConfirm();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [creditId, setCreditId] = useState(null);
  const [creditAmt, setCreditAmt] = useState("");
  const [creditType, setCreditType] = useState("credit");
  const [txUser, setTxUser] = useState(null); // user whose transactions are shown
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
    if (filter === "verified" && (u.status !== "Active" || !u.verified)) return false;
    if (filter === "unverified" && (u.status !== "Active" || u.verified)) return false;
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

  return (
    <>
      <div className="adm-header">
        <div className="adm-title" style={{ color: t.text }}>Users</div>
        <div className="adm-subtitle" style={{ color: t.textMuted }}>{users.length} registered users</div>
        <div className="page-divider" style={{ background: t.cardBorder }} />
      </div>

      <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} placeholder="Search by name or email..." className="m adm-search" style={{ borderColor: t.cardBorder, background: dark ? "#0d1020" : "#fff", color: t.text }} />

      <div className="adm-filters flex justify-end">
        <select value={filter} onChange={e => { setFilter(e.target.value); setPage(1); }} className="py-[7px] pr-7 pl-2.5 rounded-lg text-[13px] font-medium appearance-none cursor-pointer font-[inherit]" style={{
          backgroundColor: dark ? "rgba(255,255,255,.04)" : "rgba(0,0,0,.03)",
          border: `1px solid ${dark ? "rgba(255,255,255,.08)" : "rgba(0,0,0,.08)"}`,
          color: dark ? "rgba(255,255,255,.7)" : "rgba(0,0,0,.7)",
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='10' height='6' viewBox='0 0 10 6' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1L5 5L9 1' stroke='${dark ? "%23666" : "%23999"}' stroke-width='1.5' stroke-linecap='round'/%3E%3C/svg%3E")`,
          backgroundRepeat: "no-repeat", backgroundPosition: "right 8px center",
        }}>
          {[["all", "All", users.length], ["verified", "Verified", users.filter(u => u.status === "Active" && u.verified).length], ["unverified", "Unverified", users.filter(u => u.status === "Active" && !u.verified).length], ["suspended", "Banned", users.filter(u => u.status === "Suspended").length], ["pending-deletion", "Pending Del.", users.filter(u => u.status === "PendingDeletion").length], ["deleted", "Deleted", users.filter(u => u.status === "Deleted").length]].map(([id, label, count]) => (
            <option key={id} value={id}>{label} ({count})</option>
          ))}
        </select>
      </div>

      <div className="adm-card" style={{ background: dark ? "rgba(255,255,255,.03)" : "rgba(255,255,255,.85)", border: `0.5px solid ${dark ? "rgba(255,255,255,.06)" : "rgba(0,0,0,.06)"}` }}>
        {loading ? (
          <div className="adm-empty">{[1,2,3,4,5].map(i => <div key={i} className={`skel-bone ${dark ? "skel-dark" : "skel-light"}`} style={{ height: 48, borderRadius: 6, marginBottom: 6 }} />)}</div>
        ) : paged.length > 0 ? paged.map((u, i) => (
          <div key={u.id}>
            <div className="adm-list-row adm-user-row" style={{ borderBottom: (i < paged.length - 1 && creditId !== u.id && txUser?.id !== u.id) ? `1px solid ${t.cardBorder}` : "none", flexWrap: "wrap" }}>
              <div className="flex items-center gap-2.5 flex-1 min-w-[180px]">
                <div className="adm-user-avatar" style={{ background: u.status === "Deleted" ? (dark ? "rgba(255,255,255,.06)" : "rgba(0,0,0,.06)") : `hsl(${(u.id?.charCodeAt(0) || i) * 45}, 40%, ${dark ? 30 : 65}%)` }}>{((u.deletedName || u.name || "U")[0])}</div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[15px] font-medium" style={{ color: u.status === "Deleted" || u.status === "PendingDeletion" ? t.textMuted : t.text }}>{u.status === "Deleted" || u.status === "PendingDeletion" ? (u.deletedName || u.name) : u.name}</span>
                    <span className="text-xs py-px px-1.5 rounded font-semibold" style={{ background: u.status === "Active" ? (u.verified ? (dark ? "rgba(110,231,183,.1)" : "rgba(5,150,105,.06)") : (dark ? "rgba(251,191,36,.1)" : "rgba(217,119,6,.06)")) : u.status === "PendingDeletion" ? (dark ? "rgba(249,115,22,.1)" : "rgba(249,115,22,.06)") : u.status === "Deleted" ? (dark ? "rgba(255,255,255,.06)" : "rgba(0,0,0,.04)") : (dark ? "rgba(252,165,165,.1)" : "rgba(220,38,38,.06)"), color: u.status === "Active" ? (u.verified ? t.green : (dark ? "#fbbf24" : "#d97706")) : u.status === "PendingDeletion" ? (dark ? "#fdba74" : "#ea580c") : u.status === "Deleted" ? t.textMuted : t.red }}>{u.status === "Active" ? (u.verified ? "Verified" : "Unverified") : u.status === "PendingDeletion" ? "Pending Deletion" : u.status}</span>
                  </div>
                  <div className="text-sm mt-px" style={{ color: t.textMuted }}>{u.status === "Deleted" || u.status === "PendingDeletion" ? (u.deletedEmail || u.email) : u.email}</div>
                  {u.status === "PendingDeletion" && u.deletedAt && <div className="text-xs mt-0.5" style={{ color: dark ? "#fdba74" : "#ea580c" }}>Deletes on {new Date(u.deletedAt).toLocaleDateString("en-NG", { month: "short", day: "numeric", year: "numeric" })}</div>}
                  {u.status === "Deleted" && u.deletedAt && <div className="text-xs mt-0.5" style={{ color: t.textSoft }}>Deleted {new Date(u.deletedAt).toLocaleDateString("en-NG", { month: "short", day: "numeric", year: "numeric" })}</div>}
                </div>
              </div>
              <div className="adm-user-actions flex items-center gap-3">
                <div className="text-center">
                  <div className="text-[15px] font-semibold" style={{ color: t.green }}>{fN(u.balance || 0)}</div>
                  <div className="text-xs" style={{ color: t.textMuted }}>Balance</div>
                </div>
                <div className="text-center">
                  <div className="text-[15px] font-semibold" style={{ color: t.text }}>{u.orders || 0}</div>
                  <div className="text-xs" style={{ color: t.textMuted }}>Orders</div>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => viewTransactions(u)} className="adm-btn-sm" style={{ borderColor: txUser?.id === u.id ? t.accent : t.cardBorder, color: txUser?.id === u.id ? t.accent : t.textSoft }}>Txns</button>
                  {u.status !== "Deleted" && <button onClick={() => setCreditId(creditId === u.id ? null : u.id)} className="adm-btn-sm" style={{ borderColor: t.cardBorder, color: t.accent }}>Credit</button>}
                  {u.status !== "Deleted" && <button onClick={() => handleBan(u)} className="adm-btn-sm" style={{ borderColor: u.status === "PendingDeletion" ? (dark ? "rgba(110,231,183,.2)" : "rgba(5,150,105,.15)") : (dark ? "rgba(252,165,165,.2)" : "rgba(220,38,38,.15)"), color: u.status === "PendingDeletion" ? t.green : (u.status === "Active" ? t.red : t.green) }}>{u.status === "PendingDeletion" ? "Reinstate" : (u.status === "Active" ? "Ban" : "Activate")}</button>}
                </div>
              </div>
            </div>
            {creditId === u.id && (
              <div className="py-3 px-4 flex gap-2 items-center flex-wrap" style={{ borderBottom: `1px solid ${t.cardBorder}`, background: dark ? "rgba(255,255,255,.02)" : "rgba(0,0,0,.01)" }}>
                <div className="flex rounded-lg overflow-hidden" style={{ border: `1px solid ${t.cardBorder}` }}>
                  {[["credit", "Payment"], ["gift", "Gift"]].map(([val, label]) => (
                    <button key={val} onClick={() => setCreditType(val)} className="py-1.5 px-3 text-xs font-semibold border-none cursor-pointer font-[inherit]" style={{ background: creditType === val ? (val === "gift" ? (dark ? "rgba(251,191,36,.15)" : "rgba(217,119,6,.08)") : (dark ? "rgba(110,231,183,.15)" : "rgba(5,150,105,.08)")) : "transparent", color: creditType === val ? (val === "gift" ? (dark ? "#fbbf24" : "#d97706") : t.green) : t.textMuted }}>{label}</button>
                  ))}
                </div>
                <input type="number" placeholder="Amount" value={creditAmt} onChange={e => setCreditAmt(e.target.value)} className="flex-1 min-w-[100px] py-2 px-3 rounded-lg border text-[15px] outline-none" style={{ background: dark ? "#0d1020" : "#fff", borderColor: t.cardBorder, color: t.text }} />
                {[1000, 5000, 10000, 50000].map(p => (
                  <button key={p} onClick={() => setCreditAmt(String(p))} className="m adm-btn-sm" style={{ borderColor: Number(creditAmt) === p ? t.accent : t.cardBorder, color: Number(creditAmt) === p ? t.accent : t.textMuted }}>{fN(p)}</button>
                ))}
                <button onClick={() => handleCredit(u)} disabled={!!actionLoading} className="adm-btn-primary" style={{ opacity: Number(creditAmt) > 0 && !actionLoading ? 1 : .4 }}>{creditType === "gift" ? "Gift" : "Credit"} {creditAmt ? fN(Number(creditAmt)) : ""}</button>
                <button onClick={() => { setCreditId(null); setCreditType("credit"); }} className="bg-none p-1 text-base" style={{ color: t.textMuted }}>✕</button>
              </div>
            )}
            {txUser?.id === u.id && (
              <div style={{ borderBottom: `1px solid ${t.cardBorder}`, background: dark ? "rgba(255,255,255,.02)" : "rgba(0,0,0,.01)" }}>
                <div className="flex justify-between items-center py-2.5 px-4" style={{ borderBottom: `1px solid ${dark ? "rgba(255,255,255,.04)" : "rgba(0,0,0,.04)"}` }}>
                  <span className="text-[13px] font-semibold" style={{ color: t.textMuted }}>Transactions ({txList.length})</span>
                  <div className="flex gap-1.5">
                    {txList.length > 0 && <button onClick={() => downloadCSV(u)} className="adm-btn-sm text-xs" style={{ borderColor: t.cardBorder, color: t.accent }}>↓ CSV</button>}
                    <button onClick={() => { setTxUser(null); setTxList([]); }} className="bg-none p-1 text-sm" style={{ color: t.textMuted }}>✕</button>
                  </div>
                </div>
                {txLoading ? (
                  <div className="p-4">{[1,2,3,4].map(i => <div key={i} className={`skel-bone ${dark ? "skel-dark" : "skel-light"} h-9 rounded-md mb-1.5`} />)}</div>
                ) : txList.length > 0 ? (() => {
                  const txPerPg = 15;
                  const txTotalPages = Math.ceil(txList.length / txPerPg);
                  const txPaged = txList.slice((txPage - 1) * txPerPg, txPage * txPerPg);
                  return (
                    <>
                      {txPaged.map((tx, j) => (
                        <div key={tx.id} className="flex items-center gap-2.5 py-2 px-4 text-[13px] flex-wrap" style={{ borderBottom: j < txPaged.length - 1 ? `1px solid ${dark ? "rgba(255,255,255,.03)" : "rgba(0,0,0,.03)"}` : "none" }}>
                          <span className="w-[70px] text-xs shrink-0" style={{ color: t.textSoft }}>{new Date(tx.createdAt).toLocaleDateString("en-NG", { month: "short", day: "numeric" })}</span>
                          <span className="w-[60px] text-[11px] py-px px-1.5 rounded text-center shrink-0" style={{ background: tx.type === "deposit" ? (dark ? "rgba(110,231,183,.08)" : "rgba(5,150,105,.04)") : tx.type === "order" ? (dark ? "rgba(196,125,142,.08)" : "rgba(196,125,142,.04)") : tx.type === "referral" || tx.type === "bonus" ? (dark ? "rgba(96,165,250,.08)" : "rgba(96,165,250,.04)") : (dark ? "rgba(255,255,255,.04)" : "rgba(0,0,0,.02)"), color: tx.type === "deposit" ? t.green : tx.type === "order" ? t.accent : tx.type === "referral" || tx.type === "bonus" ? "#60a5fa" : t.textMuted }}>{tx.type}</span>
                          <span className="w-20 text-right font-semibold shrink-0" style={{ color: tx.type === "deposit" || tx.type === "referral" || tx.type === "bonus" || tx.type === "refund" ? t.green : t.text }}>{tx.type === "order" ? "-" : "+"}{fN(tx.amount / 100)}</span>
                          <span className="text-xs" style={{ color: tx.status === "Completed" ? t.textMuted : tx.status === "Pending" ? "#e0a458" : t.red }}>{tx.status}</span>
                          <span className="flex-1 text-xs overflow-hidden text-ellipsis whitespace-nowrap" style={{ color: t.textSoft }}>{tx.note || tx.reference || ""}</span>
                        </div>
                      ))}
                      {txTotalPages > 1 && (
                        <div className="flex justify-between items-center py-2 px-4" style={{ borderTop: `1px solid ${dark ? "rgba(255,255,255,.04)" : "rgba(0,0,0,.04)"}` }}>
                          <span className="text-xs" style={{ color: t.textMuted }}>{txList.length} transactions · Page {txPage}/{txTotalPages}</span>
                          <div className="flex gap-1">
                            <button onClick={() => setTxPage(p => Math.max(1, p - 1))} disabled={txPage === 1} className="adm-btn-sm text-xs py-1 px-2.5" style={{ borderColor: t.cardBorder, color: t.textSoft, opacity: txPage === 1 ? .4 : 1 }}>←</button>
                            <button onClick={() => setTxPage(p => Math.min(txTotalPages, p + 1))} disabled={txPage >= txTotalPages} className="adm-btn-sm text-xs py-1 px-2.5" style={{ borderColor: t.cardBorder, color: t.textSoft, opacity: txPage >= txTotalPages ? .4 : 1 }}>→</button>
                          </div>
                        </div>
                      )}
                    </>
                  );
                })() : (
                  <div style={{ padding: 16, fontSize: 13, color: t.textMuted }}>No transactions</div>
                )}
              </div>
            )}
          </div>
        )) : (
          <div className="adm-empty" style={{ color: t.textMuted }}>No users found</div>
        )}
      </div>

      {totalPages > 1 && (
        <div className="adm-pagination">
          <span className="text-sm" style={{ color: t.textMuted }}>{filtered.length} users · Page {page} of {totalPages}</span>
          <div className="flex gap-1">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="adm-btn-sm" style={{ borderColor: t.cardBorder, color: t.textSoft, opacity: page === 1 ? .5 : 1 }}>← Prev</button>
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages} className="adm-btn-sm" style={{ borderColor: t.cardBorder, color: t.textSoft, opacity: page >= totalPages ? .5 : 1 }}>Next →</button>
          </div>
        </div>
      )}
    </>
  );
}
