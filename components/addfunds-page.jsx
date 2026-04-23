'use client';
import { useState, useEffect, useRef } from "react";
import { useToast } from "./toast";
import { fN, fD } from "../lib/format";

const PRESETS = [1000, 2000, 5000, 10000, 20000, 50000];

const ACCEPTED_TYPES = [
  { label: "Cards", icon: "💳" },
  { label: "Bank Transfer", icon: "🏦" },
  { label: "Crypto", icon: "₿" },
  { label: "Mobile Money", icon: "📱" },
];

/* ═══════════════════════════════════════════ */
/* ═══ ADD FUNDS PAGE                      ═══ */
/* ═══════════════════════════════════════════ */
export default function AddFundsPage({ user, dark, t, paymentStatus, setPaymentStatus, onPlaceOrder }) {
  const toast = useToast();
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("");
  const [loading, setLoading] = useState(false);
  const [mobileStep, setMobileStep] = useState(1);
  const [gateways, setGateways] = useState([]);
  const [gatewaysLoading, setGatewaysLoading] = useState(true);

  /* Crypto payment modal */
  const [cryptoModal, setCryptoModal] = useState(null);
  const [cryptoStatus, setCryptoStatus] = useState(null);
  const [cryptoPolling, setCryptoPolling] = useState(false);

  /* Manual bank transfer modal */
  const [manualModal, setManualModal] = useState(null);
  const [manualRef, setManualRef] = useState("");
  const [manualSubmitting, setManualSubmitting] = useState(false);
  const [manualDone, setManualDone] = useState(false);

  // Fetch enabled gateways from API
  useEffect(() => {
    fetch("/api/payments/gateways").then(r => r.json()).then(d => {
      const gws = d.gateways || [];
      setGateways(gws);
      if (gws.length > 0 && !method) setMethod(gws[0].id);
      setGatewaysLoading(false);
    }).catch(() => setGatewaysLoading(false));
  }, []);

  const numAmount = Number(amount) || 0;
  const valid = numAmount >= 500;
  const balance = user?.balance || 0;

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
      try {
        const res = await fetch("/api/payments/crypto", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ amount: numAmount, couponId: couponApplied?.couponId || undefined }),
          signal: AbortSignal.timeout(30000),
        });
        const data = await res.json();
        if (data.payAddress) {
          setCryptoModal(data);
          setCryptoStatus("Pending");
          setCryptoPolling(true);
          const poll = setInterval(async () => {
            try {
              const sr = await fetch(`/api/payments/crypto?reference=${data.reference}`);
              if (!sr.ok) return;
              const sd = await sr.json();
              setCryptoStatus(sd.status || sd.npStatus || "Pending");
              if (sd.status === "Completed" || sd.status === "Cancelled") {
                clearInterval(poll);
                setCryptoPolling(false);
                if (sd.status === "Completed" && setPaymentStatus) setPaymentStatus("success");
              }
            } catch {}
          }, 15000);
          setTimeout(() => { clearInterval(poll); setCryptoPolling(false); }, 30 * 60 * 1000);
        } else {
          toast.error("Payment failed", data.error || "Failed to create crypto payment", { position: "bottom" });
        }
      } catch (err) {
        toast.error(err?.name === "TimeoutError" ? "Timed out" : "Network error", "Check your connection", { position: "bottom" });
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
        } else {
          toast.error("Transfer failed", data.error || "Failed to create request", { position: "bottom" });
        }
      } catch { toast.error("Network error", "Check your connection", { position: "bottom" }); }
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
        toast.error("Payment failed", data.error || "Initialization failed", { position: "bottom" });
        setLoading(false); payingRef.current = false;
      }
    } catch (err) {
      toast.error(err?.name === "TimeoutError" ? "Timed out" : "Network error", "Check your connection", { position: "bottom" });
      setLoading(false); payingRef.current = false;
    }
  };

  /* ── Shared sub-components ── */
  const amountInput = (
    <>
      <div className="text-sm font-semibold uppercase tracking-[1px] mb-2.5" style={{ color: t.textSoft }}>Amount to deposit</div>
      <div className="flex items-center gap-1 py-3.5 px-[18px] max-desktop:py-3 max-desktop:px-4 max-md:py-3 max-md:px-3.5 rounded-xl mb-4 max-md:mb-3" style={{ background: dark ? "#0d1020" : "#fff", border: `1px solid ${amount ? t.accent : t.cardBorder}` }}>
        <span className="m text-[26px] max-desktop:text-[22px] max-md:text-xl font-semibold" style={{ color: dark ? "rgba(255,255,255,.55)" : "rgba(0,0,0,.4)" }}>₦</span>
        <input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0" className="m border-none text-[30px] max-desktop:text-[26px] max-md:text-2xl font-semibold w-full outline-none bg-transparent placeholder:opacity-[.12]" style={{ color: t.text }} />
      </div>
      <div className="grid grid-cols-3 gap-2 max-md:gap-1.5 mb-3">
        {PRESETS.map(p => (
          <button key={p} onClick={() => setAmount(String(p))} className="m py-[13px] max-desktop:py-[11px] max-md:py-2.5 rounded-[10px] text-base max-desktop:text-[15px] max-md:text-sm font-semibold text-center cursor-pointer transition-[border-color,background-color,color,transform] duration-150 hover:translate-y-[-1px]" style={{ border: `1px solid ${numAmount === p ? t.accent : t.cardBorder}`, background: numAmount === p ? (dark ? "rgba(196,125,142,.1)" : "rgba(196,125,142,.06)") : "transparent", color: numAmount === p ? t.accent : (dark ? "rgba(255,255,255,.55)" : "rgba(0,0,0,.45)") }}>
            ₦{p >= 1000 ? `${p / 1000}K` : p}
          </button>
        ))}
      </div>
      <div className="min-h-6 mt-2.5 flex items-center">
        {numAmount > 0 && numAmount < 500 && (
          <div className="text-sm font-medium flex items-center gap-1.5" style={{ color: dark ? "#fcd34d" : "#d97706" }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
            Minimum deposit is ₦500
          </div>
        )}
      </div>
    </>
  );

  const couponSection = (
    !couponApplied ? (
      <div className="mt-2">
        {!showCoupon ? (
          <button onClick={() => setShowCoupon(true)} className="bg-transparent border-none text-[13px] font-medium cursor-pointer p-0 flex items-center gap-1.5" style={{ color: t.accent }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="19" y1="5" x2="5" y2="19"/><circle cx="6.5" cy="6.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/></svg>
            Have a coupon code? Tap to apply
          </button>
        ) : (
          <div>
            <div className="flex gap-2">
              <input value={couponCode} onChange={e => setCouponCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))} placeholder="Enter code" className="m flex-1 max-w-[200px] py-[9px] px-3 rounded-lg text-sm tracking-[1px] outline-none" style={{ background: dark ? "rgba(255,255,255,.04)" : "#fff", border: `1px solid ${dark ? "rgba(255,255,255,.08)" : "rgba(0,0,0,.1)"}`, color: t.text, fontFamily: "'JetBrains Mono',monospace" }} />
              <button onClick={applyCoupon} disabled={couponLoading || !couponCode.trim()} className="py-[9px] px-4 rounded-lg text-sm font-semibold cursor-pointer border-none" style={{ background: dark ? "rgba(196,125,142,.12)" : "rgba(196,125,142,.08)", color: t.accent, opacity: couponLoading || !couponCode.trim() ? .5 : 1 }}>{couponLoading ? "..." : "Apply"}</button>
            </div>
            <div className="text-xs mt-1.5" style={{ color: dark ? "#fca5a5" : "#dc2626", visibility: couponError ? "visible" : "hidden" }}>{couponError ? `⚠️ ${couponError}` : '\u00A0'}</div>
          </div>
        )}
      </div>
    ) : (
      <div className="flex items-center gap-2 mt-2 py-2 px-3 rounded-lg text-[13px]" style={{ background: dark ? "rgba(110,231,183,.06)" : "rgba(5,150,105,.04)", border: `1px solid ${dark ? "rgba(110,231,183,.12)" : "rgba(5,150,105,.08)"}`, color: dark ? "#6ee7b7" : "#059669" }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
        <span><strong className="m">{couponApplied.code}</strong> — {couponApplied.type === "percent" ? `${couponApplied.value}% bonus` : `₦${couponApplied.value.toLocaleString()} bonus`}</span>
        <button onClick={removeCoupon} className="bg-transparent border-none text-xs cursor-pointer ml-auto" style={{ color: dark ? "#fca5a5" : "#dc2626" }}>Remove</button>
      </div>
    )
  );

  const AcceptedRow = ({ centered }) => (
    <div className={`flex items-center gap-1.5 flex-nowrap ${centered ? "justify-center mt-2.5" : ""}`}>
      <span className={`text-[13px] ${centered ? "hidden" : "hidden desktop:inline"}`} style={{ color: t.textMuted }}>We accept:</span>
      {ACCEPTED_TYPES.map(({ label, icon }) => (
        <span key={label} className="text-xs py-[3px] px-2 rounded-md font-medium whitespace-nowrap" style={{ background: dark ? "rgba(255,255,255,.04)" : "rgba(255,255,255,.8)", border: `1px solid ${t.cardBorder}`, color: dark ? "rgba(255,255,255,.55)" : "rgba(0,0,0,.45)" }}>{icon} {label}</span>
      ))}
    </div>
  );

  const PayButton = ({ onClick, disabled, text, className: cls }) => (
    <button onClick={onClick} disabled={disabled} className={`w-full py-4 max-desktop:py-3.5 max-md:py-[13px] rounded-xl max-md:rounded-[10px] text-base font-semibold border-none cursor-pointer transition-[transform,box-shadow] duration-200 hover:translate-y-[-1px] hover:shadow-[0_6px_20px_rgba(196,125,142,.25)] ${cls || ""}`} style={{ background: valid ? "linear-gradient(135deg,#c47d8e,#8b5e6b)" : (dark ? "rgba(255,255,255,.06)" : "rgba(0,0,0,.06)"), color: valid ? "#fff" : t.textMuted }}>
      {text}
    </button>
  );

  return (
    <>
      {/* Payment status banner */}
      {paymentStatus && (
        <div className="flex items-center justify-between py-3.5 px-[18px] rounded-xl mb-4 gap-3" style={{
          background: paymentStatus.type === "success" ? (dark ? "rgba(110,231,183,.06)" : "rgba(5,150,105,.04)") : (dark ? "rgba(252,165,165,.06)" : "rgba(220,38,38,.04)"),
          border: `1px solid ${paymentStatus.type === "success" ? (dark ? "rgba(110,231,183,.15)" : "rgba(5,150,105,.12)") : (dark ? "rgba(252,165,165,.15)" : "rgba(220,38,38,.12)")}`,
          color: paymentStatus.type === "success" ? (dark ? "#6ee7b7" : "#059669") : (dark ? "#fca5a5" : "#dc2626"),
        }}>
          <div className="flex items-center gap-2.5">
            <span className="text-base font-semibold shrink-0">{paymentStatus.type === "success" ? "✓" : "✕"}</span>
            <div>
              <div className="text-[15px] font-semibold">{paymentStatus.message}</div>
              {paymentStatus.amount && <div className="m text-sm mt-0.5 opacity-80">{fN(paymentStatus.amount)} credited to your wallet</div>}
              {paymentStatus.type === "success" && onPlaceOrder && <button onClick={onPlaceOrder} className="text-sm font-semibold mt-1.5 bg-transparent border-none cursor-pointer p-0 underline" style={{ color: "inherit" }}>Place an order now →</button>}
            </div>
          </div>
          <button onClick={() => setPaymentStatus(null)} className="bg-transparent border-none text-base cursor-pointer p-1 opacity-60" style={{ color: "inherit" }}>✕</button>
        </div>
      )}

      <div className="pb-3.5 max-md:pb-2">
        <div className="text-[22px] max-desktop:text-lg font-semibold mb-0.5" style={{ color: t.text }}>Wallet</div>
        <div className="text-[15px] max-md:text-sm" style={{ color: t.textMuted }}>Top up your balance to place orders</div>
        <div className="page-divider" style={{ background: t.cardBorder }} />
      </div>

      {/* ═══ DESKTOP + TABLET: side by side ═══ */}
      <div className="flex flex-col flex-1 max-md:!hidden">
        {/* Balance bar */}
        <div className="flex justify-between items-center mb-4 py-3.5 px-5 rounded-[14px]" style={{ background: dark ? "rgba(255,255,255,.03)" : "rgba(255,255,255,.85)", border: `0.5px solid ${t.cardBorder}` }}>
          <div>
            <div className="text-[11px] uppercase tracking-[1.5px] mb-0.5" style={{ color: t.textMuted }}>Current Balance</div>
            <div className="text-2xl font-bold" style={{ color: t.green }}>{fN(balance)}</div>
          </div>
          <div className="w-[38px] h-[38px] rounded-[10px] flex items-center justify-center" style={{ background: dark ? "rgba(110,231,183,.06)" : "rgba(5,150,105,.04)" }}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={t.green} strokeWidth="1.5" strokeLinecap="round"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
          </div>
        </div>

        {/* Two columns */}
        <div className="flex gap-4 flex-1 items-stretch">
          {/* LEFT — Amount + Presets + Coupon */}
          <div className="flex-1 min-w-0 flex">
            <div className="flex-1 flex flex-col rounded-[14px] p-[22px]" style={{ background: dark ? "rgba(255,255,255,.03)" : "rgba(255,255,255,.85)", border: `0.5px solid ${t.cardBorder}` }}>
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
            <div className="flex-1 flex flex-col rounded-[14px] p-[22px]" style={{ background: dark ? "rgba(255,255,255,.03)" : "rgba(255,255,255,.85)", border: `0.5px solid ${t.cardBorder}` }}>
              <div className="flex justify-between mb-3.5 text-[15px]"><span style={{ color: t.textMuted }}>Deposit</span><span style={{ color: valid ? t.text : t.textMuted, fontWeight: 600 }}>{valid ? fN(numAmount) : "₦0"}</span></div>
              <div className="flex justify-between mb-3.5 text-[15px]"><span style={{ color: t.textMuted }}>Fee</span><span style={{ color: t.green, fontWeight: 600 }}>Free</span></div>
              {couponApplied && discount > 0 && (
                <div className="flex justify-between mb-3.5 text-[15px]"><span style={{ color: t.textMuted }}>Coupon bonus</span><span style={{ color: dark ? "#6ee7b7" : "#059669", fontWeight: 600 }}>+{fN(discount / 100)}</span></div>
              )}
              <div className="h-px my-1 mb-3.5" style={{ background: t.cardBorder }} />
              <div className="flex justify-between items-baseline mb-7">
                <span className="text-[11px] font-semibold uppercase tracking-[1.5px]" style={{ color: t.textMuted }}>{couponApplied && discount > 0 ? "You get" : "Total"}</span>
                <span className="text-[28px] font-bold" style={{ color: valid ? t.accent : t.textMuted }}>{valid ? fN(numAmount + (discount > 0 ? discount / 100 : 0)) : "—"}</span>
              </div>

              <div className="text-[11px] font-semibold uppercase tracking-[1px] mb-1.5" style={{ color: t.textMuted }}>Payment method</div>
              {gatewaysLoading ? (
                <div className={`skel-bone h-[42px] rounded-[10px] ${dark ? "skel-dark" : "skel-light"}`} />
              ) : (
                <select value={method} onChange={e => setMethod(e.target.value)} className="w-full py-2.5 px-3.5 rounded-[10px] text-sm font-medium outline-none appearance-none cursor-pointer pr-8" style={{ background: dark ? "rgba(255,255,255,.04)" : "#fff", border: `1px solid ${dark ? "rgba(255,255,255,.08)" : "rgba(0,0,0,.1)"}`, color: t.text, fontFamily: "'Outfit',sans-serif", backgroundImage: `url("data:image/svg+xml,%3Csvg width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='${dark ? "%23666" : "%23999"}' stroke-width='2' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`, backgroundRepeat: "no-repeat", backgroundPosition: "right 12px center" }}>
                  {gateways.length > 0 ? gateways.map(g => <option key={g.id} value={g.id}>{g.name}{g.id === "manual" ? " (⏳ Slower)" : ""}</option>) : <option value="">Select payment method</option>}
                </select>
              )}

              <div className="flex-1 min-h-4" />

              <PayButton onClick={handlePay} disabled={!valid || loading} text={loading ? "Processing..." : valid ? `Pay ${fN(numAmount)} Now` : "Amount to deposit"} />
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
            {/* Balance card */}
            <div className="rounded-xl py-3.5 px-4 mb-3 flex justify-between items-center" style={{ background: dark ? "rgba(255,255,255,.03)" : "rgba(255,255,255,.85)", border: `0.5px solid ${t.cardBorder}` }}>
              <div>
                <div className="text-[13px] uppercase tracking-[1.5px] mb-0.5" style={{ color: t.textMuted }}>Current Balance</div>
                <div className="m text-[22px] font-semibold" style={{ color: t.green }}>{fN(balance)}</div>
              </div>
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: dark ? "rgba(110,231,183,.08)" : "rgba(5,150,105,.04)" }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={t.green} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
              </div>
            </div>

            {/* Amount card */}
            <div className="rounded-xl p-4" style={{ background: dark ? "rgba(255,255,255,.03)" : "rgba(255,255,255,.85)", border: `0.5px solid ${t.cardBorder}` }}>
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
            <button onClick={() => setMobileStep(1)} className="flex items-center gap-1.5 bg-transparent border-none text-sm font-medium cursor-pointer pb-3" style={{ color: t.textMuted, fontFamily: "inherit" }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6"/></svg>
              Back
            </button>

            {/* Summary card */}
            <div className="rounded-xl py-3.5 px-4 mb-3" style={{ background: dark ? "rgba(255,255,255,.03)" : "rgba(255,255,255,.85)", border: `0.5px solid ${t.cardBorder}` }}>
              <div className="flex justify-between mb-3.5 text-[15px] max-md:text-sm max-md:mb-3"><span style={{ color: t.textMuted }}>Deposit</span><span style={{ color: t.text, fontWeight: 600 }}>{fN(numAmount)}</span></div>
              <div className="flex justify-between mb-3.5 text-[15px] max-md:text-sm max-md:mb-3"><span style={{ color: t.textMuted }}>Fee</span><span style={{ color: t.green, fontWeight: 600 }}>Free</span></div>
              {couponApplied && discount > 0 && (
                <div className="flex justify-between mb-3.5 text-[15px] max-md:text-sm max-md:mb-3"><span style={{ color: t.textMuted }}>Coupon ({couponApplied.code})</span><span style={{ color: dark ? "#6ee7b7" : "#059669", fontWeight: 600 }}>+{fN(discount / 100)} bonus</span></div>
              )}
              <div className="h-px my-2" style={{ background: t.cardBorder }} />
              <div className="flex justify-between items-center">
                <span className="text-[13px] font-semibold uppercase tracking-[1.5px]" style={{ color: t.textMuted }}>{couponApplied && discount > 0 ? "You get" : "Total"}</span>
                <span className="text-xl font-semibold" style={{ color: t.accent }}>{fN(numAmount + (discount > 0 ? discount / 100 : 0))}</span>
              </div>
            </div>

            {/* Payment method card */}
            <div className="rounded-xl p-4 mb-2.5" style={{ background: dark ? "rgba(255,255,255,.03)" : "rgba(255,255,255,.85)", border: `0.5px solid ${t.cardBorder}` }}>
              <div className="text-xs font-semibold uppercase tracking-[1px] mb-1.5" style={{ color: t.textMuted }}>Payment method</div>
              {gateways.length > 0 ? (
                <select value={method} onChange={e => setMethod(e.target.value)} className="w-full py-2.5 px-3.5 rounded-[10px] text-sm font-medium outline-none appearance-none cursor-pointer pr-8" style={{ background: dark ? "rgba(255,255,255,.04)" : "#fff", border: `1px solid ${dark ? "rgba(255,255,255,.08)" : "rgba(0,0,0,.1)"}`, color: t.text, fontFamily: "'Outfit',sans-serif", backgroundImage: `url("data:image/svg+xml,%3Csvg width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='${dark ? "%23666" : "%23999"}' stroke-width='2' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`, backgroundRepeat: "no-repeat", backgroundPosition: "right 12px center" }}>
                  {gateways.map(g => <option key={g.id} value={g.id}>{g.name}{g.id === "manual" ? " (⏳ Slower)" : ""}</option>)}
                </select>
              ) : (
                <select disabled className="w-full py-2.5 px-3.5 rounded-[10px] text-sm outline-none appearance-none" style={{ background: dark ? "rgba(255,255,255,.04)" : "#fff", border: `1px solid ${dark ? "rgba(255,255,255,.08)" : "rgba(0,0,0,.1)"}`, color: t.textMuted, fontFamily: "'Outfit',sans-serif" }}>
                  <option>Select payment method</option>
                </select>
              )}
              <PayButton onClick={handlePay} disabled={loading} text={loading ? "Processing..." : `Pay ${fN(numAmount)} Now`} className="mt-3" />
            </div>

            <div className="flex items-center justify-center gap-1.5 mt-2.5 text-[13px]" style={{ color: t.textMuted }}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: t.textMuted }}><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
              Encrypted and secure
            </div>
          </>
        )}
      </div>

      {/* ═══ CRYPTO PAYMENT MODAL ═══ */}
      {cryptoModal && (
        <div onClick={() => { if (cryptoStatus === "Completed" || cryptoStatus === "Cancelled") setCryptoModal(null); }} onKeyDown={e=>{if(e.key==='Escape'&&(cryptoStatus==="Completed"||cryptoStatus==="Cancelled"))setCryptoModal(null)}} className="fixed inset-0 z-50 flex items-center justify-center p-6" style={{ background: "rgba(0,0,0,.5)" }}>
          <div role="dialog" aria-modal="true" aria-label="Crypto payment" onClick={e => e.stopPropagation()} className="w-full max-w-[400px] rounded-2xl p-6" style={{ background: dark ? "#0e1120" : "#fff", border: `1px solid ${dark ? "rgba(255,255,255,.08)" : "rgba(0,0,0,.06)"}`, boxShadow: "0 20px 60px rgba(0,0,0,.3)" }}>
            {cryptoStatus === "Completed" ? (
              <>
                <div className="text-center py-5">
                  <div className="text-5xl mb-3">✅</div>
                  <div className="text-lg font-semibold mb-1.5" style={{ color: t.text }}>Payment Confirmed!</div>
                  <div className="text-sm" style={{ color: t.textMuted }}>{fN(cryptoModal.amountNgn)} has been added to your wallet</div>
                </div>
                <div className="flex max-md:flex-col gap-3">
                  <button onClick={() => { setCryptoModal(null); window.location.reload(); }} className="flex-1 py-3 rounded-[10px] bg-transparent text-[15px] font-medium cursor-pointer" style={{ border: `1px solid ${t.cardBorder}`, color: t.text, fontFamily: "inherit" }}>Done</button>
                  {onPlaceOrder && <button onClick={() => { setCryptoModal(null); onPlaceOrder(); }} className="flex-1 py-3 rounded-[10px] border-none bg-gradient-to-br from-[#c47d8e] to-[#8b5e6b] text-white text-[15px] font-semibold cursor-pointer" style={{ fontFamily: "inherit" }}>Place an order</button>}
                </div>
              </>
            ) : cryptoStatus === "Cancelled" ? (
              <>
                <div className="text-center py-5">
                  <div className="text-5xl mb-3">❌</div>
                  <div className="text-lg font-semibold mb-1.5" style={{ color: t.text }}>Payment Expired</div>
                  <div className="text-sm" style={{ color: t.textMuted }}>This payment has expired or was canceled. Try again.</div>
                </div>
                <button onClick={() => setCryptoModal(null)} className="w-full py-3 rounded-[10px] bg-transparent text-[15px] font-medium cursor-pointer" style={{ border: `1px solid ${t.cardBorder}`, color: t.text, fontFamily: "inherit" }}>Close</button>
              </>
            ) : (
              <>
                <div className="text-base font-semibold mb-1" style={{ color: t.text }}>Send USDT (TRC-20)</div>
                <div className="text-[13px] mb-4" style={{ color: t.textMuted }}>Send exactly the amount below to this address</div>

                <div className="p-3.5 rounded-[10px] mb-3 text-center" style={{ background: dark ? "rgba(255,255,255,.04)" : "rgba(0,0,0,.02)", border: `1px solid ${t.cardBorder}` }}>
                  <div className="text-[11px] font-semibold uppercase tracking-[1px] mb-1" style={{ color: t.textMuted }}>Amount to send</div>
                  <div className="m text-[28px] font-bold" style={{ color: dark ? "#6ee7b7" : "#059669" }}>{cryptoModal.payAmount} USDT</div>
                  <div className="text-xs mt-0.5" style={{ color: t.textMuted }}>≈ ${cryptoModal.amountUsd} USD · {fN(cryptoModal.amountNgn)}</div>
                </div>

                <div className="mb-3">
                  <div className="text-[11px] font-semibold uppercase tracking-[1px] mb-1" style={{ color: t.textMuted }}>TRC-20 Address</div>
                  <div className="py-2.5 px-3 rounded-lg text-xs leading-normal break-all" style={{ background: dark ? "#0d1020" : "#f8f8f8", border: `1px solid ${t.cardBorder}`, color: t.text, fontFamily: "'JetBrains Mono',monospace" }}>
                    {cryptoModal.payAddress}
                  </div>
                  <button onClick={() => { navigator.clipboard.writeText(cryptoModal.payAddress); }} className="mt-1.5 py-1.5 px-3.5 rounded-md bg-transparent text-xs font-semibold cursor-pointer" style={{ border: `1px solid ${t.accent}`, color: t.accent, fontFamily: "inherit" }}>Copy address</button>
                </div>

                <div className="py-2.5 px-3.5 rounded-lg mb-3.5" style={{ background: dark ? "rgba(251,191,36,.04)" : "rgba(217,119,6,.03)", border: `1px solid ${dark ? "rgba(251,191,36,.1)" : "rgba(217,119,6,.08)"}` }}>
                  <div className="flex items-center gap-2">
                    {cryptoPolling && <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: "#fbbf24" }} />}
                    <span className="text-[13px] font-medium" style={{ color: dark ? "#fbbf24" : "#d97706" }}>
                      {cryptoStatus === "Confirming" ? "Payment detected — confirming on blockchain..." : "Waiting for payment..."}
                    </span>
                  </div>
                  <div className="text-[11px] mt-1" style={{ color: t.textMuted }}>We check automatically every 15 seconds. Do not close this page.</div>
                </div>

                <button onClick={() => setCryptoModal(null)} className="w-full py-2.5 rounded-lg bg-transparent text-sm font-medium cursor-pointer" style={{ border: `1px solid ${t.cardBorder}`, color: t.textMuted, fontFamily: "inherit" }}>Cancel</button>
              </>
            )}
          </div>
        </div>
      )}

      {/* ═══ MANUAL BANK TRANSFER MODAL ═══ */}
      {manualModal && (
        <div onClick={() => { if (manualDone) setManualModal(null); }} onKeyDown={e=>{if(e.key==='Escape'&&manualDone)setManualModal(null)}} className="fixed inset-0 z-50 flex items-center justify-center p-6" style={{ background: "rgba(0,0,0,.5)" }}>
          <div role="dialog" aria-modal="true" aria-label="Bank transfer" onClick={e => e.stopPropagation()} className="w-full max-w-[420px] rounded-2xl p-6" style={{ background: dark ? "#0e1120" : "#fff", border: `1px solid ${dark ? "rgba(255,255,255,.08)" : "rgba(0,0,0,.06)"}`, boxShadow: "0 20px 60px rgba(0,0,0,.3)" }}>
            {manualDone ? (
              <>
                <div className="text-center py-5">
                  <div className="text-5xl mb-3">✅</div>
                  <div className="text-lg font-semibold mb-1.5" style={{ color: t.text }}>Transfer Submitted</div>
                  <div className="text-sm leading-normal" style={{ color: t.textMuted }}>We'll verify your payment and credit your wallet. This may take 15-60 minutes during business hours.</div>
                </div>
                <div className="flex max-md:flex-col gap-3">
                  <button onClick={() => setManualModal(null)} className="flex-1 py-3 rounded-[10px] bg-transparent text-[15px] font-medium cursor-pointer" style={{ border: `1px solid ${t.cardBorder}`, color: t.text, fontFamily: "inherit" }}>Done</button>
                  {onPlaceOrder && <button onClick={() => { setManualModal(null); onPlaceOrder(); }} className="flex-1 py-3 rounded-[10px] border-none bg-gradient-to-br from-[#c47d8e] to-[#8b5e6b] text-white text-[15px] font-semibold cursor-pointer" style={{ fontFamily: "inherit" }}>Place an order</button>}
                </div>
              </>
            ) : (
              <>
                <div className="text-base font-semibold mb-1" style={{ color: t.text }}>Bank Transfer</div>
                <div className="text-[13px] mb-2.5" style={{ color: t.textMuted }}>Transfer exactly {fN(manualModal.amount)} to the account below</div>

                <div className="py-2 px-3 rounded-lg mb-3.5 text-xs leading-normal" style={{ background: dark ? "rgba(251,191,36,.04)" : "rgba(217,119,6,.03)", border: `1px solid ${dark ? "rgba(251,191,36,.1)" : "rgba(217,119,6,.08)"}`, color: dark ? "#fbbf24" : "#d97706" }}>
                  ⏳ Manual transfers are verified by our team. This may take 15-60 minutes during business hours.
                </div>

                <div className="p-3.5 rounded-[10px] mb-3.5" style={{ background: dark ? "rgba(255,255,255,.04)" : "rgba(0,0,0,.02)", border: `1px solid ${t.cardBorder}` }}>
                  <div className="mb-2.5">
                    <div className="text-[11px] font-semibold uppercase tracking-[1px] mb-0.5" style={{ color: t.textMuted }}>Bank</div>
                    <div className="text-[15px] font-semibold" style={{ color: t.text }}>{manualModal.bankName}</div>
                  </div>
                  <div className="mb-2.5">
                    <div className="text-[11px] font-semibold uppercase tracking-[1px] mb-0.5" style={{ color: t.textMuted }}>Account Number</div>
                    <div className="flex items-center gap-2">
                      <span className="m text-lg font-bold tracking-[1px]" style={{ color: t.text }}>{manualModal.accountNumber}</span>
                      <button onClick={() => navigator.clipboard.writeText(manualModal.accountNumber)} className="py-[3px] px-2.5 rounded-md bg-transparent text-[11px] font-semibold cursor-pointer" style={{ border: `1px solid ${t.accent}`, color: t.accent, fontFamily: "inherit" }}>Copy</button>
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-[1px] mb-0.5" style={{ color: t.textMuted }}>Account Name</div>
                    <div className="text-[15px] font-semibold" style={{ color: t.text }}>{manualModal.accountName}</div>
                  </div>
                </div>

                <div className="py-2.5 px-3.5 rounded-lg mb-3.5" style={{ background: dark ? "rgba(196,125,142,.04)" : "rgba(196,125,142,.03)", border: `1px solid ${dark ? "rgba(196,125,142,.12)" : "rgba(196,125,142,.08)"}` }}>
                  <div className="text-[11px] font-semibold uppercase tracking-[1px] mb-1" style={{ color: t.accent }}>Use this as your transfer narration</div>
                  <div className="flex items-center gap-2">
                    <span className="m text-base font-bold tracking-[1px]" style={{ color: t.text }}>{manualModal.reference}</span>
                    <button onClick={() => navigator.clipboard.writeText(manualModal.reference)} className="py-[3px] px-2.5 rounded-md bg-transparent text-[11px] font-semibold cursor-pointer" style={{ border: `1px solid ${t.accent}`, color: t.accent, fontFamily: "inherit" }}>Copy</button>
                  </div>
                </div>

                <div className="py-2.5 px-3.5 rounded-lg mb-3.5 text-center" style={{ background: dark ? "rgba(110,231,183,.04)" : "rgba(5,150,105,.03)", border: `1px solid ${dark ? "rgba(110,231,183,.1)" : "rgba(5,150,105,.08)"}` }}>
                  <span className="text-[13px] font-semibold" style={{ color: dark ? "#6ee7b7" : "#059669" }}>Send exactly {fN(manualModal.amount)}</span>
                </div>

                <div className="flex gap-2">
                  <button onClick={() => setManualModal(null)} className="flex-1 py-2.5 rounded-lg bg-transparent text-sm font-medium cursor-pointer" style={{ border: `1px solid ${t.cardBorder}`, color: t.textMuted, fontFamily: "inherit" }}>Cancel</button>
                  <button onClick={async () => {
                    setManualSubmitting(true);
                    try {
                      const res = await fetch("/api/payments/manual", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reference: manualModal.reference, senderRef: manualModal.reference }) });
                      if (res.ok) setManualDone(true);
                      else { const d = await res.json(); toast.error("Failed", d.error || "Something went wrong", { position: "bottom" }); }
                    } catch { toast.error("Network error", "Check your connection", { position: "bottom" }); }
                    setManualSubmitting(false);
                  }} disabled={manualSubmitting} className="flex-1 py-2.5 rounded-lg border-none bg-gradient-to-br from-[#c47d8e] to-[#8b5e6b] text-white text-sm font-semibold cursor-pointer" style={{ fontFamily: "inherit", opacity: manualSubmitting ? .5 : 1 }}>{manualSubmitting ? "Submitting..." : "I've sent the money"}</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}

/* ═══════════════════════════════════════════ */
/* ═══ ADD FUNDS RIGHT SIDEBAR             ═══ */
/* ═══════════════════════════════════════════ */
export function AddFundsSidebar({ user, txs, dark, t }) {
  const balance = user?.balance || 0;
  const deposits = (txs || []).filter(tx => tx.type === "deposit").slice(0, 5);

  return (
    <>
      <div className="text-[13px] font-semibold uppercase tracking-[1.5px] mb-2.5 pl-1" style={{ color: t.textMuted }}>Wallet</div>
      <div className="p-4 rounded-xl text-center mb-4" style={{ background: dark ? "rgba(255,255,255,.03)" : "rgba(255,255,255,.85)", border: `0.5px solid ${t.cardBorder}` }}>
        <div className="text-[13px] uppercase tracking-[1px] mb-1" style={{ color: t.textMuted }}>Balance</div>
        <div className="m text-2xl font-semibold" style={{ color: t.green }}>{fN(balance)}</div>
      </div>

      <div className="h-px mb-4" style={{ background: t.sidebarBorder }} />

      <div className="text-[13px] font-semibold uppercase tracking-[1.5px] mb-2.5 pl-1" style={{ color: t.textMuted }}>Recent Deposits</div>
      {deposits.length > 0 ? deposits.map((tx, i) => (
        <div key={tx.id || i} className="py-2.5 px-3 rounded-lg mb-1" style={{ background: t.cardBg }}>
          <div className="flex justify-between items-center text-sm">
            <span style={{ color: t.green, fontWeight: 600 }}>+{fN(tx.amount)}</span>
            <span className="text-xs" style={{ color: t.textMuted }}>{tx.date ? fD(tx.date) : ""}</span>
          </div>
          <div className="text-sm" style={{ color: t.textMuted }}>{tx.method || "Deposit"}</div>
        </div>
      )) : (
        <div className="text-sm py-2 px-1" style={{ color: t.textMuted }}>No deposits yet</div>
      )}

      <div className="h-px mb-4" style={{ background: t.sidebarBorder }} />

      <div className="text-[13px] font-semibold uppercase tracking-[1.5px] mb-2.5 pl-1" style={{ color: t.textMuted }}>How It Works</div>
      {[["1", "Enter amount"], ["2", "Choose payment method"], ["3", "Pay securely"], ["4", "Balance updated instantly"]].map(([num, title]) => (
        <div key={num} className="flex gap-2.5 mb-2 px-1">
          <div className="m w-[22px] h-[22px] rounded-md flex items-center justify-center text-[13px] font-semibold shrink-0" style={{ background: t.navActive, color: t.accent }}>{num}</div>
          <div className="text-sm font-[450] pt-0.5" style={{ color: dark ? "rgba(255,255,255,.55)" : "rgba(0,0,0,.55)" }}>{title}</div>
        </div>
      ))}
    </>
  );
}
