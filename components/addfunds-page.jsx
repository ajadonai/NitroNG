'use client';
import { useState, useEffect } from "react";

const fN = (a) => `₦${Math.abs(a).toLocaleString("en-NG")}`;
const fD = (d) => new Date(d).toLocaleDateString("en-NG", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
const PRESETS = [1000, 2000, 5000, 10000, 20000, 50000];

/* Dynamic — in production fetched from API / admin config */
const GATEWAYS = [
  { id: "paystack", label: "Paystack", enabled: true },
  { id: "flutterwave", label: "Flutterwave", enabled: true },
  { id: "alatpay", label: "ALATPay (Wema)", enabled: true },
  { id: "crypto", label: "Crypto (USDT/BTC)", enabled: false },
  { id: "monnify", label: "Monnify", enabled: false },
];

const ACCEPTED_TYPES = ["Cards", "Bank Transfer", "USSD", "Mobile Money"];

/* ═══════════════════════════════════════════ */
/* ═══ ADD FUNDS PAGE                      ═══ */
/* ═══════════════════════════════════════════ */
export default function AddFundsPage({ user, dark, t, paymentStatus, setPaymentStatus }) {
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("paystack");
  const [loading, setLoading] = useState(false);

  const numAmount = Number(amount) || 0;
  const valid = numAmount >= 500;
  const activeGateways = GATEWAYS.filter(g => g.enabled);
  const balance = user?.balance || 0;

  const handlePay = async () => {
    if (!valid || loading) return;
    setLoading(true);
    try {
      const res = await fetch("/api/payments/initialize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: numAmount }),
      });
      const data = await res.json();
      if (data.authorization_url) {
        window.location.href = data.authorization_url;
      } else {
        alert(data.error || "Payment initialization failed");
        setLoading(false);
      }
    } catch {
      alert("Something went wrong. Please try again.");
      setLoading(false);
    }
  };

  return (
    <>
      {/* Payment status banner — shows after returning from gateway */}
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
        <div className="fund-title" style={{ color: t.text }}>Add Funds</div>
        <div className="fund-subtitle" style={{ color: t.textMuted }}>Top up your wallet to place orders</div>
        <div className="page-divider" style={{ background: t.cardBorder }} />
      </div>

      <div className="fund-split">
        {/* ── LEFT: Amount input (redesigned) ── */}
        <div className="fund-left">
          {/* Amount card */}
          <div className="fund-amount-card" style={{ background: dark ? "rgba(255,255,255,.06)" : "rgba(255,255,255,.95)", borderWidth: 1, borderStyle: "solid", borderColor: dark ? "rgba(255,255,255,.06)" : "rgba(0,0,0,.06)", boxShadow: dark ? "0 4px 20px rgba(0,0,0,.25)" : "0 4px 20px rgba(0,0,0,.04)" }}>
            {/* Current balance */}
            <div className="fund-bal-row">
              <div>
                <div className="fund-bal-label" style={{ color: t.textMuted }}>Current Balance</div>
                <div className="m fund-bal-value" style={{ color: t.green }}>{fN(balance)}</div>
              </div>
              <div className="fund-bal-icon" style={{ background: dark ? "rgba(110,231,183,.08)" : "rgba(5,150,105,.04)" }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={t.green} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
              </div>
            </div>

            <div className="fund-card-divider" style={{ background: t.cardBorder }} />

            {/* Amount label */}
            <div className="fund-deposit-label" style={{ color: t.textMuted }}>Amount to deposit</div>

            {/* Big amount input */}
            <div className="fund-amount-wrap" style={{ background: dark ? "#0d1020" : "#fff", borderWidth: 2, borderStyle: "solid", borderColor: amount ? t.accent : t.cardBorder }}>
              <span className="m fund-currency" style={{ color: t.textSoft }}>₦</span>
              <input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0" className="m fund-amount-input" style={{ color: t.text }} />
            </div>

            {/* Preset buttons */}
            <div className="fund-presets">
              {PRESETS.map(p => (
                <button key={p} onClick={() => setAmount(String(p))} className="m fund-preset" style={{ borderWidth: numAmount === p ? 2 : 1, borderStyle: "solid", borderColor: numAmount === p ? t.accent : t.cardBorder, background: numAmount === p ? (dark ? "rgba(196,125,142,.1)" : "rgba(196,125,142,.06)") : "transparent", color: numAmount === p ? t.accent : t.textSoft }}>
                  ₦{p >= 1000 ? `${p / 1000}K` : p}
                </button>
              ))}
            </div>

            {/* Min warning — reserved space */}
            <div className="fund-warn-space">
              {numAmount > 0 && numAmount < 500 && (
                <div className="fund-warn" style={{ color: dark ? "#fcd34d" : "#d97706" }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                  Minimum deposit is ₦500
                </div>
              )}
            </div>
          </div>

          {/* Accepted types — outside card */}
          <div className="fund-accepted">
            <span className="fund-accepted-label" style={{ color: t.textMuted }}>We accept:</span>
            {ACCEPTED_TYPES.map(type => (
              <span key={type} className="fund-accepted-pill" style={{ background: dark ? "rgba(255,255,255,.04)" : "rgba(255,255,255,.8)", borderWidth: 1, borderStyle: "solid", borderColor: t.cardBorder, color: t.textSoft }}>{type}</span>
            ))}
          </div>
        </div>

        {/* ── RIGHT: Payment Details ── */}
        <div className="fund-right">
          <div className="fund-section-label" style={{ color: t.textMuted }}>Payment Details</div>

          <div className="fund-invoice" style={{ background: t.cardBg, borderWidth: 1, borderStyle: "solid", borderColor: t.cardBorder }}>
            {/* Line items */}
            <div className="fund-lines">
              <div className="fund-line">
                <span style={{ color: t.text, fontWeight: 500 }}>Deposit</span>
                <span className="m" style={{ color: valid ? t.text : t.textMuted, fontWeight: 600 }}>{valid ? fN(numAmount) : "₦0"}</span>
              </div>
              <div className="fund-line">
                <span style={{ color: t.textMuted }}>Fee</span>
                <span className="m" style={{ color: t.green, fontWeight: 600 }}>Free</span>
              </div>
            </div>

            {/* Double divider */}
            <div className="fund-double-div" style={{ borderColor: t.cardBorder }} />

            {/* Total */}
            <div className="fund-total-section">
              <div className="fund-total-label" style={{ color: t.textMuted }}>Total Due</div>
              <div className={`m fund-total-val${valid ? "" : " fund-total-empty"}`} style={{ color: valid ? t.accent : t.textMuted }}>
                {valid ? fN(numAmount) : "—"}
              </div>
            </div>

            {/* Divider */}
            <div className="fund-div" style={{ background: t.cardBorder }} />

            {/* Payment method selector */}
            <div className="fund-method-section">
              <div className="fund-method-title" style={{ color: t.text }}>Select payment method</div>
              {GATEWAYS.map((g, i) => (
                <div key={g.id} onClick={() => g.enabled && setMethod(g.id)} className="fund-method-row" style={{ borderBottom: i < GATEWAYS.length - 1 ? `1px solid ${t.cardBorder}` : "none", opacity: g.enabled ? 1 : .4, cursor: g.enabled ? "pointer" : "default" }}>
                  <div className="fund-radio" style={{ borderWidth: 2, borderStyle: "solid", borderColor: method === g.id && g.enabled ? t.accent : (dark ? "rgba(255,255,255,.15)" : "rgba(0,0,0,.15)") }}>
                    {method === g.id && g.enabled && <div className="fund-radio-dot" style={{ background: t.accent }} />}
                  </div>
                  <span style={{ fontSize: 14, fontWeight: method === g.id && g.enabled ? 600 : 450, color: method === g.id && g.enabled ? t.text : t.textSoft, display: "flex", alignItems: "center", gap: 8 }}>
                    {g.label}
                    {!g.enabled && <span className="m" style={{ fontSize: 11, padding: "2px 6px", borderRadius: 4, background: dark ? "#1c1608" : "#fffbeb", color: dark ? "#fcd34d" : "#d97706", fontWeight: 700 }}>SOON</span>}
                  </span>
                </div>
              ))}
            </div>

            {/* Pay button */}
            <div className="fund-btn-wrap">
              <button onClick={handlePay} disabled={!valid || loading} className="fund-pay-btn" style={{ background: valid ? `linear-gradient(135deg,#c47d8e,#8b5e6b)` : (dark ? "rgba(255,255,255,.06)" : "rgba(0,0,0,.06)"), color: valid ? "#fff" : t.textMuted }}>
                {loading ? "Processing..." : valid ? `Pay ${fN(numAmount)} Now` : "Enter amount"}
              </button>
            </div>
          </div>

          {/* Security */}
          <div className="fund-security">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: t.textMuted }}><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
            <span style={{ color: t.textMuted }}>Payments are encrypted and processed securely</span>
          </div>
        </div>
      </div>
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
      <div className="fund-rs-wallet" style={{ background: t.cardBg, borderWidth: 1, borderStyle: "solid", borderColor: t.cardBorder }}>
        <div className="fund-rs-bal-label" style={{ color: t.textMuted }}>Balance</div>
        <div className="m fund-rs-bal-val" style={{ color: t.green }}>{fN(balance)}</div>
      </div>

      <div className="fund-rs-divider" style={{ background: t.sidebarBorder }} />

      <div className="fund-rs-title" style={{ color: t.textMuted }}>Recent Deposits</div>
      {deposits.length > 0 ? deposits.map((tx, i) => (
        <div key={tx.id || i} className="fund-rs-deposit" style={{ background: t.cardBg }}>
          <div className="fund-rs-dep-row">
            <span className="m" style={{ color: t.green, fontWeight: 600 }}>+{fN(tx.amount)}</span>
            <span style={{ color: t.textMuted, fontSize: 12 }}>{tx.date ? fD(tx.date) : ""}</span>
          </div>
          <div style={{ fontSize: 13, color: t.textMuted }}>{tx.method || "Deposit"}</div>
        </div>
      )) : (
        <div style={{ fontSize: 13, color: t.textMuted, padding: "8px 4px" }}>No deposits yet</div>
      )}

      <div className="fund-rs-divider" style={{ background: t.sidebarBorder }} />

      <div className="fund-rs-title" style={{ color: t.textMuted }}>How It Works</div>
      {[["1", "Enter amount"], ["2", "Choose payment method"], ["3", "Pay securely"], ["4", "Balance credited instantly"]].map(([num, title]) => (
        <div key={num} className="fund-rs-step">
          <div className="m fund-rs-step-num" style={{ background: t.navActive, color: t.accent }}>{num}</div>
          <div className="fund-rs-step-text" style={{ color: t.textSoft }}>{title}</div>
        </div>
      ))}
    </>
  );
}
