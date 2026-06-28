"use client";
import { useState } from "react";
import PortalShell from "./shell";
import { useTheme } from "../shared-nav";

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

function Card({ title, dark, t, children, onSave, saving, success, error }) {
  return (
    <div className="rounded-[14px] overflow-hidden" style={{ background: t.surface, border: `1px solid ${t.surfaceBrd}` }}>
      <div className="py-[10px] px-[18px]" style={{ background: dark ? "rgba(196,125,142,.18)" : "rgba(196,125,142,.12)", borderBottom: `1px solid ${t.surfaceBrd}` }}>
        <div className="text-[12px] font-semibold tracking-[0.3px] uppercase" style={{ color: t.muted }}>{title}</div>
      </div>
      <div className="p-[18px] flex flex-col gap-3">
        {children}
        {error && <div className="text-[12.5px]" style={{ color: t.red }}>{error}</div>}
        {success && <div className="text-[12.5px]" style={{ color: t.green }}>Saved</div>}
        <div className="flex justify-end mt-1">
          <button
            onClick={onSave}
            disabled={saving}
            className="py-[7px] px-4 rounded-lg text-[12.5px] font-semibold border-none cursor-pointer text-white disabled:opacity-50"
            style={{ background: t.grad, fontFamily: "inherit" }}
          >
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

function TelegramCard({ member, t }) {
  const [loading, setLoading] = useState(false);
  const [code, setCode] = useState(null);
  const [error, setError] = useState(null);
  const linked = member.telegramLinked;

  const generateCode = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/pit/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ section: "telegram" }),
      });
      const d = await res.json();
      if (d.error) { setError(d.error); return; }
      setCode(d.code);
    } catch {
      setError("Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const GROUP_LINK = member.telegramGroupLink || "https://t.me/+example";

  return (
    <div className="rounded-[14px] overflow-hidden col-span-2 max-md:col-span-1" style={{ background: t.surface, border: `1px solid ${t.surfaceBrd}` }}>
      <div className="py-[10px] px-[18px]" style={{ background: "rgba(196,125,142,.12)", borderBottom: `1px solid ${t.surfaceBrd}` }}>
        <div className="text-[12px] font-semibold tracking-[0.3px] uppercase" style={{ color: t.muted }}>Telegram</div>
      </div>
      <div className="p-[18px] flex flex-col gap-4">
        {/* Group join */}
        <div className="flex items-start gap-3 p-3 rounded-xl" style={{ background: "rgba(196,125,142,.06)", border: `1px solid rgba(196,125,142,.15)` }}>
          <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0" style={{ background: "rgba(196,125,142,.15)" }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={t.accent} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z"/></svg>
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[13px] font-semibold mb-1" style={{ color: t.text }}>Pit Telegram Group</div>
            <div className="text-[12px] mb-2.5" style={{ color: t.muted }}>Join the crew group for updates, leaderboards, and team chat. Make sure your Telegram username matches what you used to apply.</div>
            <a
              href={GROUP_LINK}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 py-[6px] px-3 rounded-lg text-[12.5px] font-semibold no-underline text-white"
              style={{ background: "#0088cc" }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 00-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.12-.31-1.08-.66.02-.18.27-.36.74-.55 2.92-1.27 4.86-2.11 5.83-2.51 2.78-1.16 3.35-1.36 3.73-1.36.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .38z"/></svg>
              Join Group
            </a>
          </div>
        </div>

        {/* Bot link status */}
        <div className="flex items-start gap-3 p-3 rounded-xl" style={{ background: t.bg, border: `1px solid ${t.surfaceBrd}` }}>
          <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0" style={{ background: linked ? "rgba(16,185,129,.1)" : "rgba(196,125,142,.1)" }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={linked ? t.green : t.muted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[13px] font-semibold mb-1" style={{ color: t.text }}>Marshal Bot</div>
            {linked ? (
              <div className="text-[12.5px] flex items-center gap-1.5" style={{ color: t.green }}>
                <span>✓</span> Connected — you can use /mystats, /earnings, etc.
              </div>
            ) : code ? (
              <>
                <div className="text-[12px] mb-2" style={{ color: t.muted }}>
                  Send this to <b>@NitroCrewBot</b> in a DM:
                </div>
                <div
                  className="py-[7px] px-3 rounded-lg text-[13px] font-mono select-all cursor-pointer inline-block"
                  style={{ background: t.surface, border: `1px solid ${t.surfaceBrd}`, color: t.text }}
                  onClick={() => navigator.clipboard?.writeText(`/start ${code}`)}
                  title="Click to copy"
                >
                  /start {code}
                </div>
                <div className="text-[11px] mt-1.5" style={{ color: t.muted }}>Click to copy. Expires in 10 minutes.</div>
              </>
            ) : (
              <>
                <div className="text-[12px] mb-2" style={{ color: t.muted }}>Link your Telegram to use bot commands and receive DM notifications.</div>
                {error && <div className="text-[12px] mb-2" style={{ color: t.red }}>{error}</div>}
                <button
                  onClick={generateCode}
                  disabled={loading}
                  className="py-[6px] px-3 rounded-lg text-[12.5px] font-semibold border-none cursor-pointer text-white disabled:opacity-50"
                  style={{ background: t.grad, fontFamily: "inherit" }}
                >
                  {loading ? "Generating..." : "Link Bot"}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Inner({ member }) {
  const { dark, t } = useTheme();

  const [name, setName] = useState(member.name);
  const [phone, setPhone] = useState(member.phone);
  const [xHandle, setXHandle] = useState(member.xHandle);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileError, setProfileError] = useState(null);
  const [profileSuccess, setProfileSuccess] = useState(false);

  const [bankName, setBankName] = useState(member.bankName);
  const [bankAccountNo, setBankAccountNo] = useState(member.bankAccountNo);
  const [bankAccountName, setBankAccountName] = useState(member.bankAccountName);
  const [bankSaving, setBankSaving] = useState(false);
  const [bankError, setBankError] = useState(null);
  const [bankSuccess, setBankSuccess] = useState(false);

  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [pwSaving, setPwSaving] = useState(false);
  const [pwError, setPwError] = useState(null);
  const [pwSuccess, setPwSuccess] = useState(false);

  const save = async (section, body, setSaving, setError, setSuccess) => {
    setSaving(true);
    setError(null);
    setSuccess(false);
    try {
      const res = await fetch("/api/pit/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ section, ...body }),
      });
      const d = await res.json();
      if (d.error) { setError(d.error); return; }
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch {
      setError("Something went wrong");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="grid grid-cols-2 max-md:grid-cols-1 gap-4">
      <TelegramCard member={member} t={t} />
      <Card title="Profile" dark={dark} t={t} saving={profileSaving} error={profileError} success={profileSuccess}
        onSave={() => save("profile", { name, phone, xHandle }, setProfileSaving, setProfileError, setProfileSuccess)}>
        <Field label="Full name" value={name} onChange={setName} t={t} />
        <Field label="Email" value={member.email} onChange={() => {}} t={t} />
        <Field label="Phone" value={phone} onChange={setPhone} placeholder="080..." t={t} />
        <Field label="X (Twitter) handle" value={xHandle} onChange={setXHandle} placeholder="@handle" t={t} />
      </Card>

      <Card title="Bank Details" dark={dark} t={t} saving={bankSaving} error={bankError} success={bankSuccess}
        onSave={() => save("bank", { bankName, bankAccountNo, bankAccountName }, setBankSaving, setBankError, setBankSuccess)}>
        <Field label="Bank name" value={bankName} onChange={setBankName} placeholder="e.g. GTBank" t={t} />
        <Field label="Account number" value={bankAccountNo} onChange={setBankAccountNo} placeholder="0123456789" t={t} />
        <Field label="Account name" value={bankAccountName} onChange={setBankAccountName} placeholder="Full name on account" t={t} />
        <div className="text-[11.5px]" style={{ color: t.muted }}>Required before you can request payouts.</div>
      </Card>

      <Card title="Change Password" dark={dark} t={t} saving={pwSaving} error={pwError} success={pwSuccess}
        onSave={() => { save("password", { current: currentPw, newPassword: newPw }, setPwSaving, setPwError, setPwSuccess); setCurrentPw(""); setNewPw(""); }}>
        <Field label="Current password" value={currentPw} onChange={setCurrentPw} type="password" t={t} />
        <Field label="New password" value={newPw} onChange={setNewPw} type="password" placeholder="Min 6 characters" t={t} />
      </Card>
    </div>
  );
}

export default function SettingsPage({ member }) {
  return <PortalShell member={member}><Inner member={member} /></PortalShell>;
}
