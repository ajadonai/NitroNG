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
  const [txUser, setTxUser] = useState(null); // user whose transactions are shown
  const [txList, setTxList] = useState([]);
  const [txLoading, setTxLoading] = useState(false);
  const [page, setPage] = useState(1);
  const perPage = 15;

  useEffect(() => {
    fetch("/api/admin/users").then(r => r.json()).then(d => { setUsers(d.users || []); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  const filtered = users.filter(u => {
    if (filter === "active" && u.status !== "Active") return false;
    if (filter === "suspended" && u.status !== "Suspended") return false;
    if (filter === "deleted" && u.status !== "Deleted") return false;
    if (search) { const q = search.toLowerCase(); const name = (u.deletedName || u.name || "").toLowerCase(); const email = (u.deletedEmail || u.email || "").toLowerCase(); return name.includes(q) || email.includes(q); }
    return true;
  });

  const totalPages = Math.ceil(filtered.length / perPage);
  const paged = filtered.slice((page - 1) * perPage, page * perPage);

  const doAction = async (userId, action, amount) => {
    try {
      const res = await fetch("/api/admin/users", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, userId, amount: Number(amount) || 0 }) });
      const data = await res.json();
      if (res.ok) {
        if (action === "credit") { setUsers(prev => prev.map(u => u.id === userId ? { ...u, balance: (u.balance || 0) + (Number(amount) || 0) } : u)); setCreditId(null); setCreditAmt(""); }
        if (action === "suspend" || action === "activate") { setUsers(prev => prev.map(u => u.id === userId ? { ...u, status: action === "suspend" ? "Suspended" : "Active" } : u)); }
      }
    } catch {}
  };

  const handleBan = async (user) => {
    const ok = await confirm({ title: user.status === "Active" ? "Ban User" : "Activate User", message: user.status === "Active" ? `Are you sure you want to ban ${user.name} (${user.email})? They will lose access to their account.` : `Reactivate ${user.name}'s account?`, confirmLabel: user.status === "Active" ? "Ban User" : "Activate", danger: user.status === "Active" });
    if (ok) doAction(user.id, user.status === "Active" ? "suspend" : "activate");
  };

  const handleCredit = async (user) => {
    if (Number(creditAmt) <= 0) return;
    const ok = await confirm({ title: "Credit Wallet", message: `Credit ${fN(Number(creditAmt))} to ${user.name}'s wallet?`, confirmLabel: `Credit ${fN(Number(creditAmt))}` });
    if (ok) doAction(user.id, "credit", creditAmt);
  };

  const viewTransactions = async (user) => {
    if (txUser?.id === user.id) { setTxUser(null); setTxList([]); return; }
    setTxUser(user); setTxLoading(true); setTxList([]);
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

      <div className="adm-filters">
        {[["all", "All", users.length], ["active", "Active", users.filter(u => u.status === "Active").length], ["suspended", "Banned", users.filter(u => u.status === "Suspended").length], ["deleted", "Deleted", users.filter(u => u.status === "Deleted").length]].map(([id, label, count]) => (
          <button key={id} onClick={() => { setFilter(id); setPage(1); }} className="adm-filter-pill" style={{ borderWidth: 1, borderStyle: "solid", borderColor: filter === id ? t.accent : t.cardBorder, background: filter === id ? (dark ? "#2a1a22" : "#fdf2f4") : "transparent", color: filter === id ? t.accent : t.textMuted }}>
            {label} <span className="m">({count})</span>
          </button>
        ))}
      </div>

      <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} placeholder="Search by name or email..." className="m adm-search" style={{ borderColor: t.cardBorder, background: dark ? "#0d1020" : "#fff", color: t.text }} />

      <div className="adm-card" style={{ background: dark ? "rgba(255,255,255,.03)" : "rgba(255,255,255,.85)", border: `0.5px solid ${dark ? "rgba(255,255,255,.06)" : "rgba(0,0,0,.06)"}` }}>
        {loading ? (
          <div className="adm-empty" style={{ color: t.textMuted }}>Loading users...</div>
        ) : paged.length > 0 ? paged.map((u, i) => (
          <div key={u.id}>
            <div className="adm-list-row adm-user-row" style={{ borderBottom: (i < paged.length - 1 && creditId !== u.id && txUser?.id !== u.id) ? `1px solid ${t.cardBorder}` : "none", flexWrap: "wrap" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, minWidth: 180 }}>
                <div className="adm-user-avatar" style={{ background: u.status === "Deleted" ? (dark ? "rgba(255,255,255,.06)" : "rgba(0,0,0,.06)") : `hsl(${(u.id?.charCodeAt(0) || i) * 45}, 40%, ${dark ? 30 : 65}%)` }}>{((u.deletedName || u.name || "U")[0])}</div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 15, fontWeight: 500, color: u.status === "Deleted" ? t.textMuted : t.text }}>{u.status === "Deleted" ? (u.deletedName || "Deleted User") : u.name}</span>
                    <span className="m" style={{ fontSize: 12, padding: "1px 6px", borderRadius: 4, fontWeight: 600, background: u.status === "Active" ? (dark ? "rgba(110,231,183,.1)" : "rgba(5,150,105,.06)") : u.status === "Deleted" ? (dark ? "rgba(255,255,255,.06)" : "rgba(0,0,0,.04)") : (dark ? "rgba(252,165,165,.1)" : "rgba(220,38,38,.06)"), color: u.status === "Active" ? t.green : u.status === "Deleted" ? t.textMuted : t.red }}>{u.status}</span>
                  </div>
                  <div style={{ fontSize: 14, color: t.textMuted, marginTop: 1 }}>{u.status === "Deleted" ? (u.deletedEmail || u.email) : u.email}</div>
                  {u.status === "Deleted" && u.deletedAt && <div style={{ fontSize: 12, color: t.textSoft, marginTop: 2 }}>Deleted {new Date(u.deletedAt).toLocaleDateString("en-NG", { month: "short", day: "numeric", year: "numeric" })}</div>}
                </div>
              </div>
              <div className="adm-user-actions" style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ textAlign: "center" }}>
                  <div className="m" style={{ fontSize: 15, fontWeight: 600, color: t.green }}>{fN(u.balance || 0)}</div>
                  <div style={{ fontSize: 12, color: t.textMuted }}>Balance</div>
                </div>
                <div style={{ textAlign: "center" }}>
                  <div className="m" style={{ fontSize: 15, fontWeight: 600, color: t.text }}>{u.orders || 0}</div>
                  <div style={{ fontSize: 12, color: t.textMuted }}>Orders</div>
                </div>
                <div style={{ display: "flex", gap: 4 }}>
                  <button onClick={() => viewTransactions(u)} className="adm-btn-sm" style={{ borderColor: txUser?.id === u.id ? t.accent : t.cardBorder, color: txUser?.id === u.id ? t.accent : t.textSoft }}>Txns</button>
                  {u.status !== "Deleted" && <button onClick={() => setCreditId(creditId === u.id ? null : u.id)} className="adm-btn-sm" style={{ borderColor: t.cardBorder, color: t.accent }}>Credit</button>}
                  {u.status !== "Deleted" && <button onClick={() => handleBan(u)} className="adm-btn-sm" style={{ borderColor: dark ? "rgba(252,165,165,.2)" : "rgba(220,38,38,.15)", color: u.status === "Active" ? t.red : t.green }}>{u.status === "Active" ? "Ban" : "Activate"}</button>}
                </div>
              </div>
            </div>
            {creditId === u.id && (
              <div style={{ padding: "12px 16px", borderBottom: `1px solid ${t.cardBorder}`, background: dark ? "rgba(255,255,255,.02)" : "rgba(0,0,0,.01)", display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <input type="number" placeholder="Amount" value={creditAmt} onChange={e => setCreditAmt(e.target.value)} className="m" style={{ flex: 1, minWidth: 100, padding: "8px 12px", borderRadius: 8, background: dark ? "#0d1020" : "#fff", borderWidth: 1, borderStyle: "solid", borderColor: t.cardBorder, color: t.text, fontSize: 15, outline: "none" }} />
                {[1000, 5000, 10000, 50000].map(p => (
                  <button key={p} onClick={() => setCreditAmt(String(p))} className="m adm-btn-sm" style={{ borderColor: Number(creditAmt) === p ? t.accent : t.cardBorder, color: Number(creditAmt) === p ? t.accent : t.textMuted }}>{fN(p)}</button>
                ))}
                <button onClick={() => handleCredit(u)} className="adm-btn-primary" style={{ opacity: Number(creditAmt) > 0 ? 1 : .4 }}>Credit {creditAmt ? fN(Number(creditAmt)) : ""}</button>
                <button onClick={() => setCreditId(null)} style={{ color: t.textMuted, fontSize: 16, padding: 4, background: "none" }}>✕</button>
              </div>
            )}
            {txUser?.id === u.id && (
              <div style={{ borderBottom: `1px solid ${t.cardBorder}`, background: dark ? "rgba(255,255,255,.02)" : "rgba(0,0,0,.01)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 16px", borderBottom: `1px solid ${dark ? "rgba(255,255,255,.04)" : "rgba(0,0,0,.04)"}` }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: t.textMuted }}>Transactions ({txList.length})</span>
                  <div style={{ display: "flex", gap: 6 }}>
                    {txList.length > 0 && <button onClick={() => downloadCSV(u)} className="adm-btn-sm" style={{ borderColor: t.cardBorder, color: t.accent, fontSize: 12 }}>↓ CSV</button>}
                    <button onClick={() => { setTxUser(null); setTxList([]); }} style={{ color: t.textMuted, fontSize: 14, padding: 4, background: "none" }}>✕</button>
                  </div>
                </div>
                {txLoading ? (
                  <div style={{ padding: 16, fontSize: 13, color: t.textMuted }}>Loading...</div>
                ) : txList.length > 0 ? txList.slice(0, 50).map((tx, j) => (
                  <div key={tx.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 16px", borderBottom: j < Math.min(txList.length, 50) - 1 ? `1px solid ${dark ? "rgba(255,255,255,.03)" : "rgba(0,0,0,.03)"}` : "none", fontSize: 13, flexWrap: "wrap" }}>
                    <span style={{ width: 70, color: t.textSoft, fontSize: 12, flexShrink: 0 }}>{new Date(tx.createdAt).toLocaleDateString("en-NG", { month: "short", day: "numeric" })}</span>
                    <span className="m" style={{ width: 60, fontSize: 11, padding: "1px 6px", borderRadius: 4, textAlign: "center", flexShrink: 0, background: tx.type === "deposit" ? (dark ? "rgba(110,231,183,.08)" : "rgba(5,150,105,.04)") : tx.type === "order" ? (dark ? "rgba(196,125,142,.08)" : "rgba(196,125,142,.04)") : tx.type === "referral" || tx.type === "bonus" ? (dark ? "rgba(96,165,250,.08)" : "rgba(96,165,250,.04)") : (dark ? "rgba(255,255,255,.04)" : "rgba(0,0,0,.02)"), color: tx.type === "deposit" ? t.green : tx.type === "order" ? t.accent : tx.type === "referral" || tx.type === "bonus" ? "#60a5fa" : t.textMuted }}>{tx.type}</span>
                    <span className="m" style={{ width: 80, textAlign: "right", fontWeight: 600, flexShrink: 0, color: tx.type === "deposit" || tx.type === "referral" || tx.type === "bonus" || tx.type === "refund" ? t.green : t.text }}>{tx.type === "order" ? "-" : "+"}{fN(tx.amount / 100)}</span>
                    <span style={{ fontSize: 12, color: tx.status === "Completed" ? t.textMuted : tx.status === "Pending" ? "#e0a458" : t.red }}>{tx.status}</span>
                    <span style={{ flex: 1, fontSize: 12, color: t.textSoft, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{tx.note || tx.reference || ""}</span>
                  </div>
                )) : (
                  <div style={{ padding: 16, fontSize: 13, color: t.textMuted }}>No transactions</div>
                )}
                {txList.length > 50 && <div style={{ padding: "8px 16px", fontSize: 12, color: t.textMuted }}>Showing first 50 of {txList.length}. Download CSV for full history.</div>}
              </div>
            )}
          </div>
        )) : (
          <div className="adm-empty" style={{ color: t.textMuted }}>No users found</div>
        )}
      </div>

      {totalPages > 1 && (
        <div className="adm-pagination">
          <span style={{ fontSize: 14, color: t.textMuted }}>{filtered.length} users · Page {page} of {totalPages}</span>
          <div style={{ display: "flex", gap: 4 }}>
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="adm-btn-sm" style={{ borderColor: t.cardBorder, color: t.textSoft, opacity: page === 1 ? .5 : 1 }}>← Prev</button>
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages} className="adm-btn-sm" style={{ borderColor: t.cardBorder, color: t.textSoft, opacity: page >= totalPages ? .5 : 1 }}>Next →</button>
          </div>
        </div>
      )}
    </>
  );
}
