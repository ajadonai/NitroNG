'use client';
import { useToast } from "./toast";
import { fN } from "../lib/format";
import { copyText } from '@/lib/clipboard';

/* The bank transfer sheet: a bottom sheet on a phone, a centred dialog from
 * 768px up. Four viewport tiers to hold — ≤380 (small phone), <768 (phone),
 * 768–1199 (tablet), ≥1200 (desktop). Lives apart from the wallet page so it
 * can be rendered on its own. */
export function ManualTransferSheet({ manualModal, setManualModal, manualStep, setManualStep, manualRef, setManualRef, manualSubmitting, setManualSubmitting, manualDone, setManualDone, dark, t, onPlaceOrder, onRefresh }) {
  const toast = useToast();
  if (!manualModal) return null;
  return (
    <div onClick={() => { if (manualDone) setManualModal(null); }} onKeyDown={e => { if (e.key === 'Escape' && manualDone) setManualModal(null); }} className="fixed inset-0 z-[200] flex items-end md:items-center justify-center md:p-6 backdrop-blur-[4px] animate-[modalFadeIn_.2s_ease] bg-black/45">
      <div role="dialog" aria-modal="true" aria-label="Bank transfer" onClick={e => e.stopPropagation()} className="w-full md:max-w-[420px] max-h-[94dvh] md:max-h-[88vh] overflow-y-auto rounded-t-[22px] md:rounded-2xl p-4 max-[380px]:p-3.5 md:p-6 pb-[max(16px,env(safe-area-inset-bottom))] md:pb-6 flex flex-col gap-3 animate-[modalBounceIn_.3s_cubic-bezier(.34,1.56,.64,1)_both]" style={{ background: dark ? "#0e1120" : "#fff", border: `1px solid ${dark ? "rgba(255,255,255,.14)" : "rgba(0,0,0,.1)"}` }}>
        <div className="md:hidden w-[38px] h-1 rounded-sm shrink-0 mx-auto -mt-1 mb-0.5" style={{ background: dark ? "rgba(255,255,255,.2)" : "rgba(0,0,0,.14)" }} />

        {manualDone ? (
          <>
            <div className="text-center pt-1">
              <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto" style={{ background: dark ? "rgba(110,231,183,.12)" : "rgba(5,150,105,.09)", color: dark ? "#6ee7b7" : "#059669" }}>
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
              </div>
              <div className="text-[19px] max-[380px]:text-[17px] font-bold mt-3 text-t-text">We&apos;re checking for it</div>
              <div className="text-[13px] leading-relaxed mt-1.5 mx-auto max-w-[34ch] text-t-text-muted">{fN(manualModal.amount)}{manualRef.trim() ? <> from <b className="font-semibold text-t-text">{manualRef.trim()}</b></> : null}. Your wallet is credited as soon as we see it land.</div>
            </div>
            <div className="rounded-xl overflow-hidden" style={{ border: `1px solid ${t.cardBorder}` }}>
              {[
                ["on", "You sent it", "Just now"],
                ["now", "We're confirming", "Usually within an hour, business hours"],
                ["off", "Wallet credited", "We'll notify you here and by email"],
              ].map(([state, title, sub], i) => (
                <div key={title} className="flex items-center gap-2.5 py-2.5 px-3.5" style={{ borderTop: i ? `1px solid ${t.cardBorder}` : "none" }}>
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={state === "on" ? { background: dark ? "#6ee7b7" : "#059669" } : state === "now" ? { background: dark ? "#fcd34d" : "#b45309", boxShadow: `0 0 0 3px ${dark ? "rgba(251,191,36,.14)" : "rgba(217,119,6,.1)"}` } : { background: t.cardBorder }} />
                  <span className="min-w-0 flex-1">
                    <b className={`block text-[12.5px] font-bold ${state === "off" ? "text-t-text-muted" : "text-t-text"}`}>{title}</b>
                    <i className="block not-italic text-[11px] text-t-text-muted">{sub}</i>
                  </span>
                </div>
              ))}
            </div>
            <div className="flex items-start gap-2.5 py-2.5 px-3 rounded-[11px] text-[12px] leading-relaxed" style={{ background: dark ? "rgba(255,255,255,.04)" : "rgba(0,0,0,.02)", border: `1px solid ${t.cardBorder}`, color: t.textMuted }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="shrink-0 mt-0.5"><circle cx="12" cy="12" r="10" /><path d="M12 16v-4M12 8h.01" /></svg>
              <span>You can close this. It shows as <b className="font-semibold">Waiting to be confirmed</b> on your wallet until it clears.</span>
            </div>
            <div className="flex max-[380px]:flex-col gap-2">
              <button onClick={() => setManualModal(null)} className="flex-1 max-[380px]:flex-none h-11 rounded-xl bg-transparent text-sm font-semibold cursor-pointer text-t-text-muted" style={{ border: `1px solid ${t.cardBorder}` }}>Done</button>
              {onPlaceOrder && <button onClick={() => { setManualModal(null); onPlaceOrder(); }} className="flex-[1.6] max-[380px]:flex-none h-11 rounded-xl border-none bg-gradient-to-br from-[#c47d8e] to-[#8b5e6b] text-white text-sm font-bold cursor-pointer">Place an order</button>}
            </div>
          </>
        ) : manualStep === "details" ? (
          <>
            <div className="flex items-start gap-2.5">
              <div className="min-w-0 flex-1">
                <div className="text-[17px] max-[380px]:text-[15.5px] font-bold leading-tight text-t-text">Send {fN(manualModal.amount)}</div>
                <div className="text-[12.5px] leading-relaxed mt-1 text-t-text-muted">Transfer the exact amount from your bank app, then come back and tell us.</div>
              </div>
              <button onClick={() => setManualModal(null)} aria-label="Close" className="w-8 h-8 rounded-[9px] flex items-center justify-center shrink-0 cursor-pointer text-t-text-muted" style={{ background: dark ? "rgba(255,255,255,.06)" : "rgba(0,0,0,.03)", border: `1px solid ${t.cardBorder}` }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
              </button>
            </div>

            <div className="flex items-center justify-between gap-2.5 py-3 px-3.5 rounded-[13px]" style={{ background: dark ? "rgba(110,231,183,.09)" : "rgba(5,150,105,.07)", border: `1px solid ${dark ? "rgba(110,231,183,.32)" : "rgba(5,150,105,.28)"}` }}>
              <div className="min-w-0">
                <div className="text-[10px] font-extrabold uppercase tracking-[.9px] text-t-text-muted">Exact amount</div>
                <div className="m text-2xl max-[380px]:text-xl font-extrabold leading-tight mt-0.5" style={{ color: dark ? "#6ee7b7" : "#059669", letterSpacing: "-.02em" }}>{fN(manualModal.amount)}</div>
              </div>
              <button onClick={() => { copyText(String(manualModal.amount)); toast.success("Amount copied"); }} className="h-8 px-3 rounded-[9px] text-xs font-bold cursor-pointer shrink-0 inline-flex items-center gap-1.5 text-t-text" style={{ background: dark ? "rgba(255,255,255,.06)" : "#fff", border: `1px solid ${t.cardBorder}` }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><rect x="9" y="9" width="12" height="12" rx="2" /><path d="M5 15V5a2 2 0 012-2h10" /></svg>Copy
              </button>
            </div>

            <div className="rounded-[13px] overflow-hidden" style={{ border: `1px solid ${t.cardBorder}` }}>
              <div className="py-2.5 px-3.5">
                <div className="text-[10px] font-extrabold uppercase tracking-[.9px] text-t-text-muted">Bank</div>
                <div className="text-[15px] font-bold mt-0.5 text-t-text">{manualModal.bankName}</div>
              </div>
              <div className="flex items-center gap-2.5 py-2.5 px-3.5" style={{ borderTop: `1px solid ${t.cardBorder}` }}>
                <div className="min-w-0 flex-1">
                  <div className="text-[10px] font-extrabold uppercase tracking-[.9px] text-t-text-muted">Account number</div>
                  <div className="m text-[19px] max-[380px]:text-[17px] font-bold tracking-[.06em] mt-0.5 text-t-text">{manualModal.accountNumber}</div>
                </div>
                <button onClick={() => { copyText(manualModal.accountNumber); toast.success("Account number copied"); }} className="h-8 px-3 rounded-[9px] text-xs font-bold cursor-pointer shrink-0 inline-flex items-center gap-1.5 text-t-text" style={{ background: dark ? "rgba(255,255,255,.06)" : "rgba(0,0,0,.03)", border: `1px solid ${t.cardBorder}` }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><rect x="9" y="9" width="12" height="12" rx="2" /><path d="M5 15V5a2 2 0 012-2h10" /></svg>Copy
                </button>
              </div>
              <div className="py-2.5 px-3.5" style={{ borderTop: `1px solid ${t.cardBorder}` }}>
                <div className="text-[10px] font-extrabold uppercase tracking-[.9px] text-t-text-muted">Account name</div>
                <div className="text-[15px] font-bold mt-0.5 text-t-text">{manualModal.accountName}</div>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              {[
                [<>Open your bank app and send <b className="font-semibold text-t-text">exactly {fN(manualModal.amount)}</b> to the account above.</>, "1"],
                [<>Come back here and press <b className="font-semibold text-t-text">I&apos;ve sent it</b>.</>, "2"],
                [<>We confirm and credit your wallet, usually within an hour.</>, "3"],
              ].map(([body, n]) => (
                <div key={n} className="flex items-start gap-2.5 text-[12.5px] leading-snug text-t-text-muted">
                  <span className="w-[18px] h-[18px] rounded-md inline-flex items-center justify-center text-[10px] font-extrabold shrink-0 mt-px" style={{ background: dark ? "rgba(196,125,142,.16)" : "rgba(196,125,142,.1)", color: t.accent }}>{n}</span>
                  <span>{body}</span>
                </div>
              ))}
            </div>

            <div className="flex items-start gap-2.5 py-2.5 px-3 rounded-[11px] text-[12px] leading-relaxed" style={{ background: dark ? "rgba(255,255,255,.04)" : "rgba(0,0,0,.02)", border: `1px solid ${t.cardBorder}`, color: t.textMuted }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="shrink-0 mt-0.5"><circle cx="12" cy="12" r="10" /><path d="M12 16v-4M12 8h.01" /></svg>
              <span>Take your time. This transfer stays here until you tell us it&apos;s sent — even if you close the app.</span>
            </div>

            <button onClick={() => setManualStep("confirm")} className="h-11 rounded-xl border-none bg-gradient-to-br from-[#c47d8e] to-[#8b5e6b] text-white text-sm font-bold cursor-pointer">I&apos;ve sent it</button>
            <button onClick={async () => { try { await fetch("/api/payments/manual", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reference: manualModal.reference }) }); } catch {} setManualModal(null); onRefresh?.(); }} className="h-9 rounded-[10px] bg-transparent border-none text-[13px] font-semibold cursor-pointer text-t-text-muted">Cancel this transfer</button>
          </>
        ) : (
          <>
            <div className="flex items-start gap-2.5">
              <div className="min-w-0 flex-1">
                <div className="text-[17px] max-[380px]:text-[15.5px] font-bold leading-tight text-t-text">Who sent it?</div>
                <div className="text-[12.5px] leading-relaxed mt-1 text-t-text-muted">We match your transfer by the name on the sending account.</div>
              </div>
              <button onClick={() => setManualModal(null)} aria-label="Close" className="w-8 h-8 rounded-[9px] flex items-center justify-center shrink-0 cursor-pointer text-t-text-muted" style={{ background: dark ? "rgba(255,255,255,.06)" : "rgba(0,0,0,.03)", border: `1px solid ${t.cardBorder}` }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
              </button>
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="manual-sender" className="text-[10px] font-extrabold uppercase tracking-[.9px] text-t-text-muted">Name on the account you sent from</label>
              <input id="manual-sender" type="text" value={manualRef} onChange={e => setManualRef(e.target.value)} placeholder="e.g. Kehinde Adeyemi" autoFocus className="h-11 px-3.5 rounded-[11px] text-[15px] outline-none w-full text-t-text" style={{ background: dark ? "#131728" : "#fff", border: `1px solid ${manualRef.trim().length >= 3 ? t.accent : t.cardBorder}`, boxShadow: manualRef.trim().length >= 3 ? `0 0 0 1px ${t.accent} inset` : "none" }} />
              <p className="text-[11.5px] leading-snug text-t-text-muted">Not your Nitro name — the name your bank shows on the transfer. If a friend sent it for you, put their name.</p>
            </div>

            <div className="rounded-[13px] overflow-hidden" style={{ border: `1px solid ${t.cardBorder}` }}>
              <div className="flex items-center justify-between gap-2 py-2.5 px-3.5">
                <span className="text-[10px] font-extrabold uppercase tracking-[.9px] text-t-text-muted">Amount sent</span>
                <span className="m text-sm font-bold" style={{ color: dark ? "#6ee7b7" : "#059669" }}>{fN(manualModal.amount)}</span>
              </div>
              <div className="flex items-center justify-between gap-2 py-2.5 px-3.5" style={{ borderTop: `1px solid ${t.cardBorder}` }}>
                <span className="text-[10px] font-extrabold uppercase tracking-[.9px] shrink-0 text-t-text-muted">To</span>
                <span className="text-[12.5px] font-semibold text-right truncate text-t-text">{manualModal.bankName} · {manualModal.accountNumber}</span>
              </div>
            </div>

            <div className="flex items-start gap-2.5 py-2.5 px-3 rounded-[11px] text-[12px] leading-relaxed" style={{ background: dark ? "rgba(251,191,36,.1)" : "rgba(217,119,6,.07)", border: `1px solid ${dark ? "rgba(252,211,77,.3)" : "rgba(180,83,9,.24)"}`, color: t.text }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={dark ? "#fcd34d" : "#b45309"} strokeWidth="2" strokeLinecap="round" className="shrink-0 mt-0.5"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
              <span>Only press this after the money has actually left your account. A transfer we can&apos;t find is rejected.</span>
            </div>

            <div className="flex max-[380px]:flex-col gap-2">
              <button onClick={() => setManualStep("details")} className="flex-1 max-[380px]:flex-none h-11 rounded-xl bg-transparent text-sm font-semibold cursor-pointer text-t-text-muted" style={{ border: `1px solid ${t.cardBorder}` }}>Back</button>
              <button onClick={async () => {
                if (manualRef.trim().length < 3) { toast.warning("Name required", "Enter the name on the account you sent from"); return; }
                setManualSubmitting(true);
                try {
                  const res = await fetch("/api/payments/manual", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reference: manualModal.reference, senderRef: manualRef.trim() }) });
                  if (res.ok) { setManualDone(true); onRefresh?.(); }
                  else { const d = await res.json(); toast.error("Failed", d.error || "Something went wrong"); }
                } catch { toast.error("Network error", "Check your connection"); }
                setManualSubmitting(false);
              }} disabled={manualSubmitting || manualRef.trim().length < 3} className="flex-[1.6] max-[380px]:flex-none h-11 rounded-xl border-none text-white text-sm font-bold cursor-pointer disabled:cursor-not-allowed" style={{ background: manualRef.trim().length >= 3 ? "linear-gradient(135deg,#c47d8e,#8b5e6b)" : (dark ? "rgba(255,255,255,.14)" : "rgba(0,0,0,.1)"), color: manualRef.trim().length >= 3 ? "#fff" : t.textMuted, opacity: manualSubmitting ? .6 : 1 }}>
                {manualSubmitting ? "Confirming…" : "Confirm"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
