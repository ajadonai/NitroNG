'use client';

import { useState } from "react";
import { RailSec, RailCard, RailFact, RailRow, RailLink, RailBtn, RailEmpty } from "./rail";
import { Modal } from "./ui-primitives";
import { PlatformIcon } from "./platform-icon";
import { useMoney, useT, useLocale } from "./locale";
import { dateLocale } from "../lib/format";
import { MAX_BONUS_NAIRA } from "../lib/welcome-bonus";
import { fD } from "../lib/format";
import { RewardsStrip, ChannelLane, StatusModal, PointsModal } from "./rewards";


/* Dashboard home content and its desktop right rail live together so the shell
 * only owns navigation, data refresh, and cross-page state. */
import { NotSureHelp } from './new-order';
import { OffsetIcon, CurrencyCoin } from "./offset-icons";
import { sClr, STATUS_SHOWN, TIER_LOOK } from "./order-look";
import { CopyChip } from "./copy-chip";


/* The home page in the offset print (approved 17 Oct 2026, mockup "Nitro
   Home"): one money card, the History row, and the eyebrow both sidebars use.
   Logical properties throughout: this sheet does not go through the RTL build
   plugin. No child combinators either, which the i18n scanner reads as copy. */
const HOME_CSS = `
.hm-eb{display:flex;align-items:center;gap:8px;margin:0 0 8px;padding:0 2px}
.hm-eb::after{content:"";flex:1;height:1px;background:var(--t-sidebar-border);opacity:.7;order:1}
.hm-ebl{font-size:10.5px;font-weight:700;letter-spacing:1.3px;text-transform:uppercase;color:var(--t-text-muted);white-space:nowrap}
.hm-act{order:2;display:inline-flex;align-items:center;gap:4px;padding:0;border:0;background:none;font:inherit;font-size:12px;font-weight:650;color:var(--t-accent-ink);cursor:pointer;white-space:nowrap}
.hm-money{background:var(--t-card-bg);border:1px solid var(--t-card-border);border-radius:16px;overflow:hidden;margin-bottom:12px}
.hm-mtop{display:flex;align-items:flex-end;justify-content:space-between;gap:14px;padding:16px 18px}
.hm-lab{display:inline-flex;align-items:center;gap:6px;font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:var(--t-text-muted)}
.hm-lab svg{color:var(--t-accent-ink)}
.hm-bal{display:block;margin-top:8px;font-size:38px;font-weight:700;line-height:1;letter-spacing:-.035em;color:var(--t-text);white-space:nowrap}
.hm-cur{font-weight:600;font-size:.78em;color:var(--t-text-muted);margin-inline-end:2px}
.hm-mact{display:flex;gap:8px;flex-shrink:0}
.hm-big{height:38px;padding-inline:16px;font-size:13.5px;border-radius:999px}
.hm-big.sec svg{color:var(--t-accent-ink)}
@media (max-width:767px){.hm-mtop{flex-direction:column;align-items:stretch;padding:14px;gap:12px}.hm-bal{font-size:34px}.hm-mact{display:grid;grid-template-columns:1fr 1fr}}
.hm-help{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin-bottom:22px}
.hm-hb{height:42px;min-width:0;padding:0 8px;border-radius:12px;border:1px solid var(--t-card-border);background:var(--t-card-bg);display:inline-flex;align-items:center;justify-content:center;gap:8px;font:inherit;font-size:13px;font-weight:600;color:var(--t-text-soft);cursor:pointer;transition:transform .15s}
.hm-hb:hover{transform:translateY(-1px)}
.hm-hb svg{color:var(--t-accent-ink);flex-shrink:0}
.hm-hb.wa{color:#16a34a;border-color:rgba(37,211,102,.4)}
.dark .hm-hb.wa{color:#4ade80}
.hm-hb.wa svg{color:inherit}
@media (max-width:767px){.hm-help{gap:6px}.hm-hb{height:58px;flex-direction:column;gap:5px;font-size:11.5px}}
.hm-list{background:var(--t-card-bg);border:1px solid var(--t-card-border);border-radius:14px;overflow:hidden;margin-bottom:22px}
.hm-or{display:grid;grid-template-columns:auto 1fr auto;gap:12px;align-items:center;padding:12px 16px;border-top:1px solid var(--t-card-border);cursor:pointer;transition:background-color .15s}
.hm-or:first-child{border-top:0}
.hm-or:hover{background:color-mix(in srgb,var(--t-accent) 5%,transparent)}
.hm-pi{width:38px;height:38px;border-radius:11px;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;color:var(--t-accent-ink);background:rgba(196,125,142,.14);box-shadow:2px 2px 0 #efc4cf}
.dark .hm-pi{background:rgba(196,125,142,.2);box-shadow:2px 2px 0 #6b3a4a}
.hm-tx{min-width:0;display:flex;flex-direction:column;align-items:flex-start;gap:2px}
.hm-nm{max-width:100%;font-size:14px;font-weight:650;color:var(--t-text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.hm-tier{display:inline-flex;align-items:center;gap:3px;font-size:11.5px;font-weight:700;color:var(--tc);white-space:nowrap}
.hm-when{font-size:11.5px;color:var(--t-text-muted)}
.hm-st{display:inline-flex;align-items:center;gap:5px;height:20px;padding:0 7px;border-radius:6px;font-size:10.5px;font-weight:750;white-space:nowrap;color:var(--sc);background:color-mix(in srgb,var(--sc) 10%,var(--t-card-bg));box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--sc) 35%,transparent)}
.hm-dot{width:6px;height:6px;border-radius:50%;background:var(--sc);animation:hmPulse 1.6s ease-in-out infinite}
@keyframes hmPulse{50%{opacity:.35}}
.hm-bar{grid-column:2 / -1;height:4px;margin-top:-4px;border-radius:2px;background:var(--t-card-border);overflow:hidden}
.hm-bar span{display:block;height:100%;border-radius:2px;background:var(--sc)}
.hm-bar.wait span{width:100%;background:repeating-linear-gradient(-55deg,color-mix(in srgb,var(--t-text-muted) 40%,transparent) 0 6px,transparent 6px 12px)}
@media (max-width:767px){.hm-or{gap:10px;padding:11px 12px}}
.hm-facts{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px;margin-bottom:8px}
.hm-f{min-width:0;padding:8px 10px;border:1px solid var(--t-card-border);border-radius:12px;background:var(--t-card-bg)}
.hm-fl{display:flex;align-items:center;gap:5px;font-size:10.5px;font-weight:600;color:var(--t-text-muted);white-space:nowrap}
.hm-fl svg{color:var(--t-accent-ink)}
.hm-fv{display:flex;align-items:center;gap:6px;min-height:24px;margin-top:3px;font-size:13.5px;font-weight:700;color:var(--t-text);white-space:nowrap;overflow:hidden}
.hm-inv{width:100%;height:38px;margin-bottom:16px;border:0;border-radius:10px;background:rgba(196,125,142,.1);color:var(--t-accent-ink);font:inherit;font-size:13px;font-weight:650;display:flex;align-items:center;justify-content:center;gap:6px;cursor:pointer}
.dark .hm-inv{background:rgba(196,125,142,.14)}
.hm-rs{position:relative;overflow:hidden;isolation:isolate;container-type:inline-size;display:flex;align-items:center;gap:14px;padding:16px 18px;min-height:96px;margin-bottom:22px;border-radius:16px;color:#fff;text-decoration:none;box-shadow:3px 3px 0 #3a1828;background:radial-gradient(70% 160% at 78% 50%,rgba(255,196,214,.38),transparent 62%),linear-gradient(115deg,#381a2a 0%,#6a3450 44%,#b56c82 100%)}
.dark .hm-rs{box-shadow:3px 3px 0 #5c2c42}
.hm-rs::after{content:"";position:absolute;inset:0;z-index:0;pointer-events:none;background:linear-gradient(105deg,transparent 38%,rgba(255,255,255,.2) 50%,transparent 62%);transform:translateX(-110%);animation:hmSheen 6.5s ease-in-out infinite}
@keyframes hmSheen{0%,62%{transform:translateX(-110%)}100%{transform:translateX(110%)}}
.hm-ill{position:absolute;z-index:0;inset-inline-end:184px;top:50%;width:184px;height:88px;margin-top:-44px;pointer-events:none}
.hm-tag{position:absolute;display:inline-flex;align-items:center;height:30px;padding-inline:20px 12px;font-size:11.5px;font-weight:800;white-space:nowrap;border-start-end-radius:7px;border-end-end-radius:7px;clip-path:polygon(12px 0,100% 0,100% 100%,12px 100%,0 50%)}
[dir="rtl"] .hm-tag{clip-path:polygon(0 0,calc(100% - 12px) 0,100% 50%,calc(100% - 12px) 100%,0 100%)}
.hm-tag::before{content:"";position:absolute;inset-inline-start:9px;top:50%;width:6px;height:6px;margin-top:-3px;border-radius:50%;background:currentColor}
.hm-tag.ws{inset-inline-start:0;top:48px;color:rgba(255,255,255,.92);background:rgba(255,255,255,.16);transform:rotate(-7deg)}
.hm-tagw{position:absolute;inset-inline-start:64px;top:6px;filter:drop-shadow(2.5px 2.5px 0 rgba(40,10,25,.3));animation:hmSway 4.5s ease-in-out infinite}
.hm-tagw .hm-tag{position:relative;color:#6a3450;background:#fff;transform:rotate(6deg)}
@keyframes hmSway{50%{transform:rotate(-4deg)}}
.hm-vg{position:relative;z-index:1;width:38px;height:38px;border-radius:12px;display:grid;place-items:center;flex-shrink:0;color:#fff;background:rgba(255,255,255,.18);box-shadow:inset 0 0 0 1px rgba(255,255,255,.3),2px 2px 0 rgba(0,0,0,.16)}
.hm-vg .ic-off{opacity:.3}
.hm-rst{position:relative;z-index:1;flex:1;min-width:0}
.hm-rst b{display:block;font-size:15.5px;font-weight:750;letter-spacing:-.01em;text-shadow:0 1px 2px rgba(0,0,0,.14)}
.hm-rst small{display:block;max-width:34ch;margin-top:2px;font-size:12px;opacity:.9}
.hm-go{position:relative;z-index:1;display:inline-flex;align-items:center;justify-content:center;gap:6px;height:36px;padding:0 15px;border-radius:999px;background:#fff;color:#5a2840;font-size:12.5px;font-weight:750;white-space:nowrap;box-shadow:2px 2px 0 rgba(40,10,25,.38);flex-shrink:0}
@container (max-width:659px){.hm-ill{display:none}}
@media (max-width:767px){.hm-rs{flex-direction:column;align-items:flex-start;gap:10px;padding:14px}.hm-ill{display:block;inset-inline-end:-6px;top:2px;margin-top:0;zoom:.72}.hm-go{width:100%}}
@media (prefers-reduced-motion:reduce){.hm-dot,.hm-rs::after,.hm-tagw{animation:none}}
`;
const ARROW = <svg className="dir-flip" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg>;
const WA_GLYPH = <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2A10 10 0 002 12c0 1.8.5 3.5 1.3 5L2 22l5.2-1.3A10 10 0 1012 2zm0 18.2c-1.6 0-3.1-.4-4.4-1.2l-.3-.2-3 .8.8-3-.2-.3A8.2 8.2 0 1112 20.2zm4.6-6.1c-.3-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1-.2.3-.7.8-.8 1-.1.2-.3.2-.5.1a6.7 6.7 0 01-2-1.2 7.5 7.5 0 01-1.4-1.7c-.1-.3 0-.4.1-.5l.4-.5c.1-.2.2-.3.3-.5v-.5c0-.1-.6-1.4-.8-1.9-.2-.5-.4-.4-.6-.4h-.5c-.2 0-.5.1-.7.3-.2.3-.9.9-.9 2.2s.9 2.5 1.1 2.7c.1.2 1.9 2.9 4.6 4 .6.3 1.1.4 1.5.6.6.2 1.2.2 1.6.1.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.2-1.2-.1-.1-.3-.2-.6-.4z" /></svg>;

/** The eyebrow both sidebars use: a small uppercase heading, a hairline, and an optional action on the end. */
function SectionHead({ children, action }) {
  return <div className="hm-eb"><span className="hm-ebl">{children}</span>{action}</div>;
}
function ViewAll({ onClick }) {
  const tr = useT();
  return <button type="button" onClick={onClick} className="hm-act">{tr("View all")}{ARROW}</button>;
}
/** The History row, three lines: what, its tier, when. A status chip on the end, and a bar only while it delivers. */
function OrderRow({ o, dark, onClick }) {
  const tr = useT();
  const s = o.status;
  const c = sClr(s, dark);
  const qty = o.quantity || 0;
  const delivered = s === "Completed" ? qty : o.remains != null ? Math.max(0, qty - Math.max(0, o.remains)) : 0;
  const pct = qty ? Math.min(100, Math.round(delivered / qty * 100)) : 0;
  const look = o.tier ? TIER_LOOK[o.tier] : null;
  return (
    <div role="button" tabIndex={0} onClick={onClick} onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick(); } }} className="hm-or">
      <PlatformIcon platform={o.platform} dark={dark} size={38} print />
      <span className="hm-tx">
        <span className="hm-nm">{o.service}</span>
        {o.tier && <span className="hm-tier" style={{ "--tc": look ? (dark ? look[2] : look[1]) : "var(--t-accent-ink)" }}>{look && <OffsetIcon name={look[0]} size={11} />}{tr(o.tier)}</span>}
        <span className="hm-when">{o.created ? fD(o.created, true) : ""}</span>
      </span>
      <span className="hm-st" style={{ "--sc": c }}>{(s === "Processing" || s === "Pending") && <span className="hm-dot" />}{tr(STATUS_SHOWN[s] || s)}</span>
      {s === "Processing" && qty > 0 && <span className="hm-bar" style={{ "--sc": c }}><span style={{ width: `${pct}%` }} /></span>}
      {s === "Pending" && <span className="hm-bar wait"><span /></span>}
    </div>
  );
}
function BatchRowMini({ item, onClick }) {
  const tr = useT();
  return (
    <div role="button" tabIndex={0} onClick={onClick} onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick(); } }} className="hm-or">
      <span className="hm-pi"><OffsetIcon name="cart" size={18} /></span>
      <span className="hm-tx">
        <span className="hm-nm">{tr("Bulk order")}</span>
        <span className="hm-when">{item.orders.length} {item.orders.length === 1 ? tr("order") : tr("orders")}</span>
        <span className="hm-when">{item.created ? fD(item.created, true) : ""}</span>
      </span>
    </div>
  );
}

export function OverviewPage({ user, orders, activeOrders, orderSummary, dark, t, setActive, socialLinks, rewards, isReseller }) {
  const tr = useT();
  const lang = useLocale()?.lang ?? "en";
  const money = useMoney();
  const [tutorialOpen, setTutorialOpen] = useState(false);
  const [tipsOpen, setTipsOpen] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);
  const [pointsOpen, setPointsOpen] = useState(false);
  const balance = user?.balance || 0;
  const activeCount = orderSummary?.active ?? activeOrders.length;
  const isNew = (orderSummary?.total ?? orders.length) === 0;
  const lowBal = balance < 500;
  const neverPaid = !!user?.welcomeBonusEligible;
  const primaryAction = neverPaid
    ? { label: `${tr("Get up to")} ${money(MAX_BONUS_NAIRA, { round: "down" })} ${tr("free on your first top-up")}`, sub: tr("One time, for new accounts"), target: "add-funds", gift: true }
    : isNew
    ? { label: tr("Place your first order"), sub: tr("Pick a platform and start growing today"), target: "services" }
    : lowBal
    ? { label: tr("Add funds"), sub: tr("Top up your balance to keep the momentum going"), target: "add-funds" }
    : activeCount > 0
    ? { label: tr("Track your orders"), sub: `${activeCount} ${activeCount > 1 ? tr("orders") : tr("order")} ${tr("in progress right now")}`, target: "orders" }
    : { label: tr("Start a new order"), sub: tr("Ready when you are. Let's keep growing"), target: "services" };

  const firstName = user?.firstName || (user?.name || "").split(" ")[0] || "there";
  const hour = new Date().getHours();
  const greet = hour < 12 ? tr("Good morning") : hour < 17 ? tr("Good afternoon") : tr("Good evening");
  const today = new Date().toLocaleDateString(dateLocale(lang), { weekday: "long", day: "numeric", month: "long" });
  const showNext = isNew || neverPaid;
  // The currency mark sits a step quieter than the figure it belongs to.
  const balText = money(balance, { round: "down" });
  const [, balMark, balFigure] = balText.match(/^([^\d]*)(.*)$/) || [null, "", balText];
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

      <style>{HOME_CSS}</style>
      {/* ── Money: the balance, the two things you do with it, and the rewards underneath ── */}
      <div className="hm-money">
        <div className="hm-mtop">
          <div className="min-w-0">
            <span className="hm-lab"><OffsetIcon name="wallet" size={13} />{tr("Balance")}</span>
            <span className="m hm-bal"><span className="hm-cur">{balMark}</span>{balFigure}</span>
          </div>
          <div className="hm-mact">
            <button onClick={() => setActive("add-funds")} className="nb nitro-money-btn hm-big"><OffsetIcon name="topup" size={15} />{tr("Top up")}</button>
            <button onClick={() => setActive("services")} className="nb sec hm-big"><OffsetIcon name="rocket" size={15} />{tr("New order")}</button>
          </div>
        </div>
        <RewardsStrip rewards={rewards} dark={dark} t={t} onStatus={() => setStatusOpen(true)} onPoints={() => setPointsOpen(true)} onTasks={() => setActive("tasks")} />
      </div>

      {/* ── First order nudge: the money card already carries Top up and New order ── */}
      {showNext && (
        <button onClick={() => setActive(primaryAction.target)} className="w-full flex items-center gap-2.5 rounded-[14px] px-3 py-2.5 mb-3 cursor-pointer text-left font-[inherit] border border-solid" style={{ background: dark ? "rgba(196,125,142,.12)" : "rgba(196,125,142,.07)", borderColor: "rgba(196,125,142,.35)" }}>
          <span className="w-[34px] h-[34px] rounded-[10px] flex items-center justify-center shrink-0 text-white" style={{ background: primaryAction.gift ? "linear-gradient(135deg,#c47d8e,#8b5e6b)" : t.accent }}>
            {primaryAction.gift
              ? <OffsetIcon name="gift" size={16} />
              : <svg className="dir-flip" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>}
          </span>
          <span className="flex flex-col gap-px flex-1 min-w-0"><b className="text-[13.5px] font-semibold text-t-text">{primaryAction.label}</b><small className="text-[11.5px] text-t-text-muted">{primaryAction.sub}</small></span>
        </button>
      )}

      {/* ── Help: plain buttons with printed icons. On a phone the icon sits above the word. ── */}
      <div className="hm-help">
        <button type="button" onClick={() => setTutorialOpen(true)} className="hm-hb"><OffsetIcon name="play" size={16} /><span className="truncate max-w-full">{tr("How it works")}</span></button>
        <button type="button" onClick={() => setTipsOpen(true)} className="hm-hb"><OffsetIcon name="clockPlain" size={16} /><span className="truncate max-w-full">{tr("What to expect")}</span></button>
        <button type="button" onClick={() => { if (socialLinks?.social_whatsapp_support) window.open(`https://wa.me/${socialLinks.social_whatsapp_support.replace(/\D/g, "")}?text=${encodeURIComponent("Hi Nitro, I need help")}`, "_blank"); }} className="hm-hb wa">{WA_GLYPH}<span className="truncate max-w-full">{tr("Support")}</span></button>
      </div>

      {/* ── Stay updated ── */}
      <SectionHead>{tr("Stay updated")}</SectionHead>
      <ChannelLane dark={dark} t={t} socialLinks={socialLinks} />

      {/* ── Resellers: for anyone who is not one yet. A "Wholesale" tag behind a
          "Your price" tag says the offer in one picture. ── */}
      {!isReseller && (
        <a href="/resellers" className="hm-rs">
          <span className="hm-ill" aria-hidden="true">
            <span className="hm-tag ws">{tr("Wholesale")}</span>
            <span className="hm-tagw"><span className="hm-tag">{tr("Your price")}</span></span>
          </span>
          <span className="hm-vg"><OffsetIcon name="tag" size={20} /></span>
          <span className="hm-rst"><b>{tr("Sell Nitro at your own prices")}</b><small>{tr("Resellers get wholesale rates on every service. Ask support to join.")}</small></span>
          <span className="hm-go">{tr("Become a reseller")}{ARROW}</span>
        </a>
      )}

      {/* ── Delivering now: phone and tablet; the sidebar has it on desktop ── */}
      {activeOrders.length > 0 && (
        <div className="desktop:hidden">
          <SectionHead action={<ViewAll onClick={() => setActive("orders")} />}>{tr("Delivering now")}</SectionHead>
          <div className="hm-list">
            {activeOrders.slice(0, 3).map(o => <OrderRow key={o.id} o={o} dark={dark} onClick={() => setActive("orders")} />)}
          </div>
        </div>
      )}

      {/* ── Recent orders ── */}
      <SectionHead action={orders.length > 0 ? <ViewAll onClick={() => setActive("orders")} /> : null}>{tr("Recent orders")}</SectionHead>
      <div className="hm-list">
        {recent.length > 0 ? recent.map(item => item.type === "batch"
          ? <BatchRowMini key={item.batchId} item={item} onClick={() => setActive("orders")} />
          : <OrderRow key={item.order.id} o={item.order} dark={dark} onClick={() => setActive("orders")} />
        ) : (
          <div className="py-10 px-[18px] text-center flex flex-col items-center">
            <svg width="48" height="48" viewBox="0 0 64 64" fill="none" className="mb-3 opacity-60">
              <rect x="12" y="8" width="40" height="48" rx="6" stroke={t.accent} strokeWidth="1.5" opacity=".3" />
              <line x1="20" y1="22" x2="44" y2="22" stroke={t.accent} strokeWidth="1.5" opacity=".2" strokeLinecap="round" />
              <line x1="20" y1="30" x2="38" y2="30" stroke={t.accent} strokeWidth="1.5" opacity=".15" strokeLinecap="round" />
              <circle cx="32" cy="38" r="8" stroke={t.accent} strokeWidth="1.5" opacity=".2" />
              <path d="M29 38l2 2 4-4" stroke={t.accent} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity=".4" />
            </svg>
            <div className="text-base font-semibold mb-1 text-t-text-soft">{tr("No orders yet")}</div>
            <div className="text-sm mb-4 leading-[1.5] max-w-[320px] text-t-text-muted">{tr("Choose a platform, pick a service, and place your first order.")}</div>
            <button onClick={() => setActive("services")} className="cursor-pointer py-2.5 px-6 rounded-[10px] text-sm font-semibold border-none transition-transform duration-200 hover:-translate-y-px mb-2 bg-accent text-white">{tr("Place first order")}</button>
            <button onClick={() => setActive("guide")} className="cursor-pointer py-2 px-4 rounded-[10px] text-[13px] font-medium border-none transition-transform duration-200 hover:-translate-y-px bg-transparent text-t-text-muted">{tr("View blog")}</button>
            <div className="mt-3"><NotSureHelp waNumber={(socialLinks?.social_whatsapp_support || "").replace(/\D/g, "")} dark={dark} t={t} email={user?.email} /></div>
          </div>
        )}
      </div>

      {/* ── Rewards modals ── */}
      <StatusModal open={statusOpen} onClose={() => setStatusOpen(false)} rewards={rewards} dark={dark} t={t} setActive={setActive} />
      <PointsModal open={pointsOpen} onClose={() => setPointsOpen(false)} rewards={rewards} dark={dark} t={t} onUse={() => { setPointsOpen(false); setActive("services"); }} setActive={setActive} />

      {/* Tutorial popup */}
      {tutorialOpen && (
        <Modal open={tutorialOpen} onClose={() => setTutorialOpen(false)} dark={dark} maxWidth={420} bare>
            <div className="py-4 px-5 flex items-center justify-between" style={{ background: dark ? "rgba(196,125,142,.1)" : "rgba(196,125,142,.06)", borderBottom: `1px solid ${dark ? "rgba(196,125,142,.15)" : "rgba(196,125,142,.1)"}` }}>
              <div className="text-[15px] font-semibold text-t-text">{tr("How it works")}</div>
              <button onClick={() => setTutorialOpen(false)} className="w-7 h-7 rounded-lg flex items-center justify-center border border-solid cursor-pointer bg-transparent text-t-text-soft" style={{ borderColor: dark ? "rgba(255,255,255,.22)" : "rgba(0,0,0,.14)" }}><OffsetIcon name="close" size={12} /></button>
            </div>
            <div className="py-5 px-5 flex flex-col gap-3.5 max-h-[70vh] overflow-y-auto">
              {[
                { step: "1", icon: "user", title: tr("Create your account"), desc: tr("Sign up with your email. It only takes a few seconds.") },
                { step: "2", icon: "wallet", title: tr("Add funds"), desc: tr("Top up your balance via bank transfer or card payment.") },
                { step: "3", icon: "grid", title: tr("Pick a platform"), desc: tr("Choose Instagram, TikTok, X, or any platform you want to grow on.") },
                { step: "4", icon: "crown", title: tr("Choose a service & tier"), desc: tr("Pick what you need (followers, likes, views), then select Budget (no refill), Standard (30-day refill), or Premium (lifetime refill).") },
                { step: "5", icon: "link", title: tr("Paste your link"), desc: tr("Drop your profile or post link and set the quantity you want.") },
                { step: "6", icon: "rocket", title: tr("Place your order"), desc: tr("Confirm and your order starts processing. Track delivery in real time from your dashboard.") },
                { step: "7", icon: "clockPlain", title: tr("Track delivery"), desc: tr("Watch your order progress in real time from your dashboard.") },
              ].map((item, i) => (
                <div key={i} className="flex items-start gap-3">
                  {/* Each step's own icon on a printed tile, its number in the corner. */}
                  <div className="relative w-[30px] h-[30px] rounded-[9px] flex items-center justify-center shrink-0 text-accent-ink" style={{ background: dark ? "rgba(196,125,142,.2)" : "rgba(196,125,142,.12)", boxShadow: `2px 2px 0 ${dark ? "#6b3a4a" : "#efc4cf"}` }}>
                    <OffsetIcon name={item.icon} size={16} />
                    <span className="absolute -right-1.5 -bottom-1.5 w-[15px] h-[15px] rounded-full text-[9px] font-extrabold text-white grid place-items-center" style={{ background: t.accent, boxShadow: `0 0 0 2px ${t.cardBg}` }}>{item.step}</span>
                  </div>
                  <div className="pt-0.5">
                    <div className="text-[13px] font-semibold mb-0.5 text-t-text">{item.title}</div>
                    <div className="text-[11px] leading-[1.55] text-t-text-muted">{item.desc}</div>
                  </div>
                </div>
              ))}
            </div>
        </Modal>
      )}

      {/* What to Expect popup */}
      {tipsOpen && (
        <Modal open={tipsOpen} onClose={() => setTipsOpen(false)} dark={dark} maxWidth={420} bare>
            <div className="py-4 px-5 flex items-center justify-between" style={{ background: dark ? "rgba(196,125,142,.1)" : "rgba(196,125,142,.06)", borderBottom: `1px solid ${dark ? "rgba(196,125,142,.15)" : "rgba(196,125,142,.1)"}` }}>
              <div className="text-[15px] font-semibold text-t-text">{tr("What to Expect")}</div>
              <button onClick={() => setTipsOpen(false)} className="w-7 h-7 rounded-lg flex items-center justify-center border border-solid cursor-pointer bg-transparent text-t-text-soft" style={{ borderColor: dark ? "rgba(255,255,255,.22)" : "rgba(0,0,0,.14)" }}><OffsetIcon name="close" size={12} /></button>
            </div>
            <div className="py-5 px-5 flex flex-col gap-4 max-h-[70vh] overflow-y-auto">
              {[
                { icon: <OffsetIcon name="clockPlain" size={16} />, color: dark ? "#a5b4fc" : "#4f46e5", title: tr("Gradual delivery"), desc: tr("Orders are delivered over hours or days, not all at once. This keeps activity looking natural and protects your account from being flagged.") },
                { icon: <OffsetIcon name="bell" size={16} />, color: dark ? "#fbbf24" : "#d97706", title: tr("Normal drops happen"), desc: tr("Social platforms routinely clean up inactive or low-quality accounts. A small drop after delivery is expected. It's the platform doing its job, not a problem with your order.") },
                { icon: <OffsetIcon name="refresh" size={16} />, color: dark ? "#6ee7b7" : "#059669", title: tr("Refill is your safety net"), desc: tr("Standard includes a 30-day refill and Premium includes lifetime refill. If a cleanup hits your count, we top you back up at no extra cost.") },
                { icon: <OffsetIcon name="shield" size={16} />, color: dark ? "#f9a8d4" : "#be185d", title: tr("Keep your account safe"), desc: tr("Always set your profile to public before ordering. There are no refunds for orders placed on private profiles. Start small with Budget to test, and avoid ordering on brand-new accounts with zero content.") },
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
        </Modal>
      )}

      {/* ── Referral: phone and tablet; the sidebar has it on desktop ── */}
      <div className="hidden max-desktop:block">
        <SectionHead>{tr("Referral")}</SectionHead>
        <div className="hm-facts">
          <div className="hm-f"><span className="hm-fl"><OffsetIcon name="link" size={12} />{tr("Your code")}</span><div className="hm-fv">{user?.refCode ? <CopyChip value={user.refCode} label={tr("Your code")} small /> : <span className="m">—</span>}</div></div>
          <div className="hm-f"><span className="hm-fl"><OffsetIcon name="users" size={12} />{tr("Referrals")}</span><div className="hm-fv m">{user?.refs || 0}</div></div>
          <div className="hm-f"><span className="hm-fl"><CurrencyCoin size={12} />{tr("Earned")}</span><div className="hm-fv m">{money(user?.earnings || 0, { round: "down" })}</div></div>
        </div>
        <button type="button" onClick={() => setActive("referrals")} className="hm-inv"><OffsetIcon name="gift" size={14} />{tr("Invite friends")}</button>
      </div>
    </>
  );
}

export function RightSidebar({ activeOrders, orderSummary, user, dark, setActive }) {
  const tr = useT();
  const lang = useLocale()?.lang ?? "en";
  const money = useMoney();
  const activeCount = orderSummary?.active ?? activeOrders.length;
  const topPlatform = orderSummary?.topPlatform;
  const avgQty = orderSummary?.averageQuantity || 0;
  const memberDate = user?.createdAt ? new Date(user.createdAt).toLocaleDateString(dateLocale(lang), { month: "short", year: "numeric" }) : "—";
  const wkOrders = orderSummary?.thisWeek || 0;
  const pctOf = (o) => { const qty = o.quantity || 0; if (!qty) return 0; const delivered = o.status === tr("Completed") ? qty : o.remains != null ? Math.max(0, qty - Math.max(0, o.remains)) : 0; return Math.min(100, Math.round(delivered / qty * 100)); };
  return (
    <div className="rr">
      <RailSec icon="bars">{tr("Your stats")}</RailSec>
      <RailCard>
        <RailFact icon="grid" label={tr("Top platform")} value={topPlatform ? topPlatform.charAt(0).toUpperCase() + topPlatform.slice(1) : "—"} mono={false} />
        <RailFact icon="bars" label={tr("Average order")} value={avgQty > 0 ? avgQty.toLocaleString() : "—"} />
        <RailFact icon="calendar" label={tr("This week")} value={`${wkOrders} ${wkOrders === 1 ? tr("order") : tr("orders")}`} />
        <RailFact icon="user" label={tr("Member since")} value={memberDate} mono={false} />
      </RailCard>
      <RailSec icon="clockPlain" action={activeCount > 0 ? <RailLink onClick={() => setActive("orders")}>{tr("View all")}</RailLink> : null}>{tr("Delivering now")}</RailSec>
      <RailCard>
        {activeCount === 0 ? <RailEmpty icon="clockPlain">{tr("Nothing delivering right now.")}</RailEmpty> : activeOrders.slice(0, 5).map(o => (
          <RailRow key={o.id} bare tile={<PlatformIcon platform={o.platform} dark={dark} size={30} print />} title={o.service} sub={<>{o.id || ""}{o.tier && <span className="ms-2.5">{o.tier}</span>}</>} right={`${pctOf(o)}%`} bar={pctOf(o)} onClick={() => setActive("orders")} />
        ))}
      </RailCard>
      <RailSec icon="referral">{tr("Referral")}</RailSec>
      <RailCard>
        <RailFact icon="link" label={tr("Your code")} value={user?.refCode || "—"} color="var(--t-accent)" />
        <RailFact icon="users" label={tr("Referrals")} value={user?.refs || 0} />
        <RailFact icon={<CurrencyCoin size={15} />} label={tr("Earned")} value={money(user?.earnings || 0, { round: "down" })} />
      </RailCard>
      <RailBtn onClick={() => setActive("referrals")}>{tr("Invite friends")}</RailBtn>
    </div>
  );
}
