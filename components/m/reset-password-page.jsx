"use client";
import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ThemeProvider } from "../shared-nav";
import { PitAuthFrame, PitLabel, PitInput, PitEye, PitButton, PitError, PitFoot, PitLink } from "./login-page";

function Inner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const [done, setDone] = useState(false);

  const requestReset = async (e) => {
    e.preventDefault();
    setError(""); setLoading(true);
    try {
      const res = await fetch("/api/pit/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (data.error) { setError(data.error); } else { setSent(true); }
    } catch { setError("Something went wrong"); }
    setLoading(false);
  };

  const resetPassword = async (e) => {
    e.preventDefault();
    setError(""); setLoading(true);
    try {
      const res = await fetch("/api/pit/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (res.ok) { setDone(true); } else { setError(data.error || "Something went wrong"); }
    } catch { setError("Something went wrong"); }
    setLoading(false);
  };

  const backToLogin = (
    <PitFoot>
      <PitLink href="/pit/login" onNav={() => router.push("/pit/login")}>Back to sign in</PitLink>
    </PitFoot>
  );

  if (done) {
    return (
      <PitAuthFrame side="earn" title="Password reset" sub="Your password has been updated. You can now sign in with your new password.">
        {backToLogin}
      </PitAuthFrame>
    );
  }

  if (sent) {
    return (
      <PitAuthFrame side="earn" title="Check your email" sub="If an account exists with that email, we've sent a reset link. It expires in 30 minutes.">
        {backToLogin}
      </PitAuthFrame>
    );
  }

  if (token) {
    return (
      <PitAuthFrame side="earn" title="New password" sub="Choose a new password for your account.">
        <PitError>{error}</PitError>
        <form onSubmit={resetPassword} className="flex flex-col">
          <PitLabel>New password</PitLabel>
          <div className="relative">
            <PitInput type={showPw ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)} required placeholder="Min. 6 characters" className="pr-11" />
            <PitEye shown={showPw} onToggle={() => setShowPw(!showPw)} />
          </div>
          <PitButton type="submit" disabled={loading} loading={loading}>{loading ? "Resetting..." : "Reset password"}</PitButton>
        </form>
      </PitAuthFrame>
    );
  }

  return (
    <PitAuthFrame side="earn" title="Forgot password" sub="Enter your email and we'll send a reset link.">
      <PitError>{error}</PitError>
      <form onSubmit={requestReset} className="flex flex-col">
        <PitLabel>Email</PitLabel>
        <PitInput type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="you@example.com" autoComplete="email" />
        <PitButton type="submit" disabled={loading} loading={loading}>{loading ? "Sending..." : "Send reset link"}</PitButton>
      </form>
      <PitFoot>
        Remember your password? <PitLink href="/pit/login" onNav={() => router.push("/pit/login")}>Sign in</PitLink>
      </PitFoot>
    </PitAuthFrame>
  );
}

export default function ResetPasswordPage() {
  return <ThemeProvider storageKey="nitro-theme"><Inner /></ThemeProvider>;
}
