'use client';
import { useState, useEffect, useRef } from "react";
import { fD } from "../lib/format";
import { useConfirm } from "./confirm-dialog";

function statusClr(s, dk) { return s === "Open" ? (dk ? "#fcd34d" : "#d97706") : s === "In Progress" ? (dk ? "#60a5fa" : "#2563eb") : (dk ? "#6ee7b7" : "#059669"); }
function statusBg(s, dk) { return s === "Open" ? (dk ? "rgba(234,179,8,0.1)" : "rgba(234,179,8,0.06)") : s === "In Progress" ? (dk ? "rgba(96,165,250,0.08)" : "rgba(37,99,235,0.06)") : (dk ? "rgba(110,231,183,0.08)" : "rgba(16,185,129,0.06)"); }

export default function AdminTicketsPage({ dark, t }) {
  const confirm = useConfirm();
  const [tickets, setTickets] = useState([]);
  const [selected, setSelected] = useState(null);
  const [filter, setFilter] = useState("all");
  const [reply, setReply] = useState("");
  const [mobileView, setMobileView] = useState("list");
  const [loading, setLoading] = useState(true);
  const msgsEnd = useRef(null);

  const refreshTickets = () => {
    fetch("/api/admin/tickets").then(r => r.json()).then(d => {
      if (d.tickets) {
        setTickets(d.tickets);
        if (selected) {
          const updated = d.tickets.find(tk => tk.id === selected.id);
          if (updated) setSelected(updated);
        }
      }
      setLoading(false);
    }).catch(() => setLoading(false));
  };

  useEffect(() => { refreshTickets(); }, []);

  // Poll every 10s
  useEffect(() => {
    const iv = setInterval(refreshTickets, 10000);
    const onVis = () => { if (!document.hidden) refreshTickets(); };
    document.addEventListener("visibilitychange", onVis);
    return () => { clearInterval(iv); document.removeEventListener("visibilitychange", onVis); };
  }, [selected?.id]);

  useEffect(() => { setTimeout(() => msgsEnd.current?.scrollIntoView({ behavior: "smooth" }), 50); }, [selected, tickets]);

  const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const isArchived = (tk) => tk.status === "Archived" || (tk.status === "Resolved" && tk.created && new Date(tk.created).getTime() < thirtyDaysAgo);
  const filtered = filter === "all" ? tickets.filter(tk => !isArchived(tk))
    : filter === "unread" ? tickets.filter(tk => { const last = tk.replies?.[tk.replies.length - 1]; return tk.status !== "Resolved" && tk.status !== "Archived" && ((!last) || last?.from === "user"); })
    : filter === "active" ? tickets.filter(tk => tk.status === "Open" || tk.status === "In Progress")
    : filter === "archived" ? tickets.filter(isArchived)
    : tickets.filter(tk => tk.status === filter);
  const openCount = tickets.filter(tk => tk.status === "Open" || tk.status === "In Progress").length;

  const doReply = async () => {
    if (!reply.trim() || !selected) return;
    try {
      const res = await fetch("/api/admin/tickets", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "reply", ticketId: selected.id, message: reply }) });
      if (res.ok) { setReply(""); refreshTickets(); }
    } catch {}
  };

  const doResolve = async () => {
    if (!selected) return;
    const ok = await confirm({ title: "Resolve Ticket", message: `Mark ticket ${selected.id} as resolved?`, confirmLabel: "Resolve" });
    if (!ok) return;
    try {
      await fetch("/api/admin/tickets", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "resolve", ticketId: selected.id }) });
      refreshTickets();
    } catch {}
  };

  const selectTicket = (tk) => { setSelected(tk); setReply(""); setMobileView("chat"); };

  if (loading) return <div style={{ padding: 24, color: t.textMuted }}>Loading tickets...</div>;

  return (
    <div className={`sup-split ${mobileView === "chat" ? "sup-view-chat" : "sup-view-list"}`} style={{ borderRadius: 12, border: `1px solid ${t.cardBorder}` }}>
      {/* ═══ LEFT: TICKET LIST ═══ */}
      <div className="sup-split-list" style={{ width: 280, borderRight: `1px solid ${t.cardBorder}`, flexShrink: 0, overflow: "hidden" }}>
        <div style={{ padding: "14px 16px", borderBottom: `1px solid ${t.cardBorder}` }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: t.text }}>Support inbox</div>
          <div style={{ fontSize: 11, color: t.textMuted, marginTop: 2 }}>{openCount} active</div>
        </div>
        <div className="sup-filter-bar" style={{ gap: 3, padding: "8px 10px", borderBottom: `1px solid ${t.cardBorder}` }}>
          {[["all", "All"], ["unread", "Unread"], ["active", "Active"], ["Resolved", "Done"], ["archived", "Archived"]].map(([v, l]) => (
            <button key={v} onClick={() => setFilter(v)} style={{ padding: "4px 10px", borderRadius: 5, fontSize: 10, fontWeight: filter === v ? 600 : 450, background: filter === v ? (dark ? "rgba(196,125,142,0.1)" : "rgba(196,125,142,0.06)") : "transparent", color: filter === v ? t.accent : t.textMuted, border: "none", cursor: "pointer", flexShrink: 0, whiteSpace: "nowrap" }}>{l}</button>
          ))}
        </div>
        <div style={{ flex: 1, overflowY: "auto" }}>
          {filtered.length === 0 && <div style={{ padding: 30, textAlign: "center", color: t.textMuted, fontSize: 12 }}>No tickets</div>}
          {filtered.map(tk => {
            const last = tk.replies?.[tk.replies.length - 1];
            const lastText = last ? `${last.from === "admin" ? `${last.name || "You"}` : (tk.user?.split(" ")[0] || "User")}: ${last.msg?.slice(0, 50)}` : tk.message?.slice(0, 50);
            const isSel = selected?.id === tk.id;
            const hasUnread = tk.status !== "Resolved" && tk.replies?.some(r => r.from === "user") && (tk.replies?.[tk.replies.length - 1]?.from === "user");
            return (
              <div key={tk.id} onClick={() => selectTicket(tk)} style={{ padding: "12px 14px", borderBottom: `1px solid ${t.cardBorder}`, cursor: "pointer", background: isSel ? (dark ? "rgba(196,125,142,0.04)" : "rgba(196,125,142,0.02)") : "transparent", borderLeft: isSel ? `2px solid ${t.accent}` : "2px solid transparent" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 3 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ fontSize: 13, fontWeight: 550, color: t.text }}>{tk.user}</span>
                    {hasUnread && <div style={{ width: 6, height: 6, borderRadius: 3, background: t.accent }} />}
                  </div>
                  <span style={{ fontSize: 10, color: t.textMuted }}>{tk.created ? fD(tk.created) : ""}</span>
                </div>
                <div style={{ fontSize: 12, color: dark ? "rgba(255,255,255,0.7)" : t.text, marginBottom: 4 }}>{tk.subject}</div>
                <div style={{ fontSize: 11, color: t.textMuted, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", marginBottom: 5 }}>{lastText}</div>
                <div style={{ display: "flex", gap: 5 }}>
                  <span style={{ fontSize: 10, fontWeight: 600, padding: "2px 7px", borderRadius: 4, background: statusBg(tk.status, dark), color: statusClr(tk.status, dark) }}>{tk.status.toLowerCase()}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ═══ CENTER: CONVERSATION ═══ */}
      <div className="sup-split-chat" style={{ minHeight: 0 }}>
        {selected ? <>
          <div style={{ padding: "14px 18px", borderBottom: `1px solid ${t.cardBorder}`, flexShrink: 0, display: "flex", alignItems: "center", gap: 10 }}>
            <button className="sup-mobile-back" onClick={() => { setMobileView("list"); }} style={{ background: "none", border: "none", color: t.textMuted, cursor: "pointer", padding: 4, display: "none" }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6"/></svg>
            </button>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 15, fontWeight: 550, color: t.text, display: "flex", alignItems: "center", gap: 8 }}>
                {selected.subject}
                <span style={{ fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 4, background: statusBg(selected.status, dark), color: statusClr(selected.status, dark) }}>{(selected.status || "").toLowerCase()}</span>
              </div>
              <div style={{ fontSize: 11, color: t.textMuted, marginTop: 3, fontFamily: "'JetBrains Mono', monospace" }}>{selected.id} · {selected.user} · {selected.email}</div>
            </div>
          </div>

          <div style={{ flex: 1, overflowY: "auto", minHeight: 0, padding: "16px 18px", display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ flex: 1 }} />
            {/* Original message */}
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
              <div style={{ maxWidth: "80%", padding: "10px 14px", borderRadius: 14, borderBottomLeftRadius: 4, background: dark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.03)", border: `1px solid ${t.cardBorder}` }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: dark ? "#60a5fa" : "#2563eb", marginBottom: 3 }}>{selected.user}</div>
                <div style={{ fontSize: 13, color: t.text, lineHeight: 1.55, whiteSpace: "pre-wrap" }}>{selected.message}</div>
              </div>
              <div style={{ fontSize: 10, color: t.textMuted, marginTop: 3, padding: "0 6px" }}>{selected.created ? fD(selected.created) : ""}</div>
            </div>
            {/* Replies */}
            {(selected.replies || []).map((r, i) => (
              <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: r.from === "admin" ? "flex-end" : "flex-start" }}>
                <div style={{
                  maxWidth: "80%", padding: "10px 14px", borderRadius: 14,
                  borderBottomRightRadius: r.from === "admin" ? 4 : 14,
                  borderBottomLeftRadius: r.from !== "admin" ? 4 : 14,
                  background: r.from === "admin" ? (dark ? "rgba(196,125,142,0.12)" : "rgba(196,125,142,0.06)") : (dark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.03)"),
                  border: r.from === "admin" ? `1px solid ${dark ? "rgba(196,125,142,0.1)" : "rgba(196,125,142,0.08)"}` : `1px solid ${t.cardBorder}`
                }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: r.from === "admin" ? t.accent : (dark ? "#60a5fa" : "#2563eb"), marginBottom: 3 }}>{r.from === "admin" ? "You" : (r.name || selected.user)}</div>
                  <div style={{ fontSize: 13, color: t.text, lineHeight: 1.55, whiteSpace: "pre-wrap" }}>{r.msg}</div>
                </div>
                <div style={{ fontSize: 10, color: t.textMuted, marginTop: 3, padding: "0 6px" }}>{r.time ? fD(r.time) : ""}</div>
              </div>
            ))}
            <div ref={msgsEnd} />
          </div>

          {selected.status !== "Resolved" ? (
            <div style={{ padding: "12px 16px", borderTop: `1px solid ${t.cardBorder}`, display: "flex", gap: 8, alignItems: "flex-end", flexShrink: 0 }}>
              <textarea value={reply} onChange={e => setReply(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); doReply(); } }} placeholder={`Reply to ${selected.user?.split(" ")[0]}...`} rows={1} style={{ flex: 1, padding: "10px 14px", borderRadius: 12, background: dark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.02)", border: `1px solid ${t.cardBorder}`, color: t.text, fontSize: 13, outline: "none", fontFamily: "inherit", resize: "none", lineHeight: 1.5, minHeight: 42, maxHeight: 100 }} />
              <button onClick={doReply} style={{ padding: "9px 18px", borderRadius: 10, background: reply.trim() ? `linear-gradient(135deg,${t.accent},#a3586b)` : (dark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.02)"), color: reply.trim() ? "#fff" : t.textMuted, fontSize: 12, fontWeight: 600, border: "none", cursor: reply.trim() ? "pointer" : "default", whiteSpace: "nowrap" }}>Send</button>
              <button onClick={doResolve} style={{ padding: "9px 14px", borderRadius: 10, background: "none", border: `1px solid ${dark ? "rgba(110,231,183,0.15)" : "rgba(16,185,129,0.12)"}`, color: dark ? "#6ee7b7" : "#059669", fontSize: 12, fontWeight: 500, cursor: "pointer", whiteSpace: "nowrap" }}>Resolve</button>
            </div>
          ) : (
            <div style={{ padding: "14px 18px", borderTop: `1px solid ${t.cardBorder}`, textAlign: "center", fontSize: 12, color: t.textMuted, flexShrink: 0, display: "flex", justifyContent: "center", gap: 12 }}>
              <span>Ticket resolved</span>
              <button onClick={async () => { await fetch("/api/admin/tickets", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "reopen", ticketId: selected.id }) }); refreshTickets(); }} style={{ background: "none", border: "none", color: t.accent, fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>Reopen</button>
              <button onClick={async () => { await fetch("/api/admin/tickets", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "archive", ticketId: selected.id }) }); refreshTickets(); setSelected(null); }} style={{ background: "none", border: "none", color: t.textMuted, fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>Archive</button>
            </div>
          )}
        </> : (
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: t.textMuted, fontSize: 13 }}>Select a conversation</div>
        )}
      </div>

      {/* ═══ RIGHT: CUSTOMER INFO ═══ */}
      {selected && (
        <div className="sup-info-panel" style={{ width: 220, borderLeft: `1px solid ${t.cardBorder}`, padding: "16px 14px", flexShrink: 0, overflowY: "auto" }}>
          <div style={{ marginBottom: 16 }}>
            <div style={{ width: 40, height: 40, borderRadius: "50%", background: dark ? "rgba(96,165,250,0.1)" : "rgba(37,99,235,0.06)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 8, border: `1px solid ${dark ? "rgba(96,165,250,0.12)" : "rgba(37,99,235,0.08)"}` }}>
              <span style={{ fontSize: 14, fontWeight: 600, color: dark ? "#60a5fa" : "#2563eb" }}>{selected.user?.split(" ").map(n => n[0]).join("") || "?"}</span>
            </div>
            <div style={{ fontSize: 14, fontWeight: 550, color: t.text }}>{selected.user}</div>
            <div style={{ fontSize: 12, color: t.textSoft, marginTop: 2 }}>{selected.email}</div>
          </div>

          <div style={{ height: 1, background: t.cardBorder, marginBottom: 14 }} />

          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: t.textMuted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Ticket</div>
            <div style={{ fontSize: 12, color: t.textSoft, marginBottom: 3 }}>ID: <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11 }}>{selected.id}</span></div>
            <div style={{ fontSize: 12, color: t.textSoft, marginBottom: 3 }}>Status: <span style={{ fontWeight: 600, color: statusClr(selected.status, dark) }}>{selected.status}</span></div>
            <div style={{ fontSize: 12, color: t.textSoft }}>Replies: {selected.replies?.length || 0}</div>
          </div>

          {selected.orderId && <>
            <div style={{ height: 1, background: t.cardBorder, marginBottom: 14 }} />
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: t.textMuted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Related order</div>
              <div style={{ padding: 10, borderRadius: 8, background: dark ? "rgba(255,255,255,0.02)" : "rgba(0,0,0,0.02)", border: `1px solid ${t.cardBorder}` }}>
                <div style={{ fontSize: 11, fontFamily: "'JetBrains Mono', monospace", color: t.accent }}>{selected.orderId}</div>
              </div>
            </div>
          </>}
        </div>
      )}
    </div>
  );
}
