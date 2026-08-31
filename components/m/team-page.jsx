"use client";
import { useState, useMemo } from "react";
import { Card, Chip, Empty, Fact, Facts, Field, Modal, initialsOf, longDate, pitVars } from "./kit";
import { useTheme } from "../shared-nav";
import { useToast } from "../toast";
import { useHeaderAction } from "./shell";
import { fN } from "@/lib/format";
import { copyText } from '@/lib/clipboard';

export default function TeamPage({ initialData }) {
  const { dark, t } = useTheme();
  const toast = useToast();
  const [data, setData] = useState(initialData);
  const [showInvite, setShowInvite] = useState(false);
  const [invName, setInvName] = useState("");
  const [invEmail, setInvEmail] = useState("");
  const [inviting, setInviting] = useState(false);
  const [invError, setInvError] = useState(null);
  const [inviteResult, setInviteResult] = useState(null);
  const [copied, setCopied] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [resendResult, setResendResult] = useState(null);
  const [actionLoading, setActionLoading] = useState(null);

  const reload = () => {
    setRefreshing(true);
    fetch("/api/pit/team")
      .then((r) => r.json())
      .then((d) => { if (!d.error) setData(d); })
      .catch(() => {})
      .finally(() => setRefreshing(false));
  };

  const handleInvite = async () => {
    setInvError(null);
    if (!invName.trim() || !invEmail.trim()) { setInvError("Name and email are required"); return; }
    setInviting(true);
    try {
      const res = await fetch("/api/pit/team", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: invName.trim(), email: invEmail.trim() }),
      });
      const d = await res.json();
      if (d.error) { setInvError(d.error); return; }
      setInviteResult(d.invited);
      setInvName("");
      setInvEmail("");
      toast.success("Invite link created");
      reload();
    } catch {
      setInvError("Something went wrong");
    } finally {
      setInviting(false);
    }
  };

  const copyInvite = (url) => {
    copyText(url || inviteResult?.inviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleResend = async (memberId) => {
    setActionLoading(memberId);
    try {
      const res = await fetch("/api/pit/team", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberId }),
      });
      const d = await res.json();
      if (d.error) { toast.error(d.error); return; }
      setResendResult({ memberId, inviteUrl: d.inviteUrl, name: d.name });
      toast.success("New invite link created");
      reload();
    } catch { toast.error("Something went wrong"); }
    finally { setActionLoading(null); }
  };

  const handleRevoke = async (memberId, name) => {
    if (!confirm(`Revoke invite for ${name}? This will remove the pending member.`)) return;
    setActionLoading(memberId);
    try {
      const res = await fetch("/api/pit/team", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberId }),
      });
      const d = await res.json();
      if (d.error) { toast.error(d.error); return; }
      toast.success("Invite revoked");
      reload();
    } catch { toast.error("Something went wrong"); }
    finally { setActionLoading(null); }
  };

  const members = data?.members || [];
  const approved = members.filter((m) => m.status === "approved");
  const pending = members.filter((m) => m.status === "pending");

  useHeaderAction(useMemo(() => (
    <button type="button" className="pt-b pri" onClick={() => { setShowInvite(true); setInviteResult(null); setInvError(null); }}>+ Invite someone</button>
  ), []));

  const earned = approved.reduce((n, m) => n + m.totalEarned, 0);
  const sales = approved.reduce((n, m) => n + m.commissions, 0);
  const links = approved.reduce((n, m) => n + m.links, 0);

  return (
    <div className="tem" style={pitVars(dark, t)}>
      <style>{TEM_CSS}</style>

      <Facts>
        <Fact value={String(approved.length)} label="In your crew" sub={pending.length ? `${pending.length} waiting` : "nobody waiting"} kind={pending.length ? "warn" : undefined} />
        <Fact value={fN(earned)} label="They earned" sub="all time, between them" kind="ok" />
        <Fact value={sales.toLocaleString()} label="Their sales" sub="orders through their links" />
        <Fact value={links.toLocaleString()} label="Their links" sub="running for you" />
      </Facts>

      {pending.length > 0 && (
        <Card title="Waiting" cnt="send the link again, or take it back">
          <div className="pt-list" style={{ opacity: refreshing ? 0.6 : 1, transition: "opacity 200ms" }}>
            {pending.map((m) => (
              <div key={m.id}>
                <div className="pt-r tm">
                  <span className="pt-av sm">{initialsOf(m.name)}</span>
                  <span className="pt-tt"><b>{m.name}</b><i>{m.email}</i></span>
                  <Chip kind={m.inviteExpired ? "bad" : m.hasPendingInvite ? "warn" : "dim"}>
                    {m.inviteExpired ? "Link expired" : m.hasPendingInvite ? "Invited, not joined" : `Asked ${longDate(m.createdAt)}`}
                  </Chip>
                  <span className="pt-acts">
                    <button type="button" className="pt-b sm pri" disabled={actionLoading === m.id} onClick={() => handleResend(m.id)}>Send the link again</button>
                    <button type="button" className="pt-b sm bad" disabled={actionLoading === m.id} onClick={() => handleRevoke(m.id, m.name)}>Take it back</button>
                  </span>
                </div>
                {resendResult?.memberId === m.id && (
                  <div className="tem-inv">
                    <span className="m">{resendResult.inviteUrl}</span>
                    <button type="button" className="pt-b sm" onClick={() => copyInvite(resendResult.inviteUrl)}>{copied ? "Copied" : "Copy"}</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card title="Your crew" cnt="what each one has brought in">
        {approved.length === 0 ? (
          <Empty>Nobody in the crew yet. Invite someone and their earnings show up here.</Empty>
        ) : (
          <div className="pt-list" style={{ opacity: refreshing ? 0.6 : 1, transition: "opacity 200ms" }}>
            {approved.map((m) => (
              <div key={m.id} className="pt-r tm2">
                <span className="pt-av sm">{initialsOf(m.name)}</span>
                <span className="pt-tt"><b>{m.name}</b><i>{m.email}</i></span>
                <Chip kind="ok">{m.tier} {m.commissionRate}%</Chip>
                <span className="pt-num m tem-sales">{m.commissions.toLocaleString()}</span>
                <span className="pt-num m ok">{fN(m.totalEarned)}</span>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Modal
        open={showInvite}
        onClose={() => { setShowInvite(false); setInvName(""); setInvEmail(""); setInvError(null); setInviteResult(null); }}
        title={inviteResult ? "The link is ready" : "Invite someone"}
        sub={inviteResult ? "Send it to them yourself. It stops working after seven days." : "They get a link to finish signing up."}
        footer={inviteResult ? (
          <button type="button" className="pt-b pri" onClick={() => { setInviteResult(null); setShowInvite(false); }}>Done</button>
        ) : (<>
          {invError && <span className="pt-err">{invError}</span>}
          <button type="button" className="pt-b" onClick={() => { setShowInvite(false); setInvName(""); setInvEmail(""); setInvError(null); }}>Cancel</button>
          <button type="button" className="pt-b pri" disabled={inviting} onClick={handleInvite}>{inviting ? "Sending…" : "Send invite"}</button>
        </>)}
      >
        {inviteResult ? <>
          <div className="pt-note">The invite link for <b>{inviteResult.name}</b>:</div>
          <div className="tem-inv" style={{ marginTop: 10 }}>
            <span className="m">{inviteResult.inviteUrl}</span>
            <button type="button" className="pt-b sm" onClick={() => copyInvite()}>{copied ? "Copied" : "Copy"}</button>
          </div>
        </> : <>
          <Field label="Name" value={invName} onChange={setInvName} placeholder="Their full name" autoFocus />
          <Field label="Email" value={invEmail} onChange={setInvEmail} type="email" placeholder="them@example.com" />
        </>}
      </Modal>
    </div>
  );
}

const TEM_CSS = `
.tem{display:flex;flex-direction:column;gap:14px}
.tem .pt-list>div+div>.pt-r{border-top:1px solid var(--rail)}
.tem-inv{display:flex;align-items:center;gap:10px;margin:0 16px 12px;padding:9px 12px;border-radius:10px;border:1px solid var(--line);background:var(--soft);min-width:0}
.tem-inv span{flex:1;min-width:0;font-size:12px;color:var(--ac);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.pt-md .tem-inv{margin:0}
@media (min-width:900.99px){
  .tem .pt-r.tm{grid-template-columns:30px 1fr 160px auto}
  .tem .pt-r.tm2{grid-template-columns:30px 1fr 120px 70px 100px}
}
@media (max-width:900.98px){
  .tem .pt-r .tem-sales{grid-area:cnt;justify-self:end;font-weight:600;color:var(--mut)}
  .tem .pt-r .tem-sales::after{content:" sales";font-weight:500}
}
`;
