'use client';
import { useEffect, useRef, useState } from "react";
import { useDates, useMoney, useT } from "./locale";
import SharedNav, { ThemeProvider, useTheme } from "./shared-nav";
import { PlatformIcon } from "./platform-icon";
import { copyText } from "@/lib/clipboard";
import { msg } from "../lib/i18n";

/* A guest's order, opened by its guest code (docs/v2/guest_checkout_brief.md).
   The card is the track card from the mockup: the order as it stands, the
   code that opens it and holds any credit, and the way to get help. */


// Where an order is, in the visitor's terms. Before there is an order the
// checkout's own status decides; after, the order's.
export function phaseOf(v) {
  if (!v.orderId) {
    if (v.stage === "Quoted" || v.stage === "AwaitingPayment") return "pay";
    if (v.stage === "Placing" || v.stage === "Placed") return "placing";
    if (v.stage === "Expired") return "expired";
    return "notPlaced";
  }
  if (v.stage === "Completed") return "done";
  if (v.stage === "Partial") return "partial";
  if (/^(Cancelled|Failed|Rejected)$/.test(v.stage)) return "refunded";
  return "delivering";
}

const PILL = {
  pay: [msg("Waiting for payment"), "wait"],
  placing: [msg("Placing your order"), "live"],
  delivering: [msg("Delivering"), "live"],
  done: [msg("Delivered"), "ok"],
  partial: [msg("Partly delivered"), "part"],
  refunded: [msg("Refunded"), "off"],
  notPlaced: [msg("Not placed"), "part"],
  expired: [msg("Not paid"), "off"],
};

// The tier promise colours, as on the order card.
const TIER_INK = {
  Budget: ["#b45309", "#e0a458"],
  Standard: ["#1d5fa5", "#7aa2f7"],
  Premium: ["#6d28d9", "#b79cfb"],
};

const PILL_TONE = {
  wait: ["rgba(217,119,6,.12)", "#b45309", "#fbbf24"],
  live: ["rgba(79,70,229,.11)", "#4f46e5", "#a5b4fc"],
  ok: ["rgba(5,150,105,.12)", "#047857", "#6ee7b7"],
  part: ["rgba(234,88,12,.11)", "#c2410c", "#fdba74"],
  off: ["rgba(120,113,108,.12)", "#57534e", "#d6d3d1"],
};

// A payment or a placement moves on its own; check on it every 10 seconds for
// five minutes, then leave it to a button.
const POLL_MS = 10_000;
const POLL_MAX = 30;

function WaIcon() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm5.6 14.1c-.2.6-1.4 1.2-1.9 1.3-.5 0-1 .2-3.3-.7a11.2 11.2 0 0 1-4.6-4.1c-.4-.5-1.1-1.5-1.1-2.8s.7-2 1-2.3c.2-.3.5-.3.7-.3h.5c.2 0 .4 0 .6.5l.8 2c.1.2.1.4 0 .5l-.3.5-.4.4c-.1.2-.3.3-.1.6.2.3.8 1.3 1.8 2.1 1.2 1 2.2 1.4 2.5 1.5.3.2.5.1.7-.1l.9-1.1c.2-.3.4-.2.7-.1l1.9.9c.3.1.5.2.5.3.1.2.1.7-.1 1.2z"/></svg>;
}

/**
 * One guest order as it stands: the order page's card, and the Track pop-up on
 * the landing page. In the pop-up it carries a close button, and "Use credit"
 * and "Place another order" act on the order card behind it instead of
 * loading the home page again.
 */
export function GuestOrderTrack({ initial, verify = false, preview = false, supportWhatsApp = "", onClose, onUseCredit, onAnother, signedIn = false }) {
  const tr = useT();
  const dates = useDates();
  // In the visitor's chosen currency, like every other price on the site.
  const money = useMoney();
  const price = (kobo) => money((kobo || 0) / 100);
  const { dark, t } = useTheme();
  const [view, setView] = useState(initial);
  const [polls, setPolls] = useState(0);
  const [copied, setCopied] = useState(false);
  const [refill, setRefill] = useState({ busy: false, error: "" });
  // A signed-in customer moving this guest order into their account.
  const [claim, setClaim] = useState({ busy: false, error: "", done: false });
  const verified = useRef(false);

  const phase = view ? phaseOf(view) : null;
  // A local preview stays put rather than being checked back to the real state.
  const moving = !preview && (phase === "pay" || phase === "placing");

  // Back from Flutterwave: ask about the payment once, then drop ?verify so a
  // refresh or a shared link does not ask again.
  useEffect(() => {
    if (!verify || verified.current || !view) return;
    verified.current = true;
    window.history.replaceState(null, "", window.location.pathname);
    if (!moving) return;
    fetch("/api/guest/verify", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code: view.code }) })
      .then(r => r.json()).then(d => { if (d?.order) setView(d.order); }).catch(() => {});
  }, [verify, view, moving]);

  useEffect(() => {
    if (!moving || polls >= POLL_MAX) return;
    const id = setTimeout(async () => {
      if (document.visibilityState === "visible") {
        const d = await fetch(`/api/guest/track?code=${view.code}`, { cache: "no-store" }).then(r => r.json()).catch(() => null);
        if (d?.order) setView(d.order);
      }
      setPolls(n => n + 1);
    }, POLL_MS);
    return () => clearTimeout(id);
  }, [moving, polls, view?.code]);

  const waBtn = <WaButtonLink supportWhatsApp={supportWhatsApp} code={view.code} />;

  const copy = async () => {
    try { await copyText(view.code); } catch {}
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const moveToAccount = async () => {
    setClaim({ busy: true, error: "", done: false });
    const res = await fetch("/api/guest/claim", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code: view.code }) }).catch(() => null);
    const d = await res?.json().catch(() => null);
    if (res?.ok) {
      setView(v => ({ ...v, claimable: false, refundsTo: "wallet", creditKobo: 0 }));
      setClaim({ busy: false, error: "", done: true });
    } else setClaim({ busy: false, error: d?.error ? tr(d.error) : tr("Could not move the order. Try again."), done: false });
  };

  const askRefill = async () => {
    setRefill({ busy: true, error: "" });
    const res = await fetch("/api/guest/refill", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code: view.code }) }).catch(() => null);
    const d = await res?.json().catch(() => null);
    if (res?.ok) { setView(v => ({ ...v, refillRequested: true, canRefill: false })); setRefill({ busy: false, error: "" }); }
    else setRefill({ busy: false, error: d?.error ? tr(d.error) : tr("Could not request the refill. Try again.") });
  };

  const card = cardClass(!!onClose);
  const cardStyle = cardLook(t, dark, !!onClose);
  const H = onClose ? "h2" : "h1";

  const [pillLabel, tone] = PILL[phase];
  const [pillBg, pillLight, pillDark] = PILL_TONE[tone];
  const tierInk = TIER_INK[view.tier]?.[dark ? 1 : 0] || t.soft;
  const hasOrder = !!view.orderId;
  const pct = view.quantity ? Math.min(100, Math.round((view.delivered / view.quantity) * 100)) : 0;
  const barFill = phase === "done" ? "#059669" : phase === "partial" ? "#ea580c" : "linear-gradient(90deg,#6366f1,#8b5cf6)";
  const toCode = view.refundsTo === "code";

  const note = {
    pay: tr("A bank transfer can take a few minutes to arrive. This page updates by itself."),
    placing: tr("Your payment arrived. Your order is being placed now."),
    delivering: tr("Delivery takes 0 to 6 hours, up to 24 in a few cases."),
    done: view.canRefill ? tr("If your count dropped after delivery, we'll top it back up at no extra cost. This may take a few hours.") : null,
    partial: toCode ? null : tr("What could not be delivered was refunded to your Nitro wallet."),
    refunded: toCode
      ? tr("This order could not be delivered, so the money came back as credit on your code.")
      : tr("This order could not be delivered, so the money went back to your Nitro wallet."),
    notPlaced: toCode
      ? tr("Your payment arrived, but the order could not be placed. The money is kept as credit on your code.")
      : tr("Your payment arrived, but the order could not be placed. The money is in your Nitro wallet."),
    expired: tr("This order was not paid for in time, so its price is no longer held."),
  }[phase];

  return (
    <div className={card} style={cardStyle}>
      <div className="flex items-center justify-between gap-2.5 mb-3.5">
        <H className="text-base font-bold tracking-[-.2px] m-0">
          {hasOrder ? <>{tr("Order")} <span className="font-mono font-semibold">{view.orderId}</span></> : tr("Your order")}
        </H>
        {onClose && (
          <button type="button" onClick={onClose} aria-label={tr("Close")} className="w-9 h-9 shrink-0 rounded-[11px] border-0 flex items-center justify-center cursor-pointer -me-1.5" style={{ background: t.surface, color: t.text }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>
          </button>
        )}
      </div>

      <div className="flex items-center gap-[11px] mb-4 min-w-0">
        <span className="shrink-0"><PlatformIcon platform={view.platform} dark={dark} size={34} /></span>
        <span className="flex-1 min-w-0 flex flex-col">
          <b className="text-[13.5px] font-bold truncate">{view.service}</b>
          <span className="text-xs font-semibold flex gap-[7px] items-center">
            {view.tier && <span style={{ color: tierInk }}>{tr(view.tier)}</span>}
            <span className="font-mono" style={{ color: t.soft }}>{view.quantity.toLocaleString("en-NG")}</span>
          </span>
        </span>
        <span className="text-[11.5px] font-bold py-1 px-2.5 rounded-full whitespace-nowrap" style={{ background: pillBg, color: dark ? pillDark : pillLight }}>{tr(pillLabel)}</span>
      </div>

      {phase === "pay" && (
        <div className="mb-3.5">
          <div className="flex items-baseline gap-[7px]">
            <b className="font-mono text-[26px] font-bold tracking-[-.5px]">{price(view.dueKobo)}</b>
            <span className="text-[13px]" style={{ color: t.soft }}>{tr("to pay")}</span>
          </div>
        </div>
      )}

      {hasOrder && phase !== "refunded" && (
        <div className="mb-3.5">
          <div className="flex items-baseline gap-[7px] mb-2">
            <b className="font-mono text-[26px] font-bold tracking-[-.5px]">{view.delivered.toLocaleString("en-NG")}</b>
            <span className="text-[13px]" style={{ color: t.soft }}>{tr("of")} {view.quantity.toLocaleString("en-NG")} {tr("delivered")}</span>
          </div>
          <div className="h-2 rounded-full overflow-hidden" style={{ background: t.surfaceBrd }} role="progressbar" aria-label={tr("Delivered")} aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
            <i className="block h-full rounded-full" style={{ width: `${pct}%`, background: barFill }} />
          </div>
        </div>
      )}

      {note && <p className="text-[12.5px] leading-[1.5] -mt-1 mb-3.5" style={{ color: t.soft }}>{note}</p>}

      {view.creditKobo > 0 && (
        <div className="rounded-[14px] py-[13px] px-3.5 mb-3.5 border-[1.5px]" style={{ background: "rgba(5,150,105,.08)", borderColor: "rgba(5,150,105,.3)" }}>
          <div className="flex items-baseline gap-[7px]">
            <b className="font-mono text-[21px] font-bold" style={{ color: t.green }}>{price(view.creditKobo)}</b>
            <span className="text-[13px] font-semibold">{tr("credit on your code")}</span>
          </div>
          <p className="text-[12.5px] leading-[1.5] mt-[5px] mb-[11px]" style={{ color: t.soft }}>{tr("Spend it on your next order. It comes off the price when you enter this code.")}</p>
          {onUseCredit
            ? <button type="button" onClick={() => onUseCredit(view.code)} className="flex items-center justify-center w-full h-10 rounded-[11px] border-0 text-white text-[13px] font-bold cursor-pointer bg-[#059669]">{tr("Use credit")}</button>
            : <a href={`/?guest_code=${view.code}`} className="flex items-center justify-center w-full h-10 rounded-[11px] text-white text-[13px] font-bold no-underline bg-[#059669]">{tr("Use credit")}</a>}
        </div>
      )}

      <div className="rounded-2xl pt-3.5 px-4 pb-[13px] mb-3.5" style={{ background: dark ? "rgba(227,164,181,.09)" : "rgba(196,125,142,.09)" }}>
        <div className="text-[11.5px] font-semibold" style={{ color: t.accentInk }}>{tr("Your guest code")}</div>
        <div className="flex items-center justify-between gap-2.5 mt-0.5 mb-1.5">
          <span className="font-mono font-bold tracking-[.1em] whitespace-nowrap text-[clamp(21px,6.4vw,27px)]">{view.code}</span>
          <button type="button" onClick={copy} className="shrink-0 inline-flex items-center gap-[5px] h-8 px-3 rounded-[9px] border-0 text-white text-[12.5px] font-bold cursor-pointer" style={{ background: t.accent }} aria-live="polite">
            {copied ? tr("Copied") : tr("Copy")}
          </button>
        </div>
        <p className="text-xs leading-[1.5]" style={{ color: t.soft }}>{tr("Keep it. It opens this page and holds any credit.")}</p>
      </div>

      <dl className="mb-4">
        {[
          [tr("Link"), view.link],
          // While paying, the figure above already says it, unless credit took some off.
          !(phase === "pay" && view.dueKobo === view.priceKobo) && [phase === "pay" || phase === "expired" ? tr("Price") : tr("Paid"), price(view.priceKobo)],
          view.placedAt && [tr("Placed"), dates.d(view.placedAt)],
        ].filter(Boolean).map(([k, v], i, all) => (
          <div key={k} className="flex justify-between gap-3 py-2 text-[13px]" style={{ borderBottom: i < all.length - 1 ? `1px solid ${t.surfaceBrd}` : "none" }}>
            <dt style={{ color: t.soft }}>{k}</dt>
            <dd className="m-0 font-semibold text-end min-w-0 truncate">{v}</dd>
          </div>
        ))}
      </dl>

      <div className="grid gap-2">
        {phase === "pay" && view.payUrl && (
          <a href={view.payUrl} className="flex items-center justify-center h-12 rounded-[14px] text-white text-[15px] font-bold no-underline" style={{ background: t.accent }}>{tr("Finish paying")}</a>
        )}
        {moving && polls >= POLL_MAX && (
          <button type="button" onClick={() => setPolls(0)} className={ghost + " bg-transparent cursor-pointer"} style={{ borderColor: t.cardBorder, color: t.text }}>{tr("Check again")}</button>
        )}
        {phase === "done" && (view.canRefill || view.refillRequested) && (
          <button type="button" onClick={askRefill} disabled={refill.busy || view.refillRequested} className={ghost + " bg-transparent cursor-pointer disabled:cursor-default disabled:opacity-60"} style={{ borderColor: t.cardBorder, color: t.text }}>
            {view.refillRequested ? tr("Refill requested") : tr("Request Refill")}
          </button>
        )}
        {refill.error && <p role="alert" className="text-[12.5px] m-0" style={{ color: t.red }}>{refill.error}</p>}
        {signedIn && view.claimable && !claim.done && (
          <button type="button" onClick={moveToAccount} disabled={claim.busy} className={ghost + " bg-transparent cursor-pointer disabled:opacity-60"} style={{ borderColor: t.accent, color: t.accentInk }}>
            {claim.busy ? tr("Moving…") : tr("Move to my account")}
          </button>
        )}
        {claim.error && <p role="alert" className="text-[12.5px] m-0" style={{ color: t.red }}>{claim.error}</p>}
        {claim.done && (
          <p role="status" className="text-[12.5px] m-0 text-center" style={{ color: t.green }}>
            {tr("Moved to your account. It is under History in")} <a href="/dashboard" style={{ color: t.accentInk, fontWeight: 700 }}>{tr("your dashboard")}</a>.
          </p>
        )}
        {waBtn}
        {!moving && (onAnother
          ? <button type="button" onClick={onAnother} className={ghost + " bg-transparent cursor-pointer"} style={{ borderColor: t.cardBorder, color: t.text }}>{phase === "expired" ? tr("Start a new order") : tr("Place another order")}</button>
          : <a href="/" className={ghost} style={{ borderColor: t.cardBorder, color: t.text }}>{phase === "expired" ? tr("Start a new order") : tr("Place another order")}</a>)}
      </div>
    </div>
  );
}

const ghost = "flex items-center justify-center gap-[7px] h-11 rounded-xl text-[13.5px] font-bold no-underline border-[1.5px]";
// On the page it is a card of its own; in the pop-up the pop-up is the card.
const cardClass = (flat) => flat ? "p-[22px] max-[420px]:px-4" : "rounded-[20px] p-[22px] max-[420px]:px-4 border";
const cardLook = (t, dark, flat) => flat
  ? { color: t.text }
  : { background: t.cardBg, borderColor: t.cardBorder, color: t.text, boxShadow: dark ? "0 24px 60px rgba(0,0,0,.35)" : "0 24px 60px rgba(60,20,35,.08)" };

function WaButtonLink({ supportWhatsApp, code }) {
  const tr = useT();
  const wa = supportWhatsApp.replace(/\D/g, "");
  if (!wa) return null;
  const href = `https://wa.me/${wa}?text=${encodeURIComponent(`${tr("Hi Nitro, I need help with my order. My guest code is")} ${code || ""}`.trim())}`;
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-[7px] h-11 rounded-xl text-[13.5px] font-bold no-underline text-white bg-[#25d366] hover:bg-[#1fbd5a]">
      <WaIcon />{tr("Help on WhatsApp")}
    </a>
  );
}

function Inner({ state, initial, verify, preview, supportWhatsApp, signedIn }) {
  const tr = useT();
  const { dark, t, loaded } = useTheme();
  if (!loaded) return <div style={{ minHeight: "100dvh", background: t.bg }} />;

  let content;
  if (initial) content = <GuestOrderTrack initial={initial} verify={verify} preview={preview} supportWhatsApp={supportWhatsApp} signedIn={signedIn} />;
  else {
    const limited = state === "limited";
    content = (
      <div className={cardClass(false)} style={cardLook(t, dark, false)}>
        <h1 className="text-[19px] font-bold mb-2">{limited ? tr("Too many lookups") : tr("No order has that code")}</h1>
        <p className="text-sm leading-[1.6] mb-5" style={{ color: t.soft }}>
          {limited
            ? tr("Too many orders were looked up from your network. Try again in a few minutes.")
            : tr("Check the code and try again. It is eight letters and numbers, like G7K2-9XQM.")}
        </p>
        <div className="grid gap-2">
          <WaButtonLink supportWhatsApp={supportWhatsApp} />
          <a href="/" className={ghost} style={{ borderColor: t.cardBorder, color: t.text }}>{tr("Back to Nitro")}</a>
        </div>
      </div>
    );
  }
  return (
    <div className="min-h-dvh flex flex-col" style={{ background: t.bg, color: t.text }}>
      <SharedNav />
      <div className="flex-1 flex justify-center px-4 pt-10 pb-16 max-md:pt-6">
        <div className="w-full max-w-[440px]">{content}</div>
      </div>
    </div>
  );
}

export default function GuestOrderPage(props) {
  return <ThemeProvider><Inner {...props} /></ThemeProvider>;
}
