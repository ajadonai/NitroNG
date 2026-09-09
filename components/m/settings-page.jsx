"use client";
import { useState, useRef, useEffect } from "react";
import { useT } from "../locale";
import { Card, Field, Modal, pitVars } from "./kit";
import { useTheme } from "../shared-nav";
import { useToast } from "../toast";

// One row per thing you can change. The button opens a modal; nothing is edited
// in place.
function Row({ title, sub, action }) {
  return (
    <div className="pt-frow">
      <span className="pt-tt"><b>{title}</b><i>{sub}</i></span>
      {action}
    </div>
  );
}

function Socials({ member, toast }) {
  const tr = useT();
  const [tgLoading, setTgLoading] = useState(false);
  const [tgLinked, setTgLinked] = useState(member.telegramLinked);
  const [tgHandle, setTgHandle] = useState(member.telegramHandle || null);
  const [tgError, setTgError] = useState(null);

  const [xHandle, setXHandle] = useState(member.xHandle || null);
  const [xInput, setXInput] = useState("");
  const [xOpen, setXOpen] = useState(false);
  const [xLoading, setXLoading] = useState(false);
  const [xError, setXError] = useState(null);

  const [disconnectTarget, setDisconnectTarget] = useState(null);
  const tgPollRef = useRef(null);

  useEffect(() => () => { if (tgPollRef.current) clearInterval(tgPollRef.current); }, []);

  const tgConnect = async () => {
    setTgLoading(true);
    setTgError(null);
    try {
      const res = await fetch("/api/pit/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ section: "telegram" }),
      });
      const d = await res.json();
      if (d.error) { setTgError(d.error); setTgLoading(false); return; }
      window.open(`https://t.me/NitroMarshal_bot?start=${d.code}`, "_blank");
      let attempts = 0;
      tgPollRef.current = setInterval(async () => {
        attempts++;
        try {
          const r = await fetch("/api/pit/settings?check=telegram");
          const s = await r.json();
          if (s.linked) {
            clearInterval(tgPollRef.current); tgPollRef.current = null;
            setTgLinked(true);
            setTgHandle(s.handle);
            setTgLoading(false);
            toast.success("Telegram connected");
          } else if (attempts >= 30) {
            clearInterval(tgPollRef.current); tgPollRef.current = null;
            setTgLoading(false);
          }
        } catch {
          clearInterval(tgPollRef.current); tgPollRef.current = null;
          setTgLoading(false);
        }
      }, 3000);
    } catch {
      setTgError("Something went wrong");
      setTgLoading(false);
    }
  };

  const tgDisconnect = async () => {
    setTgLoading(true);
    setTgError(null);
    try {
      const res = await fetch("/api/pit/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ section: "telegram_disconnect" }),
      });
      const d = await res.json();
      if (d.error) { setTgError(d.error); return; }
      setTgLinked(false);
      setTgHandle(null);
      toast.success("Telegram disconnected");
    } catch {
      setTgError("Something went wrong");
    } finally {
      setTgLoading(false);
    }
  };

  const xConnect = async () => {
    setXError(null);
    if (!xInput.trim()) { setXError("Handle is required"); return; }
    setXLoading(true);
    try {
      const res = await fetch("/api/pit/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ section: "twitter", handle: xInput.trim() }),
      });
      const d = await res.json();
      if (d.error) { setXError(d.error); return; }
      setXHandle(xInput.trim().replace(/^@/, ""));
      setXOpen(false);
      setXInput("");
      toast.success("Twitter connected");
    } catch {
      setXError("Something went wrong");
    } finally {
      setXLoading(false);
    }
  };

  const xDisconnect = async () => {
    setXLoading(true);
    try {
      const res = await fetch("/api/pit/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ section: "twitter_disconnect" }),
      });
      const d = await res.json();
      if (d.error) return;
      setXHandle(null);
      toast.success("Twitter disconnected");
    } catch {} finally {
      setXLoading(false);
    }
  };

  return (
    <>
      <Card title={tr("Socials")} cnt="so we can tag you when your link does well">
        <div className="pt-cb">
          <Row
            title="X"
            sub={xHandle ? `@${xHandle}` : "Not connected"}
            action={xHandle
              ? <button type="button" className="pt-b sm bad" onClick={() => setDisconnectTarget("twitter")}>{tr("Disconnect")}</button>
              : <button type="button" className="pt-b sm" onClick={() => { setXInput(""); setXError(null); setXOpen(true); }}>{tr("Connect")}</button>}
          />
          <Row
            title="Telegram"
            sub={tgLinked ? (tgHandle ? `@${tgHandle}` : "Connected") : "Not connected"}
            action={tgLinked
              ? <button type="button" className="pt-b sm bad" onClick={() => setDisconnectTarget("telegram")}>{tr("Disconnect")}</button>
              : <button type="button" className="pt-b sm" disabled={tgLoading} onClick={tgConnect}>{tgLoading ? tr("Waiting…") : tr("Connect")}</button>}
          />
          {tgError && <div className="pt-err">{tgError}</div>}
        </div>
      </Card>

      <Modal
        open={!!disconnectTarget}
        onClose={() => setDisconnectTarget(null)}
        title={`Disconnect ${disconnectTarget === "twitter" ? "X" : "Telegram"}?`}
        footer={<>
          <button type="button" className="pt-b" onClick={() => setDisconnectTarget(null)}>{tr("Cancel")}</button>
          <button
            type="button"
            className="pt-b pri"
            disabled={xLoading || tgLoading}
            onClick={async () => {
              const target = disconnectTarget;
              setDisconnectTarget(null);
              if (target === "twitter") await xDisconnect();
              else await tgDisconnect();
            }}
          >{tr("Disconnect")}</button>
        </>}
      >
        <div className="pt-note">
          We will stop tagging you there{disconnectTarget === "twitter" && xHandle ? ` as @${xHandle}` : disconnectTarget === "telegram" && tgHandle ? ` as @${tgHandle}` : ""}. You can connect again any time.
        </div>
      </Modal>

      <Modal
        open={xOpen}
        onClose={() => setXOpen(false)}
        title={tr("Connect X")}
        sub={tr("The handle you post from.")}
        footer={<>
          {xError && <span className="pt-err">{xError}</span>}
          <button type="button" className="pt-b" onClick={() => setXOpen(false)}>{tr("Cancel")}</button>
          <button type="button" className="pt-b pri" disabled={xLoading} onClick={xConnect}>{xLoading ? tr("Saving…") : tr("Connect")}</button>
        </>}
      >
        <Field label={tr("Your handle")} value={xInput} onChange={setXInput} placeholder={tr("@yourhandle")} autoFocus />
      </Modal>
    </>
  );
}

export default function SettingsPage({ member }) {
  const tr = useT();
  const { dark, t } = useTheme();
  const toast = useToast();

  const [hasBankDetails, setHasBankDetails] = useState(!!(member.bankName && member.bankAccountNo && member.bankAccountName));
  const [savedBank, setSavedBank] = useState({ name: member.bankName || "", no: member.bankAccountNo || "", acct: member.bankAccountName || "" });
  const [bankName, setBankName] = useState(member.bankName || "");
  const [bankAccountNo, setBankAccountNo] = useState(member.bankAccountNo || "");
  const [bankAccountName, setBankAccountName] = useState(member.bankAccountName || "");
  const [bankOpen, setBankOpen] = useState(false);
  const [bankSaving, setBankSaving] = useState(false);
  const [bankError, setBankError] = useState(null);
  const [bankPassword, setBankPassword] = useState("");

  const [pwOpen, setPwOpen] = useState(false);
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [pwSaving, setPwSaving] = useState(false);
  const [pwError, setPwError] = useState(null);

  const openBankModal = () => {
    setBankName(savedBank.name);
    setBankAccountNo(savedBank.no);
    setBankAccountName(savedBank.acct);
    setBankPassword("");
    setBankError(null);
    setBankOpen(true);
  };

  const handleBankSave = async () => {
    setBankError(null);
    if (!bankName.trim() || !bankAccountNo.trim() || !bankAccountName.trim()) { setBankError("All fields are required"); return; }
    if (!bankPassword) { setBankError("Password is required to update bank details"); return; }
    setBankSaving(true);
    try {
      const res = await fetch("/api/pit/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ section: "bank", bankName: bankName.trim(), bankAccountNo: bankAccountNo.trim(), bankAccountName: bankAccountName.trim(), currentPassword: bankPassword }),
      });
      const d = await res.json();
      if (d.error) { setBankError(d.error); return; }
      setSavedBank({ name: bankName.trim(), no: bankAccountNo.trim(), acct: bankAccountName.trim() });
      setHasBankDetails(true);
      setBankOpen(false);
      toast.success("Bank details saved");
    } catch {
      setBankError("Something went wrong");
    } finally {
      setBankSaving(false);
    }
  };

  const handlePwSave = async () => {
    setPwError(null);
    if (!currentPw || !newPw) { setPwError("Both fields are required"); return; }
    if (newPw.length < 6) { setPwError("New password must be at least 6 characters"); return; }
    setPwSaving(true);
    try {
      const res = await fetch("/api/pit/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ section: "password", current: currentPw, newPassword: newPw }),
      });
      const d = await res.json();
      if (d.error) { setPwError(d.error); return; }
      setPwOpen(false);
      setCurrentPw("");
      setNewPw("");
      toast.success("Password updated");
    } catch {
      setPwError("Something went wrong");
    } finally {
      setPwSaving(false);
    }
  };

  const standing = `${member.role === "chief" ? "Chief" : "Crew"}${member.tier ? ` · ${member.tier}` : ""} · ${member.commissionRate}% of the pot`;

  return (
    <div className="set" style={pitVars(dark, t)}>
      <style>{SET_CSS}</style>

      <Card title={tr("Account")} cnt="how we reach you">
        <div className="pt-cb">
          <Row title={member.name} sub={standing} />
          <Row title="Email" sub={member.email} />
          <Row title="WhatsApp" sub={member.phone || "Not on file"} />
          <Row title="Password" sub={tr("Change it whenever you like")} action={<button type="button" className="pt-b sm" onClick={() => { setCurrentPw(""); setNewPw(""); setPwError(null); setPwOpen(true); }}>{tr("Change")}</button>} />
          <div className="pt-note">{tr("Your name, email and WhatsApp are set by your chief. Ask them to change one.")}</div>
        </div>
      </Card>

      <Card title={tr("Bank")} cnt="where payouts go">
        <div className="pt-cb">
          {hasBankDetails ? (
            <Row title={`${savedBank.name} · ${savedBank.no}`} sub={savedBank.acct} action={<button type="button" className="pt-b sm" onClick={openBankModal}>{tr("Change")}</button>} />
          ) : (
            <Row title={tr("No account on file")} sub={tr("Required before you can request a payout")} action={<button type="button" className="pt-b sm pri" onClick={openBankModal}>{tr("Add")}</button>} />
          )}
        </div>
      </Card>

      <Socials member={member} toast={toast} />

      <Modal
        open={bankOpen}
        onClose={() => setBankOpen(false)}
        title={hasBankDetails ? tr("Change where payouts go") : tr("Where should payouts go")}
        sub={tr("Your password confirms it is you.")}
        footer={<>
          {bankError && <span className="pt-err">{bankError}</span>}
          <button type="button" className="pt-b" onClick={() => setBankOpen(false)}>{tr("Cancel")}</button>
          <button type="button" className="pt-b pri" disabled={bankSaving} onClick={handleBankSave}>{bankSaving ? tr("Saving…") : tr("Save")}</button>
        </>}
      >
        <Field label={tr("Bank")} value={bankName} onChange={setBankName} placeholder="e.g. GTBank" />
        <Field label={tr("Account number")} value={bankAccountNo} onChange={setBankAccountNo} placeholder="0123456789" />
        <Field label={tr("Account name")} value={bankAccountName} onChange={setBankAccountName} placeholder={tr("The full name on the account")} />
        <Field label={tr("Your password")} value={bankPassword} onChange={setBankPassword} type="password" placeholder={tr("Required to save")} />
      </Modal>

      <Modal
        open={pwOpen}
        onClose={() => setPwOpen(false)}
        title={tr("Change your password")}
        footer={<>
          {pwError && <span className="pt-err">{pwError}</span>}
          <button type="button" className="pt-b" onClick={() => setPwOpen(false)}>{tr("Cancel")}</button>
          <button type="button" className="pt-b pri" disabled={pwSaving} onClick={handlePwSave}>{pwSaving ? tr("Saving…") : tr("Save")}</button>
        </>}
      >
        <Field label={tr("Current password")} value={currentPw} onChange={setCurrentPw} type="password" autoFocus />
        <Field label={tr("New password")} value={newPw} onChange={setNewPw} type="password" placeholder={tr("At least 6 characters")} />
      </Modal>
    </div>
  );
}

const SET_CSS = `
.set{display:flex;flex-direction:column;gap:14px}
.set .pt-frow{gap:12px}
.set .pt-cb>.pt-note{padding-top:10px;border-top:1px solid var(--rail)}
@media (max-width:900.98px){
  .set .pt-frow{flex-wrap:wrap}
  .set .pt-frow .pt-b{margin-left:auto}
}
`;
