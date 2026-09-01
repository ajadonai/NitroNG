'use client';
import { useState } from "react";
import { useToast } from "./toast";
import { copyText } from '@/lib/clipboard';

// The cash referral page from the approved mock: hero with the link, the four
// money facts, Get paid (cash to bank from the minimum, or wallet credit at a
// premium), the friends list with per-friend status, and past payouts. Only
// rendered when /api/referrals/cash says enabled — see referrals-page.jsx.

const fN = k => `₦${Math.round(k / 100).toLocaleString()}`;
const initials = n => (n || "?").split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase();
const fD = d => new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short" });

export default function CashReferralsPage({ data, dark, t, onRefresh }) {
  const toast = useToast();
  const [method, setMethod] = useState("cash");
  const [bank, setBank] = useState({ bankName: "", bankAccountNo: "", bankAccountName: "" });
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const s = data.summary;
  const link = `https://nitro.ng/?ref=${data.refCode}`;
  const overLine = s.available >= data.minPayout;
  const card = { background: t.cardBg, border: `1px solid ${t.cardBorder}` };
  const green = dark ? "#6ee7b7" : "#059669";
  const amber = dark ? "#fcd34d" : "#b45309";

  const act = async (body, okMsg) => {
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch("/api/referrals/cash", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const d = await res.json();
      if (res.ok && d.success) { toast.success(okMsg, d.message || ""); onRefresh?.(); }
      else toast.error("That didn't work", d.error || "Try again");
    } catch { toast.error("Network error", "Check your connection"); }
    setBusy(false);
  };

  const copy = () => { try { copyText(link); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch {} };

  const STATUS = {
    available: { label: "Earned", clr: green, bg: dark ? "rgba(110,231,183,.12)" : "rgba(5,150,105,.08)" },
    paid: { label: "Paid out", clr: green, bg: dark ? "rgba(110,231,183,.12)" : "rgba(5,150,105,.08)" },
    credited: { label: "To wallet", clr: green, bg: dark ? "rgba(110,231,183,.12)" : "rgba(5,150,105,.08)" },
    requested: { label: "Paying out", clr: amber, bg: dark ? "rgba(251,191,36,.12)" : "rgba(217,119,6,.08)" },
    held: { label: "Clearing", clr: amber, bg: dark ? "rgba(251,191,36,.12)" : "rgba(217,119,6,.08)" },
    voided: { label: "Reversed", clr: t.textMuted, bg: dark ? "rgba(255,255,255,.08)" : "rgba(0,0,0,.05)" },
  };

  return (
    <>
      <div className="pb-2 desktop:pb-3.5">
        <div className="text-lg desktop:text-[22px] font-semibold mb-0.5 text-t-text">Referrals</div>
        <div className="text-sm desktop:text-[15px] text-t-text-muted">{fN(data.amount)} cash for every friend who funds their account</div>
        <div className="page-divider bg-t-card-border" />
      </div>

      {/* Hero */}
      <div className="rounded-2xl p-4 desktop:p-5 mb-4" style={{ background: dark ? "linear-gradient(135deg,rgba(196,125,142,.18),rgba(139,94,107,.08))" : "linear-gradient(135deg,rgba(196,125,142,.12),rgba(139,94,107,.05))", border: `1px solid ${dark ? "rgba(196,125,142,.35)" : "rgba(196,125,142,.28)"}` }}>
        <div className="text-[16px] font-bold text-t-text">Invite a friend, get paid actual cash.</div>
        <div className="text-[13px] mt-1 leading-relaxed text-t-text-muted">They deposit {fN(250000)} or more, you earn {fN(data.amount)} — to your bank, not just your wallet. They still get their welcome bonus too.</div>
        <div className="flex gap-2 mt-3">
          <div className="m flex-1 min-w-0 py-2 px-3 rounded-[10px] text-[13px] overflow-hidden text-ellipsis whitespace-nowrap text-t-text-soft" style={{ background: dark ? "#131728" : "#fff", border: `1px solid ${t.cardBorder}` }}>{link}</div>
          <button onClick={copy} className="py-2 px-3.5 rounded-[10px] text-[13px] font-semibold cursor-pointer whitespace-nowrap shrink-0 border-none text-white" style={{ background: "linear-gradient(135deg,#c47d8e,#8b5e6b)" }}>{copied ? "Copied" : "Copy link"}</button>
        </div>
      </div>

      {/* Facts */}
      <div className="grid grid-cols-2 desktop:grid-cols-4 gap-2 mb-4">
        {[["Available", fN(s.available), green], ["On hold", fN(s.held + s.requested), amber], ["Paid out", fN(s.paidOut), t.text], ["Friends", String(data.earnings.length + data.waiting.length), t.text]].map(([label, val, color]) => (
          <div key={label} className="p-3 rounded-xl" style={card}>
            <div className="text-[10.5px] uppercase tracking-[0.8px] font-semibold mb-1 text-t-text-muted">{label}</div>
            <div className="m text-[17px] font-bold" style={{ color }}>{val}</div>
          </div>
        ))}
      </div>

      {/* Get paid */}
      <div className="rounded-2xl overflow-hidden mb-4" style={card}>
        <div className="py-2.5 px-4 text-[11px] font-bold uppercase tracking-[1.2px] text-t-text-muted" style={{ borderBottom: `1px solid ${t.cardBorder}` }}>Get paid</div>
        <div className="p-3.5 flex flex-col gap-2.5">
          {[["cash", "Cash to my bank", `From ${fN(data.minPayout)} · arrives within 2 days`, `${fN(data.amount)} / friend`], ["wallet", "Wallet credit, instantly", "No minimum · spends on any service", `${fN(data.walletAmount)} / friend`]].map(([id, title, sub, amt]) => (
            <button key={id} onClick={() => setMethod(id)} className="flex items-center gap-3 rounded-xl p-3 text-left cursor-pointer font-[inherit] w-full" style={{ background: "transparent", border: `1px solid ${method === id ? t.accent : t.cardBorder}`, boxShadow: method === id ? `0 0 0 1px ${t.accent} inset` : "none" }}>
              <span className="w-[17px] h-[17px] rounded-full shrink-0" style={{ border: `2px solid ${method === id ? t.accent : t.cardBorder}`, background: method === id ? `radial-gradient(circle at center, ${t.accent} 0 4.5px, transparent 5.5px)` : "none" }} />
              <span className="flex-1 min-w-0"><b className="block text-[13.5px] font-bold text-t-text">{title}</b><i className="block not-italic text-[11.5px] mt-px text-t-text-muted">{sub}</i></span>
              <span className="text-[12.5px] font-bold shrink-0" style={{ color: green }}>{amt}</span>
            </button>
          ))}

          {method === "cash" ? (
            <>
              <div>
                <div className="h-[7px] rounded overflow-hidden" style={{ background: dark ? "rgba(255,255,255,.08)" : "rgba(0,0,0,.06)" }}>
                  <div className="h-full rounded" style={{ width: `${Math.min(100, (s.available / data.minPayout) * 100)}%`, background: t.accent }} />
                </div>
                <div className="flex justify-between text-[11px] mt-1 text-t-text-muted"><span>{fN(s.available)} available</span><span>{overLine ? "ready to cash out" : `${fN(data.minPayout - s.available)} to go`}</span></div>
              </div>
              {overLine && (
                <div className="grid grid-cols-1 desktop:grid-cols-3 gap-2">
                  <input value={bank.bankName} onChange={e => setBank(b => ({ ...b, bankName: e.target.value }))} placeholder="Bank (e.g. Opay)" className="h-[38px] px-3 rounded-[10px] text-[13px] outline-none text-t-text" style={{ background: dark ? "#131728" : "#fff", border: `1px solid ${t.cardBorder}` }} />
                  <input value={bank.bankAccountNo} onChange={e => setBank(b => ({ ...b, bankAccountNo: e.target.value.replace(/\D/g, "").slice(0, 10) }))} placeholder="Account number" inputMode="numeric" className="m h-[38px] px-3 rounded-[10px] text-[13px] outline-none text-t-text" style={{ background: dark ? "#131728" : "#fff", border: `1px solid ${t.cardBorder}` }} />
                  <input value={bank.bankAccountName} onChange={e => setBank(b => ({ ...b, bankAccountName: e.target.value }))} placeholder="Account name" className="h-[38px] px-3 rounded-[10px] text-[13px] outline-none text-t-text" style={{ background: dark ? "#131728" : "#fff", border: `1px solid ${t.cardBorder}` }} />
                </div>
              )}
              <button disabled={busy || !overLine || (overLine && (!bank.bankName || bank.bankAccountNo.length !== 10 || !bank.bankAccountName))} onClick={() => act({ action: "payout", ...bank }, "Cash-out requested")} className="h-[42px] rounded-xl text-[13.5px] font-semibold border-none cursor-pointer text-white disabled:cursor-default" style={{ background: overLine ? "linear-gradient(135deg,#c47d8e,#8b5e6b)" : (dark ? "rgba(255,255,255,.14)" : "rgba(0,0,0,.1)"), color: overLine ? "#fff" : t.textMuted, opacity: busy ? .6 : 1 }}>
                {busy ? "Working…" : overLine ? `Cash out ${fN(s.available)} to my bank` : `Cash out ${fN(s.available)} — unlocks at ${fN(data.minPayout)}`}
              </button>
            </>
          ) : (
            <button disabled={busy || s.available <= 0} onClick={() => act({ action: "credit-wallet" }, "Added to your wallet")} className="h-[42px] rounded-xl text-[13.5px] font-semibold border-none cursor-pointer disabled:cursor-default text-white" style={{ background: s.available > 0 ? "linear-gradient(135deg,#c47d8e,#8b5e6b)" : (dark ? "rgba(255,255,255,.14)" : "rgba(0,0,0,.1)"), color: s.available > 0 ? "#fff" : t.textMuted, opacity: busy ? .6 : 1 }}>
              {busy ? "Working…" : s.available > 0 ? `Take ${fN(Math.round(s.available * data.walletAmount / data.amount))} as wallet credit` : "Nothing to convert yet"}
            </button>
          )}
        </div>
      </div>

      {/* Friends */}
      <div className="rounded-2xl overflow-hidden mb-4" style={card}>
        <div className="py-2.5 px-4 flex justify-between items-baseline text-[11px] font-bold uppercase tracking-[1.2px] text-t-text-muted" style={{ borderBottom: `1px solid ${t.cardBorder}` }}><span>Your friends</span><span className="normal-case tracking-normal font-normal text-[11.5px]">newest first</span></div>
        {data.earnings.length === 0 && data.waiting.length === 0 ? (
          <div className="p-8 text-center text-[13.5px] text-t-text-muted">No referrals yet. Share your link — the first friend who funds their account earns you {fN(data.amount)}.</div>
        ) : (
          <>
            {data.earnings.map(e => {
              const st = STATUS[e.status] || STATUS.held;
              return (
                <div key={e.id} className="flex items-center gap-2.5 py-2.5 px-3.5" style={{ borderTop: `1px solid ${dark ? "rgba(255,255,255,.06)" : "rgba(0,0,0,.05)"}` }}>
                  <span className="w-8 h-8 rounded-[10px] inline-flex items-center justify-center text-[11px] font-extrabold shrink-0" style={{ background: dark ? "rgba(196,125,142,.16)" : "rgba(196,125,142,.1)", color: t.accent }}>{initials(e.friend)}</span>
                  <span className="flex-1 min-w-0"><b className="block text-[13px] font-semibold truncate text-t-text">{e.friend}</b><i className="block not-italic text-[11px] text-t-text-muted">{fD(e.createdAt)}{e.status === "held" ? ` · clears ${fD(e.releasesAt)}` : ""}</i></span>
                  <span className="text-[10px] font-bold uppercase tracking-[0.4px] py-0.5 px-2 rounded-full shrink-0" style={{ background: st.bg, color: st.clr }}>{st.label}</span>
                  <span className="m text-[12.5px] font-extrabold shrink-0" style={{ color: e.status === "voided" ? t.textMuted : green }}>+{fN(e.amount)}</span>
                </div>
              );
            })}
            {data.waiting.map((w, i) => (
              <div key={i} className="flex items-center gap-2.5 py-2.5 px-3.5" style={{ borderTop: `1px solid ${dark ? "rgba(255,255,255,.06)" : "rgba(0,0,0,.05)"}` }}>
                <span className="w-8 h-8 rounded-[10px] inline-flex items-center justify-center text-[11px] font-extrabold shrink-0" style={{ background: dark ? "rgba(255,255,255,.08)" : "rgba(0,0,0,.05)", color: t.textMuted }}>{initials(w.friend)}</span>
                <span className="flex-1 min-w-0"><b className="block text-[13px] font-semibold truncate text-t-text">{w.friend}</b><i className="block not-italic text-[11px] text-t-text-muted">Signed up {fD(w.signedUp)} · no deposit yet</i></span>
                <span className="text-[10px] font-bold uppercase tracking-[0.4px] py-0.5 px-2 rounded-full shrink-0" style={{ background: dark ? "rgba(255,255,255,.08)" : "rgba(0,0,0,.05)", color: t.textMuted }}>Waiting</span>
              </div>
            ))}
          </>
        )}
      </div>

      {/* Past payouts */}
      {data.payouts.length > 0 && (
        <div className="rounded-2xl overflow-hidden mb-4" style={card}>
          <div className="py-2.5 px-4 text-[11px] font-bold uppercase tracking-[1.2px] text-t-text-muted" style={{ borderBottom: `1px solid ${t.cardBorder}` }}>Past payouts</div>
          {data.payouts.map(p => (
            <div key={p.id} className="flex items-center gap-2.5 py-2.5 px-3.5" style={{ borderTop: `1px solid ${dark ? "rgba(255,255,255,.06)" : "rgba(0,0,0,.05)"}` }}>
              <span className="flex-1 min-w-0"><b className="block text-[13px] font-semibold text-t-text">{fN(p.amount)} to {p.bank} {p.accountNo}</b><i className="block not-italic text-[11px] text-t-text-muted">{fD(p.createdAt)}{p.reference ? ` · ref ${p.reference}` : ""}</i></span>
              <span className="text-[10px] font-bold uppercase tracking-[0.4px] py-0.5 px-2 rounded-full shrink-0" style={p.status === "completed" ? { background: dark ? "rgba(110,231,183,.12)" : "rgba(5,150,105,.08)", color: green } : p.status === "rejected" ? { background: dark ? "rgba(252,165,165,.12)" : "rgba(220,38,38,.07)", color: dark ? "#fca5a5" : "#dc2626" } : { background: dark ? "rgba(251,191,36,.12)" : "rgba(217,119,6,.08)", color: amber }}>{p.status === "completed" ? "Paid" : p.status === "rejected" ? "Returned" : "On the way"}</span>
            </div>
          ))}
        </div>
      )}

      <p className="text-[11.5px] leading-relaxed text-t-text-muted">Earnings clear {data.holdDays} days after your friend's deposit. Self-referrals and same-device sign-ups don't count, and a refunded deposit takes its earning with it.</p>
    </>
  );
}
