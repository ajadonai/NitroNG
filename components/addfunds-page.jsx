'use client';
import { useState, useEffect } from "react";
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
export default function AddFundsPage({ user, dark, t, paymentStatus, setPaymentStatus }) {
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("");
  const [loading, setLoading] = useState(false);
  const [mobileStep, setMobileStep] = useState(1);
  const [gateways, setGateways] = useState([]);
  const [gatewaysLoading, setGatewaysLoading] = useState(true);

  /* Crypto payment modal */
  const [cryptoModal, setCryptoModal] = useState(null); // { payAddress, payAmount, payCurrency, reference, amountUsd, amountNgn, expiresAt }
  const [cryptoStatus, setCryptoStatus] = useState(null); // 'Pending' | 'Confirming' | 'Completed' | 'Canceled'
  const [cryptoPolling, setCryptoPolling] = useState(false);

  // Fetch enabled gateways from API
  useEffect(() => {
    fetch("/api/payments/gateways").then(r => r.json()).then(d => {
      const gws = d.gateways || [];
      setGateways(gws);
      if (gws.length > 0 && !method) setMethod(gws[0].id);
      setGatewaysLoading(false);
    }).catch(() => setGatewaysLoading(false));
  }, []); // 1 = amount, 2 = payment

  const numAmount = Number(amount) || 0;
  const valid = numAmount >= 500;
  const balance = user?.balance || 0;

  // Coupon state
  const [showCoupon, setShowCoupon] = useState(false);
  const [couponCode, setCouponCode] = useState("");
  const [couponApplied, setCouponApplied] = useState(null); // { code, type, value, discount, couponId }
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

  // Recalculate discount when amount changes
  const discount = couponApplied ? (couponApplied.type === "percent" ? Math.round(numAmount * 100 * (couponApplied.value / 100)) : couponApplied.value * 100) : 0;

  const [payError, setPayError] = useState(null);

  const handlePay = async () => {
    if (!valid || loading) return;
    setLoading(true); setPayError(null);

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
          // Start polling for payment confirmation
          setCryptoPolling(true);
          const poll = setInterval(async () => {
            try {
              const sr = await fetch(`/api/payments/crypto?reference=${data.reference}`);
              const sd = await sr.json();
              setCryptoStatus(sd.status || sd.npStatus || "Pending");
              if (sd.status === "Completed" || sd.status === "Canceled") {
                clearInterval(poll);
                setCryptoPolling(false);
                if (sd.status === "Completed" && setPaymentStatus) setPaymentStatus("success");
              }
            } catch {}
          }, 15000); // Check every 15 seconds
          // Stop polling after 30 minutes
          setTimeout(() => { clearInterval(poll); setCryptoPolling(false); }, 30 * 60 * 1000);
        } else {
          setPayError(data.error || "Failed to create crypto payment");
        }
      } catch (err) {
        setPayError(err?.name === "TimeoutError" ? "Request timed out." : "Network error.");
      }
      setLoading(false);
      return;
    }

    // ═══ CARD/TRANSFER — redirect flow ═══
    try {
      const res = await fetch("/api/payments/initialize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: numAmount, method, couponId: couponApplied?.couponId || undefined }),
        signal: AbortSignal.timeout(30000),
      });
      const data = await res.json();
      if (data.authorization_url) {
        window.location.href = data.authorization_url;
      } else {
        setPayError(data.error || "Payment initialization failed");
        setLoading(false);
      }
    } catch (err) {
      setPayError(err?.name === "TimeoutError" ? "Request timed out. Check your connection." : "Network error. Check your internet and try again.");
      setLoading(false);
    }
  };


  return (
    <>
      {/* Payment status banner */}
      {paymentStatus && (
        <div className="fund-status-banner" style={{
          background: paymentStatus.type === "success" ? (dark ? "rgba(110,231,183,.06)" : "rgba(5,150,105,.04)") : (dark ? "rgba(252,165,165,.06)" : "rgba(220,38,38,.04)"),
          borderWidth: 1, borderStyle: "solid",
          borderColor: paymentStatus.type === "success" ? (dark ? "rgba(110,231,183,.15)" : "rgba(5,150,105,.12)") : (dark ? "rgba(252,165,165,.15)" : "rgba(220,38,38,.12)"),
          color: paymentStatus.type === "success" ? (dark ? "#6ee7b7" : "#059669") : (dark ? "#fca5a5" : "#dc2626"),
        }}>
          <div className="fund-status-content">
            <span className="fund-status-icon">{paymentStatus.type === "success" ? "✓" : "✕"}</span>
            <div>
              <div className="fund-status-msg">{paymentStatus.message}</div>
              {paymentStatus.amount && <div className="m fund-status-amount">{fN(paymentStatus.amount)} credited to your wallet</div>}
            </div>
          </div>
          <button onClick={() => setPaymentStatus(null)} className="fund-status-close" style={{ color: "inherit" }}>✕</button>
        </div>
      )}

      <div className="fund-header">
        <div className="fund-title" style={{ color: t.text }}>Wallet</div>
        <div className="fund-subtitle" style={{ color: t.textMuted }}>Top up your balance to place orders</div>
        <div className="page-divider" style={{ background: t.cardBorder }} />
      </div>

      {/* ═══ DESKTOP + TABLET: side by side ═══ */}
      <div className="fund-desktop-only" style={{ display: "flex", flexDirection: "column", flex: 1 }}>
        {/* Balance bar — compact, full width */}
        <div className="fund-bal-bar" style={{ background: dark ? "rgba(255,255,255,.03)" : "rgba(255,255,255,.85)", border: `0.5px solid ${t.cardBorder}`, borderRadius: 14, padding: "14px 20px", display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 1.5, color: t.textMuted, marginBottom: 2 }}>Current Balance</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: t.green }}>{fN(balance)}</div>
          </div>
          <div style={{ width: 38, height: 38, borderRadius: 10, background: dark ? "rgba(110,231,183,.06)" : "rgba(5,150,105,.04)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={t.green} strokeWidth="1.5" strokeLinecap="round"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
          </div>
        </div>

        {/* Two columns — matched height */}
        <div style={{ display: "flex", gap: 16, flex: 1, alignItems: "stretch" }}>
          {/* LEFT — Amount + Presets + Coupon */}
          <div style={{ flex: 1, minWidth: 0, display: "flex" }}>
            <div style={{ flex: 1, display: "flex", flexDirection: "column", background: dark ? "rgba(255,255,255,.03)" : "rgba(255,255,255,.85)", border: `0.5px solid ${t.cardBorder}`, borderRadius: 14, padding: 22 }}>
              <div className="fund-deposit-label" style={{ color: t.textMuted }}>Amount to deposit</div>
              <div className="fund-amount-wrap" style={{ background: dark ? "#0d1020" : "#fff", borderWidth: 1, borderStyle: "solid", borderColor: amount ? t.accent : t.cardBorder }}>
                <span className="m fund-currency" style={{ color: dark ? "rgba(255,255,255,.55)" : "rgba(0,0,0,.4)" }}>₦</span>
                <input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0" className="m fund-amount-input" style={{ color: t.text }} />
              </div>
              <div className="fund-presets">
                {PRESETS.map(p => (
                  <button key={p} onClick={() => setAmount(String(p))} className="m fund-preset" style={{ borderWidth: 1, borderStyle: "solid", borderColor: numAmount === p ? t.accent : t.cardBorder, background: numAmount === p ? (dark ? "rgba(196,125,142,.1)" : "rgba(196,125,142,.06)") : "transparent", color: numAmount === p ? t.accent : (dark ? "rgba(255,255,255,.55)" : "rgba(0,0,0,.45)") }}>
                    ₦{p >= 1000 ? `${p / 1000}K` : p}
                  </button>
                ))}
              </div>
              <div className="fund-warn-space">
                {numAmount > 0 && numAmount < 500 && (
                  <div className="fund-warn" style={{ color: dark ? "#fcd34d" : "#d97706" }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                    Minimum deposit is ₦500
                  </div>
                )}
              </div>

              {/* Spacer pushes coupon + accepted to bottom */}
              <div style={{ flex: 1 }} />

              {/* Coupon */}
              {!couponApplied ? (
                <div style={{ marginTop: 8 }}>
                  {!showCoupon ? (
                    <button onClick={() => setShowCoupon(true)} style={{ background: "none", border: "none", color: t.accent, fontSize: 13, fontWeight: 500, cursor: "pointer", padding: 0, display: "flex", alignItems: "center", gap: 6 }}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="19" y1="5" x2="5" y2="19"/><circle cx="6.5" cy="6.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/></svg>
                      Have a coupon code? Tap to apply
                    </button>
                  ) : (
                    <div>
                      <div style={{ display: "flex", gap: 8 }}>
                        <input value={couponCode} onChange={e => setCouponCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))} placeholder="Enter code" className="m" style={{ flex: 1, padding: "9px 12px", borderRadius: 8, background: dark ? "rgba(255,255,255,.04)" : "#fff", border: `1px solid ${dark ? "rgba(255,255,255,.08)" : "rgba(0,0,0,.1)"}`, color: t.text, fontSize: 14, fontFamily: "'JetBrains Mono',monospace", letterSpacing: 1, outline: "none" }} />
                        <button onClick={applyCoupon} disabled={couponLoading || !couponCode.trim()} style={{ padding: "9px 16px", borderRadius: 8, background: dark ? "rgba(196,125,142,.12)" : "rgba(196,125,142,.08)", color: t.accent, fontSize: 14, fontWeight: 600, cursor: "pointer", border: "none", opacity: couponLoading || !couponCode.trim() ? .5 : 1 }}>{couponLoading ? "..." : "Apply"}</button>
                      </div>
                      {couponError && <div style={{ fontSize: 12, color: dark ? "#fca5a5" : "#dc2626", marginTop: 6 }}>⚠️ {couponError}</div>}
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8, padding: "8px 12px", borderRadius: 8, background: dark ? "rgba(110,231,183,.06)" : "rgba(5,150,105,.04)", border: `1px solid ${dark ? "rgba(110,231,183,.12)" : "rgba(5,150,105,.08)"}`, fontSize: 13, color: dark ? "#6ee7b7" : "#059669" }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                  <span><strong className="m">{couponApplied.code}</strong> — {couponApplied.type === "percent" ? `${couponApplied.value}% bonus` : `₦${couponApplied.value.toLocaleString()} bonus`}</span>
                  <button onClick={removeCoupon} style={{ background: "none", border: "none", color: dark ? "#fca5a5" : "#dc2626", fontSize: 12, cursor: "pointer", marginLeft: "auto" }}>Remove</button>
                </div>
              )}

              <div className="fund-accepted" style={{ marginTop: 12 }}>
                <span className="fund-accepted-label" style={{ color: t.textMuted }}>We accept:</span>
                {ACCEPTED_TYPES.map(({ label, icon }) => (
                  <span key={label} className="fund-accepted-pill" style={{ background: dark ? "rgba(255,255,255,.04)" : "rgba(255,255,255,.8)", borderWidth: 1, borderStyle: "solid", borderColor: t.cardBorder, color: dark ? "rgba(255,255,255,.55)" : "rgba(0,0,0,.45)" }}>{icon} {label}</span>
                ))}
              </div>
            </div>
          </div>

          {/* RIGHT — Summary + Method dropdown + Pay */}
          <div style={{ width: 280, flexShrink: 0, display: "flex" }}>
            <div style={{ flex: 1, display: "flex", flexDirection: "column", background: dark ? "rgba(255,255,255,.03)" : "rgba(255,255,255,.85)", border: `0.5px solid ${t.cardBorder}`, borderRadius: 14, padding: 22 }}>
              <div className="fund-line"><span style={{ color: t.textMuted }}>Deposit</span><span style={{ color: valid ? t.text : t.textMuted, fontWeight: 600 }}>{valid ? fN(numAmount) : "₦0"}</span></div>
              <div className="fund-line"><span style={{ color: t.textMuted }}>Fee</span><span style={{ color: t.green, fontWeight: 600 }}>Free</span></div>
              {couponApplied && discount > 0 && (
                <div className="fund-line"><span style={{ color: t.textMuted }}>Coupon bonus</span><span style={{ color: dark ? "#6ee7b7" : "#059669", fontWeight: 600 }}>+{fN(discount / 100)}</span></div>
              )}
              <div style={{ height: 1, background: t.cardBorder, margin: "4px 0 14px" }} />
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 28 }}>
                <span style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1.5, color: t.textMuted }}>{couponApplied && discount > 0 ? "You get" : "Total"}</span>
                <span style={{ fontSize: 28, fontWeight: 700, color: valid ? t.accent : t.textMuted }}>{valid ? fN(numAmount + (discount > 0 ? discount / 100 : 0)) : "—"}</span>
              </div>

              <div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, color: t.textMuted, marginBottom: 6 }}>Payment method</div>
              {gatewaysLoading ? (
                <div className={`skel-bone ${dark ? "skel-dark" : "skel-light"}`} style={{ height: 42, borderRadius: 10 }} />
              ) : (
                <select value={method} onChange={e => setMethod(e.target.value)} style={{ width: "100%", padding: "10px 14px", borderRadius: 10, background: dark ? "rgba(255,255,255,.04)" : "#fff", border: `1px solid ${dark ? "rgba(255,255,255,.08)" : "rgba(0,0,0,.1)"}`, color: t.text, fontSize: 14, fontWeight: 500, fontFamily: "'Outfit',sans-serif", outline: "none", appearance: "none", cursor: "pointer", backgroundImage: `url("data:image/svg+xml,%3Csvg width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='${dark ? "%23666" : "%23999"}' stroke-width='2' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`, backgroundRepeat: "no-repeat", backgroundPosition: "right 12px center", paddingRight: 32 }}>
                  {gateways.length > 0 ? gateways.map(g => <option key={g.id} value={g.id}>{g.name}</option>) : <option value="">Select payment method</option>}
                </select>
              )}

              {/* Spacer pushes button to bottom */}
              <div style={{ flex: 1, minHeight: 16 }} />

              {payError && <div style={{ padding: "8px 12px", borderRadius: 8, marginBottom: 8, fontSize: 13, background: dark ? "rgba(220,38,38,.08)" : "#fef2f2", border: `1px solid ${dark ? "rgba(220,38,38,.15)" : "#fecaca"}`, color: dark ? "#fca5a5" : "#dc2626", display: "flex", justifyContent: "space-between", alignItems: "center" }}><span>⚠️ {payError}</span><button onClick={() => setPayError(null)} style={{ background: "none", border: "none", color: "inherit", cursor: "pointer", fontSize: 14 }}>✕</button></div>}
              <button onClick={handlePay} disabled={!valid || loading} className="fund-pay-btn" style={{ background: valid ? `linear-gradient(135deg,#c47d8e,#8b5e6b)` : (dark ? "rgba(255,255,255,.06)" : "rgba(0,0,0,.06)"), color: valid ? "#fff" : t.textMuted }}>
                {loading ? "Processing..." : valid ? `Pay ${fN(numAmount)} Now` : "How much?"}
              </button>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, marginTop: 10, fontSize: 12, color: t.textMuted }}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
                Encrypted & secure
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ═══ MOBILE: two-step flow ═══ */}
      <div className="fund-mobile-only">
        {mobileStep === 1 && (
          <>
            {/* Balance card */}
            <div className="fund-mob-balance" style={{ background: dark ? "rgba(255,255,255,.03)" : "rgba(255,255,255,.85)", border: `0.5px solid ${t.cardBorder}` }}>
              <div>
                <div className="fund-bal-label" style={{ color: t.textMuted }}>Current Balance</div>
                <div className="m fund-bal-value" style={{ color: t.green }}>{fN(balance)}</div>
              </div>
              <div className="fund-bal-icon" style={{ background: dark ? "rgba(110,231,183,.08)" : "rgba(5,150,105,.04)" }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={t.green} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
              </div>
            </div>

            {/* Amount card */}
            <div className="fund-mob-amount" style={{ background: dark ? "rgba(255,255,255,.03)" : "rgba(255,255,255,.85)", border: `0.5px solid ${t.cardBorder}` }}>
              <div className="fund-deposit-label" style={{ color: t.textMuted }}>How much?</div>
              <div className="fund-amount-wrap" style={{ background: dark ? "#0d1020" : "#fff", borderWidth: 1, borderStyle: "solid", borderColor: amount ? t.accent : t.cardBorder }}>
                <span className="m fund-currency" style={{ color: dark ? "rgba(255,255,255,.55)" : "rgba(0,0,0,.4)" }}>₦</span>
                <input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0" className="m fund-amount-input" style={{ color: t.text }} />
              </div>
              <div className="fund-presets">
                {PRESETS.map(p => (
                  <button key={p} onClick={() => setAmount(String(p))} className="m fund-preset" style={{ borderWidth: 1, borderStyle: "solid", borderColor: numAmount === p ? t.accent : t.cardBorder, background: numAmount === p ? (dark ? "rgba(196,125,142,.1)" : "rgba(196,125,142,.06)") : "transparent", color: numAmount === p ? t.accent : (dark ? "rgba(255,255,255,.55)" : "rgba(0,0,0,.45)") }}>
                    ₦{p >= 1000 ? `${p / 1000}K` : p}
                  </button>
                ))}
              </div>
              <div className="fund-warn-space">
                {numAmount > 0 && numAmount < 500 && (
                  <div className="fund-warn" style={{ color: dark ? "#fcd34d" : "#d97706" }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                    Minimum deposit is ₦500
                  </div>
                )}
              </div>

              {/* Coupon — mobile */}
              {!couponApplied ? (
                <div style={{ marginTop: 8 }}>
                  {!showCoupon ? (
                    <button onClick={() => setShowCoupon(true)} style={{ background: "none", border: "none", color: t.accent, fontSize: 13, fontWeight: 500, cursor: "pointer", padding: 0, display: "flex", alignItems: "center", gap: 6 }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="19" y1="5" x2="5" y2="19"/><circle cx="6.5" cy="6.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/></svg>
                      Have a coupon code? Tap to apply
                    </button>
                  ) : (
                    <>
                      <div style={{ display: "flex", gap: 8 }}>
                        <input value={couponCode} onChange={e => setCouponCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))} placeholder="Enter code" className="m" style={{ flex: 1, padding: "9px 12px", borderRadius: 8, background: dark ? "rgba(255,255,255,.04)" : "#fff", border: `1px solid ${dark ? "rgba(255,255,255,.08)" : "rgba(0,0,0,.1)"}`, color: t.text, fontSize: 14, fontFamily: "'JetBrains Mono',monospace", letterSpacing: 1, outline: "none" }} />
                        <button onClick={applyCoupon} disabled={couponLoading || !couponCode.trim()} style={{ padding: "9px 16px", borderRadius: 8, background: dark ? "rgba(196,125,142,.12)" : "rgba(196,125,142,.08)", color: t.accent, fontSize: 14, fontWeight: 600, cursor: "pointer", border: "none", opacity: couponLoading || !couponCode.trim() ? .5 : 1 }}>{couponLoading ? "..." : "Apply"}</button>
                      </div>
                      {couponError && <div style={{ fontSize: 12, color: dark ? "#fca5a5" : "#dc2626", marginTop: 6 }}>⚠️ {couponError}</div>}
                    </>
                  )}
                </div>
              ) : (
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8, padding: "8px 12px", borderRadius: 8, background: dark ? "rgba(110,231,183,.06)" : "rgba(5,150,105,.04)", border: `1px solid ${dark ? "rgba(110,231,183,.12)" : "rgba(5,150,105,.08)"}`, fontSize: 13, color: dark ? "#6ee7b7" : "#059669" }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                  <span><strong className="m">{couponApplied.code}</strong> — {couponApplied.type === "percent" ? `${couponApplied.value}% bonus` : `₦${couponApplied.value.toLocaleString()} bonus`}</span>
                  <button onClick={removeCoupon} style={{ background: "none", border: "none", color: dark ? "#fca5a5" : "#dc2626", fontSize: 12, cursor: "pointer", marginLeft: "auto" }}>Remove</button>
                </div>
              )}

              <button onClick={() => { if (valid) setMobileStep(2); }} disabled={!valid} className="fund-pay-btn" style={{ background: valid ? `linear-gradient(135deg,#c47d8e,#8b5e6b)` : (dark ? "rgba(255,255,255,.06)" : "rgba(0,0,0,.06)"), color: valid ? "#fff" : t.textMuted, marginTop: 8 }}>
                {valid ? "Proceed →" : "Enter amount"}
              </button>
            </div>

            <div className="fund-accepted" style={{ justifyContent: "center", marginTop: 10 }}>
              {ACCEPTED_TYPES.map(({ label, icon }) => (
                <span key={label} className="fund-accepted-pill" style={{ background: dark ? "rgba(255,255,255,.04)" : "rgba(255,255,255,.8)", borderWidth: 1, borderStyle: "solid", borderColor: t.cardBorder, color: dark ? "rgba(255,255,255,.55)" : "rgba(0,0,0,.45)" }}>{icon} {label}</span>
              ))}
            </div>
          </>
        )}

        {mobileStep === 2 && (
          <>
            {/* Back button */}
            <button onClick={() => setMobileStep(1)} style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", color: t.textMuted, fontSize: 14, fontWeight: 500, cursor: "pointer", padding: "0 0 12px", fontFamily: "inherit" }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6"/></svg>
              Back
            </button>

            {/* Summary card */}
            <div className="fund-mob-summary" style={{ background: dark ? "rgba(255,255,255,.03)" : "rgba(255,255,255,.85)", border: `0.5px solid ${t.cardBorder}` }}>
              <div className="fund-line"><span style={{ color: t.textMuted }}>Deposit</span><span style={{ color: t.text, fontWeight: 600 }}>{fN(numAmount)}</span></div>
              <div className="fund-line"><span style={{ color: t.textMuted }}>Fee</span><span style={{ color: t.green, fontWeight: 600 }}>Free</span></div>
              {couponApplied && discount > 0 && (
                <div className="fund-line"><span style={{ color: t.textMuted }}>Coupon ({couponApplied.code})</span><span style={{ color: dark ? "#6ee7b7" : "#059669", fontWeight: 600 }}>+{fN(discount / 100)} bonus</span></div>
              )}
              <div style={{ height: 1, background: t.cardBorder, margin: "8px 0" }} />
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span className="fund-total-label" style={{ color: t.textMuted }}>{couponApplied && discount > 0 ? "You get" : "Total"}</span>
                <span style={{ fontSize: 20, fontWeight: 600, color: t.accent }}>{fN(numAmount + (discount > 0 ? discount / 100 : 0))}</span>
              </div>
            </div>

            {/* Payment method card */}
            <div className="fund-mob-method" style={{ background: dark ? "rgba(255,255,255,.03)" : "rgba(255,255,255,.85)", border: `0.5px solid ${t.cardBorder}` }}>
              <div style={{ fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, color: t.textMuted, marginBottom: 6 }}>Payment method</div>
              {gateways.length > 0 ? (
                <select value={method} onChange={e => setMethod(e.target.value)} style={{ width: "100%", padding: "10px 14px", borderRadius: 10, background: dark ? "rgba(255,255,255,.04)" : "#fff", border: `1px solid ${dark ? "rgba(255,255,255,.08)" : "rgba(0,0,0,.1)"}`, color: t.text, fontSize: 14, fontWeight: 500, fontFamily: "'Outfit',sans-serif", outline: "none", appearance: "none", cursor: "pointer", backgroundImage: `url("data:image/svg+xml,%3Csvg width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='${dark ? "%23666" : "%23999"}' stroke-width='2' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`, backgroundRepeat: "no-repeat", backgroundPosition: "right 12px center", paddingRight: 32 }}>
                  {gateways.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                </select>
              ) : (
                <select disabled style={{ width: "100%", padding: "10px 14px", borderRadius: 10, background: dark ? "rgba(255,255,255,.04)" : "#fff", border: `1px solid ${dark ? "rgba(255,255,255,.08)" : "rgba(0,0,0,.1)"}`, color: t.textMuted, fontSize: 14, fontFamily: "'Outfit',sans-serif", outline: "none", appearance: "none" }}>
                  <option>Select payment method</option>
                </select>
              )}
              {payError && <div style={{ padding: "8px 12px", borderRadius: 8, marginTop: 8, fontSize: 13, background: dark ? "rgba(220,38,38,.08)" : "#fef2f2", border: `1px solid ${dark ? "rgba(220,38,38,.15)" : "#fecaca"}`, color: dark ? "#fca5a5" : "#dc2626" }}>⚠️ {payError}</div>}
              <button onClick={handlePay} disabled={loading} className="fund-pay-btn" style={{ background: `linear-gradient(135deg,#c47d8e,#8b5e6b)`, color: "#fff", marginTop: 12 }}>
                {loading ? "Processing..." : `Pay ${fN(numAmount)} Now`}
              </button>
            </div>

            <div className="fund-security" style={{ justifyContent: "center" }}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: t.textMuted }}><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
              <span style={{ color: t.textMuted }}>Encrypted and secure</span>
            </div>
          </>
        )}
      </div>

      {/* ═══ CRYPTO PAYMENT MODAL ═══ */}
      {cryptoModal && (
        <div onClick={() => { if (cryptoStatus === "Completed" || cryptoStatus === "Canceled") setCryptoModal(null); }} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.5)", zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: dark ? "#0e1120" : "#fff", borderRadius: 16, padding: 24, width: "100%", maxWidth: 400, border: `1px solid ${dark ? "rgba(255,255,255,.08)" : "rgba(0,0,0,.06)"}`, boxShadow: "0 20px 60px rgba(0,0,0,.3)" }}>
            {cryptoStatus === "Completed" ? (
              <>
                <div style={{ textAlign: "center", padding: "20px 0" }}>
                  <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
                  <div style={{ fontSize: 18, fontWeight: 600, color: t.text, marginBottom: 6 }}>Payment Confirmed!</div>
                  <div style={{ fontSize: 14, color: t.textMuted }}>{fN(cryptoModal.amountNgn)} has been added to your wallet</div>
                </div>
                <button onClick={() => { setCryptoModal(null); window.location.reload(); }} style={{ width: "100%", padding: "12px 0", borderRadius: 10, border: "none", background: "linear-gradient(135deg,#c47d8e,#8b5e6b)", color: "#fff", fontSize: 15, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Done</button>
              </>
            ) : cryptoStatus === "Canceled" ? (
              <>
                <div style={{ textAlign: "center", padding: "20px 0" }}>
                  <div style={{ fontSize: 48, marginBottom: 12 }}>❌</div>
                  <div style={{ fontSize: 18, fontWeight: 600, color: t.text, marginBottom: 6 }}>Payment Expired</div>
                  <div style={{ fontSize: 14, color: t.textMuted }}>This payment has expired or was canceled. Try again.</div>
                </div>
                <button onClick={() => setCryptoModal(null)} style={{ width: "100%", padding: "12px 0", borderRadius: 10, border: `1px solid ${t.cardBorder}`, background: "none", color: t.text, fontSize: 15, fontWeight: 500, cursor: "pointer", fontFamily: "inherit" }}>Close</button>
              </>
            ) : (
              <>
                <div style={{ fontSize: 16, fontWeight: 600, color: t.text, marginBottom: 4 }}>Send USDT (TRC-20)</div>
                <div style={{ fontSize: 13, color: t.textMuted, marginBottom: 16 }}>Send exactly the amount below to this address</div>

                {/* Amount */}
                <div style={{ padding: 14, borderRadius: 10, background: dark ? "rgba(255,255,255,.04)" : "rgba(0,0,0,.02)", border: `1px solid ${t.cardBorder}`, marginBottom: 12, textAlign: "center" }}>
                  <div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, color: t.textMuted, marginBottom: 4 }}>Amount to send</div>
                  <div className="m" style={{ fontSize: 28, fontWeight: 700, color: dark ? "#6ee7b7" : "#059669" }}>{cryptoModal.payAmount} USDT</div>
                  <div style={{ fontSize: 12, color: t.textMuted, marginTop: 2 }}>≈ ${cryptoModal.amountUsd} USD · {fN(cryptoModal.amountNgn)}</div>
                </div>

                {/* Address */}
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, color: t.textMuted, marginBottom: 4 }}>TRC-20 Address</div>
                  <div style={{ padding: "10px 12px", borderRadius: 8, background: dark ? "#0d1020" : "#f8f8f8", border: `1px solid ${t.cardBorder}`, fontSize: 12, fontFamily: "'JetBrains Mono',monospace", wordBreak: "break-all", color: t.text, lineHeight: 1.5 }}>
                    {cryptoModal.payAddress}
                  </div>
                  <button onClick={() => { navigator.clipboard.writeText(cryptoModal.payAddress); }} style={{ marginTop: 6, padding: "6px 14px", borderRadius: 6, border: `1px solid ${t.accent}`, background: "none", color: t.accent, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Copy address</button>
                </div>

                {/* Status */}
                <div style={{ padding: "10px 14px", borderRadius: 8, background: dark ? "rgba(251,191,36,.04)" : "rgba(217,119,6,.03)", border: `1px solid ${dark ? "rgba(251,191,36,.1)" : "rgba(217,119,6,.08)"}`, marginBottom: 14 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    {cryptoPolling && <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#fbbf24", animation: "pulse-dot 1.5s ease-in-out infinite" }} />}
                    <span style={{ fontSize: 13, color: dark ? "#fbbf24" : "#d97706", fontWeight: 500 }}>
                      {cryptoStatus === "Confirming" ? "Payment detected — confirming on blockchain..." : "Waiting for payment..."}
                    </span>
                  </div>
                  <div style={{ fontSize: 11, color: t.textMuted, marginTop: 4 }}>We check automatically every 15 seconds. Do not close this page.</div>
                </div>

                <button onClick={() => setCryptoModal(null)} style={{ width: "100%", padding: "10px 0", borderRadius: 8, border: `1px solid ${t.cardBorder}`, background: "none", color: t.textMuted, fontSize: 14, fontWeight: 500, cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
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
      <div className="fund-rs-title" style={{ color: t.textMuted }}>Wallet</div>
      <div className="fund-rs-wallet" style={{ background: dark ? "rgba(255,255,255,.03)" : "rgba(255,255,255,.85)", border: `0.5px solid ${t.cardBorder}` }}>
        <div className="fund-rs-bal-label" style={{ color: t.textMuted }}>Balance</div>
        <div className="m fund-rs-bal-val" style={{ color: t.green }}>{fN(balance)}</div>
      </div>

      <div className="fund-rs-divider" style={{ background: t.sidebarBorder }} />

      <div className="fund-rs-title" style={{ color: t.textMuted }}>Recent Deposits</div>
      {deposits.length > 0 ? deposits.map((tx, i) => (
        <div key={tx.id || i} className="fund-rs-deposit" style={{ background: t.cardBg }}>
          <div className="fund-rs-dep-row">
            <span style={{ color: t.green, fontWeight: 600 }}>+{fN(tx.amount)}</span>
            <span style={{ color: t.textMuted, fontSize: 12 }}>{tx.date ? fD(tx.date) : ""}</span>
          </div>
          <div style={{ fontSize: 14, color: t.textMuted }}>{tx.method || "Deposit"}</div>
        </div>
      )) : (
        <div style={{ fontSize: 14, color: t.textMuted, padding: "8px 4px" }}>No deposits yet</div>
      )}

      <div className="fund-rs-divider" style={{ background: t.sidebarBorder }} />

      <div className="fund-rs-title" style={{ color: t.textMuted }}>How It Works</div>
      {[["1", "Enter amount"], ["2", "Choose payment method"], ["3", "Pay securely"], ["4", "Balance updated instantly"]].map(([num, title]) => (
        <div key={num} className="fund-rs-step">
          <div className="m fund-rs-step-num" style={{ background: t.navActive, color: t.accent }}>{num}</div>
          <div className="fund-rs-step-text" style={{ color: dark ? "rgba(255,255,255,.55)" : "rgba(0,0,0,.55)" }}>{title}</div>
        </div>
      ))}
    </>
  );
}
