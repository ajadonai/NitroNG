'use client';
import { useState, useEffect } from "react";
import { fD } from "../lib/format";


export default function AdminTicketsPage({ dark, t }) {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [selected, setSelected] = useState(null);
  const [reply, setReply] = useState("");

  useEffect(() => {
    fetch("/api/admin/tickets").then(r => r.json()).then(d => { setTickets(d.tickets || []); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  const filtered = tickets.filter(tk => filter === "all" || tk.status === filter);

  const doReply = async () => {
    if (!reply.trim() || !selected) return;
    try {
      const res = await fetch("/api/admin/tickets", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "reply", ticketId: selected.id, message: reply }) });
      if (res.ok) { setReply(""); }
    } catch {}
  };

  const doResolve = async () => {
    if (!selected) return;
    try {
      await fetch("/api/admin/tickets", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "resolve", ticketId: selected.id }) });
      setTickets(prev => prev.map(tk => tk.id === selected.id ? { ...tk, status: "Resolved" } : tk));
      setSelected({ ...selected, status: "Resolved" });
    } catch {}
  };

  return (
    <>
      <div className="adm-header">
        <div className="adm-title" style={{ color: t.text }}>Support</div>
        <div className="adm-subtitle" style={{ color: t.textMuted }}>{tickets.filter(tk => tk.status === "Open").length} open support tickets</div>
        <div className="page-divider" style={{ background: t.cardBorder }} />
      </div>

      <div className="adm-filters">
        {["all", "Open", "In Progress", "Resolved"].map(f => (
          <button key={f} onClick={() => setFilter(f)} className="adm-filter-pill" style={{ borderWidth: 1, borderStyle: "solid", borderColor: filter === f ? t.accent : t.cardBorder, background: filter === f ? (dark ? "#2a1a22" : "#fdf2f4") : "transparent", color: filter === f ? t.accent : t.textMuted }}>
            {f === "all" ? "All" : f} <span className="m">({f === "all" ? tickets.length : tickets.filter(tk => tk.status === f).length})</span>
          </button>
        ))}
      </div>

      <div className="adm-split">
        {/* Ticket list */}
        <div className="adm-split-list">
          <div className="adm-card" style={{ background: dark ? "rgba(255,255,255,.06)" : "rgba(255,255,255,.95)", borderWidth: 1, borderStyle: "solid", borderColor: dark ? "rgba(255,255,255,.06)" : "rgba(0,0,0,.06)", boxShadow: dark ? "0 4px 20px rgba(0,0,0,.25)" : "0 4px 20px rgba(0,0,0,.04)" }}>
            {loading ? (
              <div className="adm-empty" style={{ color: t.textMuted }}>Loading tickets...</div>
            ) : filtered.length > 0 ? filtered.map((tk, i) => (
              <button key={tk.id} onClick={() => setSelected(tk)} className="adm-ticket-row" style={{ borderBottom: i < filtered.length - 1 ? `1px solid ${t.cardBorder}` : "none", background: selected?.id === tk.id ? (dark ? "rgba(196,125,142,.06)" : "rgba(196,125,142,.03)") : "transparent", width: "100%", textAlign: "left", display: "block", padding: "14px 16px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                  <span className="m" style={{ fontSize: 13, color: t.accent }}>{tk.id}</span>
                  <span className="m" style={{ fontSize: 11, padding: "2px 7px", borderRadius: 4, fontWeight: 600, background: tk.status === "Open" ? (dark ? "rgba(252,211,77,.1)" : "rgba(217,119,6,.06)") : tk.status === "Resolved" ? (dark ? "rgba(110,231,183,.1)" : "rgba(5,150,105,.06)") : (dark ? "rgba(165,180,252,.1)" : "rgba(79,70,229,.06)"), color: tk.status === "Open" ? t.amber : tk.status === "Resolved" ? t.green : t.blue }}>{tk.status}</span>
                </div>
                <div style={{ fontSize: 14, fontWeight: 500, color: t.text }}>{tk.subject}</div>
                <div style={{ fontSize: 13, color: t.textMuted, marginTop: 2 }}>{tk.user} · {tk.created ? fD(tk.created) : ""}</div>
              </button>
            )) : (
              <div className="adm-empty" style={{ color: t.textMuted }}>No tickets found</div>
            )}
          </div>
        </div>

        {/* Ticket detail */}
        <div className="adm-split-detail">
          <div className="adm-card" style={{ background: dark ? "rgba(255,255,255,.06)" : "rgba(255,255,255,.95)", borderWidth: 1, borderStyle: "solid", borderColor: dark ? "rgba(255,255,255,.06)" : "rgba(0,0,0,.06)", boxShadow: dark ? "0 4px 20px rgba(0,0,0,.25)" : "0 4px 20px rgba(0,0,0,.04)", padding: 18 }}>
            {selected ? (
              <>
                <div style={{ fontSize: 16, fontWeight: 600, color: t.text, marginBottom: 4 }}>{selected.subject}</div>
                <div style={{ fontSize: 13, color: t.textMuted, marginBottom: 16 }}>From: {selected.user} ({selected.email}) · {selected.created ? fD(selected.created) : ""}</div>

                {/* Messages */}
                <div style={{ padding: 14, borderRadius: 10, background: dark ? "#0d1020" : "#faf8f5", borderWidth: 1, borderStyle: "solid", borderColor: t.cardBorder, marginBottom: 14 }}>
                  <div style={{ fontSize: 14, color: t.text, lineHeight: 1.6 }}>{selected.message || "No message content"}</div>
                </div>

                {(selected.replies || []).map((r, i) => (
                  <div key={i} style={{ padding: 12, borderRadius: 10, background: r.from === "admin" ? (dark ? "rgba(196,125,142,.06)" : "rgba(196,125,142,.03)") : (dark ? "rgba(96,165,250,.06)" : "rgba(37,99,235,.03)"), borderWidth: 1, borderStyle: "solid", borderColor: r.from === "admin" ? (dark ? "rgba(196,125,142,.1)" : "rgba(196,125,142,.06)") : (dark ? "rgba(96,165,250,.1)" : "rgba(37,99,235,.06)"), marginBottom: 8 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: r.from === "admin" ? t.accent : (dark ? "#60a5fa" : "#2563eb"), marginBottom: 3 }}>{r.from === "admin" ? "Admin" : selected.user || "User"} · {r.time ? fD(r.time) : ""}</div>
                    <div style={{ fontSize: 14, color: t.text, lineHeight: 1.5 }}>{r.msg || r.message}</div>
                  </div>
                ))}

                {selected.status !== "Resolved" && (
                  <>
                    <textarea value={reply} onChange={e => setReply(e.target.value)} placeholder="Write a reply..." rows={3} style={{ width: "100%", padding: "10px 14px", borderRadius: 10, borderWidth: 1, borderStyle: "solid", borderColor: t.cardBorder, background: dark ? "#0d1020" : "#fff", color: t.text, fontSize: 14, outline: "none", resize: "vertical", marginTop: 8, marginBottom: 8, fontFamily: "inherit", lineHeight: 1.5, boxSizing: "border-box" }} />
                    <div style={{ display: "flex", gap: 8 }}>
                      <button onClick={doReply} className="adm-btn-primary" style={{ opacity: reply.trim() ? 1 : .4 }}>Send Reply</button>
                      <button onClick={doResolve} className="adm-btn-sm" style={{ borderColor: t.cardBorder, color: t.green }}>Resolve</button>
                    </div>
                  </>
                )}
              </>
            ) : (
              <div style={{ textAlign: "center", padding: "50px 0", color: t.textMuted, fontSize: 13 }}>Select a ticket to view details</div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
