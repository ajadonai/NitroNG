'use client';
import { useState, useEffect } from "react";
import { fN, fD } from "../lib/format";


/* ═══════════════════════════════════════════ */
/* ═══ REFERRALS PAGE                      ═══ */
/* ═══════════════════════════════════════════ */
export default function ReferralsPage({ user, dark, t }) {
  const [copied, setCopied] = useState(null);
  const [page, setPage] = useState(1);

  /* Per-page from shared localStorage */
  const [perPage, setPerPage] = useState(10);
  useEffect(() => { try { const s = localStorage.getItem("nitro-per-page"); if (s) setPerPage(Number(s)); } catch {} }, []);

  const refCode = user?.refCode || "—";
  const refLink = `https://nitro.ng/?ref=${refCode}`;
  const referrals = user?.referralList || [];
  const totalEarnings = user?.earnings || 0;
  const totalRefs = user?.refs || referrals.length;
  const activeRefs = referrals.filter(r => r.status === "Active").length;

  const totalPages = Math.ceil(referrals.length / perPage);
  const paged = referrals.slice((page - 1) * perPage, page * perPage);

  const copyText = (text, type) => {
    try { navigator.clipboard?.writeText(text); } catch {}
    setCopied(type);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <>
      {/* Header */}
      <div className="ref-header">
        <div className="ref-title" style={{ color: t.text }}>Referrals</div>
        <div className="ref-subtitle" style={{ color: t.textMuted }}>Earn rewards by inviting friends to Nitro</div>
        <div className="page-divider" style={{ background: t.cardBorder }} />
      </div>

      {/* Pending referral bonus banner */}
      {user?.pendingRefBonus && (
        <div style={{ padding: "12px 16px", borderRadius: 12, background: dark ? "rgba(196,125,142,.06)" : "rgba(196,125,142,.03)", border: `1px solid ${dark ? "rgba(196,125,142,.12)" : "rgba(196,125,142,.08)"}`, marginBottom: 16, display: "flex", alignItems: "center", gap: 10 }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={t.accent} strokeWidth="2" strokeLinecap="round"><path d="M20 12v6a2 2 0 01-2 2H6a2 2 0 01-2-2v-6"/><path d="M2 8h20v4H2z"/><path d="M12 20V8"/></svg>
          <div>
            <div style={{ fontSize: 14, fontWeight: 500, color: t.text }}>Your referral bonus is waiting</div>
            <div style={{ fontSize: 13, color: t.textMuted, marginTop: 2 }}>Deposit {fN(user.refMinDeposit)} or more to unlock your welcome bonus</div>
          </div>
        </div>
      )}

      {/* Share card */}
      <div className="ref-share-card" style={{ background: dark ? "rgba(255,255,255,.03)" : "rgba(255,255,255,.85)", border: `0.5px solid ${t.cardBorder}` }}>
        <div className="ref-share-label" style={{ color: t.textMuted }}>Your Referral</div>
        <div className="ref-share-row">
          {/* Code */}
          <div className="ref-share-col">
            <div className="ref-field-label" style={{ color: t.textMuted }}>Referral Code</div>
            <div className="ref-code-row">
              <div className="m ref-code" style={{ color: t.accent }}>{refCode}</div>
              <button onClick={() => copyText(refCode, "code")} className="ref-copy-btn" style={{ borderColor: t.cardBorder, color: copied === "code" ? t.green : t.textSoft }}>
                {copied === "code" ? "Copied ✓" : "Copy"}
              </button>
            </div>
          </div>
          {/* Link */}
          <div className="ref-share-col ref-share-col-link">
            <div className="ref-field-label" style={{ color: t.textMuted }}>Share Link</div>
            <div className="ref-link-row">
              <div className="m ref-link-box" style={{ background: dark ? "#0d1020" : "#fff", borderColor: dark ? "rgba(255,255,255,.1)" : "rgba(0,0,0,.12)", color: t.textSoft }}>{refLink}</div>
              <button onClick={() => copyText(`https://${refLink}`, "link")} className="ref-copy-link-btn">
                {copied === "link" ? "Copied ✓" : "Copy Link"}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="ref-stats">
        {[
          ["Friends Invited", String(totalRefs), dark ? "#a5b4fc" : "#4f46e5"],
          ["Active", String(activeRefs), t.green],
          ["Total Bonus", fN(totalEarnings), t.accent],
          ["Available", fN(totalEarnings), t.green],
        ].map(([label, val, color]) => (
          <div key={label} className="ref-stat-card" style={{ background: dark ? "rgba(255,255,255,.03)" : "rgba(255,255,255,.85)", border: `0.5px solid ${t.cardBorder}` }}>
            <div className="ref-stat-label" style={{ color: t.textMuted }}>{label}</div>
            <div className="m ref-stat-val" style={{ color }}>{val}</div>
          </div>
        ))}
      </div>

      {/* Referral list */}
      <div className="ref-list" style={{ background: dark ? "rgba(255,255,255,.03)" : "rgba(255,255,255,.85)", border: `0.5px solid ${t.cardBorder}` }}>
        <div style={{ padding: "16px 18px 0" }}>
          <div className="ref-section-title" style={{ color: t.textMuted }}>Your referrals</div>
        </div>
        <div className="ref-list-divider" style={{ background: t.cardBorder }} />
        {paged.length > 0 ? paged.map((r, i) => (
          <div key={r.id || i} className="ref-row" style={{ borderBottom: i < paged.length - 1 ? `1px solid ${t.cardBorder}` : "none" }}>
            <div className="ref-avatar" style={{ background: dark ? "rgba(196,125,142,.1)" : "rgba(196,125,142,.06)", color: t.accent }}>{(r.name || "?").charAt(0)}</div>
            <div className="ref-info">
              <div className="ref-info-top">
                <span className="ref-info-name" style={{ color: t.text }}>{r.name || "User"}</span>
                <span className="ref-status-badge" style={{
                  background: r.status === "Active" ? (dark ? "#0a2416" : "#ecfdf5") : (dark ? "#1a1a1a" : "#f5f5f5"),
                  color: r.status === "Active" ? (dark ? "#6ee7b7" : "#059669") : (dark ? "#888" : "#666"),
                  borderColor: r.status === "Active" ? (dark ? "#166534" : "#a7f3d0") : (dark ? "#404040" : "#d4d4d4"),
                }}>{r.status || "—"}</span>
              </div>
              <div className="ref-info-meta" style={{ color: t.textMuted }}>
                <span>{r.email || ""}</span>
                <span>{r.joined ? fD(r.joined) : ""}</span>
              </div>
            </div>
            <div className="m ref-bonus" style={{ color: t.green }}>+{fN(r.bonus || 0)}</div>
          </div>
        )) : (
          <div className="ref-empty" style={{ padding: "40px 20px", textAlign: "center" }}>
            <svg width="48" height="48" viewBox="0 0 64 64" fill="none" style={{ marginBottom: 14, opacity: .5 }}>
              <circle cx="24" cy="24" r="8" stroke={t.accent} strokeWidth="1.5" opacity=".25" />
              <circle cx="40" cy="24" r="8" stroke={t.accent} strokeWidth="1.5" opacity=".15" />
              <path d="M24 36c-8 0-14 4-14 10v2h28v-2c0-6-6-10-14-10z" stroke={t.accent} strokeWidth="1.5" opacity=".2" />
              <path d="M26 16l6-4 6 4" stroke={t.accent} strokeWidth="1.5" opacity=".2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <div style={{ fontSize: 16, fontWeight: 600, color: t.textSoft, marginBottom: 4 }}>No referrals yet — share the love 🤝</div>
            <div style={{ fontSize: 15, color: t.textMuted, lineHeight: 1.5 }}>Invite friends, earn ₦500 each time they sign up and order</div>
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="ref-pagination">
          <span style={{ fontSize: 14, color: t.textMuted }}>{referrals.length} referrals</span>
          <div className="ref-pag-btns">
            <button onClick={() => setPage(Math.max(1, page - 1))} disabled={page <= 1} className="ref-pag-btn" style={{ borderColor: t.cardBorder, color: t.textSoft, opacity: page <= 1 ? .3 : 1 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>
            </button>
            {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
              let p;
              if (totalPages <= 5) p = i + 1;
              else if (page <= 2) p = i + 1;
              else if (page >= totalPages - 1) p = totalPages - 4 + i;
              else p = page - 2 + i;
              return (
                <button key={p} onClick={() => setPage(p)} className={`m ref-pag-num`} style={{ background: page === p ? t.navActive : "transparent", color: page === p ? t.accent : t.textMuted, borderColor: page === p ? t.accent + "40" : t.cardBorder }}>{p}</button>
              );
            })}
            <button onClick={() => setPage(Math.min(totalPages, page + 1))} disabled={page >= totalPages} className="ref-pag-btn" style={{ borderColor: t.cardBorder, color: t.textSoft, opacity: page >= totalPages ? .3 : 1 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>
            </button>
          </div>
        </div>
      )}

      {/* Mobile referral card (shows how-it-works on tablet/mobile since sidebar hidden) */}
      <div className="ref-mobile-how">
        <div className="ref-section-title" style={{ color: t.textMuted }}>How it works</div>
        <div className="ref-how-steps">
          {[
            ["1", "Share your link", "Send your referral link to friends"],
            ["2", "They sign up", "Your friend creates a Nitro account"],
            ["3", "You earn", "Bonus is credited to your wallet"],
          ].map(([num, title, desc]) => (
            <div key={num} className="ref-how-step">
              <div className="m ref-how-num" style={{ background: t.navActive, color: t.accent }}>{num}</div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: t.text }}>{title}</div>
                <div style={{ fontSize: 14, color: t.textMuted }}>{desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

/* ═══════════════════════════════════════════ */
/* ═══ REFERRALS RIGHT SIDEBAR             ═══ */
/* ═══════════════════════════════════════════ */
export function ReferralsSidebar({ user, dark, t }) {
  const referrals = user?.referralList || [];
  const totalEarnings = user?.earnings || 0;
  const activeRefs = referrals.filter(r => r.status === "Active").length;
  const totalRefs = user?.refs || referrals.length;

  return (
    <>
      {/* How it works */}
      <div className="ref-rs-title" style={{ color: t.textMuted }}>How It Works</div>
      {[
        ["1", "Share your link", "Send your referral link to friends"],
        ["2", "They sign up", "Your friend creates a Nitro account"],
        ["3", "You earn", "Bonus is credited to your wallet"],
      ].map(([num, title, desc]) => (
        <div key={num} className="ref-rs-step">
          <div className="m ref-rs-num" style={{ background: t.navActive, color: t.accent }}>{num}</div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: t.text, marginBottom: 1 }}>{title}</div>
            <div style={{ fontSize: 14, color: t.textMuted }}>{desc}</div>
          </div>
        </div>
      ))}

      <div className="ref-rs-divider" style={{ background: t.sidebarBorder }} />

      {/* Current reward */}
      <div className="ref-rs-title" style={{ color: t.textMuted }}>Current Reward</div>
      <div className="ref-rs-reward" style={{ background: dark ? "rgba(255,255,255,.03)" : "rgba(255,255,255,.85)", border: `0.5px solid ${t.cardBorder}` }}>
        <div className="m ref-rs-reward-val" style={{ color: t.accent }}>₦500</div>
        <div className="ref-rs-reward-sub" style={{ color: t.textMuted }}>per successful referral</div>
      </div>

      <div className="ref-rs-divider" style={{ background: t.sidebarBorder }} />

      {/* Performance */}
      <div className="ref-rs-title" style={{ color: t.textMuted }}>Your Performance</div>
      <div className="ref-rs-perf" style={{ background: t.cardBg }}>
        {[
          ["This month", `${Math.min(totalRefs, 3)} referrals`, t.green],
          ["Total earned", fN(totalEarnings), t.accent],
          ["Sign-up rate", totalRefs > 0 ? `${Math.round(activeRefs / totalRefs * 100)}%` : "0%", dark ? "#a5b4fc" : "#4f46e5"],
        ].map(([label, val, color], i, arr) => (
          <div key={label} className="ref-rs-perf-row" style={{ borderBottom: i < arr.length - 1 ? `1px solid ${t.cardBorder}` : "none" }}>
            <span style={{ fontSize: 14, color: t.textMuted }}>{label}</span>
            <span style={{ fontSize: 14, fontWeight: 600, color }}>{val}</span>
          </div>
        ))}
      </div>
    </>
  );
}
