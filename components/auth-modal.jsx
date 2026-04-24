'use client';
import { useState, useEffect, useRef } from 'react';

function Lbl({ t, htmlFor, children }) {
  return (
    <label
      htmlFor={htmlFor}
      className="block text-[13px] font-semibold mb-1.5 uppercase tracking-wider"
      style={{ color: t.text }}
    >
      {children}
    </label>
  );
}

function PwStrength({ pw, t }) {
  const checks = [
    pw.length >= 8,
    /[A-Z]/.test(pw),
    /[0-9]/.test(pw),
    /[^A-Za-z0-9]/.test(pw),
  ];
  const score = checks.filter(Boolean).length;
  const labels = ['', 'Weak', 'Fair', 'Good', 'Strong'];
  const colors = ['', '#dc2626', '#d97706', '#2563eb', '#059669'];
  const tooShort = pw.length < 6;
  const label = tooShort ? 'Too short' : labels[score] || '';
  const color = tooShort ? '#dc2626' : colors[score] || '';
  const fill = tooShort ? 1 : score;

  return (
    <div
      className="min-h-[20px] mb-1"
      style={{ visibility: pw ? 'visible' : 'hidden' }}
    >
      <div className="flex gap-[3px] mb-[3px]">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="flex-1 h-[3px] rounded-sm transition-[background] duration-300"
            style={{
              background:
                i <= fill ? color : t.inputBorder || '#ddd',
            }}
          />
        ))}
      </div>
      <div
        className="text-[11px] font-medium"
        style={{ color: color || 'transparent' }}
      >
        {label || '\u00A0'}
      </div>
    </div>
  );
}

function AuthModal({ dark, t, mode, setMode, onClose, prefill }) {
  const [method, setMethod] = useState('email');
  const [showPw, setShowPw] = useState(false);
  const [showPw2, setShowPw2] = useState(false);
  const [step, setStep] = useState(1);
  const [remember, setRemember] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [error, setError] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [emailTaken, setEmailTaken] = useState(false);
  const [emailChecking, setEmailChecking] = useState(false);
  const emailCheckTimer = useRef(null);
  const [phone, setPhone] = useState('');
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [refCode, setRefCode] = useState('');
  const [agree, setAgree] = useState(false);
  const [forgotSent, setForgotSent] = useState(false);

  useEffect(() => {
    setAuthLoading(false);
    setError('');
    setPw('');
    setPw2('');
    setEmailTaken(false);
    setForgotSent(false);
    if (mode === 'signup' && prefill) {
      const parts = (prefill.name || '').split(' ');
      setFirstName(parts[0] || '');
      setLastName(parts.slice(1).join(' ') || '');
      setName(prefill.name || '');
      setEmail(prefill.email || '');
      setStep(2);
    } else {
      setStep(1);
      setFirstName('');
      setLastName('');
      setName('');
      setEmail('');
      setPhone('');
    }
  }, [mode]);

  useEffect(() => {
    if (mode !== 'signup' || !email || !validEmail) {
      setEmailTaken(false);
      return;
    }
    setEmailChecking(true);
    if (emailCheckTimer.current) clearTimeout(emailCheckTimer.current);
    emailCheckTimer.current = setTimeout(() => {
      fetch('/api/auth/check-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
        .then((r) => r.json())
        .then((d) => {
          setEmailTaken(!d.available);
          setEmailChecking(false);
        })
        .catch(() => setEmailChecking(false));
    }, 600);
    return () => {
      if (emailCheckTimer.current) clearTimeout(emailCheckTimer.current);
    };
  }, [email, mode]);

  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const r = p.get('ref');
    if (r) setRefCode(r);
  }, []);

  const handleLogin = async () => {
    setError('');
    const contact = method === 'email' ? email : phone;
    if (!contact || !pw) {
      setError('Please fill in all fields');
      return;
    }
    setAuthLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: method === 'email' ? email : `+234${phone}`,
          password: pw,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.banned) {
          window.location.href = '/banned';
          return;
        }
        setError(data.error || 'Login failed');
        setAuthLoading(false);
        return;
      }
      window.location.replace('/dashboard');
    } catch (err) {
      console.error('[Login Error]', err);
      setError('Network error. Check your connection and try again.');
      setAuthLoading(false);
    }
  };

  const handleSignup = async () => {
    setError('');
    if (!name || !email || !pw) {
      setError('Please fill in all fields');
      return;
    }
    if (pw.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    if (pw !== pw2) {
      setError("Passwords don't match");
      return;
    }
    if (!agree) {
      setError('Please agree to the Terms of Service');
      return;
    }
    setAuthLoading(true);
    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          firstName,
          lastName,
          email: method === 'email' ? email : `+234${phone}`,
          password: pw,
          phone: phone ? `+234${phone}` : undefined,
          referralCode: refCode || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Signup failed');
        setAuthLoading(false);
        return;
      }
      window.location.replace('/dashboard');
    } catch (err) {
      console.error('[Signup Error]', err);
      setError('Network error. Check your connection and try again.');
      setAuthLoading(false);
    }
  };

  const handleForgot = async () => {
    setError('');
    if (!email) {
      setError('Please enter your email');
      return;
    }
    setAuthLoading(true);
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to send reset link');
        setAuthLoading(false);
        return;
      }
      setForgotSent(true);
      setAuthLoading(false);
    } catch {
      setError('Something went wrong.');
      setAuthLoading(false);
    }
  };

  const validEmail =
    email && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
  const validPhone = phone && /^[0-9]{10,11}$/.test(phone);
  const pwMatch = pw2.length > 0 && pw === pw2;
  const pwMismatch = pw2.length > 0 && pw !== pw2;

  const EyeBtn = ({ show, toggle }) => (
    <button
      onClick={toggle}
      type="button"
      className="absolute right-3 top-1/2 -translate-y-1/2 bg-transparent p-0.5"
      style={{ color: t.textMuted }}
    >
      {show ? (
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24" />
          <line x1="1" y1="1" x2="23" y2="23" />
        </svg>
      ) : (
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      )}
    </button>
  );

  const MethodToggle = () => (
    <div
      className="flex mb-5 rounded-[10px] p-[3px]"
      style={{
        background: dark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)',
        border: `1px solid ${t.surfaceBorder}`,
      }}
    >
      <button
        onClick={() => setMethod('email')}
        className="flex-1 py-[9px] rounded-lg text-sm font-medium"
        style={{
          background: method === 'email' ? t.accentLight : 'transparent',
          color: method === 'email' ? t.accent : t.textMuted,
        }}
      >
        Email
      </button>
      <button
        onClick={() => setMethod('phone')}
        className="flex-1 py-[9px] rounded-lg text-sm font-medium"
        style={{
          background: method === 'phone' ? t.accentLight : 'transparent',
          color: method === 'phone' ? t.accent : t.textMuted,
        }}
      >
        Phone
      </button>
    </div>
  );

  return (
    <div
      onClick={onClose}
      onKeyDown={e=>{if(e.key==='Escape')onClose()}}
      className="fixed inset-0 z-100 backdrop-blur-[8px] flex items-center justify-center p-4 animate-[fi_0.2s_ease]"
      style={{ background: t.overlay }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={mode === 'login' ? 'Log in' : 'Create account'}
        onClick={(e) => e.stopPropagation()}
        className="auth-card w-full max-w-[440px] max-h-[90dvh] overflow-y-auto overflow-x-hidden rounded-[20px] px-8 py-9 relative backdrop-blur-[20px]"
        style={{
          background: dark
            ? 'rgba(17,22,40,0.98)'
            : 'rgba(255,255,255,0.98)',
          border: `1px solid ${t.surfaceBorder}`,
          boxShadow: dark
            ? '0 20px 60px rgba(0,0,0,0.5)'
            : '0 20px 60px rgba(0,0,0,0.1)',
        }}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="auth-close absolute top-3.5 right-3.5 w-8 h-8 rounded-[10px] flex items-center justify-center text-base font-semibold leading-none"
          style={{
            background: dark
              ? 'rgba(255,255,255,.06)'
              : 'rgba(0,0,0,.04)',
            color: dark ? '#c47d8e' : '#1c1b19',
          }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>

        {/* Heading */}
        <h2
          className="serif text-2xl font-semibold text-center mb-1 italic"
          style={{ color: t.text }}
        >
          {mode === 'login'
            ? "Let's run it up"
            : mode === 'forgot'
              ? 'Forgot password?'
              : step === 1
                ? 'Create Account'
                : 'Secure Your Account'}
        </h2>

        {/* Subheading */}
        <p
          className="text-[15px] text-center mb-7 font-medium"
          style={{ color: t.textSoft }}
        >
          {mode === 'login'
            ? 'Sign in and start boosting'
            : mode === 'forgot'
              ? forgotSent
                ? 'Check your email'
                : 'Enter your email for reset link'
              : step === 1
                ? 'Step 1 of 2 — Your details'
                : 'Step 2 of 2 — Set your password'}
        </p>

        {/* Error bar */}
        <div className="h-9 mb-0.5 flex items-center">
          {error ? (
            <div
              className="w-full px-3 py-2 rounded-lg text-[13px] leading-tight"
              style={{
                background: dark ? 'rgba(220,38,38,0.1)' : '#fef2f2',
                border: `1px solid ${dark ? 'rgba(220,38,38,.28)' : '#fecaca'}`,
                color: dark ? '#fca5a5' : '#dc2626',
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{display:"inline",verticalAlign:"middle"}}><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg> {error}
            </div>
          ) : null}
        </div>

        {/* ====== LOGIN MODE ====== */}
        {mode === 'login' && (
          <>
            {/* Google button */}
            <button
              onClick={() => {
                setError('');
                setAuthLoading(true);
                window.location.href = '/api/auth/google';
              }}
              className="google-btn w-full py-[13px] rounded-xl flex items-center justify-center gap-2.5 text-[15px] font-semibold mb-0 transition-[color,transform] duration-200 hover:-translate-y-px"
              style={{
                background: dark ? 'rgba(255,255,255,.06)' : '#fff',
                border: `1px solid ${dark ? 'rgba(255,255,255,.18)' : 'rgba(0,0,0,.19)'}`,
                color: dark ? '#eae7e2' : '#333',
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24">
                <path
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                  fill="#4285F4"
                />
                <path
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  fill="#34A853"
                />
                <path
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  fill="#FBBC05"
                />
                <path
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  fill="#EA4335"
                />
              </svg>
              Continue with Google
            </button>

            {/* Divider */}
            <div className="flex items-center gap-3.5 my-4">
              <div
                className="flex-1 h-px"
                style={{
                  background: dark
                    ? 'rgba(255,255,255,.08)'
                    : 'rgba(0,0,0,.08)',
                }}
              />
              <span
                className="text-[13px] font-medium"
                style={{ color: t.textMuted }}
              >
                or
              </span>
              <div
                className="flex-1 h-px"
                style={{
                  background: dark
                    ? 'rgba(255,255,255,.08)'
                    : 'rgba(0,0,0,.08)',
                }}
              />
            </div>

            {/* Email / Phone input */}
            <Lbl t={t} htmlFor="login-identity">
              {method === 'email' ? 'Email Address' : 'Phone Number'}
            </Lbl>
            {method === 'email' ? (
              <input
                id="login-identity"
                value={email}
                onChange={(e) =>
                  setEmail(e.target.value.trim().toLowerCase().slice(0, 254))
                }
                placeholder="you@example.com"
                type="email"
                autoComplete="email"
                className="w-full px-3.5 py-3 rounded-xl text-[15px] outline-none mb-4"
                style={{
                  background: t.inputBg,
                  border: `1px solid ${t.inputBorder}`,
                  color: t.text,
                }}
              />
            ) : (
              <div className="flex gap-2 mb-2">
                <div
                  className="px-3.5 py-2.5 rounded-xl text-sm shrink-0"
                  style={{
                    background: t.inputBg,
                    border: `1px solid ${t.inputBorder}`,
                    color: t.textSoft,
                  }}
                >
                  +234
                </div>
                <input
                  id="login-identity"
                  value={phone}
                  onChange={(e) =>
                    setPhone(e.target.value.replace(/\D/g, '').slice(0, 11))
                  }
                  placeholder="8012345678"
                  type="tel"
                  autoComplete="tel"
                  className="flex-1 px-3.5 py-3 rounded-xl text-[15px] outline-none"
                  style={{
                    background: t.inputBg,
                    border: `1px solid ${t.inputBorder}`,
                    color: t.text,
                  }}
                />
              </div>
            )}

            {/* Password */}
            <Lbl t={t} htmlFor="login-password">Password</Lbl>
            <div className="relative mb-4">
              <input
                id="login-password"
                value={pw}
                onChange={(e) => setPw(e.target.value.slice(0, 128))}
                placeholder="Enter password"
                maxLength={128}
                type={showPw ? 'text' : 'password'}
                onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                className="w-full pl-3.5 pr-11 py-3 rounded-xl text-[15px] outline-none"
                style={{
                  background: t.inputBg,
                  border: `1px solid ${t.inputBorder}`,
                  color: t.text,
                }}
              />
              <EyeBtn show={showPw} toggle={() => setShowPw(!showPw)} />
            </div>

            {/* Remember me + Forgot */}
            <div className="flex justify-between items-center mb-6">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                  className="w-[15px] h-[15px]"
                  style={{ accentColor: t.accent }}
                />
                <span
                  className="text-[13px]"
                  style={{ color: t.textSoft }}
                >
                  Remember me
                </span>
              </label>
              <button
                onClick={() => setMode('forgot')}
                className="bg-transparent text-[13px] font-medium"
                style={{ color: t.accent }}
              >
                Forgot password?
              </button>
            </div>

            {/* Login button */}
            <button
              onClick={handleLogin}
              disabled={authLoading}
              className="w-full py-3.5 rounded-xl text-white text-base font-semibold mb-5 flex items-center justify-center gap-2 transition-[transform,box-shadow] duration-200 hover:-translate-y-px hover:shadow-[0_6px_20px_rgba(196,125,142,.31)]"
              style={{
                background: authLoading ? '#999' : t.btnPrimary,
                opacity: authLoading ? 0.7 : 1,
              }}
            >
              {authLoading && (
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-[spin_0.6s_linear_infinite]" />
              )}
              {authLoading ? 'Signing in...' : 'Sign In'}
            </button>

            {/* Switch to signup */}
            <div
              className="text-center text-sm"
              style={{ color: t.textSoft }}
            >
              Don&apos;t have an account?{' '}
              <button
                onClick={() => setMode('signup')}
                className="bg-transparent font-semibold text-sm"
                style={{ color: t.accent }}
              >
                Sign Up Free
              </button>
            </div>
          </>
        )}

        {/* ====== SIGNUP STEP 1 ====== */}
        {mode === 'signup' && step === 1 && (
          <>
            {/* Google button */}
            <button
              onClick={() => {
                setError('');
                window.location.href = '/api/auth/google';
              }}
              className="google-btn w-full py-[13px] rounded-xl flex items-center justify-center gap-2.5 text-[15px] font-semibold mb-0 transition-[color,transform] duration-200 hover:-translate-y-px"
              style={{
                background: dark ? 'rgba(255,255,255,.06)' : '#fff',
                border: `1px solid ${dark ? 'rgba(255,255,255,.18)' : 'rgba(0,0,0,.19)'}`,
                color: dark ? '#eae7e2' : '#333',
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24">
                <path
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                  fill="#4285F4"
                />
                <path
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  fill="#34A853"
                />
                <path
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  fill="#FBBC05"
                />
                <path
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  fill="#EA4335"
                />
              </svg>
              Sign up with Google
            </button>

            {/* Divider */}
            <div className="flex items-center gap-3.5 my-4">
              <div
                className="flex-1 h-px"
                style={{
                  background: dark
                    ? 'rgba(255,255,255,.08)'
                    : 'rgba(0,0,0,.08)',
                }}
              />
              <span
                className="text-[13px] font-medium"
                style={{ color: t.textMuted }}
              >
                or
              </span>
              <div
                className="flex-1 h-px"
                style={{
                  background: dark
                    ? 'rgba(255,255,255,.08)'
                    : 'rgba(0,0,0,.08)',
                }}
              />
            </div>

            {/* First / Last name */}
            <div className="flex gap-2.5 mb-4">
              <div className="flex-1">
                <Lbl t={t} htmlFor="signup-first">First Name</Lbl>
                <input
                  id="signup-first"
                  value={firstName}
                  onChange={(e) =>
                    setFirstName(
                      e.target.value
                        .replace(/[^a-zA-Z\u00C0-\u017F\s'\-\.]/g, '')
                        .slice(0, 50)
                    )
                  }
                  placeholder="First"
                  maxLength={50}
                  type="text"
                  className="w-full px-3.5 py-3 rounded-xl text-[15px] outline-none"
                  style={{
                    background: t.inputBg,
                    border: `1px solid ${t.inputBorder}`,
                    color: t.text,
                  }}
                />
              </div>
              <div className="flex-1">
                <Lbl t={t} htmlFor="signup-last">Last Name</Lbl>
                <input
                  id="signup-last"
                  value={lastName}
                  onChange={(e) =>
                    setLastName(
                      e.target.value
                        .replace(/[^a-zA-Z\u00C0-\u017F\s'\-\.]/g, '')
                        .slice(0, 50)
                    )
                  }
                  placeholder="Last"
                  maxLength={50}
                  type="text"
                  className="w-full px-3.5 py-3 rounded-xl text-[15px] outline-none"
                  style={{
                    background: t.inputBg,
                    border: `1px solid ${t.inputBorder}`,
                    color: t.text,
                  }}
                />
              </div>
            </div>

            {/* Email */}
            <Lbl t={t} htmlFor="signup-email">Email Address</Lbl>
            <input
              id="signup-email"
              value={email}
              onChange={(e) =>
                setEmail(e.target.value.trim().toLowerCase().slice(0, 254))
              }
              placeholder="you@example.com"
              type="email"
              autoComplete="email"
              className="w-full px-3.5 py-3 rounded-xl text-[15px] outline-none mb-1"
              style={{
                background: t.inputBg,
                border: `1px solid ${t.inputBorder}`,
                color: t.text,
              }}
            />
            <div className="min-h-[16px] mb-1">
              {email && !validEmail ? (
                <span
                  className="text-xs"
                  style={{ color: dark ? '#fca5a5' : '#dc2626' }}
                >
                  Please enter a valid email
                </span>
              ) : email && validEmail && emailTaken ? (
                <span
                  className="text-xs"
                  style={{ color: dark ? '#fca5a5' : '#dc2626' }}
                >
                  This email is already registered
                </span>
              ) : email && validEmail && emailChecking ? (
                <span
                  className="text-xs"
                  style={{ color: t.textMuted }}
                >
                  Checking...
                </span>
              ) : null}
            </div>

            {/* Continue button */}
            <button
              onClick={() => {
                setError('');
                if (!firstName || !lastName) {
                  setError('Please enter your first and last name');
                  return;
                }
                if (method === 'email' && (!email || !validEmail)) {
                  setError('Please enter a valid email');
                  return;
                }
                setName(`${firstName} ${lastName}`);
                setStep(2);
              }}
              className="w-full py-3.5 rounded-xl text-white text-base font-semibold mb-5 transition-[transform,box-shadow] duration-200 hover:-translate-y-px hover:shadow-[0_6px_20px_rgba(196,125,142,.31)]"
              style={{ background: t.btnPrimary }}
            >
              Continue →
            </button>

            {/* Switch to login */}
            <div
              className="text-center text-sm"
              style={{ color: t.textSoft }}
            >
              Already have an account?{' '}
              <button
                onClick={() => setMode('login')}
                className="bg-transparent font-semibold text-sm"
                style={{ color: t.accent }}
              >
                Log In
              </button>
            </div>

            {/* Step dots */}
            <div className="flex justify-center gap-1.5 mt-5">
              <div
                className="w-2 h-2 rounded-full"
                style={{ background: t.accent }}
              />
              <div
                className="w-2 h-2 rounded-full"
                style={{ background: t.textMuted }}
              />
            </div>
          </>
        )}

        {/* ====== SIGNUP STEP 2 ====== */}
        {mode === 'signup' && step === 2 && (
          <>
            {/* Password */}
            <Lbl t={t} htmlFor="signup-password">Password</Lbl>
            <div className="relative mb-1">
              <input
                id="signup-password"
                placeholder="Min. 6 characters"
                value={pw}
                onChange={(e) => setPw(e.target.value.slice(0, 128))}
                type={showPw ? 'text' : 'password'}
                maxLength={128}
                className="w-full pl-3.5 pr-11 py-3 rounded-xl text-[15px] outline-none"
                style={{
                  background: t.inputBg,
                  border: `1px solid ${t.inputBorder}`,
                  color: t.text,
                }}
              />
              <EyeBtn show={showPw} toggle={() => setShowPw(!showPw)} />
            </div>
            <PwStrength pw={pw} t={t} />

            {/* Confirm password */}
            <Lbl t={t} htmlFor="signup-confirm">Confirm Password</Lbl>
            <div className="relative mb-1">
              <input
                id="signup-confirm"
                value={pw2}
                onChange={(e) => setPw2(e.target.value.slice(0, 128))}
                placeholder="Re-enter password"
                maxLength={128}
                type={showPw2 ? 'text' : 'password'}
                className="w-full pl-3.5 pr-11 py-3 rounded-xl text-[15px] outline-none"
                style={{
                  background: t.inputBg,
                  border: `1px solid ${
                    pwMismatch
                      ? dark
                        ? 'rgba(220,38,38,0.4)'
                        : '#fecaca'
                      : pwMatch
                        ? dark
                          ? 'rgba(110,231,183,0.4)'
                          : '#a7f3d0'
                        : t.inputBorder
                  }`,
                  color: t.text,
                }}
              />
              <EyeBtn
                show={showPw2}
                toggle={() => setShowPw2(!showPw2)}
              />
            </div>
            <div className="min-h-[18px] mb-1">
              {pwMatch ? (
                <div
                  className="text-xs"
                  style={{ color: dark ? '#6ee7b7' : '#059669' }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{display:"inline",verticalAlign:"middle"}}><polyline points="20 6 9 17 4 12"/></svg> Passwords match
                </div>
              ) : pwMismatch ? (
                <div
                  className="text-xs"
                  style={{ color: dark ? '#fca5a5' : '#dc2626' }}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{display:"inline",verticalAlign:"middle"}}><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg> Passwords don&apos;t match
                </div>
              ) : null}
            </div>

            {/* Referral code */}
            <Lbl t={t} htmlFor="signup-referral">
              Referral Code{' '}
              <span
                className="font-normal"
                style={{ color: t.textMuted }}
              >
                (optional)
              </span>
            </Lbl>
            <input
              id="signup-referral"
              value={refCode}
              onChange={(e) =>
                setRefCode(
                  e.target.value
                    .replace(/[^a-zA-Z0-9\-]/g, '')
                    .toUpperCase()
                    .slice(0, 20)
                )
              }
              placeholder="e.g. NTR-7X92"
              maxLength={20}
              type="text"
              className="w-full px-3.5 py-3 rounded-xl text-[15px] outline-none mb-4"
              style={{
                background: t.inputBg,
                border: `1px solid ${t.inputBorder}`,
                color: t.text,
              }}
            />

            {/* Terms checkbox */}
            <label className="flex items-start gap-2.5 mb-3 cursor-pointer">
              <input
                type="checkbox"
                checked={agree}
                onChange={(e) => setAgree(e.target.checked)}
                className="mt-[3px] w-4 h-4 shrink-0"
                style={{ accentColor: t.accent }}
              />
              <span
                className="text-[13px] leading-normal"
                style={{ color: t.textSoft }}
              >
                I agree to the{' '}
                <a
                  href="/terms"
                  className="no-underline"
                  style={{ color: t.accent }}
                >
                  Terms
                </a>{' '}
                and{' '}
                <a
                  href="/privacy"
                  className="no-underline"
                  style={{ color: t.accent }}
                >
                  Privacy Policy
                </a>
              </span>
            </label>

            {/* Create account button */}
            <button
              onClick={handleSignup}
              disabled={authLoading}
              className="w-full py-3.5 rounded-xl text-white text-base font-semibold mb-2 flex items-center justify-center gap-2 transition-[transform,box-shadow] duration-200 hover:-translate-y-px hover:shadow-[0_6px_20px_rgba(196,125,142,.31)]"
              style={{
                background: authLoading ? '#999' : t.btnPrimary,
                opacity: authLoading ? 0.7 : 1,
              }}
            >
              {authLoading && (
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-[spin_0.6s_linear_infinite]" />
              )}
              {authLoading ? 'Creating...' : 'Create Account'}
            </button>

            {/* Back button */}
            <button
              onClick={() => setStep(1)}
              className="w-full py-1.5 rounded-[10px] bg-transparent text-sm font-medium"
              style={{ color: t.textSoft }}
            >
              ← Back to Step 1
            </button>

            {/* Step dots */}
            <div className="flex justify-center gap-1.5 mt-4">
              <div
                className="w-2 h-2 rounded-full"
                style={{ background: t.textMuted }}
              />
              <div
                className="w-2 h-2 rounded-full"
                style={{ background: t.accent }}
              />
            </div>
          </>
        )}

        {/* ====== FORGOT MODE — FORM ====== */}
        {mode === 'forgot' && !forgotSent && (
          <>
            <Lbl t={t} htmlFor="forgot-email">Email Address</Lbl>
            <input
              id="forgot-email"
              value={email}
              onChange={(e) =>
                setEmail(e.target.value.trim().toLowerCase().slice(0, 254))
              }
              placeholder="you@example.com"
              type="email"
              className="w-full px-3.5 py-3 rounded-xl text-[15px] outline-none mb-5"
              style={{
                background: t.inputBg,
                border: `1px solid ${t.inputBorder}`,
                color: t.text,
              }}
            />

            <button
              onClick={handleForgot}
              disabled={authLoading}
              className="w-full py-3.5 rounded-xl text-white text-base font-semibold mb-5 flex items-center justify-center gap-2 transition-[transform,box-shadow] duration-200 hover:-translate-y-px hover:shadow-[0_6px_20px_rgba(196,125,142,.31)]"
              style={{
                background: authLoading ? '#999' : t.btnPrimary,
                opacity: authLoading ? 0.7 : 1,
              }}
            >
              {authLoading && (
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-[spin_0.6s_linear_infinite]" />
              )}
              {authLoading ? 'Sending...' : 'Send Reset Link'}
            </button>

            <div
              className="text-center text-sm"
              style={{ color: t.textSoft }}
            >
              Remember your password?{' '}
              <button
                onClick={() => setMode('login')}
                className="bg-transparent font-semibold text-sm"
                style={{ color: t.accent }}
              >
                Log In
              </button>
            </div>
          </>
        )}

        {/* ====== FORGOT MODE — SENT ====== */}
        {mode === 'forgot' && forgotSent && (
          <>
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-5"
              style={{
                background: dark
                  ? 'rgba(110,231,183,0.1)'
                  : 'rgba(5,150,105,0.06)',
                border: `2px solid ${t.green}`,
              }}
            >
              <svg
                width="28"
                height="28"
                viewBox="0 0 24 24"
                fill="none"
                stroke={t.green}
                strokeWidth="1.5"
              >
                <rect x="2" y="4" width="20" height="16" rx="2" />
                <polyline points="22,6 12,13 2,6" />
              </svg>
            </div>

            <p
              className="text-[15px] text-center mb-1"
              style={{ color: t.textSoft }}
            >
              Reset link sent to
            </p>
            <p
              className="text-[15px] font-semibold text-center mb-6"
              style={{ color: t.text }}
            >
              {email}
            </p>
            <p
              className="text-sm text-center mb-6"
              style={{ color: t.textMuted }}
            >
              Check your inbox and spam folder.
            </p>

            <button
              onClick={() => setMode('login')}
              className="w-full py-3.5 rounded-xl text-white text-base font-semibold"
              style={{ background: t.btnPrimary }}
            >
              Back to Login
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export default AuthModal;
