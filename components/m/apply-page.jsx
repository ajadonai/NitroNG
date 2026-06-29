"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ThemeProvider, useTheme } from "../shared-nav";
import { NitroWordmark } from "../nitro-logo";

const N_PATH = "M1600.82 160.089V1313c-.85 53.13-10.35 104.17-27.19 151.74-48.19 136.54-156.38 244.73-292.92 292.92-50.12 17.76-103.94 27.34-160.08 27.34 0 0-79.39 0-160.01-27.34-85.1-28.88-155.38-85.49-208.28-141.55-72.59-76.84-112.13-179.09-112.13-284.74V1023.4l.08-4.17c0-1.39 0-2.7-.08-4.09-2.08-84.64-69.97-153.06-154.53-155.84-1.85-.08-3.71-.15-5.48-.15-1.78 0-3.71.08-5.48.15-84.56 2.78-152.44 71.2-154.61 155.84-.08 1.39-.08 2.7-.08 4.09v534.87c0 88.42-71.67 160.09-160.09 160.09-44.17 0-84.25-17.92-113.21-46.88C17.92 1626.84 0 1586.76 0 1542.59V995.288c.927-53.132 10.426-104.178 27.261-151.672C75.45 707.003 183.643 598.81 320.179 550.621c50.119-17.685 103.946-27.338 160.089-27.338 0 0 79.388 0 160.012 27.338 85.103 28.882 155.379 85.489 208.278 141.555 72.593 76.84 112.132 179.087 112.132 284.732v320.862l-.077 12.89c-.077 1.39-.077 2.78-.077 4.17 0 1.39 0 2.7.077 4.17 2.085 84.64 69.967 152.99 154.527 155.84h10.97c84.56-2.85 152.44-71.2 154.6-155.84V160.089C1280.71 71.666 1352.38 0 1440.8 0c44.18 0 84.18 17.916 113.14 46.876 28.96 28.96 46.88 69.04 46.88 113.213z";

const GRAD = "linear-gradient(160deg, #c47d8e 0%, #8b5e6b 50%, #6b4a55 100%)";

const PERKS = [
  { icon: "M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1", label: "Earn commission on every sale" },
  { icon: "M13 7h8m0 0v8m0-8l-8 8-4-4-6 6", label: "Grow with tiered rewards" },
  { icon: "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z", label: "Join an active community" },
];

function Inner() {
  const { dark, toggleTheme, t } = useTheme();
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({ name: "", email: "", password: "", phone: "", xHandle: "", whyApply: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [verifyToken, setVerifyToken] = useState(null);
  const [verifyCode, setVerifyCode] = useState("");
  const [verifying, setVerifying] = useState(false);

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  const goStep2 = async () => {
    setError("");
    if (!form.name.trim()) { setError("Please enter your name"); return; }
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
        setForm(f => ({ ...f, name: data.name || f.name, phone: data.phone || f.phone }));
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
        body: JSON.stringify(form),
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

  const inputCls = "w-full px-3.5 py-3 rounded-xl text-[15px] outline-none transition-[border-color] duration-200";
  const inputStyle = { background: t.inputBg, border: `1px solid ${t.inputBorder}`, color: t.text, fontFamily: "inherit" };
  const labelCls = "block text-[13px] font-semibold mb-1.5 uppercase tracking-wider";
  const cardStyle = { background: dark ? '#0e1120' : '#fff', border: `1px solid ${dark ? 'rgba(255,255,255,.22)' : 'rgba(0,0,0,.14)'}`, boxShadow: dark ? '0 20px 60px rgba(0,0,0,.4)' : '0 20px 60px rgba(0,0,0,.1)' };

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

  const StepDots = (
    <div className="flex justify-center gap-1.5 mt-5">
      <div className="w-2 h-2 rounded-full" style={{ background: step === 1 ? t.accent : t.textMuted }} />
      <div className="w-2 h-2 rounded-full" style={{ background: step === 2 ? t.accent : t.textMuted }} />
    </div>
  );

  const ErrorBar = error ? (
    <div className="px-3 py-2.5 rounded-xl text-[13px] leading-tight mb-4 flex items-center gap-2" style={{ background: dark ? 'rgba(220,38,38,0.1)' : '#fef2f2', border: `1px solid ${dark ? 'rgba(220,38,38,.28)' : '#fecaca'}`, color: dark ? '#fca5a5' : '#dc2626' }}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
      {error}
    </div>
  ) : null;

  const EyeBtn = (
    <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 bg-transparent p-0.5" style={{ color: t.textMuted }}>
      {showPw ? (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
      ) : (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
      )}
    </button>
  );

  let cardContent;

  if (submitted) {
    cardContent = (
      <div className="w-full max-w-[440px] rounded-2xl px-8 py-9 max-md:px-6 max-md:py-7 text-center" style={cardStyle}>
        <div className="w-16 h-16 rounded-full mx-auto mb-5 flex items-center justify-center" style={{ background: dark ? 'rgba(110,231,183,0.1)' : 'rgba(5,150,105,0.06)', border: `2px solid ${t.green}` }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={t.green} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
        </div>
        <h1 className="serif text-[22px] font-semibold mb-2 italic" style={{ color: t.text }}>You&apos;re in the queue</h1>
        <p className="text-[15px] leading-relaxed mb-6" style={{ color: t.textSoft }}>
          We&apos;ll review your application and reach out once you&apos;re approved. This usually takes less than 24 hours.
        </p>
        <a href="/pit/login" onClick={e => { e.preventDefault(); router.push("/pit/login"); }} className="inline-flex items-center gap-1.5 text-[14px] font-semibold transition-opacity hover:opacity-80" style={{ color: t.accent, textDecoration: "none" }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="15 18 9 12 15 6" /></svg>
          Back to login
        </a>
      </div>
    );
  } else if (step === "verify") {
    cardContent = (
      <div className="w-full max-w-[440px] rounded-2xl px-8 py-9 max-md:px-6 max-md:py-7" style={cardStyle}>
        <div className="w-14 h-14 rounded-full mx-auto mb-5 flex items-center justify-center" style={{ background: dark ? 'rgba(196,125,142,0.1)' : 'rgba(196,125,142,0.06)', border: `2px solid ${t.accent}` }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={t.accent} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
        </div>
        <h1 className="serif text-2xl font-semibold text-center mb-1 italic" style={{ color: t.text }}>Verify your email</h1>
        <p className="text-[15px] text-center mb-7 font-medium" style={{ color: t.textSoft }}>We found a Nitro account with this email. Enter the 6-digit code we sent to verify it&apos;s you.</p>

        {ErrorBar}

        <div className="flex flex-col gap-4">
          <div>
            <label className={labelCls} style={{ color: t.text }}>Verification code</label>
            <input value={verifyCode} onChange={e => setVerifyCode(e.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="123456" inputMode="numeric" autoComplete="one-time-code" className={inputCls + " text-center tracking-[6px] text-lg font-mono"} style={inputStyle} />
          </div>
          <button type="button" onClick={submitCode} disabled={verifying} className="w-full py-3.5 rounded-xl border-none text-white text-base font-semibold cursor-pointer flex items-center justify-center gap-2 transition-[transform,box-shadow,opacity] duration-200 hover:-translate-y-px hover:shadow-[0_6px_20px_rgba(196,125,142,.31)]" style={{ background: verifying ? '#999' : t.btnPrimary, opacity: verifying ? 0.7 : 1, fontFamily: "inherit" }}>
            {verifying && <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-[spin_0.6s_linear_infinite]" />}
            {verifying ? "Verifying..." : "Verify"}
          </button>
          <button type="button" onClick={() => { setStep(1); setError(""); setVerifyCode(""); setVerifyToken(null); }} className="w-full py-1.5 rounded-[10px] bg-transparent border-none text-sm font-medium cursor-pointer" style={{ color: t.textSoft, fontFamily: "inherit" }}>
            &larr; Back
          </button>
        </div>
      </div>
    );
  } else if (step === 1) {
    cardContent = (
      <div className="w-full max-w-[440px] rounded-2xl px-8 py-9 max-md:px-6 max-md:py-7" style={cardStyle}>
        <h1 className="serif text-2xl font-semibold text-center mb-1 italic" style={{ color: t.text }}>Join the Pit</h1>
        <p className="text-[15px] text-center mb-7 font-medium" style={{ color: t.textSoft }}>Step 1 of 2 — Your details</p>

        {ErrorBar}

        <div className="flex flex-col gap-4">
          <div>
            <label className={labelCls} style={{ color: t.text }}>Full name</label>
            <input value={form.name} onChange={set("name")} required placeholder="Your full name" className={inputCls} style={inputStyle} />
          </div>
          <div>
            <label className={labelCls} style={{ color: t.text }}>Email</label>
            <input type="email" value={form.email} onChange={set("email")} required placeholder="you@example.com" autoComplete="email" className={inputCls} style={inputStyle} />
          </div>
          <div>
            <label className={labelCls} style={{ color: t.text }}>Password</label>
            <div className="relative">
              <input type={showPw ? "text" : "password"} value={form.password} onChange={set("password")} required placeholder="Min. 6 characters" className={inputCls + " pr-11"} style={inputStyle} />
              {EyeBtn}
            </div>
          </div>

          <button type="button" onClick={goStep2} disabled={loading} className="w-full py-3.5 rounded-xl border-none text-white text-base font-semibold cursor-pointer flex items-center justify-center gap-2 transition-[transform,box-shadow,opacity] duration-200 hover:-translate-y-px hover:shadow-[0_6px_20px_rgba(196,125,142,.31)]" style={{ background: loading ? '#999' : t.btnPrimary, opacity: loading ? 0.7 : 1, fontFamily: "inherit" }}>
            {loading && <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-[spin_0.6s_linear_infinite]" />}
            {loading ? "Checking..." : "Continue →"}
          </button>
        </div>

        <p className="text-[14px] text-center mt-6" style={{ color: t.textSoft }}>
          Already have an account?{" "}
          <a href="/pit/login" onClick={e => { e.preventDefault(); router.push("/pit/login"); }} className="font-semibold" style={{ color: t.accent, textDecoration: "none" }}>Sign in</a>
        </p>
        {StepDots}
      </div>
    );
  } else {
    cardContent = (
      <div className="w-full max-w-[440px] rounded-2xl px-8 py-9 max-md:px-6 max-md:py-7" style={cardStyle}>
        <h1 className="serif text-2xl font-semibold text-center mb-1 italic" style={{ color: t.text }}>Almost there</h1>
        <p className="text-[15px] text-center mb-7 font-medium" style={{ color: t.textSoft }}>Step 2 of 2 — A bit more about you</p>

        {ErrorBar}

        <form onSubmit={submit} className="flex flex-col gap-4">
          <div>
            <label className={labelCls} style={{ color: t.text }}>
              Phone <span className="font-normal normal-case tracking-normal" style={{ color: t.textMuted }}>(optional)</span>
            </label>
            <input type="tel" value={form.phone} onChange={set("phone")} placeholder="08012345678" className={inputCls} style={inputStyle} />
          </div>
          <div>
            <label className={labelCls} style={{ color: t.text }}>
              X (Twitter) <span className="font-normal normal-case tracking-normal" style={{ color: t.textMuted }}>(optional)</span>
            </label>
            <input value={form.xHandle} onChange={set("xHandle")} placeholder="@yourhandle" className={inputCls} style={inputStyle} />
          </div>
          <div>
            <label className={labelCls} style={{ color: t.text }}>
              Why do you want to join? <span className="font-normal normal-case tracking-normal" style={{ color: t.textMuted }}>(optional)</span>
            </label>
            <textarea value={form.whyApply} onChange={set("whyApply")} placeholder="Tell us about your audience and how you'd promote Nitro..." rows={3} className={inputCls + " resize-none"} style={inputStyle} />
          </div>

          <button type="submit" disabled={loading} className="w-full py-3.5 rounded-xl border-none text-white text-base font-semibold cursor-pointer flex items-center justify-center gap-2 transition-[transform,box-shadow,opacity] duration-200 hover:-translate-y-px hover:shadow-[0_6px_20px_rgba(196,125,142,.31)]" style={{ background: loading ? '#999' : t.btnPrimary, opacity: loading ? 0.7 : 1, fontFamily: "inherit" }}>
            {loading && <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-[spin_0.6s_linear_infinite]" />}
            {loading ? "Submitting..." : "Submit Application"}
          </button>

          <button type="button" onClick={() => { setStep(1); setError(""); setVerifyCode(""); setVerifyToken(null); }} className="w-full py-1.5 rounded-[10px] bg-transparent border-none text-sm font-medium cursor-pointer" style={{ color: t.textSoft, fontFamily: "inherit" }}>
            &larr; Back to Step 1
          </button>
        </form>
        {StepDots}
      </div>
    );
  }

  return (
    <div className="min-h-screen flex" style={{ background: t.bg }}>
      {/* Desktop left panel */}
      <div className="hidden lg:flex w-[45%] flex-col relative overflow-hidden" style={{ background: GRAD }}>
        <a href="/" className="flex items-center gap-2.5 p-6 no-underline">
          <span className="h-7 px-3 rounded-lg flex items-center justify-center" style={{ background: "rgba(255,255,255,.2)" }}><NitroWordmark height={12} color="#fff" /></span>
        </a>
        <div className="flex-1 flex flex-col items-center justify-center px-10 pb-16">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-6" style={{ background: "rgba(255,255,255,.12)" }}>
            <svg width="28" height="31" viewBox="0 0 1601 1785" fill="#fff"><path d={N_PATH}/></svg>
          </div>
          <h2 className="serif text-white text-[28px] font-semibold mb-2 italic">The Pit</h2>
          <p className="text-[15px] text-center max-w-[260px] mb-8" style={{ color: "rgba(255,255,255,.7)" }}>Nitro&apos;s referral crew. Promote, earn commissions, grow with us.</p>
          <div className="flex flex-col gap-2.5 max-w-[260px] w-full">
            {PERKS.map((p, i) => (
              <div key={i} className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl" style={{ background: "rgba(255,255,255,.1)" }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,.85)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0"><path d={p.icon}/></svg>
                <span className="text-[13px] font-medium" style={{ color: "rgba(255,255,255,.85)" }}>{p.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right side */}
      <div className="flex-1 flex flex-col min-h-screen">
        {/* Mobile/tablet gradient header */}
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

        {/* Desktop toggle */}
        <div className="hidden lg:flex justify-end p-5">{Toggle}</div>

        {/* Card */}
        <div className="flex-1 flex items-center justify-center px-4 py-8 lg:py-0">
          {cardContent}
        </div>
      </div>
    </div>
  );
}

export default function ApplyPage() {
  return <ThemeProvider storageKey="nitro-theme"><Inner /></ThemeProvider>;
}
