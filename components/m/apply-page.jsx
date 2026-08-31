"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ThemeProvider, useTheme } from "../shared-nav";
import { PitAuthFrame, PitLabel, PitInput, PitTextarea, PitEye, PitButton, PitBack, PitError, PitFoot, PitLink } from "./login-page";

function Inner() {
  const { t } = useTheme();
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({ firstName: "", lastName: "", email: "", password: "", phone: "", xHandle: "", whyApply: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [verifyToken, setVerifyToken] = useState(null);
  const [verifyCode, setVerifyCode] = useState("");
  const [verifying, setVerifying] = useState(false);

  const set = (k) => (e) => {
    let val = e.target.value;
    if (k === "firstName" || k === "lastName") val = val.replace(/[^a-zA-ZÀ-ÿ'-]/g, "");
    setForm(f => ({ ...f, [k]: val }));
  };

  const goStep2 = async () => {
    setError("");
    if (!form.firstName.trim()) { setError("Please enter your first name"); return; }
    if (!form.lastName.trim()) { setError("Please enter your last name"); return; }
    if (!form.email.trim()) { setError("Please enter your email"); return; }
    if (!form.password || form.password.length < 6) { setError("Password must be at least 6 characters"); return; }
    setLoading(true);
    try {
      const res = await fetch("/api/pit/auth/verify-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: form.email }),
      });
      const data = await res.json();
      if (data.error) { setError(data.error); setLoading(false); return; }
      if (data.exists) {
        setVerifyToken(data.token);
        setStep("verify");
      } else {
        setStep(2);
      }
    } catch { setError("Something went wrong"); }
    setLoading(false);
  };

  const submitCode = async () => {
    setError("");
    if (!verifyCode.trim()) { setError("Please enter the code"); return; }
    setVerifying(true);
    try {
      const res = await fetch("/api/pit/auth/verify-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: form.email, code: verifyCode, token: verifyToken }),
      });
      const data = await res.json();
      if (data.error) { setError(data.error); setVerifying(false); return; }
      if (data.verified) {
        if (data.name) {
          const parts = data.name.trim().split(/\s+/);
          setForm(f => ({ ...f, firstName: parts[0] || f.firstName, lastName: parts.slice(1).join(" ") || f.lastName, phone: data.phone || f.phone }));
        } else {
          setForm(f => ({ ...f, phone: data.phone || f.phone }));
        }
        setStep(2);
      }
    } catch { setError("Something went wrong"); }
    setVerifying(false);
  };

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/pit/auth/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, name: `${form.firstName.trim()} ${form.lastName.trim()}` }),
      });
      const data = await res.json();
      if (res.ok) {
        setSubmitted(true);
      } else {
        setError(data.error || "Something went wrong");
      }
    } catch { setError("Something went wrong"); }
    setLoading(false);
  };

  const backToStep1 = () => { setStep(1); setError(""); setVerifyCode(""); setVerifyToken(null); };

  const optional = <span className="font-normal normal-case tracking-normal" style={{ color: t.textMuted }}>(optional)</span>;

  if (submitted) {
    return (
      <PitAuthFrame side="steps" title="You're in the queue" sub="We'll review your application and reach out once you're approved. This usually takes less than 24 hours.">
        <PitFoot>
          <PitLink href="/pit/login" onNav={() => router.push("/pit/login")}>Back to sign in</PitLink>
        </PitFoot>
      </PitAuthFrame>
    );
  }

  if (step === "verify") {
    return (
      <PitAuthFrame side="steps" eyebrow="Step 1 of 2" title="Verify your email" sub="We found a Nitro account with this email. Enter the 6-digit code we sent to verify it's you.">
        <PitError>{error}</PitError>

        <PitLabel>Verification code</PitLabel>
        <PitInput value={verifyCode} onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="123456" inputMode="numeric" autoComplete="one-time-code" className="text-center tracking-[6px] m" />

        <PitButton type="button" onClick={submitCode} disabled={verifying} loading={verifying}>{verifying ? "Verifying..." : "Verify"}</PitButton>
        <PitBack onClick={backToStep1}>&larr; Back</PitBack>
      </PitAuthFrame>
    );
  }

  if (step === 1) {
    return (
      <PitAuthFrame side="steps" eyebrow="Step 1 of 2" title="Join the Pit" sub="Tell us who you are. We approve by hand, usually the same day.">
        <PitError>{error}</PitError>

        <div className="grid grid-cols-2 gap-2.5">
          <div>
            <PitLabel>First name</PitLabel>
            <PitInput value={form.firstName} onChange={set("firstName")} required placeholder="First name" maxLength={30} />
          </div>
          <div>
            <PitLabel>Last name</PitLabel>
            <PitInput value={form.lastName} onChange={set("lastName")} required placeholder="Last name" maxLength={30} />
          </div>
        </div>

        <PitLabel>Email</PitLabel>
        <PitInput type="email" value={form.email} onChange={set("email")} required placeholder="you@example.com" autoComplete="email" />

        <PitLabel>Password</PitLabel>
        <div className="relative">
          <PitInput type={showPw ? "text" : "password"} value={form.password} onChange={set("password")} required placeholder="Min. 6 characters" className="pr-11" />
          <PitEye shown={showPw} onToggle={() => setShowPw(!showPw)} />
        </div>

        <PitButton type="button" onClick={goStep2} disabled={loading} loading={loading}>{loading ? "Checking..." : "Continue"}</PitButton>

        <PitFoot>
          Already applied? <PitLink href="/pit/login" onNav={() => router.push("/pit/login")}>Sign in</PitLink>
        </PitFoot>
      </PitAuthFrame>
    );
  }

  return (
    <PitAuthFrame side="steps" eyebrow="Step 2 of 2" title="Almost there" sub="A bit more about you, so we know where you will promote.">
      <PitError>{error}</PitError>

      <form onSubmit={submit} className="flex flex-col">
        <PitLabel>Phone {optional}</PitLabel>
        <PitInput type="tel" value={form.phone} onChange={set("phone")} placeholder="08012345678" />

        <PitLabel>X (Twitter) {optional}</PitLabel>
        <PitInput value={form.xHandle} onChange={set("xHandle")} placeholder="@yourhandle" />

        <PitLabel>Why do you want to join? {optional}</PitLabel>
        <PitTextarea value={form.whyApply} onChange={set("whyApply")} placeholder="Tell us about your audience and how you'd promote Nitro..." rows={3} />

        <PitButton type="submit" disabled={loading} loading={loading}>{loading ? "Submitting..." : "Submit application"}</PitButton>
        <PitBack onClick={backToStep1}>&larr; Back to step 1</PitBack>
      </form>
    </PitAuthFrame>
  );
}

export default function ApplyPage() {
  return <ThemeProvider storageKey="nitro-theme"><Inner /></ThemeProvider>;
}
