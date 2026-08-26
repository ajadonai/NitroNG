'use client';

import { useState } from "react";
import { PlatformIcon } from "./platform-icon";
import { fN, fD } from "../lib/format";
import { RewardsStrip, ChannelLane, StatusModal, PointsModal } from "./rewards";

const ReferralIcon = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 00-3-3.87" />
    <path d="M16 3.13a4 4 0 010 7.75" />
  </svg>
);

/* Dashboard home content and its desktop right rail live together so the shell
 * only owns navigation, data refresh, and cross-page state. */
import { NotSureHelp } from './new-order';


/** A small uppercase heading above a group, optionally with an action on the right. */
function SectionHead({ children, action }) {
  return <div className="flex items-center justify-between px-0.5 pb-1.5"><span className="text-[10.5px] font-semibold uppercase tracking-[1px] text-t-text-muted">{children}</span>{action}</div>;
}
/** The Orders row without the status pill: platform tile, name, tier, date, and a progress line while delivering. */
function OrderRow({ o, first, dark, t, onClick }) {
  const qty = o.quantity || 0;
  const active = o.status === "Processing" || o.status === "Pending" || o.status === "Partial";
  const delivered = o.status === "Completed" ? qty : o.remains != null ? Math.max(0, qty - Math.max(0, o.remains)) : 0;
  const pct = qty ? Math.min(100, Math.round(delivered / qty * 100)) : 0;
  return (
    <div role="button" tabIndex={0} onClick={onClick} onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick(); } }} className="flex items-center gap-3 py-3 px-3.5 cursor-pointer" style={{ borderTop: first ? "none" : `1px solid ${t.cardBorder}` }}>
      <div className="shrink-0 flex items-center justify-center rounded-xl" style={{ width: 40, height: 40, background: dark ? "rgba(255,255,255,.08)" : "rgba(0,0,0,.04)", border: `1px solid ${dark ? "rgba(255,255,255,.12)" : "rgba(0,0,0,.06)"}` }}><PlatformIcon platform={o.platform} dark={dark} size={22} /></div>
      <div className="min-w-0 flex-1">
        <div className="text-[13.5px] font-semibold truncate text-t-text">{o.service}</div>
        {o.tier && <div className="text-[11.5px] font-medium text-accent">{o.tier}</div>}
        <div className="text-[11px] text-t-text-muted">{o.created ? fD(o.created, true) : ""}</div>
        {active && qty > 0 && <div className="h-[3px] rounded-sm mt-1.5 overflow-hidden" style={{ background: dark ? "rgba(255,255,255,.08)" : "rgba(0,0,0,.05)" }}><div className="h-full rounded-sm" style={{ width: `${pct}%`, background: o.status === "Partial" ? "#f97316" : "#4f46e5" }} /></div>}
      </div>
    </div>
  );
}
function BatchRowMini({ item, first, dark, t, onClick }) {
  return (
    <div role="button" tabIndex={0} onClick={onClick} onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick(); } }} className="flex items-center gap-3 py-3 px-3.5 cursor-pointer" style={{ borderTop: first ? "none" : `1px solid ${t.cardBorder}` }}>
      <div className="shrink-0 flex items-center justify-center rounded-xl text-accent" style={{ width: 40, height: 40, background: dark ? "rgba(196,125,142,.12)" : "rgba(196,125,142,.08)" }}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg></div>
      <div className="min-w-0 flex-1"><div className="text-[13.5px] font-semibold text-t-text">Bulk order</div><div className="text-[11px] text-t-text-muted">{item.orders.length} orders · {item.created ? fD(item.created, true) : ""}</div></div>
    </div>
  );
}

export function OverviewPage({ user, orders, activeOrders, orderSummary, dark, t, setActive, a2hs, socialLinks, rewards, isReseller }) {
  const [tutorialOpen, setTutorialOpen] = useState(false);
  const [tipsOpen, setTipsOpen] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);
  const [pointsOpen, setPointsOpen] = useState(false);
  const balance = user?.balance || 0;
  const activeCount = orderSummary?.active ?? activeOrders.length;
  const isNew = (orderSummary?.total ?? orders.length) === 0;
  const lowBal = balance < 500;
  const primaryAction = isNew
    ? { label: "Place your first order", sub: "Pick a platform and start growing today", target: "services" }
    : lowBal
    ? { label: "Add funds", sub: "Top up your balance to keep the momentum going", target: "add-funds" }
    : activeCount > 0
    ? { label: "Track your orders", sub: `${activeCount} order${activeCount > 1 ? "s" : ""} in progress right now`, target: "orders" }
    : { label: "Start a new order", sub: "Ready when you are — let's keep growing", target: "services" };

  const firstName = user?.firstName || (user?.name || "").split(" ")[0] || "there";
  const hour = new Date().getHours();
  const greet = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const today = new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });
  const showNext = isNew;
  const card = { background: dark ? "rgba(255,255,255,.09)" : "rgba(255,255,255,.85)", border: `1px solid ${dark ? "rgba(255,255,255,.12)" : "rgba(0,0,0,.08)"}` };
  const recent = (() => {
    const items = []; const batches = {};
    for (const o of orders) {
      if (o.batchId) { if (!batches[o.batchId]) { batches[o.batchId] = { type: "batch", batchId: o.batchId, orders: [], created: o.created }; items.push(batches[o.batchId]); } batches[o.batchId].orders.push(o); }
      else items.push({ type: "single", order: o, created: o.created });
    }
    items.sort((a, b) => new Date(b.created) - new Date(a.created));
    return items.slice(0, 5);
  })();
  return (
    <>
      {/* ── Greeting ── */}
      <div className="pb-2 desktop:pb-3 mb-3">
        <div className="text-lg desktop:text-[22px] font-semibold mb-0.5 text-t-text">{greet}, {firstName}</div>
        <div className="text-sm desktop:text-[15px] text-t-text-muted">{today}</div>
        <div className="page-divider bg-t-card-border" />
      </div>

      {/* ── Balance: the biggest number on the page, and the two things you do with it ── */}
      <div className="flex items-end justify-between gap-3 rounded-2xl p-4 mb-4" style={card}>
        <div className="min-w-0">
          <div className="text-[10.5px] font-semibold uppercase tracking-[1px] text-t-text-muted">Balance</div>
          <div className="m text-[30px] desktop:text-[34px] font-bold leading-none mt-1 text-t-text" style={{ letterSpacing: "-.01em" }}>{fN(balance)}</div>
        </div>
        <div className="flex max-md:flex-col gap-1.5 shrink-0">
          <button onClick={() => setActive("add-funds")} className="h-[34px] px-3.5 rounded-[10px] border-none text-[13px] font-semibold cursor-pointer text-white inline-flex items-center gap-1.5 justify-center" style={{ background: t.accent, boxShadow: "0 6px 16px rgba(196,125,142,.3)" }}><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>Top up</button>
          <button onClick={() => setActive("services")} className="h-[34px] px-3.5 rounded-[10px] text-[13px] font-semibold cursor-pointer border border-solid inline-flex items-center justify-center text-t-text" style={{ background: "transparent", borderColor: t.cardBorder }}>New order</button>
        </div>
      </div>

      {/* Add to Home Screen — mobile/tablet only */}
      {!a2hs.dismissed && (a2hs.ready || a2hs.isIos) && (
        <div className="hidden max-desktop:flex items-center gap-3 rounded-[14px] max-md:rounded-xl py-3.5 px-5 max-md:py-3 max-md:px-4 mb-5 max-md:mb-4" style={{ background: dark ? "rgba(196,125,142,.12)" : "rgba(196,125,142,.08)", border: `1px solid ${dark ? "rgba(196,125,142,.24)" : "rgba(196,125,142,.18)"}` }}>
          <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: "linear-gradient(135deg, #c47d8e, #8b5e6b)" }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14"/></svg>
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold text-t-text">Add Nitro to Home Screen</div>
            {a2hs.isIos ? (
              <div className="text-[13px] mt-0.5 text-t-text-muted">
                Tap <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="inline -mt-px mx-0.5"><path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg> then <strong>"Add to Home Screen"</strong>
              </div>
            ) : (
              <div className="text-[13px] mt-0.5 text-t-text-muted">Get quick access like a native app</div>
            )}
          </div>
          {a2hs.ready && !a2hs.isIos && (
            <button onClick={a2hs.onInstall} className="shrink-0 py-2 px-4 rounded-lg text-[13px] font-semibold border-none cursor-pointer transition-transform duration-200 hover:-translate-y-px bg-accent text-white">Add</button>
          )}
          <button onClick={a2hs.onDismiss} className="shrink-0 w-7 h-7 rounded-lg flex items-center justify-center border-none cursor-pointer transition-transform duration-200 hover:-translate-y-px text-t-text-muted" style={{ background: dark ? "rgba(255,255,255,.16)" : "rgba(0,0,0,.08)" }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
      )}

      {/* ── First order nudge: the balance card already carries Top up and New order ── */}
      {showNext && (
        <button onClick={() => setActive(primaryAction.target)} className="w-full flex items-center gap-2.5 rounded-[14px] px-3 py-2.5 mb-4 cursor-pointer text-left font-[inherit] border border-solid" style={{ background: dark ? "rgba(196,125,142,.12)" : "rgba(196,125,142,.07)", borderColor: "rgba(196,125,142,.35)" }}>
          <span className="w-[34px] h-[34px] rounded-[10px] flex items-center justify-center shrink-0 text-white" style={{ background: t.accent }}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg></span>
          <span className="flex flex-col gap-px flex-1 min-w-0"><b className="text-[13.5px] font-semibold text-t-text">{primaryAction.label}</b><small className="text-[11.5px] text-t-text-muted">{primaryAction.sub}</small></span>
        </button>
      )}

      {/* ── Rewards ── */}
      <SectionHead>Rewards</SectionHead>
      <RewardsStrip rewards={rewards} dark={dark} t={t} onStatus={() => setStatusOpen(true)} onPoints={() => setPointsOpen(true)} onTasks={() => setActive("tasks")} />

      {/* ── Quick links: the three tiles, icons in their gradients ── */}
      <div className="grid grid-cols-3 gap-1.5 mb-[18px] -mt-2">
        {[
          { label: "How it works", onClick: () => setTutorialOpen(true), gradient: "linear-gradient(135deg,#a78bfa,#7c3aed)", icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polygon points="6 4 20 12 6 20 6 4"/></svg> },
          { label: "What to expect", onClick: () => setTipsOpen(true), gradient: "linear-gradient(135deg,#38bdf8,#0284c7)", icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 8v4.5l3 2"/></svg> },
          { label: "Support", wa: true, onClick: () => { if (socialLinks?.social_whatsapp_support) window.open(`https://wa.me/${socialLinks.social_whatsapp_support.replace(/\D/g, "")}?text=${encodeURIComponent("Hi Nitro, I need help")}`, "_blank"); }, gradient: "linear-gradient(135deg,#25d366,#128c7e)", icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="#fff"><path d="M12 2A10 10 0 002 12c0 1.8.5 3.5 1.3 5L2 22l5.2-1.3A10 10 0 1012 2zm0 18.2c-1.6 0-3.1-.4-4.4-1.2l-.3-.2-3 .8.8-3-.2-.3A8.2 8.2 0 1112 20.2zm4.6-6.1c-.3-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1-.2.3-.7.8-.8 1-.1.2-.3.2-.5.1a6.7 6.7 0 01-2-1.2 7.5 7.5 0 01-1.4-1.7c-.1-.3 0-.4.1-.5l.4-.5c.1-.2.2-.3.3-.5v-.5c0-.1-.6-1.4-.8-1.9-.2-.5-.4-.4-.6-.4h-.5c-.2 0-.5.1-.7.3-.2.3-.9.9-.9 2.2s.9 2.5 1.1 2.7c.1.2 1.9 2.9 4.6 4 .6.3 1.1.4 1.5.6.6.2 1.2.2 1.6.1.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.2-1.2-.1-.1-.3-.2-.6-.4z"/></svg> },
        ].map(q => (
          <button key={q.label} onClick={q.onClick} className="h-11 rounded-xl border border-solid inline-flex items-center gap-2 text-[12px] font-semibold cursor-pointer font-[inherit] whitespace-nowrap px-2 min-w-0" style={{ background: card.background, borderColor: q.wa ? "rgba(37,211,102,.4)" : t.cardBorder, color: q.wa ? (dark ? "#4ade80" : "#16a34a") : t.textSoft }}>
            <span className="w-[26px] h-[26px] rounded-[8px] flex items-center justify-center shrink-0" style={{ background: q.gradient }}>{q.icon}</span>
            <span className="truncate">{q.label}</span>
          </button>
        ))}
      </div>

      {/* ── Stay updated ── */}
      <SectionHead>Stay updated</SectionHead>
      <ChannelLane dark={dark} t={t} socialLinks={socialLinks} />

      {/* ── Resellers: for anyone who is not one yet ── */}
      {!isReseller && (
        <a href="/resellers" className="flex items-center gap-2.5 rounded-[14px] p-3 mb-[18px] no-underline border border-solid max-md:flex-wrap" style={{ background: dark ? "rgba(196,125,142,.12)" : "rgba(196,125,142,.07)", borderColor: "rgba(196,125,142,.35)" }}>
          <span className="w-[38px] h-[38px] rounded-[11px] flex items-center justify-center shrink-0 text-white" style={{ background: t.accent }}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20.6 13.4 13.4 20.6a2 2 0 01-2.8 0L2 12V2h10l8.6 8.6a2 2 0 010 2.8z"/><circle cx="7" cy="7" r="1.5" fill="currentColor" stroke="none"/></svg></span>
          <span className="flex flex-col gap-0.5 flex-1 min-w-0"><b className="text-[13.5px] font-semibold text-t-text">Sell Nitro at your own prices</b><small className="text-[11.5px] leading-snug text-t-text-muted">Resellers get wholesale rates on every service. Ask support to join.</small></span>
          <span className="h-8 px-3.5 rounded-[10px] text-[12px] font-semibold text-white inline-flex items-center justify-center whitespace-nowrap shrink-0 max-md:w-full max-md:mt-1" style={{ background: t.accent }}><span className="max-md:hidden">Become a reseller</span><span className="md:hidden">Join</span></span>
        </a>
      )}

      {/* ── Delivering now: phone and tablet; the sidebar has it on desktop ── */}
      {activeOrders.length > 0 && (
        <div className="desktop:hidden">
          <SectionHead action={<button onClick={() => setActive("orders")} className="text-[12px] font-semibold bg-transparent border-none cursor-pointer font-[inherit] text-accent">View all</button>}>Delivering now</SectionHead>
          <div className="rounded-[14px] overflow-hidden mb-[18px]" style={card}>
            {activeOrders.slice(0, 3).map((o, i) => <OrderRow key={o.id} o={o} first={i === 0} dark={dark} t={t} onClick={() => setActive("orders")} />)}
          </div>
        </div>
      )}

      {/* ── Recent orders ── */}
      <SectionHead action={orders.length > 0 ? <button onClick={() => setActive("orders")} className="text-[12px] font-semibold bg-transparent border-none cursor-pointer font-[inherit] text-accent">View all</button> : null}>Recent orders</SectionHead>
      <div className="rounded-[14px] overflow-hidden mb-[18px]" style={card}>
        {recent.length > 0 ? recent.map((item, i) => item.type === "batch"
          ? <BatchRowMini key={item.batchId} item={item} first={i === 0} dark={dark} t={t} onClick={() => setActive("orders")} />
          : <OrderRow key={item.order.id} o={item.order} first={i === 0} dark={dark} t={t} onClick={() => setActive("orders")} />
        ) : (
          <div className="py-10 px-[18px] text-center flex flex-col items-center">
            <svg width="48" height="48" viewBox="0 0 64 64" fill="none" className="mb-3 opacity-60">
              <rect x="12" y="8" width="40" height="48" rx="6" stroke={t.accent} strokeWidth="1.5" opacity=".3" />
              <line x1="20" y1="22" x2="44" y2="22" stroke={t.accent} strokeWidth="1.5" opacity=".2" strokeLinecap="round" />
              <line x1="20" y1="30" x2="38" y2="30" stroke={t.accent} strokeWidth="1.5" opacity=".15" strokeLinecap="round" />
              <circle cx="32" cy="38" r="8" stroke={t.accent} strokeWidth="1.5" opacity=".2" />
              <path d="M29 38l2 2 4-4" stroke={t.accent} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity=".4" />
            </svg>
            <div className="text-base font-semibold mb-1 text-t-text-soft">No orders yet</div>
            <div className="text-sm mb-4 leading-[1.5] max-w-[320px] text-t-text-muted">Choose a platform, pick a service, and place your first order.</div>
            <button onClick={() => setActive("services")} className="cursor-pointer py-2.5 px-6 rounded-[10px] text-sm font-semibold border-none transition-transform duration-200 hover:-translate-y-px mb-2 bg-accent text-white">Place first order</button>
            <button onClick={() => setActive("guide")} className="cursor-pointer py-2 px-4 rounded-[10px] text-[13px] font-medium border-none transition-transform duration-200 hover:-translate-y-px bg-transparent text-t-text-muted">View blog</button>
            <div className="mt-3"><NotSureHelp waNumber={(socialLinks?.social_whatsapp_support || "").replace(/\D/g, "")} dark={dark} t={t} email={user?.email} /></div>
          </div>
        )}
      </div>

      {/* ── Rewards modals ── */}
      <StatusModal open={statusOpen} onClose={() => setStatusOpen(false)} rewards={rewards} dark={dark} t={t} />
      <PointsModal open={pointsOpen} onClose={() => setPointsOpen(false)} rewards={rewards} dark={dark} t={t} onUse={() => { setPointsOpen(false); setActive("services"); }} />

      {/* Tutorial popup */}
      {tutorialOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 backdrop-blur-[4px] animate-[modalFadeIn_.2s_ease]" onClick={() => setTutorialOpen(false)} style={{ background: "rgba(0,0,0,.45)" }}>
          <div role="dialog" aria-modal="true" className="w-full max-w-[420px] rounded-2xl overflow-hidden animate-[modalBounceIn_.3s_cubic-bezier(.34,1.56,.64,1)_both]" onClick={e => e.stopPropagation()} style={{ background: dark ? "#0e1120" : "#fff", border: `1px solid ${dark ? "rgba(255,255,255,.22)" : "rgba(0,0,0,.14)"}`, boxShadow: dark ? "0 20px 60px rgba(0,0,0,.4)" : "0 20px 60px rgba(0,0,0,.1)" }}>
            <div className="py-4 px-5 flex items-center justify-between" style={{ background: dark ? "rgba(196,125,142,.1)" : "rgba(196,125,142,.06)", borderBottom: `1px solid ${dark ? "rgba(196,125,142,.15)" : "rgba(196,125,142,.1)"}` }}>
              <div className="text-[15px] font-semibold text-t-text">How it works</div>
              <button onClick={() => setTutorialOpen(false)} className="w-7 h-7 rounded-lg flex items-center justify-center border border-solid cursor-pointer bg-transparent text-t-text-soft" style={{ borderColor: dark ? "rgba(255,255,255,.22)" : "rgba(0,0,0,.14)" }}><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
            </div>
            <div className="py-5 px-5 flex flex-col gap-3.5 max-h-[70vh] overflow-y-auto">
              {[
                { step: "1", title: "Create your account", desc: "Sign up with your email — it only takes a few seconds." },
                { step: "2", title: "Add funds", desc: "Top up your balance via bank transfer or card payment." },
                { step: "3", title: "Pick a platform", desc: "Choose Instagram, TikTok, X, or any platform you want to grow on." },
                { step: "4", title: "Choose a service & tier", desc: "Pick what you need — followers, likes, views — then select Budget (no refill), Standard (30-day refill), or Premium (lifetime refill)." },
                { step: "5", title: "Paste your link", desc: "Drop your profile or post link and set the quantity you want." },
                { step: "6", title: "Place your order", desc: "Confirm and your order starts processing. Track delivery in real time from your dashboard." },
                { step: "7", title: "Track delivery", desc: "Watch your order progress in real time from your dashboard." },
              ].map((item, i) => (
                <div key={i} className="flex items-start gap-3">
                  <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-[11px] font-bold text-accent" style={{ background: dark ? "rgba(196,125,142,.2)" : "rgba(196,125,142,.12)" }}>{item.step}</div>
                  <div className="pt-0.5">
                    <div className="text-[13px] font-semibold mb-0.5 text-t-text">{item.title}</div>
                    <div className="text-[11px] leading-[1.55] text-t-text-muted">{item.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* What to Expect popup */}
      {tipsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 backdrop-blur-[4px] animate-[modalFadeIn_.2s_ease]" onClick={() => setTipsOpen(false)} style={{ background: "rgba(0,0,0,.45)" }}>
          <div role="dialog" aria-modal="true" className="w-full max-w-[420px] rounded-2xl overflow-hidden animate-[modalBounceIn_.3s_cubic-bezier(.34,1.56,.64,1)_both]" onClick={e => e.stopPropagation()} style={{ background: dark ? "#0e1120" : "#fff", border: `1px solid ${dark ? "rgba(255,255,255,.22)" : "rgba(0,0,0,.14)"}`, boxShadow: dark ? "0 20px 60px rgba(0,0,0,.4)" : "0 20px 60px rgba(0,0,0,.1)" }}>
            <div className="py-4 px-5 flex items-center justify-between" style={{ background: dark ? "rgba(196,125,142,.1)" : "rgba(196,125,142,.06)", borderBottom: `1px solid ${dark ? "rgba(196,125,142,.15)" : "rgba(196,125,142,.1)"}` }}>
              <div className="text-[15px] font-semibold text-t-text">What to Expect</div>
              <button onClick={() => setTipsOpen(false)} className="w-7 h-7 rounded-lg flex items-center justify-center border border-solid cursor-pointer bg-transparent text-t-text-soft" style={{ borderColor: dark ? "rgba(255,255,255,.22)" : "rgba(0,0,0,.14)" }}><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
            </div>
            <div className="py-5 px-5 flex flex-col gap-4 max-h-[70vh] overflow-y-auto">
              {[
                { icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>, color: dark ? "#a5b4fc" : "#4f46e5", title: "Gradual delivery", desc: "Orders are delivered over hours or days, not all at once. This keeps activity looking natural and protects your account from being flagged." },
                { icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></svg>, color: dark ? "#fbbf24" : "#d97706", title: "Normal drops happen", desc: "Social platforms routinely clean up inactive or low-quality accounts. A small drop after delivery is expected — it's the platform doing its job, not a problem with your order." },
                { icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M23 4v6h-6"/><path d="M1 20v-6h6"/><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/></svg>, color: dark ? "#6ee7b7" : "#059669", title: "Refill is your safety net", desc: "Standard includes a 30-day refill and Premium includes lifetime refill. If a cleanup hits your count, we top you back up at no extra cost." },
                { icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>, color: dark ? "#f9a8d4" : "#be185d", title: "Keep your account safe", desc: "Always set your profile to public before ordering — there are no refunds for orders placed on private profiles. Start small with Budget to test, and avoid ordering on brand-new accounts with zero content." },
              ].map((item, i) => (
                <div key={i} className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5" style={{ background: `${item.color}14`, color: item.color }}>{item.icon}</div>
                  <div>
                    <div className="text-[13px] font-semibold mb-0.5 text-t-text">{item.title}</div>
                    <div className="text-[11px] leading-[1.55] text-t-text-muted">{item.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Referral — phone and tablet; the sidebar has it on desktop ── */}
      <div className="hidden max-desktop:block mb-4 rounded-[14px] px-3.5" style={card}>
        <div className="text-[10.5px] font-semibold uppercase tracking-[1px] pt-2.5 pb-0.5 text-t-text-muted">Referral</div>
        {[["Your code", <span key="c" className="inline-flex items-center gap-1.5"><b className="m text-[14px] font-semibold tracking-[1.5px] text-accent">{user?.refCode || "—"}</b></span>],["Referrals", <b key="r" className="m text-[14px] font-semibold text-t-text">{user?.refs || 0}</b>],["Earned", <b key="e" className="m text-[14px] font-semibold" style={{ color: dark ? "#6ee7b7" : "#059669" }}>{fN(user?.earnings || 0)}</b>]].map(([label, val], i) => (
          <div key={label} className="flex items-center justify-between gap-3 py-2.5 text-[13px] text-t-text-soft" style={{ borderTop: i > 0 ? `1px solid ${t.cardBorder}` : "none" }}><span>{label}</span>{val}</div>
        ))}
        <button onClick={() => setActive("referrals")} className="w-full my-2.5 py-2 rounded-lg text-[13px] font-semibold border-none cursor-pointer text-accent" style={{ background: dark ? "rgba(196,125,142,.12)" : "rgba(196,125,142,.08)" }}>Invite friends</button>
      </div>
    </>
  );
}

export function RightSidebar({ activeOrders, orderSummary, user, dark, t, setActive }) {
  const activeCount = orderSummary?.active ?? activeOrders.length;
  const topPlatform = orderSummary?.topPlatform;
  const avgQty = orderSummary?.averageQuantity || 0;
  const memberDate = user?.createdAt ? new Date(user.createdAt).toLocaleDateString("en-GB", { month: "short", year: "numeric" }) : "—";
  const wkOrders = orderSummary?.thisWeek || 0;

  const statTiles = [
    { label: "Top platform", value: topPlatform ? topPlatform.charAt(0).toUpperCase() + topPlatform.slice(1) : "—", iconBg: dark ? "rgba(196,125,142,.12)" : "rgba(196,125,142,.08)", icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={t.accent} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1112.63 8 4 4 0 0116 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/></svg> },
    { label: "Avg size", value: avgQty > 0 ? avgQty.toLocaleString() : "—", iconBg: dark ? "rgba(165,180,252,.1)" : "rgba(79,70,229,.07)", icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={dark ? "#a5b4fc" : "#4f46e5"} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/></svg> },
    { label: "This week", value: wkOrders > 0 ? String(wkOrders) : "0", iconBg: dark ? "rgba(110,231,183,.08)" : "rgba(5,150,105,.06)", icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={dark ? "#6ee7b7" : "#059669"} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg> },
    { label: "Member", value: memberDate, iconBg: dark ? "rgba(224,164,88,.08)" : "rgba(217,119,6,.06)", icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={dark ? "#e0a458" : "#d97706"} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg> },
  ];

  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-[14px] px-3.5 bg-t-card-bg" style={{ border: `1px solid ${t.cardBorder}` }}>
        <div className="text-[10.5px] font-semibold uppercase tracking-[1px] pt-2.5 pb-0.5 text-t-text-muted">Your stats</div>
        {statTiles.map(({ label, value }, i) => (
          <div key={label} className="flex items-center justify-between gap-3 py-2.5 text-[13px] text-t-text-soft" style={{ borderTop: i > 0 ? `1px solid ${t.cardBorder}` : "none" }}><span>{label === "Avg size" ? "Average order" : label === "Member" ? "Member since" : label}</span><b className="m text-[14px] font-semibold text-t-text">{value}</b></div>
        ))}
      </div>
      <div>
        <SectionHead action={activeCount > 0 ? <button onClick={() => setActive("orders")} className="text-[12px] font-semibold bg-transparent border-none cursor-pointer font-[inherit] text-accent">View all</button> : null}>Delivering now</SectionHead>
        <div className="rounded-[14px] overflow-hidden bg-t-card-bg" style={{ border: `1px solid ${t.cardBorder}` }}>
          {activeCount === 0 && <div className="py-4 px-3.5 text-[13px] text-t-text-muted">Nothing delivering right now.</div>}
          {activeOrders.slice(0, 5).map((o, i) => <OrderRow key={o.id} o={o} first={i === 0} dark={dark} t={t} onClick={() => setActive("orders")} />)}
        </div>
      </div>
      <div className="rounded-[14px] px-3.5 bg-t-card-bg" style={{ border: `1px solid ${t.cardBorder}` }}>
        <div className="text-[10.5px] font-semibold uppercase tracking-[1px] pt-2.5 pb-0.5 text-t-text-muted">Referral</div>
        {[["Your code", <b key="c" className="m text-[14px] font-semibold tracking-[1.5px] text-accent">{user?.refCode || "—"}</b>],["Referrals", <b key="r" className="m text-[14px] font-semibold text-t-text">{user?.refs || 0}</b>],["Earned", <b key="e" className="m text-[14px] font-semibold" style={{ color: dark ? "#6ee7b7" : "#059669" }}>{fN(user?.earnings || 0)}</b>]].map(([label, val], i) => (
          <div key={label} className="flex items-center justify-between gap-3 py-2.5 text-[13px] text-t-text-soft" style={{ borderTop: i > 0 ? `1px solid ${t.cardBorder}` : "none" }}><span>{label}</span>{val}</div>
        ))}
        <button onClick={() => setActive("referrals")} className="w-full my-2.5 py-2 rounded-lg text-[13px] font-semibold border-none cursor-pointer text-accent" style={{ background: dark ? "rgba(196,125,142,.12)" : "rgba(196,125,142,.08)" }}>Invite friends</button>
      </div>
    </div>
  );
}
