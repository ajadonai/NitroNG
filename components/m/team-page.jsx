"use client";
import { useState } from "react";
import PortalShell from "./shell";
import { StatusBadge, EmptyState } from "./kit";
import { useTheme } from "../shared-nav";
import { fN } from "@/lib/format";

function fmtDate(d) {
  return new Date(d).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" });
}

function Inner({ member, initialData }) {
  const { dark, t } = useTheme();
  const [data, setData] = useState(initialData);
  const [showInvite, setShowInvite] = useState(false);
  const [invName, setInvName] = useState("");
  const [invEmail, setInvEmail] = useState("");
  const [inviting, setInviting] = useState(false);
  const [invError, setInvError] = useState(null);
  const [inviteResult, setInviteResult] = useState(null);
  const [copied, setCopied] = useState(false);

  const reload = () => {
    fetch("/api/pit/team")
      .then((r) => r.json())
      .then((d) => { if (!d.error) setData(d); })
      .catch(() => {});
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
      reload();
    } catch {
      setInvError("Something went wrong");
    } finally {
      setInviting(false);
    }
  };

  const copyInvite = () => {
    if (inviteResult?.inviteUrl) {
      navigator.clipboard.writeText(inviteResult.inviteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const members = data?.members || [];
  const approved = members.filter((m) => m.status === "approved");
  const pending = members.filter((m) => m.status === "pending");

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="text-[13px]" style={{ color: t.muted }}>{approved.length} active member{approved.length !== 1 ? "s" : ""}</div>
        <button
          onClick={() => { setShowInvite(!showInvite); setInviteResult(null); }}
          className="py-[8px] px-4 rounded-xl text-[13px] font-semibold border-none cursor-pointer text-white transition-transform duration-150 hover:-translate-y-px"
          style={{ background: t.grad, fontFamily: "inherit" }}
        >
          + Invite Member
        </button>
      </div>

      {/* Invite form / result */}
      {showInvite && (
        <div className="rounded-[14px] overflow-hidden" style={{ background: t.surface, border: `1px solid ${t.surfaceBrd}` }}>
          <div className="py-[10px] px-[18px]" style={{ background: dark ? "rgba(196,125,142,.18)" : "rgba(196,125,142,.12)", borderBottom: `1px solid ${t.surfaceBrd}` }}>
            <div className="text-[12px] font-semibold tracking-[0.3px] uppercase" style={{ color: t.muted }}>
              {inviteResult ? "Invite Sent" : "Invite a Crew Member"}
            </div>
          </div>
          <div className="p-[18px]">
            {inviteResult ? (
              <div className="flex flex-col gap-3">
                <div className="text-[13px]" style={{ color: t.text }}>
                  Invite link for <b>{inviteResult.name}</b>:
                </div>
                <div className="flex items-center gap-2 py-2 px-3 rounded-lg" style={{ background: dark ? "rgba(255,255,255,.05)" : "rgba(0,0,0,.03)", border: `1px solid ${t.surfaceBrd}` }}>
                  <span className="text-[12px] flex-1 truncate" style={{ color: t.accent }}>{inviteResult.inviteUrl}</span>
                  <button
                    onClick={copyInvite}
                    className="bg-transparent border-none cursor-pointer p-1 flex shrink-0"
                    style={{ color: copied ? t.green : t.muted }}
                  >
                    {copied
                      ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12"/></svg>
                      : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                    }
                  </button>
                </div>
                <div className="text-[11.5px]" style={{ color: t.muted }}>This link expires in 7 days. Send it to {inviteResult.name} to complete their registration.</div>
                <button
                  onClick={() => { setInviteResult(null); setShowInvite(false); }}
                  className="self-end py-[7px] px-4 rounded-lg text-[12.5px] font-medium border-none cursor-pointer"
                  style={{ background: "transparent", color: t.muted, fontFamily: "inherit" }}
                >
                  Done
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                <div>
                  <label className="text-[11.5px] font-medium block mb-1" style={{ color: t.muted }}>Name</label>
                  <input
                    value={invName}
                    onChange={(e) => setInvName(e.target.value)}
                    placeholder="Full name"
                    className="w-full py-[9px] px-3 rounded-lg text-[13.5px] bg-transparent outline-none"
                    style={{ color: t.text, border: `1px solid ${t.surfaceBrd}`, fontFamily: "inherit" }}
                  />
                </div>
                <div>
                  <label className="text-[11.5px] font-medium block mb-1" style={{ color: t.muted }}>Email</label>
                  <input
                    value={invEmail}
                    onChange={(e) => setInvEmail(e.target.value)}
                    placeholder="email@example.com"
                    type="email"
                    className="w-full py-[9px] px-3 rounded-lg text-[13.5px] bg-transparent outline-none"
                    style={{ color: t.text, border: `1px solid ${t.surfaceBrd}`, fontFamily: "inherit" }}
                  />
                </div>
                {invError && <div className="text-[12.5px]" style={{ color: t.red }}>{invError}</div>}
                <div className="flex gap-2 justify-end mt-1">
                  <button
                    onClick={() => { setShowInvite(false); setInvName(""); setInvEmail(""); setInvError(null); }}
                    className="py-[7px] px-4 rounded-lg text-[12.5px] font-medium border-none cursor-pointer"
                    style={{ background: "transparent", color: t.muted, fontFamily: "inherit" }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleInvite}
                    disabled={inviting}
                    className="py-[7px] px-4 rounded-lg text-[12.5px] font-semibold border-none cursor-pointer text-white disabled:opacity-50"
                    style={{ background: t.grad, fontFamily: "inherit" }}
                  >
                    {inviting ? "Sending..." : "Send Invite"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Pending invites */}
      {pending.length > 0 && (
        <div className="rounded-[14px] overflow-hidden" style={{ background: t.surface, border: `1px solid ${t.surfaceBrd}` }}>
          <div className="py-[10px] px-[18px]" style={{ background: dark ? "rgba(196,125,142,.18)" : "rgba(196,125,142,.12)", borderBottom: `1px solid ${t.surfaceBrd}` }}>
            <div className="text-[12px] font-semibold tracking-[0.3px] uppercase" style={{ color: t.muted }}>Pending ({pending.length})</div>
          </div>
          {pending.map((m, i) => (
            <div key={m.id} className="flex items-center gap-3 px-[18px] py-[12px]" style={{ borderTop: i > 0 ? `1px solid ${t.surfaceBrd}` : undefined }}>
              <div className="w-8 h-8 rounded-[9px] flex items-center justify-center text-[11px] font-bold text-white shrink-0" style={{ background: t.grad }}>
                {m.name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-medium truncate" style={{ color: t.text }}>{m.name}</div>
                <div className="text-[11.5px] truncate" style={{ color: t.muted }}>{m.email}</div>
              </div>
              <StatusBadge status={m.hasPendingInvite ? "invited" : "pending"} label={m.hasPendingInvite ? "Invited" : "Applied"} dark={dark} t={t} />
            </div>
          ))}
        </div>
      )}

      {/* Active members */}
      {approved.length === 0 && pending.length === 0 ? (
        <EmptyState
          title="No crew members yet"
          subtitle="Invite your first crew member to start building your team."
          icon={<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>}
          t={t}
        />
      ) : approved.length > 0 && (
        <div className="rounded-[14px] overflow-hidden" style={{ background: t.surface, border: `1px solid ${t.surfaceBrd}` }}>
          <div className="py-[10px] px-[18px]" style={{ background: dark ? "rgba(196,125,142,.18)" : "rgba(196,125,142,.12)", borderBottom: `1px solid ${t.surfaceBrd}` }}>
            <div className="text-[12px] font-semibold tracking-[0.3px] uppercase" style={{ color: t.muted }}>Active Members ({approved.length})</div>
          </div>
          {approved.map((m, i) => (
            <div key={m.id} className="flex items-center gap-3 px-[18px] py-[12px] max-md:flex-wrap" style={{ borderTop: i > 0 ? `1px solid ${t.surfaceBrd}` : undefined }}>
              <div className="w-8 h-8 rounded-[9px] flex items-center justify-center text-[11px] font-bold text-white shrink-0" style={{ background: t.grad }}>
                {m.name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[13px] font-medium truncate" style={{ color: t.text }}>{m.name}</span>
                  <span className="text-[10px] font-semibold py-[1px] px-[6px] rounded-md capitalize" style={{ color: t.accent, background: t.accentLight }}>{m.tier}</span>
                </div>
                <div className="text-[11.5px] mt-[1px]" style={{ color: t.muted }}>{m.email}</div>
              </div>
              <div className="flex items-center gap-4 shrink-0 text-[12px] max-md:w-full max-md:mt-1 max-md:pl-11" style={{ color: t.muted }}>
                <span><b className="m" style={{ color: t.text }}>{fN(m.totalEarned)}</b> earned</span>
                <span><b className="m" style={{ color: t.text }}>{m.commissions}</b> sales</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function TeamPage({ member, initialData }) {
  return <PortalShell member={member}><Inner member={member} initialData={initialData} /></PortalShell>;
}
