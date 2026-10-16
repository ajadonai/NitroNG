"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useLocale, useMoney, useT } from "./locale";
import { formatKobo } from "@/lib/money";
import { copyText } from "@/lib/clipboard";
import { canChargeIn } from "@/lib/currency";
import { msg } from "../lib/i18n";
import { Modal } from "./ui-primitives";
import { GuestOrderTrack, phaseOf } from "./guest-order-page";

/* The order card: one order, no account (docs/v2/guest_checkout_brief.md).
   It takes the hero card's place when "Order without an account" is tapped,
   exactly as in the mockup. Step one chooses, step two takes the link and
   the number and pays. Both steps share one grid cell, so the card is the
   height of the taller one and pressing Next never makes it jump. Paying
   leaves for Flutterwave, which sends the visitor back here with
   ?guest_order=CODE, and the card turns into the receipt where it stands.
   Tracking opens over the page, never somewhere else. */

const naira = (kobo) => formatKobo(kobo, { round: true });
// Tiers are priced for a bundle, not per 1,000, so a guest sees ₦10 a follower
// rather than ₦10,043. The bundle is the smallest that prices the cheapest tier
// at 10 or more of the currency's smallest unit (₦10, 10 cents, KSh10), shown to
// the nearest unit: naira never shows kobo, a ₦0.32 view reads ₦32 per 100, and
// rounding stays within 5%. A follower costs under a cent, so in dollars it is
// priced per 100.
const PACKS = [1, 10, 100, 1000];
const num = (n) => n.toLocaleString("en-NG");
const LADDER = ["Budget", "Standard", "Premium"];
const MIN_ORDER_KOBO = 1000_00;
const CODE_RE = /^[A-Za-z0-9]{4}-?[A-Za-z0-9]{4}$/;
// Back from paying: check on the payment every 5 seconds for two minutes,
// then leave it to a button.
const POLL_MS = 5_000;
const POLL_MAX = 24;
// The heading of the receipt, by where the order is.
const DONE_TITLE = {
  pay: msg("Waiting for payment"), placing: msg("Placing your order"), notPlaced: msg("Not placed"),
  expired: msg("Not paid"), refunded: msg("Refunded"),
};
// Two items, so the line never wraps: what the tier is, and its refill promise.
const PROMISE = {
  Budget: [msg("Good profiles"), msg("No refill")],
  Standard: [msg("Better profiles"), msg("30-day refill")],
  Premium: [msg("Best profiles"), msg("Lifetime refill")],
};

// The brand marks, each in its own colour (light, dark).
const GLYPH = {
  Instagram: ["#E1306C", "#E1306C", <><rect x="3" y="3" width="18" height="18" rx="5" fill="none" stroke="currentColor" strokeWidth="2.2"/><circle cx="12" cy="12" r="4.2" fill="none" stroke="currentColor" strokeWidth="2.2"/><circle cx="17.3" cy="6.7" r="1.3"/></>],
  TikTok: ["#111111", "#f2efe9", <path d="M16.6 3c.4 2.2 1.8 3.7 4 4v3.1c-1.5 0-2.9-.4-4-1.2v6.6A5.6 5.6 0 1 1 11 10v3.2a2.5 2.5 0 1 0 2.5 2.5V3h3.1z"/>],
  YouTube: ["#FF0000", "#FF0000", <><path d="M22.5 7.2a2.8 2.8 0 0 0-2-2C18.8 4.7 12 4.7 12 4.7s-6.8 0-8.5.5a2.8 2.8 0 0 0-2 2C1 8.9 1 12 1 12s0 3.1.5 4.8a2.8 2.8 0 0 0 2 2c1.7.5 8.5.5 8.5.5s6.8 0 8.5-.5a2.8 2.8 0 0 0 2-2c.5-1.7.5-4.8.5-4.8s0-3.1-.5-4.8z"/><path d="M9.8 15.2V8.8L15.5 12z" fill="#fff"/></>],
  "Twitter/X": ["#111111", "#f2efe9", <path d="M17.8 3h3.1l-6.8 7.8L22 21h-6.2l-4.9-6.4L5.3 21H2.2l7.3-8.3L2 3h6.4l4.4 5.8L17.8 3zm-1.1 16.2h1.7L7.4 4.7H5.6l11.1 14.5z"/>],
  Facebook: ["#1877F2", "#1877F2", <path d="M24 12a12 12 0 1 0-13.9 11.9v-8.4h-3V12h3V9.4c0-3 1.8-4.7 4.5-4.7 1.3 0 2.7.2 2.7.2v3h-1.5c-1.5 0-2 .9-2 1.9V12h3.3l-.5 3.5h-2.8v8.4A12 12 0 0 0 24 12z"/>],
  Telegram: ["#229ED9", "#229ED9", <path d="M12 0a12 12 0 1 0 0 24 12 12 0 0 0 0-24zm5.6 8.2-1.9 9c-.1.6-.5.8-1.1.5l-3-2.2-1.4 1.4c-.2.2-.3.3-.6.3l.2-3.1 5.6-5c.2-.2 0-.3-.4-.1l-6.9 4.3-3-.9c-.6-.2-.7-.6.1-.9l11.6-4.5c.6-.2 1 .1.8 1.2z"/>],
};
const LABEL = { "Twitter/X": "X" };

// What a link looks like on each platform, for the placeholder: profile, post.
const EXAMPLE = {
  Instagram: ["instagram.com/username", "instagram.com/p/ABC123"],
  TikTok: ["tiktok.com/@username", "tiktok.com/@user/video/123"],
  YouTube: ["youtube.com/@channel", "youtube.com/watch?v=abc123"],
  "Twitter/X": ["x.com/username", "x.com/user/status/123"],
  Facebook: ["facebook.com/yourprofile", "facebook.com/share/ABC123"],
  Telegram: ["t.me/yourchannel", "t.me/yourchannel/123"],
};

const CHECK = <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>;
const GLOBE = <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3z"/></svg>;
const CHEV = <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>;
const COPY = <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="9" y="9" width="12" height="12" rx="2.5"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></svg>;
const BACK = <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6"/></svg>;

function Glyph({ platform, dark }) {
  const g = GLYPH[platform];
  if (!g) return null;
  return <svg viewBox="0 0 24 24" fill="currentColor" style={{ color: dark ? g[1] : g[0] }} aria-hidden="true">{g[2]}</svg>;
}

/** The same arithmetic as the order route: up to the naira, then any promotion. */
function priceKobo(perK, qty, promo) {
  let charge = Math.ceil(perK * qty / 100_000) * 100;
  if (promo?.pct > 0) {
    let discount = Math.round(charge * (promo.pct / 100));
    if (promo.cap && discount > promo.cap) discount = promo.cap;
    if (discount > 0) charge = Math.max(100, Math.ceil((charge - discount) / 100) * 100);
  }
  return charge;
}

// As the order route counts them: a line needs a letter or a digit.
const commentLines = (text) => text.split("\n").filter(l => /[\p{L}\p{N}]/u.test(l)).length;
// "Instagram Followers 🇺🇸" counts followers: the last word, without the flag.
const unitOf = (name) => name.replace(/[^\p{L}\p{N}\s/]/gu, "").trim().split(/[\s/]+/).pop().toLowerCase();

export function GuestOrderCard({ dark, initialCredit = "", onSignup, className = "", returnCode = "", returnPreview = null, supportWhatsApp = "" }) {
  const tr = useT();
  // The visitor's currency. Prices read in it; cedis and shillings are also
  // charged in it, and dollars and pounds are charged in naira.
  const loc = useLocale();
  const money = useMoney();
  const currency = loc?.currency || "NGN";
  const toDisplay = loc?.toDisplay || ((n) => n);
  const decimals = loc?.meta?.decimals ?? 0;
  const chargeIn = canChargeIn(currency) ? currency : "NGN";
  const rootRef = useRef(null);
  // The landing page holds a desktop and a phone copy of this card and shows
  // one; only the one on screen talks to the server.
  const [shown, setShown] = useState(false);
  const [menu, setMenu] = useState(null);
  const [menuErr, setMenuErr] = useState("");
  const [menuTry, setMenuTry] = useState(0);
  const [step, setStep] = useState(returnCode || returnPreview ? 3 : 1);
  const [market, setMarket] = useState("global");
  const [plat, setPlat] = useState("Instagram");
  const [groupId, setGroupId] = useState("");
  const [tierName, setTierName] = useState("");
  const [link, setLink] = useState("");
  const [qty, setQty] = useState("");
  const [lines, setLines] = useState("");
  const [email, setEmail] = useState("");
  const [track, setTrack] = useState("");
  const [creditCode, setCreditCode] = useState("");
  const [credit, setCredit] = useState(null); // { code, kobo } once applied
  const [creditMsg, setCreditMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [payErr, setPayErr] = useState("");
  const linkRef = useRef(null);
  // The order once paid for: its code, and what the server says about it.
  const [orderCode, setOrderCode] = useState(returnCode);
  const [order, setOrder] = useState(returnPreview);
  const [orderErr, setOrderErr] = useState("");
  const [polls, setPolls] = useState(0);
  const [copied, setCopied] = useState(false);
  // "Want a receipt?" on the receipt, for a guest who skipped the email.
  const [rcpt, setRcpt] = useState("");
  const [rcptSent, setRcptSent] = useState("");
  const [rcptMsg, setRcptMsg] = useState("");
  const [rcptBusy, setRcptBusy] = useState(false);
  // The Track pop-up's order, and what went wrong looking one up.
  const [trackView, setTrackView] = useState(null);
  const [trackMsg, setTrackMsg] = useState("");

  useEffect(() => {
    const check = () => setShown(!!rootRef.current && rootRef.current.offsetParent !== null);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  useEffect(() => {
    if (!shown || menu) return;
    fetch("/api/guest/menu").then(r => r.json()).then(d => {
      if (d?.groups) setMenu(d); else setMenuErr(tr("Could not load the services. Try again."));
    }).catch(() => setMenuErr(tr("Could not load the services. Try again.")));
  }, [shown, menu, menuTry, tr]);

  // Back from paying (or paid in full with credit): ask about the payment once.
  useEffect(() => {
    if (!shown || !orderCode || returnPreview || order) return;
    fetch("/api/guest/verify", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code: orderCode }) })
      .then(async r => ({ ok: r.ok, d: await r.json().catch(() => ({})) }))
      .then(({ ok, d }) => { if (ok && d?.order) setOrder(d.order); else setOrderErr(d?.error ? tr(d.error) : tr("Could not find that order. Check your guest code.")); })
      .catch(() => setOrderErr(tr("Could not check your payment. Try again.")));
  }, [shown, orderCode, returnPreview, order, tr]);

  // Then keep checking while the payment or the placement is still moving.
  const orderPhase = order ? phaseOf(order) : null;
  const orderMoving = !returnPreview && (orderPhase === "pay" || orderPhase === "placing");
  useEffect(() => {
    if (!shown || !orderMoving || polls >= POLL_MAX) return;
    const id = setTimeout(async () => {
      if (document.visibilityState === "visible") {
        const d = await fetch(`/api/guest/track?code=${order.code}`, { cache: "no-store" }).then(r => r.json()).catch(() => null);
        if (d?.order) setOrder(d.order);
      }
      setPolls(n => n + 1);
    }, POLL_MS);
    return () => clearTimeout(id);
  }, [shown, orderMoving, polls, order?.code]);

  const nigerian = market === "nigerian";
  const all = menu?.groups || [];
  const groups = useMemo(() => all.filter(g => g.platform === plat && g.nigerian === nigerian), [all, plat, nigerian]);
  const hasPlatform = (p, ng = nigerian) => all.some(g => g.platform === p && g.nigerian === ng);
  const group = groups.find(g => g.id === groupId) || groups[0] || null;
  const tiers = group ? LADDER.map(n => group.tiers.find(t => t.tier === n)).filter(Boolean) : [];
  const tier = tiers.find(t => t.tier === tierName) || tiers[0] || null;
  const pack = (() => {
    if (!tiers.length) return 1;
    const one = Math.min(...tiers.map(t => t.perK)) / 100_000;
    const floor = 10 / 10 ** decimals;
    return PACKS.find(n => (toDisplay(one * n) ?? one * n) >= floor) || 1000;
  })();
  const packPrice = (perK) => {
    const nairaFor = (perK / 100_000) * pack;
    if (currency === "NGN") return naira(Math.round(nairaFor) * 100);
    const shown = toDisplay(nairaFor);
    if (shown == null) return money(nairaFor);
    const f = 10 ** decimals;
    return `≈ ${loc.fmtNative(Math.round(shown * f) / f)}`;
  };
  const unit = group ? unitOf(group.name) : "";

  const count = tier?.comments ? commentLines(lines) : parseInt(qty || "0", 10);
  const price = tier ? priceKobo(tier.perK, count, menu?.promo) : 0;
  const applied = credit ? Math.min(credit.kobo, price) : 0;
  const due = price - applied;
  const minComments = tier ? Math.max(tier.min, 10) : 10;

  let problem = "";
  if (tier && step === 2) {
    if (tier.comments && count < minComments) problem = `${tr("Add at least")} ${minComments} ${tr("comments, one per line.")}`;
    else if (!tier.comments && count < tier.min) problem = `${tr("The smallest order here is")} ${num(tier.min)}.`;
    else if (count > tier.max) problem = `${tr("The largest order here is")} ${num(tier.max)}.`;
    else if (price < MIN_ORDER_KOBO) problem = tr("Orders start at ₦1,000. Add a few more.");
  }

  const choosePlat = (p) => { setPlat(p); setGroupId(""); setTierName(""); };
  const chooseMarket = (m) => {
    const ng = m === "nigerian";
    setMarket(m); setGroupId(""); setTierName("");
    if (!hasPlatform(plat, ng)) { const first = (menu?.platforms || []).find(p => hasPlatform(p, ng)); if (first) setPlat(first); }
  };
  const next = () => {
    if (!tier) return;
    if (!qty) setQty(String(Math.min(tier.max, Math.max(tier.min, 500))));
    setStep(2); setPayErr("");
    requestAnimationFrame(() => linkRef.current?.focus());
  };

  // `quiet`: a code handed over by a link is applied only if it holds credit,
  // and otherwise dropped without a word, rather than left in the box with an
  // error the visitor never typed.
  async function applyCredit(raw = creditCode, { quiet = false } = {}) {
    const code = raw.trim().toUpperCase();
    if (!CODE_RE.test(code)) return;
    setCreditMsg("");
    const d = await fetch(`/api/guest/track?code=${encodeURIComponent(code)}`, { cache: "no-store" }).then(r => r.json()).catch(() => null);
    if (d?.order?.creditKobo > 0) setCredit({ code: d.order.code, kobo: d.order.creditKobo });
    else if (!quiet) setCreditMsg(d?.order ? tr("That code has no credit on it.") : (d?.error ? tr(d.error) : tr("Could not check that code. Try again.")));
  }
  // A code handed over from an order page ("Use credit") is applied straight away.
  useEffect(() => { if (initialCredit) applyCredit(initialCredit, { quiet: true }); }, [initialCredit]); // applyCredit is stable enough: it only reads state at call time

  async function pay() {
    if (problem || !tier || busy) return;
    setBusy(true); setPayErr("");
    const post = (url, body) => fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
      .then(async r => ({ ok: r.ok, d: await r.json().catch(() => ({})) })).catch(() => ({ ok: false, d: {} }));
    const quote = await post("/api/guest/quote", { tierId: tier.id, link: link.trim(), quantity: count, ...(tier.comments ? { comments: lines } : {}) });
    if (!quote.ok) { setBusy(false); setPayErr(quote.d.error ? tr(quote.d.error) : tr("Could not start the order. Try again.")); return; }
    const paid = await post("/api/guest/pay", { checkoutId: quote.d.checkoutId, email: email.trim(), creditCode: credit?.code || "", currency: chargeIn });
    if (!paid.ok) { setBusy(false); setPayErr(paid.d.error ? tr(paid.d.error) : tr("Could not open the payment page. Try again.")); return; }
    if (paid.d.authorizationUrl) { window.location.href = paid.d.authorizationUrl; return; }
    // Paid in full with credit: no payment page, straight to the receipt.
    setBusy(false); setOrder(null); setOrderErr(""); setPolls(0); setOrderCode(paid.d.code); setStep(3);
  }

  async function openTrack(raw) {
    const code = raw.trim().toUpperCase();
    if (!CODE_RE.test(code)) return;
    setTrackMsg("");
    const d = await fetch(`/api/guest/track?code=${encodeURIComponent(code)}`, { cache: "no-store" }).then(r => r.json()).catch(() => null);
    if (d?.order) setTrackView(d.order);
    else setTrackMsg(d?.error ? tr(d.error) : tr("Could not check that code. Try again."));
  }

  // A fresh card, as after "Place another order". The ?guest_order= that
  // brought the visitor back goes too, so a refresh does not reopen the receipt.
  function again() {
    setStep(1); setOrder(null); setOrderCode(""); setOrderErr(""); setPolls(0); setCopied(false);
    setRcpt(""); setRcptSent(""); setRcptMsg("");
    setLink(""); setQty(""); setLines(""); setEmail(""); setCredit(null); setCreditCode(""); setCreditMsg(""); setPayErr("");
    // Only the return link's own parameters go; anything else in the address stays.
    const q = new URLSearchParams(window.location.search);
    if (q.has("guest_order")) {
      ["guest_order", "verify", "receipt", "status", "tx_ref", "transaction_id"].forEach(k => q.delete(k));
      window.history.replaceState(null, "", window.location.pathname + (q.size ? `?${q}` : ""));
    }
  }

  async function sendReceipt() {
    if (rcptBusy || !order?.code) return;
    setRcptBusy(true); setRcptMsg("");
    const res = await fetch("/api/guest/receipt", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code: order.code, email: rcpt.trim() }) }).catch(() => null);
    const d = await res?.json().catch(() => null);
    setRcptBusy(false);
    if (res?.ok && d?.to) setRcptSent(d.to);
    else setRcptMsg(d?.error ? tr(d.error) : tr("Could not send the receipt. Try again."));
  }

  const copy = async () => {
    try { await copyText(order.code); } catch {}
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const line = problem || payErr;
  const dueShown = chargeIn === "NGN" ? naira(due) : (toDisplay(due / 100) != null ? loc.fmtNative(toDisplay(due / 100)) : naira(due));
  const howToPay = chargeIn === "GHS" ? tr("Mobile money.")
    : chargeIn === "KES" ? tr("M-Pesa.")
      : currency === "NGN" ? tr("Bank transfer, USSD or Opay.") : tr("Charged in naira by bank transfer, USSD or Opay.");

  // The receipt: what it says, and the one thing to do next.
  const lead = !order ? null
    : order.orderId && orderPhase !== "refunded"
      ? <>{order.dueKobo > 0 ? <>{tr("You paid")} <b>{money(order.dueKobo / 100)}</b>.</> : tr("Paid with your credit.")} <b>{num(order.quantity)}</b> {order.service} {tr("are on the way.")}</>
      : {
        pay: tr("A bank transfer can take a few minutes to arrive. This page updates by itself."),
        placing: tr("Your payment arrived. Your order is being placed now."),
        refunded: order.refundsTo === "code"
          ? tr("This order could not be delivered, so the money came back as credit on your code.")
          : tr("This order could not be delivered, so the money went back to your Nitro wallet."),
        notPlaced: order.refundsTo === "code"
          ? tr("Your payment arrived, but the order could not be placed. The money is kept as credit on your code.")
          : tr("Your payment arrived, but the order could not be placed. The money is in your Nitro wallet."),
        expired: tr("This order was not paid for in time, so its price is no longer held."),
      }[orderPhase];
  const checkAgain = polls < POLL_MAX ? null : <button type="button" className="gco-go" onClick={() => setPolls(0)}>{tr("Check again")}</button>;
  const primary = orderPhase === "pay" ? (order.payUrl ? <a className="gco-go" href={order.payUrl}>{tr("Finish paying")}</a> : checkAgain)
    : orderPhase === "placing" ? checkAgain
      : <button type="button" className="gco-go" onClick={again}>{tr("Place another order")}</button>;

  return (
    <div ref={rootRef} className={`gco${dark ? " dk" : ""} ${className}`} data-guest-card="">
      <style>{GCO_CSS}</style>
      <div className="gco-head">
        {step === 3 ? (
          <>
            <span className="gco-title">
              {order?.orderId && orderPhase !== "refunded" && <span className="gco-ok">{CHECK}</span>}
              <b className="gco-h">{order?.orderId && orderPhase !== "refunded" ? tr("Order placed") : DONE_TITLE[orderPhase] ? tr(DONE_TITLE[orderPhase]) : tr("Your order")}</b>
            </span>
            {order?.orderId && <span className="gco-id gco-m">{order.orderId}</span>}
          </>
        ) : step === 1 ? (
          <>
            <b className="gco-h">{tr("What do you need?")}</b>
            <div className="gco-market" role="radiogroup" aria-label={tr("Audience")}>
              <button type="button" role="radio" aria-checked={!nigerian} onClick={() => chooseMarket("global")}>{GLOBE}{tr("Global")}</button>
              <button type="button" role="radio" aria-checked={nigerian} onClick={() => chooseMarket("nigerian")}><span className="gco-flag" aria-hidden="true">🇳🇬</span>{tr("Nigerian")}</button>
            </div>
          </>
        ) : (
          <>
            <span className="gco-title">
              <button type="button" className="gco-back" onClick={() => setStep(1)} aria-label={tr("Back to step 1")}>{BACK}</button>
              <b className="gco-h">{tr("Your order")}</b>
            </span>
            <span className="gco-step">{tr("Step 2 of 2")}</span>
          </>
        )}
      </div>
      <div className={`gco-progress${step === 3 && order?.orderId ? " done" : ""}`} aria-hidden="true"><i className="on" /><i className={step >= 2 ? "on" : ""} /></div>

      <div className="gco-stage">
        {!menu ? (step !== 3 && (menuErr ? (
          <div className="gco-pane gco-fail">
            <p className="gco-load" role="alert">{menuErr}</p>
            <button type="button" className="gco-ghost" onClick={() => { setMenuErr(""); setMenuTry(n => n + 1); }}>{tr("Try again")}</button>
          </div>
        ) : (
          <div className="gco-pane" aria-busy="true">
            <span className="sr-only" role="status">{tr("Loading services…")}</span>
            <div className="gco-plats" aria-hidden="true">{[0, 1, 2, 3, 4, 5].map(i => <i key={i} className="sk sk-tile" />)}</div>
            <i className="sk sk-box" aria-hidden="true" />
            <i className="sk sk-tiers" aria-hidden="true" />
            <div className="gco-promise" aria-hidden="true"><i className="sk sk-line" style={{ width: 92 }} /><i className="sk sk-line sk-end" style={{ width: 74 }} /></div>
            <div className="gco-act" aria-hidden="true"><i className="sk sk-go" /><i className="sk sk-line sk-mid" style={{ width: 210 }} /></div>
          </div>
        ))) : (<>
          <div className="gco-pane" inert={step !== 1 ? true : undefined}>
            <div className="gco-plats" role="radiogroup" aria-label={tr("Platform")}>
              {menu.platforms.map(p => (
                <button key={p} type="button" role="radio" aria-checked={p === plat} aria-label={LABEL[p] || p} title={LABEL[p] || p}
                  disabled={!hasPlatform(p)} onClick={() => choosePlat(p)} style={{ "--pc": GLYPH[p]?.[dark ? 1 : 0] }}>
                  <Glyph platform={p} dark={dark} />
                </button>
              ))}
            </div>
            <div className="gco-f gco-sel">
              <label htmlFor="gco-svc">{tr("Service")}</label>
              <select id="gco-svc" value={group?.id || ""} onChange={e => { setGroupId(e.target.value); setTierName(""); }}>
                {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
              {CHEV}
            </div>
            <div className="gco-tiers" role="radiogroup" aria-label={tr("Quality")}>
              {tiers.map(t => (
                <button key={t.id} type="button" role="radio" aria-checked={t.id === tier?.id} className={`t-${t.tier.toLowerCase()}`} onClick={() => setTierName(t.tier)}>
                  <b>{tr(t.tier)}</b>
                  <span className="gco-m">{packPrice(t.perK)}</span>
                  <small>{tr(PROMISE[t.tier]?.[1] || "")}</small>
                </button>
              ))}
            </div>
            {tier && (
              <ul className={`gco-promise t-${tier.tier.toLowerCase()}`}>
                <li>{CHECK}{tr(PROMISE[tier.tier]?.[0] || "")}</li>
                <li className="per">{tr("Price per")} {pack > 1 ? `${num(pack)} ${unit}` : unit.replace(/s$/, "")}</li>
              </ul>
            )}
            <div className="gco-act">
              <button type="button" className="gco-go" onClick={next} disabled={!tier}>{tr("Next")}</button>
              <p className="gco-line">{tr("No account needed. Pay only for this order.")}</p>
            </div>
          </div>

          <div className="gco-pane" inert={step !== 2 ? true : undefined}>
            {group && tier && (
              <button type="button" className="gco-picked" onClick={() => setStep(1)}>
                <span className="gco-pi" style={{ "--pc": GLYPH[plat]?.[dark ? 1 : 0] }}><Glyph platform={plat} dark={dark} /></span>
                <span className="gco-pt"><b>{group.name}</b><i><span className={`t-${tier.tier.toLowerCase()}`}>{tr(tier.tier)}</span></i></span>
                <span className="gco-change">{tr("Change")}</span>
              </button>
            )}
            <div className="gco-f">
              <label htmlFor="gco-link">{group?.profile ? tr("Profile link") : tr("Post link")}</label>
              <input id="gco-link" ref={linkRef} value={link} onChange={e => { setLink(e.target.value); setPayErr(""); }} placeholder={EXAMPLE[plat]?.[group?.profile ? 0 : 1]} inputMode="url" autoComplete="off" autoCapitalize="none" spellCheck={false} />
            </div>
            {tier?.comments ? (
              <div className="gco-f gco-area">
                <label htmlFor="gco-lines">{tr("Comments, one per line")} <span className="gco-m gco-count">{count}</span></label>
                <textarea id="gco-lines" rows={2} value={lines} onChange={e => setLines(e.target.value)} />
              </div>
            ) : (
              <div className="gco-f">
                <label htmlFor="gco-qty">{tr("How many")}</label>
                <input id="gco-qty" className="gco-m gco-num" value={qty ? num(Number(qty)) : ""} onChange={e => setQty(e.target.value.replace(/\D/g, "").slice(0, 9))}
                  placeholder={tier ? num(Math.max(tier.min, 500)) : ""} inputMode="numeric" autoComplete="off" />
                {group && <span className="gco-unit">{unitOf(group.name)}</span>}
              </div>
            )}
            <div className="gco-f">
              <label htmlFor="gco-email">{tr("Email for your receipt")} <em>{tr("optional")}</em></label>
              <input id="gco-email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" inputMode="email" autoComplete="email" />
            </div>
            <div className="gco-act">
              <button type="button" className="gco-go" onClick={pay} disabled={!!problem || !count || !link.trim() || busy}>
                {busy ? tr("Opening payment…") : due === 0 && count > 0 && !problem ? tr("Place order") : <>{tr("Pay")} <span className="gco-m">{dueShown}</span></>}
              </button>
              <p className={`gco-line${line ? " err" : ""}`} role={line ? "alert" : undefined}>
                {line || <>{tr("By paying you agree to the")} <a href="/terms" target="_blank" rel="noopener noreferrer">{tr("Terms")}</a>. {howToPay}</>}
              </p>
            </div>
          </div>
        </>)}

        <div className="gco-pane" inert={step !== 3 ? true : undefined}>
          {step === 3 && (order ? (
            <>
              <div className="gco-done-main">
                <p className="gco-lead">{lead}</p>
                <div className="gco-key">
                  <span className="gco-key-l">{tr("Your guest code")}</span>
                  <div className="gco-key-v">
                    <span className="gco-m">{order.code}</span>
                    <button type="button" className="gco-copy" onClick={copy} aria-label={tr("Copy guest code")}>{COPY}<span aria-live="polite">{copied ? tr("Copied") : tr("Copy")}</span></button>
                  </div>
                  <p>{tr("Use it to track this order or spend any credit. Keep it private.")}</p>
                </div>
              </div>
              <div className="gco-acts">
                {primary}
                <button type="button" className="gco-ghost" onClick={() => setTrackView(order)}>{tr("Track this order")}</button>
              </div>
            </>
          ) : (
            orderErr ? (
              <div className="gco-done-main">
                <p className="gco-load" role="alert">{orderErr}</p>
                <button type="button" className="gco-go" onClick={again}>{tr("Place another order")}</button>
              </div>
            ) : (
              <>
                <span className="sr-only" role="status">{tr("Checking your payment…")}</span>
                <div className="gco-done-main" aria-hidden="true">
                  <i className="sk sk-line" style={{ width: "92%" }} />
                  <i className="sk sk-line sk-gap" style={{ width: "58%" }} />
                  <i className="sk sk-key" />
                </div>
                <div className="gco-acts" aria-hidden="true"><i className="sk sk-go" /><i className="sk sk-ghost" /></div>
              </>
            )
          ))}
        </div>
      </div>

      <div className="gco-foot">
        {step === 1 ? (
          <form className="gco-track" onSubmit={e => { e.preventDefault(); openTrack(track); }}>
            <label htmlFor="gco-track">{tr("Already ordered?")}</label>
            <input id="gco-track" className={track ? "gco-m" : ""} value={track} onChange={e => { setTrack(e.target.value.toUpperCase()); setTrackMsg(""); }} placeholder={tr("Guest code")} maxLength={9} autoComplete="off" spellCheck={false} />
            <button type="submit" disabled={!CODE_RE.test(track.trim())}>{tr("Track")}</button>
          </form>
        ) : step === 3 ? (order?.orderId ? ((rcptSent || order.receiptTo) ? (
          <div className="gco-track">
            <span className="gco-applied">{CHECK}{tr("Receipt sent to")} <b>{rcptSent || order.receiptTo}</b></span>
          </div>
        ) : (
          <form className="gco-track" onSubmit={e => { e.preventDefault(); sendReceipt(); }}>
            <label htmlFor="gco-rcpt">{tr("Want a receipt?")}</label>
            <input id="gco-rcpt" className="gco-rcpt" type="email" value={rcpt} onChange={e => { setRcpt(e.target.value); setRcptMsg(""); }} placeholder={tr("Email address")} inputMode="email" autoComplete="email" />
            <button type="submit" disabled={rcptBusy || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(rcpt.trim())}>{tr("Send")}</button>
          </form>
        )) : null) : credit ? (
          <div className="gco-track">
            <span className="gco-applied">{CHECK}<b className="gco-m">{money(applied / 100)}</b> {tr("credit from")} <span className="gco-m">{credit.code}</span></span>
            <button type="button" className="ghost" onClick={() => { setCredit(null); setCreditCode(""); }}>{tr("Remove")}</button>
          </div>
        ) : (
          <form className="gco-track" onSubmit={e => { e.preventDefault(); applyCredit(); }}>
            <label htmlFor="gco-credit">{tr("Have a guest code?")}</label>
            <input id="gco-credit" className={creditCode ? "gco-m" : ""} value={creditCode} onChange={e => { setCreditCode(e.target.value.toUpperCase()); setCreditMsg(""); }} placeholder={tr("Guest code")} maxLength={9} autoComplete="off" spellCheck={false} />
            <button type="submit" disabled={!CODE_RE.test(creditCode.trim())}>{tr("Apply")}</button>
          </form>
        )}
        {(step === 1 && trackMsg) || (step === 2 && creditMsg) || (step === 3 && rcptMsg) ? <p className="gco-line err gco-foot-err" role="alert">{step === 1 ? trackMsg : step === 2 ? creditMsg : rcptMsg}</p> : (
          <p className={`gco-more${step === 3 && !order?.orderId ? " gco-more-only" : ""}`}>{tr("Need more services?")} <a href="/signup" onClick={e => { if (onSignup) { e.preventDefault(); onSignup(); } }}>{tr("Sign up free")}</a></p>
        )}
      </div>

      <Modal open={!!trackView} onClose={() => setTrackView(null)} dark={dark} bare maxWidth={420} title={tr("Your order")}>
        {trackView && (
          <div className="overflow-y-auto">
            <GuestOrderTrack key={trackView.code} initial={trackView} preview={!!returnPreview} supportWhatsApp={supportWhatsApp}
              onClose={() => setTrackView(null)}
              onUseCredit={(code) => { setTrackView(null); again(); applyCredit(code, { quiet: true }); }}
              onAnother={() => { setTrackView(null); again(); }} />
          </div>
        )}
      </Modal>
    </div>
  );
}

// The mockup's card, class for class. Logical properties throughout: this
// sheet is not run through the RTL build plugin, so a physical left or right
// would stay put under Arabic.
const GCO_CSS = `
.gco{--card:#fff;--ink:#1a1a1a;--mut:rgba(0,0,0,.58);--line:rgba(0,0,0,.08);--field:#faf7f8;--acc:#c47d8e;--acc-ink:#9a4f63;--ok:#059669;
  --tb:#b45309;--ts:#1d5fa5;--tp:#6d28d9;
  background:var(--card);color:var(--ink);border-radius:20px;padding:22px 22px 0;overflow:hidden;position:relative;z-index:2;
  border:1px solid rgba(0,0,0,.09);box-shadow:0 30px 80px rgba(0,0,0,.26);animation:modalRiseIn .24s cubic-bezier(.2,.8,.2,1) both;text-align:start}
.gco.dk{--card:#160f22;--ink:#f2efe9;--mut:rgba(255,255,255,.62);--line:rgba(255,255,255,.1);--field:#1f1830;--acc-ink:#e3a8b8;--ok:#34d399;
  --tb:#e0a458;--ts:#7aa2f7;--tp:#b79cfb;border-color:rgba(255,255,255,.14)}
.gco ::selection{background:rgba(196,125,142,.28)}
.gco-m{font-family:'JetBrains Mono',ui-monospace,monospace;font-variant-numeric:tabular-nums}
.gco-head{display:flex;justify-content:space-between;align-items:center;gap:10px;min-height:30px}
.gco-h{font-size:17px;font-weight:700;letter-spacing:-.2px;white-space:nowrap}
.gco-step{font-size:11px;color:var(--mut)}
.gco-title{display:flex;align-items:center;gap:6px;min-width:0}
.gco-back{width:30px;height:30px;margin-inline-start:-7px;border:0;border-radius:9px;background:transparent;color:var(--ink);display:flex;align-items:center;justify-content:center;cursor:pointer}
.gco-back:hover{background:var(--field)}
.gco-back svg{width:18px;height:18px}
[dir="rtl"] .gco-back svg{transform:scaleX(-1)}
.gco-market{display:inline-grid;grid-template-columns:1fr 1fr;gap:2px;padding:3px;border-radius:999px;background:var(--field);border:1px solid var(--line);flex-shrink:0}
.gco-market button{display:inline-flex;align-items:center;justify-content:center;gap:5px;border:0;background:transparent;color:var(--mut);border-radius:999px;padding:5px 10px;font-weight:700;font-size:11.5px;line-height:1.2;font-family:inherit;cursor:pointer;white-space:nowrap;transition:background .18s,color .18s,box-shadow .18s}
.gco-market button svg{width:12px;height:12px}
.gco-flag{font-size:12px;line-height:1}
.gco-market button[aria-checked="true"]{background:var(--card);color:var(--ink);box-shadow:0 1px 3px rgba(0,0,0,.12)}
.gco-progress{display:grid;grid-template-columns:1fr 1fr;gap:4px;margin:10px 0 18px}
.gco-progress i{height:3px;border-radius:2px;background:var(--line);display:block}
.gco-progress i.on{background:var(--acc)}
.gco-load{font-size:13px;color:var(--mut);padding:60px 0;text-align:center;margin:0}
.gco-stage{display:grid}
.gco-pane{grid-area:1/1;display:flex;flex-direction:column;min-width:0}
.gco-pane[inert]{visibility:hidden}
.gco-act{margin-top:auto;padding-top:4px}
.gco-plats{display:grid;grid-template-columns:repeat(6,1fr);gap:6px;margin-bottom:14px}
.gco-plats button{height:44px;border-radius:12px;border:1.5px solid var(--line);background:var(--field);display:flex;align-items:center;justify-content:center;cursor:pointer;transition:border-color .18s,box-shadow .18s,background .18s,transform .12s}
.gco-plats button svg{width:19px;height:19px}
.gco-plats button:hover{border-color:color-mix(in srgb,var(--pc) 45%,var(--line))}
.gco-plats button:active{transform:scale(.96)}
.gco-plats button[aria-checked="true"]{border-color:var(--pc);background:color-mix(in srgb,var(--pc) 9%,var(--card));box-shadow:0 0 0 3px color-mix(in srgb,var(--pc) 16%,transparent)}
.gco-plats button[disabled]{opacity:.32;cursor:not-allowed;filter:grayscale(1)}
.gco-f{position:relative;border:1.5px solid var(--line);border-radius:12px;background:var(--field);padding:7px 14px 8px;margin-bottom:10px;transition:border-color .18s,box-shadow .18s}
.gco-f:hover{border-color:color-mix(in srgb,var(--acc) 35%,var(--line))}
.gco-f:focus-within{border-color:var(--acc);box-shadow:0 0 0 3px rgba(196,125,142,.18)}
.gco-f label{display:flex;align-items:center;gap:6px;font-size:11px;font-weight:600;color:var(--mut);margin:0 0 1px;cursor:text}
.gco-f label em{font-style:normal;font-weight:500;opacity:.8}
.gco-f input,.gco-f select,.gco-f textarea{display:block;width:100%;border:0;background:transparent;padding:0;margin:0;outline:none;font-weight:600;font-size:14.5px;line-height:22px;font-family:inherit;color:var(--ink);height:22px}
.gco-f input::placeholder,.gco-f textarea::placeholder{color:var(--mut);opacity:.7;font-weight:500}
.gco-f .gco-num{font-family:'JetBrains Mono',ui-monospace,monospace;font-size:15px;padding-inline-end:90px}
.gco-unit{position:absolute;inset-inline-end:14px;bottom:9px;font-size:13px;color:var(--mut);pointer-events:none}
.gco-sel{margin-bottom:12px}
.gco-sel select{appearance:none;-webkit-appearance:none;cursor:pointer;padding-inline-end:26px}
.gco-sel select option{color:#1a1a1a;background:#fff}
.gco-sel svg{position:absolute;inset-inline-end:13px;top:50%;width:16px;height:16px;transform:translateY(-50%);color:var(--mut);pointer-events:none}
.gco-area textarea{height:40px;line-height:20px;resize:none;font-size:13.5px;font-weight:500}
.gco-count{margin-inline-start:auto;font-size:11px;color:var(--ink)}
.gco-tiers{display:grid;grid-auto-flow:column;grid-auto-columns:1fr;gap:4px;padding:4px;border-radius:14px;background:var(--field);border:1.5px solid var(--line)}
.gco-tiers button{border:0;background:transparent;border-radius:10px;padding:10px 6px 9px;cursor:pointer;color:var(--ink);font-family:inherit;display:flex;flex-direction:column;align-items:center;gap:2px;transition:background .18s,box-shadow .18s}
.gco-tiers button b{font-size:12px;font-weight:700}
.gco-tiers button span{font-size:13px;font-weight:600;color:var(--mut)}
.gco-tiers button small{font-size:10.5px;font-weight:600;color:var(--mut);opacity:.85}
.gco-tiers button:hover{background:color-mix(in srgb,var(--card) 70%,transparent)}
.gco-tiers button[aria-checked="true"]{background:var(--card);box-shadow:0 1px 2px rgba(0,0,0,.08),0 4px 12px -4px rgba(0,0,0,.14)}
.gco-tiers button[aria-checked="true"] span{color:var(--ink)}
.gco-tiers button[aria-checked="true"] small{opacity:1}
.gco-tiers .t-budget[aria-checked="true"] b,.gco-pt .t-budget{color:var(--tb)}
.gco-tiers .t-standard[aria-checked="true"] b,.gco-pt .t-standard{color:var(--ts)}
.gco-tiers .t-premium[aria-checked="true"] b,.gco-pt .t-premium{color:var(--tp)}
.gco-promise{list-style:none;padding:0;margin:10px 2px 18px;display:flex;flex-wrap:nowrap;white-space:nowrap;gap:4px 14px;font-size:12px;color:var(--mut)}
.gco-promise li{display:inline-flex;align-items:center;gap:5px}
.gco-promise svg{width:12px;height:12px}
.gco-promise li.per{margin-inline-start:auto;font-size:11px;opacity:.85}
.gco-promise.t-budget svg{color:var(--tb)}.gco-promise.t-standard svg{color:var(--ts)}.gco-promise.t-premium svg{color:var(--tp)}
.gco-go{width:100%;height:50px;border:0;border-radius:14px;background:var(--acc);color:#fff;font-weight:700;font-size:15px;font-family:inherit;cursor:pointer;box-shadow:0 8px 20px -8px rgba(160,70,95,.6);transition:transform .15s,box-shadow .18s,background .18s}
.gco-go:hover{transform:translateY(-1px);box-shadow:0 12px 24px -10px rgba(160,70,95,.7)}
.gco-go:active{transform:translateY(0)}
.gco-go[disabled]{background:var(--line);color:var(--mut);box-shadow:none;cursor:not-allowed;transform:none}
.gco-line{font-size:11.5px;color:var(--mut);text-align:center;margin:9px 0 0;line-height:1.45;min-height:17px}
.gco-line a{color:inherit;text-decoration:underline;text-underline-offset:2px}
.gco-line.err{color:#c2410c;font-weight:500}
.gco.dk .gco-line.err{color:#fdba74}
.gco-picked{display:flex;align-items:center;gap:11px;width:100%;padding:10px 12px;margin-bottom:16px;border-radius:13px;border:1.5px solid var(--line);background:var(--field);color:var(--ink);cursor:pointer;text-align:start;font-family:inherit}
.gco-picked:hover{border-color:color-mix(in srgb,var(--acc) 45%,var(--line))}
.gco-pi{width:34px;height:34px;border-radius:10px;display:flex;align-items:center;justify-content:center;flex-shrink:0;background:color-mix(in srgb,var(--pc) 12%,var(--card))}
.gco-pi svg{width:18px;height:18px}
.gco-pt{flex:1;min-width:0;display:flex;flex-direction:column}
.gco-pt b{font-size:13.5px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.gco-pt i{font-style:normal;font-size:12px;font-weight:600;display:flex;gap:8px;align-items:center}
.gco-change{font-size:12px;font-weight:600;color:var(--acc-ink)}
.gco-foot{margin:18px -22px 0;padding:14px 22px 16px;background:var(--field);border-top:1px solid var(--line)}
.gco-track{display:flex;align-items:center;gap:8px}
.gco-track label{font-size:12.5px;font-weight:600;color:var(--ink);white-space:nowrap}
.gco-track input{flex:1;min-width:0;height:38px;border-radius:10px;border:1.5px solid var(--line);background:var(--card);color:var(--ink);font-size:13px;letter-spacing:1.5px;text-transform:uppercase;padding:0 10px;outline:none}
.gco-track input::placeholder{letter-spacing:0;text-transform:none}
.gco-track input.gco-rcpt{letter-spacing:0;text-transform:none}
.gco-track input:focus{border-color:var(--acc);box-shadow:0 0 0 3px rgba(196,125,142,.18)}
.gco-track button{height:38px;padding:0 15px;border-radius:10px;border:0;background:var(--ink);color:var(--card);font-weight:700;font-size:12.5px;font-family:inherit;cursor:pointer}
.gco-track button[disabled]{opacity:.3;cursor:not-allowed}
.gco-track button.ghost{background:transparent;color:var(--ink);border:1.5px solid var(--line)}
.gco-applied{flex:1;min-width:0;display:flex;align-items:center;gap:6px;font-size:12.5px;color:var(--ok);height:38px}
.gco-applied svg{width:13px;height:13px;flex-shrink:0}
.gco-more{margin:11px 0 0;font-size:12px;color:var(--mut);text-align:center}
.gco-more a{color:var(--acc-ink);font-weight:700;text-decoration:none;border-bottom:1.5px solid rgba(196,125,142,.4)}
.gco-more a:hover{border-bottom-color:var(--acc)}
.gco-foot-err{margin-top:11px;min-height:0}
.gco-more-only{margin-top:0}
a.gco-go{display:flex;align-items:center;justify-content:center;text-decoration:none}
.gco-ok{width:26px;height:26px;border-radius:50%;background:rgba(5,150,105,.14);color:var(--ok);display:flex;align-items:center;justify-content:center;flex-shrink:0}
.gco-ok svg{width:14px;height:14px}
.gco-progress.done i{background:var(--ok)}
.gco-id{font-size:12px;font-weight:500;color:var(--mut)}
.gco-done-main{margin-block:auto}
.gco-lead{margin:0 0 14px;font-size:14px;color:var(--mut);line-height:1.45}
.gco-lead b{color:var(--ink);font-weight:700}
.gco-key{border-radius:16px;padding:14px 16px 13px;background:color-mix(in srgb,var(--acc) 9%,var(--card));border:1.5px solid color-mix(in srgb,var(--acc) 45%,transparent)}
.gco-key-l{font-size:11.5px;font-weight:600;color:var(--acc-ink)}
.gco-key-v{display:flex;align-items:center;justify-content:space-between;gap:10px;margin:2px 0 6px}
.gco-key-v .gco-m{font-size:clamp(21px,6.4vw,27px);font-weight:700;letter-spacing:.1em;white-space:nowrap;color:var(--ink)}
.gco-copy{flex-shrink:0;display:inline-flex;align-items:center;gap:5px;height:32px;padding:0 12px;border-radius:9px;border:0;background:var(--acc);color:#fff;font-weight:700;font-size:12px;font-family:inherit;cursor:pointer}
.gco-copy svg{width:13px;height:13px}
.gco-copy span{min-width:46px;text-align:start}
.gco-key p{margin:0;font-size:12px;line-height:1.5;color:var(--mut)}
.gco-acts{display:grid;gap:8px;padding-top:16px}
.gco-ghost{display:flex;align-items:center;justify-content:center;height:44px;border-radius:12px;border:1.5px solid var(--line);background:transparent;color:var(--ink);font-weight:700;font-size:13.5px;font-family:inherit;cursor:pointer}
.gco-ghost:hover{border-color:color-mix(in srgb,var(--acc) 45%,var(--line))}
.gco .sk{display:block;border-radius:12px;background:linear-gradient(90deg,var(--field) 20%,color-mix(in srgb,var(--line) 85%,var(--field)) 50%,var(--field) 80%);background-size:250% 100%;animation:gco-sk 1.3s ease-in-out infinite}
.gco .sk-tile{height:44px}
.gco .sk-box{height:54px;margin-bottom:12px}
.gco .sk-tiers{height:68px;border-radius:14px}
.gco .sk-line{height:10px;border-radius:5px}
.gco .sk-end{margin-inline-start:auto}
.gco .sk-mid{margin:13px auto 4px}
.gco .sk-gap{margin:9px 0 16px}
.gco .sk-go{height:50px;border-radius:14px}
.gco .sk-ghost{height:44px}
.gco .sk-key{height:104px;border-radius:16px}
.gco-fail{justify-content:center;gap:4px}
@keyframes gco-sk{from{background-position:100% 0}to{background-position:-50% 0}}
.gco button:focus-visible,.gco a:focus-visible{outline:2px solid var(--acc);outline-offset:2px}
@media (max-width:767px){
  .gco{padding:18px 16px 0}
  .gco-h{font-size:15px}
  .gco-market button{padding:5px 8px;gap:4px}
  .gco-foot{margin:16px -16px 0;padding:12px 16px 14px}
  .gco-plats button{height:42px}
}
@media (prefers-reduced-motion:reduce){.gco{animation:none}.gco *{transition:none!important}.gco .sk{animation:none}}
`;
