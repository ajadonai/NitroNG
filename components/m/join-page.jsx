"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ThemeProvider, useTheme } from "../shared-nav";
import { PitAuthFrame, PitLabel, PitInput, PitButton, PitError, PitFoot, PitLink } from "./login-page";

function Inner({ token }) {
  const { t } = useTheme();
  const router = useRouter();
  const [invite, setInvite] = useState(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [phone, setPhone] = useState("");
  const [xHandle, setXHandle] = useState("");
  const [error, setError] = useState("");
  const [pageError, setPageError] = useState("");
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    fetch(`/api/pit/auth/join?token=${token}`)
      .then(r => r.json().then(d => ({ ok: r.ok, data: d })))
      .then(({ ok, data }) => {
        if (ok) setInvite(data);
        else if (data.error === "already_joined") setPageError("You've already accepted this invite. Sign in instead.");
        else setPageError(data.error || "Invalid invite");
      })
      .catch(() => setPageError("Something went wrong"))
      .finally(() => setChecking(false));
  }, [token]);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    if (password.length < 6) { setError("Password must be at least 6 characters"); return; }
    if (password !== confirm) { setError("Passwords don't match"); return; }
    setLoading(true);
    try {
      const res = await fetch("/api/pit/auth/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password, phone: phone.trim() || undefined, xHandle: xHandle.trim().replace(/^@/, "") || undefined }),
      });
      const data = await res.json();
      if (res.ok) {
        router.push("/pit/dashboard");
      } else {
        setError(data.error || "Something went wrong");
      }
    } catch { setError("Something went wrong"); }
    setLoading(false);
  };

  if (checking) {
    return <PitAuthFrame side="steps" title="Join the crew" sub="Verifying invite..." />;
  }

  if (pageError) {
    return (
      <PitAuthFrame side="steps" title="Invite issue" sub={pageError}>
        <PitFoot>
          <PitLink href="/pit/login" onNav={() => router.push("/pit/login")}>Go to sign in</PitLink>
        </PitFoot>
      </PitAuthFrame>
    );
  }

  return (
    <PitAuthFrame side="steps" title="Join the crew" sub={`Welcome, ${invite.name}. Set a password to get started.`}>
      <PitError>{error}</PitError>

      <form onSubmit={submit} className="flex flex-col">
        <PitLabel>Email</PitLabel>
        <PitInput type="email" value={invite.email} disabled className="opacity-60" />

        <PitLabel>Password</PitLabel>
        <PitInput type="password" value={password} onChange={e => setPassword(e.target.value)} required placeholder="Min. 6 characters" />

        <PitLabel>Confirm password</PitLabel>
        <PitInput type="password" value={confirm} onChange={e => setConfirm(e.target.value)} required placeholder="Re-enter password" />

        <PitLabel>Phone number <span className="font-normal normal-case tracking-normal" style={{ color: t.textMuted }}>(optional)</span></PitLabel>
        <PitInput type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="e.g. 08012345678" />

        <PitLabel>X (Twitter) handle <span className="font-normal normal-case tracking-normal" style={{ color: t.textMuted }}>(optional)</span></PitLabel>
        <PitInput value={xHandle} onChange={e => setXHandle(e.target.value)} placeholder="@yourhandle" />

        <PitButton type="submit" disabled={loading} loading={loading}>{loading ? "Joining..." : "Join crew"}</PitButton>
      </form>
    </PitAuthFrame>
  );
}

export default function JoinPage({ token }) {
  return <ThemeProvider storageKey="nitro-theme"><Inner token={token} /></ThemeProvider>;
}
