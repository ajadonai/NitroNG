'use client';
import { useState, useEffect, useRef } from "react";

const fN = (a) => `₦${Math.abs(a).toLocaleString("en-NG")}`;

function statusClr(s, dk) { return s === "Open" ? (dk ? "#fcd34d" : "#d97706") : s === "Resolved" ? (dk ? "#6ee7b7" : "#059669") : (dk ? "#888" : "#666"); }
function statusBg(s, dk) { return s === "Open" ? (dk ? "#1c1608" : "#fffbeb") : s === "Resolved" ? (dk ? "#0a2416" : "#ecfdf5") : (dk ? "#1a1a1a" : "#f5f5f5"); }
function statusBrd(s, dk) { return s === "Open" ? (dk ? "#92400e" : "#fde68a") : s === "Resolved" ? (dk ? "#166534" : "#a7f3d0") : (dk ? "#404040" : "#d4d4d4"); }

const CATEGORIES = ["Order Issue", "Refund", "Payment", "Account", "General"];
const BOT_QUICK = [
  { label: "Check order status", icon: "📦" },
  { label: "Request a refund", icon: "💰" },
  { label: "Pricing & services", icon: "💎" },
  { label: "How referrals work", icon: "🤝" },
  { label: "Talk to a human", icon: "👤" },
];

/* ═══════════════════════════════════════════ */
/* ═══ SUPPORT PAGE                        ═══ */
/* ═══════════════════════════════════════════ */
export default function SupportPage({ dark, t, tickets: ticketsProp }) {
  const [tab, setTab] = useState("chat");
  const [chatMsgs, setChatMsgs] = useState([
    { from: "bot", text: "Hi! I'm Nitro's assistant. I can help with orders, refunds, pricing, and more. What do you need?", time: "Now" },
  ]);
  const [chatInput, setChatInput] = useState("");
  const [botTyping, setBotTyping] = useState(false);
  const [escalated, setEscalated] = useState(false);

  const [ticketView, setTicketView] = useState("list");
  const [activeTicket, setActiveTicket] = useState(null);
  const [filter, setFilter] = useState("all");
  const [newSubject, setNewSubject] = useState("");
  const [newCategory, setNewCategory] = useState("Order Issue");
  const [newMessage, setNewMessage] = useState("");
  const [replyText, setReplyText] = useState("");

  const chatEndRef = useRef(null);
  const tickets = ticketsProp || [];

  const filtered = tickets.filter(tk => filter === "all" || tk.status === filter);
  const counts = { all: tickets.length };
  ["Open", "Resolved", "Closed"].forEach(s => { counts[s] = tickets.filter(tk => tk.status === s).length; });

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [chatMsgs, botTyping]);

  const sendQuick = (label) => {
    setChatMsgs(prev => [...prev, { from: "user", text: label, time: "Now" }]);
    if (label === "Talk to a human") {
      setBotTyping(true);
      setTimeout(() => {
        setBotTyping(false);
        setChatMsgs(prev => [...prev, { from: "bot", text: "I'll connect you with our support team. Creating a ticket now — describe your issue and we'll respond as soon as possible.", time: "Now" }]);
        setTimeout(() => setEscalated(true), 800);
      }, 1200);
      return;
    }
    setBotTyping(true);
    const responses = {
      "Check order status": "Sure! What's your order ID? (e.g. ORD-48291)",
      "Request a refund": "I can help with that. Please provide the order ID you'd like refunded and I'll check the status.",
      "Pricing & services": "We offer services across 35 platforms starting from ₦8/1K. Our most popular:\n\n• Instagram Followers — ₦200/1K (Budget) to ₦1,400/1K (Premium)\n• TikTok Views — ₦8/1K\n• YouTube Subscribers — ₦800/1K\n\nVisit the Services page for full pricing!",
      "How referrals work": "Share your referral link with friends. When they sign up and make their first order, you earn ₦500! Check the Referrals page for your link.",
    };
    setTimeout(() => {
      setBotTyping(false);
      setChatMsgs(prev => [...prev, { from: "bot", text: responses[label] || "I'll look into that for you.", time: "Now" }]);
    }, 1000 + Math.random() * 800);
  };

  const sendChat = () => {
    if (!chatInput.trim()) return;
    const msg = chatInput.trim();
    setChatMsgs(prev => [...prev, { from: "user", text: msg, time: "Now" }]);
    setChatInput("");
    setBotTyping(true);
    setTimeout(() => {
      setBotTyping(false);
      const lower = msg.toLowerCase();
      let reply = "I'll look into that for you. Could you provide more details or an order ID?";
      if (lower.includes("ord-")) reply = "Let me check that order... It looks like it's currently processing. Estimated completion is within 2-4 hours.";
      else if (lower.includes("refund")) reply = "I can process a refund for you. Please share the order ID and I'll check eligibility.";
      else if (lower.includes("price") || lower.includes("cost") || lower.includes("how much")) reply = "Check our Services page for full pricing! We start from ₦8/1K for views and ₦200/1K for followers.";
      else if (lower.includes("human") || lower.includes("agent") || lower.includes("person")) {
        setChatMsgs(prev => [...prev, { from: "bot", text: "I'll connect you with our team right away.", time: "Now" }]);
        setTimeout(() => setEscalated(true), 800);
        return;
      }
      setChatMsgs(prev => [...prev, { from: "bot", text: reply, time: "Now" }]);
    }, 1200 + Math.random() * 600);
  };

  return (
    <div className="sup-root">
      {/* Header + tabs */}
      <div className="sup-header">
        <div className="sup-title" style={{ color: t.text }}>Support</div>
        <div className="sup-subtitle" style={{ color: t.textMuted }}>Get instant help or create a ticket</div>
        <div className="page-divider" style={{ background: t.cardBorder }} />
        <div className="sup-tabs" style={{ background: dark ? "rgba(255,255,255,.04)" : "rgba(0,0,0,.03)", borderColor: t.cardBorder }}>
          {[["chat", "💬 Chat"], ["tickets", "🎫 Tickets"]].map(([id, lb]) => (
            <button key={id} onClick={() => { setTab(id); if (id === "tickets") setTicketView("list"); }} className="sup-tab" style={{ background: tab === id ? t.navActive : "transparent", color: tab === id ? t.accent : t.textMuted }}>
              {lb}
              {id === "tickets" && counts.Open > 0 && <span className="m sup-tab-badge" style={{ background: dark ? "#1c1608" : "#fffbeb", color: dark ? "#fcd34d" : "#d97706" }}>{counts.Open}</span>}
            </button>
          ))}
        </div>
      </div>

      {/* ═══ CHAT TAB ═══ */}
      {tab === "chat" && (
        <div className="sup-chat">
          <div className="sup-chat-msgs">
            {chatMsgs.map((msg, i) => (
              <div key={i} className={`sup-msg sup-msg-${msg.from}`}>
                <div className="sup-msg-bubble" style={{ background: msg.from === "user" ? (dark ? "#2a1a22" : "#fdf2f4") : t.cardBg, borderWidth: 1, borderStyle: "solid", borderColor: msg.from === "user" ? (t.accent + "30") : t.cardBorder }}>
                  {msg.from === "bot" && <div className="sup-msg-bot-label" style={{ color: t.green }}>
                    <span className="sup-bot-dot" style={{ background: t.green }} />Nitro Bot
                  </div>}
                  <div className="sup-msg-text" style={{ color: t.text }}>{msg.text}</div>
                </div>
              </div>
            ))}
            {botTyping && (
              <div className="sup-msg sup-msg-bot">
                <div className="sup-typing" style={{ background: t.cardBg, borderWidth: 1, borderStyle: "solid", borderColor: t.cardBorder }}>
                  <div className="sup-typing-dot" style={{ background: t.textMuted, animationDelay: "0s" }} />
                  <div className="sup-typing-dot" style={{ background: t.textMuted, animationDelay: ".2s" }} />
                  <div className="sup-typing-dot" style={{ background: t.textMuted, animationDelay: ".4s" }} />
                </div>
              </div>
            )}
            {!escalated && chatMsgs.length <= 2 && !botTyping && (
              <div className="sup-quick-actions">
                {BOT_QUICK.map(q => (
                  <button key={q.label} onClick={() => sendQuick(q.label)} className="sup-quick-btn" style={{ borderColor: t.cardBorder, background: t.cardBg, color: t.text }}>
                    <span>{q.icon}</span> {q.label}
                  </button>
                ))}
              </div>
            )}
            {escalated && (
              <div className="sup-escalation" style={{ background: dark ? "rgba(196,125,142,.06)" : "rgba(196,125,142,.03)", borderColor: t.accent + "20" }}>
                <div className="sup-esc-title" style={{ color: t.text }}>Connecting you with our team</div>
                <div className="sup-esc-desc" style={{ color: t.textMuted }}>A ticket will be created with this conversation. We typically respond within 2 hours.</div>
                <button onClick={() => { setTab("tickets"); setTicketView("new"); setEscalated(false); }} className="sup-esc-btn">Create Ticket →</button>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>
          <div className="sup-chat-input" style={{ borderTop: `1px solid ${t.cardBorder}` }}>
            <input type="text" value={chatInput} onChange={e => setChatInput(e.target.value)} onKeyDown={e => e.key === "Enter" && sendChat()} placeholder="Type a message..." className="sup-input" style={{ borderColor: t.cardBorder, background: dark ? "#0d1020" : "#fff", color: t.text }} />
            <button onClick={sendChat} className="sup-send-btn">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
            </button>
          </div>
        </div>
      )}

      {/* ═══ TICKETS TAB ═══ */}
      {tab === "tickets" && (
        <div className="sup-tickets">
          {ticketView === "list" && <>
            <div className="sup-tkt-toolbar">
              <div className="sup-tkt-filters">
                {["all", "Open", "Resolved", "Closed"].map(f => (
                  <button key={f} onClick={() => setFilter(f)} className="sup-tkt-filter" style={{ borderWidth: 1, borderStyle: "solid", borderColor: filter === f ? t.accent : t.cardBorder, background: filter === f ? (dark ? "#2a1a22" : "#fdf2f4") : "transparent", color: filter === f ? t.accent : t.textMuted }}>
                    {f === "all" ? "All" : f} <span className="m" style={{ fontSize: 11 }}>({counts[f] || 0})</span>
                  </button>
                ))}
              </div>
              <button onClick={() => setTicketView("new")} className="sup-new-btn">+ New</button>
            </div>
            <div className="sup-tkt-list" style={{ background: t.cardBg, borderWidth: 1, borderStyle: "solid", borderColor: t.cardBorder }}>
              {filtered.length > 0 ? filtered.map((tk, i) => (
                <div key={tk.id} onClick={() => { setActiveTicket(tk); setTicketView("detail"); setReplyText(""); }} className="sup-tkt-row" style={{ borderBottom: i < filtered.length - 1 ? `1px solid ${t.cardBorder}` : "none" }}>
                  <div className="sup-tkt-top">
                    <span className="m sup-tkt-id" style={{ color: t.accent }}>{tk.id}</span>
                    <span className="m sup-tkt-badge" style={{ background: statusBg(tk.status, dark), color: statusClr(tk.status, dark), borderColor: statusBrd(tk.status, dark) }}>{tk.status}</span>
                    <span className="sup-tkt-time" style={{ color: t.textMuted }}>{tk.lastReply || ""}</span>
                  </div>
                  <div className="sup-tkt-subject" style={{ color: t.text }}>{tk.subject}</div>
                  <div className="sup-tkt-meta" style={{ color: t.textMuted }}>{tk.category} · {tk.messages?.length || 0} messages</div>
                </div>
              )) : (
                <div className="sup-empty" style={{ color: t.textMuted }}>No tickets found</div>
              )}
            </div>
          </>}

          {ticketView === "new" && (
            <div className="sup-new-ticket">
              <div className="sup-new-header">
                <span style={{ fontSize: 15, fontWeight: 600, color: t.text }}>New Ticket</span>
                <button onClick={() => setTicketView("list")} className="sup-back-btn" style={{ borderColor: t.cardBorder, color: t.textSoft }}>← Back</button>
              </div>
              <div className="sup-new-form" style={{ background: t.cardBg, borderWidth: 1, borderStyle: "solid", borderColor: t.cardBorder }}>
                <div className="sup-form-group">
                  <label className="sup-form-label" style={{ color: t.textMuted }}>Category</label>
                  <div className="sup-cat-pills">
                    {CATEGORIES.map(c => (
                      <button key={c} onClick={() => setNewCategory(c)} className="sup-cat-pill" style={{ borderWidth: newCategory === c ? 2 : 1, borderStyle: "solid", borderColor: newCategory === c ? t.accent : t.cardBorder, background: newCategory === c ? (dark ? "#2a1a22" : "#fdf2f4") : "transparent", color: newCategory === c ? t.accent : t.textMuted }}>{c}</button>
                    ))}
                  </div>
                </div>
                <div className="sup-form-group">
                  <label className="sup-form-label" style={{ color: t.textMuted }}>Subject</label>
                  <input type="text" value={newSubject} onChange={e => setNewSubject(e.target.value)} placeholder="Brief description" className="sup-form-input" style={{ borderColor: dark ? "rgba(255,255,255,.1)" : "rgba(0,0,0,.12)", background: dark ? "#0d1020" : "#fff", color: t.text }} />
                </div>
                <div className="sup-form-group">
                  <label className="sup-form-label" style={{ color: t.textMuted }}>Message</label>
                  <textarea value={newMessage} onChange={e => setNewMessage(e.target.value)} placeholder="Describe your issue. Include order IDs if relevant." rows={4} className="sup-form-textarea" style={{ borderColor: dark ? "rgba(255,255,255,.1)" : "rgba(0,0,0,.12)", background: dark ? "#0d1020" : "#fff", color: t.text }} />
                </div>
                <button className="sup-submit-btn" style={{ opacity: newSubject && newMessage ? 1 : .5 }}>Submit Ticket</button>
              </div>
            </div>
          )}

          {ticketView === "detail" && activeTicket && (
            <div className="sup-detail">
              <div className="sup-detail-header">
                <div>
                  <div className="sup-detail-top">
                    <span className="m" style={{ color: t.accent }}>{activeTicket.id}</span>
                    <span className="m sup-tkt-badge" style={{ background: statusBg(activeTicket.status, dark), color: statusClr(activeTicket.status, dark), borderColor: statusBrd(activeTicket.status, dark) }}>{activeTicket.status}</span>
                  </div>
                  <div className="sup-detail-subject" style={{ color: t.text }}>{activeTicket.subject}</div>
                  <div className="sup-detail-meta" style={{ color: t.textMuted }}>{activeTicket.category} · Opened {activeTicket.created}</div>
                </div>
                <button onClick={() => { setTicketView("list"); setActiveTicket(null); }} className="sup-back-btn" style={{ borderColor: t.cardBorder, color: t.textSoft }}>← Back</button>
              </div>
              <div className="sup-detail-msgs">
                {(activeTicket.messages || []).map((msg, i) => (
                  <div key={i} className={`sup-msg sup-msg-${msg.from === "admin" ? "bot" : "user"}`}>
                    <div className="sup-msg-bubble" style={{ background: msg.from === "user" ? (dark ? "#2a1a22" : "#fdf2f4") : t.cardBg, borderWidth: 1, borderStyle: "solid", borderColor: msg.from === "user" ? (t.accent + "30") : t.cardBorder }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: msg.from === "user" ? t.accent : t.green, marginBottom: 4 }}>{msg.from === "user" ? "You" : "Nitro Support"}</div>
                      <div style={{ fontSize: 14, color: t.text, lineHeight: 1.5 }}>{msg.text}</div>
                    </div>
                    <div style={{ fontSize: 12, color: t.textMuted, marginTop: 4, padding: "0 4px" }}>{msg.time}</div>
                  </div>
                ))}
              </div>
              {activeTicket.status === "Open" && (
                <div className="sup-reply-box">
                  <textarea value={replyText} onChange={e => setReplyText(e.target.value)} placeholder="Type your reply..." rows={3} className="sup-form-textarea" style={{ borderColor: dark ? "rgba(255,255,255,.1)" : "rgba(0,0,0,.12)", background: dark ? "#0d1020" : "#fff", color: t.text }} />
                  <button className="sup-submit-btn" style={{ opacity: replyText ? 1 : .5, marginTop: 8 }}>Send Reply</button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════ */
/* ═══ SUPPORT RIGHT SIDEBAR               ═══ */
/* ═══════════════════════════════════════════ */
export function SupportSidebar({ dark, t, tickets }) {
  const tks = tickets || [];
  const openCount = tks.filter(tk => tk.status === "Open").length;
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

      <div className="sup-rs-title" style={{ color: t.textMuted }}>Tickets</div>
      <div className="sup-rs-stats">
        {[
          ["Open", String(openCount), dark ? "#fcd34d" : "#d97706"],
          ["Total", String(tks.length), dark ? "#a5b4fc" : "#4f46e5"],
        ].map(([label, val, color]) => (
          <div key={label} className="sup-rs-stat" style={{ background: t.cardBg }}>
            <div className="sup-rs-stat-label" style={{ color: t.textMuted }}>{label}</div>
            <div className="m sup-rs-stat-val" style={{ color }}>{val}</div>
          </div>
        ))}
      </div>

      <div className="sup-rs-divider" style={{ background: t.sidebarBorder }} />

      <div className="sup-rs-title" style={{ color: t.textMuted }}>Contact Us</div>
      <div className="sup-rs-contact" style={{ background: t.cardBg }}>
        {[["Email", "TheNitroNG@gmail.com"], ["WhatsApp", "Coming soon"], ["Instagram", "@Nitro.ng"]].map(([label, val]) => (
          <div key={label} className="sup-rs-contact-row">
            <span style={{ color: t.textMuted }}>{label}</span>
            <span style={{ color: t.accent, fontWeight: 500 }}>{val}</span>
          </div>
        ))}
      </div>
    </>
  );
}
