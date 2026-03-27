'use client';
import { useState, useEffect } from "react";
import { useConfirm } from "./confirm-dialog";

const fN = (a) => `₦${Math.abs(a).toLocaleString("en-NG")}`;

export default function AdminUsersPage({ dark, t }) {
  const confirm = useConfirm();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [creditId, setCreditId] = useState(null);
  const [creditAmt, setCreditAmt] = useState("");
  const [page, setPage] = useState(1);
  const perPage = 15;

  useEffect(() => {
    fetch("/api/admin/users").then(r => r.json()).then(d => { setUsers(d.users || []); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  const filtered = users.filter(u => {
    if (filter === "active" && u.status !== "Active") return false;
    if (filter === "suspended" && u.status !== "Suspended") return false;
    if (search) { const q = search.toLowerCase(); return u.name?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q); }
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

  return (
    <>
      <div className="adm-header">
        <div className="adm-title" style={{ color: t.text }}>Users</div>
        <div className="adm-subtitle" style={{ color: t.textMuted }}>{users.length} registered users</div>
        <div className="page-divider" style={{ background: t.cardBorder }} />
      </div>

      <div className="adm-filters">
        {[["all", "All", users.length], ["active", "Active", users.filter(u => u.status === "Active").length], ["suspended", "Banned", users.filter(u => u.status === "Suspended").length]].map(([id, label, count]) => (
          <button key={id} onClick={() => { setFilter(id); setPage(1); }} className="adm-filter-pill" style={{ borderWidth: 1, borderStyle: "solid", borderColor: filter === id ? t.accent : t.cardBorder, background: filter === id ? (dark ? "#2a1a22" : "#fdf2f4") : "transparent", color: filter === id ? t.accent : t.textMuted }}>
            {label} <span className="m">({count})</span>
          </button>
        ))}
      </div>

      <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} placeholder="Search by name or email..." className="m adm-search" style={{ borderColor: t.cardBorder, background: dark ? "#0d1020" : "#fff", color: t.text }} />

      <div className="adm-card" style={{ background: dark ? "rgba(255,255,255,.06)" : "rgba(255,255,255,.95)", borderWidth: 1, borderStyle: "solid", borderColor: dark ? "rgba(255,255,255,.06)" : "rgba(0,0,0,.06)", boxShadow: dark ? "0 4px 20px rgba(0,0,0,.25)" : "0 4px 20px rgba(0,0,0,.04)" }}>
        {loading ? (
          <div className="adm-empty" style={{ color: t.textMuted }}>Loading users...</div>
        ) : paged.length > 0 ? paged.map((u, i) => (
          <div key={u.id}>
            <div className="adm-list-row adm-user-row" style={{ borderBottom: i < paged.length - 1 ? `1px solid ${t.cardBorder}` : "none", flexWrap: "wrap" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, minWidth: 180 }}>
                <div className="adm-user-avatar" style={{ background: `hsl(${(u.id?.charCodeAt(0) || i) * 45}, 40%, ${dark ? 30 : 65}%)` }}>{(u.name || "U")[0]}</div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 13, fontWeight: 500, color: t.text }}>{u.name}</span>
                    <span className="m" style={{ fontSize: 9, padding: "1px 6px", borderRadius: 4, fontWeight: 600, background: u.status === "Active" ? (dark ? "rgba(110,231,183,.1)" : "rgba(5,150,105,.06)") : (dark ? "rgba(252,165,165,.1)" : "rgba(220,38,38,.06)"), color: u.status === "Active" ? t.green : t.red }}>{u.status}</span>
                  </div>
                  <div style={{ fontSize: 11, color: t.textMuted, marginTop: 1 }}>{u.email}</div>
                </div>
              </div>
              <div className="adm-user-actions" style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ textAlign: "center" }}>
                  <div className="m" style={{ fontSize: 13, fontWeight: 600, color: t.green }}>{fN(u.balance || 0)}</div>
                  <div style={{ fontSize: 9, color: t.textMuted }}>Balance</div>
                </div>
                <div style={{ textAlign: "center" }}>
                  <div className="m" style={{ fontSize: 13, fontWeight: 600, color: t.text }}>{u.orders || 0}</div>
                  <div style={{ fontSize: 9, color: t.textMuted }}>Orders</div>
                </div>
                <div style={{ display: "flex", gap: 4 }}>
                  <button onClick={() => setCreditId(creditId === u.id ? null : u.id)} className="adm-btn-sm" style={{ borderColor: t.cardBorder, color: t.accent }}>Credit</button>
                  <button onClick={() => handleBan(u)} className="adm-btn-sm" style={{ borderColor: dark ? "rgba(252,165,165,.2)" : "rgba(220,38,38,.15)", color: u.status === "Active" ? t.red : t.green }}>{u.status === "Active" ? "Ban" : "Activate"}</button>
                </div>
              </div>
            </div>
            {creditId === u.id && (
              <div style={{ padding: "12px 16px", borderBottom: `1px solid ${t.cardBorder}`, background: dark ? "rgba(255,255,255,.02)" : "rgba(0,0,0,.01)", display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <input type="number" placeholder="Amount" value={creditAmt} onChange={e => setCreditAmt(e.target.value)} className="m" style={{ flex: 1, minWidth: 100, padding: "8px 12px", borderRadius: 8, background: dark ? "#0d1020" : "#fff", borderWidth: 1, borderStyle: "solid", borderColor: t.cardBorder, color: t.text, fontSize: 13, outline: "none" }} />
                {[1000, 5000, 10000, 50000].map(p => (
                  <button key={p} onClick={() => setCreditAmt(String(p))} className="m adm-btn-sm" style={{ borderColor: Number(creditAmt) === p ? t.accent : t.cardBorder, color: Number(creditAmt) === p ? t.accent : t.textMuted }}>{fN(p)}</button>
                ))}
                <button onClick={() => handleCredit(u)} className="adm-btn-primary" style={{ opacity: Number(creditAmt) > 0 ? 1 : .4 }}>Credit {creditAmt ? fN(Number(creditAmt)) : ""}</button>
                <button onClick={() => setCreditId(null)} style={{ color: t.textMuted, fontSize: 16, padding: 4, background: "none" }}>✕</button>
              </div>
            )}
          </div>
        )) : (
          <div className="adm-empty" style={{ color: t.textMuted }}>No users found</div>
        )}
      </div>

      {totalPages > 1 && (
        <div className="adm-pagination">
          <span style={{ fontSize: 11, color: t.textMuted }}>{filtered.length} users · Page {page} of {totalPages}</span>
          <div style={{ display: "flex", gap: 4 }}>
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="adm-btn-sm" style={{ borderColor: t.cardBorder, color: t.textSoft, opacity: page === 1 ? .5 : 1 }}>← Prev</button>
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages} className="adm-btn-sm" style={{ borderColor: t.cardBorder, color: t.textSoft, opacity: page >= totalPages ? .5 : 1 }}>Next →</button>
          </div>
        </div>
      )}
    </>
  );
}
