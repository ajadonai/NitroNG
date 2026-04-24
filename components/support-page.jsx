'use client';
import { useState, useEffect, useRef, useCallback } from "react";
import { fD, fRel } from "../lib/format";
import { SITE } from "../lib/site";
import { SegPill } from "./seg-pill";

const BOT_RESPONSES = {
  check_order: { text: "To check your order status, go to **History** in your dashboard. Each order shows its current status. You can also tap **Check** on any order to refresh from the provider.", followUp: "What do the statuses mean?" },
  status_explain: { text: "• **Pending** — order received, waiting to start\n• **Processing** — actively being delivered\n• **Completed** — fully delivered\n• **Partial** — only some delivered (auto-refund for rest)\n• **Cancelled** — cancelled, funds refunded to wallet" },
  single_order: { text: "To place a single order:\n\n1. Go to **New Order** in your dashboard\n2. Pick a platform and service\n3. Choose a tier — **Budget**, **Standard**, or **Premium**\n4. Paste your link, set the quantity, and confirm\n\nPayment comes from your Nitro wallet. Most orders start within seconds." },
  bulk_order: { text: "Bulk orders let you queue multiple orders at once:\n\n1. Go to **New Order** and switch to **Bulk** mode (top of the page)\n2. Add services to your cart — different platforms, links, and quantities\n3. Review your cart and submit everything in one go\n\nGreat for agencies managing multiple accounts or running campaigns across platforms." },
  deposit: { text: "To fund your wallet:\n\n1. Go to **Wallet** in your dashboard\n2. Enter your amount (minimum ₦500)\n3. Choose a payment method — **bank transfer**, **card**, or **crypto**\n\nDeposits are credited instantly. Your wallet balance is used for all orders." },
  refund: { text: "Nitro offers refunds for:\n\n• **Undelivered orders** — auto-refunded after 72 hours\n• **Partial delivery** — refunded for undelivered portion\n• **Wrong service** — full refund to wallet\n\nRefunds go to your Nitro wallet within 5 minutes." },
  delivery: { text: "Most orders start processing within **seconds** of payment. Full delivery depends on the service:\n\n• **Followers/likes** — minutes to a few hours\n• **Views/streams** — gradual, up to 24 hours\n• **Comments** — usually within 1–2 hours\n\nMany services include **automatic refills** — if you lose any, we top them back up for free within the refill period." },
  pricing: { text: "Every service has 3 tiers:\n\n• **Budget** — cheapest, may drop slightly over time\n• **Standard** — best value, stable delivery with refill\n• **Premium** — top quality, lifetime guarantee\n\nPrices start from ₦3 per 1,000. Check **New Order** to see live rates for each platform." },
  platforms: { text: "Nitro supports **35+ platforms** including:\n\n• **Instagram** — followers, likes, views, comments, reels\n• **TikTok** — followers, likes, views, shares\n• **YouTube** — subscribers, views, watch hours, likes\n• **Twitter/X** — followers, likes, retweets\n• **Facebook, Telegram, Spotify, Snapchat, LinkedIn, Pinterest, Twitch, Discord** and more\n\nCheck the **New Order** page for the full list." },
  referrals: { text: "Share your referral link with friends. When they sign up and make their first deposit, **you both earn a bonus** credited to your wallets.\n\nFind your link in the **Referrals** section. The more people you refer, the more you earn — no limits." },
  leaderboard: { text: "The **Leaderboard** ranks Nitro's top users by total spend. Higher ranks unlock perks like priority support and bonus credits.\n\nCheck where you stand in the **Leaderboard** section of your dashboard." },
};

const QUICK_ACTIONS = [
  { id: "check_order", label: "Check order status" },
  { id: "single_order", label: "How to place an order" },
  { id: "bulk_order", label: "Bulk orders" },
  { id: "deposit", label: "How to deposit" },
  { id: "delivery", label: "Delivery & refills" },
  { id: "refund", label: "Refund policy" },
  { id: "pricing", label: "Pricing & tiers" },
  { id: "platforms", label: "Supported platforms" },
  { id: "referrals", label: "Referral program" },
  { id: "leaderboard", label: "Leaderboard & perks" },
  { id: "human", label: "Talk to support" },
];

const REASSURANCE = [
  "Still looking for an available agent — hang tight!",
  "Our team is handling other conversations. You're in the queue.",
  "Thanks for your patience. An agent will be with you shortly.",
  "Your conversation is saved — feel free to add more details while you wait.",
  "Agents typically respond within 5 minutes. Shouldn't be long now.",
];

function QuickIcon({ id, size = 14 }) {
  const p = { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" };
  if (id === "check_order") return <svg {...p}><path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 002 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>;
  if (id === "single_order") return <svg {...p}><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M12 8v8"/><path d="M8 12h8"/></svg>;
  if (id === "bulk_order") return <svg {...p}><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>;
  if (id === "deposit") return <svg {...p}><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M2 10h20"/></svg>;
  if (id === "delivery") return <svg {...p}><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>;
  if (id === "refund") return <svg {...p}><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>;
  if (id === "pricing") return <svg {...p}><path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>;
  if (id === "platforms") return <svg {...p}><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>;
  if (id === "referrals") return <svg {...p}><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>;
  if (id === "leaderboard") return <svg {...p}><path d="M8 21V12H2v9h6z"/><path d="M22 21V8h-6v13h6z"/><path d="M15 21V4H9v17h6z"/></svg>;
  if (id === "human") return <svg {...p}><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>;
  return null;
}

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
  const isBot = m.from === "bot";
  const timeEl = m.time ? <div className="text-[11px] mt-[3px] px-1.5" style={{ color: t.textMuted }}>{typeof m.time === "string" && m.time.includes("T") ? fD(m.time) : String(m.time || "")}</div> : null;
  if (isUser) return (
    <div className="flex flex-col items-end">
      <div className="max-w-[78%] py-2.5 px-3.5 rounded-[14px]" style={{ borderBottomRightRadius: 4, background: dark ? "rgba(196,125,142,.19)" : "rgba(196,125,142,.14)", border: `1px solid ${dark ? "rgba(196,125,142,.18)" : "rgba(196,125,142,.19)"}` }}>
        <div className="text-[15px] leading-relaxed whitespace-pre-line" style={{ color: t.text }}>{m.formatted ? <FormatText text={String(m.text || "")} dark={dark} /> : String(m.text || "")}</div>
      </div>
      {timeEl}
    </div>
  );
  return (
    <div className="flex gap-2.5 items-center max-w-[82%]">
      <div className="w-9 h-9 rounded-full shrink-0 flex items-center justify-center" style={{ background: isBot ? (dark ? "rgba(167,139,250,.1)" : "rgba(124,58,237,.07)") : (dark ? "rgba(196,125,142,.1)" : "rgba(196,125,142,.07)") }}>
        {isBot ? <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={dark ? "#a78bfa" : "#7c3aed"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="6" width="16" height="14" rx="2.5"/><line x1="12" y1="2" x2="12" y2="6"/><circle cx="9" cy="13" r="1.5"/><circle cx="15" cy="13" r="1.5"/><path d="M9 17h6"/></svg>
        : <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={t.accent} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>}
      </div>
      <div className="flex flex-col items-start flex-1 min-w-0">
        <div className="py-2.5 px-3.5 rounded-[14px]" style={{ borderBottomLeftRadius: 4, background: isBot ? (dark ? "rgba(167,139,250,.06)" : "rgba(124,58,237,.04)") : (dark ? "rgba(255,255,255,.1)" : "rgba(0,0,0,.06)"), border: `1px solid ${isBot ? (dark ? "rgba(167,139,250,.12)" : "rgba(124,58,237,.1)") : (dark ? "rgba(255,255,255,.12)" : "rgba(0,0,0,.12)")}` }}>
          <div className="text-[13px] font-semibold mb-[3px]" style={{ color: isBot ? (dark ? "#a78bfa" : "#7c3aed") : t.accent }}>{m.name || (isBot ? "Nitro Bot" : "Support")}</div>
          <div className="text-[15px] leading-relaxed whitespace-pre-line" style={{ color: t.text }}>{m.formatted ? <FormatText text={String(m.text || "")} dark={dark} /> : String(m.text || "")}</div>
        </div>
        {timeEl}
      </div>
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
  const [mobileView, setMobileView] = useState("list");

  const msgsEnd = useRef(null);
  const waitRef = useRef(null);
  const waitCountRef = useRef(0);
  const selectedIdRef = useRef(null); // track selected.id without causing re-renders
  const sendingRef = useRef(false);
  const creatingTicketRef = useRef(false);
  const msgsRef = useRef(msgs);

  // Keep ref in sync
  useEffect(() => { selectedIdRef.current = (selected && typeof selected === "object") ? selected.id : null; }, [selected]);
  useEffect(() => { msgsRef.current = msgs; }, [msgs]);

  const scrollChat = useCallback(() => { setTimeout(() => msgsEnd.current?.scrollIntoView({ behavior: "smooth" }), 60); }, []);

  // Scroll when bot msgs change (not ticket msgs — those scroll manually)
  useEffect(scrollChat, [msgs, typing, scrollChat]);

  // Load + poll tickets
  const refreshTickets = useCallback(() => {
    fetch("/api/tickets").then(r => r.json()).then(d => {
      if (!d.tickets) return;
      const visible = d.tickets.filter(tk => tk.status !== "Archived");
      setTickets(visible);
      const sid = selectedIdRef.current;
      if (sid) {
        const updated = visible.find(tk => tk.id === sid);
        if (updated) {
          setSelected(prev => {
            if (!prev || typeof prev !== "object") return prev;
            if (updated.messages?.length !== prev.messages?.length) return updated;
            return prev;
          });
          if (updated.unreadByUser) {
            fetch("/api/tickets", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "read", ticketId: sid }) }).catch(() => {});
          }
        }
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
  const hasOpenTicket = tickets.some(tk => tk.status === "Open" || tk.status === "In Progress");
  const filtered = filter === "all" ? tickets
    : filter === "active" ? tickets.filter(tk => tk.status === "Open" || tk.status === "In Progress")
    : tickets.filter(tk => tk.status === filter);

  let chatMsgs = msgs;
  if (isTicket) {
    try { chatMsgs = (selected.messages || []).map(m => ({ ...m, from: m.from === "admin" ? "support" : m.from, name: m.from === "admin" ? (m.name || "Support") : m.from === "user" ? undefined : m.name })); }
    catch { chatMsgs = []; }
  } else if (isNewTicket) { chatMsgs = []; }

  const chatTitle = isNewTicket ? "New Ticket" : isTicket ? (selected.subject === "Support request" ? selected.id : selected.subject) : "Support";
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
      if (creatingTicketRef.current) return;
      creatingTicketRef.current = true;
      setTyping(true);
      setTimeout(() => {
        setTyping(false);
        addBotMsg("I'll create a support ticket for you. One moment...");
        setTimeout(() => {
          const ctx = msgsRef.current.filter(m => m.from === "user").map(m => m.text).join("\n");
          fetch("/api/tickets", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "create", subject: "Support request", message: ctx || "User requested live support", category: "General" }) })
            .then(r => {
              if (r.status === 409) return r.json().then(d => ({ existing: true, id: d?.ticket?.id }));
              if (!r.ok) throw new Error();
              return r.json().then(d => ({ existing: false, id: d?.ticket?.id }));
            })
            .then(d => {
              const targetId = d?.id;
              if (targetId) {
                fetch("/api/tickets").then(r2 => r2.json()).then(data => {
                  const visible = (data.tickets || []).filter(tk2 => tk2.status !== "Archived");
                  setTickets(visible);
                  const found = visible.find(tk2 => tk2.id === targetId);
                  if (found) { setSelected(found); setMobileView("chat"); }
                }).catch(() => {});
              }
              setMsgs([{ from: "bot", name: "Nitro Bot", text: "Hi! I'm Nitro's assistant. I can help with orders, refunds, pricing, and more. Tap a topic below or type your question.", time: "Now", formatted: true }]);
              setShowQuick(true);
              creatingTicketRef.current = false;
            })
            .catch(() => { addBotMsg("Something went wrong. Please try again."); setShowQuick(true); creatingTicketRef.current = false; });
        }, 800);
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
    const match = (keywords) => keywords.some(k => lower.includes(k));
    const botReply = (key) => { setTyping(true); const r = BOT_RESPONSES[key]; setTimeout(() => { setTyping(false); addBotMsg(r.text, r.followUp ? { followUp: r.followUp } : {}); setShowQuick(true); }, 700 + Math.random() * 300); };

    if (match(["human", "agent", "person", "talk to", "speak to"])) {
      handleQuick("human");
    } else if (lower.includes("order") && match(["status", "check", "track", "where"])) {
      botReply("check_order");
    } else if (match(["bulk", "cart", "multiple", "batch"])) {
      botReply("bulk_order");
    } else if (match(["place order", "place an order", "how to order", "new order", "single order"])) {
      botReply("single_order");
    } else if (match(["deposit", "fund", "add money", "top up", "payment method", "bank transfer", "pay"])) {
      botReply("deposit");
    } else if (match(["refund", "money back", "cancelled", "failed order"])) {
      botReply("refund");
    } else if (match(["deliver", "refill", "how long", "how fast", "speed", "time"])) {
      botReply("delivery");
    } else if (match(["price", "cost", "how much", "rate", "cheap", "tier", "budget", "premium", "standard"])) {
      botReply("pricing");
    } else if (match(["platform", "instagram", "tiktok", "youtube", "twitter", "facebook", "spotify", "telegram", "which service"])) {
      botReply("platforms");
    } else if (match(["referr", "invite", "bonus", "share"])) {
      botReply("referrals");
    } else if (match(["leaderboard", "rank", "top user", "perk"])) {
      botReply("leaderboard");
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
    <div className={`sup-split rounded-xl ${mobileView === "chat" ? "sup-view-chat" : "sup-view-list"}`} style={{ border: `1px solid ${dark ? "rgba(255,255,255,.12)" : "rgba(0,0,0,.12)"}` }}>

      {/* ═══ LEFT: CONVERSATION LIST ═══ */}
      <div className="sup-split-list w-[280px] shrink-0" style={{ borderRight: `1px solid ${dark ? "rgba(255,255,255,.12)" : "rgba(0,0,0,.12)"}` }}>
        <div className="shrink-0 h-[56px] flex justify-between items-center px-4" style={{ background: dark ? "rgba(196,125,142,.18)" : "rgba(196,125,142,.12)", borderBottom: `1px solid ${dark ? "rgba(255,255,255,.1)" : "rgba(0,0,0,.1)"}` }}>
          <div className="flex items-center gap-2">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={t.accent} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
            <div className="text-[15px] font-semibold" style={{ color: t.text }}>Conversations</div>
          </div>
          {hasOpenTicket
            ? <span className="text-[11px]" style={{ color: t.textMuted }}>Has open ticket</span>
            : <button onClick={() => { setSelected("new"); setMobileView("chat"); }} className="py-1 px-2.5 rounded-full bg-gradient-to-br from-[#c47d8e] to-[#a3586b] text-white text-[11px] font-semibold border-none cursor-pointer transition-transform duration-200 hover:-translate-y-px">+ New</button>
          }
        </div>
        <div className="shrink-0" style={{ padding: "8px 10px", borderBottom: `1px solid ${dark ? "rgba(255,255,255,.08)" : "rgba(0,0,0,.08)"}` }}>
          <SegPill value={filter} options={[{value: "all", label: "All"}, {value: "active", label: "Active"}, {value: "Resolved", label: "Done"}]} onChange={setFilter} dark={dark} t={t} fill />
        </div>

        <div className="flex-1 overflow-y-auto min-h-0">
          {/* Bot chat item */}
          <div role="button" tabIndex={0} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();e.currentTarget.click()}}} onClick={() => { setSelected(null); setMobileView("chat"); }} className="flex items-center gap-2.5 py-3 px-3.5 cursor-pointer" style={{ borderBottom: `1px solid ${dark ? "rgba(255,255,255,.06)" : "rgba(0,0,0,.06)"}`, background: !selected ? (dark ? "rgba(167,139,250,.1)" : "rgba(124,58,237,.06)") : "transparent", borderLeft: !selected ? `3px solid ${dark ? "#a78bfa" : "#7c3aed"}` : "3px solid transparent" }}>
            <div className="w-9 h-9 rounded-xl shrink-0 flex items-center justify-center relative" style={{ background: dark ? "rgba(167,139,250,.12)" : "rgba(124,58,237,.08)", border: `1px solid ${dark ? "rgba(167,139,250,.15)" : "rgba(124,58,237,.1)"}` }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={dark ? "#a78bfa" : "#7c3aed"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="6" width="16" height="14" rx="2.5"/><line x1="12" y1="2" x2="12" y2="6"/><circle cx="9" cy="13" r="1.5"/><circle cx="15" cy="13" r="1.5"/><path d="M9 17h6"/></svg>
              <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full" style={{ background: dark ? "#a78bfa" : "#7c3aed", border: `2px solid ${dark ? "#0e1225" : "#f3f0ec"}` }} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 mb-0.5">
                <span className="text-[13px] font-semibold" style={{ color: dark ? "#a78bfa" : "#7c3aed" }}>Nitro Bot</span>
                <span className="text-[9px] font-bold uppercase tracking-[0.5px] py-px px-1.5 rounded" style={{ background: dark ? "rgba(167,139,250,.1)" : "rgba(124,58,237,.07)", color: dark ? "#a78bfa" : "#7c3aed" }}>AI</span>
              </div>
              <div className="text-xs truncate" style={{ color: t.textMuted }}>{msgs[msgs.length - 1]?.text?.slice(0, 45) || ""}</div>
            </div>
          </div>

          {/* Ticket list */}
          {filtered.map(tk => {
            const last = (tk.messages || [])[tk.messages?.length - 1];
            const sender = last?.from === "user" ? "You" : (last?.name?.split(" - ")?.[0] || "Support");
            const isSel = isTicket && selected.id === tk.id;
            const hasNewReply = tk.unreadByUser;
            return (
              <div key={tk.id} role="button" tabIndex={0} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();e.currentTarget.click()}}} onClick={() => { setSelected(tk); setInput(""); setMobileView("chat"); if (tk.unreadByUser) fetch("/api/tickets", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "read", ticketId: tk.id }) }).then(() => refreshTickets()).catch(() => {}); }} className="flex items-center gap-2.5 py-2.5 px-3.5 cursor-pointer" style={{ borderBottom: `1px solid ${dark ? "rgba(255,255,255,.06)" : "rgba(0,0,0,.06)"}`, background: isSel ? (dark ? "rgba(196,125,142,.1)" : "rgba(196,125,142,.07)") : "transparent", borderLeft: isSel ? `3px solid ${t.accent}` : "3px solid transparent" }}>
                <div className="w-8 h-8 rounded-full shrink-0 flex items-center justify-center text-xs font-bold relative" style={{ background: dark ? "rgba(148,163,184,.1)" : "rgba(100,116,139,.08)", color: dark ? "#94a3b8" : "#64748b" }}>
                  {(tk.subject || "T")[0].toUpperCase()}
                  {hasNewReply && !isSel && <div className="absolute -top-px -right-px w-2.5 h-2.5 rounded-full" style={{ background: t.accent, border: `2px solid ${dark ? "#0e1225" : "#f3f0ec"}` }} />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-medium mb-0.5 truncate" style={{ color: isSel ? t.text : (dark ? "rgba(255,255,255,.85)" : "rgba(0,0,0,.8)") }}>{tk.subject === "Support request" ? tk.id : (tk.subject || "Ticket")}</div>
                  {last && <div className="text-xs truncate mb-[3px]" style={{ color: t.textMuted }}>
                    <span className="font-medium" style={{ color: last.from === "user" ? (dark ? "rgba(196,125,142,0.7)" : t.accent) : t.accent }}>{sender}: </span>{String(last.text || "").split("\n")[0]?.slice(0, 45)}
                  </div>}
                  <StatusPill status={tk.status} dark={dark} />
                </div>
                <span className="text-[11px] shrink-0" style={{ color: t.textMuted }}>{fRel(last?.time || tk.created)}</span>
              </div>
            );
          })}
          {filtered.length === 0 && tickets.length > 0 && <div className="p-5 text-center text-[11px]" style={{ color: t.textMuted }}>No matches</div>}
          {tickets.length === 0 && (
            <div className="flex-1 flex flex-col items-center justify-center py-10 px-4 text-center">
              <div className="w-11 h-11 rounded-full flex items-center justify-center mb-3" style={{ background: dark ? "rgba(255,255,255,.04)" : "rgba(0,0,0,.03)" }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={t.textMuted} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
              </div>
              <div className="text-[13px] font-medium mb-1" style={{ color: t.textSoft || t.textMuted }}>No tickets yet</div>
              <div className="text-xs leading-relaxed" style={{ color: t.textMuted }}>Chat with Nitro Bot or create<br/>a ticket for human support</div>
            </div>
          )}
        </div>
      </div>

      {/* ═══ RIGHT: CHAT ═══ */}
      <div className="sup-split-chat">
        {/* Header */}
        <div className="shrink-0 h-[56px] flex items-center gap-2.5 px-[18px]" style={{ borderBottom: `1px solid ${dark ? "rgba(255,255,255,.1)" : "rgba(0,0,0,.1)"}`, background: dark ? "rgba(196,125,142,.18)" : "rgba(196,125,142,.12)" }}>
            <button className="sup-mobile-back transition-transform duration-200 hover:-translate-y-px" onClick={() => setMobileView("list")} style={{ background: "none", border: "none", color: t.textMuted, cursor: "pointer", padding: 4, display: "none" }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6"/></svg>
            </button>
            {!isNewTicket && !isTicket && <div className="w-9 h-9 rounded-xl shrink-0 flex items-center justify-center" style={{ background: dark ? "rgba(167,139,250,.12)" : "rgba(124,58,237,.08)", border: `1px solid ${dark ? "rgba(167,139,250,.15)" : "rgba(124,58,237,.1)"}` }}><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={dark ? "#a78bfa" : "#7c3aed"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="6" width="16" height="14" rx="2.5"/><line x1="12" y1="2" x2="12" y2="6"/><circle cx="9" cy="13" r="1.5"/><circle cx="15" cy="13" r="1.5"/><path d="M9 17h6"/></svg></div>}
            {isTicket && <div className="w-9 h-9 rounded-full shrink-0 flex items-center justify-center text-xs font-bold" style={{ background: dark ? "rgba(196,125,142,.12)" : "rgba(196,125,142,.08)", color: t.accent }}>{(selected.subject || "T")[0].toUpperCase()}</div>}
            {isNewTicket && <div className="w-9 h-9 rounded-full shrink-0 flex items-center justify-center" style={{ background: dark ? "rgba(196,125,142,.12)" : "rgba(196,125,142,.08)" }}><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={t.accent} strokeWidth="2" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg></div>}
            <div className="flex-1 min-w-0">
              <div className="text-[15px] font-semibold truncate" style={{ color: t.text }}>{chatTitle}</div>
              <div className="flex items-center gap-2 mt-0.5">
                {isTicket && <StatusPill status={selected.status} dark={dark} />}
                {!isTicket && !isNewTicket && <span className="text-xs" style={{ color: t.textMuted }}>Ask anything or talk to support</span>}
                {isNewTicket && <span className="text-xs" style={{ color: t.textMuted }}>Describe your issue</span>}
              </div>
            </div>
            {canReply && <button onClick={closeTicket} className="py-[5px] px-3.5 rounded-full text-xs font-medium bg-transparent cursor-pointer shrink-0 transition-transform duration-200 hover:-translate-y-px" style={{ border: `1px solid ${dark ? "rgba(255,255,255,.14)" : "rgba(0,0,0,.14)"}`, color: t.textMuted, fontFamily: "inherit" }}>Close</button>}
        </div>

        {/* Messages or New Ticket Form */}
        {isNewTicket ? (
          <div className="flex-1 overflow-y-auto min-h-0 py-5 px-[18px] flex flex-col">
            <label className="text-xs font-semibold uppercase tracking-[1px] mb-2" style={{ color: t.textMuted }}>Category</label>
            <div className="flex gap-[5px] flex-wrap mb-[18px]">
              {["Order Issue","Payment","Refund","Account","Other"].map(c =>
                <button key={c} onClick={() => setNewCat(c)} className="py-[6px] px-3.5 rounded-lg text-xs cursor-pointer transition-transform duration-200 hover:-translate-y-px" style={{ fontWeight: newCat === c ? 600 : 500, background: newCat === c ? (dark ? "rgba(196,125,142,.18)" : "rgba(196,125,142,.12)") : (dark ? "rgba(255,255,255,.06)" : "rgba(0,0,0,.04)"), border: `1px solid ${newCat === c ? (dark ? "rgba(196,125,142,.28)" : "rgba(196,125,142,.19)") : (dark ? "rgba(255,255,255,.12)" : "rgba(0,0,0,.12)")}`, color: newCat === c ? t.accent : t.textMuted, fontFamily: "inherit" }}>{c}</button>
              )}
            </div>
            <label className="text-xs font-semibold uppercase tracking-[1px] mb-1.5" style={{ color: t.textMuted }}>Subject</label>
            <input value={newSubject} onChange={e => setNewSubject(e.target.value)} placeholder="Brief description of your issue" className="w-full py-2.5 px-3.5 rounded-[10px] text-sm outline-none mb-4 box-border" style={{ background: dark ? "rgba(255,255,255,.08)" : "rgba(0,0,0,.06)", border: `1px solid ${dark ? "rgba(255,255,255,.12)" : "rgba(0,0,0,.12)"}`, color: t.text, fontFamily: "inherit" }} />
            <label className="text-xs font-semibold uppercase tracking-[1px] mb-1.5" style={{ color: t.textMuted }}>Message</label>
            <textarea value={newMessage} onChange={e => setNewMessage(e.target.value)} placeholder="Describe your issue. Include order IDs if relevant." rows={5} className="w-full py-2.5 px-3.5 rounded-[10px] text-sm outline-none resize-y leading-normal box-border" style={{ background: dark ? "rgba(255,255,255,.08)" : "rgba(0,0,0,.06)", border: `1px solid ${dark ? "rgba(255,255,255,.12)" : "rgba(0,0,0,.12)"}`, color: t.text, fontFamily: "inherit" }} />
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto min-h-0 py-3 px-[18px] flex flex-col gap-1.5">
              <div className="flex-1" />
              {chatMsgs.map((m, i) => (
                <div key={i}>
                  <Bubble m={m} dark={dark} t={t} />
                  {m.followUp && <div className="mt-1.5 pl-1 transition-transform duration-200 hover:-translate-y-px"><button onClick={() => handleFollowUp(m.followUp)} className="py-1.5 px-3 rounded-lg text-xs cursor-pointer" style={{ background: dark ? "rgba(255,255,255,.06)" : "rgba(0,0,0,.04)", border: `1px solid ${dark ? "rgba(255,255,255,.12)" : "rgba(0,0,0,.12)"}`, color: t.textSoft || t.textMuted, fontFamily: "inherit" }}>{m.followUp}</button></div>}
                  {m.escalatePrompt && <div className="flex gap-1.5 mt-1.5 pl-1">
                    <button onClick={() => handleQuick("human")} className="py-1.5 px-3 rounded-lg text-xs font-medium cursor-pointer transition-transform duration-200 hover:-translate-y-px" style={{ background: dark ? "rgba(196,125,142,.14)" : "rgba(196,125,142,.1)", border: `1px solid ${dark ? "rgba(196,125,142,.24)" : "rgba(196,125,142,.18)"}`, color: t.accent, fontFamily: "inherit" }}>Yes, connect me</button>
                    <button onClick={() => setShowQuick(true)} className="py-1.5 px-3 rounded-lg text-xs cursor-pointer transition-transform duration-200 hover:-translate-y-px" style={{ background: dark ? "rgba(255,255,255,.06)" : "rgba(0,0,0,.04)", border: `1px solid ${dark ? "rgba(255,255,255,.12)" : "rgba(0,0,0,.12)"}`, color: t.textMuted, fontFamily: "inherit" }}>Ask something else</button>
                  </div>}
                </div>
              ))}
              {typing && <div className="self-start py-2.5 px-[18px] rounded-[14px] rounded-bl" style={{ background: dark ? "rgba(255,255,255,.1)" : "rgba(0,0,0,.06)", border: `1px solid ${dark ? "rgba(255,255,255,.12)" : "rgba(0,0,0,.12)"}` }}><div className="flex gap-1">{[0,1,2].map(j=><div key={j} className="sup-typing-dot" style={{ width:6,height:6,borderRadius:3,background:t.textMuted,animationDelay:`${j*.15}s` }}/>)}</div></div>}
              <div ref={msgsEnd} />
            </div>
            {!selected && showQuick && !isLive && <div className="py-2 px-4 flex gap-[5px] flex-wrap shrink-0" style={{ borderTop: `1px solid ${dark ? "rgba(255,255,255,.08)" : "rgba(0,0,0,.08)"}` }}>
              {QUICK_ACTIONS.filter(a => !(a.id === "human" && hasOpenTicket)).map(a => <button key={a.id} onClick={() => handleQuick(a.id)} className="sup-quick-btn py-[7px] px-3 rounded-lg text-xs border border-solid cursor-pointer font-[inherit] flex items-center gap-[5px] transition-transform duration-200 hover:-translate-y-px" style={{ background: a.id === "human" ? (dark ? "rgba(196,125,142,.14)" : "rgba(196,125,142,.1)") : (dark ? "rgba(255,255,255,.06)" : "rgba(0,0,0,.04)"), borderColor: a.id === "human" ? (dark ? "rgba(196,125,142,.28)" : "rgba(196,125,142,.19)") : (dark ? "rgba(255,255,255,.12)" : "rgba(0,0,0,.12)"), color: a.id === "human" ? t.accent : (t.textSoft || t.textMuted), fontWeight: a.id === "human" ? 600 : 500 }}><QuickIcon id={a.id} size={13} />{a.label}</button>)}
            </div>}
          </>
        )}

        {/* Input — pinned at bottom */}
        {canReply && (() => { const lm = chatMsgs[chatMsgs.length - 1]; return lm?.from === "user"; })() && (
          <div className="py-1.5 px-4 text-center text-[11px] shrink-0 flex items-center justify-center gap-1.5" style={{ borderTop: `1px solid ${dark ? "rgba(255,255,255,.08)" : "rgba(0,0,0,.08)"}`, color: dark ? "#fcd34d" : "#d97706", background: dark ? "rgba(234,179,8,.04)" : "rgba(234,179,8,.03)" }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            Sending extra messages may increase your wait time
          </div>
        )}
        {isNewTicket ? (
          <div className="py-2.5 px-4 shrink-0" style={{ borderTop: `1px solid ${dark ? "rgba(255,255,255,.12)" : "rgba(0,0,0,.12)"}` }}>
            {ticketError && <div className="py-1.5 px-2.5 rounded-md mb-1.5 text-xs" style={{ background: dark ? "rgba(220,38,38,.08)" : "#fef2f2", color: dark ? "#fca5a5" : "#dc2626" }}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{display:"inline",verticalAlign:"middle"}}><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg> {ticketError}</div>}
            <button onClick={createTicket} disabled={!newSubject.trim() || !newMessage.trim() || ticketLoading} className="w-full py-[11px] rounded-[10px] text-sm font-semibold border-none cursor-pointer transition-[transform,box-shadow] duration-200 hover:translate-y-[-1px] hover:shadow-[0_6px_20px_rgba(196,125,142,.31)]" style={{ background: newSubject.trim() && newMessage.trim() ? "linear-gradient(135deg,#c47d8e,#a3586b)" : (dark ? "rgba(255,255,255,.08)" : "rgba(0,0,0,.06)"), color: newSubject.trim() && newMessage.trim() ? "#fff" : t.textMuted, cursor: newSubject.trim() && newMessage.trim() ? "pointer" : "default", fontFamily: "inherit" }}>{ticketLoading ? "Creating..." : "Create Ticket"}</button>
          </div>
        ) : (!selected || canReply) ? (
          <div className="flex gap-2 items-center shrink-0 py-2.5 px-4" style={{ borderTop: `1px solid ${dark ? "rgba(255,255,255,.12)" : "rgba(0,0,0,.12)"}` }}>
            <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === "Enter" && sendMsg()} placeholder={isTicket ? "Type a message..." : (waitingForAgent ? "Add details while you wait..." : isLive ? "Message support..." : "Ask a question...")} className="flex-1 py-2.5 px-4 rounded-[20px] text-sm outline-none" style={{ background: dark ? "rgba(255,255,255,.08)" : "rgba(0,0,0,.06)", border: `1px solid ${dark ? "rgba(255,255,255,.12)" : "rgba(0,0,0,.12)"}`, color: t.text, fontFamily: "inherit" }} />
            <button onClick={sendMsg} className="w-[38px] h-[38px] rounded-full border-none flex items-center justify-center shrink-0" style={{ background: input.trim() ? "linear-gradient(135deg,#c47d8e,#a3586b)" : (dark ? "rgba(255,255,255,.08)" : "rgba(0,0,0,.06)"), cursor: input.trim() ? "pointer" : "default" }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={input.trim() ? "#fff" : t.textMuted} strokeWidth="2" strokeLinecap="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
            </button>
          </div>
        ) : isTicket ? (
          <div className="py-3 px-[18px] text-center text-[13px] shrink-0" style={{ borderTop: `1px solid ${dark ? "rgba(255,255,255,.08)" : "rgba(0,0,0,.08)"}`, color: t.textMuted, background: dark ? "rgba(196,125,142,.18)" : "rgba(196,125,142,.12)" }}>This conversation has been resolved</div>
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
          <div className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: dark ? "#a78bfa" : "#7c3aed" }} />
          <span className="text-sm font-semibold" style={{ color: dark ? "#a78bfa" : "#7c3aed" }}>Online</span>
        </div>
        <div className="text-sm leading-snug" style={{ color: t.textMuted }}>AI assistant available 24/7 for orders, pricing, refunds, and general questions.</div>
      </div>
      <div className="h-px mb-4" style={{ background: t.sidebarBorder }} />
      <div className="text-[13px] font-semibold uppercase tracking-[1.5px] mb-3 pl-1" style={{ color: t.textMuted }}>Quick Help</div>
      <div className="flex flex-col gap-1 mb-4">
        {[["Check order status","check_order"],["How to deposit","deposit"],["Delivery & refills","delivery"],["Refund policy","refund"],["Supported platforms","platforms"]].map(([label,id])=>
          <div key={label} className="flex items-center gap-2.5 py-2 px-2.5 rounded-lg text-[13px]" style={{ background: dark ? "rgba(255,255,255,0.02)" : "rgba(0,0,0,0.02)", color: t.textSoft || t.textMuted }}><QuickIcon id={id} size={14} />{label}</div>
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
