"use client";
import { useState } from "react";
import { Card, Chip, Empty, Fact, Facts, Field, Modal, dateOf, pitVars } from "./kit";
import { useTheme } from "../shared-nav";
import { useToast } from "../toast";
import { fN } from "@/lib/format";

const STATUS = {
  paid: { label: "Paid", kind: "ok" },
  completed: { label: "Paid", kind: "ok" },
  processing: { label: "On its way", kind: "warn" },
  pending: { label: "Requested", kind: "warn" },
  rejected: { label: "Turned down", kind: "bad" },
};

const SENT = ["paid", "completed"];
const WAITING = ["pending", "processing"];

export default function PayoutsPage({ initialData }) {
  const { dark, t } = useTheme();
  const toast = useToast();
  const [data, setData] = useState(initialData);
  const [amount, setAmount] = useState(String(Math.floor(initialData?.availableBalance || 0)));
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const reload = () => {
    setRefreshing(true);
    fetch("/api/pit/payouts")
      .then((r) => r.json())
      .then((d) => { if (!d.error) { setData(d); setAmount(String(Math.floor(d.availableBalance || 0))); } })
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
  const [bankPassword, setBankPassword] = useState("");

  const openBankModal = () => {
    setBankName(data?.bankName || "");
    setBankAccountNo(data?.bankAccountNo || "");
    setBankAccountName(data?.bankAccountName || "");
    setBankError(null);
    setBankPassword("");
    setBankOpen(true);
  };

  const handleBankSave = async () => {
    setBankError(null);
    if (!bankName.trim() || !bankAccountNo.trim() || !bankAccountName.trim()) { setBankError("All fields are required"); return; }
    if (!bankPassword) { setBankError("Your password is needed to change where money goes"); return; }
    setBankSaving(true);
    try {
      const res = await fetch("/api/pit/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ section: "bank", bankName: bankName.trim(), bankAccountNo: bankAccountNo.trim(), bankAccountName: bankAccountName.trim(), currentPassword: bankPassword }),
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

  const payouts = data?.payouts || [];
  const waiting = payouts.filter(p => WAITING.includes(p.status)).reduce((n, p) => n + p.amount, 0);
  const waitingCount = payouts.filter(p => WAITING.includes(p.status)).length;
  const sent = payouts.filter(p => SENT.includes(p.status));
  const sentTotal = sent.reduce((n, p) => n + p.amount, 0);
  const canRequest = !!(data && data.availableBalance >= data.minPayout && data.hasBankDetails);
  const why = !data ? "" : !data.hasBankDetails ? "Add your bank account first." : data.availableBalance < data.minPayout ? `You need at least ${fN(data.minPayout)} before you can request.` : "";

  return (
    <div className="pyo" style={pitVars(dark, t)}>
      <style>{PYO_CSS}</style>

      <Facts>
        <Fact value={fN(data?.availableBalance || 0)} label="Ready to withdraw" sub="request any time" kind="ok" />
        <Fact value={fN(waiting)} label="Being paid" sub={waitingCount ? `${waitingCount} ${waitingCount === 1 ? "request" : "requests"} in the queue` : "nothing in the queue"} kind={waiting ? "warn" : undefined} />
        <Fact value={fN(sentTotal)} label="Paid out" sub={`${sent.length} ${sent.length === 1 ? "payout" : "payouts"} so far`} />
        <Fact value={fN(data?.minPayout || 0)} label="Minimum" sub="the least you can request" />
      </Facts>

      <Card title="Request a payout" cnt="it goes to the account below">
        <div className="pt-cb">
          <label className="pt-lbl">Amount</label>
          <div className="pyo-req">
            <span className="pyo-cur">₦</span>
            <input
              className="pt-in m"
              type="number"
              value={amount}
              min={0}
              max={data?.availableBalance}
              onChange={(e) => { setAmount(e.target.value); setSubmitError(null); }}
              placeholder={String(Math.floor(data?.minPayout || 0))}
            />
            <button type="button" className="pt-b sm" onClick={() => setAmount(String(Math.floor(data?.availableBalance || 0)))}>All of it</button>
            <button type="button" className="pt-b pri" disabled={!canRequest || submitting} onClick={handleRequest}>{submitting ? "Sending…" : "Request"}</button>
          </div>
          {submitError && <div className="pt-err">{submitError}</div>}
          <div className="pt-note">{why || `Your whole available balance is ${fN(data?.availableBalance || 0)}. We pay it into the account below.`}</div>
        </div>
      </Card>

      {data && (
        <Card title="Where it goes" cnt="required before you can request" act={data.hasBankDetails ? <button type="button" className="pt-b sm" onClick={openBankModal}>Change</button> : <button type="button" className="pt-b sm pri" onClick={openBankModal}>Add</button>}>
          <div className="pt-cb">
            {data.hasBankDetails ? (
              <div className="pt-frow">
                <span className="pt-tt"><b>{data.bankName} · {data.bankAccountNo}</b><i>{data.bankAccountName}</i></span>
              </div>
            ) : (
              <div className="pt-note">No account on file yet. Add one and you can request a payout.</div>
            )}
          </div>
        </Card>
      )}

      <Modal
        open={bankOpen}
        onClose={() => setBankOpen(false)}
        title={data?.hasBankDetails ? "Change where it goes" : "Where should it go"}
        sub="The name on the account has to be yours."
        footer={<>
          {bankError && <span className="pt-err">{bankError}</span>}
          <button type="button" className="pt-b" onClick={() => setBankOpen(false)}>Cancel</button>
          <button type="button" className="pt-b pri" disabled={bankSaving} onClick={handleBankSave}>{bankSaving ? "Saving…" : "Save"}</button>
        </>}
      >
        <Field label="Bank" value={bankName} onChange={setBankName} placeholder="e.g. GTBank" />
        <Field label="Account number" value={bankAccountNo} onChange={setBankAccountNo} placeholder="0123456789" />
        <Field label="Account name" value={bankAccountName} onChange={setBankAccountName} placeholder="The full name on the account" />
        <Field label="Your password" type="password" value={bankPassword} onChange={setBankPassword} placeholder="Confirm it is you" hint="We ask because this is where your money goes." />
      </Modal>

      <Card title="Past payouts" cnt="newest first, with the reference">
        {payouts.length === 0 ? (
          <Empty>Nothing yet. Your first payout shows up here with its reference.</Empty>
        ) : (
          <div className="pt-list" style={{ opacity: refreshing ? 0.6 : 1, transition: "opacity 200ms" }}>
            {payouts.map((p) => {
              const s = STATUS[p.status] || { label: p.status, kind: "dim" };
              return (
                <div key={p.id} className="pt-r py">
                  <span className="pt-c m">{dateOf(p.createdAt)}</span>
                  <span className="pt-num m">{fN(p.amount)}</span>
                  <Chip kind={s.kind}>{s.label}</Chip>
                  <span className="pt-tt"><i>{p.reference ? `ref ${p.reference}` : "no reference yet"}</i></span>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}

const PYO_CSS = `
.pyo{display:flex;flex-direction:column;gap:14px}
.pyo-req{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.pyo-cur{font-size:15px;font-weight:700;color:var(--mut)}
.pyo-req .pt-in{flex:1;min-width:140px}
@media (min-width:900.99px){
  .pyo .pt-r.py{grid-template-columns:80px 110px 110px 1fr}
}
@media (max-width:900.98px){
  .pyo .pt-r.py{grid-template-areas:"cnt num" "ty tt"}
  .pyo .pt-r.py .pt-tt{grid-area:tt;justify-self:end}
  .pyo .pt-r.py .pt-c{justify-self:start}
}
`;
