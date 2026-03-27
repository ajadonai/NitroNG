'use client';
import { useState } from "react";

const fN = (a) => `₦${Math.abs(a).toLocaleString("en-NG")}`;
const fD = (d) => new Date(d).toLocaleDateString("en-NG", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });

const PRESETS = [1000, 2000, 5000, 10000, 20000, 50000];

const METHODS = [
  { id: "paystack", label: "Paystack", desc: "Cards, bank transfer, USSD", icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>, available: true },
  { id: "flutterwave", label: "Flutterwave", desc: "Cards, bank transfer, mobile money", icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>, available: true },
  { id: "bank", label: "Bank Transfer", desc: "Direct transfer to our account", icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 21h18M3 10h18M5 6l7-3 7 3M4 10v11M8 10v11M12 10v11M16 10v11M20 10v11"/></svg>, available: true },
  { id: "crypto", label: "Crypto", desc: "USDT, BTC, ETH", icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9 12h6M9 9h3a3 3 0 010 6H9V7"/></svg>, available: false, soon: true },
  { id: "monnify", label: "Monnify", desc: "Auto-confirmed bank transfer", icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>, available: false, soon: true },
];

/* ═══════════════════════════════════════════ */
/* ═══ ADD FUNDS PAGE                      ═══ */
/* ═══════════════════════════════════════════ */
export default function AddFundsPage({ user, dark, t }) {
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("paystack");

  const numAmount = Number(amount) || 0;
  const balance = user?.balance || 0;

  const handlePay = () => {
    if (numAmount < 500) return;
    /* TODO: Wire to Paystack/Flutterwave/bank transfer flow */
    alert(`Payment of ${fN(numAmount)} via ${method} — coming soon!`);
  };

  return (
    <>
      <div className="fund-header">
        <div className="fund-title" style={{ color: t.text }}>Add Funds</div>
        <div className="fund-subtitle" style={{ color: t.textMuted }}>Top up your wallet to place orders</div>
        <div className="page-divider" style={{ background: t.cardBorder }} />
      </div>

      <div className="fund-content">
        {/* Current balance */}
        <div className="fund-balance-card" style={{ background: dark ? "rgba(110,231,183,.04)" : "rgba(5,150,105,.03)", borderWidth: 1, borderStyle: "solid", borderColor: dark ? "rgba(110,231,183,.1)" : "rgba(5,150,105,.08)" }}>
          <div className="fund-bal-label" style={{ color: t.textMuted }}>Current Balance</div>
          <div className="m fund-bal-value" style={{ color: t.green }}>{fN(balance)}</div>
        </div>

        {/* Amount input */}
        <div className="fund-section">
          <div className="fund-section-label" style={{ color: t.textMuted }}>Amount</div>
          <div className="fund-amount-wrap">
            <span className="fund-currency" style={{ color: t.textSoft }}>₦</span>
            <input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0" className="m fund-amount-input" style={{ color: t.text, background: "transparent" }} />
          </div>
          <div className="fund-amount-box" style={{ borderColor: t.cardBorder, background: t.cardBg }}>
            <div className="fund-presets">
              {PRESETS.map(p => (
                <button key={p} onClick={() => setAmount(String(p))} className="m fund-preset" style={{ borderWidth: numAmount === p ? 1.5 : 1, borderStyle: "solid", borderColor: numAmount === p ? t.accent : t.cardBorder, background: numAmount === p ? (dark ? "#2a1a22" : "#fdf2f4") : "transparent", color: numAmount === p ? t.accent : t.textMuted }}>
                  {p >= 1000 ? `${p / 1000}K` : p}
                </button>
              ))}
            </div>
          </div>
          {numAmount > 0 && numAmount < 500 && (
            <div className="fund-min-warn" style={{ color: dark ? "#fcd34d" : "#d97706" }}>Minimum deposit is ₦500</div>
          )}
        </div>

        {/* Payment method */}
        <div className="fund-section">
          <div className="fund-section-label" style={{ color: t.textMuted }}>Payment Method</div>
          <div className="fund-methods">
            {METHODS.map(m => {
              const active = method === m.id && m.available;
              return (
                <button key={m.id} onClick={() => m.available && setMethod(m.id)} className="fund-method" style={{ borderWidth: active ? 2 : 1, borderStyle: "solid", borderColor: active ? t.accent : t.cardBorder, background: active ? (dark ? "#2a1a22" : "#fdf2f4") : t.cardBg, opacity: m.available ? 1 : .5, cursor: m.available ? "pointer" : "default" }}>
                  <div className="fund-method-icon" style={{ color: active ? t.accent : t.textSoft }}>{m.icon}</div>
                  <div className="fund-method-info">
                    <div className="fund-method-name" style={{ color: active ? t.accent : t.text }}>
                      {m.label}
                      {m.soon && <span className="fund-soon-badge" style={{ background: dark ? "#1c1608" : "#fffbeb", color: dark ? "#fcd34d" : "#d97706" }}>Soon</span>}
                    </div>
                    <div className="fund-method-desc" style={{ color: t.textMuted }}>{m.desc}</div>
                  </div>
                  {active && <div className="fund-method-check" style={{ color: t.accent }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                  </div>}
                </button>
              );
            })}
          </div>
        </div>

        {/* Bank transfer details — show when bank is selected */}
        {method === "bank" && (
          <div className="fund-bank-details" style={{ background: t.cardBg, borderWidth: 1, borderStyle: "solid", borderColor: t.cardBorder }}>
            <div className="fund-bank-title" style={{ color: t.text }}>Transfer to this account</div>
            <div className="fund-bank-grid">
              {[
                ["Bank", "Wema Bank"],
                ["Account Name", "Nitro Technologies"],
                ["Account Number", "0123456789"],
              ].map(([label, val]) => (
                <div key={label}>
                  <div className="fund-bank-label" style={{ color: t.textMuted }}>{label}</div>
                  <div className="m fund-bank-val" style={{ color: t.text }}>{val}</div>
                </div>
              ))}
            </div>
            <div className="fund-bank-note" style={{ color: t.textMuted }}>After transfer, your wallet will be credited automatically within 5-15 minutes. Use your registered email as the transfer narration.</div>
          </div>
        )}

        {/* Summary + Pay button */}
        {numAmount >= 500 && method !== "bank" && (
          <div className="fund-summary" style={{ background: t.cardBg, borderWidth: 1, borderStyle: "solid", borderColor: t.cardBorder }}>
            <div className="fund-sum-row" style={{ color: t.textMuted }}>
              <span>Amount</span>
              <span className="m" style={{ color: t.text }}>{fN(numAmount)}</span>
            </div>
            <div className="fund-sum-row" style={{ color: t.textMuted }}>
              <span>Method</span>
              <span style={{ color: t.text }}>{METHODS.find(m => m.id === method)?.label}</span>
            </div>
            <div className="fund-sum-total" style={{ borderColor: t.cardBorder }}>
              <span style={{ fontWeight: 600, color: t.textMuted }}>New Balance</span>
              <span className="m fund-sum-new-bal" style={{ color: t.green }}>{fN(balance + numAmount)}</span>
            </div>
          </div>
        )}

        <button onClick={handlePay} className="fund-pay-btn" style={{ opacity: numAmount >= 500 ? 1 : .4 }} disabled={numAmount < 500}>
          {method === "bank" ? "I've made the transfer" : `Pay ${numAmount >= 500 ? fN(numAmount) : ""}`}
        </button>
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
  const totalDeposited = deposits.reduce((s, tx) => s + (tx.amount || 0), 0);

  return (
    <>
      {/* Wallet */}
      <div className="fund-rs-title" style={{ color: t.textMuted }}>Wallet</div>
      <div className="fund-rs-wallet" style={{ background: t.cardBg, borderWidth: 1, borderStyle: "solid", borderColor: t.cardBorder }}>
        <div className="fund-rs-bal-label" style={{ color: t.textMuted }}>Balance</div>
        <div className="m fund-rs-bal-val" style={{ color: t.green }}>{fN(balance)}</div>
      </div>

      <div className="fund-rs-divider" style={{ background: t.sidebarBorder }} />

      {/* Payment info */}
      <div className="fund-rs-title" style={{ color: t.textMuted }}>Payment Info</div>
      <div className="fund-rs-info" style={{ background: t.cardBg }}>
        {[
          ["Minimum", "₦500"],
          ["Processing", "Instant"],
          ["Fee", "Free"],
        ].map(([label, val], i, arr) => (
          <div key={label} className="fund-rs-info-row" style={{ borderBottom: i < arr.length - 1 ? `1px solid ${t.cardBorder}` : "none" }}>
            <span style={{ color: t.textMuted }}>{label}</span>
            <span className="m" style={{ color: t.text, fontWeight: 600 }}>{val}</span>
          </div>
        ))}
      </div>

      <div className="fund-rs-divider" style={{ background: t.sidebarBorder }} />

      {/* Recent deposits */}
      <div className="fund-rs-title" style={{ color: t.textMuted }}>Recent Deposits</div>
      {deposits.length > 0 ? deposits.map((tx, i) => (
        <div key={tx.id || i} className="fund-rs-deposit" style={{ background: t.cardBg }}>
          <div className="fund-rs-dep-row">
            <span className="m" style={{ color: t.green, fontWeight: 600 }}>+{fN(tx.amount)}</span>
            <span style={{ color: t.textMuted, fontSize: 10 }}>{tx.date ? fD(tx.date) : ""}</span>
          </div>
          <div style={{ fontSize: 11, color: t.textMuted }}>{tx.method || "Deposit"}</div>
        </div>
      )) : (
        <div style={{ fontSize: 11, color: t.textMuted, padding: "8px 4px" }}>No deposits yet</div>
      )}
    </>
  );
}
