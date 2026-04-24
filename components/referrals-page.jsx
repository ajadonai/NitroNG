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
      <div className="pb-2 desktop:pb-3.5">
        <div className="text-lg desktop:text-[22px] font-semibold mb-0.5" style={{ color: t.text }}>Referrals</div>
        <div className="text-sm desktop:text-[15px]" style={{ color: t.textMuted }}>Earn rewards by inviting friends to Nitro</div>
        <div className="page-divider" style={{ background: t.cardBorder }} />
      </div>

      {/* Pending referral bonus banner */}
      {user?.pendingRefBonus && (
        <div className="py-3 px-4 rounded-xl mb-4 flex items-center gap-2.5" style={{ background: dark ? "rgba(196,125,142,.12)" : "rgba(196,125,142,.06)", border: `1px solid ${dark ? "rgba(196,125,142,.19)" : "rgba(196,125,142,.14)"}` }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={t.accent} strokeWidth="2" strokeLinecap="round"><path d="M20 12v6a2 2 0 01-2 2H6a2 2 0 01-2-2v-6"/><path d="M2 8h20v4H2z"/><path d="M12 20V8"/></svg>
          <div>
            <div className="text-sm font-medium" style={{ color: t.text }}>Your referral bonus is waiting</div>
            <div className="text-[13px] mt-0.5" style={{ color: t.textMuted }}>Deposit {fN(user.refMinDeposit)} or more to unlock your welcome bonus</div>
          </div>
        </div>
      )}

      {/* Share card */}
      <div className="rounded-xl desktop:rounded-2xl p-3.5 desktop:p-5 mb-3 desktop:mb-4" style={{ background: dark ? "rgba(255,255,255,.06)" : "rgba(255,255,255,.85)", border: `0.5px solid ${t.cardBorder}` }}>
        <div className="flex flex-col desktop:flex-row gap-2.5 desktop:gap-3">
          {/* Code */}
          <div className="flex-1">
            <div className="text-sm mb-1" style={{ color: t.textMuted }}>Referral Code</div>
            <div className="flex items-center gap-2">
              <div className="m text-base desktop:text-[22px] font-semibold tracking-[2px]" style={{ color: t.accent }}>{refCode}</div>
              <button onClick={() => copyText(refCode, "code")} className="py-1.5 px-3 rounded-md border text-[13px] font-semibold cursor-pointer bg-transparent transition-transform duration-200 hover:-translate-y-px" style={{ borderColor: t.cardBorder, color: copied === "code" ? t.green : t.textSoft }}>
                {copied === "code" ? <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{display:"inline",verticalAlign:"middle"}}><polyline points="20 6 9 17 4 12"/></svg> Copied</> : "Copy"}
              </button>
            </div>
          </div>
          {/* Link */}
          <div className="flex-1 desktop:flex-[1.5]">
            <div className="text-sm mb-1" style={{ color: t.textMuted }}>Share Link</div>
            <div className="flex items-center gap-2">
              <div className="m flex-1 py-2 px-3 rounded-lg border text-sm overflow-hidden text-ellipsis whitespace-nowrap" style={{ background: dark ? "#0d1020" : "#fff", borderColor: dark ? "rgba(255,255,255,.18)" : "rgba(0,0,0,.19)", color: t.textSoft }}>{refLink}</div>
              <button onClick={() => copyText(`https://${refLink}`, "link")} className="py-2 px-3 desktop:px-3.5 rounded-lg text-[13px] desktop:text-sm font-semibold cursor-pointer whitespace-nowrap shrink-0 border-none text-white transition-[transform,box-shadow] duration-200 hover:-translate-y-px hover:shadow-[0_6px_20px_rgba(196,125,142,.31)]" style={{ background: "linear-gradient(135deg, #c47d8e, #8b5e6b)" }}>
                {copied === "link" ? <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{display:"inline",verticalAlign:"middle"}}><polyline points="20 6 9 17 4 12"/></svg> Copied</> : "Copy Link"}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 desktop:grid-cols-4 gap-2 desktop:gap-2.5 mb-3 desktop:mb-4">
        {[
          ["Friends Invited", String(totalRefs), dark ? "#a5b4fc" : "#4f46e5"],
          ["Active", String(activeRefs), t.green],
          ["Total Bonus", fN(totalEarnings), t.accent],
          ["Available", fN(totalEarnings), t.green],
        ].map(([label, val, color]) => (
          <div key={label} className="p-3 desktop:p-3.5 rounded-[10px] desktop:rounded-xl" style={{ background: dark ? "rgba(255,255,255,.06)" : "rgba(255,255,255,.85)", border: `0.5px solid ${t.cardBorder}` }}>
            <div className="text-xs desktop:text-[13px] uppercase tracking-[0.5px] mb-1" style={{ color: t.textMuted }}>{label}</div>
            <div className="m text-base desktop:text-lg font-semibold" style={{ color }}>{val}</div>
          </div>
        ))}
      </div>

      {/* Referral list */}
      <div className="rounded-xl desktop:rounded-[14px] overflow-hidden" style={{ background: dark ? "rgba(255,255,255,.06)" : "rgba(255,255,255,.85)", border: `0.5px solid ${t.cardBorder}` }}>
        <div className="py-3 px-[13px] desktop:px-[18px]" style={{ background: dark ? "rgba(196,125,142,.18)" : "rgba(196,125,142,.12)", borderBottom: `1px solid ${dark ? "rgba(255,255,255,.08)" : "rgba(0,0,0,.08)"}` }}>
          <div className="text-sm font-semibold tracking-[0.3px] uppercase" style={{ color: t.textMuted }}>Your referrals</div>
        </div>
        {paged.length > 0 ? paged.map((r, i) => (
          <div key={r.id || i} className="flex items-center gap-2.5 desktop:gap-3.5 py-3 px-[13px] desktop:py-3.5 desktop:px-4" style={{ borderBottom: i < paged.length - 1 ? `1px solid ${t.cardBorder}` : "none" }}>
            <div className="w-8 h-8 desktop:w-9 desktop:h-9 rounded-[10px] flex items-center justify-center text-sm desktop:text-base font-semibold shrink-0" style={{ background: dark ? "rgba(196,125,142,.1)" : "rgba(196,125,142,.06)", color: t.accent }}>{(r.name || "?").charAt(0)}</div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 mb-0.5">
                <span className="text-sm desktop:text-[15px] font-medium" style={{ color: t.text }}>{r.name || "User"}</span>
                <span className="text-xs py-px px-1.5 rounded font-semibold border-[0.5px]" style={{
                  background: r.status === "Active" ? (dark ? "#0a2416" : "#ecfdf5") : (dark ? "#1a1a1a" : "#f5f5f5"),
                  color: r.status === "Active" ? (dark ? "#6ee7b7" : "#059669") : (dark ? "#888" : "#666"),
                  borderColor: r.status === "Active" ? (dark ? "#166534" : "#a7f3d0") : (dark ? "#404040" : "#d4d4d4"),
                }}>{r.status || "—"}</span>
              </div>
              <div className="flex gap-1.5 desktop:gap-2.5 text-[13px] desktop:text-sm" style={{ color: t.textMuted }}>
                <span>{r.email || ""}</span>
                <span>{r.joined ? fD(r.joined) : ""}</span>
              </div>
            </div>
            <div className="m text-[15px] desktop:text-base font-semibold shrink-0" style={{ color: t.green }}>+{fN(r.bonus || 0)}</div>
          </div>
        )) : (
          <div className="p-10 text-center">
            <svg width="48" height="48" viewBox="0 0 64 64" fill="none" style={{ display: "block", margin: "0 auto 14px", opacity: .7 }}>
              <circle cx="24" cy="24" r="8" stroke={t.accent} strokeWidth="1.5" opacity=".25" />
              <circle cx="40" cy="24" r="8" stroke={t.accent} strokeWidth="1.5" opacity=".15" />
              <path d="M24 36c-8 0-14 4-14 10v2h28v-2c0-6-6-10-14-10z" stroke={t.accent} strokeWidth="1.5" opacity=".2" />
              <path d="M26 16l6-4 6 4" stroke={t.accent} strokeWidth="1.5" opacity=".2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <div className="text-base font-semibold mb-1" style={{ color: t.textSoft }}>No referrals yet — share the love</div>
            <div className="text-[15px] leading-normal" style={{ color: t.textMuted }}>Invite friends, earn ₦500 each time they sign up and order</div>
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-between items-center mt-3.5">
          <span className="text-sm" style={{ color: t.textMuted }}>{referrals.length} referrals</span>
          <div className="flex gap-1">
            <button onClick={() => setPage(Math.max(1, page - 1))} disabled={page <= 1} className="w-[30px] h-[30px] rounded-md flex items-center justify-center border cursor-pointer bg-transparent transition-transform duration-200 hover:-translate-y-px" style={{ borderColor: t.cardBorder, color: t.textSoft, opacity: page <= 1 ? .3 : 1 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>
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
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>
            </button>
          </div>
        </div>
      )}

      {/* Mobile referral card (shows how-it-works on tablet/mobile since sidebar hidden) */}
      <div className="hidden max-desktop:block mt-4">
        <div className="text-sm font-semibold tracking-[0.3px] uppercase" style={{ color: t.textMuted }}>How it works</div>
        <div className="flex flex-col gap-3 mt-3">
          {[
            ["1", "Share your link", "Send your referral link to friends"],
            ["2", "They sign up", "Your friend creates a Nitro account"],
            ["3", "You earn", "Bonus is credited to your wallet"],
          ].map(([num, title, desc]) => (
            <div key={num} className="flex gap-3">
              <div className="m w-7 h-7 rounded-lg flex items-center justify-center text-sm font-semibold shrink-0" style={{ background: t.navActive, color: t.accent }}>{num}</div>
              <div>
                <div className="text-sm font-semibold" style={{ color: t.text }}>{title}</div>
                <div className="text-sm" style={{ color: t.textMuted }}>{desc}</div>
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
      <div className="text-[13px] font-semibold uppercase tracking-[1.5px] mb-3 py-2 px-3 rounded-lg" style={{ color: t.textMuted, background: dark ? "rgba(196,125,142,.18)" : "rgba(196,125,142,.12)" }}>How It Works</div>
      {[
        ["1", "Share your link", "Send your referral link to friends"],
        ["2", "They sign up", "Your friend creates a Nitro account"],
        ["3", "You earn", "Bonus is credited to your wallet"],
      ].map(([num, title, desc]) => (
        <div key={num} className="flex gap-3 mb-3 px-1">
          <div className="m w-7 h-7 rounded-lg flex items-center justify-center text-sm font-semibold shrink-0" style={{ background: t.navActive, color: t.accent }}>{num}</div>
          <div>
            <div className="text-sm font-semibold mb-px" style={{ color: t.text }}>{title}</div>
            <div className="text-sm" style={{ color: t.textMuted }}>{desc}</div>
          </div>
        </div>
      ))}

      <div className="h-px my-2 mb-4" style={{ background: t.sidebarBorder }} />

      {/* Current reward */}
      <div className="text-[13px] font-semibold uppercase tracking-[1.5px] mb-3 py-2 px-3 rounded-lg" style={{ color: t.textMuted, background: dark ? "rgba(196,125,142,.18)" : "rgba(196,125,142,.12)" }}>Current Reward</div>
      <div className="p-4 rounded-xl text-center mb-4" style={{ background: dark ? "rgba(255,255,255,.06)" : "rgba(255,255,255,.85)", border: `0.5px solid ${t.cardBorder}` }}>
        <div className="m text-[28px] font-semibold" style={{ color: t.accent }}>₦500</div>
        <div className="text-sm mt-1" style={{ color: t.textMuted }}>per successful referral</div>
      </div>

      <div className="h-px my-2 mb-4" style={{ background: t.sidebarBorder }} />

      {/* Performance */}
      <div className="text-[13px] font-semibold uppercase tracking-[1.5px] mb-3 py-2 px-3 rounded-lg" style={{ color: t.textMuted, background: dark ? "rgba(196,125,142,.18)" : "rgba(196,125,142,.12)" }}>Your Performance</div>
      <div className="p-3.5 rounded-[10px]" style={{ background: t.cardBg }}>
        {[
          ["This month", `${Math.min(totalRefs, 3)} referrals`, t.green],
          ["Total earned", fN(totalEarnings), t.accent],
          ["Sign-up rate", totalRefs > 0 ? `${Math.round(activeRefs / totalRefs * 100)}%` : "0%", dark ? "#a5b4fc" : "#4f46e5"],
        ].map(([label, val, color], i, arr) => (
          <div key={label} className="flex justify-between py-2" style={{ borderBottom: i < arr.length - 1 ? `1px solid ${t.cardBorder}` : "none" }}>
            <span className="text-sm" style={{ color: t.textMuted }}>{label}</span>
            <span className="text-sm font-semibold" style={{ color }}>{val}</span>
          </div>
        ))}
      </div>
    </>
  );
}
