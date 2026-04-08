'use client';
import { useState, useEffect, useRef } from "react";
import { fD } from "../lib/format";

const CATEGORIES = ["Order Issue", "Payment", "Refund", "Account", "Other"];

const BOT_RESPONSES = {
  check_order: { text: "To check your order status, go to **History** in your dashboard. Each order shows its current status. You can also tap **Check** on any order to refresh from the provider.", followUp: "What do the statuses mean?" },
  refund: { text: "Nitro offers refunds for:\n\n• **Undelivered orders** — auto-refunded after 72 hours\n• **Partial delivery** — refunded for undelivered portion\n• **Wrong service** — full refund to wallet\n\nRefunds go to your Nitro wallet within 5 minutes.", followUp: null },
  pricing: { text: "Nitro offers 3 tiers:\n\n• **Budget** — cheapest, may drop slightly\n• **Standard** — best value, stable with refill\n• **Premium** — top quality, lifetime guarantee\n\nPrices start at ₦3 per 1,000. Check the **Services** page for current rates.", followUp: null },
  referrals: { text: "Share your referral link with friends. When they sign up and deposit, you both earn a bonus! Check the **Referrals** section in your dashboard.", followUp: null },
  api: { text: "To use the Nitro API:\n\n1. Go to **Settings** → create your API key\n2. Your key starts with `ntro_sk_`\n3. Check the **Guide** page for full documentation", followUp: null },
  status_explain: { text: "• **Pending** — order received, waiting to start\n• **Processing** — actively being delivered\n• **Completed** — fully delivered\n• **Partial** — only some delivered (auto-refund for rest)\n• **Cancelled** — cancelled, funds refunded to wallet", followUp: null },
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

function StatusPill({ status, dark }) {
  const c = status === "Open" ? { bg: dark ? "rgba(234,179,8,0.1)" : "rgba(234,179,8,0.08)", color: dark ? "#fcd34d" : "#d97706", border: dark ? "rgba(234,179,8,0.2)" : "rgba(234,179,8,0.15)" }
    : status === "In Progress" ? { bg: dark ? "rgba(59,130,246,0.08)" : "rgba(59,130,246,0.06)", color: dark ? "#60a5fa" : "#2563eb", border: dark ? "rgba(59,130,246,0.12)" : "rgba(59,130,246,0.1)" }
    : { bg: dark ? "rgba(16,185,129,0.08)" : "rgba(16,185,129,0.06)", color: dark ? "#6ee7b7" : "#059669", border: dark ? "rgba(16,185,129,0.12)" : "rgba(16,185,129,0.1)" };
  return <span className="m" style={{ fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 4, background: c.bg, color: c.color, border: `1px solid ${c.border}` }}>{status.toLowerCase()}</span>;
}

function FormatText({ text, t }) {
  const parts = text.split(/(\*\*[^*]+\*\*|\`[^`]+\`|\n)/g);
  return <>{parts.map((p, i) => {
    if (p === "\n") return <br key={i} />;
    if (p.startsWith("**") && p.endsWith("**")) return <strong key={i} style={{ fontWeight: 600, color: t.text }}>{p.slice(2, -2)}</strong>;
    if (p.startsWith("`") && p.endsWith("`")) return <code key={i} style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, background: dark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)", padding: "1px 5px", borderRadius: 3 }}>{p.slice(1, -1)}</code>;
    return <span key={i}>{p}</span>;
  })}</>;
}

function ChatBubble({ m, dark, t }) {
  if (m.from === "system") {
    return (
      <div style={{ textAlign: "center", padding: "6px 0" }}>
        <span style={{ fontSize: 11, color: t.textMuted, background: dark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.03)", padding: "4px 12px", borderRadius: 10 }}>{m.text}</span>
      </div>
    );
  }
  const isUser = m.from === "user";
  const isBot = m.from === "bot";
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: isUser ? "flex-end" : "flex-start" }}>
      <div style={{
        maxWidth: "82%", padding: "10px 14px", borderRadius: 14,
        borderBottomRightRadius: isUser ? 4 : 14,
        borderBottomLeftRadius: !isUser ? 4 : 14,
        background: isUser ? (dark ? "rgba(196,125,142,0.12)" : "rgba(196,125,142,0.08)") : (dark ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.9)"),
        border: isUser ? `1px solid ${dark ? "rgba(196,125,142,0.1)" : "rgba(196,125,142,0.12)"}` : `1px solid ${dark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)"}`,
      }}>
        {!isUser && <div style={{ fontSize: 11, fontWeight: 600, color: isBot ? (dark ? "#6ee7b7" : "#059669") : (dark ? "#60a5fa" : "#2563eb"), marginBottom: 3 }}>{m.name || (isBot ? "Nitro Bot" : "Support")}</div>}
        <div style={{ fontSize: 13, color: t.textSoft || t.text, lineHeight: 1.6, whiteSpace: "pre-line" }}>{m.formatted ? <FormatText text={m.text} t={t} /> : m.text}</div>
      </div>
      {m.time && <div style={{ fontSize: 10, color: t.textMuted, marginTop: 3, padding: "0 6px" }}>{m.time.includes("T") ? fD(m.time) : m.time}</div>}
    </div>
  );
}

/* ═══════════════════════════════════════════ */
/* ═══ SUPPORT PAGE — WhatsApp Style        ═══ */
/* ═══════════════════════════════════════════ */
export default function SupportPage({ dark, t }) {
  const [screen, setScreen] = useState("chat");
  const [tickets, setTickets] = useState([]);
  const [activeTicket, setActiveTicket] = useState(null);
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

  const msgsEnd = useRef(null);
  const ticketMsgsEnd = useRef(null);
  const waitRef = useRef(null);
  const waitCountRef = useRef(0);

  const scrollToBottom = () => setTimeout(() => msgsEnd.current?.scrollIntoView({ behavior: "smooth" }), 50);
  const scrollTicketToBottom = () => setTimeout(() => ticketMsgsEnd.current?.scrollIntoView({ behavior: "smooth" }), 50);
  useEffect(scrollToBottom, [msgs, typing]);
  useEffect(scrollTicketToBottom, [activeTicket]);

  const refreshTickets = () => {
    fetch("/api/tickets").then(r => r.json()).then(d => {
      if (d.tickets) {
        setTickets(d.tickets);
        if (activeTicket) {
          const updated = d.tickets.find(tk => tk.id === activeTicket.id);
          if (updated) setActiveTicket(updated);
        }
      }
    }).catch(() => {});
  };
  useEffect(() => { refreshTickets(); }, []);
  useEffect(() => {
    let iv = null;
    const start = () => { iv = setInterval(refreshTickets, 12000); };
    const stop = () => { clearInterval(iv); iv = null; };
    const onVis = () => { document.hidden ? stop() : (refreshTickets(), start()); };
    start();
    document.addEventListener("visibilitychange", onVis);
    return () => { stop(); document.removeEventListener("visibilitychange", onVis); };
  }, [activeTicket?.id]);

  // Reassurance messages while waiting for agent
  useEffect(() => {
    if (!waitingForAgent) { clearInterval(waitRef.current); waitCountRef.current = 0; return; }
    waitRef.current = setInterval(() => {
      if (waitCountRef.current >= REASSURANCE.length) { clearInterval(waitRef.current); return; }
      setMsgs(prev => [...prev, { from: "bot", name: "Nitro Bot", text: REASSURANCE[waitCountRef.current], time: "Now" }]);
      waitCountRef.current++;
    }, 30000);
    return () => clearInterval(waitRef.current);
  }, [waitingForAgent]);

  // Poll for agent reply when waiting
  useEffect(() => {
    if (!waitingForAgent) return;
    const iv = setInterval(() => {
      fetch("/api/tickets").then(r => r.json()).then(d => {
        if (!d.tickets) return;
        const latest = d.tickets.find(tk => tk.status === "In Progress");
        if (latest) {
          const adminReply = latest.messages?.filter(m => m.from === "admin");
          if (adminReply?.length) {
            setWaitingForAgent(false);
            const lastAdmin = adminReply[adminReply.length - 1];
            const agentName = lastAdmin.name || "Support";
            setMsgs(prev => [
              ...prev,
              { from: "system", text: `${agentName.replace(" - Nitro", "")} has joined the conversation` },
              { from: "support", name: agentName.includes(" - ") ? agentName : `${agentName} - Nitro`, text: lastAdmin.text, time: lastAdmin.time || "Now" },
            ]);
          }
        }
        setTickets(d.tickets);
      }).catch(() => {});
    }, 8000);
    return () => clearInterval(iv);
  }, [waitingForAgent]);

  const addMsg = (m) => setMsgs(prev => [...prev, m]);
  const botReply = (text, delay = 700, extra = {}) => {
    setTyping(true);
    setTimeout(() => {
      setTyping(false);
      addMsg({ from: "bot", name: "Nitro Bot", text, time: "Now", formatted: true, ...extra });
    }, delay + Math.random() * 300);
  };

  const activeCount = tickets.filter(tk => tk.status !== "Resolved").length;

  const handleQuick = (id) => {
    setShowQuick(false);
    const label = QUICK_ACTIONS.find(a => a.id === id)?.label || id;
    addMsg({ from: "user", text: label, time: "Now" });

    if (id === "human") {
      setTyping(true);
      setTimeout(() => {
        setTyping(false);
        addMsg({ from: "system", text: "Connecting you with support..." });
        setTimeout(async () => {
          const chatContext = msgs.filter(m => m.from === "user").map(m => m.text).join(" | ");
          const subject = chatContext.length > 5 ? chatContext.slice(0, 80) : "Support request";
          try {
            await fetch("/api/tickets", {
              method: "POST", headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ action: "create", subject, message: chatContext || "User requested live support", category: "General" })
            });
            refreshTickets();
          } catch {}
          setIsLive(true);
          setWaitingForAgent(true);
          addMsg({ from: "system", text: "You're now chatting with Nitro Support. An agent will respond shortly." });
        }, 600);
      }, 600);
      return;
    }

    const resp = BOT_RESPONSES[id];
    if (!resp) return;
    botReply(resp.text, 600, resp.followUp ? { followUp: resp.followUp } : {});
    setTimeout(() => setShowQuick(true), 1500);
  };

  const handleFollowUp = (q) => {
    addMsg({ from: "user", text: q, time: "Now" });
    setShowQuick(false);
    const resp = BOT_RESPONSES["status_explain"];
    botReply(resp?.text || "Let me connect you with support.", 700);
    setTimeout(() => setShowQuick(true), 1500);
  };

  const sendMsg = () => {
    if (!input.trim()) return;
    const txt = input.trim();
    addMsg({ from: "user", text: txt, time: "Now" });
    setInput("");

    if (isLive) {
      const latestTicket = tickets.find(tk => tk.status === "Open" || tk.status === "In Progress");
      if (latestTicket) {
        fetch("/api/tickets", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "reply", ticketId: latestTicket.id, message: txt }) }).catch(() => {});
      }
      return;
    }

    setShowQuick(false);
    const lower = txt.toLowerCase();
    if (lower.includes("order") && (lower.includes("status") || lower.includes("check"))) {
      botReply(BOT_RESPONSES.check_order.text, 700, { followUp: BOT_RESPONSES.check_order.followUp });
      setTimeout(() => setShowQuick(true), 1500);
    } else if (lower.includes("refund") || lower.includes("money back")) {
      botReply(BOT_RESPONSES.refund.text, 700);
      setTimeout(() => setShowQuick(true), 1500);
    } else if (lower.includes("price") || lower.includes("cost") || lower.includes("how much")) {
      botReply(BOT_RESPONSES.pricing.text, 700);
      setTimeout(() => setShowQuick(true), 1500);
    } else if (lower.includes("human") || lower.includes("agent") || lower.includes("support") || lower.includes("person") || lower.includes("talk to")) {
      handleQuick("human");
    } else {
      botReply("I'm not sure about that. Would you like to speak with our support team? They can see this conversation and pick up where we left off.", 800, { escalatePrompt: true });
    }
  };

  const sendTicketReply = async () => {
    if (!input.trim() || !activeTicket) return;
    setTicketLoading(true);
    try {
      const res = await fetch("/api/tickets", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "reply", ticketId: activeTicket.id, message: input.trim() }) });
      if (res.ok) { setInput(""); refreshTickets(); }
    } catch {}
    setTicketLoading(false);
  };

  const openTicket = (tk) => { setActiveTicket(tk); setScreen("ticket-detail"); setInput(""); };
  const filtered = filter === "all" ? tickets : tickets.filter(tk => tk.status === filter);

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, overflow: "hidden" }}>

      {/* ═══ MAIN CHAT ═══ */}
      {screen === "chat" && <>
        <div style={{ padding: "0 0 10px", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
          <div>
            <div style={{ fontSize: 20, fontWeight: 700, color: t.text, display: "flex", alignItems: "center", gap: 8 }}>
              Support
              {isLive && <span className="m" style={{ fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 4, background: dark ? "rgba(96,165,250,0.1)" : "rgba(59,130,246,0.06)", color: dark ? "#60a5fa" : "#2563eb", border: `1px solid ${dark ? "rgba(96,165,250,0.15)" : "rgba(59,130,246,0.1)"}` }}>live</span>}
            </div>
            <div style={{ fontSize: 13, color: t.textMuted }}>{isLive ? (waitingForAgent ? "Waiting for an agent..." : "Connected with support") : "Ask anything or talk to support"}</div>
          </div>
          <button onClick={() => setScreen("tickets")} style={{ position: "relative", padding: "7px 14px", borderRadius: 8, background: dark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)", border: `1px solid ${dark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)"}`, color: t.textSoft, fontSize: 12, fontWeight: 500, cursor: "pointer", fontFamily: "inherit" }}>
            My tickets
            {activeCount > 0 && <span style={{ position: "absolute", top: -5, right: -5, width: 17, height: 17, borderRadius: 9, background: t.accent, color: "#fff", fontSize: 9, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>{activeCount}</span>}
          </button>
        </div>

        <div style={{ flex: 1, overflowY: "auto", minHeight: 0, padding: "12px 0", display: "flex", flexDirection: "column", gap: 6, borderTop: `1px solid ${dark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)"}`, borderBottom: `1px solid ${dark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)"}` }}>
          <div style={{ flex: 1 }} />
          {msgs.map((m, i) => (
            <div key={i}>
              <ChatBubble m={m} dark={dark} t={t} />
              {m.followUp && <div style={{ marginTop: 6, paddingLeft: 4 }}><button onClick={() => handleFollowUp(m.followUp)} style={{ padding: "6px 12px", borderRadius: 8, fontSize: 11, background: dark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.02)", border: `1px solid ${dark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)"}`, color: t.textSoft, cursor: "pointer", fontFamily: "inherit" }}>{m.followUp}</button></div>}
              {m.escalatePrompt && <div style={{ display: "flex", gap: 6, marginTop: 6, paddingLeft: 4 }}>
                <button onClick={() => handleQuick("human")} style={{ padding: "6px 12px", borderRadius: 8, fontSize: 11, background: dark ? "rgba(196,125,142,0.08)" : "rgba(196,125,142,0.05)", border: `1px solid ${dark ? "rgba(196,125,142,0.15)" : "rgba(196,125,142,0.1)"}`, color: t.accent, cursor: "pointer", fontFamily: "inherit", fontWeight: 500 }}>Yes, connect me</button>
                <button onClick={() => setShowQuick(true)} style={{ padding: "6px 12px", borderRadius: 8, fontSize: 11, background: dark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.02)", border: `1px solid ${dark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)"}`, color: t.textMuted, cursor: "pointer", fontFamily: "inherit" }}>Ask something else</button>
              </div>}
            </div>
          ))}
          {typing && <div style={{ alignSelf: "flex-start", padding: "10px 18px", borderRadius: 14, borderBottomLeftRadius: 4, background: dark ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.9)", border: `1px solid ${dark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)"}` }}><div style={{ display: "flex", gap: 4 }}>{[0,1,2].map(j=><div key={j} className="sup-typing-dot" style={{ width:6,height:6,borderRadius:3,background:t.textMuted,animationDelay:`${j*.15}s` }}/>)}</div></div>}
          <div ref={msgsEnd} />
        </div>

        {showQuick && !isLive && <div style={{ padding: "8px 0 4px", display: "flex", gap: 6, flexWrap: "wrap", flexShrink: 0 }}>
          {QUICK_ACTIONS.map(a => <button key={a.id} onClick={() => handleQuick(a.id)} className="sup-quick-btn" style={{ padding: "7px 12px", borderRadius: 8, fontSize: 11, background: a.id === "human" ? (dark ? "rgba(196,125,142,0.06)" : "rgba(196,125,142,0.04)") : (dark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.02)"), borderWidth: 1, borderStyle: "solid", borderColor: a.id === "human" ? (dark ? "rgba(196,125,142,0.15)" : "rgba(196,125,142,0.1)") : (dark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)"), color: a.id === "human" ? t.accent : t.textSoft, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 5, fontWeight: a.id === "human" ? 550 : 400 }}><span style={{ fontSize: 13 }}>{a.icon}</span>{a.label}</button>)}
        </div>}

        <div style={{ padding: "8px 0 0", display: "flex", gap: 8, alignItems: "center", flexShrink: 0 }}>
          <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === "Enter" && sendMsg()} placeholder={waitingForAgent ? "Add details while you wait..." : isLive ? "Message support..." : "Ask a question..."} style={{ flex: 1, padding: "10px 16px", borderRadius: 20, background: dark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)", border: `1px solid ${dark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)"}`, color: t.text, fontSize: 13, outline: "none", fontFamily: "inherit" }} />
          <button onClick={sendMsg} style={{ width: 38, height: 38, borderRadius: "50%", background: input.trim() ? "linear-gradient(135deg,#c47d8e,#a3586b)" : (dark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)"), border: "none", cursor: input.trim() ? "pointer" : "default", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={input.trim() ? "#fff" : t.textMuted} strokeWidth="2" strokeLinecap="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
          </button>
        </div>
      </>}

      {/* ═══ TICKET LIST ═══ */}
      {screen === "tickets" && <>
        <div style={{ padding: "0 0 10px", display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
          <button onClick={() => setScreen("chat")} style={{ background: "none", border: "none", color: t.textMuted, cursor: "pointer", padding: 4, display: "flex" }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6"/></svg>
          </button>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: t.text }}>My tickets</div>
            <div style={{ fontSize: 12, color: t.textMuted }}>{activeCount} active</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 4, marginBottom: 12, flexShrink: 0 }}>
          {[["all","All"],["Open","Open"],["In Progress","Active"],["Resolved","Resolved"]].map(([v,l])=>
            <button key={v} onClick={()=>setFilter(v)} style={{ padding:"5px 12px",borderRadius:6,fontSize:11,fontWeight:filter===v?600:450,background:filter===v?(dark?"rgba(196,125,142,0.1)":"rgba(196,125,142,0.06)"):"transparent",color:filter===v?t.accent:t.textMuted,border:"none",cursor:"pointer" }}>{l}</button>
          )}
        </div>
        <div style={{ flex: 1, overflowY: "auto", minHeight: 0, borderRadius: 12, border: `1px solid ${dark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)"}`, overflow: "hidden auto" }}>
          {filtered.length === 0 && <div style={{ padding: 40, textAlign: "center", color: t.textMuted, fontSize: 13 }}>No tickets yet</div>}
          {filtered.map((tk,i) => {
            const last = tk.messages?.[tk.messages.length - 1];
            const sender = last?.from === "user" ? "You" : (last?.name?.split(" - ")?.[0] || "Support");
            return (
              <div key={tk.id} onClick={() => openTicket(tk)} className="sup-tkt-row" style={{ padding: "14px 16px", borderBottom: i < filtered.length - 1 ? `1px solid ${dark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)"}` : "none", cursor: "pointer", display: "flex", alignItems: "flex-start", gap: 12 }}>
                <div style={{ width: 36, height: 36, borderRadius: "50%", background: dark ? "rgba(196,125,142,0.08)" : "rgba(196,125,142,0.05)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, border: `1px solid ${dark ? "rgba(196,125,142,0.1)" : "rgba(196,125,142,0.08)"}` }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: t.accent }}>N</span>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 3 }}>
                    <span style={{ fontSize: 13, fontWeight: 550, color: t.text }}>{tk.subject}</span>
                    <span style={{ fontSize: 10, color: t.textMuted, flexShrink: 0 }}>{tk.created ? fD(tk.created) : ""}</span>
                  </div>
                  <div style={{ marginBottom: 4 }}><StatusPill status={tk.status} dark={dark} /></div>
                  {last && <div style={{ fontSize: 12, color: t.textMuted, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    <span style={{ fontWeight: 500, color: last.from === "user" ? (dark ? "rgba(196,125,142,0.7)" : "rgba(196,125,142,0.8)") : (dark ? "rgba(110,231,183,0.7)" : "rgba(5,150,105,0.7)") }}>{sender}: </span>{last.text?.split("\n")[0]?.slice(0,60)}
                  </div>}
                </div>
              </div>
            );
          })}
        </div>
      </>}

      {/* ═══ TICKET DETAIL ═══ */}
      {screen === "ticket-detail" && activeTicket && <>
        <div style={{ padding: "0 0 10px", display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
          <button onClick={() => { setScreen("tickets"); setActiveTicket(null); setInput(""); }} style={{ background: "none", border: "none", color: t.textMuted, cursor: "pointer", padding: 4, display: "flex" }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6"/></svg>
          </button>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: t.text, display: "flex", alignItems: "center", gap: 8 }}>{activeTicket.subject} <StatusPill status={activeTicket.status} dark={dark} /></div>
            <div className="m" style={{ fontSize: 11, color: t.textMuted }}>{activeTicket.id}</div>
          </div>
        </div>
        <div style={{ flex: 1, overflowY: "auto", minHeight: 0, padding: "8px 0", display: "flex", flexDirection: "column", gap: 6, borderTop: `1px solid ${dark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)"}`, borderBottom: `1px solid ${dark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)"}` }}>
          <div style={{ flex: 1 }} />
          {(activeTicket.messages || []).map((m, i) => (
            <ChatBubble key={i} m={{ ...m, from: m.from === "admin" ? "support" : m.from, name: m.from === "admin" ? (m.name || "Support") : m.from === "user" ? undefined : m.name }} dark={dark} t={t} />
          ))}
          <div ref={ticketMsgsEnd} />
        </div>
        {(activeTicket.status === "Open" || activeTicket.status === "In Progress") ? (
          <div style={{ padding: "8px 0 0", display: "flex", gap: 8, alignItems: "center", flexShrink: 0 }}>
            <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === "Enter" && sendTicketReply()} placeholder="Type a message..." style={{ flex: 1, padding: "10px 16px", borderRadius: 20, background: dark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)", border: `1px solid ${dark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)"}`, color: t.text, fontSize: 13, outline: "none", fontFamily: "inherit" }} />
            <button onClick={sendTicketReply} disabled={ticketLoading} style={{ width: 38, height: 38, borderRadius: "50%", background: input.trim() ? "linear-gradient(135deg,#c47d8e,#a3586b)" : (dark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)"), border: "none", cursor: input.trim() ? "pointer" : "default", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={input.trim() ? "#fff" : t.textMuted} strokeWidth="2" strokeLinecap="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
            </button>
          </div>
        ) : (
          <div style={{ padding: "12px 0 0", textAlign: "center", fontSize: 12, color: t.textMuted, flexShrink: 0 }}>This conversation has been resolved</div>
        )}
      </>}
    </div>
  );
}

/* ═══════════════════════════════════════════ */
/* ═══ SUPPORT RIGHT SIDEBAR               ═══ */
/* ═══════════════════════════════════════════ */
export function SupportSidebar({ dark, t, tickets }) {
  const tks = tickets || [];
  const openCount = tks.filter(tk => tk.status === "Open" || tk.status === "In Progress").length;
  return (
    <>
      <div className="sup-rs-title" style={{ color: t.textMuted }}>Nitro Bot</div>
      <div className="sup-rs-bot" style={{ background: t.cardBg, borderWidth: 1, borderStyle: "solid", borderColor: t.cardBorder }}>
        <div className="sup-rs-bot-status">
          <div className="sup-bot-dot" style={{ background: t.green }} />
          <span style={{ fontSize: 13, fontWeight: 600, color: t.green }}>Online</span>
        </div>
        <div style={{ fontSize: 13, color: t.textMuted, lineHeight: 1.4 }}>AI assistant available 24/7 for orders, pricing, refunds, and general questions.</div>
      </div>
      <div className="sup-rs-divider" style={{ background: t.sidebarBorder }} />
      <div className="sup-rs-title" style={{ color: t.textMuted }}>Quick Help</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 16 }}>
        {[["Check order status","📦"],["Refund policy","💰"],["Pricing info","💎"],["API documentation","⚡"]].map(([label,icon])=>
          <div key={label} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", borderRadius: 8, background: dark ? "rgba(255,255,255,0.02)" : "rgba(0,0,0,0.02)", fontSize: 12, color: t.textSoft }}><span>{icon}</span>{label}</div>
        )}
      </div>
      <div className="sup-rs-divider" style={{ background: t.sidebarBorder }} />
      <div className="sup-rs-title" style={{ color: t.textMuted }}>Tickets</div>
      <div className="sup-rs-stats">
        {[["Active", String(openCount), dark ? "#60a5fa" : "#2563eb"], ["Total", String(tks.length), dark ? "#a5b4fc" : "#4f46e5"]].map(([label, val, color]) =>
          <div key={label} className="sup-rs-stat" style={{ background: t.cardBg }}><div className="sup-rs-stat-label" style={{ color: t.textMuted }}>{label}</div><div className="m sup-rs-stat-val" style={{ color }}>{val}</div></div>
        )}
      </div>
      <div className="sup-rs-divider" style={{ background: t.sidebarBorder }} />
      <div className="sup-rs-title" style={{ color: t.textMuted }}>Contact Us</div>
      <div className="sup-rs-contact" style={{ background: t.cardBg }}>
        {[["Email","TheNitroNG@gmail.com"],["Instagram","@Nitro.ng"],["Twitter/X","@TheNitroNG"]].map(([label,val])=>
          <div key={label} className="sup-rs-contact-row"><span style={{ color: t.textMuted }}>{label}</span><span style={{ color: t.accent, fontWeight: 500 }}>{val}</span></div>
        )}
      </div>
    </>
  );
}
