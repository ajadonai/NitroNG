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
      const res = await fetch("/api/m/settings", {
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
