"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ThemeProvider, useTheme } from "../shared-nav";
import { NitroWordmark } from "../nitro-logo";

function Inner({ token }) {
  const { dark, toggleTheme, t } = useTheme();
  const router = useRouter();
  const [invite, setInvite] = useState(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
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
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (res.ok) {
        router.push("/pit");
      } else {
        setError(data.error || "Something went wrong");
      }
    } catch { setError("Something went wrong"); }
    setLoading(false);
  };

  const LOGO = <svg width="13" height="14" viewBox="0 0 1601 1785" fill="#fff"><path d="M1600.82 160.089V1313c-.85 53.13-10.35 104.17-27.19 151.74-48.19 136.54-156.38 244.73-292.92 292.92-50.12 17.76-103.94 27.34-160.08 27.34 0 0-79.39 0-160.01-27.34-85.1-28.88-155.38-85.49-208.28-141.55-72.59-76.84-112.13-179.09-112.13-284.74V1023.4l.08-4.17c0-1.39 0-2.7-.08-4.09-2.08-84.64-69.97-153.06-154.53-155.84-1.85-.08-3.71-.15-5.48-.15-1.78 0-3.71.08-5.48.15-84.56 2.78-152.44 71.2-154.61 155.84-.08 1.39-.08 2.7-.08 4.09v534.87c0 88.42-71.67 160.09-160.09 160.09-44.17 0-84.25-17.92-113.21-46.88C17.92 1626.84 0 1586.76 0 1542.59V995.288c.927-53.132 10.426-104.178 27.261-151.672C75.45 707.003 183.643 598.81 320.179 550.621c50.119-17.685 103.946-27.338 160.089-27.338 0 0 79.388 0 160.012 27.338 85.103 28.882 155.379 85.489 208.278 141.555 72.593 76.84 112.132 179.087 112.132 284.732v320.862l-.077 12.89c-.077 1.39-.077 2.78-.077 4.17 0 1.39 0 2.7.077 4.17 2.085 84.64 69.967 152.99 154.527 155.84h10.97c84.56-2.85 152.44-71.2 154.6-155.84V160.089C1280.71 71.666 1352.38 0 1440.8 0c44.18 0 84.18 17.916 113.14 46.876 28.96 28.96 46.88 69.04 46.88 113.213z"/></svg>;

  const inputStyle = { background: t.bg, border: `1px solid ${t.surfaceBrd}`, color: t.text, fontFamily: "inherit" };

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: t.bg }}>
        <div className="text-[13px]" style={{ color: t.muted }}>Verifying invite...</div>
      </div>
    );
  }

  if (pageError) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4" style={{ background: t.bg }}>
        <div className="w-full max-w-[400px] rounded-2xl p-7 text-center" style={{ background: t.surface, border: `1px solid ${t.surfaceBrd}` }}>
          <div className="w-14 h-14 rounded-full mx-auto mb-4 flex items-center justify-center" style={{ background: "rgba(214,48,49,.08)" }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#d63031" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
          </div>
          <h1 className="serif text-[22px] font-semibold mb-2" style={{ color: t.text }}>Invite Issue</h1>
          <p className="text-[13px] mb-5" style={{ color: t.muted }}>{pageError}</p>
          <a href="/pit/login" onClick={e => { e.preventDefault(); router.push("/pit/login"); }} className="text-[13px] font-semibold" style={{ color: t.accent, textDecoration: "none" }}>Go to login</a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4" style={{ background: t.bg }}>
      <div className="mb-6 flex items-center gap-2">
        <span className="h-7 px-3 rounded-lg flex items-center justify-center" style={{ background: "linear-gradient(135deg,#c47d8e,#8b5e6b)" }}><NitroWordmark height={12} color="#fff" /></span>
        <span className="text-xs py-0.5 px-1.5 rounded font-semibold" style={{ background: dark ? "rgba(196,125,142,.15)" : "rgba(196,125,142,.08)", color: t.accent }}>PIT</span>
      </div>
      <div className="w-full max-w-[400px] rounded-2xl p-7" style={{ background: t.surface, border: `1px solid ${t.surfaceBrd}` }}>
        <h1 className="serif text-[22px] font-semibold text-center mb-1" style={{ color: t.text }}>Join the Crew</h1>
        <p className="text-[13px] text-center mb-6" style={{ color: t.muted }}>
          Welcome, <span className="font-semibold" style={{ color: t.text }}>{invite.name}</span>. Set a password to get started.
        </p>

        {error && <div className="text-[13px] text-center mb-4 py-2 px-3 rounded-lg" style={{ color: "#d63031", background: "rgba(214,48,49,.08)" }}>{error}</div>}

        <form onSubmit={submit} className="flex flex-col gap-4">
          <div>
            <label className="block text-[12px] font-medium mb-1.5" style={{ color: t.muted }}>Email</label>
            <input type="email" value={invite.email} disabled className="w-full h-10 px-3 rounded-lg border text-[13.5px] outline-none opacity-60" style={inputStyle} />
          </div>
          <div>
            <label className="block text-[12px] font-medium mb-1.5" style={{ color: t.muted }}>Password</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} required placeholder="Min. 6 characters" className="w-full h-10 px-3 rounded-lg border text-[13.5px] outline-none" style={inputStyle} />
          </div>
          <div>
            <label className="block text-[12px] font-medium mb-1.5" style={{ color: t.muted }}>Confirm password</label>
            <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} required placeholder="Re-enter password" className="w-full h-10 px-3 rounded-lg border text-[13.5px] outline-none" style={inputStyle} />
          </div>
          <button type="submit" disabled={loading} className="w-full h-10 rounded-lg border-none text-white text-[13.5px] font-semibold cursor-pointer transition-opacity" style={{ background: t.grad, opacity: loading ? 0.6 : 1, fontFamily: "inherit" }}>
            {loading ? "Joining..." : "Join Crew"}
          </button>
        </form>
      </div>
      <button onClick={toggleTheme} className="mt-5 w-[44px] h-6 rounded-xl border-none relative cursor-pointer transition-colors duration-300" style={{ background: dark ? t.accent : "rgba(0,0,0,.08)" }}>
        <span className="absolute w-[18px] h-[18px] rounded-full bg-white top-[3px] shadow-[0_1px_4px_rgba(0,0,0,.2)] transition-[left] duration-300" style={{ left: dark ? 23 : 3 }} />
      </button>
    </div>
  );
}

export default function JoinPage({ token }) {
  return <ThemeProvider storageKey="nitro-theme"><Inner token={token} /></ThemeProvider>;
}
