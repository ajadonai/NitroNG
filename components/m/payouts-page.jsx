"use client";
import { useState } from "react";
import { StatusBadge, EmptyState, Modal } from "./kit";
import { useTheme } from "../shared-nav";
import { useToast } from "../toast";
import { fN } from "@/lib/format";

function fmtDate(d) {
  return new Date(d).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" });
}

export default function PayoutsPage({ initialData }) {
  const { dark, t } = useTheme();
  const toast = useToast();
  const [data, setData] = useState(initialData);
  const [showForm, setShowForm] = useState(false);
  const [amount, setAmount] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const reload = () => {
    setRefreshing(true);
    fetch("/api/pit/payouts")
      .then((r) => r.json())
      .then((d) => { if (!d.error) setData(d); })
      .catch(() => {})
      .finally(() => setRefreshing(false));
  };

  const handleRequest = async () => {
    setSubmitError(null);
    const num = parseFloat(amount);
    if (!num || num <= 0) { setSubmitError("Enter a valid amount"); return; }
    if (data && num > data.availableBalance) { setSubmitError("Exceeds available balance"); return; }
    if (data && num < data.minPayout) { setSubmitError(`Minimum payout is ${fN(data.minPayout)}`); return; }

    setSubmitting(true);
    try {
      const res = await fetch("/api/pit/payouts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: num }),
      });
      const d = await res.json();
      if (d.error) { setSubmitError(d.error); return; }
      setShowForm(false);
      setAmount("");
      reload();
      toast.success("Payout request submitted");
    } catch {
      setSubmitError("Something went wrong");
    } finally {
      setSubmitting(false);
    }
  };

  const [bankName, setBankName] = useState(initialData?.bankName || "");
  const [bankAccountNo, setBankAccountNo] = useState(initialData?.bankAccountNo || "");
  const [bankAccountName, setBankAccountName] = useState(initialData?.bankAccountName || "");
  const [bankOpen, setBankOpen] = useState(false);
  const [bankSaving, setBankSaving] = useState(false);
  const [bankError, setBankError] = useState(null);

  const openBankModal = () => {
    setBankName(data?.bankName || "");
    setBankAccountNo(data?.bankAccountNo || "");
    setBankAccountName(data?.bankAccountName || "");
    setBankError(null);
    setBankOpen(true);
  };

  const handleBankSave = async () => {
    setBankError(null);
    if (!bankName.trim() || !bankAccountNo.trim() || !bankAccountName.trim()) { setBankError("All fields are required"); return; }
    setBankSaving(true);
    try {
      const res = await fetch("/api/pit/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ section: "bank", bankName: bankName.trim(), bankAccountNo: bankAccountNo.trim(), bankAccountName: bankAccountName.trim() }),
      });
      const d = await res.json();
      if (d.error) { setBankError(d.error); return; }
      setBankOpen(false);
      reload();
    } catch {
      setBankError("Something went wrong");
    } finally {
      setBankSaving(false);
    }
  };

  const canRequest = data && data.availableBalance >= data.minPayout && data.hasBankDetails;
  const hdr = { background: dark ? "rgba(196,125,142,.18)" : "rgba(196,125,142,.12)", borderBottom: `1px solid ${t.surfaceBrd}` };

  return (
    <div className="flex flex-col gap-5">
      {/* Balance card */}
      <div className="rounded-[14px] overflow-hidden" style={{ background: t.surface, border: `1px solid ${t.surfaceBrd}` }}>
        <div className="py-[10px] px-[18px]" style={hdr}>
          <div className="text-[12px] font-semibold tracking-[0.3px] uppercase" style={{ color: t.muted }}>Available Balance</div>
          <div className="text-[11px] mt-[2px]" style={{ color: t.soft }}>Your withdrawable earnings</div>
        </div>
        <div className="py-[14px] px-[18px]">
          <div className="flex items-end justify-between flex-wrap gap-3">
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
          {data && data.hasBankDetails && data.availableBalance < data.minPayout && data.availableBalance > 0 && (
            <div className="text-[12px] mt-3" style={{ color: t.muted }}>Minimum payout: {fN(data.minPayout)}</div>
          )}
        </div>
      </div>

      {/* Bank details — confirmation card or prompt */}
      {data && (
        <div className="rounded-[14px] overflow-hidden" style={{ background: t.surface, border: `1px solid ${t.surfaceBrd}` }}>
          <div className="py-[10px] px-[18px]" style={hdr}>
            <div className="text-[12px] font-semibold tracking-[0.3px] uppercase" style={{ color: t.muted }}>Payout Account</div>
            <div className="text-[11px] mt-[2px]" style={{ color: t.soft }}>Where your earnings are sent</div>
          </div>
          {data.hasBankDetails ? (
            <div className="py-[14px] px-[18px] flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-[10px] flex items-center justify-center shrink-0" style={{ background: dark ? "rgba(110,231,183,.1)" : "rgba(5,150,105,.08)" }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={t.green} strokeWidth="2" strokeLinecap="round"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[13.5px] font-semibold" style={{ color: t.text }}>{data.bankAccountName}</div>
                <div className="text-[12px] mt-[2px]" style={{ color: t.muted }}>{data.bankAccountNo} · {data.bankName}</div>
              </div>
              <button onClick={openBankModal} className="text-[11.5px] font-semibold bg-transparent border-none cursor-pointer shrink-0" style={{ color: t.accent, fontFamily: "inherit" }}>Edit</button>
            </div>
          ) : (
            <div className="py-[14px] px-[18px] flex items-center justify-between">
              <div className="text-[12.5px]" style={{ color: t.muted }}>Required before you can request payouts</div>
              <button onClick={openBankModal} className="py-[7px] px-3.5 rounded-lg text-[12px] font-semibold border-none cursor-pointer text-white shrink-0" style={{ background: t.grad, fontFamily: "inherit" }}>Add</button>
            </div>
          )}
        </div>
      )}

      {/* Bank details modal */}
      <Modal open={bankOpen} onClose={() => setBankOpen(false)} title={data?.hasBankDetails ? "Edit Payout Account" : "Add Bank Details"} dark={dark} t={t}>
        <div>
          <label className="text-[11.5px] font-medium block mb-1" style={{ color: t.muted }}>Bank name</label>
          <input value={bankName} onChange={(e) => setBankName(e.target.value)} placeholder="e.g. GTBank" className="w-full py-[9px] px-3 rounded-lg text-[13.5px] bg-transparent outline-none" style={{ color: t.text, border: `1px solid ${t.surfaceBrd}`, fontFamily: "inherit" }} />
        </div>
        <div>
          <label className="text-[11.5px] font-medium block mb-1" style={{ color: t.muted }}>Account number</label>
          <input value={bankAccountNo} onChange={(e) => setBankAccountNo(e.target.value)} placeholder="0123456789" className="w-full py-[9px] px-3 rounded-lg text-[13.5px] bg-transparent outline-none" style={{ color: t.text, border: `1px solid ${t.surfaceBrd}`, fontFamily: "inherit" }} />
        </div>
        <div>
          <label className="text-[11.5px] font-medium block mb-1" style={{ color: t.muted }}>Account name</label>
          <input value={bankAccountName} onChange={(e) => setBankAccountName(e.target.value)} placeholder="Full name on account" className="w-full py-[9px] px-3 rounded-lg text-[13.5px] bg-transparent outline-none" style={{ color: t.text, border: `1px solid ${t.surfaceBrd}`, fontFamily: "inherit" }} />
        </div>
        {bankError && <div className="text-[12.5px]" style={{ color: t.red }}>{bankError}</div>}
        <div className="flex gap-2 justify-end mt-1">
          <button onClick={() => setBankOpen(false)} className="py-[7px] px-4 rounded-lg text-[12.5px] font-medium border-none cursor-pointer" style={{ background: "transparent", color: t.muted, fontFamily: "inherit" }}>Cancel</button>
          <button onClick={handleBankSave} disabled={bankSaving} className="py-[7px] px-4 rounded-lg text-[12.5px] font-semibold border-none cursor-pointer text-white disabled:opacity-50" style={{ background: t.grad, fontFamily: "inherit" }}>{bankSaving ? "Saving..." : "Save"}</button>
        </div>
      </Modal>

      {/* Payout form */}
      {showForm && (
        <div className="rounded-[14px] overflow-hidden" style={{ background: t.surface, border: `1px solid ${t.surfaceBrd}` }}>
          <div className="py-[10px] px-[18px]" style={hdr}>
            <div className="text-[12px] font-semibold tracking-[0.3px] uppercase" style={{ color: t.muted }}>Request Payout</div>
            <div className="text-[11px] mt-[2px]" style={{ color: t.soft }}>Enter the amount to withdraw</div>
          </div>
          <div className="p-[18px] flex flex-col gap-3">
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
        </div>
      )}

      {/* Payout history */}
      <div className="rounded-[14px] overflow-hidden transition-opacity duration-200" style={{ background: t.surface, border: `1px solid ${t.surfaceBrd}`, opacity: refreshing ? 0.6 : 1 }}>
        <div className="py-[10px] px-[18px]" style={hdr}>
          <div className="text-[12px] font-semibold tracking-[0.3px] uppercase" style={{ color: t.muted }}>Payout History</div>
          {!data?.payouts?.length && <div className="text-[11px] mt-[2px]" style={{ color: t.soft }}>Request a payout when your available balance meets the minimum</div>}
        </div>
        {!data?.payouts?.length ? (
          <EmptyState
            title="No payouts yet"
            icon={<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>}
            t={t}
          />
        ) : (
          data.payouts.map((p) => (
            <div key={p.id} className="flex items-center gap-3 px-[18px] py-[14px]" style={{ borderTop: `1px solid ${t.surfaceBrd}` }}>
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
