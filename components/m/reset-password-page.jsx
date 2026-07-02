"use client";
import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ThemeProvider, useTheme } from "../shared-nav";
import { NitroWordmark } from "../nitro-logo";

const N_PATH = "M1600.82 160.089V1313c-.85 53.13-10.35 104.17-27.19 151.74-48.19 136.54-156.38 244.73-292.92 292.92-50.12 17.76-103.94 27.34-160.08 27.34 0 0-79.39 0-160.01-27.34-85.1-28.88-155.38-85.49-208.28-141.55-72.59-76.84-112.13-179.09-112.13-284.74V1023.4l.08-4.17c0-1.39 0-2.7-.08-4.09-2.08-84.64-69.97-153.06-154.53-155.84-1.85-.08-3.71-.15-5.48-.15-1.78 0-3.71.08-5.48.15-84.56 2.78-152.44 71.2-154.61 155.84-.08 1.39-.08 2.7-.08 4.09v534.87c0 88.42-71.67 160.09-160.09 160.09-44.17 0-84.25-17.92-113.21-46.88C17.92 1626.84 0 1586.76 0 1542.59V995.288c.927-53.132 10.426-104.178 27.261-151.672C75.45 707.003 183.643 598.81 320.179 550.621c50.119-17.685 103.946-27.338 160.089-27.338 0 0 79.388 0 160.012 27.338 85.103 28.882 155.379 85.489 208.278 141.555 72.593 76.84 112.132 179.087 112.132 284.732v320.862l-.077 12.89c-.077 1.39-.077 2.78-.077 4.17 0 1.39 0 2.7.077 4.17 2.085 84.64 69.967 152.99 154.527 155.84h10.97c84.56-2.85 152.44-71.2 154.6-155.84V160.089C1280.71 71.666 1352.38 0 1440.8 0c44.18 0 84.18 17.916 113.14 46.876 28.96 28.96 46.88 69.04 46.88 113.213z";

const GRAD = "linear-gradient(160deg, #c47d8e 0%, #8b5e6b 50%, #6b4a55 100%)";

function Inner() {
  const { dark, toggleTheme, t } = useTheme();
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

  const inputCls = "w-full px-3.5 py-3 rounded-xl text-[15px] outline-none transition-[border-color] duration-200";
  const inputStyle = { background: t.inputBg, border: `1px solid ${t.inputBorder}`, color: t.text, fontFamily: "inherit" };
  const labelCls = "block text-[13px] font-semibold mb-1.5 uppercase tracking-wider";
  const cardStyle = { background: dark ? '#0e1120' : '#fff', border: `1px solid ${dark ? 'rgba(255,255,255,.22)' : 'rgba(0,0,0,.14)'}`, boxShadow: dark ? '0 20px 60px rgba(0,0,0,.4)' : '0 20px 60px rgba(0,0,0,.1)' };

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

  const ErrorBar = error ? (
    <div className="px-3 py-2.5 rounded-xl text-[13px] leading-tight mb-4 flex items-center gap-2" style={{ background: dark ? 'rgba(220,38,38,0.1)' : '#fef2f2', border: `1px solid ${dark ? 'rgba(220,38,38,.28)' : '#fecaca'}`, color: dark ? '#fca5a5' : '#dc2626' }}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
      {error}
    </div>
  ) : null;

  const Toggle = (
    <button onClick={toggleTheme} className="w-[44px] h-6 rounded-xl border-none relative cursor-pointer transition-colors duration-300 shrink-0" style={{ background: dark ? t.accent : "rgba(0,0,0,.08)" }}>
      <span className="absolute w-[18px] h-[18px] rounded-full bg-white top-[3px] shadow-[0_1px_4px_rgba(0,0,0,.2)] transition-[left] duration-300" style={{ left: dark ? 23 : 3 }} />
    </button>
  );

  const GradToggle = (
    <button onClick={toggleTheme} className="w-[44px] h-6 rounded-xl border-none relative cursor-pointer transition-colors duration-300 shrink-0" style={{ background: "rgba(255,255,255,.2)" }}>
      <span className="absolute w-[18px] h-[18px] rounded-full bg-white top-[3px] shadow-[0_1px_4px_rgba(0,0,0,.2)] transition-[left] duration-300" style={{ left: dark ? 23 : 3 }} />
    </button>
  );

  let cardContent;

  if (done) {
    cardContent = (
      <div className="w-full max-w-[440px] rounded-2xl px-8 py-9 max-md:px-6 max-md:py-7 text-center" style={cardStyle}>
        <div className="w-16 h-16 rounded-full mx-auto mb-5 flex items-center justify-center" style={{ background: dark ? 'rgba(110,231,183,0.1)' : 'rgba(5,150,105,0.06)', border: `2px solid ${t.green}` }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={t.green} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
        </div>
        <h1 className="serif text-[22px] font-semibold mb-2 italic" style={{ color: t.text }}>Password reset</h1>
        <p className="text-[15px] leading-relaxed mb-6" style={{ color: t.textSoft }}>Your password has been updated. You can now sign in with your new password.</p>
        <a href="/pit/login" onClick={e => { e.preventDefault(); router.push("/pit/login"); }} className="inline-flex items-center gap-1.5 text-[14px] font-semibold transition-opacity hover:opacity-80" style={{ color: t.accent, textDecoration: "none" }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="15 18 9 12 15 6" /></svg>
          Back to login
        </a>
      </div>
    );
  } else if (sent) {
    cardContent = (
      <div className="w-full max-w-[440px] rounded-2xl px-8 py-9 max-md:px-6 max-md:py-7 text-center" style={cardStyle}>
        <div className="w-16 h-16 rounded-full mx-auto mb-5 flex items-center justify-center" style={{ background: dark ? 'rgba(196,125,142,0.1)' : 'rgba(196,125,142,0.06)', border: `2px solid ${t.accent}` }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={t.accent} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
        </div>
        <h1 className="serif text-[22px] font-semibold mb-2 italic" style={{ color: t.text }}>Check your email</h1>
        <p className="text-[15px] leading-relaxed mb-6" style={{ color: t.textSoft }}>If an account exists with that email, we&apos;ve sent a reset link. It expires in 30 minutes.</p>
        <a href="/pit/login" onClick={e => { e.preventDefault(); router.push("/pit/login"); }} className="inline-flex items-center gap-1.5 text-[14px] font-semibold transition-opacity hover:opacity-80" style={{ color: t.accent, textDecoration: "none" }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="15 18 9 12 15 6" /></svg>
          Back to login
        </a>
      </div>
    );
  } else if (token) {
    cardContent = (
      <div className="w-full max-w-[440px] rounded-2xl px-8 py-9 max-md:px-6 max-md:py-7" style={cardStyle}>
        <h1 className="serif text-2xl font-semibold text-center mb-1 italic" style={{ color: t.text }}>New password</h1>
        <p className="text-[15px] text-center mb-7 font-medium" style={{ color: t.textSoft }}>Choose a new password for your account</p>
        {ErrorBar}
        <form onSubmit={resetPassword} className="flex flex-col gap-4">
          <div>
            <label className={labelCls} style={{ color: t.text }}>New password</label>
            <div className="relative">
              <input type={showPw ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)} required placeholder="Min. 6 characters" className={inputCls + " pr-11"} style={inputStyle} />
              <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 bg-transparent p-0.5" style={{ color: t.textMuted }}>
                {showPw ? (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                ) : (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                )}
              </button>
            </div>
          </div>
          <button type="submit" disabled={loading} className="w-full py-3.5 rounded-xl border-none text-white text-base font-semibold cursor-pointer flex items-center justify-center gap-2 transition-[transform,box-shadow,opacity] duration-200 hover:-translate-y-px hover:shadow-[0_6px_20px_rgba(196,125,142,.31)]" style={{ background: loading ? '#999' : t.btnPrimary, opacity: loading ? 0.7 : 1, fontFamily: "inherit" }}>
            {loading && <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-[spin_0.6s_linear_infinite]" />}
            {loading ? "Resetting..." : "Reset Password"}
          </button>
        </form>
      </div>
    );
  } else {
    cardContent = (
      <div className="w-full max-w-[440px] rounded-2xl px-8 py-9 max-md:px-6 max-md:py-7" style={cardStyle}>
        <h1 className="serif text-2xl font-semibold text-center mb-1 italic" style={{ color: t.text }}>Forgot password</h1>
        <p className="text-[15px] text-center mb-7 font-medium" style={{ color: t.textSoft }}>Enter your email and we&apos;ll send a reset link</p>
        {ErrorBar}
        <form onSubmit={requestReset} className="flex flex-col gap-4">
          <div>
            <label className={labelCls} style={{ color: t.text }}>Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="you@example.com" autoComplete="email" className={inputCls} style={inputStyle} />
          </div>
          <button type="submit" disabled={loading} className="w-full py-3.5 rounded-xl border-none text-white text-base font-semibold cursor-pointer flex items-center justify-center gap-2 transition-[transform,box-shadow,opacity] duration-200 hover:-translate-y-px hover:shadow-[0_6px_20px_rgba(196,125,142,.31)]" style={{ background: loading ? '#999' : t.btnPrimary, opacity: loading ? 0.7 : 1, fontFamily: "inherit" }}>
            {loading && <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-[spin_0.6s_linear_infinite]" />}
            {loading ? "Sending..." : "Send Reset Link"}
          </button>
        </form>
        <p className="text-[14px] text-center mt-6" style={{ color: t.textSoft }}>
          Remember your password?{" "}
          <a href="/pit/login" onClick={e => { e.preventDefault(); router.push("/pit/login"); }} className="font-semibold" style={{ color: t.accent, textDecoration: "none" }}>Sign in</a>
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: t.bg }}>
      <div className="lg:hidden flex flex-col relative overflow-hidden" style={{ background: GRAD }}>
        <div className="flex items-center justify-between px-5 pt-4 pb-2">
          <a href="/" className="flex items-center gap-2 no-underline">
            <span className="w-7 h-7 rounded-[7px] flex items-center justify-center" style={{ background: "rgba(255,255,255,.2)" }}>
              <svg width="11" height="12" viewBox="0 0 1601 1785" fill="#fff"><path d={N_PATH}/></svg>
            </span>
          </a>
          {GradToggle}
        </div>
        <div className="flex flex-col items-center px-6 pb-7 pt-3">
          <h2 className="serif text-white text-[20px] font-semibold mb-1 italic">The Pit</h2>
          <p className="text-[13px] text-center" style={{ color: "rgba(255,255,255,.65)" }}>Nitro&apos;s referral crew</p>
        </div>
      </div>
      <div className="hidden lg:flex justify-between items-center p-5">
        <a href="/" className="flex items-center gap-2.5 no-underline">
          <span className="h-7 px-3 rounded-lg flex items-center justify-center" style={{ background: dark ? "rgba(255,255,255,.08)" : "rgba(0,0,0,.06)" }}><NitroWordmark height={12} color={t.text} /></span>
        </a>
        {Toggle}
      </div>
      <div className="flex-1 flex items-center justify-center px-4 py-8 lg:py-0">
        {cardContent}
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return <ThemeProvider storageKey="nitro-theme"><Inner /></ThemeProvider>;
}
