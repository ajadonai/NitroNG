'use client';
import { useState, useEffect, useRef } from "react";
import { fD, fRel } from "../lib/format";
import { useConfirm } from "./confirm-dialog";

function statusClr(s, dk) { return s === "Open" ? (dk ? "#fcd34d" : "#d97706") : s === "In Progress" ? (dk ? "#60a5fa" : "#2563eb") : (dk ? "#6ee7b7" : "#059669"); }
function statusBg(s, dk) { return s === "Open" ? (dk ? "rgba(234,179,8,0.1)" : "rgba(234,179,8,0.06)") : s === "In Progress" ? (dk ? "rgba(96,165,250,0.08)" : "rgba(37,99,235,0.06)") : (dk ? "rgba(110,231,183,0.08)" : "rgba(16,185,129,0.06)"); }

export default function AdminTicketsPage({ dark, t, adminName }) {
  const confirm = useConfirm();
  const [tickets, setTickets] = useState([]);
  const [selected, setSelected] = useState(null);
  const [filter, setFilter] = useState("all");
  const [sortDir, setSortDir] = useState("newest");
  const [reply, setReply] = useState("");
  const [mobileView, setMobileView] = useState("list");
  const [showInfo, setShowInfo] = useState(false);
  const [loading, setLoading] = useState(true);
  const msgsEnd = useRef(null);
  const sendingRef = useRef(false);
  const infoPanelRef = useRef(null);

  const refreshTickets = () => {
    fetch("/api/admin/tickets").then(r => r.json()).then(d => {
      if (d.tickets) {
        setTickets(d.tickets);
        if (selected) {
          const updated = d.tickets.find(tk => tk.id === selected.id);
          if (updated) {
            setSelected(updated);
            if (updated.unreadByAdmin) fetch("/api/admin/tickets", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "read", ticketId: updated.id }) }).catch(() => {});
          }
        }
      }
      setLoading(false);
    }).catch(() => setLoading(false));
  };

  useEffect(() => { refreshTickets(); }, []);

  useEffect(() => {
    const iv = setInterval(refreshTickets, 10000);
    const onVis = () => { if (!document.hidden) refreshTickets(); };
    document.addEventListener("visibilitychange", onVis);
    return () => { clearInterval(iv); document.removeEventListener("visibilitychange", onVis); };
  }, [selected?.id]);

  useEffect(() => { setTimeout(() => msgsEnd.current?.scrollIntoView({ behavior: "smooth" }), 50); }, [selected, tickets]);

  const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const isArchived = (tk) => tk.status === "Archived" || (tk.status === "Resolved" && tk.created && new Date(tk.created).getTime() < thirtyDaysAgo);
  const lastActivity = (tk) => { const lr = tk.replies?.[tk.replies.length - 1]; return lr?.time || tk.created; };
  const filtered = (filter === "all" ? tickets.filter(tk => !isArchived(tk))
    : filter === "unread" ? tickets.filter(tk => tk.unreadByAdmin && !isArchived(tk))
    : filter === "mine" ? tickets.filter(tk => tk.claimedBy === adminName && !isArchived(tk))
    : filter === "active" ? tickets.filter(tk => tk.status === "Open" || tk.status === "In Progress")
    : filter === "archived" ? tickets.filter(isArchived)
    : tickets.filter(tk => tk.status === filter)
  ).sort((a, b) => {
    const d = new Date(lastActivity(b)) - new Date(lastActivity(a));
    return sortDir === "oldest" ? -d : d;
  });

  const selectTicket = (tk) => {
    setSelected(tk); setReply(""); setMobileView("chat"); setShowInfo(true);
    if (tk.unreadByAdmin) fetch("/api/admin/tickets", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "read", ticketId: tk.id }) }).then(() => refreshTickets()).catch(() => {});
  };

  const doClaim = async () => {
    if (!selected) return;
    const res = await fetch("/api/admin/tickets", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "claim", ticketId: selected.id }) });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      if (d.claimedBy) {
        const ok = await confirm({ title: "Already Claimed", message: `This ticket is claimed by ${d.claimedBy}. They may already be working on it.`, confirmLabel: "OK" });
      }
    }
    refreshTickets();
  };

  const doRelease = async () => {
    if (!selected) return;
    await fetch("/api/admin/tickets", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "release", ticketId: selected.id }) }).catch(() => {});
    refreshTickets();
  };

  const doReply = async () => {
    if (!reply.trim() || !selected || sendingRef.current) return;
    if (selected.claimedBy && selected.claimedBy !== adminName) {
      const ok = await confirm({ title: "Claimed by " + selected.claimedBy, message: `${selected.claimedBy} is handling this ticket. Reply anyway?`, confirmLabel: "Reply Anyway" });
      if (!ok) return;
    }
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

  if (loading) return <div className="p-6">{[1,2,3,4].map(i => <div key={i} className={`skel-bone ${dark ? "skel-dark" : "skel-light"} h-[52px] rounded-lg mb-2`} />)}</div>;

  const isMine = selected?.claimedBy === adminName;
  const claimedByOther = selected?.claimedBy && selected.claimedBy !== adminName;

  return (
    <div className={`sup-split ${mobileView === "chat" ? "sup-view-chat" : "sup-view-list"} rounded-xl`} style={{ border: `1px solid ${t.cardBorder}` }}>
      {/* ═══ LEFT: TICKET LIST ═══ */}
      <div className="sup-split-list w-[280px] shrink-0 overflow-hidden" style={{ borderRight: `1px solid ${t.cardBorder}` }}>
        <div className="shrink-0 h-[56px] flex items-center gap-2 px-4" style={{ background: dark ? "rgba(196,125,142,.18)" : "rgba(196,125,142,.12)", borderBottom: `1px solid ${t.cardBorder}` }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={t.accent} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
          <div className="text-[15px] font-semibold" style={{ color: t.text }}>Support inbox</div>
        </div>
        <div className="shrink-0 flex items-center gap-1.5" style={{ padding: "8px 10px", borderBottom: `1px solid ${t.cardBorder}` }}>
          <select value={filter} onChange={e => setFilter(e.target.value)} className="flex-1 py-1.5 px-2 rounded-lg text-xs font-medium outline-none cursor-pointer" style={{ background: dark ? "rgba(196,125,142,.18)" : "rgba(196,125,142,.12)", border: `1px solid ${t.cardBorder}`, color: t.text, fontFamily: "inherit" }}>
            <option value="all">All tickets</option>
            <option value="mine">My tickets</option>
            <option value="unread">Unread</option>
            <option value="active">Active</option>
            <option value="Resolved">Done</option>
            <option value="archived">Archived</option>
          </select>
          <button onClick={() => setSortDir(s => s === "newest" ? "oldest" : "newest")} title={sortDir === "newest" ? "Showing newest first" : "Showing oldest first"} className="w-[30px] h-[30px] rounded-lg flex items-center justify-center shrink-0 cursor-pointer" style={{ background: dark ? "rgba(255,255,255,.06)" : "rgba(0,0,0,.04)", border: `1px solid ${t.cardBorder}`, color: t.textMuted }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: sortDir === "oldest" ? "rotate(180deg)" : "none" }}><path d="M12 5v14"/><path d="M19 12l-7 7-7-7"/></svg>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {filtered.length === 0 && <div className="py-8 px-5 text-center">
            <svg width="36" height="36" viewBox="0 0 64 64" fill="none" style={{ display: "block", margin: "0 auto 10px", opacity: .7 }}>
              <rect x="8" y="8" width="48" height="40" rx="8" stroke={t.accent} strokeWidth="1.5" opacity=".3" />
              <line x1="18" y1="22" x2="46" y2="22" stroke={t.accent} strokeWidth="1.5" opacity=".2" strokeLinecap="round" />
              <line x1="18" y1="30" x2="38" y2="30" stroke={t.accent} strokeWidth="1.5" opacity=".15" strokeLinecap="round" />
              <path d="M20 48l12 8 12-8" stroke={t.accent} strokeWidth="1.5" opacity=".2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <div className="text-sm font-semibold" style={{ color: t.textSoft }}>No tickets</div>
          </div>}
          {filtered.map(tk => {
            const isSel = selected?.id === tk.id;
            const hasUnread = tk.unreadByAdmin;
            return (
              <div key={tk.id} role="button" tabIndex={0} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();e.currentTarget.click()}}} onClick={() => selectTicket(tk)} className="flex items-center gap-2.5 py-2.5 px-3.5 cursor-pointer" style={{ borderBottom: `1px solid ${t.cardBorder}`, background: isSel ? (dark ? "rgba(196,125,142,.1)" : "rgba(196,125,142,.07)") : "transparent", borderLeft: isSel ? `3px solid ${t.accent}` : "3px solid transparent" }}>
                <div className="w-8 h-8 rounded-full shrink-0 flex items-center justify-center text-[11px] font-bold relative" style={{ background: dark ? "rgba(148,163,184,.1)" : "rgba(100,116,139,.08)", color: dark ? "#94a3b8" : "#64748b" }}>
                  {(tk.user || "?")[0].toUpperCase()}
                  {hasUnread && !isSel && <div className="absolute -top-px -right-px w-2.5 h-2.5 rounded-full" style={{ background: t.accent, border: `2px solid ${dark ? "#0e1225" : "#f3f0ec"}` }} />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-medium mb-[3px] truncate" style={{ color: isSel ? t.text : (dark ? "rgba(255,255,255,.85)" : "rgba(0,0,0,.8)") }}>{tk.id}</div>
                  <div className="text-xs mb-1 truncate" style={{ color: t.textMuted }}>{(() => { const lr = tk.replies?.[tk.replies.length - 1]; if (lr) { const who = lr.from === "admin" ? (lr.name || "You") : (tk.user?.split(" ")[0] || "User"); return `${who}: ${lr.msg?.split("\n")[0]?.slice(0, 50) || ""}`; } return tk.message?.split("\n")[0]?.slice(0, 50) || tk.subject; })()}</div>
                  <div className="flex gap-[5px] items-center">
                    <span className="text-[11px] font-semibold py-px px-[7px] rounded" style={{ background: statusBg(tk.status, dark), color: statusClr(tk.status, dark) }}>{(tk.status || "").toLowerCase()}</span>
                    {tk.claimedBy && <span className="text-[10px] font-medium" style={{ color: tk.claimedBy === adminName ? t.accent : (dark ? "#fcd34d" : "#d97706") }}>{tk.claimedBy === adminName ? "You" : tk.claimedBy}</span>}
                  </div>
                </div>
                <span className="text-[11px] shrink-0" style={{ color: t.textMuted }}>{fRel(lastActivity(tk))}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* ═══ CENTER: CONVERSATION ═══ */}
      <div className="sup-split-chat min-h-0">
        {selected ? <>
          <div className="shrink-0 h-[56px] flex items-center gap-2.5 px-[18px]" style={{ borderBottom: `1px solid ${t.cardBorder}`, background: dark ? "rgba(196,125,142,.18)" : "rgba(196,125,142,.12)" }}>
            <button className="sup-mobile-back p-1 border-none cursor-pointer transition-transform duration-200 hover:-translate-y-px" onClick={() => { setMobileView("list"); setShowInfo(false); }} style={{ background: "none", color: t.textMuted, display: "none" }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6"/></svg>
            </button>
            <div className="w-9 h-9 rounded-full shrink-0 flex items-center justify-center" style={{ background: dark ? "rgba(148,163,184,.12)" : "rgba(100,116,139,.08)", border: `1px solid ${dark ? "rgba(148,163,184,.15)" : "rgba(100,116,139,.1)"}` }}>
              <span className="text-xs font-bold" style={{ color: dark ? "#94a3b8" : "#64748b" }}>{(selected.user || "?")[0].toUpperCase()}</span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[15px] font-semibold truncate" style={{ color: t.text }}>{selected.id}</div>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-[11px] font-semibold py-px px-2 rounded" style={{ background: statusBg(selected.status, dark), color: statusClr(selected.status, dark) }}>{(selected.status || "").toLowerCase()}</span>
                {selected.claimedBy && <span className="text-[11px] font-medium" style={{ color: isMine ? t.accent : (dark ? "#fcd34d" : "#d97706") }}>{isMine ? "Claimed by you" : `Claimed by ${selected.claimedBy}`}</span>}
              </div>
            </div>
            <div className="flex gap-1.5 shrink-0">
              {selected.status !== "Resolved" && selected.status !== "Archived" && (
                isMine ? (
                  <button onClick={doRelease} className="py-1.5 px-3 rounded-lg text-[11px] font-medium cursor-pointer font-[inherit] transition-all duration-200 hover:-translate-y-px" style={{ border: `1px solid ${t.cardBorder}`, background: "none", color: t.textMuted }}>Release</button>
                ) : !selected.claimedBy ? (
                  <button onClick={doClaim} className="py-1.5 px-3 rounded-lg text-[11px] font-semibold cursor-pointer font-[inherit] border-none transition-all duration-200 hover:-translate-y-px" style={{ background: `linear-gradient(135deg,${t.accent},#a3586b)`, color: "#fff" }}>Claim</button>
                ) : null
              )}
              <button className="rounded-lg py-1.5 px-2 cursor-pointer shrink-0 transition-transform duration-200 hover:-translate-y-px" onClick={() => setShowInfo(!showInfo)} style={{ background: showInfo ? (dark ? "rgba(196,125,142,.18)" : "rgba(196,125,142,.12)") : (dark ? "rgba(255,255,255,.06)" : "rgba(0,0,0,.04)"), border: `1px solid ${showInfo ? t.accent : t.cardBorder}`, color: showInfo ? t.accent : t.textMuted }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
              </button>
            </div>
          </div>

          {/* Inline info dropdown — visible on tablet/mobile only */}
          {showInfo && (
            <div className="sup-info-inline shrink-0 overflow-y-auto" style={{ maxHeight: 260, padding: "12px 18px", borderBottom: `1px solid ${t.cardBorder}`, background: dark ? "rgba(196,125,142,.04)" : "rgba(196,125,142,.03)" }}>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
                <div><span style={{ color: t.textMuted }}>User </span><span className="font-medium" style={{ color: t.text }}>{selected.user}</span></div>
                <div><span style={{ color: t.textMuted }}>Email </span><span className="font-medium break-all" style={{ color: t.textSoft }}>{selected.email || "—"}</span></div>
                <div><span style={{ color: t.textMuted }}>ID </span><span className="font-medium" style={{ fontFamily: "'JetBrains Mono',monospace", color: t.textSoft }}>{selected.id}</span></div>
                <div><span style={{ color: t.textMuted }}>Status </span><span className="font-semibold" style={{ color: statusClr(selected.status, dark) }}>{selected.status}</span></div>
                {selected.claimedBy && <div><span style={{ color: t.textMuted }}>Claimed </span><span className="font-medium" style={{ color: isMine ? t.accent : (dark ? "#fcd34d" : "#d97706") }}>{selected.claimedBy}</span></div>}
                {selected.orderId && <div><span style={{ color: t.textMuted }}>Order </span><span className="font-medium" style={{ color: t.accent }}>{selected.orderId}</span></div>}
                <div><span style={{ color: t.textMuted }}>Created </span><span style={{ color: t.textSoft }}>{selected.created ? fD(selected.created) : "—"}</span></div>
              </div>
              {selected.activity?.length > 0 && (
                <div className="mt-2.5 pt-2" style={{ borderTop: `1px solid ${t.cardBorder}` }}>
                  <div className="text-[10px] font-semibold uppercase tracking-[1px] mb-1.5" style={{ color: t.textMuted }}>Activity</div>
                  <div className="flex flex-col gap-1">
                    {selected.activity.slice(0, 5).map((a, i) => (
                      <div key={i} className="text-[11px]" style={{ color: t.textSoft || t.textMuted }}>
                        <span className="font-semibold" style={{ color: t.text }}>{a.admin}</span> {a.action} · <span style={{ color: t.textMuted }}>{a.time ? fD(a.time) : ""}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="flex-1 overflow-y-auto min-h-0 py-4 px-[18px] flex flex-col gap-2" onClick={() => showInfo && setShowInfo(false)}>
            <div className="flex-1" />
            {/* Original message */}
            <div className="flex gap-2.5 items-center max-w-[82%]">
              <div className="w-9 h-9 rounded-full shrink-0 flex items-center justify-center" style={{ background: dark ? "rgba(148,163,184,.1)" : "rgba(100,116,139,.07)" }}>
                <span className="text-xs font-bold" style={{ color: dark ? "#94a3b8" : "#64748b" }}>{(selected.user || "?")[0].toUpperCase()}</span>
              </div>
              <div className="flex flex-col items-start flex-1 min-w-0">
                <div className="py-2.5 px-3.5 rounded-[14px] rounded-bl-[4px]" style={{ background: dark ? "rgba(255,255,255,.1)" : "rgba(0,0,0,.06)", border: `1px solid ${t.cardBorder}` }}>
                  <div className="text-sm leading-[1.55] whitespace-pre-wrap" style={{ color: t.text }}>{selected.message}</div>
                </div>
                <div className="text-[11px] mt-[3px] px-1.5" style={{ color: t.textMuted }}>{selected.created ? fD(selected.created) : ""}</div>
              </div>
            </div>
            {/* Replies */}
            {(selected.replies || []).map((r, i) => {
              const isAdm = r.from === "admin";
              if (isAdm) return (
                <div key={i} className="flex flex-col items-end max-w-[78%] self-end">
                  <div className="py-2.5 px-3.5 rounded-[14px]" style={{ borderBottomRightRadius: 4, background: dark ? "rgba(196,125,142,0.12)" : "rgba(196,125,142,0.06)", border: `1px solid ${dark ? "rgba(196,125,142,.18)" : "rgba(196,125,142,.14)"}` }}>
                    {r.name && <div className="text-[10px] font-semibold mb-1" style={{ color: t.accent }}>{r.name}</div>}
                    <div className="text-sm leading-[1.55] whitespace-pre-wrap" style={{ color: t.text }}>{r.msg}</div>
                  </div>
                  <div className="text-[11px] mt-[3px] px-1.5" style={{ color: t.textMuted }}>{r.time ? fD(r.time) : ""}</div>
                </div>
              );
              return (
                <div key={i} className="flex gap-2.5 items-center max-w-[82%]">
                  <div className="w-9 h-9 rounded-full shrink-0 flex items-center justify-center" style={{ background: dark ? "rgba(148,163,184,.1)" : "rgba(100,116,139,.07)" }}>
                    <span className="text-xs font-bold" style={{ color: dark ? "#94a3b8" : "#64748b" }}>{(selected.user || "?")[0].toUpperCase()}</span>
                  </div>
                  <div className="flex flex-col items-start flex-1 min-w-0">
                    <div className="py-2.5 px-3.5 rounded-[14px] rounded-bl-[4px]" style={{ background: dark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.03)", border: `1px solid ${t.cardBorder}` }}>
                      <div className="text-sm leading-[1.55] whitespace-pre-wrap" style={{ color: t.text }}>{r.msg}</div>
                    </div>
                    <div className="text-[11px] mt-[3px] px-1.5" style={{ color: t.textMuted }}>{r.time ? fD(r.time) : ""}</div>
                  </div>
                </div>
              );
            })}
            <div ref={msgsEnd} />
          </div>

          {selected.status !== "Resolved" && selected.status !== "Archived" ? (
            <>
              {claimedByOther && (
                <div className="py-2 px-4 text-center text-[12px] shrink-0 flex items-center justify-center gap-1.5" style={{ borderTop: `1px solid ${t.cardBorder}`, color: dark ? "#fcd34d" : "#d97706", background: dark ? "rgba(234,179,8,.06)" : "rgba(234,179,8,.04)" }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                  {selected.claimedBy} is handling this — you can still reply
                </div>
              )}
              <div className="py-2.5 px-4 flex gap-2 items-end shrink-0" style={{ borderTop: claimedByOther ? "none" : `1px solid ${t.cardBorder}` }}>
                <textarea value={reply} onChange={e => setReply(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); doReply(); } }} placeholder={`Reply to ${selected.user?.split(" ")[0]}...`} rows={1} className="flex-1 py-2.5 px-3.5 rounded-[20px] text-sm outline-none font-[inherit] resize-none leading-[1.5] min-h-[42px] max-h-[100px]" style={{ background: dark ? "rgba(255,255,255,.06)" : "rgba(0,0,0,.04)", border: `1px solid ${t.cardBorder}`, color: t.text }} />
                <button onClick={doReply} className="w-[38px] h-[38px] rounded-full border-none flex items-center justify-center shrink-0" style={{ background: reply.trim() ? `linear-gradient(135deg,${t.accent},#a3586b)` : (dark ? "rgba(255,255,255,.06)" : "rgba(0,0,0,.04)"), cursor: reply.trim() ? "pointer" : "default" }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={reply.trim() ? "#fff" : t.textMuted} strokeWidth="2" strokeLinecap="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
                </button>
                <button onClick={doResolve} className="h-[38px] px-3.5 rounded-full bg-transparent text-[13px] font-medium cursor-pointer whitespace-nowrap transition-transform duration-200 hover:-translate-y-px" style={{ border: `1px solid ${dark ? "rgba(110,231,183,.24)" : "rgba(16,185,129,.19)"}`, color: dark ? "#6ee7b7" : "#059669" }}>Resolve</button>
              </div>
            </>
          ) : (
            <div className="py-3.5 px-[18px] text-center text-[13px] shrink-0 flex justify-center gap-3" style={{ borderTop: `1px solid ${t.cardBorder}`, color: t.textMuted, background: dark ? "rgba(196,125,142,.18)" : "rgba(196,125,142,.12)" }}>
              <span>Ticket resolved</span>
              <button onClick={async () => { if (sendingRef.current) return; sendingRef.current = true; try { await fetch("/api/admin/tickets", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "reopen", ticketId: selected.id }) }); refreshTickets(); } finally { sendingRef.current = false; } }} className="bg-transparent border-none text-[13px] cursor-pointer font-[inherit] transition-transform duration-200 hover:-translate-y-px" style={{ color: t.accent }}>Reopen</button>
              <button onClick={async () => { if (sendingRef.current) return; sendingRef.current = true; try { await fetch("/api/admin/tickets", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "archive", ticketId: selected.id }) }); refreshTickets(); setSelected(null); } finally { sendingRef.current = false; } }} className="bg-transparent border-none text-[13px] cursor-pointer font-[inherit] transition-transform duration-200 hover:-translate-y-px" style={{ color: t.textMuted }}>Archive</button>
            </div>
          )}
        </> : (
          <div className="flex-1 flex flex-col items-center justify-center">
            <div className="w-12 h-12 rounded-full flex items-center justify-center mb-3" style={{ background: dark ? "rgba(255,255,255,.04)" : "rgba(0,0,0,.03)" }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={t.textMuted} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
            </div>
            <div className="text-[13px] font-medium mb-0.5" style={{ color: t.textSoft || t.textMuted }}>No conversation selected</div>
            <div className="text-xs" style={{ color: t.textMuted }}>Pick a ticket from the inbox</div>
          </div>
        )}
      </div>

      {/* ═══ RIGHT: CUSTOMER INFO ═══ */}
      {selected && showInfo && (
        <div ref={infoPanelRef} className="sup-info-panel w-[240px] py-4 px-3.5 shrink-0 overflow-y-auto" style={{ borderLeft: `1px solid ${t.cardBorder}`, background: t.cardBg || (dark ? '#0e1225' : '#fff') }}>
          {/* User card */}
          <div className="flex flex-col items-center text-center mb-4 py-4 px-3 rounded-xl" style={{ background: dark ? "rgba(148,163,184,.06)" : "rgba(100,116,139,.04)", border: `1px solid ${dark ? "rgba(148,163,184,.1)" : "rgba(100,116,139,.08)"}` }}>
            <div className="w-12 h-12 rounded-full flex items-center justify-center mb-2.5" style={{ background: dark ? "rgba(148,163,184,.14)" : "rgba(100,116,139,.1)", border: `1.5px solid ${dark ? "rgba(148,163,184,.18)" : "rgba(100,116,139,.14)"}` }}>
              <span className="text-lg font-semibold" style={{ color: dark ? "#94a3b8" : "#64748b" }}>{(selected.user || "?")[0].toUpperCase()}</span>
            </div>
            <div className="text-[15px] font-semibold" style={{ color: t.text }}>{selected.user}</div>
            {selected.email && <div className="text-xs mt-1 break-all" style={{ color: t.textMuted }}>{selected.email}</div>}
          </div>

          {/* Ticket details card */}
          <div className="mb-3 rounded-xl overflow-hidden" style={{ border: `1px solid ${t.cardBorder}` }}>
            <div className="text-[10px] font-semibold uppercase tracking-[1px] py-2 px-3" style={{ color: t.textMuted, background: dark ? "rgba(255,255,255,.03)" : "rgba(0,0,0,.02)" }}>Ticket details</div>
            <div className="px-3 py-2.5 flex flex-col gap-2">
              <div className="flex justify-between items-center">
                <span className="text-xs" style={{ color: t.textMuted }}>ID</span>
                <span className="text-[11px] font-medium" style={{ fontFamily: "'JetBrains Mono',monospace", color: t.textSoft }}>{selected.id}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs" style={{ color: t.textMuted }}>Status</span>
                <span className="text-[11px] font-semibold py-px px-2 rounded" style={{ background: statusBg(selected.status, dark), color: statusClr(selected.status, dark) }}>{selected.status}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs" style={{ color: t.textMuted }}>Claimed</span>
                <span className="text-[11px] font-medium" style={{ color: selected.claimedBy ? (isMine ? t.accent : (dark ? "#fcd34d" : "#d97706")) : t.textMuted }}>{selected.claimedBy || "Unclaimed"}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs" style={{ color: t.textMuted }}>Replies</span>
                <span className="text-xs font-medium" style={{ color: t.textSoft }}>{selected.replies?.length || 0}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs" style={{ color: t.textMuted }}>Created</span>
                <span className="text-xs" style={{ color: t.textSoft }}>{selected.created ? fD(selected.created) : "—"}</span>
              </div>
            </div>
          </div>

          {/* Order card */}
          {selected.orderId && (
            <div className="mb-3 rounded-xl overflow-hidden" style={{ border: `1px solid ${t.cardBorder}` }}>
              <div className="text-[10px] font-semibold uppercase tracking-[1px] py-2 px-3" style={{ color: t.textMuted, background: dark ? "rgba(255,255,255,.03)" : "rgba(0,0,0,.02)" }}>Related order</div>
              <div className="px-3 py-2.5">
                <div className="text-xs font-medium" style={{ fontFamily: "'JetBrains Mono',monospace", color: t.accent }}>{selected.orderId}</div>
              </div>
            </div>
          )}

          {/* Activity trail */}
          {selected.activity?.length > 0 && (
            <div className="rounded-xl overflow-hidden" style={{ border: `1px solid ${t.cardBorder}` }}>
              <div className="text-[10px] font-semibold uppercase tracking-[1px] py-2 px-3" style={{ color: t.textMuted, background: dark ? "rgba(255,255,255,.03)" : "rgba(0,0,0,.02)" }}>Activity</div>
              <div className="px-3 py-2.5 flex flex-col gap-2">
                {selected.activity.slice(0, 10).map((a, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <div className="w-1.5 h-1.5 rounded-full mt-[5px] shrink-0" style={{ background: a.action === "resolved" ? (dark ? "#6ee7b7" : "#059669") : a.action === "archived" ? (dark ? "#94a3b8" : "#64748b") : t.accent }} />
                    <div className="flex-1 min-w-0">
                      <div className="text-[11px] leading-snug" style={{ color: t.textSoft || t.textMuted }}>
                        <span className="font-semibold" style={{ color: t.text }}>{a.admin}</span> {a.action}
                      </div>
                      <div className="text-[10px] mt-px" style={{ color: t.textMuted }}>{a.time ? fD(a.time) : ""}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
