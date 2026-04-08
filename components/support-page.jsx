'use client';
import { useState, useEffect, useRef } from "react";
import { fD } from "../lib/format";

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
  if (!status) return null;
  const c = status === "Open" ? { bg: dark ? "rgba(234,179,8,0.1)" : "rgba(234,179,8,0.08)", color: dark ? "#fcd34d" : "#d97706" }
    : status === "In Progress" ? { bg: dark ? "rgba(59,130,246,0.08)" : "rgba(59,130,246,0.06)", color: dark ? "#60a5fa" : "#2563eb" }
    : { bg: dark ? "rgba(16,185,129,0.08)" : "rgba(16,185,129,0.06)", color: dark ? "#6ee7b7" : "#059669" };
  return <span className="m" style={{ fontSize: 10, fontWeight: 600, padding: "2px 7px", borderRadius: 4, background: c.bg, color: c.color }}>{status.toLowerCase()}</span>;
}

function FormatText({ text, dark }) {
  if (!text) return null;
  return <>{text.split(/(\*\*[^*]+\*\*|\`[^`]+\`|\n)/g).map((p, i) => {
    if (p === "\n") return <br key={i} />;
    if (p.startsWith("**") && p.endsWith("**")) return <strong key={i} style={{ fontWeight: 600 }}>{p.slice(2, -2)}</strong>;
    if (p.startsWith("`") && p.endsWith("`")) return <code key={i} style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, background: dark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)", padding: "1px 5px", borderRadius: 3 }}>{p.slice(1, -1)}</code>;
    return <span key={i}>{p}</span>;
  })}</>;
}

function Bubble({ m, dark, t }) {
  if (!m || !m.from) return null;
  if (m.from === "system") return <div style={{ textAlign: "center", padding: "6px 0" }}><span style={{ fontSize: 11, color: t.textMuted, background: dark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.03)", padding: "4px 12px", borderRadius: 10 }}>{m.text || ""}</span></div>;
  const isUser = m.from === "user";
  const isBot = m.from === "bot";
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: isUser ? "flex-end" : "flex-start" }}>
      <div style={{ maxWidth: "78%", padding: "10px 14px", borderRadius: 14, borderBottomRightRadius: isUser ? 4 : 14, borderBottomLeftRadius: !isUser ? 4 : 14, background: isUser ? (dark ? "rgba(196,125,142,0.12)" : "rgba(196,125,142,0.08)") : (dark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.03)"), border: `1px solid ${isUser ? (dark ? "rgba(196,125,142,0.1)" : "rgba(196,125,142,0.12)") : (dark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)")}` }}>
        {!isUser && <div style={{ fontSize: 12, fontWeight: 600, color: isBot ? (dark ? "#6ee7b7" : "#059669") : (dark ? "#60a5fa" : "#2563eb"), marginBottom: 3 }}>{m.name || (isBot ? "Nitro Bot" : "Support")}</div>}
        <div style={{ fontSize: 14, color: t.text, lineHeight: 1.6, whiteSpace: "pre-line" }}>{m.formatted ? <FormatText text={m.text || ""} dark={dark} /> : (m.text || "")}</div>
      </div>
      {m.time && <div style={{ fontSize: 10, color: t.textMuted, marginTop: 3, padding: "0 6px" }}>{typeof m.time === "string" && m.time.includes("T") ? fD(m.time) : (m.time || "")}</div>}
    </div>
  );
}

/* ═══════════════════════════════════════════ */
/* ═══ SUPPORT PAGE                        ═══ */
/* ═══════════════════════════════════════════ */
export default function SupportPage({ dark, t }) {
  const [tickets, setTickets] = useState([]);
  const [selected, setSelected] = useState(null); // null = bot chat, ticket object = ticket detail
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
  const [mobileView, setMobileView] = useState("chat"); // mobile only: "list" | "chat"

  const msgsEnd = useRef(null);
  const waitRef = useRef(null);
  const waitCountRef = useRef(0);

  const scrollToBottom = () => setTimeout(() => msgsEnd.current?.scrollIntoView({ behavior: "smooth" }), 50);
  useEffect(scrollToBottom, [msgs, typing]);

  // Load + poll tickets
  const refreshTickets = () => {
    fetch("/api/tickets").then(r => r.json()).then(d => {
      if (d.tickets) {
        setTickets(d.tickets);
        if (selected?.id && typeof selected === "object") {
          const u = d.tickets.find(tk => tk.id === selected.id);
          if (u && u.messages?.length !== selected.messages?.length) setSelected(u);
        }
      }
    }).catch(() => {});
  };
  useEffect(() => { refreshTickets(); }, []);
  useEffect(() => {
    let iv = setInterval(refreshTickets, 12000);
    const onVis = () => { if (!document.hidden) refreshTickets(); };
    document.addEventListener("visibilitychange", onVis);
    return () => { clearInterval(iv); document.removeEventListener("visibilitychange", onVis); };
  }, [selected?.id]);

  // Reassurance while waiting for agent
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
          const adminReply = latest.messages?.filter(m => m.from === "admin");
          if (adminReply?.length) {
            setWaitingForAgent(false);
            const last = adminReply[adminReply.length - 1];
            const name = last.name || "Support";
            setMsgs(prev => [...prev, { from: "system", text: `${name.replace(" - Nitro", "")} has joined the conversation` }, { from: "support", name: name.includes(" - ") ? name : `${name} - Nitro`, text: last.text, time: last.time || "Now" }]);
          }
        }
        setTickets(d.tickets);
      }).catch(() => {});
    }, 8000);
    return () => clearInterval(iv);
  }, [waitingForAgent]);

  const addMsg = (m) => setMsgs(prev => [...prev, m]);
  const botReply = (text, delay, extra = {}) => { setTyping(true); setTimeout(() => { setTyping(false); addMsg({ from: "bot", name: "Nitro Bot", text, time: "Now", formatted: true, ...extra }); }, delay + Math.random() * 300); };
  const activeCount = tickets.filter(tk => tk.status !== "Resolved").length;
  const filtered = filter === "all" ? tickets : filter === "active" ? tickets.filter(tk => tk.status === "Open" || tk.status === "In Progress") : tickets.filter(tk => tk.status === filter);

  const handleQuick = (id) => {
    setShowQuick(false);
    addMsg({ from: "user", text: QUICK_ACTIONS.find(a => a.id === id)?.label || id, time: "Now" });
    if (id === "human") {
      setTyping(true);
      setTimeout(() => { setTyping(false); addMsg({ from: "system", text: "Connecting you with support..." }); setTimeout(async () => {
        const ctx = msgs.filter(m => m.from === "user").map(m => m.text).join(" | ");
        try { await fetch("/api/tickets", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "create", subject: ctx.length > 5 ? ctx.slice(0, 80) : "Support request", message: ctx || "User requested live support", category: "General" }) }); refreshTickets(); } catch {}
        setIsLive(true); setWaitingForAgent(true); addMsg({ from: "system", text: "You're now chatting with Nitro Support. An agent will respond shortly." });
      }, 600); }, 600);
      return;
    }
    const resp = BOT_RESPONSES[id];
    if (resp) { botReply(resp.text, 600, resp.followUp ? { followUp: resp.followUp } : {}); setTimeout(() => setShowQuick(true), 1500); }
  };

  const handleFollowUp = (q) => { addMsg({ from: "user", text: q, time: "Now" }); setShowQuick(false); botReply(BOT_RESPONSES.status_explain?.text || "", 700); setTimeout(() => setShowQuick(true), 1500); };

  const sendMsg = () => {
    if (!input.trim()) return;
    const txt = input.trim(); setInput("");
    if (selected && selected !== "new" && typeof selected === "object") {
      // Ticket reply — update selected locally + send to API
      const newMsg = { from: "user", text: txt, time: "Now" };
      setSelected(prev => ({ ...prev, messages: [...(prev.messages || []), newMsg] }));
      fetch("/api/tickets", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "reply", ticketId: selected.id, message: txt }) }).then(() => refreshTickets()).catch(() => {});
      setTimeout(() => msgsEnd.current?.scrollIntoView({ behavior: "smooth" }), 100);
      return;
    }
    addMsg({ from: "user", text: txt, time: "Now" });
    if (isLive) { const tk = tickets.find(tk => tk.status === "Open" || tk.status === "In Progress"); if (tk) fetch("/api/tickets", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "reply", ticketId: tk.id, message: txt }) }).catch(() => {}); return; }
    setShowQuick(false);
    const lower = txt.toLowerCase();
    if (lower.includes("order") && (lower.includes("status") || lower.includes("check"))) { botReply(BOT_RESPONSES.check_order.text, 700, { followUp: BOT_RESPONSES.check_order.followUp }); setTimeout(() => setShowQuick(true), 1500); }
    else if (lower.includes("refund") || lower.includes("money back")) { botReply(BOT_RESPONSES.refund.text, 700); setTimeout(() => setShowQuick(true), 1500); }
    else if (lower.includes("price") || lower.includes("cost") || lower.includes("how much")) { botReply(BOT_RESPONSES.pricing.text, 700); setTimeout(() => setShowQuick(true), 1500); }
    else if (lower.includes("human") || lower.includes("agent") || lower.includes("support") || lower.includes("person") || lower.includes("talk to")) { handleQuick("human"); }
    else { botReply("I'm not sure about that. Would you like to speak with our support team? They can see this conversation and pick up where we left off.", 800, { escalatePrompt: true }); }
  };

  const selectTicket = (tk) => { setSelected(tk); setInput(""); setMobileView("chat"); };
  const backToBot = () => { setSelected(null); setInput(""); setMobileView("chat"); };

  const isNewTicket = selected === "new";
  let chatMsgs = msgs;
  try {
    chatMsgs = isNewTicket ? [] : (selected && typeof selected === "object") ? (selected.messages || []).map(m => ({ ...m, from: m.from === "admin" ? "support" : m.from, name: m.from === "admin" ? (m.name || "Support") : m.from === "user" ? undefined : m.name })) : msgs;
  } catch { chatMsgs = msgs; }
  const chatTitle = isNewTicket ? "New Ticket" : (selected && typeof selected === "object") ? selected.subject : "Support";
  const chatSub = isNewTicket ? "Describe your issue" : (selected && typeof selected === "object") ? selected.id : (isLive ? (waitingForAgent ? "Waiting for an agent..." : "Connected with support") : "Ask anything or talk to support");

  return (
    <div className={`sup-split ${mobileView === "chat" ? "sup-view-chat" : "sup-view-list"}`} style={{ borderRadius: 12, border: `1px solid ${dark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)"}` }}>

      {/* ═══ LEFT: TICKET LIST ═══ */}
      <div className="sup-split-list" style={{ width: 280, borderRight: `1px solid ${dark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)"}`, flexShrink: 0 }}>
        <div style={{ padding: "14px 16px", borderBottom: `1px solid ${dark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)"}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: t.text }}>Conversations</div>
            <div style={{ fontSize: 11, color: t.textMuted, marginTop: 2 }}>{activeCount} active</div>
          </div>
          {tickets.some(tk => tk.status === "Open" || tk.status === "In Progress")
            ? <span style={{ fontSize: 10, color: t.textMuted }}>Has open ticket</span>
            : <button onClick={() => { setSelected("new"); setMobileView("chat"); }} style={{ padding: "4px 10px", borderRadius: 6, background: "linear-gradient(135deg,#c47d8e,#a3586b)", color: "#fff", fontSize: 10, fontWeight: 600, border: "none", cursor: "pointer" }}>+ New</button>
          }
        </div>

        {/* Filters — always visible */}
        <div className="sup-filter-bar" style={{ gap: 3, padding: "6px 10px", borderBottom: `1px solid ${dark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)"}` }}>
          {[["all","All"],["active","Active"],["Resolved","Done"]].map(([v,l])=>
            <button key={v} onClick={()=>setFilter(v)} style={{ padding:"3px 8px",borderRadius:4,fontSize:10,fontWeight:filter===v?600:450,background:filter===v?(dark?"rgba(196,125,142,0.1)":"rgba(196,125,142,0.06)"):"transparent",color:filter===v?t.accent:t.textMuted,border:"none",cursor:"pointer",flexShrink:0,whiteSpace:"nowrap" }}>{l}</button>
          )}
        </div>

        {/* Scrollable list: bot chat + tickets */}
        <div style={{ flex: 1, overflowY: "auto", minHeight: 0 }}>
          {/* Bot chat item */}
          <div onClick={() => { setSelected(null); setMobileView("chat"); }} style={{ padding: "10px 14px", borderBottom: `1px solid ${dark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)"}`, cursor: "pointer", background: !selected ? (dark ? "rgba(196,125,142,0.04)" : "rgba(196,125,142,0.02)") : "transparent", borderLeft: !selected ? `2px solid ${t.accent}` : "2px solid transparent" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
              <div style={{ width: 5, height: 5, borderRadius: 3, background: dark ? "#6ee7b7" : "#059669", flexShrink: 0 }} />
              <span style={{ fontSize: 12, fontWeight: 550, color: t.text }}>Nitro Bot</span>
              {isLive && <span className="m" style={{ fontSize: 9, padding: "1px 5px", borderRadius: 3, background: dark ? "rgba(96,165,250,0.1)" : "rgba(59,130,246,0.06)", color: dark ? "#60a5fa" : "#2563eb" }}>live</span>}
            </div>
            <div style={{ fontSize: 11, color: t.textMuted, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", paddingLeft: 11 }}>{msgs[msgs.length - 1]?.text?.slice(0, 45)}</div>
          </div>

          {/* Ticket list */}
          {filtered.map(tk => {
            const last = tk.messages?.[tk.messages.length - 1];
            const sender = last?.from === "user" ? "You" : (last?.name?.split(" - ")?.[0] || "Support");
            const isSel = selected?.id === tk.id;
            const hasUnread = last?.from === "admin";
            return (
              <div key={tk.id} onClick={() => selectTicket(tk)} style={{ padding: "10px 14px", borderBottom: `1px solid ${dark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)"}`, cursor: "pointer", background: isSel ? (dark ? "rgba(196,125,142,0.04)" : "rgba(196,125,142,0.02)") : "transparent", borderLeft: isSel ? `2px solid ${t.accent}` : "2px solid transparent" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 2 }}>
                  <span style={{ fontSize: 12, fontWeight: 550, color: t.text }}>{tk.subject}</span>
                  <span style={{ fontSize: 10, color: t.textMuted }}>{tk.created ? fD(tk.created) : ""}</span>
                </div>
                {last && <div style={{ fontSize: 11, color: t.textMuted, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", marginBottom: 3 }}>
                  <span style={{ fontWeight: 500, color: last.from === "user" ? (dark ? "rgba(196,125,142,0.7)" : t.accent) : (dark ? "rgba(110,231,183,0.7)" : "#059669") }}>{sender}: </span>{last.text?.split("\n")[0]?.slice(0, 45)}
                </div>}
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <StatusPill status={tk.status} dark={dark} />
                  {hasUnread && <div style={{ width: 6, height: 6, borderRadius: 3, background: t.accent, flexShrink: 0 }} />}
                </div>
              </div>
            );
          })}
          {filtered.length === 0 && tickets.length > 0 && <div style={{ padding: 20, textAlign: "center", color: t.textMuted, fontSize: 11 }}>No matches</div>}
        </div>
      </div>

      {/* ═══ RIGHT: CHAT ═══ */}
      <div className="sup-split-chat">
        {/* Header */}
        <div style={{ padding: "12px 18px", borderBottom: `1px solid ${dark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)"}`, display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
          <button className="sup-mobile-back" onClick={() => setMobileView("list")} style={{ background: "none", border: "none", color: t.textMuted, cursor: "pointer", padding: 4, display: "none" }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6"/></svg>
          </button>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: t.text, display: "flex", alignItems: "center", gap: 8 }}>
              {chatTitle}
              {selected && !isNewTicket && typeof selected === "object" && <StatusPill status={selected.status} dark={dark} />}
              {!selected && isLive && <span className="m" style={{ fontSize: 10, padding: "2px 7px", borderRadius: 4, background: dark ? "rgba(96,165,250,0.1)" : "rgba(59,130,246,0.06)", color: dark ? "#60a5fa" : "#2563eb" }}>live</span>}
            </div>
            <div className="m" style={{ fontSize: 11, color: t.textMuted, marginTop: 1 }}>{chatSub}</div>
          </div>
          {selected && !isNewTicket && typeof selected === "object" && (selected.status === "Open" || selected.status === "In Progress") && (
            <button onClick={async () => { await fetch("/api/tickets", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "close", ticketId: selected.id }) }); refreshTickets(); setSelected(null); }} style={{ padding: "5px 12px", borderRadius: 6, fontSize: 11, fontWeight: 500, background: "none", border: `1px solid ${dark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)"}`, color: t.textMuted, cursor: "pointer", fontFamily: "inherit", flexShrink: 0 }}>Close</button>
          )}
        </div>

        {/* Messages or New Ticket Form */}
        {isNewTicket ? (
          <div style={{ flex: 1, overflowY: "auto", minHeight: 0, padding: "20px 18px", display: "flex", flexDirection: "column", gap: 0 }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: t.textMuted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Category</label>
            <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 18 }}>
              {["Order Issue","Payment","Refund","Account","Other"].map(c =>
                <button key={c} onClick={() => setNewCat(c)} style={{ padding: "5px 12px", borderRadius: 7, fontSize: 11, fontWeight: newCat === c ? 600 : 450, background: newCat === c ? (dark ? "rgba(196,125,142,0.1)" : "rgba(196,125,142,0.06)") : (dark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.02)"), border: `1px solid ${newCat === c ? (dark ? "rgba(196,125,142,0.2)" : "rgba(196,125,142,0.12)") : (dark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)")}`, color: newCat === c ? t.accent : t.textMuted, cursor: "pointer", fontFamily: "inherit" }}>{c}</button>
              )}
            </div>
            <label style={{ fontSize: 11, fontWeight: 600, color: t.textMuted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>Subject</label>
            <input value={newSubject} onChange={e => setNewSubject(e.target.value)} placeholder="Brief description of your issue" style={{ width: "100%", padding: "10px 14px", borderRadius: 10, background: dark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)", border: `1px solid ${dark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)"}`, color: t.text, fontSize: 13, outline: "none", marginBottom: 16, fontFamily: "inherit", boxSizing: "border-box" }} />
            <label style={{ fontSize: 11, fontWeight: 600, color: t.textMuted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>Message</label>
            <textarea value={newMessage} onChange={e => setNewMessage(e.target.value)} placeholder="Describe your issue. Include order IDs if relevant." rows={5} style={{ width: "100%", padding: "10px 14px", borderRadius: 10, background: dark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)", border: `1px solid ${dark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)"}`, color: t.text, fontSize: 13, outline: "none", fontFamily: "inherit", resize: "vertical", lineHeight: 1.5, boxSizing: "border-box" }} />
          </div>
        ) : (
          <>
            <div style={{ flex: 1, overflowY: "auto", minHeight: 0, padding: "12px 18px", display: "flex", flexDirection: "column", gap: 6 }}>
              <div style={{ flex: 1 }} />
              {chatMsgs.map((m, i) => (
                <div key={i}>
                  <Bubble m={m} dark={dark} t={t} />
                  {m.followUp && <div style={{ marginTop: 6, paddingLeft: 4 }}><button onClick={() => handleFollowUp(m.followUp)} style={{ padding: "6px 12px", borderRadius: 8, fontSize: 11, background: dark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.02)", border: `1px solid ${dark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)"}`, color: t.textSoft, cursor: "pointer", fontFamily: "inherit" }}>{m.followUp}</button></div>}
                  {m.escalatePrompt && <div style={{ display: "flex", gap: 6, marginTop: 6, paddingLeft: 4 }}>
                    <button onClick={() => handleQuick("human")} style={{ padding: "6px 12px", borderRadius: 8, fontSize: 11, background: dark ? "rgba(196,125,142,0.08)" : "rgba(196,125,142,0.05)", border: `1px solid ${dark ? "rgba(196,125,142,0.15)" : "rgba(196,125,142,0.1)"}`, color: t.accent, cursor: "pointer", fontFamily: "inherit", fontWeight: 500 }}>Yes, connect me</button>
                    <button onClick={() => setShowQuick(true)} style={{ padding: "6px 12px", borderRadius: 8, fontSize: 11, background: dark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.02)", border: `1px solid ${dark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)"}`, color: t.textMuted, cursor: "pointer", fontFamily: "inherit" }}>Ask something else</button>
                  </div>}
                </div>
              ))}
              {typing && <div style={{ alignSelf: "flex-start", padding: "10px 18px", borderRadius: 14, borderBottomLeftRadius: 4, background: dark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.03)", border: `1px solid ${dark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)"}` }}><div style={{ display: "flex", gap: 4 }}>{[0,1,2].map(j=><div key={j} className="sup-typing-dot" style={{ width:6,height:6,borderRadius:3,background:t.textMuted,animationDelay:`${j*.15}s` }}/>)}</div></div>}
              <div ref={msgsEnd} />
            </div>

            {/* Quick actions — only for bot chat */}
            {!selected && showQuick && !isLive && <div style={{ padding: "6px 16px", display: "flex", gap: 5, flexWrap: "wrap", flexShrink: 0, borderTop: `1px solid ${dark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)"}` }}>
              {QUICK_ACTIONS.map(a => <button key={a.id} onClick={() => handleQuick(a.id)} className="sup-quick-btn" style={{ padding: "6px 10px", borderRadius: 7, fontSize: 11, background: a.id === "human" ? (dark ? "rgba(196,125,142,0.06)" : "rgba(196,125,142,0.04)") : (dark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.02)"), borderWidth: 1, borderStyle: "solid", borderColor: a.id === "human" ? (dark ? "rgba(196,125,142,0.15)" : "rgba(196,125,142,0.1)") : (dark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)"), color: a.id === "human" ? t.accent : t.textSoft, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 4, fontWeight: a.id === "human" ? 550 : 400 }}><span style={{ fontSize: 12 }}>{a.icon}</span>{a.label}</button>)}
            </div>}
          </>
        )}

        {/* Input / Submit — pinned at bottom */}
        {isNewTicket ? (
          <div style={{ padding: "10px 16px", borderTop: `1px solid ${dark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)"}`, flexShrink: 0 }}>
            <button onClick={async () => {
              if (!newSubject.trim() || !newMessage.trim()) return;
              setTicketLoading(true);
              try {
                const res = await fetch("/api/tickets", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "create", subject: newSubject, message: newMessage, category: newCat }) });
                if (res.ok) { setNewSubject(""); setNewMessage(""); setNewCat("Order Issue"); refreshTickets(); const d = await res.json(); if (d.ticket) { refreshTickets(); setTimeout(() => { const tk = tickets.find(t2 => t2.id === d.ticket.id); if (tk) setSelected(tk); else setSelected(null); }, 500); } else { setSelected(null); } }
              } catch {}
              setTicketLoading(false);
            }} disabled={!newSubject.trim() || !newMessage.trim() || ticketLoading} style={{ width: "100%", padding: "11px", borderRadius: 10, background: newSubject.trim() && newMessage.trim() ? "linear-gradient(135deg,#c47d8e,#a3586b)" : (dark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)"), color: newSubject.trim() && newMessage.trim() ? "#fff" : t.textMuted, fontSize: 13, fontWeight: 600, border: "none", cursor: newSubject.trim() && newMessage.trim() ? "pointer" : "default", fontFamily: "inherit" }}>{ticketLoading ? "Creating..." : "Create Ticket"}</button>
          </div>
        ) : (!selected || (typeof selected === "object" && (selected.status === "Open" || selected.status === "In Progress"))) ? (
          <div style={{ padding: "10px 16px", borderTop: `1px solid ${dark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)"}`, display: "flex", gap: 8, alignItems: "center", flexShrink: 0 }}>
            <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === "Enter" && sendMsg()} placeholder={selected ? "Type a message..." : (waitingForAgent ? "Add details while you wait..." : isLive ? "Message support..." : "Ask a question...")} style={{ flex: 1, padding: "10px 16px", borderRadius: 20, background: dark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)", border: `1px solid ${dark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)"}`, color: t.text, fontSize: 13, outline: "none", fontFamily: "inherit" }} />
            <button onClick={sendMsg} style={{ width: 38, height: 38, borderRadius: "50%", background: input.trim() ? "linear-gradient(135deg,#c47d8e,#a3586b)" : (dark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)"), border: "none", cursor: input.trim() ? "pointer" : "default", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={input.trim() ? "#fff" : t.textMuted} strokeWidth="2" strokeLinecap="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
            </button>
          </div>
        ) : (typeof selected === "object" && selected?.status === "Resolved") ? (
          <div style={{ padding: "12px 18px", borderTop: `1px solid ${dark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)"}`, textAlign: "center", fontSize: 12, color: t.textMuted, flexShrink: 0 }}>This conversation has been resolved</div>
        ) : null}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════ */
/* ═══ SUPPORT RIGHT SIDEBAR               ═══ */
/* ═══════════════════════════════════════════ */
export function SupportSidebar({ dark, t }) {
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
        {[["Check order status","📦"],["Refund policy","💰"],["Pricing info","💎"],["API docs","⚡"]].map(([label,icon])=>
          <div key={label} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", borderRadius: 8, background: dark ? "rgba(255,255,255,0.02)" : "rgba(0,0,0,0.02)", fontSize: 12, color: t.textSoft }}><span>{icon}</span>{label}</div>
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
