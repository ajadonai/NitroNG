'use client';
import { useState, useEffect, useRef, useCallback } from "react";
import { useToast } from "./toast";
import { fN, fD } from "../lib/format";
import { BONUS_PRESETS, bonusForNaira, nextBonusTier } from "../lib/welcome-bonus";
import { DateRangePicker, FilterDropdown } from "./date-range-picker";
import { WalletPointsCard, PointsModal } from "./rewards";
import { PAYMENT_STATES, isCreditedPaymentResult, paymentStateFromTransactionStatus } from "../lib/payment-state";
import {
  creditedCryptoPaymentStatus,
  cryptoPaymentPresentation,
  getCryptoPaymentAttempt,
  isDefinitiveCryptoCreationRejection,
  isTerminalCryptoPaymentResult,
  releaseCryptoPaymentAttempt,
} from "../lib/crypto-payment-ui";

const TX_META = {
  deposit:      { label: "Deposit",       icon: "↓", clr: dk => dk ? "#6ee7b7" : "#059669" },
  order:        { label: "Order",         icon: "↑", clr: dk => dk ? "#fca5a5" : "#dc2626" },
  referral:     { label: "Referral bonus",icon: "★", clr: () => "#c47d8e" },
  refund:       { label: "Refund",        icon: "↩", clr: dk => dk ? "#fcd34d" : "#d97706" },
  admin_credit: { label: "Admin credit",  icon: "＋", clr: dk => dk ? "#a5b4fc" : "#4f46e5" },
  admin_gift:   { label: "Gift",          icon: "✦", clr: dk => dk ? "#f0abfc" : "#a855f7" },
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
function txStatusMeta(tx, dk) {
  const paymentState = txPaymentState(tx);
  const status = paymentState || tx.status;
  const styles = {
    [PAYMENT_STATES.VERIFYING]: { label: "Verifying", color: dk ? "#a5b4fc" : "#4f46e5", bg: dk ? "rgba(165,180,252,.12)" : "rgba(79,70,229,.08)" },
    [PAYMENT_STATES.PROVIDER_PENDING]: { label: "Pending", color: dk ? "#fcd34d" : "#d97706", bg: dk ? "rgba(252,211,77,.12)" : "rgba(217,119,6,.08)" },
    [PAYMENT_STATES.RETRYABLE]: { label: "Retrying", color: dk ? "#fdba74" : "#ea580c", bg: dk ? "rgba(253,186,116,.12)" : "rgba(234,88,12,.08)" },
    [PAYMENT_STATES.REVIEW]: { label: "Manual review", color: dk ? "#fcd34d" : "#d97706", bg: dk ? "rgba(252,211,77,.12)" : "rgba(217,119,6,.08)" },
    [PAYMENT_STATES.FAILED]: { label: "Failed", color: dk ? "#fca5a5" : "#dc2626", bg: dk ? "rgba(252,165,165,.12)" : "rgba(220,38,38,.08)" },
    Processing: { label: "Processing", color: dk ? "#a5b4fc" : "#4f46e5", bg: dk ? "rgba(165,180,252,.12)" : "rgba(79,70,229,.08)" },
    Pending: { label: "Pending", color: dk ? "#fcd34d" : "#d97706", bg: dk ? "rgba(252,211,77,.12)" : "rgba(217,119,6,.08)" },
    Expired: { label: "Expired", color: dk ? "#fdba74" : "#ea580c", bg: dk ? "rgba(253,186,116,.12)" : "rgba(234,88,12,.08)" },
    Review: { label: "Manual review", color: dk ? "#fcd34d" : "#d97706", bg: dk ? "rgba(252,211,77,.12)" : "rgba(217,119,6,.08)" },
    Refunded: { label: "Refunded", color: dk ? "#fca5a5" : "#dc2626", bg: dk ? "rgba(252,165,165,.12)" : "rgba(220,38,38,.08)" },
    Failed: { label: "Failed", color: dk ? "#fca5a5" : "#dc2626", bg: dk ? "rgba(252,165,165,.12)" : "rgba(220,38,38,.08)" },
    Rejected: { label: "Rejected", color: dk ? "#fca5a5" : "#dc2626", bg: dk ? "rgba(252,165,165,.12)" : "rgba(220,38,38,.08)" },
    Cancelled: { label: "Cancelled", color: dk ? "#a1a1aa" : "#71717a", bg: dk ? "rgba(161,161,170,.12)" : "rgba(113,113,122,.08)" },
  };
  return styles[status] || null;
}
function txAmountPrefix(tx) {
  return tx.amount > 0 && txIsCompleted(tx) ? "+" : "";
}
function fNShort(v) { const a = Math.abs(v); if (a >= 1e8) return `₦${(a/1e6).toFixed(1).replace(/\.0$/,"")}M`; if (a >= 1e6) return `₦${(a/1e6).toFixed(2).replace(/\.?0+$/,"")}M`; if (a >= 1e5) return `₦${(a/1e3).toFixed(1).replace(/\.0$/,"")}K`; return fN(v); }
function txIcon(type) { return (TX_META[type] || TX_META.order).icon; }
function txLabel(type) { return (TX_META[type] || { label: type }).label; }
function txDesc(tx) {
  if (tx.type === "order" && tx.reference) {
    const platform = tx.description?.match(/— (\S+)/)?.[1];
    const id = tx.reference.startsWith("BULK-") ? `Bulk ${tx.reference}` : tx.reference;
    return platform ? `${id} · ${platform}` : id;
  }
  if (tx.description && tx.description !== tx.reference) return tx.description.replace(/\s*\[[^\]]+\]\s*$/, "");
  if (tx.type === "refund") return tx.reference ? `Refund for ${tx.reference.replace(/^(ADM-)?REF-/, "")}` : "Order refund";
  if (tx.type === "deposit") return tx.reference || "Wallet top-up";
  if (tx.type === "referral") return "Referral commission";
  if (tx.type === "admin_credit" || tx.type === "admin_gift") return tx.description || "Credited by Nitro Team";
  return tx.reference || "";
}

const PRESETS = [1000, 2000, 5000, 10000, 20000, 50000];

const ACCEPTED_TYPES = [
  { label: "Cards", short: "Cards", icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg> },
  { label: "Bank Transfer", short: "Transfer", icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 21h18M3 10h18M5 6l7-3 7 3M4 10v11M20 10v11M8 14v3M12 14v3M16 14v3"/></svg> },
  { label: "Crypto", short: "Crypto", icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11.767 19.089c4.924.868 6.14-6.025 1.216-6.894m-1.216 6.894L5.86 18.047m5.908 1.042-.347 1.97m1.563-8.864c4.924.869 6.14-6.025 1.215-6.893m-1.215 6.893-6.083-1.072m6.083 1.072.347-1.969M7.116 16.676l-2.576-.454M9.21 4.835l-.347 1.97m0 0-2.576-.455"/></svg> },
  { label: "Mobile Money", short: "Mobile", icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="2" width="14" height="20" rx="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg> },
];

const GW_META = {
  flutterwave: { desc: "Card, bank transfer", speed: "Fast" },
  crypto: { desc: "USDT via TRC-20", speed: "5–30 min" },
  manual: { desc: "Direct bank transfer", speed: "15–60 min" },
};

/* ═══════════════════════════════════════════ */
/* ═══ ADD FUNDS PAGE                      ═══ */
/* ═══════════════════════════════════════════ */
export function recoverableFlutterwaveDeposits(txs, excludedReference = null) {
  return (txs || []).filter(tx => (
    isFlutterwaveDeposit(tx)
    && ["Pending", "Expired", "Processing"].includes(tx.status)
    && tx.reference
    && tx.reference !== excludedReference
  ));
}

export default function AddFundsPage({ user, txs, transactionsTotal, walletSummary, dark, t, paymentStatus, setPaymentStatus, gatewayReturnReference, onPlaceOrder, onRefresh }) {
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
      const amt = paymentStatus.amount ? `₦${Number(paymentStatus.amount).toLocaleString()} credited` : "Your wallet has been credited";
      toast.success("Payment successful!", amt);
      if (paymentStatus.welcomeBonus > 0) {
        setTimeout(() => toast.success("🎁 Welcome bonus!", `₦${Number(paymentStatus.welcomeBonus).toLocaleString()} bonus added to your wallet`), 1500);
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
  const [manualRef, setManualRef] = useState("");
  const [manualSubmitting, setManualSubmitting] = useState(false);
  const [manualDone, setManualDone] = useState(false);
  const [manualStep, setManualStep] = useState("details"); // "details" | "confirm"

  // Fetch enabled gateways from API
  useEffect(() => {
    fetch("/api/payments/gateways").then(r => r.json()).then(d => {
      const gws = d.gateways || [];
      setGateways(gws);
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
            toast.success("Payment recovered!", `₦${Number(data.amount).toLocaleString()} has been credited to your wallet`);
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
  const valid = numAmount >= 1000;
  const balance = user?.balance || 0;

  const lastFunded = txs?.find(tx => tx.type === 'deposit' && tx.status === 'Completed');
  const pendingDeposits = txs?.filter(tx => tx.type === 'deposit' && (
    tx.status === 'Pending'
    || ((tx.method === 'flutterwave' || tx.method == null) && (tx.status === 'Processing' || tx.status === 'Expired'))
  )) || [];
  const pendingTotal = pendingDeposits.reduce((s, tx) => s + (tx.amount || 0), 0);
  const hasNonManualProgress = pendingDeposits.some(tx => tx.method !== 'manual');
  const pendingSummaryText = hasNonManualProgress
    ? `${pendingDeposits.length} deposit${pendingDeposits.length === 1 ? '' : 's'}${pendingTotal > 0 ? ` · ${fN(pendingTotal)}` : ''} in progress`
    : `${pendingDeposits.length} pending deposit${pendingDeposits.length === 1 ? '' : 's'}${pendingTotal > 0 ? ` · ${fN(pendingTotal)}` : ''} awaiting confirmation`;

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

        if (res.ok && data.payAddress) {
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
                  status: sd.status || (sd.npStatus === "confirming" ? "Confirming" : "Pending"),
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
          toast.error("Payment failed", data.error || data.message || "Failed to create crypto payment");
        }
      } catch (err) {
        toast.error(
          err?.name === "TimeoutError" ? "Timed out" : "Network error",
          "Try again — we’ll safely reuse this payment attempt.",
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
          setManualDone(false);
          setManualRef("");
          setManualStep("details");
        } else {
          if (res.status === 400) toast.warning("Pending transfer", data.error);
          else toast.error("Transfer failed", data.error || "Failed to create request");
        }
      } catch { toast.error("Network error", "Check your connection"); }
      setLoading(false); payingRef.current = false;
      return;
    }

    // ═══ CARD/TRANSFER — redirect flow ═══
    try {
      const res = await fetch("/api/payments/initialize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: numAmount, method, couponId: couponApplied?.couponId || undefined, idempotencyKey: crypto.randomUUID() }),
        signal: AbortSignal.timeout(30000),
      });
      const data = await res.json();
      if (data.authorization_url) {
        window.location.href = data.authorization_url;
      } else {
        toast.error("Payment failed", data.error || "Initialization failed");
        setLoading(false); payingRef.current = false;
      }
    } catch (err) {
      toast.error(err?.name === "TimeoutError" ? "Timed out" : "Network error", "Check your connection");
      setLoading(false); payingRef.current = false;
    }
  };

  const welcomeEligible = user?.welcomeBonusEligible;
  const cryptoPresentation = cryptoPaymentPresentation(cryptoResult || { status: cryptoStatus });
  const cryptoIsTerminal = cryptoPresentation.kind !== "pending";

  /* ── Shared sub-components ── */
  const amountInput = (
    <>
      {welcomeEligible && (
        <div className="flex items-center gap-3 rounded-xl p-3.5 mb-4" style={{ background: dark ? 'rgba(196,125,142,.1)' : 'rgba(196,125,142,.06)', border: `1px solid ${dark ? 'rgba(196,125,142,.2)' : 'rgba(196,125,142,.15)'}` }}>
          <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: dark ? 'rgba(196,125,142,.18)' : 'rgba(196,125,142,.12)' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={t.accent} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M20 12v10H4V12"/><path d="M2 7h20v5H2z"/><path d="M12 22V7"/><path d="M12 7H7.5a2.5 2.5 0 010-5C11 2 12 7 12 7z"/><path d="M12 7h4.5a2.5 2.5 0 000-5C13 2 12 7 12 7z"/></svg>
          </div>
          <div>
            <div className="text-[13px] font-semibold" style={{ color: t.accent }}>Welcome bonus</div>
            <div className="text-[12.5px] mt-0.5" style={{ color: t.textSoft, lineHeight: 1.45 }}>Your first deposit earns up to ₦3,000 free. The more you add, the bigger the bonus.</div>
          </div>
        </div>
      )}
      {welcomeEligible && (
        <>
          <div className="grid grid-cols-3 gap-2.5 max-md:gap-2 mb-3">
            {BONUS_PRESETS.map(p => {
              const sel = numAmount === p.amount;
              const total = p.amount + p.bonus;
              return (
                <button key={p.amount} onClick={() => setAmount(String(p.amount))} className="m relative pt-[18px] pb-3 max-md:pt-4 max-md:pb-2.5 rounded-[12px] text-center cursor-pointer transition-[border-color,background-color,box-shadow,transform] duration-150 hover:translate-y-[-1px]" style={{ border: `1.5px solid ${sel ? t.accent : (p.tag ? (dark ? 'rgba(196,125,142,.25)' : 'rgba(196,125,142,.18)') : t.cardBorder)}`, background: sel ? (dark ? 'rgba(196,125,142,.14)' : 'rgba(196,125,142,.08)') : 'transparent', boxShadow: sel ? '0 0 14px rgba(196,125,142,.12)' : 'none' }}>
                  {p.tag && <span className="absolute -top-2 left-1/2 -translate-x-1/2 text-[9px] font-bold py-0.5 px-2.5 rounded-full text-white whitespace-nowrap" style={{ background: 'linear-gradient(135deg,#c47d8e,#a3586b)', boxShadow: '0 2px 8px rgba(196,125,142,.3)', letterSpacing: .3 }}>{p.tag}</span>}
                  <div className="text-lg max-md:text-base font-extrabold" style={{ color: sel ? t.accent : t.text, letterSpacing: -.3 }}>₦{p.amount.toLocaleString()}</div>
                  <div className="inline-flex items-center gap-1 mt-1 py-0.5 px-2 rounded-md text-[11px] max-md:text-[10px] font-bold" style={{ background: sel ? (dark ? 'rgba(110,231,183,.15)' : 'rgba(5,150,105,.1)') : (dark ? 'rgba(110,231,183,.07)' : 'rgba(5,150,105,.05)'), color: sel ? (dark ? '#6ee7b7' : '#059669') : (dark ? 'rgba(110,231,183,.6)' : 'rgba(5,150,105,.5)') }}>+₦{p.bonus.toLocaleString()} free</div>
                  <div className="text-[10px] max-md:text-[9px] mt-1" style={{ color: t.textMuted }}>₦{total.toLocaleString()} to spend</div>
                </button>
              );
            })}
          </div>
          <div className="flex items-center gap-3 mb-3 max-md:mb-2.5">
            <div className="flex-1 h-px" style={{ background: t.cardBorder }} />
            <span className="text-[10px] font-semibold uppercase tracking-[1.2px]" style={{ color: t.textMuted }}>or enter amount</span>
            <div className="flex-1 h-px" style={{ background: t.cardBorder }} />
          </div>
        </>
      )}
      {!welcomeEligible && <div className="text-sm font-semibold uppercase tracking-[1px] mb-2.5" style={{ color: t.textSoft }}>Amount to deposit</div>}
      <div className="flex items-center gap-1 py-3.5 px-[18px] max-desktop:py-3 max-desktop:px-4 max-md:py-3 max-md:px-3.5 rounded-xl mb-4 max-md:mb-3" style={{ background: dark ? "#131728" : "#fff", border: `1px solid ${amount ? t.accent : t.cardBorder}` }}>
        <span className="m text-[26px] max-desktop:text-[22px] max-md:text-xl font-semibold" style={{ color: dark ? "rgba(255,255,255,.55)" : "rgba(0,0,0,.4)" }}>₦</span>
        <input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0" className="m border-none text-[30px] max-desktop:text-[26px] max-md:text-2xl font-semibold w-full outline-none bg-transparent placeholder:opacity-[.12]" style={{ color: t.text }} />
      </div>
      {!welcomeEligible && (
        <div className="grid grid-cols-3 gap-2 max-md:gap-1.5 mb-3">
          {PRESETS.map(p => (
            <button key={p} onClick={() => setAmount(String(p))} className="m py-[13px] max-desktop:py-[11px] max-md:py-2.5 rounded-[10px] text-base max-desktop:text-[15px] max-md:text-sm font-semibold text-center cursor-pointer transition-[border-color,background-color,color,transform] duration-150 hover:translate-y-[-1px]" style={{ border: `1px solid ${numAmount === p ? t.accent : t.cardBorder}`, background: numAmount === p ? (dark ? "rgba(196,125,142,.18)" : "rgba(196,125,142,.12)") : "transparent", color: numAmount === p ? t.accent : (dark ? "rgba(255,255,255,.55)" : "rgba(0,0,0,.45)") }}>
              ₦{p >= 1000 ? `${p / 1000}K` : p}
            </button>
          ))}
        </div>
      )}
      {welcomeEligible && numAmount >= 2500 && (() => {
        const wb = bonusForNaira(numAmount);
        return (
          <div className="flex items-center gap-2 mt-1 mb-1 py-2 px-3 rounded-lg" style={{ background: dark ? 'rgba(110,231,183,.06)' : 'rgba(5,150,105,.04)', border: `1px solid ${dark ? 'rgba(110,231,183,.14)' : 'rgba(5,150,105,.1)'}` }}>
            <div className="w-[22px] h-[22px] rounded-md flex items-center justify-center shrink-0" style={{ background: dark ? 'rgba(110,231,183,.12)' : 'rgba(5,150,105,.08)' }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={dark ? '#6ee7b7' : '#059669'} strokeWidth="2.5" strokeLinecap="round"><path d="M20 6L9 17l-5-5"/></svg>
            </div>
            <span className="text-[12.5px] font-semibold" style={{ color: dark ? '#6ee7b7' : '#059669' }}>+₦{wb.toLocaleString()} welcome bonus will be added</span>
          </div>
        );
      })()}
      {welcomeEligible && numAmount >= 1000 && (() => {
        const nt = nextBonusTier(numAmount);
        if (!nt) return null;
        const diff = nt.min - numAmount;
        const cur = bonusForNaira(numAmount);
        return (
          <div className="flex items-center gap-2 mt-1 mb-1 py-2 px-3 rounded-lg" style={{ background: dark ? 'rgba(196,125,142,.06)' : 'rgba(196,125,142,.04)', border: `1px solid ${dark ? 'rgba(196,125,142,.14)' : 'rgba(196,125,142,.1)'}` }}>
            <div className="w-[22px] h-[22px] rounded-md flex items-center justify-center shrink-0" style={{ background: dark ? 'rgba(196,125,142,.14)' : 'rgba(196,125,142,.08)' }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={t.accent} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 19V5M5 12l7-7 7 7"/></svg>
            </div>
            <span className="text-[12.5px] font-medium" style={{ color: t.textSoft }}>
              {cur > 0
                ? <><button onClick={() => setAmount(String(nt.min))} className="font-bold border-none bg-transparent p-0 cursor-pointer" style={{ color: t.accent, borderBottom: `1.5px dashed ${t.accent}`, paddingBottom: 1, font: 'inherit', fontSize: 'inherit' }}>Add ₦{diff.toLocaleString()} more</button> and get <strong style={{ color: t.accent }}>₦{nt.bonus.toLocaleString()} free</strong> instead of ₦{cur.toLocaleString()}.</>
                : <><button onClick={() => setAmount(String(nt.min))} className="font-bold border-none bg-transparent p-0 cursor-pointer" style={{ color: t.accent, borderBottom: `1.5px dashed ${t.accent}`, paddingBottom: 1, font: 'inherit', fontSize: 'inherit' }}>Add ₦{diff.toLocaleString()} more</button> to unlock your <strong style={{ color: t.accent }}>₦{nt.bonus.toLocaleString()} welcome bonus</strong>.</>
              }
            </span>
          </div>
        );
      })()}
      <div className="min-h-6 mt-2.5 flex items-center">
        {numAmount > 0 && numAmount < 1000 ? (
          <div className="text-sm font-medium flex items-center gap-1.5" style={{ color: dark ? "#fcd34d" : "#d97706" }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
            Minimum deposit is ₦1,000
          </div>
        ) : !valid && (
          <div className="text-[12px]" style={{ color: t.textMuted }}>Minimum deposit is ₦1,000</div>
        )}
      </div>
    </>
  );

  const couponSection = (
    !couponApplied ? (
      <div className="mt-2">
        {!showCoupon ? (
          <button onClick={() => setShowCoupon(true)} className="py-2 px-3 rounded-lg border-none text-[13px] font-semibold cursor-pointer flex items-center gap-2 transition-all duration-200 hover:-translate-y-px" style={{ background: dark ? "rgba(196,125,142,.1)" : "rgba(196,125,142,.07)", color: t.accent }}>
            <div className="w-6 h-6 rounded-md flex items-center justify-center" style={{ background: dark ? "rgba(196,125,142,.2)" : "rgba(196,125,142,.14)" }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="19" y1="5" x2="5" y2="19"/><circle cx="6.5" cy="6.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/></svg>
            </div>
            Have a coupon code?
          </button>
        ) : (
          <div className="py-2.5 px-3 rounded-lg" style={{ background: dark ? "rgba(196,125,142,.08)" : "rgba(196,125,142,.05)", border: `1px solid ${dark ? "rgba(196,125,142,.18)" : "rgba(196,125,142,.12)"}` }}>
            <div className="flex items-center gap-1.5 mb-2 text-[11px] font-semibold uppercase tracking-[1px]" style={{ color: t.accent }}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="19" y1="5" x2="5" y2="19"/><circle cx="6.5" cy="6.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/></svg>
              Coupon Code
            </div>
            <div className="flex gap-2">
              <input value={couponCode} onChange={e => setCouponCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))} placeholder="e.g. NITRO20" className="m flex-1 py-[9px] px-3 rounded-lg text-[13px] tracking-[1.5px] outline-none" style={{ background: dark ? "rgba(255,255,255,.08)" : "#fff", border: `1.5px solid ${couponCode.trim() ? t.accent : (dark ? "rgba(255,255,255,.12)" : "rgba(0,0,0,.1)")}`, color: t.text, fontFamily: "'JetBrains Mono',monospace", transition: "border-color .2s" }} />
              <button onClick={applyCoupon} disabled={couponLoading || !couponCode.trim()} className="py-[9px] px-4 rounded-lg text-[13px] font-semibold cursor-pointer border-none transition-all duration-200 hover:-translate-y-px" style={{ background: couponCode.trim() ? "linear-gradient(135deg,#c47d8e,#8b5e6b)" : (dark ? "rgba(255,255,255,.1)" : "rgba(0,0,0,.08)"), color: couponCode.trim() ? "#fff" : t.textMuted, opacity: couponLoading ? .5 : 1 }}>{couponLoading ? "..." : "Apply"}</button>
            </div>
            {couponError && <div className="text-xs mt-1.5 flex items-center gap-1" style={{ color: dark ? "#fca5a5" : "#dc2626" }}><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg> {couponError}</div>}
          </div>
        )}
      </div>
    ) : (
      <div className="mt-2 py-2.5 px-3 rounded-lg" style={{ background: `linear-gradient(135deg, ${dark ? "rgba(110,231,183,.14)" : "rgba(5,150,105,.08)"}, ${dark ? "rgba(110,231,183,.04)" : "rgba(5,150,105,.02)"})`, border: `1px solid ${dark ? "rgba(110,231,183,.22)" : "rgba(5,150,105,.16)"}` }}>
        <div className="flex items-center gap-2 text-[13px]" style={{ color: dark ? "#6ee7b7" : "#059669" }}>
          <div className="w-6 h-6 rounded-md flex items-center justify-center shrink-0" style={{ background: dark ? "rgba(110,231,183,.2)" : "rgba(5,150,105,.12)" }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
          </div>
          <span className="font-semibold"><span className="m tracking-[1px]" style={{ fontFamily: "'JetBrains Mono',monospace" }}>{couponApplied.code}</span> · {couponApplied.type === "percent" ? `${couponApplied.value}%` : `+₦${couponApplied.value.toLocaleString()}`} bonus</span>
          <button onClick={removeCoupon} className="ml-auto bg-transparent border-none text-[11px] font-semibold cursor-pointer py-1 px-2 rounded-md transition-all duration-200 hover:-translate-y-px" style={{ color: dark ? "#fca5a5" : "#dc2626", background: dark ? "rgba(252,165,165,.08)" : "rgba(220,38,38,.05)" }}>Remove</button>
        </div>
      </div>
    )
  );

  const AcceptedRow = ({ centered }) => (
    <div className={`flex items-center gap-1.5 flex-wrap ${centered ? "justify-center mt-4" : ""}`}>
      <span className={`text-[13px] ${centered ? "hidden" : "hidden desktop:inline"}`} style={{ color: t.textMuted }}>We accept:</span>
      {ACCEPTED_TYPES.map(({ label, short, icon }) => (
        <span key={label} className="text-xs py-[3px] px-2 rounded-md font-medium whitespace-nowrap inline-flex items-center gap-1" style={{ background: dark ? "rgba(255,255,255,.12)" : "rgba(255,255,255,.8)", border: `1px solid ${t.cardBorder}`, color: dark ? "rgba(255,255,255,.55)" : "rgba(0,0,0,.45)" }}>
          {icon}<span className="max-md:hidden">{label}</span><span className="hidden max-md:inline">{short}</span>
        </span>
      ))}
    </div>
  );

  const PayButton = ({ onClick, disabled, text, className: cls }) => (
    <button onClick={onClick} disabled={disabled} className={`w-full py-4 max-desktop:py-3.5 max-md:py-[13px] rounded-xl max-md:rounded-[10px] text-base font-semibold border-none cursor-pointer transition-[transform,box-shadow] duration-200 hover:translate-y-[-1px] hover:shadow-[0_6px_20px_rgba(196,125,142,.31)] ${cls || ""}`} style={{ background: valid ? "linear-gradient(135deg,#c47d8e,#8b5e6b)" : (dark ? "rgba(255,255,255,.16)" : "rgba(0,0,0,.12)"), color: valid ? "#fff" : t.textMuted }}>
      {text}
    </button>
  );

  const paymentNotice = paymentStatus && typeof paymentStatus === "object" && paymentStatus.type !== "success"
    ? paymentStatus
    : null;
  const paymentNoticeTone = paymentNotice?.type === "info" ? {
    title: "Verifying payment",
    color: dark ? "#a5b4fc" : "#4f46e5",
    background: dark ? "linear-gradient(135deg, rgba(99,102,241,.12), rgba(99,102,241,.04))" : "linear-gradient(135deg, rgba(79,70,229,.08), rgba(79,70,229,.02))",
    border: dark ? "rgba(165,180,252,.2)" : "rgba(79,70,229,.16)",
    symbol: "…",
  } : paymentNotice?.type === "warning" ? {
    title: paymentNotice.paymentState === PAYMENT_STATES.PROVIDER_PENDING ? "Payment pending" : "Verification delayed",
    color: dark ? "#fcd34d" : "#d97706",
    background: dark ? "linear-gradient(135deg, rgba(245,158,11,.12), rgba(245,158,11,.04))" : "linear-gradient(135deg, rgba(217,119,6,.08), rgba(217,119,6,.02))",
    border: dark ? "rgba(252,211,77,.2)" : "rgba(217,119,6,.16)",
    symbol: "!",
  } : {
    title: "Payment unsuccessful",
    color: dark ? "#fca5a5" : "#dc2626",
    background: dark ? "linear-gradient(135deg, rgba(239,68,68,.10), rgba(239,68,68,.04))" : "linear-gradient(135deg, rgba(220,38,38,.07), rgba(220,38,38,.02))",
    border: dark ? "rgba(252,165,165,.18)" : "rgba(220,38,38,.15)",
    symbol: "×",
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
          <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 text-sm font-bold" style={{
            background: `${paymentNoticeTone.color}18`, color: paymentNoticeTone.color,
          }}>
            {paymentNoticeTone.symbol}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[12px] font-semibold" style={{ color: paymentNoticeTone.color }}>{paymentNoticeTone.title} <span className="font-normal opacity-75">— {paymentNotice.message}</span></div>
          </div>
          <button onClick={() => setPaymentStatus(null)} className="bg-transparent border-none cursor-pointer p-1 rounded-md shrink-0" style={{ color: paymentNoticeTone.color, opacity: .45 }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
      )}

      <div className="pb-3.5 max-md:pb-2">
        <div className="text-[22px] max-desktop:text-lg font-semibold mb-0.5" style={{ color: t.text }}>Wallet</div>
        <div className="text-[15px] max-md:text-sm" style={{ color: t.textMuted }}>Top up your balance to place orders</div>
        <div className="page-divider" style={{ background: t.cardBorder }} />
      </div>

      {/* ═══ DESKTOP + TABLET: side by side ═══ */}
      <div className="flex flex-col flex-1 max-md:!hidden">
        {/* Balance hero */}
        <div className="mb-4 overflow-hidden rounded-[14px]" style={{ background: dark ? "rgba(255,255,255,.09)" : "rgba(255,255,255,.85)", border: `0.5px solid ${t.cardBorder}` }}>
          <div className="h-[52px]" style={{ background: "linear-gradient(135deg, #c47d8e 0%, #a3586b 50%, #8b5e6b 100%)" }} />
          <div className="px-5 pb-4 -mt-5">
            <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 shadow-lg border-[3px] mb-2.5" style={{ background: "linear-gradient(135deg, #c47d8e, #8b5e6b)", borderColor: dark ? "#0e1225" : "#f3f0ec" }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
            </div>
            <div className="flex items-baseline justify-between">
              <div className="text-[11px] uppercase tracking-[1.5px]" style={{ color: t.textMuted }}>Current Balance</div>
              <div className="text-[28px] font-bold" style={{ color: t.green }}>{fN(balance)}</div>
            </div>
            {lastFunded && <div className="text-[11px] mt-1" style={{ color: t.textMuted }}>Last funded {fD(lastFunded.date, true)}</div>}
            {pendingDeposits.length > 0 && (() => {
              const awaitingTx = pendingDeposits.find(tx => tx.awaitingConfirmation);
              return (
                <div className="flex items-center gap-1.5 mt-2 py-2.5 px-2.5 rounded-lg text-[12px]" style={{ background: dark ? "rgba(252,211,77,.06)" : "rgba(217,119,6,.04)", border: `1px solid ${dark ? "rgba(252,211,77,.14)" : "rgba(217,119,6,.1)"}`, color: dark ? "#fcd34d" : "#d97706" }}>
                  <div className="w-1.5 h-1.5 rounded-full animate-pulse shrink-0" style={{ background: dark ? "#fcd34d" : "#d97706" }} />
                  <span className="flex-1">{pendingSummaryText}</span>
                  {awaitingTx && <button onClick={() => { setConfirmModal(awaitingTx); setSenderName(""); }} className="py-0.5 px-2 rounded-md text-[11px] font-semibold cursor-pointer shrink-0 border-none transition-transform duration-200 hover:-translate-y-px" style={{ background: dark ? "rgba(252,211,77,.15)" : "rgba(217,119,6,.12)", color: dark ? "#fcd34d" : "#d97706" }}>I've paid</button>}
                </div>
              );
            })()}
          </div>
        </div>

        {/* Nitro Points (compact) */}
        <WalletPointsCard rewards={rewards} dark={dark} t={t} onView={() => setPointsOpen(true)} />

        {/* Two columns */}
        <div className="flex gap-4 flex-1 items-stretch">
          {/* LEFT — Amount + Presets + Coupon */}
          <div className="flex-1 min-w-0 flex">
            <div className="flex-1 flex flex-col rounded-[14px] p-[22px]" style={{ background: dark ? "rgba(255,255,255,.09)" : "rgba(255,255,255,.85)", border: `0.5px solid ${t.cardBorder}` }}>
              {amountInput}
              <div className="flex-1" />
              {couponSection}
              <div className="mt-3">
                <AcceptedRow />
              </div>
            </div>
          </div>

          {/* RIGHT — Summary + Method + Pay */}
          <div className="w-[280px] shrink-0 flex">
            <div className="flex-1 flex flex-col rounded-[14px] p-[22px]" style={{ background: dark ? "rgba(255,255,255,.09)" : "rgba(255,255,255,.85)", border: `0.5px solid ${t.cardBorder}` }}>
              {(() => { const wb = welcomeEligible && valid ? bonusForNaira(numAmount) : 0; return (<>
              <div className="flex justify-between mb-3.5 text-[15px]"><span style={{ color: t.textMuted }}>Deposit</span><span style={{ color: valid ? t.text : t.textMuted, fontWeight: 600 }}>{valid ? fN(numAmount) : "₦0"}</span></div>
              <div className="flex justify-between mb-3.5 text-[15px]"><span style={{ color: t.textMuted }}>Fee</span><span style={{ color: t.green, fontWeight: 600 }}>Free</span></div>
              {couponApplied && discount > 0 && (
                <div className="flex justify-between mb-3.5 text-[15px]"><span style={{ color: t.textMuted }}>Coupon bonus</span><span style={{ color: dark ? "#6ee7b7" : "#059669", fontWeight: 600 }}>+{fN(discount / 100)}</span></div>
              )}
              {wb > 0 && (
                <div className="flex justify-between mb-3.5 text-[15px]"><span style={{ color: t.textMuted }}>Welcome bonus</span><span style={{ color: dark ? "#6ee7b7" : "#059669", fontWeight: 600 }}>+₦{wb.toLocaleString()}</span></div>
              )}
              <div className="h-px my-1 mb-3.5" style={{ background: t.cardBorder }} />
              <div className="flex justify-between items-baseline mb-7">
                <span className="text-[11px] font-semibold uppercase tracking-[1.5px]" style={{ color: t.textMuted }}>{(couponApplied && discount > 0) || wb > 0 ? "Wallet credit" : "Total"}</span>
                <span className="text-[28px] font-bold" style={{ color: valid ? t.accent : t.textMuted }}>{valid ? fN(numAmount + (discount > 0 ? discount / 100 : 0) + wb) : "—"}</span>
              </div>
              </>); })()}

              <div className="text-[11px] font-semibold uppercase tracking-[1px] mb-1.5" style={{ color: t.textMuted }}>Payment method</div>
              {gatewaysLoading ? (
                <div className={`skel-bone h-[42px] rounded-[10px] ${dark ? "skel-dark" : "skel-light"}`} />
              ) : (
                <div className="flex flex-col gap-1">
                  {gateways.map(g => { const sel = method === g.id; const meta = GW_META[g.id] || {}; return (
                    <button key={g.id} onClick={() => setMethod(g.id)} className="w-full flex items-center gap-2 py-2.5 px-2.5 rounded-lg text-left cursor-pointer transition-all duration-150" style={{ background: sel ? `linear-gradient(135deg, ${dark ? "rgba(196,125,142,.18)" : "rgba(196,125,142,.12)"}, ${dark ? "rgba(196,125,142,.06)" : "rgba(196,125,142,.03)"})` : "transparent", border: `1.5px solid ${sel ? t.accent : t.cardBorder}`, fontFamily: "inherit" }}>
                      <div className="w-7 h-7 rounded-md flex items-center justify-center shrink-0" style={{ background: sel ? (dark ? "rgba(196,125,142,.25)" : "rgba(196,125,142,.18)") : (dark ? "rgba(255,255,255,.08)" : "rgba(0,0,0,.04)") }}>
                        {g.id === "flutterwave" ? <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={sel ? (dark ? "#e8b4c0" : "#a05468") : t.textSoft} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg> : g.id === "crypto" ? <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={sel ? (dark ? "#e8b4c0" : "#a05468") : t.textSoft} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11.767 19.089c4.924.868 6.14-6.025 1.216-6.894m-1.216 6.894L5.86 18.047m5.908 1.042-.347 1.97m1.563-8.864c4.924.869 6.14-6.025 1.215-6.893m-1.215 6.893-6.083-1.072m6.083 1.072.347-1.969M7.116 16.676l-2.576-.454M9.21 4.835l-.347 1.97m0 0-2.576-.455"/></svg> : <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={sel ? (dark ? "#e8b4c0" : "#a05468") : t.textSoft} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 21h18M3 10h18M5 6l7-3 7 3M4 10v11M20 10v11M8 14v3M12 14v3M16 14v3"/></svg>}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[12px] font-semibold leading-tight" style={{ color: sel ? t.accent : t.text }}>{g.name}</div>
                        {meta.desc && <div className="text-[10px] leading-tight" style={{ color: t.textMuted }}>{meta.desc}</div>}
                      </div>
                      {sel ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={t.accent} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg> : meta.speed ? <span className="text-[9px] font-medium py-px px-1.5 rounded" style={{ background: dark ? "rgba(255,255,255,.08)" : "rgba(0,0,0,.04)", color: t.textMuted }}>{meta.speed}</span> : null}
                    </button>
                  ); })}
                </div>
              )}

              <div className="flex-1 min-h-4" />

              <PayButton onClick={handlePay} disabled={!valid || loading} text={loading ? "Processing..." : valid ? `Pay ${fN(numAmount)} Now` : "Enter an amount"} />
              <div className="flex items-center justify-center gap-1.5 mt-2.5 text-xs" style={{ color: t.textMuted }}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
                Encrypted & secure
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ═══ MOBILE: two-step flow ═══ */}
      <div className="hidden max-md:!block">
        {mobileStep === 1 && (
          <>
            {/* Balance hero */}
            <div className="mb-3 overflow-hidden rounded-xl" style={{ background: dark ? "rgba(255,255,255,.09)" : "rgba(255,255,255,.85)", border: `0.5px solid ${t.cardBorder}` }}>
              <div className="h-11" style={{ background: "linear-gradient(135deg, #c47d8e 0%, #a3586b 50%, #8b5e6b 100%)" }} />
              <div className="px-4 pb-3.5 -mt-4">
                <div className="w-9 h-9 rounded-[10px] flex items-center justify-center shrink-0 shadow-md border-[2.5px] mb-2" style={{ background: "linear-gradient(135deg, #c47d8e, #8b5e6b)", borderColor: dark ? "#0e1225" : "#f3f0ec" }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
                </div>
                <div className="flex items-baseline justify-between">
                  <div className="text-[11px] uppercase tracking-[1.5px]" style={{ color: t.textMuted }}>Current Balance</div>
                  <div className="text-[22px] font-semibold" style={{ color: t.green }}>{fN(balance)}</div>
                </div>
                {pendingDeposits.length > 0 && (() => {
                  const awaitingTx = pendingDeposits.find(tx => tx.awaitingConfirmation);
                  return (
                    <div className="flex items-center gap-1.5 mt-1.5 py-2 px-2 rounded-lg text-[11px]" style={{ background: dark ? "rgba(252,211,77,.06)" : "rgba(217,119,6,.04)", border: `1px solid ${dark ? "rgba(252,211,77,.14)" : "rgba(217,119,6,.1)"}`, color: dark ? "#fcd34d" : "#d97706" }}>
                      <div className="w-1.5 h-1.5 rounded-full animate-pulse shrink-0" style={{ background: dark ? "#fcd34d" : "#d97706" }} />
                      <span className="flex-1">{pendingSummaryText}</span>
                      {awaitingTx && <button onClick={() => { setConfirmModal(awaitingTx); setSenderName(""); }} className="py-0.5 px-2 rounded-md text-[11px] font-semibold cursor-pointer shrink-0 border-none" style={{ background: dark ? "rgba(252,211,77,.15)" : "rgba(217,119,6,.12)", color: dark ? "#fcd34d" : "#d97706" }}>I've paid</button>}
                    </div>
                  );
                })()}
              </div>
            </div>

            {/* Nitro Points (compact) */}
            <WalletPointsCard rewards={rewards} dark={dark} t={t} onView={() => setPointsOpen(true)} />

            {/* Amount card */}
            <div className="rounded-xl p-4" style={{ background: dark ? "rgba(255,255,255,.09)" : "rgba(255,255,255,.85)", border: `0.5px solid ${t.cardBorder}` }}>
              {amountInput}
              {couponSection}
              <PayButton onClick={() => { if (valid) setMobileStep(2); }} disabled={!valid} text={valid ? "Proceed →" : "Enter amount"} className="mt-2" />
              <AcceptedRow centered />
            </div>
          </>
        )}

        {mobileStep === 2 && (
          <>
            {/* Back button */}
            <button onClick={() => setMobileStep(1)} className="flex items-center gap-1.5 bg-transparent border-none text-sm font-medium cursor-pointer pb-3 transition-transform duration-200 hover:-translate-y-px" style={{ color: t.textMuted, fontFamily: "inherit" }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6"/></svg>
              Back
            </button>

            {/* Summary + Payment method — single card */}
            <div className="rounded-xl py-3.5 px-4 mb-2.5" style={{ background: dark ? "rgba(255,255,255,.09)" : "rgba(255,255,255,.85)", border: `0.5px solid ${t.cardBorder}` }}>
              {(() => { const wb = welcomeEligible ? bonusForNaira(numAmount) : 0; return (<>
              <div className="flex justify-between mb-2.5 text-sm"><span style={{ color: t.textMuted }}>Deposit</span><span style={{ color: t.text, fontWeight: 600 }}>{fN(numAmount)}</span></div>
              <div className="flex justify-between mb-2.5 text-sm"><span style={{ color: t.textMuted }}>Fee</span><span style={{ color: t.green, fontWeight: 600 }}>Free</span></div>
              {couponApplied && discount > 0 && (
                <div className="flex justify-between mb-2.5 text-sm"><span style={{ color: t.textMuted }}>Coupon ({couponApplied.code})</span><span style={{ color: dark ? "#6ee7b7" : "#059669", fontWeight: 600 }}>+{fN(discount / 100)} bonus</span></div>
              )}
              {wb > 0 && (
                <div className="flex justify-between mb-2.5 text-sm"><span style={{ color: t.textMuted }}>Welcome bonus</span><span style={{ color: dark ? "#6ee7b7" : "#059669", fontWeight: 600 }}>+₦{wb.toLocaleString()}</span></div>
              )}
              <div className="flex justify-between items-center mb-3">
                <span className="text-[11px] font-semibold uppercase tracking-[1.5px]" style={{ color: t.textMuted }}>{(couponApplied && discount > 0) || wb > 0 ? "Wallet credit" : "Total"}</span>
                <span className="text-lg font-semibold" style={{ color: t.accent }}>{fN(numAmount + (discount > 0 ? discount / 100 : 0) + wb)}</span>
              </div>
              </>); })()}
              <div className="h-px mb-3" style={{ background: t.cardBorder }} />
              <div className="text-[11px] font-semibold uppercase tracking-[1px] mb-1.5" style={{ color: t.textMuted }}>Payment method</div>
              {gateways.length > 0 ? (
                <div className="flex flex-col gap-1">
                  {gateways.map(g => { const sel = method === g.id; const meta = GW_META[g.id] || {}; return (
                    <button key={g.id} onClick={() => setMethod(g.id)} className="w-full flex items-center gap-2 py-2.5 px-2.5 rounded-lg text-left cursor-pointer transition-all duration-150" style={{ background: sel ? `linear-gradient(135deg, ${dark ? "rgba(196,125,142,.18)" : "rgba(196,125,142,.12)"}, ${dark ? "rgba(196,125,142,.06)" : "rgba(196,125,142,.03)"})` : "transparent", border: `1.5px solid ${sel ? t.accent : t.cardBorder}`, fontFamily: "inherit" }}>
                      <div className="w-7 h-7 rounded-md flex items-center justify-center shrink-0" style={{ background: sel ? (dark ? "rgba(196,125,142,.25)" : "rgba(196,125,142,.18)") : (dark ? "rgba(255,255,255,.08)" : "rgba(0,0,0,.04)") }}>
                        {g.id === "flutterwave" ? <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={sel ? (dark ? "#e8b4c0" : "#a05468") : t.textSoft} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg> : g.id === "crypto" ? <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={sel ? (dark ? "#e8b4c0" : "#a05468") : t.textSoft} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11.767 19.089c4.924.868 6.14-6.025 1.216-6.894m-1.216 6.894L5.86 18.047m5.908 1.042-.347 1.97m1.563-8.864c4.924.869 6.14-6.025 1.215-6.893m-1.215 6.893-6.083-1.072m6.083 1.072.347-1.969M7.116 16.676l-2.576-.454M9.21 4.835l-.347 1.97m0 0-2.576-.455"/></svg> : <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={sel ? (dark ? "#e8b4c0" : "#a05468") : t.textSoft} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 21h18M3 10h18M5 6l7-3 7 3M4 10v11M20 10v11M8 14v3M12 14v3M16 14v3"/></svg>}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[12px] font-semibold leading-tight" style={{ color: sel ? t.accent : t.text }}>{g.name}</div>
                        {meta.desc && <div className="text-[10px] leading-tight" style={{ color: t.textMuted }}>{meta.desc}</div>}
                      </div>
                      {sel ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={t.accent} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg> : meta.speed ? <span className="text-[9px] font-medium py-px px-1.5 rounded" style={{ background: dark ? "rgba(255,255,255,.08)" : "rgba(0,0,0,.04)", color: t.textMuted }}>{meta.speed}</span> : null}
                    </button>
                  ); })}
                </div>
              ) : (
                <div className="py-3 text-center text-sm" style={{ color: t.textMuted }}>No payment methods available</div>
              )}
              <PayButton onClick={handlePay} disabled={loading} text={loading ? "Processing..." : `Pay ${fN(numAmount)} Now`} className="mt-3" />
              <div className="flex items-center justify-center gap-1.5 mt-2.5 text-xs" style={{ color: t.textMuted }}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
                Encrypted & secure
              </div>
            </div>
          </>
        )}
      </div>

      {/* ═══ CRYPTO PAYMENT MODAL ═══ */}
      {cryptoModal && (
        <div onClick={() => { if (cryptoIsTerminal) { stopCryptoPolling(); setCryptoModal(null); } }} onKeyDown={e=>{if(e.key==='Escape'&&cryptoIsTerminal){stopCryptoPolling();setCryptoModal(null)}}} className="fixed inset-0 z-50 flex items-center justify-center p-6 backdrop-blur-[4px] animate-[modalFadeIn_.2s_ease]" style={{ background: "rgba(0,0,0,.45)" }}>
          <div role="dialog" aria-modal="true" aria-label="Crypto payment" onClick={e => e.stopPropagation()} className="w-full max-w-[420px] rounded-2xl p-6 animate-[modalBounceIn_.3s_cubic-bezier(.34,1.56,.64,1)_both]" style={{ background: dark ? "#0e1120" : "#fff", border: `1px solid ${dark ? "rgba(255,255,255,.22)" : "rgba(0,0,0,.14)"}`, boxShadow: dark ? "0 20px 60px rgba(0,0,0,.4)" : "0 20px 60px rgba(0,0,0,.1)" }}>
            {cryptoPresentation.kind === "credited" ? (
              <>
                <div className="text-center py-5">
                  <div className="mb-3 flex justify-center"><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke={dark ? "#6ee7b7" : "#059669"} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg></div>
                  <div className="text-lg font-semibold mb-1.5" style={{ color: t.text }}>{cryptoPresentation.title}</div>
                  <div className="text-sm" style={{ color: t.textMuted }}>{fN(cryptoResult?.amount ?? cryptoModal.amountNgn)} has been added to your wallet</div>
                </div>
                <div className="flex max-md:flex-col gap-3">
                  <button onClick={() => { stopCryptoPolling(); setCryptoModal(null); window.location.reload(); }} className="flex-1 py-3 rounded-[10px] bg-transparent text-[15px] font-medium cursor-pointer transition-transform duration-200 hover:-translate-y-px" style={{ border: `1px solid ${t.cardBorder}`, color: t.text, fontFamily: "inherit" }}>Done</button>
                  {onPlaceOrder && <button onClick={() => { stopCryptoPolling(); setCryptoModal(null); onPlaceOrder(); }} className="flex-1 py-3 rounded-[10px] border-none bg-gradient-to-br from-[#c47d8e] to-[#8b5e6b] text-white text-[15px] font-semibold cursor-pointer transition-[transform,box-shadow] duration-200 hover:-translate-y-px hover:shadow-[0_6px_20px_rgba(196,125,142,.31)]" style={{ fontFamily: "inherit" }}>Place an order</button>}
                </div>
              </>
            ) : cryptoPresentation.kind === "review" ? (
              <>
                <div className="text-center py-5">
                  <div className="mb-3 flex justify-center"><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke={dark ? "#fcd34d" : "#d97706"} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg></div>
                  <div className="text-lg font-semibold mb-1.5" style={{ color: t.text }}>{cryptoPresentation.title}</div>
                  <div className="text-sm leading-normal" style={{ color: t.textMuted }}>{cryptoPresentation.message}</div>
                  {cryptoResult?.reference && <div className="m text-[11px] mt-3 break-all" style={{ color: t.textMuted }}>Reference: {cryptoResult.reference}</div>}
                </div>
                <button onClick={() => { stopCryptoPolling(); setCryptoModal(null); onRefresh?.(); }} className="w-full py-3 rounded-[10px] bg-transparent text-[15px] font-medium cursor-pointer transition-transform duration-200 hover:-translate-y-px" style={{ border: `1px solid ${t.cardBorder}`, color: t.text, fontFamily: "inherit" }}>Close</button>
              </>
            ) : cryptoPresentation.kind === "failed" ? (
              <>
                <div className="text-center py-5">
                  <div className="mb-3 flex justify-center"><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke={dark ? "#fca5a5" : "#dc2626"} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg></div>
                  <div className="text-lg font-semibold mb-1.5" style={{ color: t.text }}>{cryptoPresentation.title}</div>
                  <div className="text-sm leading-normal" style={{ color: t.textMuted }}>{cryptoPresentation.message}</div>
                </div>
                <button onClick={() => { stopCryptoPolling(); setCryptoModal(null); onRefresh?.(); }} className="w-full py-3 rounded-[10px] bg-transparent text-[15px] font-medium cursor-pointer transition-transform duration-200 hover:-translate-y-px" style={{ border: `1px solid ${t.cardBorder}`, color: t.text, fontFamily: "inherit" }}>Try another method</button>
              </>
            ) : (
              <>
                <div className="text-base font-semibold mb-1" style={{ color: t.text }}>Send USDT (TRC-20)</div>
                <div className="text-[13px] mb-4" style={{ color: t.textMuted }}>Send exactly the amount below to this address</div>

                <div className="p-3.5 rounded-[10px] mb-3 text-center" style={{ background: dark ? "rgba(255,255,255,.12)" : "rgba(0,0,0,.04)", border: `1px solid ${t.cardBorder}` }}>
                  <div className="text-[11px] font-semibold uppercase tracking-[1px] mb-1" style={{ color: t.textMuted }}>Amount to send</div>
                  <div className="m text-[28px] font-bold" style={{ color: dark ? "#6ee7b7" : "#059669" }}>{cryptoModal.payAmount} USDT</div>
                  <div className="text-xs mt-0.5" style={{ color: t.textMuted }}>≈ ${cryptoModal.amountUsd} USD · {fN(cryptoModal.amountNgn)}</div>
                </div>

                <div className="mb-3">
                  <div className="text-[11px] font-semibold uppercase tracking-[1px] mb-1" style={{ color: t.textMuted }}>TRC-20 Address</div>
                  <div className="py-2.5 px-3 rounded-lg text-xs leading-normal break-all" style={{ background: dark ? "#131728" : "#f8f8f8", border: `1px solid ${t.cardBorder}`, color: t.text, fontFamily: "'JetBrains Mono',monospace" }}>
                    {cryptoModal.payAddress}
                  </div>
                  <button onClick={() => { navigator.clipboard.writeText(cryptoModal.payAddress); }} className="mt-1.5 py-1.5 px-3.5 rounded-md bg-transparent text-xs font-semibold cursor-pointer transition-transform duration-200 hover:-translate-y-px" style={{ border: `1px solid ${t.accent}`, color: t.accent, fontFamily: "inherit" }}>Copy address</button>
                </div>

                <div className="py-2.5 px-3.5 rounded-lg mb-3.5" style={{ background: dark ? "rgba(251,191,36,.08)" : "rgba(217,119,6,.06)", border: `1px solid ${dark ? "rgba(251,191,36,.18)" : "rgba(217,119,6,.14)"}` }}>
                  <div className="flex items-center gap-2">
                    {cryptoPolling && <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: "#fbbf24" }} />}
                    <span className="text-[13px] font-medium" style={{ color: dark ? "#fbbf24" : "#d97706" }}>
                      {cryptoStatus === "Confirming" ? "Payment detected — confirming on blockchain..." : "Waiting for payment..."}
                    </span>
                  </div>
                  <div className="text-[11px] mt-1" style={{ color: t.textMuted }}>We check automatically every 15 seconds. Do not close this page.</div>
                </div>

                <button onClick={async () => { stopCryptoPolling(); try { await fetch("/api/payments/crypto", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reference: cryptoModal.reference }) }); } catch {} setCryptoModal(null); onRefresh?.(); }} className="w-full py-2.5 rounded-lg bg-transparent text-sm font-medium cursor-pointer transition-transform duration-200 hover:-translate-y-px" style={{ border: `1px solid ${t.cardBorder}`, color: t.textMuted, fontFamily: "inherit" }}>Cancel</button>
              </>
            )}
          </div>
        </div>
      )}

      {/* ═══ MANUAL BANK TRANSFER MODAL ═══ */}
      {manualModal && (
        <div onClick={() => { if (manualDone) setManualModal(null); }} onKeyDown={e=>{if(e.key==='Escape'&&manualDone)setManualModal(null)}} className="fixed inset-0 z-50 flex items-center justify-center p-6 backdrop-blur-[4px] animate-[modalFadeIn_.2s_ease]" style={{ background: "rgba(0,0,0,.45)" }}>
          <div role="dialog" aria-modal="true" aria-label="Bank transfer" onClick={e => e.stopPropagation()} className="w-full max-w-[420px] rounded-2xl p-6 animate-[modalBounceIn_.3s_cubic-bezier(.34,1.56,.64,1)_both]" style={{ background: dark ? "#0e1120" : "#fff", border: `1px solid ${dark ? "rgba(255,255,255,.22)" : "rgba(0,0,0,.14)"}`, boxShadow: dark ? "0 20px 60px rgba(0,0,0,.4)" : "0 20px 60px rgba(0,0,0,.1)" }}>
            {manualDone ? (
              <>
                <div className="text-center py-5">
                  <div className="mb-3 flex justify-center"><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke={dark ? "#6ee7b7" : "#059669"} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg></div>
                  <div className="text-lg font-semibold mb-1.5" style={{ color: t.text }}>Transfer Submitted</div>
                  <div className="text-sm leading-normal" style={{ color: t.textMuted }}>We'll verify your payment and credit your wallet. This may take 15-60 minutes during business hours.</div>
                </div>
                <div className="flex max-md:flex-col gap-3">
                  <button onClick={() => setManualModal(null)} className="flex-1 py-3 rounded-[10px] bg-transparent text-[15px] font-medium cursor-pointer transition-transform duration-200 hover:-translate-y-px" style={{ border: `1px solid ${t.cardBorder}`, color: t.text, fontFamily: "inherit" }}>Done</button>
                  {onPlaceOrder && <button onClick={() => { setManualModal(null); onPlaceOrder(); }} className="flex-1 py-3 rounded-[10px] border-none bg-gradient-to-br from-[#c47d8e] to-[#8b5e6b] text-white text-[15px] font-semibold cursor-pointer transition-[transform,box-shadow] duration-200 hover:-translate-y-px hover:shadow-[0_6px_20px_rgba(196,125,142,.31)]" style={{ fontFamily: "inherit" }}>Place an order</button>}
                </div>
              </>
            ) : (
              <>
                <div className="text-base font-semibold mb-1" style={{ color: t.text }}>{manualStep === "confirm" ? "Confirm Transfer" : "Bank Transfer"}</div>
                <div className="text-[13px] mb-2" style={{ color: t.textMuted }}>{manualStep === "confirm" ? "Enter the name on the bank account you sent from" : "Transfer this exact amount to the account below"}</div>

                {manualStep === "details" ? (
                  <>
                    <div className="flex items-center justify-between py-2 px-3 rounded-lg mb-2.5" style={{ background: dark ? "rgba(110,231,183,.06)" : "rgba(5,150,105,.04)", border: `1px solid ${dark ? "rgba(110,231,183,.15)" : "rgba(5,150,105,.1)"}` }}>
                      <span className="m text-lg font-bold" style={{ color: dark ? "#6ee7b7" : "#059669" }}>{fN(manualModal.amount)}</span>
                      <button onClick={() => navigator.clipboard.writeText(String(manualModal.amount))} className="py-[3px] px-2.5 rounded-md bg-transparent text-[11px] font-semibold cursor-pointer transition-transform duration-200 hover:-translate-y-px" style={{ border: `1px solid ${dark ? "rgba(110,231,183,.3)" : "rgba(5,150,105,.2)"}`, color: dark ? "#6ee7b7" : "#059669", fontFamily: "inherit" }}>Copy</button>
                    </div>

                    <div className="rounded-xl mb-3 overflow-hidden" style={{ border: `1px solid ${t.cardBorder}` }}>
                      <div className="p-3.5" style={{ background: dark ? "rgba(255,255,255,.04)" : "transparent" }}>
                        <div className="mb-2.5">
                          <div className="text-[11px] font-semibold uppercase tracking-[1px] mb-0.5" style={{ color: t.textMuted }}>Bank</div>
                          <div className="text-[15px] font-semibold" style={{ color: t.text }}>{manualModal.bankName}</div>
                        </div>
                        <div className="mb-2.5">
                          <div className="text-[11px] font-semibold uppercase tracking-[1px] mb-0.5" style={{ color: t.textMuted }}>Account Number</div>
                          <div className="flex items-center gap-2">
                            <span className="m text-lg font-bold tracking-[1px]" style={{ color: t.text }}>{manualModal.accountNumber}</span>
                            <button onClick={() => navigator.clipboard.writeText(manualModal.accountNumber)} className="py-[3px] px-2.5 rounded-md bg-transparent text-[11px] font-semibold cursor-pointer transition-transform duration-200 hover:-translate-y-px" style={{ border: `1px solid ${t.accent}`, color: t.accent, fontFamily: "inherit" }}>Copy</button>
                          </div>
                        </div>
                        <div>
                          <div className="text-[11px] font-semibold uppercase tracking-[1px] mb-0.5" style={{ color: t.textMuted }}>Account Name</div>
                          <div className="text-[15px] font-semibold" style={{ color: t.text }}>{manualModal.accountName}</div>
                        </div>
                      </div>
                    </div>

                    <div className="py-2 px-3 rounded-lg mb-3.5 text-xs leading-normal" style={{ background: dark ? "rgba(251,191,36,.06)" : "rgba(217,119,6,.04)", border: `1px solid ${dark ? "rgba(251,191,36,.14)" : "rgba(217,119,6,.1)"}`, color: dark ? "#fbbf24" : "#d97706" }}>
                      Verification takes 15-60 minutes during business hours.
                    </div>

                    <div className="flex gap-2">
                      <button onClick={async () => { try { await fetch("/api/payments/manual", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reference: manualModal.reference }) }); } catch {} setManualModal(null); onRefresh?.(); }} className="flex-1 py-2.5 rounded-lg bg-transparent text-sm font-medium cursor-pointer transition-transform duration-200 hover:-translate-y-px" style={{ border: `1px solid ${t.cardBorder}`, color: t.textMuted, fontFamily: "inherit" }}>Cancel</button>
                      <button onClick={() => setManualStep("confirm")} className="flex-1 py-2.5 rounded-lg border-none bg-gradient-to-br from-[#c47d8e] to-[#8b5e6b] text-white text-sm font-semibold cursor-pointer transition-[transform,box-shadow] duration-200 hover:-translate-y-px hover:shadow-[0_6px_20px_rgba(196,125,142,.31)]" style={{ fontFamily: "inherit" }}>I've sent the money</button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="mb-3">
                      <label className="text-[11px] font-semibold uppercase tracking-[1px] mb-1.5 block" style={{ color: t.textMuted }}>Sender / Account Name</label>
                      <input type="text" aria-label="Sender account name" value={manualRef} onChange={e => setManualRef(e.target.value)} placeholder="e.g. John Doe" autoFocus className="w-full py-2.5 px-3.5 rounded-lg text-sm font-medium outline-none" style={{ background: dark ? "rgba(255,255,255,.06)" : "rgba(0,0,0,.04)", border: `1.5px solid ${manualRef.trim().length >= 3 ? (dark ? "rgba(110,231,183,.4)" : "rgba(5,150,105,.3)") : t.cardBorder}`, color: t.text, fontFamily: "inherit", transition: "border-color .2s" }} />
                      <div className="text-[11px] mt-1.5" style={{ color: t.textMuted }}>The name on the bank account you transferred from</div>
                    </div>

                    <div className="py-2 px-3 rounded-lg mb-3 flex items-center justify-between" style={{ background: dark ? "rgba(255,255,255,.04)" : "rgba(0,0,0,.02)", border: `1px solid ${t.cardBorder}` }}>
                      <span className="text-xs" style={{ color: t.textMuted }}>Amount</span>
                      <span className="m text-sm font-bold" style={{ color: dark ? "#6ee7b7" : "#059669" }}>{fN(manualModal.amount)}</span>
                    </div>

                    <div className="flex gap-2">
                      <button onClick={() => setManualStep("details")} className="flex-1 py-2.5 rounded-lg bg-transparent text-sm font-medium cursor-pointer transition-transform duration-200 hover:-translate-y-px" style={{ border: `1px solid ${t.cardBorder}`, color: t.textMuted, fontFamily: "inherit" }}>Back</button>
                      <button onClick={async () => {
                        if (manualRef.trim().length < 3) { toast.warning("Name required", "Enter the name on the account you sent from"); return; }
                        setManualSubmitting(true);
                        try {
                          const res = await fetch("/api/payments/manual", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reference: manualModal.reference, senderRef: manualRef.trim() }) });
                          if (res.ok) setManualDone(true);
                          else { const d = await res.json(); toast.error("Failed", d.error || "Something went wrong"); }
                        } catch { toast.error("Network error", "Check your connection"); }
                        setManualSubmitting(false);
                      }} disabled={manualSubmitting || manualRef.trim().length < 3} className="flex-1 py-2.5 rounded-lg border-none text-white text-sm font-semibold cursor-pointer transition-[transform,box-shadow] duration-200 hover:-translate-y-px hover:shadow-[0_6px_20px_rgba(196,125,142,.31)]" style={{ fontFamily: "inherit", opacity: manualSubmitting || manualRef.trim().length < 3 ? .5 : 1, background: "linear-gradient(135deg,#c47d8e,#8b5e6b)" }}>{manualSubmitting ? "Submitting..." : "Confirm"}</button>
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* ═══ WALLET HISTORY ═══ */}
      <WalletHistory txs={txs} initialTotal={transactionsTotal} walletSummary={walletSummary} dark={dark} t={t} onRefresh={onRefresh} setConfirmModal={setConfirmModal} setSenderName={setSenderName} />

      {/* ═══ CONFIRM PAYMENT MODAL ═══ */}
      {confirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 backdrop-blur-[4px] animate-[modalFadeIn_.2s_ease]" onClick={() => !confirmLoading && setConfirmModal(null)} style={{ background: "rgba(0,0,0,.45)" }}>
          <div className="w-full max-w-[420px] rounded-2xl overflow-hidden animate-[modalBounceIn_.3s_cubic-bezier(.34,1.56,.64,1)_both]" style={{ background: dark ? "#0e1120" : "#fff", border: `1px solid ${dark ? "rgba(255,255,255,.22)" : "rgba(0,0,0,.14)"}`, boxShadow: dark ? "0 20px 60px rgba(0,0,0,.4)" : "0 20px 60px rgba(0,0,0,.1)" }} onClick={e => e.stopPropagation()}>
            <div className="h-1.5" style={{ background: "linear-gradient(135deg, #c47d8e, #8b5e6b)" }} />
            <div className="p-5">
              <div className="text-base font-semibold mb-1" style={{ color: t.text }}>Confirm Payment</div>
              <div className="text-[13px] mb-4" style={{ color: t.textMuted }}>You're confirming a deposit of <span className="font-semibold" style={{ color: t.text }}>{fN(confirmModal.amount)}</span></div>
              <label className="text-[12px] font-medium mb-1.5 block" style={{ color: t.textMuted }}>Account name you sent from</label>
              <input value={senderName} onChange={e => setSenderName(e.target.value)} placeholder="e.g. John Doe" autoFocus className="w-full py-2.5 px-3 rounded-lg text-sm outline-none" style={{ background: dark ? "rgba(255,255,255,.07)" : "rgba(0,0,0,.04)", border: `1px solid ${dark ? "rgba(255,255,255,.12)" : "rgba(0,0,0,.08)"}`, color: t.text, fontFamily: "inherit" }} />
              <button onClick={async () => {
                if (!senderName.trim()) return;
                setConfirmLoading(true);
                try {
                  const r = await fetch("/api/payments/manual", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reference: confirmModal.reference, senderRef: senderName.trim() }) });
                  if (r.ok) { toast.success("Payment confirmed", "Your deposit is now awaiting admin verification."); setConfirmModal(null); onRefresh?.(); }
                  else { const d = await r.json().catch(() => ({})); toast.error("Failed", d.error || "Something went wrong"); }
                } catch { toast.error("Network error", "Check your connection"); }
                setConfirmLoading(false);
              }} disabled={confirmLoading || senderName.trim().length < 2} className="w-full py-2.5 mt-3 rounded-lg border-none text-white text-sm font-semibold cursor-pointer transition-[transform,box-shadow] duration-200 hover:-translate-y-px hover:shadow-[0_6px_20px_rgba(196,125,142,.31)]" style={{ fontFamily: "inherit", opacity: confirmLoading || senderName.trim().length < 2 ? .5 : 1, background: "linear-gradient(135deg,#c47d8e,#8b5e6b)" }}>{confirmLoading ? "Confirming..." : "Confirm Payment"}</button>
              <button onClick={async () => {
                setConfirmLoading(true);
                try { await fetch("/api/payments/manual", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reference: confirmModal.reference }) }); } catch {}
                setConfirmModal(null); setConfirmLoading(false); onRefresh?.();
              }} disabled={confirmLoading} className="w-full py-2 mt-2 rounded-lg bg-transparent text-[13px] font-medium cursor-pointer border-none" style={{ color: dark ? "#fca5a5" : "#dc2626", fontFamily: "inherit", opacity: confirmLoading ? .5 : 1 }}>Cancel this deposit</button>
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
function WalletHistory({ txs, initialTotal = txs?.length || 0, walletSummary, dark, t, onRefresh, setConfirmModal, setSenderName }) {
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
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div>
          <div className="text-base desktop:text-lg font-semibold" style={{ color: t.text }}>Wallet History</div>
          <div className="text-[13px]" style={{ color: t.textMuted }}>{total} transaction{total === 1 ? "" : "s"} · last 6 months</div>
        </div>
        <div className="flex gap-1.5 flex-wrap">
          <DateRangePicker dark={dark} t={t} value={dateRange} onChange={(v) => { setDateRange(v); setPage(1); }} />
          <FilterDropdown dark={dark} t={t} value={filter} onChange={(v) => { setFilter(v); setPage(1); }} options={[
            { value: "all", label: "All" },
            ...txTypes.map(f => ({ value: f, label: txLabel(f) })),
          ]} />
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-2 mb-3">
        <div className="py-2.5 px-3 rounded-xl text-center" style={{ background: dark ? "rgba(110,231,183,.06)" : "rgba(5,150,105,.04)", border: `1px solid ${dark ? "rgba(110,231,183,.15)" : "rgba(5,150,105,.1)"}` }}>
          <div className="text-[11px] uppercase tracking-[1px] mb-0.5" style={{ color: t.textMuted }}>Funded</div>
          <div className="m text-[15px] font-bold" style={{ color: dark ? "#6ee7b7" : "#059669" }}>+{fNShort(totalIn)}</div>
        </div>
        <div className="py-2.5 px-3 rounded-xl text-center" style={{ background: dark ? "rgba(252,165,165,.06)" : "rgba(220,38,38,.04)", border: `1px solid ${dark ? "rgba(252,165,165,.15)" : "rgba(220,38,38,.1)"}` }}>
          <div className="text-[11px] uppercase tracking-[1px] mb-0.5" style={{ color: t.textMuted }}>Spent</div>
          <div className="m text-[15px] font-bold" style={{ color: dark ? "#fca5a5" : "#dc2626" }}>-{fNShort(totalOut)}</div>
        </div>
      </div>

      {/* Transaction list */}
      <div className="rounded-xl desktop:rounded-[14px] overflow-hidden" style={{ background: dark ? "rgba(255,255,255,.09)" : "rgba(255,255,255,.85)", border: `0.5px solid ${t.cardBorder}` }}>
        {historyTxs.length > 0 ? historyTxs.map((tx, i) => {
          const statusMeta = txStatusMeta(tx, dark);
          const rowColor = txRowClr(tx, dark);
          return (
            <div key={tx.id} className="flex items-center gap-2.5 desktop:gap-3.5 py-3 px-3.5 desktop:py-3.5 desktop:px-[18px]" style={{ borderBottom: i < historyTxs.length - 1 ? `1px solid ${t.cardBorder}` : "none", background: statusMeta ? `${rowColor}${dark ? "0a" : "08"}` : (tx.orderStatus && !["Completed","Cancelled"].includes(tx.orderStatus)) ? (dark ? "rgba(252,211,77,.04)" : "rgba(217,119,6,.03)") : "transparent" }}>
              <div className="w-8 h-8 desktop:w-9 desktop:h-9 rounded-[10px] flex items-center justify-center text-base font-semibold shrink-0" style={{ background: dark ? `${rowColor}15` : `${rowColor}10`, color: rowColor }}>{txIcon(tx.type)}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm desktop:text-[15px] font-medium overflow-hidden text-ellipsis whitespace-nowrap" style={{ color: t.text }}>{txLabel(tx.type)}</span>
                  {statusMeta && <span className="text-[10px] font-semibold py-px px-1.5 rounded" style={{ background: statusMeta.bg, color: statusMeta.color }}>{statusMeta.label}</span>}
                  {tx.orderStatus && !["Completed", "Cancelled"].includes(tx.orderStatus) && <span className="text-[10px] font-semibold py-px px-1.5 rounded" style={{ background: tx.orderStatus === "Processing" ? (dark ? "rgba(165,180,252,.12)" : "rgba(99,102,241,.08)") : (dark ? "rgba(252,211,77,.12)" : "rgba(217,119,6,.08)"), color: tx.orderStatus === "Processing" ? (dark ? "#a5b4fc" : "#6366f1") : (dark ? "#fcd34d" : "#d97706") }}>{tx.orderStatus}</span>}
                </div>
                <div className="text-[12px] desktop:text-[13px] mt-0.5 overflow-hidden text-ellipsis whitespace-nowrap" style={{ color: t.textMuted }}>{txDesc(tx)}</div>
              </div>
              <div className="text-right shrink-0">
                <div className="m text-[14px] desktop:text-[15px] font-bold" style={{ color: rowColor }}>
                  {txAmountPrefix(tx)}{fN(tx.amount)}
                </div>
                <div className="text-[11px] mt-0.5" style={{ color: t.textMuted }}>{tx.date ? fD(tx.date, true) : ""}</div>
              </div>
            </div>
          );
        }) : (
          <div className="p-10 text-center text-[15px]" style={{ color: t.textMuted }}>
            <div className="text-base font-semibold mb-1" style={{ color: t.textSoft }}>{filter !== "all" || dateRange ? "No matching transactions" : "No transactions in the last 6 months"}</div>
            <div className="text-[15px]" style={{ color: t.textMuted }}>{filter !== "all" || dateRange ? "Try adjusting your filters" : "New wallet activity will appear here"}</div>
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center items-center gap-1.5 mt-3">
          <button onClick={() => setPage(Math.max(1, page - 1))} disabled={page <= 1} className="w-[30px] h-[30px] rounded-md flex items-center justify-center border cursor-pointer bg-transparent" style={{ borderColor: t.cardBorder, color: t.textSoft, opacity: page <= 1 ? .3 : 1 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>
          </button>
          <span className="text-[13px] px-2" style={{ color: t.textMuted }}>{page} / {totalPages}</span>
          <button onClick={() => setPage(Math.min(totalPages, page + 1))} disabled={page >= totalPages} className="w-[30px] h-[30px] rounded-md flex items-center justify-center border cursor-pointer bg-transparent" style={{ borderColor: t.cardBorder, color: t.textSoft, opacity: page >= totalPages ? .3 : 1 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>
          </button>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════ */
/* ═══ ADD FUNDS RIGHT SIDEBAR             ═══ */
/* ═══════════════════════════════════════════ */
export function AddFundsSidebar({ user, txs, dark, t }) {
  const balance = user?.balance || 0;

  return (
    <div className="flex flex-col gap-0">
      <div className="text-[11px] font-semibold uppercase tracking-[1.5px] mb-2 py-1.5 px-2.5 rounded-lg" style={{ color: t.textMuted, background: dark ? "rgba(196,125,142,.1)" : "rgba(196,125,142,.06)" }}>How It Works</div>
      {[["1", "Enter amount"], ["2", "Choose payment method"], ["3", "Pay securely"], ["4", "Balance updated instantly"]].map(([num, title]) => (
        <div key={num} className="flex gap-2.5 mb-2 px-1">
          <div className="w-[22px] h-[22px] rounded-md flex items-center justify-center text-[13px] font-semibold shrink-0" style={{ background: t.navActive, color: t.accent }}>{num}</div>
          <div className="text-sm font-medium pt-0.5" style={{ color: dark ? "rgba(255,255,255,.55)" : "rgba(0,0,0,.55)" }}>{title}</div>
        </div>
      ))}
    </div>
  );
}
