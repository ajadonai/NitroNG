'use client';
import { useState, useEffect, useRef } from "react";
import { fD } from "../lib/format";
import { useConfirm } from "./confirm-dialog";

function statusClr(s, dk) { return s === "Open" ? (dk ? "#fcd34d" : "#d97706") : s === "In Progress" ? (dk ? "#60a5fa" : "#2563eb") : (dk ? "#6ee7b7" : "#059669"); }
function statusBg(s, dk) { return s === "Open" ? (dk ? "rgba(234,179,8,0.1)" : "rgba(234,179,8,0.06)") : s === "In Progress" ? (dk ? "rgba(96,165,250,0.08)" : "rgba(37,99,235,0.06)") : (dk ? "rgba(110,231,183,0.08)" : "rgba(16,185,129,0.06)"); }

export default function AdminTicketsPage({ dark, t, adminName }) {
  const confirm = useConfirm();
  const [tickets, setTickets] = useState([]);
  const [selected, setSelected] = useState(null);
  const [filter, setFilter] = useState("all");
  const [reply, setReply] = useState("");
  const [mobileView, setMobileView] = useState("list");
  const [showInfo, setShowInfo] = useState(false);
  const [loading, setLoading] = useState(true);
  const msgsEnd = useRef(null);
  const sendingRef = useRef(false);

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
    if (!reply.trim() || !selected || sendingRef.current) return;
    sendingRef.current = true;
    try {
      const res = await fetch("/api/admin/tickets", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "reply", ticketId: selected.id, message: reply }) });
      if (res.ok) { setReply(""); refreshTickets(); }
    } catch {} finally { sendingRef.current = false; }
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

  const selectTicket = (tk) => {
    // Unlock previous ticket
    if (selected?.id) fetch("/api/admin/tickets", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "unlock", ticketId: selected.id }) }).catch(() => {});
    setSelected(tk); setReply(""); setMobileView("chat");
    // Lock new ticket
    fetch("/api/admin/tickets", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "lock", ticketId: tk.id }) }).catch(() => {});
  };

  // Heartbeat — refresh lock every 2 min while viewing
  useEffect(() => {
    if (!selected?.id) return;
    const iv = setInterval(() => {
      fetch("/api/admin/tickets", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "heartbeat", ticketId: selected.id }) }).catch(() => {});
    }, 120000); // 2 min
    return () => clearInterval(iv);
  }, [selected?.id]);

  // Unlock on unmount
  useEffect(() => {
    return () => {
      if (selected?.id) fetch("/api/admin/tickets", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "unlock", ticketId: selected.id }) }).catch(() => {});
    };
  }, []);

  if (loading) return <div className="p-6">{[1,2,3,4].map(i => <div key={i} className={`skel-bone ${dark ? "skel-dark" : "skel-light"} h-[52px] rounded-lg mb-2`} />)}</div>;

  return (
    <div className={`sup-split ${mobileView === "chat" ? "sup-view-chat" : "sup-view-list"} rounded-xl`} style={{ border: `1px solid ${t.cardBorder}` }}>
      {/* ═══ LEFT: TICKET LIST ═══ */}
      <div className="sup-split-list w-[280px] shrink-0 overflow-hidden" style={{ borderRight: `1px solid ${t.cardBorder}` }}>
        <div className="py-3.5 px-4" style={{ borderBottom: `1px solid ${t.cardBorder}` }}>
          <div className="text-[15px] font-semibold" style={{ color: t.text }}>Support inbox</div>
          <div className="text-xs mt-0.5" style={{ color: t.textMuted }}>{openCount} active</div>
        </div>
        <div className="sup-filter-bar gap-[3px] py-2 px-2.5" style={{ borderBottom: `1px solid ${t.cardBorder}` }}>
          {[["all", "All"], ["unread", "Unread"], ["active", "Active"], ["Resolved", "Done"], ["archived", "Archived"]].map(([v, l]) => (
            <button key={v} onClick={() => setFilter(v)} className="py-1 px-2.5 rounded-[5px] text-[11px] border-none cursor-pointer shrink-0 whitespace-nowrap" style={{ fontWeight: filter === v ? 600 : 450, background: filter === v ? (dark ? "rgba(196,125,142,0.1)" : "rgba(196,125,142,0.06)") : "transparent", color: filter === v ? t.accent : t.textMuted }}>{l}</button>
          ))}
        </div>
        <div className="flex-1 overflow-y-auto">
          {filtered.length === 0 && <div className="p-[30px] text-center text-xs" style={{ color: t.textMuted }}>No tickets</div>}
          {filtered.map(tk => {
            const last = tk.replies?.[tk.replies.length - 1];
            const lastText = last ? `${last.from === "admin" ? `${last.name || "You"}` : (tk.user?.split(" ")[0] || "User")}: ${last.msg?.slice(0, 50)}` : tk.message?.slice(0, 50);
            const isSel = selected?.id === tk.id;
            const hasUnread = tk.status !== "Resolved" && tk.replies?.some(r => r.from === "user") && (tk.replies?.[tk.replies.length - 1]?.from === "user");
            return (
              <div key={tk.id} role="button" tabIndex={0} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();e.currentTarget.click()}}} onClick={() => selectTicket(tk)} className="py-3 px-3.5 cursor-pointer" style={{ borderBottom: `1px solid ${t.cardBorder}`, background: isSel ? (dark ? "rgba(196,125,142,0.04)" : "rgba(196,125,142,0.02)") : "transparent", borderLeft: isSel ? `2px solid ${t.accent}` : "2px solid transparent" }}>
                <div className="flex justify-between items-center mb-[3px]">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-medium" style={{ color: t.text }}>{tk.user}</span>
                    {hasUnread && <div className="w-1.5 h-1.5 rounded-full" style={{ background: t.accent }} />}
                  </div>
                  <span className="text-[11px]" style={{ color: t.textMuted }}>{tk.created ? fD(tk.created) : ""}</span>
                </div>
                <div className="text-[13px] mb-1" style={{ color: dark ? "rgba(255,255,255,0.7)" : t.text }}>{tk.subject}</div>
                <div className="text-xs whitespace-nowrap overflow-hidden text-ellipsis mb-[5px]" style={{ color: t.textMuted }}>{lastText}</div>
                <div className="flex gap-[5px] items-center">
                  <span className="text-[11px] font-semibold py-px px-[7px] rounded" style={{ background: statusBg(tk.status, dark), color: statusClr(tk.status, dark) }}>{(tk.status || "").toLowerCase()}</span>
                  {tk.lockedBy && <span className="text-[10px]" style={{ color: dark ? "#fcd34d" : "#d97706" }}>🔒 {tk.lockedBy}</span>}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ═══ CENTER: CONVERSATION ═══ */}
      <div className="sup-split-chat min-h-0">
        {selected ? <>
          <div className="shrink-0" style={{ borderBottom: `1px solid ${t.cardBorder}` }}>
            <div className="py-3.5 px-[18px] flex items-center gap-2.5">
              <button className="sup-mobile-back p-1 border-none cursor-pointer" onClick={() => { setMobileView("list"); setShowInfo(false); }} style={{ background: "none", color: t.textMuted, display: "none" }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6"/></svg>
              </button>
              <div className="flex-1 min-w-0">
                <div className="text-base font-medium flex items-center gap-2 flex-wrap" style={{ color: t.text }}>
                  {selected.subject}
                  <span className="text-[11px] font-semibold py-px px-2 rounded" style={{ background: statusBg(selected.status, dark), color: statusClr(selected.status, dark) }}>{(selected.status || "").toLowerCase()}</span>
                </div>
                <div className="text-xs mt-[3px] overflow-hidden text-ellipsis whitespace-nowrap" style={{ color: t.textMuted, fontFamily: "'JetBrains Mono', monospace" }}>{selected.id} · {selected.user}</div>
              </div>
              <button className="sup-info-toggle rounded-lg py-1.5 px-2 cursor-pointer shrink-0" onClick={() => setShowInfo(!showInfo)} style={{ background: showInfo ? (dark ? "rgba(196,125,142,.1)" : "rgba(196,125,142,.06)") : "none", border: `1px solid ${showInfo ? t.accent : t.cardBorder}`, color: showInfo ? t.accent : t.textMuted, display: "none" }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
              </button>
            </div>
            {/* Collapsible info — mobile/tablet only */}
            {showInfo && (
              <div className="sup-info-inline px-[18px] pb-3.5" style={{ display: "none" }}>
                <div className="p-3 rounded-[10px]" style={{ background: dark ? "rgba(255,255,255,.03)" : "rgba(0,0,0,.02)", border: `1px solid ${t.cardBorder}` }}>
                  <div className="flex gap-4 flex-wrap text-[13px]">
                    <div>
                      <div className="text-[10px] font-semibold uppercase tracking-[1px] mb-[3px]" style={{ color: t.textMuted }}>Customer</div>
                      <div className="font-medium" style={{ color: t.text }}>{selected.user}</div>
                      <div className="text-xs" style={{ color: t.textSoft }}>{selected.email}</div>
                    </div>
                    <div>
                      <div className="text-[10px] font-semibold uppercase tracking-[1px] mb-[3px]" style={{ color: t.textMuted }}>Ticket</div>
                      <div className="text-xs" style={{ color: t.textSoft, fontFamily: "'JetBrains Mono', monospace" }}>{selected.id}</div>
                      <div className="text-xs">Status: <span className="font-semibold" style={{ color: statusClr(selected.status, dark) }}>{selected.status}</span> · {selected.replies?.length || 0} replies</div>
                    </div>
                    {selected.orderId && (
                      <div>
                        <div className="text-[10px] font-semibold uppercase tracking-[1px] mb-[3px]" style={{ color: t.textMuted }}>Order</div>
                        <div className="text-xs" style={{ color: t.accent, fontFamily: "'JetBrains Mono', monospace" }}>{selected.orderId}</div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="flex-1 overflow-y-auto min-h-0 py-4 px-[18px] flex flex-col gap-2">
            <div className="flex-1" />
            {/* Original message */}
            <div className="flex flex-col items-start">
              <div className="max-w-[80%] py-2.5 px-3.5 rounded-[14px] rounded-bl-[4px]" style={{ background: dark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.03)", border: `1px solid ${t.cardBorder}` }}>
                <div className="text-xs font-semibold mb-[3px]" style={{ color: dark ? "#60a5fa" : "#2563eb" }}>{selected.user}</div>
                <div className="text-sm leading-[1.55] whitespace-pre-wrap" style={{ color: t.text }}>{selected.message}</div>
              </div>
              <div className="text-[11px] mt-[3px] px-1.5" style={{ color: t.textMuted }}>{selected.created ? fD(selected.created) : ""}</div>
            </div>
            {/* Replies */}
            {(selected.replies || []).map((r, i) => (
              <div key={i} className="flex flex-col" style={{ alignItems: r.from === "admin" ? "flex-end" : "flex-start" }}>
                <div className="max-w-[80%] py-2.5 px-3.5 rounded-[14px]" style={{
                  borderBottomRightRadius: r.from === "admin" ? 4 : 14,
                  borderBottomLeftRadius: r.from !== "admin" ? 4 : 14,
                  background: r.from === "admin" ? (dark ? "rgba(196,125,142,0.12)" : "rgba(196,125,142,0.06)") : (dark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.03)"),
                  border: r.from === "admin" ? `1px solid ${dark ? "rgba(196,125,142,0.1)" : "rgba(196,125,142,0.08)"}` : `1px solid ${t.cardBorder}`
                }}>
                  <div className="text-xs font-semibold mb-[3px]" style={{ color: r.from === "admin" ? t.accent : (dark ? "#60a5fa" : "#2563eb") }}>{r.from === "admin" ? "You" : (r.name || selected.user)}</div>
                  <div className="text-sm leading-[1.55] whitespace-pre-wrap" style={{ color: t.text }}>{r.msg}</div>
                </div>
                <div className="text-[11px] mt-[3px] px-1.5" style={{ color: t.textMuted }}>{r.time ? fD(r.time) : ""}</div>
              </div>
            ))}
            <div ref={msgsEnd} />
          </div>

          {selected.status !== "Resolved" && selected.status !== "Archived" ? (() => {
            const lockedByOther = selected.lockedBy && selected.lockedBy !== adminName;
            return lockedByOther ? (
              <div className="py-3 px-4 text-center text-[13px] shrink-0" style={{ borderTop: `1px solid ${t.cardBorder}`, color: dark ? "#fcd34d" : "#d97706", background: dark ? "rgba(234,179,8,0.04)" : "rgba(234,179,8,0.03)" }}>
                🔒 {selected.lockedBy} is handling this ticket
              </div>
            ) : (
              <div className="py-3 px-4 flex gap-2 items-end shrink-0" style={{ borderTop: `1px solid ${t.cardBorder}` }}>
                <textarea value={reply} onChange={e => setReply(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); doReply(); } }} placeholder={`Reply to ${selected.user?.split(" ")[0]}...`} rows={1} className="flex-1 py-2.5 px-3.5 rounded-xl text-sm outline-none font-[inherit] resize-none leading-[1.5] min-h-[42px] max-h-[100px]" style={{ background: dark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.02)", border: `1px solid ${t.cardBorder}`, color: t.text }} />
                <button onClick={doReply} className="py-[9px] px-[18px] rounded-[10px] text-[13px] font-semibold border-none whitespace-nowrap" style={{ background: reply.trim() ? `linear-gradient(135deg,${t.accent},#a3586b)` : (dark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.02)"), color: reply.trim() ? "#fff" : t.textMuted, cursor: reply.trim() ? "pointer" : "default" }}>Send</button>
                <button onClick={doResolve} className="py-[9px] px-3.5 rounded-[10px] bg-transparent text-[13px] font-medium cursor-pointer whitespace-nowrap" style={{ border: `1px solid ${dark ? "rgba(110,231,183,0.15)" : "rgba(16,185,129,0.12)"}`, color: dark ? "#6ee7b7" : "#059669" }}>Resolve</button>
              </div>
            );
          })() : (
            <div className="py-3.5 px-[18px] text-center text-[13px] shrink-0 flex justify-center gap-3" style={{ borderTop: `1px solid ${t.cardBorder}`, color: t.textMuted }}>
              <span>Ticket resolved</span>
              <button onClick={async () => { if (sendingRef.current) return; sendingRef.current = true; try { await fetch("/api/admin/tickets", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "reopen", ticketId: selected.id }) }); refreshTickets(); } finally { sendingRef.current = false; } }} className="bg-transparent border-none text-[13px] cursor-pointer font-[inherit]" style={{ color: t.accent }}>Reopen</button>
              <button onClick={async () => { if (sendingRef.current) return; sendingRef.current = true; try { await fetch("/api/admin/tickets", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "archive", ticketId: selected.id }) }); refreshTickets(); setSelected(null); } finally { sendingRef.current = false; } }} className="bg-transparent border-none text-[13px] cursor-pointer font-[inherit]" style={{ color: t.textMuted }}>Archive</button>
            </div>
          )}
        </> : (
          <div className="flex-1 flex items-center justify-center text-[13px]" style={{ color: t.textMuted }}>Select a conversation</div>
        )}
      </div>

      {/* ═══ RIGHT: CUSTOMER INFO ═══ */}
      {selected && (
        <div className="sup-info-panel w-[220px] py-4 px-3.5 shrink-0 overflow-y-auto" style={{ borderLeft: `1px solid ${t.cardBorder}` }}>
          <div className="mb-4">
            <div className="w-10 h-10 rounded-full flex items-center justify-center mb-2" style={{ background: dark ? "rgba(96,165,250,0.1)" : "rgba(37,99,235,0.06)", border: `1px solid ${dark ? "rgba(96,165,250,0.12)" : "rgba(37,99,235,0.08)"}` }}>
              <span className="text-[15px] font-semibold" style={{ color: dark ? "#60a5fa" : "#2563eb" }}>{selected.user?.split(" ").map(n => n[0]).join("") || "?"}</span>
            </div>
            <div className="text-[15px] font-medium" style={{ color: t.text }}>{selected.user}</div>
            <div className="text-[13px] mt-0.5" style={{ color: t.textSoft }}>{selected.email}</div>
          </div>

          <div className="h-px mb-3.5" style={{ background: t.cardBorder }} />

          <div className="mb-3.5">
            <div className="text-[11px] font-semibold uppercase tracking-[1px] mb-2" style={{ color: t.textMuted }}>Ticket</div>
            <div className="text-[13px] mb-[3px]" style={{ color: t.textSoft }}>ID: <span className="text-[11px]" style={{ fontFamily: "'JetBrains Mono', monospace" }}>{selected.id}</span></div>
            <div className="text-[13px] mb-[3px]" style={{ color: t.textSoft }}>Status: <span className="font-semibold" style={{ color: statusClr(selected.status, dark) }}>{selected.status}</span></div>
            <div className="text-[13px]" style={{ color: t.textSoft }}>Replies: {selected.replies?.length || 0}</div>
          </div>

          {selected.orderId && <>
            <div className="h-px mb-3.5" style={{ background: t.cardBorder }} />
            <div className="mb-3.5">
              <div className="text-[11px] font-semibold uppercase tracking-[1px] mb-2" style={{ color: t.textMuted }}>Related order</div>
              <div className="p-2.5 rounded-lg" style={{ background: dark ? "rgba(255,255,255,0.02)" : "rgba(0,0,0,0.02)", border: `1px solid ${t.cardBorder}` }}>
                <div className="text-xs" style={{ fontFamily: "'JetBrains Mono', monospace", color: t.accent }}>{selected.orderId}</div>
              </div>
            </div>
          </>}
        </div>
      )}
    </div>
  );
}
