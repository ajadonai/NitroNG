"use client";
import { useState } from "react";
import PortalShell from "./shell";
import { StatusBadge } from "./kit";
import { useTheme } from "../shared-nav";
import { fN } from "@/lib/format";

function fmtDate(d) {
  return new Date(d).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" });
}

function Inner({ member, initialData }) {
  const { dark, t } = useTheme();
  const [data, setData] = useState(initialData);
  const [showForm, setShowForm] = useState(false);
  const [amount, setAmount] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  const reload = () => {
    fetch("/api/m/payouts")
      .then((r) => r.json())
      .then((d) => { if (!d.error) setData(d); })
      .catch(() => {});
  };

  const handleRequest = async () => {
    setSubmitError(null);
    const num = parseFloat(amount);
    if (!num || num <= 0) { setSubmitError("Enter a valid amount"); return; }
    if (data && num > data.availableBalance) { setSubmitError("Exceeds available balance"); return; }
    if (data && num < data.minPayout) { setSubmitError(`Minimum payout is ${fN(data.minPayout)}`); return; }

    setSubmitting(true);
    try {
      const res = await fetch("/api/m/payouts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: num }),
      });
      const d = await res.json();
      if (d.error) { setSubmitError(d.error); return; }
      setSubmitSuccess(true);
      setShowForm(false);
      setAmount("");
      reload();
      setTimeout(() => setSubmitSuccess(false), 4000);
    } catch {
      setSubmitError("Something went wrong");
    } finally {
      setSubmitting(false);
    }
  };

  const canRequest = data && data.availableBalance >= data.minPayout && data.hasBankDetails;

  return (
    <div className="flex flex-col gap-5">
      {/* Balance card */}
      <div className="rounded-2xl p-5" style={{ background: t.surface, border: `1px solid ${t.surfaceBrd}` }}>
        <div className="text-[11px] font-semibold tracking-[1px] uppercase" style={{ color: t.muted }}>Available Balance</div>
        <div className="flex items-end justify-between mt-2 flex-wrap gap-3">
          <span className="m text-[32px] max-md:text-[26px] font-semibold tracking-tight" style={{ color: t.text }}>{fN(data?.availableBalance)}</span>
          <button
            onClick={() => setShowForm(!showForm)}
            disabled={!canRequest}
            className="py-[9px] px-5 rounded-xl text-[13px] font-semibold border-none cursor-pointer text-white disabled:opacity-40 disabled:cursor-default transition-transform duration-150 hover:enabled:-translate-y-px"
            style={{ background: t.grad, fontFamily: "inherit" }}
          >
            Request Payout
          </button>
        </div>
        {data && !data.hasBankDetails && (
          <div className="text-[12px] mt-3" style={{ color: t.accent }}>
            Add your bank details in <a href="/m/settings" className="font-semibold no-underline" style={{ color: t.accent }}>Settings</a> to request payouts.
          </div>
        )}
        {data && data.hasBankDetails && data.availableBalance < data.minPayout && data.availableBalance > 0 && (
          <div className="text-[12px] mt-3" style={{ color: t.muted }}>Minimum payout: {fN(data.minPayout)}</div>
        )}
      </div>

      {/* Success toast */}
      {submitSuccess && (
        <div className="flex items-center gap-2 py-3 px-4 rounded-xl text-[13px] font-medium" style={{ color: t.green, background: `${t.green}12`, border: `1px solid ${t.green}30` }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="shrink-0"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
          Payout request submitted
        </div>
      )}

      {/* Payout form */}
      {showForm && (
        <div className="rounded-2xl p-5 flex flex-col gap-3" style={{ background: t.surface, border: `1px solid ${t.surfaceBrd}` }}>
          <div className="text-[13px] font-semibold" style={{ color: t.text }}>Request Payout</div>
          <div className="flex items-center gap-2">
            <span className="text-[15px] font-semibold" style={{ color: t.muted }}>₦</span>
            <input
              type="number"
              value={amount}
              onChange={(e) => { setAmount(e.target.value); setSubmitError(null); }}
              placeholder={`Min ${fN(data?.minPayout)}`}
              className="flex-1 bg-transparent border-none outline-none text-[15px] font-medium p-0"
              style={{ color: t.text, fontFamily: "inherit" }}
              min={0}
              max={data?.availableBalance}
            />
            <button
              onClick={() => setAmount(String(Math.floor(data?.availableBalance || 0)))}
              className="text-[11px] font-semibold py-1 px-2 rounded-md bg-transparent border-none cursor-pointer"
              style={{ color: t.accent, background: t.accentLight, fontFamily: "inherit" }}
            >
              MAX
            </button>
          </div>
          <div style={{ height: 1, background: t.surfaceBrd }} />
          {submitError && <div className="text-[12.5px]" style={{ color: t.red }}>{submitError}</div>}
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => { setShowForm(false); setAmount(""); setSubmitError(null); }}
              className="py-[7px] px-4 rounded-lg text-[12.5px] font-medium border-none cursor-pointer"
              style={{ background: "transparent", color: t.muted, fontFamily: "inherit" }}
            >
              Cancel
            </button>
            <button
              onClick={handleRequest}
              disabled={submitting}
              className="py-[7px] px-4 rounded-lg text-[12.5px] font-semibold border-none cursor-pointer text-white disabled:opacity-50"
              style={{ background: t.grad, fontFamily: "inherit" }}
            >
              {submitting ? "Submitting..." : "Submit"}
            </button>
          </div>
        </div>
      )}

      {/* Payout history */}
      <div className="rounded-2xl overflow-hidden" style={{ background: t.surface, border: `1px solid ${t.surfaceBrd}` }}>
        <div className="px-5 pt-4 pb-2">
          <span className="text-[13px] font-semibold" style={{ color: t.text }}>Payout History</span>
        </div>
        {!data?.payouts?.length ? (
          <div className="text-center py-8 text-[13px]" style={{ color: t.muted }}>No payouts yet</div>
        ) : (
          data.payouts.map((p) => (
            <div key={p.id} className="flex items-center gap-3 px-5 py-[14px]" style={{ borderTop: `1px solid ${t.surfaceBrd}` }}>
              <div className="flex-1 min-w-0">
                <div className="m text-[13.5px] font-semibold" style={{ color: t.text }}>{fN(p.amount)}</div>
                <div className="text-[11.5px] mt-[2px]" style={{ color: t.muted }}>
                  {fmtDate(p.createdAt)}
                  {p.reference && <> · {p.reference}</>}
                </div>
              </div>
              <StatusBadge status={p.status} dark={dark} t={t} />
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default function PayoutsPage({ member, initialData }) {
  return <PortalShell member={member}><Inner member={member} initialData={initialData} /></PortalShell>;
}
