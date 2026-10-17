'use client';
import { useState, useEffect, useRef, useCallback, Fragment } from "react";
import { RailSec, RailCard, RailFact, RailRow, RailNote, RailEmpty } from "./rail";
import { Modal, useBodyScrollLock } from "./ui-primitives";
import { useConfirm } from "./confirm-dialog";
import { useToast } from "./toast";
import { PlatformIcon } from "./platform-icon";
import { useMoney, useT } from "./locale";
import { fD, fT, docDateLocale } from "../lib/format";
import { DateRangePicker, FilterDropdown } from "./date-range-picker";
import { WaButton } from "./wa-button";
import { NotSureHelp } from "./new-order";
import NitroLoader from "./nitro-loader";
import { openCardFrame } from '@/lib/expandable-card';
import { OffsetIcon, CurrencyCoin } from "./offset-icons";
import { sClr, STATUS_SHOWN, TIER_LOOK } from "./order-look";
import { CopyChip } from "./copy-chip";

const DRIP_CONFIG = {
  followers:  { batchSize: 200,  intervalHours: 2 },
  views:      { batchSize: 2000, intervalHours: 1 },
  likes:      { batchSize: 200,  intervalHours: 1 },
  comments:   { batchSize: 20,   intervalHours: 0.5 },
  engagement: { batchSize: 500,  intervalHours: 1 },
  reviews:    { batchSize: 5,    intervalHours: 2 },
};

function estimateDelivery(serviceType, quantity, remains, dripEndAt) {
  if (dripEndAt) {
    const msLeft = new Date(dripEndAt).getTime() - Date.now();
    if (msLeft <= 0) return null;
    const hoursLeft = msLeft / 3600000;
    if (hoursLeft < 1) return `< 1 hour`;
    if (hoursLeft < 24) { const h = Math.ceil(hoursLeft); return `~${h} ${h === 1 ? 'hour' : 'hours'}`; }
    const d = Math.ceil(hoursLeft / 24);
    return `~${d} ${d === 1 ? 'day' : 'days'}`;
  }
  const cfg = DRIP_CONFIG[(serviceType || '').toLowerCase()];
  if (!cfg) return null;
  if (remains != null && remains <= 0) return null;
  const q = remains != null && remains < quantity ? remains : quantity;
  const batches = Math.floor(q / cfg.batchSize);
  if (batches < 2) {
    if (cfg.intervalHours < 1) return `< ${Math.round(cfg.intervalHours * 60)} minutes`;
    return `< ${cfg.intervalHours} ${cfg.intervalHours === 1 ? 'hour' : 'hours'}`;
  }
  const totalHours = (batches - 1) * cfg.intervalHours;
  if (totalHours < 1) return `~${Math.round(totalHours * 60)} minutes`;
  const rounded = Math.round(totalHours);
  if (rounded >= 24) { const d = Math.round(rounded / 24); return `~${d} ${d === 1 ? 'day' : 'days'}`; }
  return `~${rounded} ${rounded === 1 ? 'hour' : 'hours'}`;
}


function Spinner({ size = 14, color = "currentColor" }) {
  return <span style={{ color, display: "inline-flex" }}><NitroLoader size={size} mono ariaHidden /></span>;
}

/** Today / Yesterday / "6 Aug" — the label a row sits under in the list. */
function dayKey(iso) {
  if (!iso) return null;
  const d = new Date(iso); if (Number.isNaN(d.getTime())) return null;
  const now = new Date();
  const same = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  if (same(d, now)) return "Today";
  const y = new Date(now); y.setDate(now.getDate() - 1);
  if (same(d, y)) return "Yesterday";
  return d.toLocaleDateString(docDateLocale(), { day: "numeric", month: "short" });
}

/** The summary as rows: label left, value right. Used by the header dropdown and the sidebar. */


/* The orders list in the same language as the order form and the receipt:
   rows keep to what tells orders apart at a glance — what, its tier, when,
   where it stands — and an opened order leads with its progress. Logical
   properties: this sheet does not go through the RTL build plugin. */
const OP_CSS = `
.op-stats{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px;margin-bottom:8px}
.op-stat{min-width:0;padding:8px 10px;border:1.5px solid var(--op-line);border-radius:12px;background:var(--op-card)}
.op-stat i{display:flex;align-items:center;gap:5px;font-style:normal;font-size:10.5px;font-weight:600;color:var(--op-mut);white-space:nowrap}
.op-stat i svg{color:var(--t-accent-ink)}
.op-stat b{display:block;margin-top:2px;font-size:15px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.op-pulse{width:7px;height:7px;border-radius:50%;background:var(--op-run);box-shadow:0 0 0 3px color-mix(in srgb,var(--op-run) 22%,transparent)}
.op-note{margin:0 2px 10px;font-size:11.5px;line-height:1.45;color:var(--op-mut)}
.op-day{display:flex;align-items:center;gap:8px;padding:9px 16px 7px;font-size:10.5px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:var(--op-mut);border-top:1px solid var(--op-line)}
.op-day:first-child{border-top:0}
.op-day .op-n{margin-inline-start:auto;font-size:10.5px;font-weight:600;letter-spacing:0;text-transform:none}
.op-row{display:grid;grid-template-columns:auto 1fr auto;gap:12px;align-items:center;padding:12px 16px;border-top:1px solid var(--op-line);cursor:pointer;transition:background-color .15s}
.op-day + * > .op-row,.op-day + .op-row{border-top:0}
.op-row:hover{background:color-mix(in srgb,var(--t-accent) 5%,transparent)}
.op-row.kid{gap:10px;padding:9px 14px 9px 22px}
@media (max-width:767px){.op-row{gap:10px;padding:11px 12px}.op-row.kid{padding:9px 12px 9px 16px}}
.op-pi{width:38px;height:38px;border-radius:11px;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0}
.op-pi.bulk{color:var(--t-accent-ink);background:rgba(196,125,142,.14);border:0;box-shadow:2px 2px 0 var(--op-print)}
.op-tx{min-width:0;display:flex;flex-direction:column;gap:3px}
.op-nm{display:flex;align-items:center;gap:8px;min-width:0}
.op-nm b{font-size:14px;font-weight:650;color:var(--op-ink);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.op-row.kid .op-nm b{font-size:12.5px;font-weight:600}
.op-tier.narrow{display:none}
@media (max-width:767px){.op-tier.wide,.op-sub .op-wide{display:none}.op-tier.narrow{display:inline-flex}}
@media (min-width:1200px){.op-stats,.op-note{display:none}}
.op-tier{display:inline-flex;align-items:center;gap:3px;font-size:11px;font-weight:700;color:var(--tc);white-space:nowrap;flex-shrink:0}
.op-sub{display:flex;align-items:center;gap:12px;font-size:11.5px;color:var(--op-mut);white-space:nowrap;overflow:hidden}
.op-sub > span{display:inline-flex;align-items:center;gap:4px}
.op-st{display:inline-flex;align-items:center;gap:5px;height:20px;padding:0 7px;border-radius:6px;font-size:10.5px;font-weight:750;white-space:nowrap;color:var(--sc);background:color-mix(in srgb,var(--sc) 10%,var(--op-card));box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--sc) 35%,transparent)}
.op-dot{width:6px;height:6px;border-radius:50%;background:var(--sc);animation:opPulse 1.6s ease-in-out infinite}
@keyframes opPulse{50%{opacity:.35}}
.op-bar{grid-column:2 / -1;height:4px;margin-top:-4px;border-radius:2px;background:var(--op-line);overflow:hidden}
.op-bar span{display:block;height:100%;border-radius:2px;background:var(--sc)}
.op-bar.wait span{width:100%;background:repeating-linear-gradient(-55deg,color-mix(in srgb,var(--op-mut) 40%,transparent) 0 6px,transparent 6px 12px)}
.op-det{display:flex;flex-direction:column;gap:8px;padding:0 14px 14px}
@media (max-width:767px){.op-det{padding:0 12px 12px}}
.op-prog{padding:10px 12px;border:1.5px solid var(--op-line);border-radius:12px;background:var(--op-card)}
.op-prog-top{display:flex;align-items:baseline;justify-content:space-between;gap:10px}
.op-prog-top b{font-size:15px;font-weight:700;color:var(--op-ink)}
.op-prog-top b small{font-size:12px;font-weight:500;color:var(--op-mut)}
.op-prog-top span{font-size:12px;font-weight:700;color:var(--sc)}
.op-prog-bar{height:6px;margin-top:7px;border-radius:3px;background:var(--op-line);overflow:hidden}
.op-prog-bar span{display:block;height:100%;border-radius:3px;background:var(--sc);transition:width .5s}
.op-prog-bar.wait span{width:100%;background:repeating-linear-gradient(-55deg,color-mix(in srgb,var(--op-mut) 40%,transparent) 0 6px,transparent 6px 12px)}
.op-eta{display:flex;align-items:center;gap:5px;margin-top:8px;font-size:11.5px;color:var(--op-mut)}
.op-eta svg{color:var(--t-accent-ink)}
.op-msg{display:flex;align-items:center;gap:10px;padding:10px 11px;border-radius:12px;font-size:12px;line-height:1.45;color:var(--op-ink);background:color-mix(in srgb,var(--sc) 9%,var(--op-card));box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--sc) 25%,transparent)}
.op-msg b{font-weight:700;color:var(--sc)}
.op-msg a{color:inherit;text-decoration:underline;font-weight:600}
.op-facts{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px}
@media (max-width:767px){.op-facts{grid-template-columns:repeat(2,minmax(0,1fr))}.op-f.id{grid-column:1 / -1}}
.op-f{min-width:0;padding:8px 10px;border:1.5px solid var(--op-line);border-radius:12px;background:var(--op-card)}
.op-f i{display:flex;align-items:center;gap:5px;font-style:normal;font-size:10.5px;font-weight:600;color:var(--op-mut);white-space:nowrap}
.op-f i svg{color:var(--t-accent-ink)}
.op-f > div{display:flex;align-items:center;gap:5px;margin-top:3px;min-width:0;min-height:24px;font-size:13px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:var(--op-ink)}
.op-f .op-none{font-size:12px;font-weight:500;color:var(--op-mut)}
.op-f.wide{grid-column:1 / -1}
.op-f.wide a{display:inline-flex;align-items:center;gap:5px;min-width:0;font-size:12px;font-weight:500;color:var(--op-ink);text-decoration:none}
.op-f.wide a span{overflow:hidden;text-overflow:ellipsis}
.op-f.wide a svg{color:var(--op-mut);flex-shrink:0}
.op-acts{display:flex;align-items:center;gap:6px;flex-wrap:wrap}
.op-kids{border-top:1px dashed var(--op-line)}
@media (prefers-reduced-motion:reduce){.op-dot{animation:none}.op-row{transition:none}}
`;

function StatusChip({ status, dark }) {
  const tr = useT();
  const live = status === "Processing" || status === "Pending";
  return <span className="op-st" style={{ "--sc": sClr(status, dark) }}>{live && <span className="op-dot" />}{tr(STATUS_SHOWN[status] || status)}</span>;
}
function TierTag({ tier, dark, className = "" }) {
  const tr = useT();
  if (!tier) return null;
  const look = TIER_LOOK[tier];
  return <span className={`op-tier ${className}`} style={{ "--tc": look ? (dark ? look[2] : look[1]) : "var(--t-accent-ink)" }}>{look && <OffsetIcon name={look[0]} size={11} />}{tr(tier)}</span>;
}
/* The row's progress line, only while an order is under way. Opening the
   order moves the progress into the card, so the row draws none then. */
function RowBar({ order, dark }) {
  const qty = order.quantity || 0;
  if (!qty || !["Processing", "Pending"].includes(order.status)) return null;
  const hasData = order.remains != null;
  if (!hasData) return <span className="op-bar wait" aria-hidden="true"><span /></span>;
  const pct = Math.min(100, Math.round(((qty - Math.max(0, order.remains)) / qty) * 100));
  return <span className="op-bar" aria-hidden="true" style={{ "--sc": sClr("Processing", dark) }}><span style={{ width: `${pct}%` }} /></span>;
}
function OrderHead({ o, dark, open, onToggle, kid = false }) {
  return (
    <div role="button" tabIndex={0} aria-expanded={open} onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.currentTarget.click(); } }} onClick={onToggle} className={`op-row${kid ? " kid" : ""}`}>
      <PlatformIcon platform={o.platform} dark={dark} size={kid ? 30 : 38} print />
      <span className="op-tx">
        <span className="op-nm"><b>{o.service}</b><TierTag tier={o.tier} dark={dark} className="wide" /></span>
        <span className="op-sub">
          <TierTag tier={o.tier} dark={dark} className="narrow" />
          {o.created && <span><OffsetIcon name="clockPlain" size={12} />{fT(o.created)}</span>}
        </span>
      </span>
      <StatusChip status={o.queuedBehind ? "Queued" : o.status} dark={dark} />
      {!open && <RowBar order={o} dark={dark} />}
    </div>
  );
}
/* One message per state, in one shape: an icon, a coloured lead, the words. */
function Msg({ tone, icon, title, children, dark }) {
  const c = { ok: dark ? "#6ee7b7" : "#059669", warn: dark ? "#fbbf24" : "#d97706", run: dark ? "#a5b4fc" : "#4f46e5", bad: dark ? "#fca5a5" : "#dc2626", off: dark ? "#a1a1aa" : "#71717a" }[tone];
  return <div className="op-msg" style={{ "--sc": c }}><span className="ic-tile tc" style={{ width: 30, height: 30, "--tc": c }}><OffsetIcon name={icon} size={16} /></span><div>{title && <><b>{title}</b>{" "}</>}{children}</div></div>;
}






function groupOrders(orders) {
  const batches = {};
  const items = [];
  for (const o of orders) {
    if (o.batchId) {
      if (!batches[o.batchId]) {
        batches[o.batchId] = { type: "batch", batchId: o.batchId, orders: [], created: o.created };
        items.push(batches[o.batchId]);
      }
      batches[o.batchId].orders.push(o);
      if (o.created < batches[o.batchId].created) batches[o.batchId].created = o.created;
    } else {
      items.push({ type: "single", order: o, created: o.created });
    }
  }
  items.sort((a, b) => new Date(b.created) - new Date(a.created));
  return items;
}


/* ── Shared expanded order details ── */
// Decided on the server from the tier name's promise (lib/refill-promise).
function refillEligible(o) {
  return !!o.canRefill;
}

function ExpandedOrderDetails({ o, dark, t, doAction, actionLoading, confirm, waNum, onViewComments, doRefill, refillLoading }) {
  const tr = useT();
  const money = useMoney();
  const qty = o.quantity || 0;
  const isCancelled = o.status === "Cancelled";
  const hasData = o.remains != null;
  const isComplete = o.status === "Completed";
  const delivered = isCancelled ? 0 : isComplete ? qty : hasData ? Math.max(0, qty - Math.max(0, o.remains)) : 0;
  const pct = isCancelled ? 0 : isComplete ? 100 : hasData ? Math.min(100, Math.round((delivered / qty) * 100)) : 0;
  const isPartial = o.status === "Partial";
  const barColor = isCancelled ? (dark ? "#666" : "#999") : isComplete ? (dark ? "#6ee7b7" : "#059669") : isPartial ? (dark ? "#fbbf24" : "#d97706") : sClr("Processing", dark);
  const waiting = !isCancelled && !hasData && !isComplete && (o.status === "Pending" || o.status === "Processing");
  const isQueued = waiting && !!o.queuedBehind;
  const waMessage = encodeURIComponent(`Hi *Nitro*, I need help with my order:\n\n*Order:* ${o.id}\n*Service:* ${o.service}${o.tier ? ' (' + o.tier + ')' : ''}\n*Quantity:* ${qty.toLocaleString()}\n*Delivered:* ${delivered.toLocaleString()} / ${qty.toLocaleString()}\n*Status:* ${o.status}\n*Date:* ${fD(o.created, true)}`);
  const reportIssueButton = waNum ? (
    <WaButton href={`https://wa.me/${waNum}?text=${waMessage}`} weight="quiet" size="sm">
      {tr("Get help")}
    </WaButton>
  ) : null;


  return (
    <div className="op-det">
      {/* Progress first: how far along, the bar, and roughly how long. The one
          bar the order has once it is open. */}
      {(() => {
        if (isCancelled) return null;
        const estTime = estimateDelivery(o.serviceType, qty, o.remains, o.dripEndAt);
        const isActive = !isComplete && o.status !== "Partial";
        return (
          <div className="op-prog" style={{ "--sc": barColor }}>
            <div className="op-prog-top">
              <b className="m">{waiting ? <span style={{ fontFamily: "inherit" }}>{isQueued ? tr("Queued") : tr("Waiting to start")}</span> : <>{delivered.toLocaleString()} <small>{tr("of")} {qty.toLocaleString()} {tr("delivered")}</small></>}</b>
              {!waiting && <span className="m">{pct}%</span>}
            </div>
            <div className={`op-prog-bar${waiting ? " wait" : ""}`}><span style={waiting ? undefined : { width: `${pct}%` }} /></div>
            {isActive && estTime && <div className="op-eta"><OffsetIcon name="clockPlain" size={12} />{tr("Est.")} {estTime}</div>}
          </div>
        );
      })()}

      {o.status === "Completed" && (
        <Msg tone="ok" icon="checkCircle" title={tr("Your order is complete!")} dark={dark}>
          {tr("If you notice a small dip in the next few days, don't worry. Platforms routinely clean up inactive accounts and it's completely normal.")}{refillEligible(o) ? <strong> {tr("Use the Request Refill button below to top up at no extra cost.")}</strong> : o.refill ? <strong> {tr("Your refill window for this order has ended.")}</strong> : null}
        </Msg>
      )}
      {o.status === "Partial" && (
        <Msg tone="warn" icon="pauseCircle" title={tr("Partial delivery")} dark={dark}>
          {tr("Part of your order has been delivered and the rest has been refunded to your wallet. This usually happens when a provider runs out of capacity mid-delivery. It's not an error. You can use the refunded balance to place a new order anytime.")}
        </Msg>
      )}
      {isQueued && (
        <Msg tone="run" icon="clockPlain" dark={dark}>
          {tr("You have another order running on this same link. This one will start automatically once it completes. No action needed.")}
        </Msg>
      )}
      {!isQueued && o.lastError && o.status === "Pending" && !o.apiOrderId && (
        <Msg tone="warn" icon="alert" dark={dark}>
          {/duplicate/i.test(o.lastError) ? "A similar order is already active for this link. This order will start automatically once the other completes."
            : /balance|fund/i.test(o.lastError) ? "Temporarily delayed. Our team has been notified and this will be resolved shortly."
            : /incorrect service|invalid service|service replaced/i.test(o.lastError) ? "This service is temporarily unavailable. You'll be refunded if it can't be fulfilled."
            : o.lastError === "wrong_service_type" ? "The link type didn't match this service. You'll be refunded if it can't be fulfilled."
            : o.lastError === "missing_comments" ? "This service needs custom comments. You'll be refunded if it can't be fulfilled."
            : /link|url|wrong_platform|needs_post|needs_profile/i.test(o.lastError) ? "There's an issue with the link for this order. You'll be refunded if it can't be fulfilled."
            : /quantity.*less|minim/i.test(o.lastError) ? "The quantity couldn't be processed. Please contact support if this persists."
            : /timeout|timed.?out/i.test(o.lastError) ? "There was a temporary connection issue. Your order will be retried automatically."
            : "Your order hit a temporary issue and will be retried automatically. Contact support if it stays pending."}
        </Msg>
      )}
      {(o.status === "Cancelled" || o.status === "Failed" || o.status === "Rejected") && (() => {
        const err = o.lastError || "";
        let msg, guide = false, isNeutral = false;
        if (err === "user_cancelled") {
          msg = "You cancelled this order and your balance has been restored.";
          isNeutral = true;
        } else if (err === "admin_cancelled" || err.startsWith("admin_cancelled:")) {
          const reason = err.startsWith("admin_cancelled: ") ? err.slice("admin_cancelled: ".length).trim() : "";
          msg = reason
            ? `Our team cancelled this order: ${reason}. Your wallet has been refunded.`
            : "Our team cancelled this order and refunded your wallet. Reach out to support if you have questions.";
          isNeutral = true;
        } else if (err === "dispatch_failed") {
          msg = "We couldn't place this order so we refunded you automatically.";
        } else if (err === "needs_post_link") {
          msg = "This service needs a link to a specific post or video, not your profile. Try again with the right link!";
          guide = true;
        } else if (err === "needs_profile_link") {
          msg = "This service needs your profile link, not a post or video. Try again with your profile URL!";
          guide = true;
        } else if (err === "wrong_platform_link") {
          msg = "Looks like the link is from a different platform. Make sure you're copying from the right app.";
          guide = true;
        } else if (err === "wrong_service_type") {
          msg = "The link type didn't match this service. For example, a followers service needs a profile link, not a post. Try again with the right link!";
          guide = true;
        } else if (err === "missing_comments") {
          msg = "This service needs custom comments but none were included. Try placing the order again with your comments.";
        } else if (/duplicate/i.test(err)) {
          msg = "There was already an active order for this link, so this one was skipped.";
        } else if (/incorrect service|invalid service|service replaced/i.test(err)) {
          msg = "This service was temporarily unavailable. You've been refunded.";
        } else if (/quantity.*less|minim/i.test(err)) {
          msg = "The quantity was below the minimum for this service.";
        } else if (/link|url/i.test(err)) {
          msg = "Something about this link didn't work. Make sure you're copying the right type of link.";
          guide = true;
        } else if (/timeout|timed.?out/i.test(err)) {
          msg = "There was a connection issue and the order couldn't go through. You've been refunded.";
        } else if (/balance|fund/i.test(err)) {
          msg = "This got held up on our end, but you've been refunded. Try placing it again.";
        } else {
          msg = "This order didn't go through and you've been refunded. If this keeps happening, double-check your link or reach out to support.";
          guide = true;
        }
        return (
          <Msg tone={isNeutral ? "off" : "bad"} icon={isNeutral ? "checkCircle" : "xCircle"} dark={dark}>
            {msg}{guide && <>{" "}<a href="/blog/how-to-find-the-right-link" target="_blank">{tr("Learn more")}</a></>}
          </Msg>
        );
      })()}

      {/* The facts as cells, then the link in full with a way to open it. */}
      <div className="op-facts">
        <div className="op-f id"><i><OffsetIcon name="receipt" size={12} />{tr("Order")}</i><div><CopyChip value={o.id} label={tr("Copy order number")} small /></div></div>
        <div className="op-f"><i><OffsetIcon name={isCancelled ? "moneyIn" : "wallet"} size={12} />{isCancelled ? tr("Refunded") : tr("Charged")}</i><div className="m" style={isCancelled ? { color: dark ? "#6ee7b7" : "#059669" } : undefined}>{money(o.charge)}</div></div>
        {isCancelled
          ? <div className="op-f"><i><OffsetIcon name="users" size={12} />{tr("Quantity")}</i><div className="m">{qty.toLocaleString()}</div></div>
          : <div className="op-f"><i><OffsetIcon name="bars" size={12} />{tr("Start count")}</i>{o.startCount != null ? <div className="m">{o.startCount.toLocaleString()}</div> : <div className="op-none">{tr("Not yet")}</div>}</div>}
        {/* Full-list orders don't carry a tier name the way a curated order
            does, so quoting this exact id is the fastest way to tell WhatsApp
            support precisely which of the full list's rows was ordered.
            fullListDisabled already accounts for the service being blacklisted
            or dropped by its provider — the number itself never changes either
            way, only whether this tag shows next to it. */}
        {o.fullList && o.nitroServiceId && (
          <div className="op-f wide"><i><OffsetIcon name="tag" size={12} />{tr("Service ID")}</i><div>{o.fullListDisabled && <span className="text-[10px] font-semibold py-[1px] px-1.5 rounded text-t-text-muted" style={{ background: dark ? "rgba(255,255,255,.08)" : "rgba(0,0,0,.05)" }}>{tr("Retired")}</span>}<CopyChip value={o.nitroServiceId} small /></div></div>
        )}
        {o.link && (
          <div className="op-f wide"><i><OffsetIcon name="link" size={12} />{tr("Link")}</i><div><a href={o.link} target="_blank" rel="noopener noreferrer" title={o.link} onClick={e => e.stopPropagation()} className="m"><span>{o.link}</span><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" /></svg></a></div></div>
        )}
      </div>

      {/* Actions, the one the state calls for first */}
      <div className="op-acts">
        {o.comments && (
          <button onClick={(e) => { e.stopPropagation(); onViewComments?.(o.comments); }} className="act neutral">
            <OffsetIcon name="comment" size={13} />
            {tr("View comments")}
          </button>
        )}
        {(o.status === "Processing" || o.status === "Pending") && (
          <>
            <button onClick={() => doAction(o.id, "check")} disabled={actionLoading === o.id} className="act indigo">{actionLoading === o.id ? <Spinner size={14} color={dark ? "#a5b4fc" : "#4f46e5"} /> : <OffsetIcon name="refresh" size={14} />}{tr("Check status")}</button>
            {o.status === "Pending" && !o.apiOrderId && <button onClick={async () => { const ok = await confirm({ title: tr("Cancel Order"), message: `Cancel order ${o.id}? Your wallet will be refunded.`, confirmLabel: "Cancel Order", danger: true }); if (ok) doAction(o.id, "cancel"); }} disabled={actionLoading === o.id} className="act red"><OffsetIcon name="xCircle" size={14} />{tr("Cancel")}</button>}
          </>
        )}
        {o.refillRequestedAt && refillEligible(o) && (
          <span className="act amber">
            <OffsetIcon name="refresh" size={14} />
            {tr("Refill in Progress")}
          </span>
        )}
        {!o.refillRequestedAt && refillEligible(o) && (
          <button onClick={async () => { const ok = await confirm({ title: tr("Request Refill"), message: tr("If your count dropped after delivery, we'll top it back up at no extra cost. This may take a few hours."), confirmLabel: "Request Refill" }); if (ok) doRefill(o.id); }} disabled={refillLoading === o.id} className="act green">
            {refillLoading === o.id ? <Spinner size={14} color={dark ? "#6ee7b7" : "#059669"} /> : <OffsetIcon name="refresh" size={14} />}
            {tr("Request Refill")}
          </button>
        )}
        {(o.status === "Completed" || o.status === "Cancelled" || o.status === "Partial") && !o.offerDisabled && (
          <button onClick={async () => { const ok = await confirm({ title: tr("Reorder"), message: `${tr("Reorder")} ${o.service}? ${money(o.charge || 0)} ${tr("will be charged from your wallet.")}`, confirmLabel: tr("Place Reorder") }); if (ok) doAction(o.id, "reorder"); }} disabled={actionLoading === o.id} className="act purple">{actionLoading === o.id ? <Spinner size={14} color={t.accent} /> : <OffsetIcon name="receiptPlus" size={14} />}{tr("Reorder")}</button>
        )}
        {reportIssueButton}
      </div>
    </div>
  );
}


/* ── Batch row ── */
function BatchRow({ batch, dark, t, expanded, onToggle, expandedOrder, setExpandedOrder, doAction, actionLoading, doBatchAction, batchActionLoading, confirm, toast, onNavigate, waNum, onViewComments, doRefill, refillLoading }) {
  const tr = useT();
  const isLoading = batchActionLoading === batch.batchId;
  const hasActive = batch.orders.some(o => o.status === "Processing" || o.status === "Pending");
  const hasCancellable = batch.orders.some(o => o.status === "Pending" && !o.apiOrderId);
  const reorderableOrders = batch.orders.filter(o => o.status === "Completed" || o.status === "Cancelled");
  const hasReorderable = reorderableOrders.length > 0 && reorderableOrders.every(o => !o.offerDisabled);

  const batchSt = batch.orders.every(o => o.status === "Completed") ? "Completed"
    : batch.orders.every(o => o.status === "Cancelled") ? "Cancelled"
    : batch.orders.some(o => ["Pending", "Processing", "In progress"].includes(o.status)) ? "Processing"
    : "Partial";

  const n = batch.orders.length;
  const done = batch.orders.filter(o => o.status === "Completed").length;
  return (
    <div>
      <div role="button" tabIndex={0} aria-expanded={expanded} onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.currentTarget.click(); } }} onClick={() => onToggle(batch.batchId)} className="op-row">
        <span className="op-pi bulk"><OffsetIcon name="cart" size={19} /></span>
        <span className="op-tx">
          <span className="op-nm"><b>{tr("Bulk order")} {batch.batchId}</b></span>
          <span className="op-sub">
            <span><OffsetIcon name="layers" size={12} />{n} {n === 1 ? tr("order") : tr("orders")}</span>
            {batch.created && <span className="op-wide"><OffsetIcon name="clockPlain" size={12} />{fT(batch.created)}</span>}
            <span><OffsetIcon name="checkCircle" size={12} />{done} {tr("of")} {n} {tr("done")}</span>
          </span>
        </span>
        <StatusChip status={batchSt} dark={dark} />
        {!expanded && batchSt === "Processing" && <span className="op-bar" aria-hidden="true" style={{ "--sc": sClr("Processing", dark) }}><span style={{ width: `${(done / n) * 100}%` }} /></span>}
      </div>

      {expanded && (<>
        <div className="op-det" style={{ paddingBottom: 10 }}>
          <div className="op-prog" style={{ "--sc": batchSt === "Completed" ? sClr("Completed", dark) : sClr("Processing", dark) }}>
            <div className="op-prog-top"><b className="m">{done} <small>{tr("of")} {n} {tr("orders")} {tr("done")}</small></b><span className="m">{Math.round((done / n) * 100)}%</span></div>
            <div className="op-prog-bar"><span style={{ width: `${(done / n) * 100}%` }} /></div>
          </div>
        </div>
        {/* Each order in the batch, opening on its own */}
        <div className="op-kids">
          {batch.orders.map((o) => (
            <div key={o.id} style={expandedOrder === o.id ? openCardFrame(t, dark) : undefined}>
              <OrderHead o={o} dark={dark} kid open={expandedOrder === o.id} onToggle={() => setExpandedOrder(expandedOrder === o.id ? null : o.id)} />
              {expandedOrder === o.id && <ExpandedOrderDetails o={o} dark={dark} t={t} doAction={doAction} actionLoading={actionLoading} confirm={confirm} toast={toast} onNavigate={onNavigate} waNum={waNum} onViewComments={onViewComments} doRefill={doRefill} refillLoading={refillLoading} />}
            </div>
          ))}
        </div>
        {(hasActive || hasCancellable || hasReorderable) && (
          <div className="op-det" style={{ paddingTop: 10 }}>
            <div className="op-acts">
              {hasActive && (
                <button onClick={() => doBatchAction(batch.batchId, "check")} disabled={isLoading} className="act indigo" style={{ opacity: isLoading ? .5 : 1 }}>
                  {isLoading ? <Spinner size={12} color={dark ? "#a5b4fc" : "#4f46e5"} /> : <OffsetIcon name="refresh" size={12} />}{tr("Check all")}
                </button>
              )}
              {hasCancellable && (
                <button onClick={async () => { const ok = await confirm({ title: tr("Cancel Bulk Order"), message: `${tr("Cancel all pending orders in")} ${batch.batchId} ${tr("that haven't been sent to providers yet? Your wallet will be refunded.")}`, confirmLabel: tr("Cancel All"), danger: true }); if (ok) doBatchAction(batch.batchId, "cancel"); }} disabled={isLoading} className="act red" style={{ opacity: isLoading ? .5 : 1 }}><OffsetIcon name="xCircle" size={12} />{tr("Cancel all")}</button>
              )}
              {hasReorderable && (
                <button onClick={async () => { const ok = await confirm({ title: tr("Reorder Bulk"), message: `${tr("Reorder all completed/cancelled orders from")} ${batch.batchId}?`, confirmLabel: tr("Reorder All") }); if (ok) doBatchAction(batch.batchId, "reorder_completed"); }} disabled={isLoading} className="act purple" style={{ opacity: isLoading ? .5 : 1 }}><OffsetIcon name="receiptPlus" size={12} />{tr("Reorder all")}</button>
              )}
            </div>
          </div>
        )}
      </>)}
    </div>
  );
}

const PER_PAGE_OPTIONS = [25, 50, 100];

function Pagination({ total, page, setPage, perPage, setPerPage, t }) {
  const tr = useT();
  const totalPages = Math.ceil(total / perPage);
  if (total <= 25) return null;
  return (
    <div className="flex justify-between items-center mt-3.5 flex-wrap gap-2">
      <div className="flex items-center gap-2 text-[13px] desktop:text-sm">
        <span className="text-t-text-muted">{tr("Show")}</span>
        <select aria-label={tr("Orders per page")} value={perPage} onChange={e => { const v = Number(e.target.value); setPerPage(v); setPage(1); try { localStorage.setItem("nitro-per-page", String(v)); } catch {} fetch("/api/auth/notifications", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ perPagePreference: v }) }).catch(() => {}); }} className="m py-1 px-2 rounded-md text-sm outline-none border bg-t-card-bg border-t-card-border text-t-text">
          {PER_PAGE_OPTIONS.map(n => <option key={n} value={n}>{n}</option>)}
        </select>
        <span className="text-t-text-muted">{total} total</span>
      </div>
      <div className="flex items-center gap-1">
        <button onClick={() => setPage(Math.max(1, page - 1))} disabled={page <= 1} className="w-[30px] h-[30px] rounded-md flex items-center justify-center border cursor-pointer bg-transparent transition-transform duration-200 hover:-translate-y-px" style={{ borderColor: t.cardBorder, color: t.textSoft, opacity: page <= 1 ? .3 : 1 }}>
          <svg className="dir-flip" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
          let p;
          if (totalPages <= 5) p = i + 1;
          else if (page <= 2) p = i + 1;
          else if (page >= totalPages - 1) p = totalPages - 4 + i;
          else p = page - 2 + i;
          return (
            <button key={p} onClick={() => setPage(p)} className="m py-1 px-2.5 rounded-md text-sm border cursor-pointer transition-transform duration-200 hover:-translate-y-px" style={{ background: page === p ? t.navActive : "transparent", color: page === p ? t.accent : t.textMuted, borderColor: page === p ? t.accent + "40" : t.cardBorder }}>{p}</button>
          );
        })}
        <button onClick={() => setPage(Math.min(totalPages, page + 1))} disabled={page >= totalPages} className="w-[30px] h-[30px] rounded-md flex items-center justify-center border cursor-pointer bg-transparent transition-transform duration-200 hover:-translate-y-px" style={{ borderColor: t.cardBorder, color: t.textSoft, opacity: page >= totalPages ? .3 : 1 }}>
          <svg className="dir-flip" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>
        </button>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════ */
/* ═══ ORDERS PAGE                         ═══ */
/* ═══════════════════════════════════════════ */

/* "Ordered without an account?" A guest order, and any credit left on its
   code, moves into this account with the guest code: only the buyer holds it
   (lib/guest-checkout.js). Shown once guest checkout is on. */
function GuestCodeClaim({ t, onDone }) {
  const tr = useT();
  const money = useMoney();
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [state, setState] = useState({ busy: false, error: "", done: null });
  const valid = /^[A-Za-z0-9]{4}-?[A-Za-z0-9]{4}$/.test(code.trim());
  const add = async (e) => {
    e.preventDefault();
    if (!valid || state.busy) return;
    setState({ busy: true, error: "", done: null });
    const res = await fetch("/api/guest/claim", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code: code.trim() }) }).catch(() => null);
    const d = await res?.json().catch(() => null);
    if (res?.ok) { setState({ busy: false, error: "", done: d.claimed }); setCode(""); onDone?.(); }
    else setState({ busy: false, error: d?.error ? tr(d.error) : tr("Could not add that order. Try again."), done: null });
  };
  return (
    <div className="mt-3 text-[13px] text-t-text-muted">
      {!open ? (
        <button type="button" onClick={() => setOpen(true)} className="bg-transparent border-none p-0 cursor-pointer font-[inherit] text-[13px] text-t-text-muted">
          {tr("Ordered without an account?")} <span className="font-semibold text-accent-ink">{tr("Add a guest code")}</span>
        </button>
      ) : (
        <form onSubmit={add} className="flex items-center gap-2 flex-wrap">
          <label htmlFor="guest-claim-code" className="font-semibold text-t-text">{tr("Guest code")}</label>
          <input id="guest-claim-code" value={code} onChange={e => { setCode(e.target.value.toUpperCase()); setState(s => ({ ...s, error: "" })); }} maxLength={9} autoComplete="off" spellCheck={false}
            className="w-[130px] py-2 px-3 rounded-[10px] text-[13px] font-mono tracking-[1.5px] outline-none text-t-text" style={{ border: `1px solid ${t.cardBorder}`, background: t.cardBg }} />
          <button type="submit" disabled={!valid || state.busy} className="py-2 px-3.5 rounded-[10px] border-none text-[13px] font-semibold cursor-pointer text-white disabled:opacity-40 disabled:cursor-default" style={{ background: t.accent }}>
            {state.busy ? tr("Adding…") : tr("Add")}
          </button>
        </form>
      )}
      {state.error && <p role="alert" className="mt-1.5 mb-0 text-[12.5px]" style={{ color: t.red }}>{state.error}</p>}
      {state.done && (
        <p role="status" className="mt-1.5 mb-0 text-[12.5px]" style={{ color: t.green }}>
          {tr("Order added to your account.")}{state.done.creditKobo > 0 && <> {money(state.done.creditKobo / 100)} {tr("credit moved to your wallet.")}</>}
        </p>
      )}
    </div>
  );
}

export default function OrdersPage({ orders: initialOrders, initialTotal = initialOrders.length, orderSummary, dark, t, onNavigate, onRefresh, waNum, email, initialSearch = "", guestCodes = false }) {
  const tr = useT();
  const money = useMoney();
  const initialTotalCount = Number.isFinite(initialTotal) ? initialTotal : initialOrders.length;
  const confirm = useConfirm();
  const [orders, setOrders] = useState(initialOrders);
  const [filter, setFilter] = useState("all");
  // Seeded when a notification opened this page, so "Order delivered" in the
  // bell lands on that order rather than on the whole history. The search is
  // server-side, so it finds the order however deep it is; the box shows the
  // reference with its clear button, so getting back to everything is one tap.
  const [search, setSearch] = useState(initialSearch || "");
  const [expanded, setExpanded] = useState(null);
  const [expandedBatch, setExpandedBatch] = useState(null);
  const [expandedBatchOrder, setExpandedBatchOrder] = useState(null);
  const [oPage, setOPage] = useState(1);
  const [perPage, setPerPage] = useState(25);
  const [total, setTotal] = useState(initialTotalCount);
  const [matchingOrdersTotal, setMatchingOrdersTotal] = useState(initialTotalCount);
  const [actionLoading, setActionLoading] = useState(null);
  const [refillLoading, setRefillLoading] = useState(null);
  const [batchActionLoading, setBatchActionLoading] = useState(null);
  const [dateRange, setDateRange] = useState(null);
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [viewComments, setViewComments] = useState(null);
  useBodyScrollLock(!!viewComments);
  const toast = useToast();
  const fetchAbortRef = useRef(null);

  const fetchOrders = useCallback(async () => {
    fetchAbortRef.current?.abort();
    const controller = new AbortController();
    fetchAbortRef.current = controller;
    try {
      const params = new URLSearchParams({
        page: String(oPage),
        perPage: String(perPage),
      });
      if (debouncedSearch.trim().length >= 2) params.set('search', debouncedSearch.trim());
      if (filter !== 'all') params.set('filter', filter);
      if (dateRange?.start) params.set('start', dateRange.start.toISOString());
      if (dateRange?.end) {
        const end = new Date(dateRange.end);
        end.setHours(23, 59, 59, 999);
        params.set('end', end.toISOString());
      }
      const res = await fetch(`/api/orders?${params}`, { signal: controller.signal });
      const data = await res.json();
      if (res.ok && data.orders) {
        const totalPages = Math.max(1, data.totalPages || 1);
        if (oPage > totalPages) {
          setOPage(totalPages);
          return;
        }
        setOrders(data.orders);
        setTotal(data.total || 0);
        setMatchingOrdersTotal(data.matchingOrdersTotal || 0);
      }
    } catch (error) {
      if (error?.name !== 'AbortError') {
        // Keep the last successful page visible on transient network errors.
      }
    }
  }, [oPage, perPage, debouncedSearch, filter, dateRange]);

  const doAction = async (orderId, action) => {
    setActionLoading(orderId);
    try {
      const res = await fetch("/api/orders", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, orderId }) });
      const data = await res.json();
      if (!res.ok) { toast.error(tr("Action failed"), data.error ? tr(data.error) : tr("Something went wrong")); setActionLoading(null); return; }
      if (action === "check") {
        setOrders(prev => prev.map(o => (o.id === orderId ? { ...o, ...(data.status && { status: data.status }), ...(data.remains != null && { remains: data.remains }), ...(data.startCount != null && { startCount: data.startCount }) } : o)));
        const order = orders.find(o => o.id === orderId);
        const qty = order?.quantity || 0;
        let detail = "";
        if (data.status === "Completed") {
          detail = `Delivered ${qty.toLocaleString()}/${qty.toLocaleString()}`;
        } else if (data.remains != null && qty > 0) {
          const delivered = Math.max(0, qty - Math.max(0, data.remains));
          detail = `${delivered.toLocaleString()}/${qty.toLocaleString()} delivered`;
        } else if (data.startCount != null) {
          detail = "Order started";
        }
        toast.info(data.status, detail || (order?.queuedBehind ? tr("Queued") : tr("Waiting to start")));
        await fetchOrders();
        onRefresh?.();
      } else if (action === "cancel") {
        toast.success(tr("Order cancelled"), data.refunded ? `${money(data.refunded, { round: "down" })} ${tr("refunded to wallet")}` : tr("Cancelled successfully"));
        await fetchOrders();
        onRefresh?.();
      } else if (action === "reorder") {
        toast.success(data.queued ? tr("Reorder queued") : tr("Reorder placed"), data.queued ? tr("Will start when your current order for this link completes.") : (data.order?.id || ""));
      }
    } catch { toast.error(tr("Request failed"), tr("Check your connection and try again")); }
    setActionLoading(null);
  };

  const doRefill = async (orderId) => {
    setRefillLoading(orderId);
    try {
      const res = await fetch("/api/orders/refill", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ orderId }) });
      const data = await res.json();
      if (!res.ok) { toast.error(tr("Refill failed"), data.error ? tr(data.error) : tr("Something went wrong")); setRefillLoading(null); return; }
      setOrders(prev => prev.map(o => o.id === orderId ? { ...o, refillRequestedAt: new Date().toISOString() } : o));
      toast.success(tr("Refill requested"), tr("Delivery will begin shortly"));
    } catch { toast.error(tr("Request failed"), tr("Check your connection and try again")); }
    setRefillLoading(null);
  };

  const doBatchAction = async (batchId, action) => {
    setBatchActionLoading(batchId);
    try {
      const res = await fetch("/api/orders/bulk", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, batchId }) });
      const data = await res.json();
      if (!res.ok) { toast.error(tr("Action failed"), data.error ? tr(data.error) : tr("Something went wrong")); setBatchActionLoading(null); return; }
      await fetchOrders();
      onRefresh?.();
      if (action === "check") toast.info(tr("Bulk checked"), `${tr("Checked")} ${data.checked || 0} ${tr("orders")} · ${data.updated || 0} ${tr("updated")}`);
      else if (action === "cancel") toast.success(tr("Bulk cancelled"), `${data.cancelled || 0} ${tr("cancelled")}${data.refunded ? ` · ${money(data.refunded)} ${tr("refunded")}` : ""}`);
      else if (action === "reorder") toast.success(tr("Bulk retry"), `${tr("Placed")} ${data.placed || 0} ${tr("of")} ${data.retried || 0}`);
      else if (action === "reorder_completed") toast.success(tr("Reorder placed"), `${data.placed || 0} ${tr("orders")} · ${data.newBatchId || ""} · ${money(data.totalCharge || 0)} ${tr("charged")}`);
    } catch { toast.error(tr("Request failed"), tr("Check your connection and try again")); }
    setBatchActionLoading(null);
  };

  useEffect(() => {
    try {
      const saved = Number(localStorage.getItem("nitro-per-page"));
      if (PER_PAGE_OPTIONS.includes(saved)) setPerPage(saved);
    } catch {}
  }, []);

  const searchTimer = useRef(null);
  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    const nextSearch = search.trim().length >= 2 ? search.trim() : "";
    searchTimer.current = setTimeout(() => { setDebouncedSearch(nextSearch); setOPage(1); }, search ? 350 : 0);
    return () => clearTimeout(searchTimer.current);
  }, [search]);

  useEffect(() => {
    fetchOrders();
    return () => fetchAbortRef.current?.abort();
  }, [fetchOrders]);

  const grouped = groupOrders(orders);
  const pagedGroups = grouped;

  const autoChecked = useRef(new Set());
  const autoCheck = useCallback((o) => {
    if (!o || !o.apiOrderId || ["Completed", "Cancelled", "Partial"].includes(o.status) || autoChecked.current.has(o.id) || actionLoading) return;
    autoChecked.current.add(o.id);
    doAction(o.id, "check");
  }, [actionLoading]);

  useEffect(() => {
    if (expanded) { const o = orders.find(x => x.id === expanded); autoCheck(o); }
  }, [expanded]);
  useEffect(() => {
    if (expandedBatchOrder) { const o = orders.find(x => x.id === expandedBatchOrder); autoCheck(o); }
  }, [expandedBatchOrder]);

  const searchTooShort = search.trim().length === 1;
  const hasFilters = filter !== "all" || search.trim().length >= 2 || dateRange;

  return (
    <div className="op-page" style={{ "--op-line": t.cardBorder, "--op-ink": t.text, "--op-mut": t.textMuted, "--op-card": "var(--t-card-bg)", "--op-field": dark ? "rgba(255,255,255,.04)" : "#faf8f8", "--op-print": dark ? "#6b3a4a" : "#efc4cf", "--op-run": sClr("Processing", dark) }}>
      <style>{OP_CSS}</style>
      {/* Header */}
      <div className="pb-2 desktop:pb-3">
        <div className="text-lg desktop:text-[22px] font-semibold mb-0.5 text-t-text">{tr("Orders")}</div>
        <div className="text-sm desktop:text-[15px] text-t-text-muted">{tr("Track delivery, refunds, and reorders")}</div>
        <div className="page-divider bg-t-card-border" />
      </div>

      {/* The three numbers, where the sidebar that shows them is not on screen.
          They replace the Summary button, which hid them behind a tap. */}
      <div className="op-stats">
        <div className="op-stat"><i><span className="op-pulse" />{tr("Delivering")}</i><b className="m" style={{ color: (orderSummary?.active || 0) ? sClr("Processing", dark) : undefined }}>{orderSummary?.active || 0}</b></div>
        <div className="op-stat"><i><OffsetIcon name="checkCircle" size={12} />{tr("Completed")}</i><b className="m">{orderSummary?.completed || 0}</b></div>
        <div className="op-stat"><i><OffsetIcon name="wallet" size={12} />{tr("Spent")}</i><b className="m">{money(orderSummary?.spent || 0)}</b></div>
      </div>
      {(orderSummary?.active || 0) > 0 && <p className="op-note">{tr("Delivery takes 0 to 6 hours, up to 24 in a few cases. Speed requests are looked at after the first 6 hours.")}</p>}

      {/* Search, then the status filter, then the dates */}
      <div className="flex items-center gap-2 mb-2 desktop:mb-3 flex-nowrap min-w-0">
        <div className="flex-1 min-w-0">
          <div className="relative">
            <svg className="absolute top-1/2 -translate-y-1/2 pointer-events-none text-t-text-muted" style={{ insetInlineStart: 12 }} width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
            <input aria-label={tr("Search orders")} placeholder={tr("Search orders…")} value={search} onChange={e => { setSearch(e.target.value); setOPage(1); }} className="w-full min-w-0 h-10 rounded-xl text-[13px] outline-none font-[inherit] text-t-text border-[1.5px] border-solid" style={{ paddingInlineStart: 34, paddingInlineEnd: 32, background: t.cardBg, borderColor: t.cardBorder }} />
            {search && <button aria-label={tr("Clear search")} onClick={() => { setSearch(""); setOPage(1); }} className="absolute top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center rounded-full cursor-pointer border-none bg-transparent text-t-text-muted" style={{ insetInlineEnd: 6 }}><OffsetIcon name="close" size={12} /></button>}
          </div>
          {searchTooShort && <div className="text-[11px] desktop:text-xs mt-1 text-t-text-muted">{tr("Type at least 2 characters to search.")}</div>}
        </div>
        {/* "Needs attention" is gone from the filter: Partial and Cancelled are
            their own entries, and a partly delivered order was never a problem
            to flag. The labels are the words the rows use. */}
        <FilterDropdown dark={dark} t={t} value={filter} onChange={(v) => { setFilter(v); setOPage(1); setExpanded(null); }} options={
          ["all", "active", "Processing", "Pending", "Completed", "Partial", "Cancelled"].map(f => ({
            value: f, label: f === "all" ? tr("All") : f === "active" ? tr("Active") : tr(STATUS_SHOWN[f] || f),
          }))
        } />
        <DateRangePicker dark={dark} t={t} value={dateRange} onChange={(v) => { setDateRange(v); setOPage(1); }} />
      </div>

      {/* Result count */}
      {hasFilters && (
        <div className="text-[11px] desktop:text-[13px] mb-2 text-t-text-muted">
          Showing {pagedGroups.length} of {total} {tr("matching result")}{total === 1 ? "" : "s"} ({matchingOrdersTotal} order{matchingOrdersTotal === 1 ? "" : "s"})
          {hasFilters && <button onClick={() => { setFilter("all"); setSearch(""); setDateRange(null); setOPage(1); }} className="ml-2 underline cursor-pointer bg-transparent border-none font-[inherit] text-[11px] desktop:text-[13px] text-accent-ink">{tr("Clear filters")}</button>}
        </div>
      )}

      {/* Order list */}
      <div className="rounded-2xl overflow-hidden" style={{ background: t.cardBg, border: `1px solid ${t.cardBorder}` }}>
        {pagedGroups.length > 0 ? pagedGroups.map((item, i) => {
          const createdOf = (g) => g ? (g.type === "batch" ? g.orders[0]?.created : g.order.created) : null;
          const dk = dayKey(createdOf(item));
          const firstOfDay = dk && dk !== dayKey(createdOf(pagedGroups[i - 1]));
          const dayCount = firstOfDay ? pagedGroups.filter(g => dayKey(createdOf(g)) === dk).length : 0;
          const dayLabel = firstOfDay ? <div className="op-day">{tr(dk)}<span className="op-n m">{dayCount} {dayCount === 1 ? tr("order") : tr("orders")}</span></div> : null;
          if (item.type === "batch") {
            return <Fragment key={item.batchId}>{dayLabel}<div style={expandedBatch === item.batchId ? openCardFrame(t, dark) : undefined}><BatchRow batch={item} dark={dark} t={t} expanded={expandedBatch === item.batchId} onToggle={(id) => { setExpandedBatch(expandedBatch === id ? null : id); setExpandedBatchOrder(null); setExpanded(null); }} expandedOrder={expandedBatchOrder} setExpandedOrder={setExpandedBatchOrder} doAction={doAction} actionLoading={actionLoading} doBatchAction={doBatchAction} batchActionLoading={batchActionLoading} confirm={confirm} toast={toast} onNavigate={onNavigate} waNum={waNum} onViewComments={setViewComments} doRefill={doRefill} refillLoading={refillLoading} /></div></Fragment>;
          }
          const o = item.order;
          return (
            <Fragment key={o.id}>{dayLabel}
              <div style={expanded === o.id ? openCardFrame(t, dark) : undefined}>
                <OrderHead o={o} dark={dark} open={expanded === o.id} onToggle={() => { setExpanded(expanded === o.id ? null : o.id); setExpandedBatch(null); setExpandedBatchOrder(null); }} />
                {expanded === o.id && <ExpandedOrderDetails o={o} dark={dark} t={t} doAction={doAction} actionLoading={actionLoading} confirm={confirm} toast={toast} onNavigate={onNavigate} waNum={waNum} onViewComments={setViewComments} doRefill={doRefill} refillLoading={refillLoading} />}
              </div>
            </Fragment>
          );
        }) : (
          <div className="py-10 px-6 text-center text-t-text-muted">
            {hasFilters ? (
              <>
                <div className="text-base font-semibold mb-1 text-t-text-soft">{tr("No orders match your filters")}</div>
                <div className="text-[13px] text-t-text-muted">{tr("Try adjusting your search or filters")}</div>
                <button onClick={() => { setFilter("all"); setSearch(""); setDateRange(null); setOPage(1); }} className="mt-3 py-1.5 px-4 rounded-lg text-[13px] font-semibold cursor-pointer border bg-transparent border-t-card-border text-accent-ink">{tr("Clear filters")}</button>
              </>
            ) : (
              <>
                <div className="text-base font-semibold mb-1 text-t-text-soft">{tr("No orders yet")}</div>
                <div className="text-[13px] text-t-text-muted mb-3">{tr("Your orders will show up here once you start boosting")}</div>
                <NotSureHelp waNumber={waNum} dark={dark} t={t} email={email} />
              </>
            )}
          </div>
        )}
      </div>
      <Pagination total={total} page={oPage} setPage={setOPage} perPage={perPage} setPerPage={setPerPage} t={t} />
      {guestCodes && <GuestCodeClaim t={t} onDone={onRefresh} />}

      {viewComments && (
        <Modal open onClose={() => setViewComments(null)} dark={dark} maxWidth={448} title={tr("Submitted comments")}
          icon={<OffsetIcon name="comment" size={16} />}>
          <pre className="m-0 text-[13px] leading-[1.65] whitespace-pre-wrap break-words text-t-text-soft font-[inherit]">{viewComments}</pre>
        </Modal>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════ */
/* ═══ ORDERS RIGHT SIDEBAR                ═══ */
/* ═══════════════════════════════════════════ */
export function OrdersSidebar({ orders, orderSummary, dark }) {
  const tr = useT();
  const money = useMoney();
  const activeCount = orderSummary?.active || 0;
  return (
    <div className="rr">
      <RailSec icon="receipt">{tr("Your orders")}</RailSec>
      <RailCard>
        <RailFact icon="receipt" label={tr("Total")} value={String(orderSummary?.total ?? 0)} />
        <RailFact icon="clockPlain" label={tr("Delivering now")} value={String(activeCount)} color={activeCount ? (dark ? "#a5b4fc" : "#4f46e5") : undefined} />
        <RailFact icon="checkCircle" label={tr("Completed")} value={String(orderSummary?.completed || 0)} />
        <RailFact icon={<CurrencyCoin size={15} />} label={tr("Spent")} value={money(orderSummary?.spent || 0)} />
      </RailCard>
      {activeCount > 0 && <RailNote>{tr("Delivery takes 0 to 6 hours, up to 24 in a few cases. Speed requests are looked at after the first 6 hours.")}</RailNote>}
      <RailSec icon="clock">{tr("Recent")}</RailSec>
      <RailCard>
        {orders.length === 0 ? <RailEmpty icon="receipt">{tr("No orders yet.")}</RailEmpty> : orders.slice(0, 5).map(o => (
          <RailRow key={o.id} bare tile={<PlatformIcon platform={o.platform} dark={dark} size={30} print />} title={o.service} sub={<>{o.created ? fD(o.created, true) : ""}{o.tier && <span className="ms-2.5">{o.tier}</span>}{o.status && <span className="ms-2.5">{tr(o.status)}</span>}</>} right={o.charge != null ? money(o.charge) : null} />
        ))}
      </RailCard>
    </div>
  );
}
