"use client";
import { useState } from "react";
import { Modal } from "./kit";
import { useTheme } from "../shared-nav";
import { useToast } from "../toast";

function Field({ label, value, onChange, type = "text", placeholder, t }) {
  return (
    <div>
      <label className="text-[11.5px] font-medium block mb-1" style={{ color: t.muted }}>{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full py-[9px] px-3 rounded-lg text-[13.5px] bg-transparent outline-none"
        style={{ color: t.text, border: `1px solid ${t.surfaceBrd}`, fontFamily: "inherit" }}
      />
    </div>
  );
}

function ProfileCard({ member, dark, t }) {
  const initials = (member.name || "?").split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();

  const fields = [
    { label: "Email", value: member.email },
    { label: "Phone", value: member.phone || null },
  ];

  return (
    <div className="rounded-[14px] overflow-hidden col-span-2 max-md:col-span-1" style={{ background: t.surface, border: `1px solid ${t.surfaceBrd}` }}>
      <div className="h-[64px]" style={{ background: "linear-gradient(135deg, #c47d8e 0%, #a3586b 50%, #8b5e6b 100%)" }} />
      <div className="px-[18px] pb-[18px]">
        <div className="-mt-7 mb-3 w-[52px] h-[52px] rounded-[14px] flex items-center justify-center text-[18px] font-bold text-white shadow-lg" style={{ background: t.grad, border: `3px solid ${dark ? "#0e1120" : "#f4f1ed"}` }}>
          {initials}
        </div>
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-[17px] font-semibold" style={{ color: t.text }}>{member.name}</span>
          <span className="text-[10.5px] font-semibold py-[2px] px-[7px] rounded-md capitalize" style={{ color: t.accent, background: t.accentLight }}>{member.role === "chief" ? "Crew Chief" : "Crew"}</span>
        </div>
        <div className="flex items-center gap-1.5 mb-3">
          {member.role !== "chief" && <span className="text-[11px] font-semibold py-[1px] px-[6px] rounded capitalize" style={{ color: dark ? "#fcd34d" : "#b45309", background: dark ? "rgba(250,204,21,.12)" : "rgba(250,204,21,.08)" }}>{member.tier}</span>}
          <span className="text-[11.5px]" style={{ color: t.muted }}>{member.commissionRate}% commission</span>
        </div>
        <div className="text-[12px] mb-3.5" style={{ color: t.muted }}>Your profile details. Contact your crew chief to update.</div>
        <div className="grid grid-cols-2 max-md:grid-cols-1 gap-y-3 gap-x-6">
          {fields.map(f => (
            <div key={f.label}>
              <div className="text-[10.5px] font-semibold tracking-[.6px] uppercase mb-[3px]" style={{ color: t.muted }}>{f.label}</div>
              <div className="text-[13.5px] font-medium" style={{ color: f.value ? t.text : t.muted }}>{f.value || "—"}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function SocialsCard({ member, dark, t, toast }) {
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

  const hdr = { background: dark ? "rgba(196,125,142,.18)" : "rgba(196,125,142,.12)", borderBottom: `1px solid ${t.surfaceBrd}` };
  const dimBg = dark ? "rgba(255,255,255,.06)" : "rgba(0,0,0,.04)";

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
      const poll = setInterval(async () => {
        attempts++;
        try {
          const r = await fetch("/api/pit/settings?check=telegram");
          const s = await r.json();
          if (s.linked) {
            clearInterval(poll);
            setTgLinked(true);
            setTgHandle(s.handle);
            setTgLoading(false);
            toast.success("Telegram connected");
          } else if (attempts >= 30) {
            clearInterval(poll);
            setTgLoading(false);
          }
        } catch {
          clearInterval(poll);
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
      <div className="rounded-[14px] overflow-hidden col-span-2 max-md:col-span-1" style={{ background: t.surface, border: `1px solid ${t.surfaceBrd}` }}>
        <div className="py-[10px] px-[18px]" style={hdr}>
          <div className="text-[12px] font-semibold tracking-[0.3px] uppercase" style={{ color: t.muted }}>Socials</div>
          <div className="text-[11px] mt-[2px]" style={{ color: t.soft }}>Connect your social accounts</div>
        </div>
        <div className="px-[18px]">
          {/* Twitter / X */}
          <div className="flex items-center gap-3.5 py-[14px]">
            <div className="w-10 h-10 rounded-[10px] flex items-center justify-center shrink-0" style={{ background: xHandle ? (dark ? "#fff" : "#000") : dimBg }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill={xHandle ? (dark ? "#000" : "#fff") : t.muted}><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[13.5px] font-semibold" style={{ color: t.text }}>Twitter</div>
              <div className="text-[12px] mt-[2px]" style={{ color: t.muted }}>{xHandle ? `@${xHandle}` : "Not connected"}</div>
            </div>
            {xHandle ? (
              <button onClick={() => setDisconnectTarget("twitter")} className="text-[11.5px] font-semibold bg-transparent border-none cursor-pointer shrink-0" style={{ color: t.red, fontFamily: "inherit" }}>Disconnect</button>
            ) : (
              <button onClick={() => { setXInput(""); setXError(null); setXOpen(true); }} className="text-[11.5px] font-semibold bg-transparent border-none cursor-pointer shrink-0" style={{ color: t.accent, fontFamily: "inherit" }}>Connect</button>
            )}
          </div>

          <div style={{ height: 1, background: t.surfaceBrd }} />

          {/* Telegram */}
          <div className="flex items-center gap-3.5 py-[14px]">
            <div className="w-10 h-10 rounded-[10px] flex items-center justify-center shrink-0" style={{ background: tgLinked ? "#0088cc" : dimBg }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill={tgLinked ? "#fff" : t.muted}><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 00-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.12-.31-1.08-.66.02-.18.27-.36.74-.55 2.92-1.27 4.86-2.11 5.83-2.51 2.78-1.16 3.35-1.36 3.73-1.36.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .38z"/></svg>
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[13.5px] font-semibold" style={{ color: t.text }}>Telegram</div>
              <div className="text-[12px] mt-[2px]" style={{ color: t.muted }}>{tgLinked ? (tgHandle ? `@${tgHandle}` : "Connected") : "Not connected"}</div>
            </div>
            {tgLinked ? (
              <button onClick={() => setDisconnectTarget("telegram")} className="text-[11.5px] font-semibold bg-transparent border-none cursor-pointer shrink-0" style={{ color: t.red, fontFamily: "inherit" }}>Disconnect</button>
            ) : (
              <button onClick={tgConnect} disabled={tgLoading} className="text-[11.5px] font-semibold bg-transparent border-none cursor-pointer shrink-0" style={{ color: t.accent, fontFamily: "inherit" }}>{tgLoading ? "..." : "Connect"}</button>
            )}
          </div>
          {tgError && <div className="text-[11px] pb-2 pl-[54px]" style={{ color: t.red }}>{tgError}</div>}
        </div>
      </div>

      {/* Disconnect confirmation modal */}
      <Modal open={!!disconnectTarget} onClose={() => setDisconnectTarget(null)} title={`Disconnect ${disconnectTarget === "twitter" ? "Twitter" : "Telegram"}?`} dark={dark} t={t}>
        <div className="text-[13px]" style={{ color: t.muted }}>
          Are you sure you want to disconnect your {disconnectTarget === "twitter" ? "Twitter" : "Telegram"} account{disconnectTarget === "twitter" && xHandle ? ` (@${xHandle})` : disconnectTarget === "telegram" && tgHandle ? ` (@${tgHandle})` : ""}?
        </div>
        <div className="flex gap-2 justify-end mt-1">
          <button onClick={() => setDisconnectTarget(null)} className="py-[7px] px-4 rounded-lg text-[12.5px] font-medium border-none cursor-pointer" style={{ background: "transparent", color: t.muted, fontFamily: "inherit" }}>Cancel</button>
          <button
            onClick={async () => {
              const target = disconnectTarget;
              setDisconnectTarget(null);
              if (target === "twitter") await xDisconnect();
              else await tgDisconnect();
            }}
            disabled={xLoading || tgLoading}
            className="py-[7px] px-4 rounded-lg text-[12.5px] font-semibold border-none cursor-pointer text-white disabled:opacity-50"
            style={{ background: t.red, fontFamily: "inherit" }}
          >
            Disconnect
          </button>
        </div>
      </Modal>

      {/* Twitter connect modal */}
      <Modal open={xOpen} onClose={() => setXOpen(false)} title="Connect Twitter" dark={dark} t={t}>
        <Field label="Your Twitter handle" value={xInput} onChange={setXInput} placeholder="@yourhandle" t={t} />
        {xError && <div className="text-[12.5px]" style={{ color: t.red }}>{xError}</div>}
        <div className="flex gap-2 justify-end mt-1">
          <button onClick={() => setXOpen(false)} className="py-[7px] px-4 rounded-lg text-[12.5px] font-medium border-none cursor-pointer" style={{ background: "transparent", color: t.muted, fontFamily: "inherit" }}>Cancel</button>
          <button onClick={xConnect} disabled={xLoading} className="py-[7px] px-4 rounded-lg text-[12.5px] font-semibold border-none cursor-pointer text-white disabled:opacity-50" style={{ background: t.grad, fontFamily: "inherit" }}>{xLoading ? "Saving..." : "Connect"}</button>
        </div>
      </Modal>
    </>
  );
}

export default function SettingsPage({ member }) {
  const { dark, t } = useTheme();
  const toast = useToast();
  const hdr = { background: dark ? "rgba(196,125,142,.18)" : "rgba(196,125,142,.12)", borderBottom: `1px solid ${t.surfaceBrd}` };

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

  return (
    <div className="grid grid-cols-2 max-md:grid-cols-1 gap-4">
      <ProfileCard member={member} dark={dark} t={t} />
      <SocialsCard member={member} dark={dark} t={t} toast={toast} />

      {/* Payout account card */}
      <div className="rounded-[14px] overflow-hidden" style={{ background: t.surface, border: `1px solid ${t.surfaceBrd}` }}>
        <div className="py-[10px] px-[18px]" style={hdr}>
          <div className="text-[12px] font-semibold tracking-[0.3px] uppercase" style={{ color: t.muted }}>Payout Account</div>
          <div className="text-[11px] mt-[2px]" style={{ color: t.soft }}>Where your earnings are sent</div>
        </div>
        {hasBankDetails ? (
          <div className="py-[14px] px-[18px] flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-[10px] flex items-center justify-center shrink-0" style={{ background: dark ? "rgba(110,231,183,.1)" : "rgba(5,150,105,.08)" }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={t.green} strokeWidth="2" strokeLinecap="round"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[13.5px] font-semibold" style={{ color: t.text }}>{savedBank.acct}</div>
              <div className="text-[12px] mt-[2px]" style={{ color: t.muted }}>{savedBank.no} · {savedBank.name}</div>
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

      {/* Password card */}
      <div className="rounded-[14px] overflow-hidden" style={{ background: t.surface, border: `1px solid ${t.surfaceBrd}` }}>
        <div className="py-[10px] px-[18px]" style={hdr}>
          <div className="text-[12px] font-semibold tracking-[0.3px] uppercase" style={{ color: t.muted }}>Password</div>
          <div className="text-[11px] mt-[2px]" style={{ color: t.soft }}>Manage your login credentials</div>
        </div>
        <div className="py-[14px] px-[18px] flex items-center justify-between">
          <div className="text-[12.5px]" style={{ color: t.muted }}>Change your login password</div>
          <button onClick={() => { setCurrentPw(""); setNewPw(""); setPwError(null); setPwOpen(true); }} className="text-[11.5px] font-semibold bg-transparent border-none cursor-pointer shrink-0" style={{ color: t.accent, fontFamily: "inherit" }}>Change</button>
        </div>
      </div>

      {/* Bank details modal */}
      <Modal open={bankOpen} onClose={() => setBankOpen(false)} title={hasBankDetails ? "Edit Payout Account" : "Add Bank Details"} dark={dark} t={t}>
        <Field label="Bank name" value={bankName} onChange={setBankName} placeholder="e.g. GTBank" t={t} />
        <Field label="Account number" value={bankAccountNo} onChange={setBankAccountNo} placeholder="0123456789" t={t} />
        <Field label="Account name" value={bankAccountName} onChange={setBankAccountName} placeholder="Full name on account" t={t} />
        <Field label="Current password" value={bankPassword} onChange={setBankPassword} type="password" placeholder="Required to save changes" t={t} />
        {bankError && <div className="text-[12.5px]" style={{ color: t.red }}>{bankError}</div>}
        <div className="flex gap-2 justify-end mt-1">
          <button onClick={() => setBankOpen(false)} className="py-[7px] px-4 rounded-lg text-[12.5px] font-medium border-none cursor-pointer" style={{ background: "transparent", color: t.muted, fontFamily: "inherit" }}>Cancel</button>
          <button onClick={handleBankSave} disabled={bankSaving} className="py-[7px] px-4 rounded-lg text-[12.5px] font-semibold border-none cursor-pointer text-white disabled:opacity-50" style={{ background: t.grad, fontFamily: "inherit" }}>{bankSaving ? "Saving..." : "Save"}</button>
        </div>
      </Modal>

      {/* Password modal */}
      <Modal open={pwOpen} onClose={() => setPwOpen(false)} title="Change Password" dark={dark} t={t}>
        <Field label="Current password" value={currentPw} onChange={setCurrentPw} type="password" t={t} />
        <Field label="New password" value={newPw} onChange={setNewPw} type="password" placeholder="Min 6 characters" t={t} />
        {pwError && <div className="text-[12.5px]" style={{ color: t.red }}>{pwError}</div>}
        <div className="flex gap-2 justify-end mt-1">
          <button onClick={() => setPwOpen(false)} className="py-[7px] px-4 rounded-lg text-[12.5px] font-medium border-none cursor-pointer" style={{ background: "transparent", color: t.muted, fontFamily: "inherit" }}>Cancel</button>
          <button onClick={handlePwSave} disabled={pwSaving} className="py-[7px] px-4 rounded-lg text-[12.5px] font-semibold border-none cursor-pointer text-white disabled:opacity-50" style={{ background: t.grad, fontFamily: "inherit" }}>{pwSaving ? "Saving..." : "Save"}</button>
        </div>
      </Modal>
    </div>
  );
}
