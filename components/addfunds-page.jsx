'use client';
import { useState, useEffect, useRef, useCallback, Fragment } from "react";
import { RailSec, RailCard, RailRow, RailStep, RailEmpty } from "./rail";
import { useBodyScrollLock } from "./ui-primitives";
import { useToast } from "./toast";
import { fN, fD, docDateLocale } from "../lib/format";
import { useMoney, useT, useLocale, useNairaAside } from "./locale";
import { msg } from "../lib/i18n";
import { MAX_BONUS_NAIRA } from "../lib/welcome-bonus";
import { canChargeIn, depositPresets, foreignChargeAmount, formatMoney } from "../lib/currency";
import { BONUS_PRESETS, bonusForNaira, nextBonusTier } from "../lib/welcome-bonus";
import { DateRangePicker, FilterDropdown } from "./date-range-picker";
import { PointsModal } from "./rewards";
import NitroLoader from "./nitro-loader";
import { ManualTransferSheet } from "./manual-transfer-sheet";
import { PAYMENT_STATES, isCreditedPaymentResult, paymentStateFromTransactionStatus } from "../lib/payment-state";
import {
  creditedCryptoPaymentStatus,
  cryptoPaymentPresentation,
  getCryptoPaymentAttempt,
  isDefinitiveCryptoCreationRejection,
  isTerminalCryptoPaymentResult,
  releaseCryptoPaymentAttempt,
} from "../lib/crypto-payment-ui";
import { copyText } from '@/lib/clipboard';
import { OffsetIcon } from "./offset-icons";

// The ledger's row icons, offset print like the rest (17 Oct 2026).
const I_IN = <OffsetIcon name="moneyIn" size={16} />;
const I_OUT = <OffsetIcon name="moneyOut" size={16} />;
const I_PEOPLE = <OffsetIcon name="referral" size={16} />;
const I_BACK = <OffsetIcon name="refresh" size={16} />;
const I_PLUS = <OffsetIcon name="plusCircle" size={16} />;
const I_MINUS = <OffsetIcon name="minusCircle" size={16} />;
const I_GIFT = <OffsetIcon name="gift" size={16} />;
const I_STAR = <OffsetIcon name="star" size={16} />;
const I_CLOCK = <OffsetIcon name="clockPlain" size={16} />;
const I_BANK = <OffsetIcon name="bank" size={16} />;
const I_CARD = <OffsetIcon name="card" size={16} />;
const I_COIN = <OffsetIcon name="crypto" size={16} />;
// The printed tile (.ic-tile in globals.css). clr gives it a status colour.
const Tile = ({ size, clr, children }) => <span className={`ic-tile${clr ? " tc" : ""}`} style={{ width: size, height: size, borderRadius: size <= 24 ? 7 : 10, ...(clr ? { "--tc": clr } : null) }}>{children}</span>;

const TX_META = {
  deposit:      { label: msg("Deposit"),       icon: I_IN,     clr: dk => dk ? "#6ee7b7" : "#059669" },
  order:        { label: msg("Order"),         icon: I_OUT,    clr: dk => dk ? "#fca5a5" : "#dc2626" },
  referral:     { label: msg("Referral bonus"),icon: I_PEOPLE, clr: () => "#c47d8e" },
  refund:       { label: msg("Refund"),        icon: I_BACK,   clr: dk => dk ? "#fcd34d" : "#d97706" },
  admin_credit: { label: msg("Admin credit"),  icon: I_PLUS,   clr: dk => dk ? "#a5b4fc" : "#4f46e5" },
  admin_gift:   { label: msg("Gift"),          icon: I_GIFT,   clr: dk => dk ? "#f0abfc" : "#a855f7" },
  admin_debit:  { label: msg("Adjustment"),    icon: I_MINUS,  clr: dk => dk ? "#fca5a5" : "#dc2626" },
  bonus:        { label: msg("Task reward"),   icon: I_STAR,   clr: dk => dk ? "#f0abfc" : "#a855f7" },
  bonus_expired:{ label: msg("Credit expired"),icon: I_CLOCK,  clr: dk => dk ? "#a1a1aa" : "#71717a" },
};
/** How a deposit arrived, in the customer's words rather than the gateway's. */
const DEPOSIT_METHOD = {
  flutterwave: msg("Card or bank transfer"),
  paystack: msg("Card or bank transfer"),
  monnify: msg("Bank transfer"),
  manual: msg("Bank transfer"),
  crypto: msg("Crypto"),
};

function txClr(type, dk) { return (TX_META[type] || TX_META.order).clr(dk); }
function isFlutterwaveDeposit(tx) {
  return tx.type === "deposit" && (tx.method === "flutterwave" || tx.method == null);
}
function txPaymentState(tx) {
  if (tx.paymentState) return tx.paymentState;
  if (!isFlutterwaveDeposit(tx)) return null;
  return paymentStateFromTransactionStatus(tx.status);
}
function txIsCompleted(tx) {
  const paymentState = txPaymentState(tx);
  return tx.status === "Completed" && (!paymentState || paymentState === PAYMENT_STATES.CREDITED);
}
function txRowClr(tx, dk) {
  const paymentState = txPaymentState(tx);
  if (paymentState === PAYMENT_STATES.VERIFYING) return dk ? "#a5b4fc" : "#4f46e5";
  if (paymentState === PAYMENT_STATES.PROVIDER_PENDING) return dk ? "#fcd34d" : "#d97706";
  if (paymentState === PAYMENT_STATES.RETRYABLE) return dk ? "#fdba74" : "#ea580c";
  if (paymentState === PAYMENT_STATES.REVIEW) return dk ? "#fcd34d" : "#d97706";
  if (paymentState === PAYMENT_STATES.FAILED) return dk ? "#fca5a5" : "#dc2626";
  if (paymentState === PAYMENT_STATES.CREDITED && tx.status !== "Completed") return dk ? "#a5b4fc" : "#4f46e5";
  if (tx.status === "Failed" || tx.status === "Rejected") return dk ? "#fca5a5" : "#dc2626";
  if (tx.status === "Pending") return dk ? "#fcd34d" : "#d97706";
  if (tx.status === "Processing") return dk ? "#a5b4fc" : "#4f46e5";
  if (tx.status === "Expired") return dk ? "#fdba74" : "#ea580c";
  if (tx.status === "Review") return dk ? "#fcd34d" : "#d97706";
  if (tx.status === "Refunded") return dk ? "#fca5a5" : "#dc2626";
  if (tx.status === "Cancelled") return dk ? "#a1a1aa" : "#71717a";
  return txClr(tx.type, dk);
}
function txStatusMeta(tx, dk, tr) {
  const paymentState = txPaymentState(tx);
  const status = paymentState || tx.status;
  // A Flutterwave checkout the user closed before paying never becomes a
  // transaction on their side. That is not a failure, and red is the wrong
  // colour for it — nor is "Retrying" or "Expired": nothing is owed and nothing
  // is coming. Rows written before 11 Sep 2026 carry provider_not_found and
  // read Failed; since then they carry abandoned and read Expired.
  if (/flutterwave_verification:(provider_not_found|abandoned)/.test(tx.note || "")) {
    return { label: tr("Not completed"), color: dk ? "#a1a1aa" : "#71717a", bg: dk ? "rgba(161,161,170,.12)" : "rgba(113,113,122,.08)" };
  }
  const styles = {
    [PAYMENT_STATES.VERIFYING]: { label: tr("Verifying"), color: dk ? "#a5b4fc" : "#4f46e5", bg: dk ? "rgba(165,180,252,.12)" : "rgba(79,70,229,.08)" },
    [PAYMENT_STATES.PROVIDER_PENDING]: { label: tr("Pending"), color: dk ? "#fcd34d" : "#d97706", bg: dk ? "rgba(252,211,77,.12)" : "rgba(217,119,6,.08)" },
    [PAYMENT_STATES.RETRYABLE]: { label: tr("Retrying"), color: dk ? "#fdba74" : "#ea580c", bg: dk ? "rgba(253,186,116,.12)" : "rgba(234,88,12,.08)" },
    [PAYMENT_STATES.REVIEW]: { label: tr("Manual review"), color: dk ? "#fcd34d" : "#d97706", bg: dk ? "rgba(252,211,77,.12)" : "rgba(217,119,6,.08)" },
    [PAYMENT_STATES.FAILED]: { label: tr("Failed"), color: dk ? "#fca5a5" : "#dc2626", bg: dk ? "rgba(252,165,165,.12)" : "rgba(220,38,38,.08)" },
    Processing: { label: tr("Processing"), color: dk ? "#a5b4fc" : "#4f46e5", bg: dk ? "rgba(165,180,252,.12)" : "rgba(79,70,229,.08)" },
    Pending: { label: tr("Pending"), color: dk ? "#fcd34d" : "#d97706", bg: dk ? "rgba(252,211,77,.12)" : "rgba(217,119,6,.08)" },
    Expired: { label: tr("Expired"), color: dk ? "#fdba74" : "#ea580c", bg: dk ? "rgba(253,186,116,.12)" : "rgba(234,88,12,.08)" },
    Review: { label: tr("Manual review"), color: dk ? "#fcd34d" : "#d97706", bg: dk ? "rgba(252,211,77,.12)" : "rgba(217,119,6,.08)" },
    Refunded: { label: tr("Refunded"), color: dk ? "#fca5a5" : "#dc2626", bg: dk ? "rgba(252,165,165,.12)" : "rgba(220,38,38,.08)" },
    Failed: { label: tr("Failed"), color: dk ? "#fca5a5" : "#dc2626", bg: dk ? "rgba(252,165,165,.12)" : "rgba(220,38,38,.08)" },
    Rejected: { label: tr("Rejected"), color: dk ? "#fca5a5" : "#dc2626", bg: dk ? "rgba(252,165,165,.12)" : "rgba(220,38,38,.08)" },
    Cancelled: { label: tr("Cancelled"), color: dk ? "#a1a1aa" : "#71717a", bg: dk ? "rgba(161,161,170,.12)" : "rgba(113,113,122,.08)" },
  };
  return styles[status] || null;
}
function txAmountPrefix(tx) {
  return tx.amount > 0 && txIsCompleted(tx) ? "+" : "";
}
function fNShort(v, money) {
  if (money) return money(v, { round: "down" }); const a = Math.abs(v); if (a >= 1e8) return `₦${(a/1e6).toFixed(1).replace(/\.0$/,"")}M`; if (a >= 1e6) return `₦${(a/1e6).toFixed(2).replace(/\.?0+$/,"")}M`; if (a >= 1e5) return `₦${(a/1e3).toFixed(1).replace(/\.0$/,"")}K`; return fN(v); }
function txIcon(type) { return (TX_META[type] || TX_META.order).icon; }
function txLabel(type) { return (TX_META[type] || { label: type }).label; }
/**
 * The one line under a ledger row.
 *
 * It used to return the transaction's raw note whenever there was one, and
 * those notes are written for us, not for the customer: they repeat the amount
 * that is already on the row, carry internal markers, name the admin who acted,
 * and — because a transfer is credited with who it came from — named OTHER
 * customers. "Credited by Soludo (transfer from Thankgod ayomide" was on a real
 * wallet. Nothing here reads the note any more; every line is built from the
 * fields the row already shows.
 */
function txDesc(tx, tr) {
  const ref = tx.reference || "";
  switch (tx.type) {
    case "order": {
      // The platform is the only useful thing the note carried, and it is a
      // single safe word: "Instagram", "Twitter/X".
      const platform = tx.description?.match(/—\s*([A-Za-z/]+)/)?.[1];
      const id = ref.startsWith("BULK-") ? `${tr("Bulk")} ${ref}` : ref;
      if (!id) return tr("Order");
      return platform ? `${id} · ${platform}` : id;
    }
    case "refund":
      return ref ? `${tr("Refund for")} ${ref.replace(/^(ADM-)?REF-/, "").replace(/-REF$/, "")}` : tr("Order refund");
    case "deposit":
      return DEPOSIT_METHOD[tx.method] ? tr(DEPOSIT_METHOD[tx.method]) : tr("Wallet top-up");
    case "referral":
      return tr("Referral commission");
    case "admin_credit":
      return tr("Credited by Nitro Team");
    case "admin_gift":
      return tr("A gift from Nitro");
    case "admin_debit":
      return ref === "CASH-REFUND" ? tr("Refunded to your bank") : tr("Balance adjustment");
    case "bonus":
      return tr("Reward credited");
    case "bonus_expired":
      return tr("Unused credit expired");
    default:
      return "";
  }
}


// Mirrors MIN_CRYPTO_KOBO in app/api/payments/crypto/route.js. The server is
// still the authority; this exists so the floor is visible before somebody
// picks crypto and presses pay.
const MIN_CRYPTO_NGN = 10_000;

// Each way to pay, named for what the customer does rather than the gateway's
// name in admin, with what it takes, how long it takes, and what happens once
// it is picked. A gateway missing from here falls back to its admin name.
const GW_META = {
  flutterwave: { name: msg("Pay online"), brand: "Flutterwave", icon: "card", desc: msg("Card, bank transfer or mobile money"), speed: msg("Fast"), fast: true, next: msg("Opens a secure checkout and credits your wallet when it clears.") },
  manual: { name: msg("Bank transfer to Nitro"), icon: "bank", desc: msg("Send from any bank app, we confirm it"), speed: msg("15 to 60 min"), next: msg("Next you get our account number. Send the exact amount, then tell us the name on the account you sent from.") },
  crypto: { name: msg("Crypto"), icon: "crypto", desc: msg("Bitcoin, USDT and more"), speed: msg("5 to 30 min"), next: msg("You pick your coin on the next screen. It credits once the network confirms.") },
};

const WF_TICK = <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12.5l4.2 4.2L19 7" /></svg>;
// Gifts, naira coins and sparks, drifting behind the first deposit card.
const PAT_GIFT = (c) => `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96" fill="none" stroke="${c}" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="10" y="16" width="20" height="15" rx="2"/><path d="M8 16h24v-5H8zM20 11v20M20 11c-3-5-8-4-7 0M20 11c3-5 8-4 7 0"/><circle cx="68" cy="22" r="9"/><path d="M64 26V18l8 8v-8M62.5 21h11M62.5 23.5h11"/><path d="M28 66l2.5 5 5 2.5-5 2.5-2.5 5-2.5-5-5-2.5 5-2.5z"/><circle cx="76" cy="74" r="6"/><circle cx="76" cy="74" r="2.5"/><path d="M50 50h8M54 46v8"/></svg>`)}")`;

// The funding half of the page in the offset print (17 Oct 2026): the gold
// first deposit card with its tickets, the amount slot, keycap quick amounts,
// method cards that lift when picked, and the receipt.
const WF_CSS = `
.wf-col{display:grid;grid-template-columns:minmax(0,1fr);grid-auto-rows:max-content;gap:10px}
.wf-card{border-radius:18px;background:var(--t-card-bg);box-shadow:inset 0 0 0 1px var(--t-card-border),2px 2px 0 #efc4cf}
.dark .wf-card{box-shadow:inset 0 0 0 1px var(--t-card-border),2px 2px 0 #5e3242}
.wf-eb{display:flex;align-items:center;gap:7px;padding-inline:2px;font-size:10.5px;font-weight:700;letter-spacing:1.4px;text-transform:uppercase;color:var(--t-text-muted)}
.wf-eb svg{color:var(--t-accent-ink)}
.wf-bal{display:flex;align-items:center;gap:12px 14px;flex-wrap:wrap;padding:16px 18px}
.wf-bal-v{flex:1;min-width:0}
.wf-bal-n{margin-top:7px;font-size:32px;font-weight:800;line-height:1;letter-spacing:-.015em;color:var(--t-text)}
.wf-bal-x{flex-basis:100%;min-width:0}
.wf-pts{display:inline-flex;align-items:center;gap:10px;min-height:44px;max-width:100%;padding-block:6px;padding-inline:8px 6px;border:0;border-radius:13px;font:inherit;text-align:start;cursor:pointer;color:#854f0b;background:#fef4e2;box-shadow:inset 0 0 0 1px #ecd2a6,2px 2px 0 #ecd2a6}
.dark .wf-pts{color:#e0a458;background:#2a1f0f;box-shadow:inset 0 0 0 1px #4f3a1c,2px 2px 0 #120c03}
.wf-pts .tx{display:flex;flex-direction:column;min-width:0}
.wf-pts b{font-size:13px;font-weight:650}
.wf-pts small{font-size:11px;opacity:.8;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.wf-pts .vw{height:30px;display:inline-flex;align-items:center;flex-shrink:0;padding-inline:11px;border-radius:9px;font-size:12px;font-weight:700;background:rgba(255,255,255,.75)}
.dark .wf-pts .vw{background:rgba(255,255,255,.07)}
.wf-amt{display:grid;grid-template-columns:minmax(0,1fr);gap:12px;padding:14px}
.wf-gold{position:relative;overflow:hidden;isolation:isolate;border-radius:16px;padding:14px 14px 16px;color:#5a3510;background:linear-gradient(150deg,#fff6dc 0%,#ffe6a6 55%,#f9cd6e 100%);box-shadow:2.5px 2.5px 0 #d9a443}
.dark .wf-gold{color:#f6d48a;background:linear-gradient(150deg,#2c200b 0%,#3b2a0e 55%,#4e3812 100%);box-shadow:2.5px 2.5px 0 #120c03}
.wf-gold::before{content:"";position:absolute;inset:-96px 0 0 -96px;z-index:-1;background-image:${PAT_GIFT("#7a4a10")};background-size:96px 96px;opacity:.12;animation:wfDrift 44s linear infinite}
.dark .wf-gold::before{background-image:${PAT_GIFT("#f6d48a")};opacity:.1}
@keyframes wfDrift{to{transform:translate(96px,96px)}}
.wf-gold-top{display:flex;align-items:center;gap:9px}
.wf-gold-g{width:30px;height:30px;flex-shrink:0;display:grid;place-items:center;border-radius:10px;background:rgba(255,255,255,.55);box-shadow:inset 0 0 0 1px rgba(122,74,16,.25),2px 2px 0 rgba(122,74,16,.3)}
.dark .wf-gold-g{background:rgba(255,255,255,.08);box-shadow:inset 0 0 0 1px rgba(246,212,138,.25),2px 2px 0 rgba(0,0,0,.4)}
.wf-gold-eb{font-size:10.5px;font-weight:700;letter-spacing:1.6px;text-transform:uppercase;opacity:.78}
.wf-gold-h{margin:8px 0 14px;font-size:23px;font-weight:600;line-height:1.08;text-wrap:balance}
.wf-tks{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}
.wf-tkw{position:relative;display:flex;flex-direction:column;min-width:0;padding:0;border:0;background:none;font:inherit;text-align:start;cursor:pointer;filter:drop-shadow(2px 2px 0 rgba(122,74,16,.32));transition:transform .14s}
.dark .wf-tkw{filter:drop-shadow(2px 2px 0 rgba(0,0,0,.55))}
.wf-tkw:hover{transform:translateY(-1px)}
.wf-tkw.on,.dark .wf-tkw.on{filter:drop-shadow(2.5px 2.5px 0 #6b3a4a)}
.wf-tkw:focus-visible{outline:2px solid #6b3a4a;outline-offset:3px;border-radius:12px}
.wf-tk{flex:1;display:flex;flex-direction:column;border-radius:12px;padding:12px 12px 11px;background:var(--t-card-bg);
  -webkit-mask:radial-gradient(circle 6px at 0 42px,#0000 96%,#000),radial-gradient(circle 6px at 100% 42px,#0000 96%,#000);-webkit-mask-composite:source-in;
  mask:radial-gradient(circle 6px at 0 42px,#0000 96%,#000),radial-gradient(circle 6px at 100% 42px,#0000 96%,#000);mask-composite:intersect}
.wf-tkw.on .wf-tk{background:color-mix(in srgb,#c47d8e 9%,var(--t-card-bg));box-shadow:inset 0 0 0 2px #c47d8e}
.wf-tk-a{font-size:15.5px;font-weight:800;line-height:20px;letter-spacing:-.01em;color:var(--t-text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.wf-tk hr{height:0;margin:9px -12px 8px;border:0;border-top:1.5px dashed var(--t-card-border)}
.wf-tk-f{font-size:13px;font-weight:700;line-height:1.2;color:var(--t-green)}
.wf-stamp{position:absolute;top:-9px;inset-inline-start:9px;z-index:2;padding:3px 7px;border-radius:6px;font-size:9.5px;font-weight:800;line-height:1.1;letter-spacing:.07em;text-transform:uppercase;white-space:nowrap;color:#fff;background:#96626f;box-shadow:1.5px 1.5px 0 #6b3a4a}
.wf-lbl{display:flex;align-items:baseline;justify-content:space-between;gap:10px;padding-inline:2px;font-size:12.5px;font-weight:650;color:var(--t-text)}
.wf-lbl small{font-size:11.5px;font-weight:500;color:var(--t-text-muted)}
.wf-fld{display:flex;align-items:center;gap:8px;height:66px;padding-inline:18px 12px;border-radius:15px;cursor:text;background:#fff;box-shadow:inset 0 0 0 1.5px var(--t-card-border),inset 2px 2px 0 rgba(0,0,0,.04)}
.dark .wf-fld{background:#160f22}
.wf-fld.on{box-shadow:inset 0 0 0 1.5px #c47d8e,2.5px 2.5px 0 #efc4cf}
.dark .wf-fld.on{box-shadow:inset 0 0 0 1.5px #c47d8e,2.5px 2.5px 0 #5e3242}
.wf-fld:focus-within{box-shadow:inset 0 0 0 2px #c47d8e,2.5px 2.5px 0 #efc4cf}
.dark .wf-fld:focus-within{box-shadow:inset 0 0 0 2px #c47d8e,2.5px 2.5px 0 #5e3242}
.wf-fld.bad,.dark .wf-fld.bad{box-shadow:inset 0 0 0 1.5px var(--act-amber),2.5px 2.5px 0 color-mix(in srgb,var(--act-amber) 30%,transparent)}
.wf-sym{font-size:26px;font-weight:700;color:var(--t-text-muted)}
.wf-fld input{flex:1;min-width:0;padding:0;border:0;outline:none;box-shadow:none;background:none;font-size:32px;font-weight:800;letter-spacing:-.015em;color:var(--t-text)}
.wf-fld input::placeholder{color:var(--t-text-muted);opacity:.4}
.wf-clr{width:30px;height:30px;flex-shrink:0;display:grid;place-items:center;border:0;border-radius:9px;cursor:pointer;color:var(--t-text-muted);background:rgba(0,0,0,.05)}
.dark .wf-clr{background:rgba(255,255,255,.08)}
.wf-clr:focus-visible,.wf-pk:focus-visible,.wf-cpb:focus-visible,.wf-lnk:focus-visible,.wf-pts:focus-visible{outline:2px solid var(--t-accent);outline-offset:2px}
.wf-lo{display:flex;align-items:center;gap:7px;padding-inline:2px;font-size:13px;font-weight:600;color:var(--act-amber)}
.wf-bl{display:flex;align-items:center;gap:8px 10px;flex-wrap:wrap;padding-block:9px;padding-inline:12px 10px;border-radius:13px;background:color-mix(in srgb,var(--t-green) 8%,transparent);box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--t-green) 22%,transparent)}
.wf-bl .tx{flex:1;min-width:11em;font-size:13px;line-height:1.4;font-weight:600;color:var(--t-green)}
.wf-bl.none{background:rgba(196,125,142,.08);box-shadow:inset 0 0 0 1px rgba(196,125,142,.28)}
.wf-bl.none .tx{color:var(--t-accent-ink)}
.wf-picks{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}
.wf-pk{height:46px;border:0;border-radius:12px;cursor:pointer;font-size:15px;font-weight:700;color:var(--t-text-soft);background:var(--t-card-bg);box-shadow:inset 0 0 0 1px var(--t-card-border),1.5px 1.5px 0 var(--t-card-border);transition:transform .14s}
.wf-pk:hover{transform:translateY(-1px)}
.wf-pk.on{color:var(--t-accent-ink);background:color-mix(in srgb,#c47d8e 10%,var(--t-card-bg));box-shadow:inset 0 0 0 1.5px #c47d8e,2px 2px 0 #efc4cf}
.dark .wf-pk.on{box-shadow:inset 0 0 0 1.5px #c47d8e,2px 2px 0 #5e3242}
.wf-cp{display:flex;align-items:center;gap:8px 10px;flex-wrap:wrap;margin:2px -14px -14px;padding:12px 14px;border-top:1px solid var(--t-card-border)}
.wf-cpb{display:inline-flex;align-items:center;gap:9px;padding:0;border:0;background:none;font:inherit;font-size:13px;font-weight:650;cursor:pointer;color:var(--t-accent-ink)}
.wf-cpin{flex:1;min-width:8em;height:38px;padding-inline:12px;border:0;border-radius:11px;outline:none;font-size:13.5px;font-weight:700;letter-spacing:.12em;color:var(--t-text);background:#fff;box-shadow:inset 0 0 0 1.5px #c47d8e}
.dark .wf-cpin{background:#160f22}
.wf-cpok{flex:1;min-width:0;display:flex;align-items:center;gap:9px;font-size:13px;color:var(--t-text-soft)}
.wf-cpok b{font-weight:800;letter-spacing:.08em;color:var(--t-green)}
.wf-cperr{flex-basis:100%;display:flex;align-items:center;gap:5px;font-size:12px;color:var(--t-red)}
.wf-m{border-radius:15px;background:var(--t-card-bg);box-shadow:inset 0 0 0 1px var(--t-card-border);transition:box-shadow .15s,background-color .15s}
.wf-m.on{background:color-mix(in srgb,#c47d8e 7%,var(--t-card-bg));box-shadow:inset 0 0 0 1.5px #c47d8e,2.5px 2.5px 0 #efc4cf}
.dark .wf-m.on{box-shadow:inset 0 0 0 1.5px #c47d8e,2.5px 2.5px 0 #5e3242}
.wf-mh{width:100%;display:flex;align-items:flex-start;gap:12px;padding:13px 14px;border:0;border-radius:15px;background:none;font:inherit;text-align:start;cursor:pointer;color:var(--t-text)}
.wf-mh:focus-visible{outline:2px solid var(--t-accent);outline-offset:2px}
.wf-mt{flex:1;min-width:0;display:flex;flex-direction:column;gap:3px}
.wf-mn{display:flex;align-items:center;gap:6px 7px;flex-wrap:wrap;font-size:14.5px;font-weight:700;line-height:1.25}
.wf-md{font-size:12.5px;line-height:1.45;color:var(--t-text-soft)}
.wf-mark{width:22px;height:22px;margin-top:8px;flex-shrink:0;display:grid;place-items:center;border-radius:50%;color:transparent;box-shadow:inset 0 0 0 1.5px var(--t-card-border)}
.wf-m.on .wf-mark{color:#fff;background:#96626f;box-shadow:1.5px 1.5px 0 #6b3a4a}
.wf-more{margin-inline:64px 14px;padding:9px 0 13px;border-top:1px dashed var(--t-card-border);font-size:12px;line-height:1.5;color:var(--t-text-soft)}
.wf-lnk{padding:0;border:0;background:none;font:inherit;font-weight:650;cursor:pointer;color:var(--t-accent-ink);text-decoration:underline;text-underline-offset:2px}
.wf-note{padding-inline:2px;font-size:11.5px;line-height:1.5;color:var(--t-text-muted)}
.wf-rc{padding:4px 16px 2px}
.wf-rr{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 0;border-top:1px solid var(--t-card-border);font-size:13px;color:var(--t-text-muted)}
.wf-rr:first-child{border-top:0}
.wf-rr b{font-size:13px;font-weight:700;color:var(--t-text)}
.wf-rr b.ok{color:var(--t-green)}
.wf-rt{display:flex;align-items:baseline;justify-content:space-between;gap:12px;padding:12px 0 13px;border-top:1.5px dashed var(--t-card-border)}
.wf-rt span{font-size:13.5px;font-weight:700;color:var(--t-text)}
.wf-rt b{font-size:22px;font-weight:800;letter-spacing:-.015em;color:var(--t-text)}
.wf-rt em{font-style:normal;font-size:13px;font-weight:600;color:var(--t-text-muted)}
.wf-warn{display:flex;align-items:center;gap:8px 10px;flex-wrap:wrap;padding-block:10px;padding-inline:12px 10px;border-radius:13px;font-size:13px;font-weight:600;color:var(--act-amber);background:color-mix(in srgb,var(--act-amber) 9%,transparent);box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--act-amber) 28%,transparent)}
.wf-warn span{flex:1;min-width:10em}
.wf-adding{display:flex;align-items:center;gap:12px;padding:14px 16px}
.wf-adding .v{flex:1;min-width:0}
.wf-adding b{display:block;margin-top:5px;font-size:24px;font-weight:800;line-height:1.05;letter-spacing:-.015em;color:var(--t-text)}
.wf-adding small{display:block;margin-top:4px;font-size:12px;font-weight:600;color:var(--t-green)}
.wf-sec{font-size:11.5px;line-height:1.45;text-align:center;color:var(--t-text-muted)}
.wf-sec svg{display:inline-block;vertical-align:-2px;margin-inline-end:5px}
@media (max-width:767px){
  .wf-pts{width:100%}
  .wf-pts .vw{margin-inline-start:auto}
  .wf-tks{gap:8px}
  .wf-tk{padding-inline:9px}
  .wf-tk hr{margin-inline:-9px}
  .wf-tk-a{font-size:14px}
  .wf-tk-f{font-size:11.5px}
  .wf-fld{height:60px;padding-inline:15px 10px}
  /* globals.css holds phone inputs at 16px !important so iOS never zooms;
     27px is above that line, so the amount can be money-sized again. */
  .wf-fld input{font-size:27px !important}
  .wf-sym{font-size:22px}
  .wf-pk{height:42px;font-size:14px}
  .wf-mh{padding:12px}
  .wf-more{margin-inline:62px 12px}
}
@media (prefers-reduced-motion:reduce){.wf-gold::before{animation:none}.wf-tkw,.wf-pk{transition:none}}
`;

/* ═══════════════════════════════════════════ */
/* ═══ ADD FUNDS PAGE                      ═══ */
/* ═══════════════════════════════════════════ */
export function visiblePendingDeposits(txs, now = Date.now()) {
  const staleExpiredCutoff = now - 4 * 60 * 60 * 1000;
  return (txs || []).filter(tx => tx.type === 'deposit' && (
    tx.status === 'Pending'
    || ((tx.method === 'flutterwave' || tx.method == null) && (
      tx.status === 'Processing'
      || (tx.status === 'Expired' && new Date(tx.date || tx.createdAt).getTime() > staleExpiredCutoff)
    ))
  ));
}

export function recoverableFlutterwaveDeposits(txs, excludedReference = null) {
  return (txs || []).filter(tx => (
    isFlutterwaveDeposit(tx)
    && ["Pending", "Expired", "Processing"].includes(tx.status)
    && tx.reference
    && tx.reference !== excludedReference
  ));
}

export default function AddFundsPage({ user, txs, transactionsTotal, walletSummary, dark, t, paymentStatus, setPaymentStatus, gatewayReturnReference, onPlaceOrder, onRefresh }) {
  const tr = useT();
  const money = useMoney();
  const nairaAside = useNairaAside();
  const loc = useLocale();
  const currency = loc?.currency ?? "NGN";
  const toast = useToast();
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("");
  const [pointsOpen, setPointsOpen] = useState(false);
  const [rewards, setRewards] = useState(null);
  useEffect(() => {
    fetch('/api/rewards').then(r => r.ok ? r.json() : null).then(d => { if (d) setRewards(d); });
  }, []);
  const [loading, setLoading] = useState(false);
  const [mobileStep, setMobileStep] = useState(1);
  const [gateways, setGateways] = useState([]);
  const [gatewaysLoading, setGatewaysLoading] = useState(true);
  // How many methods the API left out because they only work from Nigeria.
  // Comes from the API rather than being inferred here, so the note beneath
  // the list and the list itself are the same decision.
  const [hiddenNigeriaOnly, setHiddenNigeriaOnly] = useState(0);
  const [confirmModal, setConfirmModal] = useState(null);
  const [senderName, setSenderName] = useState("");
  const [confirmLoading, setConfirmLoading] = useState(false);

  const bonusInit = useRef(false);
  useEffect(() => {
    if (user?.welcomeBonusEligible && !bonusInit.current) { bonusInit.current = true; setAmount('5000'); }
  }, [user?.welcomeBonusEligible]);

  const toastShown = useRef(false);
  useEffect(() => {
    if (isCreditedPaymentResult(paymentStatus) && !toastShown.current) {
      toastShown.current = true;
      const amt = paymentStatus.amount ? `${money(Number(paymentStatus.amount), { round: "down" })} credited` : "Your wallet has been credited";
      toast.success(tr("Payment successful!"), amt);
      if (paymentStatus.welcomeBonus > 0) {
        setTimeout(() => toast.success(tr("🎁 Welcome bonus!"), `${money(Number(paymentStatus.welcomeBonus), { round: "down" })} ${tr("bonus added to your wallet")}`), 1500);
      }
      if (paymentStatus.topupBonus > 0) {
        setTimeout(() => toast.success(tr("🎉 Top-up bonus unlocked!"), `${money(Number(paymentStatus.topupBonus), { round: "down" })} ${tr("added to your wallet")}`), 1500);
      }
      // A completed credit only needs to survive long enough to show once.
      // Consuming it prevents success from replaying when this page remounts.
      setPaymentStatus?.(null);
    }
    if (!paymentStatus) toastShown.current = false;
  }, [paymentStatus]);

  /* Crypto payment modal */
  const [cryptoModal, setCryptoModal] = useState(null);
  const [cryptoStatus, setCryptoStatus] = useState(null);
  const [cryptoResult, setCryptoResult] = useState(null);
  const [cryptoPolling, setCryptoPolling] = useState(false);
  const cryptoAttemptCache = useRef(new Map());
  const cryptoPollInterval = useRef(null);
  const cryptoPollTimeout = useRef(null);
  const stopCryptoPolling = useCallback(() => {
    if (cryptoPollInterval.current) clearInterval(cryptoPollInterval.current);
    if (cryptoPollTimeout.current) clearTimeout(cryptoPollTimeout.current);
    cryptoPollInterval.current = null;
    cryptoPollTimeout.current = null;
    setCryptoPolling(false);
  }, []);
  useEffect(() => () => stopCryptoPolling(), [stopCryptoPolling]);

  const applyCryptoStatusResult = useCallback((result, fallback = {}) => {
    if (!result || typeof result !== "object") return false;
    const normalizedResult = {
      ...result,
      reference: result.reference || fallback.reference,
    };
    setCryptoResult(normalizedResult);
    setCryptoStatus(normalizedResult.status || "Pending");

    if (!isTerminalCryptoPaymentResult(normalizedResult)) return false;

    stopCryptoPolling();
    const creditedStatus = creditedCryptoPaymentStatus(normalizedResult, {
      amount: fallback.amount,
      reference: fallback.reference,
    });
    if (creditedStatus) setPaymentStatus?.(creditedStatus);
    onRefresh?.();
    return true;
  }, [onRefresh, setPaymentStatus, stopCryptoPolling]);

  /* Manual bank transfer modal */
  const [manualModal, setManualModal] = useState(null);
  useBodyScrollLock(!!cryptoModal || !!manualModal || !!confirmModal);
  const [manualRef, setManualRef] = useState("");
  const [manualSubmitting, setManualSubmitting] = useState(false);
  const [manualDone, setManualDone] = useState(false);
  const [manualStep, setManualStep] = useState("details"); // "details" | "confirm"

  // Fetch enabled gateways from API
  useEffect(() => {
    fetch("/api/payments/gateways").then(r => r.json()).then(d => {
      const gws = d.gateways || [];
      setGateways(gws);
      setHiddenNigeriaOnly(Number(d.hiddenNigeriaOnly) || 0);
      if (gws.length > 0 && !method) setMethod(gws[0].id);
      setGatewaysLoading(false);
    }).catch(() => setGatewaysLoading(false));
  }, []);

  // Auto-recover pending gateway deposits (covers closed-before-redirect and webhook failure)
  const recoveryRan = useRef(false);
  useEffect(() => {
    if (recoveryRan.current || !txs?.length) return;
    const pending = recoverableFlutterwaveDeposits(txs, gatewayReturnReference);
    if (pending.length === 0) return;
    recoveryRan.current = true;
    (async () => {
      let shouldRefresh = false;
      for (const tx of pending) {
        try {
          const res = await fetch("/api/payments/verify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ reference: tx.reference }),
          });
          const data = await res.json();
          if (isCreditedPaymentResult(data)) {
            toast.success(tr("Payment recovered!"), `${money(Number(data.amount), { round: "down" })} ${tr("has been credited to your wallet")}`);
            onRefresh?.();
            return;
          }
          if (data.paymentState) shouldRefresh = true;
        } catch {}
      }
      if (shouldRefresh) onRefresh?.();
    })();
  }, [txs, gatewayReturnReference]);

  const numAmount = Number(amount) || 0;

  // The box speaks whatever currency the site is set to, but `amount` under it
  // is always naira: the bonus tiers, the minimum and the wallet credit are
  // naira. Flutterwave then charges in the currency on screen (the server
  // sends the naira and the currency; the foreign figure is its to derive),
  // so what is printed underneath is what the checkout asks for. Needs a live
  // rate — without one it stays naira rather than offering a box that cannot
  // convert what is typed into it.
  const fxReady = currency !== "NGN" && loc?.toNaira?.(1) !== null && loc?.toNaira?.(1) !== undefined;
  // What Flutterwave will actually ask for. It collects in cedis and shillings,
  // so those are quoted in the currency on screen with the same helper the
  // server uses — to the cent, so the page and the checkout cannot disagree by
  // a rounding step. It does not collect in dollars or pounds: those readers
  // are charged the naira, and their card converts it back.
  const chargeCode = canChargeIn(currency) ? currency : "NGN";
  const quoted = fxReady && numAmount > 0 && chargeCode !== "NGN"
    ? foreignChargeAmount(Math.round(numAmount * 100), chargeCode, loc.fx)
    : null;
  const [typed, setTyped] = useState("");
  const boxSymbol = fxReady ? (loc?.meta?.symbol ?? "₦") : "₦";
  const boxValue = fxReady ? typed : amount;
  const setBox = (raw) => {
    if (!fxReady) { setAmount(raw); return; }
    setTyped(raw);
    const naira = raw === "" ? null : loc.toNaira(raw);
    setAmount(naira === null ? "" : String(naira));
  };
  // Quick-picks are already in the currency on screen, so tapping one fills the
  // box with it as typed and the naira charge is derived, exactly as if the
  // customer had keyed it themselves. In naira the two are the same figure.
  const presets = depositPresets(fxReady ? currency : "NGN");
  const setPreset = (value) => {
    if (!fxReady) { setAmount(String(value)); return; }
    setTyped(String(value));
    const naira = loc.toNaira(value);
    setAmount(naira === null ? "" : String(naira));
  };
  // A naira figure from a bonus ticket, a nudge or the crypto floor. The box
  // follows it in the currency on screen, rounded up so the naira it converts
  // back to never lands under the tier the button promised.
  const setNaira = (naira) => {
    setAmount(String(naira));
    if (fxReady) { const d = loc.toDisplay?.(naira); setTyped(d ? String(Math.ceil(d * 100) / 100) : ""); }
  };
  // The box shows thousands separators as you type. Naira is whole; another
  // currency may carry two decimals. The caret stays after the same digit.
  const boxShown = (() => {
    if (!boxValue) return "";
    const [int, dec] = String(boxValue).split(".");
    return Number(int || 0).toLocaleString("en-NG") + (dec !== undefined ? `.${dec}` : "");
  })();
  const onBoxInput = (e) => {
    const el = e.target;
    const before = el.value.slice(0, el.selectionStart ?? el.value.length).replace(/[^\d.]/g, "").length;
    let raw = el.value.replace(/[^\d.]/g, "");
    const dot = raw.indexOf(".");
    if (dot >= 0) raw = fxReady ? raw.slice(0, dot + 1) + raw.slice(dot + 1).replace(/\./g, "").slice(0, 2) : raw.slice(0, dot);
    raw = raw.replace(/^0+(?=\d)/, "").slice(0, 12);
    setBox(raw);
    requestAnimationFrame(() => {
      let seen = 0, i = 0;
      while (i < el.value.length && seen < before) { if (/[\d.]/.test(el.value[i])) seen++; i++; }
      el.setSelectionRange?.(i, i);
    });
  };
  const valid = numAmount >= 1000;
  const balance = user?.balance || 0;

  const lastFunded = txs?.find(tx => tx.type === 'deposit' && tx.status === 'Completed');
  const pendingDeposits = visiblePendingDeposits(txs);
  const pendingTotal = pendingDeposits.reduce((s, tx) => s + (tx.amount || 0), 0);
  const hasNonManualProgress = pendingDeposits.some(tx => tx.method !== 'manual');
  const pendingSummaryText = hasNonManualProgress
    ? `${pendingDeposits.length} deposit${pendingDeposits.length === 1 ? '' : 's'}${pendingTotal > 0 ? ` · ${money(pendingTotal, { round: "down" })}` : ''} in progress`
    : `${pendingDeposits.length} pending deposit${pendingDeposits.length === 1 ? '' : 's'}${pendingTotal > 0 ? ` · ${money(pendingTotal, { round: "down" })}` : ''} awaiting confirmation`;

  // Coupon state
  const [showCoupon, setShowCoupon] = useState(false);
  const [couponCode, setCouponCode] = useState("");
  const [couponApplied, setCouponApplied] = useState(null);
  const [couponLoading, setCouponLoading] = useState(false);
  const [couponError, setCouponError] = useState("");

  const applyCoupon = async () => {
    if (!couponCode.trim()) return;
    setCouponLoading(true); setCouponError("");
    try {
      const r = await fetch("/api/coupons", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code: couponCode, amount: numAmount * 100 }) });
      const d = await r.json();
      if (r.ok && d.valid) { setCouponApplied(d); setCouponError(""); }
      else { setCouponError(d.error || "Invalid code"); setCouponApplied(null); }
    } catch { setCouponError("Failed to validate"); }
    setCouponLoading(false);
  };

  const removeCoupon = () => { setCouponApplied(null); setCouponCode(""); setCouponError(""); };

  const discount = couponApplied ? (couponApplied.type === "percent" ? Math.round(numAmount * 100 * (couponApplied.value / 100)) : couponApplied.value * 100) : 0;

  const payingRef = useRef(false);
  const handlePay = async () => {
    if (!valid || loading || payingRef.current) return;
    payingRef.current = true;
    setLoading(true);

    // ═══ CRYPTO — different flow ═══
    if (method === "crypto") {
      const couponId = couponApplied?.couponId || undefined;
      const attempt = getCryptoPaymentAttempt(
        cryptoAttemptCache.current,
        numAmount,
        couponId,
        () => crypto.randomUUID(),
      );
      try {
        const res = await fetch("/api/payments/crypto", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ amount: numAmount, couponId, idempotencyKey: attempt.idempotencyKey }),
          signal: AbortSignal.timeout(30000),
        });
        const data = await res.json();
        const fallback = {
          amount: data.amount ?? data.amountNgn ?? numAmount,
          reference: data.reference,
        };

        if (res.ok && data.gatewayUrl) {
          releaseCryptoPaymentAttempt(cryptoAttemptCache.current, attempt.fingerprint);
          stopCryptoPolling();
          setCryptoModal(data);
          const initialResult = {
            ...data,
            status: data.status || "Pending",
            paymentState: data.paymentState || "provider_pending",
          };
          const alreadyTerminal = applyCryptoStatusResult(initialResult, fallback);

          if (!alreadyTerminal) {
            setCryptoPolling(true);
            const poll = async () => {
              try {
                const sr = await fetch(
                  `/api/payments/crypto?reference=${encodeURIComponent(data.reference)}`,
                  { signal: AbortSignal.timeout(10000) },
                );
                const sd = await sr.json();
                const pollResult = {
                  ...sd,
                  status: sd.status || (sd.providerStatus === "check" ? "Confirming" : "Pending"),
                };
                if (!sr.ok && !isTerminalCryptoPaymentResult(pollResult)) return;
                applyCryptoStatusResult(pollResult, fallback);
              } catch {}
            };
            cryptoPollInterval.current = setInterval(poll, 15000);
            cryptoPollTimeout.current = setTimeout(stopCryptoPolling, 30 * 60 * 1000);
          }
        } else if (isTerminalCryptoPaymentResult(data) && data.reference) {
          releaseCryptoPaymentAttempt(cryptoAttemptCache.current, attempt.fingerprint);
          stopCryptoPolling();
          setCryptoModal({
            ...data,
            amountNgn: data.amount ?? numAmount,
          });
          applyCryptoStatusResult(data, fallback);
        } else {
          // A client error is definitive. Transport/server failures keep the
          // key so a retry safely refers to the same creation attempt.
          if (isDefinitiveCryptoCreationRejection(res.status)) {
            releaseCryptoPaymentAttempt(cryptoAttemptCache.current, attempt.fingerprint);
          }
          // The condition tested error-or-message but only ever rendered
          // message, so a response carrying only `error` (every 400 this route
          // returns, including the deposit minimum) surfaced as an empty
          // description. The reason was always there; the toast discarded it.
          // The server's message is the useful half, so it leads. "Payment
          // failed" as a heading told somebody whose amount was simply too low
          // that something had broken, which is both alarming and wrong.
          const failureReason = data.error || data.message;
          if (failureReason) toast.error(tr("Could not start payment"), tr(failureReason));
          else toast.error(tr("Could not start payment"), tr("Failed to create crypto payment"));
        }
      } catch (err) {
        toast.error(
          err?.name === "TimeoutError" ? tr("Timed out") : tr("Network error"),
          tr("Try again. We’ll safely reuse this payment attempt."),
        );
      }
      setLoading(false); payingRef.current = false;
      return;
    }

    // ═══ MANUAL BANK TRANSFER ═══
    if (method === "manual") {
      try {
        const res = await fetch("/api/payments/manual", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ amount: numAmount, couponId: couponApplied?.couponId || undefined }),
        });
        const data = await res.json();
        if (data.bankName) {
          setManualModal(data);
          setManualRef("");
          if (data.resumed && data.confirmed) {
            setManualDone(true);
          } else {
            setManualDone(false);
            setManualStep("details");
          }
        } else {
          if (res.status === 400) toast.warning(tr("Pending transfer"), data.error);
          else toast.error(tr("Transfer failed"), data.error ? tr(data.error) : tr("Failed to create request"));
        }
      } catch { toast.error(tr("Network error"), tr("Check your connection")); }
      setLoading(false); payingRef.current = false;
      return;
    }

    // ═══ CARD/TRANSFER — redirect flow ═══
    try {
      const res = await fetch("/api/payments/initialize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: numAmount, currency, method, couponId: couponApplied?.couponId || undefined, idempotencyKey: crypto.randomUUID() }),
        signal: AbortSignal.timeout(30000),
      });
      const data = await res.json();
      if (data.authorization_url) {
        // Mark the handoff before leaving. 60% of initiations end funded, and
        // the rows say only "initiated" and "finished" — so somebody who closed
        // the tab before the gateway loaded looks exactly like somebody who saw
        // it and walked away. Those are different problems: the first is a slow
        // handoff and ours, the second is a pricing or trust question.
        //
        // sendBeacon rather than fetch, because the navigation on the next line
        // cancels an in-flight request. The browser owns this one and delivers
        // it after the page is gone. Nothing is awaited and nothing is checked:
        // a failed beacon must never keep somebody from paying.
        if (data.reference) {
          try {
            const blob = new Blob([JSON.stringify({ reference: data.reference })], { type: "application/json" });
            if (!navigator.sendBeacon?.("/api/telemetry/checkout", blob)) {
              fetch("/api/telemetry/checkout", { method: "POST", body: blob, keepalive: true }).catch(() => {});
            }
          } catch {}
        }
        window.location.href = data.authorization_url;
      } else {
        toast.error(tr("Payment failed"), data.error ? tr(data.error) : tr("Initialization failed"));
        setLoading(false); payingRef.current = false;
      }
    } catch (err) {
      toast.error(err?.name === "TimeoutError" ? tr("Timed out") : tr("Network error"), tr("Check your connection"));
      setLoading(false); payingRef.current = false;
    }
  };

  // Which bonus ladder applies is decided by the rail the money arrives on, not
  // by the currency on screen — crypto is dollar-denominated, so a first
  // deposit there is scored on the dollar ladder (lib/welcome-bonus.js). The
  // figures are still shown in whatever currency the customer is reading, so a
  // Nigerian paying crypto sees the dollar ladder rendered in naira. Bonuses
  // round down, so the card never promises more than the rail will pay.
  const welcomeEligible = user?.welcomeBonusEligible;
  const topup = !welcomeEligible ? user?.topupBonus : null;
  const cryptoPresentation = cryptoPaymentPresentation(cryptoResult || { status: cryptoStatus });
  const cryptoIsTerminal = cryptoPresentation.kind !== "pending";

  /* ── Shared sub-components ── */
  const okColor = dark ? "#6ee7b7" : "#059669";
  const amountInput = (
    <>
      {topup && (() => {
        const fillPct = Math.min(100, (topup.total / topup.max) * 100);
        const fmtK = kobo => money(kobo / 100);
        const fN2 = kobo => money(kobo / 100, { round: "down" });
        const allDone = !topup.next;
        return (
          <div className="rounded-xl p-4" style={{ background: dark ? 'rgba(196,125,142,.08)' : 'rgba(196,125,142,.05)', border: `1px solid ${dark ? 'rgba(196,125,142,.22)' : 'rgba(196,125,142,.18)'}` }}>
            <div className="flex items-center gap-2.5">
              <Tile size={32}><OffsetIcon name="topup" size={17} /></Tile>
              <div className="text-[13px] font-semibold text-accent-ink">{tr("Top-up bonus")}</div>
              <span className="ml-auto text-[10px] font-bold uppercase tracking-[.06em] py-[3px] px-2 rounded-full text-t-text-muted" style={{ background: dark ? 'rgba(255,255,255,.06)' : '#fff', border: `1px solid ${t.cardBorder}` }}>{topup.month}</span>
            </div>
            <div className="flex items-baseline gap-2 mt-3 flex-wrap">
              <b className="m text-[24px] font-bold text-t-text">{fN2(topup.total)}</b>
              <span className="text-[12.5px] text-t-text-muted">{tr("topped up this month")}</span>
            </div>
            <div className="relative mt-2.5 pb-10">
              <div className="relative h-[9px] rounded-[5px]" style={{ background: dark ? 'rgba(255,255,255,.08)' : 'rgba(0,0,0,.07)' }}>
                <span className="absolute top-0 bottom-0 left-0 rounded-[5px]" style={{ width: `${fillPct}%`, background: allDone ? okColor : t.accent }} />
                {topup.rungs.slice(0, -1).map(r => (
                  <span key={r.min} className="absolute -top-1 -bottom-1 w-[2px] rounded-[1px] opacity-50" style={{ left: `${(r.min / topup.max) * 100}%`, background: dark ? 'rgba(255,255,255,.5)' : 'rgba(0,0,0,.35)' }} />
                ))}
              </div>
              {topup.rungs.map((r, i) => {
                const last = i === topup.rungs.length - 1;
                return (
                  <div key={r.min} className={`absolute top-[18px] leading-[1.3] ${last ? 'right-0 text-right' : 'text-center -translate-x-1/2'}`} style={last ? undefined : { left: `${(r.min / topup.max) * 100}%` }}>
                    <b className="block text-[12.5px] font-bold" style={{ color: r.unlocked ? okColor : t.text }}>{fN2(r.prize)}{r.unlocked ? " ✓" : ""}</b>
                    <span className="block text-[10.5px] font-semibold text-t-text-muted mt-px">{fmtK(r.min)}</span>
                  </div>
                );
              })}
            </div>
            <div className="text-[13px] leading-[1.5] text-t-text-soft">
              {allDone
                ? <>{tr("All unlocked this month:")} <b style={{ color: okColor }}>{fN2(topup.unlockedAmount)}</b> {tr("earned. Fresh ladder on the 1st.")}</>
                : <>{topup.unlockedAmount > 0 && <><b style={{ color: okColor }}>{fN2(topup.unlockedAmount)} unlocked</b> · </>}<b className="m text-t-text">{fN2(topup.next.toGo)}</b> {tr("more unlocks")} <b className="text-accent-ink">{fN2(topup.next.prize)}</b>.</>}
            </div>
          </div>
        );
      })()}
      {/* First deposit: one gold card holds the bonus ladder as three tickets.
          Tapping one fills the box; the line under the box says what this
          top-up earns and what the next ticket up would. */}
      {welcomeEligible && (
        <div className="wf-gold">
          <div className="wf-gold-top"><span className="wf-gold-g"><OffsetIcon name="gift" size={16} /></span><span className="wf-gold-eb">{tr("First deposit bonus")}</span></div>
          <div className="serif wf-gold-h">{tr("Your first deposit earns up to")} {money(MAX_BONUS_NAIRA, { round: "down" })} {tr("free.")}</div>
          <div className="wf-tks">
            {BONUS_PRESETS.map(p => {
              const sel = numAmount === p.amount;
              return (
                <button key={p.amount} type="button" onClick={() => setNaira(p.amount)} aria-pressed={sel} className={`wf-tkw${sel ? " on" : ""}`}>
                  {p.tag && <span className="wf-stamp">{tr(p.tag)}</span>}
                  <span className="wf-tk"><span className="m wf-tk-a">{money(p.amount)}</span><hr /><span className="wf-tk-f">+{money(p.bonus, { round: "down" })} {tr("free")}</span></span>
                </button>
              );
            })}
          </div>
        </div>
      )}
      <div className="wf-lbl"><span>{tr("Amount")}</span><small>{tr("From")} {money(1000)}</small></div>
      <label className={`wf-fld${numAmount > 0 && !valid ? " bad" : boxValue ? " on" : ""}`}>
        <span className="m wf-sym">{boxSymbol}</span>
        <input type="text" inputMode={fxReady ? "decimal" : "numeric"} autoComplete="off" value={boxShown} onChange={onBoxInput} placeholder="0" aria-label={tr("Amount")} className="m" />
        {boxValue && <button type="button" className="wf-clr" onClick={() => setBox("")} aria-label={tr("Clear the amount")}><OffsetIcon name="close" size={12} /></button>}
      </label>
      {/* Exactly what Flutterwave will ask for — the figure the bank statement
          will show, in the currency it will show it in. */}
      {fxReady && numAmount > 0 && (
        <div className="wf-note -mt-1.5">{tr("You will be charged")} {quoted ? loc.fmtNative(quoted) : formatMoney(numAmount, "NGN")}</div>
      )}
      {numAmount > 0 && !valid && (
        <div className="wf-lo"><OffsetIcon name="alert" size={14} />{tr("Minimum deposit is")} {money(1000)}</div>
      )}
      {!welcomeEligible && (
        <div className="wf-picks">
          {presets.map(p => (
            <button key={p} type="button" onClick={() => setPreset(p)} aria-pressed={numAmount === p} className={`m wf-pk${numAmount === p ? " on" : ""}`}>
              {fxReady ? loc.fmtNative(p) : `₦${p >= 1000 ? `${p / 1000}K` : p}`}
            </button>
          ))}
        </div>
      )}
      {welcomeEligible && valid && (() => {
        const wb = bonusForNaira(numAmount);
        const nt = nextBonusTier(numAmount);
        if (wb === 0) return (
          <div className="wf-bl none">
            <span className="tx">{tr("Top up")} {money(nt.min)} {tr("and get")} {money(nt.bonus, { round: "down" })} {tr("free.")}</span>
            <button type="button" className="nb sec sm" onClick={() => setNaira(nt.min)}><OffsetIcon name="plusCircle" size={13} />{tr("Make it")} {money(nt.min)}</button>
          </div>
        );
        return (
          <div className="wf-bl">
            <span className="tx"><b className="m">+{money(wb, { round: "down" })}</b> {tr("free on this top-up.")}</span>
            {nt && <button type="button" className="nb sec sm" onClick={() => setNaira(nt.min)}><OffsetIcon name="plusCircle" size={13} />{tr("Add")} {money(nt.min - numAmount)} {tr("and get")} {money(nt.bonus, { round: "down" })}</button>}
          </div>
        );
      })()}
      {topup && topup.next && numAmount >= 1000 && (() => {
        const projected = topup.total + numAmount * 100;
        const prize = money(topup.next.prize / 100, { round: "down" });
        if (projected >= topup.next.min) {
          return (
            <div className="flex items-center gap-2 py-2 px-3 rounded-lg" style={{ background: dark ? 'rgba(110,231,183,.06)' : 'rgba(5,150,105,.04)', border: `1px solid ${dark ? 'rgba(110,231,183,.14)' : 'rgba(5,150,105,.1)'}` }}>
              <Tile size={22} clr={okColor}><OffsetIcon name="checkCircle" size={13} /></Tile>
              <span className="text-[13px] font-semibold" style={{ color: okColor }}>{tr("This deposit unlocks your")} {prize} {tr("top-up bonus")}</span>
            </div>
          );
        }
        const fullAdd = Math.ceil((topup.next.min - topup.total) / 100);
        return (
          <div className="flex items-center gap-2 py-2 px-3 rounded-lg" style={{ background: dark ? 'rgba(196,125,142,.06)' : 'rgba(196,125,142,.04)', border: `1px solid ${dark ? 'rgba(196,125,142,.14)' : 'rgba(196,125,142,.1)'}` }}>
            <Tile size={22}><OffsetIcon name="topup" size={13} /></Tile>
            <span className="text-[13px] font-medium text-t-text-soft">
              This takes you to <strong className="m">{money(projected / 100)}</strong> of {money(topup.next.min / 100)}: <button onClick={() => setAmount(String(fullAdd))} className="font-bold border-none bg-transparent p-0 cursor-pointer text-accent-ink font-[inherit] text-[inherit] pb-px" style={{ borderBottom: `1.5px dashed ${t.accent}` }}>deposit {money(fullAdd)}</button> {tr("to unlock")} <strong className="text-accent-ink">₦{prize}</strong>.
            </span>
          </div>
        );
      })()}
    </>
  );

  // The foot of the amount card: a link, then the code slot, then the stub.
  const couponSection = (
    <div className="wf-cp">
      {couponApplied ? (
        <>
          <span className="wf-cpok"><Tile size={26} clr={okColor}><OffsetIcon name="checkCircle" size={13} /></Tile><span><b className="m">{couponApplied.code}</b>, {couponApplied.type === "percent" ? `${couponApplied.value}%` : `+${money(couponApplied.value, { round: "down" })}`} {tr("bonus")}</span></span>
          <button type="button" onClick={removeCoupon} className="nb ghost sm">{tr("Remove")}</button>
        </>
      ) : showCoupon ? (
        <>
          <input value={couponCode} onChange={e => setCouponCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))} placeholder="e.g. NITRO20" aria-label={tr("Coupon Code")} autoFocus className="m wf-cpin" />
          <button type="button" onClick={applyCoupon} disabled={couponLoading || !couponCode.trim()} className="nb pri">{couponLoading ? <NitroLoader size={14} mono ariaHidden /> : tr("Apply")}</button>
          <button type="button" onClick={() => { setShowCoupon(false); setCouponError(""); }} className="nb ghost">{tr("Cancel")}</button>
          {couponError && <div className="wf-cperr"><OffsetIcon name="alert" size={12} />{couponError}</div>}
        </>
      ) : (
        <button type="button" onClick={() => setShowCoupon(true)} className="wf-cpb"><Tile size={26}><OffsetIcon name="percent" size={13} /></Tile>{tr("Have a coupon code?")}</button>
      )}
    </div>
  );

  // Gold while it can be pressed; flat and muted while it cannot.
  const PayButton = ({ onClick, disabled, off, text, loading: busy, className: cls }) => (
    <button type="button" onClick={onClick} disabled={disabled} className={`${off ? "" : "nitro-money-btn"} w-full py-4 max-desktop:py-3.5 max-md:py-[13px] rounded-full text-base font-semibold border-none cursor-pointer flex items-center justify-center gap-2 ${cls || ""}`} style={off ? { background: dark ? "rgba(255,255,255,.12)" : "rgba(0,0,0,.08)", color: t.textMuted, cursor: "not-allowed" } : undefined}>
      {busy && <NitroLoader size={16} mono ariaHidden />}
      {text}
    </button>
  );

  const paymentNotice = paymentStatus && typeof paymentStatus === "object" && paymentStatus.type !== "success"
    ? paymentStatus
    : null;
  const paymentNoticeTone = paymentNotice?.type === "info" ? {
    title: tr("Verifying payment"),
    color: dark ? "#a5b4fc" : "#4f46e5",
    background: dark ? "linear-gradient(135deg, rgba(99,102,241,.12), rgba(99,102,241,.04))" : "linear-gradient(135deg, rgba(79,70,229,.08), rgba(79,70,229,.02))",
    border: dark ? "rgba(165,180,252,.2)" : "rgba(79,70,229,.16)",
    icon: "clockPlain",
  } : paymentNotice?.type === "warning" ? {
    title: paymentNotice.paymentState === PAYMENT_STATES.PROVIDER_PENDING ? "Payment pending" : "Verification delayed",
    color: dark ? "#fcd34d" : "#d97706",
    background: dark ? "linear-gradient(135deg, rgba(245,158,11,.12), rgba(245,158,11,.04))" : "linear-gradient(135deg, rgba(217,119,6,.08), rgba(217,119,6,.02))",
    border: dark ? "rgba(252,211,77,.2)" : "rgba(217,119,6,.16)",
    icon: "alert",
  } : {
    title: tr("Payment unsuccessful"),
    color: dark ? "#fca5a5" : "#dc2626",
    background: dark ? "linear-gradient(135deg, rgba(239,68,68,.10), rgba(239,68,68,.04))" : "linear-gradient(135deg, rgba(220,38,38,.07), rgba(220,38,38,.02))",
    border: dark ? "rgba(252,165,165,.18)" : "rgba(220,38,38,.15)",
    icon: "xCircle",
  };

  return (
    <>
      <PointsModal open={pointsOpen} onClose={() => setPointsOpen(false)} rewards={rewards} dark={dark} t={t} onUse={() => { setPointsOpen(false); onPlaceOrder?.(); }} />

      {/* Payment state notice — toast handles completed credits */}
      {paymentNotice && (
        <div className="flex items-center gap-2.5 py-2.5 px-3.5 rounded-xl mb-4" style={{
          background: paymentNoticeTone.background,
          border: `1px solid ${paymentNoticeTone.border}`,
        }}>
          <Tile size={28} clr={paymentNoticeTone.color}><OffsetIcon name={paymentNoticeTone.icon} size={15} /></Tile>
          <div className="flex-1 min-w-0">
            <div className="text-[11px] font-semibold" style={{ color: paymentNoticeTone.color }}>{paymentNoticeTone.title}: <span className="font-normal opacity-75">{paymentNotice.message}</span></div>
          </div>
          <button onClick={() => setPaymentStatus(null)} className="bg-transparent border-none cursor-pointer p-1 rounded-md shrink-0" style={{ color: paymentNoticeTone.color, opacity: .45 }}>
            <OffsetIcon name="close" size={12} />
          </button>
        </div>
      )}

      <div className="pb-3.5 max-md:pb-2">
        <div className="serif text-[32px] max-md:text-[26px] font-semibold leading-none tracking-[-.015em] text-t-text">{tr("Wallet")}</div>
        <div className="text-[13px] mt-1.5 text-t-text-muted">{tr("Top up your balance to place orders")}</div>
        <div className="page-divider bg-t-card-border" />
      </div>

      <style>{WF_CSS}</style>
      {/* ── Balance, with the points beside it ── */}
      <div className="wf-card wf-bal">
        <div className="wf-bal-v">
          <div className="wf-eb"><OffsetIcon name="wallet" size={13} />{tr("Balance")}</div>
        {/* The balance follows the currency on screen, like every other figure.
            It was formatted with fHeld, which is naira and only naira, so the
            one number the page exists for stayed in naira when nothing else did.

            And it says the naira underneath when the headline is converted.
            Every price on this page may honestly be an approximation; a wallet
            balance is not an estimate of anything, it is a stored naira figure,
            and the page you top up from is the worst place to be unable to
            check what you actually hold. */}
          <div className="m wf-bal-n">{money(balance, { round: "down" })}</div>
          {nairaAside(balance, { round: "down" }) && (
            <div className="m text-[12px] mt-1 text-t-text-muted">{nairaAside(balance, { round: "down" })}</div>
          )}
          {lastFunded && <div className="text-[11px] mt-1.5 text-t-text-muted">{tr("Last funded")} {fD(lastFunded.date, true)}</div>}
        </div>
        {rewards?.points && (() => { const p = rewards.points; return (
          <button type="button" onClick={() => setPointsOpen(true)} className="wf-pts">
            <Tile size={26} clr={dark ? "#e0a458" : "#d97706"}><OffsetIcon name="star" size={14} /></Tile>
            <span className="tx"><b><span className="m">{(p.balance || 0).toLocaleString()}</span> {tr("Nitro Points")}</b><small>{p.redeemable ? `≈ ${money(p.valueNaira || 0, { round: "down" })} ready to spend on your next order` : `${(p.neededToRedeem || 0).toLocaleString()} more to spend`}</small></span>
            <span className="vw">{tr("View")}</span>
          </button>
        ); })()}
        {(user?.bonusCredit?.amount > 0 || pendingDeposits.length > 0) && (
          <div className="wf-bal-x">
            {user?.bonusCredit?.amount > 0 && (() => {
              // No expiry is the welcome bonus, which never runs out. The line
              // states the figure and stops rather than inventing a deadline.
              const daysLeft = user.bonusCredit.expiresAt
                ? Math.max(1, Math.ceil((new Date(user.bonusCredit.expiresAt) - Date.now()) / 86400000))
                : null;
              return (
                <div className="flex items-center gap-1.5 mt-2 py-2 px-2.5 rounded-lg text-[11px]" style={{ background: dark ? "rgba(240,171,252,.06)" : "rgba(168,85,247,.04)", border: `1px solid ${dark ? "rgba(240,171,252,.14)" : "rgba(168,85,247,.1)"}`, color: dark ? "#f0abfc" : "#a855f7" }}>
                  <OffsetIcon name="gift" size={12} />
                  <span>{money(user.bonusCredit.amount / 100, { round: "down" })} {daysLeft ? <>{tr("bonus credit, expires in")} {daysLeft}d</> : tr("bonus credit")}</span>
                </div>
              );
            })()}
            {pendingDeposits.length > 0 && (() => {
              const awaitingTx = pendingDeposits.find(tx => tx.awaitingConfirmation);
              return (
                <div className="flex items-center gap-1.5 mt-2 py-2.5 px-2.5 rounded-lg text-[11px]" style={{ background: dark ? "rgba(252,211,77,.06)" : "rgba(217,119,6,.04)", border: `1px solid ${dark ? "rgba(252,211,77,.14)" : "rgba(217,119,6,.1)"}`, color: dark ? "#fcd34d" : "#d97706" }}>
                  <div className="w-1.5 h-1.5 rounded-full animate-pulse shrink-0" style={{ background: dark ? "#fcd34d" : "#d97706" }} />
                  <span className="flex-1">{pendingSummaryText}</span>
                  {awaitingTx && <>
                    <button onClick={async () => { try { await fetch("/api/payments/manual", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reference: awaitingTx.reference }) }); } catch {} onRefresh?.(); }} className="py-0.5 px-2 rounded-md text-[11px] font-semibold cursor-pointer shrink-0 border-none transition-transform duration-200 hover:-translate-y-px" style={{ background: dark ? "rgba(252,165,165,.12)" : "rgba(220,38,38,.08)", color: dark ? "#fca5a5" : "#dc2626" }}>{tr("Cancel")}</button>
                    <button onClick={() => { setConfirmModal(awaitingTx); setSenderName(""); }} className="py-0.5 px-2 rounded-md text-[11px] font-semibold cursor-pointer shrink-0 border-none transition-transform duration-200 hover:-translate-y-px" style={{ background: dark ? "rgba(252,211,77,.15)" : "rgba(217,119,6,.12)", color: dark ? "#fcd34d" : "#d97706" }}>{tr("Sent")}</button>
                  </>}
                </div>
              );
            })()}
          </div>
        )}
      </div>

      {/* ── The flow: amount, then pay. Two steps on a phone, side by side on desktop. ── */}
      {(() => {
        const wb = welcomeEligible && valid ? bonusForNaira(numAmount) : 0;
        const extra = (discount > 0 ? discount / 100 : 0) + wb;
        const cryptoLow = method === "crypto" && valid && numAmount < MIN_CRYPTO_NGN;
        const hasManual = gateways.some(g => g.id === "manual");
        return (
      <div className="desktop:grid desktop:grid-cols-2 desktop:gap-5 desktop:items-start mt-4">
        <div className={mobileStep === 2 ? "max-desktop:hidden" : ""}><div className="wf-col">
          <div className="wf-eb"><OffsetIcon name="topup" size={14} />{tr("Add funds")}</div>
          <div className="wf-card wf-amt">
            {amountInput}
            {couponSection}
          </div>
          <div className="desktop:hidden"><div className="wf-col mt-1">
            <PayButton onClick={() => { if (valid) setMobileStep(2); }} disabled={!valid} off={!valid} text={valid ? tr("Continue") : tr("Enter an amount")} />
            <div className="wf-sec">{tr("Next, choose how to pay")}</div>
          </div></div>
        </div></div>

        <div className={mobileStep === 1 ? "max-desktop:hidden" : ""}><div className="wf-col">
          {/* A phone's second step keeps the amount in view, with the way back. */}
          <div className="desktop:hidden"><div className="wf-card wf-adding">
            <div className="v">
              <div className="wf-eb">{tr("Adding")}</div>
              <b className="m">{money(valid ? numAmount : 0)}</b>
              {extra > 0 && valid && <small>{money(numAmount + extra, { round: "down" })} {tr("lands in your wallet")}</small>}
            </div>
            <button type="button" onClick={() => setMobileStep(1)} className="nb sec sm"><OffsetIcon name="pen" size={13} />{tr("Change")}</button>
          </div></div>
          <div className="wf-eb"><OffsetIcon name="card" size={14} />{tr("Pay with")}</div>
          {gatewaysLoading ? (
            [1, 2, 3].map(i => (
              <div key={i} className="wf-m flex items-center gap-3 py-[13px] px-3.5">
                <div className={`skel-bone w-[38px] h-[38px] rounded-[10px] shrink-0 ${dark ? "skel-dark" : "skel-light"}`} />
                <div className="flex-1"><div className={`skel-bone w-[130px] h-[12px] mb-2 ${dark ? "skel-dark" : "skel-light"}`} /><div className={`skel-bone w-[190px] max-w-full h-[10px] ${dark ? "skel-dark" : "skel-light"}`} /></div>
                <div className={`skel-bone w-[22px] h-[22px] rounded-full shrink-0 ${dark ? "skel-dark" : "skel-light"}`} />
              </div>
            ))
          ) : gateways.map(g => {
            const sel = method === g.id;
            const meta = GW_META[g.id] || {};
            return (
              <div key={g.id} className={`wf-m${sel ? " on" : ""}`}>
                <button type="button" onClick={() => setMethod(g.id)} aria-pressed={sel} className="wf-mh">
                  <Tile size={38}><OffsetIcon name={meta.icon || "card"} size={18} /></Tile>
                  <span className="wf-mt">
                    <span className="wf-mn">
                      {meta.name ? tr(meta.name) : g.name}
                      {meta.speed && <span className={`pbadge ${meta.fast ? "ok" : "tag"}`}>{tr(meta.speed)}</span>}
                      {g.id === "crypto" && <span className={`pbadge ${cryptoLow ? "no" : "tag"}`}>{tr("From")} {money(MIN_CRYPTO_NGN)}</span>}
                      {meta.brand && <span className="pbadge tag">{meta.brand}</span>}
                    </span>
                    {meta.desc && <span className="wf-md">{tr(meta.desc)}</span>}
                  </span>
                  <span className="wf-mark">{WF_TICK}</span>
                </button>
                {sel && meta.next && (
                  <div className="wf-more">
                    {tr(meta.next)}
                    {g.id === "flutterwave" && hasManual && <> {tr("Bank not on your app?")} <button type="button" onClick={() => setMethod("manual")} className="wf-lnk">{tr("Pay by bank transfer to Nitro instead.")}</button></>}
                  </div>
                )}
              </div>
            );
          })}
          {/* Say why, once. A hidden method with no explanation reads as a bug;
              a hidden method with one reads as the site knowing where you are. */}
          {!gatewaysLoading && hiddenNigeriaOnly > 0 && (
            gateways.length > 0
              ? <div className="wf-note">{tr("Bank transfer and mobile money are Nigerian-only for now. Card and crypto work from anywhere, and credit your wallet in naira.")}</div>
              : <div className="wf-note">{tr("No payment method is available for your country yet. Message us on WhatsApp and we will sort it out.")}</div>
          )}

          <div className="wf-card wf-rc">
            {[
              [tr("Deposit"), <b key="d" className="m">{money(valid ? numAmount : 0)}</b>],
              [tr("Fee"), <b key="f">{tr("Free")}</b>],
              couponApplied && discount > 0 ? [tr("Coupon bonus"), <b key="c" className="m ok">+{money(discount / 100, { round: "down" })}</b>] : null,
              wb > 0 ? [tr("Welcome bonus"), <b key="w" className="m ok">+{money(wb, { round: "down" })}</b>] : null,
            ].filter(Boolean).map(([label, val]) => (
              <div key={label} className="wf-rr"><span>{label}</span>{val}</div>
            ))}
            <div className="wf-rt">
              <span>{tr("Total")}</span>
              {valid ? <b className="m">{money(numAmount + extra, { round: "down" })}</b> : <em>{tr("Enter an amount")}</em>}
            </div>
          </div>
          {/* Crypto carries a higher floor than the rest of the wallet, so it is
              said here, with one tap to meet it, rather than left for the server
              to reject after they have pressed pay. */}
          {cryptoLow && (
            <div className="wf-warn">
              <OffsetIcon name="alert" size={15} />
              <span>{tr("Crypto deposits start at")} {money(MIN_CRYPTO_NGN)}</span>
              <button type="button" onClick={() => setNaira(MIN_CRYPTO_NGN)} className="nb warn sm">{tr("Make it")} {money(MIN_CRYPTO_NGN)}</button>
            </div>
          )}
          <PayButton onClick={handlePay} disabled={!valid || loading || cryptoLow} off={!valid || cryptoLow} loading={loading}
            text={loading ? tr("Processing...")
              : !valid ? tr("Enter an amount")
              : cryptoLow ? `${tr("Crypto deposits start at")} ${money(MIN_CRYPTO_NGN)}`
              : method === "manual" ? tr("Get our account details")
              : method === "crypto" ? `${tr("Pay")} ${money(numAmount)} ${tr("in crypto")}`
              : `${tr("Pay")} ${money(numAmount)}`} />
          <div className="wf-sec"><OffsetIcon name="lock" size={12} />{tr("Payments are 100% secure. Your balance updates the moment it clears.")}</div>
        </div></div>
      </div>
        );
      })()}
      {/* ═══ CRYPTO PAYMENT MODAL ═══ */}
      {cryptoModal && (
        <div onClick={() => { if (cryptoIsTerminal) { stopCryptoPolling(); setCryptoModal(null); } }} onKeyDown={e=>{if(e.key==='Escape'&&cryptoIsTerminal){stopCryptoPolling();setCryptoModal(null)}}} className="fixed inset-0 z-[200] flex items-center justify-center p-4 md:p-6 backdrop-blur-[4px] animate-[modalFadeIn_.2s_ease] bg-black/45 overflow-y-auto">
          <div role="dialog" aria-modal="true" aria-label={tr("Crypto payment")} onClick={e => e.stopPropagation()} className="w-full max-w-[420px] rounded-2xl p-6 animate-[modalBounceIn_.3s_cubic-bezier(.34,1.56,.64,1)_both] my-auto" style={{ background: dark ? "#140d1e" : "#fff", border: `1px solid ${dark ? "rgba(255,255,255,.22)" : "rgba(0,0,0,.14)"}`, boxShadow: dark ? "0 20px 60px rgba(0,0,0,.4)" : "0 20px 60px rgba(0,0,0,.1)" }}>
            {cryptoPresentation.kind === "credited" ? (
              <>
                <div className="text-center py-5">
                  <div className="mb-3 flex justify-center"><OffsetIcon name="checkCircle" size={48} color={dark ? "#6ee7b7" : "#059669"} /></div>
                  <div className="text-lg font-semibold mb-1.5 text-t-text">{cryptoPresentation.title}</div>
                  <div className="text-sm text-t-text-muted">{money(cryptoResult?.amount ?? cryptoModal.amountNgn, { round: "down" })} {tr("has been added to your wallet")}</div>
                </div>
                <div className="flex max-md:flex-col gap-3">
                  <button onClick={() => { stopCryptoPolling(); setCryptoModal(null); window.location.reload(); }} className="flex-1 py-3 rounded-[10px] bg-transparent text-[15px] font-medium cursor-pointer transition-transform duration-200 hover:-translate-y-px text-t-text font-[inherit]" style={{ border: `1px solid ${t.cardBorder}` }}>{tr("Done")}</button>
                  {onPlaceOrder && <button onClick={() => { stopCryptoPolling(); setCryptoModal(null); onPlaceOrder(); }} className="flex-1 py-3 rounded-[10px] border-none bg-gradient-to-br from-[#c47d8e] to-[#8b5e6b] text-white text-[15px] font-semibold cursor-pointer transition-[transform,box-shadow] duration-200 hover:-translate-y-px hover:shadow-[0_6px_20px_rgba(196,125,142,.31)] font-[inherit]">{tr("Place an order")}</button>}
                </div>
              </>
            ) : cryptoPresentation.kind === "review" ? (
              <>
                <div className="text-center py-5">
                  <div className="mb-3 flex justify-center"><OffsetIcon name="info" size={48} color={dark ? "#fcd34d" : "#d97706"} /></div>
                  <div className="text-lg font-semibold mb-1.5 text-t-text">{cryptoPresentation.title}</div>
                  <div className="text-sm leading-normal text-t-text-muted">{cryptoPresentation.message}</div>
                  {cryptoResult?.reference && <div className="m text-[11px] mt-3 break-all text-t-text-muted">{tr("Reference:")} {cryptoResult.reference}</div>}
                </div>
                <button onClick={() => { stopCryptoPolling(); setCryptoModal(null); onRefresh?.(); }} className="w-full py-3 rounded-[10px] bg-transparent text-[15px] font-medium cursor-pointer transition-transform duration-200 hover:-translate-y-px text-t-text font-[inherit]" style={{ border: `1px solid ${t.cardBorder}` }}>{tr("Close")}</button>
              </>
            ) : cryptoPresentation.kind === "failed" ? (
              <>
                <div className="text-center py-5">
                  <div className="mb-3 flex justify-center"><OffsetIcon name="xCircle" size={48} color={dark ? "#fca5a5" : "#dc2626"} /></div>
                  <div className="text-lg font-semibold mb-1.5 text-t-text">{cryptoPresentation.title}</div>
                  <div className="text-sm leading-normal text-t-text-muted">{cryptoPresentation.message}</div>
                </div>
                <button onClick={() => { stopCryptoPolling(); setCryptoModal(null); onRefresh?.(); }} className="w-full py-3 rounded-[10px] bg-transparent text-[15px] font-medium cursor-pointer transition-transform duration-200 hover:-translate-y-px text-t-text font-[inherit]" style={{ border: `1px solid ${t.cardBorder}` }}>{tr("Try another method")}</button>
              </>
            ) : (
              <>
                <div className="text-base font-semibold mb-1 text-t-text">{tr("Pay with crypto")}</div>
                <div className="text-[13px] mb-4 text-t-text-muted">{tr("Choose your coin on the next screen. Your wallet is credited in naira.")}</div>

                <div className="p-3.5 rounded-[10px] mb-3 text-center" style={{ background: dark ? "rgba(255,255,255,.12)" : "rgba(0,0,0,.04)", border: `1px solid ${t.cardBorder}` }}>
                  <div className="text-[11px] font-semibold uppercase tracking-[1px] mb-1 text-t-text-muted">{tr("Amount")}</div>
                  <div className="m text-[28px] font-bold" style={{ color: dark ? "#6ee7b7" : "#059669" }}>{fN(cryptoModal.amountNgn)}</div>
                  {/* The dollar figure is shown because the customer meets it on
                      the payment page regardless, and a number that appears for
                      the first time after they have committed reads as a
                      surprise. The naira-per-dollar division is deliberately
                      not done for them: the deposit rate carries Nitro's
                      premium, and spelling out the spread invites a holder to
                      sell their coin elsewhere and bank transfer instead. The
                      charge is disclosed; the margin is not advertised. */}
                  {Number(cryptoModal.amountUsd) > 0 && (
                    <div className="text-xs mt-0.5 text-t-text-muted">≈ ${cryptoModal.amountUsd} {tr("USD")}</div>
                  )}
                  <div className="text-[11px] mt-2 text-t-text-muted">{tr("The exact coin amount is shown on the payment page.")}</div>
                </div>

                <a
                  href={cryptoModal.gatewayUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block w-full py-3 mb-3 rounded-[10px] text-center text-[15px] font-semibold cursor-pointer no-underline transition-transform duration-200 hover:-translate-y-px text-white"
                  style={{ background: t.accent }}
                >{tr("Open payment page")}</a>

                <div className="py-2.5 px-3.5 rounded-lg mb-3.5" style={{ background: dark ? "rgba(251,191,36,.08)" : "rgba(217,119,6,.06)", border: `1px solid ${dark ? "rgba(251,191,36,.18)" : "rgba(217,119,6,.14)"}` }}>
                  <div className="flex items-center gap-2">
                    {cryptoPolling && <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: "#fbbf24" }} />}
                    <span className="text-[13px] font-medium" style={{ color: dark ? "#fbbf24" : "#d97706" }}>
                      {cryptoStatus === tr("Confirming") ? tr("Payment detected. Confirming on blockchain...") : tr("Waiting for payment...")}
                    </span>
                  </div>
                  <div className="text-[11px] mt-1 text-t-text-muted">{tr("We check automatically every 15 seconds. Do not close this page.")}</div>
                </div>

                <button onClick={async () => { stopCryptoPolling(); try { await fetch("/api/payments/crypto", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reference: cryptoModal.reference }) }); } catch {} setCryptoModal(null); onRefresh?.(); }} className="w-full py-2.5 rounded-lg bg-transparent text-sm font-medium cursor-pointer transition-transform duration-200 hover:-translate-y-px text-t-text-muted font-[inherit]" style={{ border: `1px solid ${t.cardBorder}` }}>{tr("Cancel")}</button>
              </>
            )}
          </div>
        </div>
      )}

      {/* ═══ MANUAL BANK TRANSFER SHEET ═══ */}
      <ManualTransferSheet manualModal={manualModal} setManualModal={setManualModal} manualStep={manualStep} setManualStep={setManualStep} manualRef={manualRef} setManualRef={setManualRef} manualSubmitting={manualSubmitting} setManualSubmitting={setManualSubmitting} manualDone={manualDone} setManualDone={setManualDone} dark={dark} t={t} onPlaceOrder={onPlaceOrder} onRefresh={onRefresh} />

      {/* ═══ WALLET HISTORY ═══ */}
      <WalletHistory txs={txs} initialTotal={transactionsTotal} walletSummary={walletSummary} dark={dark} t={t} onRefresh={onRefresh} setConfirmModal={setConfirmModal} setSenderName={setSenderName} />

      {/* ═══ CONFIRM PAYMENT MODAL ═══ */}
      {confirmModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center px-4 backdrop-blur-[4px] animate-[modalFadeIn_.2s_ease] bg-black/45" onClick={() => !confirmLoading && setConfirmModal(null)}>
          <div className="w-full max-w-[420px] rounded-2xl overflow-hidden animate-[modalBounceIn_.3s_cubic-bezier(.34,1.56,.64,1)_both]" style={{ background: dark ? "#140d1e" : "#fff", border: `1px solid ${dark ? "rgba(255,255,255,.22)" : "rgba(0,0,0,.14)"}`, boxShadow: dark ? "0 20px 60px rgba(0,0,0,.4)" : "0 20px 60px rgba(0,0,0,.1)" }} onClick={e => e.stopPropagation()}>
            <div className="h-1.5" style={{ background: "linear-gradient(135deg, #c47d8e, #8b5e6b)" }} />
            <div className="p-5">
              <div className="text-base font-semibold mb-1 text-t-text">{tr("Confirm Payment")}</div>
              <div className="text-[13px] mb-4 text-t-text-muted">{tr("You're confirming a deposit of")} <span className="font-semibold text-t-text">{money(confirmModal.amount)}</span></div>
              <label className="text-[11px] font-medium mb-1.5 block text-t-text-muted">{tr("Account name you sent from")}</label>
              <input value={senderName} onChange={e => setSenderName(e.target.value)} placeholder="e.g. John Doe" autoFocus className="w-full py-2.5 px-3 rounded-lg text-sm outline-none text-t-text font-[inherit]" style={{ background: dark ? "rgba(255,255,255,.07)" : "rgba(0,0,0,.04)", border: `1px solid ${dark ? "rgba(255,255,255,.12)" : "rgba(0,0,0,.08)"}` }} />
              <button onClick={async () => {
                if (!senderName.trim()) return;
                setConfirmLoading(true);
                try {
                  const r = await fetch("/api/payments/manual", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reference: confirmModal.reference, senderRef: senderName.trim() }) });
                  if (r.ok) { toast.success(tr("Payment confirmed"), tr("Your deposit is now awaiting admin verification.")); setConfirmModal(null); onRefresh?.(); }
                  else { const d = await r.json().catch(() => ({})); toast.error(tr("Failed"), d.error ? tr(d.error) : tr("Something went wrong")); }
                } catch { toast.error(tr("Network error"), tr("Check your connection")); }
                setConfirmLoading(false);
              }} disabled={confirmLoading || senderName.trim().length < 2} className="w-full py-2.5 mt-3 rounded-lg border-none text-white text-sm font-semibold cursor-pointer transition-[transform,box-shadow] duration-200 hover:-translate-y-px hover:shadow-[0_6px_20px_rgba(196,125,142,.31)]" style={{ fontFamily: "inherit", opacity: confirmLoading || senderName.trim().length < 2 ? .5 : 1, background: "linear-gradient(135deg,#c47d8e,#8b5e6b)" }}>{confirmLoading ? tr("Confirming...") : tr("Confirm Payment")}</button>
              <button onClick={async () => {
                setConfirmLoading(true);
                try { await fetch("/api/payments/manual", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reference: confirmModal.reference }) }); } catch {}
                setConfirmModal(null); setConfirmLoading(false); onRefresh?.();
              }} disabled={confirmLoading} className="w-full py-2 mt-2 rounded-lg bg-transparent text-[13px] font-medium cursor-pointer border-none" style={{ color: dark ? "#fca5a5" : "#dc2626", fontFamily: "inherit", opacity: confirmLoading ? .5 : 1 }}>{tr("Cancel this deposit")}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}


/* ═══════════════════════════════════════════ */
/* ═══ WALLET HISTORY                      ═══ */
/* ═══════════════════════════════════════════ */
function dayKeyWallet(iso) {
  if (!iso) return null;
  const d = new Date(iso); if (Number.isNaN(d.getTime())) return null;
  const now = new Date();
  const same = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  if (same(d, now)) return "Today";
  const y = new Date(now); y.setDate(now.getDate() - 1);
  if (same(d, y)) return "Yesterday";
  return d.toLocaleDateString(docDateLocale(), { day: "numeric", month: "short" });
}

function WalletHistory({ txs, initialTotal = txs?.length || 0, walletSummary, dark, t }) {
  const tr = useT();
  const money = useMoney();
  const [filter, setFilter] = useState("all");
  const [dateRange, setDateRange] = useState(null);
  const [page, setPage] = useState(1);
  const perPage = 25;
  const [historyTxs, setHistoryTxs] = useState(txs || []);
  const [total, setTotal] = useState(initialTotal);
  const [txTypes, setTxTypes] = useState(() => [...new Set((txs || []).map(tx => tx.type))]);
  const abortRef = useRef(null);
  const latestTransactionKey = txs?.[0] ? `${txs[0].id}:${txs[0].status}` : 'none';

  const fetchHistory = useCallback(async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const params = new URLSearchParams({ page: String(page), perPage: String(perPage) });
    if (filter !== 'all') params.set('type', filter);
    if (dateRange?.start) params.set('start', dateRange.start.toISOString());
    if (dateRange?.end) {
      const end = new Date(dateRange.end);
      end.setHours(23, 59, 59, 999);
      params.set('end', end.toISOString());
    }
    try {
      const res = await fetch(`/api/transactions?${params}`, { signal: controller.signal });
      const data = await res.json();
      if (!res.ok) return;
      const nextTotalPages = Math.max(1, data.totalPages || 1);
      if (page > nextTotalPages) {
        setPage(nextTotalPages);
        return;
      }
      setHistoryTxs(data.transactions || []);
      setTotal(data.total || 0);
      if (Array.isArray(data.types)) setTxTypes(data.types);
    } catch (error) {
      if (error?.name !== 'AbortError') {
        // Keep the last successful page visible on a transient network error.
      }
    }
  }, [page, filter, dateRange]);

  useEffect(() => {
    fetchHistory();
    return () => abortRef.current?.abort();
  }, [fetchHistory, latestTransactionKey]);

  const totalPages = Math.max(1, Math.ceil(total / perPage));

  const totalIn = walletSummary?.funded || 0;
  const totalOut = walletSummary?.spent || 0;

  return (
    <div className="mt-6 desktop:mt-8">
      {/* A line either side of the heading, the same edge-to-edge line the page
          header uses, so the history reads as its own section rather than the
          tail of the top-up form. */}
      <div className="page-divider bg-t-card-border" style={{ marginTop: 0 }} />
      {/* The filters ride the title's own line, and the count goes under both.
          With the count inside the title block the pair was too wide for a
          phone, so the filters wrapped onto a line of their own. */}
      <div className="pt-3.5 mb-3.5">
        <div className="flex items-center justify-between gap-2">
          <div className="text-base desktop:text-lg font-semibold text-t-text whitespace-nowrap">{tr("Wallet History")}</div>
          <div className="flex gap-1.5 flex-wrap justify-end min-w-0">
            <DateRangePicker dark={dark} t={t} value={dateRange} onChange={(v) => { setDateRange(v); setPage(1); }} />
            <FilterDropdown dark={dark} t={t} value={filter} onChange={(v) => { setFilter(v); setPage(1); }} options={[
              { value: "all", label: tr("All") },
              ...txTypes.map(f => ({ value: f, label: tr(txLabel(f)) })),
            ]} />
          </div>
        </div>
        <div className="text-[13px] text-t-text-muted">{total} {total === 1 ? tr("transaction") : tr("transactions")} {tr("· last 6 months")}</div>
        <div className="page-divider bg-t-card-border" />
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-2 mb-3">
        <div className="py-2.5 px-3 rounded-xl text-center" style={{ background: dark ? "rgba(110,231,183,.06)" : "rgba(5,150,105,.04)", border: `1px solid ${dark ? "rgba(110,231,183,.15)" : "rgba(5,150,105,.1)"}` }}>
          <div className="flex items-center justify-center gap-1 text-[11px] uppercase tracking-[1px] mb-0.5 text-t-text-muted"><span className="inline-flex" style={{ color: dark ? "#6ee7b7" : "#059669" }}><OffsetIcon name="moneyIn" size={14} /></span>{tr("Funded")}</div>
          <div className="m text-[15px] font-bold" style={{ color: dark ? "#6ee7b7" : "#059669" }}>+{fNShort(totalIn, money)}</div>
        </div>
        <div className="py-2.5 px-3 rounded-xl text-center" style={{ background: dark ? "rgba(252,165,165,.06)" : "rgba(220,38,38,.04)", border: `1px solid ${dark ? "rgba(252,165,165,.15)" : "rgba(220,38,38,.1)"}` }}>
          <div className="flex items-center justify-center gap-1 text-[11px] uppercase tracking-[1px] mb-0.5 text-t-text-muted"><span className="inline-flex" style={{ color: dark ? "#fca5a5" : "#dc2626" }}><OffsetIcon name="moneyOut" size={14} /></span>{tr("Spent")}</div>
          <div className="m text-[15px] font-bold" style={{ color: dark ? "#fca5a5" : "#dc2626" }}>-{fNShort(totalOut, money)}</div>
        </div>
      </div>

      {/* Transaction list */}
      <div className="rounded-xl desktop:rounded-[14px] overflow-hidden" style={{ background: t.cardBg, border: `1px solid ${t.cardBorder}` }}>
        {historyTxs.length > 0 ? historyTxs.map((tx, i) => {
          const dk = dayKeyWallet(tx.date); const prev = i > 0 ? dayKeyWallet(historyTxs[i - 1].date) : null;
          const dayLabel = dk && dk !== prev ? <div className="text-[10.5px] font-semibold uppercase tracking-[1px] px-3.5 pt-3 pb-1 text-t-text-muted" style={{ background: dark ? "rgba(255,255,255,.04)" : "rgba(0,0,0,.025)", borderTop: i > 0 ? `1px solid ${t.cardBorder}` : "none" }}>{dk}</div> : null;
          const statusMeta = txStatusMeta(tx, dark, tr);
          const rowColor = txRowClr(tx, dark);
          return (
            <Fragment key={tx.id}>{dayLabel}<div className="flex items-center gap-2.5 desktop:gap-3.5 py-3 px-3.5 desktop:py-3.5 desktop:px-[18px]" style={{ borderBottom: i < historyTxs.length - 1 ? `1px solid ${t.cardBorder}` : "none", background: statusMeta ? `${rowColor}${dark ? "0a" : "08"}` : (tx.orderStatus && !["Completed","Cancelled"].includes(tx.orderStatus)) ? (dark ? "rgba(252,211,77,.04)" : "rgba(217,119,6,.03)") : "transparent" }}>
              <span className="ic-tile tc w-8 h-8 desktop:w-9 desktop:h-9" style={{ "--tc": rowColor }}>{txIcon(tx.type)}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm desktop:text-[15px] font-medium overflow-hidden text-ellipsis whitespace-nowrap text-t-text">{tr(txLabel(tx.type))}</span>
                  {statusMeta && <span className="text-[11px] font-semibold py-px px-1.5 rounded" style={{ background: statusMeta.bg, color: statusMeta.color }}>{statusMeta.label}</span>}
                  {tx.orderStatus && !["Completed", "Cancelled"].includes(tx.orderStatus) && <span className="text-[11px] font-semibold py-px px-1.5 rounded" style={{ background: tx.orderStatus === tr("Processing") ? (dark ? "rgba(165,180,252,.12)" : "rgba(99,102,241,.08)") : (dark ? "rgba(252,211,77,.12)" : "rgba(217,119,6,.08)"), color: tx.orderStatus === tr("Processing") ? (dark ? "#a5b4fc" : "#6366f1") : (dark ? "#fcd34d" : "#d97706") }}>{tx.orderStatus}</span>}
                </div>
                <div className="text-[11px] desktop:text-[13px] mt-0.5 overflow-hidden text-ellipsis whitespace-nowrap text-t-text-muted">{txDesc(tx, tr)}</div>
              </div>
              <div className="text-right shrink-0">
                <div className="m text-[13px] desktop:text-[15px] font-bold" style={{ color: rowColor }}>
                  {txAmountPrefix(tx)}{money(tx.amount, { round: tx.amount < 0 ? "up" : "down" })}
                </div>
                <div className="text-[11px] mt-0.5 text-t-text-muted">{tx.date ? fD(tx.date, true) : ""}</div>
              </div>
            </div></Fragment>
          );
        }) : (
          <div className="p-10 text-center text-[15px] text-t-text-muted">
            <div className="flex justify-center mb-3"><Tile size={40}><OffsetIcon name="receipt" size={20} /></Tile></div>
            <div className="text-base font-semibold mb-1 text-t-text-soft">{filter !== "all" || dateRange ? tr("No matching transactions") : tr("No transactions in the last 6 months")}</div>
            <div className="text-[15px] text-t-text-muted">{filter !== "all" || dateRange ? tr("Try adjusting your filters") : tr("New wallet activity will appear here")}</div>
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center items-center gap-1.5 mt-3">
          <button onClick={() => setPage(Math.max(1, page - 1))} disabled={page <= 1} className="w-[30px] h-[30px] rounded-md flex items-center justify-center border cursor-pointer bg-transparent" style={{ borderColor: t.cardBorder, color: t.textSoft, opacity: page <= 1 ? .3 : 1 }}>
            <svg className="dir-flip" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>
          </button>
          <span className="text-[13px] px-2 text-t-text-muted">{page} / {totalPages}</span>
          <button onClick={() => setPage(Math.min(totalPages, page + 1))} disabled={page >= totalPages} className="w-[30px] h-[30px] rounded-md flex items-center justify-center border cursor-pointer bg-transparent" style={{ borderColor: t.cardBorder, color: t.textSoft, opacity: page >= totalPages ? .3 : 1 }}>
            <svg className="dir-flip" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>
          </button>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════ */
/* ═══ ADD FUNDS RIGHT SIDEBAR             ═══ */
/* ═══════════════════════════════════════════ */
export function AddFundsSidebar({ txs }) {
  const tr = useT();
  const money = useMoney();
  // Drawn marks, not the two-letter initials ("BT", "CR", "CD", "DP") that
  // read as codes the customer is expected to know.
  const METHOD = {
    manual: [I_BANK, msg("Bank transfer")], monnify: [I_BANK, msg("Bank transfer")], alatpay: [I_BANK, msg("Bank transfer")],
    crypto: [I_COIN, msg("Crypto")],
    flutterwave: [I_CARD, msg("Card")], paystack: [I_CARD, msg("Card")], korapay: [I_CARD, msg("Card")],
  };
  const STATUS = { Completed: "Cleared", Pending: "Waiting", Failed: "Failed", Rejected: "Rejected", Expired: "Expired", Processing: "Processing" };
  const deposits = (txs || []).filter(tx => tx.type === "deposit").slice(0, 5);
  return (
    <div className="rr">
      <RailSec icon="book">{tr("How it works")}</RailSec>
      <RailCard>
        <RailStep n="1" title={tr("Enter an amount")} sub={`${money(1000)} or more`} />
        <RailStep n="2" title={tr("Pick how to pay")} sub={tr("Bank transfer, card, crypto")} />
        <RailStep n="3" title={tr("Pay")} sub={tr("Your balance updates at once")} />
      </RailCard>
      <RailSec icon="moneyIn">{tr("Recent deposits")}</RailSec>
      <RailCard>
        {deposits.length === 0 ? <RailEmpty icon="moneyIn">{tr("No deposits yet.")}</RailEmpty> : deposits.map(tx => {
          const [ini, name] = METHOD[tx.method] || [I_IN, msg("Deposit")];
          return <RailRow key={tx.id || tx.reference} tile={ini} print title={tr(name)} sub={`${tx.createdAt || tx.date ? fD(tx.createdAt || tx.date, true) : ""} · ${STATUS[tx.status] || tx.status}`} right={money(Math.abs(tx.amount || 0), { round: (tx.amount || 0) < 0 ? "up" : "down" })} />;
        })}
      </RailCard>
    </div>
  );
}
