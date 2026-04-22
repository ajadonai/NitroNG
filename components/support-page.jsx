'use client';
import { useState, useEffect, useRef, useCallback } from "react";
import { fD } from "../lib/format";
import { SITE } from "../lib/site";

const BOT_RESPONSES = {
  check_order: { text: "To check your order status, go to **History** in your dashboard. Each order shows its current status. You can also tap **Check** on any order to refresh from the provider.", followUp: "What do the statuses mean?" },
  refund: { text: "Nitro offers refunds for:\n\n• **Undelivered orders** — auto-refunded after 72 hours\n• **Partial delivery** — refunded for undelivered portion\n• **Wrong service** — full refund to wallet\n\nRefunds go to your Nitro wallet within 5 minutes." },
  pricing: { text: "Nitro offers 3 tiers:\n\n• **Budget** — cheapest, may drop slightly\n• **Standard** — best value, stable with refill\n• **Premium** — top quality, lifetime guarantee\n\nPrices start at ₦3 per 1,000. Check the **Services** page for current rates." },
  referrals: { text: "Share your referral link with friends. When they sign up and deposit, you both earn a bonus! Check the **Referrals** section in your dashboard." },
  api: { text: "To use the Nitro API:\n\n1. Go to **Settings** → create your API key\n2. Your key starts with `ntro_sk_`\n3. Check the **Guide** page for full documentation" },
  status_explain: { text: "• **Pending** — order received, waiting to start\n• **Processing** — actively being delivered\n• **Completed** — fully delivered\n• **Partial** — only some delivered (auto-refund for rest)\n• **Cancelled** — cancelled, funds refunded to wallet" },
};

const QUICK_ACTIONS = [
  { id: "check_order", label: "Check order status", icon: "📦" },
  { id: "refund", label: "Refund policy", icon: "💰" },
  { id: "pricing", label: "Pricing & tiers", icon: "💎" },
  { id: "referrals", label: "How referrals work", icon: "🤝" },
  { id: "api", label: "Using the API", icon: "⚡" },
  { id: "human", label: "Talk to support", icon: "👤" },
];

const REASSURANCE = [
  "Still looking for an available agent — hang tight!",
  "Our team is handling other conversations. You're in the queue.",
  "Thanks for your patience. An agent will be with you shortly.",
  "Your conversation is saved — feel free to add more details while you wait.",
  "Agents typically respond within 5 minutes. Shouldn't be long now.",
];

/* Helpers */
function StatusPill({ status, dark }) {
  if (!status) return null;
  const s = String(status);
  const c = s === "Open" ? { bg: dark ? "rgba(234,179,8,0.1)" : "rgba(234,179,8,0.08)", color: dark ? "#fcd34d" : "#d97706" }
    : s === "In Progress" ? { bg: dark ? "rgba(59,130,246,0.08)" : "rgba(59,130,246,0.06)", color: dark ? "#60a5fa" : "#2563eb" }
    : { bg: dark ? "rgba(16,185,129,0.08)" : "rgba(16,185,129,0.06)", color: dark ? "#6ee7b7" : "#059669" };
  return <span className="text-[11px] font-semibold py-0.5 px-[7px] rounded" style={{ background: c.bg, color: c.color }}>{s.toLowerCase()}</span>;
}

function FormatText({ text, dark }) {
  if (!text || typeof text !== "string") return null;
  return <>{text.split(/(\*\*[^*]+\*\*|\`[^`]+\`|\n)/g).map((p, i) => {
    if (!p) return null;
    if (p === "\n") return <br key={i} />;
    if (p.startsWith("**") && p.endsWith("**")) return <strong key={i} className="font-semibold">{p.slice(2, -2)}</strong>;
    if (p.startsWith("`") && p.endsWith("`")) return <code key={i} className="text-xs rounded-[3px] py-px px-[5px]" style={{ fontFamily: "'JetBrains Mono',monospace", background: dark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)" }}>{p.slice(1, -1)}</code>;
    return <span key={i}>{p}</span>;
  })}</>;
}

function Bubble({ m, dark, t }) {
  if (!m || typeof m !== "object" || !m.from) return null;
  if (m.from === "system") return (
    <div className="text-center py-1.5">
      <span className="text-xs py-1 px-3 rounded-[10px]" style={{ color: t.textMuted, background: dark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.03)" }}>{String(m.text || "")}</span>
    </div>
  );
  const isUser = m.from === "user";
  return (
    <div className="flex flex-col" style={{ alignItems: isUser ? "flex-end" : "flex-start" }}>
      <div className="max-w-[78%] py-2.5 px-3.5 rounded-[14px]" style={{ borderBottomRightRadius: isUser ? 4 : 14, borderBottomLeftRadius: !isUser ? 4 : 14, background: isUser ? (dark ? "rgba(196,125,142,0.12)" : "rgba(196,125,142,0.08)") : (dark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.03)"), border: `1px solid ${isUser ? (dark ? "rgba(196,125,142,0.1)" : "rgba(196,125,142,0.12)") : (dark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)")}` }}>
        {!isUser && <div className="text-[13px] font-semibold mb-[3px]" style={{ color: m.from === "bot" ? (dark ? "#6ee7b7" : "#059669") : (dark ? "#60a5fa" : "#2563eb") }}>{m.name || (m.from === "bot" ? "Nitro Bot" : "Support")}</div>}
        <div className="text-[15px] leading-relaxed whitespace-pre-line" style={{ color: t.text }}>{m.formatted ? <FormatText text={String(m.text || "")} dark={dark} /> : String(m.text || "")}</div>
      </div>
      {m.time && <div className="text-[11px] mt-[3px] px-1.5" style={{ color: t.textMuted }}>{typeof m.time === "string" && m.time.includes("T") ? fD(m.time) : String(m.time || "")}</div>}
    </div>
  );
}

/* ═══════════════════════════════════════════ */
/* ═══ SUPPORT PAGE                        ═══ */
/* ═══════════════════════════════════════════ */
export default function SupportPage({ dark, t }) {
  const [tickets, setTickets] = useState([]);
  const [selected, setSelected] = useState(null); // null = bot chat, "new" = new ticket form, {object} = ticket detail
  const [filter, setFilter] = useState("all");
  const [input, setInput] = useState("");
  const [isLive, setIsLive] = useState(false);
  const [waitingForAgent, setWaitingForAgent] = useState(false);
  const [msgs, setMsgs] = useState([
    { from: "bot", name: "Nitro Bot", text: "Hi! I'm Nitro's assistant. I can help with orders, refunds, pricing, and more. Tap a topic below or type your question.", time: "Now", formatted: true }
  ]);
  const [typing, setTyping] = useState(false);
  const [showQuick, setShowQuick] = useState(true);
  const [ticketLoading, setTicketLoading] = useState(false);
  const [newSubject, setNewSubject] = useState("");
  const [newMessage, setNewMessage] = useState("");
  const [newCat, setNewCat] = useState("Order Issue");
  const [mobileView, setMobileView] = useState("chat");

  const msgsEnd = useRef(null);
  const waitRef = useRef(null);
  const waitCountRef = useRef(0);
  const selectedIdRef = useRef(null); // track selected.id without causing re-renders
  const sendingRef = useRef(false);

  // Keep ref in sync
  useEffect(() => { selectedIdRef.current = (selected && typeof selected === "object") ? selected.id : null; }, [selected]);

  const scrollChat = useCallback(() => { setTimeout(() => msgsEnd.current?.scrollIntoView({ behavior: "smooth" }), 60); }, []);

  // Scroll when bot msgs change (not ticket msgs — those scroll manually)
  useEffect(scrollChat, [msgs, typing, scrollChat]);

  // Load + poll tickets
  const refreshTickets = useCallback(() => {
    fetch("/api/tickets").then(r => r.json()).then(d => {
      if (!d.tickets) return;
      // Filter out Archived tickets — users should never see them
      const visible = d.tickets.filter(tk => tk.status !== "Archived");
      setTickets(visible);
      // Update selected ticket if message count changed
      const sid = selectedIdRef.current;
      if (sid) {
        setSelected(prev => {
          if (!prev || typeof prev !== "object") return prev;
          const updated = visible.find(tk => tk.id === sid);
          if (updated && updated.messages?.length !== prev.messages?.length) return updated;
          return prev;
        });
      }
    }).catch(() => {});
  }, []);

  useEffect(() => { refreshTickets(); }, [refreshTickets]);
  useEffect(() => {
    const iv = setInterval(refreshTickets, 12000);
    const onVis = () => { if (!document.hidden) refreshTickets(); };
    document.addEventListener("visibilitychange", onVis);
    return () => { clearInterval(iv); document.removeEventListener("visibilitychange", onVis); };
  }, [refreshTickets]);

  // Reassurance while waiting
  useEffect(() => {
    if (!waitingForAgent) { clearInterval(waitRef.current); waitCountRef.current = 0; return; }
    waitRef.current = setInterval(() => {
      if (waitCountRef.current >= REASSURANCE.length) { clearInterval(waitRef.current); return; }
      setMsgs(prev => [...prev, { from: "bot", name: "Nitro Bot", text: REASSURANCE[waitCountRef.current], time: "Now" }]);
      waitCountRef.current++;
    }, 30000);
    return () => clearInterval(waitRef.current);
  }, [waitingForAgent]);

  // Poll for agent joining
  useEffect(() => {
    if (!waitingForAgent) return;
    const iv = setInterval(() => {
      fetch("/api/tickets").then(r => r.json()).then(d => {
        if (!d.tickets) return;
        const latest = d.tickets.find(tk => tk.status === "In Progress");
        if (latest) {
          const adminReply = (latest.messages || []).filter(m => m.from === "admin");
          if (adminReply.length) {
            setWaitingForAgent(false);
            const last = adminReply[adminReply.length - 1];
            const name = String(last.name || "Support");
            setMsgs(prev => [...prev,
              { from: "system", text: `${name.replace(" - Nitro", "")} has joined the conversation` },
              { from: "support", name: name.includes(" - ") ? name : `${name} - Nitro`, text: last.text, time: last.time || "Now" },
            ]);
          }
        }
        const visible = d.tickets.filter(tk => tk.status !== "Archived");
        setTickets(visible);
      }).catch(() => {});
    }, 8000);
    return () => clearInterval(iv);
  }, [waitingForAgent]);

  /* ── Derived state ── */
  const isNewTicket = selected === "new";
  const isTicket = selected !== null && selected !== "new" && typeof selected === "object";
  const activeCount = tickets.filter(tk => tk.status === "Open" || tk.status === "In Progress").length;
  const hasOpenTicket = tickets.some(tk => tk.status === "Open" || tk.status === "In Progress");
  const filtered = filter === "all" ? tickets
    : filter === "active" ? tickets.filter(tk => tk.status === "Open" || tk.status === "In Progress")
    : tickets.filter(tk => tk.status === filter);

  let chatMsgs = msgs;
  if (isTicket) {
    try { chatMsgs = (selected.messages || []).map(m => ({ ...m, from: m.from === "admin" ? "support" : m.from, name: m.from === "admin" ? (m.name || "Support") : m.from === "user" ? undefined : m.name })); }
    catch { chatMsgs = []; }
  } else if (isNewTicket) { chatMsgs = []; }

  const chatTitle = isNewTicket ? "New Ticket" : isTicket ? selected.subject : "Support";
  const chatSub = isNewTicket ? "Describe your issue" : isTicket ? selected.id : (isLive ? (waitingForAgent ? "Waiting for an agent..." : "Connected with support") : "Ask anything or talk to support");

  /* ── Bot interactions ── */
  const addBotMsg = useCallback((text, extra = {}) => {
    setMsgs(prev => [...prev, { from: "bot", name: "Nitro Bot", text, time: "Now", formatted: true, ...extra }]);
  }, []);

  const handleQuick = useCallback((id) => {
    setShowQuick(false);
    const label = QUICK_ACTIONS.find(a => a.id === id)?.label || id;
    setMsgs(prev => [...prev, { from: "user", text: label, time: "Now" }]);

    if (id === "human") {
      setTyping(true);
      setTimeout(() => {
        setTyping(false);
        setMsgs(prev => [...prev, { from: "system", text: "Connecting you with support..." }]);
        setTimeout(async () => {
          setMsgs(current => {
            const ctx = current.filter(m => m.from === "user").map(m => m.text).join(" | ");
            fetch("/api/tickets", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "create", subject: ctx.length > 5 ? ctx.slice(0, 80) : "Support request", message: ctx || "User requested live support", category: "General" }) }).then(() => refreshTickets()).catch(() => {});
            return current;
          });
          setIsLive(true);
          setWaitingForAgent(true);
          setMsgs(prev => [...prev, { from: "system", text: "You're now chatting with Nitro Support. An agent will respond shortly." }]);
        }, 600);
      }, 600);
      return;
    }

    const resp = BOT_RESPONSES[id];
    if (resp) {
      setTyping(true);
      setTimeout(() => {
        setTyping(false);
        addBotMsg(resp.text, resp.followUp ? { followUp: resp.followUp } : {});
        setShowQuick(true);
      }, 600 + Math.random() * 300);
    }
  }, [addBotMsg, refreshTickets]);

  const handleFollowUp = useCallback((q) => {
    setMsgs(prev => [...prev, { from: "user", text: q, time: "Now" }]);
    setShowQuick(false);
    setTyping(true);
    setTimeout(() => {
      setTyping(false);
      addBotMsg(BOT_RESPONSES.status_explain?.text || "");
      setShowQuick(true);
    }, 700 + Math.random() * 300);
  }, [addBotMsg]);

  /* ── Send message ── */
  const sendMsg = useCallback(() => {
    if (!input.trim() || sendingRef.current) return;
    sendingRef.current = true;
    setTimeout(() => { sendingRef.current = false; }, 300);
    const txt = input.trim();
    setInput("");

    // Ticket reply
    if (isTicket) {
      setSelected(prev => {
        if (!prev || typeof prev !== "object") return prev;
        return { ...prev, messages: [...(prev.messages || []), { from: "user", text: txt, time: "Now" }] };
      });
      fetch("/api/tickets", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "reply", ticketId: selected.id, message: txt }), signal: AbortSignal.timeout(15000) })
        .then(r => { if (!r.ok) throw new Error(); refreshTickets(); })
        .catch(() => { setSelected(prev => ({ ...prev, messages: [...(prev?.messages || []), { from: "system", text: "Failed to send — check your connection and try again", time: "Now" }] })); });
      setTimeout(() => msgsEnd.current?.scrollIntoView({ behavior: "smooth" }), 100);
      return;
    }

    // Bot chat message
    setMsgs(prev => [...prev, { from: "user", text: txt, time: "Now" }]);

    if (isLive) {
      const tk = tickets.find(t2 => t2.status === "Open" || t2.status === "In Progress");
      if (tk) fetch("/api/tickets", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "reply", ticketId: tk.id, message: txt }) }).catch(() => {});
      return;
    }

    setShowQuick(false);
    const lower = txt.toLowerCase();
    if (lower.includes("order") && (lower.includes("status") || lower.includes("check"))) {
      setTyping(true);
      setTimeout(() => { setTyping(false); addBotMsg(BOT_RESPONSES.check_order.text, { followUp: BOT_RESPONSES.check_order.followUp }); setShowQuick(true); }, 700 + Math.random() * 300);
    } else if (lower.includes("refund") || lower.includes("money back")) {
      setTyping(true);
      setTimeout(() => { setTyping(false); addBotMsg(BOT_RESPONSES.refund.text); setShowQuick(true); }, 700 + Math.random() * 300);
    } else if (lower.includes("price") || lower.includes("cost") || lower.includes("how much")) {
      setTyping(true);
      setTimeout(() => { setTyping(false); addBotMsg(BOT_RESPONSES.pricing.text); setShowQuick(true); }, 700 + Math.random() * 300);
    } else if (lower.includes("human") || lower.includes("agent") || lower.includes("support") || lower.includes("person") || lower.includes("talk to")) {
      handleQuick("human");
    } else {
      setTyping(true);
      setTimeout(() => { setTyping(false); addBotMsg("I'm not sure about that. Would you like to speak with our support team?", { escalatePrompt: true }); }, 800 + Math.random() * 300);
    }
  }, [input, isTicket, isLive, selected, tickets, addBotMsg, handleQuick, refreshTickets]);

  /* ── Create ticket ── */
  const [ticketError, setTicketError] = useState(null);
  const createTicket = useCallback(async () => {
    if (!newSubject.trim() || !newMessage.trim() || ticketLoading) return;
    setTicketLoading(true); setTicketError(null);
    try {
      const res = await fetch("/api/tickets", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "create", subject: newSubject.trim(), message: newMessage.trim(), category: newCat }), signal: AbortSignal.timeout(15000) });
      if (res.ok) {
        setNewSubject(""); setNewMessage(""); setNewCat("Order Issue");
        setSelected(null);
        refreshTickets();
      } else { const d = await res.json().catch(() => ({})); setTicketError(d.error || "Failed to create ticket"); }
    } catch (err) { setTicketError(err?.name === "TimeoutError" ? "Request timed out" : "Network error. Check your connection."); }
    setTicketLoading(false);
  }, [newSubject, newMessage, newCat, ticketLoading, refreshTickets]);

  /* ── Close ticket ── */
  const closeTicket = useCallback(async () => {
    if (!isTicket || sendingRef.current) return;
    sendingRef.current = true;
    try {
      await fetch("/api/tickets", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "close", ticketId: selected.id }) }).catch(() => {});
      setSelected(null);
      refreshTickets();
    } finally { sendingRef.current = false; }
  }, [isTicket, selected, refreshTickets]);

  const canReply = isTicket && (selected.status === "Open" || selected.status === "In Progress");

  /* ═══ RENDER ═══ */
  return (
    <div className={`sup-split rounded-xl ${mobileView === "chat" ? "sup-view-chat" : "sup-view-list"}`} style={{ border: `1px solid ${dark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)"}` }}>

      {/* ═══ LEFT: CONVERSATION LIST ═══ */}
      <div className="sup-split-list w-[280px] shrink-0" style={{ borderRight: `1px solid ${dark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)"}` }}>
        <div className="flex justify-between items-center shrink-0 py-3.5 px-4" style={{ borderBottom: `1px solid ${dark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)"}` }}>
          <div>
            <div className="text-[15px] font-semibold" style={{ color: t.text }}>Conversations</div>
            <div className="text-xs mt-0.5" style={{ color: t.textMuted }}>{activeCount} active</div>
          </div>
          {hasOpenTicket
            ? <span className="text-[11px]" style={{ color: t.textMuted }}>Has open ticket</span>
            : <button onClick={() => { setSelected("new"); setMobileView("chat"); }} className="py-1 px-2.5 rounded-md bg-gradient-to-br from-[#c47d8e] to-[#a3586b] text-white text-[11px] font-semibold border-none cursor-pointer">+ New</button>
          }
        </div>

        <div className="sup-filter-bar" style={{ gap: 3, padding: "6px 10px", borderBottom: `1px solid ${dark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)"}` }}>
          {[["all","All"],["active","Active"],["Resolved","Done"]].map(([v,l])=>
            <button key={v} onClick={()=>setFilter(v)} className="py-[3px] px-2 rounded text-[11px] border-none cursor-pointer shrink-0 whitespace-nowrap" style={{ fontWeight:filter===v?600:450,background:filter===v?(dark?"rgba(196,125,142,0.1)":"rgba(196,125,142,0.06)"):"transparent",color:filter===v?t.accent:t.textMuted }}>{l}</button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto min-h-0">
          {/* Bot chat item */}
          <div role="button" tabIndex={0} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();e.currentTarget.click()}}} onClick={() => { setSelected(null); setMobileView("chat"); }} className="py-2.5 px-3.5 cursor-pointer" style={{ borderBottom: `1px solid ${dark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)"}`, background: !selected ? (dark ? "rgba(196,125,142,0.04)" : "rgba(196,125,142,0.02)") : "transparent", borderLeft: !selected ? `2px solid ${t.accent}` : "2px solid transparent" }}>
            <div className="flex items-center gap-1.5 mb-0.5">
              <div className="w-[5px] h-[5px] rounded-full shrink-0" style={{ background: dark ? "#6ee7b7" : "#059669" }} />
              <span className="text-[13px] font-medium" style={{ color: t.text }}>Nitro Bot</span>
              {isLive && <span className="text-[10px] py-px px-[5px] rounded-[3px]" style={{ background: dark ? "rgba(96,165,250,0.1)" : "rgba(59,130,246,0.06)", color: dark ? "#60a5fa" : "#2563eb" }}>live</span>}
            </div>
            <div className="text-xs truncate pl-[11px]" style={{ color: t.textMuted }}>{msgs[msgs.length - 1]?.text?.slice(0, 45) || ""}</div>
          </div>

          {/* Ticket list */}
          {filtered.map(tk => {
            const last = (tk.messages || [])[tk.messages?.length - 1];
            const sender = last?.from === "user" ? "You" : (last?.name?.split(" - ")?.[0] || "Support");
            const isSel = isTicket && selected.id === tk.id;
            return (
              <div key={tk.id} role="button" tabIndex={0} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();e.currentTarget.click()}}} onClick={() => { setSelected(tk); setInput(""); setMobileView("chat"); }} className="py-2.5 px-3.5 cursor-pointer" style={{ borderBottom: `1px solid ${dark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)"}`, background: isSel ? (dark ? "rgba(196,125,142,0.04)" : "rgba(196,125,142,0.02)") : "transparent", borderLeft: isSel ? `2px solid ${t.accent}` : "2px solid transparent" }}>
                <div className="flex justify-between items-center mb-0.5">
                  <span className="text-[13px] font-medium" style={{ color: t.text }}>{tk.subject || "Ticket"}</span>
                  <span className="text-[11px]" style={{ color: t.textMuted }}>{tk.created ? fD(tk.created) : ""}</span>
                </div>
                {last && <div className="text-xs truncate mb-[3px]" style={{ color: t.textMuted }}>
                  <span className="font-medium" style={{ color: last.from === "user" ? (dark ? "rgba(196,125,142,0.7)" : t.accent) : (dark ? "rgba(110,231,183,0.7)" : "#059669") }}>{sender}: </span>{String(last.text || "").split("\n")[0]?.slice(0, 45)}
                </div>}
                <StatusPill status={tk.status} dark={dark} />
              </div>
            );
          })}
          {filtered.length === 0 && tickets.length > 0 && <div className="p-5 text-center text-[11px]" style={{ color: t.textMuted }}>No matches</div>}
        </div>
      </div>

      {/* ═══ RIGHT: CHAT ═══ */}
      <div className="sup-split-chat">
        {/* Header */}
        <div className="flex items-center gap-2.5 shrink-0 py-3 px-[18px]" style={{ borderBottom: `1px solid ${dark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)"}` }}>
          <button className="sup-mobile-back" onClick={() => setMobileView("list")} style={{ background: "none", border: "none", color: t.textMuted, cursor: "pointer", padding: 4, display: "none" }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6"/></svg>
          </button>
          <div className="flex-1">
            <div className="text-base font-semibold flex items-center gap-2" style={{ color: t.text }}>
              {chatTitle}
              {isTicket && <StatusPill status={selected.status} dark={dark} />}
              {!selected && isLive && <span className="text-[11px] py-0.5 px-[7px] rounded" style={{ background: dark ? "rgba(96,165,250,0.1)" : "rgba(59,130,246,0.06)", color: dark ? "#60a5fa" : "#2563eb" }}>live</span>}
            </div>
            <div className="text-xs mt-px" style={{ color: t.textMuted }}>{chatSub}</div>
          </div>
          {canReply && <button onClick={closeTicket} className="py-[5px] px-3 rounded-md text-xs font-medium bg-transparent cursor-pointer shrink-0" style={{ border: `1px solid ${dark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)"}`, color: t.textMuted, fontFamily: "inherit" }}>Close</button>}
        </div>

        {/* Messages or New Ticket Form */}
        {isNewTicket ? (
          <div className="flex-1 overflow-y-auto min-h-0 py-5 px-[18px] flex flex-col">
            <label className="text-xs font-semibold uppercase tracking-[1px] mb-2" style={{ color: t.textMuted }}>Category</label>
            <div className="flex gap-[5px] flex-wrap mb-[18px]">
              {["Order Issue","Payment","Refund","Account","Other"].map(c =>
                <button key={c} onClick={() => setNewCat(c)} className="py-[6px] px-3.5 rounded-lg text-xs cursor-pointer" style={{ fontWeight: newCat === c ? 600 : 450, background: newCat === c ? (dark ? "rgba(196,125,142,0.1)" : "rgba(196,125,142,0.06)") : (dark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.02)"), border: `1px solid ${newCat === c ? (dark ? "rgba(196,125,142,0.2)" : "rgba(196,125,142,0.12)") : (dark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)")}`, color: newCat === c ? t.accent : t.textMuted, fontFamily: "inherit" }}>{c}</button>
              )}
            </div>
            <label className="text-xs font-semibold uppercase tracking-[1px] mb-1.5" style={{ color: t.textMuted }}>Subject</label>
            <input value={newSubject} onChange={e => setNewSubject(e.target.value)} placeholder="Brief description of your issue" className="w-full py-2.5 px-3.5 rounded-[10px] text-sm outline-none mb-4 box-border" style={{ background: dark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)", border: `1px solid ${dark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)"}`, color: t.text, fontFamily: "inherit" }} />
            <label className="text-xs font-semibold uppercase tracking-[1px] mb-1.5" style={{ color: t.textMuted }}>Message</label>
            <textarea value={newMessage} onChange={e => setNewMessage(e.target.value)} placeholder="Describe your issue. Include order IDs if relevant." rows={5} className="w-full py-2.5 px-3.5 rounded-[10px] text-sm outline-none resize-y leading-normal box-border" style={{ background: dark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)", border: `1px solid ${dark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)"}`, color: t.text, fontFamily: "inherit" }} />
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto min-h-0 py-3 px-[18px] flex flex-col gap-1.5">
              <div className="flex-1" />
              {chatMsgs.map((m, i) => (
                <div key={i}>
                  <Bubble m={m} dark={dark} t={t} />
                  {m.followUp && <div className="mt-1.5 pl-1"><button onClick={() => handleFollowUp(m.followUp)} className="py-1.5 px-3 rounded-lg text-xs cursor-pointer" style={{ background: dark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.02)", border: `1px solid ${dark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)"}`, color: t.textSoft || t.textMuted, fontFamily: "inherit" }}>{m.followUp}</button></div>}
                  {m.escalatePrompt && <div className="flex gap-1.5 mt-1.5 pl-1">
                    <button onClick={() => handleQuick("human")} className="py-1.5 px-3 rounded-lg text-xs font-medium cursor-pointer" style={{ background: dark ? "rgba(196,125,142,0.08)" : "rgba(196,125,142,0.05)", border: `1px solid ${dark ? "rgba(196,125,142,0.15)" : "rgba(196,125,142,0.1)"}`, color: t.accent, fontFamily: "inherit" }}>Yes, connect me</button>
                    <button onClick={() => setShowQuick(true)} className="py-1.5 px-3 rounded-lg text-xs cursor-pointer" style={{ background: dark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.02)", border: `1px solid ${dark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)"}`, color: t.textMuted, fontFamily: "inherit" }}>Ask something else</button>
                  </div>}
                </div>
              ))}
              {typing && <div className="self-start py-2.5 px-[18px] rounded-[14px] rounded-bl" style={{ background: dark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.03)", border: `1px solid ${dark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)"}` }}><div className="flex gap-1">{[0,1,2].map(j=><div key={j} className="sup-typing-dot" style={{ width:6,height:6,borderRadius:3,background:t.textMuted,animationDelay:`${j*.15}s` }}/>)}</div></div>}
              <div ref={msgsEnd} />
            </div>
            {!selected && showQuick && !isLive && <div className="py-2 px-4 flex gap-[5px] flex-wrap shrink-0" style={{ borderTop: `1px solid ${dark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)"}` }}>
              {QUICK_ACTIONS.map(a => <button key={a.id} onClick={() => handleQuick(a.id)} className="sup-quick-btn py-[7px] px-3 rounded-lg text-xs border border-solid cursor-pointer font-[inherit] flex items-center gap-[5px]" style={{ background: a.id === "human" ? (dark ? "rgba(196,125,142,0.08)" : "rgba(196,125,142,0.05)") : (dark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.02)"), borderColor: a.id === "human" ? (dark ? "rgba(196,125,142,0.2)" : "rgba(196,125,142,0.12)") : (dark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)"), color: a.id === "human" ? t.accent : (t.textSoft || t.textMuted), fontWeight: a.id === "human" ? 600 : 450 }}><span className="text-xs">{a.icon}</span>{a.label}</button>)}
            </div>}
          </>
        )}

        {/* Input — pinned at bottom */}
        {isNewTicket ? (
          <div className="py-2.5 px-4 shrink-0" style={{ borderTop: `1px solid ${dark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)"}` }}>
            {ticketError && <div className="py-1.5 px-2.5 rounded-md mb-1.5 text-xs" style={{ background: dark ? "rgba(220,38,38,.08)" : "#fef2f2", color: dark ? "#fca5a5" : "#dc2626" }}>⚠️ {ticketError}</div>}
            <button onClick={createTicket} disabled={!newSubject.trim() || !newMessage.trim() || ticketLoading} className="w-full py-[11px] rounded-[10px] text-sm font-semibold border-none cursor-pointer transition-[transform,box-shadow] duration-200 hover:translate-y-[-1px] hover:shadow-[0_6px_20px_rgba(196,125,142,.25)]" style={{ background: newSubject.trim() && newMessage.trim() ? "linear-gradient(135deg,#c47d8e,#a3586b)" : (dark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)"), color: newSubject.trim() && newMessage.trim() ? "#fff" : t.textMuted, cursor: newSubject.trim() && newMessage.trim() ? "pointer" : "default", fontFamily: "inherit" }}>{ticketLoading ? "Creating..." : "Create Ticket"}</button>
          </div>
        ) : (!selected || canReply) ? (
          <div className="flex gap-2 items-center shrink-0 py-2.5 px-4" style={{ borderTop: `1px solid ${dark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)"}` }}>
            <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === "Enter" && sendMsg()} placeholder={isTicket ? "Type a message..." : (waitingForAgent ? "Add details while you wait..." : isLive ? "Message support..." : "Ask a question...")} className="flex-1 py-2.5 px-4 rounded-[20px] text-sm outline-none" style={{ background: dark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)", border: `1px solid ${dark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)"}`, color: t.text, fontFamily: "inherit" }} />
            <button onClick={sendMsg} className="w-[38px] h-[38px] rounded-full border-none flex items-center justify-center shrink-0" style={{ background: input.trim() ? "linear-gradient(135deg,#c47d8e,#a3586b)" : (dark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)"), cursor: input.trim() ? "pointer" : "default" }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={input.trim() ? "#fff" : t.textMuted} strokeWidth="2" strokeLinecap="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
            </button>
          </div>
        ) : isTicket ? (
          <div className="py-3 px-[18px] text-center text-[13px] shrink-0" style={{ borderTop: `1px solid ${dark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)"}`, color: t.textMuted }}>This conversation has been resolved</div>
        ) : null}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════ */
/* ═══ SUPPORT RIGHT SIDEBAR               ═══ */
/* ═══════════════════════════════════════════ */
export function SupportSidebar({ dark, t, socialLinks = {} }) {
  const telegramSupport = socialLinks.social_telegram_support || socialLinks.social_telegram;
  return (
    <>
      <div className="text-[13px] font-semibold uppercase tracking-[1.5px] mb-3 pl-1" style={{ color: t.textMuted }}>Nitro Bot</div>
      <div className="p-3.5 rounded-xl mb-4" style={{ background: t.cardBg, border: `1px solid ${t.cardBorder}` }}>
        <div className="flex items-center gap-2 mb-2">
          <div className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: t.green }} />
          <span className="text-sm font-semibold" style={{ color: t.green }}>Online</span>
        </div>
        <div className="text-sm leading-snug" style={{ color: t.textMuted }}>AI assistant available 24/7 for orders, pricing, refunds, and general questions.</div>
      </div>
      <div className="h-px mb-4" style={{ background: t.sidebarBorder }} />
      <div className="text-[13px] font-semibold uppercase tracking-[1.5px] mb-3 pl-1" style={{ color: t.textMuted }}>Quick Help</div>
      <div className="flex flex-col gap-1 mb-4">
        {[["Check order status","📦"],["Refund policy","💰"],["Pricing info","💎"],["API docs","⚡"]].map(([label,icon])=>
          <div key={label} className="flex items-center gap-2 py-2 px-2.5 rounded-lg text-[13px]" style={{ background: dark ? "rgba(255,255,255,0.02)" : "rgba(0,0,0,0.02)", color: t.textSoft || t.textMuted }}><span>{icon}</span>{label}</div>
        )}
      </div>
      <div className="h-px mb-4" style={{ background: t.sidebarBorder }} />
      <div className="text-[13px] font-semibold uppercase tracking-[1.5px] mb-3 pl-1" style={{ color: t.textMuted }}>Contact Us</div>
      <div className="p-3.5 rounded-[10px]" style={{ background: t.cardBg, border: `0.5px solid ${t.cardBorder}` }}>
        {[["Email",SITE.email.general],["Instagram","@Nitro.ng"],["Twitter/X","@TheNitroNG"], ...(telegramSupport ? [["Telegram", "Chat with us"]] : [])].map(([label,val])=>
          <div key={label} className="flex justify-between py-1.5 text-sm"><span style={{ color: t.textMuted }}>{label}</span>{label === "Telegram" ? <a href={telegramSupport} target="_blank" rel="noopener noreferrer" className="font-medium no-underline" style={{ color: t.accent }}>{val}</a> : <span className="font-medium" style={{ color: t.accent }}>{val}</span>}</div>
        )}
      </div>
    </>
  );
}
